import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/swf.json", { with: { type: "json" } }),
  { targetPrefix: "SimpleWorkflowService" },
);

type StoredDomain = {
  name: string;
  status: string;
  description: string | undefined;
  retentionPeriodInDays: string;
  arn: string;
};

type StoredActivityType = {
  domain: string;
  name: string;
  version: string;
  status: string;
  description: string | undefined;
  creationDate: number;
  deprecationDate: number | undefined;
  defaultTaskStartToCloseTimeout: string | undefined;
  defaultTaskHeartbeatTimeout: string | undefined;
  defaultTaskList: { name: string } | undefined;
  defaultTaskPriority: string | undefined;
  defaultTaskScheduleToStartTimeout: string | undefined;
  defaultTaskScheduleToCloseTimeout: string | undefined;
  arn: string;
};

type StoredWorkflowType = {
  domain: string;
  name: string;
  version: string;
  status: string;
  description: string | undefined;
  creationDate: number;
  deprecationDate: number | undefined;
  defaultTaskStartToCloseTimeout: string | undefined;
  defaultExecutionStartToCloseTimeout: string | undefined;
  defaultTaskList: { name: string } | undefined;
  defaultTaskPriority: string | undefined;
  defaultChildPolicy: string | undefined;
  defaultLambdaRole: string | undefined;
  arn: string;
};

type HistoryEvent = {
  eventTimestamp: number;
  eventType: string;
  eventId: number;
  [key: string]: unknown;
};

type StoredWorkflowExecution = {
  domain: string;
  workflowId: string;
  runId: string;
  workflowType: { name: string; version: string };
  startTimestamp: number;
  closeTimestamp: number | undefined;
  executionStatus: "OPEN" | "CLOSED";
  closeStatus: string | undefined;
  tagList: string[];
  cancelRequested: boolean;
  taskListName: string;
  taskStartToCloseTimeout: string;
  executionStartToCloseTimeout: string;
  childPolicy: string;
  lambdaRole: string | undefined;
  taskPriority: string | undefined;
  events: HistoryEvent[];
  nextEventId: number;
};

type StoredActivityTask = {
  taskToken: string;
  activityId: string;
  scheduledEventId: number;
  startedEventId: number;
  workflowExecution: { workflowId: string; runId: string };
  activityType: { name: string; version: string };
  input: string | undefined;
  domain: string;
  taskListName: string;
  status: "PENDING" | "CLAIMED";
  cancelRequested: boolean;
};

type StoredDecisionTask = {
  taskToken: string;
  scheduledEventId: number;
  startedEventId: number;
  previousStartedEventId: number;
  workflowExecution: { workflowId: string; runId: string };
  workflowType: { name: string; version: string };
  events: HistoryEvent[];
  domain: string;
  taskListName: string;
  status: "PENDING" | "CLAIMED";
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value === "string" && value !== "") return value;
  throw awsError("ValidationException", `${field} is a required field.`, 400);
};

const domainKey = (name: string): string => `domain#${name}`;

const activityTypeKey = (
  domain: string,
  name: string,
  version: string,
): string => `activityType#${domain}#${name}#${version}`;

const workflowTypeKey = (
  domain: string,
  name: string,
  version: string,
): string => `workflowType#${domain}#${name}#${version}`;

const executionKey = (
  domain: string,
  workflowId: string,
  runId: string,
): string => `execution#${domain}#${workflowId}#${runId}`;

const latestRunIdKey = (domain: string, workflowId: string): string =>
  `latestRunId#${domain}#${workflowId}`;

const activityTaskKey = (taskToken: string): string =>
  `activityTask#${taskToken}`;

const decisionTaskKey = (taskToken: string): string =>
  `decisionTask#${taskToken}`;

const tagKey = (resourceArn: string): string => `tags#${resourceArn}`;

const counterKey = (name: string): string => `counter#${name}`;

const domainArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:swf:${ctx.region}:${ctx.account}:/domain/${name}`;

const retentionOf = (input: Record<string, unknown>): string => {
  const value = input["workflowExecutionRetentionPeriodInDays"];
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number") return String(value);
  throw awsError(
    "ValidationException",
    "workflowExecutionRetentionPeriodInDays is a required field.",
    400,
  );
};

const nextId = (ctx: ServiceContext, name: string): number => {
  const current = ctx.store.get<number>(counterKey(name)) ?? 0;
  const next = current + 1;
  ctx.store.set(counterKey(name), next);
  return next;
};

const requireDomain = (ctx: ServiceContext, name: string): StoredDomain => {
  const domain = ctx.store.get<StoredDomain>(domainKey(name));
  if (domain === undefined) {
    throw awsError("UnknownResourceFault", `Unknown domain: ${name}`, 400);
  }
  return domain;
};

const requireActivityType = (
  ctx: ServiceContext,
  domain: string,
  name: string,
  version: string,
): StoredActivityType => {
  const at = ctx.store.get<StoredActivityType>(
    activityTypeKey(domain, name, version),
  );
  if (at === undefined) {
    throw awsError(
      "UnknownResourceFault",
      `Unknown activity type: ${name} ${version}`,
      400,
    );
  }
  return at;
};

const requireWorkflowType = (
  ctx: ServiceContext,
  domain: string,
  name: string,
  version: string,
): StoredWorkflowType => {
  const wt = ctx.store.get<StoredWorkflowType>(
    workflowTypeKey(domain, name, version),
  );
  if (wt === undefined) {
    throw awsError(
      "UnknownResourceFault",
      `Unknown workflow type: ${name} ${version}`,
      400,
    );
  }
  return wt;
};

const requireExecution = (
  ctx: ServiceContext,
  domain: string,
  workflowId: string,
  runId: string,
): StoredWorkflowExecution => {
  const ex = ctx.store.get<StoredWorkflowExecution>(
    executionKey(domain, workflowId, runId),
  );
  if (ex === undefined) {
    throw awsError(
      "UnknownResourceFault",
      `Unknown execution: ${workflowId} ${runId}`,
      400,
    );
  }
  return ex;
};

const getTypeFromInput = (
  input: Record<string, unknown>,
  field: string,
): { name: string; version: string } => {
  const t = input[field] as Record<string, unknown> | undefined;
  if (!t || typeof t !== "object") {
    throw awsError("ValidationException", `${field} is required`, 400);
  }
  const name = t["name"] as string | undefined;
  const version = t["version"] as string | undefined;
  if (!name || !version) {
    throw awsError(
      "ValidationException",
      `${field}.name and ${field}.version are required`,
      400,
    );
  }
  return { name, version };
};

const getExecutionFromInput = (
  input: Record<string, unknown>,
): { workflowId: string; runId: string } => {
  const ex = input["execution"] as Record<string, unknown> | undefined;
  if (!ex || typeof ex !== "object") {
    throw awsError("ValidationException", "execution is required", 400);
  }
  const workflowId = ex["workflowId"] as string | undefined;
  const runId = ex["runId"] as string | undefined;
  if (!workflowId || !runId) {
    throw awsError(
      "ValidationException",
      "execution.workflowId and execution.runId are required",
      400,
    );
  }
  return { workflowId, runId };
};

const getTaskListName = (input: Record<string, unknown>): string => {
  const tl = input["taskList"] as Record<string, unknown> | undefined;
  if (!tl || typeof tl !== "object") {
    throw awsError("ValidationException", "taskList is required", 400);
  }
  const name = tl["name"] as string | undefined;
  if (!name) {
    throw awsError("ValidationException", "taskList.name is required", 400);
  }
  return name;
};

const addEvent = (
  ex: StoredWorkflowExecution,
  eventType: string,
  attrs: Record<string, unknown>,
): HistoryEvent => {
  const event: HistoryEvent = {
    eventTimestamp: nowSeconds(),
    eventType,
    eventId: ex.nextEventId,
    ...attrs,
  };
  ex.nextEventId += 1;
  ex.events.push(event);
  return event;
};

const applyPageToken = <T>(
  items: T[],
  maximumPageSize: number | undefined,
  nextPageToken: string | undefined,
): { items: T[]; nextPageToken: string | undefined } => {
  const start =
    nextPageToken !== undefined ? parseInt(atob(nextPageToken), 10) : 0;
  const limit =
    maximumPageSize !== undefined && maximumPageSize > 0
      ? maximumPageSize
      : items.length;
  const sliced = items.slice(start, start + limit);
  const newNextToken =
    start + limit < items.length ? btoa(String(start + limit)) : undefined;
  return { items: sliced, nextPageToken: newNextToken };
};

const scheduleDecisionTask = (
  ctx: ServiceContext,
  ex: StoredWorkflowExecution,
  previousStartedEventId: number,
): void => {
  const schedEvent = addEvent(ex, "DecisionTaskScheduled", {
    decisionTaskScheduledEventAttributes: {
      taskList: { name: ex.taskListName },
      startToCloseTimeout: ex.taskStartToCloseTimeout,
    },
  });
  const taskToken = `dt-${nextId(ctx, "taskToken")}`;
  const task: StoredDecisionTask = {
    taskToken,
    scheduledEventId: schedEvent.eventId,
    startedEventId: 0,
    previousStartedEventId,
    workflowExecution: { workflowId: ex.workflowId, runId: ex.runId },
    workflowType: ex.workflowType,
    events: [...ex.events],
    domain: ex.domain,
    taskListName: ex.taskListName,
    status: "PENDING",
  };
  ctx.store.set(decisionTaskKey(taskToken), task);
  ctx.store.set(executionKey(ex.domain, ex.workflowId, ex.runId), ex);
};

const RegisterDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const retentionPeriodInDays = retentionOf(input);
  const existing = ctx.store.get<StoredDomain>(domainKey(name));
  if (existing !== undefined && existing.status === "REGISTERED") {
    throw awsError(
      "DomainAlreadyExistsFault",
      `Domain already exists: ${name}`,
      400,
    );
  }
  const domain: StoredDomain = {
    name,
    status: "REGISTERED",
    description: stringOrUndefined(input["description"]),
    retentionPeriodInDays,
    arn: domainArnOf(ctx, name),
  };
  ctx.store.set(domainKey(name), domain);
  return {};
};

const ListDomains: OperationHandler = (input, ctx) => {
  const registrationStatus = requireString(input, "registrationStatus");
  const reverseOrder = input["reverseOrder"] === true;
  const maximumPageSize =
    typeof input["maximumPageSize"] === "number"
      ? (input["maximumPageSize"] as number)
      : undefined;
  const nextPageToken = stringOrUndefined(input["nextPageToken"]);
  const allInfos = ctx.store
    .list<StoredDomain>()
    .map((entry) => entry.value)
    .filter((domain) => domain.status === registrationStatus)
    .map((domain) => ({
      name: domain.name,
      status: domain.status,
      description: domain.description,
      arn: domain.arn,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const ordered = reverseOrder ? [...allInfos].reverse() : allInfos;
  const { items: domainInfos, nextPageToken: newToken } = applyPageToken(
    ordered,
    maximumPageSize,
    nextPageToken,
  );
  return { domainInfos, nextPageToken: newToken };
};

const DescribeDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const domain = requireDomain(ctx, name);
  return {
    domainInfo: {
      name: domain.name,
      status: domain.status,
      description: domain.description,
      arn: domain.arn,
    },
    configuration: {
      workflowExecutionRetentionPeriodInDays: domain.retentionPeriodInDays,
    },
  };
};

const DeprecateDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const domain = requireDomain(ctx, name);
  if (domain.status === "DEPRECATED") {
    throw awsError(
      "DomainDeprecatedFault",
      `Domain is already deprecated: ${name}`,
      400,
    );
  }
  domain.status = "DEPRECATED";
  ctx.store.set(domainKey(name), domain);
  return {};
};

const UndeprecateDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const domain = requireDomain(ctx, name);
  domain.status = "REGISTERED";
  ctx.store.set(domainKey(name), domain);
  return {};
};

const RegisterActivityType: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const name = requireString(input, "name");
  const version = requireString(input, "version");
  const existing = ctx.store.get<StoredActivityType>(
    activityTypeKey(domain, name, version),
  );
  if (existing !== undefined && existing.status === "REGISTERED") {
    throw awsError(
      "TypeAlreadyExistsFault",
      `Activity type already exists: ${name} ${version}`,
      400,
    );
  }
  const taskListInput = input["defaultTaskList"] as
    | Record<string, unknown>
    | undefined;
  const at: StoredActivityType = {
    domain,
    name,
    version,
    status: "REGISTERED",
    description: stringOrUndefined(input["description"]),
    creationDate: nowSeconds(),
    deprecationDate: undefined,
    defaultTaskStartToCloseTimeout: stringOrUndefined(
      input["defaultTaskStartToCloseTimeout"],
    ),
    defaultTaskHeartbeatTimeout: stringOrUndefined(
      input["defaultTaskHeartbeatTimeout"],
    ),
    defaultTaskList: taskListInput
      ? { name: taskListInput["name"] as string }
      : undefined,
    defaultTaskPriority: stringOrUndefined(input["defaultTaskPriority"]),
    defaultTaskScheduleToStartTimeout: stringOrUndefined(
      input["defaultTaskScheduleToStartTimeout"],
    ),
    defaultTaskScheduleToCloseTimeout: stringOrUndefined(
      input["defaultTaskScheduleToCloseTimeout"],
    ),
    arn: `arn:aws:swf:${ctx.region}:${ctx.account}:activityType/${domain}/${name}/${version}`,
  };
  ctx.store.set(activityTypeKey(domain, name, version), at);
  return {};
};

const DescribeActivityType: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const { name, version } = getTypeFromInput(input, "activityType");
  const at = requireActivityType(ctx, domain, name, version);
  return {
    typeInfo: {
      activityType: { name: at.name, version: at.version },
      status: at.status,
      description: at.description,
      creationDate: at.creationDate,
      deprecationDate: at.deprecationDate,
    },
    configuration: {
      defaultTaskStartToCloseTimeout: at.defaultTaskStartToCloseTimeout,
      defaultTaskHeartbeatTimeout: at.defaultTaskHeartbeatTimeout,
      defaultTaskList: at.defaultTaskList,
      defaultTaskPriority: at.defaultTaskPriority,
      defaultTaskScheduleToStartTimeout: at.defaultTaskScheduleToStartTimeout,
      defaultTaskScheduleToCloseTimeout: at.defaultTaskScheduleToCloseTimeout,
    },
  };
};

const ListActivityTypes: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const registrationStatus = requireString(input, "registrationStatus");
  const reverseOrder = input["reverseOrder"] === true;
  const nameFilter = stringOrUndefined(input["name"]);
  const maximumPageSize =
    typeof input["maximumPageSize"] === "number"
      ? (input["maximumPageSize"] as number)
      : undefined;
  const nextPageToken = stringOrUndefined(input["nextPageToken"]);
  const allInfos = ctx.store
    .list<StoredActivityType>()
    .map((e) => e.value)
    .filter(
      (at) =>
        at.domain === domain &&
        at.status === registrationStatus &&
        (nameFilter === undefined || at.name === nameFilter),
    )
    .map((at) => ({
      activityType: { name: at.name, version: at.version },
      status: at.status,
      description: at.description,
      creationDate: at.creationDate,
      deprecationDate: at.deprecationDate,
    }))
    .sort((a, b) => {
      const n = a.activityType.name.localeCompare(b.activityType.name);
      return n !== 0
        ? n
        : a.activityType.version.localeCompare(b.activityType.version);
    });
  const ordered = reverseOrder ? [...allInfos].reverse() : allInfos;
  const { items: typeInfos, nextPageToken: newToken } = applyPageToken(
    ordered,
    maximumPageSize,
    nextPageToken,
  );
  return { typeInfos, nextPageToken: newToken };
};

const DeprecateActivityType: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const { name, version } = getTypeFromInput(input, "activityType");
  const at = requireActivityType(ctx, domain, name, version);
  at.status = "DEPRECATED";
  at.deprecationDate = nowSeconds();
  ctx.store.set(activityTypeKey(domain, name, version), at);
  return {};
};

const UndeprecateActivityType: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const { name, version } = getTypeFromInput(input, "activityType");
  const at = requireActivityType(ctx, domain, name, version);
  at.status = "REGISTERED";
  at.deprecationDate = undefined;
  ctx.store.set(activityTypeKey(domain, name, version), at);
  return {};
};

const DeleteActivityType: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const { name, version } = getTypeFromInput(input, "activityType");
  const at = requireActivityType(ctx, domain, name, version);
  if (at.status !== "DEPRECATED") {
    throw awsError(
      "TypeNotDeprecatedFault",
      `Type must be deprecated before deletion: ${name} ${version}`,
      400,
    );
  }
  ctx.store.delete(activityTypeKey(domain, name, version));
  return {};
};

const RegisterWorkflowType: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const name = requireString(input, "name");
  const version = requireString(input, "version");
  const existing = ctx.store.get<StoredWorkflowType>(
    workflowTypeKey(domain, name, version),
  );
  if (existing !== undefined && existing.status === "REGISTERED") {
    throw awsError(
      "TypeAlreadyExistsFault",
      `Workflow type already exists: ${name} ${version}`,
      400,
    );
  }
  const taskListInput = input["defaultTaskList"] as
    | Record<string, unknown>
    | undefined;
  const wt: StoredWorkflowType = {
    domain,
    name,
    version,
    status: "REGISTERED",
    description: stringOrUndefined(input["description"]),
    creationDate: nowSeconds(),
    deprecationDate: undefined,
    defaultTaskStartToCloseTimeout: stringOrUndefined(
      input["defaultTaskStartToCloseTimeout"],
    ),
    defaultExecutionStartToCloseTimeout: stringOrUndefined(
      input["defaultExecutionStartToCloseTimeout"],
    ),
    defaultTaskList: taskListInput
      ? { name: taskListInput["name"] as string }
      : undefined,
    defaultTaskPriority: stringOrUndefined(input["defaultTaskPriority"]),
    defaultChildPolicy: stringOrUndefined(input["defaultChildPolicy"]),
    defaultLambdaRole: stringOrUndefined(input["defaultLambdaRole"]),
    arn: `arn:aws:swf:${ctx.region}:${ctx.account}:workflowType/${domain}/${name}/${version}`,
  };
  ctx.store.set(workflowTypeKey(domain, name, version), wt);
  return {};
};

const DescribeWorkflowType: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const { name, version } = getTypeFromInput(input, "workflowType");
  const wt = requireWorkflowType(ctx, domain, name, version);
  return {
    typeInfo: {
      workflowType: { name: wt.name, version: wt.version },
      status: wt.status,
      description: wt.description,
      creationDate: wt.creationDate,
      deprecationDate: wt.deprecationDate,
    },
    configuration: {
      defaultTaskStartToCloseTimeout: wt.defaultTaskStartToCloseTimeout,
      defaultExecutionStartToCloseTimeout:
        wt.defaultExecutionStartToCloseTimeout,
      defaultTaskList: wt.defaultTaskList,
      defaultTaskPriority: wt.defaultTaskPriority,
      defaultChildPolicy: wt.defaultChildPolicy,
      defaultLambdaRole: wt.defaultLambdaRole,
    },
  };
};

const ListWorkflowTypes: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const registrationStatus = requireString(input, "registrationStatus");
  const reverseOrder = input["reverseOrder"] === true;
  const nameFilter = stringOrUndefined(input["name"]);
  const maximumPageSize =
    typeof input["maximumPageSize"] === "number"
      ? (input["maximumPageSize"] as number)
      : undefined;
  const nextPageToken = stringOrUndefined(input["nextPageToken"]);
  const allInfos = ctx.store
    .list<StoredWorkflowType>()
    .map((e) => e.value)
    .filter(
      (wt) =>
        wt.domain === domain &&
        wt.status === registrationStatus &&
        (nameFilter === undefined || wt.name === nameFilter),
    )
    .map((wt) => ({
      workflowType: { name: wt.name, version: wt.version },
      status: wt.status,
      description: wt.description,
      creationDate: wt.creationDate,
      deprecationDate: wt.deprecationDate,
    }))
    .sort((a, b) => {
      const n = a.workflowType.name.localeCompare(b.workflowType.name);
      return n !== 0
        ? n
        : a.workflowType.version.localeCompare(b.workflowType.version);
    });
  const ordered = reverseOrder ? [...allInfos].reverse() : allInfos;
  const { items: typeInfos, nextPageToken: newToken } = applyPageToken(
    ordered,
    maximumPageSize,
    nextPageToken,
  );
  return { typeInfos, nextPageToken: newToken };
};

const DeprecateWorkflowType: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const { name, version } = getTypeFromInput(input, "workflowType");
  const wt = requireWorkflowType(ctx, domain, name, version);
  wt.status = "DEPRECATED";
  wt.deprecationDate = nowSeconds();
  ctx.store.set(workflowTypeKey(domain, name, version), wt);
  return {};
};

const UndeprecateWorkflowType: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const { name, version } = getTypeFromInput(input, "workflowType");
  const wt = requireWorkflowType(ctx, domain, name, version);
  wt.status = "REGISTERED";
  wt.deprecationDate = undefined;
  ctx.store.set(workflowTypeKey(domain, name, version), wt);
  return {};
};

const DeleteWorkflowType: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const { name, version } = getTypeFromInput(input, "workflowType");
  const wt = requireWorkflowType(ctx, domain, name, version);
  if (wt.status !== "DEPRECATED") {
    throw awsError(
      "TypeNotDeprecatedFault",
      `Type must be deprecated before deletion: ${name} ${version}`,
      400,
    );
  }
  ctx.store.delete(workflowTypeKey(domain, name, version));
  return {};
};

const StartWorkflowExecution: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const workflowId = requireString(input, "workflowId");
  const { name, version } = getTypeFromInput(input, "workflowType");
  const wt = requireWorkflowType(ctx, domain, name, version);
  if (wt.status !== "REGISTERED") {
    throw awsError(
      "TypeDeprecatedFault",
      `Workflow type is deprecated: ${name} ${version}`,
      400,
    );
  }

  const existingRunId = ctx.store.get<string>(
    latestRunIdKey(domain, workflowId),
  );
  if (existingRunId !== undefined) {
    const existingEx = ctx.store.get<StoredWorkflowExecution>(
      executionKey(domain, workflowId, existingRunId),
    );
    if (existingEx !== undefined && existingEx.executionStatus === "OPEN") {
      throw awsError(
        "WorkflowExecutionAlreadyStartedFault",
        `Workflow execution already started: ${workflowId}`,
        400,
      );
    }
  }

  const runId = `run-${nextId(ctx, "runId")}`;
  const taskListInput = input["taskList"] as
    | Record<string, unknown>
    | undefined;
  const taskListName =
    (taskListInput?.["name"] as string | undefined) ??
    wt.defaultTaskList?.name ??
    "default";
  const taskStartToCloseTimeout =
    stringOrUndefined(input["taskStartToCloseTimeout"]) ??
    wt.defaultTaskStartToCloseTimeout ??
    "NONE";
  const executionStartToCloseTimeout =
    stringOrUndefined(input["executionStartToCloseTimeout"]) ??
    wt.defaultExecutionStartToCloseTimeout ??
    "NONE";
  const childPolicy =
    stringOrUndefined(input["childPolicy"]) ??
    wt.defaultChildPolicy ??
    "TERMINATE";
  const tagList = (input["tagList"] as string[] | undefined) ?? [];

  const ex: StoredWorkflowExecution = {
    domain,
    workflowId,
    runId,
    workflowType: { name, version },
    startTimestamp: nowSeconds(),
    closeTimestamp: undefined,
    executionStatus: "OPEN",
    closeStatus: undefined,
    tagList,
    cancelRequested: false,
    taskListName,
    taskStartToCloseTimeout,
    executionStartToCloseTimeout,
    childPolicy,
    lambdaRole: stringOrUndefined(input["lambdaRole"]) ?? wt.defaultLambdaRole,
    taskPriority:
      stringOrUndefined(input["taskPriority"]) ?? wt.defaultTaskPriority,
    events: [],
    nextEventId: 1,
  };

  addEvent(ex, "WorkflowExecutionStarted", {
    workflowExecutionStartedEventAttributes: {
      input: stringOrUndefined(input["input"]),
      executionStartToCloseTimeout,
      taskStartToCloseTimeout,
      childPolicy,
      taskList: { name: taskListName },
      workflowType: { name, version },
      tagList,
    },
  });

  ctx.store.set(executionKey(domain, workflowId, runId), ex);
  ctx.store.set(latestRunIdKey(domain, workflowId), runId);

  scheduleDecisionTask(ctx, ex, 0);

  return { runId };
};

const DescribeWorkflowExecution: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const { workflowId, runId } = getExecutionFromInput(input);
  const ex = requireExecution(ctx, domain, workflowId, runId);
  return {
    executionInfo: {
      execution: { workflowId: ex.workflowId, runId: ex.runId },
      workflowType: ex.workflowType,
      startTimestamp: ex.startTimestamp,
      closeTimestamp: ex.closeTimestamp,
      executionStatus: ex.executionStatus,
      closeStatus: ex.closeStatus,
      tagList: ex.tagList,
      cancelRequested: ex.cancelRequested,
    },
    executionConfiguration: {
      taskStartToCloseTimeout: ex.taskStartToCloseTimeout,
      executionStartToCloseTimeout: ex.executionStartToCloseTimeout,
      taskList: { name: ex.taskListName },
      childPolicy: ex.childPolicy,
    },
    openCounts: {
      openActivityTasks: 0,
      openDecisionTasks: 0,
      openTimers: 0,
      openChildWorkflowExecutions: 0,
    },
  };
};

const GetWorkflowExecutionHistory: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const { workflowId, runId } = getExecutionFromInput(input);
  const ex = requireExecution(ctx, domain, workflowId, runId);
  const reverseOrder = input["reverseOrder"] === true;
  const maximumPageSize =
    typeof input["maximumPageSize"] === "number"
      ? (input["maximumPageSize"] as number)
      : undefined;
  const nextPageToken = stringOrUndefined(input["nextPageToken"]);
  const ordered = reverseOrder ? [...ex.events].reverse() : [...ex.events];
  const { items: events, nextPageToken: newToken } = applyPageToken(
    ordered,
    maximumPageSize,
    nextPageToken,
  );
  return { events, nextPageToken: newToken };
};

const ListOpenWorkflowExecutions: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const typeFilter = input["typeFilter"] as Record<string, unknown> | undefined;
  const tagFilter = input["tagFilter"] as Record<string, unknown> | undefined;
  const executionFilter = input["executionFilter"] as
    | Record<string, unknown>
    | undefined;
  const maximumPageSize =
    typeof input["maximumPageSize"] === "number"
      ? (input["maximumPageSize"] as number)
      : undefined;
  const nextPageToken = stringOrUndefined(input["nextPageToken"]);
  const allInfos = ctx.store
    .list<StoredWorkflowExecution>()
    .map((e) => e.value)
    .filter((ex) => ex.domain === domain && ex.executionStatus === "OPEN")
    .filter((ex) => {
      if (typeFilter) {
        const n = typeFilter["name"] as string | undefined;
        const v = typeFilter["version"] as string | undefined;
        if (n && ex.workflowType.name !== n) return false;
        if (v && ex.workflowType.version !== v) return false;
      }
      if (tagFilter) {
        const tag = tagFilter["tag"] as string | undefined;
        if (tag && !ex.tagList.includes(tag)) return false;
      }
      if (executionFilter) {
        const wid = executionFilter["workflowId"] as string | undefined;
        if (wid && ex.workflowId !== wid) return false;
      }
      return true;
    })
    .map((ex) => ({
      execution: { workflowId: ex.workflowId, runId: ex.runId },
      workflowType: ex.workflowType,
      startTimestamp: ex.startTimestamp,
      executionStatus: ex.executionStatus,
      tagList: ex.tagList,
      cancelRequested: ex.cancelRequested,
    }));
  const { items: executionInfos, nextPageToken: newToken } = applyPageToken(
    allInfos,
    maximumPageSize,
    nextPageToken,
  );
  return { executionInfos, nextPageToken: newToken };
};

const ListClosedWorkflowExecutions: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const typeFilter = input["typeFilter"] as Record<string, unknown> | undefined;
  const tagFilter = input["tagFilter"] as Record<string, unknown> | undefined;
  const executionFilter = input["executionFilter"] as
    | Record<string, unknown>
    | undefined;
  const closeStatusFilter = input["closeStatusFilter"] as
    | Record<string, unknown>
    | undefined;
  const maximumPageSize =
    typeof input["maximumPageSize"] === "number"
      ? (input["maximumPageSize"] as number)
      : undefined;
  const nextPageToken = stringOrUndefined(input["nextPageToken"]);
  const allInfos = ctx.store
    .list<StoredWorkflowExecution>()
    .map((e) => e.value)
    .filter((ex) => ex.domain === domain && ex.executionStatus === "CLOSED")
    .filter((ex) => {
      if (typeFilter) {
        const n = typeFilter["name"] as string | undefined;
        const v = typeFilter["version"] as string | undefined;
        if (n && ex.workflowType.name !== n) return false;
        if (v && ex.workflowType.version !== v) return false;
      }
      if (tagFilter) {
        const tag = tagFilter["tag"] as string | undefined;
        if (tag && !ex.tagList.includes(tag)) return false;
      }
      if (executionFilter) {
        const wid = executionFilter["workflowId"] as string | undefined;
        if (wid && ex.workflowId !== wid) return false;
      }
      if (closeStatusFilter) {
        const status = closeStatusFilter["status"] as string | undefined;
        if (status && ex.closeStatus !== status) return false;
      }
      return true;
    })
    .map((ex) => ({
      execution: { workflowId: ex.workflowId, runId: ex.runId },
      workflowType: ex.workflowType,
      startTimestamp: ex.startTimestamp,
      closeTimestamp: ex.closeTimestamp,
      executionStatus: ex.executionStatus,
      closeStatus: ex.closeStatus,
      tagList: ex.tagList,
      cancelRequested: ex.cancelRequested,
    }));
  const { items: executionInfos, nextPageToken: newToken } = applyPageToken(
    allInfos,
    maximumPageSize,
    nextPageToken,
  );
  return { executionInfos, nextPageToken: newToken };
};

const CountOpenWorkflowExecutions: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const count = ctx.store
    .list<StoredWorkflowExecution>()
    .map((e) => e.value)
    .filter(
      (ex) => ex.domain === domain && ex.executionStatus === "OPEN",
    ).length;
  return { count, truncated: false };
};

const CountClosedWorkflowExecutions: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const count = ctx.store
    .list<StoredWorkflowExecution>()
    .map((e) => e.value)
    .filter(
      (ex) => ex.domain === domain && ex.executionStatus === "CLOSED",
    ).length;
  return { count, truncated: false };
};

const TerminateWorkflowExecution: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const workflowId = requireString(input, "workflowId");
  const runId =
    stringOrUndefined(input["runId"]) ??
    ctx.store.get<string>(latestRunIdKey(domain, workflowId));
  if (!runId) {
    throw awsError(
      "UnknownResourceFault",
      `Unknown execution: ${workflowId}`,
      400,
    );
  }
  const ex = requireExecution(ctx, domain, workflowId, runId);
  if (ex.executionStatus !== "OPEN") {
    throw awsError(
      "UnknownResourceFault",
      `Execution is not open: ${workflowId}`,
      400,
    );
  }
  const reason = stringOrUndefined(input["reason"]);
  const details = stringOrUndefined(input["details"]);
  const childPolicy = stringOrUndefined(input["childPolicy"]) ?? ex.childPolicy;
  addEvent(ex, "WorkflowExecutionTerminated", {
    workflowExecutionTerminatedEventAttributes: {
      reason,
      details,
      childPolicy,
      cause: "OPERATOR_INITIATED",
    },
  });
  ex.executionStatus = "CLOSED";
  ex.closeStatus = "TERMINATED";
  ex.closeTimestamp = nowSeconds();
  ctx.store.set(executionKey(domain, workflowId, runId), ex);
  return {};
};

const RequestCancelWorkflowExecution: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const workflowId = requireString(input, "workflowId");
  const runId =
    stringOrUndefined(input["runId"]) ??
    ctx.store.get<string>(latestRunIdKey(domain, workflowId));
  if (!runId) {
    throw awsError(
      "UnknownResourceFault",
      `Unknown execution: ${workflowId}`,
      400,
    );
  }
  const ex = requireExecution(ctx, domain, workflowId, runId);
  ex.cancelRequested = true;
  addEvent(ex, "WorkflowExecutionCancelRequested", {
    workflowExecutionCancelRequestedEventAttributes: {
      cause: "CHILD_POLICY_APPLIED",
    },
  });
  ctx.store.set(executionKey(domain, workflowId, runId), ex);
  return {};
};

const SignalWorkflowExecution: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const workflowId = requireString(input, "workflowId");
  const signalName = requireString(input, "signalName");
  const runId =
    stringOrUndefined(input["runId"]) ??
    ctx.store.get<string>(latestRunIdKey(domain, workflowId));
  if (!runId) {
    throw awsError(
      "UnknownResourceFault",
      `Unknown execution: ${workflowId}`,
      400,
    );
  }
  const ex = requireExecution(ctx, domain, workflowId, runId);
  addEvent(ex, "WorkflowExecutionSignaled", {
    workflowExecutionSignaledEventAttributes: {
      signalName,
      input: stringOrUndefined(input["input"]),
    },
  });
  ctx.store.set(executionKey(domain, workflowId, runId), ex);
  return {};
};

const PollForDecisionTask: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const taskListName = getTaskListName(input);
  const reverseOrder = input["reverseOrder"] === true;
  const startAtPrev = input["startAtPreviousStartedEventId"] === true;
  const maximumPageSize =
    typeof input["maximumPageSize"] === "number"
      ? (input["maximumPageSize"] as number)
      : undefined;
  const nextPageToken = stringOrUndefined(input["nextPageToken"]);

  const pending = ctx.store
    .list<StoredDecisionTask>()
    .map((e) => e.value)
    .find(
      (t) =>
        t.domain === domain &&
        t.taskListName === taskListName &&
        t.status === "PENDING",
    );

  if (!pending) {
    return {
      taskToken: "",
      startedEventId: 0,
      workflowExecution: { workflowId: "", runId: "" },
      workflowType: { name: "", version: "" },
      events: [],
    };
  }

  const ex = ctx.store.get<StoredWorkflowExecution>(
    executionKey(
      pending.domain,
      pending.workflowExecution.workflowId,
      pending.workflowExecution.runId,
    ),
  );
  if (ex) {
    const startedEvent = addEvent(ex, "DecisionTaskStarted", {
      decisionTaskStartedEventAttributes: {
        scheduledEventId: pending.scheduledEventId,
        identity: stringOrUndefined(input["identity"]),
      },
    });
    pending.startedEventId = startedEvent.eventId;
    pending.events = [...ex.events];
    ctx.store.set(executionKey(ex.domain, ex.workflowId, ex.runId), ex);
  }

  pending.status = "CLAIMED";
  ctx.store.set(decisionTaskKey(pending.taskToken), pending);

  let events = [...pending.events];
  if (startAtPrev && pending.previousStartedEventId > 0) {
    const startIdx = events.findIndex(
      (e) => e.eventId >= pending.previousStartedEventId,
    );
    if (startIdx >= 0) {
      events = events.slice(startIdx);
    }
  }
  if (reverseOrder) {
    events = [...events].reverse();
  }
  const { items: pagedEvents, nextPageToken: newToken } = applyPageToken(
    events,
    maximumPageSize,
    nextPageToken,
  );

  return {
    taskToken: pending.taskToken,
    startedEventId: pending.startedEventId,
    previousStartedEventId: pending.previousStartedEventId,
    workflowExecution: pending.workflowExecution,
    workflowType: pending.workflowType,
    events: pagedEvents,
    nextPageToken: newToken,
  };
};

const RespondDecisionTaskCompleted: OperationHandler = (input, ctx) => {
  const taskToken = requireString(input, "taskToken");
  const task = ctx.store.get<StoredDecisionTask>(decisionTaskKey(taskToken));
  if (!task) {
    throw awsError(
      "UnknownResourceFault",
      `Unknown decision task: ${taskToken}`,
      400,
    );
  }
  ctx.store.delete(decisionTaskKey(taskToken));

  const ex = ctx.store.get<StoredWorkflowExecution>(
    executionKey(
      task.domain,
      task.workflowExecution.workflowId,
      task.workflowExecution.runId,
    ),
  );
  if (!ex) return {};

  const completedEventId = ex.nextEventId;
  addEvent(ex, "DecisionTaskCompleted", {
    decisionTaskCompletedEventAttributes: {
      scheduledEventId: task.scheduledEventId,
      startedEventId: task.startedEventId,
      executionContext: stringOrUndefined(input["executionContext"]),
    },
  });

  const decisions =
    (input["decisions"] as Record<string, unknown>[] | undefined) ?? [];

  for (const decision of decisions) {
    const decisionType = decision["decisionType"] as string;
    if (decisionType === "ScheduleActivityTask") {
      const attrs = decision[
        "scheduleActivityTaskDecisionAttributes"
      ] as Record<string, unknown>;
      if (!attrs) continue;
      const activityType = attrs["activityType"] as
        | Record<string, unknown>
        | undefined;
      const activityId = attrs["activityId"] as string;
      const atName = activityType?.["name"] as string | undefined;
      const atVersion = activityType?.["version"] as string | undefined;
      const storedAt =
        atName && atVersion
          ? ctx.store.get<StoredActivityType>(
              activityTypeKey(task.domain, atName, atVersion),
            )
          : undefined;
      if (!storedAt || storedAt.status !== "REGISTERED") {
        addEvent(ex, "ScheduleActivityTaskFailed", {
          scheduleActivityTaskFailedEventAttributes: {
            activityType,
            activityId,
            cause: storedAt
              ? "ACTIVITY_TYPE_DEPRECATED"
              : "ACTIVITY_TYPE_DOES_NOT_EXIST",
            decisionTaskCompletedEventId: completedEventId,
          },
        });
        continue;
      }
      const schedEvent = addEvent(ex, "ActivityTaskScheduled", {
        activityTaskScheduledEventAttributes: {
          activityType,
          activityId,
          input: stringOrUndefined(attrs["input"]),
          taskList: attrs["taskList"] ?? { name: ex.taskListName },
          decisionTaskCompletedEventId: completedEventId,
        },
      });
      const activityTaskToken = `at-${nextId(ctx, "taskToken")}`;
      const atTaskList = attrs["taskList"] as
        | Record<string, unknown>
        | undefined;
      const atTaskListName =
        (atTaskList?.["name"] as string | undefined) ?? ex.taskListName;
      const atTask: StoredActivityTask = {
        taskToken: activityTaskToken,
        activityId,
        scheduledEventId: schedEvent.eventId,
        startedEventId: 0,
        workflowExecution: {
          workflowId: ex.workflowId,
          runId: ex.runId,
        },
        activityType: activityType as { name: string; version: string },
        input: stringOrUndefined(attrs["input"]),
        domain: task.domain,
        taskListName: atTaskListName,
        status: "PENDING",
        cancelRequested: false,
      };
      ctx.store.set(activityTaskKey(activityTaskToken), atTask);
    } else if (decisionType === "CompleteWorkflowExecution") {
      const attrs = decision["completeWorkflowExecutionDecisionAttributes"] as
        | Record<string, unknown>
        | undefined;
      addEvent(ex, "WorkflowExecutionCompleted", {
        workflowExecutionCompletedEventAttributes: {
          result: stringOrUndefined(attrs?.["result"]),
          decisionTaskCompletedEventId: completedEventId,
        },
      });
      ex.executionStatus = "CLOSED";
      ex.closeStatus = "COMPLETED";
      ex.closeTimestamp = nowSeconds();
    } else if (decisionType === "FailWorkflowExecution") {
      const attrs = decision["failWorkflowExecutionDecisionAttributes"] as
        | Record<string, unknown>
        | undefined;
      addEvent(ex, "WorkflowExecutionFailed", {
        workflowExecutionFailedEventAttributes: {
          reason: stringOrUndefined(attrs?.["reason"]),
          details: stringOrUndefined(attrs?.["details"]),
          decisionTaskCompletedEventId: completedEventId,
        },
      });
      ex.executionStatus = "CLOSED";
      ex.closeStatus = "FAILED";
      ex.closeTimestamp = nowSeconds();
    } else if (decisionType === "CancelWorkflowExecution") {
      const attrs = decision["cancelWorkflowExecutionDecisionAttributes"] as
        | Record<string, unknown>
        | undefined;
      addEvent(ex, "WorkflowExecutionCanceled", {
        workflowExecutionCanceledEventAttributes: {
          details: stringOrUndefined(attrs?.["details"]),
          decisionTaskCompletedEventId: completedEventId,
        },
      });
      ex.executionStatus = "CLOSED";
      ex.closeStatus = "CANCELED";
      ex.closeTimestamp = nowSeconds();
    }
  }

  if (ex.executionStatus === "OPEN") {
    scheduleDecisionTask(ctx, ex, task.startedEventId);
  }

  ctx.store.set(executionKey(ex.domain, ex.workflowId, ex.runId), ex);
  return {};
};

const PollForActivityTask: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const taskListName = getTaskListName(input);

  const pending = ctx.store
    .list<StoredActivityTask>()
    .map((e) => e.value)
    .find(
      (t) =>
        t.domain === domain &&
        t.taskListName === taskListName &&
        t.status === "PENDING",
    );

  if (!pending) {
    return {
      taskToken: "",
      activityId: "",
      startedEventId: 0,
      workflowExecution: { workflowId: "", runId: "" },
      activityType: { name: "", version: "" },
    };
  }

  const ex = ctx.store.get<StoredWorkflowExecution>(
    executionKey(
      pending.domain,
      pending.workflowExecution.workflowId,
      pending.workflowExecution.runId,
    ),
  );
  if (ex) {
    const startedEvent = addEvent(ex, "ActivityTaskStarted", {
      activityTaskStartedEventAttributes: {
        scheduledEventId: pending.scheduledEventId,
        identity: stringOrUndefined(input["identity"]),
      },
    });
    pending.startedEventId = startedEvent.eventId;
    ctx.store.set(executionKey(ex.domain, ex.workflowId, ex.runId), ex);
  }

  pending.status = "CLAIMED";
  ctx.store.set(activityTaskKey(pending.taskToken), pending);

  return {
    taskToken: pending.taskToken,
    activityId: pending.activityId,
    startedEventId: pending.startedEventId,
    workflowExecution: pending.workflowExecution,
    activityType: pending.activityType,
    input: pending.input,
  };
};

const RecordActivityTaskHeartbeat: OperationHandler = (input, ctx) => {
  const taskToken = requireString(input, "taskToken");
  const task = ctx.store.get<StoredActivityTask>(activityTaskKey(taskToken));
  if (!task) {
    throw awsError(
      "UnknownResourceFault",
      `Unknown activity task: ${taskToken}`,
      400,
    );
  }
  return { cancelRequested: task.cancelRequested };
};

const RespondActivityTaskCompleted: OperationHandler = (input, ctx) => {
  const taskToken = requireString(input, "taskToken");
  const task = ctx.store.get<StoredActivityTask>(activityTaskKey(taskToken));
  if (!task) {
    throw awsError(
      "UnknownResourceFault",
      `Unknown activity task: ${taskToken}`,
      400,
    );
  }
  ctx.store.delete(activityTaskKey(taskToken));
  const ex = ctx.store.get<StoredWorkflowExecution>(
    executionKey(
      task.domain,
      task.workflowExecution.workflowId,
      task.workflowExecution.runId,
    ),
  );
  if (!ex || ex.executionStatus !== "OPEN") return {};
  addEvent(ex, "ActivityTaskCompleted", {
    activityTaskCompletedEventAttributes: {
      result: stringOrUndefined(input["result"]),
      scheduledEventId: task.scheduledEventId,
      startedEventId: task.startedEventId,
    },
  });
  scheduleDecisionTask(ctx, ex, ex.nextEventId - 1);
  ctx.store.set(executionKey(ex.domain, ex.workflowId, ex.runId), ex);
  return {};
};

const RespondActivityTaskFailed: OperationHandler = (input, ctx) => {
  const taskToken = requireString(input, "taskToken");
  const task = ctx.store.get<StoredActivityTask>(activityTaskKey(taskToken));
  if (!task) {
    throw awsError(
      "UnknownResourceFault",
      `Unknown activity task: ${taskToken}`,
      400,
    );
  }
  ctx.store.delete(activityTaskKey(taskToken));
  const ex = ctx.store.get<StoredWorkflowExecution>(
    executionKey(
      task.domain,
      task.workflowExecution.workflowId,
      task.workflowExecution.runId,
    ),
  );
  if (!ex || ex.executionStatus !== "OPEN") return {};
  addEvent(ex, "ActivityTaskFailed", {
    activityTaskFailedEventAttributes: {
      reason: stringOrUndefined(input["reason"]),
      details: stringOrUndefined(input["details"]),
      scheduledEventId: task.scheduledEventId,
      startedEventId: task.startedEventId,
    },
  });
  scheduleDecisionTask(ctx, ex, ex.nextEventId - 1);
  ctx.store.set(executionKey(ex.domain, ex.workflowId, ex.runId), ex);
  return {};
};

const RespondActivityTaskCanceled: OperationHandler = (input, ctx) => {
  const taskToken = requireString(input, "taskToken");
  const task = ctx.store.get<StoredActivityTask>(activityTaskKey(taskToken));
  if (!task) {
    throw awsError(
      "UnknownResourceFault",
      `Unknown activity task: ${taskToken}`,
      400,
    );
  }
  ctx.store.delete(activityTaskKey(taskToken));
  const ex = ctx.store.get<StoredWorkflowExecution>(
    executionKey(
      task.domain,
      task.workflowExecution.workflowId,
      task.workflowExecution.runId,
    ),
  );
  if (!ex || ex.executionStatus !== "OPEN") return {};
  addEvent(ex, "ActivityTaskCanceled", {
    activityTaskCanceledEventAttributes: {
      details: stringOrUndefined(input["details"]),
      scheduledEventId: task.scheduledEventId,
      startedEventId: task.startedEventId,
    },
  });
  scheduleDecisionTask(ctx, ex, ex.nextEventId - 1);
  ctx.store.set(executionKey(ex.domain, ex.workflowId, ex.runId), ex);
  return {};
};

const CountPendingActivityTasks: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const taskListName = getTaskListName(input);
  const count = ctx.store
    .list<StoredActivityTask>()
    .map((e) => e.value)
    .filter(
      (t) =>
        t.domain === domain &&
        t.taskListName === taskListName &&
        t.status === "PENDING",
    ).length;
  return { count, truncated: false };
};

const CountPendingDecisionTasks: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "domain");
  requireDomain(ctx, domain);
  const taskListName = getTaskListName(input);
  const count = ctx.store
    .list<StoredDecisionTask>()
    .map((e) => e.value)
    .filter(
      (t) =>
        t.domain === domain &&
        t.taskListName === taskListName &&
        t.status === "PENDING",
    ).length;
  return { count, truncated: false };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags = (input["tags"] as { key: string; value: string }[]) ?? [];
  const existing =
    ctx.store.get<{ key: string; value: string }[]>(tagKey(resourceArn)) ?? [];
  const merged = [...existing];
  for (const tag of tags) {
    const idx = merged.findIndex((t) => t.key === tag.key);
    if (idx >= 0) {
      merged[idx] = tag;
    } else {
      merged.push(tag);
    }
  }
  ctx.store.set(tagKey(resourceArn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = (input["tagKeys"] as string[]) ?? [];
  const existing =
    ctx.store.get<{ key: string; value: string }[]>(tagKey(resourceArn)) ?? [];
  const filtered = existing.filter((t) => !tagKeys.includes(t.key));
  ctx.store.set(tagKey(resourceArn), filtered);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags =
    ctx.store.get<{ key: string; value: string }[]>(tagKey(resourceArn)) ?? [];
  return { tags };
};

const swf: ServiceDefinition = {
  name: "swf",
  protocol: "json",
  operations: {
    RegisterDomain,
    ListDomains,
    DescribeDomain,
    DeprecateDomain,
    UndeprecateDomain,
    RegisterActivityType,
    DescribeActivityType,
    ListActivityTypes,
    DeprecateActivityType,
    UndeprecateActivityType,
    DeleteActivityType,
    RegisterWorkflowType,
    DescribeWorkflowType,
    ListWorkflowTypes,
    DeprecateWorkflowType,
    UndeprecateWorkflowType,
    DeleteWorkflowType,
    StartWorkflowExecution,
    DescribeWorkflowExecution,
    GetWorkflowExecutionHistory,
    ListOpenWorkflowExecutions,
    ListClosedWorkflowExecutions,
    CountOpenWorkflowExecutions,
    CountClosedWorkflowExecutions,
    TerminateWorkflowExecution,
    RequestCancelWorkflowExecution,
    SignalWorkflowExecution,
    PollForDecisionTask,
    RespondDecisionTaskCompleted,
    PollForActivityTask,
    RecordActivityTaskHeartbeat,
    RespondActivityTaskCompleted,
    RespondActivityTaskFailed,
    RespondActivityTaskCanceled,
    CountPendingActivityTasks,
    CountPendingDecisionTasks,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const;

export default swf;
