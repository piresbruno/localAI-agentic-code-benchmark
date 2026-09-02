import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ingest } from "../src/ingest.js";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "logsluice-ingest-"));
  await mkdir(path.join(dir, "sub", "deep"), { recursive: true });
  await writeFile(path.join(dir, "x1.log"), '{"ts":"2026-09-01T12:00:00Z","level":"info","svc":"a","msg":"1"}\n');
  await writeFile(path.join(dir, "x2.log"), '{"ts":"2026-09-01T12:00:01Z","level":"info","svc":"a","msg":"2"}\n');
  await writeFile(path.join(dir, "sub", "x3.log"), '{"ts":"2026-09-01T12:00:02Z","level":"info","svc":"a","msg":"3"}\n');
  await writeFile(path.join(dir, "sub", "deep", "x4.log"), '{"ts":"2026-09-01T12:00:03Z","level":"info","svc":"a","msg":"4"}\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const AUTO = { format: "auto", year: 2026 } as const;

describe("ingest glob expansion", () => {
  it("glob_resolves_star_and_doublestar", async () => {
    const star = await ingest([path.join(dir, "*.log")], AUTO);
    expect(star.error).toBeNull();
    expect(star.events.map((e) => e.message)).toEqual(["1", "2"]);

    // Lexicographic order applies to the full path string, so sub/deep/x4.log sorts before sub/x3.log.
    const dstar = await ingest([path.join(dir, "**/*.log")], AUTO);
    expect(dstar.error).toBeNull();
    expect(dstar.events.map((e) => e.message)).toEqual(["4", "3", "1", "2"]);

    const q = await ingest([path.join(dir, "x?.log")], AUTO);
    expect(q.error).toBeNull();
    expect(q.events.map((e) => e.message)).toEqual(["1", "2"]);
  });

  it("matches files only, never directories", async () => {
    const r = await ingest([path.join(dir, "*")], AUTO);
    expect(r.error).toBeNull();
    expect(r.events.map((e) => e.message)).toEqual(["1", "2"]);
  });

  it("fails with INPUT_NOT_FOUND when a pattern matches nothing", async () => {
    const r = await ingest([path.join(dir, "nope/*.log")], AUTO);
    expect(r.error).toMatchObject({ code: "INPUT_NOT_FOUND" });
    expect(r.events).toEqual([]);
  });
});

describe("ingest file errors", () => {
  it("fails with FILE_EMPTY on an empty file", async () => {
    const empty = path.join(dir, "zz-empty.log");
    await writeFile(empty, "");
    const r = await ingest([empty], AUTO);
    expect(r.error).toMatchObject({ code: "FILE_EMPTY" });
  });

  it("fails with FILE_EMPTY on a whitespace-only file", async () => {
    const ws = path.join(dir, "zz-ws.log");
    await writeFile(ws, "  \n\t\n");
    const r = await ingest([ws], AUTO);
    expect(r.error).toMatchObject({ code: "FILE_EMPTY" });
  });

  it("fails with FORMAT_UNKNOWN when the format cannot be detected", async () => {
    const f = path.join(dir, "unknown.log");
    await writeFile(f, "level=info svc=a msg=h\n");
    const r = await ingest([f], AUTO);
    expect(r.error).toMatchObject({ code: "FORMAT_UNKNOWN" });
  });

  it("fails with CSV_HEADER_INVALID and aborts without partial events", async () => {
    const f = path.join(dir, "bad.csv");
    await writeFile(f, "timestamp,level,service\n2026-09-01 12:00:00,INFO,a\n");
    const r = await ingest([f], AUTO);
    expect(r.error).toMatchObject({ code: "CSV_HEADER_INVALID" });
    expect(r.events).toEqual([]);
    expect(r.quarantined).toEqual([]);
  });
});

describe("ingest ordering", () => {
  it("preserves_input_order_never_sorts_by_timestamp (R10)", async () => {
    const a = path.join(dir, "a.jsonl");
    const b = path.join(dir, "b.jsonl");
    await writeFile(a, '{"ts":"2026-09-01T12:00:09Z","level":"info","svc":"s","msg":"late"}\n');
    await writeFile(b, '{"ts":"2026-09-01T12:00:01Z","level":"info","svc":"s","msg":"early"}\n');
    const r = await ingest([path.join(dir, "?.jsonl")], AUTO);
    expect(r.error).toBeNull();
    expect(r.events.map((e) => e.message)).toEqual(["late", "early"]); // a before b, not by timestamp
  });

  it("orders multiple files lexicographically by path as passed and removes duplicates", async () => {
    const r = await ingest([path.join(dir, "x*.log"), path.join(dir, "x1.log")], AUTO);
    expect(r.error).toBeNull();
    expect(r.events.map((e) => e.source.file)).toEqual([
      path.join(dir, "x1.log"),
      path.join(dir, "x2.log"),
    ]);
  });
});

describe("ingest blank lines", () => {
  it("skips blank lines but keeps physical line numbers in source", async () => {
    const f = path.join(dir, "blanks.jsonl");
    await writeFile(
      f,
      '\n{"ts":"2026-09-01T12:00:00Z","level":"verbose","svc":"a","msg":"x"}\n' +
        '   \n{"ts":"2026-09-01T12:00:01Z","level":"info","svc":"a","msg":"ok"}\n',
    );
    const r = await ingest([f], AUTO);
    expect(r.error).toBeNull();
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.source.line).toBe(4); // physical line, blanks skipped but counted
    expect(r.quarantined[0]!.source.line).toBe(2);
  });
});

describe("ingest quarantine", () => {
  it("quarantine_carries_raw_source_reason (R3)", async () => {
    const f = path.join(dir, "q.jsonl");
    const line = '{"ts":"2026-09-01T12:00:09Z", "level":"verbose", "svc":"auth", "msg":"meh"}';
    await writeFile(f, line + "\n");
    const r = await ingest([f], AUTO);
    expect(r.error).toBeNull();
    expect(r.quarantined).toEqual([
      {
        raw: line,
        source: { file: f, line: 1 },
        reason: "unknown level: verbose",
      },
    ]);
  });

  it("quarantines short csv rows and invalid json lines without aborting", async () => {
    const f = path.join(dir, "mixed.csv");
    await writeFile(
      f,
      "timestamp,level,service,message,duration_ms\n2026-09-01 12:00:00,INFO,a,ok,\n2026-09-01 12:00:01,INFO,a\n",
    );
    const r = await ingest([f], AUTO);
    expect(r.error).toBeNull();
    expect(r.events).toHaveLength(1);
    expect(r.quarantined).toEqual([
      { raw: "2026-09-01 12:00:01,INFO,a", source: { file: f, line: 3 }, reason: "short row" },
    ]);
  });

  it("uses --year for syslog parsing", async () => {
    const f = path.join(dir, "y.log");
    await writeFile(f, "Sep  1 12:00:07 host billing[7]: FATAL: db conn lost\n");
    const r = await ingest([f], { format: "syslog", year: 2025 });
    expect(r.error).toBeNull();
    expect(r.events[0]!.timestamp).toBe("2025-09-01T12:00:07.000Z");
  });

  it("attaches the detect-format source to events", async () => {
    const f = path.join(dir, "det.jsonl");
    await writeFile(f, '{"ts":"2026-09-01T12:00:00Z","level":"info","svc":"a","msg":"x"}\n');
    const r = await ingest([f], AUTO);
    expect(r.error).toBeNull();
    expect(r.events[0]!.source).toEqual({ file: f, line: 1, format: "jsonl" });
  });
});
