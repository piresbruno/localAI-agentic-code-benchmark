"""Terminal reporter: rich tables."""

from __future__ import annotations

from rich.console import Console
from rich.table import Table
from rich.text import Text

from loglens.models.report import Report

SEVERITY_STYLES = {"critical": "bold red", "warn": "yellow", "info": "cyan"}


def render_terminal(report: Report, console: Console | None = None) -> str:
    """Render the report as rich tables; returns the captured text."""
    console = console or Console(record=True, width=110)
    console.print()

    summary = Table(title="Summary", show_header=False, title_style="bold")
    summary.add_row("Events", str(report.total_events))
    summary.add_row("Sources", ", ".join(report.sources) or "-")
    if report.time_range.first and report.time_range.last:
        rng = report.time_range
        summary.add_row("Time range", f"{rng.first:%Y-%m-%d %H:%M:%S} → {rng.last:%H:%M:%S} UTC")
    summary.add_row("Unparseable lines", str(report.unknown_events))
    score_style = "green" if report.health_score >= 80 else "yellow" if report.health_score >= 50 else "red"
    summary.add_row("Health score", Text(f"{report.health_score}/100", style=score_style))
    console.print(summary)

    if report.incidents:
        table = Table(title=f"Incidents ({len(report.incidents)})", title_style="bold")
        table.add_column("Severity")
        table.add_column("Rule")
        table.add_column("First seen")
        table.add_column("Summary", overflow="fold")
        for incident in report.incidents:
            table.add_row(
                Text(incident.severity, style=SEVERITY_STYLES.get(incident.severity, "")),
                incident.rule,
                f"{incident.first_seen:%H:%M:%S}",
                incident.summary,
            )
        console.print(table)
    else:
        console.print("[green]No incidents detected.[/green]")

    top = Table(title="Top messages", title_style="bold")
    top.add_column("Count", justify="right")
    top.add_column("Level")
    top.add_column("Message", overflow="fold")
    for entry in report.top_messages:
        top.add_row(str(entry.count), entry.level, entry.message)
    console.print(top)
    return console.export_text()
