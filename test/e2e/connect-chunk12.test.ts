import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  GetCurrentMetricDataCommand,
  GetMetricDataV2Command,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const connect = () =>
  new ConnectClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("GetCurrentMetricData returns empty metric results", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-cmd-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(createdInstance.Id).toBeDefined();
  expect(createdInstance.Arn).toBeDefined();
  const instanceId = createdInstance.Id ?? "";

  const result = await client.send(
    new GetCurrentMetricDataCommand({
      InstanceId: instanceId,
      Filters: { Channels: ["VOICE"] },
      CurrentMetrics: [{ Name: "AGENTS_ONLINE", Unit: "COUNT" }],
    }),
  );
  expect(result.MetricResults).toBeDefined();
  expect(Array.isArray(result.MetricResults)).toBe(true);
  expect(result.MetricResults?.length).toBe(0);
  expect(result.ApproximateTotalCount).toBe(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("GetMetricDataV2 returns empty metric results", async () => {
  const client = connect();

  const now = new Date();
  const start = new Date(now.getTime() - 60 * 60 * 1000);

  const result = await client.send(
    new GetMetricDataV2Command({
      ResourceArn: "arn:aws:connect:us-east-1:123456789012:instance/test",
      StartTime: start,
      EndTime: now,
      Filters: [{ FilterKey: "QUEUE", FilterValues: ["test-queue"] }],
      Metrics: [{ Name: "CONTACTS_QUEUED" }],
    }),
  );
  expect(result.MetricResults).toBeDefined();
  expect(Array.isArray(result.MetricResults)).toBe(true);
  expect(result.MetricResults?.length).toBe(0);
});
