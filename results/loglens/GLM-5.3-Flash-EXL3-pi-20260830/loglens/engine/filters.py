"""Time-range filtering for ``--since`` / ``--until``.

Values are relative (``30m``, ``2h``, ``1d``, ``45s``) or ISO-8601. Relative
values resolve against an injected clock so behavior is deterministic and
testable.
"""

import re
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Optional

from loglens.models import LogEvent
from loglens.parsers.timestamps import parse_timestamp

_RELATIVE = re.compile(r"^(\d+)([smhd])$")
_UNITS = {"s": timedelta(seconds=1), "m": timedelta(minutes=1), "h": timedelta(hours=1), "d": timedelta(days=1)}

Clock = Callable[[], datetime]


class TimeFilter:
    """Inclusive time-range filter over event timestamps."""

    __slots__ = ("since", "until")

    def __init__(self, since: Optional[datetime] = None, until: Optional[datetime] = None) -> None:
        self.since = since
        self.until = until

    def matches(self, event: LogEvent) -> bool:
        """Events without a timestamp never match an active range."""
        if event.timestamp is None:
            return False
        if self.since is not None and event.timestamp < self.since:
            return False
        if self.until is not None and event.timestamp > self.until:
            return False
        return True


def parse_time_value(raw: str, clock: Clock) -> datetime:
    """Parse a relative (``30m``) or absolute (ISO-8601) time value.

    Relative values are anchored at ``clock()``. Raises ``ValueError`` with a
    safe message for unparseable input.
    """
    text = raw.strip()
    match = _RELATIVE.match(text)
    if match:
        amount, unit = int(match.group(1)), match.group(2)
        return clock() - amount * _UNITS[unit]
    parsed = parse_timestamp(text)
    if parsed is None:
        raise ValueError(f"invalid time value '{raw}' (use '30m' style or ISO-8601)")
    return parsed


def parse_time_filter(
    since: Optional[str], until: Optional[str], clock: Clock
) -> Optional[TimeFilter]:
    """Build a :class:`TimeFilter` from CLI strings; ``None`` inputs → no filter."""
    if since is None and until is None:
        return None
    try:
        since_dt = parse_time_value(since, clock) if since else None
        until_dt = parse_time_value(until, clock) if until else None
    except ValueError as exc:
        raise ValueError(str(exc)) from exc
    if since_dt is not None and until_dt is not None and since_dt > until_dt:
        raise ValueError("--since must not be after --until")
    return TimeFilter(since=since_dt, until=until_dt)
