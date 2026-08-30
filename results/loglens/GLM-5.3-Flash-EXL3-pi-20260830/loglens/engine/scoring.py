"""Deterministic health-score formula.

``health = max(0, round(100 - Σ penalty_i))`` where each incident contributes
``severity_weight × volume_factor`` with
``volume_factor = 1 + min(4, affected_events / 20)``.
"""

from collections.abc import Sequence
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    from loglens.models import Incident

SEVERITY_WEIGHTS = {"critical": 25.0, "warn": 10.0, "info": 3.0}

#: Affected-event count at which the volume factor stops growing.
VOLUME_CAP_EVENTS = 20.0
VOLUME_CAP_FACTOR = 4.0


def volume_factor(affected_events: int) -> float:
    """Volume multiplier for one incident (1.0 → 5.0)."""
    return 1.0 + min(VOLUME_CAP_FACTOR, affected_events / VOLUME_CAP_EVENTS)


def incident_penalty(incident: "Incident") -> float:
    """Penalty points contributed by a single incident."""
    weight = SEVERITY_WEIGHTS[incident.severity.value]
    return weight * volume_factor(len(incident.event_ids))


def health_score(incidents: Sequence["Incident"]) -> int:
    """Compute the 0–100 report score; no incidents → 100."""
    penalty = sum(incident_penalty(incident) for incident in incidents)
    return max(0, round(100 - penalty))
