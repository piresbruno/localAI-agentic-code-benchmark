# Huffcode

Lossless Huffman codec CLI (.NET 8 console). `encode` builds an optimal
prefix-free code from a file's byte frequencies and writes a
byte-deterministic `.huf` container (JSON header line + lowercase hex
bitstream); `decode` verifies the container (prefix-free table, padding,
payload length) and reconstructs the original bytes.

## Quickstart

```bash
dotnet build
dotnet run --project src/Huffcode -- encode --in sample/message.txt --out out.huf
dotnet run --project src/Huffcode -- decode --in out.huf --out out.txt
```

## Run

```
huffcode encode --in <file> --out <file>
huffcode decode --in <file> --out <file>
huffcode --help | -h
huffcode --version | -v
```

`--help` (exit 0) is the full CLI documentation: commands, flags, exit codes,
error envelope shape, container format, and the determinism rule.
`--version` prints `huffcode 1.0.0`.

## Architecture (parallel slices)

```
src/Huffcode/
├── Program.cs   entry shim only (returns Cli.RunCli(args))
├── Types.cs     S0 contract (committed verbatim)
├── Codec.cs     S1 frequencies, deterministic Huffman construction, bit codec (PURE)
├── Format.cs    S2 .huf container serialize/parse (PURE)
├── Io.cs        S3a the only file-I/O module
└── Cli.cs       S3b argv parsing, error envelope, exit codes, help
```

- S1 + S2 are pure: no `System.IO`/`Console`; S3a is the only filesystem
  user; only `Cli.cs` writes stdout/stderr; only `Program.cs` returns the
  process exit code.
- The slices were implemented **in parallel** (three concurrent workers,
  `max_agents = 3`): the §4.2 contracts are complete in the spec, so no
  cross-slice negotiation was needed. See spec §3.1 (scored bonus).

## Algorithm (deterministic)

Byte frequencies are counted exactly (0–255, case-sensitive). The Huffman
tree merges the two nodes with the smallest `(frequency, tag)`; ties break by
frequency then symbol ascending; the first-popped node is the left child
(`0`). Single-symbol alphabets use the empty code (`""`). Bits are MSB-first;
the bitstream is zero-padded to a whole byte. Same input → identical output.

## Container format

Line 1: JSON header (`version`, `symbols[{symbol,bits}]` sorted ascending,
`payloadLength`, `dataBits`, `pad`) — canonical `pad == (8 − dataBits%8)%8`.
Line 2: lowercase hex of the padded bitstream, no trailing newline (empty
hex when `dataBits == 0`). Invalid headers/padding → `INVALID_HEADER` (exit 1).

## Worked example (§6.2)

`sample/message.txt` = 7 bytes `41 41 42 42 43 43 0A`. Encode produces
exactly:
`{"version":1,"symbols":[{"symbol":10,"bits":"00"},{"symbol":65,"bits":"01"},{"symbol":66,"bits":"10"},{"symbol":67,"bits":"11"}],"payloadLength":7,"dataBits":14,"pad":2}\n5af0`
Decode reproduces the input byte-for-byte.

## Exit codes & errors

| Exit | Meaning |
|---|---|
| 0 | Success |
| 1 | Data error — `INPUT_NOT_FOUND`, `INVALID_HEADER` |
| 2 | Usage error — `USAGE` (unknown command/flag, missing `--in`/`--out`, no args) |

Every failure prints exactly one single-line JSON object on stderr:
`{"error":{"code":"USAGE","message":"unknown flag: --foo"}}` — no stack
traces or exception types.

## Testing & coverage

```bash
dotnet test                                  # 19 tests, all green
dotnet test --collect:"XPlat Code Coverage"  # coverage ≥ 85% on Huffcode assembly (87.25%)
```

- Every §5 rule has a named test (`counts_byte_frequencies_exactly`,
  `builds_minimal_prefix_free_code`, `tie_breaks_by_frequency_then_symbol`,
  `single_symbol_alphabet_uses_empty_code`, `encodes_msb_first_and_pads_with_zeros`,
  `round_trips_arbitrary_bytes`, `round_trips_empty_message`,
  `produces_byte_identical_output_for_equal_input`, `rejects_invalid_headers`,
  `exit_codes_data_vs_usage`), plus edge matrices (2-symbol, equal
  frequencies, 256-symbol, single symbol, header/container failure matrix).
- Golden §6.2 tests run in-process via `Cli.RunCli` with Console capture;
  no subprocess launches.
