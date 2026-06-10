import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import kendraModel from "../../../../test/vendor/aws-models/kendra.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(kendraModel);

type StoredIndex = {
  Id: string;
  Name: string;
  RoleArn: string;
  Edition: string;
  Description: string;
  Status: string;
  CreatedAt: number;
  UpdatedAt: number;
};

type StoredDataSource = {
  Id: string;
  IndexId: string;
  Name: string;
  Type: string;
  Description: string;
  RoleArn: string;
  Status: string;
  CreatedAt: number;
  UpdatedAt: number;
};

type StoredFaq = {
  Id: string;
  IndexId: string;
  Name: string;
  Description: string;
  S3Path: unknown;
  RoleArn: string;
  Status: string;
  LanguageCode: string;
  FileFormat: string;
  CreatedAt: number;
  UpdatedAt: number;
};

type StoredExperience = {
  Id: string;
  IndexId: string;
  Name: string;
  Description: string;
  RoleArn: string;
  Status: string;
  Endpoints: { EndpointType: string; Endpoint: string }[];
  CreatedAt: number;
  UpdatedAt: number;
};

type StoredThesaurus = {
  Id: string;
  IndexId: string;
  Name: string;
  Description: string;
  RoleArn: string;
  Status: string;
  SourceS3Path: unknown;
  CreatedAt: number;
  UpdatedAt: number;
};

type StoredAccessControlConfiguration = {
  Id: string;
  IndexId: string;
  Name: string;
  Description: string;
  CreatedAt: number;
};

type StoredQuerySuggestionsBlockList = {
  Id: string;
  IndexId: string;
  Name: string;
  Description: string;
  Status: string;
  RoleArn: string;
  SourceS3Path: unknown;
  CreatedAt: number;
  UpdatedAt: number;
};

type StoredFeaturedResultsSet = {
  FeaturedResultsSetId: string;
  IndexId: string;
  FeaturedResultsSetName: string;
  Description: string;
  Status: string;
  QueryTexts: string[];
  FeaturedDocuments: unknown[];
  LastUpdatedTimestamp: number;
  CreationTimestamp: number;
};

type StoredSyncJob = {
  ExecutionId: string;
  DataSourceId: string;
  IndexId: string;
  StartTime: number;
  Status: string;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const requireIndex = (ctx: ServiceContext, id: string): StoredIndex => {
  const index = ctx.store.get<StoredIndex>(id);
  if (index === undefined) {
    throw awsError("ResourceNotFoundException", `Index ${id} not found.`, 404);
  }
  return index;
};

const dsKey = (indexId: string, id: string): string => `ds#${indexId}#${id}`;
const faqKey = (indexId: string, id: string): string => `faq#${indexId}#${id}`;
const expKey = (indexId: string, id: string): string => `exp#${indexId}#${id}`;
const thesKey = (indexId: string, id: string): string =>
  `thes#${indexId}#${id}`;
const accKey = (indexId: string, id: string): string => `acc#${indexId}#${id}`;
const qsblKey = (indexId: string, id: string): string =>
  `qsbl#${indexId}#${id}`;
const frsKey = (indexId: string, id: string): string => `frs#${indexId}#${id}`;
const tagKey = (arn: string): string => `tags#${arn}`;
const ctKey = (token: string): string => `ct#${token}`;
const qscKey = (indexId: string): string => `qsc#${indexId}`;

const indexArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:kendra:${ctx.region}:${ctx.account}:index/${id}`;
const dsArn = (ctx: ServiceContext, indexId: string, id: string): string =>
  `arn:aws:kendra:${ctx.region}:${ctx.account}:index/${indexId}/data-source/${id}`;
const faqArn = (ctx: ServiceContext, indexId: string, id: string): string =>
  `arn:aws:kendra:${ctx.region}:${ctx.account}:index/${indexId}/faq/${id}`;
const thesArn = (ctx: ServiceContext, indexId: string, id: string): string =>
  `arn:aws:kendra:${ctx.region}:${ctx.account}:index/${indexId}/thesaurus/${id}`;
const qsblArn = (ctx: ServiceContext, indexId: string, id: string): string =>
  `arn:aws:kendra:${ctx.region}:${ctx.account}:index/${indexId}/query-suggestions-block-list/${id}`;
const frsArn = (ctx: ServiceContext, indexId: string, id: string): string =>
  `arn:aws:kendra:${ctx.region}:${ctx.account}:index/${indexId}/featured-results-set/${id}`;

const saveTags = (
  ctx: ServiceContext,
  arn: string,
  tags: unknown,
): void => {
  if (!Array.isArray(tags) || tags.length === 0) return;
  ctx.store.set(tagKey(arn), tags);
};
const pmKey = (indexId: string, groupId: string): string =>
  `pm#${indexId}#${groupId}`;
const expEntitiesKey = (indexId: string, expId: string): string =>
  `expentities#${indexId}#${expId}`;
const expPersonasKey = (indexId: string, expId: string): string =>
  `exppersonas#${indexId}#${expId}`;
const syncJobKey = (indexId: string, dsId: string, execId: string): string =>
  `syncjob#${indexId}#${dsId}#${execId}`;
const docKey = (indexId: string, docId: string): string =>
  `doc#${indexId}#${docId}`;

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
): { items: T[]; nextToken: string | undefined } => {
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
  return { items: page, nextToken: newNextToken };
};

const CreateIndex: OperationHandler = (input, ctx) => {
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  if (clientToken) {
    const cached = ctx.store.get<{ Id: string }>(ctKey(clientToken));
    if (cached) return cached;
  }
  const name = requireString(input, "Name");
  const roleArn = requireString(input, "RoleArn");
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const edition =
    typeof input["Edition"] === "string"
      ? (input["Edition"] as string)
      : "ENTERPRISE_EDITION";
  const description =
    typeof input["Description"] === "string"
      ? (input["Description"] as string)
      : "";
  const index: StoredIndex = {
    Id: id,
    Name: name,
    RoleArn: roleArn,
    Edition: edition,
    Description: description,
    Status: "CREATING",
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(id, index);
  saveTags(ctx, indexArn(ctx, id), input["Tags"]);
  const result = { Id: id };
  if (clientToken) ctx.store.set(ctKey(clientToken), result);
  return result;
};

const DescribeIndex: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const index = requireIndex(ctx, id);
  let finalStatus = index.Status;
  if (index.Status === "CREATING") {
    finalStatus = "ACTIVE";
    ctx.store.set(id, { ...index, Status: "ACTIVE", UpdatedAt: nowSeconds() });
  } else if (index.Status === "DELETING") {
    ctx.store.delete(id);
  }
  return {
    Name: index.Name,
    Id: index.Id,
    Edition: index.Edition,
    RoleArn: index.RoleArn,
    Status: finalStatus,
    Description: index.Description,
    CreatedAt: index.CreatedAt,
    UpdatedAt: index.UpdatedAt,
  };
};

const ListIndices: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredIndex>()
    .filter(({ key }) => !key.includes("#"))
    .filter(({ value: index }) => index.Status !== "DELETING")
    .map(({ value: index }) => ({
      Name: index.Name,
      Id: index.Id,
      Edition: index.Edition,
      CreatedAt: index.CreatedAt,
      UpdatedAt: index.UpdatedAt,
      Status: index.Status,
    }));
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return {
    IndexConfigurationSummaryItems: items,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
};

const DeleteIndex: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const index = requireIndex(ctx, id);
  if (index.Status === "DELETING") {
    throw awsError("ConflictException", `Index ${id} is already being deleted.`, 409);
  }
  const arn = indexArn(ctx, id);
  ctx.store.delete(tagKey(arn));
  ctx.store.set(id, { ...index, Status: "DELETING", UpdatedAt: nowSeconds() });
  return {};
};

const UpdateIndex: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const index = requireIndex(ctx, id);
  const updated: StoredIndex = {
    ...index,
    Name: typeof input["Name"] === "string" ? input["Name"] : index.Name,
    Description:
      typeof input["Description"] === "string"
        ? input["Description"]
        : index.Description,
    RoleArn:
      typeof input["RoleArn"] === "string" ? input["RoleArn"] : index.RoleArn,
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(id, updated);
  return {};
};

const CreateDataSource: OperationHandler = (input, ctx) => {
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  if (clientToken) {
    const cached = ctx.store.get<{ Id: string; IndexId: string }>(ctKey(clientToken));
    if (cached) return cached;
  }
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const name = requireString(input, "Name");
  const type = requireString(input, "Type");
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const ds: StoredDataSource = {
    Id: id,
    IndexId: indexId,
    Name: name,
    Type: type,
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    RoleArn: typeof input["RoleArn"] === "string" ? input["RoleArn"] : "",
    Status: "CREATING",
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(dsKey(indexId, id), ds);
  saveTags(ctx, dsArn(ctx, indexId, id), input["Tags"]);
  const result = { Id: id, IndexId: indexId };
  if (clientToken) ctx.store.set(ctKey(clientToken), result);
  return result;
};

const DescribeDataSource: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const ds = ctx.store.get<StoredDataSource>(dsKey(indexId, id));
  if (!ds) {
    throw awsError(
      "ResourceNotFoundException",
      `DataSource ${id} not found.`,
      404,
    );
  }
  let finalStatus = ds.Status;
  if (ds.Status === "CREATING") {
    finalStatus = "ACTIVE";
    ctx.store.set(dsKey(indexId, id), { ...ds, Status: "ACTIVE", UpdatedAt: nowSeconds() });
  } else if (ds.Status === "DELETING") {
    ctx.store.delete(dsKey(indexId, id));
  }
  return {
    Id: ds.Id,
    IndexId: ds.IndexId,
    Name: ds.Name,
    Type: ds.Type,
    Description: ds.Description,
    RoleArn: ds.RoleArn,
    Status: finalStatus,
    CreatedAt: ds.CreatedAt,
    UpdatedAt: ds.UpdatedAt,
  };
};

const ListDataSources: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const prefix = `ds#${indexId}#`;
  const all = ctx.store
    .list<StoredDataSource>()
    .filter(({ key }) => key.startsWith(prefix))
    .filter(({ value: ds }) => ds.Status !== "DELETING")
    .map(({ value: ds }) => ({
      Id: ds.Id,
      Name: ds.Name,
      Type: ds.Type,
      Status: ds.Status,
      CreatedAt: ds.CreatedAt,
      UpdatedAt: ds.UpdatedAt,
    }));
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return {
    SummaryItems: items,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
};

const UpdateDataSource: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const ds = ctx.store.get<StoredDataSource>(dsKey(indexId, id));
  if (!ds) {
    throw awsError(
      "ResourceNotFoundException",
      `DataSource ${id} not found.`,
      404,
    );
  }
  const updated: StoredDataSource = {
    ...ds,
    Name: typeof input["Name"] === "string" ? input["Name"] : ds.Name,
    Description:
      typeof input["Description"] === "string"
        ? input["Description"]
        : ds.Description,
    RoleArn:
      typeof input["RoleArn"] === "string" ? input["RoleArn"] : ds.RoleArn,
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(dsKey(indexId, id), updated);
  return {};
};

const DeleteDataSource: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const ds = ctx.store.get<StoredDataSource>(dsKey(indexId, id));
  if (!ds) {
    throw awsError(
      "ResourceNotFoundException",
      `DataSource ${id} not found.`,
      404,
    );
  }
  if (ds.Status === "DELETING") {
    throw awsError("ConflictException", `DataSource ${id} is already being deleted.`, 409);
  }
  const arn = dsArn(ctx, indexId, id);
  ctx.store.delete(tagKey(arn));
  ctx.store.set(dsKey(indexId, id), { ...ds, Status: "DELETING", UpdatedAt: nowSeconds() });
  return {};
};

const StartDataSourceSyncJob: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const ds = ctx.store.get<StoredDataSource>(dsKey(indexId, id));
  if (!ds) {
    throw awsError(
      "ResourceNotFoundException",
      `DataSource ${id} not found.`,
      404,
    );
  }
  const execId = crypto.randomUUID();
  const job: StoredSyncJob = {
    ExecutionId: execId,
    DataSourceId: id,
    IndexId: indexId,
    StartTime: nowSeconds(),
    Status: "SYNCING",
  };
  ctx.store.set(syncJobKey(indexId, id, execId), job);
  return { ExecutionId: execId };
};

const StopDataSourceSyncJob: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const prefix = `syncjob#${indexId}#${id}#`;
  const running = ctx.store
    .list<StoredSyncJob>()
    .filter(({ key }) => key.startsWith(prefix))
    .find(({ value }) => value.Status === "SYNCING");
  if (!running) {
    throw awsError(
      "ResourceNotFoundException",
      `No active sync job for DataSource ${id}.`,
      404,
    );
  }
  ctx.store.set(running.key, { ...running.value, Status: "STOPPING" });
  return {};
};

const ListDataSourceSyncJobs: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const prefix = `syncjob#${indexId}#${id}#`;
  const entries = ctx.store
    .list<StoredSyncJob>()
    .filter(({ key }) => key.startsWith(prefix));
  return {
    History: entries.map(({ value: job }) => ({
      ExecutionId: job.ExecutionId,
      StartTime: job.StartTime,
      Status: job.Status,
    })),
  };
};

const CreateFaq: OperationHandler = (input, ctx) => {
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  if (clientToken) {
    const cached = ctx.store.get<{ Id: string }>(ctKey(clientToken));
    if (cached) return cached;
  }
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const faq: StoredFaq = {
    Id: id,
    IndexId: indexId,
    Name: name,
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    S3Path: input["S3Path"] ?? null,
    RoleArn: typeof input["RoleArn"] === "string" ? input["RoleArn"] : "",
    Status: "CREATING",
    LanguageCode:
      typeof input["LanguageCode"] === "string" ? input["LanguageCode"] : "en",
    FileFormat:
      typeof input["FileFormat"] === "string" ? input["FileFormat"] : "CSV",
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(faqKey(indexId, id), faq);
  saveTags(ctx, faqArn(ctx, indexId, id), input["Tags"]);
  const result = { Id: id };
  if (clientToken) ctx.store.set(ctKey(clientToken), result);
  return result;
};

const DescribeFaq: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const faq = ctx.store.get<StoredFaq>(faqKey(indexId, id));
  if (!faq) {
    throw awsError("ResourceNotFoundException", `FAQ ${id} not found.`, 404);
  }
  let finalStatus = faq.Status;
  if (faq.Status === "CREATING") {
    finalStatus = "ACTIVE";
    ctx.store.set(faqKey(indexId, id), { ...faq, Status: "ACTIVE", UpdatedAt: nowSeconds() });
  } else if (faq.Status === "DELETING") {
    ctx.store.delete(faqKey(indexId, id));
  }
  return {
    Id: faq.Id,
    IndexId: faq.IndexId,
    Name: faq.Name,
    Description: faq.Description,
    S3Path: faq.S3Path,
    RoleArn: faq.RoleArn,
    Status: finalStatus,
    LanguageCode: faq.LanguageCode,
    FileFormat: faq.FileFormat,
    CreatedAt: faq.CreatedAt,
    UpdatedAt: faq.UpdatedAt,
  };
};

const ListFaqs: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const prefix = `faq#${indexId}#`;
  const all = ctx.store
    .list<StoredFaq>()
    .filter(({ key }) => key.startsWith(prefix))
    .filter(({ value: faq }) => faq.Status !== "DELETING")
    .map(({ value: faq }) => ({
      Id: faq.Id,
      Name: faq.Name,
      Status: faq.Status,
      CreatedAt: faq.CreatedAt,
      UpdatedAt: faq.UpdatedAt,
      FileFormat: faq.FileFormat,
      LanguageCode: faq.LanguageCode,
    }));
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return {
    FaqSummaryItems: items,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
};

const DeleteFaq: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const faq = ctx.store.get<StoredFaq>(faqKey(indexId, id));
  if (!faq) {
    throw awsError("ResourceNotFoundException", `FAQ ${id} not found.`, 404);
  }
  if (faq.Status === "DELETING") {
    throw awsError("ConflictException", `FAQ ${id} is already being deleted.`, 409);
  }
  const arn = faqArn(ctx, indexId, id);
  ctx.store.delete(tagKey(arn));
  ctx.store.set(faqKey(indexId, id), { ...faq, Status: "DELETING", UpdatedAt: nowSeconds() });
  return {};
};

const CreateExperience: OperationHandler = (input, ctx) => {
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  if (clientToken) {
    const cached = ctx.store.get<{ Id: string; IndexId: string }>(ctKey(clientToken));
    if (cached) return cached;
  }
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const exp: StoredExperience = {
    Id: id,
    IndexId: indexId,
    Name: name,
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    RoleArn: typeof input["RoleArn"] === "string" ? input["RoleArn"] : "",
    Status: "CREATING",
    Endpoints: [
      {
        EndpointType: "HOME",
        Endpoint: `https://${id}.kendra.${ctx.region}.amazonaws.com`,
      },
    ],
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(expKey(indexId, id), exp);
  const result = { Id: id, IndexId: indexId };
  if (clientToken) ctx.store.set(ctKey(clientToken), result);
  return result;
};

const DescribeExperience: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const exp = ctx.store.get<StoredExperience>(expKey(indexId, id));
  if (!exp) {
    throw awsError(
      "ResourceNotFoundException",
      `Experience ${id} not found.`,
      404,
    );
  }
  let finalStatus = exp.Status;
  if (exp.Status === "CREATING") {
    finalStatus = "ACTIVE";
    ctx.store.set(expKey(indexId, id), { ...exp, Status: "ACTIVE", UpdatedAt: nowSeconds() });
  } else if (exp.Status === "DELETING") {
    ctx.store.delete(expKey(indexId, id));
  }
  return {
    Id: exp.Id,
    IndexId: exp.IndexId,
    Name: exp.Name,
    Description: exp.Description,
    RoleArn: exp.RoleArn,
    Status: finalStatus,
    Endpoints: exp.Endpoints,
    CreatedAt: exp.CreatedAt,
    UpdatedAt: exp.UpdatedAt,
  };
};

const ListExperiences: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const prefix = `exp#${indexId}#`;
  const all = ctx.store
    .list<StoredExperience>()
    .filter(({ key }) => key.startsWith(prefix))
    .filter(({ value: exp }) => exp.Status !== "DELETING")
    .map(({ value: exp }) => ({
      Id: exp.Id,
      Name: exp.Name,
      Status: exp.Status,
      CreatedAt: exp.CreatedAt,
      Endpoints: exp.Endpoints,
    }));
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return {
    SummaryItems: items,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
};

const UpdateExperience: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const exp = ctx.store.get<StoredExperience>(expKey(indexId, id));
  if (!exp) {
    throw awsError(
      "ResourceNotFoundException",
      `Experience ${id} not found.`,
      404,
    );
  }
  const updated: StoredExperience = {
    ...exp,
    Name: typeof input["Name"] === "string" ? input["Name"] : exp.Name,
    Description:
      typeof input["Description"] === "string"
        ? input["Description"]
        : exp.Description,
    RoleArn:
      typeof input["RoleArn"] === "string" ? input["RoleArn"] : exp.RoleArn,
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(expKey(indexId, id), updated);
  return {};
};

const DeleteExperience: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const exp = ctx.store.get<StoredExperience>(expKey(indexId, id));
  if (!exp) {
    throw awsError(
      "ResourceNotFoundException",
      `Experience ${id} not found.`,
      404,
    );
  }
  if (exp.Status === "DELETING") {
    throw awsError("ConflictException", `Experience ${id} is already being deleted.`, 409);
  }
  ctx.store.set(expKey(indexId, id), { ...exp, Status: "DELETING", UpdatedAt: nowSeconds() });
  return {};
};

const AssociateEntitiesToExperience: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const exp = ctx.store.get<StoredExperience>(expKey(indexId, id));
  if (!exp) {
    throw awsError(
      "ResourceNotFoundException",
      `Experience ${id} not found.`,
      404,
    );
  }
  const entities = Array.isArray(input["EntityList"])
    ? input["EntityList"]
    : [];
  const key = expEntitiesKey(indexId, id);
  const existing = ctx.store.get<unknown[]>(key) ?? [];
  ctx.store.set(key, [...existing, ...entities]);
  return { FailedEntityList: [] };
};

const DisassociateEntitiesFromExperience: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const exp = ctx.store.get<StoredExperience>(expKey(indexId, id));
  if (!exp) {
    throw awsError(
      "ResourceNotFoundException",
      `Experience ${id} not found.`,
      404,
    );
  }
  const toRemove = Array.isArray(input["EntityList"])
    ? (input["EntityList"] as { EntityId?: string }[])
        .map((e) => e.EntityId)
        .filter((id): id is string => typeof id === "string")
    : [];
  const key = expEntitiesKey(indexId, id);
  const existing = ctx.store.get<{ EntityId?: string }[]>(key) ?? [];
  ctx.store.set(
    key,
    existing.filter((e) => !toRemove.includes(e.EntityId ?? "")),
  );
  return { FailedEntityList: [] };
};

const ListExperienceEntities: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const exp = ctx.store.get<StoredExperience>(expKey(indexId, id));
  if (!exp) {
    throw awsError(
      "ResourceNotFoundException",
      `Experience ${id} not found.`,
      404,
    );
  }
  const key = expEntitiesKey(indexId, id);
  const entities = ctx.store.get<unknown[]>(key) ?? [];
  return { SummaryItems: entities };
};

const AssociatePersonasToEntities: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const exp = ctx.store.get<StoredExperience>(expKey(indexId, id));
  if (!exp) {
    throw awsError(
      "ResourceNotFoundException",
      `Experience ${id} not found.`,
      404,
    );
  }
  const personas = Array.isArray(input["Personas"]) ? input["Personas"] : [];
  const key = expPersonasKey(indexId, id);
  ctx.store.set(key, personas);
  return { FailedEntityList: [] };
};

const DisassociatePersonasFromEntities: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const exp = ctx.store.get<StoredExperience>(expKey(indexId, id));
  if (!exp) {
    throw awsError(
      "ResourceNotFoundException",
      `Experience ${id} not found.`,
      404,
    );
  }
  const toRemove = Array.isArray(input["EntityIds"])
    ? (input["EntityIds"] as string[])
    : [];
  const key = expPersonasKey(indexId, id);
  const existing = ctx.store.get<{ EntityId?: string }[]>(key) ?? [];
  ctx.store.set(
    key,
    existing.filter((p) => !toRemove.includes(p.EntityId ?? "")),
  );
  return { FailedEntityList: [] };
};

const ListEntityPersonas: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const exp = ctx.store.get<StoredExperience>(expKey(indexId, id));
  if (!exp) {
    throw awsError(
      "ResourceNotFoundException",
      `Experience ${id} not found.`,
      404,
    );
  }
  const key = expPersonasKey(indexId, id);
  const personas = ctx.store.get<unknown[]>(key) ?? [];
  return { SummaryItems: personas };
};

const CreateThesaurus: OperationHandler = (input, ctx) => {
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  if (clientToken) {
    const cached = ctx.store.get<{ Id: string }>(ctKey(clientToken));
    if (cached) return cached;
  }
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const thes: StoredThesaurus = {
    Id: id,
    IndexId: indexId,
    Name: name,
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    RoleArn: typeof input["RoleArn"] === "string" ? input["RoleArn"] : "",
    Status: "CREATING",
    SourceS3Path: input["SourceS3Path"] ?? null,
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(thesKey(indexId, id), thes);
  saveTags(ctx, thesArn(ctx, indexId, id), input["Tags"]);
  const result = { Id: id };
  if (clientToken) ctx.store.set(ctKey(clientToken), result);
  return result;
};

const DescribeThesaurus: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const thes = ctx.store.get<StoredThesaurus>(thesKey(indexId, id));
  if (!thes) {
    throw awsError(
      "ResourceNotFoundException",
      `Thesaurus ${id} not found.`,
      404,
    );
  }
  let finalStatus = thes.Status;
  if (thes.Status === "CREATING") {
    finalStatus = "ACTIVE";
    ctx.store.set(thesKey(indexId, id), { ...thes, Status: "ACTIVE", UpdatedAt: nowSeconds() });
  } else if (thes.Status === "DELETING") {
    ctx.store.delete(thesKey(indexId, id));
  }
  return {
    Id: thes.Id,
    IndexId: thes.IndexId,
    Name: thes.Name,
    Description: thes.Description,
    RoleArn: thes.RoleArn,
    Status: finalStatus,
    SourceS3Path: thes.SourceS3Path,
    CreatedAt: thes.CreatedAt,
    UpdatedAt: thes.UpdatedAt,
  };
};

const ListThesauri: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const prefix = `thes#${indexId}#`;
  const all = ctx.store
    .list<StoredThesaurus>()
    .filter(({ key }) => key.startsWith(prefix))
    .filter(({ value: thes }) => thes.Status !== "DELETING")
    .map(({ value: thes }) => ({
      Id: thes.Id,
      Name: thes.Name,
      Status: thes.Status,
      CreatedAt: thes.CreatedAt,
      UpdatedAt: thes.UpdatedAt,
    }));
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return {
    ThesaurusSummaryItems: items,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
};

const UpdateThesaurus: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const thes = ctx.store.get<StoredThesaurus>(thesKey(indexId, id));
  if (!thes) {
    throw awsError(
      "ResourceNotFoundException",
      `Thesaurus ${id} not found.`,
      404,
    );
  }
  const updated: StoredThesaurus = {
    ...thes,
    Name: typeof input["Name"] === "string" ? input["Name"] : thes.Name,
    Description:
      typeof input["Description"] === "string"
        ? input["Description"]
        : thes.Description,
    RoleArn:
      typeof input["RoleArn"] === "string" ? input["RoleArn"] : thes.RoleArn,
    SourceS3Path: input["SourceS3Path"] ?? thes.SourceS3Path,
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(thesKey(indexId, id), updated);
  return {};
};

const DeleteThesaurus: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const thes = ctx.store.get<StoredThesaurus>(thesKey(indexId, id));
  if (!thes) {
    throw awsError(
      "ResourceNotFoundException",
      `Thesaurus ${id} not found.`,
      404,
    );
  }
  if (thes.Status === "DELETING") {
    throw awsError("ConflictException", `Thesaurus ${id} is already being deleted.`, 409);
  }
  const arn = thesArn(ctx, indexId, id);
  ctx.store.delete(tagKey(arn));
  ctx.store.set(thesKey(indexId, id), { ...thes, Status: "DELETING", UpdatedAt: nowSeconds() });
  return {};
};

const CreateAccessControlConfiguration: OperationHandler = (input, ctx) => {
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  if (clientToken) {
    const cached = ctx.store.get<{ Id: string }>(ctKey(clientToken));
    if (cached) return cached;
  }
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const acc: StoredAccessControlConfiguration = {
    Id: id,
    IndexId: indexId,
    Name: name,
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    CreatedAt: now,
  };
  ctx.store.set(accKey(indexId, id), acc);
  const result = { Id: id };
  if (clientToken) ctx.store.set(ctKey(clientToken), result);
  return result;
};

const DescribeAccessControlConfiguration: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const acc = ctx.store.get<StoredAccessControlConfiguration>(
    accKey(indexId, id),
  );
  if (!acc) {
    throw awsError(
      "ResourceNotFoundException",
      `AccessControlConfiguration ${id} not found.`,
      404,
    );
  }
  return {
    Id: acc.Id,
    Name: acc.Name,
    Description: acc.Description,
  };
};

const ListAccessControlConfigurations: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const prefix = `acc#${indexId}#`;
  const all = ctx.store
    .list<StoredAccessControlConfiguration>()
    .filter(({ key }) => key.startsWith(prefix))
    .map(({ value: acc }) => ({ Id: acc.Id }));
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return {
    AccessControlConfigurations: items,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
};

const UpdateAccessControlConfiguration: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const acc = ctx.store.get<StoredAccessControlConfiguration>(
    accKey(indexId, id),
  );
  if (!acc) {
    throw awsError(
      "ResourceNotFoundException",
      `AccessControlConfiguration ${id} not found.`,
      404,
    );
  }
  const updated: StoredAccessControlConfiguration = {
    ...acc,
    Name: typeof input["Name"] === "string" ? input["Name"] : acc.Name,
    Description:
      typeof input["Description"] === "string"
        ? input["Description"]
        : acc.Description,
  };
  ctx.store.set(accKey(indexId, id), updated);
  return {};
};

const DeleteAccessControlConfiguration: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const acc = ctx.store.get<StoredAccessControlConfiguration>(
    accKey(indexId, id),
  );
  if (!acc) {
    throw awsError(
      "ResourceNotFoundException",
      `AccessControlConfiguration ${id} not found.`,
      404,
    );
  }
  ctx.store.delete(accKey(indexId, id));
  return {};
};

const CreateQuerySuggestionsBlockList: OperationHandler = (input, ctx) => {
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  if (clientToken) {
    const cached = ctx.store.get<{ Id: string }>(ctKey(clientToken));
    if (cached) return cached;
  }
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const qsbl: StoredQuerySuggestionsBlockList = {
    Id: id,
    IndexId: indexId,
    Name: name,
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    Status: "CREATING",
    RoleArn: typeof input["RoleArn"] === "string" ? input["RoleArn"] : "",
    SourceS3Path: input["SourceS3Path"] ?? null,
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(qsblKey(indexId, id), qsbl);
  saveTags(ctx, qsblArn(ctx, indexId, id), input["Tags"]);
  const result = { Id: id };
  if (clientToken) ctx.store.set(ctKey(clientToken), result);
  return result;
};

const DescribeQuerySuggestionsBlockList: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const qsbl = ctx.store.get<StoredQuerySuggestionsBlockList>(
    qsblKey(indexId, id),
  );
  if (!qsbl) {
    throw awsError(
      "ResourceNotFoundException",
      `QuerySuggestionsBlockList ${id} not found.`,
      404,
    );
  }
  let finalStatus = qsbl.Status;
  if (qsbl.Status === "CREATING") {
    finalStatus = "ACTIVE";
    ctx.store.set(qsblKey(indexId, id), { ...qsbl, Status: "ACTIVE", UpdatedAt: nowSeconds() });
  } else if (qsbl.Status === "DELETING") {
    ctx.store.delete(qsblKey(indexId, id));
  }
  return {
    IndexId: qsbl.IndexId,
    Id: qsbl.Id,
    Name: qsbl.Name,
    Description: qsbl.Description,
    Status: finalStatus,
    RoleArn: qsbl.RoleArn,
    SourceS3Path: qsbl.SourceS3Path,
    CreatedAt: qsbl.CreatedAt,
    UpdatedAt: qsbl.UpdatedAt,
  };
};

const ListQuerySuggestionsBlockLists: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const prefix = `qsbl#${indexId}#`;
  const entries = ctx.store
    .list<StoredQuerySuggestionsBlockList>()
    .filter(({ key }) => key.startsWith(prefix))
    .filter(({ value: qsbl }) => qsbl.Status !== "DELETING");
  return {
    BlockListSummaryItems: entries.map(({ value: qsbl }) => ({
      Id: qsbl.Id,
      Name: qsbl.Name,
      Status: qsbl.Status,
      CreatedAt: qsbl.CreatedAt,
      UpdatedAt: qsbl.UpdatedAt,
    })),
  };
};

const UpdateQuerySuggestionsBlockList: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const qsbl = ctx.store.get<StoredQuerySuggestionsBlockList>(
    qsblKey(indexId, id),
  );
  if (!qsbl) {
    throw awsError(
      "ResourceNotFoundException",
      `QuerySuggestionsBlockList ${id} not found.`,
      404,
    );
  }
  const updated: StoredQuerySuggestionsBlockList = {
    ...qsbl,
    Name: typeof input["Name"] === "string" ? input["Name"] : qsbl.Name,
    Description:
      typeof input["Description"] === "string"
        ? input["Description"]
        : qsbl.Description,
    RoleArn:
      typeof input["RoleArn"] === "string" ? input["RoleArn"] : qsbl.RoleArn,
    SourceS3Path: input["SourceS3Path"] ?? qsbl.SourceS3Path,
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(qsblKey(indexId, id), updated);
  return {};
};

const DeleteQuerySuggestionsBlockList: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "Id");
  const qsbl = ctx.store.get<StoredQuerySuggestionsBlockList>(
    qsblKey(indexId, id),
  );
  if (!qsbl) {
    throw awsError(
      "ResourceNotFoundException",
      `QuerySuggestionsBlockList ${id} not found.`,
      404,
    );
  }
  if (qsbl.Status === "DELETING") {
    throw awsError("ConflictException", `QuerySuggestionsBlockList ${id} is already being deleted.`, 409);
  }
  const arn = qsblArn(ctx, indexId, id);
  ctx.store.delete(tagKey(arn));
  ctx.store.set(qsblKey(indexId, id), { ...qsbl, Status: "DELETING", UpdatedAt: nowSeconds() });
  return {};
};

const CreateFeaturedResultsSet: OperationHandler = (input, ctx) => {
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  if (clientToken) {
    const cached = ctx.store.get<{ FeaturedResultsSet: unknown }>(ctKey(clientToken));
    if (cached) return cached;
  }
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const name = requireString(input, "FeaturedResultsSetName");
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const frs: StoredFeaturedResultsSet = {
    FeaturedResultsSetId: id,
    IndexId: indexId,
    FeaturedResultsSetName: name,
    Description:
      typeof input["Description"] === "string" ? input["Description"] : "",
    Status: typeof input["Status"] === "string" ? input["Status"] : "ACTIVE",
    QueryTexts: Array.isArray(input["QueryTexts"])
      ? (input["QueryTexts"] as string[])
      : [],
    FeaturedDocuments: Array.isArray(input["FeaturedDocuments"])
      ? input["FeaturedDocuments"]
      : [],
    LastUpdatedTimestamp: now,
    CreationTimestamp: now,
  };
  ctx.store.set(frsKey(indexId, id), frs);
  saveTags(ctx, frsArn(ctx, indexId, id), input["Tags"]);
  const result = {
    FeaturedResultsSet: {
      FeaturedResultsSetId: id,
      FeaturedResultsSetName: name,
      Status: frs.Status,
      QueryTexts: frs.QueryTexts,
      FeaturedDocuments: frs.FeaturedDocuments,
      LastUpdatedTimestamp: now,
      CreationTimestamp: now,
    },
  };
  if (clientToken) ctx.store.set(ctKey(clientToken), result);
  return result;
};

const DescribeFeaturedResultsSet: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "FeaturedResultsSetId");
  const frs = ctx.store.get<StoredFeaturedResultsSet>(frsKey(indexId, id));
  if (!frs) {
    throw awsError(
      "ResourceNotFoundException",
      `FeaturedResultsSet ${id} not found.`,
      404,
    );
  }
  return {
    FeaturedResultsSetId: frs.FeaturedResultsSetId,
    FeaturedResultsSetName: frs.FeaturedResultsSetName,
    Description: frs.Description,
    Status: frs.Status,
    QueryTexts: frs.QueryTexts,
    FeaturedDocuments: frs.FeaturedDocuments,
    LastUpdatedTimestamp: frs.LastUpdatedTimestamp,
    CreationTimestamp: frs.CreationTimestamp,
  };
};

const ListFeaturedResultsSets: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const prefix = `frs#${indexId}#`;
  const entries = ctx.store
    .list<StoredFeaturedResultsSet>()
    .filter(({ key }) => key.startsWith(prefix));
  return {
    FeaturedResultsSetSummaryItems: entries.map(({ value: frs }) => ({
      FeaturedResultsSetId: frs.FeaturedResultsSetId,
      FeaturedResultsSetName: frs.FeaturedResultsSetName,
      Status: frs.Status,
      LastUpdatedTimestamp: frs.LastUpdatedTimestamp,
      CreationTimestamp: frs.CreationTimestamp,
    })),
  };
};

const UpdateFeaturedResultsSet: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const id = requireString(input, "FeaturedResultsSetId");
  const frs = ctx.store.get<StoredFeaturedResultsSet>(frsKey(indexId, id));
  if (!frs) {
    throw awsError(
      "ResourceNotFoundException",
      `FeaturedResultsSet ${id} not found.`,
      404,
    );
  }
  const updated: StoredFeaturedResultsSet = {
    ...frs,
    FeaturedResultsSetName:
      typeof input["FeaturedResultsSetName"] === "string"
        ? input["FeaturedResultsSetName"]
        : frs.FeaturedResultsSetName,
    Description:
      typeof input["Description"] === "string"
        ? input["Description"]
        : frs.Description,
    Status: typeof input["Status"] === "string" ? input["Status"] : frs.Status,
    QueryTexts: Array.isArray(input["QueryTexts"])
      ? (input["QueryTexts"] as string[])
      : frs.QueryTexts,
    FeaturedDocuments: Array.isArray(input["FeaturedDocuments"])
      ? input["FeaturedDocuments"]
      : frs.FeaturedDocuments,
    LastUpdatedTimestamp: nowSeconds(),
  };
  ctx.store.set(frsKey(indexId, id), updated);
  return {
    FeaturedResultsSet: {
      FeaturedResultsSetId: updated.FeaturedResultsSetId,
      FeaturedResultsSetName: updated.FeaturedResultsSetName,
      Status: updated.Status,
      QueryTexts: updated.QueryTexts,
      FeaturedDocuments: updated.FeaturedDocuments,
      LastUpdatedTimestamp: updated.LastUpdatedTimestamp,
      CreationTimestamp: updated.CreationTimestamp,
    },
  };
};

const BatchDeleteFeaturedResultsSet: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const ids = Array.isArray(input["FeaturedResultsSetIds"])
    ? (input["FeaturedResultsSetIds"] as string[])
    : [];
  const errors: unknown[] = [];
  for (const id of ids) {
    const frs = ctx.store.get<StoredFeaturedResultsSet>(frsKey(indexId, id));
    if (!frs) {
      errors.push({
        Id: id,
        ErrorCode: "NOT_FOUND",
        ErrorMessage: `FeaturedResultsSet ${id} not found.`,
      });
    } else {
      ctx.store.delete(frsKey(indexId, id));
    }
  }
  return { Errors: errors };
};

const PutPrincipalMapping: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const groupId = requireString(input, "GroupId");
  ctx.store.set(pmKey(indexId, groupId), {
    IndexId: indexId,
    GroupId: groupId,
    GroupMembers: input["GroupMembers"] ?? {},
    OrderingId:
      typeof input["OrderingId"] === "number"
        ? input["OrderingId"]
        : nowSeconds(),
    RoleArn: input["RoleArn"] ?? "",
    Status: "PROCESSING",
  });
  return {};
};

const DescribePrincipalMapping: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const groupId = requireString(input, "GroupId");
  const pm = ctx.store.get<Record<string, unknown>>(pmKey(indexId, groupId));
  if (!pm) {
    throw awsError(
      "ResourceNotFoundException",
      `Group ${groupId} not found.`,
      404,
    );
  }
  return {
    IndexId: pm["IndexId"],
    GroupId: pm["GroupId"],
    GroupOrderingIdSummaries: [
      {
        OrderingId: pm["OrderingId"],
        LastUpdatedAt: nowSeconds(),
        ReceivedAt: nowSeconds(),
        Status: pm["Status"],
      },
    ],
  };
};

const DeletePrincipalMapping: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const groupId = requireString(input, "GroupId");
  ctx.store.delete(pmKey(indexId, groupId));
  return {};
};

const ListGroupsOlderThanOrderingId: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  const orderingId =
    typeof input["OrderingId"] === "number" ? input["OrderingId"] : 0;
  const prefix = `pm#${indexId}#`;
  const entries = ctx.store
    .list<Record<string, unknown>>()
    .filter(({ key }) => key.startsWith(prefix))
    .filter(
      ({ value }) =>
        typeof value["OrderingId"] === "number" &&
        (value["OrderingId"] as number) < orderingId,
    );
  return {
    GroupsSummaries: entries.map(({ value }) => ({
      GroupId: value["GroupId"],
      OrderingId: value["OrderingId"],
    })),
  };
};

const DescribeQuerySuggestionsConfig: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const config = ctx.store.get<Record<string, unknown>>(qscKey(indexId)) ?? {
    Mode: "ENABLED",
    Status: "ACTIVE",
    QueryLogLookBackWindowInDays: 180,
    IncludeQueriesWithoutUserInformation: false,
    MinimumNumberOfQueryingUsers: 10,
    MinimumQueryCount: 3,
    TotalSuggestionsCount: 0,
    LastSuggestionsBuildTime: nowSeconds(),
    LastClearTime: nowSeconds(),
  };
  return config;
};

const UpdateQuerySuggestionsConfig: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const existing =
    ctx.store.get<Record<string, unknown>>(qscKey(indexId)) ?? {};
  const updated = {
    ...existing,
    ...(typeof input["Mode"] === "string" ? { Mode: input["Mode"] } : {}),
    ...(typeof input["QueryLogLookBackWindowInDays"] === "number"
      ? { QueryLogLookBackWindowInDays: input["QueryLogLookBackWindowInDays"] }
      : {}),
    ...(typeof input["IncludeQueriesWithoutUserInformation"] === "boolean"
      ? {
          IncludeQueriesWithoutUserInformation:
            input["IncludeQueriesWithoutUserInformation"],
        }
      : {}),
    ...(typeof input["MinimumNumberOfQueryingUsers"] === "number"
      ? { MinimumNumberOfQueryingUsers: input["MinimumNumberOfQueryingUsers"] }
      : {}),
    ...(typeof input["MinimumQueryCount"] === "number"
      ? { MinimumQueryCount: input["MinimumQueryCount"] }
      : {}),
  };
  ctx.store.set(qscKey(indexId), updated);
  return {};
};

const ClearQuerySuggestions: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  return {};
};

const GetQuerySuggestions: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const config = ctx.store.get<Record<string, unknown>>(qscKey(indexId)) ?? {};
  const mode = typeof config["Mode"] === "string" ? config["Mode"] : "ENABLED";
  const minCount =
    typeof config["MinimumQueryCount"] === "number"
      ? config["MinimumQueryCount"]
      : 3;
  const queryText =
    typeof input["QueryText"] === "string" ? input["QueryText"] : "";
  if (mode !== "ENABLED" || queryText.length < minCount) {
    return { QuerySuggestionsId: crypto.randomUUID(), Suggestions: [] };
  }
  return {
    QuerySuggestionsId: crypto.randomUUID(),
    Suggestions: [
      {
        Id: crypto.randomUUID(),
        Value: {
          Text: { Text: `${queryText} suggestion`, Highlights: [] },
        },
      },
    ],
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const newTags = Array.isArray(input["Tags"])
    ? (input["Tags"] as { Key: string; Value: string }[])
    : [];
  const key = tagKey(arn);
  const existing = ctx.store.get<{ Key: string; Value: string }[]>(key) ?? [];
  const newKeys = new Set(newTags.map((t) => t.Key));
  ctx.store.set(key, [
    ...existing.filter((t) => !newKeys.has(t.Key)),
    ...newTags,
  ]);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[])
    : [];
  const key = tagKey(arn);
  const existing = ctx.store.get<{ Key: string; Value: string }[]>(key) ?? [];
  ctx.store.set(
    key,
    existing.filter((t) => !tagKeys.includes(t.Key)),
  );
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const key = tagKey(arn);
  const tags = ctx.store.get<unknown[]>(key) ?? [];
  return { Tags: tags };
};

const BatchPutDocument: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const docs = Array.isArray(input["Documents"])
    ? (input["Documents"] as Record<string, unknown>[])
    : [];
  const failed: { Id: string; ErrorCode: string; ErrorMessage: string }[] = [];
  for (const d of docs) {
    if (
      typeof d !== "object" ||
      d === null ||
      typeof d["Id"] !== "string" ||
      d["Id"] === ""
    ) {
      failed.push({
        Id: typeof d?.["Id"] === "string" ? d["Id"] : "",
        ErrorCode: "INVALID_REQUEST",
        ErrorMessage: "Missing Id",
      });
    } else {
      ctx.store.set(docKey(indexId, d["Id"] as string), {
        DocumentId: d["Id"],
        DocumentStatus: "INDEXED",
      });
    }
  }
  return { FailedDocuments: failed };
};

const BatchDeleteDocument: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const ids = Array.isArray(input["DocumentIdList"])
    ? (input["DocumentIdList"] as string[])
    : [];
  for (const id of ids) {
    ctx.store.delete(docKey(indexId, id));
  }
  return { FailedDocuments: [] };
};

const BatchGetDocumentStatus: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  const refs = Array.isArray(input["DocumentInfoList"])
    ? input["DocumentInfoList"]
    : [];
  return {
    Failures: [],
    DocumentStatusList: refs.map((ref: unknown) => {
      const docId = (ref as Record<string, unknown>)?.["DocumentId"] ?? "";
      const stored = ctx.store.get<{ DocumentStatus: string }>(
        docKey(indexId, docId as string),
      );
      return {
        DocumentId: docId,
        DocumentStatus: stored ? stored.DocumentStatus : "NOT_FOUND",
      };
    }),
  };
};

const Query: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  return {
    QueryId: crypto.randomUUID(),
    ResultItems: [],
    FacetResults: [],
    TotalNumberOfResults: 0,
  };
};

const Retrieve: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  return {
    QueryId: crypto.randomUUID(),
    ResultItems: [],
  };
};

const GetSnapshots: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  return {
    SnapShotTimeFilter: input["SnapShotTimeFilter"] ?? {},
    SnapshotsDataHeader: [],
    SnapshotsData: [],
  };
};

const SubmitFeedback: OperationHandler = (input, ctx) => {
  const indexId = requireString(input, "IndexId");
  requireIndex(ctx, indexId);
  return {};
};

const kendra: ServiceDefinition = {
  name: "kendra",
  protocol: "json",
  operations: {
    CreateIndex,
    DescribeIndex,
    ListIndices,
    DeleteIndex,
    UpdateIndex,
    CreateDataSource,
    DescribeDataSource,
    ListDataSources,
    UpdateDataSource,
    DeleteDataSource,
    StartDataSourceSyncJob,
    StopDataSourceSyncJob,
    ListDataSourceSyncJobs,
    CreateFaq,
    DescribeFaq,
    ListFaqs,
    DeleteFaq,
    CreateExperience,
    DescribeExperience,
    ListExperiences,
    UpdateExperience,
    DeleteExperience,
    AssociateEntitiesToExperience,
    DisassociateEntitiesFromExperience,
    ListExperienceEntities,
    AssociatePersonasToEntities,
    DisassociatePersonasFromEntities,
    ListEntityPersonas,
    CreateThesaurus,
    DescribeThesaurus,
    ListThesauri,
    UpdateThesaurus,
    DeleteThesaurus,
    CreateAccessControlConfiguration,
    DescribeAccessControlConfiguration,
    ListAccessControlConfigurations,
    UpdateAccessControlConfiguration,
    DeleteAccessControlConfiguration,
    CreateQuerySuggestionsBlockList,
    DescribeQuerySuggestionsBlockList,
    ListQuerySuggestionsBlockLists,
    UpdateQuerySuggestionsBlockList,
    DeleteQuerySuggestionsBlockList,
    CreateFeaturedResultsSet,
    DescribeFeaturedResultsSet,
    ListFeaturedResultsSets,
    UpdateFeaturedResultsSet,
    BatchDeleteFeaturedResultsSet,
    PutPrincipalMapping,
    DescribePrincipalMapping,
    DeletePrincipalMapping,
    ListGroupsOlderThanOrderingId,
    DescribeQuerySuggestionsConfig,
    UpdateQuerySuggestionsConfig,
    ClearQuerySuggestions,
    GetQuerySuggestions,
    TagResource,
    UntagResource,
    ListTagsForResource,
    BatchPutDocument,
    BatchDeleteDocument,
    BatchGetDocumentStatus,
    Query,
    Retrieve,
    GetSnapshots,
    SubmitFeedback,
  },
  model,
} as const;

export default kendra;
