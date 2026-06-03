import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import stepFunctionsModel from "../../../../test/vendor/aws-models/stepfunctions.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(stepFunctionsModel);

type StoredStateMachine = {
  stateMachineArn: string;
  name: string;
  definition: string;
  roleArn: string;
  type: string;
  status: string;
  creationDate: number;
};

type StoredExecution = {
  executionArn: string;
  stateMachineArn: string;
  name: string;
  status: string;
  startDate: number;
  stopDate: number | undefined;
  input: string;
  output: string | undefined;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value === "string" && value !== "") return value;
  throw awsError("ValidationException", `${field} is a required field.`, 400);
};

type StoredActivity = {
  activityArn: string;
  name: string;
  creationDate: number;
};

type StoredTags = {
  resourceArn: string;
  tags: Record<string, string>;
};

const stateMachineKey = (arn: string): string => `stateMachine#${arn}`;

const executionKey = (arn: string): string => `execution#${arn}`;

const activityKey = (arn: string): string => `activity#${arn}`;

const tagsKey = (arn: string): string => `tags#${arn}`;

const activityArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:states:${ctx.region}:${ctx.account}:activity:${name}`;

const stateMachineArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:states:${ctx.region}:${ctx.account}:stateMachine:${name}`;

const executionArnOf = (
  ctx: ServiceContext,
  machineName: string,
  executionName: string,
): string =>
  `arn:aws:states:${ctx.region}:${ctx.account}:execution:${machineName}:${executionName}`;

const requireStateMachine = (
  ctx: ServiceContext,
  arn: string,
): StoredStateMachine => {
  const machine = ctx.store.get<StoredStateMachine>(stateMachineKey(arn));
  if (machine === undefined) {
    throw awsError(
      "StateMachineDoesNotExist",
      `State Machine Does Not Exist: '${arn}'`,
      400,
    );
  }
  return machine;
};

const requireExecution = (
  ctx: ServiceContext,
  arn: string,
): StoredExecution => {
  const execution = ctx.store.get<StoredExecution>(executionKey(arn));
  if (execution === undefined) {
    throw awsError(
      "ExecutionDoesNotExist",
      `Execution Does Not Exist: '${arn}'`,
      400,
    );
  }
  return execution;
};

const machineNameFromArn = (arn: string): string => {
  const parts = arn.split(":");
  return parts[parts.length - 1] ?? arn;
};

const CreateStateMachine: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const definition = requireString(input, "definition");
  const roleArn = requireString(input, "roleArn");
  const arn = stateMachineArnOf(ctx, name);
  const existing = ctx.store.get<StoredStateMachine>(stateMachineKey(arn));
  if (existing !== undefined) {
    throw awsError(
      "StateMachineAlreadyExists",
      `State Machine Already Exists: '${arn}'`,
      400,
    );
  }
  const creationDate = nowSeconds();
  const machine: StoredStateMachine = {
    stateMachineArn: arn,
    name,
    definition,
    roleArn,
    type: stringOrUndefined(input["type"]) ?? "STANDARD",
    status: "ACTIVE",
    creationDate,
  };
  ctx.store.set(stateMachineKey(arn), machine);
  return { stateMachineArn: arn, creationDate };
};

const DeleteStateMachine: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineArn");
  ctx.store.delete(stateMachineKey(arn));
  return {};
};

const ListStateMachines: OperationHandler = (_input, ctx) => {
  const stateMachines = ctx.store
    .list<StoredStateMachine | StoredExecution>()
    .map((entry) => entry.value)
    .filter(
      (value): value is StoredStateMachine =>
        (value as StoredStateMachine).definition !== undefined,
    )
    .map((machine) => ({
      stateMachineArn: machine.stateMachineArn,
      name: machine.name,
      type: machine.type,
      creationDate: machine.creationDate,
    }));
  return { stateMachines };
};

const DescribeStateMachine: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineArn");
  const machine = requireStateMachine(ctx, arn);
  return {
    stateMachineArn: machine.stateMachineArn,
    name: machine.name,
    status: machine.status,
    definition: machine.definition,
    roleArn: machine.roleArn,
    type: machine.type,
    creationDate: machine.creationDate,
  };
};

const StartExecution: OperationHandler = (input, ctx) => {
  const machineArn = requireString(input, "stateMachineArn");
  const machine = requireStateMachine(ctx, machineArn);
  const executionName = stringOrUndefined(input["name"]) ?? crypto.randomUUID();
  const machineName = machineNameFromArn(machine.stateMachineArn);
  const arn = executionArnOf(ctx, machineName, executionName);
  const existing = ctx.store.get<StoredExecution>(executionKey(arn));
  if (existing !== undefined) {
    throw awsError(
      "ExecutionAlreadyExists",
      `Execution Already Exists: '${arn}'`,
      400,
    );
  }
  const startDate = nowSeconds();
  const inputData = stringOrUndefined(input["input"]) ?? "{}";
  const execution: StoredExecution = {
    executionArn: arn,
    stateMachineArn: machine.stateMachineArn,
    name: executionName,
    status: "SUCCEEDED",
    startDate,
    stopDate: startDate,
    input: inputData,
    output: inputData,
  };
  ctx.store.set(executionKey(arn), execution);
  return { executionArn: arn, startDate };
};

const DescribeExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "executionArn");
  const execution = requireExecution(ctx, arn);
  return {
    executionArn: execution.executionArn,
    stateMachineArn: execution.stateMachineArn,
    name: execution.name,
    status: execution.status,
    startDate: execution.startDate,
    stopDate: execution.stopDate,
    input: execution.input,
    output: execution.output,
  };
};

const ListExecutions: OperationHandler = (input, ctx) => {
  const machineArn = stringOrUndefined(input["stateMachineArn"]);
  const statusFilter = stringOrUndefined(input["statusFilter"]);
  const executions = ctx.store
    .list<StoredStateMachine | StoredExecution>()
    .map((entry) => entry.value)
    .filter(
      (value): value is StoredExecution =>
        (value as StoredExecution).executionArn !== undefined,
    )
    .filter(
      (execution) =>
        machineArn === undefined || execution.stateMachineArn === machineArn,
    )
    .filter(
      (execution) =>
        statusFilter === undefined || execution.status === statusFilter,
    )
    .map((execution) => ({
      executionArn: execution.executionArn,
      stateMachineArn: execution.stateMachineArn,
      name: execution.name,
      status: execution.status,
      startDate: execution.startDate,
      stopDate: execution.stopDate,
    }));
  return { executions };
};

const StopExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "executionArn");
  const execution = requireExecution(ctx, arn);
  const stopDate = nowSeconds();
  execution.status = "ABORTED";
  execution.stopDate = stopDate;
  ctx.store.set(executionKey(arn), execution);
  return { stopDate };
};

const requireActivity = (ctx: ServiceContext, arn: string): StoredActivity => {
  const activity = ctx.store.get<StoredActivity>(activityKey(arn));
  if (activity === undefined) {
    throw awsError(
      "ActivityDoesNotExist",
      `Activity Does Not Exist: '${arn}'`,
      400,
    );
  }
  return activity;
};

const tagListToRecord = (value: unknown): Record<string, string> => {
  const record: Record<string, string> = {};
  if (!Array.isArray(value)) return record;
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const key = (entry as Record<string, unknown>)["key"];
    const tagValue = (entry as Record<string, unknown>)["value"];
    if (typeof key === "string" && key !== "") {
      record[key] = typeof tagValue === "string" ? tagValue : "";
    }
  }
  return record;
};

const recordToTagList = (
  record: Record<string, string>,
): { key: string; value: string }[] =>
  Object.entries(record).map(([key, value]) => ({ key, value }));

const CreateActivity: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const arn = activityArnOf(ctx, name);
  const existing = ctx.store.get<StoredActivity>(activityKey(arn));
  if (existing !== undefined) {
    throw awsError(
      "ActivityLimitExceeded",
      `Activity Already Exists: '${arn}'`,
      400,
    );
  }
  const creationDate = nowSeconds();
  const activity: StoredActivity = { activityArn: arn, name, creationDate };
  ctx.store.set(activityKey(arn), activity);
  const tags = tagListToRecord(input["tags"]);
  if (Object.keys(tags).length > 0) {
    ctx.store.set(tagsKey(arn), { resourceArn: arn, tags });
  }
  return { activityArn: arn, creationDate };
};

const DescribeActivity: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "activityArn");
  const activity = requireActivity(ctx, arn);
  return {
    activityArn: activity.activityArn,
    name: activity.name,
    creationDate: activity.creationDate,
  };
};

const ListActivities: OperationHandler = (_input, ctx) => {
  const activities = ctx.store
    .list<StoredActivity>()
    .filter((entry) => entry.key.startsWith("activity#"))
    .map((entry) => entry.value)
    .map((activity) => ({
      activityArn: activity.activityArn,
      name: activity.name,
      creationDate: activity.creationDate,
    }));
  return { activities };
};

const DeleteActivity: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "activityArn");
  ctx.store.delete(activityKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const incoming = tagListToRecord(input["tags"]);
  const existing = ctx.store.get<StoredTags>(tagsKey(resourceArn));
  const tags = { ...(existing?.tags ?? {}), ...incoming };
  ctx.store.set(tagsKey(resourceArn), { resourceArn, tags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const existing = ctx.store.get<StoredTags>(tagsKey(resourceArn));
  if (existing === undefined) return {};
  const keys = input["tagKeys"];
  const tags = { ...existing.tags };
  if (Array.isArray(keys)) {
    for (const key of keys) {
      if (typeof key === "string") delete tags[key];
    }
  }
  ctx.store.set(tagsKey(resourceArn), { resourceArn, tags });
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const existing = ctx.store.get<StoredTags>(tagsKey(resourceArn));
  return { tags: recordToTagList(existing?.tags ?? {}) };
};

const stepFunctions: ServiceDefinition = {
  name: "states",
  protocol: "json",
  operations: {
    CreateStateMachine,
    DeleteStateMachine,
    ListStateMachines,
    DescribeStateMachine,
    StartExecution,
    DescribeExecution,
    ListExecutions,
    StopExecution,
    CreateActivity,
    DescribeActivity,
    ListActivities,
    DeleteActivity,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const;

export default stepFunctions;
