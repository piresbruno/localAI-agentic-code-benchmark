import type { ParsedLine, RawFields } from "../types.js";

const REQUIRED = ["timestamp", "level", "service", "message"];

/** RFC 4180-ish row split: double-quote escaping, commas inside quotes. */
export function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"' && cur === "") {
      inQuotes = true;
    } else if (c === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

/** Column names are matched trimmed, case-insensitively; quotes stripped. */
function normalizeName(name: string): string {
  let n = name.trim().toLowerCase();
  if (n.length >= 2 && n.startsWith('"') && n.endsWith('"')) {
    n = n.slice(1, -1);
  }
  return n;
}

/** True when every required column is present in the (case-insensitive) header. */
export function csvHeaderValid(header: string[]): boolean {
  const names = new Set(header.map(normalizeName));
  return REQUIRED.every((name) => names.has(name));
}

/** First occurrence of a duplicate column name wins. */
function columnMap(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((name, i) => {
    const key = normalizeName(name);
    if (!map.has(key)) map.set(key, i);
  });
  return map;
}

export function parseCsvLine(line: string, header: string[]): ParsedLine {
  const fields = parseCsvRow(line);
  const map = columnMap(header);

  let needed = 0;
  for (const name of REQUIRED) {
    const idx = map.get(name);
    if (idx === undefined) return { ok: false, reason: "short row" };
    needed = Math.max(needed, idx + 1);
  }
  const durIdx = map.get("duration_ms");
  if (durIdx !== undefined) needed = Math.max(needed, durIdx + 1);
  if (fields.length < needed) return { ok: false, reason: "short row" };

  const cell = (idx: number | undefined): string => (idx === undefined ? "" : (fields[idx] ?? ""));
  const durCell = cell(durIdx);
  const fieldsOut: RawFields = {
    timestamp: cell(map.get("timestamp")),
    level: cell(map.get("level")),
    service: cell(map.get("service")),
    message: cell(map.get("message")),
    durationMs: durCell.trim() === "" ? null : durCell,
  };
  return { ok: true, fields: fieldsOut };
}
