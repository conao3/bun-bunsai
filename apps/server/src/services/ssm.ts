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

type StoredDocument = {
  Name: string;
  DocumentType: string;
  DocumentFormat: string;
  Content: string;
  Status: string;
  DocumentVersion: string;
  LatestVersion: string;
  DefaultVersion: string;
  CreatedDate: string;
  Owner: string;
  Description: string;
  SchemaVersion: string;
  Sha1: string;
  Hash: string;
  HashType: string;
  Tags: { Key: string; Value: string }[];
  Versions: StoredDocumentVersion[];
  Permissions: {
    AccountIds: string[];
    AccountSharingInfoList: {
      AccountId: string;
      SharedDocumentVersion: string;
    }[];
  };
};

type StoredDocumentVersion = {
  Name: string;
  DocumentVersion: string;
  CreatedDate: string;
  IsDefaultVersion: boolean;
  DocumentFormat: string;
  Status: string;
  Content: string;
};

type StoredAssociation = {
  AssociationId: string;
  AssociationName: string;
  Name: string;
  DocumentVersion: string;
  Parameters: Record<string, string[]>;
  Targets: { Key: string; Values: string[] }[];
  ScheduleExpression: string;
  Status: { Name: string; Date: string; Message: string };
  Overview: {
    Status: string;
    AssociationStatusAggregatedCount: Record<string, number>;
  };
  LastExecutionDate: string;
  AssociationVersion: string;
  Versions: StoredAssociationVersion[];
};

type StoredAssociationVersion = {
  AssociationId: string;
  AssociationVersion: string;
  CreatedDate: string;
  Name: string;
  DocumentVersion: string;
  Parameters: Record<string, string[]>;
  Targets: { Key: string; Values: string[] }[];
  ScheduleExpression: string;
};

type StoredMaintenanceWindow = {
  WindowId: string;
  Name: string;
  Description: string;
  Enabled: boolean;
  Schedule: string;
  ScheduleTimezone: string;
  Duration: number;
  Cutoff: number;
  AllowUnassociatedTargets: boolean;
  CreatedDate: string;
  ModifiedDate: string;
  NextExecutionTime: string;
  ClientToken?: string;
};

type StoredMWTarget = {
  WindowId: string;
  WindowTargetId: string;
  ResourceType: string;
  Targets: { Key: string; Values: string[] }[];
  Name: string;
  Description: string;
  OwnerInformation: string;
};

type StoredMWTask = {
  WindowId: string;
  WindowTaskId: string;
  TaskArn: string;
  Type: string;
  Targets: { Key: string; Values: string[] }[];
  TaskParameters: Record<string, { Values: string[] }>;
  Priority: number;
  MaxConcurrency: string;
  MaxErrors: string;
  Name: string;
  Description: string;
  ServiceRoleArn: string;
};

type StoredMWExecution = {
  WindowId: string;
  WindowExecutionId: string;
  Status: string;
  StatusDetails: string;
  StartTime: string;
  EndTime: string;
};

type StoredPatchBaseline = {
  BaselineId: string;
  Name: string;
  OperatingSystem: string;
  Description: string;
  GlobalFilters: { PatchFilters: { Key: string; Values: string[] }[] };
  ApprovalRules: {
    PatchRules: {
      PatchFilterGroup: { PatchFilters: { Key: string; Values: string[] }[] };
      ApproveAfterDays: number;
    }[];
  };
  ApprovedPatches: string[];
  RejectedPatches: string[];
  CreatedDate: string;
  ModifiedDate: string;
  PatchGroups: string[];
  DefaultBaseline: boolean;
  Tags: { Key: string; Value: string }[];
  ClientToken?: string;
};

type StoredOpsItem = {
  OpsItemId: string;
  Title: string;
  Description: string;
  Status: string;
  Priority: number;
  Source: string;
  CreatedTime: string;
  LastModifiedTime: string;
  OpsItemType: string;
  Notifications: { Arn: string }[];
  RelatedOpsItems: { OpsItemId: string; OpsItemType: string }[];
  OperationalData: Record<string, { Value: string; Type: string }>;
  Category: string;
  Severity: string;
  Tags: { Key: string; Value: string }[];
  RelatedItems: StoredOpsItemRelatedItem[];
  Events: StoredOpsItemEvent[];
};

type StoredOpsItemRelatedItem = {
  AssociationId: string;
  ResourceType: string;
  AssociationType: string;
  ResourceUri: string;
  CreatedTime: string;
};

type StoredOpsItemEvent = {
  OpsItemId: string;
  EventId: string;
  Source: string;
  DetailType: string;
  Detail: string;
  CreatedTime: string;
};

type StoredOpsMetadata = {
  OpsMetadataArn: string;
  ResourceId: string;
  Metadata: Record<string, { Value: string }>;
  CreationDate: string;
  LastModifiedDate: string;
};

type StoredActivation = {
  ActivationId: string;
  Description: string;
  DefaultInstanceName: string;
  IamRole: string;
  RegistrationLimit: number;
  RegistrationsCount: number;
  ExpirationDate: string;
  Expired: boolean;
  CreatedDate: string;
  Tags: { Key: string; Value: string }[];
};

type StoredResourceDataSync = {
  SyncName: string;
  SyncType: string;
  S3Destination: Record<string, unknown>;
  LastSyncTime: string;
  LastSuccessfulSyncTime: string;
  LastStatus: string;
  SyncCreatedTime: string;
  LastSyncStatusMessage: string;
  SyncSource: Record<string, unknown>;
};

type StoredCommand = {
  CommandId: string;
  DocumentName: string;
  DocumentVersion: string;
  Comment: string;
  Parameters: Record<string, string[]>;
  Targets: { Key: string; Values: string[] }[];
  RequestedDateTime: string;
  Status: string;
  StatusDetails: string;
  OutputS3BucketName: string;
  OutputS3KeyPrefix: string;
  ServiceRole: string;
  Invocations: StoredCommandInvocation[];
};

type StoredCommandInvocation = {
  CommandId: string;
  InstanceId: string;
  InstanceName: string;
  Comment: string;
  DocumentName: string;
  DocumentVersion: string;
  RequestedDateTime: string;
  Status: string;
  StatusDetails: string;
  StandardOutputContent: string;
  StandardErrorContent: string;
  CommandPlugins: {
    Name: string;
    Status: string;
    StatusDetails: string;
    ResponseCode: number;
    Output: string;
  }[];
};

type StoredAutomationExecution = {
  AutomationExecutionId: string;
  DocumentName: string;
  DocumentVersion: string;
  Status: string;
  StartTime: string;
  EndTime: string;
  Parameters: Record<string, string[]>;
  Outputs: Record<string, string[]>;
  AutomationType: string;
  Steps: StoredStepExecution[];
};

type StoredStepExecution = {
  StepName: string;
  Action: string;
  StepStatus: string;
  ExecutionStartTime: string;
  ExecutionEndTime: string;
  Inputs: Record<string, string>;
  Outputs: Record<string, string[]>;
  StepExecutionId: string;
};

type StoredSession = {
  SessionId: string;
  Target: string;
  Status: string;
  StartDate: string;
  EndDate: string;
  DocumentName: string;
  Owner: string;
  StreamUrl: string;
  TokenValue: string;
};

type StoredInventory = {
  InstanceId: string;
  TypeName: string;
  SchemaVersion: string;
  CaptureTime: string;
  ContentHash: string;
  Content: Record<string, unknown>[];
};

type StoredComplianceItem = {
  ResourceId: string;
  ResourceType: string;
  ComplianceType: string;
  ExecutionSummary: {
    ExecutionTime: string;
    ExecutionId: string;
    ExecutionType: string;
  };
  Items: {
    Id: string;
    Title: string;
    Severity: string;
    Status: string;
    Details: Record<string, string>;
  }[];
};

type StoredServiceSetting = {
  SettingId: string;
  SettingValue: string;
  LastModifiedDate: string;
  LastModifiedUser: string;
  ARN: string;
  Status: string;
};

type StoredResourcePolicy = {
  PolicyId: string;
  PolicyHash: string;
  Policy: string;
  ResourceArn: string;
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

const toApiParameter = (
  stored: StoredParameter,
  withDecryption: boolean,
): Record<string, unknown> => ({
  Name: stored.Name,
  Type: stored.Type,
  Value:
    !withDecryption && stored.Type === "SecureString"
      ? `kms:ssm:${Buffer.from(stored.Value).toString("base64")}`
      : stored.Value,
  Version: stored.Version,
  LastModifiedDate: stored.LastModifiedDate,
  ARN: stored.ARN,
});

const encodePageToken = (offset: number): string =>
  Buffer.from(String(offset), "utf8").toString("base64");

const decodePageToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") return 0;
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const applyParameterFilters = (
  parameters: StoredParameter[],
  filters: unknown,
): StoredParameter[] => {
  if (!Array.isArray(filters) || filters.length === 0) return parameters;
  return parameters.filter((p) =>
    (filters as unknown[]).every((f) => {
      if (typeof f !== "object" || f === null) return true;
      const filter = f as Record<string, unknown>;
      const key = filter["Key"];
      const option =
        typeof filter["Option"] === "string" ? filter["Option"] : "Equals";
      const values = Array.isArray(filter["Values"])
        ? (filter["Values"] as unknown[]).map((v) => String(v))
        : [];
      if (key === "Type") {
        return option === "Equals"
          ? values.includes(p.Type)
          : values.some((v) => p.Type.startsWith(v));
      }
      if (key === "Name") {
        return option === "Equals"
          ? values.includes(p.Name)
          : values.some((v) => p.Name.startsWith(v));
      }
      return true;
    }),
  );
};

const parseSelector = (
  name: string,
): { baseName: string; selector: string | undefined } => {
  const idx = name.lastIndexOf(":");
  if (idx === -1) return { baseName: name, selector: undefined };
  const sel = name.slice(idx + 1);
  if (sel === "") return { baseName: name, selector: undefined };
  return { baseName: name.slice(0, idx), selector: sel };
};

const resolveParameterBySelector = (
  ctx: ServiceContext,
  baseName: string,
  selector: string | undefined,
): StoredParameter => {
  const stored = ctx.store.get<StoredParameter>(baseName);
  if (stored === undefined) {
    throw awsError(
      "ParameterNotFound",
      `Parameter ${baseName} not found.`,
      400,
    );
  }
  if (selector === undefined) return stored;
  if (/^\d+$/.test(selector)) {
    const version = Number(selector);
    const entry = stored.History?.find((e) => e.Version === version);
    if (entry === undefined) {
      throw awsError(
        "ParameterVersionNotFound",
        `Parameter version ${version} not found for ${baseName}.`,
        400,
      );
    }
    return {
      ...stored,
      Value: entry.Value,
      Type: entry.Type,
      Version: entry.Version,
      LastModifiedDate: entry.LastModifiedDate,
    };
  }
  const labelsByVersion = stored.Labels ?? {};
  const versionKey = Object.keys(labelsByVersion).find((vk) =>
    labelsByVersion[vk].includes(selector),
  );
  if (versionKey === undefined) {
    throw awsError(
      "ParameterVersionLabelNotFound",
      `Label ${selector} not found for ${baseName}.`,
      400,
    );
  }
  const version = Number(versionKey);
  const entry = stored.History?.find((e) => e.Version === version);
  if (entry === undefined) {
    throw awsError(
      "ParameterVersionNotFound",
      `Parameter version ${version} not found for ${baseName}.`,
      400,
    );
  }
  return {
    ...stored,
    Value: entry.Value,
    Type: entry.Type,
    Version: entry.Version,
    LastModifiedDate: entry.LastModifiedDate,
  };
};

const nowIso = (): string => new Date().toISOString();

const newId = (): string => crypto.randomUUID();

const docKey = (name: string): string => `__doc__/${name}`;
const assocKey = (id: string): string => `__assoc__/${id}`;
const mwKey = (id: string): string => `__mw__/${id}`;
const mwtKey = (mwId: string, targetId: string): string =>
  `__mwt__/${mwId}/${targetId}`;
const mwtaskKey = (mwId: string, taskId: string): string =>
  `__mwtask__/${mwId}/${taskId}`;
const mwexecKey = (id: string): string => `__mwexec__/${id}`;
const pbKey = (id: string): string => `__pb__/${id}`;
const dpbKey = (os: string): string => `__dpb__/${os}`;
const pgKey = (group: string): string => `__pg__/${group}`;
const oiKey = (id: string): string => `__oi__/${id}`;
const omKey = (arn: string): string => `__om__/${arn}`;
const actKey = (id: string): string => `__act__/${id}`;
const rdsKey = (name: string): string => `__rds__/${name}`;
const cmdKey = (id: string): string => `__cmd__/${id}`;
const aeKey = (id: string): string => `__ae__/${id}`;
const sessKey = (id: string): string => `__sess__/${id}`;
const invKey = (instanceId: string, typeName: string): string =>
  `__inv__/${instanceId}/${typeName}`;
const compKey = (resourceId: string, compType: string): string =>
  `__comp__/${resourceId}/${compType}`;
const settingKey = (settingId: string): string => `__setting__/${settingId}`;
const rpolKey = (arn: string, policyId: string): string =>
  `__rpol__/${arn}/${policyId}`;

const requireDoc = (ctx: ServiceContext, name: string): StoredDocument => {
  const doc = ctx.store.get<StoredDocument>(docKey(name));
  if (doc === undefined) {
    throw awsError("InvalidDocument", `Document ${name} does not exist.`, 400);
  }
  return doc;
};

const requireMW = (
  ctx: ServiceContext,
  windowId: string,
): StoredMaintenanceWindow => {
  const mw = ctx.store.get<StoredMaintenanceWindow>(mwKey(windowId));
  if (mw === undefined) {
    throw awsError(
      "DoesNotExistException",
      `Maintenance window ${windowId} does not exist.`,
      400,
    );
  }
  return mw;
};

const requirePB = (
  ctx: ServiceContext,
  baselineId: string,
): StoredPatchBaseline => {
  const pb = ctx.store.get<StoredPatchBaseline>(pbKey(baselineId));
  if (pb === undefined) {
    throw awsError(
      "DoesNotExistException",
      `Patch baseline ${baselineId} does not exist.`,
      400,
    );
  }
  return pb;
};

const requireOI = (ctx: ServiceContext, opsItemId: string): StoredOpsItem => {
  const oi = ctx.store.get<StoredOpsItem>(oiKey(opsItemId));
  if (oi === undefined) {
    throw awsError(
      "OpsItemNotFoundException",
      `OpsItem ${opsItemId} does not exist.`,
      400,
    );
  }
  return oi;
};

const requireAssoc = (
  ctx: ServiceContext,
  assocId: string,
): StoredAssociation => {
  const assoc = ctx.store.get<StoredAssociation>(assocKey(assocId));
  if (assoc === undefined) {
    throw awsError(
      "AssociationDoesNotExist",
      `Association ${assocId} does not exist.`,
      400,
    );
  }
  return assoc;
};

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
  const lastModified = nowIso();
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
  const inputTags = Array.isArray(input["Tags"]) ? input["Tags"] : [];
  if (inputTags.length > 0) {
    const tagKey = tagsKey("Parameter", name);
    const existingTagEntry = ctx.store.get<StoredTags>(tagKey);
    const mergedTags: Record<string, string> = {
      ...(existingTagEntry?.Tags ?? {}),
    };
    for (const tag of inputTags) {
      if (typeof tag !== "object" || tag === null) continue;
      const record = tag as Record<string, unknown>;
      const k = record["Key"];
      const v = record["Value"];
      if (typeof k === "string") {
        mergedTags[k] = typeof v === "string" ? v : "";
      }
    }
    ctx.store.set(tagKey, {
      ResourceType: "Parameter",
      ResourceId: name,
      Tags: mergedTags,
    });
  }
  return { Version: version, Tier: "Standard" };
};

const GetParameter: OperationHandler = (input, ctx) => {
  const rawName = requireName(input);
  const { baseName, selector } = parseSelector(rawName);
  const withDecryption = input["WithDecryption"] === true;
  const stored = resolveParameterBySelector(ctx, baseName, selector);
  return { Parameter: toApiParameter(stored, withDecryption) };
};

const GetParameters: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["Names"])
    ? (input["Names"] as unknown[]).map((value) => String(value))
    : [];
  const withDecryption = input["WithDecryption"] === true;
  const parameters: Record<string, unknown>[] = [];
  const invalid: string[] = [];
  for (const nameWithSelector of names) {
    const { baseName, selector } = parseSelector(nameWithSelector);
    try {
      const resolved = resolveParameterBySelector(ctx, baseName, selector);
      parameters.push(toApiParameter(resolved, withDecryption));
    } catch {
      invalid.push(nameWithSelector);
    }
  }
  return { Parameters: parameters, InvalidParameters: invalid };
};

const GetParametersByPath: OperationHandler = (input, ctx) => {
  const path = input["Path"];
  if (typeof path !== "string" || path === "") {
    throw awsError("ValidationException", "Path is required.", 400);
  }
  const recursive = input["Recursive"] === true;
  const withDecryption = input["WithDecryption"] === true;
  const normalized = path.endsWith("/") ? path : `${path}/`;
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const all = applyParameterFilters(
    ctx.store
      .list<StoredParameter>()
      .filter((entry) => {
        if (entry.key.startsWith("__")) return false;
        if (!entry.key.startsWith(normalized)) return false;
        if (recursive) return true;
        const rest = entry.key.slice(normalized.length);
        return !rest.includes("/");
      })
      .map((entry) => entry.value),
    input["ParameterFilters"],
  );
  const pageSize = maxResults ?? all.length;
  const page = all
    .slice(offset, offset + pageSize)
    .map((p) => toApiParameter(p, withDecryption));
  const nextOffset = offset + pageSize;
  if (nextOffset < all.length) {
    return { Parameters: page, NextToken: encodePageToken(nextOffset) };
  }
  return { Parameters: page };
};

const DeleteParameter: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const removed = ctx.store.delete(name);
  if (!removed) {
    throw awsError("ParameterNotFound", `Parameter ${name} not found.`, 400);
  }
  ctx.store.delete(tagsKey("Parameter", name));
  return {};
};

const DeleteParameters: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["Names"])
    ? (input["Names"] as unknown[]).map((v) => String(v))
    : [];
  const deleted: string[] = [];
  const invalid: string[] = [];
  for (const name of names) {
    if (ctx.store.delete(name)) {
      ctx.store.delete(tagsKey("Parameter", name));
      deleted.push(name);
    } else {
      invalid.push(name);
    }
  }
  return { DeletedParameters: deleted, InvalidParameters: invalid };
};

const applyLegacyFilters = (
  parameters: StoredParameter[],
  filters: unknown,
): StoredParameter[] => {
  if (!Array.isArray(filters) || filters.length === 0) return parameters;
  return parameters.filter((p) =>
    (filters as unknown[]).every((f) => {
      if (typeof f !== "object" || f === null) return true;
      const filter = f as Record<string, unknown>;
      const key = filter["Key"];
      const values = Array.isArray(filter["Values"])
        ? (filter["Values"] as unknown[]).map((v) => String(v))
        : [];
      if (key === "Type") return values.includes(p.Type);
      if (key === "Name") return values.includes(p.Name);
      if (key === "KeyId") return true;
      return true;
    }),
  );
};

const DescribeParameters: OperationHandler = (input, ctx) => {
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const all = applyParameterFilters(
    applyLegacyFilters(
      ctx.store
        .list<StoredParameter>()
        .filter((entry) => !entry.key.startsWith("__"))
        .map((entry) => entry.value),
      input["Filters"],
    ),
    input["ParameterFilters"],
  );
  const pageSize = maxResults ?? all.length;
  const page = all.slice(offset, offset + pageSize).map((p) => ({
    Name: p.Name,
    Type: p.Type,
    Version: p.Version,
    LastModifiedDate: p.LastModifiedDate,
    ARN: p.ARN,
    Tier: "Standard",
  }));
  const nextOffset = offset + pageSize;
  if (nextOffset < all.length) {
    return { Parameters: page, NextToken: encodePageToken(nextOffset) };
  }
  return { Parameters: page };
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

const canonicalTagResourceId = (
  ctx: ServiceContext,
  resourceType: string,
  resourceId: string,
): string => {
  if (resourceType !== "Parameter") return resourceId;
  if (ctx.store.get<StoredParameter>(resourceId) !== undefined)
    return resourceId;
  const toggled = resourceId.startsWith("/")
    ? resourceId.slice(1)
    : `/${resourceId}`;
  if (ctx.store.get<StoredParameter>(toggled) !== undefined) return toggled;
  return resourceId;
};

const tagResourceTarget = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
): { resourceType: string; resourceId: string } => {
  const target = requireResourceTarget(input);
  return {
    resourceType: target.resourceType,
    resourceId: canonicalTagResourceId(
      ctx,
      target.resourceType,
      target.resourceId,
    ),
  };
};

const AddTagsToResource: OperationHandler = (input, ctx) => {
  const { resourceType, resourceId } = tagResourceTarget(input, ctx);
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
  const { resourceType, resourceId } = tagResourceTarget(input, ctx);
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
  const { resourceType, resourceId } = tagResourceTarget(input, ctx);
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

const UnlabelParameterVersion: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const stored = ctx.store.get<StoredParameter>(name);
  if (stored === undefined) {
    throw awsError("ParameterNotFound", `Parameter ${name} not found.`, 400);
  }
  const labels = Array.isArray(input["Labels"])
    ? (input["Labels"] as unknown[]).map((v) => String(v))
    : [];
  const rawVersion = input["ParameterVersion"];
  const version = typeof rawVersion === "number" ? rawVersion : stored.Version;
  const labelsByVersion: Record<string, string[]> = {
    ...(stored.Labels ?? {}),
  };
  const versionKey = String(version);
  const removed: string[] = [];
  const invalid: string[] = [];
  for (const label of labels) {
    const current = labelsByVersion[versionKey] ?? [];
    if (current.includes(label)) {
      labelsByVersion[versionKey] = current.filter((l) => l !== label);
      removed.push(label);
    } else {
      invalid.push(label);
    }
  }
  ctx.store.set(name, { ...stored, Labels: labelsByVersion });
  return { RemovedLabels: removed, InvalidLabels: invalid };
};

const GetParameterHistory: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const stored = ctx.store.get<StoredParameter>(name);
  if (stored === undefined) {
    throw awsError("ParameterNotFound", `Parameter ${name} not found.`, 400);
  }
  const withDecryption = input["WithDecryption"] === true;
  const labelsByVersion = stored.Labels ?? {};
  const history = stored.History ?? [];
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const pageSize = maxResults ?? history.length;
  const page = history.slice(offset, offset + pageSize);
  const parameters = page.map((entry) => ({
    Name: entry.Name,
    Type: entry.Type,
    Value:
      !withDecryption && entry.Type === "SecureString"
        ? `kms:ssm:${Buffer.from(entry.Value).toString("base64")}`
        : entry.Value,
    Version: entry.Version,
    LastModifiedDate: entry.LastModifiedDate,
    Labels: labelsByVersion[String(entry.Version)] ?? [],
    Tier: "Standard",
  }));
  const nextOffset = offset + pageSize;
  if (nextOffset < history.length) {
    return { Parameters: parameters, NextToken: encodePageToken(nextOffset) };
  }
  return { Parameters: parameters };
};

const CreateDocument: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  if (ctx.store.get(docKey(name)) !== undefined) {
    throw awsError(
      "DocumentAlreadyExists",
      `Document ${name} already exists.`,
      400,
    );
  }
  const content =
    typeof input["Content"] === "string" ? input["Content"] : "{}";
  const docType =
    typeof input["DocumentType"] === "string"
      ? input["DocumentType"]
      : "Command";
  const docFormat =
    typeof input["DocumentFormat"] === "string"
      ? input["DocumentFormat"]
      : "JSON";
  const tags = Array.isArray(input["Tags"])
    ? (input["Tags"] as { Key: string; Value: string }[])
    : [];
  const now = nowIso();
  const version: StoredDocumentVersion = {
    Name: name,
    DocumentVersion: "1",
    CreatedDate: now,
    IsDefaultVersion: true,
    DocumentFormat: docFormat,
    Status: "Active",
    Content: content,
  };
  const doc: StoredDocument = {
    Name: name,
    DocumentType: docType,
    DocumentFormat: docFormat,
    Content: content,
    Status: "Active",
    DocumentVersion: "1",
    LatestVersion: "1",
    DefaultVersion: "1",
    CreatedDate: now,
    Owner: ctx.account,
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    SchemaVersion: "2.2",
    Sha1: "",
    Hash: crypto.randomUUID().replace(/-/g, ""),
    HashType: "Sha256",
    Tags: tags,
    Versions: [version],
    Permissions: { AccountIds: [], AccountSharingInfoList: [] },
  };
  ctx.store.set(docKey(name), doc);
  return {
    DocumentDescription: {
      Name: doc.Name,
      DocumentVersion: doc.DocumentVersion,
      Status: doc.Status,
      DocumentType: doc.DocumentType,
      DocumentFormat: doc.DocumentFormat,
      CreatedDate: doc.CreatedDate,
      Owner: doc.Owner,
      Hash: doc.Hash,
      HashType: doc.HashType,
      SchemaVersion: doc.SchemaVersion,
    },
  };
};

const DeleteDocument: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  requireDoc(ctx, name);
  ctx.store.delete(docKey(name));
  return {};
};

const DescribeDocument: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const doc = requireDoc(ctx, name);
  return {
    Document: {
      Name: doc.Name,
      DocumentVersion: doc.DocumentVersion,
      LatestVersion: doc.LatestVersion,
      DefaultVersion: doc.DefaultVersion,
      Status: doc.Status,
      DocumentType: doc.DocumentType,
      DocumentFormat: doc.DocumentFormat,
      CreatedDate: doc.CreatedDate,
      Owner: doc.Owner,
      Description: doc.Description,
      SchemaVersion: doc.SchemaVersion,
      Hash: doc.Hash,
      HashType: doc.HashType,
      Tags: doc.Tags,
    },
  };
};

const DescribeDocumentPermission: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const doc = requireDoc(ctx, name);
  return {
    AccountIds: doc.Permissions.AccountIds,
    AccountSharingInfoList: doc.Permissions.AccountSharingInfoList,
  };
};

const GetDocument: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const doc = requireDoc(ctx, name);
  const requestedVersion =
    typeof input["DocumentVersion"] === "string"
      ? input["DocumentVersion"]
      : doc.DefaultVersion;
  const ver =
    doc.Versions.find((v) => v.DocumentVersion === requestedVersion) ??
    doc.Versions[doc.Versions.length - 1];
  return {
    Name: doc.Name,
    DocumentVersion: ver?.DocumentVersion ?? doc.DocumentVersion,
    Content: ver?.Content ?? doc.Content,
    DocumentType: doc.DocumentType,
    DocumentFormat: doc.DocumentFormat,
    Status: doc.Status,
    ReviewStatus: "APPROVED",
  };
};

const ListDocuments: OperationHandler = (input, ctx) => {
  void input;
  const docs = ctx.store
    .list<StoredDocument>()
    .filter((e) => e.key.startsWith("__doc__/"))
    .map((e) => ({
      Name: e.value.Name,
      DocumentVersion: e.value.DocumentVersion,
      DocumentType: e.value.DocumentType,
      DocumentFormat: e.value.DocumentFormat,
      Status: e.value.Status,
      Owner: e.value.Owner,
      CreatedDate: e.value.CreatedDate,
      Tags: e.value.Tags,
    }));
  return { DocumentIdentifiers: docs };
};

const ListDocumentVersions: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const doc = requireDoc(ctx, name);
  const versions = doc.Versions.map((v) => ({
    Name: v.Name,
    DocumentVersion: v.DocumentVersion,
    CreatedDate: v.CreatedDate,
    IsDefaultVersion: v.IsDefaultVersion,
    DocumentFormat: v.DocumentFormat,
    Status: v.Status,
  }));
  return { DocumentVersions: versions };
};

const ListDocumentMetadataHistory: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  requireDoc(ctx, name);
  return {
    Name: name,
    DocumentVersion: "1",
    Metadata: { ReviewerResponse: [] },
  };
};

const UpdateDocument: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const doc = requireDoc(ctx, name);
  const content =
    typeof input["Content"] === "string" ? input["Content"] : doc.Content;
  const newVersionNum = String(Number(doc.LatestVersion) + 1);
  const now = nowIso();
  const newVersion: StoredDocumentVersion = {
    Name: name,
    DocumentVersion: newVersionNum,
    CreatedDate: now,
    IsDefaultVersion: false,
    DocumentFormat: doc.DocumentFormat,
    Status: "Active",
    Content: content,
  };
  const updated: StoredDocument = {
    ...doc,
    Content: content,
    DocumentVersion: newVersionNum,
    LatestVersion: newVersionNum,
    Versions: [...doc.Versions, newVersion],
  };
  ctx.store.set(docKey(name), updated);
  return {
    DocumentDescription: {
      Name: updated.Name,
      DocumentVersion: updated.DocumentVersion,
      Status: updated.Status,
      DocumentType: updated.DocumentType,
      DocumentFormat: updated.DocumentFormat,
    },
  };
};

const UpdateDocumentDefaultVersion: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const doc = requireDoc(ctx, name);
  const docVersion =
    typeof input["DocumentVersion"] === "string"
      ? input["DocumentVersion"]
      : doc.LatestVersion;
  const exists = doc.Versions.some((v) => v.DocumentVersion === docVersion);
  if (!exists) {
    throw awsError(
      "InvalidDocumentVersion",
      `Document version ${docVersion} does not exist.`,
      400,
    );
  }
  const updated: StoredDocument = {
    ...doc,
    DefaultVersion: docVersion,
    Versions: doc.Versions.map((v) => ({
      ...v,
      IsDefaultVersion: v.DocumentVersion === docVersion,
    })),
  };
  ctx.store.set(docKey(name), updated);
  return {
    Description: {
      Name: name,
      DefaultVersion: docVersion,
      DefaultVersionName: docVersion,
    },
  };
};

const UpdateDocumentMetadata: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  requireDoc(ctx, name);
  return {};
};

const ModifyDocumentPermission: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const doc = requireDoc(ctx, name);
  const action =
    typeof input["PermissionType"] === "string"
      ? input["PermissionType"]
      : "Share";
  const accountIds = Array.isArray(input["AccountIdsToAdd"])
    ? (input["AccountIdsToAdd"] as unknown[]).map((v) => String(v))
    : [];
  const removeIds = Array.isArray(input["AccountIdsToRemove"])
    ? (input["AccountIdsToRemove"] as unknown[]).map((v) => String(v))
    : [];
  void action;
  const current = new Set(doc.Permissions.AccountIds);
  for (const id of accountIds) current.add(id);
  for (const id of removeIds) current.delete(id);
  const sharingList = Array.from(current).map((id) => ({
    AccountId: id,
    SharedDocumentVersion: "$Default",
  }));
  ctx.store.set(docKey(name), {
    ...doc,
    Permissions: {
      AccountIds: Array.from(current),
      AccountSharingInfoList: sharingList,
    },
  });
  return {};
};

const CreateAssociation: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  requireDoc(ctx, name);
  const id = newId();
  const now = nowIso();
  const assoc: StoredAssociation = {
    AssociationId: id,
    AssociationName:
      typeof input["AssociationName"] === "string"
        ? input["AssociationName"]
        : "",
    Name: name,
    DocumentVersion:
      typeof input["DocumentVersion"] === "string"
        ? input["DocumentVersion"]
        : "$Default",
    Parameters:
      typeof input["Parameters"] === "object" && input["Parameters"] !== null
        ? (input["Parameters"] as Record<string, string[]>)
        : {},
    Targets: Array.isArray(input["Targets"])
      ? (input["Targets"] as { Key: string; Values: string[] }[])
      : [],
    ScheduleExpression:
      typeof input["ScheduleExpression"] === "string"
        ? input["ScheduleExpression"]
        : "",
    Status: { Name: "Pending", Date: now, Message: "" },
    Overview: { Status: "Pending", AssociationStatusAggregatedCount: {} },
    LastExecutionDate: now,
    AssociationVersion: "1",
    Versions: [],
  };
  ctx.store.set(assocKey(id), assoc);
  return {
    AssociationDescription: {
      AssociationId: id,
      AssociationName: assoc.AssociationName,
      Name: assoc.Name,
      DocumentVersion: assoc.DocumentVersion,
      AssociationVersion: assoc.AssociationVersion,
      Status: assoc.Status,
      Overview: assoc.Overview,
    },
  };
};

const CreateAssociationBatch: OperationHandler = (input, ctx) => {
  const entries = Array.isArray(input["Entries"])
    ? (input["Entries"] as Record<string, unknown>[])
    : [];
  const successful: unknown[] = [];
  const failed: unknown[] = [];
  for (const entry of entries) {
    try {
      const result = CreateAssociation(entry, ctx, {} as never);
      successful.push(result);
    } catch {
      failed.push({ Entry: entry, Message: "Failed", Fault: "Client" });
    }
  }
  return { Successful: successful, Failed: failed };
};

const DeleteAssociation: OperationHandler = (input, ctx) => {
  const assocId = input["AssociationId"];
  if (typeof assocId === "string" && assocId !== "") {
    if (!ctx.store.delete(assocKey(assocId))) {
      throw awsError(
        "AssociationDoesNotExist",
        `Association ${assocId} does not exist.`,
        400,
      );
    }
  }
  return {};
};

const DescribeAssociation: OperationHandler = (input, ctx) => {
  const assocId = input["AssociationId"];
  if (typeof assocId !== "string" || assocId === "") {
    throw awsError("ValidationException", "AssociationId is required.", 400);
  }
  const assoc = requireAssoc(ctx, assocId);
  return {
    AssociationDescription: {
      AssociationId: assoc.AssociationId,
      AssociationName: assoc.AssociationName,
      Name: assoc.Name,
      DocumentVersion: assoc.DocumentVersion,
      Parameters: assoc.Parameters,
      Targets: assoc.Targets,
      ScheduleExpression: assoc.ScheduleExpression,
      Status: assoc.Status,
      Overview: assoc.Overview,
      LastExecutionDate: assoc.LastExecutionDate,
      AssociationVersion: assoc.AssociationVersion,
    },
  };
};

const DescribeAssociationExecutions: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { AssociationExecutions: [] };
};

const DescribeAssociationExecutionTargets: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { AssociationExecutionTargets: [] };
};

const DescribeEffectiveInstanceAssociations: OperationHandler = (
  input,
  ctx,
) => {
  void ctx;
  void input;
  return { Associations: [] };
};

const DescribeInstanceAssociationsStatus: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { InstanceAssociationStatusInfos: [] };
};

const ListAssociations: OperationHandler = (input, ctx) => {
  void input;
  const assocs = ctx.store
    .list<StoredAssociation>()
    .filter((e) => e.key.startsWith("__assoc__/"))
    .map((e) => ({
      AssociationId: e.value.AssociationId,
      AssociationName: e.value.AssociationName,
      Name: e.value.Name,
      DocumentVersion: e.value.DocumentVersion,
      AssociationVersion: e.value.AssociationVersion,
      Overview: e.value.Overview,
    }));
  return { Associations: assocs };
};

const ListAssociationVersions: OperationHandler = (input, ctx) => {
  const assocId = input["AssociationId"];
  if (typeof assocId !== "string" || assocId === "") {
    throw awsError("ValidationException", "AssociationId is required.", 400);
  }
  const assoc = requireAssoc(ctx, assocId);
  return { AssociationVersions: assoc.Versions };
};

const UpdateAssociation: OperationHandler = (input, ctx) => {
  const assocId = input["AssociationId"];
  if (typeof assocId !== "string" || assocId === "") {
    throw awsError("ValidationException", "AssociationId is required.", 400);
  }
  const assoc = requireAssoc(ctx, assocId);
  const newVersion = String(Number(assoc.AssociationVersion) + 1);
  const updated: StoredAssociation = {
    ...assoc,
    AssociationVersion: newVersion,
    ScheduleExpression:
      typeof input["ScheduleExpression"] === "string"
        ? input["ScheduleExpression"]
        : assoc.ScheduleExpression,
    Versions: [
      ...assoc.Versions,
      {
        AssociationId: assoc.AssociationId,
        AssociationVersion: newVersion,
        CreatedDate: nowIso(),
        Name: assoc.Name,
        DocumentVersion: assoc.DocumentVersion,
        Parameters: assoc.Parameters,
        Targets: assoc.Targets,
        ScheduleExpression: assoc.ScheduleExpression,
      },
    ],
  };
  ctx.store.set(assocKey(assocId), updated);
  return {
    AssociationDescription: {
      AssociationId: updated.AssociationId,
      AssociationName: updated.AssociationName,
      Name: updated.Name,
      AssociationVersion: updated.AssociationVersion,
    },
  };
};

const UpdateAssociationStatus: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { AssociationDescription: {} };
};

const StartAssociationsOnce: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return {};
};

const CreateMaintenanceWindow: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const clientToken =
    typeof input["ClientToken"] === "string" && input["ClientToken"] !== ""
      ? input["ClientToken"]
      : undefined;
  if (clientToken !== undefined) {
    const existing = ctx.store
      .list<StoredMaintenanceWindow>()
      .find(
        (e) =>
          e.key.startsWith("__mw__/") && e.value.ClientToken === clientToken,
      );
    if (existing !== undefined) {
      return { WindowId: existing.value.WindowId };
    }
  }
  const id = `mw-${newId().replace(/-/g, "").slice(0, 17)}`;
  const now = nowIso();
  const mw: StoredMaintenanceWindow = {
    WindowId: id,
    Name: name,
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    Enabled: input["Enabled"] !== false,
    Schedule:
      typeof input["Schedule"] === "string"
        ? input["Schedule"]
        : "cron(0 2 ? * SUN *)",
    ScheduleTimezone:
      typeof input["ScheduleTimezone"] === "string"
        ? input["ScheduleTimezone"]
        : "UTC",
    Duration: typeof input["Duration"] === "number" ? input["Duration"] : 1,
    Cutoff: typeof input["Cutoff"] === "number" ? input["Cutoff"] : 0,
    AllowUnassociatedTargets: input["AllowUnassociatedTargets"] === true,
    CreatedDate: now,
    ModifiedDate: now,
    NextExecutionTime: now,
    ...(clientToken !== undefined ? { ClientToken: clientToken } : {}),
  };
  ctx.store.set(mwKey(id), mw);
  return { WindowId: id };
};

const DeleteMaintenanceWindow: OperationHandler = (input, ctx) => {
  const windowId = input["WindowId"];
  if (typeof windowId !== "string" || windowId === "") {
    throw awsError("ValidationException", "WindowId is required.", 400);
  }
  ctx.store.delete(mwKey(windowId));
  return { WindowId: windowId };
};

const DescribeMaintenanceWindows: OperationHandler = (input, ctx) => {
  void input;
  const windows = ctx.store
    .list<StoredMaintenanceWindow>()
    .filter((e) => e.key.startsWith("__mw__/"))
    .map((e) => ({
      WindowId: e.value.WindowId,
      Name: e.value.Name,
      Enabled: e.value.Enabled,
      Duration: e.value.Duration,
      Cutoff: e.value.Cutoff,
      Schedule: e.value.Schedule,
      NextExecutionTime: e.value.NextExecutionTime,
    }));
  return { WindowIdentities: windows };
};

const DescribeMaintenanceWindowsForTarget: OperationHandler = (input, ctx) => {
  void input;
  const windows = ctx.store
    .list<StoredMaintenanceWindow>()
    .filter((e) => e.key.startsWith("__mw__/"))
    .map((e) => ({
      WindowId: e.value.WindowId,
      Name: e.value.Name,
    }));
  return { WindowIdentities: windows };
};

const DescribeMaintenanceWindowExecutions: OperationHandler = (input, ctx) => {
  const windowId =
    typeof input["WindowId"] === "string" ? input["WindowId"] : "";
  const execs = ctx.store
    .list<StoredMWExecution>()
    .filter(
      (e) => e.key.startsWith("__mwexec__/") && e.value.WindowId === windowId,
    )
    .map((e) => ({
      WindowId: e.value.WindowId,
      WindowExecutionId: e.value.WindowExecutionId,
      Status: e.value.Status,
      StartTime: e.value.StartTime,
      EndTime: e.value.EndTime,
    }));
  return { WindowExecutions: execs };
};

const DescribeMaintenanceWindowExecutionTasks: OperationHandler = (
  input,
  ctx,
) => {
  void ctx;
  void input;
  return { WindowExecutionTaskIdentities: [] };
};

const DescribeMaintenanceWindowExecutionTaskInvocations: OperationHandler = (
  input,
  ctx,
) => {
  void ctx;
  void input;
  return { WindowExecutionTaskInvocationIdentities: [] };
};

const DescribeMaintenanceWindowSchedule: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { ScheduledWindowExecutions: [] };
};

const DescribeMaintenanceWindowTargets: OperationHandler = (input, ctx) => {
  const windowId =
    typeof input["WindowId"] === "string" ? input["WindowId"] : "";
  const targets = ctx.store
    .list<StoredMWTarget>()
    .filter((e) => e.key.startsWith(`__mwt__/${windowId}/`))
    .map((e) => ({
      WindowId: e.value.WindowId,
      WindowTargetId: e.value.WindowTargetId,
      ResourceType: e.value.ResourceType,
      Targets: e.value.Targets,
      Name: e.value.Name,
      Description: e.value.Description,
    }));
  return { Targets: targets };
};

const DescribeMaintenanceWindowTasks: OperationHandler = (input, ctx) => {
  const windowId =
    typeof input["WindowId"] === "string" ? input["WindowId"] : "";
  const tasks = ctx.store
    .list<StoredMWTask>()
    .filter((e) => e.key.startsWith(`__mwtask__/${windowId}/`))
    .map((e) => ({
      WindowId: e.value.WindowId,
      WindowTaskId: e.value.WindowTaskId,
      TaskArn: e.value.TaskArn,
      Type: e.value.Type,
      Targets: e.value.Targets,
      Priority: e.value.Priority,
      MaxConcurrency: e.value.MaxConcurrency,
      MaxErrors: e.value.MaxErrors,
      Name: e.value.Name,
    }));
  return { Tasks: tasks };
};

const GetMaintenanceWindow: OperationHandler = (input, ctx) => {
  const windowId = input["WindowId"];
  if (typeof windowId !== "string" || windowId === "") {
    throw awsError("ValidationException", "WindowId is required.", 400);
  }
  const mw = requireMW(ctx, windowId);
  return {
    WindowId: mw.WindowId,
    Name: mw.Name,
    Description: mw.Description,
    Enabled: mw.Enabled,
    Schedule: mw.Schedule,
    ScheduleTimezone: mw.ScheduleTimezone,
    Duration: mw.Duration,
    Cutoff: mw.Cutoff,
    AllowUnassociatedTargets: mw.AllowUnassociatedTargets,
    CreatedDate: mw.CreatedDate,
    ModifiedDate: mw.ModifiedDate,
    NextExecutionTime: mw.NextExecutionTime,
  };
};

const GetMaintenanceWindowExecution: OperationHandler = (input, ctx) => {
  const execId = input["WindowExecutionId"];
  if (typeof execId !== "string" || execId === "") {
    throw awsError(
      "ValidationException",
      "WindowExecutionId is required.",
      400,
    );
  }
  const exec = ctx.store.get<StoredMWExecution>(mwexecKey(execId));
  if (exec === undefined) {
    throw awsError(
      "DoesNotExistException",
      `Execution ${execId} does not exist.`,
      400,
    );
  }
  return {
    WindowId: exec.WindowId,
    WindowExecutionId: exec.WindowExecutionId,
    Status: exec.Status,
    StartTime: exec.StartTime,
    EndTime: exec.EndTime,
    TaskIds: [],
  };
};

const GetMaintenanceWindowExecutionTask: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return {
    WindowExecutionId: "",
    TaskExecutionId: "",
    Status: "SUCCESS",
    StartTime: nowIso(),
    EndTime: nowIso(),
    TaskArn: "",
    Type: "RUN_COMMAND",
  };
};

const GetMaintenanceWindowExecutionTaskInvocation: OperationHandler = (
  input,
  ctx,
) => {
  void ctx;
  void input;
  return {
    WindowExecutionId: "",
    TaskExecutionId: "",
    InvocationId: "",
    Status: "SUCCESS",
    StartTime: nowIso(),
    EndTime: nowIso(),
  };
};

const GetMaintenanceWindowTask: OperationHandler = (input, ctx) => {
  const windowId =
    typeof input["WindowId"] === "string" ? input["WindowId"] : "";
  const taskId =
    typeof input["WindowTaskId"] === "string" ? input["WindowTaskId"] : "";
  const task = ctx.store.get<StoredMWTask>(mwtaskKey(windowId, taskId));
  if (task === undefined) {
    throw awsError(
      "DoesNotExistException",
      `Task ${taskId} does not exist.`,
      400,
    );
  }
  return {
    WindowId: task.WindowId,
    WindowTaskId: task.WindowTaskId,
    TaskArn: task.TaskArn,
    Type: task.Type,
    Targets: task.Targets,
    TaskParameters: task.TaskParameters,
    Priority: task.Priority,
    MaxConcurrency: task.MaxConcurrency,
    MaxErrors: task.MaxErrors,
    Name: task.Name,
    Description: task.Description,
    ServiceRoleArn: task.ServiceRoleArn,
  };
};

const RegisterTargetWithMaintenanceWindow: OperationHandler = (input, ctx) => {
  const windowId = input["WindowId"];
  if (typeof windowId !== "string" || windowId === "") {
    throw awsError("ValidationException", "WindowId is required.", 400);
  }
  requireMW(ctx, windowId);
  const targetId = newId();
  const target: StoredMWTarget = {
    WindowId: windowId,
    WindowTargetId: targetId,
    ResourceType:
      typeof input["ResourceType"] === "string"
        ? input["ResourceType"]
        : "INSTANCE",
    Targets: Array.isArray(input["Targets"])
      ? (input["Targets"] as { Key: string; Values: string[] }[])
      : [],
    Name: typeof input["Name"] === "string" ? input["Name"] : "",
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    OwnerInformation:
      typeof input["OwnerInformation"] === "string"
        ? input["OwnerInformation"]
        : "",
  };
  ctx.store.set(mwtKey(windowId, targetId), target);
  return { WindowId: windowId, WindowTargetId: targetId };
};

const RegisterTaskWithMaintenanceWindow: OperationHandler = (input, ctx) => {
  const windowId = input["WindowId"];
  if (typeof windowId !== "string" || windowId === "") {
    throw awsError("ValidationException", "WindowId is required.", 400);
  }
  requireMW(ctx, windowId);
  const taskId = newId();
  const task: StoredMWTask = {
    WindowId: windowId,
    WindowTaskId: taskId,
    TaskArn: typeof input["TaskArn"] === "string" ? input["TaskArn"] : "",
    Type:
      typeof input["TaskType"] === "string" ? input["TaskType"] : "RUN_COMMAND",
    Targets: Array.isArray(input["Targets"])
      ? (input["Targets"] as { Key: string; Values: string[] }[])
      : [],
    TaskParameters:
      typeof input["TaskParameters"] === "object" &&
      input["TaskParameters"] !== null
        ? (input["TaskParameters"] as Record<string, { Values: string[] }>)
        : {},
    Priority: typeof input["Priority"] === "number" ? input["Priority"] : 1,
    MaxConcurrency:
      typeof input["MaxConcurrency"] === "string"
        ? input["MaxConcurrency"]
        : "1",
    MaxErrors:
      typeof input["MaxErrors"] === "string" ? input["MaxErrors"] : "1",
    Name: typeof input["Name"] === "string" ? input["Name"] : "",
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    ServiceRoleArn:
      typeof input["ServiceRoleArn"] === "string"
        ? input["ServiceRoleArn"]
        : "",
  };
  ctx.store.set(mwtaskKey(windowId, taskId), task);
  return { WindowId: windowId, WindowTaskId: taskId };
};

const DeregisterTargetFromMaintenanceWindow: OperationHandler = (
  input,
  ctx,
) => {
  const windowId =
    typeof input["WindowId"] === "string" ? input["WindowId"] : "";
  const targetId =
    typeof input["WindowTargetId"] === "string" ? input["WindowTargetId"] : "";
  ctx.store.delete(mwtKey(windowId, targetId));
  return { WindowId: windowId, WindowTargetId: targetId };
};

const DeregisterTaskFromMaintenanceWindow: OperationHandler = (input, ctx) => {
  const windowId =
    typeof input["WindowId"] === "string" ? input["WindowId"] : "";
  const taskId =
    typeof input["WindowTaskId"] === "string" ? input["WindowTaskId"] : "";
  ctx.store.delete(mwtaskKey(windowId, taskId));
  return { WindowId: windowId, WindowTaskId: taskId };
};

const UpdateMaintenanceWindow: OperationHandler = (input, ctx) => {
  const windowId = input["WindowId"];
  if (typeof windowId !== "string" || windowId === "") {
    throw awsError("ValidationException", "WindowId is required.", 400);
  }
  const mw = requireMW(ctx, windowId);
  const updated: StoredMaintenanceWindow = {
    ...mw,
    Name: typeof input["Name"] === "string" ? input["Name"] : mw.Name,
    Description:
      typeof input["Description"] === "string"
        ? input["Description"]
        : mw.Description,
    Enabled:
      typeof input["Enabled"] === "boolean" ? input["Enabled"] : mw.Enabled,
    Schedule:
      typeof input["Schedule"] === "string" ? input["Schedule"] : mw.Schedule,
    Duration:
      typeof input["Duration"] === "number" ? input["Duration"] : mw.Duration,
    Cutoff: typeof input["Cutoff"] === "number" ? input["Cutoff"] : mw.Cutoff,
    AllowUnassociatedTargets:
      typeof input["AllowUnassociatedTargets"] === "boolean"
        ? input["AllowUnassociatedTargets"]
        : mw.AllowUnassociatedTargets,
    ModifiedDate: nowIso(),
  };
  ctx.store.set(mwKey(windowId), updated);
  return {
    WindowId: updated.WindowId,
    Name: updated.Name,
    Enabled: updated.Enabled,
    Schedule: updated.Schedule,
    Duration: updated.Duration,
    Cutoff: updated.Cutoff,
  };
};

const UpdateMaintenanceWindowTarget: OperationHandler = (input, ctx) => {
  const windowId =
    typeof input["WindowId"] === "string" ? input["WindowId"] : "";
  const targetId =
    typeof input["WindowTargetId"] === "string" ? input["WindowTargetId"] : "";
  const target = ctx.store.get<StoredMWTarget>(mwtKey(windowId, targetId));
  if (target === undefined) {
    throw awsError(
      "DoesNotExistException",
      `Target ${targetId} does not exist.`,
      400,
    );
  }
  const updated: StoredMWTarget = {
    ...target,
    Name: typeof input["Name"] === "string" ? input["Name"] : target.Name,
    Description:
      typeof input["Description"] === "string"
        ? input["Description"]
        : target.Description,
    Targets: Array.isArray(input["Targets"])
      ? (input["Targets"] as { Key: string; Values: string[] }[])
      : target.Targets,
  };
  ctx.store.set(mwtKey(windowId, targetId), updated);
  return {
    WindowId: windowId,
    WindowTargetId: targetId,
    Name: updated.Name,
    Description: updated.Description,
  };
};

const UpdateMaintenanceWindowTask: OperationHandler = (input, ctx) => {
  const windowId =
    typeof input["WindowId"] === "string" ? input["WindowId"] : "";
  const taskId =
    typeof input["WindowTaskId"] === "string" ? input["WindowTaskId"] : "";
  const task = ctx.store.get<StoredMWTask>(mwtaskKey(windowId, taskId));
  if (task === undefined) {
    throw awsError(
      "DoesNotExistException",
      `Task ${taskId} does not exist.`,
      400,
    );
  }
  const updated: StoredMWTask = {
    ...task,
    Name: typeof input["Name"] === "string" ? input["Name"] : task.Name,
    Description:
      typeof input["Description"] === "string"
        ? input["Description"]
        : task.Description,
    Priority:
      typeof input["Priority"] === "number" ? input["Priority"] : task.Priority,
    MaxConcurrency:
      typeof input["MaxConcurrency"] === "string"
        ? input["MaxConcurrency"]
        : task.MaxConcurrency,
    MaxErrors:
      typeof input["MaxErrors"] === "string"
        ? input["MaxErrors"]
        : task.MaxErrors,
  };
  ctx.store.set(mwtaskKey(windowId, taskId), updated);
  return {
    WindowId: windowId,
    WindowTaskId: taskId,
    Name: updated.Name,
    Description: updated.Description,
  };
};

const CancelMaintenanceWindowExecution: OperationHandler = (input, ctx) => {
  const execId =
    typeof input["WindowExecutionId"] === "string"
      ? input["WindowExecutionId"]
      : "";
  const exec = ctx.store.get<StoredMWExecution>(mwexecKey(execId));
  if (exec !== undefined) {
    ctx.store.set(mwexecKey(execId), { ...exec, Status: "CANCELLED" });
  }
  return { WindowExecutionId: execId };
};

const CreatePatchBaseline: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const clientToken =
    typeof input["ClientToken"] === "string" && input["ClientToken"] !== ""
      ? input["ClientToken"]
      : undefined;
  if (clientToken !== undefined) {
    const existing = ctx.store
      .list<StoredPatchBaseline>()
      .find(
        (e) =>
          e.key.startsWith("__pb__/") && e.value.ClientToken === clientToken,
      );
    if (existing !== undefined) {
      return { BaselineId: existing.value.BaselineId };
    }
  }
  const id = `pb-${newId().replace(/-/g, "").slice(0, 17)}`;
  const now = nowIso();
  const pb: StoredPatchBaseline = {
    BaselineId: id,
    Name: name,
    OperatingSystem:
      typeof input["OperatingSystem"] === "string"
        ? input["OperatingSystem"]
        : "WINDOWS",
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    GlobalFilters:
      typeof input["GlobalFilters"] === "object" &&
      input["GlobalFilters"] !== null
        ? (input["GlobalFilters"] as {
            PatchFilters: { Key: string; Values: string[] }[];
          })
        : { PatchFilters: [] },
    ApprovalRules:
      typeof input["ApprovalRules"] === "object" &&
      input["ApprovalRules"] !== null
        ? (input["ApprovalRules"] as {
            PatchRules: {
              PatchFilterGroup: {
                PatchFilters: { Key: string; Values: string[] }[];
              };
              ApproveAfterDays: number;
            }[];
          })
        : { PatchRules: [] },
    ApprovedPatches: Array.isArray(input["ApprovedPatches"])
      ? (input["ApprovedPatches"] as string[])
      : [],
    RejectedPatches: Array.isArray(input["RejectedPatches"])
      ? (input["RejectedPatches"] as string[])
      : [],
    CreatedDate: now,
    ModifiedDate: now,
    PatchGroups: [],
    DefaultBaseline: false,
    Tags: Array.isArray(input["Tags"])
      ? (input["Tags"] as { Key: string; Value: string }[])
      : [],
    ...(clientToken !== undefined ? { ClientToken: clientToken } : {}),
  };
  ctx.store.set(pbKey(id), pb);
  return { BaselineId: id };
};

const DeletePatchBaseline: OperationHandler = (input, ctx) => {
  const baselineId =
    typeof input["BaselineId"] === "string" ? input["BaselineId"] : "";
  ctx.store.delete(pbKey(baselineId));
  return { BaselineId: baselineId };
};

const DescribePatchBaselines: OperationHandler = (input, ctx) => {
  void input;
  const baselines = ctx.store
    .list<StoredPatchBaseline>()
    .filter((e) => e.key.startsWith("__pb__/"))
    .map((e) => ({
      BaselineId: e.value.BaselineId,
      BaselineName: e.value.Name,
      OperatingSystem: e.value.OperatingSystem,
      BaselineDescription: e.value.Description,
      DefaultBaseline: e.value.DefaultBaseline,
    }));
  return { BaselineIdentities: baselines };
};

const GetPatchBaseline: OperationHandler = (input, ctx) => {
  const baselineId =
    typeof input["BaselineId"] === "string" ? input["BaselineId"] : "";
  const pb = requirePB(ctx, baselineId);
  return {
    BaselineId: pb.BaselineId,
    Name: pb.Name,
    OperatingSystem: pb.OperatingSystem,
    Description: pb.Description,
    GlobalFilters: pb.GlobalFilters,
    ApprovalRules: pb.ApprovalRules,
    ApprovedPatches: pb.ApprovedPatches,
    RejectedPatches: pb.RejectedPatches,
    CreatedDate: pb.CreatedDate,
    ModifiedDate: pb.ModifiedDate,
    PatchGroups: pb.PatchGroups,
    Tags: pb.Tags,
  };
};

const GetPatchBaselineForPatchGroup: OperationHandler = (input, ctx) => {
  const patchGroup =
    typeof input["PatchGroup"] === "string" ? input["PatchGroup"] : "";
  const baselineId = ctx.store.get<string>(pgKey(patchGroup));
  if (baselineId === undefined) {
    throw awsError(
      "DoesNotExistException",
      `No baseline registered for patch group ${patchGroup}.`,
      400,
    );
  }
  const pb = requirePB(ctx, baselineId);
  return {
    BaselineId: pb.BaselineId,
    PatchGroup: patchGroup,
    OperatingSystem: pb.OperatingSystem,
  };
};

const RegisterDefaultPatchBaseline: OperationHandler = (input, ctx) => {
  const baselineId =
    typeof input["BaselineId"] === "string" ? input["BaselineId"] : "";
  const pb = requirePB(ctx, baselineId);
  ctx.store.set(dpbKey(pb.OperatingSystem), baselineId);
  ctx.store.set(pbKey(baselineId), { ...pb, DefaultBaseline: true });
  return { BaselineId: baselineId };
};

const GetDefaultPatchBaseline: OperationHandler = (input, ctx) => {
  const os =
    typeof input["OperatingSystem"] === "string"
      ? input["OperatingSystem"]
      : "WINDOWS";
  const baselineId = ctx.store.get<string>(dpbKey(os));
  if (baselineId === undefined) {
    return {
      BaselineId: `arn:aws:ssm:${ctx.region}::patchbaseline/pb-default`,
      OperatingSystem: os,
    };
  }
  return { BaselineId: baselineId, OperatingSystem: os };
};

const RegisterPatchBaselineForPatchGroup: OperationHandler = (input, ctx) => {
  const baselineId =
    typeof input["BaselineId"] === "string" ? input["BaselineId"] : "";
  const patchGroup =
    typeof input["PatchGroup"] === "string" ? input["PatchGroup"] : "";
  const pb = requirePB(ctx, baselineId);
  ctx.store.set(pgKey(patchGroup), baselineId);
  ctx.store.set(pbKey(baselineId), {
    ...pb,
    PatchGroups: Array.from(new Set([...pb.PatchGroups, patchGroup])),
  });
  return { BaselineId: baselineId, PatchGroup: patchGroup };
};

const DeregisterPatchBaselineForPatchGroup: OperationHandler = (input, ctx) => {
  const baselineId =
    typeof input["BaselineId"] === "string" ? input["BaselineId"] : "";
  const patchGroup =
    typeof input["PatchGroup"] === "string" ? input["PatchGroup"] : "";
  ctx.store.delete(pgKey(patchGroup));
  const pb = ctx.store.get<StoredPatchBaseline>(pbKey(baselineId));
  if (pb !== undefined) {
    ctx.store.set(pbKey(baselineId), {
      ...pb,
      PatchGroups: pb.PatchGroups.filter((g) => g !== patchGroup),
    });
  }
  return { BaselineId: baselineId, PatchGroup: patchGroup };
};

const DescribePatchGroups: OperationHandler = (input, ctx) => {
  void input;
  const groups = ctx.store
    .list<string>()
    .filter((e) => e.key.startsWith("__pg__/"))
    .map((e) => ({
      PatchGroup: e.key.slice("__pg__/".length),
      BaselineIdentity: { BaselineId: e.value },
    }));
  return { Mappings: groups };
};

const DescribePatchGroupState: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return {
    Instances: 0,
    InstancesWithInstalledPatches: 0,
    InstancesWithMissingPatches: 0,
    InstancesWithFailedPatches: 0,
    InstancesWithNotApplicablePatches: 0,
    InstancesWithUnreportedNotApplicablePatches: 0,
  };
};

const UpdatePatchBaseline: OperationHandler = (input, ctx) => {
  const baselineId =
    typeof input["BaselineId"] === "string" ? input["BaselineId"] : "";
  const pb = requirePB(ctx, baselineId);
  const updated: StoredPatchBaseline = {
    ...pb,
    Name: typeof input["Name"] === "string" ? input["Name"] : pb.Name,
    Description:
      typeof input["Description"] === "string"
        ? input["Description"]
        : pb.Description,
    ApprovedPatches: Array.isArray(input["ApprovedPatches"])
      ? (input["ApprovedPatches"] as string[])
      : pb.ApprovedPatches,
    RejectedPatches: Array.isArray(input["RejectedPatches"])
      ? (input["RejectedPatches"] as string[])
      : pb.RejectedPatches,
    ModifiedDate: nowIso(),
  };
  ctx.store.set(pbKey(baselineId), updated);
  return {
    BaselineId: updated.BaselineId,
    Name: updated.Name,
    OperatingSystem: updated.OperatingSystem,
  };
};

const DescribeAvailablePatches: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { Patches: [] };
};

const DescribeEffectivePatchesForPatchBaseline: OperationHandler = (
  input,
  ctx,
) => {
  void ctx;
  void input;
  return { EffectivePatches: [] };
};

const DescribeInstancePatches: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { Patches: [] };
};

const DescribeInstancePatchStates: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { InstancePatchStates: [] };
};

const DescribeInstancePatchStatesForPatchGroup: OperationHandler = (
  input,
  ctx,
) => {
  void ctx;
  void input;
  return { InstancePatchStates: [] };
};

const DescribePatchProperties: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { Properties: [] };
};

const CreateOpsItem: OperationHandler = (input, ctx) => {
  const id = `oi-${newId().replace(/-/g, "").slice(0, 12)}`;
  const now = nowIso();
  const oi: StoredOpsItem = {
    OpsItemId: id,
    Title: typeof input["Title"] === "string" ? input["Title"] : "",
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    Status: "Open",
    Priority: typeof input["Priority"] === "number" ? input["Priority"] : 3,
    Source: typeof input["Source"] === "string" ? input["Source"] : "SSM",
    CreatedTime: now,
    LastModifiedTime: now,
    OpsItemType:
      typeof input["OpsItemType"] === "string"
        ? input["OpsItemType"]
        : "/aws/issue",
    Notifications: Array.isArray(input["Notifications"])
      ? (input["Notifications"] as { Arn: string }[])
      : [],
    RelatedOpsItems: Array.isArray(input["RelatedOpsItems"])
      ? (input["RelatedOpsItems"] as {
          OpsItemId: string;
          OpsItemType: string;
        }[])
      : [],
    OperationalData:
      typeof input["OperationalData"] === "object" &&
      input["OperationalData"] !== null
        ? (input["OperationalData"] as Record<
            string,
            { Value: string; Type: string }
          >)
        : {},
    Category: typeof input["Category"] === "string" ? input["Category"] : "",
    Severity: typeof input["Severity"] === "string" ? input["Severity"] : "",
    Tags: Array.isArray(input["Tags"])
      ? (input["Tags"] as { Key: string; Value: string }[])
      : [],
    RelatedItems: [],
    Events: [],
  };
  ctx.store.set(oiKey(id), oi);
  return { OpsItemId: id };
};

const DeleteOpsItem: OperationHandler = (input, ctx) => {
  const id = typeof input["OpsItemId"] === "string" ? input["OpsItemId"] : "";
  ctx.store.delete(oiKey(id));
  return {};
};

const DescribeOpsItems: OperationHandler = (input, ctx) => {
  void input;
  const items = ctx.store
    .list<StoredOpsItem>()
    .filter((e) => e.key.startsWith("__oi__/"))
    .map((e) => ({
      OpsItemId: e.value.OpsItemId,
      OpsItemType: e.value.OpsItemType,
      Title: e.value.Title,
      Status: e.value.Status,
      Priority: e.value.Priority,
      Source: e.value.Source,
      CreatedTime: e.value.CreatedTime,
      LastModifiedTime: e.value.LastModifiedTime,
      Severity: e.value.Severity,
      Category: e.value.Category,
    }));
  return { OpsItemSummaries: items };
};

const GetOpsItem: OperationHandler = (input, ctx) => {
  const id = typeof input["OpsItemId"] === "string" ? input["OpsItemId"] : "";
  const oi = requireOI(ctx, id);
  return {
    OpsItem: {
      OpsItemId: oi.OpsItemId,
      Title: oi.Title,
      Description: oi.Description,
      Status: oi.Status,
      Priority: oi.Priority,
      Source: oi.Source,
      CreatedTime: oi.CreatedTime,
      LastModifiedTime: oi.LastModifiedTime,
      OpsItemType: oi.OpsItemType,
      Notifications: oi.Notifications,
      RelatedOpsItems: oi.RelatedOpsItems,
      OperationalData: oi.OperationalData,
      Category: oi.Category,
      Severity: oi.Severity,
      Tags: oi.Tags,
    },
  };
};

const UpdateOpsItem: OperationHandler = (input, ctx) => {
  const id = typeof input["OpsItemId"] === "string" ? input["OpsItemId"] : "";
  const oi = requireOI(ctx, id);
  const updated: StoredOpsItem = {
    ...oi,
    Title: typeof input["Title"] === "string" ? input["Title"] : oi.Title,
    Description:
      typeof input["Description"] === "string"
        ? input["Description"]
        : oi.Description,
    Status: typeof input["Status"] === "string" ? input["Status"] : oi.Status,
    Priority:
      typeof input["Priority"] === "number" ? input["Priority"] : oi.Priority,
    LastModifiedTime: nowIso(),
  };
  ctx.store.set(oiKey(id), updated);
  return {};
};

const AssociateOpsItemRelatedItem: OperationHandler = (input, ctx) => {
  const id = typeof input["OpsItemId"] === "string" ? input["OpsItemId"] : "";
  const oi = requireOI(ctx, id);
  const assocId = newId();
  const item: StoredOpsItemRelatedItem = {
    AssociationId: assocId,
    ResourceType:
      typeof input["ResourceType"] === "string" ? input["ResourceType"] : "",
    AssociationType:
      typeof input["AssociationType"] === "string"
        ? input["AssociationType"]
        : "",
    ResourceUri:
      typeof input["ResourceUri"] === "string" ? input["ResourceUri"] : "",
    CreatedTime: nowIso(),
  };
  ctx.store.set(oiKey(id), { ...oi, RelatedItems: [...oi.RelatedItems, item] });
  return { AssociationId: assocId };
};

const DisassociateOpsItemRelatedItem: OperationHandler = (input, ctx) => {
  const id = typeof input["OpsItemId"] === "string" ? input["OpsItemId"] : "";
  const assocId =
    typeof input["AssociationId"] === "string" ? input["AssociationId"] : "";
  const oi = requireOI(ctx, id);
  ctx.store.set(oiKey(id), {
    ...oi,
    RelatedItems: oi.RelatedItems.filter((r) => r.AssociationId !== assocId),
  });
  return {};
};

const ListOpsItemEvents: OperationHandler = (input, ctx) => {
  const id = typeof input["OpsItemId"] === "string" ? input["OpsItemId"] : "";
  if (id !== "") {
    const oi = ctx.store.get<StoredOpsItem>(oiKey(id));
    if (oi !== undefined) {
      return { Summaries: oi.Events };
    }
  }
  return { Summaries: [] };
};

const ListOpsItemRelatedItems: OperationHandler = (input, ctx) => {
  const id = typeof input["OpsItemId"] === "string" ? input["OpsItemId"] : "";
  if (id !== "") {
    const oi = ctx.store.get<StoredOpsItem>(oiKey(id));
    if (oi !== undefined) {
      return { Summaries: oi.RelatedItems };
    }
  }
  return { Summaries: [] };
};

const CreateOpsMetadata: OperationHandler = (input, ctx) => {
  const resourceId =
    typeof input["ResourceId"] === "string" ? input["ResourceId"] : "";
  if (resourceId === "") {
    throw awsError("ValidationException", "ResourceId is required.", 400);
  }
  const arn = `arn:aws:ssm:${ctx.region}:${ctx.account}:opsmetadata/${resourceId}`;
  const now = nowIso();
  const om: StoredOpsMetadata = {
    OpsMetadataArn: arn,
    ResourceId: resourceId,
    Metadata:
      typeof input["Metadata"] === "object" && input["Metadata"] !== null
        ? (input["Metadata"] as Record<string, { Value: string }>)
        : {},
    CreationDate: now,
    LastModifiedDate: now,
  };
  ctx.store.set(omKey(arn), om);
  return { OpsMetadataArn: arn };
};

const DeleteOpsMetadata: OperationHandler = (input, ctx) => {
  const arn =
    typeof input["OpsMetadataArn"] === "string" ? input["OpsMetadataArn"] : "";
  ctx.store.delete(omKey(arn));
  return {};
};

const GetOpsMetadata: OperationHandler = (input, ctx) => {
  const arn =
    typeof input["OpsMetadataArn"] === "string" ? input["OpsMetadataArn"] : "";
  const om = ctx.store.get<StoredOpsMetadata>(omKey(arn));
  if (om === undefined) {
    throw awsError(
      "OpsMetadataNotFoundException",
      `OpsMetadata ${arn} does not exist.`,
      400,
    );
  }
  return { ResourceId: om.ResourceId, Metadata: om.Metadata };
};

const ListOpsMetadata: OperationHandler = (input, ctx) => {
  void input;
  const items = ctx.store
    .list<StoredOpsMetadata>()
    .filter((e) => e.key.startsWith("__om__/"))
    .map((e) => ({
      OpsMetadataArn: e.value.OpsMetadataArn,
      ResourceId: e.value.ResourceId,
      CreationDate: e.value.CreationDate,
      LastModifiedDate: e.value.LastModifiedDate,
    }));
  return { OpsMetadataList: items };
};

const UpdateOpsMetadata: OperationHandler = (input, ctx) => {
  const arn =
    typeof input["OpsMetadataArn"] === "string" ? input["OpsMetadataArn"] : "";
  const om = ctx.store.get<StoredOpsMetadata>(omKey(arn));
  if (om === undefined) {
    throw awsError(
      "OpsMetadataNotFoundException",
      `OpsMetadata ${arn} does not exist.`,
      400,
    );
  }
  const metadataToAdd =
    typeof input["MetadataToAdd"] === "object" &&
    input["MetadataToAdd"] !== null
      ? (input["MetadataToAdd"] as Record<string, { Value: string }>)
      : {};
  const keysToDelete = Array.isArray(input["KeysToDelete"])
    ? (input["KeysToDelete"] as unknown[]).map((v) => String(v))
    : [];
  const merged = { ...om.Metadata, ...metadataToAdd };
  for (const key of keysToDelete) delete merged[key];
  ctx.store.set(omKey(arn), {
    ...om,
    Metadata: merged,
    LastModifiedDate: nowIso(),
  });
  return { OpsMetadataArn: arn };
};

const GetOpsSummary: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { Entities: [] };
};

const CreateActivation: OperationHandler = (input, ctx) => {
  const id = newId().replace(/-/g, "").slice(0, 16);
  const code = newId().replace(/-/g, "").slice(0, 20).toUpperCase();
  const now = nowIso();
  const expiry = new Date(Date.now() + 86400000).toISOString();
  const act: StoredActivation = {
    ActivationId: id,
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    DefaultInstanceName:
      typeof input["DefaultInstanceName"] === "string"
        ? input["DefaultInstanceName"]
        : "",
    IamRole: typeof input["IamRole"] === "string" ? input["IamRole"] : "",
    RegistrationLimit:
      typeof input["RegistrationLimit"] === "number"
        ? input["RegistrationLimit"]
        : 1,
    RegistrationsCount: 0,
    ExpirationDate: expiry,
    Expired: false,
    CreatedDate: now,
    Tags: Array.isArray(input["Tags"])
      ? (input["Tags"] as { Key: string; Value: string }[])
      : [],
  };
  ctx.store.set(actKey(id), act);
  return { ActivationId: id, ActivationCode: code };
};

const DeleteActivation: OperationHandler = (input, ctx) => {
  const id =
    typeof input["ActivationId"] === "string" ? input["ActivationId"] : "";
  ctx.store.delete(actKey(id));
  return {};
};

const DeregisterManagedInstance: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return {};
};

const DescribeActivations: OperationHandler = (input, ctx) => {
  void input;
  const activations = ctx.store
    .list<StoredActivation>()
    .filter((e) => e.key.startsWith("__act__/"))
    .map((e) => ({
      ActivationId: e.value.ActivationId,
      Description: e.value.Description,
      DefaultInstanceName: e.value.DefaultInstanceName,
      IamRole: e.value.IamRole,
      RegistrationLimit: e.value.RegistrationLimit,
      RegistrationsCount: e.value.RegistrationsCount,
      ExpirationDate: e.value.ExpirationDate,
      Expired: e.value.Expired,
      CreatedDate: e.value.CreatedDate,
      Tags: e.value.Tags,
    }));
  return { ActivationList: activations };
};

const UpdateManagedInstanceRole: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return {};
};

const CreateResourceDataSync: OperationHandler = (input, ctx) => {
  const syncName =
    typeof input["SyncName"] === "string" ? input["SyncName"] : "";
  if (syncName === "") {
    throw awsError("ValidationException", "SyncName is required.", 400);
  }
  if (ctx.store.get(rdsKey(syncName)) !== undefined) {
    throw awsError(
      "ResourceDataSyncAlreadyExistsException",
      `Sync ${syncName} already exists.`,
      400,
    );
  }
  const now = nowIso();
  const rds: StoredResourceDataSync = {
    SyncName: syncName,
    SyncType:
      typeof input["SyncType"] === "string"
        ? input["SyncType"]
        : "SyncToDestination",
    S3Destination:
      typeof input["S3Destination"] === "object" &&
      input["S3Destination"] !== null
        ? (input["S3Destination"] as Record<string, unknown>)
        : {},
    LastSyncTime: now,
    LastSuccessfulSyncTime: now,
    LastStatus: "InProgress",
    SyncCreatedTime: now,
    LastSyncStatusMessage: "",
    SyncSource:
      typeof input["SyncSource"] === "object" && input["SyncSource"] !== null
        ? (input["SyncSource"] as Record<string, unknown>)
        : {},
  };
  ctx.store.set(rdsKey(syncName), rds);
  return {};
};

const DeleteResourceDataSync: OperationHandler = (input, ctx) => {
  const syncName =
    typeof input["SyncName"] === "string" ? input["SyncName"] : "";
  ctx.store.delete(rdsKey(syncName));
  return {};
};

const ListResourceDataSync: OperationHandler = (input, ctx) => {
  void input;
  const items = ctx.store
    .list<StoredResourceDataSync>()
    .filter((e) => e.key.startsWith("__rds__/"))
    .map((e) => ({
      SyncName: e.value.SyncName,
      SyncType: e.value.SyncType,
      LastSyncTime: e.value.LastSyncTime,
      LastSuccessfulSyncTime: e.value.LastSuccessfulSyncTime,
      LastStatus: e.value.LastStatus,
      SyncCreatedTime: e.value.SyncCreatedTime,
      LastSyncStatusMessage: e.value.LastSyncStatusMessage,
      S3Destination: e.value.S3Destination,
    }));
  return { ResourceDataSyncItems: items };
};

const UpdateResourceDataSync: OperationHandler = (input, ctx) => {
  const syncName =
    typeof input["SyncName"] === "string" ? input["SyncName"] : "";
  const rds = ctx.store.get<StoredResourceDataSync>(rdsKey(syncName));
  if (rds === undefined) {
    throw awsError(
      "ResourceDataSyncNotFoundException",
      `Sync ${syncName} does not exist.`,
      400,
    );
  }
  ctx.store.set(rdsKey(syncName), { ...rds, LastSyncTime: nowIso() });
  return {};
};

const SendCommand: OperationHandler = (input, ctx) => {
  const docName =
    typeof input["DocumentName"] === "string" ? input["DocumentName"] : "";
  requireDoc(ctx, docName);
  const cmdId = newId();
  const now = nowIso();
  const targets = Array.isArray(input["Targets"])
    ? (input["Targets"] as { Key: string; Values: string[] }[])
    : [];
  const instanceIds = Array.isArray(input["InstanceIds"])
    ? (input["InstanceIds"] as unknown[]).map((v) => String(v))
    : targets.flatMap((t) => t.Values);
  const invocations: StoredCommandInvocation[] = instanceIds.map((iid) => ({
    CommandId: cmdId,
    InstanceId: iid,
    InstanceName: iid,
    Comment: typeof input["Comment"] === "string" ? input["Comment"] : "",
    DocumentName: docName,
    DocumentVersion:
      typeof input["DocumentVersion"] === "string"
        ? input["DocumentVersion"]
        : "$Default",
    RequestedDateTime: now,
    Status: "Success",
    StatusDetails: "Success",
    StandardOutputContent: "",
    StandardErrorContent: "",
    CommandPlugins: [
      {
        Name: "aws:runShellScript",
        Status: "Success",
        StatusDetails: "Success",
        ResponseCode: 0,
        Output: "",
      },
    ],
  }));
  const cmd: StoredCommand = {
    CommandId: cmdId,
    DocumentName: docName,
    DocumentVersion:
      typeof input["DocumentVersion"] === "string"
        ? input["DocumentVersion"]
        : "$Default",
    Comment: typeof input["Comment"] === "string" ? input["Comment"] : "",
    Parameters:
      typeof input["Parameters"] === "object" && input["Parameters"] !== null
        ? (input["Parameters"] as Record<string, string[]>)
        : {},
    Targets: targets,
    RequestedDateTime: now,
    Status: "Success",
    StatusDetails: "Success",
    OutputS3BucketName:
      typeof input["OutputS3BucketName"] === "string"
        ? input["OutputS3BucketName"]
        : "",
    OutputS3KeyPrefix:
      typeof input["OutputS3KeyPrefix"] === "string"
        ? input["OutputS3KeyPrefix"]
        : "",
    ServiceRole:
      typeof input["ServiceRoleArn"] === "string"
        ? input["ServiceRoleArn"]
        : "",
    Invocations: invocations,
  };
  ctx.store.set(cmdKey(cmdId), cmd);
  return {
    Command: {
      CommandId: cmd.CommandId,
      DocumentName: cmd.DocumentName,
      Status: cmd.Status,
      RequestedDateTime: cmd.RequestedDateTime,
      Targets: cmd.Targets,
    },
  };
};

const CancelCommand: OperationHandler = (input, ctx) => {
  const cmdId =
    typeof input["CommandId"] === "string" ? input["CommandId"] : "";
  const cmd = ctx.store.get<StoredCommand>(cmdKey(cmdId));
  if (cmd !== undefined) {
    ctx.store.set(cmdKey(cmdId), {
      ...cmd,
      Status: "Cancelled",
      StatusDetails: "Cancelled",
    });
  }
  return {};
};

const GetCommandInvocation: OperationHandler = (input, ctx) => {
  const cmdId =
    typeof input["CommandId"] === "string" ? input["CommandId"] : "";
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const cmd = ctx.store.get<StoredCommand>(cmdKey(cmdId));
  if (cmd === undefined) {
    throw awsError("InvalidCommandId", `Command ${cmdId} does not exist.`, 400);
  }
  const inv = cmd.Invocations.find((i) => i.InstanceId === instanceId);
  if (inv === undefined) {
    throw awsError(
      "InvocationDoesNotExist",
      `Invocation for instance ${instanceId} not found.`,
      400,
    );
  }
  return {
    CommandId: inv.CommandId,
    InstanceId: inv.InstanceId,
    DocumentName: inv.DocumentName,
    DocumentVersion: inv.DocumentVersion,
    Comment: inv.Comment,
    Status: inv.Status,
    StatusDetails: inv.StatusDetails,
    StandardOutputContent: inv.StandardOutputContent,
    StandardErrorContent: inv.StandardErrorContent,
    RequestedDateTime: inv.RequestedDateTime,
  };
};

const ListCommands: OperationHandler = (input, ctx) => {
  void input;
  const commands = ctx.store
    .list<StoredCommand>()
    .filter((e) => e.key.startsWith("__cmd__/"))
    .map((e) => ({
      CommandId: e.value.CommandId,
      DocumentName: e.value.DocumentName,
      Status: e.value.Status,
      StatusDetails: e.value.StatusDetails,
      RequestedDateTime: e.value.RequestedDateTime,
      Comment: e.value.Comment,
      Targets: e.value.Targets,
    }));
  return { Commands: commands };
};

const ListCommandInvocations: OperationHandler = (input, ctx) => {
  const cmdId =
    typeof input["CommandId"] === "string" ? input["CommandId"] : "";
  if (cmdId !== "") {
    const cmd = ctx.store.get<StoredCommand>(cmdKey(cmdId));
    if (cmd === undefined) return { CommandInvocations: [] };
    return {
      CommandInvocations: cmd.Invocations.map((inv) => ({
        CommandId: inv.CommandId,
        InstanceId: inv.InstanceId,
        DocumentName: inv.DocumentName,
        Status: inv.Status,
        StatusDetails: inv.StatusDetails,
        RequestedDateTime: inv.RequestedDateTime,
      })),
    };
  }
  const invocations = ctx.store
    .list<StoredCommand>()
    .filter((e) => e.key.startsWith("__cmd__/"))
    .flatMap((e) =>
      e.value.Invocations.map((inv) => ({
        CommandId: inv.CommandId,
        InstanceId: inv.InstanceId,
        DocumentName: inv.DocumentName,
        Status: inv.Status,
        StatusDetails: inv.StatusDetails,
        RequestedDateTime: inv.RequestedDateTime,
      })),
    );
  return { CommandInvocations: invocations };
};

const StartAutomationExecution: OperationHandler = (input, ctx) => {
  const docName =
    typeof input["DocumentName"] === "string" ? input["DocumentName"] : "";
  const execId = newId();
  const now = nowIso();
  const ae: StoredAutomationExecution = {
    AutomationExecutionId: execId,
    DocumentName: docName,
    DocumentVersion:
      typeof input["DocumentVersion"] === "string"
        ? input["DocumentVersion"]
        : "$Default",
    Status: "Success",
    StartTime: now,
    EndTime: now,
    Parameters:
      typeof input["Parameters"] === "object" && input["Parameters"] !== null
        ? (input["Parameters"] as Record<string, string[]>)
        : {},
    Outputs: {},
    AutomationType: "Local",
    Steps: [],
  };
  ctx.store.set(aeKey(execId), ae);
  return { AutomationExecutionId: execId };
};

const StopAutomationExecution: OperationHandler = (input, ctx) => {
  const execId =
    typeof input["AutomationExecutionId"] === "string"
      ? input["AutomationExecutionId"]
      : "";
  const ae = ctx.store.get<StoredAutomationExecution>(aeKey(execId));
  if (ae !== undefined) {
    ctx.store.set(aeKey(execId), { ...ae, Status: "Cancelled" });
  }
  return {};
};

const DescribeAutomationExecutions: OperationHandler = (input, ctx) => {
  void input;
  const executions = ctx.store
    .list<StoredAutomationExecution>()
    .filter((e) => e.key.startsWith("__ae__/"))
    .map((e) => ({
      AutomationExecutionId: e.value.AutomationExecutionId,
      DocumentName: e.value.DocumentName,
      DocumentVersion: e.value.DocumentVersion,
      AutomationExecutionStatus: e.value.Status,
      ExecutionStartTime: e.value.StartTime,
      ExecutionEndTime: e.value.EndTime,
    }));
  return { AutomationExecutionMetadataList: executions };
};

const DescribeAutomationStepExecutions: OperationHandler = (input, ctx) => {
  const execId =
    typeof input["AutomationExecutionId"] === "string"
      ? input["AutomationExecutionId"]
      : "";
  const ae = ctx.store.get<StoredAutomationExecution>(aeKey(execId));
  if (ae === undefined) {
    throw awsError(
      "AutomationExecutionNotFoundException",
      `Execution ${execId} does not exist.`,
      400,
    );
  }
  return { StepExecutions: ae.Steps };
};

const GetAutomationExecution: OperationHandler = (input, ctx) => {
  const execId =
    typeof input["AutomationExecutionId"] === "string"
      ? input["AutomationExecutionId"]
      : "";
  const ae = ctx.store.get<StoredAutomationExecution>(aeKey(execId));
  if (ae === undefined) {
    throw awsError(
      "AutomationExecutionNotFoundException",
      `Execution ${execId} does not exist.`,
      400,
    );
  }
  return {
    AutomationExecution: {
      AutomationExecutionId: ae.AutomationExecutionId,
      DocumentName: ae.DocumentName,
      DocumentVersion: ae.DocumentVersion,
      AutomationExecutionStatus: ae.Status,
      ExecutionStartTime: ae.StartTime,
      ExecutionEndTime: ae.EndTime,
      Parameters: ae.Parameters,
      Outputs: ae.Outputs,
      StepExecutions: ae.Steps,
    },
  };
};

const SendAutomationSignal: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return {};
};

const StartChangeRequestExecution: OperationHandler = (input, ctx) => {
  const execId = newId();
  const now = nowIso();
  const ae: StoredAutomationExecution = {
    AutomationExecutionId: execId,
    DocumentName:
      typeof input["DocumentName"] === "string" ? input["DocumentName"] : "",
    DocumentVersion:
      typeof input["DocumentVersion"] === "string"
        ? input["DocumentVersion"]
        : "$Default",
    Status: "Success",
    StartTime: now,
    EndTime: now,
    Parameters: {},
    Outputs: {},
    AutomationType: "CrossAccount",
    Steps: [],
  };
  ctx.store.set(aeKey(execId), ae);
  return { AutomationExecutionId: execId };
};

const StartExecutionPreview: OperationHandler = (input, ctx) => {
  void ctx;
  const previewId = newId();
  void input;
  return { ExecutionPreviewId: previewId };
};

const GetExecutionPreview: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return {
    ExecutionPreviewId:
      typeof input["ExecutionPreviewId"] === "string"
        ? input["ExecutionPreviewId"]
        : "",
    Status: "Success",
    StatusMessage: "",
  };
};

const StartSession: OperationHandler = (input, ctx) => {
  const target = typeof input["Target"] === "string" ? input["Target"] : "";
  const sessionId = `session-${newId().replace(/-/g, "").slice(0, 16)}`;
  const now = nowIso();
  const sess: StoredSession = {
    SessionId: sessionId,
    Target: target,
    Status: "Connected",
    StartDate: now,
    EndDate: "",
    DocumentName:
      typeof input["DocumentName"] === "string" ? input["DocumentName"] : "",
    Owner: ctx.account,
    StreamUrl: `wss://ssmmessages.${ctx.region}.amazonaws.com/v1/data-channel/${sessionId}?role=publish_subscribe`,
    TokenValue: newId(),
  };
  ctx.store.set(sessKey(sessionId), sess);
  return {
    SessionId: sessionId,
    StreamUrl: sess.StreamUrl,
    TokenValue: sess.TokenValue,
  };
};

const TerminateSession: OperationHandler = (input, ctx) => {
  const sessionId =
    typeof input["SessionId"] === "string" ? input["SessionId"] : "";
  const sess = ctx.store.get<StoredSession>(sessKey(sessionId));
  if (sess !== undefined) {
    ctx.store.set(sessKey(sessionId), {
      ...sess,
      Status: "Terminated",
      EndDate: nowIso(),
    });
  }
  return { SessionId: sessionId };
};

const ResumeSession: OperationHandler = (input, ctx) => {
  const sessionId =
    typeof input["SessionId"] === "string" ? input["SessionId"] : "";
  const sess = ctx.store.get<StoredSession>(sessKey(sessionId));
  if (sess === undefined) {
    throw awsError(
      "DoesNotExistException",
      `Session ${sessionId} does not exist.`,
      400,
    );
  }
  ctx.store.set(sessKey(sessionId), { ...sess, Status: "Connected" });
  return {
    SessionId: sessionId,
    StreamUrl: sess.StreamUrl,
    TokenValue: sess.TokenValue,
  };
};

const DescribeSessions: OperationHandler = (input, ctx) => {
  void input;
  const sessions = ctx.store
    .list<StoredSession>()
    .filter((e) => e.key.startsWith("__sess__/"))
    .map((e) => ({
      SessionId: e.value.SessionId,
      Target: e.value.Target,
      Status: e.value.Status,
      StartDate: e.value.StartDate,
      EndDate: e.value.EndDate,
      DocumentName: e.value.DocumentName,
      Owner: e.value.Owner,
    }));
  return { Sessions: sessions };
};

const GetConnectionStatus: OperationHandler = (input, ctx) => {
  void ctx;
  const target = typeof input["Target"] === "string" ? input["Target"] : "";
  return { Target: target, Status: "Connected" };
};

const GetAccessToken: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return {
    TokenValue: newId(),
    AccessRequestId: newId(),
    ExpirationTime: new Date(Date.now() + 3600000).toISOString(),
  };
};

const StartAccessRequest: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { AccessRequestId: newId() };
};

const GetInventory: OperationHandler = (input, ctx) => {
  void input;
  const entities = ctx.store
    .list<StoredInventory>()
    .filter((e) => e.key.startsWith("__inv__/"))
    .reduce<
      Map<
        string,
        {
          Id: string;
          Data: Record<
            string,
            {
              TypeName: string;
              SchemaVersion: string;
              CaptureTime: string;
              Content: Record<string, unknown>[];
            }
          >;
        }
      >
    >((acc, e) => {
      const id = e.value.InstanceId;
      if (!acc.has(id)) acc.set(id, { Id: id, Data: {} });
      const entity = acc.get(id)!;
      entity.Data[e.value.TypeName] = {
        TypeName: e.value.TypeName,
        SchemaVersion: e.value.SchemaVersion,
        CaptureTime: e.value.CaptureTime,
        Content: e.value.Content,
      };
      return acc;
    }, new Map());
  return { Entities: Array.from(entities.values()) };
};

const GetInventorySchema: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return {
    Schemas: [
      {
        TypeName: "AWS:Application",
        Version: "1.1",
        Attributes: [{ Name: "Name", DataType: "STRING" }],
      },
    ],
  };
};

const PutInventory: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const items = Array.isArray(input["Items"])
    ? (input["Items"] as Record<string, unknown>[])
    : [];
  for (const item of items) {
    const typeName =
      typeof item["TypeName"] === "string"
        ? item["TypeName"]
        : "AWS:Application";
    const inv: StoredInventory = {
      InstanceId: instanceId,
      TypeName: typeName,
      SchemaVersion:
        typeof item["SchemaVersion"] === "string"
          ? item["SchemaVersion"]
          : "1.0",
      CaptureTime:
        typeof item["CaptureTime"] === "string"
          ? item["CaptureTime"]
          : nowIso(),
      ContentHash: newId(),
      Content: Array.isArray(item["Content"])
        ? (item["Content"] as Record<string, unknown>[])
        : [],
    };
    ctx.store.set(invKey(instanceId, typeName), inv);
  }
  return {};
};

const DeleteInventory: OperationHandler = (input, ctx) => {
  const typeName =
    typeof input["TypeName"] === "string" ? input["TypeName"] : "";
  const deletionId = newId();
  const dryRun = input["DryRun"] === true;
  if (!dryRun && typeName !== "") {
    for (const entry of ctx.store.list<StoredInventory>()) {
      if (
        entry.key.startsWith("__inv__/") &&
        entry.value.TypeName === typeName
      ) {
        ctx.store.delete(entry.key);
      }
    }
  }
  return {
    DeletionId: deletionId,
    TypeName: typeName,
    DeletionSummary: { TotalCount: 0, RemainingCount: 0, SummaryItems: [] },
  };
};

const DescribeInventoryDeletions: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { InventoryDeletions: [] };
};

const ListInventoryEntries: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const typeName =
    typeof input["TypeName"] === "string" ? input["TypeName"] : "";
  const inv = ctx.store.get<StoredInventory>(invKey(instanceId, typeName));
  if (inv === undefined) {
    return {
      InstanceId: instanceId,
      TypeName: typeName,
      SchemaVersion: "1.0",
      CaptureTime: nowIso(),
      Entries: [],
    };
  }
  return {
    InstanceId: instanceId,
    TypeName: typeName,
    SchemaVersion: inv.SchemaVersion,
    CaptureTime: inv.CaptureTime,
    Entries: inv.Content,
  };
};

const ListComplianceItems: OperationHandler = (input, ctx) => {
  void input;
  const items = ctx.store
    .list<StoredComplianceItem>()
    .filter((e) => e.key.startsWith("__comp__/"))
    .flatMap((e) =>
      e.value.Items.map((item) => ({
        ComplianceType: e.value.ComplianceType,
        ResourceType: e.value.ResourceType,
        ResourceId: e.value.ResourceId,
        Id: item.Id,
        Title: item.Title,
        Severity: item.Severity,
        Status: item.Status,
        Details: item.Details,
        ExecutionSummary: e.value.ExecutionSummary,
      })),
    );
  return { ComplianceItems: items };
};

const ListComplianceSummaries: OperationHandler = (input, ctx) => {
  void input;
  const types = new Set(
    ctx.store
      .list<StoredComplianceItem>()
      .filter((e) => e.key.startsWith("__comp__/"))
      .map((e) => e.value.ComplianceType),
  );
  const summaries = Array.from(types).map((t) => ({
    ComplianceType: t,
    CompliantSummary: { CompliantCount: 0, SeveritySummary: {} },
    NonCompliantSummary: { NonCompliantCount: 0, SeveritySummary: {} },
  }));
  return { ComplianceSummaryItems: summaries };
};

const ListResourceComplianceSummaries: OperationHandler = (input, ctx) => {
  void input;
  const items = ctx.store
    .list<StoredComplianceItem>()
    .filter((e) => e.key.startsWith("__comp__/"))
    .map((e) => ({
      ComplianceType: e.value.ComplianceType,
      ResourceType: e.value.ResourceType,
      ResourceId: e.value.ResourceId,
      Status: "COMPLIANT",
      ExecutionSummary: e.value.ExecutionSummary,
    }));
  return { ResourceComplianceSummaryItems: items };
};

const PutComplianceItems: OperationHandler = (input, ctx) => {
  const resourceId =
    typeof input["ResourceId"] === "string" ? input["ResourceId"] : "";
  const resourceType =
    typeof input["ResourceType"] === "string" ? input["ResourceType"] : "";
  const complianceType =
    typeof input["ComplianceType"] === "string" ? input["ComplianceType"] : "";
  const execSummary =
    typeof input["ExecutionSummary"] === "object" &&
    input["ExecutionSummary"] !== null
      ? (input["ExecutionSummary"] as {
          ExecutionTime: string;
          ExecutionId: string;
          ExecutionType: string;
        })
      : {
          ExecutionTime: nowIso(),
          ExecutionId: newId(),
          ExecutionType: "Command",
        };
  const items = Array.isArray(input["Items"])
    ? (input["Items"] as {
        Id: string;
        Title: string;
        Severity: string;
        Status: string;
        Details: Record<string, string>;
      }[])
    : [];
  const key = compKey(resourceId, complianceType);
  ctx.store.set(key, {
    ResourceId: resourceId,
    ResourceType: resourceType,
    ComplianceType: complianceType,
    ExecutionSummary: execSummary,
    Items: items,
  });
  return {};
};

const DescribeInstanceInformation: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { InstanceInformationList: [] };
};

const DescribeInstanceProperties: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { InstanceProperties: [] };
};

const ListNodes: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { Nodes: [] };
};

const ListNodesSummary: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { Summary: [] };
};

const GetServiceSetting: OperationHandler = (input, ctx) => {
  const settingId =
    typeof input["SettingId"] === "string" ? input["SettingId"] : "";
  const existing = ctx.store.get<StoredServiceSetting>(settingKey(settingId));
  if (existing !== undefined) {
    return { ServiceSetting: existing };
  }
  return {
    ServiceSetting: {
      SettingId: settingId,
      SettingValue: "",
      LastModifiedDate: nowIso(),
      LastModifiedUser: "System",
      ARN: `arn:aws:ssm:${ctx.region}:${ctx.account}:servicesetting${settingId}`,
      Status: "Default",
    },
  };
};

const ResetServiceSetting: OperationHandler = (input, ctx) => {
  const settingId =
    typeof input["SettingId"] === "string" ? input["SettingId"] : "";
  ctx.store.delete(settingKey(settingId));
  return {
    ServiceSetting: {
      SettingId: settingId,
      SettingValue: "",
      Status: "Default",
      ARN: `arn:aws:ssm:${ctx.region}:${ctx.account}:servicesetting${settingId}`,
    },
  };
};

const UpdateServiceSetting: OperationHandler = (input, ctx) => {
  const settingId =
    typeof input["SettingId"] === "string" ? input["SettingId"] : "";
  const settingValue =
    typeof input["SettingValue"] === "string" ? input["SettingValue"] : "";
  const setting: StoredServiceSetting = {
    SettingId: settingId,
    SettingValue: settingValue,
    LastModifiedDate: nowIso(),
    LastModifiedUser: ctx.account,
    ARN: `arn:aws:ssm:${ctx.region}:${ctx.account}:servicesetting${settingId}`,
    Status: "Customized",
  };
  ctx.store.set(settingKey(settingId), setting);
  return {};
};

const GetResourcePolicies: OperationHandler = (input, ctx) => {
  const arn =
    typeof input["ResourceArn"] === "string" ? input["ResourceArn"] : "";
  const policies = ctx.store
    .list<StoredResourcePolicy>()
    .filter((e) => e.key.startsWith(`__rpol__/${arn}/`))
    .map((e) => ({
      PolicyId: e.value.PolicyId,
      PolicyHash: e.value.PolicyHash,
      Policy: e.value.Policy,
    }));
  return { Policies: policies };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const arn =
    typeof input["ResourceArn"] === "string" ? input["ResourceArn"] : "";
  const policy = typeof input["Policy"] === "string" ? input["Policy"] : "{}";
  const policyId =
    typeof input["PolicyId"] === "string" && input["PolicyId"] !== ""
      ? input["PolicyId"]
      : newId();
  const policyHash = newId();
  const stored: StoredResourcePolicy = {
    PolicyId: policyId,
    PolicyHash: policyHash,
    Policy: policy,
    ResourceArn: arn,
  };
  ctx.store.set(rpolKey(arn, policyId), stored);
  return { PolicyId: policyId, PolicyHash: policyHash };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const arn =
    typeof input["ResourceArn"] === "string" ? input["ResourceArn"] : "";
  const policyId =
    typeof input["PolicyId"] === "string" ? input["PolicyId"] : "";
  ctx.store.delete(rpolKey(arn, policyId));
  return {};
};

const GetCalendarState: OperationHandler = (input, ctx) => {
  void ctx;
  void input;
  return { State: "OPEN", AtTime: nowIso() };
};

const GetDeployablePatchSnapshotForInstance: OperationHandler = (
  input,
  ctx,
) => {
  void ctx;
  void input;
  return {
    InstanceId:
      typeof input["InstanceId"] === "string" ? input["InstanceId"] : "",
    SnapshotId: newId(),
    SnapshotDownloadUrl: `https://s3.amazonaws.com/patch-snapshot/${newId()}`,
    Product: "WindowsServer2019",
  };
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
    DeleteParameters,
    DescribeParameters,
    AddTagsToResource,
    RemoveTagsFromResource,
    ListTagsForResource,
    LabelParameterVersion,
    UnlabelParameterVersion,
    GetParameterHistory,
    CreateDocument,
    DeleteDocument,
    DescribeDocument,
    DescribeDocumentPermission,
    GetDocument,
    ListDocuments,
    ListDocumentVersions,
    ListDocumentMetadataHistory,
    UpdateDocument,
    UpdateDocumentDefaultVersion,
    UpdateDocumentMetadata,
    ModifyDocumentPermission,
    CreateAssociation,
    CreateAssociationBatch,
    DeleteAssociation,
    DescribeAssociation,
    DescribeAssociationExecutions,
    DescribeAssociationExecutionTargets,
    DescribeEffectiveInstanceAssociations,
    DescribeInstanceAssociationsStatus,
    ListAssociations,
    ListAssociationVersions,
    UpdateAssociation,
    UpdateAssociationStatus,
    StartAssociationsOnce,
    CreateMaintenanceWindow,
    DeleteMaintenanceWindow,
    DescribeMaintenanceWindows,
    DescribeMaintenanceWindowsForTarget,
    DescribeMaintenanceWindowExecutions,
    DescribeMaintenanceWindowExecutionTasks,
    DescribeMaintenanceWindowExecutionTaskInvocations,
    DescribeMaintenanceWindowSchedule,
    DescribeMaintenanceWindowTargets,
    DescribeMaintenanceWindowTasks,
    GetMaintenanceWindow,
    GetMaintenanceWindowExecution,
    GetMaintenanceWindowExecutionTask,
    GetMaintenanceWindowExecutionTaskInvocation,
    GetMaintenanceWindowTask,
    RegisterTargetWithMaintenanceWindow,
    RegisterTaskWithMaintenanceWindow,
    DeregisterTargetFromMaintenanceWindow,
    DeregisterTaskFromMaintenanceWindow,
    UpdateMaintenanceWindow,
    UpdateMaintenanceWindowTarget,
    UpdateMaintenanceWindowTask,
    CancelMaintenanceWindowExecution,
    CreatePatchBaseline,
    DeletePatchBaseline,
    DescribePatchBaselines,
    GetPatchBaseline,
    GetPatchBaselineForPatchGroup,
    RegisterDefaultPatchBaseline,
    GetDefaultPatchBaseline,
    RegisterPatchBaselineForPatchGroup,
    DeregisterPatchBaselineForPatchGroup,
    DescribePatchGroups,
    DescribePatchGroupState,
    UpdatePatchBaseline,
    DescribeAvailablePatches,
    DescribeEffectivePatchesForPatchBaseline,
    DescribeInstancePatches,
    DescribeInstancePatchStates,
    DescribeInstancePatchStatesForPatchGroup,
    DescribePatchProperties,
    CreateOpsItem,
    DeleteOpsItem,
    DescribeOpsItems,
    GetOpsItem,
    UpdateOpsItem,
    AssociateOpsItemRelatedItem,
    DisassociateOpsItemRelatedItem,
    ListOpsItemEvents,
    ListOpsItemRelatedItems,
    CreateOpsMetadata,
    DeleteOpsMetadata,
    GetOpsMetadata,
    ListOpsMetadata,
    UpdateOpsMetadata,
    GetOpsSummary,
    CreateActivation,
    DeleteActivation,
    DeregisterManagedInstance,
    DescribeActivations,
    UpdateManagedInstanceRole,
    CreateResourceDataSync,
    DeleteResourceDataSync,
    ListResourceDataSync,
    UpdateResourceDataSync,
    SendCommand,
    CancelCommand,
    GetCommandInvocation,
    ListCommands,
    ListCommandInvocations,
    StartAutomationExecution,
    StopAutomationExecution,
    DescribeAutomationExecutions,
    DescribeAutomationStepExecutions,
    GetAutomationExecution,
    SendAutomationSignal,
    StartChangeRequestExecution,
    StartExecutionPreview,
    GetExecutionPreview,
    StartSession,
    TerminateSession,
    ResumeSession,
    DescribeSessions,
    GetConnectionStatus,
    GetAccessToken,
    StartAccessRequest,
    GetInventory,
    GetInventorySchema,
    PutInventory,
    DeleteInventory,
    DescribeInventoryDeletions,
    ListInventoryEntries,
    ListComplianceItems,
    ListComplianceSummaries,
    ListResourceComplianceSummaries,
    PutComplianceItems,
    DescribeInstanceInformation,
    DescribeInstanceProperties,
    ListNodes,
    ListNodesSummary,
    GetServiceSetting,
    ResetServiceSetting,
    UpdateServiceSetting,
    GetResourcePolicies,
    PutResourcePolicy,
    DeleteResourcePolicy,
    GetCalendarState,
    GetDeployablePatchSnapshotForInstance,
  },
  model,
} as const;

export default ssm;
