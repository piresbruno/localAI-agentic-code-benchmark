import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";
import { captureIO } from "./helpers.js";

// ---------- §6.4 golden bytes (verbatim) ----------

const GOLDEN_EVENTS = [
  '{"timestamp":"2026-09-01T12:00:05.000Z","level":"info","service":"billing","message":"retried, then ok","durationMs":null,"source":{"file":"sample/app.csv","line":2,"format":"csv"}}',
  '{"timestamp":"2026-09-01T12:00:06.000Z","level":"error","service":"api-gateway","message":"timeout","durationMs":999,"source":{"file":"sample/app.csv","line":3,"format":"csv"}}',
  '{"timestamp":"2026-09-01T12:00:10.000Z","level":"fatal","service":"billing","message":"refund lost","durationMs":60,"source":{"file":"sample/app.csv","line":4,"format":"csv"}}',
  '{"timestamp":"2026-09-01T12:00:00.000Z","level":"info","service":"api-gateway","message":"GET /health","durationMs":120,"source":{"file":"sample/app.jsonl","line":1,"format":"jsonl"}}',
  '{"timestamp":"2026-09-01T12:00:01.250Z","level":"warn","service":"auth","message":"slow login","durationMs":null,"source":{"file":"sample/app.jsonl","line":2,"format":"jsonl"}}',
  '{"timestamp":"2026-09-01T12:00:02.000Z","level":"error","service":"billing","message":"charge failed","durationMs":480,"source":{"file":"sample/app.jsonl","line":3,"format":"jsonl"}}',
  '{"timestamp":"2026-09-01T12:00:03.000Z","level":"info","service":"api-gateway","message":"GET /users","durationMs":200,"source":{"file":"sample/app.jsonl","line":4,"format":"jsonl"}}',
  '{"timestamp":"2026-09-01T12:00:04.000Z","level":"debug","service":"api-gateway","message":"GET /health","durationMs":120,"source":{"file":"sample/app.jsonl","line":5,"format":"jsonl"}}',
  '{"timestamp":"2026-09-01T12:00:07.000Z","level":"fatal","service":"billing","message":"db conn lost","durationMs":null,"source":{"file":"sample/app.log","line":1,"format":"syslog"}}',
  '{"timestamp":"2026-09-01T12:00:08.000Z","level":"info","service":"auth","message":"token refresh","durationMs":null,"source":{"file":"sample/app.log","line":2,"format":"syslog"}}',
].join("\n") + "\n";

const GOLDEN_QUARANTINE =
  '{"raw":"{\\"ts\\":\\"2026-09-01T12:00:09Z\\",\\"level\\":\\"verbose\\",\\"svc\\":\\"auth\\",\\"msg\\":\\"meh\\"}","source":{"file":"sample/app.jsonl","line":6},"reason":"unknown level: verbose"}' +
  "\n";

const GOLDEN_TABLE = `events  10
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

const GOLDEN_JSON = `{
  "totalEvents": 10,
  "quarantined": 1,
  "deduped": 0,
  "byLevel": {
    "trace": 0,
    "debug": 1,
    "info": 4,
    "warn": 1,
    "error": 2,
    "fatal": 2
  },
  "byService": [
    {
      "service": "api-gateway",
      "count": 4
    },
    {
      "service": "billing",
      "count": 4
    },
    {
      "service": "auth",
      "count": 2
    }
  ],
  "topOffenders": [
    {
      "service": "billing",
      "errors": 3
    },
    {
      "service": "api-gateway",
      "errors": 1
    }
  ],
  "percentiles": {
    "p50": 120,
    "p95": 999
  }
}
`;

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "logsluice-cli-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("golden outputs (§6.4)", () => {
  it("renders_pinned_table_and_json_bytes (R12)", async () => {
    const table = captureIO();
    try {
      expect(await runCli(["summary", "--in", "sample/*"])).toBe(0);
      expect(table.stdout()).toBe(GOLDEN_TABLE);
      expect(table.stderr()).toBe("");
    } finally {
      table.restore();
    }
    const json = captureIO();
    try {
      expect(await runCli(["summary", "--in", "sample/*", "--json"])).toBe(0);
      expect(json.stdout()).toBe(GOLDEN_JSON);
    } finally {
      json.restore();
    }
  });

  it("normalize reproduces §6.4 event and quarantine files byte-exactly", async () => {
    await withTmp(async (dir) => {
      const out = path.join(dir, "out.jsonl");
      const io = captureIO();
      let code: number;
      try {
        code = await runCli(["normalize", "--in", "sample/*", "--out", out]);
      } finally {
        io.restore();
      }
      expect(code).toBe(0);
      expect(io.stdout()).toBe(""); // data goes to the file, not stdout
      expect(await readFile(out, "utf8")).toBe(GOLDEN_EVENTS);
      expect(await readFile(out + ".quarantine", "utf8")).toBe(GOLDEN_QUARANTINE);
    });
  });

  it("produces_byte_identical_output_for_equal_input (determinism)", async () => {
    const run = async () => {
      const io = captureIO();
      try {
        expect(await runCli(["summary", "--in", "sample/*"])).toBe(0);
        return io.stdout();
      } finally {
        io.restore();
      }
    };
    const first = await run();
    const second = await run();
    expect(second).toBe(first);
    expect(second).toBe(GOLDEN_TABLE);
  });
});

describe("stream discipline", () => {
  it("normalize --out - writes events to stdout and quarantine.jsonl into cwd", async () => {
    await withTmp(async (dir) => {
      const input = path.join(dir, "in.jsonl");
      await writeFile(
        input,
        '{"ts":"2026-09-01T12:00:00Z","level":"info","svc":"a","msg":"x"}\n' +
          '{"ts":"2026-09-01T12:00:01Z","level":"verbose","svc":"a","msg":"y"}\n',
      );
      const prevCwd = process.cwd();
      process.chdir(dir);
      try {
        const io = captureIO();
        let code: number;
        try {
          code = await runCli(["normalize", "--in", input, "--out", "-"]);
        } finally {
          io.restore();
        }
        expect(code).toBe(0);
        expect(io.stdout()).toBe(
          '{"timestamp":"2026-09-01T12:00:00.000Z","level":"info","service":"a","message":"x","durationMs":null,"source":{"file":' +
            JSON.stringify(input) +
            ',"line":1,"format":"jsonl"}}\n',
        );
        expect(io.stdout()).not.toContain("verbose");
        expect(io.stderr()).toBe("");
        const q = await readFile(path.join(dir, "quarantine.jsonl"), "utf8");
        expect(q).toContain('"reason":"unknown level: verbose"');
      } finally {
        process.chdir(prevCwd);
      }
    });
  });
});

describe("exit codes & error envelope (R11)", () => {
  const usageCases: Array<[string[]]> = [
    [[]],
    [["bogus"]],
    [["normalize"]],
    [["normalize", "--in", "sample/*", "--wat"]],
    [["normalize", "--in", "sample/*", "--format", "json"]],
    [["summary", "--in", "sample/*", "--top", "abc"]],
    [["summary", "--in", "sample/*", "--top", "101"]],
    [["summary", "--in", "sample/*", "--percentiles", "p99"]],
    [["summary", "--in", "sample/*", "--year", "1800"]],
    [["normalize", "--in", "sample/*", "--out"]],
  ];

  it.each(usageCases)("usage error for %j", async (args) => {
    const io = captureIO();
    let code: number;
    try {
      code = await runCli(args);
    } finally {
      io.restore();
    }
    expect(code).toBe(2);
    const envelope = JSON.parse(io.stderr()) as { error: { code: string; message: string } };
    expect(envelope.error.code).toBe("USAGE");
    expect(io.stdout()).toBe("");
  });

  it("prints the pinned envelope for an unknown flag", async () => {
    const io = captureIO();
    try {
      await runCli(["normalize", "--in", "sample/*", "--foo"]);
    } finally {
      io.restore();
    }
    expect(io.stderr()).toBe('{"error":{"code":"USAGE","message":"unknown flag: --foo"}}\n');
  });

  it.each([
    ["nope/*.log", "INPUT_NOT_FOUND"],
    ["zz-empty.log", "FILE_EMPTY"],
    ["zz-unknown.log", "FORMAT_UNKNOWN"],
    ["zz-bad.csv", "CSV_HEADER_INVALID"],
  ])("data error for %s → %s", async (file, code) => {
    await withTmp(async (dir) => {
      const p = path.join(dir, file);
      if (file === "zz-empty.log") await writeFile(p, "");
      if (file === "zz-unknown.log") await writeFile(p, "level=info\n");
      if (file === "zz-bad.csv") await writeFile(p, "timestamp,level,service\n2026-09-01 12:00:00,INFO,a\n");
      const io = captureIO();
      let exit: number;
      try {
        exit = await runCli(["normalize", "--in", p]);
      } finally {
        io.restore();
      }
      expect(exit).toBe(1);
      const envelope = JSON.parse(io.stderr()) as { error: { code: string; message: string } };
      expect(envelope.error.code).toBe(code);
    });
  });

  it("data errors abort before any output is written", async () => {
    await withTmp(async (dir) => {
      const out = path.join(dir, "out.jsonl");
      const bad = path.join(dir, "bad.log");
      await writeFile(bad, "not a log\n");
      const io = captureIO();
      let exit: number;
      try {
        exit = await runCli(["normalize", "--in", "sample/*", "--in", bad, "--out", out]);
      } finally {
        io.restore();
      }
      expect(exit).toBe(1);
      await expect(readFile(out, "utf8")).rejects.toThrow();
    });
  });

  it("strict_mode_exits_2_on_any_quarantine (R3)", async () => {
    await withTmp(async (dir) => {
      const out = path.join(dir, "strict.jsonl");
      const io = captureIO();
      let strict: number;
      try {
        strict = await runCli(["normalize", "--strict", "--in", "sample/*", "--out", out]);
      } finally {
        io.restore();
      }
      expect(strict).toBe(2);
      expect(await readFile(out, "utf8")).toBe(GOLDEN_EVENTS); // output still written
    });
  });
});

describe("help & version", () => {
  it("--help exits 0 and documents the full CLI surface", async () => {
    const io = captureIO();
    let code: number;
    try {
      code = await runCli(["--help"]);
    } finally {
      io.restore();
    }
    expect(code).toBe(0);
    const help = io.stdout();
    for (const needle of [
      "normalize",
      "summary",
      "--strict",
      "--year",
      "--percentiles",
      "--top",
      "--format",
      "--dedup",
      "--json",
      "--out",
      "EXIT CODES",
      "ERROR FORMAT",
      "FORMAT GRAMMARS",
      "LEVEL ALIASES",
      "TIMESTAMPS",
      "EXAMPLE",
    ]) {
      expect(help).toContain(needle);
    }
  });

  it("--version prints logsluice 1.0.0", async () => {
    const io = captureIO();
    let code: number;
    try {
      code = await runCli(["--version"]);
    } finally {
      io.restore();
    }
    expect(code).toBe(0);
    expect(io.stdout()).toBe("logsluice 1.0.0\n");
  });
});

describe("normalize --dedup and options", () => {
  it("--dedup keeps only the first occurrence while writing", async () => {
    await withTmp(async (dir) => {
      const input = path.join(dir, "dups.jsonl");
      await writeFile(
        input,
        '{"ts":"2026-09-01T12:00:00Z","level":"info","svc":"a","msg":"same","dur_ms":1}\n' +
          '{"ts":"2026-09-01T12:00:00Z","level":"info","svc":"a","msg":"same","dur_ms":2}\n',
      );
      const out = path.join(dir, "out.jsonl");
      const code = await runCli(["normalize", "--dedup", "--in", input, "--out", out]);
      expect(code).toBe(0);
      const content = await readFile(out, "utf8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('"durationMs":1');
    });
  });

  it("summary --dedup reports deduped count and post-dedup statistics", async () => {
    await withTmp(async (dir) => {
      const input = path.join(dir, "dups.jsonl");
      await writeFile(
        input,
        '{"ts":"2026-09-01T12:00:00Z","level":"error","svc":"a","msg":"same","dur_ms":10}\n' +
          '{"ts":"2026-09-01T12:00:00Z","level":"error","svc":"a","msg":"same","dur_ms":20}\n',
      );
      const io = captureIO();
      let code: number;
      try {
        code = await runCli(["summary", "--dedup", "--in", input]);
      } finally {
        io.restore();
      }
      expect(code).toBe(0);
      expect(io.stdout()).toContain("deduped  1");
      expect(io.stdout()).toContain("p50  10");
    });
  });

  it("--year is honoured by syslog parsing", async () => {
    await withTmp(async (dir) => {
      const input = path.join(dir, "app.log");
      await writeFile(input, "Sep  1 12:00:07 host billing[7]: FATAL: db conn lost\n");
      const io = captureIO();
      let code: number;
      try {
        code = await runCli(["summary", "--in", input, "--json", "--year", "2025"]);
      } finally {
        io.restore();
      }
      expect(code).toBe(0);
      const summary = JSON.parse(io.stdout()) as { byService: Array<{ service: string }> };
      expect(summary.byService).toEqual([{ service: "billing", count: 1 }]);
    });
  });
});
