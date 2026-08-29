"""Parser protocol and shared machinery."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from datetime import datetime
from typing import Protocol, runtime_checkable

from loglens.models.event import LogEvent


@runtime_checkable
class Parser(Protocol):
    """A parser turns raw lines into normalized LogEvents.

    Implementations must never raise on malformed lines: unparseable input
    becomes an UNKNOWN-level event with a ``parse_error`` attribute.
    """

    name: str

    def parse_line(self, line: str, source: str, clock: Callable[[], datetime]) -> LogEvent: ...

    def parse_lines(self, lines: Iterable[str], source: str, clock: Callable[[], datetime]) -> Iterable[LogEvent]: ...
