import { describe, expect, test } from "bun:test";
import { matchesOpFilter } from "../../../apps/dashboard/src/requestLogFilters.ts";
import {
  SIZE_WARN_THRESHOLD,
  isSizeWarn,
} from "../../../apps/dashboard/src/resourceBrowserUtils.ts";

describe("matchesOpFilter", () => {
  test("empty filter matches any operation", () => {
    expect(matchesOpFilter("ListBuckets", [])).toBe(true);
    expect(matchesOpFilter("PutObject", [])).toBe(true);
  });

  test("single-item filter matches only that operation", () => {
    expect(matchesOpFilter("ListBuckets", ["ListBuckets"])).toBe(true);
    expect(matchesOpFilter("PutObject", ["ListBuckets"])).toBe(false);
  });

  test("multi-item filter matches any of the selected operations", () => {
    const filter = ["ListBuckets", "GetObject"];
    expect(matchesOpFilter("ListBuckets", filter)).toBe(true);
    expect(matchesOpFilter("GetObject", filter)).toBe(true);
    expect(matchesOpFilter("PutObject", filter)).toBe(false);
  });

  test("exact string match required", () => {
    expect(matchesOpFilter("listbuckets", ["ListBuckets"])).toBe(false);
    expect(matchesOpFilter("ListBuckets", ["listbuckets"])).toBe(false);
  });
});

describe("isSizeWarn", () => {
  test("exactly 1 MiB triggers warn", () => {
    expect(isSizeWarn(SIZE_WARN_THRESHOLD)).toBe(true);
  });

  test("1 byte below threshold does not warn", () => {
    expect(isSizeWarn(SIZE_WARN_THRESHOLD - 1)).toBe(false);
  });

  test("above threshold triggers warn", () => {
    expect(isSizeWarn(SIZE_WARN_THRESHOLD + 1)).toBe(true);
    expect(isSizeWarn(10 * 1024 * 1024)).toBe(true);
  });

  test("zero size does not warn", () => {
    expect(isSizeWarn(0)).toBe(false);
  });
});
