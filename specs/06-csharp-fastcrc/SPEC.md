# Fastcrc — CRC-32 Checksum CLI (C#, micro tier)

**Version**: 1.0.0 (micro-tier edition)
**Stack**: C# on .NET 8 (console), xUnit + coverlet. No third-party runtime
packages; `src/` uses the BCL only.
**Audience**: AI coding agents calibrated on a **~10-minute serial build** —
exactness-critical but intentionally tiny.

> **Micro-tier scope.** 60–120 LOC of production C# under `src/` (120
> advised). One algorithm (CRC-32/IEEE), one command, no container, no
> parsers, no globs. Everything specified is required; nothing is optional.

## 1. Overview & Goals

Build **Fastcrc**, a console program that prints the CRC-32 (IEEE 802.3 /
ISO-HDLC) checksum of a file: `fastcrc --in <file>` reads raw bytes and
prints the 8-character lowercase hex checksum + newline. Byte-deterministic,
one error model, one exit-code table.

**Why this exists.** A speed-calibration probe: the discriminator is exact
CRC-32 semantics (reflected polynomial, init/xor values) and stream
discipline — not feature breadth. Aim: total wall time ≤ ~10 minutes.

**LOC expectation.** 60–120 lines under `src/` (120 advised). Tests excluded.

## 2. Success criterion (pass/fail)

ALL of the following must be true:

1. **Sandboxed** — no dependencies outside the run directory.
2. **Ready to run** — clean checkout: `dotnet build`, then
   `dotnet run --project src/Fastcrc -- --help` exits 0. BCL only in `src/`.
3. **Fixture works** — `dotnet run --project src/Fastcrc -- --in` on a file
   containing exactly `123456789` prints `cbf43926` (exit 0); byte-exact §6.
4. **All tests pass**, line coverage **≥ 85%** (coverlet) on the `Fastcrc`
   assembly.
5. **`--help` complete** per §7.
6. **Zero build warnings** (`<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`,
   `<Nullable>enable</Nullable>`).

## 3. Architecture (REQUIRED — deviations = fail)

```
fastcrc/
├── fastcrc.sln
├── src/Fastcrc/
│   ├── Fastcrc.csproj       # net8.0 console; Nullable enable; TreatWarningsAsErrors
│   ├── Program.cs           # shim only: return Cli.RunCli(args);
│   ├── Crc.cs               # PURE: the only algorithm
│   ├── Io.cs                # the only file-I/O module
│   └── Cli.cs               # argv parsing, error envelope, exit codes, help
├── tests/Fastcrc.Tests/     # xUnit + coverlet.collector; §5 rules by name
├── sample/check.txt         # verbatim: 123456789 (no trailing newline)
└── README.md
```

**Layering rules (graders grep for violations):**

- `Crc.cs` is **pure**: no `System.IO`, no `Console`, no `Environment` —
  `static uint Crc32(byte[] data)` only.
- `Io.cs` is the **only** module doing file I/O.
- Only `Cli.cs` touches `Console`; only `Program.cs` (the entry shim)
  returns the process exit code; `Cli.RunCli` is the in-process test entry.

## 4. Module contracts (names & behavior pinned; internal helpers free)

| Module | Pinned export | Behavior |
|---|---|---|
| `Crc.cs` | `public static uint Crc32(byte[] data)` | §4.1 CRC-32; deterministic; pure |
| `Io.cs` | `public static byte[] ReadAllBytes(string path)` | BCL `File.ReadAllBytes` semantics (throws on missing) |
| `Cli.cs` | `public static int RunCli(string[] args)` | §5/§6 behavior; in-process test entry; `Program.cs` returns its value |

### 4.1 Algorithm (normative)

CRC-32 **IEEE 802.3 / ISO-HDLC** — the common "CRC-32" used by zip/gzip
(`crc-32` in the CRC catalogue):

- Polynomial: `0xEDB88320` (reflected form of `0x04C11DB7`).
- Initial value: `0xFFFFFFFF`; final XOR: `0xFFFFFFFF`.
- Input bytes processed LSB-first (reflected algorithm); table-driven or
  bit-wise implementation, both deterministic.
- Result `0..0xFFFFFFFF`, printed as **8 lowercase hex characters**
  (zero-padded); `0x0C` → `0000000c`.
- `Crc32` of an empty input = `0x00000000`.

Pinned check values: `Crc32("123456789") = 0xCBF43926`,
`Crc32("abc") = 0x352441C2`.

## 5. Business rules (each needs a test named for it)

| Named test | Rule |
|---|---|
| `computes_pinned_crc32_check_values` | **R1** — `123456789` → `cbf43926`; `abc` → `352441c2` |
| `empty_input_has_zero_crc` | **R2** — empty input → `00000000` |
| `handles_binary_and_long_input` | **R3** — bytes `{0x00, 0xFF, 0x80}` and a 1 MiB repeating pattern are deterministic and correct |
| `outputs_lowercase_hex_only` | **R4** — stdout is exactly 8 lowercase hex chars + newline; nothing else; no ANSI |
| `rejects_missing_input_file` | **R5** — `INPUT_NOT_FOUND` envelope, exit 1 |
| `exit_codes_usage_vs_data` | **R6** — 0 success; 1 data; 2 usage (no args, unknown flag, missing `--in` value, extra positional) |
| `help_and_version_complete` | **R7** — `--help` exit 0 documents command, flags, exit codes, envelope, algorithm (poly/init/xor); `--version` prints `fastcrc 1.0.0` |
| `produces_byte_identical_output_for_equal_input` | **R8** — run twice, byte-compare |

**Error envelope (one error model).** Every failure prints **one single-line
JSON object to stderr**:
`{"error":{"code":"USAGE","message":"unknown flag: --foo"}}`.
Codes: `USAGE` (exit 2), `INPUT_NOT_FOUND` (exit 1). Messages are safe: no
stack traces/exception types/internal paths beyond user-supplied paths.

## 6. CLI surface & golden outputs

### 6.1 Commands

```
fastcrc --in <file>
fastcrc --help | -h
fastcrc --version | -v
```

`--in` is required and takes exactly one value; unknown flags, extra
positional args, or no args → USAGE (exit 2). Output: checksum line only, on
stdout.

`sample/check.txt` (commit **verbatim**, 9 bytes, no trailing newline):

```
123456789
```

### 6.2 Golden

`dotnet run --project src/Fastcrc -- --in sample/check.txt` (exit 0) prints
exactly:

```
cbf43926
```

`dotnet run --project src/Fastcrc -- --version` prints `fastcrc 1.0.0`
(exit 0).

## 7. CLI/UX (scored, not optional polish)

- **`--help` completeness** (exit 0, stdout): the command; `--in` with
  meaning; all exit codes with meanings; the error envelope shape; the
  algorithm line (IEEE 802.3, poly 0xEDB88320, init 0xFFFFFFFF, xorout
  0xFFFFFFFF); one worked example.
- **Determinism**: same input → identical bytes.
- **Stream discipline**: checksum on stdout only; envelope is the only
  stderr output. No colors.

### How it's verified
Grader runs the §6.2 invocations and byte-compares; feeds each §5 error
trigger; checks code + message + exit status; greps `src/` for layering
violations.

## 8. Testing requirements

- xUnit tests for **every §5 rule by name** (R1–R8), all in-process: `Crc32`
  direct calls for R1–R3, `Cli.RunCli(args)` with `Console.SetOut`/
  `Console.SetError` capture for R4–R8 (no subprocess launches).
- Golden: `RunCli(["--in","sample/check.txt"])` → `cbf43926\n`; determinism:
  run twice, byte-compare.
- Coverage ≥ 85% on the `Fastcrc` assembly (coverlet via
  `dotnet test --collect:"XPlat Code Coverage"`). Zero warnings; no
  wall-clock/network dependence.

## 9. Commands

| Purpose | Command |
|---|---|
| Build | `dotnet build` |
| Run | `dotnet run --project src/Fastcrc -- --in sample/check.txt` |
| Test | `dotnet test` |
| Coverage | `dotnet test --collect:"XPlat Code Coverage"` (coverlet, Fastcrc assembly) |

## 10. Documentation

README: goal, quickstart (≤ 3 commands from clean checkout), architecture
overview, algorithm summary (pinned constants), §6 worked example,
exit-code + error-code table, test/coverage instructions.
