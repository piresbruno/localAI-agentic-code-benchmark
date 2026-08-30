"""Tests for --since/--until parsing and TimeFilter behavior."""

from datetime import UTC, datetime, timedelta

import pytest

from loglens.engine.filters import TimeFilter, parse_time_filter, parse_time_value

FIXED_NOW = datetime(2026, 1, 15, 12, 0, 0, tzinfo=UTC)


def fake_clock() -> datetime:
    return FIXED_NOW


class TestParseTimeValue:
    def test_relative_minutes(self):
        assert parse_time_value("30m", fake_clock) == FIXED_NOW - timedelta(minutes=30)

    def test_relative_seconds_hours_days(self):
        assert parse_time_value("45s", fake_clock) == FIXED_NOW - timedelta(seconds=45)
        assert parse_time_value("2h", fake_clock) == FIXED_NOW - timedelta(hours=2)
        assert parse_time_value("1d", fake_clock) == FIXED_NOW - timedelta(days=1)

    def test_absolute_iso(self):
        assert parse_time_value("2026-01-15T08:00:00Z", fake_clock) == datetime(
            2026, 1, 15, 8, 0, 0, tzinfo=UTC
        )

    def test_invalid_value_raises_value_error(self):
        with pytest.raises(ValueError, match="invalid time"):
            parse_time_value("yesterday-ish", fake_clock)


class TestParseTimeFilter:
    def test_none_inputs_give_no_filter(self):
        assert parse_time_filter(None, None, fake_clock) is None

    def test_both_bounds(self):
        time_filter = parse_time_filter("30m", "2026-01-15T12:00:00Z", fake_clock)
        assert time_filter is not None
        assert time_filter.since == FIXED_NOW - timedelta(minutes=30)
        assert time_filter.until == FIXED_NOW

    def test_since_after_until_rejected(self):
        with pytest.raises(ValueError, match="since"):
            parse_time_filter("2026-01-15T12:00:00Z", "2026-01-15T11:00:00Z", fake_clock)


class TestTimeFilter:
    def test_event_without_timestamp_never_matches(self):
        from loglens.models import LogEvent

        time_filter = TimeFilter(since=FIXED_NOW)
        assert not time_filter.matches(LogEvent(timestamp=None))

    def test_bounds_are_inclusive(self):
        time_filter = TimeFilter(since=FIXED_NOW, until=FIXED_NOW)
        event_at_edge = _event_at(FIXED_NOW)
        assert time_filter.matches(event_at_edge)

    def test_outside_bounds_rejected(self):
        time_filter = TimeFilter(since=FIXED_NOW - timedelta(minutes=5), until=FIXED_NOW)
        assert not time_filter.matches(_event_at(FIXED_NOW - timedelta(minutes=6)))
        assert not time_filter.matches(_event_at(FIXED_NOW + timedelta(seconds=1)))


def _event_at(ts: datetime):
    from loglens.models import LogEvent

    return LogEvent(timestamp=ts, message="x")
