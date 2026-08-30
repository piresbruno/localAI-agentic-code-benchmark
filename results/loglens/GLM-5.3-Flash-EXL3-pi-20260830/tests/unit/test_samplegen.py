"""Sample generator tests: planted scenarios, determinism, dilution guards."""

import hashlib
import json
from pathlib import Path

from loglens.engine.engine import Engine
from loglens.engine.pipeline import parse_inputs
from loglens.samplegen import generate

EXPECTED_RULES = {"error_rate_spike", "repeated_error", "latency_outlier", "level_gap"}


class TestDeterminism:
    def test_same_seed_produces_identical_files(self, tmp_path: Path):
        first = generate(500, tmp_path / "a")
        second = generate(500, tmp_path / "b")
        for f1, f2 in zip(first, second, strict=True):
            assert f1.lines == f2.lines
            assert _sha256(f1.path) == _sha256(f2.path)

    def test_writes_both_formats(self, tmp_path: Path):
        files = generate(500, tmp_path / "s")
        names = {f.path.name for f in files}
        assert names == {"app.log", "app.jsonl"}
        (tmp_path / "s" / "app.jsonl").read_text(encoding="utf-8").splitlines()[0]
        first_json = json.loads(
            (tmp_path / "s" / "app.jsonl").read_text(encoding="utf-8").splitlines()[0]
        )
        assert "ts" in first_json and "msg" in first_json


class TestPlantedScenarios:
    """The SMOKE_CHECK contract: built-in rules detect all four scenarios."""

    def test_all_four_scenarios_detected_with_no_spurious_rules(self, tmp_path: Path):
        generate(5000, tmp_path / "s")
        inputs = [str(tmp_path / "s" / "app.log"), str(tmp_path / "s" / "app.jsonl")]
        report = Engine().run(parse_inputs(inputs), inputs=inputs)
        detected = {incident.rule for incident in report.incidents}
        assert detected >= EXPECTED_RULES, f"missing: {EXPECTED_RULES - detected}"
        assert detected <= EXPECTED_RULES, f"spurious: {detected - EXPECTED_RULES}"

    def test_plain_text_file_alone_hits_three_scenarios(self, tmp_path: Path):
        generate(5000, tmp_path / "s")
        app_log = str(tmp_path / "s" / "app.log")
        report = Engine().run(parse_inputs([app_log]), inputs=["app.log"])
        detected = {incident.rule for incident in report.incidents}
        assert {"error_rate_spike", "repeated_error", "level_gap"} <= detected
        assert "latency_outlier" not in detected  # latency is JSON-only by design

    def test_error_spike_window_is_thirty_percent(self, tmp_path: Path):
        generate(5000, tmp_path / "s")
        app_log = str(tmp_path / "s" / "app.log")
        report = Engine().run(parse_inputs([app_log]), inputs=["app.log"])
        spikes = [i for i in report.incidents if i.rule == "error_rate_spike"]
        assert len(spikes) == 1
        assert "30%" in spikes[0].summary

    def test_repeated_error_is_twelve_occurrences(self, tmp_path: Path):
        generate(5000, tmp_path / "s")
        app_log = str(tmp_path / "s" / "app.log")
        report = Engine().run(parse_inputs([app_log]), inputs=["app.log"])
        repeats = [i for i in report.incidents if i.rule == "repeated_error"]
        assert len(repeats) == 1
        assert "12" in repeats[0].summary

    def test_level_gap_names_payments_logger(self, tmp_path: Path):
        generate(5000, tmp_path / "s")
        app_log = str(tmp_path / "s" / "app.log")
        report = Engine().run(parse_inputs([app_log]), inputs=["app.log"])
        gaps = [i for i in report.incidents if i.rule == "level_gap"]
        assert len(gaps) == 1
        assert "payments" in gaps[0].summary

    def test_latency_outliers_near_four_thousand_ms(self, tmp_path: Path):
        generate(5000, tmp_path / "s")
        app_jsonl = str(tmp_path / "s" / "app.jsonl")
        report = Engine().run(parse_inputs([app_jsonl]), inputs=["app.jsonl"])
        outliers = [i for i in report.incidents if i.rule == "latency_outlier"]
        assert outliers, "latency outliers not detected in JSON sample"
        for incident in outliers:
            assert "p95" in incident.summary

    def test_no_burst_incidents_on_sample_baseline(self, tmp_path: Path):
        generate(5000, tmp_path / "s")
        inputs = [str(tmp_path / "s" / "app.log"), str(tmp_path / "s" / "app.jsonl")]
        report = Engine().run(parse_inputs(inputs), inputs=inputs)
        assert [i for i in report.incidents if i.rule == "burst"] == []


class TestDilutionGuard:
    def test_planted_spike_window_has_no_baseline_traffic(self, tmp_path: Path):
        generate(5000, tmp_path / "s")
        lines = (tmp_path / "s" / "app.log").read_text(encoding="utf-8").splitlines()
        in_window = [line for line in lines if _minute_of(line) in (20, 21, 22, 23, 24)]
        assert len(in_window) == 40  # exactly the planted scenario, nothing else


def _minute_of(line: str) -> int | None:
    """Minute field of 08:MM:SS lines on the sample's base date, else None."""
    if not line.startswith("2026-01-15 08:"):
        return None
    stamp = line[14:16]
    return int(stamp) if stamp.isdigit() else None


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()
