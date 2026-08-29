"""Plain-text parser with configurable regex patterns (≥ 3 built in)."""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable
from datetime import datetime

from loglens.models.event import LogEvent
from loglens.parsers.jsonlines import normalize_level
from loglens.parsers.timestamps import parse_timestamp

# Each pattern must expose named groups: ts, level, msg (logger optional).
DEFAULT_PATTERNS: tuple[re.Pattern[str], ...] = (
    # 2026-01-15 08:23:01,441 ERROR [worker] Connection refused
    re.compile(
        r"^(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)\s+"
        r"(?P<level>[A-Za-z]+)\s+(?:\[(?P<logger>[^\]]+)\]\s+)?(?P<msg>.*)$"
    ),
    # 2026-01-15T08:23:01Z ERROR worker: Connection refused
    re.compile(
        r"^(?P<ts>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+"
        r"(?P<level>[A-Za-z]+)\s+(?:(?P<logger>[\w.-]+):\s+)?(?P<msg>.*)$"
    ),
    # [2026-01-15 08:23:01] [ERROR] worker - Connection refused
    re.compile(
        r"^\[(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)\]\s+"
        r"\[(?P<level>[A-Za-z]+)\]\s+(?:(?P<logger>[\w.-]+)\s+-\s+)?(?P<msg>.*)$"
    ),
)


class PlainTextParser:
    """Matches lines against a list of regex patterns (first match wins)."""

    name = "plaintext"

    def __init__(self, patterns: Iterable[re.Pattern[str]] | None = None) -> None:
        self.patterns: list[re.Pattern[str]] = list(patterns) if patterns is not None else list(DEFAULT_PATTERNS)

    def parse_line(self, line: str, source: str, clock: Callable[[], datetime]) -> LogEvent:
        text = line.rstrip("\r\n")
        if not text.strip():
            return self._unknown(line, source, clock, "empty line")
        for pattern in self.patterns:
            match = pattern.match(text)
            if match:
                return self._from_match(match, line, source, clock)
        return self._unknown(line, source, clock, "no pattern matched")

    def parse_lines(self, lines: Iterable[str], source: str, clock: Callable[[], datetime]) -> Iterable[LogEvent]:
        for line in lines:
            yield self.parse_line(line, source, clock)

    def _from_match(self, match: re.Match[str], line: str, source: str, clock: Callable[[], datetime]) -> LogEvent:
        timestamp = parse_timestamp(match.group("ts"))
        if timestamp is None:
            return self._unknown(line, source, clock, f"unparseable timestamp: {match.group('ts')}")
        level = normalize_level(match.group("level"))
        logger = match.groupdict().get("logger")
        return LogEvent(
            timestamp=timestamp,
            level=level,
            message=match.group("msg").strip(),
            logger=logger.strip() if logger else None,
            source=source,
            attributes={},
            raw=line,
        )

    def _unknown(self, line: str, source: str, clock: Callable[[], datetime], reason: str) -> LogEvent:
        return LogEvent.unknown(source=source, raw=line, reason=reason, clock=clock)
