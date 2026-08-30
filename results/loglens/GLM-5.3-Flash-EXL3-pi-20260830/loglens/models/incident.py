"""Incidents produced by rules."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator

from loglens.models._time import ensure_utc


class Severity(StrEnum):
    """Incident severity used for scoring and rendering."""

    INFO = "info"
    WARN = "warn"
    CRITICAL = "critical"


class Incident(BaseModel):
    """An anomaly detected by a rule, with human-readable context."""

    rule: str
    severity: Severity
    first_timestamp: datetime | None = None
    last_timestamp: datetime | None = None
    event_ids: list[str] = Field(default_factory=list)
    summary: str
    suggested_action: str = ""

    @field_validator("first_timestamp", "last_timestamp")
    @classmethod
    def _timestamps_utc(cls, value: datetime | None) -> datetime | None:
        return ensure_utc(value)
