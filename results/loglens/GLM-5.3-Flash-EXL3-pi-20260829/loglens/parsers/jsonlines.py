"""JSON-lines parser: `{"ts": ..., "level": ..., "msg": ...}` with common key aliases."""

from __future__ import annotations

import json
from collections.abc import Callable, Iterable
from datetime import datetime

from loglens.models.event import LogEvent
from loglens.parsers.timestamps import parse_timestamp

# Accepted key aliases per canonical field.
KEY_ALIASES: dict[str, tuple[str, ...]] = {
    "timestamp": ("ts", "timestamp", "time", "@timestamp"),
    "message": ("msg", "message"),
    "logger": ("logger", "name", "logger_name"),
    "level": ("level", "severity"),
}

ALL_ALIAS_KEYS = {a for aliases in KEY_ALIASES.values() for a in aliases}

KNOWN_LEVELS = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
_LEVEL_ALIASES = {"WARN": "WARNING", "FATAL": "CRITICAL", "TRACE": "DEBUG", "ERR": "ERROR", "CRIT": "CRITICAL"}


def normalize_level(raw: object) -> str:
    """Uppercase + alias-map a level string; anything unknown stays UNKNOWN."""
    if not isinstance(raw, str):
        return "UNKNOWN"
    level = raw.strip().upper()
    level = _LEVEL_ALIASES.get(level, level)
    return level if level in KNOWN_LEVELS else "UNKNOWN"


def _pick(mapping: dict, canonical: str) -> object:
    for alias in KEY_ALIASES[canonical]:
        if alias in mapping:
            return mapping[alias]
    return None


class JsonLinesParser:
    """Parses one JSON object per line. Malformed lines never raise."""

    name = "jsonlines"

    def parse_line(self, line: str, source: str, clock: Callable[[], datetime]) -> LogEvent:
        text = line.strip()
        if not text:
            return self._unknown(line, source, clock, "empty line")
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            return self._unknown(line, source, clock, f"invalid JSON: {exc.msg} at column {exc.colno}")
        if not isinstance(payload, dict):
            return self._unknown(line, source, clock, "JSON value is not an object")

        timestamp = parse_timestamp(_pick(payload, "timestamp"))
        if timestamp is None:
            return self._unknown(line, source, clock, "missing or unparseable timestamp")

        message = _pick(payload, "message")
        logger = _pick(payload, "logger")
        raw_level = _pick(payload, "level")
        level = normalize_level(raw_level)

        attributes = {
            key: value for key, value in payload.items() if key not in ALL_ALIAS_KEYS
        }
        if level == "UNKNOWN" and not message:
            return self._unknown(line, source, clock, "no recognizable level or message field")
        if level == "UNKNOWN":
            attributes["parse_error"] = f"unknown level: {raw_level!r}"

        return LogEvent(
            timestamp=timestamp,
            level=level if level != "UNKNOWN" else "UNKNOWN",
            message=str(message) if message is not None else "",
            logger=str(logger) if logger is not None else None,
            source=source,
            attributes=attributes,
            raw=line,
        )

    def parse_lines(self, lines: Iterable[str], source: str, clock: Callable[[], datetime]) -> Iterable[LogEvent]:
        for line in lines:
            yield self.parse_line(line, source, clock)

    def _unknown(self, line: str, source: str, clock: Callable[[], datetime], reason: str) -> LogEvent:
        return LogEvent.unknown(source=source, raw=line, reason=reason, clock=clock)
