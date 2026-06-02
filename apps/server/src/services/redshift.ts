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

const clusterKey = (id: string): string => `cluster/${id}`;

const subnetGroupKey = (name: string): string => `subnetgroup/${name}`;

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

const requireCluster = (ctx: ServiceContext, id: string): StoredCluster => {
  const cluster = ctx.store.get<StoredCluster>(clusterKey(id));
  if (cluster === undefined) {
    throw awsError("ClusterNotFound", `Cluster ${id} not found.`, 404);
  }
  return cluster;
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

const redshift: ServiceDefinition = {
  name: "redshift",
  protocol: "query",
  operations: {
    CreateCluster,
    DescribeClusters,
    DeleteCluster,
    ModifyCluster,
    CreateClusterSubnetGroup,
  },
  model,
} as const;

export default redshift;
