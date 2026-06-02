import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import athenaModel from "../../../../test/vendor/aws-models/athena.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(athenaModel);

const executionPrefix = "qe:" as const;

const workGroupPrefix = "wg:" as const;

type StoredQueryExecution = {
  QueryExecutionId: string;
  Query: string;
  StatementType: string;
  QueryExecutionContext: Record<string, unknown>;
  ResultConfiguration: Record<string, unknown>;
  WorkGroup: string;
  State: string;
  SubmissionDateTime: number;
  CompletionDateTime: number;
};

type StoredWorkGroup = {
  Name: string;
  State: string;
  Description: string;
  Configuration: Record<string, unknown>;
  CreationTime: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidRequestException", `${field} is required.`, 400);
  }
  return value;
};

const requireExecution = (
  ctx: ServiceContext,
  id: string,
): StoredQueryExecution => {
  const execution = ctx.store.get<StoredQueryExecution>(
    `${executionPrefix}${id}`,
  );
  if (execution === undefined) {
    throw awsError(
      "InvalidRequestException",
      `QueryExecution ${id} was not found`,
      400,
    );
  }
  return execution;
};

const queryExecutionView = (
  execution: StoredQueryExecution,
): Record<string, unknown> => ({
  QueryExecutionId: execution.QueryExecutionId,
  Query: execution.Query,
  StatementType: execution.StatementType,
  ResultConfiguration: execution.ResultConfiguration,
  QueryExecutionContext: execution.QueryExecutionContext,
  WorkGroup: execution.WorkGroup,
  Status: {
    State: execution.State,
    SubmissionDateTime: execution.SubmissionDateTime,
    CompletionDateTime: execution.CompletionDateTime,
  },
});

const StartQueryExecution: OperationHandler = (input, ctx) => {
  const query = requireString(input, "QueryString");
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const workGroup =
    typeof input["WorkGroup"] === "string"
      ? (input["WorkGroup"] as string)
      : "primary";
  const execution: StoredQueryExecution = {
    QueryExecutionId: id,
    Query: query,
    StatementType: "DML",
    QueryExecutionContext: asRecord(input["QueryExecutionContext"]),
    ResultConfiguration: asRecord(input["ResultConfiguration"]),
    WorkGroup: workGroup,
    State: "SUCCEEDED",
    SubmissionDateTime: now,
    CompletionDateTime: now,
  };
  ctx.store.set(`${executionPrefix}${id}`, execution);
  return { QueryExecutionId: id };
};

const GetQueryExecution: OperationHandler = (input, ctx) => {
  const id = requireString(input, "QueryExecutionId");
  const execution = requireExecution(ctx, id);
  return { QueryExecution: queryExecutionView(execution) };
};

const StopQueryExecution: OperationHandler = (input, ctx) => {
  const id = requireString(input, "QueryExecutionId");
  const execution = requireExecution(ctx, id);
  const updated: StoredQueryExecution = {
    ...execution,
    State: "CANCELLED",
    CompletionDateTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(`${executionPrefix}${id}`, updated);
  return {};
};

const ListQueryExecutions: OperationHandler = (input, ctx) => {
  const workGroup =
    typeof input["WorkGroup"] === "string"
      ? (input["WorkGroup"] as string)
      : undefined;
  const ids = ctx.store
    .list<StoredQueryExecution>()
    .filter((entry) => entry.key.startsWith(executionPrefix))
    .filter(
      (entry) => workGroup === undefined || entry.value.WorkGroup === workGroup,
    )
    .sort((a, b) => b.value.SubmissionDateTime - a.value.SubmissionDateTime)
    .map((entry) => entry.value.QueryExecutionId);
  return { QueryExecutionIds: ids };
};

const GetQueryResults: OperationHandler = (input, ctx) => {
  const id = requireString(input, "QueryExecutionId");
  requireExecution(ctx, id);
  return {
    UpdateCount: 0,
    ResultSet: {
      Rows: [],
      ResultSetMetadata: { ColumnInfo: [] },
    },
  };
};

const CreateWorkGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (
    ctx.store.get<StoredWorkGroup>(`${workGroupPrefix}${name}`) !== undefined
  ) {
    throw awsError(
      "InvalidRequestException",
      `WorkGroup ${name} already exists`,
      400,
    );
  }
  const workGroup: StoredWorkGroup = {
    Name: name,
    State: "ENABLED",
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : "",
    Configuration: asRecord(input["Configuration"]),
    CreationTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(`${workGroupPrefix}${name}`, workGroup);
  return {};
};

const ListWorkGroups: OperationHandler = (input, ctx) => {
  const workGroups = ctx.store
    .list<StoredWorkGroup>()
    .filter((entry) => entry.key.startsWith(workGroupPrefix))
    .map((entry) => ({
      Name: entry.value.Name,
      State: entry.value.State,
      Description: entry.value.Description,
      CreationTime: entry.value.CreationTime,
    }));
  return { WorkGroups: workGroups };
};

const athena: ServiceDefinition = {
  name: "athena",
  protocol: "json",
  operations: {
    StartQueryExecution,
    GetQueryExecution,
    StopQueryExecution,
    ListQueryExecutions,
    GetQueryResults,
    CreateWorkGroup,
    ListWorkGroups,
  },
  model,
} as const;

export default athena;
