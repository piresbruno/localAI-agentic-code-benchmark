# PLAN — fastcrc

**Agent/Model**: pi / DeepSeekV4Flash-Vision-EXP-ablit
**Started**: 2026-09-02
**Spec**: specs/06-csharp-fastcrc/SPEC.md
**Mode**: unattended — plan self-approved

## Understanding of the task

Build a tiny .NET 8 console CLI that prints the CRC-32 (IEEE 802.3/ISO-HDLC) checksum of a file as 8 lowercase hex chars. The hard parts are exact CRC semantics (reflected poly 0xEDB88320, init/xorout 0xFFFFFFFF) and strict CLI discipline: one JSON error envelope on stderr, exit codes 0/1/2, byte-deterministic output, complete `--help`. Layering is pinned by the spec: pure `Crc.cs`, I/O only in `Io.cs`, `Console` only in `Cli.cs`, `Program.cs` is a one-line shim. Coverage gate ≥ 85% on the Fastcrc assembly; micro-tier ≤ 120 LOC in `src/`.

## Task breakdown

- [x] T1 — Scaffold solution, projects, sample/check.txt, .gitignore
      Accept: `dotnet build` green; `sample/check.txt` is exactly `123456789` (9 bytes, no trailing newline).
- [x] T2 — Implement `Crc.cs` (pure bit-wise CRC-32)
      Accept: tests R1–R3 (pinned values, empty → 0, binary + 1 MiB deterministic/correct) pass.
- [x] T3 — Implement `Io.cs` + `Cli.cs` (parse, envelope, exit codes, help/version)
      Accept: `dotnet build` green; manual `--help`, `--version`, `--in` smoke run OK.
- [x] T4 — Add boundary tests R4–R8 (stdout discipline, missing file, exit codes, help/version completeness, determinism, golden)
      Accept: `dotnet test` all green.
- [x] T5 — Verify gates: `dotnet build` zero warnings, `dotnet test`, coverage ≥ 85% (coverlet), §6.2 golden byte-exact, error trigger spot-check
      Accept: BUILD_CHECK/TEST_CHECK/COVERAGE_CHECK/SMOKE_CHECK all pass; coverage recorded.
- [x] T6 — README.md + final report in PLAN.md
      Accept: README has goal, ≤3-command quickstart, architecture, algorithm constants, example, exit/error table, test/coverage instructions.
- [x] T7 — Metrics + BENCHMARKS.md bookkeeping, final commit
      Accept: yaml block filled from harness telemetry; results log row appended; closing commit made.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | `<ImplicitUsings>disable</ImplicitUsings>` in src + explicit usings | Crc.cs purity is grep-checked; no implicit `System.IO` in scope anywhere under `src/`. |
| 2 | Bit-wise (not table-driven) CRC loop | Spec allows both; bit-wise is ~12 lines, deterministic, and 1 MiB is still microseconds. |
| 3 | Envelope serialized with `System.Text.Json` (BCL) | Guarantees valid, single-line, correctly escaped JSON (user-supplied paths may contain quotes/backslashes). |
| 4 | `--help`/`-h` and `--version`/`-v` accepted only as the sole argument; anything else → USAGE | Simplest reading of "unknown flags/extra positional args → USAGE". |
| 5 | Any `Io.ReadAllBytes` failure → `INPUT_NOT_FOUND` (exit 1) | One data-error model; message contains only the user-supplied path, no exception types. |
| 6 | Test packages pinned to versions present in local NuGet cache (xunit 2.9.3, runner 2.8.2, Test.Sdk 17.14.1, coverlet 6.0.4) | Offline-safe restore; no network dependence. |

## Final report (fill at the end)

- Wall-clock time: 00:19:58 (harness session start 06:22:43Z → last message; source: omp session JSONL)
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source): 4,220,603 total (4,173,822 in incl. 4,055,552 cache-read; 46,781 out) from omp session JSONL; avg 39.03 t/s = output ÷ wall time (generation time not exposed)
- Errors/retries (build/test/lint): 3 — (1) build CS0103 `Cli` not found: top-level statements are in the global namespace, added `using Fastcrc;` to Program.cs; (2) build xUnit2013 analyzer: `Assert.Equal(1, ...Length)` → `Assert.Single`; (3) one malformed edit-tool call corrupted a line in CliTests.cs, repaired by rewriting the line. No test failures at any point after fixes.
- Final coverage (number + measurement command): 97.77% lines / 100% branch on the Fastcrc assembly via `dotnet test --collect:"XPlat Code Coverage"` (coverage.cobertura.xml)
- Line counts per directory: `src/Fastcrc` 117 (Program.cs 2, Crc.cs 22, Io.cs 10, Cli.cs 83); `tests/Fastcrc.Tests` 233 (AlgorithmTests.cs 46, CliTests.cs 187); sample/check.txt 1
- Deviations from spec: none
