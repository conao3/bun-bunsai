import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateAgentStatusCommand,
  CreateInstanceCommand,
  CreatePromptCommand,
  CreateTrafficDistributionGroupCommand,
  DeleteInstanceCommand,
  ImportPhoneNumberCommand,
  ListAgentStatusesCommand,
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

test("ListAgentStatuses returns created agent statuses", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk13-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = createdInstance.Id ?? "";
  expect(instanceId).toBeTruthy();

  const emptyList = await client.send(
    new ListAgentStatusesCommand({ InstanceId: instanceId }),
  );
  expect(emptyList.AgentStatusSummaryList).toBeDefined();
  expect(Array.isArray(emptyList.AgentStatusSummaryList)).toBe(true);
  expect(emptyList.AgentStatusSummaryList?.length).toBe(0);

  await client.send(
    new CreateAgentStatusCommand({
      InstanceId: instanceId,
      Name: "test-agent-status",
      State: "ENABLED",
    }),
  );

  const listResult = await client.send(
    new ListAgentStatusesCommand({ InstanceId: instanceId }),
  );
  expect(listResult.AgentStatusSummaryList?.length).toBe(1);
  expect(listResult.AgentStatusSummaryList?.[0]?.Name).toBe(
    "test-agent-status",
  );

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("ImportPhoneNumber creates a phone number resource", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk13c-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = createdInstance.Id ?? "";

  const result = await client.send(
    new ImportPhoneNumberCommand({
      InstanceId: instanceId,
      SourcePhoneNumberArn:
        "arn:aws:connect:us-east-1:123456789012:phone-number/existing-number",
      PhoneNumberDescription: "imported number",
    }),
  );
  expect(result.PhoneNumberId).toBeDefined();
  expect(result.PhoneNumberArn).toBeDefined();
  expect(result.PhoneNumberArn).toContain("phone-number");

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("GetPromptFile returns presigned URL for existing prompt", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk13b-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = createdInstance.Id ?? "";

  const prompt = await client.send(
    new CreatePromptCommand({
      InstanceId: instanceId,
      Name: "test-prompt",
      S3Uri: "s3://bucket/key",
    }),
  );
  expect(prompt.PromptId).toBeDefined();

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("GetTrafficDistribution returns traffic distribution data", async () => {
  const client = connect();

  const created = await client.send(
    new CreateTrafficDistributionGroupCommand({
      Name: "test-tg",
      InstanceId: "arn:aws:connect:us-east-1:123456789012:instance/test",
    }),
  );
  expect(created.Id).toBeDefined();
  expect(created.Arn).toBeDefined();
});
