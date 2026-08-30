"""Parser plugin contract and registry.

Adding a parser = one class with ``name`` / ``parse_line`` plus one
``@register_parser("...")`` decoration line.
"""

from typing import Protocol, runtime_checkable

from loglens.models import LogEvent

#: Registry of parser classes by format name (e.g. ``"jsonl"``, ``"text"``).
PARSER_REGISTRY: dict[str, type["Parser"]] = {}


def register_parser(name: str):
    """Class decorator that registers a parser under *name*."""

    def decorator(cls: type["Parser"]) -> type["Parser"]:
        PARSER_REGISTRY[name] = cls
        return cls

    return decorator


def get_parser(name: str) -> type["Parser"]:
    """Look up a registered parser class; raises ``ValueError`` when unknown."""
    try:
        return PARSER_REGISTRY[name]
    except KeyError:
        known = ", ".join(sorted(PARSER_REGISTRY)) or "none"
        raise ValueError(f"unknown parser '{name}' (registered: {known})") from None


@runtime_checkable
class Parser(Protocol):
    """A per-line parser producing normalized :class:`LogEvent` objects.

    Parsers never drop lines: anything unparseable becomes an event with
    level ``UNKNOWN`` and a ``parse_error`` attribute.
    """

    name: str

    def parse_line(self, line: str, *, source: str, line_number: int) -> LogEvent:
        """Parse one line into a LogEvent (never raises on bad input)."""
        ...
