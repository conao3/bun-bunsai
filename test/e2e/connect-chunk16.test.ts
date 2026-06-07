import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  CreatePromptCommand,
  CreateQueueCommand,
  CreateQuickConnectCommand,
  DeleteInstanceCommand,
  ListLambdaFunctionsCommand,
  ListLexBotsCommand,
  ListPhoneNumbersCommand,
  ListPhoneNumbersV2Command,
  ListPromptsCommand,
  ListQueueQuickConnectsCommand,
  ListQueuesCommand,
  ListQuickConnectsCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const connect = () =>
  new ConnectClient({ endpoint, region, credentials, requestHandler });

test("ListQueues returns created queue; ListQuickConnects returns created quick connect", async () => {
  const client = connect();

  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk16-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = inst.Id ?? "";
  expect(instanceId).toBeTruthy();

  const emptyQueues = await client.send(
    new ListQueuesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyQueues.QueueSummaryList)).toBe(true);
  expect(emptyQueues.QueueSummaryList?.length).toBe(0);

  const createdQueue = await client.send(
    new CreateQueueCommand({
      InstanceId: instanceId,
      Name: "test-queue",
      HoursOfOperationId: "placeholder-hoo-id",
    }),
  );
  expect(createdQueue.QueueId).toBeDefined();

  const listedQueues = await client.send(
    new ListQueuesCommand({ InstanceId: instanceId }),
  );
  expect(listedQueues.QueueSummaryList?.length).toBe(1);
  expect(listedQueues.QueueSummaryList?.[0]?.Id).toBe(createdQueue.QueueId);
  expect(listedQueues.QueueSummaryList?.[0]?.Name).toBe("test-queue");

  const emptyQCs = await client.send(
    new ListQuickConnectsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyQCs.QuickConnectSummaryList)).toBe(true);
  expect(emptyQCs.QuickConnectSummaryList?.length).toBe(0);

  const createdQC = await client.send(
    new CreateQuickConnectCommand({
      InstanceId: instanceId,
      Name: "test-qc",
      QuickConnectConfig: {
        QuickConnectType: "PHONE_NUMBER",
        PhoneConfig: { PhoneNumber: "+12065551234" },
      },
    }),
  );
  expect(createdQC.QuickConnectId).toBeDefined();

  const listedQCs = await client.send(
    new ListQuickConnectsCommand({ InstanceId: instanceId }),
  );
  expect(listedQCs.QuickConnectSummaryList?.length).toBe(1);
  expect(listedQCs.QuickConnectSummaryList?.[0]?.Id).toBe(
    createdQC.QuickConnectId,
  );

  const queueId = createdQueue.QueueId ?? "";
  const queueQCs = await client.send(
    new ListQueueQuickConnectsCommand({
      InstanceId: instanceId,
      QueueId: queueId,
    }),
  );
  expect(Array.isArray(queueQCs.QuickConnectSummaryList)).toBe(true);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("ListPrompts returns created prompt; stub ops return empty lists", async () => {
  const client = connect();

  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk16b-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = inst.Id ?? "";

  const createdPrompt = await client.send(
    new CreatePromptCommand({
      InstanceId: instanceId,
      Name: "test-prompt",
      S3Uri: "s3://bucket/key",
    }),
  );
  expect(createdPrompt.PromptId).toBeDefined();

  const listedPrompts = await client.send(
    new ListPromptsCommand({ InstanceId: instanceId }),
  );
  expect(listedPrompts.PromptSummaryList?.length).toBe(1);
  expect(listedPrompts.PromptSummaryList?.[0]?.Id).toBe(createdPrompt.PromptId);

  const lambdas = await client.send(
    new ListLambdaFunctionsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(lambdas.LambdaFunctions)).toBe(true);
  expect(lambdas.LambdaFunctions?.length).toBe(0);

  const lexBots = await client.send(
    new ListLexBotsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(lexBots.LexBots)).toBe(true);
  expect(lexBots.LexBots?.length).toBe(0);

  const phoneNumbers = await client.send(
    new ListPhoneNumbersCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(phoneNumbers.PhoneNumberSummaryList)).toBe(true);
  expect(phoneNumbers.PhoneNumberSummaryList?.length).toBe(0);

  const phoneNumbersV2 = await client.send(new ListPhoneNumbersV2Command({}));
  expect(Array.isArray(phoneNumbersV2.ListPhoneNumbersSummaryList)).toBe(true);
  expect(phoneNumbersV2.ListPhoneNumbersSummaryList?.length).toBe(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});
