"""Shared fixtures: injected clock, event builders, engine factory."""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import pytest

from loglens.engine.pipeline import Engine
from loglens.parsers.jsonlines import JsonLinesParser
from loglens.parsers.plaintext import PlainTextParser

BASE_TIME = datetime(2026, 1, 15, 8, 0, 0, tzinfo=UTC)


@pytest.fixture
def clock() -> Callable[[], datetime]:
    """Fixed injected clock — deterministic tests (spec: time is injected)."""
    return lambda: BASE_TIME


def at(minutes: float) -> datetime:
    return BASE_TIME + timedelta(minutes=minutes)


def json_line(ts: datetime, level: str, msg: str, logger: str = "app", **extra) -> str:
    payload = {"ts": ts.isoformat(), "level": level, "msg": msg, "logger": logger}
    payload.update(extra)
    return json.dumps(payload)


def text_line(ts: datetime, level: str, msg: str, logger: str = "worker") -> str:
    return f"{ts.strftime('%Y-%m-%d %H:%M:%S,%f')[:-3]} {level} [{logger}] {msg}"


@pytest.fixture
def json_engine(clock) -> Engine:
    return Engine(parser=JsonLinesParser(), clock=clock)


@pytest.fixture
def text_engine(clock) -> Engine:
    return Engine(parser=PlainTextParser(), clock=clock)


def feed(engine: Engine, lines: list[str], source: str = "test.log"):
    return engine.analyze((source, line) for line in lines)


def malformed_fixture() -> list[str]:
    """The documented ≥50-line malformed-input fixture (tests/data/malformed.log)."""
    from pathlib import Path

    path = Path(__file__).parent / "data" / "malformed.log"
    return path.read_text(encoding="utf-8").splitlines()
