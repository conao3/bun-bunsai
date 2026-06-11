import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import bedrockModel from "../../../../test/vendor/aws-models/bedrock.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(bedrockModel);

const fmPrefix = "fm:" as const;
const customModelPrefix = "cm:" as const;
const guardrailPrefix = "gr:" as const;
const guardrailVersionPrefix = "grv:" as const;
const mcJobPrefix = "mcj:" as const;
const provisionedPrefix = "pt:" as const;
const inferenceProfilePrefix = "ip:" as const;
const evaluationJobPrefix = "ej:" as const;
const modelImportJobPrefix = "mij:" as const;
const modelCopyJobPrefix = "mcpj:" as const;
const modelInvocationJobPrefix = "mvj:" as const;
const importedModelPrefix = "im:" as const;
const promptRouterPrefix = "pr:" as const;
const tagPrefix = "tag:" as const;

type StoredFoundationModel = {
  modelId: string;
  modelArn: string;
  modelName: string;
  providerName: string;
  inputModalities: string[];
  outputModalities: string[];
  responseStreamingSupported: boolean;
  customizationsSupported: string[];
  inferenceTypesSupported: string[];
  modelLifecycle: { status: string };
};

type StoredCustomModel = {
  modelArn: string;
  modelName: string;
  jobArn: string;
  baseModelArn: string;
  customizationType: string;
  modelKmsKeyArn: string | undefined;
  hyperParameters: Record<string, string>;
  trainingMetrics: Record<string, unknown>;
  validationMetrics: unknown[];
  creationTime: number;
};

type StoredGuardrail = {
  guardrailId: string;
  guardrailArn: string;
  name: string;
  description: string | undefined;
  status: string;
  version: string;
  contentPolicy: Record<string, unknown> | undefined;
  wordPolicy: Record<string, unknown> | undefined;
  sensitiveInformationPolicy: Record<string, unknown> | undefined;
  topicPolicy: Record<string, unknown> | undefined;
  contextualGroundingPolicy: Record<string, unknown> | undefined;
  createdAt: number;
  updatedAt: number;
  blockedInputMessaging: string;
  blockedOutputsMessaging: string;
};

type StoredModelCustomizationJob = {
  jobArn: string;
  jobName: string;
  outputModelArn: string;
  outputModelName: string;
  baseModelArn: string;
  customizationType: string;
  roleArn: string;
  status: string;
  creationTime: number;
  lastModifiedTime: number;
  endTime: number | undefined;
  trainingDataConfig: Record<string, unknown>;
  outputDataConfig: Record<string, unknown>;
  hyperParameters: Record<string, string>;
};

type StoredProvisionedModel = {
  provisionedModelArn: string;
  provisionedModelName: string;
  modelArn: string;
  desiredModelUnits: number;
  provisionedModelUnits: number;
  status: string;
  commitmentDuration: string | undefined;
  commitmentExpirationTime: number | undefined;
  creationTime: number;
  lastModifiedTime: number;
};

type StoredInferenceProfile = {
  inferenceProfileArn: string;
  inferenceProfileId: string;
  inferenceProfileName: string;
  description: string | undefined;
  type: string;
  models: unknown[];
  status: string;
  createdAt: number;
  updatedAt: number;
};

type StoredEvaluationJob = {
  jobArn: string;
  jobName: string;
  jobDescription: string | undefined;
  roleArn: string;
  status: string;
  evaluationConfig: Record<string, unknown>;
  inferenceConfig: Record<string, unknown>;
  outputDataConfig: Record<string, unknown>;
  creationTime: number;
  lastModifiedTime: number;
};

type StoredModelImportJob = {
  jobArn: string;
  jobName: string;
  importedModelArn: string;
  importedModelName: string;
  roleArn: string;
  modelDataSource: Record<string, unknown>;
  status: string;
  creationTime: number;
  lastModifiedTime: number;
  endTime: number | undefined;
};

type StoredImportedModel = {
  modelArn: string;
  modelName: string;
  jobArn: string;
  jobName: string;
  modelDataSource: Record<string, unknown>;
  creationTime: number;
  instructSupported: boolean;
};

type StoredModelCopyJob = {
  jobArn: string;
  sourceModelArn: string;
  targetModelArn: string;
  targetModelName: string;
  status: string;
  creationTime: number;
  targetModelKmsKeyArn: string | undefined;
};

type StoredModelInvocationJob = {
  jobArn: string;
  jobName: string;
  roleArn: string;
  modelId: string;
  status: string;
  inputDataConfig: Record<string, unknown>;
  outputDataConfig: Record<string, unknown>;
  submitTime: number;
  lastModifiedTime: number;
  endTime: number | undefined;
};

type StoredPromptRouter = {
  promptRouterArn: string;
  promptRouterName: string;
  description: string | undefined;
  type: string;
  models: unknown[];
  routingCriteria: Record<string, unknown>;
  status: string;
  createdAt: number;
  updatedAt: number;
};

const SEED_FOUNDATION_MODELS: StoredFoundationModel[] = [
  {
    modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0",
    modelName: "Claude 3.5 Sonnet v2",
    providerName: "Anthropic",
    inputModalities: ["TEXT", "IMAGE"],
    outputModalities: ["TEXT"],
    responseStreamingSupported: true,
    customizationsSupported: [],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "ACTIVE" },
  },
  {
    modelId: "anthropic.claude-3-5-haiku-20241022-v1:0",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0",
    modelName: "Claude 3.5 Haiku",
    providerName: "Anthropic",
    inputModalities: ["TEXT", "IMAGE"],
    outputModalities: ["TEXT"],
    responseStreamingSupported: true,
    customizationsSupported: [],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "ACTIVE" },
  },
  {
    modelId: "anthropic.claude-3-opus-20240229-v1:0",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-opus-20240229-v1:0",
    modelName: "Claude 3 Opus",
    providerName: "Anthropic",
    inputModalities: ["TEXT", "IMAGE"],
    outputModalities: ["TEXT"],
    responseStreamingSupported: true,
    customizationsSupported: ["FINE_TUNING"],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "ACTIVE" },
  },
  {
    modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
    modelName: "Claude 3 Sonnet",
    providerName: "Anthropic",
    inputModalities: ["TEXT", "IMAGE"],
    outputModalities: ["TEXT"],
    responseStreamingSupported: true,
    customizationsSupported: ["FINE_TUNING"],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "ACTIVE" },
  },
  {
    modelId: "anthropic.claude-3-haiku-20240307-v1:0",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0",
    modelName: "Claude 3 Haiku",
    providerName: "Anthropic",
    inputModalities: ["TEXT", "IMAGE"],
    outputModalities: ["TEXT"],
    responseStreamingSupported: true,
    customizationsSupported: ["FINE_TUNING"],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "ACTIVE" },
  },
  {
    modelId: "anthropic.claude-instant-v1",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-instant-v1",
    modelName: "Claude Instant",
    providerName: "Anthropic",
    inputModalities: ["TEXT"],
    outputModalities: ["TEXT"],
    responseStreamingSupported: true,
    customizationsSupported: ["FINE_TUNING"],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "LEGACY" },
  },
  {
    modelId: "anthropic.claude-v2:1",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-v2:1",
    modelName: "Claude",
    providerName: "Anthropic",
    inputModalities: ["TEXT"],
    outputModalities: ["TEXT"],
    responseStreamingSupported: true,
    customizationsSupported: ["FINE_TUNING"],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "LEGACY" },
  },
  {
    modelId: "amazon.titan-text-premier-v1:0",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-text-premier-v1:0",
    modelName: "Titan Text G1 - Premier",
    providerName: "Amazon",
    inputModalities: ["TEXT"],
    outputModalities: ["TEXT"],
    responseStreamingSupported: true,
    customizationsSupported: ["FINE_TUNING"],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "ACTIVE" },
  },
  {
    modelId: "amazon.titan-text-express-v1",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-text-express-v1",
    modelName: "Titan Text G1 - Express",
    providerName: "Amazon",
    inputModalities: ["TEXT"],
    outputModalities: ["TEXT"],
    responseStreamingSupported: true,
    customizationsSupported: ["FINE_TUNING", "CONTINUED_PRE_TRAINING"],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "ACTIVE" },
  },
  {
    modelId: "amazon.titan-text-lite-v1",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-text-lite-v1",
    modelName: "Titan Text G1 - Lite",
    providerName: "Amazon",
    inputModalities: ["TEXT"],
    outputModalities: ["TEXT"],
    responseStreamingSupported: true,
    customizationsSupported: ["FINE_TUNING", "CONTINUED_PRE_TRAINING"],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "ACTIVE" },
  },
  {
    modelId: "amazon.titan-embed-text-v1",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1",
    modelName: "Titan Embeddings G1 - Text",
    providerName: "Amazon",
    inputModalities: ["TEXT"],
    outputModalities: ["EMBEDDING"],
    responseStreamingSupported: false,
    customizationsSupported: [],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "ACTIVE" },
  },
  {
    modelId: "amazon.titan-embed-text-v2:0",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0",
    modelName: "Titan Text Embeddings V2",
    providerName: "Amazon",
    inputModalities: ["TEXT"],
    outputModalities: ["EMBEDDING"],
    responseStreamingSupported: false,
    customizationsSupported: [],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "ACTIVE" },
  },
  {
    modelId: "amazon.titan-image-generator-v2:0",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-image-generator-v2:0",
    modelName: "Titan Image Generator G1 V2",
    providerName: "Amazon",
    inputModalities: ["TEXT", "IMAGE"],
    outputModalities: ["IMAGE"],
    responseStreamingSupported: false,
    customizationsSupported: [],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "ACTIVE" },
  },
  {
    modelId: "meta.llama3-70b-instruct-v1:0",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/meta.llama3-70b-instruct-v1:0",
    modelName: "Llama 3 70B Instruct",
    providerName: "Meta",
    inputModalities: ["TEXT"],
    outputModalities: ["TEXT"],
    responseStreamingSupported: true,
    customizationsSupported: [],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "ACTIVE" },
  },
  {
    modelId: "meta.llama3-8b-instruct-v1:0",
    modelArn:
      "arn:aws:bedrock:us-east-1::foundation-model/meta.llama3-8b-instruct-v1:0",
    modelName: "Llama 3 8B Instruct",
    providerName: "Meta",
    inputModalities: ["TEXT"],
    outputModalities: ["TEXT"],
    responseStreamingSupported: true,
    customizationsSupported: [],
    inferenceTypesSupported: ["ON_DEMAND"],
    modelLifecycle: { status: "ACTIVE" },
  },
];

const initFoundationModels = (ctx: ServiceContext): void => {
  for (const fm of SEED_FOUNDATION_MODELS) {
    const key = `${fmPrefix}${fm.modelId}`;
    if (ctx.store.get(key) === undefined) ctx.store.set(key, fm);
  }
};

const fmSummary = (fm: StoredFoundationModel) => ({
  modelId: fm.modelId,
  modelArn: fm.modelArn,
  modelName: fm.modelName,
  providerName: fm.providerName,
  inputModalities: fm.inputModalities,
  outputModalities: fm.outputModalities,
  responseStreamingSupported: fm.responseStreamingSupported,
  customizationsSupported: fm.customizationsSupported,
  inferenceTypesSupported: fm.inferenceTypesSupported,
  modelLifecycle: fm.modelLifecycle,
});

const modelArn = (region: string, account: string, modelId: string) =>
  `arn:aws:bedrock:${region}:${account}:custom-model/${modelId}`;

const guardrailArn = (region: string, account: string, id: string) =>
  `arn:aws:bedrock:${region}:${account}:guardrail/${id}`;

const provisionedArn = (region: string, account: string, id: string) =>
  `arn:aws:bedrock:${region}:${account}:provisioned-model/${id}`;

const inferenceProfileArn = (region: string, account: string, id: string) =>
  `arn:aws:bedrock:${region}:${account}:inference-profile/${id}`;

const evaluationJobArn = (region: string, account: string, id: string) =>
  `arn:aws:bedrock:${region}:${account}:evaluation-job/${id}`;

const mcJobArn = (region: string, account: string, id: string) =>
  `arn:aws:bedrock:${region}:${account}:model-customization-job/${id}`;

const importJobArn = (region: string, account: string, id: string) =>
  `arn:aws:bedrock:${region}:${account}:model-import-job/${id}`;

const importedModelArn = (region: string, account: string, name: string) =>
  `arn:aws:bedrock:${region}:${account}:imported-model/${name}`;

const copyJobArn = (region: string, account: string, id: string) =>
  `arn:aws:bedrock:${region}:${account}:model-copy-job/${id}`;

const invocationJobArn = (region: string, account: string, id: string) =>
  `arn:aws:bedrock:${region}:${account}:model-invocation-job/${id}`;

const promptRouterArn = (region: string, account: string, id: string) =>
  `arn:aws:bedrock:${region}:${account}:default-prompt-router/${id}`;

const nowSec = (): number => Math.floor(Date.now() / 1000);

const randomId = (): string =>
  Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");

const guardedGet = <T>(ctx: ServiceContext, key: string, name: string): T => {
  const val = ctx.store.get<T>(key);
  if (val === undefined)
    throw awsError("ResourceNotFoundException", `${name} not found`, 404);
  return val;
};

const tagKey = (resourceArn: string) => `${tagPrefix}${resourceArn}`;

const getTags = (ctx: ServiceContext, arn: string): Record<string, string> =>
  ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};

const setTags = (
  ctx: ServiceContext,
  arn: string,
  tags: Record<string, string>,
): void => {
  ctx.store.set(tagKey(arn), tags);
};

const applyTags = (
  ctx: ServiceContext,
  arn: string,
  newTags: unknown,
): void => {
  if (!newTags || typeof newTags !== "object") return;
  const current = getTags(ctx, arn);
  for (const [k, v] of Object.entries(newTags as Record<string, string>)) {
    current[k] = v;
  }
  setTags(ctx, arn, current);
};

const tagsArray = (tags: Record<string, string>) =>
  Object.entries(tags).map(([key, value]) => ({ key, value }));

const paginateList = <T>(
  items: T[],
  maxResults: number | undefined,
  nextToken: unknown,
): { items: T[]; nextToken: string | undefined } => {
  const max = Math.min(maxResults ?? 100, 1000);
  let start = 0;
  if (typeof nextToken === "string" && nextToken !== "") {
    start = parseInt(nextToken, 10);
    if (isNaN(start) || start < 0) start = 0;
  }
  const slice = items.slice(start, start + max);
  const hasMore = start + max < items.length;
  return {
    items: slice,
    nextToken: hasMore ? String(start + max) : undefined,
  };
};

const ListFoundationModels: OperationHandler = (input, ctx) => {
  initFoundationModels(ctx);
  const all = ctx.store
    .list<StoredFoundationModel>()
    .filter((e) => e.key.startsWith(fmPrefix))
    .map((e) => e.value);

  const byProvider = input["byProvider"] as string | undefined;
  const byOutputModality = input["byOutputModality"] as string | undefined;
  const byInferenceType = input["byInferenceType"] as string | undefined;
  const byCustomizationType = input["byCustomizationType"] as
    | string
    | undefined;

  let filtered = all;
  if (byProvider)
    filtered = filtered.filter(
      (m) => m.providerName.toLowerCase() === byProvider.toLowerCase(),
    );
  if (byOutputModality)
    filtered = filtered.filter((m) =>
      m.outputModalities.includes(byOutputModality),
    );
  if (byInferenceType)
    filtered = filtered.filter((m) =>
      m.inferenceTypesSupported.includes(byInferenceType),
    );
  if (byCustomizationType)
    filtered = filtered.filter((m) =>
      m.customizationsSupported.includes(byCustomizationType),
    );

  return { modelSummaries: filtered.map(fmSummary) };
};

const GetFoundationModel: OperationHandler = (input, ctx) => {
  initFoundationModels(ctx);
  const id = input["modelIdentifier"] as string;
  const fm = ctx.store.get<StoredFoundationModel>(`${fmPrefix}${id}`);
  if (fm === undefined)
    throw awsError("ResourceNotFoundException", `Model ${id} not found`, 404);
  return { modelDetails: fmSummary(fm) };
};

const GetFoundationModelAvailability: OperationHandler = (input, ctx) => {
  initFoundationModels(ctx);
  const id = input["modelId"] as string;
  const fm = ctx.store.get<StoredFoundationModel>(`${fmPrefix}${id}`);
  if (fm === undefined)
    throw awsError("ResourceNotFoundException", `Model ${id} not found`, 404);
  return {
    agreementAvailability: { status: "AVAILABLE" },
    authorizationStatus: "AUTHORIZED",
    entitlementAvailability: "AVAILABLE",
    regionAvailability: "AVAILABLE",
  };
};

const CreateCustomModel: OperationHandler = (input, ctx) => {
  const name = input["modelName"] as string;
  const baseModelId = input["baseModelIdentifier"] as string;
  const customizationType =
    (input["customizationType"] as string) ?? "FINE_TUNING";
  const { region, account } = ctx;
  const id = `${name}-${randomId()}`;
  const arn = modelArn(region, account, name);
  const stored: StoredCustomModel = {
    modelArn: arn,
    modelName: name,
    jobArn: mcJobArn(region, account, id),
    baseModelArn: `arn:aws:bedrock:${region}::foundation-model/${baseModelId}`,
    customizationType,
    modelKmsKeyArn: input["modelKmsKeyId"] as string | undefined,
    hyperParameters: (input["hyperParameters"] as Record<string, string>) ?? {},
    trainingMetrics: {},
    validationMetrics: [],
    creationTime: nowSec(),
  };
  ctx.store.set(`${customModelPrefix}${name}`, stored);
  if (input["tags"]) applyTags(ctx, arn, input["tags"]);
  return { modelArn: arn };
};

const GetCustomModel: OperationHandler = (input, ctx) => {
  const id = input["modelIdentifier"] as string;
  const cm = guardedGet<StoredCustomModel>(
    ctx,
    `${customModelPrefix}${id}`,
    "Custom model",
  );
  return {
    modelArn: cm.modelArn,
    modelName: cm.modelName,
    jobArn: cm.jobArn,
    baseModelArn: cm.baseModelArn,
    customizationType: cm.customizationType,
    modelKmsKeyArn: cm.modelKmsKeyArn,
    hyperParameters: cm.hyperParameters,
    trainingMetrics: cm.trainingMetrics,
    validationMetrics: cm.validationMetrics,
    creationTime: cm.creationTime,
  };
};

const DeleteCustomModel: OperationHandler = (input, ctx) => {
  const id = input["modelIdentifier"] as string;
  guardedGet<StoredCustomModel>(
    ctx,
    `${customModelPrefix}${id}`,
    "Custom model",
  );
  ctx.store.delete(`${customModelPrefix}${id}`);
  return {};
};

const ListCustomModels: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredCustomModel>()
    .filter((e) => e.key.startsWith(customModelPrefix))
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return {
    modelSummaries: items.map((m) => ({
      modelArn: m.modelArn,
      modelName: m.modelName,
      creationTime: m.creationTime,
      baseModelArn: m.baseModelArn,
      baseModelName: m.baseModelArn.split("/").pop(),
      customizationType: m.customizationType,
    })),
    nextToken,
  };
};

const CreateGuardrail: OperationHandler = (input, ctx) => {
  const name = input["name"] as string;
  const { region, account } = ctx;
  const id = randomId();
  const arn = guardrailArn(region, account, id);
  const now = nowSec();
  const stored: StoredGuardrail = {
    guardrailId: id,
    guardrailArn: arn,
    name,
    description: input["description"] as string | undefined,
    status: "READY",
    version: "DRAFT",
    contentPolicy: input["contentPolicyConfig"] as
      | Record<string, unknown>
      | undefined,
    wordPolicy: input["wordPolicyConfig"] as
      | Record<string, unknown>
      | undefined,
    sensitiveInformationPolicy: input["sensitiveInformationPolicyConfig"] as
      | Record<string, unknown>
      | undefined,
    topicPolicy: input["topicPolicyConfig"] as
      | Record<string, unknown>
      | undefined,
    contextualGroundingPolicy: input["contextualGroundingPolicyConfig"] as
      | Record<string, unknown>
      | undefined,
    createdAt: now,
    updatedAt: now,
    blockedInputMessaging:
      (input["blockedInputMessaging"] as string) ?? "Blocked",
    blockedOutputsMessaging:
      (input["blockedOutputsMessaging"] as string) ?? "Blocked",
  };
  ctx.store.set(`${guardrailPrefix}${id}`, stored);
  ctx.store.set(`${guardrailPrefix}name:${name}`, id);
  if (input["tags"]) applyTags(ctx, arn, input["tags"]);
  return {
    guardrailId: id,
    guardrailArn: arn,
    version: "DRAFT",
    createdAt: now,
  };
};

const GetGuardrail: OperationHandler = (input, ctx) => {
  const id = input["guardrailIdentifier"] as string;
  const gr = guardedGet<StoredGuardrail>(
    ctx,
    `${guardrailPrefix}${id}`,
    "Guardrail",
  );
  return {
    guardrailId: gr.guardrailId,
    guardrailArn: gr.guardrailArn,
    name: gr.name,
    description: gr.description,
    status: gr.status,
    version: gr.version,
    topicPolicy: gr.topicPolicy,
    contentPolicy: gr.contentPolicy,
    wordPolicy: gr.wordPolicy,
    sensitiveInformationPolicy: gr.sensitiveInformationPolicy,
    contextualGroundingPolicy: gr.contextualGroundingPolicy,
    createdAt: gr.createdAt,
    updatedAt: gr.updatedAt,
    blockedInputMessaging: gr.blockedInputMessaging,
    blockedOutputsMessaging: gr.blockedOutputsMessaging,
  };
};

const UpdateGuardrail: OperationHandler = (input, ctx) => {
  const id = input["guardrailIdentifier"] as string;
  const gr = guardedGet<StoredGuardrail>(
    ctx,
    `${guardrailPrefix}${id}`,
    "Guardrail",
  );
  const updated: StoredGuardrail = {
    ...gr,
    name: (input["name"] as string) ?? gr.name,
    description: (input["description"] as string | undefined) ?? gr.description,
    contentPolicy:
      (input["contentPolicyConfig"] as Record<string, unknown> | undefined) ??
      gr.contentPolicy,
    wordPolicy:
      (input["wordPolicyConfig"] as Record<string, unknown> | undefined) ??
      gr.wordPolicy,
    sensitiveInformationPolicy:
      (input["sensitiveInformationPolicyConfig"] as
        | Record<string, unknown>
        | undefined) ?? gr.sensitiveInformationPolicy,
    topicPolicy:
      (input["topicPolicyConfig"] as Record<string, unknown> | undefined) ??
      gr.topicPolicy,
    contextualGroundingPolicy:
      (input["contextualGroundingPolicyConfig"] as
        | Record<string, unknown>
        | undefined) ?? gr.contextualGroundingPolicy,
    blockedInputMessaging:
      (input["blockedInputMessaging"] as string) ?? gr.blockedInputMessaging,
    blockedOutputsMessaging:
      (input["blockedOutputsMessaging"] as string) ??
      gr.blockedOutputsMessaging,
    updatedAt: nowSec(),
  };
  ctx.store.set(`${guardrailPrefix}${id}`, updated);
  return {
    guardrailId: id,
    guardrailArn: gr.guardrailArn,
    version: updated.version,
    updatedAt: updated.updatedAt,
  };
};

const DeleteGuardrail: OperationHandler = (input, ctx) => {
  const id = input["guardrailIdentifier"] as string;
  const gr = guardedGet<StoredGuardrail>(
    ctx,
    `${guardrailPrefix}${id}`,
    "Guardrail",
  );
  ctx.store.delete(`${guardrailPrefix}${id}`);
  ctx.store.delete(`${guardrailPrefix}name:${gr.name}`);
  return {};
};

const ListGuardrails: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredGuardrail>()
    .filter(
      (e) =>
        e.key.startsWith(guardrailPrefix) &&
        !e.key.includes("name:") &&
        !e.key.includes("ver:"),
    )
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return {
    guardrails: items.map((g) => ({
      guardrailId: g.guardrailId,
      guardrailArn: g.guardrailArn,
      name: g.name,
      description: g.description,
      status: g.status,
      version: g.version,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    })),
    nextToken,
  };
};

const CreateGuardrailVersion: OperationHandler = (input, ctx) => {
  const id = input["guardrailIdentifier"] as string;
  const gr = guardedGet<StoredGuardrail>(
    ctx,
    `${guardrailPrefix}${id}`,
    "Guardrail",
  );
  const versionNum =
    (ctx.store.get<number>(`${guardrailVersionPrefix}${id}:count`) ?? 0) + 1;
  ctx.store.set(`${guardrailVersionPrefix}${id}:count`, versionNum);
  const version = String(versionNum);
  ctx.store.set(`${guardrailVersionPrefix}${id}:${version}`, {
    ...gr,
    version,
  });
  return {
    guardrailId: id,
    version,
  };
};

const CreateModelCustomizationJob: OperationHandler = (input, ctx) => {
  const name = input["jobName"] as string;
  const { region, account } = ctx;
  const id = randomId();
  const arn = mcJobArn(region, account, id);
  const outputModelName = input["customModelName"] as string;
  const now = nowSec();
  const stored: StoredModelCustomizationJob = {
    jobArn: arn,
    jobName: name,
    outputModelArn: modelArn(region, account, outputModelName),
    outputModelName,
    baseModelArn: `arn:aws:bedrock:${region}::foundation-model/${input["baseModelIdentifier"]}`,
    customizationType: (input["customizationType"] as string) ?? "FINE_TUNING",
    roleArn: input["roleArn"] as string,
    status: "InProgress",
    creationTime: now,
    lastModifiedTime: now,
    endTime: undefined,
    trainingDataConfig:
      (input["trainingDataConfig"] as Record<string, unknown>) ?? {},
    outputDataConfig:
      (input["outputDataConfig"] as Record<string, unknown>) ?? {},
    hyperParameters: (input["hyperParameters"] as Record<string, string>) ?? {},
  };
  ctx.store.set(`${mcJobPrefix}${id}`, stored);
  ctx.store.set(`${mcJobPrefix}name:${name}`, id);
  if (input["customModelTags"]) applyTags(ctx, arn, input["customModelTags"]);
  return { jobArn: arn };
};

const GetModelCustomizationJob: OperationHandler = (input, ctx) => {
  const id = input["jobIdentifier"] as string;
  const job = guardedGet<StoredModelCustomizationJob>(
    ctx,
    `${mcJobPrefix}${id}`,
    "Model customization job",
  );
  return {
    jobArn: job.jobArn,
    jobName: job.jobName,
    outputModelArn: job.outputModelArn,
    outputModelName: job.outputModelName,
    baseModelArn: job.baseModelArn,
    customizationType: job.customizationType,
    roleArn: job.roleArn,
    status: job.status,
    creationTime: job.creationTime,
    lastModifiedTime: job.lastModifiedTime,
    endTime: job.endTime,
    trainingDataConfig: job.trainingDataConfig,
    outputDataConfig: job.outputDataConfig,
    hyperParameters: job.hyperParameters,
  };
};

const ListModelCustomizationJobs: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredModelCustomizationJob>()
    .filter((e) => e.key.startsWith(mcJobPrefix) && !e.key.includes("name:"))
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return {
    modelCustomizationJobSummaries: items.map((j) => ({
      jobArn: j.jobArn,
      jobName: j.jobName,
      status: j.status,
      baseModelArn: j.baseModelArn,
      customizationType: j.customizationType,
      outputModelArn: j.outputModelArn,
      creationTime: j.creationTime,
      lastModifiedTime: j.lastModifiedTime,
      endTime: j.endTime,
    })),
    nextToken,
  };
};

const StopModelCustomizationJob: OperationHandler = (input, ctx) => {
  const id = input["jobIdentifier"] as string;
  const job = guardedGet<StoredModelCustomizationJob>(
    ctx,
    `${mcJobPrefix}${id}`,
    "Model customization job",
  );
  ctx.store.set(`${mcJobPrefix}${id}`, {
    ...job,
    status: "Stopping",
    lastModifiedTime: nowSec(),
  });
  return {};
};

const CreateProvisionedModelThroughput: OperationHandler = (input, ctx) => {
  const name = input["provisionedModelName"] as string;
  const { region, account } = ctx;
  const id = randomId();
  const arn = provisionedArn(region, account, id);
  const now = nowSec();
  const stored: StoredProvisionedModel = {
    provisionedModelArn: arn,
    provisionedModelName: name,
    modelArn: `arn:aws:bedrock:${region}::foundation-model/${input["modelId"]}`,
    desiredModelUnits: (input["modelUnits"] as number) ?? 1,
    provisionedModelUnits: (input["modelUnits"] as number) ?? 1,
    status: "InService",
    commitmentDuration: input["commitmentDuration"] as string | undefined,
    commitmentExpirationTime: undefined,
    creationTime: now,
    lastModifiedTime: now,
  };
  ctx.store.set(`${provisionedPrefix}${id}`, stored);
  ctx.store.set(`${provisionedPrefix}name:${name}`, id);
  if (input["tags"]) applyTags(ctx, arn, input["tags"]);
  return { provisionedModelArn: arn };
};

const GetProvisionedModelThroughput: OperationHandler = (input, ctx) => {
  const id = input["provisionedModelId"] as string;
  const pm = guardedGet<StoredProvisionedModel>(
    ctx,
    `${provisionedPrefix}${id}`,
    "Provisioned model",
  );
  return {
    provisionedModelArn: pm.provisionedModelArn,
    provisionedModelName: pm.provisionedModelName,
    modelArn: pm.modelArn,
    desiredModelUnits: pm.desiredModelUnits,
    provisionedModelUnits: pm.provisionedModelUnits,
    status: pm.status,
    commitmentDuration: pm.commitmentDuration,
    commitmentExpirationTime: pm.commitmentExpirationTime,
    creationTime: pm.creationTime,
    lastModifiedTime: pm.lastModifiedTime,
  };
};

const UpdateProvisionedModelThroughput: OperationHandler = (input, ctx) => {
  const id = input["provisionedModelId"] as string;
  const pm = guardedGet<StoredProvisionedModel>(
    ctx,
    `${provisionedPrefix}${id}`,
    "Provisioned model",
  );
  ctx.store.set(`${provisionedPrefix}${id}`, {
    ...pm,
    desiredModelUnits:
      (input["desiredModelUnits"] as number) ?? pm.desiredModelUnits,
    lastModifiedTime: nowSec(),
  });
  return {};
};

const DeleteProvisionedModelThroughput: OperationHandler = (input, ctx) => {
  const id = input["provisionedModelId"] as string;
  const pm = guardedGet<StoredProvisionedModel>(
    ctx,
    `${provisionedPrefix}${id}`,
    "Provisioned model",
  );
  ctx.store.delete(`${provisionedPrefix}${id}`);
  ctx.store.delete(`${provisionedPrefix}name:${pm.provisionedModelName}`);
  return {};
};

const ListProvisionedModelThroughputs: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredProvisionedModel>()
    .filter(
      (e) => e.key.startsWith(provisionedPrefix) && !e.key.includes("name:"),
    )
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return {
    provisionedModelSummaries: items.map((p) => ({
      provisionedModelArn: p.provisionedModelArn,
      provisionedModelName: p.provisionedModelName,
      modelArn: p.modelArn,
      desiredModelUnits: p.desiredModelUnits,
      provisionedModelUnits: p.provisionedModelUnits,
      status: p.status,
      commitmentDuration: p.commitmentDuration,
      creationTime: p.creationTime,
      lastModifiedTime: p.lastModifiedTime,
    })),
    nextToken,
  };
};

const CreateInferenceProfile: OperationHandler = (input, ctx) => {
  const name = input["inferenceProfileName"] as string;
  const { region, account } = ctx;
  const id = randomId();
  const arn = inferenceProfileArn(region, account, id);
  const now = nowSec();
  const stored: StoredInferenceProfile = {
    inferenceProfileArn: arn,
    inferenceProfileId: id,
    inferenceProfileName: name,
    description: input["description"] as string | undefined,
    type: "APPLICATION",
    models: (input["modelSource"] as unknown[]) ?? [],
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
  ctx.store.set(`${inferenceProfilePrefix}${id}`, stored);
  if (input["tags"]) applyTags(ctx, arn, input["tags"]);
  return {
    inferenceProfileArn: arn,
    status: "ACTIVE",
  };
};

const GetInferenceProfile: OperationHandler = (input, ctx) => {
  const id = input["inferenceProfileIdentifier"] as string;
  const ip = guardedGet<StoredInferenceProfile>(
    ctx,
    `${inferenceProfilePrefix}${id}`,
    "Inference profile",
  );
  return {
    inferenceProfileArn: ip.inferenceProfileArn,
    inferenceProfileId: ip.inferenceProfileId,
    inferenceProfileName: ip.inferenceProfileName,
    description: ip.description,
    type: ip.type,
    models: ip.models,
    status: ip.status,
    createdAt: ip.createdAt,
    updatedAt: ip.updatedAt,
  };
};

const DeleteInferenceProfile: OperationHandler = (input, ctx) => {
  const id = input["inferenceProfileIdentifier"] as string;
  guardedGet<StoredInferenceProfile>(
    ctx,
    `${inferenceProfilePrefix}${id}`,
    "Inference profile",
  );
  ctx.store.delete(`${inferenceProfilePrefix}${id}`);
  return {};
};

const ListInferenceProfiles: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredInferenceProfile>()
    .filter((e) => e.key.startsWith(inferenceProfilePrefix))
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return {
    inferenceProfileSummaries: items.map((p) => ({
      inferenceProfileArn: p.inferenceProfileArn,
      inferenceProfileId: p.inferenceProfileId,
      inferenceProfileName: p.inferenceProfileName,
      description: p.description,
      type: p.type,
      models: p.models,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    nextToken,
  };
};

const CreateEvaluationJob: OperationHandler = (input, ctx) => {
  const name = input["jobName"] as string;
  const { region, account } = ctx;
  const id = randomId();
  const arn = evaluationJobArn(region, account, id);
  const now = nowSec();
  const stored: StoredEvaluationJob = {
    jobArn: arn,
    jobName: name,
    jobDescription: input["jobDescription"] as string | undefined,
    roleArn: input["roleArn"] as string,
    status: "InProgress",
    evaluationConfig:
      (input["evaluationConfig"] as Record<string, unknown>) ?? {},
    inferenceConfig:
      (input["inferenceConfig"] as Record<string, unknown>) ?? {},
    outputDataConfig:
      (input["outputDataConfig"] as Record<string, unknown>) ?? {},
    creationTime: now,
    lastModifiedTime: now,
  };
  ctx.store.set(`${evaluationJobPrefix}${id}`, stored);
  return { jobArn: arn };
};

const GetEvaluationJob: OperationHandler = (input, ctx) => {
  const id = input["jobIdentifier"] as string;
  const job = guardedGet<StoredEvaluationJob>(
    ctx,
    `${evaluationJobPrefix}${id}`,
    "Evaluation job",
  );
  return {
    jobArn: job.jobArn,
    jobName: job.jobName,
    jobDescription: job.jobDescription,
    roleArn: job.roleArn,
    status: job.status,
    evaluationConfig: job.evaluationConfig,
    inferenceConfig: job.inferenceConfig,
    outputDataConfig: job.outputDataConfig,
    creationTime: job.creationTime,
    lastModifiedTime: job.lastModifiedTime,
  };
};

const StopEvaluationJob: OperationHandler = (input, ctx) => {
  const id = input["jobIdentifier"] as string;
  const job = guardedGet<StoredEvaluationJob>(
    ctx,
    `${evaluationJobPrefix}${id}`,
    "Evaluation job",
  );
  ctx.store.set(`${evaluationJobPrefix}${id}`, {
    ...job,
    status: "Stopping",
    lastModifiedTime: nowSec(),
  });
  return {};
};

const BatchDeleteEvaluationJob: OperationHandler = (input, ctx) => {
  const ids = (input["jobIdentifiers"] as string[]) ?? [];
  const errors: unknown[] = [];
  for (const id of ids) {
    if (ctx.store.get(`${evaluationJobPrefix}${id}`) === undefined) {
      errors.push({
        identifier: id,
        code: "ResourceNotFound",
        message: "Not found",
      });
    } else {
      ctx.store.delete(`${evaluationJobPrefix}${id}`);
    }
  }
  return { errors };
};

const ListEvaluationJobs: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredEvaluationJob>()
    .filter((e) => e.key.startsWith(evaluationJobPrefix))
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return {
    jobSummaries: items.map((j) => ({
      jobArn: j.jobArn,
      jobName: j.jobName,
      status: j.status,
      creationTime: j.creationTime,
      lastModifiedTime: j.lastModifiedTime,
    })),
    nextToken,
  };
};

const CreateModelImportJob: OperationHandler = (input, ctx) => {
  const name = input["jobName"] as string;
  const { region, account } = ctx;
  const id = randomId();
  const arn = importJobArn(region, account, id);
  const importedModelName = input["importedModelName"] as string;
  const now = nowSec();
  const stored: StoredModelImportJob = {
    jobArn: arn,
    jobName: name,
    importedModelArn: importedModelArn(region, account, importedModelName),
    importedModelName,
    roleArn: input["roleArn"] as string,
    modelDataSource:
      (input["modelDataSource"] as Record<string, unknown>) ?? {},
    status: "InProgress",
    creationTime: now,
    lastModifiedTime: now,
    endTime: undefined,
  };
  ctx.store.set(`${modelImportJobPrefix}${id}`, stored);
  const im: StoredImportedModel = {
    modelArn: importedModelArn(region, account, importedModelName),
    modelName: importedModelName,
    jobArn: arn,
    jobName: name,
    modelDataSource: stored.modelDataSource,
    creationTime: now,
    instructSupported: false,
  };
  ctx.store.set(`${importedModelPrefix}${importedModelName}`, im);
  return { jobArn: arn };
};

const GetModelImportJob: OperationHandler = (input, ctx) => {
  const id = input["jobIdentifier"] as string;
  const job = guardedGet<StoredModelImportJob>(
    ctx,
    `${modelImportJobPrefix}${id}`,
    "Model import job",
  );
  return {
    jobArn: job.jobArn,
    jobName: job.jobName,
    importedModelArn: job.importedModelArn,
    importedModelName: job.importedModelName,
    roleArn: job.roleArn,
    modelDataSource: job.modelDataSource,
    status: job.status,
    creationTime: job.creationTime,
    lastModifiedTime: job.lastModifiedTime,
    endTime: job.endTime,
  };
};

const ListModelImportJobs: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredModelImportJob>()
    .filter((e) => e.key.startsWith(modelImportJobPrefix))
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return {
    modelImportJobSummaries: items.map((j) => ({
      jobArn: j.jobArn,
      jobName: j.jobName,
      status: j.status,
      importedModelArn: j.importedModelArn,
      importedModelName: j.importedModelName,
      creationTime: j.creationTime,
      lastModifiedTime: j.lastModifiedTime,
      endTime: j.endTime,
    })),
    nextToken,
  };
};

const GetImportedModel: OperationHandler = (input, ctx) => {
  const id = input["modelIdentifier"] as string;
  const im = guardedGet<StoredImportedModel>(
    ctx,
    `${importedModelPrefix}${id}`,
    "Imported model",
  );
  return {
    modelArn: im.modelArn,
    modelName: im.modelName,
    jobArn: im.jobArn,
    jobName: im.jobName,
    modelDataSource: im.modelDataSource,
    creationTime: im.creationTime,
    instructSupported: im.instructSupported,
  };
};

const DeleteImportedModel: OperationHandler = (input, ctx) => {
  const id = input["modelIdentifier"] as string;
  guardedGet<StoredImportedModel>(
    ctx,
    `${importedModelPrefix}${id}`,
    "Imported model",
  );
  ctx.store.delete(`${importedModelPrefix}${id}`);
  return {};
};

const ListImportedModels: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredImportedModel>()
    .filter((e) => e.key.startsWith(importedModelPrefix))
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return {
    modelSummaries: items.map((m) => ({
      modelArn: m.modelArn,
      modelName: m.modelName,
      creationTime: m.creationTime,
      instructSupported: m.instructSupported,
    })),
    nextToken,
  };
};

const CreateModelCopyJob: OperationHandler = (input, ctx) => {
  const { region, account } = ctx;
  const id = randomId();
  const arn = copyJobArn(region, account, id);
  const targetName = input["targetModelName"] as string;
  const now = nowSec();
  const stored: StoredModelCopyJob = {
    jobArn: arn,
    sourceModelArn: input["sourceModelArn"] as string,
    targetModelArn: modelArn(region, account, targetName),
    targetModelName: targetName,
    status: "Completed",
    creationTime: now,
    targetModelKmsKeyArn: input["modelKmsKeyId"] as string | undefined,
  };
  ctx.store.set(`${modelCopyJobPrefix}${id}`, stored);
  return { jobArn: arn };
};

const GetModelCopyJob: OperationHandler = (input, ctx) => {
  const id = input["jobArn"] as string;
  const job = guardedGet<StoredModelCopyJob>(
    ctx,
    `${modelCopyJobPrefix}${id}`,
    "Model copy job",
  );
  return {
    jobArn: job.jobArn,
    sourceModelArn: job.sourceModelArn,
    targetModelArn: job.targetModelArn,
    targetModelName: job.targetModelName,
    status: job.status,
    creationTime: job.creationTime,
    targetModelKmsKeyArn: job.targetModelKmsKeyArn,
  };
};

const ListModelCopyJobs: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredModelCopyJob>()
    .filter((e) => e.key.startsWith(modelCopyJobPrefix))
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return {
    modelCopyJobSummaries: items.map((j) => ({
      jobArn: j.jobArn,
      sourceModelArn: j.sourceModelArn,
      targetModelArn: j.targetModelArn,
      targetModelName: j.targetModelName,
      status: j.status,
      creationTime: j.creationTime,
    })),
    nextToken,
  };
};

const CreateModelInvocationJob: OperationHandler = (input, ctx) => {
  const name = input["jobName"] as string;
  const { region, account } = ctx;
  const id = randomId();
  const arn = invocationJobArn(region, account, id);
  const now = nowSec();
  const stored: StoredModelInvocationJob = {
    jobArn: arn,
    jobName: name,
    roleArn: input["roleArn"] as string,
    modelId: input["modelId"] as string,
    status: "Submitted",
    inputDataConfig:
      (input["inputDataConfig"] as Record<string, unknown>) ?? {},
    outputDataConfig:
      (input["outputDataConfig"] as Record<string, unknown>) ?? {},
    submitTime: now,
    lastModifiedTime: now,
    endTime: undefined,
  };
  ctx.store.set(`${modelInvocationJobPrefix}${id}`, stored);
  return { jobArn: arn };
};

const GetModelInvocationJob: OperationHandler = (input, ctx) => {
  const id = input["jobIdentifier"] as string;
  const job = guardedGet<StoredModelInvocationJob>(
    ctx,
    `${modelInvocationJobPrefix}${id}`,
    "Model invocation job",
  );
  return {
    jobArn: job.jobArn,
    jobName: job.jobName,
    roleArn: job.roleArn,
    modelId: job.modelId,
    status: job.status,
    inputDataConfig: job.inputDataConfig,
    outputDataConfig: job.outputDataConfig,
    submitTime: job.submitTime,
    lastModifiedTime: job.lastModifiedTime,
    endTime: job.endTime,
  };
};

const StopModelInvocationJob: OperationHandler = (input, ctx) => {
  const id = input["jobIdentifier"] as string;
  const job = guardedGet<StoredModelInvocationJob>(
    ctx,
    `${modelInvocationJobPrefix}${id}`,
    "Model invocation job",
  );
  ctx.store.set(`${modelInvocationJobPrefix}${id}`, {
    ...job,
    status: "Stopping",
    lastModifiedTime: nowSec(),
  });
  return {};
};

const ListModelInvocationJobs: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredModelInvocationJob>()
    .filter((e) => e.key.startsWith(modelInvocationJobPrefix))
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return {
    invocationJobSummaries: items.map((j) => ({
      jobArn: j.jobArn,
      jobName: j.jobName,
      modelId: j.modelId,
      status: j.status,
      submitTime: j.submitTime,
      lastModifiedTime: j.lastModifiedTime,
      endTime: j.endTime,
    })),
    nextToken,
  };
};

const CreatePromptRouter: OperationHandler = (input, ctx) => {
  const name = input["promptRouterName"] as string;
  const { region, account } = ctx;
  const id = randomId();
  const arn = promptRouterArn(region, account, id);
  const now = nowSec();
  const stored: StoredPromptRouter = {
    promptRouterArn: arn,
    promptRouterName: name,
    description: input["description"] as string | undefined,
    type: "custom",
    models: (input["models"] as unknown[]) ?? [],
    routingCriteria:
      (input["routingCriteria"] as Record<string, unknown>) ?? {},
    status: "AVAILABLE",
    createdAt: now,
    updatedAt: now,
  };
  ctx.store.set(`${promptRouterPrefix}${id}`, stored);
  return { promptRouterArn: arn };
};

const GetPromptRouter: OperationHandler = (input, ctx) => {
  const id = input["promptRouterArn"] as string;
  const pr = guardedGet<StoredPromptRouter>(
    ctx,
    `${promptRouterPrefix}${id}`,
    "Prompt router",
  );
  return {
    promptRouterArn: pr.promptRouterArn,
    promptRouterName: pr.promptRouterName,
    description: pr.description,
    type: pr.type,
    models: pr.models,
    routingCriteria: pr.routingCriteria,
    status: pr.status,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
  };
};

const DeletePromptRouter: OperationHandler = (input, ctx) => {
  const id = input["promptRouterArn"] as string;
  guardedGet<StoredPromptRouter>(
    ctx,
    `${promptRouterPrefix}${id}`,
    "Prompt router",
  );
  ctx.store.delete(`${promptRouterPrefix}${id}`);
  return {};
};

const ListPromptRouters: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredPromptRouter>()
    .filter((e) => e.key.startsWith(promptRouterPrefix))
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return {
    promptRouterSummaries: items.map((p) => ({
      promptRouterArn: p.promptRouterArn,
      promptRouterName: p.promptRouterName,
      description: p.description,
      type: p.type,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    nextToken,
  };
};

const logConfigKey = "logging:config" as const;

const GetModelInvocationLoggingConfiguration: OperationHandler = (
  _input,
  ctx,
) => {
  const config = ctx.store.get(logConfigKey);
  return { loggingConfig: config ?? null };
};

const PutModelInvocationLoggingConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  ctx.store.set(logConfigKey, input["loggingConfig"]);
  return {};
};

const DeleteModelInvocationLoggingConfiguration: OperationHandler = (
  _input,
  ctx,
) => {
  ctx.store.delete(logConfigKey);
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = input["resourceARN"] as string;
  const tags = input["tags"] as Record<string, string> | undefined;
  if (tags) applyTags(ctx, arn, tags);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = input["resourceARN"] as string;
  const tagKeys = input["tagKeys"] as string[] | undefined;
  if (tagKeys) {
    const current = getTags(ctx, arn);
    for (const k of tagKeys) delete current[k];
    setTags(ctx, arn, current);
  }
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = input["resourceARN"] as string;
  const tags = getTags(ctx, arn);
  return { tags: tagsArray(tags) };
};

const GetResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = input["resourceArn"] as string;
  const policy = ctx.store.get<string>(`resourcepolicy:${arn}`);
  if (policy === undefined)
    throw awsError(
      "ResourceNotFoundException",
      "Resource policy not found",
      404,
    );
  return { policy, resourceArn: arn };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = input["resourceArn"] as string;
  ctx.store.set(`resourcepolicy:${arn}`, input["policy"]);
  return { resourceArn: arn };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = input["resourceArn"] as string;
  ctx.store.delete(`resourcepolicy:${arn}`);
  return {};
};

const GetUseCaseForModelAccess: OperationHandler = (_input, ctx) => {
  const useCase = ctx.store.get("usecase");
  return useCase ?? { useCaseType: null };
};

const PutUseCaseForModelAccess: OperationHandler = (input, ctx) => {
  ctx.store.set("usecase", input);
  return {};
};

const ListEnforcedGuardrailsConfiguration: OperationHandler = (_input, ctx) => {
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith("enforcedgr:"))
    .map((e) => e.value);
  return { enforcedGuardrailsConfigurations: all };
};

const PutEnforcedGuardrailConfiguration: OperationHandler = (input, ctx) => {
  const id = randomId();
  ctx.store.set(`enforcedgr:${id}`, { ...input, configId: id });
  return { configId: id };
};

const DeleteEnforcedGuardrailConfiguration: OperationHandler = (input, ctx) => {
  const id = input["configId"] as string;
  ctx.store.delete(`enforcedgr:${id}`);
  return {};
};

const CreateFoundationModelAgreement: OperationHandler = (input, _ctx) => ({
  modelId: input["modelId"],
});

const DeleteFoundationModelAgreement: OperationHandler = (_input, _ctx) => ({});

const ListFoundationModelAgreementOffers: OperationHandler = (input, _ctx) => ({
  modelId: input["modelId"],
  offers: [],
});

const CreateMarketplaceModelEndpoint: OperationHandler = (input, ctx) => {
  const id = randomId();
  const arn = `arn:aws:bedrock:${ctx.region}:${ctx.account}:marketplace-model-endpoint/${id}`;
  const now = nowSec();
  ctx.store.set(`mme:${id}`, {
    endpointArn: arn,
    endpointName: input["endpointName"],
    modelSourceIdentifier: input["modelSourceIdentifier"],
    endpointStatus: "REGISTERED",
    createdAt: now,
    updatedAt: now,
  });
  return {
    marketplaceModelEndpoint: {
      endpointArn: arn,
      endpointStatus: "REGISTERED",
    },
  };
};

const GetMarketplaceModelEndpoint: OperationHandler = (input, ctx) => {
  const id = input["endpointArn"] as string;
  const ep = guardedGet(ctx, `mme:${id}`, "Marketplace endpoint");
  return { marketplaceModelEndpoint: ep };
};

const UpdateMarketplaceModelEndpoint: OperationHandler = (input, ctx) => {
  const id = input["endpointArn"] as string;
  const ep = guardedGet<Record<string, unknown>>(
    ctx,
    `mme:${id}`,
    "Marketplace endpoint",
  );
  ctx.store.set(`mme:${id}`, { ...ep, updatedAt: nowSec() });
  return { marketplaceModelEndpoint: ctx.store.get(`mme:${id}`) };
};

const DeleteMarketplaceModelEndpoint: OperationHandler = (input, ctx) => {
  const id = input["endpointArn"] as string;
  guardedGet(ctx, `mme:${id}`, "Marketplace endpoint");
  ctx.store.delete(`mme:${id}`);
  return {};
};

const ListMarketplaceModelEndpoints: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith("mme:"))
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return { marketplaceModelEndpoints: items, nextToken };
};

const RegisterMarketplaceModelEndpoint: OperationHandler = (input, ctx) => {
  const id = input["endpointIdentifier"] as string;
  const ep = guardedGet<Record<string, unknown>>(
    ctx,
    `mme:${id}`,
    "Marketplace endpoint",
  );
  ctx.store.set(`mme:${id}`, { ...ep, endpointStatus: "REGISTERED" });
  return { marketplaceModelEndpoint: ctx.store.get(`mme:${id}`) };
};

const DeregisterMarketplaceModelEndpoint: OperationHandler = (input, ctx) => {
  const id = input["endpointArn"] as string;
  const ep = guardedGet<Record<string, unknown>>(
    ctx,
    `mme:${id}`,
    "Marketplace endpoint",
  );
  ctx.store.set(`mme:${id}`, { ...ep, endpointStatus: "DEREGISTERED" });
  return { marketplaceModelEndpoint: ctx.store.get(`mme:${id}`) };
};

const CreateCustomModelDeployment: OperationHandler = (input, ctx) => {
  const id = randomId();
  const arn = `arn:aws:bedrock:${ctx.region}:${ctx.account}:custom-model-deployment/${id}`;
  const now = nowSec();
  ctx.store.set(`cmd:${id}`, {
    customModelDeploymentArn: arn,
    customModelDeploymentName: input["customModelDeploymentName"],
    modelArn: input["modelArn"],
    status: "InService",
    createdAt: now,
    updatedAt: now,
  });
  return { customModelDeploymentArn: arn };
};

const GetCustomModelDeployment: OperationHandler = (input, ctx) => {
  const id = input["customModelDeploymentIdentifier"] as string;
  const dep = guardedGet(ctx, `cmd:${id}`, "Custom model deployment");
  return dep as Record<string, unknown>;
};

const UpdateCustomModelDeployment: OperationHandler = (input, ctx) => {
  const id = input["customModelDeploymentIdentifier"] as string;
  const dep = guardedGet<Record<string, unknown>>(
    ctx,
    `cmd:${id}`,
    "Custom model deployment",
  );
  ctx.store.set(`cmd:${id}`, { ...dep, updatedAt: nowSec() });
  return {};
};

const DeleteCustomModelDeployment: OperationHandler = (input, ctx) => {
  const id = input["customModelDeploymentIdentifier"] as string;
  guardedGet(ctx, `cmd:${id}`, "Custom model deployment");
  ctx.store.delete(`cmd:${id}`);
  return {};
};

const ListCustomModelDeployments: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith("cmd:"))
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return { customModelDeploymentSummaries: items, nextToken };
};

const CreateAdvancedPromptOptimizationJob: OperationHandler = (input, ctx) => {
  const id = randomId();
  const arn = `arn:aws:bedrock:${ctx.region}:${ctx.account}:advanced-prompt-optimization-job/${id}`;
  const now = nowSec();
  ctx.store.set(`apoj:${id}`, {
    jobIdentifier: id,
    jobArn: arn,
    jobName: input["jobName"],
    status: "InProgress",
    creationTime: now,
    lastModifiedTime: now,
  });
  return { jobIdentifier: id };
};

const GetAdvancedPromptOptimizationJob: OperationHandler = (input, ctx) => {
  const id = input["jobIdentifier"] as string;
  const job = guardedGet(ctx, `apoj:${id}`, "Advanced prompt optimization job");
  return job as Record<string, unknown>;
};

const StopAdvancedPromptOptimizationJob: OperationHandler = (input, ctx) => {
  const id = input["jobIdentifier"] as string;
  const job = guardedGet<Record<string, unknown>>(
    ctx,
    `apoj:${id}`,
    "Advanced prompt optimization job",
  );
  ctx.store.set(`apoj:${id}`, { ...job, status: "Stopping" });
  return {};
};

const BatchDeleteAdvancedPromptOptimizationJob: OperationHandler = (
  input,
  ctx,
) => {
  const ids = (input["jobIdentifiers"] as string[]) ?? [];
  for (const id of ids) ctx.store.delete(`apoj:${id}`);
  return { errors: [] };
};

const ListAdvancedPromptOptimizationJobs: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith("apoj:"))
    .map((e) => e.value);
  const { items, nextToken } = paginateList(
    all,
    input["maxResults"] as number | undefined,
    input["nextToken"],
  );
  return { jobSummaries: items, nextToken };
};

const stub: OperationHandler = () => {
  throw awsError("InternalServerException", "Not implemented", 500);
};

const CreateAutomatedReasoningPolicy: OperationHandler = stub;
const GetAutomatedReasoningPolicy: OperationHandler = stub;
const UpdateAutomatedReasoningPolicy: OperationHandler = stub;
const DeleteAutomatedReasoningPolicy: OperationHandler = stub;
const ListAutomatedReasoningPolicies: OperationHandler = stub;
const CreateAutomatedReasoningPolicyVersion: OperationHandler = stub;
const ExportAutomatedReasoningPolicyVersion: OperationHandler = stub;
const ListAutomatedReasoningPolicyBuildWorkflows: OperationHandler = stub;
const StartAutomatedReasoningPolicyBuildWorkflow: OperationHandler = stub;
const GetAutomatedReasoningPolicyBuildWorkflow: OperationHandler = stub;
const DeleteAutomatedReasoningPolicyBuildWorkflow: OperationHandler = stub;
const CancelAutomatedReasoningPolicyBuildWorkflow: OperationHandler = stub;
const GetAutomatedReasoningPolicyAnnotations: OperationHandler = stub;
const UpdateAutomatedReasoningPolicyAnnotations: OperationHandler = stub;
const GetAutomatedReasoningPolicyBuildWorkflowResultAssets: OperationHandler =
  stub;
const GetAutomatedReasoningPolicyNextScenario: OperationHandler = stub;
const StartAutomatedReasoningPolicyTestWorkflow: OperationHandler = stub;
const ListAutomatedReasoningPolicyTestResults: OperationHandler = stub;
const GetAutomatedReasoningPolicyTestResult: OperationHandler = stub;
const CreateAutomatedReasoningPolicyTestCase: OperationHandler = stub;
const GetAutomatedReasoningPolicyTestCase: OperationHandler = stub;
const DeleteAutomatedReasoningPolicyTestCase: OperationHandler = stub;
const UpdateAutomatedReasoningPolicyTestCase: OperationHandler = stub;
const ListAutomatedReasoningPolicyTestCases: OperationHandler = stub;

const pathSegments = (path: string): string[] =>
  path.split("/").filter((p) => p !== "");

const bedrock = {
  name: "bedrock",
  protocol: "rest-json" as const,
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    const m = req.method;
    const [p0, p1, p2, p3, p4, p5, p6] = parts;

    if (p0 === "foundation-models") {
      if (!p1) {
        if (m === "GET") return "ListFoundationModels";
      } else {
        if (m === "GET") return "GetFoundationModel";
      }
      return undefined;
    }

    if (p0 === "foundation-model-availability") {
      if (m === "GET") return "GetFoundationModelAvailability";
      return undefined;
    }

    if (p0 === "list-foundation-model-agreement-offers") {
      if (m === "GET") return "ListFoundationModelAgreementOffers";
      return undefined;
    }

    if (p0 === "create-foundation-model-agreement") {
      if (m === "POST") return "CreateFoundationModelAgreement";
      return undefined;
    }

    if (p0 === "delete-foundation-model-agreement") {
      if (m === "POST") return "DeleteFoundationModelAgreement";
      return undefined;
    }

    if (p0 === "custom-models") {
      if (!p1) {
        if (m === "GET") return "ListCustomModels";
      } else if (p1 === "create-custom-model") {
        if (m === "POST") return "CreateCustomModel";
      } else {
        if (m === "GET") return "GetCustomModel";
        if (m === "DELETE") return "DeleteCustomModel";
      }
      return undefined;
    }

    if (p0 === "model-customization-jobs") {
      if (!p1) {
        if (m === "GET") return "ListModelCustomizationJobs";
        if (m === "POST") return "CreateModelCustomizationJob";
      } else if (p2 === "stop") {
        if (m === "POST") return "StopModelCustomizationJob";
      } else {
        if (m === "GET") return "GetModelCustomizationJob";
      }
      return undefined;
    }

    if (p0 === "guardrails") {
      if (!p1) {
        if (m === "GET") return "ListGuardrails";
        if (m === "POST") return "CreateGuardrail";
      } else {
        if (m === "GET") return "GetGuardrail";
        if (m === "PUT") return "UpdateGuardrail";
        if (m === "DELETE") return "DeleteGuardrail";
        if (m === "POST") return "CreateGuardrailVersion";
      }
      return undefined;
    }

    if (p0 === "provisioned-model-throughput") {
      if (m === "POST") return "CreateProvisionedModelThroughput";
      if (p1) {
        if (m === "GET") return "GetProvisionedModelThroughput";
        if (m === "DELETE") return "DeleteProvisionedModelThroughput";
        if (m === "PATCH") return "UpdateProvisionedModelThroughput";
      }
      return undefined;
    }

    if (p0 === "provisioned-model-throughputs") {
      if (m === "GET") return "ListProvisionedModelThroughputs";
      return undefined;
    }

    if (p0 === "inference-profiles") {
      if (!p1) {
        if (m === "GET") return "ListInferenceProfiles";
        if (m === "POST") return "CreateInferenceProfile";
      } else {
        if (m === "GET") return "GetInferenceProfile";
        if (m === "DELETE") return "DeleteInferenceProfile";
      }
      return undefined;
    }

    if (p0 === "evaluation-jobs") {
      if (!p1) {
        if (m === "GET") return "ListEvaluationJobs";
        if (m === "POST") return "CreateEvaluationJob";
      } else if (p1 === "batch-delete") {
        if (m === "POST") return "BatchDeleteEvaluationJob";
      } else {
        if (m === "GET") return "GetEvaluationJob";
      }
      return undefined;
    }

    if (p0 === "evaluation-job") {
      if (p2 === "stop" && m === "POST") return "StopEvaluationJob";
      return undefined;
    }

    if (p0 === "model-import-jobs") {
      if (!p1) {
        if (m === "GET") return "ListModelImportJobs";
        if (m === "POST") return "CreateModelImportJob";
      } else {
        if (m === "GET") return "GetModelImportJob";
      }
      return undefined;
    }

    if (p0 === "imported-models") {
      if (!p1) {
        if (m === "GET") return "ListImportedModels";
      } else {
        if (m === "GET") return "GetImportedModel";
        if (m === "DELETE") return "DeleteImportedModel";
      }
      return undefined;
    }

    if (p0 === "model-copy-jobs") {
      if (!p1) {
        if (m === "GET") return "ListModelCopyJobs";
        if (m === "POST") return "CreateModelCopyJob";
      } else {
        if (m === "GET") return "GetModelCopyJob";
      }
      return undefined;
    }

    if (p0 === "model-invocation-job") {
      if (!p1) {
        if (m === "POST") return "CreateModelInvocationJob";
      } else if (p2 === "stop") {
        if (m === "POST") return "StopModelInvocationJob";
      } else {
        if (m === "GET") return "GetModelInvocationJob";
      }
      return undefined;
    }

    if (p0 === "model-invocation-jobs") {
      if (m === "GET") return "ListModelInvocationJobs";
      return undefined;
    }

    if (p0 === "prompt-routers") {
      if (!p1) {
        if (m === "GET") return "ListPromptRouters";
        if (m === "POST") return "CreatePromptRouter";
      } else {
        if (m === "GET") return "GetPromptRouter";
        if (m === "DELETE") return "DeletePromptRouter";
      }
      return undefined;
    }

    if (p0 === "logging" && p1 === "modelinvocations") {
      if (m === "GET") return "GetModelInvocationLoggingConfiguration";
      if (m === "PUT") return "PutModelInvocationLoggingConfiguration";
      if (m === "DELETE") return "DeleteModelInvocationLoggingConfiguration";
      return undefined;
    }

    if (p0 === "listTagsForResource") {
      if (m === "POST") return "ListTagsForResource";
      return undefined;
    }

    if (p0 === "tagResource") {
      if (m === "POST") return "TagResource";
      return undefined;
    }

    if (p0 === "untagResource") {
      if (m === "POST") return "UntagResource";
      return undefined;
    }

    if (p0 === "resource-policy") {
      if (!p1) {
        if (m === "POST") return "PutResourcePolicy";
      } else {
        if (m === "GET") return "GetResourcePolicy";
        if (m === "DELETE") return "DeleteResourcePolicy";
      }
      return undefined;
    }

    if (p0 === "use-case-for-model-access") {
      if (m === "GET") return "GetUseCaseForModelAccess";
      if (m === "POST") return "PutUseCaseForModelAccess";
      return undefined;
    }

    if (p0 === "enforcedGuardrailsConfiguration") {
      if (!p1) {
        if (m === "GET") return "ListEnforcedGuardrailsConfiguration";
        if (m === "PUT") return "PutEnforcedGuardrailConfiguration";
      } else {
        if (m === "DELETE") return "DeleteEnforcedGuardrailConfiguration";
      }
      return undefined;
    }

    if (p0 === "marketplace-model" && p1 === "endpoints") {
      if (!p2) {
        if (m === "GET") return "ListMarketplaceModelEndpoints";
        if (m === "POST") return "CreateMarketplaceModelEndpoint";
      } else if (p3 === "registration") {
        if (m === "POST") return "RegisterMarketplaceModelEndpoint";
        if (m === "DELETE") return "DeregisterMarketplaceModelEndpoint";
      } else {
        if (m === "GET") return "GetMarketplaceModelEndpoint";
        if (m === "PATCH") return "UpdateMarketplaceModelEndpoint";
        if (m === "DELETE") return "DeleteMarketplaceModelEndpoint";
      }
      return undefined;
    }

    if (p0 === "model-customization" && p1 === "custom-model-deployments") {
      if (!p2) {
        if (m === "GET") return "ListCustomModelDeployments";
        if (m === "POST") return "CreateCustomModelDeployment";
      } else {
        if (m === "GET") return "GetCustomModelDeployment";
        if (m === "PATCH") return "UpdateCustomModelDeployment";
        if (m === "DELETE") return "DeleteCustomModelDeployment";
      }
      return undefined;
    }

    if (p0 === "advanced-prompt-optimization-job" && p1 === "batch-delete") {
      if (m === "POST") return "BatchDeleteAdvancedPromptOptimizationJob";
      return undefined;
    }

    if (p0 === "advanced-prompt-optimization-jobs") {
      if (!p1) {
        if (m === "GET") return "ListAdvancedPromptOptimizationJobs";
        if (m === "POST") return "CreateAdvancedPromptOptimizationJob";
      } else if (p2 === "stop") {
        if (m === "POST") return "StopAdvancedPromptOptimizationJob";
      } else {
        if (m === "GET") return "GetAdvancedPromptOptimizationJob";
      }
      return undefined;
    }

    if (p0 === "automated-reasoning-policies") {
      if (!p1) {
        if (m === "GET") return "ListAutomatedReasoningPolicies";
        if (m === "POST") return "CreateAutomatedReasoningPolicy";
      } else if (!p2) {
        if (m === "GET") return "GetAutomatedReasoningPolicy";
        if (m === "PATCH") return "UpdateAutomatedReasoningPolicy";
        if (m === "DELETE") return "DeleteAutomatedReasoningPolicy";
      } else if (p2 === "versions") {
        if (m === "POST") return "CreateAutomatedReasoningPolicyVersion";
      } else if (p2 === "export") {
        if (m === "GET") return "ExportAutomatedReasoningPolicyVersion";
      } else if (p2 === "test-cases") {
        if (!p3) {
          if (m === "GET") return "ListAutomatedReasoningPolicyTestCases";
          if (m === "POST") return "CreateAutomatedReasoningPolicyTestCase";
        } else if (!p4) {
          if (m === "GET") return "GetAutomatedReasoningPolicyTestCase";
          if (m === "PATCH") return "UpdateAutomatedReasoningPolicyTestCase";
          if (m === "DELETE") return "DeleteAutomatedReasoningPolicyTestCase";
        }
      } else if (p2 === "build-workflows") {
        if (!p3) {
          if (m === "GET") return "ListAutomatedReasoningPolicyBuildWorkflows";
        } else if (!p4) {
          if (m === "GET") return "GetAutomatedReasoningPolicyBuildWorkflow";
          if (m === "DELETE")
            return "DeleteAutomatedReasoningPolicyBuildWorkflow";
        } else if (p4 === "start") {
          if (m === "POST") return "StartAutomatedReasoningPolicyBuildWorkflow";
        } else if (p4 === "cancel") {
          if (m === "POST")
            return "CancelAutomatedReasoningPolicyBuildWorkflow";
        } else if (p4 === "annotations") {
          if (m === "GET") return "GetAutomatedReasoningPolicyAnnotations";
          if (m === "PATCH") return "UpdateAutomatedReasoningPolicyAnnotations";
        } else if (p4 === "result-assets") {
          if (m === "GET")
            return "GetAutomatedReasoningPolicyBuildWorkflowResultAssets";
        } else if (p4 === "scenarios") {
          if (m === "GET") return "GetAutomatedReasoningPolicyNextScenario";
        } else if (p4 === "test-workflows") {
          if (m === "POST") return "StartAutomatedReasoningPolicyTestWorkflow";
        } else if (p4 === "test-results") {
          if (m === "GET") return "ListAutomatedReasoningPolicyTestResults";
        } else if (p4 === "test-cases" && p5 && p6 === "test-results") {
          if (m === "GET") return "GetAutomatedReasoningPolicyTestResult";
        }
      }
      return undefined;
    }

    return undefined;
  },
  operations: {
    ListFoundationModels,
    GetFoundationModel,
    GetFoundationModelAvailability,
    ListFoundationModelAgreementOffers,
    CreateFoundationModelAgreement,
    DeleteFoundationModelAgreement,
    CreateCustomModel,
    GetCustomModel,
    DeleteCustomModel,
    ListCustomModels,
    CreateGuardrail,
    GetGuardrail,
    UpdateGuardrail,
    DeleteGuardrail,
    ListGuardrails,
    CreateGuardrailVersion,
    CreateModelCustomizationJob,
    GetModelCustomizationJob,
    ListModelCustomizationJobs,
    StopModelCustomizationJob,
    CreateProvisionedModelThroughput,
    GetProvisionedModelThroughput,
    UpdateProvisionedModelThroughput,
    DeleteProvisionedModelThroughput,
    ListProvisionedModelThroughputs,
    CreateInferenceProfile,
    GetInferenceProfile,
    DeleteInferenceProfile,
    ListInferenceProfiles,
    CreateEvaluationJob,
    GetEvaluationJob,
    StopEvaluationJob,
    BatchDeleteEvaluationJob,
    ListEvaluationJobs,
    CreateModelImportJob,
    GetModelImportJob,
    ListModelImportJobs,
    GetImportedModel,
    DeleteImportedModel,
    ListImportedModels,
    CreateModelCopyJob,
    GetModelCopyJob,
    ListModelCopyJobs,
    CreateModelInvocationJob,
    GetModelInvocationJob,
    StopModelInvocationJob,
    ListModelInvocationJobs,
    CreatePromptRouter,
    GetPromptRouter,
    DeletePromptRouter,
    ListPromptRouters,
    GetModelInvocationLoggingConfiguration,
    PutModelInvocationLoggingConfiguration,
    DeleteModelInvocationLoggingConfiguration,
    TagResource,
    UntagResource,
    ListTagsForResource,
    GetResourcePolicy,
    PutResourcePolicy,
    DeleteResourcePolicy,
    GetUseCaseForModelAccess,
    PutUseCaseForModelAccess,
    ListEnforcedGuardrailsConfiguration,
    PutEnforcedGuardrailConfiguration,
    DeleteEnforcedGuardrailConfiguration,
    CreateMarketplaceModelEndpoint,
    GetMarketplaceModelEndpoint,
    UpdateMarketplaceModelEndpoint,
    DeleteMarketplaceModelEndpoint,
    ListMarketplaceModelEndpoints,
    RegisterMarketplaceModelEndpoint,
    DeregisterMarketplaceModelEndpoint,
    CreateCustomModelDeployment,
    GetCustomModelDeployment,
    UpdateCustomModelDeployment,
    DeleteCustomModelDeployment,
    ListCustomModelDeployments,
    CreateAdvancedPromptOptimizationJob,
    GetAdvancedPromptOptimizationJob,
    StopAdvancedPromptOptimizationJob,
    BatchDeleteAdvancedPromptOptimizationJob,
    ListAdvancedPromptOptimizationJobs,
    CreateAutomatedReasoningPolicy,
    GetAutomatedReasoningPolicy,
    UpdateAutomatedReasoningPolicy,
    DeleteAutomatedReasoningPolicy,
    ListAutomatedReasoningPolicies,
    CreateAutomatedReasoningPolicyVersion,
    ExportAutomatedReasoningPolicyVersion,
    ListAutomatedReasoningPolicyBuildWorkflows,
    StartAutomatedReasoningPolicyBuildWorkflow,
    GetAutomatedReasoningPolicyBuildWorkflow,
    DeleteAutomatedReasoningPolicyBuildWorkflow,
    CancelAutomatedReasoningPolicyBuildWorkflow,
    GetAutomatedReasoningPolicyAnnotations,
    UpdateAutomatedReasoningPolicyAnnotations,
    GetAutomatedReasoningPolicyBuildWorkflowResultAssets,
    GetAutomatedReasoningPolicyNextScenario,
    StartAutomatedReasoningPolicyTestWorkflow,
    ListAutomatedReasoningPolicyTestResults,
    GetAutomatedReasoningPolicyTestResult,
    CreateAutomatedReasoningPolicyTestCase,
    GetAutomatedReasoningPolicyTestCase,
    DeleteAutomatedReasoningPolicyTestCase,
    UpdateAutomatedReasoningPolicyTestCase,
    ListAutomatedReasoningPolicyTestCases,
  },
  model,
} as const satisfies ServiceDefinition;

export default bedrock;
