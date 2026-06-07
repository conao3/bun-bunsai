import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateContactFlowCommand,
  CreateContactFlowModuleCommand,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  ListAuthenticationProfilesCommand,
  ListBotsCommand,
  ListContactFlowModulesCommand,
  ListContactFlowsCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const connect = () =>
  new ConnectClient({ endpoint, region, credentials, requestHandler });

test("ListContactFlows returns created flows and empty list before creation", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk14-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = createdInstance.Id ?? "";
  expect(instanceId).toBeTruthy();

  const emptyList = await client.send(
    new ListContactFlowsCommand({ InstanceId: instanceId }),
  );
  expect(emptyList.ContactFlowSummaryList).toBeDefined();
  expect(Array.isArray(emptyList.ContactFlowSummaryList)).toBe(true);
  expect(emptyList.ContactFlowSummaryList?.length).toBe(0);

  const created = await client.send(
    new CreateContactFlowCommand({
      InstanceId: instanceId,
      Name: "test-flow",
      Type: "CONTACT_FLOW",
      Content: "{}",
    }),
  );
  expect(created.ContactFlowId).toBeDefined();
  expect(created.ContactFlowArn).toBeDefined();

  const listResult = await client.send(
    new ListContactFlowsCommand({ InstanceId: instanceId }),
  );
  expect(listResult.ContactFlowSummaryList?.length).toBe(1);
  expect(listResult.ContactFlowSummaryList?.[0]?.Name).toBe("test-flow");
  expect(listResult.ContactFlowSummaryList?.[0]?.Id).toBe(
    created.ContactFlowId,
  );

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("ListContactFlowModules returns created modules", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk14b-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = createdInstance.Id ?? "";

  const emptyList = await client.send(
    new ListContactFlowModulesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyList.ContactFlowModulesSummaryList)).toBe(true);
  expect(emptyList.ContactFlowModulesSummaryList?.length).toBe(0);

  await client.send(
    new CreateContactFlowModuleCommand({
      InstanceId: instanceId,
      Name: "test-module",
      Content: "{}",
    }),
  );

  const listResult = await client.send(
    new ListContactFlowModulesCommand({ InstanceId: instanceId }),
  );
  expect(listResult.ContactFlowModulesSummaryList?.length).toBe(1);
  expect(listResult.ContactFlowModulesSummaryList?.[0]?.Name).toBe(
    "test-module",
  );

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("ListAuthenticationProfiles returns empty list", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk14c-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = createdInstance.Id ?? "";

  const result = await client.send(
    new ListAuthenticationProfilesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(result.AuthenticationProfileSummaryList)).toBe(true);
  expect(result.AuthenticationProfileSummaryList?.length).toBe(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("ListBots returns empty list", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk14d-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = createdInstance.Id ?? "";

  const result = await client.send(
    new ListBotsCommand({ InstanceId: instanceId, LexVersion: "V2" }),
  );
  expect(Array.isArray(result.LexBots)).toBe(true);
  expect(result.LexBots?.length).toBe(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});
