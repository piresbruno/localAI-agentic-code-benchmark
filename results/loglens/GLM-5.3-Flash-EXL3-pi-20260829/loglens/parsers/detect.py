"""Format auto-detection: probe the first lines of each source, then delegate.

Detection is lazy and streaming-safe. Each source buffers up to
``probe_lines`` lines, chooses a parser, replays the buffered lines through
it, and then delegates the rest — no line is lost, duplicated, or re-read.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterable, Iterator
from datetime import datetime
import re

from loglens.models.event import LogEvent
from loglens.parsers.jsonlines import JsonLinesParser
from loglens.parsers.plaintext import PlainTextParser

PROBE_LINES = 10
JSON_OBJECT_RATIO = 0.6


def detect_format(lines: list[str]) -> str:
    """Return 'jsonlines' if ≥ 60% of non-empty probe lines are JSON objects, else 'plaintext'."""
    non_empty = [line for line in lines if line.strip()]
    if not non_empty:
        return "plaintext"
    ok = 0
    for line in non_empty:
        try:
            payload = json.loads(line.strip())
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            ok += 1
    return "jsonlines" if ok / len(non_empty) >= JSON_OBJECT_RATIO else "plaintext"


class AutoDetectParser:
    """Streaming parser that auto-detects the format of each source."""

    name = "auto"

    def __init__(self, probe_lines: int = PROBE_LINES) -> None:
        self.probe_lines = probe_lines

    def parser_for(self, probe: list[str]) -> JsonLinesParser | PlainTextParser:
        if detect_format(probe) == "jsonlines":
            return JsonLinesParser()
        return PlainTextParser()

    def parse_stream(
        self,
        pairs: Iterable[tuple[str, str]],
        clock: Callable[[], datetime],
    ) -> Iterator[LogEvent]:
        """Parse (source, line) pairs, detecting the format per source."""
        current: str | None = None
        probe: list[str] = []
        delegate: JsonLinesParser | PlainTextParser | None = None

        for source, line in pairs:
            if source != current:
                yield from self._flush_probe(current, probe, clock)
                current = source
                probe = []
                delegate = None
            if delegate is None:
                probe.append(line)
                if len(probe) >= self.probe_lines:
                    delegate = self.parser_for(probe)
                    yield from (delegate.parse_line(pl, source, clock) for pl in probe)
                    probe = []
            else:
                yield delegate.parse_line(line, source, clock)
        yield from self._flush_probe(current, probe, clock)

    def _flush_probe(
        self,
        source: str | None,
        probe: list[str],
        clock: Callable[[], datetime],
    ) -> Iterator[LogEvent]:
        """Replay a still-uncommitted probe (short file or source change)."""
        if source is None or not probe:
            return
        delegate = self.parser_for(probe)
        yield from (delegate.parse_line(pl, source, clock) for pl in probe)


def match_any_pattern(line: str) -> re.Match[str] | None:
    """Helper used by tests/tools: does a line look like a known plain-text pattern?"""
    return next((p.match(line) for p in PlainTextParser().patterns if p.match(line)), None)
