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
  throughputMode: string;
  availabilityZoneName: string | undefined;
  tags: { Key: string; Value: string }[];
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

const fileSystemKey = (id: string): string => `fs/${id}`;

const mountTargetKey = (id: string): string => `mt/${id}`;

const lifecycleKey = (id: string): string => `lc/${id}`;

const hex = (length: number): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
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
  ThroughputMode: fileSystem.throughputMode,
  AvailabilityZoneName: fileSystem.availabilityZoneName,
  Tags: fileSystem.tags,
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
    throughputMode: stringOrUndefined(input["ThroughputMode"]) ?? "bursting",
    availabilityZoneName: stringOrUndefined(input["AvailabilityZoneName"]),
    tags,
  };
  ctx.store.set(fileSystemKey(fileSystemId), fileSystem);
  return fileSystemView(fileSystem);
};

const DescribeFileSystems: OperationHandler = (input, ctx) => {
  const fileSystemId = stringOrUndefined(input["FileSystemId"]);
  const creationToken = stringOrUndefined(input["CreationToken"]);
  const fileSystems = ctx.store
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
  return { FileSystems: fileSystems.map(fileSystemView) };
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
  return undefined;
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
  const fileSystem = requireFileSystem(ctx, fileSystemId);
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
  const mountTargets = ctx.store
    .list<StoredMountTarget>()
    .filter((entry) => entry.key.startsWith("mt/"))
    .map((entry) => entry.value)
    .filter(
      (mountTarget) =>
        (fileSystemId === undefined ||
          mountTarget.fileSystemId === fileSystemId) &&
        (mountTargetId === undefined ||
          mountTarget.mountTargetId === mountTargetId),
    );
  return { MountTargets: mountTargets.map(mountTargetView) };
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
      if (parts.length === 3 && req.method === "DELETE") {
        return "DeleteFileSystem";
      }
      if (
        parts.length === 4 &&
        parts[3] === "lifecycle-configuration" &&
        req.method === "PUT"
      ) {
        return "PutLifecycleConfiguration";
      }
      return undefined;
    }
    if (parts[1] === "mount-targets" && parts.length === 2) {
      if (req.method === "POST") return "CreateMountTarget";
      if (req.method === "GET") return "DescribeMountTargets";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateFileSystem,
    DescribeFileSystems,
    DeleteFileSystem,
    CreateMountTarget,
    DescribeMountTargets,
    PutLifecycleConfiguration,
  },
  model,
} as const satisfies ServiceDefinition;

export default efs;
