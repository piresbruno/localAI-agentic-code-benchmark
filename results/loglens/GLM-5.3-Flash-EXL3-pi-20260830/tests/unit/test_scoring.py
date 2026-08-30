"""Tests for the documented health-score formula."""

from loglens.engine.scoring import SEVERITY_WEIGHTS, health_score, incident_penalty, volume_factor
from loglens.models import Incident, Severity


def incident(severity: Severity, affected: int) -> Incident:
    return Incident(
        rule="test",
        severity=severity,
        event_ids=[f"e{i}" for i in range(affected)],
        summary="s",
    )


class TestHealthScore:
    def test_no_incidents_is_perfect(self):
        assert health_score([]) == 100

    def test_single_warn_with_few_events(self):
        # weight 10 × volume 1 + 4/20 → 10 × 1.2 = 12 → 88
        assert health_score([incident(Severity.WARN, 4)]) == 88

    def test_volume_factor_caps_at_five(self):
        assert volume_factor(0) == 1.0
        assert volume_factor(20) == 2.0
        assert volume_factor(200) == 5.0
        assert volume_factor(20) == 1 + 20 / 20

    def test_critical_weights_more_than_warn(self):
        assert SEVERITY_WEIGHTS["critical"] > SEVERITY_WEIGHTS["warn"] > SEVERITY_WEIGHTS["info"]

    def test_many_incidents_floor_at_zero(self):
        heavy = [incident(Severity.CRITICAL, 200) for _ in range(10)]
        assert health_score(heavy) == 0

    def test_penalty_matches_documented_formula(self):
        inc = incident(Severity.CRITICAL, 40)
        expected = 25 * (1 + min(4.0, 40 / 20))
        assert incident_penalty(inc) == expected

    def test_info_incidents_barely_dent_the_score(self):
        assert health_score([incident(Severity.INFO, 1)]) == 97
