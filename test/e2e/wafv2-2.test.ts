import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AssociateWebACLCommand,
  CheckCapacityCommand,
  CreateAPIKeyCommand,
  CreateIPSetCommand,
  CreateRegexPatternSetCommand,
  CreateRuleGroupCommand,
  CreateWebACLCommand,
  DeleteAPIKeyCommand,
  DeleteFirewallManagerRuleGroupsCommand,
  DeleteIPSetCommand,
  DeleteLoggingConfigurationCommand,
  DeletePermissionPolicyCommand,
  DeleteRegexPatternSetCommand,
  DeleteRuleGroupCommand,
  DescribeAllManagedProductsCommand,
  DescribeManagedProductsByVendorCommand,
  DescribeManagedRuleGroupCommand,
  DisassociateWebACLCommand,
  GenerateMobileSdkReleaseUrlCommand,
  GetDecryptedAPIKeyCommand,
  GetIPSetCommand,
  GetLoggingConfigurationCommand,
  GetManagedRuleSetCommand,
  GetMobileSdkReleaseCommand,
  GetPermissionPolicyCommand,
  GetRateBasedStatementManagedKeysCommand,
  GetRegexPatternSetCommand,
  GetRuleGroupCommand,
  GetSampledRequestsCommand,
  GetTopPathStatisticsByTrafficCommand,
  GetWebACLCommand,
  GetWebACLForResourceCommand,
  ListAPIKeysCommand,
  ListAvailableManagedRuleGroupVersionsCommand,
  ListAvailableManagedRuleGroupsCommand,
  ListIPSetsCommand,
  ListLoggingConfigurationsCommand,
  ListManagedRuleSetsCommand,
  ListMobileSdkReleasesCommand,
  ListRegexPatternSetsCommand,
  ListResourcesForWebACLCommand,
  ListRuleGroupsCommand,
  ListTagsForResourceCommand,
  PutLoggingConfigurationCommand,
  PutManagedRuleSetVersionsCommand,
  PutPermissionPolicyCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateIPSetCommand,
  UpdateManagedRuleSetVersionExpiryDateCommand,
  UpdateRegexPatternSetCommand,
  UpdateRuleGroupCommand,
  WAFV2Client,
} from "@aws-sdk/client-wafv2";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4609;
const uiPort = 5709;
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

const wafv2 = () =>
  new WAFV2Client({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

const visibilityConfig = {
  SampledRequestsEnabled: true,
  CloudWatchMetricsEnabled: true,
  MetricName: "bunsai-e2e-rg-metric",
} as const;

test("WAFv2 RuleGroup lifecycle and tagging", async () => {
  const client = wafv2();
  const name = "bunsai-e2e-rulegroup";

  const created = await client.send(
    new CreateRuleGroupCommand({
      Name: name,
      Scope: "REGIONAL",
      Capacity: 50,
      VisibilityConfig: visibilityConfig,
      Rules: [],
    }),
  );
  expect(created.Summary?.Id).toBeDefined();
  expect(created.Summary?.ARN).toBeDefined();
  const groupId = created.Summary?.Id ?? "";
  const groupArn = created.Summary?.ARN ?? "";

  const listed = await client.send(
    new ListRuleGroupsCommand({ Scope: "REGIONAL" }),
  );
  expect((listed.RuleGroups ?? []).map((group) => group.Name)).toContain(name);

  const got = await client.send(
    new GetRuleGroupCommand({ Scope: "REGIONAL", Name: name, Id: groupId }),
  );
  expect(got.RuleGroup?.Name).toBe(name);
  expect(got.RuleGroup?.Capacity).toBe(50);
  expect(got.LockToken).toBeDefined();
  const lockToken = got.LockToken ?? "";

  const updated = await client.send(
    new UpdateRuleGroupCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: groupId,
      VisibilityConfig: visibilityConfig,
      LockToken: lockToken,
      Description: "updated rule group",
      Rules: [],
    }),
  );
  expect(updated.NextLockToken).toBeDefined();
  expect(updated.NextLockToken).not.toBe(lockToken);
  const nextToken = updated.NextLockToken ?? "";

  const afterUpdate = await client.send(
    new GetRuleGroupCommand({ Scope: "REGIONAL", Name: name, Id: groupId }),
  );
  expect(afterUpdate.RuleGroup?.Description).toBe("updated rule group");

  await client.send(
    new TagResourceCommand({
      ResourceARN: groupArn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "bunsai" },
      ],
    }),
  );

  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: groupArn }),
  );
  const tagPairs = (tags.TagInfoForResource?.TagList ?? []).map(
    (tag) => `${tag.Key}=${tag.Value}`,
  );
  expect(tagPairs).toContain("env=test");
  expect(tagPairs).toContain("team=bunsai");

  await client.send(
    new UntagResourceCommand({
      ResourceARN: groupArn,
      TagKeys: ["env"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: groupArn }),
  );
  const afterKeys = (afterUntag.TagInfoForResource?.TagList ?? []).map(
    (tag) => tag.Key,
  );
  expect(afterKeys).not.toContain("env");
  expect(afterKeys).toContain("team");

  await client.send(
    new DeleteRuleGroupCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: groupId,
      LockToken: nextToken,
    }),
  );

  const afterDelete = await client.send(
    new ListRuleGroupsCommand({ Scope: "REGIONAL" }),
  );
  expect(
    (afterDelete.RuleGroups ?? []).map((group) => group.Name),
  ).not.toContain(name);
});

test("WAFv2 IPSet lifecycle", async () => {
  const client = wafv2();
  const name = "bunsai-e2e-ipset";

  const created = await client.send(
    new CreateIPSetCommand({
      Name: name,
      Scope: "REGIONAL",
      IPAddressVersion: "IPV4",
      Addresses: ["192.0.2.0/24"],
    }),
  );
  expect(created.Summary?.Id).toBeDefined();
  expect(created.Summary?.ARN).toBeDefined();
  const setId = created.Summary?.Id ?? "";

  const listed = await client.send(
    new ListIPSetsCommand({ Scope: "REGIONAL" }),
  );
  expect((listed.IPSets ?? []).map((s) => s.Name)).toContain(name);

  const got = await client.send(
    new GetIPSetCommand({ Scope: "REGIONAL", Name: name, Id: setId }),
  );
  expect(got.IPSet?.Name).toBe(name);
  expect(got.IPSet?.IPAddressVersion).toBe("IPV4");
  expect(got.IPSet?.Addresses).toContain("192.0.2.0/24");
  expect(got.LockToken).toBeDefined();
  const token = got.LockToken ?? "";

  const updated = await client.send(
    new UpdateIPSetCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: setId,
      Addresses: ["10.0.0.0/8", "192.0.2.0/24"],
      LockToken: token,
    }),
  );
  expect(updated.NextLockToken).toBeDefined();
  expect(updated.NextLockToken).not.toBe(token);
  const nextToken = updated.NextLockToken ?? "";

  const afterUpdate = await client.send(
    new GetIPSetCommand({ Scope: "REGIONAL", Name: name, Id: setId }),
  );
  expect(afterUpdate.IPSet?.Addresses).toContain("10.0.0.0/8");

  await client.send(
    new DeleteIPSetCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: setId,
      LockToken: nextToken,
    }),
  );

  const afterDelete = await client.send(
    new ListIPSetsCommand({ Scope: "REGIONAL" }),
  );
  expect((afterDelete.IPSets ?? []).map((s) => s.Name)).not.toContain(name);
});

test("WAFv2 RegexPatternSet lifecycle", async () => {
  const client = wafv2();
  const name = "bunsai-e2e-regex";

  const created = await client.send(
    new CreateRegexPatternSetCommand({
      Name: name,
      Scope: "REGIONAL",
      RegularExpressionList: [{ RegexString: "^/api/" }],
    }),
  );
  expect(created.Summary?.Id).toBeDefined();
  expect(created.Summary?.ARN).toBeDefined();
  const setId = created.Summary?.Id ?? "";

  const listed = await client.send(
    new ListRegexPatternSetsCommand({ Scope: "REGIONAL" }),
  );
  expect((listed.RegexPatternSets ?? []).map((s) => s.Name)).toContain(name);

  const got = await client.send(
    new GetRegexPatternSetCommand({ Scope: "REGIONAL", Name: name, Id: setId }),
  );
  expect(got.RegexPatternSet?.Name).toBe(name);
  expect(
    (got.RegexPatternSet?.RegularExpressionList ?? []).map(
      (r) => r.RegexString,
    ),
  ).toContain("^/api/");
  expect(got.LockToken).toBeDefined();
  const token = got.LockToken ?? "";

  const updated = await client.send(
    new UpdateRegexPatternSetCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: setId,
      RegularExpressionList: [
        { RegexString: "^/api/" },
        { RegexString: "^/admin/" },
      ],
      LockToken: token,
    }),
  );
  expect(updated.NextLockToken).toBeDefined();
  const nextToken = updated.NextLockToken ?? "";

  await client.send(
    new DeleteRegexPatternSetCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: setId,
      LockToken: nextToken,
    }),
  );

  const afterDelete = await client.send(
    new ListRegexPatternSetsCommand({ Scope: "REGIONAL" }),
  );
  expect((afterDelete.RegexPatternSets ?? []).map((s) => s.Name)).not.toContain(
    name,
  );
});

test("WAFv2 LoggingConfiguration lifecycle", async () => {
  const client = wafv2();

  const acl = await client.send(
    new CreateWebACLCommand({
      Name: "bunsai-e2e-logging-acl",
      Scope: "REGIONAL",
      DefaultAction: { Allow: {} },
      VisibilityConfig: visibilityConfig,
      Rules: [],
    }),
  );
  const aclArn = acl.Summary?.ARN ?? "";

  const fakeDestination =
    "arn:aws:firehose:us-east-1:123456789012:deliverystream/bunsai-waf-logs";

  await client.send(
    new PutLoggingConfigurationCommand({
      LoggingConfiguration: {
        ResourceArn: aclArn,
        LogDestinationConfigs: [fakeDestination],
      },
    }),
  );

  const got = await client.send(
    new GetLoggingConfigurationCommand({ ResourceArn: aclArn }),
  );
  expect(got.LoggingConfiguration?.ResourceArn).toBe(aclArn);
  expect(got.LoggingConfiguration?.LogDestinationConfigs).toContain(
    fakeDestination,
  );

  const listed = await client.send(
    new ListLoggingConfigurationsCommand({ Scope: "REGIONAL" }),
  );
  const resourceArns = (listed.LoggingConfigurations ?? []).map(
    (c) => c.ResourceArn,
  );
  expect(resourceArns).toContain(aclArn);

  await client.send(
    new DeleteLoggingConfigurationCommand({ ResourceArn: aclArn }),
  );

  try {
    await client.send(
      new GetLoggingConfigurationCommand({ ResourceArn: aclArn }),
    );
    expect(false).toBe(true);
  } catch (e: unknown) {
    expect((e as Error).name).toBe("WAFNonexistentItemException");
  }
});

test("WAFv2 WebACL association", async () => {
  const client = wafv2();

  const acl = await client.send(
    new CreateWebACLCommand({
      Name: "bunsai-e2e-assoc-acl",
      Scope: "REGIONAL",
      DefaultAction: { Allow: {} },
      VisibilityConfig: visibilityConfig,
      Rules: [],
    }),
  );
  const aclArn = acl.Summary?.ARN ?? "";

  const fakeResourceArn =
    "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/bunsai-alb/abc123";

  await client.send(
    new AssociateWebACLCommand({
      WebACLArn: aclArn,
      ResourceArn: fakeResourceArn,
    }),
  );

  const forResource = await client.send(
    new GetWebACLForResourceCommand({ ResourceArn: fakeResourceArn }),
  );
  expect(forResource.WebACL?.ARN).toBe(aclArn);

  const resources = await client.send(
    new ListResourcesForWebACLCommand({ WebACLArn: aclArn }),
  );
  expect(resources.ResourceArns).toContain(fakeResourceArn);

  await client.send(
    new DisassociateWebACLCommand({ ResourceArn: fakeResourceArn }),
  );

  const afterDisassoc = await client.send(
    new GetWebACLForResourceCommand({ ResourceArn: fakeResourceArn }),
  );
  expect(afterDisassoc.WebACL).toBeUndefined();
});

test("WAFv2 PermissionPolicy lifecycle", async () => {
  const client = wafv2();

  const rg = await client.send(
    new CreateRuleGroupCommand({
      Name: "bunsai-e2e-policy-rg",
      Scope: "REGIONAL",
      Capacity: 10,
      VisibilityConfig: visibilityConfig,
      Rules: [],
    }),
  );
  const rgArn = rg.Summary?.ARN ?? "";
  const rgId = rg.Summary?.Id ?? "";

  const policy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: "*",
        Action: "wafv2:CreateWebACL",
        Resource: rgArn,
      },
    ],
  });

  await client.send(
    new PutPermissionPolicyCommand({ ResourceArn: rgArn, Policy: policy }),
  );

  const got = await client.send(
    new GetPermissionPolicyCommand({ ResourceArn: rgArn }),
  );
  expect(got.Policy).toBe(policy);

  await client.send(new DeletePermissionPolicyCommand({ ResourceArn: rgArn }));

  try {
    await client.send(new GetPermissionPolicyCommand({ ResourceArn: rgArn }));
    expect(false).toBe(true);
  } catch (e: unknown) {
    expect((e as Error).name).toBe("WAFNonexistentItemException");
  }

  const gotRg = await client.send(
    new GetRuleGroupCommand({
      Scope: "REGIONAL",
      Name: "bunsai-e2e-policy-rg",
      Id: rgId,
    }),
  );
  await client.send(
    new DeleteRuleGroupCommand({
      Name: "bunsai-e2e-policy-rg",
      Scope: "REGIONAL",
      Id: rgId,
      LockToken: gotRg.LockToken ?? "",
    }),
  );
});

test("WAFv2 APIKey lifecycle", async () => {
  const client = wafv2();

  const created = await client.send(
    new CreateAPIKeyCommand({
      Scope: "REGIONAL",
      TokenDomains: ["example.com", "api.example.com"],
    }),
  );
  expect(created.APIKey).toBeDefined();
  const apiKey = created.APIKey ?? "";

  const listed = await client.send(
    new ListAPIKeysCommand({ Scope: "REGIONAL" }),
  );
  const apiKeys = (listed.APIKeySummaries ?? []).map((k) => k.APIKey);
  expect(apiKeys).toContain(apiKey);
  expect(listed.ApplicationIntegrationURL).toBeDefined();

  const decrypted = await client.send(
    new GetDecryptedAPIKeyCommand({ Scope: "REGIONAL", APIKey: apiKey }),
  );
  expect(decrypted.TokenDomains).toContain("example.com");
  expect(decrypted.TokenDomains).toContain("api.example.com");
  expect(decrypted.CreationTimestamp).toBeDefined();

  await client.send(
    new DeleteAPIKeyCommand({ Scope: "REGIONAL", APIKey: apiKey }),
  );

  const afterDelete = await client.send(
    new ListAPIKeysCommand({ Scope: "REGIONAL" }),
  );
  const afterKeys = (afterDelete.APIKeySummaries ?? []).map((k) => k.APIKey);
  expect(afterKeys).not.toContain(apiKey);
});

test("WAFv2 ManagedRuleSet lifecycle", async () => {
  const client = wafv2();
  const name = "bunsai-e2e-mrs";
  const mrsId = "00000000000000000000000000000001";

  const created = await client.send(
    new PutManagedRuleSetVersionsCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: mrsId,
      LockToken: "initial",
      RecommendedVersion: "1.0",
      VersionsToPublish: {
        "1.0": {
          AssociatedRuleGroupArn:
            "arn:aws:wafv2:us-east-1:123456789012:regional/rulegroup/test/abc",
          ForecastedLifetime: 90,
        },
      },
    }),
  );
  expect(created.NextLockToken).toBeDefined();
  const token = created.NextLockToken ?? "";

  const listed = await client.send(
    new ListManagedRuleSetsCommand({ Scope: "REGIONAL" }),
  );
  expect((listed.ManagedRuleSets ?? []).map((m) => m.Name)).toContain(name);

  const got = await client.send(
    new GetManagedRuleSetCommand({ Name: name, Scope: "REGIONAL", Id: mrsId }),
  );
  expect(got.ManagedRuleSet?.Name).toBe(name);
  expect(got.ManagedRuleSet?.RecommendedVersion).toBe("1.0");
  expect(got.LockToken).toBe(token);

  const expiry = new Date(Date.now() + 86400 * 1000);
  const updated = await client.send(
    new UpdateManagedRuleSetVersionExpiryDateCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: mrsId,
      LockToken: token,
      VersionToExpire: "1.0",
      ExpiryTimestamp: expiry,
    }),
  );
  expect(updated.ExpiringVersion).toBe("1.0");
  expect(updated.NextLockToken).toBeDefined();
  expect(updated.NextLockToken).not.toBe(token);
});

test("WAFv2 static query operations", async () => {
  const client = wafv2();

  const capacity = await client.send(
    new CheckCapacityCommand({ Scope: "REGIONAL", Rules: [] }),
  );
  expect(typeof capacity.Capacity).toBe("number");

  const managedGroups = await client.send(
    new ListAvailableManagedRuleGroupsCommand({ Scope: "REGIONAL" }),
  );
  expect(Array.isArray(managedGroups.ManagedRuleGroups)).toBe(true);

  const versions = await client.send(
    new ListAvailableManagedRuleGroupVersionsCommand({
      VendorName: "AWS",
      Name: "AWSManagedRulesCommonRuleSet",
      Scope: "REGIONAL",
    }),
  );
  expect(Array.isArray(versions.Versions)).toBe(true);

  const allProducts = await client.send(
    new DescribeAllManagedProductsCommand({ Scope: "REGIONAL" }),
  );
  expect(Array.isArray(allProducts.ManagedProducts)).toBe(true);

  const vendorProducts = await client.send(
    new DescribeManagedProductsByVendorCommand({
      VendorName: "AWS",
      Scope: "REGIONAL",
    }),
  );
  expect(Array.isArray(vendorProducts.ManagedProducts)).toBe(true);

  const ruleGroup = await client.send(
    new DescribeManagedRuleGroupCommand({
      VendorName: "AWS",
      Name: "AWSManagedRulesCommonRuleSet",
      Scope: "REGIONAL",
    }),
  );
  expect(typeof ruleGroup.Capacity).toBe("number");

  const mobileSdkReleases = await client.send(
    new ListMobileSdkReleasesCommand({ Platform: "Android" }),
  );
  expect(Array.isArray(mobileSdkReleases.ReleaseSummaries)).toBe(true);

  const mobileSdkRelease = await client.send(
    new GetMobileSdkReleaseCommand({
      Platform: "Android",
      ReleaseVersion: "1.0.0",
    }),
  );
  expect(mobileSdkRelease.MobileSdkRelease?.ReleaseVersion).toBe("1.0.0");

  const mobileSdkUrl = await client.send(
    new GenerateMobileSdkReleaseUrlCommand({
      Platform: "Android",
      ReleaseVersion: "1.0.0",
    }),
  );
  expect(mobileSdkUrl.Url).toBeDefined();
});

test("WAFv2 GetSampledRequests and GetRateBasedStatementManagedKeys", async () => {
  const client = wafv2();

  const acl = await client.send(
    new CreateWebACLCommand({
      Name: "bunsai-e2e-sampled-acl",
      Scope: "REGIONAL",
      DefaultAction: { Allow: {} },
      VisibilityConfig: visibilityConfig,
      Rules: [],
    }),
  );
  const aclArn = acl.Summary?.ARN ?? "";
  const aclId = acl.Summary?.Id ?? "";

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600 * 1000);

  const sampled = await client.send(
    new GetSampledRequestsCommand({
      WebAclArn: aclArn,
      RuleMetricName: "bunsai-e2e-rg-metric",
      Scope: "REGIONAL",
      TimeWindow: { StartTime: oneHourAgo, EndTime: now },
      MaxItems: 100,
    }),
  );
  expect(Array.isArray(sampled.SampledRequests)).toBe(true);
  expect(typeof sampled.PopulationSize).toBe("number");

  const rateKeys = await client.send(
    new GetRateBasedStatementManagedKeysCommand({
      Scope: "REGIONAL",
      WebACLName: "bunsai-e2e-sampled-acl",
      WebACLId: aclId,
      RuleName: "bunsai-rate-rule",
    }),
  );
  expect(Array.isArray(rateKeys.ManagedKeysIPV4?.Addresses)).toBe(true);
  expect(Array.isArray(rateKeys.ManagedKeysIPV6?.Addresses)).toBe(true);

  const topPaths = await client.send(
    new GetTopPathStatisticsByTrafficCommand({
      WebAclArn: aclArn,
      Scope: "REGIONAL",
      TimeWindow: { StartTime: oneHourAgo, EndTime: now },
      Limit: 10,
      NumberOfTopTrafficBotsPerPath: 5,
    }),
  );
  expect(Array.isArray(topPaths.PathStatistics)).toBe(true);
  expect(typeof topPaths.TotalRequestCount).toBe("number");

  const gotAcl = await client.send(
    new GetWebACLCommand({
      Name: "bunsai-e2e-sampled-acl",
      Scope: "REGIONAL",
      Id: aclId,
    }),
  );
  await client
    .send(
      new DeleteFirewallManagerRuleGroupsCommand({
        WebACLArn: aclArn,
        WebACLLockToken: gotAcl.LockToken ?? "",
      }),
    )
    .then((res) => {
      expect(res.NextWebACLLockToken).toBeDefined();
    });
});
