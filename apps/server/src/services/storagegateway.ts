import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import storagegatewayModel from "../../../../test/vendor/aws-models/storagegateway.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(storagegatewayModel);

type StoredGateway = {
  GatewayId: string;
  GatewayARN: string;
  GatewayName: string;
  GatewayTimezone: string;
  GatewayRegion: string;
  GatewayType: string;
  GatewayState: string;
  GatewayOperationalState: string;
  HostEnvironment: string;
  Tags: unknown[];
  Domain: string | undefined;
  MaintenanceStartTime: Record<string, unknown> | undefined;
  SMBSettings: Record<string, unknown> | undefined;
  BandwidthRateLimit: Record<string, unknown> | undefined;
  BandwidthRateLimitSchedule: unknown[] | undefined;
  AutomaticTapeCreationPolicies: unknown[];
  LocalDisks: unknown[];
};

type StoredVolume = {
  VolumeId: string;
  VolumeARN: string;
  GatewayARN: string;
  VolumeType: string;
  VolumeStatus: string;
  VolumeSizeInBytes: number;
  VolumeProgress: number;
  TargetARN: string;
  NetworkInterfaceId: string;
  NetworkInterfacePort: number;
  LunNumber: number;
  ChapEnabled: boolean;
  CreatedDate: number;
  KMSKey: string | undefined;
  Tags: unknown[];
};

type StoredFileShare = {
  FileShareId: string;
  FileShareARN: string;
  GatewayARN: string;
  FileShareType: string;
  FileShareStatus: string;
  Path: string;
  LocationARN: string;
  Role: string;
  ClientList: string[] | undefined;
  Squash: string | undefined;
  ReadOnly: boolean;
  GuessMIMETypeEnabled: boolean;
  RequesterPays: boolean;
  SMBACLEnabled: boolean | undefined;
  AccessBasedEnumeration: boolean | undefined;
  ValidUserList: string[] | undefined;
  InvalidUserList: string[] | undefined;
  AuditDestinationARN: string | undefined;
  Authentication: string | undefined;
  CaseSensitivity: string | undefined;
  FileShareName: string | undefined;
  Tags: unknown[];
  NFSFileShareDefaults: Record<string, unknown> | undefined;
  CacheAttributes: Record<string, unknown> | undefined;
  NotificationPolicy: string | undefined;
  OplocksEnabled: boolean | undefined;
  ClientToken: string | undefined;
};

type StoredTapePool = {
  PoolId: string;
  PoolARN: string;
  PoolName: string;
  StorageClass: string;
  RetentionLockType: string;
  RetentionLockTimeInDays: number | undefined;
  PoolStatus: string;
  CreatedDate: number;
};

type StoredTape = {
  TapeId: string;
  TapeARN: string;
  GatewayARN: string;
  TapeBarcode: string;
  TapeSizeInBytes: number;
  TapeStatus: string;
  TapeUsedInBytes: number;
  KMSKey: string | undefined;
  PoolId: string | undefined;
  PoolEntryDate: number | undefined;
  RetentionStartDate: number | undefined;
  Worm: boolean;
  CreatedDate: number;
  Progress: number | undefined;
  VTLDevice: string | undefined;
};

type StoredSnapshotSchedule = {
  VolumeARN: string;
  StartAt: number;
  RecurrenceInHours: number;
  Description: string | undefined;
  Timezone: string;
  Tags: unknown[];
};

type StoredFileSystemAssociation = {
  FileSystemAssociationId: string;
  FileSystemAssociationARN: string;
  GatewayARN: string;
  LocationARN: string;
  AuditDestinationARN: string | undefined;
  FileSystemAssociationStatus: string;
  Tags: unknown[];
  CacheAttributes: Record<string, unknown> | undefined;
  EndpointNetworkConfiguration: Record<string, unknown> | undefined;
};

type StoredChapCredentials = {
  TargetARN: string;
  SecretToAuthenticateInitiator: string;
  InitiatorName: string;
  SecretToAuthenticateTarget: string | undefined;
};

type ResourceTags = Record<string, string>;

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? (value as unknown[]) : [];

const boolOrFalse = (value: unknown): boolean =>
  typeof value === "boolean" ? value : false;

const numberOrZero = (value: unknown): number =>
  typeof value === "number" ? value : 0;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const hex12 = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value === "string" && value !== "") return value;
  throw awsError("InvalidGatewayRequestException", `${key} is required.`, 400);
};

const gatewayKey = (arn: string): string => {
  const index = arn.lastIndexOf("/");
  return index === -1 ? arn : arn.slice(index + 1);
};

const requireGateway = (ctx: ServiceContext, arn: string): StoredGateway => {
  const gateway = ctx.store.get<StoredGateway>(gatewayKey(arn));
  if (gateway === undefined) {
    throw awsError(
      "InvalidGatewayRequestException",
      `Unknown gateway ${arn}.`,
      400,
    );
  }
  return gateway;
};

const volumeKey = (arn: string): string => `vol:${arn}`;

const requireVolume = (ctx: ServiceContext, arn: string): StoredVolume => {
  const volume = ctx.store.get<StoredVolume>(volumeKey(arn));
  if (volume === undefined) {
    throw awsError(
      "InvalidGatewayRequestException",
      `Unknown volume ${arn}.`,
      400,
    );
  }
  return volume;
};

const fileShareKey = (arn: string): string => `fs:${arn}`;

const requireFileShare = (
  ctx: ServiceContext,
  arn: string,
): StoredFileShare => {
  const share = ctx.store.get<StoredFileShare>(fileShareKey(arn));
  if (share === undefined) {
    throw awsError(
      "InvalidGatewayRequestException",
      `Unknown file share ${arn}.`,
      400,
    );
  }
  return share;
};

const tapePoolKey = (arn: string): string => `tp:${arn}`;

const requireTapePool = (ctx: ServiceContext, arn: string): StoredTapePool => {
  const pool = ctx.store.get<StoredTapePool>(tapePoolKey(arn));
  if (pool === undefined) {
    throw awsError(
      "InvalidGatewayRequestException",
      `Unknown tape pool ${arn}.`,
      400,
    );
  }
  return pool;
};

const tapeKey = (arn: string): string => `tape:${arn}`;

const requireTape = (ctx: ServiceContext, arn: string): StoredTape => {
  const tape = ctx.store.get<StoredTape>(tapeKey(arn));
  if (tape === undefined) {
    throw awsError(
      "InvalidGatewayRequestException",
      `Unknown tape ${arn}.`,
      400,
    );
  }
  return tape;
};

const paginateList = <T>(
  items: T[],
  getKey: (item: T) => string,
  marker: string | undefined,
  limit: number | undefined,
): { items: T[]; nextMarker: string | undefined } => {
  let start = 0;
  if (marker !== undefined) {
    const idx = items.findIndex((item) => getKey(item) === marker);
    start = idx === -1 ? 0 : idx + 1;
  }
  const count = limit ?? items.length;
  const page = items.slice(start, start + count);
  const nextMarker =
    start + count < items.length ? getKey(items[start + count]) : undefined;
  return { items: page, nextMarker };
};

const snapshotKey = (arn: string): string => `snap:${arn}`;

const requireSnapshotSchedule = (
  ctx: ServiceContext,
  arn: string,
): StoredSnapshotSchedule => {
  const schedule = ctx.store.get<StoredSnapshotSchedule>(snapshotKey(arn));
  if (schedule === undefined) {
    throw awsError(
      "InvalidGatewayRequestException",
      `Unknown snapshot schedule for volume ${arn}.`,
      400,
    );
  }
  return schedule;
};

const fsaKey = (arn: string): string => `fsa:${arn}`;

const requireFileSystemAssociation = (
  ctx: ServiceContext,
  arn: string,
): StoredFileSystemAssociation => {
  const fsa = ctx.store.get<StoredFileSystemAssociation>(fsaKey(arn));
  if (fsa === undefined) {
    throw awsError(
      "InvalidGatewayRequestException",
      `Unknown file system association ${arn}.`,
      400,
    );
  }
  return fsa;
};

const chapKey = (targetArn: string): string => `chap:${targetArn}`;

const tagKey = (resourceArn: string): string => `tags:${resourceArn}`;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const makeFileShareArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:storagegateway:${ctx.region}:${ctx.account}:share/${id}`;

const makeTapePoolArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:storagegateway:${ctx.region}:${ctx.account}:tapepool/${id}`;

const makeTapeArn = (ctx: ServiceContext, barcode: string): string =>
  `arn:aws:storagegateway:${ctx.region}:${ctx.account}:tape/${barcode}`;

const makeVolumeArn = (
  ctx: ServiceContext,
  gatewayId: string,
  volumeId: string,
): string =>
  `arn:aws:storagegateway:${ctx.region}:${ctx.account}:gateway/${gatewayId}/volume/${volumeId}`;

const makeFsaArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:storagegateway:${ctx.region}:${ctx.account}:fs-association/${id}`;

const ActivateGateway: OperationHandler = (input, ctx) => {
  const activationKey = requireString(input, "ActivationKey");
  void activationKey;
  const gatewayName = requireString(input, "GatewayName");
  const gatewayTimezone = requireString(input, "GatewayTimezone");
  const gatewayRegion = requireString(input, "GatewayRegion");
  const gatewayId = `sgw-${hex12().toUpperCase()}`;
  const arn = `arn:aws:storagegateway:${ctx.region}:${ctx.account}:gateway/${gatewayId}`;
  const gateway: StoredGateway = {
    GatewayId: gatewayId,
    GatewayARN: arn,
    GatewayName: gatewayName,
    GatewayTimezone: gatewayTimezone,
    GatewayRegion: gatewayRegion,
    GatewayType: stringOrUndefined(input["GatewayType"]) ?? "STORED",
    GatewayState: "RUNNING",
    GatewayOperationalState: "ACTIVE",
    HostEnvironment: "OTHER",
    Tags: arrayOrEmpty(input["Tags"]),
    Domain: undefined,
    MaintenanceStartTime: undefined,
    SMBSettings: undefined,
    BandwidthRateLimit: undefined,
    BandwidthRateLimitSchedule: undefined,
    AutomaticTapeCreationPolicies: [],
    LocalDisks: [
      {
        DiskId: `disk-${hex12()}`,
        DiskPath: "/dev/xvdb",
        DiskNode: "SCSI(0:1)",
        DiskStatus: "present",
        DiskSizeInBytes: 107374182400,
        DiskAllocationType: "AVAILABLE",
      },
    ],
  };
  ctx.store.set(gatewayId, gateway);
  return { GatewayARN: arn };
};

const ListGateways: OperationHandler = (_input, ctx) => {
  const gateways = ctx.store
    .list<StoredGateway>()
    .filter((e) => !e.key.includes(":"))
    .map((entry) => ({
      GatewayId: entry.value.GatewayId,
      GatewayARN: entry.value.GatewayARN,
      GatewayType: entry.value.GatewayType,
      GatewayOperationalState: entry.value.GatewayOperationalState,
      GatewayName: entry.value.GatewayName,
      HostEnvironment: entry.value.HostEnvironment,
    }));
  return { Gateways: gateways };
};

const DescribeGatewayInformation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return {
    GatewayARN: gateway.GatewayARN,
    GatewayId: gateway.GatewayId,
    GatewayName: gateway.GatewayName,
    GatewayTimezone: gateway.GatewayTimezone,
    GatewayState: gateway.GatewayState,
    GatewayNetworkInterfaces: [],
    GatewayType: gateway.GatewayType,
    HostEnvironment: gateway.HostEnvironment,
    Tags: gateway.Tags,
  };
};

const DeleteGateway: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  ctx.store.delete(gateway.GatewayId);
  ctx.store.delete(tagKey(arn));
  return { GatewayARN: gateway.GatewayARN };
};

const StartGateway: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  if (gateway.GatewayState !== "SHUTDOWN") {
    throw awsError(
      "InvalidGatewayRequestException",
      `Gateway ${arn} is not SHUTDOWN (current state: ${gateway.GatewayState}).`,
      400,
    );
  }
  ctx.store.set(gateway.GatewayId, { ...gateway, GatewayState: "RUNNING" });
  return { GatewayARN: gateway.GatewayARN };
};

const ShutdownGateway: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  if (gateway.GatewayState !== "RUNNING") {
    throw awsError(
      "InvalidGatewayRequestException",
      `Gateway ${arn} is not RUNNING (current state: ${gateway.GatewayState}).`,
      400,
    );
  }
  ctx.store.set(gateway.GatewayId, {
    ...gateway,
    GatewayState: "SHUTDOWN",
  });
  return { GatewayARN: gateway.GatewayARN };
};

const DisableGateway: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  ctx.store.set(gateway.GatewayId, {
    ...gateway,
    GatewayOperationalState: "DISABLED",
  });
  return { GatewayARN: gateway.GatewayARN };
};

const UpdateGatewayInformation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  const updated: StoredGateway = {
    ...gateway,
    GatewayName: stringOrUndefined(input["GatewayName"]) ?? gateway.GatewayName,
    GatewayTimezone:
      stringOrUndefined(input["GatewayTimezone"]) ?? gateway.GatewayTimezone,
  };
  ctx.store.set(gateway.GatewayId, updated);
  return { GatewayARN: updated.GatewayARN, GatewayName: updated.GatewayName };
};

const UpdateGatewaySoftwareNow: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return { GatewayARN: gateway.GatewayARN };
};

const AddTagsToResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const tags = arrayOrEmpty(input["Tags"]) as Array<Record<string, string>>;
  const existing = ctx.store.get<ResourceTags>(tagKey(resourceArn)) ?? {};
  const updated: ResourceTags = { ...existing };
  for (const tag of tags) {
    if (tag["Key"] && tag["Value"] !== undefined) {
      updated[tag["Key"]] = tag["Value"];
    }
  }
  ctx.store.set(tagKey(resourceArn), updated);
  return { ResourceARN: resourceArn };
};

const RemoveTagsFromResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const tagKeys = arrayOrEmpty(input["TagKeys"]) as string[];
  const existing = ctx.store.get<ResourceTags>(tagKey(resourceArn)) ?? {};
  const updated: ResourceTags = { ...existing };
  for (const key of tagKeys) {
    delete updated[key];
  }
  ctx.store.set(tagKey(resourceArn), updated);
  return { ResourceARN: resourceArn };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const existing = ctx.store.get<ResourceTags>(tagKey(resourceArn)) ?? {};
  const tags = Object.entries(existing).map(([Key, Value]) => ({
    Key,
    Value,
  }));
  return { ResourceARN: resourceArn, Tags: tags };
};

const ListLocalDisks: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return { GatewayARN: gateway.GatewayARN, Disks: gateway.LocalDisks };
};

const AddCache: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return { GatewayARN: gateway.GatewayARN };
};

const AddUploadBuffer: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return { GatewayARN: gateway.GatewayARN };
};

const AddWorkingStorage: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return { GatewayARN: gateway.GatewayARN };
};

const DescribeCache: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return {
    GatewayARN: gateway.GatewayARN,
    DiskIds: [],
    CacheAllocatedInBytes: 107374182400,
    CacheUsedPercentage: 0,
    CacheDirtyPercentage: 0,
    CacheHitPercentage: 100,
    CacheMissPercentage: 0,
  };
};

const DescribeUploadBuffer: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return {
    GatewayARN: gateway.GatewayARN,
    DiskIds: [],
    UploadBufferAllocatedInBytes: 107374182400,
    UploadBufferUsedInBytes: 0,
  };
};

const DescribeWorkingStorage: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return {
    GatewayARN: gateway.GatewayARN,
    DiskIds: [],
    WorkingStorageAllocatedInBytes: 107374182400,
    WorkingStorageUsedInBytes: 0,
  };
};

const ResetCache: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return { GatewayARN: gateway.GatewayARN };
};

const DescribeBandwidthRateLimit: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return {
    GatewayARN: gateway.GatewayARN,
    ...(gateway.BandwidthRateLimit ?? {}),
  };
};

const DescribeBandwidthRateLimitSchedule: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return {
    GatewayARN: gateway.GatewayARN,
    BandwidthRateLimitIntervals: gateway.BandwidthRateLimitSchedule ?? [],
  };
};

const UpdateBandwidthRateLimit: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  const limit: Record<string, unknown> = {};
  if (typeof input["AverageUploadRateLimitInBitsPerSec"] === "number") {
    limit["AverageUploadRateLimitInBitsPerSec"] =
      input["AverageUploadRateLimitInBitsPerSec"];
  }
  if (typeof input["AverageDownloadRateLimitInBitsPerSec"] === "number") {
    limit["AverageDownloadRateLimitInBitsPerSec"] =
      input["AverageDownloadRateLimitInBitsPerSec"];
  }
  ctx.store.set(gateway.GatewayId, {
    ...gateway,
    BandwidthRateLimit: limit,
  });
  return { GatewayARN: gateway.GatewayARN };
};

const UpdateBandwidthRateLimitSchedule: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  ctx.store.set(gateway.GatewayId, {
    ...gateway,
    BandwidthRateLimitSchedule: arrayOrEmpty(
      input["BandwidthRateLimitIntervals"],
    ),
  });
  return { GatewayARN: gateway.GatewayARN };
};

const DeleteBandwidthRateLimit: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  ctx.store.set(gateway.GatewayId, {
    ...gateway,
    BandwidthRateLimit: undefined,
    BandwidthRateLimitSchedule: undefined,
  });
  return { GatewayARN: gateway.GatewayARN };
};

const DescribeMaintenanceStartTime: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return {
    GatewayARN: gateway.GatewayARN,
    ...(gateway.MaintenanceStartTime ?? {
      HourOfDay: 2,
      MinuteOfHour: 0,
      DayOfWeek: 0,
      Timezone: gateway.GatewayTimezone,
    }),
  };
};

const UpdateMaintenanceStartTime: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  const maint: Record<string, unknown> = {};
  if (typeof input["HourOfDay"] === "number")
    maint["HourOfDay"] = input["HourOfDay"];
  if (typeof input["MinuteOfHour"] === "number")
    maint["MinuteOfHour"] = input["MinuteOfHour"];
  if (typeof input["DayOfWeek"] === "number")
    maint["DayOfWeek"] = input["DayOfWeek"];
  if (typeof input["DayOfMonth"] === "number")
    maint["DayOfMonth"] = input["DayOfMonth"];
  ctx.store.set(gateway.GatewayId, {
    ...gateway,
    MaintenanceStartTime: maint,
  });
  return { GatewayARN: gateway.GatewayARN };
};

const JoinDomain: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  const domainName = requireString(input, "DomainName");
  ctx.store.set(gateway.GatewayId, {
    ...gateway,
    Domain: domainName,
  });
  return {
    GatewayARN: gateway.GatewayARN,
    ActiveDirectoryStatus: "SUCCESS",
  };
};

const DescribeSMBSettings: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return {
    GatewayARN: gateway.GatewayARN,
    DomainName: gateway.Domain,
    ActiveDirectoryStatus: gateway.Domain ? "SUCCESS" : "DETACHED",
    SMBGuestPasswordSet: false,
    SMBSecurityStrategy: "ClientSpecified",
    FileSharesVisible: true,
    SMBLocalGroups: {
      GatewayAdmins: [],
    },
    ...(gateway.SMBSettings ?? {}),
  };
};

const UpdateSMBSecurityStrategy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  const settings = gateway.SMBSettings ?? {};
  ctx.store.set(gateway.GatewayId, {
    ...gateway,
    SMBSettings: {
      ...settings,
      SMBSecurityStrategy: stringOrUndefined(input["SMBSecurityStrategy"]),
    },
  });
  return { GatewayARN: gateway.GatewayARN };
};

const UpdateSMBFileShareVisibility: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  const settings = gateway.SMBSettings ?? {};
  ctx.store.set(gateway.GatewayId, {
    ...gateway,
    SMBSettings: {
      ...settings,
      FileSharesVisible: boolOrFalse(input["FileSharesVisible"]),
    },
  });
  return { GatewayARN: gateway.GatewayARN };
};

const UpdateSMBLocalGroups: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  const settings = gateway.SMBSettings ?? {};
  ctx.store.set(gateway.GatewayId, {
    ...gateway,
    SMBSettings: {
      ...settings,
      SMBLocalGroups: recordOrUndefined(input["SMBLocalGroups"]) ?? {},
    },
  });
  return { GatewayARN: gateway.GatewayARN };
};

const SetLocalConsolePassword: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return { GatewayARN: gateway.GatewayARN };
};

const SetSMBGuestPassword: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  const settings = gateway.SMBSettings ?? {};
  ctx.store.set(gateway.GatewayId, {
    ...gateway,
    SMBSettings: { ...settings, SMBGuestPasswordSet: true },
  });
  return { GatewayARN: gateway.GatewayARN };
};

const StartAvailabilityMonitorTest: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return { GatewayARN: gateway.GatewayARN };
};

const DescribeAvailabilityMonitorTest: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return {
    GatewayARN: gateway.GatewayARN,
    Status: "COMPLETE",
    StartTime: nowSeconds(),
  };
};

const CreateCachediSCSIVolume: OperationHandler = (input, ctx) => {
  const gatewayArn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, gatewayArn);
  const volumeSizeInBytes = numberOrZero(input["VolumeSizeInBytes"]);
  const networkInterfaceId = requireString(input, "NetworkInterfaceId");
  const targetName = requireString(input, "TargetName");
  const volumeId = `vol-${hex12()}`;
  const arn = makeVolumeArn(ctx, gateway.GatewayId, volumeId);
  const targetArn = `arn:aws:storagegateway:${ctx.region}:${ctx.account}:gateway/${gateway.GatewayId}/target/${targetName}`;
  const volume: StoredVolume = {
    VolumeId: volumeId,
    VolumeARN: arn,
    GatewayARN: gateway.GatewayARN,
    VolumeType: "CACHED iSCSI",
    VolumeStatus: "AVAILABLE",
    VolumeSizeInBytes: volumeSizeInBytes,
    VolumeProgress: 100,
    TargetARN: targetArn,
    NetworkInterfaceId: networkInterfaceId,
    NetworkInterfacePort: 3260,
    LunNumber: 0,
    ChapEnabled: false,
    CreatedDate: nowSeconds(),
    KMSKey: stringOrUndefined(input["KMSKey"]),
    Tags: arrayOrEmpty(input["Tags"]),
  };
  ctx.store.set(volumeKey(arn), volume);
  return { VolumeARN: arn, TargetARN: targetArn };
};

const CreateStorediSCSIVolume: OperationHandler = (input, ctx) => {
  const gatewayArn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, gatewayArn);
  const networkInterfaceId = requireString(input, "NetworkInterfaceId");
  const targetName = requireString(input, "TargetName");
  const volumeId = `vol-${hex12()}`;
  const arn = makeVolumeArn(ctx, gateway.GatewayId, volumeId);
  const targetArn = `arn:aws:storagegateway:${ctx.region}:${ctx.account}:gateway/${gateway.GatewayId}/target/${targetName}`;
  const volume: StoredVolume = {
    VolumeId: volumeId,
    VolumeARN: arn,
    GatewayARN: gateway.GatewayARN,
    VolumeType: "STORED iSCSI",
    VolumeStatus: "AVAILABLE",
    VolumeSizeInBytes: numberOrZero(input["VolumeSizeInBytes"]),
    VolumeProgress: 100,
    TargetARN: targetArn,
    NetworkInterfaceId: networkInterfaceId,
    NetworkInterfacePort: 3260,
    LunNumber: 0,
    ChapEnabled: false,
    CreatedDate: nowSeconds(),
    KMSKey: stringOrUndefined(input["KMSKey"]),
    Tags: arrayOrEmpty(input["Tags"]),
  };
  ctx.store.set(volumeKey(arn), volume);
  return {
    VolumeARN: arn,
    VolumeSizeInBytes: volume.VolumeSizeInBytes,
    TargetARN: targetArn,
  };
};

const AttachVolume: OperationHandler = (input, ctx) => {
  const gatewayArn = requireString(input, "GatewayARN");
  requireGateway(ctx, gatewayArn);
  const volumeArn = requireString(input, "VolumeARN");
  const volume = requireVolume(ctx, volumeArn);
  return {
    VolumeARN: volume.VolumeARN,
    TargetARN: volume.TargetARN,
  };
};

const DetachVolume: OperationHandler = (input, ctx) => {
  const volumeArn = requireString(input, "VolumeARN");
  const volume = requireVolume(ctx, volumeArn);
  return { VolumeARN: volume.VolumeARN };
};

const DeleteVolume: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "VolumeARN");
  const volume = requireVolume(ctx, arn);
  ctx.store.delete(volumeKey(arn));
  return { VolumeARN: volume.VolumeARN };
};

const DescribeCachediSCSIVolumes: OperationHandler = (input, ctx) => {
  const arns = arrayOrEmpty(input["VolumeARNs"]) as string[];
  const volumes: unknown[] = [];
  for (const arn of arns) {
    const v = ctx.store.get<StoredVolume>(volumeKey(arn));
    if (v) {
      volumes.push({
        VolumeId: v.VolumeId,
        VolumeARN: v.VolumeARN,
        VolumeType: v.VolumeType,
        VolumeStatus: v.VolumeStatus,
        VolumeSizeInBytes: v.VolumeSizeInBytes,
        VolumeProgress: v.VolumeProgress,
        VolumeDiskId: "disk-0",
        SourceSnapshotId: undefined,
        VolumeiSCSIAttributes: {
          TargetARN: v.TargetARN,
          NetworkInterfaceId: v.NetworkInterfaceId,
          NetworkInterfacePort: v.NetworkInterfacePort,
          LunNumber: v.LunNumber,
          ChapEnabled: v.ChapEnabled,
        },
        CreatedDate: v.CreatedDate,
        VolumeUsedInBytes: 0,
        KMSKey: v.KMSKey,
        Tags: v.Tags,
      });
    }
  }
  return { CachediSCSIVolumes: volumes };
};

const DescribeStorediSCSIVolumes: OperationHandler = (input, ctx) => {
  const arns = arrayOrEmpty(input["VolumeARNs"]) as string[];
  const volumes: unknown[] = [];
  for (const arn of arns) {
    const v = ctx.store.get<StoredVolume>(volumeKey(arn));
    if (v) {
      volumes.push({
        VolumeId: v.VolumeId,
        VolumeARN: v.VolumeARN,
        VolumeType: v.VolumeType,
        VolumeStatus: v.VolumeStatus,
        VolumeSizeInBytes: v.VolumeSizeInBytes,
        VolumeProgress: v.VolumeProgress,
        VolumeDiskId: "disk-0",
        VolumeiSCSIAttributes: {
          TargetARN: v.TargetARN,
          NetworkInterfaceId: v.NetworkInterfaceId,
          NetworkInterfacePort: v.NetworkInterfacePort,
          LunNumber: v.LunNumber,
          ChapEnabled: v.ChapEnabled,
        },
        PreservedExistingData: false,
        CreatedDate: v.CreatedDate,
        VolumeUsedInBytes: 0,
        KMSKey: v.KMSKey,
        Tags: v.Tags,
      });
    }
  }
  return { StorediSCSIVolumes: volumes };
};

const ListVolumes: OperationHandler = (input, ctx) => {
  const gatewayArn = stringOrUndefined(input["GatewayARN"]);
  const marker = stringOrUndefined(input["Marker"]);
  const limit =
    typeof input["Limit"] === "number" ? (input["Limit"] as number) : undefined;
  const all = ctx.store
    .list<StoredVolume>()
    .filter((e) => e.key.startsWith("vol:"))
    .filter(
      (e) => gatewayArn === undefined || e.value.GatewayARN === gatewayArn,
    )
    .map((e) => ({
      VolumeARN: e.value.VolumeARN,
      VolumeType: e.value.VolumeType,
      GatewayARN: e.value.GatewayARN,
      GatewayId: gatewayKey(e.value.GatewayARN),
      VolumeId: e.value.VolumeId,
      VolumeStatus: e.value.VolumeStatus,
      VolumeSizeInBytes: e.value.VolumeSizeInBytes,
    }));
  const { items, nextMarker } = paginateList(
    all,
    (v) => v.VolumeARN,
    marker,
    limit,
  );
  return { VolumeInfos: items, Marker: nextMarker };
};

const ListVolumeInitiators: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "VolumeARN");
  requireVolume(ctx, arn);
  return { Initiators: [] };
};

const ListVolumeRecoveryPoints: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  requireGateway(ctx, arn);
  return { GatewayARN: arn, VolumeRecoveryPointInfos: [] };
};

const CreateSnapshot: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "VolumeARN");
  requireVolume(ctx, arn);
  const snapshotId = `snap-${hex12()}`;
  return {
    VolumeARN: arn,
    SnapshotId: snapshotId,
  };
};

const CreateSnapshotFromVolumeRecoveryPoint: OperationHandler = (
  input,
  ctx,
) => {
  const arn = requireString(input, "VolumeARN");
  requireVolume(ctx, arn);
  const snapshotId = `snap-${hex12()}`;
  return {
    SnapshotId: snapshotId,
    VolumeARN: arn,
    VolumeRecoveryPointTime: new Date().toISOString(),
  };
};

const UpdateChapCredentials: OperationHandler = (input, ctx) => {
  const targetArn = requireString(input, "TargetARN");
  const initiatorName = requireString(input, "InitiatorName");
  const secret = requireString(input, "SecretToAuthenticateInitiator");
  const chap: StoredChapCredentials = {
    TargetARN: targetArn,
    SecretToAuthenticateInitiator: secret,
    InitiatorName: initiatorName,
    SecretToAuthenticateTarget: stringOrUndefined(
      input["SecretToAuthenticateTarget"],
    ),
  };
  ctx.store.set(chapKey(targetArn), chap);
  return { TargetARN: targetArn, InitiatorName: initiatorName };
};

const DescribeChapCredentials: OperationHandler = (input, ctx) => {
  const targetArn = requireString(input, "TargetARN");
  const chap = ctx.store.get<StoredChapCredentials>(chapKey(targetArn));
  if (!chap) return { ChapCredentials: [] };
  return {
    ChapCredentials: [
      {
        TargetARN: chap.TargetARN,
        SecretToAuthenticateInitiator: chap.SecretToAuthenticateInitiator,
        InitiatorName: chap.InitiatorName,
        SecretToAuthenticateTarget: chap.SecretToAuthenticateTarget,
      },
    ],
  };
};

const DeleteChapCredentials: OperationHandler = (input, ctx) => {
  const targetArn = requireString(input, "TargetARN");
  const initiatorName = requireString(input, "InitiatorName");
  ctx.store.delete(chapKey(targetArn));
  return { TargetARN: targetArn, InitiatorName: initiatorName };
};

const DescribeVTLDevices: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  requireGateway(ctx, arn);
  return { GatewayARN: arn, VTLDevices: [], Marker: undefined };
};

const UpdateVTLDeviceType: OperationHandler = (input, ctx) => {
  const deviceArn = requireString(input, "VTLDeviceARN");
  requireString(input, "DeviceType");
  return { VTLDeviceARN: deviceArn };
};

const CreateNFSFileShare: OperationHandler = (input, ctx) => {
  const gatewayArn = requireString(input, "GatewayARN");
  requireGateway(ctx, gatewayArn);
  const locationArn = requireString(input, "LocationARN");
  const role = requireString(input, "Role");
  const clientToken = stringOrUndefined(input["ClientToken"]);
  if (clientToken !== undefined) {
    const existing = ctx.store
      .list<StoredFileShare>()
      .filter((entry) => entry.key.startsWith("fs:"))
      .map((entry) => entry.value)
      .find(
        (share) =>
          share.FileShareType === "NFS" && share.ClientToken === clientToken,
      );
    if (existing !== undefined) return { FileShareARN: existing.FileShareARN };
  }
  const shareId = hex12();
  const arn = makeFileShareArn(ctx, shareId);
  const share: StoredFileShare = {
    FileShareId: shareId,
    FileShareARN: arn,
    GatewayARN: gatewayArn,
    FileShareType: "NFS",
    FileShareStatus: "AVAILABLE",
    Path: `/${shareId}`,
    LocationARN: locationArn,
    Role: role,
    ClientList: arrayOrEmpty(input["ClientList"]) as string[],
    Squash: stringOrUndefined(input["Squash"]) ?? "RootSquash",
    ReadOnly: boolOrFalse(input["ReadOnly"]),
    GuessMIMETypeEnabled: boolOrFalse(input["GuessMIMETypeEnabled"]),
    RequesterPays: boolOrFalse(input["RequesterPays"]),
    SMBACLEnabled: undefined,
    AccessBasedEnumeration: undefined,
    ValidUserList: undefined,
    InvalidUserList: undefined,
    AuditDestinationARN: stringOrUndefined(input["AuditDestinationARN"]),
    Authentication: undefined,
    CaseSensitivity: undefined,
    FileShareName: stringOrUndefined(input["Name"]),
    Tags: arrayOrEmpty(input["Tags"]),
    NFSFileShareDefaults: recordOrUndefined(input["NFSFileShareDefaults"]),
    CacheAttributes: recordOrUndefined(input["CacheAttributes"]),
    NotificationPolicy: stringOrUndefined(input["NotificationPolicy"]),
    OplocksEnabled: undefined,
    ClientToken: clientToken,
  };
  ctx.store.set(fileShareKey(arn), share);
  return { FileShareARN: arn };
};

const CreateSMBFileShare: OperationHandler = (input, ctx) => {
  const gatewayArn = requireString(input, "GatewayARN");
  requireGateway(ctx, gatewayArn);
  const locationArn = requireString(input, "LocationARN");
  const role = requireString(input, "Role");
  const clientToken = stringOrUndefined(input["ClientToken"]);
  if (clientToken !== undefined) {
    const existing = ctx.store
      .list<StoredFileShare>()
      .filter((entry) => entry.key.startsWith("fs:"))
      .map((entry) => entry.value)
      .find(
        (share) =>
          share.FileShareType === "SMB" && share.ClientToken === clientToken,
      );
    if (existing !== undefined) return { FileShareARN: existing.FileShareARN };
  }
  const shareId = hex12();
  const arn = makeFileShareArn(ctx, shareId);
  const share: StoredFileShare = {
    FileShareId: shareId,
    FileShareARN: arn,
    GatewayARN: gatewayArn,
    FileShareType: "SMB",
    FileShareStatus: "AVAILABLE",
    Path: `/${shareId}`,
    LocationARN: locationArn,
    Role: role,
    ClientList: undefined,
    Squash: undefined,
    ReadOnly: boolOrFalse(input["ReadOnly"]),
    GuessMIMETypeEnabled: boolOrFalse(input["GuessMIMETypeEnabled"]),
    RequesterPays: boolOrFalse(input["RequesterPays"]),
    SMBACLEnabled: boolOrFalse(input["SMBACLEnabled"]),
    AccessBasedEnumeration: boolOrFalse(input["AccessBasedEnumeration"]),
    ValidUserList: arrayOrEmpty(input["ValidUserList"]) as string[],
    InvalidUserList: arrayOrEmpty(input["InvalidUserList"]) as string[],
    AuditDestinationARN: stringOrUndefined(input["AuditDestinationARN"]),
    Authentication: stringOrUndefined(input["Authentication"]),
    CaseSensitivity: stringOrUndefined(input["CaseSensitivity"]),
    FileShareName: stringOrUndefined(input["Name"]),
    Tags: arrayOrEmpty(input["Tags"]),
    NFSFileShareDefaults: undefined,
    CacheAttributes: recordOrUndefined(input["CacheAttributes"]),
    NotificationPolicy: stringOrUndefined(input["NotificationPolicy"]),
    OplocksEnabled: boolOrFalse(input["OplocksEnabled"]),
    ClientToken: clientToken,
  };
  ctx.store.set(fileShareKey(arn), share);
  return { FileShareARN: arn };
};

const UpdateNFSFileShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FileShareARN");
  const share = requireFileShare(ctx, arn);
  const updated: StoredFileShare = {
    ...share,
    ClientList:
      input["ClientList"] !== undefined
        ? (arrayOrEmpty(input["ClientList"]) as string[])
        : share.ClientList,
    Squash: stringOrUndefined(input["Squash"]) ?? share.Squash,
    ReadOnly:
      input["ReadOnly"] !== undefined
        ? boolOrFalse(input["ReadOnly"])
        : share.ReadOnly,
    GuessMIMETypeEnabled:
      input["GuessMIMETypeEnabled"] !== undefined
        ? boolOrFalse(input["GuessMIMETypeEnabled"])
        : share.GuessMIMETypeEnabled,
    RequesterPays:
      input["RequesterPays"] !== undefined
        ? boolOrFalse(input["RequesterPays"])
        : share.RequesterPays,
    NFSFileShareDefaults:
      recordOrUndefined(input["NFSFileShareDefaults"]) ??
      share.NFSFileShareDefaults,
    CacheAttributes:
      recordOrUndefined(input["CacheAttributes"]) ?? share.CacheAttributes,
    NotificationPolicy:
      stringOrUndefined(input["NotificationPolicy"]) ??
      share.NotificationPolicy,
    FileShareName: stringOrUndefined(input["Name"]) ?? share.FileShareName,
    AuditDestinationARN:
      stringOrUndefined(input["AuditDestinationARN"]) ??
      share.AuditDestinationARN,
  };
  ctx.store.set(fileShareKey(arn), updated);
  return { FileShareARN: arn };
};

const UpdateSMBFileShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FileShareARN");
  const share = requireFileShare(ctx, arn);
  const updated: StoredFileShare = {
    ...share,
    ReadOnly:
      input["ReadOnly"] !== undefined
        ? boolOrFalse(input["ReadOnly"])
        : share.ReadOnly,
    GuessMIMETypeEnabled:
      input["GuessMIMETypeEnabled"] !== undefined
        ? boolOrFalse(input["GuessMIMETypeEnabled"])
        : share.GuessMIMETypeEnabled,
    RequesterPays:
      input["RequesterPays"] !== undefined
        ? boolOrFalse(input["RequesterPays"])
        : share.RequesterPays,
    SMBACLEnabled:
      input["SMBACLEnabled"] !== undefined
        ? boolOrFalse(input["SMBACLEnabled"])
        : share.SMBACLEnabled,
    AccessBasedEnumeration:
      input["AccessBasedEnumeration"] !== undefined
        ? boolOrFalse(input["AccessBasedEnumeration"])
        : share.AccessBasedEnumeration,
    ValidUserList:
      input["ValidUserList"] !== undefined
        ? (arrayOrEmpty(input["ValidUserList"]) as string[])
        : share.ValidUserList,
    InvalidUserList:
      input["InvalidUserList"] !== undefined
        ? (arrayOrEmpty(input["InvalidUserList"]) as string[])
        : share.InvalidUserList,
    AuditDestinationARN:
      stringOrUndefined(input["AuditDestinationARN"]) ??
      share.AuditDestinationARN,
    CaseSensitivity:
      stringOrUndefined(input["CaseSensitivity"]) ?? share.CaseSensitivity,
    FileShareName: stringOrUndefined(input["Name"]) ?? share.FileShareName,
    CacheAttributes:
      recordOrUndefined(input["CacheAttributes"]) ?? share.CacheAttributes,
    NotificationPolicy:
      stringOrUndefined(input["NotificationPolicy"]) ??
      share.NotificationPolicy,
    OplocksEnabled:
      input["OplocksEnabled"] !== undefined
        ? boolOrFalse(input["OplocksEnabled"])
        : share.OplocksEnabled,
  };
  ctx.store.set(fileShareKey(arn), updated);
  return { FileShareARN: arn };
};

const DeleteFileShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FileShareARN");
  const share = requireFileShare(ctx, arn);
  ctx.store.delete(fileShareKey(arn));
  ctx.store.delete(tagKey(arn));
  return { FileShareARN: share.FileShareARN };
};

const DescribeNFSFileShares: OperationHandler = (input, ctx) => {
  const arns = arrayOrEmpty(input["FileShareARNList"]) as string[];
  const shares: unknown[] = [];
  for (const arn of arns) {
    const s = ctx.store.get<StoredFileShare>(fileShareKey(arn));
    if (s && s.FileShareType === "NFS") {
      shares.push({
        FileShareId: s.FileShareId,
        FileShareARN: s.FileShareARN,
        FileShareStatus: s.FileShareStatus,
        GatewayARN: s.GatewayARN,
        Path: s.Path,
        LocationARN: s.LocationARN,
        Role: s.Role,
        ClientList: s.ClientList,
        Squash: s.Squash,
        ReadOnly: s.ReadOnly,
        GuessMIMETypeEnabled: s.GuessMIMETypeEnabled,
        RequesterPays: s.RequesterPays,
        NFSFileShareDefaults: s.NFSFileShareDefaults,
        CacheAttributes: s.CacheAttributes,
        NotificationPolicy: s.NotificationPolicy,
        FileShareName: s.FileShareName,
        AuditDestinationARN: s.AuditDestinationARN,
        Tags: s.Tags,
      });
    }
  }
  return { NFSFileShareInfoList: shares };
};

const DescribeSMBFileShares: OperationHandler = (input, ctx) => {
  const arns = arrayOrEmpty(input["FileShareARNList"]) as string[];
  const shares: unknown[] = [];
  for (const arn of arns) {
    const s = ctx.store.get<StoredFileShare>(fileShareKey(arn));
    if (s && s.FileShareType === "SMB") {
      shares.push({
        FileShareId: s.FileShareId,
        FileShareARN: s.FileShareARN,
        FileShareStatus: s.FileShareStatus,
        GatewayARN: s.GatewayARN,
        Path: s.Path,
        LocationARN: s.LocationARN,
        Role: s.Role,
        ReadOnly: s.ReadOnly,
        GuessMIMETypeEnabled: s.GuessMIMETypeEnabled,
        RequesterPays: s.RequesterPays,
        SMBACLEnabled: s.SMBACLEnabled,
        AccessBasedEnumeration: s.AccessBasedEnumeration,
        ValidUserList: s.ValidUserList,
        InvalidUserList: s.InvalidUserList,
        AuditDestinationARN: s.AuditDestinationARN,
        Authentication: s.Authentication,
        CaseSensitivity: s.CaseSensitivity,
        FileShareName: s.FileShareName,
        CacheAttributes: s.CacheAttributes,
        NotificationPolicy: s.NotificationPolicy,
        OplocksEnabled: s.OplocksEnabled,
        Tags: s.Tags,
      });
    }
  }
  return { SMBFileShareInfoList: shares };
};

const ListFileShares: OperationHandler = (input, ctx) => {
  const gatewayArn = stringOrUndefined(input["GatewayARN"]);
  const inputMarker = stringOrUndefined(input["Marker"]);
  const limit =
    typeof input["Limit"] === "number" ? (input["Limit"] as number) : undefined;
  const all = ctx.store
    .list<StoredFileShare>()
    .filter((e) => e.key.startsWith("fs:"))
    .filter(
      (e) => gatewayArn === undefined || e.value.GatewayARN === gatewayArn,
    )
    .map((e) => ({
      Id: e.value.FileShareId,
      FileShareARN: e.value.FileShareARN,
      FileShareType: e.value.FileShareType,
      FileShareStatus: e.value.FileShareStatus,
      GatewayARN: e.value.GatewayARN,
    }));
  const { items, nextMarker } = paginateList(
    all,
    (s) => s.FileShareARN,
    inputMarker,
    limit,
  );
  return {
    Marker: inputMarker,
    NextMarker: nextMarker,
    FileShareInfoList: items,
  };
};

const NotifyWhenUploaded: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FileShareARN");
  const share = requireFileShare(ctx, arn);
  return { FileShareARN: share.FileShareARN, NotificationId: hex12() };
};

const RefreshCache: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FileShareARN");
  const share = requireFileShare(ctx, arn);
  return { FileShareARN: share.FileShareARN, NotificationId: hex12() };
};

const EvictFilesFailingUpload: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FileShareARN");
  requireFileShare(ctx, arn);
  return { FileShareARN: arn, TaskId: hex12() };
};

const CreateTapePool: OperationHandler = (input, ctx) => {
  const poolName = requireString(input, "PoolName");
  const storageClass = requireString(input, "StorageClass");
  const poolId = hex12();
  const arn = makeTapePoolArn(ctx, poolId);
  const pool: StoredTapePool = {
    PoolId: poolId,
    PoolARN: arn,
    PoolName: poolName,
    StorageClass: storageClass,
    RetentionLockType: stringOrUndefined(input["RetentionLockType"]) ?? "NONE",
    RetentionLockTimeInDays:
      typeof input["RetentionLockTimeInDays"] === "number"
        ? input["RetentionLockTimeInDays"]
        : undefined,
    PoolStatus: "ACTIVE",
    CreatedDate: nowSeconds(),
  };
  ctx.store.set(tapePoolKey(arn), pool);
  return { PoolARN: arn };
};

const DeleteTapePool: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "PoolARN");
  const pool = requireTapePool(ctx, arn);
  ctx.store.delete(tapePoolKey(arn));
  return { PoolARN: pool.PoolARN };
};

const ListTapePools: OperationHandler = (input, ctx) => {
  const arns = arrayOrEmpty(input["PoolARNs"]) as string[];
  const marker = stringOrUndefined(input["Marker"]);
  const limit =
    typeof input["Limit"] === "number" ? (input["Limit"] as number) : undefined;
  const all = ctx.store
    .list<StoredTapePool>()
    .filter((e) => e.key.startsWith("tp:"))
    .filter((e) => arns.length === 0 || arns.includes(e.value.PoolARN))
    .map((e) => ({
      PoolARN: e.value.PoolARN,
      PoolName: e.value.PoolName,
      StorageClass: e.value.StorageClass,
      RetentionLockType: e.value.RetentionLockType,
      RetentionLockTimeInDays: e.value.RetentionLockTimeInDays,
      PoolStatus: e.value.PoolStatus,
      CreatedDate: e.value.CreatedDate,
    }));
  const { items, nextMarker } = paginateList(
    all,
    (p) => p.PoolARN,
    marker,
    limit,
  );
  return { PoolInfos: items, Marker: nextMarker };
};

const CreateTapeWithBarcode: OperationHandler = (input, ctx) => {
  const gatewayArn = requireString(input, "GatewayARN");
  requireGateway(ctx, gatewayArn);
  const barcode = requireString(input, "TapeBarcode");
  const tapeSizeInBytes = numberOrZero(input["TapeSizeInBytes"]);
  const arn = makeTapeArn(ctx, barcode);
  const tape: StoredTape = {
    TapeId: barcode,
    TapeARN: arn,
    GatewayARN: gatewayArn,
    TapeBarcode: barcode,
    TapeSizeInBytes: tapeSizeInBytes,
    TapeStatus: "AVAILABLE",
    TapeUsedInBytes: 0,
    KMSKey: stringOrUndefined(input["KMSKey"]),
    PoolId: stringOrUndefined(input["PoolId"]),
    PoolEntryDate: undefined,
    RetentionStartDate: undefined,
    Worm: boolOrFalse(input["Worm"]),
    CreatedDate: nowSeconds(),
    Progress: undefined,
    VTLDevice: undefined,
  };
  ctx.store.set(tapeKey(arn), tape);
  return { TapeARN: arn };
};

const CreateTapes: OperationHandler = (input, ctx) => {
  const gatewayArn = requireString(input, "GatewayARN");
  requireGateway(ctx, gatewayArn);
  const numTapes = numberOrZero(input["NumTapesToCreate"]);
  const barcodePrefix = requireString(input, "TapeBarcodePrefix");
  const tapeSizeInBytes = numberOrZero(input["TapeSizeInBytes"]);
  const arns: string[] = [];
  for (let i = 0; i < numTapes; i += 1) {
    const barcode = `${barcodePrefix}${String(i + 1).padStart(6, "0")}`;
    const arn = makeTapeArn(ctx, barcode);
    const tape: StoredTape = {
      TapeId: barcode,
      TapeARN: arn,
      GatewayARN: gatewayArn,
      TapeBarcode: barcode,
      TapeSizeInBytes: tapeSizeInBytes,
      TapeStatus: "AVAILABLE",
      TapeUsedInBytes: 0,
      KMSKey: stringOrUndefined(input["KMSKey"]),
      PoolId: stringOrUndefined(input["PoolId"]),
      PoolEntryDate: undefined,
      RetentionStartDate: undefined,
      Worm: boolOrFalse(input["Worm"]),
      CreatedDate: nowSeconds(),
      Progress: undefined,
      VTLDevice: undefined,
    };
    ctx.store.set(tapeKey(arn), tape);
    arns.push(arn);
  }
  return { TapeARNs: arns };
};

const DescribeTapes: OperationHandler = (input, ctx) => {
  const arns = arrayOrEmpty(input["TapeARNs"]) as string[];
  const tapes = ctx.store
    .list<StoredTape>()
    .filter((e) => e.key.startsWith("tape:"))
    .filter((e) => arns.length === 0 || arns.includes(e.value.TapeARN))
    .map((e) => ({
      TapeARN: e.value.TapeARN,
      TapeBarcode: e.value.TapeBarcode,
      TapeCreatedDate: e.value.CreatedDate,
      TapeSizeInBytes: e.value.TapeSizeInBytes,
      TapeStatus: e.value.TapeStatus,
      VTLDevice: e.value.VTLDevice,
      Progress: e.value.Progress,
      TapeUsedInBytes: e.value.TapeUsedInBytes,
      KMSKey: e.value.KMSKey,
      PoolId: e.value.PoolId,
      Worm: e.value.Worm,
      RetentionStartDate: e.value.RetentionStartDate,
      PoolEntryDate: e.value.PoolEntryDate,
    }));
  return { Tapes: tapes };
};

const ListTapes: OperationHandler = (input, ctx) => {
  const arns = arrayOrEmpty(input["TapeARNs"]) as string[];
  const marker = stringOrUndefined(input["Marker"]);
  const limit =
    typeof input["Limit"] === "number" ? (input["Limit"] as number) : undefined;
  const all = ctx.store
    .list<StoredTape>()
    .filter((e) => e.key.startsWith("tape:"))
    .filter((e) => arns.length === 0 || arns.includes(e.value.TapeARN))
    .map((e) => ({
      TapeARN: e.value.TapeARN,
      TapeBarcode: e.value.TapeBarcode,
      TapeSizeInBytes: e.value.TapeSizeInBytes,
      TapeStatus: e.value.TapeStatus,
      GatewayARN: e.value.GatewayARN,
      PoolId: e.value.PoolId,
      Worm: e.value.Worm,
      RetentionStartDate: e.value.RetentionStartDate,
      PoolEntryDate: e.value.PoolEntryDate,
    }));
  const { items, nextMarker } = paginateList(
    all,
    (t) => t.TapeARN,
    marker,
    limit,
  );
  return { TapeInfos: items, Marker: nextMarker };
};

const AssignTapePool: OperationHandler = (input, ctx) => {
  const tapeArn = requireString(input, "TapeARN");
  const poolId = requireString(input, "PoolId");
  const tape = requireTape(ctx, tapeArn);
  ctx.store.set(tapeKey(tapeArn), { ...tape, PoolId: poolId });
  return { TapeARN: tapeArn };
};

const DeleteTape: OperationHandler = (input, ctx) => {
  const tapeArn = requireString(input, "TapeARN");
  requireGateway(ctx, requireString(input, "GatewayARN"));
  const tape = requireTape(ctx, tapeArn);
  ctx.store.delete(tapeKey(tapeArn));
  return { TapeARN: tape.TapeARN };
};

const RetrieveTapeArchive: OperationHandler = (input, ctx) => {
  const tapeArn = requireString(input, "TapeARN");
  requireGateway(ctx, requireString(input, "GatewayARN"));
  const tape = requireTape(ctx, tapeArn);
  ctx.store.set(tapeKey(tapeArn), { ...tape, TapeStatus: "RETRIEVING" });
  return { TapeARN: tapeArn };
};

const RetrieveTapeRecoveryPoint: OperationHandler = (input, ctx) => {
  const tapeArn = requireString(input, "TapeARN");
  requireGateway(ctx, requireString(input, "GatewayARN"));
  const tape = requireTape(ctx, tapeArn);
  ctx.store.set(tapeKey(tapeArn), { ...tape, TapeStatus: "RETRIEVING" });
  return { TapeARN: tapeArn };
};

const CancelRetrieval: OperationHandler = (input, ctx) => {
  const tapeArn = requireString(input, "TapeARN");
  requireGateway(ctx, requireString(input, "GatewayARN"));
  const tape = requireTape(ctx, tapeArn);
  ctx.store.set(tapeKey(tapeArn), { ...tape, TapeStatus: "ARCHIVED" });
  return { TapeARN: tapeArn };
};

const DescribeTapeArchives: OperationHandler = (input, ctx) => {
  const arns = arrayOrEmpty(input["TapeARNs"]) as string[];
  const tapes = ctx.store
    .list<StoredTape>()
    .filter((e) => e.key.startsWith("tape:"))
    .filter(
      (e) =>
        e.value.TapeStatus === "ARCHIVED" &&
        (arns.length === 0 || arns.includes(e.value.TapeARN)),
    )
    .map((e) => ({
      TapeARN: e.value.TapeARN,
      TapeBarcode: e.value.TapeBarcode,
      TapeCreatedDate: e.value.CreatedDate,
      TapeSizeInBytes: e.value.TapeSizeInBytes,
      CompletionTime: e.value.CreatedDate,
      RetrievedTo: e.value.GatewayARN,
      TapeStatus: e.value.TapeStatus,
      TapeUsedInBytes: e.value.TapeUsedInBytes,
      KMSKey: e.value.KMSKey,
      PoolId: e.value.PoolId,
      Worm: e.value.Worm,
      RetentionStartDate: e.value.RetentionStartDate,
      PoolEntryDate: e.value.PoolEntryDate,
    }));
  return { TapeArchives: tapes };
};

const DeleteTapeArchive: OperationHandler = (input, ctx) => {
  const tapeArn = requireString(input, "TapeARN");
  const tape = requireTape(ctx, tapeArn);
  if (tape.TapeStatus !== "ARCHIVED") {
    throw awsError(
      "InvalidGatewayRequestException",
      `Cannot delete tape ${tapeArn}: status must be ARCHIVED.`,
      400,
    );
  }
  ctx.store.delete(tapeKey(tapeArn));
  return { TapeARN: tapeArn };
};

const CancelArchival: OperationHandler = (input, ctx) => {
  const tapeArn = requireString(input, "TapeARN");
  requireGateway(ctx, requireString(input, "GatewayARN"));
  const tape = requireTape(ctx, tapeArn);
  ctx.store.set(tapeKey(tapeArn), { ...tape, TapeStatus: "AVAILABLE" });
  return { TapeARN: tapeArn };
};

const DescribeTapeRecoveryPoints: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  requireGateway(ctx, arn);
  return { GatewayARN: arn, TapeRecoveryPointInfos: [], Marker: undefined };
};

const UpdateAutomaticTapeCreationPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  ctx.store.set(gateway.GatewayId, {
    ...gateway,
    AutomaticTapeCreationPolicies: arrayOrEmpty(
      input["AutomaticTapeCreationRules"],
    ),
  });
  return { GatewayARN: gateway.GatewayARN };
};

const DeleteAutomaticTapeCreationPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  ctx.store.set(gateway.GatewayId, {
    ...gateway,
    AutomaticTapeCreationPolicies: [],
  });
  return { GatewayARN: gateway.GatewayARN };
};

const ListAutomaticTapeCreationPolicies: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["GatewayARN"]);
  const policies: unknown[] = [];
  const gateways = ctx.store
    .list<StoredGateway>()
    .filter((e) => !e.key.includes(":"));
  for (const entry of gateways) {
    if (arn === undefined || entry.value.GatewayARN === arn) {
      for (const rule of entry.value.AutomaticTapeCreationPolicies) {
        policies.push({
          ...(rule as Record<string, unknown>),
          GatewayARN: entry.value.GatewayARN,
        });
      }
    }
  }
  return { AutomaticTapeCreationPolicyInfos: policies };
};

const DescribeSnapshotSchedule: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "VolumeARN");
  const schedule = requireSnapshotSchedule(ctx, arn);
  return {
    VolumeARN: schedule.VolumeARN,
    StartAt: schedule.StartAt,
    RecurrenceInHours: schedule.RecurrenceInHours,
    Description: schedule.Description,
    Timezone: schedule.Timezone,
    Tags: schedule.Tags,
  };
};

const UpdateSnapshotSchedule: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "VolumeARN");
  const recurrenceInHours = numberOrZero(input["RecurrenceInHours"]);
  const startAt = numberOrZero(input["StartAt"]);
  const existing = ctx.store.get<StoredSnapshotSchedule>(snapshotKey(arn));
  const schedule: StoredSnapshotSchedule = {
    VolumeARN: arn,
    StartAt: startAt,
    RecurrenceInHours: recurrenceInHours,
    Description: stringOrUndefined(input["Description"]),
    Timezone:
      stringOrUndefined(input["Timezone"]) ?? existing?.Timezone ?? "GMT",
    Tags: arrayOrEmpty(input["Tags"]),
  };
  ctx.store.set(snapshotKey(arn), schedule);
  return { VolumeARN: arn };
};

const DeleteSnapshotSchedule: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "VolumeARN");
  requireSnapshotSchedule(ctx, arn);
  ctx.store.delete(snapshotKey(arn));
  return { VolumeARN: arn };
};

const AssociateFileSystem: OperationHandler = (input, ctx) => {
  const gatewayArn = requireString(input, "GatewayARN");
  requireGateway(ctx, gatewayArn);
  const locationArn = requireString(input, "LocationARN");
  const fsaId = hex12();
  const arn = makeFsaArn(ctx, fsaId);
  const fsa: StoredFileSystemAssociation = {
    FileSystemAssociationId: fsaId,
    FileSystemAssociationARN: arn,
    GatewayARN: gatewayArn,
    LocationARN: locationArn,
    AuditDestinationARN: stringOrUndefined(input["AuditDestinationARN"]),
    FileSystemAssociationStatus: "AVAILABLE",
    Tags: arrayOrEmpty(input["Tags"]),
    CacheAttributes: recordOrUndefined(input["CacheAttributes"]),
    EndpointNetworkConfiguration: recordOrUndefined(
      input["EndpointNetworkConfiguration"],
    ),
  };
  ctx.store.set(fsaKey(arn), fsa);
  return { FileSystemAssociationARN: arn };
};

const DisassociateFileSystem: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FileSystemAssociationARN");
  const fsa = requireFileSystemAssociation(ctx, arn);
  ctx.store.delete(fsaKey(arn));
  return { FileSystemAssociationARN: fsa.FileSystemAssociationARN };
};

const UpdateFileSystemAssociation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FileSystemAssociationARN");
  const fsa = requireFileSystemAssociation(ctx, arn);
  const updated: StoredFileSystemAssociation = {
    ...fsa,
    AuditDestinationARN:
      stringOrUndefined(input["AuditDestinationARN"]) ??
      fsa.AuditDestinationARN,
    CacheAttributes:
      recordOrUndefined(input["CacheAttributes"]) ?? fsa.CacheAttributes,
  };
  ctx.store.set(fsaKey(arn), updated);
  return { FileSystemAssociationARN: arn };
};

const DescribeFileSystemAssociations: OperationHandler = (input, ctx) => {
  const arns = arrayOrEmpty(input["FileSystemAssociationARNList"]) as string[];
  const results: unknown[] = [];
  for (const arn of arns) {
    const fsa = ctx.store.get<StoredFileSystemAssociation>(fsaKey(arn));
    if (fsa) {
      results.push({
        FileSystemAssociationARN: fsa.FileSystemAssociationARN,
        LocationARN: fsa.LocationARN,
        FileSystemAssociationStatus: fsa.FileSystemAssociationStatus,
        AuditDestinationARN: fsa.AuditDestinationARN,
        GatewayARN: fsa.GatewayARN,
        Tags: fsa.Tags,
        CacheAttributes: fsa.CacheAttributes,
        EndpointNetworkConfiguration: fsa.EndpointNetworkConfiguration,
      });
    }
  }
  return { FileSystemAssociationInfoList: results };
};

const ListFileSystemAssociations: OperationHandler = (input, ctx) => {
  const gatewayArn = stringOrUndefined(input["GatewayARN"]);
  const fsas = ctx.store
    .list<StoredFileSystemAssociation>()
    .filter((e) => e.key.startsWith("fsa:"))
    .filter(
      (e) => gatewayArn === undefined || e.value.GatewayARN === gatewayArn,
    )
    .map((e) => ({
      FileSystemAssociationId: e.value.FileSystemAssociationId,
      FileSystemAssociationARN: e.value.FileSystemAssociationARN,
      FileSystemAssociationStatus: e.value.FileSystemAssociationStatus,
      GatewayARN: e.value.GatewayARN,
    }));
  return { FileSystemAssociationSummaryList: fsas };
};

const StartCacheReport: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "FileShareARN");
  const share = requireFileShare(ctx, arn);
  void share;
  const reportId = hex12();
  const reportArn = `arn:aws:storagegateway:${ctx.region}:${ctx.account}:cache-report/${reportId}`;
  ctx.store.set(`cr:${reportArn}`, {
    CacheReportARN: reportArn,
    CacheReportStatus: "IN_PROGRESS",
    FileShareARN: arn,
    CreatedDate: nowSeconds(),
    CompletedDate: undefined,
    ReportName: stringOrUndefined(input["ReportName"]),
    ReportPrefix: stringOrUndefined(input["ReportPrefix"]),
    BucketRegion: stringOrUndefined(input["BucketRegion"]),
    LocationARN: stringOrUndefined(input["LocationARN"]),
    ClientToken: stringOrUndefined(input["ClientToken"]),
    InclusionFilters: arrayOrEmpty(input["InclusionFilters"]),
    ExclusionFilters: arrayOrEmpty(input["ExclusionFilters"]),
    ReportTags: arrayOrEmpty(input["Tags"]),
  });
  return { CacheReportARN: reportArn };
};

const DescribeCacheReport: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CacheReportARN");
  const report = ctx.store.get<Record<string, unknown>>(`cr:${arn}`);
  if (!report) {
    throw awsError(
      "InvalidGatewayRequestException",
      `Unknown cache report ${arn}.`,
      400,
    );
  }
  return {
    CacheReportInfo: {
      CacheReportARN: report["CacheReportARN"],
      CacheReportStatus: report["CacheReportStatus"],
      FileShareARN: report["FileShareARN"],
      CreatedDate: report["CreatedDate"],
      CompletedDate: report["CompletedDate"],
      ReportName: report["ReportName"],
      ReportPrefix: report["ReportPrefix"],
      BucketRegion: report["BucketRegion"],
      LocationARN: report["LocationARN"],
      ClientToken: report["ClientToken"],
      InclusionFilters: report["InclusionFilters"],
      ExclusionFilters: report["ExclusionFilters"],
      Tags: report["ReportTags"],
    },
  };
};

const ListCacheReports: OperationHandler = (_input, ctx) => {
  const reports = ctx.store
    .list<Record<string, unknown>>()
    .filter((e) => e.key.startsWith("cr:"))
    .map((e) => ({
      CacheReportARN: e.value["CacheReportARN"],
      CacheReportStatus: e.value["CacheReportStatus"],
      FileShareARN: e.value["FileShareARN"],
      CreatedDate: e.value["CreatedDate"],
      CompletedDate: e.value["CompletedDate"],
      ReportName: e.value["ReportName"],
    }));
  return { CacheReportList: reports };
};

const DeleteCacheReport: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CacheReportARN");
  ctx.store.delete(`cr:${arn}`);
  return { CacheReportARN: arn };
};

const CancelCacheReport: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CacheReportARN");
  const report = ctx.store.get<Record<string, unknown>>(`cr:${arn}`);
  if (report) {
    ctx.store.set(`cr:${arn}`, { ...report, CacheReportStatus: "CANCELLED" });
  }
  return { CacheReportARN: arn };
};

const storagegateway: ServiceDefinition = {
  name: "storagegateway",
  protocol: "json",
  operations: {
    ActivateGateway,
    ListGateways,
    DescribeGatewayInformation,
    DeleteGateway,
    StartGateway,
    ShutdownGateway,
    DisableGateway,
    UpdateGatewayInformation,
    UpdateGatewaySoftwareNow,
    AddTagsToResource,
    RemoveTagsFromResource,
    ListTagsForResource,
    ListLocalDisks,
    AddCache,
    AddUploadBuffer,
    AddWorkingStorage,
    DescribeCache,
    DescribeUploadBuffer,
    DescribeWorkingStorage,
    ResetCache,
    DescribeBandwidthRateLimit,
    DescribeBandwidthRateLimitSchedule,
    UpdateBandwidthRateLimit,
    UpdateBandwidthRateLimitSchedule,
    DeleteBandwidthRateLimit,
    DescribeMaintenanceStartTime,
    UpdateMaintenanceStartTime,
    JoinDomain,
    DescribeSMBSettings,
    UpdateSMBSecurityStrategy,
    UpdateSMBFileShareVisibility,
    UpdateSMBLocalGroups,
    SetLocalConsolePassword,
    SetSMBGuestPassword,
    StartAvailabilityMonitorTest,
    DescribeAvailabilityMonitorTest,
    CreateCachediSCSIVolume,
    CreateStorediSCSIVolume,
    AttachVolume,
    DetachVolume,
    DeleteVolume,
    DescribeCachediSCSIVolumes,
    DescribeStorediSCSIVolumes,
    ListVolumes,
    ListVolumeInitiators,
    ListVolumeRecoveryPoints,
    CreateSnapshot,
    CreateSnapshotFromVolumeRecoveryPoint,
    UpdateChapCredentials,
    DescribeChapCredentials,
    DeleteChapCredentials,
    DescribeVTLDevices,
    UpdateVTLDeviceType,
    CreateNFSFileShare,
    CreateSMBFileShare,
    UpdateNFSFileShare,
    UpdateSMBFileShare,
    DeleteFileShare,
    DescribeNFSFileShares,
    DescribeSMBFileShares,
    ListFileShares,
    NotifyWhenUploaded,
    RefreshCache,
    EvictFilesFailingUpload,
    CreateTapePool,
    DeleteTapePool,
    ListTapePools,
    CreateTapeWithBarcode,
    CreateTapes,
    DescribeTapes,
    ListTapes,
    AssignTapePool,
    DeleteTape,
    RetrieveTapeArchive,
    RetrieveTapeRecoveryPoint,
    CancelRetrieval,
    DescribeTapeArchives,
    DeleteTapeArchive,
    CancelArchival,
    DescribeTapeRecoveryPoints,
    UpdateAutomaticTapeCreationPolicy,
    DeleteAutomaticTapeCreationPolicy,
    ListAutomaticTapeCreationPolicies,
    DescribeSnapshotSchedule,
    UpdateSnapshotSchedule,
    DeleteSnapshotSchedule,
    AssociateFileSystem,
    DisassociateFileSystem,
    UpdateFileSystemAssociation,
    DescribeFileSystemAssociations,
    ListFileSystemAssociations,
    StartCacheReport,
    DescribeCacheReport,
    ListCacheReports,
    DeleteCacheReport,
    CancelCacheReport,
  },
  model,
} as const;

export default storagegateway;
