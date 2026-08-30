"""Tests for TOML/JSON config loading with file+line errors."""

import pytest

from loglens.engine.config import build_rules, load_config
from loglens.errors import ConfigError
from loglens.rules.base import RULE_REGISTRY

TOML_OK = """
[rules.error_rate_spike]
threshold = 0.25
min_events = 30

[rules.burst]
enabled = false

[parsers]
extra_patterns = ["^(?P<ts>\\\\d{10})\\\\|(?P<level>\\\\w+)\\\\|(?P<message>.*)$"]
"""

JSON_OK = """
{"rules": {"error_rate_spike": {"threshold": 0.2}}, "parsers": {"extra_patterns": []}}
"""


class TestLoadConfig:
    def test_toml_overrides_and_disable(self, tmp_path):
        path = tmp_path / "loglens.toml"
        path.write_text(TOML_OK, encoding="utf-8")
        data = load_config(str(path))
        spike = next(c for c in data.rules if c.name == "error_rate_spike")
        assert spike.enabled is True
        assert spike.params["threshold"] == 0.25
        burst = next(c for c in data.rules if c.name == "burst")
        assert burst.enabled is False
        assert len(data.extra_patterns) == 1

    def test_json_config(self, tmp_path):
        path = tmp_path / "loglens.json"
        path.write_text(JSON_OK, encoding="utf-8")
        data = load_config(str(path))
        assert data.rules[0].params["threshold"] == 0.2

    def test_unknown_rule_reports_file_and_line(self, tmp_path):
        path = tmp_path / "bad.toml"
        path.write_text('[rules.nope]\nwindow = "5m"\n', encoding="utf-8")
        with pytest.raises(ConfigError) as excinfo:
            load_config(str(path))
        assert excinfo.value.file == str(path)
        assert excinfo.value.line == 1

    def test_unknown_section(self, tmp_path):
        path = tmp_path / "bad.toml"
        path.write_text("[mystery]\nkey = 1\n", encoding="utf-8")
        with pytest.raises(ConfigError, match="unknown section"):
            load_config(str(path))

    def test_invalid_toml_reports_line(self, tmp_path):
        path = tmp_path / "bad.toml"
        path.write_text("this is = not [toml\n", encoding="utf-8")
        with pytest.raises(ConfigError, match="invalid TOML"):
            load_config(str(path))

    def test_invalid_json_reports_line(self, tmp_path):
        path = tmp_path / "bad.json"
        path.write_text('{"rules": oops}\n', encoding="utf-8")
        with pytest.raises(ConfigError) as excinfo:
            load_config(str(path))
        assert excinfo.value.line == 1

    def test_missing_config_file_is_config_error(self, tmp_path):
        with pytest.raises(ConfigError, match="cannot read"):
            load_config(str(tmp_path / "absent.toml"))

    def test_non_bool_enabled_rejected(self, tmp_path):
        path = tmp_path / "bad.toml"
        path.write_text('[rules.burst]\nenabled = "yes"\n', encoding="utf-8")
        with pytest.raises(ConfigError, match="enabled"):
            load_config(str(path))


class TestBuildRules:
    def test_default_build_instantiates_all_registered_rules(self):
        rules = build_rules(None)
        assert sorted(r.name for r in rules) == sorted(RULE_REGISTRY)

    def test_disabled_rules_are_skipped(self, tmp_path):
        path = tmp_path / "loglens.toml"
        path.write_text(TOML_OK, encoding="utf-8")
        data = load_config(str(path))
        names = [r.name for r in build_rules(data)]
        assert "burst" not in names
        assert "error_rate_spike" in names

    def test_params_reach_the_rule(self, tmp_path):
        path = tmp_path / "loglens.toml"
        path.write_text(TOML_OK, encoding="utf-8")
        data = load_config(str(path))
        spike = next(r for r in build_rules(data) if r.name == "error_rate_spike")
        assert spike.threshold == 0.25
        assert spike.min_events == 30

    def test_bad_param_value_reports_file_and_line(self, tmp_path):
        path = tmp_path / "loglens.toml"
        path.write_text('[rules.burst]\nmin_events = "lots"\n', encoding="utf-8")
        data = load_config(str(path))
        with pytest.raises(ConfigError) as excinfo:
            build_rules(data)
        assert excinfo.value.file == str(path)
        assert excinfo.value.line == 1
