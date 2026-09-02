# PLAN — fastcrc

**Agent/Model**: pi / DeepSeekV4Flash-Vision-EXP
**Started**: 2026-09-02
**Spec**: specs/06-csharp-fastcrc/SPEC.md
**Mode**: unattended: plan self-approved

## Understanding of the task

Build `fastcrc`, a .NET 8 console that prints the CRC-32 (IEEE 802.3) checksum of a file (`--in <file>`), 8 lowercase hex chars + newline. Layered: `Crc.cs` pure algorithm, `Io.cs` sole file-I/O, `Cli.cs` sole Console/argv/envelope/exit-code module, `Program.cs` entry shim. One error model (`{"error":{"code":…,"message":…}}` to stderr), exit codes 0/1/2, complete `--help`. xUnit tests cover §5 R1–R8 by name plus golden/byte-identical runs; coverage ≥85% on the Fastcrc assembly. Hardest part: exact reflected CRC semantics (poly 0xEDB88320, init/xorout 0xFFFFFFFF) and keeping layering greppable under `TreatWarningsAsErrors`.

## Task breakdown

- [x] T1 — Create sln + src/tests csprojs + empty skeleton; `dotnet build` green.
      Accept: BUILD_CHECK green with empty skeleton.
- [x] T2 — Implement `Crc.cs` (pure bit-wise reflected CRC-32). Accept: R1/R2 unit checks pass.
- [x] T3 — Implement `Io.cs` (sole file I/O, `ReadAllBytes`). Accept: reads fixture bytes.
- [x] T4 — Implement `Cli.cs` (argv parse, envelope, exit codes, help/version) + `Program.cs` shim + `sample/check.txt`.
      Accept: R4–R8 behavior correct.
- [x] T5 — xUnit tests R1–R8 + golden + determinism (one Console class). Accept: `dotnet test` 9/9.
- [x] T6 — Verify gates: build 0 warnings, test 9/9, coverage ≥85%, smoke golden outputs.
      Accept: gates green.
- [x] T7 — README (goal, ≤3-cmd quickstart, architecture, algorithm, example, exit/error table, test/coverage).
      Accept: README complete; docs committed.
- [x] T8 — Bookkeeping: METRICS.md yaml, BENCHMARKS.md log row, closing commit, final report.
      Accept: log row appended; METRICS filled from telemetry.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | Bit-wise reflected CRC (not table-driven) | Simpler, deterministic, trivially correct; spec allows either. |
| 2 | Model id `DeepSeekV4Flash-Vision-EXP`, harness `pi` | Honest self-identification from workstation model string (`deepseek-v4-flash-vision-exp`) + Oh My Pi harness. |
| 3 | xUnit Console capture in a single test class | `Console.SetOut/SetError` is process-global; xUnit runs classes in parallel, so all Console-touching tests share one class. |

## Final report

- Wall-clock time: 00:05:54 (omp session start → last message)
- Total tokens consumed (in + out): 3,888,074 (input+cache-read 3,837,102 + output 50,972); avg output t/s 143.66 (output ÷ wall; source: omp session JSONL)
- Errors/retries (build/test/lint): 0 — one throwaway `.tmp` file created and removed; one coverage `TestResults/` XML staged by mistake, untracked in an amended commit; no build/test/lint failures
- Final coverage: 98.71% lines on the Fastcrc assembly via `dotnet test --collect:"XPlat Code Coverage"` (gate ≥85%)
- Line counts per directory: src/Fastcrc 112 non-blank (Cli 83, Crc 19, Io 8, Program 2); tests/Fastcrc.Tests 132; sample 1
- Deviations from spec: none
