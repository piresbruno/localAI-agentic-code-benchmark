"""Report models: aggregated analysis output shared by all reporters."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from loglens.models.incident import Incident


class TopMessage(BaseModel):
    message: str
    count: int
    level: str


class TimeRange(BaseModel):
    first: datetime | None = None
    last: datetime | None = None


class ErrorRatePoint(BaseModel):
    """One bucket of the error-rate time series used for the sparkline."""

    bucket_start: datetime
    total: int
    errors: int

    @property
    def rate(self) -> float:
        return self.errors / self.total if self.total else 0.0


class Report(BaseModel):
    """Complete analysis result for one report run."""

    generated_at: datetime
    sources: list[str] = Field(default_factory=list)
    total_events: int = 0
    unknown_events: int = 0
    level_counts: dict[str, int] = Field(default_factory=dict)
    time_range: TimeRange = Field(default_factory=TimeRange)
    health_score: int = 100
    incidents: list[Incident] = Field(default_factory=list)
    error_rate_series: list[ErrorRatePoint] = Field(default_factory=list)
    top_messages: list[TopMessage] = Field(default_factory=list)

    @property
    def has_critical(self) -> bool:
        return any(i.is_critical for i in self.incidents)
