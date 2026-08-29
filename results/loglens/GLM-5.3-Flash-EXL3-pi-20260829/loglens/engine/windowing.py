"""Correlation windowing: tumbling windows for streaming rule evaluation.

Window boundaries are anchored at the first event's timestamp, so planted
scenarios stay intact regardless of wall-clock time, and each rule keeps at
most one window of events in memory (streaming, O(window) retention).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from loglens.models.event import LogEvent

_EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


class WindowBuffer:
    """Accumulates events for one rule's current tumbling window and flushes
    it to ``rule.evaluate`` when the window rolls over."""

    def __init__(self, rule) -> None:  # Rule protocol instance
        self.rule = rule
        self.window_seconds: int = getattr(rule, "window_seconds", 0) or 0
        self.events: list[LogEvent] = []
        self._end: datetime | None = None

    def push(self, event: LogEvent) -> list:
        """Add an event; returns incidents if this push closed a window."""
        incidents: list = []
        if self.window_seconds <= 0:
            self.events.append(event)
            return incidents
        if self._end is None:
            self._end = event.timestamp + timedelta(seconds=self.window_seconds)
        while event.timestamp >= self._end:
            incidents.extend(self._roll())
        self.events.append(event)
        return incidents

    def flush(self) -> list:
        """Evaluate and clear the final (possibly partial) window."""
        incidents = list(self.rule.evaluate(self.events))
        self.events = []
        self._end = None
        return incidents

    def _roll(self) -> list:
        incidents = list(self.rule.evaluate(self.events))
        self.events = []
        self._end = (self._end or _EPOCH) + timedelta(seconds=self.window_seconds)
        return incidents

    @property
    def held_event_count(self) -> int:
        """Events currently retained (used by the streaming O(1) test)."""
        return len(self.events)
