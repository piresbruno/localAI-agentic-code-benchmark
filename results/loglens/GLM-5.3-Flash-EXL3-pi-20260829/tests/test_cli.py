"""CLI integration tests via typer.testing.CliRunner: exit codes, help, file output, config errors."""

from __future__ import annotations

import json

import pytest
from typer.testing import CliRunner

from loglens.cli.app import app

runner = CliRunner()


@pytest.fixture
def sample_logs(tmp_path):
    """Small JSON-lines log with a planted critical + plain-text companion."""
    import sys
    from datetime import UTC, datetime, timedelta

    sys.path.insert(0, str(tmp_path))  # no-op; keeps flake quiet
    base = datetime(2026, 1, 15, 8, 0, 0, tzinfo=UTC)
    app_log = tmp_path / "app.log"
    lines = []
    # 30% error rate window (5 min, ≥20 events)
    for i in range(30):
        minute = 0 + i * (5 / 30)
        level = "ERROR" if i % 10 < 3 else "INFO"
        lines.append(json.dumps({
            "ts": (base + timedelta(minutes=minute)).isoformat(),
            "level": level, "msg": f"tick {i}", "logger": "orders",
        }))
    # repeated connection error
    for i in range(6):
        lines.append(json.dumps({
            "ts": (base + timedelta(minutes=10 + i * 0.2)).isoformat(),
            "level": "ERROR", "msg": "Connection refused to db-1", "logger": "db",
        }))
    app_log.write_text("\n".join(lines) + "\n", encoding="utf-8")

    text_log = tmp_path / "web.log"
    text_log.write_text("\n".join(
        f"{(base + timedelta(minutes=i)).strftime('%Y-%m-%d %H:%M:%S,%f')[:-3]} INFO [web] serving page {i}"
        for i in range(10)
    ) + "\n", encoding="utf-8")
    return app_log, text_log


class TestHelp:
    def test_app_help_lists_commands(self):
        result = runner.invoke(app, ["--help"])
        assert result.exit_code == 0
        for command in ("parse", "report", "watch", "sample"):
            assert command in result.output

    @pytest.mark.parametrize("command", ["parse", "report", "watch", "sample"])
    def test_every_command_has_help(self, command):
        result = runner.invoke(app, [command, "--help"])
        assert result.exit_code == 0
        assert "Usage" in result.output


class TestParse:
    def test_parse_table_output(self, sample_logs):
        app_log, _ = sample_logs
        result = runner.invoke(app, ["parse", str(app_log), "--limit", "5"])
        assert result.exit_code == 0
        assert "INFO" in result.output

    def test_parse_json_output(self, sample_logs):
        app_log, _ = sample_logs
        result = runner.invoke(app, ["parse", str(app_log), "--format", "json", "--limit", "3"])
        assert result.exit_code == 0
        events = json.loads(result.output)
        assert len(events) == 3
        assert events[0]["level"] in ("INFO", "ERROR")

    def test_parse_missing_file_exit_3(self, tmp_path):
        result = runner.invoke(app, ["parse", str(tmp_path / "ghost.log")])
        assert result.exit_code == 3

    def test_parse_bad_since_exit_2(self, sample_logs):
        app_log, _ = sample_logs
        result = runner.invoke(app, ["parse", str(app_log), "--since", "not-a-time"])
        assert result.exit_code == 2


class TestReport:
    def test_report_terminal_ok(self, sample_logs):
        app_log, _ = sample_logs
        result = runner.invoke(app, ["report", str(app_log)])
        assert result.exit_code in (0, 1)
        assert "Health score" in result.output

    def test_report_critical_exit_1(self, sample_logs):
        app_log, _ = sample_logs
        result = runner.invoke(app, ["report", str(app_log)])
        # 30% error rate window plants a critical incident.
        assert "error_rate_spike" in result.output
        assert result.exit_code == 1

    def test_report_json(self, sample_logs):
        app_log, _ = sample_logs
        result = runner.invoke(app, ["report", str(app_log), "--format", "json"])
        payload = json.loads(result.output)
        assert payload["total_events"] == 36
        assert payload["incidents"]

    def test_report_html_creates_selfcontained_file(self, sample_logs, tmp_path):
        app_log, _ = sample_logs
        out = tmp_path / "out" / "report.html"
        runner.invoke(app, ["report", str(app_log), "--out", str(out)])
        assert out.is_file()
        html = out.read_text(encoding="utf-8")
        assert "<style>" in html and "<svg" in html

    def test_report_multiple_inputs_and_glob(self, sample_logs, tmp_path):
        app_log, text_log = sample_logs
        result = runner.invoke(app, ["report", str(app_log), str(text_log), "--format", "json"])
        payload = json.loads(result.output)
        assert set(payload["sources"]) == {str(app_log), str(text_log)}

    def test_report_unknown_format_exit_2(self, sample_logs):
        app_log, _ = sample_logs
        result = runner.invoke(app, ["report", str(app_log), "--format", "yaml"])
        assert result.exit_code == 2

    def test_report_missing_input_exit_3(self, tmp_path):
        result = runner.invoke(app, ["report", str(tmp_path / "ghost.log"), "--format", "json"])
        assert result.exit_code == 3

    def test_report_config_error_exit_2(self, sample_logs, tmp_path):
        app_log, _ = sample_logs
        bad = tmp_path / "bad.toml"
        bad.write_text("[rules.nope]\nenabled = true\n", encoding="utf-8")
        result = runner.invoke(app, ["report", str(app_log), "--format", "json", "--config", str(bad)])
        assert result.exit_code == 2
        assert "unknown rule" in result.output

    def test_report_valid_config_applied(self, sample_logs, tmp_path):
        app_log, _ = sample_logs
        config = tmp_path / "rules.toml"
        config.write_text(
            "[rules.error_rate_spike]\nenabled = false\n\n[rules.repeated_error]\nenabled = false\n",
            encoding="utf-8",
        )
        result = runner.invoke(app, ["report", str(app_log), "--format", "json", "--config", str(config)])
        payload = json.loads(result.output)
        assert payload["incidents"] == []

    def test_report_since_narrows_window(self, sample_logs):
        app_log, _ = sample_logs
        result = runner.invoke(app, ["report", str(app_log), "--format", "json", "--since", "2026-01-15T08:10:00"])
        payload = json.loads(result.output)
        assert payload["time_range"]["first"].startswith("2026-01-15T08:10")


class TestSample:
    def test_sample_writes_files(self, tmp_path):
        result = runner.invoke(app, ["sample", "--events", "200", "--dir", str(tmp_path / "samples")])
        assert result.exit_code == 0
        assert (tmp_path / "samples" / "app.log").is_file()
        assert (tmp_path / "samples" / "web.log").is_file()

    def test_generated_sample_reproduces_planted_incidents(self, tmp_path):
        """SMOKE_CHECK: the built-in rules must detect the 4 planted scenarios."""
        sample_dir = tmp_path / "samples"
        assert runner.invoke(app, ["sample", "--events", "2000", "--dir", str(sample_dir)]).exit_code == 0
        result = runner.invoke(app, ["report", str(sample_dir / "app.log"), "--format", "json"])
        payload = json.loads(result.output)
        rules = {incident["rule"] for incident in payload["incidents"]}
        assert "error_rate_spike" in rules   # scenario 1
        assert "repeated_error" in rules     # scenario 2
        assert "latency_outlier" in rules    # scenario 3
        assert "level_gap" in rules          # scenario 4


class TestWatch:
    def test_watch_reports_then_stops(self, sample_logs, monkeypatch):
        app_log, _ = sample_logs
        monkeypatch.setattr("time.sleep", lambda seconds: (_ for _ in ()).throw(KeyboardInterrupt()))
        result = runner.invoke(app, ["watch", str(app_log), "--interval", "1"])
        assert result.exit_code == 0
        assert "Health score" in result.output

    def test_watch_missing_file_exit_3(self, tmp_path):
        result = runner.invoke(app, ["watch", str(tmp_path / "ghost.log")])
        assert result.exit_code == 3
