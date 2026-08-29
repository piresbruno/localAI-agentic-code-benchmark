"""Rule registry: built-in rules registered once; new rules = one class + one line."""

from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

from loglens.models.config import RuleConfig, RuleSettings
from loglens.rules.base import Rule
from loglens.rules.burst import BurstRule
from loglens.rules.error_rate_spike import ErrorRateSpikeRule
from loglens.rules.latency_outlier import LatencyOutlierRule
from loglens.rules.level_gap import LevelGapRule
from loglens.rules.repeated_error import RepeatedErrorRule

RuleT = TypeVar("RuleT", bound=type)


class RuleRegistry:
    """Maps rule names to factories. Instantiation applies RuleConfig settings."""

    def __init__(self) -> None:
        self._factories: dict[str, Callable[[], object]] = {}

    def register(self, name: str, factory: Callable[[], object]) -> None:
        if name in self._factories:
            raise ValueError(f"rule '{name}' is already registered")
        self._factories[name] = factory

    def names(self) -> list[str]:
        return sorted(self._factories)

    def instantiate(self, config: RuleConfig) -> list[Rule]:
        """Build one instance per registered rule, configured + enabled-filtered."""
        instances: list[Rule] = []
        for name, factory in self._factories.items():
            settings: RuleSettings = config.settings_for(name)
            instance = factory()  # type: ignore[operator]
            instance.configure(settings)
            if settings.enabled:
                instances.append(instance)
        return instances


def _register_builtins(registry: RuleRegistry) -> None:
    registry.register("error_rate_spike", ErrorRateSpikeRule)
    registry.register("repeated_error", RepeatedErrorRule)
    registry.register("latency_outlier", LatencyOutlierRule)
    registry.register("burst", BurstRule)
    registry.register("level_gap", LevelGapRule)


BUILTIN_REGISTRY = RuleRegistry()
_register_builtins(BUILTIN_REGISTRY)

__all__ = ["RuleRegistry", "BUILTIN_REGISTRY", "RuleT"]
