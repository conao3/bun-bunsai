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

const projectKey = (name: string): string => `project/${name}`;

const buildKey = (id: string): string => `build/${id}`;

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

const codebuild = {
  name: "codebuild",
  protocol: "json",
  operations: {
    CreateProject,
    BatchGetProjects,
    ListProjects,
    UpdateProject,
    DeleteProject,
    StartBuild,
    BatchGetBuilds,
  },
  model,
} as const satisfies ServiceDefinition;

export default codebuild;
