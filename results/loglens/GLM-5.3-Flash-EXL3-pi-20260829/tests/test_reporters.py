"""Reporter tests: terminal, JSON, self-contained HTML with SVG sparkline."""

from __future__ import annotations

import json

from loglens.models.incident import Incident
from loglens.models.report import ErrorRatePoint, Report, TimeRange, TopMessage
from loglens.reporters.html_report import render_html, sparkline_svg, write_html
from loglens.reporters.json_report import render_json
from loglens.reporters.terminal import render_terminal
from tests.conftest import BASE_TIME


def sample_report() -> Report:
    incident = Incident(
        rule="error_rate_spike", severity="critical",
        first_seen=BASE_TIME, last_seen=BASE_TIME,
        event_ids=[1, 2, 3], summary="30% error rate", suggested_action="Check upstream.",
    )
    return Report(
        generated_at=BASE_TIME,
        sources=["app.log"],
        total_events=100,
        unknown_events=2,
        level_counts={"INFO": 80, "ERROR": 18, "UNKNOWN": 2},
        time_range=TimeRange(first=BASE_TIME, last=BASE_TIME),
        health_score=42,
        incidents=[incident],
        error_rate_series=[ErrorRatePoint(bucket_start=BASE_TIME, total=100, errors=30)],
        top_messages=[TopMessage(message="Request handled", count=50, level="INFO")],
    )


class TestTerminal:
    def test_renders_summary_and_incidents(self):
        text = render_terminal(sample_report())
        assert "42/100" in text
        assert "error_rate_spike" in text
        assert "Request handled" in text

    def test_empty_report_says_no_incidents(self):
        report = sample_report()
        report.incidents = []
        assert "No incidents detected" in render_terminal(report)


class TestJson:
    def test_round_trips_report_data(self):
        rendered = json.loads(render_json(sample_report()))
        assert rendered["total_events"] == 100
        assert rendered["health_score"] == 42
        assert rendered["incidents"][0]["rule"] == "error_rate_spike"
        assert rendered["time_range"]["first"].startswith("2026-01-15")

    def test_unknown_events_counted(self):
        assert json.loads(render_json(sample_report()))["unknown_events"] == 2


class TestHtml:
    def test_single_selfcontained_file(self, tmp_path):
        path = write_html(sample_report(), tmp_path / "report.html")
        html = path.read_text(encoding="utf-8")
        assert "cdn" not in html.lower()
        assert "http://" not in html and "https://" not in html
        assert "<style>" in html
        assert "<svg" in html  # inline sparkline
        assert "30% error rate" in html

    def test_sparkline_renders_points(self):
        svg = sparkline_svg([(0, 0.1), (60, 0.5), (120, 0.9)])
        assert "<polyline" in svg
        assert "aria-label" in svg

    def test_sparkline_empty_series(self):
        assert "<svg" in sparkline_svg([])

    def test_incident_table_and_top_messages(self, tmp_path):
        html = render_html(sample_report())
        assert "error_rate_spike" in html
        assert "Request handled" in html
        assert "Check upstream." in html

    def test_creates_parent_directories(self, tmp_path):
        path = write_html(sample_report(), tmp_path / "deep" / "nested" / "report.html")
        assert path.is_file()
