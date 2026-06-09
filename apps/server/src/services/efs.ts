import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import efsModel from "../../../../test/vendor/aws-models/efs.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(efsModel);

type StoredFileSystem = {
  ownerId: string;
  creationToken: string;
  fileSystemId: string;
  fileSystemArn: string;
  creationTime: number;
  lifeCycleState: string;
  name: string | undefined;
  numberOfMountTargets: number;
  sizeInBytes: { Value: number; Timestamp: number };
  performanceMode: string;
  encrypted: boolean;
  kmsKeyId: string | undefined;
  throughputMode: string;
  provisionedThroughputInMibps: number | undefined;
  availabilityZoneName: string | undefined;
  availabilityZoneId: string | undefined;
  tags: { Key: string; Value: string }[];
  replicationOverwriteProtection: string;
};

type StoredMountTarget = {
  ownerId: string;
  mountTargetId: string;
  fileSystemId: string;
  subnetId: string;
  lifeCycleState: string;
  ipAddress: string;
  networkInterfaceId: string;
  availabilityZoneName: string;
  vpcId: string;
};

type StoredLifecycle = {
  fileSystemId: string;
  policies: Record<string, unknown>[];
};

type StoredAccessPoint = {
  clientToken: string;
  name: string | undefined;
  tags: { Key: string; Value: string }[];
  accessPointId: string;
  accessPointArn: string;
  fileSystemId: string;
  posixUser: Record<string, unknown> | undefined;
  rootDirectory: Record<string, unknown> | undefined;
  ownerId: string;
  lifeCycleState: string;
};

type StoredPolicy = {
  fileSystemId: string;
  policy: string;
};

type StoredBackupPolicy = {
  fileSystemId: string;
  status: string;
};

type StoredSecurityGroups = {
  mountTargetId: string;
  securityGroups: string[];
};

type StoredReplication = {
  sourceFileSystemId: string;
  sourceFileSystemRegion: string;
  sourceFileSystemArn: string;
  originalSourceFileSystemArn: string;
  creationTime: number;
  destinations: Array<{
    status: string;
    fileSystemId: string;
    region: string;
    ownerId: string;
  }>;
  sourceFileSystemOwnerId: string;
};

type StoredAccountPreferences = {
  resourceIdType: string;
  resources: string[];
};

const fileSystemKey = (id: string): string => `fs/${id}`;
const mountTargetKey = (id: string): string => `mt/${id}`;
const lifecycleKey = (id: string): string => `lc/${id}`;
const accessPointKey = (id: string): string => `ap/${id}`;
const policyKey = (id: string): string => `policy/${id}`;
const backupKey = (id: string): string => `backup/${id}`;
const sgKey = (id: string): string => `sg/${id}`;
const replKey = (id: string): string => `repl/${id}`;
const acctPrefsKey = (): string => `acct/prefs`;

const hex = (length: number): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

const azNameToZoneId = (azName: string): string => {
  const letter = azName.slice(-1);
  const num = letter.charCodeAt(0) - 96;
  const region = azName.slice(0, -1);
  const short = region
    .split("-")
    .map((p) => (/^\d+$/.test(p) ? p : p[0]))
    .join("");
  return `${short}-az${num}`;
};

const applyMarkerPagination = <T>(
  items: T[],
  marker: string | undefined,
  maxItems: number | undefined,
  getKey: (item: T) => string,
): { items: T[]; nextMarker: string | undefined } => {
  const limit = typeof maxItems === "number" && maxItems > 0 ? maxItems : 100;
  let start = 0;
  if (marker !== undefined) {
    const idx = items.findIndex((item) => getKey(item) === marker);
    if (idx !== -1) start = idx;
  }
  const page = items.slice(start, start + limit);
  const nextMarker =
    start + limit < items.length ? getKey(items[start + limit]) : undefined;
  return { items: page, nextMarker };
};

const applyTokenPagination = <T>(
  items: T[],
  nextToken: string | undefined,
  maxResults: number | undefined,
  getKey: (item: T) => string,
): { items: T[]; nextToken: string | undefined } => {
  const limit =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : 100;
  let start = 0;
  if (nextToken !== undefined) {
    const idx = items.findIndex((item) => getKey(item) === nextToken);
    if (idx !== -1) start = idx;
  }
  const page = items.slice(start, start + limit);
  const outToken =
    start + limit < items.length ? getKey(items[start + limit]) : undefined;
  return { items: page, nextToken: outToken };
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const tagsFromInput = (value: unknown): { Key: string; Value: string }[] => {
  if (!Array.isArray(value)) return [];
  const tags: { Key: string; Value: string }[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const key = stringOrUndefined(record["Key"]);
    const tagValue = typeof record["Value"] === "string" ? record["Value"] : "";
    if (key === undefined) continue;
    tags.push({ Key: key, Value: tagValue });
  }
  return tags;
};

const fileSystemView = (
  fileSystem: StoredFileSystem,
): Record<string, unknown> => ({
  OwnerId: fileSystem.ownerId,
  CreationToken: fileSystem.creationToken,
  FileSystemId: fileSystem.fileSystemId,
  FileSystemArn: fileSystem.fileSystemArn,
  CreationTime: fileSystem.creationTime,
  LifeCycleState: fileSystem.lifeCycleState,
  Name: fileSystem.name,
  NumberOfMountTargets: fileSystem.numberOfMountTargets,
  SizeInBytes: fileSystem.sizeInBytes,
  PerformanceMode: fileSystem.performanceMode,
  Encrypted: fileSystem.encrypted,
  KmsKeyId: fileSystem.kmsKeyId,
  ThroughputMode: fileSystem.throughputMode,
  ProvisionedThroughputInMibps: fileSystem.provisionedThroughputInMibps,
  AvailabilityZoneName: fileSystem.availabilityZoneName,
  AvailabilityZoneId: fileSystem.availabilityZoneId,
  Tags: fileSystem.tags,
  FileSystemProtection: {
    ReplicationOverwriteProtection: fileSystem.replicationOverwriteProtection,
  },
});

const mountTargetView = (
  mountTarget: StoredMountTarget,
): Record<string, unknown> => ({
  OwnerId: mountTarget.ownerId,
  MountTargetId: mountTarget.mountTargetId,
  FileSystemId: mountTarget.fileSystemId,
  SubnetId: mountTarget.subnetId,
  LifeCycleState: mountTarget.lifeCycleState,
  IpAddress: mountTarget.ipAddress,
  NetworkInterfaceId: mountTarget.networkInterfaceId,
  AvailabilityZoneName: mountTarget.availabilityZoneName,
  VpcId: mountTarget.vpcId,
});

const accessPointView = (ap: StoredAccessPoint): Record<string, unknown> => ({
  ClientToken: ap.clientToken,
  Name: ap.name,
  Tags: ap.tags,
  AccessPointId: ap.accessPointId,
  AccessPointArn: ap.accessPointArn,
  FileSystemId: ap.fileSystemId,
  PosixUser: ap.posixUser,
  RootDirectory: ap.rootDirectory,
  OwnerId: ap.ownerId,
  LifeCycleState: ap.lifeCycleState,
});

const replicationView = (r: StoredReplication): Record<string, unknown> => ({
  SourceFileSystemId: r.sourceFileSystemId,
  SourceFileSystemRegion: r.sourceFileSystemRegion,
  SourceFileSystemArn: r.sourceFileSystemArn,
  OriginalSourceFileSystemArn: r.originalSourceFileSystemArn,
  CreationTime: r.creationTime,
  Destinations: r.destinations.map((d) => ({
    Status: d.status,
    FileSystemId: d.fileSystemId,
    Region: d.region,
    OwnerId: d.ownerId,
  })),
  SourceFileSystemOwnerId: r.sourceFileSystemOwnerId,
});

const requireFileSystem = (
  ctx: ServiceContext,
  fileSystemId: string,
): StoredFileSystem => {
  const fileSystem = ctx.store.get<StoredFileSystem>(
    fileSystemKey(fileSystemId),
  );
  if (fileSystem === undefined) {
    throw awsError(
      "FileSystemNotFound",
      `File system '${fileSystemId}' does not exist.`,
      404,
    );
  }
  return fileSystem;
};

const requireAvailableFileSystem = (
  ctx: ServiceContext,
  fileSystemId: string,
): StoredFileSystem => {
  const fs = requireFileSystem(ctx, fileSystemId);
  if (fs.lifeCycleState !== "available") {
    throw awsError(
      "IncorrectFileSystemLifeCycleState",
      `File system '${fileSystemId}' is not in the available state.`,
      409,
    );
  }
  return fs;
};

const requireMountTarget = (
  ctx: ServiceContext,
  mountTargetId: string,
): StoredMountTarget => {
  const mt = ctx.store.get<StoredMountTarget>(mountTargetKey(mountTargetId));
  if (mt === undefined) {
    throw awsError(
      "MountTargetNotFound",
      `Mount target '${mountTargetId}' does not exist.`,
      404,
    );
  }
  return mt;
};

const resourceArnToFileSystemId = (
  ctx: ServiceContext,
  resourceId: string,
): string | undefined => {
  if (resourceId.startsWith("fs-")) return resourceId;
  const fileSystems = ctx.store
    .list<StoredFileSystem>()
    .filter((e) => e.key.startsWith("fs/"))
    .map((e) => e.value)
    .find((fs) => fs.fileSystemArn === resourceId);
  if (fileSystems !== undefined) return fileSystems.fileSystemId;
  return undefined;
};

const resourceArnToAccessPointId = (
  ctx: ServiceContext,
  resourceId: string,
): string | undefined => {
  if (resourceId.startsWith("fsap-")) return resourceId;
  const ap = ctx.store
    .list<StoredAccessPoint>()
    .filter((e) => e.key.startsWith("ap/"))
    .map((e) => e.value)
    .find((a) => a.accessPointArn === resourceId);
  if (ap !== undefined) return ap.accessPointId;
  return undefined;
};

const getResourceTags = (
  ctx: ServiceContext,
  resourceId: string,
): { Key: string; Value: string }[] => {
  const fsId = resourceArnToFileSystemId(ctx, resourceId);
  if (fsId !== undefined) {
    const fs = ctx.store.get<StoredFileSystem>(fileSystemKey(fsId));
    return fs?.tags ?? [];
  }
  const apId = resourceArnToAccessPointId(ctx, resourceId);
  if (apId !== undefined) {
    const ap = ctx.store.get<StoredAccessPoint>(accessPointKey(apId));
    return ap?.tags ?? [];
  }
  return [];
};

const setResourceTags = (
  ctx: ServiceContext,
  resourceId: string,
  tags: { Key: string; Value: string }[],
): void => {
  const fsId = resourceArnToFileSystemId(ctx, resourceId);
  if (fsId !== undefined) {
    const fs = ctx.store.get<StoredFileSystem>(fileSystemKey(fsId));
    if (fs !== undefined) {
      ctx.store.set(fileSystemKey(fsId), { ...fs, tags });
    }
    return;
  }
  const apId = resourceArnToAccessPointId(ctx, resourceId);
  if (apId !== undefined) {
    const ap = ctx.store.get<StoredAccessPoint>(accessPointKey(apId));
    if (ap !== undefined) {
      ctx.store.set(accessPointKey(apId), { ...ap, tags });
    }
  }
};

const CreateFileSystem: OperationHandler = (input, ctx) => {
  const creationToken = stringOrUndefined(input["CreationToken"]);
  if (creationToken === undefined) {
    throw awsError("BadRequest", "CreationToken is required.", 400);
  }
  const existing = ctx.store
    .list<StoredFileSystem>()
    .filter((entry) => entry.key.startsWith("fs/"))
    .find((entry) => entry.value.creationToken === creationToken);
  if (existing !== undefined) {
    throw awsError(
      "FileSystemAlreadyExists",
      `File system already exists with creation token '${creationToken}'.`,
      409,
    );
  }
  const kmsKeyId = stringOrUndefined(input["KmsKeyId"]);
  if (kmsKeyId !== undefined && input["Encrypted"] !== true) {
    throw awsError("BadRequest", "KmsKeyId requires Encrypted=true.", 400);
  }
  const availabilityZoneName = stringOrUndefined(input["AvailabilityZoneName"]);
  const availabilityZoneId =
    availabilityZoneName !== undefined
      ? azNameToZoneId(availabilityZoneName)
      : undefined;
  const fileSystemId = `fs-${hex(8)}`;
  const tags = tagsFromInput(input["Tags"]);
  const nameTag = tags.find((tag) => tag.Key === "Name");
  const fileSystem: StoredFileSystem = {
    ownerId: ctx.account,
    creationToken,
    fileSystemId,
    fileSystemArn: `arn:aws:elasticfilesystem:${ctx.region}:${ctx.account}:file-system/${fileSystemId}`,
    creationTime: Math.floor(Date.now() / 1000),
    lifeCycleState: "available",
    name: nameTag?.Value,
    numberOfMountTargets: 0,
    sizeInBytes: { Value: 0, Timestamp: Math.floor(Date.now() / 1000) },
    performanceMode:
      stringOrUndefined(input["PerformanceMode"]) ?? "generalPurpose",
    encrypted: input["Encrypted"] === true,
    kmsKeyId,
    throughputMode: stringOrUndefined(input["ThroughputMode"]) ?? "bursting",
    provisionedThroughputInMibps: undefined,
    availabilityZoneName,
    availabilityZoneId,
    tags,
    replicationOverwriteProtection: "ENABLED",
  };
  ctx.store.set(fileSystemKey(fileSystemId), fileSystem);
  const backup = input["Backup"];
  if (
    backup === true ||
    (backup === undefined && availabilityZoneName !== undefined)
  ) {
    ctx.store.set(backupKey(fileSystemId), {
      fileSystemId,
      status: "ENABLED",
    } satisfies StoredBackupPolicy);
  }
  return fileSystemView(fileSystem);
};

const DescribeFileSystems: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  const creationToken = stringOrUndefined(input["CreationToken"]);
  const marker = stringOrUndefined(input["Marker"]);
  const maxItems =
    typeof input["MaxItems"] === "number" ? input["MaxItems"] : undefined;
  const filtered = ctx.store
    .list<StoredFileSystem>()
    .filter((entry) => entry.key.startsWith("fs/"))
    .map((entry) => entry.value)
    .filter(
      (fileSystem) =>
        (fileSystemId === undefined ||
          fileSystem.fileSystemId === fileSystemId) &&
        (creationToken === undefined ||
          fileSystem.creationToken === creationToken),
    );
  const { items, nextMarker } = applyMarkerPagination(
    filtered,
    marker,
    maxItems,
    (fs) => fs.fileSystemId,
  );
  return {
    Marker: marker,
    FileSystems: items.map(fileSystemView),
    ...(nextMarker !== undefined ? { NextMarker: nextMarker } : {}),
  };
};

const DeleteFileSystem: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  const fileSystem = requireFileSystem(ctx, fileSystemId);
  const mountTargets = ctx.store
    .list<StoredMountTarget>()
    .filter((entry) => entry.key.startsWith("mt/"))
    .filter((entry) => entry.value.fileSystemId === fileSystemId);
  if (mountTargets.length > 0) {
    throw awsError(
      "FileSystemInUse",
      `File system '${fileSystemId}' has mount targets and cannot be deleted.`,
      409,
    );
  }
  ctx.store.delete(fileSystemKey(fileSystem.fileSystemId));
  ctx.store.delete(lifecycleKey(fileSystem.fileSystemId));
  ctx.store.delete(policyKey(fileSystem.fileSystemId));
  ctx.store.delete(backupKey(fileSystem.fileSystemId));
  return undefined;
};

const UpdateFileSystem: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  const fileSystem = requireAvailableFileSystem(ctx, fileSystemId);
  const throughputMode = stringOrUndefined(input["ThroughputMode"]);
  const provisionedThroughputInMibps =
    typeof input["ProvisionedThroughputInMibps"] === "number"
      ? input["ProvisionedThroughputInMibps"]
      : undefined;
  const effectiveThroughputMode = throughputMode ?? fileSystem.throughputMode;
  if (
    provisionedThroughputInMibps !== undefined &&
    effectiveThroughputMode !== "provisioned"
  ) {
    throw awsError(
      "BadRequest",
      "ProvisionedThroughputInMibps requires ThroughputMode=provisioned.",
      400,
    );
  }
  const updated: StoredFileSystem = {
    ...fileSystem,
    ...(throughputMode !== undefined ? { throughputMode } : {}),
    ...(provisionedThroughputInMibps !== undefined
      ? { provisionedThroughputInMibps }
      : {}),
  };
  ctx.store.set(fileSystemKey(fileSystemId), updated);
  return fileSystemView(updated);
};

const UpdateFileSystemProtection: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  const fileSystem = requireFileSystem(ctx, fileSystemId);
  const replicationOverwriteProtection =
    stringOrUndefined(input["ReplicationOverwriteProtection"]) ?? "ENABLED";
  const updated: StoredFileSystem = {
    ...fileSystem,
    replicationOverwriteProtection,
  };
  ctx.store.set(fileSystemKey(fileSystemId), updated);
  return { ReplicationOverwriteProtection: replicationOverwriteProtection };
};

const PutFileSystemPolicy: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  const policy = stringOrUndefined(input["Policy"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  if (policy === undefined) {
    throw awsError("BadRequest", "Policy is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  const stored: StoredPolicy = { fileSystemId, policy };
  ctx.store.set(policyKey(fileSystemId), stored);
  return { FileSystemId: fileSystemId, Policy: policy };
};

const DescribeFileSystemPolicy: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  const stored = ctx.store.get<StoredPolicy>(policyKey(fileSystemId));
  if (stored === undefined) {
    throw awsError(
      "PolicyNotFound",
      `No policy found for file system '${fileSystemId}'.`,
      404,
    );
  }
  return { FileSystemId: fileSystemId, Policy: stored.policy };
};

const DeleteFileSystemPolicy: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  ctx.store.delete(policyKey(fileSystemId));
  return undefined;
};

const PutBackupPolicy: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  const backupPolicyInput = input["BackupPolicy"] as
    | Record<string, unknown>
    | undefined;
  const status = stringOrUndefined(backupPolicyInput?.["Status"]) ?? "DISABLED";
  const stored: StoredBackupPolicy = { fileSystemId, status };
  ctx.store.set(backupKey(fileSystemId), stored);
  return { BackupPolicy: { Status: status } };
};

const DescribeBackupPolicy: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  const stored = ctx.store.get<StoredBackupPolicy>(backupKey(fileSystemId));
  const status = stored?.status ?? "DISABLED";
  return { BackupPolicy: { Status: status } };
};

const CreateMountTarget: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  const subnetId = stringOrUndefined(input["SubnetId"]);
  if (fileSystemId === undefined || subnetId === undefined) {
    throw awsError(
      "BadRequest",
      "FileSystemId and SubnetId are required.",
      400,
    );
  }
  const fileSystem = requireAvailableFileSystem(ctx, fileSystemId);
  const mountTargetId = `fsmt-${hex(8)}`;
  const mountTarget: StoredMountTarget = {
    ownerId: ctx.account,
    mountTargetId,
    fileSystemId,
    subnetId,
    lifeCycleState: "available",
    ipAddress:
      stringOrUndefined(input["IpAddress"]) ??
      `10.0.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
    networkInterfaceId: `eni-${hex(8)}`,
    availabilityZoneName: `${ctx.region}a`,
    vpcId: `vpc-${hex(8)}`,
  };
  ctx.store.set(mountTargetKey(mountTargetId), mountTarget);
  fileSystem.numberOfMountTargets += 1;
  ctx.store.set(fileSystemKey(fileSystemId), fileSystem);
  return mountTargetView(mountTarget);
};

const DescribeMountTargets: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  const mountTargetId = stringOrUndefined(input["MountTargetId"]);
  const marker = stringOrUndefined(input["Marker"]);
  const maxItems =
    typeof input["MaxItems"] === "number" ? input["MaxItems"] : undefined;
  const filtered = ctx.store
    .list<StoredMountTarget>()
    .filter((entry) => entry.key.startsWith("mt/"))
    .map((entry) => entry.value)
    .filter(
      (mt) =>
        (fileSystemId === undefined || mt.fileSystemId === fileSystemId) &&
        (mountTargetId === undefined || mt.mountTargetId === mountTargetId),
    );
  const { items, nextMarker } = applyMarkerPagination(
    filtered,
    marker,
    maxItems,
    (mt) => mt.mountTargetId,
  );
  return {
    Marker: marker,
    MountTargets: items.map(mountTargetView),
    ...(nextMarker !== undefined ? { NextMarker: nextMarker } : {}),
  };
};

const DeleteMountTarget: OperationHandler = (input, ctx) => {
  const mountTargetId = stringOrUndefined(input["MountTargetId"]);
  if (mountTargetId === undefined) {
    throw awsError("BadRequest", "MountTargetId is required.", 400);
  }
  const mt = requireMountTarget(ctx, mountTargetId);
  const fileSystem = ctx.store.get<StoredFileSystem>(
    fileSystemKey(mt.fileSystemId),
  );
  if (fileSystem !== undefined) {
    fileSystem.numberOfMountTargets = Math.max(
      0,
      fileSystem.numberOfMountTargets - 1,
    );
    ctx.store.set(fileSystemKey(mt.fileSystemId), fileSystem);
  }
  ctx.store.delete(mountTargetKey(mountTargetId));
  ctx.store.delete(sgKey(mountTargetId));
  return undefined;
};

const DescribeMountTargetSecurityGroups: OperationHandler = (input, ctx) => {
  const mountTargetId = stringOrUndefined(input["MountTargetId"]);
  if (mountTargetId === undefined) {
    throw awsError("BadRequest", "MountTargetId is required.", 400);
  }
  requireMountTarget(ctx, mountTargetId);
  const stored = ctx.store.get<StoredSecurityGroups>(sgKey(mountTargetId));
  return { SecurityGroups: stored?.securityGroups ?? [] };
};

const ModifyMountTargetSecurityGroups: OperationHandler = (input, ctx) => {
  const mountTargetId = stringOrUndefined(input["MountTargetId"]);
  if (mountTargetId === undefined) {
    throw awsError("BadRequest", "MountTargetId is required.", 400);
  }
  requireMountTarget(ctx, mountTargetId);
  const securityGroups = Array.isArray(input["SecurityGroups"])
    ? (input["SecurityGroups"] as string[]).filter(
        (sg) => typeof sg === "string",
      )
    : [];
  const stored: StoredSecurityGroups = { mountTargetId, securityGroups };
  ctx.store.set(sgKey(mountTargetId), stored);
  return undefined;
};

const PutLifecycleConfiguration: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  const policies = Array.isArray(input["LifecyclePolicies"])
    ? (input["LifecyclePolicies"] as Record<string, unknown>[])
    : [];
  const lifecycle: StoredLifecycle = { fileSystemId, policies };
  ctx.store.set(lifecycleKey(fileSystemId), lifecycle);
  return { LifecyclePolicies: policies };
};

const DescribeLifecycleConfiguration: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  const stored = ctx.store.get<StoredLifecycle>(lifecycleKey(fileSystemId));
  return { LifecyclePolicies: stored?.policies ?? [] };
};

const CreateAccessPoint: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  requireAvailableFileSystem(ctx, fileSystemId);
  const clientToken = stringOrUndefined(input["ClientToken"]) ?? hex(16);
  const existing = ctx.store
    .list<StoredAccessPoint>()
    .filter((entry) => entry.key.startsWith("ap/"))
    .find((entry) => entry.value.clientToken === clientToken);
  if (existing !== undefined) {
    return accessPointView(existing.value);
  }
  const accessPointId = `fsap-${hex(8)}`;
  const tags = tagsFromInput(input["Tags"]);
  const nameTag = tags.find((tag) => tag.Key === "Name");
  const posixUser =
    typeof input["PosixUser"] === "object" && input["PosixUser"] !== null
      ? (input["PosixUser"] as Record<string, unknown>)
      : undefined;
  const rootDirectory =
    typeof input["RootDirectory"] === "object" &&
    input["RootDirectory"] !== null
      ? (input["RootDirectory"] as Record<string, unknown>)
      : undefined;
  const ap: StoredAccessPoint = {
    clientToken,
    name: nameTag?.Value,
    tags,
    accessPointId,
    accessPointArn: `arn:aws:elasticfilesystem:${ctx.region}:${ctx.account}:access-point/${accessPointId}`,
    fileSystemId,
    posixUser,
    rootDirectory,
    ownerId: ctx.account,
    lifeCycleState: "available",
  };
  ctx.store.set(accessPointKey(accessPointId), ap);
  return accessPointView(ap);
};

const DeleteAccessPoint: OperationHandler = (input, ctx) => {
  const accessPointId = stringOrUndefined(input["AccessPointId"]);
  if (accessPointId === undefined) {
    throw awsError("BadRequest", "AccessPointId is required.", 400);
  }
  const ap = ctx.store.get<StoredAccessPoint>(accessPointKey(accessPointId));
  if (ap === undefined) {
    throw awsError(
      "AccessPointNotFound",
      `Access point '${accessPointId}' does not exist.`,
      404,
    );
  }
  ctx.store.delete(accessPointKey(accessPointId));
  return undefined;
};

const DescribeAccessPoints: OperationHandler = (input, ctx) => {
  const accessPointId = stringOrUndefined(input["AccessPointId"]);
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const maxResults =
    typeof input["MaxResults"] === "number" ? input["MaxResults"] : undefined;
  const filtered = ctx.store
    .list<StoredAccessPoint>()
    .filter((entry) => entry.key.startsWith("ap/"))
    .map((entry) => entry.value)
    .filter(
      (ap) =>
        (accessPointId === undefined || ap.accessPointId === accessPointId) &&
        (fileSystemId === undefined || ap.fileSystemId === fileSystemId),
    );
  const { items, nextToken: outToken } = applyTokenPagination(
    filtered,
    nextToken,
    maxResults,
    (ap) => ap.accessPointId,
  );
  return {
    AccessPoints: items.map(accessPointView),
    ...(outToken !== undefined ? { NextToken: outToken } : {}),
  };
};

const CreateReplicationConfiguration: OperationHandler = (input, ctx) => {
  const sourceFileSystemId = stringOrUndefined(input["SourceFileSystemId"]);
  if (sourceFileSystemId === undefined) {
    throw awsError("BadRequest", "SourceFileSystemId is required.", 400);
  }
  requireAvailableFileSystem(ctx, sourceFileSystemId);
  const existing = ctx.store.get<StoredReplication>(
    replKey(sourceFileSystemId),
  );
  if (existing !== undefined) {
    throw awsError(
      "ReplicationAlreadyExists",
      `Replication configuration already exists for '${sourceFileSystemId}'.`,
      409,
    );
  }
  const destinationsInput = Array.isArray(input["Destinations"])
    ? (input["Destinations"] as Record<string, unknown>[])
    : [];
  const destinations = destinationsInput.map((d) => {
    const region =
      stringOrUndefined(d["Region"]) ??
      stringOrUndefined(d["AvailabilityZoneName"])
        ?.split("-")
        .slice(0, 3)
        .join("-") ??
      ctx.region;
    const destFsId = stringOrUndefined(d["FileSystemId"]) ?? `fs-${hex(8)}`;
    return {
      status: "ENABLED" as const,
      fileSystemId: destFsId,
      region,
      ownerId: ctx.account,
    };
  });
  const sourceFileSystemArn = `arn:aws:elasticfilesystem:${ctx.region}:${ctx.account}:file-system/${sourceFileSystemId}`;
  const repl: StoredReplication = {
    sourceFileSystemId,
    sourceFileSystemRegion: ctx.region,
    sourceFileSystemArn,
    originalSourceFileSystemArn: sourceFileSystemArn,
    creationTime: Math.floor(Date.now() / 1000),
    destinations,
    sourceFileSystemOwnerId: ctx.account,
  };
  ctx.store.set(replKey(sourceFileSystemId), repl);
  return replicationView(repl);
};

const DescribeReplicationConfigurations: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const maxResults =
    typeof input["MaxResults"] === "number" ? input["MaxResults"] : undefined;
  const filtered = ctx.store
    .list<StoredReplication>()
    .filter((entry) => entry.key.startsWith("repl/"))
    .map((entry) => entry.value)
    .filter(
      (r) =>
        fileSystemId === undefined ||
        r.sourceFileSystemId === fileSystemId ||
        r.destinations.some((d) => d.fileSystemId === fileSystemId),
    );
  const { items, nextToken: outToken } = applyTokenPagination(
    filtered,
    nextToken,
    maxResults,
    (r) => r.sourceFileSystemId,
  );
  return {
    Replications: items.map(replicationView),
    ...(outToken !== undefined ? { NextToken: outToken } : {}),
  };
};

const DeleteReplicationConfiguration: OperationHandler = (input, ctx) => {
  const sourceFileSystemId = stringOrUndefined(input["SourceFileSystemId"]);
  if (sourceFileSystemId === undefined) {
    throw awsError("BadRequest", "SourceFileSystemId is required.", 400);
  }
  const existing = ctx.store.get<StoredReplication>(
    replKey(sourceFileSystemId),
  );
  if (existing === undefined) {
    throw awsError(
      "ReplicationNotFound",
      `Replication configuration not found for '${sourceFileSystemId}'.`,
      404,
    );
  }
  ctx.store.delete(replKey(sourceFileSystemId));
  return undefined;
};

const PutAccountPreferences: OperationHandler = (input, ctx) => {
  const resourceIdType =
    stringOrUndefined(input["ResourceIdType"]) ?? "LONG_ID";
  const stored: StoredAccountPreferences = {
    resourceIdType,
    resources: ["FILE_SYSTEM", "MOUNT_TARGET"],
  };
  ctx.store.set(acctPrefsKey(), stored);
  return {
    ResourceIdPreference: {
      ResourceIdType: resourceIdType,
      Resources: stored.resources,
    },
  };
};

const DescribeAccountPreferences: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<StoredAccountPreferences>(acctPrefsKey());
  return {
    ResourceIdPreference:
      stored !== undefined
        ? {
            ResourceIdType: stored.resourceIdType,
            Resources: stored.resources,
          }
        : {
            ResourceIdType: "LONG_ID",
            Resources: ["FILE_SYSTEM", "MOUNT_TARGET"],
          },
  };
};

const CreateTags: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  const fileSystem = requireFileSystem(ctx, fileSystemId);
  const newTags = tagsFromInput(input["Tags"]);
  const existing = fileSystem.tags.filter(
    (t) => !newTags.some((n) => n.Key === t.Key),
  );
  ctx.store.set(fileSystemKey(fileSystemId), {
    ...fileSystem,
    tags: [...existing, ...newTags],
  });
  return undefined;
};

const DeleteTags: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  const fileSystem = requireFileSystem(ctx, fileSystemId);
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[]).filter((k) => typeof k === "string")
    : [];
  const remaining = fileSystem.tags.filter((t) => !tagKeys.includes(t.Key));
  ctx.store.set(fileSystemKey(fileSystemId), {
    ...fileSystem,
    tags: remaining,
  });
  return undefined;
};

const DescribeTags: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  const fileSystem = requireFileSystem(ctx, fileSystemId);
  return { Tags: fileSystem.tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceId = stringOrUndefined(input["ResourceId"]);
  if (resourceId === undefined) {
    throw awsError("BadRequest", "ResourceId is required.", 400);
  }
  const newTags = tagsFromInput(input["Tags"]);
  const existing = getResourceTags(ctx, resourceId).filter(
    (t) => !newTags.some((n) => n.Key === t.Key),
  );
  setResourceTags(ctx, resourceId, [...existing, ...newTags]);
  return undefined;
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceId = stringOrUndefined(input["ResourceId"]);
  if (resourceId === undefined) {
    throw awsError("BadRequest", "ResourceId is required.", 400);
  }
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[]).filter((k) => typeof k === "string")
    : [];
  const remaining = getResourceTags(ctx, resourceId).filter(
    (t) => !tagKeys.includes(t.Key),
  );
  setResourceTags(ctx, resourceId, remaining);
  return undefined;
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceId = stringOrUndefined(input["ResourceId"]);
  if (resourceId === undefined) {
    throw awsError("BadRequest", "ResourceId is required.", 400);
  }
  return { Tags: getResourceTags(ctx, resourceId) };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const efs = {
  name: "elasticfilesystem",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "2015-02-01") return undefined;

    if (parts[1] === "file-systems") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateFileSystem";
        if (req.method === "GET") return "DescribeFileSystems";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "replication-configurations" && req.method === "GET")
          return "DescribeReplicationConfigurations";
        if (req.method === "DELETE") return "DeleteFileSystem";
        if (req.method === "PUT") return "UpdateFileSystem";
        return undefined;
      }
      if (parts.length === 4) {
        if (parts[3] === "lifecycle-configuration") {
          if (req.method === "PUT") return "PutLifecycleConfiguration";
          if (req.method === "GET") return "DescribeLifecycleConfiguration";
          return undefined;
        }
        if (parts[3] === "policy") {
          if (req.method === "GET") return "DescribeFileSystemPolicy";
          if (req.method === "PUT") return "PutFileSystemPolicy";
          if (req.method === "DELETE") return "DeleteFileSystemPolicy";
          return undefined;
        }
        if (parts[3] === "backup-policy") {
          if (req.method === "GET") return "DescribeBackupPolicy";
          if (req.method === "PUT") return "PutBackupPolicy";
          return undefined;
        }
        if (parts[3] === "protection") {
          if (req.method === "PUT") return "UpdateFileSystemProtection";
          return undefined;
        }
        if (parts[3] === "replication-configuration") {
          if (req.method === "POST") return "CreateReplicationConfiguration";
          if (req.method === "DELETE") return "DeleteReplicationConfiguration";
          return undefined;
        }
        return undefined;
      }
      return undefined;
    }

    if (parts[1] === "mount-targets") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateMountTarget";
        if (req.method === "GET") return "DescribeMountTargets";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "DELETE") return "DeleteMountTarget";
        return undefined;
      }
      if (parts.length === 4 && parts[3] === "security-groups") {
        if (req.method === "GET") return "DescribeMountTargetSecurityGroups";
        if (req.method === "PUT") return "ModifyMountTargetSecurityGroups";
        return undefined;
      }
      return undefined;
    }

    if (parts[1] === "access-points") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateAccessPoint";
        if (req.method === "GET") return "DescribeAccessPoints";
        return undefined;
      }
      if (parts.length === 3 && req.method === "DELETE")
        return "DeleteAccessPoint";
      return undefined;
    }

    if (parts[1] === "account-preferences" && parts.length === 2) {
      if (req.method === "GET") return "DescribeAccountPreferences";
      if (req.method === "PUT") return "PutAccountPreferences";
      return undefined;
    }

    if (
      parts[1] === "create-tags" &&
      parts.length === 3 &&
      req.method === "POST"
    )
      return "CreateTags";

    if (
      parts[1] === "delete-tags" &&
      parts.length === 3 &&
      req.method === "POST"
    )
      return "DeleteTags";

    if (parts[1] === "tags" && parts.length === 3 && req.method === "GET")
      return "DescribeTags";

    if (parts[1] === "resource-tags" && parts.length === 3) {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateFileSystem,
    DescribeFileSystems,
    DeleteFileSystem,
    UpdateFileSystem,
    UpdateFileSystemProtection,
    PutFileSystemPolicy,
    DescribeFileSystemPolicy,
    DeleteFileSystemPolicy,
    PutBackupPolicy,
    DescribeBackupPolicy,
    CreateMountTarget,
    DescribeMountTargets,
    DeleteMountTarget,
    DescribeMountTargetSecurityGroups,
    ModifyMountTargetSecurityGroups,
    PutLifecycleConfiguration,
    DescribeLifecycleConfiguration,
    CreateAccessPoint,
    DeleteAccessPoint,
    DescribeAccessPoints,
    CreateReplicationConfiguration,
    DescribeReplicationConfigurations,
    DeleteReplicationConfiguration,
    PutAccountPreferences,
    DescribeAccountPreferences,
    CreateTags,
    DeleteTags,
    DescribeTags,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default efs;
