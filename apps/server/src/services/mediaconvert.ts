import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import mediaconvertModel from "../../../../test/vendor/aws-models/mediaconvert.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(mediaconvertModel);

const queuePrefix = "queue:" as const;
const presetPrefix = "preset:" as const;
const jobTemplatePrefix = "jobTemplate:" as const;
const jobPrefix = "job:" as const;
const tagsPrefix = "tags:" as const;

type StoredQueue = {
  Arn: string;
  ConcurrentJobs: number | undefined;
  CreatedAt: number;
  Description: string | undefined;
  LastUpdated: number;
  MaximumConcurrentFeeds: number | undefined;
  Name: string;
  PricingPlan: string;
  Status: string;
  Tags: Record<string, string> | undefined;
  Type: string;
};

type StoredPreset = {
  Arn: string;
  Category: string | undefined;
  CreatedAt: number;
  Description: string | undefined;
  LastUpdated: number;
  Name: string;
  Settings: Record<string, unknown>;
  Tags: Record<string, string> | undefined;
  Type: string;
};

type StoredJobTemplate = {
  Arn: string;
  AccelerationSettings: Record<string, unknown> | undefined;
  Category: string | undefined;
  CreatedAt: number;
  Description: string | undefined;
  HopDestinations: unknown[] | undefined;
  LastUpdated: number;
  Name: string;
  Priority: number | undefined;
  Queue: string | undefined;
  Settings: Record<string, unknown> | undefined;
  StatusUpdateInterval: string | undefined;
  Tags: Record<string, string> | undefined;
  Type: string;
};

type StoredJob = {
  Arn: string;
  CreatedAt: number;
  Id: string;
  JobTemplate: string | undefined;
  Priority: number;
  Queue: string | undefined;
  Role: string;
  Settings: Record<string, unknown>;
  Tags: Record<string, string> | undefined;
  UserMetadata: Record<string, string> | undefined;
  CancelledAt: number | undefined;
  IsCancelled: boolean;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const arrayOrUndefined = (value: unknown): unknown[] | undefined =>
  Array.isArray(value) ? value : undefined;

const stringRecordOrUndefined = (
  value: unknown,
): Record<string, string> | undefined => {
  const r = recordOrUndefined(value);
  if (r === undefined) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "string") out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("BadRequestException", `${field} is required.`, 400);
  }
  return value;
};

const now = (): number => Math.floor(Date.now() / 1000);

const paginateItems = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
  maxCap = 20,
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

const queueKey = (name: string): string => `${queuePrefix}${name}`;

const queueArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:mediaconvert:${ctx.region}:${ctx.account}:queues/${name}`;

const getOrCreateDefaultQueue = (ctx: ServiceContext): StoredQueue => {
  const key = queueKey("Default");
  const existing = ctx.store.get<StoredQueue>(key);
  if (existing !== undefined) return existing;
  const t = now();
  const q: StoredQueue = {
    Arn: queueArn(ctx, "Default"),
    ConcurrentJobs: undefined,
    CreatedAt: t,
    Description: "Default queue",
    LastUpdated: t,
    MaximumConcurrentFeeds: undefined,
    Name: "Default",
    PricingPlan: "ON_DEMAND",
    Status: "ACTIVE",
    Tags: undefined,
    Type: "SYSTEM",
  };
  ctx.store.set(key, q);
  return q;
};

const requireQueue = (ctx: ServiceContext, name: string): StoredQueue => {
  const stored = ctx.store.get<StoredQueue>(queueKey(name));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Queue with name ${name} does not exist.`,
      404,
    );
  }
  return stored;
};

const queueView = (q: StoredQueue): Record<string, unknown> => ({
  Arn: q.Arn,
  ConcurrentJobs: q.ConcurrentJobs,
  CreatedAt: q.CreatedAt,
  Description: q.Description,
  LastUpdated: q.LastUpdated,
  MaximumConcurrentFeeds: q.MaximumConcurrentFeeds,
  Name: q.Name,
  PricingPlan: q.PricingPlan,
  Status: q.Status,
  Tags: q.Tags,
  Type: q.Type,
});

const presetKey = (name: string): string => `${presetPrefix}${name}`;

const presetArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:mediaconvert:${ctx.region}:${ctx.account}:presets/${name}`;

const requirePreset = (ctx: ServiceContext, name: string): StoredPreset => {
  const stored = ctx.store.get<StoredPreset>(presetKey(name));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Preset with name ${name} does not exist.`,
      404,
    );
  }
  return stored;
};

const presetView = (p: StoredPreset): Record<string, unknown> => ({
  Arn: p.Arn,
  Category: p.Category,
  CreatedAt: p.CreatedAt,
  Description: p.Description,
  LastUpdated: p.LastUpdated,
  Name: p.Name,
  Settings: p.Settings,
  Tags: p.Tags,
  Type: p.Type,
});

const jobTemplateKey = (name: string): string => `${jobTemplatePrefix}${name}`;

const jobTemplateArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:mediaconvert:${ctx.region}:${ctx.account}:jobTemplates/${name}`;

const requireJobTemplate = (
  ctx: ServiceContext,
  name: string,
): StoredJobTemplate => {
  const stored = ctx.store.get<StoredJobTemplate>(jobTemplateKey(name));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `JobTemplate with name ${name} does not exist.`,
      404,
    );
  }
  return stored;
};

const jobTemplateView = (jt: StoredJobTemplate): Record<string, unknown> => ({
  Arn: jt.Arn,
  AccelerationSettings: jt.AccelerationSettings,
  Category: jt.Category,
  CreatedAt: jt.CreatedAt,
  Description: jt.Description,
  HopDestinations: jt.HopDestinations,
  LastUpdated: jt.LastUpdated,
  Name: jt.Name,
  Priority: jt.Priority,
  Queue: jt.Queue,
  Settings: jt.Settings,
  StatusUpdateInterval: jt.StatusUpdateInterval,
  Tags: jt.Tags,
  Type: jt.Type,
});

const jobKey = (id: string): string => `${jobPrefix}${id}`;

const jobArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:mediaconvert:${ctx.region}:${ctx.account}:jobs/${id}`;

const jobStatus = (job: StoredJob): string => {
  if (job.IsCancelled) return "CANCELED";
  const elapsed = now() - job.CreatedAt;
  if (elapsed < 5) return "SUBMITTED";
  if (elapsed < 30) return "PROGRESSING";
  return "COMPLETE";
};

const requireJob = (ctx: ServiceContext, id: string): StoredJob => {
  const stored = ctx.store.get<StoredJob>(jobKey(id));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Job with id ${id} does not exist.`,
      404,
    );
  }
  return stored;
};

const jobView = (job: StoredJob): Record<string, unknown> => ({
  Arn: job.Arn,
  CreatedAt: job.CreatedAt,
  Id: job.Id,
  JobTemplate: job.JobTemplate,
  Priority: job.Priority,
  Queue: job.Queue,
  Role: job.Role,
  Settings: job.Settings,
  Status: jobStatus(job),
  Tags: job.Tags,
  UserMetadata: job.UserMetadata,
});

const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;

const DescribeEndpoints: OperationHandler = (input, ctx) => {
  const host = `${ctx.account}.mediaconvert.${ctx.region}.amazonaws.com`;
  return {
    Endpoints: [{ Url: `https://${host}` }],
  };
};

const CreateQueue: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  getOrCreateDefaultQueue(ctx);
  if (ctx.store.get(queueKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Queue with name ${name} already exists.`,
      409,
    );
  }
  const t = now();
  const tags = stringRecordOrUndefined(input["Tags"]);
  const q: StoredQueue = {
    Arn: queueArn(ctx, name),
    ConcurrentJobs: numberOrUndefined(input["ConcurrentJobs"]),
    CreatedAt: t,
    Description: stringOrUndefined(input["Description"]),
    LastUpdated: t,
    MaximumConcurrentFeeds: numberOrUndefined(input["MaximumConcurrentFeeds"]),
    Name: name,
    PricingPlan: stringOrUndefined(input["PricingPlan"]) ?? "ON_DEMAND",
    Status: stringOrUndefined(input["Status"]) ?? "ACTIVE",
    Tags: tags,
    Type: "CUSTOM",
  };
  ctx.store.set(queueKey(name), q);
  if (tags !== undefined) {
    ctx.store.set(tagsKey(q.Arn), tags);
  }
  return { Queue: queueView(q) };
};

const GetQueue: OperationHandler = (input, ctx) => {
  getOrCreateDefaultQueue(ctx);
  const name = requireString(input, "Name");
  return { Queue: queueView(requireQueue(ctx, name)) };
};

const ListQueues: OperationHandler = (input, ctx) => {
  getOrCreateDefaultQueue(ctx);
  const items = ctx.store
    .list<StoredQueue>()
    .filter((entry) => entry.key.startsWith(queuePrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0))
    .map(queueView);
  const { page, nextToken } = paginateItems(
    items,
    input["MaxResults"],
    input["NextToken"],
    20,
  );
  return { Queues: page, NextToken: nextToken };
};

const UpdateQueue: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const q = requireQueue(ctx, name);
  if (q.Type === "SYSTEM") {
    throw awsError(
      "BadRequestException",
      "You can't modify system queues.",
      400,
    );
  }
  const updated: StoredQueue = {
    ...q,
    ConcurrentJobs:
      numberOrUndefined(input["ConcurrentJobs"]) ?? q.ConcurrentJobs,
    Description: stringOrUndefined(input["Description"]) ?? q.Description,
    MaximumConcurrentFeeds:
      numberOrUndefined(input["MaximumConcurrentFeeds"]) ??
      q.MaximumConcurrentFeeds,
    Status: stringOrUndefined(input["Status"]) ?? q.Status,
    LastUpdated: now(),
  };
  ctx.store.set(queueKey(name), updated);
  return { Queue: queueView(updated) };
};

const DeleteQueue: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const q = requireQueue(ctx, name);
  if (q.Type === "SYSTEM") {
    throw awsError(
      "BadRequestException",
      "You can't delete system queues.",
      400,
    );
  }
  ctx.store.delete(queueKey(name));
  return {};
};

const CreatePreset: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get(presetKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Preset with name ${name} already exists.`,
      409,
    );
  }
  const settings = recordOrUndefined(input["Settings"]);
  if (settings === undefined) {
    throw awsError("BadRequestException", "Settings is required.", 400);
  }
  const t = now();
  const tags = stringRecordOrUndefined(input["Tags"]);
  const p: StoredPreset = {
    Arn: presetArn(ctx, name),
    Category: stringOrUndefined(input["Category"]),
    CreatedAt: t,
    Description: stringOrUndefined(input["Description"]),
    LastUpdated: t,
    Name: name,
    Settings: settings,
    Tags: tags,
    Type: "CUSTOM",
  };
  ctx.store.set(presetKey(name), p);
  if (tags !== undefined) {
    ctx.store.set(tagsKey(p.Arn), tags);
  }
  return { Preset: presetView(p) };
};

const GetPreset: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  return { Preset: presetView(requirePreset(ctx, name)) };
};

const ListPresets: OperationHandler = (input, ctx) => {
  const items = ctx.store
    .list<StoredPreset>()
    .filter((entry) => entry.key.startsWith(presetPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0))
    .map(presetView);
  const { page, nextToken } = paginateItems(
    items,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Presets: page, NextToken: nextToken };
};

const UpdatePreset: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const p = requirePreset(ctx, name);
  if (p.Type === "SYSTEM") {
    throw awsError(
      "BadRequestException",
      "You can't modify system presets.",
      400,
    );
  }
  const updated: StoredPreset = {
    ...p,
    Category: stringOrUndefined(input["Category"]) ?? p.Category,
    Description: stringOrUndefined(input["Description"]) ?? p.Description,
    Settings: recordOrUndefined(input["Settings"]) ?? p.Settings,
    LastUpdated: now(),
  };
  ctx.store.set(presetKey(name), updated);
  return { Preset: presetView(updated) };
};

const DeletePreset: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const p = requirePreset(ctx, name);
  if (p.Type === "SYSTEM") {
    throw awsError(
      "BadRequestException",
      "You can't delete system presets.",
      400,
    );
  }
  ctx.store.delete(presetKey(name));
  return {};
};

const CreateJobTemplate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get(jobTemplateKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `JobTemplate with name ${name} already exists.`,
      409,
    );
  }
  const t = now();
  const tags = stringRecordOrUndefined(input["Tags"]);
  const jt: StoredJobTemplate = {
    Arn: jobTemplateArn(ctx, name),
    AccelerationSettings: recordOrUndefined(input["AccelerationSettings"]),
    Category: stringOrUndefined(input["Category"]),
    CreatedAt: t,
    Description: stringOrUndefined(input["Description"]),
    HopDestinations: arrayOrUndefined(input["HopDestinations"]),
    LastUpdated: t,
    Name: name,
    Priority: numberOrUndefined(input["Priority"]),
    Queue: stringOrUndefined(input["Queue"]),
    Settings: recordOrUndefined(input["Settings"]),
    StatusUpdateInterval: stringOrUndefined(input["StatusUpdateInterval"]),
    Tags: tags,
    Type: "CUSTOM",
  };
  ctx.store.set(jobTemplateKey(name), jt);
  if (tags !== undefined) {
    ctx.store.set(tagsKey(jt.Arn), tags);
  }
  return { JobTemplate: jobTemplateView(jt) };
};

const GetJobTemplate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  return { JobTemplate: jobTemplateView(requireJobTemplate(ctx, name)) };
};

const ListJobTemplates: OperationHandler = (input, ctx) => {
  const items = ctx.store
    .list<StoredJobTemplate>()
    .filter((entry) => entry.key.startsWith(jobTemplatePrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0))
    .map(jobTemplateView);
  const { page, nextToken } = paginateItems(
    items,
    input["MaxResults"],
    input["NextToken"],
  );
  return { JobTemplates: page, NextToken: nextToken };
};

const UpdateJobTemplate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const jt = requireJobTemplate(ctx, name);
  if (jt.Type === "SYSTEM") {
    throw awsError(
      "BadRequestException",
      "You can't modify system job templates.",
      400,
    );
  }
  const updated: StoredJobTemplate = {
    ...jt,
    AccelerationSettings:
      recordOrUndefined(input["AccelerationSettings"]) ??
      jt.AccelerationSettings,
    Category: stringOrUndefined(input["Category"]) ?? jt.Category,
    Description: stringOrUndefined(input["Description"]) ?? jt.Description,
    HopDestinations:
      arrayOrUndefined(input["HopDestinations"]) ?? jt.HopDestinations,
    Priority: numberOrUndefined(input["Priority"]) ?? jt.Priority,
    Queue: stringOrUndefined(input["Queue"]) ?? jt.Queue,
    Settings: recordOrUndefined(input["Settings"]) ?? jt.Settings,
    StatusUpdateInterval:
      stringOrUndefined(input["StatusUpdateInterval"]) ??
      jt.StatusUpdateInterval,
    LastUpdated: now(),
  };
  ctx.store.set(jobTemplateKey(name), updated);
  return { JobTemplate: jobTemplateView(updated) };
};

const DeleteJobTemplate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const jt = requireJobTemplate(ctx, name);
  if (jt.Type === "SYSTEM") {
    throw awsError(
      "BadRequestException",
      "You can't delete system job templates.",
      400,
    );
  }
  ctx.store.delete(jobTemplateKey(name));
  return {};
};

const CreateJob: OperationHandler = (input, ctx) => {
  const role = requireString(input, "Role");
  const settings = recordOrUndefined(input["Settings"]);
  if (settings === undefined) {
    throw awsError("BadRequestException", "Settings is required.", 400);
  }
  const id = `${now()}-${Math.random().toString(36).slice(2, 9)}`;
  const tags = stringRecordOrUndefined(input["Tags"]);
  const job: StoredJob = {
    Arn: jobArn(ctx, id),
    CreatedAt: now(),
    Id: id,
    JobTemplate: stringOrUndefined(input["JobTemplate"]),
    Priority: numberOrUndefined(input["Priority"]) ?? 0,
    Queue: stringOrUndefined(input["Queue"]),
    Role: role,
    Settings: settings,
    Tags: tags,
    UserMetadata: stringRecordOrUndefined(input["UserMetadata"]),
    CancelledAt: undefined,
    IsCancelled: false,
  };
  ctx.store.set(jobKey(id), job);
  if (tags !== undefined) {
    ctx.store.set(tagsKey(job.Arn), tags);
  }
  return { Job: jobView(job) };
};

const GetJob: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  return { Job: jobView(requireJob(ctx, id)) };
};

const ListJobs: OperationHandler = (input, ctx) => {
  const items = ctx.store
    .list<StoredJob>()
    .filter((entry) => entry.key.startsWith(jobPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreatedAt - a.CreatedAt)
    .map(jobView);
  const { page, nextToken } = paginateItems(
    items,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Jobs: page, NextToken: nextToken };
};

const CancelJob: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const job = requireJob(ctx, id);
  const status = jobStatus(job);
  if (status !== "SUBMITTED" && status !== "PROGRESSING") {
    throw awsError(
      "ConflictException",
      `Job ${id} cannot be cancelled because its status is ${status}.`,
      409,
    );
  }
  const cancelled: StoredJob = {
    ...job,
    IsCancelled: true,
    CancelledAt: now(),
  };
  ctx.store.set(jobKey(id), cancelled);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const tags = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  return { ResourceTags: { Arn: arn, Tags: tags } };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const newTags = stringRecordOrUndefined(input["Tags"]);
  if (newTags === undefined) {
    throw awsError("BadRequestException", "Tags is required.", 400);
  }
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  ctx.store.set(tagsKey(arn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const keysToRemove = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[])
    : [];
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  const updated = { ...existing };
  for (const k of keysToRemove) {
    delete updated[k];
  }
  ctx.store.set(tagsKey(arn), updated);
  return {};
};

const AssociateCertificate: OperationHandler = () => ({});
const DisassociateCertificate: OperationHandler = () => ({});
const CreateResourceShare: OperationHandler = () => ({});

const GetPolicy: OperationHandler = (_, ctx) => {
  const policy = ctx.store.get<Record<string, unknown>>("policy") ?? {};
  return { Policy: policy };
};

const PutPolicy: OperationHandler = (input, ctx) => {
  const policy = recordOrUndefined(input["Policy"]) ?? {};
  ctx.store.set("policy", policy);
  return { Policy: policy };
};

const DeletePolicy: OperationHandler = (_, ctx) => {
  ctx.store.delete("policy");
  return {};
};

const ListVersions: OperationHandler = () => ({ Versions: [] });
const Probe: OperationHandler = () => ({ ProbeResults: [] });
const SearchJobs: OperationHandler = () => ({ Jobs: [] });
const StartJobsQuery: OperationHandler = () => ({});
const GetJobsQueryResults: OperationHandler = () => ({ Jobs: [] });

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const mediaconvert = {
  name: "mediaconvert",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts.length === 0 || parts[0] !== "2017-08-29") return undefined;
    const r1 = parts[1];
    const m = req.method;

    if (r1 === "endpoints" && parts.length === 2) {
      if (m === "POST") return "DescribeEndpoints";
      return undefined;
    }

    if (r1 === "queues") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateQueue";
        if (m === "GET") return "ListQueues";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "GetQueue";
        if (m === "PUT") return "UpdateQueue";
        if (m === "DELETE") return "DeleteQueue";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "presets") {
      if (parts.length === 2) {
        if (m === "POST") return "CreatePreset";
        if (m === "GET") return "ListPresets";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "GetPreset";
        if (m === "PUT") return "UpdatePreset";
        if (m === "DELETE") return "DeletePreset";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "jobTemplates") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateJobTemplate";
        if (m === "GET") return "ListJobTemplates";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "GetJobTemplate";
        if (m === "PUT") return "UpdateJobTemplate";
        if (m === "DELETE") return "DeleteJobTemplate";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "jobs") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateJob";
        if (m === "GET") return "ListJobs";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "GetJob";
        if (m === "DELETE") return "CancelJob";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "tags") {
      if (parts.length === 2) {
        if (m === "POST") return "TagResource";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "ListTagsForResource";
        if (m === "PUT") return "UntagResource";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "certificates") {
      if (parts.length === 2 && m === "POST") return "AssociateCertificate";
      if (parts.length === 3 && m === "DELETE")
        return "DisassociateCertificate";
      return undefined;
    }

    if (r1 === "resourceShares" && parts.length === 2 && m === "POST")
      return "CreateResourceShare";

    if (r1 === "policy" && parts.length === 2) {
      if (m === "GET") return "GetPolicy";
      if (m === "PUT") return "PutPolicy";
      if (m === "DELETE") return "DeletePolicy";
      return undefined;
    }

    if (r1 === "versions" && parts.length === 2 && m === "GET")
      return "ListVersions";
    if (r1 === "probe" && parts.length === 2 && m === "POST") return "Probe";
    if (r1 === "search" && parts.length === 2 && m === "GET")
      return "SearchJobs";
    if (r1 === "jobsQueries") {
      if (parts.length === 2 && m === "POST") return "StartJobsQuery";
      if (parts.length === 3 && m === "GET") return "GetJobsQueryResults";
      return undefined;
    }

    return undefined;
  },
  operations: {
    DescribeEndpoints,
    CreateQueue,
    GetQueue,
    ListQueues,
    UpdateQueue,
    DeleteQueue,
    CreatePreset,
    GetPreset,
    ListPresets,
    UpdatePreset,
    DeletePreset,
    CreateJobTemplate,
    GetJobTemplate,
    ListJobTemplates,
    UpdateJobTemplate,
    DeleteJobTemplate,
    CreateJob,
    GetJob,
    ListJobs,
    CancelJob,
    ListTagsForResource,
    TagResource,
    UntagResource,
    AssociateCertificate,
    DisassociateCertificate,
    CreateResourceShare,
    GetPolicy,
    PutPolicy,
    DeletePolicy,
    ListVersions,
    Probe,
    SearchJobs,
    StartJobsQuery,
    GetJobsQueryResults,
  },
  model,
} as const satisfies ServiceDefinition;

export default mediaconvert;
