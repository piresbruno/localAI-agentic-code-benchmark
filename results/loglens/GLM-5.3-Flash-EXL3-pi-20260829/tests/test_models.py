"""Unit tests for the pydantic models (LogEvent, Incident, Report, RuleConfig)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from loglens.models.config import RuleConfig, RuleSettings, load_config
from loglens.models.errors import ConfigError
from loglens.models.event import LogEvent
from loglens.models.incident import Incident
from loglens.models.report import Report


class TestLogEvent:
    def test_defaults(self, clock):
        event = LogEvent(timestamp=clock(), source="x.log")
        assert event.level == "UNKNOWN"
        assert event.attributes == {}
        assert event.logger is None

    def test_is_error_matches_error_and_critical(self, clock):
        assert LogEvent(timestamp=clock(), level="ERROR").is_error
        assert LogEvent(timestamp=clock(), level="CRITICAL").is_error
        assert not LogEvent(timestamp=clock(), level="INFO").is_error

    def test_unknown_factory_sets_parse_error_attribute(self, clock):
        event = LogEvent.unknown("stdin", "garbage!!!", "no pattern matched", clock)
        assert event.level == "UNKNOWN"
        assert event.attributes["parse_error"] == "no pattern matched"
        assert event.raw == "garbage!!!"
        assert event.source == "stdin"

    def test_unknown_property(self, clock):
        assert LogEvent(timestamp=clock(), level="UNKNOWN").is_unknown
        assert not LogEvent(timestamp=clock(), level="INFO").is_unknown


class TestIncident:
    def test_critical_flag(self, clock):
        incident = Incident(
            rule="r", severity="critical", first_seen=clock(), last_seen=clock(),
            event_ids=[1], summary="s", suggested_action="a",
        )
        assert incident.is_critical

    def test_requires_severity_value(self, clock):
        with pytest.raises(ValidationError):
            Incident(rule="r", severity="boom", first_seen=clock(), last_seen=clock())


class TestReport:
    def test_defaults(self, clock):
        report = Report(generated_at=clock())
        assert report.health_score == 100
        assert not report.has_critical
        assert report.total_events == 0

    def test_has_critical_reflects_incidents(self, clock):
        incident = Incident(
            rule="r", severity="critical", first_seen=clock(), last_seen=clock(),
            event_ids=[1], summary="s", suggested_action="a",
        )
        assert Report(generated_at=clock(), incidents=[incident]).has_critical


class TestRuleConfig:
    def test_defaults_enable_everything(self):
        config = RuleConfig()
        assert config.is_enabled("burst")
        assert config.settings_for("burst").min_events is None

    def test_settings_roundtrip(self):
        settings = RuleSettings(threshold=0.5, enabled=False)
        config = RuleConfig(rules={"error_rate_spike": settings})
        assert not config.is_enabled("error_rate_spike")
        assert config.settings_for("error_rate_spike").threshold == 0.5
        # Other rules unaffected.
        assert config.is_enabled("burst")

    def test_rejects_unknown_fields(self):
        with pytest.raises(ValidationError):
            RuleSettings(nonsense=1)


class TestLoadConfig:
    def test_loads_valid_toml(self, tmp_path):
        config_file = tmp_path / "loglens.toml"
        config_file.write_text(
            '[rules.error_rate_spike]\nthreshold = 0.25\n\n[rules.burst]\nenabled = false\n',
            encoding="utf-8",
        )
        config = load_config(config_file)
        assert config.settings_for("error_rate_spike").threshold == 0.25
        assert not config.is_enabled("burst")

    def test_missing_file_is_clean_error(self, tmp_path):
        with pytest.raises(ConfigError, match="not found"):
            load_config(tmp_path / "nope.toml")

    def test_invalid_toml_reports_file_and_line(self, tmp_path):
        config_file = tmp_path / "broken.toml"
        config_file.write_text("this is [ not toml", encoding="utf-8")
        with pytest.raises(ConfigError) as excinfo:
            load_config(config_file)
        assert "broken.toml" in str(excinfo.value)

    def test_missing_rules_section(self, tmp_path):
        config_file = tmp_path / "empty.toml"
        config_file.write_text("x = 1\n", encoding="utf-8")
        with pytest.raises(ConfigError, match=r"\[rules\]"):
            load_config(config_file)

    def test_unknown_rule_name_is_rejected(self, tmp_path):
        config_file = tmp_path / "unknown.toml"
        config_file.write_text('[rules.nonsense_rule]\nenabled = true\n', encoding="utf-8")
        with pytest.raises(ConfigError, match="unknown rule 'nonsense_rule'"):
            load_config(config_file)

    def test_invalid_settings_value_is_rejected(self, tmp_path):
        config_file = tmp_path / "bad.toml"
        config_file.write_text('[rules.burst]\nmin_events = "fifty"\n', encoding="utf-8")
        with pytest.raises(ConfigError, match="burst"):
            load_config(config_file)
