import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/frauddetector.json", { with: { type: "json" } }),
  { targetPrefix: "AWSHawksNestServiceFacade" },
);

type StoredDetector = {
  detectorId: string;
  description: string | undefined;
  eventTypeName: string;
  createdTime: string;
  lastUpdatedTime: string;
  arn: string;
};

type StoredDetectorVersion = {
  detectorId: string;
  detectorVersionId: string;
  description: string | undefined;
  externalModelEndpoints: string[];
  modelVersions: unknown[];
  rules: unknown[];
  status: string;
  ruleExecutionMode: string | undefined;
  createdTime: string;
  lastUpdatedTime: string;
  arn: string;
};

type StoredVariable = {
  name: string;
  dataType: string;
  dataSource: string;
  defaultValue: string;
  description: string | undefined;
  variableType: string | undefined;
  createdTime: string;
  lastUpdatedTime: string;
  arn: string;
};

type StoredEntityType = {
  name: string;
  description: string | undefined;
  createdTime: string;
  lastUpdatedTime: string;
  arn: string;
};

type StoredEventType = {
  name: string;
  description: string | undefined;
  eventVariables: string[];
  labels: string[] | undefined;
  entityTypes: string[];
  createdTime: string;
  lastUpdatedTime: string;
  arn: string;
};

type StoredLabel = {
  name: string;
  description: string | undefined;
  createdTime: string;
  lastUpdatedTime: string;
  arn: string;
};

type StoredOutcome = {
  name: string;
  description: string | undefined;
  createdTime: string;
  lastUpdatedTime: string;
  arn: string;
};

type StoredExternalModel = {
  modelEndpoint: string;
  modelSource: string;
  invokeModelEndpointRoleArn: string;
  inputConfiguration: unknown;
  outputConfiguration: unknown;
  modelEndpointStatus: string;
  createdTime: string;
  lastUpdatedTime: string;
  arn: string;
};

type StoredModel = {
  modelId: string;
  modelType: string;
  description: string | undefined;
  eventTypeName: string;
  createdTime: string;
  lastUpdatedTime: string;
  arn: string;
};

type StoredModelVersion = {
  modelId: string;
  modelType: string;
  modelVersionNumber: string;
  trainingDataSource: string;
  trainingDataSchema: unknown;
  externalEventsDetail: unknown;
  ingestedEventsDetail: unknown;
  status: string;
  createdTime: string;
  lastUpdatedTime: string;
  arn: string;
};

type StoredRule = {
  ruleId: string;
  detectorId: string;
  ruleVersion: string;
  description: string | undefined;
  expression: string;
  language: string;
  outcomes: string[];
  createdTime: string;
  lastUpdatedTime: string;
  arn: string;
};

type StoredList = {
  name: string;
  elements: string[];
  variableType: string | undefined;
  description: string | undefined;
  createdTime: string;
  updatedTime: string;
  arn: string;
};

type StoredBatchImportJob = {
  jobId: string;
  status: string;
  inputPath: string;
  outputPath: string;
  eventTypeName: string;
  iamRoleArn: string;
  startTime: string;
  completionTime: string | undefined;
  arn: string;
};

type StoredBatchPredictionJob = {
  jobId: string;
  status: string;
  inputPath: string;
  outputPath: string;
  eventTypeName: string;
  detectorName: string;
  detectorVersion: string | undefined;
  iamRoleArn: string;
  startTime: string;
  completionTime: string | undefined;
  arn: string;
};

type StoredEvent = {
  eventId: string;
  eventTypeName: string;
  eventTimestamp: string;
  eventVariables: Record<string, string>;
  currentLabel: string | undefined;
  labelTimestamp: string | undefined;
  entities: unknown[];
};

type StoredPrediction = {
  eventId: string;
  eventTypeName: string;
  detectorId: string;
  detectorVersionId: string;
  predictionTimestamp: string;
  entityId: string;
  entityType: string;
  ruleResults: { ruleId: string; outcomes: string[] }[];
  modelVersions: unknown[];
};

type StoredTags = Record<string, string>;

const detectorKey = (id: string): string => `detector/${id}`;
const detectorVersionKey = (detectorId: string, versionId: string): string =>
  `detectorVersion/${detectorId}/${versionId}`;
const variableKey = (name: string): string => `variable/${name}`;
const entityTypeKey = (name: string): string => `entityType/${name}`;
const eventTypeKey = (name: string): string => `eventType/${name}`;
const labelKey = (name: string): string => `label/${name}`;
const outcomeKey = (name: string): string => `outcome/${name}`;
const externalModelKey = (endpoint: string): string =>
  `externalModel/${endpoint}`;
const modelKey = (modelId: string, modelType: string): string =>
  `model/${modelId}/${modelType}`;
const modelVersionKey = (
  modelId: string,
  modelType: string,
  versionNumber: string,
): string => `modelVersion/${modelId}/${modelType}/${versionNumber}`;
const ruleKey = (
  detectorId: string,
  ruleId: string,
  ruleVersion: string,
): string => `rule/${detectorId}/${ruleId}/${ruleVersion}`;
const listKey = (name: string): string => `list/${name}`;
const batchImportKey = (jobId: string): string => `batchImport/${jobId}`;
const batchPredictionKey = (jobId: string): string =>
  `batchPrediction/${jobId}`;
const eventKey = (eventId: string, eventTypeName: string): string =>
  `event/${eventId}/${eventTypeName}`;
const predictionKey = (
  eventId: string,
  eventTypeName: string,
  detectorId: string,
  detectorVersionId: string,
  predictionTimestamp: string,
): string =>
  `prediction/${eventId}/${eventTypeName}/${detectorId}/${detectorVersionId}/${predictionTimestamp}`;
const tagsKey = (resourceArn: string): string => `tags/${resourceArn}`;
const kmsKeyStoreKey = "kmsKey";

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const stringArrayOrEmpty = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];

const resourceArn = (
  ctx: ServiceContext,
  resource: string,
  id: string,
): string =>
  `arn:aws:frauddetector:${ctx.region}:${ctx.account}:${resource}/${id}`;

const detectorArn = (ctx: ServiceContext, id: string): string =>
  resourceArn(ctx, "detector", id);

const requireDetector = (ctx: ServiceContext, id: string): StoredDetector => {
  const det = ctx.store.get<StoredDetector>(detectorKey(id));
  if (det === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Detector not found: ${id}`,
      400,
    );
  }
  return det;
};

const requireDetectorVersion = (
  ctx: ServiceContext,
  detectorId: string,
  versionId: string,
): StoredDetectorVersion => {
  const dv = ctx.store.get<StoredDetectorVersion>(
    detectorVersionKey(detectorId, versionId),
  );
  if (dv === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Detector version not found: ${detectorId}/${versionId}`,
      400,
    );
  }
  return dv;
};

const requireVariable = (ctx: ServiceContext, name: string): StoredVariable => {
  const v = ctx.store.get<StoredVariable>(variableKey(name));
  if (v === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Variable not found: ${name}`,
      400,
    );
  }
  return v;
};

const requireEntityType = (
  ctx: ServiceContext,
  name: string,
): StoredEntityType => {
  const et = ctx.store.get<StoredEntityType>(entityTypeKey(name));
  if (et === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Entity type not found: ${name}`,
      400,
    );
  }
  return et;
};

const requireEventType = (
  ctx: ServiceContext,
  name: string,
): StoredEventType => {
  const et = ctx.store.get<StoredEventType>(eventTypeKey(name));
  if (et === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Event type not found: ${name}`,
      400,
    );
  }
  return et;
};

const requireLabel = (ctx: ServiceContext, name: string): StoredLabel => {
  const lbl = ctx.store.get<StoredLabel>(labelKey(name));
  if (lbl === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Label not found: ${name}`,
      400,
    );
  }
  return lbl;
};

const requireOutcome = (ctx: ServiceContext, name: string): StoredOutcome => {
  const o = ctx.store.get<StoredOutcome>(outcomeKey(name));
  if (o === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Outcome not found: ${name}`,
      400,
    );
  }
  return o;
};

const requireExternalModel = (
  ctx: ServiceContext,
  endpoint: string,
): StoredExternalModel => {
  const em = ctx.store.get<StoredExternalModel>(externalModelKey(endpoint));
  if (em === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `External model not found: ${endpoint}`,
      400,
    );
  }
  return em;
};

const requireModel = (
  ctx: ServiceContext,
  modelId: string,
  modelType: string,
): StoredModel => {
  const m = ctx.store.get<StoredModel>(modelKey(modelId, modelType));
  if (m === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Model not found: ${modelId}`,
      400,
    );
  }
  return m;
};

const requireModelVersion = (
  ctx: ServiceContext,
  modelId: string,
  modelType: string,
  versionNumber: string,
): StoredModelVersion => {
  const mv = ctx.store.get<StoredModelVersion>(
    modelVersionKey(modelId, modelType, versionNumber),
  );
  if (mv === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Model version not found: ${modelId}/${modelType}/${versionNumber}`,
      400,
    );
  }
  return mv;
};

const requireRule = (
  ctx: ServiceContext,
  detectorId: string,
  ruleId: string,
  ruleVersion: string,
): StoredRule => {
  const r = ctx.store.get<StoredRule>(ruleKey(detectorId, ruleId, ruleVersion));
  if (r === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Rule not found: ${detectorId}/${ruleId}/${ruleVersion}`,
      400,
    );
  }
  return r;
};

const requireList = (ctx: ServiceContext, name: string): StoredList => {
  const lst = ctx.store.get<StoredList>(listKey(name));
  if (lst === undefined) {
    throw awsError("ResourceNotFoundException", `List not found: ${name}`, 400);
  }
  return lst;
};

const requireBatchImport = (
  ctx: ServiceContext,
  jobId: string,
): StoredBatchImportJob => {
  const job = ctx.store.get<StoredBatchImportJob>(batchImportKey(jobId));
  if (job === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Batch import job not found: ${jobId}`,
      400,
    );
  }
  return job;
};

const requireBatchPrediction = (
  ctx: ServiceContext,
  jobId: string,
): StoredBatchPredictionJob => {
  const job = ctx.store.get<StoredBatchPredictionJob>(
    batchPredictionKey(jobId),
  );
  if (job === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Batch prediction job not found: ${jobId}`,
      400,
    );
  }
  return job;
};

const getTags = (ctx: ServiceContext, arn: string): StoredTags =>
  ctx.store.get<StoredTags>(tagsKey(arn)) ?? {};

const setTags = (ctx: ServiceContext, arn: string, tags: StoredTags): void => {
  ctx.store.set(tagsKey(arn), tags);
};

const tagsToList = (tags: StoredTags): { key: string; value: string }[] =>
  Object.entries(tags).map(([key, value]) => ({ key, value }));

const paginate = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
): { page: T[]; nextToken: string | undefined } => {
  const pageSize =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : 100;
  const startIndex =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(nextToken, 10)
      : 0;
  const page = items.slice(startIndex, startIndex + pageSize);
  const newNextToken =
    startIndex + pageSize < items.length
      ? String(startIndex + pageSize)
      : undefined;
  return { page, nextToken: newNextToken };
};

const PutDetector: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "detectorId");
  const eventTypeName = requireString(input, "eventTypeName");
  const now = new Date().toISOString();
  const existing = ctx.store.get<StoredDetector>(detectorKey(detectorId));
  const detector: StoredDetector = {
    detectorId,
    description: stringOrUndefined(input["description"]),
    eventTypeName,
    createdTime: existing?.createdTime ?? now,
    lastUpdatedTime: now,
    arn: detectorArn(ctx, detectorId),
  };
  ctx.store.set(detectorKey(detectorId), detector);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing2 = getTags(ctx, detector.arn);
    tags.forEach((t) => {
      existing2[t.key] = t.value;
    });
    setTags(ctx, detector.arn, existing2);
  }
  return {};
};

const GetDetectors: OperationHandler = (input, ctx) => {
  const detectorId = stringOrUndefined(input["detectorId"]);
  const all = ctx.store
    .list<StoredDetector>()
    .filter((entry) => entry.key.startsWith("detector/"))
    .map((entry) => entry.value)
    .filter(
      (detector) =>
        detectorId === undefined || detector.detectorId === detectorId,
    )
    .sort((a, b) =>
      a.detectorId < b.detectorId ? -1 : a.detectorId > b.detectorId ? 1 : 0,
    );
  const { page: detectors, nextToken } = paginate(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return { detectors, ...(nextToken !== undefined ? { nextToken } : {}) };
};

const DeleteDetector: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "detectorId");
  const detector = ctx.store.get<StoredDetector>(detectorKey(detectorId));
  if (detector === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Detector not found: ${detectorId}`,
      404,
    );
  }
  ctx.store.delete(detectorKey(detectorId));
  ctx.store.delete(tagsKey(detector.arn));
  return {};
};

let _detectorVersionCounter = 1;
const nextDetectorVersionId = (): string => String(_detectorVersionCounter++);

const CreateDetectorVersion: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "detectorId");
  requireDetector(ctx, detectorId);
  const versionId = nextDetectorVersionId();
  const now = new Date().toISOString();
  const dv: StoredDetectorVersion = {
    detectorId,
    detectorVersionId: versionId,
    description: stringOrUndefined(input["description"]),
    externalModelEndpoints: stringArrayOrEmpty(input["externalModelEndpoints"]),
    modelVersions: arrayOrEmpty(input["modelVersions"]),
    rules: arrayOrEmpty(input["rules"]),
    status: "DRAFT",
    ruleExecutionMode: stringOrUndefined(input["ruleExecutionMode"]),
    createdTime: now,
    lastUpdatedTime: now,
    arn: resourceArn(ctx, `detector/${detectorId}/versions`, versionId),
  };
  ctx.store.set(detectorVersionKey(detectorId, versionId), dv);
  return {
    detectorId,
    detectorVersionId: versionId,
    status: "DRAFT",
  };
};

const GetDetectorVersion: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "detectorId");
  const detectorVersionId = requireString(input, "detectorVersionId");
  const dv = requireDetectorVersion(ctx, detectorId, detectorVersionId);
  return {
    detectorId: dv.detectorId,
    detectorVersionId: dv.detectorVersionId,
    description: dv.description,
    externalModelEndpoints: dv.externalModelEndpoints,
    modelVersions: dv.modelVersions,
    rules: dv.rules,
    status: dv.status,
    ruleExecutionMode: dv.ruleExecutionMode,
    lastUpdatedTime: dv.lastUpdatedTime,
    createdTime: dv.createdTime,
    arn: dv.arn,
  };
};

const DescribeDetector: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "detectorId");
  const det = requireDetector(ctx, detectorId);
  const allVersions = ctx.store
    .list<StoredDetectorVersion>()
    .filter((e) => e.key.startsWith(`detectorVersion/${detectorId}/`))
    .map((e) => e.value)
    .map((dv) => ({
      detectorVersionId: dv.detectorVersionId,
      status: dv.status,
      description: dv.description,
      lastUpdatedTime: dv.lastUpdatedTime,
    }));
  const { page: detectorVersionSummaries, nextToken } = paginate(
    allVersions,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    detectorId,
    detectorVersionSummaries,
    arn: det.arn,
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const UpdateDetectorVersion: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "detectorId");
  const detectorVersionId = requireString(input, "detectorVersionId");
  const dv = requireDetectorVersion(ctx, detectorId, detectorVersionId);
  if (dv.status !== "DRAFT") {
    throw awsError(
      "ConflictException",
      `Cannot update detector version in status ${dv.status}. Only DRAFT versions are updatable.`,
      409,
    );
  }
  const now = new Date().toISOString();
  const updated: StoredDetectorVersion = {
    ...dv,
    description: stringOrUndefined(input["description"]) ?? dv.description,
    externalModelEndpoints: Array.isArray(input["externalModelEndpoints"])
      ? stringArrayOrEmpty(input["externalModelEndpoints"])
      : dv.externalModelEndpoints,
    modelVersions: Array.isArray(input["modelVersions"])
      ? arrayOrEmpty(input["modelVersions"])
      : dv.modelVersions,
    rules: Array.isArray(input["rules"])
      ? arrayOrEmpty(input["rules"])
      : dv.rules,
    ruleExecutionMode:
      stringOrUndefined(input["ruleExecutionMode"]) ?? dv.ruleExecutionMode,
    lastUpdatedTime: now,
  };
  ctx.store.set(detectorVersionKey(detectorId, detectorVersionId), updated);
  return {};
};

const UpdateDetectorVersionMetadata: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "detectorId");
  const detectorVersionId = requireString(input, "detectorVersionId");
  const description = requireString(input, "description");
  const dv = requireDetectorVersion(ctx, detectorId, detectorVersionId);
  const now = new Date().toISOString();
  ctx.store.set(detectorVersionKey(detectorId, detectorVersionId), {
    ...dv,
    description,
    lastUpdatedTime: now,
  });
  return {};
};

const UpdateDetectorVersionStatus: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "detectorId");
  const detectorVersionId = requireString(input, "detectorVersionId");
  const status = requireString(input, "status");
  const dv = requireDetectorVersion(ctx, detectorId, detectorVersionId);
  const now = new Date().toISOString();
  ctx.store.set(detectorVersionKey(detectorId, detectorVersionId), {
    ...dv,
    status,
    lastUpdatedTime: now,
  });
  return {};
};

const DeleteDetectorVersion: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "detectorId");
  const detectorVersionId = requireString(input, "detectorVersionId");
  const dv = requireDetectorVersion(ctx, detectorId, detectorVersionId);
  if (dv.status === "ACTIVE") {
    throw awsError(
      "ConflictException",
      `Cannot delete detector version in ACTIVE status. Update status first.`,
      409,
    );
  }
  ctx.store.delete(detectorVersionKey(detectorId, detectorVersionId));
  ctx.store.delete(tagsKey(dv.arn));
  return {};
};

const CreateVariable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const dataType = requireString(input, "dataType");
  const dataSource = requireString(input, "dataSource");
  const defaultValue = requireString(input, "defaultValue");
  const now = new Date().toISOString();
  const arn = resourceArn(ctx, "variable", name);
  const variable: StoredVariable = {
    name,
    dataType,
    dataSource,
    defaultValue,
    description: stringOrUndefined(input["description"]),
    variableType: stringOrUndefined(input["variableType"]),
    createdTime: now,
    lastUpdatedTime: now,
    arn,
  };
  ctx.store.set(variableKey(name), variable);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing = getTags(ctx, arn);
    tags.forEach((t) => {
      existing[t.key] = t.value;
    });
    setTags(ctx, arn, existing);
  }
  return {};
};

const UpdateVariable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const variable = requireVariable(ctx, name);
  const now = new Date().toISOString();
  const updated: StoredVariable = {
    ...variable,
    defaultValue:
      stringOrUndefined(input["defaultValue"]) ?? variable.defaultValue,
    description:
      stringOrUndefined(input["description"]) ?? variable.description,
    variableType:
      stringOrUndefined(input["variableType"]) ?? variable.variableType,
    lastUpdatedTime: now,
  };
  ctx.store.set(variableKey(name), updated);
  return {};
};

const GetVariables: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  const all = ctx.store
    .list<StoredVariable>()
    .filter((e) => e.key.startsWith("variable/"))
    .map((e) => e.value)
    .filter((v) => name === undefined || v.name === name)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const { page: variables, nextToken } = paginate(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return { variables, ...(nextToken !== undefined ? { nextToken } : {}) };
};

const DeleteVariable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  requireVariable(ctx, name);
  ctx.store.delete(variableKey(name));
  return {};
};

const BatchCreateVariable: OperationHandler = (input, ctx) => {
  const entries = arrayOrEmpty(input["variableEntries"]) as Record<
    string,
    unknown
  >[];
  const errors: { name: string | undefined; code: number; message: string }[] =
    [];
  for (const entry of entries) {
    try {
      const name = requireString(entry, "name");
      const dataType = requireString(entry, "dataType");
      const dataSource = requireString(entry, "dataSource");
      const defaultValue = requireString(entry, "defaultValue");
      const now = new Date().toISOString();
      const arn = resourceArn(ctx, "variable", name);
      const variable: StoredVariable = {
        name,
        dataType,
        dataSource,
        defaultValue,
        description: stringOrUndefined(entry["description"]),
        variableType: stringOrUndefined(entry["variableType"]),
        createdTime: now,
        lastUpdatedTime: now,
        arn,
      };
      ctx.store.set(variableKey(name), variable);
    } catch (e) {
      const name = stringOrUndefined(entry["name"]);
      errors.push({ name, code: 400, message: String(e) });
    }
  }
  return { errors };
};

const BatchGetVariable: OperationHandler = (input, ctx) => {
  const names = stringArrayOrEmpty(input["names"]);
  const variables: StoredVariable[] = [];
  const errors: { name: string; code: number; message: string }[] = [];
  for (const name of names) {
    const v = ctx.store.get<StoredVariable>(variableKey(name));
    if (v === undefined) {
      errors.push({ name, code: 1001, message: `Variable not found: ${name}` });
    } else {
      variables.push(v);
    }
  }
  return { variables, errors };
};

const PutEntityType: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const now = new Date().toISOString();
  const arn = resourceArn(ctx, "entity-type", name);
  const existing = ctx.store.get<StoredEntityType>(entityTypeKey(name));
  const et: StoredEntityType = {
    name,
    description: stringOrUndefined(input["description"]),
    createdTime: existing?.createdTime ?? now,
    lastUpdatedTime: now,
    arn,
  };
  ctx.store.set(entityTypeKey(name), et);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing2 = getTags(ctx, arn);
    tags.forEach((t) => {
      existing2[t.key] = t.value;
    });
    setTags(ctx, arn, existing2);
  }
  return {};
};

const GetEntityTypes: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  const all = ctx.store
    .list<StoredEntityType>()
    .filter((e) => e.key.startsWith("entityType/"))
    .map((e) => e.value)
    .filter((et) => name === undefined || et.name === name)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const { page: entityTypes, nextToken } = paginate(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return { entityTypes, ...(nextToken !== undefined ? { nextToken } : {}) };
};

const DeleteEntityType: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  requireEntityType(ctx, name);
  ctx.store.delete(entityTypeKey(name));
  return {};
};

const PutEventType: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const eventVariables = stringArrayOrEmpty(input["eventVariables"]);
  const entityTypes = stringArrayOrEmpty(input["entityTypes"]);
  const now = new Date().toISOString();
  const arn = resourceArn(ctx, "event-type", name);
  const existing = ctx.store.get<StoredEventType>(eventTypeKey(name));
  const et: StoredEventType = {
    name,
    description: stringOrUndefined(input["description"]),
    eventVariables,
    labels: Array.isArray(input["labels"])
      ? stringArrayOrEmpty(input["labels"])
      : undefined,
    entityTypes,
    createdTime: existing?.createdTime ?? now,
    lastUpdatedTime: now,
    arn,
  };
  ctx.store.set(eventTypeKey(name), et);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing2 = getTags(ctx, arn);
    tags.forEach((t) => {
      existing2[t.key] = t.value;
    });
    setTags(ctx, arn, existing2);
  }
  return {};
};

const GetEventTypes: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  const all = ctx.store
    .list<StoredEventType>()
    .filter((e) => e.key.startsWith("eventType/"))
    .map((e) => e.value)
    .filter((et) => name === undefined || et.name === name)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const { page: eventTypes, nextToken } = paginate(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return { eventTypes, ...(nextToken !== undefined ? { nextToken } : {}) };
};

const DeleteEventType: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  requireEventType(ctx, name);
  ctx.store.delete(eventTypeKey(name));
  return {};
};

const PutLabel: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const now = new Date().toISOString();
  const arn = resourceArn(ctx, "label", name);
  const existing = ctx.store.get<StoredLabel>(labelKey(name));
  const lbl: StoredLabel = {
    name,
    description: stringOrUndefined(input["description"]),
    createdTime: existing?.createdTime ?? now,
    lastUpdatedTime: now,
    arn,
  };
  ctx.store.set(labelKey(name), lbl);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing2 = getTags(ctx, arn);
    tags.forEach((t) => {
      existing2[t.key] = t.value;
    });
    setTags(ctx, arn, existing2);
  }
  return {};
};

const GetLabels: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  const all = ctx.store
    .list<StoredLabel>()
    .filter((e) => e.key.startsWith("label/"))
    .map((e) => e.value)
    .filter((lbl) => name === undefined || lbl.name === name)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const { page: labels, nextToken } = paginate(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return { labels, ...(nextToken !== undefined ? { nextToken } : {}) };
};

const DeleteLabel: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  requireLabel(ctx, name);
  ctx.store.delete(labelKey(name));
  return {};
};

const PutOutcome: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const now = new Date().toISOString();
  const arn = resourceArn(ctx, "outcome", name);
  const existing = ctx.store.get<StoredOutcome>(outcomeKey(name));
  const outcome: StoredOutcome = {
    name,
    description: stringOrUndefined(input["description"]),
    createdTime: existing?.createdTime ?? now,
    lastUpdatedTime: now,
    arn,
  };
  ctx.store.set(outcomeKey(name), outcome);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing2 = getTags(ctx, arn);
    tags.forEach((t) => {
      existing2[t.key] = t.value;
    });
    setTags(ctx, arn, existing2);
  }
  return {};
};

const GetOutcomes: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  const all = ctx.store
    .list<StoredOutcome>()
    .filter((e) => e.key.startsWith("outcome/"))
    .map((e) => e.value)
    .filter((o) => name === undefined || o.name === name)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const { page: outcomes, nextToken } = paginate(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return { outcomes, ...(nextToken !== undefined ? { nextToken } : {}) };
};

const DeleteOutcome: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  requireOutcome(ctx, name);
  ctx.store.delete(outcomeKey(name));
  return {};
};

const PutExternalModel: OperationHandler = (input, ctx) => {
  const modelEndpoint = requireString(input, "modelEndpoint");
  const modelSource = requireString(input, "modelSource");
  const invokeModelEndpointRoleArn = requireString(
    input,
    "invokeModelEndpointRoleArn",
  );
  const inputConfiguration = input["inputConfiguration"] ?? {};
  const outputConfiguration = input["outputConfiguration"] ?? {};
  const modelEndpointStatus = requireString(input, "modelEndpointStatus");
  const now = new Date().toISOString();
  const arn = resourceArn(ctx, "external-model", modelEndpoint);
  const existing = ctx.store.get<StoredExternalModel>(
    externalModelKey(modelEndpoint),
  );
  const em: StoredExternalModel = {
    modelEndpoint,
    modelSource,
    invokeModelEndpointRoleArn,
    inputConfiguration,
    outputConfiguration,
    modelEndpointStatus,
    createdTime: existing?.createdTime ?? now,
    lastUpdatedTime: now,
    arn,
  };
  ctx.store.set(externalModelKey(modelEndpoint), em);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing2 = getTags(ctx, arn);
    tags.forEach((t) => {
      existing2[t.key] = t.value;
    });
    setTags(ctx, arn, existing2);
  }
  return {};
};

const GetExternalModels: OperationHandler = (input, ctx) => {
  const modelEndpoint = stringOrUndefined(input["modelEndpoint"]);
  const all = ctx.store
    .list<StoredExternalModel>()
    .filter((e) => e.key.startsWith("externalModel/"))
    .map((e) => e.value)
    .filter(
      (em) => modelEndpoint === undefined || em.modelEndpoint === modelEndpoint,
    )
    .sort((a, b) =>
      a.modelEndpoint < b.modelEndpoint
        ? -1
        : a.modelEndpoint > b.modelEndpoint
          ? 1
          : 0,
    );
  const { page: externalModels, nextToken } = paginate(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return { externalModels, ...(nextToken !== undefined ? { nextToken } : {}) };
};

const DeleteExternalModel: OperationHandler = (input, ctx) => {
  const modelEndpoint = requireString(input, "modelEndpoint");
  requireExternalModel(ctx, modelEndpoint);
  ctx.store.delete(externalModelKey(modelEndpoint));
  return {};
};

const CreateModel: OperationHandler = (input, ctx) => {
  const modelId = requireString(input, "modelId");
  const modelType = requireString(input, "modelType");
  const eventTypeName = requireString(input, "eventTypeName");
  const now = new Date().toISOString();
  const arn = resourceArn(ctx, "model", `${modelId}/${modelType}`);
  const m: StoredModel = {
    modelId,
    modelType,
    description: stringOrUndefined(input["description"]),
    eventTypeName,
    createdTime: now,
    lastUpdatedTime: now,
    arn,
  };
  ctx.store.set(modelKey(modelId, modelType), m);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing = getTags(ctx, arn);
    tags.forEach((t) => {
      existing[t.key] = t.value;
    });
    setTags(ctx, arn, existing);
  }
  return {};
};

const UpdateModel: OperationHandler = (input, ctx) => {
  const modelId = requireString(input, "modelId");
  const modelType = requireString(input, "modelType");
  const m = requireModel(ctx, modelId, modelType);
  const now = new Date().toISOString();
  ctx.store.set(modelKey(modelId, modelType), {
    ...m,
    description: stringOrUndefined(input["description"]) ?? m.description,
    lastUpdatedTime: now,
  });
  return {};
};

const GetModels: OperationHandler = (input, ctx) => {
  const modelId = stringOrUndefined(input["modelId"]);
  const modelType = stringOrUndefined(input["modelType"]);
  const all = ctx.store
    .list<StoredModel>()
    .filter((e) => e.key.startsWith("model/"))
    .map((e) => e.value)
    .filter(
      (m) =>
        (modelId === undefined || m.modelId === modelId) &&
        (modelType === undefined || m.modelType === modelType),
    )
    .sort((a, b) =>
      a.modelId < b.modelId ? -1 : a.modelId > b.modelId ? 1 : 0,
    );
  const { page: models, nextToken } = paginate(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return { models, ...(nextToken !== undefined ? { nextToken } : {}) };
};

const DeleteModel: OperationHandler = (input, ctx) => {
  const modelId = requireString(input, "modelId");
  const modelType = requireString(input, "modelType");
  requireModel(ctx, modelId, modelType);
  ctx.store.delete(modelKey(modelId, modelType));
  return {};
};

let _modelVersionCounter = 1;
const nextModelVersionNumber = (): string =>
  String((_modelVersionCounter++).toFixed(0)) + ".00";

const CreateModelVersion: OperationHandler = (input, ctx) => {
  const modelId = requireString(input, "modelId");
  const modelType = requireString(input, "modelType");
  requireModel(ctx, modelId, modelType);
  const trainingDataSource = requireString(input, "trainingDataSource");
  const trainingDataSchema = input["trainingDataSchema"] ?? {};
  const versionNumber = nextModelVersionNumber();
  const now = new Date().toISOString();
  const arn = resourceArn(
    ctx,
    "model-version",
    `${modelId}/${modelType}/${versionNumber}`,
  );
  const mv: StoredModelVersion = {
    modelId,
    modelType,
    modelVersionNumber: versionNumber,
    trainingDataSource,
    trainingDataSchema,
    externalEventsDetail: input["externalEventsDetail"] ?? undefined,
    ingestedEventsDetail: input["ingestedEventsDetail"] ?? undefined,
    status: "TRAINING_IN_PROGRESS",
    createdTime: now,
    lastUpdatedTime: now,
    arn,
  };
  ctx.store.set(modelVersionKey(modelId, modelType, versionNumber), mv);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing = getTags(ctx, arn);
    tags.forEach((t) => {
      existing[t.key] = t.value;
    });
    setTags(ctx, arn, existing);
  }
  return {
    modelId,
    modelType,
    modelVersionNumber: versionNumber,
    status: "TRAINING_IN_PROGRESS",
  };
};

const UpdateModelVersion: OperationHandler = (input, ctx) => {
  const modelId = requireString(input, "modelId");
  const modelType = requireString(input, "modelType");
  const majorVersionNumber = requireString(input, "majorVersionNumber");
  const versionNumber = majorVersionNumber + ".00";
  requireModelVersion(ctx, modelId, modelType, versionNumber);
  const now = new Date().toISOString();
  const newVersion = String(
    parseFloat(versionNumber) + _modelVersionCounter++ * 0.01,
  );
  const arn = resourceArn(
    ctx,
    "model-version",
    `${modelId}/${modelType}/${newVersion}`,
  );
  const existing = requireModelVersion(ctx, modelId, modelType, versionNumber);
  const mv: StoredModelVersion = {
    ...existing,
    modelVersionNumber: newVersion,
    externalEventsDetail:
      input["externalEventsDetail"] ?? existing.externalEventsDetail,
    ingestedEventsDetail:
      input["ingestedEventsDetail"] ?? existing.ingestedEventsDetail,
    status: "TRAINING_IN_PROGRESS",
    lastUpdatedTime: now,
    arn,
  };
  ctx.store.set(modelVersionKey(modelId, modelType, newVersion), mv);
  return {
    modelId,
    modelType,
    modelVersionNumber: newVersion,
    status: "TRAINING_IN_PROGRESS",
  };
};

const UpdateModelVersionStatus: OperationHandler = (input, ctx) => {
  const modelId = requireString(input, "modelId");
  const modelType = requireString(input, "modelType");
  const modelVersionNumber = requireString(input, "modelVersionNumber");
  const status = requireString(input, "status");
  const mv = requireModelVersion(ctx, modelId, modelType, modelVersionNumber);
  const now = new Date().toISOString();
  ctx.store.set(modelVersionKey(modelId, modelType, modelVersionNumber), {
    ...mv,
    status,
    lastUpdatedTime: now,
  });
  return {};
};

const GetModelVersion: OperationHandler = (input, ctx) => {
  const modelId = requireString(input, "modelId");
  const modelType = requireString(input, "modelType");
  const modelVersionNumber = requireString(input, "modelVersionNumber");
  const mv = requireModelVersion(ctx, modelId, modelType, modelVersionNumber);
  return {
    modelId: mv.modelId,
    modelType: mv.modelType,
    modelVersionNumber: mv.modelVersionNumber,
    trainingDataSource: mv.trainingDataSource,
    trainingDataSchema: mv.trainingDataSchema,
    externalEventsDetail: mv.externalEventsDetail,
    ingestedEventsDetail: mv.ingestedEventsDetail,
    status: mv.status,
    arn: mv.arn,
  };
};

const DeleteModelVersion: OperationHandler = (input, ctx) => {
  const modelId = requireString(input, "modelId");
  const modelType = requireString(input, "modelType");
  const modelVersionNumber = requireString(input, "modelVersionNumber");
  requireModelVersion(ctx, modelId, modelType, modelVersionNumber);
  ctx.store.delete(modelVersionKey(modelId, modelType, modelVersionNumber));
  return {};
};

const DescribeModelVersions: OperationHandler = (input, ctx) => {
  const modelId = stringOrUndefined(input["modelId"]);
  const modelType = stringOrUndefined(input["modelType"]);
  const modelVersionNumber = stringOrUndefined(input["modelVersionNumber"]);
  const all = ctx.store
    .list<StoredModelVersion>()
    .filter((e) => e.key.startsWith("modelVersion/"))
    .map((e) => e.value)
    .filter(
      (mv) =>
        (modelId === undefined || mv.modelId === modelId) &&
        (modelType === undefined || mv.modelType === modelType) &&
        (modelVersionNumber === undefined ||
          mv.modelVersionNumber === modelVersionNumber),
    );
  const { page: modelVersionDetails, nextToken } = paginate(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    modelVersionDetails,
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

let _ruleVersionCounter = 1;
const nextRuleVersion = (): string => String(_ruleVersionCounter++);

const CreateRule: OperationHandler = (input, ctx) => {
  const ruleId = requireString(input, "ruleId");
  const detectorId = requireString(input, "detectorId");
  const expression = requireString(input, "expression");
  const language = requireString(input, "language");
  const outcomes = stringArrayOrEmpty(input["outcomes"]);
  const ruleVersion = nextRuleVersion();
  const now = new Date().toISOString();
  const arn = resourceArn(
    ctx,
    "rule",
    `${detectorId}/${ruleId}/${ruleVersion}`,
  );
  const rule: StoredRule = {
    ruleId,
    detectorId,
    ruleVersion,
    description: stringOrUndefined(input["description"]),
    expression,
    language,
    outcomes,
    createdTime: now,
    lastUpdatedTime: now,
    arn,
  };
  ctx.store.set(ruleKey(detectorId, ruleId, ruleVersion), rule);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing = getTags(ctx, arn);
    tags.forEach((t) => {
      existing[t.key] = t.value;
    });
    setTags(ctx, arn, existing);
  }
  return {
    rule: { detectorId, ruleId, ruleVersion },
  };
};

const GetRules: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "detectorId");
  const ruleId = stringOrUndefined(input["ruleId"]);
  const ruleVersion = stringOrUndefined(input["ruleVersion"]);
  const all = ctx.store
    .list<StoredRule>()
    .filter((e) => e.key.startsWith(`rule/${detectorId}/`))
    .map((e) => e.value)
    .filter(
      (r) =>
        (ruleId === undefined || r.ruleId === ruleId) &&
        (ruleVersion === undefined || r.ruleVersion === ruleVersion),
    );
  const { page: ruleDetails, nextToken } = paginate(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return { ruleDetails, ...(nextToken !== undefined ? { nextToken } : {}) };
};

const UpdateRuleMetadata: OperationHandler = (input, ctx) => {
  const ruleInput = input["rule"] as Record<string, unknown> | undefined;
  if (!ruleInput) {
    throw awsError("ValidationException", "rule is required.", 400);
  }
  const detectorId = requireString(ruleInput, "detectorId");
  const ruleId = requireString(ruleInput, "ruleId");
  const ruleVersion = requireString(ruleInput, "ruleVersion");
  const description = requireString(input, "description");
  const rule = requireRule(ctx, detectorId, ruleId, ruleVersion);
  const now = new Date().toISOString();
  ctx.store.set(ruleKey(detectorId, ruleId, ruleVersion), {
    ...rule,
    description,
    lastUpdatedTime: now,
  });
  return {};
};

const UpdateRuleVersion: OperationHandler = (input, ctx) => {
  const ruleInput = input["rule"] as Record<string, unknown> | undefined;
  if (!ruleInput) {
    throw awsError("ValidationException", "rule is required.", 400);
  }
  const detectorId = requireString(ruleInput, "detectorId");
  const ruleId = requireString(ruleInput, "ruleId");
  const ruleVersion = requireString(ruleInput, "ruleVersion");
  const expression = requireString(input, "expression");
  const language = requireString(input, "language");
  const outcomes = stringArrayOrEmpty(input["outcomes"]);
  requireRule(ctx, detectorId, ruleId, ruleVersion);
  const newVersion = nextRuleVersion();
  const now = new Date().toISOString();
  const arn = resourceArn(ctx, "rule", `${detectorId}/${ruleId}/${newVersion}`);
  const updated: StoredRule = {
    ruleId,
    detectorId,
    ruleVersion: newVersion,
    description: stringOrUndefined(input["description"]),
    expression,
    language,
    outcomes,
    createdTime: now,
    lastUpdatedTime: now,
    arn,
  };
  ctx.store.set(ruleKey(detectorId, ruleId, newVersion), updated);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing = getTags(ctx, arn);
    tags.forEach((t) => {
      existing[t.key] = t.value;
    });
    setTags(ctx, arn, existing);
  }
  return {
    rule: { detectorId, ruleId, ruleVersion: newVersion },
  };
};

const DeleteRule: OperationHandler = (input, ctx) => {
  const ruleInput = input["rule"] as Record<string, unknown> | undefined;
  if (!ruleInput) {
    throw awsError("ValidationException", "rule is required.", 400);
  }
  const detectorId = requireString(ruleInput, "detectorId");
  const ruleId = requireString(ruleInput, "ruleId");
  const ruleVersion = requireString(ruleInput, "ruleVersion");
  requireRule(ctx, detectorId, ruleId, ruleVersion);
  ctx.store.delete(ruleKey(detectorId, ruleId, ruleVersion));
  return {};
};

const CreateList: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const now = new Date().toISOString();
  const arn = resourceArn(ctx, "list", name);
  const lst: StoredList = {
    name,
    elements: stringArrayOrEmpty(input["elements"]),
    variableType: stringOrUndefined(input["variableType"]),
    description: stringOrUndefined(input["description"]),
    createdTime: now,
    updatedTime: now,
    arn,
  };
  ctx.store.set(listKey(name), lst);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing = getTags(ctx, arn);
    tags.forEach((t) => {
      existing[t.key] = t.value;
    });
    setTags(ctx, arn, existing);
  }
  return {};
};

const UpdateList: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const lst = requireList(ctx, name);
  const now = new Date().toISOString();
  const updateMode = stringOrUndefined(input["updateMode"]) ?? "REPLACE";
  let elements = lst.elements;
  if (Array.isArray(input["elements"])) {
    const newElements = stringArrayOrEmpty(input["elements"]);
    if (updateMode === "APPEND") {
      elements = [...elements, ...newElements];
    } else if (updateMode === "REMOVE") {
      const toRemove = new Set(newElements);
      elements = elements.filter((e) => !toRemove.has(e));
    } else {
      elements = newElements;
    }
  }
  const updated: StoredList = {
    ...lst,
    elements,
    description: stringOrUndefined(input["description"]) ?? lst.description,
    variableType: stringOrUndefined(input["variableType"]) ?? lst.variableType,
    updatedTime: now,
  };
  ctx.store.set(listKey(name), updated);
  return {};
};

const GetListsMetadata: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  const allLists = ctx.store
    .list<StoredList>()
    .filter((e) => e.key.startsWith("list/"))
    .map((e) => e.value)
    .filter((lst) => name === undefined || lst.name === name)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((lst) => ({
      name: lst.name,
      description: lst.description,
      variableType: lst.variableType,
      createdTime: lst.createdTime,
      updatedTime: lst.updatedTime,
      arn: lst.arn,
    }));
  const { page: lists, nextToken } = paginate(
    allLists,
    input["nextToken"],
    input["maxResults"],
  );
  return { lists, ...(nextToken !== undefined ? { nextToken } : {}) };
};

const GetListElements: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const lst = requireList(ctx, name);
  const { page: elements, nextToken } = paginate(
    lst.elements,
    input["nextToken"],
    input["maxResults"],
  );
  return { elements, ...(nextToken !== undefined ? { nextToken } : {}) };
};

const DeleteList: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  requireList(ctx, name);
  ctx.store.delete(listKey(name));
  return {};
};

const CreateBatchImportJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  const inputPath = requireString(input, "inputPath");
  const outputPath = requireString(input, "outputPath");
  const eventTypeName = requireString(input, "eventTypeName");
  const iamRoleArn = requireString(input, "iamRoleArn");
  const now = new Date().toISOString();
  const arn = resourceArn(ctx, "batch-import", jobId);
  const job: StoredBatchImportJob = {
    jobId,
    status: "IN_PROGRESS",
    inputPath,
    outputPath,
    eventTypeName,
    iamRoleArn,
    startTime: now,
    completionTime: undefined,
    arn,
  };
  ctx.store.set(batchImportKey(jobId), job);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing = getTags(ctx, arn);
    tags.forEach((t) => {
      existing[t.key] = t.value;
    });
    setTags(ctx, arn, existing);
  }
  return {};
};

const CancelBatchImportJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  const job = requireBatchImport(ctx, jobId);
  const now = new Date().toISOString();
  ctx.store.set(batchImportKey(jobId), {
    ...job,
    status: "CANCEL_IN_PROGRESS",
    completionTime: now,
  });
  return {};
};

const GetBatchImportJobs: OperationHandler = (input, ctx) => {
  const jobId = stringOrUndefined(input["jobId"]);
  const all = ctx.store
    .list<StoredBatchImportJob>()
    .filter((e) => e.key.startsWith("batchImport/"))
    .map((e) => e.value)
    .filter((j) => jobId === undefined || j.jobId === jobId);
  const { page: batchImports, nextToken } = paginate(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return { batchImports, ...(nextToken !== undefined ? { nextToken } : {}) };
};

const DeleteBatchImportJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  requireBatchImport(ctx, jobId);
  ctx.store.delete(batchImportKey(jobId));
  return {};
};

const CreateBatchPredictionJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  const inputPath = requireString(input, "inputPath");
  const outputPath = requireString(input, "outputPath");
  const eventTypeName = requireString(input, "eventTypeName");
  const detectorName = requireString(input, "detectorName");
  const iamRoleArn = requireString(input, "iamRoleArn");
  const now = new Date().toISOString();
  const arn = resourceArn(ctx, "batch-prediction", jobId);
  const job: StoredBatchPredictionJob = {
    jobId,
    status: "IN_PROGRESS",
    inputPath,
    outputPath,
    eventTypeName,
    detectorName,
    detectorVersion: stringOrUndefined(input["detectorVersion"]),
    iamRoleArn,
    startTime: now,
    completionTime: undefined,
    arn,
  };
  ctx.store.set(batchPredictionKey(jobId), job);
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  if (tags.length > 0) {
    const existing = getTags(ctx, arn);
    tags.forEach((t) => {
      existing[t.key] = t.value;
    });
    setTags(ctx, arn, existing);
  }
  return {};
};

const CancelBatchPredictionJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  const job = requireBatchPrediction(ctx, jobId);
  const now = new Date().toISOString();
  ctx.store.set(batchPredictionKey(jobId), {
    ...job,
    status: "CANCEL_IN_PROGRESS",
    completionTime: now,
  });
  return {};
};

const GetBatchPredictionJobs: OperationHandler = (input, ctx) => {
  const jobId = stringOrUndefined(input["jobId"]);
  const all = ctx.store
    .list<StoredBatchPredictionJob>()
    .filter((e) => e.key.startsWith("batchPrediction/"))
    .map((e) => e.value)
    .filter((j) => jobId === undefined || j.jobId === jobId);
  const { page: batchPredictions, nextToken } = paginate(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    batchPredictions,
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteBatchPredictionJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  requireBatchPrediction(ctx, jobId);
  ctx.store.delete(batchPredictionKey(jobId));
  return {};
};

const SendEvent: OperationHandler = (input, ctx) => {
  const eventId = requireString(input, "eventId");
  const eventTypeName = requireString(input, "eventTypeName");
  const eventTimestamp = requireString(input, "eventTimestamp");
  const entities = arrayOrEmpty(input["entities"]);
  const eventVariables = (input["eventVariables"] ?? {}) as Record<
    string,
    string
  >;
  const event: StoredEvent = {
    eventId,
    eventTypeName,
    eventTimestamp,
    eventVariables,
    currentLabel: stringOrUndefined(input["assignedLabel"]),
    labelTimestamp: stringOrUndefined(input["labelTimestamp"]),
    entities,
  };
  ctx.store.set(eventKey(eventId, eventTypeName), event);
  return {};
};

const GetEvent: OperationHandler = (input, ctx) => {
  const eventId = requireString(input, "eventId");
  const eventTypeName = requireString(input, "eventTypeName");
  const stored = ctx.store.get<StoredEvent>(eventKey(eventId, eventTypeName));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Event not found: ${eventId}`,
      400,
    );
  }
  return {
    event: {
      eventId: stored.eventId,
      eventTypeName: stored.eventTypeName,
      eventTimestamp: stored.eventTimestamp,
      eventVariables: stored.eventVariables,
      currentLabel: stored.currentLabel,
      labelTimestamp: stored.labelTimestamp,
      entities: stored.entities,
    },
  };
};

const DeleteEvent: OperationHandler = (input, ctx) => {
  const eventId = requireString(input, "eventId");
  const eventTypeName = requireString(input, "eventTypeName");
  if (
    ctx.store.get<StoredEvent>(eventKey(eventId, eventTypeName)) === undefined
  ) {
    throw awsError(
      "ResourceNotFoundException",
      `Event not found: ${eventId}`,
      400,
    );
  }
  ctx.store.delete(eventKey(eventId, eventTypeName));
  return {};
};

const DeleteEventsByEventType: OperationHandler = (input, ctx) => {
  const eventTypeName = requireString(input, "eventTypeName");
  const keys = ctx.store
    .list<StoredEvent>()
    .filter(
      (e) =>
        e.key.startsWith(`event/`) && e.value.eventTypeName === eventTypeName,
    )
    .map((e) => e.key);
  keys.forEach((k) => ctx.store.delete(k));
  return {
    eventTypeName,
    eventsDeletionStatus: "IN_PROGRESS",
  };
};

const GetDeleteEventsByEventTypeStatus: OperationHandler = (input, _ctx) => {
  const eventTypeName = requireString(input, "eventTypeName");
  return {
    eventTypeName,
    eventsDeletionStatus: "COMPLETE",
  };
};

const UpdateEventLabel: OperationHandler = (input, ctx) => {
  const eventId = requireString(input, "eventId");
  const eventTypeName = requireString(input, "eventTypeName");
  const assignedLabel = requireString(input, "assignedLabel");
  const labelTimestamp = requireString(input, "labelTimestamp");
  const stored = ctx.store.get<StoredEvent>(eventKey(eventId, eventTypeName));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Event not found: ${eventId}`,
      400,
    );
  }
  ctx.store.set(eventKey(eventId, eventTypeName), {
    ...stored,
    currentLabel: assignedLabel,
    labelTimestamp,
  });
  return {};
};

const GetEventPrediction: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "detectorId");
  const detectorVersionId = stringOrUndefined(input["detectorVersionId"]);
  const eventId = requireString(input, "eventId");
  const eventTypeName = requireString(input, "eventTypeName");
  const entities = arrayOrEmpty(input["entities"]) as {
    entityId?: string;
    entityType?: string;
  }[];

  let dv: StoredDetectorVersion | undefined;
  if (detectorVersionId !== undefined) {
    dv = ctx.store.get<StoredDetectorVersion>(
      detectorVersionKey(detectorId, detectorVersionId),
    );
    if (dv === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `Detector version not found: ${detectorId}/${detectorVersionId}`,
        400,
      );
    }
  } else {
    dv = ctx.store
      .list<StoredDetectorVersion>()
      .filter((e) => e.key.startsWith(`detectorVersion/${detectorId}/`))
      .map((e) => e.value)
      .find((v) => v.status === "ACTIVE");
    if (dv === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `No ACTIVE detector version for: ${detectorId}`,
        400,
      );
    }
  }

  const ruleRefs = arrayOrEmpty(dv.rules) as {
    ruleId?: string;
    ruleVersion?: string;
  }[];
  const ruleResults: { ruleId: string; outcomes: string[] }[] = [];
  for (const ref of ruleRefs) {
    const rId = typeof ref.ruleId === "string" ? ref.ruleId : undefined;
    const rVer =
      typeof ref.ruleVersion === "string" ? ref.ruleVersion : undefined;
    if (rId === undefined) continue;
    const rule =
      rVer !== undefined
        ? ctx.store.get<StoredRule>(ruleKey(detectorId, rId, rVer))
        : ctx.store
            .list<StoredRule>()
            .filter((e) => e.key.startsWith(`rule/${detectorId}/${rId}/`))
            .map((e) => e.value)[0];
    if (rule !== undefined) {
      ruleResults.push({ ruleId: rule.ruleId, outcomes: rule.outcomes });
    }
  }

  const now = new Date().toISOString();
  const firstEntity = entities[0];
  const entityId = firstEntity?.entityId ?? "UNKNOWN";
  const entityType = firstEntity?.entityType ?? "unknown";

  const prediction: StoredPrediction = {
    eventId,
    eventTypeName,
    detectorId,
    detectorVersionId: dv.detectorVersionId,
    predictionTimestamp: now,
    entityId,
    entityType,
    ruleResults,
    modelVersions: arrayOrEmpty(dv.modelVersions),
  };
  ctx.store.set(
    predictionKey(
      eventId,
      eventTypeName,
      detectorId,
      dv.detectorVersionId,
      now,
    ),
    prediction,
  );

  return {
    modelScores: [],
    ruleResults,
    externalModelOutputs: [],
  };
};

const GetEventPredictionMetadata: OperationHandler = (input, ctx) => {
  const eventId = requireString(input, "eventId");
  const eventTypeName = requireString(input, "eventTypeName");
  const detectorId = requireString(input, "detectorId");
  const detectorVersionId = requireString(input, "detectorVersionId");
  const predictionTimestamp = requireString(input, "predictionTimestamp");

  const dv = requireDetectorVersion(ctx, detectorId, detectorVersionId);

  const stored = ctx.store.get<StoredEvent>(eventKey(eventId, eventTypeName));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Event not found: ${eventId}`,
      400,
    );
  }

  const firstEntity = (
    stored.entities as { entityId?: string; entityType?: string }[]
  )[0];
  const entityId = firstEntity?.entityId ?? "UNKNOWN";
  const entityType = firstEntity?.entityType ?? "unknown";

  const ruleRefs = arrayOrEmpty(dv.rules) as {
    ruleId?: string;
    ruleVersion?: string;
  }[];
  const evaluatedRules: {
    ruleId: string;
    ruleVersion: string;
    expression: string;
    matched: boolean;
    outcomes: string[];
  }[] = [];
  for (const ref of ruleRefs) {
    const rId = typeof ref.ruleId === "string" ? ref.ruleId : undefined;
    const rVer =
      typeof ref.ruleVersion === "string" ? ref.ruleVersion : undefined;
    if (rId === undefined) continue;
    const rule =
      rVer !== undefined
        ? ctx.store.get<StoredRule>(ruleKey(detectorId, rId, rVer))
        : ctx.store
            .list<StoredRule>()
            .filter((e) => e.key.startsWith(`rule/${detectorId}/${rId}/`))
            .map((e) => e.value)[0];
    if (rule !== undefined) {
      evaluatedRules.push({
        ruleId: rule.ruleId,
        ruleVersion: rule.ruleVersion,
        expression: rule.expression,
        matched: true,
        outcomes: rule.outcomes,
      });
    }
  }

  const outcomes = evaluatedRules.flatMap((r) => r.outcomes);

  return {
    eventId,
    eventTypeName,
    entityId,
    entityType,
    eventTimestamp: stored.eventTimestamp,
    detectorId,
    detectorVersionId,
    detectorVersionStatus: dv.status,
    eventVariables: Object.entries(stored.eventVariables).map(
      ([name, value]) => ({
        name,
        value,
        source: "EVENT",
      }),
    ),
    rules: evaluatedRules,
    ruleExecutionMode: dv.ruleExecutionMode ?? "FIRST_MATCHED",
    outcomes,
    evaluatedModelVersions: (
      arrayOrEmpty(dv.modelVersions) as {
        modelId?: string;
        modelType?: string;
        modelVersionNumber?: string;
      }[]
    ).map((mv) => ({
      modelId: mv.modelId ?? "",
      modelType: mv.modelType ?? "",
      modelVersionNumber: mv.modelVersionNumber ?? "",
      status: "ACTIVE",
    })),
    evaluatedExternalModels: [],
    predictionTimestamp,
  };
};

const ListEventPredictions: OperationHandler = (input, ctx) => {
  const eventIdFilter = (input["eventId"] as { value?: string } | undefined)
    ?.value;
  const eventTypeFilter = (input["eventType"] as { value?: string } | undefined)
    ?.value;
  const detectorIdFilter = (
    input["detectorId"] as { value?: string } | undefined
  )?.value;
  const detectorVersionIdFilter = (
    input["detectorVersionId"] as { value?: string } | undefined
  )?.value;
  const timeRange = input["predictionTimeRange"] as
    | { startTime?: string; endTime?: string }
    | undefined;

  const all = ctx.store
    .list<StoredPrediction>()
    .filter((e) => e.key.startsWith("prediction/"))
    .map((e) => e.value)
    .filter(
      (p) =>
        (eventIdFilter === undefined || p.eventId === eventIdFilter) &&
        (eventTypeFilter === undefined ||
          p.eventTypeName === eventTypeFilter) &&
        (detectorIdFilter === undefined || p.detectorId === detectorIdFilter) &&
        (detectorVersionIdFilter === undefined ||
          p.detectorVersionId === detectorVersionIdFilter) &&
        (timeRange?.startTime === undefined ||
          p.predictionTimestamp >= timeRange.startTime) &&
        (timeRange?.endTime === undefined ||
          p.predictionTimestamp <= timeRange.endTime),
    )
    .map((p) => ({
      eventId: p.eventId,
      eventTypeName: p.eventTypeName,
      detectorId: p.detectorId,
      detectorVersionId: p.detectorVersionId,
      predictionTimestamp: p.predictionTimestamp,
    }));

  const { page: eventPredictionSummaries, nextToken } = paginate(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    eventPredictionSummaries,
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const PutKMSEncryptionKey: OperationHandler = (input, ctx) => {
  const kmsEncryptionKeyArn = requireString(input, "kmsEncryptionKeyArn");
  ctx.store.set(kmsKeyStoreKey, { kmsEncryptionKeyArn });
  return {};
};

const GetKMSEncryptionKey: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<{ kmsEncryptionKeyArn: string }>(kmsKeyStoreKey);
  return {
    kmsKey: stored
      ? { kmsEncryptionKeyArn: stored.kmsEncryptionKeyArn }
      : { kmsEncryptionKeyArn: "DEFAULT" },
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceARN = requireString(input, "resourceARN");
  const tags = arrayOrEmpty(input["tags"]) as { key: string; value: string }[];
  const existing = getTags(ctx, resourceARN);
  tags.forEach((t) => {
    existing[t.key] = t.value;
  });
  setTags(ctx, resourceARN, existing);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceARN = requireString(input, "resourceARN");
  const tagKeys = stringArrayOrEmpty(input["tagKeys"]);
  const existing = getTags(ctx, resourceARN);
  tagKeys.forEach((k) => {
    delete existing[k];
  });
  setTags(ctx, resourceARN, existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceARN = requireString(input, "resourceARN");
  const allTags = tagsToList(getTags(ctx, resourceARN));
  const { page: tags, nextToken } = paginate(
    allTags,
    input["nextToken"],
    input["maxResults"],
  );
  return { tags, ...(nextToken !== undefined ? { nextToken } : {}) };
};

const frauddetector = {
  name: "frauddetector",
  protocol: "json",
  operations: {
    BatchCreateVariable,
    BatchGetVariable,
    CancelBatchImportJob,
    CancelBatchPredictionJob,
    CreateBatchImportJob,
    CreateBatchPredictionJob,
    CreateDetectorVersion,
    CreateList,
    CreateModel,
    CreateModelVersion,
    CreateRule,
    CreateVariable,
    DeleteBatchImportJob,
    DeleteBatchPredictionJob,
    DeleteDetector,
    DeleteDetectorVersion,
    DeleteEntityType,
    DeleteEvent,
    DeleteEventType,
    DeleteEventsByEventType,
    DeleteExternalModel,
    DeleteLabel,
    DeleteList,
    DeleteModel,
    DeleteModelVersion,
    DeleteOutcome,
    DeleteRule,
    DeleteVariable,
    DescribeDetector,
    DescribeModelVersions,
    GetBatchImportJobs,
    GetBatchPredictionJobs,
    GetDeleteEventsByEventTypeStatus,
    GetDetectorVersion,
    GetDetectors,
    GetEntityTypes,
    GetEvent,
    GetEventPrediction,
    GetEventPredictionMetadata,
    GetEventTypes,
    GetExternalModels,
    GetKMSEncryptionKey,
    GetLabels,
    GetListElements,
    GetListsMetadata,
    GetModelVersion,
    GetModels,
    GetOutcomes,
    GetRules,
    GetVariables,
    ListEventPredictions,
    ListTagsForResource,
    PutDetector,
    PutEntityType,
    PutEventType,
    PutExternalModel,
    PutKMSEncryptionKey,
    PutLabel,
    PutOutcome,
    SendEvent,
    TagResource,
    UntagResource,
    UpdateDetectorVersion,
    UpdateDetectorVersionMetadata,
    UpdateDetectorVersionStatus,
    UpdateEventLabel,
    UpdateList,
    UpdateModel,
    UpdateModelVersion,
    UpdateModelVersionStatus,
    UpdateRuleMetadata,
    UpdateRuleVersion,
    UpdateVariable,
  },
  model,
} as const satisfies ServiceDefinition;

export default frauddetector;
