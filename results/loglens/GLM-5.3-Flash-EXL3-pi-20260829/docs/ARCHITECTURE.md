# LogLens — Architecture

## Pipeline diagram

```
                    ┌────────────────────────────────────────────────────┐
                    │                      CLI (typer)                   │
                    │   parse / report / watch / sample                  │
                    │   arg parsing + output formatting ONLY             │
                    └───────────────┬────────────────────────────────────┘
                                    │ delegates
                                    ▼
┌──────────┐   (source, line)  ┌──────────┐   LogEvent   ┌──────────┐    Report    ┌────────────┐
│  io/     │ ────────────────▶ │ engine/  │ ───────────▶ │ rules/   │ ──────────▶  │ reporters/ │
│ readers  │  lazy generators  │ pipeline │  normalized  │ registry │  incidents + │ terminal   │
│ file/glob│  never material-  │          │  events,     │ 5 rules  │  aggregates  │ JSON       │
│ stdin    │  ize the stream   │          │  tumbling    │ protocol │              │ HTML (j2)  │
└──────────┘                   │          │  windows     └──────────┘              └────────────┘
                               └──────────┘
                                    ▲
                       ┌────────────┴────────────┐
                       │ parsers/                │
                       │ JsonLinesParser         │
                       │ PlainTextParser (3+ re) │
                       │ AutoDetectParser        │
                       └─────────────────────────┘
```

## Data flow

1. **io/readers.py** — `iter_lines(sources)` yields `(source_name, line)` pairs **lazily**. Files are opened one at a time with `errors="replace"`; globs expand at iteration start; `-` reads stdin. A 1 GB file streams line by line.

2. **parsers/** — each parser turns one raw line into a normalized `LogEvent` (UTC tz-aware timestamp, level, message, logger, source, attributes, raw text). Rules of engagement:
   - Malformed lines become `UNKNOWN`-level events with a `parse_error` attribute — **never dropped, never raised**.
   - `JsonLinesParser` accepts key aliases (`ts|timestamp|time|@timestamp`, `msg|message`, `logger|name`), ISO-8601 (naive = UTC) and unix seconds/millis timestamps.
   - `PlainTextParser` matches ≥ 3 configurable regex patterns.
   - `AutoDetectParser` implements `parse_stream`: it buffers the first 10 lines **per source**, picks jsonlines vs plaintext by JSON-object ratio, replays the probe lines through the chosen parser, then delegates the rest. No line is lost or duplicated.

3. **engine/pipeline.py** — the `Engine` consumes the event stream and:
   - assigns stable `event_id`s,
   - aggregates level counts, 60-second error-rate buckets, and top-message counters (O(1) memory per item),
   - feeds events into per-rule `WindowBuffer`s — tumbling correlation windows anchored at the first event's timestamp. When an event crosses a window boundary the window is flushed to `rule.evaluate()` and discarded, so **retention is O(window), never O(stream)** (verified by `test_100k_lines_retain_o_window_not_o_stream`, which spies on window sizes over a 100k-line generator),
   - applies `--since`/`--until` filters before aggregation,
   - computes the deterministic health score (`engine/scoring.py`).

4. **rules/** — the `Rule` protocol (`name`, `suggested_action`, `configure(RuleSettings)`, `evaluate(events) -> list[Incident]`). Five built-ins ship in the registry; `RuleRegistry.instantiate(config)` builds configured instances and drops disabled rules. Adding a rule = one class + one `registry.register` line.

5. **reporters/** — one Report model, three renderers:
   - `terminal.py` — rich tables (summary, incidents, top messages),
   - `json_report.py` — full Report serialization,
   - `html_report.py` — Jinja2 template (`report.html.j2`) → a **single self-contained file**: inline CSS, inline SVG error-rate sparkline, no CDN.

6. **samplegen/** — `SampleGenerator` produces seeded, deterministic logs with the four planted scenarios the rules must detect (the SMOKE_CHECK): a 5-minute 30%-error window, a connection error repeated 12×, latency outliers at ~4000 ms against p95 ≈ 120 ms, and a `payments` CRITICAL with no preceding WARNING.

## Design invariants

- **CLI has no business logic** — it parses args, delegates to `Engine`, formats output, maps errors to exit codes (0 ok / 1 critical / 2 usage+config / 3 I/O).
- **The library is importable without the CLI**: `from loglens import Engine, JsonLinesParser` works in a REPL.
- **Time is injected**: `Engine(clock=...)` (and rules accept a clock) so tests are fully deterministic.
- **Plugins over conditionals**: parsers, rules, and reporters are registered components; the engine never branches on specific rule names.
- **Graceful degradation everywhere**: bad bytes (`errors="replace"`), bad JSON, bad timestamps, and bad config all produce clean, user-facing errors — never tracebacks.
