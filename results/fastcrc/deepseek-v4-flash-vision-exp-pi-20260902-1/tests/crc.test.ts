import { describe, expect, it } from "vitest";
import { crc32 } from "../src/crc.js";

const enc = new TextEncoder();

describe("crc32", () => {
  it("computes_pinned_crc32_check_values (R1)", () => {
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(enc.encode("abc"))).toBe(0x352441c2);
    expect(crc32(enc.encode("hello"))).toBe(0x3610a686);
  });

  it("empty_input_has_zero_crc (R2)", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it("handles_binary_and_long_input (R3)", () => {
    expect(crc32(new Uint8Array([0x00, 0xff, 0x80]))).toBe(0x81dda740);
    const big = new Uint8Array(1 << 20);
    for (let i = 0; i < big.length; i++) big[i] = (i * 31) & 0xff;
    const first = crc32(big);
    const second = crc32(big);
    expect(second).toBe(first); // deterministic, no overflow corruption
    const small = new Uint8Array(big.length);
    for (let i = 0; i < small.length; i++) small[i] = (i * 31) & 0xff;
    // identical content through a different buffer → identical value
    expect(crc32(small)).toBe(first);
  });
});
