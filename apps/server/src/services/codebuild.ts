import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import codebuildModel from "../../../../test/vendor/aws-models/codebuild.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(codebuildModel);

type StoredProject = {
  name: string;
  arn: string;
  description: string | undefined;
  source: Record<string, unknown> | undefined;
  secondarySources: unknown[] | undefined;
  sourceVersion: string | undefined;
  artifacts: Record<string, unknown> | undefined;
  cache: Record<string, unknown> | undefined;
  environment: Record<string, unknown> | undefined;
  serviceRole: string | undefined;
  timeoutInMinutes: number | undefined;
  queuedTimeoutInMinutes: number | undefined;
  encryptionKey: string | undefined;
  tags: unknown[];
  created: number;
  lastModified: number;
  badge: Record<string, unknown>;
  logsConfig: Record<string, unknown> | undefined;
  concurrentBuildLimit: number | undefined;
  projectVisibility: string;
};

type StoredBuild = {
  id: string;
  arn: string;
  buildNumber: number;
  startTime: number;
  endTime: number;
  currentPhase: string;
  buildStatus: string;
  sourceVersion: string | undefined;
  resolvedSourceVersion: string | undefined;
  projectName: string;
  source: Record<string, unknown> | undefined;
  artifacts: Record<string, unknown> | undefined;
  cache: Record<string, unknown> | undefined;
  environment: Record<string, unknown> | undefined;
  serviceRole: string | undefined;
  timeoutInMinutes: number | undefined;
  queuedTimeoutInMinutes: number | undefined;
  buildComplete: boolean;
  initiator: string;
  encryptionKey: string | undefined;
};

type StoredBuildBatch = {
  id: string;
  arn: string;
  startTime: number;
  endTime: number;
  currentPhase: string;
  buildBatchStatus: string;
  projectName: string;
  sourceVersion: string | undefined;
  resolvedSourceVersion: string | undefined;
  source: Record<string, unknown> | undefined;
  artifacts: Record<string, unknown> | undefined;
  cache: Record<string, unknown> | undefined;
  environment: Record<string, unknown> | undefined;
  serviceRole: string | undefined;
  buildTimeoutInMinutes: number | undefined;
  queuedTimeoutInMinutes: number | undefined;
  complete: boolean;
  initiator: string;
  encryptionKey: string | undefined;
  buildBatchNumber: number;
  buildGroups: unknown[];
};

type StoredFleet = {
  arn: string;
  name: string;
  id: string;
  created: number;
  lastModified: number;
  status: Record<string, unknown>;
  baseCapacity: number;
  environmentType: string;
  computeType: string;
  computeConfiguration: Record<string, unknown> | undefined;
  scalingConfiguration: Record<string, unknown> | undefined;
  overflowBehavior: string | undefined;
  vpcConfig: Record<string, unknown> | undefined;
  proxyConfiguration: Record<string, unknown> | undefined;
  imageId: string | undefined;
  fleetServiceRole: string | undefined;
  tags: unknown[];
};

type StoredReportGroup = {
  arn: string;
  name: string;
  type: string;
  exportConfig: Record<string, unknown>;
  created: number;
  lastModified: number;
  tags: unknown[];
  status: string;
};

type StoredReport = {
  arn: string;
  type: string;
  name: string;
  reportGroupArn: string;
  executionId: string;
  status: string;
  created: number;
  expired: number;
  exportConfig: Record<string, unknown> | undefined;
  truncated: boolean;
  testSummary: Record<string, unknown> | undefined;
  codeCoverageSummary: Record<string, unknown> | undefined;
};

type StoredWebhook = {
  projectName: string;
  url: string;
  payloadUrl: string;
  secret: string;
  branchFilter: string | undefined;
  filterGroups: unknown[];
  buildType: string | undefined;
  manualCreation: boolean | undefined;
  scopeConfiguration: Record<string, unknown> | undefined;
  status: string;
  lastModifiedSecret: number;
  pullRequestBuildPolicy: string | undefined;
};

type StoredSandbox = {
  id: string;
  arn: string;
  projectName: string | undefined;
  requestTime: number;
  startTime: number;
  endTime: number;
  status: Record<string, unknown>;
  source: Record<string, unknown> | undefined;
  sourceVersion: string | undefined;
  secondarySources: unknown[] | undefined;
  secondarySourceVersions: unknown[] | undefined;
  environment: Record<string, unknown> | undefined;
  fileSystemLocations: unknown[] | undefined;
  timeoutInMinutes: number;
  queuedTimeoutInMinutes: number;
  vpcConfig: Record<string, unknown> | undefined;
  logConfig: Record<string, unknown> | undefined;
  encryptionKey: string | undefined;
  serviceRole: string | undefined;
  currentSession: Record<string, unknown> | undefined;
};

type StoredCommandExecution = {
  id: string;
  sandboxId: string;
  sandboxArn: string;
  submitTime: number;
  startTime: number;
  endTime: number;
  status: string;
  command: string;
  type: string | undefined;
  exitCode: string;
  standardOutputContent: string;
  standardErrContent: string;
  logs: Record<string, unknown> | undefined;
};

type StoredSourceCredentials = {
  arn: string;
  serverType: string;
  authType: string;
  resource: string | undefined;
};

type StoredResourcePolicy = {
  resourceArn: string;
  policy: string;
};

const projectKey = (name: string): string => `project/${name}`;

const buildKey = (id: string): string => `build/${id}`;

const buildBatchKey = (id: string): string => `build-batch/${id}`;

const fleetKey = (arn: string): string => `fleet/${arn}`;

const reportGroupKey = (arn: string): string => `report-group/${arn}`;

const reportKey = (arn: string): string => `report/${arn}`;

const webhookKey = (projectName: string): string => `webhook/${projectName}`;

const sandboxKey = (id: string): string => `sandbox/${id}`;

const commandExecutionKey = (sandboxId: string, id: string): string =>
  `command-execution/${sandboxId}/${id}`;

const sourceCredentialsKey = (arn: string): string =>
  `source-credentials/${arn}`;

const resourcePolicyKey = (resourceArn: string): string =>
  `resource-policy/${resourceArn}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidInputException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const arrayOrUndefined = (value: unknown): unknown[] | undefined =>
  Array.isArray(value) ? (value as unknown[]) : undefined;

const tagsFromInput = (value: unknown): unknown[] =>
  Array.isArray(value) ? (value as unknown[]) : [];

const stringListFromInput = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
};

const projectArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:codebuild:${ctx.region}:${ctx.account}:project/${name}`;

const buildId = (name: string): string => `${name}:${crypto.randomUUID()}`;

const buildArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:codebuild:${ctx.region}:${ctx.account}:build/${id}`;

const buildBatchId = (name: string): string => `${name}:${crypto.randomUUID()}`;

const buildBatchArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:codebuild:${ctx.region}:${ctx.account}:build-batch/${id}`;

const makeFleetArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:codebuild:${ctx.region}:${ctx.account}:fleet/${name}`;

const makeReportGroupArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:codebuild:${ctx.region}:${ctx.account}:report-group/${name}`;

const makeReportArn = (ctx: ServiceContext, reportGroupName: string): string =>
  `arn:aws:codebuild:${ctx.region}:${ctx.account}:report/${reportGroupName}:${crypto.randomUUID()}`;

const makeSandboxArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:codebuild:${ctx.region}:${ctx.account}:sandbox/${id}`;

const makeSourceCredentialsArn = (
  ctx: ServiceContext,
  serverType: string,
): string =>
  `arn:aws:codebuild:${ctx.region}:${ctx.account}:token/${serverType.toLowerCase()}`;

const listProjects = (ctx: ServiceContext): StoredProject[] =>
  ctx.store
    .list<StoredProject>()
    .filter((entry) => entry.key.startsWith("project/"))
    .map((entry) => entry.value);

const listBuilds = (ctx: ServiceContext): StoredBuild[] =>
  ctx.store
    .list<StoredBuild>()
    .filter((entry) => entry.key.startsWith("build/"))
    .map((entry) => entry.value);

const listBuildBatches = (ctx: ServiceContext): StoredBuildBatch[] =>
  ctx.store
    .list<StoredBuildBatch>()
    .filter((entry) => entry.key.startsWith("build-batch/"))
    .map((entry) => entry.value);

const listFleets = (ctx: ServiceContext): StoredFleet[] =>
  ctx.store
    .list<StoredFleet>()
    .filter((entry) => entry.key.startsWith("fleet/"))
    .map((entry) => entry.value);

const listReportGroups = (ctx: ServiceContext): StoredReportGroup[] =>
  ctx.store
    .list<StoredReportGroup>()
    .filter((entry) => entry.key.startsWith("report-group/"))
    .map((entry) => entry.value);

const listReports = (ctx: ServiceContext): StoredReport[] =>
  ctx.store
    .list<StoredReport>()
    .filter((entry) => entry.key.startsWith("report/"))
    .map((entry) => entry.value);

const listSandboxes = (ctx: ServiceContext): StoredSandbox[] =>
  ctx.store
    .list<StoredSandbox>()
    .filter((entry) => entry.key.startsWith("sandbox/"))
    .map((entry) => entry.value);

const listCommandExecutions = (ctx: ServiceContext): StoredCommandExecution[] =>
  ctx.store
    .list<StoredCommandExecution>()
    .filter((entry) => entry.key.startsWith("command-execution/"))
    .map((entry) => entry.value);

const listSourceCredentials = (
  ctx: ServiceContext,
): StoredSourceCredentials[] =>
  ctx.store
    .list<StoredSourceCredentials>()
    .filter((entry) => entry.key.startsWith("source-credentials/"))
    .map((entry) => entry.value);

const projectView = (project: StoredProject): Record<string, unknown> => ({
  name: project.name,
  arn: project.arn,
  description: project.description,
  source: project.source,
  secondarySources: project.secondarySources,
  sourceVersion: project.sourceVersion,
  artifacts: project.artifacts,
  cache: project.cache,
  environment: project.environment,
  serviceRole: project.serviceRole,
  timeoutInMinutes: project.timeoutInMinutes,
  queuedTimeoutInMinutes: project.queuedTimeoutInMinutes,
  encryptionKey: project.encryptionKey,
  tags: project.tags,
  created: project.created,
  lastModified: project.lastModified,
  badge: project.badge,
  logsConfig: project.logsConfig,
  concurrentBuildLimit: project.concurrentBuildLimit,
  projectVisibility: project.projectVisibility,
});

const buildView = (build: StoredBuild): Record<string, unknown> => ({
  id: build.id,
  arn: build.arn,
  buildNumber: build.buildNumber,
  startTime: build.startTime,
  endTime: build.endTime,
  currentPhase: build.currentPhase,
  buildStatus: build.buildStatus,
  sourceVersion: build.sourceVersion,
  resolvedSourceVersion: build.resolvedSourceVersion,
  projectName: build.projectName,
  source: build.source,
  artifacts: build.artifacts,
  cache: build.cache,
  environment: build.environment,
  serviceRole: build.serviceRole,
  timeoutInMinutes: build.timeoutInMinutes,
  queuedTimeoutInMinutes: build.queuedTimeoutInMinutes,
  buildComplete: build.buildComplete,
  initiator: build.initiator,
  encryptionKey: build.encryptionKey,
});

const buildBatchView = (batch: StoredBuildBatch): Record<string, unknown> => ({
  id: batch.id,
  arn: batch.arn,
  startTime: batch.startTime,
  endTime: batch.endTime,
  currentPhase: batch.currentPhase,
  buildBatchStatus: batch.buildBatchStatus,
  projectName: batch.projectName,
  sourceVersion: batch.sourceVersion,
  resolvedSourceVersion: batch.resolvedSourceVersion,
  source: batch.source,
  artifacts: batch.artifacts,
  cache: batch.cache,
  environment: batch.environment,
  serviceRole: batch.serviceRole,
  buildTimeoutInMinutes: batch.buildTimeoutInMinutes,
  queuedTimeoutInMinutes: batch.queuedTimeoutInMinutes,
  complete: batch.complete,
  initiator: batch.initiator,
  encryptionKey: batch.encryptionKey,
  buildBatchNumber: batch.buildBatchNumber,
  buildGroups: batch.buildGroups,
});

const fleetView = (fleet: StoredFleet): Record<string, unknown> => ({
  arn: fleet.arn,
  name: fleet.name,
  id: fleet.id,
  created: fleet.created,
  lastModified: fleet.lastModified,
  status: fleet.status,
  baseCapacity: fleet.baseCapacity,
  environmentType: fleet.environmentType,
  computeType: fleet.computeType,
  computeConfiguration: fleet.computeConfiguration,
  scalingConfiguration: fleet.scalingConfiguration,
  overflowBehavior: fleet.overflowBehavior,
  vpcConfig: fleet.vpcConfig,
  proxyConfiguration: fleet.proxyConfiguration,
  imageId: fleet.imageId,
  fleetServiceRole: fleet.fleetServiceRole,
  tags: fleet.tags,
});

const reportGroupView = (rg: StoredReportGroup): Record<string, unknown> => ({
  arn: rg.arn,
  name: rg.name,
  type: rg.type,
  exportConfig: rg.exportConfig,
  created: rg.created,
  lastModified: rg.lastModified,
  tags: rg.tags,
  status: rg.status,
});

const reportView = (report: StoredReport): Record<string, unknown> => ({
  arn: report.arn,
  type: report.type,
  name: report.name,
  reportGroupArn: report.reportGroupArn,
  executionId: report.executionId,
  status: report.status,
  created: report.created,
  expired: report.expired,
  exportConfig: report.exportConfig,
  truncated: report.truncated,
  testSummary: report.testSummary,
  codeCoverageSummary: report.codeCoverageSummary,
});

const webhookView = (wh: StoredWebhook): Record<string, unknown> => ({
  url: wh.url,
  payloadUrl: wh.payloadUrl,
  secret: wh.secret,
  branchFilter: wh.branchFilter,
  filterGroups: wh.filterGroups,
  buildType: wh.buildType,
  manualCreation: wh.manualCreation,
  scopeConfiguration: wh.scopeConfiguration,
  status: wh.status,
  lastModifiedSecret: wh.lastModifiedSecret,
  pullRequestBuildPolicy: wh.pullRequestBuildPolicy,
});

const sandboxView = (sandbox: StoredSandbox): Record<string, unknown> => ({
  id: sandbox.id,
  arn: sandbox.arn,
  projectName: sandbox.projectName,
  requestTime: sandbox.requestTime,
  startTime: sandbox.startTime,
  endTime: sandbox.endTime,
  status: sandbox.status,
  source: sandbox.source,
  sourceVersion: sandbox.sourceVersion,
  secondarySources: sandbox.secondarySources,
  secondarySourceVersions: sandbox.secondarySourceVersions,
  environment: sandbox.environment,
  fileSystemLocations: sandbox.fileSystemLocations,
  timeoutInMinutes: sandbox.timeoutInMinutes,
  queuedTimeoutInMinutes: sandbox.queuedTimeoutInMinutes,
  vpcConfig: sandbox.vpcConfig,
  logConfig: sandbox.logConfig,
  encryptionKey: sandbox.encryptionKey,
  serviceRole: sandbox.serviceRole,
  currentSession: sandbox.currentSession,
});

const commandExecutionView = (
  ce: StoredCommandExecution,
): Record<string, unknown> => ({
  id: ce.id,
  sandboxId: ce.sandboxId,
  sandboxArn: ce.sandboxArn,
  submitTime: ce.submitTime,
  startTime: ce.startTime,
  endTime: ce.endTime,
  status: ce.status,
  command: ce.command,
  type: ce.type,
  exitCode: ce.exitCode,
  standardOutputContent: ce.standardOutputContent,
  standardErrContent: ce.standardErrContent,
  logs: ce.logs,
});

const buildProject = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
  name: string,
  existing: StoredProject | undefined,
): StoredProject => {
  const now = Date.now();
  return {
    name,
    arn: existing?.arn ?? projectArn(ctx, name),
    description:
      stringOrUndefined(input["description"]) ?? existing?.description,
    source: recordOrUndefined(input["source"]) ?? existing?.source,
    secondarySources:
      arrayOrUndefined(input["secondarySources"]) ?? existing?.secondarySources,
    sourceVersion:
      stringOrUndefined(input["sourceVersion"]) ?? existing?.sourceVersion,
    artifacts: recordOrUndefined(input["artifacts"]) ?? existing?.artifacts,
    cache: recordOrUndefined(input["cache"]) ?? existing?.cache,
    environment:
      recordOrUndefined(input["environment"]) ?? existing?.environment,
    serviceRole:
      stringOrUndefined(input["serviceRole"]) ?? existing?.serviceRole,
    timeoutInMinutes:
      numberOrUndefined(input["timeoutInMinutes"]) ??
      existing?.timeoutInMinutes ??
      60,
    queuedTimeoutInMinutes:
      numberOrUndefined(input["queuedTimeoutInMinutes"]) ??
      existing?.queuedTimeoutInMinutes ??
      480,
    encryptionKey:
      stringOrUndefined(input["encryptionKey"]) ?? existing?.encryptionKey,
    tags:
      input["tags"] === undefined
        ? (existing?.tags ?? [])
        : tagsFromInput(input["tags"]),
    created: existing?.created ?? now,
    lastModified: now,
    badge: { badgeEnabled: false },
    logsConfig: recordOrUndefined(input["logsConfig"]) ?? existing?.logsConfig,
    concurrentBuildLimit:
      numberOrUndefined(input["concurrentBuildLimit"]) ??
      existing?.concurrentBuildLimit,
    projectVisibility: existing?.projectVisibility ?? "PRIVATE",
  };
};

const CreateProject: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  if (recordOrUndefined(input["source"]) === undefined) {
    throw awsError("InvalidInputException", "source is required.", 400);
  }
  requireString(input, "serviceRole");
  if (ctx.store.get<StoredProject>(projectKey(name)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Project already exists: ${name}`,
      400,
    );
  }
  const project = buildProject(input, ctx, name, undefined);
  ctx.store.set(projectKey(name), project);
  return { project: projectView(project) };
};

const UpdateProject: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const existing = ctx.store.get<StoredProject>(projectKey(name));
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Project does not exist: ${name}`,
      400,
    );
  }
  const project = buildProject(input, ctx, name, existing);
  ctx.store.set(projectKey(name), project);
  return { project: projectView(project) };
};

const DeleteProject: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  ctx.store.delete(projectKey(name));
  return {};
};

const matchProject = (project: StoredProject, requested: string): boolean =>
  project.name === requested || project.arn === requested;

const BatchGetProjects: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["names"]);
  const found: Record<string, unknown>[] = [];
  const notFound: string[] = [];
  for (const requested of names) {
    const project = listProjects(ctx).find((entry) =>
      matchProject(entry, requested),
    );
    if (project === undefined) {
      notFound.push(requested);
    } else {
      found.push(projectView(project));
    }
  }
  return { projects: found, projectsNotFound: notFound };
};

const ListProjects: OperationHandler = (input, ctx) => {
  const order = stringOrUndefined(input["sortOrder"]) ?? "ASCENDING";
  const names = listProjects(ctx)
    .map((project) => project.name)
    .sort((left, right) =>
      order === "DESCENDING"
        ? right.localeCompare(left)
        : left.localeCompare(right),
    );
  return { projects: names };
};

const StartBuild: OperationHandler = (input, ctx) => {
  const projectName = requireString(input, "projectName");
  const project = ctx.store.get<StoredProject>(projectKey(projectName));
  if (project === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Project does not exist: ${projectName}`,
      400,
    );
  }
  const id = buildId(projectName);
  const existingCount = listBuilds(ctx).filter(
    (entry) => entry.projectName === projectName,
  ).length;
  const now = Date.now();
  const build: StoredBuild = {
    id,
    arn: buildArn(ctx, id),
    buildNumber: existingCount + 1,
    startTime: now,
    endTime: now,
    currentPhase: "COMPLETED",
    buildStatus: "SUCCEEDED",
    sourceVersion:
      stringOrUndefined(input["sourceVersion"]) ?? project.sourceVersion,
    resolvedSourceVersion: stringOrUndefined(input["sourceVersion"]),
    projectName,
    source: recordOrUndefined(input["sourceTypeOverride"]) ?? project.source,
    artifacts:
      recordOrUndefined(input["artifactsOverride"]) ?? project.artifacts,
    cache: recordOrUndefined(input["cacheOverride"]) ?? project.cache,
    environment: project.environment,
    serviceRole:
      stringOrUndefined(input["serviceRoleOverride"]) ?? project.serviceRole,
    timeoutInMinutes:
      numberOrUndefined(input["timeoutInMinutesOverride"]) ??
      project.timeoutInMinutes,
    queuedTimeoutInMinutes:
      numberOrUndefined(input["queuedTimeoutInMinutesOverride"]) ??
      project.queuedTimeoutInMinutes,
    buildComplete: true,
    initiator: "bunsai",
    encryptionKey:
      stringOrUndefined(input["encryptionKeyOverride"]) ??
      project.encryptionKey,
  };
  ctx.store.set(buildKey(id), build);
  return { build: buildView(build) };
};

const BatchGetBuilds: OperationHandler = (input, ctx) => {
  const ids = stringListFromInput(input["ids"]);
  const found: Record<string, unknown>[] = [];
  const notFound: string[] = [];
  for (const id of ids) {
    const build = ctx.store.get<StoredBuild>(buildKey(id));
    if (build === undefined) {
      notFound.push(id);
    } else {
      found.push(buildView(build));
    }
  }
  return { builds: found, buildsNotFound: notFound };
};

const BatchDeleteBuilds: OperationHandler = (input, ctx) => {
  const ids = stringListFromInput(input["ids"]);
  const deleted: string[] = [];
  const notDeleted: Record<string, unknown>[] = [];
  for (const id of ids) {
    const build = ctx.store.get<StoredBuild>(buildKey(id));
    if (build === undefined) {
      notDeleted.push({ id, statusCode: "ACCESS_DENIED" });
    } else {
      ctx.store.delete(buildKey(id));
      deleted.push(build.arn);
    }
  }
  return { buildsDeleted: deleted, buildsNotDeleted: notDeleted };
};

const StopBuild: OperationHandler = (input, ctx) => {
  const id = requireString(input, "id");
  const build = ctx.store.get<StoredBuild>(buildKey(id));
  if (build === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Build does not exist: ${id}`,
      400,
    );
  }
  const stopped: StoredBuild = {
    ...build,
    buildStatus: "STOPPED",
    currentPhase: "COMPLETED",
    buildComplete: true,
    endTime: Date.now(),
  };
  ctx.store.set(buildKey(id), stopped);
  return { build: buildView(stopped) };
};

const RetryBuild: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["id"]);
  if (id === undefined) {
    throw awsError("InvalidInputException", "id is required.", 400);
  }
  const existing = ctx.store.get<StoredBuild>(buildKey(id));
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Build does not exist: ${id}`,
      400,
    );
  }
  const newId = buildId(existing.projectName);
  const existingCount = listBuilds(ctx).filter(
    (entry) => entry.projectName === existing.projectName,
  ).length;
  const now = Date.now();
  const newBuild: StoredBuild = {
    ...existing,
    id: newId,
    arn: buildArn(ctx, newId),
    buildNumber: existingCount + 1,
    startTime: now,
    endTime: now,
    currentPhase: "COMPLETED",
    buildStatus: "SUCCEEDED",
    buildComplete: true,
  };
  ctx.store.set(buildKey(newId), newBuild);
  return { build: buildView(newBuild) };
};

const ListBuilds: OperationHandler = (input, ctx) => {
  const order = stringOrUndefined(input["sortOrder"]) ?? "ASCENDING";
  const ids = listBuilds(ctx)
    .map((b) => b.id)
    .sort((a, b) =>
      order === "DESCENDING" ? b.localeCompare(a) : a.localeCompare(b),
    );
  return { ids };
};

const ListBuildsForProject: OperationHandler = (input, ctx) => {
  const projectName = requireString(input, "projectName");
  const project = ctx.store.get<StoredProject>(projectKey(projectName));
  if (project === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Project does not exist: ${projectName}`,
      400,
    );
  }
  const order = stringOrUndefined(input["sortOrder"]) ?? "ASCENDING";
  const ids = listBuilds(ctx)
    .filter((b) => b.projectName === projectName)
    .map((b) => b.id)
    .sort((a, b) =>
      order === "DESCENDING" ? b.localeCompare(a) : a.localeCompare(b),
    );
  return { ids };
};

const InvalidateProjectCache: OperationHandler = (input, ctx) => {
  const projectName = requireString(input, "projectName");
  const project = ctx.store.get<StoredProject>(projectKey(projectName));
  if (project === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Project does not exist: ${projectName}`,
      400,
    );
  }
  return {};
};

const UpdateProjectVisibility: OperationHandler = (input, ctx) => {
  const projectArnInput = requireString(input, "projectArn");
  const projectVisibility = requireString(input, "projectVisibility");
  const project = listProjects(ctx).find((p) => p.arn === projectArnInput);
  if (project === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Project does not exist: ${projectArnInput}`,
      400,
    );
  }
  const updated: StoredProject = {
    ...project,
    projectVisibility,
    lastModified: Date.now(),
  };
  ctx.store.set(projectKey(project.name), updated);
  return {
    projectArn: updated.arn,
    publicProjectAlias: undefined,
    projectVisibility: updated.projectVisibility,
  };
};

const ListSharedProjects: OperationHandler = (_input, _ctx) => {
  return { projects: [], nextToken: undefined };
};

const StartBuildBatch: OperationHandler = (input, ctx) => {
  const projectName = requireString(input, "projectName");
  const project = ctx.store.get<StoredProject>(projectKey(projectName));
  if (project === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Project does not exist: ${projectName}`,
      400,
    );
  }
  const id = buildBatchId(projectName);
  const existingCount = listBuildBatches(ctx).filter(
    (entry) => entry.projectName === projectName,
  ).length;
  const now = Date.now();
  const batch: StoredBuildBatch = {
    id,
    arn: buildBatchArn(ctx, id),
    startTime: now,
    endTime: now,
    currentPhase: "SUCCEEDED",
    buildBatchStatus: "SUCCEEDED",
    projectName,
    sourceVersion:
      stringOrUndefined(input["sourceVersion"]) ?? project.sourceVersion,
    resolvedSourceVersion: stringOrUndefined(input["sourceVersion"]),
    source: recordOrUndefined(input["sourceTypeOverride"]) ?? project.source,
    artifacts:
      recordOrUndefined(input["artifactsOverride"]) ?? project.artifacts,
    cache: recordOrUndefined(input["cacheOverride"]) ?? project.cache,
    environment: project.environment,
    serviceRole:
      stringOrUndefined(input["serviceRoleOverride"]) ?? project.serviceRole,
    buildTimeoutInMinutes:
      numberOrUndefined(input["buildTimeoutInMinutesOverride"]) ??
      project.timeoutInMinutes,
    queuedTimeoutInMinutes:
      numberOrUndefined(input["queuedTimeoutInMinutesOverride"]) ??
      project.queuedTimeoutInMinutes,
    complete: true,
    initiator: "bunsai",
    encryptionKey:
      stringOrUndefined(input["encryptionKeyOverride"]) ??
      project.encryptionKey,
    buildBatchNumber: existingCount + 1,
    buildGroups: [],
  };
  ctx.store.set(buildBatchKey(id), batch);
  return { buildBatch: buildBatchView(batch) };
};

const BatchGetBuildBatches: OperationHandler = (input, ctx) => {
  const ids = stringListFromInput(input["ids"]);
  const found: Record<string, unknown>[] = [];
  const notFound: string[] = [];
  for (const id of ids) {
    const batch = ctx.store.get<StoredBuildBatch>(buildBatchKey(id));
    if (batch === undefined) {
      notFound.push(id);
    } else {
      found.push(buildBatchView(batch));
    }
  }
  return { buildBatches: found, buildBatchesNotFound: notFound };
};

const DeleteBuildBatch: OperationHandler = (input, ctx) => {
  const id = requireString(input, "id");
  const batch = ctx.store.get<StoredBuildBatch>(buildBatchKey(id));
  if (batch === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Build batch does not exist: ${id}`,
      400,
    );
  }
  ctx.store.delete(buildBatchKey(id));
  return {
    statusCode: "SUCCEEDED",
    buildsDeleted: [],
    buildsNotDeleted: [],
  };
};

const RetryBuildBatch: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["id"]);
  if (id === undefined) {
    throw awsError("InvalidInputException", "id is required.", 400);
  }
  const existing = ctx.store.get<StoredBuildBatch>(buildBatchKey(id));
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Build batch does not exist: ${id}`,
      400,
    );
  }
  const newId = buildBatchId(existing.projectName);
  const existingCount = listBuildBatches(ctx).filter(
    (entry) => entry.projectName === existing.projectName,
  ).length;
  const now = Date.now();
  const newBatch: StoredBuildBatch = {
    ...existing,
    id: newId,
    arn: buildBatchArn(ctx, newId),
    buildBatchNumber: existingCount + 1,
    startTime: now,
    endTime: now,
    currentPhase: "SUCCEEDED",
    buildBatchStatus: "SUCCEEDED",
    complete: true,
  };
  ctx.store.set(buildBatchKey(newId), newBatch);
  return { buildBatch: buildBatchView(newBatch) };
};

const StopBuildBatch: OperationHandler = (input, ctx) => {
  const id = requireString(input, "id");
  const batch = ctx.store.get<StoredBuildBatch>(buildBatchKey(id));
  if (batch === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Build batch does not exist: ${id}`,
      400,
    );
  }
  const stopped: StoredBuildBatch = {
    ...batch,
    buildBatchStatus: "STOPPED",
    currentPhase: "SUCCEEDED",
    complete: true,
    endTime: Date.now(),
  };
  ctx.store.set(buildBatchKey(id), stopped);
  return { buildBatch: buildBatchView(stopped) };
};

const ListBuildBatches: OperationHandler = (_input, ctx) => {
  const ids = listBuildBatches(ctx).map((b) => b.id);
  return { ids, nextToken: undefined };
};

const ListBuildBatchesForProject: OperationHandler = (input, ctx) => {
  const projectName = stringOrUndefined(input["projectName"]);
  if (projectName !== undefined) {
    const project = ctx.store.get<StoredProject>(projectKey(projectName));
    if (project === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `Project does not exist: ${projectName}`,
        400,
      );
    }
  }
  const ids = listBuildBatches(ctx)
    .filter((b) =>
      projectName === undefined ? true : b.projectName === projectName,
    )
    .map((b) => b.id);
  return { ids, nextToken: undefined };
};

const CreateFleet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const baseCapacity = input["baseCapacity"];
  if (typeof baseCapacity !== "number") {
    throw awsError("InvalidInputException", "baseCapacity is required.", 400);
  }
  const environmentType = requireString(input, "environmentType");
  const computeType = requireString(input, "computeType");
  const arn = makeFleetArn(ctx, name);
  const existing = ctx.store.get<StoredFleet>(fleetKey(arn));
  if (existing !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Fleet already exists: ${name}`,
      400,
    );
  }
  const now = Date.now();
  const fleet: StoredFleet = {
    arn,
    name,
    id: crypto.randomUUID(),
    created: now,
    lastModified: now,
    status: { statusCode: "ACTIVE" },
    baseCapacity,
    environmentType,
    computeType,
    computeConfiguration: recordOrUndefined(input["computeConfiguration"]),
    scalingConfiguration: recordOrUndefined(input["scalingConfiguration"]),
    overflowBehavior: stringOrUndefined(input["overflowBehavior"]),
    vpcConfig: recordOrUndefined(input["vpcConfig"]),
    proxyConfiguration: recordOrUndefined(input["proxyConfiguration"]),
    imageId: stringOrUndefined(input["imageId"]),
    fleetServiceRole: stringOrUndefined(input["fleetServiceRole"]),
    tags: tagsFromInput(input["tags"]),
  };
  ctx.store.set(fleetKey(arn), fleet);
  return { fleet: fleetView(fleet) };
};

const BatchGetFleets: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["names"]);
  const found: Record<string, unknown>[] = [];
  const notFound: string[] = [];
  for (const requested of names) {
    const fleet = listFleets(ctx).find(
      (f) => f.name === requested || f.arn === requested,
    );
    if (fleet === undefined) {
      notFound.push(requested);
    } else {
      found.push(fleetView(fleet));
    }
  }
  return { fleets: found, fleetsNotFound: notFound };
};

const DeleteFleet: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const fleet = listFleets(ctx).find((f) => f.arn === arn || f.name === arn);
  if (fleet === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Fleet does not exist: ${arn}`,
      400,
    );
  }
  ctx.store.delete(fleetKey(fleet.arn));
  return {};
};

const UpdateFleet: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const existing = listFleets(ctx).find((f) => f.arn === arn || f.name === arn);
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Fleet does not exist: ${arn}`,
      400,
    );
  }
  const now = Date.now();
  const updated: StoredFleet = {
    ...existing,
    lastModified: now,
    baseCapacity:
      numberOrUndefined(input["baseCapacity"]) ?? existing.baseCapacity,
    environmentType:
      stringOrUndefined(input["environmentType"]) ?? existing.environmentType,
    computeType:
      stringOrUndefined(input["computeType"]) ?? existing.computeType,
    computeConfiguration:
      recordOrUndefined(input["computeConfiguration"]) ??
      existing.computeConfiguration,
    scalingConfiguration:
      recordOrUndefined(input["scalingConfiguration"]) ??
      existing.scalingConfiguration,
    overflowBehavior:
      stringOrUndefined(input["overflowBehavior"]) ?? existing.overflowBehavior,
    vpcConfig: recordOrUndefined(input["vpcConfig"]) ?? existing.vpcConfig,
    proxyConfiguration:
      recordOrUndefined(input["proxyConfiguration"]) ??
      existing.proxyConfiguration,
    imageId: stringOrUndefined(input["imageId"]) ?? existing.imageId,
    fleetServiceRole:
      stringOrUndefined(input["fleetServiceRole"]) ?? existing.fleetServiceRole,
    tags:
      input["tags"] === undefined
        ? existing.tags
        : tagsFromInput(input["tags"]),
  };
  ctx.store.set(fleetKey(existing.arn), updated);
  return { fleet: fleetView(updated) };
};

const ListFleets: OperationHandler = (_input, ctx) => {
  const fleetArns = listFleets(ctx).map((f) => f.arn);
  return { fleets: fleetArns, nextToken: undefined };
};

const CreateReportGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const type = requireString(input, "type");
  const exportConfig = recordOrUndefined(input["exportConfig"]);
  if (exportConfig === undefined) {
    throw awsError("InvalidInputException", "exportConfig is required.", 400);
  }
  const arn = makeReportGroupArn(ctx, name);
  const existing = ctx.store.get<StoredReportGroup>(reportGroupKey(arn));
  if (existing !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Report group already exists: ${name}`,
      400,
    );
  }
  const now = Date.now();
  const rg: StoredReportGroup = {
    arn,
    name,
    type,
    exportConfig,
    created: now,
    lastModified: now,
    tags: tagsFromInput(input["tags"]),
    status: "ACTIVE",
  };
  ctx.store.set(reportGroupKey(arn), rg);
  return { reportGroup: reportGroupView(rg) };
};

const BatchGetReportGroups: OperationHandler = (input, ctx) => {
  const arns = stringListFromInput(input["reportGroupArns"]);
  const found: Record<string, unknown>[] = [];
  const notFound: string[] = [];
  for (const arn of arns) {
    const rg = ctx.store.get<StoredReportGroup>(reportGroupKey(arn));
    if (rg === undefined) {
      notFound.push(arn);
    } else {
      found.push(reportGroupView(rg));
    }
  }
  return { reportGroups: found, reportGroupsNotFound: notFound };
};

const DeleteReportGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const rg = ctx.store.get<StoredReportGroup>(reportGroupKey(arn));
  if (rg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Report group does not exist: ${arn}`,
      400,
    );
  }
  const deleteReports = input["deleteReports"] === true;
  if (deleteReports) {
    for (const report of listReports(ctx).filter(
      (r) => r.reportGroupArn === arn,
    )) {
      ctx.store.delete(reportKey(report.arn));
    }
  }
  ctx.store.delete(reportGroupKey(arn));
  return {};
};

const UpdateReportGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const existing = ctx.store.get<StoredReportGroup>(reportGroupKey(arn));
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Report group does not exist: ${arn}`,
      400,
    );
  }
  const now = Date.now();
  const updated: StoredReportGroup = {
    ...existing,
    lastModified: now,
    exportConfig:
      recordOrUndefined(input["exportConfig"]) ?? existing.exportConfig,
    tags:
      input["tags"] === undefined
        ? existing.tags
        : tagsFromInput(input["tags"]),
  };
  ctx.store.set(reportGroupKey(arn), updated);
  return { reportGroup: reportGroupView(updated) };
};

const ListReportGroups: OperationHandler = (_input, ctx) => {
  const reportGroupArns = listReportGroups(ctx).map((rg) => rg.arn);
  return { reportGroups: reportGroupArns, nextToken: undefined };
};

const ListSharedReportGroups: OperationHandler = (_input, _ctx) => {
  return { reportGroups: [], nextToken: undefined };
};

const GetReportGroupTrend: OperationHandler = (input, ctx) => {
  const reportGroupArn = requireString(input, "reportGroupArn");
  const rg = ctx.store.get<StoredReportGroup>(reportGroupKey(reportGroupArn));
  if (rg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Report group does not exist: ${reportGroupArn}`,
      400,
    );
  }
  return {
    stats: { average: "0", max: "0", min: "0" },
    rawData: [],
  };
};

const BatchGetReports: OperationHandler = (input, ctx) => {
  const arns = stringListFromInput(input["reportArns"]);
  const found: Record<string, unknown>[] = [];
  const notFound: string[] = [];
  for (const arn of arns) {
    const report = ctx.store.get<StoredReport>(reportKey(arn));
    if (report === undefined) {
      notFound.push(arn);
    } else {
      found.push(reportView(report));
    }
  }
  return { reports: found, reportsNotFound: notFound };
};

const DeleteReport: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  ctx.store.delete(reportKey(arn));
  return {};
};

const ListReports: OperationHandler = (_input, ctx) => {
  const reportArns = listReports(ctx).map((r) => r.arn);
  return { reports: reportArns, nextToken: undefined };
};

const ListReportsForReportGroup: OperationHandler = (input, ctx) => {
  const reportGroupArn = requireString(input, "reportGroupArn");
  const rg = ctx.store.get<StoredReportGroup>(reportGroupKey(reportGroupArn));
  if (rg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Report group does not exist: ${reportGroupArn}`,
      400,
    );
  }
  const reportArns = listReports(ctx)
    .filter((r) => r.reportGroupArn === reportGroupArn)
    .map((r) => r.arn);
  return { reports: reportArns, nextToken: undefined };
};

const DescribeCodeCoverages: OperationHandler = (input, ctx) => {
  const reportArn = requireString(input, "reportArn");
  const report = ctx.store.get<StoredReport>(reportKey(reportArn));
  if (report === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Report does not exist: ${reportArn}`,
      400,
    );
  }
  return { codeCoverages: [], nextToken: undefined };
};

const DescribeTestCases: OperationHandler = (input, ctx) => {
  const reportArn = requireString(input, "reportArn");
  const report = ctx.store.get<StoredReport>(reportKey(reportArn));
  if (report === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Report does not exist: ${reportArn}`,
      400,
    );
  }
  return { testCases: [], nextToken: undefined };
};

const CreateWebhook: OperationHandler = (input, ctx) => {
  const projectName = requireString(input, "projectName");
  const project = ctx.store.get<StoredProject>(projectKey(projectName));
  if (project === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Project does not exist: ${projectName}`,
      400,
    );
  }
  const existing = ctx.store.get<StoredWebhook>(webhookKey(projectName));
  if (existing !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Webhook already exists for project: ${projectName}`,
      400,
    );
  }
  const wh: StoredWebhook = {
    projectName,
    url: `https://codebuild.${ctx.region}.amazonaws.com/webhooks/${projectName}`,
    payloadUrl: `https://codebuild.${ctx.region}.amazonaws.com/webhooks/${projectName}/payload`,
    secret: crypto.randomUUID(),
    branchFilter: stringOrUndefined(input["branchFilter"]),
    filterGroups: arrayOrUndefined(input["filterGroups"]) ?? [],
    buildType: stringOrUndefined(input["buildType"]),
    manualCreation:
      typeof input["manualCreation"] === "boolean"
        ? input["manualCreation"]
        : undefined,
    scopeConfiguration: recordOrUndefined(input["scopeConfiguration"]),
    status: "ACTIVE",
    lastModifiedSecret: Date.now(),
    pullRequestBuildPolicy: stringOrUndefined(input["pullRequestBuildPolicy"]),
  };
  ctx.store.set(webhookKey(projectName), wh);
  return { webhook: webhookView(wh) };
};

const UpdateWebhook: OperationHandler = (input, ctx) => {
  const projectName = requireString(input, "projectName");
  const existing = ctx.store.get<StoredWebhook>(webhookKey(projectName));
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Webhook does not exist for project: ${projectName}`,
      400,
    );
  }
  const updated: StoredWebhook = {
    ...existing,
    branchFilter:
      stringOrUndefined(input["branchFilter"]) ?? existing.branchFilter,
    filterGroups:
      arrayOrUndefined(input["filterGroups"]) ?? existing.filterGroups,
    buildType: stringOrUndefined(input["buildType"]) ?? existing.buildType,
    lastModifiedSecret: Date.now(),
    pullRequestBuildPolicy:
      stringOrUndefined(input["pullRequestBuildPolicy"]) ??
      existing.pullRequestBuildPolicy,
  };
  ctx.store.set(webhookKey(projectName), updated);
  return { webhook: webhookView(updated) };
};

const DeleteWebhook: OperationHandler = (input, ctx) => {
  const projectName = requireString(input, "projectName");
  ctx.store.delete(webhookKey(projectName));
  return {};
};

const StartSandbox: OperationHandler = (input, ctx) => {
  const projectName = stringOrUndefined(input["projectName"]);
  if (projectName !== undefined) {
    const project = ctx.store.get<StoredProject>(projectKey(projectName));
    if (project === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `Project does not exist: ${projectName}`,
        400,
      );
    }
  }
  const id = `bunsai-sandbox-${crypto.randomUUID()}`;
  const now = Date.now();
  const sandbox: StoredSandbox = {
    id,
    arn: makeSandboxArn(ctx, id),
    projectName,
    requestTime: now,
    startTime: now,
    endTime: now,
    status: { statusCode: "READY" },
    source: projectName
      ? ctx.store.get<StoredProject>(projectKey(projectName))?.source
      : undefined,
    sourceVersion: undefined,
    secondarySources: undefined,
    secondarySourceVersions: undefined,
    environment: projectName
      ? ctx.store.get<StoredProject>(projectKey(projectName))?.environment
      : undefined,
    fileSystemLocations: undefined,
    timeoutInMinutes: 60,
    queuedTimeoutInMinutes: 480,
    vpcConfig: undefined,
    logConfig: undefined,
    encryptionKey: undefined,
    serviceRole: projectName
      ? ctx.store.get<StoredProject>(projectKey(projectName))?.serviceRole
      : undefined,
    currentSession: undefined,
  };
  ctx.store.set(sandboxKey(id), sandbox);
  return { sandbox: sandboxView(sandbox) };
};

const BatchGetSandboxes: OperationHandler = (input, ctx) => {
  const ids = stringListFromInput(input["ids"]);
  const found: Record<string, unknown>[] = [];
  const notFound: string[] = [];
  for (const id of ids) {
    const sandbox = ctx.store.get<StoredSandbox>(sandboxKey(id));
    if (sandbox === undefined) {
      notFound.push(id);
    } else {
      found.push(sandboxView(sandbox));
    }
  }
  return { sandboxes: found, sandboxesNotFound: notFound };
};

const StopSandbox: OperationHandler = (input, ctx) => {
  const id = requireString(input, "id");
  const sandbox = ctx.store.get<StoredSandbox>(sandboxKey(id));
  if (sandbox === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Sandbox does not exist: ${id}`,
      400,
    );
  }
  const stopped: StoredSandbox = {
    ...sandbox,
    status: { statusCode: "STOPPED" },
    endTime: Date.now(),
  };
  ctx.store.set(sandboxKey(id), stopped);
  return { sandbox: sandboxView(stopped) };
};

const ListSandboxes: OperationHandler = (_input, ctx) => {
  const ids = listSandboxes(ctx).map((s) => s.id);
  return { ids, nextToken: undefined };
};

const ListSandboxesForProject: OperationHandler = (input, ctx) => {
  const projectName = requireString(input, "projectName");
  const project = ctx.store.get<StoredProject>(projectKey(projectName));
  if (project === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Project does not exist: ${projectName}`,
      400,
    );
  }
  const ids = listSandboxes(ctx)
    .filter((s) => s.projectName === projectName)
    .map((s) => s.id);
  return { ids, nextToken: undefined };
};

const StartSandboxConnection: OperationHandler = (input, ctx) => {
  const sandboxId = requireString(input, "sandboxId");
  const sandbox = ctx.store.get<StoredSandbox>(sandboxKey(sandboxId));
  if (sandbox === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Sandbox does not exist: ${sandboxId}`,
      400,
    );
  }
  return {
    ssmSession: {
      sessionId: `bunsai-ssm-session-${crypto.randomUUID()}`,
      tokenValue: crypto.randomUUID(),
      streamUrl: `wss://ssm.${ctx.region}.amazonaws.com/session/${sandboxId}`,
    },
  };
};

const StartCommandExecution: OperationHandler = (input, ctx) => {
  const sandboxId = requireString(input, "sandboxId");
  const sandbox = ctx.store.get<StoredSandbox>(sandboxKey(sandboxId));
  if (sandbox === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Sandbox does not exist: ${sandboxId}`,
      400,
    );
  }
  const command = requireString(input, "command");
  const id = crypto.randomUUID();
  const now = Date.now();
  const ce: StoredCommandExecution = {
    id,
    sandboxId,
    sandboxArn: sandbox.arn,
    submitTime: now,
    startTime: now,
    endTime: now,
    status: "SUCCEEDED",
    command,
    type: stringOrUndefined(input["type"]),
    exitCode: "0",
    standardOutputContent: "",
    standardErrContent: "",
    logs: undefined,
  };
  ctx.store.set(commandExecutionKey(sandboxId, id), ce);
  return { commandExecution: commandExecutionView(ce) };
};

const BatchGetCommandExecutions: OperationHandler = (input, ctx) => {
  const sandboxId = requireString(input, "sandboxId");
  const ids = stringListFromInput(input["commandExecutionIds"]);
  const found: Record<string, unknown>[] = [];
  const notFound: string[] = [];
  for (const id of ids) {
    const ce = ctx.store.get<StoredCommandExecution>(
      commandExecutionKey(sandboxId, id),
    );
    if (ce === undefined) {
      notFound.push(id);
    } else {
      found.push(commandExecutionView(ce));
    }
  }
  return { commandExecutions: found, commandExecutionsNotFound: notFound };
};

const ListCommandExecutionsForSandbox: OperationHandler = (input, ctx) => {
  const sandboxId = requireString(input, "sandboxId");
  const sandbox = ctx.store.get<StoredSandbox>(sandboxKey(sandboxId));
  if (sandbox === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Sandbox does not exist: ${sandboxId}`,
      400,
    );
  }
  const ces = listCommandExecutions(ctx)
    .filter((ce) => ce.sandboxId === sandboxId)
    .map((ce) => commandExecutionView(ce));
  return { commandExecutions: ces, nextToken: undefined };
};

const ImportSourceCredentials: OperationHandler = (input, ctx) => {
  const serverType = requireString(input, "serverType");
  const authType = requireString(input, "authType");
  requireString(input, "token");
  const arn = makeSourceCredentialsArn(ctx, serverType);
  const creds: StoredSourceCredentials = {
    arn,
    serverType,
    authType,
    resource: stringOrUndefined(input["username"]),
  };
  ctx.store.set(sourceCredentialsKey(arn), creds);
  return { arn };
};

const ListSourceCredentials: OperationHandler = (_input, ctx) => {
  const infos = listSourceCredentials(ctx).map((sc) => ({
    arn: sc.arn,
    serverType: sc.serverType,
    authType: sc.authType,
    resource: sc.resource,
  }));
  return { sourceCredentialsInfos: infos };
};

const DeleteSourceCredentials: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const existing = ctx.store.get<StoredSourceCredentials>(
    sourceCredentialsKey(arn),
  );
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Source credentials do not exist: ${arn}`,
      400,
    );
  }
  ctx.store.delete(sourceCredentialsKey(arn));
  return { arn };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const policy = requireString(input, "policy");
  const resourceArn = requireString(input, "resourceArn");
  const rp: StoredResourcePolicy = { resourceArn, policy };
  ctx.store.set(resourcePolicyKey(resourceArn), rp);
  return { resourceArn };
};

const GetResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const rp = ctx.store.get<StoredResourcePolicy>(
    resourcePolicyKey(resourceArn),
  );
  if (rp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource policy does not exist: ${resourceArn}`,
      400,
    );
  }
  return { policy: rp.policy };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  ctx.store.delete(resourcePolicyKey(resourceArn));
  return {};
};

const ListCuratedEnvironmentImages: OperationHandler = (_input, _ctx) => {
  return {
    platforms: [
      {
        platform: "AMAZON_LINUX_2",
        languages: [
          {
            language: "PYTHON",
            images: [
              {
                name: "aws/codebuild/amazonlinux2-x86_64-standard:5.0",
                description: "Amazon Linux 2, Python 3.11",
                versions: ["aws/codebuild/amazonlinux2-x86_64-standard:5.0"],
              },
            ],
          },
        ],
      },
    ],
  };
};

const codebuild = {
  name: "codebuild",
  protocol: "json",
  operations: {
    BatchDeleteBuilds,
    BatchGetBuildBatches,
    BatchGetBuilds,
    BatchGetCommandExecutions,
    BatchGetFleets,
    BatchGetProjects,
    BatchGetReportGroups,
    BatchGetReports,
    BatchGetSandboxes,
    CreateFleet,
    CreateProject,
    CreateReportGroup,
    CreateWebhook,
    DeleteBuildBatch,
    DeleteFleet,
    DeleteProject,
    DeleteReport,
    DeleteReportGroup,
    DeleteResourcePolicy,
    DeleteSourceCredentials,
    DeleteWebhook,
    DescribeCodeCoverages,
    DescribeTestCases,
    GetReportGroupTrend,
    GetResourcePolicy,
    ImportSourceCredentials,
    InvalidateProjectCache,
    ListBuildBatches,
    ListBuildBatchesForProject,
    ListBuilds,
    ListBuildsForProject,
    ListCommandExecutionsForSandbox,
    ListCuratedEnvironmentImages,
    ListFleets,
    ListProjects,
    ListReportGroups,
    ListReports,
    ListReportsForReportGroup,
    ListSandboxes,
    ListSandboxesForProject,
    ListSharedProjects,
    ListSharedReportGroups,
    ListSourceCredentials,
    PutResourcePolicy,
    RetryBuild,
    RetryBuildBatch,
    StartBuild,
    StartBuildBatch,
    StartCommandExecution,
    StartSandbox,
    StartSandboxConnection,
    StopBuild,
    StopBuildBatch,
    StopSandbox,
    UpdateFleet,
    UpdateProject,
    UpdateProjectVisibility,
    UpdateReportGroup,
    UpdateWebhook,
  },
  model,
} as const satisfies ServiceDefinition;

export default codebuild;
