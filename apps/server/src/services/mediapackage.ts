import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import mediapackageModel from "../../../../test/vendor/aws-models/mediapackage.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(mediapackageModel);

const channelPrefix = "channel:" as const;
const originEndpointPrefix = "origin_endpoint:" as const;
const harvestJobPrefix = "harvest_job:" as const;
const tagPrefix = "tag:" as const;

type IngestEndpoint = {
  Id: string;
  Password: string;
  Url: string;
  Username: string;
};

type HlsIngest = {
  IngestEndpoints: IngestEndpoint[];
};

type EgressAccessLogs = {
  LogGroupName?: string;
};

type IngressAccessLogs = {
  LogGroupName?: string;
};

type S3Destination = {
  BucketName: string;
  ManifestKey: string;
  RoleArn: string;
};

type StoredChannel = {
  Id: string;
  Arn: string;
  Description: string;
  CreatedAt: string;
  Tags: Record<string, unknown>;
  HlsIngest: HlsIngest;
  EgressAccessLogs?: EgressAccessLogs;
  IngressAccessLogs?: IngressAccessLogs;
};

type StoredOriginEndpoint = {
  Id: string;
  Arn: string;
  ChannelId: string;
  Description: string;
  CreatedAt: string;
  Tags: Record<string, unknown>;
  Url: string;
  ManifestName: string;
  StartoverWindowSeconds?: number;
  TimeDelaySeconds?: number;
  Origination?: string;
  Whitelist?: string[];
  Authorization?: unknown;
  CmafPackage?: unknown;
  DashPackage?: unknown;
  HlsPackage?: unknown;
  MssPackage?: unknown;
};

type StoredHarvestJob = {
  Id: string;
  Arn: string;
  ChannelId: string;
  OriginEndpointId: string;
  S3Destination: S3Destination;
  StartTime: string;
  EndTime: string;
  Status: string;
  CreatedAt: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 422);
  }
  return value;
};

const channelKey = (id: string): string => `${channelPrefix}${id}`;
const originEndpointKey = (id: string): string =>
  `${originEndpointPrefix}${id}`;
const harvestJobKey = (id: string): string => `${harvestJobPrefix}${id}`;
const tagKey = (arn: string): string => `${tagPrefix}${arn}`;

const paginateItems = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
  maxCap = 200,
): { page: T[]; nextToken: string | undefined } => {
  const max =
    typeof maxResults === "number" && maxResults > 0
      ? Math.min(maxResults, maxCap)
      : maxCap;
  const offset =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(atob(nextToken), 10) || 0
      : 0;
  const page = items.slice(offset, offset + max);
  const next =
    offset + max < items.length ? btoa(String(offset + max)) : undefined;
  return { page, nextToken: next };
};

const channelArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:mediapackage:${ctx.region}:${ctx.account}:channels/${id}`;

const originEndpointArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:mediapackage:${ctx.region}:${ctx.account}:origin_endpoints/${id}`;

const harvestJobArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:mediapackage:${ctx.region}:${ctx.account}:harvest_jobs/${id}`;

const requireChannel = (ctx: ServiceContext, id: string): StoredChannel => {
  const stored = ctx.store.get<StoredChannel>(channelKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Channel not found for ID ${id}.`, 404);
  }
  return stored;
};

const requireOriginEndpoint = (
  ctx: ServiceContext,
  id: string,
): StoredOriginEndpoint => {
  const stored = ctx.store.get<StoredOriginEndpoint>(originEndpointKey(id));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `OriginEndpoint not found for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requireHarvestJob = (
  ctx: ServiceContext,
  id: string,
): StoredHarvestJob => {
  const stored = ctx.store.get<StoredHarvestJob>(harvestJobKey(id));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `HarvestJob not found for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const defaultIngestEndpoints = (
  ctx: ServiceContext,
  channelId: string,
): IngestEndpoint[] => [
  {
    Id: `${channelId}-0`,
    Password: `pw-${channelId}-0`,
    Url: `https://${channelId}.mediapackage.${ctx.region}.amazonaws.com/in/v2/${channelId}/0`,
    Username: `user-${channelId}-0`,
  },
  {
    Id: `${channelId}-1`,
    Password: `pw-${channelId}-1`,
    Url: `https://${channelId}.mediapackage.${ctx.region}.amazonaws.com/in/v2/${channelId}/1`,
    Username: `user-${channelId}-1`,
  },
];

const CreateChannel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  if (ctx.store.get<StoredChannel>(channelKey(id)) !== undefined) {
    throw awsError(
      "UnprocessableEntityException",
      `Channel ${id} exists.`,
      422,
    );
  }
  const tags = recordOrEmpty(input["Tags"]) as Record<string, string>;
  const channel: StoredChannel = {
    Id: id,
    Arn: channelArn(ctx, id),
    Description: stringOrUndefined(input["Description"]) ?? "",
    CreatedAt: new Date().toISOString(),
    Tags: tags,
    HlsIngest: { IngestEndpoints: defaultIngestEndpoints(ctx, id) },
  };
  ctx.store.set(channelKey(id), channel);
  if (Object.keys(tags).length > 0) {
    const existing =
      ctx.store.get<Record<string, string>>(tagKey(channel.Arn)) ?? {};
    ctx.store.set(tagKey(channel.Arn), { ...existing, ...tags });
  }
  return channel;
};

const DescribeChannel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  return requireChannel(ctx, id);
};

const ListChannels: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredChannel>()
    .filter((entry) => entry.key.startsWith(channelPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Id < b.Id ? -1 : a.Id > b.Id ? 1 : 0));
  const { page, nextToken } = paginateItems(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Channels: page, NextToken: nextToken };
};

const DeleteChannel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  requireChannel(ctx, id);
  ctx.store.delete(channelKey(id));
  return {};
};

const UpdateChannel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const channel = requireChannel(ctx, id);
  const updated: StoredChannel = {
    ...channel,
    Description: stringOrUndefined(input["Description"]) ?? channel.Description,
  };
  ctx.store.set(channelKey(id), updated);
  return updated;
};

const ConfigureLogs: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const channel = requireChannel(ctx, id);
  const updated: StoredChannel = {
    ...channel,
    EgressAccessLogs:
      input["EgressAccessLogs"] !== undefined
        ? (input["EgressAccessLogs"] as EgressAccessLogs)
        : channel.EgressAccessLogs,
    IngressAccessLogs:
      input["IngressAccessLogs"] !== undefined
        ? (input["IngressAccessLogs"] as IngressAccessLogs)
        : channel.IngressAccessLogs,
  };
  ctx.store.set(channelKey(id), updated);
  return updated;
};

const RotateChannelCredentials: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const channel = requireChannel(ctx, id);
  const rotated: StoredChannel = {
    ...channel,
    HlsIngest: {
      IngestEndpoints: channel.HlsIngest.IngestEndpoints.map((ep) => ({
        ...ep,
        Password: `pw-rotated-${ep.Id}`,
        Username: `user-rotated-${ep.Id}`,
      })),
    },
  };
  ctx.store.set(channelKey(id), rotated);
  return rotated;
};

const RotateIngestEndpointCredentials: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const ingestEndpointId = requireString(input, "IngestEndpointId");
  const channel = requireChannel(ctx, id);
  const epExists = channel.HlsIngest.IngestEndpoints.some(
    (ep) => ep.Id === ingestEndpointId,
  );
  if (!epExists) {
    throw awsError(
      "NotFoundException",
      `IngestEndpoint not found for ID ${ingestEndpointId}.`,
      404,
    );
  }
  const rotated: StoredChannel = {
    ...channel,
    HlsIngest: {
      IngestEndpoints: channel.HlsIngest.IngestEndpoints.map((ep) =>
        ep.Id === ingestEndpointId
          ? {
              ...ep,
              Password: `pw-rotated-${ep.Id}`,
              Username: `user-rotated-${ep.Id}`,
            }
          : ep,
      ),
    },
  };
  ctx.store.set(channelKey(id), rotated);
  return rotated;
};

const CreateOriginEndpoint: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const channelId = requireString(input, "ChannelId");
  requireChannel(ctx, channelId);
  if (
    ctx.store.get<StoredOriginEndpoint>(originEndpointKey(id)) !== undefined
  ) {
    throw awsError(
      "UnprocessableEntityException",
      `OriginEndpoint ${id} exists.`,
      422,
    );
  }
  const epTags = recordOrEmpty(input["Tags"]) as Record<string, string>;
  const endpoint: StoredOriginEndpoint = {
    Id: id,
    Arn: originEndpointArn(ctx, id),
    ChannelId: channelId,
    Description: stringOrUndefined(input["Description"]) ?? "",
    CreatedAt: new Date().toISOString(),
    Tags: epTags,
    Url: `https://${id}.mediapackage.${ctx.region}.amazonaws.com/out/v1/${id}/index.m3u8`,
    ManifestName: stringOrUndefined(input["ManifestName"]) ?? "index",
    StartoverWindowSeconds:
      typeof input["StartoverWindowSeconds"] === "number"
        ? input["StartoverWindowSeconds"]
        : undefined,
    TimeDelaySeconds:
      typeof input["TimeDelaySeconds"] === "number"
        ? input["TimeDelaySeconds"]
        : undefined,
    Origination: stringOrUndefined(input["Origination"]),
    Whitelist: Array.isArray(input["Whitelist"])
      ? (input["Whitelist"] as string[])
      : undefined,
    Authorization: input["Authorization"],
    CmafPackage: input["CmafPackage"],
    DashPackage: input["DashPackage"],
    HlsPackage: input["HlsPackage"],
    MssPackage: input["MssPackage"],
  };
  ctx.store.set(originEndpointKey(id), endpoint);
  if (Object.keys(epTags).length > 0) {
    const existing =
      ctx.store.get<Record<string, string>>(tagKey(endpoint.Arn)) ?? {};
    ctx.store.set(tagKey(endpoint.Arn), { ...existing, ...epTags });
  }
  return endpoint;
};

const DescribeOriginEndpoint: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  return requireOriginEndpoint(ctx, id);
};

const ListOriginEndpoints: OperationHandler = (input, ctx) => {
  const channelId = stringOrUndefined(input["ChannelId"]);
  const all = ctx.store
    .list<StoredOriginEndpoint>()
    .filter((entry) => entry.key.startsWith(originEndpointPrefix))
    .map((entry) => entry.value)
    .filter((ep) => channelId === undefined || ep.ChannelId === channelId)
    .sort((a, b) => (a.Id < b.Id ? -1 : a.Id > b.Id ? 1 : 0));
  const { page, nextToken } = paginateItems(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { OriginEndpoints: page, NextToken: nextToken };
};

const UpdateOriginEndpoint: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const endpoint = requireOriginEndpoint(ctx, id);
  const updated: StoredOriginEndpoint = {
    ...endpoint,
    Description:
      stringOrUndefined(input["Description"]) ?? endpoint.Description,
    ManifestName:
      stringOrUndefined(input["ManifestName"]) ?? endpoint.ManifestName,
    StartoverWindowSeconds:
      typeof input["StartoverWindowSeconds"] === "number"
        ? input["StartoverWindowSeconds"]
        : endpoint.StartoverWindowSeconds,
    TimeDelaySeconds:
      typeof input["TimeDelaySeconds"] === "number"
        ? input["TimeDelaySeconds"]
        : endpoint.TimeDelaySeconds,
    Origination:
      stringOrUndefined(input["Origination"]) ?? endpoint.Origination,
    Whitelist: Array.isArray(input["Whitelist"])
      ? (input["Whitelist"] as string[])
      : endpoint.Whitelist,
    Authorization:
      input["Authorization"] !== undefined
        ? input["Authorization"]
        : endpoint.Authorization,
    CmafPackage:
      input["CmafPackage"] !== undefined
        ? input["CmafPackage"]
        : endpoint.CmafPackage,
    DashPackage:
      input["DashPackage"] !== undefined
        ? input["DashPackage"]
        : endpoint.DashPackage,
    HlsPackage:
      input["HlsPackage"] !== undefined
        ? input["HlsPackage"]
        : endpoint.HlsPackage,
    MssPackage:
      input["MssPackage"] !== undefined
        ? input["MssPackage"]
        : endpoint.MssPackage,
  };
  ctx.store.set(originEndpointKey(id), updated);
  return updated;
};

const DeleteOriginEndpoint: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  requireOriginEndpoint(ctx, id);
  ctx.store.delete(originEndpointKey(id));
  return {};
};

const CreateHarvestJob: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const originEndpointId = requireString(input, "OriginEndpointId");
  const endpoint = requireOriginEndpoint(ctx, originEndpointId);
  if (ctx.store.get<StoredHarvestJob>(harvestJobKey(id)) !== undefined) {
    throw awsError(
      "UnprocessableEntityException",
      `HarvestJob ${id} exists.`,
      422,
    );
  }
  const s3Raw = recordOrEmpty(input["S3Destination"]) as Record<
    string,
    unknown
  >;
  const bucketName = stringOrUndefined(s3Raw["BucketName"]);
  const manifestKey = stringOrUndefined(s3Raw["ManifestKey"]);
  const roleArn = stringOrUndefined(s3Raw["RoleArn"]);
  if (!bucketName || !manifestKey || !roleArn) {
    throw awsError(
      "ValidationException",
      "S3Destination requires BucketName, ManifestKey, and RoleArn.",
      422,
    );
  }
  const s3Dest: S3Destination = {
    BucketName: bucketName,
    ManifestKey: manifestKey,
    RoleArn: roleArn,
  };
  const job: StoredHarvestJob = {
    Id: id,
    Arn: harvestJobArn(ctx, id),
    ChannelId: endpoint.ChannelId,
    OriginEndpointId: originEndpointId,
    S3Destination: s3Dest,
    StartTime: requireString(input, "StartTime"),
    EndTime: requireString(input, "EndTime"),
    Status: "SUCCEEDED",
    CreatedAt: new Date().toISOString(),
  };
  ctx.store.set(harvestJobKey(id), job);
  return job;
};

const DescribeHarvestJob: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  return requireHarvestJob(ctx, id);
};

const ListHarvestJobs: OperationHandler = (input, ctx) => {
  const includeChannelId = stringOrUndefined(input["IncludeChannelId"]);
  const includeStatus = stringOrUndefined(input["IncludeStatus"]);
  const all = ctx.store
    .list<StoredHarvestJob>()
    .filter((entry) => entry.key.startsWith(harvestJobPrefix))
    .map((entry) => entry.value)
    .filter(
      (job) =>
        includeChannelId === undefined || job.ChannelId === includeChannelId,
    )
    .filter(
      (job) => includeStatus === undefined || job.Status === includeStatus,
    )
    .sort((a, b) => (a.Id < b.Id ? -1 : a.Id > b.Id ? 1 : 0));
  const { page, nextToken } = paginateItems(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { HarvestJobs: page, NextToken: nextToken };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const newTags = recordOrEmpty(input["Tags"]) as Record<string, string>;
  const existing = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  ctx.store.set(tagKey(arn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const keys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[])
    : [];
  const existing = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  const updated: Record<string, string> = {};
  for (const [k, v] of Object.entries(existing)) {
    if (!keys.includes(k)) updated[k] = v;
  }
  ctx.store.set(tagKey(arn), updated);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  return { Tags: tags };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const mediapackage = {
  name: "mediapackage",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);

    if (parts[0] === "channels") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateChannel";
        if (req.method === "GET") return "ListChannels";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeChannel";
        if (req.method === "DELETE") return "DeleteChannel";
        if (req.method === "PUT") return "UpdateChannel";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "configure_logs" && req.method === "PUT")
          return "ConfigureLogs";
        if (parts[2] === "credentials" && req.method === "PUT")
          return "RotateChannelCredentials";
        return undefined;
      }
      if (parts.length === 5) {
        if (
          parts[2] === "ingest_endpoints" &&
          parts[4] === "credentials" &&
          req.method === "PUT"
        )
          return "RotateIngestEndpointCredentials";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "origin_endpoints") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateOriginEndpoint";
        if (req.method === "GET") return "ListOriginEndpoints";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeOriginEndpoint";
        if (req.method === "PUT") return "UpdateOriginEndpoint";
        if (req.method === "DELETE") return "DeleteOriginEndpoint";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "harvest_jobs") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateHarvestJob";
        if (req.method === "GET") return "ListHarvestJobs";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeHarvestJob";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "tags" && parts.length >= 2) {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
    }

    return undefined;
  },
  operations: {
    CreateChannel,
    DescribeChannel,
    ListChannels,
    DeleteChannel,
    UpdateChannel,
    ConfigureLogs,
    RotateChannelCredentials,
    RotateIngestEndpointCredentials,
    CreateOriginEndpoint,
    DescribeOriginEndpoint,
    ListOriginEndpoints,
    UpdateOriginEndpoint,
    DeleteOriginEndpoint,
    CreateHarvestJob,
    DescribeHarvestJob,
    ListHarvestJobs,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default mediapackage;
