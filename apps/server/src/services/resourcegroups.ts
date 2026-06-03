import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import resourcegroupsModel from "../../../../test/vendor/aws-models/resourcegroups.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(resourcegroupsModel);

const groupPrefix = "group:" as const;
const taskPrefix = "task:" as const;
const accountKey = "account-settings" as const;

type StoredGroup = {
  Name: string;
  GroupArn: string;
  Description: string | undefined;
  Criticality: number | undefined;
  Owner: string | undefined;
  DisplayName: string | undefined;
  ResourceQuery: Record<string, unknown> | undefined;
  Tags: Record<string, string>;
  GroupConfiguration: Record<string, unknown> | undefined;
  ResourceArns: string[];
};

type StoredTagSyncTask = {
  TaskArn: string;
  GroupArn: string;
  GroupName: string;
  TagKey: string | undefined;
  TagValue: string | undefined;
  ResourceQuery: Record<string, unknown> | undefined;
  RoleArn: string;
  Status: string;
  ErrorMessage: string | undefined;
  CreatedAt: number;
};

type StoredAccountSettings = {
  GroupLifecycleEventsDesiredStatus: string | undefined;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const stringMapFrom = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  const record = asRecord(value);
  if (record === undefined) return out;
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
};

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

const groupKey = (name: string): string => `${groupPrefix}${name}`;

const taskKey = (arn: string): string => `${taskPrefix}${arn}`;

const groupArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:resource-groups:${ctx.region}:${ctx.account}:group/${name}`;

const taskArnOf = (ctx: ServiceContext, id: string): string =>
  `arn:aws:resource-groups:${ctx.region}:${ctx.account}:tag-sync-task/${id}`;

const nameFromArn = (value: string): string => {
  const slash = value.lastIndexOf("/");
  return slash === -1 ? value : value.slice(slash + 1);
};

const groupNameOf = (input: Record<string, unknown>): string => {
  const name = stringOrUndefined(input["GroupName"]);
  if (name !== undefined) return name;
  const group = stringOrUndefined(input["Group"]);
  if (group !== undefined) return nameFromArn(group);
  throw awsError("BadRequestException", "GroupName is required.", 400);
};

const groupView = (group: StoredGroup): Record<string, unknown> => ({
  GroupArn: group.GroupArn,
  Name: group.Name,
  Description: group.Description,
  Criticality: group.Criticality,
  Owner: group.Owner,
  DisplayName: group.DisplayName,
});

const requireGroup = (ctx: ServiceContext, name: string): StoredGroup => {
  const stored = ctx.store.get<StoredGroup>(groupKey(name));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Group ${name} could not be found.`,
      404,
    );
  }
  return stored;
};

const requireTask = (ctx: ServiceContext, arn: string): StoredTagSyncTask => {
  const stored = ctx.store.get<StoredTagSyncTask>(taskKey(arn));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Tag sync task ${arn} could not be found.`,
      404,
    );
  }
  return stored;
};

const taskView = (task: StoredTagSyncTask): Record<string, unknown> => ({
  GroupArn: task.GroupArn,
  GroupName: task.GroupName,
  TaskArn: task.TaskArn,
  TagKey: task.TagKey,
  TagValue: task.TagValue,
  ResourceQuery: task.ResourceQuery,
  RoleArn: task.RoleArn,
  Status: task.Status,
  ErrorMessage: task.ErrorMessage,
  CreatedAt: task.CreatedAt,
});

const CreateGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get<StoredGroup>(groupKey(name)) !== undefined) {
    throw awsError(
      "BadRequestException",
      `A group with the name ${name} already exists.`,
      400,
    );
  }
  const group: StoredGroup = {
    Name: name,
    GroupArn: groupArnOf(ctx, name),
    Description: stringOrUndefined(input["Description"]),
    Criticality: numberOrUndefined(input["Criticality"]),
    Owner: stringOrUndefined(input["Owner"]),
    DisplayName: stringOrUndefined(input["DisplayName"]),
    ResourceQuery: asRecord(input["ResourceQuery"]),
    Tags: stringMapFrom(input["Tags"]),
    GroupConfiguration: undefined,
    ResourceArns: [],
  };
  ctx.store.set(groupKey(name), group);
  return {
    Group: groupView(group),
    ResourceQuery: group.ResourceQuery,
    Tags: group.Tags,
    GroupConfiguration: group.GroupConfiguration,
  };
};

const GetGroup: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  const group = requireGroup(ctx, name);
  return { Group: groupView(group) };
};

const ListGroups: OperationHandler = (input, ctx) => {
  const max =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 50;
  const groups = ctx.store
    .list<StoredGroup>()
    .filter((entry) => entry.key.startsWith(groupPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0))
    .slice(0, max);
  return {
    GroupIdentifiers: groups.map((group) => ({
      GroupName: group.Name,
      GroupArn: group.GroupArn,
    })),
    Groups: groups.map(groupView),
  };
};

const UpdateGroup: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  const existing = requireGroup(ctx, name);
  const group: StoredGroup = {
    ...existing,
    Description:
      stringOrUndefined(input["Description"]) ?? existing.Description,
    Criticality:
      numberOrUndefined(input["Criticality"]) ?? existing.Criticality,
    Owner: stringOrUndefined(input["Owner"]) ?? existing.Owner,
    DisplayName:
      stringOrUndefined(input["DisplayName"]) ?? existing.DisplayName,
  };
  ctx.store.set(groupKey(name), group);
  return { Group: groupView(group) };
};

const DeleteGroup: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  const group = requireGroup(ctx, name);
  ctx.store.delete(groupKey(name));
  return { Group: groupView(group) };
};

const GetGroupQuery: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  const group = requireGroup(ctx, name);
  return {
    GroupQuery: {
      GroupName: group.Name,
      ResourceQuery: group.ResourceQuery,
    },
  };
};

const UpdateGroupQuery: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  const existing = requireGroup(ctx, name);
  const group: StoredGroup = {
    ...existing,
    ResourceQuery: asRecord(input["ResourceQuery"]) ?? existing.ResourceQuery,
  };
  ctx.store.set(groupKey(name), group);
  return {
    GroupQuery: {
      GroupName: group.Name,
      ResourceQuery: group.ResourceQuery,
    },
  };
};

const GetGroupConfiguration: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  const group = requireGroup(ctx, name);
  const cfg = group.GroupConfiguration;
  return {
    GroupConfiguration: {
      Configuration: cfg?.["Configuration"] ?? [],
      Status: "UPDATE_COMPLETE",
      FailureReason: undefined,
    },
  };
};

const PutGroupConfiguration: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  const existing = requireGroup(ctx, name);
  const group: StoredGroup = {
    ...existing,
    GroupConfiguration: { Configuration: input["Configuration"] ?? [] },
  };
  ctx.store.set(groupKey(name), group);
  return {};
};

const GroupResources: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  const existing = requireGroup(ctx, name);
  const arns = Array.isArray(input["ResourceArns"])
    ? (input["ResourceArns"] as string[]).filter(
        (a): a is string => typeof a === "string",
      )
    : [];
  const current = new Set(existing.ResourceArns);
  for (const arn of arns) current.add(arn);
  const group: StoredGroup = {
    ...existing,
    ResourceArns: Array.from(current),
  };
  ctx.store.set(groupKey(name), group);
  return { Succeeded: arns, Failed: [], Pending: [] };
};

const UngroupResources: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  const existing = requireGroup(ctx, name);
  const arns = Array.isArray(input["ResourceArns"])
    ? (input["ResourceArns"] as string[]).filter(
        (a): a is string => typeof a === "string",
      )
    : [];
  const toRemove = new Set(arns);
  const group: StoredGroup = {
    ...existing,
    ResourceArns: existing.ResourceArns.filter((a) => !toRemove.has(a)),
  };
  ctx.store.set(groupKey(name), group);
  return { Succeeded: arns, Failed: [], Pending: [] };
};

const ListGroupResources: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  const group = requireGroup(ctx, name);
  const identifiers = group.ResourceArns.map((arn) => ({
    ResourceArn: arn,
    ResourceType: undefined,
  }));
  const resources = group.ResourceArns.map((arn) => ({
    Identifier: { ResourceArn: arn, ResourceType: undefined },
    Status: undefined,
  }));
  return {
    Resources: resources,
    ResourceIdentifiers: identifiers,
    NextToken: undefined,
    QueryErrors: [],
  };
};

const ListGroupingStatuses: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  requireGroup(ctx, name);
  return {
    Group: stringOrUndefined(input["Group"]) ?? name,
    GroupingStatuses: [],
    NextToken: undefined,
  };
};

const SearchResources: OperationHandler = () => {
  return {
    ResourceIdentifiers: [],
    NextToken: undefined,
    QueryErrors: [],
  };
};

const GetTags: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const name = nameFromArn(arn);
  const group = requireGroup(ctx, name);
  return { Arn: arn, Tags: group.Tags };
};

const Tag: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const name = nameFromArn(arn);
  const existing = requireGroup(ctx, name);
  const newTags = stringMapFrom(input["Tags"]);
  const group: StoredGroup = {
    ...existing,
    Tags: { ...existing.Tags, ...newTags },
  };
  ctx.store.set(groupKey(name), group);
  return { Arn: arn, Tags: group.Tags };
};

const Untag: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const name = nameFromArn(arn);
  const existing = requireGroup(ctx, name);
  const keys = Array.isArray(input["Keys"])
    ? (input["Keys"] as string[]).filter(
        (k): k is string => typeof k === "string",
      )
    : [];
  const keysToRemove = new Set(keys);
  const tags = { ...existing.Tags };
  for (const k of keysToRemove) delete tags[k];
  const group: StoredGroup = { ...existing, Tags: tags };
  ctx.store.set(groupKey(name), group);
  return { Arn: arn, Keys: keys };
};

const GetAccountSettings: OperationHandler = (_input, ctx) => {
  const settings = ctx.store.get<StoredAccountSettings>(accountKey) ?? {
    GroupLifecycleEventsDesiredStatus: undefined,
  };
  return {
    AccountSettings: {
      GroupLifecycleEventsDesiredStatus:
        settings.GroupLifecycleEventsDesiredStatus,
      GroupLifecycleEventsStatus: "INACTIVE",
      GroupLifecycleEventsStatusMessage: undefined,
    },
  };
};

const UpdateAccountSettings: OperationHandler = (input, ctx) => {
  const current = ctx.store.get<StoredAccountSettings>(accountKey) ?? {
    GroupLifecycleEventsDesiredStatus: undefined,
  };
  const settings: StoredAccountSettings = {
    GroupLifecycleEventsDesiredStatus:
      stringOrUndefined(input["GroupLifecycleEventsDesiredStatus"]) ??
      current.GroupLifecycleEventsDesiredStatus,
  };
  ctx.store.set(accountKey, settings);
  return {
    AccountSettings: {
      GroupLifecycleEventsDesiredStatus:
        settings.GroupLifecycleEventsDesiredStatus,
      GroupLifecycleEventsStatus: "INACTIVE",
      GroupLifecycleEventsStatusMessage: undefined,
    },
  };
};

const StartTagSyncTask: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  const group = requireGroup(ctx, name);
  const roleArn = requireString(input, "RoleArn");
  const id = crypto.randomUUID();
  const arn = taskArnOf(ctx, id);
  const task: StoredTagSyncTask = {
    TaskArn: arn,
    GroupArn: group.GroupArn,
    GroupName: group.Name,
    TagKey: stringOrUndefined(input["TagKey"]),
    TagValue: stringOrUndefined(input["TagValue"]),
    ResourceQuery: asRecord(input["ResourceQuery"]),
    RoleArn: roleArn,
    Status: "ACTIVE",
    ErrorMessage: undefined,
    CreatedAt: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(taskKey(arn), task);
  return {
    GroupArn: task.GroupArn,
    GroupName: task.GroupName,
    TaskArn: task.TaskArn,
    TagKey: task.TagKey,
    TagValue: task.TagValue,
    ResourceQuery: task.ResourceQuery,
    RoleArn: task.RoleArn,
  };
};

const GetTagSyncTask: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TaskArn");
  const task = requireTask(ctx, arn);
  return taskView(task);
};

const ListTagSyncTasks: OperationHandler = (_input, ctx) => {
  const tasks = ctx.store
    .list<StoredTagSyncTask>()
    .filter((entry) => entry.key.startsWith(taskPrefix))
    .map((entry) => taskView(entry.value));
  return { TagSyncTasks: tasks, NextToken: undefined };
};

const CancelTagSyncTask: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TaskArn");
  const existing = requireTask(ctx, arn);
  const task: StoredTagSyncTask = { ...existing, Status: "CANCELLED" };
  ctx.store.set(taskKey(arn), task);
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const resourcegroups = {
  name: "resource-groups",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (req.method === "POST") {
      if (parts.length === 1) {
        if (parts[0] === "groups") return "CreateGroup";
        if (parts[0] === "get-group") return "GetGroup";
        if (parts[0] === "groups-list") return "ListGroups";
        if (parts[0] === "update-group") return "UpdateGroup";
        if (parts[0] === "delete-group") return "DeleteGroup";
        if (parts[0] === "get-group-query") return "GetGroupQuery";
        if (parts[0] === "update-group-query") return "UpdateGroupQuery";
        if (parts[0] === "get-group-configuration")
          return "GetGroupConfiguration";
        if (parts[0] === "put-group-configuration")
          return "PutGroupConfiguration";
        if (parts[0] === "group-resources") return "GroupResources";
        if (parts[0] === "ungroup-resources") return "UngroupResources";
        if (parts[0] === "list-group-resources") return "ListGroupResources";
        if (parts[0] === "list-grouping-statuses")
          return "ListGroupingStatuses";
        if (parts[0] === "get-account-settings") return "GetAccountSettings";
        if (parts[0] === "update-account-settings")
          return "UpdateAccountSettings";
        if (parts[0] === "start-tag-sync-task") return "StartTagSyncTask";
        if (parts[0] === "get-tag-sync-task") return "GetTagSyncTask";
        if (parts[0] === "list-tag-sync-tasks") return "ListTagSyncTasks";
        if (parts[0] === "cancel-tag-sync-task") return "CancelTagSyncTask";
      }
      if (
        parts.length === 2 &&
        parts[0] === "resources" &&
        parts[1] === "search"
      )
        return "SearchResources";
      return undefined;
    }
    if (parts.length === 3 && parts[0] === "resources" && parts[2] === "tags") {
      if (req.method === "GET") return "GetTags";
      if (req.method === "PUT") return "Tag";
      if (req.method === "PATCH") return "Untag";
    }
    return undefined;
  },
  operations: {
    CreateGroup,
    GetGroup,
    ListGroups,
    UpdateGroup,
    DeleteGroup,
    GetGroupQuery,
    UpdateGroupQuery,
    GetGroupConfiguration,
    PutGroupConfiguration,
    GroupResources,
    UngroupResources,
    ListGroupResources,
    ListGroupingStatuses,
    SearchResources,
    GetTags,
    Tag,
    Untag,
    GetAccountSettings,
    UpdateAccountSettings,
    StartTagSyncTask,
    GetTagSyncTask,
    ListTagSyncTasks,
    CancelTagSyncTask,
  },
  model,
} as const satisfies ServiceDefinition;

export default resourcegroups;
