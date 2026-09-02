import type { Level, LogEvent, QuarantineRecord, RawFields, SourceFormat } from "./types.js";

/** §4.3 normative grammar. */
const TS_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})?$/;

const LEVEL_MAP: Record<string, Level> = {
  trace: "trace",
  debug: "debug",
  info: "info",
  warn: "warn",
  warning: "warn",
  error: "error",
  err: "error",
  fatal: "fatal",
  critical: "fatal",
  crit: "fatal",
};

function isLeap(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** Returns the canonical `...Z` timestamp, or null when invalid. */
function normalizeTimestamp(raw: string): string | null {
  const m = TS_RE.exec(raw);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = Number(m[6]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  if (hh > 23 || mm > 59 || ss > 59) return null;

  const frac = m[7] ?? "";
  const fracMs = frac === "" ? 0 : Number(frac.padEnd(3, "0"));
  const suffix = m[8];
  let offsetMs = 0;
  if (suffix && suffix !== "Z") {
    const sign = suffix[0] === "-" ? -1 : 1;
    offsetMs = sign * (Number(suffix.slice(1, 3)) * 60 + Number(suffix.slice(4, 6))) * 60000;
  }

  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hh, mm, ss, fracMs);
  const utc = new Date(d.getTime() - offsetMs);
  return (
    `${pad(utc.getUTCFullYear(), 4)}-${pad(utc.getUTCMonth() + 1, 2)}-${pad(utc.getUTCDate(), 2)}` +
    `T${pad(utc.getUTCHours(), 2)}:${pad(utc.getUTCMinutes(), 2)}:${pad(utc.getUTCSeconds(), 2)}` +
    `.${pad(utc.getUTCMilliseconds(), 3)}Z`
  );
}

function mapLevel(raw: string): Level | null {
  return LEVEL_MAP[raw.trim().toLowerCase()] ?? null;
}

/** §5 R7: null/empty → null; finite number ≥ 0; otherwise "invalid". */
function parseDuration(raw: string | null): number | null | "invalid" {
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return n;
  return "invalid";
}

export function normalizeFields(
  fields: RawFields,
  source: { file: string; line: number; format: SourceFormat },
): LogEvent | QuarantineRecord {
  const sourceOfRecord = { file: source.file, line: source.line };

  const ts = normalizeTimestamp(fields.timestamp);
  if (ts === null) {
    return {
      raw: "",
      source: sourceOfRecord,
      reason: `invalid timestamp: ${fields.timestamp}`,
    };
  }

  const level = mapLevel(fields.level);
  if (level === null) {
    return { raw: "", source: sourceOfRecord, reason: `unknown level: ${fields.level.trim()}` };
  }

  const durationMs = parseDuration(fields.durationMs);
  if (durationMs === "invalid") {
    return { raw: "", source: sourceOfRecord, reason: `invalid duration: ${fields.durationMs ?? ""}` };
  }

  return {
    timestamp: ts,
    level,
    service: fields.service,
    message: fields.message,
    durationMs,
    source: { file: source.file, line: source.line, format: source.format },
  };
}
