"""Tests for repeated_error (positive + negative, injected timestamps)."""

from datetime import timedelta

from loglens.models import RuleConfig, Severity
from loglens.rules.repeated_error import RepeatedErrorRule
from tests.unit.helpers import BASE, mk, window

TEN_MIN = timedelta(minutes=10)


def connection_errors(count: int, start_offset: float = 60) -> list:
    """The same error with varying numbers — one template after normalization."""
    return [
        mk(
            start_offset + i * 40,
            level="ERROR",
            message=f"Connection refused to db-primary:5432 (attempt {i + 1})",
        )
        for i in range(count)
    ]


class TestPositive:
    def test_detects_twelve_repeats_of_one_template(self):
        rule = RepeatedErrorRule()
        events = connection_errors(12)
        incidents = rule.evaluate(window(events, BASE, TEN_MIN))
        assert len(incidents) == 1
        incident = incidents[0]
        assert incident.rule == "repeated_error"
        assert incident.severity is Severity.WARN
        assert "Connection refused to db-primary:N (attempt N)" in incident.summary
        assert "12" in incident.summary
        assert len(incident.event_ids) == 12

    def test_numbers_are_wild_carded_across_messages(self):
        rule = RepeatedErrorRule()
        events = [
            mk(60 + i * 30, level="ERROR", message=f"request {i} failed after {i * 10}ms")
            for i in range(6)
        ]
        incidents = rule.evaluate(window(events, BASE, TEN_MIN))
        assert len(incidents) == 1
        assert "request N failed after Nms" in incidents[0].summary

    def test_distinct_templates_reported_separately(self):
        rule = RepeatedErrorRule()
        events = connection_errors(5) + [
            mk(600 + i * 30, level="ERROR", message=f"disk {i} full") for i in range(5)
        ]
        incidents = rule.evaluate(window(events, BASE, TEN_MIN))
        assert len(incidents) == 2

    def test_thirty_six_repeats_is_critical(self):
        rule = RepeatedErrorRule()
        incidents = rule.evaluate(window(connection_errors(15), BASE, TEN_MIN))
        assert incidents[0].severity is Severity.CRITICAL  # 15 >= 3 * 5


class TestNegative:
    def test_below_min_count_is_silent(self):
        rule = RepeatedErrorRule()
        incidents = rule.evaluate(window(connection_errors(4), BASE, TEN_MIN))
        assert incidents == []

    def test_warnings_do_not_count(self):
        rule = RepeatedErrorRule()
        events = [
            mk(60 + i * 30, level="WARNING", message="Connection refused (attempt 1)")
            for i in range(10)
        ]
        assert rule.evaluate(window(events, BASE, TEN_MIN)) == []

    def test_no_errors_at_all(self):
        rule = RepeatedErrorRule()
        events = [mk(i, message="hello") for i in range(20)]
        assert rule.evaluate(window(events, BASE, TEN_MIN)) == []


class TestConfiguration:
    def test_min_count_override(self):
        rule = RepeatedErrorRule()
        rule.configure(RuleConfig(name="repeated_error", params={"min_count": 3}))
        incidents = rule.evaluate(window(connection_errors(3), BASE, TEN_MIN))
        assert len(incidents) == 1

    def test_unknown_param_rejected(self):
        rule = RepeatedErrorRule()
        try:
            rule.configure(RuleConfig(name="repeated_error", params={"min_count": 3, "nope": 1}))
        except ValueError as exc:
            assert "nope" in str(exc)
        else:
            raise AssertionError("expected ValueError")
