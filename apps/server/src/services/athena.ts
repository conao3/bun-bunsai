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
const preparedStatementPrefix = "ps:" as const;
const notebookPrefix = "nb:" as const;
const sessionPrefix = "sess:" as const;
const calcPrefix = "calc:" as const;
const capacityReservationPrefix = "cr:" as const;
const tagsPrefix = "tags:" as const;
const capacityAssignmentPrefix = "cac:" as const;

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

type StoredPreparedStatement = {
  StatementName: string;
  WorkGroupName: string;
  QueryStatement: string;
  Description: string;
  LastModifiedTime: number;
};

type StoredNotebook = {
  NotebookId: string;
  Name: string;
  WorkGroup: string;
  Type: string;
  CreationTime: number;
  LastModifiedTime: number;
  Payload: string;
};

type StoredSession = {
  SessionId: string;
  Description: string;
  WorkGroup: string;
  EngineConfiguration: Record<string, unknown>;
  State: string;
  StateChangeReason: string;
  CreationTime: number;
};

type StoredCalculationExecution = {
  CalculationExecutionId: string;
  SessionId: string;
  Description: string;
  CodeBlock: string;
  State: string;
  StateChangeReason: string;
  WorkingDirectory: string;
  SubmissionDateTime: number;
  CompletionDateTime: number;
};

type StoredCapacityReservation = {
  Name: string;
  Status: string;
  TargetDpus: number;
  AllocatedDpus: number;
  CreationTime: number;
};

type StoredTag = { Key: string; Value: string };

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const idempotencyKey = (prefix: string, token: string): string =>
  `idp:${prefix}:${token}`;

const paginate = <T>(
  items: T[],
  maxResults: number | undefined,
  nextToken: string | undefined,
): { items: T[]; nextToken: string | undefined } => {
  const start = nextToken !== undefined ? parseInt(atob(nextToken), 10) : 0;
  const limit =
    maxResults !== undefined && maxResults > 0 ? maxResults : items.length;
  const sliced = items.slice(start, start + limit);
  const newNextToken =
    start + limit < items.length ? btoa(String(start + limit)) : undefined;
  return { items: sliced, nextToken: newNextToken };
};

const tagsFromInput = (value: unknown): StoredTag[] =>
  asArray(value).map((t) => {
    const tag = asRecord(t);
    return {
      Key: typeof tag["Key"] === "string" ? (tag["Key"] as string) : "",
      Value: typeof tag["Value"] === "string" ? (tag["Value"] as string) : "",
    };
  });

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

const requireNumber = (
  input: Record<string, unknown>,
  field: string,
): number => {
  const value = input[field];
  if (typeof value !== "number") {
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

const requireNotebook = (ctx: ServiceContext, id: string): StoredNotebook => {
  const nb = ctx.store.get<StoredNotebook>(`${notebookPrefix}${id}`);
  if (nb === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Notebook ${id} was not found`,
      400,
    );
  }
  return nb;
};

const requireSession = (ctx: ServiceContext, id: string): StoredSession => {
  const sess = ctx.store.get<StoredSession>(`${sessionPrefix}${id}`);
  if (sess === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Session ${id} was not found`,
      400,
    );
  }
  return sess;
};

const requireCalculation = (
  ctx: ServiceContext,
  id: string,
): StoredCalculationExecution => {
  const calc = ctx.store.get<StoredCalculationExecution>(`${calcPrefix}${id}`);
  if (calc === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `CalculationExecution ${id} was not found`,
      400,
    );
  }
  return calc;
};

const requireCapacityReservation = (
  ctx: ServiceContext,
  name: string,
): StoredCapacityReservation => {
  const cr = ctx.store.get<StoredCapacityReservation>(
    `${capacityReservationPrefix}${name}`,
  );
  if (cr === undefined) {
    throw awsError(
      "InvalidRequestException",
      `CapacityReservation ${name} was not found`,
      400,
    );
  }
  return cr;
};

const requirePreparedStatement = (
  ctx: ServiceContext,
  workGroup: string,
  name: string,
): StoredPreparedStatement => {
  const ps = ctx.store.get<StoredPreparedStatement>(
    `${preparedStatementPrefix}${workGroup}/${name}`,
  );
  if (ps === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `PreparedStatement ${name} was not found in workgroup ${workGroup}`,
      400,
    );
  }
  return ps;
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
  Statistics: {
    EngineExecutionTimeInMillis: 0,
    DataScannedInBytes: 0,
    TotalExecutionTimeInMillis: 0,
    QueryQueueTimeInMillis: 0,
    ServicePreProcessingTimeInMillis: 0,
    QueryPlanningTimeInMillis: 0,
    ServiceProcessingTimeInMillis: 0,
  },
});

const namedQueryView = (query: StoredNamedQuery): Record<string, unknown> => ({
  NamedQueryId: query.NamedQueryId,
  Name: query.Name,
  Description: query.Description,
  Database: query.Database,
  QueryString: query.QueryString,
  WorkGroup: query.WorkGroup,
});

const preparedStatementView = (
  ps: StoredPreparedStatement,
): Record<string, unknown> => ({
  StatementName: ps.StatementName,
  WorkGroupName: ps.WorkGroupName,
  QueryStatement: ps.QueryStatement,
  Description: ps.Description,
  LastModifiedTime: ps.LastModifiedTime,
});

const dataCatalogView = (
  catalog: StoredDataCatalog,
): Record<string, unknown> => ({
  Name: catalog.Name,
  Type: catalog.Type,
  Description: catalog.Description,
  Parameters: catalog.Parameters,
});

const notebookMetadataView = (nb: StoredNotebook): Record<string, unknown> => ({
  NotebookId: nb.NotebookId,
  Name: nb.Name,
  WorkGroup: nb.WorkGroup,
  Type: nb.Type,
  CreationTime: nb.CreationTime,
  LastModifiedTime: nb.LastModifiedTime,
});

const sessionStatusView = (sess: StoredSession): Record<string, unknown> => ({
  StartDateTime: sess.CreationTime,
  LastModifiedDateTime: sess.CreationTime,
  State: sess.State,
  StateChangeReason: sess.StateChangeReason,
});

const capacityReservationView = (
  cr: StoredCapacityReservation,
): Record<string, unknown> => ({
  Name: cr.Name,
  Status: cr.Status,
  TargetDpus: cr.TargetDpus,
  AllocatedDpus: cr.AllocatedDpus,
  CreationTime: cr.CreationTime,
  LastAllocation: {
    Status: cr.Status === "ACTIVE" ? "SUCCEEDED" : "FAILED",
    StatusMessage: "",
    RequestTime: cr.CreationTime,
    RequestCompletionTime: cr.CreationTime,
  },
});

const calcView = (
  calc: StoredCalculationExecution,
): Record<string, unknown> => ({
  CalculationExecutionId: calc.CalculationExecutionId,
  SessionId: calc.SessionId,
  Description: calc.Description,
  WorkingDirectory: calc.WorkingDirectory,
  Status: {
    SubmissionDateTime: calc.SubmissionDateTime,
    CompletionDateTime: calc.CompletionDateTime,
    State: calc.State,
    StateChangeReason: calc.StateChangeReason,
  },
  Statistics: {
    DpuExecutionInMillis: 0,
    Progress: "100%",
  },
});

const StartQueryExecution: OperationHandler = (input, ctx) => {
  const clientRequestToken = stringOrUndefined(input["ClientRequestToken"]);
  if (clientRequestToken !== undefined) {
    const existingId = ctx.store.get<string>(
      idempotencyKey("qe", clientRequestToken),
    );
    if (existingId !== undefined) {
      return { QueryExecutionId: existingId };
    }
  }
  const query = requireString(input, "QueryString");
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const workGroup =
    typeof input["WorkGroup"] === "string"
      ? (input["WorkGroup"] as string)
      : "primary";
  const wg = ctx.store.get<StoredWorkGroup>(`${workGroupPrefix}${workGroup}`);
  if (wg !== undefined && wg.State === "DISABLED") {
    throw awsError(
      "InvalidRequestException",
      `WorkGroup ${workGroup} is disabled`,
      400,
    );
  }
  const wgConfig = wg !== undefined ? wg.Configuration : {};
  const resultConfig =
    wgConfig["EnforceWorkGroupConfiguration"] === true
      ? asRecord(wgConfig["ResultConfiguration"])
      : asRecord(input["ResultConfiguration"]);
  const execution: StoredQueryExecution = {
    QueryExecutionId: id,
    Query: query,
    StatementType: "DML",
    QueryExecutionContext: asRecord(input["QueryExecutionContext"]),
    ResultConfiguration: resultConfig,
    WorkGroup: workGroup,
    State: "QUEUED",
    SubmissionDateTime: now,
    CompletionDateTime: 0,
  };
  ctx.store.set(`${executionPrefix}${id}`, execution);
  if (clientRequestToken !== undefined) {
    ctx.store.set(idempotencyKey("qe", clientRequestToken), id);
  }
  return { QueryExecutionId: id };
};

const GetQueryExecution: OperationHandler = (input, ctx) => {
  const id = requireString(input, "QueryExecutionId");
  const execution = requireExecution(ctx, id);
  if (execution.State === "QUEUED") {
    const updated: StoredQueryExecution = { ...execution, State: "RUNNING" };
    ctx.store.set(`${executionPrefix}${id}`, updated);
    return { QueryExecution: queryExecutionView(updated) };
  }
  if (execution.State === "RUNNING") {
    const updated: StoredQueryExecution = {
      ...execution,
      State: "SUCCEEDED",
      CompletionDateTime: Math.floor(Date.now() / 1000),
    };
    ctx.store.set(`${executionPrefix}${id}`, updated);
    return { QueryExecution: queryExecutionView(updated) };
  }
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
  const workGroup = stringOrUndefined(input["WorkGroup"]);
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  const nextToken = stringOrUndefined(input["NextToken"]);
  const ids = ctx.store
    .list<StoredQueryExecution>()
    .filter((entry) => entry.key.startsWith(executionPrefix))
    .filter(
      (entry) => workGroup === undefined || entry.value.WorkGroup === workGroup,
    )
    .sort((a, b) => b.value.SubmissionDateTime - a.value.SubmissionDateTime)
    .map((entry) => entry.value.QueryExecutionId);
  const { items, nextToken: next } = paginate(ids, maxResults, nextToken);
  return {
    QueryExecutionIds: items,
    ...(next !== undefined ? { NextToken: next } : {}),
  };
};

const GetQueryResults: OperationHandler = (input, ctx) => {
  const id = requireString(input, "QueryExecutionId");
  requireExecution(ctx, id);
  return {
    UpdateCount: 0,
    ResultSet: {
      Rows: [],
      ResultSetMetadata: {
        ColumnInfo: [
          {
            Name: "_col0",
            Type: "varchar",
            Nullable: "UNKNOWN",
            CaseSensitive: false,
          },
        ],
      },
    },
  };
};

const BatchGetQueryExecution: OperationHandler = (input, ctx) => {
  const ids = asArray(input["QueryExecutionIds"]);
  const QueryExecutions: Record<string, unknown>[] = [];
  const UnprocessedQueryExecutionIds: Record<string, unknown>[] = [];
  for (const rawId of ids) {
    const id = typeof rawId === "string" ? rawId : "";
    const execution = ctx.store.get<StoredQueryExecution>(
      `${executionPrefix}${id}`,
    );
    if (execution !== undefined) {
      QueryExecutions.push(queryExecutionView(execution));
    } else {
      UnprocessedQueryExecutionIds.push({
        QueryExecutionId: id,
        ErrorCode: "InvalidRequestException",
      });
    }
  }
  return { QueryExecutions, UnprocessedQueryExecutionIds };
};

const GetQueryRuntimeStatistics: OperationHandler = (input, ctx) => {
  const id = requireString(input, "QueryExecutionId");
  requireExecution(ctx, id);
  return {
    QueryRuntimeStatistics: {
      Timeline: {
        QueryQueueTimeInMillis: 0,
        QueryPlanningTimeInMillis: 0,
        EngineExecutionTimeInMillis: 0,
        ServiceProcessingTimeInMillis: 0,
        TotalExecutionTimeInMillis: 0,
      },
      Rows: { InputRows: 0, InputBytes: 0, OutputBytes: 0, OutputRows: 0 },
      OutputStage: {
        StageId: 0,
        State: "SUCCEEDED",
        OutputBytes: 0,
        OutputRows: 0,
        InputBytes: 0,
        ExecutionTime: 0,
        SubStages: [],
      },
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
    Configuration: {
      EnforceWorkGroupConfiguration: true,
      PublishCloudWatchMetricsEnabled: false,
      RequesterPaysEnabled: false,
      EngineVersion: {
        SelectedEngineVersion: "AUTO",
        EffectiveEngineVersion: "Athena engine version 3",
      },
      EnableMinimumEncryptionConfiguration: false,
      ...asRecord(input["Configuration"]),
    },
    CreationTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(`${workGroupPrefix}${name}`, workGroup);
  const tags = tagsFromInput(input["Tags"]);
  if (tags.length > 0) {
    const arn = `arn:aws:athena:${ctx.region}:${ctx.account}:workgroup/${name}`;
    ctx.store.set(`${tagsPrefix}${arn}`, tags);
  }
  return {};
};

const GetWorkGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "WorkGroup");
  const wg = ctx.store.get<StoredWorkGroup>(`${workGroupPrefix}${name}`);
  if (wg === undefined) {
    throw awsError(
      "InvalidRequestException",
      `WorkGroup ${name} was not found`,
      400,
    );
  }
  return {
    WorkGroup: {
      Name: wg.Name,
      State: wg.State,
      Description: wg.Description,
      Configuration: wg.Configuration,
      CreationTime: wg.CreationTime,
    },
  };
};

const DeleteWorkGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "WorkGroup");
  if (
    ctx.store.get<StoredWorkGroup>(`${workGroupPrefix}${name}`) === undefined
  ) {
    throw awsError(
      "InvalidRequestException",
      `WorkGroup ${name} was not found`,
      400,
    );
  }
  ctx.store.delete(`${workGroupPrefix}${name}`);
  return {};
};

const UpdateWorkGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "WorkGroup");
  const wg = ctx.store.get<StoredWorkGroup>(`${workGroupPrefix}${name}`);
  if (wg === undefined) {
    throw awsError(
      "InvalidRequestException",
      `WorkGroup ${name} was not found`,
      400,
    );
  }
  const configUpdates = asRecord(input["ConfigurationUpdates"]);
  const existingResultConfig = asRecord(
    asRecord(wg.Configuration)["ResultConfiguration"],
  );
  const resultConfigUpdates = asRecord(
    configUpdates["ResultConfigurationUpdates"],
  );
  const removeOutputLocation =
    resultConfigUpdates["RemoveOutputLocation"] === true;
  const newOutputLocation =
    typeof resultConfigUpdates["OutputLocation"] === "string"
      ? (resultConfigUpdates["OutputLocation"] as string)
      : undefined;
  const updatedResultConfig = removeOutputLocation
    ? { ...existingResultConfig, OutputLocation: undefined }
    : newOutputLocation !== undefined
      ? { ...existingResultConfig, OutputLocation: newOutputLocation }
      : existingResultConfig;
  const updatedConfig: Record<string, unknown> =
    Object.keys(configUpdates).length > 0
      ? {
          ...wg.Configuration,
          ...(configUpdates["EnforceWorkGroupConfiguration"] !== undefined
            ? {
                EnforceWorkGroupConfiguration:
                  configUpdates["EnforceWorkGroupConfiguration"],
              }
            : {}),
          ResultConfiguration: updatedResultConfig,
        }
      : wg.Configuration;
  const updated: StoredWorkGroup = {
    ...wg,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : wg.Description,
    State:
      typeof input["State"] === "string"
        ? (input["State"] as string)
        : wg.State,
    Configuration: updatedConfig,
  };
  ctx.store.set(`${workGroupPrefix}${name}`, updated);
  return {};
};

const ListWorkGroups: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  const nextToken = stringOrUndefined(input["NextToken"]);
  const all = ctx.store
    .list<StoredWorkGroup>()
    .filter((entry) => entry.key.startsWith(workGroupPrefix))
    .map((entry) => ({
      Name: entry.value.Name,
      State: entry.value.State,
      Description: entry.value.Description,
      CreationTime: entry.value.CreationTime,
    }));
  const { items, nextToken: next } = paginate(all, maxResults, nextToken);
  return {
    WorkGroups: items,
    ...(next !== undefined ? { NextToken: next } : {}),
  };
};

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
  const tags = tagsFromInput(input["Tags"]);
  if (tags.length > 0) {
    const arn = `arn:aws:athena:${ctx.region}:${ctx.account}:datacatalog/${name}`;
    ctx.store.set(`${tagsPrefix}${arn}`, tags);
  }
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

const UpdateDataCatalog: OperationHandler = (input, ctx) => {
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
  const updated: StoredDataCatalog = {
    ...catalog,
    Type:
      typeof input["Type"] === "string"
        ? (input["Type"] as string)
        : catalog.Type,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : catalog.Description,
    Parameters:
      input["Parameters"] !== undefined
        ? asRecord(input["Parameters"])
        : catalog.Parameters,
  };
  ctx.store.set(`${dataCatalogPrefix}${name}`, updated);
  return {};
};

const CreateNamedQuery: OperationHandler = (input, ctx) => {
  const clientRequestToken = stringOrUndefined(input["ClientRequestToken"]);
  if (clientRequestToken !== undefined) {
    const existingId = ctx.store.get<string>(
      idempotencyKey("nq", clientRequestToken),
    );
    if (existingId !== undefined) {
      return { NamedQueryId: existingId };
    }
  }
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
  if (clientRequestToken !== undefined) {
    ctx.store.set(idempotencyKey("nq", clientRequestToken), id);
  }
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

const BatchGetNamedQuery: OperationHandler = (input, ctx) => {
  const ids = asArray(input["NamedQueryIds"]);
  const NamedQueries: Record<string, unknown>[] = [];
  const UnprocessedNamedQueryIds: Record<string, unknown>[] = [];
  for (const rawId of ids) {
    const id = typeof rawId === "string" ? rawId : "";
    const query = ctx.store.get<StoredNamedQuery>(`${namedQueryPrefix}${id}`);
    if (query !== undefined) {
      NamedQueries.push(namedQueryView(query));
    } else {
      UnprocessedNamedQueryIds.push({ NamedQueryId: id });
    }
  }
  return { NamedQueries, UnprocessedNamedQueryIds };
};

const UpdateNamedQuery: OperationHandler = (input, ctx) => {
  const id = requireString(input, "NamedQueryId");
  const query = requireNamedQuery(ctx, id);
  const updated: StoredNamedQuery = {
    ...query,
    Name:
      typeof input["Name"] === "string"
        ? (input["Name"] as string)
        : query.Name,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : query.Description,
    QueryString:
      typeof input["QueryString"] === "string"
        ? (input["QueryString"] as string)
        : query.QueryString,
  };
  ctx.store.set(`${namedQueryPrefix}${id}`, updated);
  return {};
};

const CreatePreparedStatement: OperationHandler = (input, ctx) => {
  const name = requireString(input, "StatementName");
  const workGroup = requireString(input, "WorkGroup");
  const queryStatement = requireString(input, "QueryStatement");
  const ps: StoredPreparedStatement = {
    StatementName: name,
    WorkGroupName: workGroup,
    QueryStatement: queryStatement,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : "",
    LastModifiedTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(`${preparedStatementPrefix}${workGroup}/${name}`, ps);
  return {};
};

const GetPreparedStatement: OperationHandler = (input, ctx) => {
  const name = requireString(input, "StatementName");
  const workGroup = requireString(input, "WorkGroup");
  const ps = requirePreparedStatement(ctx, workGroup, name);
  return { PreparedStatement: preparedStatementView(ps) };
};

const ListPreparedStatements: OperationHandler = (input, ctx) => {
  const workGroup = requireString(input, "WorkGroup");
  const statements = ctx.store
    .list<StoredPreparedStatement>()
    .filter((entry) => entry.key.startsWith(preparedStatementPrefix))
    .filter((entry) => entry.value.WorkGroupName === workGroup)
    .map((entry) => ({
      StatementName: entry.value.StatementName,
      LastModifiedTime: entry.value.LastModifiedTime,
    }));
  return { PreparedStatements: statements };
};

const UpdatePreparedStatement: OperationHandler = (input, ctx) => {
  const name = requireString(input, "StatementName");
  const workGroup = requireString(input, "WorkGroup");
  const queryStatement = requireString(input, "QueryStatement");
  const ps = requirePreparedStatement(ctx, workGroup, name);
  const updated: StoredPreparedStatement = {
    ...ps,
    QueryStatement: queryStatement,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : ps.Description,
    LastModifiedTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(`${preparedStatementPrefix}${workGroup}/${name}`, updated);
  return {};
};

const DeletePreparedStatement: OperationHandler = (input, ctx) => {
  const name = requireString(input, "StatementName");
  const workGroup = requireString(input, "WorkGroup");
  requirePreparedStatement(ctx, workGroup, name);
  ctx.store.delete(`${preparedStatementPrefix}${workGroup}/${name}`);
  return {};
};

const BatchGetPreparedStatement: OperationHandler = (input, ctx) => {
  const workGroup = requireString(input, "WorkGroup");
  const names = asArray(input["StatementNames"]);
  const PreparedStatements: Record<string, unknown>[] = [];
  const UnprocessedStatementNames: string[] = [];
  for (const rawName of names) {
    const name = typeof rawName === "string" ? rawName : "";
    const ps = ctx.store.get<StoredPreparedStatement>(
      `${preparedStatementPrefix}${workGroup}/${name}`,
    );
    if (ps !== undefined) {
      PreparedStatements.push(preparedStatementView(ps));
    } else {
      UnprocessedStatementNames.push(name);
    }
  }
  return { PreparedStatements, UnprocessedStatementNames };
};

const CreateNotebook: OperationHandler = (input, ctx) => {
  const workGroup = requireString(input, "WorkGroup");
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const nb: StoredNotebook = {
    NotebookId: id,
    Name: name,
    WorkGroup: workGroup,
    Type:
      typeof input["Type"] === "string" ? (input["Type"] as string) : "IPYNB",
    CreationTime: now,
    LastModifiedTime: now,
    Payload: "",
  };
  ctx.store.set(`${notebookPrefix}${id}`, nb);
  return { NotebookId: id };
};

const DeleteNotebook: OperationHandler = (input, ctx) => {
  const id = requireString(input, "NotebookId");
  requireNotebook(ctx, id);
  ctx.store.delete(`${notebookPrefix}${id}`);
  return {};
};

const ExportNotebook: OperationHandler = (input, ctx) => {
  const id = requireString(input, "NotebookId");
  const nb = requireNotebook(ctx, id);
  return {
    NotebookMetadata: notebookMetadataView(nb),
    Payload: nb.Payload,
  };
};

const ImportNotebook: OperationHandler = (input, ctx) => {
  const workGroup = requireString(input, "WorkGroup");
  const name = requireString(input, "Name");
  const payload = requireString(input, "Payload");
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const nb: StoredNotebook = {
    NotebookId: id,
    Name: name,
    WorkGroup: workGroup,
    Type:
      typeof input["Type"] === "string" ? (input["Type"] as string) : "IPYNB",
    CreationTime: now,
    LastModifiedTime: now,
    Payload: payload,
  };
  ctx.store.set(`${notebookPrefix}${id}`, nb);
  return { NotebookId: id };
};

const GetNotebookMetadata: OperationHandler = (input, ctx) => {
  const id = requireString(input, "NotebookId");
  const nb = requireNotebook(ctx, id);
  return { NotebookMetadata: notebookMetadataView(nb) };
};

const ListNotebookMetadata: OperationHandler = (input, ctx) => {
  const workGroup = requireString(input, "WorkGroup");
  const notebooks = ctx.store
    .list<StoredNotebook>()
    .filter((entry) => entry.key.startsWith(notebookPrefix))
    .filter((entry) => entry.value.WorkGroup === workGroup)
    .map((entry) => notebookMetadataView(entry.value));
  return { NotebookMetadataList: notebooks };
};

const UpdateNotebook: OperationHandler = (input, ctx) => {
  const id = requireString(input, "NotebookId");
  const payload = requireString(input, "Payload");
  const nb = requireNotebook(ctx, id);
  const updated: StoredNotebook = {
    ...nb,
    Payload: payload,
    Type:
      typeof input["Type"] === "string" ? (input["Type"] as string) : nb.Type,
    LastModifiedTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(`${notebookPrefix}${id}`, updated);
  return {};
};

const UpdateNotebookMetadata: OperationHandler = (input, ctx) => {
  const id = requireString(input, "NotebookId");
  const name = requireString(input, "Name");
  const nb = requireNotebook(ctx, id);
  const updated: StoredNotebook = {
    ...nb,
    Name: name,
    LastModifiedTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(`${notebookPrefix}${id}`, updated);
  return {};
};

const CreatePresignedNotebookUrl: OperationHandler = (input, ctx) => {
  const sessionId = requireString(input, "SessionId");
  requireSession(ctx, sessionId);
  return {
    NotebookUrl: `http://localhost/notebook/${sessionId}`,
    AuthToken: `token-${sessionId}`,
    AuthTokenExpirationTime: Math.floor(Date.now() / 1000) + 3600,
  };
};

const ListNotebookSessions: OperationHandler = (input, ctx) => {
  const notebookId = requireString(input, "NotebookId");
  requireNotebook(ctx, notebookId);
  const sessions = ctx.store
    .list<StoredSession>()
    .filter((entry) => entry.key.startsWith(sessionPrefix))
    .map((entry) => ({
      SessionId: entry.value.SessionId,
      CreationTime: entry.value.CreationTime,
      ModifiedTime: entry.value.CreationTime,
      Status: {
        State: entry.value.State,
        StateChangeReason: entry.value.StateChangeReason,
      },
    }));
  return { NotebookSessionsList: sessions };
};

const StartSession: OperationHandler = (input, ctx) => {
  const clientRequestToken = stringOrUndefined(input["ClientRequestToken"]);
  if (clientRequestToken !== undefined) {
    const existingId = ctx.store.get<string>(
      idempotencyKey("sess", clientRequestToken),
    );
    if (existingId !== undefined) {
      const existing = ctx.store.get<StoredSession>(
        `${sessionPrefix}${existingId}`,
      );
      if (existing !== undefined) {
        return { SessionId: existing.SessionId, State: existing.State };
      }
    }
  }
  const workGroup = requireString(input, "WorkGroup");
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const sess: StoredSession = {
    SessionId: id,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : "",
    WorkGroup: workGroup,
    EngineConfiguration: asRecord(input["EngineConfiguration"]),
    State: "IDLE",
    StateChangeReason: "",
    CreationTime: now,
  };
  ctx.store.set(`${sessionPrefix}${id}`, sess);
  const tags = tagsFromInput(input["Tags"]);
  if (tags.length > 0) {
    const arn = `arn:aws:athena:${ctx.region}:${ctx.account}:session/${id}`;
    ctx.store.set(`${tagsPrefix}${arn}`, tags);
  }
  if (clientRequestToken !== undefined) {
    ctx.store.set(idempotencyKey("sess", clientRequestToken), id);
  }
  return { SessionId: id, State: "IDLE" };
};

const GetSession: OperationHandler = (input, ctx) => {
  const id = requireString(input, "SessionId");
  const sess = requireSession(ctx, id);
  return {
    SessionId: sess.SessionId,
    Description: sess.Description,
    WorkGroup: sess.WorkGroup,
    EngineConfiguration: sess.EngineConfiguration,
    Status: sessionStatusView(sess),
  };
};

const GetSessionEndpoint: OperationHandler = (input, ctx) => {
  const id = requireString(input, "SessionId");
  requireSession(ctx, id);
  return {
    LiveViewEndpoint: `http://localhost/session/${id}`,
  };
};

const GetSessionStatus: OperationHandler = (input, ctx) => {
  const id = requireString(input, "SessionId");
  const sess = requireSession(ctx, id);
  return {
    SessionId: id,
    Status: sessionStatusView(sess),
  };
};

const ListSessions: OperationHandler = (input, ctx) => {
  const workGroup = requireString(input, "WorkGroup");
  const stateFilter = stringOrUndefined(input["StateFilter"]);
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  const nextToken = stringOrUndefined(input["NextToken"]);
  const all = ctx.store
    .list<StoredSession>()
    .filter((entry) => entry.key.startsWith(sessionPrefix))
    .filter((entry) => entry.value.WorkGroup === workGroup)
    .filter(
      (entry) => stateFilter === undefined || entry.value.State === stateFilter,
    )
    .map((entry) => ({
      SessionId: entry.value.SessionId,
      Description: entry.value.Description,
      EngineConfiguration: entry.value.EngineConfiguration,
      Status: sessionStatusView(entry.value),
    }));
  const { items, nextToken: next } = paginate(all, maxResults, nextToken);
  return {
    Sessions: items,
    ...(next !== undefined ? { NextToken: next } : {}),
  };
};

const TerminateSession: OperationHandler = (input, ctx) => {
  const id = requireString(input, "SessionId");
  const sess = requireSession(ctx, id);
  const updated: StoredSession = {
    ...sess,
    State: "TERMINATED",
  };
  ctx.store.set(`${sessionPrefix}${id}`, updated);
  return { State: "TERMINATED" };
};

const StartCalculationExecution: OperationHandler = (input, ctx) => {
  const sessionId = requireString(input, "SessionId");
  requireSession(ctx, sessionId);
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const calc: StoredCalculationExecution = {
    CalculationExecutionId: id,
    SessionId: sessionId,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : "",
    CodeBlock:
      typeof input["CodeBlock"] === "string"
        ? (input["CodeBlock"] as string)
        : "",
    State: "COMPLETED",
    StateChangeReason: "",
    WorkingDirectory: `s3://bunsai-calc/${id}/`,
    SubmissionDateTime: now,
    CompletionDateTime: now,
  };
  ctx.store.set(`${calcPrefix}${id}`, calc);
  return { CalculationExecutionId: id, State: "COMPLETED" };
};

const GetCalculationExecution: OperationHandler = (input, ctx) => {
  const id = requireString(input, "CalculationExecutionId");
  const calc = requireCalculation(ctx, id);
  return calcView(calc);
};

const GetCalculationExecutionCode: OperationHandler = (input, ctx) => {
  const id = requireString(input, "CalculationExecutionId");
  const calc = requireCalculation(ctx, id);
  return { CodeBlock: calc.CodeBlock };
};

const GetCalculationExecutionStatus: OperationHandler = (input, ctx) => {
  const id = requireString(input, "CalculationExecutionId");
  const calc = requireCalculation(ctx, id);
  return {
    Status: {
      SubmissionDateTime: calc.SubmissionDateTime,
      CompletionDateTime: calc.CompletionDateTime,
      State: calc.State,
      StateChangeReason: calc.StateChangeReason,
    },
    Statistics: {
      DpuExecutionInMillis: 0,
      Progress: "100%",
    },
  };
};

const StopCalculationExecution: OperationHandler = (input, ctx) => {
  const id = requireString(input, "CalculationExecutionId");
  const calc = requireCalculation(ctx, id);
  const updated: StoredCalculationExecution = {
    ...calc,
    State: "CANCELED",
    CompletionDateTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(`${calcPrefix}${id}`, updated);
  return { State: "CANCELED" };
};

const ListCalculationExecutions: OperationHandler = (input, ctx) => {
  const sessionId = requireString(input, "SessionId");
  requireSession(ctx, sessionId);
  const calculations = ctx.store
    .list<StoredCalculationExecution>()
    .filter((entry) => entry.key.startsWith(calcPrefix))
    .filter((entry) => entry.value.SessionId === sessionId)
    .map((entry) => ({
      CalculationExecutionId: entry.value.CalculationExecutionId,
      Description: entry.value.Description,
      WorkingDirectory: entry.value.WorkingDirectory,
      Status: {
        SubmissionDateTime: entry.value.SubmissionDateTime,
        CompletionDateTime: entry.value.CompletionDateTime,
        State: entry.value.State,
        StateChangeReason: entry.value.StateChangeReason,
      },
      Statistics: {
        DpuExecutionInMillis: 0,
        Progress: "100%",
      },
    }));
  return { Calculations: calculations };
};

const CreateCapacityReservation: OperationHandler = (input, ctx) => {
  const clientRequestToken = stringOrUndefined(input["ClientRequestToken"]);
  if (clientRequestToken !== undefined) {
    const existingName = ctx.store.get<string>(
      idempotencyKey("cr", clientRequestToken),
    );
    if (existingName !== undefined) {
      return {};
    }
  }
  const name = requireString(input, "Name");
  const targetDpus = requireNumber(input, "TargetDpus");
  if (
    ctx.store.get<StoredCapacityReservation>(
      `${capacityReservationPrefix}${name}`,
    ) !== undefined
  ) {
    throw awsError(
      "InvalidRequestException",
      `CapacityReservation ${name} already exists`,
      400,
    );
  }
  const cr: StoredCapacityReservation = {
    Name: name,
    Status: "ACTIVE",
    TargetDpus: targetDpus,
    AllocatedDpus: targetDpus,
    CreationTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(`${capacityReservationPrefix}${name}`, cr);
  const tags = tagsFromInput(input["Tags"]);
  if (tags.length > 0) {
    const arn = `arn:aws:athena:${ctx.region}:${ctx.account}:capacity-reservation/${name}`;
    ctx.store.set(`${tagsPrefix}${arn}`, tags);
  }
  if (clientRequestToken !== undefined) {
    ctx.store.set(idempotencyKey("cr", clientRequestToken), name);
  }
  return {};
};

const GetCapacityReservation: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const cr = requireCapacityReservation(ctx, name);
  return { CapacityReservation: capacityReservationView(cr) };
};

const DeleteCapacityReservation: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  requireCapacityReservation(ctx, name);
  ctx.store.delete(`${capacityReservationPrefix}${name}`);
  return {};
};

const CancelCapacityReservation: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const cr = requireCapacityReservation(ctx, name);
  const updated: StoredCapacityReservation = {
    ...cr,
    Status: "CANCELLED",
    AllocatedDpus: 0,
  };
  ctx.store.set(`${capacityReservationPrefix}${name}`, updated);
  return {};
};

const ListCapacityReservations: OperationHandler = (_input, ctx) => {
  const reservations = ctx.store
    .list<StoredCapacityReservation>()
    .filter((entry) => entry.key.startsWith(capacityReservationPrefix))
    .map((entry) => capacityReservationView(entry.value));
  return { CapacityReservations: reservations };
};

const UpdateCapacityReservation: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const targetDpus = requireNumber(input, "TargetDpus");
  const cr = requireCapacityReservation(ctx, name);
  const updated: StoredCapacityReservation = {
    ...cr,
    TargetDpus: targetDpus,
    AllocatedDpus: targetDpus,
  };
  ctx.store.set(`${capacityReservationPrefix}${name}`, updated);
  return {};
};

const GetCapacityAssignmentConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CapacityReservationName");
  requireCapacityReservation(ctx, name);
  const config = ctx.store.get<{
    CapacityAssignments: Array<{ WorkGroupNames: string[] }>;
  }>(`${capacityAssignmentPrefix}${name}`) ?? { CapacityAssignments: [] };
  return {
    CapacityAssignmentConfiguration: {
      CapacityReservationName: name,
      CapacityAssignments: config.CapacityAssignments,
    },
  };
};

const PutCapacityAssignmentConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CapacityReservationName");
  requireCapacityReservation(ctx, name);
  const assignments = asArray(input["CapacityAssignments"]).map((a) => ({
    WorkGroupNames: asArray(asRecord(a)["WorkGroupNames"]).filter(
      (w) => typeof w === "string",
    ) as string[],
  }));
  ctx.store.set(`${capacityAssignmentPrefix}${name}`, {
    CapacityAssignments: assignments,
  });
  return {};
};

const GetDatabase: OperationHandler = (input, _ctx) => {
  const catalogName = requireString(input, "CatalogName");
  const databaseName = requireString(input, "DatabaseName");
  return {
    Database: {
      Name: databaseName,
      Description: `Database ${databaseName} in catalog ${catalogName}`,
      Parameters: {},
    },
  };
};

const ListDatabases: OperationHandler = (input, _ctx) => {
  requireString(input, "CatalogName");
  return {
    DatabaseList: [
      { Name: "default", Description: "Default database" },
      { Name: "information_schema", Description: "Information schema" },
    ],
  };
};

const GetTableMetadata: OperationHandler = (input, _ctx) => {
  requireString(input, "CatalogName");
  requireString(input, "DatabaseName");
  const tableName = requireString(input, "TableName");
  return {
    TableMetadata: {
      Name: tableName,
      TableType: "EXTERNAL_TABLE",
      Columns: [],
      PartitionKeys: [],
      Parameters: {},
    },
  };
};

const ListTableMetadata: OperationHandler = (input, _ctx) => {
  requireString(input, "CatalogName");
  requireString(input, "DatabaseName");
  return { TableMetadataList: [] };
};

const ListEngineVersions: OperationHandler = (_input, _ctx) => ({
  EngineVersions: [
    {
      SelectedEngineVersion: "AUTO",
      EffectiveEngineVersion: "Athena engine version 3",
    },
  ],
});

const ListApplicationDPUSizes: OperationHandler = (_input, _ctx) => ({
  ApplicationDPUSizes: [
    { ApplicationRuntimeId: "PySpark", SupportedDPUSizes: [2, 4, 8] },
  ],
});

const ListExecutors: OperationHandler = (_input, _ctx) => ({
  Executors: [],
});

const GetResourceDashboard: OperationHandler = (_input, _ctx) => ({
  Url: "http://localhost/dashboard",
});

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const newTags = asArray(input["Tags"]).map((t) => {
    const tag = asRecord(t);
    return {
      Key: typeof tag["Key"] === "string" ? (tag["Key"] as string) : "",
      Value: typeof tag["Value"] === "string" ? (tag["Value"] as string) : "",
    };
  });
  const existing = ctx.store.get<StoredTag[]>(`${tagsPrefix}${arn}`) ?? [];
  const newKeys = new Set(newTags.map((t) => t.Key));
  const merged = [...existing.filter((t) => !newKeys.has(t.Key)), ...newTags];
  ctx.store.set(`${tagsPrefix}${arn}`, merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const keys = new Set(
    asArray(input["TagKeys"]).filter((k) => typeof k === "string") as string[],
  );
  const existing = ctx.store.get<StoredTag[]>(`${tagsPrefix}${arn}`) ?? [];
  ctx.store.set(
    `${tagsPrefix}${arn}`,
    existing.filter((t) => !keys.has(t.Key)),
  );
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const tags = ctx.store.get<StoredTag[]>(`${tagsPrefix}${arn}`) ?? [];
  return { Tags: tags };
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
    BatchGetQueryExecution,
    GetQueryRuntimeStatistics,
    CreateWorkGroup,
    GetWorkGroup,
    DeleteWorkGroup,
    UpdateWorkGroup,
    ListWorkGroups,
    CreateDataCatalog,
    GetDataCatalog,
    ListDataCatalogs,
    DeleteDataCatalog,
    UpdateDataCatalog,
    CreateNamedQuery,
    GetNamedQuery,
    ListNamedQueries,
    DeleteNamedQuery,
    BatchGetNamedQuery,
    UpdateNamedQuery,
    CreatePreparedStatement,
    GetPreparedStatement,
    ListPreparedStatements,
    UpdatePreparedStatement,
    DeletePreparedStatement,
    BatchGetPreparedStatement,
    CreateNotebook,
    DeleteNotebook,
    ExportNotebook,
    ImportNotebook,
    GetNotebookMetadata,
    ListNotebookMetadata,
    UpdateNotebook,
    UpdateNotebookMetadata,
    CreatePresignedNotebookUrl,
    ListNotebookSessions,
    StartSession,
    GetSession,
    GetSessionEndpoint,
    GetSessionStatus,
    ListSessions,
    TerminateSession,
    StartCalculationExecution,
    GetCalculationExecution,
    GetCalculationExecutionCode,
    GetCalculationExecutionStatus,
    StopCalculationExecution,
    ListCalculationExecutions,
    CreateCapacityReservation,
    GetCapacityReservation,
    DeleteCapacityReservation,
    CancelCapacityReservation,
    ListCapacityReservations,
    UpdateCapacityReservation,
    GetCapacityAssignmentConfiguration,
    PutCapacityAssignmentConfiguration,
    GetDatabase,
    ListDatabases,
    GetTableMetadata,
    ListTableMetadata,
    ListEngineVersions,
    ListApplicationDPUSizes,
    ListExecutors,
    GetResourceDashboard,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const;

export default athena;
