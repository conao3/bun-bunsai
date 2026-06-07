import { describe, expect, test } from "bun:test";
import { parseArn, resourceName } from "../../apps/server/src/core/arn.ts";
import {
  deliverToArn,
  notifyEventSource,
  registerEventSource,
  registerTarget,
} from "../../apps/server/src/core/events.ts";
import {
  createStateStore,
  scopedStore,
} from "../../apps/server/src/core/state.ts";
import type { ServiceContext } from "../../apps/server/src/core/types.ts";

const makeCtx = (account: string, region: string): ServiceContext => {
  const store = createStateStore();
  return {
    store: scopedStore(store, { account, region, service: "caller" }),
    account,
    region,
    storeFor: (service) => scopedStore(store, { account, region, service }),
  };
};

describe("parseArn", () => {
  test("parses a full arn", () => {
    expect(parseArn("arn:aws:sqs:us-east-1:123456789012:my-queue")).toEqual({
      partition: "aws",
      service: "sqs",
      region: "us-east-1",
      account: "123456789012",
      resource: "my-queue",
    });
  });

  test("keeps colons in the resource segment", () => {
    const parsed = parseArn(
      "arn:aws:lambda:us-east-1:123456789012:function:my-fn",
    );
    expect(parsed?.service).toBe("lambda");
    expect(parsed?.resource).toBe("function:my-fn");
  });

  test("rejects non-arn strings", () => {
    expect(parseArn("not-an-arn")).toBeUndefined();
    expect(parseArn("arn:aws:sqs")).toBeUndefined();
  });
});

describe("resourceName", () => {
  test("extracts queue and function names", () => {
    expect(resourceName("my-queue")).toBe("my-queue");
    expect(resourceName("function:my-fn")).toBe("my-fn");
    expect(resourceName("rule/default/my-rule")).toBe("my-rule");
  });
});

describe("event delivery registry", () => {
  test("routes a delivery to the registered target with a scoped store", async () => {
    const seen: { resource: string; body: string; account: string }[] = [];
    registerTarget("probe-target", (store, resource, delivery) => {
      store.set(resource, delivery.body);
      seen.push({
        resource,
        body: delivery.body,
        account: store.scope.account,
      });
    });
    const ctx = makeCtx("111122223333", "us-west-2");
    const delivered = await deliverToArn(
      ctx,
      "arn:aws:probe-target:us-west-2:111122223333:thing",
      { body: "hello", event: { hello: true } },
    );
    expect(delivered).toBe(true);
    expect(seen).toEqual([
      { resource: "thing", body: "hello", account: "111122223333" },
    ]);
    expect(ctx.storeFor("probe-target").get<string>("thing")).toBe("hello");
  });

  test("returns false for unknown services or bad arns", async () => {
    const ctx = makeCtx("111122223333", "us-west-2");
    expect(await deliverToArn(ctx, "bad", { body: "", event: null })).toBe(
      false,
    );
    expect(
      await deliverToArn(ctx, "arn:aws:unregistered:r:a:x", {
        body: "",
        event: null,
      }),
    ).toBe(false);
  });

  test("notifies event source consumers and reports consumption", async () => {
    registerEventSource((_ctx, sourceArn) =>
      sourceArn.includes("probe-source"),
    );
    const ctx = makeCtx("111122223333", "us-west-2");
    expect(
      await notifyEventSource(ctx, "arn:aws:probe-source:r:a:thing", [
        { id: 1 },
      ]),
    ).toBe(true);
    expect(await notifyEventSource(ctx, "arn:aws:other:r:a:thing", [])).toBe(
      false,
    );
  });
});
