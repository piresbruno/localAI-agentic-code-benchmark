"""Property-style parser tests over the documented malformed-line fixture.

Fixture: ``tests/data/malformed.log`` (see its README for the contract):
1. parsing never raises; 2. every line yields exactly one event; 3. anything
unparseable becomes UNKNOWN with a parse_error attribute; 4. timestamps are
UTC-aware or absent — never naive.
"""

from datetime import datetime, timezone
from pathlib import Path

import pytest

from loglens.models import LogLevel, PARSE_ERROR_ATTR
from loglens.parsers.jsonl import JsonLinesParser
from loglens.parsers.plaintext import PlainTextParser

FIXTURE = Path(__file__).parent.parent / "data" / "malformed.log"

JSON_PARSER = JsonLinesParser()
TEXT_PARSER = PlainTextParser()


def fixture_lines() -> list[str]:
    return FIXTURE.read_text(encoding="utf-8").split("\n")


def test_fixture_has_at_least_fifty_lines():
    assert len(fixture_lines()) >= 50


@pytest.mark.parametrize("parser", [JSON_PARSER, TEXT_PARSER], ids=["jsonl", "text"])
class TestMalformedLineProperties:
    def test_every_line_parses_without_raising(self, parser):
        for number, line in enumerate(fixture_lines(), start=1):
            event = parser.parse_line(line, source="malformed.log", line_number=number)
            assert event is not None, f"line {number} produced nothing"

    def test_no_line_is_dropped(self, parser):
        total = len(fixture_lines())
        events = [
            parser.parse_line(line, source="f", line_number=n)
            for n, line in enumerate(fixture_lines(), start=1)
        ]
        assert len(events) == total

    def test_unknown_events_carry_parse_error_attribute(self, parser):
        for number, line in enumerate(fixture_lines(), start=1):
            event = parser.parse_line(line, source="f", line_number=number)
            if event.level is LogLevel.UNKNOWN:
                assert PARSE_ERROR_ATTR in event.attributes, f"line {number} lacks reason"
                assert event.attributes[PARSE_ERROR_ATTR]
            else:
                assert event.level in LogLevel

    def test_timestamps_are_utc_aware_or_absent(self, parser):
        for number, line in enumerate(fixture_lines(), start=1):
            event = parser.parse_line(line, source="f", line_number=number)
            if event.timestamp is not None:
                assert event.timestamp.tzinfo is timezone.utc, f"line {number} naive timestamp"

    def test_round_trip_through_utc_instant(self, parser):
        for number, line in enumerate(fixture_lines(), start=1):
            event = parser.parse_line(line, source="f", line_number=number)
            if event.timestamp is not None:
                assert isinstance(event.timestamp, datetime)


def test_engine_digests_the_whole_fixture_without_loss():
    from loglens.engine.engine import Engine

    lines = fixture_lines()
    report = Engine().run(
        (
            JSON_PARSER.parse_line(line, source="mixed", line_number=n)
            for n, line in enumerate(lines, start=1)
        ),
        inputs=["mixed"],
    )
    assert report.events_total == len(lines)
    assert report.parse_errors > 0
    assert report.level_counts.get("UNKNOWN", 0) == report.parse_errors
