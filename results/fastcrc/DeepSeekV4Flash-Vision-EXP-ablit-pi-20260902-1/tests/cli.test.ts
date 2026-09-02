import { writeFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";

function captureIO(): { stdout: () => string; stderr: () => string; restore: () => void } {
  const out: string[] = [];
  const err: string[] = [];
  const so = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk) => {
      out.push(String(chunk));
      return true;
    });
  const se = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk) => {
      err.push(String(chunk));
      return true;
    });
  return {
    stdout: () => out.join(""),
    stderr: () => err.join(""),
    restore: () => {
      so.mockRestore();
      se.mockRestore();
    },
  };
}

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "fastcrc-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("runCli", () => {
  it("renders the §6.2 golden byte-exactly (R4/R1)", async () => {
    const io = captureIO();
    let code: number;
    try {
      code = await runCli(["--in", "sample/check.txt"]);
    } finally {
      io.restore();
    }
    expect(code).toBe(0);
    expect(io.stdout()).toBe("cbf43926\n");
    expect(io.stderr()).toBe("");
  });

  it("outputs_lowercase_hex_only (R4)", async () => {
    await withTmp(async (dir) => {
      const f = path.join(dir, "x.bin");
      await writeFile(f, Buffer.from([0x00, 0xff]));
      const io = captureIO();
      let code: number;
      try {
        code = await runCli(["--in", f]);
      } finally {
        io.restore();
      }
      expect(code).toBe(0);
      expect(io.stdout()).toMatch(/^[0-9a-f]{8}\n$/);
      expect(io.stdout()).toBe("6cdbfd72\n"); // pinned value
    });
  });

  it("rejects_missing_input_file (R5)", async () => {
    const io = captureIO();
    let code: number;
    try {
      code = await runCli(["--in", "no/such/file.bin"]);
    } finally {
      io.restore();
    }
    expect(code).toBe(1);
    expect(io.stderr()).toBe('{"error":{"code":"INPUT_NOT_FOUND","message":"input not found: no/such/file.bin"}}\n');
    expect(io.stdout()).toBe("");
  });

  it.each([
    [[], "missing --in"],
    [["--in"], "missing value for --in"],
    [["--wat"], "unknown flag: --wat"],
    [["--in", "sample/check.txt", "extra"], "unknown argument: extra"],
  ])("exit_codes_usage_vs_data (R6) for %j", async (args, message) => {
    const io = captureIO();
    let code: number;
    try {
      code = await runCli(args);
    } finally {
      io.restore();
    }
    expect(code).toBe(2);
    expect(io.stderr()).toBe(`{"error":{"code":"USAGE","message":"${message}"}}\n`);
    expect(io.stdout()).toBe("");
  });

  it("help_and_version_complete (R7)", async () => {
    const help = captureIO();
    let code: number;
    try {
      code = await runCli(["--help"]);
    } finally {
      help.restore();
    }
    expect(code).toBe(0);
    for (const needle of ["--in", "EXIT CODES", "ERROR FORMAT", "ALGORITHM", "0xEDB88320", "EXAMPLE", "cbf43926"]) {
      expect(help.stdout()).toContain(needle);
    }
    expect(help.stderr()).toBe("");

    const version = captureIO();
    try {
      expect(await runCli(["--version"])).toBe(0);
    } finally {
      version.restore();
    }
    expect(version.stdout()).toBe("fastcrc 1.0.0\n");
  });

  it("produces_byte_identical_output_for_equal_input (R8)", async () => {
    const run = async () => {
      const io = captureIO();
      try {
        expect(await runCli(["--in", "sample/check.txt"])).toBe(0);
        return io.stdout();
      } finally {
        io.restore();
      }
    };
    const first = await run();
    expect(await run()).toBe(first);
    expect(first).toBe("cbf43926\n");
  });
});
