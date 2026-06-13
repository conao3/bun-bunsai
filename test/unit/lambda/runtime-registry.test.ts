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
  expect(findAdapter("wasm1.0")).toBeUndefined();
  expect(findAdapter(undefined)).toBeUndefined();
});

test("findAdapter resolves each supported runtime family", () => {
  expect(findAdapter("python3.13")?.id).toBe("python");
  expect(findAdapter("ruby3.3")?.id).toBe("ruby");
  expect(findAdapter("java21")?.id).toBe("java");
  expect(findAdapter("dotnet8")?.id).toBe("dotnet");
  expect(findAdapter("provided.al2023")?.id).toBe("go-provided");
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
