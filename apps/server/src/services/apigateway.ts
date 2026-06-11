import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import { invokeTaskResource } from "../core/events.ts";
import { scopedStore } from "../core/state.ts";
import type { StateStore } from "../core/state.ts";
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

type StoredStageCanarySettings = {
  percentTraffic: number;
  deploymentId: string | undefined;
  stageVariableOverrides: Record<string, string> | undefined;
  useStageCache: boolean;
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
  canarySettings: StoredStageCanarySettings | undefined;
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

type StoredApiKey = {
  id: string;
  value: string;
  name: string;
  description: string | undefined;
  customerId: string | undefined;
  enabled: boolean;
  createdDate: Date;
  lastUpdatedDate: Date;
  stageKeys: Array<{ restApiId: string; stageName: string }> | undefined;
  tags: Record<string, string> | undefined;
};

type StoredAuthorizer = {
  id: string;
  name: string;
  type: string;
  providerARNs: string[] | undefined;
  authType: string | undefined;
  authorizerUri: string | undefined;
  authorizerCredentials: string | undefined;
  identitySource: string | undefined;
  identityValidationExpression: string | undefined;
  authorizerResultTtlInSeconds: number | undefined;
};

type StoredBasePathMapping = {
  basePath: string;
  restApiId: string;
  stage: string | undefined;
};

type StoredClientCertificate = {
  clientCertificateId: string;
  description: string | undefined;
  pemEncodedCertificate: string;
  createdDate: Date;
  expirationDate: Date;
  tags: Record<string, string> | undefined;
};

type StoredDomainName = {
  domainName: string;
  domainNameId: string | undefined;
  domainNameArn: string;
  certificateName: string | undefined;
  certificateArn: string | undefined;
  regionalDomainName: string | undefined;
  regionalHostedZoneId: string | undefined;
  regionalCertificateName: string | undefined;
  regionalCertificateArn: string | undefined;
  securityPolicy: string | undefined;
  endpointConfiguration: { types: string[] } | undefined;
  domainNameStatus: string;
  tags: Record<string, string> | undefined;
};

type StoredDomainNameAccessAssociation = {
  domainNameAccessAssociationArn: string;
  domainNameArn: string;
  accessAssociationSourceType: string;
  accessAssociationSource: string;
  tags: Record<string, string> | undefined;
};

type StoredVpcLink = {
  id: string;
  name: string;
  description: string | undefined;
  targetArns: string[];
  status: string;
  statusMessage: string | undefined;
  tags: Record<string, string> | undefined;
};

type StoredUsagePlan = {
  id: string;
  name: string;
  description: string | undefined;
  apiStages: Array<{
    apiId: string;
    stage: string;
    throttle?: Record<string, unknown>;
  }>;
  throttle: { burstLimit?: number; rateLimit?: number } | undefined;
  quota: { limit?: number; offset?: number; period?: string } | undefined;
  productCode: string | undefined;
  tags: Record<string, string> | undefined;
};

type StoredUsagePlanKey = {
  id: string;
  type: string;
  value: string;
  name: string;
};

type StoredUsage = {
  usagePlanId: string;
  startDate: string;
  endDate: string;
  items: Record<string, Array<[number, number]>>;
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

const apiKeyKey = (id: string): string => `apikey/${id}`;

const authorizerKey = (restApiId: string, id: string): string =>
  `authorizer/${restApiId}/${id}`;

const basePathMappingKey = (domainName: string, basePath: string): string =>
  `basepathmapping/${domainName}/${basePath}`;

const clientCertificateKey = (id: string): string => `clientcertificate/${id}`;

const arnTagsKey = (arn: string): string => `arntags/${arn}`;

const domainNameKey = (domainName: string): string =>
  `domainname/${domainName}`;

const domainNameAccessAssociationKey = (arn: string): string =>
  `domainnameaccessassociation/${arn}`;

const vpcLinkKey = (id: string): string => `vpclink/${id}`;

const usagePlanKey = (id: string): string => `usageplan/${id}`;

const usagePlanKeyKey = (usagePlanId: string, keyId: string): string =>
  `usageplankey/${usagePlanId}/${keyId}`;

const usageKey = (usagePlanId: string, keyId: string): string =>
  `usage/${usagePlanId}/${keyId}`;

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

const requireApiKey = (ctx: ServiceContext, id: string): StoredApiKey => {
  const k = ctx.store.get<StoredApiKey>(apiKeyKey(id));
  if (k === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid API Key identifier specified`,
      404,
    );
  }
  return k;
};

const requireAuthorizer = (
  ctx: ServiceContext,
  restApiId: string,
  authorizerId: string,
): StoredAuthorizer => {
  const a = ctx.store.get<StoredAuthorizer>(
    authorizerKey(restApiId, authorizerId),
  );
  if (a === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid authorizer identifier specified`,
      404,
    );
  }
  return a;
};

const requireBasePathMapping = (
  ctx: ServiceContext,
  domainName: string,
  basePath: string,
): StoredBasePathMapping => {
  const b = ctx.store.get<StoredBasePathMapping>(
    basePathMappingKey(domainName, basePath),
  );
  if (b === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid base path mapping specified`,
      404,
    );
  }
  return b;
};

const requireClientCertificate = (
  ctx: ServiceContext,
  id: string,
): StoredClientCertificate => {
  const c = ctx.store.get<StoredClientCertificate>(clientCertificateKey(id));
  if (c === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid client certificate identifier specified`,
      404,
    );
  }
  return c;
};

const requireDomainName = (
  ctx: ServiceContext,
  domainName: string,
): StoredDomainName => {
  const d = ctx.store.get<StoredDomainName>(domainNameKey(domainName));
  if (d === undefined) {
    throw awsError("NotFoundException", `Invalid domain name specified`, 404);
  }
  return d;
};

const requireDomainNameAccessAssociation = (
  ctx: ServiceContext,
  arn: string,
): StoredDomainNameAccessAssociation => {
  const d = ctx.store.get<StoredDomainNameAccessAssociation>(
    domainNameAccessAssociationKey(arn),
  );
  if (d === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid domain name access association specified`,
      404,
    );
  }
  return d;
};

const requireVpcLink = (ctx: ServiceContext, id: string): StoredVpcLink => {
  const v = ctx.store.get<StoredVpcLink>(vpcLinkKey(id));
  if (v === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid VPC link identifier specified`,
      404,
    );
  }
  return v;
};

const requireUsagePlan = (ctx: ServiceContext, id: string): StoredUsagePlan => {
  const p = ctx.store.get<StoredUsagePlan>(usagePlanKey(id));
  if (p === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid usage plan identifier specified`,
      404,
    );
  }
  return p;
};

const requireUsagePlanKey = (
  ctx: ServiceContext,
  planId: string,
  keyId: string,
): StoredUsagePlanKey => {
  const k = ctx.store.get<StoredUsagePlanKey>(usagePlanKeyKey(planId, keyId));
  if (k === undefined) {
    throw awsError(
      "NotFoundException",
      `Invalid usage plan key identifier specified`,
      404,
    );
  }
  return k;
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
  canarySettings: s.canarySettings,
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

const apiKeyView = (
  k: StoredApiKey,
  includeValue = true,
): Record<string, unknown> => ({
  id: k.id,
  ...(includeValue ? { value: k.value } : {}),
  name: k.name,
  customerId: k.customerId,
  description: k.description,
  enabled: k.enabled,
  createdDate: k.createdDate,
  lastUpdatedDate: k.lastUpdatedDate,
  stageKeys: k.stageKeys,
  tags: k.tags,
});

const authorizerView = (a: StoredAuthorizer): Record<string, unknown> => ({
  id: a.id,
  name: a.name,
  type: a.type,
  providerARNs: a.providerARNs,
  authType: a.authType,
  authorizerUri: a.authorizerUri,
  authorizerCredentials: a.authorizerCredentials,
  identitySource: a.identitySource,
  identityValidationExpression: a.identityValidationExpression,
  authorizerResultTtlInSeconds: a.authorizerResultTtlInSeconds,
});

const basePathMappingView = (
  b: StoredBasePathMapping,
): Record<string, unknown> => ({
  basePath: b.basePath,
  restApiId: b.restApiId,
  stage: b.stage,
});

const clientCertificateView = (
  c: StoredClientCertificate,
): Record<string, unknown> => ({
  clientCertificateId: c.clientCertificateId,
  description: c.description,
  pemEncodedCertificate: c.pemEncodedCertificate,
  createdDate: c.createdDate,
  expirationDate: c.expirationDate,
  tags: c.tags,
});

const domainNameView = (d: StoredDomainName): Record<string, unknown> => ({
  domainName: d.domainName,
  domainNameId: d.domainNameId,
  domainNameArn: d.domainNameArn,
  certificateName: d.certificateName,
  certificateArn: d.certificateArn,
  regionalDomainName: d.regionalDomainName,
  regionalHostedZoneId: d.regionalHostedZoneId,
  regionalCertificateName: d.regionalCertificateName,
  regionalCertificateArn: d.regionalCertificateArn,
  securityPolicy: d.securityPolicy,
  endpointConfiguration: d.endpointConfiguration,
  domainNameStatus: d.domainNameStatus,
  tags: d.tags,
});

const domainNameAccessAssociationView = (
  d: StoredDomainNameAccessAssociation,
): Record<string, unknown> => ({
  domainNameAccessAssociationArn: d.domainNameAccessAssociationArn,
  domainNameArn: d.domainNameArn,
  accessAssociationSourceType: d.accessAssociationSourceType,
  accessAssociationSource: d.accessAssociationSource,
  tags: d.tags,
});

const vpcLinkView = (v: StoredVpcLink): Record<string, unknown> => ({
  id: v.id,
  name: v.name,
  description: v.description,
  targetArns: v.targetArns,
  status: v.status,
  statusMessage: v.statusMessage,
  tags: v.tags,
});

const usagePlanView = (p: StoredUsagePlan): Record<string, unknown> => ({
  id: p.id,
  name: p.name,
  description: p.description,
  apiStages: p.apiStages,
  throttle: p.throttle,
  quota: p.quota,
  productCode: p.productCode,
  tags: p.tags,
});

const usagePlanKeyView = (k: StoredUsagePlanKey): Record<string, unknown> => ({
  id: k.id,
  type: k.type,
  value: k.value,
  name: k.name,
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
        : false,
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

const TestInvokeMethod: OperationHandler = async (input, ctx) => {
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
  const resource = requireResource(ctx, restApiId, resourceId);
  requireMethod(ctx, restApiId, resourceId, httpMethod);

  const integration = ctx.store.get<StoredIntegration>(
    integrationKey(restApiId, resourceId, httpMethod),
  );

  if (!integration) {
    throw awsError(
      "NotFoundException",
      "No integration defined for method",
      404,
    );
  }

  if (integration.type === "AWS_PROXY") {
    const functionArn = integration.uri
      ? lambdaArnFromUri(integration.uri)
      : undefined;

    if (!functionArn) {
      return {
        status: 500,
        body: JSON.stringify({ message: "Invalid integration URI" }),
        headers: {},
        multiValueHeaders: {},
        log: "",
        latency: 0,
      };
    }

    const bodyText = typeof input["body"] === "string" ? input["body"] : "";
    const inputHeaders =
      input["headers"] !== null && typeof input["headers"] === "object"
        ? (input["headers"] as Record<string, string>)
        : {};
    const stageVariables =
      input["stageVariables"] !== null &&
      typeof input["stageVariables"] === "object"
        ? (input["stageVariables"] as Record<string, string>)
        : {};

    const event = {
      version: "1.0",
      resource: resource.path,
      path: resource.path,
      httpMethod,
      headers: inputHeaders,
      queryStringParameters: null,
      pathParameters: null,
      stageVariables:
        Object.keys(stageVariables).length > 0 ? stageVariables : null,
      requestContext: {
        stage: "test-invoke-stage",
        resourcePath: resource.path,
        httpMethod,
      },
      body: bodyText || null,
      isBase64Encoded: false,
    };

    const result = await invokeTaskResource(ctx, functionArn, event);

    if (!result.ok) {
      return {
        status: 502,
        body: JSON.stringify({ message: "Internal server error" }),
        headers: {},
        multiValueHeaders: {},
        log: "",
        latency: 0,
      };
    }

    const lambdaResult = result.result as {
      statusCode?: number;
      headers?: Record<string, string>;
      body?: string;
    };

    return {
      status: lambdaResult.statusCode ?? 200,
      body: lambdaResult.body ?? "",
      headers: lambdaResult.headers ?? {},
      multiValueHeaders: {},
      log: "",
      latency: 0,
    };
  }

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
  const canaryInput = input["canarySettings"];
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
    canarySettings:
      canaryInput !== null && typeof canaryInput === "object"
        ? {
            percentTraffic:
              typeof (canaryInput as Record<string, unknown>)[
                "percentTraffic"
              ] === "number"
                ? ((canaryInput as Record<string, unknown>)[
                    "percentTraffic"
                  ] as number)
                : 0,
            deploymentId: stringOrUndefined(
              (canaryInput as Record<string, unknown>)["deploymentId"],
            ),
            stageVariableOverrides:
              (canaryInput as Record<string, unknown>)[
                "stageVariableOverrides"
              ] !== null &&
              typeof (canaryInput as Record<string, unknown>)[
                "stageVariableOverrides"
              ] === "object"
                ? ((canaryInput as Record<string, unknown>)[
                    "stageVariableOverrides"
                  ] as Record<string, string>)
                : undefined,
            useStageCache:
              (canaryInput as Record<string, unknown>)["useStageCache"] ===
              true,
          }
        : undefined,
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
  const currentCanary = s.canarySettings;
  const patchedCanaryPercent = patched["canarySettings/percentTraffic"];
  const patchedCanaryDeployId = patched["canarySettings/deploymentId"];
  const patchedCanaryUseCache = patched["canarySettings/useStageCache"];
  const patchedCanaryOverrides =
    patched["canarySettings/stageVariableOverrides"];
  const hasCanaryPatch =
    patchedCanaryPercent !== undefined ||
    patchedCanaryDeployId !== undefined ||
    patchedCanaryUseCache !== undefined ||
    patchedCanaryOverrides !== undefined;
  const updatedCanary: StoredStageCanarySettings | undefined = hasCanaryPatch
    ? {
        percentTraffic:
          patchedCanaryPercent !== undefined
            ? Number(patchedCanaryPercent)
            : (currentCanary?.percentTraffic ?? 0),
        deploymentId:
          patchedCanaryDeployId !== undefined
            ? stringOrUndefined(patchedCanaryDeployId)
            : currentCanary?.deploymentId,
        stageVariableOverrides:
          patchedCanaryOverrides !== undefined
            ? typeof patchedCanaryOverrides === "object" &&
              patchedCanaryOverrides !== null
              ? (patchedCanaryOverrides as Record<string, string>)
              : undefined
            : currentCanary?.stageVariableOverrides,
        useStageCache:
          patchedCanaryUseCache !== undefined
            ? patchedCanaryUseCache === true || patchedCanaryUseCache === "true"
            : (currentCanary?.useStageCache ?? false),
      }
    : currentCanary;
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
    canarySettings: updatedCanary,
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

const CreateApiKey: OperationHandler = (input, ctx) => {
  const id = randomId();
  const now = new Date();
  const expirationDate = new Date(now);
  expirationDate.setFullYear(expirationDate.getFullYear() + 1);
  const k: StoredApiKey = {
    id,
    value:
      stringOrUndefined(input["value"]) ??
      crypto.randomUUID().replaceAll("-", ""),
    name: stringOrUndefined(input["name"]) ?? "",
    description: stringOrUndefined(input["description"]),
    customerId: stringOrUndefined(input["customerId"]),
    enabled: input["enabled"] !== false,
    createdDate: now,
    lastUpdatedDate: now,
    stageKeys: Array.isArray(input["stageKeys"])
      ? (input["stageKeys"] as Array<Record<string, unknown>>).map((sk) => ({
          restApiId: String(sk["restApiId"] ?? ""),
          stageName: String(sk["stageName"] ?? ""),
        }))
      : undefined,
    tags:
      input["tags"] != null && typeof input["tags"] === "object"
        ? (input["tags"] as Record<string, string>)
        : undefined,
  };
  ctx.store.set(apiKeyKey(id), k);
  return apiKeyView(k);
};

const GetApiKey: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["apiKey"]);
  if (!id) throw awsError("BadRequestException", "apiKey is required.", 400);
  const includeValue =
    input["includeValue"] === true || input["includeValue"] === "true";
  return apiKeyView(requireApiKey(ctx, id), includeValue);
};

const GetApiKeys: OperationHandler = (input, ctx) => {
  const includeValues =
    input["includeValues"] === true || input["includeValues"] === "true";
  const items = ctx.store
    .list<StoredApiKey>()
    .filter((e) => e.key.startsWith("apikey/"))
    .map((e) => apiKeyView(e.value, includeValues));
  return { items };
};

const DeleteApiKey: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["apiKey"]);
  if (!id) throw awsError("BadRequestException", "apiKey is required.", 400);
  requireApiKey(ctx, id);
  ctx.store.delete(apiKeyKey(id));
  for (const entry of ctx.store.list()) {
    if (entry.key.startsWith("usageplankey/") && entry.key.endsWith(`/${id}`)) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const UpdateApiKey: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["apiKey"]);
  if (!id) throw awsError("BadRequestException", "apiKey is required.", 400);
  const k = requireApiKey(ctx, id);
  const patched = applyPatch(
    k as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredApiKey = {
    ...k,
    name: stringOrUndefined(patched["name"]) ?? k.name,
    description: stringOrUndefined(patched["description"]),
    customerId: stringOrUndefined(patched["customerId"]),
    enabled:
      patched["enabled"] === "false" || patched["enabled"] === false
        ? false
        : patched["enabled"] === "true" || patched["enabled"] === true
          ? true
          : k.enabled,
    lastUpdatedDate: new Date(),
  };
  ctx.store.set(apiKeyKey(id), updated);
  return apiKeyView(updated);
};

const ImportApiKeys: OperationHandler = (input, ctx) => {
  const bodyRaw = input["body"];
  const bodyText =
    bodyRaw instanceof Uint8Array
      ? new TextDecoder().decode(bodyRaw)
      : typeof bodyRaw === "string"
        ? bodyRaw
        : "";
  const failOnWarnings = input["failOnWarnings"] === true;
  const ids: string[] = [];
  const warnings: string[] = [];
  const lines = bodyText.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { ids, warnings };
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const keyIdx = headers.indexOf("key");
  if (nameIdx === -1 || keyIdx === -1) {
    throw awsError(
      "BadRequestException",
      "CSV header must include Name and Key columns.",
      400,
    );
  }
  const descIdx = headers.indexOf("description");
  const enabledIdx = headers.indexOf("enabled");
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    const name = parts[nameIdx];
    const value = parts[keyIdx];
    if (!name || !value) {
      const msg = `Row ${i}: missing required Name or Key field.`;
      if (failOnWarnings) {
        throw awsError("BadRequestException", msg, 400);
      }
      warnings.push(msg);
      continue;
    }
    const id = randomId();
    const now = new Date();
    const k: StoredApiKey = {
      id,
      value,
      name,
      description:
        descIdx !== -1 && parts[descIdx] ? parts[descIdx] : undefined,
      customerId: undefined,
      enabled:
        enabledIdx !== -1 && parts[enabledIdx] !== undefined
          ? parts[enabledIdx].toLowerCase() !== "false"
          : true,
      createdDate: now,
      lastUpdatedDate: now,
      stageKeys: undefined,
      tags: undefined,
    };
    ctx.store.set(apiKeyKey(id), k);
    ids.push(id);
  }
  return { ids, warnings };
};

const CreateAuthorizer: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const name = stringOrUndefined(input["name"]);
  const type = stringOrUndefined(input["type"]);
  if (!restApiId || !name || !type) {
    throw awsError(
      "BadRequestException",
      "restApiId, name and type are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  const id = randomId();
  const a: StoredAuthorizer = {
    id,
    name,
    type,
    providerARNs: Array.isArray(input["providerARNs"])
      ? (input["providerARNs"] as string[])
      : undefined,
    authType: stringOrUndefined(input["authType"]),
    authorizerUri: stringOrUndefined(input["authorizerUri"]),
    authorizerCredentials: stringOrUndefined(input["authorizerCredentials"]),
    identitySource: stringOrUndefined(input["identitySource"]),
    identityValidationExpression: stringOrUndefined(
      input["identityValidationExpression"],
    ),
    authorizerResultTtlInSeconds:
      typeof input["authorizerResultTtlInSeconds"] === "number"
        ? input["authorizerResultTtlInSeconds"]
        : undefined,
  };
  ctx.store.set(authorizerKey(restApiId, id), a);
  return authorizerView(a);
};

const GetAuthorizer: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const authorizerId = stringOrUndefined(input["authorizerId"]);
  if (!restApiId || !authorizerId) {
    throw awsError(
      "BadRequestException",
      "restApiId and authorizerId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  return authorizerView(requireAuthorizer(ctx, restApiId, authorizerId));
};

const GetAuthorizers: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (!restApiId) {
    throw awsError("BadRequestException", "restApiId is required.", 400);
  }
  requireRestApi(ctx, restApiId);
  const prefix = `authorizer/${restApiId}/`;
  const items = ctx.store
    .list<StoredAuthorizer>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => authorizerView(e.value));
  return { items };
};

const DeleteAuthorizer: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const authorizerId = stringOrUndefined(input["authorizerId"]);
  if (!restApiId || !authorizerId) {
    throw awsError(
      "BadRequestException",
      "restApiId and authorizerId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  requireAuthorizer(ctx, restApiId, authorizerId);
  ctx.store.delete(authorizerKey(restApiId, authorizerId));
  return {};
};

const UpdateAuthorizer: OperationHandler = (input, ctx) => {
  const restApiId = stringOrUndefined(input["restApiId"]);
  const authorizerId = stringOrUndefined(input["authorizerId"]);
  if (!restApiId || !authorizerId) {
    throw awsError(
      "BadRequestException",
      "restApiId and authorizerId are required.",
      400,
    );
  }
  requireRestApi(ctx, restApiId);
  const a = requireAuthorizer(ctx, restApiId, authorizerId);
  const patched = applyPatch(
    a as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredAuthorizer = {
    ...a,
    name: stringOrUndefined(patched["name"]) ?? a.name,
    authorizerUri: stringOrUndefined(patched["authorizerUri"]),
    identitySource: stringOrUndefined(patched["identitySource"]),
    authorizerResultTtlInSeconds:
      typeof patched["authorizerResultTtlInSeconds"] === "number"
        ? patched["authorizerResultTtlInSeconds"]
        : a.authorizerResultTtlInSeconds,
  };
  ctx.store.set(authorizerKey(restApiId, authorizerId), updated);
  return authorizerView(updated);
};

const CreateBasePathMapping: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["domainName"]);
  const restApiId = stringOrUndefined(input["restApiId"]);
  if (!domainName || !restApiId) {
    throw awsError(
      "BadRequestException",
      "domainName and restApiId are required.",
      400,
    );
  }
  const basePath = stringOrUndefined(input["basePath"]) ?? "(none)";
  const b: StoredBasePathMapping = {
    basePath,
    restApiId,
    stage: stringOrUndefined(input["stage"]),
  };
  ctx.store.set(basePathMappingKey(domainName, basePath), b);
  return basePathMappingView(b);
};

const GetBasePathMapping: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["domainName"]);
  const basePath = stringOrUndefined(input["basePath"]) ?? "(none)";
  if (!domainName) {
    throw awsError("BadRequestException", "domainName is required.", 400);
  }
  return basePathMappingView(requireBasePathMapping(ctx, domainName, basePath));
};

const GetBasePathMappings: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["domainName"]);
  if (!domainName) {
    throw awsError("BadRequestException", "domainName is required.", 400);
  }
  const prefix = `basepathmapping/${domainName}/`;
  const items = ctx.store
    .list<StoredBasePathMapping>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => basePathMappingView(e.value));
  return { items };
};

const DeleteBasePathMapping: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["domainName"]);
  const basePath = stringOrUndefined(input["basePath"]) ?? "(none)";
  if (!domainName) {
    throw awsError("BadRequestException", "domainName is required.", 400);
  }
  requireBasePathMapping(ctx, domainName, basePath);
  ctx.store.delete(basePathMappingKey(domainName, basePath));
  return {};
};

const UpdateBasePathMapping: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["domainName"]);
  const basePath = stringOrUndefined(input["basePath"]) ?? "(none)";
  if (!domainName) {
    throw awsError("BadRequestException", "domainName is required.", 400);
  }
  const b = requireBasePathMapping(ctx, domainName, basePath);
  const patched = applyPatch(
    b as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const newBasePath = stringOrUndefined(patched["basePath"]) ?? b.basePath;
  const updated: StoredBasePathMapping = {
    basePath: newBasePath,
    restApiId: stringOrUndefined(patched["restApiId"]) ?? b.restApiId,
    stage: stringOrUndefined(patched["stage"]) ?? b.stage,
  };
  if (newBasePath !== basePath) {
    ctx.store.delete(basePathMappingKey(domainName, basePath));
  }
  ctx.store.set(basePathMappingKey(domainName, newBasePath), updated);
  return basePathMappingView(updated);
};

const GenerateClientCertificate: OperationHandler = (input, ctx) => {
  const id = randomId();
  const now = new Date();
  const expirationDate = new Date(now);
  expirationDate.setFullYear(expirationDate.getFullYear() + 2);
  const c: StoredClientCertificate = {
    clientCertificateId: id,
    description: stringOrUndefined(input["description"]),
    pemEncodedCertificate: `-----BEGIN CERTIFICATE-----\nMOCK${id}\n-----END CERTIFICATE-----`,
    createdDate: now,
    expirationDate,
    tags:
      input["tags"] != null && typeof input["tags"] === "object"
        ? (input["tags"] as Record<string, string>)
        : undefined,
  };
  ctx.store.set(clientCertificateKey(id), c);
  return clientCertificateView(c);
};

const GetClientCertificate: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["clientCertificateId"]);
  if (!id) {
    throw awsError(
      "BadRequestException",
      "clientCertificateId is required.",
      400,
    );
  }
  return clientCertificateView(requireClientCertificate(ctx, id));
};

const GetClientCertificates: OperationHandler = (_input, ctx) => {
  const items = ctx.store
    .list<StoredClientCertificate>()
    .filter((e) => e.key.startsWith("clientcertificate/"))
    .map((e) => clientCertificateView(e.value));
  return { items };
};

const DeleteClientCertificate: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["clientCertificateId"]);
  if (!id) {
    throw awsError(
      "BadRequestException",
      "clientCertificateId is required.",
      400,
    );
  }
  requireClientCertificate(ctx, id);
  ctx.store.delete(clientCertificateKey(id));
  return {};
};

const UpdateClientCertificate: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["clientCertificateId"]);
  if (!id) {
    throw awsError(
      "BadRequestException",
      "clientCertificateId is required.",
      400,
    );
  }
  const c = requireClientCertificate(ctx, id);
  const patched = applyPatch(
    c as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredClientCertificate = {
    ...c,
    description: stringOrUndefined(patched["description"]),
  };
  ctx.store.set(clientCertificateKey(id), updated);
  return clientCertificateView(updated);
};

const GetTags: OperationHandler = (input, ctx) => {
  const resourceArn = stringOrUndefined(input["resourceArn"]);
  if (!resourceArn) {
    throw awsError("BadRequestException", "resourceArn is required.", 400);
  }
  const tags =
    ctx.store.get<Record<string, string>>(arnTagsKey(resourceArn)) ?? {};
  return { tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = stringOrUndefined(input["resourceArn"]);
  if (!resourceArn) {
    throw awsError("BadRequestException", "resourceArn is required.", 400);
  }
  const existing =
    ctx.store.get<Record<string, string>>(arnTagsKey(resourceArn)) ?? {};
  const newTags =
    input["tags"] != null && typeof input["tags"] === "object"
      ? (input["tags"] as Record<string, string>)
      : {};
  ctx.store.set(arnTagsKey(resourceArn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = stringOrUndefined(input["resourceArn"]);
  if (!resourceArn) {
    throw awsError("BadRequestException", "resourceArn is required.", 400);
  }
  const existing =
    ctx.store.get<Record<string, string>>(arnTagsKey(resourceArn)) ?? {};
  const tagKeys = Array.isArray(input["tagKeys"])
    ? (input["tagKeys"] as string[])
    : [];
  const updated = { ...existing };
  for (const k of tagKeys) {
    delete updated[k];
  }
  ctx.store.set(arnTagsKey(resourceArn), updated);
  return {};
};

const CreateDomainName: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["domainName"]);
  if (!domainName) {
    throw awsError("BadRequestException", "domainName is required.", 400);
  }
  const domainNameArn = `arn:aws:apigateway:us-east-1::/domainnames/${domainName}`;
  const d: StoredDomainName = {
    domainName,
    domainNameId: undefined,
    domainNameArn,
    certificateName: stringOrUndefined(input["certificateName"]),
    certificateArn: stringOrUndefined(input["certificateArn"]),
    regionalDomainName: `${domainName}.regional.amazonaws.com`,
    regionalHostedZoneId: "Z2FDTNDATAQYW2",
    regionalCertificateName: stringOrUndefined(
      input["regionalCertificateName"],
    ),
    regionalCertificateArn: stringOrUndefined(input["regionalCertificateArn"]),
    securityPolicy: stringOrUndefined(input["securityPolicy"]),
    endpointConfiguration:
      input["endpointConfiguration"] != null &&
      typeof input["endpointConfiguration"] === "object"
        ? (input["endpointConfiguration"] as { types: string[] })
        : undefined,
    domainNameStatus: "AVAILABLE",
    tags:
      input["tags"] != null && typeof input["tags"] === "object"
        ? (input["tags"] as Record<string, string>)
        : undefined,
  };
  ctx.store.set(domainNameKey(domainName), d);
  return domainNameView(d);
};

const GetDomainName: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["domainName"]);
  if (!domainName) {
    throw awsError("BadRequestException", "domainName is required.", 400);
  }
  return domainNameView(requireDomainName(ctx, domainName));
};

const GetDomainNames: OperationHandler = (_input, ctx) => {
  const items = ctx.store
    .list<StoredDomainName>()
    .filter((e) => e.key.startsWith("domainname/"))
    .map((e) => domainNameView(e.value));
  return { items };
};

const DeleteDomainName: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["domainName"]);
  if (!domainName) {
    throw awsError("BadRequestException", "domainName is required.", 400);
  }
  requireDomainName(ctx, domainName);
  ctx.store.delete(domainNameKey(domainName));
  return {};
};

const UpdateDomainName: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["domainName"]);
  if (!domainName) {
    throw awsError("BadRequestException", "domainName is required.", 400);
  }
  const d = requireDomainName(ctx, domainName);
  const patched = applyPatch(
    d as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredDomainName = {
    ...d,
    certificateName: stringOrUndefined(patched["certificateName"]),
    certificateArn: stringOrUndefined(patched["certificateArn"]),
    regionalCertificateName: stringOrUndefined(
      patched["regionalCertificateName"],
    ),
    regionalCertificateArn: stringOrUndefined(
      patched["regionalCertificateArn"],
    ),
    securityPolicy: stringOrUndefined(patched["securityPolicy"]),
  };
  ctx.store.set(domainNameKey(domainName), updated);
  return domainNameView(updated);
};

const CreateDomainNameAccessAssociation: OperationHandler = (input, ctx) => {
  const domainNameArn = stringOrUndefined(input["domainNameArn"]);
  const accessAssociationSourceType = stringOrUndefined(
    input["accessAssociationSourceType"],
  );
  const accessAssociationSource = stringOrUndefined(
    input["accessAssociationSource"],
  );
  if (
    !domainNameArn ||
    !accessAssociationSourceType ||
    !accessAssociationSource
  ) {
    throw awsError(
      "BadRequestException",
      "domainNameArn, accessAssociationSourceType, and accessAssociationSource are required.",
      400,
    );
  }
  const arn = `arn:aws:apigateway:us-east-1::/domainnameaccessassociations/${randomId()}`;
  const d: StoredDomainNameAccessAssociation = {
    domainNameAccessAssociationArn: arn,
    domainNameArn,
    accessAssociationSourceType,
    accessAssociationSource,
    tags:
      input["tags"] != null && typeof input["tags"] === "object"
        ? (input["tags"] as Record<string, string>)
        : undefined,
  };
  ctx.store.set(domainNameAccessAssociationKey(arn), d);
  return domainNameAccessAssociationView(d);
};

const GetDomainNameAccessAssociations: OperationHandler = (_input, ctx) => {
  const items = ctx.store
    .list<StoredDomainNameAccessAssociation>()
    .filter((e) => e.key.startsWith("domainnameaccessassociation/"))
    .map((e) => domainNameAccessAssociationView(e.value));
  return { items };
};

const DeleteDomainNameAccessAssociation: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["domainNameAccessAssociationArn"]);
  if (!arn) {
    throw awsError(
      "BadRequestException",
      "domainNameAccessAssociationArn is required.",
      400,
    );
  }
  requireDomainNameAccessAssociation(ctx, arn);
  ctx.store.delete(domainNameAccessAssociationKey(arn));
  return {};
};

const RejectDomainNameAccessAssociation: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["domainNameAccessAssociationArn"]);
  if (!arn) {
    throw awsError(
      "BadRequestException",
      "domainNameAccessAssociationArn is required.",
      400,
    );
  }
  requireDomainNameAccessAssociation(ctx, arn);
  ctx.store.delete(domainNameAccessAssociationKey(arn));
  return {};
};

const CreateVpcLink: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  if (!name) {
    throw awsError("BadRequestException", "name is required.", 400);
  }
  const targetArns = Array.isArray(input["targetArns"])
    ? (input["targetArns"] as string[])
    : [];
  const id = randomId();
  const v: StoredVpcLink = {
    id,
    name,
    description: stringOrUndefined(input["description"]),
    targetArns,
    status: "AVAILABLE",
    statusMessage: undefined,
    tags:
      input["tags"] != null && typeof input["tags"] === "object"
        ? (input["tags"] as Record<string, string>)
        : undefined,
  };
  ctx.store.set(vpcLinkKey(id), v);
  return vpcLinkView(v);
};

const GetVpcLink: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["vpcLinkId"]);
  if (!id) {
    throw awsError("BadRequestException", "vpcLinkId is required.", 400);
  }
  return vpcLinkView(requireVpcLink(ctx, id));
};

const GetVpcLinks: OperationHandler = (_input, ctx) => {
  const items = ctx.store
    .list<StoredVpcLink>()
    .filter((e) => e.key.startsWith("vpclink/"))
    .map((e) => vpcLinkView(e.value));
  return { items };
};

const DeleteVpcLink: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["vpcLinkId"]);
  if (!id) {
    throw awsError("BadRequestException", "vpcLinkId is required.", 400);
  }
  requireVpcLink(ctx, id);
  ctx.store.delete(vpcLinkKey(id));
  return {};
};

const UpdateVpcLink: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["vpcLinkId"]);
  if (!id) {
    throw awsError("BadRequestException", "vpcLinkId is required.", 400);
  }
  const v = requireVpcLink(ctx, id);
  const patched = applyPatch(
    v as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredVpcLink = {
    id,
    name: typeof patched["name"] === "string" ? patched["name"] : v.name,
    description: stringOrUndefined(patched["description"]) ?? v.description,
    targetArns: Array.isArray(patched["targetArns"])
      ? (patched["targetArns"] as string[])
      : v.targetArns,
    status:
      typeof patched["status"] === "string" ? patched["status"] : v.status,
    statusMessage:
      stringOrUndefined(patched["statusMessage"]) ?? v.statusMessage,
    tags: v.tags,
  };
  ctx.store.set(vpcLinkKey(id), updated);
  return vpcLinkView(updated);
};

const CreateUsagePlan: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  if (!name) {
    throw awsError("BadRequestException", "name is required.", 400);
  }
  const id = randomId();
  const apiStages = Array.isArray(input["apiStages"])
    ? (input["apiStages"] as Array<{
        apiId: string;
        stage: string;
        throttle?: Record<string, unknown>;
      }>)
    : [];
  const rawThrottle = input["throttle"];
  const rawQuota = input["quota"];
  const plan: StoredUsagePlan = {
    id,
    name,
    description: stringOrUndefined(input["description"]),
    apiStages,
    throttle:
      rawThrottle != null && typeof rawThrottle === "object"
        ? (rawThrottle as { burstLimit?: number; rateLimit?: number })
        : undefined,
    quota:
      rawQuota != null && typeof rawQuota === "object"
        ? (rawQuota as { limit?: number; offset?: number; period?: string })
        : undefined,
    productCode: stringOrUndefined(input["productCode"]),
    tags:
      input["tags"] != null && typeof input["tags"] === "object"
        ? (input["tags"] as Record<string, string>)
        : undefined,
  };
  ctx.store.set(usagePlanKey(id), plan);
  return usagePlanView(plan);
};

const GetUsagePlan: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["usagePlanId"]);
  if (!id) {
    throw awsError("BadRequestException", "usagePlanId is required.", 400);
  }
  return usagePlanView(requireUsagePlan(ctx, id));
};

const GetUsagePlans: OperationHandler = (_input, ctx) => {
  const items = ctx.store
    .list<StoredUsagePlan>()
    .filter((e) => e.key.startsWith("usageplan/"))
    .map((e) => usagePlanView(e.value));
  return { items };
};

const DeleteUsagePlan: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["usagePlanId"]);
  if (!id) {
    throw awsError("BadRequestException", "usagePlanId is required.", 400);
  }
  requireUsagePlan(ctx, id);
  ctx.store.delete(usagePlanKey(id));
  return {};
};

const UpdateUsagePlan: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["usagePlanId"]);
  if (!id) {
    throw awsError("BadRequestException", "usagePlanId is required.", 400);
  }
  const plan = requireUsagePlan(ctx, id);
  const patched = applyPatch(
    plan as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredUsagePlan = {
    id,
    name: typeof patched["name"] === "string" ? patched["name"] : plan.name,
    description: stringOrUndefined(patched["description"]) ?? plan.description,
    apiStages: Array.isArray(patched["apiStages"])
      ? (patched["apiStages"] as Array<{ apiId: string; stage: string }>)
      : plan.apiStages,
    throttle: (() => {
      const b = patched["throttle/burstLimit"];
      const r = patched["throttle/rateLimit"];
      if (b !== undefined || r !== undefined) {
        return {
          burstLimit: b !== undefined ? Number(b) : plan.throttle?.burstLimit,
          rateLimit: r !== undefined ? Number(r) : plan.throttle?.rateLimit,
        };
      }
      return plan.throttle;
    })(),
    quota: (() => {
      const l = patched["quota/limit"];
      const p = patched["quota/period"];
      if (l !== undefined || p !== undefined) {
        return {
          limit: l !== undefined ? Number(l) : plan.quota?.limit,
          offset: plan.quota?.offset,
          period: p !== undefined ? String(p) : plan.quota?.period,
        };
      }
      return plan.quota;
    })(),
    productCode: stringOrUndefined(patched["productCode"]) ?? plan.productCode,
    tags: plan.tags,
  };
  ctx.store.set(usagePlanKey(id), updated);
  return usagePlanView(updated);
};

const CreateUsagePlanKey: OperationHandler = (input, ctx) => {
  const planId = stringOrUndefined(input["usagePlanId"]);
  if (!planId) {
    throw awsError("BadRequestException", "usagePlanId is required.", 400);
  }
  requireUsagePlan(ctx, planId);
  const keyId = stringOrUndefined(input["keyId"]);
  if (!keyId) {
    throw awsError("BadRequestException", "keyId is required.", 400);
  }
  const keyType = stringOrUndefined(input["keyType"]);
  if (!keyType) {
    throw awsError("BadRequestException", "keyType is required.", 400);
  }
  const apiKey = requireApiKey(ctx, keyId);
  const k: StoredUsagePlanKey = {
    id: keyId,
    type: keyType,
    value: apiKey.value,
    name: apiKey.name,
  };
  ctx.store.set(usagePlanKeyKey(planId, keyId), k);
  return usagePlanKeyView(k);
};

const GetUsagePlanKey: OperationHandler = (input, ctx) => {
  const planId = stringOrUndefined(input["usagePlanId"]);
  if (!planId) {
    throw awsError("BadRequestException", "usagePlanId is required.", 400);
  }
  const keyId = stringOrUndefined(input["keyId"]);
  if (!keyId) {
    throw awsError("BadRequestException", "keyId is required.", 400);
  }
  return usagePlanKeyView(requireUsagePlanKey(ctx, planId, keyId));
};

const GetUsagePlanKeys: OperationHandler = (input, ctx) => {
  const planId = stringOrUndefined(input["usagePlanId"]);
  if (!planId) {
    throw awsError("BadRequestException", "usagePlanId is required.", 400);
  }
  requireUsagePlan(ctx, planId);
  const prefix = `usageplankey/${planId}/`;
  const items = ctx.store
    .list<StoredUsagePlanKey>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => usagePlanKeyView(e.value));
  return { items };
};

const DeleteUsagePlanKey: OperationHandler = (input, ctx) => {
  const planId = stringOrUndefined(input["usagePlanId"]);
  if (!planId) {
    throw awsError("BadRequestException", "usagePlanId is required.", 400);
  }
  const keyId = stringOrUndefined(input["keyId"]);
  if (!keyId) {
    throw awsError("BadRequestException", "keyId is required.", 400);
  }
  requireUsagePlanKey(ctx, planId, keyId);
  ctx.store.delete(usagePlanKeyKey(planId, keyId));
  return {};
};

const GetUsage: OperationHandler = (input, ctx) => {
  const planId = stringOrUndefined(input["usagePlanId"]);
  if (!planId) {
    throw awsError("BadRequestException", "usagePlanId is required.", 400);
  }
  requireUsagePlan(ctx, planId);
  const startDate = stringOrUndefined(input["startDate"]) ?? "";
  const endDate = stringOrUndefined(input["endDate"]) ?? "";
  const filterKeyId = stringOrUndefined(input["keyId"]);
  const prefix = `usage/${planId}/`;
  const usages = ctx.store
    .list<StoredUsage>()
    .filter((e) => e.key.startsWith(prefix));
  const items: Record<string, Array<[number, number]>> = {};
  for (const e of usages) {
    if (filterKeyId && e.value.usagePlanId !== planId) continue;
    const keyId = e.key.slice(prefix.length);
    if (filterKeyId && keyId !== filterKeyId) continue;
    items[keyId] = e.value.items[keyId] ?? [];
  }
  return { usagePlanId: planId, startDate, endDate, items };
};

const UpdateUsage: OperationHandler = (input, ctx) => {
  const planId = stringOrUndefined(input["usagePlanId"]);
  if (!planId) {
    throw awsError("BadRequestException", "usagePlanId is required.", 400);
  }
  const keyId = stringOrUndefined(input["keyId"]);
  if (!keyId) {
    throw awsError("BadRequestException", "keyId is required.", 400);
  }
  requireUsagePlan(ctx, planId);
  const existing = ctx.store.get<StoredUsage>(usageKey(planId, keyId)) ?? {
    usagePlanId: planId,
    startDate: "",
    endDate: "",
    items: {},
  };
  const patched = applyPatch(
    existing as unknown as Record<string, unknown>,
    input["patchOperations"],
  );
  const updated: StoredUsage = {
    usagePlanId: planId,
    startDate: existing.startDate,
    endDate: existing.endDate,
    items:
      patched["items"] != null && typeof patched["items"] === "object"
        ? (patched["items"] as Record<string, Array<[number, number]>>)
        : existing.items,
  };
  ctx.store.set(usageKey(planId, keyId), updated);
  return {
    usagePlanId: planId,
    startDate: updated.startDate,
    endDate: updated.endDate,
    items: updated.items,
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

    if (parts[0] === "apikeys") {
      if (parts.length === 1) {
        if (req.method === "POST") {
          if (req.query.get("mode") === "import") return "ImportApiKeys";
          return "CreateApiKey";
        }
        if (req.method === "GET") return "GetApiKeys";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetApiKey";
        if (req.method === "DELETE") return "DeleteApiKey";
        if (req.method === "PATCH") return "UpdateApiKey";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "clientcertificates") {
      if (parts.length === 1) {
        if (req.method === "POST") return "GenerateClientCertificate";
        if (req.method === "GET") return "GetClientCertificates";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetClientCertificate";
        if (req.method === "DELETE") return "DeleteClientCertificate";
        if (req.method === "PATCH") return "UpdateClientCertificate";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "domainnames") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateDomainName";
        if (req.method === "GET") return "GetDomainNames";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetDomainName";
        if (req.method === "DELETE") return "DeleteDomainName";
        if (req.method === "PATCH") return "UpdateDomainName";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "basepathmappings") {
        if (req.method === "POST") return "CreateBasePathMapping";
        if (req.method === "GET") return "GetBasePathMappings";
        return undefined;
      }
      if (parts.length === 4 && parts[2] === "basepathmappings") {
        if (req.method === "GET") return "GetBasePathMapping";
        if (req.method === "DELETE") return "DeleteBasePathMapping";
        if (req.method === "PATCH") return "UpdateBasePathMapping";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "domainnameaccessassociations") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateDomainNameAccessAssociation";
        if (req.method === "GET") return "GetDomainNameAccessAssociations";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "DELETE") return "DeleteDomainNameAccessAssociation";
        return undefined;
      }
      return undefined;
    }

    if (
      parts[0] === "rejectdomainnameaccessassociations" &&
      parts.length === 1 &&
      req.method === "POST"
    ) {
      return "RejectDomainNameAccessAssociation";
    }

    if (parts[0] === "vpclinks") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateVpcLink";
        if (req.method === "GET") return "GetVpcLinks";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetVpcLink";
        if (req.method === "DELETE") return "DeleteVpcLink";
        if (req.method === "PATCH") return "UpdateVpcLink";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "usageplans") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateUsagePlan";
        if (req.method === "GET") return "GetUsagePlans";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetUsagePlan";
        if (req.method === "DELETE") return "DeleteUsagePlan";
        if (req.method === "PATCH") return "UpdateUsagePlan";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "keys") {
        if (req.method === "POST") return "CreateUsagePlanKey";
        if (req.method === "GET") return "GetUsagePlanKeys";
        return undefined;
      }
      if (parts.length === 4 && parts[2] === "keys") {
        if (req.method === "GET") return "GetUsagePlanKey";
        if (req.method === "DELETE") return "DeleteUsagePlanKey";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "usage") {
        if (req.method === "GET") return "GetUsage";
        return undefined;
      }
      if (
        parts.length === 4 &&
        parts[2] === "usage" &&
        req.method === "PATCH"
      ) {
        return "UpdateUsage";
      }
      return undefined;
    }

    if (parts[0] === "tags") {
      if (parts.length >= 2) {
        if (req.method === "GET") return "GetTags";
        if (req.method === "PUT") return "TagResource";
        if (req.method === "DELETE") return "UntagResource";
        return undefined;
      }
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
        if (parts.length === 3) {
          if (req.method === "POST") return "CreateAuthorizer";
          if (req.method === "GET") return "GetAuthorizers";
          return undefined;
        }
        if (parts.length === 4) {
          if (req.method === "GET") return "GetAuthorizer";
          if (req.method === "DELETE") return "DeleteAuthorizer";
          if (req.method === "PATCH") return "UpdateAuthorizer";
          if (req.method === "POST") return "TestInvokeAuthorizer";
          return undefined;
        }
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
    CreateApiKey,
    GetApiKey,
    GetApiKeys,
    DeleteApiKey,
    UpdateApiKey,
    ImportApiKeys,
    CreateAuthorizer,
    GetAuthorizer,
    GetAuthorizers,
    DeleteAuthorizer,
    UpdateAuthorizer,
    CreateBasePathMapping,
    GetBasePathMapping,
    GetBasePathMappings,
    DeleteBasePathMapping,
    UpdateBasePathMapping,
    GenerateClientCertificate,
    CreateDomainName,
    GetDomainName,
    GetDomainNames,
    DeleteDomainName,
    UpdateDomainName,
    CreateDomainNameAccessAssociation,
    GetDomainNameAccessAssociations,
    DeleteDomainNameAccessAssociation,
    RejectDomainNameAccessAssociation,
    CreateVpcLink,
    GetVpcLink,
    GetVpcLinks,
    DeleteVpcLink,
    UpdateVpcLink,
    CreateUsagePlan,
    GetUsagePlan,
    GetUsagePlans,
    DeleteUsagePlan,
    UpdateUsagePlan,
    CreateUsagePlanKey,
    GetUsagePlanKey,
    GetUsagePlanKeys,
    DeleteUsagePlanKey,
    GetUsage,
    UpdateUsage,
    GetClientCertificate,
    GetClientCertificates,
    DeleteClientCertificate,
    UpdateClientCertificate,
    GetTags,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

const missingAuthToken = (): Response =>
  new Response(JSON.stringify({ message: "Missing Authentication Token" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });

type JsonSchemaNode = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  $ref?: string;
  definitions?: Record<string, JsonSchemaNode>;
  allOf?: JsonSchemaNode[];
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
};

const validateJsonSchemaNode = (
  value: unknown,
  schema: JsonSchemaNode,
  definitions: Record<string, JsonSchemaNode>,
): boolean => {
  if (schema.$ref) {
    const refName = schema.$ref.replace("#/definitions/", "");
    const refSchema = definitions[refName];
    if (!refSchema) return true;
    return validateJsonSchemaNode(value, refSchema, definitions);
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const typeOk = types.some((t) => {
      if (t === "string") return typeof value === "string";
      if (t === "number") return typeof value === "number";
      if (t === "integer")
        return typeof value === "number" && Number.isInteger(value);
      if (t === "boolean") return typeof value === "boolean";
      if (t === "null") return value === null;
      if (t === "array") return Array.isArray(value);
      if (t === "object")
        return (
          typeof value === "object" && value !== null && !Array.isArray(value)
        );
      return true;
    });
    if (!typeOk) return false;
  }

  if (
    schema.required !== undefined &&
    typeof value === "object" &&
    value !== null
  ) {
    for (const prop of schema.required) {
      if (!(prop in (value as Record<string, unknown>))) return false;
    }
  }

  if (
    schema.properties !== undefined &&
    typeof value === "object" &&
    value !== null
  ) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const propVal = (value as Record<string, unknown>)[key];
      if (
        propVal !== undefined &&
        !validateJsonSchemaNode(propVal, propSchema, definitions)
      )
        return false;
    }
  }

  if (schema.allOf !== undefined) {
    for (const sub of schema.allOf) {
      if (!validateJsonSchemaNode(value, sub, definitions)) return false;
    }
  }

  return true;
};

const gatewayErrorResponse = (
  ctx: ServiceContext,
  restApiId: string,
  responseType: string,
  defaultStatus: number,
  defaultMessage: string,
): Response => {
  const gr = ctx.store.get<StoredGatewayResponse>(
    gatewayResponseKey(restApiId, responseType),
  );
  const fallbackType = defaultStatus < 500 ? "DEFAULT_4XX" : "DEFAULT_5XX";
  const defaultGr = ctx.store.get<StoredGatewayResponse>(
    gatewayResponseKey(restApiId, fallbackType),
  );
  const effective = gr ?? defaultGr;
  const statusCode = effective?.statusCode
    ? Number(effective.statusCode)
    : defaultStatus;
  const template = effective?.responseTemplates?.["application/json"];
  const body = template
    ? template.replace(
        /\$context\.error\.messageString/g,
        JSON.stringify(defaultMessage),
      )
    : JSON.stringify({ message: defaultMessage });
  return new Response(body, {
    status: statusCode,
    headers: { "content-type": "application/json" },
  });
};

const enforceRequestValidation = (
  ctx: ServiceContext,
  restApiId: string,
  method: StoredMethod,
  bodyText: string,
  pathParams: Record<string, string>,
  url: URL,
  req: Request,
): Response | undefined => {
  if (!method.requestValidatorId) return undefined;
  const validator = ctx.store.get<StoredRequestValidator>(
    requestValidatorKey(restApiId, method.requestValidatorId),
  );
  if (!validator) return undefined;

  if (validator.validateRequestParameters && method.requestParameters) {
    const missing: string[] = [];
    for (const [key, required] of Object.entries(method.requestParameters)) {
      if (!required) continue;
      const parts = key.split(".");
      const location = parts[2];
      const name = parts[3];
      if (!location || !name) continue;
      if (location === "querystring") {
        if (!url.searchParams.has(name)) missing.push(name);
      } else if (location === "header") {
        if (!req.headers.has(name)) missing.push(name);
      } else if (location === "path") {
        if (!(name in pathParams)) missing.push(name);
      }
    }
    if (missing.length > 0) {
      return gatewayErrorResponse(
        ctx,
        restApiId,
        "BAD_REQUEST_PARAMETERS",
        400,
        `Missing required request parameters: [${missing.join(", ")}]`,
      );
    }
  }

  if (validator.validateRequestBody && method.requestModels) {
    const rawCt =
      req.headers.get("content-type") ?? req.headers.get("Content-Type");
    const contentType = rawCt ? rawCt.split(";")[0].trim() : "application/json";
    const modelName =
      method.requestModels[contentType] ??
      method.requestModels["application/json"];
    if (modelName) {
      const model = ctx.store.get<StoredModel>(modelKey(restApiId, modelName));
      if (model?.schema) {
        try {
          const body: unknown = bodyText ? JSON.parse(bodyText) : {};
          const schemaObj = JSON.parse(model.schema) as JsonSchemaNode;
          const defs = schemaObj.definitions ?? {};
          if (!validateJsonSchemaNode(body, schemaObj, defs)) {
            return gatewayErrorResponse(
              ctx,
              restApiId,
              "BAD_REQUEST_BODY",
              400,
              "Invalid request body",
            );
          }
        } catch {
          return gatewayErrorResponse(
            ctx,
            restApiId,
            "BAD_REQUEST_BODY",
            400,
            "Invalid request body",
          );
        }
      }
    }
  }

  return undefined;
};

const lambdaArnFromUri = (uri: string): string | undefined => {
  const match = uri.match(
    /arn:aws:apigateway:[^:]+:lambda:path\/[^/]+\/functions\/([^/]+)\/invocations/,
  );
  return match?.[1];
};

const extractIdentityToken = (
  identitySource: string | undefined,
  req: Request,
  url: URL,
): string | undefined => {
  if (!identitySource) return undefined;
  const parts = identitySource.split(".");
  const location = parts[2];
  const name = parts[3];
  if (!location || !name) return undefined;
  if (location === "header")
    return (
      req.headers.get(name) ?? req.headers.get(name.toLowerCase()) ?? undefined
    );
  if (location === "querystring")
    return url.searchParams.get(name) ?? undefined;
  return undefined;
};

const enforceAuthorizer = async (
  ctx: ServiceContext,
  restApiId: string,
  authorizer: StoredAuthorizer,
  req: Request,
  url: URL,
): Promise<Response | undefined> => {
  if (authorizer.type === "COGNITO_USER_POOLS") {
    const token =
      req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!token) {
      return gatewayErrorResponse(
        ctx,
        restApiId,
        "UNAUTHORIZED",
        401,
        "Unauthorized",
      );
    }
    return undefined;
  }

  const token = extractIdentityToken(authorizer.identitySource, req, url);
  if (!token) {
    return gatewayErrorResponse(
      ctx,
      restApiId,
      "UNAUTHORIZED",
      401,
      "Unauthorized",
    );
  }

  if (authorizer.authorizerUri) {
    const functionArn = lambdaArnFromUri(authorizer.authorizerUri);
    if (functionArn) {
      const headersMap: Record<string, string> = {};
      req.headers.forEach((v, k) => {
        headersMap[k] = v;
      });
      const queryMap: Record<string, string> = {};
      url.searchParams.forEach((v, k) => {
        queryMap[k] = v;
      });
      const event =
        authorizer.type === "TOKEN"
          ? {
              authorizationToken: token,
              methodArn: `arn:aws:execute-api:${ctx.region}:${ctx.account}:${restApiId}/*`,
            }
          : {
              headers: headersMap,
              queryStringParameters: queryMap,
              pathParameters: {} as Record<string, string>,
              requestContext: { stage: "" },
            };
      const result = await invokeTaskResource(ctx, functionArn, event);
      if (!result.ok) {
        return gatewayErrorResponse(
          ctx,
          restApiId,
          "ACCESS_DENIED",
          403,
          "User is not authorized to access this resource with an explicit deny",
        );
      }
      const policy = result.result as {
        policyDocument?: { Statement?: Array<{ Effect?: string }> };
      };
      const hasAllow =
        policy?.policyDocument?.Statement?.some((s) => s.Effect === "Allow") ??
        false;
      if (!hasAllow) {
        return gatewayErrorResponse(
          ctx,
          restApiId,
          "ACCESS_DENIED",
          403,
          "User is not authorized to access this resource with an explicit deny",
        );
      }
    }
  }

  return undefined;
};

const matchResourcePath = (
  pattern: string,
  incoming: string,
): Record<string, string> | undefined => {
  const patternParts = pattern.split("/").filter(Boolean);
  const incomingParts = incoming.split("/").filter(Boolean);

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const seg = patternParts[i];
    if (seg === undefined) return undefined;

    if (seg.endsWith("+}") && seg.startsWith("{")) {
      const name = seg.slice(1, -2);
      params[name] = incomingParts.slice(i).join("/");
      return params;
    }

    if (i >= incomingParts.length) return undefined;
    const inc = incomingParts[i];
    if (inc === undefined) return undefined;

    if (seg.startsWith("{") && seg.endsWith("}")) {
      params[seg.slice(1, -1)] = inc;
    } else if (seg !== inc) {
      return undefined;
    }
  }

  if (incomingParts.length !== patternParts.length) return undefined;
  return params;
};

const findResourceMatch = (
  resources: { key: string; value: StoredResource }[],
  resourcePath: string,
): { resource: StoredResource; params: Record<string, string> } | undefined => {
  let greedy:
    | { resource: StoredResource; params: Record<string, string> }
    | undefined;
  for (const entry of resources) {
    const pattern = entry.value.path;
    const params = matchResourcePath(pattern, resourcePath);
    if (params === undefined) continue;
    const isGreedy = pattern.includes("{") && pattern.endsWith("+}");
    if (isGreedy) {
      greedy = { resource: entry.value, params };
    } else {
      return { resource: entry.value, params };
    }
  }
  return greedy;
};

const applyVtl = (
  template: string,
  body: string,
  pathParams: Record<string, string>,
  queryParams: Record<string, string>,
  headerParams: Record<string, string>,
  stageVars: Record<string, string>,
): string => {
  let result = template;
  result = result.replace(
    /\$\{stageVariables\.([a-zA-Z0-9_]+)\}/g,
    (_, k: string) => stageVars[k] ?? "",
  );
  result = result.replace(
    /\$stageVariables\.([a-zA-Z0-9_]+)/g,
    (_, k: string) => stageVars[k] ?? "",
  );
  result = result.replace(
    /\$input\.json\(['"]?\$['"]?\)/g,
    () => body || "null",
  );
  result = result.replace(
    /\$input\.params\(['"]([^'"]+)['"]\)/g,
    (_, k: string) => pathParams[k] ?? queryParams[k] ?? headerParams[k] ?? "",
  );
  return result;
};

const mockStatusFromTemplate = (
  integration: StoredIntegration,
  contentType: string,
): number => {
  const tpl =
    integration.requestTemplates?.[contentType] ??
    integration.requestTemplates?.["application/json"];
  if (!tpl) return 200;
  try {
    const parsed = JSON.parse(tpl) as { statusCode?: number };
    return typeof parsed.statusCode === "number" ? parsed.statusCode : 200;
  } catch {
    return 200;
  }
};

const pickIntegrationResponse = (
  responses: { key: string; value: StoredIntegrationResponse }[],
  outputStr: string,
): StoredIntegrationResponse | undefined => {
  for (const { value } of responses) {
    const pattern = value.selectionPattern;
    if (!pattern) continue;
    try {
      if (new RegExp(pattern).test(outputStr)) return value;
    } catch {
      /* ignore invalid regex */
    }
  }
  return responses.find(({ value }) => !value.selectionPattern)?.value;
};

const dispatchMockIntegration = (
  ctx: ServiceContext,
  restApiId: string,
  resourceId: string,
  httpMethod: string,
  integration: StoredIntegration,
  stage: StoredStage,
  body: string,
  pathParams: Record<string, string>,
  url: URL,
  req: Request,
): Response => {
  const contentType = req.headers.get("content-type") ?? "application/json";
  const stageVars = stage.variables ?? {};

  const mockStatus = mockStatusFromTemplate(integration, contentType);
  const mockStatusStr = String(mockStatus);

  const responses = ctx.store
    .list<StoredIntegrationResponse>()
    .filter((e) =>
      e.key.startsWith(
        `integrationresponse/${restApiId}/${resourceId}/${httpMethod}/`,
      ),
    );

  const ir = pickIntegrationResponse(responses, mockStatusStr);

  if (ir === undefined) {
    return new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const statusCode = Number(ir.statusCode) || 200;
  const rawTemplate = ir.responseTemplates?.["application/json"] ?? "{}";

  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const headerParams: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headerParams[key] = value;
  });

  const responseBody = applyVtl(
    rawTemplate,
    body,
    pathParams,
    queryParams,
    headerParams,
    stageVars,
  );

  return new Response(responseBody, {
    status: statusCode,
    headers: { "content-type": "application/json" },
  });
};

const dispatchLambdaProxy = async (
  req: Request,
  url: URL,
  bodyText: string,
  stageName: string,
  stage: StoredStage,
  integration: StoredIntegration,
  ctx: ServiceContext,
): Promise<Response> => {
  const functionArn = integration.uri
    ? lambdaArnFromUri(integration.uri)
    : undefined;
  if (functionArn === undefined) return missingAuthToken();

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const event = {
    version: "1.0",
    resource: url.pathname,
    path: url.pathname,
    httpMethod: req.method,
    headers,
    queryStringParameters:
      Object.keys(queryParams).length > 0 ? queryParams : null,
    pathParameters: null,
    stageVariables: stage.variables ?? null,
    requestContext: {
      stage: stageName,
      resourcePath: url.pathname,
      httpMethod: req.method,
    },
    body: bodyText || null,
    isBase64Encoded: false,
  };

  const result = await invokeTaskResource(ctx, functionArn, event);

  if (!result.ok) {
    return new Response(JSON.stringify({ message: "Internal server error" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const lambdaResult = result.result as {
    statusCode?: number;
    headers?: Record<string, string>;
    body?: string;
    isBase64Encoded?: boolean;
  };

  const status = lambdaResult.statusCode ?? 200;
  const responseBody = lambdaResult.body ?? "";
  const responseHeaders = new Headers({
    "content-type": "application/json",
    ...((lambdaResult.headers as Record<string, string>) ?? {}),
  });

  return new Response(responseBody, { status, headers: responseHeaders });
};

export const handleExecuteApi = async (
  req: Request,
  url: URL,
  store: StateStore,
  account: string,
  region: string,
): Promise<Response | undefined> => {
  const rawHost = req.headers.get("host") ?? url.hostname;
  const hostname = rawHost.split(":")[0];
  const hostParts = hostname.split(".");
  if (hostParts[1] !== "execute-api") return undefined;

  const restApiId = hostParts[0];
  if (!restApiId) return undefined;

  const ctx: ServiceContext = {
    store: scopedStore(store, { account, region, service: "apigateway" }),
    account,
    region,
    storeFor: (svc: string) =>
      scopedStore(store, { account, region, service: svc }),
  };

  const pathParts = url.pathname.split("/").filter(Boolean);
  if (pathParts.length === 0) return missingAuthToken();

  const stageName = pathParts[0];
  const resourcePath = "/" + pathParts.slice(1).join("/");

  const api = ctx.store.get<StoredRestApi>(restApiKey(restApiId));
  if (api === undefined) return missingAuthToken();

  const stage = ctx.store.get<StoredStage>(stageKey(restApiId, stageName));
  if (stage === undefined) return missingAuthToken();

  const allResources = ctx.store
    .list<StoredResource>()
    .filter((e) => e.key.startsWith(`resource/${restApiId}/`));

  const match = findResourceMatch(allResources, resourcePath);
  if (match === undefined) return missingAuthToken();

  const method = ctx.store.get<StoredMethod>(
    methodKey(restApiId, match.resource.id, req.method),
  );
  if (method === undefined) return missingAuthToken();

  if (
    (method.authorizationType === "CUSTOM" ||
      method.authorizationType === "COGNITO_USER_POOLS") &&
    method.authorizerId
  ) {
    const authorizer = ctx.store.get<StoredAuthorizer>(
      authorizerKey(restApiId, method.authorizerId),
    );
    if (authorizer) {
      const authError = await enforceAuthorizer(
        ctx,
        restApiId,
        authorizer,
        req,
        url,
      );
      if (authError !== undefined) return authError;
    }
  }

  const integration = ctx.store.get<StoredIntegration>(
    integrationKey(restApiId, match.resource.id, req.method),
  );
  if (integration === undefined) return missingAuthToken();

  const bodyBytes = new Uint8Array(await req.arrayBuffer());
  const bodyText = new TextDecoder().decode(bodyBytes);

  if (method.requestValidatorId) {
    const validationError = enforceRequestValidation(
      ctx,
      restApiId,
      method,
      bodyText,
      match.params,
      url,
      req,
    );
    if (validationError !== undefined) return validationError;
  }

  if (integration.type === "MOCK") {
    return dispatchMockIntegration(
      ctx,
      restApiId,
      match.resource.id,
      req.method,
      integration,
      stage,
      bodyText,
      match.params,
      url,
      req,
    );
  }

  if (integration.type === "AWS_PROXY") {
    return dispatchLambdaProxy(
      req,
      url,
      bodyText,
      stageName,
      stage,
      integration,
      ctx,
    );
  }

  return missingAuthToken();
};

export default apigateway;
