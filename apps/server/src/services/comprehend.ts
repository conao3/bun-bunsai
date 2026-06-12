import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import comprehendModel from "../../models/comprehend.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(comprehendModel);

type StoredEndpoint = {
  EndpointArn: string;
  EndpointName: string;
  ModelArn: string | undefined;
  Status: string;
  DesiredInferenceUnits: number;
  CurrentInferenceUnits: number;
  DataAccessRoleArn: string | undefined;
  CreationTime: number;
  LastModifiedTime: number;
  describeCount: number;
};

type StoredDocumentClassifier = {
  DocumentClassifierArn: string;
  DocumentClassifierName: string;
  VersionName: string | undefined;
  LanguageCode: string;
  Status: string;
  DataAccessRoleArn: string | undefined;
  SubmitTime: number;
  TrainingEndTime: number | undefined;
  InputDataConfig: Record<string, unknown>;
  Mode: string;
  FlywheelArn: string | undefined;
  ClientRequestToken: string | undefined;
  describeCount: number;
};

type StoredEntityRecognizer = {
  EntityRecognizerArn: string;
  RecognizerName: string;
  VersionName: string | undefined;
  LanguageCode: string;
  Status: string;
  DataAccessRoleArn: string | undefined;
  SubmitTime: number;
  TrainingEndTime: number | undefined;
  InputDataConfig: Record<string, unknown>;
  FlywheelArn: string | undefined;
  ClientRequestToken: string | undefined;
  describeCount: number;
};

type StoredFlywheel = {
  FlywheelArn: string;
  FlywheelName: string;
  ActiveModelArn: string | undefined;
  DataAccessRoleArn: string | undefined;
  TaskConfig: Record<string, unknown> | undefined;
  DataLakeS3Uri: string | undefined;
  DataSecurityConfig: Record<string, unknown> | undefined;
  Status: string;
  ModelType: string | undefined;
  CreationTime: number;
  LastModifiedTime: number;
  LatestFlywheelIteration: string | undefined;
  describeCount: number;
};

type StoredFlywheelIteration = {
  FlywheelArn: string;
  FlywheelIterationId: string;
  CreationTime: number;
  EndTime: number | undefined;
  Status: string;
  describeCount: number;
};

type StoredDataset = {
  DatasetArn: string;
  DatasetName: string;
  DatasetType: string | undefined;
  Description: string | undefined;
  Status: string;
  CreationTime: number;
  EndTime: number | undefined;
  FlywheelArn: string;
  describeCount: number;
};

type StoredResourcePolicy = {
  ResourcePolicy: string;
  PolicyRevisionId: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredDetectionJob = {
  JobId: string;
  JobArn: string;
  JobName: string | undefined;
  JobStatus: string;
  SubmitTime: number;
  EndTime: number | undefined;
  InputDataConfig: Record<string, unknown>;
  OutputDataConfig: Record<string, unknown>;
  DataAccessRoleArn: string | undefined;
  LanguageCode: string | undefined;
  EntityRecognizerArn: string | undefined;
  DocumentClassifierArn: string | undefined;
  FlywheelArn: string | undefined;
  NumberOfTopics: number | undefined;
  Mode: string | undefined;
  TargetEventTypes: string[] | undefined;
  RedactionConfig: Record<string, unknown> | undefined;
  describeCount: number;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidRequestException", `${field} is required.`, 400);
  }
  return value;
};

const requireNumber = (
  input: Record<string, unknown>,
  field: string,
): number => {
  const value = input[field];
  if (typeof value !== "number") {
    throw awsError("InvalidRequestException", `${field} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const endpointArn = (region: string, account: string, name: string): string =>
  `arn:aws:comprehend:${region}:${account}:document-classifier-endpoint/${name}`;

const classifierArn = (
  region: string,
  account: string,
  name: string,
  version: string | undefined,
): string =>
  version
    ? `arn:aws:comprehend:${region}:${account}:document-classifier/${name}/${version}`
    : `arn:aws:comprehend:${region}:${account}:document-classifier/${name}`;

const recognizerArn = (
  region: string,
  account: string,
  name: string,
  version: string | undefined,
): string =>
  version
    ? `arn:aws:comprehend:${region}:${account}:entity-recognizer/${name}/${version}`
    : `arn:aws:comprehend:${region}:${account}:entity-recognizer/${name}`;

const flywheelArn = (region: string, account: string, name: string): string =>
  `arn:aws:comprehend:${region}:${account}:flywheel/${name}`;

const datasetArn = (
  region: string,
  account: string,
  flywheelName: string,
  datasetName: string,
): string =>
  `arn:aws:comprehend:${region}:${account}:flywheel/${flywheelName}/dataset/${datasetName}`;

const jobArn = (
  region: string,
  account: string,
  jobType: string,
  jobId: string,
): string => `arn:aws:comprehend:${region}:${account}:${jobType}/${jobId}`;

const parseTags = (raw: unknown): { Key: string; Value: string }[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (t): t is { Key: string; Value: string } =>
        typeof t === "object" &&
        t !== null &&
        typeof (t as Record<string, unknown>).Key === "string",
    )
    .map((t) => ({
      Key: t.Key,
      Value: typeof t.Value === "string" ? t.Value : "",
    }));
};

const tagsKey = (arn: string): string => `tags/${arn}`;
const policyKey = (arn: string): string => `policy/${arn}`;
const idempotencyKey = (prefix: string, token: string): string =>
  `idempotency/${prefix}/${token}`;

const requireEndpoint = (ctx: ServiceContext, arn: string): StoredEndpoint => {
  const direct = ctx.store.get<StoredEndpoint>(endpointKey(arn));
  if (direct !== undefined) return direct;
  throw awsError(
    "ResourceNotFoundException",
    `Endpoint '${arn}' was not found.`,
    400,
  );
};

const requireClassifier = (
  ctx: ServiceContext,
  arn: string,
): StoredDocumentClassifier => {
  const rec = ctx.store.get<StoredDocumentClassifier>(`classifier/${arn}`);
  if (rec !== undefined) return rec;
  throw awsError(
    "ResourceNotFoundException",
    `Document classifier '${arn}' was not found.`,
    400,
  );
};

const requireEntityRecognizer = (
  ctx: ServiceContext,
  arn: string,
): StoredEntityRecognizer => {
  const rec = ctx.store.get<StoredEntityRecognizer>(`recognizer/${arn}`);
  if (rec !== undefined) return rec;
  throw awsError(
    "ResourceNotFoundException",
    `Entity recognizer '${arn}' was not found.`,
    400,
  );
};

const requireFlywheel = (ctx: ServiceContext, arn: string): StoredFlywheel => {
  const rec = ctx.store.get<StoredFlywheel>(`flywheel/${arn}`);
  if (rec !== undefined) return rec;
  throw awsError(
    "ResourceNotFoundException",
    `Flywheel '${arn}' was not found.`,
    400,
  );
};

const requireJob = (
  ctx: ServiceContext,
  jobId: string,
  prefix: string,
): StoredDetectionJob => {
  const rec = ctx.store.get<StoredDetectionJob>(`${prefix}/${jobId}`);
  if (rec !== undefined) return rec;
  throw awsError("JobNotFoundException", `Job '${jobId}' was not found.`, 400);
};

const endpointProperties = (
  endpoint: StoredEndpoint,
): Record<string, unknown> => ({
  EndpointArn: endpoint.EndpointArn,
  Status: endpoint.Status,
  ModelArn: endpoint.ModelArn,
  DesiredInferenceUnits: endpoint.DesiredInferenceUnits,
  CurrentInferenceUnits: endpoint.CurrentInferenceUnits,
  DataAccessRoleArn: endpoint.DataAccessRoleArn,
  CreationTime: endpoint.CreationTime,
  LastModifiedTime: endpoint.LastModifiedTime,
});

const classifierProperties = (
  c: StoredDocumentClassifier,
): Record<string, unknown> => ({
  DocumentClassifierArn: c.DocumentClassifierArn,
  LanguageCode: c.LanguageCode,
  Status: c.Status,
  SubmitTime: c.SubmitTime,
  TrainingEndTime: c.TrainingEndTime,
  DataAccessRoleArn: c.DataAccessRoleArn,
  InputDataConfig: c.InputDataConfig,
  Mode: c.Mode,
  VersionName: c.VersionName,
  FlywheelArn: c.FlywheelArn,
});

const recognizerProperties = (
  r: StoredEntityRecognizer,
): Record<string, unknown> => ({
  EntityRecognizerArn: r.EntityRecognizerArn,
  LanguageCode: r.LanguageCode,
  Status: r.Status,
  SubmitTime: r.SubmitTime,
  TrainingEndTime: r.TrainingEndTime,
  DataAccessRoleArn: r.DataAccessRoleArn,
  InputDataConfig: r.InputDataConfig,
  VersionName: r.VersionName,
  FlywheelArn: r.FlywheelArn,
});

const flywheelProperties = (f: StoredFlywheel): Record<string, unknown> => ({
  FlywheelArn: f.FlywheelArn,
  ActiveModelArn: f.ActiveModelArn,
  DataAccessRoleArn: f.DataAccessRoleArn,
  TaskConfig: f.TaskConfig,
  DataLakeS3Uri: f.DataLakeS3Uri,
  DataSecurityConfig: f.DataSecurityConfig,
  Status: f.Status,
  ModelType: f.ModelType,
  CreationTime: f.CreationTime,
  LastModifiedTime: f.LastModifiedTime,
  LatestFlywheelIteration: f.LatestFlywheelIteration,
});

const detectionJobProperties = (
  j: StoredDetectionJob,
  prefix: string,
): Record<string, unknown> => ({
  JobId: j.JobId,
  JobArn: j.JobArn,
  JobName: j.JobName,
  JobStatus: j.JobStatus,
  SubmitTime: j.SubmitTime,
  EndTime: j.EndTime,
  InputDataConfig: j.InputDataConfig,
  OutputDataConfig: j.OutputDataConfig,
  DataAccessRoleArn: j.DataAccessRoleArn,
  LanguageCode: prefix !== "dominant-language-job" ? j.LanguageCode : undefined,
  EntityRecognizerArn:
    prefix === "entities-job" ? j.EntityRecognizerArn : undefined,
  DocumentClassifierArn:
    prefix === "document-classification-job"
      ? j.DocumentClassifierArn
      : undefined,
  FlywheelArn:
    prefix === "entities-job" || prefix === "document-classification-job"
      ? j.FlywheelArn
      : undefined,
  NumberOfTopics: prefix === "topics-job" ? j.NumberOfTopics : undefined,
  Mode: prefix === "pii-entities-job" ? j.Mode : undefined,
  RedactionConfig:
    prefix === "pii-entities-job" ? j.RedactionConfig : undefined,
  TargetEventTypes: prefix === "events-job" ? j.TargetEventTypes : undefined,
});

const makeJobId = (): string =>
  Math.random().toString(36).slice(2, 10) +
  Math.random().toString(36).slice(2, 10);

const endpointKey = (arn: string): string => `endpoint/${arn}`;

const encodeCursor = (offset: number): string => btoa(String(offset));

const decodeCursor = (token: string): number => {
  const n = parseInt(atob(token), 10);
  return Number.isNaN(n) ? 0 : n;
};

const paginate = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
): { items: T[]; NextToken: string | undefined } => {
  const offset = typeof nextToken === "string" ? decodeCursor(nextToken) : 0;
  const max =
    typeof maxResults === "number" && maxResults > 0
      ? maxResults
      : items.length;
  const page = items.slice(offset, offset + max);
  const token =
    offset + max < items.length ? encodeCursor(offset + max) : undefined;
  return { items: page, NextToken: token };
};

const matchJobFilter = (job: StoredDetectionJob, filter: unknown): boolean => {
  if (typeof filter !== "object" || filter === null) return true;
  const f = filter as Record<string, unknown>;
  const jobName = stringOrUndefined(f.JobName);
  const jobStatus = stringOrUndefined(f.JobStatus);
  const submitBefore = numberOrUndefined(f.SubmitTimeBefore);
  const submitAfter = numberOrUndefined(f.SubmitTimeAfter);
  if (jobName !== undefined && job.JobName !== jobName) return false;
  if (jobStatus !== undefined && job.JobStatus !== jobStatus) return false;
  if (submitBefore !== undefined && job.SubmitTime > submitBefore * 1000)
    return false;
  if (submitAfter !== undefined && job.SubmitTime < submitAfter * 1000)
    return false;
  return true;
};

const advanceJobStatus = (job: StoredDetectionJob): StoredDetectionJob => {
  if (job.JobStatus === "SUBMITTED") {
    if (job.describeCount >= 1) {
      return {
        ...job,
        JobStatus: "IN_PROGRESS",
        describeCount: job.describeCount + 1,
      };
    }
    return { ...job, describeCount: job.describeCount + 1 };
  }
  if (job.JobStatus === "IN_PROGRESS") {
    if (job.describeCount >= 2) {
      return {
        ...job,
        JobStatus: "COMPLETED",
        EndTime: Date.now(),
        describeCount: job.describeCount + 1,
      };
    }
    return { ...job, describeCount: job.describeCount + 1 };
  }
  return job;
};

const CreateEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointName");
  const desired = requireNumber(input, "DesiredInferenceUnits");
  const modelArn = stringOrUndefined(input.ModelArn);
  const token = stringOrUndefined(input.ClientRequestToken);
  const arn = endpointArn(ctx.region, ctx.account, name);

  if (token !== undefined) {
    const existing = ctx.store.get<string>(idempotencyKey("endpoint", token));
    if (existing !== undefined) {
      const ep = ctx.store.get<StoredEndpoint>(endpointKey(existing));
      return { EndpointArn: existing, ModelArn: ep?.ModelArn };
    }
  }

  const now = Date.now();
  const endpoint: StoredEndpoint = {
    EndpointArn: arn,
    EndpointName: name,
    ModelArn: modelArn,
    Status: "CREATING",
    DesiredInferenceUnits: desired,
    CurrentInferenceUnits: desired,
    DataAccessRoleArn: stringOrUndefined(input.DataAccessRoleArn),
    CreationTime: now,
    LastModifiedTime: now,
    describeCount: 0,
  };
  ctx.store.set(endpointKey(arn), endpoint);
  if (token !== undefined) {
    ctx.store.set(idempotencyKey("endpoint", token), arn);
  }
  return { EndpointArn: arn, ModelArn: modelArn };
};

const DescribeEndpoint: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointArn");
  let endpoint = requireEndpoint(ctx, arn);
  if (endpoint.Status === "CREATING" || endpoint.Status === "UPDATING") {
    if (endpoint.describeCount >= 1) {
      const next: StoredEndpoint = {
        ...endpoint,
        Status: "IN_SERVICE",
        CurrentInferenceUnits: endpoint.DesiredInferenceUnits,
        LastModifiedTime: Date.now(),
        describeCount: endpoint.describeCount + 1,
      };
      ctx.store.set(endpointKey(arn), next);
      endpoint = next;
    } else {
      const next: StoredEndpoint = {
        ...endpoint,
        describeCount: endpoint.describeCount + 1,
      };
      ctx.store.set(endpointKey(arn), next);
      endpoint = next;
    }
  }
  return { EndpointProperties: endpointProperties(endpoint) };
};

const ListEndpoints: OperationHandler = (input, ctx) => {
  const filter = input.Filter;
  const all = ctx.store
    .list<StoredEndpoint>()
    .filter((e) => e.key.startsWith("endpoint/"))
    .map((entry) => entry.value)
    .filter((ep) => {
      if (typeof filter !== "object" || filter === null) return true;
      const f = filter as Record<string, unknown>;
      const status = stringOrUndefined(f.Status);
      const modelArn = stringOrUndefined(f.ModelArn);
      const before = numberOrUndefined(f.CreationTimeBefore);
      const after = numberOrUndefined(f.CreationTimeAfter);
      if (status !== undefined && ep.Status !== status) return false;
      if (modelArn !== undefined && ep.ModelArn !== modelArn) return false;
      if (before !== undefined && ep.CreationTime > before * 1000) return false;
      if (after !== undefined && ep.CreationTime < after * 1000) return false;
      return true;
    });
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return { EndpointPropertiesList: items.map(endpointProperties), NextToken };
};

const DeleteEndpoint: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointArn");
  requireEndpoint(ctx, arn);
  ctx.store.delete(endpointKey(arn));
  return {};
};

const UpdateEndpoint: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointArn");
  const endpoint = requireEndpoint(ctx, arn);
  const desired = numberOrUndefined(input.DesiredInferenceUnits);
  const now = Date.now();
  const updated: StoredEndpoint = {
    ...endpoint,
    ModelArn: stringOrUndefined(input.DesiredModelArn) ?? endpoint.ModelArn,
    DesiredInferenceUnits: desired ?? endpoint.DesiredInferenceUnits,
    DataAccessRoleArn:
      stringOrUndefined(input.DataAccessRoleArn) ?? endpoint.DataAccessRoleArn,
    Status: "UPDATING",
    LastModifiedTime: now,
    describeCount: 0,
  };
  ctx.store.set(endpointKey(arn), updated);
  return { DesiredModelArn: updated.ModelArn };
};

const CreateDocumentClassifier: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DocumentClassifierName");
  const languageCode = requireString(input, "LanguageCode");
  const version = stringOrUndefined(input.VersionName);
  const token = stringOrUndefined(input.ClientRequestToken);
  const arn = classifierArn(ctx.region, ctx.account, name, version);

  if (token !== undefined) {
    const existing = ctx.store.get<string>(idempotencyKey("classifier", token));
    if (existing !== undefined) return { DocumentClassifierArn: existing };
  }

  const now = Date.now();
  const rec: StoredDocumentClassifier = {
    DocumentClassifierArn: arn,
    DocumentClassifierName: name,
    VersionName: version,
    LanguageCode: languageCode,
    Status: "TRAINING",
    DataAccessRoleArn: stringOrUndefined(input.DataAccessRoleArn),
    SubmitTime: now,
    TrainingEndTime: undefined,
    InputDataConfig:
      typeof input.InputDataConfig === "object" &&
      input.InputDataConfig !== null
        ? (input.InputDataConfig as Record<string, unknown>)
        : {},
    Mode: stringOrUndefined(input.Mode) ?? "MULTI_CLASS",
    FlywheelArn: undefined,
    ClientRequestToken: token,
    describeCount: 0,
  };
  ctx.store.set(`classifier/${arn}`, rec);
  if (token !== undefined) {
    ctx.store.set(idempotencyKey("classifier", token), arn);
  }
  const tags = parseTags(input.Tags);
  if (tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { DocumentClassifierArn: arn };
};

const DescribeDocumentClassifier: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DocumentClassifierArn");
  let rec = requireClassifier(ctx, arn);
  if (rec.Status === "TRAINING") {
    if (rec.describeCount >= 1) {
      const updated: StoredDocumentClassifier = {
        ...rec,
        Status: "TRAINED",
        TrainingEndTime: Date.now(),
        describeCount: rec.describeCount + 1,
      };
      ctx.store.set(`classifier/${arn}`, updated);
      rec = updated;
    } else {
      const updated: StoredDocumentClassifier = {
        ...rec,
        describeCount: rec.describeCount + 1,
      };
      ctx.store.set(`classifier/${arn}`, updated);
      rec = updated;
    }
  }
  return { DocumentClassifierProperties: classifierProperties(rec) };
};

const ListDocumentClassifiers: OperationHandler = (input, ctx) => {
  const filter = input.Filter;
  const all = ctx.store
    .list<StoredDocumentClassifier>()
    .filter((e) => e.key.startsWith("classifier/"))
    .map((e) => e.value)
    .filter((c) => {
      if (typeof filter !== "object" || filter === null) return true;
      const f = filter as Record<string, unknown>;
      const status = stringOrUndefined(f.Status);
      const dcName = stringOrUndefined(f.DocumentClassifierName);
      const before = numberOrUndefined(f.SubmitTimeBefore);
      const after = numberOrUndefined(f.SubmitTimeAfter);
      if (status !== undefined && c.Status !== status) return false;
      if (dcName !== undefined && c.DocumentClassifierName !== dcName)
        return false;
      if (before !== undefined && c.SubmitTime > before * 1000) return false;
      if (after !== undefined && c.SubmitTime < after * 1000) return false;
      return true;
    });
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return {
    DocumentClassifierPropertiesList: items.map(classifierProperties),
    NextToken,
  };
};

const ListDocumentClassifierSummaries: OperationHandler = (input, ctx) => {
  const byName = new Map<string, StoredDocumentClassifier[]>();
  for (const e of ctx.store
    .list<StoredDocumentClassifier>()
    .filter((e) => e.key.startsWith("classifier/"))) {
    const n = e.value.DocumentClassifierName;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n)!.push(e.value);
  }
  const all = Array.from(byName.entries()).map(([name, versions]) => {
    const latest = versions.sort((a, b) => b.SubmitTime - a.SubmitTime)[0];
    return {
      DocumentClassifierName: name,
      NumberOfVersions: versions.length,
      LatestVersionCreatedAt: latest.SubmitTime,
      LatestVersionName: latest.VersionName,
      LatestVersionStatus: latest.Status,
    };
  });
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return { DocumentClassifierSummariesList: items, NextToken };
};

const DeleteDocumentClassifier: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DocumentClassifierArn");
  const rec = requireClassifier(ctx, arn);
  if (rec.Status !== "TRAINED" && rec.Status !== "IN_ERROR") {
    throw awsError(
      "InvalidRequestException",
      `Classifier '${arn}' cannot be deleted in '${rec.Status}' state.`,
      400,
    );
  }
  ctx.store.delete(`classifier/${arn}`);
  return {};
};

const StopTrainingDocumentClassifier: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DocumentClassifierArn");
  const rec = requireClassifier(ctx, arn);
  ctx.store.set(`classifier/${arn}`, { ...rec, Status: "STOP_REQUESTED" });
  return {};
};

const ImportModel: OperationHandler = (input, ctx) => {
  const sourceArn = requireString(input, "SourceModelArn");
  const name = stringOrUndefined(input.ModelName) ?? "imported-model";
  const version = stringOrUndefined(input.VersionName);
  const arn = classifierArn(ctx.region, ctx.account, name, version);
  const now = Date.now();
  const rec: StoredDocumentClassifier = {
    DocumentClassifierArn: arn,
    DocumentClassifierName: name,
    VersionName: version,
    LanguageCode: "en",
    Status: "TRAINING",
    DataAccessRoleArn: stringOrUndefined(input.DataAccessRoleArn),
    SubmitTime: now,
    TrainingEndTime: undefined,
    InputDataConfig: { SourceArn: sourceArn },
    Mode: "MULTI_CLASS",
    FlywheelArn: undefined,
    ClientRequestToken: undefined,
    describeCount: 0,
  };
  ctx.store.set(`classifier/${arn}`, rec);
  return { ModelArn: arn };
};

const CreateEntityRecognizer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RecognizerName");
  const languageCode = requireString(input, "LanguageCode");
  const version = stringOrUndefined(input.VersionName);
  const token = stringOrUndefined(input.ClientRequestToken);
  const arn = recognizerArn(ctx.region, ctx.account, name, version);

  if (token !== undefined) {
    const existing = ctx.store.get<string>(idempotencyKey("recognizer", token));
    if (existing !== undefined) return { EntityRecognizerArn: existing };
  }

  const now = Date.now();
  const rec: StoredEntityRecognizer = {
    EntityRecognizerArn: arn,
    RecognizerName: name,
    VersionName: version,
    LanguageCode: languageCode,
    Status: "TRAINING",
    DataAccessRoleArn: stringOrUndefined(input.DataAccessRoleArn),
    SubmitTime: now,
    TrainingEndTime: undefined,
    InputDataConfig:
      typeof input.InputDataConfig === "object" &&
      input.InputDataConfig !== null
        ? (input.InputDataConfig as Record<string, unknown>)
        : {},
    FlywheelArn: undefined,
    ClientRequestToken: token,
    describeCount: 0,
  };
  ctx.store.set(`recognizer/${arn}`, rec);
  if (token !== undefined) {
    ctx.store.set(idempotencyKey("recognizer", token), arn);
  }
  const tags = parseTags(input.Tags);
  if (tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { EntityRecognizerArn: arn };
};

const DescribeEntityRecognizer: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EntityRecognizerArn");
  let rec = requireEntityRecognizer(ctx, arn);
  if (rec.Status === "TRAINING") {
    if (rec.describeCount >= 1) {
      const updated: StoredEntityRecognizer = {
        ...rec,
        Status: "TRAINED",
        TrainingEndTime: Date.now(),
        describeCount: rec.describeCount + 1,
      };
      ctx.store.set(`recognizer/${arn}`, updated);
      rec = updated;
    } else {
      const updated: StoredEntityRecognizer = {
        ...rec,
        describeCount: rec.describeCount + 1,
      };
      ctx.store.set(`recognizer/${arn}`, updated);
      rec = updated;
    }
  }
  return { EntityRecognizerProperties: recognizerProperties(rec) };
};

const ListEntityRecognizers: OperationHandler = (input, ctx) => {
  const filter = input.Filter;
  const all = ctx.store
    .list<StoredEntityRecognizer>()
    .filter((e) => e.key.startsWith("recognizer/"))
    .map((e) => e.value)
    .filter((r) => {
      if (typeof filter !== "object" || filter === null) return true;
      const f = filter as Record<string, unknown>;
      const status = stringOrUndefined(f.Status);
      const rName = stringOrUndefined(f.RecognizerName);
      const before = numberOrUndefined(f.SubmitTimeBefore);
      const after = numberOrUndefined(f.SubmitTimeAfter);
      if (status !== undefined && r.Status !== status) return false;
      if (rName !== undefined && r.RecognizerName !== rName) return false;
      if (before !== undefined && r.SubmitTime > before * 1000) return false;
      if (after !== undefined && r.SubmitTime < after * 1000) return false;
      return true;
    });
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return {
    EntityRecognizerPropertiesList: items.map(recognizerProperties),
    NextToken,
  };
};

const ListEntityRecognizerSummaries: OperationHandler = (input, ctx) => {
  const byName = new Map<string, StoredEntityRecognizer[]>();
  for (const e of ctx.store
    .list<StoredEntityRecognizer>()
    .filter((e) => e.key.startsWith("recognizer/"))) {
    const n = e.value.RecognizerName;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n)!.push(e.value);
  }
  const all = Array.from(byName.entries()).map(([name, versions]) => {
    const latest = versions.sort((a, b) => b.SubmitTime - a.SubmitTime)[0];
    return {
      RecognizerName: name,
      NumberOfVersions: versions.length,
      LatestVersionCreatedAt: latest.SubmitTime,
      LatestVersionName: latest.VersionName,
      LatestVersionStatus: latest.Status,
    };
  });
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return { EntityRecognizerSummariesList: items, NextToken };
};

const DeleteEntityRecognizer: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EntityRecognizerArn");
  const rec = requireEntityRecognizer(ctx, arn);
  if (rec.Status !== "TRAINED" && rec.Status !== "IN_ERROR") {
    throw awsError(
      "InvalidRequestException",
      `Entity recognizer '${arn}' cannot be deleted in '${rec.Status}' state.`,
      400,
    );
  }
  ctx.store.delete(`recognizer/${arn}`);
  return {};
};

const StopTrainingEntityRecognizer: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EntityRecognizerArn");
  const rec = requireEntityRecognizer(ctx, arn);
  ctx.store.set(`recognizer/${arn}`, { ...rec, Status: "STOP_REQUESTED" });
  return {};
};

const CreateFlywheel: OperationHandler = (input, ctx) => {
  const name = requireString(input, "FlywheelName");
  const token = stringOrUndefined(input.ClientRequestToken);
  const arn = flywheelArn(ctx.region, ctx.account, name);

  if (token !== undefined) {
    const existing = ctx.store.get<string>(idempotencyKey("flywheel", token));
    if (existing !== undefined) {
      const fw = ctx.store.get<StoredFlywheel>(`flywheel/${existing}`);
      return { FlywheelArn: existing, ActiveModelArn: fw?.ActiveModelArn };
    }
  }

  const now = Date.now();
  const rec: StoredFlywheel = {
    FlywheelArn: arn,
    FlywheelName: name,
    ActiveModelArn: stringOrUndefined(input.ActiveModelArn),
    DataAccessRoleArn: stringOrUndefined(input.DataAccessRoleArn),
    TaskConfig:
      typeof input.TaskConfig === "object" && input.TaskConfig !== null
        ? (input.TaskConfig as Record<string, unknown>)
        : undefined,
    DataLakeS3Uri: stringOrUndefined(input.DataLakeS3Uri),
    DataSecurityConfig:
      typeof input.DataSecurityConfig === "object" &&
      input.DataSecurityConfig !== null
        ? (input.DataSecurityConfig as Record<string, unknown>)
        : undefined,
    Status: "CREATING",
    ModelType: stringOrUndefined(input.ModelType),
    CreationTime: now,
    LastModifiedTime: now,
    LatestFlywheelIteration: undefined,
    describeCount: 0,
  };
  ctx.store.set(`flywheel/${arn}`, rec);
  if (token !== undefined) {
    ctx.store.set(idempotencyKey("flywheel", token), arn);
  }
  const tags = parseTags(input.Tags);
  if (tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { FlywheelArn: arn, ActiveModelArn: rec.ActiveModelArn };
};

const DescribeFlywheel: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FlywheelArn");
  let rec = requireFlywheel(ctx, arn);
  if (rec.Status === "CREATING") {
    if (rec.describeCount >= 1) {
      const updated: StoredFlywheel = {
        ...rec,
        Status: "ACTIVE",
        LastModifiedTime: Date.now(),
        describeCount: rec.describeCount + 1,
      };
      ctx.store.set(`flywheel/${arn}`, updated);
      rec = updated;
    } else {
      const updated: StoredFlywheel = {
        ...rec,
        describeCount: rec.describeCount + 1,
      };
      ctx.store.set(`flywheel/${arn}`, updated);
      rec = updated;
    }
  }
  return { FlywheelProperties: flywheelProperties(rec) };
};

const ListFlywheels: OperationHandler = (input, ctx) => {
  const filter = input.Filter;
  const all = ctx.store
    .list<StoredFlywheel>()
    .filter((e) => e.key.startsWith("flywheel/"))
    .map((e) => e.value)
    .filter((f) => {
      if (typeof filter !== "object" || filter === null) return true;
      const fi = filter as Record<string, unknown>;
      const status = stringOrUndefined(fi.Status);
      const before = numberOrUndefined(fi.CreationTimeBefore);
      const after = numberOrUndefined(fi.CreationTimeAfter);
      if (status !== undefined && f.Status !== status) return false;
      if (before !== undefined && f.CreationTime > before * 1000) return false;
      if (after !== undefined && f.CreationTime < after * 1000) return false;
      return true;
    })
    .map((f) => ({
      FlywheelArn: f.FlywheelArn,
      ActiveModelArn: f.ActiveModelArn,
      DataLakeS3Uri: f.DataLakeS3Uri,
      Status: f.Status,
      ModelType: f.ModelType,
      CreationTime: f.CreationTime,
      LastModifiedTime: f.LastModifiedTime,
      LatestFlywheelIteration: f.LatestFlywheelIteration,
    }));
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return { FlywheelSummaryList: items, NextToken };
};

const DeleteFlywheel: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FlywheelArn");
  requireFlywheel(ctx, arn);
  ctx.store.delete(`flywheel/${arn}`);
  return {};
};

const UpdateFlywheel: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FlywheelArn");
  const rec = requireFlywheel(ctx, arn);
  const now = Date.now();
  const updated: StoredFlywheel = {
    ...rec,
    ActiveModelArn:
      stringOrUndefined(input.ActiveModelArn) ?? rec.ActiveModelArn,
    DataAccessRoleArn:
      stringOrUndefined(input.DataAccessRoleArn) ?? rec.DataAccessRoleArn,
    DataSecurityConfig:
      typeof input.DataSecurityConfig === "object" &&
      input.DataSecurityConfig !== null
        ? (input.DataSecurityConfig as Record<string, unknown>)
        : rec.DataSecurityConfig,
    LastModifiedTime: now,
  };
  ctx.store.set(`flywheel/${arn}`, updated);
  return { FlywheelProperties: flywheelProperties(updated) };
};

const StartFlywheelIteration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FlywheelArn");
  const fw = requireFlywheel(ctx, arn);
  const iterationId = makeJobId();
  const now = Date.now();
  const iter: StoredFlywheelIteration = {
    FlywheelArn: arn,
    FlywheelIterationId: iterationId,
    CreationTime: now,
    EndTime: undefined,
    Status: "TRAINING",
    describeCount: 0,
  };
  ctx.store.set(`flywheel-iteration/${arn}/${iterationId}`, iter);
  const updated: StoredFlywheel = {
    ...fw,
    LatestFlywheelIteration: iterationId,
    LastModifiedTime: now,
  };
  ctx.store.set(`flywheel/${arn}`, updated);
  return { FlywheelArn: arn, FlywheelIterationId: iterationId };
};

const DescribeFlywheelIteration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FlywheelArn");
  const iterationId = requireString(input, "FlywheelIterationId");
  let iter = ctx.store.get<StoredFlywheelIteration>(
    `flywheel-iteration/${arn}/${iterationId}`,
  );
  if (iter === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Flywheel iteration '${iterationId}' was not found.`,
      400,
    );
  }
  if (iter.Status === "TRAINING") {
    if (iter.describeCount >= 1) {
      const updated: StoredFlywheelIteration = {
        ...iter,
        Status: "COMPLETED",
        EndTime: Date.now(),
        describeCount: iter.describeCount + 1,
      };
      ctx.store.set(`flywheel-iteration/${arn}/${iterationId}`, updated);
      iter = updated;
    } else {
      const updated: StoredFlywheelIteration = {
        ...iter,
        describeCount: iter.describeCount + 1,
      };
      ctx.store.set(`flywheel-iteration/${arn}/${iterationId}`, updated);
      iter = updated;
    }
  }
  return {
    FlywheelIterationProperties: {
      FlywheelArn: iter.FlywheelArn,
      FlywheelIterationId: iter.FlywheelIterationId,
      CreationTime: iter.CreationTime,
      EndTime: iter.EndTime,
      Status: iter.Status,
    },
  };
};

const ListFlywheelIterationHistory: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FlywheelArn");
  requireFlywheel(ctx, arn);
  const prefix = `flywheel-iteration/${arn}/`;
  const all = ctx.store
    .list<StoredFlywheelIteration>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => ({
      FlywheelArn: e.value.FlywheelArn,
      FlywheelIterationId: e.value.FlywheelIterationId,
      CreationTime: e.value.CreationTime,
      EndTime: e.value.EndTime,
      Status: e.value.Status,
    }));
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return { FlywheelIterationPropertiesList: items, NextToken };
};

const CreateDataset: OperationHandler = (input, ctx) => {
  const fwArn = requireString(input, "FlywheelArn");
  requireFlywheel(ctx, fwArn);
  const name = requireString(input, "DatasetName");
  const token = stringOrUndefined(input.ClientRequestToken);
  const fwName = fwArn.split("/").pop() ?? "fw";
  const arn = datasetArn(ctx.region, ctx.account, fwName, name);

  if (token !== undefined) {
    const existing = ctx.store.get<string>(idempotencyKey("dataset", token));
    if (existing !== undefined) return { DatasetArn: existing };
  }

  const now = Date.now();
  const rec: StoredDataset = {
    DatasetArn: arn,
    DatasetName: name,
    DatasetType: stringOrUndefined(input.DatasetType),
    Description: stringOrUndefined(input.Description),
    Status: "CREATING",
    CreationTime: now,
    EndTime: undefined,
    FlywheelArn: fwArn,
    describeCount: 0,
  };
  ctx.store.set(`dataset/${arn}`, rec);
  if (token !== undefined) {
    ctx.store.set(idempotencyKey("dataset", token), arn);
  }
  return { DatasetArn: arn };
};

const DescribeDataset: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DatasetArn");
  let rec = ctx.store.get<StoredDataset>(`dataset/${arn}`);
  if (rec === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Dataset '${arn}' was not found.`,
      400,
    );
  }
  if (rec.Status === "CREATING") {
    if (rec.describeCount >= 1) {
      const updated: StoredDataset = {
        ...rec,
        Status: "COMPLETED",
        EndTime: Date.now(),
        describeCount: rec.describeCount + 1,
      };
      ctx.store.set(`dataset/${arn}`, updated);
      rec = updated;
    } else {
      const updated: StoredDataset = {
        ...rec,
        describeCount: rec.describeCount + 1,
      };
      ctx.store.set(`dataset/${arn}`, updated);
      rec = updated;
    }
  }
  return {
    DatasetProperties: {
      DatasetArn: rec.DatasetArn,
      DatasetName: rec.DatasetName,
      DatasetType: rec.DatasetType,
      Description: rec.Description,
      Status: rec.Status,
      CreationTime: rec.CreationTime,
      EndTime: rec.EndTime,
    },
  };
};

const ListDatasets: OperationHandler = (input, ctx) => {
  const fwArn = stringOrUndefined(input.FlywheelArn);
  const filter = input.Filter;
  const all = ctx.store
    .list<StoredDataset>()
    .filter(
      (e) =>
        e.key.startsWith("dataset/") &&
        (fwArn === undefined || e.value.FlywheelArn === fwArn),
    )
    .map((e) => e.value)
    .filter((d) => {
      if (typeof filter !== "object" || filter === null) return true;
      const f = filter as Record<string, unknown>;
      const status = stringOrUndefined(f.Status);
      const before = numberOrUndefined(f.CreationTimeBefore);
      const after = numberOrUndefined(f.CreationTimeAfter);
      if (status !== undefined && d.Status !== status) return false;
      if (before !== undefined && d.CreationTime > before * 1000) return false;
      if (after !== undefined && d.CreationTime < after * 1000) return false;
      return true;
    })
    .map((d) => ({
      DatasetArn: d.DatasetArn,
      DatasetName: d.DatasetName,
      DatasetType: d.DatasetType,
      Description: d.Description,
      Status: d.Status,
      CreationTime: d.CreationTime,
      EndTime: d.EndTime,
    }));
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return { DatasetPropertiesList: items, NextToken };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const policy = requireString(input, "ResourcePolicy");
  const revisionId = makeJobId();
  const now = Date.now();
  const rec: StoredResourcePolicy = {
    ResourcePolicy: policy,
    PolicyRevisionId: revisionId,
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(policyKey(arn), rec);
  return { PolicyRevisionId: revisionId };
};

const DescribeResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const rec = ctx.store.get<StoredResourcePolicy>(policyKey(arn));
  if (rec === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource policy for '${arn}' was not found.`,
      400,
    );
  }
  return {
    ResourcePolicy: rec.ResourcePolicy,
    CreationTime: rec.CreationTime,
    LastModifiedTime: rec.LastModifiedTime,
    PolicyRevisionId: rec.PolicyRevisionId,
  };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  ctx.store.delete(policyKey(arn));
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const newTags = parseTags(input.Tags);
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(arn)) ?? [];
  const merged = [...existing];
  for (const tag of newTags) {
    const idx = merged.findIndex((t) => t.Key === tag.Key);
    if (idx >= 0) {
      merged[idx] = tag;
    } else {
      merged.push(tag);
    }
  }
  ctx.store.set(tagsKey(arn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const keys = Array.isArray(input.TagKeys)
    ? (input.TagKeys as unknown[]).filter(
        (k): k is string => typeof k === "string",
      )
    : [];
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(arn)) ?? [];
  ctx.store.set(
    tagsKey(arn),
    existing.filter((t) => !keys.includes(t.Key)),
  );
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tags =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(arn)) ?? [];
  return { ResourceArn: arn, Tags: tags };
};

const startDetectionJob = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
  prefix: string,
  jobType: string,
  extra?: Partial<StoredDetectionJob>,
): StoredDetectionJob => {
  const jobId = makeJobId();
  const arn = jobArn(ctx.region, ctx.account, jobType, jobId);
  const now = Date.now();
  const rec: StoredDetectionJob = {
    JobId: jobId,
    JobArn: arn,
    JobName: stringOrUndefined(input.JobName),
    JobStatus: "SUBMITTED",
    SubmitTime: now,
    EndTime: undefined,
    InputDataConfig:
      typeof input.InputDataConfig === "object" &&
      input.InputDataConfig !== null
        ? (input.InputDataConfig as Record<string, unknown>)
        : {},
    OutputDataConfig:
      typeof input.OutputDataConfig === "object" &&
      input.OutputDataConfig !== null
        ? (input.OutputDataConfig as Record<string, unknown>)
        : {},
    DataAccessRoleArn: stringOrUndefined(input.DataAccessRoleArn),
    LanguageCode: stringOrUndefined(input.LanguageCode),
    EntityRecognizerArn: undefined,
    DocumentClassifierArn: undefined,
    FlywheelArn: undefined,
    NumberOfTopics: undefined,
    Mode: undefined,
    TargetEventTypes: undefined,
    RedactionConfig: undefined,
    describeCount: 0,
    ...extra,
  };
  ctx.store.set(`${prefix}/${jobId}`, rec);
  return rec;
};

const describeDetectionJob = (
  jobId: string,
  ctx: ServiceContext,
  prefix: string,
): StoredDetectionJob => {
  let rec = requireJob(ctx, jobId, prefix);
  const advanced = advanceJobStatus(rec);
  if (advanced !== rec) {
    ctx.store.set(`${prefix}/${jobId}`, advanced);
    rec = advanced;
  }
  return rec;
};

const stopDetectionJob = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
  prefix: string,
): { JobId: string; JobStatus: string } => {
  const jobId = requireString(input, "JobId");
  const rec = requireJob(ctx, jobId, prefix);
  const updated = { ...rec, JobStatus: "STOP_REQUESTED" };
  ctx.store.set(`${prefix}/${jobId}`, updated);
  return { JobId: jobId, JobStatus: "STOP_REQUESTED" };
};

const listDetectionJobs = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
  prefix: string,
): StoredDetectionJob[] => {
  const filter = input.Filter;
  return ctx.store
    .list<StoredDetectionJob>()
    .filter((e) => e.key.startsWith(`${prefix}/`))
    .map((e) => e.value)
    .filter((j) => matchJobFilter(j, filter));
};

const StartDominantLanguageDetectionJob: OperationHandler = (input, ctx) => {
  const j = startDetectionJob(
    input,
    ctx,
    "dominant-language-job",
    "dominant-language-detection-jobs",
  );
  return { JobId: j.JobId, JobArn: j.JobArn, JobStatus: j.JobStatus };
};

const DescribeDominantLanguageDetectionJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const rec = describeDetectionJob(jobId, ctx, "dominant-language-job");
  return {
    DominantLanguageDetectionJobProperties: detectionJobProperties(
      rec,
      "dominant-language-job",
    ),
  };
};

const ListDominantLanguageDetectionJobs: OperationHandler = (input, ctx) => {
  const all = listDetectionJobs(input, ctx, "dominant-language-job").map((e) =>
    detectionJobProperties(e, "dominant-language-job"),
  );
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return {
    DominantLanguageDetectionJobPropertiesList: items,
    NextToken,
  };
};

const StopDominantLanguageDetectionJob: OperationHandler = (input, ctx) =>
  stopDetectionJob(input, ctx, "dominant-language-job");

const StartEntitiesDetectionJob: OperationHandler = (input, ctx) => {
  const recognizerArn = stringOrUndefined(input.EntityRecognizerArn);
  if (recognizerArn !== undefined) {
    requireEntityRecognizer(ctx, recognizerArn);
  }
  const j = startDetectionJob(
    input,
    ctx,
    "entities-job",
    "entities-detection-jobs",
    {
      LanguageCode: stringOrUndefined(input.LanguageCode),
      EntityRecognizerArn: recognizerArn,
      FlywheelArn: stringOrUndefined(input.FlywheelArn),
    },
  );
  return {
    JobId: j.JobId,
    JobArn: j.JobArn,
    JobStatus: j.JobStatus,
    EntityRecognizerArn: j.EntityRecognizerArn,
  };
};

const DescribeEntitiesDetectionJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const rec = describeDetectionJob(jobId, ctx, "entities-job");
  return {
    EntitiesDetectionJobProperties: detectionJobProperties(rec, "entities-job"),
  };
};

const ListEntitiesDetectionJobs: OperationHandler = (input, ctx) => {
  const all = listDetectionJobs(input, ctx, "entities-job").map((e) =>
    detectionJobProperties(e, "entities-job"),
  );
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return {
    EntitiesDetectionJobPropertiesList: items,
    NextToken,
  };
};

const StopEntitiesDetectionJob: OperationHandler = (input, ctx) =>
  stopDetectionJob(input, ctx, "entities-job");

const StartEventsDetectionJob: OperationHandler = (input, ctx) => {
  const targetTypes = Array.isArray(input.TargetEventTypes)
    ? (input.TargetEventTypes as unknown[]).filter(
        (t): t is string => typeof t === "string",
      )
    : [];
  const j = startDetectionJob(
    input,
    ctx,
    "events-job",
    "events-detection-jobs",
    {
      LanguageCode: stringOrUndefined(input.LanguageCode),
      TargetEventTypes: targetTypes,
    },
  );
  return { JobId: j.JobId, JobArn: j.JobArn, JobStatus: j.JobStatus };
};

const DescribeEventsDetectionJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const rec = describeDetectionJob(jobId, ctx, "events-job");
  return {
    EventsDetectionJobProperties: detectionJobProperties(rec, "events-job"),
  };
};

const ListEventsDetectionJobs: OperationHandler = (input, ctx) => {
  const all = listDetectionJobs(input, ctx, "events-job").map((e) =>
    detectionJobProperties(e, "events-job"),
  );
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return { EventsDetectionJobPropertiesList: items, NextToken };
};

const StopEventsDetectionJob: OperationHandler = (input, ctx) =>
  stopDetectionJob(input, ctx, "events-job");

const StartKeyPhrasesDetectionJob: OperationHandler = (input, ctx) => {
  const j = startDetectionJob(
    input,
    ctx,
    "key-phrases-job",
    "key-phrases-detection-jobs",
    { LanguageCode: stringOrUndefined(input.LanguageCode) },
  );
  return { JobId: j.JobId, JobArn: j.JobArn, JobStatus: j.JobStatus };
};

const DescribeKeyPhrasesDetectionJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const rec = describeDetectionJob(jobId, ctx, "key-phrases-job");
  return {
    KeyPhrasesDetectionJobProperties: detectionJobProperties(
      rec,
      "key-phrases-job",
    ),
  };
};

const ListKeyPhrasesDetectionJobs: OperationHandler = (input, ctx) => {
  const all = listDetectionJobs(input, ctx, "key-phrases-job").map((e) =>
    detectionJobProperties(e, "key-phrases-job"),
  );
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return {
    KeyPhrasesDetectionJobPropertiesList: items,
    NextToken,
  };
};

const StopKeyPhrasesDetectionJob: OperationHandler = (input, ctx) =>
  stopDetectionJob(input, ctx, "key-phrases-job");

const StartPiiEntitiesDetectionJob: OperationHandler = (input, ctx) => {
  const j = startDetectionJob(
    input,
    ctx,
    "pii-entities-job",
    "pii-entities-detection-jobs",
    {
      LanguageCode: stringOrUndefined(input.LanguageCode),
      Mode: stringOrUndefined(input.Mode),
      RedactionConfig:
        typeof input.RedactionConfig === "object" &&
        input.RedactionConfig !== null
          ? (input.RedactionConfig as Record<string, unknown>)
          : undefined,
    },
  );
  return { JobId: j.JobId, JobArn: j.JobArn, JobStatus: j.JobStatus };
};

const DescribePiiEntitiesDetectionJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const rec = describeDetectionJob(jobId, ctx, "pii-entities-job");
  return {
    PiiEntitiesDetectionJobProperties: detectionJobProperties(
      rec,
      "pii-entities-job",
    ),
  };
};

const ListPiiEntitiesDetectionJobs: OperationHandler = (input, ctx) => {
  const all = listDetectionJobs(input, ctx, "pii-entities-job").map((e) =>
    detectionJobProperties(e, "pii-entities-job"),
  );
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return {
    PiiEntitiesDetectionJobPropertiesList: items,
    NextToken,
  };
};

const StopPiiEntitiesDetectionJob: OperationHandler = (input, ctx) =>
  stopDetectionJob(input, ctx, "pii-entities-job");

const StartSentimentDetectionJob: OperationHandler = (input, ctx) => {
  const j = startDetectionJob(
    input,
    ctx,
    "sentiment-job",
    "sentiment-detection-jobs",
    { LanguageCode: stringOrUndefined(input.LanguageCode) },
  );
  return { JobId: j.JobId, JobArn: j.JobArn, JobStatus: j.JobStatus };
};

const DescribeSentimentDetectionJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const rec = describeDetectionJob(jobId, ctx, "sentiment-job");
  return {
    SentimentDetectionJobProperties: detectionJobProperties(
      rec,
      "sentiment-job",
    ),
  };
};

const ListSentimentDetectionJobs: OperationHandler = (input, ctx) => {
  const all = listDetectionJobs(input, ctx, "sentiment-job").map((e) =>
    detectionJobProperties(e, "sentiment-job"),
  );
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return {
    SentimentDetectionJobPropertiesList: items,
    NextToken,
  };
};

const StopSentimentDetectionJob: OperationHandler = (input, ctx) =>
  stopDetectionJob(input, ctx, "sentiment-job");

const StartTargetedSentimentDetectionJob: OperationHandler = (input, ctx) => {
  const j = startDetectionJob(
    input,
    ctx,
    "targeted-sentiment-job",
    "targeted-sentiment-detection-jobs",
    { LanguageCode: stringOrUndefined(input.LanguageCode) },
  );
  return { JobId: j.JobId, JobArn: j.JobArn, JobStatus: j.JobStatus };
};

const DescribeTargetedSentimentDetectionJob: OperationHandler = (
  input,
  ctx,
) => {
  const jobId = requireString(input, "JobId");
  const rec = describeDetectionJob(jobId, ctx, "targeted-sentiment-job");
  return {
    TargetedSentimentDetectionJobProperties: detectionJobProperties(
      rec,
      "targeted-sentiment-job",
    ),
  };
};

const ListTargetedSentimentDetectionJobs: OperationHandler = (input, ctx) => {
  const all = listDetectionJobs(input, ctx, "targeted-sentiment-job").map((e) =>
    detectionJobProperties(e, "targeted-sentiment-job"),
  );
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return {
    TargetedSentimentDetectionJobPropertiesList: items,
    NextToken,
  };
};

const StopTargetedSentimentDetectionJob: OperationHandler = (input, ctx) =>
  stopDetectionJob(input, ctx, "targeted-sentiment-job");

const StartTopicsDetectionJob: OperationHandler = (input, ctx) => {
  const j = startDetectionJob(
    input,
    ctx,
    "topics-job",
    "topics-detection-jobs",
    { NumberOfTopics: numberOrUndefined(input.NumberOfTopics) },
  );
  return { JobId: j.JobId, JobArn: j.JobArn, JobStatus: j.JobStatus };
};

const DescribeTopicsDetectionJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const rec = describeDetectionJob(jobId, ctx, "topics-job");
  return {
    TopicsDetectionJobProperties: detectionJobProperties(rec, "topics-job"),
  };
};

const ListTopicsDetectionJobs: OperationHandler = (input, ctx) => {
  const all = listDetectionJobs(input, ctx, "topics-job").map((e) =>
    detectionJobProperties(e, "topics-job"),
  );
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return {
    TopicsDetectionJobPropertiesList: items,
    NextToken,
  };
};

const StartDocumentClassificationJob: OperationHandler = (input, ctx) => {
  const classifierArn = stringOrUndefined(input.DocumentClassifierArn);
  if (classifierArn !== undefined) {
    requireClassifier(ctx, classifierArn);
  }
  const j = startDetectionJob(
    input,
    ctx,
    "document-classification-job",
    "document-classification-jobs",
    {
      DocumentClassifierArn: classifierArn,
      FlywheelArn: stringOrUndefined(input.FlywheelArn),
    },
  );
  return {
    JobId: j.JobId,
    JobArn: j.JobArn,
    JobStatus: j.JobStatus,
    DocumentClassifierArn: j.DocumentClassifierArn,
  };
};

const DescribeDocumentClassificationJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const rec = describeDetectionJob(jobId, ctx, "document-classification-job");
  return {
    DocumentClassificationJobProperties: detectionJobProperties(
      rec,
      "document-classification-job",
    ),
  };
};

const ListDocumentClassificationJobs: OperationHandler = (input, ctx) => {
  const all = listDetectionJobs(input, ctx, "document-classification-job").map(
    (e) => detectionJobProperties(e, "document-classification-job"),
  );
  const { items, NextToken } = paginate(all, input.MaxResults, input.NextToken);
  return {
    DocumentClassificationJobPropertiesList: items,
    NextToken,
  };
};

const DetectDominantLanguage: OperationHandler = (_input, _ctx) => ({
  Languages: [{ LanguageCode: "en", Score: 0.99 }],
});

const DetectEntities: OperationHandler = (_input, _ctx) => ({
  Entities: [
    {
      Score: 0.99,
      Type: "PERSON",
      Text: "John",
      BeginOffset: 0,
      EndOffset: 4,
    },
  ],
  DocumentMetadata: { Pages: 1 },
  DocumentType: [],
  Blocks: [],
  Errors: [],
});

const DetectKeyPhrases: OperationHandler = (_input, _ctx) => ({
  KeyPhrases: [
    { Score: 0.99, Text: "sample phrase", BeginOffset: 0, EndOffset: 13 },
  ],
});

const DetectPiiEntities: OperationHandler = (_input, _ctx) => ({
  Entities: [{ Score: 0.99, Type: "NAME", BeginOffset: 0, EndOffset: 4 }],
});

const DetectSentiment: OperationHandler = (_input, _ctx) => ({
  Sentiment: "NEUTRAL",
  SentimentScore: {
    Positive: 0.01,
    Negative: 0.01,
    Neutral: 0.97,
    Mixed: 0.01,
  },
});

const DetectSyntax: OperationHandler = (_input, _ctx) => ({
  SyntaxTokens: [
    {
      TokenId: 1,
      Text: "Hello",
      BeginOffset: 0,
      EndOffset: 5,
      PartOfSpeech: { Tag: "INTJ", Score: 0.99 },
    },
  ],
});

const DetectTargetedSentiment: OperationHandler = (_input, _ctx) => ({
  Entities: [
    {
      DescriptiveMentionIndex: [0],
      Mentions: [
        {
          Score: 0.99,
          GroupScore: 0.99,
          Text: "sample",
          Type: "OTHER",
          MentionSentiment: {
            Sentiment: "NEUTRAL",
            SentimentScore: {
              Positive: 0.01,
              Negative: 0.01,
              Neutral: 0.97,
              Mixed: 0.01,
            },
          },
          BeginOffset: 0,
          EndOffset: 6,
        },
      ],
    },
  ],
});

const DetectToxicContent: OperationHandler = (_input, _ctx) => ({
  ResultList: [
    {
      Labels: [{ Name: "PROFANITY", Score: 0.01 }],
      Toxicity: 0.01,
    },
  ],
});

const ClassifyDocument: OperationHandler = (_input, _ctx) => ({
  Classes: [{ Name: "SAMPLE", Score: 0.99 }],
  Labels: [],
  DocumentMetadata: { Pages: 1 },
  DocumentType: [],
  Errors: [],
  Warnings: [],
});

const ContainsPiiEntities: OperationHandler = (_input, _ctx) => ({
  Labels: [{ Name: "NAME", Score: 0.01 }],
});

const getTextList = (input: Record<string, unknown>): string[] =>
  Array.isArray(input.TextList)
    ? (input.TextList as unknown[]).filter(
        (t): t is string => typeof t === "string",
      )
    : [];

const BatchDetectDominantLanguage: OperationHandler = (input, _ctx) => {
  const texts = getTextList(input);
  return {
    ResultList: texts.map((_t, i) => ({
      Index: i,
      Languages: [{ LanguageCode: "en", Score: 0.99 }],
    })),
    ErrorList: [],
  };
};

const BatchDetectEntities: OperationHandler = (input, _ctx) => {
  const texts = getTextList(input);
  return {
    ResultList: texts.map((_t, i) => ({
      Index: i,
      Entities: [
        {
          Score: 0.99,
          Type: "PERSON",
          Text: "John",
          BeginOffset: 0,
          EndOffset: 4,
        },
      ],
    })),
    ErrorList: [],
  };
};

const BatchDetectKeyPhrases: OperationHandler = (input, _ctx) => {
  const texts = getTextList(input);
  return {
    ResultList: texts.map((_t, i) => ({
      Index: i,
      KeyPhrases: [
        { Score: 0.99, Text: "sample", BeginOffset: 0, EndOffset: 6 },
      ],
    })),
    ErrorList: [],
  };
};

const BatchDetectSentiment: OperationHandler = (input, _ctx) => {
  const texts = getTextList(input);
  return {
    ResultList: texts.map((_t, i) => ({
      Index: i,
      Sentiment: "NEUTRAL",
      SentimentScore: {
        Positive: 0.01,
        Negative: 0.01,
        Neutral: 0.97,
        Mixed: 0.01,
      },
    })),
    ErrorList: [],
  };
};

const BatchDetectSyntax: OperationHandler = (input, _ctx) => {
  const texts = getTextList(input);
  return {
    ResultList: texts.map((_t, i) => ({
      Index: i,
      SyntaxTokens: [
        {
          TokenId: 1,
          Text: "Hello",
          BeginOffset: 0,
          EndOffset: 5,
          PartOfSpeech: { Tag: "INTJ", Score: 0.99 },
        },
      ],
    })),
    ErrorList: [],
  };
};

const BatchDetectTargetedSentiment: OperationHandler = (input, _ctx) => {
  const texts = getTextList(input);
  return {
    ResultList: texts.map((_t, i) => ({
      Index: i,
      Entities: [],
    })),
    ErrorList: [],
  };
};

const comprehend: ServiceDefinition = {
  name: "comprehend",
  protocol: "json",
  operations: {
    CreateEndpoint,
    DescribeEndpoint,
    ListEndpoints,
    DeleteEndpoint,
    UpdateEndpoint,
    CreateDocumentClassifier,
    DescribeDocumentClassifier,
    ListDocumentClassifiers,
    ListDocumentClassifierSummaries,
    DeleteDocumentClassifier,
    StopTrainingDocumentClassifier,
    ImportModel,
    CreateEntityRecognizer,
    DescribeEntityRecognizer,
    ListEntityRecognizers,
    ListEntityRecognizerSummaries,
    DeleteEntityRecognizer,
    StopTrainingEntityRecognizer,
    CreateFlywheel,
    DescribeFlywheel,
    ListFlywheels,
    DeleteFlywheel,
    UpdateFlywheel,
    StartFlywheelIteration,
    DescribeFlywheelIteration,
    ListFlywheelIterationHistory,
    CreateDataset,
    DescribeDataset,
    ListDatasets,
    PutResourcePolicy,
    DescribeResourcePolicy,
    DeleteResourcePolicy,
    TagResource,
    UntagResource,
    ListTagsForResource,
    StartDominantLanguageDetectionJob,
    DescribeDominantLanguageDetectionJob,
    ListDominantLanguageDetectionJobs,
    StopDominantLanguageDetectionJob,
    StartEntitiesDetectionJob,
    DescribeEntitiesDetectionJob,
    ListEntitiesDetectionJobs,
    StopEntitiesDetectionJob,
    StartEventsDetectionJob,
    DescribeEventsDetectionJob,
    ListEventsDetectionJobs,
    StopEventsDetectionJob,
    StartKeyPhrasesDetectionJob,
    DescribeKeyPhrasesDetectionJob,
    ListKeyPhrasesDetectionJobs,
    StopKeyPhrasesDetectionJob,
    StartPiiEntitiesDetectionJob,
    DescribePiiEntitiesDetectionJob,
    ListPiiEntitiesDetectionJobs,
    StopPiiEntitiesDetectionJob,
    StartSentimentDetectionJob,
    DescribeSentimentDetectionJob,
    ListSentimentDetectionJobs,
    StopSentimentDetectionJob,
    StartTargetedSentimentDetectionJob,
    DescribeTargetedSentimentDetectionJob,
    ListTargetedSentimentDetectionJobs,
    StopTargetedSentimentDetectionJob,
    StartTopicsDetectionJob,
    DescribeTopicsDetectionJob,
    ListTopicsDetectionJobs,
    StartDocumentClassificationJob,
    DescribeDocumentClassificationJob,
    ListDocumentClassificationJobs,
    DetectDominantLanguage,
    DetectEntities,
    DetectKeyPhrases,
    DetectPiiEntities,
    DetectSentiment,
    DetectSyntax,
    DetectTargetedSentiment,
    DetectToxicContent,
    ClassifyDocument,
    ContainsPiiEntities,
    BatchDetectDominantLanguage,
    BatchDetectEntities,
    BatchDetectKeyPhrases,
    BatchDetectSentiment,
    BatchDetectSyntax,
    BatchDetectTargetedSentiment,
  },
  model,
} as const satisfies ServiceDefinition;

export default comprehend;
