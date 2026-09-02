# PLAN — logsluice

**Agent/Model**: pi / deepseek-v4-flash-vision-exp
**Started**: 2026-09-02
**Spec**: specs/04-typescript-logsluice/SPEC.md
**Mode**: unattended: plan self-approved

## Understanding of the task

Build Logsluice, a Node ≥ 20 ESM TypeScript CLI that normalizes mixed-format log files (JSONL, CSV, simplified syslog) into a canonical JSONL event stream, quarantines unparseable lines with pinned reasons, and prints deterministic summary reports. The hard parts: exact §4.3 timestamp canonicalization (offset math, fraction padding, calendar validation), byte-deterministic output (golden §6.4), pinned quarantine reasons and exit-code classes, custom glob expansion (`*`, `**`, `?`), and strict layering (pure modules import only `types.ts`; only `ingest.ts` touches `fs`; only `cli.ts` calls `process.exit`/writes stdout). Coverage gate is ≥ 85% lines on `src/**`.

## Task breakdown

- [x] T1 — Scaffold project: package.json (type module, engines ≥ 20), tsconfig strict, vitest config with v8 coverage, .gitignore, sample fixtures verbatim, src/types.ts verbatim §4.1
      Accept: `npm install` + `npm run build` green; fixtures byte-match spec §6.3.  ✔ done (commit 18b50e7)
- [x] T2 — Parser slice S1–S3: parsers/jsonl.ts, parsers/csv.ts (RFC 4180), parsers/syslog.ts + full edge-matrix tests
      Accept: every §8 parser edge matrix case passes with pinned reasons; pure (imports only types.ts).  ✔ done (36 parser tests green)
- [x] T3 — S4 normalize.ts: timestamp R1 canonicalization, level aliases R2, duration R7, quarantine reasons + tests (timestamp matrix, alias matrix, duration matrix)
      Accept: R1/R2/R7 tests pass; normalizeFields returns LogEvent | QuarantineRecord; pure.  ✔ done (8 tests green)
- [x] T4 — S5 detect.ts per-file sniffing + detect matrix tests
      Accept: R4 detect matrix (all three + unknown) passes; pure.  ✔ done (4 tests green)
- [x] T5 — S6 summary.ts (dedup R6, percentiles R8, offenders R9) + S7 report.ts renderers + tests
      Accept: R6/R8/R9 pinned examples pass; renderTable/renderJson byte-exact per §6.2; pure.  ✔ done (13 tests green)
- [x] T6 — S8 ingest.ts: glob expansion (*, **, ?), lexicographic ordering R10, file-level errors (INPUT_NOT_FOUND, FORMAT_UNKNOWN, FILE_EMPTY, CSV_HEADER_INVALID), quarantine assembly R3, no partial writes + tests
      Accept: R3/R10/glob/error-abort tests pass; only module importing node:fs.  ✔ done (14 tests green)
- [x] T7 — S9 cli.ts: argv parsing, error envelope, exit codes R11, help §7, version, strict R3, dedup R6, golden byte tests via runCli, determinism test
      Accept: §6.4 golden byte-exact in-process; R11 exit-code matrix green; help complete.  ✔ done (26 tests green)
- [x] T8 — Quality gates + docs: npm run build, npm test, coverage ≥ 85% via `npx vitest run --coverage`, smoke `node dist/cli.js` on sample/, README + decisions, closing bookkeeping
      Accept: all gates green; smoke byte-matches golden outputs; README complete.  ✔ done (see final report)

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | CSV `short row`: row is short only when it has fewer fields than the last mapped (required + `duration_ms`) column index + 1; missing only *unmapped extra* columns is NOT short | §6.4 fixture `app.csv` has a 6-column header but 5-field data rows that must parse as events; literal "fewer fields than header" would quarantine them and contradict the golden. |
| 2 | `normalizeFields` returns `QuarantineRecord` with `raw: ""`; `ingest.ts` fills `raw` with the verbatim line | Pinned signature has no raw-line parameter; `raw` must be the line verbatim (R3), so ingest owns it. |
| 3 | `--in` collects multiple values after the flag (until next flag); values are also accepted when the shell expands a glob into several args | Matches `--in <glob...>` and the §6.4 `--in "sample/*"` usage. |
| 4 | Blank lines are skipped but still count toward `source.line` (physical file line numbers) | "source.line counts file lines" (§4.5); physical numbering is the literal reading. |
| 5 | `detectFormat` matches syslog by grammar only (regex); month-list/calendar validity is left to the syslog parser → `invalid syslog line` | §4.6 grammar defines detection (R4: "matches §4.6 grammar → syslog"); semantic validity quarantines the line instead of aborting the file. |
| 6 | Language: if `--format`/`--year`/etc. is invalid the whole run fails even for files that don't need it | `--format` applies to all files; `--year` is validated once at parse time (R11). |
| 7 | Output write failures emit `USAGE` envelope (exit 2) with `cannot write: <path>`; parent dirs auto-created | Keeps one error model; write failures are not in the pinned data-code list. |
| 8 | No ESLint/Prettier/editorconfig: `tsc --strict` with zero warnings is the lint gate | Spec §2 limits devDependencies to typescript/vitest/@types/node (+ required @vitest/coverage-v8); spec wins over the general standards note. |
| 9 | `runCli` is `async` returning `Promise<number>` | File I/O is async (standards §6); in-process tests `await runCli(...)`. The bin entry awaits and calls `process.exit` — only cli.ts calls it. |

## Final report (fill at the end)

- Wall-clock time: ≈ 00:48 (scaffold 01:31 → close 02:19, single session)
- Total tokens consumed (in + out) + avg output t/s: not exposed by this harness session — unknown (consciously not fabricated)
- Errors/retries (build/test/lint): 5 test-authoring mistakes fixed in-flight (glob ordering expectation, non-spec bracket glob, tmp-file name collision, promisified chdir, --out - expectation); 0 build/lint errors; 0 warnings
- Final coverage: 95.6% lines (All files, v8 provider) via `npx vitest run --coverage` — gate ≥ 85% passed
- Line counts per directory: src 978 (cli 321 incl. ~150-line --help text; ingest 221; normalize 111; parsers 166; summary 68; detect 23; report 28; types 40) + tests 1,241 + README/PLAN
- Deviations from spec: none functional; see decisions table (CSV short-row leniency is the only interpretive one, forced by §6.4's own fixture)
