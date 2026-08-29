"""latency_outlier — attribute value above p95 × multiplier (JSON logs only)."""

from __future__ import annotations

from loglens.models.config import RuleSettings
from loglens.models.event import LogEvent
from loglens.models.incident import Incident
from loglens.rules.base import make_incident, resolved

DEFAULTS = {"attribute": "latency_ms", "multiplier": 5.0, "min_samples": 10}
DEFAULTS_WINDOW_SECONDS = 600  # p95 baseline over the last 10 minutes


def percentile(sorted_values: list[float], pct: float) -> float:
    """Linear-interpolated percentile of an already-sorted list."""
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    rank = (len(sorted_values) - 1) * (pct / 100.0)
    low = int(rank)
    high = min(low + 1, len(sorted_values) - 1)
    fraction = rank - low
    return sorted_values[low] * (1 - fraction) + sorted_values[high] * fraction


class LatencyOutlierRule:
    """Fires when a numeric attribute exceeds p95 × multiplier."""

    name = "latency_outlier"
    suggested_action = "Latency outliers point to cold caches, lock contention, or a slow upstream — trace the slowest requests."
    window_seconds: int | None = DEFAULTS_WINDOW_SECONDS

    def __init__(self, clock=None) -> None:
        self.clock = clock
        self.attribute = DEFAULTS["attribute"]
        self.multiplier = DEFAULTS["multiplier"]
        self.min_samples = DEFAULTS["min_samples"]

    def configure(self, settings: RuleSettings) -> None:
        self.attribute = str(resolved(settings.attribute, DEFAULTS["attribute"]))
        self.multiplier = float(resolved(settings.multiplier, DEFAULTS["multiplier"]))
        self.min_samples = int(resolved(settings.min_events, DEFAULTS["min_samples"]))

    def evaluate(self, events: list[LogEvent]) -> list[Incident]:
        samples: list[tuple[float, LogEvent]] = []
        for event in events:
            value = event.attributes.get(self.attribute)
            if isinstance(value, int | float) and value >= 0:
                samples.append((float(value), event))
        if len(samples) < self.min_samples:
            return []

        values = sorted(v for v, _ in samples)
        p95 = percentile(values, 95)
        cutoff = p95 * self.multiplier
        outliers = [event for value, event in samples if value > cutoff]
        if not outliers:
            return []
        worst = max(outliers, key=lambda e: float(e.attributes[self.attribute]))
        return [
            make_incident(
                self,
                "warn",
                outliers,
                f"{len(outliers)} latency outliers above p95×{self.multiplier:g} "
                f"(p95={p95:g}ms, worst={float(worst.attributes[self.attribute]):g}ms in '{worst.message[:60]}')",
            )
        ]
