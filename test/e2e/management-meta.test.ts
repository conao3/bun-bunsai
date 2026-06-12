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
