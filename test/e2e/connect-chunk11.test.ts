import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
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
