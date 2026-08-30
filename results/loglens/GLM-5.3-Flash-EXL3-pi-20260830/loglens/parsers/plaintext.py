"""Plain-text parser driven by a configurable list of regex patterns.

Default patterns cover common layouts; config files may append more via
``[parsers] extra_patterns = [...]``. Every pattern must expose named groups:
``ts`` (required), ``level`` (optional), ``logger`` (optional),
``message`` (required), and optionally ``status`` (HTTP status code, from
which the level is derived).
"""

import re
from collections.abc import Sequence
from datetime import datetime

from loglens.models import LogEvent, LogLevel
from loglens.parsers.base import register_parser
from loglens.parsers.timestamps import parse_timestamp

#: ``2026-01-15 08:23:01,441 ERROR [worker] Connection refused``
_PATTERN_SPACE_TS = (
    r"^(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?"
    r"(?:Z|[+-]\d{2}:?\d{2})?)\s+"
    r"(?P<level>[A-Za-z]+)\s+"
    r"(?:\[(?P<logger>[^\]]+)\]\s+)?"
    r"(?P<message>.+)$"
)

#: ``[2026-01-15 08:23:01] ERROR: Connection refused``
_PATTERN_BRACKET_TS = (
    r"^\[(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)\]\s+"
    r"(?P<level>[A-Za-z]+)\s*:?(?:\s+|(?=\s))(?P<message>.+)$"
)

#: ``2026-01-15T08:23:01Z - ERROR - worker - Connection refused``
_PATTERN_DASHED = (
    r"^(?P<ts>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?)\s+-\s+"
    r"(?P<level>[A-Za-z]+)\s+-\s+"
    r"(?:(?P<logger>[\w.\-]+)\s+-\s+)?"
    r"(?P<message>.+)$"
)

#: Apache/nginx combined-ish access log.
#: ``127.0.0.1 - frank [10/Oct/2023:13:55:36 -0700] "GET /api HTTP/1.0" 200 2326``
_PATTERN_ACCESS_LOG = (
    r"^\S+\s+\S+\s+\S+\s+"
    r"\[(?P<ts>\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4})\]\s+"
    r"\"(?P<message>[^\"]+)\""
    r"(?:\s+(?P<status>\d{3})\s+\S+)?.*$"
)

DEFAULT_PATTERNS: tuple[str, ...] = (
    _PATTERN_SPACE_TS,
    _PATTERN_BRACKET_TS,
    _PATTERN_DASHED,
    _PATTERN_ACCESS_LOG,
)


@register_parser("text")
class PlainTextParser:
    """Tries each configured regex in order; first match wins."""

    name = "text"

    def __init__(self, extra_patterns: Sequence[str] = ()) -> None:
        self._patterns = [re.compile(p) for p in (*DEFAULT_PATTERNS, *extra_patterns)]

    def parse_line(self, line: str, *, source: str, line_number: int) -> LogEvent:
        event = LogEvent(source=source, line=line_number, raw=line)
        match = None
        for pattern in self._patterns:
            match = pattern.match(line)
            if match:
                break
        if match is None:
            event.mark_parse_error("no plain-text pattern matched")
            return event

        groups = match.groupdict()
        event.message = groups.get("message") or ""
        event.logger = groups.get("logger")

        timestamp = self._parse_ts(groups)
        if timestamp is None:
            event.mark_parse_error("unparseable timestamp")
            return event
        event.timestamp = timestamp

        level = self._parse_level(groups)
        event.level = level
        if level is LogLevel.UNKNOWN:
            event.mark_parse_error(f"unknown level '{groups.get('level')}'")
        return event

    @staticmethod
    def _parse_ts(groups: dict[str, str | None]) -> datetime | None:
        raw_ts = groups.get("ts")
        if not raw_ts:
            return None
        if "/" in raw_ts:  # CLF style: 10/Oct/2023:13:55:36 -0700
            try:
                return datetime.strptime(raw_ts, "%d/%b/%Y:%H:%M:%S %z")
            except ValueError:
                return None
        return parse_timestamp(raw_ts)

    @staticmethod
    def _parse_level(groups: dict[str, str | None]) -> LogLevel:
        raw_level = groups.get("level")
        if raw_level:
            return LogLevel.parse(raw_level)
        status = groups.get("status")
        if status is not None:
            return _level_from_status(int(status))
        return LogLevel.INFO


def _level_from_status(status: int) -> LogLevel:
    """Derive a level from an HTTP status code (no explicit level in line)."""
    if status >= 500:
        return LogLevel.ERROR
    if status >= 400:
        return LogLevel.WARNING
    return LogLevel.INFO
