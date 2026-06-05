import { describe, expect, test } from "bun:test";
import {
  compareAV,
  containsAV,
  equalsAV,
  isSetType,
  isNumeric,
  matchesAttributeType,
  setDifference,
  setUnion,
  sizeOf,
  typeOfAV,
} from "../../../apps/server/src/core/expressions/attribute.ts";

describe("attribute helpers", () => {
  test("typeOfAV recognises every primitive tag", () => {
    expect(typeOfAV({ S: "x" })).toBe("S");
    expect(typeOfAV({ N: "1" })).toBe("N");
    expect(typeOfAV({ BOOL: true })).toBe("BOOL");
    expect(typeOfAV({ NULL: true })).toBe("NULL");
    expect(typeOfAV({ SS: ["a"] })).toBe("SS");
    expect(typeOfAV({ NS: ["1"] })).toBe("NS");
    expect(typeOfAV({ L: [] })).toBe("L");
    expect(typeOfAV({ M: {} })).toBe("M");
    expect(typeOfAV({})).toBeUndefined();
  });

  test("equalsAV handles sets without ordering", () => {
    expect(equalsAV({ SS: ["a", "b", "c"] }, { SS: ["c", "b", "a"] })).toBe(
      true,
    );
    expect(equalsAV({ SS: ["a"] }, { SS: ["b"] })).toBe(false);
  });

  test("equalsAV numeric ignores decimal scale", () => {
    expect(equalsAV({ N: "1.0" }, { N: "1" })).toBe(true);
  });

  test("compareAV numeric and string", () => {
    expect(compareAV({ N: "10" }, { N: "9" })).toBe(1);
    expect(compareAV({ S: "apple" }, { S: "banana" })).toBe(-1);
  });

  test("compareAV returns undefined for unordered types", () => {
    expect(compareAV({ SS: ["a"] }, { SS: ["b"] })).toBeUndefined();
    expect(compareAV({ S: "a" }, { N: "1" })).toBeUndefined();
  });

  test("sizeOf measures sets, lists, maps and codepoints", () => {
    expect(sizeOf({ S: "abc" })).toBe(3);
    expect(sizeOf({ SS: ["a", "b"] })).toBe(2);
    expect(sizeOf({ L: [{ N: "1" }] })).toBe(1);
    expect(sizeOf({ M: { x: { N: "1" } } })).toBe(1);
  });

  test("containsAV across types", () => {
    expect(containsAV({ S: "hello" }, { S: "ell" })).toBe(true);
    expect(containsAV({ SS: ["a", "b"] }, { S: "b" })).toBe(true);
    expect(containsAV({ L: [{ N: "1" }] }, { N: "1" })).toBe(true);
    expect(containsAV({ L: [{ N: "1" }] }, { N: "2" })).toBe(false);
  });

  test("setUnion deduplicates", () => {
    const out = setUnion({ SS: ["a", "b"] }, { SS: ["b", "c"] });
    expect((out["SS"] as string[]).slice().sort()).toEqual(["a", "b", "c"]);
  });

  test("setDifference returns undefined when empty", () => {
    expect(setDifference({ SS: ["a"] }, { SS: ["a"] })).toBeUndefined();
  });

  test("isSetType / isNumeric / matchesAttributeType", () => {
    expect(isSetType("SS")).toBe(true);
    expect(isSetType("S")).toBe(false);
    expect(isNumeric({ N: "1" })).toBe(true);
    expect(matchesAttributeType({ N: "1" }, "N")).toBe(true);
    expect(matchesAttributeType({ N: "1" }, "S")).toBe(false);
  });
});
