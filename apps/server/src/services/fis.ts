import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/fis.json", { with: { type: "json" } }),
);

const tmplPrefix = "tmpl:" as const;
const expPrefix = "exp:" as const;
const tacPrefix = "tac:" as const;
const tagPrefix = "tag:" as const;
const leverPrefix = "lever:" as const;

type StoredExperimentTemplate = {
  id: string;
  arn: string;
  description: string;
  actions: Record<string, unknown>;
  stopConditions: unknown[];
  targets: Record<string, unknown>;
  roleArn: string;
  tags: Record<string, string>;
  logConfiguration: Record<string, unknown> | undefined;
  experimentOptions: Record<string, unknown> | undefined;
  experimentReportConfiguration: Record<string, unknown> | undefined;
  creationTime: number;
  lastUpdateTime: number;
};

type StoredExperiment = {
  id: string;
  arn: string;
  experimentTemplateId: string;
  roleArn: string;
  targets: Record<string, unknown>;
  actions: Record<string, unknown>;
  stopConditions: unknown[];
  tags: Record<string, string>;
  logConfiguration: Record<string, unknown> | undefined;
  experimentOptions: Record<string, unknown> | undefined;
  experimentReportConfiguration: Record<string, unknown> | undefined;
  startTime: number;
  stoppedAt: number | undefined;
  creationTime: number;
};

type StoredTargetAccountConfiguration = {
  experimentTemplateId: string;
  accountId: string;
  roleArn: string;
  description: string | undefined;
};

type StoredSafetyLever = {
  id: string;
  arn: string;
  state: { status: string; reason: string };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const notFoundErr = (msg: string) =>
  awsError("ResourceNotFoundException", msg, 404);

const validationErr = (msg: string) =>
  awsError("ValidationException", msg, 400);

const conflictErr = (msg: string) => awsError("ConflictException", msg, 409);

const requireStr = (input: Record<string, unknown>, field: string): string => {
  const v = input[field];
  if (typeof v !== "string" || v === "") {
    throw validationErr(`${field} is required.`);
  }
  return v;
};

const asStr = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};

const asTags = (v: unknown): Record<string, string> => {
  const r = asRecord(v);
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(r)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
};

const tmplKey = (id: string): string => `${tmplPrefix}${id}`;
const expKey = (id: string): string => `${expPrefix}${id}`;
const tacKey = (tmplId: string, accountId: string): string =>
  `${tacPrefix}${tmplId}:${accountId}`;
const tagKey = (arn: string): string => `${tagPrefix}${arn}`;
const leverKey = (id: string): string => `${leverPrefix}${id}`;

const tmplArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:fis:${ctx.region}:${ctx.account}:experiment-template/${id}`;

const expArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:fis:${ctx.region}:${ctx.account}:experiment/${id}`;

const leverArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:fis:${ctx.region}:${ctx.account}:safety-lever/${id}`;

const genTmplId = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "EXT";
  for (let i = 0; i < 17; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

const genExpId = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "EXP";
  for (let i = 0; i < 17; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

const computeExpState = (
  exp: StoredExperiment,
): { status: string; reason: string } => {
  const now = Date.now();
  if (exp.stoppedAt !== undefined) {
    if (now - exp.stoppedAt >= 1000) {
      return { status: "stopped", reason: "Experiment stopped by user." };
    }
    return { status: "stopping", reason: "Experiment is stopping." };
  }
  const elapsed = now - exp.startTime;
  if (elapsed >= 10_000) {
    return {
      status: "completed",
      reason: "Experiment completed successfully.",
    };
  }
  if (elapsed >= 1_000) {
    return { status: "running", reason: "Experiment is running." };
  }
  return { status: "initiating", reason: "Experiment is being initiated." };
};

const tmplView = (tmpl: StoredExperimentTemplate): Record<string, unknown> => ({
  id: tmpl.id,
  arn: tmpl.arn,
  description: tmpl.description,
  targets: tmpl.targets,
  actions: tmpl.actions,
  stopConditions: tmpl.stopConditions,
  creationTime: tmpl.creationTime,
  lastUpdateTime: tmpl.lastUpdateTime,
  roleArn: tmpl.roleArn,
  tags: tmpl.tags,
  logConfiguration: tmpl.logConfiguration,
  experimentOptions: tmpl.experimentOptions,
  experimentReportConfiguration: tmpl.experimentReportConfiguration,
});

const tmplSummaryView = (
  tmpl: StoredExperimentTemplate,
): Record<string, unknown> => ({
  id: tmpl.id,
  arn: tmpl.arn,
  description: tmpl.description,
  creationTime: tmpl.creationTime,
  lastUpdateTime: tmpl.lastUpdateTime,
  tags: tmpl.tags,
});

const expView = (exp: StoredExperiment): Record<string, unknown> => {
  const state = computeExpState(exp);
  return {
    id: exp.id,
    arn: exp.arn,
    experimentTemplateId: exp.experimentTemplateId,
    roleArn: exp.roleArn,
    state: { status: state.status, reason: state.reason },
    targets: exp.targets,
    actions: exp.actions,
    stopConditions: exp.stopConditions,
    creationTime: exp.creationTime,
    startTime: exp.startTime,
    endTime:
      state.status === "completed" || state.status === "stopped"
        ? (exp.stoppedAt ?? exp.startTime + 10_000)
        : undefined,
    tags: exp.tags,
    logConfiguration: exp.logConfiguration,
    experimentOptions: exp.experimentOptions,
    experimentReportConfiguration: exp.experimentReportConfiguration,
  };
};

const expSummaryView = (exp: StoredExperiment): Record<string, unknown> => {
  const state = computeExpState(exp);
  return {
    id: exp.id,
    arn: exp.arn,
    experimentTemplateId: exp.experimentTemplateId,
    state: { status: state.status, reason: state.reason },
    creationTime: exp.creationTime,
    tags: exp.tags,
    experimentOptions: exp.experimentOptions,
  };
};

const tacView = (
  tac: StoredTargetAccountConfiguration,
): Record<string, unknown> => ({
  roleArn: tac.roleArn,
  accountId: tac.accountId,
  description: tac.description,
});

const CreateExperimentTemplate: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const description = requireStr(input, "description");
  const roleArn = requireStr(input, "roleArn");
  const stopConditions = Array.isArray(input["stopConditions"])
    ? input["stopConditions"]
    : [];
  const actions = asRecord(input["actions"]);
  const targets = asRecord(input["targets"]);
  const tags = asTags(input["tags"]);
  const logConfiguration = asRecord(input["logConfiguration"]) || undefined;
  const experimentOptions = asRecord(input["experimentOptions"]) || undefined;
  const experimentReportConfiguration =
    asRecord(input["experimentReportConfiguration"]) || undefined;

  const id = genTmplId();
  const now = Math.floor(Date.now() / 1000);
  const tmpl: StoredExperimentTemplate = {
    id,
    arn: tmplArn(ctx, id),
    description,
    actions,
    stopConditions,
    targets,
    roleArn,
    tags,
    logConfiguration:
      Object.keys(logConfiguration ?? {}).length > 0
        ? logConfiguration
        : undefined,
    experimentOptions:
      Object.keys(experimentOptions ?? {}).length > 0
        ? experimentOptions
        : undefined,
    experimentReportConfiguration:
      Object.keys(experimentReportConfiguration ?? {}).length > 0
        ? experimentReportConfiguration
        : undefined,
    creationTime: now,
    lastUpdateTime: now,
  };

  ctx.store.set(tmplKey(id), tmpl);
  if (Object.keys(tags).length > 0) {
    ctx.store.set(tagKey(tmpl.arn), tags);
  }

  return { experimentTemplate: tmplView(tmpl) };
};

const DeleteExperimentTemplate: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const id = requireStr(input, "id");
  const tmpl = ctx.store.get<StoredExperimentTemplate>(tmplKey(id));
  if (tmpl === undefined)
    throw notFoundErr(`ExperimentTemplate not found: ${id}`);

  ctx.store.delete(tmplKey(id));
  ctx.store.delete(tagKey(tmpl.arn));

  return { experimentTemplate: tmplView(tmpl) };
};

const GetExperimentTemplate: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const id = requireStr(input, "id");
  const tmpl = ctx.store.get<StoredExperimentTemplate>(tmplKey(id));
  if (tmpl === undefined)
    throw notFoundErr(`ExperimentTemplate not found: ${id}`);
  return { experimentTemplate: tmplView(tmpl) };
};

const UpdateExperimentTemplate: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const id = requireStr(input, "id");
  const tmpl = ctx.store.get<StoredExperimentTemplate>(tmplKey(id));
  if (tmpl === undefined)
    throw notFoundErr(`ExperimentTemplate not found: ${id}`);

  const now = Math.floor(Date.now() / 1000);
  const updated: StoredExperimentTemplate = {
    ...tmpl,
    description: asStr(input["description"]) ?? tmpl.description,
    roleArn: asStr(input["roleArn"]) ?? tmpl.roleArn,
    actions:
      input["actions"] !== undefined
        ? asRecord(input["actions"])
        : tmpl.actions,
    stopConditions: Array.isArray(input["stopConditions"])
      ? input["stopConditions"]
      : tmpl.stopConditions,
    targets:
      input["targets"] !== undefined
        ? asRecord(input["targets"])
        : tmpl.targets,
    logConfiguration:
      input["logConfiguration"] !== undefined
        ? asRecord(input["logConfiguration"])
        : tmpl.logConfiguration,
    experimentOptions:
      input["experimentOptions"] !== undefined
        ? asRecord(input["experimentOptions"])
        : tmpl.experimentOptions,
    experimentReportConfiguration:
      input["experimentReportConfiguration"] !== undefined
        ? asRecord(input["experimentReportConfiguration"])
        : tmpl.experimentReportConfiguration,
    lastUpdateTime: now,
  };

  ctx.store.set(tmplKey(id), updated);
  return { experimentTemplate: tmplView(updated) };
};

const ListExperimentTemplates: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const maxResults =
    typeof input["maxResults"] === "number" ? input["maxResults"] : 100;
  const nextToken = asStr(input["nextToken"]);

  const all = ctx.store
    .list<StoredExperimentTemplate>()
    .filter((e) => e.key.startsWith(tmplPrefix))
    .map((e) => e.value)
    .sort((a, b) => a.creationTime - b.creationTime);

  const startIdx = nextToken !== undefined ? parseInt(atob(nextToken), 10) : 0;
  const page = all.slice(startIdx, startIdx + maxResults);
  const newNextToken =
    startIdx + maxResults < all.length
      ? btoa(String(startIdx + maxResults))
      : undefined;

  return {
    experimentTemplates: page.map(tmplSummaryView),
    nextToken: newNextToken,
  };
};

const StartExperiment: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const templateId = requireStr(input, "experimentTemplateId");
  const tmpl = ctx.store.get<StoredExperimentTemplate>(tmplKey(templateId));
  if (tmpl === undefined)
    throw notFoundErr(`ExperimentTemplate not found: ${templateId}`);

  const tags = asTags(input["tags"]);
  const experimentOptions =
    input["experimentOptions"] !== undefined
      ? asRecord(input["experimentOptions"])
      : undefined;

  const id = genExpId();
  const now = Date.now();
  const exp: StoredExperiment = {
    id,
    arn: expArn(ctx, id),
    experimentTemplateId: templateId,
    roleArn: tmpl.roleArn,
    targets: tmpl.targets,
    actions: tmpl.actions,
    stopConditions: tmpl.stopConditions,
    tags,
    logConfiguration: tmpl.logConfiguration,
    experimentOptions:
      experimentOptions !== undefined &&
      Object.keys(experimentOptions).length > 0
        ? experimentOptions
        : tmpl.experimentOptions,
    experimentReportConfiguration: tmpl.experimentReportConfiguration,
    startTime: now,
    stoppedAt: undefined,
    creationTime: now,
  };

  ctx.store.set(expKey(id), exp);
  if (Object.keys(tags).length > 0) {
    ctx.store.set(tagKey(exp.arn), tags);
  }

  return { experiment: expView(exp) };
};

const GetExperiment: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const id = requireStr(input, "id");
  const exp = ctx.store.get<StoredExperiment>(expKey(id));
  if (exp === undefined) throw notFoundErr(`Experiment not found: ${id}`);
  return { experiment: expView(exp) };
};

const StopExperiment: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const id = requireStr(input, "id");
  const exp = ctx.store.get<StoredExperiment>(expKey(id));
  if (exp === undefined) throw notFoundErr(`Experiment not found: ${id}`);

  const state = computeExpState(exp);
  if (state.status !== "running" && state.status !== "initiating") {
    throw validationErr(
      `Experiment ${id} cannot be stopped in state: ${state.status}`,
    );
  }

  const updated: StoredExperiment = { ...exp, stoppedAt: Date.now() };
  ctx.store.set(expKey(id), updated);
  return { experiment: expView(updated) };
};

const ListExperiments: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const maxResults =
    typeof input["maxResults"] === "number" ? input["maxResults"] : 100;
  const nextToken = asStr(input["nextToken"]);
  const filterTemplateId = asStr(input["experimentTemplateId"]);

  const all = ctx.store
    .list<StoredExperiment>()
    .filter((e) => e.key.startsWith(expPrefix))
    .map((e) => e.value)
    .filter(
      (e) =>
        filterTemplateId === undefined ||
        e.experimentTemplateId === filterTemplateId,
    )
    .sort((a, b) => a.creationTime - b.creationTime);

  const startIdx = nextToken !== undefined ? parseInt(atob(nextToken), 10) : 0;
  const page = all.slice(startIdx, startIdx + maxResults);
  const newNextToken =
    startIdx + maxResults < all.length
      ? btoa(String(startIdx + maxResults))
      : undefined;

  return {
    experiments: page.map(expSummaryView),
    nextToken: newNextToken,
  };
};

const CreateTargetAccountConfiguration: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const templateId = requireStr(input, "experimentTemplateId");
  const accountId = requireStr(input, "accountId");
  const roleArn = requireStr(input, "roleArn");
  const description = asStr(input["description"]);

  const tmpl = ctx.store.get<StoredExperimentTemplate>(tmplKey(templateId));
  if (tmpl === undefined)
    throw notFoundErr(`ExperimentTemplate not found: ${templateId}`);

  const key = tacKey(templateId, accountId);
  if (ctx.store.get<StoredTargetAccountConfiguration>(key) !== undefined) {
    throw conflictErr(
      `TargetAccountConfiguration already exists: ${accountId}`,
    );
  }

  const tac: StoredTargetAccountConfiguration = {
    experimentTemplateId: templateId,
    accountId,
    roleArn,
    description,
  };
  ctx.store.set(key, tac);
  return { targetAccountConfiguration: tacView(tac) };
};

const DeleteTargetAccountConfiguration: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const templateId = requireStr(input, "experimentTemplateId");
  const accountId = requireStr(input, "accountId");

  const key = tacKey(templateId, accountId);
  const tac = ctx.store.get<StoredTargetAccountConfiguration>(key);
  if (tac === undefined)
    throw notFoundErr(`TargetAccountConfiguration not found: ${accountId}`);

  ctx.store.delete(key);
  return { targetAccountConfiguration: tacView(tac) };
};

const GetTargetAccountConfiguration: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const templateId = requireStr(input, "experimentTemplateId");
  const accountId = requireStr(input, "accountId");

  const tac = ctx.store.get<StoredTargetAccountConfiguration>(
    tacKey(templateId, accountId),
  );
  if (tac === undefined)
    throw notFoundErr(`TargetAccountConfiguration not found: ${accountId}`);

  return { targetAccountConfiguration: tacView(tac) };
};

const UpdateTargetAccountConfiguration: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const templateId = requireStr(input, "experimentTemplateId");
  const accountId = requireStr(input, "accountId");

  const key = tacKey(templateId, accountId);
  const tac = ctx.store.get<StoredTargetAccountConfiguration>(key);
  if (tac === undefined)
    throw notFoundErr(`TargetAccountConfiguration not found: ${accountId}`);

  const updated: StoredTargetAccountConfiguration = {
    ...tac,
    roleArn: asStr(input["roleArn"]) ?? tac.roleArn,
    description:
      input["description"] !== undefined
        ? asStr(input["description"])
        : tac.description,
  };
  ctx.store.set(key, updated);
  return { targetAccountConfiguration: tacView(updated) };
};

const ListTargetAccountConfigurations: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const templateId = requireStr(input, "experimentTemplateId");
  const maxResults =
    typeof input["maxResults"] === "number" ? input["maxResults"] : 100;
  const nextToken = asStr(input["nextToken"]);

  const prefix = `${tacPrefix}${templateId}:`;
  const all = ctx.store
    .list<StoredTargetAccountConfiguration>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);

  const startIdx = nextToken !== undefined ? parseInt(atob(nextToken), 10) : 0;
  const page = all.slice(startIdx, startIdx + maxResults);
  const newNextToken =
    startIdx + maxResults < all.length
      ? btoa(String(startIdx + maxResults))
      : undefined;

  return {
    targetAccountConfigurations: page.map(tacView),
    nextToken: newNextToken,
  };
};

const ListExperimentTargetAccountConfigurations: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const experimentId = requireStr(input, "experimentId");
  const exp = ctx.store.get<StoredExperiment>(expKey(experimentId));
  if (exp === undefined)
    throw notFoundErr(`Experiment not found: ${experimentId}`);

  const nextToken = asStr(input["nextToken"]);
  const prefix = `${tacPrefix}${exp.experimentTemplateId}:`;
  const all = ctx.store
    .list<StoredTargetAccountConfiguration>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);

  const startIdx = nextToken !== undefined ? parseInt(atob(nextToken), 10) : 0;
  const page = all.slice(startIdx, startIdx + 100);
  const newNextToken =
    startIdx + 100 < all.length ? btoa(String(startIdx + 100)) : undefined;

  return {
    experimentTargetAccountConfigurations: page.map(tacView),
    nextToken: newNextToken,
  };
};

const GetExperimentTargetAccountConfiguration: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const experimentId = requireStr(input, "experimentId");
  const accountId = requireStr(input, "accountId");
  const exp = ctx.store.get<StoredExperiment>(expKey(experimentId));
  if (exp === undefined)
    throw notFoundErr(`Experiment not found: ${experimentId}`);

  const tac = ctx.store.get<StoredTargetAccountConfiguration>(
    tacKey(exp.experimentTemplateId, accountId),
  );
  if (tac === undefined)
    throw notFoundErr(
      `ExperimentTargetAccountConfiguration not found: ${accountId}`,
    );

  return { experimentTargetAccountConfiguration: tacView(tac) };
};

const ListExperimentResolvedTargets: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const experimentId = requireStr(input, "experimentId");
  const exp = ctx.store.get<StoredExperiment>(expKey(experimentId));
  if (exp === undefined)
    throw notFoundErr(`Experiment not found: ${experimentId}`);

  return { resolvedTargets: [], nextToken: undefined };
};

const GetAction: OperationHandler = (
  input: Record<string, unknown>,
  _ctx: ServiceContext,
) => {
  const id = requireStr(input, "id");
  const knownActions: Record<string, Record<string, unknown>> = {
    "aws:ec2:stop-instances": {
      id: "aws:ec2:stop-instances",
      description: "Stop EC2 instances.",
      parameters: {},
      targets: { Instances: { resourceType: "aws:ec2:instance" } },
      tags: {},
    },
    "aws:ec2:terminate-instances": {
      id: "aws:ec2:terminate-instances",
      description: "Terminate EC2 instances.",
      parameters: {},
      targets: { Instances: { resourceType: "aws:ec2:instance" } },
      tags: {},
    },
    "aws:ecs:stop-task": {
      id: "aws:ecs:stop-task",
      description: "Stop ECS tasks.",
      parameters: {},
      targets: { Tasks: { resourceType: "aws:ecs:task" } },
      tags: {},
    },
  };
  const action = knownActions[id];
  if (action === undefined) throw notFoundErr(`Action not found: ${id}`);
  return { action };
};

const ListActions: OperationHandler = (
  input: Record<string, unknown>,
  _ctx: ServiceContext,
) => {
  const maxResults =
    typeof input["maxResults"] === "number" ? input["maxResults"] : 100;
  const actions = [
    {
      id: "aws:ec2:stop-instances",
      description: "Stop EC2 instances.",
      targets: { Instances: { resourceType: "aws:ec2:instance" } },
      tags: {},
    },
    {
      id: "aws:ec2:terminate-instances",
      description: "Terminate EC2 instances.",
      targets: { Instances: { resourceType: "aws:ec2:instance" } },
      tags: {},
    },
    {
      id: "aws:ecs:stop-task",
      description: "Stop ECS tasks.",
      targets: { Tasks: { resourceType: "aws:ecs:task" } },
      tags: {},
    },
  ].slice(0, maxResults);
  return { actions, nextToken: undefined };
};

const GetTargetResourceType: OperationHandler = (
  input: Record<string, unknown>,
  _ctx: ServiceContext,
) => {
  const resourceType = requireStr(input, "resourceType");
  const known: Record<string, Record<string, unknown>> = {
    "aws:ec2:instance": {
      resourceType: "aws:ec2:instance",
      description: "EC2 instances.",
      parameters: {},
    },
    "aws:ecs:task": {
      resourceType: "aws:ecs:task",
      description: "ECS tasks.",
      parameters: {},
    },
  };
  const rt = known[resourceType];
  if (rt === undefined)
    throw notFoundErr(`TargetResourceType not found: ${resourceType}`);
  return { targetResourceType: rt };
};

const ListTargetResourceTypes: OperationHandler = (
  input: Record<string, unknown>,
  _ctx: ServiceContext,
) => {
  const maxResults =
    typeof input["maxResults"] === "number" ? input["maxResults"] : 100;
  const all = [
    {
      resourceType: "aws:ec2:instance",
      description: "EC2 instances.",
    },
    {
      resourceType: "aws:ecs:task",
      description: "ECS tasks.",
    },
  ].slice(0, maxResults);
  return { targetResourceTypes: all, nextToken: undefined };
};

const GetSafetyLever: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const id = requireStr(input, "id");
  let lever = ctx.store.get<StoredSafetyLever>(leverKey(id));
  if (lever === undefined) {
    lever = {
      id,
      arn: leverArn(ctx, id),
      state: { status: "disengaged", reason: "Safety lever is disengaged." },
    };
    ctx.store.set(leverKey(id), lever);
  }
  return { safetyLever: { id: lever.id, arn: lever.arn, state: lever.state } };
};

const UpdateSafetyLeverState: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const id = requireStr(input, "id");
  const state = asRecord(input["state"]);
  const status = asStr(state["status"]);
  if (status === undefined) {
    throw validationErr("state.status is required.");
  }

  let lever = ctx.store.get<StoredSafetyLever>(leverKey(id));
  if (lever === undefined) {
    lever = {
      id,
      arn: leverArn(ctx, id),
      state: { status: "disengaged", reason: "Safety lever is disengaged." },
    };
  }

  const updated: StoredSafetyLever = {
    ...lever,
    state: {
      status: status!,
      reason: asStr(state["reason"]) ?? lever.state.reason,
    },
  };
  ctx.store.set(leverKey(id), updated);
  return {
    safetyLever: { id: updated.id, arn: updated.arn, state: updated.state },
  };
};

const TagResource: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const resourceArn = requireStr(input, "resourceArn");
  const newTags = asTags(input["tags"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  ctx.store.set(tagKey(resourceArn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const resourceArn = requireStr(input, "resourceArn");
  const tagKeys = Array.isArray(input["tagKeys"])
    ? (input["tagKeys"] as string[])
    : [];
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  for (const k of tagKeys) {
    delete existing[k];
  }
  ctx.store.set(tagKey(resourceArn), existing);
  return {};
};

const ListTagsForResource: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const resourceArn = requireStr(input, "resourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  return { tags };
};

const fis = {
  name: "fis",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    const m = req.method;

    if (parts[0] === "experimentTemplates") {
      if (parts.length === 1) {
        if (m === "POST") return "CreateExperimentTemplate";
        if (m === "GET") return "ListExperimentTemplates";
        return undefined;
      }
      if (parts.length === 2) {
        if (m === "GET") return "GetExperimentTemplate";
        if (m === "PATCH") return "UpdateExperimentTemplate";
        if (m === "DELETE") return "DeleteExperimentTemplate";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "targetAccountConfigurations") {
        if (m === "GET") return "ListTargetAccountConfigurations";
        return undefined;
      }
      if (parts.length === 4 && parts[2] === "targetAccountConfigurations") {
        if (m === "POST") return "CreateTargetAccountConfiguration";
        if (m === "DELETE") return "DeleteTargetAccountConfiguration";
        if (m === "GET") return "GetTargetAccountConfiguration";
        if (m === "PATCH") return "UpdateTargetAccountConfiguration";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "experiments") {
      if (parts.length === 1) {
        if (m === "POST") return "StartExperiment";
        if (m === "GET") return "ListExperiments";
        return undefined;
      }
      if (parts.length === 2) {
        if (m === "GET") return "GetExperiment";
        if (m === "DELETE") return "StopExperiment";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "resolvedTargets" && m === "GET")
          return "ListExperimentResolvedTargets";
        if (parts[2] === "targetAccountConfigurations" && m === "GET")
          return "ListExperimentTargetAccountConfigurations";
        return undefined;
      }
      if (parts.length === 4 && parts[2] === "targetAccountConfigurations") {
        if (m === "GET") return "GetExperimentTargetAccountConfiguration";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "actions") {
      if (parts.length === 1 && m === "GET") return "ListActions";
      if (parts.length === 2 && m === "GET") return "GetAction";
      return undefined;
    }

    if (parts[0] === "targetResourceTypes") {
      if (parts.length === 1 && m === "GET") return "ListTargetResourceTypes";
      if (parts.length === 2 && m === "GET") return "GetTargetResourceType";
      return undefined;
    }

    if (parts[0] === "safetyLevers") {
      if (parts.length === 2 && m === "GET") return "GetSafetyLever";
      if (parts.length === 3 && parts[2] === "state" && m === "PATCH")
        return "UpdateSafetyLeverState";
      return undefined;
    }

    if (parts[0] === "tags") {
      if (parts.length >= 2) {
        if (m === "GET") return "ListTagsForResource";
        if (m === "POST") return "TagResource";
        if (m === "DELETE") return "UntagResource";
        return undefined;
      }
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateExperimentTemplate,
    DeleteExperimentTemplate,
    GetExperimentTemplate,
    UpdateExperimentTemplate,
    ListExperimentTemplates,
    StartExperiment,
    GetExperiment,
    StopExperiment,
    ListExperiments,
    CreateTargetAccountConfiguration,
    DeleteTargetAccountConfiguration,
    GetTargetAccountConfiguration,
    UpdateTargetAccountConfiguration,
    ListTargetAccountConfigurations,
    ListExperimentTargetAccountConfigurations,
    GetExperimentTargetAccountConfiguration,
    ListExperimentResolvedTargets,
    GetAction,
    ListActions,
    GetTargetResourceType,
    ListTargetResourceTypes,
    GetSafetyLever,
    UpdateSafetyLeverState,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default fis;
