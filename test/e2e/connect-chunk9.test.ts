import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  ConnectClient,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  CreateQueueCommand,
  DescribeQueueCommand,
  DeleteQueueCommand,
} from "@aws-sdk/client-connect";

const awsPort = 4569;
const uiPort = 5669;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const connect = () =>
  new ConnectClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
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
