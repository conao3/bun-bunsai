import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AssociateAdminAccountCommand,
  AssociateThirdPartyFirewallCommand,
  BatchAssociateResourceCommand,
  BatchDisassociateResourceCommand,
  DeleteAppsListCommand,
  DeleteNotificationChannelCommand,
  DeletePolicyCommand,
  DeleteProtocolsListCommand,
  DeleteResourceSetCommand,
  DisassociateAdminAccountCommand,
  DisassociateThirdPartyFirewallCommand,
  FMSClient,
  GetAdminAccountCommand,
  GetAdminScopeCommand,
  GetAppsListCommand,
  GetComplianceDetailCommand,
  GetNotificationChannelCommand,
  GetPolicyCommand,
  GetProtectionStatusCommand,
  GetProtocolsListCommand,
  GetResourceSetCommand,
  GetThirdPartyFirewallAssociationStatusCommand,
  GetViolationDetailsCommand,
  ListAdminAccountsForOrganizationCommand,
  ListAdminsManagingAccountCommand,
  ListAppsListsCommand,
  ListComplianceStatusCommand,
  ListDiscoveredResourcesCommand,
  ListMemberAccountsCommand,
  ListPoliciesCommand,
  ListProtocolsListsCommand,
  ListResourceSetResourcesCommand,
  ListResourceSetsCommand,
  ListTagsForResourceCommand,
  ListThirdPartyFirewallFirewallPoliciesCommand,
  PutAdminAccountCommand,
  PutAppsListCommand,
  PutNotificationChannelCommand,
  PutPolicyCommand,
  PutProtocolsListCommand,
  PutResourceSetCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-fms";
import { NodeHttpHandler } from "@smithy/node-http-handler";

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

const fms = () =>
  new FMSClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("FMS policy lifecycle", async () => {
  const client = fms();

  const put = await client.send(
    new PutPolicyCommand({
      Policy: {
        PolicyName: "bunsai-e2e-policy",
        SecurityServicePolicyData: { Type: "WAFV2" },
        ResourceType: "AWS::ElasticLoadBalancingV2::LoadBalancer",
        ExcludeResourceTags: false,
        RemediationEnabled: false,
      },
    }),
  );
  expect(put.Policy?.PolicyName).toBe("bunsai-e2e-policy");
  expect(put.Policy?.PolicyId).toBeDefined();
  expect(put.PolicyArn).toContain("policy/");

  const policyId = put.Policy?.PolicyId ?? "";

  const got = await client.send(new GetPolicyCommand({ PolicyId: policyId }));
  expect(got.Policy?.PolicyId).toBe(policyId);
  expect(got.PolicyArn).toContain(policyId);

  const listed = await client.send(new ListPoliciesCommand({}));
  expect((listed.PolicyList ?? []).some((p) => p.PolicyId === policyId)).toBe(
    true,
  );

  await client.send(new DeletePolicyCommand({ PolicyId: policyId }));

  await expect(
    client.send(new GetPolicyCommand({ PolicyId: policyId })),
  ).rejects.toThrow();
});

test("FMS AppsLists lifecycle", async () => {
  const client = fms();

  const put = await client.send(
    new PutAppsListCommand({
      AppsList: {
        ListName: "bunsai-e2e-apps-list",
        AppsList: [{ AppName: "test-app", Protocol: "TCP", Port: 443 }],
      },
    }),
  );
  expect(put.AppsList?.ListName).toBe("bunsai-e2e-apps-list");
  expect(put.AppsList?.ListId).toBeDefined();
  expect(put.AppsListArn).toContain("applications-list/");

  const listId = put.AppsList?.ListId ?? "";

  const got = await client.send(new GetAppsListCommand({ ListId: listId }));
  expect(got.AppsList?.ListId).toBe(listId);

  const listed = await client.send(
    new ListAppsListsCommand({ MaxResults: 100 }),
  );
  expect((listed.AppsLists ?? []).some((l) => l.ListId === listId)).toBe(true);

  await client.send(new DeleteAppsListCommand({ ListId: listId }));

  await expect(
    client.send(new GetAppsListCommand({ ListId: listId })),
  ).rejects.toThrow();
});

test("FMS ProtocolsLists lifecycle", async () => {
  const client = fms();

  const put = await client.send(
    new PutProtocolsListCommand({
      ProtocolsList: {
        ListName: "bunsai-e2e-protocols-list",
        ProtocolsList: ["HTTPS", "HTTP"],
      },
    }),
  );
  expect(put.ProtocolsList?.ListName).toBe("bunsai-e2e-protocols-list");
  expect(put.ProtocolsList?.ListId).toBeDefined();
  expect(put.ProtocolsListArn).toContain("protocols-list/");

  const listId = put.ProtocolsList?.ListId ?? "";

  const got = await client.send(
    new GetProtocolsListCommand({ ListId: listId }),
  );
  expect(got.ProtocolsList?.ListId).toBe(listId);

  const listed = await client.send(
    new ListProtocolsListsCommand({ MaxResults: 100 }),
  );
  expect((listed.ProtocolsLists ?? []).some((l) => l.ListId === listId)).toBe(
    true,
  );

  await client.send(new DeleteProtocolsListCommand({ ListId: listId }));

  await expect(
    client.send(new GetProtocolsListCommand({ ListId: listId })),
  ).rejects.toThrow();
});

test("FMS ResourceSets lifecycle with batch associate/disassociate", async () => {
  const client = fms();

  const put = await client.send(
    new PutResourceSetCommand({
      ResourceSet: {
        Name: "bunsai-e2e-resource-set",
        ResourceTypeList: ["AWS::EC2::Instance"],
      },
    }),
  );
  expect(put.ResourceSet?.Name).toBe("bunsai-e2e-resource-set");
  expect(put.ResourceSet?.Id).toBeDefined();
  expect(put.ResourceSetArn).toContain("resource-set/");

  const setId = put.ResourceSet?.Id ?? "";

  const got = await client.send(
    new GetResourceSetCommand({ Identifier: setId }),
  );
  expect(got.ResourceSet?.Id).toBe(setId);

  const listed = await client.send(new ListResourceSetsCommand({}));
  expect((listed.ResourceSets ?? []).some((s) => s.Id === setId)).toBe(true);

  const assoc = await client.send(
    new BatchAssociateResourceCommand({
      ResourceSetIdentifier: setId,
      Items: [
        "arn:aws:ec2:us-east-1:123456789012:instance/i-abc",
        "arn:aws:ec2:us-east-1:123456789012:instance/i-def",
      ],
    }),
  );
  expect(assoc.ResourceSetIdentifier).toBe(setId);
  expect(assoc.FailedItems).toHaveLength(0);

  const resources = await client.send(
    new ListResourceSetResourcesCommand({ Identifier: setId }),
  );
  expect((resources.Items ?? []).length).toBe(2);

  const disassoc = await client.send(
    new BatchDisassociateResourceCommand({
      ResourceSetIdentifier: setId,
      Items: ["arn:aws:ec2:us-east-1:123456789012:instance/i-abc"],
    }),
  );
  expect(disassoc.FailedItems).toHaveLength(0);

  const afterDisassoc = await client.send(
    new ListResourceSetResourcesCommand({ Identifier: setId }),
  );
  expect((afterDisassoc.Items ?? []).length).toBe(1);

  await client.send(new DeleteResourceSetCommand({ Identifier: setId }));

  await expect(
    client.send(new GetResourceSetCommand({ Identifier: setId })),
  ).rejects.toThrow();
});

test("FMS AdminAccount lifecycle", async () => {
  const client = fms();

  await client.send(
    new AssociateAdminAccountCommand({ AdminAccount: "123456789012" }),
  );

  const got = await client.send(new GetAdminAccountCommand({}));
  expect(got.AdminAccount).toBe("123456789012");
  expect(got.RoleStatus).toBe("READY");

  await client.send(new DisassociateAdminAccountCommand({}));

  await expect(client.send(new GetAdminAccountCommand({}))).rejects.toThrow();
});

test("FMS PutAdminAccount and GetAdminScope", async () => {
  const client = fms();

  await client.send(
    new PutAdminAccountCommand({ AdminAccount: "123456789012" }),
  );

  const scope = await client.send(
    new GetAdminScopeCommand({ AdminAccount: "123456789012" }),
  );
  expect(scope.Status).toBeDefined();

  const list = await client.send(
    new ListAdminAccountsForOrganizationCommand({}),
  );
  expect(
    (list.AdminAccounts ?? []).some((a) => a.AdminAccount === "123456789012"),
  ).toBe(true);

  const managing = await client.send(new ListAdminsManagingAccountCommand({}));
  expect((managing.AdminAccounts ?? []).includes("123456789012")).toBe(true);
});

test("FMS ThirdPartyFirewall lifecycle", async () => {
  const client = fms();

  const assoc = await client.send(
    new AssociateThirdPartyFirewallCommand({
      ThirdPartyFirewall: "PALO_ALTO_NETWORKS_CLOUD_NGFW",
    }),
  );
  expect(assoc.ThirdPartyFirewallStatus).toBe("ONBOARDING");

  const status = await client.send(
    new GetThirdPartyFirewallAssociationStatusCommand({
      ThirdPartyFirewall: "PALO_ALTO_NETWORKS_CLOUD_NGFW",
    }),
  );
  expect(status.ThirdPartyFirewallStatus).toBeDefined();

  const policies = await client.send(
    new ListThirdPartyFirewallFirewallPoliciesCommand({
      ThirdPartyFirewall: "PALO_ALTO_NETWORKS_CLOUD_NGFW",
      MaxResults: 10,
    }),
  );
  expect(
    (policies.ThirdPartyFirewallFirewallPolicies ?? []).length,
  ).toBeGreaterThan(0);

  const disassoc = await client.send(
    new DisassociateThirdPartyFirewallCommand({
      ThirdPartyFirewall: "PALO_ALTO_NETWORKS_CLOUD_NGFW",
    }),
  );
  expect(disassoc.ThirdPartyFirewallStatus).toBe("OFFBOARDING");
});

test("FMS NotificationChannel lifecycle", async () => {
  const client = fms();

  await client.send(
    new PutNotificationChannelCommand({
      SnsTopicArn: "arn:aws:sns:us-east-1:123456789012:bunsai-e2e-topic",
      SnsRoleName: "arn:aws:iam::123456789012:role/bunsai-e2e-role",
    }),
  );

  const got = await client.send(new GetNotificationChannelCommand({}));
  expect(got.SnsTopicArn).toContain("bunsai-e2e-topic");
  expect(got.SnsRoleName).toContain("bunsai-e2e-role");

  await client.send(new DeleteNotificationChannelCommand({}));

  await expect(
    client.send(new GetNotificationChannelCommand({})),
  ).rejects.toThrow();
});

test("FMS Tags lifecycle", async () => {
  const client = fms();

  const resourceArn =
    "arn:aws:fms:us-east-1:123456789012:policy/test-tag-policy";

  await client.send(
    new TagResourceCommand({
      ResourceArn: resourceArn,
      TagList: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect((listed.TagList ?? []).find((t) => t.Key === "env")?.Value).toBe(
    "test",
  );
  expect((listed.TagList ?? []).find((t) => t.Key === "team")?.Value).toBe(
    "bunsai",
  );

  await client.send(
    new UntagResourceCommand({
      ResourceArn: resourceArn,
      TagKeys: ["env"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(
    (afterUntag.TagList ?? []).find((t) => t.Key === "env"),
  ).toBeUndefined();
  expect((afterUntag.TagList ?? []).find((t) => t.Key === "team")?.Value).toBe(
    "bunsai",
  );
});

test("FMS compliance and status (synthetic)", async () => {
  const client = fms();

  const compliance = await client.send(
    new GetComplianceDetailCommand({
      PolicyId: "test-policy-id",
      MemberAccount: "123456789012",
    }),
  );
  expect(compliance.PolicyComplianceDetail?.PolicyId).toBe("test-policy-id");
  expect(compliance.PolicyComplianceDetail?.Violators).toBeDefined();

  const protection = await client.send(
    new GetProtectionStatusCommand({ PolicyId: "test-policy-id" }),
  );
  expect(protection.AdminAccountId).toBeDefined();
  expect(protection.ServiceType).toBeDefined();

  const violation = await client.send(
    new GetViolationDetailsCommand({
      PolicyId: "test-policy-id",
      MemberAccount: "123456789012",
      ResourceId: "test-resource-id",
      ResourceType: "AWS::EC2::Instance",
    }),
  );
  expect(violation.ViolationDetail?.PolicyId).toBe("test-policy-id");
  expect(violation.ViolationDetail?.ResourceViolations).toBeDefined();

  const complianceList = await client.send(
    new ListComplianceStatusCommand({ PolicyId: "test-policy-id" }),
  );
  expect(complianceList.PolicyComplianceStatusList).toBeDefined();

  const discovered = await client.send(
    new ListDiscoveredResourcesCommand({
      MemberAccountIds: ["123456789012"],
      ResourceType: "AWS::EC2::Instance",
    }),
  );
  expect(discovered.Items).toBeDefined();

  const members = await client.send(new ListMemberAccountsCommand({}));
  expect(members.MemberAccounts).toBeDefined();
});
