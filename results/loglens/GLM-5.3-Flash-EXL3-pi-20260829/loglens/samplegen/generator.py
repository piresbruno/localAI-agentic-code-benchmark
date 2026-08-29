"""Sample generator: realistic demo logs with planted anomalies (spec §7).

Layout (minutes from start, span scales with event count; density 40 events/min):

  [15, 20)  scenario 1 — 30% error rate in a 5-minute window
  [20, 28)  scenario 2 — connection error repeated 12×
  [28, 46)  scenario 3 — latency p95 ≈ 120ms with outliers ≈ 4000ms
  minute 50 scenario 4 — payments CRITICAL with no preceding WARNING
  elsewhere normal mixed traffic (the `payments` logger is never used there,
  keeping scenario 4 clean).
"""

from __future__ import annotations

import json
import random
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path

EVENTS_PER_MINUTE = 40
MIN_SPAN_MINUTES = 60.0

SCENARIO_1_START = 15.0
SCENARIO_1_END = 20.0
SCENARIO_2_START = 20.0
SCENARIO_2_END = 28.0
SCENARIO_2_COUNT = 12
SCENARIO_3_START = 28.0
SCENARIO_3_END = 46.0
SCENARIO_4_MINUTE = 50

NORMAL_LOGGERS = ("http.server", "worker", "cache", "auth", "scheduler")
NORMAL_MESSAGES = {
    "INFO": ["Request handled", "Job completed", "Cache warmed"],
    "DEBUG": ["Cache lookup", "Session refreshed"],
    "WARNING": ["Slow query detected", "Retrying upstream call"],
    "ERROR": ["Upstream timeout", "Validation failed"],
}
CONNECTION_ERROR = "Connection refused to database primary"


class SampleGenerator:
    """Generates deterministic demo logs (seeded) with planted incidents."""

    def __init__(self, seed: int = 42, clock: Callable[[], datetime] | None = None) -> None:
        self.rng = random.Random(seed)
        self.clock = clock or (lambda: datetime(2026, 1, 15, 8, 0, 0, tzinfo=UTC))

    def generate_events(self, total_events: int = 5000) -> list[dict]:
        """Build the event stream: 4 planted scenarios + normal traffic."""
        span_minutes = max(MIN_SPAN_MINUTES, total_events / EVENTS_PER_MINUTE)
        step = span_minutes / total_events
        start = self.clock()
        events: list[dict] = []
        connection_errors = 0
        critical_planted = False

        for index in range(total_events):
            minute = index * step
            ts = start + timedelta(minutes=minute)
            seq = index + 1

            if SCENARIO_1_START <= minute < SCENARIO_1_END:
                # Scenario 1: 30% error rate window.
                level = "ERROR" if self.rng.random() < 0.30 else "INFO"
                events.append(
                    self._json_event(ts, level, "Order processing tick", "orders", seq, {"order_id": self.rng.randint(1000, 9999)})
                )
            elif SCENARIO_2_START <= minute < SCENARIO_2_END and connection_errors < SCENARIO_2_COUNT:
                # Scenario 2: same connection error repeating.
                connection_errors += 1
                events.append(
                    self._json_event(ts, "ERROR", CONNECTION_ERROR, "db.pool", seq, {"attempt": connection_errors})
                )
            elif SCENARIO_3_START <= minute < SCENARIO_3_END:
                # Scenario 3: latency baseline ~120ms with ~3% outliers at ~4000ms.
                latency = 4000.0 if self.rng.random() < 0.03 else max(self.rng.gauss(120, 25), 1.0)
                events.append(
                    self._json_event(
                        ts, "INFO", "Request handled", "http.server", seq,
                        {"latency_ms": round(latency, 1), "path": self.rng.choice(["/api/users", "/api/orders", "/health"])},
                    )
                )
            elif not critical_planted and minute >= SCENARIO_4_MINUTE:
                # Scenario 4: CRITICAL escalation with no preceding WARNING.
                critical_planted = True
                events.append(
                    self._json_event(ts, "CRITICAL", "Payment ledger diverged; halting settlement", "payments", seq)
                )
            else:
                events.append(self._normal_event(ts, seq))

        return events

    def _normal_event(self, ts: datetime, seq: int) -> dict:
        logger = self.rng.choice(NORMAL_LOGGERS)
        level = self.rng.choices(["INFO", "DEBUG", "WARNING", "ERROR"], weights=[72, 20, 7, 1])[0]
        msg = self.rng.choice(NORMAL_MESSAGES[level])
        event = self._json_event(ts, level, msg, logger, seq)
        if logger == "http.server" and self.rng.random() < 0.5:
            event["latency_ms"] = round(max(self.rng.gauss(110, 30), 1.0), 1)
        return event

    def write_files(self, directory: Path, total_events: int = 5000) -> list[Path]:
        """Write sample files: JSON-lines app.log + plain-text web.log slice."""
        directory.mkdir(parents=True, exist_ok=True)
        events = self.generate_events(total_events)
        app_log = directory / "app.log"
        with app_log.open("w", encoding="utf-8") as handle:
            for event in events:
                handle.write(json.dumps(event, separators=(",", ":")) + "\n")

        web_log = directory / "web.log"
        with web_log.open("w", encoding="utf-8") as handle:
            for event in events[::5]:  # every 5th event as plain text
                handle.write(self._to_plain_text(event) + "\n")
        return [app_log, web_log]

    def _json_event(self, ts: datetime, level: str, msg: str, logger: str, seq: int, extra: dict | None = None) -> dict:
        payload = {
            "ts": ts.isoformat(),
            "level": level,
            "msg": msg,
            "logger": logger,
            "seq": seq,
            "host": f"node-{self.rng.randint(1, 4)}",
        }
        if extra:
            payload.update(extra)
        return payload

    def _to_plain_text(self, event: dict) -> str:
        ts = datetime.fromisoformat(event["ts"]).strftime("%Y-%m-%d %H:%M:%S,%f")[:-3]
        logger = event.get("logger", "app")
        return f"{ts} {event['level']} [{logger}] {event['msg']}"
