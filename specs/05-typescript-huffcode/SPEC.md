# Huffcode — Lossless Huffman Codec CLI

**Version**: 1.0.0 (sprint-tier edition, contract-first parallel slices)
**Stack**: TypeScript on Node ≥ 20 (ESM, `"type": "module"`), Vitest. **Zero npm dependencies in `src/`** (Node stdlib only); devDependencies limited to `typescript`, `vitest`, `@types/node` (+ required `@vitest/coverage-v8`).
**Audience**: AI coding agents evaluated on a ~10-minute, exactness-critical algorithm probe — and on how well they exploit an explicitly parallel slice structure.

> **Sprint-tier scope.** This probe targets **200–350 LOC** (350 advised).
> Discrimination comes from one pinned algorithm — optimal prefix-free coding
> with deterministic tie-breaking — and byte-deterministic container output —
> not feature breadth. Everything specified is required; nothing is optional.

## 1. Overview & Goals

Build **Huffcode**, a CLI that compresses a plain byte stream with a Huffman
codec: `encode` (build an optimal prefix-free code from the input's byte
frequencies, serialize the code table + bitstream to a deterministic `.huf`
container) and `decode` (verify the container, reconstruct the original
bytes). Byte-deterministic: same input → identical container bytes, every
run.

**Why this exists.** The probe grades an agent's ability to translate a
pinned algorithm + container format exactly — including an edge case
(single-symbol input) that naive implementations get wrong — with a
deadline-tight scope, and, in parallel, whether it can decompose the work
into independent contract-first slices.

**LOC expectation.** 200–350 lines of production TypeScript under `src/`
(350 advised). Tests and fixtures are excluded.

## 2. Success criterion (pass/fail)

ALL of the following must be true:

1. **Sandboxed** — no dependencies outside the run directory.
2. **Ready to run** — clean checkout: `npm install`, `npm run build`, then
   `node dist/cli.js --help` exits 0. Zero runtime dependencies in `src/`.
3. **Fixture works** — `sample/message.txt` committed verbatim from §6.1; the
   §6.2 golden outputs reproduce **byte-exactly** (SMOKE_CHECK verifies).
4. **All tests pass**, line coverage **≥ 85%** (vitest coverage, v8 provider)
   on `src/**`.
5. **`--help` complete** per §7.
6. **Zero build warnings**; `strict: true` in `tsconfig.json`.

## 3. Architecture (REQUIRED — deviations = fail)

```
huffcode/
├── package.json            # "type": "module", engines >= 20
├── tsconfig.json           # strict: true, outDir: dist/
├── src/
│   ├── types.ts            # S0 — contract, §4.1, committed VERBATIM
│   ├── codec.ts            # S1 — frequencies, Huffman tree, bit encode/decode (PURE)
│   ├── format.ts           # S2 — .huf container serialize/parse (PURE)
│   ├── io.ts               # S3a — the only file-I/O module
│   └── cli.ts              # S3b — argv parsing, error envelope, exit codes, bin shim
├── sample/message.txt      # §6.1 fixture (verbatim)
└── tests/                  # vitest; §5 rules by name; golden bytes
```

**Layering rules (graders grep for violations):**

- `codec.ts` and `format.ts` are **pure**: they import **only** from
  `types.ts` — never `fs`, never `process`.
- `io.ts` is the **only** module doing file I/O; it imports no pure modules.
- `cli.ts` imports `io.ts` + `format.ts` + `codec.ts` and is the **only**
  module writing to stdout/stderr or calling `process.exit` (via `runCli` +
  the bin shim; `runCli` returns the exit code).

### 3.1 Parallel implementation note (scored bonus)

The slices are deliberately independent and contract-first. Build **S0**
first (scaffold + `types.ts` exactly as printed — the contract is complete in
§4, no cross-slice negotiation is needed). Then **S1, S2, S3a/S3b may be
implemented in parallel and in any order**: each pins its exports, inputs
and failure behavior below; S3's code depends only on those signatures, not
on the slices' internals.

Grading: runs whose harness telemetry shows concurrent implementation
(`max_agents` ≥ 2) earn a **parallelization bonus**; `max_agents` is recorded
in the benchmark's results log for this project (see `BENCHMARKS.md`), not
merely informationally — the slice contracts are complete, so a serial agent
gains nothing in correctness and spends more wall time.

## 4. Canonical model & container format

### 4.1 `src/types.ts` — the contract (verbatim)

```ts
/** One symbol's binary code; bits are MSB-first, e.g. "0101". */
export interface CodeTableEntry {
  symbol: number;  // byte value 0–255
  bits: string;    // '0'/'1' string; "" only for a single-symbol alphabet
}

/** .huf container header (first line of the container file). */
export interface ContainerHeader {
  version: 1;
  symbols: CodeTableEntry[];  // sorted by symbol ascending
  payloadLength: number;      // decoded byte count
  dataBits: number;           // number of bits in the bitstream (payload, before padding)
  pad: number;                // padding bits appended to fill the final byte (0–7)
}

export interface Container {
  header: ContainerHeader;
  dataHex: string; // lowercase hex of the padded bitstream; "" when dataBits === 0
}
```

### 4.2 Module contracts (names & behavior pinned; internal helpers free)

| Module | Pinned export | Behavior |
|---|---|---|
| `codec.ts` | `byteFrequencies(data: Uint8Array): Map<number, number>` | exact per-byte counts 0–255; preserves nothing else |
| `codec.ts` | `buildCodeTable(freqs: Map<number, number>): Map<number, string>` | §4.3 Huffman construction; deterministic |
| `codec.ts` | `encodeBits(data: Uint8Array, table: Map<number, string>): string` | codes concatenated in input order (may be `""` for 0-bit alphabets) |
| `codec.ts` | `decodeBits(bits: string, table: Map<number, string>): Uint8Array` | inverse; table must be prefix-free |
| `format.ts` | `serializeHeader(h: ContainerHeader): string` | compact `JSON.stringify`, exact key order `version, symbols, payloadLength, dataBits, pad`; one line, **no** trailing newline |
| `format.ts` | `parseHeader(line: string): ContainerHeader \| null` | `null` on any structural failure (bad JSON, wrong version, missing/extra fields, non-prefix-free table, payloadLength/dataBits/pad inconsistencies) |
| `format.ts` | `renderContainer(c: Container): string` | `<header>\n<hex>` with **no** trailing newline |
| `format.ts` | `parseContainer(text: string): Container \| null` | splits on first `\n`; validates hex (lowercase, even length, exact `pad` bits zero); `null` on any failure; empty hex allowed only when `dataBits === 0` |
| `io.ts` | `readFileText(path: string): Promise<string>` | rejects with `ENOENT`-style errors |
| `io.ts` | `writeFileText(path: string, content: string): Promise<void>` | creates parent dirs |
| `cli.ts` | `runCli(argv: string[]): Promise<number>` | §5/§6 behavior; in-process entry; the bin shim in `cli.ts` calls `process.exit(await runCli(process.argv.slice(2)))` only when executed directly |

### 4.3 Huffman construction (normative)

1. Frequencies are byte counts from the input (`byteFrequencies`), including
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
3. The resulting code is prefix-free; `buildCodeTable` returns
   `Map<symbol → bits>` and must produce the same bits every run.
4. Code bits are **MSB-first**: symbol code `"0101"` is the four bits
   `0,1,0,1`; encoded payload is the concatenation of codes in input order.

### 4.4 `.huf` container (byte-deterministic)

```
<header-line>\n<hex-line>
```

- `<header-line>`: §4.2 `serializeHeader`, then `\n`, then `<hex-line>` =
  lowercase hex of the padded bitstream, **no trailing newline**. When
  `dataBits === 0` the hex line is empty (the file ends with `\n`).
- `symbols` sorted by `symbol` ascending; `bits` as built in §4.3.
- Bitstream: payload bits (input order), then exactly `pad` zero bits
  (0–7) to reach a whole number of bytes; `dataHex` = those bytes, lowercase
  hex. `dataBits` is the payload bit count **before** padding. A `pad` > 0
  with non-zero trailing bits is invalid.
- `payloadLength` must equal the decoded byte count; mismatch → header
  invalid.

## 5. Business rules (each needs a test named for it)

| Named test | Rule |
|---|---|
| `counts_byte_frequencies_exactly` | **R1** — frequencies are exact per-byte counts (0–255, case-sensitive) of raw input bytes, newlines included |
| `builds_minimal_prefix_free_code` | **R2** — table is prefix-free (no code is a prefix of another), every symbol with frequency > 0 has a code, and the total bit cost equals the constructed tree's cost (Σ freq×len), i.e. the Huffman optimum |
| `tie_breaks_by_frequency_then_symbol` | **R3** — merge order pinned: lowest `(frequency, symbol)` first; equal frequencies merge smallest symbols first; bits deterministic across runs |
| `single_symbol_alphabet_uses_empty_code` | **R4** — 1 distinct byte → code `""`, `dataBits` 0, `pad` 0, hex line empty; decode yields `payloadLength` copies of that byte |
| `encodes_msb_first_and_pads_with_zeros` | **R5** — MSB-first order per §4.3; padding zero bits only; `dataBits` counts payload bits only |
| `round_trips_arbitrary_bytes` | **R6** — encode → decode reproduces input byte-for-byte (≥ 2 distinct bytes; include a 256-byte alphabet stress case) |
| `round_trips_empty_message` | **R7** — empty input: symbols `[]`, payloadLength 0, dataBits 0, hex empty; decode round-trips to empty |
| `produces_byte_identical_output_for_equal_input` | **R8** — run twice, byte-compare container |
| `rejects_invalid_headers` | **R9** — decode exits 1 with `INVALID_HEADER` for: non-JSON header, wrong version, missing field, non-prefix-free table, payloadLength mismatch, bad/odd hex, nonzero pad bits |
| `exit_codes_data_vs_usage` | **R10** — 0 success; 1 data (`INPUT_NOT_FOUND`, `INVALID_HEADER`); 2 usage (`USAGE`: unknown command, missing `--in`/`--out`, unknown flag, no args) |

**Error envelope (one error model).** Every failure — including usage —
prints **one single-line JSON object to stderr**:

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

`node dist/cli.js encode --in sample/message.txt --out out.huf` (exit 0) →
`out.huf` byte-exactly:

```
{"version":1,"symbols":[{"symbol":10,"bits":"00"},{"symbol":65,"bits":"01"},{"symbol":66,"bits":"10"},{"symbol":67,"bits":"11"}],"payloadLength":7,"dataBits":14,"pad":2}
5af0
```

`node dist/cli.js decode --in out.huf --out out.txt` → `out.txt` byte-exactly
equals `sample/message.txt`.

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
greps `src/` for layering violations (`fs` outside `io.ts`, cross-imports
between pure modules, `process.exit` outside `cli.ts`); records `max_agents`
from harness telemetry for the parallelization bonus (§3.1).

## 8. Testing requirements

- Unit tests for **every §5 rule by name**, plus: Huffman construction edges
  (2-symbol alphabet, all-equal frequencies, 256-symbol alphabet, single
  symbol), prefix-free verification, header round-trip (serialize → parse),
  parse-header/container failure matrix (bad JSON, wrong version, missing
  field, non-prefix-free table, bad hex, odd length, pad-bit mismatch,
  payloadLength mismatch), exit-code matrix, `--help`/`--version`.
- Golden tests: §6.2 invocations **in process** via `runCli(argv)`, capture
  and byte-compare (no subprocess launches — they dodge coverage).
- Determinism test: run each command twice in-process, byte-compare.
- Coverage ≥ 85% on `src/**` (v8). Zero warnings; `strict: true`; no
  wall-clock/network dependence.

## 9. Commands

| Purpose | Command |
|---|---|
| Install | `npm install` |
| Build | `npm run build` |
| Run | `node dist/cli.js encode --in sample/message.txt --out out.huf` |
| Test | `npm test` |
| Coverage | `npx vitest run --coverage` |

## 10. Documentation

README: goal, quickstart (≤ 3 commands from clean checkout), architecture
overview (module map + parallel slice map, layering rules), algorithm summary
(deterministic tie-break, MSB-first, padding), container format table, §6.2
worked example, exit-code + error-code table, test/coverage instructions.
