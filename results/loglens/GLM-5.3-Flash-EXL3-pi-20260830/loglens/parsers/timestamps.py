"""Timestamp parsing shared by parsers: ISO-8601 and unix seconds/millis."""

from datetime import datetime, timezone

_UNIX_MILLIS_THRESHOLD = 1e11  # 1e11 seconds is year ~5138; logs use millis long before.


def _from_unix(number: float) -> datetime | None:
    """Convert unix seconds (or milliseconds) to an aware UTC datetime."""
    try:
        if number >= _UNIX_MILLIS_THRESHOLD:
            number = number / 1000.0
        return datetime.fromtimestamp(number, tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        return None


def parse_timestamp(value: object) -> datetime | None:
    """Parse a timestamp value into an aware UTC datetime, or ``None``.

    Accepts ISO-8601 strings (with or without timezone; naive means UTC) and
    unix seconds/millis as numbers or digit strings.
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return _from_unix(float(value))
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    if _is_numeric(text):
        return _from_unix(float(text))
    return _parse_iso(text)


def _is_numeric(text: str) -> bool:
    try:
        float(text)
    except ValueError:
        return False
    return True


def _parse_iso(text: str) -> datetime | None:
    normalized = text.replace(",", ".")
    if len(normalized) > 10 and normalized[10] == " ":
        normalized = normalized[:10] + "T" + normalized[11:]
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed
