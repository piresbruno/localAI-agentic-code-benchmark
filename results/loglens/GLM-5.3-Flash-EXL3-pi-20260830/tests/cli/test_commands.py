"""CLI integration tests via typer's CliRunner (exit codes, help, files)."""

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from loglens.cli.app import app

runner = CliRunner()

SAMPLE_TEXT = "\n".join(
    [
        "2026-01-15 08:00:00,000 INFO [api] service started",
        "2026-01-15 08:00:01,000 INFO [api] request ok",
        "this line is garbage",
    ]
)


@pytest.fixture()
def log_file(tmp_path: Path) -> Path:
    path = tmp_path / "app.log"
    path.write_text(SAMPLE_TEXT, encoding="utf-8")
    return path


class TestHelp:
    def test_top_level_help_lists_commands(self):
        result = runner.invoke(app, ["--help"])
        assert result.exit_code == 0
        for command in ("parse", "report", "watch", "sample"):
            assert command in result.output

    def test_every_command_documents_its_options(self):
        for command in ("parse", "report", "watch", "sample"):
            result = runner.invoke(app, [command, "--help"])
            assert result.exit_code == 0, command
            assert "Usage" in result.output, command

    def test_version_flag(self):
        result = runner.invoke(app, ["--version"])
        assert result.exit_code == 0
        assert "loglens" in result.output


class TestParseCommand:
    def test_table_output(self, log_file: Path):
        result = runner.invoke(app, ["parse", str(log_file)])
        assert result.exit_code == 0
        assert "Parsed events" in result.output
        assert "service started" in result.output

    def test_json_output(self, log_file: Path):
        result = runner.invoke(app, ["parse", str(log_file), "--format", "json"])
        assert result.exit_code == 0
        payload = json.loads(result.output)
        assert len(payload) == 3
        assert payload[2]["level"] == "UNKNOWN"
        assert "parse_error" in payload[2]["attributes"]

    def test_limit_option(self, log_file: Path):
        result = runner.invoke(app, ["parse", str(log_file), "--limit", "1"])
        assert result.exit_code == 0
        assert "service started" in result.output
        assert "request ok" not in result.output

    def test_missing_file_exit_3(self, tmp_path: Path):
        result = runner.invoke(app, ["parse", str(tmp_path / "absent.log")])
        assert result.exit_code == 3
        assert "error" in result.output.lower()

    def test_bad_since_exit_2(self, log_file: Path):
        result = runner.invoke(app, ["parse", str(log_file), "--since", "whenever"])
        assert result.exit_code == 2

    def test_bad_format_exit_2(self, log_file: Path):
        result = runner.invoke(app, ["parse", str(log_file), "--format", "yaml"])
        assert result.exit_code == 2

    def test_stdin_input(self):
        result = runner.invoke(app, ["parse", "-"], input=SAMPLE_TEXT)
        assert result.exit_code == 0
        assert "service started" in result.output


class TestReportCommand:
    def test_terminal_report_exit_zero(self, log_file: Path):
        result = runner.invoke(app, ["report", str(log_file)])
        assert result.exit_code == 0
        assert "Health score" in result.output

    def test_json_report_stdout(self, log_file: Path):
        result = runner.invoke(app, ["report", str(log_file), "--format", "json"])
        assert result.exit_code == 0
        payload = json.loads(result.output)
        assert payload["events_total"] == 3
        assert payload["parse_errors"] == 1

    def test_html_report_writes_file(self, log_file: Path, tmp_path: Path):
        out = tmp_path / "r.html"
        result = runner.invoke(app, ["report", str(log_file), "--format", "html", "--out", str(out)])
        assert result.exit_code == 0
        html = out.read_text(encoding="utf-8")
        assert "<svg" in html and "<style>" in html

    def test_html_default_out_path(self, log_file: Path, tmp_path: Path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        result = runner.invoke(app, ["report", str(log_file), "--format", "html"])
        assert result.exit_code == 0
        assert (tmp_path / "report.html").exists()

    def test_multiple_inputs_and_glob(self, tmp_path: Path, log_file: Path):
        second = tmp_path / "app.jsonl"
        second.write_text('{"ts": "2026-01-15T08:05:00Z", "level": "INFO", "msg": "from json"}\n', encoding="utf-8")
        result = runner.invoke(app, ["report", str(tmp_path / "app.*"), "--format", "json"])
        assert result.exit_code == 0
        payload = json.loads(result.output)
        assert payload["events_total"] == 4

    def test_glob_without_matches_exit_3(self, tmp_path: Path):
        result = runner.invoke(app, ["report", str(tmp_path / "none-*.log")])
        assert result.exit_code == 3

    def test_critical_incident_exit_1(self, tmp_path: Path):
        path = tmp_path / "critical.log"
        lines = [f"2026-01-15 08:{m:02d}:{s:02d},000 ERROR [api] boom" for m in range(5) for s in range(0, 60, 6)]
        path.write_text("\n".join(lines), encoding="utf-8")  # 50 errors/5m → 100% spike → critical
        result = runner.invoke(app, ["report", str(path), "--format", "json"])
        assert result.exit_code == 1

    def test_config_disabling_rules(self, log_file: Path, tmp_path: Path):
        config = tmp_path / "c.toml"
        config.write_text("[rules.burst]\nenabled = false\n", encoding="utf-8")
        result = runner.invoke(app, ["report", str(log_file), "--config", str(config), "--format", "json"])
        assert result.exit_code == 0
        payload = json.loads(result.output)
        assert all(i["rule"] != "burst" for i in payload["incidents"])

    def test_invalid_config_exit_2_with_file_and_line(self, log_file: Path, tmp_path: Path):
        config = tmp_path / "c.toml"
        config.write_text('[rules.bogus_rule]\nwindow = "5m"\n', encoding="utf-8")
        result = runner.invoke(app, ["report", str(log_file), "--config", str(config)])
        assert result.exit_code == 2
        assert "bogus_rule" in result.output

    def test_since_until_filtering(self, tmp_path: Path):
        path = tmp_path / "window.log"
        path.write_text(
            "2026-01-15 08:00:00,000 INFO [api] early\n"
            "2026-01-15 08:30:00,000 INFO [api] within\n"
            "2026-01-15 09:00:00,000 INFO [api] late\n",
            encoding="utf-8",
        )
        result = runner.invoke(
            app,
            [
                "report", str(path), "--format", "json",
                "--since", "2026-01-15T08:29:00Z", "--until", "2026-01-15T08:31:00Z",
            ],
        )
        assert result.exit_code == 0
        payload = json.loads(result.output)
        assert payload["events_total"] == 1
        assert payload["first_timestamp"].startswith("2026-01-15T08:30")


class TestWatchCommand:
    def test_runs_n_times_then_exits(self, log_file: Path, monkeypatch):
        monkeypatch.setattr("time.sleep", lambda seconds: None)
        result = runner.invoke(app, ["watch", str(log_file), "--interval", "0.1", "--max-runs", "3"])
        assert result.exit_code == 0
        assert result.output.count("Health score") == 3

    def test_watch_rejects_stdin(self):
        result = runner.invoke(app, ["watch", "-", "--max-runs", "1"])
        assert result.exit_code == 2

    def test_watch_reports_critical_exit_1(self, tmp_path: Path, monkeypatch):
        monkeypatch.setattr("time.sleep", lambda seconds: None)
        path = tmp_path / "critical.log"
        lines = [f"2026-01-15 08:{m:02d}:{s:02d},000 ERROR [api] boom" for m in range(5) for s in range(0, 60, 6)]
        path.write_text("\n".join(lines), encoding="utf-8")
        result = runner.invoke(app, ["watch", str(path), "--max-runs", "1"])
        assert result.exit_code == 1


class TestSampleCommand:
    def test_writes_demo_logs(self, tmp_path: Path):
        result = runner.invoke(app, ["sample", "--events", "400", "--dir", str(tmp_path / "s")])
        assert result.exit_code == 0
        assert (tmp_path / "s" / "app.log").exists()
        assert (tmp_path / "s" / "app.jsonl").exists()
        assert "planted" in result.output

    def test_unwritable_dir_exit_3(self):
        result = runner.invoke(app, ["sample", "--dir", "/proc/definitely/not/writable"])
        assert result.exit_code == 3
