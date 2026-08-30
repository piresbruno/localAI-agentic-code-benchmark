"""Unit tests for the model layer (UTC normalization, parse-error convention)."""

from datetime import UTC, datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from loglens.models import (
    PARSE_ERROR_ATTR,
    Incident,
    LogEvent,
    LogLevel,
    Report,
    RuleConfig,
    Severity,
    ensure_utc,
)


class TestLogLevel:
    def test_parse_maps_common_aliases(self):
        assert LogLevel.parse("warn") is LogLevel.WARNING
        assert LogLevel.parse("FATAL") is LogLevel.CRITICAL
        assert LogLevel.parse("err") is LogLevel.ERROR
        assert LogLevel.parse("notice") is LogLevel.INFO
        assert LogLevel.parse("trace") is LogLevel.DEBUG

    def test_parse_unknown_level_falls_back_to_unknown(self):
        assert LogLevel.parse("bogus") is LogLevel.UNKNOWN
        assert LogLevel.parse("") is LogLevel.UNKNOWN

    def test_level_values_are_canonical_strings(self):
        assert LogLevel.ERROR.value == "ERROR"
        assert LogLevel.UNKNOWN.value == "UNKNOWN"


class TestLogEvent:
    def test_naive_timestamp_is_interpreted_as_utc(self):
        event = LogEvent(timestamp=datetime(2026, 1, 15, 8, 0, 0))
        assert event.timestamp is not None
        assert event.timestamp.tzinfo is UTC

    def test_aware_timestamp_is_converted_to_utc(self):
        ts = datetime(2026, 1, 15, 9, 30, 0, tzinfo=timezone(timedelta(hours=2)))
        event = LogEvent(timestamp=ts)
        assert event.timestamp is not None
        assert event.timestamp.hour == 7
        assert event.timestamp.tzinfo is UTC

    def test_timestamp_may_be_missing_for_unparseable_lines(self):
        event = LogEvent(level=LogLevel.UNKNOWN, raw="garbage")
        assert event.timestamp is None

    def test_mark_parse_error_sets_unknown_level_and_attribute(self):
        event = LogEvent(level=LogLevel.INFO, message="half parsed")
        event.mark_parse_error("missing message key")
        assert event.level is LogLevel.UNKNOWN
        assert event.attributes[PARSE_ERROR_ATTR] == "missing message key"
        assert event.is_parse_error

    def test_is_parse_error_true_for_unknown_level(self):
        event = LogEvent(level=LogLevel.UNKNOWN)
        assert event.is_parse_error

    def test_defaults_are_sensible(self):
        event = LogEvent()
        assert event.level is LogLevel.INFO
        assert event.attributes == {}
        assert event.id is None
        assert event.logger is None


class TestIncident:
    def test_severity_values_match_spec(self):
        assert Severity.INFO.value == "info"
        assert Severity.WARN.value == "warn"
        assert Severity.CRITICAL.value == "critical"

    def test_incident_timestamps_are_normalized_to_utc(self):
        ts = datetime(2026, 1, 15, 8, 0, 0, tzinfo=timezone(timedelta(hours=-5)))
        incident = Incident(
            rule="burst",
            severity=Severity.WARN,
            first_timestamp=ts,
            last_timestamp=ts,
            event_ids=["e1", "e2"],
            summary="rate spike",
            suggested_action="throttle producers",
        )
        assert incident.first_timestamp is not None
        assert incident.first_timestamp.hour == 13

    def test_incident_requires_summary(self):
        with pytest.raises(ValidationError):
            Incident(rule="burst", severity=Severity.WARN)


class TestReport:
    def test_defaults(self):
        report = Report(generated_at=datetime(2026, 1, 15, 9, 0, 0))
        assert report.events_total == 0
        assert report.health_score == 100
        assert report.incidents == []
        assert report.critical_count == 0

    def test_critical_count_counts_only_critical(self):
        report = Report(
            generated_at=datetime(2026, 1, 15, 9, 0, 0),
            incidents=[
                Incident(rule="a", severity=Severity.CRITICAL, summary="s"),
                Incident(rule="b", severity=Severity.WARN, summary="s"),
                Incident(rule="c", severity=Severity.CRITICAL, summary="s"),
            ],
        )
        assert report.critical_count == 2


class TestRuleConfig:
    def test_defaults(self):
        config = RuleConfig(name="burst")
        assert config.enabled is True
        assert config.params == {}

    def test_params_hold_raw_values(self):
        config = RuleConfig(name="burst", enabled=False, params={"min_events": 10})
        assert config.params["min_events"] == 10


class TestEnsureUtc:
    def test_none_passes_through(self):
        assert ensure_utc(None) is None

    def test_naive_becomes_utc(self):
        result = ensure_utc(datetime(2026, 1, 1))
        assert result is not None
        assert result.tzinfo is UTC
