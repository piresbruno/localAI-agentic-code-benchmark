"""Readers: lazy file / glob / stdin line streaming."""

from loglens.io.readers import LineRecord, STDIN_SOURCE, read_lines, resolve_inputs

__all__ = ["STDIN_SOURCE", "LineRecord", "read_lines", "resolve_inputs"]
