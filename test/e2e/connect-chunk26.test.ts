import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  CreateQueueCommand,
  CreateQuickConnectCommand,
  CreateRoutingProfileCommand,
  CreateRuleCommand,
  CreateSecurityProfileCommand,
  DescribeQueueCommand,
  DescribeQuickConnectCommand,
  DescribeRoutingProfileCommand,
  DescribeRuleCommand,
  DescribeSecurityProfileCommand,
  UpdateQueueStatusCommand,
  UpdateQuickConnectConfigCommand,
  UpdateQuickConnectNameCommand,
  UpdateRoutingProfileConcurrencyCommand,
  UpdateRoutingProfileNameCommand,
  UpdateRuleCommand,
  UpdateSecurityProfileCommand,
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

test("chunk26: update ops mutate stored entities", async () => {
  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk26-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: true,
    }),
  );
  const instanceId = inst.Id!;

  const q = await client.send(
    new CreateQueueCommand({
      InstanceId: instanceId,
      Name: "test-queue",
      HoursOfOperationId: "hoo-1",
    }),
  );
  const queueId = q.QueueId!;

  await client.send(
    new UpdateQueueStatusCommand({
      InstanceId: instanceId,
      QueueId: queueId,
      Status: "DISABLED",
    }),
  );
  const qDesc = await client.send(
    new DescribeQueueCommand({ InstanceId: instanceId, QueueId: queueId }),
  );
  expect(qDesc.Queue?.Status).toBe("DISABLED");

  const rp = await client.send(
    new CreateRoutingProfileCommand({
      InstanceId: instanceId,
      Name: "rp-original",
      DefaultOutboundQueueId: queueId,
      Description: "desc",
      MediaConcurrencies: [],
    }),
  );
  const routingProfileId = rp.RoutingProfileId!;

  await client.send(
    new UpdateRoutingProfileNameCommand({
      InstanceId: instanceId,
      RoutingProfileId: routingProfileId,
      Name: "rp-updated",
    }),
  );
  const rpDesc = await client.send(
    new DescribeRoutingProfileCommand({
      InstanceId: instanceId,
      RoutingProfileId: routingProfileId,
    }),
  );
  expect(rpDesc.RoutingProfile?.Name).toBe("rp-updated");

  await client.send(
    new UpdateRoutingProfileConcurrencyCommand({
      InstanceId: instanceId,
      RoutingProfileId: routingProfileId,
      MediaConcurrencies: [{ Channel: "VOICE", Concurrency: 2 }],
    }),
  );
  const rpDesc2 = await client.send(
    new DescribeRoutingProfileCommand({
      InstanceId: instanceId,
      RoutingProfileId: routingProfileId,
    }),
  );
  expect(rpDesc2.RoutingProfile?.MediaConcurrencies).toBeDefined();

  const qc = await client.send(
    new CreateQuickConnectCommand({
      InstanceId: instanceId,
      Name: "qc-original",
      QuickConnectConfig: { QuickConnectType: "PHONE_NUMBER" },
    }),
  );
  const quickConnectId = qc.QuickConnectId!;

  await client.send(
    new UpdateQuickConnectNameCommand({
      InstanceId: instanceId,
      QuickConnectId: quickConnectId,
      Name: "qc-updated",
    }),
  );
  const qcDesc = await client.send(
    new DescribeQuickConnectCommand({
      InstanceId: instanceId,
      QuickConnectId: quickConnectId,
    }),
  );
  expect(qcDesc.QuickConnect?.Name).toBe("qc-updated");

  await client.send(
    new UpdateQuickConnectConfigCommand({
      InstanceId: instanceId,
      QuickConnectId: quickConnectId,
      QuickConnectConfig: { QuickConnectType: "QUEUE" },
    }),
  );
  const qcDesc2 = await client.send(
    new DescribeQuickConnectCommand({
      InstanceId: instanceId,
      QuickConnectId: quickConnectId,
    }),
  );
  expect(qcDesc2.QuickConnect?.QuickConnectConfig).toBeDefined();

  const sp = await client.send(
    new CreateSecurityProfileCommand({
      InstanceId: instanceId,
      SecurityProfileName: "sp-original",
    }),
  );
  const securityProfileId = sp.SecurityProfileId!;

  await client.send(
    new UpdateSecurityProfileCommand({
      InstanceId: instanceId,
      SecurityProfileId: securityProfileId,
      Description: "updated-description",
    }),
  );
  const spDesc = await client.send(
    new DescribeSecurityProfileCommand({
      InstanceId: instanceId,
      SecurityProfileId: securityProfileId,
    }),
  );
  expect(spDesc.SecurityProfile?.Description).toBe("updated-description");

  const rule = await client.send(
    new CreateRuleCommand({
      InstanceId: instanceId,
      Name: "rule-original",
      TriggerEventSource: { EventSourceName: "OnContactEvaluationSubmit" },
      Function: "true",
      Actions: [],
      PublishStatus: "DRAFT",
    }),
  );
  const ruleId = rule.RuleId!;

  await client.send(
    new UpdateRuleCommand({
      InstanceId: instanceId,
      RuleId: ruleId,
      Name: "rule-updated",
      Function: "false",
      Actions: [],
      PublishStatus: "PUBLISHED",
    }),
  );
  const ruleDesc = await client.send(
    new DescribeRuleCommand({ InstanceId: instanceId, RuleId: ruleId }),
  );
  expect(ruleDesc.Rule?.Name).toBe("rule-updated");
  expect(ruleDesc.Rule?.PublishStatus).toBe("PUBLISHED");
});
