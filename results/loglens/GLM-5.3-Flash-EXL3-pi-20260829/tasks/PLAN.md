# PLAN — loglens

**Agent/Model**: GLM-5.3-Flash-EXL3 (pi harness)
**Started**: 2026-08-29
**Spec**: /home/piresbruno/developer/code-benchmark/specs/02-python-loglens/SPEC.md
**Mode**: unattended (plan self-approved)

## Understanding of the task

LogLens is a log-analysis CLI + library: parse JSON-lines and plain-text logs into a normalized LogEvent model (never dropping malformed lines), run five built-in detection rules over sliding windows, and emit terminal/JSON/self-contained-HTML reports with a deterministic health score. The hard parts are the plugin architecture (Rule protocol + registries), robust parsing with graceful degradation over dirty data, lazy streaming I/O (O(1) retention), deterministic rule tests via injected clock, and the sample generator whose planted anomalies the rules must detect.

## Task breakdown

- [x] T1 — Package skeleton: pyproject.toml (PEP 621, `loglens = "loglens.cli:app"`), module dirs, `pip install -e ".[dev]"`, `loglens --help` works
      Accept: install + --help green from clean checkout.
- [x] T2 — models/: LogEvent, Incident, Report, RuleConfig (pydantic v2)
      Accept: models importable, aliases validated, UNKNOWN level supported.
- [x] T3 — parsers/: JSONLinesParser (key aliases, ISO/unix ts), PlainTextParser (≥3 regex patterns), format auto-detection (probe first 10 lines)
      Accept: unit tests incl. malformed-line fixtures; unparseable → UNKNOWN + parse_error attr.
- [x] T4 — io/readers.py: file, glob set, stdin readers; lazy generators; encoding/failure policy
      Accept: streaming test with 100k-line generator, O(1) retained events.
- [x] T5 — rules/ + engine/: Rule protocol, registry, 5 built-in rules (positive+negative tests, injected clock); correlation windowing, scoring, --since/--until filter
      Accept: every rule has named positive & negative tests; health score deterministic.
- [x] T6 — reporters/: terminal (rich), JSON, HTML (Jinja2, self-contained, SVG sparkline, summary cards, incidents + top messages tables)
      Accept: HTML is single-file, no CDN; JSON round-trips report data.
- [x] T7 — samplegen/: `loglens sample` generates demo logs with the 4 planted scenarios
      Accept: rules detect all 4 planted scenarios on generated sample (SMOKE_CHECK).
- [x] T8 — cli/: parse, report, watch, sample commands; exit codes 0/1/2/3; --config validation with file+line errors
      Accept: CliRunner tests for every command + exit codes + --help.
- [x] T9 — test hardening: property-style parser tests over ≥50 malformed lines, per-module unit tests, rule positive/negative, streaming, CLI integration
      Accept: pytest green; coverage measured ≥75%.
- [x] T10 — docs: README (quickstart, rule table, config example, exit codes, health formula, extending), docs/ARCHITECTURE.md
      Accept: quickstart ≤3 cmds documented.
- [x] T11 — Quality gates: pytest all pass, coverage ≥75%, ruff zero warnings, smoke check, final report
      Accept: all gates green.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | TOML for --config (stdlib tomllib) | Spec allows TOML or JSON; TOML has stdlib parsing with line info via custom error mapping |
| 2 | Health score: 100 − Σ(severity penalty × volume factor), clamped 0–100 | Spec asks for deterministic documented formula |
| 3 | `watch` polls file size on --interval seconds | Simplest correct interpretation of "read file growth" |
| 4 | Unix timestamps auto-detected as seconds (<10^11) vs millis (≥10^11) | Common heuristic, documented |

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s:
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
