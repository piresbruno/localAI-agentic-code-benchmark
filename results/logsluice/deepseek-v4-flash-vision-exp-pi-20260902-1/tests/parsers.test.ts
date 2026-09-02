import { describe, expect, it } from "vitest";
import { parseJsonl } from "../src/parsers/jsonl.js";
import { parseCsvLine, parseCsvRow } from "../src/parsers/csv.js";
import { parseSyslog } from "../src/parsers/syslog.js";

const CSV_HEADER = ["timestamp", "level", "service", "message", "duration_ms"];

// ---------- JSON Lines ----------
describe("parseJsonl", () => {
  it("accepts a well-formed line with alias keys", () => {
    const r = parseJsonl('{"ts":"2026-09-01T12:00:00Z","level":"info","svc":"api","msg":"ok","dur_ms":120}');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fields).toEqual({
        timestamp: "2026-09-01T12:00:00Z",
        level: "info",
        service: "api",
        message: "ok",
        durationMs: "120",
      });
    }
  });

  it("rejects a line that is not valid json", () => {
    expect(parseJsonl("{bad").ok).toBe(false);
    expect(parseJsonl("{bad")).toEqual({ ok: false, reason: "invalid json" });
  });

  it.each([
    ["[1,2]", "not an object"],
    ["null", "not an object"],
    ['"hello"', "not an object"],
    ["42", "not an object"],
  ])("rejects %s as not an object", (line, reason) => {
    expect(parseJsonl(line)).toEqual({ ok: false, reason });
  });

  it("reports missing field: timestamp when no timestamp key is present", () => {
    expect(parseJsonl('{"level":"info","svc":"a","msg":"m"}')).toEqual({
      ok: false,
      reason: "missing field: timestamp",
    });
  });

  it("reports missing required field when a value is the wrong type", () => {
    expect(parseJsonl('{"ts":123,"level":"info","svc":"a","msg":"m"}')).toEqual({
      ok: false,
      reason: "missing field: timestamp",
    });
  });

  it("reports missing field: level / service / message", () => {
    expect(parseJsonl('{"ts":"2026-01-01T00:00:00Z","svc":"a","msg":"m"}')).toEqual({
      ok: false,
      reason: "missing field: level",
    });
    expect(parseJsonl('{"ts":"2026-01-01T00:00:00Z","level":"info","msg":"m"}')).toEqual({
      ok: false,
      reason: "missing field: service",
    });
    expect(parseJsonl('{"ts":"2026-01-01T00:00:00Z","level":"info","svc":"a"}')).toEqual({
      ok: false,
      reason: "missing field: message",
    });
  });

  it("accepts duration as number, numeric string, null, or absent", () => {
    const n = parseJsonl('{"ts":"2026-01-01T00:00:00Z","level":"info","svc":"a","msg":"m","dur_ms":125}');
    const s = parseJsonl('{"ts":"2026-01-01T00:00:00Z","level":"info","svc":"a","msg":"m","dur_ms":"125"}');
    const nul = parseJsonl('{"ts":"2026-01-01T00:00:00Z","level":"info","svc":"a","msg":"m","dur_ms":null}');
    const absent = parseJsonl('{"ts":"2026-01-01T00:00:00Z","level":"info","svc":"a","msg":"m"}');
    for (const r of [n, s]) expect((r as { ok: true; fields: unknown }).fields).toMatchObject({ durationMs: "125" });
    for (const r of [nul, absent]) expect((r as { ok: true; fields: unknown }).fields).toMatchObject({ durationMs: null });
  });

  it("passes a negative duration through as text (semantic validation is normalize's job)", () => {
    const r = parseJsonl('{"ts":"2026-01-01T00:00:00Z","level":"info","svc":"a","msg":"m","dur_ms":-5}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.durationMs).toBe("-5");
  });

  it("first matching key wins, in object order", () => {
    const r = parseJsonl('{"time":"2026-02-02T00:00:00Z","ts":"2025-01-01T00:00:00Z","level":"info","svc":"a","msg":"m"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.timestamp).toBe("2026-02-02T00:00:00Z");
  });

  it("ignores unknown keys", () => {
    const r = parseJsonl('{"ts":"2026-01-01T00:00:00Z","level":"info","svc":"a","msg":"m","extra":1}');
    expect(r.ok).toBe(true);
  });

  it("accepts an empty message string", () => {
    const r = parseJsonl('{"ts":"2026-01-01T00:00:00Z","level":"info","svc":"a","msg":""}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.message).toBe("");
  });
});

// ---------- CSV ----------
describe("parseCsvLine", () => {
  it("maps columns by header name, case-insensitively", () => {
    const header = ["Timestamp", "Level", "Service", "Message", "Duration_ms"];
    const r = parseCsvLine("2026-01-01 00:00:00,INFO,a,hello,10", header);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fields).toEqual({
        timestamp: "2026-01-01 00:00:00",
        level: "INFO",
        service: "a",
        message: "hello",
        durationMs: "10",
      });
    }
  });

  it("handles quoted fields containing commas", () => {
    const r = parseCsvLine('2026-01-01 00:00:00,INFO,billing,"retried, then ok",', CSV_HEADER);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.message).toBe("retried, then ok");
  });

  it("unpairs escaped quotes per RFC 4180", () => {
    const r = parseCsvLine('2026-01-01 00:00:00,INFO,a,"say ""hi""",', CSV_HEADER);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.message).toBe('say "hi"');
  });

  it("rejects a short row", () => {
    const r = parseCsvLine("2026-01-01 00:00:00,INFO,a", CSV_HEADER);
    expect(r).toEqual({ ok: false, reason: "short row" });
  });

  it("ignores extra fields beyond the header count", () => {
    const r = parseCsvLine("2026-01-01 00:00:00,INFO,a,m,10,EXTRA1,EXTRA2", CSV_HEADER);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.durationMs).toBe("10");
  });

  it("allows a row shorter than the header when only unmapped extra columns are omitted", () => {
    const wideHeader = [...CSV_HEADER, "extra"];
    const r = parseCsvLine('2026-09-01 12:00:05,INFO,billing,"retried, then ok",', wideHeader);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields).toMatchObject({ message: "retried, then ok", durationMs: null });
  });

  it("treats an empty duration_ms cell as null", () => {
    const r = parseCsvLine("2026-01-01 00:00:00,INFO,a,m,", CSV_HEADER);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.durationMs).toBeNull();
  });

  it("uses the first occurrence of a duplicate column name", () => {
    const header = ["timestamp", "timestamp", "level", "service", "message", "duration_ms"];
    const r = parseCsvLine("2026-01-01 00:00:00,IGNORED,INFO,a,m,10", header);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.timestamp).toBe("2026-01-01 00:00:00");
  });

  it("reports short row when a required column is missing from the header", () => {
    const noMsg = ["timestamp", "level", "service", "duration_ms"];
    expect(parseCsvLine("2026-01-01 00:00:00,INFO,a,10", noMsg)).toEqual({ ok: false, reason: "short row" });
  });
});

describe("parseCsvRow", () => {
  it("parses quoted fields with embedded delimiters", () => {
    expect(parseCsvRow('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });
  it("parses escaped quotes", () => {
    expect(parseCsvRow('"x""y"')).toEqual(['x"y']);
  });
});

// ---------- Syslog ----------
describe("parseSyslog", () => {
  it("parses a line with two-space day padding", () => {
    const r = parseSyslog("Sep  1 12:00:07 host billing[7]: FATAL: db conn lost", 2026);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fields).toEqual({
        timestamp: "2026-09-01T12:00:07",
        level: "FATAL",
        service: "billing",
        message: "db conn lost",
        durationMs: null,
      });
    }
  });

  it("parses a line with zero-padded day", () => {
    const r = parseSyslog("Sep 01 12:00:08 host auth[8]: info: token refresh", 2026);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.timestamp).toBe("2026-09-01T12:00:08");
  });

  it("accepts a line without a pid", () => {
    const r = parseSyslog("Sep  1 12:00:07 host billing: INFO: hi", 2026);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fields.service).toBe("billing");
      expect(r.fields.message).toBe("hi");
    }
  });

  it("allows an empty message", () => {
    const r = parseSyslog("Sep  1 12:00:07 host svc: INFO:", 2026);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.message).toBe("");
  });

  it("drops hostname and pid, keeping only service", () => {
    const r = parseSyslog("Sep  1 12:00:07 router billing[123]: info: x", 2026);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields).toMatchObject({ service: "billing" });
  });

  it("rejects unknown month names", () => {
    expect(parseSyslog("Foo 1 12:00:00 host svc: INFO: hi", 2026)).toEqual({
      ok: false,
      reason: "invalid syslog line",
    });
  });

  it("rejects calendar-invalid dates (Feb 30, Feb 29 in a non-leap year)", () => {
    expect(parseSyslog("Feb 30 12:00:00 host svc: INFO: hi", 2026)).toEqual({
      ok: false,
      reason: "invalid syslog line",
    });
    expect(parseSyslog("Feb 29 12:00:00 host svc: INFO: hi", 2026)).toEqual({
      ok: false,
      reason: "invalid syslog line",
    });
  });

  it("accepts Feb 29 in a leap year", () => {
    const r = parseSyslog("Feb 29 12:00:00 host svc: INFO: hi", 2024);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.timestamp).toBe("2024-02-29T12:00:00");
  });

  it("accepts day 31 only for 31-day months", () => {
    expect(parseSyslog("Jun 31 12:00:00 host svc: INFO: hi", 2026)).toEqual({
      ok: false,
      reason: "invalid syslog line",
    });
    expect(parseSyslog("Jul 31 12:00:00 host svc: INFO: hi", 2026).ok).toBe(true);
  });

  it("rejects lines that do not match the grammar", () => {
    expect(parseSyslog("2026-09-01 12:00:00", 2026)).toEqual({ ok: false, reason: "invalid syslog line" });
    expect(parseSyslog("Sep  1 25:00:00 host svc: INFO: hi", 2026)).toEqual({
      ok: false,
      reason: "invalid syslog line",
    });
  });

  it("passes an uppercase level through for semantic mapping", () => {
    const r = parseSyslog("Sep  1 12:00:00 host svc: VERBOSE: hi", 2026);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.level).toBe("VERBOSE");
  });
});
