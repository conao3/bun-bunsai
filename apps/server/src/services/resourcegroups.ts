import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/resourcegroups.json", { with: { type: "json" } }),
);

const groupPrefix = "group:" as const;
const taskPrefix = "task:" as const;
const accountKey = "account-settings" as const;

type StoredGroupingStatusItem = {
  ResourceArn: string;
  Action: "GROUP" | "UNGROUP";
  Status: "SUCCESS" | "FAILED" | "IN_PROGRESS" | "SKIPPED";
  ErrorMessage: string | undefined;
  ErrorCode: string | undefined;
  UpdatedAt: number;
};

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
  GroupConfigurationStatus: string;
  ResourceArns: string[];
  GroupingStatuses: StoredGroupingStatusItem[];
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

const requireLocalGroupArn = (arn: string, ctx: ServiceContext): string => {
  const prefix = `arn:aws:resource-groups:${ctx.region}:${ctx.account}:group/`;
  if (!arn.startsWith(prefix) || arn.length === prefix.length) {
    throw awsError(
      "BadRequestException",
      `ARN ${arn} does not identify a resource in this account and region.`,
      400,
    );
  }
  return arn.slice(prefix.length);
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

const paginate = <T>(
  items: T[],
  max: number,
  rawToken: unknown,
): { page: T[]; nextToken: string | undefined } => {
  let offset = 0;
  if (typeof rawToken === "string" && rawToken !== "") {
    let decoded: string;
    try {
      decoded = atob(rawToken);
    } catch {
      throw awsError(
        "InvalidNextTokenException",
        "The specified nextToken is not valid.",
        400,
      );
    }
    const parsed = parseInt(decoded, 10);
    if (isNaN(parsed) || parsed < 0 || String(parsed) !== decoded) {
      throw awsError(
        "InvalidNextTokenException",
        "The specified nextToken is not valid.",
        400,
      );
    }
    offset = parsed;
  }
  const page = items.slice(offset, offset + max);
  const nextToken =
    offset + max < items.length ? btoa(String(offset + max)) : undefined;
  return { page, nextToken };
};

const filterValues = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
};

const asFilterList = (
  raw: unknown,
): Array<{ Name: string; Values: string[] }> => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is Record<string, unknown> => asRecord(item) !== undefined,
    )
    .map((item) => ({
      Name: stringOrUndefined(item["Name"]) ?? "",
      Values: filterValues(item["Values"]),
    }))
    .filter((f) => f.Name !== "");
};

const groupMatchesFilters = (
  group: StoredGroup,
  filters: Array<{ Name: string; Values: string[] }>,
): boolean => {
  for (const filter of filters) {
    if (filter.Values.length === 0) continue;
    if (filter.Name === "owner") {
      if (!filter.Values.some((v) => group.Owner === v)) return false;
    } else if (filter.Name === "display-name") {
      if (!filter.Values.some((v) => group.DisplayName === v)) return false;
    } else if (filter.Name === "criticality") {
      if (!filter.Values.some((v) => String(group.Criticality ?? "") === v))
        return false;
    } else if (filter.Name === "resource-type") {
      const rq = group.ResourceQuery;
      if (rq === undefined) return false;
      const queryStr = stringOrUndefined(rq["Query"]);
      if (queryStr === undefined) return false;
      let parsed: unknown;
      try {
        parsed = JSON.parse(queryStr);
      } catch {
        return false;
      }
      const parsedRec = asRecord(parsed);
      if (parsedRec === undefined) return false;
      const typeFilters = filterValues(parsedRec["ResourceTypeFilters"]);
      if (
        !typeFilters.includes("AWS::AllSupported") &&
        !filter.Values.some((v) => typeFilters.includes(v))
      )
        return false;
    } else if (filter.Name === "configuration-type") {
      const cfg = group.GroupConfiguration;
      if (cfg === undefined) return false;
      const cfgItems = Array.isArray(cfg["Configuration"])
        ? (cfg["Configuration"] as unknown[])
        : [];
      const cfgTypes = cfgItems
        .map((item) => asRecord(item))
        .filter((r): r is Record<string, unknown> => r !== undefined)
        .map((r) => stringOrUndefined(r["Type"]))
        .filter((t): t is string => t !== undefined);
      if (!filter.Values.some((v) => cfgTypes.includes(v))) return false;
    }
  }
  return true;
};

const CreateGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (/^aws/i.test(name)) {
    throw awsError(
      "ValidationException",
      "Group names beginning with aws are reserved.",
      400,
    );
  }
  const hasQuery = asRecord(input["ResourceQuery"]) !== undefined;
  const hasCfg =
    Array.isArray(input["Configuration"]) &&
    (input["Configuration"] as unknown[]).length > 0;
  if (hasQuery && hasCfg) {
    throw awsError(
      "BadRequestException",
      "ResourceQuery and Configuration are mutually exclusive.",
      400,
    );
  }
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
    GroupConfigurationStatus: "UPDATE_COMPLETE",
    ResourceArns: [],
    GroupingStatuses: [],
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
  const filters = asFilterList(input["Filters"]);
  const allGroups = ctx.store
    .list<StoredGroup>()
    .filter((entry) => entry.key.startsWith(groupPrefix))
    .map((entry) => entry.value)
    .filter((group) => groupMatchesFilters(group, filters))
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0));
  const { page: groups, nextToken } = paginate(
    allGroups,
    max,
    input["NextToken"],
  );
  return {
    GroupIdentifiers: groups.map((group) => ({
      GroupName: group.Name,
      GroupArn: group.GroupArn,
    })),
    Groups: groups.map(groupView),
    NextToken: nextToken,
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
  const taskEntries = ctx.store
    .list<StoredTagSyncTask>()
    .filter(
      (entry) =>
        entry.key.startsWith(taskPrefix) &&
        entry.value.GroupArn === group.GroupArn,
    );
  for (const entry of taskEntries) ctx.store.delete(entry.key);
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
      Status: group.GroupConfigurationStatus,
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
    GroupConfigurationStatus: "UPDATE_COMPLETE",
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
  const now = Math.floor(Date.now() / 1000);
  const newStatuses: StoredGroupingStatusItem[] = arns.map((arn) => ({
    ResourceArn: arn,
    Action: "GROUP" as const,
    Status: "SUCCESS" as const,
    ErrorMessage: undefined,
    ErrorCode: undefined,
    UpdatedAt: now,
  }));
  for (const arn of arns) current.add(arn);
  const group: StoredGroup = {
    ...existing,
    ResourceArns: Array.from(current),
    GroupingStatuses: [...existing.GroupingStatuses, ...newStatuses],
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
  const now = Math.floor(Date.now() / 1000);
  const newStatuses: StoredGroupingStatusItem[] = arns.map((arn) => ({
    ResourceArn: arn,
    Action: "UNGROUP" as const,
    Status: "SUCCESS" as const,
    ErrorMessage: undefined,
    ErrorCode: undefined,
    UpdatedAt: now,
  }));
  const group: StoredGroup = {
    ...existing,
    ResourceArns: existing.ResourceArns.filter((a) => !toRemove.has(a)),
    GroupingStatuses: [...existing.GroupingStatuses, ...newStatuses],
  };
  ctx.store.set(groupKey(name), group);
  return { Succeeded: arns, Failed: [], Pending: [] };
};

const ListGroupResources: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  const group = requireGroup(ctx, name);
  const max =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 50;
  const typeFilters = asFilterList(input["Filters"])
    .filter((f) => f.Name === "resource-type")
    .flatMap((f) => f.Values);
  const filtered =
    typeFilters.length === 0
      ? group.ResourceArns
      : group.ResourceArns.filter((arn) => {
          const parts = arn.split(":");
          if (parts.length < 6) return true;
          const svc = parts[2] ?? "";
          const resourcePart = parts[5] ?? "";
          const slash = resourcePart.indexOf("/");
          const resourceType =
            slash === -1 ? resourcePart : resourcePart.slice(0, slash);
          const awsType = `AWS::${svc.charAt(0).toUpperCase()}${svc.slice(1)}::${resourceType.charAt(0).toUpperCase()}${resourceType.slice(1)}`;
          return typeFilters.some(
            (t) => t === "AWS::AllSupported" || t === awsType,
          );
        });
  const { page: pageArns, nextToken } = paginate(
    filtered,
    max,
    input["NextToken"],
  );
  const identifiers = pageArns.map((arn) => ({
    ResourceArn: arn,
    ResourceType: undefined,
  }));
  const resources = pageArns.map((arn) => ({
    Identifier: { ResourceArn: arn, ResourceType: undefined },
    Status: undefined,
  }));
  return {
    Resources: resources,
    ResourceIdentifiers: identifiers,
    NextToken: nextToken,
    QueryErrors: [],
  };
};

const ListGroupingStatuses: OperationHandler = (input, ctx) => {
  const name = groupNameOf(input);
  const group = requireGroup(ctx, name);
  const max =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 50;
  const filters = asFilterList(input["Filters"]);
  const filtered = group.GroupingStatuses.filter((item) => {
    for (const filter of filters) {
      if (filter.Values.length === 0) continue;
      if (filter.Name === "status") {
        if (!filter.Values.includes(item.Status)) return false;
      } else if (filter.Name === "resource-arn") {
        if (!filter.Values.includes(item.ResourceArn)) return false;
      }
    }
    return true;
  });
  const { page, nextToken } = paginate(filtered, max, input["NextToken"]);
  return {
    Group: stringOrUndefined(input["Group"]) ?? name,
    GroupingStatuses: page.map((item) => ({
      ResourceArn: item.ResourceArn,
      Action: item.Action,
      Status: item.Status,
      ErrorMessage: item.ErrorMessage,
      ErrorCode: item.ErrorCode,
      UpdatedAt: item.UpdatedAt,
    })),
    NextToken: nextToken,
  };
};

const SearchResources: OperationHandler = (input, ctx) => {
  const rq = asRecord(input["ResourceQuery"]);
  const max =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 50;
  const allArns = Array.from(
    new Set(
      ctx.store
        .list<StoredGroup>()
        .filter((entry) => entry.key.startsWith(groupPrefix))
        .flatMap((entry) => entry.value.ResourceArns),
    ),
  ).sort();
  let candidates = allArns;
  if (rq !== undefined) {
    const queryType = stringOrUndefined(rq["Type"]);
    const queryStr = stringOrUndefined(rq["Query"]);
    if (queryType === "TAG_FILTERS_1_0" && queryStr !== undefined) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(queryStr);
      } catch {
        parsed = undefined;
      }
      const parsedRec = asRecord(parsed);
      if (parsedRec !== undefined) {
        const typeFilters = filterValues(parsedRec["ResourceTypeFilters"]);
        if (
          typeFilters.length > 0 &&
          !typeFilters.includes("AWS::AllSupported")
        ) {
          candidates = candidates.filter((arn) => {
            const parts = arn.split(":");
            if (parts.length < 6) return true;
            const svc = parts[2] ?? "";
            const resourcePart = parts[5] ?? "";
            const slash = resourcePart.indexOf("/");
            const resourceType =
              slash === -1 ? resourcePart : resourcePart.slice(0, slash);
            const awsType = `AWS::${svc.charAt(0).toUpperCase()}${svc.slice(1)}::${resourceType.charAt(0).toUpperCase()}${resourceType.slice(1)}`;
            return typeFilters.includes(awsType);
          });
        }
      }
    }
  }
  const { page, nextToken } = paginate(candidates, max, input["NextToken"]);
  return {
    ResourceIdentifiers: page.map((arn) => ({
      ResourceArn: arn,
      ResourceType: undefined,
    })),
    NextToken: nextToken,
    QueryErrors: [],
  };
};

const GetTags: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const name = requireLocalGroupArn(arn, ctx);
  const group = requireGroup(ctx, name);
  return { Arn: arn, Tags: group.Tags };
};

const Tag: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const name = requireLocalGroupArn(arn, ctx);
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
  const name = requireLocalGroupArn(arn, ctx);
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

const ListTagSyncTasks: OperationHandler = (input, ctx) => {
  const max =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 50;
  const rawFilters = Array.isArray(input["Filters"]) ? input["Filters"] : [];
  const groupFilters = rawFilters
    .filter((f): f is Record<string, unknown> => asRecord(f) !== undefined)
    .map((f) => ({
      GroupArn: stringOrUndefined(f["GroupArn"]),
      GroupName: stringOrUndefined(f["GroupName"]),
    }))
    .filter((f) => f.GroupArn !== undefined || f.GroupName !== undefined);

  const allTasks = ctx.store
    .list<StoredTagSyncTask>()
    .filter((entry) => entry.key.startsWith(taskPrefix))
    .map((entry) => entry.value)
    .filter((task) => {
      if (groupFilters.length === 0) return true;
      return groupFilters.some(
        (f) =>
          (f.GroupArn !== undefined && task.GroupArn === f.GroupArn) ||
          (f.GroupName !== undefined && task.GroupName === f.GroupName),
      );
    });

  const { page, nextToken } = paginate(allTasks, max, input["NextToken"]);
  return { TagSyncTasks: page.map(taskView), NextToken: nextToken };
};

const CancelTagSyncTask: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TaskArn");
  const existing = requireTask(ctx, arn);
  if (existing.Status === "CANCELLED") {
    throw awsError(
      "ValidationException",
      `Tag sync task ${arn} is already CANCELLED.`,
      400,
    );
  }
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
