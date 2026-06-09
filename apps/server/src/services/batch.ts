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
  statusReason?: string;
  jobDefinition: string;
  createdAt: number;
  startedAt: number;
  stoppedAt?: number;
  isCancelled?: boolean;
  isTerminated?: boolean;
  attempts?: unknown[];
  parameters: Record<string, unknown> | undefined;
  container: Record<string, unknown>;
  tags: Record<string, string>;
};

type StoredSchedulingPolicy = {
  name: string;
  arn: string;
  fairsharePolicy: Record<string, unknown> | undefined;
  quotaSharePolicy: Record<string, unknown> | undefined;
  tags: Record<string, string>;
};

type StoredConsumableResource = {
  consumableResourceName: string;
  consumableResourceArn: string;
  totalQuantity: number;
  inUseQuantity: number;
  resourceType: string | undefined;
  tags: Record<string, string>;
  createdAt: number;
};

type StoredServiceEnvironment = {
  serviceEnvironmentName: string;
  serviceEnvironmentArn: string;
  serviceEnvironmentType: string;
  state: string;
  status: string;
  capacityLimits: unknown;
  tags: Record<string, string>;
};

type StoredQuotaShare = {
  quotaShareName: string;
  quotaShareArn: string;
  jobQueue: string;
  jobQueueArn: string;
  capacityLimits: unknown;
  resourceSharingConfiguration: unknown;
  preemptionConfiguration: unknown;
  state: string;
  status: string;
  tags: Record<string, string>;
};

type StoredServiceJob = {
  jobArn: string;
  jobName: string;
  jobId: string;
  jobQueue: string;
  serviceJobType: string;
  status: string;
  createdAt: number;
  startedAt: number;
  schedulingPriority: number | undefined;
  serviceRequestPayload: Record<string, unknown> | undefined;
  shareIdentifier: string | undefined;
  quotaShareName: string | undefined;
  preemptionConfiguration: unknown;
  retryStrategy: unknown;
  timeoutConfig: unknown;
  tags: Record<string, string>;
};

const computeEnvironmentKey = (name: string): string => `ce/${name}`;

const jobQueueKey = (name: string): string => `jq/${name}`;

const jobDefinitionKey = (name: string, revision: number): string =>
  `jd/${name}:${revision}`;

const jobKey = (id: string): string => `job/${id}`;

const schedulingPolicyKey = (name: string): string => `sp/${name}`;

const consumableResourceKey = (name: string): string => `cr/${name}`;

const serviceEnvironmentKey = (name: string): string => `se/${name}`;

const quotaShareKey = (arn: string): string => `qs/${arn}`;

const serviceJobKey = (id: string): string => `sj/${id}`;

const tagsKey = (arn: string): string => `tags/${arn}`;

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

const encodePageToken = (offset: number): string =>
  Buffer.from(String(offset), "utf8").toString("base64");

const decodePageToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") return 0;
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
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

const JOB_STATUS_PROGRESSION = [
  "SUBMITTED",
  "PENDING",
  "RUNNABLE",
  "STARTING",
  "RUNNING",
  "SUCCEEDED",
] as const;

const advanceJobStatus = (job: StoredJob, ctx: ServiceContext): StoredJob => {
  if (job.status === "SUCCEEDED" || job.status === "FAILED") return job;
  const idx = JOB_STATUS_PROGRESSION.indexOf(
    job.status as (typeof JOB_STATUS_PROGRESSION)[number],
  );
  const nextIdx =
    idx === -1 ? 0 : Math.min(idx + 1, JOB_STATUS_PROGRESSION.length - 1);
  const nextStatus = JOB_STATUS_PROGRESSION[nextIdx];
  const now = Date.now();
  const updated: StoredJob =
    nextStatus === "SUCCEEDED"
      ? {
          ...job,
          status: nextStatus,
          stoppedAt: now,
          attempts: [
            {
              startedAt: job.startedAt,
              stoppedAt: now,
              container: { exitCode: 0 },
            },
          ],
        }
      : { ...job, status: nextStatus };
  ctx.store.set(jobKey(job.jobId), updated);
  return updated;
};

const jobView = (job: StoredJob): Record<string, unknown> => ({
  jobArn: job.jobArn,
  jobName: job.jobName,
  jobId: job.jobId,
  jobQueue: job.jobQueue,
  status: job.status,
  statusReason: job.statusReason,
  jobDefinition: job.jobDefinition,
  createdAt: job.createdAt,
  startedAt: job.startedAt,
  stoppedAt: job.stoppedAt,
  isCancelled: job.isCancelled ?? false,
  isTerminated: job.isTerminated ?? false,
  attempts: job.attempts ?? [],
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

const schedulingPolicyView = (
  sp: StoredSchedulingPolicy,
): Record<string, unknown> => ({
  name: sp.name,
  arn: sp.arn,
  fairsharePolicy: sp.fairsharePolicy,
  quotaSharePolicy: sp.quotaSharePolicy,
  tags: sp.tags,
});

const consumableResourceView = (
  cr: StoredConsumableResource,
): Record<string, unknown> => ({
  consumableResourceName: cr.consumableResourceName,
  consumableResourceArn: cr.consumableResourceArn,
  totalQuantity: cr.totalQuantity,
  inUseQuantity: cr.inUseQuantity,
  availableQuantity: cr.totalQuantity - cr.inUseQuantity,
  resourceType: cr.resourceType,
  createdAt: cr.createdAt,
  tags: cr.tags,
});

const consumableResourceSummaryView = (
  cr: StoredConsumableResource,
): Record<string, unknown> => ({
  consumableResourceArn: cr.consumableResourceArn,
  consumableResourceName: cr.consumableResourceName,
  totalQuantity: cr.totalQuantity,
  inUseQuantity: cr.inUseQuantity,
  resourceType: cr.resourceType,
});

const serviceEnvironmentView = (
  se: StoredServiceEnvironment,
): Record<string, unknown> => ({
  serviceEnvironmentName: se.serviceEnvironmentName,
  serviceEnvironmentArn: se.serviceEnvironmentArn,
  serviceEnvironmentType: se.serviceEnvironmentType,
  state: se.state,
  status: se.status,
  capacityLimits: se.capacityLimits,
  tags: se.tags,
});

const quotaShareView = (qs: StoredQuotaShare): Record<string, unknown> => ({
  quotaShareName: qs.quotaShareName,
  quotaShareArn: qs.quotaShareArn,
  jobQueueArn: qs.jobQueueArn,
  capacityLimits: qs.capacityLimits,
  resourceSharingConfiguration: qs.resourceSharingConfiguration,
  preemptionConfiguration: qs.preemptionConfiguration,
  state: qs.state,
  status: qs.status,
  tags: qs.tags,
});

const serviceJobView = (sj: StoredServiceJob): Record<string, unknown> => ({
  jobArn: sj.jobArn,
  jobId: sj.jobId,
  jobName: sj.jobName,
  jobQueue: sj.jobQueue,
  serviceJobType: sj.serviceJobType,
  status: sj.status,
  createdAt: sj.createdAt,
  startedAt: sj.startedAt,
  schedulingPriority: sj.schedulingPriority,
  serviceRequestPayload: sj.serviceRequestPayload,
  shareIdentifier: sj.shareIdentifier,
  quotaShareName: sj.quotaShareName,
  preemptionConfiguration: sj.preemptionConfiguration,
  retryStrategy: sj.retryStrategy,
  timeoutConfig: sj.timeoutConfig,
  tags: sj.tags,
  isTerminated: sj.status === "FAILED",
});

const serviceJobSummaryView = (
  sj: StoredServiceJob,
): Record<string, unknown> => ({
  jobArn: sj.jobArn,
  jobId: sj.jobId,
  jobName: sj.jobName,
  serviceJobType: sj.serviceJobType,
  status: sj.status,
  createdAt: sj.createdAt,
  startedAt: sj.startedAt,
  shareIdentifier: sj.shareIdentifier,
  quotaShareName: sj.quotaShareName,
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

const listSchedulingPolicies = (
  ctx: ServiceContext,
): StoredSchedulingPolicy[] =>
  ctx.store
    .list<StoredSchedulingPolicy>()
    .filter((entry) => entry.key.startsWith("sp/"))
    .map((entry) => entry.value);

const listConsumableResources = (
  ctx: ServiceContext,
): StoredConsumableResource[] =>
  ctx.store
    .list<StoredConsumableResource>()
    .filter((entry) => entry.key.startsWith("cr/"))
    .map((entry) => entry.value);

const listServiceEnvironments = (
  ctx: ServiceContext,
): StoredServiceEnvironment[] =>
  ctx.store
    .list<StoredServiceEnvironment>()
    .filter((entry) => entry.key.startsWith("se/"))
    .map((entry) => entry.value);

const listQuotaShares = (ctx: ServiceContext): StoredQuotaShare[] =>
  ctx.store
    .list<StoredQuotaShare>()
    .filter((entry) => entry.key.startsWith("qs/"))
    .map((entry) => entry.value);

const listServiceJobs = (ctx: ServiceContext): StoredServiceJob[] =>
  ctx.store
    .list<StoredServiceJob>()
    .filter((entry) => entry.key.startsWith("sj/"))
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
  const maxResults =
    typeof input["maxResults"] === "number"
      ? (input["maxResults"] as number)
      : undefined;
  const offset = decodePageToken(input["nextToken"]);
  const matches = (computeEnvironment: StoredComputeEnvironment): boolean =>
    requested.length === 0 ||
    requested.includes(computeEnvironment.computeEnvironmentName) ||
    requested.includes(computeEnvironment.computeEnvironmentArn);
  const all = listComputeEnvironments(ctx).filter(matches);
  const page =
    maxResults !== undefined
      ? all.slice(offset, offset + maxResults)
      : all.slice(offset);
  const result: Record<string, unknown> = {
    computeEnvironments: page.map(computeEnvironmentView),
  };
  if (maxResults !== undefined && offset + maxResults < all.length) {
    result["nextToken"] = encodePageToken(offset + maxResults);
  }
  return result;
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
  const maxResults =
    typeof input["maxResults"] === "number"
      ? (input["maxResults"] as number)
      : undefined;
  const offset = decodePageToken(input["nextToken"]);
  const matches = (jobQueue: StoredJobQueue): boolean =>
    requested.length === 0 ||
    requested.includes(jobQueue.jobQueueName) ||
    requested.includes(jobQueue.jobQueueArn);
  const all = listJobQueues(ctx).filter(matches);
  const page =
    maxResults !== undefined
      ? all.slice(offset, offset + maxResults)
      : all.slice(offset);
  const result: Record<string, unknown> = {
    jobQueues: page.map(jobQueueView),
  };
  if (maxResults !== undefined && offset + maxResults < all.length) {
    result["nextToken"] = encodePageToken(offset + maxResults);
  }
  return result;
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
  const maxResults =
    typeof input["maxResults"] === "number"
      ? (input["maxResults"] as number)
      : undefined;
  const offset = decodePageToken(input["nextToken"]);
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
  const all = listJobDefinitions(ctx).filter(matches);
  const page =
    maxResults !== undefined
      ? all.slice(offset, offset + maxResults)
      : all.slice(offset);
  const result: Record<string, unknown> = {
    jobDefinitions: page.map(jobDefinitionView),
  };
  if (maxResults !== undefined && offset + maxResults < all.length) {
    result["nextToken"] = encodePageToken(offset + maxResults);
  }
  return result;
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
      instanceType: stringOrUndefined(containerOverrides?.["instanceType"]),
      memory:
        typeof containerOverrides?.["memory"] === "number"
          ? (containerOverrides["memory"] as number)
          : undefined,
      vcpus:
        typeof containerOverrides?.["vcpus"] === "number"
          ? (containerOverrides["vcpus"] as number)
          : undefined,
      resourceRequirements: Array.isArray(
        containerOverrides?.["resourceRequirements"],
      )
        ? containerOverrides["resourceRequirements"]
        : undefined,
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
  const jobs = listJobs(ctx).filter(
    (job) => requested.includes(job.jobId) || requested.includes(job.jobArn),
  );
  return {
    jobs: jobs.map((job) => jobView(advanceJobStatus(job, ctx))),
  };
};

const jobMatchesFilter = (
  job: StoredJob,
  filter: Record<string, unknown>,
): boolean => {
  const name = stringOrUndefined(filter["name"]);
  const values = stringListFromInput(filter["values"]);
  if (values.length === 0) return true;
  if (name === "JOB_NAME") {
    return values.some((pattern) => {
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
      return regex.test(job.jobName);
    });
  }
  if (name === "JOB_DEFINITION") {
    return values.includes(job.jobDefinition);
  }
  if (name === "BEFORE_CREATED_AT") {
    const ts = Number.parseInt(values[0] ?? "0", 10);
    return Number.isFinite(ts) && job.createdAt < ts;
  }
  if (name === "AFTER_CREATED_AT") {
    const ts = Number.parseInt(values[0] ?? "0", 10);
    return Number.isFinite(ts) && job.createdAt > ts;
  }
  return true;
};

const ListJobs: OperationHandler = (input, ctx) => {
  const jobQueue = stringOrUndefined(input["jobQueue"]);
  const jobStatus = stringOrUndefined(input["jobStatus"]);
  const filters = Array.isArray(input["filters"])
    ? (input["filters"] as unknown[])
    : [];
  const maxResults =
    typeof input["maxResults"] === "number"
      ? (input["maxResults"] as number)
      : undefined;
  const offset = decodePageToken(input["nextToken"]);
  const matches = (job: StoredJob): boolean => {
    if (jobQueue !== undefined && job.jobQueue !== jobQueue) return false;
    if (jobStatus !== undefined && job.status !== jobStatus) return false;
    for (const f of filters) {
      if (
        typeof f === "object" &&
        f !== null &&
        !jobMatchesFilter(job, f as Record<string, unknown>)
      ) {
        return false;
      }
    }
    return true;
  };
  const all = listJobs(ctx).filter(matches);
  const page =
    maxResults !== undefined
      ? all.slice(offset, offset + maxResults)
      : all.slice(offset);
  const result: Record<string, unknown> = {
    jobSummaryList: page.map(jobSummaryView),
  };
  if (maxResults !== undefined && offset + maxResults < all.length) {
    result["nextToken"] = encodePageToken(offset + maxResults);
  }
  return result;
};

const CancelJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  const reason = requireString(input, "reason");
  const job = ctx.store.get<StoredJob>(jobKey(jobId));
  if (job === undefined) {
    throw awsError("ClientException", `Job not found: ${jobId}`, 400);
  }
  if (job.status !== "SUCCEEDED" && job.status !== "FAILED") {
    const now = Date.now();
    ctx.store.set(jobKey(jobId), {
      ...job,
      status: "FAILED",
      statusReason: reason,
      isCancelled: true,
      stoppedAt: now,
      attempts: [
        {
          startedAt: job.startedAt,
          stoppedAt: now,
          container: { exitCode: 1, reason },
        },
      ],
    });
  }
  return {};
};

const TerminateJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  const reason = requireString(input, "reason");
  const job = ctx.store.get<StoredJob>(jobKey(jobId));
  if (job === undefined) {
    throw awsError("ClientException", `Job not found: ${jobId}`, 400);
  }
  const now = Date.now();
  ctx.store.set(jobKey(jobId), {
    ...job,
    status: "FAILED",
    statusReason: reason,
    isTerminated: true,
    stoppedAt: now,
    attempts: [
      {
        startedAt: job.startedAt,
        stoppedAt: now,
        container: { exitCode: 1, reason },
      },
    ],
  });
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

const DeregisterJobDefinition: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "jobDefinition");
  const all = listJobDefinitions(ctx);
  const match = all.find(
    (jd) =>
      jd.jobDefinitionArn === identifier ||
      `${jd.jobDefinitionName}:${jd.revision}` === identifier ||
      jd.jobDefinitionName === identifier,
  );
  if (match !== undefined) {
    ctx.store.set(jobDefinitionKey(match.jobDefinitionName, match.revision), {
      ...match,
      status: "INACTIVE",
    });
  }
  return {};
};

const findSchedulingPolicy = (
  ctx: ServiceContext,
  arn: string,
): StoredSchedulingPolicy | undefined =>
  listSchedulingPolicies(ctx).find((sp) => sp.arn === arn || sp.name === arn);

const CreateSchedulingPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const arn = `arn:aws:batch:${ctx.region}:${ctx.account}:scheduling-policy/${name}`;
  const sp: StoredSchedulingPolicy = {
    name,
    arn,
    fairsharePolicy: recordOrUndefined(input["fairsharePolicy"]),
    quotaSharePolicy: recordOrUndefined(input["quotaSharePolicy"]),
    tags: tagsFromInput(input["tags"]),
  };
  ctx.store.set(schedulingPolicyKey(name), sp);
  ctx.store.set(tagsKey(arn), sp.tags);
  return { name, arn };
};

const DeleteSchedulingPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const existing = findSchedulingPolicy(ctx, arn);
  if (existing !== undefined) {
    ctx.store.delete(schedulingPolicyKey(existing.name));
    ctx.store.delete(tagsKey(existing.arn));
  }
  return {};
};

const DescribeSchedulingPolicies: OperationHandler = (input, ctx) => {
  const arns = stringListFromInput(input["arns"]);
  const all = listSchedulingPolicies(ctx);
  const matched = arns
    .map((arn) => all.find((sp) => sp.arn === arn || sp.name === arn))
    .filter((sp): sp is StoredSchedulingPolicy => sp !== undefined);
  return { schedulingPolicies: matched.map(schedulingPolicyView) };
};

const ListSchedulingPolicies: OperationHandler = (_input, ctx) => {
  const all = listSchedulingPolicies(ctx);
  return {
    schedulingPolicies: all.map((sp) => ({ arn: sp.arn, tags: sp.tags })),
  };
};

const UpdateSchedulingPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const existing = findSchedulingPolicy(ctx, arn);
  if (existing === undefined) {
    throw awsError(
      "ClientException",
      `scheduling policy ${arn} not found.`,
      400,
    );
  }
  const updated: StoredSchedulingPolicy = {
    ...existing,
    fairsharePolicy:
      recordOrUndefined(input["fairsharePolicy"]) ?? existing.fairsharePolicy,
    quotaSharePolicy:
      recordOrUndefined(input["quotaSharePolicy"]) ?? existing.quotaSharePolicy,
  };
  ctx.store.set(schedulingPolicyKey(existing.name), updated);
  return {};
};

const findConsumableResource = (
  ctx: ServiceContext,
  identifier: string,
): StoredConsumableResource | undefined =>
  listConsumableResources(ctx).find(
    (cr) =>
      cr.consumableResourceName === identifier ||
      cr.consumableResourceArn === identifier,
  );

const CreateConsumableResource: OperationHandler = (input, ctx) => {
  const name = requireString(input, "consumableResourceName");
  const consumableResourceArn = `arn:aws:batch:${ctx.region}:${ctx.account}:consumable-resource/${name}`;
  const totalQuantity =
    typeof input["totalQuantity"] === "number"
      ? (input["totalQuantity"] as number)
      : 0;
  const cr: StoredConsumableResource = {
    consumableResourceName: name,
    consumableResourceArn,
    totalQuantity,
    inUseQuantity: 0,
    resourceType: stringOrUndefined(input["resourceType"]),
    tags: tagsFromInput(input["tags"]),
    createdAt: Date.now(),
  };
  ctx.store.set(consumableResourceKey(name), cr);
  ctx.store.set(tagsKey(consumableResourceArn), cr.tags);
  return { consumableResourceName: name, consumableResourceArn };
};

const DeleteConsumableResource: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "consumableResource");
  const existing = findConsumableResource(ctx, identifier);
  if (existing !== undefined) {
    ctx.store.delete(consumableResourceKey(existing.consumableResourceName));
    ctx.store.delete(tagsKey(existing.consumableResourceArn));
  }
  return {};
};

const DescribeConsumableResource: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "consumableResource");
  const existing = findConsumableResource(ctx, identifier);
  if (existing === undefined) {
    throw awsError(
      "ClientException",
      `consumable resource ${identifier} not found.`,
      400,
    );
  }
  return consumableResourceView(existing);
};

const UpdateConsumableResource: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "consumableResource");
  const existing = findConsumableResource(ctx, identifier);
  if (existing === undefined) {
    throw awsError(
      "ClientException",
      `consumable resource ${identifier} not found.`,
      400,
    );
  }
  const operation = stringOrUndefined(input["operation"]) ?? "SET";
  const quantity =
    typeof input["quantity"] === "number" ? (input["quantity"] as number) : 0;
  let newTotal = existing.totalQuantity;
  if (operation === "ADD") newTotal += quantity;
  else if (operation === "REMOVE") newTotal = Math.max(0, newTotal - quantity);
  else newTotal = quantity;
  const updated: StoredConsumableResource = {
    ...existing,
    totalQuantity: newTotal,
  };
  ctx.store.set(
    consumableResourceKey(existing.consumableResourceName),
    updated,
  );
  return {
    consumableResourceName: existing.consumableResourceName,
    consumableResourceArn: existing.consumableResourceArn,
    totalQuantity: newTotal,
  };
};

const ListConsumableResources: OperationHandler = (_input, ctx) => ({
  consumableResources: listConsumableResources(ctx).map(
    consumableResourceSummaryView,
  ),
});

const ListJobsByConsumableResource: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "consumableResource");
  const cr = findConsumableResource(ctx, identifier);
  if (cr === undefined) {
    throw awsError(
      "ClientException",
      `consumable resource ${identifier} not found.`,
      400,
    );
  }
  return { jobs: [] };
};

const findServiceEnvironment = (
  ctx: ServiceContext,
  identifier: string,
): StoredServiceEnvironment | undefined =>
  listServiceEnvironments(ctx).find(
    (se) =>
      se.serviceEnvironmentName === identifier ||
      se.serviceEnvironmentArn === identifier,
  );

const CreateServiceEnvironment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "serviceEnvironmentName");
  const serviceEnvironmentType = requireString(input, "serviceEnvironmentType");
  const serviceEnvironmentArn = `arn:aws:batch:${ctx.region}:${ctx.account}:service-environment/${name}`;
  const se: StoredServiceEnvironment = {
    serviceEnvironmentName: name,
    serviceEnvironmentArn,
    serviceEnvironmentType,
    state: stringOrUndefined(input["state"]) ?? "ENABLED",
    status: "VALID",
    capacityLimits: input["capacityLimits"] ?? {},
    tags: tagsFromInput(input["tags"]),
  };
  ctx.store.set(serviceEnvironmentKey(name), se);
  ctx.store.set(tagsKey(serviceEnvironmentArn), se.tags);
  return { serviceEnvironmentName: name, serviceEnvironmentArn };
};

const DeleteServiceEnvironment: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "serviceEnvironment");
  const existing = findServiceEnvironment(ctx, identifier);
  if (existing !== undefined) {
    ctx.store.delete(serviceEnvironmentKey(existing.serviceEnvironmentName));
    ctx.store.delete(tagsKey(existing.serviceEnvironmentArn));
  }
  return {};
};

const DescribeServiceEnvironments: OperationHandler = (input, ctx) => {
  const requested = stringListFromInput(input["serviceEnvironments"]);
  const matches = (se: StoredServiceEnvironment): boolean =>
    requested.length === 0 ||
    requested.includes(se.serviceEnvironmentName) ||
    requested.includes(se.serviceEnvironmentArn);
  return {
    serviceEnvironments: listServiceEnvironments(ctx)
      .filter(matches)
      .map(serviceEnvironmentView),
  };
};

const UpdateServiceEnvironment: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "serviceEnvironment");
  const existing = findServiceEnvironment(ctx, identifier);
  if (existing === undefined) {
    throw awsError(
      "ClientException",
      `service environment ${identifier} not found.`,
      400,
    );
  }
  const updated: StoredServiceEnvironment = {
    ...existing,
    state: stringOrUndefined(input["state"]) ?? existing.state,
    capacityLimits: input["capacityLimits"] ?? existing.capacityLimits,
  };
  ctx.store.set(
    serviceEnvironmentKey(existing.serviceEnvironmentName),
    updated,
  );
  return {
    serviceEnvironmentName: existing.serviceEnvironmentName,
    serviceEnvironmentArn: existing.serviceEnvironmentArn,
  };
};

const findQuotaShare = (
  ctx: ServiceContext,
  arn: string,
): StoredQuotaShare | undefined =>
  listQuotaShares(ctx).find((qs) => qs.quotaShareArn === arn);

const CreateQuotaShare: OperationHandler = (input, ctx) => {
  const quotaShareName = requireString(input, "quotaShareName");
  const jobQueue = requireString(input, "jobQueue");
  const quotaShareArn = `arn:aws:batch:${ctx.region}:${ctx.account}:quota-share/${quotaShareName}`;
  const jq = listJobQueues(ctx).find(
    (q) => q.jobQueueName === jobQueue || q.jobQueueArn === jobQueue,
  );
  const jobQueueArn =
    jq?.jobQueueArn ??
    `arn:aws:batch:${ctx.region}:${ctx.account}:job-queue/${jobQueue}`;
  const qs: StoredQuotaShare = {
    quotaShareName,
    quotaShareArn,
    jobQueue,
    jobQueueArn,
    capacityLimits: input["capacityLimits"] ?? [],
    resourceSharingConfiguration: input["resourceSharingConfiguration"] ?? {},
    preemptionConfiguration: input["preemptionConfiguration"] ?? {},
    state: stringOrUndefined(input["state"]) ?? "ENABLED",
    status: "VALID",
    tags: tagsFromInput(input["tags"]),
  };
  ctx.store.set(quotaShareKey(quotaShareArn), qs);
  ctx.store.set(tagsKey(quotaShareArn), qs.tags);
  return { quotaShareName, quotaShareArn };
};

const DeleteQuotaShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "quotaShareArn");
  const existing = findQuotaShare(ctx, arn);
  if (existing !== undefined) {
    ctx.store.delete(quotaShareKey(existing.quotaShareArn));
    ctx.store.delete(tagsKey(existing.quotaShareArn));
  }
  return {};
};

const DescribeQuotaShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "quotaShareArn");
  const existing = findQuotaShare(ctx, arn);
  if (existing === undefined) {
    throw awsError("ClientException", `quota share ${arn} not found.`, 400);
  }
  return quotaShareView(existing);
};

const UpdateQuotaShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "quotaShareArn");
  const existing = findQuotaShare(ctx, arn);
  if (existing === undefined) {
    throw awsError("ClientException", `quota share ${arn} not found.`, 400);
  }
  const updated: StoredQuotaShare = {
    ...existing,
    capacityLimits: input["capacityLimits"] ?? existing.capacityLimits,
    resourceSharingConfiguration:
      input["resourceSharingConfiguration"] ??
      existing.resourceSharingConfiguration,
    preemptionConfiguration:
      input["preemptionConfiguration"] ?? existing.preemptionConfiguration,
    state: stringOrUndefined(input["state"]) ?? existing.state,
  };
  ctx.store.set(quotaShareKey(existing.quotaShareArn), updated);
  return {
    quotaShareName: existing.quotaShareName,
    quotaShareArn: existing.quotaShareArn,
  };
};

const ListQuotaShares: OperationHandler = (input, ctx) => {
  const jobQueue = requireString(input, "jobQueue");
  const all = listQuotaShares(ctx).filter(
    (qs) => qs.jobQueue === jobQueue || qs.jobQueueArn === jobQueue,
  );
  return { quotaShares: all.map(quotaShareView) };
};

const findServiceJob = (
  ctx: ServiceContext,
  jobId: string,
): StoredServiceJob | undefined =>
  ctx.store.get<StoredServiceJob>(serviceJobKey(jobId));

const SubmitServiceJob: OperationHandler = (input, ctx) => {
  const jobName = requireString(input, "jobName");
  const jobQueue = requireString(input, "jobQueue");
  const serviceJobType = requireString(input, "serviceJobType");
  const jobId = uuid();
  const jobArn = `arn:aws:batch:${ctx.region}:${ctx.account}:job/${jobId}`;
  const now = Date.now();
  const sj: StoredServiceJob = {
    jobArn,
    jobName,
    jobId,
    jobQueue,
    serviceJobType,
    status: "SUBMITTED",
    createdAt: now,
    startedAt: now,
    schedulingPriority:
      typeof input["schedulingPriority"] === "number"
        ? (input["schedulingPriority"] as number)
        : undefined,
    serviceRequestPayload: recordOrUndefined(input["serviceRequestPayload"]),
    shareIdentifier: stringOrUndefined(input["shareIdentifier"]),
    quotaShareName: stringOrUndefined(input["quotaShareName"]),
    preemptionConfiguration: input["preemptionConfiguration"],
    retryStrategy: input["retryStrategy"],
    timeoutConfig: input["timeoutConfig"],
    tags: tagsFromInput(input["tags"]),
  };
  ctx.store.set(serviceJobKey(jobId), sj);
  ctx.store.set(tagsKey(jobArn), sj.tags);
  return { jobArn, jobName, jobId };
};

const DescribeServiceJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  const existing = findServiceJob(ctx, jobId);
  if (existing === undefined) {
    throw awsError("ClientException", `service job ${jobId} not found.`, 400);
  }
  return serviceJobView(existing);
};

const TerminateServiceJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  requireString(input, "reason");
  const existing = findServiceJob(ctx, jobId);
  if (existing !== undefined) {
    ctx.store.set(serviceJobKey(jobId), { ...existing, status: "FAILED" });
  }
  return {};
};

const UpdateServiceJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "jobId");
  const schedulingPriority = requireNumber(input, "schedulingPriority");
  const existing = findServiceJob(ctx, jobId);
  if (existing === undefined) {
    throw awsError("ClientException", `service job ${jobId} not found.`, 400);
  }
  const updated: StoredServiceJob = { ...existing, schedulingPriority };
  ctx.store.set(serviceJobKey(jobId), updated);
  return {
    jobArn: existing.jobArn,
    jobName: existing.jobName,
    jobId,
  };
};

const ListServiceJobs: OperationHandler = (input, ctx) => {
  const jobQueue = stringOrUndefined(input["jobQueue"]);
  const jobStatus = stringOrUndefined(input["jobStatus"]);
  const matches = (sj: StoredServiceJob): boolean => {
    if (jobQueue !== undefined && sj.jobQueue !== jobQueue) return false;
    if (jobStatus !== undefined && sj.status !== jobStatus) return false;
    return true;
  };
  return {
    jobSummaryList: listServiceJobs(ctx)
      .filter(matches)
      .map(serviceJobSummaryView),
  };
};

const GetJobQueueSnapshot: OperationHandler = (input, ctx) => {
  const jobQueue = requireString(input, "jobQueue");
  const jq = findJobQueue(ctx, jobQueue);
  if (jq === undefined) {
    throw awsError("ClientException", `jobQueue ${jobQueue} not found.`, 400);
  }
  return {
    frontOfQueue: {
      jobs: [],
      lastUpdatedAt: Date.now(),
    },
    frontOfQuotaShares: [],
    queueUtilization: {
      prioritizedJobsUtilizationPercentageByInstanceType: [],
    },
  };
};

const resourceExists = (ctx: ServiceContext, arn: string): boolean =>
  listComputeEnvironments(ctx).some((ce) => ce.computeEnvironmentArn === arn) ||
  listJobQueues(ctx).some((jq) => jq.jobQueueArn === arn) ||
  listJobDefinitions(ctx).some((jd) => jd.jobDefinitionArn === arn) ||
  listSchedulingPolicies(ctx).some((sp) => sp.arn === arn) ||
  listJobs(ctx).some((job) => job.jobArn === arn) ||
  listConsumableResources(ctx).some((cr) => cr.consumableResourceArn === arn) ||
  listServiceEnvironments(ctx).some((se) => se.serviceEnvironmentArn === arn) ||
  listServiceJobs(ctx).some((sj) => sj.jobArn === arn);

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  if (!resourceExists(ctx, resourceArn)) {
    throw awsError(
      "ClientException",
      `Resource not found: ${resourceArn}`,
      400,
    );
  }
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  return { tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  if (!resourceExists(ctx, resourceArn)) {
    throw awsError(
      "ClientException",
      `Resource not found: ${resourceArn}`,
      400,
    );
  }
  const newTags = tagsFromInput(input["tags"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  ctx.store.set(tagsKey(resourceArn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  if (!resourceExists(ctx, resourceArn)) {
    throw awsError(
      "ClientException",
      `Resource not found: ${resourceArn}`,
      400,
    );
  }
  const tagKeys = stringListFromInput(input["tagKeys"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  const updated: Record<string, string> = { ...existing };
  for (const key of tagKeys) {
    delete updated[key];
  }
  ctx.store.set(tagsKey(resourceArn), updated);
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
  createschedulingpolicy: "CreateSchedulingPolicy",
  deleteschedulingpolicy: "DeleteSchedulingPolicy",
  describeschedulingpolicies: "DescribeSchedulingPolicies",
  listschedulingpolicies: "ListSchedulingPolicies",
  updateschedulingpolicy: "UpdateSchedulingPolicy",
  createconsumableresource: "CreateConsumableResource",
  deleteconsumableresource: "DeleteConsumableResource",
  describeconsumableresource: "DescribeConsumableResource",
  updateconsumableresource: "UpdateConsumableResource",
  listconsumableresources: "ListConsumableResources",
  listjobsbyconsumableresource: "ListJobsByConsumableResource",
  createserviceenvironment: "CreateServiceEnvironment",
  deleteserviceenvironment: "DeleteServiceEnvironment",
  describeserviceenvironments: "DescribeServiceEnvironments",
  updateserviceenvironment: "UpdateServiceEnvironment",
  createquotashare: "CreateQuotaShare",
  deletequotashare: "DeleteQuotaShare",
  describequotashare: "DescribeQuotaShare",
  updatequotashare: "UpdateQuotaShare",
  listquotashares: "ListQuotaShares",
  submitservicejob: "SubmitServiceJob",
  describeservicejob: "DescribeServiceJob",
  terminateservicejob: "TerminateServiceJob",
  updateservicejob: "UpdateServiceJob",
  listservicejobs: "ListServiceJobs",
  getjobqueuesnapshot: "GetJobQueueSnapshot",
  deregisterjobdefinition: "DeregisterJobDefinition",
};

const batch = {
  name: "batch",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "v1") return undefined;
    if (parts[1] === "tags" && parts.length >= 3) {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }
    if (parts.length !== 2) return undefined;
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
    DeregisterJobDefinition,
    CreateSchedulingPolicy,
    DeleteSchedulingPolicy,
    DescribeSchedulingPolicies,
    ListSchedulingPolicies,
    UpdateSchedulingPolicy,
    CreateConsumableResource,
    DeleteConsumableResource,
    DescribeConsumableResource,
    UpdateConsumableResource,
    ListConsumableResources,
    ListJobsByConsumableResource,
    CreateServiceEnvironment,
    DeleteServiceEnvironment,
    DescribeServiceEnvironments,
    UpdateServiceEnvironment,
    CreateQuotaShare,
    DeleteQuotaShare,
    DescribeQuotaShare,
    UpdateQuotaShare,
    ListQuotaShares,
    SubmitServiceJob,
    DescribeServiceJob,
    TerminateServiceJob,
    UpdateServiceJob,
    ListServiceJobs,
    GetJobQueueSnapshot,
    ListTagsForResource,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default batch;
