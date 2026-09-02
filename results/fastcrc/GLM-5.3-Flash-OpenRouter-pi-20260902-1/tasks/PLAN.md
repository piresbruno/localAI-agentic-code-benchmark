# PLAN — fastcrc

**Agent/Model**: pi
**Started**: 2026-09-02
**Spec**: specs/06-csharp-fastcrc/SPEC.md
**Mode**: unattended — plan self-approved

## Understanding of the task

Fastcrc is a micro-tier .NET 8 console CLI: `fastcrc --in <file>` prints the CRC-32/IEEE 802.3 checksum of the file as 8 lowercase zero-padded hex chars + newline. The discriminators are exactness — reflected algorithm (poly `0xEDB88320`, init `0xFFFFFFFF`, xorout `0xFFFFFFFF`), a strict three-way exit-code contract (0 success / 1 data / 2 usage), a single single-line JSON error envelope on stderr, byte-deterministic stdout, and a REQUIRED file layout (`Crc.cs` pure, `Io.cs` sole I/O, `Cli.cs` sole Console user, `Program.cs` a 2-line shim). Tests must be in-process only (xUnit, `Cli.RunCli` with console capture) and named after the eight spec rules R1–R8; coverage gate ≥ 85% on the `Fastcrc` assembly with zero build warnings. 60–120 LOC of production C# under `src/`.

## Task breakdown

- [x] T1 — Solution + `src/Fastcrc` + `tests/Fastcrc.Tests` projects, `sample/check.txt` (9 bytes verbatim), `.editorconfig`, run-dir `.gitignore`
      Accept: `dotnet build` zero errors; classic `fastcrc.sln`; fixture is exactly 9 bytes.
- [x] T2 — Test suite for R1–R8, named exactly per spec §5, in-process (console capture), compile-red first
      Accept: all eight named tests exist and fail before implementation exists.
- [x] T3 — `Crc.cs`: pure table-driven CRC-32, pinned exports only
      Accept: pinned vectors `123456789`→`0xCBF43926`, `abc`→`0x352441C2`, empty→`0`, R3 vectors pass.
- [x] T4 — `Io.cs` + `Cli.cs`: parsing, envelope, exit codes, help/version (R4–R8)
      Accept: full suite green; help documents command, flags, exit codes, envelope, algorithm, example.
- [x] T5 — Quality gates: build zero warnings, `dotnet test` 100% pass, coverage ≥ 85% (`Fastcrc` assembly), smoke `--help` exit 0 + `--in sample/check.txt` → `cbf43926`
      Accept: all gates green with numbers recorded below.
- [x] T6 — README per spec §10 (goal, ≤3-command quickstart, architecture, algorithm constants, worked example, exit/error tables, test/coverage instructions)
      Accept: README committed; docs commit in history.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | Run executed inside an operator-directed git worktree (`/Users/brunopires/.config/superpowers/worktrees/localAI-agentic-code-benchmark/fastcrc-glm53flash-openrouter`, branch `bench/fastcrc-glm53flash-openrouter`) instead of the main checkout | Operator instruction: "create a worktree before commiting anything"; run-dir-relative layout is identical |
| 2 | Unreadable/IO-failing input maps to `INPUT_NOT_FOUND` | Spec defines only two codes (`USAGE`, `INPUT_NOT_FOUND`); a read failure is a data error, not usage |
| 3 | `--help`/`-h`/`--version`/`-v` recognized only as the sole argument | Strictest reading of "unknown flags, extra positional args → USAGE" |
| 4 | Repeated `--in` → USAGE ("unexpected argument") | `--in` "takes exactly one value"; the extra occurrence is an unexpected token |
| 5 | `ImplicitUsings>enable` in both csproj | Spec silent; boring BCL default; `Program.cs` still carries explicit `using Fastcrc;` |

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source):
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
