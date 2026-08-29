"""Incident model: one detection produced by a rule."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

Severity = str  # "info" | "warn" | "critical"


class Incident(BaseModel):
    """A detected anomaly. Produced by rules, aggregated in the report."""

    rule: str = Field(description="Name of the rule that produced this incident")
    severity: Severity = Field(description="info|warn|critical")
    first_seen: datetime
    last_seen: datetime
    event_ids: list[int] = Field(default_factory=list)
    summary: str = Field(description="Human-readable description of the anomaly")
    suggested_action: str = Field(description="One-sentence remediation hint from rule metadata")

    @property
    def is_critical(self) -> bool:
        return self.severity == "critical"
