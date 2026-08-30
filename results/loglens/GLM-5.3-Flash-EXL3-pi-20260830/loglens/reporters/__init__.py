"""Reporters: terminal (rich), JSON, and self-contained HTML."""

from loglens.reporters.base import REPORTER_REGISTRY, Reporter, get_reporter, register_reporter
from loglens.reporters.html_report import render_html, sparkline_svg
from loglens.reporters.json_report import render_json
from loglens.reporters.terminal import render_terminal

__all__ = [
    "REPORTER_REGISTRY",
    "Reporter",
    "get_reporter",
    "register_reporter",
    "render_html",
    "render_json",
    "render_terminal",
    "sparkline_svg",
]
