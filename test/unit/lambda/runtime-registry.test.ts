import { expect, test } from "bun:test";
import {
  findAdapter,
  listAdapters,
  probeAdapter,
} from "../../../apps/server/src/services/lambda/runtime/registry.ts";

test("listAdapters exposes at least one adapter", () => {
  const all = listAdapters();
  expect(all.length).toBeGreaterThanOrEqual(1);
});

test("findAdapter resolves nodejs* to the node-via-bun adapter", () => {
  expect(findAdapter("nodejs20.x")?.id).toBe("nodejs");
  expect(findAdapter("nodejs22.x")?.id).toBe("nodejs");
  expect(findAdapter("nodejs18.x")?.id).toBe("nodejs");
});

test("findAdapter returns undefined for an unknown runtime", () => {
  expect(findAdapter("python3.13")).toBeUndefined();
  expect(findAdapter(undefined)).toBeUndefined();
});

test("probeAdapter reports node-via-bun as ready (bun is in-process)", async () => {
  const node = findAdapter("nodejs20.x");
  if (node === undefined) throw new Error("node adapter missing");
  const probe = await probeAdapter(node);
  expect(probe.ok).toBe(true);
  if (probe.ok) {
    expect(probe.interpreterPath).toBe("bun");
    expect(probe.version.length).toBeGreaterThan(0);
  }
});
