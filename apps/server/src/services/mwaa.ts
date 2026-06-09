import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import mwaaModel from "../../../../test/vendor/aws-models/mwaa.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(mwaaModel);

const environmentPrefix = "environment:" as const;
const tagsPrefix = "tags:" as const;

type StoredEnvironment = {
  Name: string;
  Arn: string;
  Status: string;
  CreatedAt: number;
  ExecutionRoleArn: string;
  ServiceRoleArn: string;
  SourceBucketArn: string;
  DagS3Path: string;
  WebserverUrl: string;
  EnvironmentClass: string;
  AirflowVersion: string;
  WebserverAccessMode: string;
  EndpointManagement: string;
  MaxWorkers: number;
  MinWorkers: number;
  Schedulers: number;
  WeeklyMaintenanceWindowStart: string;
  NetworkConfiguration: Record<string, unknown>;
  AirflowConfigurationOptions?: Record<string, string>;
  KmsKey?: string;
  LoggingConfiguration?: Record<string, unknown>;
  PluginsS3ObjectVersion?: string;
  PluginsS3Path?: string;
  RequirementsS3ObjectVersion?: string;
  RequirementsS3Path?: string;
  StartupScriptS3ObjectVersion?: string;
  StartupScriptS3Path?: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const stringMapFrom = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  const record = asRecord(value);
  if (record === undefined) return out;
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const environmentKey = (name: string): string => `${environmentPrefix}${name}`;
const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const environmentArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:airflow:${ctx.region}:${ctx.account}:environment/${name}`;

const environmentView = (
  environment: StoredEnvironment,
  ctx: ServiceContext,
): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    Name: environment.Name,
    Arn: environment.Arn,
    Status: environment.Status,
    CreatedAt: environment.CreatedAt,
    ExecutionRoleArn: environment.ExecutionRoleArn,
    ServiceRoleArn: environment.ServiceRoleArn,
    SourceBucketArn: environment.SourceBucketArn,
    DagS3Path: environment.DagS3Path,
    WebserverUrl: environment.WebserverUrl,
    EnvironmentClass: environment.EnvironmentClass,
    AirflowVersion: environment.AirflowVersion,
    WebserverAccessMode: environment.WebserverAccessMode,
    EndpointManagement: environment.EndpointManagement,
    MaxWorkers: environment.MaxWorkers,
    MinWorkers: environment.MinWorkers,
    Schedulers: environment.Schedulers,
    WeeklyMaintenanceWindowStart: environment.WeeklyMaintenanceWindowStart,
    NetworkConfiguration: environment.NetworkConfiguration,
    Tags: ctx.store.get<Record<string, string>>(tagsKey(environment.Arn)) ?? {},
  };
  if (environment.AirflowConfigurationOptions !== undefined)
    view.AirflowConfigurationOptions = environment.AirflowConfigurationOptions;
  if (environment.KmsKey !== undefined) view.KmsKey = environment.KmsKey;
  if (environment.LoggingConfiguration !== undefined)
    view.LoggingConfiguration = environment.LoggingConfiguration;
  if (environment.PluginsS3ObjectVersion !== undefined)
    view.PluginsS3ObjectVersion = environment.PluginsS3ObjectVersion;
  if (environment.PluginsS3Path !== undefined)
    view.PluginsS3Path = environment.PluginsS3Path;
  if (environment.RequirementsS3ObjectVersion !== undefined)
    view.RequirementsS3ObjectVersion = environment.RequirementsS3ObjectVersion;
  if (environment.RequirementsS3Path !== undefined)
    view.RequirementsS3Path = environment.RequirementsS3Path;
  if (environment.StartupScriptS3ObjectVersion !== undefined)
    view.StartupScriptS3ObjectVersion =
      environment.StartupScriptS3ObjectVersion;
  if (environment.StartupScriptS3Path !== undefined)
    view.StartupScriptS3Path = environment.StartupScriptS3Path;
  return view;
};

const requireEnvironment = (
  ctx: ServiceContext,
  name: string,
): StoredEnvironment => {
  const stored = ctx.store.get<StoredEnvironment>(environmentKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Environment ${name} not found.`,
      404,
    );
  }
  return stored;
};

const applyOptionalFields = (
  target: StoredEnvironment,
  input: Record<string, unknown>,
): void => {
  if (asRecord(input["AirflowConfigurationOptions"]) !== undefined)
    target.AirflowConfigurationOptions = stringMapFrom(
      input["AirflowConfigurationOptions"],
    );
  const kmsKey = stringOrUndefined(input["KmsKey"]);
  if (kmsKey !== undefined) target.KmsKey = kmsKey;
  const loggingConfiguration = asRecord(input["LoggingConfiguration"]);
  if (loggingConfiguration !== undefined)
    target.LoggingConfiguration = loggingConfiguration;
  const pluginsS3ObjectVersion = stringOrUndefined(
    input["PluginsS3ObjectVersion"],
  );
  if (pluginsS3ObjectVersion !== undefined)
    target.PluginsS3ObjectVersion = pluginsS3ObjectVersion;
  const pluginsS3Path = stringOrUndefined(input["PluginsS3Path"]);
  if (pluginsS3Path !== undefined) target.PluginsS3Path = pluginsS3Path;
  const requirementsS3ObjectVersion = stringOrUndefined(
    input["RequirementsS3ObjectVersion"],
  );
  if (requirementsS3ObjectVersion !== undefined)
    target.RequirementsS3ObjectVersion = requirementsS3ObjectVersion;
  const requirementsS3Path = stringOrUndefined(input["RequirementsS3Path"]);
  if (requirementsS3Path !== undefined)
    target.RequirementsS3Path = requirementsS3Path;
  const startupScriptS3ObjectVersion = stringOrUndefined(
    input["StartupScriptS3ObjectVersion"],
  );
  if (startupScriptS3ObjectVersion !== undefined)
    target.StartupScriptS3ObjectVersion = startupScriptS3ObjectVersion;
  const startupScriptS3Path = stringOrUndefined(input["StartupScriptS3Path"]);
  if (startupScriptS3Path !== undefined)
    target.StartupScriptS3Path = startupScriptS3Path;
};

const CreateEnvironment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const executionRoleArn = requireString(input, "ExecutionRoleArn");
  const sourceBucketArn = requireString(input, "SourceBucketArn");
  const dagS3Path = requireString(input, "DagS3Path");
  const network = asRecord(input["NetworkConfiguration"]);
  if (network === undefined) {
    throw awsError(
      "ValidationException",
      "NetworkConfiguration is required.",
      400,
    );
  }
  if (ctx.store.get<StoredEnvironment>(environmentKey(name)) !== undefined) {
    throw awsError(
      "ValidationException",
      `Environment ${name} already exists.`,
      400,
    );
  }
  const arn = environmentArn(ctx, name);
  const environment: StoredEnvironment = {
    Name: name,
    Arn: arn,
    Status: "AVAILABLE",
    CreatedAt: nowSeconds(),
    ExecutionRoleArn: executionRoleArn,
    ServiceRoleArn: `arn:aws:iam::${ctx.account}:role/aws-service-role/airflow.amazonaws.com/AWSServiceRoleForAmazonMWAA`,
    SourceBucketArn: sourceBucketArn,
    DagS3Path: dagS3Path,
    WebserverUrl: `${name}.${ctx.region}.airflow.amazonaws.com`,
    EnvironmentClass:
      stringOrUndefined(input["EnvironmentClass"]) ?? "mw1.small",
    AirflowVersion: stringOrUndefined(input["AirflowVersion"]) ?? "2.10.3",
    WebserverAccessMode:
      stringOrUndefined(input["WebserverAccessMode"]) ?? "PRIVATE_ONLY",
    EndpointManagement:
      stringOrUndefined(input["EndpointManagement"]) ?? "SERVICE",
    MaxWorkers: numberOr(input["MaxWorkers"], 10),
    MinWorkers: numberOr(input["MinWorkers"], 1),
    Schedulers: numberOr(input["Schedulers"], 2),
    WeeklyMaintenanceWindowStart:
      stringOrUndefined(input["WeeklyMaintenanceWindowStart"]) ?? "TUE:03:30",
    NetworkConfiguration: {
      SubnetIds: Array.isArray(network["SubnetIds"])
        ? (network["SubnetIds"] as unknown[])
        : [],
      SecurityGroupIds: Array.isArray(network["SecurityGroupIds"])
        ? (network["SecurityGroupIds"] as unknown[])
        : [],
    },
  };
  applyOptionalFields(environment, input);
  ctx.store.set(environmentKey(name), environment);
  ctx.store.set(tagsKey(arn), stringMapFrom(input["Tags"]));
  return { Arn: arn };
};

const GetEnvironment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  return { Environment: environmentView(requireEnvironment(ctx, name), ctx) };
};

const ListEnvironments: OperationHandler = (input, ctx) => {
  const maxResults = numberOr(input["MaxResults"], 25);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const allNames = ctx.store
    .list<StoredEnvironment>()
    .filter((entry) => entry.key.startsWith(environmentPrefix))
    .map((entry) => entry.value.Name)
    .sort((a, b) => a.localeCompare(b));
  const startIdx = nextToken !== undefined ? allNames.indexOf(nextToken) : 0;
  const start = startIdx < 0 ? 0 : startIdx;
  const page = allNames.slice(start, start + maxResults);
  const newNextToken =
    start + maxResults < allNames.length
      ? allNames[start + maxResults]
      : undefined;
  const result: Record<string, unknown> = { Environments: page };
  if (newNextToken !== undefined) result.NextToken = newNextToken;
  return result;
};

const DeleteEnvironment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const environment = requireEnvironment(ctx, name);
  ctx.store.delete(tagsKey(environment.Arn));
  ctx.store.delete(environmentKey(name));
  return {};
};

const UpdateEnvironment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const environment = requireEnvironment(ctx, name);
  const updated: StoredEnvironment = { ...environment };
  const executionRoleArn = stringOrUndefined(input["ExecutionRoleArn"]);
  if (executionRoleArn !== undefined)
    updated.ExecutionRoleArn = executionRoleArn;
  const airflowVersion = stringOrUndefined(input["AirflowVersion"]);
  if (airflowVersion !== undefined) updated.AirflowVersion = airflowVersion;
  const dagS3Path = stringOrUndefined(input["DagS3Path"]);
  if (dagS3Path !== undefined) updated.DagS3Path = dagS3Path;
  const environmentClass = stringOrUndefined(input["EnvironmentClass"]);
  if (environmentClass !== undefined)
    updated.EnvironmentClass = environmentClass;
  const maxWorkers = input["MaxWorkers"];
  if (typeof maxWorkers === "number" && Number.isFinite(maxWorkers))
    updated.MaxWorkers = maxWorkers;
  const minWorkers = input["MinWorkers"];
  if (typeof minWorkers === "number" && Number.isFinite(minWorkers))
    updated.MinWorkers = minWorkers;
  const schedulers = input["Schedulers"];
  if (typeof schedulers === "number" && Number.isFinite(schedulers))
    updated.Schedulers = schedulers;
  const sourceBucketArn = stringOrUndefined(input["SourceBucketArn"]);
  if (sourceBucketArn !== undefined) updated.SourceBucketArn = sourceBucketArn;
  const webserverAccessMode = stringOrUndefined(input["WebserverAccessMode"]);
  if (webserverAccessMode !== undefined)
    updated.WebserverAccessMode = webserverAccessMode;
  const weeklyMaintenanceWindowStart = stringOrUndefined(
    input["WeeklyMaintenanceWindowStart"],
  );
  if (weeklyMaintenanceWindowStart !== undefined)
    updated.WeeklyMaintenanceWindowStart = weeklyMaintenanceWindowStart;
  const network = asRecord(input["NetworkConfiguration"]);
  if (network !== undefined) {
    updated.NetworkConfiguration = {
      SubnetIds: Array.isArray(network["SubnetIds"])
        ? (network["SubnetIds"] as unknown[])
        : environment.NetworkConfiguration["SubnetIds"],
      SecurityGroupIds: Array.isArray(network["SecurityGroupIds"])
        ? (network["SecurityGroupIds"] as unknown[])
        : environment.NetworkConfiguration["SecurityGroupIds"],
    };
  }
  applyOptionalFields(updated, input);
  ctx.store.set(environmentKey(name), updated);
  return { Arn: updated.Arn };
};

const CreateCliToken: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const environment = requireEnvironment(ctx, name);
  return {
    CliToken: "dummy-cli-token",
    WebServerHostname: environment.WebserverUrl,
  };
};

const CreateWebLoginToken: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const environment = requireEnvironment(ctx, name);
  return {
    WebToken: "dummy-web-login-token",
    WebServerHostname: environment.WebserverUrl,
    IamIdentity: "assumed-role/Admin/test",
    AirflowIdentity: "admin",
  };
};

const InvokeRestApi: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  requireEnvironment(ctx, name);
  return {
    RestApiStatusCode: 200,
    RestApiResponse: {},
  };
};

const PublishMetrics: OperationHandler = (_input, _ctx) => {
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const key = tagsKey(arn);
  const existing = ctx.store.get<Record<string, string>>(key) ?? {};
  const tags = { ...existing };
  const incoming = asRecord(input["Tags"]);
  if (incoming !== undefined) {
    for (const [k, v] of Object.entries(incoming)) {
      if (typeof v === "string") tags[k] = v;
    }
  }
  ctx.store.set(key, tags);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const key = tagsKey(arn);
  const existing = ctx.store.get<Record<string, string>>(key) ?? {};
  const tags = { ...existing };
  const keys = input["tagKeys"];
  if (Array.isArray(keys)) {
    for (const k of keys) {
      if (typeof k === "string") delete tags[k];
    }
  }
  ctx.store.set(key, tags);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  return { Tags: tags };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const mwaa = {
  name: "airflow",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    const first = parts[0];
    if (first === "environments") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListEnvironments";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "PUT") return "CreateEnvironment";
        if (req.method === "GET") return "GetEnvironment";
        if (req.method === "DELETE") return "DeleteEnvironment";
        if (req.method === "PATCH") return "UpdateEnvironment";
        return undefined;
      }
      return undefined;
    }
    if (first === "clitoken" && parts.length === 2 && req.method === "POST")
      return "CreateCliToken";
    if (first === "webtoken" && parts.length === 2 && req.method === "POST")
      return "CreateWebLoginToken";
    if (first === "restapi" && parts.length === 2 && req.method === "POST")
      return "InvokeRestApi";
    if (
      first === "metrics" &&
      parts[1] === "environments" &&
      parts.length === 3 &&
      req.method === "POST"
    )
      return "PublishMetrics";
    if (first === "tags") {
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      if (req.method === "GET") return "ListTagsForResource";
    }
    return undefined;
  },
  operations: {
    CreateEnvironment,
    GetEnvironment,
    ListEnvironments,
    DeleteEnvironment,
    UpdateEnvironment,
    CreateCliToken,
    CreateWebLoginToken,
    InvokeRestApi,
    PublishMetrics,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default mwaa;
