"""Tests for latency_outlier (positive + negative, injected timestamps)."""

from datetime import timedelta

from loglens.models import RuleConfig, Severity
from loglens.rules.latency_outlier import LatencyOutlierRule, percentile

from tests.unit.helpers import BASE, mk, window

FIVE_MIN = timedelta(minutes=5)


def latency_events(values: list[float], start_offset: float = 0) -> list:
    return [
        mk(start_offset + i, attributes={"latency_ms": value}, message="handled request")
        for i, value in enumerate(values)
    ]


class TestPositive:
    def test_outliers_far_above_p95_are_flagged(self):
        rule = LatencyOutlierRule()
        values = [120.0] * 100 + [4000.0, 4100.0]
        incidents = rule.evaluate(window(latency_events(values), BASE, FIVE_MIN))
        assert len(incidents) == 1
        incident = incidents[0]
        assert incident.rule == "latency_outlier"
        assert incident.severity is Severity.WARN
        assert len(incident.event_ids) == 2
        assert "p95" in incident.summary
        assert incident.suggested_action

    def test_p95_is_interpolated(self):
        assert percentile([10, 20, 30, 40], 0.95) == 38.5
        assert percentile([10, 20], 0.95) == 19.5
        assert percentile([7], 0.95) == 7

    def test_custom_attribute_name(self):
        rule = LatencyOutlierRule()
        rule.configure(RuleConfig(name="latency_outlier", params={"attr": "duration_ms"}))
        events = [
            mk(i, attributes={"duration_ms": v}, message="r")
            for i, v in enumerate([50.0] * 50 + [900.0])
        ]
        assert len(rule.evaluate(window(events, BASE, FIVE_MIN))) == 1


class TestNegative:
    def test_events_without_attribute_are_ignored(self):
        rule = LatencyOutlierRule()
        events = [mk(i, message="plain text line") for i in range(100)]
        assert rule.evaluate(window(events, BASE, FIVE_MIN)) == []

    def test_plain_text_logs_have_no_attributes(self):
        rule = LatencyOutlierRule()
        events = [mk(i, level="ERROR", message="boom") for i in range(30)]
        assert rule.evaluate(window(events, BASE, FIVE_MIN)) == []

    def test_uniform_latencies_have_no_outliers(self):
        rule = LatencyOutlierRule()
        events = latency_events([100.0, 110.0, 105.0, 102.0])
        assert rule.evaluate(window(events, BASE, FIVE_MIN)) == []

    def test_fewer_than_two_values_is_silent(self):
        rule = LatencyOutlierRule()
        events = latency_events([4000.0])
        assert rule.evaluate(window(events, BASE, FIVE_MIN)) == []

    def test_non_numeric_attribute_values_skipped(self):
        rule = LatencyOutlierRule()
        events = [
            mk(0, attributes={"latency_ms": "fast"}, message="r"),
            mk(1, attributes={"latency_ms": True}, message="r"),
            mk(2, attributes={"latency_ms": 120.0}, message="r"),
            mk(3, attributes={"latency_ms": 5000.0}, message="r"),
        ]
        # Only two usable values: p95 = 120*0.05 + 5000*0.95 → threshold huge → no outlier.
        assert rule.evaluate(window(events, BASE, FIVE_MIN)) == []
