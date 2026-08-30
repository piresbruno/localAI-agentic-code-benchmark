"""``level_gap`` — CRITICAL events with no preceding WARNING from the same logger."""

from datetime import timedelta
from typing import Any

from loglens.engine.windows import EventWindow
from loglens.models import Incident, LogLevel, Severity
from loglens.rules.base import BaseRule, register_rule


@register_rule("level_gap")
class LevelGapRule(BaseRule):
    """Event-driven rule (no window). Tracks, per logger, whether a WARNING
    has been seen since the last reported gap; a CRITICAL from a logger that
    never warned first is an escalation without warning."""

    name = "level_gap"
    allowed_params = frozenset()

    def __init__(self) -> None:
        super().__init__()
        self._state: dict[str | None, _LoggerState] = {}

    def apply_params(self, params: dict[str, Any]) -> None:
        if params:
            raise ValueError(f"rule '{self.name}' takes no parameters")

    def window_duration(self) -> timedelta | None:
        return None

    def evaluate(self, window: EventWindow) -> list[Incident]:
        incidents: list[Incident] = []
        for event in window.events:
            state = self._state.setdefault(event.logger, _LoggerState())
            if event.level is LogLevel.WARNING:
                state.seen_warning = True
                state.reported = False
            elif event.level is LogLevel.CRITICAL and not state.seen_warning and not state.reported:
                state.reported = True
                incidents.append(self._incident(event))
        return incidents

    def _incident(self, event) -> Incident:
        logger_label = f"logger '{event.logger}'" if event.logger else "events without a logger"
        return Incident(
            rule=self.name,
            severity=Severity.WARN,
            first_timestamp=event.timestamp,
            last_timestamp=event.timestamp,
            event_ids=[event.id or ""],
            summary=(
                f"{logger_label.capitalize()} escalated straight to CRITICAL "
                f"with no preceding WARNING: {event.message}"
            ),
            suggested_action=(
                "Add WARNING-level thresholds so this logger escalates gradually, "
                "and verify alerting coverage for it."
            ),
        )


class _LoggerState:
    __slots__ = ("reported", "seen_warning")

    def __init__(self) -> None:
        self.seen_warning = False
        self.reported = False
