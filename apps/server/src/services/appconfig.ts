import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import appconfigModel from "../../../../test/vendor/aws-models/appconfig.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(appconfigModel);

const applicationPrefix = "application:" as const;
const environmentPrefix = "environment:" as const;
const configProfilePrefix = "configprofile:" as const;
const deploymentStrategyPrefix = "deploymentstrategy:" as const;
const extensionPrefix = "extension:" as const;
const extensionAssocPrefix = "extensionassoc:" as const;
const hostedConfigVersionPrefix = "hostedconfigversion:" as const;
const deploymentPrefix = "deployment:" as const;
const tagsPrefix = "tags:" as const;
const accountSettingsKey = "accountsettings" as const;

type StoredApplication = {
  Id: string;
  Name: string;
  Description: string | undefined;
};

type StoredEnvironment = {
  ApplicationId: string;
  Id: string;
  Name: string;
  Description: string | undefined;
  State: string;
  Monitors: unknown[];
};

type StoredConfigurationProfile = {
  ApplicationId: string;
  Id: string;
  Name: string;
  Description: string | undefined;
  LocationUri: string;
  RetrievalRoleArn: string | undefined;
  Validators: unknown[];
  Type: string | undefined;
  KmsKeyArn: string | undefined;
  KmsKeyIdentifier: string | undefined;
};

type StoredDeploymentStrategy = {
  Id: string;
  Name: string;
  Description: string | undefined;
  DeploymentDurationInMinutes: number;
  GrowthType: string;
  GrowthFactor: number;
  FinalBakeTimeInMinutes: number;
  ReplicateTo: string;
};

type StoredExtension = {
  Id: string;
  Name: string;
  VersionNumber: number;
  Arn: string;
  Description: string | undefined;
  Actions: unknown;
  Parameters: unknown;
};

type StoredExtensionAssociation = {
  Id: string;
  ExtensionArn: string;
  ResourceArn: string;
  Arn: string;
  Parameters: unknown;
  ExtensionVersionNumber: number;
};

type StoredHostedConfigurationVersion = {
  ApplicationId: string;
  ConfigurationProfileId: string;
  VersionNumber: number;
  Description: string | undefined;
  Content: string | Uint8Array;
  ContentType: string;
  VersionLabel: string | undefined;
  KmsKeyArn: string | undefined;
};

type StoredDeployment = {
  ApplicationId: string;
  EnvironmentId: string;
  DeploymentStrategyId: string;
  ConfigurationProfileId: string;
  DeploymentNumber: number;
  ConfigurationName: string;
  ConfigurationLocationUri: string;
  ConfigurationVersion: string;
  Description: string | undefined;
  DeploymentDurationInMinutes: number;
  GrowthType: string;
  GrowthFactor: number;
  FinalBakeTimeInMinutes: number;
  State: string;
  EventLog: unknown[];
  PercentageComplete: number;
  StartedAt: string;
  CompletedAt: string | undefined;
  AppliedExtensions: unknown[];
  KmsKeyArn: string | undefined;
  KmsKeyIdentifier: string | undefined;
  VersionLabel: string | undefined;
};

type StoredAccountSettings = {
  DeletionProtection: unknown;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("BadRequestException", `${field} is required.`, 400);
  }
  return value;
};

const requireNumber = (
  input: Record<string, unknown>,
  field: string,
): number => {
  const value = numberOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("BadRequestException", `${field} is required.`, 400);
  }
  return value;
};

const newId = (): string => crypto.randomUUID().replaceAll("-", "").slice(0, 7);

const encodePageToken = (offset: number): string =>
  Buffer.from(String(offset), "utf8").toString("base64");

const decodePageToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") return 0;
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const paginate = <T>(
  items: T[],
  maxResults: number,
  nextToken: unknown,
): { page: T[]; nextToken: string | undefined } => {
  const offset = decodePageToken(nextToken);
  const page = items.slice(offset, offset + maxResults);
  const nextOffset = offset + maxResults;
  return {
    page,
    nextToken:
      nextOffset < items.length ? encodePageToken(nextOffset) : undefined,
  };
};

const applicationKey = (id: string): string => `${applicationPrefix}${id}`;

const environmentKey = (applicationId: string, id: string): string =>
  `${environmentPrefix}${applicationId}/${id}`;

const configProfileKey = (applicationId: string, id: string): string =>
  `${configProfilePrefix}${applicationId}/${id}`;

const deploymentStrategyKey = (id: string): string =>
  `${deploymentStrategyPrefix}${id}`;

const extensionKey = (id: string): string => `${extensionPrefix}${id}`;

const extensionAssocKey = (id: string): string =>
  `${extensionAssocPrefix}${id}`;

const hostedConfigVersionKey = (
  applicationId: string,
  profileId: string,
  versionNumber: number,
): string =>
  `${hostedConfigVersionPrefix}${applicationId}/${profileId}/${versionNumber}`;

const deploymentKey = (
  applicationId: string,
  environmentId: string,
  deploymentNumber: number,
): string =>
  `${deploymentPrefix}${applicationId}/${environmentId}/${deploymentNumber}`;

const tagsKey = (resourceArn: string): string => `${tagsPrefix}${resourceArn}`;

const makeArn = (
  ctx: ServiceContext,
  resourceType: string,
  ...parts: string[]
): string =>
  `arn:aws:appconfig:${ctx.region}:${ctx.account}:${resourceType}/${parts.join("/")}`;

const applicationView = (
  application: StoredApplication,
): Record<string, unknown> => ({
  Id: application.Id,
  Name: application.Name,
  Description: application.Description,
});

const environmentView = (
  environment: StoredEnvironment,
): Record<string, unknown> => ({
  ApplicationId: environment.ApplicationId,
  Id: environment.Id,
  Name: environment.Name,
  Description: environment.Description,
  State: environment.State,
  Monitors: environment.Monitors,
});

const configProfileView = (
  profile: StoredConfigurationProfile,
): Record<string, unknown> => ({
  ApplicationId: profile.ApplicationId,
  Id: profile.Id,
  Name: profile.Name,
  Description: profile.Description,
  LocationUri: profile.LocationUri,
  RetrievalRoleArn: profile.RetrievalRoleArn,
  Validators: profile.Validators,
  Type: profile.Type,
  KmsKeyArn: profile.KmsKeyArn,
});

const deploymentStrategyView = (
  strategy: StoredDeploymentStrategy,
): Record<string, unknown> => ({
  Id: strategy.Id,
  Name: strategy.Name,
  Description: strategy.Description,
  DeploymentDurationInMinutes: strategy.DeploymentDurationInMinutes,
  GrowthType: strategy.GrowthType,
  GrowthFactor: strategy.GrowthFactor,
  FinalBakeTimeInMinutes: strategy.FinalBakeTimeInMinutes,
  ReplicateTo: strategy.ReplicateTo,
});

const extensionView = (
  extension: StoredExtension,
): Record<string, unknown> => ({
  Id: extension.Id,
  Name: extension.Name,
  VersionNumber: extension.VersionNumber,
  Arn: extension.Arn,
  Description: extension.Description,
  Actions: extension.Actions,
  Parameters: extension.Parameters,
});

const extensionAssocView = (
  assoc: StoredExtensionAssociation,
): Record<string, unknown> => ({
  Id: assoc.Id,
  ExtensionArn: assoc.ExtensionArn,
  ResourceArn: assoc.ResourceArn,
  Arn: assoc.Arn,
  Parameters: assoc.Parameters,
  ExtensionVersionNumber: assoc.ExtensionVersionNumber,
});

const hostedConfigVersionView = (
  hcv: StoredHostedConfigurationVersion,
): Record<string, unknown> => ({
  ApplicationId: hcv.ApplicationId,
  ConfigurationProfileId: hcv.ConfigurationProfileId,
  VersionNumber: hcv.VersionNumber,
  Description: hcv.Description,
  Content: hcv.Content,
  ContentType: hcv.ContentType,
  VersionLabel: hcv.VersionLabel,
  KmsKeyArn: hcv.KmsKeyArn,
});

const deploymentView = (
  deployment: StoredDeployment,
): Record<string, unknown> => ({
  ApplicationId: deployment.ApplicationId,
  EnvironmentId: deployment.EnvironmentId,
  DeploymentStrategyId: deployment.DeploymentStrategyId,
  ConfigurationProfileId: deployment.ConfigurationProfileId,
  DeploymentNumber: deployment.DeploymentNumber,
  ConfigurationName: deployment.ConfigurationName,
  ConfigurationLocationUri: deployment.ConfigurationLocationUri,
  ConfigurationVersion: deployment.ConfigurationVersion,
  Description: deployment.Description,
  DeploymentDurationInMinutes: deployment.DeploymentDurationInMinutes,
  GrowthType: deployment.GrowthType,
  GrowthFactor: deployment.GrowthFactor,
  FinalBakeTimeInMinutes: deployment.FinalBakeTimeInMinutes,
  State: deployment.State,
  EventLog: deployment.EventLog,
  PercentageComplete: deployment.PercentageComplete,
  StartedAt: deployment.StartedAt,
  CompletedAt: deployment.CompletedAt,
  AppliedExtensions: deployment.AppliedExtensions,
  KmsKeyArn: deployment.KmsKeyArn,
  KmsKeyIdentifier: deployment.KmsKeyIdentifier,
  VersionLabel: deployment.VersionLabel,
});

const requireApplication = (
  ctx: ServiceContext,
  id: string,
): StoredApplication => {
  const stored = ctx.store.get<StoredApplication>(applicationKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Application not found for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requireEnvironment = (
  ctx: ServiceContext,
  applicationId: string,
  id: string,
): StoredEnvironment => {
  const stored = ctx.store.get<StoredEnvironment>(
    environmentKey(applicationId, id),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Environment not found for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requireConfigProfile = (
  ctx: ServiceContext,
  applicationId: string,
  id: string,
): StoredConfigurationProfile => {
  const stored = ctx.store.get<StoredConfigurationProfile>(
    configProfileKey(applicationId, id),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Configuration Profile not found for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requireDeploymentStrategy = (
  ctx: ServiceContext,
  id: string,
): StoredDeploymentStrategy => {
  const stored = ctx.store.get<StoredDeploymentStrategy>(
    deploymentStrategyKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Deployment Strategy not found for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requireExtension = (ctx: ServiceContext, id: string): StoredExtension => {
  const stored = ctx.store.get<StoredExtension>(extensionKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Extension not found for identifier ${id}.`,
      404,
    );
  }
  return stored;
};

const requireExtensionAssoc = (
  ctx: ServiceContext,
  id: string,
): StoredExtensionAssociation => {
  const stored = ctx.store.get<StoredExtensionAssociation>(
    extensionAssocKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Extension Association not found for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requireHostedConfigVersion = (
  ctx: ServiceContext,
  applicationId: string,
  profileId: string,
  versionNumber: number,
): StoredHostedConfigurationVersion => {
  const stored = ctx.store.get<StoredHostedConfigurationVersion>(
    hostedConfigVersionKey(applicationId, profileId, versionNumber),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Hosted Configuration Version not found for version ${versionNumber}.`,
      404,
    );
  }
  return stored;
};

const findApplicationByIdOrName = (
  ctx: ServiceContext,
  idOrName: string,
): StoredApplication => {
  const byId = ctx.store.get<StoredApplication>(applicationKey(idOrName));
  if (byId !== undefined) return byId;
  const byName = ctx.store
    .list<StoredApplication>()
    .filter((e) => e.key.startsWith(applicationPrefix))
    .map((e) => e.value)
    .find((a) => a.Name === idOrName);
  if (byName !== undefined) return byName;
  throw awsError(
    "ResourceNotFoundException",
    `Application not found: ${idOrName}.`,
    404,
  );
};

const findEnvironmentByIdOrName = (
  ctx: ServiceContext,
  applicationId: string,
  idOrName: string,
): StoredEnvironment => {
  const byId = ctx.store.get<StoredEnvironment>(
    environmentKey(applicationId, idOrName),
  );
  if (byId !== undefined) return byId;
  const byName = ctx.store
    .list<StoredEnvironment>()
    .filter((e) => e.key.startsWith(`${environmentPrefix}${applicationId}/`))
    .map((e) => e.value)
    .find((e) => e.Name === idOrName);
  if (byName !== undefined) return byName;
  throw awsError(
    "ResourceNotFoundException",
    `Environment not found: ${idOrName}.`,
    404,
  );
};

const findConfigProfileByIdOrName = (
  ctx: ServiceContext,
  applicationId: string,
  idOrName: string,
): StoredConfigurationProfile => {
  const byId = ctx.store.get<StoredConfigurationProfile>(
    configProfileKey(applicationId, idOrName),
  );
  if (byId !== undefined) return byId;
  const byName = ctx.store
    .list<StoredConfigurationProfile>()
    .filter((e) => e.key.startsWith(`${configProfilePrefix}${applicationId}/`))
    .map((e) => e.value)
    .find((p) => p.Name === idOrName);
  if (byName !== undefined) return byName;
  throw awsError(
    "ResourceNotFoundException",
    `Configuration Profile not found: ${idOrName}.`,
    404,
  );
};

const requireDeployment = (
  ctx: ServiceContext,
  applicationId: string,
  environmentId: string,
  deploymentNumber: number,
): StoredDeployment => {
  const stored = ctx.store.get<StoredDeployment>(
    deploymentKey(applicationId, environmentId, deploymentNumber),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Deployment not found for deployment number ${deploymentNumber}.`,
      404,
    );
  }
  return stored;
};

const CreateApplication: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const id = newId();
  const application: StoredApplication = {
    Id: id,
    Name: name,
    Description: stringOrUndefined(input["Description"]),
  };
  ctx.store.set(applicationKey(id), application);
  const tags = input["Tags"] as Record<string, string> | undefined;
  if (tags && Object.keys(tags).length > 0) {
    ctx.store.set(tagsKey(makeArn(ctx, "application", id)), tags);
  }
  return applicationView(application);
};

const GetApplication: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ApplicationId");
  return applicationView(requireApplication(ctx, id));
};

const ListApplications: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const applications = ctx.store
    .list<StoredApplication>()
    .filter((entry) => entry.key.startsWith(applicationPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0));
  const { page, nextToken } = paginate(applications, max, input["NextToken"]);
  return { Items: page.map(applicationView), NextToken: nextToken };
};

const UpdateApplication: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ApplicationId");
  const existing = requireApplication(ctx, id);
  const application: StoredApplication = {
    Id: existing.Id,
    Name: stringOrUndefined(input["Name"]) ?? existing.Name,
    Description:
      stringOrUndefined(input["Description"]) ?? existing.Description,
  };
  ctx.store.set(applicationKey(id), application);
  return applicationView(application);
};

const DeleteApplication: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ApplicationId");
  requireApplication(ctx, id);
  ctx.store.delete(applicationKey(id));
  ctx.store.delete(tagsKey(makeArn(ctx, "application", id)));
  return {};
};

const CreateEnvironment: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const name = requireString(input, "Name");
  requireApplication(ctx, applicationId);
  const id = newId();
  const environment: StoredEnvironment = {
    ApplicationId: applicationId,
    Id: id,
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    State: "READY_FOR_DEPLOYMENT",
    Monitors: arrayOrEmpty(input["Monitors"]),
  };
  ctx.store.set(environmentKey(applicationId, id), environment);
  const tags = input["Tags"] as Record<string, string> | undefined;
  if (tags && Object.keys(tags).length > 0) {
    ctx.store.set(
      tagsKey(makeArn(ctx, "application", applicationId, "environment", id)),
      tags,
    );
  }
  return environmentView(environment);
};

const GetEnvironment: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const id = requireString(input, "EnvironmentId");
  return environmentView(requireEnvironment(ctx, applicationId, id));
};

const ListEnvironments: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  requireApplication(ctx, applicationId);
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const environments = ctx.store
    .list<StoredEnvironment>()
    .filter((entry) =>
      entry.key.startsWith(`${environmentPrefix}${applicationId}/`),
    )
    .map((entry) => entry.value)
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0));
  const { page, nextToken } = paginate(environments, max, input["NextToken"]);
  return { Items: page.map(environmentView), NextToken: nextToken };
};

const UpdateEnvironment: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const id = requireString(input, "EnvironmentId");
  const existing = requireEnvironment(ctx, applicationId, id);
  const environment: StoredEnvironment = {
    ApplicationId: existing.ApplicationId,
    Id: existing.Id,
    Name: stringOrUndefined(input["Name"]) ?? existing.Name,
    Description:
      stringOrUndefined(input["Description"]) ?? existing.Description,
    State: existing.State,
    Monitors: Array.isArray(input["Monitors"])
      ? input["Monitors"]
      : existing.Monitors,
  };
  ctx.store.set(environmentKey(applicationId, id), environment);
  return environmentView(environment);
};

const DeleteEnvironment: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const id = requireString(input, "EnvironmentId");
  requireEnvironment(ctx, applicationId, id);
  const activeDeployments = ctx.store
    .list<StoredDeployment>()
    .filter(
      (entry) =>
        entry.key.startsWith(`${deploymentPrefix}${applicationId}/${id}/`) &&
        entry.value.State === "DEPLOYING",
    );
  if (activeDeployments.length > 0) {
    throw awsError(
      "ConflictException",
      `Environment ${id} has an active deployment. Stop the deployment before deleting the environment.`,
      409,
    );
  }
  ctx.store.delete(environmentKey(applicationId, id));
  ctx.store.delete(
    tagsKey(makeArn(ctx, "application", applicationId, "environment", id)),
  );
  return {};
};

const CreateConfigurationProfile: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const name = requireString(input, "Name");
  const locationUri = requireString(input, "LocationUri");
  requireApplication(ctx, applicationId);
  const id = newId();
  const profile: StoredConfigurationProfile = {
    ApplicationId: applicationId,
    Id: id,
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    LocationUri: locationUri,
    RetrievalRoleArn: stringOrUndefined(input["RetrievalRoleArn"]),
    Validators: arrayOrEmpty(input["Validators"]),
    Type: stringOrUndefined(input["Type"]),
    KmsKeyArn: undefined,
    KmsKeyIdentifier: stringOrUndefined(input["KmsKeyIdentifier"]),
  };
  ctx.store.set(configProfileKey(applicationId, id), profile);
  const tags = input["Tags"] as Record<string, string> | undefined;
  if (tags && Object.keys(tags).length > 0) {
    ctx.store.set(
      tagsKey(
        makeArn(
          ctx,
          "application",
          applicationId,
          "configurationprofile",
          id,
        ),
      ),
      tags,
    );
  }
  return configProfileView(profile);
};

const GetConfigurationProfile: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const id = requireString(input, "ConfigurationProfileId");
  return configProfileView(requireConfigProfile(ctx, applicationId, id));
};

const ListConfigurationProfiles: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  requireApplication(ctx, applicationId);
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const profiles = ctx.store
    .list<StoredConfigurationProfile>()
    .filter((entry) =>
      entry.key.startsWith(`${configProfilePrefix}${applicationId}/`),
    )
    .map((entry) => entry.value)
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0));
  const { page, nextToken } = paginate(profiles, max, input["NextToken"]);
  return { Items: page.map(configProfileView), NextToken: nextToken };
};

const UpdateConfigurationProfile: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const id = requireString(input, "ConfigurationProfileId");
  const existing = requireConfigProfile(ctx, applicationId, id);
  const profile: StoredConfigurationProfile = {
    ApplicationId: existing.ApplicationId,
    Id: existing.Id,
    Name: stringOrUndefined(input["Name"]) ?? existing.Name,
    Description:
      stringOrUndefined(input["Description"]) ?? existing.Description,
    LocationUri: existing.LocationUri,
    RetrievalRoleArn:
      stringOrUndefined(input["RetrievalRoleArn"]) ?? existing.RetrievalRoleArn,
    Validators: Array.isArray(input["Validators"])
      ? input["Validators"]
      : existing.Validators,
    Type: existing.Type,
    KmsKeyArn: existing.KmsKeyArn,
    KmsKeyIdentifier:
      stringOrUndefined(input["KmsKeyIdentifier"]) ?? existing.KmsKeyIdentifier,
  };
  ctx.store.set(configProfileKey(applicationId, id), profile);
  return configProfileView(profile);
};

const DeleteConfigurationProfile: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const id = requireString(input, "ConfigurationProfileId");
  requireConfigProfile(ctx, applicationId, id);
  ctx.store.delete(configProfileKey(applicationId, id));
  ctx.store.delete(
    tagsKey(
      makeArn(ctx, "application", applicationId, "configurationprofile", id),
    ),
  );
  return {};
};

const CreateDeploymentStrategy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const duration = requireNumber(input, "DeploymentDurationInMinutes");
  const growthFactor = requireNumber(input, "GrowthFactor");
  const id = newId();
  const strategy: StoredDeploymentStrategy = {
    Id: id,
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    DeploymentDurationInMinutes: duration,
    GrowthType: stringOrUndefined(input["GrowthType"]) ?? "LINEAR",
    GrowthFactor: growthFactor,
    FinalBakeTimeInMinutes:
      numberOrUndefined(input["FinalBakeTimeInMinutes"]) ?? 0,
    ReplicateTo: stringOrUndefined(input["ReplicateTo"]) ?? "NONE",
  };
  ctx.store.set(deploymentStrategyKey(id), strategy);
  const tags = input["Tags"] as Record<string, string> | undefined;
  if (tags && Object.keys(tags).length > 0) {
    ctx.store.set(tagsKey(makeArn(ctx, "deploymentstrategy", id)), tags);
  }
  return deploymentStrategyView(strategy);
};

const GetDeploymentStrategy: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DeploymentStrategyId");
  return deploymentStrategyView(requireDeploymentStrategy(ctx, id));
};

const ListDeploymentStrategies: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const strategies = ctx.store
    .list<StoredDeploymentStrategy>()
    .filter((entry) => entry.key.startsWith(deploymentStrategyPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0));
  const { page, nextToken } = paginate(strategies, max, input["NextToken"]);
  return { Items: page.map(deploymentStrategyView), NextToken: nextToken };
};

const UpdateDeploymentStrategy: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DeploymentStrategyId");
  const existing = requireDeploymentStrategy(ctx, id);
  const strategy: StoredDeploymentStrategy = {
    Id: existing.Id,
    Name: stringOrUndefined(input["Name"]) ?? existing.Name,
    Description:
      stringOrUndefined(input["Description"]) ?? existing.Description,
    DeploymentDurationInMinutes:
      numberOrUndefined(input["DeploymentDurationInMinutes"]) ??
      existing.DeploymentDurationInMinutes,
    GrowthType: stringOrUndefined(input["GrowthType"]) ?? existing.GrowthType,
    GrowthFactor:
      numberOrUndefined(input["GrowthFactor"]) ?? existing.GrowthFactor,
    FinalBakeTimeInMinutes:
      numberOrUndefined(input["FinalBakeTimeInMinutes"]) ??
      existing.FinalBakeTimeInMinutes,
    ReplicateTo: existing.ReplicateTo,
  };
  ctx.store.set(deploymentStrategyKey(id), strategy);
  return deploymentStrategyView(strategy);
};

const DeleteDeploymentStrategy: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DeploymentStrategyId");
  requireDeploymentStrategy(ctx, id);
  ctx.store.delete(deploymentStrategyKey(id));
  ctx.store.delete(tagsKey(makeArn(ctx, "deploymentstrategy", id)));
  return {};
};

const CreateExtension: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const id = newId();
  const extension: StoredExtension = {
    Id: id,
    Name: name,
    VersionNumber: 1,
    Arn: makeArn(ctx, "extension", id),
    Description: stringOrUndefined(input["Description"]),
    Actions: input["Actions"] ?? {},
    Parameters: input["Parameters"] ?? {},
  };
  ctx.store.set(extensionKey(id), extension);
  const tags = input["Tags"] as Record<string, string> | undefined;
  if (tags && Object.keys(tags).length > 0) {
    ctx.store.set(tagsKey(extension.Arn), tags);
  }
  return extensionView(extension);
};

const GetExtension: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ExtensionIdentifier");
  return extensionView(requireExtension(ctx, id));
};

const ListExtensions: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const nameFilter = stringOrUndefined(input["Name"]);
  let extensions = ctx.store
    .list<StoredExtension>()
    .filter((entry) => entry.key.startsWith(extensionPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0));
  if (nameFilter !== undefined) {
    extensions = extensions.filter((e) => e.Name === nameFilter);
  }
  const { page, nextToken } = paginate(extensions, max, input["NextToken"]);
  return { Items: page.map(extensionView), NextToken: nextToken };
};

const UpdateExtension: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ExtensionIdentifier");
  const existing = requireExtension(ctx, id);
  const extension: StoredExtension = {
    Id: existing.Id,
    Name: existing.Name,
    VersionNumber: existing.VersionNumber + 1,
    Arn: existing.Arn,
    Description:
      stringOrUndefined(input["Description"]) ?? existing.Description,
    Actions: input["Actions"] ?? existing.Actions,
    Parameters: input["Parameters"] ?? existing.Parameters,
  };
  ctx.store.set(extensionKey(id), extension);
  return extensionView(extension);
};

const DeleteExtension: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ExtensionIdentifier");
  const extension = requireExtension(ctx, id);
  const associations = ctx.store
    .list<StoredExtensionAssociation>()
    .filter(
      (entry) =>
        entry.key.startsWith(extensionAssocPrefix) &&
        entry.value.ExtensionArn === extension.Arn,
    );
  if (associations.length > 0) {
    throw awsError(
      "ConflictException",
      `Extension ${id} has ${associations.length} active association(s). Delete all associations before deleting the extension.`,
      409,
    );
  }
  ctx.store.delete(extensionKey(id));
  ctx.store.delete(tagsKey(extension.Arn));
  return {};
};

const CreateExtensionAssociation: OperationHandler = (input, ctx) => {
  const extensionId = requireString(input, "ExtensionIdentifier");
  const resourceIdentifier = requireString(input, "ResourceIdentifier");
  const extension = requireExtension(ctx, extensionId);
  const id = newId();
  const assoc: StoredExtensionAssociation = {
    Id: id,
    ExtensionArn: extension.Arn,
    ResourceArn: resourceIdentifier,
    Arn: makeArn(ctx, "extensionassociation", id),
    Parameters: input["Parameters"] ?? {},
    ExtensionVersionNumber:
      numberOrUndefined(input["ExtensionVersionNumber"]) ??
      extension.VersionNumber,
  };
  ctx.store.set(extensionAssocKey(id), assoc);
  const tags = input["Tags"] as Record<string, string> | undefined;
  if (tags && Object.keys(tags).length > 0) {
    ctx.store.set(tagsKey(assoc.Arn), tags);
  }
  return extensionAssocView(assoc);
};

const GetExtensionAssociation: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ExtensionAssociationId");
  return extensionAssocView(requireExtensionAssoc(ctx, id));
};

const ListExtensionAssociations: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const resourceIdFilter = stringOrUndefined(input["ResourceIdentifier"]);
  const extensionIdFilter = stringOrUndefined(input["ExtensionIdentifier"]);
  const extensionVersionFilter = numberOrUndefined(
    input["ExtensionVersionNumber"],
  );
  let assocs = ctx.store
    .list<StoredExtensionAssociation>()
    .filter((entry) => entry.key.startsWith(extensionAssocPrefix))
    .map((entry) => entry.value);
  if (resourceIdFilter !== undefined) {
    assocs = assocs.filter((a) => a.ResourceArn === resourceIdFilter);
  }
  if (extensionIdFilter !== undefined) {
    assocs = assocs.filter((a) => a.ExtensionArn.includes(extensionIdFilter));
  }
  if (extensionVersionFilter !== undefined) {
    assocs = assocs.filter(
      (a) => a.ExtensionVersionNumber === extensionVersionFilter,
    );
  }
  const { page, nextToken } = paginate(assocs, max, input["NextToken"]);
  return { Items: page.map(extensionAssocView), NextToken: nextToken };
};

const UpdateExtensionAssociation: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ExtensionAssociationId");
  const existing = requireExtensionAssoc(ctx, id);
  const assoc: StoredExtensionAssociation = {
    Id: existing.Id,
    ExtensionArn: existing.ExtensionArn,
    ResourceArn: existing.ResourceArn,
    Arn: existing.Arn,
    Parameters: input["Parameters"] ?? existing.Parameters,
    ExtensionVersionNumber: existing.ExtensionVersionNumber,
  };
  ctx.store.set(extensionAssocKey(id), assoc);
  return extensionAssocView(assoc);
};

const DeleteExtensionAssociation: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ExtensionAssociationId");
  const assoc = requireExtensionAssoc(ctx, id);
  ctx.store.delete(extensionAssocKey(id));
  ctx.store.delete(tagsKey(assoc.Arn));
  return {};
};

const CreateHostedConfigurationVersion: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const profileId = requireString(input, "ConfigurationProfileId");
  const contentType = requireString(input, "ContentType");
  requireConfigProfile(ctx, applicationId, profileId);
  const existingVersions = ctx.store
    .list<StoredHostedConfigurationVersion>()
    .filter((entry) =>
      entry.key.startsWith(
        `${hostedConfigVersionPrefix}${applicationId}/${profileId}/`,
      ),
    );
  const latestVersionNumber = numberOrUndefined(input["LatestVersionNumber"]);
  if (latestVersionNumber !== undefined) {
    const currentLatest =
      existingVersions.length > 0
        ? Math.max(...existingVersions.map((v) => v.value.VersionNumber))
        : 0;
    if (currentLatest !== latestVersionNumber) {
      throw awsError(
        "ConflictException",
        `Latest version number mismatch: provided ${latestVersionNumber}, current latest is ${currentLatest}.`,
        409,
      );
    }
  }
  const nextVersion = existingVersions.length + 1;
  const rawContent = input["Content"];
  const content: string | Uint8Array =
    typeof rawContent === "string"
      ? rawContent
      : rawContent instanceof Uint8Array
        ? rawContent
        : "";
  const hcv: StoredHostedConfigurationVersion = {
    ApplicationId: applicationId,
    ConfigurationProfileId: profileId,
    VersionNumber: nextVersion,
    Description: stringOrUndefined(input["Description"]),
    Content: content,
    ContentType: contentType,
    VersionLabel: stringOrUndefined(input["VersionLabel"]),
    KmsKeyArn: undefined,
  };
  ctx.store.set(
    hostedConfigVersionKey(applicationId, profileId, nextVersion),
    hcv,
  );
  return hostedConfigVersionView(hcv);
};

const GetHostedConfigurationVersion: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const profileId = requireString(input, "ConfigurationProfileId");
  const versionNumber = requireNumber(input, "VersionNumber");
  return hostedConfigVersionView(
    requireHostedConfigVersion(ctx, applicationId, profileId, versionNumber),
  );
};

const ListHostedConfigurationVersions: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const profileId = requireString(input, "ConfigurationProfileId");
  requireConfigProfile(ctx, applicationId, profileId);
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const versionLabelFilter = stringOrUndefined(input["VersionLabel"]);
  let versions = ctx.store
    .list<StoredHostedConfigurationVersion>()
    .filter((entry) =>
      entry.key.startsWith(
        `${hostedConfigVersionPrefix}${applicationId}/${profileId}/`,
      ),
    )
    .map((entry) => entry.value)
    .sort((a, b) => a.VersionNumber - b.VersionNumber);
  if (versionLabelFilter !== undefined) {
    versions = versions.filter((v) =>
      v.VersionLabel?.startsWith(versionLabelFilter),
    );
  }
  const { page, nextToken } = paginate(versions, max, input["NextToken"]);
  return {
    Items: page.map((v) => ({
      ApplicationId: v.ApplicationId,
      ConfigurationProfileId: v.ConfigurationProfileId,
      VersionNumber: v.VersionNumber,
      Description: v.Description,
      ContentType: v.ContentType,
      VersionLabel: v.VersionLabel,
      KmsKeyArn: v.KmsKeyArn,
    })),
    NextToken: nextToken,
  };
};

const DeleteHostedConfigurationVersion: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const profileId = requireString(input, "ConfigurationProfileId");
  const versionNumber = requireNumber(input, "VersionNumber");
  requireHostedConfigVersion(ctx, applicationId, profileId, versionNumber);
  const referencingDeployments = ctx.store
    .list<StoredDeployment>()
    .filter(
      (entry) =>
        entry.key.startsWith(`${deploymentPrefix}${applicationId}/`) &&
        entry.value.ConfigurationProfileId === profileId &&
        entry.value.ConfigurationVersion === String(versionNumber),
    );
  if (referencingDeployments.length > 0) {
    throw awsError(
      "ConflictException",
      `Hosted configuration version ${versionNumber} is referenced by ${referencingDeployments.length} deployment(s).`,
      409,
    );
  }
  ctx.store.delete(
    hostedConfigVersionKey(applicationId, profileId, versionNumber),
  );
  return {};
};

const StartDeployment: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const environmentId = requireString(input, "EnvironmentId");
  const strategyId = requireString(input, "DeploymentStrategyId");
  const profileId = requireString(input, "ConfigurationProfileId");
  const configVersion = requireString(input, "ConfigurationVersion");
  requireEnvironment(ctx, applicationId, environmentId);
  const strategy = requireDeploymentStrategy(ctx, strategyId);
  const profile = requireConfigProfile(ctx, applicationId, profileId);
  const existingDeployments = ctx.store
    .list<StoredDeployment>()
    .filter((entry) =>
      entry.key.startsWith(
        `${deploymentPrefix}${applicationId}/${environmentId}/`,
      ),
    );
  const nextNumber = existingDeployments.length + 1;
  const now = new Date().toISOString();
  const configVersionNumber = Number.parseInt(configVersion, 10);
  const hcv =
    Number.isFinite(configVersionNumber) && configVersionNumber > 0
      ? ctx.store.get<StoredHostedConfigurationVersion>(
          hostedConfigVersionKey(applicationId, profileId, configVersionNumber),
        )
      : undefined;
  const deployment: StoredDeployment = {
    ApplicationId: applicationId,
    EnvironmentId: environmentId,
    DeploymentStrategyId: strategyId,
    ConfigurationProfileId: profileId,
    DeploymentNumber: nextNumber,
    ConfigurationName: profile.Name,
    ConfigurationLocationUri: profile.LocationUri,
    ConfigurationVersion: configVersion,
    Description: stringOrUndefined(input["Description"]),
    DeploymentDurationInMinutes: strategy.DeploymentDurationInMinutes,
    GrowthType: strategy.GrowthType,
    GrowthFactor: strategy.GrowthFactor,
    FinalBakeTimeInMinutes: strategy.FinalBakeTimeInMinutes,
    State: "COMPLETE",
    EventLog: [],
    PercentageComplete: 100.0,
    StartedAt: now,
    CompletedAt: now,
    AppliedExtensions: [],
    KmsKeyArn: undefined,
    KmsKeyIdentifier: stringOrUndefined(input["KmsKeyIdentifier"]),
    VersionLabel: hcv?.VersionLabel,
  };
  ctx.store.set(
    deploymentKey(applicationId, environmentId, nextNumber),
    deployment,
  );
  return deploymentView(deployment);
};

const GetDeployment: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const environmentId = requireString(input, "EnvironmentId");
  const deploymentNumber = requireNumber(input, "DeploymentNumber");
  return deploymentView(
    requireDeployment(ctx, applicationId, environmentId, deploymentNumber),
  );
};

const ListDeployments: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const environmentId = requireString(input, "EnvironmentId");
  requireEnvironment(ctx, applicationId, environmentId);
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const deployments = ctx.store
    .list<StoredDeployment>()
    .filter((entry) =>
      entry.key.startsWith(
        `${deploymentPrefix}${applicationId}/${environmentId}/`,
      ),
    )
    .map((entry) => entry.value)
    .sort((a, b) => b.DeploymentNumber - a.DeploymentNumber);
  const { page, nextToken } = paginate(deployments, max, input["NextToken"]);
  return { Items: page.map(deploymentView), NextToken: nextToken };
};

const StopDeployment: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const environmentId = requireString(input, "EnvironmentId");
  const deploymentNumber = requireNumber(input, "DeploymentNumber");
  const existing = requireDeployment(
    ctx,
    applicationId,
    environmentId,
    deploymentNumber,
  );
  const allowRevert = input["AllowRevert"] === true;
  if (existing.State === "ROLLED_BACK" || existing.State === "REVERTED") {
    throw awsError(
      "BadRequestException",
      `Deployment is already in a terminal state: ${existing.State}.`,
      400,
    );
  }
  if (!allowRevert && existing.State === "COMPLETE") {
    throw awsError(
      "BadRequestException",
      "Cannot stop a completed deployment without Allow-Revert header.",
      400,
    );
  }
  const newState =
    allowRevert && existing.State === "COMPLETE" ? "REVERTED" : "ROLLED_BACK";
  const deployment: StoredDeployment = {
    ApplicationId: existing.ApplicationId,
    EnvironmentId: existing.EnvironmentId,
    DeploymentStrategyId: existing.DeploymentStrategyId,
    ConfigurationProfileId: existing.ConfigurationProfileId,
    DeploymentNumber: existing.DeploymentNumber,
    ConfigurationName: existing.ConfigurationName,
    ConfigurationLocationUri: existing.ConfigurationLocationUri,
    ConfigurationVersion: existing.ConfigurationVersion,
    Description: existing.Description,
    DeploymentDurationInMinutes: existing.DeploymentDurationInMinutes,
    GrowthType: existing.GrowthType,
    GrowthFactor: existing.GrowthFactor,
    FinalBakeTimeInMinutes: existing.FinalBakeTimeInMinutes,
    State: newState,
    EventLog: existing.EventLog,
    PercentageComplete: existing.PercentageComplete,
    StartedAt: existing.StartedAt,
    CompletedAt: new Date().toISOString(),
    AppliedExtensions: existing.AppliedExtensions,
    KmsKeyArn: existing.KmsKeyArn,
    KmsKeyIdentifier: existing.KmsKeyIdentifier,
    VersionLabel: existing.VersionLabel,
  };
  ctx.store.set(
    deploymentKey(applicationId, environmentId, deploymentNumber),
    deployment,
  );
  return deploymentView(deployment);
};

const GetAccountSettings: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<StoredAccountSettings>(accountSettingsKey) ?? {
    DeletionProtection: { Enabled: false, ProtectionPeriodInMinutes: 60 },
  };
  return { DeletionProtection: stored.DeletionProtection };
};

const UpdateAccountSettings: OperationHandler = (input, ctx) => {
  const existing = ctx.store.get<StoredAccountSettings>(accountSettingsKey) ?? {
    DeletionProtection: { Enabled: false, ProtectionPeriodInMinutes: 60 },
  };
  const settings: StoredAccountSettings = {
    DeletionProtection:
      input["DeletionProtection"] ?? existing.DeletionProtection,
  };
  ctx.store.set(accountSettingsKey, settings);
  return { DeletionProtection: settings.DeletionProtection };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  return { Tags: tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const newTags = (input["Tags"] ?? {}) as Record<string, string>;
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  ctx.store.set(tagsKey(resourceArn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tagKeys = arrayOrEmpty(input["TagKeys"]) as string[];
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  const updated: Record<string, string> = {};
  for (const [k, v] of Object.entries(existing)) {
    if (!tagKeys.includes(k)) updated[k] = v;
  }
  ctx.store.set(tagsKey(resourceArn), updated);
  return {};
};

const GetConfiguration: OperationHandler = (input, ctx) => {
  const appIdOrName = requireString(input, "Application");
  const envIdOrName = requireString(input, "Environment");
  const configIdOrName = requireString(input, "Configuration");
  const clientConfigVersion = stringOrUndefined(
    input["ClientConfigurationVersion"],
  );
  const application = findApplicationByIdOrName(ctx, appIdOrName);
  const environment = findEnvironmentByIdOrName(
    ctx,
    application.Id,
    envIdOrName,
  );
  const profile = findConfigProfileByIdOrName(
    ctx,
    application.Id,
    configIdOrName,
  );
  const deployments = ctx.store
    .list<StoredDeployment>()
    .filter(
      (e) =>
        e.key.startsWith(
          `${deploymentPrefix}${application.Id}/${environment.Id}/`,
        ) &&
        e.value.State === "COMPLETE" &&
        e.value.ConfigurationProfileId === profile.Id,
    )
    .map((e) => e.value)
    .sort((a, b) => b.DeploymentNumber - a.DeploymentNumber);
  if (deployments.length === 0) {
    return {
      $status: 204,
      ConfigurationVersion: "0",
      ContentType: "application/octet-stream",
    };
  }
  const deployment = deployments[0];
  const configVersion = deployment.ConfigurationVersion;
  if (clientConfigVersion === configVersion) {
    return {
      $status: 204,
      ConfigurationVersion: configVersion,
      ContentType: "application/octet-stream",
    };
  }
  const configVersionNumber = Number.parseInt(configVersion, 10);
  const hcv =
    Number.isFinite(configVersionNumber) && configVersionNumber > 0
      ? ctx.store.get<StoredHostedConfigurationVersion>(
          hostedConfigVersionKey(
            application.Id,
            profile.Id,
            configVersionNumber,
          ),
        )
      : undefined;
  if (hcv === undefined) {
    return {
      $status: 204,
      ConfigurationVersion: configVersion,
      ContentType: "application/octet-stream",
    };
  }
  return {
    Content: hcv.Content,
    ConfigurationVersion: configVersion,
    ContentType: hcv.ContentType,
  };
};

const ValidateConfiguration: OperationHandler = (input, ctx) => {
  const applicationId = requireString(input, "ApplicationId");
  const profileId = requireString(input, "ConfigurationProfileId");
  const configVersion = requireString(input, "ConfigurationVersion");
  const profile = requireConfigProfile(ctx, applicationId, profileId);
  const versionNumber = Number.parseInt(configVersion, 10);
  const hcv =
    Number.isFinite(versionNumber) && versionNumber > 0
      ? ctx.store.get<StoredHostedConfigurationVersion>(
          hostedConfigVersionKey(applicationId, profileId, versionNumber),
        )
      : undefined;
  if (hcv === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Hosted configuration version ${configVersion} not found.`,
      404,
    );
  }
  const validators = profile.Validators as Array<{
    Type?: string;
    Content?: string;
  }>;
  for (const validator of validators) {
    if (validator.Type === "JSON_SCHEMA") {
      const contentStr =
        hcv.Content instanceof Uint8Array
          ? new TextDecoder().decode(hcv.Content)
          : hcv.Content;
      try {
        JSON.parse(contentStr);
      } catch {
        throw awsError(
          "BadRequestException",
          "Configuration content is not valid JSON.",
          400,
        );
      }
    }
  }
  return { $status: 204 };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const appconfig = {
  name: "appconfig",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);

    if (parts.length === 1 && parts[0] === "settings") {
      if (req.method === "GET") return "GetAccountSettings";
      if (req.method === "PATCH") return "UpdateAccountSettings";
      return undefined;
    }

    if (parts[0] === "tags") {
      if (parts.length >= 2) {
        if (req.method === "GET") return "ListTagsForResource";
        if (req.method === "POST") return "TagResource";
        if (req.method === "DELETE") return "UntagResource";
      }
      return undefined;
    }

    if (
      parts[0] === "deploymentstrategies" ||
      parts[0] === "deployementstrategies"
    ) {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateDeploymentStrategy";
        if (req.method === "GET") return "ListDeploymentStrategies";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetDeploymentStrategy";
        if (req.method === "PATCH") return "UpdateDeploymentStrategy";
        if (req.method === "DELETE") return "DeleteDeploymentStrategy";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "extensions") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateExtension";
        if (req.method === "GET") return "ListExtensions";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetExtension";
        if (req.method === "PATCH") return "UpdateExtension";
        if (req.method === "DELETE") return "DeleteExtension";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "extensionassociations") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateExtensionAssociation";
        if (req.method === "GET") return "ListExtensionAssociations";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetExtensionAssociation";
        if (req.method === "PATCH") return "UpdateExtensionAssociation";
        if (req.method === "DELETE") return "DeleteExtensionAssociation";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] !== "applications") return undefined;

    if (parts.length === 1) {
      if (req.method === "POST") return "CreateApplication";
      if (req.method === "GET") return "ListApplications";
      return undefined;
    }

    if (parts.length === 2) {
      if (req.method === "GET") return "GetApplication";
      if (req.method === "PATCH") return "UpdateApplication";
      if (req.method === "DELETE") return "DeleteApplication";
      return undefined;
    }

    const sub2 = parts[2];

    if (sub2 === "environments") {
      if (parts.length === 3) {
        if (req.method === "POST") return "CreateEnvironment";
        if (req.method === "GET") return "ListEnvironments";
        return undefined;
      }
      if (parts.length === 4) {
        if (req.method === "GET") return "GetEnvironment";
        if (req.method === "PATCH") return "UpdateEnvironment";
        if (req.method === "DELETE") return "DeleteEnvironment";
        return undefined;
      }
      const sub4 = parts[4];
      if (sub4 === "deployments") {
        if (parts.length === 5) {
          if (req.method === "POST") return "StartDeployment";
          if (req.method === "GET") return "ListDeployments";
          return undefined;
        }
        if (parts.length === 6) {
          if (req.method === "GET") return "GetDeployment";
          if (req.method === "DELETE") return "StopDeployment";
          return undefined;
        }
      }
      if (sub4 === "configurations" && parts.length === 6) {
        if (req.method === "GET") return "GetConfiguration";
        return undefined;
      }
      return undefined;
    }

    if (sub2 === "configurationprofiles") {
      if (parts.length === 3) {
        if (req.method === "POST") return "CreateConfigurationProfile";
        if (req.method === "GET") return "ListConfigurationProfiles";
        return undefined;
      }
      if (parts.length === 4) {
        if (req.method === "GET") return "GetConfigurationProfile";
        if (req.method === "PATCH") return "UpdateConfigurationProfile";
        if (req.method === "DELETE") return "DeleteConfigurationProfile";
        return undefined;
      }
      const sub4 = parts[4];
      if (sub4 === "hostedconfigurationversions") {
        if (parts.length === 5) {
          if (req.method === "POST") return "CreateHostedConfigurationVersion";
          if (req.method === "GET") return "ListHostedConfigurationVersions";
          return undefined;
        }
        if (parts.length === 6) {
          if (req.method === "GET") return "GetHostedConfigurationVersion";
          if (req.method === "DELETE")
            return "DeleteHostedConfigurationVersion";
          return undefined;
        }
      }
      if (sub4 === "validators" && parts.length === 5) {
        if (req.method === "POST") return "ValidateConfiguration";
        return undefined;
      }
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateApplication,
    GetApplication,
    ListApplications,
    UpdateApplication,
    DeleteApplication,
    CreateEnvironment,
    GetEnvironment,
    ListEnvironments,
    UpdateEnvironment,
    DeleteEnvironment,
    CreateConfigurationProfile,
    GetConfigurationProfile,
    ListConfigurationProfiles,
    UpdateConfigurationProfile,
    DeleteConfigurationProfile,
    CreateDeploymentStrategy,
    GetDeploymentStrategy,
    ListDeploymentStrategies,
    UpdateDeploymentStrategy,
    DeleteDeploymentStrategy,
    CreateExtension,
    GetExtension,
    ListExtensions,
    UpdateExtension,
    DeleteExtension,
    CreateExtensionAssociation,
    GetExtensionAssociation,
    ListExtensionAssociations,
    UpdateExtensionAssociation,
    DeleteExtensionAssociation,
    CreateHostedConfigurationVersion,
    GetHostedConfigurationVersion,
    ListHostedConfigurationVersions,
    DeleteHostedConfigurationVersion,
    StartDeployment,
    GetDeployment,
    ListDeployments,
    StopDeployment,
    GetAccountSettings,
    UpdateAccountSettings,
    ListTagsForResource,
    TagResource,
    UntagResource,
    GetConfiguration,
    ValidateConfiguration,
  },
  model,
} as const satisfies ServiceDefinition;

export default appconfig;
