#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { crc32 } from "./crc.js";

const VERSION = "1.0.0";

function emitError(code: string, message: string): number {
  process.stderr.write(JSON.stringify({ error: { code, message } }) + "\n");
  return code === "USAGE" ? 2 : 1;
}

export async function runCli(argv: string[]): Promise<number> {
  if (argv.length === 0) return emitError("USAGE", "missing --in");
  if (argv[0] === "--help" || argv[0] === "-h") {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv[0] === "--version" || argv[0] === "-v") {
    process.stdout.write(`fastcrc ${VERSION}\n`);
    return 0;
  }
  if (argv[0] !== "--in") return emitError("USAGE", `unknown flag: ${argv[0]}`);
  if (argv.length < 2) return emitError("USAGE", "missing value for --in");
  if (argv.length > 2) return emitError("USAGE", `unknown argument: ${argv[2]}`);
  const file = argv[1]!;

  let data: Buffer;
  try {
    data = await readFile(file);
  } catch {
    return emitError("INPUT_NOT_FOUND", `input not found: ${file}`);
  }

  process.stdout.write(crc32(data).toString(16).padStart(8, "0") + "\n");
  return 0;
}

const HELP = `fastcrc — CRC-32 (IEEE 802.3) checksum CLI (version ${VERSION})

Computes the standard CRC-32/ISO-HDLC checksum of a file and prints it as 8
lowercase hex characters.

USAGE
  fastcrc --in <file>
  fastcrc --help | -h
  fastcrc --version | -v

OPTIONS
  --in <file>   Input file; the raw bytes are checksummed. Required.

OUTPUT
  Exactly one line on stdout: 8 lowercase hex characters + newline.
  No other output for success; errors go to stderr.

EXIT CODES
  0  Success
  1  Data error: INPUT_NOT_FOUND (input file missing/unreadable)
  2  Usage error: USAGE (no args, unknown flag, missing --in value,
     extra argument)

ERROR FORMAT
  Every failure prints one single-line JSON object on stderr:
    {"error":{"code":"USAGE","message":"unknown flag: --foo"}}

ALGORITHM
  CRC-32/ISO-HDLC (IEEE 802.3): reflected polynomial 0xEDB88320,
  initial value 0xFFFFFFFF, final XOR 0xFFFFFFFF. Bytes are processed
  LSB-first in the reflected sense; the result is printed as lowercase hex,
  zero-padded to 8 characters.

EXAMPLE
  fastcrc --in sample/check.txt   # prints cbf43926
`;

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.exit(await runCli(process.argv.slice(2)));
}
