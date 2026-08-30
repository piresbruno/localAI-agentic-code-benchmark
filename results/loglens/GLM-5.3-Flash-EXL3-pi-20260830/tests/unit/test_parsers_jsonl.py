"""Unit tests for the JSON-lines parser."""

from datetime import datetime, timezone

from loglens.models import LogLevel, PARSE_ERROR_ATTR
from loglens.parsers.jsonl import JsonLinesParser

CANONICAL_LINE = '{"ts": "2026-01-15T08:23:01Z", "level": "ERROR", "msg": "boom", "logger": "worker"}'


def parse(parser: JsonLinesParser, line: str, *, source: str = "test.log", line_number: int = 1):
    return parser.parse_line(line, source=source, line_number=line_number)


class TestHappyPath:
    def test_parses_canonical_keys(self):
        event = parse(JsonLinesParser(), CANONICAL_LINE)
        assert event.level is LogLevel.ERROR
        assert event.message == "boom"
        assert event.logger == "worker"
        assert event.timestamp == datetime(2026, 1, 15, 8, 23, 1, tzinfo=timezone.utc)
        assert event.source == "test.log"
        assert event.raw == CANONICAL_LINE

    def test_key_aliases(self):
        event = parse(
            JsonLinesParser(),
            '{"timestamp": "2026-01-15T08:23:01Z", "severity": "warn", "message": "hi", "name": "api"}',
        )
        assert event.level is LogLevel.WARNING
        assert event.message == "hi"
        assert event.logger == "api"

    def test_extra_keys_become_attributes(self):
        event = parse(
            JsonLinesParser(),
            '{"ts": "2026-01-15T08:23:01Z", "level": "INFO", "msg": "req", "latency_ms": 118, "request_id": "abc"}',
        )
        assert event.attributes["latency_ms"] == 118
        assert event.attributes["request_id"] == "abc"

    def test_nested_attributes_dict_is_merged(self):
        event = parse(
            JsonLinesParser(),
            '{"ts": "2026-01-15T08:23:01Z", "msg": "req", "attributes": {"latency_ms": 42}}',
        )
        assert event.attributes["latency_ms"] == 42


class TestTimestamps:
    def test_iso_with_offset_is_converted_to_utc(self):
        event = parse(JsonLinesParser(), '{"ts": "2026-01-15T10:23:01+02:00", "msg": "x"}')
        assert event.timestamp == datetime(2026, 1, 15, 8, 23, 1, tzinfo=timezone.utc)

    def test_naive_iso_is_assumed_utc(self):
        event = parse(JsonLinesParser(), '{"ts": "2026-01-15 08:23:01", "msg": "x"}')
        assert event.timestamp == datetime(2026, 1, 15, 8, 23, 1, tzinfo=timezone.utc)

    def test_unix_seconds(self):
        event = parse(JsonLinesParser(), '{"ts": 1768458181, "msg": "x"}')
        assert event.timestamp == datetime.fromtimestamp(1768458181, tz=timezone.utc)

    def test_unix_millis(self):
        event = parse(JsonLinesParser(), '{"ts": 1768458181000, "msg": "x"}')
        assert event.timestamp == datetime.fromtimestamp(1768458181, tz=timezone.utc)

    def test_numeric_string_unix(self):
        event = parse(JsonLinesParser(), '{"ts": "1768458181", "msg": "x"}')
        assert event.timestamp is not None

    def test_bad_timestamp_marks_parse_error(self):
        event = parse(JsonLinesParser(), '{"ts": "not-a-time", "msg": "x"}')
        assert event.level is LogLevel.UNKNOWN
        assert "timestamp" in event.attributes[PARSE_ERROR_ATTR]


class TestMalformedLines:
    def test_invalid_json_never_dropped(self):
        event = parse(JsonLinesParser(), "{oops not json")
        assert event.level is LogLevel.UNKNOWN
        assert event.is_parse_error
        assert event.raw == "{oops not json"

    def test_non_object_json(self):
        event = parse(JsonLinesParser(), '["a", "b"]')
        assert event.level is LogLevel.UNKNOWN
        assert "not an object" in event.attributes[PARSE_ERROR_ATTR]

    def test_missing_message_marks_parse_error(self):
        event = parse(JsonLinesParser(), '{"ts": "2026-01-15T08:23:01Z", "level": "INFO"}')
        assert event.level is LogLevel.UNKNOWN
        assert "message" in event.attributes[PARSE_ERROR_ATTR]

    def test_unknown_level_string_marks_parse_error(self):
        event = parse(JsonLinesParser(), '{"ts": "2026-01-15T08:23:01Z", "level": "SHOUTING", "msg": "x"}')
        assert event.level is LogLevel.UNKNOWN
        assert "level" in event.attributes[PARSE_ERROR_ATTR]

    def test_empty_line_is_parse_error(self):
        event = parse(JsonLinesParser(), "")
        assert event.level is LogLevel.UNKNOWN
        assert event.is_parse_error

    def test_line_number_and_source_recorded(self):
        event = parse(JsonLinesParser(), "{bad", source="a.log", line_number=17)
        assert event.line == 17
        assert event.source == "a.log"
