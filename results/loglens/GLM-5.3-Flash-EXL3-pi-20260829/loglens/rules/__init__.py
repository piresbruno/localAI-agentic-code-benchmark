"""Rules: plugin detections evaluated over event windows."""

from loglens.rules.base import Rule, make_incident, resolved
from loglens.rules.burst import BurstRule
from loglens.rules.error_rate_spike import ErrorRateSpikeRule
from loglens.rules.latency_outlier import LatencyOutlierRule
from loglens.rules.level_gap import LevelGapRule
from loglens.rules.registry import BUILTIN_REGISTRY, RuleRegistry
from loglens.rules.message_template import normalize_message
from loglens.rules.repeated_error import RepeatedErrorRule

__all__ = [
    "Rule",
    "RuleRegistry",
    "BUILTIN_REGISTRY",
    "ErrorRateSpikeRule",
    "RepeatedErrorRule",
    "LatencyOutlierRule",
    "BurstRule",
    "LevelGapRule",
    "make_incident",
    "resolved",
    "normalize_message",
]
