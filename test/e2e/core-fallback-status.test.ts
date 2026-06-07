import { expect, test } from "bun:test";
import { dispatch } from "../../apps/server/src/core/framework.ts";
import { createStateStore } from "../../apps/server/src/core/state.ts";
import type {
  ParsedRequest,
  ServiceDefinition,
} from "../../apps/server/src/core/types.ts";

const fallbackService: ServiceDefinition = {
  name: "test-fallback",
  protocol: "rest-json",
  operations: {
    Ping: () => ({
      $status: 206,
      $headers: { "content-type": "application/json" },
      data: "pong",
    }),
    PingStatus: () => ({
      $status: 202,
      message: "accepted",
    }),
  },
};

const makeReq = (target: string): ParsedRequest => {
  const url = new URL("http://localhost/");
  return {
    method: "GET",
    url,
    path: "/",
    query: url.searchParams,
    headers: new Headers(),
    bodyBytes: new Uint8Array(),
    bodyText: "",
    service: "test-fallback",
    region: "us-east-1",
    account: "123456789012",
    protocol: "rest-json",
    target,
  };
};

test("fallback op preserves $status in response", async () => {
  const result = await dispatch(
    fallbackService,
    makeReq("test-fallback.Ping"),
    createStateStore(),
  );
  expect(result.statusCode).toBe(206);
});

test("fallback op preserves $headers content-type", async () => {
  const result = await dispatch(
    fallbackService,
    makeReq("test-fallback.Ping"),
    createStateStore(),
  );
  expect(result.contentType).toBe("application/json");
});

test("fallback op strips $status and $headers from body", async () => {
  const result = await dispatch(
    fallbackService,
    makeReq("test-fallback.Ping"),
    createStateStore(),
  );
  const body = JSON.parse(result.body as string);
  expect(body).not.toHaveProperty("$status");
  expect(body).not.toHaveProperty("$headers");
  expect(body.data).toBe("pong");
});

test("fallback op $status without $headers preserves status", async () => {
  const result = await dispatch(
    fallbackService,
    makeReq("test-fallback.PingStatus"),
    createStateStore(),
  );
  expect(result.statusCode).toBe(202);
});
