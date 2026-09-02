# PLAN — fastcrc

**Agent/Model**: pi / GLM-5.3-Flash-EXL3
**Started**: 2026-09-02
**Spec**: specs/06-csharp-fastcrc/SPEC.md
**Mode**: unattended — plan self-approved

## Understanding of the task

Fastcrc is a micro-tier .NET 8 console tool that prints the CRC-32 (IEEE 802.3 /
ISO-HDLC) checksum of a file as 8 lowercase hex characters + newline. The hard
part is exact CRC semantics (reflected poly 0xEDB88320, init 0xFFFFFFFF, xorout
0xFFFFFFFF), not feature breadth. Required architecture pins three modules:
`Crc.cs` (pure algorithm, `public static uint Crc32(byte[] data)`), `Io.cs`
(only file I/O, `public static byte[] ReadAllBytes(string path)`), `Cli.cs`
(argv parsing, help/version, one JSON error envelope, exit codes 0/1/2);
`Program.cs` is a shim returning `Cli.RunCli(args)`. Eight business rules R1–R8
need xUnit tests named exactly after them, all in-process (Console.SetOut/
SetError capture, no subprocesses). Gates: zero warnings (TreatWarningsAsErrors),
coverage ≥ 85 % on the Fastcrc assembly via coverlet, 60–120 LOC under `src/`,
`dotnet build` + `dotnet run --project src/Fastcrc -- --help` work from a clean
checkout.

## Task breakdown

- [ ] T1 — Scaffold solution per spec §3: fastcrc.sln, src/Fastcrc (csproj: net8.0,
      Nullable enable, TreatWarningsAsErrors), tests/Fastcrc.Tests (xUnit +
      coverlet.collector), sample/check.txt verbatim 9 bytes, .gitignore
      Accept: `dotnet build` green with zero warnings.
- [ ] T2 — Crc.cs (table-driven reflected CRC-32) + CrcTests covering R1–R3 by name
      Accept: R1 pinned values (123456789→cbf43926, abc→352441c2), R2 empty→0,
      R3 binary {0x00,0xFF,0x80}→81dda740 and 1 MiB repeating pattern→04d0e435
      (constants independently derived from Python zlib.crc32, same algorithm)
      all pass; Crc.cs has no System.IO/Console/Environment.
- [ ] T3 — Io.cs + Cli.cs + Program.cs shim + CliTests covering R4–R8 by name
      Accept: R4 stdout exactly 8 lowercase hex + \n; R5 INPUT_NOT_FOUND exit 1;
      R6 exit codes 0/1/2 for success/missing-file/{no args, unknown flag,
      missing --in value, extra positional}; R7 --help documents command, --in,
      exit codes, envelope, algorithm, example and --version prints
      `fastcrc 1.0.0`; R8 byte-identical output across runs; all exit 0.
- [ ] T4 — Quality gates: coverage ≥ 85 % on Fastcrc assembly measured with
      `dotnet test --collect:"XPlat Code Coverage"`; zero warnings; layering
      self-review (only Cli.cs touches Console, only Io.cs does file I/O)
      Accept: real coverage number recorded, gates green.
- [ ] T5 — README per spec §10 (goal, quickstart ≤ 3 commands, architecture,
      algorithm constants, worked example, exit/error tables, test+coverage
      instructions) + smoke test from clean tree
      Accept: `dotnet run --project src/Fastcrc -- --in sample/check.txt`
      prints exactly `cbf43926`; `-- --help` exits 0; docs committed.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | Classic `.sln` forced (`dotnet new sln -n fastcrc -f sln`) — SDK 10 defaults to `.slnx` | Spec §3 architecture shows `fastcrc.sln` |
| 2 | `--help`/`-h`/`--version`/`-v` recognized only as the sole argument; e.g. `--help x` → USAGE | Spec §6.1 lists them as standalone commands; extra-positional rule then applies |
| 3 | Value of `--in` taken verbatim even if it looks like a flag (`--in --foo` → INPUT_NOT_FOUND for file `--foo`) | `--in` "takes exactly one value"; missing value is only when no token follows |
| 4 | Any read failure (missing/not-a-directory/unauthorized/IO) maps to `INPUT_NOT_FOUND`, message "cannot read input file: <user path>" | Spec defines exactly two codes; no stack traces may leak; message stays truthful |
| 5 | Non-exception parse rules exercised through `Cli.RunCli` in-process; golden path resolves `sample/check.txt` by walking up from `AppContext.BaseDirectory` | Tests must run from any cwd; spec §8 requires in-process tests only |
| 6 | R3 long-input expected value pinned from Python `zlib.crc32` (independent same-algorithm reference computed during development, not at test time) | No network/subprocess allowed in tests; a second independent vector guards against table-construction self-agreement |

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source):
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
