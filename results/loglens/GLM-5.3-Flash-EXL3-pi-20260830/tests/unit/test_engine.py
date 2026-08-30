"""Engine pipeline tests: stats, filtering, windows, streaming O(1)."""

from datetime import datetime, timedelta, timezone

from loglens.engine.engine import Engine
from loglens.engine.filters import parse_time_filter
from loglens.models import LogEvent, LogLevel, Severity

from tests.unit.helpers import BASE, mk


def fixed_clock() -> datetime:
    return BASE + timedelta(hours=2)


class TestReportStats:
    def test_counts_levels_parse_errors_and_time_range(self):
        engine = Engine(clock=fixed_clock)
        events = [
            mk(0, level="INFO", message="a"),
            mk(1, level="ERROR", message="b"),
            mk(2, level="WARNING", message="c"),
            LogEvent(timestamp=None, level=LogLevel.UNKNOWN, attributes={"parse_error": "bad line"}, raw="garbage"),
        ]
        report = engine.run(events, inputs=["test.log"])
        assert report.events_total == 4
        assert report.level_counts.get("ERROR") == 1
        assert report.parse_errors == 1
        assert report.first_timestamp == BASE
        assert report.last_timestamp == BASE + timedelta(seconds=2)
        assert report.inputs == ["test.log"]
        assert report.generated_at == fixed_clock()

    def test_event_ids_are_sequential(self):
        engine = Engine(clock=fixed_clock)
        report = engine.run([mk(i, message=f"m{i}") for i in range(5)])
        assert report.events_total == 5  # ids live on the consumed events
        # Re-run to verify counter resets deterministically.
        report2 = engine.run([mk(i, message=f"m{i}") for i in range(3)])
        assert report2.events_total == 3

    def test_top_messages_normalizes_numbers_and_ranks(self):
        engine = Engine(clock=fixed_clock)
        events = [mk(i % 60, message=f"attempt {i} failed") for i in range(30)]
        events += [mk(i, message="startup complete") for i in range(3)]
        report = engine.run(events)
        top = report.top_messages
        assert top[0].message == "attempt N failed"
        assert top[0].count == 30
        assert any(m.message == "startup complete" and m.count == 3 for m in top)

    def test_top_messages_limit(self):
        engine = Engine(clock=fixed_clock, top_messages=2)
        events = [mk(i, message=f"unique message {chr(ord('a') + i)}") for i in range(5)]
        report = engine.run(events)
        assert len(report.top_messages) == 2

    def test_error_rate_series_buckets(self):
        engine = Engine(clock=fixed_clock)
        # Two 5-minute buckets: first with errors, second clean.
        events = [mk(i, level="ERROR" if i % 2 else "INFO") for i in range(10)]
        events += [mk(600 + i, level="INFO") for i in range(10)]
        report = engine.run(events)
        assert len(report.error_rate_series) == 2
        first, second = report.error_rate_series
        assert first.total == 10 and first.errors == 5 and first.ratio == 0.5
        assert second.total == 10 and second.errors == 0 and second.ratio == 0.0


class TestTimeFiltering:
    def test_since_excludes_older_events(self):
        engine = Engine(clock=fixed_clock)
        engine.time_filter = parse_time_filter("30m", None, fixed_clock)
        # since = 09:30; old event at 07:00 is out, new event at 09:31 is in.
        events = [mk(-3600, message="old"), mk(5520, message="new")]
        report = engine.run(events)
        assert report.events_total == 1
        assert report.top_messages[0].message == "new"

    def test_filter_active_excludes_timestampless_events(self):
        engine = Engine(clock=fixed_clock, time_filter=parse_time_filter("30m", None, fixed_clock))
        report = engine.run([LogEvent(timestamp=None, level=LogLevel.UNKNOWN, raw="??")])
        assert report.events_total == 0

    def test_no_filter_keeps_timestampless_events(self):
        engine = Engine(clock=fixed_clock)
        unknown = LogEvent(timestamp=None, level=LogLevel.UNKNOWN, attributes={"parse_error": "bad"}, raw="??")
        report = engine.run([unknown])
        assert report.events_total == 1
        assert report.parse_errors == 1
        assert report.level_counts.get(LogLevel.UNKNOWN.value) == 1


class TestIncidentsFlow:
    def test_engine_detects_planted_error_rate_spike(self):
        engine = Engine(clock=fixed_clock)
        events = [mk(1200 + i, level="ERROR" if i < 12 else "INFO") for i in range(40)]
        report = engine.run(events)
        assert any(i.rule == "error_rate_spike" for i in report.incidents)
        assert report.health_score < 100

    def test_incidents_sorted_by_time_then_rule(self):
        engine = Engine(clock=fixed_clock)
        events = [mk(1200 + i, level="ERROR" if i < 12 else "INFO") for i in range(40)]
        events += [mk(100, level="CRITICAL", message="early critical", logger="payments")]
        report = engine.run(events)
        timestamps = [i.first_timestamp for i in report.incidents]
        assert timestamps == sorted(timestamps, key=lambda t: t or datetime.max.replace(tzinfo=timezone.utc))

    def test_default_rules_are_the_five_builtins(self):
        engine = Engine(clock=fixed_clock)
        assert [r.name for r in engine.rules] == [
            "burst",
            "error_rate_spike",
            "latency_outlier",
            "level_gap",
            "repeated_error",
        ]


class TestStreamingO1:
    def test_hundred_k_events_retain_o1(self):
        """100k events across ~28h: held high-water stays tiny vs processed."""
        engine = Engine(clock=fixed_clock)
        total = 100_000

        def events():
            for i in range(total):
                # 1 event/second for ~27.8 hours; mostly INFO noise.
                level = LogLevel.ERROR if i % 1000 == 0 else LogLevel.INFO
                yield mk(i, level=level, message=f"line {i % 50}")

        report = engine.run(events(), inputs=["stream"])
        stats = engine.stats
        assert stats["processed"] == total
        assert stats["held"] < 1_000  # only the open windows are retained
        assert report.events_total == total
