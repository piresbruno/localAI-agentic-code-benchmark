# fastcrc

CRC-32 checksum CLI (micro-tier benchmark project): prints the CRC-32/IEEE 802.3
(ISO-HDLC) checksum of a file as 8 lowercase hex characters.

## Quickstart

```
dotnet build
dotnet run --project src/Fastcrc -- --in sample/check.txt   # -> cbf43926
dotnet test
```

## Architecture

```
fastcrc.sln
src/Fastcrc/
  Program.cs   entry shim: return Cli.RunCli(args)
  Crc.cs       pure CRC-32 algorithm (the only algorithm)
  Io.cs        the only file-I/O module (File.ReadAllBytes)
  Cli.cs       argv parsing, output, error envelope, exit codes, help (only Console user)
tests/Fastcrc.Tests/   xUnit + coverlet; one named test per spec rule R1-R8
sample/check.txt       9-byte fixture "123456789" (no trailing newline)
```

Layering: `Crc` is pure (no System.IO, no Console, no Environment); `Io` performs all
file I/O; only `Cli` touches `Console`; only `Program.cs` returns the process exit code.
`Cli.RunCli` is the in-process test entry point.

## Algorithm

CRC-32/IEEE 802.3 - the zip/gzip "crc-32" (reflected, table-driven, LSB-first):
poly `0xEDB88320`, init `0xFFFFFFFF`, xorout `0xFFFFFFFF`.
Empty input -> `00000000`. Output is 8 lowercase zero-padded hex chars.

## Usage

```
fastcrc --in <file>       print the checksum of <file>
fastcrc --help | -h       help (exit 0)
fastcrc --version | -v    prints "fastcrc 1.0.0"
```

Worked example (`sample/check.txt` contains exactly `123456789`):

```
$ dotnet run --project src/Fastcrc -- --in sample/check.txt
cbf43926
```

## Exit codes & errors

| Exit | Meaning |
|---|---|
| 0 | success - checksum on stdout |
| 1 | data error - input file missing/unreadable (envelope code `INPUT_NOT_FOUND`) |
| 2 | usage error - no args, unknown flag, missing `--in` value, extra positional (envelope code `USAGE`) |

Every failure prints one single-line JSON object to stderr, e.g.
`{"error":{"code":"USAGE","message":"unknown flag: --foo"}}`.

## Tests & coverage

```
dotnet test                                  # 8 tests, one per spec rule R1-R8
dotnet test --collect:"XPlat Code Coverage"  # coverlet; parse package name="Fastcrc"
```

Coverage gate: >= 85% lines on the `Fastcrc` assembly (measured 94.23%). All tests are
in-process: `Crc.Crc32` called directly for R1-R3; `Cli.RunCli` with
`Console.SetOut`/`Console.SetError` capture for R4-R8.

## Decisions & deviations

See `tasks/PLAN.md` for the full table. Summary:

- Run executed inside an operator-directed git worktree; run-dir layout is unchanged.
- Read failures other than "not found" also map to `INPUT_NOT_FOUND` (spec defines
  only two error codes; an unreadable file is a data error, not a usage error).
- `--help/-h/--version/-v` are recognized only as the sole argument; extra arguments
  are a usage error (strictest reading of the usage rules).
- Repeated `--in` counts as an extra positional -> USAGE.
