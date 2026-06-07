import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateDataTableCommand,
  CreateEvaluationFormCommand,
  CreateHoursOfOperationCommand,
  CreateHoursOfOperationOverrideCommand,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  ListDataTablesCommand,
  ListDefaultVocabulariesCommand,
  ListEvaluationFormsCommand,
  ListFlowAssociationsCommand,
  ListHoursOfOperationOverridesCommand,
  ListHoursOfOperationsCommand,
  ListInstanceAttributesCommand,
  ListInstanceStorageConfigsCommand,
  ListIntegrationAssociationsCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const connect = () =>
  new ConnectClient({ endpoint, region, credentials, requestHandler });

test("ListDataTables returns empty then created table", async () => {
  const client = connect();

  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk15-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = inst.Id ?? "";
  expect(instanceId).toBeTruthy();

  const empty = await client.send(
    new ListDataTablesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(empty.DataTableSummaryList)).toBe(true);
  expect(empty.DataTableSummaryList?.length).toBe(0);

  const created = await client.send(
    new CreateDataTableCommand({
      InstanceId: instanceId,
      Name: "test-table",
      TimeZone: "UTC",
      ValueLockLevel: "NONE",
      Status: "PUBLISHED",
    }),
  );
  expect(created.Id).toBeDefined();

  const listed = await client.send(
    new ListDataTablesCommand({ InstanceId: instanceId }),
  );
  expect(listed.DataTableSummaryList?.length).toBe(1);
  expect(listed.DataTableSummaryList?.[0]?.Id).toBe(created.Id);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("ListHoursOfOperations returns created hours and ListHoursOfOperationOverrides works", async () => {
  const client = connect();

  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk15b-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = inst.Id ?? "";

  const hoo = await client.send(
    new CreateHoursOfOperationCommand({
      InstanceId: instanceId,
      Name: "test-hours",
      TimeZone: "UTC",
      Config: [],
    }),
  );
  expect(hoo.HoursOfOperationId).toBeDefined();
  const hooId = hoo.HoursOfOperationId ?? "";

  const listed = await client.send(
    new ListHoursOfOperationsCommand({ InstanceId: instanceId }),
  );
  expect(listed.HoursOfOperationSummaryList?.length).toBe(1);
  expect(listed.HoursOfOperationSummaryList?.[0]?.Id).toBe(hooId);
  expect(listed.HoursOfOperationSummaryList?.[0]?.Name).toBe("test-hours");

  const emptyOverrides = await client.send(
    new ListHoursOfOperationOverridesCommand({
      InstanceId: instanceId,
      HoursOfOperationId: hooId,
    }),
  );
  expect(Array.isArray(emptyOverrides.HoursOfOperationOverrideList)).toBe(true);
  expect(emptyOverrides.HoursOfOperationOverrideList?.length).toBe(0);

  await client.send(
    new CreateHoursOfOperationOverrideCommand({
      InstanceId: instanceId,
      HoursOfOperationId: hooId,
      Name: "override1",
      Config: [],
      EffectiveFrom: "2025-01-01",
      EffectiveTill: "2025-12-31",
    }),
  );

  const withOverride = await client.send(
    new ListHoursOfOperationOverridesCommand({
      InstanceId: instanceId,
      HoursOfOperationId: hooId,
    }),
  );
  expect(withOverride.HoursOfOperationOverrideList?.length).toBe(1);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("ListEvaluationForms returns created forms", async () => {
  const client = connect();

  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk15c-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = inst.Id ?? "";

  const emptyForms = await client.send(
    new ListEvaluationFormsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyForms.EvaluationFormSummaryList)).toBe(true);
  expect(emptyForms.EvaluationFormSummaryList?.length).toBe(0);

  const created = await client.send(
    new CreateEvaluationFormCommand({
      InstanceId: instanceId,
      Title: "test-form",
      Items: [],
    }),
  );
  expect(created.EvaluationFormId).toBeDefined();

  const listed = await client.send(
    new ListEvaluationFormsCommand({ InstanceId: instanceId }),
  );
  expect(listed.EvaluationFormSummaryList?.length).toBe(1);
  expect(listed.EvaluationFormSummaryList?.[0]?.EvaluationFormId).toBe(
    created.EvaluationFormId,
  );

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("empty list assertions for stub operations", async () => {
  const client = connect();

  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk15d-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = inst.Id ?? "";

  const vocabs = await client.send(
    new ListDefaultVocabulariesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(vocabs.DefaultVocabularyList)).toBe(true);
  expect(vocabs.DefaultVocabularyList?.length).toBe(0);

  const flows = await client.send(
    new ListFlowAssociationsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(flows.FlowAssociationSummaryList)).toBe(true);
  expect(flows.FlowAssociationSummaryList?.length).toBe(0);

  const attrs = await client.send(
    new ListInstanceAttributesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(attrs.Attributes)).toBe(true);
  expect(attrs.Attributes?.length).toBe(0);

  const storageConfigs = await client.send(
    new ListInstanceStorageConfigsCommand({
      InstanceId: instanceId,
      ResourceType: "CHAT_TRANSCRIPTS",
    }),
  );
  expect(Array.isArray(storageConfigs.StorageConfigs)).toBe(true);
  expect(storageConfigs.StorageConfigs?.length).toBe(0);

  const integrations = await client.send(
    new ListIntegrationAssociationsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(integrations.IntegrationAssociationSummaryList)).toBe(
    true,
  );
  expect(integrations.IntegrationAssociationSummaryList?.length).toBe(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});
