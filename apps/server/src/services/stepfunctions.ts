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
  error: string | undefined;
  cause: string | undefined;
};

type AslChoiceCondition = {
  Variable?: string;
  StringEquals?: string;
  StringEqualsPath?: string;
  StringGreaterThan?: string;
  StringLessThan?: string;
  StringGreaterThanOrEquals?: string;
  StringLessThanOrEquals?: string;
  NumericEquals?: number;
  NumericEqualsPath?: string;
  NumericGreaterThan?: number;
  NumericLessThan?: number;
  NumericGreaterThanOrEquals?: number;
  NumericLessThanOrEquals?: number;
  BooleanEquals?: boolean;
  BooleanEqualsPath?: string;
  IsNull?: boolean;
  IsPresent?: boolean;
  IsNumeric?: boolean;
  IsString?: boolean;
  IsBoolean?: boolean;
  And?: AslChoiceCondition[];
  Or?: AslChoiceCondition[];
  Not?: AslChoiceCondition;
};

type AslChoiceRule = AslChoiceCondition & { Next: string };

type AslState = {
  Type: string;
  Next?: string;
  End?: boolean;
  Result?: unknown;
  ResultPath?: string | null;
  Parameters?: Record<string, unknown>;
  OutputPath?: string | null;
  Choices?: AslChoiceRule[];
  Default?: string;
  Error?: string;
  Cause?: string;
  Seconds?: number;
};

type AslDefinition = {
  StartAt: string;
  States: Record<string, AslState>;
};

type AslExecutionResult = {
  status: "SUCCEEDED" | "FAILED";
  output: string;
  error?: string;
  cause?: string;
};

const jsonPathGet = (data: unknown, path: string): unknown => {
  if (path === "$") return data;
  if (!path.startsWith("$.")) return undefined;
  const parts = path.slice(2).split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

const jsonPathSet = (data: unknown, path: string, value: unknown): unknown => {
  if (path === "$") return value;
  const inputObj =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};
  const parts = path.slice(2).split(".");
  const clone: Record<string, unknown> = { ...inputObj };
  let current = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const child = current[part];
    current[part] =
      typeof child === "object" && child !== null
        ? { ...(child as Record<string, unknown>) }
        : {};
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined) current[lastPart] = value;
  return clone;
};

const applyParameters = (
  params: Record<string, unknown>,
  input: unknown,
): unknown => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.endsWith(".$")) {
      result[key.slice(0, -2)] =
        typeof value === "string" ? jsonPathGet(input, value) : undefined;
    } else {
      result[key] = value;
    }
  }
  return result;
};

const evaluateCondition = (
  condition: AslChoiceCondition,
  input: unknown,
): boolean => {
  if (condition.And !== undefined)
    return condition.And.every((c) => evaluateCondition(c, input));
  if (condition.Or !== undefined)
    return condition.Or.some((c) => evaluateCondition(c, input));
  if (condition.Not !== undefined)
    return !evaluateCondition(condition.Not, input);

  const varValue =
    condition.Variable !== undefined
      ? jsonPathGet(input, condition.Variable)
      : undefined;

  if (condition.IsPresent !== undefined)
    return condition.IsPresent === (varValue !== undefined);
  if (condition.IsNull !== undefined)
    return condition.IsNull === (varValue === null);
  if (condition.IsNumeric !== undefined)
    return condition.IsNumeric === (typeof varValue === "number");
  if (condition.IsString !== undefined)
    return condition.IsString === (typeof varValue === "string");
  if (condition.IsBoolean !== undefined)
    return condition.IsBoolean === (typeof varValue === "boolean");
  if (condition.StringEquals !== undefined)
    return varValue === condition.StringEquals;
  if (condition.StringEqualsPath !== undefined)
    return varValue === jsonPathGet(input, condition.StringEqualsPath);
  if (condition.StringGreaterThan !== undefined)
    return (
      typeof varValue === "string" && varValue > condition.StringGreaterThan
    );
  if (condition.StringLessThan !== undefined)
    return typeof varValue === "string" && varValue < condition.StringLessThan;
  if (condition.StringGreaterThanOrEquals !== undefined)
    return (
      typeof varValue === "string" &&
      varValue >= condition.StringGreaterThanOrEquals
    );
  if (condition.StringLessThanOrEquals !== undefined)
    return (
      typeof varValue === "string" &&
      varValue <= condition.StringLessThanOrEquals
    );
  if (condition.NumericEquals !== undefined)
    return varValue === condition.NumericEquals;
  if (condition.NumericEqualsPath !== undefined)
    return varValue === jsonPathGet(input, condition.NumericEqualsPath);
  if (condition.NumericGreaterThan !== undefined)
    return (
      typeof varValue === "number" && varValue > condition.NumericGreaterThan
    );
  if (condition.NumericLessThan !== undefined)
    return typeof varValue === "number" && varValue < condition.NumericLessThan;
  if (condition.NumericGreaterThanOrEquals !== undefined)
    return (
      typeof varValue === "number" &&
      varValue >= condition.NumericGreaterThanOrEquals
    );
  if (condition.NumericLessThanOrEquals !== undefined)
    return (
      typeof varValue === "number" &&
      varValue <= condition.NumericLessThanOrEquals
    );
  if (condition.BooleanEquals !== undefined)
    return varValue === condition.BooleanEquals;
  if (condition.BooleanEqualsPath !== undefined)
    return varValue === jsonPathGet(input, condition.BooleanEqualsPath);
  return false;
};

const interpretAsl = (
  definitionStr: string,
  inputStr: string,
): AslExecutionResult => {
  let definition: AslDefinition;
  let currentInput: unknown;
  try {
    definition = JSON.parse(definitionStr) as AslDefinition;
    currentInput = JSON.parse(inputStr);
  } catch {
    return {
      status: "FAILED",
      output: "{}",
      error: "States.Runtime",
      cause: "Invalid definition or input",
    };
  }

  let currentStateName = definition.StartAt;
  const maxDepth = 100;

  for (let depth = 0; depth < maxDepth; depth++) {
    const state = definition.States[currentStateName];
    if (state === undefined) {
      return {
        status: "FAILED",
        output: "{}",
        error: "States.Runtime",
        cause: `State '${currentStateName}' not found`,
      };
    }

    if (state.Type === "Pass") {
      const rawInput = currentInput;
      const effectiveInput =
        state.Parameters !== undefined
          ? applyParameters(state.Parameters, rawInput)
          : rawInput;
      const result = state.Result !== undefined ? state.Result : effectiveInput;
      let stateOutput: unknown;
      if (state.ResultPath === null) {
        stateOutput = rawInput;
      } else if (state.ResultPath !== undefined) {
        stateOutput = jsonPathSet(rawInput, state.ResultPath, result);
      } else {
        stateOutput = result;
      }
      let output: unknown;
      if (state.OutputPath === null) {
        output = {};
      } else if (state.OutputPath !== undefined) {
        output = jsonPathGet(stateOutput, state.OutputPath);
      } else {
        output = stateOutput;
      }
      if (state.End === true)
        return { status: "SUCCEEDED", output: JSON.stringify(output) };
      currentInput = output;
      currentStateName = state.Next!;
    } else if (state.Type === "Choice") {
      const choices = state.Choices ?? [];
      let nextState: string | undefined;
      for (const choice of choices) {
        if (evaluateCondition(choice, currentInput)) {
          nextState = choice.Next;
          break;
        }
      }
      if (nextState === undefined) nextState = state.Default;
      if (nextState === undefined) {
        return {
          status: "FAILED",
          output: "{}",
          error: "States.NoChoiceMatched",
          cause: "No choice matched and no default state",
        };
      }
      currentStateName = nextState;
    } else if (state.Type === "Succeed") {
      return { status: "SUCCEEDED", output: JSON.stringify(currentInput) };
    } else if (state.Type === "Fail") {
      return {
        status: "FAILED",
        output: "{}",
        error: state.Error,
        cause: state.Cause,
      };
    } else if (state.Type === "Wait") {
      if (state.End === true)
        return { status: "SUCCEEDED", output: JSON.stringify(currentInput) };
      currentStateName = state.Next!;
    } else {
      if (state.End === true)
        return { status: "SUCCEEDED", output: JSON.stringify(currentInput) };
      if (state.Next !== undefined) {
        currentStateName = state.Next;
      } else {
        return { status: "SUCCEEDED", output: JSON.stringify(currentInput) };
      }
    }
  }

  return {
    status: "FAILED",
    output: "{}",
    error: "States.Runtime",
    cause: "State machine execution exceeded maximum depth",
  };
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

type StoredStateMachineVersion = {
  stateMachineVersionArn: string;
  stateMachineArn: string;
  definition: string;
  roleArn: string;
  description: string | undefined;
  creationDate: number;
};

type StoredStateMachineAlias = {
  stateMachineAliasArn: string;
  stateMachineArn: string;
  name: string;
  description: string | undefined;
  routingConfiguration: { stateMachineVersionArn: string; weight: number }[];
  creationDate: number;
  updateDate: number;
};

type StoredMapRun = {
  mapRunArn: string;
  executionArn: string;
  stateMachineArn: string;
  status: string;
  startDate: number;
  stopDate: number | undefined;
  maxConcurrency: number;
  toleratedFailurePercentage: number;
  toleratedFailureCount: number;
};

const stateMachineKey = (arn: string): string => `stateMachine#${arn}`;

const executionKey = (arn: string): string => `execution#${arn}`;

const activityKey = (arn: string): string => `activity#${arn}`;

const tagsKey = (arn: string): string => `tags#${arn}`;

const versionKey = (arn: string): string => `version#${arn}`;

const aliasKey = (arn: string): string => `alias#${arn}`;

const mapRunKey = (arn: string): string => `mapRun#${arn}`;

const versionCounterKey = (machineArn: string): string =>
  `versionCounter#${machineArn}`;

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

const normalizeMachineArn = (arn: string): string => {
  const idx = arn.lastIndexOf(":");
  if (idx < 0) return arn;
  const suffix = arn.slice(idx + 1);
  return /^\d+$/.test(suffix) ? arn.slice(0, idx) : arn;
};

const requireStateMachineAlias = (
  ctx: ServiceContext,
  arn: string,
): StoredStateMachineAlias => {
  const alias = ctx.store.get<StoredStateMachineAlias>(aliasKey(arn));
  if (alias === undefined) {
    throw awsError(
      "ResourceNotFound",
      `State Machine Alias Does Not Exist: '${arn}'`,
      400,
    );
  }
  return alias;
};

const requireMapRun = (ctx: ServiceContext, arn: string): StoredMapRun => {
  const mr = ctx.store.get<StoredMapRun>(mapRunKey(arn));
  if (mr === undefined) {
    throw awsError("ResourceNotFound", `Map Run Does Not Exist: '${arn}'`, 400);
  }
  return mr;
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
  const result = interpretAsl(machine.definition, inputData);
  const execution: StoredExecution = {
    executionArn: arn,
    stateMachineArn: machine.stateMachineArn,
    name: executionName,
    status: result.status,
    startDate,
    stopDate: startDate,
    input: inputData,
    output: result.status === "SUCCEEDED" ? result.output : undefined,
    error: result.error,
    cause: result.cause,
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
    error: execution.error,
    cause: execution.cause,
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

const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED_OUT"]);

const StopExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "executionArn");
  const execution = requireExecution(ctx, arn);
  if (TERMINAL_STATUSES.has(execution.status)) {
    throw awsError(
      "InvalidParameter",
      `Execution '${arn}' is already in a terminal state.`,
      400,
    );
  }
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

const UpdateStateMachine: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineArn");
  const machine = requireStateMachine(ctx, arn);
  if (typeof input["definition"] === "string" && input["definition"] !== "") {
    machine.definition = input["definition"] as string;
  }
  if (typeof input["roleArn"] === "string" && input["roleArn"] !== "") {
    machine.roleArn = input["roleArn"] as string;
  }
  const updateDate = nowSeconds();
  ctx.store.set(stateMachineKey(arn), machine);
  let stateMachineVersionArn: string | undefined;
  if (input["publish"] === true) {
    const counter = (ctx.store.get<number>(versionCounterKey(arn)) ?? 0) + 1;
    ctx.store.set(versionCounterKey(arn), counter);
    stateMachineVersionArn = `${arn}:${counter}`;
    const version: StoredStateMachineVersion = {
      stateMachineVersionArn,
      stateMachineArn: arn,
      definition: machine.definition,
      roleArn: machine.roleArn,
      description: stringOrUndefined(input["versionDescription"]),
      creationDate: updateDate,
    };
    ctx.store.set(versionKey(stateMachineVersionArn), version);
  }
  return { updateDate, stateMachineVersionArn };
};

const DescribeStateMachineForExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "executionArn");
  const execution = requireExecution(ctx, arn);
  const machine = requireStateMachine(ctx, execution.stateMachineArn);
  return {
    stateMachineArn: machine.stateMachineArn,
    name: machine.name,
    definition: machine.definition,
    roleArn: machine.roleArn,
    updateDate: machine.creationDate,
  };
};

const ValidateStateMachineDefinition: OperationHandler = (input, _ctx) => {
  requireString(input, "definition");
  return { result: "OK", diagnostics: [] };
};

const TestState: OperationHandler = (_input, _ctx) => {
  return { status: "SUCCEEDED" };
};

const PublishStateMachineVersion: OperationHandler = (input, ctx) => {
  const machineArn = requireString(input, "stateMachineArn");
  const machine = requireStateMachine(ctx, machineArn);
  const counter =
    (ctx.store.get<number>(versionCounterKey(machineArn)) ?? 0) + 1;
  ctx.store.set(versionCounterKey(machineArn), counter);
  const stateMachineVersionArn = `${machineArn}:${counter}`;
  const creationDate = nowSeconds();
  const version: StoredStateMachineVersion = {
    stateMachineVersionArn,
    stateMachineArn: machineArn,
    definition: machine.definition,
    roleArn: machine.roleArn,
    description: stringOrUndefined(input["description"]),
    creationDate,
  };
  ctx.store.set(versionKey(stateMachineVersionArn), version);
  return { creationDate, stateMachineVersionArn };
};

const ListStateMachineVersions: OperationHandler = (input, ctx) => {
  const machineArn = requireString(input, "stateMachineArn");
  requireStateMachine(ctx, machineArn);
  const stateMachineVersions = ctx.store
    .list<StoredStateMachineVersion>()
    .filter((entry) => entry.key.startsWith("version#"))
    .map((entry) => entry.value)
    .filter((v) => v.stateMachineArn === machineArn)
    .map((v) => ({
      stateMachineVersionArn: v.stateMachineVersionArn,
      creationDate: v.creationDate,
    }));
  return { stateMachineVersions };
};

const DeleteStateMachineVersion: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineVersionArn");
  ctx.store.delete(versionKey(arn));
  return {};
};

const CreateStateMachineAlias: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const routingConfiguration = input["routingConfiguration"];
  if (
    !Array.isArray(routingConfiguration) ||
    routingConfiguration.length === 0
  ) {
    throw awsError(
      "ValidationException",
      "routingConfiguration is a required field.",
      400,
    );
  }
  const firstItem = routingConfiguration[0] as Record<string, unknown>;
  const firstVersionArn = firstItem["stateMachineVersionArn"];
  if (typeof firstVersionArn !== "string" || firstVersionArn === "") {
    throw awsError(
      "ValidationException",
      "stateMachineVersionArn is a required field.",
      400,
    );
  }
  const machineArn = normalizeMachineArn(firstVersionArn);
  const aliasArn = `${machineArn}:${name}`;
  const existing = ctx.store.get<StoredStateMachineAlias>(aliasKey(aliasArn));
  if (existing !== undefined) {
    throw awsError(
      "StateMachineAlreadyExists",
      `Alias Already Exists: '${aliasArn}'`,
      400,
    );
  }
  const creationDate = nowSeconds();
  const routingConf = (routingConfiguration as Record<string, unknown>[]).map(
    (item) => ({
      stateMachineVersionArn: String(item["stateMachineVersionArn"] ?? ""),
      weight:
        typeof item["weight"] === "number" ? (item["weight"] as number) : 100,
    }),
  );
  const alias: StoredStateMachineAlias = {
    stateMachineAliasArn: aliasArn,
    stateMachineArn: machineArn,
    name,
    description: stringOrUndefined(input["description"]),
    routingConfiguration: routingConf,
    creationDate,
    updateDate: creationDate,
  };
  ctx.store.set(aliasKey(aliasArn), alias);
  return { stateMachineAliasArn: aliasArn, creationDate };
};

const DescribeStateMachineAlias: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineAliasArn");
  const alias = requireStateMachineAlias(ctx, arn);
  return {
    stateMachineAliasArn: alias.stateMachineAliasArn,
    name: alias.name,
    description: alias.description,
    routingConfiguration: alias.routingConfiguration,
    creationDate: alias.creationDate,
    updateDate: alias.updateDate,
  };
};

const UpdateStateMachineAlias: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineAliasArn");
  const alias = requireStateMachineAlias(ctx, arn);
  if (typeof input["description"] === "string") {
    alias.description = input["description"] as string;
  }
  if (Array.isArray(input["routingConfiguration"])) {
    alias.routingConfiguration = (
      input["routingConfiguration"] as Record<string, unknown>[]
    ).map((item) => ({
      stateMachineVersionArn: String(item["stateMachineVersionArn"] ?? ""),
      weight:
        typeof item["weight"] === "number" ? (item["weight"] as number) : 100,
    }));
  }
  const updateDate = nowSeconds();
  alias.updateDate = updateDate;
  ctx.store.set(aliasKey(arn), alias);
  return { updateDate };
};

const DeleteStateMachineAlias: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineAliasArn");
  ctx.store.delete(aliasKey(arn));
  return {};
};

const ListStateMachineAliases: OperationHandler = (input, ctx) => {
  const inputArn = requireString(input, "stateMachineArn");
  const normalizedArn = normalizeMachineArn(inputArn);
  requireStateMachine(ctx, normalizedArn);
  const stateMachineAliases = ctx.store
    .list<StoredStateMachineAlias>()
    .filter((entry) => entry.key.startsWith("alias#"))
    .map((entry) => entry.value)
    .filter((a) => a.stateMachineArn === normalizedArn)
    .map((a) => ({
      stateMachineAliasArn: a.stateMachineAliasArn,
      creationDate: a.creationDate,
    }));
  return { stateMachineAliases };
};

const StartSyncExecution: OperationHandler = (input, ctx) => {
  const machineArn = requireString(input, "stateMachineArn");
  const machine = requireStateMachine(ctx, machineArn);
  const executionName = stringOrUndefined(input["name"]) ?? crypto.randomUUID();
  const machineName = machineNameFromArn(machine.stateMachineArn);
  const arn = executionArnOf(ctx, machineName, executionName);
  const startDate = nowSeconds();
  const stopDate = startDate;
  const inputData = stringOrUndefined(input["input"]) ?? "{}";
  const result = interpretAsl(machine.definition, inputData);
  const execution: StoredExecution = {
    executionArn: arn,
    stateMachineArn: machine.stateMachineArn,
    name: executionName,
    status: result.status,
    startDate,
    stopDate,
    input: inputData,
    output: result.status === "SUCCEEDED" ? result.output : undefined,
    error: result.error,
    cause: result.cause,
  };
  ctx.store.set(executionKey(arn), execution);
  return {
    executionArn: arn,
    stateMachineArn: machine.stateMachineArn,
    name: executionName,
    startDate,
    stopDate,
    status: result.status,
    input: inputData,
    output: result.status === "SUCCEEDED" ? result.output : undefined,
    error: result.error,
    cause: result.cause,
  };
};

const RedriveExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "executionArn");
  requireExecution(ctx, arn);
  return { redriveDate: nowSeconds() };
};

const GetExecutionHistory: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "executionArn");
  const execution = requireExecution(ctx, arn);
  const endType =
    execution.status === "SUCCEEDED"
      ? "ExecutionSucceeded"
      : execution.status === "ABORTED"
        ? "ExecutionAborted"
        : "ExecutionFailed";
  const events = [
    {
      timestamp: execution.startDate,
      type: "ExecutionStarted",
      id: 1,
      previousEventId: 0,
      executionStartedEventDetails: { input: execution.input },
    },
    {
      timestamp: execution.stopDate ?? execution.startDate,
      type: endType,
      id: 2,
      previousEventId: 1,
    },
  ];
  return { events };
};

const GetActivityTask: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "activityArn");
  requireActivity(ctx, arn);
  return {};
};

const SendTaskSuccess: OperationHandler = (_input, _ctx) => {
  return {};
};

const SendTaskFailure: OperationHandler = (_input, _ctx) => {
  return {};
};

const SendTaskHeartbeat: OperationHandler = (_input, _ctx) => {
  return {};
};

const emptyCounters = () => ({
  pending: 0,
  running: 0,
  succeeded: 0,
  failed: 0,
  timedOut: 0,
  aborted: 0,
  total: 0,
  resultsWritten: 0,
});

const DescribeMapRun: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "mapRunArn");
  const mr = requireMapRun(ctx, arn);
  return {
    mapRunArn: mr.mapRunArn,
    executionArn: mr.executionArn,
    status: mr.status,
    startDate: mr.startDate,
    stopDate: mr.stopDate,
    maxConcurrency: mr.maxConcurrency,
    toleratedFailurePercentage: mr.toleratedFailurePercentage,
    toleratedFailureCount: mr.toleratedFailureCount,
    itemCounts: emptyCounters(),
    executionCounts: emptyCounters(),
  };
};

const ListMapRuns: OperationHandler = (input, ctx) => {
  const executionArn = requireString(input, "executionArn");
  requireExecution(ctx, executionArn);
  const mapRuns = ctx.store
    .list<StoredMapRun>()
    .filter((entry) => entry.key.startsWith("mapRun#"))
    .map((entry) => entry.value)
    .filter((mr) => mr.executionArn === executionArn)
    .map((mr) => ({
      executionArn: mr.executionArn,
      mapRunArn: mr.mapRunArn,
      stateMachineArn: mr.stateMachineArn,
      startDate: mr.startDate,
      stopDate: mr.stopDate,
    }));
  return { mapRuns };
};

const UpdateMapRun: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "mapRunArn");
  const mr = requireMapRun(ctx, arn);
  if (typeof input["maxConcurrency"] === "number") {
    mr.maxConcurrency = input["maxConcurrency"] as number;
  }
  if (typeof input["toleratedFailurePercentage"] === "number") {
    mr.toleratedFailurePercentage = input[
      "toleratedFailurePercentage"
    ] as number;
  }
  if (typeof input["toleratedFailureCount"] === "number") {
    mr.toleratedFailureCount = input["toleratedFailureCount"] as number;
  }
  ctx.store.set(mapRunKey(arn), mr);
  return {};
};

const stepFunctions: ServiceDefinition = {
  name: "states",
  protocol: "json",
  operations: {
    CreateStateMachine,
    DeleteStateMachine,
    ListStateMachines,
    DescribeStateMachine,
    UpdateStateMachine,
    DescribeStateMachineForExecution,
    ValidateStateMachineDefinition,
    TestState,
    StartExecution,
    StartSyncExecution,
    DescribeExecution,
    ListExecutions,
    StopExecution,
    RedriveExecution,
    GetExecutionHistory,
    PublishStateMachineVersion,
    ListStateMachineVersions,
    DeleteStateMachineVersion,
    CreateStateMachineAlias,
    DescribeStateMachineAlias,
    UpdateStateMachineAlias,
    DeleteStateMachineAlias,
    ListStateMachineAliases,
    CreateActivity,
    DescribeActivity,
    ListActivities,
    DeleteActivity,
    GetActivityTask,
    SendTaskSuccess,
    SendTaskFailure,
    SendTaskHeartbeat,
    DescribeMapRun,
    ListMapRuns,
    UpdateMapRun,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const;

export default stepFunctions;
