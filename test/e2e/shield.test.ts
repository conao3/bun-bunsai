import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateDRTLogBucketCommand,
  AssociateDRTRoleCommand,
  AssociateHealthCheckCommand,
  AssociateProactiveEngagementDetailsCommand,
  CreateProtectionCommand,
  CreateProtectionGroupCommand,
  CreateSubscriptionCommand,
  DeleteProtectionCommand,
  DeleteProtectionGroupCommand,
  DescribeAttackCommand,
  DescribeAttackStatisticsCommand,
  DescribeDRTAccessCommand,
  DescribeEmergencyContactSettingsCommand,
  DescribeProtectionCommand,
  DescribeProtectionGroupCommand,
  DescribeSubscriptionCommand,
  DisableApplicationLayerAutomaticResponseCommand,
  DisableProactiveEngagementCommand,
  DisassociateDRTLogBucketCommand,
  DisassociateDRTRoleCommand,
  DisassociateHealthCheckCommand,
  EnableApplicationLayerAutomaticResponseCommand,
  EnableProactiveEngagementCommand,
  GetSubscriptionStateCommand,
  ListAttacksCommand,
  ListProtectionGroupsCommand,
  ListProtectionsCommand,
  ListResourcesInProtectionGroupCommand,
  ListTagsForResourceCommand,
  ShieldClient,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateEmergencyContactSettingsCommand,
  UpdateProtectionGroupCommand,
  UpdateSubscriptionCommand,
} from "@aws-sdk/client-shield";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const shield = () =>
  new ShieldClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Shield protection lifecycle", async () => {
  const client = shield();
  const resourceArn = `arn:aws:cloudfront::000000000000:distribution/E1BUNSAI`;

  const created = await client.send(
    new CreateProtectionCommand({
      Name: "bunsai-e2e-protection",
      ResourceArn: resourceArn,
    }),
  );
  expect(typeof created.ProtectionId).toBe("string");
  const protectionId = created.ProtectionId ?? "";

  const described = await client.send(
    new DescribeProtectionCommand({ ProtectionId: protectionId }),
  );
  expect(described.Protection?.Id).toBe(protectionId);
  expect(described.Protection?.Name).toBe("bunsai-e2e-protection");
  expect(described.Protection?.ResourceArn).toBe(resourceArn);
  expect(described.Protection?.ProtectionArn).toContain(protectionId);

  const listed = await client.send(new ListProtectionsCommand({}));
  expect((listed.Protections ?? []).some((p) => p.Id === protectionId)).toBe(
    true,
  );

  await client.send(
    new DeleteProtectionCommand({ ProtectionId: protectionId }),
  );

  await expect(
    client.send(new DescribeProtectionCommand({ ProtectionId: protectionId })),
  ).rejects.toThrow();
});

test("Shield subscription lifecycle", async () => {
  const client = shield();

  const before = await client.send(new GetSubscriptionStateCommand({}));
  expect(before.SubscriptionState).toBe("INACTIVE");

  await client.send(new CreateSubscriptionCommand({}));

  const after = await client.send(new GetSubscriptionStateCommand({}));
  expect(after.SubscriptionState).toBe("ACTIVE");

  const described = await client.send(new DescribeSubscriptionCommand({}));
  expect(described.Subscription?.AutoRenew).toBe("ENABLED");
  expect(described.Subscription?.SubscriptionLimits).toBeDefined();

  await client.send(new UpdateSubscriptionCommand({ AutoRenew: "DISABLED" }));

  const updated = await client.send(new DescribeSubscriptionCommand({}));
  expect(updated.Subscription?.AutoRenew).toBe("DISABLED");

  await expect(
    client.send(new CreateSubscriptionCommand({})),
  ).rejects.toThrow();
});

test("Shield DRT access lifecycle", async () => {
  const client = shield();

  const roleArn = "arn:aws:iam::000000000000:role/test-drt-role";
  const logBucket = "my-test-log-bucket";

  await client.send(new AssociateDRTRoleCommand({ RoleArn: roleArn }));

  const afterRole = await client.send(new DescribeDRTAccessCommand({}));
  expect(afterRole.RoleArn).toBe(roleArn);

  await client.send(new AssociateDRTLogBucketCommand({ LogBucket: logBucket }));

  const afterBucket = await client.send(new DescribeDRTAccessCommand({}));
  expect(afterBucket.LogBucketList).toContain(logBucket);

  await client.send(
    new DisassociateDRTLogBucketCommand({ LogBucket: logBucket }),
  );

  const afterRemoveBucket = await client.send(new DescribeDRTAccessCommand({}));
  expect(afterRemoveBucket.LogBucketList ?? []).not.toContain(logBucket);

  await client.send(new DisassociateDRTRoleCommand({}));

  const afterRemoveRole = await client.send(new DescribeDRTAccessCommand({}));
  expect(afterRemoveRole.RoleArn).toBeUndefined();
});

test("Shield emergency contact settings", async () => {
  const client = shield();

  const contacts = [
    { EmailAddress: "test@example.com", PhoneNumber: "+15555550100" },
  ];

  await client.send(
    new AssociateProactiveEngagementDetailsCommand({
      EmergencyContactList: contacts,
    }),
  );

  const described = await client.send(
    new DescribeEmergencyContactSettingsCommand({}),
  );
  expect(described.EmergencyContactList?.[0]?.EmailAddress).toBe(
    "test@example.com",
  );

  await client.send(
    new UpdateEmergencyContactSettingsCommand({
      EmergencyContactList: [{ EmailAddress: "updated@example.com" }],
    }),
  );

  const updated = await client.send(
    new DescribeEmergencyContactSettingsCommand({}),
  );
  expect(updated.EmergencyContactList?.[0]?.EmailAddress).toBe(
    "updated@example.com",
  );
});

test("Shield proactive engagement lifecycle", async () => {
  const client = shield();

  await client.send(new EnableProactiveEngagementCommand({}));

  const afterEnable = await client.send(new DescribeSubscriptionCommand({}));
  expect(afterEnable.Subscription?.ProactiveEngagementStatus).toBe("ENABLED");

  await client.send(new DisableProactiveEngagementCommand({}));

  const afterDisable = await client.send(new DescribeSubscriptionCommand({}));
  expect(afterDisable.Subscription?.ProactiveEngagementStatus).toBe("DISABLED");
});

test("Shield health check association", async () => {
  const client = shield();
  const resourceArn = `arn:aws:cloudfront::000000000000:distribution/E2HEALTHCHECK`;
  const healthCheckArn = `arn:aws:route53:::healthcheck/12345678-1234-1234-1234-123456789012`;

  const created = await client.send(
    new CreateProtectionCommand({
      Name: "health-check-protection",
      ResourceArn: resourceArn,
    }),
  );
  const protectionId = created.ProtectionId ?? "";

  await client.send(
    new AssociateHealthCheckCommand({
      ProtectionId: protectionId,
      HealthCheckArn: healthCheckArn,
    }),
  );

  const described = await client.send(
    new DescribeProtectionCommand({ ProtectionId: protectionId }),
  );
  expect(described.Protection?.HealthCheckIds).toContain(healthCheckArn);

  await client.send(
    new DisassociateHealthCheckCommand({
      ProtectionId: protectionId,
      HealthCheckArn: healthCheckArn,
    }),
  );

  const afterRemove = await client.send(
    new DescribeProtectionCommand({ ProtectionId: protectionId }),
  );
  expect(afterRemove.Protection?.HealthCheckIds ?? []).not.toContain(
    healthCheckArn,
  );

  await client.send(
    new DeleteProtectionCommand({ ProtectionId: protectionId }),
  );
});

test("Shield application layer automatic response", async () => {
  const client = shield();
  const resourceArn = `arn:aws:cloudfront::000000000000:distribution/E3APPLAUTO`;

  const created = await client.send(
    new CreateProtectionCommand({
      Name: "app-layer-auto-protection",
      ResourceArn: resourceArn,
    }),
  );
  const protectionId = created.ProtectionId ?? "";

  await client.send(
    new EnableApplicationLayerAutomaticResponseCommand({
      ResourceArn: resourceArn,
      Action: { Count: {} },
    }),
  );

  const afterEnable = await client.send(
    new DescribeProtectionCommand({ ProtectionId: protectionId }),
  );
  expect(
    afterEnable.Protection?.ApplicationLayerAutomaticResponseConfiguration
      ?.Status,
  ).toBe("ENABLED");

  await client.send(
    new DisableApplicationLayerAutomaticResponseCommand({
      ResourceArn: resourceArn,
    }),
  );

  const afterDisable = await client.send(
    new DescribeProtectionCommand({ ProtectionId: protectionId }),
  );
  expect(
    afterDisable.Protection?.ApplicationLayerAutomaticResponseConfiguration
      ?.Status,
  ).toBe("DISABLED");

  await client.send(
    new DeleteProtectionCommand({ ProtectionId: protectionId }),
  );
});

test("Shield protection group lifecycle", async () => {
  const client = shield();

  await client.send(
    new CreateProtectionGroupCommand({
      ProtectionGroupId: "e2e-group",
      Aggregation: "SUM",
      Pattern: "ALL",
    }),
  );

  const described = await client.send(
    new DescribeProtectionGroupCommand({ ProtectionGroupId: "e2e-group" }),
  );
  expect(described.ProtectionGroup?.Aggregation).toBe("SUM");
  expect(described.ProtectionGroup?.Pattern).toBe("ALL");

  const listed = await client.send(new ListProtectionGroupsCommand({}));
  expect(
    (listed.ProtectionGroups ?? []).some(
      (g) => g.ProtectionGroupId === "e2e-group",
    ),
  ).toBe(true);

  await client.send(
    new UpdateProtectionGroupCommand({
      ProtectionGroupId: "e2e-group",
      Aggregation: "MAX",
      Pattern: "ALL",
    }),
  );

  const updated = await client.send(
    new DescribeProtectionGroupCommand({ ProtectionGroupId: "e2e-group" }),
  );
  expect(updated.ProtectionGroup?.Aggregation).toBe("MAX");

  const resources = await client.send(
    new ListResourcesInProtectionGroupCommand({
      ProtectionGroupId: "e2e-group",
    }),
  );
  expect(Array.isArray(resources.ResourceArns)).toBe(true);

  await client.send(
    new DeleteProtectionGroupCommand({ ProtectionGroupId: "e2e-group" }),
  );

  await expect(
    client.send(
      new DescribeProtectionGroupCommand({ ProtectionGroupId: "e2e-group" }),
    ),
  ).rejects.toThrow();
});

test("Shield tag operations", async () => {
  const client = shield();
  const resourceArn = `arn:aws:cloudfront::000000000000:distribution/E4TAGS`;

  const created = await client.send(
    new CreateProtectionCommand({
      Name: "tag-test-protection",
      ResourceArn: resourceArn,
    }),
  );
  const protectionId = created.ProtectionId ?? "";
  const protectionArn = `arn:aws:shield::000000000000:protection/${protectionId}`;

  await client.send(
    new TagResourceCommand({
      ResourceARN: protectionArn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "owner", Value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: protectionArn }),
  );
  expect(
    (listed.Tags ?? []).some((t) => t.Key === "env" && t.Value === "test"),
  ).toBe(true);
  expect((listed.Tags ?? []).some((t) => t.Key === "owner")).toBe(true);

  await client.send(
    new UntagResourceCommand({
      ResourceARN: protectionArn,
      TagKeys: ["owner"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: protectionArn }),
  );
  expect((afterUntag.Tags ?? []).some((t) => t.Key === "owner")).toBe(false);
  expect((afterUntag.Tags ?? []).some((t) => t.Key === "env")).toBe(true);

  await client.send(
    new DeleteProtectionCommand({ ProtectionId: protectionId }),
  );
});

test("Shield attack operations (synthetic)", async () => {
  const client = shield();

  const listResult = await client.send(new ListAttacksCommand({}));
  expect(Array.isArray(listResult.AttackSummaries)).toBe(true);

  const filteredResult = await client.send(
    new ListAttacksCommand({
      ResourceArns: ["arn:aws:cloudfront::000000000000:distribution/ETEST"],
      StartTime: { FromInclusive: new Date(0) },
      EndTime: { ToExclusive: new Date() },
    }),
  );
  expect(Array.isArray(filteredResult.AttackSummaries)).toBe(true);

  const statsResult = await client.send(
    new DescribeAttackStatisticsCommand({}),
  );
  expect(Array.isArray(statsResult.DataItems)).toBe(true);
  expect(statsResult.DataItems?.length).toBeGreaterThan(0);
  expect(statsResult.TimeRange).toBeDefined();

  const attackResult = await client.send(
    new DescribeAttackCommand({ AttackId: "test-attack-id" }),
  );
  expect(attackResult.Attack?.AttackId).toBe("test-attack-id");
  expect(attackResult.Attack?.StartTime).toBeDefined();
  expect(attackResult.Attack?.EndTime).toBeDefined();
});

test("Shield ListProtections pagination and filters", async () => {
  const client = shield();
  const arns = [
    "arn:aws:cloudfront::000000000000:distribution/EPAG1",
    "arn:aws:cloudfront::000000000000:distribution/EPAG2",
    "arn:aws:cloudfront::000000000000:distribution/EPAG3",
  ];
  const ids: string[] = [];

  for (let i = 0; i < arns.length; i++) {
    const r = await client.send(
      new CreateProtectionCommand({ Name: `pag-${i}`, ResourceArn: arns[i] }),
    );
    ids.push(r.ProtectionId ?? "");
  }

  const page1 = await client.send(
    new ListProtectionsCommand({ MaxResults: 2 }),
  );
  const page1Count = (page1.Protections ?? []).filter((p) =>
    arns.includes(p.ResourceArn ?? ""),
  ).length;
  expect(page1Count).toBeLessThanOrEqual(2);

  const byName = await client.send(
    new ListProtectionsCommand({
      InclusionFilters: { ProtectionNames: ["pag-0"] },
    }),
  );
  expect((byName.Protections ?? []).some((p) => p.Name === "pag-0")).toBe(true);
  expect((byName.Protections ?? []).every((p) => p.Name === "pag-0")).toBe(
    true,
  );

  const byArn = await client.send(
    new ListProtectionsCommand({
      InclusionFilters: { ResourceArns: [arns[1]] },
    }),
  );
  expect((byArn.Protections ?? []).some((p) => p.ResourceArn === arns[1])).toBe(
    true,
  );

  for (const id of ids) {
    await client.send(new DeleteProtectionCommand({ ProtectionId: id }));
  }
});

test("Shield ListProtectionGroups pagination and filters", async () => {
  const client = shield();

  await client.send(
    new CreateProtectionGroupCommand({
      ProtectionGroupId: "pg-filter-1",
      Aggregation: "SUM",
      Pattern: "ALL",
    }),
  );
  await client.send(
    new CreateProtectionGroupCommand({
      ProtectionGroupId: "pg-filter-2",
      Aggregation: "MAX",
      Pattern: "ALL",
    }),
  );

  const byId = await client.send(
    new ListProtectionGroupsCommand({
      InclusionFilters: { ProtectionGroupIds: ["pg-filter-1"] },
    }),
  );
  expect(
    (byId.ProtectionGroups ?? []).some(
      (g) => g.ProtectionGroupId === "pg-filter-1",
    ),
  ).toBe(true);
  expect(
    (byId.ProtectionGroups ?? []).every(
      (g) => g.ProtectionGroupId === "pg-filter-1",
    ),
  ).toBe(true);

  const byAgg = await client.send(
    new ListProtectionGroupsCommand({
      InclusionFilters: { Aggregations: ["MAX"] },
    }),
  );
  expect(
    (byAgg.ProtectionGroups ?? []).every((g) => g.Aggregation === "MAX"),
  ).toBe(true);

  const page1 = await client.send(
    new ListProtectionGroupsCommand({ MaxResults: 1 }),
  );
  const page1Count = (page1.ProtectionGroups ?? []).filter((g) =>
    ["pg-filter-1", "pg-filter-2"].includes(g.ProtectionGroupId ?? ""),
  ).length;
  expect(page1Count).toBeLessThanOrEqual(1);

  await client.send(
    new DeleteProtectionGroupCommand({ ProtectionGroupId: "pg-filter-1" }),
  );
  await client.send(
    new DeleteProtectionGroupCommand({ ProtectionGroupId: "pg-filter-2" }),
  );
});

test("Shield DeleteProtection clears tags", async () => {
  const client = shield();
  const resourceArn = "arn:aws:cloudfront::000000000000:distribution/ETAGCLEAN";

  const created = await client.send(
    new CreateProtectionCommand({
      Name: "tag-cleanup-protection",
      ResourceArn: resourceArn,
    }),
  );
  const protectionId = created.ProtectionId ?? "";
  const protectionArn = `arn:aws:shield::000000000000:protection/${protectionId}`;

  await client.send(
    new TagResourceCommand({
      ResourceARN: protectionArn,
      Tags: [{ Key: "cleanup", Value: "yes" }],
    }),
  );

  const before = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: protectionArn }),
  );
  expect((before.Tags ?? []).some((t) => t.Key === "cleanup")).toBe(true);

  await client.send(
    new DeleteProtectionCommand({ ProtectionId: protectionId }),
  );

  await expect(
    client.send(new ListTagsForResourceCommand({ ResourceARN: protectionArn })),
  ).rejects.toThrow(/Shield resource not found/);
});

test("Shield CreateProtectionGroup rejects invalid Pattern/Members/ResourceType combinations", async () => {
  const client = shield();

  await expect(
    client.send(
      new CreateProtectionGroupCommand({
        ProtectionGroupId: "bad-arbitrary-empty",
        Aggregation: "SUM",
        Pattern: "ARBITRARY",
      }),
    ),
  ).rejects.toThrow(/Pattern|Members|ResourceType/);

  await expect(
    client.send(
      new CreateProtectionGroupCommand({
        ProtectionGroupId: "bad-by-resource-type",
        Aggregation: "SUM",
        Pattern: "BY_RESOURCE_TYPE",
      }),
    ),
  ).rejects.toThrow(/Pattern|Members|ResourceType/);

  await expect(
    client.send(
      new CreateProtectionGroupCommand({
        ProtectionGroupId: "bad-all-members",
        Aggregation: "SUM",
        Pattern: "ALL",
        Members: ["arn:aws:cloudfront::000000000000:distribution/EAAA"],
      }),
    ),
  ).rejects.toThrow(/Pattern|Members|ResourceType/);

  await client.send(
    new CreateProtectionGroupCommand({
      ProtectionGroupId: "good-by-resource-type",
      Aggregation: "MEAN",
      Pattern: "BY_RESOURCE_TYPE",
      ResourceType: "CLOUDFRONT_DISTRIBUTION",
    }),
  );

  await expect(
    client.send(
      new UpdateProtectionGroupCommand({
        ProtectionGroupId: "good-by-resource-type",
        Aggregation: "MEAN",
        Pattern: "ARBITRARY",
        Members: [],
      }),
    ),
  ).rejects.toThrow(/Pattern|Members|ResourceType/);

  await client.send(
    new DeleteProtectionGroupCommand({
      ProtectionGroupId: "good-by-resource-type",
    }),
  );
});

test("Shield ListResourcesInProtectionGroup paginates with MaxResults and NextToken", async () => {
  const client = shield();
  const members = Array.from(
    { length: 5 },
    (_, i) => `arn:aws:cloudfront::000000000000:distribution/EPG${i}`,
  );

  await client.send(
    new CreateProtectionGroupCommand({
      ProtectionGroupId: "page-group",
      Aggregation: "SUM",
      Pattern: "ARBITRARY",
      Members: members,
    }),
  );

  const page1 = await client.send(
    new ListResourcesInProtectionGroupCommand({
      ProtectionGroupId: "page-group",
      MaxResults: 2,
    }),
  );
  expect((page1.ResourceArns ?? []).length).toBe(2);
  expect(typeof page1.NextToken).toBe("string");

  const page2 = await client.send(
    new ListResourcesInProtectionGroupCommand({
      ProtectionGroupId: "page-group",
      MaxResults: 2,
      NextToken: page1.NextToken,
    }),
  );
  expect((page2.ResourceArns ?? []).length).toBe(2);

  await client.send(
    new DeleteProtectionGroupCommand({ ProtectionGroupId: "page-group" }),
  );
});

test("Shield tag operations reject unknown resource ARN", async () => {
  const client = shield();
  const bogusArn = "arn:aws:shield::000000000000:protection/does-not-exist";

  await expect(
    client.send(
      new TagResourceCommand({
        ResourceARN: bogusArn,
        Tags: [{ Key: "k", Value: "v" }],
      }),
    ),
  ).rejects.toThrow(/Shield resource not found/);

  await expect(
    client.send(new ListTagsForResourceCommand({ ResourceARN: bogusArn })),
  ).rejects.toThrow(/Shield resource not found/);

  await expect(
    client.send(
      new UntagResourceCommand({ ResourceARN: bogusArn, TagKeys: ["k"] }),
    ),
  ).rejects.toThrow(/Shield resource not found/);

  await expect(
    client.send(
      new TagResourceCommand({
        ResourceARN: "not-an-arn",
        Tags: [{ Key: "k", Value: "v" }],
      }),
    ),
  ).rejects.toThrow(/Shield resource not found/);
});
