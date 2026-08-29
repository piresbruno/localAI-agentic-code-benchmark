"""JSON reporter: serialize the Report model."""

from __future__ import annotations

import json

from loglens.models.report import Report


def render_json(report: Report, indent: int | None = 2) -> str:
    """Render the report as JSON (datetimes as ISO-8601)."""
    return json.dumps(report.model_dump(mode="json"), indent=indent, default=str)
