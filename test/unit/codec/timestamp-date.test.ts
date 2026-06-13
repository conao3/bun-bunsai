import { expect, test } from "bun:test";
import {
  toEpochSeconds,
  epochSecondsToTimestamp,
} from "../../../apps/server/src/core/codec/common.ts";

test("toEpochSeconds converts Date to seconds (not ms)", () => {
  const date = new Date("2026-06-14T00:00:00Z");
  const expected = date.getTime() / 1000;
  expect(toEpochSeconds(date)).toBe(expected);
});

test("toEpochSeconds passes through numeric seconds", () => {
  expect(toEpochSeconds(1750000000)).toBe(1750000000);
});

test("epochSecondsToTimestamp serializes a Date input via seconds path", () => {
  const date = new Date("2026-06-14T01:23:45Z");
  expect(epochSecondsToTimestamp(date, "iso8601")).toBe("2026-06-14T01:23:45Z");
});

test("epochSecondsToTimestamp produces a believable ISO8601 year for Date", () => {
  const iso = epochSecondsToTimestamp(new Date(), "iso8601");
  const year = Number(iso.slice(0, 4));
  expect(year).toBeGreaterThanOrEqual(2020);
  expect(year).toBeLessThan(3000);
});
