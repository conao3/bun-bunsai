import { describe, expect, test } from "bun:test";
import {
  snapshotCountText,
  tabs,
} from "../../../apps/dashboard/src/Settings.tsx";

describe("tabs", () => {
  test("tab count is 4", () => {
    expect(tabs).toHaveLength(4);
  });

  test("tab order is General / Services / Scope / Persistence", () => {
    expect(tabs.map((t) => t.id)).toEqual([
      "general",
      "services",
      "scope",
      "persistence",
    ]);
  });

  test("all tabs have labels", () => {
    for (const t of tabs) {
      expect(t.label.length).toBeGreaterThan(0);
    }
  });

  test("persistence tab is last", () => {
    expect(tabs[tabs.length - 1].id).toBe("persistence");
  });
});

describe("snapshotCountText", () => {
  test("zero snapshots → empty message", () => {
    expect(snapshotCountText(0)).toBe("保存済みスナップショットはありません");
  });

  test("one snapshot → count message", () => {
    expect(snapshotCountText(1)).toBe("1 件のスナップショット");
  });

  test("multiple snapshots → count message", () => {
    expect(snapshotCountText(5)).toBe("5 件のスナップショット");
  });
});
