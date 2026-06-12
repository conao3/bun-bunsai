import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import elasticbeanstalkModel from "../../models/elasticbeanstalk.json" with { type: "json" };
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
  ResourceLifecycleConfig:
    | { ServiceRole?: string; VersionLifecycleConfig?: Record<string, unknown> }
    | undefined;
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
  OperationsRole: string | undefined;
};

type StoredApplicationVersion = {
  ApplicationVersionArn: string;
  ApplicationName: string;
  VersionLabel: string;
  Description: string | undefined;
  SourceBundle: { S3Bucket?: string; S3Key?: string } | undefined;
  SourceBuildInformation:
    | {
        SourceType?: string;
        SourceRepository?: string;
        SourceLocation?: string;
      }
    | undefined;
  DateCreated: string;
  DateUpdated: string;
  Status: string;
};

type StoredConfigurationTemplate = {
  ApplicationName: string;
  TemplateName: string;
  SolutionStackName: string | undefined;
  PlatformArn: string | undefined;
  Description: string | undefined;
  EnvironmentId: string | undefined;
  OptionSettings: Array<{
    ResourceName?: string;
    Namespace?: string;
    OptionName?: string;
    Value?: string;
  }>;
  DateCreated: string;
  DateUpdated: string;
};

type StoredPlatformVersion = {
  PlatformArn: string;
  PlatformName: string;
  PlatformVersion: string;
  PlatformOwner: string;
  PlatformStatus: string;
  PlatformCategory: string;
  SolutionStackName: string;
  OperatingSystemName: string;
  OperatingSystemVersion: string;
  DateCreated: string;
  DateUpdated: string;
  SupportedTierList: string[];
  SupportedAddonList: string[];
};

const applicationKey = (name: string): string => `application/${name}`;

const environmentKey = (id: string): string => `environment/${id}`;

const applicationVersionKey = (appName: string, versionLabel: string): string =>
  `applicationVersion/${appName}/${versionLabel}`;

const configurationTemplateKey = (
  appName: string,
  templateName: string,
): string => `configurationTemplate/${appName}/${templateName}`;

const platformVersionKey = (platformArn: string): string =>
  `platformVersion/${platformArn}`;

const resourceTagsKey = (resourceArn: string): string =>
  `resourceTags/${resourceArn}`;

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

const requireEnvironment = (
  ctx: ServiceContext,
  name: string | undefined,
  id: string | undefined,
): void => {
  const found = ctx.store
    .list<StoredEnvironment>()
    .filter((e) => e.key.startsWith("environment/"))
    .some(
      (e) =>
        (id !== undefined ? e.value.EnvironmentId === id : true) &&
        (name !== undefined ? e.value.EnvironmentName === name : true),
    );
  if (!found) {
    throw awsError(
      "InvalidParameterValue",
      "No environment found for the specified identifier.",
      400,
    );
  }
};

const isCustomPlatformArn = (arn: string): boolean => {
  const parts = arn.split(":");
  return parts.length >= 6 && parts[4] !== "";
};

const applyPagination = <T>(
  items: T[],
  maxRecordsInput: unknown,
  tokenInput: unknown,
): { items: T[]; nextToken: string | undefined } => {
  const offset =
    typeof tokenInput === "string" && tokenInput !== ""
      ? parseInt(tokenInput, 10)
      : 0;
  const maxRecords =
    typeof maxRecordsInput === "number" && maxRecordsInput > 0
      ? maxRecordsInput
      : undefined;
  const sliced =
    maxRecords !== undefined
      ? items.slice(offset, offset + maxRecords)
      : items.slice(offset);
  const nextOffset = offset + sliced.length;
  const nextToken = nextOffset < items.length ? String(nextOffset) : undefined;
  return { items: sliced, nextToken };
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

const applicationVersionArnOf = (
  region: string,
  account: string,
  appName: string,
  versionLabel: string,
): string =>
  `arn:aws:elasticbeanstalk:${region}:${account}:applicationversion/${appName}/${versionLabel}`;

const platformArnOf = (
  region: string,
  account: string,
  name: string,
  version: string,
): string =>
  `arn:aws:elasticbeanstalk:${region}:${account}:platform/${name}/${version}`;

const presentApplication = (application: StoredApplication) => ({
  ApplicationArn: application.ApplicationArn,
  ApplicationName: application.ApplicationName,
  Description: application.Description,
  DateCreated: application.DateCreated,
  DateUpdated: application.DateUpdated,
  Versions: application.Versions,
  ConfigurationTemplates: application.ConfigurationTemplates,
  ResourceLifecycleConfig: application.ResourceLifecycleConfig,
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

const presentApplicationVersion = (version: StoredApplicationVersion) => ({
  ApplicationVersionArn: version.ApplicationVersionArn,
  ApplicationName: version.ApplicationName,
  VersionLabel: version.VersionLabel,
  Description: version.Description,
  SourceBundle: version.SourceBundle,
  SourceBuildInformation: version.SourceBuildInformation,
  DateCreated: version.DateCreated,
  DateUpdated: version.DateUpdated,
  Status: version.Status,
});

const presentConfigurationTemplate = (
  template: StoredConfigurationTemplate,
) => ({
  ApplicationName: template.ApplicationName,
  TemplateName: template.TemplateName as string | undefined,
  SolutionStackName: template.SolutionStackName,
  PlatformArn: template.PlatformArn,
  Description: template.Description,
  EnvironmentName: undefined as string | undefined,
  DeploymentStatus: "deployed",
  DateCreated: template.DateCreated,
  DateUpdated: template.DateUpdated,
  OptionSettings: template.OptionSettings,
});

const presentPlatformSummary = (platform: StoredPlatformVersion) => ({
  PlatformArn: platform.PlatformArn,
  PlatformOwner: platform.PlatformOwner,
  PlatformStatus: platform.PlatformStatus,
  PlatformCategory: platform.PlatformCategory,
  OperatingSystemName: platform.OperatingSystemName,
  OperatingSystemVersion: platform.OperatingSystemVersion,
  SupportedTierList: platform.SupportedTierList,
  SupportedAddonList: platform.SupportedAddonList,
  PlatformLifecycleState: "recommended",
  PlatformVersion: platform.PlatformVersion,
  PlatformBranchName: "Python 3.8",
  PlatformBranchLifecycleState: "supported",
});

const presentPlatformDescription = (platform: StoredPlatformVersion) => ({
  PlatformArn: platform.PlatformArn,
  PlatformOwner: platform.PlatformOwner,
  PlatformName: platform.PlatformName,
  PlatformVersion: platform.PlatformVersion,
  SolutionStackName: platform.SolutionStackName,
  PlatformStatus: platform.PlatformStatus,
  DateCreated: platform.DateCreated,
  DateUpdated: platform.DateUpdated,
  PlatformCategory: platform.PlatformCategory,
  Description: undefined as string | undefined,
  Maintainer: undefined as string | undefined,
  OperatingSystemName: platform.OperatingSystemName,
  OperatingSystemVersion: platform.OperatingSystemVersion,
  ProgrammingLanguages: [] as unknown[],
  Frameworks: [] as unknown[],
  CustomAmiList: [] as unknown[],
  SupportedTierList: platform.SupportedTierList,
  SupportedAddonList: platform.SupportedAddonList,
  PlatformLifecycleState: "recommended",
  PlatformBranchName: "Python 3.8",
  PlatformBranchLifecycleState: "supported",
});

const SYNTHETIC_SOLUTION_STACKS = [
  "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
  "64bit Amazon Linux 2 v3.5.0 running Node.js 18",
  "64bit Amazon Linux 2 v3.4.0 running Java 11 (Corretto)",
  "64bit Amazon Linux 2 v4.0.0 running Docker",
];

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
    ResourceLifecycleConfig: undefined,
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
  const versionLabel = optionalString(input, "VersionLabel");
  if (versionLabel !== undefined) {
    const versionExists = ctx.store.get<StoredApplicationVersion>(
      applicationVersionKey(applicationName, versionLabel),
    );
    if (versionExists === undefined) {
      throw awsError(
        "InvalidParameterValue",
        `No Application Version named '${versionLabel}' found.`,
        400,
      );
    }
  }
  const cnamePrefix = optionalString(input, "CNAMEPrefix") ?? environmentName;
  const id = `e-${crypto.randomUUID().replace(/-/g, "").slice(0, 13)}`;
  const now = new Date().toISOString();
  const environment: StoredEnvironment = {
    EnvironmentName: environmentName,
    EnvironmentId: id,
    ApplicationName: applicationName,
    VersionLabel: versionLabel,
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
    OperationsRole: undefined,
  };
  ctx.store.set(environmentKey(id), environment);
  return { ...presentEnvironment(environment), Status: "Launching" };
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
  const allEnvironments = ctx.store
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
  const { items: environments, nextToken } = applyPagination(
    allEnvironments,
    input.MaxRecords,
    input.NextToken,
  );
  return { Environments: environments, NextToken: nextToken };
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

const AbortEnvironmentUpdate: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "EnvironmentId");
  const name = optionalString(input, "EnvironmentName");
  const entry = ctx.store
    .list<StoredEnvironment>()
    .filter((e) => e.key.startsWith("environment/"))
    .find(
      (e) =>
        (id !== undefined ? e.value.EnvironmentId === id : true) &&
        (name !== undefined ? e.value.EnvironmentName === name : true),
    );
  if (entry !== undefined) {
    const env = entry.value;
    env.AbortableOperationInProgress = false;
    env.DateUpdated = new Date().toISOString();
    ctx.store.set(environmentKey(env.EnvironmentId), env);
  }
  return {};
};

const ApplyEnvironmentManagedAction: OperationHandler = (input, ctx) => {
  const actionId = requireString(input, "ActionId");
  const envName = optionalString(input, "EnvironmentName");
  const envId = optionalString(input, "EnvironmentId");
  if (envName !== undefined || envId !== undefined) {
    requireEnvironment(ctx, envName, envId);
  }
  return {
    ActionId: actionId,
    ActionDescription: "Apply managed action",
    ActionType: "InstanceRefresh",
    Status: "Scheduled",
  };
};

const AssociateEnvironmentOperationsRole: OperationHandler = (input, ctx) => {
  const envName = requireString(input, "EnvironmentName");
  const operationsRole = requireString(input, "OperationsRole");
  const entry = ctx.store
    .list<StoredEnvironment>()
    .filter((e) => e.key.startsWith("environment/"))
    .find((e) => e.value.EnvironmentName === envName);
  if (entry === undefined) {
    throw awsError(
      "InvalidParameterValue",
      `No environment found for the specified identifier.`,
      400,
    );
  }
  const env = entry.value;
  env.OperationsRole = operationsRole;
  env.DateUpdated = new Date().toISOString();
  ctx.store.set(environmentKey(env.EnvironmentId), env);
  return {};
};

const CheckDNSAvailability: OperationHandler = (input, ctx) => {
  const cnamePrefix = requireString(input, "CNAMEPrefix");
  const fullyQualifiedCNAME = `${cnamePrefix}.${ctx.region}.elasticbeanstalk.com`;
  const taken = ctx.store
    .list<StoredEnvironment>()
    .filter((e) => e.key.startsWith("environment/"))
    .some((e) => e.value.CNAME === fullyQualifiedCNAME);
  return {
    Available: !taken,
    FullyQualifiedCNAME: fullyQualifiedCNAME,
  };
};

const ComposeEnvironments: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "ApplicationName");
  requireApplication(ctx, applicationName);
  const versionLabels = Array.isArray(input.VersionLabels)
    ? (input.VersionLabels as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const now = new Date().toISOString();
  const created: ReturnType<typeof presentEnvironment>[] = [];
  for (const versionLabel of versionLabels) {
    const environmentName = `${applicationName}-${versionLabel}-env`;
    const id = `e-${crypto.randomUUID().replace(/-/g, "").slice(0, 13)}`;
    const environment: StoredEnvironment = {
      EnvironmentName: environmentName,
      EnvironmentId: id,
      ApplicationName: applicationName,
      VersionLabel: versionLabel,
      SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
      PlatformArn: undefined,
      TemplateName: undefined,
      Description: undefined,
      EndpointURL: `${environmentName}.${ctx.region}.elasticbeanstalk.com`,
      CNAME: `${environmentName}.${ctx.region}.elasticbeanstalk.com`,
      DateCreated: now,
      DateUpdated: now,
      Status: "Ready",
      AbortableOperationInProgress: false,
      Health: "Green",
      HealthStatus: "Ok",
      Tier: { Name: "WebServer", Type: "Standard", Version: "1.0" },
      EnvironmentArn: environmentArnOf(
        ctx.region,
        ctx.account,
        applicationName,
        environmentName,
      ),
      OperationsRole: undefined,
    };
    ctx.store.set(environmentKey(id), environment);
    created.push(presentEnvironment(environment));
  }
  return { Environments: created };
};

const CreateApplicationVersion: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "ApplicationName");
  const versionLabel = requireString(input, "VersionLabel");
  const autoCreate = booleanOr(input, "AutoCreateApplication", false);
  let application = ctx.store.get<StoredApplication>(
    applicationKey(applicationName),
  );
  if (application === undefined) {
    if (!autoCreate) {
      throw awsError(
        "InvalidParameterValue",
        `No Application named '${applicationName}' found.`,
        400,
      );
    }
    const now = new Date().toISOString();
    application = {
      ApplicationArn: applicationArnOf(
        ctx.region,
        ctx.account,
        applicationName,
      ),
      ApplicationName: applicationName,
      Description: undefined,
      DateCreated: now,
      DateUpdated: now,
      Versions: [],
      ConfigurationTemplates: [],
      ResourceLifecycleConfig: undefined,
    };
    ctx.store.set(applicationKey(applicationName), application);
  }
  const existing = ctx.store.get<StoredApplicationVersion>(
    applicationVersionKey(applicationName, versionLabel),
  );
  if (existing !== undefined) {
    throw awsError(
      "InvalidParameterValue",
      `Application version '${versionLabel}' already exists.`,
      400,
    );
  }
  const now = new Date().toISOString();
  const rawBundle = input.SourceBundle;
  const sourceBundle =
    rawBundle !== null && typeof rawBundle === "object"
      ? {
          S3Bucket: String(
            (rawBundle as Record<string, unknown>).S3Bucket ?? "",
          ),
          S3Key: String((rawBundle as Record<string, unknown>).S3Key ?? ""),
        }
      : undefined;
  const rawSbi = input.SourceBuildInformation;
  const sourceBuildInformation =
    rawSbi !== null && typeof rawSbi === "object"
      ? {
          SourceType: String(
            (rawSbi as Record<string, unknown>).SourceType ?? "",
          ),
          SourceRepository: String(
            (rawSbi as Record<string, unknown>).SourceRepository ?? "",
          ),
          SourceLocation: String(
            (rawSbi as Record<string, unknown>).SourceLocation ?? "",
          ),
        }
      : undefined;
  const version: StoredApplicationVersion = {
    ApplicationVersionArn: applicationVersionArnOf(
      ctx.region,
      ctx.account,
      applicationName,
      versionLabel,
    ),
    ApplicationName: applicationName,
    VersionLabel: versionLabel,
    Description: optionalString(input, "Description"),
    SourceBundle: sourceBundle,
    SourceBuildInformation: sourceBuildInformation,
    DateCreated: now,
    DateUpdated: now,
    Status: "Processed",
  };
  ctx.store.set(applicationVersionKey(applicationName, versionLabel), version);
  application.Versions = [...application.Versions, versionLabel];
  application.DateUpdated = now;
  ctx.store.set(applicationKey(applicationName), application);
  return {
    ApplicationVersion: {
      ...presentApplicationVersion(version),
      Status: "Processing",
    },
  };
};

const CreateConfigurationTemplate: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "ApplicationName");
  const templateName = requireString(input, "TemplateName");
  requireApplication(ctx, applicationName);
  const existing = ctx.store.get<StoredConfigurationTemplate>(
    configurationTemplateKey(applicationName, templateName),
  );
  if (existing !== undefined) {
    throw awsError(
      "TooManyConfigurationTemplatesException",
      `Configuration template '${templateName}' already exists.`,
      400,
    );
  }
  const now = new Date().toISOString();
  const rawSettings = Array.isArray(input.OptionSettings)
    ? (input.OptionSettings as unknown[]).map((s) => {
        const setting = s as Record<string, unknown>;
        return {
          ResourceName: optionalString(setting, "ResourceName"),
          Namespace: optionalString(setting, "Namespace"),
          OptionName: optionalString(setting, "OptionName"),
          Value: optionalString(setting, "Value"),
        };
      })
    : [];
  const template: StoredConfigurationTemplate = {
    ApplicationName: applicationName,
    TemplateName: templateName,
    SolutionStackName: optionalString(input, "SolutionStackName"),
    PlatformArn: optionalString(input, "PlatformArn"),
    Description: optionalString(input, "Description"),
    EnvironmentId: optionalString(input, "EnvironmentId"),
    OptionSettings: rawSettings,
    DateCreated: now,
    DateUpdated: now,
  };
  ctx.store.set(
    configurationTemplateKey(applicationName, templateName),
    template,
  );
  const application = ctx.store.get<StoredApplication>(
    applicationKey(applicationName),
  )!;
  application.ConfigurationTemplates = [
    ...application.ConfigurationTemplates,
    templateName,
  ];
  application.DateUpdated = now;
  ctx.store.set(applicationKey(applicationName), application);
  return presentConfigurationTemplate(template);
};

const CreatePlatformVersion: OperationHandler = (input, ctx) => {
  const platformName = requireString(input, "PlatformName");
  const platformVersion = requireString(input, "PlatformVersion");
  const now = new Date().toISOString();
  const platformArn = platformArnOf(
    ctx.region,
    ctx.account,
    platformName,
    platformVersion,
  );
  const platform: StoredPlatformVersion = {
    PlatformArn: platformArn,
    PlatformName: platformName,
    PlatformVersion: platformVersion,
    PlatformOwner: ctx.account,
    PlatformStatus: "Ready",
    PlatformCategory: "custom",
    SolutionStackName: `64bit Custom Platform ${platformName} ${platformVersion}`,
    OperatingSystemName: "Amazon Linux",
    OperatingSystemVersion: "2",
    DateCreated: now,
    DateUpdated: now,
    SupportedTierList: ["WebServer/Standard"],
    SupportedAddonList: [],
  };
  ctx.store.set(platformVersionKey(platformArn), platform);
  return {
    PlatformSummary: {
      ...presentPlatformSummary(platform),
      PlatformStatus: "Creating",
    },
    Builder: {
      ARN: `arn:aws:elasticbeanstalk:${ctx.region}:${ctx.account}:builder/${platformName}`,
    },
  };
};

const CreateStorageLocation: OperationHandler = (_input, ctx) => {
  return {
    S3Bucket: `elasticbeanstalk-${ctx.region}-${ctx.account}`,
  };
};

const DeleteApplicationVersion: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "ApplicationName");
  const versionLabel = requireString(input, "VersionLabel");
  requireApplication(ctx, applicationName);
  const existing = ctx.store.get<StoredApplicationVersion>(
    applicationVersionKey(applicationName, versionLabel),
  );
  if (existing === undefined) {
    throw awsError(
      "InvalidParameterValue",
      `No Application Version named '${versionLabel}' found.`,
      400,
    );
  }
  ctx.store.delete(applicationVersionKey(applicationName, versionLabel));
  const application = ctx.store.get<StoredApplication>(
    applicationKey(applicationName),
  )!;
  application.Versions = application.Versions.filter((v) => v !== versionLabel);
  application.DateUpdated = new Date().toISOString();
  ctx.store.set(applicationKey(applicationName), application);
  return {};
};

const DeleteConfigurationTemplate: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "ApplicationName");
  const templateName = requireString(input, "TemplateName");
  requireApplication(ctx, applicationName);
  const existing = ctx.store.get<StoredConfigurationTemplate>(
    configurationTemplateKey(applicationName, templateName),
  );
  if (existing === undefined) {
    throw awsError(
      "InvalidParameterValue",
      `No Configuration Template named '${templateName}' found.`,
      400,
    );
  }
  ctx.store.delete(configurationTemplateKey(applicationName, templateName));
  const application = ctx.store.get<StoredApplication>(
    applicationKey(applicationName),
  )!;
  application.ConfigurationTemplates =
    application.ConfigurationTemplates.filter((t) => t !== templateName);
  application.DateUpdated = new Date().toISOString();
  ctx.store.set(applicationKey(applicationName), application);
  return {};
};

const DeleteEnvironmentConfiguration: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "ApplicationName");
  const environmentName = requireString(input, "EnvironmentName");
  requireApplication(ctx, applicationName);
  const entry = ctx.store
    .list<StoredEnvironment>()
    .filter((e) => e.key.startsWith("environment/"))
    .find(
      (e) =>
        e.value.ApplicationName === applicationName &&
        e.value.EnvironmentName === environmentName,
    );
  if (entry === undefined) {
    throw awsError(
      "InvalidParameterValue",
      `No environment found for the specified identifier.`,
      400,
    );
  }
  return {};
};

const DeletePlatformVersion: OperationHandler = (input, ctx) => {
  const platformArn = optionalString(input, "PlatformArn");
  if (platformArn === undefined) {
    return { PlatformSummary: undefined };
  }
  const platform = ctx.store.get<StoredPlatformVersion>(
    platformVersionKey(platformArn),
  );
  if (platform === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No platform version found for ARN '${platformArn}'.`,
      400,
    );
  }
  ctx.store.delete(platformVersionKey(platformArn));
  return {
    PlatformSummary: presentPlatformSummary({
      ...platform,
      PlatformStatus: "Deleted",
    }),
  };
};

const DescribeAccountAttributes: OperationHandler = (_input, _ctx) => {
  return {
    ResourceQuotas: {
      ApplicationQuota: { Maximum: 75 },
      ApplicationVersionQuota: { Maximum: 1000 },
      EnvironmentQuota: { Maximum: 200 },
      ConfigurationTemplateQuota: { Maximum: 2000 },
      CustomPlatformQuota: { Maximum: 25 },
    },
  };
};

const DescribeApplicationVersions: OperationHandler = (input, ctx) => {
  const applicationName = optionalString(input, "ApplicationName");
  const versionLabels = Array.isArray(input.VersionLabels)
    ? (input.VersionLabels as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : undefined;
  const allVersions = ctx.store
    .list<StoredApplicationVersion>()
    .filter((entry) => entry.key.startsWith("applicationVersion/"))
    .map((entry) => entry.value)
    .filter((v) =>
      applicationName !== undefined
        ? v.ApplicationName === applicationName
        : true,
    )
    .filter((v) =>
      versionLabels !== undefined
        ? versionLabels.includes(v.VersionLabel)
        : true,
    )
    .map((v) => presentApplicationVersion(v));
  const { items: versions, nextToken } = applyPagination(
    allVersions,
    input.MaxRecords,
    input.NextToken,
  );
  return { ApplicationVersions: versions, NextToken: nextToken };
};

const DescribeConfigurationOptions: OperationHandler = (_input, _ctx) => {
  return {
    SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
    PlatformArn: undefined,
    Options: [],
  };
};

const DescribeConfigurationSettings: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "ApplicationName");
  requireApplication(ctx, applicationName);
  const templateName = optionalString(input, "TemplateName");
  const environmentName = optionalString(input, "EnvironmentName");
  const settings: ReturnType<typeof presentConfigurationTemplate>[] = [];
  if (templateName !== undefined) {
    const template = ctx.store.get<StoredConfigurationTemplate>(
      configurationTemplateKey(applicationName, templateName),
    );
    if (template !== undefined) {
      settings.push(presentConfigurationTemplate(template));
    }
  } else if (environmentName !== undefined) {
    const now = new Date().toISOString();
    settings.push({
      ApplicationName: applicationName,
      TemplateName: undefined,
      SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
      PlatformArn: undefined,
      Description: undefined,
      EnvironmentName: environmentName,
      DeploymentStatus: "deployed",
      DateCreated: now,
      DateUpdated: now,
      OptionSettings: [],
    });
  }
  return { ConfigurationSettings: settings };
};

const DescribeEnvironmentHealth: OperationHandler = (input, ctx) => {
  const environmentName = optionalString(input, "EnvironmentName");
  const environmentId = optionalString(input, "EnvironmentId");
  if (environmentName === undefined && environmentId === undefined) {
    throw awsError(
      "InvalidRequestException",
      "Either EnvironmentName or EnvironmentId must be specified.",
      400,
    );
  }
  const entry = ctx.store
    .list<StoredEnvironment>()
    .filter((e) => e.key.startsWith("environment/"))
    .find(
      (e) =>
        (environmentName !== undefined
          ? e.value.EnvironmentName === environmentName
          : true) &&
        (environmentId !== undefined
          ? e.value.EnvironmentId === environmentId
          : true),
    );
  const now = new Date().toISOString();
  const envName =
    entry?.value.EnvironmentName ??
    environmentName ??
    environmentId ??
    "unknown";
  const status = entry?.value.Health ?? "Grey";
  return {
    EnvironmentName: envName,
    HealthStatus: entry?.value.HealthStatus ?? "Unknown",
    Status: status,
    Color: status === "Green" ? "Green" : status === "Grey" ? "Grey" : "Red",
    Causes: [],
    ApplicationMetrics: {
      Duration: 10,
      RequestCount: 0,
      StatusCodes: { Status2xx: 0, Status3xx: 0, Status4xx: 0, Status5xx: 0 },
      Latency: {
        P999: 0,
        P99: 0,
        P95: 0,
        P90: 0,
        P85: 0,
        P75: 0,
        P50: 0,
        P10: 0,
      },
    },
    InstancesHealth: {
      NoData: 0,
      Unknown: 0,
      Pending: 0,
      Ok: 1,
      Info: 0,
      Warning: 0,
      Degraded: 0,
      Severe: 0,
    },
    RefreshedAt: now,
  };
};

const DescribeEnvironmentManagedActionHistory: OperationHandler = (
  _input,
  _ctx,
) => {
  return {
    ManagedActionHistoryItems: [],
    NextToken: undefined,
  };
};

const DescribeEnvironmentManagedActions: OperationHandler = (_input, _ctx) => {
  return {
    ManagedActions: [],
  };
};

const DescribeEnvironmentResources: OperationHandler = (input, ctx) => {
  const environmentId = optionalString(input, "EnvironmentId");
  const environmentName = optionalString(input, "EnvironmentName");
  if (environmentId === undefined && environmentName === undefined) {
    throw awsError(
      "InvalidParameterValue",
      "Either EnvironmentId or EnvironmentName must be specified.",
      400,
    );
  }
  const entry = ctx.store
    .list<StoredEnvironment>()
    .filter((e) => e.key.startsWith("environment/"))
    .find(
      (e) =>
        (environmentId !== undefined
          ? e.value.EnvironmentId === environmentId
          : true) &&
        (environmentName !== undefined
          ? e.value.EnvironmentName === environmentName
          : true),
    );
  const envName =
    entry?.value.EnvironmentName ??
    environmentName ??
    environmentId ??
    "unknown";
  return {
    EnvironmentResources: {
      EnvironmentName: envName,
      AutoScalingGroups: [],
      Instances: [],
      LaunchConfigurations: [],
      LaunchTemplates: [],
      LoadBalancers: [],
      Triggers: [],
      Queues: [],
    },
  };
};

const DescribeEvents: OperationHandler = (_input, _ctx) => {
  return {
    Events: [],
    NextToken: undefined,
  };
};

const DescribeInstancesHealth: OperationHandler = (input, ctx) => {
  const envName = optionalString(input, "EnvironmentName");
  const envId = optionalString(input, "EnvironmentId");
  if (envName !== undefined || envId !== undefined) {
    requireEnvironment(ctx, envName, envId);
  }
  return {
    InstanceHealthList: [],
    RefreshedAt: new Date().toISOString(),
    NextToken: undefined,
  };
};

const DescribePlatformVersion: OperationHandler = (input, ctx) => {
  const platformArn = optionalString(input, "PlatformArn");
  if (platformArn !== undefined) {
    const platform = ctx.store.get<StoredPlatformVersion>(
      platformVersionKey(platformArn),
    );
    if (platform !== undefined) {
      return { PlatformDescription: presentPlatformDescription(platform) };
    }
    if (isCustomPlatformArn(platformArn)) {
      throw awsError(
        "ResourceNotFoundException",
        `No platform version found for '${platformArn}'.`,
        404,
      );
    }
  }
  const now = new Date().toISOString();
  return {
    PlatformDescription: {
      PlatformArn:
        platformArn ??
        `arn:aws:elasticbeanstalk:${ctx.region}::platform/Python/3.8.0`,
      PlatformOwner: "AmazonWebServices",
      PlatformName: "Python",
      PlatformVersion: "3.8.0",
      SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
      PlatformStatus: "Ready",
      DateCreated: now,
      DateUpdated: now,
      PlatformCategory: "managed",
      Description: undefined,
      Maintainer: undefined,
      OperatingSystemName: "Amazon Linux",
      OperatingSystemVersion: "2",
      ProgrammingLanguages: [],
      Frameworks: [],
      CustomAmiList: [],
      SupportedTierList: ["WebServer/Standard"],
      SupportedAddonList: [],
      PlatformLifecycleState: "recommended",
      PlatformBranchName: "Python 3.8",
      PlatformBranchLifecycleState: "supported",
    },
  };
};

const DisassociateEnvironmentOperationsRole: OperationHandler = (
  input,
  ctx,
) => {
  const envName = requireString(input, "EnvironmentName");
  const entry = ctx.store
    .list<StoredEnvironment>()
    .filter((e) => e.key.startsWith("environment/"))
    .find((e) => e.value.EnvironmentName === envName);
  if (entry !== undefined) {
    const env = entry.value;
    env.OperationsRole = undefined;
    env.DateUpdated = new Date().toISOString();
    ctx.store.set(environmentKey(env.EnvironmentId), env);
  }
  return {};
};

const ListAvailableSolutionStacks: OperationHandler = (_input, _ctx) => {
  const stacks = SYNTHETIC_SOLUTION_STACKS;
  return {
    SolutionStacks: stacks,
    SolutionStackDetails: stacks.map((name) => ({
      SolutionStackName: name,
      PermittedFileTypes: ["zip"],
    })),
  };
};

const ListPlatformBranches: OperationHandler = (_input, _ctx) => {
  return {
    PlatformBranchSummaryList: [
      {
        PlatformName: "Python",
        BranchName: "Python 3.8",
        LifecycleState: "supported",
        BranchOrder: 1,
        SupportedTierList: ["WebServer/Standard"],
      },
      {
        PlatformName: "Node.js",
        BranchName: "Node.js 18",
        LifecycleState: "supported",
        BranchOrder: 1,
        SupportedTierList: ["WebServer/Standard"],
      },
    ],
    NextToken: undefined,
  };
};

const ListPlatformVersions: OperationHandler = (_input, ctx) => {
  const stored = ctx.store
    .list<StoredPlatformVersion>()
    .filter((e) => e.key.startsWith("platformVersion/"))
    .map((e) => presentPlatformSummary(e.value));
  if (stored.length > 0) {
    return { PlatformSummaryList: stored, NextToken: undefined };
  }
  return {
    PlatformSummaryList: [
      {
        PlatformArn: `arn:aws:elasticbeanstalk:${ctx.region}::platform/Python/3.8.0`,
        PlatformOwner: "AmazonWebServices",
        PlatformStatus: "Ready",
        PlatformCategory: "managed",
        OperatingSystemName: "Amazon Linux",
        OperatingSystemVersion: "2",
        SupportedTierList: ["WebServer/Standard"],
        SupportedAddonList: [],
        PlatformLifecycleState: "recommended",
        PlatformVersion: "3.8.0",
        PlatformBranchName: "Python 3.8",
        PlatformBranchLifecycleState: "supported",
      },
    ],
    NextToken: undefined,
  };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tags = ctx.store.get<Record<string, string>>(
    resourceTagsKey(resourceArn),
  );
  const tagList =
    tags !== undefined
      ? Object.entries(tags).map(([Key, Value]) => ({ Key, Value }))
      : [];
  return {
    ResourceArn: resourceArn,
    ResourceTags: tagList,
  };
};

const RebuildEnvironment: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "EnvironmentId");
  const name = optionalString(input, "EnvironmentName");
  if (id === undefined && name === undefined) {
    throw awsError(
      "InvalidParameterValue",
      "Either EnvironmentId or EnvironmentName must be specified.",
      400,
    );
  }
  const entry = ctx.store
    .list<StoredEnvironment>()
    .filter((e) => e.key.startsWith("environment/"))
    .find(
      (e) =>
        (id !== undefined ? e.value.EnvironmentId === id : true) &&
        (name !== undefined ? e.value.EnvironmentName === name : true),
    );
  if (entry !== undefined) {
    const env = entry.value;
    env.DateUpdated = new Date().toISOString();
    ctx.store.set(environmentKey(env.EnvironmentId), env);
  }
  return {};
};

const RequestEnvironmentInfo: OperationHandler = (input, ctx) => {
  const envName = optionalString(input, "EnvironmentName");
  const envId = optionalString(input, "EnvironmentId");
  if (envName !== undefined || envId !== undefined) {
    requireEnvironment(ctx, envName, envId);
  }
  return {};
};

const RestartAppServer: OperationHandler = (input, ctx) => {
  const envName = optionalString(input, "EnvironmentName");
  const envId = optionalString(input, "EnvironmentId");
  if (envName !== undefined || envId !== undefined) {
    requireEnvironment(ctx, envName, envId);
  }
  return {};
};

const RetrieveEnvironmentInfo: OperationHandler = (input, _ctx) => {
  const environmentId = optionalString(input, "EnvironmentId");
  const environmentName = optionalString(input, "EnvironmentName");
  const now = new Date().toISOString();
  const envName = environmentName ?? environmentId ?? "unknown";
  return {
    EnvironmentInfo: [
      {
        InfoType:
          optionalString(input as Record<string, unknown>, "InfoType") ??
          "tail",
        Ec2InstanceId: "i-0000000000000001",
        SampleTimestamp: now,
        Message: `Environment ${envName} info retrieved`,
      },
    ],
  };
};

const SwapEnvironmentCNAMEs: OperationHandler = (input, ctx) => {
  const sourceEnvId = optionalString(input, "SourceEnvironmentId");
  const sourceEnvName = optionalString(input, "SourceEnvironmentName");
  const destEnvId = optionalString(input, "DestinationEnvironmentId");
  const destEnvName = optionalString(input, "DestinationEnvironmentName");
  const sourceEntry = ctx.store
    .list<StoredEnvironment>()
    .filter((e) => e.key.startsWith("environment/"))
    .find(
      (e) =>
        (sourceEnvId !== undefined
          ? e.value.EnvironmentId === sourceEnvId
          : true) &&
        (sourceEnvName !== undefined
          ? e.value.EnvironmentName === sourceEnvName
          : true),
    );
  const destEntry = ctx.store
    .list<StoredEnvironment>()
    .filter((e) => e.key.startsWith("environment/"))
    .find(
      (e) =>
        (destEnvId !== undefined
          ? e.value.EnvironmentId === destEnvId
          : true) &&
        (destEnvName !== undefined
          ? e.value.EnvironmentName === destEnvName
          : true),
    );
  if (sourceEntry !== undefined && destEntry !== undefined) {
    const now = new Date().toISOString();
    const sourceCNAME = sourceEntry.value.CNAME;
    const destCNAME = destEntry.value.CNAME;
    sourceEntry.value.CNAME = destCNAME;
    sourceEntry.value.DateUpdated = now;
    destEntry.value.CNAME = sourceCNAME;
    destEntry.value.DateUpdated = now;
    ctx.store.set(
      environmentKey(sourceEntry.value.EnvironmentId),
      sourceEntry.value,
    );
    ctx.store.set(
      environmentKey(destEntry.value.EnvironmentId),
      destEntry.value,
    );
  }
  return {};
};

const UpdateApplication: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ApplicationName");
  const application = requireApplication(ctx, name);
  application.Description = optionalString(input, "Description");
  application.DateUpdated = new Date().toISOString();
  ctx.store.set(applicationKey(name), application);
  return { Application: presentApplication(application) };
};

const UpdateApplicationResourceLifecycle: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ApplicationName");
  const application = requireApplication(ctx, name);
  const rawConfig = input.ResourceLifecycleConfig;
  const resourceLifecycleConfig =
    rawConfig !== null && typeof rawConfig === "object"
      ? {
          ServiceRole: optionalString(
            rawConfig as Record<string, unknown>,
            "ServiceRole",
          ),
          VersionLifecycleConfig: (rawConfig as Record<string, unknown>)
            .VersionLifecycleConfig as Record<string, unknown> | undefined,
        }
      : undefined;
  application.ResourceLifecycleConfig = resourceLifecycleConfig;
  application.DateUpdated = new Date().toISOString();
  ctx.store.set(applicationKey(name), application);
  return {
    ApplicationName: name,
    ResourceLifecycleConfig: resourceLifecycleConfig ?? {},
  };
};

const UpdateApplicationVersion: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "ApplicationName");
  const versionLabel = requireString(input, "VersionLabel");
  requireApplication(ctx, applicationName);
  const version = ctx.store.get<StoredApplicationVersion>(
    applicationVersionKey(applicationName, versionLabel),
  );
  if (version === undefined) {
    throw awsError(
      "InvalidParameterValue",
      `No Application Version named '${versionLabel}' found.`,
      400,
    );
  }
  version.Description = optionalString(input, "Description");
  version.DateUpdated = new Date().toISOString();
  ctx.store.set(applicationVersionKey(applicationName, versionLabel), version);
  return { ApplicationVersion: presentApplicationVersion(version) };
};

const UpdateConfigurationTemplate: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "ApplicationName");
  const templateName = requireString(input, "TemplateName");
  requireApplication(ctx, applicationName);
  const template = ctx.store.get<StoredConfigurationTemplate>(
    configurationTemplateKey(applicationName, templateName),
  );
  if (template === undefined) {
    throw awsError(
      "InvalidParameterValue",
      `No Configuration Template named '${templateName}' found.`,
      400,
    );
  }
  template.Description =
    optionalString(input, "Description") ?? template.Description;
  if (Array.isArray(input.OptionSettings)) {
    const newSettings = (input.OptionSettings as unknown[]).map((s) => {
      const setting = s as Record<string, unknown>;
      return {
        ResourceName: optionalString(setting, "ResourceName"),
        Namespace: optionalString(setting, "Namespace"),
        OptionName: optionalString(setting, "OptionName"),
        Value: optionalString(setting, "Value"),
      };
    });
    template.OptionSettings = newSettings;
  }
  if (Array.isArray(input.OptionsToRemove)) {
    const toRemove = (input.OptionsToRemove as unknown[]).map((s) => {
      const spec = s as Record<string, unknown>;
      return {
        Namespace: optionalString(spec, "Namespace"),
        OptionName: optionalString(spec, "OptionName"),
      };
    });
    template.OptionSettings = template.OptionSettings.filter(
      (os) =>
        !toRemove.some(
          (r) => r.Namespace === os.Namespace && r.OptionName === os.OptionName,
        ),
    );
  }
  template.DateUpdated = new Date().toISOString();
  ctx.store.set(
    configurationTemplateKey(applicationName, templateName),
    template,
  );
  return presentConfigurationTemplate(template);
};

const UpdateEnvironment: OperationHandler = (input, ctx) => {
  const environmentId = optionalString(input, "EnvironmentId");
  const environmentName = optionalString(input, "EnvironmentName");
  if (environmentId === undefined && environmentName === undefined) {
    throw awsError(
      "InvalidParameterValue",
      "Either EnvironmentId or EnvironmentName must be specified.",
      400,
    );
  }
  const entry = ctx.store
    .list<StoredEnvironment>()
    .filter((e) => e.key.startsWith("environment/"))
    .find(
      (e) =>
        (environmentId !== undefined
          ? e.value.EnvironmentId === environmentId
          : true) &&
        (environmentName !== undefined
          ? e.value.EnvironmentName === environmentName
          : true),
    );
  if (entry === undefined) {
    throw awsError(
      "InvalidParameterValue",
      "No environment found for the specified identifier.",
      400,
    );
  }
  const env = entry.value;
  const newDescription = optionalString(input, "Description");
  if (newDescription !== undefined) env.Description = newDescription;
  const newVersionLabel = optionalString(input, "VersionLabel");
  if (newVersionLabel !== undefined) {
    const versionExists = ctx.store.get<StoredApplicationVersion>(
      applicationVersionKey(env.ApplicationName, newVersionLabel),
    );
    if (versionExists === undefined) {
      throw awsError(
        "InvalidParameterValue",
        `No Application Version named '${newVersionLabel}' found.`,
        400,
      );
    }
    env.VersionLabel = newVersionLabel;
  }
  const newSolutionStack = optionalString(input, "SolutionStackName");
  if (newSolutionStack !== undefined) {
    if (!SYNTHETIC_SOLUTION_STACKS.includes(newSolutionStack)) {
      throw awsError(
        "InvalidParameterValue",
        `Invalid solution stack name: '${newSolutionStack}'.`,
        400,
      );
    }
    env.SolutionStackName = newSolutionStack;
  }
  const newPlatformArn = optionalString(input, "PlatformArn");
  if (newPlatformArn !== undefined) {
    if (isCustomPlatformArn(newPlatformArn)) {
      const platformExists = ctx.store.get<StoredPlatformVersion>(
        platformVersionKey(newPlatformArn),
      );
      if (platformExists === undefined) {
        throw awsError(
          "InvalidParameterValue",
          `No platform version found for '${newPlatformArn}'.`,
          400,
        );
      }
    }
    env.PlatformArn = newPlatformArn;
  }
  const newTemplateName = optionalString(input, "TemplateName");
  if (newTemplateName !== undefined) env.TemplateName = newTemplateName;
  env.DateUpdated = new Date().toISOString();
  ctx.store.set(environmentKey(env.EnvironmentId), env);
  return presentEnvironment(env);
};

const UpdateTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const existing =
    ctx.store.get<Record<string, string>>(resourceTagsKey(resourceArn)) ?? {};
  const updated = { ...existing };
  if (Array.isArray(input.TagsToAdd)) {
    for (const tag of input.TagsToAdd as unknown[]) {
      const t = tag as Record<string, unknown>;
      const key = optionalString(t, "Key");
      const value = optionalString(t, "Value");
      if (key !== undefined && value !== undefined) {
        updated[key] = value;
      }
    }
  }
  if (Array.isArray(input.TagsToRemove)) {
    for (const key of input.TagsToRemove as unknown[]) {
      if (typeof key === "string") {
        delete updated[key];
      }
    }
  }
  ctx.store.set(resourceTagsKey(resourceArn), updated);
  return {};
};

const ValidateConfigurationSettings: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "ApplicationName");
  requireApplication(ctx, applicationName);
  return {
    Messages: [],
  };
};

const elasticbeanstalk: ServiceDefinition = {
  name: "elasticbeanstalk",
  protocol: "query",
  operations: {
    AbortEnvironmentUpdate,
    ApplyEnvironmentManagedAction,
    AssociateEnvironmentOperationsRole,
    CheckDNSAvailability,
    ComposeEnvironments,
    CreateApplication,
    CreateApplicationVersion,
    CreateConfigurationTemplate,
    CreateEnvironment,
    CreatePlatformVersion,
    CreateStorageLocation,
    DeleteApplication,
    DeleteApplicationVersion,
    DeleteConfigurationTemplate,
    DeleteEnvironmentConfiguration,
    DeletePlatformVersion,
    DescribeAccountAttributes,
    DescribeApplicationVersions,
    DescribeApplications,
    DescribeConfigurationOptions,
    DescribeConfigurationSettings,
    DescribeEnvironmentHealth,
    DescribeEnvironmentManagedActionHistory,
    DescribeEnvironmentManagedActions,
    DescribeEnvironmentResources,
    DescribeEnvironments,
    DescribeEvents,
    DescribeInstancesHealth,
    DescribePlatformVersion,
    DisassociateEnvironmentOperationsRole,
    ListAvailableSolutionStacks,
    ListPlatformBranches,
    ListPlatformVersions,
    ListTagsForResource,
    RebuildEnvironment,
    RequestEnvironmentInfo,
    RestartAppServer,
    RetrieveEnvironmentInfo,
    SwapEnvironmentCNAMEs,
    TerminateEnvironment,
    UpdateApplication,
    UpdateApplicationResourceLifecycle,
    UpdateApplicationVersion,
    UpdateConfigurationTemplate,
    UpdateEnvironment,
    UpdateTagsForResource,
    ValidateConfigurationSettings,
  },
  model,
} as const;

export default elasticbeanstalk;
