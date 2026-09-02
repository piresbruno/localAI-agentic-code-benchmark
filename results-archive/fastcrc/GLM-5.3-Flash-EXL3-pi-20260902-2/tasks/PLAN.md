# PLAN — fastcrc

**Agent/Model**: pi / GLM-5.3-Flash-EXL3
**Started**: 2026-09-02 15:30 (local)
**Spec**: specs/06-csharp-fastcrc/SPEC.md
**Mode**: unattended — unattended: plan self-approved

## Understanding of the task

Fastcrc is a micro-tier .NET 8 console CLI that prints the CRC-32 (IEEE 802.3 / ISO-HDLC) checksum of one file as exactly 8 lowercase hex characters. The difficulty is exactness, not breadth: a reflected algorithm with poly 0xEDB88320 and init/xorout 0xFFFFFFFF, byte-exact stdout (`cbf43926\n`), one single-line JSON error envelope on stderr with exactly two codes (`INPUT_NOT_FOUND` → exit 1, `USAGE` → exit 2), and a `--help` surface documenting command, flags, exit codes, envelope, algorithm, and a worked example. Architecture is pinned: pure `Crc.cs`, file-I/O-only `Io.cs`, Console-only `Cli.cs`, exit-code-only `Program.cs`; 60–120 LOC under `src/`; 8 named tests (R1–R8), all in-process; ≥85% line coverage on the `Fastcrc` assembly.

## Task breakdown

- [x] T1 — Scaffold: classic `fastcrc.sln`, `src/Fastcrc` csproj (net8.0, Nullable enable, TreatWarningsAsErrors), `Program.cs` shim, compiling stubs for `Crc`/`Cli` (`Io` is final), `sample/check.txt` verbatim (9 bytes, no trailing newline), run-dir `.gitignore`
      Accept: `dotnet build` green from run dir; fixture is byte-exact.
- [x] T2 — TDD the algorithm: `CrcTests` for R1–R3 red first, then table-driven `Crc32`
      Accept: `computes_pinned_crc32_check_values`, `empty_input_has_zero_crc`, `handles_binary_and_long_input` green; oracle values cross-checked against Python `zlib.crc32`.
- [x] T3 — TDD the CLI: `CliTests` for R4–R8 red first, then full `Cli.cs` (parsing, envelope, exit codes, help/version)
      Accept: all five named tests green; usage triggers (no args, unknown flag, missing `--in` value, extra positional) → `USAGE`/2; missing file → `INPUT_NOT_FOUND`/1.
- [x] T4 — Quality gates: full build (0 warnings), `dotnet test` 100%, coverage ≥85% on the Fastcrc assembly, smoke matrix (`--help`/`-h`/`--version`/`-v`/`--in` golden + every error trigger), layering greps, clean-checkout proof via `git archive`
      Accept: every gate green with recorded numbers.
- [x] T5 — Docs & bookkeeping: README per spec §10, PLAN final report, METRICS.md from harness telemetry, BENCHMARKS.md row
      Accept: README covers goal/quickstart/architecture/algorithm/example/tables/tests; closing commits made.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | `ImplicitUsings` disabled; explicit usings everywhere | Self-documenting files in a LOC-counted micro-tier; deterministic across SDK versions |
| 2 | Classic `.sln` hand-written (not `.slnx`) | Spec pins `fastcrc.sln`; SDK 10 `dotnet new sln` emits `.slnx` |
| 3 | Non-missing read failures (directory path, permission) also map to `INPUT_NOT_FOUND` | Spec defines exactly two error codes; data-layer failures must not escape the one error model |
| 4 | `--in` value that is empty string treated as missing value → `USAGE` | `File.ReadAllBytes("")` throws `ArgumentException`; empty string is not a usable value |
| 5 | stdout newline emitted as literal `\n`, not `Environment.NewLine` | Byte-exact golden output (§6.2) independent of platform |
| 6 | Tests disable xUnit parallelization (assembly attribute) | R4–R8 redirect the process-wide Console; parallel capture would interleave |
| 7 | Package versions pinned to the local NuGet cache (xunit 2.9.3, runner 2.8.2, test sdk 17.12.0, coverlet 6.0.4) | Offline-safe restore; sandbox must not depend on network |

## Final report (fill at the end)

- Wall-clock time: 00:37:41 (session JSONL first→last record, 15:26:46 → 16:04:27 local)
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source): 5,510,720 (in 5,455,993 + out 54,727; cacheRead 0) — source: pi harness session JSONL; avg 24.2 t/s (output ÷ wall; generation time not exposed)
- Errors/retries (build/test/lint): 3 compile errors (2× CS0246 missing `using System;` on T1 stubs, 1× CS0103 missing `using System.Text;` in tests) + 1 coverage-gate miss (84.21%, closed with branch tests) — all fixed forward, zero failing tests at close
- Final coverage (number + measurement command): 98.48% lines on the `Fastcrc` assembly via `dotnet test --collect:XPlat Code Coverage` (coverlet; cobertura `package name="Fastcrc"`)
- Line counts per directory: src/Fastcrc 128 non-blank / 154 raw (Program 2/4, Crc 19/21, Io 8/11, Cli 99/118); tests/Fastcrc.Tests 174 non-blank / 195 raw (excluded from spec LOC)
- Deviations from spec: none functional. LOC 128 vs 120 advised (see decisions/README); decisions #1–#7 are spec-silent choices, not deviations.
