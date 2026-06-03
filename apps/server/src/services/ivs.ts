import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ivsModel from "../../../../test/vendor/aws-models/ivs.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(ivsModel);

const channelPrefix = "channel:" as const;

type StoredChannel = {
  arn: string;
  name: string;
  latencyMode: string;
  type: string;
  recordingConfigurationArn: string;
  ingestEndpoint: string;
  playbackUrl: string;
  authorized: boolean;
  tags: Record<string, unknown>;
  insecureIngest: boolean;
  preset: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const booleanOrFalse = (value: unknown): boolean =>
  typeof value === "boolean" ? value : false;

const tagsOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

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

const newId = (): string =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 12);

const channelArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:ivs:${ctx.region}:${ctx.account}:channel/${id}`;

const channelKey = (arn: string): string => `${channelPrefix}${arn}`;

const requireChannel = (ctx: ServiceContext, arn: string): StoredChannel => {
  const stored = ctx.store.get<StoredChannel>(channelKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Channel not found for ARN ${arn}.`,
      404,
    );
  }
  return stored;
};

const channelView = (channel: StoredChannel): Record<string, unknown> => ({
  arn: channel.arn,
  name: channel.name,
  latencyMode: channel.latencyMode,
  type: channel.type,
  recordingConfigurationArn: channel.recordingConfigurationArn,
  ingestEndpoint: channel.ingestEndpoint,
  playbackUrl: channel.playbackUrl,
  authorized: channel.authorized,
  tags: channel.tags,
  insecureIngest: channel.insecureIngest,
  preset: channel.preset,
});

const channelSummaryView = (
  channel: StoredChannel,
): Record<string, unknown> => ({
  arn: channel.arn,
  name: channel.name,
  latencyMode: channel.latencyMode,
  authorized: channel.authorized,
  recordingConfigurationArn: channel.recordingConfigurationArn,
  tags: channel.tags,
  insecureIngest: channel.insecureIngest,
  type: channel.type,
  preset: channel.preset,
});

const CreateChannel: OperationHandler = (input, ctx) => {
  const id = newId();
  const arn = channelArn(ctx, id);
  const name = stringOrUndefined(input["name"]) ?? `channel-${id}`;
  const channel: StoredChannel = {
    arn,
    name,
    latencyMode: stringOrUndefined(input["latencyMode"]) ?? "LOW",
    type: stringOrUndefined(input["type"]) ?? "STANDARD",
    recordingConfigurationArn:
      stringOrUndefined(input["recordingConfigurationArn"]) ?? "",
    ingestEndpoint: `${id}.global-contribute.live-video.net`,
    playbackUrl: `https://${id}.${ctx.region}.playback.live-video.net/api/video/v1/${arn}.m3u8`,
    authorized: booleanOrFalse(input["authorized"]),
    tags: tagsOrEmpty(input["tags"]),
    insecureIngest: booleanOrFalse(input["insecureIngest"]),
    preset: stringOrUndefined(input["preset"]) ?? "",
  };
  ctx.store.set(channelKey(arn), channel);
  return {
    channel: channelView(channel),
    streamKey: {
      arn: `arn:aws:ivs:${ctx.region}:${ctx.account}:stream-key/${id}`,
      value: `sk_${ctx.region}_${newId()}`,
      channelArn: arn,
      tags: {},
    },
  };
};

const GetChannel: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  return { channel: channelView(requireChannel(ctx, arn)) };
};

const ListChannels: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const filterByName = stringOrUndefined(input["filterByName"]);
  const channels = ctx.store
    .list<StoredChannel>()
    .filter((entry) => entry.key.startsWith(channelPrefix))
    .map((entry) => entry.value)
    .filter((channel) =>
      filterByName === undefined ? true : channel.name === filterByName,
    )
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { channels: channels.slice(0, max).map(channelSummaryView) };
};

const DeleteChannel: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  requireChannel(ctx, arn);
  ctx.store.delete(channelKey(arn));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const ivs = {
  name: "ivs",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts.length !== 1 || req.method !== "POST") return undefined;
    if (parts[0] === "CreateChannel") return "CreateChannel";
    if (parts[0] === "GetChannel") return "GetChannel";
    if (parts[0] === "ListChannels") return "ListChannels";
    if (parts[0] === "DeleteChannel") return "DeleteChannel";
    return undefined;
  },
  operations: {
    CreateChannel,
    GetChannel,
    ListChannels,
    DeleteChannel,
  },
  model,
} as const satisfies ServiceDefinition;

export default ivs;
