import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ssmModel from "../../../../test/vendor/aws-models/ssm.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(ssmModel);

type StoredParameter = {
  Name: string;
  Type: string;
  Value: string;
  Version: number;
  LastModifiedDate: string;
  ARN: string;
};

const arnOf = (region: string, account: string, name: string): string => {
  const trimmed = name.startsWith("/") ? name.slice(1) : name;
  return `arn:aws:ssm:${region}:${account}:parameter/${trimmed}`;
};

const requireName = (input: Record<string, unknown>): string => {
  const name = input["Name"];
  if (typeof name !== "string" || name === "") {
    throw awsError("ValidationException", "Name is required.", 400);
  }
  return name;
};

const toApiParameter = (stored: StoredParameter): Record<string, unknown> => ({
  Name: stored.Name,
  Type: stored.Type,
  Value: stored.Value,
  Version: stored.Version,
  LastModifiedDate: stored.LastModifiedDate,
  ARN: stored.ARN,
});

const PutParameter: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const value = input["Value"];
  if (typeof value !== "string") {
    throw awsError("ValidationException", "Value is required.", 400);
  }
  const type = typeof input["Type"] === "string" ? input["Type"] : "String";
  const overwrite = input["Overwrite"] === true;
  const existing = ctx.store.get<StoredParameter>(name);
  if (existing !== undefined && !overwrite) {
    throw awsError(
      "ParameterAlreadyExists",
      `The parameter already exists. To overwrite this value, set the overwrite option in the request to true.`,
      400,
    );
  }
  const version = existing === undefined ? 1 : existing.Version + 1;
  const stored: StoredParameter = {
    Name: name,
    Type: type,
    Value: value,
    Version: version,
    LastModifiedDate: new Date().toISOString(),
    ARN: arnOf(ctx.region, ctx.account, name),
  };
  ctx.store.set(name, stored);
  return { Version: version, Tier: "Standard" };
};

const GetParameter: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const stored = ctx.store.get<StoredParameter>(name);
  if (stored === undefined) {
    throw awsError("ParameterNotFound", `Parameter ${name} not found.`, 400);
  }
  return { Parameter: toApiParameter(stored) };
};

const GetParameters: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["Names"])
    ? (input["Names"] as unknown[]).map((value) => String(value))
    : [];
  const parameters: Record<string, unknown>[] = [];
  const invalid: string[] = [];
  for (const name of names) {
    const stored = ctx.store.get<StoredParameter>(name);
    if (stored === undefined) {
      invalid.push(name);
      continue;
    }
    parameters.push(toApiParameter(stored));
  }
  return { Parameters: parameters, InvalidParameters: invalid };
};

const GetParametersByPath: OperationHandler = (input, ctx) => {
  const path = input["Path"];
  if (typeof path !== "string" || path === "") {
    throw awsError("ValidationException", "Path is required.", 400);
  }
  const recursive = input["Recursive"] === true;
  const normalized = path.endsWith("/") ? path : `${path}/`;
  const parameters = ctx.store
    .list<StoredParameter>()
    .filter((entry) => {
      if (!entry.key.startsWith(normalized)) return false;
      if (recursive) return true;
      const rest = entry.key.slice(normalized.length);
      return !rest.includes("/");
    })
    .map((entry) => toApiParameter(entry.value));
  return { Parameters: parameters };
};

const DeleteParameter: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const removed = ctx.store.delete(name);
  if (!removed) {
    throw awsError("ParameterNotFound", `Parameter ${name} not found.`, 400);
  }
  return {};
};

const DescribeParameters: OperationHandler = (input, ctx) => {
  void input;
  const parameters = ctx.store.list<StoredParameter>().map((entry) => ({
    Name: entry.value.Name,
    Type: entry.value.Type,
    Version: entry.value.Version,
    LastModifiedDate: entry.value.LastModifiedDate,
    ARN: entry.value.ARN,
    Tier: "Standard",
  }));
  return { Parameters: parameters };
};

const ssm: ServiceDefinition = {
  name: "ssm",
  protocol: "json",
  operations: {
    PutParameter,
    GetParameter,
    GetParameters,
    GetParametersByPath,
    DeleteParameter,
    DescribeParameters,
  },
  model,
} as const;

export default ssm;
