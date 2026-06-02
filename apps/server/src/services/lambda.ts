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
    const parts = segmentsAfterFunctions(req.path);
    if (parts.length === 0) {
      if (req.method === "POST") return "CreateFunction";
      if (req.method === "GET") return "ListFunctions";
      return undefined;
    }
    const tail = parts[parts.length - 1];
    if (tail === "invocations" && req.method === "POST") return "Invoke";
    if (tail === "code" && req.method === "PUT") return "UpdateFunctionCode";
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
  },
  model,
} as const;

export default lambda;
