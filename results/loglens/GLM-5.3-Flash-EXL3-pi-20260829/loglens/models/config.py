"""Rule configuration: per-rule enable/disable and threshold overrides."""

from __future__ import annotations

import tomllib
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from loglens.models.errors import ConfigError


class RuleSettings(BaseModel):
    """Thresholds for one rule. ``None`` means "use the built-in default"."""

    model_config = ConfigDict(extra="forbid")

    enabled: bool = True
    window_seconds: int | None = None
    threshold: float | None = None
    min_count: int | None = None
    min_events: int | None = None
    multiplier: float | None = None
    attribute: str | None = None


class RuleConfig(BaseModel):
    """Full rule-engine configuration resolved from defaults + config file."""

    model_config = ConfigDict(extra="forbid")

    rules: dict[str, RuleSettings] = Field(default_factory=dict)

    def settings_for(self, rule_name: str) -> RuleSettings:
        return self.rules.get(rule_name, RuleSettings())

    def is_enabled(self, rule_name: str) -> bool:
        return self.settings_for(rule_name).enabled


DEFAULT_CONFIG = RuleConfig()


def load_config(path: str | Path) -> RuleConfig:
    """Load a TOML config file. Raises ConfigError with file+line on any problem.

    Expected shape::

        [rules.error_rate_spike]
        enabled = false
        threshold = 0.2

    Unknown rules or unknown fields produce a clean error naming the file and line.
    """
    file = Path(path)
    if not file.is_file():
        raise ConfigError(f"config file not found: {file}", file=str(file), line=None)
    try:
        data = tomllib.loads(file.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as exc:
        line = _extract_toml_error_line(str(exc))
        raise ConfigError(f"invalid TOML: {exc}", file=str(file), line=line) from exc

    if "rules" not in data:
        raise ConfigError("config must contain a [rules] table", file=str(file), line=1)
    rules_section = data["rules"]
    if not isinstance(rules_section, dict):
        raise ConfigError("[rules] must be a table of rule settings", file=str(file), line=None)

    rules: dict[str, RuleSettings] = {}
    for name, settings in rules_section.items():
        if not isinstance(settings, dict):
            raise ConfigError(f"rule '{name}' settings must be a table", file=str(file), line=None)
        if name not in KNOWN_RULE_NAMES:
            raise ConfigError(
                f"unknown rule '{name}' (known: {', '.join(sorted(KNOWN_RULE_NAMES))})",
                file=str(file),
                line=_find_key_line(file.read_text(encoding="utf-8"), name),
            )
        try:
            rules[name] = RuleSettings(**settings)
        except Exception as exc:
            raise ConfigError(f"invalid settings for rule '{name}': {exc}", file=str(file), line=None) from exc
    return RuleConfig(rules=rules)


KNOWN_RULE_NAMES: frozenset[str] = frozenset(
    {
        "error_rate_spike",
        "repeated_error",
        "latency_outlier",
        "burst",
        "level_gap",
    }
)


def _find_key_line(text: str, key: str) -> int | None:
    for i, line in enumerate(text.splitlines(), start=1):
        if line.strip().startswith(f"[rules.{key}") or line.strip().startswith(f"{key} ="):
            return i
    return None


def _extract_toml_error_line(message: str) -> int | None:
    """tomllib error strings often contain 'at line N, column M'."""
    import re

    match = re.search(r"line (\d+)", message)
    return int(match.group(1)) if match else None
