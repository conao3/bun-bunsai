import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import cloudformationModel from "../../../../test/vendor/aws-models/cloudformation.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(cloudformationModel);

type StoredStack = {
  StackId: string;
  StackName: string;
  TemplateBody: string;
  Parameters: { ParameterKey: string; ParameterValue: string }[];
  Capabilities: string[];
  Tags: { Key: string; Value: string }[];
  StackStatus: string;
  CreationTime: string;
  LastUpdatedTime: string | undefined;
};

const stackArn = (ctx: ServiceContext, name: string, id: string): string =>
  `arn:aws:cloudformation:${ctx.region}:${ctx.account}:stack/${name}/${id}`;

const requireStackName = (input: Record<string, unknown>): string => {
  const name = input["StackName"];
  if (typeof name !== "string" || name === "") {
    throw awsError("ValidationError", "StackName is required.", 400);
  }
  return name;
};

const templateBodyOf = (input: Record<string, unknown>): string =>
  typeof input["TemplateBody"] === "string"
    ? (input["TemplateBody"] as string)
    : "";

const parametersOf = (
  input: Record<string, unknown>,
): { ParameterKey: string; ParameterValue: string }[] => {
  const raw = input["Parameters"];
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    return {
      ParameterKey: String(item["ParameterKey"] ?? ""),
      ParameterValue: String(item["ParameterValue"] ?? ""),
    };
  });
};

const tagsOf = (
  input: Record<string, unknown>,
): { Key: string; Value: string }[] => {
  const raw = input["Tags"];
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    return {
      Key: String(item["Key"] ?? ""),
      Value: String(item["Value"] ?? ""),
    };
  });
};

const capabilitiesOf = (input: Record<string, unknown>): string[] => {
  const raw = input["Capabilities"];
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((value) => String(value));
};

const findByNameOrId = (
  ctx: ServiceContext,
  identifier: string,
): StoredStack | undefined => {
  const direct = ctx.store.get<StoredStack>(identifier);
  if (direct !== undefined) return direct;
  return ctx.store
    .list<StoredStack>()
    .map((entry) => entry.value)
    .find((stack) => stack.StackId === identifier);
};

const toStack = (stack: StoredStack) => ({
  StackId: stack.StackId,
  StackName: stack.StackName,
  Parameters: stack.Parameters,
  CreationTime: stack.CreationTime,
  LastUpdatedTime: stack.LastUpdatedTime,
  StackStatus: stack.StackStatus,
  DisableRollback: false,
  NotificationARNs: [],
  Capabilities: stack.Capabilities,
  Tags: stack.Tags,
  EnableTerminationProtection: false,
  DriftInformation: { StackDriftStatus: "NOT_CHECKED" },
});

const toSummary = (stack: StoredStack) => ({
  StackId: stack.StackId,
  StackName: stack.StackName,
  CreationTime: stack.CreationTime,
  LastUpdatedTime: stack.LastUpdatedTime,
  StackStatus: stack.StackStatus,
  DriftInformation: { StackDriftStatus: "NOT_CHECKED" },
});

const CreateStack: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  if (ctx.store.get<StoredStack>(name) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Stack [${name}] already exists`,
      400,
    );
  }
  const id = crypto.randomUUID();
  const arn = stackArn(ctx, name, id);
  const stack: StoredStack = {
    StackId: arn,
    StackName: name,
    TemplateBody: templateBodyOf(input),
    Parameters: parametersOf(input),
    Capabilities: capabilitiesOf(input),
    Tags: tagsOf(input),
    StackStatus: "CREATE_COMPLETE",
    CreationTime: new Date().toISOString(),
    LastUpdatedTime: undefined,
  };
  ctx.store.set(name, stack);
  return { StackId: arn };
};

const DescribeStacks: OperationHandler = (input, ctx) => {
  const requested = input["StackName"];
  if (typeof requested === "string" && requested !== "") {
    const stack = findByNameOrId(ctx, requested);
    if (stack === undefined) {
      throw awsError(
        "ValidationError",
        `Stack with id ${requested} does not exist`,
        400,
      );
    }
    return { Stacks: [toStack(stack)] };
  }
  const stacks = ctx.store
    .list<StoredStack>()
    .map((entry) => toStack(entry.value));
  return { Stacks: stacks };
};

const UpdateStack: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = ctx.store.get<StoredStack>(name);
  if (stack === undefined) {
    throw awsError(
      "ValidationError",
      `Stack [${name}] does not exist`,
      400,
    );
  }
  const updated: StoredStack = {
    ...stack,
    TemplateBody: templateBodyOf(input) || stack.TemplateBody,
    Parameters:
      input["Parameters"] === undefined
        ? stack.Parameters
        : parametersOf(input),
    Capabilities:
      input["Capabilities"] === undefined
        ? stack.Capabilities
        : capabilitiesOf(input),
    Tags: input["Tags"] === undefined ? stack.Tags : tagsOf(input),
    StackStatus: "UPDATE_COMPLETE",
    LastUpdatedTime: new Date().toISOString(),
  };
  ctx.store.set(name, updated);
  return { StackId: updated.StackId };
};

const DeleteStack: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = findByNameOrId(ctx, name);
  if (stack !== undefined) {
    ctx.store.delete(stack.StackName);
  }
  return {};
};

const ListStacks: OperationHandler = (input, ctx) => {
  const rawFilter = input["StackStatusFilter"];
  const filter = Array.isArray(rawFilter)
    ? (rawFilter as unknown[]).map((value) => String(value))
    : typeof rawFilter === "string"
      ? [rawFilter]
      : [];
  const summaries = ctx.store
    .list<StoredStack>()
    .map((entry) => entry.value)
    .filter((stack) =>
      filter.length === 0 ? true : filter.includes(stack.StackStatus),
    )
    .map((stack) => toSummary(stack));
  return { StackSummaries: summaries };
};

const GetTemplate: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = findByNameOrId(ctx, name);
  if (stack === undefined) {
    throw awsError(
      "ValidationError",
      `Stack with id ${name} does not exist`,
      400,
    );
  }
  return {
    TemplateBody: stack.TemplateBody,
    StagesAvailable: ["Original", "Processed"],
  };
};

const cloudformation: ServiceDefinition = {
  name: "cloudformation",
  protocol: "query",
  operations: {
    CreateStack,
    DescribeStacks,
    UpdateStack,
    DeleteStack,
    ListStacks,
    GetTemplate,
  },
  model,
} as const;

export default cloudformation;
