"""Timestamp parsing helpers shared by parsers.

Accepts ISO-8601 (with/without timezone; naive treated as UTC) and unix
seconds/millis. Returns tz-aware UTC datetimes or None.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime

_UNIX_SECONDS_MAX = 10**11  # ~year 5138 in seconds; 10^11 in millis ≈ 1973
_ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}")


def parse_timestamp(value: object) -> datetime | None:
    """Parse a timestamp value into a tz-aware UTC datetime, or None.

    Handles: datetime objects, ISO-8601 strings ("2026-01-15T08:23:01,441",
    with/without tz), unix seconds (int/float or numeric string) and unix millis.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return _as_utc(value)
    if not isinstance(value, str | int | float):
        return None

    if isinstance(value, int | float):
        return _from_unix(float(value))
    text = value.strip()

    if _ISO_RE.match(text):
        try:
            normalized = text.replace(" ", "T", 1).replace(",", ".") if "," in text else text.replace(" ", "T", 1)
            parsed = datetime.fromisoformat(normalized)
            return _as_utc(parsed)
        except ValueError:
            return None
    try:
        return _from_unix(float(text))
    except ValueError:
        return None


def _from_unix(value: float) -> datetime | None:
    if value < 0:
        return None
    if value >= _UNIX_SECONDS_MAX:  # milliseconds
        value /= 1000.0
    try:
        return datetime.fromtimestamp(value, tz=UTC)
    except (OverflowError, OSError):
        return None


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def ensure_utc(clock_value: datetime) -> datetime:
    """Normalize an injected clock reading to tz-aware UTC."""
    return _as_utc(clock_value)


__all__ = ["parse_timestamp", "ensure_utc"]
