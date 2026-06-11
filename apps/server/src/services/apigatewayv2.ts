import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import apigatewayv2Model from "../../../../test/vendor/aws-models/apigatewayv2.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(apigatewayv2Model);

type StoredCors = {
  allowCredentials: boolean | undefined;
  allowHeaders: string[] | undefined;
  allowMethods: string[] | undefined;
  allowOrigins: string[] | undefined;
  exposeHeaders: string[] | undefined;
  maxAge: number | undefined;
};

type StoredApi = {
  apiId: string;
  apiKeySelectionExpression: string | undefined;
  corsConfiguration: StoredCors | undefined;
  createdDate: string;
  description: string | undefined;
  disableExecuteApiEndpoint: boolean;
  disableSchemaValidation: boolean;
  name: string;
  protocolType: string;
  routeSelectionExpression: string;
  tags: Record<string, string>;
  version: string | undefined;
};

type StoredRoute = {
  routeId: string;
  apiId: string;
  apiKeyRequired: boolean;
  authorizationScopes: string[] | undefined;
  authorizationType: string;
  authorizerId: string | undefined;
  modelSelectionExpression: string | undefined;
  operationName: string | undefined;
  requestModels: Record<string, string> | undefined;
  requestParameters: Record<string, unknown> | undefined;
  routeKey: string;
  routeResponseSelectionExpression: string | undefined;
  target: string | undefined;
};

type StoredIntegration = {
  integrationId: string;
  apiId: string;
  connectionId: string | undefined;
  connectionType: string | undefined;
  contentHandlingStrategy: string | undefined;
  credentialsArn: string | undefined;
  description: string | undefined;
  integrationMethod: string | undefined;
  integrationSubtype: string | undefined;
  integrationType: string;
  integrationUri: string | undefined;
  passthroughBehavior: string | undefined;
  payloadFormatVersion: string | undefined;
  requestParameters: Record<string, string> | undefined;
  requestTemplates: Record<string, string> | undefined;
  responseParameters: Record<string, unknown> | undefined;
  templateSelectionExpression: string | undefined;
  timeoutInMillis: number;
};

type StoredAccessLogSettings = {
  destinationArn: string | undefined;
  format: string | undefined;
};

type StoredRouteSettings = {
  dataTraceEnabled: boolean | undefined;
  detailedMetricsEnabled: boolean | undefined;
  loggingLevel: string | undefined;
  throttlingBurstLimit: number | undefined;
  throttlingRateLimit: number | undefined;
};

type StoredStage = {
  stageName: string;
  apiId: string;
  accessLogSettings: StoredAccessLogSettings | undefined;
  autoDeploy: boolean;
  clientCertificateId: string | undefined;
  createdDate: string;
  defaultRouteSettings: StoredRouteSettings | undefined;
  deploymentId: string | undefined;
  description: string | undefined;
  lastUpdatedDate: string;
  routeSettings: Record<string, StoredRouteSettings> | undefined;
  stageVariables: Record<string, string> | undefined;
  tags: Record<string, string>;
};

type StoredDeployment = {
  deploymentId: string;
  apiId: string;
  autoDeployed: boolean;
  createdDate: string;
  deploymentStatus: string;
  deploymentStatusMessage: string | undefined;
  description: string | undefined;
};

type StoredJwtConfiguration = {
  audience: string[] | undefined;
  issuer: string | undefined;
};

type StoredAuthorizer = {
  authorizerId: string;
  apiId: string;
  authorizerCredentialsArn: string | undefined;
  authorizerPayloadFormatVersion: string | undefined;
  authorizerResultTtlInSeconds: number | undefined;
  authorizerType: string;
  authorizerUri: string | undefined;
  enableSimpleResponses: boolean | undefined;
  identitySource: string[] | undefined;
  identityValidationExpression: string | undefined;
  jwtConfiguration: StoredJwtConfiguration | undefined;
  name: string;
};

const apiPrefix = "v2:api:" as const;
const routePrefix = "v2:route:" as const;
const integrationPrefix = "v2:integration:" as const;
const stagePrefix = "v2:stage:" as const;
const deploymentPrefix = "v2:deployment:" as const;
const authorizerPrefix = "v2:authorizer:" as const;
const tagPrefix = "v2:tag:" as const;

const apiKey = (apiId: string): string => `${apiPrefix}${apiId}`;
const routeKey = (apiId: string, routeId: string): string =>
  `${routePrefix}${apiId}/${routeId}`;
const integrationKey = (apiId: string, integrationId: string): string =>
  `${integrationPrefix}${apiId}/${integrationId}`;
const stageKey = (apiId: string, stageName: string): string =>
  `${stagePrefix}${apiId}/${stageName}`;
const deploymentKey = (apiId: string, deploymentId: string): string =>
  `${deploymentPrefix}${apiId}/${deploymentId}`;
const authorizerKey = (apiId: string, authorizerId: string): string =>
  `${authorizerPrefix}${apiId}/${authorizerId}`;
const tagKey = (arn: string): string => `${tagPrefix}${arn}`;

const randomId = (): string =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 10);

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const boolOrUndefined = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;

const asStringRecord = (value: unknown): Record<string, string> | undefined => {
  const r = asRecord(value);
  if (r === undefined) return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "string") result[k] = v;
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const result = value.filter((v): v is string => typeof v === "string");
  return result.length > 0 ? result : undefined;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined)
    throw awsError("BadRequestException", `${field} is required.`, 400);
  return value;
};

const getApi = (apiId: string, ctx: ServiceContext): StoredApi => {
  const api = ctx.store.get<StoredApi>(apiKey(apiId));
  if (api === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid API identifier specified`,
      404,
    );
  return api;
};

const apiArn = (ctx: ServiceContext, apiId: string): string =>
  `arn:aws:apigateway:${ctx.region}::/apis/${apiId}`;

const stageArn = (
  ctx: ServiceContext,
  apiId: string,
  stageName: string,
): string =>
  `arn:aws:apigateway:${ctx.region}::/apis/${apiId}/stages/${stageName}`;

const parseCors = (value: unknown): StoredCors | undefined => {
  const r = asRecord(value);
  if (r === undefined) return undefined;
  return {
    allowCredentials: boolOrUndefined(r["AllowCredentials"]),
    allowHeaders: asStringArray(r["AllowHeaders"]),
    allowMethods: asStringArray(r["AllowMethods"]),
    allowOrigins: asStringArray(r["AllowOrigins"]),
    exposeHeaders: asStringArray(r["ExposeHeaders"]),
    maxAge: numberOrUndefined(r["MaxAge"]),
  };
};

const formatCors = (cors: StoredCors | undefined) => {
  if (cors === undefined) return undefined;
  return {
    AllowCredentials: cors.allowCredentials,
    AllowHeaders: cors.allowHeaders,
    AllowMethods: cors.allowMethods,
    AllowOrigins: cors.allowOrigins,
    ExposeHeaders: cors.exposeHeaders,
    MaxAge: cors.maxAge,
  };
};

const formatApi = (api: StoredApi, ctx: ServiceContext) => ({
  ApiId: api.apiId,
  ApiEndpoint: `https://${api.apiId}.execute-api.${ctx.region}.amazonaws.com`,
  ApiKeySelectionExpression: api.apiKeySelectionExpression,
  CorsConfiguration: formatCors(api.corsConfiguration),
  CreatedDate: api.createdDate,
  Description: api.description,
  DisableExecuteApiEndpoint: api.disableExecuteApiEndpoint,
  DisableSchemaValidation: api.disableSchemaValidation,
  Name: api.name,
  ProtocolType: api.protocolType,
  RouteSelectionExpression: api.routeSelectionExpression,
  Tags: api.tags,
  Version: api.version,
});

const formatRoute = (route: StoredRoute) => ({
  ApiKeyRequired: route.apiKeyRequired,
  AuthorizationScopes: route.authorizationScopes,
  AuthorizationType: route.authorizationType,
  AuthorizerId: route.authorizerId,
  ModelSelectionExpression: route.modelSelectionExpression,
  OperationName: route.operationName,
  RequestModels: route.requestModels,
  RequestParameters: route.requestParameters,
  RouteId: route.routeId,
  RouteKey: route.routeKey,
  RouteResponseSelectionExpression: route.routeResponseSelectionExpression,
  Target: route.target,
});

const formatIntegration = (integration: StoredIntegration) => ({
  ConnectionId: integration.connectionId,
  ConnectionType: integration.connectionType,
  ContentHandlingStrategy: integration.contentHandlingStrategy,
  CredentialsArn: integration.credentialsArn,
  Description: integration.description,
  IntegrationId: integration.integrationId,
  IntegrationMethod: integration.integrationMethod,
  IntegrationSubtype: integration.integrationSubtype,
  IntegrationType: integration.integrationType,
  IntegrationUri: integration.integrationUri,
  PassthroughBehavior: integration.passthroughBehavior,
  PayloadFormatVersion: integration.payloadFormatVersion,
  RequestParameters: integration.requestParameters,
  RequestTemplates: integration.requestTemplates,
  ResponseParameters: integration.responseParameters,
  TemplateSelectionExpression: integration.templateSelectionExpression,
  TimeoutInMillis: integration.timeoutInMillis,
});

const parseRouteSettings = (
  value: unknown,
): StoredRouteSettings | undefined => {
  const r = asRecord(value);
  if (r === undefined) return undefined;
  return {
    dataTraceEnabled: boolOrUndefined(r["DataTraceEnabled"]),
    detailedMetricsEnabled: boolOrUndefined(r["DetailedMetricsEnabled"]),
    loggingLevel: stringOrUndefined(r["LoggingLevel"]),
    throttlingBurstLimit: numberOrUndefined(r["ThrottlingBurstLimit"]),
    throttlingRateLimit: numberOrUndefined(r["ThrottlingRateLimit"]),
  };
};

const formatRouteSettings = (rs: StoredRouteSettings | undefined) => {
  if (rs === undefined) return undefined;
  return {
    DataTraceEnabled: rs.dataTraceEnabled,
    DetailedMetricsEnabled: rs.detailedMetricsEnabled,
    LoggingLevel: rs.loggingLevel,
    ThrottlingBurstLimit: rs.throttlingBurstLimit,
    ThrottlingRateLimit: rs.throttlingRateLimit,
  };
};

const formatAccessLogSettings = (als: StoredAccessLogSettings | undefined) => {
  if (als === undefined) return undefined;
  return {
    DestinationArn: als.destinationArn,
    Format: als.format,
  };
};

const formatStage = (stage: StoredStage) => ({
  AccessLogSettings: formatAccessLogSettings(stage.accessLogSettings),
  AutoDeploy: stage.autoDeploy,
  ClientCertificateId: stage.clientCertificateId,
  CreatedDate: stage.createdDate,
  DefaultRouteSettings: formatRouteSettings(stage.defaultRouteSettings),
  DeploymentId: stage.deploymentId,
  Description: stage.description,
  LastUpdatedDate: stage.lastUpdatedDate,
  RouteSettings: stage.routeSettings
    ? Object.fromEntries(
        Object.entries(stage.routeSettings).map(([k, v]) => [
          k,
          formatRouteSettings(v),
        ]),
      )
    : undefined,
  StageName: stage.stageName,
  StageVariables: stage.stageVariables,
  Tags: stage.tags,
});

const formatDeployment = (deployment: StoredDeployment) => ({
  AutoDeployed: deployment.autoDeployed,
  CreatedDate: deployment.createdDate,
  DeploymentId: deployment.deploymentId,
  DeploymentStatus: deployment.deploymentStatus,
  DeploymentStatusMessage: deployment.deploymentStatusMessage,
  Description: deployment.description,
});

const formatAuthorizer = (authorizer: StoredAuthorizer) => ({
  AuthorizerId: authorizer.authorizerId,
  AuthorizerCredentialsArn: authorizer.authorizerCredentialsArn,
  AuthorizerPayloadFormatVersion: authorizer.authorizerPayloadFormatVersion,
  AuthorizerResultTtlInSeconds: authorizer.authorizerResultTtlInSeconds,
  AuthorizerType: authorizer.authorizerType,
  AuthorizerUri: authorizer.authorizerUri,
  EnableSimpleResponses: authorizer.enableSimpleResponses,
  IdentitySource: authorizer.identitySource,
  IdentityValidationExpression: authorizer.identityValidationExpression,
  JwtConfiguration: authorizer.jwtConfiguration
    ? {
        Audience: authorizer.jwtConfiguration.audience,
        Issuer: authorizer.jwtConfiguration.issuer,
      }
    : undefined,
  Name: authorizer.name,
});

const listByPrefix = <T>(ctx: ServiceContext, prefix: string): T[] =>
  ctx.store
    .list<T>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);

const CreateApi: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const protocolType = requireString(input, "ProtocolType");
  const id = randomId();
  const now = new Date().toISOString();
  const defaultRse =
    protocolType === "HTTP"
      ? "${request.method} ${request.path}"
      : "$request.body.action";
  const api: StoredApi = {
    apiId: id,
    apiKeySelectionExpression:
      stringOrUndefined(input["ApiKeySelectionExpression"]) ??
      "$request.header.x-api-key",
    corsConfiguration: parseCors(input["CorsConfiguration"]),
    createdDate: now,
    description: stringOrUndefined(input["Description"]),
    disableExecuteApiEndpoint:
      boolOrUndefined(input["DisableExecuteApiEndpoint"]) ?? false,
    disableSchemaValidation:
      boolOrUndefined(input["DisableSchemaValidation"]) ?? false,
    name,
    protocolType,
    routeSelectionExpression:
      stringOrUndefined(input["RouteSelectionExpression"]) ?? defaultRse,
    tags: asStringRecord(input["Tags"]) ?? {},
    version: stringOrUndefined(input["Version"]),
  };
  ctx.store.set(apiKey(id), api);
  const arn = apiArn(ctx, id);
  if (Object.keys(api.tags).length > 0) {
    ctx.store.set(tagKey(arn), api.tags);
  }
  return formatApi(api, ctx);
};

const GetApi: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ApiId");
  const api = getApi(id, ctx);
  return formatApi(api, ctx);
};

const GetApis: OperationHandler = (input, ctx) => {
  const apis = listByPrefix<StoredApi>(ctx, apiPrefix);
  return { Items: apis.map((a) => formatApi(a, ctx)) };
};

const UpdateApi: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ApiId");
  const api = getApi(id, ctx);
  const updated: StoredApi = {
    ...api,
    name: stringOrUndefined(input["Name"]) ?? api.name,
    description:
      "Description" in input
        ? stringOrUndefined(input["Description"])
        : api.description,
    version:
      "Version" in input ? stringOrUndefined(input["Version"]) : api.version,
    disableExecuteApiEndpoint:
      boolOrUndefined(input["DisableExecuteApiEndpoint"]) ??
      api.disableExecuteApiEndpoint,
    disableSchemaValidation:
      boolOrUndefined(input["DisableSchemaValidation"]) ??
      api.disableSchemaValidation,
    corsConfiguration:
      "CorsConfiguration" in input
        ? parseCors(input["CorsConfiguration"])
        : api.corsConfiguration,
    routeSelectionExpression:
      stringOrUndefined(input["RouteSelectionExpression"]) ??
      api.routeSelectionExpression,
    apiKeySelectionExpression:
      stringOrUndefined(input["ApiKeySelectionExpression"]) ??
      api.apiKeySelectionExpression,
  };
  ctx.store.set(apiKey(id), updated);
  return formatApi(updated, ctx);
};

const DeleteApi: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ApiId");
  getApi(id, ctx);
  ctx.store.delete(apiKey(id));
  ctx.store
    .list()
    .filter(
      (entry) =>
        entry.key.startsWith(`${routePrefix}${id}/`) ||
        entry.key.startsWith(`${integrationPrefix}${id}/`) ||
        entry.key.startsWith(`${stagePrefix}${id}/`) ||
        entry.key.startsWith(`${deploymentPrefix}${id}/`) ||
        entry.key.startsWith(`${authorizerPrefix}${id}/`),
    )
    .forEach((entry) => ctx.store.delete(entry.key));
  return {};
};

const CreateRoute: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  getApi(apiId, ctx);
  const routeKeyVal = requireString(input, "RouteKey");
  const existing = listByPrefix<StoredRoute>(
    ctx,
    `${routePrefix}${apiId}/`,
  ).find((r) => r.routeKey === routeKeyVal);
  if (existing !== undefined)
    throw awsError(
      "ConflictException",
      `Route with key ${routeKeyVal} already exists.`,
      409,
    );
  const id = randomId();
  const route: StoredRoute = {
    routeId: id,
    apiId,
    apiKeyRequired: boolOrUndefined(input["ApiKeyRequired"]) ?? false,
    authorizationScopes: asStringArray(input["AuthorizationScopes"]),
    authorizationType: stringOrUndefined(input["AuthorizationType"]) ?? "NONE",
    authorizerId: stringOrUndefined(input["AuthorizerId"]),
    modelSelectionExpression: stringOrUndefined(
      input["ModelSelectionExpression"],
    ),
    operationName: stringOrUndefined(input["OperationName"]),
    requestModels: asStringRecord(input["RequestModels"]),
    requestParameters: asRecord(input["RequestParameters"]),
    routeKey: routeKeyVal,
    routeResponseSelectionExpression: stringOrUndefined(
      input["RouteResponseSelectionExpression"],
    ),
    target: stringOrUndefined(input["Target"]),
  };
  ctx.store.set(routeKey(apiId, id), route);
  return formatRoute(route);
};

const GetRoute: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const routeId = requireString(input, "RouteId");
  const route = ctx.store.get<StoredRoute>(routeKey(apiId, routeId));
  if (route === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Route identifier specified`,
      404,
    );
  return formatRoute(route);
};

const GetRoutes: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  getApi(apiId, ctx);
  const routes = listByPrefix<StoredRoute>(ctx, `${routePrefix}${apiId}/`);
  return { Items: routes.map(formatRoute) };
};

const UpdateRoute: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const routeId = requireString(input, "RouteId");
  const route = ctx.store.get<StoredRoute>(routeKey(apiId, routeId));
  if (route === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Route identifier specified`,
      404,
    );
  const updated: StoredRoute = {
    ...route,
    apiKeyRequired:
      boolOrUndefined(input["ApiKeyRequired"]) ?? route.apiKeyRequired,
    authorizationScopes:
      "AuthorizationScopes" in input
        ? asStringArray(input["AuthorizationScopes"])
        : route.authorizationScopes,
    authorizationType:
      stringOrUndefined(input["AuthorizationType"]) ?? route.authorizationType,
    authorizerId:
      "AuthorizerId" in input
        ? stringOrUndefined(input["AuthorizerId"])
        : route.authorizerId,
    modelSelectionExpression:
      "ModelSelectionExpression" in input
        ? stringOrUndefined(input["ModelSelectionExpression"])
        : route.modelSelectionExpression,
    operationName:
      "OperationName" in input
        ? stringOrUndefined(input["OperationName"])
        : route.operationName,
    requestModels:
      "RequestModels" in input
        ? asStringRecord(input["RequestModels"])
        : route.requestModels,
    requestParameters:
      "RequestParameters" in input
        ? asRecord(input["RequestParameters"])
        : route.requestParameters,
    routeKey: stringOrUndefined(input["RouteKey"]) ?? route.routeKey,
    routeResponseSelectionExpression:
      "RouteResponseSelectionExpression" in input
        ? stringOrUndefined(input["RouteResponseSelectionExpression"])
        : route.routeResponseSelectionExpression,
    target:
      "Target" in input ? stringOrUndefined(input["Target"]) : route.target,
  };
  ctx.store.set(routeKey(apiId, routeId), updated);
  return formatRoute(updated);
};

const DeleteRoute: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const routeId = requireString(input, "RouteId");
  if (ctx.store.get<StoredRoute>(routeKey(apiId, routeId)) === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Route identifier specified`,
      404,
    );
  ctx.store.delete(routeKey(apiId, routeId));
  return {};
};

const DeleteRouteRequestParameter: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const routeId = requireString(input, "RouteId");
  const paramKey = requireString(input, "RequestParameterKey");
  const route = ctx.store.get<StoredRoute>(routeKey(apiId, routeId));
  if (route === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Route identifier specified`,
      404,
    );
  const params = { ...(route.requestParameters ?? {}) };
  delete params[paramKey];
  const updated: StoredRoute = {
    ...route,
    requestParameters: Object.keys(params).length > 0 ? params : undefined,
  };
  ctx.store.set(routeKey(apiId, routeId), updated);
  return {};
};

const DeleteRouteSettings: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const stageName = requireString(input, "StageName");
  const routeKeyVal = requireString(input, "RouteKey");
  const stage = ctx.store.get<StoredStage>(stageKey(apiId, stageName));
  if (stage === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Stage identifier specified`,
      404,
    );
  const settings = { ...(stage.routeSettings ?? {}) };
  delete settings[routeKeyVal];
  const updated: StoredStage = {
    ...stage,
    routeSettings: Object.keys(settings).length > 0 ? settings : undefined,
  };
  ctx.store.set(stageKey(apiId, stageName), updated);
  return {};
};

const CreateIntegration: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  getApi(apiId, ctx);
  const integrationType = requireString(input, "IntegrationType");
  const id = randomId();
  const integration: StoredIntegration = {
    integrationId: id,
    apiId,
    connectionId: stringOrUndefined(input["ConnectionId"]),
    connectionType: stringOrUndefined(input["ConnectionType"]),
    contentHandlingStrategy: stringOrUndefined(
      input["ContentHandlingStrategy"],
    ),
    credentialsArn: stringOrUndefined(input["CredentialsArn"]),
    description: stringOrUndefined(input["Description"]),
    integrationMethod: stringOrUndefined(input["IntegrationMethod"]),
    integrationSubtype: stringOrUndefined(input["IntegrationSubtype"]),
    integrationType,
    integrationUri: stringOrUndefined(input["IntegrationUri"]),
    passthroughBehavior: stringOrUndefined(input["PassthroughBehavior"]),
    payloadFormatVersion: stringOrUndefined(input["PayloadFormatVersion"]),
    requestParameters: asStringRecord(input["RequestParameters"]),
    requestTemplates: asStringRecord(input["RequestTemplates"]),
    responseParameters: asRecord(input["ResponseParameters"]),
    templateSelectionExpression: stringOrUndefined(
      input["TemplateSelectionExpression"],
    ),
    timeoutInMillis: numberOrUndefined(input["TimeoutInMillis"]) ?? 29000,
  };
  ctx.store.set(integrationKey(apiId, id), integration);
  return formatIntegration(integration);
};

const GetIntegration: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const integrationId = requireString(input, "IntegrationId");
  const integration = ctx.store.get<StoredIntegration>(
    integrationKey(apiId, integrationId),
  );
  if (integration === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Integration identifier specified`,
      404,
    );
  return formatIntegration(integration);
};

const GetIntegrations: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  getApi(apiId, ctx);
  const integrations = listByPrefix<StoredIntegration>(
    ctx,
    `${integrationPrefix}${apiId}/`,
  );
  return { Items: integrations.map(formatIntegration) };
};

const UpdateIntegration: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const integrationId = requireString(input, "IntegrationId");
  const integration = ctx.store.get<StoredIntegration>(
    integrationKey(apiId, integrationId),
  );
  if (integration === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Integration identifier specified`,
      404,
    );
  const updated: StoredIntegration = {
    ...integration,
    connectionId:
      "ConnectionId" in input
        ? stringOrUndefined(input["ConnectionId"])
        : integration.connectionId,
    connectionType:
      "ConnectionType" in input
        ? stringOrUndefined(input["ConnectionType"])
        : integration.connectionType,
    contentHandlingStrategy:
      "ContentHandlingStrategy" in input
        ? stringOrUndefined(input["ContentHandlingStrategy"])
        : integration.contentHandlingStrategy,
    credentialsArn:
      "CredentialsArn" in input
        ? stringOrUndefined(input["CredentialsArn"])
        : integration.credentialsArn,
    description:
      "Description" in input
        ? stringOrUndefined(input["Description"])
        : integration.description,
    integrationMethod:
      "IntegrationMethod" in input
        ? stringOrUndefined(input["IntegrationMethod"])
        : integration.integrationMethod,
    integrationSubtype:
      "IntegrationSubtype" in input
        ? stringOrUndefined(input["IntegrationSubtype"])
        : integration.integrationSubtype,
    integrationType:
      stringOrUndefined(input["IntegrationType"]) ??
      integration.integrationType,
    integrationUri:
      "IntegrationUri" in input
        ? stringOrUndefined(input["IntegrationUri"])
        : integration.integrationUri,
    passthroughBehavior:
      "PassthroughBehavior" in input
        ? stringOrUndefined(input["PassthroughBehavior"])
        : integration.passthroughBehavior,
    payloadFormatVersion:
      "PayloadFormatVersion" in input
        ? stringOrUndefined(input["PayloadFormatVersion"])
        : integration.payloadFormatVersion,
    requestParameters:
      "RequestParameters" in input
        ? asStringRecord(input["RequestParameters"])
        : integration.requestParameters,
    requestTemplates:
      "RequestTemplates" in input
        ? asStringRecord(input["RequestTemplates"])
        : integration.requestTemplates,
    responseParameters:
      "ResponseParameters" in input
        ? asRecord(input["ResponseParameters"])
        : integration.responseParameters,
    templateSelectionExpression:
      "TemplateSelectionExpression" in input
        ? stringOrUndefined(input["TemplateSelectionExpression"])
        : integration.templateSelectionExpression,
    timeoutInMillis:
      numberOrUndefined(input["TimeoutInMillis"]) ??
      integration.timeoutInMillis,
  };
  ctx.store.set(integrationKey(apiId, integrationId), updated);
  return formatIntegration(updated);
};

const DeleteIntegration: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const integrationId = requireString(input, "IntegrationId");
  if (
    ctx.store.get<StoredIntegration>(integrationKey(apiId, integrationId)) ===
    undefined
  )
    throw awsError(
      "NotFoundException",
      `Invalid Integration identifier specified`,
      404,
    );
  ctx.store.delete(integrationKey(apiId, integrationId));
  return {};
};

const CreateStage: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  getApi(apiId, ctx);
  const stageName = requireString(input, "StageName");
  if (ctx.store.get<StoredStage>(stageKey(apiId, stageName)) !== undefined)
    throw awsError(
      "ConflictException",
      `Stage ${stageName} already exists.`,
      409,
    );
  const now = new Date().toISOString();

  const accessLogRaw = asRecord(input["AccessLogSettings"]);
  const accessLogSettings: StoredAccessLogSettings | undefined =
    accessLogRaw !== undefined
      ? {
          destinationArn: stringOrUndefined(accessLogRaw["DestinationArn"]),
          format: stringOrUndefined(accessLogRaw["Format"]),
        }
      : undefined;

  const routeSettingsRaw = asRecord(input["RouteSettings"]);
  const routeSettings: Record<string, StoredRouteSettings> | undefined =
    routeSettingsRaw !== undefined
      ? Object.fromEntries(
          Object.entries(routeSettingsRaw).map(([k, v]) => [
            k,
            parseRouteSettings(v) ?? {
              dataTraceEnabled: undefined,
              detailedMetricsEnabled: undefined,
              loggingLevel: undefined,
              throttlingBurstLimit: undefined,
              throttlingRateLimit: undefined,
            },
          ]),
        )
      : undefined;

  const stage: StoredStage = {
    stageName,
    apiId,
    accessLogSettings,
    autoDeploy: boolOrUndefined(input["AutoDeploy"]) ?? false,
    clientCertificateId: stringOrUndefined(input["ClientCertificateId"]),
    createdDate: now,
    defaultRouteSettings: parseRouteSettings(input["DefaultRouteSettings"]),
    deploymentId: stringOrUndefined(input["DeploymentId"]),
    description: stringOrUndefined(input["Description"]),
    lastUpdatedDate: now,
    routeSettings,
    stageVariables: asStringRecord(input["StageVariables"]),
    tags: asStringRecord(input["Tags"]) ?? {},
  };
  ctx.store.set(stageKey(apiId, stageName), stage);
  const arn = stageArn(ctx, apiId, stageName);
  if (Object.keys(stage.tags).length > 0) {
    ctx.store.set(tagKey(arn), stage.tags);
  }
  return formatStage(stage);
};

const GetStage: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const stageName = requireString(input, "StageName");
  const stage = ctx.store.get<StoredStage>(stageKey(apiId, stageName));
  if (stage === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Stage identifier specified`,
      404,
    );
  return formatStage(stage);
};

const GetStages: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  getApi(apiId, ctx);
  const stages = listByPrefix<StoredStage>(ctx, `${stagePrefix}${apiId}/`);
  return { Items: stages.map(formatStage) };
};

const UpdateStage: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const stageName = requireString(input, "StageName");
  const stage = ctx.store.get<StoredStage>(stageKey(apiId, stageName));
  if (stage === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Stage identifier specified`,
      404,
    );

  const accessLogRaw = asRecord(input["AccessLogSettings"]);
  const accessLogSettings: StoredAccessLogSettings | undefined =
    "AccessLogSettings" in input
      ? accessLogRaw !== undefined
        ? {
            destinationArn: stringOrUndefined(accessLogRaw["DestinationArn"]),
            format: stringOrUndefined(accessLogRaw["Format"]),
          }
        : undefined
      : stage.accessLogSettings;

  const routeSettingsRaw = asRecord(input["RouteSettings"]);
  const routeSettings: Record<string, StoredRouteSettings> | undefined =
    "RouteSettings" in input
      ? routeSettingsRaw !== undefined
        ? Object.fromEntries(
            Object.entries(routeSettingsRaw).map(([k, v]) => [
              k,
              parseRouteSettings(v) ?? {
                dataTraceEnabled: undefined,
                detailedMetricsEnabled: undefined,
                loggingLevel: undefined,
                throttlingBurstLimit: undefined,
                throttlingRateLimit: undefined,
              },
            ]),
          )
        : undefined
      : stage.routeSettings;

  const now = new Date().toISOString();
  const updated: StoredStage = {
    ...stage,
    accessLogSettings,
    autoDeploy: boolOrUndefined(input["AutoDeploy"]) ?? stage.autoDeploy,
    clientCertificateId:
      "ClientCertificateId" in input
        ? stringOrUndefined(input["ClientCertificateId"])
        : stage.clientCertificateId,
    defaultRouteSettings:
      "DefaultRouteSettings" in input
        ? parseRouteSettings(input["DefaultRouteSettings"])
        : stage.defaultRouteSettings,
    deploymentId:
      "DeploymentId" in input
        ? stringOrUndefined(input["DeploymentId"])
        : stage.deploymentId,
    description:
      "Description" in input
        ? stringOrUndefined(input["Description"])
        : stage.description,
    lastUpdatedDate: now,
    routeSettings,
    stageVariables:
      "StageVariables" in input
        ? asStringRecord(input["StageVariables"])
        : stage.stageVariables,
  };
  ctx.store.set(stageKey(apiId, stageName), updated);
  return formatStage(updated);
};

const DeleteStage: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const stageName = requireString(input, "StageName");
  if (ctx.store.get<StoredStage>(stageKey(apiId, stageName)) === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Stage identifier specified`,
      404,
    );
  ctx.store.delete(stageKey(apiId, stageName));
  return {};
};

const DeleteAccessLogSettings: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const stageName = requireString(input, "StageName");
  const stage = ctx.store.get<StoredStage>(stageKey(apiId, stageName));
  if (stage === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Stage identifier specified`,
      404,
    );
  const updated: StoredStage = { ...stage, accessLogSettings: undefined };
  ctx.store.set(stageKey(apiId, stageName), updated);
  return {};
};

const CreateDeployment: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  getApi(apiId, ctx);
  const id = randomId();
  const now = new Date().toISOString();
  const deployment: StoredDeployment = {
    deploymentId: id,
    apiId,
    autoDeployed: false,
    createdDate: now,
    deploymentStatus: "DEPLOYED",
    deploymentStatusMessage: undefined,
    description: stringOrUndefined(input["Description"]),
  };
  ctx.store.set(deploymentKey(apiId, id), deployment);
  const stageName = stringOrUndefined(input["StageName"]);
  if (stageName !== undefined) {
    const stage = ctx.store.get<StoredStage>(stageKey(apiId, stageName));
    if (stage !== undefined) {
      const now2 = new Date().toISOString();
      ctx.store.set(stageKey(apiId, stageName), {
        ...stage,
        deploymentId: id,
        lastUpdatedDate: now2,
      });
    }
  }
  return formatDeployment(deployment);
};

const GetDeployment: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const deploymentId = requireString(input, "DeploymentId");
  const deployment = ctx.store.get<StoredDeployment>(
    deploymentKey(apiId, deploymentId),
  );
  if (deployment === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Deployment identifier specified`,
      404,
    );
  return formatDeployment(deployment);
};

const GetDeployments: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  getApi(apiId, ctx);
  const deployments = listByPrefix<StoredDeployment>(
    ctx,
    `${deploymentPrefix}${apiId}/`,
  );
  return { Items: deployments.map(formatDeployment) };
};

const UpdateDeployment: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const deploymentId = requireString(input, "DeploymentId");
  const deployment = ctx.store.get<StoredDeployment>(
    deploymentKey(apiId, deploymentId),
  );
  if (deployment === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Deployment identifier specified`,
      404,
    );
  const updated: StoredDeployment = {
    ...deployment,
    description:
      "Description" in input
        ? stringOrUndefined(input["Description"])
        : deployment.description,
  };
  ctx.store.set(deploymentKey(apiId, deploymentId), updated);
  return formatDeployment(updated);
};

const DeleteDeployment: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const deploymentId = requireString(input, "DeploymentId");
  if (
    ctx.store.get<StoredDeployment>(deploymentKey(apiId, deploymentId)) ===
    undefined
  )
    throw awsError(
      "NotFoundException",
      `Invalid Deployment identifier specified`,
      404,
    );
  ctx.store.delete(deploymentKey(apiId, deploymentId));
  return {};
};

const CreateAuthorizer: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  getApi(apiId, ctx);
  const authorizerType = requireString(input, "AuthorizerType");
  const name = requireString(input, "Name");
  const id = randomId();
  const jwtConfigRaw = asRecord(input["JwtConfiguration"]);
  const authorizer: StoredAuthorizer = {
    authorizerId: id,
    apiId,
    authorizerCredentialsArn: stringOrUndefined(
      input["AuthorizerCredentialsArn"],
    ),
    authorizerPayloadFormatVersion: stringOrUndefined(
      input["AuthorizerPayloadFormatVersion"],
    ),
    authorizerResultTtlInSeconds: numberOrUndefined(
      input["AuthorizerResultTtlInSeconds"],
    ),
    authorizerType,
    authorizerUri: stringOrUndefined(input["AuthorizerUri"]),
    enableSimpleResponses: boolOrUndefined(input["EnableSimpleResponses"]),
    identitySource: asStringArray(input["IdentitySource"]),
    identityValidationExpression: stringOrUndefined(
      input["IdentityValidationExpression"],
    ),
    jwtConfiguration:
      jwtConfigRaw !== undefined
        ? {
            audience: asStringArray(jwtConfigRaw["Audience"]),
            issuer: stringOrUndefined(jwtConfigRaw["Issuer"]),
          }
        : undefined,
    name,
  };
  ctx.store.set(authorizerKey(apiId, id), authorizer);
  return formatAuthorizer(authorizer);
};

const GetAuthorizer: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const authorizerId = requireString(input, "AuthorizerId");
  const authorizer = ctx.store.get<StoredAuthorizer>(
    authorizerKey(apiId, authorizerId),
  );
  if (authorizer === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Authorizer identifier specified`,
      404,
    );
  return formatAuthorizer(authorizer);
};

const GetAuthorizers: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  getApi(apiId, ctx);
  const authorizers = listByPrefix<StoredAuthorizer>(
    ctx,
    `${authorizerPrefix}${apiId}/`,
  );
  return { Items: authorizers.map(formatAuthorizer) };
};

const UpdateAuthorizer: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const authorizerId = requireString(input, "AuthorizerId");
  const authorizer = ctx.store.get<StoredAuthorizer>(
    authorizerKey(apiId, authorizerId),
  );
  if (authorizer === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Authorizer identifier specified`,
      404,
    );
  const jwtConfigRaw = asRecord(input["JwtConfiguration"]);
  const updated: StoredAuthorizer = {
    ...authorizer,
    authorizerCredentialsArn:
      "AuthorizerCredentialsArn" in input
        ? stringOrUndefined(input["AuthorizerCredentialsArn"])
        : authorizer.authorizerCredentialsArn,
    authorizerPayloadFormatVersion:
      "AuthorizerPayloadFormatVersion" in input
        ? stringOrUndefined(input["AuthorizerPayloadFormatVersion"])
        : authorizer.authorizerPayloadFormatVersion,
    authorizerResultTtlInSeconds:
      "AuthorizerResultTtlInSeconds" in input
        ? numberOrUndefined(input["AuthorizerResultTtlInSeconds"])
        : authorizer.authorizerResultTtlInSeconds,
    authorizerType:
      stringOrUndefined(input["AuthorizerType"]) ?? authorizer.authorizerType,
    authorizerUri:
      "AuthorizerUri" in input
        ? stringOrUndefined(input["AuthorizerUri"])
        : authorizer.authorizerUri,
    enableSimpleResponses:
      "EnableSimpleResponses" in input
        ? boolOrUndefined(input["EnableSimpleResponses"])
        : authorizer.enableSimpleResponses,
    identitySource:
      "IdentitySource" in input
        ? asStringArray(input["IdentitySource"])
        : authorizer.identitySource,
    identityValidationExpression:
      "IdentityValidationExpression" in input
        ? stringOrUndefined(input["IdentityValidationExpression"])
        : authorizer.identityValidationExpression,
    jwtConfiguration:
      "JwtConfiguration" in input
        ? jwtConfigRaw !== undefined
          ? {
              audience: asStringArray(jwtConfigRaw["Audience"]),
              issuer: stringOrUndefined(jwtConfigRaw["Issuer"]),
            }
          : undefined
        : authorizer.jwtConfiguration,
    name: stringOrUndefined(input["Name"]) ?? authorizer.name,
  };
  ctx.store.set(authorizerKey(apiId, authorizerId), updated);
  return formatAuthorizer(updated);
};

const DeleteAuthorizer: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const authorizerId = requireString(input, "AuthorizerId");
  if (
    ctx.store.get<StoredAuthorizer>(authorizerKey(apiId, authorizerId)) ===
    undefined
  )
    throw awsError(
      "NotFoundException",
      `Invalid Authorizer identifier specified`,
      404,
    );
  ctx.store.delete(authorizerKey(apiId, authorizerId));
  return {};
};

const ResetAuthorizersCache: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const stageName = requireString(input, "StageName");
  if (ctx.store.get<StoredStage>(stageKey(apiId, stageName)) === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Stage identifier specified`,
      404,
    );
  return {};
};

const GetTags: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  return { Tags: tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const newTags = asStringRecord(input["Tags"]) ?? {};
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  ctx.store.set(tagKey(resourceArn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tagKeys = asStringArray(input["TagKeys"]) ?? [];
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  const updated = { ...existing };
  for (const k of tagKeys) delete updated[k];
  ctx.store.set(tagKey(resourceArn), updated);
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const apigatewayv2 = {
  name: "apigateway",
  protocol: "rest-json",
  matches: (req: ParsedRequest): boolean => req.path.startsWith("/v2/"),
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "v2") return undefined;

    if (parts[1] === "apis") {
      if (parts.length === 2) {
        if (req.method === "GET") return "GetApis";
        if (req.method === "POST") return "CreateApi";
        return undefined;
      }
      const apiId = parts[2];
      if (apiId === undefined) return undefined;

      if (parts.length === 3) {
        if (req.method === "GET") return "GetApi";
        if (req.method === "PATCH") return "UpdateApi";
        if (req.method === "DELETE") return "DeleteApi";
        return undefined;
      }

      const resource = parts[3];

      if (resource === "routes") {
        if (parts.length === 4) {
          if (req.method === "GET") return "GetRoutes";
          if (req.method === "POST") return "CreateRoute";
          return undefined;
        }
        const routeId = parts[4];
        if (routeId === undefined) return undefined;

        if (parts.length === 5) {
          if (req.method === "GET") return "GetRoute";
          if (req.method === "PATCH") return "UpdateRoute";
          if (req.method === "DELETE") return "DeleteRoute";
          return undefined;
        }
        if (parts[5] === "requestparameters" && parts.length === 7) {
          if (req.method === "DELETE") return "DeleteRouteRequestParameter";
          return undefined;
        }
        if (parts[5] === "routesettings" && parts.length === 7) {
          if (req.method === "DELETE") return "DeleteRouteSettings";
          return undefined;
        }
        return undefined;
      }

      if (resource === "integrations") {
        if (parts.length === 4) {
          if (req.method === "GET") return "GetIntegrations";
          if (req.method === "POST") return "CreateIntegration";
          return undefined;
        }
        if (parts.length === 5) {
          if (req.method === "GET") return "GetIntegration";
          if (req.method === "PATCH") return "UpdateIntegration";
          if (req.method === "DELETE") return "DeleteIntegration";
          return undefined;
        }
        return undefined;
      }

      if (resource === "stages") {
        if (parts.length === 4) {
          if (req.method === "GET") return "GetStages";
          if (req.method === "POST") return "CreateStage";
          return undefined;
        }
        const stageName = parts[4];
        if (stageName === undefined) return undefined;

        if (parts.length === 5) {
          if (req.method === "GET") return "GetStage";
          if (req.method === "PATCH") return "UpdateStage";
          if (req.method === "DELETE") return "DeleteStage";
          return undefined;
        }
        if (parts[5] === "accesslogsettings" && parts.length === 6) {
          if (req.method === "DELETE") return "DeleteAccessLogSettings";
          return undefined;
        }
        if (
          parts[5] === "cache" &&
          parts.length === 7 &&
          parts[6] === "authorizers"
        ) {
          if (req.method === "DELETE") return "ResetAuthorizersCache";
          return undefined;
        }
        return undefined;
      }

      if (resource === "deployments") {
        if (parts.length === 4) {
          if (req.method === "GET") return "GetDeployments";
          if (req.method === "POST") return "CreateDeployment";
          return undefined;
        }
        if (parts.length === 5) {
          if (req.method === "GET") return "GetDeployment";
          if (req.method === "PATCH") return "UpdateDeployment";
          if (req.method === "DELETE") return "DeleteDeployment";
          return undefined;
        }
        return undefined;
      }

      if (resource === "authorizers") {
        if (parts.length === 4) {
          if (req.method === "GET") return "GetAuthorizers";
          if (req.method === "POST") return "CreateAuthorizer";
          return undefined;
        }
        if (parts.length === 5) {
          if (req.method === "GET") return "GetAuthorizer";
          if (req.method === "PATCH") return "UpdateAuthorizer";
          if (req.method === "DELETE") return "DeleteAuthorizer";
          return undefined;
        }
        return undefined;
      }

      return undefined;
    }

    if (parts[1] === "tags") {
      const arn = parts.slice(2).join("/");
      if (arn.length > 0) {
        if (req.method === "GET") return "GetTags";
        if (req.method === "POST") return "TagResource";
        if (req.method === "DELETE") return "UntagResource";
      }
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateApi,
    GetApi,
    GetApis,
    UpdateApi,
    DeleteApi,
    CreateRoute,
    GetRoute,
    GetRoutes,
    UpdateRoute,
    DeleteRoute,
    DeleteRouteRequestParameter,
    DeleteRouteSettings,
    CreateIntegration,
    GetIntegration,
    GetIntegrations,
    UpdateIntegration,
    DeleteIntegration,
    CreateStage,
    GetStage,
    GetStages,
    UpdateStage,
    DeleteStage,
    DeleteAccessLogSettings,
    CreateDeployment,
    GetDeployment,
    GetDeployments,
    UpdateDeployment,
    DeleteDeployment,
    CreateAuthorizer,
    GetAuthorizer,
    GetAuthorizers,
    UpdateAuthorizer,
    DeleteAuthorizer,
    ResetAuthorizersCache,
    GetTags,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default apigatewayv2;
