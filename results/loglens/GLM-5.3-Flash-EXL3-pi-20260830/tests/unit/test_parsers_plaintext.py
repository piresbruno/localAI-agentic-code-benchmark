"""Unit tests for the plain-text regex parser."""

from datetime import datetime, timezone

from loglens.models import LogLevel, PARSE_ERROR_ATTR
from loglens.parsers.plaintext import PlainTextParser


def parse(line: str, parser: PlainTextParser | None = None):
    return (parser or PlainTextParser()).parse_line(line, source="app.log", line_number=1)


class TestDefaultPatterns:
    def test_spec_example_line(self):
        event = parse("2026-01-15 08:23:01,441 ERROR [worker] Connection refused")
        assert event.level is LogLevel.ERROR
        assert event.logger == "worker"
        assert event.message == "Connection refused"
        assert event.timestamp == datetime(2026, 1, 15, 8, 23, 1, 441000, tzinfo=timezone.utc)

    def test_space_timestamp_without_logger(self):
        event = parse("2026-01-15 08:23:01 INFO Service started")
        assert event.level is LogLevel.INFO
        assert event.logger is None
        assert event.message == "Service started"

    def test_bracketed_timestamp_pattern(self):
        event = parse("[2026-01-15 08:23:01] WARNING: disk almost full")
        assert event.level is LogLevel.WARNING
        assert event.message == "disk almost full"

    def test_dashed_logging_pattern(self):
        event = parse("2026-01-15T08:23:01Z - ERROR - worker - Connection refused")
        assert event.level is LogLevel.ERROR
        assert event.logger == "worker"
        assert event.message == "Connection refused"

    def test_access_log_pattern_derives_level_from_status(self):
        ok = parse('127.0.0.1 - frank [10/Oct/2023:13:55:36 -0700] "GET /api HTTP/1.0" 200 2326')
        warn = parse('127.0.0.1 - frank [10/Oct/2023:13:55:36 -0700] "GET /api HTTP/1.0" 404 2326')
        err = parse('127.0.0.1 - frank [10/Oct/2023:13:55:36 -0700] "GET /api HTTP/1.0" 500 2326')
        assert ok.level is LogLevel.INFO
        assert warn.level is LogLevel.WARNING
        assert err.level is LogLevel.ERROR
        assert warn.message == "GET /api HTTP/1.0"

    def test_access_log_timestamp_converts_to_utc(self):
        event = parse('127.0.0.1 - frank [10/Oct/2023:13:55:36 -0700] "GET /api HTTP/1.0" 200 2326')
        assert event.timestamp == datetime(2023, 10, 10, 20, 55, 36, tzinfo=timezone.utc)


class TestLevelHandling:
    def test_level_alias_warn(self):
        event = parse("2026-01-15 08:23:01 WARN [db] slow query")
        assert event.level is LogLevel.WARNING

    def test_unknown_level_word_marks_parse_error(self):
        event = parse("2026-01-15 08:23:01 PANIC [db] everything is on fire")
        assert event.level is LogLevel.UNKNOWN
        assert "level" in event.attributes[PARSE_ERROR_ATTR]
        assert event.message == "everything is on fire"

    def test_case_insensitive_level(self):
        event = parse("2026-01-15 08:23:01 error [db] down")
        assert event.level is LogLevel.ERROR


class TestMalformedLines:
    def test_non_matching_line_never_dropped(self):
        event = parse("just some text with no structure")
        assert event.level is LogLevel.UNKNOWN
        assert "pattern" in event.attributes[PARSE_ERROR_ATTR]
        assert event.raw == "just some text with no structure"

    def test_empty_line(self):
        event = parse("")
        assert event.level is LogLevel.UNKNOWN


class TestConfigurability:
    def test_extra_pattern_is_tried(self):
        custom = PlainTextParser(extra_patterns=[r"^(?P<ts>\d{10})\|(?P<level>\w+)\|(?P<message>.*)$"])
        event = parse("1768458181|INFO|from custom pipe format", custom)
        assert event.level is LogLevel.INFO
        assert event.message == "from custom pipe format"
        assert event.timestamp is not None

    def test_default_patterns_still_active_with_extras(self):
        custom = PlainTextParser(extra_patterns=[r"^(?P<ts>\d{10})\|(?P<level>\w+)\|(?P<message>.*)$"])
        event = parse("2026-01-15 08:23:01 INFO default still works", custom)
        assert event.level is LogLevel.INFO
