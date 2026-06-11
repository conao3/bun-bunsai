import { describe, expect, test } from "bun:test";
import { services } from "../../../apps/server/src/services/index.ts";
import { serviceMeta } from "../../../apps/dashboard/src/shared.tsx";

describe("serviceMeta coverage", () => {
  const uniqueNames = [...new Set(services.map((s) => s.name))];

  test("all service names have a serviceMeta entry", () => {
    const missing = uniqueNames.filter((name) => !(name in serviceMeta));
    expect(missing).toEqual([]);
  });
});
