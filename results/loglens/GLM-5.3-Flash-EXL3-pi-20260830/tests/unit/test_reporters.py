"""Reporter tests: registry, JSON round-trip, self-contained HTML, terminal."""

import io
import json

import pytest

from loglens.models import ErrorRatePoint, Incident, Report, Severity
from loglens.reporters import REPORTER_REGISTRY, sparkline_svg
from loglens.reporters.base import get_reporter
from loglens.reporters.terminal import render_terminal
from tests.unit.helpers import BASE


def sample_report() -> Report:
    return Report(
        generated_at=BASE + timedelta_hours(1),
        inputs=["samples/app.log"],
        events_total=120,
        parse_errors=3,
        level_counts={"INFO": 100, "ERROR": 17, "UNKNOWN": 3},
        first_timestamp=BASE,
        last_timestamp=BASE + timedelta_hours(1),
        health_score=64,
        incidents=[
            Incident(
                rule="error_rate_spike",
                severity=Severity.WARN,
                first_timestamp=BASE,
                last_timestamp=BASE + timedelta_hours(1),
                event_ids=[f"e{i}" for i in range(12)],
                summary="Error rate spiked to 30% (12/40 events)",
                suggested_action="Inspect failing components.",
            )
        ],
        top_messages=[],
        error_rate_series=[
            ErrorRatePoint(bucket_start=BASE, total=40, errors=12, ratio=0.3),
            ErrorRatePoint(
                bucket_start=BASE + timedelta_hours(1), total=80, errors=5, ratio=0.0625
            ),
        ],
    )


def timedelta_hours(hours: float):
    from datetime import timedelta

    return timedelta(hours=hours)


class TestRegistry:
    def test_builtin_reporters_registered(self):
        assert {"terminal", "json", "html"} <= set(REPORTER_REGISTRY)

    def test_unknown_format_raises(self):
        with pytest.raises(ValueError, match="unknown report format"):
            get_reporter("pdf")


class TestJsonReporter:
    def test_round_trips_to_stdout(self, capsys):
        get_reporter("json")(sample_report(), None)
        payload = json.loads(capsys.readouterr().out)
        assert payload["events_total"] == 120
        assert payload["health_score"] == 64
        assert payload["incidents"][0]["rule"] == "error_rate_spike"

    def test_writes_to_stream(self):
        buffer = io.StringIO()
        get_reporter("json")(sample_report(), buffer)
        payload = json.loads(buffer.getvalue())
        assert payload["parse_errors"] == 3


class TestHtmlReporter:
    def test_writes_self_contained_file(self, tmp_path):
        out_path = tmp_path / "report.html"
        with out_path.open("w", encoding="utf-8") as handle:
            get_reporter("html")(sample_report(), handle)
        html = out_path.read_text(encoding="utf-8")
        assert "<style>" in html  # CSS is inline
        assert "<svg" in html and "spark-line" in html  # sparkline is inline SVG
        assert "Error rate spiked to 30%" in html
        assert "LogLens report" in html

    def test_no_external_resources(self, tmp_path):
        out_path = tmp_path / "report.html"
        with out_path.open("w", encoding="utf-8") as handle:
            get_reporter("html")(sample_report(), handle)
        html = out_path.read_text(encoding="utf-8")
        external = [
            token for token in html.split('"') if token.startswith("http") and "w3.org" not in token
        ]
        assert external == []

    def test_incident_summary_is_html_escaped(self, tmp_path):
        report = sample_report()
        report.incidents[0].summary = "bad <script>alert(1)</script> stuff"
        out_path = tmp_path / "report.html"
        with out_path.open("w", encoding="utf-8") as handle:
            get_reporter("html")(report, handle)
        html = out_path.read_text(encoding="utf-8")
        assert "<script>alert(1)</script>" not in html
        assert "&lt;script&gt;" in html


class TestSparkline:
    def test_empty_series_renders_flat_line(self):
        svg = sparkline_svg([])
        assert "M 4," in svg

    def test_two_points_render_line_and_area(self):
        svg = sparkline_svg(sample_report().error_rate_series)
        assert "spark-line" in svg and "spark-area" in svg


class TestTerminalReporter:
    def test_prints_summary_and_incidents(self, capsys):
        render_terminal(sample_report(), None)
        output = capsys.readouterr().out
        assert "Health score" in output
        # Rich may wrap long cell text mid-word; assert on the stable prefix.
        assert "error_rate" in output
        assert "Incidents" in output

    def test_respects_output_stream(self):
        buffer = io.StringIO()
        render_terminal(sample_report(), buffer)
        assert "LogLens summary" in buffer.getvalue()
