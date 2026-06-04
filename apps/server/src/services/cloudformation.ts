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
  EnableTerminationProtection: boolean;
  StackPolicy: string;
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

type StoredStackSet = {
  StackSetId: string;
  StackSetName: string;
  Description: string;
  Status: string;
  TemplateBody: string;
  Parameters: { ParameterKey: string; ParameterValue: string }[];
  Capabilities: string[];
  Tags: { Key: string; Value: string }[];
  AdministrationRoleARN: string;
  ExecutionRoleName: string;
  CreationTime: string;
  LastUpdatedTime: string;
};

type StoredStackInstance = {
  StackSetId: string;
  StackSetName: string;
  Region: string;
  Account: string;
  StackId: string;
  Status: string;
  CreationTime: string;
};

type StoredStackSetOperation = {
  OperationId: string;
  StackSetId: string;
  StackSetName: string;
  Action: string;
  Status: string;
  CreationTime: string;
};

type StoredGeneratedTemplate = {
  GeneratedTemplateId: string;
  GeneratedTemplateName: string;
  StackName: string;
  Status: string;
  TemplateBody: string;
  CreationTime: string;
  LastUpdatedTime: string;
};

type StoredType = {
  TypeArn: string;
  TypeName: string;
  Type: string;
  DefaultVersionId: string;
  Status: string;
  Description: string;
  SchemaHandlerPackage: string;
  RegistrationToken: string;
  CreationTime: string;
  LastUpdatedTime: string;
};

type StoredTypeVersion = {
  Arn: string;
  TypeName: string;
  Type: string;
  VersionId: string;
  IsDefaultVersion: boolean;
  CreationTime: string;
};

type StoredResourceScan = {
  ResourceScanId: string;
  Status: string;
  StartTime: string;
  EndTime: string;
  PercentageCompleted: number;
};

type StoredStackRefactor = {
  StackRefactorId: string;
  Description: string;
  Status: string;
  CreationTime: string;
};

type StoredPublisher = {
  PublisherId: string;
  PublisherStatus: string;
  PublisherProfile: string;
  ConnectionArn: string;
};

const changeSetPrefix = "cs:";
const stackSetPrefix = "ss:";
const stackInstancePrefix = "si:";
const stackSetOpPrefix = "ssop:";
const generatedTemplatePrefix = "gt:";
const typePrefix = "type:";
const typeVersionPrefix = "tv:";
const resourceScanPrefix = "rs:";
const stackRefactorPrefix = "sr:";
const publisherPrefix = "pub:";
const regTokenPrefix = "regtoken:";

const stackArn = (ctx: ServiceContext, name: string, id: string): string =>
  `arn:aws:cloudformation:${ctx.region}:${ctx.account}:stack/${name}/${id}`;

const changeSetArn = (ctx: ServiceContext, name: string, id: string): string =>
  `arn:aws:cloudformation:${ctx.region}:${ctx.account}:changeSet/${name}/${id}`;

const stackSetArn = (ctx: ServiceContext, name: string, id: string): string =>
  `arn:aws:cloudformation:${ctx.region}:${ctx.account}:stackset/${name}:${id}`;

const typeArn = (ctx: ServiceContext, typeName: string): string =>
  `arn:aws:cloudformation:${ctx.region}:${ctx.account}:type/resource/${typeName.replace(/::/g, "-")}`;

const changeSetKey = (id: string): string => `${changeSetPrefix}${id}`;
const stackSetKey = (name: string): string => `${stackSetPrefix}${name}`;
const stackInstanceKey = (
  setName: string,
  account: string,
  region: string,
): string => `${stackInstancePrefix}${setName}:${account}:${region}`;
const stackSetOpKey = (id: string): string => `${stackSetOpPrefix}${id}`;
const generatedTemplateKey = (name: string): string =>
  `${generatedTemplatePrefix}${name}`;
const typeKey = (typeName: string): string => `${typePrefix}${typeName}`;
const typeVersionKey = (typeName: string, versionId: string): string =>
  `${typeVersionPrefix}${typeName}:${versionId}`;
const resourceScanKey = (id: string): string => `${resourceScanPrefix}${id}`;
const stackRefactorKey = (id: string): string => `${stackRefactorPrefix}${id}`;
const publisherKey = (id: string): string => `${publisherPrefix}${id}`;

const listByPrefix = <T>(ctx: ServiceContext, prefix: string): T[] =>
  ctx.store
    .list<T>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);

const listChangeSets = (ctx: ServiceContext): StoredChangeSet[] =>
  listByPrefix<StoredChangeSet>(ctx, changeSetPrefix);

const listStackSets = (ctx: ServiceContext): StoredStackSet[] =>
  listByPrefix<StoredStackSet>(ctx, stackSetPrefix);

const listStackInstances = (ctx: ServiceContext): StoredStackInstance[] =>
  listByPrefix<StoredStackInstance>(ctx, stackInstancePrefix);

const listStackSetOps = (ctx: ServiceContext): StoredStackSetOperation[] =>
  listByPrefix<StoredStackSetOperation>(ctx, stackSetOpPrefix);

const listGeneratedTemplates = (
  ctx: ServiceContext,
): StoredGeneratedTemplate[] =>
  listByPrefix<StoredGeneratedTemplate>(ctx, generatedTemplatePrefix);

const listTypes = (ctx: ServiceContext): StoredType[] =>
  listByPrefix<StoredType>(ctx, typePrefix);

const listTypeVersions = (ctx: ServiceContext): StoredTypeVersion[] =>
  listByPrefix<StoredTypeVersion>(ctx, typeVersionPrefix);

const listResourceScans = (ctx: ServiceContext): StoredResourceScan[] =>
  listByPrefix<StoredResourceScan>(ctx, resourceScanPrefix);

const listStackRefactors = (ctx: ServiceContext): StoredStackRefactor[] =>
  listByPrefix<StoredStackRefactor>(ctx, stackRefactorPrefix);

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
    .filter(
      (entry) =>
        !entry.key.startsWith(changeSetPrefix) &&
        !entry.key.startsWith(stackSetPrefix) &&
        !entry.key.startsWith(stackInstancePrefix) &&
        !entry.key.startsWith(stackSetOpPrefix) &&
        !entry.key.startsWith(generatedTemplatePrefix) &&
        !entry.key.startsWith(typePrefix) &&
        !entry.key.startsWith(typeVersionPrefix) &&
        !entry.key.startsWith(resourceScanPrefix) &&
        !entry.key.startsWith(stackRefactorPrefix) &&
        !entry.key.startsWith(publisherPrefix) &&
        !entry.key.startsWith(regTokenPrefix),
    )
    .map((entry) => entry.value);

const findByNameOrId = (
  ctx: ServiceContext,
  identifier: string,
): StoredStack | undefined => {
  if (
    identifier.startsWith(changeSetPrefix) ||
    identifier.startsWith(stackSetPrefix) ||
    identifier.startsWith(stackInstancePrefix) ||
    identifier.startsWith(stackSetOpPrefix) ||
    identifier.startsWith(generatedTemplatePrefix) ||
    identifier.startsWith(typePrefix) ||
    identifier.startsWith(typeVersionPrefix) ||
    identifier.startsWith(resourceScanPrefix) ||
    identifier.startsWith(stackRefactorPrefix) ||
    identifier.startsWith(publisherPrefix) ||
    identifier.startsWith(regTokenPrefix)
  )
    return undefined;
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
  EnableTerminationProtection: stack.EnableTerminationProtection,
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
    EnableTerminationProtection: false,
    StackPolicy: "",
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

const CancelUpdateStack: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = findByNameOrId(ctx, name);
  if (stack === undefined) {
    throw awsError(
      "ValidationError",
      `Stack with id ${name} does not exist`,
      400,
    );
  }
  const updated: StoredStack = {
    ...stack,
    StackStatus: "UPDATE_ROLLBACK_COMPLETE",
    LastUpdatedTime: new Date().toISOString(),
  };
  ctx.store.set(stack.StackName, updated);
  return {};
};

const ContinueUpdateRollback: OperationHandler = () => ({});

const RollbackStack: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = findByNameOrId(ctx, name);
  if (stack === undefined) {
    throw awsError(
      "StackNotFoundException",
      `Stack with id ${name} does not exist`,
      400,
    );
  }
  const updated: StoredStack = {
    ...stack,
    StackStatus: "ROLLBACK_COMPLETE",
    LastUpdatedTime: new Date().toISOString(),
  };
  ctx.store.set(stack.StackName, updated);
  return {};
};

const UpdateTerminationProtection: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = findByNameOrId(ctx, name);
  if (stack === undefined) {
    throw awsError(
      "ValidationError",
      `Stack with id ${name} does not exist`,
      400,
    );
  }
  const protect = input["EnableTerminationProtection"] === true;
  const updated: StoredStack = {
    ...stack,
    EnableTerminationProtection: protect,
  };
  ctx.store.set(stack.StackName, updated);
  return { StackId: stack.StackId };
};

const SetStackPolicy: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = findByNameOrId(ctx, name);
  if (stack === undefined) {
    throw awsError(
      "ValidationError",
      `Stack with id ${name} does not exist`,
      400,
    );
  }
  const policy =
    typeof input["StackPolicyBody"] === "string"
      ? (input["StackPolicyBody"] as string)
      : "";
  const updated: StoredStack = { ...stack, StackPolicy: policy };
  ctx.store.set(stack.StackName, updated);
  return {};
};

const GetStackPolicy: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = findByNameOrId(ctx, name);
  if (stack === undefined) {
    throw awsError(
      "ValidationError",
      `Stack with id ${name} does not exist`,
      400,
    );
  }
  return { StackPolicyBody: stack.StackPolicy };
};

const ExecuteChangeSet: OperationHandler = (input, ctx) => {
  const changeSetName = requireChangeSetName(input);
  const cs = findChangeSet(ctx, changeSetName, stackNameOf(input));
  if (cs === undefined) {
    throw awsError(
      "ChangeSetNotFound",
      `ChangeSet [${changeSetName}] does not exist`,
      404,
    );
  }
  const stack = findByNameOrId(ctx, cs.StackName);
  const now = new Date().toISOString();
  if (stack === undefined) {
    const id = crypto.randomUUID();
    const arn = stackArn(ctx, cs.StackName, id);
    const newStack: StoredStack = {
      StackId: arn,
      StackName: cs.StackName,
      TemplateBody: cs.TemplateBody,
      Parameters: cs.Parameters,
      Capabilities: cs.Capabilities,
      Tags: cs.Tags,
      StackStatus: "CREATE_COMPLETE",
      CreationTime: now,
      LastUpdatedTime: undefined,
      EnableTerminationProtection: false,
      StackPolicy: "",
    };
    ctx.store.set(cs.StackName, newStack);
  } else {
    const updated: StoredStack = {
      ...stack,
      TemplateBody: cs.TemplateBody || stack.TemplateBody,
      Parameters: cs.Parameters.length > 0 ? cs.Parameters : stack.Parameters,
      Capabilities:
        cs.Capabilities.length > 0 ? cs.Capabilities : stack.Capabilities,
      Tags: cs.Tags.length > 0 ? cs.Tags : stack.Tags,
      StackStatus: "UPDATE_COMPLETE",
      LastUpdatedTime: now,
    };
    ctx.store.set(stack.StackName, updated);
  }
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
  return {};
};

const DescribeStackEvents: OperationHandler = (input, ctx) => {
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
    StackEvents: [
      {
        StackId: stack.StackId,
        EventId: crypto.randomUUID(),
        StackName: stack.StackName,
        Timestamp: stack.CreationTime,
        ResourceStatus: stack.StackStatus,
        ResourceType: "AWS::CloudFormation::Stack",
        LogicalResourceId: stack.StackName,
        PhysicalResourceId: stack.StackId,
      },
    ],
  };
};

const DescribeEvents: OperationHandler = DescribeStackEvents;

const DescribeStackResource: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = findByNameOrId(ctx, name);
  if (stack === undefined) {
    throw awsError(
      "ValidationError",
      `Stack with id ${name} does not exist`,
      400,
    );
  }
  const logicalId = String(input["LogicalResourceId"] ?? "");
  const timestamp = stack.LastUpdatedTime ?? stack.CreationTime;
  const resource = resourcesOf(stack.TemplateBody).find(
    (r) => r.LogicalResourceId === logicalId,
  );
  if (resource === undefined) {
    throw awsError(
      "ValidationError",
      `Resource ${logicalId} does not exist for stack ${name}`,
      400,
    );
  }
  return {
    StackResourceDetail: {
      StackName: stack.StackName,
      StackId: stack.StackId,
      LogicalResourceId: resource.LogicalResourceId,
      PhysicalResourceId: `${stack.StackName}-${resource.LogicalResourceId}`,
      ResourceType: resource.ResourceType,
      LastUpdatedTimestamp: timestamp,
      ResourceStatus: "CREATE_COMPLETE",
      DriftInformation: { StackResourceDriftStatus: "NOT_CHECKED" },
    },
  };
};

const DescribeStackResourceDrifts: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = findByNameOrId(ctx, name);
  if (stack === undefined) {
    throw awsError(
      "ValidationError",
      `Stack with id ${name} does not exist`,
      400,
    );
  }
  return { StackResourceDrifts: [] };
};

const DetectStackDrift: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = findByNameOrId(ctx, name);
  if (stack === undefined) {
    throw awsError(
      "ValidationError",
      `Stack with id ${name} does not exist`,
      400,
    );
  }
  return { StackDriftDetectionId: crypto.randomUUID() };
};

const DetectStackResourceDrift: OperationHandler = (input, ctx) => {
  const name = requireStackName(input);
  const stack = findByNameOrId(ctx, name);
  if (stack === undefined) {
    throw awsError(
      "ValidationError",
      `Stack with id ${name} does not exist`,
      400,
    );
  }
  const logicalId = String(input["LogicalResourceId"] ?? "");
  const resource = resourcesOf(stack.TemplateBody).find(
    (r) => r.LogicalResourceId === logicalId,
  );
  if (resource === undefined) {
    throw awsError(
      "ValidationError",
      `Resource ${logicalId} does not exist for stack ${name}`,
      400,
    );
  }
  return {
    StackResourceDrift: {
      StackId: stack.StackId,
      LogicalResourceId: resource.LogicalResourceId,
      PhysicalResourceId: `${stack.StackName}-${resource.LogicalResourceId}`,
      ResourceType: resource.ResourceType,
      StackResourceDriftStatus: "IN_SYNC",
      Timestamp: new Date().toISOString(),
    },
  };
};

const DescribeStackDriftDetectionStatus: OperationHandler = (input) => {
  const detectionId = String(input["StackDriftDetectionId"] ?? "");
  return {
    StackId: "",
    StackDriftDetectionId: detectionId,
    DetectionStatus: "DETECTION_COMPLETE",
    StackDriftStatus: "NOT_CHECKED",
    TimestampStarted: new Date().toISOString(),
    DriftedStackResourceCount: 0,
  };
};

const EstimateTemplateCost: OperationHandler = () => ({
  Url: "http://calculator.s3.amazonaws.com/calc5.html?key=cloudformation/00000000-0000-0000-0000-000000000000",
});

const GetTemplateSummary: OperationHandler = (input, ctx) => {
  const templateBody = templateBodyOf(input);
  const stackName = stackNameOf(input);
  let body = templateBody;
  if (body === "" && stackName !== undefined) {
    const stack = findByNameOrId(ctx, stackName);
    if (stack !== undefined) body = stack.TemplateBody;
  }
  let description = "";
  const parameters: {
    ParameterKey: string;
    DefaultValue: string;
    NoEcho: boolean;
    Description: string;
    ParameterType: string;
  }[] = [];
  if (body !== "") {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
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
            ParameterType: String(item["Type"] ?? "String"),
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
    ResourceIdentifierSummaries: [],
  };
};

const DescribeAccountLimits: OperationHandler = () => ({
  AccountLimits: [
    { Name: "StackLimit", Value: 2000 },
    { Name: "StackOutputsLimit", Value: 200 },
  ],
});

const SignalResource: OperationHandler = () => ({});

const DescribeChangeSetHooks: OperationHandler = (input, ctx) => {
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
    ChangeSetId: cs.ChangeSetId,
    ChangeSetName: cs.ChangeSetName,
    StackId: cs.StackId,
    StackName: cs.StackName,
    Hooks: [],
    Status: "PLANNING_COMPLETE",
  };
};

const ListExports: OperationHandler = () => ({ Exports: [] });

const ListImports: OperationHandler = () => ({ Imports: [] });

const requireStackSetName = (input: Record<string, unknown>): string => {
  const name = input["StackSetName"];
  if (typeof name !== "string" || name === "") {
    throw awsError("ValidationError", "StackSetName is required.", 400);
  }
  return name;
};

const findStackSet = (
  ctx: ServiceContext,
  name: string,
): StoredStackSet | undefined =>
  ctx.store.get<StoredStackSet>(stackSetKey(name));

const toStackSetSummary = (ss: StoredStackSet) => ({
  StackSetName: ss.StackSetName,
  StackSetId: ss.StackSetId,
  Description: ss.Description,
  Status: ss.Status,
});

const toStackSetDetail = (ss: StoredStackSet) => ({
  StackSetName: ss.StackSetName,
  StackSetId: ss.StackSetId,
  Description: ss.Description,
  Status: ss.Status,
  TemplateBody: ss.TemplateBody,
  Parameters: ss.Parameters,
  Capabilities: ss.Capabilities,
  Tags: ss.Tags,
  AdministrationRoleARN: ss.AdministrationRoleARN,
  ExecutionRoleName: ss.ExecutionRoleName,
});

const CreateStackSet: OperationHandler = (input, ctx) => {
  const name = requireStackSetName(input);
  if (findStackSet(ctx, name) !== undefined) {
    throw awsError(
      "NameAlreadyExistsException",
      `StackSet [${name}] already exists`,
      400,
    );
  }
  const id = crypto.randomUUID();
  const arn = stackSetArn(ctx, name, id);
  const now = new Date().toISOString();
  const stackSet: StoredStackSet = {
    StackSetId: arn,
    StackSetName: name,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : "",
    Status: "ACTIVE",
    TemplateBody: templateBodyOf(input),
    Parameters: parametersOf(input),
    Capabilities: capabilitiesOf(input),
    Tags: tagsOf(input),
    AdministrationRoleARN:
      typeof input["AdministrationRoleARN"] === "string"
        ? (input["AdministrationRoleARN"] as string)
        : `arn:aws:iam::${ctx.account}:role/AWSCloudFormationStackSetAdministrationRole`,
    ExecutionRoleName:
      typeof input["ExecutionRoleName"] === "string"
        ? (input["ExecutionRoleName"] as string)
        : "AWSCloudFormationStackSetExecutionRole",
    CreationTime: now,
    LastUpdatedTime: now,
  };
  ctx.store.set(stackSetKey(name), stackSet);
  return { StackSetId: arn };
};

const DescribeStackSet: OperationHandler = (input, ctx) => {
  const name = requireStackSetName(input);
  const ss = findStackSet(ctx, name);
  if (ss === undefined) {
    throw awsError(
      "StackSetNotFoundException",
      `StackSet [${name}] does not exist`,
      404,
    );
  }
  return { StackSet: toStackSetDetail(ss) };
};

const UpdateStackSet: OperationHandler = (input, ctx) => {
  const name = requireStackSetName(input);
  const ss = findStackSet(ctx, name);
  if (ss === undefined) {
    throw awsError(
      "StackSetNotFoundException",
      `StackSet [${name}] does not exist`,
      404,
    );
  }
  const opId = crypto.randomUUID();
  const now = new Date().toISOString();
  const updated: StoredStackSet = {
    ...ss,
    TemplateBody: templateBodyOf(input) || ss.TemplateBody,
    Parameters:
      input["Parameters"] === undefined ? ss.Parameters : parametersOf(input),
    Capabilities:
      input["Capabilities"] === undefined
        ? ss.Capabilities
        : capabilitiesOf(input),
    Tags: input["Tags"] === undefined ? ss.Tags : tagsOf(input),
    LastUpdatedTime: now,
  };
  ctx.store.set(stackSetKey(name), updated);
  const op: StoredStackSetOperation = {
    OperationId: opId,
    StackSetId: ss.StackSetId,
    StackSetName: name,
    Action: "UPDATE",
    Status: "SUCCEEDED",
    CreationTime: now,
  };
  ctx.store.set(stackSetOpKey(opId), op);
  return { OperationId: opId };
};

const DeleteStackSet: OperationHandler = (input, ctx) => {
  const name = requireStackSetName(input);
  const ss = findStackSet(ctx, name);
  if (ss === undefined) {
    throw awsError(
      "StackSetNotFoundException",
      `StackSet [${name}] does not exist`,
      404,
    );
  }
  ctx.store.delete(stackSetKey(name));
  return {};
};

const ListStackSets: OperationHandler = (input, ctx) => {
  const rawStatus = input["Status"];
  const statusFilter =
    typeof rawStatus === "string" && rawStatus !== "" ? rawStatus : undefined;
  const summaries = listStackSets(ctx)
    .filter((ss) =>
      statusFilter === undefined ? true : ss.Status === statusFilter,
    )
    .map((ss) => toStackSetSummary(ss));
  return { Summaries: summaries };
};

const CreateStackInstances: OperationHandler = (input, ctx) => {
  const stackSetName = requireStackSetName(input);
  const ss = findStackSet(ctx, stackSetName);
  if (ss === undefined) {
    throw awsError(
      "StackSetNotFoundException",
      `StackSet [${stackSetName}] does not exist`,
      404,
    );
  }
  const rawAccounts = input["Accounts"];
  const accounts = Array.isArray(rawAccounts)
    ? (rawAccounts as unknown[]).map((a) => String(a))
    : [ctx.account];
  const rawRegions = input["Regions"];
  const regions = Array.isArray(rawRegions)
    ? (rawRegions as unknown[]).map((r) => String(r))
    : [ctx.region];
  const opId = crypto.randomUUID();
  const now = new Date().toISOString();
  for (const account of accounts) {
    for (const region of regions) {
      const instanceId = crypto.randomUUID();
      const instance: StoredStackInstance = {
        StackSetId: ss.StackSetId,
        StackSetName: stackSetName,
        Region: region,
        Account: account,
        StackId: stackArn(ctx, stackSetName, instanceId),
        Status: "CURRENT",
        CreationTime: now,
      };
      ctx.store.set(stackInstanceKey(stackSetName, account, region), instance);
    }
  }
  const op: StoredStackSetOperation = {
    OperationId: opId,
    StackSetId: ss.StackSetId,
    StackSetName: stackSetName,
    Action: "CREATE",
    Status: "SUCCEEDED",
    CreationTime: now,
  };
  ctx.store.set(stackSetOpKey(opId), op);
  return { OperationId: opId };
};

const DeleteStackInstances: OperationHandler = (input, ctx) => {
  const stackSetName = requireStackSetName(input);
  const ss = findStackSet(ctx, stackSetName);
  if (ss === undefined) {
    throw awsError(
      "StackSetNotFoundException",
      `StackSet [${stackSetName}] does not exist`,
      404,
    );
  }
  const rawAccounts = input["Accounts"];
  const accounts = Array.isArray(rawAccounts)
    ? (rawAccounts as unknown[]).map((a) => String(a))
    : [];
  const rawRegions = input["Regions"];
  const regions = Array.isArray(rawRegions)
    ? (rawRegions as unknown[]).map((r) => String(r))
    : [];
  const opId = crypto.randomUUID();
  const now = new Date().toISOString();
  for (const account of accounts) {
    for (const region of regions) {
      ctx.store.delete(stackInstanceKey(stackSetName, account, region));
    }
  }
  const op: StoredStackSetOperation = {
    OperationId: opId,
    StackSetId: ss.StackSetId,
    StackSetName: stackSetName,
    Action: "DELETE",
    Status: "SUCCEEDED",
    CreationTime: now,
  };
  ctx.store.set(stackSetOpKey(opId), op);
  return { OperationId: opId };
};

const DescribeStackInstance: OperationHandler = (input, ctx) => {
  const stackSetName = requireStackSetName(input);
  const account = String(input["StackInstanceAccount"] ?? ctx.account);
  const region = String(input["StackInstanceRegion"] ?? ctx.region);
  const instance = ctx.store.get<StoredStackInstance>(
    stackInstanceKey(stackSetName, account, region),
  );
  if (instance === undefined) {
    throw awsError(
      "StackInstanceNotFoundException",
      `Stack instance not found for ${stackSetName} in ${account}/${region}`,
      404,
    );
  }
  return {
    StackInstance: {
      StackSetId: instance.StackSetId,
      Region: instance.Region,
      Account: instance.Account,
      StackId: instance.StackId,
      Status: instance.Status,
    },
  };
};

const ListStackInstances: OperationHandler = (input, ctx) => {
  const stackSetName = requireStackSetName(input);
  const instances = listStackInstances(ctx)
    .filter((si) => si.StackSetName === stackSetName)
    .map((si) => ({
      StackSetId: si.StackSetId,
      Region: si.Region,
      Account: si.Account,
      StackId: si.StackId,
      Status: si.Status,
    }));
  return { Summaries: instances };
};

const UpdateStackInstances: OperationHandler = (input, ctx) => {
  const stackSetName = requireStackSetName(input);
  const ss = findStackSet(ctx, stackSetName);
  if (ss === undefined) {
    throw awsError(
      "StackSetNotFoundException",
      `StackSet [${stackSetName}] does not exist`,
      404,
    );
  }
  const opId = crypto.randomUUID();
  const now = new Date().toISOString();
  const op: StoredStackSetOperation = {
    OperationId: opId,
    StackSetId: ss.StackSetId,
    StackSetName: stackSetName,
    Action: "UPDATE",
    Status: "SUCCEEDED",
    CreationTime: now,
  };
  ctx.store.set(stackSetOpKey(opId), op);
  return { OperationId: opId };
};

const DescribeStackSetOperation: OperationHandler = (input, ctx) => {
  const stackSetName = requireStackSetName(input);
  const opId = String(input["OperationId"] ?? "");
  const op = ctx.store.get<StoredStackSetOperation>(stackSetOpKey(opId));
  if (op === undefined || op.StackSetName !== stackSetName) {
    throw awsError(
      "OperationNotFoundException",
      `Operation [${opId}] not found for StackSet [${stackSetName}]`,
      404,
    );
  }
  return {
    StackSetOperation: {
      OperationId: op.OperationId,
      StackSetId: op.StackSetId,
      Action: op.Action,
      Status: op.Status,
      CreationTimestamp: op.CreationTime,
    },
  };
};

const ListStackSetOperations: OperationHandler = (input, ctx) => {
  const stackSetName = requireStackSetName(input);
  const ops = listStackSetOps(ctx)
    .filter((op) => op.StackSetName === stackSetName)
    .map((op) => ({
      OperationId: op.OperationId,
      Action: op.Action,
      Status: op.Status,
      CreationTimestamp: op.CreationTime,
    }));
  return { Summaries: ops };
};

const StopStackSetOperation: OperationHandler = (input, ctx) => {
  const stackSetName = requireStackSetName(input);
  const opId = String(input["OperationId"] ?? "");
  const op = ctx.store.get<StoredStackSetOperation>(stackSetOpKey(opId));
  if (op === undefined || op.StackSetName !== stackSetName) {
    throw awsError(
      "OperationNotFoundException",
      `Operation [${opId}] not found for StackSet [${stackSetName}]`,
      404,
    );
  }
  const updated: StoredStackSetOperation = { ...op, Status: "STOPPED" };
  ctx.store.set(stackSetOpKey(opId), updated);
  return {};
};

const ListStackSetOperationResults: OperationHandler = () => ({
  Summaries: [],
});

const DetectStackSetDrift: OperationHandler = (input, ctx) => {
  const stackSetName = requireStackSetName(input);
  const ss = findStackSet(ctx, stackSetName);
  if (ss === undefined) {
    throw awsError(
      "StackSetNotFoundException",
      `StackSet [${stackSetName}] does not exist`,
      404,
    );
  }
  return { OperationId: crypto.randomUUID() };
};

const ListStackSetAutoDeploymentTargets: OperationHandler = () => ({
  Summaries: [],
});

const ListStackInstanceResourceDrifts: OperationHandler = () => ({
  Summaries: [],
});

const ImportStacksToStackSet: OperationHandler = (input, ctx) => {
  const stackSetName = requireStackSetName(input);
  const ss = findStackSet(ctx, stackSetName);
  if (ss === undefined) {
    throw awsError(
      "StackSetNotFoundException",
      `StackSet [${stackSetName}] does not exist`,
      404,
    );
  }
  return { OperationId: crypto.randomUUID() };
};

const requireGeneratedTemplateName = (
  input: Record<string, unknown>,
): string => {
  const name = input["GeneratedTemplateName"];
  if (typeof name !== "string" || name === "") {
    throw awsError(
      "ValidationError",
      "GeneratedTemplateName is required.",
      400,
    );
  }
  return name;
};

const findGeneratedTemplate = (
  ctx: ServiceContext,
  name: string,
): StoredGeneratedTemplate | undefined =>
  ctx.store.get<StoredGeneratedTemplate>(generatedTemplateKey(name));

const CreateGeneratedTemplate: OperationHandler = (input, ctx) => {
  const name = requireGeneratedTemplateName(input);
  if (findGeneratedTemplate(ctx, name) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `GeneratedTemplate [${name}] already exists`,
      400,
    );
  }
  const id = crypto.randomUUID();
  const arn = `arn:aws:cloudformation:${ctx.region}:${ctx.account}:generatedtemplate/${id}`;
  const now = new Date().toISOString();
  const gt: StoredGeneratedTemplate = {
    GeneratedTemplateId: arn,
    GeneratedTemplateName: name,
    StackName:
      typeof input["StackName"] === "string"
        ? (input["StackName"] as string)
        : "",
    Status: "COMPLETE",
    TemplateBody: "",
    CreationTime: now,
    LastUpdatedTime: now,
  };
  ctx.store.set(generatedTemplateKey(name), gt);
  return { GeneratedTemplateId: arn };
};

const DescribeGeneratedTemplate: OperationHandler = (input, ctx) => {
  const name = requireGeneratedTemplateName(input);
  const gt = findGeneratedTemplate(ctx, name);
  if (gt === undefined) {
    throw awsError(
      "GeneratedTemplateNotFoundException",
      `GeneratedTemplate [${name}] does not exist`,
      404,
    );
  }
  return {
    GeneratedTemplateId: gt.GeneratedTemplateId,
    GeneratedTemplateName: gt.GeneratedTemplateName,
    StackName: gt.StackName,
    Status: gt.Status,
    CreationTime: gt.CreationTime,
    LastUpdatedTime: gt.LastUpdatedTime,
    Resources: [],
  };
};

const UpdateGeneratedTemplate: OperationHandler = (input, ctx) => {
  const name = requireGeneratedTemplateName(input);
  const gt = findGeneratedTemplate(ctx, name);
  if (gt === undefined) {
    throw awsError(
      "GeneratedTemplateNotFoundException",
      `GeneratedTemplate [${name}] does not exist`,
      404,
    );
  }
  const newName =
    typeof input["NewGeneratedTemplateName"] === "string" &&
    input["NewGeneratedTemplateName"] !== ""
      ? (input["NewGeneratedTemplateName"] as string)
      : name;
  const updated: StoredGeneratedTemplate = {
    ...gt,
    GeneratedTemplateName: newName,
    LastUpdatedTime: new Date().toISOString(),
  };
  if (newName !== name) {
    ctx.store.delete(generatedTemplateKey(name));
  }
  ctx.store.set(generatedTemplateKey(newName), updated);
  return { GeneratedTemplateId: gt.GeneratedTemplateId };
};

const DeleteGeneratedTemplate: OperationHandler = (input, ctx) => {
  const name = requireGeneratedTemplateName(input);
  const gt = findGeneratedTemplate(ctx, name);
  if (gt === undefined) {
    throw awsError(
      "GeneratedTemplateNotFoundException",
      `GeneratedTemplate [${name}] does not exist`,
      404,
    );
  }
  ctx.store.delete(generatedTemplateKey(name));
  return {};
};

const ListGeneratedTemplates: OperationHandler = (input, ctx) => {
  const summaries = listGeneratedTemplates(ctx).map((gt) => ({
    GeneratedTemplateId: gt.GeneratedTemplateId,
    GeneratedTemplateName: gt.GeneratedTemplateName,
    Status: gt.Status,
    CreationTime: gt.CreationTime,
    LastUpdatedTime: gt.LastUpdatedTime,
  }));
  return { Summaries: summaries };
};

const GetGeneratedTemplate: OperationHandler = (input, ctx) => {
  const name = requireGeneratedTemplateName(input);
  const gt = findGeneratedTemplate(ctx, name);
  if (gt === undefined) {
    throw awsError(
      "GeneratedTemplateNotFoundException",
      `GeneratedTemplate [${name}] does not exist`,
      404,
    );
  }
  return { Status: gt.Status, TemplateBody: gt.TemplateBody };
};

const requireTypeName = (input: Record<string, unknown>): string => {
  const name = input["TypeName"];
  if (typeof name !== "string" || name === "") {
    throw awsError("ValidationError", "TypeName is required.", 400);
  }
  return name;
};

const findType = (
  ctx: ServiceContext,
  typeName: string,
): StoredType | undefined => ctx.store.get<StoredType>(typeKey(typeName));

const RegisterType: OperationHandler = (input, ctx) => {
  const typeName = requireTypeName(input);
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const versionId = "00000001";
  const arn = typeArn(ctx, typeName);
  const storedType: StoredType = {
    TypeArn: arn,
    TypeName: typeName,
    Type:
      typeof input["Type"] === "string"
        ? (input["Type"] as string)
        : "RESOURCE",
    DefaultVersionId: versionId,
    Status: "LIVE",
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : "",
    SchemaHandlerPackage:
      typeof input["SchemaHandlerPackage"] === "string"
        ? (input["SchemaHandlerPackage"] as string)
        : "",
    RegistrationToken: token,
    CreationTime: now,
    LastUpdatedTime: now,
  };
  ctx.store.set(typeKey(typeName), storedType);
  const version: StoredTypeVersion = {
    Arn: `${arn}::${versionId}`,
    TypeName: typeName,
    Type: storedType.Type,
    VersionId: versionId,
    IsDefaultVersion: true,
    CreationTime: now,
  };
  ctx.store.set(typeVersionKey(typeName, versionId), version);
  ctx.store.set(`${regTokenPrefix}${token}`, {
    token,
    typeName,
    status: "COMPLETE",
  });
  return { RegistrationToken: token };
};

const DeregisterType: OperationHandler = (input, ctx) => {
  const typeName = requireTypeName(input);
  const stored = findType(ctx, typeName);
  if (stored === undefined) {
    throw awsError(
      "TypeNotFoundException",
      `Type [${typeName}] not found`,
      404,
    );
  }
  ctx.store.delete(typeKey(typeName));
  return {};
};

const DescribeType: OperationHandler = (input, ctx) => {
  const typeName = requireTypeName(input);
  const stored = findType(ctx, typeName);
  if (stored === undefined) {
    throw awsError(
      "TypeNotFoundException",
      `Type [${typeName}] not found`,
      404,
    );
  }
  return {
    Arn: stored.TypeArn,
    Type: stored.Type,
    TypeName: stored.TypeName,
    DefaultVersionId: stored.DefaultVersionId,
    IsActivated: true,
    DeprecatedStatus: stored.Status,
    Description: stored.Description,
    TimeCreated: stored.CreationTime,
    LastUpdated: stored.LastUpdatedTime,
  };
};

const DescribeTypeRegistration: OperationHandler = (input, ctx) => {
  const token = String(input["RegistrationToken"] ?? "");
  const entry = ctx.store.get<{
    token: string;
    typeName: string;
    status: string;
  }>(`${regTokenPrefix}${token}`);
  if (entry === undefined) {
    throw awsError(
      "CFNRegistryException",
      `Registration token [${token}] not found`,
      404,
    );
  }
  const stored = findType(ctx, entry.typeName);
  return {
    ProgressStatus: entry.status,
    TypeArn: stored?.TypeArn ?? "",
    TypeVersionArn: stored
      ? `${stored.TypeArn}::${stored.DefaultVersionId}`
      : "",
  };
};

const ListTypes: OperationHandler = (input, ctx) => {
  const rawVis = input["Visibility"];
  const typeFilter =
    typeof input["Type"] === "string" ? (input["Type"] as string) : undefined;
  const types = listTypes(ctx)
    .filter((t) => typeFilter === undefined || t.Type === typeFilter)
    .map((t) => ({
      Type: t.Type,
      TypeName: t.TypeName,
      TypeArn: t.TypeArn,
      DefaultVersionId: t.DefaultVersionId,
      IsActivated: true,
      LastUpdated: t.LastUpdatedTime,
    }));
  void rawVis;
  return { TypeSummaries: types };
};

const ListTypeVersions: OperationHandler = (input, ctx) => {
  const typeName = requireTypeName(input);
  const versions = listTypeVersions(ctx)
    .filter((v) => v.TypeName === typeName)
    .map((v) => ({
      Type: v.Type,
      TypeName: v.TypeName,
      Arn: v.Arn,
      VersionId: v.VersionId,
      IsDefaultVersion: v.IsDefaultVersion,
      TimeCreated: v.CreationTime,
    }));
  return { TypeVersionSummaries: versions };
};

const ListTypeRegistrations: OperationHandler = () => ({
  RegistrationTokenList: [],
});

const SetTypeConfiguration: OperationHandler = (input, ctx) => {
  const typeName = requireTypeName(input);
  const stored = findType(ctx, typeName);
  if (stored === undefined) {
    throw awsError(
      "TypeNotFoundException",
      `Type [${typeName}] not found`,
      404,
    );
  }
  return {
    ConfigurationArn: `arn:aws:cloudformation:${ctx.region}:${ctx.account}:type-configuration/resource/${typeName.replace(/::/g, "-")}/default`,
  };
};

const SetTypeDefaultVersion: OperationHandler = (input, ctx) => {
  const typeName = requireTypeName(input);
  const stored = findType(ctx, typeName);
  if (stored === undefined) {
    throw awsError(
      "TypeNotFoundException",
      `Type [${typeName}] not found`,
      404,
    );
  }
  const versionId = String(input["VersionId"] ?? stored.DefaultVersionId);
  const updated: StoredType = { ...stored, DefaultVersionId: versionId };
  ctx.store.set(typeKey(typeName), updated);
  return {};
};

const ActivateType: OperationHandler = (input, ctx) => {
  const typeName = requireTypeName(input);
  const now = new Date().toISOString();
  const arn = typeArn(ctx, typeName);
  if (findType(ctx, typeName) === undefined) {
    const storedType: StoredType = {
      TypeArn: arn,
      TypeName: typeName,
      Type:
        typeof input["Type"] === "string"
          ? (input["Type"] as string)
          : "RESOURCE",
      DefaultVersionId: "00000001",
      Status: "LIVE",
      Description: "",
      SchemaHandlerPackage: "",
      RegistrationToken: "",
      CreationTime: now,
      LastUpdatedTime: now,
    };
    ctx.store.set(typeKey(typeName), storedType);
  }
  return { Arn: arn };
};

const DeactivateType: OperationHandler = (input, ctx) => {
  const typeName = requireTypeName(input);
  const stored = findType(ctx, typeName);
  if (stored !== undefined) {
    const updated: StoredType = { ...stored, Status: "DEPRECATED" };
    ctx.store.set(typeKey(typeName), updated);
  }
  return {};
};

const PublishType: OperationHandler = (input, ctx) => {
  const typeName = requireTypeName(input);
  const stored = findType(ctx, typeName);
  if (stored === undefined) {
    throw awsError(
      "TypeNotFoundException",
      `Type [${typeName}] not found`,
      404,
    );
  }
  return {
    PublicTypeArn: `arn:aws:cloudformation:${ctx.region}::type/resource/000000000000/${typeName.replace(/::/g, "-")}`,
  };
};

const TestType: OperationHandler = (input, ctx) => {
  const typeName = requireTypeName(input);
  const stored = findType(ctx, typeName);
  if (stored === undefined) {
    throw awsError(
      "TypeNotFoundException",
      `Type [${typeName}] not found`,
      404,
    );
  }
  return {
    TypeVersionArn: `${stored.TypeArn}::${stored.DefaultVersionId}`,
  };
};

const BatchDescribeTypeConfigurations: OperationHandler = () => ({
  TypeConfigurations: [],
  Errors: [],
  UnprocessedTypeConfigurations: [],
});

const CreateStackRefactor: OperationHandler = (input, ctx) => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const refactor: StoredStackRefactor = {
    StackRefactorId: id,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : "",
    Status: "CREATE_COMPLETE",
    CreationTime: now,
  };
  ctx.store.set(stackRefactorKey(id), refactor);
  return { StackRefactorId: id };
};

const DescribeStackRefactor: OperationHandler = (input, ctx) => {
  const id = String(input["StackRefactorId"] ?? "");
  const refactor = ctx.store.get<StoredStackRefactor>(stackRefactorKey(id));
  if (refactor === undefined) {
    throw awsError(
      "StackRefactorNotFoundException",
      `StackRefactor [${id}] not found`,
      404,
    );
  }
  return {
    StackRefactorId: refactor.StackRefactorId,
    Description: refactor.Description,
    ExecutionStatus: "AVAILABLE",
    Status: refactor.Status,
    CreationTime: refactor.CreationTime,
  };
};

const ExecuteStackRefactor: OperationHandler = (input, ctx) => {
  const id = String(input["StackRefactorId"] ?? "");
  const refactor = ctx.store.get<StoredStackRefactor>(stackRefactorKey(id));
  if (refactor === undefined) {
    throw awsError(
      "StackRefactorNotFoundException",
      `StackRefactor [${id}] not found`,
      404,
    );
  }
  const updated: StoredStackRefactor = {
    ...refactor,
    Status: "EXECUTE_COMPLETE",
  };
  ctx.store.set(stackRefactorKey(id), updated);
  return {};
};

const ListStackRefactors: OperationHandler = (input, ctx) => {
  const summaries = listStackRefactors(ctx).map((r) => ({
    StackRefactorId: r.StackRefactorId,
    Status: r.Status,
    ExecutionStatus: "AVAILABLE",
    CreationTime: r.CreationTime,
  }));
  return { StackRefactorSummaries: summaries };
};

const ListStackRefactorActions: OperationHandler = (input, ctx) => {
  const id = String(input["StackRefactorId"] ?? "");
  const refactor = ctx.store.get<StoredStackRefactor>(stackRefactorKey(id));
  if (refactor === undefined) {
    throw awsError(
      "StackRefactorNotFoundException",
      `StackRefactor [${id}] not found`,
      404,
    );
  }
  return { StackRefactorActions: [] };
};

const StartResourceScan: OperationHandler = (input, ctx) => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const scan: StoredResourceScan = {
    ResourceScanId: id,
    Status: "COMPLETE",
    StartTime: now,
    EndTime: now,
    PercentageCompleted: 100,
  };
  ctx.store.set(resourceScanKey(id), scan);
  return { ResourceScanId: id };
};

const DescribeResourceScan: OperationHandler = (input, ctx) => {
  const id = String(input["ResourceScanId"] ?? "");
  const scan = ctx.store.get<StoredResourceScan>(resourceScanKey(id));
  if (scan === undefined) {
    throw awsError(
      "ResourceScanNotFoundException",
      `ResourceScan [${id}] not found`,
      404,
    );
  }
  return {
    ResourceScanId: scan.ResourceScanId,
    Status: scan.Status,
    StartTime: scan.StartTime,
    EndTime: scan.EndTime,
    PercentageCompleted: scan.PercentageCompleted,
  };
};

const ListResourceScans: OperationHandler = (input, ctx) => {
  const summaries = listResourceScans(ctx).map((s) => ({
    ResourceScanId: s.ResourceScanId,
    Status: s.Status,
    StartTime: s.StartTime,
    EndTime: s.EndTime,
    PercentageCompleted: s.PercentageCompleted,
  }));
  return { ResourceScanSummaries: summaries };
};

const ListResourceScanResources: OperationHandler = (input, ctx) => {
  const id = String(input["ResourceScanId"] ?? "");
  const scan = ctx.store.get<StoredResourceScan>(resourceScanKey(id));
  if (scan === undefined) {
    throw awsError(
      "ResourceScanNotFoundException",
      `ResourceScan [${id}] not found`,
      404,
    );
  }
  return { Resources: [] };
};

const ListResourceScanRelatedResources: OperationHandler = (input, ctx) => {
  const id = String(input["ResourceScanId"] ?? "");
  const scan = ctx.store.get<StoredResourceScan>(resourceScanKey(id));
  if (scan === undefined) {
    throw awsError(
      "ResourceScanNotFoundException",
      `ResourceScan [${id}] not found`,
      404,
    );
  }
  return { RelatedResources: [] };
};

const RegisterPublisher: OperationHandler = (input, ctx) => {
  const id = crypto.randomUUID();
  const pub: StoredPublisher = {
    PublisherId: id,
    PublisherStatus: "VERIFIED",
    PublisherProfile:
      typeof input["PublisherProfile"] === "string"
        ? (input["PublisherProfile"] as string)
        : "",
    ConnectionArn:
      typeof input["ConnectionArn"] === "string"
        ? (input["ConnectionArn"] as string)
        : "",
  };
  ctx.store.set(publisherKey(id), pub);
  return { PublisherId: id };
};

const DescribePublisher: OperationHandler = (input, ctx) => {
  const id = String(input["PublisherId"] ?? "");
  const pub = ctx.store.get<StoredPublisher>(publisherKey(id));
  if (pub === undefined) {
    throw awsError("CFNRegistryException", `Publisher [${id}] not found`, 404);
  }
  return {
    PublisherId: pub.PublisherId,
    PublisherStatus: pub.PublisherStatus,
    PublisherProfile: pub.PublisherProfile,
    ConnectionArn: pub.ConnectionArn,
  };
};

const RecordHandlerProgress: OperationHandler = () => ({});

const GetHookResult: OperationHandler = () => ({
  HookStatus: "HOOK_COMPLETE_SUCCEEDED",
  HookStatusReason: "",
  HookInvocationPoint: "PRE_PROVISION",
  HookFailureMode: "WARN",
});

const ListHookResults: OperationHandler = () => ({ HookResults: [] });

const ActivateOrganizationsAccess: OperationHandler = () => ({});

const DeactivateOrganizationsAccess: OperationHandler = () => ({});

const DescribeOrganizationsAccess: OperationHandler = () => ({
  Status: "ENABLED",
});

const cloudformation: ServiceDefinition = {
  name: "cloudformation",
  protocol: "query",
  operations: {
    ActivateOrganizationsAccess,
    ActivateType,
    BatchDescribeTypeConfigurations,
    CancelUpdateStack,
    ContinueUpdateRollback,
    CreateChangeSet,
    CreateGeneratedTemplate,
    CreateStack,
    CreateStackInstances,
    CreateStackRefactor,
    CreateStackSet,
    DeactivateOrganizationsAccess,
    DeactivateType,
    DeleteChangeSet,
    DeleteGeneratedTemplate,
    DeleteStack,
    DeleteStackInstances,
    DeleteStackSet,
    DeregisterType,
    DescribeAccountLimits,
    DescribeChangeSet,
    DescribeChangeSetHooks,
    DescribeEvents,
    DescribeGeneratedTemplate,
    DescribeOrganizationsAccess,
    DescribePublisher,
    DescribeResourceScan,
    DescribeStackDriftDetectionStatus,
    DescribeStackEvents,
    DescribeStackInstance,
    DescribeStackRefactor,
    DescribeStackResource,
    DescribeStackResourceDrifts,
    DescribeStackResources,
    DescribeStackSet,
    DescribeStackSetOperation,
    DescribeStacks,
    DescribeType,
    DescribeTypeRegistration,
    DetectStackDrift,
    DetectStackResourceDrift,
    DetectStackSetDrift,
    EstimateTemplateCost,
    ExecuteChangeSet,
    ExecuteStackRefactor,
    GetGeneratedTemplate,
    GetHookResult,
    GetStackPolicy,
    GetTemplate,
    GetTemplateSummary,
    ImportStacksToStackSet,
    ListChangeSets,
    ListExports,
    ListGeneratedTemplates,
    ListHookResults,
    ListImports,
    ListResourceScanRelatedResources,
    ListResourceScanResources,
    ListResourceScans,
    ListStackInstanceResourceDrifts,
    ListStackInstances,
    ListStackRefactorActions,
    ListStackRefactors,
    ListStackResources,
    ListStackSetAutoDeploymentTargets,
    ListStackSetOperationResults,
    ListStackSetOperations,
    ListStackSets,
    ListStacks,
    ListTypeRegistrations,
    ListTypeVersions,
    ListTypes,
    PublishType,
    RecordHandlerProgress,
    RegisterPublisher,
    RegisterType,
    RollbackStack,
    SetStackPolicy,
    SetTypeConfiguration,
    SetTypeDefaultVersion,
    SignalResource,
    StartResourceScan,
    StopStackSetOperation,
    TestType,
    UpdateGeneratedTemplate,
    UpdateStack,
    UpdateStackInstances,
    UpdateStackSet,
    UpdateTerminationProtection,
    ValidateTemplate,
  },
  model,
} as const;

export default cloudformation;
