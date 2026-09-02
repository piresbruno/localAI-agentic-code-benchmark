# Logsluice

Log normalizer & summary CLI: ingests mixed-format application logs (JSON
Lines, CSV, simplified syslog), normalizes every parseable line into a
canonical JSONL event stream, moves every unparseable line into a quarantine
file with a pinned reason, and prints deterministic summary reports
(level/service counts, top offenders, latency percentiles).

Zero runtime dependencies — Node stdlib only. Byte-deterministic output
(same input → identical bytes).

## Quickstart

```bash
npm install
npm run build
node dist/cli.js --help
```

## Run

```bash
# Normalize fixture logs into canonical JSONL + quarantine file
node dist/cli.js normalize --in "sample/*" --out out.jsonl
#   → out.jsonl (events) and out.jsonl.quarantine (unparseable lines)

# Deterministic summary as table or JSON
node dist/cli.js summary --in "sample/*"
node dist/cli.js summary --in "sample/*" --json
```

Options and defaults are documented by `node dist/cli.js --help` (this is the
CLI's documentation; see §6.1–6.2 of the spec for the pinned surface).

## Architecture

```
src/
├── types.ts            canonical model (§4.1 contract — committed verbatim)
├── parsers/            S1–S3 format grammars: jsonl.ts, csv.ts, syslog.ts
├── normalize.ts        S4 semantic rules (timestamps, levels, durations)
├── detect.ts           S5 per-file format sniffing
├── summary.ts          S6 dedup, counts, top offenders, nearest-rank percentiles
├── report.ts           S7 pure table/JSON renderers (byte-exact layouts)
├── ingest.ts           S8 glob expansion, file reading, orchestration, output writes
└── cli.ts              argv parsing, error envelope, exit codes (runCli + shim)
```

**Layering rules (enforced, greppable):**

- `parsers/*`, `normalize.ts`, `detect.ts`, `summary.ts`, `report.ts` are
  pure: they import only from `types.ts` — never from each other, never
  `fs`, never `process`.
- `ingest.ts` is the only module doing file I/O; it imports the pure modules.
- `cli.ts` imports `ingest.ts` + `report.ts`; it is the only module that
  writes to stdout/stderr and the only one that calls `process.exit`
  (through the `dist/cli.js` entry shim).
- Formatters return strings; business rules never touch `fs`.

The slices are contract-first and independent: each pure module implements
the §4.1 contract with no cross-slice imports, so they can be implemented
and tested in any order.

## Format grammars

### JSON Lines
One JSON object per line. Keys are matched exactly (case-sensitive); the
first matching key wins; unknown keys are ignored.

| Field | Accepted keys | Type |
|---|---|---|
| timestamp | `ts`, `time`, `timestamp` | string (§4.3) |
| level | `level`, `severity` | string (alias table below) |
| service | `svc`, `service`, `app` | string |
| message | `msg`, `message` | string (may be empty) |
| durationMs | `dur_ms`, `duration_ms`, `durationMs` | number, numeric string, or `null`; optional |

### CSV
RFC 4180 quoting (`""` escapes a quote; quoted fields may contain commas but
not newlines — line-based reader). Line 1 is the header; columns are matched
by name (trimmed, case-insensitive); the first occurrence of a duplicate name
wins. Required columns: `timestamp`, `level`, `service`, `message`; optional:
`duration_ms`; extra columns are ignored. A header missing a required column
is a file error (`CSV_HEADER_INVALID`, exit 1) — never per-line quarantine.

### Syslog (simplified)
```
Mmm dd HH:MM:SS host tag[pid]: LEVEL: message
```
Months are `Jan`–`Dec` (capitalized); day is 1–2 digits and must be
calendar-valid; the year comes from `--year` (default 2026); the hostname and
`[pid]` are dropped. A line failing the grammar or calendar is quarantined
with `invalid syslog line`.

### Timestamps (§4.3, normative)
```
^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$
```
plus calendar validity (no leap seconds). Naive timestamps are UTC; offsets
are applied and the result is expressed in UTC; fractional seconds are
milliseconds right-padded to 3 digits. Canonical output form is always
`YYYY-MM-DDTHH:MM:SS.mmmZ`. Numeric epochs are invalid.

### Level aliases (§5 R2)
Trimmed and lowercased, then: `trace`, `debug`, `info` as-is; `warn`/`warning`
→ `warn`; `error`/`err` → `error`; `fatal`/`critical`/`crit` → `fatal`.
Anything else quarantines the line with `unknown level: <raw>`.

## Worked example (§6.4)

```bash
node dist/cli.js normalize --in "sample/*" --out out.jsonl
node dist/cli.js summary --in "sample/*"
```

`sample/*` processes `sample/app.csv`, `sample/app.jsonl`,
`sample/app.log` in lexicographic path order — 10 events, 1 quarantined
line (`unknown level: verbose`). The produced event stream, quarantine file,
summary table and `--json` output reproduce the spec's §6.4 golden bytes
byte-exactly (verified by in-process golden tests and the smoke check).

## Exit codes & error envelope

| Exit | Meaning |
|---|---|
| 0 | Success (quarantined lines alone do not fail a run) |
| 1 | Data error: `INPUT_NOT_FOUND`, `FORMAT_UNKNOWN`, `FILE_EMPTY`, `CSV_HEADER_INVALID` — aborts before any output is written |
| 2 | Usage error (`USAGE`): unknown flag/command, missing `--in`, invalid `--format`/`--top`/`--percentiles`/`--year`, no arguments. Also `--strict` with ≥ 1 quarantined line |

Every failure prints exactly one single-line JSON object to **stderr**:

```json
{"error":{"code":"USAGE","message":"unknown flag: --foo"}}
```

Messages never leak stack traces, exception types, or internal paths.

## Quarantine semantics

Unparseable lines are never data errors. Each is recorded as
`{"raw": <line verbatim>, "source": {"file": <path as passed>, "line": <physical line>}, "reason": <pinned reason>}`.

Pinned reasons: `invalid json`, `not an object`, `missing field: <name>`,
`unknown level: <raw>`, `invalid timestamp: <raw>`, `invalid duration: <raw>`,
`short row`, `invalid syslog line`.

`normalize` writes quarantine records to `<out>.quarantine` (or
`quarantine.jsonl` in the cwd when `--out -`). `summary` counts them
(`quarantined`) but does not write them. `normalize --strict` exits 2 if any
line was quarantined; without `--strict` the run succeeds (exit 0).

## Testing & coverage

```bash
npm test                      # vitest run — 101 tests
npx vitest run --coverage     # v8 provider; gate: ≥ 85% lines on src/**
```

- Every §5 business rule has a test named after it (e.g.
  `normalizes_every_timestamp_to_utc_z`, `strict_mode_exits_2_on_any_quarantine`,
  `computes_nearest_rank_percentiles`, `renders_pinned_table_and_json_bytes`).
- Parser edge matrices, timestamp matrix, detect matrix, percentile pinned
  examples, dedup keep-first, top-offender tie-breaks, lexicographic file
  order and determinism (run twice, byte-compare) are covered.
- Golden §6.4 tests run **in process** via `runCli(argv)` (no subprocess
  launches — coverage stays honest).
- Tests use temp directories only; no network, no real timers.

## Decisions & deviations

See `tasks/PLAN.md` → "Decisions & spec deviations" for the full table. The
two spec-adjacent judgements: (1) `short row` compares the row to the last
mapped column instead of the raw header length, because §6.4's own fixture
has a 6-column header with 5-field data rows that must parse as events; (2)
`normalizeFields` returns the quarantine record without the raw line (its
pinned signature has no raw parameter) and `ingest` fills `raw` with the
verbatim line, preserving R3 byte-exactly.
