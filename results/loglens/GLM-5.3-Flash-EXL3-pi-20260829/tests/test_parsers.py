"""Parser unit tests: JSON-lines, plain text, auto-detection, malformed input."""

from __future__ import annotations

import json

from loglens.parsers.detect import AutoDetectParser, detect_format
from loglens.parsers.jsonlines import JsonLinesParser, normalize_level
from loglens.parsers.plaintext import PlainTextParser
from loglens.parsers.timestamps import parse_timestamp
from tests.conftest import BASE_TIME, at, json_line, malformed_fixture, text_line

NOW = BASE_TIME


class TestTimestamps:
    def test_iso_with_tz(self):
        from loglens.parsers.timestamps import parse_timestamp

        parsed = parse_timestamp("2026-01-15T08:23:01+00:00")
        assert parsed is not None and parsed.tzinfo is not None

    def test_iso_naive_treated_as_utc(self):
        from loglens.parsers.timestamps import parse_timestamp

        parsed = parse_timestamp("2026-01-15 08:23:01,441")
        assert parsed is not None
        assert parsed.utcoffset().total_seconds() == 0

    def test_unix_seconds(self):
        from loglens.parsers.timestamps import parse_timestamp

        parsed = parse_timestamp(1768460581)
        assert parsed is not None
        assert parsed.year == 2026

    def test_unix_millis(self):
        from loglens.parsers.timestamps import parse_timestamp

        parsed = parse_timestamp(1768460581000)
        assert parsed is not None
        assert parsed.year == 2026
        assert abs((parsed - parse_timestamp(1768460581)).total_seconds()) < 1

    def test_unix_millis_string(self):
        from loglens.parsers.timestamps import parse_timestamp

        assert parse_timestamp("1768460581000") is not None

    def test_garbage_returns_none(self):
        from loglens.parsers.timestamps import parse_timestamp

        assert parse_timestamp("not a time") is None
        assert parse_timestamp(None) is None
        assert parse_timestamp(-5) is None
        assert parse_timestamp(["list"]) is None


class TestNormalizeLevel:
    def test_aliases_map_to_canonical(self):
        assert normalize_level("warn") == "WARNING"
        assert normalize_level("FATAL") == "CRITICAL"
        assert normalize_level("err") == "ERROR"
        assert normalize_level("trace") == "DEBUG"

    def test_unknown_stays_unknown(self):
        assert normalize_level("weird") == "UNKNOWN"
        assert normalize_level(42) == "UNKNOWN"


class TestJsonLinesParser:
    def test_parses_canonical_event(self, clock):
        parser = JsonLinesParser()
        event = parser.parse_line(json_line(at(1), "ERROR", "boom", "db"), "f.log", clock)
        assert event.level == "ERROR"
        assert event.message == "boom"
        assert event.logger == "db"
        assert event.source == "f.log"
        assert event.timestamp == at(1)

    def test_accepts_key_aliases(self, clock):
        parser = JsonLinesParser()
        line = json.dumps({"time": at(2).isoformat(), "severity": "warn", "message": "hi", "name": "web"})
        event = parser.parse_line(line, "f.log", clock)
        assert (event.level, event.message, event.logger) == ("WARNING", "hi", "web")

    def test_extra_keys_land_in_attributes(self, clock):
        parser = JsonLinesParser()
        event = parser.parse_line(json_line(at(1), "INFO", "hi", latency_ms=42), "f.log", clock)
        assert event.attributes["latency_ms"] == 42

    def test_malformed_json_becomes_unknown_never_dropped(self, clock):
        parser = JsonLinesParser()
        event = parser.parse_line("{not json", "f.log", clock)
        assert event.level == "UNKNOWN"
        assert "invalid JSON" in event.attributes["parse_error"]
        assert event.raw == "{not json"

    def test_non_object_json_becomes_unknown(self, clock):
        parser = JsonLinesParser()
        event = parser.parse_line("[1, 2, 3]", "f.log", clock)
        assert event.is_unknown

    def test_missing_timestamp_becomes_unknown(self, clock):
        parser = JsonLinesParser()
        event = parser.parse_line(json.dumps({"level": "INFO", "msg": "x"}), "f.log", clock)
        assert event.is_unknown

    def test_empty_line_becomes_unknown(self, clock):
        parser = JsonLinesParser()
        assert parser.parse_line("", "f.log", clock).is_unknown

    def test_parse_lines_is_lazy_generator(self, clock):
        parser = JsonLinesParser()
        lines = (json_line(at(i / 60.0), "INFO", f"m{i}") for i in range(3))
        events = list(parser.parse_lines(lines, "f.log", clock))
        assert len(events) == 3


class TestPlainTextParser:
    def test_pattern1_bracketed_logger(self, clock):
        parser = PlainTextParser()
        line = "2026-01-15 08:23:01,441 ERROR [worker] Connection refused"
        event = parser.parse_line(line, "f.log", clock)
        assert (event.level, event.logger) == ("ERROR", "worker")
        assert event.message == "Connection refused"
        assert event.timestamp.hour == 8 and event.timestamp.minute == 23

    def test_pattern2_iso_z(self, clock):
        parser = PlainTextParser()
        line = "2026-01-15T08:23:01Z ERROR worker: Connection refused"
        event = parser.parse_line(line, "f.log", clock)
        assert (event.level, event.logger) == ("ERROR", "worker")

    def test_pattern3_bracketed_timestamp(self, clock):
        parser = PlainTextParser()
        line = "[2026-01-15 08:23:01] [ERROR] worker - Connection refused"
        event = parser.parse_line(line, "f.log", clock)
        assert (event.level, event.logger, event.message) == ("ERROR", "worker", "Connection refused")

    def test_at_least_three_patterns_configured(self):
        assert len(PlainTextParser().patterns) >= 3

    def test_unmatched_line_becomes_unknown(self, clock):
        parser = PlainTextParser()
        event = parser.parse_line("hello world, no pattern here", "f.log", clock)
        assert event.is_unknown

    def test_bad_timestamp_in_match_becomes_unknown(self, clock):
        parser = PlainTextParser()
        # Matches the shape but month 13 is invalid.
        event = parser.parse_line("2026-13-15 08:23:01 ERROR [w] nope", "f.log", clock)
        assert event.is_unknown


class TestAutoDetect:
    def test_detects_jsonlines(self):
        lines = [json_line(at(i / 60.0), "INFO", "x") for i in range(10)]
        assert detect_format(lines) == "jsonlines"

    def test_detects_plaintext(self):
        lines = [text_line(at(i / 60.0), "INFO", "x") for i in range(10)]
        assert detect_format(lines) == "plaintext"

    def test_short_mixed_probe_defaults_to_plaintext(self):
        assert detect_format(["{oops", "not json", ""]) == "plaintext"

    def test_stream_json_file(self, clock):
        parser = AutoDetectParser()
        lines = [json_line(at(i / 60.0), "INFO", f"m{i}") for i in range(25)]
        events = list(parser.parse_stream((("f.log", line) for line in lines), clock))
        assert len(events) == 25
        assert all(e.level == "INFO" for e in events)

    def test_stream_short_file_replays_probe(self, clock):
        parser = AutoDetectParser()
        lines = [json_line(at(0), "INFO", "only"), json_line(at(1 / 60.0), "ERROR", "two")]
        events = list(parser.parse_stream((("f.log", line) for line in lines), clock))
        assert len(events) == 2
        assert [e.level for e in events] == ["INFO", "ERROR"]

    def test_stream_multi_source_switch(self, clock):
        parser = AutoDetectParser()
        pairs = [("a.log", json_line(at(0), "INFO", "json-a"))]
        pairs += [("a.log", json_line(at(i / 60.0), "INFO", "json-a")) for i in range(1, 12)]
        pairs += [("b.log", text_line(at(0.5), "ERROR", "text-b"))]
        pairs += [("b.log", text_line(at(i / 60.0 + 0.5), "ERROR", "text-b")) for i in range(1, 12)]
        events = list(parser.parse_stream(pairs, clock))
        assert len(events) == 24
        assert events[0].source == "a.log"
        assert events[-1].source == "b.log"
        assert all(e.level == "INFO" for e in events[:12])
        assert all(e.level == "ERROR" for e in events[12:])


class TestMalformedFixture:
    """Property-style robustness: every malformed fixture line must survive parsing."""

    def test_all_malformed_lines_survive(self, clock):
        fixture = malformed_fixture()
        assert len(fixture) >= 50  # documented fixture, spec §8
        parser = AutoDetectParser()
        events = list(parser.parse_stream((("dirty.log", line) for line in fixture), clock))
        assert len(events) == len(fixture)
        unknown = [e for e in events if e.is_unknown]
        assert unknown, "fixture should contain genuinely unparseable lines"
        assert all("parse_error" in e.attributes for e in unknown)

    def test_valid_json_objects_with_good_timestamps_parse_cleanly(self, clock):
        fixture = malformed_fixture()
        parser = JsonLinesParser()
        good = [
            line for line in fixture
            if (
                _is_json_object(line)
                and parse_timestamp(json.loads(line).get("ts")) is not None
                and json.loads(line).get("msg") is not None
            )
        ]
        assert good, "fixture should contain structurally valid JSON lines"
        parsed = [parser.parse_line(line, "x", clock) for line in good]
        # Structurally valid JSON parses without a *parse-level* error; odd levels
        # are flagged as UNKNOWN but still produce a usable event with message.
        assert all(e.message for e in parsed)
        assert any(not e.is_unknown for e in parsed)


def _is_json_object(line: str) -> bool:
    try:
        return isinstance(json.loads(line), dict)
    except json.JSONDecodeError:
        return False
