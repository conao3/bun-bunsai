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

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

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

const apiArn = (ctx: ServiceContext, apiId: string): string =>
  `arn:aws:appsync:${ctx.region}:${ctx.account}:apis/${apiId}`;

const randomId = (): string =>
  Array.from({ length: 26 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789".charAt(
      Math.floor(Math.random() * 36),
    ),
  ).join("");

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

const requireApi = (ctx: ServiceContext, apiId: string): StoredApi => {
  const api = ctx.store.get<StoredApi>(apiKey(apiId));
  if (api === undefined) {
    throw awsError("NotFoundException", `GraphQL API ${apiId} not found.`, 404);
  }
  return api;
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

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const appsync = {
  name: "appsync",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "v1" || parts[1] !== "apis") return undefined;
    if (parts.length === 2) {
      if (req.method === "POST") return "CreateGraphqlApi";
      if (req.method === "GET") return "ListGraphqlApis";
      return undefined;
    }
    if (parts.length === 3) {
      if (req.method === "GET") return "GetGraphqlApi";
      if (req.method === "POST") return "UpdateGraphqlApi";
      if (req.method === "DELETE") return "DeleteGraphqlApi";
      return undefined;
    }
    if (parts.length === 4 && parts[3] === "apikeys") {
      if (req.method === "POST") return "CreateApiKey";
      if (req.method === "GET") return "ListApiKeys";
      return undefined;
    }
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
  },
  model,
} as const satisfies ServiceDefinition;

export default appsync;
