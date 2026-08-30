"""Lazy readers: file paths, glob sets, and stdin.

``read_lines`` yields :class:`LineRecord` items one at a time — a multi-GB
file streams without being loaded into memory. Encoding failures are handled
with ``errors="replace"`` so decoding never crashes a run.
"""

import glob as globlib
import os
import sys
from dataclasses import dataclass
from typing import Iterator, Sequence

from loglens.errors import InputError

#: Display name used for standard input as an event source.
STDIN_SOURCE = "stdin"

_GLOB_CHARS = set("*?[")


@dataclass(frozen=True)
class LineRecord:
    """One raw line from one source, before parsing."""

    source: str
    line_number: int
    text: str


@dataclass(frozen=True)
class _ResolvedInput:
    """A concrete origin to read from: a file path or standard input."""

    source: str
    path: str | None  # None means stdin


def resolve_inputs(inputs: Sequence[str]) -> list[_ResolvedInput]:
    """Expand inputs into concrete origins, failing fast on missing files.

    ``-`` reads standard input; arguments containing glob characters expand
    to the sorted list of matches (empty expansion is an error); anything
    else must be an existing readable file.
    """
    resolved: list[_ResolvedInput] = []
    for raw in inputs:
        if raw == "-":
            resolved.append(_ResolvedInput(source=STDIN_SOURCE, path=None))
            continue
        if any(ch in raw for ch in _GLOB_CHARS):
            matches = sorted(globlib.glob(raw, recursive=True))
            if not matches:
                raise InputError(f"no files matched pattern '{raw}'")
            resolved.extend(_ResolvedInput(source=match, path=match) for match in matches)
            continue
        _ensure_readable_file(raw)
        resolved.append(_ResolvedInput(source=raw, path=raw))
    if not resolved:
        raise InputError("no input sources given")
    return resolved


def read_lines(inputs: Sequence[str], *, encoding: str = "utf-8") -> Iterator[LineRecord]:
    """Yield :class:`LineRecord` lazily from every input, in order."""
    for origin in resolve_inputs(inputs):
        yield from _read_one(origin, encoding=encoding)


def _read_one(origin: _ResolvedInput, *, encoding: str) -> Iterator[LineRecord]:
    if origin.path is None:
        yield from _read_stdin()
        return
    try:
        handle = open(origin.path, encoding=encoding, errors="replace")
    except OSError as exc:
        raise InputError(f"cannot read '{origin.path}': {exc.strerror or 'unknown error'}") from exc
    with handle:
        for line_number, line in enumerate(handle, start=1):
            yield LineRecord(source=origin.source, line_number=line_number, text=line.rstrip("\n"))


def _read_stdin() -> Iterator[LineRecord]:
    for line_number, line in enumerate(sys.stdin, start=1):
        yield LineRecord(source=STDIN_SOURCE, line_number=line_number, text=line.rstrip("\n"))


def _ensure_readable_file(path: str) -> None:
    if not os.path.exists(path):
        raise InputError(f"file not found: '{path}'")
    if os.path.isdir(path):
        raise InputError(f"'{path}' is a directory, not a log file")
    if not os.access(path, os.R_OK):
        raise InputError(f"file is not readable: '{path}'")
