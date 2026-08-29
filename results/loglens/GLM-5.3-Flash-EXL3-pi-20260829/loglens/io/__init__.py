"""Readers for files, globs, and stdin (lazy streaming)."""

from loglens.io.readers import iter_lines, probe_first_source, read_file, read_stdin

__all__ = ["iter_lines", "probe_first_source", "read_file", "read_stdin"]
