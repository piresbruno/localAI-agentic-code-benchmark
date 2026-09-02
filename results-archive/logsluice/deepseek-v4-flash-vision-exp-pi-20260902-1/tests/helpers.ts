import { vi } from "vitest";
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

/** Test seam: capture writes to stdout/stderr for in-process CLI runs. */
export function captureIO(): {
  stdout: () => string;
  stderr: () => string;
  restore: () => void;
} {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const outSpy = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk) => {
      stdoutChunks.push(String(chunk));
      return true;
    });
  const errSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    });
  return {
    stdout: () => stdoutChunks.join(""),
    stderr: () => stderrChunks.join(""),
    restore: () => {
      outSpy.mockRestore();
      errSpy.mockRestore();
    },
  };
}
