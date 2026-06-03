import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import shieldModel from "../../../../test/vendor/aws-models/shield.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(shieldModel);

type StoredProtection = {
  Id: string;
  Name: string;
  ResourceArn: string;
  HealthCheckIds: string[];
  ProtectionArn: string;
  ApplicationLayerAutomaticResponseConfiguration?: {
    Status: string;
    Action: unknown;
  };
};

type StoredProtectionGroup = {
  ProtectionGroupId: string;
  Aggregation: string;
  Pattern: string;
  ResourceType?: string;
  Members: string[];
  ProtectionGroupArn: string;
};

type StoredSubscription = {
  StartTime: number;
  AutoRenew: string;
  ProactiveEngagementStatus: string;
};

type StoredDRTAccess = {
  RoleArn?: string;
  LogBucketList: string[];
};

type StoredEmergencyContacts = {
  EmergencyContactList: {
    EmailAddress: string;
    PhoneNumber?: string;
    ContactNotes?: string;
  }[];
};

type StoredTags = {
  Tags: { Key: string; Value: string }[];
};

const protectionKey = (id: string): string => `protection/${id}`;
const protectionGroupKey = (id: string): string => `protection-group/${id}`;
const subscriptionKey = (): string => `subscription`;
const drtAccessKey = (): string => `drt-access`;
const emergencyContactsKey = (): string => `emergency-contacts`;
const tagKey = (arn: string): string => `tags/${arn}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidParameterException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const protectionArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:shield::${ctx.account}:protection/${id}`;

const protectionGroupArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:shield::${ctx.account}:protection-group/${id}`;

const requireProtection = (
  ctx: ServiceContext,
  id: string,
): StoredProtection => {
  const protection = ctx.store.get<StoredProtection>(protectionKey(id));
  if (protection === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Protection not found: ${id}`,
      400,
    );
  }
  return protection;
};

const requireProtectionGroup = (
  ctx: ServiceContext,
  id: string,
): StoredProtectionGroup => {
  const group = ctx.store.get<StoredProtectionGroup>(protectionGroupKey(id));
  if (group === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Protection group not found: ${id}`,
      400,
    );
  }
  return group;
};

const requireSubscription = (ctx: ServiceContext): StoredSubscription => {
  const subscription = ctx.store.get<StoredSubscription>(subscriptionKey());
  if (subscription === undefined) {
    throw awsError("ResourceNotFoundException", `Subscription not found.`, 400);
  }
  return subscription;
};

const findProtectionByArn = (
  ctx: ServiceContext,
  resourceArn: string,
): StoredProtection | undefined =>
  ctx.store
    .list<StoredProtection>()
    .filter((entry) => entry.key.startsWith("protection/"))
    .map((entry) => entry.value)
    .find((p) => p.ResourceArn === resourceArn);

const getOrCreateDRTAccess = (ctx: ServiceContext): StoredDRTAccess => {
  const existing = ctx.store.get<StoredDRTAccess>(drtAccessKey());
  return existing ?? { LogBucketList: [] };
};

const getOrCreateEmergencyContacts = (
  ctx: ServiceContext,
): StoredEmergencyContacts => {
  const existing = ctx.store.get<StoredEmergencyContacts>(
    emergencyContactsKey(),
  );
  return existing ?? { EmergencyContactList: [] };
};

const getOrCreateTags = (ctx: ServiceContext, arn: string): StoredTags => {
  const existing = ctx.store.get<StoredTags>(tagKey(arn));
  return existing ?? { Tags: [] };
};

const subscriptionLimits = () => ({
  ProtectionLimits: {
    ProtectedResourceTypeLimits: [
      { Type: "CLOUDFRONT_DISTRIBUTION", Max: 1000 },
      { Type: "ROUTE_53_HOSTED_ZONE", Max: 1000 },
    ],
  },
  ProtectionGroupLimits: {
    MaxProtectionGroups: 100,
    PatternTypeLimits: {
      ArbitraryPatternLimits: { MaxMembers: 10000 },
    },
  },
});

const CreateProtection: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const resourceArn = requireString(input, "ResourceArn");
  const existing = findProtectionByArn(ctx, resourceArn);
  if (existing !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Protection already exists for resource: ${resourceArn}`,
      400,
    );
  }
  const id = crypto.randomUUID();
  const protection: StoredProtection = {
    Id: id,
    Name: name,
    ResourceArn: resourceArn,
    HealthCheckIds: [],
    ProtectionArn: protectionArn(ctx, id),
  };
  ctx.store.set(protectionKey(id), protection);
  const tags = Array.isArray(input["Tags"])
    ? (input["Tags"] as { Key: string; Value: string }[])
    : [];
  if (tags.length > 0) {
    ctx.store.set(tagKey(protection.ProtectionArn), { Tags: tags });
  }
  return { ProtectionId: id };
};

const DescribeProtection: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["ProtectionId"]);
  const resourceArn = stringOrUndefined(input["ResourceArn"]);
  if (id !== undefined) {
    return { Protection: requireProtection(ctx, id) };
  }
  if (resourceArn !== undefined) {
    const protection = findProtectionByArn(ctx, resourceArn);
    if (protection === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `Protection not found for resource: ${resourceArn}`,
        400,
      );
    }
    return { Protection: protection };
  }
  throw awsError(
    "InvalidParameterException",
    "You must provide either ProtectionId or ResourceArn.",
    400,
  );
};

const ListProtections: OperationHandler = (_input, ctx) => {
  const protections = ctx.store
    .list<StoredProtection>()
    .filter((entry) => entry.key.startsWith("protection/"))
    .map((entry) => entry.value);
  return { Protections: protections };
};

const DeleteProtection: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ProtectionId");
  requireProtection(ctx, id);
  ctx.store.delete(protectionKey(id));
  return {};
};

const AssociateDRTLogBucket: OperationHandler = (input, ctx) => {
  const logBucket = requireString(input, "LogBucket");
  const access = getOrCreateDRTAccess(ctx);
  if (!access.LogBucketList.includes(logBucket)) {
    access.LogBucketList.push(logBucket);
  }
  ctx.store.set(drtAccessKey(), access);
  return {};
};

const AssociateDRTRole: OperationHandler = (input, ctx) => {
  const roleArn = requireString(input, "RoleArn");
  const access = getOrCreateDRTAccess(ctx);
  access.RoleArn = roleArn;
  ctx.store.set(drtAccessKey(), access);
  return {};
};

const AssociateHealthCheck: OperationHandler = (input, ctx) => {
  const protectionId = requireString(input, "ProtectionId");
  const healthCheckArn = requireString(input, "HealthCheckArn");
  const protection = requireProtection(ctx, protectionId);
  if (!protection.HealthCheckIds.includes(healthCheckArn)) {
    protection.HealthCheckIds.push(healthCheckArn);
  }
  ctx.store.set(protectionKey(protectionId), protection);
  return {};
};

const AssociateProactiveEngagementDetails: OperationHandler = (input, ctx) => {
  const contacts = Array.isArray(input["EmergencyContactList"])
    ? (input["EmergencyContactList"] as {
        EmailAddress: string;
        PhoneNumber?: string;
        ContactNotes?: string;
      }[])
    : [];
  ctx.store.set(emergencyContactsKey(), { EmergencyContactList: contacts });
  return {};
};

const CreateProtectionGroup: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "ProtectionGroupId");
  const aggregation = requireString(input, "Aggregation");
  const pattern = requireString(input, "Pattern");
  const existing = ctx.store.get<StoredProtectionGroup>(
    protectionGroupKey(groupId),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Protection group already exists: ${groupId}`,
      400,
    );
  }
  const resourceType = stringOrUndefined(input["ResourceType"]);
  const members = Array.isArray(input["Members"])
    ? (input["Members"] as string[])
    : [];
  const group: StoredProtectionGroup = {
    ProtectionGroupId: groupId,
    Aggregation: aggregation,
    Pattern: pattern,
    Members: members,
    ProtectionGroupArn: protectionGroupArn(ctx, groupId),
    ...(resourceType !== undefined ? { ResourceType: resourceType } : {}),
  };
  ctx.store.set(protectionGroupKey(groupId), group);
  const tags = Array.isArray(input["Tags"])
    ? (input["Tags"] as { Key: string; Value: string }[])
    : [];
  if (tags.length > 0) {
    ctx.store.set(tagKey(group.ProtectionGroupArn), { Tags: tags });
  }
  return {};
};

const CreateSubscription: OperationHandler = (_input, ctx) => {
  const existing = ctx.store.get<StoredSubscription>(subscriptionKey());
  if (existing !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Subscription already exists.`,
      400,
    );
  }
  const subscription: StoredSubscription = {
    StartTime: Date.now() / 1000,
    AutoRenew: "ENABLED",
    ProactiveEngagementStatus: "DISABLED",
  };
  ctx.store.set(subscriptionKey(), subscription);
  return {};
};

const DeleteProtectionGroup: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "ProtectionGroupId");
  requireProtectionGroup(ctx, groupId);
  ctx.store.delete(protectionGroupKey(groupId));
  return {};
};

const DeleteSubscription: OperationHandler = (_input, ctx) => {
  requireSubscription(ctx);
  ctx.store.delete(subscriptionKey());
  return {};
};

const DescribeAttack: OperationHandler = (input, _ctx) => {
  const attackId = requireString(input, "AttackId");
  return {
    Attack: {
      AttackId: attackId,
      SubResources: [],
      AttackCounters: [],
      AttackProperties: [],
      Mitigations: [],
    },
  };
};

const DescribeAttackStatistics: OperationHandler = (_input, _ctx) => ({
  TimeRange: {},
  DataItems: [{ AttackCount: 0 }],
});

const DescribeDRTAccess: OperationHandler = (_input, ctx) => {
  const access = getOrCreateDRTAccess(ctx);
  return {
    ...(access.RoleArn !== undefined ? { RoleArn: access.RoleArn } : {}),
    LogBucketList: access.LogBucketList,
  };
};

const DescribeEmergencyContactSettings: OperationHandler = (_input, ctx) => {
  const contacts = getOrCreateEmergencyContacts(ctx);
  return { EmergencyContactList: contacts.EmergencyContactList };
};

const DescribeProtectionGroup: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "ProtectionGroupId");
  const group = requireProtectionGroup(ctx, groupId);
  return { ProtectionGroup: group };
};

const DescribeSubscription: OperationHandler = (_input, ctx) => {
  const subscription = requireSubscription(ctx);
  return {
    Subscription: {
      StartTime: subscription.StartTime,
      AutoRenew: subscription.AutoRenew,
      ProactiveEngagementStatus: subscription.ProactiveEngagementStatus,
      SubscriptionLimits: subscriptionLimits(),
      SubscriptionArn: `arn:aws:shield::${ctx.account}:subscription`,
    },
  };
};

const DisableApplicationLayerAutomaticResponse: OperationHandler = (
  input,
  ctx,
) => {
  const resourceArn = requireString(input, "ResourceArn");
  const protection = findProtectionByArn(ctx, resourceArn);
  if (protection === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Protection not found for resource: ${resourceArn}`,
      400,
    );
  }
  protection.ApplicationLayerAutomaticResponseConfiguration = {
    Status: "DISABLED",
    Action: protection.ApplicationLayerAutomaticResponseConfiguration
      ?.Action ?? { Count: {} },
  };
  ctx.store.set(protectionKey(protection.Id), protection);
  return {};
};

const DisableProactiveEngagement: OperationHandler = (_input, ctx) => {
  const subscription = requireSubscription(ctx);
  subscription.ProactiveEngagementStatus = "DISABLED";
  ctx.store.set(subscriptionKey(), subscription);
  return {};
};

const DisassociateDRTLogBucket: OperationHandler = (input, ctx) => {
  const logBucket = requireString(input, "LogBucket");
  const access = getOrCreateDRTAccess(ctx);
  access.LogBucketList = access.LogBucketList.filter((b) => b !== logBucket);
  ctx.store.set(drtAccessKey(), access);
  return {};
};

const DisassociateDRTRole: OperationHandler = (_input, ctx) => {
  const access = getOrCreateDRTAccess(ctx);
  delete access.RoleArn;
  ctx.store.set(drtAccessKey(), access);
  return {};
};

const DisassociateHealthCheck: OperationHandler = (input, ctx) => {
  const protectionId = requireString(input, "ProtectionId");
  const healthCheckArn = requireString(input, "HealthCheckArn");
  const protection = requireProtection(ctx, protectionId);
  protection.HealthCheckIds = protection.HealthCheckIds.filter(
    (id) => id !== healthCheckArn,
  );
  ctx.store.set(protectionKey(protectionId), protection);
  return {};
};

const EnableApplicationLayerAutomaticResponse: OperationHandler = (
  input,
  ctx,
) => {
  const resourceArn = requireString(input, "ResourceArn");
  const action = input["Action"] as unknown;
  const protection = findProtectionByArn(ctx, resourceArn);
  if (protection === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Protection not found for resource: ${resourceArn}`,
      400,
    );
  }
  protection.ApplicationLayerAutomaticResponseConfiguration = {
    Status: "ENABLED",
    Action: action,
  };
  ctx.store.set(protectionKey(protection.Id), protection);
  return {};
};

const EnableProactiveEngagement: OperationHandler = (_input, ctx) => {
  const subscription = requireSubscription(ctx);
  subscription.ProactiveEngagementStatus = "ENABLED";
  ctx.store.set(subscriptionKey(), subscription);
  return {};
};

const GetSubscriptionState: OperationHandler = (_input, ctx) => {
  const subscription = ctx.store.get<StoredSubscription>(subscriptionKey());
  return {
    SubscriptionState: subscription !== undefined ? "ACTIVE" : "INACTIVE",
  };
};

const ListAttacks: OperationHandler = (_input, _ctx) => ({
  AttackSummaries: [],
});

const ListProtectionGroups: OperationHandler = (_input, ctx) => {
  const groups = ctx.store
    .list<StoredProtectionGroup>()
    .filter((entry) => entry.key.startsWith("protection-group/"))
    .map((entry) => entry.value);
  return { ProtectionGroups: groups };
};

const ListResourcesInProtectionGroup: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "ProtectionGroupId");
  const group = requireProtectionGroup(ctx, groupId);
  let resourceArns: string[];
  if (group.Pattern === "ARBITRARY") {
    resourceArns = group.Members;
  } else if (group.Pattern === "ALL") {
    resourceArns = ctx.store
      .list<StoredProtection>()
      .filter((entry) => entry.key.startsWith("protection/"))
      .map((entry) => entry.value.ResourceArn);
  } else {
    resourceArns = ctx.store
      .list<StoredProtection>()
      .filter((entry) => entry.key.startsWith("protection/"))
      .map((entry) => entry.value)
      .filter(
        (p) =>
          group.ResourceType !== undefined &&
          p.ResourceArn.includes(group.ResourceType.toLowerCase()),
      )
      .map((p) => p.ResourceArn);
  }
  return { ResourceArns: resourceArns };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const stored = getOrCreateTags(ctx, resourceArn);
  return { Tags: stored.Tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const newTags = Array.isArray(input["Tags"])
    ? (input["Tags"] as { Key: string; Value: string }[])
    : [];
  const stored = getOrCreateTags(ctx, resourceArn);
  for (const tag of newTags) {
    const idx = stored.Tags.findIndex((t) => t.Key === tag.Key);
    if (idx >= 0) {
      stored.Tags[idx] = tag;
    } else {
      stored.Tags.push(tag);
    }
  }
  ctx.store.set(tagKey(resourceArn), stored);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[])
    : [];
  const stored = getOrCreateTags(ctx, resourceArn);
  stored.Tags = stored.Tags.filter((t) => !tagKeys.includes(t.Key));
  ctx.store.set(tagKey(resourceArn), stored);
  return {};
};

const UpdateApplicationLayerAutomaticResponse: OperationHandler = (
  input,
  ctx,
) => {
  const resourceArn = requireString(input, "ResourceArn");
  const action = input["Action"] as unknown;
  const protection = findProtectionByArn(ctx, resourceArn);
  if (protection === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Protection not found for resource: ${resourceArn}`,
      400,
    );
  }
  protection.ApplicationLayerAutomaticResponseConfiguration = {
    Status:
      protection.ApplicationLayerAutomaticResponseConfiguration?.Status ??
      "ENABLED",
    Action: action,
  };
  ctx.store.set(protectionKey(protection.Id), protection);
  return {};
};

const UpdateEmergencyContactSettings: OperationHandler = (input, ctx) => {
  const contacts = Array.isArray(input["EmergencyContactList"])
    ? (input["EmergencyContactList"] as {
        EmailAddress: string;
        PhoneNumber?: string;
        ContactNotes?: string;
      }[])
    : [];
  ctx.store.set(emergencyContactsKey(), { EmergencyContactList: contacts });
  return {};
};

const UpdateProtectionGroup: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "ProtectionGroupId");
  const group = requireProtectionGroup(ctx, groupId);
  group.Aggregation = requireString(input, "Aggregation");
  group.Pattern = requireString(input, "Pattern");
  const resourceType = stringOrUndefined(input["ResourceType"]);
  if (resourceType !== undefined) {
    group.ResourceType = resourceType;
  } else {
    delete group.ResourceType;
  }
  group.Members = Array.isArray(input["Members"])
    ? (input["Members"] as string[])
    : [];
  ctx.store.set(protectionGroupKey(groupId), group);
  return {};
};

const UpdateSubscription: OperationHandler = (input, ctx) => {
  const subscription = requireSubscription(ctx);
  const autoRenew = stringOrUndefined(input["AutoRenew"]);
  if (autoRenew !== undefined) {
    subscription.AutoRenew = autoRenew;
  }
  ctx.store.set(subscriptionKey(), subscription);
  return {};
};

const shield = {
  name: "shield",
  protocol: "json",
  operations: {
    AssociateDRTLogBucket,
    AssociateDRTRole,
    AssociateHealthCheck,
    AssociateProactiveEngagementDetails,
    CreateProtection,
    CreateProtectionGroup,
    CreateSubscription,
    DeleteProtection,
    DeleteProtectionGroup,
    DeleteSubscription,
    DescribeAttack,
    DescribeAttackStatistics,
    DescribeDRTAccess,
    DescribeEmergencyContactSettings,
    DescribeProtection,
    DescribeProtectionGroup,
    DescribeSubscription,
    DisableApplicationLayerAutomaticResponse,
    DisableProactiveEngagement,
    DisassociateDRTLogBucket,
    DisassociateDRTRole,
    DisassociateHealthCheck,
    EnableApplicationLayerAutomaticResponse,
    EnableProactiveEngagement,
    GetSubscriptionState,
    ListAttacks,
    ListProtectionGroups,
    ListProtections,
    ListResourcesInProtectionGroup,
    ListTagsForResource,
    TagResource,
    UntagResource,
    UpdateApplicationLayerAutomaticResponse,
    UpdateEmergencyContactSettings,
    UpdateProtectionGroup,
    UpdateSubscription,
  },
  model,
} as const satisfies ServiceDefinition;

export default shield;
