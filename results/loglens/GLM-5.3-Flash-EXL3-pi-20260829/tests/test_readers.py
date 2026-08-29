"""Reader tests: lazy streaming, globs, stdin, error policy."""

from __future__ import annotations

import io
from pathlib import Path

import pytest

from loglens.io.readers import iter_lines, probe_first_source, read_file
from loglens.models.errors import SourceError


def write_log(path: Path, n: int) -> None:
    path.write_text("\n".join(f"line {i}" for i in range(n)) + "\n", encoding="utf-8")


class TestReadFile:
    def test_reads_all_lines(self, tmp_path):
        log = tmp_path / "a.log"
        write_log(log, 100)
        assert len(list(read_file(log))) == 100

    def test_missing_file_raises_source_error(self, tmp_path):
        with pytest.raises(SourceError, match="not found"):
            list(read_file(tmp_path / "nope.log"))

    def test_directory_raises(self, tmp_path):
        with pytest.raises(SourceError):
            list(read_file(tmp_path))


class TestIterLines:
    def test_multiple_files_ordered(self, tmp_path):
        write_log(tmp_path / "a.log", 3)
        write_log(tmp_path / "b.log", 2)
        pairs = list(iter_lines([str(tmp_path / "a.log"), str(tmp_path / "b.log")]))
        assert [name for name, _ in pairs] == [str(tmp_path / "a.log")] * 3 + [str(tmp_path / "b.log")] * 2

    def test_glob_expansion(self, tmp_path):
        write_log(tmp_path / "x1.log", 2)
        write_log(tmp_path / "x2.log", 2)
        pairs = list(iter_lines([str(tmp_path / "x*.log")]))
        assert len(pairs) == 4

    def test_empty_glob_raises(self, tmp_path):
        with pytest.raises(SourceError, match="matched no files"):
            list(iter_lines([str(tmp_path / "zzz*.log")]))

    def test_missing_plain_path_raises(self, tmp_path):
        with pytest.raises(SourceError, match="not found"):
            list(iter_lines([str(tmp_path / "ghost.log")]))

    def test_stdin_dash(self, monkeypatch):
        import sys

        monkeypatch.setattr(sys, "stdin", io.StringIO("hello\nworld\n"))
        pairs = list(iter_lines(["-"]))
        assert [line for _, line in pairs] == ["hello\n", "world\n"]
        assert pairs[0][0] == "stdin"

    def test_lazy_generator_does_not_load_whole_file(self, tmp_path):
        log = tmp_path / "big.log"
        write_log(log, 100_000)
        iterator = iter_lines([str(log)])
        first = next(iterator)  # must return without reading the rest
        assert first[1] == "line 0\n"
        assert log.read_text().count("line") == 100_000  # file untouched


class TestProbe:
    def test_probe_first_source_reads_head_only(self, tmp_path):
        log = tmp_path / "a.log"
        write_log(log, 500)
        probe = probe_first_source([str(log)], count=10)
        assert len(probe) == 10
        assert probe[0] == "line 0\n"

    def test_probe_glob_uses_first_match(self, tmp_path):
        write_log(tmp_path / "p1.log", 20)
        write_log(tmp_path / "p2.log", 20)
        probe = probe_first_source([str(tmp_path / "p*.log")], count=5)
        assert len(probe) == 5

    def test_probe_no_sources_raises(self):
        with pytest.raises(SourceError, match="no input"):
            probe_first_source([])

    def test_probe_missing_raises(self, tmp_path):
        with pytest.raises(SourceError):
            probe_first_source([str(tmp_path / "none.log")])
