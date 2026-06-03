import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import mediatailorModel from "../../../../test/vendor/aws-models/mediatailor.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(mediatailorModel);

const configurationPrefix = "config:" as const;

type StoredConfiguration = {
  AdDecisionServerUrl: string | undefined;
  Name: string;
  PersonalizationThresholdSeconds: number | undefined;
  PlaybackConfigurationArn: string;
  PlaybackEndpointPrefix: string;
  SessionInitializationEndpointPrefix: string;
  SlateAdUrl: string | undefined;
  Tags: Record<string, unknown> | undefined;
  TranscodeProfileName: string | undefined;
  VideoContentSourceUrl: string | undefined;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

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

const configurationKey = (name: string): string =>
  `${configurationPrefix}${name}`;

const configurationArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:mediatailor:${ctx.region}:${ctx.account}:playbackConfiguration/${name}`;

const configurationView = (
  configuration: StoredConfiguration,
): Record<string, unknown> => ({
  AdDecisionServerUrl: configuration.AdDecisionServerUrl,
  Name: configuration.Name,
  PersonalizationThresholdSeconds:
    configuration.PersonalizationThresholdSeconds,
  PlaybackConfigurationArn: configuration.PlaybackConfigurationArn,
  PlaybackEndpointPrefix: configuration.PlaybackEndpointPrefix,
  SessionInitializationEndpointPrefix:
    configuration.SessionInitializationEndpointPrefix,
  SlateAdUrl: configuration.SlateAdUrl,
  Tags: configuration.Tags,
  TranscodeProfileName: configuration.TranscodeProfileName,
  VideoContentSourceUrl: configuration.VideoContentSourceUrl,
});

const requireConfiguration = (
  ctx: ServiceContext,
  name: string,
): StoredConfiguration => {
  const stored = ctx.store.get<StoredConfiguration>(configurationKey(name));
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `Playback configuration not found for name ${name}.`,
      400,
    );
  }
  return stored;
};

const PutPlaybackConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const configuration: StoredConfiguration = {
    AdDecisionServerUrl: stringOrUndefined(input["AdDecisionServerUrl"]),
    Name: name,
    PersonalizationThresholdSeconds: numberOrUndefined(
      input["PersonalizationThresholdSeconds"],
    ),
    PlaybackConfigurationArn: configurationArn(ctx, name),
    PlaybackEndpointPrefix: `https://${name}.playback.mediatailor.${ctx.region}.amazonaws.com/`,
    SessionInitializationEndpointPrefix: `https://${name}.playback.mediatailor.${ctx.region}.amazonaws.com/v1/session/`,
    SlateAdUrl: stringOrUndefined(input["SlateAdUrl"]),
    Tags: recordOrUndefined(input["Tags"]),
    TranscodeProfileName: stringOrUndefined(input["TranscodeProfileName"]),
    VideoContentSourceUrl: stringOrUndefined(input["VideoContentSourceUrl"]),
  };
  ctx.store.set(configurationKey(name), configuration);
  return configurationView(configuration);
};

const GetPlaybackConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  return configurationView(requireConfiguration(ctx, name));
};

const ListPlaybackConfigurations: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const configurations = ctx.store
    .list<StoredConfiguration>()
    .filter((entry) => entry.key.startsWith(configurationPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0));
  return { Items: configurations.slice(0, max).map(configurationView) };
};

const DeletePlaybackConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  requireConfiguration(ctx, name);
  ctx.store.delete(configurationKey(name));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const mediatailor = {
  name: "mediatailor",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] === "playbackConfigurations" && parts.length === 1) {
      if (req.method === "GET") return "ListPlaybackConfigurations";
      return undefined;
    }
    if (parts[0] === "playbackConfiguration") {
      if (parts.length === 1) {
        if (req.method === "PUT") return "PutPlaybackConfiguration";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetPlaybackConfiguration";
        if (req.method === "DELETE") return "DeletePlaybackConfiguration";
        return undefined;
      }
    }
    return undefined;
  },
  operations: {
    PutPlaybackConfiguration,
    GetPlaybackConfiguration,
    ListPlaybackConfigurations,
    DeletePlaybackConfiguration,
  },
  model,
} as const satisfies ServiceDefinition;

export default mediatailor;
