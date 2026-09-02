import type { ParsedLine, RawFields } from "../types.js";

const TS_KEYS = ["ts", "time", "timestamp"];
const LEVEL_KEYS = ["level", "severity"];
const SERVICE_KEYS = ["svc", "service", "app"];
const MESSAGE_KEYS = ["msg", "message"];
const DURATION_KEYS = ["dur_ms", "duration_ms", "durationMs"];

/** First key present in the object (insertion order) that is in accepted. */
function pick(obj: Record<string, unknown>, accepted: string[]): unknown {
  for (const key of Object.keys(obj)) {
    if (accepted.includes(key)) return obj[key];
  }
  return undefined;
}

export function parseJsonl(line: string): ParsedLine {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return { ok: false, reason: "invalid json" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: "not an object" };
  }
  const obj = parsed as Record<string, unknown>;
  const ts = pick(obj, TS_KEYS);
  const level = pick(obj, LEVEL_KEYS);
  const service = pick(obj, SERVICE_KEYS);
  const message = pick(obj, MESSAGE_KEYS);
  if (typeof ts !== "string") return { ok: false, reason: "missing field: timestamp" };
  if (typeof level !== "string") return { ok: false, reason: "missing field: level" };
  if (typeof service !== "string") return { ok: false, reason: "missing field: service" };
  if (typeof message !== "string") return { ok: false, reason: "missing field: message" };

  const dur = pick(obj, DURATION_KEYS);
  const durationMs: string | null = dur === undefined || dur === null ? null : String(dur);

  const fields: RawFields = { timestamp: ts, level, service, message, durationMs };
  return { ok: true, fields };
}
