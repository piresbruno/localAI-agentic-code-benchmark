"""Report models aggregating pipeline results."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from loglens.models._time import ensure_utc
from loglens.models.incident import Incident


class MessageCount(BaseModel):
    """One row of the report's "top messages" table."""

    message: str
    count: int
    level: str = "INFO"


class ErrorRatePoint(BaseModel):
    """Error ratio for one time bucket; feeds the HTML sparkline."""

    bucket_start: datetime
    total: int
    errors: int
    ratio: float

    @field_validator("bucket_start")
    @classmethod
    def _bucket_utc(cls, value: datetime) -> datetime:
        ensured = ensure_utc(value)
        assert ensured is not None
        return ensured


class Report(BaseModel):
    """Aggregated result of one engine run over the (optionally filtered) input."""

    generated_at: datetime
    inputs: list[str] = Field(default_factory=list)
    events_total: int = 0
    parse_errors: int = 0
    level_counts: dict[str, int] = Field(default_factory=dict)
    first_timestamp: datetime | None = None
    last_timestamp: datetime | None = None
    health_score: int = 100
    incidents: list[Incident] = Field(default_factory=list)
    top_messages: list[MessageCount] = Field(default_factory=list)
    error_rate_series: list[ErrorRatePoint] = Field(default_factory=list)

    @field_validator("generated_at", "first_timestamp", "last_timestamp")
    @classmethod
    def _timestamps_utc(cls, value: datetime | None) -> datetime | None:
        return ensure_utc(value)

    @property
    def critical_count(self) -> int:
        """Number of critical-severity incidents."""
        return sum(1 for incident in self.incidents if incident.severity.value == "critical")
