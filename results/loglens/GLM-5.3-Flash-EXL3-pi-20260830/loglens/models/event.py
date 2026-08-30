"""The normalized event model every parser produces."""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator

from loglens.models._time import ensure_utc

#: Attribute key used to record why a line could not be parsed. Events with
#: this attribute are counted in reports and are never silently dropped.
PARSE_ERROR_ATTR = "parse_error"

#: Canonical level names accepted in configs and reports.
LEVEL_NAMES = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL", "UNKNOWN")

#: Common aliases found in real-world logs, mapped to canonical levels.
LEVEL_ALIASES: dict[str, str] = {
    "TRACE": "DEBUG",
    "WARN": "WARNING",
    "ERR": "ERROR",
    "ERROR": "ERROR",
    "SEVERE": "ERROR",
    "FATAL": "CRITICAL",
    "CRITICAL": "CRITICAL",
    "NOTICE": "INFO",
    "INFORMATION": "INFO",
    "INFO": "INFO",
    "DEBUG": "DEBUG",
    "UNKNOWN": "UNKNOWN",
}


class LogLevel(str, Enum):
    """Severity levels of a normalized event.

    ``UNKNOWN`` marks lines that could not be parsed; such events carry a
    ``parse_error`` entry in :attr:`LogEvent.attributes`.
    """

    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def parse(cls, raw: str) -> "LogLevel":
        """Map a raw level string (any case, common aliases) to a LogLevel."""
        return LogLevel(LEVEL_ALIASES.get(raw.strip().upper(), "UNKNOWN"))


class LogEvent(BaseModel):
    """One normalized log line.

    ``timestamp`` is UTC and timezone-aware; lines without a parseable
    timestamp keep ``timestamp=None`` and are counted but excluded from
    time-windowed analysis.
    """

    id: str | None = None
    timestamp: datetime | None = None
    level: LogLevel = LogLevel.INFO
    message: str = ""
    logger: str | None = None
    source: str = ""
    line: int = 0
    attributes: dict[str, Any] = Field(default_factory=dict)
    raw: str = ""

    @field_validator("timestamp")
    @classmethod
    def _timestamp_utc(cls, value: datetime | None) -> datetime | None:
        return ensure_utc(value)

    @property
    def is_parse_error(self) -> bool:
        """True when this event stands in for a line that failed to parse."""
        return self.level is LogLevel.UNKNOWN or PARSE_ERROR_ATTR in self.attributes

    def mark_parse_error(self, reason: str) -> None:
        """Demote the event to UNKNOWN and record *reason* in its attributes."""
        self.level = LogLevel.UNKNOWN
        self.attributes[PARSE_ERROR_ATTR] = reason
