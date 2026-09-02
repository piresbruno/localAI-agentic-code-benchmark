# PLAN — fastcrc

**Agent/Model**: GLM-5.3-Flash-OpenRouter
**Started**: 2026-09-02
**Spec**: specs/06-csharp-fastcrc/SPEC.md
**Mode**: unattended — plan self-approved

## Understanding of the task

Fastcrc is a micro-tier .NET 8 console tool that prints the CRC-32/IEEE 802.3
checksum of a file as 8 lowercase hex chars. The spec pins the architecture
(`Crc` pure algorithm, `Io` sole file-I/O, `Cli` sole Console owner, `Program`
a one-line shim), the algorithm constants (reflected poly 0xEDB88320, init and
xorout 0xFFFFFFFF), one JSON error envelope on stderr (USAGE→2, INPUT_NOT_FOUND→1),
and eight named xUnit tests R1–R8, all in-process. Hard parts are exactness
(reflected CRC semantics, byte-exact golden output, stream discipline) and the
60–120 LOC budget under `src/` — breadth is intentionally nil.

## Task breakdown

- [ ] T1 — Scaffold project skeleton per §3 (sln, src/Fastcrc csproj + Program shim,
      tests/Fastcrc.Tests xUnit + coverlet); Accept: `dotnet build` zero errors/warnings.
- [x] T2 — `Crc.cs` pure table-driven CRC-32 + tests R1–R3 (pinned values, empty,
      binary + 1 MiB pattern); Accept: R1–R3 green, values match zlib oracle.
- [x] T3 — `Io.cs` `ReadAllBytes` (only file-I/O module); Accept: build green,
      wired as Cli's only read path.
- [x] T4 — `Cli.cs` argv parsing, JSON error envelope, exit codes + tests R4–R6;
      Accept: success/0, data/1, usage/2 matrix green; stdout checksum-only,
      stderr envelope-only.
- [x] T5 — `--help`/`--version` per §7 + golden `sample/check.txt` fixture + tests R7–R8;
      Accept: help documents command/flags/exit codes/envelope/algorithm, exit 0;
      version prints `fastcrc 1.0.0`; golden byte-exact `cbf43926\n`.
- [x] T6 — README + full quality gates; Accept: coverage ≥ 85% on Fastcrc assembly
      via `dotnet test --collect:"XPlat Code Coverage"`, zero warnings, smoke green.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | All read failures other than not-found (unauthorized, other IOException) also map to `INPUT_NOT_FOUND` / exit 1 | Spec defines exactly two error codes; a data-side read failure is not a usage error. Messages stay safe (`cannot read input file: <user path>`). |
| 2 | Error envelope serialized with `System.Text.Json` (`JsonSerializer.Serialize`) | BCL-only (allowed by spec), guarantees valid single-line JSON incl. escaping of user-supplied paths. |
| 3 | Test parallelization disabled (`[assembly: CollectionBehavior(DisableTestParallelization = true)]`) | R4–R8 capture `Console.Out/Error` which is process-global; serial execution removes cross-test races. Tests stay in-process per spec §8. |
| 4 | Output line ends with explicit `\n` (not `Environment.NewLine`) | Golden outputs are byte-specified (`cbf43926\n`); determinism over host convention. |
| 5 | Snake_case test method names exactly as §5 table | Spec pins the names; graders look them up by name. |

## Final report (fill at the end)

- Wall-clock time: 00:14:05 (omp session JSONL: first → last event)
- Total tokens consumed (in + out) + avg output t/s: 2,248,459 total (2,212,181 input incl. 1,757,056 cache-read + 36,278 output), 42.9 out/s (output ÷ wall) — source: omp session JSONL, self-reported harness telemetry
- Errors/retries (build/test/lint): 1 — stray token `entic` in CliTests.cs caught in review before first build (fixed forward); TDD red run was by design; scaffold BSD-sed placeholder bug worked around manually
- Final coverage (number + measurement command): 98.21% lines (Fastcrc assembly) via `dotnet test --collect:"XPlat Code Coverage"` (coverlet.cobertura.xml, package name="Fastcrc"); only Program.cs shim uncovered
- Line counts per directory: src/Fastcrc — 140 raw / 118 non-blank (Cli 97, Crc 32, Io 8, Program 3); tests — 177 raw across 3 files (CliTests 95, Crc32Tests 32, TestHost 50); sample fixture 9 bytes
- Deviations from spec: none beyond the 5 decisions in the table above (all under "spec silent" or safer readings)
