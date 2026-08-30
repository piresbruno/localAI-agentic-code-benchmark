"""Tests for error_rate_spike (positive + negative, injected timestamps)."""

from datetime import timedelta

from loglens.models import RuleConfig, Severity
from loglens.rules.error_rate_spike import ErrorRateSpikeRule
from tests.unit.helpers import BASE, mk, window

FIVE_MIN = timedelta(minutes=5)


def spike_events(total: int = 40, errors: int = 12, start_offset: float = 1200) -> list:
    events = []
    for i in range(total):
        level = "ERROR" if i < errors else "INFO"
        events.append(mk(start_offset + i * 7, level=level, message=f"event {i}"))
    return events


class TestPositive:
    def test_detects_thirty_percent_error_window(self):
        rule = ErrorRateSpikeRule()
        incidents = rule.evaluate(window(spike_events(), BASE + timedelta(minutes=20), FIVE_MIN))
        assert len(incidents) == 1
        incident = incidents[0]
        assert incident.rule == "error_rate_spike"
        assert incident.severity is Severity.WARN
        assert "30%" in incident.summary
        assert len(incident.event_ids) == 40
        assert incident.suggested_action

    def test_sixty_percent_is_critical(self):
        rule = ErrorRateSpikeRule()
        incidents = rule.evaluate(window(spike_events(errors=25), BASE, FIVE_MIN))
        assert incidents[0].severity is Severity.CRITICAL

    def test_first_and_last_timestamps_from_window_events(self):
        rule = ErrorRateSpikeRule()
        events = spike_events()
        incidents = rule.evaluate(window(events, BASE + timedelta(minutes=20), FIVE_MIN))
        assert incidents[0].first_timestamp == events[0].timestamp
        assert incidents[0].last_timestamp == events[-1].timestamp


class TestNegative:
    def test_below_min_events_is_silent(self):
        rule = ErrorRateSpikeRule()
        few_all_errors = [mk(1200 + i, level="ERROR") for i in range(10)]
        assert rule.evaluate(window(few_all_errors, BASE + timedelta(minutes=20), FIVE_MIN)) == []

    def test_below_threshold_is_silent(self):
        rule = ErrorRateSpikeRule()
        events = spike_events(total=100, errors=5)  # 5%
        assert rule.evaluate(window(events, BASE, FIVE_MIN)) == []

    def test_exactly_at_threshold_is_not_above(self):
        rule = ErrorRateSpikeRule()
        events = spike_events(total=100, errors=10)  # exactly 10%
        assert rule.evaluate(window(events, BASE, FIVE_MIN)) == []


class TestConfiguration:
    def test_params_override_defaults(self):
        rule = ErrorRateSpikeRule()
        rule.configure(
            RuleConfig(name="error_rate_spike", params={"threshold": 0.5, "min_events": 5})
        )
        assert rule.threshold == 0.5
        assert rule.min_events == 5
        events = spike_events(total=10, errors=2)  # 20% > 10% but < 50%, ≥ 5 events
        assert rule.evaluate(window(events, BASE, FIVE_MIN)) == []

    def test_unknown_param_rejected(self):
        rule = ErrorRateSpikeRule()
        try:
            rule.configure(RuleConfig(name="error_rate_spike", params={"bogus": 1}))
        except ValueError as exc:
            assert "bogus" in str(exc)
        else:
            raise AssertionError("expected ValueError")

    def test_bad_threshold_rejected(self):
        rule = ErrorRateSpikeRule()
        try:
            rule.configure(RuleConfig(name="error_rate_spike", params={"threshold": "often"}))
        except ValueError:
            pass
        else:
            raise AssertionError("expected ValueError")

    def test_window_param(self):
        rule = ErrorRateSpikeRule()
        rule.configure(RuleConfig(name="error_rate_spike", params={"window": "2m"}))
        assert rule.window_duration() == timedelta(minutes=2)
