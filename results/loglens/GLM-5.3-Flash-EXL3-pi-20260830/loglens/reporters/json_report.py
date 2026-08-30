"""JSON reporter: the full report as JSON (stdout or file)."""

from loglens.models import Report
from loglens.reporters.base import register_reporter


@register_reporter("json")
def render_json(report: Report, out: object | None = None) -> None:
    """Write the report as pretty-printed JSON."""
    payload = report.model_dump_json(indent=2, exclude_none=True)
    target = out if out is not None else _stdout()
    target.write(payload)
    if not payload.endswith("\n"):
        target.write("\n")


def _stdout() -> object:
    import sys

    return sys.stdout
