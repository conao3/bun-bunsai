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
const inputPrefix = "input:" as const;
const inputSgPrefix = "inputsg:" as const;
const multiplexPrefix = "multiplex:" as const;
const mxProgramPrefix = "mxprog:" as const;
const inputDevicePrefix = "inputdevice:" as const;
const offeringPrefix = "offering:" as const;
const reservationPrefix = "reservation:" as const;
const schedulePrefix = "schedule:" as const;
const transferPrefix = "transfer:" as const;
const tagsPrefix = "tags:" as const;
const accountConfigKey = "accountConfig" as const;
const cwAlarmTemplatePrefix = "cwalarmtempl:" as const;
const cwAlarmTemplateGroupPrefix = "cwalarmtemplgrp:" as const;
const ebRuleTemplatePrefix = "ebruletempl:" as const;
const ebRuleTemplateGroupPrefix = "ebruletemplgrp:" as const;
const signalMapPrefix = "signalmap:" as const;
const sdiSourcePrefix = "sdiSource:" as const;
const channelPlacementGroupPrefix = "channelPlacementGroup:" as const;
const clusterPrefix = "cluster:" as const;
const nodePrefix = "node:" as const;

type StoredChannel = {
  Id: string;
  Arn: string;
  Name: string;
  State: string;
  ChannelClass: string;
  Tags: Record<string, unknown>;
};

type StoredInput = {
  Id: string;
  Arn: string;
  Name: string;
  State: string;
  Type: string;
  AttachedChannels: string[];
  SecurityGroups: string[];
  Tags: Record<string, unknown>;
};

type StoredInputSecurityGroup = {
  Id: string;
  Arn: string;
  State: string;
  Inputs: string[];
  Tags: Record<string, unknown>;
  WhitelistRules: { Cidr: string }[];
};

type StoredMultiplex = {
  Id: string;
  Arn: string;
  Name: string;
  State: string;
  AvailabilityZones: string[];
  Tags: Record<string, unknown>;
  PipelinesRunningCount: number;
  ProgramCount: number;
};

type StoredMultiplexProgram = {
  ProgramName: string;
  MultiplexId: string;
  ChannelId: string;
};

type StoredInputDevice = {
  Id: string;
  Arn: string;
  Name: string;
  ConnectionState: string;
  DeviceSettingsSyncState: string;
  DeviceUpdateStatus: string;
  Type: string;
  MacAddress: string;
  SerialNumber: string;
};

type StoredOffering = {
  OfferingId: string;
  Arn: string;
  OfferingDescription: string;
  OfferingType: string;
  CurrencyCode: string;
  Duration: number;
  DurationUnits: string;
  FixedPrice: number;
  UsagePrice: number;
  Region: string;
  ResourceSpecification: Record<string, unknown>;
};

type StoredReservation = {
  ReservationId: string;
  Arn: string;
  Name: string;
  OfferingId: string;
  OfferingDescription: string;
  OfferingType: string;
  CurrencyCode: string;
  Duration: number;
  DurationUnits: string;
  FixedPrice: number;
  UsagePrice: number;
  Region: string;
  ResourceSpecification: Record<string, unknown>;
  State: string;
  Tags: Record<string, unknown>;
  Count: number;
  Start: string;
  End: string;
  RenewalSettings: Record<string, unknown>;
};

type StoredTransfer = {
  InputDeviceId: string;
  TargetCustomerId: string;
  TransferType: string;
  Message: string;
};

type StoredCloudWatchAlarmTemplate = {
  Id: string;
  Arn: string;
  Name: string;
  Description: string;
  GroupId: string;
  ComparisonOperator: string;
  DatapointsToAlarm: number;
  EvaluationPeriods: number;
  MetricName: string;
  Period: number;
  Statistic: string;
  TargetResourceType: string;
  Threshold: number;
  TreatMissingData: string;
  Tags: Record<string, unknown>;
  CreatedAt: string;
  ModifiedAt: string;
};

type StoredCloudWatchAlarmTemplateGroup = {
  Id: string;
  Arn: string;
  Name: string;
  Description: string;
  Tags: Record<string, unknown>;
  CreatedAt: string;
  ModifiedAt: string;
};

type StoredEventBridgeRuleTemplate = {
  Id: string;
  Arn: string;
  Name: string;
  Description: string;
  GroupId: string;
  EventType: string;
  EventTargets: unknown[];
  Tags: Record<string, unknown>;
  CreatedAt: string;
  ModifiedAt: string;
};

type StoredEventBridgeRuleTemplateGroup = {
  Id: string;
  Arn: string;
  Name: string;
  Description: string;
  Tags: Record<string, unknown>;
  CreatedAt: string;
  ModifiedAt: string;
};

type StoredSignalMap = {
  Id: string;
  Arn: string;
  Name: string;
  Description: string;
  DiscoveryEntryPointArn: string;
  Status: string;
  CloudWatchAlarmTemplateGroupIds: string[];
  EventBridgeRuleTemplateGroupIds: string[];
  MonitorChangesPendingDeployment: boolean;
  Tags: Record<string, unknown>;
  CreatedAt: string;
  ModifiedAt: string;
};

type StoredSdiSource = {
  Id: string;
  Arn: string;
  Name: string;
  State: string;
  Type: string;
  Mode: string;
  Inputs: string[];
};

type StoredChannelPlacementGroup = {
  Id: string;
  Arn: string;
  Name: string;
  State: string;
  ClusterId: string;
  Nodes: string[];
  Channels: string[];
};

type StoredCluster = {
  Id: string;
  Arn: string;
  ChannelIds: string[];
  ClusterType: string;
  InstanceRoleArn: string;
  Name: string;
  NetworkSettings: {
    DefaultRoute: string;
    InterfaceMappings: { LogicalInterfaceName: string; NetworkId: string }[];
  };
  State: string;
};

type StoredNode = {
  Id: string;
  Arn: string;
  ChannelPlacementGroups: string[];
  ClusterId: string;
  ConnectionState: string;
  InstanceArn: string;
  Name: string;
  NodeInterfaceMappings: {
    LogicalInterfaceName: string;
    NetworkInterfaceMode: string;
    PhysicalInterfaceName: string;
  }[];
  Role: string;
  State: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrEmpty = (value: unknown): Record<string, unknown> =>
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
    throw awsError("BadRequestException", `${field} is required.`, 400);
  }
  return value;
};

const channelKey = (id: string): string => `${channelPrefix}${id}`;
const inputKey = (id: string): string => `${inputPrefix}${id}`;
const inputSgKey = (id: string): string => `${inputSgPrefix}${id}`;
const multiplexKey = (id: string): string => `${multiplexPrefix}${id}`;
const mxProgramKey = (mxId: string, name: string): string =>
  `${mxProgramPrefix}${mxId}:${name}`;
const inputDeviceKey = (id: string): string => `${inputDevicePrefix}${id}`;
const offeringKey = (id: string): string => `${offeringPrefix}${id}`;
const reservationKey = (id: string): string => `${reservationPrefix}${id}`;
const scheduleKey = (channelId: string): string =>
  `${schedulePrefix}${channelId}`;
const transferKey = (id: string): string => `${transferPrefix}${id}`;
const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;
const cwAlarmTemplateKey = (id: string): string =>
  `${cwAlarmTemplatePrefix}${id}`;
const cwAlarmTemplateGroupKey = (id: string): string =>
  `${cwAlarmTemplateGroupPrefix}${id}`;
const ebRuleTemplateKey = (id: string): string =>
  `${ebRuleTemplatePrefix}${id}`;
const ebRuleTemplateGroupKey = (id: string): string =>
  `${ebRuleTemplateGroupPrefix}${id}`;
const signalMapKey = (id: string): string => `${signalMapPrefix}${id}`;
const sdiSourceKey = (id: string): string => `${sdiSourcePrefix}${id}`;
const channelPlacementGroupKey = (clusterId: string, id: string): string =>
  `${channelPlacementGroupPrefix}${clusterId}:${id}`;
const clusterKey = (id: string): string => `${clusterPrefix}${id}`;
const nodeKey = (clusterId: string, nodeId: string): string =>
  `${nodePrefix}${clusterId}:${nodeId}`;

const channelArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:channel:${id}`;

const inputArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:input:${id}`;

const inputSgArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:inputSecurityGroup:${id}`;

const multiplexArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:multiplex:${id}`;

const inputDeviceArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:inputDevice:${id}`;

const offeringArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:offering:${id}`;

const reservationArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:reservation:${id}`;

const cwAlarmTemplateArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:cloudwatch-alarm-template:${id}`;

const cwAlarmTemplateGroupArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:cloudwatch-alarm-template-group:${id}`;

const ebRuleTemplateArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:eventbridge-rule-template:${id}`;

const ebRuleTemplateGroupArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:eventbridge-rule-template-group:${id}`;

const signalMapArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:signal-map:${id}`;

const sdiSourceArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:sdiSource:${id}`;

const channelPlacementGroupArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:channelPlacementGroup:${id}`;

const clusterArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:cluster:${id}`;

const nodeArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:medialive:${ctx.region}:${ctx.account}:node:${id}`;

const nextChannelId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredChannel>()
    .filter((entry) => entry.key.startsWith(channelPrefix)).length;
  return String(1000000 + used + 1);
};

const nextInputId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredInput>()
    .filter((entry) => entry.key.startsWith(inputPrefix)).length;
  return String(2000000 + used + 1);
};

const nextInputSgId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredInputSecurityGroup>()
    .filter((entry) => entry.key.startsWith(inputSgPrefix)).length;
  return String(3000000 + used + 1);
};

const nextMultiplexId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredMultiplex>()
    .filter((entry) => entry.key.startsWith(multiplexPrefix)).length;
  return String(4000000 + used + 1);
};

const nextReservationId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredReservation>()
    .filter((entry) => entry.key.startsWith(reservationPrefix)).length;
  return String(5000000 + used + 1);
};

const nextCwAlarmTemplateId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredCloudWatchAlarmTemplate>()
    .filter((entry) => entry.key.startsWith(cwAlarmTemplatePrefix)).length;
  return String(6000000 + used + 1);
};

const nextCwAlarmTemplateGroupId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredCloudWatchAlarmTemplateGroup>()
    .filter((entry) => entry.key.startsWith(cwAlarmTemplateGroupPrefix)).length;
  return String(7000000 + used + 1);
};

const nextEbRuleTemplateId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredEventBridgeRuleTemplate>()
    .filter((entry) => entry.key.startsWith(ebRuleTemplatePrefix)).length;
  return String(8000000 + used + 1);
};

const nextEbRuleTemplateGroupId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredEventBridgeRuleTemplateGroup>()
    .filter((entry) => entry.key.startsWith(ebRuleTemplateGroupPrefix)).length;
  return String(9000000 + used + 1);
};

const nextSignalMapId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredSignalMap>()
    .filter((entry) => entry.key.startsWith(signalMapPrefix)).length;
  return String(10000000 + used + 1);
};

const nextSdiSourceId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredSdiSource>()
    .filter((entry) => entry.key.startsWith(sdiSourcePrefix)).length;
  return String(11000000 + used + 1);
};

const nextChannelPlacementGroupId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredChannelPlacementGroup>()
    .filter((entry) =>
      entry.key.startsWith(channelPlacementGroupPrefix),
    ).length;
  return String(12000000 + used + 1);
};

const nextClusterId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith(clusterPrefix)).length;
  return String(13000000 + used + 1);
};

const nextNodeId = (ctx: ServiceContext): string => {
  const used = ctx.store
    .list<StoredNode>()
    .filter((entry) => entry.key.startsWith(nodePrefix)).length;
  return String(14000000 + used + 1);
};

const requireChannel = (ctx: ServiceContext, id: string): StoredChannel => {
  const stored = ctx.store.get<StoredChannel>(channelKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Channel ${id} not found.`, 404);
  }
  return stored;
};

const requireInput = (ctx: ServiceContext, id: string): StoredInput => {
  const stored = ctx.store.get<StoredInput>(inputKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Input ${id} not found.`, 404);
  }
  return stored;
};

const requireInputSg = (
  ctx: ServiceContext,
  id: string,
): StoredInputSecurityGroup => {
  const stored = ctx.store.get<StoredInputSecurityGroup>(inputSgKey(id));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `InputSecurityGroup ${id} not found.`,
      404,
    );
  }
  return stored;
};

const requireMultiplex = (ctx: ServiceContext, id: string): StoredMultiplex => {
  const stored = ctx.store.get<StoredMultiplex>(multiplexKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Multiplex ${id} not found.`, 404);
  }
  return stored;
};

const requireMxProgram = (
  ctx: ServiceContext,
  mxId: string,
  programName: string,
): StoredMultiplexProgram => {
  const stored = ctx.store.get<StoredMultiplexProgram>(
    mxProgramKey(mxId, programName),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `MultiplexProgram ${programName} not found.`,
      404,
    );
  }
  return stored;
};

const requireReservation = (
  ctx: ServiceContext,
  id: string,
): StoredReservation => {
  const stored = ctx.store.get<StoredReservation>(reservationKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Reservation ${id} not found.`, 404);
  }
  return stored;
};

const requireCwAlarmTemplate = (
  ctx: ServiceContext,
  identifier: string,
): StoredCloudWatchAlarmTemplate => {
  const stored = ctx.store.get<StoredCloudWatchAlarmTemplate>(
    cwAlarmTemplateKey(identifier),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `CloudWatchAlarmTemplate ${identifier} not found.`,
      404,
    );
  }
  return stored;
};

const requireCwAlarmTemplateGroup = (
  ctx: ServiceContext,
  identifier: string,
): StoredCloudWatchAlarmTemplateGroup => {
  const stored = ctx.store.get<StoredCloudWatchAlarmTemplateGroup>(
    cwAlarmTemplateGroupKey(identifier),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `CloudWatchAlarmTemplateGroup ${identifier} not found.`,
      404,
    );
  }
  return stored;
};

const requireEbRuleTemplate = (
  ctx: ServiceContext,
  identifier: string,
): StoredEventBridgeRuleTemplate => {
  const stored = ctx.store.get<StoredEventBridgeRuleTemplate>(
    ebRuleTemplateKey(identifier),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `EventBridgeRuleTemplate ${identifier} not found.`,
      404,
    );
  }
  return stored;
};

const requireEbRuleTemplateGroup = (
  ctx: ServiceContext,
  identifier: string,
): StoredEventBridgeRuleTemplateGroup => {
  const stored = ctx.store.get<StoredEventBridgeRuleTemplateGroup>(
    ebRuleTemplateGroupKey(identifier),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `EventBridgeRuleTemplateGroup ${identifier} not found.`,
      404,
    );
  }
  return stored;
};

const requireSignalMap = (
  ctx: ServiceContext,
  identifier: string,
): StoredSignalMap => {
  const stored = ctx.store.get<StoredSignalMap>(signalMapKey(identifier));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `SignalMap ${identifier} not found.`,
      404,
    );
  }
  return stored;
};

const requireSdiSource = (ctx: ServiceContext, id: string): StoredSdiSource => {
  const stored = ctx.store.get<StoredSdiSource>(sdiSourceKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `SdiSource ${id} not found.`, 404);
  }
  return stored;
};

const requireChannelPlacementGroup = (
  ctx: ServiceContext,
  clusterId: string,
  id: string,
): StoredChannelPlacementGroup => {
  const stored = ctx.store.get<StoredChannelPlacementGroup>(
    channelPlacementGroupKey(clusterId, id),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `ChannelPlacementGroup ${id} not found.`,
      404,
    );
  }
  return stored;
};

const requireCluster = (ctx: ServiceContext, id: string): StoredCluster => {
  const stored = ctx.store.get<StoredCluster>(clusterKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Cluster ${id} not found.`, 404);
  }
  return stored;
};

const requireNode = (
  ctx: ServiceContext,
  clusterId: string,
  nodeId: string,
): StoredNode => {
  const stored = ctx.store.get<StoredNode>(nodeKey(clusterId, nodeId));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Node ${nodeId} not found.`, 404);
  }
  return stored;
};

const seedOffering = (ctx: ServiceContext): StoredOffering => {
  const id = "87654321";
  const offering: StoredOffering = {
    OfferingId: id,
    Arn: offeringArn(ctx, id),
    OfferingDescription:
      "HD AVC output, max 10 Mbps, 30 fps, monthly, no upfront",
    OfferingType: "NO_UPFRONT",
    CurrencyCode: "USD",
    Duration: 1,
    DurationUnits: "MONTHS",
    FixedPrice: 0.0,
    UsagePrice: 0.1,
    Region: ctx.region,
    ResourceSpecification: {
      ChannelClass: "STANDARD",
      Codec: "AVC",
      MaximumBitrate: "MAX_10_MBPS",
      MaximumFramerate: "MAX_30_FPS",
      Resolution: "HD",
      ResourceType: "OUTPUT",
      VideoQuality: "STANDARD",
    },
  };
  ctx.store.set(offeringKey(id), offering);
  return offering;
};

const ensureSeedOfferings = (ctx: ServiceContext): void => {
  const existing = ctx.store
    .list<StoredOffering>()
    .filter((e) => e.key.startsWith(offeringPrefix));
  if (existing.length === 0) seedOffering(ctx);
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

const StartChannel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ChannelId");
  const channel = requireChannel(ctx, id);
  const updated = { ...channel, State: "RUNNING" };
  ctx.store.set(channelKey(id), updated);
  return updated;
};

const StopChannel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ChannelId");
  const channel = requireChannel(ctx, id);
  const updated = { ...channel, State: "IDLE" };
  ctx.store.set(channelKey(id), updated);
  return updated;
};

const UpdateChannel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ChannelId");
  const channel = requireChannel(ctx, id);
  const updated: StoredChannel = {
    ...channel,
    Name: stringOrUndefined(input["Name"]) ?? channel.Name,
  };
  ctx.store.set(channelKey(id), updated);
  return { Channel: updated };
};

const UpdateChannelClass: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ChannelId");
  const channel = requireChannel(ctx, id);
  const updated: StoredChannel = {
    ...channel,
    ChannelClass:
      stringOrUndefined(input["ChannelClass"]) ?? channel.ChannelClass,
  };
  ctx.store.set(channelKey(id), updated);
  return { Channel: updated };
};

const DescribeSchedule: OperationHandler = (input, ctx) => {
  const channelId = requireString(input, "ChannelId");
  requireChannel(ctx, channelId);
  const actions = ctx.store.get<unknown[]>(scheduleKey(channelId)) ?? [];
  return { ScheduleActions: actions };
};

const DeleteSchedule: OperationHandler = (input, ctx) => {
  const channelId = requireString(input, "ChannelId");
  requireChannel(ctx, channelId);
  ctx.store.delete(scheduleKey(channelId));
  return {};
};

const BatchUpdateSchedule: OperationHandler = (input, ctx) => {
  const channelId = requireString(input, "ChannelId");
  requireChannel(ctx, channelId);
  const existing = ctx.store.get<unknown[]>(scheduleKey(channelId)) ?? [];
  const creates = recordOrEmpty(input["Creates"]);
  const newActions = arrayOrEmpty(creates["ScheduleActions"]);
  const deletes = recordOrEmpty(input["Deletes"]);
  const deleteNames = arrayOrEmpty(deletes["ActionNames"]).filter(
    (n): n is string => typeof n === "string",
  );
  const kept = existing.filter((action) => {
    const a = action as Record<string, unknown>;
    return !deleteNames.includes(a["ActionName"] as string);
  });
  const updated = [...kept, ...newActions];
  ctx.store.set(scheduleKey(channelId), updated);
  return {
    Creates: { ScheduleActions: newActions },
    Deletes: { ActionNames: deleteNames },
  };
};

const DescribeThumbnails: OperationHandler = (input, ctx) => {
  const channelId = requireString(input, "ChannelId");
  requireChannel(ctx, channelId);
  return { ThumbnailDetails: [] };
};

const RestartChannelPipelines: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ChannelId");
  const channel = requireChannel(ctx, id);
  return channel;
};

const CreateInput: OperationHandler = (input, ctx) => {
  const id = nextInputId(ctx);
  const storedInput: StoredInput = {
    Id: id,
    Arn: inputArn(ctx, id),
    Name: stringOrUndefined(input["Name"]) ?? "",
    State: "DETACHED",
    Type: stringOrUndefined(input["Type"]) ?? "UDP_PUSH",
    AttachedChannels: [],
    SecurityGroups: arrayOrEmpty(input["InputSecurityGroups"]).filter(
      (s): s is string => typeof s === "string",
    ),
    Tags: recordOrEmpty(input["Tags"]),
  };
  ctx.store.set(inputKey(id), storedInput);
  return { Input: storedInput };
};

const DescribeInput: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputId");
  return requireInput(ctx, id);
};

const ListInputs: OperationHandler = (_input, ctx) => {
  const inputs = ctx.store
    .list<StoredInput>()
    .filter((entry) => entry.key.startsWith(inputPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Id < b.Id ? -1 : a.Id > b.Id ? 1 : 0));
  return { Inputs: inputs };
};

const UpdateInput: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputId");
  const existing = requireInput(ctx, id);
  const updated: StoredInput = {
    ...existing,
    Name: stringOrUndefined(input["Name"]) ?? existing.Name,
  };
  ctx.store.set(inputKey(id), updated);
  return { Input: updated };
};

const DeleteInput: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputId");
  requireInput(ctx, id);
  ctx.store.delete(inputKey(id));
  return {};
};

const CreatePartnerInput: OperationHandler = (input, ctx) => {
  const parentId = requireString(input, "InputId");
  requireInput(ctx, parentId);
  const id = nextInputId(ctx);
  const partnerInput: StoredInput = {
    Id: id,
    Arn: inputArn(ctx, id),
    Name: `partner-${parentId}-${id}`,
    State: "DETACHED",
    Type: "PARTNER",
    AttachedChannels: [],
    SecurityGroups: [],
    Tags: recordOrEmpty(input["Tags"]),
  };
  ctx.store.set(inputKey(id), partnerInput);
  return { Input: partnerInput };
};

const CreateInputSecurityGroup: OperationHandler = (input, ctx) => {
  const id = nextInputSgId(ctx);
  const rules = arrayOrEmpty(input["WhitelistRules"]).map((r) => {
    const rule = recordOrEmpty(r);
    return { Cidr: stringOrUndefined(rule["Cidr"]) ?? "0.0.0.0/0" };
  });
  const isg: StoredInputSecurityGroup = {
    Id: id,
    Arn: inputSgArn(ctx, id),
    State: "IDLE",
    Inputs: [],
    Tags: recordOrEmpty(input["Tags"]),
    WhitelistRules: rules,
  };
  ctx.store.set(inputSgKey(id), isg);
  return { SecurityGroup: isg };
};

const DescribeInputSecurityGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputSecurityGroupId");
  return requireInputSg(ctx, id);
};

const ListInputSecurityGroups: OperationHandler = (_input, ctx) => {
  const groups = ctx.store
    .list<StoredInputSecurityGroup>()
    .filter((entry) => entry.key.startsWith(inputSgPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Id < b.Id ? -1 : a.Id > b.Id ? 1 : 0));
  return { InputSecurityGroups: groups };
};

const UpdateInputSecurityGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputSecurityGroupId");
  const existing = requireInputSg(ctx, id);
  const rules = Array.isArray(input["WhitelistRules"])
    ? arrayOrEmpty(input["WhitelistRules"]).map((r) => {
        const rule = recordOrEmpty(r);
        return { Cidr: stringOrUndefined(rule["Cidr"]) ?? "0.0.0.0/0" };
      })
    : existing.WhitelistRules;
  const updated: StoredInputSecurityGroup = {
    ...existing,
    Tags:
      input["Tags"] !== undefined
        ? recordOrEmpty(input["Tags"])
        : existing.Tags,
    WhitelistRules: rules,
  };
  ctx.store.set(inputSgKey(id), updated);
  return { SecurityGroup: updated };
};

const DeleteInputSecurityGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputSecurityGroupId");
  requireInputSg(ctx, id);
  ctx.store.delete(inputSgKey(id));
  return {};
};

const CreateMultiplex: OperationHandler = (input, ctx) => {
  const id = nextMultiplexId(ctx);
  const zones = arrayOrEmpty(input["AvailabilityZones"]).filter(
    (z): z is string => typeof z === "string",
  );
  const mx: StoredMultiplex = {
    Id: id,
    Arn: multiplexArn(ctx, id),
    Name: stringOrUndefined(input["Name"]) ?? "",
    State: "IDLE",
    AvailabilityZones: zones,
    Tags: recordOrEmpty(input["Tags"]),
    PipelinesRunningCount: 0,
    ProgramCount: 0,
  };
  ctx.store.set(multiplexKey(id), mx);
  return { Multiplex: mx };
};

const DescribeMultiplex: OperationHandler = (input, ctx) => {
  const id = requireString(input, "MultiplexId");
  return requireMultiplex(ctx, id);
};

const ListMultiplexes: OperationHandler = (_input, ctx) => {
  const multiplexes = ctx.store
    .list<StoredMultiplex>()
    .filter((entry) => entry.key.startsWith(multiplexPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Id < b.Id ? -1 : a.Id > b.Id ? 1 : 0));
  return { Multiplexes: multiplexes };
};

const UpdateMultiplex: OperationHandler = (input, ctx) => {
  const id = requireString(input, "MultiplexId");
  const existing = requireMultiplex(ctx, id);
  const updated: StoredMultiplex = {
    ...existing,
    Name: stringOrUndefined(input["Name"]) ?? existing.Name,
  };
  ctx.store.set(multiplexKey(id), updated);
  return { Multiplex: updated };
};

const DeleteMultiplex: OperationHandler = (input, ctx) => {
  const id = requireString(input, "MultiplexId");
  const mx = requireMultiplex(ctx, id);
  ctx.store.delete(multiplexKey(id));
  return { ...mx, State: "DELETING" };
};

const StartMultiplex: OperationHandler = (input, ctx) => {
  const id = requireString(input, "MultiplexId");
  const mx = requireMultiplex(ctx, id);
  const updated = { ...mx, State: "RUNNING" };
  ctx.store.set(multiplexKey(id), updated);
  return updated;
};

const StopMultiplex: OperationHandler = (input, ctx) => {
  const id = requireString(input, "MultiplexId");
  const mx = requireMultiplex(ctx, id);
  const updated = { ...mx, State: "IDLE" };
  ctx.store.set(multiplexKey(id), updated);
  return updated;
};

const CreateMultiplexProgram: OperationHandler = (input, ctx) => {
  const mxId = requireString(input, "MultiplexId");
  requireMultiplex(ctx, mxId);
  const programName = requireString(input, "ProgramName");
  const prog: StoredMultiplexProgram = {
    ProgramName: programName,
    MultiplexId: mxId,
    ChannelId: "",
  };
  ctx.store.set(mxProgramKey(mxId, programName), prog);
  const mx = requireMultiplex(ctx, mxId);
  ctx.store.set(multiplexKey(mxId), {
    ...mx,
    ProgramCount: mx.ProgramCount + 1,
  });
  return { MultiplexProgram: prog };
};

const DescribeMultiplexProgram: OperationHandler = (input, ctx) => {
  const mxId = requireString(input, "MultiplexId");
  const programName = requireString(input, "ProgramName");
  return requireMxProgram(ctx, mxId, programName);
};

const ListMultiplexPrograms: OperationHandler = (input, ctx) => {
  const mxId = requireString(input, "MultiplexId");
  requireMultiplex(ctx, mxId);
  const prefix = `${mxProgramPrefix}${mxId}:`;
  const programs = ctx.store
    .list<StoredMultiplexProgram>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.ProgramName < b.ProgramName
        ? -1
        : a.ProgramName > b.ProgramName
          ? 1
          : 0,
    );
  return { MultiplexPrograms: programs };
};

const UpdateMultiplexProgram: OperationHandler = (input, ctx) => {
  const mxId = requireString(input, "MultiplexId");
  const programName = requireString(input, "ProgramName");
  const existing = requireMxProgram(ctx, mxId, programName);
  ctx.store.set(mxProgramKey(mxId, programName), existing);
  return { MultiplexProgram: existing };
};

const DeleteMultiplexProgram: OperationHandler = (input, ctx) => {
  const mxId = requireString(input, "MultiplexId");
  const programName = requireString(input, "ProgramName");
  const prog = requireMxProgram(ctx, mxId, programName);
  ctx.store.delete(mxProgramKey(mxId, programName));
  const mx = requireMultiplex(ctx, mxId);
  ctx.store.set(multiplexKey(mxId), {
    ...mx,
    ProgramCount: Math.max(0, mx.ProgramCount - 1),
  });
  return prog;
};

const DescribeInputDevice: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputDeviceId");
  const stored = ctx.store.get<StoredInputDevice>(inputDeviceKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `InputDevice ${id} not found.`, 404);
  }
  return stored;
};

const ListInputDevices: OperationHandler = (_input, ctx) => {
  const devices = ctx.store
    .list<StoredInputDevice>()
    .filter((entry) => entry.key.startsWith(inputDevicePrefix))
    .map((entry) => entry.value);
  return { InputDevices: devices };
};

const UpdateInputDevice: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputDeviceId");
  const stored = ctx.store.get<StoredInputDevice>(inputDeviceKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `InputDevice ${id} not found.`, 404);
  }
  const updated: StoredInputDevice = {
    ...stored,
    Name: stringOrUndefined(input["Name"]) ?? stored.Name,
  };
  ctx.store.set(inputDeviceKey(id), updated);
  return updated;
};

const RebootInputDevice: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputDeviceId");
  const stored = ctx.store.get<StoredInputDevice>(inputDeviceKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `InputDevice ${id} not found.`, 404);
  }
  return {};
};

const StartInputDevice: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputDeviceId");
  const stored = ctx.store.get<StoredInputDevice>(inputDeviceKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `InputDevice ${id} not found.`, 404);
  }
  return {};
};

const StopInputDevice: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputDeviceId");
  const stored = ctx.store.get<StoredInputDevice>(inputDeviceKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `InputDevice ${id} not found.`, 404);
  }
  return {};
};

const DescribeInputDeviceThumbnail: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputDeviceId");
  const stored = ctx.store.get<StoredInputDevice>(inputDeviceKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `InputDevice ${id} not found.`, 404);
  }
  return { Body: "" };
};

const StartInputDeviceMaintenanceWindow: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputDeviceId");
  const stored = ctx.store.get<StoredInputDevice>(inputDeviceKey(id));
  if (stored === undefined) {
    throw awsError("NotFoundException", `InputDevice ${id} not found.`, 404);
  }
  return {};
};

const AcceptInputDeviceTransfer: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputDeviceId");
  const transfer = ctx.store.get<StoredTransfer>(transferKey(id));
  if (transfer === undefined) {
    throw awsError(
      "NotFoundException",
      `No pending transfer for device ${id}.`,
      404,
    );
  }
  const newDevice: StoredInputDevice = {
    Id: id,
    Arn: inputDeviceArn(ctx, id),
    Name: `device-${id}`,
    ConnectionState: "DISCONNECTED",
    DeviceSettingsSyncState: "SYNCED",
    DeviceUpdateStatus: "UP_TO_DATE",
    Type: "HD",
    MacAddress: "00:00:00:00:00:00",
    SerialNumber: id,
  };
  ctx.store.set(inputDeviceKey(id), newDevice);
  ctx.store.delete(transferKey(id));
  return {};
};

const CancelInputDeviceTransfer: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputDeviceId");
  ctx.store.delete(transferKey(id));
  return {};
};

const RejectInputDeviceTransfer: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputDeviceId");
  ctx.store.delete(transferKey(id));
  return {};
};

const TransferInputDevice: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InputDeviceId");
  const transfer: StoredTransfer = {
    InputDeviceId: id,
    TargetCustomerId: stringOrUndefined(input["TargetCustomerId"]) ?? "unknown",
    TransferType: "OUTGOING",
    Message: stringOrUndefined(input["TransferMessage"]) ?? "",
  };
  ctx.store.set(transferKey(id), transfer);
  return {};
};

const ListInputDeviceTransfers: OperationHandler = (_input, ctx) => {
  const transfers = ctx.store
    .list<StoredTransfer>()
    .filter((entry) => entry.key.startsWith(transferPrefix))
    .map((entry) => ({
      InputDeviceId: entry.value.InputDeviceId,
      TargetCustomerId: entry.value.TargetCustomerId,
      TransferType: entry.value.TransferType,
      Message: entry.value.Message,
    }));
  return { InputDeviceTransfers: transfers };
};

const ClaimDevice: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["Id"]);
  if (id !== undefined) {
    const device: StoredInputDevice = {
      Id: id,
      Arn: inputDeviceArn(ctx, id),
      Name: `device-${id}`,
      ConnectionState: "DISCONNECTED",
      DeviceSettingsSyncState: "SYNCED",
      DeviceUpdateStatus: "UP_TO_DATE",
      Type: "HD",
      MacAddress: "00:00:00:00:00:00",
      SerialNumber: id,
    };
    ctx.store.set(inputDeviceKey(id), device);
  }
  return {};
};

const ListOfferings: OperationHandler = (_input, ctx) => {
  ensureSeedOfferings(ctx);
  const offerings = ctx.store
    .list<StoredOffering>()
    .filter((entry) => entry.key.startsWith(offeringPrefix))
    .map((entry) => entry.value);
  return { Offerings: offerings };
};

const DescribeOffering: OperationHandler = (input, ctx) => {
  ensureSeedOfferings(ctx);
  const id = requireString(input, "OfferingId");
  const offering = ctx.store.get<StoredOffering>(offeringKey(id));
  if (offering === undefined) {
    throw awsError("NotFoundException", `Offering ${id} not found.`, 404);
  }
  return offering;
};

const PurchaseOffering: OperationHandler = (input, ctx) => {
  ensureSeedOfferings(ctx);
  const offeringId = requireString(input, "OfferingId");
  const offering = ctx.store.get<StoredOffering>(offeringKey(offeringId));
  if (offering === undefined) {
    throw awsError(
      "NotFoundException",
      `Offering ${offeringId} not found.`,
      404,
    );
  }
  const reservationId = nextReservationId(ctx);
  const now = new Date().toISOString();
  const end = new Date(
    Date.now() + offering.Duration * 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const reservation: StoredReservation = {
    ReservationId: reservationId,
    Arn: reservationArn(ctx, reservationId),
    Name: stringOrUndefined(input["Name"]) ?? `reservation-${reservationId}`,
    OfferingId: offeringId,
    OfferingDescription: offering.OfferingDescription,
    OfferingType: offering.OfferingType,
    CurrencyCode: offering.CurrencyCode,
    Duration: offering.Duration,
    DurationUnits: offering.DurationUnits,
    FixedPrice: offering.FixedPrice,
    UsagePrice: offering.UsagePrice,
    Region: ctx.region,
    ResourceSpecification: offering.ResourceSpecification,
    State: "ACTIVE",
    Tags: recordOrEmpty(input["Tags"]),
    Count: typeof input["Count"] === "number" ? input["Count"] : 1,
    Start: now,
    End: end,
    RenewalSettings: recordOrEmpty(input["RenewalSettings"]),
  };
  ctx.store.set(reservationKey(reservationId), reservation);
  return { Reservation: reservation };
};

const DescribeReservation: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ReservationId");
  return requireReservation(ctx, id);
};

const ListReservations: OperationHandler = (_input, ctx) => {
  const reservations = ctx.store
    .list<StoredReservation>()
    .filter((entry) => entry.key.startsWith(reservationPrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.ReservationId < b.ReservationId
        ? -1
        : a.ReservationId > b.ReservationId
          ? 1
          : 0,
    );
  return { Reservations: reservations };
};

const UpdateReservation: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ReservationId");
  const existing = requireReservation(ctx, id);
  const updated: StoredReservation = {
    ...existing,
    Name: stringOrUndefined(input["Name"]) ?? existing.Name,
    RenewalSettings:
      input["RenewalSettings"] !== undefined
        ? recordOrEmpty(input["RenewalSettings"])
        : existing.RenewalSettings,
  };
  ctx.store.set(reservationKey(id), updated);
  return { Reservation: updated };
};

const DeleteReservation: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ReservationId");
  const reservation = requireReservation(ctx, id);
  ctx.store.delete(reservationKey(id));
  return { ...reservation, State: "CANCELED" };
};

const CreateTags: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const newTags = recordOrEmpty(input["Tags"]) as Record<string, string>;
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  ctx.store.set(tagsKey(resourceArn), { ...existing, ...newTags });
  return {};
};

const DeleteTags: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tagKeys = arrayOrEmpty(input["TagKeys"]).filter(
    (k): k is string => typeof k === "string",
  );
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  const updated = { ...existing };
  for (const key of tagKeys) delete updated[key];
  ctx.store.set(tagsKey(resourceArn), updated);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  return { Tags: tags };
};

const DescribeAccountConfiguration: OperationHandler = (_input, ctx) => {
  const config = ctx.store.get<Record<string, unknown>>(accountConfigKey) ?? {};
  return { AccountConfiguration: config };
};

const UpdateAccountConfiguration: OperationHandler = (input, ctx) => {
  const newConfig = recordOrEmpty(input["AccountConfiguration"]);
  const existing =
    ctx.store.get<Record<string, unknown>>(accountConfigKey) ?? {};
  const updated = { ...existing, ...newConfig };
  ctx.store.set(accountConfigKey, updated);
  return { AccountConfiguration: updated };
};

const BatchDelete: OperationHandler = (input, ctx) => {
  const successful: Record<string, unknown>[] = [];
  const failed: Record<string, unknown>[] = [];

  for (const id of arrayOrEmpty(input["ChannelIds"]).filter(
    (s): s is string => typeof s === "string",
  )) {
    const ch = ctx.store.get<StoredChannel>(channelKey(id));
    if (ch !== undefined) {
      ctx.store.delete(channelKey(id));
      successful.push({ Id: id, Arn: ch.Arn });
    } else {
      failed.push({
        Id: id,
        Code: "NOT_FOUND",
        Message: `Channel ${id} not found`,
      });
    }
  }

  for (const id of arrayOrEmpty(input["InputIds"]).filter(
    (s): s is string => typeof s === "string",
  )) {
    const inp = ctx.store.get<StoredInput>(inputKey(id));
    if (inp !== undefined) {
      ctx.store.delete(inputKey(id));
      successful.push({ Id: id, Arn: inp.Arn });
    } else {
      failed.push({
        Id: id,
        Code: "NOT_FOUND",
        Message: `Input ${id} not found`,
      });
    }
  }

  for (const id of arrayOrEmpty(input["InputSecurityGroupIds"]).filter(
    (s): s is string => typeof s === "string",
  )) {
    const sg = ctx.store.get<StoredInputSecurityGroup>(inputSgKey(id));
    if (sg !== undefined) {
      ctx.store.delete(inputSgKey(id));
      successful.push({ Id: id, Arn: sg.Arn });
    } else {
      failed.push({
        Id: id,
        Code: "NOT_FOUND",
        Message: `InputSecurityGroup ${id} not found`,
      });
    }
  }

  for (const id of arrayOrEmpty(input["MultiplexIds"]).filter(
    (s): s is string => typeof s === "string",
  )) {
    const mx = ctx.store.get<StoredMultiplex>(multiplexKey(id));
    if (mx !== undefined) {
      ctx.store.delete(multiplexKey(id));
      successful.push({ Id: id, Arn: mx.Arn });
    } else {
      failed.push({
        Id: id,
        Code: "NOT_FOUND",
        Message: `Multiplex ${id} not found`,
      });
    }
  }

  return { Successful: successful, Failed: failed };
};

const BatchStart: OperationHandler = (input, ctx) => {
  const successful: Record<string, unknown>[] = [];
  const failed: Record<string, unknown>[] = [];

  for (const id of arrayOrEmpty(input["ChannelIds"]).filter(
    (s): s is string => typeof s === "string",
  )) {
    const ch = ctx.store.get<StoredChannel>(channelKey(id));
    if (ch !== undefined) {
      ctx.store.set(channelKey(id), { ...ch, State: "RUNNING" });
      successful.push({ Id: id, Arn: ch.Arn });
    } else {
      failed.push({
        Id: id,
        Code: "NOT_FOUND",
        Message: `Channel ${id} not found`,
      });
    }
  }

  for (const id of arrayOrEmpty(input["MultiplexIds"]).filter(
    (s): s is string => typeof s === "string",
  )) {
    const mx = ctx.store.get<StoredMultiplex>(multiplexKey(id));
    if (mx !== undefined) {
      ctx.store.set(multiplexKey(id), { ...mx, State: "RUNNING" });
      successful.push({ Id: id, Arn: mx.Arn });
    } else {
      failed.push({
        Id: id,
        Code: "NOT_FOUND",
        Message: `Multiplex ${id} not found`,
      });
    }
  }

  return { Successful: successful, Failed: failed };
};

const BatchStop: OperationHandler = (input, ctx) => {
  const successful: Record<string, unknown>[] = [];
  const failed: Record<string, unknown>[] = [];

  for (const id of arrayOrEmpty(input["ChannelIds"]).filter(
    (s): s is string => typeof s === "string",
  )) {
    const ch = ctx.store.get<StoredChannel>(channelKey(id));
    if (ch !== undefined) {
      ctx.store.set(channelKey(id), { ...ch, State: "IDLE" });
      successful.push({ Id: id, Arn: ch.Arn });
    } else {
      failed.push({
        Id: id,
        Code: "NOT_FOUND",
        Message: `Channel ${id} not found`,
      });
    }
  }

  for (const id of arrayOrEmpty(input["MultiplexIds"]).filter(
    (s): s is string => typeof s === "string",
  )) {
    const mx = ctx.store.get<StoredMultiplex>(multiplexKey(id));
    if (mx !== undefined) {
      ctx.store.set(multiplexKey(id), { ...mx, State: "IDLE" });
      successful.push({ Id: id, Arn: mx.Arn });
    } else {
      failed.push({
        Id: id,
        Code: "NOT_FOUND",
        Message: `Multiplex ${id} not found`,
      });
    }
  }

  return { Successful: successful, Failed: failed };
};

const nowIso = (): string => new Date().toISOString();

const CreateCloudWatchAlarmTemplateGroup: OperationHandler = (input, ctx) => {
  const id = nextCwAlarmTemplateGroupId(ctx);
  const now = nowIso();
  const group: StoredCloudWatchAlarmTemplateGroup = {
    Id: id,
    Arn: cwAlarmTemplateGroupArn(ctx, id),
    Name: requireString(input, "Name"),
    Description: stringOrUndefined(input["Description"]) ?? "",
    Tags: recordOrEmpty(input["Tags"]),
    CreatedAt: now,
    ModifiedAt: now,
  };
  ctx.store.set(cwAlarmTemplateGroupKey(id), group);
  return group;
};

const GetCloudWatchAlarmTemplateGroup: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  return requireCwAlarmTemplateGroup(ctx, identifier);
};

const ListCloudWatchAlarmTemplateGroups: OperationHandler = (_input, ctx) => {
  const groups = ctx.store
    .list<StoredCloudWatchAlarmTemplateGroup>()
    .filter((e) => e.key.startsWith(cwAlarmTemplateGroupPrefix))
    .map((e) => e.value);
  return { CloudWatchAlarmTemplateGroups: groups };
};

const UpdateCloudWatchAlarmTemplateGroup: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  const group = requireCwAlarmTemplateGroup(ctx, identifier);
  const updated: StoredCloudWatchAlarmTemplateGroup = {
    ...group,
    Description: stringOrUndefined(input["Description"]) ?? group.Description,
    ModifiedAt: nowIso(),
  };
  ctx.store.set(cwAlarmTemplateGroupKey(identifier), updated);
  return updated;
};

const DeleteCloudWatchAlarmTemplateGroup: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  requireCwAlarmTemplateGroup(ctx, identifier);
  ctx.store.delete(cwAlarmTemplateGroupKey(identifier));
  return {};
};

const CreateCloudWatchAlarmTemplate: OperationHandler = (input, ctx) => {
  const id = nextCwAlarmTemplateId(ctx);
  const groupIdentifier = requireString(input, "GroupIdentifier");
  const group = requireCwAlarmTemplateGroup(ctx, groupIdentifier);
  const now = nowIso();
  const template: StoredCloudWatchAlarmTemplate = {
    Id: id,
    Arn: cwAlarmTemplateArn(ctx, id),
    Name: requireString(input, "Name"),
    Description: stringOrUndefined(input["Description"]) ?? "",
    GroupId: group.Id,
    ComparisonOperator: requireString(input, "ComparisonOperator"),
    DatapointsToAlarm:
      typeof input["DatapointsToAlarm"] === "number"
        ? input["DatapointsToAlarm"]
        : 1,
    EvaluationPeriods:
      typeof input["EvaluationPeriods"] === "number"
        ? input["EvaluationPeriods"]
        : 1,
    MetricName: requireString(input, "MetricName"),
    Period: typeof input["Period"] === "number" ? input["Period"] : 60,
    Statistic: requireString(input, "Statistic"),
    TargetResourceType: requireString(input, "TargetResourceType"),
    Threshold: typeof input["Threshold"] === "number" ? input["Threshold"] : 0,
    TreatMissingData: requireString(input, "TreatMissingData"),
    Tags: recordOrEmpty(input["Tags"]),
    CreatedAt: now,
    ModifiedAt: now,
  };
  ctx.store.set(cwAlarmTemplateKey(id), template);
  return template;
};

const GetCloudWatchAlarmTemplate: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  return requireCwAlarmTemplate(ctx, identifier);
};

const ListCloudWatchAlarmTemplates: OperationHandler = (_input, ctx) => {
  const templates = ctx.store
    .list<StoredCloudWatchAlarmTemplate>()
    .filter((e) => e.key.startsWith(cwAlarmTemplatePrefix))
    .map((e) => e.value);
  return { CloudWatchAlarmTemplates: templates };
};

const UpdateCloudWatchAlarmTemplate: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  const template = requireCwAlarmTemplate(ctx, identifier);
  const updated: StoredCloudWatchAlarmTemplate = {
    ...template,
    Name: stringOrUndefined(input["Name"]) ?? template.Name,
    Description:
      stringOrUndefined(input["Description"]) ?? template.Description,
    ComparisonOperator:
      stringOrUndefined(input["ComparisonOperator"]) ??
      template.ComparisonOperator,
    MetricName: stringOrUndefined(input["MetricName"]) ?? template.MetricName,
    Statistic: stringOrUndefined(input["Statistic"]) ?? template.Statistic,
    TargetResourceType:
      stringOrUndefined(input["TargetResourceType"]) ??
      template.TargetResourceType,
    TreatMissingData:
      stringOrUndefined(input["TreatMissingData"]) ?? template.TreatMissingData,
    DatapointsToAlarm:
      typeof input["DatapointsToAlarm"] === "number"
        ? input["DatapointsToAlarm"]
        : template.DatapointsToAlarm,
    EvaluationPeriods:
      typeof input["EvaluationPeriods"] === "number"
        ? input["EvaluationPeriods"]
        : template.EvaluationPeriods,
    Period:
      typeof input["Period"] === "number" ? input["Period"] : template.Period,
    Threshold:
      typeof input["Threshold"] === "number"
        ? input["Threshold"]
        : template.Threshold,
    ModifiedAt: nowIso(),
  };
  ctx.store.set(cwAlarmTemplateKey(identifier), updated);
  return updated;
};

const DeleteCloudWatchAlarmTemplate: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  requireCwAlarmTemplate(ctx, identifier);
  ctx.store.delete(cwAlarmTemplateKey(identifier));
  return {};
};

const CreateEventBridgeRuleTemplateGroup: OperationHandler = (input, ctx) => {
  const id = nextEbRuleTemplateGroupId(ctx);
  const now = nowIso();
  const group: StoredEventBridgeRuleTemplateGroup = {
    Id: id,
    Arn: ebRuleTemplateGroupArn(ctx, id),
    Name: requireString(input, "Name"),
    Description: stringOrUndefined(input["Description"]) ?? "",
    Tags: recordOrEmpty(input["Tags"]),
    CreatedAt: now,
    ModifiedAt: now,
  };
  ctx.store.set(ebRuleTemplateGroupKey(id), group);
  return group;
};

const GetEventBridgeRuleTemplateGroup: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  return requireEbRuleTemplateGroup(ctx, identifier);
};

const ListEventBridgeRuleTemplateGroups: OperationHandler = (_input, ctx) => {
  const groups = ctx.store
    .list<StoredEventBridgeRuleTemplateGroup>()
    .filter((e) => e.key.startsWith(ebRuleTemplateGroupPrefix))
    .map((e) => e.value);
  return { EventBridgeRuleTemplateGroups: groups };
};

const UpdateEventBridgeRuleTemplateGroup: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  const group = requireEbRuleTemplateGroup(ctx, identifier);
  const updated: StoredEventBridgeRuleTemplateGroup = {
    ...group,
    Description: stringOrUndefined(input["Description"]) ?? group.Description,
    ModifiedAt: nowIso(),
  };
  ctx.store.set(ebRuleTemplateGroupKey(identifier), updated);
  return updated;
};

const DeleteEventBridgeRuleTemplateGroup: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  requireEbRuleTemplateGroup(ctx, identifier);
  ctx.store.delete(ebRuleTemplateGroupKey(identifier));
  return {};
};

const CreateEventBridgeRuleTemplate: OperationHandler = (input, ctx) => {
  const id = nextEbRuleTemplateId(ctx);
  const groupIdentifier = requireString(input, "GroupIdentifier");
  const group = requireEbRuleTemplateGroup(ctx, groupIdentifier);
  const now = nowIso();
  const template: StoredEventBridgeRuleTemplate = {
    Id: id,
    Arn: ebRuleTemplateArn(ctx, id),
    Name: requireString(input, "Name"),
    Description: stringOrUndefined(input["Description"]) ?? "",
    GroupId: group.Id,
    EventType: requireString(input, "EventType"),
    EventTargets: arrayOrEmpty(input["EventTargets"]),
    Tags: recordOrEmpty(input["Tags"]),
    CreatedAt: now,
    ModifiedAt: now,
  };
  ctx.store.set(ebRuleTemplateKey(id), template);
  return template;
};

const GetEventBridgeRuleTemplate: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  return requireEbRuleTemplate(ctx, identifier);
};

const ListEventBridgeRuleTemplates: OperationHandler = (_input, ctx) => {
  const templates = ctx.store
    .list<StoredEventBridgeRuleTemplate>()
    .filter((e) => e.key.startsWith(ebRuleTemplatePrefix))
    .map((e) => e.value);
  return { EventBridgeRuleTemplates: templates };
};

const UpdateEventBridgeRuleTemplate: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  const template = requireEbRuleTemplate(ctx, identifier);
  const updated: StoredEventBridgeRuleTemplate = {
    ...template,
    Name: stringOrUndefined(input["Name"]) ?? template.Name,
    Description:
      stringOrUndefined(input["Description"]) ?? template.Description,
    EventType: stringOrUndefined(input["EventType"]) ?? template.EventType,
    EventTargets: Array.isArray(input["EventTargets"])
      ? input["EventTargets"]
      : template.EventTargets,
    ModifiedAt: nowIso(),
  };
  ctx.store.set(ebRuleTemplateKey(identifier), updated);
  return updated;
};

const DeleteEventBridgeRuleTemplate: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  requireEbRuleTemplate(ctx, identifier);
  ctx.store.delete(ebRuleTemplateKey(identifier));
  return {};
};

const CreateSignalMap: OperationHandler = (input, ctx) => {
  const id = nextSignalMapId(ctx);
  const now = nowIso();
  const signalMap: StoredSignalMap = {
    Id: id,
    Arn: signalMapArn(ctx, id),
    Name: requireString(input, "Name"),
    Description: stringOrUndefined(input["Description"]) ?? "",
    DiscoveryEntryPointArn: requireString(input, "DiscoveryEntryPointArn"),
    Status: "CREATE_COMPLETE",
    CloudWatchAlarmTemplateGroupIds: arrayOrEmpty(
      input["CloudWatchAlarmTemplateGroupIdentifiers"],
    ).filter((s): s is string => typeof s === "string"),
    EventBridgeRuleTemplateGroupIds: arrayOrEmpty(
      input["EventBridgeRuleTemplateGroupIdentifiers"],
    ).filter((s): s is string => typeof s === "string"),
    MonitorChangesPendingDeployment: false,
    Tags: recordOrEmpty(input["Tags"]),
    CreatedAt: now,
    ModifiedAt: now,
  };
  ctx.store.set(signalMapKey(id), signalMap);
  return signalMap;
};

const GetSignalMap: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  return requireSignalMap(ctx, identifier);
};

const ListSignalMaps: OperationHandler = (_input, ctx) => {
  const maps = ctx.store
    .list<StoredSignalMap>()
    .filter((e) => e.key.startsWith(signalMapPrefix))
    .map((e) => e.value);
  return { SignalMaps: maps };
};

const StartUpdateSignalMap: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  const signalMap = requireSignalMap(ctx, identifier);
  const updated: StoredSignalMap = {
    ...signalMap,
    Name: stringOrUndefined(input["Name"]) ?? signalMap.Name,
    Description:
      stringOrUndefined(input["Description"]) ?? signalMap.Description,
    DiscoveryEntryPointArn:
      stringOrUndefined(input["DiscoveryEntryPointArn"]) ??
      signalMap.DiscoveryEntryPointArn,
    Status: "UPDATE_COMPLETE",
    ModifiedAt: nowIso(),
  };
  ctx.store.set(signalMapKey(identifier), updated);
  return updated;
};

const DeleteSignalMap: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  requireSignalMap(ctx, identifier);
  ctx.store.delete(signalMapKey(identifier));
  return {};
};

const StartMonitorDeployment: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  const signalMap = requireSignalMap(ctx, identifier);
  const updated: StoredSignalMap = {
    ...signalMap,
    MonitorChangesPendingDeployment: false,
    ModifiedAt: nowIso(),
  };
  ctx.store.set(signalMapKey(identifier), updated);
  return updated;
};

const StartDeleteMonitorDeployment: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "Identifier");
  const signalMap = requireSignalMap(ctx, identifier);
  const updated: StoredSignalMap = {
    ...signalMap,
    MonitorChangesPendingDeployment: false,
    ModifiedAt: nowIso(),
  };
  ctx.store.set(signalMapKey(identifier), updated);
  return updated;
};

const ListVersions: OperationHandler = (_input, _ctx) => {
  return { Versions: [] };
};

const CreateSdiSource: OperationHandler = (input, ctx) => {
  const id = nextSdiSourceId(ctx);
  const sdi: StoredSdiSource = {
    Id: id,
    Arn: sdiSourceArn(ctx, id),
    Name: stringOrUndefined(input["Name"]) ?? "",
    State: "IDLE",
    Type: stringOrUndefined(input["Type"]) ?? "SINGLE",
    Mode: stringOrUndefined(input["Mode"]) ?? "QUADRANT",
    Inputs: [],
  };
  ctx.store.set(sdiSourceKey(id), sdi);
  return { SdiSource: sdi };
};

const DeleteSdiSource: OperationHandler = (input, ctx) => {
  const id = requireString(input, "SdiSourceId");
  const sdi = requireSdiSource(ctx, id);
  const deleted: StoredSdiSource = { ...sdi, State: "DELETED" };
  ctx.store.set(sdiSourceKey(id), deleted);
  return { SdiSource: deleted };
};

const DescribeSdiSource: OperationHandler = (input, ctx) => {
  const id = requireString(input, "SdiSourceId");
  return { SdiSource: requireSdiSource(ctx, id) };
};

const ListSdiSources: OperationHandler = (_input, ctx) => {
  const sources = ctx.store
    .list<StoredSdiSource>()
    .filter((entry) => entry.key.startsWith(sdiSourcePrefix))
    .map((entry) => entry.value);
  return { SdiSources: sources };
};

const UpdateSdiSource: OperationHandler = (input, ctx) => {
  const id = requireString(input, "SdiSourceId");
  const existing = requireSdiSource(ctx, id);
  const updated: StoredSdiSource = {
    ...existing,
    Name: stringOrUndefined(input["Name"]) ?? existing.Name,
    Type: stringOrUndefined(input["Type"]) ?? existing.Type,
    Mode: stringOrUndefined(input["Mode"]) ?? existing.Mode,
  };
  ctx.store.set(sdiSourceKey(id), updated);
  return { SdiSource: updated };
};

const ListAlerts: OperationHandler = (_input, _ctx) => {
  return { Alerts: [] };
};

const ListClusterAlerts: OperationHandler = (_input, _ctx) => {
  return { Alerts: [] };
};

const ListMultiplexAlerts: OperationHandler = (_input, _ctx) => {
  return { Alerts: [] };
};

const CreateChannelPlacementGroup: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const id = nextChannelPlacementGroupId(ctx);
  const group: StoredChannelPlacementGroup = {
    Id: id,
    Arn: channelPlacementGroupArn(ctx, id),
    Name: stringOrUndefined(input["Name"]) ?? "",
    State: "UNASSIGNED",
    ClusterId: clusterId,
    Nodes: arrayOrEmpty(input["Nodes"]).filter(
      (n) => typeof n === "string",
    ) as string[],
    Channels: [],
  };
  ctx.store.set(channelPlacementGroupKey(clusterId, id), group);
  return {
    Arn: group.Arn,
    Channels: group.Channels,
    ClusterId: group.ClusterId,
    Id: group.Id,
    Name: group.Name,
    Nodes: group.Nodes,
    State: group.State,
  };
};

const DeleteChannelPlacementGroup: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const id = requireString(input, "ChannelPlacementGroupId");
  const group = requireChannelPlacementGroup(ctx, clusterId, id);
  ctx.store.delete(channelPlacementGroupKey(clusterId, id));
  return {
    Arn: group.Arn,
    Channels: group.Channels,
    ClusterId: group.ClusterId,
    Id: group.Id,
    Name: group.Name,
    Nodes: group.Nodes,
    State: "DELETED",
  };
};

const DescribeChannelPlacementGroup: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const id = requireString(input, "ChannelPlacementGroupId");
  const group = requireChannelPlacementGroup(ctx, clusterId, id);
  return {
    Arn: group.Arn,
    Channels: group.Channels,
    ClusterId: group.ClusterId,
    Id: group.Id,
    Name: group.Name,
    Nodes: group.Nodes,
    State: group.State,
  };
};

const ListChannelPlacementGroups: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const prefix = channelPlacementGroupKey(clusterId, "");
  const groups = ctx.store
    .list<StoredChannelPlacementGroup>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  return { ChannelPlacementGroups: groups };
};

const UpdateChannelPlacementGroup: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const id = requireString(input, "ChannelPlacementGroupId");
  const existing = requireChannelPlacementGroup(ctx, clusterId, id);
  const updated: StoredChannelPlacementGroup = {
    ...existing,
    Name: stringOrUndefined(input["Name"]) ?? existing.Name,
    Nodes: Array.isArray(input["Nodes"])
      ? (input["Nodes"] as string[])
      : existing.Nodes,
  };
  ctx.store.set(channelPlacementGroupKey(clusterId, id), updated);
  return {
    Arn: updated.Arn,
    Channels: updated.Channels,
    ClusterId: updated.ClusterId,
    Id: updated.Id,
    Name: updated.Name,
    Nodes: updated.Nodes,
    State: updated.State,
  };
};

const clusterNetworkSettings = (
  input: Record<string, unknown>,
): StoredCluster["NetworkSettings"] => {
  const ns =
    typeof input["NetworkSettings"] === "object" &&
    input["NetworkSettings"] !== null
      ? (input["NetworkSettings"] as Record<string, unknown>)
      : {};
  return {
    DefaultRoute: stringOrUndefined(ns["DefaultRoute"]) ?? "",
    InterfaceMappings: arrayOrEmpty(ns["InterfaceMappings"]).map((m) => {
      const mapping = m as Record<string, unknown>;
      return {
        LogicalInterfaceName:
          stringOrUndefined(mapping["LogicalInterfaceName"]) ?? "",
        NetworkId: stringOrUndefined(mapping["NetworkId"]) ?? "",
      };
    }),
  };
};

const clusterResponse = (c: StoredCluster) => ({
  Arn: c.Arn,
  ChannelIds: c.ChannelIds,
  ClusterType: c.ClusterType,
  Id: c.Id,
  InstanceRoleArn: c.InstanceRoleArn,
  Name: c.Name,
  NetworkSettings: c.NetworkSettings,
  State: c.State,
});

const CreateCluster: OperationHandler = (input, ctx) => {
  const id = nextClusterId(ctx);
  const cluster: StoredCluster = {
    Id: id,
    Arn: clusterArn(ctx, id),
    ChannelIds: [],
    ClusterType: stringOrUndefined(input["ClusterType"]) ?? "",
    InstanceRoleArn: stringOrUndefined(input["InstanceRoleArn"]) ?? "",
    Name: stringOrUndefined(input["Name"]) ?? "",
    NetworkSettings: clusterNetworkSettings(input),
    State: "ACTIVE",
  };
  ctx.store.set(clusterKey(id), cluster);
  return clusterResponse(cluster);
};

const DescribeCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterId");
  return clusterResponse(requireCluster(ctx, id));
};

const ListClusters: OperationHandler = (_input, ctx) => {
  const clusters = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith(clusterPrefix))
    .map((entry) => clusterResponse(entry.value));
  return { Clusters: clusters };
};

const DeleteCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterId");
  const cluster = requireCluster(ctx, id);
  ctx.store.delete(clusterKey(id));
  return clusterResponse({ ...cluster, State: "DELETED" });
};

const UpdateCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterId");
  const existing = requireCluster(ctx, id);
  const updated: StoredCluster = {
    ...existing,
    Name: stringOrUndefined(input["Name"]) ?? existing.Name,
    NetworkSettings:
      input["NetworkSettings"] !== undefined
        ? clusterNetworkSettings(input)
        : existing.NetworkSettings,
  };
  ctx.store.set(clusterKey(id), updated);
  return clusterResponse(updated);
};

const nodeResponse = (n: StoredNode) => ({
  Arn: n.Arn,
  ChannelPlacementGroups: n.ChannelPlacementGroups,
  ClusterId: n.ClusterId,
  ConnectionState: n.ConnectionState,
  Id: n.Id,
  InstanceArn: n.InstanceArn,
  Name: n.Name,
  NodeInterfaceMappings: n.NodeInterfaceMappings,
  Role: n.Role,
  State: n.State,
  SdiSourceMappings: [],
});

const CreateNode: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  requireCluster(ctx, clusterId);
  const id = nextNodeId(ctx);
  const node: StoredNode = {
    Id: id,
    Arn: nodeArn(ctx, id),
    ChannelPlacementGroups: [],
    ClusterId: clusterId,
    ConnectionState: "DISCONNECTED",
    InstanceArn: "",
    Name: stringOrUndefined(input["Name"]) ?? "",
    NodeInterfaceMappings: arrayOrEmpty(input["NodeInterfaceMappings"]).map(
      (m) => {
        const mapping = m as Record<string, unknown>;
        return {
          LogicalInterfaceName:
            stringOrUndefined(mapping["LogicalInterfaceName"]) ?? "",
          NetworkInterfaceMode:
            stringOrUndefined(mapping["NetworkInterfaceMode"]) ?? "",
          PhysicalInterfaceName:
            stringOrUndefined(mapping["PhysicalInterfaceName"]) ?? "",
        };
      },
    ),
    Role: stringOrUndefined(input["Role"]) ?? "BACKUP",
    State: "CREATED",
  };
  ctx.store.set(nodeKey(clusterId, id), node);
  return nodeResponse(node);
};

const DescribeNode: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const nodeId = requireString(input, "NodeId");
  return nodeResponse(requireNode(ctx, clusterId, nodeId));
};

const ListNodes: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const prefix = nodeKey(clusterId, "");
  const nodes = ctx.store
    .list<StoredNode>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => nodeResponse(entry.value));
  return { Nodes: nodes };
};

const DeleteNode: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const nodeId = requireString(input, "NodeId");
  const node = requireNode(ctx, clusterId, nodeId);
  ctx.store.delete(nodeKey(clusterId, nodeId));
  return nodeResponse({ ...node, State: "DELETED" });
};

const UpdateNode: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const nodeId = requireString(input, "NodeId");
  const existing = requireNode(ctx, clusterId, nodeId);
  const updated: StoredNode = {
    ...existing,
    Name: stringOrUndefined(input["Name"]) ?? existing.Name,
    Role: stringOrUndefined(input["Role"]) ?? existing.Role,
  };
  ctx.store.set(nodeKey(clusterId, nodeId), updated);
  return nodeResponse(updated);
};

const UpdateNodeState: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const nodeId = requireString(input, "NodeId");
  const existing = requireNode(ctx, clusterId, nodeId);
  const newState = stringOrUndefined(input["State"]);
  const updated: StoredNode = {
    ...existing,
    State: newState ?? existing.State,
  };
  ctx.store.set(nodeKey(clusterId, nodeId), updated);
  return nodeResponse(updated);
};

const CreateNodeRegistrationScript: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  requireCluster(ctx, clusterId);
  return {
    NodeRegistrationScript: `#!/bin/bash\n# cluster=${clusterId}`,
  };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const medialive = {
  name: "medialive",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts.length === 0 || parts[0] !== "prod") return undefined;
    const r1 = parts[1];
    const m = req.method;

    if (r1 === "accountConfiguration" && parts.length === 2) {
      if (m === "GET") return "DescribeAccountConfiguration";
      if (m === "PUT") return "UpdateAccountConfiguration";
      return undefined;
    }

    if (r1 === "batch" && parts.length === 3) {
      if (parts[2] === "delete" && m === "POST") return "BatchDelete";
      if (parts[2] === "start" && m === "POST") return "BatchStart";
      if (parts[2] === "stop" && m === "POST") return "BatchStop";
      return undefined;
    }

    if (r1 === "claimDevice" && parts.length === 2) {
      if (m === "POST") return "ClaimDevice";
      return undefined;
    }

    if (r1 === "channels") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateChannel";
        if (m === "GET") return "ListChannels";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "DescribeChannel";
        if (m === "DELETE") return "DeleteChannel";
        if (m === "PUT") return "UpdateChannel";
        return undefined;
      }
      if (parts.length === 4) {
        const action = parts[3];
        if (action === "start" && m === "POST") return "StartChannel";
        if (action === "stop" && m === "POST") return "StopChannel";
        if (action === "schedule") {
          if (m === "GET") return "DescribeSchedule";
          if (m === "DELETE") return "DeleteSchedule";
          if (m === "PUT") return "BatchUpdateSchedule";
          return undefined;
        }
        if (action === "thumbnails" && m === "GET") return "DescribeThumbnails";
        if (action === "channelClass" && m === "PUT")
          return "UpdateChannelClass";
        if (action === "restartChannelPipelines" && m === "POST")
          return "RestartChannelPipelines";
        if (action === "alerts" && m === "GET") return "ListAlerts";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "inputs") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateInput";
        if (m === "GET") return "ListInputs";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "DescribeInput";
        if (m === "DELETE") return "DeleteInput";
        if (m === "PUT") return "UpdateInput";
        return undefined;
      }
      if (parts.length === 4 && parts[3] === "partners" && m === "POST")
        return "CreatePartnerInput";
      return undefined;
    }

    if (r1 === "inputSecurityGroups") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateInputSecurityGroup";
        if (m === "GET") return "ListInputSecurityGroups";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "DescribeInputSecurityGroup";
        if (m === "DELETE") return "DeleteInputSecurityGroup";
        if (m === "PUT") return "UpdateInputSecurityGroup";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "multiplexes") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateMultiplex";
        if (m === "GET") return "ListMultiplexes";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "DescribeMultiplex";
        if (m === "DELETE") return "DeleteMultiplex";
        if (m === "PUT") return "UpdateMultiplex";
        return undefined;
      }
      if (parts.length === 4) {
        const action = parts[3];
        if (action === "start" && m === "POST") return "StartMultiplex";
        if (action === "stop" && m === "POST") return "StopMultiplex";
        if (action === "alerts" && m === "GET") return "ListMultiplexAlerts";
        if (action === "programs") {
          if (m === "POST") return "CreateMultiplexProgram";
          if (m === "GET") return "ListMultiplexPrograms";
          return undefined;
        }
        return undefined;
      }
      if (parts.length === 5 && parts[3] === "programs") {
        if (m === "GET") return "DescribeMultiplexProgram";
        if (m === "DELETE") return "DeleteMultiplexProgram";
        if (m === "PUT") return "UpdateMultiplexProgram";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "inputDevices") {
      if (parts.length === 2) {
        if (m === "GET") return "ListInputDevices";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "DescribeInputDevice";
        if (m === "PUT") return "UpdateInputDevice";
        return undefined;
      }
      if (parts.length === 4) {
        const action = parts[3];
        if (action === "thumbnailData" && m === "GET")
          return "DescribeInputDeviceThumbnail";
        if (action === "start" && m === "POST") return "StartInputDevice";
        if (action === "stop" && m === "POST") return "StopInputDevice";
        if (action === "reboot" && m === "POST") return "RebootInputDevice";
        if (action === "startInputDeviceMaintenanceWindow" && m === "POST")
          return "StartInputDeviceMaintenanceWindow";
        if (action === "accept" && m === "POST")
          return "AcceptInputDeviceTransfer";
        if (action === "cancel" && m === "POST")
          return "CancelInputDeviceTransfer";
        if (action === "reject" && m === "POST")
          return "RejectInputDeviceTransfer";
        if (action === "transfer" && m === "POST") return "TransferInputDevice";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "inputDeviceTransfers" && parts.length === 2) {
      if (m === "GET") return "ListInputDeviceTransfers";
      return undefined;
    }

    if (r1 === "sdiSources") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateSdiSource";
        if (m === "GET") return "ListSdiSources";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "DescribeSdiSource";
        if (m === "DELETE") return "DeleteSdiSource";
        if (m === "PUT") return "UpdateSdiSource";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "clusters") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateCluster";
        if (m === "GET") return "ListClusters";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "DescribeCluster";
        if (m === "DELETE") return "DeleteCluster";
        if (m === "PUT") return "UpdateCluster";
        return undefined;
      }
      if (parts.length === 4) {
        const section = parts[3];
        if (section === "alerts" && m === "GET") return "ListClusterAlerts";
        if (section === "channelplacementgroups") {
          if (m === "POST") return "CreateChannelPlacementGroup";
          if (m === "GET") return "ListChannelPlacementGroups";
          return undefined;
        }
        if (section === "nodes") {
          if (m === "POST") return "CreateNode";
          if (m === "GET") return "ListNodes";
          return undefined;
        }
        if (section === "nodeRegistrationScript" && m === "POST")
          return "CreateNodeRegistrationScript";
        return undefined;
      }
      if (parts.length === 5) {
        if (parts[3] === "channelplacementgroups") {
          if (m === "GET") return "DescribeChannelPlacementGroup";
          if (m === "DELETE") return "DeleteChannelPlacementGroup";
          if (m === "PUT") return "UpdateChannelPlacementGroup";
          return undefined;
        }
        if (parts[3] === "nodes") {
          if (m === "GET") return "DescribeNode";
          if (m === "DELETE") return "DeleteNode";
          if (m === "PUT") return "UpdateNode";
          return undefined;
        }
        return undefined;
      }
      if (
        parts.length === 6 &&
        parts[3] === "nodes" &&
        parts[5] === "state" &&
        m === "PUT"
      )
        return "UpdateNodeState";
      return undefined;
    }

    if (r1 === "offerings") {
      if (parts.length === 2 && m === "GET") return "ListOfferings";
      if (parts.length === 3 && m === "GET") return "DescribeOffering";
      if (parts.length === 4 && parts[3] === "purchase" && m === "POST")
        return "PurchaseOffering";
      return undefined;
    }

    if (r1 === "reservations") {
      if (parts.length === 2 && m === "GET") return "ListReservations";
      if (parts.length === 3) {
        if (m === "GET") return "DescribeReservation";
        if (m === "DELETE") return "DeleteReservation";
        if (m === "PUT") return "UpdateReservation";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "tags" && parts.length >= 3) {
      if (m === "POST") return "CreateTags";
      if (m === "DELETE") return "DeleteTags";
      if (m === "GET") return "ListTagsForResource";
      return undefined;
    }

    if (r1 === "cloudwatch-alarm-template-groups") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateCloudWatchAlarmTemplateGroup";
        if (m === "GET") return "ListCloudWatchAlarmTemplateGroups";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "GetCloudWatchAlarmTemplateGroup";
        if (m === "PATCH") return "UpdateCloudWatchAlarmTemplateGroup";
        if (m === "DELETE") return "DeleteCloudWatchAlarmTemplateGroup";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "cloudwatch-alarm-templates") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateCloudWatchAlarmTemplate";
        if (m === "GET") return "ListCloudWatchAlarmTemplates";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "GetCloudWatchAlarmTemplate";
        if (m === "PATCH") return "UpdateCloudWatchAlarmTemplate";
        if (m === "DELETE") return "DeleteCloudWatchAlarmTemplate";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "eventbridge-rule-template-groups") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateEventBridgeRuleTemplateGroup";
        if (m === "GET") return "ListEventBridgeRuleTemplateGroups";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "GetEventBridgeRuleTemplateGroup";
        if (m === "PATCH") return "UpdateEventBridgeRuleTemplateGroup";
        if (m === "DELETE") return "DeleteEventBridgeRuleTemplateGroup";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "eventbridge-rule-templates") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateEventBridgeRuleTemplate";
        if (m === "GET") return "ListEventBridgeRuleTemplates";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "GetEventBridgeRuleTemplate";
        if (m === "PATCH") return "UpdateEventBridgeRuleTemplate";
        if (m === "DELETE") return "DeleteEventBridgeRuleTemplate";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "signal-maps") {
      if (parts.length === 2) {
        if (m === "POST") return "CreateSignalMap";
        if (m === "GET") return "ListSignalMaps";
        return undefined;
      }
      if (parts.length === 3) {
        if (m === "GET") return "GetSignalMap";
        if (m === "PATCH") return "StartUpdateSignalMap";
        if (m === "DELETE") return "DeleteSignalMap";
        return undefined;
      }
      if (parts.length === 4 && parts[3] === "monitor-deployment") {
        if (m === "POST") return "StartMonitorDeployment";
        if (m === "DELETE") return "StartDeleteMonitorDeployment";
        return undefined;
      }
      return undefined;
    }

    if (r1 === "versions" && parts.length === 2) {
      if (m === "GET") return "ListVersions";
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateChannel,
    DescribeChannel,
    ListChannels,
    DeleteChannel,
    StartChannel,
    StopChannel,
    UpdateChannel,
    UpdateChannelClass,
    DescribeSchedule,
    DeleteSchedule,
    BatchUpdateSchedule,
    DescribeThumbnails,
    RestartChannelPipelines,
    CreateInput,
    DescribeInput,
    ListInputs,
    UpdateInput,
    DeleteInput,
    CreatePartnerInput,
    CreateInputSecurityGroup,
    DescribeInputSecurityGroup,
    ListInputSecurityGroups,
    UpdateInputSecurityGroup,
    DeleteInputSecurityGroup,
    CreateMultiplex,
    DescribeMultiplex,
    ListMultiplexes,
    UpdateMultiplex,
    DeleteMultiplex,
    StartMultiplex,
    StopMultiplex,
    CreateMultiplexProgram,
    DescribeMultiplexProgram,
    ListMultiplexPrograms,
    UpdateMultiplexProgram,
    DeleteMultiplexProgram,
    DescribeInputDevice,
    ListInputDevices,
    UpdateInputDevice,
    RebootInputDevice,
    StartInputDevice,
    StopInputDevice,
    DescribeInputDeviceThumbnail,
    StartInputDeviceMaintenanceWindow,
    AcceptInputDeviceTransfer,
    CancelInputDeviceTransfer,
    RejectInputDeviceTransfer,
    TransferInputDevice,
    ListInputDeviceTransfers,
    ClaimDevice,
    ListOfferings,
    DescribeOffering,
    PurchaseOffering,
    DescribeReservation,
    ListReservations,
    UpdateReservation,
    DeleteReservation,
    CreateTags,
    DeleteTags,
    ListTagsForResource,
    DescribeAccountConfiguration,
    UpdateAccountConfiguration,
    BatchDelete,
    BatchStart,
    BatchStop,
    CreateCloudWatchAlarmTemplateGroup,
    GetCloudWatchAlarmTemplateGroup,
    ListCloudWatchAlarmTemplateGroups,
    UpdateCloudWatchAlarmTemplateGroup,
    DeleteCloudWatchAlarmTemplateGroup,
    CreateCloudWatchAlarmTemplate,
    GetCloudWatchAlarmTemplate,
    ListCloudWatchAlarmTemplates,
    UpdateCloudWatchAlarmTemplate,
    DeleteCloudWatchAlarmTemplate,
    CreateEventBridgeRuleTemplateGroup,
    GetEventBridgeRuleTemplateGroup,
    ListEventBridgeRuleTemplateGroups,
    UpdateEventBridgeRuleTemplateGroup,
    DeleteEventBridgeRuleTemplateGroup,
    CreateEventBridgeRuleTemplate,
    GetEventBridgeRuleTemplate,
    ListEventBridgeRuleTemplates,
    UpdateEventBridgeRuleTemplate,
    DeleteEventBridgeRuleTemplate,
    CreateSignalMap,
    GetSignalMap,
    ListSignalMaps,
    StartUpdateSignalMap,
    DeleteSignalMap,
    StartMonitorDeployment,
    StartDeleteMonitorDeployment,
    ListVersions,
    CreateSdiSource,
    DeleteSdiSource,
    DescribeSdiSource,
    ListSdiSources,
    UpdateSdiSource,
    ListAlerts,
    ListClusterAlerts,
    ListMultiplexAlerts,
    CreateChannelPlacementGroup,
    DeleteChannelPlacementGroup,
    DescribeChannelPlacementGroup,
    ListChannelPlacementGroups,
    UpdateChannelPlacementGroup,
    CreateCluster,
    DescribeCluster,
    ListClusters,
    DeleteCluster,
    UpdateCluster,
    CreateNode,
    DescribeNode,
    ListNodes,
    DeleteNode,
    UpdateNode,
    UpdateNodeState,
    CreateNodeRegistrationScript,
  },
  model,
} as const satisfies ServiceDefinition;

export default medialive;
