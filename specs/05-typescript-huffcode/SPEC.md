# Huffcode — Lossless Huffman Codec CLI (C#)

**Version**: 1.0.0 (sprint-tier edition, contract-first parallel slices)
**Stack**: C# on .NET 8 (console), xUnit + coverlet. No third-party runtime
packages; `src/` uses the BCL only.
**Audience**: AI coding agents evaluated on a ~10-minute, exactness-critical
algorithm probe — and on how well they exploit an explicitly parallel slice
structure.

> **Sprint-tier scope.** This probe targets **200–350 LOC** of production C#
> (350 advised). Discrimination comes from one pinned algorithm — optimal
> prefix-free coding with deterministic tie-breaking — and byte-deterministic
> container output — not feature breadth. Everything specified is required;
> nothing is optional.

## 1. Overview & Goals

Build **Huffcode**, a console codec: `encode` (build an optimal prefix-free
code from a file's byte frequencies, serialize the code table + bitstream to
a deterministic `.huf` container) and `decode` (verify the container,
reconstruct the original bytes). Byte-deterministic: same input → identical
container bytes, every run.

**Why this exists.** The probe grades an agent's ability to translate a
pinned algorithm + container format exactly — including an edge case
(single-symbol input) that naive implementations get wrong — with a
deadline-tight scope, and, in parallel, whether it can decompose the work
into independent contract-first slices.

**LOC expectation.** 200–350 lines of production C# under `src/` (350
advised). Tests and fixtures are excluded.

## 2. Success criterion (pass/fail)

ALL of the following must be true:

1. **Sandboxed** — no dependencies outside the run directory.
2. **Ready to run** — clean checkout: `dotnet build`, then
   `dotnet run --project src/Huffcode -- --help` exits 0. No external
   services; BCL only in `src/`.
3. **Fixture works** — `sample/message.txt` committed verbatim from §6.1; the
   §6.2 golden outputs reproduce **byte-exactly** (SMOKE_CHECK verifies).
4. **All tests pass**, line coverage **≥ 85%** (coverlet) on the `Huffcode`
   assembly.
5. **`--help` complete** per §7.
6. **Zero build warnings** (build with `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`,
   `<Nullable>enable</Nullable>`).

## 3. Architecture (REQUIRED — deviations = fail)

```
huffcode/
├── huffcode.sln
├── src/Huffcode/
│   ├── Huffcode.csproj       # net8.0 console; Nullable enable; TreatWarningsAsErrors
│   ├── Program.cs            # shim only: return Cli.RunCli(args);
│   ├── Types.cs              # S0 — contract, §4.1, committed VERBATIM
│   ├── Codec.cs              # S1 — frequencies, Huffman tree, bit codec (PURE)
│   ├── Format.cs             # S2 — .huf container serialize/parse (PURE)
│   ├── Io.cs                 # S3a — the only file-I/O module
│   └── Cli.cs                # S3b — argv parsing, error envelope, exit codes, help
├── tests/Huffcode.Tests/     # xUnit + coverlet.collector; §5 rules by name
├── sample/message.txt        # §6.1 fixture (verbatim)
└── README.md
```

**Layering rules (graders grep for violations):**

- `Codec.cs` and `Format.cs` are **pure**: no `System.IO`, no `Console`,
  no `Environment` — only BCL primitives and `Types.cs`.
- `Io.cs` is the **only** module doing file I/O.
- Only `Cli.cs` touches `Console`; only `Program.cs` (the entry shim)
  returns the process exit code. `Cli.RunCli` returns the code and is
  tested in-process.

### 3.1 Parallel implementation note (informational)

The slices are deliberately independent and contract-first. Build **S0**
first (sln + `Types.cs` exactly as printed — the contract is complete in §4,
no cross-slice negotiation is needed). Then **S1, S2, S3a/S3b may be
implemented in parallel and in any order**: each pins its exports, inputs
and failure behavior below; S3's code depends only on those signatures, not
on the slices' internals.

`max_agents` is recorded in the benchmark's results log (see `BENCHMARKS.md`)
and compared within-project — informational only, no bonus. The slice
contracts are complete, so parallelizing costs neither correctness nor time.

## 4. Canonical model & container format

### 4.1 `src/Huffcode/Types.cs` — the contract (verbatim)

```csharp
namespace Huffcode;

/// One symbol's binary code; bits are MSB-first, e.g. "0101".
public sealed record CodeTableEntry(int Symbol, string Bits);

/// .huf container header (first line of the container file).
public sealed record ContainerHeader(
    int Version,
    CodeTableEntry[] Symbols,  // sorted by Symbol ascending
    int PayloadLength,         // decoded byte count
    int DataBits,              // number of bits in the bitstream (payload, before padding)
    int Pad                    // padding bits appended to fill the final byte (0–7)
);

public sealed record Container(ContainerHeader Header, string DataHex);
```

### 4.2 Module contracts (names & behavior pinned; internal helpers free)

| Module | Pinned export (public static) | Behavior |
|---|---|---|
| `Codec.cs` | `Dictionary<byte, int> ByteFrequencies(byte[] data)` | exact per-byte counts 0–255; nothing else retained |
| `Codec.cs` | `Dictionary<byte, string> BuildCodeTable(Dictionary<byte, int> freqs)` | §4.3 Huffman construction; deterministic |
| `Codec.cs` | `string EncodeBits(byte[] data, Dictionary<byte, string> table)` | codes concatenated in input order (`""` for 0-bit alphabets) |
| `Codec.cs` | `byte[] DecodeBits(string bits, Dictionary<byte, string> table)` | inverse; throws `InvalidOperationException` on an unknown prefix |
| `Format.cs` | `string SerializeHeader(ContainerHeader h)` | hand-written compact JSON, exact key order `version, symbols, payloadLength, dataBits, pad`; one line, **no** trailing newline |
| `Format.cs` | `ContainerHeader? ParseHeader(string line)` | `null` on any structural failure (bad JSON, wrong version, missing/extra fields, wrong types, unsorted/duplicate symbols, non-prefix-free table, `DataBits`/`Pad` inconsistency) |
| `Format.cs` | `string RenderContainer(Container c)` | `header\nhex` with **no** trailing newline |
| `Format.cs` | `Container? ParseContainer(string text)` | splits on first `\n`; validates hex (lowercase, even length, exact length, zero pad bits); `null` on any failure; empty hex allowed only when `DataBits == 0` |
| `Io.cs` | `byte[] ReadAllBytes(string path)` | BCL `File.ReadAllBytes` semantics (throws on missing) |
| `Io.cs` | `void WriteAllBytes(string path, byte[] bytes)` | creates parent directories first |
| `Cli.cs` | `int RunCli(string[] args)` | §5/§6 behavior; in-process test entry; `Program.cs` returns its value |

### 4.3 Huffman construction (normative)

1. Frequencies are byte counts from the input (`ByteFrequencies`), covering
   every byte 0–255 as it appears; case-sensitive; newline counted.
2. The Huffman algorithm is **deterministic**:
   - Repeatedly merge the two nodes with the smallest `(frequency, symbol or
     internal-tag)`; ties are broken by **frequency ascending, then symbol
     ascending** — for leaf nodes `symbol` is the byte value; for internal
     nodes the tag is the **smallest symbol in the subtree**.
   - The first-popped node is the left child (`0`), the second is the right
     child (`1`).
   - A single-symbol alphabet (1 distinct byte) produces the empty code `""`
     (zero bits per symbol).
3. The resulting code is prefix-free; `BuildCodeTable` returns
   `symbol → bits` and must produce the same bits every run.
4. Code bits are **MSB-first**: a code `"0101"` is the four bits `0,1,0,1`;
   the encoded payload is the concatenation of codes in input order.

### 4.4 `.huf` container (byte-deterministic)

```
<header-line>\n<hex-line>
```

- `<header-line>`: §4.2 `SerializeHeader`, then `\n`, then `<hex-line>` =
  lowercase hex of the padded bitstream, **no trailing newline**. When
  `DataBits == 0` the hex line is empty (the file ends with `\n`).
- `symbols` sorted by `symbol` ascending; `bits` as built in §4.3.
- Bitstream: payload bits (input order), then exactly `pad` zero bits
  (0–7) to reach a whole number of bytes; `dataHex` = those bytes, lowercase
  hex. `DataBits` is the payload bit count **before** padding. `pad > 0`
  with non-zero trailing bits is invalid.
- `PayloadLength` must equal the decoded byte count; mismatch → header
  invalid.

## 5. Business rules (each needs a test named for it)

| Named test | Rule |
|---|---|
| `counts_byte_frequencies_exactly` | **R1** — frequencies are exact per-byte counts (0–255, case-sensitive) of raw input bytes, newlines included |
| `builds_minimal_prefix_free_code` | **R2** — table is prefix-free (no code is a prefix of another), every symbol with frequency > 0 has a code, and the total bit cost equals the constructed tree's cost (Σ freq×len), i.e. the Huffman optimum |
| `tie_breaks_by_frequency_then_symbol` | **R3** — merge order pinned: lowest `(frequency, symbol)` first; equal frequencies merge smallest symbols first; bits deterministic across runs |
| `single_symbol_alphabet_uses_empty_code` | **R4** — 1 distinct byte → code `""`, `DataBits` 0, `Pad` 0, hex line empty; decode yields `PayloadLength` copies of that byte |
| `encodes_msb_first_and_pads_with_zeros` | **R5** — MSB-first order per §4.3; padding zero bits only; `DataBits` counts payload bits only |
| `round_trips_arbitrary_bytes` | **R6** — encode → decode reproduces input byte-for-byte (≥ 2 distinct bytes; include a 256-byte alphabet stress case) |
| `round_trips_empty_message` | **R7** — empty input: symbols `[]`, PayloadLength 0, DataBits 0, hex empty; decode round-trips to empty |
| `produces_byte_identical_output_for_equal_input` | **R8** — run twice, byte-compare container |
| `rejects_invalid_headers` | **R9** — decode exits 1 with `INVALID_HEADER` for: non-JSON header, wrong version, missing field, non-prefix-free table, PayloadLength mismatch, bad/odd hex, nonzero pad bits |
| `exit_codes_data_vs_usage` | **R10** — 0 success; 1 data (`INPUT_NOT_FOUND`, `INVALID_HEADER`); 2 usage (`USAGE`: unknown command, missing `--in`/`--out`, unknown flag, no args) |

**Error envelope (one error model).** Every failure — including usage —
prints **one single-line JSON object to stderr** via `Console.Error`:

```json
{"error":{"code":"USAGE","message":"unknown flag: --foo"}}
```

Codes: `USAGE` (exit 2), `INPUT_NOT_FOUND` (exit 1), `INVALID_HEADER`
(exit 1). Messages are safe: no stack traces, exception types, or internal
paths beyond user-supplied `--in`/`--out` values.

## 6. CLI surface & golden outputs

### 6.1 Commands

```
huffcode encode --in <file> --out <file>
huffcode decode --in <file> --out <file>
huffcode --help | -h
huffcode --version | -v
```

Both `--in` and `--out` are required for both subcommands (missing → USAGE,
exit 2). `encode` reads raw bytes and writes the `.huf` container; `decode`
reads the container and writes the raw bytes. Unknown flags → USAGE. No
other flags exist. All data goes to the `--out` file; nothing on stdout for
encode/decode; stdout is used only by `--help`/`--version`.

`sample/message.txt` (commit verbatim):

```
AABBCC
```

(The file is exactly 7 bytes: `41 41 42 42 43 43 0A`.)

### 6.2 Golden outputs

`dotnet run --project src/Huffcode -- encode --in sample/message.txt --out out.huf`
(exit 0) → `out.huf` byte-exactly:

```
{"version":1,"symbols":[{"symbol":10,"bits":"00"},{"symbol":65,"bits":"01"},{"symbol":66,"bits":"10"},{"symbol":67,"bits":"11"}],"payloadLength":7,"dataBits":14,"pad":2}
5af0
```

`dotnet run --project src/Huffcode -- decode --in out.huf --out out.txt` →
`out.txt` byte-exactly equals `sample/message.txt`.

`--version` prints `huffcode 1.0.0` (exit 0).

## 7. CLI/UX (scored, not optional polish)

- **`--help` completeness** (exit 0, stdout): both subcommands; every flag
  with meaning; all exit codes with meanings; the error envelope shape; the
  container format (header fields + hex line); the determinism/tie-break
  rule; one worked encode→decode example.
- **Determinism**: same input → byte-identical container.
- **Stream discipline**: only `--help`/`--version` data on stdout; the
  envelope is the only stderr output.
- **Safe errors**: no stack traces/exception types.

### How it's verified

Grader runs the §6.2 invocations and byte-compares; feeds each §5 error
trigger and checks code + message + exit status; runs twice for determinism;
greps `src/` for layering violations (`System.IO`/`File` outside `Io.cs`,
`Console` outside `Cli.cs`, pure-module cross-imports); records `max_agents`
from harness telemetry for the parallelization bonus (§3.1).

## 8. Testing requirements

- xUnit tests for **every §5 rule by name**, plus: Huffman construction edges
  (2-symbol alphabet, all-equal frequencies, 256-symbol alphabet, single
  symbol), prefix-free verification, header round-trip (serialize → parse),
  parse failure matrix (bad JSON, wrong version, missing field,
  non-prefix-free table, bad hex, odd length, pad-bit mismatch, PayloadLength
  mismatch), exit-code matrix, `--help`/`--version`.
- Golden tests: §6.2 invocations **in process** via `Cli.RunCli(args)` with
  `Console.SetOut`/`Console.SetError` capture, byte-compared (no subprocess
  launches — they dodge coverage).
- Determinism test: run each command twice in-process, byte-compare.
- Coverage ≥ 85% lines on the `Huffcode` assembly (coverlet, via
  `dotnet test --collect:"XPlat Code Coverage"`). Zero warnings; no
  wall-clock/network dependence.

## 9. Commands

| Purpose | Command |
|---|---|
| Build | `dotnet build` |
| Run | `dotnet run --project src/Huffcode -- encode --in sample/message.txt --out out.huf` |
| Test | `dotnet test` |
| Coverage | `dotnet test --collect:"XPlat Code Coverage"` (coverlet, Huffcode assembly) |

## 10. Documentation

README: goal, quickstart (≤ 3 commands from clean checkout), architecture
overview (module map + parallel slice map, layering rules), algorithm summary
(deterministic tie-break, MSB-first, padding), container format table, §6.2
worked example, exit-code + error-code table, test/coverage instructions.
