export type Level = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
export type SourceFormat = "jsonl" | "csv" | "syslog";

/** Fields as found in the source line, before semantic normalization. */
export interface RawFields {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  durationMs: string | null; // duration as text, or null when absent
}

export type ParsedLine =
  | { ok: true; fields: RawFields }
  | { ok: false; reason: string };

export interface LogEvent {
  timestamp: string;         // canonical: YYYY-MM-DDTHH:MM:SS.mmmZ (§4.3)
  level: Level;
  service: string;
  message: string;           // preserved verbatim from the source
  durationMs: number | null; // null when the source line carries no duration
  source: { file: string; line: number; format: SourceFormat };
}

export interface QuarantineRecord {
  raw: string;
  source: { file: string; line: number };
  reason: string;
}

export interface Summary {
  totalEvents: number;       // normalized events, before dedup
  quarantined: number;
  deduped: number;           // dropped by --dedup
  byLevel: Record<Level, number>;                        // all six keys, zero-filled
  byService: Array<{ service: string; count: number }>;  // count desc, name asc
  topOffenders: Array<{ service: string; errors: number }>; // error+fatal desc, name asc
  percentiles: { p50: number | null; p95: number | null };  // null when no durations / not requested
}
