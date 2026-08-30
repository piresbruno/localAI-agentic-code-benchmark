"""Rules: plugin protocol, registry, and the five built-in detectors."""

from loglens.rules.base import (
    RULE_REGISTRY,
    BaseRule,
    Rule,
    built_in_rule_names,
    create_default_rules,
    get_rule,
    humanize_duration,
    normalize_message,
    register_rule,
)
from loglens.rules.burst import BurstRule
from loglens.rules.error_rate_spike import ErrorRateSpikeRule
from loglens.rules.latency_outlier import LatencyOutlierRule
from loglens.rules.level_gap import LevelGapRule
from loglens.rules.repeated_error import RepeatedErrorRule

__all__ = [
    "RULE_REGISTRY",
    "BaseRule",
    "BurstRule",
    "ErrorRateSpikeRule",
    "LatencyOutlierRule",
    "LevelGapRule",
    "RepeatedErrorRule",
    "Rule",
    "built_in_rule_names",
    "create_default_rules",
    "get_rule",
    "humanize_duration",
    "normalize_message",
    "register_rule",
]
