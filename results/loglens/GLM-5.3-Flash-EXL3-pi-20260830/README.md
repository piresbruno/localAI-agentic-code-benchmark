# LogLens

**Log analysis CLI & library** — ingest application logs (JSON-lines and plain text), normalize
them into a common event model, detect anomalies with a rule engine, and produce an actionable
report: terminal, JSON, or a single self-contained HTML file.

## Quickstart

```bash
pip install -e ".[dev]"                              # in a venv: python3 -m venv .venv && source .venv/bin/activate first
loglens sample --dir samples                         # writes samples/app.log + samples/app.jsonl (4 planted anomalies)
loglens report samples/app.log samples/app.jsonl --out report.html
```

`report.html` is fully self-contained (inline CSS, inline SVG sparkline — no CDN, no JS files).
Open it in any browser. Run `loglens report samples/app.log` for the terminal report.

Note: the sample data plants a **level-gap escalation** (CRITICAL with no preceding WARNING) and
**latency outliers**, so a report over the sample exits `1` (critical/warn incidents found) — that
is the CI-friendly behavior described under [Exit codes](#exit-codes).

## Why LogLens exists

Production logs arrive in a dozen shapes, dirty and fast. LogLens gives you one normalized event
model, five focused anomaly rules, and a deterministic health score — as a small library with a
thin CLI shell. It streams: a multi-GB file is processed line by line with bounded memory.

## Library usage

```python
from loglens import Engine, JsonLinesParser, LogEvent

engine = Engine()                       # all five built-in rules, default thresholds
report = engine.run(<iterable of LogEvent>)
print(report.health_score, [i.summary for i in report.incidents])
```

The core imports without the CLI: `import loglens` pulls in only `pydantic`, not `typer`/`rich`/`jinja2`.

## CLI commands

```
loglens parse   <input>                                  # normalize + print table (or --format json)
loglens report  <input...> [--out report.html]           # files, globs, or '-' for stdin
                [--format terminal|json|html] [--config x] [--since T] [--until T]
loglens watch   <input> --interval 5 [--max-runs N]      # re-run report on file growth until Ctrl-C
loglens sample  [--events 5000] [--dir ./samples]        # deterministic demo logs, planted anomalies
```

All commands accept `--since`/`--until` — relative (`30m`, `2h`, `1d`, `45s`) or ISO-8601.
`report` accepts multiple inputs: literal files, glob patterns (`logs/*.log`), or `-` (stdin).

## Rules

| Rule | Default config | Detects |
|---|---|---|
| `error_rate_spike` | window=5m, threshold=10%, min_events=20 | ERROR/CRITICAL ratio above threshold in a window (severity `critical` at ≥ 50%) |
| `repeated_error` | min_count=5, window=10m | The same normalized message template (numbers wild-carded) repeating ≥ min_count times |
| `latency_outlier` | attr=latency_ms, multiplier=5.0, window=5m | Attribute value above window p95 × multiplier (JSON logs only — plain text carries no attributes) |
| `burst` | min_events=50, window=60s | Raw event-rate spikes regardless of level |
| `level_gap` | — | CRITICAL from a logger with no preceding WARNING (escalation without warning) |

Correlation windows are **tumbling and epoch-aligned**, sized per rule; `level_gap` is event-driven.
Only the currently-open window of each rule is retained, so memory stays O(1) in stream length.

## Health score

`health = max(0, round(100 − Σ penaltyᵢ))` with
`penaltyᵢ = severity_weight × volume_factor`,

- `severity_weight`: critical = 25, warn = 10, info = 3
- `volume_factor = 1 + min(4, affected_events / 20)` (1.0 … 5.0)

No incidents → 100. Deterministic: the same events always produce the same score.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success (no critical incidents) |
| 1 | At least one **critical** incident found (useful in CI) |
| 2 | Usage or configuration error (bad flag, invalid `--config`, bad `--since`) |
| 3 | I/O error (missing file, unreadable input, empty glob, unwritable output) |

## Config file

TOML (default) or JSON (`.json` suffix). Enable/disable rules and override thresholds:

```toml
[rules.error_rate_spike]
threshold = 0.25        # 25% error ratio
min_events = 30
window = "5m"           # durations: 90s / 5m / 2h / 1d (or plain seconds)

[rules.burst]
enabled = false         # disable a rule entirely

[parsers]
extra_patterns = ["^(?P<ts>\\d{10})\\|(?P<level>\\w+)\\|(?P<message>.*)$"]
```

Invalid config fails cleanly with file and line (`config.toml:3: unknown rule 'nope'`) and exit
code 2. Unknown parameter keys for a rule are errors, not silent ignores.

## The sample data

`loglens sample` plants exactly four scenarios (deterministic, seed 42, base time
2026-01-15T08:00Z):

1. A 5-minute window (08:20–08:25) with a 30% error rate → `error_rate_spike`.
2. The same connection error 12× within 8 minutes (08:31–08:39) → `repeated_error`.
3. JSON events with p95 latency ≈ 120ms and outliers ≈ 4000ms → `latency_outlier`.
4. A CRITICAL from the `payments` logger with no preceding WARNING → `level_gap`.

Baseline traffic is low-rate and skips planted windows, so each scenario maps to exactly one
rule firing — no cross-dilution.

## Extending (one class + one registration line)

```python
# rules: subclass BaseRule, then decorate
from loglens.rules.base import BaseRule, register_rule

@register_rule("my_rule")
class MyRule(BaseRule):
    name = "my_rule"
    def apply_params(self, params): ...
    def evaluate(self, window): return []          # -> list[Incident]

# parsers: implement parse_line, then decorate
from loglens.parsers.base import register_parser

@register_parser("myformat")
class MyParser:
    name = "myformat"
    def parse_line(self, line, *, source, line_number): ...
```

Registered rules automatically join the default engine; reporters register the same way.

## Development

```bash
pip install -e ".[dev]"
pytest                                     # 210 tests
pytest --cov=loglens --cov-report=term     # coverage (measured: 96%)
ruff check loglens tests && ruff format --check loglens tests    # lint, zero warnings
```

Architecture overview and pipeline diagram: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Decisions & deviations (from the spec's letter, documented)

- Tumbling per-rule windows (epoch-aligned) instead of sliding windows — deterministic and O(1)
  memory; sliding windows would retain O(window) events per rule.
- `latency_outlier` computes p95 within its own 5-minute window (configurable) rather than over
  the whole stream — whole-stream p95 would violate the streaming O(1) requirement.
- `level_gap` semantics: one incident per logger until that logger emits a WARNING; the rule is
  event-driven (state is O(#loggers)).
- Each input source is treated as its own timeline: a source boundary flushes open windows; late
  (out-of-order) events inside a source are counted in report stats but excluded from windowed
  rules, keeping window semantics sound without buffering the stream.
- Unparseable lines become `UNKNOWN` events with a `parse_error` attribute — counted in the
  report, never dropped. Unrecognized level strings (e.g. `SHOUTING`) map via an alias table
  (`WARN`→`WARNING`, `FATAL`→`CRITICAL`, …) or fall back to `UNKNOWN`.
- Timestamp-less events are counted but excluded from time-windowed rules; with `--since/--until`
  active they are excluded entirely (they cannot be placed in time).
- `watch` gains `--max-runs N` (0 = forever) so the loop is testable and CI-usable.
- Formatting/lint via `ruff check` + `ruff format` (black-compatible), zero warnings.
