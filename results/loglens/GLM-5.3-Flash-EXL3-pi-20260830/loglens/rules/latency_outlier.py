"""``latency_outlier`` — attribute values far above the window's p95."""

from datetime import timedelta
from typing import Any

from loglens.engine.windows import EventWindow
from loglens.models import Incident, Severity
from loglens.rules.base import (
    BaseRule,
    param_duration,
    param_number,
    param_str,
    register_rule,
)


@register_rule("latency_outlier")
class LatencyOutlierRule(BaseRule):
    """Fires when a numeric attribute (default ``latency_ms``) exceeds
    ``p95 × multiplier`` within a closed window. Only events that carry the
    attribute participate — in practice JSON logs (spec: "JSON logs only")."""

    name = "latency_outlier"
    allowed_params = frozenset({"attr", "multiplier", "window"})

    def __init__(self) -> None:
        super().__init__()
        self.attr = "latency_ms"
        self.multiplier = 5.0
        self.window = timedelta(minutes=5)

    def apply_params(self, params: dict[str, Any]) -> None:
        self.attr = param_str(params, "attr", self.attr)
        self.multiplier = param_number(params, "multiplier", self.multiplier, minimum=1.0)
        self.window = param_duration(params, "window", self.window)

    def window_duration(self) -> timedelta:
        return self.window

    def evaluate(self, window: EventWindow) -> list[Incident]:
        measured = [
            (event, float(event.attributes[self.attr]))
            for event in window.events
            if isinstance(event.attributes.get(self.attr), (int, float))
            and not isinstance(event.attributes.get(self.attr), bool)
        ]
        if len(measured) < 2:
            return []
        values = sorted(value for _, value in measured)
        p95 = percentile(values, 0.95)
        threshold = p95 * self.multiplier
        outliers = [(event, value) for event, value in measured if value > threshold]
        if not outliers:
            return []
        worst_events = [event for event, _ in outliers]
        peak = max(value for _, value in outliers)
        return [
            Incident(
                rule=self.name,
                severity=Severity.WARN,
                first_timestamp=worst_events[0].timestamp,
                last_timestamp=worst_events[-1].timestamp,
                event_ids=[event.id or "" for event in worst_events],
                summary=(
                    f"{len(outliers)} '{self.attr}' outlier(s) above "
                    f"{threshold:.0f}ms (p95={p95:.0f}ms × {self.multiplier:g}); peak {peak:.0f}ms"
                ),
                suggested_action=(
                    "Profile the slow path behind attribute "
                    f"'{self.attr}' and check for resource saturation."
                ),
            )
        ]


def percentile(sorted_values: list[float], q: float) -> float:
    """Linear-interpolated percentile of an ascending list."""
    if not sorted_values:
        raise ValueError("percentile of empty list")
    if len(sorted_values) == 1:
        return sorted_values[0]
    position = q * (len(sorted_values) - 1)
    lower = int(position)
    upper = min(lower + 1, len(sorted_values) - 1)
    fraction = position - lower
    return sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * fraction
