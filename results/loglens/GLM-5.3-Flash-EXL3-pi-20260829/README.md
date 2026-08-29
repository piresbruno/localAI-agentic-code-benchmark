# LogLens

Log analysis CLI & library: ingest application logs (JSON-lines and plain text), normalize them into a common event model, detect anomalies with a rule engine, and produce an actionable report — terminal, JSON, or a self-contained HTML file.

## Quickstart

```bash
pip install -e ".[dev]"
loglens sample                        # writes samples/app.log + samples/web.log
loglens report samples/app.log --out report.html
```

Open `report.html` — it is a single self-contained file (inline CSS/JS, no CDN). The sample logs contain four planted anomalies, all detected by the built-in rules (see `loglens report samples/app.log`).

## Rule reference

| Rule | Config (defaults) | Detects |
|---|---|---|
| `error_rate_spike` | `window_seconds=300`, `threshold=0.10`, `min_events=20` | error-level ratio above threshold in a window (severity `critical` at ≥ 2× threshold) |
| `repeated_error` | `min_count=5`, `window_seconds=600` | same normalized message template (numbers/ids wild-carded) repeating |
| `latency_outlier` | `attribute="latency_ms"`, `multiplier=5.0`, `min_events=10` | attribute value above the window's p95 × multiplier |
| `burst` | `min_events=50`, `window_seconds=60` | event rate spike regardless of level |
| `level_gap` | — | CRITICAL from a logger with no preceding WARNING (escalation without warning) |

## CLI

```
loglens parse   <input>                                  # normalize + print table (or --format json)
loglens report  <input...> [--out report.html | --format terminal|json|html] [--config x.toml]
loglens watch   <input> --interval 5                     # re-run report until Ctrl-C
loglens sample  [--events 5000] [--dir ./samples]        # generate demo logs with planted anomalies
```

Inputs may be files, glob patterns (`logs/*.log`), or `-` for stdin. All analysis commands support `--since`/`--until` (relative like `30m`, `2h`, `7d`, or ISO-8601).

### Exit codes

| Code | Meaning |
|---|---|
| `0` | success, no critical incidents |
| `1` | a critical incident was found (CI-friendly) |
| `2` | usage or config error |
| `3` | I/O error (missing file, unreadable source) |

### Config file (TOML)

```toml
[rules.error_rate_spike]
enabled = true
threshold = 0.25        # 25% instead of 10%
window_seconds = 300

[rules.burst]
enabled = false
```

Invalid config (bad TOML, unknown rule, wrong types) exits `2` with file and line information.

## Health score

```
score = 100 − min(100, Σ over incidents of  severity_penalty × volume_factor)
severity_penalty: critical = 25, warn = 10, info = 3
volume_factor   = 1 + log10(affected events + 1)     # bigger incidents weigh more
```

Deterministic for a given report; rounded to an integer and clamped to 0–100.

## Architecture

```
readers (lazy lines) → parsers (normalize) → engine (windows + rules) → reporters (terminal/JSON/HTML)
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the pipeline diagram and data flow. Malformed lines are **never dropped**: they become `UNKNOWN`-level events with a `parse_error` attribute and are counted in the report.

## Extending

**Add a rule** (~10 lines): create a class with `name`, `suggested_action`, `window_seconds` (int, or `None` for whole-stream scope), `configure(settings)`, and `evaluate(events) -> list[Incident]`, then register it:

```python
# loglens/rules/my_rule.py
from loglens.models.incident import Incident
from loglens.rules.base import make_incident

class MyRule:
    name = "my_rule"
    suggested_action = "Do the obvious fix."
    window_seconds = 60

    def configure(self, settings) -> None: ...
    def evaluate(self, events) -> list[Incident]:
        return [make_incident(self, "warn", events, "summary of the anomaly")]
```

```python
# loglens/rules/registry.py — one registration line
registry.register("my_rule", MyRule)
```

**Add a parser**: implement `name`, `parse_line(line, source, clock)` (never raise on bad lines — return an UNKNOWN event), and register it. `AutoDetectParser` shows how to build a streaming variant with `parse_stream`.

## Development

```bash
pip install -e ".[dev]"
pytest                       # 134 tests
pytest --cov=loglens         # coverage (97%)
ruff check .                 # zero warnings
```
