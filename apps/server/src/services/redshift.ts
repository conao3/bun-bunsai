import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import redshiftModel from "../../../../test/vendor/aws-models/redshift.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(redshiftModel);

type StoredCluster = {
  ClusterIdentifier: string;
  NodeType: string;
  ClusterStatus: string;
  ClusterAvailabilityStatus: string;
  MasterUsername: string | undefined;
  DBName: string;
  Endpoint: {
    Address: string;
    Port: number;
  };
  ClusterCreateTime: string;
  AutomatedSnapshotRetentionPeriod: number;
  ManualSnapshotRetentionPeriod: number;
  ClusterSubnetGroupName: string | undefined;
  AvailabilityZone: string;
  PreferredMaintenanceWindow: string;
  ClusterVersion: string;
  AllowVersionUpgrade: boolean;
  NumberOfNodes: number;
  PubliclyAccessible: boolean;
  Encrypted: boolean;
  ClusterNamespaceArn: string;
  IamRoles: { IamRoleArn: string; ApplyStatus: string }[];
};

type StoredSubnet = {
  SubnetIdentifier: string;
  SubnetAvailabilityZone: {
    Name: string;
  };
  SubnetStatus: string;
};

type StoredClusterSubnetGroup = {
  ClusterSubnetGroupName: string;
  Description: string;
  VpcId: string;
  SubnetGroupStatus: string;
  Subnets: StoredSubnet[];
};

type StoredSnapshot = {
  SnapshotIdentifier: string;
  ClusterIdentifier: string;
  SnapshotCreateTime: string;
  Status: string;
  Port: number;
  AvailabilityZone: string;
  ClusterCreateTime: string;
  MasterUsername: string | undefined;
  ClusterVersion: string;
  NodeType: string;
  NumberOfNodes: number;
  DBName: string;
  Encrypted: boolean;
  ManualSnapshotRetentionPeriod: number;
  SnapshotType: string;
  AccountsWithRestoreAccess: { AccountId: string }[];
};

type StoredParameter = {
  ParameterName: string;
  ParameterValue: string;
  Description: string;
  Source: string;
  DataType: string;
  IsModifiable: boolean;
};

type StoredParameterGroup = {
  ParameterGroupName: string;
  ParameterGroupFamily: string;
  Description: string;
  Parameters: StoredParameter[];
};

type StoredSecurityGroup = {
  ClusterSecurityGroupName: string;
  Description: string;
  EC2SecurityGroups: {
    Status: string;
    EC2SecurityGroupName: string;
    EC2SecurityGroupOwnerId: string;
  }[];
  IPRanges: { Status: string; CIDRIP: string }[];
};

type StoredLoggingStatus = {
  LoggingEnabled: boolean;
  BucketName: string | undefined;
  S3KeyPrefix: string | undefined;
  LogDestinationType: string | undefined;
  LogExports: string[];
};

type StoredTableRestoreStatus = {
  TableRestoreRequestId: string;
  Status: string;
  RequestTime: string;
  ClusterIdentifier: string;
  SnapshotIdentifier: string;
  SourceDatabaseName: string;
  SourceSchemaName: string | undefined;
  SourceTableName: string;
  TargetDatabaseName: string | undefined;
  TargetSchemaName: string | undefined;
  NewTableName: string;
};

const clusterKey = (id: string): string => `cluster/${id}`;
const subnetGroupKey = (name: string): string => `subnetgroup/${name}`;
const snapshotKey = (id: string): string => `snapshot/${id}`;
const paramGroupKey = (name: string): string => `paramgroup/${name}`;
const secGroupKey = (name: string): string => `secgroup/${name}`;
const loggingKey = (clusterId: string): string => `logging/${clusterId}`;
const tableRestoreKey = (requestId: string): string =>
  `tablerestore/${requestId}`;
const tagsKey = (arn: string): string => `tags/${arn}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidParameterValue", `${key} is required.`, 400);
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = input[key];
  return typeof value === "string" && value !== "" ? value : undefined;
};

const numberOr = (
  input: Record<string, unknown>,
  key: string,
  fallback: number,
): number => {
  const value = input[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const booleanOr = (
  input: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean => {
  const value = input[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true";
  }
  return fallback;
};

const stringList = (input: Record<string, unknown>, key: string): string[] => {
  const value = input[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
};

const tagList = (
  input: Record<string, unknown>,
): { Key: string; Value: string }[] => {
  const tags = input["Tags"];
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags
    .filter(
      (t): t is Record<string, unknown> => t !== null && typeof t === "object",
    )
    .map((t) => ({
      Key: String(t["Key"] ?? ""),
      Value: String(t["Value"] ?? ""),
    }));
};

const requireCluster = (ctx: ServiceContext, id: string): StoredCluster => {
  const cluster = ctx.store.get<StoredCluster>(clusterKey(id));
  if (cluster === undefined) {
    throw awsError("ClusterNotFound", `Cluster ${id} not found.`, 404);
  }
  return cluster;
};

const requireSnapshot = (ctx: ServiceContext, id: string): StoredSnapshot => {
  const snapshot = ctx.store.get<StoredSnapshot>(snapshotKey(id));
  if (snapshot === undefined) {
    throw awsError("ClusterSnapshotNotFound", `Snapshot ${id} not found.`, 404);
  }
  return snapshot;
};

const requireParameterGroup = (
  ctx: ServiceContext,
  name: string,
): StoredParameterGroup => {
  const group = ctx.store.get<StoredParameterGroup>(paramGroupKey(name));
  if (group === undefined) {
    throw awsError(
      "ClusterParameterGroupNotFound",
      `Parameter group ${name} not found.`,
      404,
    );
  }
  return group;
};

const requireSecurityGroup = (
  ctx: ServiceContext,
  name: string,
): StoredSecurityGroup => {
  const group = ctx.store.get<StoredSecurityGroup>(secGroupKey(name));
  if (group === undefined) {
    throw awsError(
      "ClusterSecurityGroupNotFound",
      `Security group ${name} not found.`,
      404,
    );
  }
  return group;
};

const requireSubnetGroup = (
  ctx: ServiceContext,
  name: string,
): StoredClusterSubnetGroup => {
  const group = ctx.store.get<StoredClusterSubnetGroup>(subnetGroupKey(name));
  if (group === undefined) {
    throw awsError(
      "ClusterSubnetGroupNotFound",
      `Subnet group ${name} not found.`,
      404,
    );
  }
  return group;
};

const namespaceArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:redshift:${region}:${account}:namespace:${crypto.randomUUID()}`;

const presentCluster = (cluster: StoredCluster) => ({
  ClusterIdentifier: cluster.ClusterIdentifier,
  NodeType: cluster.NodeType,
  ClusterStatus: cluster.ClusterStatus,
  ClusterAvailabilityStatus: cluster.ClusterAvailabilityStatus,
  MasterUsername: cluster.MasterUsername,
  DBName: cluster.DBName,
  Endpoint: {
    Address: cluster.Endpoint.Address,
    Port: cluster.Endpoint.Port,
  },
  ClusterCreateTime: cluster.ClusterCreateTime,
  AutomatedSnapshotRetentionPeriod: cluster.AutomatedSnapshotRetentionPeriod,
  ManualSnapshotRetentionPeriod: cluster.ManualSnapshotRetentionPeriod,
  ClusterSubnetGroupName: cluster.ClusterSubnetGroupName,
  AvailabilityZone: cluster.AvailabilityZone,
  PreferredMaintenanceWindow: cluster.PreferredMaintenanceWindow,
  ClusterVersion: cluster.ClusterVersion,
  AllowVersionUpgrade: cluster.AllowVersionUpgrade,
  NumberOfNodes: cluster.NumberOfNodes,
  PubliclyAccessible: cluster.PubliclyAccessible,
  Encrypted: cluster.Encrypted,
  ClusterNamespaceArn: cluster.ClusterNamespaceArn,
  IamRoles: cluster.IamRoles,
});

const presentSubnetGroup = (group: StoredClusterSubnetGroup) => ({
  ClusterSubnetGroupName: group.ClusterSubnetGroupName,
  Description: group.Description,
  VpcId: group.VpcId,
  SubnetGroupStatus: group.SubnetGroupStatus,
  Subnets: group.Subnets.map((subnet) => ({
    SubnetIdentifier: subnet.SubnetIdentifier,
    SubnetAvailabilityZone: {
      Name: subnet.SubnetAvailabilityZone.Name,
    },
    SubnetStatus: subnet.SubnetStatus,
  })),
});

const presentSnapshot = (snapshot: StoredSnapshot) => ({
  SnapshotIdentifier: snapshot.SnapshotIdentifier,
  ClusterIdentifier: snapshot.ClusterIdentifier,
  SnapshotCreateTime: snapshot.SnapshotCreateTime,
  Status: snapshot.Status,
  Port: snapshot.Port,
  AvailabilityZone: snapshot.AvailabilityZone,
  ClusterCreateTime: snapshot.ClusterCreateTime,
  MasterUsername: snapshot.MasterUsername,
  ClusterVersion: snapshot.ClusterVersion,
  NodeType: snapshot.NodeType,
  NumberOfNodes: snapshot.NumberOfNodes,
  DBName: snapshot.DBName,
  Encrypted: snapshot.Encrypted,
  ManualSnapshotRetentionPeriod: snapshot.ManualSnapshotRetentionPeriod,
  SnapshotType: snapshot.SnapshotType,
  AccountsWithRestoreAccess: snapshot.AccountsWithRestoreAccess.map((a) => ({
    AccountId: a.AccountId,
  })),
});

const presentParameterGroup = (group: StoredParameterGroup) => ({
  ParameterGroupName: group.ParameterGroupName,
  ParameterGroupFamily: group.ParameterGroupFamily,
  Description: group.Description,
});

const presentSecurityGroup = (group: StoredSecurityGroup) => ({
  ClusterSecurityGroupName: group.ClusterSecurityGroupName,
  Description: group.Description,
  EC2SecurityGroups: group.EC2SecurityGroups.map((sg) => ({
    Status: sg.Status,
    EC2SecurityGroupName: sg.EC2SecurityGroupName,
    EC2SecurityGroupOwnerId: sg.EC2SecurityGroupOwnerId,
  })),
  IPRanges: group.IPRanges.map((r) => ({
    Status: r.Status,
    CIDRIP: r.CIDRIP,
  })),
});

const defaultParameters = (family: string): StoredParameter[] => [
  {
    ParameterName: "enable_user_activity_logging",
    ParameterValue: "false",
    Description: "Enable logging of user activity",
    Source: "engine-default",
    DataType: "boolean",
    IsModifiable: true,
  },
  {
    ParameterName: "max_concurrency_scaling_clusters",
    ParameterValue: "1",
    Description: "Maximum number of concurrency scaling clusters",
    Source: "engine-default",
    DataType: "integer",
    IsModifiable: true,
  },
  {
    ParameterName: "auto_analyze",
    ParameterValue: "true",
    Description: "Enable automatic analyze",
    Source: "engine-default",
    DataType: "boolean",
    IsModifiable: true,
  },
];

const CreateCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const existing = ctx.store.get<StoredCluster>(clusterKey(id));
  if (existing !== undefined) {
    throw awsError(
      "ClusterAlreadyExists",
      `Cluster ${id} already exists.`,
      400,
    );
  }
  const nodeType = requireString(input, "NodeType");
  const masterUsername = requireString(input, "MasterUsername");
  const clusterType = optionalString(input, "ClusterType") ?? "multi-node";
  const numberOfNodes =
    clusterType === "single-node" ? 1 : numberOr(input, "NumberOfNodes", 1);
  const cluster: StoredCluster = {
    ClusterIdentifier: id,
    NodeType: nodeType,
    ClusterStatus: "available",
    ClusterAvailabilityStatus: "Available",
    MasterUsername: masterUsername,
    DBName: optionalString(input, "DBName") ?? "dev",
    Endpoint: {
      Address: `${id}.bunsai.${ctx.region}.redshift.amazonaws.com`,
      Port: numberOr(input, "Port", 5439),
    },
    ClusterCreateTime: new Date().toISOString(),
    AutomatedSnapshotRetentionPeriod: numberOr(
      input,
      "AutomatedSnapshotRetentionPeriod",
      1,
    ),
    ManualSnapshotRetentionPeriod: numberOr(
      input,
      "ManualSnapshotRetentionPeriod",
      -1,
    ),
    ClusterSubnetGroupName: optionalString(input, "ClusterSubnetGroupName"),
    AvailabilityZone:
      optionalString(input, "AvailabilityZone") ?? `${ctx.region}a`,
    PreferredMaintenanceWindow:
      optionalString(input, "PreferredMaintenanceWindow") ??
      "sat:06:00-sat:06:30",
    ClusterVersion: optionalString(input, "ClusterVersion") ?? "1.0",
    AllowVersionUpgrade: booleanOr(input, "AllowVersionUpgrade", true),
    NumberOfNodes: numberOfNodes,
    PubliclyAccessible: booleanOr(input, "PubliclyAccessible", false),
    Encrypted: booleanOr(input, "Encrypted", false),
    ClusterNamespaceArn: namespaceArnOf(ctx.region, ctx.account, id),
    IamRoles: [],
  };
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const DescribeClusters: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "ClusterIdentifier");
  if (id !== undefined) {
    const cluster = requireCluster(ctx, id);
    return { Clusters: [presentCluster(cluster)] };
  }
  const clusters = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => presentCluster(entry.value));
  return { Clusters: clusters };
};

const DeleteCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  const presented = presentCluster(cluster);
  ctx.store.delete(clusterKey(id));
  return { Cluster: { ...presented, ClusterStatus: "deleting" } };
};

const ModifyCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  const newId = optionalString(input, "NewClusterIdentifier");
  cluster.NodeType = optionalString(input, "NodeType") ?? cluster.NodeType;
  cluster.NumberOfNodes = numberOr(
    input,
    "NumberOfNodes",
    cluster.NumberOfNodes,
  );
  cluster.AutomatedSnapshotRetentionPeriod = numberOr(
    input,
    "AutomatedSnapshotRetentionPeriod",
    cluster.AutomatedSnapshotRetentionPeriod,
  );
  cluster.ManualSnapshotRetentionPeriod = numberOr(
    input,
    "ManualSnapshotRetentionPeriod",
    cluster.ManualSnapshotRetentionPeriod,
  );
  cluster.PreferredMaintenanceWindow =
    optionalString(input, "PreferredMaintenanceWindow") ??
    cluster.PreferredMaintenanceWindow;
  cluster.ClusterVersion =
    optionalString(input, "ClusterVersion") ?? cluster.ClusterVersion;
  cluster.AllowVersionUpgrade = booleanOr(
    input,
    "AllowVersionUpgrade",
    cluster.AllowVersionUpgrade,
  );
  cluster.PubliclyAccessible = booleanOr(
    input,
    "PubliclyAccessible",
    cluster.PubliclyAccessible,
  );
  if (newId !== undefined && newId !== id) {
    cluster.ClusterIdentifier = newId;
    ctx.store.delete(clusterKey(id));
    ctx.store.set(clusterKey(newId), cluster);
  } else {
    ctx.store.set(clusterKey(id), cluster);
  }
  return { Cluster: presentCluster(cluster) };
};

const PauseCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  cluster.ClusterStatus = "paused";
  cluster.ClusterAvailabilityStatus = "Unavailable";
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const ResumeCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  cluster.ClusterStatus = "available";
  cluster.ClusterAvailabilityStatus = "Available";
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const RebootCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  cluster.ClusterStatus = "available";
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const RotateEncryptionKey: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  cluster.Encrypted = true;
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const ResizeCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  const nodeType = optionalString(input, "NodeType");
  const numberOfNodes = numberOr(input, "NumberOfNodes", cluster.NumberOfNodes);
  if (nodeType !== undefined) {
    cluster.NodeType = nodeType;
  }
  cluster.NumberOfNodes = numberOfNodes;
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const CancelResize: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, id);
  return {
    TargetNodeType: "dc2.large",
    TargetNumberOfNodes: 2,
    TargetClusterType: "multi-node",
    Status: "CANCELLED",
    ImportTablesCompleted: [],
    ImportTablesInProgress: [],
    ImportTablesNotStarted: [],
    ResizeType: "ClassicResize",
    Message: "Resize cancelled",
  };
};

const DescribeResize: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, id);
  return {
    TargetNodeType: "dc2.large",
    TargetNumberOfNodes: 2,
    TargetClusterType: "multi-node",
    Status: "SUCCEEDED",
    ImportTablesCompleted: [],
    ImportTablesInProgress: [],
    ImportTablesNotStarted: [],
    ResizeType: "ClassicResize",
  };
};

const ModifyAquaConfiguration: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, id);
  const status = optionalString(input, "AquaConfigurationStatus") ?? "disabled";
  return {
    AquaConfiguration: {
      AquaStatus: status === "enabled" ? "enabled" : "disabled",
      AquaConfigurationStatus: status,
    },
  };
};

const ModifyClusterDbRevision: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  return { Cluster: presentCluster(cluster) };
};

const ModifyClusterIamRoles: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  const addRoles = stringList(input, "AddIamRoles");
  const removeRoles = stringList(input, "RemoveIamRoles");
  const defaultRole = optionalString(input, "DefaultIamRoleArn");

  const removedSet = new Set(removeRoles);
  const existing = cluster.IamRoles.filter(
    (r) => !removedSet.has(r.IamRoleArn),
  );
  const added = addRoles.map((arn) => ({
    IamRoleArn: arn,
    ApplyStatus: "adding",
  }));
  cluster.IamRoles = [...existing, ...added];
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const ModifyClusterMaintenance: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  return { Cluster: presentCluster(cluster) };
};

const RestoreFromClusterSnapshot: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const snapshotId = optionalString(input, "SnapshotIdentifier");
  const existing = ctx.store.get<StoredCluster>(clusterKey(id));
  if (existing !== undefined) {
    throw awsError(
      "ClusterAlreadyExists",
      `Cluster ${id} already exists.`,
      400,
    );
  }
  const snapshot =
    snapshotId !== undefined ? requireSnapshot(ctx, snapshotId) : undefined;
  const cluster: StoredCluster = {
    ClusterIdentifier: id,
    NodeType:
      snapshot?.NodeType ?? optionalString(input, "NodeType") ?? "dc2.large",
    ClusterStatus: "available",
    ClusterAvailabilityStatus: "Available",
    MasterUsername: snapshot?.MasterUsername,
    DBName: snapshot?.DBName ?? "dev",
    Endpoint: {
      Address: `${id}.bunsai.${ctx.region}.redshift.amazonaws.com`,
      Port: numberOr(input, "Port", snapshot?.Port ?? 5439),
    },
    ClusterCreateTime: new Date().toISOString(),
    AutomatedSnapshotRetentionPeriod: numberOr(
      input,
      "AutomatedSnapshotRetentionPeriod",
      1,
    ),
    ManualSnapshotRetentionPeriod: numberOr(
      input,
      "ManualSnapshotRetentionPeriod",
      -1,
    ),
    ClusterSubnetGroupName: optionalString(input, "ClusterSubnetGroupName"),
    AvailabilityZone:
      optionalString(input, "AvailabilityZone") ?? `${ctx.region}a`,
    PreferredMaintenanceWindow:
      optionalString(input, "PreferredMaintenanceWindow") ??
      "sat:06:00-sat:06:30",
    ClusterVersion: snapshot?.ClusterVersion ?? "1.0",
    AllowVersionUpgrade: booleanOr(input, "AllowVersionUpgrade", true),
    NumberOfNodes:
      snapshot?.NumberOfNodes ?? numberOr(input, "NumberOfNodes", 1),
    PubliclyAccessible: booleanOr(input, "PubliclyAccessible", false),
    Encrypted: snapshot?.Encrypted ?? booleanOr(input, "Encrypted", false),
    ClusterNamespaceArn: namespaceArnOf(ctx.region, ctx.account, id),
    IamRoles: [],
  };
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const RestoreTableFromClusterSnapshot: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  const snapshotId = requireString(input, "SnapshotIdentifier");
  const sourceDatabase = requireString(input, "SourceDatabaseName");
  const sourceTable = requireString(input, "SourceTableName");
  const newTableName = requireString(input, "NewTableName");
  requireCluster(ctx, clusterId);
  const requestId = crypto.randomUUID();
  const status: StoredTableRestoreStatus = {
    TableRestoreRequestId: requestId,
    Status: "SUCCEEDED",
    RequestTime: new Date().toISOString(),
    ClusterIdentifier: clusterId,
    SnapshotIdentifier: snapshotId,
    SourceDatabaseName: sourceDatabase,
    SourceSchemaName: optionalString(input, "SourceSchemaName"),
    SourceTableName: sourceTable,
    TargetDatabaseName: optionalString(input, "TargetDatabaseName"),
    TargetSchemaName: optionalString(input, "TargetSchemaName"),
    NewTableName: newTableName,
  };
  ctx.store.set(tableRestoreKey(requestId), status);
  return {
    TableRestoreStatus: {
      TableRestoreRequestId: status.TableRestoreRequestId,
      Status: status.Status,
      RequestTime: status.RequestTime,
      ClusterIdentifier: status.ClusterIdentifier,
      SnapshotIdentifier: status.SnapshotIdentifier,
      SourceDatabaseName: status.SourceDatabaseName,
      SourceSchemaName: status.SourceSchemaName,
      SourceTableName: status.SourceTableName,
      TargetDatabaseName: status.TargetDatabaseName,
      TargetSchemaName: status.TargetSchemaName,
      NewTableName: status.NewTableName,
    },
  };
};

const CreateClusterSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSubnetGroupName");
  const existing = ctx.store.get<StoredClusterSubnetGroup>(
    subnetGroupKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ClusterSubnetGroupAlreadyExists",
      `ClusterSubnetGroup ${name} already exists.`,
      400,
    );
  }
  const description = requireString(input, "Description");
  const subnetIds = Array.isArray(input["SubnetIds"])
    ? (input["SubnetIds"] as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const group: StoredClusterSubnetGroup = {
    ClusterSubnetGroupName: name,
    Description: description,
    VpcId: optionalString(input, "VpcId") ?? "vpc-bunsai00000000000",
    SubnetGroupStatus: "Complete",
    Subnets: subnetIds.map((subnetId) => ({
      SubnetIdentifier: subnetId,
      SubnetAvailabilityZone: {
        Name: `${ctx.region}a`,
      },
      SubnetStatus: "Active",
    })),
  };
  ctx.store.set(subnetGroupKey(name), group);
  return { ClusterSubnetGroup: presentSubnetGroup(group) };
};

const DeleteClusterSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSubnetGroupName");
  requireSubnetGroup(ctx, name);
  ctx.store.delete(subnetGroupKey(name));
  return {};
};

const DescribeClusterSubnetGroups: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "ClusterSubnetGroupName");
  if (name !== undefined) {
    const group = requireSubnetGroup(ctx, name);
    return { ClusterSubnetGroups: [presentSubnetGroup(group)] };
  }
  const groups = ctx.store
    .list<StoredClusterSubnetGroup>()
    .filter((entry) => entry.key.startsWith("subnetgroup/"))
    .map((entry) => presentSubnetGroup(entry.value));
  return { ClusterSubnetGroups: groups };
};

const ModifyClusterSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSubnetGroupName");
  const group = requireSubnetGroup(ctx, name);
  group.Description = optionalString(input, "Description") ?? group.Description;
  const subnetIds = Array.isArray(input["SubnetIds"])
    ? (input["SubnetIds"] as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  if (subnetIds.length > 0) {
    group.Subnets = subnetIds.map((subnetId) => ({
      SubnetIdentifier: subnetId,
      SubnetAvailabilityZone: { Name: `${ctx.region}a` },
      SubnetStatus: "Active",
    }));
  }
  ctx.store.set(subnetGroupKey(name), group);
  return { ClusterSubnetGroup: presentSubnetGroup(group) };
};

const CreateClusterSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "SnapshotIdentifier");
  const clusterId = requireString(input, "ClusterIdentifier");
  const existing = ctx.store.get<StoredSnapshot>(snapshotKey(snapshotId));
  if (existing !== undefined) {
    throw awsError(
      "ClusterSnapshotAlreadyExists",
      `Snapshot ${snapshotId} already exists.`,
      400,
    );
  }
  const cluster = requireCluster(ctx, clusterId);
  const snapshot: StoredSnapshot = {
    SnapshotIdentifier: snapshotId,
    ClusterIdentifier: clusterId,
    SnapshotCreateTime: new Date().toISOString(),
    Status: "available",
    Port: cluster.Endpoint.Port,
    AvailabilityZone: cluster.AvailabilityZone,
    ClusterCreateTime: cluster.ClusterCreateTime,
    MasterUsername: cluster.MasterUsername,
    ClusterVersion: cluster.ClusterVersion,
    NodeType: cluster.NodeType,
    NumberOfNodes: cluster.NumberOfNodes,
    DBName: cluster.DBName,
    Encrypted: cluster.Encrypted,
    ManualSnapshotRetentionPeriod: numberOr(
      input,
      "ManualSnapshotRetentionPeriod",
      cluster.ManualSnapshotRetentionPeriod,
    ),
    SnapshotType: "manual",
    AccountsWithRestoreAccess: [],
  };
  ctx.store.set(snapshotKey(snapshotId), snapshot);
  return { Snapshot: presentSnapshot(snapshot) };
};

const DeleteClusterSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "SnapshotIdentifier");
  const snapshot = requireSnapshot(ctx, snapshotId);
  ctx.store.delete(snapshotKey(snapshotId));
  return { Snapshot: { ...presentSnapshot(snapshot), Status: "deleted" } };
};

const DescribeClusterSnapshots: OperationHandler = (input, ctx) => {
  const snapshotId = optionalString(input, "SnapshotIdentifier");
  if (snapshotId !== undefined) {
    const snapshot = requireSnapshot(ctx, snapshotId);
    return { Snapshots: [presentSnapshot(snapshot)] };
  }
  const clusterId = optionalString(input, "ClusterIdentifier");
  const snapshots = ctx.store
    .list<StoredSnapshot>()
    .filter((entry) => entry.key.startsWith("snapshot/"))
    .filter(
      (entry) =>
        clusterId === undefined || entry.value.ClusterIdentifier === clusterId,
    )
    .map((entry) => presentSnapshot(entry.value));
  return { Snapshots: snapshots };
};

const CopyClusterSnapshot: OperationHandler = (input, ctx) => {
  const sourceId = requireString(input, "SourceSnapshotIdentifier");
  const targetId = requireString(input, "TargetSnapshotIdentifier");
  const existing = ctx.store.get<StoredSnapshot>(snapshotKey(targetId));
  if (existing !== undefined) {
    throw awsError(
      "ClusterSnapshotAlreadyExists",
      `Snapshot ${targetId} already exists.`,
      400,
    );
  }
  const source = requireSnapshot(ctx, sourceId);
  const copy: StoredSnapshot = {
    ...source,
    SnapshotIdentifier: targetId,
    SnapshotCreateTime: new Date().toISOString(),
    ManualSnapshotRetentionPeriod: numberOr(
      input,
      "ManualSnapshotRetentionPeriod",
      source.ManualSnapshotRetentionPeriod,
    ),
    AccountsWithRestoreAccess: [],
  };
  ctx.store.set(snapshotKey(targetId), copy);
  return { Snapshot: presentSnapshot(copy) };
};

const AuthorizeSnapshotAccess: OperationHandler = (input, ctx) => {
  const snapshotId = optionalString(input, "SnapshotIdentifier");
  const accountId = requireString(input, "AccountWithRestoreAccess");
  if (snapshotId === undefined) {
    throw awsError(
      "InvalidParameterValue",
      "SnapshotIdentifier is required.",
      400,
    );
  }
  const snapshot = requireSnapshot(ctx, snapshotId);
  if (
    !snapshot.AccountsWithRestoreAccess.some((a) => a.AccountId === accountId)
  ) {
    snapshot.AccountsWithRestoreAccess.push({ AccountId: accountId });
  }
  ctx.store.set(snapshotKey(snapshotId), snapshot);
  return { Snapshot: presentSnapshot(snapshot) };
};

const RevokeSnapshotAccess: OperationHandler = (input, ctx) => {
  const snapshotId = optionalString(input, "SnapshotIdentifier");
  const accountId = requireString(input, "AccountWithRestoreAccess");
  if (snapshotId === undefined) {
    throw awsError(
      "InvalidParameterValue",
      "SnapshotIdentifier is required.",
      400,
    );
  }
  const snapshot = requireSnapshot(ctx, snapshotId);
  snapshot.AccountsWithRestoreAccess =
    snapshot.AccountsWithRestoreAccess.filter((a) => a.AccountId !== accountId);
  ctx.store.set(snapshotKey(snapshotId), snapshot);
  return { Snapshot: presentSnapshot(snapshot) };
};

const BatchDeleteClusterSnapshots: OperationHandler = (input, ctx) => {
  const identifiers = Array.isArray(input["Identifiers"])
    ? (input["Identifiers"] as unknown[]).filter(
        (i): i is Record<string, unknown> =>
          i !== null && typeof i === "object",
      )
    : [];
  const deleted: string[] = [];
  const errors: {
    SnapshotIdentifier: string;
    SnapshotClusterIdentifier: string;
    FailureCode: string;
    FailureReason: string;
  }[] = [];
  for (const entry of identifiers) {
    const id =
      typeof entry["SnapshotIdentifier"] === "string"
        ? entry["SnapshotIdentifier"]
        : "";
    if (id === "") continue;
    const snapshot = ctx.store.get<StoredSnapshot>(snapshotKey(id));
    if (snapshot === undefined) {
      errors.push({
        SnapshotIdentifier: id,
        SnapshotClusterIdentifier: "",
        FailureCode: "ClusterSnapshotNotFound",
        FailureReason: `Snapshot ${id} not found.`,
      });
    } else {
      ctx.store.delete(snapshotKey(id));
      deleted.push(id);
    }
  }
  return { Resources: deleted, Errors: errors };
};

const BatchModifyClusterSnapshots: OperationHandler = (input, ctx) => {
  const ids = stringList(input, "SnapshotIdentifierList");
  const retentionPeriod = numberOr(input, "ManualSnapshotRetentionPeriod", -2);
  const modified: string[] = [];
  const errors: {
    SnapshotIdentifier: string;
    SnapshotClusterIdentifier: string;
    FailureCode: string;
    FailureReason: string;
  }[] = [];
  for (const id of ids) {
    const snapshot = ctx.store.get<StoredSnapshot>(snapshotKey(id));
    if (snapshot === undefined) {
      errors.push({
        SnapshotIdentifier: id,
        SnapshotClusterIdentifier: "",
        FailureCode: "ClusterSnapshotNotFound",
        FailureReason: `Snapshot ${id} not found.`,
      });
    } else {
      if (retentionPeriod !== -2) {
        snapshot.ManualSnapshotRetentionPeriod = retentionPeriod;
        ctx.store.set(snapshotKey(id), snapshot);
      }
      modified.push(id);
    }
  }
  return { Resources: modified, Errors: errors };
};

const ModifyClusterSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "SnapshotIdentifier");
  const snapshot = requireSnapshot(ctx, snapshotId);
  const retention = numberOr(input, "ManualSnapshotRetentionPeriod", -2);
  if (retention !== -2) {
    snapshot.ManualSnapshotRetentionPeriod = retention;
  }
  ctx.store.set(snapshotKey(snapshotId), snapshot);
  return { Snapshot: presentSnapshot(snapshot) };
};

const CreateClusterParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  const existing = ctx.store.get<StoredParameterGroup>(paramGroupKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ClusterParameterGroupAlreadyExists",
      `Parameter group ${name} already exists.`,
      400,
    );
  }
  const family = requireString(input, "ParameterGroupFamily");
  const description = requireString(input, "Description");
  const group: StoredParameterGroup = {
    ParameterGroupName: name,
    ParameterGroupFamily: family,
    Description: description,
    Parameters: defaultParameters(family),
  };
  ctx.store.set(paramGroupKey(name), group);
  return { ClusterParameterGroup: presentParameterGroup(group) };
};

const DeleteClusterParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  requireParameterGroup(ctx, name);
  ctx.store.delete(paramGroupKey(name));
  return {};
};

const DescribeClusterParameterGroups: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "ParameterGroupName");
  if (name !== undefined) {
    const group = requireParameterGroup(ctx, name);
    return { ParameterGroups: [presentParameterGroup(group)] };
  }
  const groups = ctx.store
    .list<StoredParameterGroup>()
    .filter((entry) => entry.key.startsWith("paramgroup/"))
    .map((entry) => presentParameterGroup(entry.value));
  return { ParameterGroups: groups };
};

const DescribeClusterParameters: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  const group = requireParameterGroup(ctx, name);
  return {
    Parameters: group.Parameters.map((p) => ({
      ParameterName: p.ParameterName,
      ParameterValue: p.ParameterValue,
      Description: p.Description,
      Source: p.Source,
      DataType: p.DataType,
      IsModifiable: p.IsModifiable,
    })),
  };
};

const ModifyClusterParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  const group = requireParameterGroup(ctx, name);
  const params = Array.isArray(input["Parameters"])
    ? (input["Parameters"] as unknown[]).filter(
        (p): p is Record<string, unknown> =>
          p !== null && typeof p === "object",
      )
    : [];
  for (const param of params) {
    const paramName = String(param["ParameterName"] ?? "");
    const paramValue = String(param["ParameterValue"] ?? "");
    const existing = group.Parameters.find(
      (p) => p.ParameterName === paramName,
    );
    if (existing !== undefined) {
      existing.ParameterValue = paramValue;
      existing.Source = "user";
    } else {
      group.Parameters.push({
        ParameterName: paramName,
        ParameterValue: paramValue,
        Description: "",
        Source: "user",
        DataType: "string",
        IsModifiable: true,
      });
    }
  }
  ctx.store.set(paramGroupKey(name), group);
  return { ParameterGroupName: name, ParameterGroupStatus: "pending-reboot" };
};

const ResetClusterParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  const group = requireParameterGroup(ctx, name);
  const resetAll = booleanOr(input, "ResetAllParameters", false);
  if (resetAll) {
    group.Parameters = defaultParameters(group.ParameterGroupFamily);
  } else {
    const params = Array.isArray(input["Parameters"])
      ? (input["Parameters"] as unknown[]).filter(
          (p): p is Record<string, unknown> =>
            p !== null && typeof p === "object",
        )
      : [];
    for (const param of params) {
      const paramName = String(param["ParameterName"] ?? "");
      const existing = group.Parameters.find(
        (p) => p.ParameterName === paramName,
      );
      if (existing !== undefined) {
        existing.Source = "engine-default";
      }
    }
  }
  ctx.store.set(paramGroupKey(name), group);
  return { ParameterGroupName: name, ParameterGroupStatus: "pending-reboot" };
};

const DescribeDefaultClusterParameters: OperationHandler = (input, ctx) => {
  const family = requireString(input, "ParameterGroupFamily");
  return {
    DefaultClusterParameters: {
      ParameterGroupFamily: family,
      Marker: undefined,
      Parameters: defaultParameters(family).map((p) => ({
        ParameterName: p.ParameterName,
        ParameterValue: p.ParameterValue,
        Description: p.Description,
        Source: p.Source,
        DataType: p.DataType,
        IsModifiable: p.IsModifiable,
      })),
    },
  };
};

const CreateClusterSecurityGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSecurityGroupName");
  const existing = ctx.store.get<StoredSecurityGroup>(secGroupKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ClusterSecurityGroupAlreadyExists",
      `Security group ${name} already exists.`,
      400,
    );
  }
  const description = requireString(input, "Description");
  const group: StoredSecurityGroup = {
    ClusterSecurityGroupName: name,
    Description: description,
    EC2SecurityGroups: [],
    IPRanges: [],
  };
  ctx.store.set(secGroupKey(name), group);
  return { ClusterSecurityGroup: presentSecurityGroup(group) };
};

const DeleteClusterSecurityGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSecurityGroupName");
  requireSecurityGroup(ctx, name);
  ctx.store.delete(secGroupKey(name));
  return {};
};

const DescribeClusterSecurityGroups: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "ClusterSecurityGroupName");
  if (name !== undefined) {
    const group = requireSecurityGroup(ctx, name);
    return { ClusterSecurityGroups: [presentSecurityGroup(group)] };
  }
  const groups = ctx.store
    .list<StoredSecurityGroup>()
    .filter((entry) => entry.key.startsWith("secgroup/"))
    .map((entry) => presentSecurityGroup(entry.value));
  return { ClusterSecurityGroups: groups };
};

const AuthorizeClusterSecurityGroupIngress: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSecurityGroupName");
  const group = requireSecurityGroup(ctx, name);
  const cidr = optionalString(input, "CIDRIP");
  const ec2Name = optionalString(input, "EC2SecurityGroupName");
  const ec2Owner = optionalString(input, "EC2SecurityGroupOwnerId");
  if (cidr !== undefined) {
    if (!group.IPRanges.some((r) => r.CIDRIP === cidr)) {
      group.IPRanges.push({ Status: "authorized", CIDRIP: cidr });
    }
  }
  if (ec2Name !== undefined) {
    if (
      !group.EC2SecurityGroups.some((sg) => sg.EC2SecurityGroupName === ec2Name)
    ) {
      group.EC2SecurityGroups.push({
        Status: "authorized",
        EC2SecurityGroupName: ec2Name,
        EC2SecurityGroupOwnerId: ec2Owner ?? ctx.account,
      });
    }
  }
  ctx.store.set(secGroupKey(name), group);
  return { ClusterSecurityGroup: presentSecurityGroup(group) };
};

const RevokeClusterSecurityGroupIngress: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSecurityGroupName");
  const group = requireSecurityGroup(ctx, name);
  const cidr = optionalString(input, "CIDRIP");
  const ec2Name = optionalString(input, "EC2SecurityGroupName");
  if (cidr !== undefined) {
    group.IPRanges = group.IPRanges.filter((r) => r.CIDRIP !== cidr);
  }
  if (ec2Name !== undefined) {
    group.EC2SecurityGroups = group.EC2SecurityGroups.filter(
      (sg) => sg.EC2SecurityGroupName !== ec2Name,
    );
  }
  ctx.store.set(secGroupKey(name), group);
  return { ClusterSecurityGroup: presentSecurityGroup(group) };
};

const CreateTags: OperationHandler = (input, ctx) => {
  const resourceName = requireString(input, "ResourceName");
  const newTags = tagList(input);
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(resourceName)) ??
    [];
  const keySet = new Map(newTags.map((t) => [t.Key, t.Value]));
  const merged = [...existing.filter((t) => !keySet.has(t.Key)), ...newTags];
  ctx.store.set(tagsKey(resourceName), merged);
  return {};
};

const DeleteTags: OperationHandler = (input, ctx) => {
  const resourceName = requireString(input, "ResourceName");
  const keys = stringList(input, "TagKeys");
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(resourceName)) ??
    [];
  const updated = existing.filter((t) => !keys.includes(t.Key));
  ctx.store.set(tagsKey(resourceName), updated);
  return {};
};

const DescribeTags: OperationHandler = (input, ctx) => {
  const resourceName = optionalString(input, "ResourceName");
  const resourceType = optionalString(input, "ResourceType");

  if (resourceName !== undefined) {
    const tags =
      ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(resourceName)) ??
      [];
    return {
      TaggedResources: tags.map((t) => ({
        Tag: { Key: t.Key, Value: t.Value },
        ResourceName: resourceName,
        ResourceType: resourceType ?? "cluster",
      })),
    };
  }

  const entries = ctx.store
    .list<{ Key: string; Value: string }[]>()
    .filter((entry) => entry.key.startsWith("tags/"));
  const taggedResources = entries.flatMap((entry) =>
    entry.value.map((t) => ({
      Tag: { Key: t.Key, Value: t.Value },
      ResourceName: entry.key.replace(/^tags\//, ""),
      ResourceType: "cluster",
    })),
  );
  return { TaggedResources: taggedResources };
};

const EnableLogging: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const bucket = optionalString(input, "BucketName");
  const prefix = optionalString(input, "S3KeyPrefix");
  const logDestType = optionalString(input, "LogDestinationType") ?? "s3";
  const logExports = stringList(input, "LogExports");
  const status: StoredLoggingStatus = {
    LoggingEnabled: true,
    BucketName: bucket,
    S3KeyPrefix: prefix,
    LogDestinationType: logDestType,
    LogExports: logExports,
  };
  ctx.store.set(loggingKey(clusterId), status);
  return {
    LoggingEnabled: status.LoggingEnabled,
    BucketName: status.BucketName,
    S3KeyPrefix: status.S3KeyPrefix,
    LogDestinationType: status.LogDestinationType,
    LogExports: status.LogExports,
  };
};

const DisableLogging: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const status: StoredLoggingStatus = {
    LoggingEnabled: false,
    BucketName: undefined,
    S3KeyPrefix: undefined,
    LogDestinationType: undefined,
    LogExports: [],
  };
  ctx.store.set(loggingKey(clusterId), status);
  return {
    LoggingEnabled: false,
    BucketName: undefined,
    S3KeyPrefix: undefined,
    LogDestinationType: undefined,
    LogExports: [],
  };
};

const DescribeLoggingStatus: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const status = ctx.store.get<StoredLoggingStatus>(loggingKey(clusterId)) ?? {
    LoggingEnabled: false,
    BucketName: undefined,
    S3KeyPrefix: undefined,
    LogDestinationType: undefined,
    LogExports: [],
  };
  return {
    LoggingEnabled: status.LoggingEnabled,
    BucketName: status.BucketName,
    S3KeyPrefix: status.S3KeyPrefix,
    LogDestinationType: status.LogDestinationType,
    LogExports: status.LogExports,
  };
};

const GetClusterCredentials: OperationHandler = (input, ctx) => {
  const dbUser = requireString(input, "DbUser");
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const expiration = new Date(Date.now() + 900000).toISOString();
  return {
    DbUser: dbUser,
    DbPassword: `BunsaiTmpPw-${clusterId}`,
    Expiration: expiration,
  };
};

const GetClusterCredentialsWithIAM: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const dbName = optionalString(input, "DbName") ?? "dev";
  const expiration = new Date(Date.now() + 900000).toISOString();
  const nextRefresh = new Date(Date.now() + 600000).toISOString();
  return {
    DbUser: `IAM:bunsai-user`,
    DbPassword: `BunsaiIamPw-${clusterId}`,
    Expiration: expiration,
    NextRefreshTime: nextRefresh,
  };
};

const DescribeAccountAttributes: OperationHandler = (_input, _ctx) => {
  return {
    AccountAttributes: [
      {
        AttributeName: "max-clusters",
        AttributeValues: [{ AttributeValue: "100" }],
      },
      {
        AttributeName: "max-reserved-nodes",
        AttributeValues: [{ AttributeValue: "20" }],
      },
    ],
  };
};

const DescribeClusterDbRevisions: OperationHandler = (input, ctx) => {
  const clusterId = optionalString(input, "ClusterIdentifier");
  if (clusterId !== undefined) {
    requireCluster(ctx, clusterId);
    return {
      ClusterDbRevisions: [
        {
          ClusterIdentifier: clusterId,
          CurrentDatabaseRevision: "18041",
          DatabaseRevisionReleaseDate: "2023-01-01T00:00:00Z",
          RevisionTargets: [],
        },
      ],
    };
  }
  return { ClusterDbRevisions: [] };
};

const DescribeClusterTracks: OperationHandler = (_input, _ctx) => {
  return {
    MaintenanceTracks: [
      {
        MaintenanceTrackName: "current",
        DatabaseVersion: "1.0.18041",
        UpdateTargets: [],
      },
      {
        MaintenanceTrackName: "trailing",
        DatabaseVersion: "1.0.17991",
        UpdateTargets: [],
      },
    ],
  };
};

const DescribeClusterVersions: OperationHandler = (_input, _ctx) => {
  return {
    ClusterVersions: [
      {
        ClusterVersion: "1.0",
        ClusterParameterGroupFamily: "redshift-1.0",
        Description: "Amazon Redshift 1.0",
      },
    ],
  };
};

const DescribeEventCategories: OperationHandler = (_input, _ctx) => {
  return {
    EventCategoriesMapList: [
      {
        SourceType: "cluster",
        Events: [
          {
            EventId: "REDSHIFT-EVENT-1000",
            EventCategories: ["availability"],
            EventDescription: "Cluster was available",
            Severity: "INFO",
          },
        ],
      },
    ],
  };
};

const DescribeEvents: OperationHandler = (_input, _ctx) => {
  return { Events: [], Marker: undefined };
};

const DescribeNodeConfigurationOptions: OperationHandler = (_input, _ctx) => {
  return {
    NodeConfigurationOptionList: [
      {
        NodeType: "dc2.large",
        NumberOfNodes: 2,
        EstimatedDiskUtilizationPercent: 0.5,
        Mode: "standard",
      },
      {
        NodeType: "ra3.xlplus",
        NumberOfNodes: 2,
        EstimatedDiskUtilizationPercent: 0.5,
        Mode: "standard",
      },
    ],
  };
};

const DescribeOrderableClusterOptions: OperationHandler = (_input, _ctx) => {
  return {
    OrderableClusterOptions: [
      {
        ClusterVersion: "1.0",
        ClusterType: "single-node",
        NodeType: "dc2.large",
        AvailabilityZones: [{ Name: "us-east-1a" }, { Name: "us-east-1b" }],
      },
      {
        ClusterVersion: "1.0",
        ClusterType: "multi-node",
        NodeType: "ra3.xlplus",
        AvailabilityZones: [{ Name: "us-east-1a" }, { Name: "us-east-1b" }],
      },
    ],
  };
};

const DescribeStorage: OperationHandler = (_input, _ctx) => {
  return {
    TotalBackupSizeInMegaBytes: 0,
    TotalProvisionedStorageInMegaBytes: 0,
  };
};

const DescribeTableRestoreStatus: OperationHandler = (input, ctx) => {
  const clusterId = optionalString(input, "ClusterIdentifier");
  const requestId = optionalString(input, "TableRestoreRequestId");
  if (requestId !== undefined) {
    const status = ctx.store.get<StoredTableRestoreStatus>(
      tableRestoreKey(requestId),
    );
    if (status === undefined) {
      throw awsError(
        "TableRestoreNotFoundFault",
        `Table restore request ${requestId} not found.`,
        404,
      );
    }
    return {
      TableRestoreStatusDetails: [
        {
          TableRestoreRequestId: status.TableRestoreRequestId,
          Status: status.Status,
          RequestTime: status.RequestTime,
          ClusterIdentifier: status.ClusterIdentifier,
          SnapshotIdentifier: status.SnapshotIdentifier,
          SourceDatabaseName: status.SourceDatabaseName,
          SourceSchemaName: status.SourceSchemaName,
          SourceTableName: status.SourceTableName,
          TargetDatabaseName: status.TargetDatabaseName,
          TargetSchemaName: status.TargetSchemaName,
          NewTableName: status.NewTableName,
        },
      ],
    };
  }
  const allStatuses = ctx.store
    .list<StoredTableRestoreStatus>()
    .filter((entry) => entry.key.startsWith("tablerestore/"))
    .filter(
      (entry) =>
        clusterId === undefined || entry.value.ClusterIdentifier === clusterId,
    )
    .map((entry) => ({
      TableRestoreRequestId: entry.value.TableRestoreRequestId,
      Status: entry.value.Status,
      RequestTime: entry.value.RequestTime,
      ClusterIdentifier: entry.value.ClusterIdentifier,
      SnapshotIdentifier: entry.value.SnapshotIdentifier,
      SourceDatabaseName: entry.value.SourceDatabaseName,
      SourceSchemaName: entry.value.SourceSchemaName,
      SourceTableName: entry.value.SourceTableName,
      TargetDatabaseName: entry.value.TargetDatabaseName,
      TargetSchemaName: entry.value.TargetSchemaName,
      NewTableName: entry.value.NewTableName,
    }));
  return { TableRestoreStatusDetails: allStatuses };
};

const redshift: ServiceDefinition = {
  name: "redshift",
  protocol: "query",
  operations: {
    AuthorizeClusterSecurityGroupIngress,
    AuthorizeSnapshotAccess,
    BatchDeleteClusterSnapshots,
    BatchModifyClusterSnapshots,
    CancelResize,
    CopyClusterSnapshot,
    CreateCluster,
    CreateClusterParameterGroup,
    CreateClusterSecurityGroup,
    CreateClusterSnapshot,
    CreateClusterSubnetGroup,
    CreateTags,
    DeleteClusterParameterGroup,
    DeleteClusterSecurityGroup,
    DeleteClusterSnapshot,
    DeleteClusterSubnetGroup,
    DeleteTags,
    DescribeAccountAttributes,
    DescribeClusterDbRevisions,
    DescribeClusterParameterGroups,
    DescribeClusterParameters,
    DescribeClusterSecurityGroups,
    DescribeClusterSnapshots,
    DescribeClusterSubnetGroups,
    DescribeClusterTracks,
    DescribeClusterVersions,
    DescribeClusters,
    DescribeDefaultClusterParameters,
    DescribeEventCategories,
    DescribeEvents,
    DescribeLoggingStatus,
    DescribeNodeConfigurationOptions,
    DescribeOrderableClusterOptions,
    DescribeResize,
    DescribeStorage,
    DescribeTableRestoreStatus,
    DescribeTags,
    DisableLogging,
    DeleteCluster,
    EnableLogging,
    GetClusterCredentials,
    GetClusterCredentialsWithIAM,
    ModifyAquaConfiguration,
    ModifyCluster,
    ModifyClusterDbRevision,
    ModifyClusterIamRoles,
    ModifyClusterMaintenance,
    ModifyClusterParameterGroup,
    ModifyClusterSnapshot,
    ModifyClusterSubnetGroup,
    PauseCluster,
    RebootCluster,
    ResetClusterParameterGroup,
    ResizeCluster,
    RestoreFromClusterSnapshot,
    RestoreTableFromClusterSnapshot,
    ResumeCluster,
    RevokeClusterSecurityGroupIngress,
    RevokeSnapshotAccess,
    RotateEncryptionKey,
  },
  model,
} as const;

export default redshift;
