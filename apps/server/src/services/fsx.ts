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

const fileSystemKey = (id: string): string => `fs/${id}`;

const backupKey = (id: string): string => `backup/${id}`;

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
    Lifecycle: "AVAILABLE",
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
  const fileSystems = ctx.store
    .list<StoredFileSystem>()
    .filter((entry) => entry.key.startsWith("fs/"))
    .map((entry) => entry.value)
    .filter(
      (fileSystem) =>
        fileSystemIds.length === 0 ||
        fileSystemIds.includes(fileSystem.FileSystemId),
    );
  return { FileSystems: fileSystems };
};

const DeleteFileSystem: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  if (fileSystemId === undefined) {
    throw awsError("BadRequest", "FileSystemId is required.", 400);
  }
  requireFileSystem(ctx, fileSystemId);
  ctx.store.delete(fileSystemKey(fileSystemId));
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
    Lifecycle: "AVAILABLE",
    Type: "USER_INITIATED",
    ProgressPercent: 100,
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
  const backups = ctx.store
    .list<StoredBackup>()
    .filter((entry) => entry.key.startsWith("backup/"))
    .map((entry) => entry.value)
    .filter(
      (backup) => backupIds.length === 0 || backupIds.includes(backup.BackupId),
    );
  return { Backups: backups };
};

const fsx: ServiceDefinition = {
  name: "fsx",
  protocol: "json",
  operations: {
    CreateFileSystem,
    DescribeFileSystems,
    DeleteFileSystem,
    CreateBackup,
    DescribeBackups,
  },
  model,
} as const;

export default fsx;
