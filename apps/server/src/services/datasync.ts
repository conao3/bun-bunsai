import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import datasyncModel from "../../models/datasync.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(datasyncModel);

type StoredAgent = {
  AgentArn: string;
  Name: string | undefined;
  Status: string;
  CreationTime: number;
  LastConnectionTime: number;
  EndpointType: string;
  PrivateLinkConfig: unknown;
  Platform: unknown;
};

type StoredLocation = {
  LocationArn: string;
  LocationUri: string;
  LocationType: string;
  CreationTime: number;
  Tags: unknown[];
  Subdirectory: string | undefined;
  AgentArns: unknown[];
  S3BucketArn: string | undefined;
  S3StorageClass: string | undefined;
  S3Config: Record<string, unknown> | undefined;
  ServerHostname: string | undefined;
  OnPremConfig: unknown;
  MountOptions: unknown;
  User: string | undefined;
  Domain: string | undefined;
  Password: string | undefined;
  AuthenticationType: string | undefined;
  DnsIpAddresses: unknown[];
  KerberosPrincipal: string | undefined;
  CmkSecretConfig: unknown;
  CustomSecretConfig: unknown;
  NameNodes: unknown[];
  BlockSize: number | undefined;
  ReplicationFactor: number | undefined;
  KmsKeyProviderUri: string | undefined;
  QopConfiguration: unknown;
  SimpleUser: string | undefined;
  EfsFilesystemArn: string | undefined;
  Ec2Config: unknown;
  AccessPointArn: string | undefined;
  FileSystemAccessRoleArn: string | undefined;
  InTransitEncryption: string | undefined;
  FsxFilesystemArn: string | undefined;
  SecurityGroupArns: unknown[];
  Protocol: unknown;
  StorageVirtualMachineArn: string | undefined;
  ContainerUrl: string | undefined;
  SasConfiguration: unknown;
  BlobType: string | undefined;
  AccessTier: string | undefined;
  ServerPort: number | undefined;
  ServerProtocol: string | undefined;
  BucketName: string | undefined;
  AccessKey: string | undefined;
  SecretKey: string | undefined;
  ServerCertificate: unknown;
  ManagedSecretConfig: unknown;
};

type StoredTask = {
  TaskArn: string;
  Name: string | undefined;
  Status: string;
  SourceLocationArn: string;
  DestinationLocationArn: string;
  CloudWatchLogGroupArn: string | undefined;
  Options: unknown;
  Excludes: unknown[];
  Includes: unknown[];
  Schedule: unknown;
  Tags: unknown[];
  TaskMode: string;
  CreationTime: number;
  CurrentTaskExecutionArn: string | undefined;
  executions: string[];
};

type StoredTaskExecution = {
  TaskExecutionArn: string;
  Status: string;
  Options: unknown;
  Excludes: unknown[];
  Includes: unknown[];
  StartTime: number;
  EstimatedFilesToTransfer: number;
  EstimatedBytesToTransfer: number;
  FilesTransferred: number;
  BytesWritten: number;
  BytesTransferred: number;
  BytesCompressed: number;
  TaskMode: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? (value as unknown[]) : [];

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const hex17 = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 17);

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const requireString = (
  input: Record<string, unknown>,
  member: string,
): string => {
  const value = input[member];
  if (typeof value === "string" && value !== "") return value;
  throw awsError("InvalidRequestException", `${member} is required.`, 400);
};

const locationArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:datasync:${ctx.region}:${ctx.account}:location/loc-${id}`;

const taskArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:datasync:${ctx.region}:${ctx.account}:task/task-${id}`;

const agentArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:datasync:${ctx.region}:${ctx.account}:agent/agent-${id}`;

const locationKey = (arn: string): string => `location/${arn}`;

const taskKey = (arn: string): string => `task/${arn}`;

const agentKey = (arn: string): string => `agent/${arn}`;

const executionKey = (arn: string): string => `execution/${arn}`;

const tagsKey = (arn: string): string => `tags/${arn}`;

const requireLocation = (ctx: ServiceContext, arn: string): StoredLocation => {
  const location = ctx.store.get<StoredLocation>(locationKey(arn));
  if (location === undefined) {
    throw awsError(
      "InvalidRequestException",
      `Location ${arn} could not be found.`,
      400,
    );
  }
  return location;
};

const requireTask = (ctx: ServiceContext, arn: string): StoredTask => {
  const task = ctx.store.get<StoredTask>(taskKey(arn));
  if (task === undefined) {
    throw awsError(
      "InvalidRequestException",
      `Task ${arn} could not be found.`,
      400,
    );
  }
  return task;
};

const requireAgent = (ctx: ServiceContext, arn: string): StoredAgent => {
  const agent = ctx.store.get<StoredAgent>(agentKey(arn));
  if (agent === undefined) {
    throw awsError(
      "InvalidRequestException",
      `Agent ${arn} could not be found.`,
      400,
    );
  }
  return agent;
};

const requireTaskExecution = (
  ctx: ServiceContext,
  arn: string,
): StoredTaskExecution => {
  const execution = ctx.store.get<StoredTaskExecution>(executionKey(arn));
  if (execution === undefined) {
    throw awsError(
      "InvalidRequestException",
      `TaskExecution ${arn} could not be found.`,
      400,
    );
  }
  return execution;
};

const encodePageToken = (offset: number): string =>
  Buffer.from(String(offset), "utf8").toString("base64");

const decodePageToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") return 0;
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const applyOperator = (
  fieldVal: string,
  operator: string,
  values: string[],
): boolean => {
  switch (operator) {
    case "Equals":
      return values.includes(fieldVal);
    case "NotEquals":
      return !values.includes(fieldVal);
    case "In":
      return values.includes(fieldVal);
    case "Contains":
      return values.some((v) => fieldVal.includes(v));
    case "NotContains":
      return values.every((v) => !fieldVal.includes(v));
    case "BeginsWith":
      return values.some((v) => fieldVal.startsWith(v));
    default:
      return true;
  }
};

const applyLocationFilters = (
  locations: StoredLocation[],
  filters: unknown,
): StoredLocation[] => {
  if (!Array.isArray(filters) || filters.length === 0) return locations;
  return locations.filter((loc) =>
    (filters as unknown[]).every((f) => {
      if (typeof f !== "object" || f === null) return true;
      const filter = f as Record<string, unknown>;
      const name = filter["Name"];
      const values = Array.isArray(filter["Values"])
        ? (filter["Values"] as unknown[]).map(String)
        : [];
      const operator =
        typeof filter["Operator"] === "string" ? filter["Operator"] : "Equals";
      if (name === "LocationUri")
        return applyOperator(loc.LocationUri, operator, values);
      if (name === "LocationType")
        return applyOperator(loc.LocationType, operator, values);
      if (name === "CreationTime")
        return applyOperator(String(loc.CreationTime), operator, values);
      return true;
    }),
  );
};

const applyTaskFilters = (
  tasks: StoredTask[],
  filters: unknown,
): StoredTask[] => {
  if (!Array.isArray(filters) || filters.length === 0) return tasks;
  return tasks.filter((task) =>
    (filters as unknown[]).every((f) => {
      if (typeof f !== "object" || f === null) return true;
      const filter = f as Record<string, unknown>;
      const name = filter["Name"];
      const values = Array.isArray(filter["Values"])
        ? (filter["Values"] as unknown[]).map(String)
        : [];
      const operator =
        typeof filter["Operator"] === "string" ? filter["Operator"] : "Equals";
      if (name === "LocationId") {
        return (
          applyOperator(task.SourceLocationArn, operator, values) ||
          applyOperator(task.DestinationLocationArn, operator, values)
        );
      }
      if (name === "CreationTime")
        return applyOperator(String(task.CreationTime), operator, values);
      return true;
    }),
  );
};

const buildLocationUri = (
  locationType: string,
  input: Record<string, unknown>,
): string => {
  const sub = stringOrUndefined(input["Subdirectory"]) ?? "";
  const suffix = sub.startsWith("/") ? sub : sub ? `/${sub}` : "";
  switch (locationType) {
    case "S3": {
      const s3BucketArn = stringOrUndefined(input["S3BucketArn"]) ?? "";
      const bucketName = s3BucketArn.split(":").pop() ?? s3BucketArn;
      return `s3://${bucketName}${suffix}`;
    }
    case "NFS":
    case "SMB": {
      const host = stringOrUndefined(input["ServerHostname"]) ?? "";
      return `${locationType.toLowerCase()}://${host}${suffix}`;
    }
    case "HDFS": {
      const nameNodes = arrayOrEmpty(input["NameNodes"]);
      const firstNode = asRecord(nameNodes[0]);
      const host = stringOrUndefined(firstNode["Hostname"]) ?? "hdfs";
      return `hdfs://${host}${suffix}`;
    }
    case "EFS": {
      const efsArn = stringOrUndefined(input["EfsFilesystemArn"]) ?? "";
      const efsId = efsArn.split("/").pop() ?? efsArn;
      return `efs://${efsId}${suffix}`;
    }
    case "FsxWindows": {
      const fsxArn = stringOrUndefined(input["FsxFilesystemArn"]) ?? "";
      const fsxId = fsxArn.split("/").pop() ?? fsxArn;
      return `fsxw://${fsxId}${suffix}`;
    }
    case "FsxLustre": {
      const fsxArn = stringOrUndefined(input["FsxFilesystemArn"]) ?? "";
      const fsxId = fsxArn.split("/").pop() ?? fsxArn;
      return `fsxl://${fsxId}${suffix}`;
    }
    case "FsxOpenZfs": {
      const fsxArn = stringOrUndefined(input["FsxFilesystemArn"]) ?? "";
      const fsxId = fsxArn.split("/").pop() ?? fsxArn;
      return `fsxz://${fsxId}${suffix}`;
    }
    case "FsxOntap": {
      const svmArn = stringOrUndefined(input["StorageVirtualMachineArn"]) ?? "";
      const svmId = svmArn.split("/").pop() ?? svmArn;
      return `fsxo://${svmId}${suffix}`;
    }
    case "AzureBlob": {
      const containerUrl = stringOrUndefined(input["ContainerUrl"]) ?? "";
      return `${containerUrl}${suffix}`;
    }
    case "ObjectStorage": {
      const host = stringOrUndefined(input["ServerHostname"]) ?? "";
      const bucket = stringOrUndefined(input["BucketName"]) ?? "";
      return `object-storage://${host}/${bucket}${suffix}`;
    }
    default:
      return `unknown://${locationType}${suffix}`;
  }
};

const makeLocation = (
  arn: string,
  locationType: string,
  input: Record<string, unknown>,
): StoredLocation => ({
  LocationArn: arn,
  LocationUri: buildLocationUri(locationType, input),
  LocationType: locationType,
  CreationTime: nowSeconds(),
  Tags: arrayOrEmpty(input["Tags"]),
  Subdirectory: stringOrUndefined(input["Subdirectory"]),
  AgentArns: arrayOrEmpty(input["AgentArns"]),
  S3BucketArn: stringOrUndefined(input["S3BucketArn"]),
  S3StorageClass: stringOrUndefined(input["S3StorageClass"]),
  S3Config:
    input["S3Config"] !== undefined ? asRecord(input["S3Config"]) : undefined,
  ServerHostname: stringOrUndefined(input["ServerHostname"]),
  OnPremConfig: input["OnPremConfig"],
  MountOptions: input["MountOptions"],
  User: stringOrUndefined(input["User"]),
  Domain: stringOrUndefined(input["Domain"]),
  Password: stringOrUndefined(input["Password"]),
  AuthenticationType: stringOrUndefined(input["AuthenticationType"]),
  DnsIpAddresses: arrayOrEmpty(input["DnsIpAddresses"]),
  KerberosPrincipal: stringOrUndefined(input["KerberosPrincipal"]),
  CmkSecretConfig: input["CmkSecretConfig"],
  CustomSecretConfig: input["CustomSecretConfig"],
  NameNodes: arrayOrEmpty(input["NameNodes"]),
  BlockSize: numberOrUndefined(input["BlockSize"]),
  ReplicationFactor: numberOrUndefined(input["ReplicationFactor"]),
  KmsKeyProviderUri: stringOrUndefined(input["KmsKeyProviderUri"]),
  QopConfiguration: input["QopConfiguration"],
  SimpleUser: stringOrUndefined(input["SimpleUser"]),
  EfsFilesystemArn: stringOrUndefined(input["EfsFilesystemArn"]),
  Ec2Config: input["Ec2Config"],
  AccessPointArn: stringOrUndefined(input["AccessPointArn"]),
  FileSystemAccessRoleArn: stringOrUndefined(input["FileSystemAccessRoleArn"]),
  InTransitEncryption: stringOrUndefined(input["InTransitEncryption"]),
  FsxFilesystemArn: stringOrUndefined(input["FsxFilesystemArn"]),
  SecurityGroupArns: arrayOrEmpty(input["SecurityGroupArns"]),
  Protocol: input["Protocol"],
  StorageVirtualMachineArn: stringOrUndefined(
    input["StorageVirtualMachineArn"],
  ),
  ContainerUrl: stringOrUndefined(input["ContainerUrl"]),
  SasConfiguration: input["SasConfiguration"],
  BlobType: stringOrUndefined(input["BlobType"]),
  AccessTier: stringOrUndefined(input["AccessTier"]),
  ServerPort: numberOrUndefined(input["ServerPort"]),
  ServerProtocol: stringOrUndefined(input["ServerProtocol"]),
  BucketName: stringOrUndefined(input["BucketName"]),
  AccessKey: stringOrUndefined(input["AccessKey"]),
  SecretKey: stringOrUndefined(input["SecretKey"]),
  ServerCertificate: input["ServerCertificate"],
  ManagedSecretConfig: undefined,
});

const storeLocation = (
  locationType: string,
  input: Record<string, unknown>,
  ctx: ServiceContext,
): string => {
  const id = hex17();
  const arn = locationArn(ctx, id);
  ctx.store.set(locationKey(arn), makeLocation(arn, locationType, input));
  const tags = arrayOrEmpty(input["Tags"]);
  if (tags.length > 0) {
    ctx.store.set(tagsKey(arn), tags);
  }
  return arn;
};

const CreateAgent: OperationHandler = (input, ctx) => {
  const id = hex17();
  const arn = agentArn(ctx, id);
  const agent: StoredAgent = {
    AgentArn: arn,
    Name: stringOrUndefined(input["AgentName"]),
    Status: "ONLINE",
    CreationTime: nowSeconds(),
    LastConnectionTime: nowSeconds(),
    EndpointType: "PUBLIC",
    PrivateLinkConfig: undefined,
    Platform: undefined,
  };
  ctx.store.set(agentKey(arn), agent);
  const agentTags = arrayOrEmpty(input["Tags"]);
  if (agentTags.length > 0) {
    ctx.store.set(tagsKey(arn), agentTags);
  }
  return { AgentArn: arn };
};

const DeleteAgent: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AgentArn");
  requireAgent(ctx, arn);
  ctx.store.delete(agentKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const DescribeAgent: OperationHandler = (input, ctx) => {
  const agent = requireAgent(ctx, requireString(input, "AgentArn"));
  return {
    AgentArn: agent.AgentArn,
    Name: agent.Name,
    Status: agent.Status,
    LastConnectionTime: agent.LastConnectionTime,
    CreationTime: agent.CreationTime,
    EndpointType: agent.EndpointType,
    PrivateLinkConfig: agent.PrivateLinkConfig,
    Platform: agent.Platform,
  };
};

const ListAgents: OperationHandler = (input, ctx) => {
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const all = ctx.store
    .list<StoredAgent>()
    .filter((entry) => entry.key.startsWith("agent/"))
    .map((entry) => ({
      AgentArn: entry.value.AgentArn,
      Name: entry.value.Name,
      Status: entry.value.Status,
    }));
  const pageSize = maxResults ?? all.length;
  const page = all.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  if (nextOffset < all.length) {
    return { Agents: page, NextToken: encodePageToken(nextOffset) };
  }
  return { Agents: page };
};

const UpdateAgent: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AgentArn");
  const agent = requireAgent(ctx, arn);
  ctx.store.set(agentKey(arn), {
    ...agent,
    Name: stringOrUndefined(input["Name"]) ?? agent.Name,
  });
  return {};
};

const CreateLocationS3: OperationHandler = (input, ctx) => {
  const s3BucketArn = requireString(input, "S3BucketArn");
  const s3Config = asRecord(input["S3Config"]);
  if (stringOrUndefined(s3Config["BucketAccessRoleArn"]) === undefined) {
    throw awsError(
      "InvalidRequestException",
      "S3Config.BucketAccessRoleArn is required.",
      400,
    );
  }
  const arn = storeLocation(
    "S3",
    {
      ...input,
      S3BucketArn: s3BucketArn,
      S3StorageClass: stringOrUndefined(input["S3StorageClass"]) ?? "STANDARD",
      S3Config: s3Config,
    },
    ctx,
  );
  return { LocationArn: arn };
};

const DescribeLocationS3: OperationHandler = (input, ctx) => {
  const loc = requireLocation(ctx, requireString(input, "LocationArn"));
  return {
    LocationArn: loc.LocationArn,
    LocationUri: loc.LocationUri,
    S3StorageClass: loc.S3StorageClass,
    S3Config: loc.S3Config,
    AgentArns: loc.AgentArns,
    CreationTime: loc.CreationTime,
  };
};

const UpdateLocationS3: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LocationArn");
  const loc = requireLocation(ctx, arn);
  ctx.store.set(locationKey(arn), {
    ...loc,
    Subdirectory: stringOrUndefined(input["Subdirectory"]) ?? loc.Subdirectory,
    S3StorageClass:
      stringOrUndefined(input["S3StorageClass"]) ?? loc.S3StorageClass,
    S3Config:
      input["S3Config"] !== undefined
        ? asRecord(input["S3Config"])
        : loc.S3Config,
  });
  return {};
};

const CreateLocationNfs: OperationHandler = (input, ctx) => {
  requireString(input, "ServerHostname");
  return { LocationArn: storeLocation("NFS", input, ctx) };
};

const DescribeLocationNfs: OperationHandler = (input, ctx) => {
  const loc = requireLocation(ctx, requireString(input, "LocationArn"));
  return {
    LocationArn: loc.LocationArn,
    LocationUri: loc.LocationUri,
    OnPremConfig: loc.OnPremConfig,
    MountOptions: loc.MountOptions,
    CreationTime: loc.CreationTime,
  };
};

const UpdateLocationNfs: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LocationArn");
  const loc = requireLocation(ctx, arn);
  ctx.store.set(locationKey(arn), {
    ...loc,
    Subdirectory: stringOrUndefined(input["Subdirectory"]) ?? loc.Subdirectory,
    ServerHostname:
      stringOrUndefined(input["ServerHostname"]) ?? loc.ServerHostname,
    OnPremConfig:
      input["OnPremConfig"] !== undefined
        ? input["OnPremConfig"]
        : loc.OnPremConfig,
    MountOptions:
      input["MountOptions"] !== undefined
        ? input["MountOptions"]
        : loc.MountOptions,
  });
  return {};
};

const CreateLocationSmb: OperationHandler = (input, ctx) => {
  requireString(input, "ServerHostname");
  return { LocationArn: storeLocation("SMB", input, ctx) };
};

const DescribeLocationSmb: OperationHandler = (input, ctx) => {
  const loc = requireLocation(ctx, requireString(input, "LocationArn"));
  return {
    LocationArn: loc.LocationArn,
    LocationUri: loc.LocationUri,
    AgentArns: loc.AgentArns,
    User: loc.User,
    Domain: loc.Domain,
    MountOptions: loc.MountOptions,
    CreationTime: loc.CreationTime,
    DnsIpAddresses: loc.DnsIpAddresses,
    KerberosPrincipal: loc.KerberosPrincipal,
    AuthenticationType: loc.AuthenticationType,
    ManagedSecretConfig: loc.ManagedSecretConfig,
    CmkSecretConfig: loc.CmkSecretConfig,
    CustomSecretConfig: loc.CustomSecretConfig,
  };
};

const UpdateLocationSmb: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LocationArn");
  const loc = requireLocation(ctx, arn);
  ctx.store.set(locationKey(arn), {
    ...loc,
    Subdirectory: stringOrUndefined(input["Subdirectory"]) ?? loc.Subdirectory,
    ServerHostname:
      stringOrUndefined(input["ServerHostname"]) ?? loc.ServerHostname,
    User: stringOrUndefined(input["User"]) ?? loc.User,
    Domain: stringOrUndefined(input["Domain"]) ?? loc.Domain,
    Password: stringOrUndefined(input["Password"]) ?? loc.Password,
    AgentArns:
      input["AgentArns"] !== undefined
        ? arrayOrEmpty(input["AgentArns"])
        : loc.AgentArns,
    MountOptions:
      input["MountOptions"] !== undefined
        ? input["MountOptions"]
        : loc.MountOptions,
    AuthenticationType:
      stringOrUndefined(input["AuthenticationType"]) ?? loc.AuthenticationType,
    DnsIpAddresses:
      input["DnsIpAddresses"] !== undefined
        ? arrayOrEmpty(input["DnsIpAddresses"])
        : loc.DnsIpAddresses,
    KerberosPrincipal:
      stringOrUndefined(input["KerberosPrincipal"]) ?? loc.KerberosPrincipal,
    CmkSecretConfig:
      input["CmkSecretConfig"] !== undefined
        ? input["CmkSecretConfig"]
        : loc.CmkSecretConfig,
    CustomSecretConfig:
      input["CustomSecretConfig"] !== undefined
        ? input["CustomSecretConfig"]
        : loc.CustomSecretConfig,
  });
  return {};
};

const CreateLocationHdfs: OperationHandler = (input, ctx) => {
  requireString(input, "AuthenticationType");
  return { LocationArn: storeLocation("HDFS", input, ctx) };
};

const DescribeLocationHdfs: OperationHandler = (input, ctx) => {
  const loc = requireLocation(ctx, requireString(input, "LocationArn"));
  return {
    LocationArn: loc.LocationArn,
    LocationUri: loc.LocationUri,
    NameNodes: loc.NameNodes,
    BlockSize: loc.BlockSize,
    ReplicationFactor: loc.ReplicationFactor,
    KmsKeyProviderUri: loc.KmsKeyProviderUri,
    QopConfiguration: loc.QopConfiguration,
    AuthenticationType: loc.AuthenticationType,
    SimpleUser: loc.SimpleUser,
    KerberosPrincipal: loc.KerberosPrincipal,
    AgentArns: loc.AgentArns,
    CreationTime: loc.CreationTime,
    ManagedSecretConfig: loc.ManagedSecretConfig,
    CmkSecretConfig: loc.CmkSecretConfig,
    CustomSecretConfig: loc.CustomSecretConfig,
  };
};

const UpdateLocationHdfs: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LocationArn");
  const loc = requireLocation(ctx, arn);
  ctx.store.set(locationKey(arn), {
    ...loc,
    Subdirectory: stringOrUndefined(input["Subdirectory"]) ?? loc.Subdirectory,
    NameNodes:
      input["NameNodes"] !== undefined
        ? arrayOrEmpty(input["NameNodes"])
        : loc.NameNodes,
    BlockSize: numberOrUndefined(input["BlockSize"]) ?? loc.BlockSize,
    ReplicationFactor:
      numberOrUndefined(input["ReplicationFactor"]) ?? loc.ReplicationFactor,
    KmsKeyProviderUri:
      stringOrUndefined(input["KmsKeyProviderUri"]) ?? loc.KmsKeyProviderUri,
    QopConfiguration:
      input["QopConfiguration"] !== undefined
        ? input["QopConfiguration"]
        : loc.QopConfiguration,
    AuthenticationType:
      stringOrUndefined(input["AuthenticationType"]) ?? loc.AuthenticationType,
    SimpleUser: stringOrUndefined(input["SimpleUser"]) ?? loc.SimpleUser,
    KerberosPrincipal:
      stringOrUndefined(input["KerberosPrincipal"]) ?? loc.KerberosPrincipal,
    AgentArns:
      input["AgentArns"] !== undefined
        ? arrayOrEmpty(input["AgentArns"])
        : loc.AgentArns,
    CmkSecretConfig:
      input["CmkSecretConfig"] !== undefined
        ? input["CmkSecretConfig"]
        : loc.CmkSecretConfig,
    CustomSecretConfig:
      input["CustomSecretConfig"] !== undefined
        ? input["CustomSecretConfig"]
        : loc.CustomSecretConfig,
  });
  return {};
};

const CreateLocationEfs: OperationHandler = (input, ctx) => {
  requireString(input, "EfsFilesystemArn");
  return { LocationArn: storeLocation("EFS", input, ctx) };
};

const DescribeLocationEfs: OperationHandler = (input, ctx) => {
  const loc = requireLocation(ctx, requireString(input, "LocationArn"));
  return {
    LocationArn: loc.LocationArn,
    LocationUri: loc.LocationUri,
    Ec2Config: loc.Ec2Config,
    CreationTime: loc.CreationTime,
    AccessPointArn: loc.AccessPointArn,
    FileSystemAccessRoleArn: loc.FileSystemAccessRoleArn,
    InTransitEncryption: loc.InTransitEncryption,
  };
};

const UpdateLocationEfs: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LocationArn");
  const loc = requireLocation(ctx, arn);
  ctx.store.set(locationKey(arn), {
    ...loc,
    Subdirectory: stringOrUndefined(input["Subdirectory"]) ?? loc.Subdirectory,
    AccessPointArn:
      stringOrUndefined(input["AccessPointArn"]) ?? loc.AccessPointArn,
    FileSystemAccessRoleArn:
      stringOrUndefined(input["FileSystemAccessRoleArn"]) ??
      loc.FileSystemAccessRoleArn,
    InTransitEncryption:
      stringOrUndefined(input["InTransitEncryption"]) ??
      loc.InTransitEncryption,
  });
  return {};
};

const CreateLocationFsxWindows: OperationHandler = (input, ctx) => {
  requireString(input, "FsxFilesystemArn");
  return { LocationArn: storeLocation("FsxWindows", input, ctx) };
};

const DescribeLocationFsxWindows: OperationHandler = (input, ctx) => {
  const loc = requireLocation(ctx, requireString(input, "LocationArn"));
  return {
    LocationArn: loc.LocationArn,
    LocationUri: loc.LocationUri,
    SecurityGroupArns: loc.SecurityGroupArns,
    CreationTime: loc.CreationTime,
    User: loc.User,
    Domain: loc.Domain,
    ManagedSecretConfig: loc.ManagedSecretConfig,
    CmkSecretConfig: loc.CmkSecretConfig,
    CustomSecretConfig: loc.CustomSecretConfig,
  };
};

const UpdateLocationFsxWindows: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LocationArn");
  const loc = requireLocation(ctx, arn);
  ctx.store.set(locationKey(arn), {
    ...loc,
    Subdirectory: stringOrUndefined(input["Subdirectory"]) ?? loc.Subdirectory,
    Domain: stringOrUndefined(input["Domain"]) ?? loc.Domain,
    User: stringOrUndefined(input["User"]) ?? loc.User,
    Password: stringOrUndefined(input["Password"]) ?? loc.Password,
    CmkSecretConfig:
      input["CmkSecretConfig"] !== undefined
        ? input["CmkSecretConfig"]
        : loc.CmkSecretConfig,
    CustomSecretConfig:
      input["CustomSecretConfig"] !== undefined
        ? input["CustomSecretConfig"]
        : loc.CustomSecretConfig,
  });
  return {};
};

const CreateLocationFsxLustre: OperationHandler = (input, ctx) => {
  requireString(input, "FsxFilesystemArn");
  return { LocationArn: storeLocation("FsxLustre", input, ctx) };
};

const DescribeLocationFsxLustre: OperationHandler = (input, ctx) => {
  const loc = requireLocation(ctx, requireString(input, "LocationArn"));
  return {
    LocationArn: loc.LocationArn,
    LocationUri: loc.LocationUri,
    SecurityGroupArns: loc.SecurityGroupArns,
    CreationTime: loc.CreationTime,
  };
};

const UpdateLocationFsxLustre: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LocationArn");
  const loc = requireLocation(ctx, arn);
  ctx.store.set(locationKey(arn), {
    ...loc,
    Subdirectory: stringOrUndefined(input["Subdirectory"]) ?? loc.Subdirectory,
  });
  return {};
};

const CreateLocationFsxOpenZfs: OperationHandler = (input, ctx) => {
  requireString(input, "FsxFilesystemArn");
  return { LocationArn: storeLocation("FsxOpenZfs", input, ctx) };
};

const DescribeLocationFsxOpenZfs: OperationHandler = (input, ctx) => {
  const loc = requireLocation(ctx, requireString(input, "LocationArn"));
  return {
    LocationArn: loc.LocationArn,
    LocationUri: loc.LocationUri,
    SecurityGroupArns: loc.SecurityGroupArns,
    Protocol: loc.Protocol,
    CreationTime: loc.CreationTime,
  };
};

const UpdateLocationFsxOpenZfs: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LocationArn");
  const loc = requireLocation(ctx, arn);
  ctx.store.set(locationKey(arn), {
    ...loc,
    Subdirectory: stringOrUndefined(input["Subdirectory"]) ?? loc.Subdirectory,
    Protocol:
      input["Protocol"] !== undefined ? input["Protocol"] : loc.Protocol,
  });
  return {};
};

const CreateLocationFsxOntap: OperationHandler = (input, ctx) => {
  requireString(input, "StorageVirtualMachineArn");
  return { LocationArn: storeLocation("FsxOntap", input, ctx) };
};

const DescribeLocationFsxOntap: OperationHandler = (input, ctx) => {
  const loc = requireLocation(ctx, requireString(input, "LocationArn"));
  return {
    CreationTime: loc.CreationTime,
    LocationArn: loc.LocationArn,
    LocationUri: loc.LocationUri,
    Protocol: loc.Protocol,
    SecurityGroupArns: loc.SecurityGroupArns,
    StorageVirtualMachineArn: loc.StorageVirtualMachineArn,
    FsxFilesystemArn: loc.FsxFilesystemArn,
  };
};

const UpdateLocationFsxOntap: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LocationArn");
  const loc = requireLocation(ctx, arn);
  ctx.store.set(locationKey(arn), {
    ...loc,
    Subdirectory: stringOrUndefined(input["Subdirectory"]) ?? loc.Subdirectory,
    Protocol:
      input["Protocol"] !== undefined ? input["Protocol"] : loc.Protocol,
  });
  return {};
};

const CreateLocationAzureBlob: OperationHandler = (input, ctx) => {
  requireString(input, "ContainerUrl");
  requireString(input, "AuthenticationType");
  return { LocationArn: storeLocation("AzureBlob", input, ctx) };
};

const DescribeLocationAzureBlob: OperationHandler = (input, ctx) => {
  const loc = requireLocation(ctx, requireString(input, "LocationArn"));
  return {
    LocationArn: loc.LocationArn,
    LocationUri: loc.LocationUri,
    AuthenticationType: loc.AuthenticationType,
    BlobType: loc.BlobType,
    AccessTier: loc.AccessTier,
    AgentArns: loc.AgentArns,
    CreationTime: loc.CreationTime,
    ManagedSecretConfig: loc.ManagedSecretConfig,
    CmkSecretConfig: loc.CmkSecretConfig,
    CustomSecretConfig: loc.CustomSecretConfig,
  };
};

const UpdateLocationAzureBlob: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LocationArn");
  const loc = requireLocation(ctx, arn);
  ctx.store.set(locationKey(arn), {
    ...loc,
    Subdirectory: stringOrUndefined(input["Subdirectory"]) ?? loc.Subdirectory,
    AuthenticationType:
      stringOrUndefined(input["AuthenticationType"]) ?? loc.AuthenticationType,
    SasConfiguration:
      input["SasConfiguration"] !== undefined
        ? input["SasConfiguration"]
        : loc.SasConfiguration,
    BlobType: stringOrUndefined(input["BlobType"]) ?? loc.BlobType,
    AccessTier: stringOrUndefined(input["AccessTier"]) ?? loc.AccessTier,
    AgentArns:
      input["AgentArns"] !== undefined
        ? arrayOrEmpty(input["AgentArns"])
        : loc.AgentArns,
    CmkSecretConfig:
      input["CmkSecretConfig"] !== undefined
        ? input["CmkSecretConfig"]
        : loc.CmkSecretConfig,
    CustomSecretConfig:
      input["CustomSecretConfig"] !== undefined
        ? input["CustomSecretConfig"]
        : loc.CustomSecretConfig,
  });
  return {};
};

const CreateLocationObjectStorage: OperationHandler = (input, ctx) => {
  requireString(input, "ServerHostname");
  requireString(input, "BucketName");
  return { LocationArn: storeLocation("ObjectStorage", input, ctx) };
};

const DescribeLocationObjectStorage: OperationHandler = (input, ctx) => {
  const loc = requireLocation(ctx, requireString(input, "LocationArn"));
  return {
    LocationArn: loc.LocationArn,
    LocationUri: loc.LocationUri,
    AccessKey: loc.AccessKey,
    ServerPort: loc.ServerPort,
    ServerProtocol: loc.ServerProtocol,
    AgentArns: loc.AgentArns,
    CreationTime: loc.CreationTime,
    ServerCertificate: loc.ServerCertificate,
    ManagedSecretConfig: loc.ManagedSecretConfig,
    CmkSecretConfig: loc.CmkSecretConfig,
    CustomSecretConfig: loc.CustomSecretConfig,
  };
};

const UpdateLocationObjectStorage: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LocationArn");
  const loc = requireLocation(ctx, arn);
  ctx.store.set(locationKey(arn), {
    ...loc,
    ServerPort: numberOrUndefined(input["ServerPort"]) ?? loc.ServerPort,
    ServerProtocol:
      stringOrUndefined(input["ServerProtocol"]) ?? loc.ServerProtocol,
    Subdirectory: stringOrUndefined(input["Subdirectory"]) ?? loc.Subdirectory,
    ServerHostname:
      stringOrUndefined(input["ServerHostname"]) ?? loc.ServerHostname,
    AccessKey: stringOrUndefined(input["AccessKey"]) ?? loc.AccessKey,
    SecretKey: stringOrUndefined(input["SecretKey"]) ?? loc.SecretKey,
    AgentArns:
      input["AgentArns"] !== undefined
        ? arrayOrEmpty(input["AgentArns"])
        : loc.AgentArns,
    ServerCertificate:
      input["ServerCertificate"] !== undefined
        ? input["ServerCertificate"]
        : loc.ServerCertificate,
    CmkSecretConfig:
      input["CmkSecretConfig"] !== undefined
        ? input["CmkSecretConfig"]
        : loc.CmkSecretConfig,
    CustomSecretConfig:
      input["CustomSecretConfig"] !== undefined
        ? input["CustomSecretConfig"]
        : loc.CustomSecretConfig,
  });
  return {};
};

const ListLocations: OperationHandler = (input, ctx) => {
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const all = applyLocationFilters(
    ctx.store
      .list<StoredLocation>()
      .filter((entry) => entry.key.startsWith("location/"))
      .map((entry) => entry.value),
    input["Filters"],
  ).map((loc) => ({
    LocationArn: loc.LocationArn,
    LocationUri: loc.LocationUri,
  }));
  const pageSize = maxResults ?? all.length;
  const page = all.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  if (nextOffset < all.length) {
    return { Locations: page, NextToken: encodePageToken(nextOffset) };
  }
  return { Locations: page };
};

const DeleteLocation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LocationArn");
  requireLocation(ctx, arn);
  const inUse = ctx.store
    .list<StoredTask>()
    .filter((entry) => entry.key.startsWith("task/"))
    .some(
      (entry) =>
        entry.value.SourceLocationArn === arn ||
        entry.value.DestinationLocationArn === arn,
    );
  if (inUse) {
    throw awsError(
      "InvalidRequestException",
      `Location ${arn} is in use by one or more tasks.`,
      400,
    );
  }
  ctx.store.delete(locationKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const CreateTask: OperationHandler = (input, ctx) => {
  const sourceLocationArn = requireString(input, "SourceLocationArn");
  const destinationLocationArn = requireString(input, "DestinationLocationArn");
  requireLocation(ctx, sourceLocationArn);
  requireLocation(ctx, destinationLocationArn);
  const id = hex17();
  const arn = taskArn(ctx, id);
  const task: StoredTask = {
    TaskArn: arn,
    Name: stringOrUndefined(input["Name"]),
    Status: "CREATING",
    SourceLocationArn: sourceLocationArn,
    DestinationLocationArn: destinationLocationArn,
    CloudWatchLogGroupArn: stringOrUndefined(input["CloudWatchLogGroupArn"]),
    Options: input["Options"],
    Excludes: arrayOrEmpty(input["Excludes"]),
    Includes: arrayOrEmpty(input["Includes"]),
    Schedule: input["Schedule"],
    Tags: arrayOrEmpty(input["Tags"]),
    TaskMode: stringOrUndefined(input["TaskMode"]) ?? "BASIC",
    CreationTime: nowSeconds(),
    CurrentTaskExecutionArn: undefined,
    executions: [],
  };
  ctx.store.set(taskKey(arn), task);
  const taskTags = arrayOrEmpty(input["Tags"]);
  if (taskTags.length > 0) {
    ctx.store.set(tagsKey(arn), taskTags);
  }
  return { TaskArn: arn };
};

const DescribeTask: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TaskArn");
  let task = requireTask(ctx, arn);
  if (task.Status === "CREATING") {
    task = { ...task, Status: "AVAILABLE" };
    ctx.store.set(taskKey(arn), task);
  } else if (task.Status === "QUEUED") {
    task = { ...task, Status: "RUNNING" };
    ctx.store.set(taskKey(arn), task);
  }
  return {
    TaskArn: task.TaskArn,
    Status: task.Status,
    Name: task.Name,
    CurrentTaskExecutionArn: task.CurrentTaskExecutionArn,
    SourceLocationArn: task.SourceLocationArn,
    DestinationLocationArn: task.DestinationLocationArn,
    CloudWatchLogGroupArn: task.CloudWatchLogGroupArn,
    SourceNetworkInterfaceArns: [],
    DestinationNetworkInterfaceArns: [],
    Options: task.Options,
    Excludes: task.Excludes,
    Includes: task.Includes,
    Schedule: task.Schedule,
    CreationTime: task.CreationTime,
    TaskMode: task.TaskMode,
  };
};

const ListTasks: OperationHandler = (input, ctx) => {
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const all = applyTaskFilters(
    ctx.store
      .list<StoredTask>()
      .filter((entry) => entry.key.startsWith("task/"))
      .map((entry) => entry.value),
    input["Filters"],
  ).map((task) => ({
    TaskArn: task.TaskArn,
    Status: task.Status,
    Name: task.Name,
    TaskMode: task.TaskMode,
  }));
  const pageSize = maxResults ?? all.length;
  const page = all.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  if (nextOffset < all.length) {
    return { Tasks: page, NextToken: encodePageToken(nextOffset) };
  }
  return { Tasks: page };
};

const DeleteTask: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TaskArn");
  requireTask(ctx, arn);
  ctx.store.delete(taskKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const UpdateTask: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TaskArn");
  const task = requireTask(ctx, arn);
  ctx.store.set(taskKey(arn), {
    ...task,
    Name: stringOrUndefined(input["Name"]) ?? task.Name,
    CloudWatchLogGroupArn:
      stringOrUndefined(input["CloudWatchLogGroupArn"]) ??
      task.CloudWatchLogGroupArn,
    Options: input["Options"] !== undefined ? input["Options"] : task.Options,
    Excludes:
      input["Excludes"] !== undefined
        ? arrayOrEmpty(input["Excludes"])
        : task.Excludes,
    Includes:
      input["Includes"] !== undefined
        ? arrayOrEmpty(input["Includes"])
        : task.Includes,
    Schedule:
      input["Schedule"] !== undefined ? input["Schedule"] : task.Schedule,
  });
  return {};
};

const StartTaskExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TaskArn");
  const task = requireTask(ctx, arn);
  const executionArn = `${arn}/execution/exec-${hex17()}`;
  const execution: StoredTaskExecution = {
    TaskExecutionArn: executionArn,
    Status: "LAUNCHING",
    Options: input["OverrideOptions"] ?? task.Options,
    Excludes:
      input["Excludes"] !== undefined
        ? arrayOrEmpty(input["Excludes"])
        : task.Excludes,
    Includes:
      input["Includes"] !== undefined
        ? arrayOrEmpty(input["Includes"])
        : task.Includes,
    StartTime: nowSeconds(),
    EstimatedFilesToTransfer: 0,
    EstimatedBytesToTransfer: 0,
    FilesTransferred: 0,
    BytesWritten: 0,
    BytesTransferred: 0,
    BytesCompressed: 0,
    TaskMode: task.TaskMode,
  };
  ctx.store.set(executionKey(executionArn), execution);
  task.executions.push(executionArn);
  task.CurrentTaskExecutionArn = executionArn;
  task.Status = "QUEUED";
  ctx.store.set(taskKey(arn), task);
  return { TaskExecutionArn: executionArn };
};

const CancelTaskExecution: OperationHandler = (input, ctx) => {
  const executionArn = requireString(input, "TaskExecutionArn");
  const execution = requireTaskExecution(ctx, executionArn);
  ctx.store.set(executionKey(executionArn), {
    ...execution,
    Status: "CANCELLING",
  });
  return {};
};

const DescribeTaskExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TaskExecutionArn");
  let execution = requireTaskExecution(ctx, arn);
  if (execution.Status === "CANCELLING") {
    execution = { ...execution, Status: "ERROR" };
    ctx.store.set(executionKey(arn), execution);
  }
  return {
    TaskExecutionArn: execution.TaskExecutionArn,
    Status: execution.Status,
    Options: execution.Options,
    Excludes: execution.Excludes,
    Includes: execution.Includes,
    StartTime: execution.StartTime,
    EstimatedFilesToTransfer: execution.EstimatedFilesToTransfer,
    EstimatedBytesToTransfer: execution.EstimatedBytesToTransfer,
    FilesTransferred: execution.FilesTransferred,
    BytesWritten: execution.BytesWritten,
    BytesTransferred: execution.BytesTransferred,
    BytesCompressed: execution.BytesCompressed,
    TaskMode: execution.TaskMode,
  };
};

const ListTaskExecutions: OperationHandler = (input, ctx) => {
  const filterTaskArn = stringOrUndefined(input["TaskArn"]);
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const all = ctx.store
    .list<StoredTaskExecution>()
    .filter((entry) => entry.key.startsWith("execution/"))
    .filter(
      (entry) =>
        filterTaskArn === undefined ||
        entry.value.TaskExecutionArn.startsWith(filterTaskArn),
    )
    .map((entry) => ({
      TaskExecutionArn: entry.value.TaskExecutionArn,
      Status: entry.value.Status,
    }));
  const pageSize = maxResults ?? all.length;
  const page = all.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  if (nextOffset < all.length) {
    return { TaskExecutions: page, NextToken: encodePageToken(nextOffset) };
  }
  return { TaskExecutions: page };
};

const UpdateTaskExecution: OperationHandler = (input, ctx) => {
  const executionArn = requireString(input, "TaskExecutionArn");
  const execution = requireTaskExecution(ctx, executionArn);
  ctx.store.set(executionKey(executionArn), {
    ...execution,
    Options:
      input["Options"] !== undefined ? input["Options"] : execution.Options,
  });
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const newTags = arrayOrEmpty(input["Tags"]) as Record<string, unknown>[];
  const merged = (ctx.store.get<unknown[]>(tagsKey(arn)) ?? []) as Record<
    string,
    unknown
  >[];
  for (const tag of newTags) {
    const idx = merged.findIndex((t) => t["Key"] === tag["Key"]);
    if (idx >= 0) {
      merged[idx] = tag;
    } else {
      merged.push(tag);
    }
  }
  ctx.store.set(tagsKey(arn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const keys = arrayOrEmpty(input["Keys"]) as string[];
  const existing = (ctx.store.get<unknown[]>(tagsKey(arn)) ?? []) as Record<
    string,
    unknown
  >[];
  ctx.store.set(
    tagsKey(arn),
    existing.filter((tag) => !keys.includes(tag["Key"] as string)),
  );
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tags = ctx.store.get<unknown[]>(tagsKey(arn)) ?? [];
  return { Tags: tags };
};

const datasync: ServiceDefinition = {
  name: "datasync",
  protocol: "json",
  operations: {
    CancelTaskExecution,
    CreateAgent,
    CreateLocationAzureBlob,
    CreateLocationEfs,
    CreateLocationFsxLustre,
    CreateLocationFsxOntap,
    CreateLocationFsxOpenZfs,
    CreateLocationFsxWindows,
    CreateLocationHdfs,
    CreateLocationNfs,
    CreateLocationObjectStorage,
    CreateLocationS3,
    CreateLocationSmb,
    CreateTask,
    DeleteAgent,
    DeleteLocation,
    DeleteTask,
    DescribeAgent,
    DescribeLocationAzureBlob,
    DescribeLocationEfs,
    DescribeLocationFsxLustre,
    DescribeLocationFsxOntap,
    DescribeLocationFsxOpenZfs,
    DescribeLocationFsxWindows,
    DescribeLocationHdfs,
    DescribeLocationNfs,
    DescribeLocationObjectStorage,
    DescribeLocationS3,
    DescribeLocationSmb,
    DescribeTask,
    DescribeTaskExecution,
    ListAgents,
    ListLocations,
    ListTagsForResource,
    ListTaskExecutions,
    ListTasks,
    StartTaskExecution,
    TagResource,
    UntagResource,
    UpdateAgent,
    UpdateLocationAzureBlob,
    UpdateLocationEfs,
    UpdateLocationFsxLustre,
    UpdateLocationFsxOntap,
    UpdateLocationFsxOpenZfs,
    UpdateLocationFsxWindows,
    UpdateLocationHdfs,
    UpdateLocationNfs,
    UpdateLocationObjectStorage,
    UpdateLocationS3,
    UpdateLocationSmb,
    UpdateTask,
    UpdateTaskExecution,
  },
  model,
} as const;

export default datasync;
