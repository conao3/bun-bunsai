import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import textractModel from "../../models/textract.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(textractModel);

type Block = {
  BlockType: string;
  Confidence: number;
  Id: string;
  Text?: string;
  Page: number;
  Geometry: {
    BoundingBox: { Width: number; Height: number; Left: number; Top: number };
    Polygon: { X: number; Y: number }[];
  };
  Relationships?: { Type: string; Ids: string[] }[];
};

type StoredTextDetectionJob = {
  JobId: string;
  JobStatus: string;
  DocumentLocation: Record<string, unknown>;
  StatusMessage: string | undefined;
};

type StoredDocumentAnalysisJob = {
  JobId: string;
  JobStatus: string;
  DocumentLocation: Record<string, unknown>;
  FeatureTypes: string[];
  StatusMessage: string | undefined;
};

type StoredExpenseAnalysisJob = {
  JobId: string;
  JobStatus: string;
  DocumentLocation: Record<string, unknown>;
  StatusMessage: string | undefined;
};

type StoredLendingAnalysisJob = {
  JobId: string;
  JobStatus: string;
  DocumentLocation: Record<string, unknown>;
  StatusMessage: string | undefined;
};

type StoredAdapter = {
  AdapterId: string;
  AdapterName: string;
  CreationTime: Date;
  Description: string | undefined;
  FeatureTypes: string[];
  AutoUpdate: string | undefined;
  Tags: Record<string, string>;
};

type StoredAdapterVersion = {
  AdapterId: string;
  AdapterVersion: string;
  CreationTime: Date;
  Status: string;
  KMSKeyId: string | undefined;
  OutputConfig: Record<string, unknown>;
  DatasetConfig: Record<string, unknown>;
  Tags: Record<string, string>;
};

const textDetectionJobKey = (id: string) => `text-detection-job/${id}`;
const documentAnalysisJobKey = (id: string) => `document-analysis-job/${id}`;
const expenseAnalysisJobKey = (id: string) => `expense-analysis-job/${id}`;
const lendingAnalysisJobKey = (id: string) => `lending-analysis-job/${id}`;
const adapterKey = (id: string) => `adapter/${id}`;
const adapterVersionKey = (id: string, version: string) =>
  `adapter-version/${id}/${version}`;
const idempotencyKey = (operation: string, token: string) =>
  `idem/${operation}/${token}`;

const STUB_BLOCKS: Block[] = [
  {
    BlockType: "PAGE",
    Confidence: 99.0,
    Id: "block-page-1",
    Page: 1,
    Geometry: {
      BoundingBox: { Width: 1.0, Height: 1.0, Left: 0.0, Top: 0.0 },
      Polygon: [
        { X: 0.0, Y: 0.0 },
        { X: 1.0, Y: 0.0 },
        { X: 1.0, Y: 1.0 },
        { X: 0.0, Y: 1.0 },
      ],
    },
    Relationships: [{ Type: "CHILD", Ids: ["block-line-1"] }],
  },
  {
    BlockType: "LINE",
    Confidence: 99.0,
    Id: "block-line-1",
    Text: "Hello World",
    Page: 1,
    Geometry: {
      BoundingBox: { Width: 0.5, Height: 0.1, Left: 0.1, Top: 0.1 },
      Polygon: [
        { X: 0.1, Y: 0.1 },
        { X: 0.6, Y: 0.1 },
        { X: 0.6, Y: 0.2 },
        { X: 0.1, Y: 0.2 },
      ],
    },
    Relationships: [{ Type: "CHILD", Ids: ["block-word-1", "block-word-2"] }],
  },
  {
    BlockType: "WORD",
    Confidence: 99.0,
    Id: "block-word-1",
    Text: "Hello",
    Page: 1,
    Geometry: {
      BoundingBox: { Width: 0.2, Height: 0.1, Left: 0.1, Top: 0.1 },
      Polygon: [
        { X: 0.1, Y: 0.1 },
        { X: 0.3, Y: 0.1 },
        { X: 0.3, Y: 0.2 },
        { X: 0.1, Y: 0.2 },
      ],
    },
  },
  {
    BlockType: "WORD",
    Confidence: 99.0,
    Id: "block-word-2",
    Text: "World",
    Page: 1,
    Geometry: {
      BoundingBox: { Width: 0.2, Height: 0.1, Left: 0.35, Top: 0.1 },
      Polygon: [
        { X: 0.35, Y: 0.1 },
        { X: 0.55, Y: 0.1 },
        { X: 0.55, Y: 0.2 },
        { X: 0.35, Y: 0.2 },
      ],
    },
  },
];

const STUB_DOCUMENT_METADATA = { Pages: 1 };

const STUB_EXPENSE_DOCUMENTS = [
  {
    ExpenseIndex: 1,
    SummaryFields: [],
    LineItemGroups: [],
    Blocks: STUB_BLOCKS,
  },
  {
    ExpenseIndex: 2,
    SummaryFields: [],
    LineItemGroups: [],
    Blocks: [],
  },
];

const STUB_LENDING_RESULTS = [
  {
    Page: 1,
    PageClassification: { PageType: [], PageNumber: [] },
    Extractions: [],
  },
  {
    Page: 2,
    PageClassification: { PageType: [], PageNumber: [] },
    Extractions: [],
  },
];

const stringOrUndefined = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

const numberOrUndefined = (v: unknown): number | undefined =>
  typeof v === "number" ? v : undefined;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const v = input[key];
  if (typeof v !== "string" || v === "") {
    throw awsError("InvalidParameterException", `${key} is required.`, 400);
  }
  return v;
};

const requireObject = (
  input: Record<string, unknown>,
  key: string,
): Record<string, unknown> => {
  const v = input[key];
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw awsError("InvalidParameterException", `${key} is required.`, 400);
  }
  return v as Record<string, unknown>;
};

const requireStringArray = (
  input: Record<string, unknown>,
  key: string,
): string[] => {
  const v = input[key];
  if (!Array.isArray(v) || v.length === 0) {
    throw awsError(
      "InvalidParameterException",
      `${key} is required and must be a non-empty array.`,
      400,
    );
  }
  return v as string[];
};

const checkIdempotency = (
  ctx: ServiceContext,
  operation: string,
  input: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  const token = stringOrUndefined(input["ClientRequestToken"]);
  if (token === undefined) return undefined;
  const key = idempotencyKey(operation, token);
  const stored = ctx.store.get<{
    result: Record<string, unknown>;
    inputHash: string;
  }>(key);
  const inputWithoutToken = { ...input };
  delete inputWithoutToken["ClientRequestToken"];
  const inputHash = JSON.stringify(inputWithoutToken);
  if (stored !== undefined) {
    if (stored.inputHash !== inputHash) {
      throw awsError(
        "IdempotentParameterMismatchException",
        "Client token is already in use for a different request.",
        400,
      );
    }
    return stored.result;
  }
  return undefined;
};

const storeIdempotency = (
  ctx: ServiceContext,
  operation: string,
  input: Record<string, unknown>,
  result: Record<string, unknown>,
): void => {
  const token = stringOrUndefined(input["ClientRequestToken"]);
  if (token === undefined) return;
  const key = idempotencyKey(operation, token);
  const inputWithoutToken = { ...input };
  delete inputWithoutToken["ClientRequestToken"];
  const inputHash = JSON.stringify(inputWithoutToken);
  ctx.store.set(key, { result, inputHash });
};

const validateDocument = (
  document: Record<string, unknown>,
  ctx: ServiceContext,
): void => {
  const s3Object = document["S3Object"];
  if (
    s3Object === null ||
    typeof s3Object !== "object" ||
    Array.isArray(s3Object)
  )
    return;
  const s3 = s3Object as Record<string, unknown>;
  const bucket = stringOrUndefined(s3["Bucket"]);
  const key = stringOrUndefined(s3["Name"]);
  if (bucket === undefined || key === undefined) {
    throw awsError(
      "InvalidS3ObjectException",
      "S3Object requires Bucket and Name.",
      400,
    );
  }
  const s3Store = ctx.storeFor("s3");
  const bucketData = s3Store.get<{ objects: Record<string, unknown[]> }>(
    bucket,
  );
  if (
    bucketData === undefined ||
    (bucketData.objects[key] ?? []).length === 0
  ) {
    throw awsError(
      "InvalidS3ObjectException",
      `Unable to get object metadata from S3. Bucket: ${bucket}, Key: ${key}`,
      400,
    );
  }
};

const validateDocumentLocation = (
  location: Record<string, unknown>,
  ctx: ServiceContext,
): void => {
  const s3Object = location["S3Object"];
  if (
    s3Object === null ||
    typeof s3Object !== "object" ||
    Array.isArray(s3Object)
  )
    return;
  const s3 = s3Object as Record<string, unknown>;
  const bucket = stringOrUndefined(s3["Bucket"]);
  const key = stringOrUndefined(s3["Name"]);
  if (bucket === undefined || key === undefined) return;
  const s3Store = ctx.storeFor("s3");
  const bucketData = s3Store.get<{ objects: Record<string, unknown[]> }>(
    bucket,
  );
  if (
    bucketData === undefined ||
    (bucketData.objects[key] ?? []).length === 0
  ) {
    throw awsError(
      "InvalidS3ObjectException",
      `Unable to get object metadata from S3. Bucket: ${bucket}, Key: ${key}`,
      400,
    );
  }
};

const validateManifestS3Object = (
  datasetConfig: Record<string, unknown>,
  ctx: ServiceContext,
): void => {
  const s3Object = datasetConfig["ManifestS3Object"];
  if (
    s3Object === null ||
    typeof s3Object !== "object" ||
    Array.isArray(s3Object)
  )
    return;
  const s3 = s3Object as Record<string, unknown>;
  const bucket = stringOrUndefined(s3["Bucket"]);
  const key = stringOrUndefined(s3["Name"]);
  if (bucket === undefined || key === undefined) return;
  const s3Store = ctx.storeFor("s3");
  const bucketData = s3Store.get<{ objects: Record<string, unknown[]> }>(
    bucket,
  );
  if (
    bucketData === undefined ||
    (bucketData.objects[key] ?? []).length === 0
  ) {
    throw awsError(
      "InvalidS3ObjectException",
      `Unable to get object metadata from S3. Bucket: ${bucket}, Key: ${key}`,
      400,
    );
  }
};

const applyPagination = <T>(
  items: T[],
  maxResults: number | undefined,
  nextToken: string | undefined,
): { items: T[]; nextToken: string | undefined } => {
  let start = 0;
  if (nextToken !== undefined) {
    let decoded: number;
    try {
      decoded = parseInt(atob(nextToken), 10);
    } catch {
      throw awsError("InvalidParameterException", "Invalid NextToken.", 400);
    }
    if (!Number.isFinite(decoded)) {
      throw awsError("InvalidParameterException", "Invalid NextToken.", 400);
    }
    start = decoded;
  }
  const limit =
    maxResults !== undefined && maxResults > 0 ? maxResults : items.length;
  const sliced = items.slice(start, start + limit);
  const newNextToken =
    start + limit < items.length ? btoa(String(start + limit)) : undefined;
  return { items: sliced, nextToken: newNextToken };
};

const requireTextDetectionJob = (
  ctx: ServiceContext,
  jobId: string,
): StoredTextDetectionJob => {
  const job = ctx.store.get<StoredTextDetectionJob>(textDetectionJobKey(jobId));
  if (job === undefined) {
    throw awsError("InvalidJobIdException", `Invalid job ID: ${jobId}`, 400);
  }
  return job;
};

const requireDocumentAnalysisJob = (
  ctx: ServiceContext,
  jobId: string,
): StoredDocumentAnalysisJob => {
  const job = ctx.store.get<StoredDocumentAnalysisJob>(
    documentAnalysisJobKey(jobId),
  );
  if (job === undefined) {
    throw awsError("InvalidJobIdException", `Invalid job ID: ${jobId}`, 400);
  }
  return job;
};

const requireExpenseAnalysisJob = (
  ctx: ServiceContext,
  jobId: string,
): StoredExpenseAnalysisJob => {
  const job = ctx.store.get<StoredExpenseAnalysisJob>(
    expenseAnalysisJobKey(jobId),
  );
  if (job === undefined) {
    throw awsError("InvalidJobIdException", `Invalid job ID: ${jobId}`, 400);
  }
  return job;
};

const requireLendingAnalysisJob = (
  ctx: ServiceContext,
  jobId: string,
): StoredLendingAnalysisJob => {
  const job = ctx.store.get<StoredLendingAnalysisJob>(
    lendingAnalysisJobKey(jobId),
  );
  if (job === undefined) {
    throw awsError("InvalidJobIdException", `Invalid job ID: ${jobId}`, 400);
  }
  return job;
};

const requireAdapter = (
  ctx: ServiceContext,
  adapterId: string,
): StoredAdapter => {
  const adapter = ctx.store.get<StoredAdapter>(adapterKey(adapterId));
  if (adapter === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Adapter not found: ${adapterId}`,
      400,
    );
  }
  return adapter;
};

const requireAdapterVersion = (
  ctx: ServiceContext,
  adapterId: string,
  version: string,
): StoredAdapterVersion => {
  const av = ctx.store.get<StoredAdapterVersion>(
    adapterVersionKey(adapterId, version),
  );
  if (av === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Adapter version not found: ${adapterId}/${version}`,
      400,
    );
  }
  return av;
};

const resolveTextDetectionJob = (
  ctx: ServiceContext,
  job: StoredTextDetectionJob,
): StoredTextDetectionJob => {
  if (job.JobStatus !== "IN_PROGRESS") return job;
  const resolved: StoredTextDetectionJob = { ...job, JobStatus: "SUCCEEDED" };
  ctx.store.set(textDetectionJobKey(job.JobId), resolved);
  return resolved;
};

const resolveDocumentAnalysisJob = (
  ctx: ServiceContext,
  job: StoredDocumentAnalysisJob,
): StoredDocumentAnalysisJob => {
  if (job.JobStatus !== "IN_PROGRESS") return job;
  const resolved: StoredDocumentAnalysisJob = {
    ...job,
    JobStatus: "SUCCEEDED",
  };
  ctx.store.set(documentAnalysisJobKey(job.JobId), resolved);
  return resolved;
};

const resolveExpenseAnalysisJob = (
  ctx: ServiceContext,
  job: StoredExpenseAnalysisJob,
): StoredExpenseAnalysisJob => {
  if (job.JobStatus !== "IN_PROGRESS") return job;
  const resolved: StoredExpenseAnalysisJob = { ...job, JobStatus: "SUCCEEDED" };
  ctx.store.set(expenseAnalysisJobKey(job.JobId), resolved);
  return resolved;
};

const resolveLendingAnalysisJob = (
  ctx: ServiceContext,
  job: StoredLendingAnalysisJob,
): StoredLendingAnalysisJob => {
  if (job.JobStatus !== "IN_PROGRESS") return job;
  const resolved: StoredLendingAnalysisJob = { ...job, JobStatus: "SUCCEEDED" };
  ctx.store.set(lendingAnalysisJobKey(job.JobId), resolved);
  return resolved;
};

const resolveAdapterVersion = (
  ctx: ServiceContext,
  av: StoredAdapterVersion,
): StoredAdapterVersion => {
  if (av.Status !== "CREATION_IN_PROGRESS") return av;
  const resolved: StoredAdapterVersion = { ...av, Status: "ACTIVE" };
  ctx.store.set(adapterVersionKey(av.AdapterId, av.AdapterVersion), resolved);
  return resolved;
};

const nextAdapterVersionNumber = (
  ctx: ServiceContext,
  adapterId: string,
): string => {
  const count = ctx.store
    .list<StoredAdapterVersion>()
    .filter((e) => e.key.startsWith(`adapter-version/${adapterId}/`)).length;
  return String(count + 1);
};

const DetectDocumentText: OperationHandler = (input, ctx) => {
  const document = requireObject(input, "Document");
  validateDocument(document, ctx);
  return {
    DocumentMetadata: STUB_DOCUMENT_METADATA,
    Blocks: STUB_BLOCKS,
    DetectDocumentTextModelVersion: "1.0",
  };
};

const AnalyzeDocument: OperationHandler = (input, ctx) => {
  const document = requireObject(input, "Document");
  validateDocument(document, ctx);
  requireStringArray(input, "FeatureTypes");
  return {
    DocumentMetadata: STUB_DOCUMENT_METADATA,
    Blocks: STUB_BLOCKS,
    AnalyzeDocumentModelVersion: "1.0",
  };
};

const AnalyzeExpense: OperationHandler = (input, ctx) => {
  const document = requireObject(input, "Document");
  validateDocument(document, ctx);
  return {
    DocumentMetadata: STUB_DOCUMENT_METADATA,
    ExpenseDocuments: [
      {
        ExpenseIndex: 1,
        SummaryFields: [],
        LineItemGroups: [],
        Blocks: STUB_BLOCKS,
      },
    ],
  };
};

const AnalyzeID: OperationHandler = (input) => {
  const pages = input["DocumentPages"];
  if (!Array.isArray(pages) || pages.length === 0) {
    throw awsError(
      "InvalidParameterException",
      "DocumentPages is required.",
      400,
    );
  }
  return {
    IdentityDocuments: [
      {
        DocumentIndex: 1,
        IdentityDocumentFields: [],
        Blocks: STUB_BLOCKS,
      },
    ],
    DocumentMetadata: STUB_DOCUMENT_METADATA,
    AnalyzeIDModelVersion: "1.0",
  };
};

const StartDocumentTextDetection: OperationHandler = (input, ctx) => {
  const prior = checkIdempotency(ctx, "StartDocumentTextDetection", input);
  if (prior !== undefined) return prior;
  const location = requireObject(input, "DocumentLocation");
  validateDocumentLocation(location, ctx);
  const jobId = crypto.randomUUID();
  const job: StoredTextDetectionJob = {
    JobId: jobId,
    JobStatus: "IN_PROGRESS",
    DocumentLocation: location,
    StatusMessage: undefined,
  };
  ctx.store.set(textDetectionJobKey(jobId), job);
  const result = { JobId: jobId };
  storeIdempotency(ctx, "StartDocumentTextDetection", input, result);
  return result;
};

const GetDocumentTextDetection: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const job = resolveTextDetectionJob(ctx, requireTextDetectionJob(ctx, jobId));
  const { items, nextToken: newNextToken } = applyPagination(
    STUB_BLOCKS,
    maxResults,
    nextToken,
  );
  return {
    DocumentMetadata: STUB_DOCUMENT_METADATA,
    JobStatus: job.JobStatus,
    Blocks: items,
    NextToken: newNextToken,
    StatusMessage: job.StatusMessage,
    DetectDocumentTextModelVersion: "1.0",
  };
};

const StartDocumentAnalysis: OperationHandler = (input, ctx) => {
  const prior = checkIdempotency(ctx, "StartDocumentAnalysis", input);
  if (prior !== undefined) return prior;
  const location = requireObject(input, "DocumentLocation");
  validateDocumentLocation(location, ctx);
  const featureTypes = requireStringArray(input, "FeatureTypes");
  const jobId = crypto.randomUUID();
  const job: StoredDocumentAnalysisJob = {
    JobId: jobId,
    JobStatus: "IN_PROGRESS",
    DocumentLocation: location,
    FeatureTypes: featureTypes,
    StatusMessage: undefined,
  };
  ctx.store.set(documentAnalysisJobKey(jobId), job);
  const result = { JobId: jobId };
  storeIdempotency(ctx, "StartDocumentAnalysis", input, result);
  return result;
};

const GetDocumentAnalysis: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const job = resolveDocumentAnalysisJob(
    ctx,
    requireDocumentAnalysisJob(ctx, jobId),
  );
  const { items, nextToken: newNextToken } = applyPagination(
    STUB_BLOCKS,
    maxResults,
    nextToken,
  );
  return {
    DocumentMetadata: STUB_DOCUMENT_METADATA,
    JobStatus: job.JobStatus,
    Blocks: items,
    NextToken: newNextToken,
    StatusMessage: job.StatusMessage,
    AnalyzeDocumentModelVersion: "1.0",
  };
};

const StartExpenseAnalysis: OperationHandler = (input, ctx) => {
  const prior = checkIdempotency(ctx, "StartExpenseAnalysis", input);
  if (prior !== undefined) return prior;
  const location = requireObject(input, "DocumentLocation");
  validateDocumentLocation(location, ctx);
  const jobId = crypto.randomUUID();
  const job: StoredExpenseAnalysisJob = {
    JobId: jobId,
    JobStatus: "IN_PROGRESS",
    DocumentLocation: location,
    StatusMessage: undefined,
  };
  ctx.store.set(expenseAnalysisJobKey(jobId), job);
  const result = { JobId: jobId };
  storeIdempotency(ctx, "StartExpenseAnalysis", input, result);
  return result;
};

const GetExpenseAnalysis: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const job = resolveExpenseAnalysisJob(
    ctx,
    requireExpenseAnalysisJob(ctx, jobId),
  );
  const { items, nextToken: newNextToken } = applyPagination(
    STUB_EXPENSE_DOCUMENTS,
    maxResults,
    nextToken,
  );
  return {
    DocumentMetadata: STUB_DOCUMENT_METADATA,
    JobStatus: job.JobStatus,
    ExpenseDocuments: items,
    NextToken: newNextToken,
    StatusMessage: job.StatusMessage,
    AnalyzeExpenseModelVersion: "1.0",
  };
};

const StartLendingAnalysis: OperationHandler = (input, ctx) => {
  const prior = checkIdempotency(ctx, "StartLendingAnalysis", input);
  if (prior !== undefined) return prior;
  const location = requireObject(input, "DocumentLocation");
  validateDocumentLocation(location, ctx);
  const jobId = crypto.randomUUID();
  const job: StoredLendingAnalysisJob = {
    JobId: jobId,
    JobStatus: "IN_PROGRESS",
    DocumentLocation: location,
    StatusMessage: undefined,
  };
  ctx.store.set(lendingAnalysisJobKey(jobId), job);
  const result = { JobId: jobId };
  storeIdempotency(ctx, "StartLendingAnalysis", input, result);
  return result;
};

const GetLendingAnalysis: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const job = resolveLendingAnalysisJob(
    ctx,
    requireLendingAnalysisJob(ctx, jobId),
  );
  const { items, nextToken: newNextToken } = applyPagination(
    STUB_LENDING_RESULTS,
    maxResults,
    nextToken,
  );
  return {
    DocumentMetadata: STUB_DOCUMENT_METADATA,
    JobStatus: job.JobStatus,
    Results: items,
    NextToken: newNextToken,
    Warnings: [],
    StatusMessage: job.StatusMessage,
    AnalyzeLendingModelVersion: "1.0",
  };
};

const GetLendingAnalysisSummary: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const job = resolveLendingAnalysisJob(
    ctx,
    requireLendingAnalysisJob(ctx, jobId),
  );
  return {
    DocumentMetadata: STUB_DOCUMENT_METADATA,
    JobStatus: job.JobStatus,
    Summary: { DocumentGroups: [], UndetectedDocumentTypes: [] },
    Warnings: [],
    StatusMessage: job.StatusMessage,
    AnalyzeLendingModelVersion: "1.0",
  };
};

const CreateAdapter: OperationHandler = (input, ctx) => {
  const prior = checkIdempotency(ctx, "CreateAdapter", input);
  if (prior !== undefined) return prior;
  const adapterName = requireString(input, "AdapterName");
  const featureTypes = requireStringArray(input, "FeatureTypes");
  const adapterId = crypto.randomUUID();
  const tags = (input["Tags"] as Record<string, string> | undefined) ?? {};
  const adapter: StoredAdapter = {
    AdapterId: adapterId,
    AdapterName: adapterName,
    CreationTime: new Date(),
    Description: stringOrUndefined(input["Description"]),
    FeatureTypes: featureTypes,
    AutoUpdate: stringOrUndefined(input["AutoUpdate"]),
    Tags: tags,
  };
  ctx.store.set(adapterKey(adapterId), adapter);
  const result = { AdapterId: adapterId };
  storeIdempotency(ctx, "CreateAdapter", input, result);
  return result;
};

const GetAdapter: OperationHandler = (input, ctx) => {
  const adapterId = requireString(input, "AdapterId");
  const adapter = requireAdapter(ctx, adapterId);
  return {
    AdapterId: adapter.AdapterId,
    AdapterName: adapter.AdapterName,
    CreationTime: adapter.CreationTime,
    Description: adapter.Description,
    FeatureTypes: adapter.FeatureTypes,
    AutoUpdate: adapter.AutoUpdate,
    Tags: adapter.Tags,
  };
};

const UpdateAdapter: OperationHandler = (input, ctx) => {
  const adapterId = requireString(input, "AdapterId");
  const adapter = requireAdapter(ctx, adapterId);
  const updated: StoredAdapter = {
    ...adapter,
    AdapterName: stringOrUndefined(input["AdapterName"]) ?? adapter.AdapterName,
    Description:
      input["Description"] !== undefined
        ? stringOrUndefined(input["Description"])
        : adapter.Description,
    AutoUpdate:
      input["AutoUpdate"] !== undefined
        ? stringOrUndefined(input["AutoUpdate"])
        : adapter.AutoUpdate,
  };
  ctx.store.set(adapterKey(adapterId), updated);
  return {
    AdapterId: updated.AdapterId,
    AdapterName: updated.AdapterName,
    CreationTime: updated.CreationTime,
    Description: updated.Description,
    FeatureTypes: updated.FeatureTypes,
    AutoUpdate: updated.AutoUpdate,
  };
};

const DeleteAdapter: OperationHandler = (input, ctx) => {
  const adapterId = requireString(input, "AdapterId");
  requireAdapter(ctx, adapterId);
  const hasVersions = ctx.store
    .list<StoredAdapterVersion>()
    .some((e) => e.key.startsWith(`adapter-version/${adapterId}/`));
  if (hasVersions) {
    throw awsError(
      "ConflictException",
      `Adapter ${adapterId} has existing versions. Delete all versions before deleting the adapter.`,
      400,
    );
  }
  ctx.store.delete(adapterKey(adapterId));
  return {};
};

const ListAdapters: OperationHandler = (input, ctx) => {
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const afterCreationTime = stringOrUndefined(input["AfterCreationTime"]);
  const beforeCreationTime = stringOrUndefined(input["BeforeCreationTime"]);
  const all = ctx.store
    .list<StoredAdapter>()
    .filter((e) => e.key.startsWith("adapter/") && !e.key.includes("/", 8))
    .map((e) => e.value)
    .filter((a) => {
      if (afterCreationTime !== undefined) {
        if (new Date(a.CreationTime) <= new Date(afterCreationTime))
          return false;
      }
      if (beforeCreationTime !== undefined) {
        if (new Date(a.CreationTime) >= new Date(beforeCreationTime))
          return false;
      }
      return true;
    });
  const { items, nextToken: newNextToken } = applyPagination(
    all,
    maxResults,
    nextToken,
  );
  return {
    Adapters: items.map((a) => ({
      AdapterId: a.AdapterId,
      AdapterName: a.AdapterName,
      CreationTime: a.CreationTime,
      FeatureTypes: a.FeatureTypes,
    })),
    NextToken: newNextToken,
  };
};

const CreateAdapterVersion: OperationHandler = (input, ctx) => {
  const prior = checkIdempotency(ctx, "CreateAdapterVersion", input);
  if (prior !== undefined) return prior;
  const adapterId = requireString(input, "AdapterId");
  requireAdapter(ctx, adapterId);
  const datasetConfig = requireObject(input, "DatasetConfig");
  const outputConfig = requireObject(input, "OutputConfig");
  validateManifestS3Object(datasetConfig, ctx);
  const version = nextAdapterVersionNumber(ctx, adapterId);
  const tags = (input["Tags"] as Record<string, string> | undefined) ?? {};
  const av: StoredAdapterVersion = {
    AdapterId: adapterId,
    AdapterVersion: version,
    CreationTime: new Date(),
    Status: "CREATION_IN_PROGRESS",
    KMSKeyId: stringOrUndefined(input["KMSKeyId"]),
    OutputConfig: outputConfig,
    DatasetConfig: datasetConfig,
    Tags: tags,
  };
  ctx.store.set(adapterVersionKey(adapterId, version), av);
  const result = { AdapterId: adapterId, AdapterVersion: version };
  storeIdempotency(ctx, "CreateAdapterVersion", input, result);
  return result;
};

const GetAdapterVersion: OperationHandler = (input, ctx) => {
  const adapterId = requireString(input, "AdapterId");
  const version = requireString(input, "AdapterVersion");
  const av = resolveAdapterVersion(
    ctx,
    requireAdapterVersion(ctx, adapterId, version),
  );
  return {
    AdapterId: av.AdapterId,
    AdapterVersion: av.AdapterVersion,
    CreationTime: av.CreationTime,
    FeatureTypes: requireAdapter(ctx, adapterId).FeatureTypes,
    Status: av.Status,
    KMSKeyId: av.KMSKeyId,
    OutputConfig: av.OutputConfig,
    DatasetConfig: av.DatasetConfig,
    Tags: av.Tags,
  };
};

const DeleteAdapterVersion: OperationHandler = (input, ctx) => {
  const adapterId = requireString(input, "AdapterId");
  const version = requireString(input, "AdapterVersion");
  requireAdapterVersion(ctx, adapterId, version);
  ctx.store.delete(adapterVersionKey(adapterId, version));
  return {};
};

const ListAdapterVersions: OperationHandler = (input, ctx) => {
  const adapterId = stringOrUndefined(input["AdapterId"]);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const afterCreationTime = stringOrUndefined(input["AfterCreationTime"]);
  const beforeCreationTime = stringOrUndefined(input["BeforeCreationTime"]);
  const all = ctx.store
    .list<StoredAdapterVersion>()
    .filter((e) => e.key.startsWith("adapter-version/"))
    .map((e) => resolveAdapterVersion(ctx, e.value))
    .filter((av) => adapterId === undefined || av.AdapterId === adapterId)
    .filter((av) => {
      if (afterCreationTime !== undefined) {
        if (new Date(av.CreationTime) <= new Date(afterCreationTime))
          return false;
      }
      if (beforeCreationTime !== undefined) {
        if (new Date(av.CreationTime) >= new Date(beforeCreationTime))
          return false;
      }
      return true;
    });
  const { items, nextToken: newNextToken } = applyPagination(
    all,
    maxResults,
    nextToken,
  );
  return {
    AdapterVersions: items.map((av) => ({
      AdapterId: av.AdapterId,
      AdapterVersion: av.AdapterVersion,
      CreationTime: av.CreationTime,
      Status: av.Status,
      FeatureTypes:
        ctx.store.get<StoredAdapter>(adapterKey(av.AdapterId))?.FeatureTypes ??
        [],
    })),
    NextToken: newNextToken,
  };
};

const extractAdapterIdFromArn = (arn: string): string | undefined => {
  const match = arn.match(/adapter\/([^/]+)/);
  return match?.[1];
};

const extractAdapterVersionFromArn = (arn: string): string | undefined => {
  const match = arn.match(/adapter\/[^/]+\/([^/]+)/);
  return match?.[1];
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const adapterId = extractAdapterIdFromArn(resourceArn);
  if (adapterId === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${resourceArn}`,
      400,
    );
  }
  const versionPart = extractAdapterVersionFromArn(resourceArn);
  if (versionPart !== undefined) {
    const av = requireAdapterVersion(ctx, adapterId, versionPart);
    return { Tags: av.Tags };
  }
  const adapter = requireAdapter(ctx, adapterId);
  return { Tags: adapter.Tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const newTags = (input["Tags"] as Record<string, string> | undefined) ?? {};
  const adapterId = extractAdapterIdFromArn(resourceArn);
  if (adapterId === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${resourceArn}`,
      400,
    );
  }
  const versionPart = extractAdapterVersionFromArn(resourceArn);
  if (versionPart !== undefined) {
    const av = requireAdapterVersion(ctx, adapterId, versionPart);
    ctx.store.set(adapterVersionKey(adapterId, versionPart), {
      ...av,
      Tags: { ...av.Tags, ...newTags },
    });
  } else {
    const adapter = requireAdapter(ctx, adapterId);
    ctx.store.set(adapterKey(adapterId), {
      ...adapter,
      Tags: { ...adapter.Tags, ...newTags },
    });
  }
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[])
    : [];
  const adapterId = extractAdapterIdFromArn(resourceArn);
  if (adapterId === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${resourceArn}`,
      400,
    );
  }
  const versionPart = extractAdapterVersionFromArn(resourceArn);
  if (versionPart !== undefined) {
    const av = requireAdapterVersion(ctx, adapterId, versionPart);
    const filteredTags = Object.fromEntries(
      Object.entries(av.Tags).filter(([k]) => !tagKeys.includes(k)),
    );
    ctx.store.set(adapterVersionKey(adapterId, versionPart), {
      ...av,
      Tags: filteredTags,
    });
  } else {
    const adapter = requireAdapter(ctx, adapterId);
    const filteredTags = Object.fromEntries(
      Object.entries(adapter.Tags).filter(([k]) => !tagKeys.includes(k)),
    );
    ctx.store.set(adapterKey(adapterId), {
      ...adapter,
      Tags: filteredTags,
    });
  }
  return {};
};

const textract = {
  name: "textract",
  protocol: "json",
  operations: {
    DetectDocumentText,
    AnalyzeDocument,
    AnalyzeExpense,
    AnalyzeID,
    StartDocumentTextDetection,
    GetDocumentTextDetection,
    StartDocumentAnalysis,
    GetDocumentAnalysis,
    StartExpenseAnalysis,
    GetExpenseAnalysis,
    StartLendingAnalysis,
    GetLendingAnalysis,
    GetLendingAnalysisSummary,
    CreateAdapter,
    GetAdapter,
    UpdateAdapter,
    DeleteAdapter,
    ListAdapters,
    CreateAdapterVersion,
    GetAdapterVersion,
    DeleteAdapterVersion,
    ListAdapterVersions,
    ListTagsForResource,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default textract;
