import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import elasticbeanstalkModel from "../../../../test/vendor/aws-models/elasticbeanstalk.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(elasticbeanstalkModel);

type StoredApplication = {
  ApplicationArn: string;
  ApplicationName: string;
  Description: string | undefined;
  DateCreated: string;
  DateUpdated: string;
  Versions: string[];
  ConfigurationTemplates: string[];
};

type StoredEnvironment = {
  EnvironmentName: string;
  EnvironmentId: string;
  ApplicationName: string;
  VersionLabel: string | undefined;
  SolutionStackName: string | undefined;
  PlatformArn: string | undefined;
  TemplateName: string | undefined;
  Description: string | undefined;
  EndpointURL: string;
  CNAME: string;
  DateCreated: string;
  DateUpdated: string;
  Status: string;
  AbortableOperationInProgress: boolean;
  Health: string;
  HealthStatus: string;
  Tier: { Name: string; Type: string; Version: string };
  EnvironmentArn: string;
};

const applicationKey = (name: string): string => `application/${name}`;

const environmentKey = (id: string): string => `environment/${id}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidParameterValue", `${key} is required.`, 400);
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = input[key];
  return typeof value === "string" && value !== "" ? value : undefined;
};

const booleanOr = (
  input: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean => {
  const value = input[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true";
  }
  return fallback;
};

const requireApplication = (
  ctx: ServiceContext,
  name: string,
): StoredApplication => {
  const application = ctx.store.get<StoredApplication>(applicationKey(name));
  if (application === undefined) {
    throw awsError(
      "InvalidParameterValue",
      `No Application named '${name}' found.`,
      400,
    );
  }
  return application;
};

const applicationArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:elasticbeanstalk:${region}:${account}:application/${name}`;

const environmentArnOf = (
  region: string,
  account: string,
  application: string,
  name: string,
): string =>
  `arn:aws:elasticbeanstalk:${region}:${account}:environment/${application}/${name}`;

const presentApplication = (application: StoredApplication) => ({
  ApplicationArn: application.ApplicationArn,
  ApplicationName: application.ApplicationName,
  Description: application.Description,
  DateCreated: application.DateCreated,
  DateUpdated: application.DateUpdated,
  Versions: application.Versions,
  ConfigurationTemplates: application.ConfigurationTemplates,
});

const presentEnvironment = (environment: StoredEnvironment) => ({
  EnvironmentName: environment.EnvironmentName,
  EnvironmentId: environment.EnvironmentId,
  ApplicationName: environment.ApplicationName,
  VersionLabel: environment.VersionLabel,
  SolutionStackName: environment.SolutionStackName,
  PlatformArn: environment.PlatformArn,
  TemplateName: environment.TemplateName,
  Description: environment.Description,
  EndpointURL: environment.EndpointURL,
  CNAME: environment.CNAME,
  DateCreated: environment.DateCreated,
  DateUpdated: environment.DateUpdated,
  Status: environment.Status,
  AbortableOperationInProgress: environment.AbortableOperationInProgress,
  Health: environment.Health,
  HealthStatus: environment.HealthStatus,
  Tier: environment.Tier,
  EnvironmentArn: environment.EnvironmentArn,
});

const CreateApplication: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ApplicationName");
  const existing = ctx.store.get<StoredApplication>(applicationKey(name));
  if (existing !== undefined) {
    throw awsError(
      "TooManyApplicationsException",
      `Application ${name} already exists.`,
      400,
    );
  }
  const now = new Date().toISOString();
  const application: StoredApplication = {
    ApplicationArn: applicationArnOf(ctx.region, ctx.account, name),
    ApplicationName: name,
    Description: optionalString(input, "Description"),
    DateCreated: now,
    DateUpdated: now,
    Versions: [],
    ConfigurationTemplates: [],
  };
  ctx.store.set(applicationKey(name), application);
  return { Application: presentApplication(application) };
};

const DescribeApplications: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input.ApplicationNames)
    ? (input.ApplicationNames as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : undefined;
  const applications = ctx.store
    .list<StoredApplication>()
    .filter((entry) => entry.key.startsWith("application/"))
    .filter((entry) =>
      names !== undefined ? names.includes(entry.value.ApplicationName) : true,
    )
    .map((entry) => presentApplication(entry.value));
  return { Applications: applications };
};

const DeleteApplication: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ApplicationName");
  requireApplication(ctx, name);
  const terminateByForce = booleanOr(input, "TerminateEnvByForce", false);
  const environments = ctx.store
    .list<StoredEnvironment>()
    .filter((entry) => entry.key.startsWith("environment/"))
    .filter((entry) => entry.value.ApplicationName === name);
  if (environments.length > 0 && !terminateByForce) {
    throw awsError(
      "OperationInProgressException",
      `Application ${name} has running environments.`,
      400,
    );
  }
  for (const entry of environments) {
    ctx.store.delete(environmentKey(entry.value.EnvironmentId));
  }
  ctx.store.delete(applicationKey(name));
  return {};
};

const CreateEnvironment: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "ApplicationName");
  requireApplication(ctx, applicationName);
  const environmentName =
    optionalString(input, "EnvironmentName") ?? `${applicationName}-env`;
  const existing = ctx.store
    .list<StoredEnvironment>()
    .filter((entry) => entry.key.startsWith("environment/"))
    .find(
      (entry) =>
        entry.value.EnvironmentName === environmentName &&
        entry.value.Status !== "Terminated",
    );
  if (existing !== undefined) {
    throw awsError(
      "InvalidParameterValue",
      `Environment ${environmentName} already exists.`,
      400,
    );
  }
  const inputTier = input.Tier;
  const tier =
    inputTier !== null &&
    typeof inputTier === "object" &&
    typeof (inputTier as Record<string, unknown>).Name === "string"
      ? {
          Name: String((inputTier as Record<string, unknown>).Name),
          Type: String(
            (inputTier as Record<string, unknown>).Type ?? "Standard",
          ),
          Version: String(
            (inputTier as Record<string, unknown>).Version ?? "1.0",
          ),
        }
      : { Name: "WebServer", Type: "Standard", Version: "1.0" };
  const cnamePrefix = optionalString(input, "CNAMEPrefix") ?? environmentName;
  const id = `e-${crypto.randomUUID().replace(/-/g, "").slice(0, 13)}`;
  const now = new Date().toISOString();
  const environment: StoredEnvironment = {
    EnvironmentName: environmentName,
    EnvironmentId: id,
    ApplicationName: applicationName,
    VersionLabel: optionalString(input, "VersionLabel"),
    SolutionStackName:
      optionalString(input, "SolutionStackName") ??
      "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
    PlatformArn: optionalString(input, "PlatformArn"),
    TemplateName: optionalString(input, "TemplateName"),
    Description: optionalString(input, "Description"),
    EndpointURL: `${cnamePrefix}.${ctx.region}.elasticbeanstalk.com`,
    CNAME: `${cnamePrefix}.${ctx.region}.elasticbeanstalk.com`,
    DateCreated: now,
    DateUpdated: now,
    Status: "Ready",
    AbortableOperationInProgress: false,
    Health: "Green",
    HealthStatus: "Ok",
    Tier: tier,
    EnvironmentArn: environmentArnOf(
      ctx.region,
      ctx.account,
      applicationName,
      environmentName,
    ),
  };
  ctx.store.set(environmentKey(id), environment);
  return presentEnvironment(environment);
};

const DescribeEnvironments: OperationHandler = (input, ctx) => {
  const applicationName = optionalString(input, "ApplicationName");
  const ids = Array.isArray(input.EnvironmentIds)
    ? (input.EnvironmentIds as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : undefined;
  const namesInput = Array.isArray(input.EnvironmentNames)
    ? (input.EnvironmentNames as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : undefined;
  const includeDeleted = booleanOr(input, "IncludeDeleted", false);
  const environments = ctx.store
    .list<StoredEnvironment>()
    .filter((entry) => entry.key.startsWith("environment/"))
    .map((entry) => entry.value)
    .filter((environment) =>
      applicationName !== undefined
        ? environment.ApplicationName === applicationName
        : true,
    )
    .filter((environment) =>
      ids !== undefined ? ids.includes(environment.EnvironmentId) : true,
    )
    .filter((environment) =>
      namesInput !== undefined
        ? namesInput.includes(environment.EnvironmentName)
        : true,
    )
    .filter((environment) =>
      includeDeleted ? true : environment.Status !== "Terminated",
    )
    .map((environment) => presentEnvironment(environment));
  return { Environments: environments };
};

const TerminateEnvironment: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "EnvironmentId");
  const name = optionalString(input, "EnvironmentName");
  if (id === undefined && name === undefined) {
    throw awsError(
      "MissingRequiredParameter",
      "Either EnvironmentId or EnvironmentName must be specified.",
      400,
    );
  }
  const entry = ctx.store
    .list<StoredEnvironment>()
    .filter((current) => current.key.startsWith("environment/"))
    .find(
      (current) =>
        (id !== undefined ? current.value.EnvironmentId === id : true) &&
        (name !== undefined ? current.value.EnvironmentName === name : true),
    );
  if (entry === undefined) {
    throw awsError(
      "InvalidParameterValue",
      "No environment found for the specified identifier.",
      400,
    );
  }
  const environment = entry.value;
  environment.Status = "Terminated";
  environment.Health = "Grey";
  environment.HealthStatus = "Unknown";
  environment.DateUpdated = new Date().toISOString();
  ctx.store.set(environmentKey(environment.EnvironmentId), environment);
  return presentEnvironment(environment);
};

const elasticbeanstalk: ServiceDefinition = {
  name: "elasticbeanstalk",
  protocol: "query",
  operations: {
    CreateApplication,
    DescribeApplications,
    DeleteApplication,
    CreateEnvironment,
    DescribeEnvironments,
    TerminateEnvironment,
  },
  model,
} as const;

export default elasticbeanstalk;
