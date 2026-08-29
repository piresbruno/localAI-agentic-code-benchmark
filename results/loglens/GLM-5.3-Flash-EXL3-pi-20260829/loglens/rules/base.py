"""Rule protocol: a detection plugin evaluated over event windows."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from loglens.models.config import RuleConfig, RuleSettings
from loglens.models.event import LogEvent
from loglens.models.incident import Incident


@runtime_checkable
class Rule(Protocol):
    """A detection rule.

    Implementations declare ``name`` and ``suggested_action``, receive their
    settings via ``configure``, and produce Incidents from a window of events.
    Rules must be deterministic for a given window + clock.
    """

    name: str
    suggested_action: str

    def configure(self, settings: RuleSettings) -> None: ...

    def evaluate(self, events: list[LogEvent]) -> list[Incident]: ...


def resolved(setting: int | float | None, default: int | float) -> int | float:
    """Return the configured value or the rule default."""
    return default if setting is None else setting


def make_incident(
    rule: Rule,
    severity: str,
    events: list[LogEvent],
    summary: str,
) -> Incident:
    """Build an Incident from the events that triggered a rule."""
    return Incident(
        rule=rule.name,
        severity=severity,
        first_seen=events[0].timestamp,
        last_seen=events[-1].timestamp,
        event_ids=[e.event_id for e in events],
        summary=summary,
        suggested_action=rule.suggested_action,
    )


def default_settings(config: RuleConfig, rule_name: str) -> RuleSettings:
    return config.settings_for(rule_name)
