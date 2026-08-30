"""Typer application — argument parsing and output formatting only.

Business logic lives in :mod:`loglens.engine`; this module resolves inputs,
builds the pipeline, and renders results. Exit codes: 0 success, 1 critical
incident found, 2 usage/config error, 3 I/O error.
"""

import time
from collections.abc import Iterator
from pathlib import Path

import typer

from loglens.engine import Engine, build_rules, load_config, parse_time_filter
from loglens.engine.filters import TimeFilter
from loglens.engine.pipeline import parse_inputs
from loglens.errors import ConfigError, InputError
from loglens.io.readers import resolve_inputs
from loglens.models import LogEvent, Report
from loglens.reporters import get_reporter
from loglens.rules.base import BaseRule
from loglens.samplegen import generate

EXIT_OK = 0
EXIT_CRITICAL = 1
EXIT_USAGE = 2
EXIT_IO = 3

_FORMAT_HELP = "Report format: terminal, json, or html."
_SINCE_HELP = "Only events at/after this time (30m or ISO-8601)."
_UNTIL_HELP = "Only events at/before this time (30m or ISO-8601)."

app = typer.Typer(
    name="loglens",
    help="Normalize application logs, detect anomalies, and build actionable reports.",
    no_args_is_help=True,
)


def _version_callback(value: bool) -> None:
    if value:
        from loglens import __version__

        typer.echo(f"loglens {__version__}")
        raise typer.Exit(EXIT_OK)


@app.callback()
def _root(
    version: bool = typer.Option(
        False, "--version", help="Show the version and exit.", callback=_version_callback
    ),
) -> None:
    """LogLens: parse logs, detect incidents, and report health."""


@app.command()
def parse(
    input: str = typer.Argument(..., help="Log file, glob pattern, or '-' for stdin."),
    format: str = typer.Option("terminal", "--format", help="Output format: terminal or json."),
    since: str | None = typer.Option(None, "--since", help=_SINCE_HELP),
    until: str | None = typer.Option(None, "--until", help=_UNTIL_HELP),
    limit: int = typer.Option(100, "--limit", help="Max events to display (0 = unlimited)."),
) -> None:
    """Normalize events from INPUT and print them as a table or JSON."""
    if format not in ("terminal", "json"):
        _fail(f"invalid --format '{format}' (use terminal or json)", EXIT_USAGE)
    _resolve_inputs_or_exit([input])
    time_filter = _time_filter_or_exit(since, until)
    events = list(_filtered(parse_inputs([input]), time_filter, limit))
    if format == "json":
        import json

        payload = [e.model_dump(mode="json", exclude_none=True) for e in events]
        typer.echo(json.dumps(payload, indent=2))
    else:
        _print_event_table(events, limit)
    raise typer.Exit(EXIT_OK)


@app.command()
def report(
    inputs: list[str] = typer.Argument(..., help="Files, globs, or '-' for stdin (repeatable)."),
    out: Path | None = typer.Option(
        None, "--out", help="Write the report to this file (html defaults to report.html)."
    ),
    format: str | None = typer.Option(
        None,
        "--format",
        help="Report format: terminal, json, or html (default: html when --out ends in .html).",
    ),
    config: Path | None = typer.Option(
        None, "--config", help="TOML or JSON config: enable/disable rules, override thresholds."
    ),
    since: str | None = typer.Option(None, "--since", help=_SINCE_HELP),
    until: str | None = typer.Option(None, "--until", help=_UNTIL_HELP),
) -> None:
    """Analyze one or more inputs and produce an actionable report."""
    if format is None:
        format = "html" if out is not None and out.suffix.lower() == ".html" else "terminal"
    if format not in ("terminal", "json", "html"):
        _fail(f"invalid --format '{format}' (use terminal, json, or html)", EXIT_USAGE)
    rules = _rules_or_exit(config)
    time_filter = _time_filter_or_exit(since, until)
    analysis = _analyze([str(i) for i in inputs], rules, time_filter)
    _render(analysis, format, out)
    if analysis.critical_count > 0:
        raise typer.Exit(EXIT_CRITICAL)
    raise typer.Exit(EXIT_OK)


@app.command()
def watch(
    input: str = typer.Argument(..., help="Log file to watch (file growth); '-' is not supported."),
    interval: float = typer.Option(5.0, "--interval", min=0.1, help="Seconds between report runs."),
    max_runs: int = typer.Option(0, "--max-runs", help="Stop after N runs (0 = until Ctrl-C)."),
    format: str = typer.Option("terminal", "--format", help=_FORMAT_HELP),
    config: Path | None = typer.Option(None, "--config", help="TOML or JSON config file."),
    since: str | None = typer.Option(None, "--since", help=_SINCE_HELP),
    until: str | None = typer.Option(None, "--until", help=_UNTIL_HELP),
) -> None:
    """Re-run the report on a growing file every --interval seconds until Ctrl-C."""
    if input == "-":
        _fail("watch needs a real file (stdin cannot be re-read)", EXIT_USAGE)
    if format not in ("terminal", "json", "html"):
        _fail(f"invalid --format '{format}' (use terminal, json, or html)", EXIT_USAGE)
    rules = _rules_or_exit(config)
    time_filter = _time_filter_or_exit(since, until)
    critical_seen = False
    runs = 0
    try:
        while max_runs <= 0 or runs < max_runs:
            analysis = _analyze([input], rules, time_filter)
            _render(analysis, format, None)
            critical_seen = critical_seen or analysis.critical_count > 0
            runs += 1
            if max_runs <= 0 or runs < max_runs:
                time.sleep(interval)
    except KeyboardInterrupt:
        typer.echo("\nwatch stopped", err=True)
    raise typer.Exit(EXIT_CRITICAL if critical_seen else EXIT_OK)


@app.command()
def sample(
    events: int = typer.Option(
        5000, "--events", min=1, help="Approximate number of baseline events to generate."
    ),
    dir: Path = typer.Option("./samples", "--dir", help="Directory to write demo logs into."),
) -> None:
    """Generate deterministic demo logs containing four planted anomalies."""
    try:
        files = generate(events, dir)
    except OSError as exc:
        _fail(f"cannot write samples to '{dir}': {exc.strerror or 'unknown error'}", EXIT_IO)
    for generated in files:
        typer.echo(f"wrote {generated.path} ({generated.lines} lines)")
    typer.echo("planted: error-rate spike, repeated error, latency outliers, level gap")
    raise typer.Exit(EXIT_OK)


# -- helpers (boundary glue only) -------------------------------------------


def _fail(message: str, code: int) -> None:
    typer.secho(f"loglens: error: {message}", err=True, fg=typer.colors.RED)
    raise typer.Exit(code)


def _resolve_inputs_or_exit(inputs: list[str]) -> None:
    try:
        resolve_inputs(inputs)
    except InputError as exc:
        _fail(exc.message, EXIT_IO)


def _rules_or_exit(config: Path | None) -> list[BaseRule]:
    if config is None:
        return build_rules(None)
    try:
        return build_rules(load_config(str(config)))
    except ConfigError as exc:
        _fail(exc.message, EXIT_USAGE)


def _time_filter_or_exit(since: str | None, until: str | None) -> TimeFilter | None:
    try:
        return parse_time_filter(since, until, Engine().clock)
    except ValueError as exc:
        _fail(str(exc), EXIT_USAGE)


def _analyze(inputs: list[str], rules: list[BaseRule], time_filter: TimeFilter | None) -> Report:
    engine = Engine(rules, time_filter=time_filter)
    try:
        return engine.run(parse_inputs(inputs), inputs=inputs)
    except InputError as exc:
        _fail(exc.message, EXIT_IO)


def _render(analysis: Report, format: str, out: Path | None) -> None:
    target_path = out
    if format == "html" and target_path is None:
        target_path = Path("report.html")
    if target_path is not None:
        try:
            with target_path.open("w", encoding="utf-8") as handle:
                get_reporter(format)(analysis, handle)
        except OSError as exc:
            _fail(f"cannot write '{target_path}': {exc.strerror or 'unknown error'}", EXIT_IO)
        typer.echo(f"report written to {target_path}", err=True)
    else:
        get_reporter(format)(analysis, None)


def _filtered(
    events: Iterator[LogEvent], time_filter: TimeFilter | None, limit: int
) -> Iterator[LogEvent]:
    count = 0
    for event in events:
        if time_filter is not None and not time_filter.matches(event):
            continue
        if limit and count >= limit:
            break
        count += 1
        yield event


def _print_event_table(events: list[LogEvent], limit: int) -> None:
    from rich.console import Console
    from rich.table import Table

    console = Console()
    table = Table(title=f"Parsed events ({len(events)} shown)")
    for column in ("#", "Timestamp (UTC)", "Level", "Logger", "Message"):
        table.add_column(column, overflow="fold")
    for event in events:
        stamp = event.timestamp.strftime("%Y-%m-%d %H:%M:%S") if event.timestamp else "-"
        message = event.message or event.raw
        table.add_row(str(event.line), stamp, event.level.value, event.logger or "-", message)
    console.print(table)
    if limit and len(events) == limit:
        console.print("[dim]output limited by --limit; raise it or use --format json[/dim]")
