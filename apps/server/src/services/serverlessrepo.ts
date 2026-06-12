import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/serverlessrepo.json", { with: { type: "json" } }),
);

const appPrefix = "app:" as const;
const versionPrefix = "ver:" as const;
const templatePrefix = "tmpl:" as const;
const policyPrefix = "policy:" as const;

type StoredApplication = {
  ApplicationId: string;
  Name: string;
  Author: string;
  Description: string;
  HomePageUrl: string | undefined;
  Labels: string[];
  LicenseUrl: string | undefined;
  ReadmeUrl: string | undefined;
  SpdxLicenseId: string | undefined;
  CreationTime: string;
  LastUpdatedTime: string;
  LatestVersion: string | undefined;
};

type StoredVersion = {
  ApplicationId: string;
  SemanticVersion: string;
  SourceCodeArchiveUrl: string | undefined;
  SourceCodeUrl: string | undefined;
  TemplateBody: string | undefined;
  TemplateUrl: string;
  ParameterDefinitions: unknown[];
  RequiredCapabilities: string[];
  ResourcesSupported: boolean;
  CreationTime: string;
};

type StoredTemplate = {
  ApplicationId: string;
  TemplateId: string;
  SemanticVersion: string | undefined;
  TemplateUrl: string;
  creationTime: number;
  expirationTime: number;
};

type StoredPolicyStatement = {
  StatementId: string;
  Principals: string[];
  Actions: string[];
  PrincipalOrgIDs?: string[];
};

type StoredPolicy = {
  Statements: StoredPolicyStatement[];
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

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

const appKey = (id: string): string => `${appPrefix}${id}`;
const versionKey = (appId: string, version: string): string =>
  `${versionPrefix}${appId}#${version}`;
const templateKey = (appId: string, templateId: string): string =>
  `${templatePrefix}${appId}#${templateId}`;
const policyKey = (appId: string): string => `${policyPrefix}${appId}`;

const appArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:serverlessrepo:${ctx.region}:${ctx.account}:applications/${name}`;

const newId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const newUuid = (): string => {
  const hex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return `${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`;
};

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  maxItems: unknown,
): { items: T[]; nextToken: string | undefined } => {
  const pageSize =
    typeof maxItems === "number" && maxItems > 0 ? maxItems : 100;
  const startIndex =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(nextToken, 10)
      : 0;
  const page = items.slice(startIndex, startIndex + pageSize);
  const newNextToken =
    startIndex + pageSize < items.length
      ? String(startIndex + pageSize)
      : undefined;
  return { items: page, nextToken: newNextToken };
};

const TEMPLATE_ACTIVE_DELAY_MS = 100;
const TEMPLATE_EXPIRE_MS = 60 * 60 * 1000;

const templateStatus = (tmpl: StoredTemplate): string => {
  const now = Date.now();
  if (now >= tmpl.expirationTime) return "EXPIRED";
  if (now >= tmpl.creationTime + TEMPLATE_ACTIVE_DELAY_MS) return "ACTIVE";
  return "PREPARING";
};

const templateView = (tmpl: StoredTemplate): Record<string, unknown> => ({
  ApplicationId: tmpl.ApplicationId,
  TemplateId: tmpl.TemplateId,
  SemanticVersion: tmpl.SemanticVersion,
  TemplateUrl: tmpl.TemplateUrl,
  CreationTime: new Date(tmpl.creationTime).toISOString(),
  ExpirationTime: new Date(tmpl.expirationTime).toISOString(),
  Status: templateStatus(tmpl),
});

const versionView = (ver: StoredVersion): Record<string, unknown> => ({
  ApplicationId: ver.ApplicationId,
  SemanticVersion: ver.SemanticVersion,
  SourceCodeArchiveUrl: ver.SourceCodeArchiveUrl,
  SourceCodeUrl: ver.SourceCodeUrl,
  TemplateUrl: ver.TemplateUrl,
  ParameterDefinitions: ver.ParameterDefinitions,
  RequiredCapabilities: ver.RequiredCapabilities,
  ResourcesSupported: ver.ResourcesSupported,
  CreationTime: ver.CreationTime,
});

const versionSummaryView = (ver: StoredVersion): Record<string, unknown> => ({
  ApplicationId: ver.ApplicationId,
  SemanticVersion: ver.SemanticVersion,
  SourceCodeUrl: ver.SourceCodeUrl,
  CreationTime: ver.CreationTime,
});

const appView = (
  app: StoredApplication,
  version: StoredVersion | undefined,
): Record<string, unknown> => ({
  ApplicationId: app.ApplicationId,
  Name: app.Name,
  Author: app.Author,
  Description: app.Description,
  HomePageUrl: app.HomePageUrl,
  Labels: app.Labels,
  LicenseUrl: app.LicenseUrl,
  ReadmeUrl: app.ReadmeUrl,
  SpdxLicenseId: app.SpdxLicenseId,
  CreationTime: app.CreationTime,
  IsVerifiedAuthor: false,
  VerifiedAuthorUrl: undefined,
  Version: version ? versionView(version) : undefined,
});

const appSummaryView = (app: StoredApplication): Record<string, unknown> => ({
  ApplicationId: app.ApplicationId,
  Name: app.Name,
  Author: app.Author,
  Description: app.Description,
  HomePageUrl: app.HomePageUrl,
  Labels: app.Labels,
  SpdxLicenseId: app.SpdxLicenseId,
  CreationTime: app.CreationTime,
});

const requireApp = (
  ctx: ServiceContext,
  applicationId: string,
): StoredApplication => {
  const app = ctx.store.get<StoredApplication>(appKey(applicationId));
  if (app === undefined) {
    throw awsError(
      "NotFoundException",
      `Application ${applicationId} not found.`,
      404,
    );
  }
  return app;
};

const CreateApplication: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const name = requireString(input, "Name");
  const author = requireString(input, "Author");
  const description = requireString(input, "Description");

  const id = appArn(ctx, name);
  if (ctx.store.get(appKey(id)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Application with name ${name} already exists.`,
      409,
    );
  }

  const now = new Date().toISOString();
  const semanticVersion = stringOrUndefined(input["SemanticVersion"]);

  const app: StoredApplication = {
    ApplicationId: id,
    Name: name,
    Author: author,
    Description: description,
    HomePageUrl: stringOrUndefined(input["HomePageUrl"]),
    Labels: Array.isArray(input["Labels"]) ? (input["Labels"] as string[]) : [],
    LicenseUrl: stringOrUndefined(input["LicenseUrl"]),
    ReadmeUrl: stringOrUndefined(input["ReadmeUrl"]),
    SpdxLicenseId: stringOrUndefined(input["SpdxLicenseId"]),
    CreationTime: now,
    LastUpdatedTime: now,
    LatestVersion: semanticVersion,
  };

  ctx.store.set(appKey(id), app);

  let storedVersion: StoredVersion | undefined;
  if (semanticVersion) {
    const ver: StoredVersion = {
      ApplicationId: id,
      SemanticVersion: semanticVersion,
      SourceCodeArchiveUrl: stringOrUndefined(input["SourceCodeArchiveUrl"]),
      SourceCodeUrl: stringOrUndefined(input["SourceCodeUrl"]),
      TemplateBody: stringOrUndefined(input["TemplateBody"]),
      TemplateUrl:
        stringOrUndefined(input["TemplateUrl"]) ??
        `https://s3.amazonaws.com/serverlessrepo-${id}/template.yaml`,
      ParameterDefinitions: [],
      RequiredCapabilities: [],
      ResourcesSupported: true,
      CreationTime: now,
    };
    ctx.store.set(versionKey(id, semanticVersion), ver);
    storedVersion = ver;
  }

  return appView(app, storedVersion);
};

const GetApplication: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const applicationId = requireString(input, "ApplicationId");
  const semanticVersion = stringOrUndefined(input["SemanticVersion"]);

  const app = requireApp(ctx, applicationId);

  let ver: StoredVersion | undefined;
  const versionToFetch = semanticVersion ?? app.LatestVersion;
  if (versionToFetch) {
    ver = ctx.store.get<StoredVersion>(
      versionKey(applicationId, versionToFetch),
    );
  }

  return appView(app, ver);
};

const ListApplications: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const all = ctx.store
    .list<StoredApplication>()
    .filter((e) => e.key.startsWith(appPrefix))
    .map((e) => e.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));

  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxItems"],
  );

  return {
    Applications: items.map(appSummaryView),
    NextToken: nextToken,
  };
};

const UpdateApplication: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const applicationId = requireString(input, "ApplicationId");
  const app = requireApp(ctx, applicationId);

  const updated: StoredApplication = {
    ...app,
    Author: stringOrUndefined(input["Author"]) ?? app.Author,
    Description: stringOrUndefined(input["Description"]) ?? app.Description,
    HomePageUrl: stringOrUndefined(input["HomePageUrl"]) ?? app.HomePageUrl,
    Labels: Array.isArray(input["Labels"])
      ? (input["Labels"] as string[])
      : app.Labels,
    ReadmeUrl: stringOrUndefined(input["ReadmeUrl"]) ?? app.ReadmeUrl,
    LastUpdatedTime: new Date().toISOString(),
  };

  ctx.store.set(appKey(applicationId), updated);

  let ver: StoredVersion | undefined;
  if (updated.LatestVersion) {
    ver = ctx.store.get<StoredVersion>(
      versionKey(applicationId, updated.LatestVersion),
    );
  }

  return appView(updated, ver);
};

const DeleteApplication: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const applicationId = requireString(input, "ApplicationId");
  requireApp(ctx, applicationId);

  ctx.store.delete(appKey(applicationId));
  ctx.store.delete(policyKey(applicationId));

  return {};
};

const ListApplicationDependencies: OperationHandler = (
  _input: Record<string, unknown>,
  _ctx: ServiceContext,
) => {
  return { Dependencies: [], NextToken: undefined };
};

const CreateApplicationVersion: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const applicationId = requireString(input, "ApplicationId");
  const semanticVersion = requireString(input, "SemanticVersion");

  const app = requireApp(ctx, applicationId);

  if (ctx.store.get(versionKey(applicationId, semanticVersion)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Version ${semanticVersion} already exists.`,
      409,
    );
  }

  const now = new Date().toISOString();
  const ver: StoredVersion = {
    ApplicationId: applicationId,
    SemanticVersion: semanticVersion,
    SourceCodeArchiveUrl: stringOrUndefined(input["SourceCodeArchiveUrl"]),
    SourceCodeUrl: stringOrUndefined(input["SourceCodeUrl"]),
    TemplateBody: stringOrUndefined(input["TemplateBody"]),
    TemplateUrl:
      stringOrUndefined(input["TemplateUrl"]) ??
      `https://s3.amazonaws.com/serverlessrepo-${applicationId}/template.yaml`,
    ParameterDefinitions: [],
    RequiredCapabilities: [],
    ResourcesSupported: true,
    CreationTime: now,
  };

  ctx.store.set(versionKey(applicationId, semanticVersion), ver);

  const updatedApp: StoredApplication = {
    ...app,
    LatestVersion: semanticVersion,
    LastUpdatedTime: now,
  };
  ctx.store.set(appKey(applicationId), updatedApp);

  return versionView(ver);
};

const ListApplicationVersions: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const applicationId = requireString(input, "ApplicationId");
  requireApp(ctx, applicationId);

  const prefix = `${versionPrefix}${applicationId}#`;
  const all = ctx.store
    .list<StoredVersion>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => a.CreationTime.localeCompare(b.CreationTime));

  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxItems"],
  );

  return {
    Versions: items.map(versionSummaryView),
    NextToken: nextToken,
  };
};

const CreateCloudFormationTemplate: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const applicationId = requireString(input, "ApplicationId");
  const semanticVersion = stringOrUndefined(input["SemanticVersion"]);

  const app = requireApp(ctx, applicationId);

  const templateId = newUuid();
  const now = Date.now();
  const tmpl: StoredTemplate = {
    ApplicationId: applicationId,
    TemplateId: templateId,
    SemanticVersion: semanticVersion ?? app.LatestVersion,
    TemplateUrl: `https://s3.amazonaws.com/serverlessrepo-templates/${templateId}/template.yaml`,
    creationTime: now,
    expirationTime: now + TEMPLATE_EXPIRE_MS,
  };

  ctx.store.set(templateKey(applicationId, templateId), tmpl);

  return templateView(tmpl);
};

const GetCloudFormationTemplate: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const applicationId = requireString(input, "ApplicationId");
  const templateId = requireString(input, "TemplateId");

  const tmpl = ctx.store.get<StoredTemplate>(
    templateKey(applicationId, templateId),
  );
  if (tmpl === undefined) {
    throw awsError(
      "NotFoundException",
      `Template ${templateId} not found.`,
      404,
    );
  }

  return templateView(tmpl);
};

const CreateCloudFormationChangeSet: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const applicationId = requireString(input, "ApplicationId");
  const stackName = requireString(input, "StackName");
  const semanticVersion = stringOrUndefined(input["SemanticVersion"]);

  const app = requireApp(ctx, applicationId);

  const changeSetId = `arn:aws:cloudformation:${ctx.region}:${ctx.account}:changeSet/${stackName}-changeset-${newId()}/stub`;
  const stackId = `arn:aws:cloudformation:${ctx.region}:${ctx.account}:stack/${stackName}/stub`;

  return {
    ApplicationId: applicationId,
    ChangeSetId: changeSetId,
    SemanticVersion: semanticVersion ?? app.LatestVersion,
    StackId: stackId,
  };
};

const PutApplicationPolicy: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const applicationId = requireString(input, "ApplicationId");
  requireApp(ctx, applicationId);

  const statements: StoredPolicyStatement[] = Array.isArray(input["Statements"])
    ? (input["Statements"] as Array<Record<string, unknown>>).map((s) => ({
        StatementId: stringOrUndefined(s["StatementId"]) ?? newId(),
        Principals: Array.isArray(s["Principals"])
          ? (s["Principals"] as string[])
          : [],
        Actions: Array.isArray(s["Actions"]) ? (s["Actions"] as string[]) : [],
        PrincipalOrgIDs: Array.isArray(s["PrincipalOrgIDs"])
          ? (s["PrincipalOrgIDs"] as string[])
          : undefined,
      }))
    : [];

  const policy: StoredPolicy = { Statements: statements };
  ctx.store.set(policyKey(applicationId), policy);

  return { Statements: statements };
};

const GetApplicationPolicy: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const applicationId = requireString(input, "ApplicationId");
  requireApp(ctx, applicationId);

  const policy = ctx.store.get<StoredPolicy>(policyKey(applicationId));
  const statements = policy?.Statements ?? [];

  return { Statements: statements };
};

const UnshareApplication: OperationHandler = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
) => {
  const applicationId = requireString(input, "ApplicationId");
  requireApp(ctx, applicationId);

  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const serverlessrepo = {
  name: "serverlessrepo",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "applications") return undefined;

    if (parts.length === 1) {
      if (req.method === "GET") return "ListApplications";
      if (req.method === "POST") return "CreateApplication";
      return undefined;
    }

    if (parts.length === 2) {
      if (req.method === "GET") return "GetApplication";
      if (req.method === "PATCH") return "UpdateApplication";
      if (req.method === "DELETE") return "DeleteApplication";
      return undefined;
    }

    if (parts.length === 3) {
      if (parts[2] === "versions") {
        if (req.method === "GET") return "ListApplicationVersions";
        return undefined;
      }
      if (parts[2] === "dependencies") {
        if (req.method === "GET") return "ListApplicationDependencies";
        return undefined;
      }
      if (parts[2] === "templates") {
        if (req.method === "POST") return "CreateCloudFormationTemplate";
        return undefined;
      }
      if (parts[2] === "changesets") {
        if (req.method === "POST") return "CreateCloudFormationChangeSet";
        return undefined;
      }
      if (parts[2] === "policy") {
        if (req.method === "GET") return "GetApplicationPolicy";
        if (req.method === "PUT") return "PutApplicationPolicy";
        return undefined;
      }
      if (parts[2] === "unshare") {
        if (req.method === "POST") return "UnshareApplication";
        return undefined;
      }
      return undefined;
    }

    if (parts.length === 4) {
      if (parts[2] === "versions") {
        if (req.method === "PUT") return "CreateApplicationVersion";
        return undefined;
      }
      if (parts[2] === "templates") {
        if (req.method === "GET") return "GetCloudFormationTemplate";
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
    ListApplicationDependencies,
    CreateApplicationVersion,
    ListApplicationVersions,
    CreateCloudFormationTemplate,
    GetCloudFormationTemplate,
    CreateCloudFormationChangeSet,
    PutApplicationPolicy,
    GetApplicationPolicy,
    UnshareApplication,
  },
  model,
} as const satisfies ServiceDefinition;

export default serverlessrepo;
