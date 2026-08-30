# PLAN — loglens

**Agent/Model**: pi (GLM-5.3-Flash-EXL3)
**Started**: 2026-08-30
**Spec**: specs/02-python-loglens/SPEC.md
**Mode**: unattended — plan self-approved

## Understanding of the task

LogLens is a Python 3.11+ CLI + library that ingests logs (JSON-lines and plain text), normalizes
them into a common `LogEvent` model, detects anomalies with five pluggable rules (error-rate spike,
repeated error, latency outlier, burst, level gap), and renders terminal/JSON/self-contained-HTML
reports. Hard parts: (1) robust parsing of dirty input where unparseable lines become `UNKNOWN`
events that are counted, never dropped; (2) a streaming pipeline whose memory stays O(1) vs. stream
length — rules evaluate over closed tumbling windows instead of retaining the whole stream;
(3) deterministic, clock-injected behavior everywhere; (4) `loglens sample` must plant exactly four
scenarios that the built-in rules reliably detect (planted windows must not be diluted by baseline
traffic). The library core must be importable without the CLI; the CLI is a thin typer shell.

## Task breakdown

- [ ] T1 — Scaffold: pyproject (PEP 621, entry point `loglens = "loglens.cli:app"`), package dirs
      per spec §3, .gitignore, ruff config; `pip install -e ".[dev]"` works, `loglens --help` runs.
      Accept: BUILD_CHECK green on empty skeleton, entry point resolves.
- [x] T2 — models/: `LogLevel`, `LogEvent`, `Incident`, `Report`, `RuleConfig`, report sub-models;
      UTC normalization, `parse_error` attribute convention.
      Accept: unit tests green for model validation & tz normalization.
- [x] T3 — parsers/: `JsonLinesParser` (key aliases, ISO/unix-s/unix-ms timestamps, level aliases,
      extra keys → attributes), `PlainTextParser` (≥ 3 configurable regex patterns incl. spec
      example), per-file format auto-detection (probe first 10 lines), registry.
      Accept: unit tests green incl. malformed lines → UNKNOWN events, never dropped.
- [x] T4 — io/readers.py: lazy line readers for file / glob set / stdin, utf-8 replace policy,
      `InputError` for missing files / empty globs.
      Accept: unit tests green; generator laziness asserted.
- [x] T5 — engine/: per-rule tumbling correlation windows, time filtering (`--since/--until`:
      relative `30m` / ISO), report stats (levels, parse errors, top messages, error-rate series),
      health-score formula in scoring.py, `Engine` facade + streaming O(1) accounting.
      Accept: engine unit tests green; 100k-event streaming test asserts held ≪ processed.
- [x] T6 — rules/: Rule protocol (`name`, `configure`, `evaluate(window) -> list[Incident]`),
      registry, five built-ins with per-rule windows and incident metadata (severity, summary,
      suggested action).
      Accept: every rule has a positive AND negative test with injected event timestamps.
- [x] T7 — reporters/: terminal (rich tables), JSON (full report dump), HTML (Jinja2, single
      self-contained file: summary cards, incidents table, SVG error-rate sparkline, top messages),
      registry.
      Accept: unit tests green; HTML has no external URLs; JSON round-trips.
- [x] T8 — cli/: typer app `parse | report | watch | sample`, `--format`, `--out`, `--config`,
      `--since/--until`, `--interval`; exit codes 0/1/2/3; config loader (TOML+JSON, file+line in
      errors, exit 2); `--help` documents every command.
      Accept: CliRunner tests green for all exit codes and help texts.
- [x] T9 — samplegen/: deterministic (seeded) generator writing `samples/app.log` (plain text) and
      `samples/app.jsonl` (JSON lines) planting exactly the 4 spec scenarios without baseline
      dilution.
      Accept: engine over generated samples detects all 4 scenario incidents (integration test).
- [x] T10 — Tests hardening: ≥ 50 documented malformed-line fixtures in `tests/data/`
      (property-style parser test), CLI integration suite, streaming test, coverage ≥ 75%
      (`pytest --cov=loglens`), zero ruff warnings.
      Accept: gates green: build, pytest 100%, coverage ≥ 75%, ruff clean.
- [x] T11 — Docs: README (goal, ≤ 3-command quickstart, rule table w/ defaults, config example,
      exit codes, health-score formula, extend-in-10-lines guide, decisions), docs/ARCHITECTURE.md
      (pipeline diagram + data flow).
      Accept: README quickstart verified from clean-checkout state; docs committed.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | Correlation windows are **tumbling** (epoch-aligned), sized per rule (`window_duration`); `level_gap` is event-driven (per-logger state, no window) | Spec defines `evaluate(window)`; tumbling windows keep memory O(1) for the streaming requirement and make rule behavior deterministic. Sliding windows would retain O(window) events per rule and complicate determinism. |
| 2 | `latency_outlier` computes p95 within its own trailing window (default 5m) instead of over the whole stream | Whole-stream p95 would require retaining every latency value — violates O(1) streaming. Window-local p95 still detects the spec's 120ms vs 4000ms scenario. |
| 3 | `level_gap` semantics: incident on a CRITICAL from a logger with no WARNING since the last CRITICAL-gap report; state re-arms when a WARNING appears | Spec says "no preceding WARNING from same logger" without a horizon; per-logger state is O(#loggers) and deterministic. |
| 4 | Health score: `100 - Σ severity_weight × volume_factor`, weights critical=25/warn=10/info=3, `volume_factor = 1 + min(4, affected_events/20)`, floored at 0 | Deterministic, documented formula per spec §5 ("penalize incidents weighted by severity and event volume"). |
| 5 | Sample data uses a fixed base time (2026-01-15T08:00Z) and seeded RNG, not the wall clock | Deterministic planted scenarios are testable and reproducible; `--events` scales baseline volume. |
| 6 | Planted windows suppress baseline traffic (both files) so scenario windows are not diluted | The 30%-error window would otherwise be ~4% when baselines interleave in the same tumbling window across inputs. |
| 7 | Events with no parseable timestamp are counted (UNKNOWN/parse_error) but not fed to time-windowed rules; when `--since/--until` is active, timestamp-less events are excluded | Time-windowed rules cannot place them; report still counts them — never silently dropped. |
| 8 | Unrecognized level strings (e.g. `TRACE`, `NOTICE`) map via an alias table; unmapped → `UNKNOWN` event with `parse_error` attribute | Keeps the "never silently drop" invariant with a single catch-all level. |
| 9 | JSON-lines detection threshold: ≥ 5 of first 10 non-empty lines parse as JSON objects | Robust per-file probe per spec §4; mixed-format files degrade to UNKNOWN events, never crash. |
| 10 | `watch` gains `--max-runs N` (default ∞) | Makes the loop testable without real sleeps/signals; useful for CI. |
| 11 | Formatting via `ruff format` + `ruff check` (zero warnings) | ruff format is black-compatible; spec only demands zero ruff warnings. |
| 12 | Repeat run of same model/harness (2026-08-30) explicitly requested by operator; prior 2026-08-29 run exists | Operator instruction; this run is built from the spec alone. |

## Final report (fill at the end)

- Wall-clock time: 01:22:00 (work started 12:39:24 UTC, finished ~14:01 UTC, 2026-08-30)
- Total tokens consumed (in + out) + avg output t/s: 21,459,134 total (21,311,285 input /
  147,849 output; reasoning 0) — self-reported from pi harness session telemetry
  (`message.usage` in the session jsonl). Avg output ≈ 30 t/s (output tokens ÷ wall time;
  estimate, not a metered rate).
- Errors/retries (build/test/lint): ~21 fix-forward cycles, zero restarts. Real implementation
  bugs found by tests: (1) JSONL field order let level assignment un-UNKNOWN parse errors;
  (2) pydantic assignment validation was off, so non-UTC tzinfo survived; (3) engine pooled
  unordered/cross-file events into one giant window (burst false positive, O(n) retention) —
  fixed with per-source window flushes + late-arrival policy; (4) `report --out report.html`
  wrote a terminal report — fixed to imply html per the spec's smoke contract. The rest were
  test-expectation and lint fixes.
- Final coverage (number + measurement command): 96% via `pytest --cov=loglens --cov-report=term`
  (210→211 tests, all passing, none skipped)
- Line counts per directory: models 238, parsers 371, rules 560, engine 572, reporters 224,
  io 114, cli 248, samplegen 314 → package ≈ 2,871 lines (incl. 1 Jinja2 template);
  tests ≈ 1,901 lines
- Deviations from spec: see "Decisions & spec deviations" table above (12 entries; none
  functional — tumbling windows, per-source timelines, sample-data dilution guards, and the
  html-format default are documented design decisions).
