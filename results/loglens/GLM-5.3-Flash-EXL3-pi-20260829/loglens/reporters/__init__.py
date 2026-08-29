"""Reporters: terminal (rich), JSON, HTML (self-contained)."""

from loglens.reporters.html_report import render_html, write_html
from loglens.reporters.json_report import render_json
from loglens.reporters.terminal import render_terminal

__all__ = ["render_terminal", "render_json", "render_html", "write_html"]
