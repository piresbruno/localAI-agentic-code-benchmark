import { promises as fs } from "node:fs";
import path from "node:path";
import { csvHeaderValid, parseCsvLine, parseCsvRow } from "./parsers/csv.js";
import { parseJsonl } from "./parsers/jsonl.js";
import { parseSyslog } from "./parsers/syslog.js";
import { detectFormat } from "./detect.js";
import { normalizeFields } from "./normalize.js";
import type { LogEvent, QuarantineRecord, SourceFormat } from "./types.js";

export interface IngestError {
  code: string;
  message: string;
}

export interface IngestOptions {
  format: SourceFormat | "auto";
  year: number;
}

export interface IngestResult {
  events: LogEvent[];
  quarantined: QuarantineRecord[];
  error: IngestError | null;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------- glob expansion (§5 R10: *, **, ?; files only; lexicographic) ----------

function hasGlob(p: string): boolean {
  return /[*?]/.test(p);
}

function globToRegex(glob: string): RegExp {
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else {
          re += ".*";
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(re + "$");
}

async function walk(
  dir: string,
  prefix: string,
  rel: string,
  acc: string[],
  regex: RegExp | null,
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => compareStrings(a.name, b.name));
  for (const ent of entries) {
    const childRel = rel === "" ? ent.name : `${rel}/${ent.name}`;
    if (ent.isDirectory()) {
      await walk(path.join(dir, ent.name), prefix, childRel, acc, regex);
    } else if (ent.isFile()) {
      const candidate = prefix === "" ? childRel : `${prefix}/${childRel}`;
      if (regex === null || regex.test(candidate)) acc.push(candidate);
    }
  }
}

async function expandPattern(pattern: string): Promise<string[]> {
  if (!hasGlob(pattern)) {
    const st = await fs.stat(pattern).catch(() => null);
    if (st === null) return [];
    if (st.isFile()) return [pattern];
    if (st.isDirectory()) {
      const acc: string[] = [];
      await walk(pattern, pattern, "", acc, null);
      return acc;
    }
    return [];
  }
  const segments = pattern.split("/");
  let i = 0;
  while (i < segments.length && !hasGlob(segments[i]!)) i++;
  const base = segments.slice(0, i).join("/");
  const baseDir = base === "" ? "." : base;
  const st = await fs.stat(baseDir).catch(() => null);
  if (st === null || !st.isDirectory()) return [];
  const acc: string[] = [];
  await walk(baseDir, base, "", acc, globToRegex(pattern));
  return acc;
}

// ---------- per-file processing ----------

function splitLines(content: string): string[] {
  const lines = content.split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function fail(code: string, message: string): IngestError {
  return { code, message };
}

function quarantine(line: string, file: string, lineNo: number, reason: string): QuarantineRecord {
  return { raw: line, source: { file, line: lineNo }, reason };
}

async function processFile(
  file: string,
  opts: IngestOptions,
  events: LogEvent[],
  quarantined: QuarantineRecord[],
): Promise<IngestError | null> {
  let content: string;
  try {
    content = await fs.readFile(file, "utf8");
  } catch {
    return fail("INPUT_NOT_FOUND", `cannot read: ${file}`);
  }

  const lines = splitLines(content);
  const numbered = lines
    .map((l, idx) => ({ l, lineNo: idx + 1 }))
    .filter((x) => x.l.trim() !== "");
  if (numbered.length === 0) return fail("FILE_EMPTY", `empty file: ${file}`);

  const effectiveFormat = opts.format === "auto" ? detectFormat(numbered[0]!.l) : opts.format;
  if (effectiveFormat === null) return fail("FORMAT_UNKNOWN", `unknown format: ${file}`);

  if (effectiveFormat === "csv") {
    const headerCells = parseCsvRow(numbered[0]!.l);
    if (!csvHeaderValid(headerCells)) {
      return fail("CSV_HEADER_INVALID", `invalid csv header: ${file}`);
    }
    for (const { l, lineNo } of numbered.slice(1)) {
      const parsed = parseCsvLine(l, headerCells);
      if (!parsed.ok) {
        quarantined.push(quarantine(l, file, lineNo, parsed.reason));
        continue;
      }
      const res = normalizeFields(parsed.fields, { file, line: lineNo, format: "csv" });
      if ("reason" in res) quarantined.push({ raw: l, source: res.source, reason: res.reason });
      else events.push(res);
    }
    return null;
  }

  for (const { l, lineNo } of numbered) {
    if (effectiveFormat === "syslog") {
      const parsed = parseSyslog(l, opts.year);
      if (!parsed.ok) {
        quarantined.push(quarantine(l, file, lineNo, parsed.reason));
        continue;
      }
      const res = normalizeFields(parsed.fields, { file, line: lineNo, format: "syslog" });
      if ("reason" in res) quarantined.push({ raw: l, source: res.source, reason: res.reason });
      else events.push(res);
      continue;
    }
    const parsed = parseJsonl(l);
    if (!parsed.ok) {
      quarantined.push(quarantine(l, file, lineNo, parsed.reason));
      continue;
    }
    const res = normalizeFields(parsed.fields, { file, line: lineNo, format: "jsonl" });
    if ("reason" in res) quarantined.push({ raw: l, source: res.source, reason: res.reason });
    else events.push(res);
  }
  return null;
}

// ---------- public ----------

export async function ingest(patterns: string[], opts: IngestOptions): Promise<IngestResult> {
  const all: string[] = [];
  for (const pattern of patterns) {
    const matched = await expandPattern(pattern);
    if (matched.length === 0) {
      return { events: [], quarantined: [], error: fail("INPUT_NOT_FOUND", `input not found: ${pattern}`) };
    }
    all.push(...matched);
  }

  const seen = new Set<string>();
  const files: string[] = [];
  for (const f of all) {
    const key = path.resolve(f);
    if (seen.has(key)) continue;
    seen.add(key);
    files.push(f);
  }
  files.sort(compareStrings); // R10: lexicographic order of the path as passed

  const events: LogEvent[] = [];
  const quarantined: QuarantineRecord[] = [];
  for (const file of files) {
    const err = await processFile(file, opts, events, quarantined);
    if (err !== null) return { events, quarantined, error: err };
  }
  return { events, quarantined, error: null };
}

/** Only I/O module: also owns output writes (no partial output on data errors). */
export async function writeFile(target: string, content: string): Promise<void> {
  const dir = path.dirname(target);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(target, content, "utf8");
}
