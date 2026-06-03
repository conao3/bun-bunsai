import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import greengrassModel from "../../../../test/vendor/aws-models/greengrass.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(greengrassModel);

const groupPrefix = "group:" as const;

type StoredGroup = {
  id: string;
  arn: string;
  name: string;
  creationTimestamp: string;
  lastUpdatedTimestamp: string;
  latestVersion: string;
  latestVersionArn: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

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

const groupKey = (id: string): string => `${groupPrefix}${id}`;

const groupArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:greengrass:${ctx.region}:${ctx.account}:/greengrass/groups/${id}`;

const randomId = (): string =>
  Array.from({ length: 36 }, (_, i) =>
    i === 8 || i === 13 || i === 18 || i === 23
      ? "-"
      : "0123456789abcdef".charAt(Math.floor(Math.random() * 16)),
  ).join("");

const groupView = (group: StoredGroup): Record<string, unknown> => ({
  Id: group.id,
  Arn: group.arn,
  Name: group.name,
  CreationTimestamp: group.creationTimestamp,
  LastUpdatedTimestamp: group.lastUpdatedTimestamp,
  LatestVersion: group.latestVersion,
  LatestVersionArn: group.latestVersionArn,
});

const requireGroup = (ctx: ServiceContext, id: string): StoredGroup => {
  const group = ctx.store.get<StoredGroup>(groupKey(id));
  if (group === undefined) {
    throw awsError("BadRequestException", `Group ${id} not found.`, 400);
  }
  return group;
};

const CreateGroup: OperationHandler = (input, ctx) => {
  const id = randomId();
  const now = new Date().toISOString();
  const versionId = randomId();
  const group: StoredGroup = {
    id,
    arn: groupArn(ctx, id),
    name: requireString(input, "Name"),
    creationTimestamp: now,
    lastUpdatedTimestamp: now,
    latestVersion: versionId,
    latestVersionArn: `${groupArn(ctx, id)}/versions/${versionId}`,
  };
  ctx.store.set(groupKey(id), group);
  return groupView(group);
};

const GetGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GroupId");
  return groupView(requireGroup(ctx, id));
};

const ListGroups: OperationHandler = (_input, ctx) => {
  const groups = ctx.store
    .list<StoredGroup>()
    .filter((entry) => entry.key.startsWith(groupPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { Groups: groups.map(groupView) };
};

const DeleteGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GroupId");
  requireGroup(ctx, id);
  ctx.store.delete(groupKey(id));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const greengrass = {
  name: "greengrass",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "greengrass" || parts[1] !== "groups") return undefined;
    if (parts.length === 2) {
      if (req.method === "POST") return "CreateGroup";
      if (req.method === "GET") return "ListGroups";
      return undefined;
    }
    if (parts.length === 3) {
      if (req.method === "GET") return "GetGroup";
      if (req.method === "DELETE") return "DeleteGroup";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateGroup,
    GetGroup,
    ListGroups,
    DeleteGroup,
  },
  model,
} as const satisfies ServiceDefinition;

export default greengrass;
