# Fastcrc

A .NET 8 console tool that prints the **CRC-32 (IEEE 802.3 / ISO-HDLC)** checksum of a file as exactly 8 lowercase hex characters. Byte-deterministic, one error model, one exit-code table.

## Quickstart

```sh
dotnet build
dotnet run --project src/Fastcrc -- --in sample/check.txt   # prints cbf43926
dotnet test
```

## Architecture

```
fastcrc.sln
├── src/Fastcrc/
│   ├── Program.cs   # entry shim only: return Cli.RunCli(args);
│   ├── Crc.cs       # PURE algorithm: static uint Crc32(byte[]) — no I/O, no Console
│   ├── Io.cs        # the only file-I/O module (File.ReadAllBytes)
│   └── Cli.cs       # argv parsing, error envelope, exit codes, help; only Console user
├── tests/Fastcrc.Tests/   # xUnit + coverlet, all in-process (Console capture)
└── sample/check.txt       # 9-byte fixture: 123456789 (no trailing newline)
```

Dependencies point boundary → algorithm; the algorithm never imports I/O. Zero build warnings enforced (`TreatWarningsAsErrors`, `Nullable enable`).

## Algorithm

CRC-32 IEEE 802.3 (ISO-HDLC) — the "CRC-32" used by zip/gzip, computed table-driven (256-entry table of the reflected polynomial):

- Polynomial: `0xEDB88320` (reflected form of `0x04C11DB7`)
- Initial value: `0xFFFFFFFF`
- Final XOR (xorout): `0xFFFFFFFF`
- Input processed LSB-first (reflected)
- Empty input → `00000000`

Pinned check values: `123456789` → `cbf43926`, `abc` → `352441c2`.

## Worked example

```sh
$ dotnet run --project src/Fastcrc -- --in sample/check.txt
cbf43926
$ dotnet run --project src/Fastcrc -- --version
fastcrc 1.0.0
```

`sample/check.txt` is exactly `123456789` (9 bytes, no trailing newline); the output is always the checksum line plus one newline on stdout — nothing else, no ANSI colors.

## Exit codes

| Code | Meaning |
|------|---------|
| `0`  | Success — checksum printed on stdout |
| `1`  | Data error — `INPUT_NOT_FOUND`: the input file could not be read |
| `2`  | Usage error — `USAGE`: bad command line (unknown flag, missing `--in` value, duplicate `--in`, extra positional argument) |

## Error envelope

Every failure prints one single-line JSON object to stderr:

```json
{"error":{"code":"USAGE","message":"unknown flag: --foo"}}
```

Messages are safe: no stack traces, exception types, or internal paths beyond the user-supplied path itself (which is JSON-escaped).

## Tests & coverage

```sh
dotnet test                                              # 9 tests, R1–R8 rules by name
dotnet test --collect:"XPlat Code Coverage"              # coverlet
```

Coverage is measured on the `Fastcrc` assembly (gate ≥ 85%); parse `tests/Fastcrc.Tests/TestResults/*/coverage.cobertura.xml` → `<package name="Fastcrc" line-rate="...">`. Tests are fully in-process: `Crc.Crc32` directly for R1–R3, `Cli.RunCli` with `Console.SetOut`/`Console.SetError` capture for R4–R8 — no subprocess launches, no wall-clock or network dependence.

## Decisions & deviations

- `ImplicitUsings` disabled — explicit usings in a LOC-counted micro-tier.
- Classic `fastcrc.sln` hand-written; SDK 10's `dotnet new sln` emits `.slnx` which the spec does not pin.
- Non-missing read failures (directory path, permission) also map to `INPUT_NOT_FOUND`: the spec defines exactly two error codes, so data-layer failures may not escape the one error model.
- Empty `--in` value treated as a missing value (`USAGE`) — `File.ReadAllBytes("")` throws `ArgumentException`.
- Output newline is a literal `\n` (not `Environment.NewLine`) to keep golden output byte-exact on every platform.
- xUnit parallelization disabled: R4–R8 redirect the process-wide Console.
