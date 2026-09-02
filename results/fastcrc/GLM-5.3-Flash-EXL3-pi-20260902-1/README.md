# Fastcrc

Prints the **CRC-32 (IEEE 802.3 / ISO-HDLC)** checksum of a file as 8 lowercase
hex characters — a single-command, byte-deterministic CLI on .NET 8 (BCL only).

## Quickstart

```bash
dotnet build
dotnet run --project src/Fastcrc -- --in sample/check.txt   # → cbf43926
dotnet test --collect:"XPlat Code Coverage"
```

## Usage

```
fastcrc --in <file>
fastcrc --help | -h
fastcrc --version | -v
```

`--in` is required and takes exactly one value. The checksum line (8 lowercase
hex chars + newline) is the only stdout output; every failure prints exactly one
single-line JSON envelope on stderr and nothing else. No colors, no ANSI.

Worked example (from the repo root):

```
$ dotnet run --project src/Fastcrc -- --in sample/check.txt
cbf43926
```

`sample/check.txt` is 9 bytes, `123456789`, no trailing newline — the canonical
CRC-32 check value `0xCBF43926`.

## Architecture

```
fastcrc.sln
├── src/Fastcrc/
│   ├── Fastcrc.csproj       # net8.0 console; Nullable enable; TreatWarningsAsErrors
│   ├── Program.cs           # shim only: return Cli.RunCli(args);
│   ├── Crc.cs               # PURE: the only algorithm
│   ├── Io.cs                # the only file-I/O module
│   └── Cli.cs               # argv parsing, error envelope, exit codes, help
├── tests/Fastcrc.Tests/     # xUnit + coverlet.collector; one test per spec rule R1–R8
└── sample/check.txt         # verbatim: 123456789 (no trailing newline)
```

Layering: dependencies point inward — `Cli` → (`Io`, `Crc`). `Crc.cs` is pure
(no `System.IO`, `Console`, or `Environment`); `Io.cs` is the only module doing
file I/O; only `Cli.cs` touches `Console`; only `Program.cs` returns the process
exit code, and `Cli.RunCli` is the in-process test entry point.

## Algorithm

CRC-32 IEEE 802.3 (ISO-HDLC) — the common "CRC-32" of zip/gzip:

| Constant | Value |
|---|---|
| Polynomial (reflected) | `0xEDB88320` (of `0x04C11DB7`) |
| Initial value | `0xFFFFFFFF` |
| Final XOR | `0xFFFFFFFF` |
| Bit order | reflected (LSB-first) |

Empty input → `0x00000000`. Pinned check values: `123456789` → `cbf43926`,
`abc` → `352441c2`. Implemented as a table-driven reflected CRC (`Crc.cs`).

## Exit codes & errors

| Exit | Meaning | Error code |
|---|---|---|
| 0 | success — checksum on stdout | — |
| 1 | data error — input file could not be read | `INPUT_NOT_FOUND` |
| 2 | usage error — no args, unknown flag, missing `--in` value, extra positional | `USAGE` |

Every failure prints one single-line JSON object to stderr:

```json
{"error":{"code":"USAGE","message":"unknown flag: --foo"}}
```

Messages never contain stack traces, exception types, or internal paths beyond
the user-supplied path.

## Tests & coverage

Eight xUnit tests, one per spec rule R1–R8 (names match the spec table), all
in-process: direct `Crc.Crc32` calls for R1–R3; `Cli.RunCli` with
`Console.SetOut`/`SetError` capture for R4–R8. No subprocesses, no network, no
wall-clock dependence.

```bash
dotnet test                                        # run the suite
dotnet test --collect:"XPlat Code Coverage"        # coverage (coverlet)
```

Coverage is measured on the `Fastcrc` assembly; the report is written to
`tests/Fastcrc.Tests/TestResults/<guid>/coverage.cobertura.xml`. Current line
coverage: **98.18 %** (54/55 lines — only the one-line `Program.cs` entry shim is
uncovered), gate ≥ 85 %.

## Decisions & deviations

See `tasks/PLAN.md` ("Decisions & spec deviations") — notably: classic `.sln`
forced (SDK 10 default is `.slnx`) with `TargetFramework` pinned to net8.0;
`--help`/`--version` recognized only as sole arguments; all read failures map to
`INPUT_NOT_FOUND` with a truthful message (the spec's one-error model has exactly
two codes); LOC counted as non-blank lines (119 of 136 raw, within the 60–120
advisory).
