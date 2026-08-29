"""Normalized event model shared by every stage of the pipeline."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LogEvent(BaseModel):
    """A single normalized log line.

    Unparseable lines become events with level ``UNKNOWN`` and a ``parse_error``
    attribute — they are never silently dropped.
    """

    model_config = ConfigDict(validate_assignment=True)

    timestamp: datetime = Field(description="UTC, tz-aware; epoch for unparseable lines")
    level: str = Field(default="UNKNOWN", description="DEBUG|INFO|WARNING|ERROR|CRITICAL|UNKNOWN")
    message: str = ""
    logger: str | None = None
    source: str = "stdin"
    attributes: dict[str, object] = Field(default_factory=dict)
    raw: str = ""
    event_id: int = Field(default=0, description="Sequence number assigned by the engine")

    @property
    def is_error(self) -> bool:
        return self.level in ("ERROR", "CRITICAL")

    @property
    def is_unknown(self) -> bool:
        return self.level == "UNKNOWN"

    @staticmethod
    def unknown(source: str, raw: str, reason: str, clock: Callable[[], datetime]) -> LogEvent:
        """Build a placeholder event for a line that could not be parsed.

        ``clock`` is the injected time provider; the event timestamp is set to
        the current time so the line still participates in ordering.
        """
        return LogEvent(
            timestamp=clock(),
            level="UNKNOWN",
            message=raw.strip()[:200],
            source=source,
            attributes={"parse_error": reason},
            raw=raw,
        )
