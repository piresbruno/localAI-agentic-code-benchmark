"""Rule tests: every built-in rule has a positive AND negative test, fixed clock."""

from __future__ import annotations

from datetime import timedelta

from loglens.models.config import RuleSettings
from loglens.models.event import LogEvent
from loglens.rules.burst import BurstRule
from loglens.rules.error_rate_spike import ErrorRateSpikeRule
from loglens.rules.latency_outlier import LatencyOutlierRule
from loglens.rules.level_gap import LevelGapRule
from loglens.rules.message_template import normalize_message
from loglens.rules.registry import BUILTIN_REGISTRY
from loglens.rules.repeated_error import RepeatedErrorRule
from tests.conftest import BASE_TIME


def make_events(specs: list[tuple[float, str, str, str | None, dict | None]]) -> list[LogEvent]:
    """specs: (minute_offset, level, message, logger, attributes)"""
    events = []
    for i, (offset, level, msg, logger, attrs) in enumerate(specs):
        events.append(
            LogEvent(
                timestamp=BASE_TIME + timedelta(minutes=offset),
                level=level,
                message=msg,
                logger=logger,
                source="t.log",
                attributes=attrs or {},
                event_id=i + 1,
            )
        )
    return events


class TestErrorRateSpike:
    def test_positive_spike_fires_critical(self):
        rule = ErrorRateSpikeRule()
        rule.configure(RuleSettings())
        specs = [(i * 0.1, "ERROR" if i % 10 < 3 else "INFO", f"m{i}", "app", None) for i in range(40)]
        incidents = rule.evaluate(make_events(specs))
        assert len(incidents) == 1
        assert incidents[0].severity == "critical"  # 30% ≥ 2×10% threshold
        assert incidents[0].rule == "error_rate_spike"

    def test_negative_low_error_rate(self):
        rule = ErrorRateSpikeRule()
        rule.configure(RuleSettings())
        # 10% error rate = exactly the threshold (must not fire).
        specs = [(i * 0.1, "ERROR" if i % 10 == 0 else "INFO", f"m{i}", "app", None) for i in range(40)]
        assert rule.evaluate(make_events(specs)) == []

    def test_negative_too_few_events(self):
        rule = ErrorRateSpikeRule()
        rule.configure(RuleSettings())
        # 50% errors but only 10 events (< min_events 20).
        specs = [(i * 0.1, "ERROR" if i % 2 else "INFO", f"m{i}", "app", None) for i in range(10)]
        assert rule.evaluate(make_events(specs)) == []

    def test_config_override_threshold(self):
        rule = ErrorRateSpikeRule()
        rule.configure(RuleSettings(threshold=0.5, min_events=5))
        specs = [(i * 0.1, "ERROR" if i % 10 < 3 else "INFO", f"m{i}", "app", None) for i in range(10)]  # 30% < 50%
        assert rule.evaluate(make_events(specs)) == []

    def test_registered_and_configurable_via_registry(self):
        instances = BUILTIN_REGISTRY.instantiate(
            __import__("loglens.models.config", fromlist=["RuleConfig"]).RuleConfig()
        )
        assert any(isinstance(r, ErrorRateSpikeRule) for r in instances)


class TestRepeatedError:
    def test_positive_repetition_fires(self):
        rule = RepeatedErrorRule()
        rule.configure(RuleSettings())
        specs = [(i * 0.5, "ERROR", "Connection refused to db-1", "db", None) for i in range(6)]
        incidents = rule.evaluate(make_events(specs))
        assert len(incidents) == 1
        assert len(incidents[0].event_ids) == 6

    def test_numbers_are_wildcarded(self):
        rule = RepeatedErrorRule()
        rule.configure(RuleSettings(min_count=3))
        specs = [
            (i * 0.5, "ERROR", f"Connection refused to shard-{i} attempt {i * 7}", "db", None)
            for i in range(4)
        ]
        incidents = rule.evaluate(make_events(specs))
        assert len(incidents) == 1  # all four collapse to one template

    def test_negative_scattered_over_longer_window(self):
        rule = RepeatedErrorRule()
        rule.configure(RuleSettings())
        # 6 errors over 13 minutes: any 10-minute window holds at most 4.
        specs = [(i * 2.6, "ERROR", "Same error", "db", None) for i in range(6)]
        assert rule.evaluate(make_events(specs)) == []

    def test_negative_info_level_ignored(self):
        rule = RepeatedErrorRule()
        rule.configure(RuleSettings())
        specs = [(i * 0.5, "INFO", "Same info message", "app", None) for i in range(10)]
        assert rule.evaluate(make_events(specs)) == []

    def test_min_count_override(self):
        rule = RepeatedErrorRule()
        rule.configure(RuleSettings(min_count=20))
        specs = [(i * 0.5, "ERROR", "boom", "db", None) for i in range(10)]
        assert rule.evaluate(make_events(specs)) == []


class TestLatencyOutlier:
    def test_positive_outliers_fires(self):
        rule = LatencyOutlierRule()
        rule.configure(RuleSettings())
        specs = [(i * 0.1, "INFO", "Request handled", "http", {"latency_ms": 100}) for i in range(20)]
        specs.append((2.5, "INFO", "Request handled", "http", {"latency_ms": 4000}))
        incidents = rule.evaluate(make_events(specs))
        assert len(incidents) == 1
        assert incidents[0].severity == "warn"

    def test_negative_uniform_latency(self):
        rule = LatencyOutlierRule()
        rule.configure(RuleSettings())
        specs = [(i * 0.1, "INFO", "Request handled", "http", {"latency_ms": 100 + i}) for i in range(20)]
        assert rule.evaluate(make_events(specs)) == []

    def test_negative_too_few_samples(self):
        rule = LatencyOutlierRule()
        rule.configure(RuleSettings())
        specs = [(i * 0.1, "INFO", "Request", "http", {"latency_ms": 100 if i < 9 else 9000}) for i in range(9)]
        assert rule.evaluate(make_events(specs)) == []

    def test_non_numeric_attribute_ignored(self):
        rule = LatencyOutlierRule()
        rule.configure(RuleSettings())
        specs = [(i * 0.1, "INFO", "Request", "http", {"latency_ms": "fast"}) for i in range(20)]
        assert rule.evaluate(make_events(specs)) == []

    def test_percentile_math(self):
        from loglens.rules.latency_outlier import percentile

        assert percentile([10], 95) == 10
        assert percentile([10, 20], 50) == 15
        assert percentile(list(range(1, 101)), 95) == 95.05


class TestBurst:
    def test_positive_burst_fires(self):
        rule = BurstRule()
        rule.configure(RuleSettings())
        specs = [(i * 0.5 / 60, "INFO", f"m{i}", "app", None) for i in range(60)]  # 60 events in 30s
        incidents = rule.evaluate(make_events(specs))
        assert len(incidents) == 1
        assert len(incidents[0].event_ids) == 60

    def test_negative_steady_rate(self):
        rule = BurstRule()
        rule.configure(RuleSettings())
        specs = [(i * 2.0 / 60, "INFO", f"m{i}", "app", None) for i in range(60)]  # 2/min → 2 per 60s
        assert rule.evaluate(make_events(specs)) == []

    def test_negative_few_events(self):
        rule = BurstRule()
        rule.configure(RuleSettings())
        specs = [(i * 0.1, "INFO", f"m{i}", "app", None) for i in range(10)]
        assert rule.evaluate(make_events(specs)) == []


class TestLevelGap:
    def test_positive_critical_without_warning_fires(self):
        rule = LevelGapRule()
        rule.configure(RuleSettings())
        specs = [
            (0, "INFO", "processing", "payments", None),
            (1, "CRITICAL", "ledger diverged", "payments", None),
        ]
        incidents = rule.evaluate(make_events(specs))
        assert len(incidents) == 1
        assert incidents[0].severity == "critical"
        assert incidents[0].rule == "level_gap"

    def test_negative_warning_precedes_critical(self):
        rule = LevelGapRule()
        rule.configure(RuleSettings())
        specs = [
            (0, "WARNING", "ledger slow", "payments", None),
            (1, "CRITICAL", "ledger diverged", "payments", None),
        ]
        assert rule.evaluate(make_events(specs)) == []

    def test_negative_critical_from_other_logger(self):
        rule = LevelGapRule()
        rule.configure(RuleSettings())
        specs = [
            (0, "WARNING", "slow", "cache", None),
            (1, "CRITICAL", "boom", "payments", None),
        ]
        # 'payments' never warned → fires; but 'cache' warnings don't mask it.
        incidents = rule.evaluate(make_events(specs))
        assert len(incidents) == 1

    def test_negative_critical_after_warning_same_logger(self):
        rule = LevelGapRule()
        rule.configure(RuleSettings())
        specs = [
            (0, "CRITICAL", "boom", "payments", None),  # fires
            (1, "WARNING", "recovering", "payments", None),
            (2, "CRITICAL", "boom again", "payments", None),  # masked by earlier warning
        ]
        incidents = rule.evaluate(make_events(specs))
        assert len(incidents) == 1


class TestMessageTemplate:
    def test_numbers_collapse(self):
        assert normalize_message("Connection refused to db-1 (attempt 3)") == normalize_message(
            "Connection refused to db-2 (attempt 7)"
        )

    def test_uuids_and_quotes_collapse(self):
        assert normalize_message("user 'bob' id 123e4567-e89b-12d3-a456-426614174000 failed") == normalize_message(
            "user 'alice' id 99999999-9999-9999-9999-999999999999 failed"
        )


class TestRegistry:
    def test_all_five_builtins_registered(self):
        assert BUILTIN_REGISTRY.names() == [
            "burst",
            "error_rate_spike",
            "latency_outlier",
            "level_gap",
            "repeated_error",
        ]

    def test_disabled_rule_not_instantiated(self):
        from loglens.models.config import RuleConfig, RuleSettings

        config = RuleConfig(rules={"burst": RuleSettings(enabled=False)})
        instances = BUILTIN_REGISTRY.instantiate(config)
        assert all(r.name != "burst" for r in instances)

    def test_duplicate_registration_rejected(self):
        from loglens.rules.registry import RuleRegistry

        registry = RuleRegistry()
        registry.register("x", LevelGapRule)
        import pytest

        with pytest.raises(ValueError, match="already registered"):
            registry.register("x", LevelGapRule)
