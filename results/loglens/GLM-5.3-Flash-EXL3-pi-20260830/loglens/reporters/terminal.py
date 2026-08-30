"""Terminal reporter: rich tables to stdout (or a provided stream)."""

from rich.table import Table
from rich.text import Text

from loglens.models import Report
from loglens.reporters.base import register_reporter


@register_reporter("terminal")
def render_terminal(report: Report, out: object | None = None) -> None:
    """Print summary, incidents, and top messages as rich tables."""
    from rich.console import Console

    console = Console(file=out) if out is not None else Console()

    summary = Table(title="LogLens summary", show_header=False, expand=True)
    summary.add_column("metric", style="bold")
    summary.add_column("value")
    summary.add_row("Events", str(report.events_total))
    summary.add_row("Parse errors", str(report.parse_errors))
    summary.add_row("Health score", _score_text(report.health_score))
    summary.add_row("Time range", _time_range(report))
    summary.add_row("Incidents", str(len(report.incidents)))
    console.print(summary)

    if report.incidents:
        table = Table(title="Incidents", expand=True)
        for column in ("Severity", "Rule", "Window", "Summary", "Suggested action"):
            table.add_column(column)
        for incident in report.incidents:
            table.add_row(
                _severity_text(incident.severity.value),
                incident.rule,
                _window(incident),
                incident.summary,
                incident.suggested_action,
            )
        console.print(table)

    if report.top_messages:
        messages = Table(title="Top messages", expand=True)
        for column in ("Count", "Level", "Message (normalized)"):
            messages.add_column(column, justify="right" if column == "Count" else "left")
        for row in report.top_messages:
            messages.add_row(str(row.count), row.level, row.message)
        console.print(messages)


def _score_text(score: int) -> Text:
    if score >= 80:
        return Text(str(score), style="bold green")
    if score >= 50:
        return Text(str(score), style="bold yellow")
    return Text(str(score), style="bold red")


def _severity_text(severity: str) -> Text:
    style = {"critical": "bold red", "warn": "yellow", "info": "cyan"}.get(severity, "white")
    return Text(severity, style=style)


def _time_range(report: Report) -> str:
    if report.first_timestamp is None or report.last_timestamp is None:
        return "-"
    fmt = "%Y-%m-%d %H:%M:%S"
    start = report.first_timestamp.strftime(fmt)
    end = report.last_timestamp.strftime(fmt)
    return f"{start} → {end}" if start != end else start


def _window(incident) -> str:
    fmt = "%H:%M:%S"
    if incident.first_timestamp is None:
        return "-"
    start = incident.first_timestamp.strftime(fmt)
    if incident.last_timestamp is None or incident.last_timestamp == incident.first_timestamp:
        return start
    return f"{start}–{incident.last_timestamp.strftime(fmt)}"
