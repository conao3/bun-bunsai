import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import cloudtrailModel from "../../../../test/vendor/aws-models/cloudtrail.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(cloudtrailModel);

type StoredTrail = {
  Name: string;
  S3BucketName: string;
  S3KeyPrefix?: string;
  SnsTopicName?: string;
  SnsTopicARN?: string;
  IncludeGlobalServiceEvents: boolean;
  IsMultiRegionTrail: boolean;
  HomeRegion: string;
  TrailARN: string;
  LogFileValidationEnabled: boolean;
  CloudWatchLogsLogGroupArn?: string;
  CloudWatchLogsRoleArn?: string;
  KmsKeyId?: string;
  HasCustomEventSelectors: boolean;
  HasInsightSelectors: boolean;
  IsOrganizationTrail: boolean;
  isLogging: boolean;
  startLoggingTime?: number;
  stopLoggingTime?: number;
};

const trailKey = (name: string): string => `trail/${name}`;

const selectorsKey = (name: string): string => `selectors/${name}`;

const tagsKey = (arn: string): string => `tags/${arn}`;

type StoredSelectors = {
  EventSelectors?: unknown[];
  AdvancedEventSelectors?: unknown[];
};

type StoredTag = {
  Key: string;
  Value?: string;
};

const trailArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:cloudtrail:${region}:${account}:trail/${name}`;

const snsTopicArnOf = (
  region: string,
  account: string,
  topic: string,
): string => `arn:aws:sns:${region}:${account}:${topic}`;

const nameFromArn = (value: string): string => {
  const slash = value.split("/");
  return slash[slash.length - 1] ?? value;
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError(
      "InvalidParameterCombinationException",
      `${key} is required.`,
      400,
    );
  }
  return value;
};

const resolveName = (input: Record<string, unknown>): string => {
  const value = input["Name"];
  if (typeof value !== "string" || value === "") {
    throw awsError("TrailNotFoundException", "Name is required.", 400);
  }
  return value.startsWith("arn:") ? nameFromArn(value) : value;
};

const requireTrail = (ctx: ServiceContext, name: string): StoredTrail => {
  const trail = ctx.store.get<StoredTrail>(trailKey(name));
  if (trail === undefined) {
    throw awsError(
      "TrailNotFoundException",
      `Unknown trail: ${name} for the user: ${ctx.account}`,
      400,
    );
  }
  return trail;
};

const booleanOf = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const trailView = (trail: StoredTrail): Record<string, unknown> => ({
  Name: trail.Name,
  S3BucketName: trail.S3BucketName,
  S3KeyPrefix: trail.S3KeyPrefix,
  SnsTopicName: trail.SnsTopicName,
  SnsTopicARN: trail.SnsTopicARN,
  IncludeGlobalServiceEvents: trail.IncludeGlobalServiceEvents,
  IsMultiRegionTrail: trail.IsMultiRegionTrail,
  HomeRegion: trail.HomeRegion,
  TrailARN: trail.TrailARN,
  LogFileValidationEnabled: trail.LogFileValidationEnabled,
  CloudWatchLogsLogGroupArn: trail.CloudWatchLogsLogGroupArn,
  CloudWatchLogsRoleArn: trail.CloudWatchLogsRoleArn,
  KmsKeyId: trail.KmsKeyId,
  HasCustomEventSelectors: trail.HasCustomEventSelectors,
  HasInsightSelectors: trail.HasInsightSelectors,
  IsOrganizationTrail: trail.IsOrganizationTrail,
});

const CreateTrail: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const bucket = requireString(input, "S3BucketName");
  const existing = ctx.store.get<StoredTrail>(trailKey(name));
  if (existing !== undefined) {
    throw awsError(
      "TrailAlreadyExistsException",
      `Trail ${name} already exists for customer: ${ctx.account}`,
      400,
    );
  }
  const snsTopicName =
    typeof input["SnsTopicName"] === "string"
      ? (input["SnsTopicName"] as string)
      : undefined;
  const trail: StoredTrail = {
    Name: name,
    S3BucketName: bucket,
    S3KeyPrefix:
      typeof input["S3KeyPrefix"] === "string"
        ? (input["S3KeyPrefix"] as string)
        : undefined,
    SnsTopicName: snsTopicName,
    SnsTopicARN:
      snsTopicName === undefined
        ? undefined
        : snsTopicArnOf(ctx.region, ctx.account, snsTopicName),
    IncludeGlobalServiceEvents: booleanOf(
      input["IncludeGlobalServiceEvents"],
      true,
    ),
    IsMultiRegionTrail: booleanOf(input["IsMultiRegionTrail"], false),
    HomeRegion: ctx.region,
    TrailARN: trailArnOf(ctx.region, ctx.account, name),
    LogFileValidationEnabled: booleanOf(
      input["EnableLogFileValidation"],
      false,
    ),
    CloudWatchLogsLogGroupArn:
      typeof input["CloudWatchLogsLogGroupArn"] === "string"
        ? (input["CloudWatchLogsLogGroupArn"] as string)
        : undefined,
    CloudWatchLogsRoleArn:
      typeof input["CloudWatchLogsRoleArn"] === "string"
        ? (input["CloudWatchLogsRoleArn"] as string)
        : undefined,
    KmsKeyId:
      typeof input["KmsKeyId"] === "string"
        ? (input["KmsKeyId"] as string)
        : undefined,
    HasCustomEventSelectors: false,
    HasInsightSelectors: false,
    IsOrganizationTrail: booleanOf(input["IsOrganizationTrail"], false),
    isLogging: false,
  };
  ctx.store.set(trailKey(name), trail);
  return {
    Name: trail.Name,
    S3BucketName: trail.S3BucketName,
    S3KeyPrefix: trail.S3KeyPrefix,
    SnsTopicName: trail.SnsTopicName,
    SnsTopicARN: trail.SnsTopicARN,
    IncludeGlobalServiceEvents: trail.IncludeGlobalServiceEvents,
    IsMultiRegionTrail: trail.IsMultiRegionTrail,
    TrailARN: trail.TrailARN,
    LogFileValidationEnabled: trail.LogFileValidationEnabled,
    CloudWatchLogsLogGroupArn: trail.CloudWatchLogsLogGroupArn,
    CloudWatchLogsRoleArn: trail.CloudWatchLogsRoleArn,
    KmsKeyId: trail.KmsKeyId,
    IsOrganizationTrail: trail.IsOrganizationTrail,
  };
};

const GetTrail: OperationHandler = (input, ctx) => {
  const name = resolveName(input);
  const trail = requireTrail(ctx, name);
  return { Trail: trailView(trail) };
};

const listTrails = (ctx: ServiceContext): StoredTrail[] =>
  ctx.store
    .list<StoredTrail>()
    .filter((entry) => entry.key.startsWith("trail/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));

const ListTrails: OperationHandler = (_input, ctx) => {
  const trails = listTrails(ctx);
  return {
    Trails: trails.map((trail) => ({
      TrailARN: trail.TrailARN,
      Name: trail.Name,
      HomeRegion: trail.HomeRegion,
    })),
  };
};

const DescribeTrails: OperationHandler = (input, ctx) => {
  const filter = Array.isArray(input["trailNameList"])
    ? (input["trailNameList"] as unknown[]).map((value) =>
        typeof value === "string" && value.startsWith("arn:")
          ? nameFromArn(value)
          : String(value),
      )
    : undefined;
  const trails = listTrails(ctx).filter((trail) =>
    filter === undefined ? true : filter.includes(trail.Name),
  );
  return { trailList: trails.map((trail) => trailView(trail)) };
};

const DeleteTrail: OperationHandler = (input, ctx) => {
  const name = resolveName(input);
  requireTrail(ctx, name);
  ctx.store.delete(trailKey(name));
  return {};
};

const StartLogging: OperationHandler = (input, ctx) => {
  const name = resolveName(input);
  const trail = requireTrail(ctx, name);
  trail.isLogging = true;
  trail.startLoggingTime = Math.floor(Date.now() / 1000);
  ctx.store.set(trailKey(name), trail);
  return {};
};

const StopLogging: OperationHandler = (input, ctx) => {
  const name = resolveName(input);
  const trail = requireTrail(ctx, name);
  trail.isLogging = false;
  trail.stopLoggingTime = Math.floor(Date.now() / 1000);
  ctx.store.set(trailKey(name), trail);
  return {};
};

const GetTrailStatus: OperationHandler = (input, ctx) => {
  const name = resolveName(input);
  const trail = requireTrail(ctx, name);
  return {
    IsLogging: trail.isLogging,
    StartLoggingTime: trail.startLoggingTime,
    StopLoggingTime: trail.stopLoggingTime,
    TimeLoggingStarted:
      trail.startLoggingTime === undefined
        ? undefined
        : new Date(trail.startLoggingTime * 1000).toISOString(),
    TimeLoggingStopped:
      trail.stopLoggingTime === undefined
        ? undefined
        : new Date(trail.stopLoggingTime * 1000).toISOString(),
  };
};

const UpdateTrail: OperationHandler = (input, ctx) => {
  const name = resolveName(input);
  const trail = requireTrail(ctx, name);
  if (typeof input["S3BucketName"] === "string") {
    trail.S3BucketName = input["S3BucketName"] as string;
  }
  if (typeof input["S3KeyPrefix"] === "string") {
    trail.S3KeyPrefix = input["S3KeyPrefix"] as string;
  }
  if (typeof input["SnsTopicName"] === "string") {
    trail.SnsTopicName = input["SnsTopicName"] as string;
    trail.SnsTopicARN = snsTopicArnOf(
      ctx.region,
      ctx.account,
      input["SnsTopicName"] as string,
    );
  }
  if (typeof input["IncludeGlobalServiceEvents"] === "boolean") {
    trail.IncludeGlobalServiceEvents = input[
      "IncludeGlobalServiceEvents"
    ] as boolean;
  }
  if (typeof input["IsMultiRegionTrail"] === "boolean") {
    trail.IsMultiRegionTrail = input["IsMultiRegionTrail"] as boolean;
  }
  if (typeof input["EnableLogFileValidation"] === "boolean") {
    trail.LogFileValidationEnabled = input[
      "EnableLogFileValidation"
    ] as boolean;
  }
  if (typeof input["CloudWatchLogsLogGroupArn"] === "string") {
    trail.CloudWatchLogsLogGroupArn = input[
      "CloudWatchLogsLogGroupArn"
    ] as string;
  }
  if (typeof input["CloudWatchLogsRoleArn"] === "string") {
    trail.CloudWatchLogsRoleArn = input["CloudWatchLogsRoleArn"] as string;
  }
  if (typeof input["KmsKeyId"] === "string") {
    trail.KmsKeyId = input["KmsKeyId"] as string;
  }
  if (typeof input["IsOrganizationTrail"] === "boolean") {
    trail.IsOrganizationTrail = input["IsOrganizationTrail"] as boolean;
  }
  ctx.store.set(trailKey(name), trail);
  return {
    Name: trail.Name,
    S3BucketName: trail.S3BucketName,
    S3KeyPrefix: trail.S3KeyPrefix,
    SnsTopicName: trail.SnsTopicName,
    SnsTopicARN: trail.SnsTopicARN,
    IncludeGlobalServiceEvents: trail.IncludeGlobalServiceEvents,
    IsMultiRegionTrail: trail.IsMultiRegionTrail,
    TrailARN: trail.TrailARN,
    LogFileValidationEnabled: trail.LogFileValidationEnabled,
    CloudWatchLogsLogGroupArn: trail.CloudWatchLogsLogGroupArn,
    CloudWatchLogsRoleArn: trail.CloudWatchLogsRoleArn,
    KmsKeyId: trail.KmsKeyId,
    IsOrganizationTrail: trail.IsOrganizationTrail,
  };
};

const PutEventSelectors: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrailName").startsWith("arn:")
    ? nameFromArn(input["TrailName"] as string)
    : (input["TrailName"] as string);
  const trail = requireTrail(ctx, name);
  const eventSelectors = Array.isArray(input["EventSelectors"])
    ? (input["EventSelectors"] as unknown[])
    : undefined;
  const advancedEventSelectors = Array.isArray(input["AdvancedEventSelectors"])
    ? (input["AdvancedEventSelectors"] as unknown[])
    : undefined;
  const selectors: StoredSelectors = {
    EventSelectors: eventSelectors,
    AdvancedEventSelectors: advancedEventSelectors,
  };
  ctx.store.set(selectorsKey(name), selectors);
  trail.HasCustomEventSelectors = true;
  ctx.store.set(trailKey(name), trail);
  return {
    TrailARN: trail.TrailARN,
    EventSelectors: eventSelectors,
    AdvancedEventSelectors: advancedEventSelectors,
  };
};

const GetEventSelectors: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrailName").startsWith("arn:")
    ? nameFromArn(input["TrailName"] as string)
    : (input["TrailName"] as string);
  const trail = requireTrail(ctx, name);
  const selectors = ctx.store.get<StoredSelectors>(selectorsKey(name));
  return {
    TrailARN: trail.TrailARN,
    EventSelectors: selectors?.EventSelectors,
    AdvancedEventSelectors: selectors?.AdvancedEventSelectors,
  };
};

const normalizeTags = (value: unknown): StoredTag[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      const tag = entry as Record<string, unknown>;
      const key = tag["Key"];
      if (typeof key !== "string") {
        return undefined;
      }
      return {
        Key: key,
        Value: typeof tag["Value"] === "string" ? tag["Value"] : undefined,
      };
    })
    .filter((tag): tag is StoredTag => tag !== undefined);
};

const AddTags: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const incoming = normalizeTags(input["TagsList"]);
  const existing = ctx.store.get<StoredTag[]>(tagsKey(resourceId)) ?? [];
  const merged = existing.filter(
    (tag) => !incoming.some((next) => next.Key === tag.Key),
  );
  ctx.store.set(tagsKey(resourceId), [...merged, ...incoming]);
  return {};
};

const RemoveTags: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const removing = normalizeTags(input["TagsList"]);
  const existing = ctx.store.get<StoredTag[]>(tagsKey(resourceId)) ?? [];
  const remaining = existing.filter(
    (tag) => !removing.some((next) => next.Key === tag.Key),
  );
  ctx.store.set(tagsKey(resourceId), remaining);
  return {};
};

const ListTags: OperationHandler = (input, ctx) => {
  const resourceIds = Array.isArray(input["ResourceIdList"])
    ? (input["ResourceIdList"] as unknown[]).map((value) => String(value))
    : [];
  return {
    ResourceTagList: resourceIds.map((resourceId) => ({
      ResourceId: resourceId,
      TagsList: ctx.store.get<StoredTag[]>(tagsKey(resourceId)) ?? [],
    })),
  };
};

const cloudtrail = {
  name: "cloudtrail",
  protocol: "json",
  operations: {
    CreateTrail,
    GetTrail,
    ListTrails,
    DescribeTrails,
    DeleteTrail,
    StartLogging,
    StopLogging,
    GetTrailStatus,
    UpdateTrail,
    PutEventSelectors,
    GetEventSelectors,
    AddTags,
    ListTags,
    RemoveTags,
  },
  model,
} as const satisfies ServiceDefinition;

export default cloudtrail;
