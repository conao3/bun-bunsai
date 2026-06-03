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

const dataCatalogPrefix = "dc:" as const;

const namedQueryPrefix = "nq:" as const;

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

type StoredDataCatalog = {
  Name: string;
  Type: string;
  Description: string;
  Parameters: Record<string, unknown>;
};

type StoredNamedQuery = {
  NamedQueryId: string;
  Name: string;
  Description: string;
  Database: string;
  QueryString: string;
  WorkGroup: string;
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

const dataCatalogView = (
  catalog: StoredDataCatalog,
): Record<string, unknown> => ({
  Name: catalog.Name,
  Type: catalog.Type,
  Description: catalog.Description,
  Parameters: catalog.Parameters,
});

const CreateDataCatalog: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const type = requireString(input, "Type");
  if (
    ctx.store.get<StoredDataCatalog>(`${dataCatalogPrefix}${name}`) !==
    undefined
  ) {
    throw awsError(
      "InvalidRequestException",
      `DataCatalog ${name} already exists`,
      400,
    );
  }
  const catalog: StoredDataCatalog = {
    Name: name,
    Type: type,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : "",
    Parameters: asRecord(input["Parameters"]),
  };
  ctx.store.set(`${dataCatalogPrefix}${name}`, catalog);
  return {};
};

const GetDataCatalog: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const catalog = ctx.store.get<StoredDataCatalog>(
    `${dataCatalogPrefix}${name}`,
  );
  if (catalog === undefined) {
    throw awsError(
      "InvalidRequestException",
      `DataCatalog ${name} was not found`,
      400,
    );
  }
  return { DataCatalog: dataCatalogView(catalog) };
};

const ListDataCatalogs: OperationHandler = (input, ctx) => {
  const summary = ctx.store
    .list<StoredDataCatalog>()
    .filter((entry) => entry.key.startsWith(dataCatalogPrefix))
    .map((entry) => ({
      CatalogName: entry.value.Name,
      Type: entry.value.Type,
    }));
  return { DataCatalogsSummary: summary };
};

const DeleteDataCatalog: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const catalog = ctx.store.get<StoredDataCatalog>(
    `${dataCatalogPrefix}${name}`,
  );
  if (catalog === undefined) {
    throw awsError(
      "InvalidRequestException",
      `DataCatalog ${name} was not found`,
      400,
    );
  }
  ctx.store.delete(`${dataCatalogPrefix}${name}`);
  return {};
};

const namedQueryView = (query: StoredNamedQuery): Record<string, unknown> => ({
  NamedQueryId: query.NamedQueryId,
  Name: query.Name,
  Description: query.Description,
  Database: query.Database,
  QueryString: query.QueryString,
  WorkGroup: query.WorkGroup,
});

const requireNamedQuery = (
  ctx: ServiceContext,
  id: string,
): StoredNamedQuery => {
  const query = ctx.store.get<StoredNamedQuery>(`${namedQueryPrefix}${id}`);
  if (query === undefined) {
    throw awsError(
      "InvalidRequestException",
      `NamedQuery ${id} was not found`,
      400,
    );
  }
  return query;
};

const CreateNamedQuery: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const database = requireString(input, "Database");
  const queryString = requireString(input, "QueryString");
  const id = crypto.randomUUID();
  const query: StoredNamedQuery = {
    NamedQueryId: id,
    Name: name,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : "",
    Database: database,
    QueryString: queryString,
    WorkGroup:
      typeof input["WorkGroup"] === "string"
        ? (input["WorkGroup"] as string)
        : "primary",
  };
  ctx.store.set(`${namedQueryPrefix}${id}`, query);
  return { NamedQueryId: id };
};

const GetNamedQuery: OperationHandler = (input, ctx) => {
  const id = requireString(input, "NamedQueryId");
  const query = requireNamedQuery(ctx, id);
  return { NamedQuery: namedQueryView(query) };
};

const ListNamedQueries: OperationHandler = (input, ctx) => {
  const workGroup =
    typeof input["WorkGroup"] === "string"
      ? (input["WorkGroup"] as string)
      : undefined;
  const ids = ctx.store
    .list<StoredNamedQuery>()
    .filter((entry) => entry.key.startsWith(namedQueryPrefix))
    .filter(
      (entry) => workGroup === undefined || entry.value.WorkGroup === workGroup,
    )
    .map((entry) => entry.value.NamedQueryId);
  return { NamedQueryIds: ids };
};

const DeleteNamedQuery: OperationHandler = (input, ctx) => {
  const id = requireString(input, "NamedQueryId");
  requireNamedQuery(ctx, id);
  ctx.store.delete(`${namedQueryPrefix}${id}`);
  return {};
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
    CreateDataCatalog,
    GetDataCatalog,
    ListDataCatalogs,
    DeleteDataCatalog,
    CreateNamedQuery,
    GetNamedQuery,
    ListNamedQueries,
    DeleteNamedQuery,
  },
  model,
} as const;

export default athena;
