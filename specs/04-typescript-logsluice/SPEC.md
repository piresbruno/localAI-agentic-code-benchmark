# Logsluice — Log Normalizer & Summary CLI

**Version**: 1.0.0 (probe-tier edition)
**Stack**: TypeScript on Node ≥ 20 (ESM, `"type": "module"`), Vitest. **Zero npm dependencies in `src/`** (Node stdlib only); devDependencies limited to `typescript`, `vitest`, `@types/node`.
**Audience**: AI coding agents evaluated on a small, exactness-critical CLI — and on how well they exploit an explicitly parallel task structure.

> **Probe-tier scope.** Like `tripsplit`, this probe targets **300–450 LOC**
> (450 advised). Discrimination comes from three independent format grammars,
> a pinned canonical model, quarantine semantics, and byte-deterministic
> output — not feature breadth. Everything specified here is required;
> nothing is optional.

---

## 1. Overview & Goals

Build **Logsluice**, a CLI that ingests mixed-format application logs
(JSON Lines, CSV, simplified syslog), normalizes every parseable line into a
**canonical JSONL event stream**, moves every unparseable line into a
**quarantine file with a reason**, and prints **deterministic summary
reports** (level/service counts, top offenders, latency percentiles).

**Why this exists.** This project grades an agent's ability to:

- Decompose a contract-first spec into independent slices and implement them
  — optionally in parallel (§3) — without integration drift.
- Translate three written grammars into parsers exactly — not "any parse".
- Produce **byte-deterministic output**: same input → identical bytes, every run.
- Keep layering discipline: pure core, I/O at the edge, one error model,
  documented exit codes.

**LOC expectation.** 300–450 lines of production TypeScript under `src/`
(450 advised). Tests and fixtures are excluded from the count but belong in
the repo. Significantly less than 300 usually means features are missing;
significantly more than 450 usually means over-engineering. This probe is
graded on exactness, not volume.

## 2. Success criterion (pass/fail)

ALL of the following must be true:

1. **Sandboxed** — no dependencies on anything outside the run directory.
2. **Ready to run** — from a clean checkout: `npm install`, then
   `npm run build`, then `node dist/cli.js --help` exits 0. Zero runtime
   dependencies in `src/` (Node stdlib only). No network at runtime, no
   manual setup.
3. **Fixture works** — `sample/` fixtures committed **verbatim** from §6.3;
   `normalize` and `summary` on them reproduce §6.4's golden outputs
   **byte-exactly** (SMOKE_CHECK verifies this).
4. **All tests pass**, and **line coverage ≥ 85%** (vitest coverage, v8
   provider) on `src/**`.
5. **`--help` is complete** per §7.
6. **Zero build warnings**; `strict: true` in `tsconfig.json`.

## 3. Architecture (REQUIRED — deviations = fail)

```
logsluice/
├── package.json            # "type": "module", engines >= 20
├── tsconfig.json           # strict: true, outDir: dist/
├── src/
│   ├── types.ts            # canonical model — §4.1, committed VERBATIM
│   ├── parsers/
│   │   ├── jsonl.ts        # slice S1: JSON Lines grammar
│   │   ├── csv.ts          # slice S2: CSV grammar (RFC 4180 quoting)
│   │   └── syslog.ts       # slice S3: simplified syslog grammar
│   ├── normalize.ts        # slice S4: semantic rules → LogEvent | QuarantineRecord
│   ├── detect.ts           # slice S5: per-file format sniffing
│   ├── summary.ts          # slice S6: dedup, counts, top, nearest-rank percentiles
│   ├── report.ts           # slice S7: pure table/json renderers
│   ├── ingest.ts           # glob expansion, file reading, orchestration
│   └── cli.ts              # argv parsing, error envelope, exit codes
├── sample/                 # §6.3 fixtures, committed verbatim
└── tests/                  # vitest; §5 rules by name; golden bytes
```

**Layering rules (graders grep for violations):**

- `parsers/*`, `normalize.ts`, `detect.ts`, `summary.ts`, `report.ts` are
  **pure**: they import **only** from `types.ts` — never from each other,
  never `fs`, never `process`.
- `ingest.ts` is the **only** module doing file I/O; it imports the pure
  modules. `cli.ts` imports `ingest.ts` + `report.ts`.
- **Only `cli.ts`** calls `process.exit` (via `runCli` below). Formatters
  return strings; nothing writes to the console outside `cli.ts`.

**Parallel implementation note.** The slices above are deliberately
independent: each pure module imports only the §4.1 contract, so they can be
implemented **in parallel and in any order**. Implement `types.ts` first,
exactly as printed; the contract is complete in §4 — no cross-slice
negotiation is needed or allowed.

## 4. Canonical model & formats

### 4.1 `src/types.ts` — the contract (verbatim)

```ts
export type Level = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
export type SourceFormat = "jsonl" | "csv" | "syslog";

/** Fields as found in the source line, before semantic normalization. */
export interface RawFields {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  durationMs: string | null; // duration as text, or null when absent
}

export type ParsedLine =
  | { ok: true; fields: RawFields }
  | { ok: false; reason: string };

export interface LogEvent {
  timestamp: string;         // canonical: YYYY-MM-DDTHH:MM:SS.mmmZ (§4.3)
  level: Level;
  service: string;
  message: string;           // preserved verbatim from the source
  durationMs: number | null; // null when the source line carries no duration
  source: { file: string; line: number; format: SourceFormat };
}

export interface QuarantineRecord {
  raw: string;
  source: { file: string; line: number };
  reason: string;
}

export interface Summary {
  totalEvents: number;       // normalized events, before dedup
  quarantined: number;
  deduped: number;           // dropped by --dedup
  byLevel: Record<Level, number>;                        // all six keys, zero-filled
  byService: Array<{ service: string; count: number }>;  // count desc, name asc
  topOffenders: Array<{ service: string; errors: number }>; // error+fatal desc, name asc
  percentiles: { p50: number | null; p95: number | null };  // null when no durations / not requested
}
```

### 4.2 Module contracts (names & behavior pinned; internal helpers are free)

| Module | Pinned export |
|---|---|
| `parsers/jsonl.ts` | `parseJsonl(line: string): ParsedLine` |
| `parsers/csv.ts` | `parseCsvLine(line: string, header: string[]): ParsedLine` |
| `parsers/syslog.ts` | `parseSyslog(line: string, year: number): ParsedLine` |
| `normalize.ts` | `normalizeFields(fields: RawFields, source: {file: string; line: number; format: SourceFormat}): LogEvent \| QuarantineRecord` |
| `detect.ts` | `detectFormat(firstNonBlankLine: string): SourceFormat \| null` |
| `summary.ts` | `summarize(events: LogEvent[], quarantined: number, opts: {dedup: boolean; top: number; percentiles: Array<"p50" \| "p95">}): Summary` |
| `report.ts` | `renderTable(s: Summary): string`, `renderJson(s: Summary): string` |
| `cli.ts` | `runCli(argv: string[]): number` — the in-process test entry; the bin shim calls `process.exit(runCli(argv))` |

**Validation split (pinned).** Parsers check **presence and type** (reasons
`missing field: …`, `not an object`, `invalid json`, `short row`,
`invalid syslog line`); `normalizeFields` checks **semantics** (§4.3
timestamp validity, §5 R2 level aliases, §5 R7 duration). On a parser
failure `ingest` builds the `QuarantineRecord` from the reason.

### 4.3 Timestamp grammar (normative)

`<timestamp>` must match **all** of:

```
^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$
```

plus calendar validity (month 1–12, day valid for that month, hour ≤ 23,
minute/second ≤ 59; no leap seconds). Rules:

- **Naive** (no offset) = UTC. `T` and space separators are equivalent.
- Offsets `±HH:MM` are applied; result is expressed in UTC.
- Fractional seconds are milliseconds, right-padded to 3 digits:
  `.5` → `.500`, `.25` → `.250`.
- **Canonical form** (used in all output):
  `YYYY-MM-DDTHH:MM:SS.mmmZ` — milliseconds always present.
- Numeric epochs (e.g. `1725148800`) are **not** valid — quarantine.

### 4.4 JSON Lines (`jsonl`)

Each line is a JSON object. Keys are matched **exactly** (case-sensitive);
first matching key wins; unknown keys are ignored.

| Field | Accepted keys | Type |
|---|---|---|
| timestamp | `ts`, `time`, `timestamp` | string (§4.3) |
| level | `level`, `severity` | string (§5 R2) |
| service | `svc`, `service`, `app` | string |
| message | `msg`, `message` | string (may be empty) |
| durationMs | `dur_ms`, `duration_ms`, `durationMs` | number, numeric string, or `null`; optional |

A required field that is **absent or not a string** → `missing field: <name>`.
A value that is valid JSON but not an object → `not an object`. A line that
is not valid JSON → `invalid json`.

### 4.5 CSV

- First line is the header; columns are matched **by name**
  (trimmed, case-insensitive). Required: `timestamp`, `level`, `service`,
  `message`; optional: `duration_ms`; extra columns ignored; first
  occurrence of a duplicate name wins.
- Header missing a required column → **file-level error**
  `CSV_HEADER_INVALID` (exit 1) — never per-line quarantine.
- Quoting per RFC 4180: fields may be double-quoted; `""` escapes a quote;
  quoted fields may contain commas **but not newlines** (line-based reader).
- A row with fewer fields than the header → `short row`. Extra fields beyond
  the header count are ignored. `duration_ms` cell empty → `null`.
- `source.line` counts **file lines** (header = line 1, first data row = 2).

### 4.6 Syslog (simplified — NOT full RFC 3164)

Normative grammar:

```
^([A-Z][a-z]{2}) +(\d{1,2}) (\d{2}):(\d{2}):(\d{2}) (\S+) ([^\[\s:]+)(?:\[\d+\])?: ([A-Za-z]+): ?(.*)$
```

- Month is one of `Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec`
  (capitalized); day is 1–2 digits (both `Sep  1` and `Sep 01` accepted);
  the date must be calendar-valid.
- Syslog lines carry **no year**: the year comes from `--year <yyyy>`
  (default **2026**). Result is UTC midnight-based:
  `Sep  1 12:00:07` + 2026 → `2026-09-01T12:00:07.000Z`.
- The `LEVEL` group is a level alias (§5 R2); unknown → `unknown level: <x>`.
  A line failing the grammar or calendar check → `invalid syslog line`.
- The `[pid]` part and the hostname are accepted and **dropped** (not stored).
- The message (after `LEVEL:` + optional single space) may be empty.

### 4.7 General parsing rules

- **Blank lines** (whitespace-only) are skipped in every format.
- `--format auto` (default) detects **per file** from the first non-blank
  line (§5 R4). An explicit `--format` applies to **all** files and skips
  detection.
- An **empty file** → file-level error `FILE_EMPTY` (exit 1).
- **Data errors** (exit 1: `INPUT_NOT_FOUND`, `FORMAT_UNKNOWN`, `FILE_EMPTY`,
  `CSV_HEADER_INVALID`) abort the entire run **before any output is
  written** — no partial files. Quarantined lines are **not** data errors;
  they never abort a run (unless `--strict`, §5 R3).

## 5. Business rules (each needs a test named for it)

**Pipelines.** `normalize`: files → lines → parse → normalize → canonical
JSONL to `--out`, quarantine records to the quarantine file.
`summary`: same ingest, then `summarize` + render.

| Named test | Rule |
|---|---|
| `normalizes_every_timestamp_to_utc_z` | **R1** — all timestamps to canonical `YYYY-MM-DDTHH:MM:SS.mmmZ` (§4.3); naive = UTC; offsets applied; fractions right-padded |
| `maps_level_aliases_case_insensitively` | **R2** — trim + lowercase, then map: `warn`/`warning`→`warn`; `error`/`err`→`error`; `fatal`/`critical`/`crit`→`fatal`; `trace`, `debug`, `info` as-is |
| `quarantines_unknown_level` | **R2** — anything else → `unknown level: <raw>` |
| `quarantine_carries_raw_source_reason` | **R3** — quarantine record = `{raw, source:{file,line}, reason}`; `raw` is the line verbatim; `source.file` is the path **as passed** |
| `strict_mode_exits_2_on_any_quarantine` | **R3** — `normalize --strict` → exit 2 (usage-class code) if ≥ 1 quarantined line; without `--strict` quarantine is normal operation, exit 0 |
| `detects_format_per_file_from_first_line` | **R4** — first non-blank line starts `{` → `jsonl`; its first comma-separated cell (trimmed, lowercased) is `timestamp` → `csv`; matches §4.6 grammar → `syslog`; else `FORMAT_UNKNOWN` (exit 1) |
| `maps_csv_columns_by_header_name` | **R5** — by name, case-insensitive, extras ignored (§4.5) |
| `missing_csv_column_is_file_error` | **R5** — `CSV_HEADER_INVALID`, exit 1, run aborts before output |
| `dedups_on_timestamp_service_message_keeping_first` | **R6** — `--dedup` key = canonical timestamp + service + message; first in processing order kept; `deduped` = dropped count; summary statistics computed **post-dedup**, `totalEvents` **pre-dedup**. `normalize --dedup` dedups silently |
| `validates_duration_non_negative_number` | **R7** — `durationMs`: absent/`null` → `null`; else finite number ≥ 0 (numeric strings accepted) → `Number` value; anything else → `invalid duration: <raw>` |
| `computes_nearest_rank_percentiles` | **R8** — durations (non-null, post-dedup) sorted ascending, 1-indexed nearest-rank: `rank = ceil(p/100 × n)`. `[10,20,30]`: p50=20, p95=30. `[100,200,300,400]`: p50=200, p95=400. No durations → both `null` |
| `ranks_top_offenders_errors_then_name` | **R9** — per service, count of `error`+`fatal` events; sort count desc, tie → service name asc; only services with ≥ 1 appear; length ≤ `--top` (default 3; `--top 0` → empty) |
| `preserves_input_order_never_sorts_by_timestamp` | **R10** — files in ascending lexicographic order of the path **as passed** (globs expanded, duplicates removed); lines in file order; output order = processing order; **never** sort events by timestamp |
| `exit_codes_data_vs_usage` | **R11** — 0 success (quarantine included); 1 data error (`INPUT_NOT_FOUND`, `FORMAT_UNKNOWN`, `FILE_EMPTY`, `CSV_HEADER_INVALID`); 2 usage (`USAGE`: unknown flag/command, missing `--in`, bad `--format`/`--top`/`--percentiles`/`--year` values, no args) |
| `renders_pinned_table_and_json_bytes` | **R12** — §6.4 byte-exact in both formats |
| `glob_resolves_star_and_doublestar` | `--in` supports `*` (any chars except `/`), `**` (any chars incl. `/`), `?` (single char); matches files only; **lexicographic order** |
| `produces_byte_identical_output_for_equal_input` | determinism — run twice, byte-compare both commands |

**`--top`**: integer 0–100, else `USAGE`. **`--percentiles`**: comma-separated
subset of `p50`,`p95` (default `p50,p95`); anything else → `USAGE`; the
`Summary.percentiles` object always carries **both** keys — unrequested ones
are `null`. **`--year`**: integer 1900–2100, else `USAGE`.

**Quarantine reasons (pinned strings):** `invalid json`, `not an object`,
`missing field: <name>`, `unknown level: <raw>` (trimmed),
`invalid timestamp: <raw>`, `invalid duration: <raw>`, `short row`,
`invalid syslog line`.

**Error envelope (the one error model).** Every failure — including usage —
prints **one single-line JSON object to stderr**:

```json
{"error":{"code":"USAGE","message":"unknown flag: --foo"}}
```

Messages are safe: no stack traces, exception types, or internal paths
beyond the user-supplied `--in`/`--out` values.

## 6. CLI surface & golden outputs

### 6.1 Commands

```
logsluice normalize --in <glob...> [--out <file|->] [--format auto|jsonl|csv|syslog]
                    [--dedup] [--strict] [--year <yyyy>]
logsluice summary   --in <glob...> [--top <n>] [--percentiles <p50,p95>]
                    [--dedup] [--year <yyyy>] [--json]
logsluice --help | -h
logsluice --version | -v
```

Defaults: `--out -` (stdout), `--format auto`, `--top 3`,
`--percentiles p50,p95`, `--year 2026`. `summary` never has `--strict`;
quarantined lines are counted (`Summary.quarantined`) but not written.

### 6.2 Output rules (deterministic)

- Data on **stdout**; errors on **stderr**; nothing else on either. No ANSI
  colors. Numbers rendered via JS default `Number → string`.
- `normalize`: one `LogEvent` per line — compact `JSON.stringify` (keys in
  interface order) — to `--out` (`-` = stdout). Quarantine records — compact
  `JSON.stringify`, keys `raw`, `source`, `reason` — to **`<out>.quarantine`**
  when `--out` is a file, or **`quarantine.jsonl` in the cwd** when `--out`
  is `-`.
- `summary` (table): exactly the layout below — section headers at column 0,
  items as `name␣␣value` (exactly two spaces), sections in the fixed order
  shown, separated by one blank line; zero rows → header only; `null`
  percentile renders as `-`:

```
events  10
quarantined  1
deduped  0

by level
trace  0
debug  1
info  4
warn  1
error  2
fatal  2

by service
api-gateway  4
billing  4
auth  2

top offenders (error+fatal)
billing  3
api-gateway  1

latency (ms)
p50  120
p95  999
```

- `summary --json`: `JSON.stringify(summary, null, 2)` + trailing newline
  (key order = §4.1 interface order).

### 6.3 Fixtures — commit verbatim under `sample/`

`sample/app.jsonl`:

```
{"ts":"2026-09-01T14:00:00+02:00","level":"INFO","svc":"api-gateway","msg":"GET /health","dur_ms":120}
{"ts":"2026-09-01T12:00:01.250Z","level":"warning","service":"auth","msg":"slow login"}
{"ts":"2026-09-01T12:00:02Z","level":"ERR","svc":"billing","msg":"charge failed","dur_ms":480}
{"ts":"2026-09-01T12:00:03Z","severity":"info","app":"api-gateway","message":"GET /users","duration_ms":200}
{"ts":"2026-09-01T12:00:04Z","level":"debug","svc":"api-gateway","msg":"GET /health","dur_ms":120}
{"ts":"2026-09-01T12:00:09Z","level":"verbose","svc":"auth","msg":"meh"}
```

`sample/app.csv`:

```
timestamp,level,service,message,duration_ms,extra
2026-09-01 12:00:05,INFO,billing,"retried, then ok",
2026-09-01 12:00:06,error,api-gateway,timeout,999
2026-09-01 12:00:10,fatal,billing,refund lost,60
```

`sample/app.log`:

```
Sep  1 12:00:07 host billing[7]: FATAL: db conn lost
Sep 01 12:00:08 host auth[8]: info: token refresh
```

Processing order (R10): `sample/app.csv`, `sample/app.jsonl`, `sample/app.log`.
Totals: 10 events, 1 quarantined (`app.jsonl` line 6, `unknown level: verbose`);
durations sorted `[60,120,120,200,480,999]` → p50 = 120, p95 = 999.

### 6.4 Golden outputs

`node dist/cli.js normalize --in "sample/*" --out out.jsonl` → `out.jsonl`
(exit 0):

```
{"timestamp":"2026-09-01T12:00:05.000Z","level":"info","service":"billing","message":"retried, then ok","durationMs":null,"source":{"file":"sample/app.csv","line":2,"format":"csv"}}
{"timestamp":"2026-09-01T12:00:06.000Z","level":"error","service":"api-gateway","message":"timeout","durationMs":999,"source":{"file":"sample/app.csv","line":3,"format":"csv"}}
{"timestamp":"2026-09-01T12:00:10.000Z","level":"fatal","service":"billing","message":"refund lost","durationMs":60,"source":{"file":"sample/app.csv","line":4,"format":"csv"}}
{"timestamp":"2026-09-01T12:00:00.000Z","level":"info","service":"api-gateway","message":"GET /health","durationMs":120,"source":{"file":"sample/app.jsonl","line":1,"format":"jsonl"}}
{"timestamp":"2026-09-01T12:00:01.250Z","level":"warn","service":"auth","message":"slow login","durationMs":null,"source":{"file":"sample/app.jsonl","line":2,"format":"jsonl"}}
{"timestamp":"2026-09-01T12:00:02.000Z","level":"error","service":"billing","message":"charge failed","durationMs":480,"source":{"file":"sample/app.jsonl","line":3,"format":"jsonl"}}
{"timestamp":"2026-09-01T12:00:03.000Z","level":"info","service":"api-gateway","message":"GET /users","durationMs":200,"source":{"file":"sample/app.jsonl","line":4,"format":"jsonl"}}
{"timestamp":"2026-09-01T12:00:04.000Z","level":"debug","service":"api-gateway","message":"GET /health","durationMs":120,"source":{"file":"sample/app.jsonl","line":5,"format":"jsonl"}}
{"timestamp":"2026-09-01T12:00:07.000Z","level":"fatal","service":"billing","message":"db conn lost","durationMs":null,"source":{"file":"sample/app.log","line":1,"format":"syslog"}}
{"timestamp":"2026-09-01T12:00:08.000Z","level":"info","service":"auth","message":"token refresh","durationMs":null,"source":{"file":"sample/app.log","line":2,"format":"syslog"}}
```

`out.jsonl.quarantine` (exit still 0):

```
{"raw":"{\"ts\":\"2026-09-01T12:00:09Z\",\"level\":\"verbose\",\"svc\":\"auth\",\"msg\":\"meh\"}","source":{"file":"sample/app.jsonl","line":6},"reason":"unknown level: verbose"}
```

`node dist/cli.js summary --in "sample/*"` → the §6.2 table **byte-exactly**.

`node dist/cli.js summary --in "sample/*" --json` →

```json
{
  "totalEvents": 10,
  "quarantined": 1,
  "deduped": 0,
  "byLevel": {
    "trace": 0,
    "debug": 1,
    "info": 4,
    "warn": 1,
    "error": 2,
    "fatal": 2
  },
  "byService": [
    {
      "service": "api-gateway",
      "count": 4
    },
    {
      "service": "billing",
      "count": 4
    },
    {
      "service": "auth",
      "count": 2
    }
  ],
  "topOffenders": [
    {
      "service": "billing",
      "errors": 3
    },
    {
      "service": "api-gateway",
      "errors": 1
    }
  ],
  "percentiles": {
    "p50": 120,
    "p95": 999
  }
}
```

`--version` prints `logsluice 1.0.0` (exit 0). An input with zero events
prints `events  0` and header-only sections with `p50  -` / `p95  -`.

## 7. CLI/UX & output quality (scored, not optional polish)

- **`--help` completeness** (exit 0, stdout): both subcommands; every flag
  with meaning and default; all three exit codes with meanings; the error
  envelope shape; the three format grammars with the alias tables; one
  worked `normalize` example. This is the CLI's documentation — the grader
  reads it as such.
- **Determinism**: same input → byte-identical stdout across runs. No
  wall-clock, no locale/culture dependence, no dictionary-order dependence
  (sort ties by name, never by hash order).
- **Stream discipline**: data on stdout, errors on stderr; grader pipes
  stdout to a file and greps for stray output.
- **Safe errors**: envelope messages never leak stack traces, exception
  types, or internal paths.
- **Piped-stable output**: no ANSI codes or colors.

### How it's verified

Grader runs `normalize` + `summary` on the fixtures and byte-compares to
§6.4 (including the quarantine file); feeds each §5 error trigger and checks
code + message + exit status; pipes stdout and inspects stderr; runs twice
to confirm determinism; checks `--strict` exit behavior; greps `src/` for
layering violations (`fs` outside `ingest`, cross-imports between pure
modules, `process.exit` outside `cli`).

## 8. Testing requirements

- **Unit tests, every §5 rule by name** plus: parser edge matrix (JSONL —
  invalid json, not-an-object, missing key, wrong type, duration as
  string/null/negative; CSV — quoted commas, escaped quotes, short row,
  header case-insensitivity; syslog — both day paddings, missing pid,
  unknown level, calendar-invalid date), timestamp matrix (naive, `Z`,
  offsets, `.5` padding, Feb 30), detect matrix (all three + unknown),
  percentile pinned examples, dedup keep-first, top-offender tie-breaks,
  lexicographic file order.
- **Golden tests**: run §6.4 invocations **in process** via `runCli(argv)`,
  capture stdout/stderr, byte-compare (incl. quarantine file and exit
  codes). **Launching the CLI as a subprocess in tests is banned** — it
  silently dodges the coverage gate.
- Determinism test: run each command twice in-process, byte-compare.
- Coverage ≥ 85% lines on `src/**` (v8 provider). Zero warnings;
  `strict: true`; tests must not use the network, real timers, or
  `Date.now`-dependent expectations.

## 9. Commands

| Purpose | Command |
|---|---|
| Install | `npm install` |
| Build | `npm run build` |
| Run | `node dist/cli.js <command> --in "sample/*" ...` |
| Test | `npm test` |
| Coverage | `npx vitest run --coverage` |

## 10. Documentation

README: goal, quickstart (≤ 3 commands from clean checkout), architecture
overview (slice map, layering rules), the three format grammars + alias
tables, the §6.4 worked example, exit-code + error-code table, quarantine
semantics, test/coverage instructions.
