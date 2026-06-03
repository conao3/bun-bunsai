import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ioteventsModel from "../../../../test/vendor/aws-models/iotevents.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(ioteventsModel);

const inputPrefix = "input:" as const;

type StoredInput = {
  inputName: string;
  inputDescription: string | undefined;
  inputArn: string;
  creationTime: number;
  lastUpdateTime: number;
  status: string;
  inputDefinition: unknown;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidRequestException", `${field} is required.`, 400);
  }
  return value;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const inputKey = (name: string): string => `${inputPrefix}${name}`;

const inputArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:iotevents:${ctx.region}:${ctx.account}:input/${name}`;

const requireInput = (ctx: ServiceContext, name: string): StoredInput => {
  const stored = ctx.store.get<StoredInput>(inputKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Input ${name} was not found.`,
      404,
    );
  }
  return stored;
};

const configurationView = (input: StoredInput): Record<string, unknown> => ({
  inputName: input.inputName,
  inputDescription: input.inputDescription,
  inputArn: input.inputArn,
  creationTime: input.creationTime,
  lastUpdateTime: input.lastUpdateTime,
  status: input.status,
});

const summaryView = (input: StoredInput): Record<string, unknown> => ({
  inputName: input.inputName,
  inputDescription: input.inputDescription,
  inputArn: input.inputArn,
  creationTime: input.creationTime,
  lastUpdateTime: input.lastUpdateTime,
  status: input.status,
});

const CreateInput: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const inputName = requireString(data, "inputName");
  const inputDefinition = data["inputDefinition"];
  if (inputDefinition === undefined || inputDefinition === null) {
    throw awsError(
      "InvalidRequestException",
      "inputDefinition is required.",
      400,
    );
  }
  const now = nowSeconds();
  const stored: StoredInput = {
    inputName,
    inputDescription: stringOrUndefined(data["inputDescription"]),
    inputArn: inputArn(ctx, inputName),
    creationTime: now,
    lastUpdateTime: now,
    status: "ACTIVE",
    inputDefinition,
  };
  ctx.store.set(inputKey(inputName), stored);
  return { inputConfiguration: configurationView(stored) };
};

const DescribeInput: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const inputName = requireString(data, "inputName");
  const stored = requireInput(ctx, inputName);
  return {
    input: {
      inputConfiguration: configurationView(stored),
      inputDefinition: stored.inputDefinition,
    },
  };
};

const ListInputs: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const max = numberOrUndefined(data["maxResults"]) ?? 100;
  const inputs = ctx.store
    .list<StoredInput>()
    .filter((entry) => entry.key.startsWith(inputPrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.inputName < b.inputName ? -1 : a.inputName > b.inputName ? 1 : 0,
    );
  return { inputSummaries: inputs.slice(0, max).map(summaryView) };
};

const DeleteInput: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const inputName = requireString(data, "inputName");
  requireInput(ctx, inputName);
  ctx.store.delete(inputKey(inputName));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const iotevents = {
  name: "iotevents",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "inputs") return undefined;
    if (parts.length === 1) {
      if (req.method === "POST") return "CreateInput";
      if (req.method === "GET") return "ListInputs";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "GET") return "DescribeInput";
      if (req.method === "DELETE") return "DeleteInput";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateInput,
    DescribeInput,
    ListInputs,
    DeleteInput,
  },
  model,
} as const satisfies ServiceDefinition;

export default iotevents;
