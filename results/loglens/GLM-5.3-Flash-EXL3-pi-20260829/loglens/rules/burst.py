"""burst — event rate spike regardless of level."""

from __future__ import annotations

from loglens.models.config import RuleSettings
from loglens.models.event import LogEvent
from loglens.models.incident import Incident
from loglens.rules.base import make_incident, resolved

DEFAULTS = {"window_seconds": 60, "min_events": 50}


class BurstRule:
    """Fires when more than ``min_events`` events land within ``window_seconds``."""

    name = "burst"
    suggested_action = "An event burst means a retry storm, traffic spike, or hot loop — check upstream traffic first."
    window_seconds: int | None = DEFAULTS["window_seconds"]

    def __init__(self, clock=None) -> None:
        self.clock = clock
        self.window_seconds = DEFAULTS["window_seconds"]
        self.min_events = DEFAULTS["min_events"]

    def configure(self, settings: RuleSettings) -> None:
        self.window_seconds = int(resolved(settings.window_seconds, DEFAULTS["window_seconds"]))
        self.min_events = int(resolved(settings.min_events, DEFAULTS["min_events"]))

    def evaluate(self, events: list[LogEvent]) -> list[Incident]:
        if len(events) < self.min_events:
            return []
        # Sliding count over the sorted window; the densest burst is reported once.
        best: list[LogEvent] = []
        window: list[LogEvent] = []
        for event in events:
            window.append(event)
            while window and (event.timestamp - window[0].timestamp).total_seconds() > self.window_seconds:
                window.pop(0)
            if len(window) > len(best):
                best = list(window)
        if len(best) < self.min_events:
            return []
        duration = (best[-1].timestamp - best[0].timestamp).total_seconds()
        return [
            make_incident(
                self,
                "warn",
                best,
                f"{len(best)} events in {duration:.0f}s "
                f"({self.window_seconds}s window, min {self.min_events}) — burst of activity",
            )
        ]
