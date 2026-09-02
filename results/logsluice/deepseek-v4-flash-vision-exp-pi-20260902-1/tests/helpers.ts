import type { LogEvent, ParsedLine, QuarantineRecord, RawFields } from "../src/types.js";

/** Test seam: assert the parsed line is ok and return its fields. */
export function fieldsOf(r: ParsedLine): RawFields {
  if (!r.ok) throw new Error(`expected parse ok, got: ${r.reason}`);
  return r.fields;
}

/** Test seam: assert a normalize result is a LogEvent. */
export function asEvent(r: LogEvent | QuarantineRecord): LogEvent {
  if (!("timestamp" in r)) throw new Error("expected LogEvent");
  return r;
}

/** Test seam: assert a normalize result is a QuarantineRecord. */
export function asQuarantine(r: LogEvent | QuarantineRecord): QuarantineRecord {
  if (!("reason" in r)) throw new Error("expected QuarantineRecord");
  return r;
}
