# Fastcrc — CRC-32 Checksum CLI

A tiny .NET 8 console program that prints the **CRC-32 (IEEE 802.3 / ISO-HDLC)**
checksum of a file. Single command, one algorithm, one error model — built as a
micro-tier calibration probe.

## Quickstart (from this directory)

```bash
dotnet build
dotnet run --project src/Fastcrc -- --in sample/check.txt   # prints cbf43926
dotnet test
```

## Architecture

```
fastcrc.sln
src/Fastcrc/
  Program.cs   # entry shim only: return Cli.RunCli(args);
  Crc.cs       # PURE algorithm (no System.IO / Console / Environment)
  Io.cs        # ONLY file-I/O module
  Cli.cs       # ONLY Console / argv parsing / error envelope / exit codes / help
tests/Fastcrc.Tests/   # xUnit + coverlet
sample/check.txt       # exactly "123456789" (9 bytes, no trailing newline)
README.md
```

Layering is strict and grepped: `System.IO`/`File.` appears only in `Io.cs`,
`Console` only in `Cli.cs`, `Program.cs` only returns the exit code.

## Algorithm

CRC-32 **IEEE 802.3 / ISO-HDLC** (the common "CRC-32" of zip/gzip), reflected
bit-wise implementation:

- Polynomial: `0xEDB88320` (reflected form of `0x04C11DB7`)
- Initial value: `0xFFFFFFFF`
- Final XOR: `0xFFFFFFFF`
- Input processed LSB-first; result printed as 8 lowercase hex chars (zero-padded)

Pinned check values: `Crc32("123456789") = 0xCBF43926`, `Crc32("abc") = 0x352441C2`,
`Crc32("") = 0x00000000`.

## Usage

```
fastcrc --in <file>    Print the CRC-32 checksum of <file>.
fastcrc --help | -h    Show this help and exit 0.
fastcrc --version | -v Print the version and exit 0.
```

### Worked example

```bash
dotnet run --project src/Fastcrc -- --in sample/check.txt
# cbf43926
```

### Exit codes

| Exit | Meaning |
|------|---------|
| 0 | Success |
| 1 | Data error (input file not found) |
| 2 | Usage error (no args, unknown flag, missing/invalid `--in`) |

### Error model

Every failure prints one single-line JSON object to **stderr**:

```
{"error":{"code":"USAGE","message":"..."}}
{"error":{"code":"INPUT_NOT_FOUND","message":"..."}}
```

Messages are safe — no stack traces, exception types, or internal paths.

## Testing & coverage

```bash
dotnet test                                   # run the suite (9 tests)
dotnet test --collect:"XPlat Code Coverage"   # coverlet report
```

Coverage gate: **≥ 85% lines on the `Fastcrc` assembly** (coverlet, via
`dotnet test --collect:"XPlat Code Coverage"`). `Program.cs` (the entry shim) is
uncovered by in-process tests, which is expected.

## Decisions & notes

- Bit-wise reflected CRC chosen over a table for simplicity and determinism.
- All tests live in one class because xUnit runs classes in parallel and
  `Console.SetOut`/`SetError` capture is process-global.
- Model/harness: `DeepSeekV4Flash-Vision-EXP` / `pi`.
