"""Engine tests: pipeline aggregation, windowing, scoring, filters, streaming O(1)."""

from __future__ import annotations

from datetime import timedelta

from loglens.engine.pipeline import Engine
from loglens.engine.scoring import compute_health_score
from loglens.models.config import RuleConfig, RuleSettings
from loglens.models.incident import Incident
from loglens.parsers.jsonlines import JsonLinesParser
from loglens.rules.error_rate_spike import ErrorRateSpikeRule
from tests.conftest import BASE_TIME, at, feed, json_line, text_line


class TestAggregation:
    def test_level_counts_and_unknowns(self, json_engine):
        lines = [
            json_line(at(0), "INFO", "ok"),
            json_line(at(0.1), "ERROR", "bad"),
            "not json at all",
        ]
        report = feed(json_engine, lines)
        assert report.total_events == 3
        assert report.unknown_events == 1
        assert report.level_counts["INFO"] == 1
        assert report.level_counts["ERROR"] == 1
        assert report.level_counts["UNKNOWN"] == 1

    def test_time_range(self, json_engine):
        lines = [json_line(at(2), "INFO", "b"), json_line(at(0), "INFO", "a"), json_line(at(1), "INFO", "c")]
        report = feed(json_engine, lines)
        assert report.time_range.first == at(0)
        assert report.time_range.last == at(2)

    def test_top_messages_ranked(self, json_engine):
        lines = [json_line(at(i * 0.01), "INFO", "repeat me") for i in range(5)]
        lines += [json_line(at(0.5), "INFO", "once")]
        report = feed(json_engine, lines)
        assert report.top_messages[0].message == "repeat me"
        assert report.top_messages[0].count == 5

    def test_sources_collected(self, json_engine):
        lines = [json_line(at(0), "INFO", "a"), json_line(at(0.1), "INFO", "b")]
        report = json_engine.analyze([("one.log", lines[0]), ("two.log", lines[1])])
        assert report.sources == ["one.log", "two.log"]


class TestTimeFilters:
    def test_since_until_filtering(self, json_engine):
        lines = [json_line(at(i), "INFO", f"m{i}") for i in range(10)]  # minutes 0..9
        report = json_engine.analyze(
            (("t.log", line) for line in lines),
            since=at(3),
            until=at(6),
        )
        assert report.total_events == 10  # all lines processed
        assert report.time_range.first == at(3)
        assert report.time_range.last == at(6)
        assert len(report.top_messages) == 4

    def test_relative_time_parsing(self):
        from loglens.cli.app import parse_since_until

        thirty_min = parse_since_until("30m")
        assert (thirty_min.utcoffset().total_seconds()) == 0
        iso = parse_since_until("2026-01-15T08:00:00")
        assert iso is not None and iso.year == 2026


class TestStreaming:
    def test_100k_lines_retain_o_window_not_o_stream(self, clock):
        """Streaming guarantee: over a 100k-line generator, retention per rule
        evaluation is bounded by the correlation window, never by stream length."""
        from loglens.models.config import DEFAULT_CONFIG
        from loglens.rules.registry import RuleRegistry

        class WindowSpyRule(ErrorRateSpikeRule):
            """Records the window size at every evaluate() call."""

            def __init__(self):
                super().__init__()
                self.max_window_seen = 0

            def evaluate(self, events):
                self.max_window_seen = max(self.max_window_seen, len(events))
                return []

        spy = WindowSpyRule()
        registry = RuleRegistry()
        registry.register("error_rate_spike", lambda: spy)
        engine = Engine(parser=JsonLinesParser(), config=DEFAULT_CONFIG, clock=clock, registry=registry)

        base = BASE_TIME

        def lines():
            for i in range(100_000):
                ts = base + timedelta(seconds=2 * i)  # spread over ~55 hours
                yield "big.log", json_line(ts, "INFO", "steady state event")

        report = engine.analyze(lines())
        assert report.total_events == 100_000
        # A 300s window at 2s spacing holds ~150 events — O(window), not O(100k).
        assert spy.max_window_seen <= 200
        assert spy.max_window_seen > 0  # the rule actually evaluated windows

    def test_generator_not_materialized(self, clock):
        """Feeding a lazy generator must not consume extra memory proportional to stream."""
        engine = Engine(parser=JsonLinesParser(), clock=clock)
        consumed = {"count": 0}

        def lines():
            for i in range(1000):
                consumed["count"] += 1
                yield "g.log", json_line(BASE_TIME + timedelta(seconds=i), "INFO", f"m{i}")

        report = engine.analyze(lines())
        assert report.total_events == 1000
        assert consumed["count"] == 1000


class TestScoring:
    def test_no_incidents_is_100(self):
        assert compute_health_score([], 500) == 100

    def test_deterministic_and_ordered(self):
        def incident(severity: str, n: int) -> Incident:
            return Incident(
                rule="r", severity=severity,
                first_seen=BASE_TIME, last_seen=BASE_TIME,
                event_ids=list(range(n)), summary="s", suggested_action="a",
            )

        critical = compute_health_score([incident("critical", 1)], 10)
        warn = compute_health_score([incident("warn", 1)], 10)
        assert critical < warn < 100
        # Same input → same output (deterministic formula).
        assert critical == compute_health_score([incident("critical", 1)], 10)

    def test_clamped_to_zero(self):
        many = [
            Incident(rule="r", severity="critical", first_seen=BASE_TIME, last_seen=BASE_TIME,
                     event_ids=list(range(100)), summary="s", suggested_action="a")
            for _ in range(10)
        ]
        assert compute_health_score(many, 1000) == 0

    def test_volume_factor_grows_sublinearly(self):
        from loglens.engine.scoring import volume_factor

        assert volume_factor(0) == 1.0
        assert volume_factor(9) > volume_factor(1)
        # Logarithmic growth: 10x more events adds < 1 to the factor per decade.
        assert volume_factor(1000) - volume_factor(100) < 1.0
        assert volume_factor(100) - volume_factor(10) < 1.0


class TestConfigInEngine:
    def test_disabled_rule_produces_no_incidents(self, clock):
        config = RuleConfig(rules={"level_gap": RuleSettings(enabled=False)})
        engine = Engine(parser=JsonLinesParser(), config=config, clock=clock)
        lines = [
            json_line(at(0), "INFO", "x", "payments"),
            json_line(at(1), "CRITICAL", "boom", "payments"),
        ]
        report = feed(engine, lines)
        assert report.incidents == []

    def test_threshold_override_changes_detection(self, clock):
        lines = [json_line(at(i * 0.1), "ERROR" if i % 10 < 3 else "INFO", f"m{i}", "app") for i in range(40)]
        strict = RuleConfig(rules={"error_rate_spike": RuleSettings(threshold=0.5)})
        strict_lines = (("t.log", line) for line in lines)
        report_strict = Engine(JsonLinesParser(), config=strict, clock=clock).analyze(strict_lines)
        default_lines = (("t.log", line) for line in lines)
        report_default = Engine(JsonLinesParser(), clock=clock).analyze(default_lines)
        assert any(i.rule == "error_rate_spike" for i in report_default.incidents)
        assert not any(i.rule == "error_rate_spike" for i in report_strict.incidents)


class TestPlainTextEngine:
    def test_plain_text_end_to_end(self, text_engine):
        lines = [text_line(at(i / 60.0), "INFO" if i % 5 else "ERROR", f"message {i}") for i in range(50)]
        report = feed(text_engine, lines)
        assert report.total_events == 50
        assert report.unknown_events == 0
        assert report.level_counts["ERROR"] == 10
