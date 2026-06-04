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

type StoredMethod = {
  httpMethod: string;
  authorizationType: string;
  authorizerId: string | undefined;
  apiKeyRequired: boolean | undefined;
  operationName: string | undefined;
  requestParameters: Record<string, boolean> | undefined;
  requestModels: Record<string, string> | undefined;
  requestValidatorId: string | undefined;
  authorizationScopes: string[] | undefined;
};

type StoredIntegration = {
  type: string | undefined;
  httpMethod: string | undefined;
  uri: string | undefined;
  connectionType: string | undefined;
  connectionId: string | undefined;
  credentials: string | undefined;
  requestParameters: Record<string, string> | undefined;
  requestTemplates: Record<string, string> | undefined;
  passthroughBehavior: string | undefined;
  cacheNamespace: string | undefined;
  cacheKeyParameters: string[] | undefined;
  contentHandling: string | undefined;
  timeoutInMillis: number | undefined;
};

type StoredMethodResponse = {
  statusCode: string;
  responseParameters: Record<string, boolean> | undefined;
  responseModels: Record<string, string> | undefined;
};

type StoredIntegrationResponse = {
  statusCode: string;
  selectionPattern: string | undefined;
  responseParameters: Record<string, string> | undefined;
  responseTemplates: Record<string, string> | undefined;
  contentHandling: string | undefined;
};

type StoredDocumentationPart = {
  id: string;
  location: {
    type: string;
    path: string | undefined;
    method: string | undefined;
    statusCode: string | undefined;
    name: string | undefined;
  };
  properties: string;
};

type StoredDocumentationVersion = {
  version: string;
  createdDate: Date;
  description: string | undefined;
};

type StoredRequestValidator = {
  id: string;
  name: string | undefined;
  validateRequestBody: boolean;
  validateRequestParameters: boolean;
};

type StoredGatewayResponse = {
  responseType: string;
  statusCode: string | undefined;
  responseParameters: Record<string, string> | undefined;
  responseTemplates: Record<string, string> | undefined;
  defaultResponse: boolean;
};

type StoredAccount = {
  cloudwatchRoleArn: string | undefined;
  throttleSettings: { burstLimit: number; rateLimit: number } | undefined;
  features: string[] | undefined;
  apiKeyVersion: string | undefined;
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

const methodKey = (
  restApiId: string,
  resourceId: string,
  httpMethod: string,
): string => `method/${restApiId}/${resourceId}/${httpMethod}`;

const integrationKey = (
  restApiId: string,
  resourceId: string,
  httpMethod: string,
): string => `integration/${restApiId}/${resourceId}/${httpMethod}`;

const methodResponseKey = (
  restApiId: string,
  resourceId: string,
  httpMethod: string,
  statusCode: string,
): string =>
  `methodresponse/${restApiId}/${resourceId}/${httpMethod}/${statusCode}`;

const integrationResponseKey = (
  restApiId: string,
  resourceId: string,
  httpMethod: string,
  statusCode: string,
): string =>
  `integrationresponse/${restApiId}/${resourceId}/${httpMethod}/${statusCode}`;

const documentationPartKey = (restApiId: string, id: string): string =>
  `docpart/${restApiId}/${id}`;

const documentationVersionKey = (restApiId: string, version: string): string =>
  `docversion/${restApiId}/${version}`;

const requestValidatorKey = (restApiId: string, id: string): string =>
  `requestvalidator/${restApiId}/${id}`;

const gatewayResponseKey = (restApiId: string, responseType: string): string =>
  `gatewayresponse/${restApiId}/${responseType}`;

const accountKey = "account";

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

const requireResource = (
  ctx: ServiceContext,
  restApiId: string,
  resourceId: string,
): StoredResource => {
  const r = ctx.store.get<StoredResource>(resourceKey(restApiId, resourceId));
  if (r === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid resource identifier specified`,
      404,
    );
  }
  return r;
};

const requireDeployment = (
  ctx: ServiceContext,
  restApiId: string,
  deploymentId: string,
): StoredDeployment => {
  const d = ctx.store.get<StoredDeployment>(
    deploymentKey(restApiId, deploymentId),
  );
  if (d === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid deployment identifier specified`,
      404,
    );
  }
  return d;
};

const requireStage = (
  ctx: ServiceContext,
  restApiId: string,
  stageName: string,
): StoredStage => {
  const s = ctx.store.get<StoredStage>(stageKey(restApiId, stageName));
  if (s === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid stage identifier specified`,
      404,
    );
  }
  return s;
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

const requireMethod = (
  ctx: ServiceContext,
  restApiId: string,
  resourceId: string,
  httpMethod: string,
): StoredMethod => {
  const m = ctx.store.get<StoredMethod>(
    methodKey(restApiId, resourceId, httpMethod),
  );
  if (m === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid method identifier specified`,
      404,
    );
  }
  return m;
};

const requireIntegration = (
  ctx: ServiceContext,
  restApiId: string,
  resourceId: string,
  httpMethod: string,
): StoredIntegration => {
  const i = ctx.store.get<StoredIntegration>(
    integrationKey(restApiId, resourceId, httpMethod),
  );
  if (i === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid integration identifier specified`,
      404,
    );
  }
  return i;
};

const requireDocumentationPart = (
  ctx: ServiceContext,
  restApiId: string,
  partId: string,
): StoredDocumentationPart => {
  const d = ctx.store.get<StoredDocumentationPart>(
    documentationPartKey(restApiId, partId),
  );
  if (d === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid documentation part identifier specified`,
      404,
    );
  }
  return d;
};

const requireDocumentationVersion = (
  ctx: ServiceContext,
  restApiId: string,
  docVersion: string,
): StoredDocumentationVersion => {
  const d = ctx.store.get<StoredDocumentationVersion>(
    documentationVersionKey(restApiId, docVersion),
  );
  if (d === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid documentation version identifier specified`,
      404,
    );
  }
  return d;
};

const requireRequestValidator = (
  ctx: ServiceContext,
  restApiId: string,
  validatorId: string,
): StoredRequestValidator => {
  const v = ctx.store.get<StoredRequestValidator>(
    requestValidatorKey(restApiId, validatorId),
  );
  if (v === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid request validator identifier specified`,
      404,
    );
  }
  return v;
};

const requireGatewayResponse = (
  ctx: ServiceContext,
  restApiId: string,
  responseType: string,
): StoredGatewayResponse => {
  const g = ctx.store.get<StoredGatewayResponse>(
    gatewayResponseKey(restApiId, responseType),
  );
  if (g === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid gateway response type specified`,
      404,
    );
  }
  return g;
};

const applyPatch = (
  obj: Record<string, unknown>,
  patches: unknown,
): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...obj };
  if (!Array.isArray(patches)) return result;
  for (const p of patches) {
    if (typeof p !== "object" || p === null) continue;
    const op = (p as Record<string, unknown>)["op"];
    const path = (p as Record<string, unknown>)["path"];
    const value = (p as Record<string, unknown>)["value"];
    if (typeof path !== "string") continue;
    const key = path.startsWith("/") ? path.slice(1) : path;
    if (op === "replace" || op === "add") {
      result[key] = value;
    } else if (op === "remove") {
      result[key] = undefined;
    }
  }
  return result;
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

const methodView = (m: StoredMethod): Record<string, unknown> => ({
  httpMethod: m.httpMethod,
  authorizationType: m.authorizationType,
  authorizerId: m.authorizerId,
  apiKeyRequired: m.apiKeyRequired,
  operationName: m.operationName,
  requestParameters: m.requestParameters,
  requestModels: m.requestModels,
  requestValidatorId: m.requestValidatorId,
  authorizationScopes: m.authorizationScopes,
});

const integrationView = (i: StoredIntegration): Record<string, unknown> => ({
  type: i.type,
  httpMethod: i.httpMethod,
  uri: i.uri,
  connectionType: i.connectionType,
  connectionId: i.connectionId,
  credentials: i.credentials,
  requestParameters: i.requestParameters,
  requestTemplates: i.requestTemplates,
  passthroughBehavior: i.passthroughBehavior,
  cacheNamespace: i.cacheNamespace,
  cacheKeyParameters: i.cacheKeyParameters,
  contentHandling: i.contentHandling,
  timeoutInMillis: i.timeoutInMillis,
});

const methodResponseView = (
  r: StoredMethodResponse,
): Record<string, unknown> => ({
  statusCode: r.statusCode,
  responseParameters: r.responseParameters,
  responseModels: r.responseModels,
});

const integrationResponseView = (
  r: StoredIntegrationResponse,
): Record<string, unknown> => ({
  statusCode: r.statusCode,
  selectionPattern: r.selectionPattern,
  responseParameters: r.responseParameters,
  responseTemplates: r.responseTemplates,
  contentHandling: r.contentHandling,
});

const documentationPartView = (
  d: StoredDocumentationPart,
): Record<string, unknown> => ({
  id: d.id,
  location: d.location,
  properties: d.properties,
});

const documentationVersionView = (
  d: StoredDocumentationVersion,
): Record<string, unknown> => ({
  version: d.version,
  createdDate: d.createdDate,
  description: d.description,
});

const requestValidatorView = (
  v: StoredRequestValidator,
): Record<string, unknown> => ({
  id: v.id,
  name: v.name,
  validateRequestBody: v.validateRequestBody,
  validateRequestParameters: v.validateRequestParameters,
});

const gatewayResponseView = (
  g: StoredGatewayResponse,
): Record<string, unknown> => ({
  responseType: g.responseType,
  statusCode: g.statusCode,
  responseParameters: g.responseParameters,
  responseTemplates: g.responseTemplates,
  defaultResponse: g.defaultResponse,
});

const accountView = (a: StoredAccount): Record<string, unknown> => ({
  cloudwatchRoleArn: a.cloudwatchRoleArn,
  throttleSettings: a.throttleSettings,
  features: a.features,
  apiKeyVersion: a.apiKeyVersion,
});

const defaultAccount: StoredAccount = {
  cloudwatchRoleArn: undefined,
  throttleSettings: { burstLimit: 5000, rateLimit: 10000 },
  features: ["UsagePlans"],
  apiKeyVersion: "1",
};

const sdkTypes = [
  {
    id: "javascript",
    friendlyName: "JavaScript",
    description: "A JavaScript SDK",
    configurationProperties: [],
  },
  {
    id: "android",
    friendlyName: "Android",
    description: "An Android SDK",
    configurationProperties: [],
  },
  {
    id: "ios-swift",
    friendlyName: "iOS (Swift)",
    description: "An iOS Swift SDK",
    configurationProperties: [],
  },
] as const;

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
  const prefixes = [
    restApiKey(restApiId),
    `resource/${restApiId}/`,
    `deployment/${restApiId}/`,
    `model/${restApiId}/`,
    `stage/${restApiId}/`,
    `method/${restApiId}/`,
    `integration/${restApiId}/`,
    `methodresponse/${restApiId}/`,
    `integrationresponse/${restApiId}/`,
    `docpart/${restApiId}/`,
    `docversion/${restApiId}/`,
    `requestvalidator/${restApiId}/`,
    `gatewayresponse/${restApiId}/`,
  ];
  for (const entry of ctx.store.list()) {
    if (prefixes.some((p) => entry.key === p || entry.key.startsWith(p))) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const UpdateRestApi: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (!restApiId) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  const api = requireRestApi(ctx, restApiId);
  const patched = applyPatch(
    api as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredRestApi = {
    ...api,
    name: stringOrUndefined(patched["name"]) ?? api.name,
    description: stringOrUndefined(patched["description"]),
    version: stringOrUndefined(patched["version"]),
    apiKeySource:
      stringOrUndefined(patched["apiKeySource"]) ?? api.apiKeySource,
    disableExecuteApiEndpoint:
      patched["disableExecuteApiEndpoint"] === "true" ||
      patched["disableExecuteApiEndpoint"] === true,
  };
  ctx.store.set(restApiKey(restApiId), updated);
  return restApiView(updated);
};

const PutRestApi: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (!restApiId) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  const api = requireRestApi(ctx, restApiId);
  return restApiView(api);
};

const ImportRestApi: OperationHandler = (input, ctx) => {
  const id = randomId();
  const rootResourceId = randomId();
  const api: StoredRestApi = {
    id,
    name: `imported-api-${id}`,
    description: undefined,
    version: undefined,
    createdDate: new Date(),
    rootResourceId,
    apiKeySource: "HEADER",
    disableExecuteApiEndpoint: false,
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

const GetResource: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  if (!restApiId || !resourceId) {
    throw awsError(
      "BadRequestException",
      "restApiId and resourceId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  return resourceView(requireResource(ctx, restApiId, resourceId));
};

const DeleteResource: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  if (!restApiId || !resourceId) {
    throw awsError(
      "BadRequestException",
      "restApiId and resourceId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  for (const entry of ctx.store.list()) {
    if (
      entry.key === resourceKey(restApiId, resourceId) ||
      entry.key.startsWith(`method/${restApiId}/${resourceId}/`) ||
      entry.key.startsWith(`integration/${restApiId}/${resourceId}/`) ||
      entry.key.startsWith(`methodresponse/${restApiId}/${resourceId}/`) ||
      entry.key.startsWith(`integrationresponse/${restApiId}/${resourceId}/`)
    ) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const UpdateResource: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  if (!restApiId || !resourceId) {
    throw awsError(
      "BadRequestException",
      "restApiId and resourceId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  const r = requireResource(ctx, restApiId, resourceId);
  const patched = applyPatch(
    r as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const newPathPart = stringOrUndefined(patched["pathPart"]) ?? r.pathPart;
  const updated: StoredResource = {
    ...r,
    pathPart: newPathPart,
  };
  ctx.store.set(resourceKey(restApiId, resourceId), updated);
  return resourceView(updated);
};

const PutMethod: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  if (!restApiId || !resourceId || !httpMethod) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId and httpMethod are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  const m: StoredMethod = {
    httpMethod,
    authorizationType: stringOrUndefined(input["authorizationType"]) ?? "NONE",
    authorizerId: stringOrUndefined(input["authorizerId"]),
    apiKeyRequired:
      typeof input["apiKeyRequired"] === "boolean"
        ? input["apiKeyRequired"]
        : undefined,
    operationName: stringOrUndefined(input["operationName"]),
    requestParameters:
      input["requestParameters"] !== null &&
      typeof input["requestParameters"] === "object"
        ? (input["requestParameters"] as Record<string, boolean>)
        : undefined,
    requestModels:
      input["requestModels"] !== null &&
      typeof input["requestModels"] === "object"
        ? (input["requestModels"] as Record<string, string>)
        : undefined,
    requestValidatorId: stringOrUndefined(input["requestValidatorId"]),
    authorizationScopes: Array.isArray(input["authorizationScopes"])
      ? (input["authorizationScopes"] as string[])
      : undefined,
  };
  ctx.store.set(methodKey(restApiId, resourceId, httpMethod), m);
  return methodView(m);
};

const GetMethod: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  if (!restApiId || !resourceId || !httpMethod) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId and httpMethod are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  return methodView(requireMethod(ctx, restApiId, resourceId, httpMethod));
};

const DeleteMethod: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  if (!restApiId || !resourceId || !httpMethod) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId and httpMethod are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  requireMethod(ctx, restApiId, resourceId, httpMethod);
  for (const entry of ctx.store.list()) {
    if (
      entry.key === methodKey(restApiId, resourceId, httpMethod) ||
      entry.key === integrationKey(restApiId, resourceId, httpMethod) ||
      entry.key.startsWith(
        `methodresponse/${restApiId}/${resourceId}/${httpMethod}/`,
      ) ||
      entry.key.startsWith(
        `integrationresponse/${restApiId}/${resourceId}/${httpMethod}/`,
      )
    ) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const UpdateMethod: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  if (!restApiId || !resourceId || !httpMethod) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId and httpMethod are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  const m = requireMethod(ctx, restApiId, resourceId, httpMethod);
  const patched = applyPatch(
    m as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredMethod = {
    ...m,
    authorizationType:
      stringOrUndefined(patched["authorizationType"]) ?? m.authorizationType,
    authorizerId: stringOrUndefined(patched["authorizerId"]),
    operationName: stringOrUndefined(patched["operationName"]),
    requestValidatorId: stringOrUndefined(patched["requestValidatorId"]),
    apiKeyRequired:
      patched["apiKeyRequired"] !== undefined
        ? patched["apiKeyRequired"] === "true" ||
          patched["apiKeyRequired"] === true
        : m.apiKeyRequired,
  };
  ctx.store.set(methodKey(restApiId, resourceId, httpMethod), updated);
  return methodView(updated);
};

const TestInvokeMethod: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  if (!restApiId || !resourceId || !httpMethod) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId and httpMethod are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  requireMethod(ctx, restApiId, resourceId, httpMethod);
  return {
    status: 200,
    body: "{}",
    headers: {},
    multiValueHeaders: {},
    log: "",
    latency: 0,
  };
};

const PutIntegration: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  if (!restApiId || !resourceId || !httpMethod) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId and httpMethod are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  requireMethod(ctx, restApiId, resourceId, httpMethod);
  const i: StoredIntegration = {
    type: stringOrUndefined(input["type"]),
    httpMethod: stringOrUndefined(input["integrationHttpMethod"]),
    uri: stringOrUndefined(input["uri"]),
    connectionType: stringOrUndefined(input["connectionType"]),
    connectionId: stringOrUndefined(input["connectionId"]),
    credentials: stringOrUndefined(input["credentials"]),
    requestParameters:
      input["requestParameters"] !== null &&
      typeof input["requestParameters"] === "object"
        ? (input["requestParameters"] as Record<string, string>)
        : undefined,
    requestTemplates:
      input["requestTemplates"] !== null &&
      typeof input["requestTemplates"] === "object"
        ? (input["requestTemplates"] as Record<string, string>)
        : undefined,
    passthroughBehavior: stringOrUndefined(input["passthroughBehavior"]),
    cacheNamespace: stringOrUndefined(input["cacheNamespace"]),
    cacheKeyParameters: Array.isArray(input["cacheKeyParameters"])
      ? (input["cacheKeyParameters"] as string[])
      : undefined,
    contentHandling: stringOrUndefined(input["contentHandling"]),
    timeoutInMillis:
      typeof input["timeoutInMillis"] === "number"
        ? input["timeoutInMillis"]
        : undefined,
  };
  ctx.store.set(integrationKey(restApiId, resourceId, httpMethod), i);
  return integrationView(i);
};

const GetIntegration: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  if (!restApiId || !resourceId || !httpMethod) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId and httpMethod are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  return integrationView(
    requireIntegration(ctx, restApiId, resourceId, httpMethod),
  );
};

const DeleteIntegration: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  if (!restApiId || !resourceId || !httpMethod) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId and httpMethod are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  requireIntegration(ctx, restApiId, resourceId, httpMethod);
  for (const entry of ctx.store.list()) {
    if (
      entry.key === integrationKey(restApiId, resourceId, httpMethod) ||
      entry.key.startsWith(
        `integrationresponse/${restApiId}/${resourceId}/${httpMethod}/`,
      )
    ) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const UpdateIntegration: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  if (!restApiId || !resourceId || !httpMethod) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId and httpMethod are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  const i = requireIntegration(ctx, restApiId, resourceId, httpMethod);
  const patched = applyPatch(
    i as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredIntegration = {
    ...i,
    type: stringOrUndefined(patched["type"]) ?? i.type,
    uri: stringOrUndefined(patched["uri"]),
    credentials: stringOrUndefined(patched["credentials"]),
    passthroughBehavior: stringOrUndefined(patched["passthroughBehavior"]),
    contentHandling: stringOrUndefined(patched["contentHandling"]),
  };
  ctx.store.set(integrationKey(restApiId, resourceId, httpMethod), updated);
  return integrationView(updated);
};

const PutMethodResponse: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  const statusCode = stringOrUndefined(input["statusCode"]);
  if (!restApiId || !resourceId || !httpMethod || !statusCode) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId, httpMethod and statusCode are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  requireMethod(ctx, restApiId, resourceId, httpMethod);
  const r: StoredMethodResponse = {
    statusCode,
    responseParameters:
      input["responseParameters"] !== null &&
      typeof input["responseParameters"] === "object"
        ? (input["responseParameters"] as Record<string, boolean>)
        : undefined,
    responseModels:
      input["responseModels"] !== null &&
      typeof input["responseModels"] === "object"
        ? (input["responseModels"] as Record<string, string>)
        : undefined,
  };
  ctx.store.set(
    methodResponseKey(restApiId, resourceId, httpMethod, statusCode),
    r,
  );
  return methodResponseView(r);
};

const GetMethodResponse: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  const statusCode = stringOrUndefined(input["statusCode"]);
  if (!restApiId || !resourceId || !httpMethod || !statusCode) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId, httpMethod and statusCode are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  requireMethod(ctx, restApiId, resourceId, httpMethod);
  const r = ctx.store.get<StoredMethodResponse>(
    methodResponseKey(restApiId, resourceId, httpMethod, statusCode),
  );
  if (!r) {
    throw awsError(
      "NotFoundException",
      "Invalid method response specified",
      404,
    );
  }
  return methodResponseView(r);
};

const DeleteMethodResponse: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  const statusCode = stringOrUndefined(input["statusCode"]);
  if (!restApiId || !resourceId || !httpMethod || !statusCode) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId, httpMethod and statusCode are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  requireMethod(ctx, restApiId, resourceId, httpMethod);
  const key = methodResponseKey(restApiId, resourceId, httpMethod, statusCode);
  if (!ctx.store.get(key)) {
    throw awsError(
      "NotFoundException",
      "Invalid method response specified",
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const UpdateMethodResponse: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  const statusCode = stringOrUndefined(input["statusCode"]);
  if (!restApiId || !resourceId || !httpMethod || !statusCode) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId, httpMethod and statusCode are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  requireMethod(ctx, restApiId, resourceId, httpMethod);
  const key = methodResponseKey(restApiId, resourceId, httpMethod, statusCode);
  const r = ctx.store.get<StoredMethodResponse>(key);
  if (!r) {
    throw awsError(
      "NotFoundException",
      "Invalid method response specified",
      404,
    );
  }
  const patched = applyPatch(
    r as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredMethodResponse = {
    ...r,
    statusCode: stringOrUndefined(patched["statusCode"]) ?? r.statusCode,
  };
  ctx.store.set(key, updated);
  return methodResponseView(updated);
};

const PutIntegrationResponse: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  const statusCode = stringOrUndefined(input["statusCode"]);
  if (!restApiId || !resourceId || !httpMethod || !statusCode) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId, httpMethod and statusCode are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  requireIntegration(ctx, restApiId, resourceId, httpMethod);
  const r: StoredIntegrationResponse = {
    statusCode,
    selectionPattern: stringOrUndefined(input["selectionPattern"]),
    responseParameters:
      input["responseParameters"] !== null &&
      typeof input["responseParameters"] === "object"
        ? (input["responseParameters"] as Record<string, string>)
        : undefined,
    responseTemplates:
      input["responseTemplates"] !== null &&
      typeof input["responseTemplates"] === "object"
        ? (input["responseTemplates"] as Record<string, string>)
        : undefined,
    contentHandling: stringOrUndefined(input["contentHandling"]),
  };
  ctx.store.set(
    integrationResponseKey(restApiId, resourceId, httpMethod, statusCode),
    r,
  );
  return integrationResponseView(r);
};

const GetIntegrationResponse: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  const statusCode = stringOrUndefined(input["statusCode"]);
  if (!restApiId || !resourceId || !httpMethod || !statusCode) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId, httpMethod and statusCode are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  const r = ctx.store.get<StoredIntegrationResponse>(
    integrationResponseKey(restApiId, resourceId, httpMethod, statusCode),
  );
  if (!r) {
    throw awsError(
      "NotFoundException",
      "Invalid integration response specified",
      404,
    );
  }
  return integrationResponseView(r);
};

const DeleteIntegrationResponse: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  const statusCode = stringOrUndefined(input["statusCode"]);
  if (!restApiId || !resourceId || !httpMethod || !statusCode) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId, httpMethod and statusCode are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  const key = integrationResponseKey(
    restApiId,
    resourceId,
    httpMethod,
    statusCode,
  );
  if (!ctx.store.get(key)) {
    throw awsError(
      "NotFoundException",
      "Invalid integration response specified",
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const UpdateIntegrationResponse: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const resourceId = stringOrUndefined(input["resourceId"]);
  const httpMethod = stringOrUndefined(input["httpMethod"]);
  const statusCode = stringOrUndefined(input["statusCode"]);
  if (!restApiId || !resourceId || !httpMethod || !statusCode) {
    throw awsError(
      "BadRequestException",
      "restApiId, resourceId, httpMethod and statusCode are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireResource(ctx, restApiId, resourceId);
  const key = integrationResponseKey(
    restApiId,
    resourceId,
    httpMethod,
    statusCode,
  );
  const r = ctx.store.get<StoredIntegrationResponse>(key);
  if (!r) {
    throw awsError(
      "NotFoundException",
      "Invalid integration response specified",
      404,
    );
  }
  const patched = applyPatch(
    r as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredIntegrationResponse = {
    ...r,
    selectionPattern: stringOrUndefined(patched["selectionPattern"]),
    contentHandling: stringOrUndefined(patched["contentHandling"]),
  };
  ctx.store.set(key, updated);
  return integrationResponseView(updated);
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

const GetDeployments: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (!restApiId) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  const items = ctx.store
    .list<StoredDeployment>()
    .filter((entry) => entry.key.startsWith(`deployment/${restApiId}/`))
    .map((entry) => deploymentView(entry.value));
  return { items };
};

const GetDeployment: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const deploymentId = stringOrUndefined(input["deploymentId"]);
  if (!restApiId || !deploymentId) {
    throw awsError(
      "BadRequestException",
      "restApiId and deploymentId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  return deploymentView(requireDeployment(ctx, restApiId, deploymentId));
};

const DeleteDeployment: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const deploymentId = stringOrUndefined(input["deploymentId"]);
  if (!restApiId || !deploymentId) {
    throw awsError(
      "BadRequestException",
      "restApiId and deploymentId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireDeployment(ctx, restApiId, deploymentId);
  ctx.store.delete(deploymentKey(restApiId, deploymentId));
  return {};
};

const UpdateDeployment: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const deploymentId = stringOrUndefined(input["deploymentId"]);
  if (!restApiId || !deploymentId) {
    throw awsError(
      "BadRequestException",
      "restApiId and deploymentId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  const d = requireDeployment(ctx, restApiId, deploymentId);
  const patched = applyPatch(
    d as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredDeployment = {
    ...d,
    description: stringOrUndefined(patched["description"]),
  };
  ctx.store.set(deploymentKey(restApiId, deploymentId), updated);
  return deploymentView(updated);
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

const UpdateModel: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const modelName = stringOrUndefined(input["modelName"]);
  if (!restApiId || !modelName) {
    throw awsError(
      "BadRequestException",
      "restApiId and modelName are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  const m = requireModel(ctx, restApiId, modelName);
  const patched = applyPatch(
    m as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredModel = {
    ...m,
    description: stringOrUndefined(patched["description"]),
    schema: stringOrUndefined(patched["schema"]),
    contentType: stringOrUndefined(patched["contentType"]) ?? m.contentType,
  };
  ctx.store.set(modelKey(restApiId, modelName), updated);
  return modelView(updated);
};

const GetModelTemplate: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const modelName = stringOrUndefined(input["modelName"]);
  if (!restApiId || !modelName) {
    throw awsError(
      "BadRequestException",
      "restApiId and modelName are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireModel(ctx, restApiId, modelName);
  return { value: "#set($inputRoot = $input.path('$'))\n{}" };
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
  return stageView(requireStage(ctx, restApiId, stageName));
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

const DeleteStage: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const stageName = stringOrUndefined(input["stageName"]);
  if (!restApiId || !stageName) {
    throw awsError(
      "BadRequestException",
      "restApiId and stageName are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireStage(ctx, restApiId, stageName);
  ctx.store.delete(stageKey(restApiId, stageName));
  return {};
};

const UpdateStage: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const stageName = stringOrUndefined(input["stageName"]);
  if (!restApiId || !stageName) {
    throw awsError(
      "BadRequestException",
      "restApiId and stageName are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  const s = requireStage(ctx, restApiId, stageName);
  const patched = applyPatch(
    s as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredStage = {
    ...s,
    deploymentId: stringOrUndefined(patched["deploymentId"]),
    description: stringOrUndefined(patched["description"]),
    cacheClusterEnabled:
      patched["cacheClusterEnabled"] === "true" ||
      patched["cacheClusterEnabled"] === true,
    documentationVersion: stringOrUndefined(patched["documentationVersion"]),
    tracingEnabled:
      patched["tracingEnabled"] === "true" ||
      patched["tracingEnabled"] === true,
    lastUpdatedDate: new Date(),
  };
  ctx.store.set(stageKey(restApiId, stageName), updated);
  return stageView(updated);
};

const FlushStageCache: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const stageName = stringOrUndefined(input["stageName"]);
  if (!restApiId || !stageName) {
    throw awsError(
      "BadRequestException",
      "restApiId and stageName are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireStage(ctx, restApiId, stageName);
  return {};
};

const FlushStageAuthorizersCache: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const stageName = stringOrUndefined(input["stageName"]);
  if (!restApiId || !stageName) {
    throw awsError(
      "BadRequestException",
      "restApiId and stageName are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireStage(ctx, restApiId, stageName);
  return {};
};

const GetExport: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const stageName = stringOrUndefined(input["stageName"]);
  if (!restApiId || !stageName) {
    throw awsError(
      "BadRequestException",
      "restApiId and stageName are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireStage(ctx, restApiId, stageName);
  return {
    body: new Uint8Array(0),
    contentType: "application/json",
    contentDisposition: "attachment; filename=export.json",
  };
};

const GetSdk: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const stageName = stringOrUndefined(input["stageName"]);
  if (!restApiId || !stageName) {
    throw awsError(
      "BadRequestException",
      "restApiId and stageName are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireStage(ctx, restApiId, stageName);
  return {
    body: new Uint8Array(0),
    contentType: "application/zip",
    contentDisposition: "attachment; filename=sdk.zip",
  };
};

const GetSdkTypes: OperationHandler = () => ({
  items: sdkTypes.map((t) => ({
    id: t.id,
    friendlyName: t.friendlyName,
    description: t.description,
    configurationProperties: t.configurationProperties,
  })),
});

const GetSdkType: OperationHandler = (input) => {
  const id = stringOrUndefined(input["id"]);
  if (!id) {
    throw awsError("BadRequestException", "id is required.", 400);
  }
  const found = sdkTypes.find((t) => t.id === id);
  if (!found) {
    throw awsError("NotFoundException", "Invalid SDK type identifier", 404);
  }
  return {
    id: found.id,
    friendlyName: found.friendlyName,
    description: found.description,
    configurationProperties: found.configurationProperties,
  };
};

const GetAccount: OperationHandler = (_, ctx) => {
  const a = ctx.store.get<StoredAccount>(accountKey) ?? defaultAccount;
  return accountView(a);
};

const UpdateAccount: OperationHandler = (input, ctx) => {
  const a = ctx.store.get<StoredAccount>(accountKey) ?? { ...defaultAccount };
  const patched = applyPatch(
    a as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredAccount = {
    ...a,
    cloudwatchRoleArn: stringOrUndefined(patched["cloudwatchRoleArn"]),
  };
  ctx.store.set(accountKey, updated);
  return accountView(updated);
};

const CreateDocumentationPart: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (!restApiId) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  const locationInput = input["location"];
  const location =
    locationInput !== null && typeof locationInput === "object"
      ? (locationInput as Record<string, unknown>)
      : {};
  const id = randomId();
  const d: StoredDocumentationPart = {
    id,
    location: {
      type: stringOrUndefined(location["type"]) ?? "API",
      path: stringOrUndefined(location["path"]),
      method: stringOrUndefined(location["method"]),
      statusCode: stringOrUndefined(location["statusCode"]),
      name: stringOrUndefined(location["name"]),
    },
    properties: stringOrUndefined(input["properties"]) ?? "{}",
  };
  ctx.store.set(documentationPartKey(restApiId, id), d);
  return documentationPartView(d);
};

const GetDocumentationPart: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const documentationPartId = stringOrUndefined(input["documentationPartId"]);
  if (!restApiId || !documentationPartId) {
    throw awsError(
      "BadRequestException",
      "restApiId and documentationPartId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  return documentationPartView(
    requireDocumentationPart(ctx, restApiId, documentationPartId),
  );
};

const GetDocumentationParts: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (!restApiId) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  const items = ctx.store
    .list<StoredDocumentationPart>()
    .filter((entry) => entry.key.startsWith(`docpart/${restApiId}/`))
    .map((entry) => documentationPartView(entry.value));
  return { items };
};

const UpdateDocumentationPart: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const documentationPartId = stringOrUndefined(input["documentationPartId"]);
  if (!restApiId || !documentationPartId) {
    throw awsError(
      "BadRequestException",
      "restApiId and documentationPartId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  const d = requireDocumentationPart(ctx, restApiId, documentationPartId);
  const patched = applyPatch(
    d as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredDocumentationPart = {
    ...d,
    properties: stringOrUndefined(patched["properties"]) ?? d.properties,
  };
  ctx.store.set(documentationPartKey(restApiId, documentationPartId), updated);
  return documentationPartView(updated);
};

const DeleteDocumentationPart: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const documentationPartId = stringOrUndefined(input["documentationPartId"]);
  if (!restApiId || !documentationPartId) {
    throw awsError(
      "BadRequestException",
      "restApiId and documentationPartId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireDocumentationPart(ctx, restApiId, documentationPartId);
  ctx.store.delete(documentationPartKey(restApiId, documentationPartId));
  return {};
};

const ImportDocumentationParts: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (!restApiId) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  return { ids: [], warnings: [] };
};

const CreateDocumentationVersion: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const docVersion = stringOrUndefined(input["documentationVersion"]);
  if (!restApiId || !docVersion) {
    throw awsError(
      "BadRequestException",
      "restApiId and documentationVersion are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  if (
    ctx.store.get(documentationVersionKey(restApiId, docVersion)) !== undefined
  ) {
    throw awsError(
      "ConflictException",
      "Documentation version already exists",
      409,
    );
  }
  const d: StoredDocumentationVersion = {
    version: docVersion,
    createdDate: new Date(),
    description: stringOrUndefined(input["description"]),
  };
  ctx.store.set(documentationVersionKey(restApiId, docVersion), d);
  return documentationVersionView(d);
};

const GetDocumentationVersion: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const docVersion = stringOrUndefined(input["documentationVersion"]);
  if (!restApiId || !docVersion) {
    throw awsError(
      "BadRequestException",
      "restApiId and documentationVersion are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  return documentationVersionView(
    requireDocumentationVersion(ctx, restApiId, docVersion),
  );
};

const GetDocumentationVersions: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (!restApiId) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  const items = ctx.store
    .list<StoredDocumentationVersion>()
    .filter((entry) => entry.key.startsWith(`docversion/${restApiId}/`))
    .map((entry) => documentationVersionView(entry.value));
  return { items };
};

const UpdateDocumentationVersion: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const docVersion = stringOrUndefined(input["documentationVersion"]);
  if (!restApiId || !docVersion) {
    throw awsError(
      "BadRequestException",
      "restApiId and documentationVersion are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  const d = requireDocumentationVersion(ctx, restApiId, docVersion);
  const patched = applyPatch(
    d as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredDocumentationVersion = {
    ...d,
    description: stringOrUndefined(patched["description"]),
  };
  ctx.store.set(documentationVersionKey(restApiId, docVersion), updated);
  return documentationVersionView(updated);
};

const DeleteDocumentationVersion: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const docVersion = stringOrUndefined(input["documentationVersion"]);
  if (!restApiId || !docVersion) {
    throw awsError(
      "BadRequestException",
      "restApiId and documentationVersion are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireDocumentationVersion(ctx, restApiId, docVersion);
  ctx.store.delete(documentationVersionKey(restApiId, docVersion));
  return {};
};

const CreateRequestValidator: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (!restApiId) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  const id = randomId();
  const v: StoredRequestValidator = {
    id,
    name: stringOrUndefined(input["name"]),
    validateRequestBody: input["validateRequestBody"] === true,
    validateRequestParameters: input["validateRequestParameters"] === true,
  };
  ctx.store.set(requestValidatorKey(restApiId, id), v);
  return requestValidatorView(v);
};

const GetRequestValidator: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const requestValidatorId = stringOrUndefined(input["requestValidatorId"]);
  if (!restApiId || !requestValidatorId) {
    throw awsError(
      "BadRequestException",
      "restApiId and requestValidatorId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  return requestValidatorView(
    requireRequestValidator(ctx, restApiId, requestValidatorId),
  );
};

const GetRequestValidators: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (!restApiId) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  const items = ctx.store
    .list<StoredRequestValidator>()
    .filter((entry) => entry.key.startsWith(`requestvalidator/${restApiId}/`))
    .map((entry) => requestValidatorView(entry.value));
  return { items };
};

const UpdateRequestValidator: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const requestValidatorId = stringOrUndefined(input["requestValidatorId"]);
  if (!restApiId || !requestValidatorId) {
    throw awsError(
      "BadRequestException",
      "restApiId and requestValidatorId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  const v = requireRequestValidator(ctx, restApiId, requestValidatorId);
  const patched = applyPatch(
    v as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredRequestValidator = {
    ...v,
    name: stringOrUndefined(patched["name"]) ?? v.name,
    validateRequestBody:
      patched["validateRequestBody"] === "true" ||
      patched["validateRequestBody"] === true
        ? true
        : patched["validateRequestBody"] === "false" ||
            patched["validateRequestBody"] === false
          ? false
          : v.validateRequestBody,
    validateRequestParameters:
      patched["validateRequestParameters"] === "true" ||
      patched["validateRequestParameters"] === true
        ? true
        : patched["validateRequestParameters"] === "false" ||
            patched["validateRequestParameters"] === false
          ? false
          : v.validateRequestParameters,
  };
  ctx.store.set(requestValidatorKey(restApiId, requestValidatorId), updated);
  return requestValidatorView(updated);
};

const DeleteRequestValidator: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const requestValidatorId = stringOrUndefined(input["requestValidatorId"]);
  if (!restApiId || !requestValidatorId) {
    throw awsError(
      "BadRequestException",
      "restApiId and requestValidatorId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireRequestValidator(ctx, restApiId, requestValidatorId);
  ctx.store.delete(requestValidatorKey(restApiId, requestValidatorId));
  return {};
};

const PutGatewayResponse: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const responseType = stringOrUndefined(input["responseType"]);
  if (!restApiId || !responseType) {
    throw awsError(
      "BadRequestException",
      "restApiId and responseType are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  const g: StoredGatewayResponse = {
    responseType,
    statusCode: stringOrUndefined(input["statusCode"]),
    responseParameters:
      input["responseParameters"] !== null &&
      typeof input["responseParameters"] === "object"
        ? (input["responseParameters"] as Record<string, string>)
        : undefined,
    responseTemplates:
      input["responseTemplates"] !== null &&
      typeof input["responseTemplates"] === "object"
        ? (input["responseTemplates"] as Record<string, string>)
        : undefined,
    defaultResponse: false,
  };
  ctx.store.set(gatewayResponseKey(restApiId, responseType), g);
  return gatewayResponseView(g);
};

const GetGatewayResponse: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const responseType = stringOrUndefined(input["responseType"]);
  if (!restApiId || !responseType) {
    throw awsError(
      "BadRequestException",
      "restApiId and responseType are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  return gatewayResponseView(
    requireGatewayResponse(ctx, restApiId, responseType),
  );
};

const GetGatewayResponses: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (!restApiId) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  const items = ctx.store
    .list<StoredGatewayResponse>()
    .filter((entry) => entry.key.startsWith(`gatewayresponse/${restApiId}/`))
    .map((entry) => gatewayResponseView(entry.value));
  return { items };
};

const UpdateGatewayResponse: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const responseType = stringOrUndefined(input["responseType"]);
  if (!restApiId || !responseType) {
    throw awsError(
      "BadRequestException",
      "restApiId and responseType are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  const g = requireGatewayResponse(ctx, restApiId, responseType);
  const patched = applyPatch(
    g as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredGatewayResponse = {
    ...g,
    statusCode: stringOrUndefined(patched["statusCode"]),
  };
  ctx.store.set(gatewayResponseKey(restApiId, responseType), updated);
  return gatewayResponseView(updated);
};

const DeleteGatewayResponse: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const responseType = stringOrUndefined(input["responseType"]);
  if (!restApiId || !responseType) {
    throw awsError(
      "BadRequestException",
      "restApiId and responseType are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireGatewayResponse(ctx, restApiId, responseType);
  ctx.store.delete(gatewayResponseKey(restApiId, responseType));
  return {};
};

const TestInvokeAuthorizer: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (!restApiId) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  return {
    clientStatus: 200,
    log: "",
    latency: 0,
    principalId: "user",
    policy: "",
    authorization: {},
    claims: {},
  };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const apigateway = {
  name: "apigateway",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);

    if (parts[0] === "account") {
      if (parts.length === 1) {
        if (req.method === "GET") return "GetAccount";
        if (req.method === "PATCH") return "UpdateAccount";
      }
      return undefined;
    }

    if (parts[0] === "sdktypes") {
      if (parts.length === 1 && req.method === "GET") return "GetSdkTypes";
      if (parts.length === 2 && req.method === "GET") return "GetSdkType";
      return undefined;
    }

    if (parts[0] !== "restapis") return undefined;

    if (parts.length === 1) {
      if (req.method === "POST") {
        if (req.query.get("mode") === "import") return "ImportRestApi";
        return "CreateRestApi";
      }
      if (req.method === "GET") return "GetRestApis";
      return undefined;
    }

    if (parts.length === 2) {
      if (req.method === "GET") return "GetRestApi";
      if (req.method === "DELETE") return "DeleteRestApi";
      if (req.method === "PATCH") return "UpdateRestApi";
      if (req.method === "PUT") return "PutRestApi";
      return undefined;
    }

    switch (parts[2]) {
      case "resources": {
        if (parts.length === 3 && req.method === "GET") return "GetResources";
        if (parts.length === 4) {
          if (req.method === "POST") return "CreateResource";
          if (req.method === "GET") return "GetResource";
          if (req.method === "DELETE") return "DeleteResource";
          if (req.method === "PATCH") return "UpdateResource";
          return undefined;
        }
        if (parts.length === 6 && parts[4] === "methods") {
          if (req.method === "PUT") return "PutMethod";
          if (req.method === "GET") return "GetMethod";
          if (req.method === "DELETE") return "DeleteMethod";
          if (req.method === "PATCH") return "UpdateMethod";
          if (req.method === "POST") return "TestInvokeMethod";
          return undefined;
        }
        if (parts.length === 7 && parts[4] === "methods") {
          if (parts[6] === "integration") {
            if (req.method === "PUT") return "PutIntegration";
            if (req.method === "GET") return "GetIntegration";
            if (req.method === "DELETE") return "DeleteIntegration";
            if (req.method === "PATCH") return "UpdateIntegration";
          }
          return undefined;
        }
        if (parts.length === 8 && parts[4] === "methods") {
          if (parts[6] === "responses") {
            if (req.method === "PUT") return "PutMethodResponse";
            if (req.method === "GET") return "GetMethodResponse";
            if (req.method === "DELETE") return "DeleteMethodResponse";
            if (req.method === "PATCH") return "UpdateMethodResponse";
          }
          return undefined;
        }
        if (
          parts.length === 9 &&
          parts[4] === "methods" &&
          parts[6] === "integration" &&
          parts[7] === "responses"
        ) {
          if (req.method === "PUT") return "PutIntegrationResponse";
          if (req.method === "GET") return "GetIntegrationResponse";
          if (req.method === "DELETE") return "DeleteIntegrationResponse";
          if (req.method === "PATCH") return "UpdateIntegrationResponse";
          return undefined;
        }
        return undefined;
      }
      case "deployments": {
        if (parts.length === 3) {
          if (req.method === "POST") return "CreateDeployment";
          if (req.method === "GET") return "GetDeployments";
          return undefined;
        }
        if (parts.length === 4) {
          if (req.method === "GET") return "GetDeployment";
          if (req.method === "DELETE") return "DeleteDeployment";
          if (req.method === "PATCH") return "UpdateDeployment";
          return undefined;
        }
        return undefined;
      }
      case "models": {
        if (parts.length === 3) {
          if (req.method === "GET") return "GetModels";
          if (req.method === "POST") return "CreateModel";
          return undefined;
        }
        if (parts.length === 4) {
          if (req.method === "GET") return "GetModel";
          if (req.method === "DELETE") return "DeleteModel";
          if (req.method === "PATCH") return "UpdateModel";
          return undefined;
        }
        if (parts.length === 5 && parts[4] === "default_template") {
          if (req.method === "GET") return "GetModelTemplate";
          return undefined;
        }
        return undefined;
      }
      case "stages": {
        if (parts.length === 3) {
          if (req.method === "GET") return "GetStages";
          if (req.method === "POST") return "CreateStage";
          return undefined;
        }
        if (parts.length === 4) {
          if (req.method === "GET") return "GetStage";
          if (req.method === "DELETE") return "DeleteStage";
          if (req.method === "PATCH") return "UpdateStage";
          return undefined;
        }
        if (parts.length === 6) {
          if (
            parts[4] === "cache" &&
            parts[5] === "data" &&
            req.method === "DELETE"
          )
            return "FlushStageCache";
          if (
            parts[4] === "cache" &&
            parts[5] === "authorizers" &&
            req.method === "DELETE"
          )
            return "FlushStageAuthorizersCache";
          if (parts[4] === "exports" && req.method === "GET")
            return "GetExport";
          if (parts[4] === "sdks" && req.method === "GET") return "GetSdk";
          return undefined;
        }
        return undefined;
      }
      case "documentation": {
        if (parts.length === 4 && parts[3] === "parts") {
          if (req.method === "POST") return "CreateDocumentationPart";
          if (req.method === "GET") return "GetDocumentationParts";
          if (req.method === "PUT") return "ImportDocumentationParts";
          return undefined;
        }
        if (parts.length === 5 && parts[3] === "parts") {
          if (req.method === "GET") return "GetDocumentationPart";
          if (req.method === "PATCH") return "UpdateDocumentationPart";
          if (req.method === "DELETE") return "DeleteDocumentationPart";
          return undefined;
        }
        if (parts.length === 4 && parts[3] === "versions") {
          if (req.method === "POST") return "CreateDocumentationVersion";
          if (req.method === "GET") return "GetDocumentationVersions";
          return undefined;
        }
        if (parts.length === 5 && parts[3] === "versions") {
          if (req.method === "GET") return "GetDocumentationVersion";
          if (req.method === "PATCH") return "UpdateDocumentationVersion";
          if (req.method === "DELETE") return "DeleteDocumentationVersion";
          return undefined;
        }
        return undefined;
      }
      case "requestvalidators": {
        if (parts.length === 3) {
          if (req.method === "POST") return "CreateRequestValidator";
          if (req.method === "GET") return "GetRequestValidators";
          return undefined;
        }
        if (parts.length === 4) {
          if (req.method === "GET") return "GetRequestValidator";
          if (req.method === "PATCH") return "UpdateRequestValidator";
          if (req.method === "DELETE") return "DeleteRequestValidator";
          return undefined;
        }
        return undefined;
      }
      case "gatewayresponses": {
        if (parts.length === 3 && req.method === "GET")
          return "GetGatewayResponses";
        if (parts.length === 4) {
          if (req.method === "PUT") return "PutGatewayResponse";
          if (req.method === "GET") return "GetGatewayResponse";
          if (req.method === "PATCH") return "UpdateGatewayResponse";
          if (req.method === "DELETE") return "DeleteGatewayResponse";
          return undefined;
        }
        return undefined;
      }
      case "authorizers": {
        if (parts.length === 4 && req.method === "POST")
          return "TestInvokeAuthorizer";
        return undefined;
      }
    }

    return undefined;
  },
  operations: {
    CreateRestApi,
    GetRestApis,
    GetRestApi,
    DeleteRestApi,
    UpdateRestApi,
    PutRestApi,
    ImportRestApi,
    CreateResource,
    GetResources,
    GetResource,
    DeleteResource,
    UpdateResource,
    PutMethod,
    GetMethod,
    DeleteMethod,
    UpdateMethod,
    TestInvokeMethod,
    PutIntegration,
    GetIntegration,
    DeleteIntegration,
    UpdateIntegration,
    PutMethodResponse,
    GetMethodResponse,
    DeleteMethodResponse,
    UpdateMethodResponse,
    PutIntegrationResponse,
    GetIntegrationResponse,
    DeleteIntegrationResponse,
    UpdateIntegrationResponse,
    CreateDeployment,
    GetDeployments,
    GetDeployment,
    DeleteDeployment,
    UpdateDeployment,
    CreateModel,
    GetModels,
    GetModel,
    DeleteModel,
    UpdateModel,
    GetModelTemplate,
    CreateStage,
    GetStage,
    GetStages,
    DeleteStage,
    UpdateStage,
    FlushStageCache,
    FlushStageAuthorizersCache,
    GetExport,
    GetSdk,
    GetSdkTypes,
    GetSdkType,
    GetAccount,
    UpdateAccount,
    CreateDocumentationPart,
    GetDocumentationPart,
    GetDocumentationParts,
    UpdateDocumentationPart,
    DeleteDocumentationPart,
    ImportDocumentationParts,
    CreateDocumentationVersion,
    GetDocumentationVersion,
    GetDocumentationVersions,
    UpdateDocumentationVersion,
    DeleteDocumentationVersion,
    CreateRequestValidator,
    GetRequestValidator,
    GetRequestValidators,
    UpdateRequestValidator,
    DeleteRequestValidator,
    PutGatewayResponse,
    GetGatewayResponse,
    GetGatewayResponses,
    UpdateGatewayResponse,
    DeleteGatewayResponse,
    TestInvokeAuthorizer,
  },
  model,
} as const satisfies ServiceDefinition;

export default apigateway;
