"""Parsers: JSON-lines, plain text, and format auto-detection."""

from loglens.parsers.base import Parser
from loglens.parsers.detect import AutoDetectParser, detect_format
from loglens.parsers.jsonlines import JsonLinesParser
from loglens.parsers.plaintext import PlainTextParser
from loglens.parsers.timestamps import parse_timestamp

__all__ = [
    "Parser",
    "JsonLinesParser",
    "PlainTextParser",
    "AutoDetectParser",
    "detect_format",
    "parse_timestamp",
]
