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
const streamKeyPrefix = "streamKey:" as const;
const recConfigPrefix = "recConfig:" as const;
const playbackKeyPairPrefix = "playbackKeyPair:" as const;
const playbackRestrictionPolicyPrefix = "playbackRestrictionPolicy:" as const;
const adConfigPrefix = "adConfig:" as const;
const streamPrefix = "stream:" as const;
const streamSessionPrefix = "streamSession:" as const;
const tagsPrefix = "tags:" as const;

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
  playbackRestrictionPolicyArn: string;
  adConfigurationArn: string;
};

type StoredStreamKey = {
  arn: string;
  value: string;
  channelArn: string;
  tags: Record<string, unknown>;
};

type StoredRecordingConfiguration = {
  arn: string;
  name: string;
  destinationConfiguration: Record<string, unknown>;
  state: string;
  tags: Record<string, unknown>;
  thumbnailConfiguration: Record<string, unknown>;
  recordingReconnectWindowSeconds: number;
  renditionConfiguration: Record<string, unknown>;
};

type StoredPlaybackKeyPair = {
  arn: string;
  name: string;
  fingerprint: string;
  tags: Record<string, unknown>;
};

type StoredPlaybackRestrictionPolicy = {
  arn: string;
  allowedCountries: string[];
  allowedOrigins: string[];
  enableStrictOriginEnforcement: boolean;
  name: string;
  tags: Record<string, unknown>;
};

type StoredAdConfiguration = {
  arn: string;
  name: string;
  mediaTailorPlaybackConfigurations: Array<{
    playbackConfigurationArn: string;
  }>;
  tags: Record<string, unknown>;
};

type StoredStream = {
  channelArn: string;
  streamId: string;
  playbackUrl: string;
  startTime: string;
  state: string;
  health: string;
  viewerCount: number;
};

type StoredStreamSession = {
  streamId: string;
  startTime: string;
  endTime: string;
  channelArn: string;
  hasErrorEvent: boolean;
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

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

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

const encodeNextToken = (idx: number): string => btoa(String(idx));

const decodeNextToken = (token: string): number => {
  try {
    return parseInt(atob(token), 10);
  } catch {
    return 0;
  }
};

const channelArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:ivs:${ctx.region}:${ctx.account}:channel/${id}`;

const streamKeyArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:ivs:${ctx.region}:${ctx.account}:stream-key/${id}`;

const recConfigArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:ivs:${ctx.region}:${ctx.account}:recording-configuration/${id}`;

const playbackKeyPairArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:ivs:${ctx.region}:${ctx.account}:playback-key/${id}`;

const playbackRestrictionPolicyArn = (
  ctx: ServiceContext,
  id: string,
): string =>
  `arn:aws:ivs:${ctx.region}:${ctx.account}:playback-restriction-policy/${id}`;

const adConfigArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:ivs:${ctx.region}:${ctx.account}:ad-configuration/${id}`;

const channelKey = (arn: string): string => `${channelPrefix}${arn}`;
const streamKeyKey = (arn: string): string => `${streamKeyPrefix}${arn}`;
const recConfigKey = (arn: string): string => `${recConfigPrefix}${arn}`;
const playbackKeyPairKey = (arn: string): string =>
  `${playbackKeyPairPrefix}${arn}`;
const playbackRestrictionPolicyKey = (arn: string): string =>
  `${playbackRestrictionPolicyPrefix}${arn}`;
const adConfigKey = (arn: string): string => `${adConfigPrefix}${arn}`;
const streamKey = (channelArnVal: string): string =>
  `${streamPrefix}${channelArnVal}`;
const streamSessionKey = (channelArnVal: string, streamId: string): string =>
  `${streamSessionPrefix}${channelArnVal}:${streamId}`;
const tagsKey = (resourceArnVal: string): string =>
  `${tagsPrefix}${resourceArnVal}`;

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

const requireStreamKey = (
  ctx: ServiceContext,
  arn: string,
): StoredStreamKey => {
  const stored = ctx.store.get<StoredStreamKey>(streamKeyKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `StreamKey not found for ARN ${arn}.`,
      404,
    );
  }
  return stored;
};

const requireRecConfig = (
  ctx: ServiceContext,
  arn: string,
): StoredRecordingConfiguration => {
  const stored = ctx.store.get<StoredRecordingConfiguration>(recConfigKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `RecordingConfiguration not found for ARN ${arn}.`,
      404,
    );
  }
  return stored;
};

const requirePlaybackKeyPair = (
  ctx: ServiceContext,
  arn: string,
): StoredPlaybackKeyPair => {
  const stored = ctx.store.get<StoredPlaybackKeyPair>(playbackKeyPairKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `PlaybackKeyPair not found for ARN ${arn}.`,
      404,
    );
  }
  return stored;
};

const requirePlaybackRestrictionPolicy = (
  ctx: ServiceContext,
  arn: string,
): StoredPlaybackRestrictionPolicy => {
  const stored = ctx.store.get<StoredPlaybackRestrictionPolicy>(
    playbackRestrictionPolicyKey(arn),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `PlaybackRestrictionPolicy not found for ARN ${arn}.`,
      404,
    );
  }
  return stored;
};

const requireAdConfig = (
  ctx: ServiceContext,
  arn: string,
): StoredAdConfiguration => {
  const stored = ctx.store.get<StoredAdConfiguration>(adConfigKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `AdConfiguration not found for ARN ${arn}.`,
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
  playbackRestrictionPolicyArn: channel.playbackRestrictionPolicyArn,
  adConfigurationArn: channel.adConfigurationArn,
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

const streamKeyView = (sk: StoredStreamKey): Record<string, unknown> => ({
  arn: sk.arn,
  value: sk.value,
  channelArn: sk.channelArn,
  tags: sk.tags,
});

const streamKeySummaryView = (
  sk: StoredStreamKey,
): Record<string, unknown> => ({
  arn: sk.arn,
  channelArn: sk.channelArn,
  tags: sk.tags,
});

const recConfigView = (
  rc: StoredRecordingConfiguration,
): Record<string, unknown> => ({
  arn: rc.arn,
  name: rc.name,
  destinationConfiguration: rc.destinationConfiguration,
  state: rc.state,
  tags: rc.tags,
  thumbnailConfiguration: rc.thumbnailConfiguration,
  recordingReconnectWindowSeconds: rc.recordingReconnectWindowSeconds,
  renditionConfiguration: rc.renditionConfiguration,
});

const recConfigSummaryView = (
  rc: StoredRecordingConfiguration,
): Record<string, unknown> => ({
  arn: rc.arn,
  name: rc.name,
  destinationConfiguration: rc.destinationConfiguration,
  state: rc.state,
  tags: rc.tags,
});

const playbackKeyPairView = (
  kp: StoredPlaybackKeyPair,
): Record<string, unknown> => ({
  arn: kp.arn,
  name: kp.name,
  fingerprint: kp.fingerprint,
  tags: kp.tags,
});

const playbackKeyPairSummaryView = (
  kp: StoredPlaybackKeyPair,
): Record<string, unknown> => ({
  arn: kp.arn,
  name: kp.name,
  tags: kp.tags,
});

const playbackRestrictionPolicyView = (
  p: StoredPlaybackRestrictionPolicy,
): Record<string, unknown> => ({
  arn: p.arn,
  allowedCountries: p.allowedCountries,
  allowedOrigins: p.allowedOrigins,
  enableStrictOriginEnforcement: p.enableStrictOriginEnforcement,
  name: p.name,
  tags: p.tags,
});

const adConfigView = (ac: StoredAdConfiguration): Record<string, unknown> => ({
  arn: ac.arn,
  name: ac.name,
  mediaTailorPlaybackConfigurations: ac.mediaTailorPlaybackConfigurations,
  tags: ac.tags,
});

const streamView = (s: StoredStream): Record<string, unknown> => ({
  channelArn: s.channelArn,
  streamId: s.streamId,
  playbackUrl: s.playbackUrl,
  startTime: s.startTime,
  state: s.state,
  health: s.health,
  viewerCount: s.viewerCount,
});

const streamSummaryView = (s: StoredStream): Record<string, unknown> => ({
  channelArn: s.channelArn,
  streamId: s.streamId,
  state: s.state,
  health: s.health,
  viewerCount: s.viewerCount,
  startTime: s.startTime,
});

const streamSessionSummaryView = (
  ss: StoredStreamSession,
): Record<string, unknown> => ({
  streamId: ss.streamId,
  startTime: ss.startTime,
  endTime: ss.endTime,
  hasErrorEvent: ss.hasErrorEvent,
});

const getOrCreateLiveStream = (
  ctx: ServiceContext,
  channel: StoredChannel,
): StoredStream => {
  const existing = ctx.store.get<StoredStream>(streamKey(channel.arn));
  if (existing !== undefined) return existing;
  const id = newId();
  const liveStream: StoredStream = {
    channelArn: channel.arn,
    streamId: `st-${id}`,
    playbackUrl: channel.playbackUrl,
    startTime: new Date().toISOString(),
    state: "LIVE",
    health: "HEALTHY",
    viewerCount: 0,
  };
  ctx.store.set(streamKey(channel.arn), liveStream);
  return liveStream;
};

const CreateChannel: OperationHandler = (input, ctx) => {
  const id = newId();
  const arn = channelArn(ctx, id);
  const name = stringOrUndefined(input["name"]) ?? `channel-${id}`;
  const tags = tagsOrEmpty(input["tags"]);
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
    tags,
    insecureIngest: booleanOrFalse(input["insecureIngest"]),
    preset: stringOrUndefined(input["preset"]) ?? "",
    playbackRestrictionPolicyArn:
      stringOrUndefined(input["playbackRestrictionPolicyArn"]) ?? "",
    adConfigurationArn: stringOrUndefined(input["adConfigurationArn"]) ?? "",
  };
  ctx.store.set(channelKey(arn), channel);
  ctx.store.set(tagsKey(arn), tags as Record<string, string>);
  const skId = newId();
  const skArnVal = streamKeyArn(ctx, skId);
  const defaultSk: StoredStreamKey = {
    arn: skArnVal,
    value: `sk_${ctx.region}_${newId()}`,
    channelArn: arn,
    tags: {},
  };
  ctx.store.set(streamKeyKey(skArnVal), defaultSk);
  return {
    channel: channelView(channel),
    streamKey: streamKeyView(defaultSk),
  };
};

const GetChannel: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const channel = requireChannel(ctx, arn);
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? channel.tags;
  return { channel: { ...channelView(channel), tags } };
};

const ListChannels: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const token = stringOrUndefined(input["nextToken"]);
  const filterByName = stringOrUndefined(input["filterByName"]);
  const filterByRecordingConfigurationArn = stringOrUndefined(
    input["filterByRecordingConfigurationArn"],
  );
  const filterByPlaybackRestrictionPolicyArn = stringOrUndefined(
    input["filterByPlaybackRestrictionPolicyArn"],
  );
  const filterByAdConfigurationArn = stringOrUndefined(
    input["filterByAdConfigurationArn"],
  );
  const start = token !== undefined ? decodeNextToken(token) : 0;
  const channels = ctx.store
    .list<StoredChannel>()
    .filter((entry) => entry.key.startsWith(channelPrefix))
    .map((entry) => entry.value)
    .filter((c) =>
      filterByName === undefined ? true : c.name === filterByName,
    )
    .filter((c) =>
      filterByRecordingConfigurationArn === undefined
        ? true
        : c.recordingConfigurationArn === filterByRecordingConfigurationArn,
    )
    .filter((c) =>
      filterByPlaybackRestrictionPolicyArn === undefined
        ? true
        : c.playbackRestrictionPolicyArn ===
          filterByPlaybackRestrictionPolicyArn,
    )
    .filter((c) =>
      filterByAdConfigurationArn === undefined
        ? true
        : c.adConfigurationArn === filterByAdConfigurationArn,
    )
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const slice = channels.slice(start, start + max);
  const nextToken =
    start + max < channels.length ? encodeNextToken(start + max) : undefined;
  return {
    channels: slice.map((c) => {
      const tags =
        ctx.store.get<Record<string, string>>(tagsKey(c.arn)) ?? c.tags;
      return { ...channelSummaryView(c), tags };
    }),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteChannel: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  requireChannel(ctx, arn);
  ctx.store.delete(channelKey(arn));
  return {};
};

const UpdateChannel: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const channel = requireChannel(ctx, arn);
  const updated: StoredChannel = {
    ...channel,
    name: stringOrUndefined(input["name"]) ?? channel.name,
    latencyMode: stringOrUndefined(input["latencyMode"]) ?? channel.latencyMode,
    type: stringOrUndefined(input["type"]) ?? channel.type,
    authorized:
      typeof input["authorized"] === "boolean"
        ? input["authorized"]
        : channel.authorized,
    recordingConfigurationArn:
      typeof input["recordingConfigurationArn"] === "string"
        ? input["recordingConfigurationArn"]
        : channel.recordingConfigurationArn,
    insecureIngest:
      typeof input["insecureIngest"] === "boolean"
        ? input["insecureIngest"]
        : channel.insecureIngest,
    preset: stringOrUndefined(input["preset"]) ?? channel.preset,
    playbackRestrictionPolicyArn:
      typeof input["playbackRestrictionPolicyArn"] === "string"
        ? input["playbackRestrictionPolicyArn"]
        : channel.playbackRestrictionPolicyArn,
    adConfigurationArn:
      typeof input["adConfigurationArn"] === "string"
        ? input["adConfigurationArn"]
        : channel.adConfigurationArn,
  };
  ctx.store.set(channelKey(arn), updated);
  return { channel: channelView(updated) };
};

const BatchGetChannel: OperationHandler = (input, ctx) => {
  const arns = arrayOrEmpty(input["arns"]).filter(
    (a): a is string => typeof a === "string",
  );
  const channels: Record<string, unknown>[] = [];
  const errors: Record<string, unknown>[] = [];
  for (const arn of arns) {
    const ch = ctx.store.get<StoredChannel>(channelKey(arn));
    if (ch !== undefined) {
      channels.push(channelView(ch));
    } else {
      errors.push({
        arn,
        code: "CHANNEL_NOT_FOUND",
        message: `Channel not found: ${arn}`,
      });
    }
  }
  return { channels, errors };
};

const CreateStreamKey: OperationHandler = (input, ctx) => {
  const chArn = requireString(input, "channelArn");
  requireChannel(ctx, chArn);
  const id = newId();
  const arn = streamKeyArn(ctx, id);
  const tags = tagsOrEmpty(input["tags"]);
  const sk: StoredStreamKey = {
    arn,
    value: `sk_${ctx.region}_${newId()}`,
    channelArn: chArn,
    tags,
  };
  ctx.store.set(streamKeyKey(arn), sk);
  ctx.store.set(tagsKey(arn), tags as Record<string, string>);
  return { streamKey: streamKeyView(sk) };
};

const GetStreamKey: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const sk = requireStreamKey(ctx, arn);
  const tags = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? sk.tags;
  return { streamKey: { ...streamKeyView(sk), tags } };
};

const DeleteStreamKey: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  requireStreamKey(ctx, arn);
  ctx.store.delete(streamKeyKey(arn));
  return {};
};

const ListStreamKeys: OperationHandler = (input, ctx) => {
  const chArn = requireString(input, "channelArn");
  requireChannel(ctx, chArn);
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const token = stringOrUndefined(input["nextToken"]);
  const start = token !== undefined ? decodeNextToken(token) : 0;
  const keys = ctx.store
    .list<StoredStreamKey>()
    .filter((entry) => entry.key.startsWith(streamKeyPrefix))
    .map((entry) => entry.value)
    .filter((sk) => sk.channelArn === chArn);
  const slice = keys.slice(start, start + max);
  const nextToken =
    start + max < keys.length ? encodeNextToken(start + max) : undefined;
  return {
    streamKeys: slice.map(streamKeySummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const BatchGetStreamKey: OperationHandler = (input, ctx) => {
  const arns = arrayOrEmpty(input["arns"]).filter(
    (a): a is string => typeof a === "string",
  );
  const streamKeys: Record<string, unknown>[] = [];
  const errors: Record<string, unknown>[] = [];
  for (const arn of arns) {
    const sk = ctx.store.get<StoredStreamKey>(streamKeyKey(arn));
    if (sk !== undefined) {
      streamKeys.push(streamKeyView(sk));
    } else {
      errors.push({
        arn,
        code: "STREAM_KEY_NOT_FOUND",
        message: `StreamKey not found: ${arn}`,
      });
    }
  }
  return { streamKeys, errors };
};

const CreateRecordingConfiguration: OperationHandler = (input, ctx) => {
  const id = newId();
  const arn = recConfigArn(ctx, id);
  const destConfig = tagsOrEmpty(input["destinationConfiguration"]);
  const tags = tagsOrEmpty(input["tags"]);
  const rc: StoredRecordingConfiguration = {
    arn,
    name: stringOrUndefined(input["name"]) ?? `rec-config-${id}`,
    destinationConfiguration: destConfig,
    state: "CREATING",
    tags,
    thumbnailConfiguration: tagsOrEmpty(input["thumbnailConfiguration"]),
    recordingReconnectWindowSeconds:
      numberOrUndefined(input["recordingReconnectWindowSeconds"]) ?? 0,
    renditionConfiguration: tagsOrEmpty(input["renditionConfiguration"]),
  };
  ctx.store.set(recConfigKey(arn), rc);
  ctx.store.set(tagsKey(arn), tags as Record<string, string>);
  return { recordingConfiguration: recConfigView(rc) };
};

const GetRecordingConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  let rc = requireRecConfig(ctx, arn);
  if (rc.state === "CREATING") {
    rc = { ...rc, state: "ACTIVE" };
    ctx.store.set(recConfigKey(arn), rc);
  }
  const tags = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? rc.tags;
  return { recordingConfiguration: { ...recConfigView(rc), tags } };
};

const DeleteRecordingConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  requireRecConfig(ctx, arn);
  ctx.store.delete(recConfigKey(arn));
  return {};
};

const ListRecordingConfigurations: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const token = stringOrUndefined(input["nextToken"]);
  const start = token !== undefined ? decodeNextToken(token) : 0;
  const configs = ctx.store
    .list<StoredRecordingConfiguration>()
    .filter((entry) => entry.key.startsWith(recConfigPrefix))
    .map((entry) => entry.value);
  const slice = configs.slice(start, start + max);
  const nextToken =
    start + max < configs.length ? encodeNextToken(start + max) : undefined;
  return {
    recordingConfigurations: slice.map(recConfigSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const ImportPlaybackKeyPair: OperationHandler = (input, ctx) => {
  const id = newId();
  const arn = playbackKeyPairArn(ctx, id);
  const publicKey = requireString(input, "publicKeyMaterial");
  const fingerprint = publicKey.slice(0, 16).replaceAll(" ", "") || "fp-mock";
  const tags = tagsOrEmpty(input["tags"]);
  const kp: StoredPlaybackKeyPair = {
    arn,
    name: stringOrUndefined(input["name"]) ?? `key-pair-${id}`,
    fingerprint,
    tags,
  };
  ctx.store.set(playbackKeyPairKey(arn), kp);
  ctx.store.set(tagsKey(arn), tags as Record<string, string>);
  return { keyPair: playbackKeyPairView(kp) };
};

const GetPlaybackKeyPair: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const kp = requirePlaybackKeyPair(ctx, arn);
  const tags = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? kp.tags;
  return { keyPair: { ...playbackKeyPairView(kp), tags } };
};

const DeletePlaybackKeyPair: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  requirePlaybackKeyPair(ctx, arn);
  ctx.store.delete(playbackKeyPairKey(arn));
  return {};
};

const ListPlaybackKeyPairs: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const token = stringOrUndefined(input["nextToken"]);
  const start = token !== undefined ? decodeNextToken(token) : 0;
  const keyPairs = ctx.store
    .list<StoredPlaybackKeyPair>()
    .filter((entry) => entry.key.startsWith(playbackKeyPairPrefix))
    .map((entry) => entry.value);
  const slice = keyPairs.slice(start, start + max);
  const nextToken =
    start + max < keyPairs.length ? encodeNextToken(start + max) : undefined;
  return {
    keyPairs: slice.map(playbackKeyPairSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const CreatePlaybackRestrictionPolicy: OperationHandler = (input, ctx) => {
  const id = newId();
  const arn = playbackRestrictionPolicyArn(ctx, id);
  const allowedCountries = arrayOrEmpty(input["allowedCountries"]).filter(
    (c): c is string => typeof c === "string",
  );
  const allowedOrigins = arrayOrEmpty(input["allowedOrigins"]).filter(
    (o): o is string => typeof o === "string",
  );
  const tags = tagsOrEmpty(input["tags"]);
  const policy: StoredPlaybackRestrictionPolicy = {
    arn,
    allowedCountries,
    allowedOrigins,
    enableStrictOriginEnforcement: booleanOrFalse(
      input["enableStrictOriginEnforcement"],
    ),
    name: stringOrUndefined(input["name"]) ?? `policy-${id}`,
    tags,
  };
  ctx.store.set(playbackRestrictionPolicyKey(arn), policy);
  ctx.store.set(tagsKey(arn), tags as Record<string, string>);
  return { playbackRestrictionPolicy: playbackRestrictionPolicyView(policy) };
};

const GetPlaybackRestrictionPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const policy = requirePlaybackRestrictionPolicy(ctx, arn);
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? policy.tags;
  return {
    playbackRestrictionPolicy: {
      ...playbackRestrictionPolicyView(policy),
      tags,
    },
  };
};

const DeletePlaybackRestrictionPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  requirePlaybackRestrictionPolicy(ctx, arn);
  ctx.store.delete(playbackRestrictionPolicyKey(arn));
  return {};
};

const UpdatePlaybackRestrictionPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const existing = requirePlaybackRestrictionPolicy(ctx, arn);
  const allowedCountries = Array.isArray(input["allowedCountries"])
    ? (input["allowedCountries"] as unknown[]).filter(
        (c): c is string => typeof c === "string",
      )
    : existing.allowedCountries;
  const allowedOrigins = Array.isArray(input["allowedOrigins"])
    ? (input["allowedOrigins"] as unknown[]).filter(
        (o): o is string => typeof o === "string",
      )
    : existing.allowedOrigins;
  const updated: StoredPlaybackRestrictionPolicy = {
    ...existing,
    allowedCountries,
    allowedOrigins,
    enableStrictOriginEnforcement:
      typeof input["enableStrictOriginEnforcement"] === "boolean"
        ? input["enableStrictOriginEnforcement"]
        : existing.enableStrictOriginEnforcement,
    name: stringOrUndefined(input["name"]) ?? existing.name,
  };
  ctx.store.set(playbackRestrictionPolicyKey(arn), updated);
  return {
    playbackRestrictionPolicy: playbackRestrictionPolicyView(updated),
  };
};

const ListPlaybackRestrictionPolicies: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const policies = ctx.store
    .list<StoredPlaybackRestrictionPolicy>()
    .filter((entry) => entry.key.startsWith(playbackRestrictionPolicyPrefix))
    .map((entry) => entry.value);
  return {
    playbackRestrictionPolicies: policies
      .slice(0, max)
      .map(playbackRestrictionPolicyView),
  };
};

const CreateAdConfiguration: OperationHandler = (input, ctx) => {
  const id = newId();
  const arn = adConfigArn(ctx, id);
  const mediaTailorPlaybackConfigurations = arrayOrEmpty(
    input["mediaTailorPlaybackConfigurations"],
  ).map((item) => {
    const obj =
      typeof item === "object" && item !== null
        ? (item as Record<string, unknown>)
        : {};
    return {
      playbackConfigurationArn:
        stringOrUndefined(obj["playbackConfigurationArn"]) ?? "",
    };
  });
  const tags = tagsOrEmpty(input["tags"]);
  const ac: StoredAdConfiguration = {
    arn,
    name: requireString(input, "name"),
    mediaTailorPlaybackConfigurations,
    tags,
  };
  ctx.store.set(adConfigKey(arn), ac);
  ctx.store.set(tagsKey(arn), tags as Record<string, string>);
  return { adConfiguration: adConfigView(ac) };
};

const GetAdConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const ac = requireAdConfig(ctx, arn);
  const tags = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? ac.tags;
  return { adConfiguration: { ...adConfigView(ac), tags } };
};

const DeleteAdConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  requireAdConfig(ctx, arn);
  ctx.store.delete(adConfigKey(arn));
  return {};
};

const ListAdConfigurations: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const configs = ctx.store
    .list<StoredAdConfiguration>()
    .filter((entry) => entry.key.startsWith(adConfigPrefix))
    .map((entry) => entry.value);
  return { adConfigurations: configs.slice(0, max).map(adConfigView) };
};

const GetStream: OperationHandler = (input, ctx) => {
  const chArn = requireString(input, "channelArn");
  const channel = requireChannel(ctx, chArn);
  const liveStream = getOrCreateLiveStream(ctx, channel);
  return { stream: streamView(liveStream) };
};

const ListStreams: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const token = stringOrUndefined(input["nextToken"]);
  const filterBy =
    typeof input["filterBy"] === "object" && input["filterBy"] !== null
      ? (input["filterBy"] as Record<string, unknown>)
      : undefined;
  const filterByHealth =
    filterBy !== undefined ? stringOrUndefined(filterBy["health"]) : undefined;
  const start = token !== undefined ? decodeNextToken(token) : 0;
  const streams = ctx.store
    .list<StoredStream>()
    .filter((entry) => entry.key.startsWith(streamPrefix))
    .map((entry) => entry.value)
    .filter((s) => s.state === "LIVE")
    .filter((s) =>
      filterByHealth === undefined ? true : s.health === filterByHealth,
    );
  const slice = streams.slice(start, start + max);
  const nextToken =
    start + max < streams.length ? encodeNextToken(start + max) : undefined;
  return {
    streams: slice.map(streamSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const StopStream: OperationHandler = (input, ctx) => {
  const chArn = requireString(input, "channelArn");
  requireChannel(ctx, chArn);
  const liveStream = ctx.store.get<StoredStream>(streamKey(chArn));
  if (liveStream !== undefined) {
    const endTime = new Date().toISOString();
    const session: StoredStreamSession = {
      streamId: liveStream.streamId,
      startTime: liveStream.startTime,
      endTime,
      channelArn: chArn,
      hasErrorEvent: false,
    };
    ctx.store.set(streamSessionKey(chArn, liveStream.streamId), session);
    ctx.store.delete(streamKey(chArn));
  }
  return {};
};

const PutMetadata: OperationHandler = (input, ctx) => {
  const chArn = requireString(input, "channelArn");
  requireChannel(ctx, chArn);
  return {};
};

const GetStreamSession: OperationHandler = (input, ctx) => {
  const chArn = requireString(input, "channelArn");
  const channel = requireChannel(ctx, chArn);
  const requestedStreamId = stringOrUndefined(input["streamId"]);
  const mockIngestConfig = {
    video: {
      avcLevel: "4",
      avcProfile: "High",
      codec: "AVC",
      encoder: "FFMPEG",
      targetFramerate: 30,
      targetBitrate: 2500000,
      videoHeight: 720,
      videoWidth: 1280,
    },
    audio: {
      codec: "AAC",
      channels: 2,
      sampleRate: 48000,
      targetBitrate: 128000,
    },
  };
  const recConfigResult =
    channel.recordingConfigurationArn !== ""
      ? ctx.store.get<StoredRecordingConfiguration>(
          recConfigKey(channel.recordingConfigurationArn),
        )
      : undefined;
  if (requestedStreamId !== undefined) {
    const stored = ctx.store.get<StoredStreamSession>(
      streamSessionKey(chArn, requestedStreamId),
    );
    if (stored === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `Stream session not found: ${requestedStreamId}`,
        404,
      );
    }
    return {
      streamSession: {
        streamId: stored.streamId,
        startTime: stored.startTime,
        endTime: stored.endTime,
        channel: channelView(channel),
        ingestConfiguration: mockIngestConfig,
        ...(recConfigResult !== undefined
          ? { recordingConfiguration: recConfigView(recConfigResult) }
          : {}),
        truncatedEvents: [],
      },
    };
  }
  const liveStream = getOrCreateLiveStream(ctx, channel);
  return {
    streamSession: {
      streamId: liveStream.streamId,
      startTime: liveStream.startTime,
      channel: channelView(channel),
      ingestConfiguration: mockIngestConfig,
      ...(recConfigResult !== undefined
        ? { recordingConfiguration: recConfigView(recConfigResult) }
        : {}),
      truncatedEvents: [],
    },
  };
};

const ListStreamSessions: OperationHandler = (input, ctx) => {
  const chArn = requireString(input, "channelArn");
  requireChannel(ctx, chArn);
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const sessions = ctx.store
    .list<StoredStreamSession>()
    .filter((entry) => entry.key.startsWith(`${streamSessionPrefix}${chArn}:`))
    .map((entry) => entry.value);
  return {
    streamSessions: sessions.slice(0, max).map(streamSessionSummaryView),
  };
};

const InsertAdBreak: OperationHandler = (input, ctx) => {
  const chArn = requireString(input, "channelArn");
  requireChannel(ctx, chArn);
  const adBreakId = `ab-${newId()}`;
  return { adBreakId };
};

const StartViewerSessionRevocation: OperationHandler = (input, ctx) => {
  const chArn = requireString(input, "channelArn");
  requireChannel(ctx, chArn);
  return {};
};

const BatchStartViewerSessionRevocation: OperationHandler = (_input, _ctx) => {
  return { errors: [] };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArnVal = requireString(input, "resourceArn");
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArnVal)) ?? {};
  return { tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArnVal = requireString(input, "resourceArn");
  const newTags = tagsOrEmpty(input["tags"]) as Record<string, string>;
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArnVal)) ?? {};
  ctx.store.set(tagsKey(resourceArnVal), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArnVal = requireString(input, "resourceArn");
  const tagKeys = arrayOrEmpty(input["tagKeys"]).filter(
    (k): k is string => typeof k === "string",
  );
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArnVal)) ?? {};
  const updated = { ...existing };
  for (const key of tagKeys) delete updated[key];
  ctx.store.set(tagsKey(resourceArnVal), updated);
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const ivs = {
  name: "ivs",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts.length === 0) return undefined;

    if (parts[0] === "tags") {
      if (parts.length < 2) return undefined;
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }

    if (parts.length !== 1 || req.method !== "POST") return undefined;

    const op = parts[0];
    if (op === "CreateChannel") return "CreateChannel";
    if (op === "GetChannel") return "GetChannel";
    if (op === "ListChannels") return "ListChannels";
    if (op === "DeleteChannel") return "DeleteChannel";
    if (op === "UpdateChannel") return "UpdateChannel";
    if (op === "BatchGetChannel") return "BatchGetChannel";
    if (op === "CreateStreamKey") return "CreateStreamKey";
    if (op === "GetStreamKey") return "GetStreamKey";
    if (op === "DeleteStreamKey") return "DeleteStreamKey";
    if (op === "ListStreamKeys") return "ListStreamKeys";
    if (op === "BatchGetStreamKey") return "BatchGetStreamKey";
    if (op === "CreateRecordingConfiguration")
      return "CreateRecordingConfiguration";
    if (op === "GetRecordingConfiguration") return "GetRecordingConfiguration";
    if (op === "DeleteRecordingConfiguration")
      return "DeleteRecordingConfiguration";
    if (op === "ListRecordingConfigurations")
      return "ListRecordingConfigurations";
    if (op === "ImportPlaybackKeyPair") return "ImportPlaybackKeyPair";
    if (op === "GetPlaybackKeyPair") return "GetPlaybackKeyPair";
    if (op === "DeletePlaybackKeyPair") return "DeletePlaybackKeyPair";
    if (op === "ListPlaybackKeyPairs") return "ListPlaybackKeyPairs";
    if (op === "CreatePlaybackRestrictionPolicy")
      return "CreatePlaybackRestrictionPolicy";
    if (op === "GetPlaybackRestrictionPolicy")
      return "GetPlaybackRestrictionPolicy";
    if (op === "DeletePlaybackRestrictionPolicy")
      return "DeletePlaybackRestrictionPolicy";
    if (op === "UpdatePlaybackRestrictionPolicy")
      return "UpdatePlaybackRestrictionPolicy";
    if (op === "ListPlaybackRestrictionPolicies")
      return "ListPlaybackRestrictionPolicies";
    if (op === "CreateAdConfiguration") return "CreateAdConfiguration";
    if (op === "GetAdConfiguration") return "GetAdConfiguration";
    if (op === "DeleteAdConfiguration") return "DeleteAdConfiguration";
    if (op === "ListAdConfigurations") return "ListAdConfigurations";
    if (op === "GetStream") return "GetStream";
    if (op === "ListStreams") return "ListStreams";
    if (op === "StopStream") return "StopStream";
    if (op === "PutMetadata") return "PutMetadata";
    if (op === "GetStreamSession") return "GetStreamSession";
    if (op === "ListStreamSessions") return "ListStreamSessions";
    if (op === "InsertAdBreak") return "InsertAdBreak";
    if (op === "StartViewerSessionRevocation")
      return "StartViewerSessionRevocation";
    if (op === "BatchStartViewerSessionRevocation")
      return "BatchStartViewerSessionRevocation";
    return undefined;
  },
  operations: {
    CreateChannel,
    GetChannel,
    ListChannels,
    DeleteChannel,
    UpdateChannel,
    BatchGetChannel,
    CreateStreamKey,
    GetStreamKey,
    DeleteStreamKey,
    ListStreamKeys,
    BatchGetStreamKey,
    CreateRecordingConfiguration,
    GetRecordingConfiguration,
    DeleteRecordingConfiguration,
    ListRecordingConfigurations,
    ImportPlaybackKeyPair,
    GetPlaybackKeyPair,
    DeletePlaybackKeyPair,
    ListPlaybackKeyPairs,
    CreatePlaybackRestrictionPolicy,
    GetPlaybackRestrictionPolicy,
    DeletePlaybackRestrictionPolicy,
    UpdatePlaybackRestrictionPolicy,
    ListPlaybackRestrictionPolicies,
    CreateAdConfiguration,
    GetAdConfiguration,
    DeleteAdConfiguration,
    ListAdConfigurations,
    GetStream,
    ListStreams,
    StopStream,
    PutMetadata,
    GetStreamSession,
    ListStreamSessions,
    InsertAdBreak,
    StartViewerSessionRevocation,
    BatchStartViewerSessionRevocation,
    ListTagsForResource,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default ivs;
