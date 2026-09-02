import { describe, expect, it } from "vitest";
import { summarize } from "../src/summary.js";
import type { LogEvent, Summary } from "../src/types.js";

let n = 0;
function ev(overrides: Partial<LogEvent> = {}): LogEvent {
  n++;
  return {
    timestamp: `2026-09-01T12:00:${String(n).padStart(2, "0")}Z`,
    level: "info",
    service: "svc",
    message: `m${n}`,
    durationMs: null,
    source: { file: "f", line: n, format: "jsonl" },
    ...overrides,
  };
}

describe("summarize", () => {
  it("dedups_on_timestamp_service_message_keeping_first (R6)", () => {
    const e1 = ev({ timestamp: "2026-01-01T00:00:00.000Z", service: "a", message: "x", durationMs: 10 });
    const e2 = ev({ timestamp: "2026-01-01T00:00:00.000Z", service: "a", message: "x", durationMs: 99 });
    const other = ev({ service: "b", message: "y" });
    const s = summarize([e1, e2, other], 0, { dedup: true, top: 3, percentiles: ["p50", "p95"] });
    expect(s.totalEvents).toBe(3); // pre-dedup
    expect(s.deduped).toBe(1);
    expect(s.byService).toEqual([
      { service: "a", count: 1 },
      { service: "b", count: 1 },
    ]);
    expect(s.percentiles.p50).toBe(10); // post-dedup stats use first occurrence
  });

  it("dedup key requires timestamp, service AND message to match", () => {
    const a = ev({ timestamp: "2026-01-01T00:00:00.000Z", service: "a", message: "x", durationMs: 1 });
    const b = ev({ timestamp: "2026-01-01T00:00:00.000Z", service: "a", message: "y", durationMs: 2 });
    const c = ev({ timestamp: "2026-01-01T00:00:00.000Z", service: "b", message: "x", durationMs: 3 });
    const s = summarize([a, b, c], 0, { dedup: true, top: 3, percentiles: ["p50", "p95"] });
    expect(s.deduped).toBe(0);
  });

  it("computes_nearest_rank_percentiles (R8)", () => {
    const mk = (durations: number[]) =>
      durations.map((d) => ev({ durationMs: d }));
    const s30 = summarize(mk([10, 20, 30]), 0, { dedup: false, top: 3, percentiles: ["p50", "p95"] });
    expect(s30.percentiles).toEqual({ p50: 20, p95: 30 });
    const s400 = summarize(mk([100, 200, 300, 400]), 0, { dedup: false, top: 3, percentiles: ["p50", "p95"] });
    expect(s400.percentiles).toEqual({ p50: 200, p95: 400 });
  });

  it("returns null percentiles when there are no durations", () => {
    const s = summarize([ev(), ev({ durationMs: null })], 0, {
      dedup: false,
      top: 3,
      percentiles: ["p50", "p95"],
    });
    expect(s.percentiles).toEqual({ p50: null, p95: null });
  });

  it("nulls unrequested percentiles but always carries both keys", () => {
    const s = summarize([ev({ durationMs: 5 })], 0, { dedup: false, top: 3, percentiles: ["p50"] });
    expect(Object.keys(s.percentiles)).toEqual(["p50", "p95"]);
    expect(s.percentiles).toEqual({ p50: 5, p95: null });
  });

  it("ranks_top_offenders_errors_then_name (R9)", () => {
    const events = [
      ev({ service: "z", level: "error" }),
      ev({ service: "z", level: "fatal" }),
      ev({ service: "a", level: "error" }),
      ev({ service: "a", level: "fatal" }),
      ev({ service: "m", level: "error" }),
      ev({ service: "m", level: "warn" }),
      ev({ service: "n", level: "info" }),
    ];
    const s = summarize(events, 0, { dedup: false, top: 3, percentiles: ["p50", "p95"] });
    expect(s.topOffenders).toEqual([
      { service: "a", errors: 2 },
      { service: "z", errors: 2 },
      { service: "m", errors: 1 },
    ]);
  });

  it("top offenders length respects --top and --top 0 yields empty", () => {
    const events = [
      ev({ service: "a", level: "error" }),
      ev({ service: "b", level: "fatal" }),
      ev({ service: "c", level: "error" }),
    ];
    const s1 = summarize(events, 0, { dedup: false, top: 2, percentiles: ["p50", "p95"] });
    expect(s1.topOffenders).toHaveLength(2);
    const s0 = summarize(events, 0, { dedup: false, top: 0, percentiles: ["p50", "p95"] });
    expect(s0.topOffenders).toEqual([]);
  });

  it("orders by service by count desc then name asc and ignores warn/info for offenders", () => {
    const events = [
      ev({ service: "z", level: "error" }),
      ev({ service: "a", level: "warn" }),
      ev({ service: "a", level: "info" }),
      ev({ service: "m", level: "debug" }),
    ];
    const s = summarize(events, 0, { dedup: false, top: 3, percentiles: ["p50", "p95"] });
    expect(s.byService).toEqual([
      { service: "a", count: 2 },
      { service: "m", count: 1 },
      { service: "z", count: 1 },
    ]);
    expect(s.topOffenders).toEqual([{ service: "z", errors: 1 }]);
  });

  it("zero-fills byLevel with all six keys and passes quarantined through", () => {
    const s = summarize([ev({ level: "error" })], 7, { dedup: false, top: 3, percentiles: [] });
    expect(s.byLevel).toEqual({ trace: 0, debug: 0, info: 0, warn: 0, error: 1, fatal: 0 });
    expect(s.quarantined).toBe(7);
  });

  it("totalEvents counts pre-dedup events only (no quarantine in events)", () => {
    const s = summarize([ev(), ev()], 3, { dedup: true, top: 3, percentiles: ["p50"] });
    expect(s).toMatchObject({ totalEvents: 2, quarantined: 3, deduped: 0 });
  });
});
