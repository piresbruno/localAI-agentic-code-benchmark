"""Unit tests for lazy readers: files, globs, stdin, failure policy."""

import io
import types
from pathlib import Path

import pytest

from loglens.errors import InputError
from loglens.io.readers import STDIN_SOURCE, LineRecord, read_lines, resolve_inputs


@pytest.fixture()
def log_a(tmp_path: Path) -> Path:
    path = tmp_path / "a.log"
    path.write_text("line1\nline2\nline3\n", encoding="utf-8")
    return path


@pytest.fixture()
def log_b(tmp_path: Path) -> Path:
    path = tmp_path / "b.log"
    path.write_text("beta1\nbeta2\n", encoding="utf-8")
    return path


class TestFileReading:
    def test_reads_lines_with_numbers_and_source(self, log_a: Path):
        records = list(read_lines([str(log_a)]))
        assert [r.text for r in records] == ["line1", "line2", "line3"]
        assert [r.line_number for r in records] == [1, 2, 3]
        assert all(r.source == str(log_a) for r in records)

    def test_multiple_files_read_in_order(self, log_a: Path, log_b: Path):
        records = list(read_lines([str(log_a), str(log_b)]))
        assert records[0].text == "line1"
        assert records[-1].text == "beta2"
        assert {r.source for r in records} == {str(log_a), str(log_b)}

    def test_trailing_whitespace_other_than_newline_is_kept(self, tmp_path: Path):
        path = tmp_path / "ws.log"
        path.write_text("message   \n", encoding="utf-8")
        assert list(read_lines([str(path)]))[0].text == "message   "  # noqa: RUF015

    def test_is_lazy_generator(self, log_a: Path):
        iterator = read_lines([str(log_a)])
        assert isinstance(iterator, types.GeneratorType)
        assert next(iterator) == LineRecord(str(log_a), 1, "line1")


class TestGlobInputs:
    def test_glob_expands_to_sorted_matches(self, tmp_path: Path, log_a: Path, log_b: Path):
        (tmp_path / "c.log").write_text("gamma\n", encoding="utf-8")
        records = list(read_lines([str(tmp_path / "*.log")]))
        unique_sources = list(dict.fromkeys(r.source for r in records))
        assert unique_sources == sorted(unique_sources)
        assert len(unique_sources) == 3

    def test_empty_glob_is_an_error(self, tmp_path: Path):
        with pytest.raises(InputError, match="no files matched"):
            resolve_inputs([str(tmp_path / "missing-*.log")])


class TestStdin:
    def test_dash_reads_stdin(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr("sys.stdin", io.StringIO("from stdin\nsecond\n"))
        records = list(read_lines(["-"]))
        assert [r.text for r in records] == ["from stdin", "second"]
        assert all(r.source == STDIN_SOURCE for r in records)


class TestFailurePolicy:
    def test_missing_explicit_file_fails_fast(self, tmp_path: Path):
        with pytest.raises(InputError, match="file not found"):
            resolve_inputs([str(tmp_path / "nope.log")])

    def test_directory_input_is_rejected(self, tmp_path: Path):
        with pytest.raises(InputError, match="directory"):
            resolve_inputs([str(tmp_path)])

    def test_invalid_utf8_bytes_never_crash(self, tmp_path: Path):
        path = tmp_path / "binary.log"
        path.write_bytes(b"before \xff\xfe invalid\nafter\n")
        records = list(read_lines([str(path)]))
        assert records[0].text.startswith("before")
        assert records[1].text == "after"

    def test_empty_input_list_rejected(self):
        with pytest.raises(InputError, match="no input"):
            resolve_inputs([])
