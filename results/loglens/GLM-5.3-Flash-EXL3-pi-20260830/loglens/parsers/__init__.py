"""Parsers: JSON-lines, plain-text regex, and per-file format detection."""

from loglens.parsers.base import PARSER_REGISTRY, Parser, get_parser, register_parser
from loglens.parsers.detect import TEXT_FORMAT, detect_format
from loglens.parsers.jsonl import JsonLinesParser
from loglens.parsers.plaintext import DEFAULT_PATTERNS, PlainTextParser

__all__ = [
    "DEFAULT_PATTERNS",
    "PARSER_REGISTRY",
    "TEXT_FORMAT",
    "JsonLinesParser",
    "Parser",
    "PlainTextParser",
    "detect_format",
    "get_parser",
    "register_parser",
]
