import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import lambdaModel from "../../../../test/vendor/aws-models/lambda.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(lambdaModel);

type StoredFunction = {
  FunctionName: string;
  FunctionArn: string;
  Runtime: string | undefined;
  Role: string | undefined;
  Handler: string | undefined;
  Description: string | undefined;
  Timeout: number;
  MemorySize: number;
  PackageType: string;
  CodeSize: number;
  CodeSha256: string;
  Version: string;
  RevisionId: string;
  LastModified: string;
  State: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const arnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:lambda:${ctx.region}:${ctx.account}:function:${name}`;

const nowIso = (): string => new Date().toISOString();

const sha256Of = (input: string): string => {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(input);
  return hasher.digest("base64");
};

const codeSizeOf = (input: Record<string, unknown>): number => {
  const code = input["Code"];
  if (typeof code === "object" && code !== null) {
    const zip = (code as Record<string, unknown>)["ZipFile"];
    if (typeof zip === "string") return zip.length;
    if (zip instanceof Uint8Array) return zip.byteLength;
  }
  return 0;
};

const functionNameFromInput = (input: Record<string, unknown>): string => {
  const name = input["FunctionName"];
  if (typeof name === "string" && name !== "") {
    const parts = name.split(":");
    return parts[parts.length - 1];
  }
  throw awsError(
    "InvalidParameterValueException",
    "FunctionName is required.",
    400,
  );
};

const requireFunction = (ctx: ServiceContext, name: string): StoredFunction => {
  const fn = ctx.store.get<StoredFunction>(name);
  if (fn === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Function not found: ${name}`,
      404,
    );
  }
  return fn;
};

const configurationOf = (fn: StoredFunction): Record<string, unknown> => ({
  FunctionName: fn.FunctionName,
  FunctionArn: fn.FunctionArn,
  Runtime: fn.Runtime,
  Role: fn.Role,
  Handler: fn.Handler,
  CodeSize: fn.CodeSize,
  Description: fn.Description,
  Timeout: fn.Timeout,
  MemorySize: fn.MemorySize,
  LastModified: fn.LastModified,
  CodeSha256: fn.CodeSha256,
  Version: fn.Version,
  RevisionId: fn.RevisionId,
  PackageType: fn.PackageType,
  State: fn.State,
});

const CreateFunction: OperationHandler = (input, ctx) => {
  const name = functionNameFromInput(input);
  const existing = ctx.store.get<StoredFunction>(name);
  if (existing !== undefined) {
    throw awsError(
      "ResourceConflictException",
      `Function already exist: ${name}`,
      409,
    );
  }
  const fn: StoredFunction = {
    FunctionName: name,
    FunctionArn: arnOf(ctx, name),
    Runtime: stringOrUndefined(input["Runtime"]),
    Role: stringOrUndefined(input["Role"]),
    Handler: stringOrUndefined(input["Handler"]),
    Description: stringOrUndefined(input["Description"]),
    Timeout:
      typeof input["Timeout"] === "number" ? (input["Timeout"] as number) : 3,
    MemorySize:
      typeof input["MemorySize"] === "number"
        ? (input["MemorySize"] as number)
        : 128,
    PackageType: stringOrUndefined(input["PackageType"]) ?? "Zip",
    CodeSize: codeSizeOf(input),
    CodeSha256: sha256Of(`${name}:${nowIso()}`),
    Version: "$LATEST",
    RevisionId: crypto.randomUUID(),
    LastModified: nowIso(),
    State: "Active",
  };
  ctx.store.set(name, fn);
  return configurationOf(fn);
};

const GetFunction: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  return {
    Configuration: configurationOf(fn),
    Code: {
      RepositoryType: "S3",
      Location: `https://bunsai-lambda.local/${fn.FunctionName}`,
    },
    Tags: {},
  };
};

const ListFunctions: OperationHandler = (input, ctx) => {
  const functions = ctx.store
    .list<StoredFunction>()
    .map((entry) => configurationOf(entry.value));
  return { Functions: functions };
};

const DeleteFunction: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  ctx.store.delete(fn.FunctionName);
  return {};
};

const UpdateFunctionCode: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const zip = input["ZipFile"];
  if (typeof zip === "string") fn.CodeSize = zip.length;
  else if (zip instanceof Uint8Array) fn.CodeSize = zip.byteLength;
  fn.CodeSha256 = sha256Of(`${fn.FunctionName}:${nowIso()}`);
  fn.RevisionId = crypto.randomUUID();
  fn.LastModified = nowIso();
  ctx.store.set(fn.FunctionName, fn);
  return configurationOf(fn);
};

const Invoke: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const payload = input["Payload"];
  return {
    StatusCode: 200,
    Payload: typeof payload === "string" ? payload : "",
    ExecutedVersion: fn.Version,
  };
};

const GetFunctionConfiguration: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  return configurationOf(fn);
};

const UpdateFunctionConfiguration: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const runtime = stringOrUndefined(input["Runtime"]);
  if (runtime !== undefined) fn.Runtime = runtime;
  const role = stringOrUndefined(input["Role"]);
  if (role !== undefined) fn.Role = role;
  const handler = stringOrUndefined(input["Handler"]);
  if (handler !== undefined) fn.Handler = handler;
  const description = stringOrUndefined(input["Description"]);
  if (description !== undefined) fn.Description = description;
  if (typeof input["Timeout"] === "number") fn.Timeout = input["Timeout"];
  if (typeof input["MemorySize"] === "number")
    fn.MemorySize = input["MemorySize"];
  fn.RevisionId = crypto.randomUUID();
  fn.LastModified = nowIso();
  ctx.store.set(fn.FunctionName, fn);
  return configurationOf(fn);
};

type StoredVersion = {
  number: number;
};

const versionKey = (name: string): string => `version:${name}`;

const PublishVersion: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const key = versionKey(fn.FunctionName);
  const existing = ctx.store.get<StoredVersion>(key);
  const next = (existing?.number ?? 0) + 1;
  ctx.store.set(key, { number: next });
  const version = String(next);
  return {
    ...configurationOf(fn),
    Version: version,
    FunctionArn: `${fn.FunctionArn}:${version}`,
    Description: stringOrUndefined(input["Description"]) ?? fn.Description,
    RevisionId: crypto.randomUUID(),
    LastModified: nowIso(),
  };
};

type StoredAlias = {
  Name: string;
  FunctionVersion: string;
  Description: string | undefined;
  RevisionId: string;
};

const aliasKey = (name: string, alias: string): string =>
  `alias:${name}:${alias}`;

const aliasNameFromInput = (input: Record<string, unknown>): string => {
  const name = input["Name"];
  if (typeof name === "string" && name !== "") return name;
  throw awsError(
    "InvalidParameterValueException",
    "Alias Name is required.",
    400,
  );
};

const aliasConfigurationOf = (
  ctx: ServiceContext,
  fnName: string,
  alias: StoredAlias,
): Record<string, unknown> => ({
  AliasArn: `${arnOf(ctx, fnName)}:${alias.Name}`,
  Name: alias.Name,
  FunctionVersion: alias.FunctionVersion,
  Description: alias.Description,
  RevisionId: alias.RevisionId,
});

const CreateAlias: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const aliasName = aliasNameFromInput(input);
  const key = aliasKey(fn.FunctionName, aliasName);
  if (ctx.store.get<StoredAlias>(key) !== undefined) {
    throw awsError(
      "ResourceConflictException",
      `Alias already exists: ${aliasName}`,
      409,
    );
  }
  const alias: StoredAlias = {
    Name: aliasName,
    FunctionVersion: stringOrUndefined(input["FunctionVersion"]) ?? "$LATEST",
    Description: stringOrUndefined(input["Description"]),
    RevisionId: crypto.randomUUID(),
  };
  ctx.store.set(key, alias);
  return aliasConfigurationOf(ctx, fn.FunctionName, alias);
};

const GetAlias: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const aliasName = aliasNameFromInput(input);
  const alias = ctx.store.get<StoredAlias>(
    aliasKey(fn.FunctionName, aliasName),
  );
  if (alias === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Alias not found: ${aliasName}`,
      404,
    );
  }
  return aliasConfigurationOf(ctx, fn.FunctionName, alias);
};

const ListAliases: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const prefix = `alias:${fn.FunctionName}:`;
  const aliases = ctx.store
    .list<StoredAlias>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => aliasConfigurationOf(ctx, fn.FunctionName, entry.value));
  return { Aliases: aliases };
};

type StoredStatement = {
  Sid: string;
  Effect: string;
  Principal: Record<string, string>;
  Action: string;
  Resource: string;
};

type StoredPolicy = {
  Version: string;
  Id: string;
  Statement: StoredStatement[];
};

const policyKey = (name: string): string => `policy:${name}`;

const AddPermission: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const statementId = stringOrUndefined(input["StatementId"]);
  if (statementId === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "StatementId is required.",
      400,
    );
  }
  const key = policyKey(fn.FunctionName);
  const policy: StoredPolicy = ctx.store.get<StoredPolicy>(key) ?? {
    Version: "2012-10-17",
    Id: "default",
    Statement: [],
  };
  if (policy.Statement.some((s) => s.Sid === statementId)) {
    throw awsError(
      "ResourceConflictException",
      `Statement already exists: ${statementId}`,
      409,
    );
  }
  const statement: StoredStatement = {
    Sid: statementId,
    Effect: "Allow",
    Principal: { Service: stringOrUndefined(input["Principal"]) ?? "" },
    Action: stringOrUndefined(input["Action"]) ?? "",
    Resource: fn.FunctionArn,
  };
  policy.Statement.push(statement);
  ctx.store.set(key, policy);
  return { Statement: JSON.stringify(statement) };
};

const GetPolicy: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const policy = ctx.store.get<StoredPolicy>(policyKey(fn.FunctionName));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No policy found for function: ${fn.FunctionName}`,
      404,
    );
  }
  return { Policy: JSON.stringify(policy), RevisionId: crypto.randomUUID() };
};

const RemovePermission: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const statementId = stringOrUndefined(input["StatementId"]);
  const key = policyKey(fn.FunctionName);
  const policy = ctx.store.get<StoredPolicy>(key);
  if (policy === undefined || statementId === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No policy statement found: ${statementId}`,
      404,
    );
  }
  const next = policy.Statement.filter((s) => s.Sid !== statementId);
  if (next.length === policy.Statement.length) {
    throw awsError(
      "ResourceNotFoundException",
      `No policy statement found: ${statementId}`,
      404,
    );
  }
  if (next.length === 0) {
    ctx.store.delete(key);
    return {};
  }
  policy.Statement = next;
  ctx.store.set(key, policy);
  return {};
};

const resourceArnFromInput = (input: Record<string, unknown>): string => {
  const resource = input["Resource"];
  if (typeof resource === "string" && resource !== "") return resource;
  throw awsError(
    "InvalidParameterValueException",
    "Resource ARN is required.",
    400,
  );
};

const tagsKey = (arn: string): string => `tags:${arn}`;

const TagResource: OperationHandler = (input, ctx) => {
  const arn = resourceArnFromInput(input);
  const key = tagsKey(arn);
  const tags = ctx.store.get<Record<string, string>>(key) ?? {};
  const incoming = input["Tags"];
  if (typeof incoming === "object" && incoming !== null) {
    for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
      if (typeof v === "string") tags[k] = v;
    }
  }
  ctx.store.set(key, tags);
  return {};
};

const ListTags: OperationHandler = (input, ctx) => {
  const arn = resourceArnFromInput(input);
  const tags = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  return { Tags: tags };
};

const concurrencyKey = (name: string): string => `concurrency:${name}`;

const PutFunctionConcurrency: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const reserved = input["ReservedConcurrentExecutions"];
  if (typeof reserved !== "number") {
    throw awsError(
      "InvalidParameterValueException",
      "ReservedConcurrentExecutions is required.",
      400,
    );
  }
  ctx.store.set(concurrencyKey(fn.FunctionName), { value: reserved });
  return { ReservedConcurrentExecutions: reserved };
};

const GetFunctionConcurrency: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const stored = ctx.store.get<{ value: number }>(
    concurrencyKey(fn.FunctionName),
  );
  return { ReservedConcurrentExecutions: stored?.value };
};

const DeleteFunctionConcurrency: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  ctx.store.delete(concurrencyKey(fn.FunctionName));
  return {};
};

type StoredCors = {
  AllowCredentials: boolean | undefined;
  AllowHeaders: string[] | undefined;
  AllowMethods: string[] | undefined;
  AllowOrigins: string[] | undefined;
  ExposeHeaders: string[] | undefined;
  MaxAge: number | undefined;
};

type StoredUrlConfig = {
  FunctionUrl: string;
  FunctionArn: string;
  AuthType: string;
  Cors: StoredCors | undefined;
  InvokeMode: string;
  CreationTime: string;
  LastModifiedTime: string;
};

const urlConfigKey = (name: string): string => `url:${name}`;

const corsFromInput = (value: unknown): StoredCors | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const cors = value as Record<string, unknown>;
  const stringList = (raw: unknown): string[] | undefined =>
    Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === "string")
      : undefined;
  return {
    AllowCredentials:
      typeof cors["AllowCredentials"] === "boolean"
        ? cors["AllowCredentials"]
        : undefined,
    AllowHeaders: stringList(cors["AllowHeaders"]),
    AllowMethods: stringList(cors["AllowMethods"]),
    AllowOrigins: stringList(cors["AllowOrigins"]),
    ExposeHeaders: stringList(cors["ExposeHeaders"]),
    MaxAge: typeof cors["MaxAge"] === "number" ? cors["MaxAge"] : undefined,
  };
};

const urlConfigResponse = (
  config: StoredUrlConfig,
): Record<string, unknown> => ({
  FunctionUrl: config.FunctionUrl,
  FunctionArn: config.FunctionArn,
  AuthType: config.AuthType,
  Cors: config.Cors,
  CreationTime: config.CreationTime,
  LastModifiedTime: config.LastModifiedTime,
  InvokeMode: config.InvokeMode,
});

const CreateFunctionUrlConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const key = urlConfigKey(fn.FunctionName);
  if (ctx.store.get<StoredUrlConfig>(key) !== undefined) {
    throw awsError(
      "ResourceConflictException",
      `Function url config already exists: ${fn.FunctionName}`,
      409,
    );
  }
  const now = nowIso();
  const config: StoredUrlConfig = {
    FunctionUrl: `https://bunsai-${fn.FunctionName}.lambda-url.${ctx.region}.on.aws/`,
    FunctionArn: fn.FunctionArn,
    AuthType: stringOrUndefined(input["AuthType"]) ?? "NONE",
    Cors: corsFromInput(input["Cors"]),
    InvokeMode: stringOrUndefined(input["InvokeMode"]) ?? "BUFFERED",
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(key, config);
  return urlConfigResponse(config);
};

const GetFunctionUrlConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const config = ctx.store.get<StoredUrlConfig>(urlConfigKey(fn.FunctionName));
  if (config === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Function url config not found: ${fn.FunctionName}`,
      404,
    );
  }
  return urlConfigResponse(config);
};

const DeleteFunctionUrlConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  ctx.store.delete(urlConfigKey(fn.FunctionName));
  return {};
};

type StoredLayerVersion = {
  LayerName: string;
  LayerArn: string;
  LayerVersionArn: string;
  Version: number;
  Description: string | undefined;
  CreatedDate: string;
  CompatibleRuntimes: string[];
  CompatibleArchitectures: string[];
  LicenseInfo: string | undefined;
  CodeSize: number;
  CodeSha256: string;
};

const layerNameFromInput = (input: Record<string, unknown>): string => {
  const name = input["LayerName"];
  if (typeof name === "string" && name !== "") {
    const parts = name.split(":");
    return parts[parts.length - 1];
  }
  throw awsError(
    "InvalidParameterValueException",
    "LayerName is required.",
    400,
  );
};

const layerArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:lambda:${ctx.region}:${ctx.account}:layer:${name}`;

const layerCounterKey = (name: string): string => `layer-counter:${name}`;

const layerVersionKey = (name: string, version: number): string =>
  `layer:${name}:${version}`;

const stringListOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const layerVersionResponse = (
  layer: StoredLayerVersion,
): Record<string, unknown> => ({
  Content: {
    Location: `https://bunsai-layers.local/${layer.LayerName}/${layer.Version}`,
    CodeSha256: layer.CodeSha256,
    CodeSize: layer.CodeSize,
  },
  LayerArn: layer.LayerArn,
  LayerVersionArn: layer.LayerVersionArn,
  Description: layer.Description,
  CreatedDate: layer.CreatedDate,
  Version: layer.Version,
  CompatibleRuntimes: layer.CompatibleRuntimes,
  CompatibleArchitectures: layer.CompatibleArchitectures,
  LicenseInfo: layer.LicenseInfo,
});

const layerContentSize = (input: Record<string, unknown>): number => {
  const content = input["Content"];
  if (typeof content === "object" && content !== null) {
    const zip = (content as Record<string, unknown>)["ZipFile"];
    if (typeof zip === "string") return zip.length;
    if (zip instanceof Uint8Array) return zip.byteLength;
  }
  return 0;
};

const PublishLayerVersion: OperationHandler = (input, ctx) => {
  const name = layerNameFromInput(input);
  const counterKey = layerCounterKey(name);
  const existing = ctx.store.get<{ value: number }>(counterKey);
  const version = (existing?.value ?? 0) + 1;
  ctx.store.set(counterKey, { value: version });
  const layerArn = layerArnOf(ctx, name);
  const layer: StoredLayerVersion = {
    LayerName: name,
    LayerArn: layerArn,
    LayerVersionArn: `${layerArn}:${version}`,
    Version: version,
    Description: stringOrUndefined(input["Description"]),
    CreatedDate: nowIso(),
    CompatibleRuntimes: stringListOf(input["CompatibleRuntimes"]),
    CompatibleArchitectures: stringListOf(input["CompatibleArchitectures"]),
    LicenseInfo: stringOrUndefined(input["LicenseInfo"]),
    CodeSize: layerContentSize(input),
    CodeSha256: sha256Of(`${name}:${version}:${nowIso()}`),
  };
  ctx.store.set(layerVersionKey(name, version), layer);
  return layerVersionResponse(layer);
};

const ListLayers: OperationHandler = (input, ctx) => {
  const latest = new Map<string, StoredLayerVersion>();
  for (const entry of ctx.store.list<StoredLayerVersion>()) {
    if (!entry.key.startsWith("layer:")) continue;
    const current = latest.get(entry.value.LayerName);
    if (current === undefined || entry.value.Version > current.Version) {
      latest.set(entry.value.LayerName, entry.value);
    }
  }
  const layers = [...latest.values()].map((layer) => ({
    LayerName: layer.LayerName,
    LayerArn: layer.LayerArn,
    LatestMatchingVersion: {
      LayerVersionArn: layer.LayerVersionArn,
      Version: layer.Version,
      Description: layer.Description,
      CreatedDate: layer.CreatedDate,
      CompatibleRuntimes: layer.CompatibleRuntimes,
      CompatibleArchitectures: layer.CompatibleArchitectures,
      LicenseInfo: layer.LicenseInfo,
    },
  }));
  return { Layers: layers };
};

const GetLayerVersion: OperationHandler = (input, ctx) => {
  const name = layerNameFromInput(input);
  const versionRaw = input["VersionNumber"];
  const version =
    typeof versionRaw === "number"
      ? versionRaw
      : typeof versionRaw === "string"
        ? Number(versionRaw)
        : Number.NaN;
  if (!Number.isFinite(version)) {
    throw awsError(
      "InvalidParameterValueException",
      "VersionNumber is required.",
      400,
    );
  }
  const layer = ctx.store.get<StoredLayerVersion>(
    layerVersionKey(name, version),
  );
  if (layer === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Layer version not found: ${name}:${version}`,
      404,
    );
  }
  return layerVersionResponse(layer);
};

const segmentsAfterFunctions = (path: string): string[] => {
  const idx = path.indexOf("/functions");
  if (idx === -1) return [];
  return path
    .slice(idx + "/functions".length)
    .split("/")
    .filter((part) => part !== "");
};

const lambda: ServiceDefinition = {
  name: "lambda",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    if (req.path.includes("/tags/")) {
      if (req.method === "POST") return "TagResource";
      if (req.method === "GET") return "ListTags";
      return undefined;
    }
    if (req.path.includes("/layers")) {
      const idx = req.path.indexOf("/layers");
      const layerParts = req.path
        .slice(idx + "/layers".length)
        .split("/")
        .filter((part) => part !== "");
      if (layerParts.length === 0) {
        if (req.method === "GET") return "ListLayers";
        return undefined;
      }
      const layerTail = layerParts[layerParts.length - 1];
      if (layerTail === "versions" && req.method === "POST")
        return "PublishLayerVersion";
      if (
        layerParts.length >= 2 &&
        layerParts[layerParts.length - 2] === "versions" &&
        req.method === "GET"
      ) {
        return "GetLayerVersion";
      }
      return undefined;
    }
    const parts = segmentsAfterFunctions(req.path);
    if (parts.length === 0) {
      if (req.method === "POST") return "CreateFunction";
      if (req.method === "GET") return "ListFunctions";
      return undefined;
    }
    const tail = parts[parts.length - 1];
    if (tail === "invocations" && req.method === "POST") return "Invoke";
    if (tail === "code" && req.method === "PUT") return "UpdateFunctionCode";
    if (tail === "concurrency") {
      if (req.method === "PUT") return "PutFunctionConcurrency";
      if (req.method === "GET") return "GetFunctionConcurrency";
      if (req.method === "DELETE") return "DeleteFunctionConcurrency";
      return undefined;
    }
    if (tail === "url") {
      if (req.method === "POST") return "CreateFunctionUrlConfig";
      if (req.method === "GET") return "GetFunctionUrlConfig";
      if (req.method === "DELETE") return "DeleteFunctionUrlConfig";
      return undefined;
    }
    if (tail === "configuration") {
      if (req.method === "GET") return "GetFunctionConfiguration";
      if (req.method === "PUT") return "UpdateFunctionConfiguration";
      return undefined;
    }
    if (tail === "versions" && req.method === "POST") return "PublishVersion";
    if (tail === "policy") {
      if (req.method === "POST") return "AddPermission";
      if (req.method === "GET") return "GetPolicy";
      return undefined;
    }
    if (parts.length >= 2 && parts[parts.length - 2] === "policy") {
      if (req.method === "DELETE") return "RemovePermission";
      return undefined;
    }
    if (tail === "aliases") {
      if (req.method === "POST") return "CreateAlias";
      if (req.method === "GET") return "ListAliases";
      return undefined;
    }
    if (parts.length >= 2 && parts[parts.length - 2] === "aliases") {
      if (req.method === "GET") return "GetAlias";
      return undefined;
    }
    if (req.method === "GET") return "GetFunction";
    if (req.method === "DELETE") return "DeleteFunction";
    return undefined;
  },
  operations: {
    CreateFunction,
    GetFunction,
    ListFunctions,
    DeleteFunction,
    UpdateFunctionCode,
    Invoke,
    GetFunctionConfiguration,
    UpdateFunctionConfiguration,
    PublishVersion,
    CreateAlias,
    GetAlias,
    ListAliases,
    AddPermission,
    GetPolicy,
    RemovePermission,
    TagResource,
    ListTags,
    PutFunctionConcurrency,
    GetFunctionConcurrency,
    DeleteFunctionConcurrency,
    CreateFunctionUrlConfig,
    GetFunctionUrlConfig,
    DeleteFunctionUrlConfig,
    PublishLayerVersion,
    ListLayers,
    GetLayerVersion,
  },
  model,
} as const;

export default lambda;
