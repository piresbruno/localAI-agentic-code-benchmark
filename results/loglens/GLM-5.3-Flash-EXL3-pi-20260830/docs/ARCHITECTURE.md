# LogLens Architecture

## Pipeline diagram

```
              inputs: files / globs / stdin ('-')
                              │
                              ▼
   ┌──────────────────  io.readers  ──────────────────┐
   │  resolve_inputs → SourceInput[]  (fail fast)     │
   │  read_source → LineRecord(source, line_no, text) │
   │  lazy generators — a 1 GB file streams           │
   └──────────────────────┬───────────────────────────┘
                          │ LineRecord*
                          ▼
   ┌────────────────  engine.pipeline  ────────────────┐
   │  probe_format: first 10 non-empty lines           │
   │  ├─ "jsonl" → JsonLinesParser                     │
   │  └─ "text"  → PlainTextParser (≥ 3 regexes)       │
   │  unparseable → LogEvent(level=UNKNOWN,            │
   │                         attributes["parse_error"])│
   └──────────────────────┬───────────────────────────┘
                          │ LogEvent* (lazy)
                          ▼
   ┌────────────────────  Engine  ─────────────────────┐
   │  --since/--until filter (engine.filters)          │
   │  assign ids · level counts · parse-error count    │
   │  top-message templates · per-5m error buckets     │
   │                                                   │
   │  correlation windowing (per-source timelines):    │
   │    each rule gets its own tumbling window         │
   │    (window size = rule.window_duration());        │
   │    closed window → rule.evaluate(window)          │
   │    only open windows are retained → O(1) memory   │
   └───────────┬───────────────────────┬───────────────┘
               │ list[Incident]        │ aggregates
               ▼                       ▼
   ┌──────  rules (plugins)  ──┐  ┌────  models.Report  ────┐
   │ error_rate_spike   (5m)   │  │ health_score (scoring)  │
   │ repeated_error     (10m)  │  │ incidents, top messages │
   │ latency_outlier    (5m)   │  │ error_rate_series       │
   │ burst              (60s)  │  └────────────┬────────────┘
   │ level_gap    (event-driven)│              │
   └───────────────────────────┘               ▼
                                  ┌────  reporters (plugins)  ────┐
                                  │ terminal → rich tables        │
                                  │ json     → full report dump   │
                                  │ html     → Jinja2 single file │
                                  │  (inline CSS, SVG sparkline)  │
                                  └───────────────────────────────┘
```

## Data flow (one event)

1. **Reader** yields a `LineRecord` (source name, 1-based line number, text). Encoding failures
   are replaced (`errors="replace"`), never fatal.
2. **Pipeline** probes the first 10 non-empty lines of each source to pick the parser, then
   parses every line. A line that fails anywhere (invalid JSON, no regex match, unknown level,
   missing message) becomes `LogEvent(level=UNKNOWN, attributes={"parse_error": "…"})` — counted,
   never dropped.
3. **Engine** (streaming, one event at a time):
   - optional `--since/--until` filter (relative times anchored at an injected clock);
   - stats: sequential event id (`e1`, `e2`, …), level counts, parse-error count, first/last
     timestamp, normalized top messages, per-5-minute error-ratio buckets (sparkline data);
   - **windowing**: each source is its own timeline (a source boundary flushes open windows).
     Timed rules receive tumbling windows aligned to epoch; when an event passes a window's end
     the window is closed, evaluated, and a fresh one opens. `level_gap` is evaluated per event
     with per-logger state. Late events (older than the open window) are counted but not
     analyzed.
4. **Rules** return `Incident`s: rule name, severity (`info|warn|critical`), first/last
   timestamp, affected event ids, human summary, suggested action.
5. **Scoring** folds incidents into the 0–100 `health_score` (formula in README).
6. **Reporter** renders the finished `Report` — to rich terminal tables, JSON, or a
   self-contained HTML file.

## Layering rules

- `cli/` — argument parsing + output formatting only; zero business logic.
- `engine/` — pipeline orchestration, windowing, filtering, scoring, config loading.
- `rules/`, `parsers/`, `reporters/` — plugins registered in registries; one class + one
  registration line each.
- `models/` — pydantic data contracts; no behavior beyond validation.
- `io/` — storage/streaming only.
- Dependencies point inward: `cli → engine → {rules, parsers, io, models}`; nothing in the core
  imports `typer`, `rich`, or `jinja2` (only `cli` and `reporters` do).

## Determinism

- All rule behavior is driven by **event timestamps**, never wall-clock time.
- Relative `--since/--until` values resolve against an injectable `clock` callable.
- `loglens sample` is seeded (`random.Random(42)`) with a fixed base time — identical bytes on
  every run, so planted scenarios are stable test fixtures.

## Streaming & memory

`readers → pipeline → engine` are generators end to end. The engine retains only each rule's
currently-open window plus small aggregates (counters, buckets). Feeding 100,000 events across
~28 hours holds well under 1,000 events at any moment (asserted in
`tests/unit/test_engine.py::TestStreamingO1`).
