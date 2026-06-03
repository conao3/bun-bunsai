import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import mediapackageModel from "../../../../test/vendor/aws-models/mediapackage.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(mediapackageModel);

const channelPrefix = "channel:" as const;

type StoredChannel = {
  Id: string;
  Arn: string;
  Description: string;
  CreatedAt: string;
  Tags: Record<string, unknown>;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 422);
  }
  return value;
};

const channelKey = (id: string): string => `${channelPrefix}${id}`;

const channelArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:mediapackage:${ctx.region}:${ctx.account}:channels/${id}`;

const requireChannel = (ctx: ServiceContext, id: string): StoredChannel => {
  const stored = ctx.store.get<StoredChannel>(channelKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Channel not found for ID ${id}.`, 404);
  }
  return stored;
};

const CreateChannel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  if (ctx.store.get<StoredChannel>(channelKey(id)) !== undefined) {
    throw awsError(
      "UnprocessableEntityException",
      `Channel ${id} exists.`,
      422,
    );
  }
  const channel: StoredChannel = {
    Id: id,
    Arn: channelArn(ctx, id),
    Description: stringOrUndefined(input["Description"]) ?? "",
    CreatedAt: new Date().toISOString(),
    Tags: recordOrEmpty(input["Tags"]),
  };
  ctx.store.set(channelKey(id), channel);
  return channel;
};

const DescribeChannel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  return requireChannel(ctx, id);
};

const ListChannels: OperationHandler = (_input, ctx) => {
  const channels = ctx.store
    .list<StoredChannel>()
    .filter((entry) => entry.key.startsWith(channelPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Id < b.Id ? -1 : a.Id > b.Id ? 1 : 0));
  return { Channels: channels };
};

const DeleteChannel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  requireChannel(ctx, id);
  ctx.store.delete(channelKey(id));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const mediapackage = {
  name: "mediapackage",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "channels") return undefined;
    if (parts.length === 1) {
      if (req.method === "POST") return "CreateChannel";
      if (req.method === "GET") return "ListChannels";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "GET") return "DescribeChannel";
      if (req.method === "DELETE") return "DeleteChannel";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateChannel,
    DescribeChannel,
    ListChannels,
    DeleteChannel,
  },
  model,
} as const satisfies ServiceDefinition;

export default mediapackage;
