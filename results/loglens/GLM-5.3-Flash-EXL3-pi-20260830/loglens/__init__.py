"""LogLens: log analysis library — normalize, detect, report.

The library core is importable without the CLI::

    from loglens import Engine, JsonLinesParser
"""

from loglens.engine import (
    Engine,
    EventWindow,
    TimeFilter,
    build_rules,
    load_config,
    parse_time_filter,
)
from loglens.errors import ConfigError, InputError, LogLensError
from loglens.io import read_lines
from loglens.models import (
    PARSE_ERROR_ATTR,
    Incident,
    LogEvent,
    LogLevel,
    Report,
    RuleConfig,
    Severity,
)
from loglens.parsers import (
    JsonLinesParser,
    PlainTextParser,
    detect_format,
    register_parser,
)
from loglens.rules import (
    BurstRule,
    ErrorRateSpikeRule,
    LatencyOutlierRule,
    LevelGapRule,
    RepeatedErrorRule,
    normalize_message,
    register_rule,
)

__version__ = "1.0.0"

__all__ = [
    "PARSE_ERROR_ATTR",
    "BurstRule",
    "ConfigError",
    "Engine",
    "ErrorRateSpikeRule",
    "EventWindow",
    "Incident",
    "InputError",
    "JsonLinesParser",
    "LatencyOutlierRule",
    "LevelGapRule",
    "LogEvent",
    "LogLensError",
    "LogLevel",
    "PlainTextParser",
    "RepeatedErrorRule",
    "Report",
    "RuleConfig",
    "Severity",
    "TimeFilter",
    "build_rules",
    "detect_format",
    "load_config",
    "normalize_message",
    "parse_time_filter",
    "read_lines",
    "register_parser",
    "register_rule",
]
