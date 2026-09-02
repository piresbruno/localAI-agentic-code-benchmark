# Fastcrc

Micro-tier C# (.NET 8 console) probe: prints the CRC-32 (IEEE 802.3 /
ISO-HDLC) checksum of a file. Byte-deterministic, one command, ~10-minute
serial build target.

## Quickstart

```bash
dotnet build
dotnet run --project src/Fastcrc -- --in sample/check.txt   # prints cbf43926
dotnet run --project src/Fastcrc -- --help
```

## Run

```
fastcrc --in <file>
fastcrc --help | -h
fastcrc --version | -v
```

`--in` is required and takes exactly one value. Output is exactly one line:
8 lowercase hex characters + newline. Every failure prints one single-line
JSON envelope on stderr, e.g.
`{"error":{"code":"USAGE","message":"unknown flag: --foo"}}`.

## Architecture

```
src/Fastcrc/
├── Program.cs   entry shim only (returns Cli.RunCli(args))
├── Crc.cs       PURE: CRC-32/ISO-HDLC table-driven implementation
├── Io.cs        the only file-I/O module
└── Cli.cs       the only Console user: args, envelope, exit codes, help
```

Layering: `Crc.cs` has no IO/Console; only `Cli.cs` writes stdout/stderr;
only `Program.cs` returns the process exit code; `Cli.RunCli` is the
in-process test entry.

## Algorithm

CRC-32/ISO-HDLC (IEEE 802.3): reflected polynomial `0xEDB88320`, initial
`0xFFFFFFFF`, final XOR `0xFFFFFFFF`; bytes processed LSB-first; result as
8 lowercase hex, zero-padded. Pinned values (cross-checked against
python `zlib.crc32`): `123456789` → `cbf43926`, `abc` → `352441c2`,
empty → `00000000`.

## Exit codes & errors

| Exit | Meaning |
|---|---|
| 0 | Success |
| 1 | Data error — `INPUT_NOT_FOUND` |
| 2 | Usage error — `USAGE` (no args, unknown flag, missing value, extra argument) |

## Testing & coverage

```bash
dotnet test                                  # 12 tests, all green
dotnet test --collect:"XPlat Code Coverage"  # ≥ 85% gate (92.45% measured)
```

Every §5 rule has a named xUnit test; the golden runs in-process via
`Cli.RunCli` with Console capture; determinism verified by double-run
byte-compare; no subprocess launches.
