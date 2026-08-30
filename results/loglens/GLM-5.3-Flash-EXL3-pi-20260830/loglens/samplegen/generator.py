"""``loglens sample`` — deterministic demo logs with the four planted scenarios.

Planted scenarios (spec §7), all inside the first hour of the baseline:

1. ``error_rate_spike``  — 08:20–08:25 window with 30% ERROR rate (12/40).
2. ``repeated_error``    — "Connection refused …" 12× between 08:31 and 08:39.
3. ``latency_outlier``   — JSON events with p95 ≈ 120ms and outliers ≈ 4000ms.
4. ``level_gap``         — CRITICAL from logger ``payments`` at 08:45:30 with
   no preceding WARNING from that logger.

Baseline traffic is spread over six hours at a low rate and skips planted
windows, so scenario windows are never diluted below detection thresholds.
Output is fully deterministic for a given seed.
"""

import random
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import NamedTuple

BASE_TIME = datetime(2026, 1, 15, 8, 0, 0, tzinfo=UTC)
DEFAULT_SEED = 42
DEFAULT_EVENTS = 5000

#: Baseline spans six hours at a low rate (keeps bursts below thresholds).
BASELINE_HOURS = 6

#: The planted 5-minute error-spike window (scenario 1) — excluded from baseline.
SPIKE_WINDOW = (BASE_TIME + timedelta(minutes=20), BASE_TIME + timedelta(minutes=25))

REPEATED_MESSAGE = "Connection refused to db-primary:5432 (attempt {attempt})"
PAYMENTS_MESSAGE = "Payment processor deadlock detected"

#: Distinct alphabetic tenants keep the 12 spike errors in 12 *different*
#: normalized templates, so repeated_error stays silent on scenario 1.
SPIKE_TENANTS = (
    "alpha",
    "bravo",
    "charlie",
    "delta",
    "echo",
    "foxtrot",
    "golf",
    "hotel",
    "india",
    "juliett",
    "kilo",
    "lima",
)
SPIKE_ERROR_MESSAGE = "Order processing stalled for tenant {tenant}"

#: A busy INFO period straddling scenario 2 keeps its error-ratio windows
#: below the error_rate_spike threshold, so each scenario maps to one rule.
BUSY_PERIOD = (BASE_TIME + timedelta(minutes=26), BASE_TIME + timedelta(minutes=44))
BUSY_PERIOD_EVENTS = 100

NORMAL_MESSAGES = (
    "Request handled successfully",
    "Health check passed",
    "Cache warmed for tenant {tenant}",
    "Session renewed for user {user}",
    "Job {job} completed in {ms}ms",
    "Config reloaded from disk",
    "Checkpoint written at offset {offset}",
    "Heartbeat sent to coordinator",
)
WARNING_MESSAGES = (
    "Queue depth above soft limit ({depth} pending)",
    "Retry {attempt} delayed for operation {op}",
    "Memory usage at {pct}%",
)
BASELINE_ERROR_MESSAGES = (
    "Upstream timeout after {ms}ms",
    "Deadlock detected and retried on lock {lock}",
    "Failed to persist snapshot version {version}",
)
LOGGERS = ("worker", "api", "auth", "db-pool")


class GeneratedFile(NamedTuple):
    """One written sample file and its line count."""

    path: Path
    lines: int


def generate(
    events_total: int = DEFAULT_EVENTS,
    out_dir: Path | str = "./samples",
    *,
    seed: int = DEFAULT_SEED,
) -> list[GeneratedFile]:
    """Write ``app.log`` (plain text) and ``app.jsonl`` (JSON lines).

    ``events_total`` controls baseline volume (planted events are added on
    top); the split between the two files is even. Returns the files written.
    """
    rng = random.Random(seed)
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    planted_text = _planted_plain_text_events(rng)
    planted_json = _planted_json_events(rng)
    baseline_total = max(events_total - len(planted_text) - len(planted_json), 0)
    baseline_text_count = baseline_total // 2
    baseline_json_count = baseline_total - baseline_text_count

    text_lines = _format_plain_text(
        sorted(
            planted_text
            + _busy_period_events(rng, BUSY_PERIOD_EVENTS)
            + _baseline_events(rng, baseline_text_count),
            key=lambda e: e["ts"],
        )
    )
    json_lines = _format_json_lines(
        sorted(
            planted_json + _baseline_events(rng, baseline_json_count, with_latency=True),
            key=lambda e: e["ts"],
        )
    )

    files = []
    app_log = out_path / "app.log"
    app_log.write_text("\n".join(text_lines) + "\n", encoding="utf-8")
    files.append(GeneratedFile(app_log, len(text_lines)))
    app_jsonl = out_path / "app.jsonl"
    app_jsonl.write_text("\n".join(json_lines) + "\n", encoding="utf-8")
    files.append(GeneratedFile(app_jsonl, len(json_lines)))
    return files


# -- planted scenarios ------------------------------------------------------


def _planted_plain_text_events(rng: random.Random) -> list[dict]:
    """Scenarios 1, 2, and 4 live in the plain-text file."""
    events: list[dict] = []
    spike_start = SPIKE_WINDOW[0]
    # Scenario 1: 40 events, 12 ERROR → exactly 30% in the 08:20–08:25 window.
    for i in range(40):
        ts = spike_start + timedelta(seconds=(i * 299) / 40)
        if i % 10 in (0, 1, 2):
            level = "ERROR"
            message = SPIKE_ERROR_MESSAGE.format(tenant=SPIKE_TENANTS[i // 10 * 3 + i % 10])
        else:
            level = "INFO"
            message = rng.choice(NORMAL_MESSAGES).format(
                tenant=f"t-{rng.randint(1, 40)}",
                user=f"u{rng.randint(1000, 9999)}",
                job=f"j{rng.randint(100, 999)}",
                ms=rng.randint(5, 400),
                offset=rng.randint(1000, 99999),
                depth=rng.randint(100, 500),
                attempt=rng.randint(1, 3),
                op=f"op-{rng.randint(1, 20)}",
                pct=rng.randint(75, 95),
                lock=rng.randint(1, 50),
                version=rng.randint(1, 9),
            )
        events.append(_text_event(ts, level, "order-worker", message))
    # Scenario 2: the same connection error 12× in 8 minutes.
    for i in range(12):
        ts = BASE_TIME + timedelta(minutes=31, seconds=i * 48)
        events.append(_text_event(ts, "ERROR", "db-pool", REPEATED_MESSAGE.format(attempt=i + 1)))
    # Scenario 4: CRITICAL from payments, no WARNING ever from that logger.
    events.append(
        _text_event(
            BASE_TIME + timedelta(minutes=45, seconds=30), "CRITICAL", "payments", PAYMENTS_MESSAGE
        )
    )
    return events


def _busy_period_events(rng: random.Random, count: int) -> list[dict]:
    """INFO-only traffic across the busy period (keeps scenario 2 isolated)."""
    start, end = BUSY_PERIOD
    span = int((end - start).total_seconds())
    events = []
    for _ in range(count):
        ts = start + timedelta(seconds=rng.randint(0, span - 1))
        message = rng.choice(NORMAL_MESSAGES).format(
            tenant=f"t-{rng.randint(1, 40)}",
            user=f"u{rng.randint(1000, 9999)}",
            job=f"j{rng.randint(100, 999)}",
            ms=rng.randint(5, 400),
            offset=rng.randint(1000, 99999),
            depth=rng.randint(100, 500),
            attempt=rng.randint(1, 3),
            op=f"op-{rng.randint(1, 20)}",
            pct=rng.randint(75, 95),
            lock=rng.randint(1, 50),
            version=rng.randint(1, 9),
        )
        events.append(_text_event(ts, "INFO", rng.choice(LOGGERS), message))
    return events


def _planted_json_events(rng: random.Random) -> list[dict]:
    """Scenario 3: latency p95 ≈ 120ms with outliers ≈ 4000ms (JSON logs only)."""
    events = []
    for i, minute in enumerate((10, 33, 52)):
        ts = BASE_TIME + timedelta(minutes=minute, seconds=7 * i)
        events.append(
            _json_event(
                ts,
                "ERROR",
                "api",
                "Checkout upstream latency threshold exceeded",
                latency_ms=rng.randint(3900, 4200),
                request_id=f"planted-outlier-{i}",
            )
        )
    return events


# -- baseline ---------------------------------------------------------------


def _baseline_events(rng: random.Random, count: int, *, with_latency: bool = False) -> list[dict]:
    """Low-rate baseline over BASELINE_HOURS, skipping the planted spike window."""
    events = []
    span_seconds = BASELINE_HOURS * 3600
    # Both files skip the spike window so scenario 1 is never diluted.
    skip_start = int((SPIKE_WINDOW[0] - BASE_TIME).total_seconds())
    skip_end = int((SPIKE_WINDOW[1] - BASE_TIME).total_seconds())
    for _ in range(count):
        offset = rng.randint(0, span_seconds - 1)
        if skip_start <= offset < skip_end:
            offset = span_seconds - 1 - (offset - skip_start)  # reflect out of the window
        ts = BASE_TIME + timedelta(seconds=offset)
        roll = rng.random()
        if roll < 0.97:
            level, message = "INFO", rng.choice(NORMAL_MESSAGES)
        elif roll < 0.99:
            level, message = "WARNING", rng.choice(WARNING_MESSAGES)
        else:
            level, message = "ERROR", rng.choice(BASELINE_ERROR_MESSAGES)
        message = message.format(
            tenant=f"t-{rng.randint(1, 40)}",
            user=f"u{rng.randint(1000, 9999)}",
            job=f"j{rng.randint(100, 999)}",
            ms=rng.randint(5, 400),
            offset=rng.randint(1000, 99999),
            depth=rng.randint(100, 500),
            attempt=rng.randint(1, 3),
            op=f"op-{rng.randint(1, 20)}",
            pct=rng.randint(75, 95),
            lock=rng.randint(1, 50),
            version=rng.randint(1, 9),
        )
        if with_latency:
            events.append(
                _json_event(
                    ts,
                    level,
                    rng.choice(LOGGERS),
                    message,
                    latency_ms=max(60, min(220, int(rng.gauss(120, 25)))),
                    request_id=f"req-{rng.randint(10**6, 10**7 - 1)}",
                )
            )
        else:
            events.append(_text_event(ts, level, rng.choice(LOGGERS), message))
    return events


# -- formatting -------------------------------------------------------------


def _text_event(ts: datetime, level: str, logger: str, message: str) -> dict:
    return {"kind": "text", "ts": ts, "level": level, "logger": logger, "message": message}


def _json_event(ts: datetime, level: str, logger: str, message: str, **attributes) -> dict:
    payload = {"kind": "json", "ts": ts, "level": level, "logger": logger, "message": message}
    payload.update(attributes)
    return payload


def _format_plain_text(events: list[dict]) -> list[str]:
    lines = []
    for event in events:
        ts = event["ts"]
        stamped = f"{ts:%Y-%m-%d %H:%M:%S},{ts.microsecond // 1000:03d}"
        lines.append(f"{stamped} {event['level']} [{event['logger']}] {event['message']}")
    return lines


def _format_json_lines(events: list[dict]) -> list[str]:
    import json

    lines = []
    for event in events:
        payload = {
            "ts": event["ts"].isoformat().replace("+00:00", "Z"),
            "level": event["level"],
            "msg": event["message"],
            "logger": event["logger"],
        }
        payload.update(
            {
                k: v
                for k, v in event.items()
                if k not in ("kind", "ts", "level", "logger", "message")
            }
        )
        lines.append(json.dumps(payload))
    return lines
