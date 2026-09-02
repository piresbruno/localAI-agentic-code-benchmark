import { describe, expect, it } from "vitest";
import { normalizeFields } from "../src/normalize.js";
import type { RawFields } from "../src/types.js";
import { asEvent, asQuarantine } from "./helpers.js";

const SRC = { file: "f.log", line: 1, format: "syslog" as const };

function fields(overrides: Partial<RawFields> = {}): RawFields {
  return {
    timestamp: "2026-09-01T12:00:00Z",
    level: "info",
    service: "svc",
    message: "m",
    durationMs: null,
    ...overrides,
  };
}

describe("normalizeFields", () => {
  it("normalizes_every_timestamp_to_utc_z (R1)", () => {
    const cases: Array<[string, string]> = [
      ["2026-09-01 12:00:05", "2026-09-01T12:00:05.000Z"], // naive = UTC, space separator
      ["2026-09-01T14:00:00+02:00", "2026-09-01T12:00:00.000Z"], // positive offset applied
      ["2026-09-01T12:00:00-05:00", "2026-09-01T17:00:00.000Z"], // negative offset applied
      ["2026-09-01T12:00:01.250Z", "2026-09-01T12:00:01.250Z"],
      ["2026-09-01T12:00:00.5Z", "2026-09-01T12:00:00.500Z"], // .5 right-padded
      ["2026-09-01T12:00:00.25Z", "2026-09-01T12:00:00.250Z"], // .25 right-padded
      ["2026-09-01T00:00:00+02:00", "2026-08-31T22:00:00.000Z"], // day roll-back
      ["2026-09-01T12:00:00.5+02:00", "2026-09-01T10:00:00.500Z"],
    ];
    for (const [raw, expected] of cases) {
      expect(asEvent(normalizeFields(fields({ timestamp: raw }), SRC)).timestamp).toBe(expected);
    }
  });

  it("rejects calendar-invalid or malformed timestamps (R1)", () => {
    const bad = [
      "2026-02-30T12:00:00Z", // Feb 30
      "2026-02-29T12:00:00Z", // non-leap
      "2026-13-01T12:00:00Z", // month 13
      "2026-09-01T24:00:00Z", // hour 24
      "2026-09-01T12:60:00Z", // minute 60
      "2026-09-01T12:00:60Z", // leap second
      "1725148800", // numeric epoch
      "2026/09/01T12:00:00Z",
      "2026-09-01T12:00:00.1234Z", // four fraction digits
    ];
    for (const raw of bad) {
      expect(asQuarantine(normalizeFields(fields({ timestamp: raw }), SRC)).reason).toBe(
        `invalid timestamp: ${raw}`,
      );
    }
  });

  it("accepts Feb 29 in a leap year", () => {
    expect(asEvent(normalizeFields(fields({ timestamp: "2024-02-29T12:00:00Z" }), SRC)).timestamp).toBe(
      "2024-02-29T12:00:00.000Z",
    );
  });

  it("maps_level_aliases_case_insensitively (R2)", () => {
    const cases: Array<[string, string]> = [
      ["info", "info"],
      ["INFO", "info"],
      ["warning", "warn"],
      ["Warn", "warn"],
      ["warn", "warn"],
      ["error", "error"],
      ["ERR", "error"],
      ["err", "error"],
      ["critical", "fatal"],
      ["crit", "fatal"],
      ["FATAL", "fatal"],
      ["trace", "trace"],
      ["debug", "debug"],
      [" info ", "info"], // trim + lowercase
    ];
    for (const [raw, expected] of cases) {
      expect(asEvent(normalizeFields(fields({ level: raw }), SRC)).level).toBe(expected);
    }
  });

  it("quarantines_unknown_level (R2)", () => {
    for (const raw of ["verbose", "notice", "panic", ""]) {
      expect(asQuarantine(normalizeFields(fields({ level: raw }), SRC)).reason).toBe(
        `unknown level: ${raw}`,
      );
    }
    // raw is trimmed in the reason
    expect(asQuarantine(normalizeFields(fields({ level: " Verbose " }), SRC)).reason).toBe(
      "unknown level: Verbose",
    );
  });

  it("validates_duration_non_negative_number (R7)", () => {
    const ok: Array<[string | null, number | null]> = [
      [null, null],
      ["", null],
      ["120", 120],
      ["120.5", 120.5],
      ["0", 0],
    ];
    for (const [raw, expected] of ok) {
      expect(asEvent(normalizeFields(fields({ durationMs: raw }), SRC)).durationMs).toBe(expected);
    }
    for (const raw of ["-5", "abc", "Infinity", "NaN", "1e999"]) {
      expect(asQuarantine(normalizeFields(fields({ durationMs: raw }), SRC)).reason).toBe(
        `invalid duration: ${raw}`,
      );
    }
  });

  it("keeps message verbatim and service as parsed", () => {
    const e = asEvent(normalizeFields(fields({ message: "  spaced  \n", service: "api-gateway" }), SRC));
    expect(e.message).toBe("  spaced  \n");
    expect(e.service).toBe("api-gateway");
  });

  it("quarantine records carry source (file, line) and reason", () => {
    const q = asQuarantine(
      normalizeFields(fields({ level: "verbose" }), { file: "logs/x.log", line: 7, format: "jsonl" }),
    );
    expect(q.source).toEqual({ file: "logs/x.log", line: 7 });
    expect(q.reason).toBe("unknown level: verbose");
  });
});
