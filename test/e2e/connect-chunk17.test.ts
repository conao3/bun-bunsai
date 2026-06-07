import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  CreateRoutingProfileCommand,
  CreateRuleCommand,
  CreateSecurityProfileCommand,
  DeleteInstanceCommand,
  ListRoutingProfilesCommand,
  ListRulesCommand,
  ListSecurityProfilesCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const connect = () =>
  new ConnectClient({ endpoint, region, credentials, requestHandler });

test("ListRoutingProfiles returns created profile; ListSecurityProfiles returns created profile; ListRules empty", async () => {
  const client = connect();

  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk17-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = inst.Id ?? "";
  expect(instanceId).toBeTruthy();

  const emptyRules = await client.send(
    new ListRulesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyRules.RuleSummaryList)).toBe(true);
  expect(emptyRules.RuleSummaryList?.length).toBe(0);

  const emptyProfiles = await client.send(
    new ListRoutingProfilesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyProfiles.RoutingProfileSummaryList)).toBe(true);
  expect(emptyProfiles.RoutingProfileSummaryList?.length).toBe(0);

  const createdProfile = await client.send(
    new CreateRoutingProfileCommand({
      InstanceId: instanceId,
      Name: "test-routing-profile",
      Description: "e2e test",
      DefaultOutboundQueueId: "queue-1",
      MediaConcurrencies: [],
    }),
  );
  expect(createdProfile.RoutingProfileId).toBeTruthy();
  expect(createdProfile.RoutingProfileArn).toBeTruthy();

  const listedProfiles = await client.send(
    new ListRoutingProfilesCommand({ InstanceId: instanceId }),
  );
  expect(listedProfiles.RoutingProfileSummaryList?.length).toBe(1);
  expect(listedProfiles.RoutingProfileSummaryList?.[0]?.Id).toBe(
    createdProfile.RoutingProfileId,
  );

  const emptySecurityProfiles = await client.send(
    new ListSecurityProfilesCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptySecurityProfiles.SecurityProfileSummaryList)).toBe(
    true,
  );
  expect(emptySecurityProfiles.SecurityProfileSummaryList?.length).toBe(0);

  const createdSecurityProfile = await client.send(
    new CreateSecurityProfileCommand({
      InstanceId: instanceId,
      SecurityProfileName: "test-security-profile",
    }),
  );
  expect(createdSecurityProfile.SecurityProfileId).toBeTruthy();
  expect(createdSecurityProfile.SecurityProfileArn).toBeTruthy();

  const listedSecurityProfiles = await client.send(
    new ListSecurityProfilesCommand({ InstanceId: instanceId }),
  );
  expect(listedSecurityProfiles.SecurityProfileSummaryList?.length).toBe(1);
  expect(listedSecurityProfiles.SecurityProfileSummaryList?.[0]?.Id).toBe(
    createdSecurityProfile.SecurityProfileId,
  );

  const createdRule = await client.send(
    new CreateRuleCommand({
      InstanceId: instanceId,
      Name: "test-rule",
      TriggerEventSource: {
        EventSourceName: "OnContactEvaluationSubmit",
      },
      Function: "true",
      Actions: [],
      PublishStatus: "DRAFT",
    }),
  );
  expect(createdRule.RuleId).toBeTruthy();

  const listedRules = await client.send(
    new ListRulesCommand({ InstanceId: instanceId }),
  );
  expect(listedRules.RuleSummaryList?.length).toBe(1);
  expect(listedRules.RuleSummaryList?.[0]?.RuleId).toBe(createdRule.RuleId);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});
