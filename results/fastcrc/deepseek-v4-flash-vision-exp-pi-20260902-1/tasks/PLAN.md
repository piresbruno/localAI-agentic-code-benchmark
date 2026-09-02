# PLAN — fastcrc

**Agent/Model**: pi / deepseek-v4-flash-vision-exp
**Started**: 2026-09-02
**Spec**: specs/06-typescript-fastcrc/SPEC.md (micro tier, ~10-min serial build)
**Mode**: unattended: plan self-approved

## Understanding of the task

Build Fastcrc, a TypeScript CLI that prints the CRC-32 (IEEE 802.3/ISO-HDLC) checksum of a file: one command (`--in <file>`), one pure algorithm module, one error model, 60–120 LOC. This is a speed-calibration micro probe — exactness on CRC semantics (poly/init/xor) and stream discipline are the discriminators; no parallelism expected (max_agents informational only).

## Task breakdown

- [x] T1 — Scaffold: package.json (type module), tsconfig strict, vitest v8 config, .gitignore, sample/check.txt verbatim (9 bytes, no trailing newline)
      Accept: `npm install` + `npm run build` green; fixture byte-exact.
- [x] T2 — crc.ts pure `crc32(data: Uint8Array): number` + unit tests (R1–R3 pins cross-checked against python zlib.crc32)
      Accept: pinned values `cbf43926` (123456789), `352441c2` (abc), `3610a686` (hello), `81dda740` ({00 ff 80}), empty → 0.
- [x] T3 — cli.ts `runCli`, help §7, version, envelope `{"error":{code,message}}`, exit codes 0/1/2 + CLI tests (R4–R8)
      Accept: golden `cbf43926\n` byte-exact; error matrix exit codes green.
- [x] T4 — Gates + docs + bookkeeping: coverage ≥ 85%, smoke via dist, README, METRICS/BENCHMARKS, commits
      Accept: coverage ≥ 85%; smoke byte-match; tree clean.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | `crc32` returns a `number` (unsigned via `>>> 0`) and CLI pads to 8 lowercase hex | JS number is 53-bit safe; exact output bytes per §4. |
| 2 | `--in` consumes exactly one value; extra positional → USAGE `unknown argument` | Strict boundary validation per standards; spec R6 mentions extra positional args. |
| 3 | Input read errors all map to `INPUT_NOT_FOUND` | Only failure class for the single input path (spec R5). |
| 4 | Sample pinned values independently cross-checked with python `zlib.crc32` (not guessed) | Avoids baking wrong goldens into tests. |

## Final report (fill at the end)

- **Model id: `deepseek-v4-flash-vision-exp` (harness: `pi`)** — run dir `results/fastcrc/deepseek-v4-flash-vision-exp-pi-20260902-1`
- Wall-clock time: ≈ 00:07 (scaffold 03:25 → close ~03:32) — under the ~10-minute target
- Total tokens consumed (in + out) + avg output t/s: not exposed by this harness session — unknown (recorded `—`)
- Errors/retries (build/test/lint): 1 (one wrong test pin `2dfd3a11` for {00,ff} — corrected to `6cdbfd72` against python zlib); 0 build warnings
- Final coverage (number + measurement command): 96.42% lines via `npx vitest run --coverage` (v8) — gate ≥ 85% passed
- Line counts per directory: src 68 (crc 26, cli 42 incl. help text); tests 197; README/PLAN
- Deviations from spec: none functional (see decisions table)
