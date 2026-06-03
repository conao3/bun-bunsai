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
  Tags: Record<string, string>;
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

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const environmentArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:airflow:${ctx.region}:${ctx.account}:environment/${name}`;

const environmentView = (
  environment: StoredEnvironment,
): Record<string, unknown> => ({
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
  Tags: environment.Tags,
});

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
  const environment: StoredEnvironment = {
    Name: name,
    Arn: environmentArn(ctx, name),
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
    Tags: stringMapFrom(input["Tags"]),
  };
  ctx.store.set(environmentKey(name), environment);
  return { Arn: environment.Arn };
};

const GetEnvironment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  return { Environment: environmentView(requireEnvironment(ctx, name)) };
};

const ListEnvironments: OperationHandler = (_input, ctx) => {
  const names = ctx.store
    .list<StoredEnvironment>()
    .filter((entry) => entry.key.startsWith(environmentPrefix))
    .map((entry) => entry.value.Name)
    .sort((a, b) => a.localeCompare(b));
  return { Environments: names };
};

const DeleteEnvironment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  requireEnvironment(ctx, name);
  ctx.store.delete(environmentKey(name));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const mwaa = {
  name: "airflow",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "environments") return undefined;
    if (parts.length === 1) {
      if (req.method === "GET") return "ListEnvironments";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "PUT") return "CreateEnvironment";
      if (req.method === "GET") return "GetEnvironment";
      if (req.method === "DELETE") return "DeleteEnvironment";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateEnvironment,
    GetEnvironment,
    ListEnvironments,
    DeleteEnvironment,
  },
  model,
} as const satisfies ServiceDefinition;

export default mwaa;
