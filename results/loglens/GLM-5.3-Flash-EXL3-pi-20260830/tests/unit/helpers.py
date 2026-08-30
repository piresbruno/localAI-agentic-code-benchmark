"""Shared helpers for rule and engine tests: event/window factories."""

from datetime import UTC, datetime, timedelta

from loglens.engine.windows import EventWindow
from loglens.models import LogEvent, LogLevel

BASE = datetime(2026, 1, 15, 8, 0, 0, tzinfo=UTC)


def mk(
    offset_seconds: float = 0,
    *,
    level: LogLevel = LogLevel.INFO,
    message: str = "ok",
    logger: str | None = "app",
    attributes: dict | None = None,
    source: str = "test.log",
    line: int = 0,
) -> LogEvent:
    """Build a LogEvent at BASE + offset_seconds."""
    return LogEvent(
        timestamp=BASE + timedelta(seconds=offset_seconds),
        level=level,
        message=message,
        logger=logger,
        attributes=attributes or {},
        source=source,
        line=line,
        raw=message,
    )


def window(events: list[LogEvent], start: datetime, duration: timedelta) -> EventWindow:
    """Materialize a closed EventWindow for direct rule.evaluate calls."""
    built = EventWindow(start, start + duration)
    for event in events:
        built.add(event)
    return built
