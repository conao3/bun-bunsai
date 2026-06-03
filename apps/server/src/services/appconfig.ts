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

const newId = (): string => crypto.randomUUID().replaceAll("-", "").slice(0, 7);

const applicationKey = (id: string): string => `${applicationPrefix}${id}`;

const environmentKey = (applicationId: string, id: string): string =>
  `${environmentPrefix}${applicationId}/${id}`;

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

const CreateApplication: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const id = newId();
  const application: StoredApplication = {
    Id: id,
    Name: name,
    Description: stringOrUndefined(input["Description"]),
  };
  ctx.store.set(applicationKey(id), application);
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
  return { Items: applications.slice(0, max).map(applicationView) };
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
  return environmentView(environment);
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
  return { Items: environments.slice(0, max).map(environmentView) };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const appconfig = {
  name: "appconfig",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
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
    if (parts.length === 3 && parts[2] === "environments") {
      if (req.method === "POST") return "CreateEnvironment";
      if (req.method === "GET") return "ListEnvironments";
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
    ListEnvironments,
  },
  model,
} as const satisfies ServiceDefinition;

export default appconfig;
