import { describe, expect, test } from "bun:test";
import {
  addN,
  compareN,
  formatN,
  parseN,
  subN,
} from "../../../apps/server/src/core/expressions/decimal.ts";

describe("decimal.parseN / formatN", () => {
  test("normalizes integer", () => {
    expect(parseN("123")).toBe("123");
    expect(parseN("+007")).toBe("7");
    expect(parseN("-0")).toBe("0");
  });

  test("preserves fractional digits with trailing zero trimming", () => {
    expect(parseN("1.230")).toBe("1.23");
    expect(parseN(".5")).toBe("0.5");
    expect(parseN("-0.10")).toBe("-0.1");
  });

  test("handles scientific notation", () => {
    expect(parseN("1e3")).toBe("1000");
    expect(parseN("1.5e2")).toBe("150");
    expect(parseN("1.5e-2")).toBe("0.015");
  });

  test("formatN is identical to parseN", () => {
    expect(formatN("3.14")).toBe("3.14");
  });

  test("rejects non-numeric", () => {
    expect(() => parseN("abc")).toThrow(/ValidationException|numeric/);
    expect(() => parseN("")).toThrow(/ValidationException|numeric/);
    expect(() => parseN("1.2.3")).toThrow(/ValidationException|numeric/);
  });

  test("rejects more than 38 significant digits", () => {
    const big = "1" + "0".repeat(38);
    expect(() => parseN(big)).toThrow(/38 significant digits/);
  });

  test("accepts 38-digit boundary", () => {
    const ok = "1" + "0".repeat(37);
    expect(parseN(ok)).toBe(ok);
  });
});

describe("decimal.addN / subN", () => {
  test("integer addition", () => {
    expect(addN("1", "2")).toBe("3");
    expect(addN("100", "200")).toBe("300");
  });

  test("fractional addition without binary float drift", () => {
    expect(addN("0.1", "0.2")).toBe("0.3");
  });

  test("scale alignment", () => {
    expect(addN("1.5", "0.25")).toBe("1.75");
    expect(addN("1.0", "2")).toBe("3");
  });

  test("integer subtraction", () => {
    expect(subN("10", "3")).toBe("7");
    expect(subN("3", "10")).toBe("-7");
  });

  test("fractional subtraction", () => {
    expect(subN("1.0", "0.1")).toBe("0.9");
  });

  test("addition of negative numbers", () => {
    expect(addN("-5", "3")).toBe("-2");
    expect(addN("-5", "-3")).toBe("-8");
  });

  test("crosses zero", () => {
    expect(addN("-1", "1")).toBe("0");
    expect(subN("0", "0")).toBe("0");
  });
});

describe("decimal.compareN", () => {
  test("avoids lexicographic '10' < '9' trap", () => {
    expect(compareN("10", "9")).toBe(1);
    expect(compareN("9", "10")).toBe(-1);
  });

  test("equal values", () => {
    expect(compareN("1.0", "1")).toBe(0);
    expect(compareN("-0", "0")).toBe(0);
  });

  test("signed comparison", () => {
    expect(compareN("-5", "5")).toBe(-1);
    expect(compareN("5", "-5")).toBe(1);
    expect(compareN("-5", "-10")).toBe(1);
  });

  test("fractional comparison", () => {
    expect(compareN("0.1", "0.10")).toBe(0);
    expect(compareN("0.10", "0.2")).toBe(-1);
  });
});
