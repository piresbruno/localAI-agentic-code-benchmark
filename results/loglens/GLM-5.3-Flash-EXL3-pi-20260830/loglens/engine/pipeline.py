"""Normalization pipeline glue: input specs → lazy stream of parsed events."""

from itertools import chain
from typing import Iterator, Sequence

from loglens.io.readers import LineRecord, read_source, resolve_inputs
from loglens.models import LogEvent
from loglens.parsers.detect import PROBE_LINES, JSON_LINES_FORMAT, detect_format
from loglens.parsers.jsonl import JsonLinesParser
from loglens.parsers.plaintext import PlainTextParser

#: Hard cap on raw records inspected by the probe (guards pathological files).
_PROBE_RAW_CAP = 1000


def parse_inputs(
    inputs: Sequence[str],
    *,
    encoding: str = "utf-8",
    extra_patterns: Sequence[str] = (),
) -> Iterator[LogEvent]:
    """Stream parsed events from files, globs, or stdin.

    Format is auto-detected per file (probe of the first lines). Unparseable
    lines come through as UNKNOWN events — nothing is dropped.
    """
    origins = resolve_inputs(inputs)
    text_parser: PlainTextParser | None = None
    for origin in origins:
        records = read_source(origin, encoding=encoding)
        detected, probed = _probe_format(records)
        if detected == JSON_LINES_FORMAT:
            parser = JsonLinesParser()
        else:
            if text_parser is None:
                text_parser = PlainTextParser(extra_patterns=extra_patterns)
            parser = text_parser
        for record in chain(probed, records):
            yield parser.parse_line(record.text, source=record.source, line_number=record.line_number)


def _probe_format(records: Iterator[LineRecord]) -> tuple[str, list[LineRecord]]:
    """Consume just enough records to detect the format, returning them back.

    The caller re-chains the probed records ahead of the remaining ones so no
    line is lost to detection.
    """
    head: list[LineRecord] = []
    non_empty = 0
    for record in records:
        head.append(record)
        if record.text.strip():
            non_empty += 1
        if non_empty >= PROBE_LINES or len(head) >= _PROBE_RAW_CAP:
            break
    return detect_format(record.text for record in head), head
