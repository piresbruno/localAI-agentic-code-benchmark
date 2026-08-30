"""``error_rate_spike`` — error-level ratio above threshold in a window."""

from datetime import timedelta
from typing import Any

from loglens.engine.windows import EventWindow
from loglens.models import Incident, Severity
from loglens.rules.base import (
    BaseRule,
    humanize_duration,
    param_duration,
    param_int,
    param_ratio,
    register_rule,
)


@register_rule("error_rate_spike")
class ErrorRateSpikeRule(BaseRule):
    """Fires when a closed window holds ≥ ``min_events`` events whose
    ERROR/CRITICAL share exceeds ``threshold`` (spec default: 10% of ≥ 20
    events in 5 minutes)."""

    name = "error_rate_spike"
    allowed_params = frozenset({"window", "threshold", "min_events"})

    def __init__(self) -> None:
        super().__init__()
        self.window = timedelta(minutes=5)
        self.threshold = 0.10
        self.min_events = 20

    def apply_params(self, params: dict[str, Any]) -> None:
        self.window = param_duration(params, "window", self.window)
        self.threshold = param_ratio(params, "threshold", self.threshold)
        self.min_events = param_int(params, "min_events", self.min_events, minimum=1)

    def window_duration(self) -> timedelta:
        return self.window

    def evaluate(self, window: EventWindow) -> list[Incident]:
        total = len(window)
        if total < self.min_events:
            return []
        errors = window.error_count
        ratio = errors / total
        if ratio <= self.threshold:
            return []
        events = window.events
        severity = Severity.CRITICAL if ratio >= 0.5 else Severity.WARN
        return [
            Incident(
                rule=self.name,
                severity=severity,
                first_timestamp=events[0].timestamp,
                last_timestamp=events[-1].timestamp,
                event_ids=[e.id or "" for e in events],
                summary=(
                    f"Error rate spiked to {ratio:.0%} ({errors}/{total} events) in the "
                    f"{humanize_duration(self.window)} window {window.start:%H:%M:%S}–{window.end:%H:%M:%S}"
                ),
                suggested_action=(
                    "Inspect the failing components in this window and check upstream "
                    "dependencies for outages."
                ),
            )
        ]
