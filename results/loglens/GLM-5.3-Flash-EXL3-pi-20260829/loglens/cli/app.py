"""LogLens CLI: arg parsing + output formatting ONLY (no business logic)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
import re
import time
from typing import Annotated, Optional

import typer

from loglens.engine.pipeline import Engine
from loglens.models.config import load_config
from loglens.models.errors import ConfigError, LogLensError, SourceError
from loglens.parsers.detect import AutoDetectParser
from loglens.reporters.html_report import write_html
from loglens.reporters.json_report import render_json
from loglens.reporters.terminal import render_terminal
from loglens.samplegen.generator import SampleGenerator

app = typer.Typer(
    name="loglens",
    help="Normalize logs, detect anomalies, produce actionable reports.",
    no_args_is_help=True,
    add_completion=False,
)

# Exit codes (spec §6)
EXIT_OK = 0
EXIT_CRITICAL = 1
EXIT_USAGE = 2
EXIT_IO = 3


def parse_since_until(value: str | None) -> datetime | None:
    """Parse a --since/--until value: relative like 30m/2h/7d or ISO-8601."""
    if value is None:
        return None
    text = value.strip()
    match = re.fullmatch(r"(\d+)([smhd])", text)
    if match:
        amount, unit = int(match.group(1)), match.group(2)
        seconds = {"s": 1, "m": 60, "h": 3600, "d": 86400}[unit]
        return datetime.now(tz=UTC) - timedelta(seconds=amount * seconds)
    try:
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    except ValueError as exc:
        raise typer.BadParameter(
            f"invalid time filter '{value}': use a relative value like 30m/2h/7d or ISO-8601"
        ) from exc


TimeFilter = Annotated[
    Optional[str],
    typer.Option(help="Only include events after this time (relative like 30m, or ISO-8601)."),
]
UntilFilter = Annotated[
    Optional[str],
    typer.Option(help="Only include events before this time (relative like 30m, or ISO-8601)."),
]
ConfigOption = Annotated[
    Optional[Path],
    typer.Option(exists=False, help="TOML config file enabling/disabling rules and overriding thresholds."),
]


def _build_engine(config_path: Path | None) -> Engine:
    rule_config = load_config(config_path) if config_path else None
    return Engine(parser=AutoDetectParser(), config=rule_config)


def _run_report(inputs: tuple[str, ...], config_path: Path | None, since: str | None, until: str | None) -> tuple[int, str]:
    """Shared report path. Returns (exit_code, sources, report)."""
    engine = _build_engine(config_path)
    sources = list(inputs)
    report = engine.analyze(
        _iter_source_lines(sources),
        since=parse_since_until(since),
        until=parse_since_until(until),
    )
    return (EXIT_CRITICAL if report.has_critical else EXIT_OK, sources, report)


def _iter_source_lines(sources: list[str]):
    from loglens.io.readers import iter_lines

    return iter_lines(sources)


@app.command(help="Normalize a log input and print the parsed events as a table (or JSON).")
def parse(
    input: Annotated[str, typer.Argument(help="Log file, glob pattern, or '-' for stdin.")],
    since: TimeFilter = None,
    until: UntilFilter = None,
    format: Annotated[str, typer.Option("--format", help="Output format: table or json.")] = "table",
    limit: Annotated[int, typer.Option("--limit", help="Maximum events to print.")] = 50,
) -> None:
    try:
        engine = _build_engine(None)
        report = engine.analyze(
            _iter_source_lines([input]),
            since=parse_since_until(since),
            until=parse_since_until(until),
        )
    except (SourceError, LogLensError) as exc:
        typer.secho(f"error: {exc}", fg=typer.colors.RED, err=True)
        raise typer.Exit(EXIT_IO) from exc
    except typer.BadParameter:
        raise

    if format == "json":
        typer.echo(render_json_events(engine, input, since, until, limit))
    else:
        _print_parse_table(engine, input, since, until, limit)


def _print_parse_table(engine: Engine, input: str, since: str | None, until: str | None, limit: int) -> None:
    from rich.console import Console
    from rich.table import Table

    rows = list(engine.iter_events(_iter_source_lines([input]), since=parse_since_until(since), until=parse_since_until(until)))[:limit]
    console = Console()
    table = Table(title=f"Parsed events ({input})", title_style="bold")
    table.add_column("#", justify="right")
    table.add_column("Timestamp (UTC)")
    table.add_column("Level")
    table.add_column("Logger")
    table.add_column("Message", overflow="fold")
    for event in rows:
        table.add_row(
            str(event.event_id),
            event.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            event.level,
            event.logger or "-",
            event.message[:90],
        )
    console.print(table)


def render_json_events(engine: Engine, input: str, since: str | None, until: str | None, limit: int) -> str:
    import json

    events = list(engine.iter_events(_iter_source_lines([input]), since=parse_since_until(since), until=parse_since_until(until)))[:limit]
    return json.dumps([e.model_dump(mode="json") for e in events], indent=2)


@app.command(help="Analyze one or more inputs (files, globs, or '-' for stdin) and produce a report.")
def report(
    input: Annotated[list[str], typer.Argument(help="Files, glob patterns, or '-' for stdin.")],
    out: Annotated[Optional[Path], typer.Option("--out", help="Write the report to this file (implies --format html if unset).")] = None,
    format: Annotated[str, typer.Option("--format", help="Output format: terminal, json, or html.")] = "terminal",
    config: ConfigOption = None,
    since: TimeFilter = None,
    until: UntilFilter = None,
) -> None:
    effective_format = "html" if (out is not None and format == "terminal") else format
    if effective_format not in ("terminal", "json", "html"):
        typer.secho(f"error: unknown format '{format}' (expected terminal, json, or html)", fg=typer.colors.RED, err=True)
        raise typer.Exit(EXIT_USAGE)

    try:
        exit_code, _sources, report = _run_report(tuple(input), config, since, until)
    except ConfigError as exc:
        typer.secho(f"config error: {exc}", fg=typer.colors.RED, err=True)
        raise typer.Exit(EXIT_USAGE) from exc
    except SourceError as exc:
        typer.secho(f"input error: {exc}", fg=typer.colors.RED, err=True)
        raise typer.Exit(EXIT_IO) from exc

    if effective_format == "html":
        written = write_html(report, out or Path("report.html"))
        typer.secho(f"HTML report written to {written}", fg=typer.colors.GREEN)
    elif effective_format == "json":
        typer.echo(render_json(report))
    else:
        typer.echo(render_terminal(report))
    raise typer.Exit(exit_code)


@app.command(help="Re-run the report on a growing file every --interval seconds until Ctrl-C.")
def watch(
    input: Annotated[str, typer.Argument(help="Log file to watch.")],
    interval: Annotated[int, typer.Option("--interval", min=1, help="Seconds between re-runs.")] = 5,
    config: ConfigOption = None,
) -> None:
    try:
        while True:
            try:
                exit_code, _sources, report = _run_report((input,), config, None, None)
            except SourceError as exc:
                typer.secho(f"input error: {exc}", fg=typer.colors.RED, err=True)
                raise typer.Exit(EXIT_IO) from exc
            typer.echo(render_terminal(report))
            typer.echo(f"— watching {input} (Ctrl-C to stop) —")
            time.sleep(interval)
    except KeyboardInterrupt:
        raise typer.Exit(EXIT_OK) from None


@app.command(help="Generate demo log files containing planted anomalies.")
def sample(
    events: Annotated[int, typer.Option("--events", min=100, help="Approximate number of events to generate.")] = 5000,
    dir: Annotated[Path, typer.Option("--dir", help="Output directory.")] = Path("./samples"),
) -> None:
    generator = SampleGenerator()
    try:
        written = generator.write_files(dir, total_events=events)
    except OSError as exc:
        typer.secho(f"error writing samples: {exc}", fg=typer.colors.RED, err=True)
        raise typer.Exit(EXIT_IO) from exc
    for path in written:
        typer.secho(f"wrote {path}", fg=typer.colors.GREEN)
    typer.echo("Planted scenarios: 30% error-rate window; connection error ×12; latency outliers; payments CRITICAL.")


if __name__ == "__main__":  # pragma: no cover
    app()
