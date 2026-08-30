"""JSON-lines parser with tolerant key aliases and timestamp formats."""

import json
from typing import Any

from loglens.models import LogEvent, LogLevel
from loglens.parsers.base import register_parser
from loglens.parsers.timestamps import parse_timestamp

#: Accepted aliases for the timestamp, message, and logger keys.
TS_KEYS = ("ts", "timestamp", "time")
MSG_KEYS = ("msg", "message")
LOGGER_KEYS = ("logger", "name")
LEVEL_KEYS = ("level", "severity")
#: Keys reserved for the nested-attributes escape hatch.
ATTR_KEYS = ("attributes", "attrs")


@register_parser("jsonl")
class JsonLinesParser:
    """Parses one JSON object per line.

    Recognizes common key aliases (``ts|timestamp|time``, ``msg|message``,
    ``logger|name``), ISO-8601 and unix seconds/millis timestamps, level
    aliases, and folds every other top-level key into ``attributes``.
    """

    name = "jsonl"

    def parse_line(self, line: str, *, source: str, line_number: int) -> LogEvent:
        event = LogEvent(source=source, line=line_number, raw=line)
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as exc:
            event.mark_parse_error(f"invalid JSON: {exc.msg} at column {exc.colno}")
            return event
        if not isinstance(obj, dict):
            event.mark_parse_error("JSON line is not an object")
            return event

        level_raw = _first_key(obj, LEVEL_KEYS)
        if level_raw is not None:
            level = LogLevel.parse(str(level_raw))
            event.level = level
            if level is LogLevel.UNKNOWN:
                event.mark_parse_error(f"unknown level '{level_raw}'")

        message = _first_key(obj, MSG_KEYS)
        if message is None:
            event.mark_parse_error("missing message key (msg|message)")
        else:
            event.message = str(message)

        timestamp = parse_timestamp(_first_key(obj, TS_KEYS))
        if timestamp is None:
            if message is not None:
                # Only flag the timestamp when the rest of the line parsed.
                event.mark_parse_error("missing or unparseable timestamp")
        else:
            event.timestamp = timestamp

        logger = _first_key(obj, LOGGER_KEYS)
        if logger is not None:
            event.logger = str(logger)

        event.attributes.update(_collect_attributes(obj))
        return event


def _first_key(obj: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in obj:
            return obj[key]
    return None


def _collect_attributes(obj: dict[str, Any]) -> dict[str, Any]:
    consumed = set(TS_KEYS + MSG_KEYS + LOGGER_KEYS + LEVEL_KEYS)
    attributes: dict[str, Any] = {
        key: value for key, value in obj.items() if key not in consumed
    }
    for key in ATTR_KEYS:
        nested = attributes.get(key)
        if isinstance(nested, dict):
            attributes.pop(key)
            for nested_key, nested_value in nested.items():
                attributes.setdefault(nested_key, nested_value)
    return attributes
