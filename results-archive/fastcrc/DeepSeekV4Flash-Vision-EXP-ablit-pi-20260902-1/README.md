# Fastcrc

CRC-32 (IEEE 802.3 / ISO-HDLC) checksum CLI. Reads a file's raw bytes and
prints the 8-character lowercase hex CRC-32 checksum. Byte-deterministic,
single command, one error model. Micro-tier

## Quickstart (clean checkout)

```bash
dotnet build
dotnet run --project src/Fastcrc -- --in sample/check.txt   # prints cbf43926
dotnet test                                                 # 9 tests, all green
```

## Architecture

```
fastcrc.sln
src/Fastcrc/          # production code (BCL only)
├── Program.cs        # shim only: return Cli.RunCli(args)
├── Crc.cs            # PURE algorithm — no I/O, no Console, no Environment
├── Io.cs             # the only file-I/O module (File.ReadAllBytes semantics)
└── Cli.cs            # argv parsing, error envelope, exit codes, help
tests/Fastcrc.Tests/  # xUnit + coverlet.collector; in-process tests only
sample/check.txt      # verbatim "123456789", 9 bytes, no trailing newline
```

Layering: `Cli.RunCli(string[])` is the in-process test entry; only `Cli`
touches `Console`; only `Program` returns the process exit code; `Crc32` is
pure.

## Algorithm

CRC-32 IEEE 802.3 (ISO-HDLC), table-driven reflected implementation:

- Polynomial (reflected): `0xEDB88320` (reflected form of `0x04C11DB7`)
- Initial value: `0xFFFFFFFF`
- Final XOR: `0xFFFFFFFF`
- Input bytes processed LSB-first; output zero-padded 8 lowercase hex digits

Pinned check values: `Crc32("123456789") = 0xCBF43926`,
`Crc32("abc") = 0x352441C2`; empty input = `0x00000000`.

## CLI

```
fastcrc --in <file>
fastcrc --help | -h
fastcrc --version | -v
```

Worked example:

```bash
$ fastcrc --in sample/check.txt
cbf43926
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | data error |
| 2 | usage error |

### Error envelope (stderr, one single-line JSON object)

```json
{"error":{"code":"USAGE","message":"unknown flag: --foo"}}
```

| Code | Exit | Triggered by |
|------|------|--------------|
| `USAGE` | 2 | no args, unknown flag, missing `--in` value, extra positional |
| `INPUT_NOT_FOUND` | 1 | input file (or its directory) does not exist |

Messages are safe: no stack traces, exception types, or internal paths beyond
user-supplied paths.

## Tests & coverage

- In-process only (no subprocess): `Crc.Crc32` direct calls for R1–R3,
  `Cli.RunCli` with `Console.SetOut`/`Console.SetError` capture for R4–R8.
- Coverage gate: ≥ 85% lines on the `Fastcrc` assembly
  (`dotnet test --collect:"XPlat Code Coverage"`); measured 98.14%.

## Decisions & deviations

- Test package versions pinned to NuGet-cached versions (xunit 2.9.2,
  coverlet.collector 6.0.4) — offline-safe restore.
- `--in` with extra positional → `USAGE` ("unexpected argument"); missing
  directory for the input path → `INPUT_NOT_FOUND` (data error, exit 1).
- No `global.json`; targets `net8.0` and builds on any installed .NET SDK ≥ 8.
