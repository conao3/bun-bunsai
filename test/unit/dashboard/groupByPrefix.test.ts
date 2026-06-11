import { describe, expect, test } from "bun:test";
import {
  getKeyPrefix,
  groupResourcesByPrefix,
} from "../../../apps/dashboard/src/groupByPrefix.ts";

type RE = { key: string; value: unknown };
const r = (key: string): RE => ({ key, value: null });

describe("getKeyPrefix", () => {
  test("slash separator → segment before first slash", () => {
    expect(getKeyPrefix("endpoint/abc")).toBe("endpoint");
  });

  test("colon separator → segment before first colon", () => {
    expect(getKeyPrefix("stream:ds1")).toBe("stream");
  });

  test("no separator → empty string", () => {
    expect(getKeyPrefix("my-bucket")).toBe("");
  });

  test("slash before colon → slash wins", () => {
    expect(getKeyPrefix("a/b:c")).toBe("a");
  });

  test("colon before slash → colon wins", () => {
    expect(getKeyPrefix("a:b/c")).toBe("a");
  });
});

describe("groupResourcesByPrefix", () => {
  test("multiple slash prefixes → split into groups", () => {
    const items = [
      r("endpoint/ep1"),
      r("endpoint/ep2"),
      r("creator/endpoint/ep3"),
    ];
    const groups = groupResourcesByPrefix(items, "Rules");
    expect(groups).toHaveLength(2);
    const prefixes = groups.map((g) => g.prefix);
    expect(prefixes).toContain("endpoint");
    expect(prefixes).toContain("creator");
  });

  test("no separator keys → default label group", () => {
    const items = [r("my-bucket"), r("other-bucket")];
    const groups = groupResourcesByPrefix(items, "Buckets");
    expect(groups).toHaveLength(1);
    expect(groups[0].prefix).toBe("");
    expect(groups[0].label).toBe("Buckets");
    expect(groups[0].items).toHaveLength(2);
  });

  test("colon separator (kinesis stream:ds1)", () => {
    const items = [r("stream:ds1"), r("stream:ds2"), r("consumer:c1")];
    const groups = groupResourcesByPrefix(items, "Streams");
    expect(groups).toHaveLength(2);
    const prefixes = groups.map((g) => g.prefix);
    expect(prefixes).toContain("stream");
    expect(prefixes).toContain("consumer");
  });

  test("single prefix → one group, same behavior as before", () => {
    const items = [r("function/fn1"), r("function/fn2")];
    const groups = groupResourcesByPrefix(items, "Functions");
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });

  test("prefix label is capitalized", () => {
    const items = [r("endpoint/ep1"), r("creator/ep2")];
    const groups = groupResourcesByPrefix(items, "Rules");
    const endpointGroup = groups.find((g) => g.prefix === "endpoint");
    expect(endpointGroup?.label).toBe("Endpoint");
    const creatorGroup = groups.find((g) => g.prefix === "creator");
    expect(creatorGroup?.label).toBe("Creator");
  });

  test("empty items → empty groups", () => {
    expect(groupResourcesByPrefix([], "Buckets")).toEqual([]);
  });

  test("items order preserved within group", () => {
    const items = [r("endpoint/ep1"), r("endpoint/ep2"), r("endpoint/ep3")];
    const groups = groupResourcesByPrefix(items, "Rules");
    expect(groups[0].items.map((i) => i.key)).toEqual([
      "endpoint/ep1",
      "endpoint/ep2",
      "endpoint/ep3",
    ]);
  });
});
