import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { SQSClient, CreateQueueCommand } from "@aws-sdk/client-sqs";

const app = startApp();
const { endpoint, requestHandler } = app;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const sqs = new SQSClient({ endpoint, region, credentials, requestHandler });

test("/__bunsai/meta returns uptimeSeconds and version", async () => {
  const res = await app.uiFetch("/__bunsai/meta");
  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;
  expect(typeof body.uptimeSeconds).toBe("number");
  expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  expect(typeof body.version).toBe("string");
  expect((body.version as string).length).toBeGreaterThan(0);
});

test("/__bunsai/meta returns gatewayPort matching configured port", async () => {
  const customApp = startApp({ gatewayPort: 14566 });
  const res = await customApp.uiFetch("/__bunsai/meta");
  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;
  expect(body.gatewayPort).toBe(14566);
});

test("/__bunsai/meta returns default gatewayPort when not specified", async () => {
  const res = await app.uiFetch("/__bunsai/meta");
  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;
  expect(typeof body.gatewayPort).toBe("number");
  expect(body.gatewayPort).toBe(4566);
});

test("request log entries include contentType", async () => {
  await sqs.send(new CreateQueueCommand({ QueueName: "meta-test-queue" }));
  const res = await app.uiFetch("/__bunsai/logs");
  expect(res.status).toBe(200);
  const entries = (await res.json()) as Array<Record<string, unknown>>;
  const entry = entries.find((e) => e.service === "sqs");
  expect(entry).toBeDefined();
  expect(typeof entry?.contentType).toBe("string");
  expect((entry?.contentType as string).length).toBeGreaterThan(0);
});
