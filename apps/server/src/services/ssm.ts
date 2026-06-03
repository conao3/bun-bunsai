import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ssmModel from "../../../../test/vendor/aws-models/ssm.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(ssmModel);

type StoredParameter = {
  Name: string;
  Type: string;
  Value: string;
  Version: number;
  LastModifiedDate: string;
  ARN: string;
  Labels?: Record<string, string[]>;
  History?: ParameterHistoryEntry[];
};

type ParameterHistoryEntry = {
  Name: string;
  Type: string;
  Value: string;
  Version: number;
  LastModifiedDate: string;
};

type StoredTags = {
  ResourceType: string;
  ResourceId: string;
  Tags: Record<string, string>;
};

const tagsKey = (resourceType: string, resourceId: string): string =>
  `__tags__/${resourceType}/${resourceId}`;

const arnOf = (region: string, account: string, name: string): string => {
  const trimmed = name.startsWith("/") ? name.slice(1) : name;
  return `arn:aws:ssm:${region}:${account}:parameter/${trimmed}`;
};

const requireName = (input: Record<string, unknown>): string => {
  const name = input["Name"];
  if (typeof name !== "string" || name === "") {
    throw awsError("ValidationException", "Name is required.", 400);
  }
  return name;
};

const toApiParameter = (stored: StoredParameter): Record<string, unknown> => ({
  Name: stored.Name,
  Type: stored.Type,
  Value: stored.Value,
  Version: stored.Version,
  LastModifiedDate: stored.LastModifiedDate,
  ARN: stored.ARN,
});

const PutParameter: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const value = input["Value"];
  if (typeof value !== "string") {
    throw awsError("ValidationException", "Value is required.", 400);
  }
  const type = typeof input["Type"] === "string" ? input["Type"] : "String";
  const overwrite = input["Overwrite"] === true;
  const existing = ctx.store.get<StoredParameter>(name);
  if (existing !== undefined && !overwrite) {
    throw awsError(
      "ParameterAlreadyExists",
      `The parameter already exists. To overwrite this value, set the overwrite option in the request to true.`,
      400,
    );
  }
  const version = existing === undefined ? 1 : existing.Version + 1;
  const lastModified = new Date().toISOString();
  const history = existing?.History ?? [];
  const stored: StoredParameter = {
    Name: name,
    Type: type,
    Value: value,
    Version: version,
    LastModifiedDate: lastModified,
    ARN: arnOf(ctx.region, ctx.account, name),
    Labels: existing?.Labels,
    History: [
      ...history,
      {
        Name: name,
        Type: type,
        Value: value,
        Version: version,
        LastModifiedDate: lastModified,
      },
    ],
  };
  ctx.store.set(name, stored);
  return { Version: version, Tier: "Standard" };
};

const GetParameter: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const stored = ctx.store.get<StoredParameter>(name);
  if (stored === undefined) {
    throw awsError("ParameterNotFound", `Parameter ${name} not found.`, 400);
  }
  return { Parameter: toApiParameter(stored) };
};

const GetParameters: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["Names"])
    ? (input["Names"] as unknown[]).map((value) => String(value))
    : [];
  const parameters: Record<string, unknown>[] = [];
  const invalid: string[] = [];
  for (const name of names) {
    const stored = ctx.store.get<StoredParameter>(name);
    if (stored === undefined) {
      invalid.push(name);
      continue;
    }
    parameters.push(toApiParameter(stored));
  }
  return { Parameters: parameters, InvalidParameters: invalid };
};

const GetParametersByPath: OperationHandler = (input, ctx) => {
  const path = input["Path"];
  if (typeof path !== "string" || path === "") {
    throw awsError("ValidationException", "Path is required.", 400);
  }
  const recursive = input["Recursive"] === true;
  const normalized = path.endsWith("/") ? path : `${path}/`;
  const parameters = ctx.store
    .list<StoredParameter>()
    .filter((entry) => {
      if (entry.key.startsWith("__tags__/")) return false;
      if (!entry.key.startsWith(normalized)) return false;
      if (recursive) return true;
      const rest = entry.key.slice(normalized.length);
      return !rest.includes("/");
    })
    .map((entry) => toApiParameter(entry.value));
  return { Parameters: parameters };
};

const DeleteParameter: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const removed = ctx.store.delete(name);
  if (!removed) {
    throw awsError("ParameterNotFound", `Parameter ${name} not found.`, 400);
  }
  return {};
};

const DescribeParameters: OperationHandler = (input, ctx) => {
  void input;
  const parameters = ctx.store
    .list<StoredParameter>()
    .filter((entry) => !entry.key.startsWith("__tags__/"))
    .map((entry) => ({
      Name: entry.value.Name,
      Type: entry.value.Type,
      Version: entry.value.Version,
      LastModifiedDate: entry.value.LastModifiedDate,
      ARN: entry.value.ARN,
      Tier: "Standard",
    }));
  return { Parameters: parameters };
};

const requireResourceTarget = (
  input: Record<string, unknown>,
): { resourceType: string; resourceId: string } => {
  const resourceType = input["ResourceType"];
  if (typeof resourceType !== "string" || resourceType === "") {
    throw awsError("ValidationException", "ResourceType is required.", 400);
  }
  const resourceId = input["ResourceId"];
  if (typeof resourceId !== "string" || resourceId === "") {
    throw awsError("ValidationException", "ResourceId is required.", 400);
  }
  return { resourceType, resourceId };
};

const AddTagsToResource: OperationHandler = (input, ctx) => {
  const { resourceType, resourceId } = requireResourceTarget(input);
  const tags = Array.isArray(input["Tags"]) ? input["Tags"] : undefined;
  if (tags === undefined) {
    throw awsError("ValidationException", "Tags is required.", 400);
  }
  const key = tagsKey(resourceType, resourceId);
  const existing = ctx.store.get<StoredTags>(key);
  const merged: Record<string, string> = { ...(existing?.Tags ?? {}) };
  for (const tag of tags) {
    if (typeof tag !== "object" || tag === null) continue;
    const record = tag as Record<string, unknown>;
    const tagKey = record["Key"];
    const tagValue = record["Value"];
    if (typeof tagKey !== "string") {
      throw awsError("ValidationException", "Tag Key is required.", 400);
    }
    merged[tagKey] = typeof tagValue === "string" ? tagValue : "";
  }
  ctx.store.set(key, {
    ResourceType: resourceType,
    ResourceId: resourceId,
    Tags: merged,
  });
  return {};
};

const RemoveTagsFromResource: OperationHandler = (input, ctx) => {
  const { resourceType, resourceId } = requireResourceTarget(input);
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as unknown[]).map((value) => String(value))
    : [];
  const key = tagsKey(resourceType, resourceId);
  const existing = ctx.store.get<StoredTags>(key);
  if (existing === undefined) {
    return {};
  }
  const remaining: Record<string, string> = { ...existing.Tags };
  for (const tagKey of tagKeys) {
    delete remaining[tagKey];
  }
  ctx.store.set(key, {
    ResourceType: resourceType,
    ResourceId: resourceId,
    Tags: remaining,
  });
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const { resourceType, resourceId } = requireResourceTarget(input);
  const existing = ctx.store.get<StoredTags>(tagsKey(resourceType, resourceId));
  const tags = existing?.Tags ?? {};
  const tagList = Object.keys(tags).map((tagKey) => ({
    Key: tagKey,
    Value: tags[tagKey],
  }));
  return { TagList: tagList };
};

const LabelParameterVersion: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const stored = ctx.store.get<StoredParameter>(name);
  if (stored === undefined) {
    throw awsError("ParameterNotFound", `Parameter ${name} not found.`, 400);
  }
  const labels = Array.isArray(input["Labels"])
    ? (input["Labels"] as unknown[]).map((value) => String(value))
    : [];
  if (labels.length === 0) {
    throw awsError("ValidationException", "Labels is required.", 400);
  }
  const rawVersion = input["ParameterVersion"];
  const version =
    typeof rawVersion === "number" && Number.isFinite(rawVersion)
      ? rawVersion
      : stored.Version;
  if (!stored.History?.some((entry) => entry.Version === version)) {
    throw awsError(
      "ParameterVersionNotFound",
      `Parameter version ${version} not found for ${name}.`,
      400,
    );
  }
  const labelsByVersion: Record<string, string[]> = {
    ...(stored.Labels ?? {}),
  };
  const invalid: string[] = [];
  const applied: string[] = [];
  for (const label of labels) {
    if (/^[0-9]/.test(label) || /^(aws|ssm)/i.test(label)) {
      invalid.push(label);
      continue;
    }
    applied.push(label);
  }
  for (const otherVersion of Object.keys(labelsByVersion)) {
    labelsByVersion[otherVersion] = labelsByVersion[otherVersion].filter(
      (label) => !applied.includes(label),
    );
  }
  const versionKey = String(version);
  const current = labelsByVersion[versionKey] ?? [];
  labelsByVersion[versionKey] = Array.from(new Set([...current, ...applied]));
  ctx.store.set(name, { ...stored, Labels: labelsByVersion });
  return { InvalidLabels: invalid, ParameterVersion: version };
};

const GetParameterHistory: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const stored = ctx.store.get<StoredParameter>(name);
  if (stored === undefined) {
    throw awsError("ParameterNotFound", `Parameter ${name} not found.`, 400);
  }
  const labelsByVersion = stored.Labels ?? {};
  const history = stored.History ?? [];
  const parameters = history.map((entry) => ({
    Name: entry.Name,
    Type: entry.Type,
    Value: entry.Value,
    Version: entry.Version,
    LastModifiedDate: entry.LastModifiedDate,
    Labels: labelsByVersion[String(entry.Version)] ?? [],
    Tier: "Standard",
  }));
  return { Parameters: parameters };
};

const ssm: ServiceDefinition = {
  name: "ssm",
  protocol: "json",
  operations: {
    PutParameter,
    GetParameter,
    GetParameters,
    GetParametersByPath,
    DeleteParameter,
    DescribeParameters,
    AddTagsToResource,
    RemoveTagsFromResource,
    ListTagsForResource,
    LabelParameterVersion,
    GetParameterHistory,
  },
  model,
} as const;

export default ssm;
