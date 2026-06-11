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

type StoredDomainName = {
  domainName: string;
  domainNameConfigurations: unknown[] | undefined;
  tags: Record<string, string>;
  routingMode: string | undefined;
};

type StoredApiMapping = {
  apiMappingId: string;
  domainName: string;
  apiId: string;
  apiMappingKey: string | undefined;
  stage: string;
};

type StoredVpcLink = {
  vpcLinkId: string;
  name: string;
  securityGroupIds: string[] | undefined;
  subnetIds: string[];
  tags: Record<string, string>;
  createdDate: string;
  vpcLinkStatus: string;
};

type StoredModel = {
  modelId: string;
  apiId: string;
  contentType: string | undefined;
  description: string | undefined;
  name: string;
  schema: string | undefined;
};

type StoredIntegrationResponse = {
  integrationResponseId: string;
  apiId: string;
  integrationId: string;
  contentHandlingStrategy: string | undefined;
  integrationResponseKey: string;
  responseParameters: Record<string, string> | undefined;
  responseTemplates: Record<string, string> | undefined;
  templateSelectionExpression: string | undefined;
};

type StoredRouteResponse = {
  routeResponseId: string;
  apiId: string;
  routeId: string;
  modelSelectionExpression: string | undefined;
  responseModels: Record<string, string> | undefined;
  responseParameters: Record<string, unknown> | undefined;
  routeResponseKey: string;
};

type StoredRoutingRule = {
  routingRuleId: string;
  domainName: string;
  actions: unknown[] | undefined;
  conditions: unknown[] | undefined;
  priority: number | undefined;
};

type StoredPortal = {
  portalId: string;
  authorization: unknown | undefined;
  endpointConfiguration: unknown | undefined;
  includedPortalProductArns: string[] | undefined;
  logoUri: string | undefined;
  portalContent: unknown | undefined;
  rumAppMonitorName: string | undefined;
  tags: Record<string, string>;
  status: string;
  lastModified: string;
  lastPublished: string | undefined;
  lastPublishedDescription: string | undefined;
};

type StoredPortalProduct = {
  portalProductId: string;
  description: string | undefined;
  displayName: string;
  tags: Record<string, string>;
  lastModified: string;
  displayOrder: unknown | undefined;
};

type StoredProductPage = {
  productPageId: string;
  portalProductId: string;
  displayContent: unknown | undefined;
  lastModified: string;
};

type StoredProductRestEndpointPage = {
  productRestEndpointPageId: string;
  portalProductId: string;
  displayContent: unknown | undefined;
  restEndpointIdentifier: unknown | undefined;
  tryItState: string | undefined;
  lastModified: string;
};

const apiPrefix = "v2:api:" as const;
const routePrefix = "v2:route:" as const;
const integrationPrefix = "v2:integration:" as const;
const stagePrefix = "v2:stage:" as const;
const deploymentPrefix = "v2:deployment:" as const;
const authorizerPrefix = "v2:authorizer:" as const;
const tagPrefix = "v2:tag:" as const;
const domainNamePrefix = "v2:domainname:" as const;
const apiMappingPrefix = "v2:apimapping:" as const;
const vpcLinkPrefix = "v2:vpclink:" as const;
const modelPrefix = "v2:model:" as const;
const integrationResponsePrefix = "v2:integrationresponse:" as const;
const routeResponsePrefix = "v2:routeresponse:" as const;
const routingRulePrefix = "v2:routingrule:" as const;
const portalPrefix = "v2:portal:" as const;
const portalProductPrefix = "v2:portalproduct:" as const;
const productPagePrefix = "v2:productpage:" as const;
const productRestEndpointPagePrefix = "v2:productrestendpointpage:" as const;
const portalSharingPolicyPrefix = "v2:portalsharingpolicy:" as const;

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
const domainNameKey = (name: string): string => `${domainNamePrefix}${name}`;
const apiMappingKey = (domainName: string, id: string): string =>
  `${apiMappingPrefix}${domainName}/${id}`;
const vpcLinkKey = (id: string): string => `${vpcLinkPrefix}${id}`;
const modelKey = (apiId: string, modelId: string): string =>
  `${modelPrefix}${apiId}/${modelId}`;
const integrationResponseKey = (
  apiId: string,
  integrationId: string,
  id: string,
): string => `${integrationResponsePrefix}${apiId}/${integrationId}/${id}`;
const routeResponseKey = (
  apiId: string,
  routeId: string,
  id: string,
): string => `${routeResponsePrefix}${apiId}/${routeId}/${id}`;
const routingRuleKey = (domainName: string, id: string): string =>
  `${routingRulePrefix}${domainName}/${id}`;
const portalKey = (id: string): string => `${portalPrefix}${id}`;
const portalProductKey = (id: string): string => `${portalProductPrefix}${id}`;
const productPageKey = (portalProductId: string, id: string): string =>
  `${productPagePrefix}${portalProductId}/${id}`;
const productRestEndpointPageKey = (
  portalProductId: string,
  id: string,
): string => `${productRestEndpointPagePrefix}${portalProductId}/${id}`;
const portalSharingPolicyKey = (portalProductId: string): string =>
  `${portalSharingPolicyPrefix}${portalProductId}`;

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

const getDomainName = (
  name: string,
  ctx: ServiceContext,
): StoredDomainName => {
  const dn = ctx.store.get<StoredDomainName>(domainNameKey(name));
  if (dn === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid domain name identifier specified`,
      404,
    );
  return dn;
};

const formatDomainName = (dn: StoredDomainName, ctx: ServiceContext) => ({
  ApiMappingSelectionExpression: "$request.basepath",
  DomainName: dn.domainName,
  DomainNameArn: `arn:aws:apigateway:${ctx.region}::/domainnames/${dn.domainName}`,
  DomainNameConfigurations: dn.domainNameConfigurations,
  RoutingMode: dn.routingMode,
  Tags: dn.tags,
});

const CreateDomainName: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DomainName");
  if (ctx.store.get<StoredDomainName>(domainNameKey(name)) !== undefined)
    throw awsError(
      "ConflictException",
      `Domain name ${name} already exists.`,
      409,
    );
  const configs = Array.isArray(input["DomainNameConfigurations"])
    ? (input["DomainNameConfigurations"] as unknown[])
    : undefined;
  const dn: StoredDomainName = {
    domainName: name,
    domainNameConfigurations: configs,
    tags: asStringRecord(input["Tags"]) ?? {},
    routingMode: stringOrUndefined(input["RoutingMode"]),
  };
  ctx.store.set(domainNameKey(name), dn);
  return formatDomainName(dn, ctx);
};

const GetDomainName: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DomainName");
  return formatDomainName(getDomainName(name, ctx), ctx);
};

const GetDomainNames: OperationHandler = (_input, ctx) => {
  const items = listByPrefix<StoredDomainName>(ctx, domainNamePrefix);
  return { Items: items.map((dn) => formatDomainName(dn, ctx)) };
};

const UpdateDomainName: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DomainName");
  const dn = getDomainName(name, ctx);
  const configs = Array.isArray(input["DomainNameConfigurations"])
    ? (input["DomainNameConfigurations"] as unknown[])
    : dn.domainNameConfigurations;
  const updated: StoredDomainName = {
    ...dn,
    domainNameConfigurations:
      "DomainNameConfigurations" in input ? configs : dn.domainNameConfigurations,
    routingMode:
      "RoutingMode" in input
        ? stringOrUndefined(input["RoutingMode"])
        : dn.routingMode,
  };
  ctx.store.set(domainNameKey(name), updated);
  return formatDomainName(updated, ctx);
};

const DeleteDomainName: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DomainName");
  getDomainName(name, ctx);
  ctx.store.delete(domainNameKey(name));
  ctx.store
    .list()
    .filter(
      (entry) =>
        entry.key.startsWith(`${apiMappingPrefix}${name}/`) ||
        entry.key.startsWith(`${routingRulePrefix}${name}/`),
    )
    .forEach((entry) => ctx.store.delete(entry.key));
  return {};
};

const formatApiMapping = (m: StoredApiMapping) => ({
  ApiId: m.apiId,
  ApiMappingId: m.apiMappingId,
  ApiMappingKey: m.apiMappingKey,
  Stage: m.stage,
});

const CreateApiMapping: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "DomainName");
  getDomainName(domainName, ctx);
  const apiId = requireString(input, "ApiId");
  getApi(apiId, ctx);
  const stage = requireString(input, "Stage");
  const id = randomId();
  const mapping: StoredApiMapping = {
    apiMappingId: id,
    domainName,
    apiId,
    apiMappingKey: stringOrUndefined(input["ApiMappingKey"]),
    stage,
  };
  ctx.store.set(apiMappingKey(domainName, id), mapping);
  return formatApiMapping(mapping);
};

const GetApiMapping: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "DomainName");
  const id = requireString(input, "ApiMappingId");
  const mapping = ctx.store.get<StoredApiMapping>(apiMappingKey(domainName, id));
  if (mapping === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid API mapping identifier specified`,
      404,
    );
  return formatApiMapping(mapping);
};

const GetApiMappings: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "DomainName");
  getDomainName(domainName, ctx);
  const items = listByPrefix<StoredApiMapping>(
    ctx,
    `${apiMappingPrefix}${domainName}/`,
  );
  return { Items: items.map(formatApiMapping) };
};

const UpdateApiMapping: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "DomainName");
  const id = requireString(input, "ApiMappingId");
  const mapping = ctx.store.get<StoredApiMapping>(apiMappingKey(domainName, id));
  if (mapping === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid API mapping identifier specified`,
      404,
    );
  const updated: StoredApiMapping = {
    ...mapping,
    apiId: stringOrUndefined(input["ApiId"]) ?? mapping.apiId,
    apiMappingKey:
      "ApiMappingKey" in input
        ? stringOrUndefined(input["ApiMappingKey"])
        : mapping.apiMappingKey,
    stage: stringOrUndefined(input["Stage"]) ?? mapping.stage,
  };
  ctx.store.set(apiMappingKey(domainName, id), updated);
  return formatApiMapping(updated);
};

const DeleteApiMapping: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "DomainName");
  const id = requireString(input, "ApiMappingId");
  if (
    ctx.store.get<StoredApiMapping>(apiMappingKey(domainName, id)) === undefined
  )
    throw awsError(
      "NotFoundException",
      `Invalid API mapping identifier specified`,
      404,
    );
  ctx.store.delete(apiMappingKey(domainName, id));
  return {};
};

const formatVpcLink = (v: StoredVpcLink) => ({
  CreatedDate: v.createdDate,
  Name: v.name,
  SecurityGroupIds: v.securityGroupIds,
  SubnetIds: v.subnetIds,
  Tags: v.tags,
  VpcLinkId: v.vpcLinkId,
  VpcLinkStatus: v.vpcLinkStatus,
  VpcLinkVersion: "V2",
});

const CreateVpcLink: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const subnetIds = asStringArray(input["SubnetIds"]);
  if (subnetIds === undefined || subnetIds.length === 0)
    throw awsError("BadRequestException", "SubnetIds is required.", 400);
  const id = randomId();
  const now = new Date().toISOString();
  const vpc: StoredVpcLink = {
    vpcLinkId: id,
    name,
    securityGroupIds: asStringArray(input["SecurityGroupIds"]),
    subnetIds,
    tags: asStringRecord(input["Tags"]) ?? {},
    createdDate: now,
    vpcLinkStatus: "AVAILABLE",
  };
  ctx.store.set(vpcLinkKey(id), vpc);
  return formatVpcLink(vpc);
};

const GetVpcLink: OperationHandler = (input, ctx) => {
  const id = requireString(input, "VpcLinkId");
  const vpc = ctx.store.get<StoredVpcLink>(vpcLinkKey(id));
  if (vpc === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid VPC link identifier specified`,
      404,
    );
  return formatVpcLink(vpc);
};

const GetVpcLinks: OperationHandler = (_input, ctx) => {
  const items = listByPrefix<StoredVpcLink>(ctx, vpcLinkPrefix);
  return { Items: items.map(formatVpcLink) };
};

const UpdateVpcLink: OperationHandler = (input, ctx) => {
  const id = requireString(input, "VpcLinkId");
  const vpc = ctx.store.get<StoredVpcLink>(vpcLinkKey(id));
  if (vpc === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid VPC link identifier specified`,
      404,
    );
  const updated: StoredVpcLink = {
    ...vpc,
    name: stringOrUndefined(input["Name"]) ?? vpc.name,
  };
  ctx.store.set(vpcLinkKey(id), updated);
  return formatVpcLink(updated);
};

const DeleteVpcLink: OperationHandler = (input, ctx) => {
  const id = requireString(input, "VpcLinkId");
  if (ctx.store.get<StoredVpcLink>(vpcLinkKey(id)) === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid VPC link identifier specified`,
      404,
    );
  ctx.store.delete(vpcLinkKey(id));
  return {};
};

const formatModel = (m: StoredModel) => ({
  ContentType: m.contentType,
  Description: m.description,
  ModelId: m.modelId,
  Name: m.name,
  Schema: m.schema,
});

const getModel = (apiId: string, modelId: string, ctx: ServiceContext): StoredModel => {
  const m = ctx.store.get<StoredModel>(modelKey(apiId, modelId));
  if (m === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid model identifier specified`,
      404,
    );
  return m;
};

const CreateModel: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  getApi(apiId, ctx);
  const name = requireString(input, "Name");
  const schema = requireString(input, "Schema");
  const id = randomId();
  const m: StoredModel = {
    modelId: id,
    apiId,
    contentType: stringOrUndefined(input["ContentType"]),
    description: stringOrUndefined(input["Description"]),
    name,
    schema,
  };
  ctx.store.set(modelKey(apiId, id), m);
  return formatModel(m);
};

const GetModel: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const modelId = requireString(input, "ModelId");
  return formatModel(getModel(apiId, modelId, ctx));
};

const GetModels: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  getApi(apiId, ctx);
  const items = listByPrefix<StoredModel>(ctx, `${modelPrefix}${apiId}/`);
  return { Items: items.map(formatModel) };
};

const GetModelTemplate: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const modelId = requireString(input, "ModelId");
  const m = getModel(apiId, modelId, ctx);
  return { Value: m.schema ?? "{}" };
};

const UpdateModel: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const modelId = requireString(input, "ModelId");
  const m = getModel(apiId, modelId, ctx);
  const updated: StoredModel = {
    ...m,
    contentType:
      "ContentType" in input
        ? stringOrUndefined(input["ContentType"])
        : m.contentType,
    description:
      "Description" in input
        ? stringOrUndefined(input["Description"])
        : m.description,
    name: stringOrUndefined(input["Name"]) ?? m.name,
    schema: "Schema" in input ? stringOrUndefined(input["Schema"]) : m.schema,
  };
  ctx.store.set(modelKey(apiId, modelId), updated);
  return formatModel(updated);
};

const DeleteModel: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const modelId = requireString(input, "ModelId");
  getModel(apiId, modelId, ctx);
  ctx.store.delete(modelKey(apiId, modelId));
  return {};
};

const formatIntegrationResponse = (r: StoredIntegrationResponse) => ({
  ContentHandlingStrategy: r.contentHandlingStrategy,
  IntegrationResponseId: r.integrationResponseId,
  IntegrationResponseKey: r.integrationResponseKey,
  ResponseParameters: r.responseParameters,
  ResponseTemplates: r.responseTemplates,
  TemplateSelectionExpression: r.templateSelectionExpression,
});

const getIntegrationResponse = (
  apiId: string,
  integrationId: string,
  id: string,
  ctx: ServiceContext,
): StoredIntegrationResponse => {
  const r = ctx.store.get<StoredIntegrationResponse>(
    integrationResponseKey(apiId, integrationId, id),
  );
  if (r === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid integration response identifier specified`,
      404,
    );
  return r;
};

const CreateIntegrationResponse: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const integrationId = requireString(input, "IntegrationId");
  if (
    ctx.store.get<StoredIntegration>(
      integrationKey(apiId, integrationId),
    ) === undefined
  )
    throw awsError(
      "NotFoundException",
      `Invalid Integration identifier specified`,
      404,
    );
  const integrationResponseKeyVal = requireString(
    input,
    "IntegrationResponseKey",
  );
  const id = randomId();
  const r: StoredIntegrationResponse = {
    integrationResponseId: id,
    apiId,
    integrationId,
    contentHandlingStrategy: stringOrUndefined(
      input["ContentHandlingStrategy"],
    ),
    integrationResponseKey: integrationResponseKeyVal,
    responseParameters: asStringRecord(input["ResponseParameters"]),
    responseTemplates: asStringRecord(input["ResponseTemplates"]),
    templateSelectionExpression: stringOrUndefined(
      input["TemplateSelectionExpression"],
    ),
  };
  ctx.store.set(integrationResponseKey(apiId, integrationId, id), r);
  return formatIntegrationResponse(r);
};

const GetIntegrationResponse: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const integrationId = requireString(input, "IntegrationId");
  const id = requireString(input, "IntegrationResponseId");
  return formatIntegrationResponse(
    getIntegrationResponse(apiId, integrationId, id, ctx),
  );
};

const GetIntegrationResponses: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const integrationId = requireString(input, "IntegrationId");
  if (
    ctx.store.get<StoredIntegration>(
      integrationKey(apiId, integrationId),
    ) === undefined
  )
    throw awsError(
      "NotFoundException",
      `Invalid Integration identifier specified`,
      404,
    );
  const items = listByPrefix<StoredIntegrationResponse>(
    ctx,
    `${integrationResponsePrefix}${apiId}/${integrationId}/`,
  );
  return { Items: items.map(formatIntegrationResponse) };
};

const UpdateIntegrationResponse: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const integrationId = requireString(input, "IntegrationId");
  const id = requireString(input, "IntegrationResponseId");
  const r = getIntegrationResponse(apiId, integrationId, id, ctx);
  const updated: StoredIntegrationResponse = {
    ...r,
    contentHandlingStrategy:
      "ContentHandlingStrategy" in input
        ? stringOrUndefined(input["ContentHandlingStrategy"])
        : r.contentHandlingStrategy,
    integrationResponseKey:
      stringOrUndefined(input["IntegrationResponseKey"]) ??
      r.integrationResponseKey,
    responseParameters:
      "ResponseParameters" in input
        ? asStringRecord(input["ResponseParameters"])
        : r.responseParameters,
    responseTemplates:
      "ResponseTemplates" in input
        ? asStringRecord(input["ResponseTemplates"])
        : r.responseTemplates,
    templateSelectionExpression:
      "TemplateSelectionExpression" in input
        ? stringOrUndefined(input["TemplateSelectionExpression"])
        : r.templateSelectionExpression,
  };
  ctx.store.set(integrationResponseKey(apiId, integrationId, id), updated);
  return formatIntegrationResponse(updated);
};

const DeleteIntegrationResponse: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const integrationId = requireString(input, "IntegrationId");
  const id = requireString(input, "IntegrationResponseId");
  getIntegrationResponse(apiId, integrationId, id, ctx);
  ctx.store.delete(integrationResponseKey(apiId, integrationId, id));
  return {};
};

const formatRouteResponse = (r: StoredRouteResponse) => ({
  ModelSelectionExpression: r.modelSelectionExpression,
  ResponseModels: r.responseModels,
  ResponseParameters: r.responseParameters,
  RouteResponseId: r.routeResponseId,
  RouteResponseKey: r.routeResponseKey,
});

const getRouteResponse = (
  apiId: string,
  routeId: string,
  id: string,
  ctx: ServiceContext,
): StoredRouteResponse => {
  const r = ctx.store.get<StoredRouteResponse>(
    routeResponseKey(apiId, routeId, id),
  );
  if (r === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid route response identifier specified`,
      404,
    );
  return r;
};

const CreateRouteResponse: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const routeId = requireString(input, "RouteId");
  if (
    ctx.store.get<StoredRoute>(routeKey(apiId, routeId)) === undefined
  )
    throw awsError(
      "NotFoundException",
      `Invalid Route identifier specified`,
      404,
    );
  const routeResponseKeyVal = requireString(input, "RouteResponseKey");
  const id = randomId();
  const r: StoredRouteResponse = {
    routeResponseId: id,
    apiId,
    routeId,
    modelSelectionExpression: stringOrUndefined(
      input["ModelSelectionExpression"],
    ),
    responseModels: asStringRecord(input["ResponseModels"]),
    responseParameters: asRecord(input["ResponseParameters"]),
    routeResponseKey: routeResponseKeyVal,
  };
  ctx.store.set(routeResponseKey(apiId, routeId, id), r);
  return formatRouteResponse(r);
};

const GetRouteResponse: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const routeId = requireString(input, "RouteId");
  const id = requireString(input, "RouteResponseId");
  return formatRouteResponse(getRouteResponse(apiId, routeId, id, ctx));
};

const GetRouteResponses: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const routeId = requireString(input, "RouteId");
  if (ctx.store.get<StoredRoute>(routeKey(apiId, routeId)) === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid Route identifier specified`,
      404,
    );
  const items = listByPrefix<StoredRouteResponse>(
    ctx,
    `${routeResponsePrefix}${apiId}/${routeId}/`,
  );
  return { Items: items.map(formatRouteResponse) };
};

const UpdateRouteResponse: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const routeId = requireString(input, "RouteId");
  const id = requireString(input, "RouteResponseId");
  const r = getRouteResponse(apiId, routeId, id, ctx);
  const updated: StoredRouteResponse = {
    ...r,
    modelSelectionExpression:
      "ModelSelectionExpression" in input
        ? stringOrUndefined(input["ModelSelectionExpression"])
        : r.modelSelectionExpression,
    responseModels:
      "ResponseModels" in input
        ? asStringRecord(input["ResponseModels"])
        : r.responseModels,
    responseParameters:
      "ResponseParameters" in input
        ? asRecord(input["ResponseParameters"])
        : r.responseParameters,
    routeResponseKey:
      stringOrUndefined(input["RouteResponseKey"]) ?? r.routeResponseKey,
  };
  ctx.store.set(routeResponseKey(apiId, routeId, id), updated);
  return formatRouteResponse(updated);
};

const DeleteRouteResponse: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const routeId = requireString(input, "RouteId");
  const id = requireString(input, "RouteResponseId");
  getRouteResponse(apiId, routeId, id, ctx);
  ctx.store.delete(routeResponseKey(apiId, routeId, id));
  return {};
};

const formatRoutingRule = (
  r: StoredRoutingRule,
  ctx: ServiceContext,
) => ({
  Actions: r.actions,
  Conditions: r.conditions,
  Priority: r.priority,
  RoutingRuleArn: `arn:aws:apigateway:${ctx.region}::/domainnames/${r.domainName}/routingrules/${r.routingRuleId}`,
  RoutingRuleId: r.routingRuleId,
});

const getRoutingRule = (
  domainName: string,
  id: string,
  ctx: ServiceContext,
): StoredRoutingRule => {
  const r = ctx.store.get<StoredRoutingRule>(routingRuleKey(domainName, id));
  if (r === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid routing rule identifier specified`,
      404,
    );
  return r;
};

const CreateRoutingRule: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "DomainName");
  getDomainName(domainName, ctx);
  const id = randomId();
  const r: StoredRoutingRule = {
    routingRuleId: id,
    domainName,
    actions: Array.isArray(input["Actions"])
      ? (input["Actions"] as unknown[])
      : undefined,
    conditions: Array.isArray(input["Conditions"])
      ? (input["Conditions"] as unknown[])
      : undefined,
    priority: numberOrUndefined(input["Priority"]),
  };
  ctx.store.set(routingRuleKey(domainName, id), r);
  return formatRoutingRule(r, ctx);
};

const GetRoutingRule: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "DomainName");
  const id = requireString(input, "RoutingRuleId");
  return formatRoutingRule(getRoutingRule(domainName, id, ctx), ctx);
};

const ListRoutingRules: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "DomainName");
  getDomainName(domainName, ctx);
  const items = listByPrefix<StoredRoutingRule>(
    ctx,
    `${routingRulePrefix}${domainName}/`,
  );
  return { RoutingRules: items.map((r) => formatRoutingRule(r, ctx)) };
};

const PutRoutingRule: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "DomainName");
  const id = requireString(input, "RoutingRuleId");
  getDomainName(domainName, ctx);
  const r: StoredRoutingRule = {
    routingRuleId: id,
    domainName,
    actions: Array.isArray(input["Actions"])
      ? (input["Actions"] as unknown[])
      : undefined,
    conditions: Array.isArray(input["Conditions"])
      ? (input["Conditions"] as unknown[])
      : undefined,
    priority: numberOrUndefined(input["Priority"]),
  };
  ctx.store.set(routingRuleKey(domainName, id), r);
  return formatRoutingRule(r, ctx);
};

const DeleteRoutingRule: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "DomainName");
  const id = requireString(input, "RoutingRuleId");
  getRoutingRule(domainName, id, ctx);
  ctx.store.delete(routingRuleKey(domainName, id));
  return {};
};

const ImportApi: OperationHandler = (input, ctx) => {
  const bodyStr = requireString(input, "Body");
  let spec: Record<string, unknown>;
  try {
    spec = JSON.parse(bodyStr) as Record<string, unknown>;
  } catch {
    throw awsError("BadRequestException", "Invalid OpenAPI body", 400);
  }
  const id = randomId();
  const now = new Date().toISOString();
  const specInfo = asRecord(spec["info"]);
  const api: StoredApi = {
    apiId: id,
    apiKeySelectionExpression: "$request.header.x-api-key",
    corsConfiguration: undefined,
    createdDate: now,
    description: specInfo
      ? stringOrUndefined(specInfo["description"])
      : undefined,
    disableExecuteApiEndpoint: false,
    disableSchemaValidation: false,
    name: specInfo
      ? stringOrUndefined(specInfo["title"]) ?? "imported-api"
      : "imported-api",
    protocolType: "HTTP",
    routeSelectionExpression: "${request.method} ${request.path}",
    tags: {},
    version: specInfo ? stringOrUndefined(specInfo["version"]) : undefined,
  };
  ctx.store.set(apiKey(id), api);
  const paths = asRecord(spec["paths"]);
  if (paths !== undefined) {
    for (const [path, methodsRaw] of Object.entries(paths)) {
      const methods = asRecord(methodsRaw);
      if (methods === undefined) continue;
      for (const method of Object.keys(methods)) {
        const rId = randomId();
        const rKey = `${method.toUpperCase()} ${path}`;
        const route: StoredRoute = {
          routeId: rId,
          apiId: id,
          apiKeyRequired: false,
          authorizationScopes: undefined,
          authorizationType: "NONE",
          authorizerId: undefined,
          modelSelectionExpression: undefined,
          operationName: undefined,
          requestModels: undefined,
          requestParameters: undefined,
          routeKey: rKey,
          routeResponseSelectionExpression: undefined,
          target: undefined,
        };
        ctx.store.set(routeKey(id, rId), route);
      }
    }
  }
  return formatApi(api, ctx);
};

const ReimportApi: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const api = getApi(apiId, ctx);
  const bodyStr = requireString(input, "Body");
  let spec: Record<string, unknown>;
  try {
    spec = JSON.parse(bodyStr) as Record<string, unknown>;
  } catch {
    throw awsError("BadRequestException", "Invalid OpenAPI body", 400);
  }
  const specInfo = asRecord(spec["info"]);
  const updated: StoredApi = {
    ...api,
    name: specInfo
      ? stringOrUndefined(specInfo["title"]) ?? api.name
      : api.name,
    description: specInfo
      ? stringOrUndefined(specInfo["description"])
      : api.description,
    version: specInfo ? stringOrUndefined(specInfo["version"]) : api.version,
  };
  ctx.store.set(apiKey(apiId), updated);
  const paths = asRecord(spec["paths"]);
  if (paths !== undefined) {
    for (const [path, methodsRaw] of Object.entries(paths)) {
      const methods = asRecord(methodsRaw);
      if (methods === undefined) continue;
      for (const method of Object.keys(methods)) {
        const rId = randomId();
        const rKey = `${method.toUpperCase()} ${path}`;
        const route: StoredRoute = {
          routeId: rId,
          apiId,
          apiKeyRequired: false,
          authorizationScopes: undefined,
          authorizationType: "NONE",
          authorizerId: undefined,
          modelSelectionExpression: undefined,
          operationName: undefined,
          requestModels: undefined,
          requestParameters: undefined,
          routeKey: rKey,
          routeResponseSelectionExpression: undefined,
          target: undefined,
        };
        ctx.store.set(routeKey(apiId, rId), route);
      }
    }
  }
  return formatApi(updated, ctx);
};

const ExportApi: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const api = getApi(apiId, ctx);
  const routes = listByPrefix<StoredRoute>(ctx, `${routePrefix}${apiId}/`);
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of routes) {
    const parts = route.routeKey.split(" ");
    const method = (parts[0] ?? "get").toLowerCase();
    const path = parts[1] ?? "/";
    if (paths[path] === undefined) paths[path] = {};
    paths[path][method] = {
      operationId: route.operationName,
      responses: { "200": { description: "OK" } },
    };
  }
  const spec = {
    openapi: "3.0.1",
    info: {
      title: api.name,
      description: api.description,
      version: api.version ?? "1.0",
    },
    paths,
  };
  return { body: JSON.stringify(spec) };
};

const DeleteCorsConfiguration: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "ApiId");
  const api = getApi(apiId, ctx);
  ctx.store.set(apiKey(apiId), { ...api, corsConfiguration: undefined });
  return {};
};

const formatPortal = (p: StoredPortal, ctx: ServiceContext) => ({
  Authorization: p.authorization,
  EndpointConfiguration: p.endpointConfiguration,
  IncludedPortalProductArns: p.includedPortalProductArns,
  LastModified: p.lastModified,
  LastPublished: p.lastPublished,
  LastPublishedDescription: p.lastPublishedDescription,
  LogoUri: p.logoUri,
  PortalArn: `arn:aws:apigateway:${ctx.region}::/portals/${p.portalId}`,
  PortalContent: p.portalContent,
  PortalId: p.portalId,
  PublishStatus: p.status,
  RumAppMonitorName: p.rumAppMonitorName,
  Tags: p.tags,
});

const getPortal = (id: string, ctx: ServiceContext): StoredPortal => {
  const p = ctx.store.get<StoredPortal>(portalKey(id));
  if (p === undefined)
    throw awsError("NotFoundException", `Invalid portal identifier specified`, 404);
  return p;
};

const CreatePortal: OperationHandler = (input, ctx) => {
  const id = randomId();
  const now = new Date().toISOString();
  const p: StoredPortal = {
    portalId: id,
    authorization: asRecord(input["Authorization"]),
    endpointConfiguration: asRecord(input["EndpointConfiguration"]),
    includedPortalProductArns: asStringArray(input["IncludedPortalProductArns"]),
    logoUri: stringOrUndefined(input["LogoUri"]),
    portalContent: asRecord(input["PortalContent"]),
    rumAppMonitorName: stringOrUndefined(input["RumAppMonitorName"]),
    tags: asStringRecord(input["Tags"]) ?? {},
    status: "DISABLED",
    lastModified: now,
    lastPublished: undefined,
    lastPublishedDescription: undefined,
  };
  ctx.store.set(portalKey(id), p);
  return formatPortal(p, ctx);
};

const GetPortal: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PortalId");
  return formatPortal(getPortal(id, ctx), ctx);
};

const ListPortals: OperationHandler = (_input, ctx) => {
  const items = listByPrefix<StoredPortal>(ctx, portalPrefix);
  return { Items: items.map((p) => formatPortal(p, ctx)) };
};

const UpdatePortal: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PortalId");
  const p = getPortal(id, ctx);
  const now = new Date().toISOString();
  const updated: StoredPortal = {
    ...p,
    authorization:
      "Authorization" in input
        ? asRecord(input["Authorization"])
        : p.authorization,
    endpointConfiguration:
      "EndpointConfiguration" in input
        ? asRecord(input["EndpointConfiguration"])
        : p.endpointConfiguration,
    includedPortalProductArns:
      "IncludedPortalProductArns" in input
        ? asStringArray(input["IncludedPortalProductArns"])
        : p.includedPortalProductArns,
    logoUri:
      "LogoUri" in input ? stringOrUndefined(input["LogoUri"]) : p.logoUri,
    portalContent:
      "PortalContent" in input
        ? asRecord(input["PortalContent"])
        : p.portalContent,
    rumAppMonitorName:
      "RumAppMonitorName" in input
        ? stringOrUndefined(input["RumAppMonitorName"])
        : p.rumAppMonitorName,
    lastModified: now,
  };
  ctx.store.set(portalKey(id), updated);
  return formatPortal(updated, ctx);
};

const DeletePortal: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PortalId");
  getPortal(id, ctx);
  ctx.store.delete(portalKey(id));
  return {};
};

const DisablePortal: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PortalId");
  const p = getPortal(id, ctx);
  ctx.store.set(portalKey(id), { ...p, status: "DISABLED" });
  return {};
};

const PreviewPortal: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PortalId");
  getPortal(id, ctx);
  return {};
};

const PublishPortal: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PortalId");
  const p = getPortal(id, ctx);
  const now = new Date().toISOString();
  ctx.store.set(portalKey(id), {
    ...p,
    status: "PUBLISHED",
    lastPublished: now,
    lastPublishedDescription: stringOrUndefined(
      input["LastPublishedDescription"],
    ),
  });
  return {};
};

const formatPortalProduct = (pp: StoredPortalProduct, ctx: ServiceContext) => ({
  Description: pp.description,
  DisplayName: pp.displayName,
  DisplayOrder: pp.displayOrder,
  LastModified: pp.lastModified,
  PortalProductArn: `arn:aws:apigateway:${ctx.region}::/portalproducts/${pp.portalProductId}`,
  PortalProductId: pp.portalProductId,
  Tags: pp.tags,
});

const getPortalProduct = (
  id: string,
  ctx: ServiceContext,
): StoredPortalProduct => {
  const pp = ctx.store.get<StoredPortalProduct>(portalProductKey(id));
  if (pp === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid portal product identifier specified`,
      404,
    );
  return pp;
};

const CreatePortalProduct: OperationHandler = (input, ctx) => {
  const displayName = requireString(input, "DisplayName");
  const id = randomId();
  const now = new Date().toISOString();
  const pp: StoredPortalProduct = {
    portalProductId: id,
    description: stringOrUndefined(input["Description"]),
    displayName,
    tags: asStringRecord(input["Tags"]) ?? {},
    lastModified: now,
    displayOrder: undefined,
  };
  ctx.store.set(portalProductKey(id), pp);
  return formatPortalProduct(pp, ctx);
};

const GetPortalProduct: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PortalProductId");
  return formatPortalProduct(getPortalProduct(id, ctx), ctx);
};

const ListPortalProducts: OperationHandler = (_input, ctx) => {
  const items = listByPrefix<StoredPortalProduct>(ctx, portalProductPrefix);
  return { Items: items.map((pp) => formatPortalProduct(pp, ctx)) };
};

const UpdatePortalProduct: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PortalProductId");
  const pp = getPortalProduct(id, ctx);
  const now = new Date().toISOString();
  const updated: StoredPortalProduct = {
    ...pp,
    description:
      "Description" in input
        ? stringOrUndefined(input["Description"])
        : pp.description,
    displayName: stringOrUndefined(input["DisplayName"]) ?? pp.displayName,
    lastModified: now,
  };
  ctx.store.set(portalProductKey(id), updated);
  return formatPortalProduct(updated, ctx);
};

const DeletePortalProduct: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PortalProductId");
  getPortalProduct(id, ctx);
  ctx.store.delete(portalProductKey(id));
  ctx.store
    .list()
    .filter(
      (entry) =>
        entry.key.startsWith(`${productPagePrefix}${id}/`) ||
        entry.key.startsWith(`${productRestEndpointPagePrefix}${id}/`) ||
        entry.key === portalSharingPolicyKey(id),
    )
    .forEach((entry) => ctx.store.delete(entry.key));
  return {};
};

const formatProductPage = (pg: StoredProductPage, ctx: ServiceContext) => ({
  DisplayContent: pg.displayContent,
  LastModified: pg.lastModified,
  ProductPageArn: `arn:aws:apigateway:${ctx.region}::/portalproducts/${pg.portalProductId}/productpages/${pg.productPageId}`,
  ProductPageId: pg.productPageId,
});

const getProductPage = (
  portalProductId: string,
  id: string,
  ctx: ServiceContext,
): StoredProductPage => {
  const pg = ctx.store.get<StoredProductPage>(
    productPageKey(portalProductId, id),
  );
  if (pg === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid product page identifier specified`,
      404,
    );
  return pg;
};

const CreateProductPage: OperationHandler = (input, ctx) => {
  const portalProductId = requireString(input, "PortalProductId");
  getPortalProduct(portalProductId, ctx);
  const id = randomId();
  const now = new Date().toISOString();
  const pg: StoredProductPage = {
    productPageId: id,
    portalProductId,
    displayContent: asRecord(input["DisplayContent"]),
    lastModified: now,
  };
  ctx.store.set(productPageKey(portalProductId, id), pg);
  return formatProductPage(pg, ctx);
};

const GetProductPage: OperationHandler = (input, ctx) => {
  const portalProductId = requireString(input, "PortalProductId");
  const id = requireString(input, "ProductPageId");
  return formatProductPage(getProductPage(portalProductId, id, ctx), ctx);
};

const ListProductPages: OperationHandler = (input, ctx) => {
  const portalProductId = requireString(input, "PortalProductId");
  getPortalProduct(portalProductId, ctx);
  const items = listByPrefix<StoredProductPage>(
    ctx,
    `${productPagePrefix}${portalProductId}/`,
  );
  return { Items: items.map((pg) => formatProductPage(pg, ctx)) };
};

const UpdateProductPage: OperationHandler = (input, ctx) => {
  const portalProductId = requireString(input, "PortalProductId");
  const id = requireString(input, "ProductPageId");
  const pg = getProductPage(portalProductId, id, ctx);
  const now = new Date().toISOString();
  const updated: StoredProductPage = {
    ...pg,
    displayContent:
      "DisplayContent" in input
        ? asRecord(input["DisplayContent"])
        : pg.displayContent,
    lastModified: now,
  };
  ctx.store.set(productPageKey(portalProductId, id), updated);
  return formatProductPage(updated, ctx);
};

const DeleteProductPage: OperationHandler = (input, ctx) => {
  const portalProductId = requireString(input, "PortalProductId");
  const id = requireString(input, "ProductPageId");
  getProductPage(portalProductId, id, ctx);
  ctx.store.delete(productPageKey(portalProductId, id));
  return {};
};

const formatProductRestEndpointPage = (
  p: StoredProductRestEndpointPage,
  ctx: ServiceContext,
) => ({
  DisplayContent: p.displayContent,
  LastModified: p.lastModified,
  ProductRestEndpointPageArn: `arn:aws:apigateway:${ctx.region}::/portalproducts/${p.portalProductId}/productrestendpointpages/${p.productRestEndpointPageId}`,
  ProductRestEndpointPageId: p.productRestEndpointPageId,
  RestEndpointIdentifier: p.restEndpointIdentifier,
  TryItState: p.tryItState,
});

const getProductRestEndpointPage = (
  portalProductId: string,
  id: string,
  ctx: ServiceContext,
): StoredProductRestEndpointPage => {
  const p = ctx.store.get<StoredProductRestEndpointPage>(
    productRestEndpointPageKey(portalProductId, id),
  );
  if (p === undefined)
    throw awsError(
      "NotFoundException",
      `Invalid product REST endpoint page identifier specified`,
      404,
    );
  return p;
};

const CreateProductRestEndpointPage: OperationHandler = (input, ctx) => {
  const portalProductId = requireString(input, "PortalProductId");
  getPortalProduct(portalProductId, ctx);
  const id = randomId();
  const now = new Date().toISOString();
  const p: StoredProductRestEndpointPage = {
    productRestEndpointPageId: id,
    portalProductId,
    displayContent: asRecord(input["DisplayContent"]),
    restEndpointIdentifier: asRecord(input["RestEndpointIdentifier"]),
    tryItState: stringOrUndefined(input["TryItState"]),
    lastModified: now,
  };
  ctx.store.set(productRestEndpointPageKey(portalProductId, id), p);
  return formatProductRestEndpointPage(p, ctx);
};

const GetProductRestEndpointPage: OperationHandler = (input, ctx) => {
  const portalProductId = requireString(input, "PortalProductId");
  const id = requireString(input, "ProductRestEndpointPageId");
  return formatProductRestEndpointPage(
    getProductRestEndpointPage(portalProductId, id, ctx),
    ctx,
  );
};

const ListProductRestEndpointPages: OperationHandler = (input, ctx) => {
  const portalProductId = requireString(input, "PortalProductId");
  getPortalProduct(portalProductId, ctx);
  const items = listByPrefix<StoredProductRestEndpointPage>(
    ctx,
    `${productRestEndpointPagePrefix}${portalProductId}/`,
  );
  return {
    Items: items.map((p) => formatProductRestEndpointPage(p, ctx)),
  };
};

const UpdateProductRestEndpointPage: OperationHandler = (input, ctx) => {
  const portalProductId = requireString(input, "PortalProductId");
  const id = requireString(input, "ProductRestEndpointPageId");
  const p = getProductRestEndpointPage(portalProductId, id, ctx);
  const now = new Date().toISOString();
  const updated: StoredProductRestEndpointPage = {
    ...p,
    displayContent:
      "DisplayContent" in input
        ? asRecord(input["DisplayContent"])
        : p.displayContent,
    restEndpointIdentifier:
      "RestEndpointIdentifier" in input
        ? asRecord(input["RestEndpointIdentifier"])
        : p.restEndpointIdentifier,
    tryItState:
      "TryItState" in input
        ? stringOrUndefined(input["TryItState"])
        : p.tryItState,
    lastModified: now,
  };
  ctx.store.set(productRestEndpointPageKey(portalProductId, id), updated);
  return formatProductRestEndpointPage(updated, ctx);
};

const DeleteProductRestEndpointPage: OperationHandler = (input, ctx) => {
  const portalProductId = requireString(input, "PortalProductId");
  const id = requireString(input, "ProductRestEndpointPageId");
  getProductRestEndpointPage(portalProductId, id, ctx);
  ctx.store.delete(productRestEndpointPageKey(portalProductId, id));
  return {};
};

const PutPortalProductSharingPolicy: OperationHandler = (input, ctx) => {
  const portalProductId = requireString(input, "PortalProductId");
  getPortalProduct(portalProductId, ctx);
  const policyDocument = requireString(input, "PolicyDocument");
  ctx.store.set(portalSharingPolicyKey(portalProductId), { policyDocument });
  return {};
};

const GetPortalProductSharingPolicy: OperationHandler = (input, ctx) => {
  const portalProductId = requireString(input, "PortalProductId");
  getPortalProduct(portalProductId, ctx);
  const policy = ctx.store.get<{ policyDocument: string }>(
    portalSharingPolicyKey(portalProductId),
  );
  if (policy === undefined)
    throw awsError(
      "NotFoundException",
      `No sharing policy found for portal product`,
      404,
    );
  return { PolicyDocument: policy.policyDocument };
};

const DeletePortalProductSharingPolicy: OperationHandler = (input, ctx) => {
  const portalProductId = requireString(input, "PortalProductId");
  getPortalProduct(portalProductId, ctx);
  ctx.store.delete(portalSharingPolicyKey(portalProductId));
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
        if (req.method === "PUT") return "ImportApi";
        return undefined;
      }
      const apiId = parts[2];
      if (apiId === undefined) return undefined;

      if (parts.length === 3) {
        if (req.method === "GET") return "GetApi";
        if (req.method === "PATCH") return "UpdateApi";
        if (req.method === "DELETE") return "DeleteApi";
        if (req.method === "PUT") return "ReimportApi";
        return undefined;
      }

      const resource = parts[3];

      if (resource === "cors" && parts.length === 4) {
        if (req.method === "DELETE") return "DeleteCorsConfiguration";
        return undefined;
      }

      if (resource === "exports" && parts.length === 5) {
        if (req.method === "GET") return "ExportApi";
        return undefined;
      }

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
        if (parts[5] === "routeresponses") {
          if (parts.length === 6) {
            if (req.method === "GET") return "GetRouteResponses";
            if (req.method === "POST") return "CreateRouteResponse";
            return undefined;
          }
          if (parts.length === 7) {
            if (req.method === "GET") return "GetRouteResponse";
            if (req.method === "PATCH") return "UpdateRouteResponse";
            if (req.method === "DELETE") return "DeleteRouteResponse";
            return undefined;
          }
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
        if (parts[5] === "integrationresponses") {
          if (parts.length === 6) {
            if (req.method === "GET") return "GetIntegrationResponses";
            if (req.method === "POST") return "CreateIntegrationResponse";
            return undefined;
          }
          if (parts.length === 7) {
            if (req.method === "GET") return "GetIntegrationResponse";
            if (req.method === "PATCH") return "UpdateIntegrationResponse";
            if (req.method === "DELETE") return "DeleteIntegrationResponse";
            return undefined;
          }
        }
        return undefined;
      }

      if (resource === "models") {
        if (parts.length === 4) {
          if (req.method === "GET") return "GetModels";
          if (req.method === "POST") return "CreateModel";
          return undefined;
        }
        if (parts.length === 5) {
          if (req.method === "GET") return "GetModel";
          if (req.method === "PATCH") return "UpdateModel";
          if (req.method === "DELETE") return "DeleteModel";
          return undefined;
        }
        if (parts[5] === "template" && parts.length === 6) {
          if (req.method === "GET") return "GetModelTemplate";
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

    if (parts[1] === "domainnames") {
      if (parts.length === 2) {
        if (req.method === "GET") return "GetDomainNames";
        if (req.method === "POST") return "CreateDomainName";
        return undefined;
      }
      const domainName = parts[2];
      if (domainName === undefined) return undefined;

      if (parts.length === 3) {
        if (req.method === "GET") return "GetDomainName";
        if (req.method === "PATCH") return "UpdateDomainName";
        if (req.method === "DELETE") return "DeleteDomainName";
        return undefined;
      }

      const sub = parts[3];
      if (sub === "apimappings") {
        if (parts.length === 4) {
          if (req.method === "GET") return "GetApiMappings";
          if (req.method === "POST") return "CreateApiMapping";
          return undefined;
        }
        if (parts.length === 5) {
          if (req.method === "GET") return "GetApiMapping";
          if (req.method === "PATCH") return "UpdateApiMapping";
          if (req.method === "DELETE") return "DeleteApiMapping";
          return undefined;
        }
        return undefined;
      }

      if (sub === "routingrules") {
        if (parts.length === 4) {
          if (req.method === "GET") return "ListRoutingRules";
          if (req.method === "POST") return "CreateRoutingRule";
          return undefined;
        }
        if (parts.length === 5) {
          if (req.method === "GET") return "GetRoutingRule";
          if (req.method === "PUT") return "PutRoutingRule";
          if (req.method === "DELETE") return "DeleteRoutingRule";
          return undefined;
        }
        return undefined;
      }

      return undefined;
    }

    if (parts[1] === "vpclinks") {
      if (parts.length === 2) {
        if (req.method === "GET") return "GetVpcLinks";
        if (req.method === "POST") return "CreateVpcLink";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "GetVpcLink";
        if (req.method === "PATCH") return "UpdateVpcLink";
        if (req.method === "DELETE") return "DeleteVpcLink";
        return undefined;
      }
      return undefined;
    }

    if (parts[1] === "portals") {
      if (parts.length === 2) {
        if (req.method === "GET") return "ListPortals";
        if (req.method === "POST") return "CreatePortal";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "GetPortal";
        if (req.method === "PATCH") return "UpdatePortal";
        if (req.method === "DELETE") return "DeletePortal";
        return undefined;
      }
      if (parts.length === 4) {
        if (parts[3] === "preview" && req.method === "POST")
          return "PreviewPortal";
        if (parts[3] === "publish") {
          if (req.method === "POST") return "PublishPortal";
          if (req.method === "DELETE") return "DisablePortal";
          return undefined;
        }
        return undefined;
      }
      return undefined;
    }

    if (parts[1] === "portalproducts") {
      if (parts.length === 2) {
        if (req.method === "GET") return "ListPortalProducts";
        if (req.method === "POST") return "CreatePortalProduct";
        return undefined;
      }
      const portalProductId = parts[2];
      if (portalProductId === undefined) return undefined;

      if (parts.length === 3) {
        if (req.method === "GET") return "GetPortalProduct";
        if (req.method === "PATCH") return "UpdatePortalProduct";
        if (req.method === "DELETE") return "DeletePortalProduct";
        return undefined;
      }

      const ppSub = parts[3];
      if (ppSub === "productpages") {
        if (parts.length === 4) {
          if (req.method === "GET") return "ListProductPages";
          if (req.method === "POST") return "CreateProductPage";
          return undefined;
        }
        if (parts.length === 5) {
          if (req.method === "GET") return "GetProductPage";
          if (req.method === "PATCH") return "UpdateProductPage";
          if (req.method === "DELETE") return "DeleteProductPage";
          return undefined;
        }
        return undefined;
      }

      if (ppSub === "productrestendpointpages") {
        if (parts.length === 4) {
          if (req.method === "GET") return "ListProductRestEndpointPages";
          if (req.method === "POST") return "CreateProductRestEndpointPage";
          return undefined;
        }
        if (parts.length === 5) {
          if (req.method === "GET") return "GetProductRestEndpointPage";
          if (req.method === "PATCH") return "UpdateProductRestEndpointPage";
          if (req.method === "DELETE") return "DeleteProductRestEndpointPage";
          return undefined;
        }
        return undefined;
      }

      if (ppSub === "sharingpolicy" && parts.length === 4) {
        if (req.method === "PUT") return "PutPortalProductSharingPolicy";
        if (req.method === "GET") return "GetPortalProductSharingPolicy";
        if (req.method === "DELETE") return "DeletePortalProductSharingPolicy";
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
    ImportApi,
    ReimportApi,
    ExportApi,
    DeleteCorsConfiguration,
    CreateRoute,
    GetRoute,
    GetRoutes,
    UpdateRoute,
    DeleteRoute,
    DeleteRouteRequestParameter,
    DeleteRouteSettings,
    CreateRouteResponse,
    GetRouteResponse,
    GetRouteResponses,
    UpdateRouteResponse,
    DeleteRouteResponse,
    CreateIntegration,
    GetIntegration,
    GetIntegrations,
    UpdateIntegration,
    DeleteIntegration,
    CreateIntegrationResponse,
    GetIntegrationResponse,
    GetIntegrationResponses,
    UpdateIntegrationResponse,
    DeleteIntegrationResponse,
    CreateModel,
    GetModel,
    GetModels,
    GetModelTemplate,
    UpdateModel,
    DeleteModel,
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
    CreateDomainName,
    GetDomainName,
    GetDomainNames,
    UpdateDomainName,
    DeleteDomainName,
    CreateApiMapping,
    GetApiMapping,
    GetApiMappings,
    UpdateApiMapping,
    DeleteApiMapping,
    CreateVpcLink,
    GetVpcLink,
    GetVpcLinks,
    UpdateVpcLink,
    DeleteVpcLink,
    CreateRoutingRule,
    GetRoutingRule,
    ListRoutingRules,
    PutRoutingRule,
    DeleteRoutingRule,
    CreatePortal,
    GetPortal,
    ListPortals,
    UpdatePortal,
    DeletePortal,
    DisablePortal,
    PreviewPortal,
    PublishPortal,
    CreatePortalProduct,
    GetPortalProduct,
    ListPortalProducts,
    UpdatePortalProduct,
    DeletePortalProduct,
    CreateProductPage,
    GetProductPage,
    ListProductPages,
    UpdateProductPage,
    DeleteProductPage,
    CreateProductRestEndpointPage,
    GetProductRestEndpointPage,
    ListProductRestEndpointPages,
    UpdateProductRestEndpointPage,
    DeleteProductRestEndpointPage,
    PutPortalProductSharingPolicy,
    GetPortalProductSharingPolicy,
    DeletePortalProductSharingPolicy,
    GetTags,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default apigatewayv2;
