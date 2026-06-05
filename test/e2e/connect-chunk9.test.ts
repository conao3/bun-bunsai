import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  CreateQueueCommand,
  DescribeQueueCommand,
  DeleteQueueCommand,
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

test("Queue create and describe lifecycle", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-queue-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(createdInstance.Id).toBeDefined();
  expect(createdInstance.Arn).toBeDefined();
  const instanceId = createdInstance.Id ?? "";

  const createdQueue = await client.send(
    new CreateQueueCommand({
      InstanceId: instanceId,
      Name: "test-queue",
      HoursOfOperationId: "00000000-0000-0000-0000-000000000000",
    }),
  );
  expect(createdQueue.QueueId).toBeDefined();
  expect(createdQueue.QueueArn).toBeDefined();
  expect(createdQueue.QueueArn).toContain("queue");
  const queueId = createdQueue.QueueId ?? "";

  const describedQueue = await client.send(
    new DescribeQueueCommand({
      InstanceId: instanceId,
      QueueId: queueId,
    }),
  );
  expect(describedQueue.Queue).toBeDefined();
  expect(describedQueue.Queue?.QueueId).toBe(queueId);
  expect(describedQueue.Queue?.QueueArn).toBe(createdQueue.QueueArn);
  expect(describedQueue.Queue?.Name).toBe("test-queue");

  await client.send(
    new DeleteQueueCommand({
      InstanceId: instanceId,
      QueueId: queueId,
    }),
  );

  await expect(
    client.send(
      new DescribeQueueCommand({
        InstanceId: instanceId,
        QueueId: queueId,
      }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});
