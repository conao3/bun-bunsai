import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import pinpointModel from "../../../../test/vendor/aws-models/pinpoint.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(pinpointModel);

const appPrefix = "app:" as const;

type StoredApp = {
  Id: string;
  Arn: string;
  Name: string;
  tags: Record<string, string>;
  CreationDate: string;
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
    throw awsError("BadRequestException", `${field} is required.`, 400);
  }
  return value;
};

const appKey = (id: string): string => `${appPrefix}${id}`;

const appArnOf = (ctx: ServiceContext, id: string): string =>
  `arn:aws:mobiletargeting:${ctx.region}:${ctx.account}:apps/${id}`;

const appView = (app: StoredApp): Record<string, unknown> => ({
  Id: app.Id,
  Arn: app.Arn,
  Name: app.Name,
  tags: app.tags,
  CreationDate: app.CreationDate,
});

const requireApp = (ctx: ServiceContext, id: string): StoredApp => {
  const stored = ctx.store.get<StoredApp>(appKey(id));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Application not found with id: ${id}.`,
      404,
    );
  }
  return stored;
};

const CreateApp: OperationHandler = (input, ctx) => {
  const request = asRecord(input["CreateApplicationRequest"]) ?? {};
  const name = requireString(request, "Name");
  const id = crypto.randomUUID().replace(/-/g, "");
  const app: StoredApp = {
    Id: id,
    Arn: appArnOf(ctx, id),
    Name: name,
    tags: stringMapFrom(request["tags"]),
    CreationDate: new Date().toISOString(),
  };
  ctx.store.set(appKey(id), app);
  return { ApplicationResponse: appView(app) };
};

const GetApp: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ApplicationId");
  const app = requireApp(ctx, id);
  return { ApplicationResponse: appView(app) };
};

const GetApps: OperationHandler = (_input, ctx) => {
  const apps = ctx.store
    .list<StoredApp>()
    .filter((entry) => entry.key.startsWith(appPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  return { ApplicationsResponse: { Item: apps.map(appView) } };
};

const DeleteApp: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ApplicationId");
  const app = requireApp(ctx, id);
  ctx.store.delete(appKey(id));
  return { ApplicationResponse: appView(app) };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const pinpoint = {
  name: "mobiletargeting",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "v1" || parts[1] !== "apps") return undefined;
    if (parts.length === 2) {
      if (req.method === "POST") return "CreateApp";
      if (req.method === "GET") return "GetApps";
      return undefined;
    }
    if (parts.length === 3) {
      if (req.method === "GET") return "GetApp";
      if (req.method === "DELETE") return "DeleteApp";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateApp,
    GetApp,
    GetApps,
    DeleteApp,
  },
  model,
} as const satisfies ServiceDefinition;

export default pinpoint;
