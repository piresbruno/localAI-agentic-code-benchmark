"""Readers: lazy file / glob / stdin line streaming."""

from loglens.io.readers import (
    STDIN_SOURCE,
    LineRecord,
    SourceInput,
    read_lines,
    read_source,
    resolve_inputs,
)

__all__ = [
    "STDIN_SOURCE",
    "LineRecord",
    "SourceInput",
    "read_lines",
    "read_source",
    "resolve_inputs",
]
