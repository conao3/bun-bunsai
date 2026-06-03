import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import outpostsModel from "../../../../test/vendor/aws-models/outposts.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(outpostsModel);

const outpostPrefix = "outpost:" as const;

type StoredOutpost = {
  OutpostId: string;
  OwnerId: string;
  OutpostArn: string;
  SiteId: string;
  Name: string;
  Description?: string;
  LifeCycleStatus: string;
  AvailabilityZone?: string;
  AvailabilityZoneId?: string;
  Tags: Record<string, string>;
  SupportedHardwareType?: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

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
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const outpostKey = (id: string): string => `${outpostPrefix}${id}`;

const newOutpostId = (): string =>
  `op-${Math.random().toString(16).slice(2, 19).padEnd(17, "0")}`;

const outpostArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:outposts:${ctx.region}:${ctx.account}:outpost/${id}`;

const outpostView = (outpost: StoredOutpost): Record<string, unknown> => ({
  OutpostId: outpost.OutpostId,
  OwnerId: outpost.OwnerId,
  OutpostArn: outpost.OutpostArn,
  SiteId: outpost.SiteId,
  Name: outpost.Name,
  Description: outpost.Description,
  LifeCycleStatus: outpost.LifeCycleStatus,
  AvailabilityZone: outpost.AvailabilityZone,
  AvailabilityZoneId: outpost.AvailabilityZoneId,
  Tags: outpost.Tags,
  SupportedHardwareType: outpost.SupportedHardwareType,
});

const CreateOutpost: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const siteId = requireString(input, "SiteId");
  const id = newOutpostId();
  const outpost: StoredOutpost = {
    OutpostId: id,
    OwnerId: ctx.account,
    OutpostArn: outpostArn(ctx, id),
    SiteId: siteId,
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    LifeCycleStatus: "ACTIVE",
    AvailabilityZone: stringOrUndefined(input["AvailabilityZone"]),
    AvailabilityZoneId: stringOrUndefined(input["AvailabilityZoneId"]),
    Tags: stringMapFrom(input["Tags"]),
    SupportedHardwareType: stringOrUndefined(input["SupportedHardwareType"]),
  };
  ctx.store.set(outpostKey(id), outpost);
  return { Outpost: outpostView(outpost) };
};

const GetOutpost: OperationHandler = (input, ctx) => {
  const id = requireString(input, "OutpostId");
  const outpost = ctx.store.get<StoredOutpost>(outpostKey(id));
  if (outpost === undefined) {
    throw awsError("NotFoundException", `Outpost ${id} not found.`, 404);
  }
  return { Outpost: outpostView(outpost) };
};

const ListOutposts: OperationHandler = (_input, ctx) => {
  const outposts = ctx.store
    .list<StoredOutpost>()
    .filter((entry) => entry.key.startsWith(outpostPrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.OutpostId < b.OutpostId ? -1 : a.OutpostId > b.OutpostId ? 1 : 0,
    );
  return { Outposts: outposts.map(outpostView) };
};

const DeleteOutpost: OperationHandler = (input, ctx) => {
  const id = requireString(input, "OutpostId");
  if (ctx.store.get<StoredOutpost>(outpostKey(id)) === undefined) {
    throw awsError("NotFoundException", `Outpost ${id} not found.`, 404);
  }
  ctx.store.delete(outpostKey(id));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const outposts = {
  name: "outposts",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "outposts") return undefined;
    if (parts.length === 1) {
      if (req.method === "POST") return "CreateOutpost";
      if (req.method === "GET") return "ListOutposts";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "GET") return "GetOutpost";
      if (req.method === "DELETE") return "DeleteOutpost";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateOutpost,
    GetOutpost,
    ListOutposts,
    DeleteOutpost,
  },
  model,
} as const satisfies ServiceDefinition;

export default outposts;
