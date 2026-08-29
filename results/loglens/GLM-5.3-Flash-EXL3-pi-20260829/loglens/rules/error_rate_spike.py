"""error_rate_spike — error-level ratio above threshold in a sliding window."""

from __future__ import annotations

from loglens.models.config import RuleSettings
from loglens.models.event import LogEvent
from loglens.models.incident import Incident
from loglens.rules.base import make_incident, resolved

DEFAULTS = {"window_seconds": 300, "threshold": 0.10, "min_events": 20}


class ErrorRateSpikeRule:
    """Fires when the error-level ratio in a window exceeds the threshold
    AND the window contains at least ``min_events`` events."""

    name = "error_rate_spike"
    suggested_action = "Inspect recent deploys and upstream services; error rates this high usually mean a new fault."
    window_seconds: int | None = DEFAULTS["window_seconds"]  # engine slices tumbling windows of this size

    def __init__(self, clock=None) -> None:
        self.clock = clock
        self.window_seconds = DEFAULTS["window_seconds"]
        self.threshold = DEFAULTS["threshold"]
        self.min_events = DEFAULTS["min_events"]

    def configure(self, settings: RuleSettings) -> None:
        self.window_seconds = int(resolved(settings.window_seconds, DEFAULTS["window_seconds"]))
        self.threshold = float(resolved(settings.threshold, DEFAULTS["threshold"]))
        self.min_events = int(resolved(settings.min_events, DEFAULTS["min_events"]))

    def evaluate(self, events: list[LogEvent]) -> list[Incident]:
        if not events:
            return []
        window_start = events[0].timestamp
        window_events = [
            e
            for e in events
            if (e.timestamp - window_start).total_seconds() < self.window_seconds
        ]
        error_events = [e for e in window_events if e.is_error]
        if len(window_events) < self.min_events:
            return []
        rate = len(error_events) / len(window_events)
        if rate <= self.threshold:
            return []
        return [
            make_incident(
                self,
                "critical" if rate >= 2 * self.threshold else "warn",
                error_events or window_events,
                f"{rate:.0%} error rate ({len(error_events)}/{len(window_events)} events) in a "
                f"{self.window_seconds // 60}m window starting {window_start:%H:%M:%S} "
                f"(threshold {self.threshold:.0%})",
            )
        ]
