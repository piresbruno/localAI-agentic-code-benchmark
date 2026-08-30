"""Config file loading (TOML or JSON) with file+line error localization.

Schema::

    [rules.error_rate_spike]
    enabled = true
    threshold = 0.15
    window = "5m"

    [parsers]
    extra_patterns = ["<regex with ts/level/message groups>"]

Unknown sections, unknown rules, and bad values raise :class:`ConfigError`
carrying the config file path and line number where possible.
"""

import json
import re
import tomllib
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from loglens.errors import ConfigError
from loglens.models import RuleConfig
from loglens.rules.base import RULE_REGISTRY, get_rule

if TYPE_CHECKING:  # pragma: no cover
    from loglens.rules.base import Rule

ALLOWED_TOP_KEYS = ("rules", "parsers")
ALLOWED_PARSER_KEYS = ("extra_patterns",)

_TOML_LINE = re.compile(r"at line (\d+)")


@dataclass
class ConfigData:
    """Validated contents of a config file."""

    path: str
    rules: list[RuleConfig] = field(default_factory=list)
    extra_patterns: list[str] = field(default_factory=list)


def load_config(path: str) -> ConfigData:
    """Read and structurally validate a TOML/JSON config file."""
    try:
        with open(path, "rb") as handle:
            raw = handle.read()
    except OSError as exc:
        raise ConfigError(f"cannot read config file '{path}': {exc.strerror or 'unknown error'}") from exc
    text = raw.decode("utf-8", errors="replace")

    if path.endswith(".json"):
        data = _parse_json(text, path)
    else:
        data = _parse_toml(text, path)

    return _validate(data, text, path)


def build_rules(config_data: "ConfigData | None") -> "list[Rule]":
    """Instantiate every registered rule, applying overrides from the config.

    Disabled rules are skipped entirely (they never observe events).
    """
    overrides = {}
    if config_data is not None:
        overrides = {config.name: config for config in config_data.rules}
    rules: list[Rule] = []
    for name in sorted(RULE_REGISTRY):
        override = overrides.get(name, RuleConfig(name=name))
        if not override.enabled:
            continue
        rule = get_rule(name)()
        try:
            rule.configure(override)
        except ValueError as exc:
            raise ConfigError(
                f"rule '{name}': {exc}",
                file=config_data.path if config_data else None,
                line=_find_line(_read_source(config_data), name) if config_data else None,
            ) from exc
        rules.append(rule)
    return rules


def _parse_json(text: str, path: str) -> dict:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ConfigError(f"invalid JSON: {exc.msg}", file=path, line=exc.lineno) from exc
    if not isinstance(data, dict):
        raise ConfigError("config root must be an object", file=path, line=1)
    return data


def _parse_toml(text: str, path: str) -> dict:
    try:
        return tomllib.loads(text)
    except tomllib.TOMLDecodeError as exc:
        match = _TOML_LINE.search(str(exc))
        raise ConfigError(
            f"invalid TOML: {exc}", file=path, line=int(match.group(1)) if match else None
        ) from exc


def _validate(data: dict, text: str, path: str) -> ConfigData:
    for key in data:
        if key not in ALLOWED_TOP_KEYS:
            raise ConfigError(f"unknown section '[{key}]'", file=path, line=_find_line(text, key))

    config = ConfigData(path=path)

    parsers = data.get("parsers", {})
    if not isinstance(parsers, dict):
        raise ConfigError("[parsers] must be a table", file=path, line=_find_line(text, "parsers"))
    for key, value in parsers.items():
        if key not in ALLOWED_PARSER_KEYS:
            raise ConfigError(f"unknown parser option '{key}'", file=path, line=_find_line(text, key))
        if key == "extra_patterns":
            if not isinstance(value, list) or not all(isinstance(p, str) for p in value):
                raise ConfigError(
                    "extra_patterns must be a list of regex strings",
                    file=path,
                    line=_find_line(text, "extra_patterns"),
                )
            config.extra_patterns = list(value)

    rules = data.get("rules", {})
    if not isinstance(rules, dict):
        raise ConfigError("[rules] must be a table", file=path, line=_find_line(text, "rules"))
    for name, params in rules.items():
        line = _find_line(text, name)
        if name not in RULE_REGISTRY:
            raise ConfigError(f"unknown rule '{name}'", file=path, line=line)
        if not isinstance(params, dict):
            raise ConfigError(f"rule '{name}' must be a table", file=path, line=line)
        for param_key in params:
            if param_key == "enabled":
                if not isinstance(params[param_key], bool):
                    raise ConfigError(
                        f"rule '{name}': enabled must be true or false",
                        file=path,
                        line=_find_line(text, param_key),
                    )
        config.rules.append(RuleConfig(name=name, enabled=params.get("enabled", True), params={
            k: v for k, v in params.items() if k != "enabled"
        }))
    return config


def _find_line(text: str, needle: str) -> int | None:
    """Best-effort location of *needle* in the config text (1-based line)."""
    for number, line in enumerate(text.splitlines(), start=1):
        if needle in line:
            return number
    return None


def _read_source(config_data: "ConfigData | None") -> str | None:
    if config_data is None:
        return None
    try:
        with open(config_data.path, encoding="utf-8", errors="replace") as handle:
            return handle.read()
    except OSError:  # pragma: no cover - file was readable moments earlier
        return None
