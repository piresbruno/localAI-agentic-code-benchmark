"""Health score: deterministic penalty formula, documented in the README.

score = 100 − min(100, Σ over incidents of  severity_penalty × volume_factor)

- severity_penalty: critical = 25, warn = 10, info = 3
- volume_factor: 1 + log10(number of affected events + 1) — larger incidents weigh more
- Rounded to an integer, clamped to 0..100.
"""

from __future__ import annotations

import math

from loglens.models.incident import Incident

SEVERITY_PENALTY = {"critical": 25, "warn": 10, "info": 3}


def volume_factor(event_count: int) -> float:
    """Larger incidents weigh more, with diminishing (logarithmic) growth."""
    return 1.0 + math.log10(event_count + 1)


def compute_health_score(incidents: list[Incident], total_events: int) -> int:
    """Deterministic health score 0–100 for a report."""
    penalty = 0.0
    for incident in incidents:
        penalty += SEVERITY_PENALTY.get(incident.severity, 3) * volume_factor(len(incident.event_ids))
    return round(max(0.0, min(100.0, 100.0 - penalty)))
