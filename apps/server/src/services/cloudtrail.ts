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
  },
  model,
} as const satisfies ServiceDefinition;

export default cloudtrail;
