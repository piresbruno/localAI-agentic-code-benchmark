"""Tests for burst (positive + negative, injected timestamps)."""

from datetime import timedelta

from loglens.models import RuleConfig, Severity
from loglens.rules.burst import BurstRule

from tests.unit.helpers import BASE, mk, window

MINUTE = timedelta(seconds=60)


class TestPositive:
    def test_fifty_events_in_a_minute_is_a_burst(self):
        rule = BurstRule()
        events = [mk(i * 0.5, message=f"m{i}") for i in range(50)]
        incidents = rule.evaluate(window(events, BASE, MINUTE))
        assert len(incidents) == 1
        incident = incidents[0]
        assert incident.rule == "burst"
        assert incident.severity is Severity.WARN
        assert len(incident.event_ids) == 50
        assert incident.suggested_action

    def test_double_the_threshold_is_critical(self):
        rule = BurstRule()
        events = [mk(i * 0.25, message=f"m{i}") for i in range(100)]
        incidents = rule.evaluate(window(events, BASE, MINUTE))
        assert incidents[0].severity is Severity.CRITICAL

    def test_level_is_irrelevant(self):
        rule = BurstRule()
        events = [mk(i * 0.5, level="DEBUG", message="noise") for i in range(60)]
        assert len(rule.evaluate(window(events, BASE, MINUTE))) == 1


class TestNegative:
    def test_below_threshold_is_silent(self):
        rule = BurstRule()
        events = [mk(i, message=f"m{i}") for i in range(49)]
        assert rule.evaluate(window(events, BASE, MINUTE)) == []

    def test_spread_over_longer_period_is_silent(self):
        rule = BurstRule()
        events = [mk(i * 10, message=f"m{i}") for i in range(60)]  # one per 10s, 10 min
        first_minute = [e for e in events if e.timestamp < BASE + MINUTE]
        assert len(first_minute) == 6
        assert rule.evaluate(window(first_minute, BASE, MINUTE)) == []


class TestConfiguration:
    def test_overrides(self):
        rule = BurstRule()
        rule.configure(RuleConfig(name="burst", params={"min_events": 3, "window": "10s"}))
        events = [mk(i, message="m") for i in range(3)]
        assert len(rule.evaluate(window(events, BASE, timedelta(seconds=10)))) == 1
