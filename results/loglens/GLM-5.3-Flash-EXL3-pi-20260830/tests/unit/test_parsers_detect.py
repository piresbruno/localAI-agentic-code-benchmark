"""Unit tests for per-file format detection."""

from loglens.parsers.detect import TEXT_FORMAT, detect_format

JSON_LINES = ['{"ts": "2026-01-15T08:00:00Z", "msg": "a"}'] * 6 + ["noise"] * 4
TEXT_LINES = ["2026-01-15 08:23:01 INFO hello"] * 6 + ['{"ts": 1, "msg": "x"}'] * 4


class TestDetectFormat:
    def test_majority_json_detected_as_jsonl(self):
        assert detect_format(JSON_LINES) == "jsonl"

    def test_majority_text_detected_as_text(self):
        assert detect_format(TEXT_LINES) == TEXT_FORMAT

    def test_empty_input_defaults_to_text(self):
        assert detect_format([]) == TEXT_FORMAT
        assert detect_format(["", "  "]) == TEXT_FORMAT

    def test_probe_looks_at_first_ten_lines_only(self):
        lines = ['{"ts": 1, "msg": "x"}'] * 10 + ["total garbage"] * 100
        assert detect_format(lines) == "jsonl"

    def test_blank_lines_do_not_count_toward_probe(self):
        lines = ["", ""] + ['{"ts": 1, "msg": "x"}'] * 5 + ["x"] * 5
        assert detect_format(lines) == "jsonl"

    def test_json_array_lines_are_not_objects(self):
        lines = ['["a"]'] * 5 + ["text"] * 5
        assert detect_format(lines) == TEXT_FORMAT
