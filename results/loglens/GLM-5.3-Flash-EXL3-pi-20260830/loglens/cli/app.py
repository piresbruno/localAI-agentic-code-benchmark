"""Typer application definition — argument parsing and output formatting only."""

import typer

app = typer.Typer(
    name="loglens",
    help="Normalize application logs, detect anomalies, and build actionable reports.",
    no_args_is_help=True,
)


@app.callback()
def _root() -> None:
    """LogLens: parse logs, detect incidents, and report health."""
