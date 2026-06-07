import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateContactFlowCommand,
  CreateHoursOfOperationCommand,
  CreateInstanceCommand,
  CreatePromptCommand,
  CreateQueueCommand,
  SearchContactFlowModulesCommand,
  SearchContactFlowsCommand,
  SearchContactsCommand,
  SearchDataTablesCommand,
  SearchEmailAddressesCommand,
  SearchEvaluationFormsCommand,
  SearchHoursOfOperationOverridesCommand,
  SearchHoursOfOperationsCommand,
  SearchNotificationsCommand,
  SearchPredefinedAttributesCommand,
  SearchPromptsCommand,
  SearchQueuesCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new ConnectClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

test("search ops: create-then-find and empty-result assertions", async () => {
  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk20-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = inst.Id ?? "";
  expect(instanceId).toBeTruthy();

  const emptyQueues = await client.send(
    new SearchQueuesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyQueues.Queues)).toBe(true);
  expect(emptyQueues.Queues?.length).toBe(0);

  const createdQueue = await client.send(
    new CreateQueueCommand({
      InstanceId: instanceId,
      Name: "test-queue-chunk20",
      HoursOfOperationId: "default-hours",
    }),
  );
  expect(createdQueue.QueueId).toBeTruthy();

  const foundQueues = await client.send(
    new SearchQueuesCommand({ InstanceId: instanceId }),
  );
  expect(foundQueues.Queues?.length).toBe(1);
  expect(foundQueues.Queues?.[0]?.QueueId).toBe(createdQueue.QueueId);
  expect(foundQueues.ApproximateTotalCount).toBe(1);

  const emptyFlows = await client.send(
    new SearchContactFlowsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyFlows.ContactFlows)).toBe(true);
  expect(emptyFlows.ContactFlows?.length).toBe(0);

  const createdFlow = await client.send(
    new CreateContactFlowCommand({
      InstanceId: instanceId,
      Name: "test-flow-chunk20",
      Type: "CONTACT_FLOW",
      Content: JSON.stringify({
        Version: "2019-10-30",
        StartAction: "a",
        Actions: [],
      }),
    }),
  );
  expect(createdFlow.ContactFlowId).toBeTruthy();

  const foundFlows = await client.send(
    new SearchContactFlowsCommand({ InstanceId: instanceId }),
  );
  expect(foundFlows.ContactFlows?.length).toBe(1);
  expect(foundFlows.ContactFlows?.[0]?.Id).toBe(createdFlow.ContactFlowId);
  expect(foundFlows.ApproximateTotalCount).toBe(1);

  const createdHoo = await client.send(
    new CreateHoursOfOperationCommand({
      InstanceId: instanceId,
      Name: "test-hoo-chunk20",
      TimeZone: "UTC",
      Config: [],
    }),
  );
  expect(createdHoo.HoursOfOperationId).toBeTruthy();

  const foundHoo = await client.send(
    new SearchHoursOfOperationsCommand({ InstanceId: instanceId }),
  );
  expect(foundHoo.HoursOfOperations?.length).toBe(1);
  expect(foundHoo.HoursOfOperations?.[0]?.HoursOfOperationId).toBe(
    createdHoo.HoursOfOperationId,
  );

  const createdPrompt = await client.send(
    new CreatePromptCommand({
      InstanceId: instanceId,
      Name: "test-prompt-chunk20",
      S3Uri: "s3://bucket/key",
    }),
  );
  expect(createdPrompt.PromptId).toBeTruthy();

  const foundPrompts = await client.send(
    new SearchPromptsCommand({ InstanceId: instanceId }),
  );
  expect(foundPrompts.Prompts?.length).toBe(1);
  expect(foundPrompts.Prompts?.[0]?.PromptId).toBe(createdPrompt.PromptId);

  const emptyModules = await client.send(
    new SearchContactFlowModulesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyModules.ContactFlowModules)).toBe(true);

  const emptyContacts = await client.send(
    new SearchContactsCommand({
      InstanceId: instanceId,
      TimeRange: {
        Type: "INITIATION_TIMESTAMP",
        StartTime: new Date(0),
        EndTime: new Date(),
      },
    }),
  );
  expect(Array.isArray(emptyContacts.Contacts)).toBe(true);

  const emptyDataTables = await client.send(
    new SearchDataTablesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyDataTables.DataTables)).toBe(true);

  const emptyEmailAddresses = await client.send(
    new SearchEmailAddressesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyEmailAddresses.EmailAddresses)).toBe(true);

  const emptyEvalForms = await client.send(
    new SearchEvaluationFormsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyEvalForms.EvaluationFormSearchSummaryList)).toBe(
    true,
  );

  const emptyHooOverrides = await client.send(
    new SearchHoursOfOperationOverridesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyHooOverrides.HoursOfOperationOverrides)).toBe(true);

  const emptyNotifications = await client.send(
    new SearchNotificationsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyNotifications.Notifications)).toBe(true);

  const emptyPredefined = await client.send(
    new SearchPredefinedAttributesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyPredefined.PredefinedAttributes)).toBe(true);
});
