import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import apigatewayModel from "../../../../test/vendor/aws-models/apigateway.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(apigatewayModel);

type StoredRestApi = {
  id: string;
  name: string;
  description: string | undefined;
  version: string | undefined;
  createdDate: Date;
  rootResourceId: string;
  apiKeySource: string;
  disableExecuteApiEndpoint: boolean;
};

type StoredResource = {
  id: string;
  parentId: string | undefined;
  pathPart: string | undefined;
  path: string;
};

type StoredDeployment = {
  id: string;
  description: string | undefined;
  createdDate: Date;
};

type StoredModel = {
  id: string;
  name: string;
  description: string | undefined;
  schema: string | undefined;
  contentType: string;
};

type StoredStage = {
  stageName: string;
  deploymentId: string | undefined;
  description: string | undefined;
  cacheClusterEnabled: boolean;
  cacheClusterSize: string | undefined;
  cacheClusterStatus: string;
  variables: Record<string, string> | undefined;
  documentationVersion: string | undefined;
  tracingEnabled: boolean;
  createdDate: Date;
  lastUpdatedDate: Date;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const randomId = (): string =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 10);

const restApiKey = (id: string): string => `restapi/${id}`;

const resourceKey = (restApiId: string, id: string): string =>
  `resource/${restApiId}/${id}`;

const deploymentKey = (restApiId: string, id: string): string =>
  `deployment/${restApiId}/${id}`;

const modelKey = (restApiId: string, name: string): string =>
  `model/${restApiId}/${name}`;

const stageKey = (restApiId: string, stageName: string): string =>
  `stage/${restApiId}/${stageName}`;

const requireRestApi = (
  ctx: ServiceContext,
  restApiId: string,
): StoredRestApi => {
  const api = ctx.store.get<StoredRestApi>(restApiKey(restApiId));
  if (api === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid REST API identifier specified`,
      404,
    );
  }
  return api;
};

const restApiView = (api: StoredRestApi): Record<string, unknown> => ({
  id: api.id,
  name: api.name,
  description: api.description,
  version: api.version,
  createdDate: api.createdDate,
  rootResourceId: api.rootResourceId,
  apiKeySource: api.apiKeySource,
  disableExecuteApiEndpoint: api.disableExecuteApiEndpoint,
});

const resourceView = (resource: StoredResource): Record<string, unknown> => ({
  id: resource.id,
  parentId: resource.parentId,
  pathPart: resource.pathPart,
  path: resource.path,
});

const deploymentView = (
  deployment: StoredDeployment,
): Record<string, unknown> => ({
  id: deployment.id,
  description: deployment.description,
  createdDate: deployment.createdDate,
});

const modelView = (m: StoredModel): Record<string, unknown> => ({
  id: m.id,
  name: m.name,
  description: m.description,
  schema: m.schema,
  contentType: m.contentType,
});

const stageView = (s: StoredStage): Record<string, unknown> => ({
  stageName: s.stageName,
  deploymentId: s.deploymentId,
  description: s.description,
  cacheClusterEnabled: s.cacheClusterEnabled,
  cacheClusterSize: s.cacheClusterSize,
  cacheClusterStatus: s.cacheClusterStatus,
  variables: s.variables,
  documentationVersion: s.documentationVersion,
  tracingEnabled: s.tracingEnabled,
  createdDate: s.createdDate,
  lastUpdatedDate: s.lastUpdatedDate,
});

const CreateRestApi: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  if (name === undefined) {
    throw awsError("BadRequestException", "name is required.", 400);
  }
  const id = randomId();
  const rootResourceId = randomId();
  const api: StoredRestApi = {
    id,
    name,
    description: stringOrUndefined(input["description"]),
    version: stringOrUndefined(input["version"]),
    createdDate: new Date(),
    rootResourceId,
    apiKeySource: stringOrUndefined(input["apiKeySource"]) ?? "HEADER",
    disableExecuteApiEndpoint: input["disableExecuteApiEndpoint"] === true,
  };
  ctx.store.set(restApiKey(id), api);
  const root: StoredResource = {
    id: rootResourceId,
    parentId: undefined,
    pathPart: undefined,
    path: "/",
  };
  ctx.store.set(resourceKey(id, rootResourceId), root);
  return restApiView(api);
};

const GetRestApis: OperationHandler = (input, ctx) => {
  const items = ctx.store
    .list<StoredRestApi>()
    .filter((entry) => entry.key.startsWith("restapi/"))
    .map((entry) => restApiView(entry.value));
  return { items };
};

const GetRestApi: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (restApiId === undefined) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  return restApiView(requireRestApi(ctx, restApiId));
};

const DeleteRestApi: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (restApiId === undefined) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  for (const entry of ctx.store.list()) {
    if (
      entry.key === restApiKey(restApiId) ||
      entry.key.startsWith(`resource/${restApiId}/`) ||
      entry.key.startsWith(`deployment/${restApiId}/`) ||
      entry.key.startsWith(`model/${restApiId}/`) ||
      entry.key.startsWith(`stage/${restApiId}/`)
    ) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const CreateResource: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const parentId = stringOrUndefined(input["parentId"]);
  const pathPart = stringOrUndefined(input["pathPart"]);
  if (
    restApiId === undefined ||
    parentId === undefined ||
    pathPart === undefined
  ) {
    throw awsError(
      "BadRequestException",
      "restApiId, parentId and pathPart are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  const parent = ctx.store.get<StoredResource>(
    resourceKey(restApiId, parentId),
  );
  if (parent === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid resource identifier specified`,
      404,
    );
  }
  const id = randomId();
  const base = parent.path === "/" ? "" : parent.path;
  const resource: StoredResource = {
    id,
    parentId,
    pathPart,
    path: `${base}/${pathPart}`,
  };
  ctx.store.set(resourceKey(restApiId, id), resource);
  return resourceView(resource);
};

const GetResources: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (restApiId === undefined) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  const items = ctx.store
    .list<StoredResource>()
    .filter((entry) => entry.key.startsWith(`resource/${restApiId}/`))
    .map((entry) => resourceView(entry.value));
  return { items };
};

const CreateDeployment: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (restApiId === undefined) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  const id = randomId();
  const deployment: StoredDeployment = {
    id,
    description: stringOrUndefined(input["description"]),
    createdDate: new Date(),
  };
  ctx.store.set(deploymentKey(restApiId, id), deployment);
  return deploymentView(deployment);
};

const CreateModel: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const name = stringOrUndefined(input["name"]);
  if (restApiId === undefined || name === undefined) {
    throw awsError(
      "BadRequestException",
      "restApiId and name are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  if (ctx.store.get<StoredModel>(modelKey(restApiId, name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Model name already exists for this REST API`,
      409,
    );
  }
  const m: StoredModel = {
    id: randomId(),
    name,
    description: stringOrUndefined(input["description"]),
    schema: stringOrUndefined(input["schema"]),
    contentType: stringOrUndefined(input["contentType"]) ?? "application/json",
  };
  ctx.store.set(modelKey(restApiId, name), m);
  return modelView(m);
};

const GetModels: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (restApiId === undefined) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  const items = ctx.store
    .list<StoredModel>()
    .filter((entry) => entry.key.startsWith(`model/${restApiId}/`))
    .map((entry) => modelView(entry.value));
  return { items };
};

const requireModel = (
  ctx: ServiceContext,
  restApiId: string,
  modelName: string,
): StoredModel => {
  const m = ctx.store.get<StoredModel>(modelKey(restApiId, modelName));
  if (m === undefined) {
    throw awsError("NotFoundException", `Invalid model name specified`, 404);
  }
  return m;
};

const GetModel: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const modelName = stringOrUndefined(input["modelName"]);
  if (restApiId === undefined || modelName === undefined) {
    throw awsError(
      "BadRequestException",
      "restApiId and modelName are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  return modelView(requireModel(ctx, restApiId, modelName));
};

const DeleteModel: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const modelName = stringOrUndefined(input["modelName"]);
  if (restApiId === undefined || modelName === undefined) {
    throw awsError(
      "BadRequestException",
      "restApiId and modelName are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireModel(ctx, restApiId, modelName);
  ctx.store.delete(modelKey(restApiId, modelName));
  return {};
};

const CreateStage: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const stageName = stringOrUndefined(input["stageName"]);
  if (restApiId === undefined || stageName === undefined) {
    throw awsError(
      "BadRequestException",
      "restApiId and stageName are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  if (
    ctx.store.get<StoredStage>(stageKey(restApiId, stageName)) !== undefined
  ) {
    throw awsError(
      "ConflictException",
      `Stage already exists for this REST API`,
      409,
    );
  }
  const variables = input["variables"];
  const now = new Date();
  const stage: StoredStage = {
    stageName,
    deploymentId: stringOrUndefined(input["deploymentId"]),
    description: stringOrUndefined(input["description"]),
    cacheClusterEnabled: input["cacheClusterEnabled"] === true,
    cacheClusterSize: stringOrUndefined(input["cacheClusterSize"]),
    cacheClusterStatus: "NOT_AVAILABLE",
    variables:
      variables !== null && typeof variables === "object"
        ? (variables as Record<string, string>)
        : undefined,
    documentationVersion: stringOrUndefined(input["documentationVersion"]),
    tracingEnabled: input["tracingEnabled"] === true,
    createdDate: now,
    lastUpdatedDate: now,
  };
  ctx.store.set(stageKey(restApiId, stageName), stage);
  return stageView(stage);
};

const GetStage: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const stageName = stringOrUndefined(input["stageName"]);
  if (restApiId === undefined || stageName === undefined) {
    throw awsError(
      "BadRequestException",
      "restApiId and stageName are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  const stage = ctx.store.get<StoredStage>(stageKey(restApiId, stageName));
  if (stage === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid stage identifier specified`,
      404,
    );
  }
  return stageView(stage);
};

const GetStages: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (restApiId === undefined) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  const item = ctx.store
    .list<StoredStage>()
    .filter((entry) => entry.key.startsWith(`stage/${restApiId}/`))
    .map((entry) => stageView(entry.value));
  return { item };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const apigateway = {
  name: "apigateway",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "restapis") return undefined;
    if (parts.length === 1) {
      if (req.method === "POST") return "CreateRestApi";
      if (req.method === "GET") return "GetRestApis";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "GET") return "GetRestApi";
      if (req.method === "DELETE") return "DeleteRestApi";
      return undefined;
    }
    if (parts[2] === "resources") {
      if (parts.length === 3 && req.method === "GET") return "GetResources";
      if (parts.length === 4 && req.method === "POST") return "CreateResource";
      return undefined;
    }
    if (parts[2] === "deployments") {
      if (parts.length === 3 && req.method === "POST")
        return "CreateDeployment";
      return undefined;
    }
    if (parts[2] === "models") {
      if (parts.length === 3) {
        if (req.method === "GET") return "GetModels";
        if (req.method === "POST") return "CreateModel";
        return undefined;
      }
      if (parts.length === 4) {
        if (req.method === "GET") return "GetModel";
        if (req.method === "DELETE") return "DeleteModel";
        return undefined;
      }
      return undefined;
    }
    if (parts[2] === "stages") {
      if (parts.length === 3) {
        if (req.method === "GET") return "GetStages";
        if (req.method === "POST") return "CreateStage";
        return undefined;
      }
      if (parts.length === 4 && req.method === "GET") return "GetStage";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateRestApi,
    GetRestApis,
    GetRestApi,
    DeleteRestApi,
    CreateResource,
    GetResources,
    CreateDeployment,
    CreateModel,
    GetModels,
    GetModel,
    DeleteModel,
    CreateStage,
    GetStage,
    GetStages,
  },
  model,
} as const satisfies ServiceDefinition;

export default apigateway;
