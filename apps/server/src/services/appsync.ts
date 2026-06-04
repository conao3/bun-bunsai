import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import appsyncModel from "../../../../test/vendor/aws-models/appsync.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(appsyncModel);

const apiPrefix = "api:" as const;
const keyPrefix = "apikey:" as const;
const dsPrefix = "ds:" as const;
const rsPrefix = "rs:" as const;
const fnPrefix = "fn:" as const;
const tpPrefix = "tp:" as const;
const acPrefix = "ac:" as const;
const dnPrefix = "dn:" as const;
const aaPrefix = "aa:" as const;
const eaPrefix = "ea:" as const;
const cnPrefix = "cn:" as const;
const tgPrefix = "tg:" as const;
const evPrefix = "ev:" as const;
const saPrefix = "sa:" as const;

type StoredApiKey = {
  id: string;
  description: string | undefined;
  expires: number;
  deletes: number;
};

type StoredApi = {
  apiId: string;
  name: string;
  authenticationType: string;
  arn: string;
  uris: Record<string, string>;
  tags: Record<string, unknown> | undefined;
  xrayEnabled: boolean;
  visibility: string;
  apiType: string;
  owner: string;
  logConfig: Record<string, unknown> | undefined;
  userPoolConfig: Record<string, unknown> | undefined;
  openIDConnectConfig: Record<string, unknown> | undefined;
  lambdaAuthorizerConfig: Record<string, unknown> | undefined;
  additionalAuthenticationProviders: unknown[] | undefined;
};

type StoredDataSource = {
  name: string;
  description: string | undefined;
  type: string;
  serviceRoleArn: string | undefined;
  dataSourceArn: string;
  dynamodbConfig: Record<string, unknown> | undefined;
  lambdaConfig: Record<string, unknown> | undefined;
  elasticsearchConfig: Record<string, unknown> | undefined;
  openSearchServiceConfig: Record<string, unknown> | undefined;
  httpConfig: Record<string, unknown> | undefined;
  relationalDatabaseConfig: Record<string, unknown> | undefined;
  eventBridgeConfig: Record<string, unknown> | undefined;
  metricsConfig: string | undefined;
};

type StoredResolver = {
  typeName: string;
  fieldName: string;
  dataSourceName: string | undefined;
  resolverArn: string;
  requestMappingTemplate: string | undefined;
  responseMappingTemplate: string | undefined;
  kind: string | undefined;
  pipelineConfig: Record<string, unknown> | undefined;
  syncConfig: Record<string, unknown> | undefined;
  cachingConfig: Record<string, unknown> | undefined;
  maxBatchSize: number | undefined;
  runtime: Record<string, unknown> | undefined;
  code: string | undefined;
  metricsConfig: string | undefined;
};

type StoredFunction = {
  functionId: string;
  functionArn: string;
  name: string;
  description: string | undefined;
  dataSourceName: string;
  requestMappingTemplate: string | undefined;
  responseMappingTemplate: string | undefined;
  functionVersion: string | undefined;
  syncConfig: Record<string, unknown> | undefined;
  maxBatchSize: number | undefined;
  runtime: Record<string, unknown> | undefined;
  code: string | undefined;
};

type StoredType = {
  name: string;
  description: string | undefined;
  arn: string;
  definition: string | undefined;
  format: string;
};

type StoredApiCache = {
  ttl: number;
  apiCachingBehavior: string;
  transitEncryptionEnabled: boolean | undefined;
  atRestEncryptionEnabled: boolean | undefined;
  type: string;
  status: string;
  healthMetricsConfig: string | undefined;
};

type StoredDomainName = {
  domainName: string;
  description: string | undefined;
  certificateArn: string;
  appsyncDomainName: string;
  hostedZoneId: string;
  domainNameArn: string;
  tags: Record<string, unknown> | undefined;
};

type StoredApiAssociation = {
  domainName: string;
  apiId: string;
  associationStatus: string;
  deploymentDetail: string | undefined;
};

type StoredEventApi = {
  apiId: string;
  name: string;
  ownerContact: string | undefined;
  tags: Record<string, unknown> | undefined;
  dns: Record<string, string>;
  apiArn: string;
  created: string;
  xrayEnabled: boolean;
  wafWebAclArn: string | undefined;
  eventConfig: Record<string, unknown> | undefined;
};

type StoredChannelNamespace = {
  apiId: string;
  name: string;
  subscribeAuthModes: unknown[] | undefined;
  publishAuthModes: unknown[] | undefined;
  codeHandlers: string | undefined;
  tags: Record<string, unknown> | undefined;
  channelNamespaceArn: string;
  created: string;
  lastModified: string;
  handlerConfigs: unknown[] | undefined;
};

type StoredSourceApiAssociation = {
  associationId: string;
  associationArn: string;
  sourceApiId: string;
  sourceApiArn: string;
  mergedApiArn: string;
  mergedApiId: string;
  description: string | undefined;
  sourceApiAssociationConfig: Record<string, unknown> | undefined;
  sourceApiAssociationStatus: string;
  sourceApiAssociationStatusDetail: string | undefined;
  lastSuccessfulMergeDate: string | undefined;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const booleanOrUndefined = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const arrayOrUndefined = (value: unknown): unknown[] | undefined =>
  Array.isArray(value) ? value : undefined;

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

const apiKey = (apiId: string): string => `${apiPrefix}${apiId}`;
const keyKey = (apiId: string, id: string): string =>
  `${keyPrefix}${apiId}/${id}`;
const dsKey = (apiId: string, name: string): string =>
  `${dsPrefix}${apiId}:${name}`;
const rsKey = (apiId: string, typeName: string, fieldName: string): string =>
  `${rsPrefix}${apiId}:${typeName}:${fieldName}`;
const fnKey = (apiId: string, functionId: string): string =>
  `${fnPrefix}${apiId}:${functionId}`;
const tpKey = (apiId: string, typeName: string): string =>
  `${tpPrefix}${apiId}:${typeName}`;
const acKey = (apiId: string): string => `${acPrefix}${apiId}`;
const dnKey = (domainName: string): string => `${dnPrefix}${domainName}`;
const aaKey = (domainName: string): string => `${aaPrefix}${domainName}`;
const eaKey = (apiId: string): string => `${eaPrefix}${apiId}`;
const cnKey = (apiId: string, name: string): string =>
  `${cnPrefix}${apiId}:${name}`;
const tgKey = (resourceArn: string): string => `${tgPrefix}${resourceArn}`;
const evKey = (apiId: string): string => `${evPrefix}${apiId}`;
const saKey = (associationId: string): string => `${saPrefix}${associationId}`;

const apiArn = (ctx: ServiceContext, apiId: string): string =>
  `arn:aws:appsync:${ctx.region}:${ctx.account}:apis/${apiId}`;

const randomId = (): string =>
  Array.from({ length: 26 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789".charAt(
      Math.floor(Math.random() * 36),
    ),
  ).join("");

const isoNow = (): string => new Date().toISOString();

const apiUris = (
  apiId: string,
  ctx: ServiceContext,
): Record<string, string> => ({
  GRAPHQL: `https://${apiId}.appsync-api.${ctx.region}.amazonaws.com/graphql`,
  REALTIME: `wss://${apiId}.appsync-realtime-api.${ctx.region}.amazonaws.com/graphql`,
});

const apiView = (api: StoredApi): Record<string, unknown> => ({
  apiId: api.apiId,
  name: api.name,
  authenticationType: api.authenticationType,
  arn: api.arn,
  uris: api.uris,
  tags: api.tags,
  xrayEnabled: api.xrayEnabled,
  visibility: api.visibility,
  apiType: api.apiType,
  owner: api.owner,
  logConfig: api.logConfig,
  userPoolConfig: api.userPoolConfig,
  openIDConnectConfig: api.openIDConnectConfig,
  lambdaAuthorizerConfig: api.lambdaAuthorizerConfig,
  additionalAuthenticationProviders: api.additionalAuthenticationProviders,
});

const keyView = (key: StoredApiKey): Record<string, unknown> => ({
  id: key.id,
  description: key.description,
  expires: key.expires,
  deletes: key.deletes,
});

const dsView = (ds: StoredDataSource): Record<string, unknown> => ({
  name: ds.name,
  description: ds.description,
  type: ds.type,
  serviceRoleArn: ds.serviceRoleArn,
  dataSourceArn: ds.dataSourceArn,
  dynamodbConfig: ds.dynamodbConfig,
  lambdaConfig: ds.lambdaConfig,
  elasticsearchConfig: ds.elasticsearchConfig,
  openSearchServiceConfig: ds.openSearchServiceConfig,
  httpConfig: ds.httpConfig,
  relationalDatabaseConfig: ds.relationalDatabaseConfig,
  eventBridgeConfig: ds.eventBridgeConfig,
  metricsConfig: ds.metricsConfig,
});

const rsView = (rs: StoredResolver): Record<string, unknown> => ({
  typeName: rs.typeName,
  fieldName: rs.fieldName,
  dataSourceName: rs.dataSourceName,
  resolverArn: rs.resolverArn,
  requestMappingTemplate: rs.requestMappingTemplate,
  responseMappingTemplate: rs.responseMappingTemplate,
  kind: rs.kind,
  pipelineConfig: rs.pipelineConfig,
  syncConfig: rs.syncConfig,
  cachingConfig: rs.cachingConfig,
  maxBatchSize: rs.maxBatchSize,
  runtime: rs.runtime,
  code: rs.code,
  metricsConfig: rs.metricsConfig,
});

const fnView = (fn: StoredFunction): Record<string, unknown> => ({
  functionId: fn.functionId,
  functionArn: fn.functionArn,
  name: fn.name,
  description: fn.description,
  dataSourceName: fn.dataSourceName,
  requestMappingTemplate: fn.requestMappingTemplate,
  responseMappingTemplate: fn.responseMappingTemplate,
  functionVersion: fn.functionVersion,
  syncConfig: fn.syncConfig,
  maxBatchSize: fn.maxBatchSize,
  runtime: fn.runtime,
  code: fn.code,
});

const tpView = (tp: StoredType): Record<string, unknown> => ({
  name: tp.name,
  description: tp.description,
  arn: tp.arn,
  definition: tp.definition,
  format: tp.format,
});

const acView = (ac: StoredApiCache): Record<string, unknown> => ({
  ttl: ac.ttl,
  apiCachingBehavior: ac.apiCachingBehavior,
  transitEncryptionEnabled: ac.transitEncryptionEnabled,
  atRestEncryptionEnabled: ac.atRestEncryptionEnabled,
  type: ac.type,
  status: ac.status,
  healthMetricsConfig: ac.healthMetricsConfig,
});

const dnView = (dn: StoredDomainName): Record<string, unknown> => ({
  domainName: dn.domainName,
  description: dn.description,
  certificateArn: dn.certificateArn,
  appsyncDomainName: dn.appsyncDomainName,
  hostedZoneId: dn.hostedZoneId,
  domainNameArn: dn.domainNameArn,
  tags: dn.tags,
});

const aaView = (aa: StoredApiAssociation): Record<string, unknown> => ({
  domainName: aa.domainName,
  apiId: aa.apiId,
  associationStatus: aa.associationStatus,
  deploymentDetail: aa.deploymentDetail,
});

const eaView = (ea: StoredEventApi): Record<string, unknown> => ({
  apiId: ea.apiId,
  name: ea.name,
  ownerContact: ea.ownerContact,
  tags: ea.tags,
  dns: ea.dns,
  apiArn: ea.apiArn,
  created: ea.created,
  xrayEnabled: ea.xrayEnabled,
  wafWebAclArn: ea.wafWebAclArn,
  eventConfig: ea.eventConfig,
});

const cnView = (cn: StoredChannelNamespace): Record<string, unknown> => ({
  apiId: cn.apiId,
  name: cn.name,
  subscribeAuthModes: cn.subscribeAuthModes,
  publishAuthModes: cn.publishAuthModes,
  codeHandlers: cn.codeHandlers,
  tags: cn.tags,
  channelNamespaceArn: cn.channelNamespaceArn,
  created: cn.created,
  lastModified: cn.lastModified,
  handlerConfigs: cn.handlerConfigs,
});

const saView = (sa: StoredSourceApiAssociation): Record<string, unknown> => ({
  associationId: sa.associationId,
  associationArn: sa.associationArn,
  sourceApiId: sa.sourceApiId,
  sourceApiArn: sa.sourceApiArn,
  mergedApiArn: sa.mergedApiArn,
  mergedApiId: sa.mergedApiId,
  description: sa.description,
  sourceApiAssociationConfig: sa.sourceApiAssociationConfig,
  sourceApiAssociationStatus: sa.sourceApiAssociationStatus,
  sourceApiAssociationStatusDetail: sa.sourceApiAssociationStatusDetail,
  lastSuccessfulMergeDate: sa.lastSuccessfulMergeDate,
});

const requireApi = (ctx: ServiceContext, apiId: string): StoredApi => {
  const api = ctx.store.get<StoredApi>(apiKey(apiId));
  if (api === undefined) {
    throw awsError("NotFoundException", `GraphQL API ${apiId} not found.`, 404);
  }
  return api;
};

const requireEventApi = (
  ctx: ServiceContext,
  apiId: string,
): StoredEventApi => {
  const api = ctx.store.get<StoredEventApi>(eaKey(apiId));
  if (api === undefined) {
    throw awsError("NotFoundException", `API ${apiId} not found.`, 404);
  }
  return api;
};

const requireDataSource = (
  ctx: ServiceContext,
  apiId: string,
  name: string,
): StoredDataSource => {
  const ds = ctx.store.get<StoredDataSource>(dsKey(apiId, name));
  if (ds === undefined) {
    throw awsError("NotFoundException", `DataSource ${name} not found.`, 404);
  }
  return ds;
};

const requireResolver = (
  ctx: ServiceContext,
  apiId: string,
  typeName: string,
  fieldName: string,
): StoredResolver => {
  const rs = ctx.store.get<StoredResolver>(rsKey(apiId, typeName, fieldName));
  if (rs === undefined) {
    throw awsError(
      "NotFoundException",
      `Resolver ${typeName}.${fieldName} not found.`,
      404,
    );
  }
  return rs;
};

const requireFunction = (
  ctx: ServiceContext,
  apiId: string,
  functionId: string,
): StoredFunction => {
  const fn = ctx.store.get<StoredFunction>(fnKey(apiId, functionId));
  if (fn === undefined) {
    throw awsError(
      "NotFoundException",
      `Function ${functionId} not found.`,
      404,
    );
  }
  return fn;
};

const requireType = (
  ctx: ServiceContext,
  apiId: string,
  typeName: string,
): StoredType => {
  const tp = ctx.store.get<StoredType>(tpKey(apiId, typeName));
  if (tp === undefined) {
    throw awsError("NotFoundException", `Type ${typeName} not found.`, 404);
  }
  return tp;
};

const requireApiCache = (
  ctx: ServiceContext,
  apiId: string,
): StoredApiCache => {
  const ac = ctx.store.get<StoredApiCache>(acKey(apiId));
  if (ac === undefined) {
    throw awsError(
      "NotFoundException",
      `ApiCache for ${apiId} not found.`,
      404,
    );
  }
  return ac;
};

const requireDomainName = (
  ctx: ServiceContext,
  domainName: string,
): StoredDomainName => {
  const dn = ctx.store.get<StoredDomainName>(dnKey(domainName));
  if (dn === undefined) {
    throw awsError(
      "NotFoundException",
      `Domain name ${domainName} not found.`,
      404,
    );
  }
  return dn;
};

const requireApiAssociation = (
  ctx: ServiceContext,
  domainName: string,
): StoredApiAssociation => {
  const aa = ctx.store.get<StoredApiAssociation>(aaKey(domainName));
  if (aa === undefined) {
    throw awsError(
      "NotFoundException",
      `ApiAssociation for ${domainName} not found.`,
      404,
    );
  }
  return aa;
};

const requireChannelNamespace = (
  ctx: ServiceContext,
  apiId: string,
  name: string,
): StoredChannelNamespace => {
  const cn = ctx.store.get<StoredChannelNamespace>(cnKey(apiId, name));
  if (cn === undefined) {
    throw awsError(
      "NotFoundException",
      `ChannelNamespace ${name} not found.`,
      404,
    );
  }
  return cn;
};

const requireSourceApiAssociation = (
  ctx: ServiceContext,
  associationId: string,
): StoredSourceApiAssociation => {
  const sa = ctx.store.get<StoredSourceApiAssociation>(saKey(associationId));
  if (sa === undefined) {
    throw awsError(
      "NotFoundException",
      `SourceApiAssociation ${associationId} not found.`,
      404,
    );
  }
  return sa;
};

const buildApi = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
  apiId: string,
): StoredApi => ({
  apiId,
  name: requireString(input, "name"),
  authenticationType: requireString(input, "authenticationType"),
  arn: apiArn(ctx, apiId),
  uris: apiUris(apiId, ctx),
  tags: recordOrUndefined(input["tags"]),
  xrayEnabled: input["xrayEnabled"] === true,
  visibility: stringOrUndefined(input["visibility"]) ?? "GLOBAL",
  apiType: stringOrUndefined(input["apiType"]) ?? "GRAPHQL",
  owner: ctx.account,
  logConfig: recordOrUndefined(input["logConfig"]),
  userPoolConfig: recordOrUndefined(input["userPoolConfig"]),
  openIDConnectConfig: recordOrUndefined(input["openIDConnectConfig"]),
  lambdaAuthorizerConfig: recordOrUndefined(input["lambdaAuthorizerConfig"]),
  additionalAuthenticationProviders: arrayOrUndefined(
    input["additionalAuthenticationProviders"],
  ),
});

const buildDataSource = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
  apiId: string,
): StoredDataSource => ({
  name: requireString(input, "name"),
  description: stringOrUndefined(input["description"]),
  type: requireString(input, "type"),
  serviceRoleArn: stringOrUndefined(input["serviceRoleArn"]),
  dataSourceArn: `arn:aws:appsync:${ctx.region}:${ctx.account}:apis/${apiId}/datasources/${input["name"]}`,
  dynamodbConfig: recordOrUndefined(input["dynamodbConfig"]),
  lambdaConfig: recordOrUndefined(input["lambdaConfig"]),
  elasticsearchConfig: recordOrUndefined(input["elasticsearchConfig"]),
  openSearchServiceConfig: recordOrUndefined(input["openSearchServiceConfig"]),
  httpConfig: recordOrUndefined(input["httpConfig"]),
  relationalDatabaseConfig: recordOrUndefined(
    input["relationalDatabaseConfig"],
  ),
  eventBridgeConfig: recordOrUndefined(input["eventBridgeConfig"]),
  metricsConfig: stringOrUndefined(input["metricsConfig"]),
});

const buildResolver = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
  apiId: string,
  typeName: string,
): StoredResolver => ({
  typeName,
  fieldName: requireString(input, "fieldName"),
  dataSourceName: stringOrUndefined(input["dataSourceName"]),
  resolverArn: `arn:aws:appsync:${ctx.region}:${ctx.account}:apis/${apiId}/types/${typeName}/resolvers/${input["fieldName"]}`,
  requestMappingTemplate: stringOrUndefined(input["requestMappingTemplate"]),
  responseMappingTemplate: stringOrUndefined(input["responseMappingTemplate"]),
  kind: stringOrUndefined(input["kind"]),
  pipelineConfig: recordOrUndefined(input["pipelineConfig"]),
  syncConfig: recordOrUndefined(input["syncConfig"]),
  cachingConfig: recordOrUndefined(input["cachingConfig"]),
  maxBatchSize: numberOrUndefined(input["maxBatchSize"]),
  runtime: recordOrUndefined(input["runtime"]),
  code: stringOrUndefined(input["code"]),
  metricsConfig: stringOrUndefined(input["metricsConfig"]),
});

const buildFunction = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
  apiId: string,
  functionId: string,
): StoredFunction => ({
  functionId,
  functionArn: `arn:aws:appsync:${ctx.region}:${ctx.account}:apis/${apiId}/functions/${functionId}`,
  name: requireString(input, "name"),
  description: stringOrUndefined(input["description"]),
  dataSourceName: requireString(input, "dataSourceName"),
  requestMappingTemplate: stringOrUndefined(input["requestMappingTemplate"]),
  responseMappingTemplate: stringOrUndefined(input["responseMappingTemplate"]),
  functionVersion: stringOrUndefined(input["functionVersion"]),
  syncConfig: recordOrUndefined(input["syncConfig"]),
  maxBatchSize: numberOrUndefined(input["maxBatchSize"]),
  runtime: recordOrUndefined(input["runtime"]),
  code: stringOrUndefined(input["code"]),
});

const parseTypeName = (definition: string): string => {
  const m = /\b(?:type|interface|enum|union|input|scalar)\s+(\w+)/.exec(
    definition,
  );
  return m ? m[1] : "UnknownType";
};

const buildType = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
  apiId: string,
  typeName?: string,
): StoredType => {
  const name =
    typeName ??
    parseTypeName(stringOrUndefined(input["definition"]) ?? "") ??
    requireString(input, "name");
  return {
    name,
    description: stringOrUndefined(input["description"]),
    arn: `arn:aws:appsync:${ctx.region}:${ctx.account}:apis/${apiId}/types/${name}`,
    definition: stringOrUndefined(input["definition"]),
    format: requireString(input, "format"),
  };
};

const CreateGraphqlApi: OperationHandler = (input, ctx) => {
  const apiId = randomId();
  const api = buildApi(input, ctx, apiId);
  ctx.store.set(apiKey(apiId), api);
  return { graphqlApi: apiView(api) };
};

const GetGraphqlApi: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  return { graphqlApi: apiView(requireApi(ctx, apiId)) };
};

const ListGraphqlApis: OperationHandler = (input, ctx) => {
  const apiType = stringOrUndefined(input["apiType"]);
  const max = numberOrUndefined(input["maxResults"]) ?? 25;
  const apis = ctx.store
    .list<StoredApi>()
    .filter((entry) => entry.key.startsWith(apiPrefix))
    .map((entry) => entry.value)
    .filter((api) => apiType === undefined || api.apiType === apiType)
    .sort((a, b) => (a.apiId < b.apiId ? -1 : a.apiId > b.apiId ? 1 : 0));
  return { graphqlApis: apis.slice(0, max).map(apiView) };
};

const UpdateGraphqlApi: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const existing = requireApi(ctx, apiId);
  const api: StoredApi = {
    ...buildApi(input, ctx, apiId),
    arn: existing.arn,
    uris: existing.uris,
    owner: existing.owner,
    tags: existing.tags,
  };
  ctx.store.set(apiKey(apiId), api);
  return { graphqlApi: apiView(api) };
};

const DeleteGraphqlApi: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  ctx.store
    .list<StoredApiKey>()
    .filter((entry) => entry.key.startsWith(`${keyPrefix}${apiId}/`))
    .forEach((entry) => ctx.store.delete(entry.key));
  ctx.store.delete(apiKey(apiId));
  return {};
};

const CreateApiKey: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  const now = Math.floor(Date.now() / 1000);
  const expires = numberOrUndefined(input["expires"]) ?? now + 7 * 24 * 60 * 60;
  const key: StoredApiKey = {
    id: `da2-${randomId()}`,
    description: stringOrUndefined(input["description"]),
    expires,
    deletes: expires + 24 * 60 * 60,
  };
  ctx.store.set(keyKey(apiId, key.id), key);
  return { apiKey: keyView(key) };
};

const ListApiKeys: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  const max = numberOrUndefined(input["maxResults"]) ?? 25;
  const keys = ctx.store
    .list<StoredApiKey>()
    .filter((entry) => entry.key.startsWith(`${keyPrefix}${apiId}/`))
    .map((entry) => entry.value)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { apiKeys: keys.slice(0, max).map(keyView) };
};

const UpdateApiKey: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const id = requireString(input, "id");
  requireApi(ctx, apiId);
  const existing = ctx.store.get<StoredApiKey>(keyKey(apiId, id));
  if (existing === undefined) {
    throw awsError("NotFoundException", `ApiKey ${id} not found.`, 404);
  }
  const updated: StoredApiKey = {
    ...existing,
    description:
      stringOrUndefined(input["description"]) ?? existing.description,
    expires: numberOrUndefined(input["expires"]) ?? existing.expires,
    deletes:
      (numberOrUndefined(input["expires"]) ?? existing.expires) + 24 * 60 * 60,
  };
  ctx.store.set(keyKey(apiId, id), updated);
  return { apiKey: keyView(updated) };
};

const DeleteApiKey: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const id = requireString(input, "id");
  requireApi(ctx, apiId);
  if (ctx.store.get(keyKey(apiId, id)) === undefined) {
    throw awsError("NotFoundException", `ApiKey ${id} not found.`, 404);
  }
  ctx.store.delete(keyKey(apiId, id));
  return {};
};

const CreateDataSource: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  const ds = buildDataSource(input, ctx, apiId);
  ctx.store.set(dsKey(apiId, ds.name), ds);
  return { dataSource: dsView(ds) };
};

const GetDataSource: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const name = requireString(input, "name");
  return { dataSource: dsView(requireDataSource(ctx, apiId, name)) };
};

const ListDataSources: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  const max = numberOrUndefined(input["maxResults"]) ?? 25;
  const prefix = `${dsPrefix}${apiId}:`;
  const list = ctx.store
    .list<StoredDataSource>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { dataSources: list.slice(0, max).map(dsView) };
};

const UpdateDataSource: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const name = requireString(input, "name");
  const existing = requireDataSource(ctx, apiId, name);
  const ds: StoredDataSource = {
    ...buildDataSource(input, ctx, apiId),
    dataSourceArn: existing.dataSourceArn,
  };
  ctx.store.set(dsKey(apiId, name), ds);
  return { dataSource: dsView(ds) };
};

const DeleteDataSource: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const name = requireString(input, "name");
  requireDataSource(ctx, apiId, name);
  ctx.store.delete(dsKey(apiId, name));
  return {};
};

const CreateResolver: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const typeName = requireString(input, "typeName");
  requireApi(ctx, apiId);
  const rs = buildResolver(input, ctx, apiId, typeName);
  ctx.store.set(rsKey(apiId, typeName, rs.fieldName), rs);
  return { resolver: rsView(rs) };
};

const GetResolver: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const typeName = requireString(input, "typeName");
  const fieldName = requireString(input, "fieldName");
  return { resolver: rsView(requireResolver(ctx, apiId, typeName, fieldName)) };
};

const ListResolvers: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const typeName = requireString(input, "typeName");
  requireApi(ctx, apiId);
  const max = numberOrUndefined(input["maxResults"]) ?? 25;
  const prefix = `${rsPrefix}${apiId}:${typeName}:`;
  const list = ctx.store
    .list<StoredResolver>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) =>
      a.fieldName < b.fieldName ? -1 : a.fieldName > b.fieldName ? 1 : 0,
    );
  return { resolvers: list.slice(0, max).map(rsView) };
};

const ListResolversByFunction: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const functionId = requireString(input, "functionId");
  requireFunction(ctx, apiId, functionId);
  const max = numberOrUndefined(input["maxResults"]) ?? 25;
  const prefix = `${rsPrefix}${apiId}:`;
  const list = ctx.store
    .list<StoredResolver>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .filter((rs) => rs.dataSourceName === functionId)
    .sort((a, b) =>
      a.fieldName < b.fieldName ? -1 : a.fieldName > b.fieldName ? 1 : 0,
    );
  return { resolvers: list.slice(0, max).map(rsView) };
};

const UpdateResolver: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const typeName = requireString(input, "typeName");
  const fieldName = requireString(input, "fieldName");
  const existing = requireResolver(ctx, apiId, typeName, fieldName);
  const rs: StoredResolver = {
    ...buildResolver(input, ctx, apiId, typeName),
    resolverArn: existing.resolverArn,
  };
  ctx.store.set(rsKey(apiId, typeName, fieldName), rs);
  return { resolver: rsView(rs) };
};

const DeleteResolver: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const typeName = requireString(input, "typeName");
  const fieldName = requireString(input, "fieldName");
  requireResolver(ctx, apiId, typeName, fieldName);
  ctx.store.delete(rsKey(apiId, typeName, fieldName));
  return {};
};

const CreateFunction: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  const functionId = randomId();
  const fn = buildFunction(input, ctx, apiId, functionId);
  ctx.store.set(fnKey(apiId, functionId), fn);
  return { functionConfiguration: fnView(fn) };
};

const GetFunction: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const functionId = requireString(input, "functionId");
  return {
    functionConfiguration: fnView(requireFunction(ctx, apiId, functionId)),
  };
};

const ListFunctions: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  const max = numberOrUndefined(input["maxResults"]) ?? 25;
  const prefix = `${fnPrefix}${apiId}:`;
  const list = ctx.store
    .list<StoredFunction>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) =>
      a.functionId < b.functionId ? -1 : a.functionId > b.functionId ? 1 : 0,
    );
  return { functions: list.slice(0, max).map(fnView) };
};

const UpdateFunction: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const functionId = requireString(input, "functionId");
  const existing = requireFunction(ctx, apiId, functionId);
  const fn: StoredFunction = {
    ...buildFunction(input, ctx, apiId, functionId),
    functionArn: existing.functionArn,
  };
  ctx.store.set(fnKey(apiId, functionId), fn);
  return { functionConfiguration: fnView(fn) };
};

const DeleteFunction: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const functionId = requireString(input, "functionId");
  requireFunction(ctx, apiId, functionId);
  ctx.store.delete(fnKey(apiId, functionId));
  return {};
};

const CreateType: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  const tp = buildType(input, ctx, apiId);
  ctx.store.set(tpKey(apiId, tp.name), tp);
  return { type: tpView(tp) };
};

const GetType: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const typeName = requireString(input, "typeName");
  return { type: tpView(requireType(ctx, apiId, typeName)) };
};

const ListTypes: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  const max = numberOrUndefined(input["maxResults"]) ?? 25;
  const prefix = `${tpPrefix}${apiId}:`;
  const list = ctx.store
    .list<StoredType>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { types: list.slice(0, max).map(tpView) };
};

const UpdateType: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const typeName = requireString(input, "typeName");
  const existing = requireType(ctx, apiId, typeName);
  const tp: StoredType = {
    ...buildType(input, ctx, apiId, typeName),
    arn: existing.arn,
  };
  ctx.store.set(tpKey(apiId, typeName), tp);
  return { type: tpView(tp) };
};

const DeleteType: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const typeName = requireString(input, "typeName");
  requireType(ctx, apiId, typeName);
  ctx.store.delete(tpKey(apiId, typeName));
  return {};
};

const CreateApiCache: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  const ac: StoredApiCache = {
    ttl: numberOrUndefined(input["ttl"]) ?? 300,
    apiCachingBehavior: requireString(input, "apiCachingBehavior"),
    transitEncryptionEnabled: booleanOrUndefined(
      input["transitEncryptionEnabled"],
    ),
    atRestEncryptionEnabled: booleanOrUndefined(
      input["atRestEncryptionEnabled"],
    ),
    type: requireString(input, "type"),
    status: "AVAILABLE",
    healthMetricsConfig: stringOrUndefined(input["healthMetricsConfig"]),
  };
  ctx.store.set(acKey(apiId), ac);
  return { apiCache: acView(ac) };
};

const GetApiCache: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  return { apiCache: acView(requireApiCache(ctx, apiId)) };
};

const UpdateApiCache: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const existing = requireApiCache(ctx, apiId);
  const ac: StoredApiCache = {
    ...existing,
    ttl: numberOrUndefined(input["ttl"]) ?? existing.ttl,
    apiCachingBehavior:
      stringOrUndefined(input["apiCachingBehavior"]) ??
      existing.apiCachingBehavior,
    type: stringOrUndefined(input["type"]) ?? existing.type,
    healthMetricsConfig:
      stringOrUndefined(input["healthMetricsConfig"]) ??
      existing.healthMetricsConfig,
  };
  ctx.store.set(acKey(apiId), ac);
  return { apiCache: acView(ac) };
};

const DeleteApiCache: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApiCache(ctx, apiId);
  ctx.store.delete(acKey(apiId));
  return {};
};

const FlushApiCache: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  return {};
};

const CreateDomainName: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "domainName");
  const dn: StoredDomainName = {
    domainName,
    description: stringOrUndefined(input["description"]),
    certificateArn: requireString(input, "certificateArn"),
    appsyncDomainName: `${domainName}.appsync-api.${ctx.region}.amazonaws.com`,
    hostedZoneId: `Z${randomId().slice(0, 13).toUpperCase()}`,
    domainNameArn: `arn:aws:appsync:${ctx.region}:${ctx.account}:domainnames/${domainName}`,
    tags: recordOrUndefined(input["tags"]),
  };
  ctx.store.set(dnKey(domainName), dn);
  return { domainNameConfig: dnView(dn) };
};

const GetDomainName: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "domainName");
  return { domainNameConfig: dnView(requireDomainName(ctx, domainName)) };
};

const ListDomainNames: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 25;
  const list = ctx.store
    .list<StoredDomainName>()
    .filter((e) => e.key.startsWith(dnPrefix))
    .map((e) => e.value)
    .sort((a, b) =>
      a.domainName < b.domainName ? -1 : a.domainName > b.domainName ? 1 : 0,
    );
  return { domainNameConfigs: list.slice(0, max).map(dnView) };
};

const UpdateDomainName: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "domainName");
  const existing = requireDomainName(ctx, domainName);
  const dn: StoredDomainName = {
    ...existing,
    description:
      stringOrUndefined(input["description"]) ?? existing.description,
  };
  ctx.store.set(dnKey(domainName), dn);
  return { domainNameConfig: dnView(dn) };
};

const DeleteDomainName: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "domainName");
  requireDomainName(ctx, domainName);
  ctx.store.delete(dnKey(domainName));
  if (ctx.store.get(aaKey(domainName)) !== undefined) {
    ctx.store.delete(aaKey(domainName));
  }
  return {};
};

const AssociateApi: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "domainName");
  const apiId = requireString(input, "apiId");
  requireDomainName(ctx, domainName);
  requireApi(ctx, apiId);
  const aa: StoredApiAssociation = {
    domainName,
    apiId,
    associationStatus: "SUCCESS",
    deploymentDetail: undefined,
  };
  ctx.store.set(aaKey(domainName), aa);
  return { apiAssociation: aaView(aa) };
};

const DisassociateApi: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "domainName");
  requireDomainName(ctx, domainName);
  ctx.store.delete(aaKey(domainName));
  return {};
};

const GetApiAssociation: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "domainName");
  return { apiAssociation: aaView(requireApiAssociation(ctx, domainName)) };
};

const CreateApi: OperationHandler = (input, ctx) => {
  const apiId = randomId();
  const now = isoNow();
  const ea: StoredEventApi = {
    apiId,
    name: requireString(input, "name"),
    ownerContact: stringOrUndefined(input["ownerContact"]),
    tags: recordOrUndefined(input["tags"]),
    dns: {
      HTTP: `${apiId}.appsync-api.${ctx.region}.amazonaws.com`,
      REALTIME: `${apiId}.appsync-realtime-api.${ctx.region}.amazonaws.com`,
    },
    apiArn: `arn:aws:appsync:${ctx.region}:${ctx.account}:apis/${apiId}`,
    created: now,
    xrayEnabled: false,
    wafWebAclArn: undefined,
    eventConfig: recordOrUndefined(input["eventConfig"]),
  };
  ctx.store.set(eaKey(apiId), ea);
  return { api: eaView(ea) };
};

const GetApi: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  return { api: eaView(requireEventApi(ctx, apiId)) };
};

const ListApis: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 25;
  const list = ctx.store
    .list<StoredEventApi>()
    .filter((e) => e.key.startsWith(eaPrefix))
    .map((e) => e.value)
    .sort((a, b) => (a.apiId < b.apiId ? -1 : a.apiId > b.apiId ? 1 : 0));
  return { apis: list.slice(0, max).map(eaView) };
};

const UpdateApi: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const existing = requireEventApi(ctx, apiId);
  const ea: StoredEventApi = {
    ...existing,
    name: stringOrUndefined(input["name"]) ?? existing.name,
    ownerContact:
      stringOrUndefined(input["ownerContact"]) ?? existing.ownerContact,
    eventConfig:
      recordOrUndefined(input["eventConfig"]) ?? existing.eventConfig,
  };
  ctx.store.set(eaKey(apiId), ea);
  return { api: eaView(ea) };
};

const DeleteApi: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireEventApi(ctx, apiId);
  ctx.store
    .list<StoredChannelNamespace>()
    .filter((e) => e.key.startsWith(`${cnPrefix}${apiId}:`))
    .forEach((e) => ctx.store.delete(e.key));
  ctx.store.delete(eaKey(apiId));
  return {};
};

const CreateChannelNamespace: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireEventApi(ctx, apiId);
  const name = requireString(input, "name");
  const now = isoNow();
  const cn: StoredChannelNamespace = {
    apiId,
    name,
    subscribeAuthModes: arrayOrUndefined(input["subscribeAuthModes"]),
    publishAuthModes: arrayOrUndefined(input["publishAuthModes"]),
    codeHandlers: stringOrUndefined(input["codeHandlers"]),
    tags: recordOrUndefined(input["tags"]),
    channelNamespaceArn: `arn:aws:appsync:${ctx.region}:${ctx.account}:apis/${apiId}/channelNamespaces/${name}`,
    created: now,
    lastModified: now,
    handlerConfigs: arrayOrUndefined(input["handlerConfigs"]),
  };
  ctx.store.set(cnKey(apiId, name), cn);
  return { channelNamespace: cnView(cn) };
};

const GetChannelNamespace: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const name = requireString(input, "name");
  return {
    channelNamespace: cnView(requireChannelNamespace(ctx, apiId, name)),
  };
};

const ListChannelNamespaces: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireEventApi(ctx, apiId);
  const max = numberOrUndefined(input["maxResults"]) ?? 25;
  const prefix = `${cnPrefix}${apiId}:`;
  const list = ctx.store
    .list<StoredChannelNamespace>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { channelNamespaces: list.slice(0, max).map(cnView) };
};

const UpdateChannelNamespace: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const name = requireString(input, "name");
  const existing = requireChannelNamespace(ctx, apiId, name);
  const cn: StoredChannelNamespace = {
    ...existing,
    subscribeAuthModes:
      arrayOrUndefined(input["subscribeAuthModes"]) ??
      existing.subscribeAuthModes,
    publishAuthModes:
      arrayOrUndefined(input["publishAuthModes"]) ?? existing.publishAuthModes,
    codeHandlers:
      stringOrUndefined(input["codeHandlers"]) ?? existing.codeHandlers,
    handlerConfigs:
      arrayOrUndefined(input["handlerConfigs"]) ?? existing.handlerConfigs,
    lastModified: isoNow(),
  };
  ctx.store.set(cnKey(apiId, name), cn);
  return { channelNamespace: cnView(cn) };
};

const DeleteChannelNamespace: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  const name = requireString(input, "name");
  requireChannelNamespace(ctx, apiId, name);
  ctx.store.delete(cnKey(apiId, name));
  return {};
};

const ListTagsForResource: OperationHandler = (input, _ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags = _ctx.store.get<Record<string, string>>(tgKey(resourceArn)) ?? {};
  return { tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const newTags = (recordOrUndefined(input["tags"]) ?? {}) as Record<
    string,
    string
  >;
  const existing =
    ctx.store.get<Record<string, string>>(tgKey(resourceArn)) ?? {};
  ctx.store.set(tgKey(resourceArn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = arrayOrUndefined(input["tagKeys"]) ?? [];
  const existing =
    ctx.store.get<Record<string, string>>(tgKey(resourceArn)) ?? {};
  const updated = { ...existing };
  for (const k of tagKeys as string[]) delete updated[k];
  ctx.store.set(tgKey(resourceArn), updated);
  return {};
};

const GetGraphqlApiEnvironmentVariables: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  const vars = ctx.store.get<Record<string, string>>(evKey(apiId)) ?? {};
  return { environmentVariables: vars };
};

const PutGraphqlApiEnvironmentVariables: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  const vars = (recordOrUndefined(input["environmentVariables"]) ??
    {}) as Record<string, string>;
  ctx.store.set(evKey(apiId), vars);
  return { environmentVariables: vars };
};

const GetIntrospectionSchema: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  return { schema: `type Query {\n  placeholder: String\n}\n` };
};

const GetSchemaCreationStatus: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  return { status: "SUCCESS", details: "Schema is up to date." };
};

const StartSchemaCreation: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  return { status: "PROCESSING" };
};

const AssociateMergedGraphqlApi: OperationHandler = (input, ctx) => {
  const sourceApiIdentifier = requireString(input, "sourceApiIdentifier");
  const mergedApiIdentifier = requireString(input, "mergedApiIdentifier");
  const associationId = randomId();
  const sa: StoredSourceApiAssociation = {
    associationId,
    associationArn: `arn:aws:appsync:${ctx.region}:${ctx.account}:mergedApis/${mergedApiIdentifier}/sourceApiAssociations/${associationId}`,
    sourceApiId: sourceApiIdentifier,
    sourceApiArn: `arn:aws:appsync:${ctx.region}:${ctx.account}:apis/${sourceApiIdentifier}`,
    mergedApiArn: `arn:aws:appsync:${ctx.region}:${ctx.account}:apis/${mergedApiIdentifier}`,
    mergedApiId: mergedApiIdentifier,
    description: stringOrUndefined(input["description"]),
    sourceApiAssociationConfig: recordOrUndefined(
      input["sourceApiAssociationConfig"],
    ),
    sourceApiAssociationStatus: "MERGE_SUCCESS",
    sourceApiAssociationStatusDetail: undefined,
    lastSuccessfulMergeDate: isoNow(),
  };
  ctx.store.set(saKey(associationId), sa);
  return { sourceApiAssociation: saView(sa) };
};

const AssociateSourceGraphqlApi: OperationHandler = (input, ctx) => {
  const mergedApiIdentifier = requireString(input, "mergedApiIdentifier");
  const sourceApiIdentifier = requireString(input, "sourceApiIdentifier");
  const associationId = randomId();
  const sa: StoredSourceApiAssociation = {
    associationId,
    associationArn: `arn:aws:appsync:${ctx.region}:${ctx.account}:mergedApis/${mergedApiIdentifier}/sourceApiAssociations/${associationId}`,
    sourceApiId: sourceApiIdentifier,
    sourceApiArn: `arn:aws:appsync:${ctx.region}:${ctx.account}:apis/${sourceApiIdentifier}`,
    mergedApiArn: `arn:aws:appsync:${ctx.region}:${ctx.account}:apis/${mergedApiIdentifier}`,
    mergedApiId: mergedApiIdentifier,
    description: stringOrUndefined(input["description"]),
    sourceApiAssociationConfig: recordOrUndefined(
      input["sourceApiAssociationConfig"],
    ),
    sourceApiAssociationStatus: "MERGE_SUCCESS",
    sourceApiAssociationStatusDetail: undefined,
    lastSuccessfulMergeDate: isoNow(),
  };
  ctx.store.set(saKey(associationId), sa);
  return { sourceApiAssociation: saView(sa) };
};

const GetSourceApiAssociation: OperationHandler = (input, ctx) => {
  const associationId = requireString(input, "associationId");
  return {
    sourceApiAssociation: saView(
      requireSourceApiAssociation(ctx, associationId),
    ),
  };
};

const UpdateSourceApiAssociation: OperationHandler = (input, ctx) => {
  const associationId = requireString(input, "associationId");
  const existing = requireSourceApiAssociation(ctx, associationId);
  const sa: StoredSourceApiAssociation = {
    ...existing,
    description:
      stringOrUndefined(input["description"]) ?? existing.description,
    sourceApiAssociationConfig:
      recordOrUndefined(input["sourceApiAssociationConfig"]) ??
      existing.sourceApiAssociationConfig,
  };
  ctx.store.set(saKey(associationId), sa);
  return { sourceApiAssociation: saView(sa) };
};

const DisassociateMergedGraphqlApi: OperationHandler = (input, ctx) => {
  const associationId = requireString(input, "associationId");
  const existing = requireSourceApiAssociation(ctx, associationId);
  ctx.store.delete(saKey(associationId));
  return { sourceApiAssociationStatus: existing.sourceApiAssociationStatus };
};

const DisassociateSourceGraphqlApi: OperationHandler = (input, ctx) => {
  const associationId = requireString(input, "associationId");
  const existing = requireSourceApiAssociation(ctx, associationId);
  ctx.store.delete(saKey(associationId));
  return { sourceApiAssociationStatus: existing.sourceApiAssociationStatus };
};

const ListSourceApiAssociations: OperationHandler = (input, ctx) => {
  const apiId = requireString(input, "apiId");
  requireApi(ctx, apiId);
  const max = numberOrUndefined(input["maxResults"]) ?? 25;
  const list = ctx.store
    .list<StoredSourceApiAssociation>()
    .filter((e) => e.key.startsWith(saPrefix))
    .map((e) => e.value)
    .filter((sa) => sa.sourceApiId === apiId || sa.mergedApiId === apiId)
    .sort((a, b) =>
      a.associationId < b.associationId
        ? -1
        : a.associationId > b.associationId
          ? 1
          : 0,
    );
  return {
    sourceApiAssociationSummaries: list.slice(0, max).map((sa) => ({
      associationId: sa.associationId,
      associationArn: sa.associationArn,
      sourceApiId: sa.sourceApiId,
      sourceApiArn: sa.sourceApiArn,
      mergedApiArn: sa.mergedApiArn,
      mergedApiId: sa.mergedApiId,
      description: sa.description,
      sourceApiAssociationStatus: sa.sourceApiAssociationStatus,
    })),
  };
};

const StartSchemaMerge: OperationHandler = (input, ctx) => {
  const associationId = requireString(input, "associationId");
  requireSourceApiAssociation(ctx, associationId);
  return { sourceApiAssociationStatus: "MERGE_SUCCESS" };
};

const ListTypesByAssociation: OperationHandler = (input, ctx) => {
  const associationId = requireString(input, "associationId");
  const sa = requireSourceApiAssociation(ctx, associationId);
  const max = numberOrUndefined(input["maxResults"]) ?? 25;
  const prefix = `${tpPrefix}${sa.sourceApiId}:`;
  const list = ctx.store
    .list<StoredType>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { types: list.slice(0, max).map(tpView) };
};

const StartDataSourceIntrospection: OperationHandler = (_input, _ctx) => {
  const introspectionId = randomId();
  return {
    introspectionId,
    introspectionStatus: "SUCCESS",
    introspectionStatusDetail: undefined,
  };
};

const GetDataSourceIntrospection: OperationHandler = (_input, _ctx) => {
  return {
    introspectionId: requireString(_input, "introspectionId"),
    introspectionStatus: "SUCCESS",
    introspectionStatusDetail: undefined,
    introspectionResult: { models: [], nextToken: undefined },
  };
};

const EvaluateCode: OperationHandler = (_input, _ctx) => {
  return {
    evaluationResult: "{}",
    error: undefined,
    logs: [],
    stash: undefined,
    outErrors: undefined,
  };
};

const EvaluateMappingTemplate: OperationHandler = (_input, _ctx) => {
  return {
    evaluationResult: "{}",
    error: undefined,
    logs: [],
    stash: undefined,
    outErrors: undefined,
  };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const appsync = {
  name: "appsync",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    const m = req.method;
    const [p0, p1, , p3, p4, p5] = parts;
    const len = parts.length;

    if (p0 === "v2") {
      if (p1 !== "apis") return undefined;
      if (len === 2) {
        if (m === "GET") return "ListApis";
        if (m === "POST") return "CreateApi";
      }
      if (len === 3) {
        if (m === "GET") return "GetApi";
        if (m === "POST") return "UpdateApi";
        if (m === "DELETE") return "DeleteApi";
      }
      if (p3 === "channelNamespaces") {
        if (len === 4) {
          if (m === "GET") return "ListChannelNamespaces";
          if (m === "POST") return "CreateChannelNamespace";
        }
        if (len === 5) {
          if (m === "GET") return "GetChannelNamespace";
          if (m === "POST") return "UpdateChannelNamespace";
          if (m === "DELETE") return "DeleteChannelNamespace";
        }
      }
      return undefined;
    }

    if (p0 !== "v1") return undefined;

    if (p1 === "dataplane-evaluatecode" && len === 2 && m === "POST")
      return "EvaluateCode";
    if (p1 === "dataplane-evaluatetemplate" && len === 2 && m === "POST")
      return "EvaluateMappingTemplate";

    if (p1 === "datasources" && parts[2] === "introspections") {
      if (len === 3 && m === "POST") return "StartDataSourceIntrospection";
      if (len === 4 && m === "GET") return "GetDataSourceIntrospection";
    }

    if (p1 === "domainnames") {
      if (len === 2) {
        if (m === "POST") return "CreateDomainName";
        if (m === "GET") return "ListDomainNames";
      }
      if (len === 3) {
        if (m === "GET") return "GetDomainName";
        if (m === "POST") return "UpdateDomainName";
        if (m === "DELETE") return "DeleteDomainName";
      }
      if (p3 === "apiassociation" && len === 4) {
        if (m === "POST") return "AssociateApi";
        if (m === "DELETE") return "DisassociateApi";
        if (m === "GET") return "GetApiAssociation";
      }
      return undefined;
    }

    if (p1 === "tags") {
      if (m === "GET") return "ListTagsForResource";
      if (m === "POST") return "TagResource";
      if (m === "DELETE") return "UntagResource";
    }

    if (p1 === "mergedApis" && p3 === "sourceApiAssociations") {
      if (len === 4 && m === "POST") return "AssociateSourceGraphqlApi";
      if (len === 5) {
        if (m === "GET") return "GetSourceApiAssociation";
        if (m === "POST") return "UpdateSourceApiAssociation";
        if (m === "DELETE") return "DisassociateSourceGraphqlApi";
      }
      if (len === 6 && p5 === "merge" && m === "POST")
        return "StartSchemaMerge";
      if (len === 6 && p5 === "types" && m === "GET")
        return "ListTypesByAssociation";
      return undefined;
    }

    if (p1 === "sourceApis" && p3 === "mergedApiAssociations") {
      if (len === 4 && m === "POST") return "AssociateMergedGraphqlApi";
      if (len === 5 && m === "DELETE") return "DisassociateMergedGraphqlApi";
      return undefined;
    }

    if (p1 !== "apis") return undefined;

    if (len === 2) {
      if (m === "POST") return "CreateGraphqlApi";
      if (m === "GET") return "ListGraphqlApis";
    }
    if (len === 3) {
      if (m === "GET") return "GetGraphqlApi";
      if (m === "POST") return "UpdateGraphqlApi";
      if (m === "DELETE") return "DeleteGraphqlApi";
    }

    if (p3 === "apikeys") {
      if (len === 4) {
        if (m === "POST") return "CreateApiKey";
        if (m === "GET") return "ListApiKeys";
      }
      if (len === 5) {
        if (m === "POST") return "UpdateApiKey";
        if (m === "DELETE") return "DeleteApiKey";
      }
    }

    if (p3 === "ApiCaches") {
      if (len === 4) {
        if (m === "POST") return "CreateApiCache";
        if (m === "GET") return "GetApiCache";
        if (m === "DELETE") return "DeleteApiCache";
      }
      if (p4 === "update" && len === 5 && m === "POST") return "UpdateApiCache";
    }

    if (p3 === "FlushCache" && len === 4 && m === "DELETE")
      return "FlushApiCache";

    if (p3 === "datasources") {
      if (len === 4) {
        if (m === "POST") return "CreateDataSource";
        if (m === "GET") return "ListDataSources";
      }
      if (len === 5) {
        if (m === "GET") return "GetDataSource";
        if (m === "POST") return "UpdateDataSource";
        if (m === "DELETE") return "DeleteDataSource";
      }
    }

    if (p3 === "functions") {
      if (len === 4) {
        if (m === "POST") return "CreateFunction";
        if (m === "GET") return "ListFunctions";
      }
      if (len === 5) {
        if (m === "GET") return "GetFunction";
        if (m === "POST") return "UpdateFunction";
        if (m === "DELETE") return "DeleteFunction";
      }
      if (p5 === "resolvers" && len === 6 && m === "GET")
        return "ListResolversByFunction";
    }

    if (p3 === "types") {
      if (len === 4) {
        if (m === "POST") return "CreateType";
        if (m === "GET") return "ListTypes";
      }
      if (len === 5) {
        if (m === "GET") return "GetType";
        if (m === "POST") return "UpdateType";
        if (m === "DELETE") return "DeleteType";
      }
      if (p5 === "resolvers") {
        if (len === 6) {
          if (m === "POST") return "CreateResolver";
          if (m === "GET") return "ListResolvers";
        }
        if (len === 7) {
          if (m === "GET") return "GetResolver";
          if (m === "POST") return "UpdateResolver";
          if (m === "DELETE") return "DeleteResolver";
        }
      }
    }

    if (p3 === "schemacreation" && len === 4) {
      if (m === "GET") return "GetSchemaCreationStatus";
      if (m === "POST") return "StartSchemaCreation";
    }

    if (p3 === "schema" && len === 4 && m === "GET")
      return "GetIntrospectionSchema";

    if (p3 === "environmentVariables" && len === 4) {
      if (m === "GET") return "GetGraphqlApiEnvironmentVariables";
      if (m === "PUT") return "PutGraphqlApiEnvironmentVariables";
    }

    if (p3 === "sourceApiAssociations" && len === 4 && m === "GET")
      return "ListSourceApiAssociations";

    return undefined;
  },
  operations: {
    CreateGraphqlApi,
    GetGraphqlApi,
    ListGraphqlApis,
    UpdateGraphqlApi,
    DeleteGraphqlApi,
    CreateApiKey,
    ListApiKeys,
    UpdateApiKey,
    DeleteApiKey,
    CreateDataSource,
    GetDataSource,
    ListDataSources,
    UpdateDataSource,
    DeleteDataSource,
    CreateResolver,
    GetResolver,
    ListResolvers,
    ListResolversByFunction,
    UpdateResolver,
    DeleteResolver,
    CreateFunction,
    GetFunction,
    ListFunctions,
    UpdateFunction,
    DeleteFunction,
    CreateType,
    GetType,
    ListTypes,
    UpdateType,
    DeleteType,
    CreateApiCache,
    GetApiCache,
    UpdateApiCache,
    DeleteApiCache,
    FlushApiCache,
    CreateDomainName,
    GetDomainName,
    ListDomainNames,
    UpdateDomainName,
    DeleteDomainName,
    AssociateApi,
    DisassociateApi,
    GetApiAssociation,
    CreateApi,
    GetApi,
    ListApis,
    UpdateApi,
    DeleteApi,
    CreateChannelNamespace,
    GetChannelNamespace,
    ListChannelNamespaces,
    UpdateChannelNamespace,
    DeleteChannelNamespace,
    ListTagsForResource,
    TagResource,
    UntagResource,
    GetGraphqlApiEnvironmentVariables,
    PutGraphqlApiEnvironmentVariables,
    GetIntrospectionSchema,
    GetSchemaCreationStatus,
    StartSchemaCreation,
    AssociateMergedGraphqlApi,
    AssociateSourceGraphqlApi,
    GetSourceApiAssociation,
    UpdateSourceApiAssociation,
    DisassociateMergedGraphqlApi,
    DisassociateSourceGraphqlApi,
    ListSourceApiAssociations,
    StartSchemaMerge,
    ListTypesByAssociation,
    StartDataSourceIntrospection,
    GetDataSourceIntrospection,
    EvaluateCode,
    EvaluateMappingTemplate,
  },
  model,
} as const satisfies ServiceDefinition;

export default appsync;
