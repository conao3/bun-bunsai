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

const groupArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:resource-groups:${ctx.region}:${ctx.account}:group/${name}`;

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

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const resourcegroups = {
  name: "resource-groups",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (req.method !== "POST") return undefined;
    if (parts.length !== 1) return undefined;
    if (parts[0] === "groups") return "CreateGroup";
    if (parts[0] === "get-group") return "GetGroup";
    if (parts[0] === "groups-list") return "ListGroups";
    if (parts[0] === "update-group") return "UpdateGroup";
    if (parts[0] === "delete-group") return "DeleteGroup";
    return undefined;
  },
  operations: {
    CreateGroup,
    GetGroup,
    ListGroups,
    UpdateGroup,
    DeleteGroup,
  },
  model,
} as const satisfies ServiceDefinition;

export default resourcegroups;
