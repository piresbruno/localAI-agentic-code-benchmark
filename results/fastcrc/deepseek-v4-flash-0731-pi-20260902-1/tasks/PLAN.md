# PLAN — fastcrc

**Agent/Model**: pi / deepseek-v4-flash-0731
**Started**: 2026-09-02
**Spec**: specs/06-csharp-fastcrc/SPEC.md
**Mode**: unattended: plan self-approved

## Understanding of the task

Build Fastcrc, a .NET 8 console program printing the CRC-32 (IEEE 802.3)
checksum of a file: `fastcrc --in <file>` → 8 lowercase hex chars + newline.
The discriminator is exact CRC-32 semantics (reflected poly 0xEDB88320,
init 0xFFFFFFFF, xorout 0xFFFFFFFF) and strict layering: Crc.cs pure,
Io.cs the only I/O module, only Cli.cs touches Console, only Program.cs
returns the exit code. One error model (single-line JSON envelope, codes
USAGE/INPUT_NOT_FOUND, exits 2/1). Coverage gate ≥ 85% on the Fastcrc
assembly; zero warnings (TreatWarningsAsErrors + Nullable). Micro tier:
60–120 LOC of production C# under `src/` (120 advised).

## Task breakdown

- [x] T1 — Scaffold: sln, src/Fastcrc, tests/Fastcrc.Tests, sample/check.txt, .gitignore, .editorconfig
      Accept: `dotnet build` green on empty skeleton, sample committed verbatim 9 bytes.
- [x] T2 — Crc.cs: pure table-free bit-wise `public static uint Crc32(byte[] data)`, no System.IO/Console/Environment
      Accept: pinned values via quick check.
- [x] T3 — Io.cs: `public static byte[] ReadAllBytes(string path)` delegating to BCL; sole file-I/O module
      Accept: reads file bytes; throws on missing.
- [x] T4 — Cli.cs: RunCli(args) — help/-h, version/-v, --in <file>; USAGE envelope + exit 2 for no args/unknown flag/missing value/extra positional; INPUT_NOT_FOUND + exit 1 for missing file; help text documents command, flags, exit codes, envelope, algorithm, example
      Accept: §6.2 golden invocations byte-exact.
- [x] T5 — Program.cs: shim returning Cli.RunCli(args) (explicit Main so tests can cover it)
      Accept: exit code propagated.
- [x] T6 — Tests: xUnit tests named per §5 R1–R8; in-process only (Crc32 direct; RunCli with Console.SetOut/SetError)
      Accept: 100% pass, no skips.
- [x] T7 — Coverage: `dotnet test --collect:"XPlat Code Coverage"` ≥ 85% lines on Fastcrc assembly
      Accept: reported number recorded in PLAN + METRICS.
- [x] T8 — Smoke: build; run --help (exit 0), --version (`fastcrc 1.0.0`), --in sample/check.txt (`cbf43926`), error triggers; verify stdout/stderr discipline
      Accept: byte-exact matches.
- [x] T9 — README.md + .gitignore hygiene (bin/ obj/ TestResults/); commit docs
      Accept: clean-checkout quickstart ≤ 3 commands.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| D1 | Bit-wise (non-table) CRC loop instead of table-driven | Spec allows both; smaller, clearer, no 256-entry table; 1 MiB input still runs in ms. Deterministic. |
| D2 | Program.cs uses explicit `public static int Main` shim rather than top-level statements | Still "shim only: return Cli.RunCli(args)"; explicit Main lets in-process tests cover it, protecting the ≥85% gate. |
| D3 | `--in` consumes exactly one following token; any further tokens (positional, flags after the value) → USAGE | "takes exactly one value; extra positional args → USAGE". First action wins; leftover args rejected — simple, deterministic, covers every §5 error trigger. |
| D4 | Other IOException (non-not-found) mapped to INPUT_NOT_FOUND "cannot read file: <path>" | Keeps the one-error-model invariant (every failure → single-line JSON envelope, no stack traces) with only the two pinned codes. |
| D5 | Duplicate `--in` flag → USAGE | "takes exactly one value"; rejecting is the strict, deterministic reading. |
| D6 | no `global.json` | Spec commands are bare `dotnet build/test/run`; any SDK ≥ 8.0 builds net8.0 TFM. Avoids pinning failures on grader machines. |
| D7 | Help/version constant strings ("fastcrc 1.0.0") | Spec pins exact output; literals are the most direct guarantee. |

## Final report (fill at the end)

- Wall-clock time: 00:12:39 (session 2026-09-02T14:06:47Z → 14:19:27Z, harness telemetry)
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source):
  5,867,526 (input 5,798,050 incl. 5,495,552 cache-read; output 69,476); avg 91.4 out t/s —
  from omp session JSONL (`~/.omp/agent/sessions/-Developer-localAI-agentic-code-benchmark-wt/…jsonl`).
- Errors/retries (build/test/lint): 1 test-run fix round (golden-test arg bug; xunit culture-sensitive
  `DoesNotContain` on ESC — replaced with char-code assertion). Scaffold script BSD-sed
  incompatibility worked around. No build/lint errors.
- Final coverage (number + measurement command): 94.54% lines (Fastcrc assembly) via
  `dotnet test --collect:"XPlat Code Coverage"` (gate ≥ 85%).
- Line counts per directory: src/Fastcrc 142 non-blank (Crc 26, Io 13, Cli 96, Program 7);
  tests/Fastcrc.Tests 159 non-blank; README 95 lines. src raw 161.
- Deviations from spec: none functional. Advisory LOC 120 exceeded (142 non-blank) — driven by
  the §7-scored help surface (all R7 tokens) and XML docs; feature set is exactly the spec's.