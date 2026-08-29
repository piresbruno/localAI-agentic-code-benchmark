"""Input readers: files, glob sets, stdin — all lazy generators.

A 1 GB file must stream, not load: every reader yields one line at a time
and never materializes the whole source in memory.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from pathlib import Path
import sys

from loglens.models.errors import SourceError

DEFAULT_ENCODING = "utf-8"


def read_file(path: str | Path, encoding: str = DEFAULT_ENCODING) -> Iterator[str]:
    """Yield lines from one file lazily. Raises SourceError if unreadable."""
    file = Path(path)
    if not file.is_file():
        raise SourceError(f"input file not found: {file}")
    try:
        with file.open("r", encoding=encoding, errors="replace", newline="") as handle:
            yield from handle
    except OSError as exc:
        raise SourceError(f"cannot read {file}: {exc.strerror or exc}") from exc


def read_stdin() -> Iterator[str]:
    """Yield lines from stdin lazily."""
    yield from sys.stdin


def iter_lines(sources: Iterable[str], encoding: str = DEFAULT_ENCODING) -> Iterator[tuple[str, str]]:
    """Yield ``(source_name, line)`` pairs across all sources lazily.

    Sources are file paths, glob patterns, or '-' for stdin. Glob patterns are
    expanded at iteration start; a pattern matching nothing is an error only if
    it looks like a glob (contains *?[).
    """
    for source in sources:
        if source == "-":
            yield from (("stdin", line) for line in read_stdin())
            continue
        path = Path(source)
        if path.is_file():
            yield from ((source, line) for line in read_file(path, encoding))
            continue
        if path.is_dir():
            raise SourceError(f"input is a directory: {source}")
        if any(ch in source for ch in "*?["):
            matches = sorted(Path().glob(source))
            if not matches:
                raise SourceError(f"glob pattern matched no files: {source}")
            for match in matches:
                yield from ((str(match), line) for line in read_file(match, encoding))
            continue
        raise SourceError(f"input file not found: {source}")


def probe_first_source(sources: Iterable[str], count: int = 10, encoding: str = DEFAULT_ENCODING) -> list[str]:
    """Read up to ``count`` lines from the first source without consuming the rest.

    Opens the first source independently so the main iteration is unaffected.
    """
    first = next(iter(sources), None)
    if first is None:
        raise SourceError("no input sources given")
    lines: list[str] = []
    if first == "-":
        # stdin cannot be rewound; callers should pass file sources when probing matters.
        for line in read_stdin():
            lines.append(line)
            if len(lines) >= count:
                break
        return lines
    path = Path(first)
    if path.is_file():
        for line in read_file(path, encoding):
            lines.append(line)
            if len(lines) >= count:
                break
        return lines
    if any(ch in first for ch in "*?["):
        matches = sorted(Path().glob(first))
        if matches:
            for line in read_file(matches[0], encoding):
                lines.append(line)
                if len(lines) >= count:
                    break
        return lines
    raise SourceError(f"input file not found: {first}")
