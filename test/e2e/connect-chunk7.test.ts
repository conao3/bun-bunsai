import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  ConnectClient,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  CreateQueueCommand,
  DeleteQueueCommand,
  CreateHoursOfOperationCommand,
} from "@aws-sdk/client-connect";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const connect = () =>
  new ConnectClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Queue create and delete lifecycle", async () => {
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

  const createdHoo = await client.send(
    new CreateHoursOfOperationCommand({
      InstanceId: instanceId,
      Name: "test-hoo",
      TimeZone: "UTC",
      Config: [],
    }),
  );
  expect(createdHoo.HoursOfOperationId).toBeDefined();
  const hooId = createdHoo.HoursOfOperationId ?? "";

  const createdQueue = await client.send(
    new CreateQueueCommand({
      InstanceId: instanceId,
      Name: "test-queue",
      HoursOfOperationId: hooId,
    }),
  );
  expect(createdQueue.QueueId).toBeDefined();
  expect(createdQueue.QueueArn).toBeDefined();
  expect(createdQueue.QueueArn).toContain("queue");
  const queueId = createdQueue.QueueId ?? "";

  await expect(
    client.send(
      new DeleteQueueCommand({ InstanceId: instanceId, QueueId: queueId }),
    ),
  ).resolves.toBeDefined();

  await expect(
    client.send(
      new DeleteQueueCommand({ InstanceId: instanceId, QueueId: queueId }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});
