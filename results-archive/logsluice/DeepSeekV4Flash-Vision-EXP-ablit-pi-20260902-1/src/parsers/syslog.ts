import type { ParsedLine, RawFields } from "../types.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SYSLOG_RE =
  /^([A-Z][a-z]{2}) +(\d{1,2}) (\d{2}):(\d{2}):(\d{2}) (\S+) ([^\[\s:]+)(?:\[\d+\])?: ([A-Za-z]+): ?(.*)$/;

function isLeap(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

export function parseSyslog(line: string, year: number): ParsedLine {
  const m = SYSLOG_RE.exec(line);
  if (!m) return { ok: false, reason: "invalid syslog line" };
  const month = MONTHS.indexOf(m[1]!);
  if (month === -1) return { ok: false, reason: "invalid syslog line" };

  const day = Number(m[2]);
  const hh = Number(m[3]);
  const mm = Number(m[4]);
  const ss = Number(m[5]);
  if (day < 1 || day > daysInMonth(year, month + 1) || hh > 23 || mm > 59 || ss > 59) {
    return { ok: false, reason: "invalid syslog line" };
  }

  const pad = (n: number): string => String(n).padStart(2, "0");
  const fields: RawFields = {
    timestamp: `${String(year).padStart(4, "0")}-${pad(month + 1)}-${pad(day)}T${pad(hh)}:${pad(mm)}:${pad(ss)}`,
    level: m[8]!,
    service: m[7]!,
    message: m[9]!,
    durationMs: null,
  };
  return { ok: true, fields };
}
