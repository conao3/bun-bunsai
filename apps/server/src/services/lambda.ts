import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ScopedStore,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";
import { unzip } from "./lambda/zip.ts";
import { executeHandler } from "./lambda/runtime/registry.ts";
import type { LambdaExecution } from "./lambda/runtime/types.ts";
import {
  registerEventSource,
  registerTarget,
  registerTaskInvoker,
} from "../core/events.ts";
import { parseArn, resourceName } from "../core/arn.ts";

const model = lazyServiceModel(
  () => import("../../models/lambda.json", { with: { type: "json" } }),
);

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
  CodeZipFile?: Uint8Array;
  Environment?: Record<string, string>;
  Layers?: string[];
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const arnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:lambda:${ctx.region}:${ctx.account}:function:${name}`;

const nowIso = (): string => new Date().toISOString();

const sha256Of = (input: string | Uint8Array): string => {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(input);
  return hasher.digest("base64");
};

const zipBytesOf = (value: unknown): Uint8Array | undefined => {
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string")
    return Uint8Array.from(value, (ch) => ch.charCodeAt(0) & 0xff);
  return undefined;
};

const codeZipOf = (input: Record<string, unknown>): Uint8Array | undefined => {
  const code = input["Code"];
  if (typeof code === "object" && code !== null) {
    return zipBytesOf((code as Record<string, unknown>)["ZipFile"]);
  }
  return undefined;
};

const environmentOf = (
  input: Record<string, unknown>,
): Record<string, string> | undefined => {
  const env = input["Environment"];
  if (typeof env !== "object" || env === null) return undefined;
  const variables = (env as Record<string, unknown>)["Variables"];
  if (typeof variables !== "object" || variables === null) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
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
  ...(fn.Environment !== undefined
    ? { Environment: { Variables: fn.Environment } }
    : {}),
  ...(fn.Layers !== undefined
    ? { Layers: fn.Layers.map((arn) => ({ Arn: arn })) }
    : {}),
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
  const zip = codeZipOf(input);
  const layerArns = stringListOf(input["Layers"]);
  if (layerArns.length > 0) resolveLayerArns(ctx, layerArns);
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
    CodeSize: zip?.byteLength ?? 0,
    CodeSha256: zip !== undefined ? sha256Of(zip) : sha256Of(`${name}:empty`),
    Version: "$LATEST",
    RevisionId: crypto.randomUUID(),
    LastModified: nowIso(),
    State: "Pending",
    CodeZipFile: zip,
    Environment: environmentOf(input),
    ...(layerArns.length > 0 ? { Layers: layerArns } : {}),
  };
  setTimeout(() => {
    const stored = ctx.store.get<StoredFunction>(name);
    if (stored !== undefined && stored.State === "Pending") {
      stored.State = "Active";
      ctx.store.set(name, stored);
    }
  }, 100);
  const tagsInput = input["Tags"];
  if (typeof tagsInput === "object" && tagsInput !== null) {
    const tags: Record<string, string> = {};
    for (const [k, v] of Object.entries(tagsInput as Record<string, unknown>)) {
      if (typeof v === "string") tags[k] = v;
    }
    if (Object.keys(tags).length > 0) {
      ctx.store.set(tagsKey(fn.FunctionArn), tags);
    }
  }
  ctx.store.set(name, fn);
  return configurationOf(fn);
};

const GetFunction: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(fn.FunctionArn)) ?? {};
  return {
    Configuration: configurationOf(fn),
    Code: {
      RepositoryType: "S3",
      Location: `https://bunsai-lambda.local/${fn.FunctionName}`,
    },
    Tags: tags,
  };
};

const ListFunctions: OperationHandler = (input, ctx) => {
  const functions = ctx.store
    .list<StoredFunction>()
    .map((entry) => configurationOf(entry.value));
  const maxItems =
    typeof input["MaxItems"] === "number"
      ? (input["MaxItems"] as number)
      : undefined;
  const markerRaw =
    typeof input["Marker"] === "string"
      ? (input["Marker"] as string)
      : undefined;
  const offset = markerRaw
    ? parseInt(Buffer.from(markerRaw, "base64").toString("utf8"), 10)
    : 0;
  const start = isNaN(offset) ? 0 : offset;
  const page =
    maxItems !== undefined
      ? functions.slice(start, start + maxItems)
      : functions.slice(start);
  const hasMore = start + page.length < functions.length;
  const nextMarker = hasMore
    ? Buffer.from(String(start + page.length)).toString("base64")
    : undefined;
  return {
    Functions: page,
    ...(nextMarker !== undefined ? { NextMarker: nextMarker } : {}),
  };
};

const DeleteFunction: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  ctx.store.delete(fn.FunctionName);
  ctx.store.delete(tagsKey(fn.FunctionArn));
  return {};
};

const UpdateFunctionCode: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const zip = zipBytesOf(input["ZipFile"]);
  if (zip !== undefined) {
    fn.CodeSize = zip.byteLength;
    fn.CodeSha256 = sha256Of(zip);
    fn.CodeZipFile = zip;
  }
  fn.RevisionId = crypto.randomUUID();
  fn.LastModified = nowIso();
  ctx.store.set(fn.FunctionName, fn);
  return configurationOf(fn);
};

const decodePayload = (payload: unknown): unknown => {
  const bytes =
    payload instanceof Uint8Array
      ? new TextDecoder().decode(payload)
      : typeof payload === "string"
        ? payload
        : "";
  if (bytes.trim() === "") return {};
  try {
    return JSON.parse(bytes);
  } catch {
    return bytes;
  }
};

const echoPayload = (payload: unknown): string | Uint8Array =>
  typeof payload === "string" || payload instanceof Uint8Array ? payload : "";

const jsonPayload = (value: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(value));

const reservedEnv = (
  fn: StoredFunction,
  region: string,
): Record<string, string> => ({
  AWS_LAMBDA_FUNCTION_NAME: fn.FunctionName,
  AWS_LAMBDA_FUNCTION_VERSION: fn.Version,
  AWS_LAMBDA_FUNCTION_MEMORY_SIZE: String(fn.MemorySize),
  AWS_REGION: region,
  AWS_DEFAULT_REGION: region,
  _HANDLER: fn.Handler ?? "",
});

const runFunction = async (
  fn: StoredFunction,
  event: unknown,
  region: string,
  store: ScopedStore,
): Promise<LambdaExecution> => {
  const files =
    fn.CodeZipFile !== undefined ? unzip(fn.CodeZipFile) : undefined;
  if (files === undefined || fn.Handler === undefined) {
    return { kind: "unsupported" };
  }
  const mergedFiles: Record<string, Uint8Array> = { ...files };
  if (fn.Layers !== undefined && fn.Layers.length > 0) {
    for (const arn of fn.Layers) {
      const parsed = parseLayerVersionArn(arn);
      if (parsed === undefined) continue;
      const layer = store.get<StoredLayerVersion>(
        layerVersionKey(parsed.name, parsed.version),
      );
      if (layer?.ZipFile === undefined) continue;
      const layerFiles = unzip(layer.ZipFile);
      if (layerFiles === undefined) continue;
      for (const [path, content] of Object.entries(layerFiles)) {
        mergedFiles[`opt/${path}`] = content;
      }
    }
  }
  return executeHandler({
    files: mergedFiles,
    handler: fn.Handler,
    runtime: fn.Runtime,
    event,
    env: { ...reservedEnv(fn, region), ...(fn.Environment ?? {}) },
    timeoutMs: fn.Timeout * 1000,
    nodePaths:
      fn.Layers !== undefined && fn.Layers.length > 0
        ? ["opt/nodejs/node_modules", "opt/nodejs"]
        : undefined,
    context: {
      functionName: fn.FunctionName,
      functionVersion: fn.Version,
      invokedFunctionArn: fn.FunctionArn,
      memoryLimitInMB: String(fn.MemorySize),
      awsRequestId: crypto.randomUUID(),
      logGroupName: `/aws/lambda/${fn.FunctionName}`,
      logStreamName: nowIso(),
      callbackWaitsForEmptyEventLoop: true,
    },
  });
};

const resolveQualifier = (
  ctx: ServiceContext,
  fn: StoredFunction,
  qualifier: string | undefined,
): StoredFunction => {
  if (qualifier === undefined || qualifier === "$LATEST") return fn;
  let versionNum: number;
  if (/^\d+$/.test(qualifier)) {
    versionNum = parseInt(qualifier, 10);
  } else {
    const alias = ctx.store.get<StoredAlias>(
      aliasKey(fn.FunctionName, qualifier),
    );
    if (alias === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `Alias not found: ${qualifier}`,
        404,
      );
    }
    if (alias.FunctionVersion === "$LATEST") return fn;
    versionNum = parseInt(alias.FunctionVersion, 10);
  }
  const snap = ctx.store.get<StoredVersionSnapshot>(
    snapshotKey(fn.FunctionName, versionNum),
  );
  if (snap === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Version not found: ${qualifier}`,
      404,
    );
  }
  return {
    ...fn,
    Version: String(versionNum),
    FunctionArn: `${fn.FunctionArn}:${versionNum}`,
    CodeZipFile: snap.CodeZipFile,
    Environment: snap.Environment,
    Handler: snap.Handler,
    Runtime: snap.Runtime,
    Timeout: snap.Timeout,
  };
};

const Invoke: OperationHandler = async (input, ctx) => {
  const baseFn = requireFunction(ctx, functionNameFromInput(input));
  const qualifier = stringOrUndefined(input["Qualifier"]);
  const fn = resolveQualifier(ctx, baseFn, qualifier);
  const invocationType =
    stringOrUndefined(input["InvocationType"]) ?? "RequestResponse";
  if (invocationType === "DryRun") {
    return { StatusCode: 204, ExecutedVersion: fn.Version };
  }
  if (invocationType === "Event") {
    runFunction(
      fn,
      decodePayload(input["Payload"]),
      ctx.region,
      ctx.store,
    ).catch(() => {});
    return { StatusCode: 202, ExecutedVersion: fn.Version };
  }
  const execution = await runFunction(
    fn,
    decodePayload(input["Payload"]),
    ctx.region,
    ctx.store,
  );
  if (execution.kind === "unsupported") {
    return {
      StatusCode: 200,
      Payload: echoPayload(input["Payload"]),
      ExecutedVersion: fn.Version,
    };
  }
  if (execution.kind === "unsupported_runtime") {
    return {
      StatusCode: 200,
      FunctionError: "Unhandled",
      Payload: jsonPayload({
        errorType: "Runtime.Unsupported",
        errorMessage: `Runtime ${execution.runtime ?? "unknown"} is not supported`,
        trace: [],
      }),
      ExecutedVersion: fn.Version,
    };
  }
  if (execution.kind === "host_runtime_missing") {
    return {
      StatusCode: 200,
      FunctionError: "Unhandled",
      Payload: jsonPayload({
        errorType: "Runtime.NotReady",
        errorMessage: `Runtime ${execution.runtime} requires a host interpreter that is not available: ${execution.reason}`,
        trace: [],
      }),
      ExecutedVersion: fn.Version,
    };
  }
  const logResult =
    stringOrUndefined(input["LogType"]) === "Tail"
      ? Buffer.from(execution.logs.slice(-4096)).toString("base64")
      : undefined;
  if (execution.kind === "result") {
    return {
      StatusCode: 200,
      Payload: jsonPayload(execution.payload),
      ExecutedVersion: fn.Version,
      ...(logResult !== undefined ? { LogResult: logResult } : {}),
    };
  }
  const errorBody =
    execution.kind === "timeout"
      ? {
          errorType: "Sandbox.Timedout",
          errorMessage: `${fn.FunctionName} timed out after ${fn.Timeout}.00 seconds`,
          trace: [],
        }
      : {
          errorType: execution.errorType,
          errorMessage: execution.errorMessage,
          trace: execution.trace,
        };
  return {
    StatusCode: 200,
    FunctionError: "Unhandled",
    Payload: jsonPayload(errorBody),
    ExecutedVersion: fn.Version,
    ...(logResult !== undefined ? { LogResult: logResult } : {}),
  };
};

registerTarget("lambda", async (store, resource, delivery) => {
  const fn = store.get<StoredFunction>(resource);
  if (fn === undefined) return;
  await runFunction(fn, delivery.event, store.scope.region, store);
});

registerTaskInvoker("lambda", async (ctx, functionArn, payload) => {
  const store = ctx.storeFor("lambda");
  const parsed = parseArn(functionArn);
  const name =
    parsed !== undefined ? resourceName(parsed.resource) : functionArn;
  const fn = store.get<StoredFunction>(name);
  if (fn === undefined) {
    return {
      ok: false,
      error: "Lambda.ResourceNotFoundException",
      cause: `Function not found: ${name}`,
    };
  }
  const execution = await runFunction(fn, payload, ctx.region, store);
  if (execution.kind === "result") {
    return { ok: true, result: execution.payload };
  }
  if (execution.kind === "unsupported") {
    return { ok: true, result: payload };
  }
  if (execution.kind === "unsupported_runtime") {
    return {
      ok: false,
      error: "Lambda.AWSLambdaException",
      cause: `Runtime ${execution.runtime ?? "unknown"} is not supported`,
    };
  }
  if (execution.kind === "host_runtime_missing") {
    return {
      ok: false,
      error: "Lambda.AWSLambdaException",
      cause: `Runtime ${execution.runtime} requires a host interpreter that is not available: ${execution.reason}`,
    };
  }
  const cause =
    execution.kind === "timeout"
      ? `${fn.FunctionName} timed out after ${fn.Timeout} seconds`
      : execution.errorMessage;
  return { ok: false, error: "Lambda.AWSLambdaException", cause };
});

registerEventSource(async (ctx, sourceArn, records) => {
  const parsed = parseArn(sourceArn);
  if (parsed === undefined) return false;
  const store = ctx.storeFor("lambda");
  let consumed = false;
  for (const { key, value } of store.list<StoredEventSourceMapping>()) {
    if (!key.startsWith("esm:")) continue;
    if (value.EventSourceArn !== sourceArn) continue;
    if (value.Enabled === false || value.State === "Disabled") continue;
    const name = resourceName(parseArn(value.FunctionArn)?.resource ?? "");
    const fn = store.get<StoredFunction>(name);
    if (fn === undefined) continue;
    const execution = await runFunction(
      fn,
      { Records: records },
      parsed.region,
      store,
    );
    if (execution.kind === "result") consumed = true;
  }
  return consumed;
});

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
  const environment = environmentOf(input);
  if (environment !== undefined) fn.Environment = environment;
  if (Array.isArray(input["Layers"])) {
    const layerArns = stringListOf(input["Layers"]);
    if (layerArns.length > 0) resolveLayerArns(ctx, layerArns);
    fn.Layers = layerArns.length > 0 ? layerArns : undefined;
  }
  fn.RevisionId = crypto.randomUUID();
  fn.LastModified = nowIso();
  ctx.store.set(fn.FunctionName, fn);
  return configurationOf(fn);
};

type StoredVersion = {
  number: number;
};

type StoredVersionSnapshot = {
  CodeZipFile: Uint8Array | undefined;
  Environment: Record<string, string> | undefined;
  Handler: string | undefined;
  Runtime: string | undefined;
  Timeout: number;
};

const versionKey = (name: string): string => `version:${name}`;

const snapshotKey = (name: string, ver: number): string =>
  `version:snapshot:${name}:${ver}`;

const PublishVersion: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const key = versionKey(fn.FunctionName);
  const existing = ctx.store.get<StoredVersion>(key);
  const next = (existing?.number ?? 0) + 1;
  ctx.store.set(key, { number: next });
  const snapshot: StoredVersionSnapshot = {
    CodeZipFile: fn.CodeZipFile,
    Environment: fn.Environment,
    Handler: fn.Handler,
    Runtime: fn.Runtime,
    Timeout: fn.Timeout,
  };
  ctx.store.set(snapshotKey(fn.FunctionName, next), snapshot);
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
  ZipFile?: Uint8Array;
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

const parseLayerVersionArn = (
  arn: string,
): { name: string; version: number } | undefined => {
  const parsed = parseArn(arn);
  if (parsed === undefined) return undefined;
  const parts = parsed.resource.split(":");
  if (parts[0] !== "layer" || parts.length < 3) return undefined;
  const name = parts[1];
  const version = parseInt(parts[2] ?? "", 10);
  if (name === undefined || name === "" || !Number.isFinite(version))
    return undefined;
  return { name, version };
};

const resolveLayerArns = (
  ctx: ServiceContext,
  arns: string[],
): StoredLayerVersion[] =>
  arns.map((arn) => {
    const parsed = parseLayerVersionArn(arn);
    if (parsed === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `Layer version not found: ${arn}`,
        404,
      );
    }
    const layer = ctx.store.get<StoredLayerVersion>(
      layerVersionKey(parsed.name, parsed.version),
    );
    if (layer === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `Layer version not found: ${arn}`,
        404,
      );
    }
    return layer;
  });

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

const layerContentZipOf = (
  input: Record<string, unknown>,
): Uint8Array | undefined => {
  const content = input["Content"];
  if (typeof content === "object" && content !== null) {
    return zipBytesOf((content as Record<string, unknown>)["ZipFile"]);
  }
  return undefined;
};

const layerContentSize = (input: Record<string, unknown>): number => {
  const zip = layerContentZipOf(input);
  return zip !== undefined ? zip.byteLength : 0;
};

const PublishLayerVersion: OperationHandler = (input, ctx) => {
  const name = layerNameFromInput(input);
  const counterKey = layerCounterKey(name);
  const existing = ctx.store.get<{ value: number }>(counterKey);
  const version = (existing?.value ?? 0) + 1;
  ctx.store.set(counterKey, { value: version });
  const layerArn = layerArnOf(ctx, name);
  const zipFile = layerContentZipOf(input);
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
    ...(zipFile !== undefined ? { ZipFile: zipFile } : {}),
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

const DeleteAlias: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const aliasName = aliasNameFromInput(input);
  const key = aliasKey(fn.FunctionName, aliasName);
  if (ctx.store.get<StoredAlias>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Alias not found: ${aliasName}`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const UpdateAlias: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const aliasName = aliasNameFromInput(input);
  const key = aliasKey(fn.FunctionName, aliasName);
  const alias = ctx.store.get<StoredAlias>(key);
  if (alias === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Alias not found: ${aliasName}`,
      404,
    );
  }
  const version = stringOrUndefined(input["FunctionVersion"]);
  if (version !== undefined) alias.FunctionVersion = version;
  const description = stringOrUndefined(input["Description"]);
  if (description !== undefined) alias.Description = description;
  alias.RevisionId = crypto.randomUUID();
  ctx.store.set(key, alias);
  return aliasConfigurationOf(ctx, fn.FunctionName, alias);
};

type StoredEventSourceMapping = {
  UUID: string;
  EventSourceArn: string | undefined;
  FunctionArn: string;
  State: string;
  BatchSize: number;
  LastModified: string;
  StartingPosition: string | undefined;
  Enabled: boolean;
  FilterCriteria: unknown;
  EventSourceMappingArn: string;
};

const esmKey = (uuid: string): string => `esm:${uuid}`;

const esmResponse = (
  esm: StoredEventSourceMapping,
): Record<string, unknown> => ({
  UUID: esm.UUID,
  EventSourceArn: esm.EventSourceArn,
  FunctionArn: esm.FunctionArn,
  State: esm.State,
  BatchSize: esm.BatchSize,
  LastModified: esm.LastModified,
  StartingPosition: esm.StartingPosition,
  StateTransitionReason: "User action",
  EventSourceMappingArn: esm.EventSourceMappingArn,
});

const CreateEventSourceMapping: OperationHandler = (input, ctx) => {
  const fnName = functionNameFromInput(input);
  const fn = requireFunction(ctx, fnName);
  const uuid = crypto.randomUUID();
  const esm: StoredEventSourceMapping = {
    UUID: uuid,
    EventSourceArn: stringOrUndefined(input["EventSourceArn"]),
    FunctionArn: fn.FunctionArn,
    State: "Enabled",
    BatchSize: typeof input["BatchSize"] === "number" ? input["BatchSize"] : 10,
    LastModified: nowIso(),
    StartingPosition: stringOrUndefined(input["StartingPosition"]),
    Enabled: input["Enabled"] !== false,
    FilterCriteria: input["FilterCriteria"],
    EventSourceMappingArn: `arn:aws:lambda:${ctx.region}:${ctx.account}:event-source-mapping:${uuid}`,
  };
  ctx.store.set(esmKey(uuid), esm);
  return esmResponse(esm);
};

const uuidFromInput = (input: Record<string, unknown>): string => {
  const uuid = input["UUID"];
  if (typeof uuid === "string" && uuid !== "") return uuid;
  throw awsError("InvalidParameterValueException", "UUID is required.", 400);
};

const requireEsm = (
  ctx: ServiceContext,
  uuid: string,
): StoredEventSourceMapping => {
  const esm = ctx.store.get<StoredEventSourceMapping>(esmKey(uuid));
  if (esm === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Event source mapping not found: ${uuid}`,
      404,
    );
  }
  return esm;
};

const GetEventSourceMapping: OperationHandler = (input, ctx) => {
  return esmResponse(requireEsm(ctx, uuidFromInput(input)));
};

const DeleteEventSourceMapping: OperationHandler = (input, ctx) => {
  const esm = requireEsm(ctx, uuidFromInput(input));
  ctx.store.delete(esmKey(esm.UUID));
  return esmResponse({ ...esm, State: "Deleting" });
};

const UpdateEventSourceMapping: OperationHandler = (input, ctx) => {
  const esm = requireEsm(ctx, uuidFromInput(input));
  if (typeof input["BatchSize"] === "number")
    esm.BatchSize = input["BatchSize"];
  if (input["Enabled"] === false) esm.State = "Disabled";
  else if (input["Enabled"] === true) esm.State = "Enabled";
  esm.LastModified = nowIso();
  ctx.store.set(esmKey(esm.UUID), esm);
  return esmResponse(esm);
};

const ListEventSourceMappings: OperationHandler = (input, ctx) => {
  const functionName = stringOrUndefined(input["FunctionName"] as unknown);
  const mappings = ctx.store
    .list<StoredEventSourceMapping>()
    .filter((entry) => entry.key.startsWith("esm:"))
    .filter(
      (entry) =>
        functionName === undefined ||
        entry.value.FunctionArn.includes(functionName),
    )
    .map((entry) => esmResponse(entry.value));
  return { EventSourceMappings: mappings };
};

type StoredCodeSigningConfig = {
  CodeSigningConfigId: string;
  CodeSigningConfigArn: string;
  Description: string | undefined;
  AllowedPublishers: { SigningProfileVersionArns: string[] };
  CodeSigningPolicies: { UntrustedArtifactOnDeployment: string };
  LastModified: string;
};

const cscKey = (arn: string): string => `csc:${arn}`;

const cscResponse = (
  csc: StoredCodeSigningConfig,
): Record<string, unknown> => ({
  CodeSigningConfigId: csc.CodeSigningConfigId,
  CodeSigningConfigArn: csc.CodeSigningConfigArn,
  Description: csc.Description,
  AllowedPublishers: csc.AllowedPublishers,
  CodeSigningPolicies: csc.CodeSigningPolicies,
  LastModified: csc.LastModified,
});

const CreateCodeSigningConfig: OperationHandler = (input, ctx) => {
  const id = `csc-${crypto.randomUUID().replace(/-/g, "").slice(0, 17)}`;
  const arn = `arn:aws:lambda:${ctx.region}:${ctx.account}:code-signing-config:${id}`;
  const allowedPublishers =
    (input["AllowedPublishers"] as Record<string, unknown>) ?? {};
  const policies =
    (input["CodeSigningPolicies"] as Record<string, unknown>) ?? {};
  const csc: StoredCodeSigningConfig = {
    CodeSigningConfigId: id,
    CodeSigningConfigArn: arn,
    Description: stringOrUndefined(input["Description"]),
    AllowedPublishers: {
      SigningProfileVersionArns: stringListOf(
        allowedPublishers["SigningProfileVersionArns"],
      ),
    },
    CodeSigningPolicies: {
      UntrustedArtifactOnDeployment:
        stringOrUndefined(policies["UntrustedArtifactOnDeployment"]) ?? "Warn",
    },
    LastModified: nowIso(),
  };
  ctx.store.set(cscKey(arn), csc);
  return { CodeSigningConfig: cscResponse(csc) };
};

const cscArnFromInput = (input: Record<string, unknown>): string => {
  const arn = input["CodeSigningConfigArn"];
  if (typeof arn === "string" && arn !== "") return arn;
  throw awsError(
    "InvalidParameterValueException",
    "CodeSigningConfigArn is required.",
    400,
  );
};

const requireCsc = (
  ctx: ServiceContext,
  arn: string,
): StoredCodeSigningConfig => {
  const csc = ctx.store.get<StoredCodeSigningConfig>(cscKey(arn));
  if (csc === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Code signing config not found: ${arn}`,
      404,
    );
  }
  return csc;
};

const GetCodeSigningConfig: OperationHandler = (input, ctx) => {
  const csc = requireCsc(ctx, cscArnFromInput(input));
  return { CodeSigningConfig: cscResponse(csc) };
};

const DeleteCodeSigningConfig: OperationHandler = (input, ctx) => {
  const arn = cscArnFromInput(input);
  requireCsc(ctx, arn);
  ctx.store.delete(cscKey(arn));
  return {};
};

const UpdateCodeSigningConfig: OperationHandler = (input, ctx) => {
  const arn = cscArnFromInput(input);
  const csc = requireCsc(ctx, arn);
  const description = stringOrUndefined(input["Description"]);
  if (description !== undefined) csc.Description = description;
  const allowedPublishers = input["AllowedPublishers"] as
    | Record<string, unknown>
    | undefined;
  if (allowedPublishers !== undefined) {
    csc.AllowedPublishers = {
      SigningProfileVersionArns: stringListOf(
        allowedPublishers["SigningProfileVersionArns"],
      ),
    };
  }
  const policies = input["CodeSigningPolicies"] as
    | Record<string, unknown>
    | undefined;
  if (policies !== undefined) {
    const policy = stringOrUndefined(policies["UntrustedArtifactOnDeployment"]);
    if (policy !== undefined)
      csc.CodeSigningPolicies.UntrustedArtifactOnDeployment = policy;
  }
  csc.LastModified = nowIso();
  ctx.store.set(cscKey(arn), csc);
  return { CodeSigningConfig: cscResponse(csc) };
};

const ListCodeSigningConfigs: OperationHandler = (input, ctx) => {
  const configs = ctx.store
    .list<StoredCodeSigningConfig>()
    .filter((entry) => entry.key.startsWith("csc:"))
    .map((entry) => cscResponse(entry.value));
  return { CodeSigningConfigs: configs };
};

const fnCscKey = (name: string): string => `fn-csc:${name}`;

const PutFunctionCodeSigningConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const arn = cscArnFromInput(input);
  requireCsc(ctx, arn);
  ctx.store.set(fnCscKey(fn.FunctionName), { arn });
  return { CodeSigningConfigArn: arn, FunctionName: fn.FunctionName };
};

const GetFunctionCodeSigningConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const stored = ctx.store.get<{ arn: string }>(fnCscKey(fn.FunctionName));
  if (stored === undefined) {
    return { FunctionName: fn.FunctionName };
  }
  return { CodeSigningConfigArn: stored.arn, FunctionName: fn.FunctionName };
};

const DeleteFunctionCodeSigningConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  ctx.store.delete(fnCscKey(fn.FunctionName));
  return {};
};

const ListFunctionsByCodeSigningConfig: OperationHandler = (input, ctx) => {
  const arn = cscArnFromInput(input);
  const functions = ctx.store
    .list<{ arn: string }>()
    .filter(
      (entry) => entry.key.startsWith("fn-csc:") && entry.value.arn === arn,
    )
    .map((entry) => {
      const name = entry.key.slice("fn-csc:".length);
      return arnOf(ctx, name);
    });
  return { FunctionArns: functions };
};

type StoredEventInvokeConfig = {
  FunctionArn: string;
  MaximumRetryAttempts: number | undefined;
  MaximumEventAgeInSeconds: number | undefined;
  DestinationConfig: unknown;
  LastModified: string;
};

const fnEicKey = (name: string): string => `fn-eic:${name}`;

const eicResponse = (
  eic: StoredEventInvokeConfig,
): Record<string, unknown> => ({
  FunctionArn: eic.FunctionArn,
  MaximumRetryAttempts: eic.MaximumRetryAttempts,
  MaximumEventAgeInSeconds: eic.MaximumEventAgeInSeconds,
  DestinationConfig: eic.DestinationConfig,
  LastModified: eic.LastModified,
});

const upsertEic = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
): StoredEventInvokeConfig => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const key = fnEicKey(fn.FunctionName);
  const existing = ctx.store.get<StoredEventInvokeConfig>(key);
  const eic: StoredEventInvokeConfig = existing ?? {
    FunctionArn: fn.FunctionArn,
    MaximumRetryAttempts: undefined,
    MaximumEventAgeInSeconds: undefined,
    DestinationConfig: undefined,
    LastModified: nowIso(),
  };
  if (typeof input["MaximumRetryAttempts"] === "number")
    eic.MaximumRetryAttempts = input["MaximumRetryAttempts"];
  if (typeof input["MaximumEventAgeInSeconds"] === "number")
    eic.MaximumEventAgeInSeconds = input["MaximumEventAgeInSeconds"];
  if (input["DestinationConfig"] !== undefined)
    eic.DestinationConfig = input["DestinationConfig"];
  eic.LastModified = nowIso();
  ctx.store.set(key, eic);
  return eic;
};

const PutFunctionEventInvokeConfig: OperationHandler = (input, ctx) => {
  return eicResponse(upsertEic(input, ctx));
};

const UpdateFunctionEventInvokeConfig: OperationHandler = (input, ctx) => {
  return eicResponse(upsertEic(input, ctx));
};

const GetFunctionEventInvokeConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const eic = ctx.store.get<StoredEventInvokeConfig>(fnEicKey(fn.FunctionName));
  if (eic === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Event invoke config not found for function: ${fn.FunctionName}`,
      404,
    );
  }
  return eicResponse(eic);
};

const DeleteFunctionEventInvokeConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  ctx.store.delete(fnEicKey(fn.FunctionName));
  return {};
};

const ListFunctionEventInvokeConfigs: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const eic = ctx.store.get<StoredEventInvokeConfig>(fnEicKey(fn.FunctionName));
  return { FunctionEventInvokeConfigs: eic ? [eicResponse(eic)] : [] };
};

type StoredLayerPolicy = {
  Statement: StoredStatement[];
  RevisionId: string;
};

const layerPolicyKey = (name: string, version: number): string =>
  `layer-policy:${name}:${version}`;

const requireLayerVersion = (
  ctx: ServiceContext,
  name: string,
  version: number,
): StoredLayerVersion => {
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
  return layer;
};

const versionNumberFromInput = (input: Record<string, unknown>): number => {
  const raw = input["VersionNumber"];
  const v =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : Number.NaN;
  if (!Number.isFinite(v)) {
    throw awsError(
      "InvalidParameterValueException",
      "VersionNumber is required.",
      400,
    );
  }
  return v;
};

const AddLayerVersionPermission: OperationHandler = (input, ctx) => {
  const name = layerNameFromInput(input);
  const version = versionNumberFromInput(input);
  requireLayerVersion(ctx, name, version);
  const statementId = stringOrUndefined(input["StatementId"]);
  if (statementId === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "StatementId is required.",
      400,
    );
  }
  const key = layerPolicyKey(name, version);
  const existing = ctx.store.get<StoredLayerPolicy>(key) ?? {
    Statement: [],
    RevisionId: crypto.randomUUID(),
  };
  if (existing.Statement.some((s) => s.Sid === statementId)) {
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
    Action: "lambda:GetLayerVersion",
    Resource: `arn:aws:lambda:${ctx.region}:${ctx.account}:layer:${name}:${version}`,
  };
  existing.Statement.push(statement);
  existing.RevisionId = crypto.randomUUID();
  ctx.store.set(key, existing);
  return {
    Statement: JSON.stringify(statement),
    RevisionId: existing.RevisionId,
  };
};

const GetLayerVersionPolicy: OperationHandler = (input, ctx) => {
  const name = layerNameFromInput(input);
  const version = versionNumberFromInput(input);
  requireLayerVersion(ctx, name, version);
  const policy = ctx.store.get<StoredLayerPolicy>(
    layerPolicyKey(name, version),
  );
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No policy found for layer: ${name}:${version}`,
      404,
    );
  }
  return { Policy: JSON.stringify(policy), RevisionId: policy.RevisionId };
};

const RemoveLayerVersionPermission: OperationHandler = (input, ctx) => {
  const name = layerNameFromInput(input);
  const version = versionNumberFromInput(input);
  requireLayerVersion(ctx, name, version);
  const statementId = stringOrUndefined(input["StatementId"]);
  const key = layerPolicyKey(name, version);
  const policy = ctx.store.get<StoredLayerPolicy>(key);
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
  } else {
    policy.Statement = next;
    policy.RevisionId = crypto.randomUUID();
    ctx.store.set(key, policy);
  }
  return {};
};

const DeleteLayerVersion: OperationHandler = (input, ctx) => {
  const name = layerNameFromInput(input);
  const version = versionNumberFromInput(input);
  requireLayerVersion(ctx, name, version);
  ctx.store.delete(layerVersionKey(name, version));
  ctx.store.delete(layerPolicyKey(name, version));
  return {};
};

const ListLayerVersions: OperationHandler = (input, ctx) => {
  const name = layerNameFromInput(input);
  const versions = ctx.store
    .list<StoredLayerVersion>()
    .filter((entry) => entry.key.startsWith(`layer:${name}:`))
    .map((entry) => ({
      LayerVersionArn: entry.value.LayerVersionArn,
      Version: entry.value.Version,
      Description: entry.value.Description,
      CreatedDate: entry.value.CreatedDate,
      CompatibleRuntimes: entry.value.CompatibleRuntimes,
      CompatibleArchitectures: entry.value.CompatibleArchitectures,
      LicenseInfo: entry.value.LicenseInfo,
    }));
  return { LayerVersions: versions };
};

const GetLayerVersionByArn: OperationHandler = (input, ctx) => {
  const arn = input["Arn"];
  if (typeof arn !== "string" || arn === "") {
    throw awsError("InvalidParameterValueException", "Arn is required.", 400);
  }
  const layer = ctx.store
    .list<StoredLayerVersion>()
    .find(
      (entry) =>
        entry.key.startsWith("layer:") && entry.value.LayerVersionArn === arn,
    )?.value;
  if (layer === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Layer version not found: ${arn}`,
      404,
    );
  }
  return layerVersionResponse(layer);
};

type StoredProvisionedConcurrency = {
  FunctionArn: string;
  RequestedProvisionedConcurrentExecutions: number;
  Status: string;
  LastModified: string;
};

const pcKey = (name: string): string => `pc:${name}`;

const pcResponse = (
  pc: StoredProvisionedConcurrency,
): Record<string, unknown> => ({
  RequestedProvisionedConcurrentExecutions:
    pc.RequestedProvisionedConcurrentExecutions,
  AvailableProvisionedConcurrentExecutions:
    pc.RequestedProvisionedConcurrentExecutions,
  AllocatedProvisionedConcurrentExecutions:
    pc.RequestedProvisionedConcurrentExecutions,
  Status: pc.Status,
  LastModified: pc.LastModified,
});

const PutProvisionedConcurrencyConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const requested = input["ProvisionedConcurrentExecutions"];
  if (typeof requested !== "number") {
    throw awsError(
      "InvalidParameterValueException",
      "ProvisionedConcurrentExecutions is required.",
      400,
    );
  }
  const pc: StoredProvisionedConcurrency = {
    FunctionArn: fn.FunctionArn,
    RequestedProvisionedConcurrentExecutions: requested,
    Status: "READY",
    LastModified: nowIso(),
  };
  ctx.store.set(pcKey(fn.FunctionName), pc);
  return pcResponse(pc);
};

const GetProvisionedConcurrencyConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const pc = ctx.store.get<StoredProvisionedConcurrency>(
    pcKey(fn.FunctionName),
  );
  if (pc === undefined) {
    throw awsError(
      "ProvisionedConcurrencyConfigNotFoundException",
      `No provisioned concurrency config for function: ${fn.FunctionName}`,
      404,
    );
  }
  return pcResponse(pc);
};

const DeleteProvisionedConcurrencyConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  ctx.store.delete(pcKey(fn.FunctionName));
  return {};
};

const ListProvisionedConcurrencyConfigs: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const configs = ctx.store
    .list<StoredProvisionedConcurrency>()
    .filter(
      (entry) =>
        entry.key.startsWith("pc:") &&
        entry.value.FunctionArn === fn.FunctionArn,
    )
    .map((entry) => ({
      ...pcResponse(entry.value),
      FunctionArn: entry.value.FunctionArn,
    }));
  return { ProvisionedConcurrencyConfigs: configs };
};

const fnRecursionKey = (name: string): string => `fn-recursion:${name}`;

const GetFunctionRecursionConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const stored = ctx.store.get<{ RecursiveLoop: string }>(
    fnRecursionKey(fn.FunctionName),
  );
  return { RecursiveLoop: stored?.RecursiveLoop ?? "Terminate" };
};

const PutFunctionRecursionConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const recursiveLoop =
    stringOrUndefined(input["RecursiveLoop"]) ?? "Terminate";
  ctx.store.set(fnRecursionKey(fn.FunctionName), {
    RecursiveLoop: recursiveLoop,
  });
  return { RecursiveLoop: recursiveLoop };
};

const fnScalingKey = (name: string): string => `fn-scaling:${name}`;

const GetFunctionScalingConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const stored = ctx.store.get<Record<string, unknown>>(
    fnScalingKey(fn.FunctionName),
  );
  return {
    FunctionArn: fn.FunctionArn,
    AppliedFunctionScalingConfig: stored ?? {},
    RequestedFunctionScalingConfig: stored ?? {},
  };
};

const PutFunctionScalingConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const cfg = (input["FunctionScalingConfig"] as Record<string, unknown>) ?? {};
  ctx.store.set(fnScalingKey(fn.FunctionName), cfg);
  return { FunctionState: fn.State };
};

const fnRuntimeKey = (name: string): string => `fn-runtime:${name}`;

const GetRuntimeManagementConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const stored = ctx.store.get<{
    UpdateRuntimeOn: string;
    RuntimeVersionArn?: string;
  }>(fnRuntimeKey(fn.FunctionName));
  return {
    UpdateRuntimeOn: stored?.UpdateRuntimeOn ?? "Auto",
    RuntimeVersionArn: stored?.RuntimeVersionArn,
    FunctionArn: fn.FunctionArn,
  };
};

const PutRuntimeManagementConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const updateRuntimeOn = stringOrUndefined(input["UpdateRuntimeOn"]) ?? "Auto";
  const runtimeVersionArn = stringOrUndefined(input["RuntimeVersionArn"]);
  ctx.store.set(fnRuntimeKey(fn.FunctionName), {
    UpdateRuntimeOn: updateRuntimeOn,
    RuntimeVersionArn: runtimeVersionArn,
  });
  return {
    UpdateRuntimeOn: updateRuntimeOn,
    FunctionArn: fn.FunctionArn,
    RuntimeVersionArn: runtimeVersionArn,
  };
};

const GetAccountSettings: OperationHandler = (_input, ctx) => {
  const totalReserved = ctx.store
    .list<{ value: number }>()
    .filter((e) => e.key.startsWith("concurrency:"))
    .reduce((sum, e) => sum + e.value.value, 0);
  return {
    AccountLimit: {
      TotalCodeSize: 80530636800,
      CodeSizeUnzipped: 262144000,
      CodeSizeZipped: 52428800,
      ConcurrentExecutions: 1000,
      UnreservedConcurrentExecutions: Math.max(0, 1000 - totalReserved),
    },
    AccountUsage: {
      TotalCodeSize: 0,
      FunctionCount: 0,
    },
  };
};

const ListVersionsByFunction: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const key = versionKey(fn.FunctionName);
  const stored = ctx.store.get<StoredVersion>(key);
  const versions: Record<string, unknown>[] = [
    { ...configurationOf(fn), Version: "$LATEST" },
  ];
  if (stored !== undefined) {
    for (let i = 1; i <= stored.number; i++) {
      versions.push({
        ...configurationOf(fn),
        Version: String(i),
        FunctionArn: `${fn.FunctionArn}:${i}`,
      });
    }
  }
  return { Versions: versions };
};

const ListFunctionUrlConfigs: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const config = ctx.store.get<StoredUrlConfig>(urlConfigKey(fn.FunctionName));
  return { FunctionUrlConfigs: config ? [urlConfigResponse(config)] : [] };
};

const UpdateFunctionUrlConfig: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const key = urlConfigKey(fn.FunctionName);
  const config = ctx.store.get<StoredUrlConfig>(key);
  if (config === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Function url config not found: ${fn.FunctionName}`,
      404,
    );
  }
  const authType = stringOrUndefined(input["AuthType"]);
  if (authType !== undefined) config.AuthType = authType;
  const cors = corsFromInput(input["Cors"]);
  if (cors !== undefined) config.Cors = cors;
  const invokeMode = stringOrUndefined(input["InvokeMode"]);
  if (invokeMode !== undefined) config.InvokeMode = invokeMode;
  config.LastModifiedTime = nowIso();
  ctx.store.set(key, config);
  return urlConfigResponse(config);
};

const InvokeAsync: OperationHandler = (input, ctx) => {
  requireFunction(ctx, functionNameFromInput(input));
  return { Status: 202 };
};

const InvokeWithResponseStream: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const payload = input["Payload"];
  return {
    StatusCode: 200,
    ExecutedVersion: fn.Version,
    ResponseStreamContentType: "application/vnd.amazon.eventstream",
    Payload:
      typeof payload === "string" || payload instanceof Uint8Array
        ? payload
        : "",
  };
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = resourceArnFromInput(input);
  const key = tagsKey(arn);
  const tags = ctx.store.get<Record<string, string>>(key) ?? {};
  const tagKeys = input["TagKeys"];
  if (Array.isArray(tagKeys)) {
    for (const k of tagKeys) {
      if (typeof k === "string") delete tags[k];
    }
  }
  ctx.store.set(key, tags);
  return {};
};

type StoredCapacityProvider = {
  CapacityProviderName: string;
  CapacityProviderArn: string;
  State: string;
  LastModified: string;
};

const cpProviderKey = (name: string): string => `capacity-provider:${name}`;

const cpProviderResponse = (
  cp: StoredCapacityProvider,
): Record<string, unknown> => ({
  CapacityProviderArn: cp.CapacityProviderArn,
  State: cp.State,
  LastModified: cp.LastModified,
});

const cpNameFromInput = (input: Record<string, unknown>): string => {
  const name = input["CapacityProviderName"];
  if (typeof name === "string" && name !== "") return name;
  throw awsError(
    "InvalidParameterValueException",
    "CapacityProviderName is required.",
    400,
  );
};

const requireCapacityProvider = (
  ctx: ServiceContext,
  name: string,
): StoredCapacityProvider => {
  const cp = ctx.store.get<StoredCapacityProvider>(cpProviderKey(name));
  if (cp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Capacity provider not found: ${name}`,
      404,
    );
  }
  return cp;
};

const CreateCapacityProvider: OperationHandler = (input, ctx) => {
  const name = cpNameFromInput(input);
  if (
    ctx.store.get<StoredCapacityProvider>(cpProviderKey(name)) !== undefined
  ) {
    throw awsError(
      "ResourceConflictException",
      `Capacity provider already exists: ${name}`,
      409,
    );
  }
  const arn = `arn:aws:lambda:${ctx.region}:${ctx.account}:capacity-provider:${name}`;
  const cp: StoredCapacityProvider = {
    CapacityProviderName: name,
    CapacityProviderArn: arn,
    State: "Active",
    LastModified: nowIso(),
  };
  ctx.store.set(cpProviderKey(name), cp);
  return { CapacityProvider: cpProviderResponse(cp) };
};

const GetCapacityProvider: OperationHandler = (input, ctx) => {
  const cp = requireCapacityProvider(ctx, cpNameFromInput(input));
  return { CapacityProvider: cpProviderResponse(cp) };
};

const DeleteCapacityProvider: OperationHandler = (input, ctx) => {
  const name = cpNameFromInput(input);
  requireCapacityProvider(ctx, name);
  ctx.store.delete(cpProviderKey(name));
  return {};
};

const UpdateCapacityProvider: OperationHandler = (input, ctx) => {
  const name = cpNameFromInput(input);
  const cp = requireCapacityProvider(ctx, name);
  cp.LastModified = nowIso();
  ctx.store.set(cpProviderKey(name), cp);
  return { CapacityProvider: cpProviderResponse(cp) };
};

const ListCapacityProviders: OperationHandler = (input, ctx) => {
  const providers = ctx.store
    .list<StoredCapacityProvider>()
    .filter((entry) => entry.key.startsWith("capacity-provider:"))
    .map((entry) => cpProviderResponse(entry.value));
  return { CapacityProviders: providers };
};

const ListFunctionVersionsByCapacityProvider: OperationHandler = (
  input,
  ctx,
) => {
  const name = cpNameFromInput(input);
  requireCapacityProvider(ctx, name);
  return { FunctionVersions: [] };
};

type StoredDurableExecution = {
  DurableExecutionArn: string;
  DurableExecutionName: string;
  FunctionArn: string;
  Status: string;
  StartTimestamp: string;
  EndTimestamp: string | undefined;
  Version: string;
};

const deKey = (arn: string): string => `durable-execution:${arn}`;

const deResponse = (de: StoredDurableExecution): Record<string, unknown> => ({
  DurableExecutionArn: de.DurableExecutionArn,
  DurableExecutionName: de.DurableExecutionName,
  FunctionArn: de.FunctionArn,
  Status: de.Status,
  StartTimestamp: de.StartTimestamp,
  EndTimestamp: de.EndTimestamp,
  Version: de.Version,
  InputPayload: undefined,
  Result: undefined,
  Error: undefined,
  TraceHeader: undefined,
});

const durableArnFromInput = (input: Record<string, unknown>): string => {
  const arn = input["DurableExecutionArn"];
  if (typeof arn === "string" && arn !== "") return arn;
  throw awsError(
    "InvalidParameterValueException",
    "DurableExecutionArn is required.",
    400,
  );
};

const requireDurableExecution = (
  ctx: ServiceContext,
  arn: string,
): StoredDurableExecution => {
  const de = ctx.store.get<StoredDurableExecution>(deKey(arn));
  if (de === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Durable execution not found: ${arn}`,
      404,
    );
  }
  return de;
};

const GetDurableExecution: OperationHandler = (input, ctx) => {
  return deResponse(requireDurableExecution(ctx, durableArnFromInput(input)));
};

const GetDurableExecutionHistory: OperationHandler = (input, ctx) => {
  requireDurableExecution(ctx, durableArnFromInput(input));
  return { Events: [], NextMarker: undefined };
};

const GetDurableExecutionState: OperationHandler = (input, ctx) => {
  requireDurableExecution(ctx, durableArnFromInput(input));
  return { Operations: [], NextMarker: undefined };
};

const ListDurableExecutionsByFunction: OperationHandler = (input, ctx) => {
  const fn = requireFunction(ctx, functionNameFromInput(input));
  const executions = ctx.store
    .list<StoredDurableExecution>()
    .filter(
      (entry) =>
        entry.key.startsWith("durable-execution:") &&
        entry.value.FunctionArn === fn.FunctionArn,
    )
    .map((entry) => deResponse(entry.value));
  return { DurableExecutions: executions };
};

const CheckpointDurableExecution: OperationHandler = (input, ctx) => {
  const de = requireDurableExecution(ctx, durableArnFromInput(input));
  return deResponse(de);
};

const StopDurableExecution: OperationHandler = (input, ctx) => {
  const arn = durableArnFromInput(input);
  const de = requireDurableExecution(ctx, arn);
  de.Status = "Stopped";
  de.EndTimestamp = nowIso();
  ctx.store.set(deKey(arn), de);
  return deResponse(de);
};

const SendDurableExecutionCallbackSuccess: OperationHandler = (input, _ctx) => {
  const id = input["CallbackId"];
  if (typeof id !== "string" || id === "") {
    throw awsError(
      "InvalidParameterValueException",
      "CallbackId is required.",
      400,
    );
  }
  return {};
};

const SendDurableExecutionCallbackFailure: OperationHandler = (input, _ctx) => {
  const id = input["CallbackId"];
  if (typeof id !== "string" || id === "") {
    throw awsError(
      "InvalidParameterValueException",
      "CallbackId is required.",
      400,
    );
  }
  return {};
};

const SendDurableExecutionCallbackHeartbeat: OperationHandler = (
  input,
  _ctx,
) => {
  const id = input["CallbackId"];
  if (typeof id !== "string" || id === "") {
    throw awsError(
      "InvalidParameterValueException",
      "CallbackId is required.",
      400,
    );
  }
  return {};
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
    if (req.path.includes("/2016-08-19/account-settings")) {
      if (req.method === "GET") return "GetAccountSettings";
      return undefined;
    }
    if (req.path.includes("/2015-03-31/event-source-mappings")) {
      const idx = req.path.indexOf("/2015-03-31/event-source-mappings");
      const tail = req.path.slice(
        idx + "/2015-03-31/event-source-mappings".length,
      );
      if (tail === "" || tail === "/") {
        if (req.method === "POST") return "CreateEventSourceMapping";
        if (req.method === "GET") return "ListEventSourceMappings";
        return undefined;
      }
      if (req.method === "GET") return "GetEventSourceMapping";
      if (req.method === "PUT") return "UpdateEventSourceMapping";
      if (req.method === "DELETE") return "DeleteEventSourceMapping";
      return undefined;
    }
    if (req.path.includes("/2020-04-22/code-signing-configs")) {
      const idx = req.path.indexOf("/2020-04-22/code-signing-configs");
      const rest = req.path.slice(
        idx + "/2020-04-22/code-signing-configs".length,
      );
      const restParts = rest.split("/").filter((p) => p !== "");
      if (restParts.length === 0) {
        if (req.method === "POST") return "CreateCodeSigningConfig";
        if (req.method === "GET") return "ListCodeSigningConfigs";
        return undefined;
      }
      if (restParts[restParts.length - 1] === "functions") {
        if (req.method === "GET") return "ListFunctionsByCodeSigningConfig";
        return undefined;
      }
      if (restParts.length === 1) {
        if (req.method === "GET") return "GetCodeSigningConfig";
        if (req.method === "DELETE") return "DeleteCodeSigningConfig";
        if (req.method === "PUT") return "UpdateCodeSigningConfig";
        return undefined;
      }
      return undefined;
    }
    if (req.path.includes("/2025-11-30/capacity-providers")) {
      const idx = req.path.indexOf("/2025-11-30/capacity-providers");
      const rest = req.path.slice(
        idx + "/2025-11-30/capacity-providers".length,
      );
      const restParts = rest.split("/").filter((p) => p !== "");
      if (restParts.length === 0) {
        if (req.method === "POST") return "CreateCapacityProvider";
        if (req.method === "GET") return "ListCapacityProviders";
        return undefined;
      }
      if (restParts[restParts.length - 1] === "function-versions") {
        if (req.method === "GET")
          return "ListFunctionVersionsByCapacityProvider";
        return undefined;
      }
      if (restParts.length === 1) {
        if (req.method === "GET") return "GetCapacityProvider";
        if (req.method === "DELETE") return "DeleteCapacityProvider";
        if (req.method === "PUT") return "UpdateCapacityProvider";
        return undefined;
      }
      return undefined;
    }
    if (req.path.includes("/2025-12-01/durable-executions")) {
      const idx = req.path.indexOf("/2025-12-01/durable-executions");
      const rest = req.path.slice(
        idx + "/2025-12-01/durable-executions".length,
      );
      const restParts = rest.split("/").filter((p) => p !== "");
      if (
        restParts[restParts.length - 1] === "checkpoint" &&
        req.method === "POST"
      )
        return "CheckpointDurableExecution";
      if (restParts[restParts.length - 1] === "history" && req.method === "GET")
        return "GetDurableExecutionHistory";
      if (restParts[restParts.length - 1] === "state" && req.method === "GET")
        return "GetDurableExecutionState";
      if (restParts[restParts.length - 1] === "stop" && req.method === "POST")
        return "StopDurableExecution";
      if (req.method === "GET") return "GetDurableExecution";
      return undefined;
    }
    if (req.path.includes("/2025-12-01/durable-execution-callbacks")) {
      const idx = req.path.indexOf("/2025-12-01/durable-execution-callbacks");
      const rest = req.path.slice(
        idx + "/2025-12-01/durable-execution-callbacks".length,
      );
      const restParts = rest.split("/").filter((p) => p !== "");
      const callbackAction = restParts[restParts.length - 1];
      if (callbackAction === "succeed" && req.method === "POST")
        return "SendDurableExecutionCallbackSuccess";
      if (callbackAction === "fail" && req.method === "POST")
        return "SendDurableExecutionCallbackFailure";
      if (callbackAction === "heartbeat" && req.method === "POST")
        return "SendDurableExecutionCallbackHeartbeat";
      return undefined;
    }
    if (req.path.includes("/tags/") || req.path.includes("/2017-03-31/tags/")) {
      if (req.method === "POST") return "TagResource";
      if (req.method === "GET") return "ListTags";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }
    if (req.path.includes("/layers")) {
      const idx = req.path.indexOf("/layers");
      const layerParts = req.path
        .slice(idx + "/layers".length)
        .split("/")
        .filter((part) => part !== "");
      if (layerParts.length === 0) {
        if (req.method === "GET") {
          if (req.query.has("find")) return "GetLayerVersionByArn";
          return "ListLayers";
        }
        return undefined;
      }
      const layerTail = layerParts[layerParts.length - 1];
      if (layerTail === "versions" && req.method === "POST")
        return "PublishLayerVersion";
      if (layerTail === "versions" && req.method === "GET")
        return "ListLayerVersions";
      if (
        layerParts.length >= 2 &&
        layerParts[layerParts.length - 2] === "policy"
      ) {
        if (req.method === "DELETE") return "RemoveLayerVersionPermission";
        return undefined;
      }
      if (layerTail === "policy") {
        if (req.method === "POST") return "AddLayerVersionPermission";
        if (req.method === "GET") return "GetLayerVersionPolicy";
        return undefined;
      }
      if (
        layerParts.length >= 2 &&
        layerParts[layerParts.length - 2] === "versions"
      ) {
        if (req.method === "GET") return "GetLayerVersion";
        if (req.method === "DELETE") return "DeleteLayerVersion";
        return undefined;
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
    if (tail === "response-streaming-invocations" && req.method === "POST")
      return "InvokeWithResponseStream";
    if (tail === "invoke-async" && req.method === "POST") return "InvokeAsync";
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
      if (req.method === "PUT") return "UpdateFunctionUrlConfig";
      if (req.method === "DELETE") return "DeleteFunctionUrlConfig";
      return undefined;
    }
    if (tail === "urls") {
      if (req.method === "GET") return "ListFunctionUrlConfigs";
      return undefined;
    }
    if (tail === "configuration") {
      if (req.method === "GET") return "GetFunctionConfiguration";
      if (req.method === "PUT") return "UpdateFunctionConfiguration";
      return undefined;
    }
    if (tail === "code-signing-config") {
      if (req.method === "PUT") return "PutFunctionCodeSigningConfig";
      if (req.method === "GET") return "GetFunctionCodeSigningConfig";
      if (req.method === "DELETE") return "DeleteFunctionCodeSigningConfig";
      return undefined;
    }
    if (tail === "event-invoke-config") {
      if (req.method === "PUT") return "PutFunctionEventInvokeConfig";
      if (req.method === "GET") return "GetFunctionEventInvokeConfig";
      if (req.method === "DELETE") return "DeleteFunctionEventInvokeConfig";
      if (req.method === "POST") return "UpdateFunctionEventInvokeConfig";
      return undefined;
    }
    if (
      tail === "list" &&
      parts.length >= 2 &&
      parts[parts.length - 2] === "event-invoke-config"
    ) {
      if (req.method === "GET") return "ListFunctionEventInvokeConfigs";
      return undefined;
    }
    if (tail === "provisioned-concurrency") {
      if (req.method === "PUT") return "PutProvisionedConcurrencyConfig";
      if (req.method === "GET" && req.query.has("List"))
        return "ListProvisionedConcurrencyConfigs";
      if (req.method === "GET") return "GetProvisionedConcurrencyConfig";
      if (req.method === "DELETE") return "DeleteProvisionedConcurrencyConfig";
      return undefined;
    }
    if (tail === "recursion-config") {
      if (req.method === "GET") return "GetFunctionRecursionConfig";
      if (req.method === "PUT") return "PutFunctionRecursionConfig";
      return undefined;
    }
    if (tail === "function-scaling-config") {
      if (req.method === "GET") return "GetFunctionScalingConfig";
      if (req.method === "PUT") return "PutFunctionScalingConfig";
      return undefined;
    }
    if (tail === "runtime-management-config") {
      if (req.method === "GET") return "GetRuntimeManagementConfig";
      if (req.method === "PUT") return "PutRuntimeManagementConfig";
      return undefined;
    }
    if (tail === "versions") {
      if (req.method === "POST") return "PublishVersion";
      if (req.method === "GET") return "ListVersionsByFunction";
      return undefined;
    }
    if (tail === "durable-executions") {
      if (req.method === "GET") return "ListDurableExecutionsByFunction";
      return undefined;
    }
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
      if (req.method === "PUT") return "UpdateAlias";
      if (req.method === "DELETE") return "DeleteAlias";
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
    DeleteAlias,
    UpdateAlias,
    AddPermission,
    GetPolicy,
    RemovePermission,
    TagResource,
    ListTags,
    UntagResource,
    PutFunctionConcurrency,
    GetFunctionConcurrency,
    DeleteFunctionConcurrency,
    CreateFunctionUrlConfig,
    GetFunctionUrlConfig,
    UpdateFunctionUrlConfig,
    DeleteFunctionUrlConfig,
    ListFunctionUrlConfigs,
    PublishLayerVersion,
    ListLayers,
    GetLayerVersion,
    ListLayerVersions,
    GetLayerVersionByArn,
    DeleteLayerVersion,
    AddLayerVersionPermission,
    GetLayerVersionPolicy,
    RemoveLayerVersionPermission,
    CreateEventSourceMapping,
    GetEventSourceMapping,
    DeleteEventSourceMapping,
    UpdateEventSourceMapping,
    ListEventSourceMappings,
    CreateCodeSigningConfig,
    GetCodeSigningConfig,
    DeleteCodeSigningConfig,
    UpdateCodeSigningConfig,
    ListCodeSigningConfigs,
    PutFunctionCodeSigningConfig,
    GetFunctionCodeSigningConfig,
    DeleteFunctionCodeSigningConfig,
    ListFunctionsByCodeSigningConfig,
    PutFunctionEventInvokeConfig,
    UpdateFunctionEventInvokeConfig,
    GetFunctionEventInvokeConfig,
    DeleteFunctionEventInvokeConfig,
    ListFunctionEventInvokeConfigs,
    PutProvisionedConcurrencyConfig,
    GetProvisionedConcurrencyConfig,
    DeleteProvisionedConcurrencyConfig,
    ListProvisionedConcurrencyConfigs,
    GetFunctionRecursionConfig,
    PutFunctionRecursionConfig,
    GetFunctionScalingConfig,
    PutFunctionScalingConfig,
    GetRuntimeManagementConfig,
    PutRuntimeManagementConfig,
    GetAccountSettings,
    ListVersionsByFunction,
    InvokeAsync,
    InvokeWithResponseStream,
    CreateCapacityProvider,
    GetCapacityProvider,
    DeleteCapacityProvider,
    UpdateCapacityProvider,
    ListCapacityProviders,
    ListFunctionVersionsByCapacityProvider,
    GetDurableExecution,
    GetDurableExecutionHistory,
    GetDurableExecutionState,
    ListDurableExecutionsByFunction,
    CheckpointDurableExecution,
    StopDurableExecution,
    SendDurableExecutionCallbackSuccess,
    SendDurableExecutionCallbackFailure,
    SendDurableExecutionCallbackHeartbeat,
  },
  model,
} as const;

export default lambda;
