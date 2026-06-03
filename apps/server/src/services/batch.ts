import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import batchModel from "../../../../test/vendor/aws-models/batch.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(batchModel);

type StoredComputeEnvironment = {
  computeEnvironmentName: string;
  computeEnvironmentArn: string;
  ecsClusterArn: string;
  type: string;
  state: string;
  status: string;
  statusReason: string;
  serviceRole: string | undefined;
  computeResources: Record<string, unknown> | undefined;
  tags: Record<string, string>;
  uuid: string;
  containerOrchestrationType: string;
};

type StoredJobQueue = {
  jobQueueName: string;
  jobQueueArn: string;
  state: string;
  status: string;
  statusReason: string;
  priority: number;
  schedulingPolicyArn: string | undefined;
  computeEnvironmentOrder: unknown[];
  jobQueueType: string | undefined;
  tags: Record<string, string>;
};

type StoredJobDefinition = {
  jobDefinitionName: string;
  jobDefinitionArn: string;
  revision: number;
  status: string;
  type: string;
  schedulingPriority: number | undefined;
  parameters: Record<string, unknown> | undefined;
  retryStrategy: Record<string, unknown> | undefined;
  containerProperties: Record<string, unknown> | undefined;
  nodeProperties: Record<string, unknown> | undefined;
  timeout: Record<string, unknown> | undefined;
  propagateTags: boolean | undefined;
  platformCapabilities: unknown[] | undefined;
  tags: Record<string, string>;
};

type StoredJob = {
  jobArn: string;
  jobName: string;
  jobId: string;
  jobQueue: string;
  status: string;
  jobDefinition: string;
  createdAt: number;
  startedAt: number;
  parameters: Record<string, unknown> | undefined;
  container: Record<string, unknown>;
  tags: Record<string, string>;
};

const computeEnvironmentKey = (name: string): string => `ce/${name}`;

const jobQueueKey = (name: string): string => `jq/${name}`;

const jobDefinitionKey = (name: string, revision: number): string =>
  `jd/${name}:${revision}`;

const jobKey = (id: string): string => `job/${id}`;

const uuid = (): string => crypto.randomUUID();

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ClientException", `${key} is required.`, 400);
  }
  return value;
};

const requireNumber = (input: Record<string, unknown>, key: string): number => {
  const value = input[key];
  if (typeof value !== "number") {
    throw awsError("ClientException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const tagsFromInput = (value: unknown): Record<string, string> => {
  const tags: Record<string, string> = {};
  const record = recordOrUndefined(value);
  if (record === undefined) return tags;
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === "string") tags[key] = raw;
  }
  return tags;
};

const stringListFromInput = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
};

const computeEnvironmentView = (
  computeEnvironment: StoredComputeEnvironment,
): Record<string, unknown> => ({
  computeEnvironmentName: computeEnvironment.computeEnvironmentName,
  computeEnvironmentArn: computeEnvironment.computeEnvironmentArn,
  ecsClusterArn: computeEnvironment.ecsClusterArn,
  type: computeEnvironment.type,
  state: computeEnvironment.state,
  status: computeEnvironment.status,
  statusReason: computeEnvironment.statusReason,
  serviceRole: computeEnvironment.serviceRole,
  computeResources: computeEnvironment.computeResources,
  tags: computeEnvironment.tags,
  uuid: computeEnvironment.uuid,
  containerOrchestrationType: computeEnvironment.containerOrchestrationType,
});

const jobQueueView = (jobQueue: StoredJobQueue): Record<string, unknown> => ({
  jobQueueName: jobQueue.jobQueueName,
  jobQueueArn: jobQueue.jobQueueArn,
  state: jobQueue.state,
  status: jobQueue.status,
  statusReason: jobQueue.statusReason,
  priority: jobQueue.priority,
  schedulingPolicyArn: jobQueue.schedulingPolicyArn,
  computeEnvironmentOrder: jobQueue.computeEnvironmentOrder,
  jobQueueType: jobQueue.jobQueueType,
  tags: jobQueue.tags,
});

const jobDefinitionView = (
  jobDefinition: StoredJobDefinition,
): Record<string, unknown> => ({
  jobDefinitionName: jobDefinition.jobDefinitionName,
  jobDefinitionArn: jobDefinition.jobDefinitionArn,
  revision: jobDefinition.revision,
  status: jobDefinition.status,
  type: jobDefinition.type,
  schedulingPriority: jobDefinition.schedulingPriority,
  parameters: jobDefinition.parameters,
  retryStrategy: jobDefinition.retryStrategy,
  containerProperties: jobDefinition.containerProperties,
  nodeProperties: jobDefinition.nodeProperties,
  timeout: jobDefinition.timeout,
  propagateTags: jobDefinition.propagateTags,
  platformCapabilities: jobDefinition.platformCapabilities,
  tags: jobDefinition.tags,
});

const jobView = (job: StoredJob): Record<string, unknown> => ({
  jobArn: job.jobArn,
  jobName: job.jobName,
  jobId: job.jobId,
  jobQueue: job.jobQueue,
  status: job.status,
  jobDefinition: job.jobDefinition,
  createdAt: job.createdAt,
  startedAt: job.startedAt,
  parameters: job.parameters,
  container: job.container,
  tags: job.tags,
});

const jobSummaryView = (job: StoredJob): Record<string, unknown> => ({
  jobArn: job.jobArn,
  jobId: job.jobId,
  jobName: job.jobName,
  status: job.status,
  jobDefinition: job.jobDefinition,
  createdAt: job.createdAt,
  startedAt: job.startedAt,
  container: job.container,
});

const listComputeEnvironments = (
  ctx: ServiceContext,
): StoredComputeEnvironment[] =>
  ctx.store
    .list<StoredComputeEnvironment>()
    .filter((entry) => entry.key.startsWith("ce/"))
    .map((entry) => entry.value);

const listJobQueues = (ctx: ServiceContext): StoredJobQueue[] =>
  ctx.store
    .list<StoredJobQueue>()
    .filter((entry) => entry.key.startsWith("jq/"))
    .map((entry) => entry.value);

const listJobDefinitions = (ctx: ServiceContext): StoredJobDefinition[] =>
  ctx.store
    .list<StoredJobDefinition>()
    .filter((entry) => entry.key.startsWith("jd/"))
    .map((entry) => entry.value);

const listJobs = (ctx: ServiceContext): StoredJob[] =>
  ctx.store
    .list<StoredJob>()
    .filter((entry) => entry.key.startsWith("job/"))
    .map((entry) => entry.value);

const CreateComputeEnvironment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "computeEnvironmentName");
  const type = requireString(input, "type");
  const computeEnvironmentArn = `arn:aws:batch:${ctx.region}:${ctx.account}:compute-environment/${name}`;
  const computeEnvironment: StoredComputeEnvironment = {
    computeEnvironmentName: name,
    computeEnvironmentArn,
    ecsClusterArn: `arn:aws:ecs:${ctx.region}:${ctx.account}:cluster/${name}_Batch_${uuid()}`,
    type,
    state: stringOrUndefined(input["state"]) ?? "ENABLED",
    status: "VALID",
    statusReason: "ComputeEnvironment Healthy",
    serviceRole: stringOrUndefined(input["serviceRole"]),
    computeResources: recordOrUndefined(input["computeResources"]),
    tags: tagsFromInput(input["tags"]),
    uuid: uuid(),
    containerOrchestrationType: "ECS",
  };
  ctx.store.set(computeEnvironmentKey(name), computeEnvironment);
  return {
    computeEnvironmentName: name,
    computeEnvironmentArn,
  };
};

const DescribeComputeEnvironments: OperationHandler = (input, ctx) => {
  const requested = stringListFromInput(input["computeEnvironments"]);
  const matches = (computeEnvironment: StoredComputeEnvironment): boolean =>
    requested.length === 0 ||
    requested.includes(computeEnvironment.computeEnvironmentName) ||
    requested.includes(computeEnvironment.computeEnvironmentArn);
  return {
    computeEnvironments: listComputeEnvironments(ctx)
      .filter(matches)
      .map(computeEnvironmentView),
  };
};

const CreateJobQueue: OperationHandler = (input, ctx) => {
  const name = requireString(input, "jobQueueName");
  const priority = requireNumber(input, "priority");
  const jobQueueArn = `arn:aws:batch:${ctx.region}:${ctx.account}:job-queue/${name}`;
  const jobQueue: StoredJobQueue = {
    jobQueueName: name,
    jobQueueArn,
    state: stringOrUndefined(input["state"]) ?? "ENABLED",
    status: "VALID",
    statusReason: "JobQueue Healthy",
    priority,
    schedulingPolicyArn: stringOrUndefined(input["schedulingPolicyArn"]),
    computeEnvironmentOrder: Array.isArray(input["computeEnvironmentOrder"])
      ? (input["computeEnvironmentOrder"] as unknown[])
      : [],
    jobQueueType: stringOrUndefined(input["jobQueueType"]),
    tags: tagsFromInput(input["tags"]),
  };
  ctx.store.set(jobQueueKey(name), jobQueue);
  return {
    jobQueueName: name,
    jobQueueArn,
  };
};

const DescribeJobQueues: OperationHandler = (input, ctx) => {
  const requested = stringListFromInput(input["jobQueues"]);
  const matches = (jobQueue: StoredJobQueue): boolean =>
    requested.length === 0 ||
    requested.includes(jobQueue.jobQueueName) ||
    requested.includes(jobQueue.jobQueueArn);
  return {
    jobQueues: listJobQueues(ctx).filter(matches).map(jobQueueView),
  };
};

const RegisterJobDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "jobDefinitionName");
  const type = requireString(input, "type");
  const existing = listJobDefinitions(ctx).filter(
    (jobDefinition) => jobDefinition.jobDefinitionName === name,
  );
  const revision =
    existing.reduce(
      (max, jobDefinition) => Math.max(max, jobDefinition.revision),
      0,
    ) + 1;
  const jobDefinitionArn = `arn:aws:batch:${ctx.region}:${ctx.account}:job-definition/${name}:${revision}`;
  const jobDefinition: StoredJobDefinition = {
    jobDefinitionName: name,
    jobDefinitionArn,
    revision,
    status: "ACTIVE",
    type,
    schedulingPriority:
      typeof input["schedulingPriority"] === "number"
        ? (input["schedulingPriority"] as number)
        : undefined,
    parameters: recordOrUndefined(input["parameters"]),
    retryStrategy: recordOrUndefined(input["retryStrategy"]),
    containerProperties: recordOrUndefined(input["containerProperties"]),
    nodeProperties: recordOrUndefined(input["nodeProperties"]),
    timeout: recordOrUndefined(input["timeout"]),
    propagateTags:
      typeof input["propagateTags"] === "boolean"
        ? (input["propagateTags"] as boolean)
        : undefined,
    platformCapabilities: Array.isArray(input["platformCapabilities"])
      ? (input["platformCapabilities"] as unknown[])
      : undefined,
    tags: tagsFromInput(input["tags"]),
  };
  ctx.store.set(jobDefinitionKey(name, revision), jobDefinition);
  return {
    jobDefinitionName: name,
    jobDefinitionArn,
    revision,
  };
};

const DescribeJobDefinitions: OperationHandler = (input, ctx) => {
  const requested = stringListFromInput(input["jobDefinitions"]);
  const name = stringOrUndefined(input["jobDefinitionName"]);
  const status = stringOrUndefined(input["status"]);
  const matches = (jobDefinition: StoredJobDefinition): boolean => {
    if (
      requested.length > 0 &&
      !requested.includes(jobDefinition.jobDefinitionArn) &&
      !requested.includes(
        `${jobDefinition.jobDefinitionName}:${jobDefinition.revision}`,
      )
    ) {
      return false;
    }
    if (name !== undefined && jobDefinition.jobDefinitionName !== name) {
      return false;
    }
    if (status !== undefined && jobDefinition.status !== status) {
      return false;
    }
    return true;
  };
  return {
    jobDefinitions: listJobDefinitions(ctx)
      .filter(matches)
      .map(jobDefinitionView),
  };
};

const SubmitJob: OperationHandler = (input, ctx) => {
  const jobName = requireString(input, "jobName");
  const jobQueue = requireString(input, "jobQueue");
  const jobDefinition = requireString(input, "jobDefinition");
  const jobId = uuid();
  const jobArn = `arn:aws:batch:${ctx.region}:${ctx.account}:job/${jobId}`;
  const now = Date.now();
  const containerOverrides = recordOrUndefined(input["containerOverrides"]);
  const job: StoredJob = {
    jobArn,
    jobName,
    jobId,
    jobQueue,
    status: "SUBMITTED",
    jobDefinition,
    createdAt: now,
    startedAt: now,
    parameters: recordOrUndefined(input["parameters"]),
    container: {
      command: Array.isArray(containerOverrides?.["command"])
        ? containerOverrides["command"]
        : [],
      environment: Array.isArray(containerOverrides?.["environment"])
        ? containerOverrides["environment"]
        : [],
    },
    tags: tagsFromInput(input["tags"]),
  };
  ctx.store.set(jobKey(jobId), job);
  return {
    jobArn,
    jobName,
    jobId,
  };
};

const DescribeJobs: OperationHandler = (input, ctx) => {
  const requested = stringListFromInput(input["jobs"]);
  return {
    jobs: listJobs(ctx)
      .filter(
        (job) =>
          requested.includes(job.jobId) || requested.includes(job.jobArn),
      )
      .map(jobView),
  };
};

const ListJobs: OperationHandler = (input, ctx) => {
  const jobQueue = stringOrUndefined(input["jobQueue"]);
  const jobStatus = stringOrUndefined(input["jobStatus"]);
  const matches = (job: StoredJob): boolean => {
    if (jobQueue !== undefined && job.jobQueue !== jobQueue) return false;
    if (jobStatus !== undefined && job.status !== jobStatus) return false;
    return true;
  };
  return {
    jobSummaryList: listJobs(ctx).filter(matches).map(jobSummaryView),
  };
};

const CancelJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  requireString(input, "reason");
  const job = ctx.store.get<StoredJob>(jobKey(jobId));
  if (
    job !== undefined &&
    job.status !== "SUCCEEDED" &&
    job.status !== "FAILED"
  ) {
    ctx.store.set(jobKey(jobId), { ...job, status: "CANCELLED" });
  }
  return {};
};

const TerminateJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  requireString(input, "reason");
  const job = ctx.store.get<StoredJob>(jobKey(jobId));
  if (job !== undefined) {
    ctx.store.set(jobKey(jobId), { ...job, status: "FAILED" });
  }
  return {};
};

const findJobQueue = (
  ctx: ServiceContext,
  identifier: string,
): StoredJobQueue | undefined =>
  listJobQueues(ctx).find(
    (jobQueue) =>
      jobQueue.jobQueueName === identifier ||
      jobQueue.jobQueueArn === identifier,
  );

const UpdateJobQueue: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "jobQueue");
  const existing = findJobQueue(ctx, identifier);
  if (existing === undefined) {
    throw awsError("ClientException", `jobQueue ${identifier} not found.`, 400);
  }
  const updated: StoredJobQueue = {
    ...existing,
    state: stringOrUndefined(input["state"]) ?? existing.state,
    schedulingPolicyArn:
      stringOrUndefined(input["schedulingPolicyArn"]) ??
      existing.schedulingPolicyArn,
    priority:
      typeof input["priority"] === "number"
        ? (input["priority"] as number)
        : existing.priority,
    computeEnvironmentOrder: Array.isArray(input["computeEnvironmentOrder"])
      ? (input["computeEnvironmentOrder"] as unknown[])
      : existing.computeEnvironmentOrder,
  };
  ctx.store.set(jobQueueKey(existing.jobQueueName), updated);
  return {
    jobQueueName: updated.jobQueueName,
    jobQueueArn: updated.jobQueueArn,
  };
};

const DeleteJobQueue: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "jobQueue");
  const existing = findJobQueue(ctx, identifier);
  if (existing !== undefined) {
    ctx.store.delete(jobQueueKey(existing.jobQueueName));
  }
  return {};
};

const findComputeEnvironment = (
  ctx: ServiceContext,
  identifier: string,
): StoredComputeEnvironment | undefined =>
  listComputeEnvironments(ctx).find(
    (computeEnvironment) =>
      computeEnvironment.computeEnvironmentName === identifier ||
      computeEnvironment.computeEnvironmentArn === identifier,
  );

const UpdateComputeEnvironment: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "computeEnvironment");
  const existing = findComputeEnvironment(ctx, identifier);
  if (existing === undefined) {
    throw awsError(
      "ClientException",
      `computeEnvironment ${identifier} not found.`,
      400,
    );
  }
  const updated: StoredComputeEnvironment = {
    ...existing,
    state: stringOrUndefined(input["state"]) ?? existing.state,
    serviceRole:
      stringOrUndefined(input["serviceRole"]) ?? existing.serviceRole,
    computeResources:
      recordOrUndefined(input["computeResources"]) ?? existing.computeResources,
  };
  ctx.store.set(
    computeEnvironmentKey(existing.computeEnvironmentName),
    updated,
  );
  return {
    computeEnvironmentName: updated.computeEnvironmentName,
    computeEnvironmentArn: updated.computeEnvironmentArn,
  };
};

const DeleteComputeEnvironment: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "computeEnvironment");
  const existing = findComputeEnvironment(ctx, identifier);
  if (existing !== undefined) {
    ctx.store.delete(computeEnvironmentKey(existing.computeEnvironmentName));
  }
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const operationByPath: Record<string, string> = {
  createcomputeenvironment: "CreateComputeEnvironment",
  describecomputeenvironments: "DescribeComputeEnvironments",
  createjobqueue: "CreateJobQueue",
  describejobqueues: "DescribeJobQueues",
  registerjobdefinition: "RegisterJobDefinition",
  describejobdefinitions: "DescribeJobDefinitions",
  submitjob: "SubmitJob",
  describejobs: "DescribeJobs",
  listjobs: "ListJobs",
  canceljob: "CancelJob",
  terminatejob: "TerminateJob",
  updatejobqueue: "UpdateJobQueue",
  deletejobqueue: "DeleteJobQueue",
  updatecomputeenvironment: "UpdateComputeEnvironment",
  deletecomputeenvironment: "DeleteComputeEnvironment",
};

const batch = {
  name: "batch",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "v1" || parts.length !== 2) return undefined;
    if (req.method !== "POST") return undefined;
    return operationByPath[parts[1]];
  },
  operations: {
    CreateComputeEnvironment,
    DescribeComputeEnvironments,
    CreateJobQueue,
    DescribeJobQueues,
    RegisterJobDefinition,
    DescribeJobDefinitions,
    SubmitJob,
    DescribeJobs,
    ListJobs,
    CancelJob,
    TerminateJob,
    UpdateJobQueue,
    DeleteJobQueue,
    UpdateComputeEnvironment,
    DeleteComputeEnvironment,
  },
  model,
} as const satisfies ServiceDefinition;

export default batch;
