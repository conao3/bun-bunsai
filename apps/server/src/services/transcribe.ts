import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/transcribe.json", { with: { type: "json" } }),
  { targetPrefix: "Transcribe" },
);

type StoredJob = {
  TranscriptionJobName: string;
  TranscriptionJobStatus: string;
  LanguageCode: string | undefined;
  MediaSampleRateHertz: number | undefined;
  MediaFormat: string | undefined;
  Media: Record<string, unknown>;
  Transcript: { TranscriptFileUri: string };
  Tags: { Key: string; Value: string }[];
  StartTime: Date;
  CreationTime: Date;
  CompletionTime: Date | undefined;
};

type StoredVocabulary = {
  VocabularyName: string;
  LanguageCode: string;
  VocabularyState: string;
  LastModifiedTime: Date;
  VocabularyFileUri: string | undefined;
  describeCount: number;
};

type StoredVocabularyFilter = {
  VocabularyFilterName: string;
  LanguageCode: string;
  LastModifiedTime: Date;
};

type StoredLanguageModel = {
  ModelName: string;
  LanguageCode: string;
  BaseModelName: string;
  ModelStatus: string;
  InputDataConfig: Record<string, unknown>;
  CreateTime: Date;
  LastModifiedTime: Date;
};

type StoredCallAnalyticsCategory = {
  CategoryName: string;
  Rules: unknown[];
  CreateTime: Date;
  LastUpdateTime: Date;
  Tags: { Key: string; Value: string }[];
  InputType: string | undefined;
};

type StoredCallAnalyticsJob = {
  CallAnalyticsJobName: string;
  CallAnalyticsJobStatus: string;
  LanguageCode: string | undefined;
  Media: Record<string, unknown>;
  Transcript: { TranscriptFileUri: string };
  StartTime: Date;
  CreationTime: Date;
  CompletionTime: Date | undefined;
};

type StoredMedicalVocabulary = {
  VocabularyName: string;
  LanguageCode: string;
  VocabularyState: string;
  LastModifiedTime: Date;
  VocabularyFileUri: string | undefined;
};

type StoredMedicalTranscriptionJob = {
  MedicalTranscriptionJobName: string;
  TranscriptionJobStatus: string;
  LanguageCode: string;
  MediaSampleRateHertz: number | undefined;
  MediaFormat: string | undefined;
  Media: Record<string, unknown>;
  Transcript: { TranscriptFileUri: string };
  StartTime: Date;
  CreationTime: Date;
  CompletionTime: Date | undefined;
  Specialty: string;
  Type: string;
};

type StoredMedicalScribeJob = {
  MedicalScribeJobName: string;
  MedicalScribeJobStatus: string;
  LanguageCode: string;
  Media: Record<string, unknown>;
  MedicalScribeOutput: {
    TranscriptFileUri: string;
    ClinicalDocumentUri: string;
  };
  StartTime: Date;
  CreationTime: Date;
  CompletionTime: Date | undefined;
};

const jobKey = (name: string): string => `job/${name}`;
const vocabKey = (name: string): string => `vocab/${name}`;
const vocabFilterKey = (name: string): string => `vocab-filter/${name}`;
const langModelKey = (name: string): string => `model/${name}`;
const caCategoryKey = (name: string): string => `ca-category/${name}`;
const caJobKey = (name: string): string => `ca-job/${name}`;
const medVocabKey = (name: string): string => `med-vocab/${name}`;
const medJobKey = (name: string): string => `med-job/${name}`;
const medScribeKey = (name: string): string => `med-scribe/${name}`;
const tagsKey = (arn: string): string => `tags/${arn}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("BadRequestException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const requireJob = (ctx: ServiceContext, name: string): StoredJob => {
  const job = ctx.store.get<StoredJob>(jobKey(name));
  if (job === undefined) {
    throw awsError(
      "NotFoundException",
      `The requested job couldn't be found: ${name}`,
      400,
    );
  }
  return job;
};

const requireVocab = (ctx: ServiceContext, name: string): StoredVocabulary => {
  const vocab = ctx.store.get<StoredVocabulary>(vocabKey(name));
  if (vocab === undefined) {
    throw awsError(
      "NotFoundException",
      `The requested vocabulary couldn't be found: ${name}`,
      400,
    );
  }
  return vocab;
};

const requireVocabFilter = (
  ctx: ServiceContext,
  name: string,
): StoredVocabularyFilter => {
  const filter = ctx.store.get<StoredVocabularyFilter>(vocabFilterKey(name));
  if (filter === undefined) {
    throw awsError(
      "NotFoundException",
      `The requested vocabulary filter couldn't be found: ${name}`,
      400,
    );
  }
  return filter;
};

const requireLanguageModel = (
  ctx: ServiceContext,
  name: string,
): StoredLanguageModel => {
  const m = ctx.store.get<StoredLanguageModel>(langModelKey(name));
  if (m === undefined) {
    throw awsError(
      "NotFoundException",
      `The requested language model couldn't be found: ${name}`,
      400,
    );
  }
  return m;
};

const requireCallAnalyticsCategory = (
  ctx: ServiceContext,
  name: string,
): StoredCallAnalyticsCategory => {
  const cat = ctx.store.get<StoredCallAnalyticsCategory>(caCategoryKey(name));
  if (cat === undefined) {
    throw awsError(
      "NotFoundException",
      `The requested category couldn't be found: ${name}`,
      400,
    );
  }
  return cat;
};

const requireCallAnalyticsJob = (
  ctx: ServiceContext,
  name: string,
): StoredCallAnalyticsJob => {
  const job = ctx.store.get<StoredCallAnalyticsJob>(caJobKey(name));
  if (job === undefined) {
    throw awsError(
      "NotFoundException",
      `The requested Call Analytics job couldn't be found: ${name}`,
      400,
    );
  }
  return job;
};

const requireMedicalVocab = (
  ctx: ServiceContext,
  name: string,
): StoredMedicalVocabulary => {
  const vocab = ctx.store.get<StoredMedicalVocabulary>(medVocabKey(name));
  if (vocab === undefined) {
    throw awsError(
      "NotFoundException",
      `The requested medical vocabulary couldn't be found: ${name}`,
      400,
    );
  }
  return vocab;
};

const requireMedicalJob = (
  ctx: ServiceContext,
  name: string,
): StoredMedicalTranscriptionJob => {
  const job = ctx.store.get<StoredMedicalTranscriptionJob>(medJobKey(name));
  if (job === undefined) {
    throw awsError(
      "NotFoundException",
      `The requested medical transcription job couldn't be found: ${name}`,
      400,
    );
  }
  return job;
};

const requireMedicalScribeJob = (
  ctx: ServiceContext,
  name: string,
): StoredMedicalScribeJob => {
  const job = ctx.store.get<StoredMedicalScribeJob>(medScribeKey(name));
  if (job === undefined) {
    throw awsError(
      "NotFoundException",
      `The requested Medical Scribe job couldn't be found: ${name}`,
      400,
    );
  }
  return job;
};

const parseTags = (raw: unknown): { Key: string; Value: string }[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is { Key: string; Value: string } =>
      t !== null &&
      typeof t === "object" &&
      typeof (t as Record<string, unknown>)["Key"] === "string" &&
      typeof (t as Record<string, unknown>)["Value"] === "string",
  );
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
      throw awsError("BadRequestException", "Invalid NextToken.", 400);
    }
    if (!Number.isFinite(decoded)) {
      throw awsError("BadRequestException", "Invalid NextToken.", 400);
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

const matchesNameFilter = (name: string, contains: unknown): boolean =>
  typeof contains !== "string" ||
  name.toLowerCase().includes(contains.toLowerCase());

const resolveTranscriptionJob = (
  ctx: ServiceContext,
  job: StoredJob,
): StoredJob => {
  if (job.TranscriptionJobStatus !== "IN_PROGRESS") return job;
  const completed: StoredJob = {
    ...job,
    TranscriptionJobStatus: "COMPLETED",
    CompletionTime: new Date(),
  };
  ctx.store.set(jobKey(job.TranscriptionJobName), completed);
  return completed;
};

const resolveCallAnalyticsJob = (
  ctx: ServiceContext,
  job: StoredCallAnalyticsJob,
): StoredCallAnalyticsJob => {
  if (job.CallAnalyticsJobStatus !== "IN_PROGRESS") return job;
  const completed: StoredCallAnalyticsJob = {
    ...job,
    CallAnalyticsJobStatus: "COMPLETED",
    CompletionTime: new Date(),
  };
  ctx.store.set(caJobKey(job.CallAnalyticsJobName), completed);
  return completed;
};

const resolveMedicalJob = (
  ctx: ServiceContext,
  job: StoredMedicalTranscriptionJob,
): StoredMedicalTranscriptionJob => {
  if (job.TranscriptionJobStatus !== "IN_PROGRESS") return job;
  const completed: StoredMedicalTranscriptionJob = {
    ...job,
    TranscriptionJobStatus: "COMPLETED",
    CompletionTime: new Date(),
  };
  ctx.store.set(medJobKey(job.MedicalTranscriptionJobName), completed);
  return completed;
};

const resolveMedicalScribeJob = (
  ctx: ServiceContext,
  job: StoredMedicalScribeJob,
): StoredMedicalScribeJob => {
  if (job.MedicalScribeJobStatus !== "IN_PROGRESS") return job;
  const completed: StoredMedicalScribeJob = {
    ...job,
    MedicalScribeJobStatus: "COMPLETED",
    CompletionTime: new Date(),
  };
  ctx.store.set(medScribeKey(job.MedicalScribeJobName), completed);
  return completed;
};

const StartTranscriptionJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TranscriptionJobName");
  const media = input["Media"];
  if (media === null || typeof media !== "object") {
    throw awsError("BadRequestException", "Media is required.", 400);
  }
  if (ctx.store.get<StoredJob>(jobKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `A job with the name ${name} already exists.`,
      400,
    );
  }
  const settings = input["Settings"];
  if (settings !== null && typeof settings === "object") {
    const s = settings as Record<string, unknown>;
    const vocabName = stringOrUndefined(s["VocabularyName"]);
    if (
      vocabName !== undefined &&
      ctx.store.get(vocabKey(vocabName)) === undefined
    ) {
      throw awsError(
        "BadRequestException",
        `The vocabulary ${vocabName} doesn't exist.`,
        400,
      );
    }
    const vocabFilterName = stringOrUndefined(s["VocabularyFilterName"]);
    if (
      vocabFilterName !== undefined &&
      ctx.store.get(vocabFilterKey(vocabFilterName)) === undefined
    ) {
      throw awsError(
        "BadRequestException",
        `The vocabulary filter ${vocabFilterName} doesn't exist.`,
        400,
      );
    }
  }
  const modelSettings = input["ModelSettings"];
  if (modelSettings !== null && typeof modelSettings === "object") {
    const ms = modelSettings as Record<string, unknown>;
    const langModelName = stringOrUndefined(ms["LanguageModelName"]);
    if (
      langModelName !== undefined &&
      ctx.store.get(langModelKey(langModelName)) === undefined
    ) {
      throw awsError(
        "BadRequestException",
        `The language model ${langModelName} doesn't exist.`,
        400,
      );
    }
  }
  const outputBucket = stringOrUndefined(input["OutputBucketName"]);
  const outputKey = stringOrUndefined(input["OutputKey"]);
  const transcriptUri =
    outputBucket !== undefined
      ? `https://s3.${ctx.region}.amazonaws.com/${outputBucket}/${outputKey ?? `${name}.json`}`
      : `https://s3.${ctx.region}.amazonaws.com/bunsai-transcribe/${name}.json`;
  const now = new Date();
  const tags = parseTags(input["Tags"]);
  const job: StoredJob = {
    TranscriptionJobName: name,
    TranscriptionJobStatus: "IN_PROGRESS",
    LanguageCode: stringOrUndefined(input["LanguageCode"]),
    MediaSampleRateHertz: numberOrUndefined(input["MediaSampleRateHertz"]),
    MediaFormat: stringOrUndefined(input["MediaFormat"]),
    Media: media as Record<string, unknown>,
    Transcript: { TranscriptFileUri: transcriptUri },
    Tags: tags,
    StartTime: now,
    CreationTime: now,
    CompletionTime: undefined,
  };
  ctx.store.set(jobKey(name), job);
  if (tags.length > 0) {
    const arn = `arn:aws:transcribe:${ctx.region}:${ctx.account}:transcription-job/${name}`;
    ctx.store.set(tagsKey(arn), [...tags]);
  }
  return { TranscriptionJob: job };
};

const GetTranscriptionJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TranscriptionJobName");
  const job = resolveTranscriptionJob(ctx, requireJob(ctx, name));
  return { TranscriptionJob: job };
};

const ListTranscriptionJobs: OperationHandler = (input, ctx) => {
  const status = stringOrUndefined(input["Status"]);
  const jobNameContains = input["JobNameContains"];
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const all = ctx.store
    .list<StoredJob>()
    .filter((entry) => entry.key.startsWith("job/"))
    .map((entry) => resolveTranscriptionJob(ctx, entry.value))
    .filter(
      (job) => status === undefined || job.TranscriptionJobStatus === status,
    )
    .filter((job) =>
      matchesNameFilter(job.TranscriptionJobName, jobNameContains),
    )
    .map((job) => ({
      TranscriptionJobName: job.TranscriptionJobName,
      CreationTime: job.CreationTime,
      StartTime: job.StartTime,
      CompletionTime: job.CompletionTime,
      LanguageCode: job.LanguageCode,
      TranscriptionJobStatus: job.TranscriptionJobStatus,
      OutputLocationType: "SERVICE_BUCKET",
    }));
  const { items, nextToken: newNextToken } = applyPagination(
    all,
    maxResults,
    nextToken,
  );
  return { TranscriptionJobSummaries: items, NextToken: newNextToken };
};

const DeleteTranscriptionJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TranscriptionJobName");
  const job = requireJob(ctx, name);
  if (job.TranscriptionJobStatus === "IN_PROGRESS") {
    throw awsError(
      "BadRequestException",
      "Can't delete an in-progress transcription job.",
      400,
    );
  }
  ctx.store.delete(jobKey(name));
  ctx.store.delete(
    tagsKey(
      `arn:aws:transcribe:${ctx.region}:${ctx.account}:transcription-job/${name}`,
    ),
  );
  return {};
};

const CreateVocabulary: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VocabularyName");
  if (ctx.store.get<StoredVocabulary>(vocabKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `A vocabulary with the name ${name} already exists.`,
      400,
    );
  }
  const languageCode = requireString(input, "LanguageCode");
  const now = new Date();
  const vocab: StoredVocabulary = {
    VocabularyName: name,
    LanguageCode: languageCode,
    VocabularyState: "PENDING",
    LastModifiedTime: now,
    VocabularyFileUri: stringOrUndefined(input["VocabularyFileUri"]),
    describeCount: 0,
  };
  ctx.store.set(vocabKey(name), vocab);
  return {
    VocabularyName: vocab.VocabularyName,
    LanguageCode: vocab.LanguageCode,
    VocabularyState: vocab.VocabularyState,
    LastModifiedTime: vocab.LastModifiedTime,
  };
};

const GetVocabulary: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VocabularyName");
  let vocab = requireVocab(ctx, name);
  if (vocab.VocabularyState === "PENDING" && vocab.describeCount >= 1) {
    vocab = { ...vocab, VocabularyState: "READY" };
    ctx.store.set(vocabKey(name), vocab);
  } else if (vocab.VocabularyState === "PENDING") {
    vocab = { ...vocab, describeCount: vocab.describeCount + 1 };
    ctx.store.set(vocabKey(name), vocab);
  }
  return {
    VocabularyName: vocab.VocabularyName,
    LanguageCode: vocab.LanguageCode,
    VocabularyState: vocab.VocabularyState,
    LastModifiedTime: vocab.LastModifiedTime,
    DownloadUri: vocab.VocabularyFileUri,
  };
};

const ListVocabularies: OperationHandler = (input, ctx) => {
  const stateEquals = stringOrUndefined(input["StateEquals"]);
  const nameContains = input["NameContains"];
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const all = ctx.store
    .list<StoredVocabulary>()
    .filter((entry) => entry.key.startsWith("vocab/"))
    .map((entry) => entry.value)
    .filter(
      (v) => stateEquals === undefined || v.VocabularyState === stateEquals,
    )
    .filter((v) => matchesNameFilter(v.VocabularyName, nameContains))
    .map((v) => ({
      VocabularyName: v.VocabularyName,
      LanguageCode: v.LanguageCode,
      LastModifiedTime: v.LastModifiedTime,
      VocabularyState: v.VocabularyState,
    }));
  const { items, nextToken: newNextToken } = applyPagination(
    all,
    maxResults,
    nextToken,
  );
  return { Vocabularies: items, NextToken: newNextToken };
};

const DeleteVocabulary: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VocabularyName");
  requireVocab(ctx, name);
  ctx.store.delete(vocabKey(name));
  return {};
};

const UpdateVocabulary: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VocabularyName");
  const languageCode = requireString(input, "LanguageCode");
  const vocab = requireVocab(ctx, name);
  const now = new Date();
  const updated: StoredVocabulary = {
    ...vocab,
    LanguageCode: languageCode,
    VocabularyState: "PENDING",
    LastModifiedTime: now,
    VocabularyFileUri:
      stringOrUndefined(input["VocabularyFileUri"]) ?? vocab.VocabularyFileUri,
    describeCount: 0,
  };
  ctx.store.set(vocabKey(name), updated);
  return {
    VocabularyName: updated.VocabularyName,
    LanguageCode: updated.LanguageCode,
    LastModifiedTime: updated.LastModifiedTime,
    VocabularyState: updated.VocabularyState,
  };
};

const CreateVocabularyFilter: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VocabularyFilterName");
  if (
    ctx.store.get<StoredVocabularyFilter>(vocabFilterKey(name)) !== undefined
  ) {
    throw awsError(
      "ConflictException",
      `A vocabulary filter with the name ${name} already exists.`,
      400,
    );
  }
  const languageCode = requireString(input, "LanguageCode");
  const now = new Date();
  const filter: StoredVocabularyFilter = {
    VocabularyFilterName: name,
    LanguageCode: languageCode,
    LastModifiedTime: now,
  };
  ctx.store.set(vocabFilterKey(name), filter);
  return {
    VocabularyFilterName: filter.VocabularyFilterName,
    LanguageCode: filter.LanguageCode,
    LastModifiedTime: filter.LastModifiedTime,
  };
};

const GetVocabularyFilter: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VocabularyFilterName");
  const filter = requireVocabFilter(ctx, name);
  return {
    VocabularyFilterName: filter.VocabularyFilterName,
    LanguageCode: filter.LanguageCode,
    LastModifiedTime: filter.LastModifiedTime,
    DownloadUri: undefined,
  };
};

const ListVocabularyFilters: OperationHandler = (input, ctx) => {
  const nameContains = input["NameContains"];
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const all = ctx.store
    .list<StoredVocabularyFilter>()
    .filter((entry) => entry.key.startsWith("vocab-filter/"))
    .map((entry) => entry.value)
    .filter((f) => matchesNameFilter(f.VocabularyFilterName, nameContains))
    .map((f) => ({
      VocabularyFilterName: f.VocabularyFilterName,
      LanguageCode: f.LanguageCode,
      LastModifiedTime: f.LastModifiedTime,
    }));
  const { items, nextToken: newNextToken } = applyPagination(
    all,
    maxResults,
    nextToken,
  );
  return { VocabularyFilters: items, NextToken: newNextToken };
};

const DeleteVocabularyFilter: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VocabularyFilterName");
  requireVocabFilter(ctx, name);
  ctx.store.delete(vocabFilterKey(name));
  return {};
};

const UpdateVocabularyFilter: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VocabularyFilterName");
  const filter = requireVocabFilter(ctx, name);
  const now = new Date();
  const updated: StoredVocabularyFilter = {
    ...filter,
    LastModifiedTime: now,
  };
  ctx.store.set(vocabFilterKey(name), updated);
  return {
    VocabularyFilterName: updated.VocabularyFilterName,
    LanguageCode: updated.LanguageCode,
    LastModifiedTime: updated.LastModifiedTime,
  };
};

const CreateLanguageModel: OperationHandler = (input, ctx) => {
  const modelName = requireString(input, "ModelName");
  if (
    ctx.store.get<StoredLanguageModel>(langModelKey(modelName)) !== undefined
  ) {
    throw awsError(
      "ConflictException",
      `A language model with the name ${modelName} already exists.`,
      400,
    );
  }
  const languageCode = requireString(input, "LanguageCode");
  const baseModelName = requireString(input, "BaseModelName");
  const inputDataConfig = input["InputDataConfig"];
  if (inputDataConfig === null || typeof inputDataConfig !== "object") {
    throw awsError("BadRequestException", "InputDataConfig is required.", 400);
  }
  const now = new Date();
  const stored: StoredLanguageModel = {
    ModelName: modelName,
    LanguageCode: languageCode,
    BaseModelName: baseModelName,
    ModelStatus: "COMPLETED",
    InputDataConfig: inputDataConfig as Record<string, unknown>,
    CreateTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(langModelKey(modelName), stored);
  return {
    LanguageCode: stored.LanguageCode,
    BaseModelName: stored.BaseModelName,
    ModelName: stored.ModelName,
    InputDataConfig: stored.InputDataConfig,
    ModelStatus: stored.ModelStatus,
  };
};

const DescribeLanguageModel: OperationHandler = (input, ctx) => {
  const modelName = requireString(input, "ModelName");
  const stored = requireLanguageModel(ctx, modelName);
  return {
    LanguageModel: {
      ModelName: stored.ModelName,
      CreateTime: stored.CreateTime,
      LastModifiedTime: stored.LastModifiedTime,
      LanguageCode: stored.LanguageCode,
      BaseModelName: stored.BaseModelName,
      ModelStatus: stored.ModelStatus,
      InputDataConfig: stored.InputDataConfig,
    },
  };
};

const ListLanguageModels: OperationHandler = (input, ctx) => {
  const statusEquals = stringOrUndefined(input["StatusEquals"]);
  const nameContains = input["NameContains"];
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const all = ctx.store
    .list<StoredLanguageModel>()
    .filter((entry) => entry.key.startsWith("model/"))
    .map((entry) => entry.value)
    .filter((m) => statusEquals === undefined || m.ModelStatus === statusEquals)
    .filter((m) => matchesNameFilter(m.ModelName, nameContains))
    .map((m) => ({
      ModelName: m.ModelName,
      CreateTime: m.CreateTime,
      LastModifiedTime: m.LastModifiedTime,
      LanguageCode: m.LanguageCode,
      BaseModelName: m.BaseModelName,
      ModelStatus: m.ModelStatus,
      InputDataConfig: m.InputDataConfig,
    }));
  const { items, nextToken: newNextToken } = applyPagination(
    all,
    maxResults,
    nextToken,
  );
  return { Models: items, NextToken: newNextToken };
};

const DeleteLanguageModel: OperationHandler = (input, ctx) => {
  const modelName = requireString(input, "ModelName");
  requireLanguageModel(ctx, modelName);
  ctx.store.delete(langModelKey(modelName));
  return {};
};

const CreateCallAnalyticsCategory: OperationHandler = (input, ctx) => {
  const categoryName = requireString(input, "CategoryName");
  if (
    ctx.store.get<StoredCallAnalyticsCategory>(caCategoryKey(categoryName)) !==
    undefined
  ) {
    throw awsError(
      "ConflictException",
      `A category with the name ${categoryName} already exists.`,
      400,
    );
  }
  const rules = Array.isArray(input["Rules"]) ? input["Rules"] : [];
  const now = new Date();
  const cat: StoredCallAnalyticsCategory = {
    CategoryName: categoryName,
    Rules: rules,
    CreateTime: now,
    LastUpdateTime: now,
    Tags: parseTags(input["Tags"]),
    InputType: stringOrUndefined(input["InputType"]),
  };
  ctx.store.set(caCategoryKey(categoryName), cat);
  return {
    CategoryProperties: {
      CategoryName: cat.CategoryName,
      Rules: cat.Rules,
      CreateTime: cat.CreateTime,
      LastUpdateTime: cat.LastUpdateTime,
      Tags: cat.Tags,
      InputType: cat.InputType,
    },
  };
};

const GetCallAnalyticsCategory: OperationHandler = (input, ctx) => {
  const categoryName = requireString(input, "CategoryName");
  const cat = requireCallAnalyticsCategory(ctx, categoryName);
  return {
    CategoryProperties: {
      CategoryName: cat.CategoryName,
      Rules: cat.Rules,
      CreateTime: cat.CreateTime,
      LastUpdateTime: cat.LastUpdateTime,
      Tags: cat.Tags,
      InputType: cat.InputType,
    },
  };
};

const ListCallAnalyticsCategories: OperationHandler = (input, ctx) => {
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const all = ctx.store
    .list<StoredCallAnalyticsCategory>()
    .filter((entry) => entry.key.startsWith("ca-category/"))
    .map((entry) => entry.value)
    .map((cat) => ({
      CategoryName: cat.CategoryName,
      Rules: cat.Rules,
      CreateTime: cat.CreateTime,
      LastUpdateTime: cat.LastUpdateTime,
      Tags: cat.Tags,
      InputType: cat.InputType,
    }));
  const { items, nextToken: newNextToken } = applyPagination(
    all,
    maxResults,
    nextToken,
  );
  return { Categories: items, NextToken: newNextToken };
};

const DeleteCallAnalyticsCategory: OperationHandler = (input, ctx) => {
  const categoryName = requireString(input, "CategoryName");
  requireCallAnalyticsCategory(ctx, categoryName);
  ctx.store.delete(caCategoryKey(categoryName));
  return {};
};

const UpdateCallAnalyticsCategory: OperationHandler = (input, ctx) => {
  const categoryName = requireString(input, "CategoryName");
  const cat = requireCallAnalyticsCategory(ctx, categoryName);
  const now = new Date();
  const rules = Array.isArray(input["Rules"]) ? input["Rules"] : cat.Rules;
  const updated: StoredCallAnalyticsCategory = {
    ...cat,
    Rules: rules,
    LastUpdateTime: now,
    InputType: stringOrUndefined(input["InputType"]) ?? cat.InputType,
  };
  ctx.store.set(caCategoryKey(categoryName), updated);
  return {
    CategoryProperties: {
      CategoryName: updated.CategoryName,
      Rules: updated.Rules,
      CreateTime: updated.CreateTime,
      LastUpdateTime: updated.LastUpdateTime,
      Tags: updated.Tags,
      InputType: updated.InputType,
    },
  };
};

const StartCallAnalyticsJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CallAnalyticsJobName");
  const media = input["Media"];
  if (media === null || typeof media !== "object") {
    throw awsError("BadRequestException", "Media is required.", 400);
  }
  if (ctx.store.get<StoredCallAnalyticsJob>(caJobKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `A job with the name ${name} already exists.`,
      400,
    );
  }
  const caSettings = input["Settings"];
  if (caSettings !== null && typeof caSettings === "object") {
    const s = caSettings as Record<string, unknown>;
    const vocabName = stringOrUndefined(s["VocabularyName"]);
    if (
      vocabName !== undefined &&
      ctx.store.get(vocabKey(vocabName)) === undefined
    ) {
      throw awsError(
        "BadRequestException",
        `The vocabulary ${vocabName} doesn't exist.`,
        400,
      );
    }
    const vocabFilterName = stringOrUndefined(s["VocabularyFilterName"]);
    if (
      vocabFilterName !== undefined &&
      ctx.store.get(vocabFilterKey(vocabFilterName)) === undefined
    ) {
      throw awsError(
        "BadRequestException",
        `The vocabulary filter ${vocabFilterName} doesn't exist.`,
        400,
      );
    }
    const langModelName = stringOrUndefined(s["LanguageModelName"]);
    if (
      langModelName !== undefined &&
      ctx.store.get(langModelKey(langModelName)) === undefined
    ) {
      throw awsError(
        "BadRequestException",
        `The language model ${langModelName} doesn't exist.`,
        400,
      );
    }
  }
  const now = new Date();
  const tags = parseTags(input["Tags"]);
  const job: StoredCallAnalyticsJob = {
    CallAnalyticsJobName: name,
    CallAnalyticsJobStatus: "IN_PROGRESS",
    LanguageCode: stringOrUndefined(input["LanguageCode"]),
    Media: media as Record<string, unknown>,
    Transcript: {
      TranscriptFileUri: `https://s3.${ctx.region}.amazonaws.com/bunsai-transcribe/ca-${name}.json`,
    },
    StartTime: now,
    CreationTime: now,
    CompletionTime: undefined,
  };
  ctx.store.set(caJobKey(name), job);
  if (tags.length > 0) {
    const arn = `arn:aws:transcribe:${ctx.region}:${ctx.account}:call-analytics-job/${name}`;
    ctx.store.set(tagsKey(arn), [...tags]);
  }
  return { CallAnalyticsJob: job };
};

const GetCallAnalyticsJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CallAnalyticsJobName");
  const job = resolveCallAnalyticsJob(ctx, requireCallAnalyticsJob(ctx, name));
  return { CallAnalyticsJob: job };
};

const ListCallAnalyticsJobs: OperationHandler = (input, ctx) => {
  const status = stringOrUndefined(input["Status"]);
  const jobNameContains = input["JobNameContains"];
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const all = ctx.store
    .list<StoredCallAnalyticsJob>()
    .filter((entry) => entry.key.startsWith("ca-job/"))
    .map((entry) => resolveCallAnalyticsJob(ctx, entry.value))
    .filter((j) => status === undefined || j.CallAnalyticsJobStatus === status)
    .filter((j) => matchesNameFilter(j.CallAnalyticsJobName, jobNameContains))
    .map((j) => ({
      CallAnalyticsJobName: j.CallAnalyticsJobName,
      CreationTime: j.CreationTime,
      StartTime: j.StartTime,
      CompletionTime: j.CompletionTime,
      LanguageCode: j.LanguageCode,
      CallAnalyticsJobStatus: j.CallAnalyticsJobStatus,
    }));
  const { items, nextToken: newNextToken } = applyPagination(
    all,
    maxResults,
    nextToken,
  );
  return { CallAnalyticsJobSummaries: items, NextToken: newNextToken };
};

const DeleteCallAnalyticsJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CallAnalyticsJobName");
  const caJob = requireCallAnalyticsJob(ctx, name);
  if (caJob.CallAnalyticsJobStatus === "IN_PROGRESS") {
    throw awsError(
      "BadRequestException",
      "Can't delete an in-progress call analytics job.",
      400,
    );
  }
  ctx.store.delete(caJobKey(name));
  ctx.store.delete(
    tagsKey(
      `arn:aws:transcribe:${ctx.region}:${ctx.account}:call-analytics-job/${name}`,
    ),
  );
  return {};
};

const CreateMedicalVocabulary: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VocabularyName");
  if (ctx.store.get<StoredMedicalVocabulary>(medVocabKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `A medical vocabulary with the name ${name} already exists.`,
      400,
    );
  }
  const languageCode = requireString(input, "LanguageCode");
  const now = new Date();
  const vocab: StoredMedicalVocabulary = {
    VocabularyName: name,
    LanguageCode: languageCode,
    VocabularyState: "READY",
    LastModifiedTime: now,
    VocabularyFileUri: stringOrUndefined(input["VocabularyFileUri"]),
  };
  ctx.store.set(medVocabKey(name), vocab);
  return {
    VocabularyName: vocab.VocabularyName,
    LanguageCode: vocab.LanguageCode,
    VocabularyState: vocab.VocabularyState,
    LastModifiedTime: vocab.LastModifiedTime,
  };
};

const GetMedicalVocabulary: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VocabularyName");
  const vocab = requireMedicalVocab(ctx, name);
  return {
    VocabularyName: vocab.VocabularyName,
    LanguageCode: vocab.LanguageCode,
    VocabularyState: vocab.VocabularyState,
    LastModifiedTime: vocab.LastModifiedTime,
    DownloadUri: vocab.VocabularyFileUri,
  };
};

const ListMedicalVocabularies: OperationHandler = (input, ctx) => {
  const stateEquals = stringOrUndefined(input["StateEquals"]);
  const nameContains = input["NameContains"];
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const all = ctx.store
    .list<StoredMedicalVocabulary>()
    .filter((entry) => entry.key.startsWith("med-vocab/"))
    .map((entry) => entry.value)
    .filter(
      (v) => stateEquals === undefined || v.VocabularyState === stateEquals,
    )
    .filter((v) => matchesNameFilter(v.VocabularyName, nameContains))
    .map((v) => ({
      VocabularyName: v.VocabularyName,
      LanguageCode: v.LanguageCode,
      LastModifiedTime: v.LastModifiedTime,
      VocabularyState: v.VocabularyState,
    }));
  const { items, nextToken: newNextToken } = applyPagination(
    all,
    maxResults,
    nextToken,
  );
  return { Vocabularies: items, NextToken: newNextToken };
};

const DeleteMedicalVocabulary: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VocabularyName");
  requireMedicalVocab(ctx, name);
  ctx.store.delete(medVocabKey(name));
  return {};
};

const UpdateMedicalVocabulary: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VocabularyName");
  const languageCode = requireString(input, "LanguageCode");
  const vocab = requireMedicalVocab(ctx, name);
  const now = new Date();
  const updated: StoredMedicalVocabulary = {
    ...vocab,
    LanguageCode: languageCode,
    VocabularyState: "READY",
    LastModifiedTime: now,
    VocabularyFileUri:
      stringOrUndefined(input["VocabularyFileUri"]) ?? vocab.VocabularyFileUri,
  };
  ctx.store.set(medVocabKey(name), updated);
  return {
    VocabularyName: updated.VocabularyName,
    LanguageCode: updated.LanguageCode,
    LastModifiedTime: updated.LastModifiedTime,
    VocabularyState: updated.VocabularyState,
  };
};

const StartMedicalTranscriptionJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MedicalTranscriptionJobName");
  const languageCode = requireString(input, "LanguageCode");
  const specialty = requireString(input, "Specialty");
  const type = requireString(input, "Type");
  const media = input["Media"];
  if (media === null || typeof media !== "object") {
    throw awsError("BadRequestException", "Media is required.", 400);
  }
  if (
    ctx.store.get<StoredMedicalTranscriptionJob>(medJobKey(name)) !== undefined
  ) {
    throw awsError(
      "ConflictException",
      `A medical transcription job with the name ${name} already exists.`,
      400,
    );
  }
  const medSettings = input["Settings"];
  if (medSettings !== null && typeof medSettings === "object") {
    const s = medSettings as Record<string, unknown>;
    const medVocabName = stringOrUndefined(s["VocabularyName"]);
    if (
      medVocabName !== undefined &&
      ctx.store.get(medVocabKey(medVocabName)) === undefined
    ) {
      throw awsError(
        "BadRequestException",
        `The vocabulary ${medVocabName} doesn't exist.`,
        400,
      );
    }
  }
  const outputBucket = requireString(input, "OutputBucketName");
  const outputKey = stringOrUndefined(input["OutputKey"]);
  const now = new Date();
  const job: StoredMedicalTranscriptionJob = {
    MedicalTranscriptionJobName: name,
    TranscriptionJobStatus: "IN_PROGRESS",
    LanguageCode: languageCode,
    MediaSampleRateHertz: numberOrUndefined(input["MediaSampleRateHertz"]),
    MediaFormat: stringOrUndefined(input["MediaFormat"]),
    Media: media as Record<string, unknown>,
    Transcript: {
      TranscriptFileUri: `https://s3.${ctx.region}.amazonaws.com/${outputBucket}/${outputKey ?? `med-${name}.json`}`,
    },
    StartTime: now,
    CreationTime: now,
    CompletionTime: undefined,
    Specialty: specialty,
    Type: type,
  };
  ctx.store.set(medJobKey(name), job);
  return { MedicalTranscriptionJob: job };
};

const GetMedicalTranscriptionJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MedicalTranscriptionJobName");
  const job = resolveMedicalJob(ctx, requireMedicalJob(ctx, name));
  return { MedicalTranscriptionJob: job };
};

const ListMedicalTranscriptionJobs: OperationHandler = (input, ctx) => {
  const status = stringOrUndefined(input["Status"]);
  const jobNameContains = input["JobNameContains"];
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const all = ctx.store
    .list<StoredMedicalTranscriptionJob>()
    .filter((entry) => entry.key.startsWith("med-job/"))
    .map((entry) => resolveMedicalJob(ctx, entry.value))
    .filter((j) => status === undefined || j.TranscriptionJobStatus === status)
    .filter((j) =>
      matchesNameFilter(j.MedicalTranscriptionJobName, jobNameContains),
    )
    .map((j) => ({
      MedicalTranscriptionJobName: j.MedicalTranscriptionJobName,
      CreationTime: j.CreationTime,
      StartTime: j.StartTime,
      CompletionTime: j.CompletionTime,
      LanguageCode: j.LanguageCode,
      TranscriptionJobStatus: j.TranscriptionJobStatus,
      OutputLocationType: "CUSTOMER_BUCKET",
      Specialty: j.Specialty,
      Type: j.Type,
    }));
  const { items, nextToken: newNextToken } = applyPagination(
    all,
    maxResults,
    nextToken,
  );
  return { MedicalTranscriptionJobSummaries: items, NextToken: newNextToken };
};

const DeleteMedicalTranscriptionJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MedicalTranscriptionJobName");
  const medJob = requireMedicalJob(ctx, name);
  if (medJob.TranscriptionJobStatus === "IN_PROGRESS") {
    throw awsError(
      "BadRequestException",
      "Can't delete an in-progress medical transcription job.",
      400,
    );
  }
  ctx.store.delete(medJobKey(name));
  ctx.store.delete(
    tagsKey(
      `arn:aws:transcribe:${ctx.region}:${ctx.account}:medical-transcription-job/${name}`,
    ),
  );
  return {};
};

const StartMedicalScribeJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MedicalScribeJobName");
  const media = input["Media"];
  if (media === null || typeof media !== "object") {
    throw awsError("BadRequestException", "Media is required.", 400);
  }
  if (ctx.store.get<StoredMedicalScribeJob>(medScribeKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `A Medical Scribe job with the name ${name} already exists.`,
      400,
    );
  }
  const outputBucket = requireString(input, "OutputBucketName");
  const now = new Date();
  const job: StoredMedicalScribeJob = {
    MedicalScribeJobName: name,
    MedicalScribeJobStatus: "IN_PROGRESS",
    LanguageCode: "en-US",
    Media: media as Record<string, unknown>,
    MedicalScribeOutput: {
      TranscriptFileUri: `https://s3.${ctx.region}.amazonaws.com/${outputBucket}/scribe-${name}-transcript.json`,
      ClinicalDocumentUri: `https://s3.${ctx.region}.amazonaws.com/${outputBucket}/scribe-${name}-clinical.json`,
    },
    StartTime: now,
    CreationTime: now,
    CompletionTime: undefined,
  };
  ctx.store.set(medScribeKey(name), job);
  return { MedicalScribeJob: job };
};

const GetMedicalScribeJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MedicalScribeJobName");
  const job = resolveMedicalScribeJob(ctx, requireMedicalScribeJob(ctx, name));
  return { MedicalScribeJob: job };
};

const ListMedicalScribeJobs: OperationHandler = (input, ctx) => {
  const status = stringOrUndefined(input["Status"]);
  const jobNameContains = input["JobNameContains"];
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const all = ctx.store
    .list<StoredMedicalScribeJob>()
    .filter((entry) => entry.key.startsWith("med-scribe/"))
    .map((entry) => resolveMedicalScribeJob(ctx, entry.value))
    .filter((j) => status === undefined || j.MedicalScribeJobStatus === status)
    .filter((j) => matchesNameFilter(j.MedicalScribeJobName, jobNameContains))
    .map((j) => ({
      MedicalScribeJobName: j.MedicalScribeJobName,
      CreationTime: j.CreationTime,
      StartTime: j.StartTime,
      CompletionTime: j.CompletionTime,
      LanguageCode: j.LanguageCode,
      MedicalScribeJobStatus: j.MedicalScribeJobStatus,
    }));
  const { items, nextToken: newNextToken } = applyPagination(
    all,
    maxResults,
    nextToken,
  );
  return { MedicalScribeJobSummaries: items, NextToken: newNextToken };
};

const DeleteMedicalScribeJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MedicalScribeJobName");
  const scribeJob = requireMedicalScribeJob(ctx, name);
  if (scribeJob.MedicalScribeJobStatus === "IN_PROGRESS") {
    throw awsError(
      "BadRequestException",
      "Can't delete an in-progress medical scribe job.",
      400,
    );
  }
  ctx.store.delete(medScribeKey(name));
  ctx.store.delete(
    tagsKey(
      `arn:aws:transcribe:${ctx.region}:${ctx.account}:medical-scribe-job/${name}`,
    ),
  );
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const newTags = parseTags(input["Tags"]);
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
  const keys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as unknown[]).filter(
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

const transcribe = {
  name: "transcribe",
  protocol: "json",
  operations: {
    StartTranscriptionJob,
    GetTranscriptionJob,
    ListTranscriptionJobs,
    DeleteTranscriptionJob,
    CreateVocabulary,
    GetVocabulary,
    ListVocabularies,
    DeleteVocabulary,
    UpdateVocabulary,
    CreateVocabularyFilter,
    GetVocabularyFilter,
    ListVocabularyFilters,
    DeleteVocabularyFilter,
    UpdateVocabularyFilter,
    CreateLanguageModel,
    DescribeLanguageModel,
    ListLanguageModels,
    DeleteLanguageModel,
    CreateCallAnalyticsCategory,
    GetCallAnalyticsCategory,
    ListCallAnalyticsCategories,
    DeleteCallAnalyticsCategory,
    UpdateCallAnalyticsCategory,
    StartCallAnalyticsJob,
    GetCallAnalyticsJob,
    ListCallAnalyticsJobs,
    DeleteCallAnalyticsJob,
    CreateMedicalVocabulary,
    GetMedicalVocabulary,
    ListMedicalVocabularies,
    DeleteMedicalVocabulary,
    UpdateMedicalVocabulary,
    StartMedicalTranscriptionJob,
    GetMedicalTranscriptionJob,
    ListMedicalTranscriptionJobs,
    DeleteMedicalTranscriptionJob,
    StartMedicalScribeJob,
    GetMedicalScribeJob,
    ListMedicalScribeJobs,
    DeleteMedicalScribeJob,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default transcribe;
