import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import codePipelineModel from "../../models/codepipeline.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(codePipelineModel);

type StoredPipeline = {
  declaration: Record<string, unknown>;
  version: number;
  arn: string;
  created: number;
  updated: number;
  tags: Record<string, unknown>[];
};

type StoredCustomActionType = {
  id: Record<string, unknown>;
  settings: Record<string, unknown> | undefined;
  actionConfigurationProperties: Record<string, unknown>[];
  inputArtifactDetails: Record<string, unknown>;
  outputArtifactDetails: Record<string, unknown>;
  created: number;
  tags: Record<string, unknown>[];
  region?: string;
};

type StoredWebhook = {
  definition: Record<string, unknown>;
  url: string;
  arn: string;
  tags: Record<string, unknown>[];
};

type StoredPipelineExecution = {
  pipelineName: string;
  pipelineVersion: number;
  pipelineExecutionId: string;
  status: string;
  startTime: number;
  lastUpdateTime: number;
  statusSummary?: string;
  artifactRevisions?: Record<string, unknown>[];
  variables?: Record<string, unknown>[];
  trigger?: Record<string, unknown>;
  executionMode?: string;
  executionType?: string;
};

type StoredJob = {
  id: string;
  nonce: string;
  data: Record<string, unknown>;
  accountId: string;
  status: string;
  actionTypeId: Record<string, unknown>;
};

type StoredThirdPartyJob = {
  jobId: string;
  clientId: string;
  nonce: string;
  data: Record<string, unknown>;
  status: string;
  actionTypeId: Record<string, unknown>;
};

type StoredStageTransition = {
  pipelineName: string;
  stageName: string;
  transitionType: string;
  disabledReason: string;
  disabledAt: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const paginate = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
): { items: T[]; nextToken?: string } => {
  const limit =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : undefined;
  const offset =
    typeof nextToken === "string" && nextToken !== ""
      ? (() => {
          try {
            const n = parseInt(atob(nextToken), 10);
            if (!Number.isFinite(n)) {
              throw new Error();
            }
            return n;
          } catch {
            throw awsError(
              "InvalidNextTokenException",
              "The next token supplied is not valid.",
              400,
            );
          }
        })()
      : 0;
  const sliced =
    limit !== undefined
      ? items.slice(offset, offset + limit)
      : items.slice(offset);
  const nextOffset = offset + sliced.length;
  return {
    items: sliced,
    ...(limit !== undefined && nextOffset < items.length
      ? { nextToken: btoa(String(nextOffset)) }
      : {}),
  };
};

const terminalJobStates = new Set(["Succeeded", "Failed"]);

const pipelineKey = (name: string): string => `pipeline:${name}`;

const pipelineArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:codepipeline:${ctx.region}:${ctx.account}:${name}`;

const customActionTypeKey = (
  category: string,
  provider: string,
  version: string,
): string => `customActionType:${category}:${provider}:${version}`;

const webhookKey = (name: string): string => `webhook:${name}`;

const webhookArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:codepipeline:${ctx.region}:${ctx.account}:webhook:${name}`;

const executionKey = (executionId: string): string =>
  `execution:${executionId}`;

const pipelineVersionKey = (name: string, version: number): string =>
  `pipelineVersion:${name}:${version}`;

const jobKey = (jobId: string): string => `job:${jobId}`;

const tpJobKey = (jobId: string): string => `tpjob:${jobId}`;

const stageTransitionKey = (
  pipelineName: string,
  stageName: string,
  transitionType: string,
): string => `stageTransition:${pipelineName}:${stageName}:${transitionType}`;

const tagsKey = (arn: string): string => `tags:${arn}`;

const idempotentKey = (name: string, token: string): string =>
  `idempotent:${name}:${token}`;

const pipelineName = (declaration: Record<string, unknown>): string => {
  const name = stringOrUndefined(declaration["name"]);
  if (name === undefined) {
    throw awsError("ValidationException", "pipeline.name is required.", 400);
  }
  return name;
};

const declarationView = (
  pipeline: StoredPipeline,
): Record<string, unknown> => ({
  ...pipeline.declaration,
  version: pipeline.version,
});

const summaryView = (pipeline: StoredPipeline): Record<string, unknown> => ({
  name: stringOrUndefined(pipeline.declaration["name"]),
  version: pipeline.version,
  pipelineType: stringOrUndefined(pipeline.declaration["pipelineType"]),
  executionMode: stringOrUndefined(pipeline.declaration["executionMode"]),
  created: pipeline.created,
  updated: pipeline.updated,
});

const actionTypeView = (
  cat: StoredCustomActionType,
): Record<string, unknown> => ({
  id: cat.id,
  settings: cat.settings,
  actionConfigurationProperties: cat.actionConfigurationProperties,
  inputArtifactDetails: cat.inputArtifactDetails,
  outputArtifactDetails: cat.outputArtifactDetails,
});

const webhookItemView = (wh: StoredWebhook): Record<string, unknown> => ({
  definition: wh.definition,
  url: wh.url,
  arn: wh.arn,
  tags: wh.tags,
});

const getPipelineOrThrow = (
  name: string,
  ctx: ServiceContext,
): StoredPipeline => {
  const pipeline = ctx.store.get<StoredPipeline>(pipelineKey(name));
  if (pipeline === undefined) {
    throw awsError(
      "PipelineNotFoundException",
      `Pipeline ${name} not found.`,
      400,
    );
  }
  return pipeline;
};

const CreatePipeline: OperationHandler = (input, ctx) => {
  const declaration = asRecord(input["pipeline"]);
  const name = pipelineName(declaration);
  if (ctx.store.get<StoredPipeline>(pipelineKey(name)) !== undefined) {
    throw awsError(
      "PipelineNameInUseException",
      `Pipeline ${name} already exists.`,
      400,
    );
  }
  const now = nowSeconds();
  const pipeline: StoredPipeline = {
    declaration,
    version: 1,
    arn: pipelineArn(ctx, name),
    created: now,
    updated: now,
    tags: asArray(input["tags"]),
  };
  ctx.store.set(pipelineKey(name), pipeline);
  ctx.store.set(pipelineVersionKey(name, pipeline.version), pipeline);
  ctx.store.set(tagsKey(pipeline.arn), pipeline.tags);
  return {
    pipeline: declarationView(pipeline),
    tags: pipeline.tags,
  };
};

const GetPipeline: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  if (name === undefined) {
    throw awsError("ValidationException", "name is required.", 400);
  }
  const current = getPipelineOrThrow(name, ctx);
  const requestedVersion =
    typeof input["version"] === "number" ? input["version"] : undefined;
  const pipeline =
    requestedVersion === undefined || requestedVersion === current.version
      ? current
      : (() => {
          const historical = ctx.store.get<StoredPipeline>(
            pipelineVersionKey(name, requestedVersion),
          );
          if (historical === undefined) {
            throw awsError(
              "PipelineVersionNotFoundException",
              `Pipeline ${name} version ${requestedVersion} not found.`,
              400,
            );
          }
          return historical;
        })();
  return {
    pipeline: declarationView(pipeline),
    metadata: {
      pipelineArn: pipeline.arn,
      created: pipeline.created,
      updated: pipeline.updated,
    },
  };
};

const ListPipelines: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredPipeline>()
    .filter((entry) => entry.key.startsWith("pipeline:"))
    .map((entry) => entry.value)
    .sort((a, b) => {
      const an = stringOrUndefined(a.declaration["name"]) ?? "";
      const bn = stringOrUndefined(b.declaration["name"]) ?? "";
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
  const { items, nextToken } = paginate(
    all,
    input["maxResults"],
    input["nextToken"],
  );
  return {
    pipelines: items.map(summaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const UpdatePipeline: OperationHandler = (input, ctx) => {
  const declaration = asRecord(input["pipeline"]);
  const name = pipelineName(declaration);
  const existing = getPipelineOrThrow(name, ctx);
  const pipeline: StoredPipeline = {
    declaration,
    version: existing.version + 1,
    arn: existing.arn,
    created: existing.created,
    updated: nowSeconds(),
    tags: existing.tags,
  };
  ctx.store.set(pipelineKey(name), pipeline);
  ctx.store.set(pipelineVersionKey(name, pipeline.version), pipeline);
  return { pipeline: declarationView(pipeline) };
};

const DeletePipeline: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  if (name === undefined) {
    throw awsError("ValidationException", "name is required.", 400);
  }
  const pipeline = getPipelineOrThrow(name, ctx);
  ctx.store.delete(pipelineKey(name));
  ctx.store.delete(tagsKey(pipeline.arn));
  for (let v = 1; v <= pipeline.version; v++) {
    ctx.store.delete(pipelineVersionKey(name, v));
  }
  ctx.store
    .list<StoredPipelineExecution>()
    .filter(
      (e) => e.key.startsWith("execution:") && e.value.pipelineName === name,
    )
    .forEach((e) => ctx.store.delete(e.key));
  ctx.store
    .list<StoredStageTransition>()
    .filter(
      (e) =>
        e.key.startsWith("stageTransition:") && e.value.pipelineName === name,
    )
    .forEach((e) => ctx.store.delete(e.key));
  ctx.store
    .list<string>()
    .filter((e) => e.key.startsWith(`idempotent:${name}:`))
    .forEach((e) => ctx.store.delete(e.key));
  return {};
};

const StartPipelineExecution: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  if (name === undefined) {
    throw awsError("ValidationException", "name is required.", 400);
  }
  const pipeline = getPipelineOrThrow(name, ctx);
  const token = stringOrUndefined(input["clientRequestToken"]);
  if (token !== undefined) {
    const existing = ctx.store.get<string>(idempotentKey(name, token));
    if (existing !== undefined) {
      return { pipelineExecutionId: existing };
    }
  }
  const executionId = crypto.randomUUID();
  const now = nowSeconds();
  const execution: StoredPipelineExecution = {
    pipelineName: name,
    pipelineVersion: pipeline.version,
    pipelineExecutionId: executionId,
    status: "InProgress",
    startTime: now,
    lastUpdateTime: now,
    variables: asArray(input["variables"]),
    trigger: { triggerType: "StartPipelineExecution", triggerDetail: "" },
    executionMode:
      stringOrUndefined(pipeline.declaration["executionMode"]) ?? "SUPERSEDED",
    executionType: "STANDARD",
  };
  ctx.store.set(executionKey(executionId), execution);
  if (token !== undefined) {
    ctx.store.set(idempotentKey(name, token), executionId);
  }
  return { pipelineExecutionId: executionId };
};

const AcknowledgeJob: OperationHandler = (input, ctx) => {
  const jobId = stringOrUndefined(input["jobId"]);
  if (jobId === undefined) {
    throw awsError("ValidationException", "jobId is required.", 400);
  }
  const job = ctx.store.get<StoredJob>(jobKey(jobId));
  if (job === undefined) {
    throw awsError("InvalidJobException", `Job ${jobId} not found.`, 400);
  }
  const nonce = stringOrUndefined(input["nonce"]);
  if (nonce !== job.nonce) {
    throw awsError(
      "InvalidNonceException",
      "The nonce supplied is not valid.",
      400,
    );
  }
  const updatedJob: StoredJob = { ...job, status: "InProgress" };
  ctx.store.set(jobKey(jobId), updatedJob);
  return { status: "InProgress" };
};

const AcknowledgeThirdPartyJob: OperationHandler = (input, ctx) => {
  const jobId = stringOrUndefined(input["jobId"]);
  if (jobId === undefined) {
    throw awsError("ValidationException", "jobId is required.", 400);
  }
  const job = ctx.store.get<StoredThirdPartyJob>(tpJobKey(jobId));
  if (job === undefined) {
    throw awsError(
      "InvalidJobException",
      `ThirdPartyJob ${jobId} not found.`,
      400,
    );
  }
  const nonce = stringOrUndefined(input["nonce"]);
  if (nonce !== job.nonce) {
    throw awsError(
      "InvalidNonceException",
      "The nonce supplied is not valid.",
      400,
    );
  }
  const updatedJob: StoredThirdPartyJob = { ...job, status: "InProgress" };
  ctx.store.set(tpJobKey(jobId), updatedJob);
  return { status: "InProgress" };
};

const CreateCustomActionType: OperationHandler = (input, ctx) => {
  const category = stringOrUndefined(input["category"]);
  const provider = stringOrUndefined(input["provider"]);
  const version = stringOrUndefined(input["version"]);
  if (!category || !provider || !version) {
    throw awsError(
      "ValidationException",
      "category, provider, and version are required.",
      400,
    );
  }
  const key = customActionTypeKey(category, provider, version);
  const cat: StoredCustomActionType = {
    id: { category, provider, version, owner: "Custom" },
    settings: input["settings"] ? asRecord(input["settings"]) : undefined,
    actionConfigurationProperties: asArray(input["configurationProperties"]),
    inputArtifactDetails: asRecord(input["inputArtifactDetails"]),
    outputArtifactDetails: asRecord(input["outputArtifactDetails"]),
    created: nowSeconds(),
    tags: asArray(input["tags"]),
    region: ctx.region,
  };
  ctx.store.set(key, cat);
  return {
    actionType: actionTypeView(cat),
    tags: cat.tags,
  };
};

const DeleteCustomActionType: OperationHandler = (input, ctx) => {
  const category = stringOrUndefined(input["category"]);
  const provider = stringOrUndefined(input["provider"]);
  const version = stringOrUndefined(input["version"]);
  if (!category || !provider || !version) {
    throw awsError(
      "ValidationException",
      "category, provider, and version are required.",
      400,
    );
  }
  const key = customActionTypeKey(category, provider, version);
  if (ctx.store.get<StoredCustomActionType>(key) === undefined) {
    throw awsError(
      "ActionTypeNotFoundException",
      `Action type ${category}:${provider}:${version} not found.`,
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const DeleteWebhook: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  if (name === undefined) {
    throw awsError("ValidationException", "name is required.", 400);
  }
  const wh = ctx.store.get<StoredWebhook>(webhookKey(name));
  if (wh !== undefined) {
    ctx.store.delete(tagsKey(wh.arn));
  }
  ctx.store.delete(webhookKey(name));
  return {};
};

const DeregisterWebhookWithThirdParty: OperationHandler = () => {
  return {};
};

const DisableStageTransition: OperationHandler = (input, ctx) => {
  const pName = stringOrUndefined(input["pipelineName"]);
  const stageName = stringOrUndefined(input["stageName"]);
  const transitionType = stringOrUndefined(input["transitionType"]);
  const reason = stringOrUndefined(input["reason"]) ?? "";
  if (!pName || !stageName || !transitionType) {
    throw awsError(
      "ValidationException",
      "pipelineName, stageName, and transitionType are required.",
      400,
    );
  }
  getPipelineOrThrow(pName, ctx);
  const transition: StoredStageTransition = {
    pipelineName: pName,
    stageName,
    transitionType,
    disabledReason: reason,
    disabledAt: nowSeconds(),
  };
  ctx.store.set(
    stageTransitionKey(pName, stageName, transitionType),
    transition,
  );
  return {};
};

const EnableStageTransition: OperationHandler = (input, ctx) => {
  const pName = stringOrUndefined(input["pipelineName"]);
  const stageName = stringOrUndefined(input["stageName"]);
  const transitionType = stringOrUndefined(input["transitionType"]);
  if (!pName || !stageName || !transitionType) {
    throw awsError(
      "ValidationException",
      "pipelineName, stageName, and transitionType are required.",
      400,
    );
  }
  getPipelineOrThrow(pName, ctx);
  ctx.store.delete(stageTransitionKey(pName, stageName, transitionType));
  return {};
};

const GetActionType: OperationHandler = (input, ctx) => {
  const category = stringOrUndefined(input["category"]);
  const provider = stringOrUndefined(input["provider"]);
  const version = stringOrUndefined(input["version"]);
  if (!category || !provider || !version) {
    throw awsError(
      "ValidationException",
      "category, provider, and version are required.",
      400,
    );
  }
  const key = customActionTypeKey(category, provider, version);
  const cat = ctx.store.get<StoredCustomActionType>(key);
  if (cat === undefined) {
    throw awsError(
      "ActionTypeNotFoundException",
      `Action type ${category}:${provider}:${version} not found.`,
      400,
    );
  }
  return { actionType: actionTypeView(cat) };
};

const GetJobDetails: OperationHandler = (input, ctx) => {
  const jobId = stringOrUndefined(input["jobId"]);
  if (jobId === undefined) {
    throw awsError("ValidationException", "jobId is required.", 400);
  }
  const job = ctx.store.get<StoredJob>(jobKey(jobId));
  if (job === undefined) {
    throw awsError("JobNotFoundException", `Job ${jobId} not found.`, 400);
  }
  return {
    jobDetails: {
      id: job.id,
      data: job.data,
      accountId: job.accountId,
    },
  };
};

const GetPipelineExecution: OperationHandler = (input, ctx) => {
  const pName = stringOrUndefined(input["pipelineName"]);
  const executionId = stringOrUndefined(input["pipelineExecutionId"]);
  if (!pName || !executionId) {
    throw awsError(
      "ValidationException",
      "pipelineName and pipelineExecutionId are required.",
      400,
    );
  }
  getPipelineOrThrow(pName, ctx);
  const execution = ctx.store.get<StoredPipelineExecution>(
    executionKey(executionId),
  );
  if (execution === undefined || execution.pipelineName !== pName) {
    throw awsError(
      "PipelineExecutionNotFoundException",
      `Execution ${executionId} not found.`,
      400,
    );
  }
  return {
    pipelineExecution: {
      pipelineName: execution.pipelineName,
      pipelineVersion: execution.pipelineVersion,
      pipelineExecutionId: execution.pipelineExecutionId,
      status: execution.status,
      statusSummary: execution.statusSummary,
      artifactRevisions: execution.artifactRevisions ?? [],
      variables: execution.variables ?? [],
      trigger: execution.trigger,
      executionMode: execution.executionMode,
      executionType: execution.executionType,
    },
  };
};

const GetPipelineState: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  if (name === undefined) {
    throw awsError("ValidationException", "name is required.", 400);
  }
  const pipeline = getPipelineOrThrow(name, ctx);
  const stages = asArray(pipeline.declaration["stages"]);
  const stageStates = stages.map((stage) => {
    const stageName = stringOrUndefined(stage["name"]) ?? "";
    const disabledTransition = ctx.store.get<StoredStageTransition>(
      stageTransitionKey(name, stageName, "Inbound"),
    );
    const actions = asArray(stage["actions"]);
    const actionStates = actions.map((action) => ({
      actionName: stringOrUndefined(action["name"]),
      entityUrl: undefined,
      revisionUrl: undefined,
    }));
    const state: Record<string, unknown> = {
      stageName,
      actionStates,
    };
    if (disabledTransition !== undefined) {
      state["inboundTransitionState"] = {
        enabled: false,
        lastChangedBy: undefined,
        lastChangedAt: disabledTransition.disabledAt,
        disabledReason: disabledTransition.disabledReason,
      };
    } else {
      state["inboundTransitionState"] = {
        enabled: true,
      };
    }
    return state;
  });
  return {
    pipelineName: name,
    pipelineVersion: pipeline.version,
    stageStates,
    created: pipeline.created,
    updated: pipeline.updated,
  };
};

const GetThirdPartyJobDetails: OperationHandler = (input, ctx) => {
  const jobId = stringOrUndefined(input["jobId"]);
  if (jobId === undefined) {
    throw awsError("ValidationException", "jobId is required.", 400);
  }
  const job = ctx.store.get<StoredThirdPartyJob>(tpJobKey(jobId));
  if (job === undefined) {
    throw awsError(
      "JobNotFoundException",
      `ThirdPartyJob ${jobId} not found.`,
      400,
    );
  }
  return {
    jobDetails: {
      id: job.jobId,
      data: job.data,
      nonce: job.nonce,
    },
  };
};

const ListActionExecutions: OperationHandler = (input, ctx) => {
  const pName = stringOrUndefined(input["pipelineName"]);
  if (pName === undefined) {
    throw awsError("ValidationException", "pipelineName is required.", 400);
  }
  getPipelineOrThrow(pName, ctx);
  const filter = asRecord(input["filter"] ?? {});
  const execIdFilter = stringOrUndefined(filter["pipelineExecutionId"]);
  let allExecutions = ctx.store
    .list<StoredPipelineExecution>()
    .filter((e) => e.key.startsWith("execution:"))
    .map((e) => e.value)
    .filter((e) => e.pipelineName === pName);
  if (execIdFilter !== undefined) {
    allExecutions = allExecutions.filter(
      (e) => e.pipelineExecutionId === execIdFilter,
    );
  }
  const details = allExecutions.map((exec) => ({
    pipelineExecutionId: exec.pipelineExecutionId,
    actionExecutionId: `ae-${exec.pipelineExecutionId}`,
    pipelineVersion: exec.pipelineVersion,
    status: exec.status,
    startTime: exec.startTime,
    lastUpdateTime: exec.lastUpdateTime,
  }));
  const { items, nextToken } = paginate(
    details,
    input["maxResults"],
    input["nextToken"],
  );
  return {
    actionExecutionDetails: items,
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const ListActionTypes: OperationHandler = (input, ctx) => {
  const ownerFilter = stringOrUndefined(input["actionOwnerFilter"]);
  const regionFilter = stringOrUndefined(input["regionFilter"]);
  let catEntries = ctx.store
    .list<StoredCustomActionType>()
    .filter((e) => e.key.startsWith("customActionType:"))
    .map((e) => e.value);
  if (ownerFilter) {
    catEntries = catEntries.filter(
      (cat) => stringOrUndefined(asRecord(cat.id)["owner"]) === ownerFilter,
    );
  }
  if (regionFilter !== undefined) {
    catEntries = catEntries.filter((cat) => cat.region === regionFilter);
  }
  const { items, nextToken } = paginate(
    catEntries,
    input["maxResults"],
    input["nextToken"],
  );
  return {
    actionTypes: items.map(actionTypeView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const ListDeployActionExecutionTargets: OperationHandler = () => {
  return { targets: [] };
};

const ListPipelineExecutions: OperationHandler = (input, ctx) => {
  const pName = stringOrUndefined(input["pipelineName"]);
  if (pName === undefined) {
    throw awsError("ValidationException", "pipelineName is required.", 400);
  }
  getPipelineOrThrow(pName, ctx);
  const filter = asRecord(input["filter"] ?? {});
  const statusFilter = stringOrUndefined(filter["pipelineExecutionStatus"]);
  let executions = ctx.store
    .list<StoredPipelineExecution>()
    .filter((e) => e.key.startsWith("execution:"))
    .map((e) => e.value)
    .filter((e) => e.pipelineName === pName)
    .sort((a, b) => b.startTime - a.startTime);
  if (statusFilter !== undefined) {
    executions = executions.filter((e) => e.status === statusFilter);
  }
  const summaries = executions.map((e) => ({
    pipelineExecutionId: e.pipelineExecutionId,
    status: e.status,
    startTime: e.startTime,
    lastUpdateTime: e.lastUpdateTime,
  }));
  const { items, nextToken } = paginate(
    summaries,
    input["maxResults"],
    input["nextToken"],
  );
  return {
    pipelineExecutionSummaries: items,
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const ListRuleExecutions: OperationHandler = (input, ctx) => {
  const pName = stringOrUndefined(input["pipelineName"]);
  if (pName === undefined) {
    throw awsError("ValidationException", "pipelineName is required.", 400);
  }
  getPipelineOrThrow(pName, ctx);
  return { ruleExecutionDetails: [] };
};

const ListRuleTypes: OperationHandler = () => {
  return { ruleTypes: [] };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = stringOrUndefined(input["resourceArn"]);
  if (resourceArn === undefined) {
    throw awsError("ValidationException", "resourceArn is required.", 400);
  }
  const tags =
    ctx.store.get<Record<string, unknown>[]>(tagsKey(resourceArn)) ?? [];
  return { tags };
};

const ListWebhooks: OperationHandler = (input, ctx) => {
  const webhooks = ctx.store
    .list<StoredWebhook>()
    .filter((e) => e.key.startsWith("webhook:"))
    .map((e) => webhookItemView(e.value));
  return { webhooks };
};

const OverrideStageCondition: OperationHandler = () => {
  return {};
};

const PollForJobs: OperationHandler = (input, ctx) => {
  const actionTypeId = asRecord(input["actionTypeId"]);
  const category = stringOrUndefined(actionTypeId["category"]);
  const provider = stringOrUndefined(actionTypeId["provider"]);
  const version = stringOrUndefined(actionTypeId["version"]);
  const maxBatch =
    typeof input["maxBatchSize"] === "number" ? input["maxBatchSize"] : 1;
  const jobs = ctx.store
    .list<StoredJob>()
    .filter((e) => e.key.startsWith("job:"))
    .map((e) => e.value)
    .filter(
      (j) =>
        j.status === "Created" &&
        stringOrUndefined(asRecord(j.actionTypeId)["category"]) === category &&
        stringOrUndefined(asRecord(j.actionTypeId)["provider"]) === provider &&
        stringOrUndefined(asRecord(j.actionTypeId)["version"]) === version,
    )
    .slice(0, maxBatch)
    .map((j) => {
      const updated: StoredJob = { ...j, status: "Queued" };
      ctx.store.set(jobKey(j.id), updated);
      return {
        id: j.id,
        nonce: j.nonce,
        data: j.data,
        accountId: j.accountId,
      };
    });
  return { jobs };
};

const PollForThirdPartyJobs: OperationHandler = (input, ctx) => {
  const actionTypeId = asRecord(input["actionTypeId"]);
  const category = stringOrUndefined(actionTypeId["category"]);
  const provider = stringOrUndefined(actionTypeId["provider"]);
  const version = stringOrUndefined(actionTypeId["version"]);
  const maxBatch =
    typeof input["maxBatchSize"] === "number" ? input["maxBatchSize"] : 1;
  const jobs = ctx.store
    .list<StoredThirdPartyJob>()
    .filter((e) => e.key.startsWith("tpjob:"))
    .map((e) => e.value)
    .filter(
      (j) =>
        j.status === "Created" &&
        stringOrUndefined(asRecord(j.actionTypeId)["category"]) === category &&
        stringOrUndefined(asRecord(j.actionTypeId)["provider"]) === provider &&
        stringOrUndefined(asRecord(j.actionTypeId)["version"]) === version,
    )
    .slice(0, maxBatch)
    .map((j) => {
      const updated: StoredThirdPartyJob = { ...j, status: "Queued" };
      ctx.store.set(tpJobKey(j.jobId), updated);
      return { clientId: j.clientId, jobId: j.jobId };
    });
  return { jobs };
};

const PutActionRevision: OperationHandler = (input, ctx) => {
  const pName = stringOrUndefined(input["pipelineName"]);
  if (pName === undefined) {
    throw awsError("ValidationException", "pipelineName is required.", 400);
  }
  const pipeline = getPipelineOrThrow(pName, ctx);
  const executionId = crypto.randomUUID();
  const now = nowSeconds();
  const execution: StoredPipelineExecution = {
    pipelineName: pName,
    pipelineVersion: pipeline.version,
    pipelineExecutionId: executionId,
    status: "InProgress",
    startTime: now,
    lastUpdateTime: now,
  };
  ctx.store.set(executionKey(executionId), execution);
  return {
    newRevision: true,
    pipelineExecutionId: executionId,
  };
};

const PutApprovalResult: OperationHandler = (input, ctx) => {
  const pName = stringOrUndefined(input["pipelineName"]);
  if (pName === undefined) {
    throw awsError("ValidationException", "pipelineName is required.", 400);
  }
  getPipelineOrThrow(pName, ctx);
  return { approvedAt: nowSeconds() };
};

const PutJobFailureResult: OperationHandler = (input, ctx) => {
  const jobId = stringOrUndefined(input["jobId"]);
  if (jobId === undefined) {
    throw awsError("ValidationException", "jobId is required.", 400);
  }
  const job = ctx.store.get<StoredJob>(jobKey(jobId));
  if (job === undefined) {
    throw awsError("JobNotFoundException", `Job ${jobId} not found.`, 400);
  }
  if (terminalJobStates.has(job.status)) {
    throw awsError(
      "InvalidJobStateException",
      `Job ${jobId} is already in a terminal state.`,
      400,
    );
  }
  ctx.store.set(jobKey(jobId), { ...job, status: "Failed" });
  return {};
};

const PutJobSuccessResult: OperationHandler = (input, ctx) => {
  const jobId = stringOrUndefined(input["jobId"]);
  if (jobId === undefined) {
    throw awsError("ValidationException", "jobId is required.", 400);
  }
  const job = ctx.store.get<StoredJob>(jobKey(jobId));
  if (job === undefined) {
    throw awsError("JobNotFoundException", `Job ${jobId} not found.`, 400);
  }
  if (terminalJobStates.has(job.status)) {
    throw awsError(
      "InvalidJobStateException",
      `Job ${jobId} is already in a terminal state.`,
      400,
    );
  }
  ctx.store.set(jobKey(jobId), { ...job, status: "Succeeded" });
  return {};
};

const PutThirdPartyJobFailureResult: OperationHandler = (input, ctx) => {
  const jobId = stringOrUndefined(input["jobId"]);
  if (jobId === undefined) {
    throw awsError("ValidationException", "jobId is required.", 400);
  }
  const job = ctx.store.get<StoredThirdPartyJob>(tpJobKey(jobId));
  if (job === undefined) {
    throw awsError(
      "JobNotFoundException",
      `ThirdPartyJob ${jobId} not found.`,
      400,
    );
  }
  if (terminalJobStates.has(job.status)) {
    throw awsError(
      "InvalidJobStateException",
      `ThirdPartyJob ${jobId} is already in a terminal state.`,
      400,
    );
  }
  ctx.store.set(tpJobKey(jobId), { ...job, status: "Failed" });
  return {};
};

const PutThirdPartyJobSuccessResult: OperationHandler = (input, ctx) => {
  const jobId = stringOrUndefined(input["jobId"]);
  if (jobId === undefined) {
    throw awsError("ValidationException", "jobId is required.", 400);
  }
  const job = ctx.store.get<StoredThirdPartyJob>(tpJobKey(jobId));
  if (job === undefined) {
    throw awsError(
      "JobNotFoundException",
      `ThirdPartyJob ${jobId} not found.`,
      400,
    );
  }
  if (terminalJobStates.has(job.status)) {
    throw awsError(
      "InvalidJobStateException",
      `ThirdPartyJob ${jobId} is already in a terminal state.`,
      400,
    );
  }
  ctx.store.set(tpJobKey(jobId), { ...job, status: "Succeeded" });
  return {};
};

const PutWebhook: OperationHandler = (input, ctx) => {
  const definition = asRecord(input["webhook"]);
  const name = stringOrUndefined(definition["name"]);
  if (name === undefined) {
    throw awsError("ValidationException", "webhook.name is required.", 400);
  }
  const arn = webhookArn(ctx, name);
  const existing = ctx.store.get<StoredWebhook>(webhookKey(name));
  const wh: StoredWebhook = {
    definition,
    url: existing?.url ?? `https://webhooks.domain.com/trigger/${name}`,
    arn,
    tags: asArray(input["tags"]),
  };
  ctx.store.set(webhookKey(name), wh);
  ctx.store.set(tagsKey(arn), wh.tags);
  return { webhook: webhookItemView(wh) };
};

const RegisterWebhookWithThirdParty: OperationHandler = () => {
  return {};
};

const RetryStageExecution: OperationHandler = (input, ctx) => {
  const pName = stringOrUndefined(input["pipelineName"]);
  if (pName === undefined) {
    throw awsError("ValidationException", "pipelineName is required.", 400);
  }
  const pipeline = getPipelineOrThrow(pName, ctx);
  const executionId = crypto.randomUUID();
  const now = nowSeconds();
  const execution: StoredPipelineExecution = {
    pipelineName: pName,
    pipelineVersion: pipeline.version,
    pipelineExecutionId: executionId,
    status: "InProgress",
    startTime: now,
    lastUpdateTime: now,
  };
  ctx.store.set(executionKey(executionId), execution);
  return { pipelineExecutionId: executionId };
};

const RollbackStage: OperationHandler = (input, ctx) => {
  const pName = stringOrUndefined(input["pipelineName"]);
  if (pName === undefined) {
    throw awsError("ValidationException", "pipelineName is required.", 400);
  }
  const pipeline = getPipelineOrThrow(pName, ctx);
  const executionId = crypto.randomUUID();
  const now = nowSeconds();
  const execution: StoredPipelineExecution = {
    pipelineName: pName,
    pipelineVersion: pipeline.version,
    pipelineExecutionId: executionId,
    status: "InProgress",
    startTime: now,
    lastUpdateTime: now,
  };
  ctx.store.set(executionKey(executionId), execution);
  return { pipelineExecutionId: executionId };
};

const terminalExecutionStates = new Set([
  "Succeeded",
  "Failed",
  "Stopped",
  "Superseded",
  "Cancelled",
]);

const StopPipelineExecution: OperationHandler = (input, ctx) => {
  const pName = stringOrUndefined(input["pipelineName"]);
  const executionId = stringOrUndefined(input["pipelineExecutionId"]);
  if (!pName || !executionId) {
    throw awsError(
      "ValidationException",
      "pipelineName and pipelineExecutionId are required.",
      400,
    );
  }
  getPipelineOrThrow(pName, ctx);
  const execution = ctx.store.get<StoredPipelineExecution>(
    executionKey(executionId),
  );
  if (execution === undefined || execution.pipelineName !== pName) {
    throw awsError(
      "PipelineExecutionNotFoundException",
      `Execution ${executionId} not found.`,
      400,
    );
  }
  if (terminalExecutionStates.has(execution.status)) {
    throw awsError(
      "PipelineExecutionNotStoppableException",
      `Execution ${executionId} cannot be stopped in state ${execution.status}.`,
      400,
    );
  }
  if (execution.status === "Stopping") {
    throw awsError(
      "DuplicatedStopRequestException",
      `Stop already requested for execution ${executionId}.`,
      400,
    );
  }
  const abandon = input["abandon"] === true;
  ctx.store.set(executionKey(executionId), {
    ...execution,
    status: abandon ? "Stopped" : "Stopping",
    lastUpdateTime: nowSeconds(),
  });
  return { pipelineExecutionId: executionId };
};

const resolveArnExists = (arn: string, ctx: ServiceContext): boolean => {
  const parts = arn.split(":");
  if (parts.length < 6 || parts[0] !== "arn" || parts[2] !== "codepipeline") {
    return false;
  }
  if (parts.length === 7 && parts[5] === "webhook") {
    return ctx.store.get<StoredWebhook>(webhookKey(parts[6])) !== undefined;
  }
  if (parts.length === 6) {
    return ctx.store.get<StoredPipeline>(pipelineKey(parts[5])) !== undefined;
  }
  return false;
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = stringOrUndefined(input["resourceArn"]);
  if (resourceArn === undefined) {
    throw awsError("ValidationException", "resourceArn is required.", 400);
  }
  if (!resolveArnExists(resourceArn, ctx)) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${resourceArn}`,
      400,
    );
  }
  const newTags = asArray(input["tags"]);
  const existing =
    ctx.store.get<Record<string, unknown>[]>(tagsKey(resourceArn)) ?? [];
  const newTagKeys = new Set(
    newTags.map((t) => stringOrUndefined(t["key"])).filter(Boolean),
  );
  const merged = [
    ...existing.filter((t) => !newTagKeys.has(stringOrUndefined(t["key"]))),
    ...newTags,
  ];
  ctx.store.set(tagsKey(resourceArn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = stringOrUndefined(input["resourceArn"]);
  if (resourceArn === undefined) {
    throw awsError("ValidationException", "resourceArn is required.", 400);
  }
  const removeKeys = Array.isArray(input["tagKeys"])
    ? ((input["tagKeys"] as unknown[]).filter(
        (k) => typeof k === "string",
      ) as string[])
    : [];
  const existing =
    ctx.store.get<Record<string, unknown>[]>(tagsKey(resourceArn)) ?? [];
  const filtered = existing.filter(
    (t) => !removeKeys.includes(stringOrUndefined(t["key"]) ?? ""),
  );
  ctx.store.set(tagsKey(resourceArn), filtered);
  return {};
};

const UpdateActionType: OperationHandler = (input, ctx) => {
  const actionTypeDecl = asRecord(input["actionType"]);
  const id = asRecord(actionTypeDecl["id"]);
  const category = stringOrUndefined(id["category"]);
  const provider = stringOrUndefined(id["provider"]);
  const version = stringOrUndefined(id["version"]);
  if (!category || !provider || !version) {
    throw awsError(
      "ValidationException",
      "actionType.id.category, provider, and version are required.",
      400,
    );
  }
  const key = customActionTypeKey(category, provider, version);
  const existing = ctx.store.get<StoredCustomActionType>(key);
  if (existing === undefined) {
    throw awsError(
      "ActionTypeNotFoundException",
      `Action type ${category}:${provider}:${version} not found.`,
      400,
    );
  }
  const updated: StoredCustomActionType = {
    ...existing,
    id,
    settings: actionTypeDecl["settings"]
      ? asRecord(actionTypeDecl["settings"])
      : existing.settings,
    actionConfigurationProperties: actionTypeDecl[
      "actionConfigurationProperties"
    ]
      ? asArray(actionTypeDecl["actionConfigurationProperties"])
      : existing.actionConfigurationProperties,
    inputArtifactDetails: actionTypeDecl["inputArtifactDetails"]
      ? asRecord(actionTypeDecl["inputArtifactDetails"])
      : existing.inputArtifactDetails,
    outputArtifactDetails: actionTypeDecl["outputArtifactDetails"]
      ? asRecord(actionTypeDecl["outputArtifactDetails"])
      : existing.outputArtifactDetails,
  };
  ctx.store.set(key, updated);
  return {};
};

const codepipeline = {
  name: "codepipeline",
  protocol: "json",
  operations: {
    AcknowledgeJob,
    AcknowledgeThirdPartyJob,
    CreateCustomActionType,
    CreatePipeline,
    DeleteCustomActionType,
    DeletePipeline,
    DeleteWebhook,
    DeregisterWebhookWithThirdParty,
    DisableStageTransition,
    EnableStageTransition,
    GetActionType,
    GetJobDetails,
    GetPipeline,
    GetPipelineExecution,
    GetPipelineState,
    GetThirdPartyJobDetails,
    ListActionExecutions,
    ListActionTypes,
    ListDeployActionExecutionTargets,
    ListPipelineExecutions,
    ListPipelines,
    ListRuleExecutions,
    ListRuleTypes,
    ListTagsForResource,
    ListWebhooks,
    OverrideStageCondition,
    PollForJobs,
    PollForThirdPartyJobs,
    PutActionRevision,
    PutApprovalResult,
    PutJobFailureResult,
    PutJobSuccessResult,
    PutThirdPartyJobFailureResult,
    PutThirdPartyJobSuccessResult,
    PutWebhook,
    RegisterWebhookWithThirdParty,
    RetryStageExecution,
    RollbackStage,
    StartPipelineExecution,
    StopPipelineExecution,
    TagResource,
    UntagResource,
    UpdateActionType,
    UpdatePipeline,
  },
  model,
} as const satisfies ServiceDefinition;

export default codepipeline;
