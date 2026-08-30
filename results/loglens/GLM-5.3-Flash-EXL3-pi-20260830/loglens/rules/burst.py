"""``burst`` — raw event-rate spikes regardless of level."""

from datetime import timedelta
from typing import Any

from loglens.engine.windows import EventWindow
from loglens.models import Incident, Severity
from loglens.rules.base import BaseRule, param_duration, param_int, register_rule


@register_rule("burst")
class BurstRule(BaseRule):
    """Fires when a closed window holds ≥ ``min_events`` events (defaults:
    50 events in a 60-second window), whatever their level."""

    name = "burst"
    allowed_params = frozenset({"min_events", "window"})

    def __init__(self) -> None:
        super().__init__()
        self.min_events = 50
        self.window = timedelta(seconds=60)

    def apply_params(self, params: dict[str, Any]) -> None:
        self.min_events = param_int(params, "min_events", self.min_events, minimum=1)
        self.window = param_duration(params, "window", self.window)

    def window_duration(self) -> timedelta:
        return self.window

    def evaluate(self, window: EventWindow) -> list[Incident]:
        total = len(window)
        if total < self.min_events:
            return []
        severity = Severity.CRITICAL if total >= 2 * self.min_events else Severity.WARN
        events = window.events
        return [
            Incident(
                rule=self.name,
                severity=severity,
                first_timestamp=events[0].timestamp,
                last_timestamp=events[-1].timestamp,
                event_ids=[event.id or "" for event in events],
                summary=(
                    f"Event burst: {total} events within "
                    f"{int(self.window.total_seconds())}s "
                    f"({total / max(self.window.total_seconds(), 1):.1f}/s)"
                ),
                suggested_action=(
                    "Identify the producer flooding the log and apply rate limiting "
                    "or sampling at the source."
                ),
            )
        ]
