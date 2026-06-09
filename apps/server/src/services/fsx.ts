import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import fsxModel from "../../../../test/vendor/aws-models/fsx.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(fsxModel);

type StoredFileSystem = {
  OwnerId: string;
  CreationTime: number;
  FileSystemId: string;
  FileSystemType: string;
  Lifecycle: string;
  StorageCapacity: number;
  StorageType: string;
  VpcId: string;
  SubnetIds: string[];
  NetworkInterfaceIds: string[];
  DNSName: string;
  KmsKeyId: string | undefined;
  ResourceARN: string;
  Tags: { Key: string; Value: string }[];
};

type StoredBackup = {
  BackupId: string;
  Lifecycle: string;
  Type: string;
  ProgressPercent: number;
  CreationTime: number;
  ResourceARN: string;
  Tags: { Key: string; Value: string }[];
  FileSystem: StoredFileSystem;
  OwnerId: string;
};

type StoredVolume = {
  VolumeId: string;
  FileSystemId: string | undefined;
  Name: string;
  VolumeType: string;
  Lifecycle: string;
  ResourceARN: string;
  Tags: { Key: string; Value: string }[];
  CreationTime: number;
};

type StoredSnapshot = {
  SnapshotId: string;
  VolumeId: string;
  Name: string;
  Lifecycle: string;
  ResourceARN: string;
  Tags: { Key: string; Value: string }[];
  CreationTime: number;
};

type StoredStorageVirtualMachine = {
  StorageVirtualMachineId: string;
  FileSystemId: string;
  Name: string;
  Lifecycle: string;
  ResourceARN: string;
  Tags: { Key: string; Value: string }[];
  CreationTime: number;
  Subtype: string;
  RootVolumeSecurityStyle: string;
};

type StoredDataRepositoryAssociation = {
  AssociationId: string;
  FileSystemId: string | undefined;
  FileCacheId: string | undefined;
  FileSystemPath: string | undefined;
  FileCachePath: string | undefined;
  DataRepositoryPath: string;
  Lifecycle: string;
  ResourceARN: string;
  Tags: { Key: string; Value: string }[];
  CreationTime: number;
  BatchImportMetaDataOnCreate: boolean;
  ImportedFileChunkSize: number;
};

type StoredDataRepositoryTask = {
  TaskId: string;
  Type: string;
  FileSystemId: string | undefined;
  FileCacheId: string | undefined;
  Lifecycle: string;
  ResourceARN: string;
  Tags: { Key: string; Value: string }[];
  CreationTime: number;
  Paths: string[];
};

type StoredFileCache = {
  FileCacheId: string;
  FileCacheType: string;
  FileCacheTypeVersion: string;
  Lifecycle: string;
  StorageCapacity: number;
  VpcId: string;
  SubnetIds: string[];
  NetworkInterfaceIds: string[];
  DNSName: string;
  KmsKeyId: string | undefined;
  ResourceARN: string;
  Tags: { Key: string; Value: string }[];
  OwnerId: string;
  CreationTime: number;
  DataRepositoryAssociationIds: string[];
};

type StoredAlias = {
  Name: string;
  Lifecycle: string;
};

type StoredS3AccessPoint = {
  Name: string;
  Lifecycle: string;
  ResourceARN: string;
  FileSystemId: string | undefined;
};

const fileSystemKey = (id: string): string => `fs/${id}`;
const backupKey = (id: string): string => `backup/${id}`;
const volumeKey = (id: string): string => `volume/${id}`;
const snapshotKey = (id: string): string => `snapshot/${id}`;
const svmKey = (id: string): string => `svm/${id}`;
const draKey = (id: string): string => `dra/${id}`;
const drtKey = (id: string): string => `drt/${id}`;
const fileCacheKey = (id: string): string => `fc/${id}`;
const aliasesKey = (fsId: string): string => `aliases/${fsId}`;
const s3apKey = (name: string): string => `s3ap/${name}`;
const tagsKey = (arn: string): string => `tags/${arn}`;
const sharedVpcConfigKey = (): string => `sharedvpc/config`;

const hex = (length: number): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const boolOrFalse = (value: unknown): boolean =>
  typeof value === "boolean" ? value : false;

const numberOrDefault = (value: unknown, def: number): number =>
  typeof value === "number" ? value : def;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const paginate = <T>(
  items: T[],
  maxResults: number | undefined,
  nextToken: string | undefined,
): { items: T[]; nextToken: string | undefined } => {
  const start = nextToken !== undefined ? parseInt(atob(nextToken), 10) : 0;
  const limit =
    maxResults !== undefined && maxResults > 0 ? maxResults : items.length;
  const sliced = items.slice(start, start + limit);
  const newNextToken =
    start + limit < items.length ? btoa(String(start + limit)) : undefined;
  return { items: sliced, nextToken: newNextToken };
};

const applyFilters = (
  filters: unknown,
  record: Record<string, unknown>,
): boolean => {
  if (!Array.isArray(filters)) return true;
  const fieldMap: Record<string, string> = {
    "file-system-id": "FileSystemId",
    status: "Lifecycle",
    "file-cache-id": "FileCacheId",
    "data-repository-type": "Type",
  };
  for (const filter of filters) {
    if (typeof filter !== "object" || filter === null) continue;
    const f = filter as Record<string, unknown>;
    const name = typeof f["Name"] === "string" ? f["Name"] : undefined;
    const values = Array.isArray(f["Values"])
      ? f["Values"].filter((v): v is string => typeof v === "string")
      : [];
    if (name === undefined || values.length === 0) continue;
    const field = fieldMap[name];
    if (field === undefined) continue;
    const fieldValue = record[field];
    if (typeof fieldValue !== "string" || !values.includes(fieldValue))
      return false;
  }
  return true;
};

const mergeTags = (
  ctx: ServiceContext,
  arn: string,
  resourceTags: { Key: string; Value: string }[],
): { Key: string; Value: string }[] => {
  const extra =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(arn)) ?? [];
  if (extra.length === 0) return resourceTags;
  const merged = new Map(resourceTags.map((t) => [t.Key, t.Value]));
  for (const tag of extra) merged.set(tag.Key, tag.Value);
  return Array.from(merged.entries()).map(([Key, Value]) => ({ Key, Value }));
};

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
      400,
    );
  }
  return fileSystem;
};

const requireVolume = (ctx: ServiceContext, volumeId: string): StoredVolume => {
  const volume = ctx.store.get<StoredVolume>(volumeKey(volumeId));
  if (volume === undefined) {
    throw awsError(
      "VolumeNotFound",
      `Volume '${volumeId}' does not exist.`,
      400,
    );
  }
  return volume;
};

const requireSnapshot = (
  ctx: ServiceContext,
  snapshotId: string,
): StoredSnapshot => {
  const snapshot = ctx.store.get<StoredSnapshot>(snapshotKey(snapshotId));
  if (snapshot === undefined) {
    throw awsError(
      "SnapshotNotFound",
      `Snapshot '${snapshotId}' does not exist.`,
      400,
    );
  }
  return snapshot;
};

const requireBackup = (ctx: ServiceContext, backupId: string): StoredBackup => {
  const backup = ctx.store.get<StoredBackup>(backupKey(backupId));
  if (backup === undefined) {
    throw awsError(
      "BackupNotFound",
      `Backup '${backupId}' does not exist.`,
      400,
    );
  }
  return backup;
};

const requireStorageVirtualMachine = (
  ctx: ServiceContext,
  svmId: string,
): StoredStorageVirtualMachine => {
  const svm = ctx.store.get<StoredStorageVirtualMachine>(svmKey(svmId));
  if (svm === undefined) {
    throw awsError(
      "StorageVirtualMachineNotFound",
      `StorageVirtualMachine '${svmId}' does not exist.`,
      400,
    );
  }
  return svm;
};

const requireDataRepositoryAssociation = (
  ctx: ServiceContext,
  associationId: string,
): StoredDataRepositoryAssociation => {
  const dra = ctx.store.get<StoredDataRepositoryAssociation>(
    draKey(associationId),
  );
  if (dra === undefined) {
    throw awsError(
      "DataRepositoryAssociationNotFound",
      `DataRepositoryAssociation '${associationId}' does not exist.`,
      400,
    );
  }
  return dra;
};

const requireDataRepositoryTask = (
  ctx: ServiceContext,
  taskId: string,
): StoredDataRepositoryTask => {
  const drt = ctx.store.get<StoredDataRepositoryTask>(drtKey(taskId));
  if (drt === undefined) {
    throw awsError(
      "DataRepositoryTaskNotFound",
      `DataRepositoryTask '${taskId}' does not exist.`,
      400,
    );
  }
  return drt;
};

const requireFileCache = (
  ctx: ServiceContext,
  fileCacheId: string,
): StoredFileCache => {
  const fc = ctx.store.get<StoredFileCache>(fileCacheKey(fileCacheId));
  if (fc === undefined) {
    throw awsError(
      "FileCacheNotFound",
      `FileCache '${fileCacheId}' does not exist.`,
      400,
    );
  }
  return fc;
};

const CreateFileSystem: OperationHandler = (input, ctx) => {
  const fileSystemType = stringOrUndefined(input["FileSystemType"]);
  if (fileSystemType === undefined) {
    throw awsError("BadRequest", "FileSystemType is required.", 400);
  }
  const subnetIds = stringArray(input["SubnetIds"]);
  if (subnetIds.length === 0) {
    throw awsError("BadRequest", "SubnetIds is required.", 400);
  }
  const fileSystemId = `fs-${hex(8)}`;
  const storageCapacity =
    typeof input["StorageCapacity"] === "number"
      ? (input["StorageCapacity"] as number)
      : 1200;
  const fileSystem: StoredFileSystem = {
    OwnerId: ctx.account,
    CreationTime: Math.floor(Date.now() / 1000),
    FileSystemId: fileSystemId,
    FileSystemType: fileSystemType,
    Lifecycle: "CREATING",
    StorageCapacity: storageCapacity,
    StorageType: stringOrUndefined(input["StorageType"]) ?? "SSD",
    VpcId: `vpc-${hex(8)}`,
    SubnetIds: subnetIds,
    NetworkInterfaceIds: [`eni-${hex(8)}`],
    DNSName: `${fileSystemId}.fsx.${ctx.region}.amazonaws.com`,
    KmsKeyId: stringOrUndefined(input["KmsKeyId"]),
    ResourceARN: `arn:aws:fsx:${ctx.region}:${ctx.account}:file-system/${fileSystemId}`,
    Tags: tagsFromInput(input["Tags"]),
  };
  ctx.store.set(fileSystemKey(fileSystemId), fileSystem);
  return { FileSystem: fileSystem };
};

const DescribeFileSystems: OperationHandler = (input, ctx) => {
  const fileSystemIds = stringArray(input["FileSystemIds"]);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const filters = input["Filters"];
  const raw = ctx.store
    .list<StoredFileSystem>()
    .filter((entry) => entry.key.startsWith("fs/"))
    .map((entry) => entry.value)
    .filter(
      (fs) =>
        fileSystemIds.length === 0 || fileSystemIds.includes(fs.FileSystemId),
    )
    .filter((fs) =>
      applyFilters(filters, fs as unknown as Record<string, unknown>),
    );
  const resolved = raw.map((fs) => {
    if (fs.Lifecycle === "CREATING") {
      const updated = { ...fs, Lifecycle: "AVAILABLE" };
      ctx.store.set(fileSystemKey(fs.FileSystemId), updated);
      return updated;
    }
    return fs;
  });
  const withTags = resolved.map((fs) => ({
    ...fs,
    Tags: mergeTags(ctx, fs.ResourceARN, fs.Tags),
  }));
  const { items, nextToken: next } = paginate(withTags, maxResults, nextToken);
  return { FileSystems: items, NextToken: next };
};

const DeleteFileSystem: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  const fileSystem = requireFileSystem(ctx, fileSystemId);
  const updated = { ...fileSystem, Lifecycle: "DELETING" };
  ctx.store.set(fileSystemKey(fileSystemId), updated);
  return { FileSystemId: fileSystemId, Lifecycle: "DELETING" };
};

const CreateBackup: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  const fileSystem = requireFileSystem(ctx, fileSystemId);
  const backupId = `backup-${hex(8)}`;
  const backup: StoredBackup = {
    BackupId: backupId,
    Lifecycle: "PENDING",
    Type: "USER_INITIATED",
    ProgressPercent: 0,
    CreationTime: Math.floor(Date.now() / 1000),
    ResourceARN: `arn:aws:fsx:${ctx.region}:${ctx.account}:backup/${backupId}`,
    Tags: tagsFromInput(input["Tags"]),
    FileSystem: fileSystem,
    OwnerId: ctx.account,
  };
  ctx.store.set(backupKey(backupId), backup);
  return { Backup: backup };
};

const DescribeBackups: OperationHandler = (input, ctx) => {
  const backupIds = stringArray(input["BackupIds"]);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const filters = input["Filters"];
  const raw = ctx.store
    .list<StoredBackup>()
    .filter((entry) => entry.key.startsWith("backup/"))
    .map((entry) => entry.value)
    .filter((b) => backupIds.length === 0 || backupIds.includes(b.BackupId))
    .filter((b) =>
      applyFilters(filters, b as unknown as Record<string, unknown>),
    );
  const resolved = raw.map((b) => {
    if (b.Lifecycle === "PENDING" || b.Lifecycle === "COPYING") {
      const updated = { ...b, Lifecycle: "AVAILABLE", ProgressPercent: 100 };
      ctx.store.set(backupKey(b.BackupId), updated);
      return updated;
    }
    return b;
  });
  const withTags = resolved.map((b) => ({
    ...b,
    Tags: mergeTags(ctx, b.ResourceARN, b.Tags),
  }));
  const { items, nextToken: next } = paginate(withTags, maxResults, nextToken);
  return { Backups: items, NextToken: next };
};

const AssociateFileSystemAliases: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  const aliasNames = stringArray(input["Aliases"]);
  const existing = ctx.store.get<StoredAlias[]>(aliasesKey(fileSystemId)) ?? [];
  const existingNames = new Set(existing.map((a) => a.Name));
  const newAliases: StoredAlias[] = aliasNames
    .filter((name) => !existingNames.has(name))
    .map((name) => ({ Name: name, Lifecycle: "CREATING" }));
  const updated = [...existing, ...newAliases];
  ctx.store.set(aliasesKey(fileSystemId), updated);
  const result = aliasNames.map(
    (name) =>
      updated.find((a) => a.Name === name) ?? {
        Name: name,
        Lifecycle: "CREATING",
      },
  );
  return { Aliases: result };
};

const CancelDataRepositoryTask: OperationHandler = (input, ctx) => {
  const taskId = stringOrUndefined(input["TaskId"]);
  if (taskId === undefined) {
    throw awsError("BadRequest", "TaskId is required.", 400);
  }
  const task = requireDataRepositoryTask(ctx, taskId);
  const updated: StoredDataRepositoryTask = { ...task, Lifecycle: "CANCELING" };
  ctx.store.set(drtKey(taskId), updated);
  return { Lifecycle: "CANCELING", TaskId: taskId };
};

const CopyBackup: OperationHandler = (input, ctx) => {
  const sourceBackupId = stringOrUndefined(input["SourceBackupId"]);
  if (sourceBackupId === undefined) {
    throw awsError("BadRequest", "SourceBackupId is required.", 400);
  }
  const sourceBackup = requireBackup(ctx, sourceBackupId);
  const newBackupId = `backup-${hex(8)}`;
  const newBackup: StoredBackup = {
    ...sourceBackup,
    BackupId: newBackupId,
    ResourceARN: `arn:aws:fsx:${ctx.region}:${ctx.account}:backup/${newBackupId}`,
    Tags: tagsFromInput(input["Tags"]) ?? sourceBackup.Tags,
    Type: "COPY",
    Lifecycle: "COPYING",
    ProgressPercent: 0,
    CreationTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(backupKey(newBackupId), newBackup);
  return { Backup: newBackup };
};

const CopySnapshotAndUpdateVolume: OperationHandler = (input, ctx) => {
  const volumeId = stringOrUndefined(input["VolumeId"]);
  if (volumeId === undefined) {
    throw awsError("BadRequest", "VolumeId is required.", 400);
  }
  const volume = requireVolume(ctx, volumeId);
  const updated: StoredVolume = { ...volume, Lifecycle: "MISCONFIGURED" };
  ctx.store.set(volumeKey(volumeId), updated);
  return {
    VolumeId: volumeId,
    Lifecycle: "MISCONFIGURED",
    AdministrativeActions: [],
  };
};

const CreateAndAttachS3AccessPoint: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["Name"]);
  if (name === undefined) {
    throw awsError("BadRequest", "Name is required.", 400);
  }
  const ontapConfig =
    typeof input["OntapConfiguration"] === "object" &&
    input["OntapConfiguration"] !== null
      ? (input["OntapConfiguration"] as Record<string, unknown>)
      : undefined;
  const fileSystemId = ontapConfig
    ? stringOrUndefined(ontapConfig["FileSystemId"])
    : undefined;
  const s3ap: StoredS3AccessPoint = {
    Name: name,
    Lifecycle: "AVAILABLE",
    ResourceARN: `arn:aws:fsx:${ctx.region}:${ctx.account}:s3-access-point/${name}`,
    FileSystemId: fileSystemId,
  };
  ctx.store.set(s3apKey(name), s3ap);
  return {
    S3AccessPointAttachment: {
      Name: name,
      Lifecycle: "AVAILABLE",
      S3AccessPoint: { ResourceARN: s3ap.ResourceARN },
    },
  };
};

const CreateDataRepositoryAssociation: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  const dataRepositoryPath = stringOrUndefined(input["DataRepositoryPath"]);
  if (dataRepositoryPath === undefined) {
    throw awsError("BadRequest", "DataRepositoryPath is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  const associationId = `dra-${hex(8)}`;
  const dra: StoredDataRepositoryAssociation = {
    AssociationId: associationId,
    FileSystemId: fileSystemId,
    FileCacheId: undefined,
    FileSystemPath: stringOrUndefined(input["FileSystemPath"]),
    FileCachePath: undefined,
    DataRepositoryPath: dataRepositoryPath,
    Lifecycle: "AVAILABLE",
    ResourceARN: `arn:aws:fsx:${ctx.region}:${ctx.account}:association/${fileSystemId}/${associationId}`,
    Tags: tagsFromInput(input["Tags"]),
    CreationTime: Math.floor(Date.now() / 1000),
    BatchImportMetaDataOnCreate: boolOrFalse(
      input["BatchImportMetaDataOnCreate"],
    ),
    ImportedFileChunkSize: numberOrDefault(
      input["ImportedFileChunkSize"],
      1024,
    ),
  };
  ctx.store.set(draKey(associationId), dra);
  return { Association: dra };
};

const CreateDataRepositoryTask: OperationHandler = (input, ctx) => {
  const taskType = stringOrUndefined(input["Type"]);
  if (taskType === undefined) {
    throw awsError("BadRequest", "Type is required.", 400);
  }
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  const taskId = `task-${hex(8)}`;
  const drt: StoredDataRepositoryTask = {
    TaskId: taskId,
    Type: taskType,
    FileSystemId: fileSystemId,
    FileCacheId: undefined,
    Lifecycle: "PENDING",
    ResourceARN: `arn:aws:fsx:${ctx.region}:${ctx.account}:task/${taskId}`,
    Tags: tagsFromInput(input["Tags"]),
    CreationTime: Math.floor(Date.now() / 1000),
    Paths: stringArray(input["Paths"]),
  };
  ctx.store.set(drtKey(taskId), drt);
  return { DataRepositoryTask: drt };
};

const CreateFileCache: OperationHandler = (input, ctx) => {
  const fileCacheType = stringOrUndefined(input["FileCacheType"]);
  if (fileCacheType === undefined) {
    throw awsError("BadRequest", "FileCacheType is required.", 400);
  }
  const fileCacheTypeVersion = stringOrUndefined(input["FileCacheTypeVersion"]);
  if (fileCacheTypeVersion === undefined) {
    throw awsError("BadRequest", "FileCacheTypeVersion is required.", 400);
  }
  const subnetIds = stringArray(input["SubnetIds"]);
  if (subnetIds.length === 0) {
    throw awsError("BadRequest", "SubnetIds is required.", 400);
  }
  const fileCacheId = `fc-${hex(8)}`;
  const fc: StoredFileCache = {
    FileCacheId: fileCacheId,
    FileCacheType: fileCacheType,
    FileCacheTypeVersion: fileCacheTypeVersion,
    Lifecycle: "CREATING",
    StorageCapacity: numberOrDefault(input["StorageCapacity"], 1200),
    VpcId: `vpc-${hex(8)}`,
    SubnetIds: subnetIds,
    NetworkInterfaceIds: [`eni-${hex(8)}`],
    DNSName: `${fileCacheId}.fsx.${ctx.region}.amazonaws.com`,
    KmsKeyId: stringOrUndefined(input["KmsKeyId"]),
    ResourceARN: `arn:aws:fsx:${ctx.region}:${ctx.account}:file-cache/${fileCacheId}`,
    Tags: tagsFromInput(input["Tags"]),
    OwnerId: ctx.account,
    CreationTime: Math.floor(Date.now() / 1000),
    DataRepositoryAssociationIds: [],
  };
  ctx.store.set(fileCacheKey(fileCacheId), fc);
  return { FileCache: fc };
};

const CreateFileSystemFromBackup: OperationHandler = (input, ctx) => {
  const backupId = stringOrUndefined(input["BackupId"]);
  if (backupId === undefined) {
    throw awsError("BadRequest", "BackupId is required.", 400);
  }
  const backup = requireBackup(ctx, backupId);
  const subnetIds = stringArray(input["SubnetIds"]);
  if (subnetIds.length === 0) {
    throw awsError("BadRequest", "SubnetIds is required.", 400);
  }
  const fileSystemId = `fs-${hex(8)}`;
  const fileSystem: StoredFileSystem = {
    OwnerId: ctx.account,
    CreationTime: Math.floor(Date.now() / 1000),
    FileSystemId: fileSystemId,
    FileSystemType: backup.FileSystem.FileSystemType,
    Lifecycle: "CREATING",
    StorageCapacity: backup.FileSystem.StorageCapacity,
    StorageType:
      stringOrUndefined(input["StorageType"]) ?? backup.FileSystem.StorageType,
    VpcId: `vpc-${hex(8)}`,
    SubnetIds: subnetIds,
    NetworkInterfaceIds: [`eni-${hex(8)}`],
    DNSName: `${fileSystemId}.fsx.${ctx.region}.amazonaws.com`,
    KmsKeyId: stringOrUndefined(input["KmsKeyId"]),
    ResourceARN: `arn:aws:fsx:${ctx.region}:${ctx.account}:file-system/${fileSystemId}`,
    Tags: tagsFromInput(input["Tags"]),
  };
  ctx.store.set(fileSystemKey(fileSystemId), fileSystem);
  return { FileSystem: fileSystem };
};

const CreateSnapshot: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["Name"]);
  if (name === undefined) {
    throw awsError("BadRequest", "Name is required.", 400);
  }
  const volumeId = stringOrUndefined(input["VolumeId"]);
  if (volumeId === undefined) {
    throw awsError("BadRequest", "VolumeId is required.", 400);
  }
  requireVolume(ctx, volumeId);
  const snapshotId = `fsvolsnap-${hex(8)}`;
  const snapshot: StoredSnapshot = {
    SnapshotId: snapshotId,
    VolumeId: volumeId,
    Name: name,
    Lifecycle: "CREATING",
    ResourceARN: `arn:aws:fsx:${ctx.region}:${ctx.account}:snapshot/${snapshotId}`,
    Tags: tagsFromInput(input["Tags"]),
    CreationTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(snapshotKey(snapshotId), snapshot);
  return { Snapshot: snapshot };
};

const CreateStorageVirtualMachine: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  const name = stringOrUndefined(input["Name"]);
  if (name === undefined) {
    throw awsError("BadRequest", "Name is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  const svmId = `svm-${hex(8)}`;
  const svm: StoredStorageVirtualMachine = {
    StorageVirtualMachineId: svmId,
    FileSystemId: fileSystemId,
    Name: name,
    Lifecycle: "CREATING",
    ResourceARN: `arn:aws:fsx:${ctx.region}:${ctx.account}:storage-virtual-machine/${fileSystemId}/${svmId}`,
    Tags: tagsFromInput(input["Tags"]),
    CreationTime: Math.floor(Date.now() / 1000),
    Subtype: "DEFAULT",
    RootVolumeSecurityStyle:
      stringOrUndefined(input["RootVolumeSecurityStyle"]) ?? "UNIX",
  };
  ctx.store.set(svmKey(svmId), svm);
  return { StorageVirtualMachine: svm };
};

const CreateVolume: OperationHandler = (input, ctx) => {
  const volumeType = stringOrUndefined(input["VolumeType"]);
  if (volumeType === undefined) {
    throw awsError("BadRequest", "VolumeType is required.", 400);
  }
  const name = stringOrUndefined(input["Name"]);
  if (name === undefined) {
    throw awsError("BadRequest", "Name is required.", 400);
  }
  const ontapConfig =
    typeof input["OntapConfiguration"] === "object" &&
    input["OntapConfiguration"] !== null
      ? (input["OntapConfiguration"] as Record<string, unknown>)
      : undefined;
  let fileSystemId: string | undefined;
  if (ontapConfig !== undefined) {
    const svmId = stringOrUndefined(ontapConfig["StorageVirtualMachineId"]);
    if (svmId !== undefined) {
      const svm = ctx.store.get<StoredStorageVirtualMachine>(svmKey(svmId));
      fileSystemId = svm?.FileSystemId;
    }
  }
  const volumeId = `fsvol-${hex(8)}`;
  const volume: StoredVolume = {
    VolumeId: volumeId,
    FileSystemId: fileSystemId,
    Name: name,
    VolumeType: volumeType,
    Lifecycle: "CREATING",
    ResourceARN: `arn:aws:fsx:${ctx.region}:${ctx.account}:volume/${volumeId}`,
    Tags: tagsFromInput(input["Tags"]),
    CreationTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(volumeKey(volumeId), volume);
  return { Volume: volume };
};

const CreateVolumeFromBackup: OperationHandler = (input, ctx) => {
  const backupId = stringOrUndefined(input["BackupId"]);
  if (backupId === undefined) {
    throw awsError("BadRequest", "BackupId is required.", 400);
  }
  const name = stringOrUndefined(input["Name"]);
  if (name === undefined) {
    throw awsError("BadRequest", "Name is required.", 400);
  }
  const backup = requireBackup(ctx, backupId);
  const volumeId = `fsvol-${hex(8)}`;
  const volume: StoredVolume = {
    VolumeId: volumeId,
    FileSystemId: backup.FileSystem.FileSystemId,
    Name: name,
    VolumeType: "ONTAP",
    Lifecycle: "CREATING",
    ResourceARN: `arn:aws:fsx:${ctx.region}:${ctx.account}:volume/${volumeId}`,
    Tags: tagsFromInput(input["Tags"]),
    CreationTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(volumeKey(volumeId), volume);
  return { Volume: volume };
};

const DeleteBackup: OperationHandler = (input, ctx) => {
  const backupId = stringOrUndefined(input["BackupId"]);
  if (backupId === undefined) {
    throw awsError("BadRequest", "BackupId is required.", 400);
  }
  const backup = requireBackup(ctx, backupId);
  const updated = { ...backup, Lifecycle: "DELETED" };
  ctx.store.set(backupKey(backupId), updated);
  return { BackupId: backupId, Lifecycle: "DELETED" };
};

const DeleteDataRepositoryAssociation: OperationHandler = (input, ctx) => {
  const associationId = stringOrUndefined(input["AssociationId"]);
  if (associationId === undefined) {
    throw awsError("BadRequest", "AssociationId is required.", 400);
  }
  requireDataRepositoryAssociation(ctx, associationId);
  ctx.store.delete(draKey(associationId));
  return {
    AssociationId: associationId,
    Lifecycle: "DELETING",
    DeleteDataInFileSystem: boolOrFalse(input["DeleteDataInFileSystem"]),
  };
};

const DeleteFileCache: OperationHandler = (input, ctx) => {
  const fileCacheId = stringOrUndefined(input["FileCacheId"]);
  if (fileCacheId === undefined) {
    throw awsError("BadRequest", "FileCacheId is required.", 400);
  }
  const fc = requireFileCache(ctx, fileCacheId);
  const updated = { ...fc, Lifecycle: "DELETING" };
  ctx.store.set(fileCacheKey(fileCacheId), updated);
  return { FileCacheId: fileCacheId, Lifecycle: "DELETING" };
};

const DeleteSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId = stringOrUndefined(input["SnapshotId"]);
  if (snapshotId === undefined) {
    throw awsError("BadRequest", "SnapshotId is required.", 400);
  }
  const snapshot = requireSnapshot(ctx, snapshotId);
  const updated = { ...snapshot, Lifecycle: "DELETING" };
  ctx.store.set(snapshotKey(snapshotId), updated);
  return { SnapshotId: snapshotId, Lifecycle: "DELETING" };
};

const DeleteStorageVirtualMachine: OperationHandler = (input, ctx) => {
  const svmId = stringOrUndefined(input["StorageVirtualMachineId"]);
  if (svmId === undefined) {
    throw awsError("BadRequest", "StorageVirtualMachineId is required.", 400);
  }
  const svm = requireStorageVirtualMachine(ctx, svmId);
  const updated = { ...svm, Lifecycle: "DELETING" };
  ctx.store.set(svmKey(svmId), updated);
  return { StorageVirtualMachineId: svmId, Lifecycle: "DELETING" };
};

const DeleteVolume: OperationHandler = (input, ctx) => {
  const volumeId = stringOrUndefined(input["VolumeId"]);
  if (volumeId === undefined) {
    throw awsError("BadRequest", "VolumeId is required.", 400);
  }
  const volume = requireVolume(ctx, volumeId);
  const updated = { ...volume, Lifecycle: "DELETING" };
  ctx.store.set(volumeKey(volumeId), updated);
  return { VolumeId: volumeId, Lifecycle: "DELETING" };
};

const DescribeDataRepositoryAssociations: OperationHandler = (input, ctx) => {
  const associationIds = stringArray(input["AssociationIds"]);
  const associations = ctx.store
    .list<StoredDataRepositoryAssociation>()
    .filter((entry) => entry.key.startsWith("dra/"))
    .map((entry) => entry.value)
    .filter(
      (dra) =>
        associationIds.length === 0 ||
        associationIds.includes(dra.AssociationId),
    );
  return { Associations: associations };
};

const DescribeDataRepositoryTasks: OperationHandler = (input, ctx) => {
  const taskIds = stringArray(input["TaskIds"]);
  const tasks = ctx.store
    .list<StoredDataRepositoryTask>()
    .filter((entry) => entry.key.startsWith("drt/"))
    .map((entry) => entry.value)
    .filter((drt) => taskIds.length === 0 || taskIds.includes(drt.TaskId));
  const resolved = tasks.map((t) => {
    if (t.Lifecycle === "PENDING") {
      const updated = { ...t, Lifecycle: "EXECUTING" };
      ctx.store.set(drtKey(t.TaskId), updated);
      return updated;
    }
    if (t.Lifecycle === "EXECUTING") {
      const updated = { ...t, Lifecycle: "SUCCEEDED" };
      ctx.store.set(drtKey(t.TaskId), updated);
      return updated;
    }
    return t;
  });
  return { DataRepositoryTasks: resolved };
};

const DescribeFileCaches: OperationHandler = (input, ctx) => {
  const fileCacheIds = stringArray(input["FileCacheIds"]);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const filters = input["Filters"];
  const raw = ctx.store
    .list<StoredFileCache>()
    .filter((entry) => entry.key.startsWith("fc/"))
    .map((entry) => entry.value)
    .filter(
      (fc) =>
        fileCacheIds.length === 0 || fileCacheIds.includes(fc.FileCacheId),
    )
    .filter((fc) =>
      applyFilters(filters, fc as unknown as Record<string, unknown>),
    );
  const resolved = raw.map((fc) => {
    if (fc.Lifecycle === "CREATING") {
      const updated = { ...fc, Lifecycle: "AVAILABLE" };
      ctx.store.set(fileCacheKey(fc.FileCacheId), updated);
      return updated;
    }
    return fc;
  });
  const withTags = resolved.map((fc) => ({
    ...fc,
    Tags: mergeTags(ctx, fc.ResourceARN, fc.Tags),
  }));
  const { items, nextToken: next } = paginate(withTags, maxResults, nextToken);
  return { FileCaches: items, NextToken: next };
};

const DescribeFileSystemAliases: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  const aliases = ctx.store.get<StoredAlias[]>(aliasesKey(fileSystemId)) ?? [];
  const resolved = aliases.map((a) =>
    a.Lifecycle === "CREATING" ? { ...a, Lifecycle: "AVAILABLE" } : a,
  );
  if (resolved.some((a, i) => a !== aliases[i])) {
    ctx.store.set(aliasesKey(fileSystemId), resolved);
  }
  return { Aliases: resolved };
};

const DescribeS3AccessPointAttachments: OperationHandler = (input, ctx) => {
  const names = stringArray(input["Names"]);
  const attachments = ctx.store
    .list<StoredS3AccessPoint>()
    .filter((entry) => entry.key.startsWith("s3ap/"))
    .map((entry) => entry.value)
    .filter((s3ap) => names.length === 0 || names.includes(s3ap.Name));
  return {
    S3AccessPointAttachments: attachments.map((s3ap) => ({
      Name: s3ap.Name,
      Lifecycle: s3ap.Lifecycle,
      S3AccessPoint: { ResourceARN: s3ap.ResourceARN },
    })),
  };
};

const DescribeSharedVpcConfiguration: OperationHandler = (_input, ctx) => {
  const config = ctx.store.get<{
    EnableFsxRouteTableUpdatesFromParticipantAccounts: string;
  }>(sharedVpcConfigKey());
  return {
    EnableFsxRouteTableUpdatesFromParticipantAccounts:
      config?.EnableFsxRouteTableUpdatesFromParticipantAccounts ?? "false",
  };
};

const DescribeSnapshots: OperationHandler = (input, ctx) => {
  const snapshotIds = stringArray(input["SnapshotIds"]);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const filters = input["Filters"];
  const raw = ctx.store
    .list<StoredSnapshot>()
    .filter((entry) => entry.key.startsWith("snapshot/"))
    .map((entry) => entry.value)
    .filter(
      (s) => snapshotIds.length === 0 || snapshotIds.includes(s.SnapshotId),
    )
    .filter((s) =>
      applyFilters(filters, s as unknown as Record<string, unknown>),
    );
  const resolved = raw.map((s) => {
    if (s.Lifecycle === "CREATING") {
      const updated = { ...s, Lifecycle: "AVAILABLE" };
      ctx.store.set(snapshotKey(s.SnapshotId), updated);
      return updated;
    }
    return s;
  });
  const withTags = resolved.map((s) => ({
    ...s,
    Tags: mergeTags(ctx, s.ResourceARN, s.Tags),
  }));
  const { items, nextToken: next } = paginate(withTags, maxResults, nextToken);
  return { Snapshots: items, NextToken: next };
};

const DescribeStorageVirtualMachines: OperationHandler = (input, ctx) => {
  const svmIds = stringArray(input["StorageVirtualMachineIds"]);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const filters = input["Filters"];
  const raw = ctx.store
    .list<StoredStorageVirtualMachine>()
    .filter((entry) => entry.key.startsWith("svm/"))
    .map((entry) => entry.value)
    .filter(
      (svm) =>
        svmIds.length === 0 || svmIds.includes(svm.StorageVirtualMachineId),
    )
    .filter((svm) =>
      applyFilters(filters, svm as unknown as Record<string, unknown>),
    );
  const resolved = raw.map((svm) => {
    if (svm.Lifecycle === "CREATING") {
      const updated = { ...svm, Lifecycle: "CREATED" };
      ctx.store.set(svmKey(svm.StorageVirtualMachineId), updated);
      return updated;
    }
    return svm;
  });
  const withTags = resolved.map((svm) => ({
    ...svm,
    Tags: mergeTags(ctx, svm.ResourceARN, svm.Tags),
  }));
  const { items, nextToken: next } = paginate(withTags, maxResults, nextToken);
  return { StorageVirtualMachines: items, NextToken: next };
};

const DescribeVolumes: OperationHandler = (input, ctx) => {
  const volumeIds = stringArray(input["VolumeIds"]);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const filters = input["Filters"];
  const raw = ctx.store
    .list<StoredVolume>()
    .filter((entry) => entry.key.startsWith("volume/"))
    .map((entry) => entry.value)
    .filter((v) => volumeIds.length === 0 || volumeIds.includes(v.VolumeId))
    .filter((v) =>
      applyFilters(filters, v as unknown as Record<string, unknown>),
    );
  const resolved = raw.map((v) => {
    if (v.Lifecycle === "CREATING") {
      const updated = { ...v, Lifecycle: "AVAILABLE" };
      ctx.store.set(volumeKey(v.VolumeId), updated);
      return updated;
    }
    return v;
  });
  const withTags = resolved.map((v) => ({
    ...v,
    Tags: mergeTags(ctx, v.ResourceARN, v.Tags),
  }));
  const { items, nextToken: next } = paginate(withTags, maxResults, nextToken);
  return { Volumes: items, NextToken: next };
};

const DetachAndDeleteS3AccessPoint: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["Name"]);
  if (name === undefined) {
    throw awsError("BadRequest", "Name is required.", 400);
  }
  ctx.store.delete(s3apKey(name));
  return { Lifecycle: "DELETING", Name: name };
};

const DisassociateFileSystemAliases: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  const aliasNamesToRemove = stringArray(input["Aliases"]);
  const existing = ctx.store.get<StoredAlias[]>(aliasesKey(fileSystemId)) ?? [];
  const removeSet = new Set(aliasNamesToRemove);
  const updated = existing.filter((a) => !removeSet.has(a.Name));
  ctx.store.set(aliasesKey(fileSystemId), updated);
  const removedAliases = aliasNamesToRemove.map((name) => ({
    Name: name,
    Lifecycle: "DELETING",
  }));
  return { Aliases: removedAliases };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = stringOrUndefined(input["ResourceARN"]);
  if (resourceArn === undefined) {
    throw awsError("BadRequest", "ResourceARN is required.", 400);
  }
  const tags =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(resourceArn)) ?? [];
  return { Tags: tags };
};

const ReleaseFileSystemNfsV3Locks: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  const fileSystem = requireFileSystem(ctx, fileSystemId);
  return { FileSystem: fileSystem };
};

const RestoreVolumeFromSnapshot: OperationHandler = (input, ctx) => {
  const volumeId = stringOrUndefined(input["VolumeId"]);
  if (volumeId === undefined) {
    throw awsError("BadRequest", "VolumeId is required.", 400);
  }
  const snapshotId = stringOrUndefined(input["SnapshotId"]);
  if (snapshotId === undefined) {
    throw awsError("BadRequest", "SnapshotId is required.", 400);
  }
  requireVolume(ctx, volumeId);
  requireSnapshot(ctx, snapshotId);
  return {
    VolumeId: volumeId,
    Lifecycle: "CREATED",
    AdministrativeActions: [],
  };
};

const StartMisconfiguredStateRecovery: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  const fileSystem = requireFileSystem(ctx, fileSystemId);
  const updated: StoredFileSystem = { ...fileSystem, Lifecycle: "AVAILABLE" };
  ctx.store.set(fileSystemKey(fileSystemId), updated);
  return { FileSystem: updated };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = stringOrUndefined(input["ResourceARN"]);
  if (resourceArn === undefined) {
    throw awsError("BadRequest", "ResourceARN is required.", 400);
  }
  const newTags = tagsFromInput(input["Tags"]);
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(resourceArn)) ?? [];
  const existingMap = new Map(existing.map((t) => [t.Key, t.Value]));
  for (const tag of newTags) {
    existingMap.set(tag.Key, tag.Value);
  }
  const merged = Array.from(existingMap.entries()).map(([Key, Value]) => ({
    Key,
    Value,
  }));
  ctx.store.set(tagsKey(resourceArn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = stringOrUndefined(input["ResourceARN"]);
  if (resourceArn === undefined) {
    throw awsError("BadRequest", "ResourceARN is required.", 400);
  }
  const tagKeys = stringArray(input["TagKeys"]);
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(resourceArn)) ?? [];
  const removeSet = new Set(tagKeys);
  const filtered = existing.filter((t) => !removeSet.has(t.Key));
  ctx.store.set(tagsKey(resourceArn), filtered);
  return {};
};

const UpdateDataRepositoryAssociation: OperationHandler = (input, ctx) => {
  const associationId = stringOrUndefined(input["AssociationId"]);
  if (associationId === undefined) {
    throw awsError("BadRequest", "AssociationId is required.", 400);
  }
  const dra = requireDataRepositoryAssociation(ctx, associationId);
  const updated: StoredDataRepositoryAssociation = {
    ...dra,
    ImportedFileChunkSize: numberOrDefault(
      input["ImportedFileChunkSize"],
      dra.ImportedFileChunkSize,
    ),
  };
  ctx.store.set(draKey(associationId), updated);
  return { Association: updated };
};

const UpdateFileCache: OperationHandler = (input, ctx) => {
  const fileCacheId = stringOrUndefined(input["FileCacheId"]);
  if (fileCacheId === undefined) {
    throw awsError("BadRequest", "FileCacheId is required.", 400);
  }
  const fc = requireFileCache(ctx, fileCacheId);
  ctx.store.set(fileCacheKey(fileCacheId), fc);
  return { FileCache: fc };
};

const UpdateFileSystem: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  const fileSystem = requireFileSystem(ctx, fileSystemId);
  const updated: StoredFileSystem = {
    ...fileSystem,
    StorageCapacity:
      typeof input["StorageCapacity"] === "number"
        ? (input["StorageCapacity"] as number)
        : fileSystem.StorageCapacity,
  };
  ctx.store.set(fileSystemKey(fileSystemId), updated);
  return { FileSystem: updated };
};

const UpdateSharedVpcConfiguration: OperationHandler = (input, ctx) => {
  const enable = stringOrUndefined(
    input["EnableFsxRouteTableUpdatesFromParticipantAccounts"],
  );
  const current = ctx.store.get<{
    EnableFsxRouteTableUpdatesFromParticipantAccounts: string;
  }>(sharedVpcConfigKey());
  const updated = {
    EnableFsxRouteTableUpdatesFromParticipantAccounts:
      enable ??
      current?.EnableFsxRouteTableUpdatesFromParticipantAccounts ??
      "false",
  };
  ctx.store.set(sharedVpcConfigKey(), updated);
  return updated;
};

const UpdateSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId = stringOrUndefined(input["SnapshotId"]);
  if (snapshotId === undefined) {
    throw awsError("BadRequest", "SnapshotId is required.", 400);
  }
  const name = stringOrUndefined(input["Name"]);
  if (name === undefined) {
    throw awsError("BadRequest", "Name is required.", 400);
  }
  const snapshot = requireSnapshot(ctx, snapshotId);
  const updated: StoredSnapshot = { ...snapshot, Name: name };
  ctx.store.set(snapshotKey(snapshotId), updated);
  return { Snapshot: updated };
};

const UpdateStorageVirtualMachine: OperationHandler = (input, ctx) => {
  const svmId = stringOrUndefined(input["StorageVirtualMachineId"]);
  if (svmId === undefined) {
    throw awsError("BadRequest", "StorageVirtualMachineId is required.", 400);
  }
  const svm = requireStorageVirtualMachine(ctx, svmId);
  ctx.store.set(svmKey(svmId), svm);
  return { StorageVirtualMachine: svm };
};

const UpdateVolume: OperationHandler = (input, ctx) => {
  const volumeId = stringOrUndefined(input["VolumeId"]);
  if (volumeId === undefined) {
    throw awsError("BadRequest", "VolumeId is required.", 400);
  }
  const volume = requireVolume(ctx, volumeId);
  const updated: StoredVolume = {
    ...volume,
    Name: stringOrUndefined(input["Name"]) ?? volume.Name,
  };
  ctx.store.set(volumeKey(volumeId), updated);
  return { Volume: updated };
};

const fsx: ServiceDefinition = {
  name: "fsx",
  protocol: "json",
  operations: {
    AssociateFileSystemAliases,
    CancelDataRepositoryTask,
    CopyBackup,
    CopySnapshotAndUpdateVolume,
    CreateAndAttachS3AccessPoint,
    CreateBackup,
    CreateDataRepositoryAssociation,
    CreateDataRepositoryTask,
    CreateFileCache,
    CreateFileSystem,
    CreateFileSystemFromBackup,
    CreateSnapshot,
    CreateStorageVirtualMachine,
    CreateVolume,
    CreateVolumeFromBackup,
    DeleteBackup,
    DeleteDataRepositoryAssociation,
    DeleteFileCache,
    DeleteFileSystem,
    DeleteSnapshot,
    DeleteStorageVirtualMachine,
    DeleteVolume,
    DescribeBackups,
    DescribeDataRepositoryAssociations,
    DescribeDataRepositoryTasks,
    DescribeFileCaches,
    DescribeFileSystemAliases,
    DescribeFileSystems,
    DescribeS3AccessPointAttachments,
    DescribeSharedVpcConfiguration,
    DescribeSnapshots,
    DescribeStorageVirtualMachines,
    DescribeVolumes,
    DetachAndDeleteS3AccessPoint,
    DisassociateFileSystemAliases,
    ListTagsForResource,
    ReleaseFileSystemNfsV3Locks,
    RestoreVolumeFromSnapshot,
    StartMisconfiguredStateRecovery,
    TagResource,
    UntagResource,
    UpdateDataRepositoryAssociation,
    UpdateFileCache,
    UpdateFileSystem,
    UpdateSharedVpcConfiguration,
    UpdateSnapshot,
    UpdateStorageVirtualMachine,
    UpdateVolume,
  },
  model,
} as const;

export default fsx;
