"""level_gap — CRITICAL events with no preceding WARNING from the same logger."""

from __future__ import annotations

from loglens.models.config import RuleSettings
from loglens.models.event import LogEvent
from loglens.models.incident import Incident
from loglens.rules.base import make_incident

WINDOW_SECONDS = 300  # correlation window: the preceding 5 minutes


class LevelGapRule:
    """Fires for each CRITICAL event whose logger never logged a WARNING
    (or higher) before it within the analyzed stream."""

    name = "level_gap"
    suggested_action = "A component escalated straight to CRITICAL — add earlier-stage alerting to that logger."
    window_seconds: int | None = WINDOW_SECONDS

    def __init__(self, clock=None) -> None:
        self.clock = clock

    def configure(self, settings: RuleSettings) -> None:
        """No configurable thresholds; kept for protocol compliance."""

    def evaluate(self, events: list[LogEvent]) -> list[Incident]:
        warned_loggers: set[str | None] = set()
        incidents: list[Incident] = []
        for event in events:
            if event.level == "WARNING":
                warned_loggers.add(event.logger)
            elif event.level == "CRITICAL" and event.logger not in warned_loggers:
                incidents.append(
                    make_incident(
                        self,
                        "critical",
                        [event],
                        f"CRITICAL from '{event.logger or 'root'}' with no preceding WARNING "
                        f"(escalation without warning): '{event.message[:80]}'",
                    )
                )
        return incidents
