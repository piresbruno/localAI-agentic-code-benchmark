"""Tumbling correlation windows fed to rules."""

from datetime import UTC, datetime, timedelta

from loglens.models import LogLevel

_EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


def aligned_start(ts: datetime, duration: timedelta) -> datetime:
    """Floor *ts* to the start of the tumbling window of *duration* it falls in."""
    remainder = (ts - _EPOCH) % duration
    return ts - remainder


class EventWindow:
    """A bounded, time-boxed batch of events handed to ``Rule.evaluate``."""

    __slots__ = ("end", "events", "start")

    def __init__(self, start: datetime, end: datetime) -> None:
        self.start = start
        self.end = end
        self.events: list = []

    def add(self, event) -> None:
        self.events.append(event)

    @property
    def error_count(self) -> int:
        """Number of ERROR-or-worse events in the window."""
        return sum(1 for e in self.events if e.level in (LogLevel.ERROR, LogLevel.CRITICAL))

    def __len__(self) -> int:
        return len(self.events)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"EventWindow(start={self.start!r}, end={self.end!r}, events={len(self.events)})"
