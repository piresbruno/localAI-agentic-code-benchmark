# PLAN — fastcrc

**Agent/Model**: pi / DeepSeekV4Flash-Vision-EXP-ablit
**Started**: 2026-09-02
**Spec**: specs/06-csharp-fastcrc/SPEC.md
**Mode**: unattended: plan self-approved

## Understanding of the task

Build Fastcrc, a micro-tier .NET 8 console CLI that prints the CRC-32
(IEEE 802.3) checksum of a file as 8 lowercase hex characters. The hard
parts are exact CRC-32 semantics (reflected polynomial 0xEDB88320, init/xor
0xFFFFFFFF), strict stream discipline (checksum on stdout only; one-line
JSON error envelope on stderr), and a clean layering split that the grader
grep-checks (Crc pure, Io the only file I/O module, only Cli touches
Console, Program is a shim). Deliverable must stay inside 60–120 LOC under
`src/` and hit ≥85% line coverage on the Fastcrc assembly with byte-exact
golden outputs.

## Task breakdown

- [x] T1 — Scaffold run directory per benchmark workflow; commit scaffold
      Accept: results/fastcrc/<run-id>/ exists with AGENTS.md/CLAUDE.md/METRICS.md/RESULT.md/tasks/, committed.
- [ ] T2 — Write tasks/PLAN.md and commit it
      Accept: PLAN.md present, tasks enumerated, committed.
- [ ] T3 — Create solution + src modules (Program/Crc/Io/Cli) + sample/check.txt; `dotnet build` zero errors/warnings
      Accept: BUILD_CHECK green (dotnet build, no warnings).
- [ ] T4 — Write xUnit tests named R1–R8 per spec §5; all pass in-process
      Accept: `dotnet test` all green, no skips.
- [ ] T5 — Meet coverage gate: line coverage ≥85% on Fastcrc assembly (coverlet)
      Accept: coverage report shows ≥85% on src/Fastcrc.
- [ ] T6 — Smoke: `--help` exit 0, `--version` = fastcrc 1.0.0, `--in sample/check.txt` prints cbf43926 byte-exact
      Accept: SMOKE_CHECK outputs match spec §6.2.
- [ ] T7 — Write README.md (goal, quickstart ≤3 commands, architecture, algorithm, exit/error table, test/coverage)
      Accept: README complete; committed.
- [ ] T8 — Extract token/usage metrics from harness session data; fill METRICS.md yaml; append results log row to BENCHMARKS.md; final report
      Accept: METRICS yaml filled from session telemetry; BENCHMARKS.md log row appended; final commit.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | Test package versions pinned to whatever restores (xunit 2.9.x, coverlet.collector 6.x) | Spec leaves versions open; boring, supported versions only. |
| 2 | `--in <file>` with extra positional → USAGE ("unexpected argument") | Spec R6 lists "extra positional" as usage; strict parsing is the simpler reading. |
| 3 | Missing file due to missing directory also maps to INPUT_NOT_FOUND | File.ReadAllBytes throws DirectoryNotFoundException for a missing dir; both are data errors (exit 1), not usage. |
| 4 | No subprocess launches in tests; Console.SetOut/SetError capture for R4–R8 | Spec §8 requires in-process tests (no subprocess). |
| 5 | No global.json; builds with installed SDK (8.0.203 present) targeting net8.0 | Spec requires net8.0; SDK 10 also builds it. Message: whichever SDK, `dotnet build` works. |

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source):
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
