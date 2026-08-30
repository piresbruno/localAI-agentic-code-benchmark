"""Pipeline tests: input specs → parsed event streams (format detection, mixing)."""

import io
import json
import sys
from pathlib import Path

from loglens.engine.pipeline import parse_inputs
from loglens.models import LogLevel

JSON_LINES = [
    '{"ts": "2026-01-15T08:00:00Z", "level": "INFO", "msg": "json one"}',
    '{"ts": "2026-01-15T08:00:01Z", "level": "WARN", "msg": "json two"}',
]
TEXT_LINES = [
    "2026-01-15 08:00:00,000 INFO [api] text one",
    "2026-01-15 08:00:01,000 ERROR [api] text two",
]


def write(tmp_path: Path, name: str, lines: list[str]) -> str:
    path = tmp_path / name
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return str(path)


class TestParseInputs:
    def test_detects_jsonl_file(self, tmp_path: Path):
        path = write(tmp_path, "a.jsonl", JSON_LINES)
        events = list(parse_inputs([path]))
        assert [e.message for e in events] == ["json one", "json two"]
        assert events[0].level is LogLevel.INFO

    def test_detects_text_file(self, tmp_path: Path):
        path = write(tmp_path, "b.log", TEXT_LINES)
        events = list(parse_inputs([path]))
        assert [e.message for e in events] == ["text one", "text two"]
        assert events[1].level is LogLevel.ERROR

    def test_mixed_inputs_keep_their_own_detection(self, tmp_path: Path):
        jsonl = write(tmp_path, "a.jsonl", JSON_LINES)
        text = write(tmp_path, "b.log", TEXT_LINES)
        events = list(parse_inputs([jsonl, text]))
        assert [e.message for e in events] == ["json one", "json two", "text one", "text two"]

    def test_probe_does_not_lose_lines(self, tmp_path: Path):
        # Exactly at the probe boundary: 10 json lines then more after.
        lines = [f'{{"ts": 1768458181, "msg": "line {i}"}}' for i in range(15)]
        path = write(tmp_path, "probe.jsonl", lines)
        events = list(parse_inputs([path]))
        assert len(events) == 15

    def test_extra_patterns_reach_text_parser(self, tmp_path: Path):
        path = write(tmp_path, "pipe.log", ["1768458181|INFO|pipe format line"])
        events = list(parse_inputs([path], extra_patterns=[r"^(?P<ts>\d{10})\|(?P<level>\w+)\|(?P<message>.*)$"]))
        assert events[0].message == "pipe format line"

    def test_stdin_streaming(self, monkeypatch):
        monkeypatch.setattr("sys.stdin", io.StringIO("\n".join(TEXT_LINES) + "\n"))
        events = list(parse_inputs(["-"]))
        assert [e.message for e in events] == ["text one", "text two"]

    def test_is_lazy(self, tmp_path: Path):
        path = write(tmp_path, "a.jsonl", JSON_LINES)
        stream = parse_inputs([path])
        assert hasattr(stream, "__next__")
