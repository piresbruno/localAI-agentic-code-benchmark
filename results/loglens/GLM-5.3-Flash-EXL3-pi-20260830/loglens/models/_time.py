"""Timezone helpers shared by the model layer.

All timestamps in LogLens are UTC and timezone-aware. Naive datetimes are
interpreted as UTC (the common case for log files that omit offsets).
"""

from datetime import UTC, datetime


def ensure_utc(value: datetime | None) -> datetime | None:
    """Return *value* as a timezone-aware UTC datetime (or ``None``).

    Naive datetimes are assumed to be UTC; aware datetimes are converted.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
