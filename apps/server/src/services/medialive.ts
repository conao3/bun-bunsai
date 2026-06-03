import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import medialiveModel from "../../../../test/vendor/aws-models/medialive.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(medialiveModel);

const channelPrefix = "channel:" as const;

type StoredChannel = {
  Id: string;
  Arn: string;
  Name: string;
  State: string;
  ChannelClass: string;
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
    throw awsError("BadRequestException", `${field} is required.`, 400);
  }
  return value;
};

const channelKey = (id: string): string => `${channelPrefix}${id}`;

const channelArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:channel:${id}`;

const requireChannel = (ctx: ServiceContext, id: string): StoredChannel => {
  const stored = ctx.store.get<StoredChannel>(channelKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Channel ${id} not found.`, 404);
  }
  return stored;
};

const nextChannelId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredChannel>()
    .filter((entry) => entry.key.startsWith(channelPrefix)).length;
  return String(1000000 + used + 1);
};

const CreateChannel: OperationHandler = (input, ctx) => {
  const id = nextChannelId(ctx);
  const channel: StoredChannel = {
    Id: id,
    Arn: channelArn(ctx, id),
    Name: stringOrUndefined(input["Name"]) ?? "",
    State: "IDLE",
    ChannelClass: stringOrUndefined(input["ChannelClass"]) ?? "STANDARD",
    Tags: recordOrEmpty(input["Tags"]),
  };
  ctx.store.set(channelKey(id), channel);
  return { Channel: channel };
};

const DescribeChannel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ChannelId");
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
  const id = requireString(input, "ChannelId");
  const channel = requireChannel(ctx, id);
  ctx.store.delete(channelKey(id));
  return { ...channel, State: "DELETING" };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const medialive = {
  name: "medialive",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "prod" || parts[1] !== "channels") return undefined;
    if (parts.length === 2) {
      if (req.method === "POST") return "CreateChannel";
      if (req.method === "GET") return "ListChannels";
      return undefined;
    }
    if (parts.length === 3) {
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

export default medialive;
