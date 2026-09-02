import { describe, expect, it } from "vitest";
import { renderJson, renderTable } from "../src/report.js";
import type { Summary } from "../src/types.js";

const SAMPLE: Summary = {
  totalEvents: 10,
  quarantined: 1,
  deduped: 0,
  byLevel: { trace: 0, debug: 1, info: 4, warn: 1, error: 2, fatal: 2 },
  byService: [
    { service: "api-gateway", count: 4 },
    { service: "billing", count: 4 },
    { service: "auth", count: 2 },
  ],
  topOffenders: [
    { service: "billing", errors: 3 },
    { service: "api-gateway", errors: 1 },
  ],
  percentiles: { p50: 120, p95: 999 },
};

const EXPECTED_TABLE = `events  10
quarantined  1
deduped  0

by level
trace  0
debug  1
info  4
warn  1
error  2
fatal  2

by service
api-gateway  4
billing  4
auth  2

top offenders (error+fatal)
billing  3
api-gateway  1

latency (ms)
p50  120
p95  999
`;

describe("report", () => {
  it("renderTable produces the pinned §6.2 table byte-exactly", () => {
    expect(renderTable(SAMPLE)).toBe(EXPECTED_TABLE);
  });

  it("renderTable prints section headers only for zero-row sections", () => {
    const empty: Summary = {
      totalEvents: 0,
      quarantined: 0,
      deduped: 0,
      byLevel: { trace: 0, debug: 0, info: 0, warn: 0, error: 0, fatal: 0 },
      byService: [],
      topOffenders: [],
      percentiles: { p50: null, p95: null },
    };
    expect(renderTable(empty)).toBe(`events  0
quarantined  0
deduped  0

by level
trace  0
debug  0
info  0
warn  0
error  0
fatal  0

by service

top offenders (error+fatal)

latency (ms)
p50  -
p95  -
`);
  });

  it("renderJson pretty-prints with two spaces and trailing newline", () => {
    expect(renderJson(SAMPLE)).toBe(JSON.stringify(SAMPLE, null, 2) + "\n");
    // key order matches §4.1 interface order (insertion order of the object)
    const keys = Object.keys(JSON.parse(renderJson(SAMPLE)));
    expect(keys).toEqual(["totalEvents", "quarantined", "deduped", "byLevel", "byService", "topOffenders", "percentiles"]);
  });
});
