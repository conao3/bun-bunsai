import { describe, expect, test } from "bun:test";
import { decideAutoSelect } from "../../../apps/dashboard/src/autoSelect.ts";

type RE = {
  account: string;
  region: string;
  service: string;
  key: string;
  value: unknown;
};

const r = (service: string, key: string): RE => ({
  account: "000000000000",
  region: "us-east-1",
  service,
  key,
  value: null,
});

describe("decideAutoSelect", () => {
  test("no selection + resources → returns first", () => {
    expect(
      decideAutoSelect(null, [r("s3", "bucket"), r("sqs", "queue")], null),
    ).toEqual({ service: "s3", key: "bucket" });
  });

  test("valid selection → null (keep current)", () => {
    expect(
      decideAutoSelect(
        { service: "s3", key: "bucket" },
        [r("s3", "bucket")],
        null,
      ),
    ).toBeNull();
  });

  test("selection + transient empty → null (deep link protection)", () => {
    expect(
      decideAutoSelect({ service: "s3", key: "bucket" }, [], null),
    ).toBeNull();
  });

  test("no selection + empty → null", () => {
    expect(decideAutoSelect(null, [], null)).toBeNull();
  });

  test("svcHint + matching resource → returns first in service", () => {
    expect(
      decideAutoSelect(null, [r("s3", "bucket"), r("sqs", "queue")], "sqs"),
    ).toEqual({ service: "sqs", key: "queue" });
  });

  test("svcHint + no matching resource → falls back to first", () => {
    expect(decideAutoSelect(null, [r("s3", "bucket")], "sqs")).toEqual({
      service: "s3",
      key: "bucket",
    });
  });

  test("svcHint + empty scoped → null", () => {
    expect(decideAutoSelect(null, [], "sqs")).toBeNull();
  });

  test("stale selection not in scoped + scoped has resources → returns first", () => {
    expect(
      decideAutoSelect({ service: "s3", key: "old" }, [r("s3", "new")], null),
    ).toEqual({ service: "s3", key: "new" });
  });
});
