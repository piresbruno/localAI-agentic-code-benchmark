# Fastcrc

Prints the CRC-32 (IEEE 802.3 / ISO-HDLC) checksum of a file as 8 lowercase hex
characters. Micro-tier .NET 8 console tool — one algorithm, one command, one
error model.

## Quickstart

```bash
dotnet build
dotnet run --project src/Fastcrc -- --in sample/check.txt   # prints cbf43926
dotnet test
```

## CLI

```
fastcrc --in <file>        checksum of the file's raw bytes, 8 lowercase hex + newline (exit 0)
fastcrc --help | -h        full help, exit 0
fastcrc --version | -v     fastcrc 1.0.0, exit 0
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0    | success — checksum on stdout |
| 1    | data error — input file could not be found or read |
| 2    | usage error — no args, unknown flag, missing `--in` value, extra positional |

### Errors

Any failure prints one single-line JSON object on stderr and nothing on stdout:

```json
{"error":{"code":"USAGE","message":"unknown flag: --foo"}}
```

Codes: `USAGE` (exit 2), `INPUT_NOT_FOUND` (exit 1). Messages are safe — no
stack traces or exception types; only user-supplied paths are echoed.

## Architecture

```
fastcrc.sln
src/Fastcrc/
  Program.cs   shim: return Cli.RunCli(args);
  Crc.cs       PURE table-driven CRC-32 (no I/O, no Console, no Environment)
  Io.cs        the only file-I/O module (ReadAllBytes)
  Cli.cs       argv parsing, error envelope, exit codes, help (the only Console user)
tests/Fastcrc.Tests/   xUnit + coverlet; spec §5 rules R1–R8 by name, all in-process
sample/check.txt       9-byte fixture: 123456789 (no trailing newline)
```

Layering: boundary (`Cli`) → algorithm (`Crc`) with I/O isolated in `Io`;
dependencies point inward.

## Algorithm

CRC-32/IEEE 802.3 (ISO-HDLC — the zip/gzip "CRC-32"): reflected polynomial
`0xEDB88320`, initial value `0xFFFFFFFF`, final XOR `0xFFFFFFFF`, LSB-first
processing. Empty input → `00000000`. Pinned check values:
`123456789` → `cbf43926`, `abc` → `352441c2`.

## Tests & coverage

```bash
dotnet test                                        # 8 tests, R1–R8
dotnet test --collect:"XPlat Code Coverage"        # coverlet
```

Current: **98.21%** line coverage on the `Fastcrc` assembly
(`tests/Fastcrc.Tests/TestResults/*/coverage.cobertura.xml`, `package name="Fastcrc"`).
`Program.cs` (the 2-line entry shim) is the only uncovered code — it cannot be
reached from in-process tests.

## Decisions & deviations

Recorded in `tasks/PLAN.md` ("Decisions & spec deviations"): non-not-found read
failures also map to `INPUT_NOT_FOUND` (the spec defines exactly two error
codes), envelope JSON uses BCL `System.Text.Json` with the relaxed encoder,
output lines end with explicit `\n` for byte-determinism, test names follow the
spec's snake_case table verbatim.