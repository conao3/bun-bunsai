import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  ConnectClient,
  CreateAgentStatusCommand,
  CreateInstanceCommand,
  CreatePromptCommand,
  CreateTrafficDistributionGroupCommand,
  DeleteInstanceCommand,
  GetTrafficDistributionCommand,
  ImportPhoneNumberCommand,
  ListAgentStatusesCommand,
  ListAnalyticsDataAssociationsCommand,
  ListAnalyticsDataLakeDataSetsCommand,
  ListApprovedOriginsCommand,
  ListAssociatedContactsCommand,
  ListAttachedFilesConfigurationsCommand,
} from "@aws-sdk/client-connect";

const awsPort = 4573;
const uiPort = 5673;
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

test("ListAgentStatuses returns created statuses", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-las-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(createdInstance.Id).toBeDefined();
  const instanceId = createdInstance.Id ?? "";

  const createdStatus = await client.send(
    new CreateAgentStatusCommand({
      InstanceId: instanceId,
      Name: "test-status",
      State: "ENABLED",
    }),
  );
  expect(createdStatus.AgentStatusId).toBeDefined();
  expect(createdStatus.AgentStatusARN).toBeDefined();

  const listed = await client.send(
    new ListAgentStatusesCommand({ InstanceId: instanceId }),
  );
  expect(listed.AgentStatusSummaryList).toBeDefined();
  expect(Array.isArray(listed.AgentStatusSummaryList)).toBe(true);
  expect(listed.AgentStatusSummaryList?.length).toBeGreaterThanOrEqual(1);

  const found = listed.AgentStatusSummaryList?.find(
    (s) => s.Id === createdStatus.AgentStatusId,
  );
  expect(found).toBeDefined();
  expect(found?.Name).toBe("test-status");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("ImportPhoneNumber creates a phone number", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-ipn-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(createdInstance.Id).toBeDefined();
  const instanceId = createdInstance.Id ?? "";

  const imported = await client.send(
    new ImportPhoneNumberCommand({
      InstanceId: instanceId,
      SourcePhoneNumberArn:
        "arn:aws:connect:us-east-1:123456789012:phone-number/source-num",
    }),
  );
  expect(imported.PhoneNumberId).toBeDefined();
  expect(imported.PhoneNumberArn).toBeDefined();
  expect(imported.PhoneNumberArn).toContain("phone-number");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("ListAnalyticsDataAssociations returns empty results", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-lada-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(createdInstance.Id).toBeDefined();
  const instanceId = createdInstance.Id ?? "";

  const result = await client.send(
    new ListAnalyticsDataAssociationsCommand({ InstanceId: instanceId }),
  );
  expect(result.Results).toBeDefined();
  expect(Array.isArray(result.Results)).toBe(true);
  expect(result.Results?.length).toBe(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("ListAnalyticsDataLakeDataSets returns empty results", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-lalds-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(createdInstance.Id).toBeDefined();
  const instanceId = createdInstance.Id ?? "";

  const result = await client.send(
    new ListAnalyticsDataLakeDataSetsCommand({ InstanceId: instanceId }),
  );
  expect(result.Results).toBeDefined();
  expect(Array.isArray(result.Results)).toBe(true);
  expect(result.Results?.length).toBe(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("ListApprovedOrigins returns empty list", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-lao-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(createdInstance.Id).toBeDefined();
  const instanceId = createdInstance.Id ?? "";

  const result = await client.send(
    new ListApprovedOriginsCommand({ InstanceId: instanceId }),
  );
  expect(result.Origins).toBeDefined();
  expect(Array.isArray(result.Origins)).toBe(true);
  expect(result.Origins?.length).toBe(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("ListAssociatedContacts returns empty list", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-lac-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(createdInstance.Id).toBeDefined();
  const instanceId = createdInstance.Id ?? "";

  const result = await client.send(
    new ListAssociatedContactsCommand({
      InstanceId: instanceId,
      ContactId: "test-contact-id",
    }),
  );
  expect(result.ContactSummaryList).toBeDefined();
  expect(Array.isArray(result.ContactSummaryList)).toBe(true);
  expect(result.ContactSummaryList?.length).toBe(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("ListAttachedFilesConfigurations returns empty list", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-lafc-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(createdInstance.Id).toBeDefined();
  const instanceId = createdInstance.Id ?? "";

  const result = await client.send(
    new ListAttachedFilesConfigurationsCommand({ InstanceId: instanceId }),
  );
  expect(result.AttachedFilesConfigurations).toBeDefined();
  expect(Array.isArray(result.AttachedFilesConfigurations)).toBe(true);
  expect(result.AttachedFilesConfigurations?.length).toBe(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("CreateTrafficDistributionGroup and GetTrafficDistribution round-trip", async () => {
  const client = connect();

  const created = await client.send(
    new CreateTrafficDistributionGroupCommand({
      Name: "test-tdg",
      InstanceId: "arn:aws:connect:us-east-1:123456789012:instance/test",
    }),
  );
  expect(created.Id).toBeDefined();
  expect(created.Arn).toBeDefined();
  const id = created.Id ?? "";

  const fetched = await client.send(
    new GetTrafficDistributionCommand({ Id: id }),
  );
  expect(fetched.Id).toBe(id);
  expect(fetched.Arn).toBe(created.Arn);
});

test("CreatePrompt returns prompt ID and ARN", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-cp-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(createdInstance.Id).toBeDefined();
  const instanceId = createdInstance.Id ?? "";

  const prompt = await client.send(
    new CreatePromptCommand({
      InstanceId: instanceId,
      Name: "test-prompt",
      S3Uri: "s3://bucket/key",
    }),
  );
  expect(prompt.PromptId).toBeDefined();
  expect(prompt.PromptARN).toBeDefined();

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});
