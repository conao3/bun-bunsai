import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import { scopedStore } from "../core/state.ts";
import type { StateStore } from "../core/state.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/cloudtrail.json", { with: { type: "json" } }),
  { targetPrefix: "com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101" },
);

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
  latestDeliveryTime?: number;
  latestDigestDeliveryTime?: number;
};

type StoredEventDataStore = {
  EventDataStoreArn: string;
  Name: string;
  Status: string;
  AdvancedEventSelectors?: unknown[];
  MultiRegionEnabled: boolean;
  OrganizationEnabled: boolean;
  RetentionPeriod: number;
  TerminationProtectionEnabled: boolean;
  KmsKeyId?: string;
  BillingMode: string;
  FederationStatus: string;
  FederationRoleArn?: string;
  CreatedTimestamp: number;
  UpdatedTimestamp: number;
};

type StoredChannel = {
  ChannelArn: string;
  Name: string;
  Source: string;
  Destinations: unknown[];
};

type StoredDashboard = {
  DashboardArn: string;
  Name: string;
  Type: string;
  Widgets: unknown[];
  RefreshSchedule?: unknown;
  TerminationProtectionEnabled: boolean;
  Status: string;
  CreatedTimestamp: number;
  UpdatedTimestamp: number;
  LastRefreshId?: string;
  LastRefreshFailureReason?: string;
};

type StoredImport = {
  ImportId: string;
  Destinations: unknown[];
  ImportSource?: unknown;
  StartEventTime?: number;
  EndEventTime?: number;
  ImportStatus: string;
  CreatedTimestamp: number;
  UpdatedTimestamp: number;
};

type StoredQuery = {
  QueryId: string;
  QueryString: string;
  QueryStatus: string;
  CreatedTimestamp: number;
};

type StoredInsightSelectors = {
  InsightSelectors: unknown[];
  EventDataStoreArn?: string;
  InsightsDestination?: string;
};

type StoredEvent = {
  EventId: string;
  EventName: string;
  EventSource: string;
  EventTime: number;
  Username: string;
  AccessKeyId: string;
  ReadOnly: string;
  Resources: unknown[];
  CloudTrailEvent: string;
};

const trailKey = (name: string): string => `trail/${name}`;

const eventKey = (seq: number): string =>
  `_event/${seq.toString().padStart(12, "0")}`;

const loggingCountKey = "_loggingTrailCount";

const selectorsKey = (name: string): string => `selectors/${name}`;

const tagsKey = (arn: string): string => `tags/${arn}`;

const edsKey = (arn: string): string => `eds/${arn}`;

const channelKey = (arn: string): string => `channel/${arn}`;

const dashboardKey = (arn: string): string => `dashboard/${arn}`;

const importKey = (id: string): string => `import/${id}`;

const queryKey = (id: string): string => `query/${id}`;

const insightSelectorsKey = (name: string): string =>
  `insightSelectors/${name}`;

const resourcePolicyKey = (arn: string): string => `resourcePolicy/${arn}`;

const eventConfigKey = (id: string): string => `eventConfig/${id}`;

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

const requireEventDataStore = (
  ctx: ServiceContext,
  arn: string,
): StoredEventDataStore => {
  const eds = ctx.store.get<StoredEventDataStore>(edsKey(arn));
  if (eds === undefined) {
    throw awsError(
      "EventDataStoreNotFoundException",
      `EventDataStore ${arn} does not exist.`,
      404,
    );
  }
  return eds;
};

const requireChannel = (ctx: ServiceContext, arn: string): StoredChannel => {
  const channel = ctx.store.get<StoredChannel>(channelKey(arn));
  if (channel === undefined) {
    throw awsError(
      "ChannelNotFoundException",
      `Channel ${arn} does not exist.`,
      404,
    );
  }
  return channel;
};

const requireDashboard = (
  ctx: ServiceContext,
  arn: string,
): StoredDashboard => {
  const dashboard = ctx.store.get<StoredDashboard>(dashboardKey(arn));
  if (dashboard === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Dashboard ${arn} does not exist.`,
      404,
    );
  }
  return dashboard;
};

const requireImport = (ctx: ServiceContext, id: string): StoredImport => {
  const imp = ctx.store.get<StoredImport>(importKey(id));
  if (imp === undefined) {
    throw awsError(
      "ImportNotFoundException",
      `Import ${id} does not exist.`,
      404,
    );
  }
  return imp;
};

const requireQuery = (ctx: ServiceContext, id: string): StoredQuery => {
  const query = ctx.store.get<StoredQuery>(queryKey(id));
  if (query === undefined) {
    throw awsError(
      "QueryIdNotFoundException",
      `QueryId ${id} does not exist.`,
      404,
    );
  }
  return query;
};

const booleanOf = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const numberOf = (value: unknown, fallback: number): number =>
  typeof value === "number" ? value : fallback;

const stringOf = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

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

const edsView = (eds: StoredEventDataStore): Record<string, unknown> => ({
  EventDataStoreArn: eds.EventDataStoreArn,
  Name: eds.Name,
  Status: eds.Status,
  AdvancedEventSelectors: eds.AdvancedEventSelectors,
  MultiRegionEnabled: eds.MultiRegionEnabled,
  OrganizationEnabled: eds.OrganizationEnabled,
  RetentionPeriod: eds.RetentionPeriod,
  TerminationProtectionEnabled: eds.TerminationProtectionEnabled,
  KmsKeyId: eds.KmsKeyId,
  BillingMode: eds.BillingMode,
  FederationStatus: eds.FederationStatus,
  FederationRoleArn: eds.FederationRoleArn,
  CreatedTimestamp: eds.CreatedTimestamp,
  UpdatedTimestamp: eds.UpdatedTimestamp,
});

const nowSec = (): number => Math.floor(Date.now() / 1000);

const edsArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:cloudtrail:${region}:${account}:eventdatastore/${name}`;

const channelArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:cloudtrail:${region}:${account}:channel/${name}`;

const dashboardArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:cloudtrail:${region}:${account}:dashboard/${name}`;

const generateId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

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
  const tags = normalizeTags(input["TagsList"]);
  if (tags.length > 0) {
    ctx.store.set(tagsKey(trail.TrailARN), tags);
  }
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
  const trail = requireTrail(ctx, name);
  if (trail.isLogging) {
    const count = ctx.store.get<number>(loggingCountKey) ?? 0;
    ctx.store.set(loggingCountKey, Math.max(0, count - 1));
  }
  ctx.store.delete(trailKey(name));
  ctx.store.delete(tagsKey(trail.TrailARN));
  return {};
};

const StartLogging: OperationHandler = (input, ctx) => {
  const name = resolveName(input);
  const trail = requireTrail(ctx, name);
  if (!trail.isLogging) {
    const count = ctx.store.get<number>(loggingCountKey) ?? 0;
    ctx.store.set(loggingCountKey, count + 1);
  }
  trail.isLogging = true;
  trail.startLoggingTime = Math.floor(Date.now() / 1000);
  trail.latestDeliveryTime = trail.startLoggingTime;
  trail.latestDigestDeliveryTime = trail.startLoggingTime;
  ctx.store.set(trailKey(name), trail);
  return {};
};

const StopLogging: OperationHandler = (input, ctx) => {
  const name = resolveName(input);
  const trail = requireTrail(ctx, name);
  if (trail.isLogging) {
    const count = ctx.store.get<number>(loggingCountKey) ?? 0;
    ctx.store.set(loggingCountKey, Math.max(0, count - 1));
  }
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
    LatestDeliveryTime:
      trail.latestDeliveryTime === undefined
        ? undefined
        : new Date(trail.latestDeliveryTime * 1000),
    LatestDigestDeliveryTime:
      trail.latestDigestDeliveryTime === undefined
        ? undefined
        : new Date(trail.latestDigestDeliveryTime * 1000),
    LatestDeliveryAttemptTime:
      trail.latestDeliveryTime === undefined
        ? undefined
        : new Date(trail.latestDeliveryTime * 1000).toISOString(),
    LatestDeliveryAttemptSucceeded:
      trail.latestDeliveryTime === undefined ? undefined : "Success",
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
    .map((entry): StoredTag | undefined => {
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

const CreateEventDataStore: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const now = nowSec();
  const arn = edsArnOf(ctx.region, ctx.account, generateId(name));
  const eds: StoredEventDataStore = {
    EventDataStoreArn: arn,
    Name: name,
    Status: "CREATED",
    AdvancedEventSelectors: Array.isArray(input["AdvancedEventSelectors"])
      ? (input["AdvancedEventSelectors"] as unknown[])
      : undefined,
    MultiRegionEnabled: booleanOf(input["MultiRegionEnabled"], true),
    OrganizationEnabled: booleanOf(input["OrganizationEnabled"], false),
    RetentionPeriod: numberOf(input["RetentionPeriod"], 2557),
    TerminationProtectionEnabled: booleanOf(
      input["TerminationProtectionEnabled"],
      true,
    ),
    KmsKeyId:
      typeof input["KmsKeyId"] === "string"
        ? (input["KmsKeyId"] as string)
        : undefined,
    BillingMode: stringOf(input["BillingMode"], "EXTENDABLE_RETENTION_PRICING"),
    FederationStatus: "DISABLED",
    FederationRoleArn: undefined,
    CreatedTimestamp: now,
    UpdatedTimestamp: now,
  };
  ctx.store.set(edsKey(arn), eds);
  const tags = normalizeTags(input["TagsList"]);
  if (tags.length > 0) {
    ctx.store.set(tagsKey(arn), tags);
  }
  return {
    EventDataStoreArn: eds.EventDataStoreArn,
    Name: eds.Name,
    Status: eds.Status,
    AdvancedEventSelectors: eds.AdvancedEventSelectors,
    MultiRegionEnabled: eds.MultiRegionEnabled,
    OrganizationEnabled: eds.OrganizationEnabled,
    RetentionPeriod: eds.RetentionPeriod,
    TerminationProtectionEnabled: eds.TerminationProtectionEnabled,
    TagsList: tags,
    CreatedTimestamp: eds.CreatedTimestamp,
    UpdatedTimestamp: eds.UpdatedTimestamp,
    KmsKeyId: eds.KmsKeyId,
    BillingMode: eds.BillingMode,
  };
};

const GetEventDataStore: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EventDataStore");
  const eds = requireEventDataStore(ctx, arn);
  return {
    ...edsView(eds),
    PartitionKeys: [],
  };
};

const listEventDataStores = (ctx: ServiceContext): StoredEventDataStore[] =>
  ctx.store
    .list<StoredEventDataStore>()
    .filter((entry) => entry.key.startsWith("eds/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));

const ListEventDataStores: OperationHandler = (_input, ctx) => {
  const stores = listEventDataStores(ctx);
  return {
    EventDataStores: stores.map((eds) => edsView(eds)),
    NextToken: undefined,
  };
};

const UpdateEventDataStore: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EventDataStore");
  const eds = requireEventDataStore(ctx, arn);
  if (typeof input["Name"] === "string") eds.Name = input["Name"] as string;
  if (Array.isArray(input["AdvancedEventSelectors"]))
    eds.AdvancedEventSelectors = input["AdvancedEventSelectors"] as unknown[];
  if (typeof input["MultiRegionEnabled"] === "boolean")
    eds.MultiRegionEnabled = input["MultiRegionEnabled"] as boolean;
  if (typeof input["OrganizationEnabled"] === "boolean")
    eds.OrganizationEnabled = input["OrganizationEnabled"] as boolean;
  if (typeof input["RetentionPeriod"] === "number")
    eds.RetentionPeriod = input["RetentionPeriod"] as number;
  if (typeof input["TerminationProtectionEnabled"] === "boolean")
    eds.TerminationProtectionEnabled = input[
      "TerminationProtectionEnabled"
    ] as boolean;
  if (typeof input["KmsKeyId"] === "string")
    eds.KmsKeyId = input["KmsKeyId"] as string;
  if (typeof input["BillingMode"] === "string")
    eds.BillingMode = input["BillingMode"] as string;
  eds.UpdatedTimestamp = nowSec();
  ctx.store.set(edsKey(arn), eds);
  return {
    EventDataStoreArn: eds.EventDataStoreArn,
    Name: eds.Name,
    Status: eds.Status,
    AdvancedEventSelectors: eds.AdvancedEventSelectors,
    MultiRegionEnabled: eds.MultiRegionEnabled,
    OrganizationEnabled: eds.OrganizationEnabled,
    RetentionPeriod: eds.RetentionPeriod,
    TerminationProtectionEnabled: eds.TerminationProtectionEnabled,
    CreatedTimestamp: eds.CreatedTimestamp,
    UpdatedTimestamp: eds.UpdatedTimestamp,
    KmsKeyId: eds.KmsKeyId,
    BillingMode: eds.BillingMode,
    FederationStatus: eds.FederationStatus,
    FederationRoleArn: eds.FederationRoleArn,
  };
};

const DeleteEventDataStore: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EventDataStore");
  const eds = requireEventDataStore(ctx, arn);
  if (eds.TerminationProtectionEnabled) {
    throw awsError(
      "EventDataStoreTerminationProtectedException",
      `EventDataStore ${arn} has termination protection enabled.`,
      409,
    );
  }
  if (eds.FederationStatus === "ENABLED") {
    throw awsError(
      "EventDataStoreFederationEnabledException",
      `EventDataStore ${arn} has federation enabled.`,
      409,
    );
  }
  const inUse = listChannels(ctx).some((ch) =>
    (ch.Destinations as Array<{ Type?: string; Location?: string }>).some(
      (d) => d.Type === "EVENT_DATA_STORE" && d.Location === arn,
    ),
  );
  if (inUse) {
    throw awsError(
      "ChannelExistsForEDSException",
      `A channel exists for EventDataStore ${arn}.`,
      409,
    );
  }
  eds.Status = "PENDING_DELETION";
  ctx.store.set(edsKey(arn), eds);
  ctx.store.delete(tagsKey(arn));
  return {};
};

const RestoreEventDataStore: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EventDataStore");
  const eds = requireEventDataStore(ctx, arn);
  eds.Status = "ENABLED";
  eds.UpdatedTimestamp = nowSec();
  ctx.store.set(edsKey(arn), eds);
  return {
    EventDataStoreArn: eds.EventDataStoreArn,
    Name: eds.Name,
    Status: eds.Status,
    AdvancedEventSelectors: eds.AdvancedEventSelectors,
    MultiRegionEnabled: eds.MultiRegionEnabled,
    OrganizationEnabled: eds.OrganizationEnabled,
    RetentionPeriod: eds.RetentionPeriod,
    TerminationProtectionEnabled: eds.TerminationProtectionEnabled,
    CreatedTimestamp: eds.CreatedTimestamp,
    UpdatedTimestamp: eds.UpdatedTimestamp,
    KmsKeyId: eds.KmsKeyId,
    BillingMode: eds.BillingMode,
  };
};

const StartEventDataStoreIngestion: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EventDataStore");
  const eds = requireEventDataStore(ctx, arn);
  eds.Status = "ENABLED";
  eds.UpdatedTimestamp = nowSec();
  ctx.store.set(edsKey(arn), eds);
  return {};
};

const StopEventDataStoreIngestion: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EventDataStore");
  const eds = requireEventDataStore(ctx, arn);
  eds.Status = "STOPPED_INGESTION";
  eds.UpdatedTimestamp = nowSec();
  ctx.store.set(edsKey(arn), eds);
  return {};
};

const EnableFederation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EventDataStore");
  const roleArn = requireString(input, "FederationRoleArn");
  const eds = requireEventDataStore(ctx, arn);
  eds.FederationStatus = "ENABLED";
  eds.FederationRoleArn = roleArn;
  eds.UpdatedTimestamp = nowSec();
  ctx.store.set(edsKey(arn), eds);
  return {
    EventDataStoreArn: eds.EventDataStoreArn,
    FederationStatus: eds.FederationStatus,
    FederationRoleArn: eds.FederationRoleArn,
  };
};

const DisableFederation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EventDataStore");
  const eds = requireEventDataStore(ctx, arn);
  eds.FederationStatus = "DISABLED";
  eds.FederationRoleArn = undefined;
  eds.UpdatedTimestamp = nowSec();
  ctx.store.set(edsKey(arn), eds);
  return {
    EventDataStoreArn: eds.EventDataStoreArn,
    FederationStatus: eds.FederationStatus,
  };
};

const CreateChannel: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const source = requireString(input, "Source");
  const destinations = Array.isArray(input["Destinations"])
    ? (input["Destinations"] as unknown[])
    : [];
  const arn = channelArnOf(ctx.region, ctx.account, generateId(name));
  const channel: StoredChannel = {
    ChannelArn: arn,
    Name: name,
    Source: source,
    Destinations: destinations,
  };
  ctx.store.set(channelKey(arn), channel);
  const tags = normalizeTags(input["Tags"]);
  if (tags.length > 0) {
    ctx.store.set(tagsKey(arn), tags);
  }
  return {
    ChannelArn: channel.ChannelArn,
    Name: channel.Name,
    Source: channel.Source,
    Destinations: channel.Destinations,
    Tags: tags,
  };
};

const GetChannel: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Channel");
  const channel = requireChannel(ctx, arn);
  return {
    ChannelArn: channel.ChannelArn,
    Name: channel.Name,
    Source: channel.Source,
    SourceConfig: { ApplyToAllRegions: true, AdvancedEventSelectors: [] },
    Destinations: channel.Destinations,
    IngestionStatus: {
      LatestIngestionSuccessTime: nowSec(),
      LatestIngestionSuccessEventID: "",
      LatestIngestionErrorCode: "",
      LatestIngestionAttemptTime: nowSec(),
      LatestIngestionAttemptEventID: "",
    },
  };
};

const listChannels = (ctx: ServiceContext): StoredChannel[] =>
  ctx.store
    .list<StoredChannel>()
    .filter((entry) => entry.key.startsWith("channel/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));

const ListChannels: OperationHandler = (_input, ctx) => {
  const channels = listChannels(ctx);
  return {
    Channels: channels.map((ch) => ({
      ChannelArn: ch.ChannelArn,
      Name: ch.Name,
    })),
    NextToken: undefined,
  };
};

const UpdateChannel: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Channel");
  const channel = requireChannel(ctx, arn);
  if (typeof input["Name"] === "string") channel.Name = input["Name"] as string;
  if (Array.isArray(input["Destinations"]))
    channel.Destinations = input["Destinations"] as unknown[];
  ctx.store.set(channelKey(arn), channel);
  return {
    ChannelArn: channel.ChannelArn,
    Name: channel.Name,
    Source: channel.Source,
    Destinations: channel.Destinations,
  };
};

const DeleteChannel: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Channel");
  requireChannel(ctx, arn);
  ctx.store.delete(channelKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const CreateDashboard: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const now = nowSec();
  const arn = dashboardArnOf(ctx.region, ctx.account, generateId(name));
  const dashboard: StoredDashboard = {
    DashboardArn: arn,
    Name: name,
    Type: "CUSTOM",
    Widgets: Array.isArray(input["Widgets"])
      ? (input["Widgets"] as unknown[])
      : [],
    RefreshSchedule: input["RefreshSchedule"] ?? undefined,
    TerminationProtectionEnabled: booleanOf(
      input["TerminationProtectionEnabled"],
      false,
    ),
    Status: "CREATED",
    CreatedTimestamp: now,
    UpdatedTimestamp: now,
  };
  ctx.store.set(dashboardKey(arn), dashboard);
  const tags = normalizeTags(input["TagsList"]);
  if (tags.length > 0) {
    ctx.store.set(tagsKey(arn), tags);
  }
  return {
    DashboardArn: dashboard.DashboardArn,
    Name: dashboard.Name,
    Type: dashboard.Type,
    Widgets: dashboard.Widgets,
    TagsList: tags,
    RefreshSchedule: dashboard.RefreshSchedule,
    TerminationProtectionEnabled: dashboard.TerminationProtectionEnabled,
  };
};

const GetDashboard: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DashboardId");
  const dashboard = requireDashboard(ctx, arn);
  return {
    DashboardArn: dashboard.DashboardArn,
    Type: dashboard.Type,
    Status: dashboard.Status,
    Widgets: dashboard.Widgets,
    RefreshSchedule: dashboard.RefreshSchedule,
    CreatedTimestamp: dashboard.CreatedTimestamp,
    UpdatedTimestamp: dashboard.UpdatedTimestamp,
    LastRefreshId: dashboard.LastRefreshId,
    LastRefreshFailureReason: dashboard.LastRefreshFailureReason,
    TerminationProtectionEnabled: dashboard.TerminationProtectionEnabled,
  };
};

const listDashboards = (ctx: ServiceContext): StoredDashboard[] =>
  ctx.store
    .list<StoredDashboard>()
    .filter((entry) => entry.key.startsWith("dashboard/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));

const ListDashboards: OperationHandler = (input, ctx) => {
  let dashboards = listDashboards(ctx);
  if (typeof input["NamePrefix"] === "string") {
    const prefix = input["NamePrefix"] as string;
    dashboards = dashboards.filter((d) => d.Name.startsWith(prefix));
  }
  if (typeof input["Type"] === "string") {
    const type = input["Type"] as string;
    dashboards = dashboards.filter((d) => d.Type === type);
  }
  return {
    Dashboards: dashboards.map((d) => ({
      DashboardArn: d.DashboardArn,
      Type: d.Type,
      Status: d.Status,
      CreatedTimestamp: d.CreatedTimestamp,
      UpdatedTimestamp: d.UpdatedTimestamp,
    })),
    NextToken: undefined,
  };
};

const UpdateDashboard: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DashboardId");
  const dashboard = requireDashboard(ctx, arn);
  if (Array.isArray(input["Widgets"]))
    dashboard.Widgets = input["Widgets"] as unknown[];
  if (input["RefreshSchedule"] !== undefined)
    dashboard.RefreshSchedule = input["RefreshSchedule"];
  if (typeof input["TerminationProtectionEnabled"] === "boolean")
    dashboard.TerminationProtectionEnabled = input[
      "TerminationProtectionEnabled"
    ] as boolean;
  dashboard.UpdatedTimestamp = nowSec();
  ctx.store.set(dashboardKey(arn), dashboard);
  return {
    DashboardArn: dashboard.DashboardArn,
    Name: dashboard.Name,
    Type: dashboard.Type,
    Widgets: dashboard.Widgets,
    RefreshSchedule: dashboard.RefreshSchedule,
    TerminationProtectionEnabled: dashboard.TerminationProtectionEnabled,
    CreatedTimestamp: dashboard.CreatedTimestamp,
    UpdatedTimestamp: dashboard.UpdatedTimestamp,
  };
};

const DeleteDashboard: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DashboardId");
  const dashboard = requireDashboard(ctx, arn);
  if (dashboard.TerminationProtectionEnabled) {
    throw awsError(
      "ConflictException",
      `Dashboard ${arn} has termination protection enabled.`,
      409,
    );
  }
  ctx.store.delete(dashboardKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const StartDashboardRefresh: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DashboardId");
  const dashboard = requireDashboard(ctx, arn);
  const refreshId = generateId("refresh");
  dashboard.LastRefreshId = refreshId;
  dashboard.Status = "REFRESH_IN_PROGRESS";
  dashboard.UpdatedTimestamp = nowSec();
  ctx.store.set(dashboardKey(arn), dashboard);
  return { RefreshId: refreshId };
};

const StartQuery: OperationHandler = (input, ctx) => {
  const queryId = generateId("query");
  const queryString =
    typeof input["QueryStatement"] === "string"
      ? (input["QueryStatement"] as string)
      : typeof input["QueryAlias"] === "string"
        ? `ALIAS:${input["QueryAlias"]}`
        : "SELECT * FROM events";
  const query: StoredQuery = {
    QueryId: queryId,
    QueryString: queryString,
    QueryStatus: "QUEUED",
    CreatedTimestamp: nowSec(),
  };
  ctx.store.set(queryKey(queryId), query);
  return {
    QueryId: queryId,
    EventDataStoreOwnerAccountId: ctx.account,
  };
};

const CancelQuery: OperationHandler = (input, ctx) => {
  const queryId = requireString(input, "QueryId");
  const query = requireQuery(ctx, queryId);
  if (
    query.QueryStatus === "CANCELLED" ||
    query.QueryStatus === "FAILED" ||
    query.QueryStatus === "FINISHED" ||
    query.QueryStatus === "TIMED_OUT"
  ) {
    throw awsError(
      "InactiveQueryException",
      `Query ${queryId} is already in a terminal state.`,
      409,
    );
  }
  query.QueryStatus = "CANCELLED";
  ctx.store.set(queryKey(queryId), query);
  return {
    QueryId: queryId,
    QueryStatus: query.QueryStatus,
    EventDataStoreOwnerAccountId: ctx.account,
  };
};

const terminalQueryStatuses = new Set([
  "FINISHED",
  "CANCELLED",
  "FAILED",
  "TIMED_OUT",
] as const);

const DescribeQuery: OperationHandler = (input, ctx) => {
  const queryId =
    typeof input["QueryId"] === "string" ? (input["QueryId"] as string) : "";
  if (queryId === "") {
    throw awsError("QueryIdNotFoundException", "QueryId is required.", 400);
  }
  const query = requireQuery(ctx, queryId);
  const isTerminal = terminalQueryStatuses.has(
    query.QueryStatus as "FINISHED" | "CANCELLED" | "FAILED" | "TIMED_OUT",
  );
  return {
    QueryId: query.QueryId,
    QueryString: query.QueryString,
    QueryStatus: query.QueryStatus,
    QueryStatistics: {
      EventsMatched: 0,
      EventsScanned: 0,
      ExecutionTimeInMillis: isTerminal ? 100 : 0,
      TotalResultsCount: 0,
      BytesScanned: 0,
    },
    EventDataStoreOwnerAccountId: ctx.account,
  };
};

const GetQueryResults: OperationHandler = (input, ctx) => {
  const queryId = requireString(input, "QueryId");
  const query = requireQuery(ctx, queryId);
  if (
    !terminalQueryStatuses.has(
      query.QueryStatus as "FINISHED" | "CANCELLED" | "FAILED" | "TIMED_OUT",
    )
  ) {
    query.QueryStatus = "FINISHED";
    ctx.store.set(queryKey(queryId), query);
  }
  return {
    QueryStatus: query.QueryStatus,
    QueryStatistics: {
      ResultsCount: 0,
      TotalResultsCount: 0,
      BytesScanned: 0,
    },
    QueryResultRows: [],
    NextToken: undefined,
  };
};

const listQueries = (ctx: ServiceContext): StoredQuery[] =>
  ctx.store
    .list<StoredQuery>()
    .filter((entry) => entry.key.startsWith("query/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreatedTimestamp - a.CreatedTimestamp);

const ListQueries: OperationHandler = (input, ctx) => {
  requireString(input, "EventDataStore");
  const queries = listQueries(ctx);
  return {
    Queries: queries.map((q) => ({
      QueryId: q.QueryId,
      QueryStatus: q.QueryStatus,
      CreationTime: q.CreatedTimestamp,
    })),
    NextToken: undefined,
  };
};

const GenerateQuery: OperationHandler = (input, ctx) => {
  const prompt =
    typeof input["Prompt"] === "string" ? (input["Prompt"] as string) : "";
  return {
    QueryStatement: `SELECT * FROM events WHERE prompt = '${prompt.replace(/'/g, "''")}'`,
    QueryAlias: `generated-${generateId("alias")}`,
    EventDataStoreOwnerAccountId: ctx.account,
  };
};

const SearchSampleQueries: OperationHandler = (_input, _ctx) => {
  return {
    SearchResults: [],
    NextToken: undefined,
  };
};

const terminalImportStatuses = new Set([
  "COMPLETED",
  "STOPPED",
  "FAILED",
] as const);

const StartImport: OperationHandler = (input, ctx) => {
  const now = nowSec();
  const providedImportId = typeof input["ImportId"] === "string";
  const importId = providedImportId
    ? (input["ImportId"] as string)
    : generateId("import");
  const existing = ctx.store.get<StoredImport>(importKey(importId));
  if (
    existing &&
    providedImportId &&
    terminalImportStatuses.has(
      existing.ImportStatus as "COMPLETED" | "STOPPED" | "FAILED",
    )
  ) {
    throw awsError(
      "InvalidParameterException",
      `Import ${importId} cannot be restarted.`,
      400,
    );
  }
  const imp: StoredImport = existing ?? {
    ImportId: importId,
    Destinations: Array.isArray(input["Destinations"])
      ? (input["Destinations"] as unknown[])
      : [],
    ImportSource: input["ImportSource"] ?? undefined,
    StartEventTime:
      typeof input["StartEventTime"] === "number"
        ? (input["StartEventTime"] as number)
        : undefined,
    EndEventTime:
      typeof input["EndEventTime"] === "number"
        ? (input["EndEventTime"] as number)
        : undefined,
    ImportStatus: "IN_PROGRESS",
    CreatedTimestamp: now,
    UpdatedTimestamp: now,
  };
  if (existing) {
    imp.ImportStatus = "IN_PROGRESS";
    imp.UpdatedTimestamp = now;
  }
  ctx.store.set(importKey(importId), imp);
  return {
    ImportId: imp.ImportId,
    Destinations: imp.Destinations,
    ImportSource: imp.ImportSource,
    StartEventTime: imp.StartEventTime,
    EndEventTime: imp.EndEventTime,
    ImportStatus: imp.ImportStatus,
    CreatedTimestamp: imp.CreatedTimestamp,
    UpdatedTimestamp: imp.UpdatedTimestamp,
  };
};

const GetImport: OperationHandler = (input, ctx) => {
  const importId = requireString(input, "ImportId");
  const imp = requireImport(ctx, importId);
  return {
    ImportId: imp.ImportId,
    Destinations: imp.Destinations,
    ImportSource: imp.ImportSource,
    StartEventTime: imp.StartEventTime,
    EndEventTime: imp.EndEventTime,
    ImportStatus: imp.ImportStatus,
    CreatedTimestamp: imp.CreatedTimestamp,
    UpdatedTimestamp: imp.UpdatedTimestamp,
    ImportStatistics: {
      PrefixesFound: 0,
      PrefixesCompleted: 0,
      FilesCompleted: 0,
      EventsCompleted: 0,
      FailedEntries: 0,
    },
  };
};

const listImports = (ctx: ServiceContext): StoredImport[] =>
  ctx.store
    .list<StoredImport>()
    .filter((entry) => entry.key.startsWith("import/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreatedTimestamp - a.CreatedTimestamp);

const ListImports: OperationHandler = (input, ctx) => {
  let imports = listImports(ctx);
  if (typeof input["ImportStatus"] === "string") {
    const status = input["ImportStatus"] as string;
    imports = imports.filter((imp) => imp.ImportStatus === status);
  }
  return {
    Imports: imports.map((imp) => ({
      ImportId: imp.ImportId,
      Destinations: imp.Destinations,
      ImportSource: imp.ImportSource,
      ImportStatus: imp.ImportStatus,
      CreatedTimestamp: imp.CreatedTimestamp,
      UpdatedTimestamp: imp.UpdatedTimestamp,
    })),
    NextToken: undefined,
  };
};

const ListImportFailures: OperationHandler = (input, ctx) => {
  const importId = requireString(input, "ImportId");
  requireImport(ctx, importId);
  return {
    Failures: [],
    NextToken: undefined,
  };
};

const StopImport: OperationHandler = (input, ctx) => {
  const importId = requireString(input, "ImportId");
  const imp = requireImport(ctx, importId);
  imp.ImportStatus = "STOPPED";
  imp.UpdatedTimestamp = nowSec();
  ctx.store.set(importKey(importId), imp);
  return {
    ImportId: imp.ImportId,
    ImportSource: imp.ImportSource,
    Destinations: imp.Destinations,
    ImportStatus: imp.ImportStatus,
    CreatedTimestamp: imp.CreatedTimestamp,
    UpdatedTimestamp: imp.UpdatedTimestamp,
    StartEventTime: imp.StartEventTime,
    EndEventTime: imp.EndEventTime,
    ImportStatistics: {
      PrefixesFound: 0,
      PrefixesCompleted: 0,
      FilesCompleted: 0,
      EventsCompleted: 0,
      FailedEntries: 0,
    },
  };
};

const PutInsightSelectors: OperationHandler = (input, ctx) => {
  const trailName =
    typeof input["TrailName"] === "string"
      ? (input["TrailName"] as string)
      : undefined;
  const edsArn =
    typeof input["EventDataStore"] === "string"
      ? (input["EventDataStore"] as string)
      : undefined;
  const selectors = Array.isArray(input["InsightSelectors"])
    ? (input["InsightSelectors"] as unknown[])
    : [];
  const insightsDestination =
    typeof input["InsightsDestination"] === "string"
      ? (input["InsightsDestination"] as string)
      : undefined;

  let trailARN: string | undefined;
  if (trailName !== undefined) {
    const resolvedName = trailName.startsWith("arn:")
      ? nameFromArn(trailName)
      : trailName;
    const trail = requireTrail(ctx, resolvedName);
    trail.HasInsightSelectors = selectors.length > 0;
    ctx.store.set(trailKey(resolvedName), trail);
    trailARN = trail.TrailARN;
    ctx.store.set(insightSelectorsKey(resolvedName), {
      InsightSelectors: selectors,
      EventDataStoreArn: edsArn,
      InsightsDestination: insightsDestination,
    } satisfies StoredInsightSelectors);
  } else if (edsArn !== undefined) {
    requireEventDataStore(ctx, edsArn);
    ctx.store.set(insightSelectorsKey(edsArn), {
      InsightSelectors: selectors,
      EventDataStoreArn: edsArn,
      InsightsDestination: insightsDestination,
    } satisfies StoredInsightSelectors);
  } else {
    throw awsError(
      "InvalidParameterCombinationException",
      "TrailName or EventDataStore is required.",
      400,
    );
  }

  return {
    TrailARN: trailARN,
    InsightSelectors: selectors,
    EventDataStoreArn: edsArn,
    InsightsDestination: insightsDestination,
  };
};

const GetInsightSelectors: OperationHandler = (input, ctx) => {
  const trailName =
    typeof input["TrailName"] === "string"
      ? (input["TrailName"] as string)
      : undefined;
  const edsArn =
    typeof input["EventDataStore"] === "string"
      ? (input["EventDataStore"] as string)
      : undefined;

  if (trailName !== undefined) {
    const resolvedName = trailName.startsWith("arn:")
      ? nameFromArn(trailName)
      : trailName;
    const trail = requireTrail(ctx, resolvedName);
    const stored = ctx.store.get<StoredInsightSelectors>(
      insightSelectorsKey(resolvedName),
    ) ?? { InsightSelectors: [] };
    return {
      TrailARN: trail.TrailARN,
      InsightSelectors: stored.InsightSelectors,
      EventDataStoreArn: stored.EventDataStoreArn,
      InsightsDestination: stored.InsightsDestination,
    };
  } else if (edsArn !== undefined) {
    requireEventDataStore(ctx, edsArn);
    const stored = ctx.store.get<StoredInsightSelectors>(
      insightSelectorsKey(edsArn),
    ) ?? {
      InsightSelectors: [],
    };
    return {
      InsightSelectors: stored.InsightSelectors,
      EventDataStoreArn: edsArn,
      InsightsDestination: stored.InsightsDestination,
    };
  }
  throw awsError(
    "InvalidParameterCombinationException",
    "TrailName or EventDataStore is required.",
    400,
  );
};

const GetResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const policy = ctx.store.get<string>(resourcePolicyKey(resourceArn));
  return {
    ResourceArn: resourceArn,
    ResourcePolicy: policy,
    DelegatedAdminResourcePolicy: undefined,
  };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const policy = requireString(input, "ResourcePolicy");
  ctx.store.set(resourcePolicyKey(resourceArn), policy);
  return {
    ResourceArn: resourceArn,
    ResourcePolicy: policy,
    DelegatedAdminResourcePolicy: undefined,
  };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  ctx.store.delete(resourcePolicyKey(resourceArn));
  return {};
};

const GetEventConfiguration: OperationHandler = (input, ctx) => {
  const trailName =
    typeof input["TrailName"] === "string"
      ? (input["TrailName"] as string)
      : undefined;
  const edsArn =
    typeof input["EventDataStore"] === "string"
      ? (input["EventDataStore"] as string)
      : undefined;
  const configId = trailName ?? edsArn ?? ctx.account;
  const stored = ctx.store.get<Record<string, unknown>>(
    eventConfigKey(configId),
  );
  return {
    TrailARN: trailName,
    EventDataStoreArn: edsArn,
    MaxEventSize: stored?.["MaxEventSize"] ?? "Standard",
    ContextKeySelectors: stored?.["ContextKeySelectors"] ?? [],
    AggregationConfigurations: stored?.["AggregationConfigurations"] ?? [],
  };
};

const PutEventConfiguration: OperationHandler = (input, ctx) => {
  const trailName =
    typeof input["TrailName"] === "string"
      ? (input["TrailName"] as string)
      : undefined;
  const edsArn =
    typeof input["EventDataStore"] === "string"
      ? (input["EventDataStore"] as string)
      : undefined;
  const configId = trailName ?? edsArn ?? ctx.account;
  const config: Record<string, unknown> = {
    MaxEventSize: input["MaxEventSize"] ?? "Standard",
    ContextKeySelectors: Array.isArray(input["ContextKeySelectors"])
      ? input["ContextKeySelectors"]
      : [],
    AggregationConfigurations: Array.isArray(input["AggregationConfigurations"])
      ? input["AggregationConfigurations"]
      : [],
  };
  ctx.store.set(eventConfigKey(configId), config);
  return {
    TrailARN: trailName,
    EventDataStoreArn: edsArn,
    MaxEventSize: config["MaxEventSize"],
    ContextKeySelectors: config["ContextKeySelectors"],
    AggregationConfigurations: config["AggregationConfigurations"],
  };
};

const ListPublicKeys: OperationHandler = (_input, _ctx) => {
  return {
    PublicKeyList: [],
    NextToken: undefined,
  };
};

const matchLookupAttr = (
  event: StoredEvent,
  key: string,
  value: string,
): boolean => {
  switch (key) {
    case "EventName":
      return event.EventName === value;
    case "EventSource":
      return event.EventSource === value;
    case "Username":
      return event.Username === value;
    case "AccessKeyId":
      return event.AccessKeyId === value;
    case "EventId":
      return event.EventId === value;
    case "ResourceName":
      return (event.Resources as { ResourceName?: string }[]).some(
        (r) => r.ResourceName === value,
      );
    case "ResourceType":
      return (event.Resources as { ResourceType?: string }[]).some(
        (r) => r.ResourceType === value,
      );
    default:
      return true;
  }
};

const LookupEvents: OperationHandler = (input, ctx) => {
  const attrs = input["LookupAttributes"] as
    | { AttributeKey: string; AttributeValue: string }[]
    | undefined;
  const startTime = input["StartTime"] as number | undefined;
  const endTime = input["EndTime"] as number | undefined;
  const maxResults = (input["MaxResults"] as number | undefined) ?? 50;
  const nextToken = input["NextToken"] as string | undefined;

  const allEvents = ctx.store
    .list<StoredEvent>()
    .filter(({ key }) => key.startsWith("_event/"))
    .map(({ value }) => value)
    .sort((a, b) => b.EventTime - a.EventTime);

  const filtered = allEvents.filter((event) => {
    if (startTime !== undefined && event.EventTime < startTime) return false;
    if (endTime !== undefined && event.EventTime > endTime) return false;
    if (attrs !== undefined && attrs.length > 0) {
      for (const attr of attrs) {
        if (!matchLookupAttr(event, attr.AttributeKey, attr.AttributeValue))
          return false;
      }
    }
    return true;
  });

  const offset = nextToken !== undefined ? parseInt(nextToken, 10) : 0;
  const page = filtered.slice(offset, offset + maxResults);
  const newNextToken =
    offset + maxResults < filtered.length
      ? String(offset + maxResults)
      : undefined;

  return {
    Events: page,
    NextToken: newNextToken,
  };
};

const ListInsightsData: OperationHandler = (_input, _ctx) => {
  return {
    Events: [],
    NextToken: undefined,
  };
};

const ListInsightsMetricData: OperationHandler = (input, _ctx) => {
  return {
    TrailARN:
      typeof input["TrailName"] === "string" ? input["TrailName"] : undefined,
    EventSource: input["EventSource"] as string | undefined,
    EventName: input["EventName"] as string | undefined,
    InsightType: input["InsightType"] as string | undefined,
    ErrorCode: undefined,
    Timestamps: [],
    Values: [],
    NextToken: undefined,
  };
};

const RegisterOrganizationDelegatedAdmin: OperationHandler = (input, _ctx) => {
  requireString(input, "MemberAccountId");
  return {};
};

const DeregisterOrganizationDelegatedAdmin: OperationHandler = (
  input,
  _ctx,
) => {
  requireString(input, "DelegatedAdminAccountId");
  return {};
};

export const recordManagementEvent = (
  store: StateStore,
  account: string,
  region: string,
  service: string,
  operation: string,
  accessKeyId: string,
  requestBody: string,
): void => {
  const ctStore = scopedStore(store, {
    account,
    region,
    service: "cloudtrail",
  });
  const loggingCount = ctStore.get<number>(loggingCountKey) ?? 0;
  if (loggingCount <= 0) return;

  const seq = (ctStore.get<number>("_eventSeq") ?? 0) + 1;
  ctStore.set("_eventSeq", seq);

  const eventSource = `${service}.amazonaws.com`;
  const readOnly = /^(Get|List|Describe|Lookup)/.test(operation)
    ? "true"
    : "false";
  const eventTime = Math.floor(Date.now() / 1000);
  const eventId = crypto.randomUUID();

  let requestParameters: unknown;
  try {
    requestParameters = JSON.parse(requestBody);
  } catch {
    requestParameters = requestBody || undefined;
  }

  const event: StoredEvent = {
    EventId: eventId,
    EventName: operation,
    EventSource: eventSource,
    EventTime: eventTime,
    Username: "test",
    AccessKeyId: accessKeyId,
    ReadOnly: readOnly,
    Resources: [],
    CloudTrailEvent: JSON.stringify({
      eventVersion: "1.08",
      eventName: operation,
      eventSource: eventSource,
      awsRegion: region,
      requestParameters,
    }),
  };

  ctStore.set(eventKey(seq), event);

  const minSeq = seq - 1000;
  if (minSeq > 0) {
    ctStore.delete(eventKey(minSeq));
  }
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
    CreateEventDataStore,
    GetEventDataStore,
    ListEventDataStores,
    UpdateEventDataStore,
    DeleteEventDataStore,
    RestoreEventDataStore,
    StartEventDataStoreIngestion,
    StopEventDataStoreIngestion,
    EnableFederation,
    DisableFederation,
    CreateChannel,
    GetChannel,
    ListChannels,
    UpdateChannel,
    DeleteChannel,
    CreateDashboard,
    GetDashboard,
    ListDashboards,
    UpdateDashboard,
    DeleteDashboard,
    StartDashboardRefresh,
    StartQuery,
    CancelQuery,
    DescribeQuery,
    GetQueryResults,
    ListQueries,
    GenerateQuery,
    SearchSampleQueries,
    StartImport,
    GetImport,
    ListImports,
    ListImportFailures,
    StopImport,
    PutInsightSelectors,
    GetInsightSelectors,
    GetResourcePolicy,
    PutResourcePolicy,
    DeleteResourcePolicy,
    GetEventConfiguration,
    PutEventConfiguration,
    ListPublicKeys,
    LookupEvents,
    ListInsightsData,
    ListInsightsMetricData,
    RegisterOrganizationDelegatedAdmin,
    DeregisterOrganizationDelegatedAdmin,
  },
  model,
} as const satisfies ServiceDefinition;

export default cloudtrail;
