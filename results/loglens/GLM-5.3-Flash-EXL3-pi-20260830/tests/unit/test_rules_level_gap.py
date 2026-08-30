"""Tests for level_gap — escalation without warning (event-driven rule)."""

from loglens.models import RuleConfig, Severity
from loglens.rules.level_gap import LevelGapRule
from tests.unit.helpers import mk, window


def feed(rule: LevelGapRule, events: list) -> list:
    """Feed events one at a time, as the engine does for event-driven rules."""
    incidents = []
    for event in events:
        incidents.extend(rule.evaluate(window([event], event.timestamp, timedelta_seconds(0))))
    return incidents


def timedelta_seconds(seconds: float):
    from datetime import timedelta

    return timedelta(seconds=seconds)


class TestPositive:
    def test_critical_without_preceding_warning_is_reported(self):
        rule = LevelGapRule()
        events = [
            mk(0, level="INFO", message="svc up", logger="payments"),
            mk(60, level="CRITICAL", message="processor deadlock", logger="payments"),
        ]
        incidents = feed(rule, events)
        assert len(incidents) == 1
        incident = incidents[0]
        assert incident.rule == "level_gap"
        assert incident.severity is Severity.WARN
        assert "payments" in incident.summary
        assert "processor deadlock" in incident.summary
        assert incident.suggested_action

    def test_per_logger_independence(self):
        rule = LevelGapRule()
        events = [
            mk(0, level="WARNING", message="slow", logger="api"),
            mk(60, level="CRITICAL", message="down", logger="payments"),
        ]
        incidents = feed(rule, events)
        assert len(incidents) == 1
        assert "payments" in incidents[0].summary

    def test_events_without_logger_are_grouped_together(self):
        rule = LevelGapRule()
        events = [
            mk(0, level="CRITICAL", message="no logger", logger=None),
        ]
        assert len(feed(rule, events)) == 1


class TestNegative:
    def test_warning_preceding_critical_is_silent(self):
        rule = LevelGapRule()
        events = [
            mk(0, level="WARNING", message="queue backing up", logger="payments"),
            mk(60, level="CRITICAL", message="processor deadlock", logger="payments"),
        ]
        assert feed(rule, events) == []

    def test_no_repeat_until_a_warning_arrives(self):
        rule = LevelGapRule()
        events = [
            mk(0, level="CRITICAL", message="first", logger="payments"),
            mk(60, level="CRITICAL", message="second", logger="payments"),
            mk(120, level="WARNING", message="recovering", logger="payments"),
            mk(180, level="CRITICAL", message="third", logger="payments"),
        ]
        incidents = feed(rule, events)
        # First CRITICAL reported; WARNING then observed; third CRITICAL has a
        # preceding WARNING → silent.
        assert len(incidents) == 1
        assert incidents[0].summary.startswith("Logger 'payments'")


class TestConfiguration:
    def test_rule_takes_no_parameters(self):
        rule = LevelGapRule()
        try:
            rule.configure(RuleConfig(name="level_gap", params={"window": "5m"}))
        except ValueError:
            pass
        else:
            raise AssertionError("expected ValueError")

    def test_windowless(self):
        rule = LevelGapRule()
        assert rule.window_duration() is None
