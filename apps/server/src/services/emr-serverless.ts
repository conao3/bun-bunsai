import { awsError } from "../core/framework.ts";
import { callerArn } from "../core/arn.ts";
import { loadServiceModel } from "../core/shapes.ts";
import emrServerlessModel from "../../models/emr-serverless.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(emrServerlessModel);

const applicationPrefix = "application:" as const;
const jobRunPrefix = "jobrun:" as const;
const sessionPrefix = "session:" as const;
const tagsPrefix = "tags:" as const;
const clientTokenPrefix = "clienttoken:" as const;

type StoredApplication = {
  applicationId: string;
  name: string | undefined;
  arn: string;
  releaseLabel: string;
  type: string;
  state: string;
  stateDetails: string;
  createdAt: number;
  updatedAt: number;
  architecture: string;
  tags: Record<string, unknown>;
};

type StoredJobRun = {
  applicationId: string;
  jobRunId: string;
  name: string | undefined;
  arn: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  executionRole: string;
  state: string;
  stateDetails: string;
  releaseLabel: string;
  jobDriver: Record<string, unknown>;
  tags: Record<string, unknown>;
  mode: string | undefined;
};

type StoredSession = {
  applicationId: string;
  sessionId: string;
  name: string | undefined;
  arn: string;
  state: string;
  stateDetails: string;
  releaseLabel: string;
  executionRoleArn: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  tags: Record<string, unknown>;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const applicationKey = (id: string): string => `${applicationPrefix}${id}`;
const jobRunKey = (appId: string, runId: string): string =>
  `${jobRunPrefix}${appId}:${runId}`;
const sessionKey = (appId: string, sessionId: string): string =>
  `${sessionPrefix}${appId}:${sessionId}`;
const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;
const clientTokenAppKey = (token: string): string =>
  `${clientTokenPrefix}app:${token}`;
const clientTokenJobRunKey = (appId: string, token: string): string =>
  `${clientTokenPrefix}jobrun:${appId}:${token}`;
const clientTokenSessionKey = (appId: string, token: string): string =>
  `${clientTokenPrefix}session:${appId}:${token}`;
const clientTokenUpdateAppKey = (appId: string, token: string): string =>
  `${clientTokenPrefix}updateapp:${appId}:${token}`;

const newId = (): string =>
  `00${crypto.randomUUID().replaceAll("-", "")}`.slice(0, 16);

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const encodeCursor = (offset: number): string => btoa(String(offset));

const decodeCursor = (token: string): number => {
  const n = parseInt(atob(token), 10);
  return isNaN(n) ? 0 : n;
};

const paginate = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
): { items: T[]; nextToken: string | undefined } => {
  const offset = typeof nextToken === "string" ? decodeCursor(nextToken) : 0;
  const max =
    typeof maxResults === "number" && maxResults > 0
      ? maxResults
      : items.length;
  const page = items.slice(offset, offset + max);
  const token =
    offset + max < items.length ? encodeCursor(offset + max) : undefined;
  return { items: page, nextToken: token };
};

const requireApplication = (
  ctx: ServiceContext,
  id: string,
): StoredApplication => {
  const stored = ctx.store.get<StoredApplication>(applicationKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Application ${id} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireJobRun = (
  ctx: ServiceContext,
  appId: string,
  runId: string,
): StoredJobRun => {
  const stored = ctx.store.get<StoredJobRun>(jobRunKey(appId, runId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Job run ${runId} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireSession = (
  ctx: ServiceContext,
  appId: string,
  sessionId: string,
): StoredSession => {
  const stored = ctx.store.get<StoredSession>(sessionKey(appId, sessionId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Session ${sessionId} does not exist.`,
      404,
    );
  }
  return stored;
};

const validateResourceArn = (ctx: ServiceContext, arn: string): void => {
  const arnParts = arn.split(":");
  if (arnParts.length < 6) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      404,
    );
  }
  const parts = arnParts[5].split("/").filter((p) => p !== "");
  if (parts[0] !== "applications" || !parts[1]) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      404,
    );
  }
  const appId = parts[1];
  requireApplication(ctx, appId);
  if (parts.length === 2) return;
  if (parts[2] === "jobruns" && parts[3]) {
    requireJobRun(ctx, appId, parts[3]);
    return;
  }
  if (parts[2] === "sessions" && parts[3]) {
    requireSession(ctx, appId, parts[3]);
    return;
  }
  throw awsError(
    "ResourceNotFoundException",
    `Resource not found: ${arn}`,
    404,
  );
};

const applicationView = (
  application: StoredApplication,
): Record<string, unknown> => ({
  applicationId: application.applicationId,
  name: application.name,
  arn: application.arn,
  releaseLabel: application.releaseLabel,
  type: application.type,
  state: application.state,
  stateDetails: application.stateDetails,
  createdAt: application.createdAt,
  updatedAt: application.updatedAt,
  architecture: application.architecture,
  tags: application.tags,
});

const applicationSummary = (
  application: StoredApplication,
): Record<string, unknown> => ({
  id: application.applicationId,
  name: application.name,
  arn: application.arn,
  releaseLabel: application.releaseLabel,
  type: application.type,
  state: application.state,
  stateDetails: application.stateDetails,
  createdAt: application.createdAt,
  updatedAt: application.updatedAt,
  architecture: application.architecture,
});

const jobRunView = (run: StoredJobRun): Record<string, unknown> => ({
  applicationId: run.applicationId,
  jobRunId: run.jobRunId,
  name: run.name,
  arn: run.arn,
  createdBy: run.createdBy,
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
  executionRole: run.executionRole,
  state: run.state,
  stateDetails: run.stateDetails,
  releaseLabel: run.releaseLabel,
  jobDriver: run.jobDriver,
  tags: run.tags,
  mode: run.mode,
});

const jobRunSummary = (run: StoredJobRun): Record<string, unknown> => ({
  applicationId: run.applicationId,
  id: run.jobRunId,
  name: run.name,
  arn: run.arn,
  createdBy: run.createdBy,
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
  executionRole: run.executionRole,
  state: run.state,
  stateDetails: run.stateDetails,
  releaseLabel: run.releaseLabel,
  mode: run.mode,
});

const jobRunAttemptSummary = (run: StoredJobRun): Record<string, unknown> => ({
  applicationId: run.applicationId,
  id: run.jobRunId,
  name: run.name,
  arn: run.arn,
  createdBy: run.createdBy,
  jobCreatedAt: run.createdAt,
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
  executionRole: run.executionRole,
  state: run.state,
  stateDetails: run.stateDetails,
  releaseLabel: run.releaseLabel,
  attempt: 1,
  mode: run.mode,
});

const sessionView = (session: StoredSession): Record<string, unknown> => ({
  applicationId: session.applicationId,
  sessionId: session.sessionId,
  name: session.name,
  arn: session.arn,
  state: session.state,
  stateDetails: session.stateDetails,
  releaseLabel: session.releaseLabel,
  executionRoleArn: session.executionRoleArn,
  createdBy: session.createdBy,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
});

const sessionSummary = (session: StoredSession): Record<string, unknown> => ({
  applicationId: session.applicationId,
  sessionId: session.sessionId,
  name: session.name,
  arn: session.arn,
  state: session.state,
  stateDetails: session.stateDetails,
  releaseLabel: session.releaseLabel,
  executionRoleArn: session.executionRoleArn,
  createdBy: session.createdBy,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
});

const CreateApplication: OperationHandler = (input, ctx) => {
  const clientToken = stringOrUndefined(input["clientToken"]);
  if (clientToken !== undefined) {
    const cached = ctx.store.get<{
      applicationId: string;
      name: string | undefined;
      arn: string;
    }>(clientTokenAppKey(clientToken));
    if (cached !== undefined) return cached;
  }
  const releaseLabel = requireString(input, "releaseLabel");
  const type = requireString(input, "type");
  const id = newId();
  const now = nowSeconds();
  const arn = `arn:aws:emr-serverless:${ctx.region}:${ctx.account}:/applications/${id}`;
  const application: StoredApplication = {
    applicationId: id,
    name: stringOrUndefined(input["name"]),
    arn,
    releaseLabel,
    type,
    state: "CREATED",
    stateDetails: "",
    createdAt: now,
    updatedAt: now,
    architecture: stringOrUndefined(input["architecture"]) ?? "X86_64",
    tags: recordOrEmpty(input["tags"]),
  };
  ctx.store.set(applicationKey(id), application);
  const result = {
    applicationId: application.applicationId,
    name: application.name,
    arn: application.arn,
  };
  if (clientToken !== undefined) {
    ctx.store.set(clientTokenAppKey(clientToken), result);
  }
  return result;
};

const GetApplication: OperationHandler = (input, ctx) => {
  const id = requireString(input, "applicationId");
  return { application: applicationView(requireApplication(ctx, id)) };
};

const ListApplications: OperationHandler = (input, ctx) => {
  const statesFilter = Array.isArray(input["states"])
    ? (input["states"] as string[])
    : undefined;
  const applications = ctx.store
    .list<StoredApplication>()
    .filter((entry) => entry.key.startsWith(applicationPrefix))
    .map((entry) => entry.value)
    .filter(
      (app) => statesFilter === undefined || statesFilter.includes(app.state),
    )
    .sort((a, b) =>
      a.applicationId < b.applicationId
        ? -1
        : a.applicationId > b.applicationId
          ? 1
          : 0,
    );
  const { items, nextToken } = paginate(
    applications,
    input["maxResults"],
    input["nextToken"],
  );
  return { applications: items.map(applicationSummary), nextToken };
};

const DeleteApplication: OperationHandler = (input, ctx) => {
  const id = requireString(input, "applicationId");
  const app = requireApplication(ctx, id);
  if (app.state === "STARTED") {
    throw awsError(
      "ValidationException",
      `Application ${id} cannot be deleted from state ${app.state}.`,
      400,
    );
  }
  const activeJobRunStates = [
    "SUBMITTED",
    "PENDING",
    "SCHEDULED",
    "QUEUED",
    "RUNNING",
  ] as const;
  const hasActiveJobRun = ctx.store
    .list<StoredJobRun>()
    .filter((entry) => entry.key.startsWith(`${jobRunPrefix}${id}:`))
    .map((entry) => entry.value)
    .some((run) =>
      activeJobRunStates.includes(
        run.state as (typeof activeJobRunStates)[number],
      ),
    );
  if (hasActiveJobRun) {
    throw awsError(
      "ValidationException",
      `Application ${id} has active job runs.`,
      400,
    );
  }
  const activeSessionStates = ["CREATING", "ACTIVE"] as const;
  const hasActiveSession = ctx.store
    .list<StoredSession>()
    .filter((entry) => entry.key.startsWith(`${sessionPrefix}${id}:`))
    .map((entry) => entry.value)
    .some((s) =>
      activeSessionStates.includes(
        s.state as (typeof activeSessionStates)[number],
      ),
    );
  if (hasActiveSession) {
    throw awsError(
      "ValidationException",
      `Application ${id} has active sessions.`,
      400,
    );
  }
  ctx.store.delete(tagsKey(app.arn));
  ctx.store.delete(applicationKey(id));
  return {};
};

const StartApplication: OperationHandler = (input, ctx) => {
  const id = requireString(input, "applicationId");
  const app = requireApplication(ctx, id);
  if (app.state !== "CREATED" && app.state !== "STOPPED") {
    throw awsError(
      "ValidationException",
      `Application ${id} cannot be started from state ${app.state}.`,
      400,
    );
  }
  ctx.store.set(applicationKey(id), {
    ...app,
    state: "STARTED",
    updatedAt: nowSeconds(),
  });
  return {};
};

const StopApplication: OperationHandler = (input, ctx) => {
  const id = requireString(input, "applicationId");
  const app = requireApplication(ctx, id);
  if (app.state !== "STARTED") {
    throw awsError(
      "ValidationException",
      `Application ${id} cannot be stopped from state ${app.state}.`,
      400,
    );
  }
  ctx.store.set(applicationKey(id), {
    ...app,
    state: "STOPPED",
    updatedAt: nowSeconds(),
  });
  return {};
};

const UpdateApplication: OperationHandler = (input, ctx) => {
  const id = requireString(input, "applicationId");
  const clientToken = stringOrUndefined(input["clientToken"]);
  if (clientToken !== undefined) {
    const cached = ctx.store.get<{ application: Record<string, unknown> }>(
      clientTokenUpdateAppKey(id, clientToken),
    );
    if (cached !== undefined) return cached;
  }
  const app = requireApplication(ctx, id);
  if (app.state !== "CREATED" && app.state !== "STARTED") {
    throw awsError(
      "ValidationException",
      `Application ${id} cannot be updated from state ${app.state}.`,
      400,
    );
  }
  const updated: StoredApplication = {
    ...app,
    architecture: stringOrUndefined(input["architecture"]) ?? app.architecture,
    updatedAt: nowSeconds(),
  };
  ctx.store.set(applicationKey(id), updated);
  const result = { application: applicationView(updated) };
  if (clientToken !== undefined) {
    ctx.store.set(clientTokenUpdateAppKey(id, clientToken), result);
  }
  return result;
};

const StartJobRun: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "applicationId");
  const clientToken = stringOrUndefined(input["clientToken"]);
  if (clientToken !== undefined) {
    const cached = ctx.store.get<{
      applicationId: string;
      jobRunId: string;
      arn: string;
    }>(clientTokenJobRunKey(appId, clientToken));
    if (cached !== undefined) return cached;
  }
  const app = requireApplication(ctx, appId);
  const executionRole = requireString(input, "executionRoleArn");
  const modeInput = stringOrUndefined(input["mode"] as unknown);
  if (
    modeInput !== undefined &&
    modeInput !== "BATCH" &&
    modeInput !== "STREAMING"
  ) {
    throw awsError(
      "ValidationException",
      `Invalid mode: ${modeInput}. Valid values are BATCH and STREAMING.`,
      400,
    );
  }
  const id = newId();
  const now = nowSeconds();
  const arn = `arn:aws:emr-serverless:${ctx.region}:${ctx.account}:/applications/${appId}/jobruns/${id}`;
  const jobRun: StoredJobRun = {
    applicationId: appId,
    jobRunId: id,
    name: stringOrUndefined(input["name"]),
    arn,
    createdBy: callerArn(ctx.account),
    createdAt: now,
    updatedAt: now,
    executionRole,
    state: "SUBMITTED",
    stateDetails: "",
    releaseLabel: app.releaseLabel,
    jobDriver: recordOrEmpty(input["jobDriver"]),
    tags: recordOrEmpty(input["tags"]),
    mode: modeInput,
  };
  ctx.store.set(jobRunKey(appId, id), jobRun);
  const result = { applicationId: appId, jobRunId: id, arn };
  if (clientToken !== undefined) {
    ctx.store.set(clientTokenJobRunKey(appId, clientToken), result);
  }
  return result;
};

const GetJobRun: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "applicationId");
  const runId = requireString(input, "jobRunId");
  requireApplication(ctx, appId);
  return { jobRun: jobRunView(requireJobRun(ctx, appId, runId)) };
};

const CancelJobRun: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "applicationId");
  const runId = requireString(input, "jobRunId");
  requireApplication(ctx, appId);
  const run = requireJobRun(ctx, appId, runId);
  const cancellableStates = [
    "SUBMITTED",
    "PENDING",
    "QUEUED",
    "RUNNING",
  ] as const;
  if (
    !cancellableStates.includes(run.state as (typeof cancellableStates)[number])
  ) {
    throw awsError(
      "ValidationException",
      `Job run ${runId} cannot be cancelled from state ${run.state}.`,
      400,
    );
  }
  ctx.store.set(jobRunKey(appId, runId), {
    ...run,
    state: "CANCELLING",
    updatedAt: nowSeconds(),
  });
  return { applicationId: appId, jobRunId: runId };
};

const ListJobRuns: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "applicationId");
  requireApplication(ctx, appId);
  const prefix = `${jobRunPrefix}${appId}:`;
  const statesFilter = Array.isArray(input["states"])
    ? (input["states"] as string[])
    : undefined;
  const createdAtAfter =
    typeof input["createdAtAfter"] === "number"
      ? input["createdAtAfter"]
      : undefined;
  const createdAtBefore =
    typeof input["createdAtBefore"] === "number"
      ? input["createdAtBefore"]
      : undefined;
  const modeFilter =
    typeof input["mode"] === "string" ? input["mode"] : undefined;
  const jobRuns = ctx.store
    .list<StoredJobRun>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value)
    .filter(
      (run) => statesFilter === undefined || statesFilter.includes(run.state),
    )
    .filter(
      (run) => createdAtAfter === undefined || run.createdAt >= createdAtAfter,
    )
    .filter(
      (run) =>
        createdAtBefore === undefined || run.createdAt <= createdAtBefore,
    )
    .filter((run) => modeFilter === undefined || run.mode === modeFilter)
    .sort((a, b) =>
      a.jobRunId < b.jobRunId ? -1 : a.jobRunId > b.jobRunId ? 1 : 0,
    );
  const { items, nextToken } = paginate(
    jobRuns,
    input["maxResults"],
    input["nextToken"],
  );
  return { jobRuns: items.map(jobRunSummary), nextToken };
};

const ListJobRunAttempts: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "applicationId");
  const runId = requireString(input, "jobRunId");
  requireApplication(ctx, appId);
  const run = requireJobRun(ctx, appId, runId);
  return { jobRunAttempts: [jobRunAttemptSummary(run)] };
};

const GetDashboardForJobRun: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "applicationId");
  const runId = requireString(input, "jobRunId");
  requireApplication(ctx, appId);
  requireJobRun(ctx, appId, runId);
  return {
    url: `https://us-east-1.console.aws.amazon.com/emr/home#/serverless/applications/${appId}/job-runs/${runId}`,
  };
};

const GetResourceDashboard: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "applicationId");
  requireApplication(ctx, appId);
  return {
    url: `https://us-east-1.console.aws.amazon.com/emr/home#/serverless/applications/${appId}`,
  };
};

const StartSession: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "applicationId");
  const clientToken = stringOrUndefined(input["clientToken"]);
  if (clientToken !== undefined) {
    const cached = ctx.store.get<{
      applicationId: string;
      sessionId: string;
      arn: string;
    }>(clientTokenSessionKey(appId, clientToken));
    if (cached !== undefined) return cached;
  }
  const app = requireApplication(ctx, appId);
  const executionRoleArn = requireString(input, "executionRoleArn");
  const id = newId();
  const now = nowSeconds();
  const arn = `arn:aws:emr-serverless:${ctx.region}:${ctx.account}:/applications/${appId}/sessions/${id}`;
  const session: StoredSession = {
    applicationId: appId,
    sessionId: id,
    name: stringOrUndefined(input["name"]),
    arn,
    state: "ACTIVE",
    stateDetails: "",
    releaseLabel: app.releaseLabel,
    executionRoleArn,
    createdBy: callerArn(ctx.account),
    createdAt: now,
    updatedAt: now,
    tags: recordOrEmpty(input["tags"]),
  };
  ctx.store.set(sessionKey(appId, id), session);
  const result = { applicationId: appId, sessionId: id, arn };
  if (clientToken !== undefined) {
    ctx.store.set(clientTokenSessionKey(appId, clientToken), result);
  }
  return result;
};

const GetSession: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "applicationId");
  const id = requireString(input, "sessionId");
  requireApplication(ctx, appId);
  return { session: sessionView(requireSession(ctx, appId, id)) };
};

const ListSessions: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "applicationId");
  requireApplication(ctx, appId);
  const prefix = `${sessionPrefix}${appId}:`;
  const statesFilter = Array.isArray(input["states"])
    ? (input["states"] as string[])
    : undefined;
  const createdAtAfter =
    typeof input["createdAtAfter"] === "number"
      ? input["createdAtAfter"]
      : undefined;
  const createdAtBefore =
    typeof input["createdAtBefore"] === "number"
      ? input["createdAtBefore"]
      : undefined;
  const sessions = ctx.store
    .list<StoredSession>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value)
    .filter((s) => statesFilter === undefined || statesFilter.includes(s.state))
    .filter(
      (s) => createdAtAfter === undefined || s.createdAt >= createdAtAfter,
    )
    .filter(
      (s) => createdAtBefore === undefined || s.createdAt <= createdAtBefore,
    )
    .sort((a, b) =>
      a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0,
    );
  const { items, nextToken } = paginate(
    sessions,
    input["maxResults"],
    input["nextToken"],
  );
  return { sessions: items.map(sessionSummary), nextToken };
};

const TerminateSession: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "applicationId");
  const id = requireString(input, "sessionId");
  requireApplication(ctx, appId);
  const session = requireSession(ctx, appId, id);
  const nonTerminableStates = [
    "TERMINATING",
    "TERMINATED",
    "TERMINATED_WITH_ERRORS",
  ] as const;
  if (
    nonTerminableStates.includes(
      session.state as (typeof nonTerminableStates)[number],
    )
  ) {
    throw awsError(
      "ValidationException",
      `Session ${id} cannot be terminated from state ${session.state}.`,
      400,
    );
  }
  ctx.store.set(sessionKey(appId, id), {
    ...session,
    state: "TERMINATING",
    updatedAt: nowSeconds(),
  });
  return { applicationId: appId, sessionId: id };
};

const GetSessionEndpoint: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "applicationId");
  const id = requireString(input, "sessionId");
  requireApplication(ctx, appId);
  requireSession(ctx, appId, id);
  const now = nowSeconds();
  return {
    applicationId: appId,
    sessionId: id,
    endpoint: `https://emr-serverless.${ctx.region}.amazonaws.com/sessions/${id}`,
    authToken: `token-${id}`,
    authTokenExpiresAt: now + 3600,
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  validateResourceArn(ctx, arn);
  const newTags = recordOrEmpty(input["tags"]);
  const key = tagsKey(arn);
  const existing = ctx.store.get<Record<string, unknown>>(key) ?? {};
  ctx.store.set(key, { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx, req) => {
  const arn = requireString(input, "resourceArn");
  validateResourceArn(ctx, arn);
  const key = tagsKey(arn);
  const existing = ctx.store.get<Record<string, unknown>>(key) ?? {};
  const tagKeys = req.url.searchParams.getAll("tagKeys");
  const updated = { ...existing };
  for (const k of tagKeys) {
    delete updated[k];
  }
  ctx.store.set(key, updated);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  validateResourceArn(ctx, arn);
  const tags = ctx.store.get<Record<string, unknown>>(tagsKey(arn)) ?? {};
  return { tags };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const emrServerless = {
  name: "emr-serverless",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] === "tags") {
      if (parts.length < 2) return undefined;
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      if (req.method === "GET") return "ListTagsForResource";
      return undefined;
    }
    if (parts[0] !== "applications") return undefined;
    if (parts.length === 1) {
      if (req.method === "POST") return "CreateApplication";
      if (req.method === "GET") return "ListApplications";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "GET") return "GetApplication";
      if (req.method === "DELETE") return "DeleteApplication";
      if (req.method === "PATCH") return "UpdateApplication";
      return undefined;
    }
    if (parts.length === 3) {
      if (parts[2] === "start" && req.method === "POST")
        return "StartApplication";
      if (parts[2] === "stop" && req.method === "POST")
        return "StopApplication";
      if (parts[2] === "dashboard" && req.method === "GET")
        return "GetResourceDashboard";
      if (parts[2] === "jobruns") {
        if (req.method === "POST") return "StartJobRun";
        if (req.method === "GET") return "ListJobRuns";
      }
      if (parts[2] === "sessions") {
        if (req.method === "POST") return "StartSession";
        if (req.method === "GET") return "ListSessions";
      }
      return undefined;
    }
    if (parts.length === 4) {
      if (parts[2] === "jobruns") {
        if (req.method === "GET") return "GetJobRun";
        if (req.method === "DELETE") return "CancelJobRun";
      }
      if (parts[2] === "sessions") {
        if (req.method === "GET") return "GetSession";
        if (req.method === "DELETE") return "TerminateSession";
      }
      return undefined;
    }
    if (parts.length === 5) {
      if (parts[2] === "jobruns") {
        if (parts[4] === "dashboard" && req.method === "GET")
          return "GetDashboardForJobRun";
        if (parts[4] === "attempts" && req.method === "GET")
          return "ListJobRunAttempts";
      }
      if (parts[2] === "sessions") {
        if (parts[4] === "endpoint" && req.method === "GET")
          return "GetSessionEndpoint";
      }
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateApplication,
    GetApplication,
    ListApplications,
    DeleteApplication,
    StartApplication,
    StopApplication,
    UpdateApplication,
    StartJobRun,
    GetJobRun,
    CancelJobRun,
    ListJobRuns,
    ListJobRunAttempts,
    GetDashboardForJobRun,
    GetResourceDashboard,
    StartSession,
    GetSession,
    ListSessions,
    TerminateSession,
    GetSessionEndpoint,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default emrServerless;
