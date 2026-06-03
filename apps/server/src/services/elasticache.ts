import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import elasticacheModel from "../../../../test/vendor/aws-models/elasticache.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(elasticacheModel);

type StoredCacheNode = {
  CacheNodeId: string;
  CacheNodeStatus: string;
  CacheNodeCreateTime: string;
  Endpoint: { Address: string; Port: number };
  CustomerAvailabilityZone: string;
};

type StoredCacheCluster = {
  CacheClusterId: string;
  CacheNodeType: string;
  Engine: string;
  EngineVersion: string | undefined;
  CacheClusterStatus: string;
  NumCacheNodes: number;
  PreferredAvailabilityZone: string;
  CacheClusterCreateTime: string;
  ReplicationGroupId: string | undefined;
  ConfigurationEndpoint: { Address: string; Port: number };
  CacheNodes: StoredCacheNode[];
  ARN: string;
};

type StoredReplicationGroup = {
  ReplicationGroupId: string;
  Description: string;
  Status: string;
  MemberClusters: string[];
  AutomaticFailover: string;
  MultiAZ: string;
  CacheNodeType: string | undefined;
  ClusterEnabled: boolean;
  Engine: string;
  ReplicationGroupCreateTime: string;
  ConfigurationEndpoint: { Address: string; Port: number };
  ARN: string;
};

type StoredCacheParameterGroup = {
  CacheParameterGroupName: string;
  CacheParameterGroupFamily: string;
  Description: string;
  IsGlobal: boolean;
  ARN: string;
};

type StoredCacheSubnet = {
  SubnetIdentifier: string;
  SubnetAvailabilityZone: { Name: string };
};

type StoredCacheSubnetGroup = {
  CacheSubnetGroupName: string;
  CacheSubnetGroupDescription: string;
  VpcId: string;
  Subnets: StoredCacheSubnet[];
  ARN: string;
};

const clusterKey = (id: string): string => `cluster/${id}`;

const groupKey = (id: string): string => `group/${id}`;

const paramGroupKey = (name: string): string => `paramgroup/${name}`;

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

const clusterArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:elasticache:${region}:${account}:cluster:${id}`;

const groupArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:elasticache:${region}:${account}:replicationgroup:${id}`;

const paramGroupArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:elasticache:${region}:${account}:parametergroup:${name}`;

const subnetGroupArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:elasticache:${region}:${account}:subnetgroup:${name}`;

const stringList = (input: Record<string, unknown>, key: string): string[] => {
  const value = input[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
};

const requireCluster = (
  ctx: ServiceContext,
  id: string,
): StoredCacheCluster => {
  const cluster = ctx.store.get<StoredCacheCluster>(clusterKey(id));
  if (cluster === undefined) {
    throw awsError(
      "CacheClusterNotFound",
      `CacheCluster ${id} not found.`,
      404,
    );
  }
  return cluster;
};

const presentCluster = (cluster: StoredCacheCluster) => ({
  CacheClusterId: cluster.CacheClusterId,
  CacheNodeType: cluster.CacheNodeType,
  Engine: cluster.Engine,
  EngineVersion: cluster.EngineVersion,
  CacheClusterStatus: cluster.CacheClusterStatus,
  NumCacheNodes: cluster.NumCacheNodes,
  PreferredAvailabilityZone: cluster.PreferredAvailabilityZone,
  CacheClusterCreateTime: cluster.CacheClusterCreateTime,
  ReplicationGroupId: cluster.ReplicationGroupId,
  ConfigurationEndpoint: {
    Address: cluster.ConfigurationEndpoint.Address,
    Port: cluster.ConfigurationEndpoint.Port,
  },
  CacheNodes: cluster.CacheNodes.map((node) => ({
    CacheNodeId: node.CacheNodeId,
    CacheNodeStatus: node.CacheNodeStatus,
    CacheNodeCreateTime: node.CacheNodeCreateTime,
    Endpoint: { Address: node.Endpoint.Address, Port: node.Endpoint.Port },
    CustomerAvailabilityZone: node.CustomerAvailabilityZone,
  })),
  ARN: cluster.ARN,
});

const presentGroup = (group: StoredReplicationGroup) => ({
  ReplicationGroupId: group.ReplicationGroupId,
  Description: group.Description,
  Status: group.Status,
  MemberClusters: group.MemberClusters,
  AutomaticFailover: group.AutomaticFailover,
  MultiAZ: group.MultiAZ,
  CacheNodeType: group.CacheNodeType,
  ClusterEnabled: group.ClusterEnabled,
  Engine: group.Engine,
  ReplicationGroupCreateTime: group.ReplicationGroupCreateTime,
  ConfigurationEndpoint: {
    Address: group.ConfigurationEndpoint.Address,
    Port: group.ConfigurationEndpoint.Port,
  },
  ARN: group.ARN,
});

const presentParamGroup = (paramGroup: StoredCacheParameterGroup) => ({
  CacheParameterGroupName: paramGroup.CacheParameterGroupName,
  CacheParameterGroupFamily: paramGroup.CacheParameterGroupFamily,
  Description: paramGroup.Description,
  IsGlobal: paramGroup.IsGlobal,
  ARN: paramGroup.ARN,
});

const presentSubnetGroup = (subnetGroup: StoredCacheSubnetGroup) => ({
  CacheSubnetGroupName: subnetGroup.CacheSubnetGroupName,
  CacheSubnetGroupDescription: subnetGroup.CacheSubnetGroupDescription,
  VpcId: subnetGroup.VpcId,
  Subnets: subnetGroup.Subnets.map((subnet) => ({
    SubnetIdentifier: subnet.SubnetIdentifier,
    SubnetAvailabilityZone: { Name: subnet.SubnetAvailabilityZone.Name },
  })),
  ARN: subnetGroup.ARN,
});

const CreateCacheCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "CacheClusterId");
  const existing = ctx.store.get<StoredCacheCluster>(clusterKey(id));
  if (existing !== undefined) {
    throw awsError(
      "CacheClusterAlreadyExists",
      `CacheCluster ${id} already exists.`,
      400,
    );
  }
  const port = numberOr(input, "Port", 6379);
  const numNodes = numberOr(input, "NumCacheNodes", 1);
  const availabilityZone =
    optionalString(input, "PreferredAvailabilityZone") ?? `${ctx.region}a`;
  const address = `${id}.bunsai.${ctx.region}.cache.amazonaws.com`;
  const cacheNodes: StoredCacheNode[] = [];
  for (let i = 0; i < numNodes; i += 1) {
    const nodeId = String(i + 1).padStart(4, "0");
    cacheNodes.push({
      CacheNodeId: nodeId,
      CacheNodeStatus: "available",
      CacheNodeCreateTime: new Date().toISOString(),
      Endpoint: {
        Address: `${id}-${nodeId}.bunsai.${ctx.region}.cache.amazonaws.com`,
        Port: port,
      },
      CustomerAvailabilityZone: availabilityZone,
    });
  }
  const cluster: StoredCacheCluster = {
    CacheClusterId: id,
    CacheNodeType: optionalString(input, "CacheNodeType") ?? "cache.t3.micro",
    Engine: optionalString(input, "Engine") ?? "redis",
    EngineVersion: optionalString(input, "EngineVersion"),
    CacheClusterStatus: "available",
    NumCacheNodes: numNodes,
    PreferredAvailabilityZone: availabilityZone,
    CacheClusterCreateTime: new Date().toISOString(),
    ReplicationGroupId: optionalString(input, "ReplicationGroupId"),
    ConfigurationEndpoint: { Address: address, Port: port },
    CacheNodes: cacheNodes,
    ARN: clusterArnOf(ctx.region, ctx.account, id),
  };
  ctx.store.set(clusterKey(id), cluster);
  return { CacheCluster: presentCluster(cluster) };
};

const DescribeCacheClusters: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "CacheClusterId");
  if (id !== undefined) {
    const cluster = requireCluster(ctx, id);
    return { CacheClusters: [presentCluster(cluster)] };
  }
  const clusters = ctx.store
    .list<StoredCacheCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => presentCluster(entry.value));
  return { CacheClusters: clusters };
};

const DeleteCacheCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "CacheClusterId");
  const cluster = requireCluster(ctx, id);
  const presented = presentCluster(cluster);
  ctx.store.delete(clusterKey(id));
  return { CacheCluster: { ...presented, CacheClusterStatus: "deleting" } };
};

const CreateReplicationGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ReplicationGroupId");
  const description = requireString(input, "ReplicationGroupDescription");
  const existing = ctx.store.get<StoredReplicationGroup>(groupKey(id));
  if (existing !== undefined) {
    throw awsError(
      "ReplicationGroupAlreadyExists",
      `ReplicationGroup ${id} already exists.`,
      400,
    );
  }
  const port = numberOr(input, "Port", 6379);
  const numClusters = numberOr(input, "NumCacheClusters", 1);
  const automaticFailover = booleanOr(input, "AutomaticFailoverEnabled", false);
  const multiAZ = booleanOr(input, "MultiAZEnabled", false);
  const memberClusters: string[] = [];
  for (let i = 0; i < numClusters; i += 1) {
    memberClusters.push(`${id}-${String(i + 1).padStart(3, "0")}`);
  }
  const group: StoredReplicationGroup = {
    ReplicationGroupId: id,
    Description: description,
    Status: "available",
    MemberClusters: memberClusters,
    AutomaticFailover: automaticFailover ? "enabled" : "disabled",
    MultiAZ: multiAZ ? "enabled" : "disabled",
    CacheNodeType: optionalString(input, "CacheNodeType"),
    ClusterEnabled: false,
    Engine: optionalString(input, "Engine") ?? "redis",
    ReplicationGroupCreateTime: new Date().toISOString(),
    ConfigurationEndpoint: {
      Address: `${id}.bunsai.${ctx.region}.cache.amazonaws.com`,
      Port: port,
    },
    ARN: groupArnOf(ctx.region, ctx.account, id),
  };
  ctx.store.set(groupKey(id), group);
  return { ReplicationGroup: presentGroup(group) };
};

const DescribeReplicationGroups: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "ReplicationGroupId");
  if (id !== undefined) {
    const group = ctx.store.get<StoredReplicationGroup>(groupKey(id));
    if (group === undefined) {
      throw awsError(
        "ReplicationGroupNotFoundFault",
        `ReplicationGroup ${id} not found.`,
        404,
      );
    }
    return { ReplicationGroups: [presentGroup(group)] };
  }
  const groups = ctx.store
    .list<StoredReplicationGroup>()
    .filter((entry) => entry.key.startsWith("group/"))
    .map((entry) => presentGroup(entry.value));
  return { ReplicationGroups: groups };
};

const CreateCacheParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CacheParameterGroupName");
  const family = requireString(input, "CacheParameterGroupFamily");
  const description = requireString(input, "Description");
  const existing = ctx.store.get<StoredCacheParameterGroup>(
    paramGroupKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "CacheParameterGroupAlreadyExists",
      `CacheParameterGroup ${name} already exists.`,
      400,
    );
  }
  const paramGroup: StoredCacheParameterGroup = {
    CacheParameterGroupName: name,
    CacheParameterGroupFamily: family,
    Description: description,
    IsGlobal: false,
    ARN: paramGroupArnOf(ctx.region, ctx.account, name),
  };
  ctx.store.set(paramGroupKey(name), paramGroup);
  return { CacheParameterGroup: presentParamGroup(paramGroup) };
};

const DescribeCacheParameterGroups: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "CacheParameterGroupName");
  if (name !== undefined) {
    const paramGroup = ctx.store.get<StoredCacheParameterGroup>(
      paramGroupKey(name),
    );
    if (paramGroup === undefined) {
      throw awsError(
        "CacheParameterGroupNotFound",
        `CacheParameterGroup ${name} not found.`,
        404,
      );
    }
    return { CacheParameterGroups: [presentParamGroup(paramGroup)] };
  }
  const paramGroups = ctx.store
    .list<StoredCacheParameterGroup>()
    .filter((entry) => entry.key.startsWith("paramgroup/"))
    .map((entry) => presentParamGroup(entry.value));
  return { CacheParameterGroups: paramGroups };
};

const DeleteCacheParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CacheParameterGroupName");
  const paramGroup = ctx.store.get<StoredCacheParameterGroup>(
    paramGroupKey(name),
  );
  if (paramGroup === undefined) {
    throw awsError(
      "CacheParameterGroupNotFound",
      `CacheParameterGroup ${name} not found.`,
      404,
    );
  }
  ctx.store.delete(paramGroupKey(name));
  return {};
};

const CreateCacheSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CacheSubnetGroupName");
  const description = requireString(input, "CacheSubnetGroupDescription");
  const existing = ctx.store.get<StoredCacheSubnetGroup>(subnetGroupKey(name));
  if (existing !== undefined) {
    throw awsError(
      "CacheSubnetGroupAlreadyExists",
      `CacheSubnetGroup ${name} already exists.`,
      400,
    );
  }
  const subnetIds = stringList(input, "SubnetIds");
  const subnets: StoredCacheSubnet[] = subnetIds.map((subnetId, index) => ({
    SubnetIdentifier: subnetId,
    SubnetAvailabilityZone: {
      Name: `${ctx.region}${String.fromCharCode(97 + (index % 26))}`,
    },
  }));
  const subnetGroup: StoredCacheSubnetGroup = {
    CacheSubnetGroupName: name,
    CacheSubnetGroupDescription: description,
    VpcId: optionalString(input, "VpcId") ?? "vpc-bunsai",
    Subnets: subnets,
    ARN: subnetGroupArnOf(ctx.region, ctx.account, name),
  };
  ctx.store.set(subnetGroupKey(name), subnetGroup);
  return { CacheSubnetGroup: presentSubnetGroup(subnetGroup) };
};

const DescribeCacheSubnetGroups: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "CacheSubnetGroupName");
  if (name !== undefined) {
    const subnetGroup = ctx.store.get<StoredCacheSubnetGroup>(
      subnetGroupKey(name),
    );
    if (subnetGroup === undefined) {
      throw awsError(
        "CacheSubnetGroupNotFoundFault",
        `CacheSubnetGroup ${name} not found.`,
        404,
      );
    }
    return { CacheSubnetGroups: [presentSubnetGroup(subnetGroup)] };
  }
  const subnetGroups = ctx.store
    .list<StoredCacheSubnetGroup>()
    .filter((entry) => entry.key.startsWith("subnetgroup/"))
    .map((entry) => presentSubnetGroup(entry.value));
  return { CacheSubnetGroups: subnetGroups };
};

const DeleteCacheSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CacheSubnetGroupName");
  const subnetGroup = ctx.store.get<StoredCacheSubnetGroup>(
    subnetGroupKey(name),
  );
  if (subnetGroup === undefined) {
    throw awsError(
      "CacheSubnetGroupNotFoundFault",
      `CacheSubnetGroup ${name} not found.`,
      404,
    );
  }
  ctx.store.delete(subnetGroupKey(name));
  return {};
};

const elasticache: ServiceDefinition = {
  name: "elasticache",
  protocol: "query",
  operations: {
    CreateCacheCluster,
    DescribeCacheClusters,
    DeleteCacheCluster,
    CreateReplicationGroup,
    DescribeReplicationGroups,
    CreateCacheParameterGroup,
    DescribeCacheParameterGroups,
    DeleteCacheParameterGroup,
    CreateCacheSubnetGroup,
    DescribeCacheSubnetGroups,
    DeleteCacheSubnetGroup,
  },
  model,
} as const;

export default elasticache;
