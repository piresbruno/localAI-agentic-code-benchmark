import { describe, expect, it } from "vitest";
import { detectFormat } from "../src/detect.js";

const SYSLOG = "Sep  1 12:00:07 host billing[7]: FATAL: db conn lost";
const SYSLOG_NO_PID = "Sep 01 12:00:08 host auth: info: token refresh";

describe("detectFormat", () => {
  it("detects_format_per_file_from_first_line (R4): jsonl when the line starts with {", () => {
    expect(detectFormat('{"ts":"2026-09-01T12:00:00Z","level":"info"}')).toBe("jsonl");
    expect(detectFormat('  {"ts":"2026-09-01T12:00:00Z"}')).toBe("jsonl");
  });

  it("detects csv when the first comma-separated cell (trimmed, lowercased) is timestamp", () => {
    expect(detectFormat("timestamp,level,service,message")).toBe("csv");
    expect(detectFormat("  Timestamp,Level,Service,Message  ")).toBe("csv");
    expect(detectFormat('"timestamp","level","service"')).toBe("csv");
    expect(detectFormat("timestamp")).toBe("csv");
  });

  it("detects syslog when the line matches the simplified grammar", () => {
    expect(detectFormat(SYSLOG)).toBe("syslog");
    expect(detectFormat(SYSLOG_NO_PID)).toBe("syslog");
  });

  it("returns null for an unknown format", () => {
    expect(detectFormat("level=info service=a")).toBeNull();
    expect(detectFormat("2026-09-01T12:00:00Z [info] service: msg")).toBeNull();
    expect(detectFormat("key: value")).toBeNull();
  });
});
