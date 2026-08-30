"""Reporter plugin registry.

Adding a reporter = one ``render(report, out)`` function plus one
``@register_reporter("...")`` decoration line.
"""

from typing import Callable, Protocol

from loglens.models import Report

#: A reporter renders a Report to a file handle-ish ``out`` (or stdout when ``out`` is None).
Reporter = Callable[[Report, object], None]

REPORTER_REGISTRY: dict[str, Reporter] = {}


def register_reporter(name: str):
    """Function decorator registering a reporter under *name*."""

    def decorator(func: Reporter) -> Reporter:
        REPORTER_REGISTRY[name] = func
        return func

    return decorator


def get_reporter(name: str) -> Reporter:
    """Look up a registered reporter; raises ``ValueError`` when unknown."""
    try:
        return REPORTER_REGISTRY[name]
    except KeyError:
        known = ", ".join(sorted(REPORTER_REGISTRY)) or "none"
        raise ValueError(f"unknown report format '{name}' (registered: {known})") from None


class SupportsWrite(Protocol):
    """Minimal writable target (file object, io.StringIO, sys.stdout...)."""

    def write(self, text: str) -> object: ...
