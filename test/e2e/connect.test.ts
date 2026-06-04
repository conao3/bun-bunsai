import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  ConnectClient,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  DescribeInstanceCommand,
  ListInstancesCommand,
  ClaimPhoneNumberCommand,
  AssociatePhoneNumberContactFlowCommand,
  BatchAssociateAnalyticsDataSetCommand,
  BatchDisassociateAnalyticsDataSetCommand,
  CreateAgentStatusCommand,
  CreateContactFlowCommand,
  CreateQueueCommand,
  CreateHoursOfOperationCommand,
  CreateRoutingProfileCommand,
  CreateSecurityProfileCommand,
} from "@aws-sdk/client-connect";

const awsPort = 4566;
const uiPort = 5666;
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

test("Connect instance roundtrip", async () => {
  const client = connect();
  const alias = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: alias,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(created.Id).toBeDefined();
  expect(created.Arn).toBeDefined();
  const instanceId = created.Id ?? "";

  const described = await client.send(
    new DescribeInstanceCommand({ InstanceId: instanceId }),
  );
  expect(described.Instance?.Id).toBe(instanceId);
  expect(described.Instance?.IdentityManagementType).toBe("CONNECT_MANAGED");
  expect(described.Instance?.InstanceAlias).toBe(alias);
  expect(described.Instance?.InboundCallsEnabled).toBe(true);
  expect(described.Instance?.OutboundCallsEnabled).toBe(false);

  const listed = await client.send(new ListInstancesCommand({}));
  expect((listed.InstanceSummaryList ?? []).map((i) => i.Id)).toContain(
    instanceId,
  );

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
  await expect(
    client.send(new DescribeInstanceCommand({ InstanceId: instanceId })),
  ).rejects.toThrow();
});

test("ClaimPhoneNumber and AssociatePhoneNumberContactFlow", async () => {
  const client = connect();

  const instanceAlias = `bunsai-e2e-phone-${Date.now()}`;
  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: instanceAlias,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: true,
    }),
  );
  const instanceId = createdInstance.Id ?? "";

  const claimed = await client.send(
    new ClaimPhoneNumberCommand({
      PhoneNumber: "+12065551234",
      InstanceId: instanceId,
    }),
  );
  expect(claimed.PhoneNumberId).toBeDefined();
  expect(claimed.PhoneNumberArn).toBeDefined();
  expect(claimed.PhoneNumberArn).toContain("phone-number");

  const phoneNumberId = claimed.PhoneNumberId ?? "";
  const fakeContactFlowId = crypto.randomUUID();

  await expect(
    client.send(
      new AssociatePhoneNumberContactFlowCommand({
        PhoneNumberId: phoneNumberId,
        InstanceId: instanceId,
        ContactFlowId: fakeContactFlowId,
      }),
    ),
  ).resolves.toBeDefined();

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("BatchAssociateAnalyticsDataSet and BatchDisassociateAnalyticsDataSet", async () => {
  const client = connect();

  const instanceAlias = `bunsai-e2e-analytics-${Date.now()}`;
  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: instanceAlias,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = createdInstance.Id ?? "";

  const dataSetIds = [crypto.randomUUID(), crypto.randomUUID()];

  const associated = await client.send(
    new BatchAssociateAnalyticsDataSetCommand({
      InstanceId: instanceId,
      DataSetIds: dataSetIds,
    }),
  );
  expect(associated.Created).toHaveLength(2);
  expect(associated.Created?.map((c) => c.DataSetId)).toContain(dataSetIds[0]);
  expect(associated.Errors).toHaveLength(0);

  const disassociated = await client.send(
    new BatchDisassociateAnalyticsDataSetCommand({
      InstanceId: instanceId,
      DataSetIds: dataSetIds,
    }),
  );
  expect(disassociated.Deleted).toContain(dataSetIds[0]);
  expect(disassociated.Deleted).toContain(dataSetIds[1]);
  expect(disassociated.Errors).toHaveLength(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("CreateAgentStatus", async () => {
  const client = connect();

  const instanceAlias = `bunsai-e2e-agentstatus-${Date.now()}`;
  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: instanceAlias,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = createdInstance.Id ?? "";

  const created = await client.send(
    new CreateAgentStatusCommand({
      InstanceId: instanceId,
      Name: "On Break",
      State: "ENABLED",
    }),
  );
  expect(created.AgentStatusId).toBeDefined();
  expect(created.AgentStatusARN).toBeDefined();
  expect(created.AgentStatusARN).toContain(instanceId);
  expect(created.AgentStatusARN).toContain("agent-state");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("CreateContactFlow", async () => {
  const client = connect();

  const instance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-cf-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = instance.Id ?? "";

  const created = await client.send(
    new CreateContactFlowCommand({
      InstanceId: instanceId,
      Name: "TestFlow",
      Type: "CONTACT_FLOW",
      Content: '{"Version":"2019-10-30","StartAction":"id1","Actions":[]}',
    }),
  );
  expect(created.ContactFlowId).toBeDefined();
  expect(created.ContactFlowArn).toContain(instanceId);
  expect(created.ContactFlowArn).toContain("contact-flow");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("CreateQueue and CreateHoursOfOperation", async () => {
  const client = connect();

  const instance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-q-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = instance.Id ?? "";

  const hoo = await client.send(
    new CreateHoursOfOperationCommand({
      InstanceId: instanceId,
      Name: "24x7",
      TimeZone: "UTC",
      Config: [],
    }),
  );
  expect(hoo.HoursOfOperationId).toBeDefined();
  expect(hoo.HoursOfOperationArn).toContain(instanceId);

  const queue = await client.send(
    new CreateQueueCommand({
      InstanceId: instanceId,
      Name: "SupportQueue",
      HoursOfOperationId: hoo.HoursOfOperationId ?? "",
    }),
  );
  expect(queue.QueueId).toBeDefined();
  expect(queue.QueueArn).toContain(instanceId);
  expect(queue.QueueArn).toContain("queue");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("CreateRoutingProfile and CreateSecurityProfile", async () => {
  const client = connect();

  const instance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-rp-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = instance.Id ?? "";

  const queue = await client.send(
    new CreateQueueCommand({
      InstanceId: instanceId,
      Name: "DefaultQueue",
      HoursOfOperationId: "00000000-0000-0000-0000-000000000000",
    }),
  );
  const queueId = queue.QueueId ?? "";

  const rp = await client.send(
    new CreateRoutingProfileCommand({
      InstanceId: instanceId,
      Name: "DefaultRP",
      Description: "Default routing profile",
      DefaultOutboundQueueId: queueId,
      MediaConcurrencies: [{ Channel: "VOICE", Concurrency: 1 }],
    }),
  );
  expect(rp.RoutingProfileId).toBeDefined();
  expect(rp.RoutingProfileArn).toContain(instanceId);
  expect(rp.RoutingProfileArn).toContain("routing-profile");

  const sp = await client.send(
    new CreateSecurityProfileCommand({
      InstanceId: instanceId,
      SecurityProfileName: "ReadOnly",
    }),
  );
  expect(sp.SecurityProfileId).toBeDefined();
  expect(sp.SecurityProfileArn).toContain(instanceId);
  expect(sp.SecurityProfileArn).toContain("security-profile");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});
