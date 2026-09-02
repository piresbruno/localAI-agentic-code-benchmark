# Fastcrc

CRC-32 (IEEE 802.3 / ISO-HDLC) checksum CLI for .NET 8. `fastcrc --in <file>`
reads a file's raw bytes and prints the 8-character lowercase hexadecimal
checksum. Byte-deterministic, single command, no third-party runtime
packages (BCL only in `src/`).

## Quickstart (from a clean checkout)

```bash
dotnet build
dotnet run --project src/Fastcrc -- --help
dotnet run --project src/Fastcrc -- --in sample/check.txt   # prints cbf43926
```

## Commands

```
fastcrc --in <file>     print the CRC-32 checksum of <file> (required)
fastcrc --help | -h     show help
fastcrc --version | -v  print "fastcrc 1.0.0"
```

Verification of the golden fixture (spec §6.2):

```bash
$ dotnet run --project src/Fastcrc -- --in sample/check.txt
cbf43926
```

Run it twice — the output bytes are identical (determinism, spec R8).

## Architecture

```
fastcrc.sln
src/Fastcrc/
  Program.cs   entry shim only: returns Cli.RunCli(args)
  Cli.cs       argv parsing, error envelope, exit codes, help (only Console user)
  Crc.cs       pure CRC-32 algorithm (no I/O, no Console, no Environment)
  Io.cs        file I/O only (delegates to File.ReadAllBytes)
tests/Fastcrc.Tests/   xUnit tests for spec rules R1–R8, in-process
sample/check.txt       verbatim fixture: 123456789, no trailing newline
```

Layering: `Crc.cs` is pure; `Io.cs` is the only file-I/O module; only `Cli.cs`
touches `Console`; only `Program.cs` returns the process exit code.

## Algorithm

CRC-32 IEEE 802.3 / ISO-HDLC (the common "CRC-32", as in zip/gzip):

- Reflected polynomial `0xEDB88320` (of `0x04C11DB7`)
- Initial value `0xFFFFFFFF`, final XOR `0xFFFFFFFF`
- Input bytes processed LSB-first; result printed as 8 lowercase hex chars
  (zero-padded). Empty input → `00000000`.
- Pinned check values: `123456789` → `cbf43926`, `abc` → `352441c2`

## Exit codes & error envelope

| Exit | Code | Meaning |
|------|------|---------|
| 0 | — | success (checksum printed) |
| 1 | `INPUT_NOT_FOUND` | input file missing or unreadable |
| 2 | `USAGE` | no args, unknown flag, missing `--in` value, extra positional |

Every failure prints one single-line JSON object to stderr:

```
{"error":{"code":"USAGE","message":"unknown flag: --foo"}}
```

No stack traces, exception types, or internal paths are ever printed.

## Tests & coverage

```bash
dotnet test                          # all tests, none skipped
dotnet test --collect:"XPlat Code Coverage"   # coverlet report
```

Coverage is measured on the `Fastcrc` assembly (report under
`tests/Fastcrc.Tests/TestResults/*/coverage.cobertura.xml`).
Current run: **94.54% line coverage** (gate: ≥ 85%).

## Decisions

- Bit-wise (non-table) CRC loop: spec allows both; clearer and smaller for a
  micro-tier tool, still fast (1 MiB input in milliseconds).
- Explicit `public static int Main` shim (not top-level statements) so tests
  can cover the entry point in-process.
- `--in` consumes exactly one value; any leftover argument → USAGE;
  duplicate `--in` → USAGE (strict reading of "takes exactly one value").
- Non-not-found I/O failures map to `INPUT_NOT_FOUND` with a safe message,
  preserving the single-error-model invariant.