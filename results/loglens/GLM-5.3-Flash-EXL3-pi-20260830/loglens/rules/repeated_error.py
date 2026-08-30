"""``repeated_error`` — the same normalized message repeating."""

from collections import defaultdict
from datetime import timedelta
from typing import Any

from loglens.engine.windows import EventWindow
from loglens.models import Incident, LogLevel, Severity
from loglens.rules.base import (
    BaseRule,
    humanize_duration,
    normalize_message,
    param_duration,
    param_int,
    register_rule,
)


@register_rule("repeated_error")
class RepeatedErrorRule(BaseRule):
    """Fires when one error-message template repeats ≥ ``min_count`` times
    inside a closed ``window`` (defaults: 5 times in 10 minutes). Message
    templates wild-card numbers, so ``attempt 3`` / ``attempt 4`` count as
    the same message."""

    name = "repeated_error"
    allowed_params = frozenset({"min_count", "window"})

    def __init__(self) -> None:
        super().__init__()
        self.min_count = 5
        self.window = timedelta(minutes=10)

    def apply_params(self, params: dict[str, Any]) -> None:
        self.min_count = param_int(params, "min_count", self.min_count, minimum=2)
        self.window = param_duration(params, "window", self.window)

    def window_duration(self) -> timedelta:
        return self.window

    def evaluate(self, window: EventWindow) -> list[Incident]:
        groups: dict[str, list] = defaultdict(list)
        for event in window.events:
            if event.level not in (LogLevel.ERROR, LogLevel.CRITICAL):
                continue
            groups[normalize_message(event.message)].append(event)

        incidents: list[Incident] = []
        for template, events in sorted(groups.items()):
            if len(events) < self.min_count:
                continue
            severity = Severity.CRITICAL if len(events) >= 3 * self.min_count else Severity.WARN
            incidents.append(
                Incident(
                    rule=self.name,
                    severity=severity,
                    first_timestamp=events[0].timestamp,
                    last_timestamp=events[-1].timestamp,
                    event_ids=[e.id or "" for e in events],
                    summary=(
                        f"Error '{template}' repeated {len(events)}× within "
                        f"{humanize_duration(self.window)}"
                    ),
                    suggested_action=(
                        "Check the failing dependency for outages and consider adding "
                        "retries with backoff."
                    ),
                )
            )
        return incidents
