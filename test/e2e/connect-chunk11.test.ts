import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  ConnectClient,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  CreateQueueCommand,
  CreateRoutingProfileCommand,
  AssociateRoutingProfileQueuesCommand,
  DisassociateRoutingProfileQueuesCommand,
} from "@aws-sdk/client-connect";

const awsPort = 4571;
const uiPort = 5671;
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

test("AssociateRoutingProfileQueues then DisassociateRoutingProfileQueues", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-rpq-${Date.now()}`,
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
      Name: "TestQueue",
      HoursOfOperationId: "00000000-0000-0000-0000-000000000000",
    }),
  );
  expect(createdQueue.QueueId).toBeDefined();
  const queueId = createdQueue.QueueId ?? "";

  const createdRp = await client.send(
    new CreateRoutingProfileCommand({
      InstanceId: instanceId,
      Name: "TestRP",
      Description: "Test routing profile",
      DefaultOutboundQueueId: queueId,
      MediaConcurrencies: [{ Channel: "VOICE", Concurrency: 1 }],
    }),
  );
  expect(createdRp.RoutingProfileId).toBeDefined();
  expect(createdRp.RoutingProfileArn).toContain(instanceId);
  const routingProfileId = createdRp.RoutingProfileId ?? "";

  await client.send(
    new AssociateRoutingProfileQueuesCommand({
      InstanceId: instanceId,
      RoutingProfileId: routingProfileId,
      QueueConfigs: [
        {
          QueueReference: { QueueId: queueId, Channel: "VOICE" },
          Priority: 1,
          Delay: 0,
        },
      ],
    }),
  );

  await client.send(
    new DisassociateRoutingProfileQueuesCommand({
      InstanceId: instanceId,
      RoutingProfileId: routingProfileId,
      QueueReferences: [{ QueueId: queueId, Channel: "VOICE" }],
    }),
  );

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});
