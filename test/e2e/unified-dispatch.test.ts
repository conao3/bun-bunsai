import { expect, test } from "bun:test";
import { createBunsaiApp } from "../../apps/server/src/server.ts";

const app = createBunsaiApp();
const origin = "http://bunsai.test";

test("management path is dispatched to management API", async () => {
  const res = await app.unifiedFetch(
    new Request(`${origin}/__bunsai/services`),
  );
  expect(res).toBeDefined();
  expect(res!.status).toBe(200);
});

test("AWS request with SigV4 Authorization is dispatched to gateway", async () => {
  const res = await app.unifiedFetch(
    new Request(`${origin}/`, {
      method: "POST",
      headers: {
        authorization:
          "AWS4-HMAC-SHA256 Credential=test/20260613/us-east-1/sts/aws4_request, SignedHeaders=host;x-amz-date, Signature=deadbeef",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "Action=GetCallerIdentity&Version=2011-06-15",
    }),
  );
  expect(res).toBeDefined();
  expect(res!.status).toBe(200);
  const text = await res!.text();
  expect(text).toContain("<GetCallerIdentityResult>");
});

test("AWS request via X-Amz-Target header is dispatched to gateway", async () => {
  const res = await app.unifiedFetch(
    new Request(`${origin}/`, {
      method: "POST",
      headers: {
        "x-amz-target": "AmazonSQS.CreateQueue",
        "content-type": "application/x-amz-json-1.0",
        authorization:
          "AWS4-HMAC-SHA256 Credential=test/20260613/us-east-1/sqs/aws4_request, SignedHeaders=host, Signature=cafe",
      },
      body: JSON.stringify({ QueueName: "unified-test" }),
    }),
  );
  expect(res).toBeDefined();
  expect(res!.status).toBe(200);
});

test("browser-style GET without AWS markers redirects to /__dashboard/", async () => {
  const res = await app.unifiedFetch(
    new Request(`${origin}/`, {
      method: "GET",
      headers: { accept: "text/html" },
    }),
  );
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe(`${origin}/__dashboard/`);
});

test("non-AWS path without AWS markers redirects to /__dashboard/", async () => {
  const res = await app.unifiedFetch(
    new Request(`${origin}/some/other/path`, { method: "GET" }),
  );
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe(`${origin}/__dashboard/`);
});
