"""repeated_error — the same normalized message repeating within a window."""

from __future__ import annotations

import re

from loglens.models.config import RuleSettings
from loglens.models.event import LogEvent
from loglens.models.incident import Incident
from loglens.rules.base import make_incident, resolved
from loglens.rules.message_template import normalize_message

DEFAULTS = {"min_count": 5, "window_seconds": 600}

_NUMBER_RE = re.compile(r"\b\d+(?:\.\d+)?\b")


class RepeatedErrorRule:
    """Fires when an error-level message with the same template (numbers
    wild-carded) repeats at least ``min_count`` times within ``window_seconds``."""

    name = "repeated_error"
    suggested_action = "A single error is repeating — check the originating component for a retry or resource loop."
    window_seconds: int | None = DEFAULTS["window_seconds"]

    def __init__(self, clock=None) -> None:
        self.clock = clock
        self.min_count = DEFAULTS["min_count"]
        self.window_seconds = DEFAULTS["window_seconds"]

    def configure(self, settings: RuleSettings) -> None:
        self.min_count = int(resolved(settings.min_count, DEFAULTS["min_count"]))
        self.window_seconds = int(resolved(settings.window_seconds, DEFAULTS["window_seconds"]))

    def evaluate(self, events: list[LogEvent]) -> list[Incident]:
        groups: dict[str, list[LogEvent]] = {}
        for event in events:
            if not event.is_error:
                continue
            template = normalize_message(event.message)
            groups.setdefault(template, []).append(event)

        incidents: list[Incident] = []
        for template, group in groups.items():
            group.sort(key=lambda e: e.timestamp)
            window: list[LogEvent] = []
            best: list[LogEvent] = []
            for event in group:
                window.append(event)
                while window and (event.timestamp - window[0].timestamp).total_seconds() > self.window_seconds:
                    window.pop(0)
                if len(window) > len(best):
                    best = list(window)
            if len(best) >= self.min_count:
                incidents.append(
                    make_incident(
                        self,
                        "warn",
                        best,
                        f"'{template[:80]}' repeated {len(best)}× within "
                        f"{self.window_seconds // 60}m (min {self.min_count})",
                    )
                )
        return incidents
