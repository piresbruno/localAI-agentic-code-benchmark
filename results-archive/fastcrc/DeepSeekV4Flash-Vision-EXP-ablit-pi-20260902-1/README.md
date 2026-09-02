# Fastcrc

Micro-tier CLI: prints the CRC-32 (IEEE 802.3 / ISO-HDLC) checksum of a file.
Byte-deterministic, zero runtime dependencies, ~10-minute build target.

## Quickstart

```bash
npm install
npm run build
node dist/cli.js --in sample/check.txt          # prints cbf43926
node dist/cli.js --help
```

## Run

```
fastcrc --in <file>
fastcrc --help | -h
fastcrc --version | -v
```

`--in` is required. Output is exactly one line: 8 lowercase hex characters +
newline. Errors print one single-line JSON envelope on stderr, e.g.
`{"error":{"code":"USAGE","message":"unknown flag: --foo"}}`.

## Architecture

```
src/
├── crc.ts    PURE: crc32(data: Uint8Array): number — table-driven reflected CRC-32
└── cli.ts    argv parsing, error envelope, exit codes; runCli + bin shim
```

- `crc.ts` imports nothing (`fs`/`process`/`console` are cli-only concerns).
- `cli.ts` is the only module touching `fs`, `process`, `console`; only it
  prints to stdout/stderr and (via the dist/cli.js shim) calls `process.exit`.

## Algorithm

CRC-32/ISO-HDLC (IEEE 802.3): reflected polynomial `0xEDB88320`, initial
value `0xFFFFFFFF`, final XOR `0xFFFFFFFF`. Pinned check values (independent
cross-check): `123456789` → `cbf43926`, `abc` → `352441c2`, `hello` →
`3610a686`, empty → `00000000`.

## Exit codes

| Exit | Meaning |
|---|---|
| 0 | Success |
| 1 | Data error — `INPUT_NOT_FOUND` |
| 2 | Usage error — `USAGE` (no args, unknown flag, missing value, extra argument) |

## Testing & coverage

```bash
npm test                      # 12 tests, all green
npx vitest run --coverage     # ≥ 85% line gate (96.42% measured, v8)
```

Every §5 rule has a named test; the §6.2 golden (`cbf43926\n`) runs in
process via `runCli` with stdout/stderr capture; determinism verified by
double-run byte-compare.
