"""Rule plugin contract, registry, message normalization, and param helpers.

Adding a rule = one class (``name``, ``configure``, ``evaluate``) plus one
``@register_rule("...")`` decoration line.
"""

import re
from abc import ABC, abstractmethod
from datetime import timedelta
from typing import TYPE_CHECKING, Any, Protocol, runtime_checkable

from loglens.models import RuleConfig

if TYPE_CHECKING:  # pragma: no cover
    from loglens.engine.windows import EventWindow
    from loglens.models import Incident

#: Registry of built-in rule classes by rule name.
RULE_REGISTRY: dict[str, type["BaseRule"]] = {}


def register_rule(name: str):
    """Class decorator registering a rule under *name*."""

    def decorator(cls: type["BaseRule"]) -> type["BaseRule"]:
        RULE_REGISTRY[name] = cls
        return cls

    return decorator


def get_rule(name: str) -> type["BaseRule"]:
    """Look up a registered rule class; raises ``ValueError`` when unknown."""
    try:
        return RULE_REGISTRY[name]
    except KeyError:
        known = ", ".join(sorted(RULE_REGISTRY)) or "none"
        raise ValueError(f"unknown rule '{name}' (registered: {known})") from None


def built_in_rule_names() -> list[str]:
    """Names of every registered rule."""
    return sorted(RULE_REGISTRY)


def create_default_rules() -> list["BaseRule"]:
    """Instantiate every registered rule with default configuration."""
    return [rule_cls() for rule_cls in RULE_REGISTRY.values()]


@runtime_checkable
class Rule(Protocol):
    """The plugin contract every rule fulfills (spec §5)."""

    name: str

    def configure(self, config: RuleConfig) -> None:
        """Apply a RuleConfig (enable flag + parameter overrides)."""
        ...

    def evaluate(self, window: "EventWindow") -> list["Incident"]:
        """Inspect one closed correlation window and return incidents."""
        ...


_DIGITS = re.compile(r"\d+")
_WHITESPACE = re.compile(r"\s+")


def normalize_message(message: str) -> str:
    """Wild-card numbers and collapse whitespace to get a message template."""
    return _WHITESPACE.sub(" ", _DIGITS.sub("N", message)).strip()


def humanize_duration(duration: timedelta) -> str:
    """Render a duration as a compact human string (``5m``, ``90s``)."""
    seconds = int(duration.total_seconds())
    if seconds % 60 == 0 and seconds >= 60:
        return f"{seconds // 60}m"
    return f"{seconds}s"


class BaseRule(ABC):
    """Convenience base for rules: param validation + config storage."""

    name: str = "base"
    #: Parameter keys this rule accepts; unknown keys are config errors.
    allowed_params: frozenset[str] = frozenset()

    def __init__(self) -> None:
        self.enabled = True

    def configure(self, config: RuleConfig) -> None:
        if config.name != self.name:
            raise ValueError(f"config for rule '{config.name}' applied to rule '{self.name}'")
        unknown = set(config.params) - set(self.allowed_params)
        if unknown:
            raise ValueError(f"unknown parameter(s): {', '.join(sorted(unknown))}")
        self.enabled = config.enabled
        self.apply_params(config.params)

    @abstractmethod
    def apply_params(self, params: dict[str, Any]) -> None:
        """Validate and store typed parameters (raise ValueError on bad input)."""

    @abstractmethod
    def evaluate(self, window: "EventWindow") -> list["Incident"]:
        """Inspect one closed correlation window and return incidents."""

    def window_duration(self) -> timedelta | None:
        """Size of the tumbling window this rule needs (None = event-driven)."""
        return None


def param_int(params: dict[str, Any], key: str, default: int, *, minimum: int | None = None) -> int:
    value = params.get(key, default)
    if isinstance(value, bool) or not isinstance(value, int):
        try:
            value = int(str(value))
        except ValueError:
            raise ValueError(f"parameter '{key}' must be an integer") from None
    if minimum is not None and value < minimum:
        raise ValueError(f"parameter '{key}' must be >= {minimum}")
    return value


def param_number(
    params: dict[str, Any], key: str, default: float, *, minimum: float | None = None
) -> float:
    value = params.get(key, default)
    if isinstance(value, bool):
        raise ValueError(f"parameter '{key}' must be a number")
    try:
        value = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"parameter '{key}' must be a number") from None
    if minimum is not None and value < minimum:
        raise ValueError(f"parameter '{key}' must be >= {minimum}")
    return value


def param_ratio(params: dict[str, Any], key: str, default: float) -> float:
    """A 0..1 fraction; accepts ``10%`` style strings."""
    value = params.get(key, default)
    if isinstance(value, str):
        text = value.strip()
        if text.endswith("%"):
            try:
                return float(text[:-1]) / 100.0
            except ValueError:
                raise ValueError(f"parameter '{key}' must be a ratio like 0.1 or '10%'") from None
    result = param_number(params, key, default, minimum=0.0)
    if result > 1.0 and not isinstance(params.get(key, default), str):
        raise ValueError(f"parameter '{key}' must be a ratio between 0 and 1")
    return result


def param_duration(params: dict[str, Any], key: str, default: timedelta) -> timedelta:
    """A duration like ``5m``, ``90s``, ``2h``, ``1d`` or a number of seconds."""
    value = params.get(key, default)
    if isinstance(value, timedelta):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return timedelta(seconds=float(value))
    if isinstance(value, str):
        text = value.strip()
        match = re.match(r"^(\d+(?:\.\d+)?)\s*([smhd]?)$", text)
        if match:
            amount = float(match.group(1))
            unit = match.group(2) or "s"
            multipliers = {"s": 1, "m": 60, "h": 3600, "d": 86400}
            return timedelta(seconds=amount * multipliers[unit])
    raise ValueError(f"parameter '{key}' must be a duration like '5m', '90s' or seconds")


def param_str(params: dict[str, Any], key: str, default: str) -> str:
    value = params.get(key, default)
    if not isinstance(value, str) or not value:
        raise ValueError(f"parameter '{key}' must be a non-empty string")
    return value
