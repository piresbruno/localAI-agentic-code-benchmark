# Fastcrc

A tiny .NET 8 console CLI that prints the **CRC-32 (IEEE 802.3 / ISO-HDLC)**
checksum of a file as 8 lowercase hex characters. Single command, one error
model, byte-deterministic output.

## Quickstart (from a clean checkout)

```bash
dotnet build
dotnet run --project src/Fastcrc -- --in sample/check.txt   # prints cbf43926
dotnet test
```

## Architecture

```
fastcrc.sln
src/Fastcrc/          console app, BCL only (no third-party runtime packages)
  Program.cs          shim: return Cli.RunCli(args);
  Crc.cs              PURE algorithm: static uint Crc32(byte[] data)
  Io.cs               the only file-I/O module: ReadAllBytes(path)
  Cli.cs              argv parsing, JSON error envelope, exit codes, help
tests/Fastcrc.Tests/  xUnit + coverlet.collector (R1-R8 rules by name)
sample/check.txt      9 bytes: 123456789 (no trailing newline)
```

Layering: `Crc.cs` has no `System.IO`/`Console`/`Environment`; only `Cli.cs`
touches `Console`; only `Program.cs` returns the process exit code.

## Algorithm

Reflected CRC-32 bit-wise loop (LSB-first), deterministic:

- Polynomial: `0xEDB88320` (reflected form of `0x04C11DB7`)
- Initial value: `0xFFFFFFFF`
- Final XOR: `0xFFFFFFFF`
- Empty input → `0x00000000`

Pinned check values: `123456789` → `cbf43926`, `abc` → `352441c2`.

## CLI

```
fastcrc --in <file>
fastcrc --help | -h
fastcrc --version | -v
```

Worked example (note the `--` separator when invoked via `dotnet run`):

```bash
$ dotnet run --project src/Fastcrc -- --in sample/check.txt
cbf43926
$ dotnet run --project src/Fastcrc -- --version
fastcrc 1.0.0
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | success (checksum line on stdout) |
| 1 | data error (e.g. input file not found) |
| 2 | usage error (no args, unknown flag, missing `--in` value, extra positional) |

### Error envelope (stderr, one JSON line)

```json
{"error":{"code":"USAGE","message":"unknown flag: --foo"}}
```

Codes: `USAGE` (exit 2), `INPUT_NOT_FOUND` (exit 1). Messages contain only
safe text plus the user-supplied path — never stack traces or exception
types. Checksum goes to stdout only; no ANSI codes.

## Tests & coverage

```bash
dotnet test
dotnet test --collect:"XPlat Code Coverage"    # coverlet; gate ≥ 85% lines on the Fastcrc assembly
```

9 xUnit tests named after spec rules R1-R8 (+ golden sample): pinned check
values, empty input, binary + 1 MiB input, lowercase-hex-only stdout,
missing-file envelope, exit-code matrix, help/version completeness, and
byte-identical determinism. All tests run in-process via `Cli.RunCli` with
`Console.SetOut`/`SetError` capture.

## Build settings

`net8.0`, `<Nullable>enable</Nullable>`,
`<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` (zero-warning build),
`<ImplicitUsings>disable</ImplicitUsings>` so `Crc.cs` cannot accidentally
gain `System.IO`.

## Decisions & deviations

- **Bit-wise loop over table-driven**: spec allows both; smallest correct
  implementation; 1 MiB input is still instant.
- **Envelope via `System.Text.Json`** (BCL): guarantees valid, single-line,
  correctly escaped JSON even when a path contains quotes.
- **Any read failure → `INPUT_NOT_FOUND`**: one data-error model; safe
  message with only the user-supplied path.
- **`--help`/`--version` only as sole argument**: anything else is USAGE,
  the simplest reading of "unknown flags / extra positionals → USAGE".
- Test packages pinned to locally cached versions (xunit 2.9.3, runner
  2.8.2, Test.Sdk 17.14.1, coverlet 6.0.4) — restore works offline.
