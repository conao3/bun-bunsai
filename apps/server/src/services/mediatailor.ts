import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import mediatailorModel from "../../models/mediatailor.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(mediatailorModel);

const configurationPrefix = "config:" as const;
const channelPrefix = "channel:" as const;
const channelLogsPrefix = "channelLogs:" as const;
const channelPolicyPrefix = "channelPolicy:" as const;
const sourceLocationPrefix = "sourceLocation:" as const;
const liveSourcePrefix = "liveSource:" as const;
const vodSourcePrefix = "vodSource:" as const;
const programPrefix = "program:" as const;
const prefetchSchedulePrefix = "prefetchSchedule:" as const;
const functionPrefix = "function:" as const;
const tagsPrefix = "tags:" as const;
const logsForPlaybackPrefix = "logsForPlayback:" as const;

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

type StoredChannel = {
  Arn: string;
  ChannelName: string;
  ChannelState: string;
  CreationTime: number;
  FillerSlate: Record<string, unknown> | undefined;
  LastModifiedTime: number;
  Outputs: unknown[];
  PlaybackMode: string;
  Tags: Record<string, string> | undefined;
  Tier: string | undefined;
  TimeShiftConfiguration: Record<string, unknown> | undefined;
  Audiences: string[] | undefined;
};

type StoredSourceLocation = {
  Arn: string;
  SourceLocationName: string;
  AccessConfiguration: Record<string, unknown> | undefined;
  CreationTime: number;
  DefaultSegmentDeliveryConfiguration: Record<string, unknown> | undefined;
  HttpConfiguration: Record<string, unknown>;
  LastModifiedTime: number;
  SegmentDeliveryConfigurations: unknown[] | undefined;
  Tags: Record<string, string> | undefined;
};

type StoredLiveSource = {
  Arn: string;
  CreationTime: number;
  HttpPackageConfigurations: unknown[];
  LastModifiedTime: number;
  LiveSourceName: string;
  SourceLocationName: string;
  Tags: Record<string, string> | undefined;
};

type StoredVodSource = {
  Arn: string;
  CreationTime: number;
  HttpPackageConfigurations: unknown[];
  LastModifiedTime: number;
  SourceLocationName: string;
  Tags: Record<string, string> | undefined;
  VodSourceName: string;
};

type StoredProgram = {
  AdBreaks: unknown[] | undefined;
  Arn: string;
  ChannelName: string;
  CreationTime: number;
  LiveSourceName: string | undefined;
  ProgramName: string;
  ScheduledStartTime: number;
  SourceLocationName: string;
  VodSourceName: string | undefined;
  ClipRange: Record<string, unknown> | undefined;
  DurationMillis: number | undefined;
  AudienceMedia: unknown[] | undefined;
  Tags: Record<string, string> | undefined;
};

type StoredPrefetchSchedule = {
  Arn: string;
  Consumption: Record<string, unknown> | undefined;
  Name: string;
  PlaybackConfigurationName: string;
  Retrieval: Record<string, unknown> | undefined;
  RecurringPrefetchConfiguration: Record<string, unknown> | undefined;
  ScheduleType: string | undefined;
  StreamId: string | undefined;
  Tags: Record<string, string> | undefined;
};

type StoredFunction = {
  FunctionId: string;
  FunctionType: string;
  Description: string | undefined;
  HttpRequestConfiguration: Record<string, unknown> | undefined;
  CustomOutputConfiguration: Record<string, unknown> | undefined;
  SequentialExecutorConfiguration: Record<string, unknown> | undefined;
  Tags: Record<string, string> | undefined;
  Arn: string;
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

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const stringArrayOrUndefined = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === "string");
};

const stringRecordOrUndefined = (
  value: unknown,
): Record<string, string> | undefined => {
  const r = recordOrUndefined(value);
  if (r === undefined) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "string") out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
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

const now = (): number => Math.floor(Date.now() / 1000);

const paginateItems = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
  maxCap = 100,
): { page: T[]; nextToken: string | undefined } => {
  const max =
    typeof maxResults === "number" && maxResults > 0
      ? Math.min(maxResults, maxCap)
      : maxCap;
  const offset =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(atob(nextToken), 10) || 0
      : 0;
  const page = items.slice(offset, offset + max);
  const next =
    offset + max < items.length ? btoa(String(offset + max)) : undefined;
  return { page, nextToken: next };
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

const channelKey = (name: string): string => `${channelPrefix}${name}`;

const channelArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:mediatailor:${ctx.region}:${ctx.account}:channel/${name}`;

const requireChannel = (ctx: ServiceContext, name: string): StoredChannel => {
  const stored = ctx.store.get<StoredChannel>(channelKey(name));
  if (stored === undefined) {
    throw awsError("BadRequestException", `Channel not found: ${name}`, 400);
  }
  return stored;
};

const channelView = (ch: StoredChannel): Record<string, unknown> => ({
  Arn: ch.Arn,
  ChannelName: ch.ChannelName,
  ChannelState: ch.ChannelState,
  CreationTime: ch.CreationTime,
  FillerSlate: ch.FillerSlate,
  LastModifiedTime: ch.LastModifiedTime,
  Outputs: ch.Outputs,
  PlaybackMode: ch.PlaybackMode,
  Tags: ch.Tags,
  Tier: ch.Tier,
  TimeShiftConfiguration: ch.TimeShiftConfiguration,
  Audiences: ch.Audiences,
});

const sourceLocationKey = (name: string): string =>
  `${sourceLocationPrefix}${name}`;

const sourceLocationArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:mediatailor:${ctx.region}:${ctx.account}:sourceLocation/${name}`;

const requireSourceLocation = (
  ctx: ServiceContext,
  name: string,
): StoredSourceLocation => {
  const stored = ctx.store.get<StoredSourceLocation>(sourceLocationKey(name));
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `Source location not found: ${name}`,
      400,
    );
  }
  return stored;
};

const sourceLocationView = (
  sl: StoredSourceLocation,
): Record<string, unknown> => ({
  AccessConfiguration: sl.AccessConfiguration,
  Arn: sl.Arn,
  CreationTime: sl.CreationTime,
  DefaultSegmentDeliveryConfiguration: sl.DefaultSegmentDeliveryConfiguration,
  HttpConfiguration: sl.HttpConfiguration,
  LastModifiedTime: sl.LastModifiedTime,
  SegmentDeliveryConfigurations: sl.SegmentDeliveryConfigurations,
  SourceLocationName: sl.SourceLocationName,
  Tags: sl.Tags,
});

const liveSourceKey = (sourceLocationName: string, name: string): string =>
  `${liveSourcePrefix}${sourceLocationName}:${name}`;

const liveSourceArn = (
  ctx: ServiceContext,
  sourceLocationName: string,
  name: string,
): string =>
  `arn:aws:mediatailor:${ctx.region}:${ctx.account}:liveSource/${sourceLocationName}/${name}`;

const requireLiveSource = (
  ctx: ServiceContext,
  sourceLocationName: string,
  name: string,
): StoredLiveSource => {
  const stored = ctx.store.get<StoredLiveSource>(
    liveSourceKey(sourceLocationName, name),
  );
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `Live source not found: ${name}`,
      400,
    );
  }
  return stored;
};

const liveSourceView = (ls: StoredLiveSource): Record<string, unknown> => ({
  Arn: ls.Arn,
  CreationTime: ls.CreationTime,
  HttpPackageConfigurations: ls.HttpPackageConfigurations,
  LastModifiedTime: ls.LastModifiedTime,
  LiveSourceName: ls.LiveSourceName,
  SourceLocationName: ls.SourceLocationName,
  Tags: ls.Tags,
});

const vodSourceKey = (sourceLocationName: string, name: string): string =>
  `${vodSourcePrefix}${sourceLocationName}:${name}`;

const vodSourceArn = (
  ctx: ServiceContext,
  sourceLocationName: string,
  name: string,
): string =>
  `arn:aws:mediatailor:${ctx.region}:${ctx.account}:vodSource/${sourceLocationName}/${name}`;

const requireVodSource = (
  ctx: ServiceContext,
  sourceLocationName: string,
  name: string,
): StoredVodSource => {
  const stored = ctx.store.get<StoredVodSource>(
    vodSourceKey(sourceLocationName, name),
  );
  if (stored === undefined) {
    throw awsError("BadRequestException", `VOD source not found: ${name}`, 400);
  }
  return stored;
};

const vodSourceView = (vs: StoredVodSource): Record<string, unknown> => ({
  Arn: vs.Arn,
  CreationTime: vs.CreationTime,
  HttpPackageConfigurations: vs.HttpPackageConfigurations,
  LastModifiedTime: vs.LastModifiedTime,
  SourceLocationName: vs.SourceLocationName,
  Tags: vs.Tags,
  VodSourceName: vs.VodSourceName,
});

const programKey = (channelName: string, programName: string): string =>
  `${programPrefix}${channelName}:${programName}`;

const programArn = (
  ctx: ServiceContext,
  channelName: string,
  programName: string,
): string =>
  `arn:aws:mediatailor:${ctx.region}:${ctx.account}:program/${channelName}/${programName}`;

const requireProgram = (
  ctx: ServiceContext,
  channelName: string,
  programName: string,
): StoredProgram => {
  const stored = ctx.store.get<StoredProgram>(
    programKey(channelName, programName),
  );
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `Program not found: ${programName}`,
      400,
    );
  }
  return stored;
};

const programView = (p: StoredProgram): Record<string, unknown> => ({
  AdBreaks: p.AdBreaks,
  Arn: p.Arn,
  ChannelName: p.ChannelName,
  CreationTime: p.CreationTime,
  LiveSourceName: p.LiveSourceName,
  ProgramName: p.ProgramName,
  ScheduledStartTime: p.ScheduledStartTime,
  SourceLocationName: p.SourceLocationName,
  VodSourceName: p.VodSourceName,
  ClipRange: p.ClipRange,
  DurationMillis: p.DurationMillis,
  AudienceMedia: p.AudienceMedia,
  Tags: p.Tags,
});

const prefetchScheduleKey = (
  playbackConfigurationName: string,
  name: string,
): string => `${prefetchSchedulePrefix}${playbackConfigurationName}:${name}`;

const prefetchScheduleArn = (
  ctx: ServiceContext,
  playbackConfigurationName: string,
  name: string,
): string =>
  `arn:aws:mediatailor:${ctx.region}:${ctx.account}:prefetchSchedule/${playbackConfigurationName}/${name}`;

const requirePrefetchSchedule = (
  ctx: ServiceContext,
  playbackConfigurationName: string,
  name: string,
): StoredPrefetchSchedule => {
  const stored = ctx.store.get<StoredPrefetchSchedule>(
    prefetchScheduleKey(playbackConfigurationName, name),
  );
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `Prefetch schedule not found: ${name}`,
      400,
    );
  }
  return stored;
};

const prefetchScheduleView = (
  ps: StoredPrefetchSchedule,
): Record<string, unknown> => ({
  Arn: ps.Arn,
  Consumption: ps.Consumption,
  Name: ps.Name,
  PlaybackConfigurationName: ps.PlaybackConfigurationName,
  Retrieval: ps.Retrieval,
  RecurringPrefetchConfiguration: ps.RecurringPrefetchConfiguration,
  ScheduleType: ps.ScheduleType,
  StreamId: ps.StreamId,
  Tags: ps.Tags,
});

const functionKey = (functionId: string): string =>
  `${functionPrefix}${functionId}`;

const functionArn = (ctx: ServiceContext, functionId: string): string =>
  `arn:aws:mediatailor:${ctx.region}:${ctx.account}:function/${functionId}`;

const requireFunction = (
  ctx: ServiceContext,
  functionId: string,
): StoredFunction => {
  const stored = ctx.store.get<StoredFunction>(functionKey(functionId));
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `Function not found: ${functionId}`,
      400,
    );
  }
  return stored;
};

const functionView = (f: StoredFunction): Record<string, unknown> => ({
  FunctionId: f.FunctionId,
  FunctionType: f.FunctionType,
  Description: f.Description,
  HttpRequestConfiguration: f.HttpRequestConfiguration,
  CustomOutputConfiguration: f.CustomOutputConfiguration,
  SequentialExecutorConfiguration: f.SequentialExecutorConfiguration,
  Tags: f.Tags,
  Arn: f.Arn,
});

const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;

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
  const items = ctx.store
    .list<StoredConfiguration>()
    .filter((entry) => entry.key.startsWith(configurationPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0))
    .map(configurationView);
  const { page, nextToken } = paginateItems(
    items,
    input["MaxResults"],
    input["NextToken"],
    50,
  );
  return { Items: page, NextToken: nextToken };
};

const DeletePlaybackConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  requireConfiguration(ctx, name);
  ctx.store.delete(configurationKey(name));
  return {};
};

const ConfigureLogsForChannel: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  requireChannel(ctx, channelName);
  const logTypes = stringArrayOrUndefined(input["LogTypes"]);
  if (logTypes === undefined) {
    throw awsError("BadRequestException", "LogTypes is required.", 400);
  }
  ctx.store.set(`${channelLogsPrefix}${channelName}`, {
    channelName,
    logTypes,
  });
  return { ChannelName: channelName, LogTypes: logTypes };
};

const ConfigureLogsForPlaybackConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const playbackConfigurationName = requireString(
    input,
    "PlaybackConfigurationName",
  );
  if (typeof input["PercentEnabled"] !== "number") {
    throw awsError("BadRequestException", "PercentEnabled is required.", 400);
  }
  const percentEnabled = input["PercentEnabled"];
  ctx.store.set(`${logsForPlaybackPrefix}${playbackConfigurationName}`, {
    percentEnabled,
    playbackConfigurationName,
  });
  return {
    PercentEnabled: percentEnabled,
    PlaybackConfigurationName: playbackConfigurationName,
  };
};

const CreateChannel: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  const t = now();
  const tags = stringRecordOrUndefined(input["Tags"]);
  const channel: StoredChannel = {
    Arn: channelArn(ctx, channelName),
    ChannelName: channelName,
    ChannelState: "STOPPED",
    CreationTime: t,
    FillerSlate: recordOrUndefined(input["FillerSlate"]),
    LastModifiedTime: t,
    Outputs: arrayOrEmpty(input["Outputs"]),
    PlaybackMode: requireString(input, "PlaybackMode"),
    Tags: tags,
    Tier: stringOrUndefined(input["Tier"]),
    TimeShiftConfiguration: recordOrUndefined(input["TimeShiftConfiguration"]),
    Audiences: stringArrayOrUndefined(input["Audiences"]),
  };
  ctx.store.set(channelKey(channelName), channel);
  if (tags !== undefined) {
    ctx.store.set(tagsKey(channel.Arn), tags as Record<string, string>);
  }
  return channelView(channel);
};

const DeleteChannel: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  const channel = requireChannel(ctx, channelName);
  const hasPrograms = ctx.store
    .list()
    .some((e) => e.key.startsWith(`${programPrefix}${channelName}:`));
  if (hasPrograms) {
    throw awsError(
      "ResourceInUseException",
      `Channel ${channelName} has associated programs. Delete them before deleting the channel.`,
      409,
    );
  }
  ctx.store.delete(channelKey(channelName));
  ctx.store.delete(tagsKey(channel.Arn));
  ctx.store.delete(`${channelLogsPrefix}${channelName}`);
  ctx.store.delete(`${channelPolicyPrefix}${channelName}`);
  return {};
};

const DescribeChannel: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  const channel = requireChannel(ctx, channelName);
  const logsStored = ctx.store.get<{ logTypes?: string[] }>(
    `${channelLogsPrefix}${channelName}`,
  );
  return {
    ...channelView(channel),
    LogConfiguration: { LogTypes: logsStored?.logTypes ?? [] },
  };
};

const UpdateChannel: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  const existing = requireChannel(ctx, channelName);
  const updated: StoredChannel = {
    ...existing,
    FillerSlate:
      recordOrUndefined(input["FillerSlate"]) ?? existing.FillerSlate,
    LastModifiedTime: now(),
    Outputs: Array.isArray(input["Outputs"])
      ? (input["Outputs"] as unknown[])
      : existing.Outputs,
    TimeShiftConfiguration:
      recordOrUndefined(input["TimeShiftConfiguration"]) ??
      existing.TimeShiftConfiguration,
    Audiences: stringArrayOrUndefined(input["Audiences"]) ?? existing.Audiences,
  };
  ctx.store.set(channelKey(channelName), updated);
  return channelView(updated);
};

const GetChannelPolicy: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  requireChannel(ctx, channelName);
  const stored = ctx.store.get<{ Policy: string }>(
    `${channelPolicyPrefix}${channelName}`,
  );
  return { Policy: stored?.Policy };
};

const PutChannelPolicy: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  requireChannel(ctx, channelName);
  const policy = requireString(input, "Policy");
  ctx.store.set(`${channelPolicyPrefix}${channelName}`, { Policy: policy });
  return {};
};

const DeleteChannelPolicy: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  requireChannel(ctx, channelName);
  ctx.store.delete(`${channelPolicyPrefix}${channelName}`);
  return {};
};

const scheduleEntryView = (p: StoredProgram): Record<string, unknown> => ({
  Arn: p.Arn,
  ChannelName: p.ChannelName,
  ProgramName: p.ProgramName,
  SourceLocationName: p.SourceLocationName,
  LiveSourceName: p.LiveSourceName,
  VodSourceName: p.VodSourceName,
  ApproximateStartTime: p.ScheduledStartTime,
});

const GetChannelSchedule: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  requireChannel(ctx, channelName);
  const prefix = `${programPrefix}${channelName}:`;
  const items = ctx.store
    .list<StoredProgram>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => scheduleEntryView(e.value))
    .sort((a, b) =>
      Number(a["ApproximateStartTime"]) < Number(b["ApproximateStartTime"])
        ? -1
        : 1,
    );
  const { page, nextToken } = paginateItems(
    items,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Items: page, NextToken: nextToken };
};

const StartChannel: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  const channel = requireChannel(ctx, channelName);
  ctx.store.set(channelKey(channelName), {
    ...channel,
    ChannelState: "RUNNING",
    LastModifiedTime: now(),
  });
  return {};
};

const StopChannel: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  const channel = requireChannel(ctx, channelName);
  ctx.store.set(channelKey(channelName), {
    ...channel,
    ChannelState: "STOPPED",
    LastModifiedTime: now(),
  });
  return {};
};

const ListChannels: OperationHandler = (input, ctx) => {
  const items = ctx.store
    .list<StoredChannel>()
    .filter((e) => e.key.startsWith(channelPrefix))
    .map((e) => channelView(e.value))
    .sort((a, b) =>
      String(a["ChannelName"]) < String(b["ChannelName"]) ? -1 : 1,
    );
  const { page, nextToken } = paginateItems(
    items,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Items: page, NextToken: nextToken };
};

const CreateProgram: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  const programName = requireString(input, "ProgramName");
  const sourceLocationName = requireString(input, "SourceLocationName");
  requireChannel(ctx, channelName);
  const scheduleConfig = recordOrUndefined(input["ScheduleConfiguration"]);
  if (scheduleConfig === undefined) {
    throw awsError(
      "BadRequestException",
      "ScheduleConfiguration is required.",
      400,
    );
  }
  const transition = recordOrUndefined(scheduleConfig["Transition"]);
  if (transition === undefined) {
    throw awsError(
      "BadRequestException",
      "ScheduleConfiguration.Transition is required.",
      400,
    );
  }
  const transitionType = stringOrUndefined(transition["Type"]);
  const scheduledStartTimeMillis = numberOrUndefined(
    transition["ScheduledStartTimeMillis"],
  );
  const scheduledStartTime =
    transitionType === "ABSOLUTE" && scheduledStartTimeMillis !== undefined
      ? Math.floor(scheduledStartTimeMillis / 1000)
      : now();
  const t = now();
  const program: StoredProgram = {
    AdBreaks: Array.isArray(input["AdBreaks"])
      ? (input["AdBreaks"] as unknown[])
      : undefined,
    Arn: programArn(ctx, channelName, programName),
    ChannelName: channelName,
    CreationTime: t,
    LiveSourceName: stringOrUndefined(input["LiveSourceName"]),
    ProgramName: programName,
    ScheduledStartTime: scheduledStartTime,
    SourceLocationName: sourceLocationName,
    VodSourceName: stringOrUndefined(input["VodSourceName"]),
    ClipRange: recordOrUndefined(input["ClipRange"]),
    DurationMillis: numberOrUndefined(input["DurationMillis"]),
    AudienceMedia: Array.isArray(input["AudienceMedia"])
      ? (input["AudienceMedia"] as unknown[])
      : undefined,
    Tags: stringRecordOrUndefined(input["Tags"]),
  };
  ctx.store.set(programKey(channelName, programName), program);
  return programView(program);
};

const DeleteProgram: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  const programName = requireString(input, "ProgramName");
  requireProgram(ctx, channelName, programName);
  ctx.store.delete(programKey(channelName, programName));
  return {};
};

const DescribeProgram: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  const programName = requireString(input, "ProgramName");
  return programView(requireProgram(ctx, channelName, programName));
};

const UpdateProgram: OperationHandler = (input, ctx) => {
  const channelName = requireString(input, "ChannelName");
  const programName = requireString(input, "ProgramName");
  const existing = requireProgram(ctx, channelName, programName);
  const updated: StoredProgram = {
    ...existing,
    AdBreaks: Array.isArray(input["AdBreaks"])
      ? (input["AdBreaks"] as unknown[])
      : existing.AdBreaks,
    AudienceMedia: Array.isArray(input["AudienceMedia"])
      ? (input["AudienceMedia"] as unknown[])
      : existing.AudienceMedia,
  };
  ctx.store.set(programKey(channelName, programName), updated);
  return programView(updated);
};

const CreateSourceLocation: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  const t = now();
  const sl: StoredSourceLocation = {
    Arn: sourceLocationArn(ctx, sourceLocationName),
    SourceLocationName: sourceLocationName,
    AccessConfiguration: recordOrUndefined(input["AccessConfiguration"]),
    CreationTime: t,
    DefaultSegmentDeliveryConfiguration: recordOrUndefined(
      input["DefaultSegmentDeliveryConfiguration"],
    ),
    HttpConfiguration: recordOrUndefined(input["HttpConfiguration"]) ?? {},
    LastModifiedTime: t,
    SegmentDeliveryConfigurations: Array.isArray(
      input["SegmentDeliveryConfigurations"],
    )
      ? (input["SegmentDeliveryConfigurations"] as unknown[])
      : undefined,
    Tags: stringRecordOrUndefined(input["Tags"]),
  };
  ctx.store.set(sourceLocationKey(sourceLocationName), sl);
  return sourceLocationView(sl);
};

const DeleteSourceLocation: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  const sl = requireSourceLocation(ctx, sourceLocationName);
  const hasLiveSources = ctx.store
    .list()
    .some((e) => e.key.startsWith(`${liveSourcePrefix}${sourceLocationName}:`));
  const hasVodSources = ctx.store
    .list()
    .some((e) => e.key.startsWith(`${vodSourcePrefix}${sourceLocationName}:`));
  if (hasLiveSources || hasVodSources) {
    throw awsError(
      "ResourceInUseException",
      `Source location ${sourceLocationName} has associated sources. Delete them before deleting the source location.`,
      409,
    );
  }
  ctx.store.delete(sourceLocationKey(sourceLocationName));
  ctx.store.delete(tagsKey(sl.Arn));
  return {};
};

const DescribeSourceLocation: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  return sourceLocationView(requireSourceLocation(ctx, sourceLocationName));
};

const UpdateSourceLocation: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  const existing = requireSourceLocation(ctx, sourceLocationName);
  const updated: StoredSourceLocation = {
    ...existing,
    AccessConfiguration:
      recordOrUndefined(input["AccessConfiguration"]) ??
      existing.AccessConfiguration,
    DefaultSegmentDeliveryConfiguration:
      recordOrUndefined(input["DefaultSegmentDeliveryConfiguration"]) ??
      existing.DefaultSegmentDeliveryConfiguration,
    HttpConfiguration:
      recordOrUndefined(input["HttpConfiguration"]) ??
      existing.HttpConfiguration,
    LastModifiedTime: now(),
    SegmentDeliveryConfigurations: Array.isArray(
      input["SegmentDeliveryConfigurations"],
    )
      ? (input["SegmentDeliveryConfigurations"] as unknown[])
      : existing.SegmentDeliveryConfigurations,
  };
  ctx.store.set(sourceLocationKey(sourceLocationName), updated);
  return sourceLocationView(updated);
};

const ListSourceLocations: OperationHandler = (input, ctx) => {
  const items = ctx.store
    .list<StoredSourceLocation>()
    .filter((e) => e.key.startsWith(sourceLocationPrefix))
    .map((e) => sourceLocationView(e.value))
    .sort((a, b) =>
      String(a["SourceLocationName"]) < String(b["SourceLocationName"])
        ? -1
        : 1,
    );
  const { page, nextToken } = paginateItems(
    items,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Items: page, NextToken: nextToken };
};

const CreateLiveSource: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  const liveSourceName = requireString(input, "LiveSourceName");
  requireSourceLocation(ctx, sourceLocationName);
  const t = now();
  const ls: StoredLiveSource = {
    Arn: liveSourceArn(ctx, sourceLocationName, liveSourceName),
    CreationTime: t,
    HttpPackageConfigurations: arrayOrEmpty(input["HttpPackageConfigurations"]),
    LastModifiedTime: t,
    LiveSourceName: liveSourceName,
    SourceLocationName: sourceLocationName,
    Tags: stringRecordOrUndefined(input["Tags"]),
  };
  ctx.store.set(liveSourceKey(sourceLocationName, liveSourceName), ls);
  return liveSourceView(ls);
};

const DeleteLiveSource: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  const liveSourceName = requireString(input, "LiveSourceName");
  requireLiveSource(ctx, sourceLocationName, liveSourceName);
  ctx.store.delete(liveSourceKey(sourceLocationName, liveSourceName));
  return {};
};

const DescribeLiveSource: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  const liveSourceName = requireString(input, "LiveSourceName");
  return liveSourceView(
    requireLiveSource(ctx, sourceLocationName, liveSourceName),
  );
};

const UpdateLiveSource: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  const liveSourceName = requireString(input, "LiveSourceName");
  const existing = requireLiveSource(ctx, sourceLocationName, liveSourceName);
  const updated: StoredLiveSource = {
    ...existing,
    HttpPackageConfigurations: Array.isArray(input["HttpPackageConfigurations"])
      ? (input["HttpPackageConfigurations"] as unknown[])
      : existing.HttpPackageConfigurations,
    LastModifiedTime: now(),
  };
  ctx.store.set(liveSourceKey(sourceLocationName, liveSourceName), updated);
  return liveSourceView(updated);
};

const ListLiveSources: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  requireSourceLocation(ctx, sourceLocationName);
  const prefix = liveSourceKey(sourceLocationName, "");
  const items = ctx.store
    .list<StoredLiveSource>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => liveSourceView(e.value))
    .sort((a, b) =>
      String(a["LiveSourceName"]) < String(b["LiveSourceName"]) ? -1 : 1,
    );
  const { page, nextToken } = paginateItems(
    items,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Items: page, NextToken: nextToken };
};

const CreateVodSource: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  const vodSourceName = requireString(input, "VodSourceName");
  requireSourceLocation(ctx, sourceLocationName);
  const t = now();
  const vs: StoredVodSource = {
    Arn: vodSourceArn(ctx, sourceLocationName, vodSourceName),
    CreationTime: t,
    HttpPackageConfigurations: arrayOrEmpty(input["HttpPackageConfigurations"]),
    LastModifiedTime: t,
    SourceLocationName: sourceLocationName,
    Tags: stringRecordOrUndefined(input["Tags"]),
    VodSourceName: vodSourceName,
  };
  ctx.store.set(vodSourceKey(sourceLocationName, vodSourceName), vs);
  return vodSourceView(vs);
};

const DeleteVodSource: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  const vodSourceName = requireString(input, "VodSourceName");
  requireVodSource(ctx, sourceLocationName, vodSourceName);
  ctx.store.delete(vodSourceKey(sourceLocationName, vodSourceName));
  return {};
};

const DescribeVodSource: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  const vodSourceName = requireString(input, "VodSourceName");
  return vodSourceView(
    requireVodSource(ctx, sourceLocationName, vodSourceName),
  );
};

const UpdateVodSource: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  const vodSourceName = requireString(input, "VodSourceName");
  const existing = requireVodSource(ctx, sourceLocationName, vodSourceName);
  const updated: StoredVodSource = {
    ...existing,
    HttpPackageConfigurations: Array.isArray(input["HttpPackageConfigurations"])
      ? (input["HttpPackageConfigurations"] as unknown[])
      : existing.HttpPackageConfigurations,
    LastModifiedTime: now(),
  };
  ctx.store.set(vodSourceKey(sourceLocationName, vodSourceName), updated);
  return vodSourceView(updated);
};

const ListVodSources: OperationHandler = (input, ctx) => {
  const sourceLocationName = requireString(input, "SourceLocationName");
  requireSourceLocation(ctx, sourceLocationName);
  const prefix = vodSourceKey(sourceLocationName, "");
  const items = ctx.store
    .list<StoredVodSource>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => vodSourceView(e.value))
    .sort((a, b) =>
      String(a["VodSourceName"]) < String(b["VodSourceName"]) ? -1 : 1,
    );
  const { page, nextToken } = paginateItems(
    items,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Items: page, NextToken: nextToken };
};

const CreatePrefetchSchedule: OperationHandler = (input, ctx) => {
  const playbackConfigurationName = requireString(
    input,
    "PlaybackConfigurationName",
  );
  const name = requireString(input, "Name");
  const t = now();
  const ps: StoredPrefetchSchedule = {
    Arn: prefetchScheduleArn(ctx, playbackConfigurationName, name),
    Consumption: recordOrUndefined(input["Consumption"]),
    Name: name,
    PlaybackConfigurationName: playbackConfigurationName,
    Retrieval: recordOrUndefined(input["Retrieval"]),
    RecurringPrefetchConfiguration: recordOrUndefined(
      input["RecurringPrefetchConfiguration"],
    ),
    ScheduleType: stringOrUndefined(input["ScheduleType"]),
    StreamId: stringOrUndefined(input["StreamId"]),
    Tags: stringRecordOrUndefined(input["Tags"]),
  };
  ctx.store.set(prefetchScheduleKey(playbackConfigurationName, name), ps);
  return prefetchScheduleView(ps);
};

const DeletePrefetchSchedule: OperationHandler = (input, ctx) => {
  const playbackConfigurationName = requireString(
    input,
    "PlaybackConfigurationName",
  );
  const name = requireString(input, "Name");
  requirePrefetchSchedule(ctx, playbackConfigurationName, name);
  ctx.store.delete(prefetchScheduleKey(playbackConfigurationName, name));
  return {};
};

const GetPrefetchSchedule: OperationHandler = (input, ctx) => {
  const playbackConfigurationName = requireString(
    input,
    "PlaybackConfigurationName",
  );
  const name = requireString(input, "Name");
  return prefetchScheduleView(
    requirePrefetchSchedule(ctx, playbackConfigurationName, name),
  );
};

const ListPrefetchSchedules: OperationHandler = (input, ctx) => {
  const playbackConfigurationName = requireString(
    input,
    "PlaybackConfigurationName",
  );
  const prefix = prefetchScheduleKey(playbackConfigurationName, "");
  const items = ctx.store
    .list<StoredPrefetchSchedule>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => prefetchScheduleView(e.value))
    .sort((a, b) => (String(a["Name"]) < String(b["Name"]) ? -1 : 1));
  const { page, nextToken } = paginateItems(
    items,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Items: page, NextToken: nextToken };
};

const PutFunction: OperationHandler = (input, ctx) => {
  const functionId = requireString(input, "FunctionId");
  const functionType = requireString(input, "FunctionType");
  const fn: StoredFunction = {
    FunctionId: functionId,
    FunctionType: functionType,
    Description: stringOrUndefined(input["Description"]),
    HttpRequestConfiguration: recordOrUndefined(
      input["HttpRequestConfiguration"],
    ),
    CustomOutputConfiguration: recordOrUndefined(
      input["CustomOutputConfiguration"],
    ),
    SequentialExecutorConfiguration: recordOrUndefined(
      input["SequentialExecutorConfiguration"],
    ),
    Tags: stringRecordOrUndefined(input["Tags"]),
    Arn: functionArn(ctx, functionId),
  };
  ctx.store.set(functionKey(functionId), fn);
  return functionView(fn);
};

const GetFunction: OperationHandler = (input, ctx) => {
  const functionId = requireString(input, "FunctionId");
  return functionView(requireFunction(ctx, functionId));
};

const DeleteFunction: OperationHandler = (input, ctx) => {
  const functionId = requireString(input, "FunctionId");
  const fn = requireFunction(ctx, functionId);
  const referencedByConfig = ctx.store
    .list<StoredConfiguration>()
    .some(
      (e) =>
        e.key.startsWith(configurationPrefix) &&
        JSON.stringify(e.value).includes(fn.Arn),
    );
  if (referencedByConfig) {
    throw awsError(
      "ResourceInUseException",
      `Function ${functionId} is referenced by a playback configuration. Update the configuration before deleting the function.`,
      409,
    );
  }
  ctx.store.delete(functionKey(functionId));
  ctx.store.delete(tagsKey(fn.Arn));
  return {};
};

const ListFunctions: OperationHandler = (input, ctx) => {
  const items = ctx.store
    .list<StoredFunction>()
    .filter((e) => e.key.startsWith(functionPrefix))
    .map((e) => functionView(e.value))
    .sort((a, b) =>
      String(a["FunctionId"]) < String(b["FunctionId"]) ? -1 : 1,
    );
  const { page, nextToken } = paginateItems(
    items,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Items: page, NextToken: nextToken };
};

const ListAlerts: OperationHandler = (input, _ctx) => {
  requireString(input, "ResourceArn");
  const { page, nextToken } = paginateItems(
    [],
    input["MaxResults"],
    input["NextToken"],
  );
  return { Items: page, NextToken: nextToken };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const stored = ctx.store.get<Record<string, string>>(tagsKey(resourceArn));
  return { Tags: stored ?? {} };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const newTags = stringRecordOrUndefined(input["Tags"]) ?? {};
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  ctx.store.set(tagsKey(resourceArn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tagKeys = stringArrayOrUndefined(input["TagKeys"]) ?? [];
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  const updated = { ...existing };
  for (const key of tagKeys) {
    delete updated[key];
  }
  ctx.store.set(tagsKey(resourceArn), updated);
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const mediatailor = {
  name: "mediatailor",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts.length === 0) return undefined;

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

    if (parts[0] === "configureLogs" && parts.length === 2) {
      if (req.method !== "PUT") return undefined;
      if (parts[1] === "channel") return "ConfigureLogsForChannel";
      if (parts[1] === "playbackConfiguration")
        return "ConfigureLogsForPlaybackConfiguration";
      return undefined;
    }

    if (parts[0] === "channel") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateChannel";
        if (req.method === "DELETE") return "DeleteChannel";
        if (req.method === "GET") return "DescribeChannel";
        if (req.method === "PUT") return "UpdateChannel";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "policy") {
          if (req.method === "GET") return "GetChannelPolicy";
          if (req.method === "PUT") return "PutChannelPolicy";
          if (req.method === "DELETE") return "DeleteChannelPolicy";
          return undefined;
        }
        if (parts[2] === "schedule" && req.method === "GET")
          return "GetChannelSchedule";
        if (parts[2] === "start" && req.method === "PUT") return "StartChannel";
        if (parts[2] === "stop" && req.method === "PUT") return "StopChannel";
        return undefined;
      }
      if (parts.length === 4 && parts[2] === "program") {
        if (req.method === "POST") return "CreateProgram";
        if (req.method === "DELETE") return "DeleteProgram";
        if (req.method === "GET") return "DescribeProgram";
        if (req.method === "PUT") return "UpdateProgram";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "channels" && parts.length === 1) {
      if (req.method === "GET") return "ListChannels";
      return undefined;
    }

    if (parts[0] === "sourceLocation") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateSourceLocation";
        if (req.method === "DELETE") return "DeleteSourceLocation";
        if (req.method === "GET") return "DescribeSourceLocation";
        if (req.method === "PUT") return "UpdateSourceLocation";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "liveSources" && req.method === "GET")
          return "ListLiveSources";
        if (parts[2] === "vodSources" && req.method === "GET")
          return "ListVodSources";
        return undefined;
      }
      if (parts.length === 4) {
        if (parts[2] === "liveSource") {
          if (req.method === "POST") return "CreateLiveSource";
          if (req.method === "DELETE") return "DeleteLiveSource";
          if (req.method === "GET") return "DescribeLiveSource";
          if (req.method === "PUT") return "UpdateLiveSource";
          return undefined;
        }
        if (parts[2] === "vodSource") {
          if (req.method === "POST") return "CreateVodSource";
          if (req.method === "DELETE") return "DeleteVodSource";
          if (req.method === "GET") return "DescribeVodSource";
          if (req.method === "PUT") return "UpdateVodSource";
          return undefined;
        }
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "sourceLocations" && parts.length === 1) {
      if (req.method === "GET") return "ListSourceLocations";
      return undefined;
    }

    if (parts[0] === "prefetchSchedule") {
      if (parts.length === 2 && req.method === "POST")
        return "ListPrefetchSchedules";
      if (parts.length === 3) {
        if (req.method === "POST") return "CreatePrefetchSchedule";
        if (req.method === "DELETE") return "DeletePrefetchSchedule";
        if (req.method === "GET") return "GetPrefetchSchedule";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "function" && parts.length === 2) {
      if (req.method === "DELETE") return "DeleteFunction";
      if (req.method === "GET") return "GetFunction";
      if (req.method === "PUT") return "PutFunction";
      return undefined;
    }

    if (parts[0] === "functions" && parts.length === 1) {
      if (req.method === "GET") return "ListFunctions";
      return undefined;
    }

    if (parts[0] === "alerts" && parts.length === 1) {
      if (req.method === "GET") return "ListAlerts";
      return undefined;
    }

    if (parts[0] === "tags" && parts.length === 2) {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }

    return undefined;
  },
  operations: {
    PutPlaybackConfiguration,
    GetPlaybackConfiguration,
    ListPlaybackConfigurations,
    DeletePlaybackConfiguration,
    ConfigureLogsForChannel,
    ConfigureLogsForPlaybackConfiguration,
    CreateChannel,
    DeleteChannel,
    DescribeChannel,
    UpdateChannel,
    GetChannelPolicy,
    PutChannelPolicy,
    DeleteChannelPolicy,
    GetChannelSchedule,
    StartChannel,
    StopChannel,
    ListChannels,
    CreateProgram,
    DeleteProgram,
    DescribeProgram,
    UpdateProgram,
    CreateSourceLocation,
    DeleteSourceLocation,
    DescribeSourceLocation,
    UpdateSourceLocation,
    ListSourceLocations,
    CreateLiveSource,
    DeleteLiveSource,
    DescribeLiveSource,
    UpdateLiveSource,
    ListLiveSources,
    CreateVodSource,
    DeleteVodSource,
    DescribeVodSource,
    UpdateVodSource,
    ListVodSources,
    CreatePrefetchSchedule,
    DeletePrefetchSchedule,
    GetPrefetchSchedule,
    ListPrefetchSchedules,
    PutFunction,
    GetFunction,
    DeleteFunction,
    ListFunctions,
    ListAlerts,
    ListTagsForResource,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default mediatailor;
