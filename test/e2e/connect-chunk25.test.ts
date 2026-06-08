import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  CreatePromptCommand,
  CreateQueueCommand,
  DescribePromptCommand,
  DescribeQueueCommand,
  UpdatePromptCommand,
  UpdateQueueNameCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new ConnectClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

test("chunk25: UpdateQueueName reflects in DescribeQueue; UpdatePrompt reflects in DescribePrompt", async () => {
  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk25-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: true,
    }),
  );
  const instanceId = inst.Id ?? "";
  expect(instanceId).toBeTruthy();

  const queueRes = await client.send(
    new CreateQueueCommand({
      InstanceId: instanceId,
      Name: "original-queue-name",
      HoursOfOperationId: "default-hours",
    }),
  );
  const queueId = queueRes.QueueId ?? "";
  expect(queueId).toBeTruthy();

  const queueBefore = await client.send(
    new DescribeQueueCommand({ InstanceId: instanceId, QueueId: queueId }),
  );
  expect(queueBefore.Queue?.Name).toBe("original-queue-name");

  await client.send(
    new UpdateQueueNameCommand({
      InstanceId: instanceId,
      QueueId: queueId,
      Name: "updated-queue-name",
    }),
  );

  const queueAfter = await client.send(
    new DescribeQueueCommand({ InstanceId: instanceId, QueueId: queueId }),
  );
  expect(queueAfter.Queue?.Name).toBe("updated-queue-name");
  expect(queueAfter.Queue?.QueueId).toBe(queueId);

  const promptRes = await client.send(
    new CreatePromptCommand({
      InstanceId: instanceId,
      Name: "original-prompt-name",
      S3Uri: "s3://bucket/key.wav",
    }),
  );
  const promptId = promptRes.PromptId ?? "";
  expect(promptId).toBeTruthy();

  const promptBefore = await client.send(
    new DescribePromptCommand({ InstanceId: instanceId, PromptId: promptId }),
  );
  expect(promptBefore.Prompt?.Name).toBe("original-prompt-name");

  const updateRes = await client.send(
    new UpdatePromptCommand({
      InstanceId: instanceId,
      PromptId: promptId,
      Name: "updated-prompt-name",
    }),
  );
  expect(updateRes.PromptId).toBe(promptId);
  expect(updateRes.PromptARN).toBeTruthy();

  const promptAfter = await client.send(
    new DescribePromptCommand({ InstanceId: instanceId, PromptId: promptId }),
  );
  expect(promptAfter.Prompt?.Name).toBe("updated-prompt-name");
  expect(promptAfter.Prompt?.PromptId).toBe(promptId);
});
