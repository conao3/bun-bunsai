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

type StoredChangeSet = {
  ChangeSetId: string;
  ChangeSetName: string;
  StackId: string;
  StackName: string;
  Description: string;
  TemplateBody: string;
  Parameters: { ParameterKey: string; ParameterValue: string }[];
  Capabilities: string[];
  Tags: { Key: string; Value: string }[];
  ExecutionStatus: string;
  Status: string;
  CreationTime: string;
};

const changeSetPrefix = "cs:";

const stackArn = (ctx: ServiceContext, name: string, id: string): string =>
  `arn:aws:cloudformation:${ctx.region}:${ctx.account}:stack/${name}/${id}`;

const changeSetArn = (ctx: ServiceContext, name: string, id: string): string =>
  `arn:aws:cloudformation:${ctx.region}:${ctx.account}:changeSet/${name}/${id}`;

const changeSetKey = (id: string): string => `${changeSetPrefix}${id}`;

const listChangeSets = (ctx: ServiceContext): StoredChangeSet[] =>
  ctx.store
    .list<StoredChangeSet>()
    .filter((entry) => entry.key.startsWith(changeSetPrefix))
    .map((entry) => entry.value);

const findChangeSet = (
  ctx: ServiceContext,
  identifier: string,
  stackName: string | undefined,
): StoredChangeSet | undefined =>
  listChangeSets(ctx).find(
    (cs) =>
      (cs.ChangeSetId === identifier || cs.ChangeSetName === identifier) &&
      (stackName === undefined ||
        stackName === "" ||
        cs.StackName === stackName ||
        cs.StackId === stackName),
  );

const resourcesOf = (
  templateBody: string,
): { LogicalResourceId: string; ResourceType: string }[] => {
  if (templateBody === "") return [];
  try {
    const parsed = JSON.parse(templateBody) as Record<string, unknown>;
    const resources = parsed["Resources"];
    if (resources === null || typeof resources !== "object") return [];
    return Object.entries(resources as Record<string, unknown>).map(
      ([logicalId, value]) => {
        const item = (value ?? {}) as Record<string, unknown>;
        return {
          LogicalResourceId: logicalId,
          ResourceType: String(item["Type"] ?? "AWS::CloudFormation::Unknown"),
        };
      },
    );
  } catch {
    return [];
  }
};

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

const listStacks = (ctx: ServiceContext): StoredStack[] =>
  ctx.store
    .list<StoredStack>()
    .filter((entry) => !entry.key.startsWith(changeSetPrefix))
    .map((entry) => entry.value);

const findByNameOrId = (
  ctx: ServiceContext,
  identifier: string,
): StoredStack | undefined => {
  if (identifier.startsWith(changeSetPrefix)) return undefined;
  const direct = ctx.store.get<StoredStack>(identifier);
  if (direct !== undefined) return direct;
  return listStacks(ctx).find((stack) => stack.StackId === identifier);
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
  const stacks = listStacks(ctx).map((stack) => toStack(stack));
  return { Stacks: stacks };
};

const UpdateStack: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = ctx.store.get<StoredStack>(name);
  if (stack === undefined) {
    throw awsError("ValidationError", `Stack [${name}] does not exist`, 400);
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
  const summaries = listStacks(ctx)
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

const requireChangeSetName = (input: Record<string, unknown>): string => {
  const name = input["ChangeSetName"];
  if (typeof name !== "string" || name === "") {
    throw awsError("ValidationError", "ChangeSetName is required.", 400);
  }
  return name;
};

const stackNameOf = (input: Record<string, unknown>): string | undefined => {
  const name = input["StackName"];
  return typeof name === "string" && name !== "" ? name : undefined;
};

const toChangeSetSummary = (cs: StoredChangeSet) => ({
  StackId: cs.StackId,
  StackName: cs.StackName,
  ChangeSetId: cs.ChangeSetId,
  ChangeSetName: cs.ChangeSetName,
  ExecutionStatus: cs.ExecutionStatus,
  Status: cs.Status,
  CreationTime: cs.CreationTime,
  Description: cs.Description,
});

const toChange = (resource: {
  LogicalResourceId: string;
  ResourceType: string;
}) => ({
  Type: "Resource",
  ResourceChange: {
    Action: "Add",
    LogicalResourceId: resource.LogicalResourceId,
    ResourceType: resource.ResourceType,
    Scope: [],
    Details: [],
  },
});

const CreateChangeSet: OperationHandler = (input, ctx) => {
  const stackName = requireStackName(input);
  const changeSetName = requireChangeSetName(input);
  const stack = findByNameOrId(ctx, stackName);
  const id = crypto.randomUUID();
  const arn = changeSetArn(ctx, changeSetName, id);
  const templateBody = templateBodyOf(input);
  const changeSet: StoredChangeSet = {
    ChangeSetId: arn,
    ChangeSetName: changeSetName,
    StackId: stack?.StackId ?? stackArn(ctx, stackName, crypto.randomUUID()),
    StackName: stackName,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : "",
    TemplateBody: templateBody || (stack?.TemplateBody ?? ""),
    Parameters: parametersOf(input),
    Capabilities: capabilitiesOf(input),
    Tags: tagsOf(input),
    ExecutionStatus: "AVAILABLE",
    Status: "CREATE_COMPLETE",
    CreationTime: new Date().toISOString(),
  };
  ctx.store.set(changeSetKey(id), changeSet);
  return { Id: arn, StackId: changeSet.StackId };
};

const DescribeChangeSet: OperationHandler = (input, ctx) => {
  const changeSetName = requireChangeSetName(input);
  const cs = findChangeSet(ctx, changeSetName, stackNameOf(input));
  if (cs === undefined) {
    throw awsError(
      "ChangeSetNotFound",
      `ChangeSet [${changeSetName}] does not exist`,
      404,
    );
  }
  return {
    ChangeSetName: cs.ChangeSetName,
    ChangeSetId: cs.ChangeSetId,
    StackId: cs.StackId,
    StackName: cs.StackName,
    Description: cs.Description,
    Parameters: cs.Parameters,
    CreationTime: cs.CreationTime,
    ExecutionStatus: cs.ExecutionStatus,
    Status: cs.Status,
    NotificationARNs: [],
    Capabilities: cs.Capabilities,
    Tags: cs.Tags,
    Changes: resourcesOf(cs.TemplateBody).map((resource) => toChange(resource)),
  };
};

const ListChangeSets: OperationHandler = (input, ctx) => {
  const stackName = requireStackName(input);
  const summaries = listChangeSets(ctx)
    .filter((cs) => cs.StackName === stackName || cs.StackId === stackName)
    .map((cs) => toChangeSetSummary(cs));
  return { Summaries: summaries };
};

const DeleteChangeSet: OperationHandler = (input, ctx) => {
  const changeSetName = requireChangeSetName(input);
  const cs = findChangeSet(ctx, changeSetName, stackNameOf(input));
  if (cs !== undefined) {
    const entry = ctx.store
      .list<StoredChangeSet>()
      .find(
        (item) =>
          item.key.startsWith(changeSetPrefix) &&
          item.value.ChangeSetId === cs.ChangeSetId,
      );
    if (entry !== undefined) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const ValidateTemplate: OperationHandler = (input) => {
  const templateBody = templateBodyOf(input);
  let description = "";
  const parameters: {
    ParameterKey: string;
    DefaultValue: string;
    NoEcho: boolean;
    Description: string;
  }[] = [];
  if (templateBody !== "") {
    try {
      const parsed = JSON.parse(templateBody) as Record<string, unknown>;
      if (typeof parsed["Description"] === "string") {
        description = parsed["Description"] as string;
      }
      const params = parsed["Parameters"];
      if (params !== null && typeof params === "object") {
        for (const [key, value] of Object.entries(
          params as Record<string, unknown>,
        )) {
          const item = (value ?? {}) as Record<string, unknown>;
          parameters.push({
            ParameterKey: key,
            DefaultValue: String(item["Default"] ?? ""),
            NoEcho: item["NoEcho"] === true,
            Description:
              typeof item["Description"] === "string"
                ? (item["Description"] as string)
                : "",
          });
        }
      }
    } catch {
      throw awsError(
        "ValidationError",
        "Template format error: not well-formed JSON.",
        400,
      );
    }
  }
  return {
    Parameters: parameters,
    Description: description,
    Capabilities: [],
    CapabilitiesReason: "",
    DeclaredTransforms: [],
  };
};

const ListStackResources: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = findByNameOrId(ctx, name);
  if (stack === undefined) {
    throw awsError(
      "ValidationError",
      `Stack with id ${name} does not exist`,
      400,
    );
  }
  const timestamp = stack.LastUpdatedTime ?? stack.CreationTime;
  const summaries = resourcesOf(stack.TemplateBody).map((resource) => ({
    LogicalResourceId: resource.LogicalResourceId,
    PhysicalResourceId: `${stack.StackName}-${resource.LogicalResourceId}`,
    ResourceType: resource.ResourceType,
    LastUpdatedTimestamp: timestamp,
    ResourceStatus: "CREATE_COMPLETE",
    DriftInformation: { StackResourceDriftStatus: "NOT_CHECKED" },
  }));
  return { StackResourceSummaries: summaries };
};

const DescribeStackResources: OperationHandler = (input, ctx) => {
  const name = stackNameOf(input);
  if (name === undefined) {
    throw awsError("ValidationError", "StackName is required.", 400);
  }
  const stack = findByNameOrId(ctx, name);
  if (stack === undefined) {
    throw awsError(
      "ValidationError",
      `Stack with id ${name} does not exist`,
      400,
    );
  }
  const logicalFilter = input["LogicalResourceId"];
  const timestamp = stack.LastUpdatedTime ?? stack.CreationTime;
  const resources = resourcesOf(stack.TemplateBody)
    .filter((resource) =>
      typeof logicalFilter === "string" && logicalFilter !== ""
        ? resource.LogicalResourceId === logicalFilter
        : true,
    )
    .map((resource) => ({
      StackName: stack.StackName,
      StackId: stack.StackId,
      LogicalResourceId: resource.LogicalResourceId,
      PhysicalResourceId: `${stack.StackName}-${resource.LogicalResourceId}`,
      ResourceType: resource.ResourceType,
      Timestamp: timestamp,
      ResourceStatus: "CREATE_COMPLETE",
      DriftInformation: { StackResourceDriftStatus: "NOT_CHECKED" },
    }));
  return { StackResources: resources };
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
    CreateChangeSet,
    DescribeChangeSet,
    ListChangeSets,
    DeleteChangeSet,
    ValidateTemplate,
    ListStackResources,
    DescribeStackResources,
  },
  model,
} as const;

export default cloudformation;
