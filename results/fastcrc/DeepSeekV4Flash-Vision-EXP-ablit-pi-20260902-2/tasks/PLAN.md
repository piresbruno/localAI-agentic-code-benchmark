# PLAN — fastcrc (C#)

**Agent/Model**: pi / DeepSeekV4Flash-Vision-EXP-ablit
**Started**: 2026-09-02
**Spec**: specs/06-csharp-fastcrc/SPEC.md (micro tier, ~10-min serial build)
**Mode**: unattended: plan self-approved

## Understanding of the task

Build Fastcrc, a .NET 8 console that prints the CRC-32 (IEEE 802.3/ISO-HDLC)
checksum of a file: one command (`--in <file>`), one pure algorithm module,
one error model, 60–120 LOC. Speed-calibration micro probe — exactness on
CRC semantics and stream discipline are the discriminators. Serial build
(max_agents informational only).

## Task breakdown

- [x] T1 — Scaffold: fastcrc.sln, Fastcrc.csproj (net8.0, Nullable, TreatWarningsAsErrors), Tests csproj (xUnit + coverlet), sample/check.txt verbatim (9 bytes, no trailing newline)
      Accept: `dotnet build` green; fixture byte-exact.
- [x] T2 — Crc.cs pure `uint Crc32(byte[])` + CrcTests (R1–R3 pins cross-checked against python zlib.crc32)
      Accept: pinned 0xCBF43926/0x352441C2/0x3610A686/0x81DDA740; empty → 0.
- [x] T3 — Cli.cs `RunCli`, help §7, version, envelope, exit codes 0/1/2 + CliTests (R4–R8)
      Accept: golden `cbf43926\n` byte-exact; error matrix exit codes green.
- [x] T4 — Gates + docs + bookkeeping: coverage ≥ 85%, smoke via dotnet run, README, METRICS/BENCHMARKS, commits
      Accept: coverage ≥ 85%; smoke byte-match; tree clean.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | `Crc32` returns `uint`; CLI formats with `ToString("x8")` | Exact output bytes per §4.1; x8 = lowercase zero-padded. |
| 2 | `--in` consumes exactly one value; extra positional → USAGE `unknown argument` | Strict boundary validation (spec R6). |
| 3 | Read errors map to `INPUT_NOT_FOUND` (FileNotFound/DirectoryNotFound only) | Only input failure class (spec R5). |
| 4 | Pinned values cross-checked with python `zlib.crc32`, not guessed | Avoids baking wrong goldens. |
| 5 | Golden test writes the check content to a temp file instead of reading `sample/check.txt` | Test-host cwd under `dotnet test` is not guaranteed; same bytes, same golden. |

## Final report (fill at the end)

- **Model id: `DeepSeekV4Flash-Vision-EXP-ablit` (harness: `pi`)** — run dir `results/fastcrc/DeepSeekV4Flash-Vision-EXP-ablit-pi-20260902-2`
- Wall-clock time: ≈ 00:07 (scaffold 03:52 → close ~03:59) — under the ~10-minute target
- Total tokens consumed (in + out) + avg output t/s: not exposed by this harness session — unknown (recorded `—`)
- Errors/retries (build/test/lint): 0 — first-run green (12/12)
- Final coverage (number + measurement command): 92.45% lines (49/53) via `dotnet test --collect:"XPlat Code Coverage"` (coverlet) — gate ≥ 85% passed
- Line counts per directory: src/Fastcrc 70 (Crc 34, Cli 92 incl. help, Io 5, Program 4); tests 150
- Deviations from spec: none functional (see decisions table)
