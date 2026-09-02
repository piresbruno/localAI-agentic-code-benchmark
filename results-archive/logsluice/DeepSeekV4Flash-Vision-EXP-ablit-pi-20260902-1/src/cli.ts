#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { ingest, writeFile } from "./ingest.js";
import { summarize } from "./summary.js";
import { renderJson, renderTable } from "./report.js";
import type { Level, LogEvent, SourceFormat } from "./types.js";

const VERSION = "1.0.0";

type Command = "normalize" | "summary";

interface Options {
  cmd: Command;
  patterns: string[];
  out: string;
  format: SourceFormat | "auto";
  dedup: boolean;
  strict: boolean;
  year: number;
  top: number;
  percentiles: Array<"p50" | "p95">;
  json: boolean;
}

const FORMATS: ReadonlyArray<SourceFormat | "auto"> = ["auto", "jsonl", "csv", "syslog"];
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

interface FlagSpec {
  value: boolean;
  multi?: boolean;
}

const FLAGS: Record<Command, Record<string, FlagSpec>> = {
  normalize: {
    "--in": { value: true, multi: true },
    "--out": { value: true },
    "--format": { value: true },
    "--dedup": { value: false },
    "--strict": { value: false },
    "--year": { value: true },
  },
  summary: {
    "--in": { value: true, multi: true },
    "--top": { value: true },
    "--percentiles": { value: true },
    "--dedup": { value: false },
    "--year": { value: true },
    "--json": { value: false },
  },
};

function emitError(code: string, message: string): number {
  process.stderr.write(JSON.stringify({ error: { code, message } }) + "\n");
  return code === "USAGE" ? 2 : 1;
}

function usage(message: string): { error: string } {
  return { error: message };
}

function dedupeEvents(events: LogEvent[]): LogEvent[] {
  const seen = new Set<string>();
  const out: LogEvent[] = [];
  for (const e of events) {
    const key = `${e.timestamp}\u0000${e.service}\u0000${e.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function parse(argv: string[]): { ok: true; opts: Options } | { ok: false; message: string } {
  if (argv.length === 0) return { ok: false, message: "missing command" };
  const cmd = argv[0] as Command;
  if (cmd !== "normalize" && cmd !== "summary") {
    return { ok: false, message: `unknown command: ${argv[0]}` };
  }

  const opts: Options = {
    cmd,
    patterns: [],
    out: "-",
    format: "auto",
    dedup: false,
    strict: false,
    year: 2026,
    top: 3,
    percentiles: ["p50", "p95"],
    json: false,
  };

  let i = 1;
  while (i < argv.length) {
    const tok = argv[i]!;
    const spec = FLAGS[cmd][tok];
    if (spec === undefined) return { ok: false, message: `unknown flag: ${tok}` };
    if (!spec.value) {
      if (tok === "--dedup") opts.dedup = true;
      if (tok === "--strict") opts.strict = true;
      if (tok === "--json") opts.json = true;
      i++;
      continue;
    }
    i++;
    if (spec.multi) {
      const values: string[] = [];
      while (i < argv.length && !(argv[i]!.startsWith("-") && argv[i] !== "-")) {
        values.push(argv[i]!);
        i++;
      }
      if (values.length === 0) return { ok: false, message: `missing value for ${tok}` };
      opts.patterns.push(...values);
      continue;
    }
    if (i >= argv.length || (argv[i]!.startsWith("-") && argv[i] !== "-")) {
      return { ok: false, message: `missing value for ${tok}` };
    }
    const value = argv[i]!;
    i++;
    if (tok === "--out") opts.out = value;
    else if (tok === "--format") {
      if (!FORMATS.includes(value as SourceFormat | "auto")) {
        return { ok: false, message: `invalid --format: ${value}` };
      }
      opts.format = value as SourceFormat | "auto";
    } else if (tok === "--year") {
      const year = /^\d+$/.test(value) ? Number(value) : NaN;
      if (Number.isNaN(year) || year < YEAR_MIN || year > YEAR_MAX) {
        return { ok: false, message: `invalid --year: ${value}` };
      }
      opts.year = year;
    } else if (tok === "--top") {
      const top = /^\d+$/.test(value) ? Number(value) : NaN;
      if (Number.isNaN(top) || top < 0 || top > 100) {
        return { ok: false, message: `invalid --top: ${value}` };
      }
      opts.top = top;
    } else if (tok === "--percentiles") {
      const parts = value.split(",");
      if (
        parts.length === 0 ||
        !parts.every((p) => p === "p50" || p === "p95")
      ) {
        return { ok: false, message: `invalid --percentiles: ${value}` };
      }
      opts.percentiles = [...new Set(parts as Array<"p50" | "p95">)];
    }
  }

  if (opts.patterns.length === 0) return { ok: false, message: "missing --in" };
  return { ok: true, opts };
}

async function runNormalize(opts: Options): Promise<number> {
  const result = await ingest(opts.patterns, { format: opts.format, year: opts.year });
  if (result.error !== null) return emitError(result.error.code, result.error.message);

  const events = opts.dedup ? dedupeEvents(result.events) : result.events;
  const eventsContent = events.length === 0 ? "" : events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  const quarantineContent =
    result.quarantined.length === 0
      ? ""
      : result.quarantined.map((q) => JSON.stringify(q)).join("\n") + "\n";
  const quarantinePath = opts.out === "-" ? "quarantine.jsonl" : `${opts.out}.quarantine`;

  try {
    if (opts.out === "-") process.stdout.write(eventsContent);
    else await writeFile(opts.out, eventsContent);
    await writeFile(quarantinePath, quarantineContent);
  } catch {
    return emitError("USAGE", `cannot write: ${quarantinePath}`);
  }

  if (opts.strict && result.quarantined.length > 0) return 2;
  return 0;
}

async function runSummary(opts: Options): Promise<number> {
  const result = await ingest(opts.patterns, { format: opts.format, year: opts.year });
  if (result.error !== null) return emitError(result.error.code, result.error.message);

  const s = summarize(result.events, result.quarantined.length, {
    dedup: opts.dedup,
    top: opts.top,
    percentiles: opts.percentiles,
  });
  process.stdout.write(opts.json ? renderJson(s) : renderTable(s));
  return 0;
}

export async function runCli(argv: string[]): Promise<number> {
  if (argv[0] === "--help" || argv[0] === "-h") {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv[0] === "--version" || argv[0] === "-v") {
    process.stdout.write(`logsluice ${VERSION}\n`);
    return 0;
  }
  const parsed = parse(argv);
  if (!parsed.ok) return emitError("USAGE", parsed.message);
  if (parsed.opts.cmd === "normalize") return runNormalize(parsed.opts);
  return runSummary(parsed.opts);
}

const HELP = `logsluice — log normalizer & summary CLI (version ${VERSION})

Normalizes mixed-format application logs (JSON Lines, CSV, simplified syslog)
into a canonical JSONL event stream, quarantines unparseable lines with a
reason, and prints deterministic summary reports.

USAGE
  logsluice normalize --in <glob...> [options]
  logsluice summary   --in <glob...> [options]
  logsluice --help | -h
  logsluice --version | -v

COMMANDS
  normalize
      Normalize every parseable line into canonical JSONL. Events are written
      to --out (default: stdout). Quarantine records go to <out>.quarantine,
      or quarantine.jsonl in the current directory when --out is "-".
  summary
      Print a deterministic summary: totals, per-level counts, per-service
      counts, top offenders and latency percentiles. Use --json for the
      machine-readable form.

OPTIONS

  normalize:
    --in <glob...>          Input files; supports * (any chars except /),
                            ** (any chars including /) and ? (single char).
                            Files are processed in lexicographic path order,
                            duplicates removed. Required.
    --out <file|->          Event stream file, or "-" for stdout. Default: -.
    --format <fmt>          auto | jsonl | csv | syslog. auto (default)
                            sniffs the format per file from its first
                            non-blank line; an explicit value applies to all
                            files and skips detection.
    --dedup                 Drop events with the same canonical timestamp +
                            service + message, keeping the first occurrence.
    --strict                Exit 2 when at least one line was quarantined
                            (without it, exit is 0).
    --year <yyyy>           Year for syslog lines, which carry no year.
                            Default: 2026. Range: 1900-2100.

  summary:
    --in <glob...>          Same as normalize. Required.
    --top <n>               Maximum rows in top offenders (0-100).
                            Default: 3. --top 0 yields an empty section.
    --percentiles <list>    Comma-separated subset of p50,p95.
                            Default: p50,p95; unrequested values are null.
    --dedup                 Compute statistics post-dedup (dedup key =
                            canonical timestamp + service + message).
    --year <yyyy>           Same as normalize. Default: 2026.
    --json                  Print the summary as pretty JSON instead of a table.

EXIT CODES
  0  Success; quarantined lines alone do not fail a run.
  1  Data error: INPUT_NOT_FOUND, FORMAT_UNKNOWN, FILE_EMPTY,
     CSV_HEADER_INVALID. Aborts before any output is written.
  2  Usage error (USAGE): unknown flag/command, missing --in, invalid
     --format/--top/--percentiles/--year values, no arguments. Also
     --strict with at least one quarantined line.

ERROR FORMAT
  Every failure prints one single-line JSON object to stderr:
    {"error":{"code":"USAGE","message":"unknown flag: --foo"}}
  Codes: USAGE (exit 2) plus the data codes listed above (exit 1).
  Messages never leak stack traces, exception types, or internal paths.

FORMAT GRAMMARS

  JSON Lines — one JSON object per line:
    timestamp: ts | time | timestamp    (string)
    level:     level | severity         (string)
    service:   svc | service | app      (string)
    message:   msg | message            (string, may be empty)
    durationMs: dur_ms | duration_ms | durationMs (number, numeric string,
                or null; optional)
    Unknown keys are ignored; the first matching key in the line wins.

  CSV — RFC 4180 quoting ("" escapes a quote; quoted fields may contain
  commas but not newlines). Line 1 is the header; columns are matched by
  name (trimmed, case-insensitive); required columns: timestamp, level,
  service, message; optional: duration_ms; extra columns are ignored.
  A header missing a required column is a file error (CSV_HEADER_INVALID).

  Syslog (simplified):  Mmm dd HH:MM:SS host tag[pid]: LEVEL: message
    Months are Jan..Dec; day is 1-2 digits and must be calendar-valid; the
    year comes from --year (default 2026). Hostname and [pid] are dropped.
    A line failing the grammar or calendar is quarantined with
    "invalid syslog line".

  TIMESTAMPS
    Pattern: YYYY-MM-DD[T ]HH:MM:SS[.sss][Z|±HH:MM]. Naive timestamps are
    UTC; offsets are applied and the result is expressed in UTC; fractional
    seconds are milliseconds, right-padded to 3 digits. Canonical form:
    YYYY-MM-DDTHH:MM:SS.mmmZ. Numeric epochs are invalid.

  LEVEL ALIASES
    trace, debug, info, warn|warning, error|err, fatal|critical|crit
    — case-insensitive, trimmed. Anything else quarantines the line with
    "unknown level: <raw>".

EXAMPLE
  logsluice normalize --in "sample/*" --out out.jsonl
      Writes canonical events to out.jsonl and quarantine records to
      out.jsonl.quarantine.
  logsluice summary --in "sample/*" --json
      Prints the deterministic summary as JSON.
`;

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.exit(await runCli(process.argv.slice(2)));
}
