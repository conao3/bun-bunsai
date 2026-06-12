import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import elasticacheModel from "../../models/elasticache.json" with { type: "json" };
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
  NumNodeGroups: number;
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

type StoredSnapshot = {
  SnapshotName: string;
  ReplicationGroupId: string | undefined;
  CacheClusterId: string | undefined;
  SnapshotStatus: string;
  SnapshotSource: string;
  CacheNodeType: string | undefined;
  Engine: string | undefined;
  EngineVersion: string | undefined;
  ARN: string;
};

type StoredServerlessCache = {
  ServerlessCacheName: string;
  Description: string | undefined;
  Status: string;
  Engine: string;
  MajorEngineVersion: string | undefined;
  FullEngineVersion: string | undefined;
  KmsKeyId: string | undefined;
  SecurityGroupIds: string[];
  UserGroupId: string | undefined;
  SubnetIds: string[];
  SnapshotRetentionLimit: number | undefined;
  DailySnapshotTime: string | undefined;
  CreateTime: string;
  ARN: string;
};

type StoredServerlessCacheSnapshot = {
  ServerlessCacheSnapshotName: string;
  ARN: string;
  KmsKeyId: string | undefined;
  SnapshotType: string;
  Status: string;
  CreateTime: string;
  ServerlessCacheConfiguration: {
    ServerlessCacheName: string;
    Engine: string;
    MajorEngineVersion: string | undefined;
  };
};

type StoredUser = {
  UserId: string;
  UserName: string;
  Status: string;
  Engine: string;
  AccessString: string | undefined;
  UserGroupIds: string[];
  ARN: string;
};

type StoredUserGroup = {
  UserGroupId: string;
  Status: string;
  Engine: string;
  UserIds: string[];
  ReplicationGroups: string[];
  ServerlessCaches: string[];
  ARN: string;
};

type StoredCacheSecurityGroup = {
  OwnerId: string;
  CacheSecurityGroupName: string;
  Description: string;
  EC2SecurityGroups: {
    Status: string;
    EC2SecurityGroupName: string;
    EC2SecurityGroupOwnerId: string;
  }[];
  ARN: string;
};

type StoredGlobalReplicationGroup = {
  GlobalReplicationGroupId: string;
  GlobalReplicationGroupDescription: string;
  Status: string;
  CacheNodeType: string | undefined;
  Engine: string | undefined;
  EngineVersion: string | undefined;
  Members: {
    ReplicationGroupId: string;
    ReplicationGroupRegion: string;
    Role: string;
    AutomaticFailover: string;
    Status: string;
  }[];
  ClusterEnabled: boolean;
  GlobalNodeGroups: { GlobalNodeGroupId: string; Slots: string }[];
  ARN: string;
};

type StoredReservedCacheNode = {
  ReservedCacheNodeId: string;
  ReservedCacheNodesOfferingId: string;
  CacheNodeType: string;
  StartTime: string;
  Duration: number;
  FixedPrice: number;
  UsagePrice: number;
  CacheNodeCount: number;
  ProductDescription: string;
  OfferingType: string;
  State: string;
  ReservationARN: string;
};

const clusterKey = (id: string): string => `cluster/${id}`;

const groupKey = (id: string): string => `group/${id}`;

const paramGroupKey = (name: string): string => `paramgroup/${name}`;

const subnetGroupKey = (name: string): string => `subnetgroup/${name}`;

const snapshotKey = (name: string): string => `snapshot/${name}`;

const serverlessCacheKey = (name: string): string => `serverlesscache/${name}`;

const serverlessCacheSnapshotKey = (name: string): string =>
  `serverlesscachesnapshot/${name}`;

const userKey = (id: string): string => `user/${id}`;

const userGroupKey = (id: string): string => `usergroup/${id}`;

const cacheSecurityGroupKey = (name: string): string =>
  `cachesecuritygroup/${name}`;

const globalRepGroupKey = (id: string): string => `globalrepgroup/${id}`;

const reservedCacheNodeKey = (id: string): string => `reservedcachenode/${id}`;

const tagKey = (arn: string): string => `tags/${arn}`;

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

const snapshotArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:elasticache:${region}:${account}:snapshot:${name}`;

const serverlessCacheArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:elasticache:${region}:${account}:serverlesscache:${name}`;

const serverlessCacheSnapshotArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:elasticache:${region}:${account}:serverlesscachesnapshot:${name}`;

const userArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:elasticache:${region}:${account}:user:${id}`;

const userGroupArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:elasticache:${region}:${account}:usergroup:${id}`;

const cacheSecurityGroupArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:elasticache:${region}:${account}:securitygroup:${name}`;

const globalRepGroupArnOf = (
  region: string,
  account: string,
  id: string,
): string =>
  `arn:aws:elasticache:${region}:${account}:globalreplicationgroup:${id}`;

const reservedCacheNodeArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:elasticache:${region}:${account}:reserved-instance:${id}`;

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

const requireCluster = (
  ctx: ServiceContext,
  id: string,
): StoredCacheCluster => {
  const cluster = ctx.store.get<StoredCacheCluster>(clusterKey(id));
  if (cluster === undefined) {
    throw awsError(
      "CacheClusterNotFoundFault",
      `CacheCluster ${id} not found.`,
      404,
    );
  }
  return cluster;
};

const requireReplicationGroup = (
  ctx: ServiceContext,
  id: string,
): StoredReplicationGroup => {
  const group = ctx.store.get<StoredReplicationGroup>(groupKey(id));
  if (group === undefined) {
    throw awsError(
      "ReplicationGroupNotFoundFault",
      `ReplicationGroup ${id} not found.`,
      404,
    );
  }
  return group;
};

const requireSnapshot = (ctx: ServiceContext, name: string): StoredSnapshot => {
  const snapshot = ctx.store.get<StoredSnapshot>(snapshotKey(name));
  if (snapshot === undefined) {
    throw awsError("SnapshotNotFoundFault", `Snapshot ${name} not found.`, 404);
  }
  return snapshot;
};

const requireServerlessCache = (
  ctx: ServiceContext,
  name: string,
): StoredServerlessCache => {
  const cache = ctx.store.get<StoredServerlessCache>(serverlessCacheKey(name));
  if (cache === undefined) {
    throw awsError(
      "ServerlessCacheNotFoundFault",
      `ServerlessCache ${name} not found.`,
      404,
    );
  }
  return cache;
};

const requireServerlessCacheSnapshot = (
  ctx: ServiceContext,
  name: string,
): StoredServerlessCacheSnapshot => {
  const snap = ctx.store.get<StoredServerlessCacheSnapshot>(
    serverlessCacheSnapshotKey(name),
  );
  if (snap === undefined) {
    throw awsError(
      "ServerlessCacheSnapshotNotFoundFault",
      `ServerlessCacheSnapshot ${name} not found.`,
      404,
    );
  }
  return snap;
};

const requireUser = (ctx: ServiceContext, id: string): StoredUser => {
  const user = ctx.store.get<StoredUser>(userKey(id));
  if (user === undefined) {
    throw awsError("UserNotFoundFault", `User ${id} not found.`, 404);
  }
  return user;
};

const requireUserGroup = (ctx: ServiceContext, id: string): StoredUserGroup => {
  const group = ctx.store.get<StoredUserGroup>(userGroupKey(id));
  if (group === undefined) {
    throw awsError("UserGroupNotFoundFault", `UserGroup ${id} not found.`, 404);
  }
  return group;
};

const requireCacheSecurityGroup = (
  ctx: ServiceContext,
  name: string,
): StoredCacheSecurityGroup => {
  const group = ctx.store.get<StoredCacheSecurityGroup>(
    cacheSecurityGroupKey(name),
  );
  if (group === undefined) {
    throw awsError(
      "CacheSecurityGroupNotFound",
      `CacheSecurityGroup ${name} not found.`,
      404,
    );
  }
  return group;
};

const requireGlobalReplicationGroup = (
  ctx: ServiceContext,
  id: string,
): StoredGlobalReplicationGroup => {
  const group = ctx.store.get<StoredGlobalReplicationGroup>(
    globalRepGroupKey(id),
  );
  if (group === undefined) {
    throw awsError(
      "GlobalReplicationGroupNotFoundFault",
      `GlobalReplicationGroup ${id} not found.`,
      404,
    );
  }
  return group;
};

const applyMarkerPagination = <T>(
  items: T[],
  getId: (item: T) => string,
  input: Record<string, unknown>,
  maxKey = "MaxRecords",
  markerKey = "Marker",
  defaultMax = 100,
): { items: T[]; marker: string | undefined } => {
  const maxRecords = numberOr(input, maxKey, defaultMax);
  const marker = optionalString(input, markerKey);
  let startIdx = 0;
  if (marker !== undefined) {
    const idx = items.findIndex((item) => getId(item) === marker);
    if (idx !== -1) {
      startIdx = idx + 1;
    }
  }
  const page = items.slice(startIdx, startIdx + maxRecords);
  const nextMarker =
    startIdx + maxRecords < items.length
      ? getId(page[page.length - 1])
      : undefined;
  return { items: page, marker: nextMarker };
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

const presentSnapshot = (snapshot: StoredSnapshot) => ({
  SnapshotName: snapshot.SnapshotName,
  ReplicationGroupId: snapshot.ReplicationGroupId,
  CacheClusterId: snapshot.CacheClusterId,
  SnapshotStatus: snapshot.SnapshotStatus,
  SnapshotSource: snapshot.SnapshotSource,
  CacheNodeType: snapshot.CacheNodeType,
  Engine: snapshot.Engine,
  EngineVersion: snapshot.EngineVersion,
  ARN: snapshot.ARN,
});

const presentServerlessCache = (cache: StoredServerlessCache) => ({
  ServerlessCacheName: cache.ServerlessCacheName,
  Description: cache.Description,
  Status: cache.Status,
  Engine: cache.Engine,
  MajorEngineVersion: cache.MajorEngineVersion,
  FullEngineVersion: cache.FullEngineVersion,
  KmsKeyId: cache.KmsKeyId,
  SecurityGroupIds: cache.SecurityGroupIds,
  UserGroupId: cache.UserGroupId,
  SubnetIds: cache.SubnetIds,
  SnapshotRetentionLimit: cache.SnapshotRetentionLimit,
  DailySnapshotTime: cache.DailySnapshotTime,
  CreateTime: cache.CreateTime,
  Endpoint: {
    Address: `${cache.ServerlessCacheName}.serverless.${cache.Engine}.bunsai.cache.amazonaws.com`,
    Port: 6379,
  },
  ReaderEndpoint: {
    Address: `${cache.ServerlessCacheName}.reader.serverless.${cache.Engine}.bunsai.cache.amazonaws.com`,
    Port: 6379,
  },
  ARN: cache.ARN,
});

const presentServerlessCacheSnapshot = (
  snap: StoredServerlessCacheSnapshot,
) => ({
  ServerlessCacheSnapshotName: snap.ServerlessCacheSnapshotName,
  ARN: snap.ARN,
  KmsKeyId: snap.KmsKeyId,
  SnapshotType: snap.SnapshotType,
  Status: snap.Status,
  CreateTime: snap.CreateTime,
  ServerlessCacheConfiguration: snap.ServerlessCacheConfiguration,
});

const presentUser = (user: StoredUser) => ({
  UserId: user.UserId,
  UserName: user.UserName,
  Status: user.Status,
  Engine: user.Engine,
  MinimumEngineVersion: "6.0",
  AccessString: user.AccessString,
  UserGroupIds: user.UserGroupIds,
  Authentication: { Type: "no-password", PasswordCount: 0 },
  ARN: user.ARN,
});

const presentUserGroup = (group: StoredUserGroup) => ({
  UserGroupId: group.UserGroupId,
  Status: group.Status,
  Engine: group.Engine,
  UserIds: group.UserIds,
  MinimumEngineVersion: "6.0",
  PendingChanges: { UserIdsToRemove: [], UserIdsToAdd: [] },
  ReplicationGroups: group.ReplicationGroups,
  ServerlessCaches: group.ServerlessCaches,
  ARN: group.ARN,
});

const presentCacheSecurityGroup = (group: StoredCacheSecurityGroup) => ({
  OwnerId: group.OwnerId,
  CacheSecurityGroupName: group.CacheSecurityGroupName,
  Description: group.Description,
  EC2SecurityGroups: group.EC2SecurityGroups,
  ARN: group.ARN,
});

const presentGlobalReplicationGroup = (
  group: StoredGlobalReplicationGroup,
) => ({
  GlobalReplicationGroupId: group.GlobalReplicationGroupId,
  GlobalReplicationGroupDescription: group.GlobalReplicationGroupDescription,
  Status: group.Status,
  CacheNodeType: group.CacheNodeType,
  Engine: group.Engine,
  EngineVersion: group.EngineVersion,
  Members: group.Members,
  ClusterEnabled: group.ClusterEnabled,
  GlobalNodeGroups: group.GlobalNodeGroups,
  ARN: group.ARN,
});

const CreateCacheCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "CacheClusterId");
  const existing = ctx.store.get<StoredCacheCluster>(clusterKey(id));
  if (existing !== undefined) {
    throw awsError(
      "CacheClusterAlreadyExistsFault",
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
    CacheClusterStatus: "creating",
    NumCacheNodes: numNodes,
    PreferredAvailabilityZone: availabilityZone,
    CacheClusterCreateTime: new Date().toISOString(),
    ReplicationGroupId: optionalString(input, "ReplicationGroupId"),
    ConfigurationEndpoint: { Address: address, Port: port },
    CacheNodes: cacheNodes,
    ARN: clusterArnOf(ctx.region, ctx.account, id),
  };
  ctx.store.set(clusterKey(id), cluster);
  const initialTags = tagList(input);
  if (initialTags.length > 0) {
    ctx.store.set(tagKey(cluster.ARN), initialTags);
  }
  return { CacheCluster: presentCluster(cluster) };
};

const DescribeCacheClusters: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "CacheClusterId");
  if (id !== undefined) {
    const cluster = requireCluster(ctx, id);
    if (cluster.CacheClusterStatus === "deleting") {
      ctx.store.delete(clusterKey(id));
      return { CacheClusters: [presentCluster(cluster)] };
    }
    if (cluster.CacheClusterStatus === "creating") {
      const updated: StoredCacheCluster = {
        ...cluster,
        CacheClusterStatus: "available",
      };
      ctx.store.set(clusterKey(id), updated);
      return { CacheClusters: [presentCluster(updated)] };
    }
    return { CacheClusters: [presentCluster(cluster)] };
  }
  const allClusters = ctx.store
    .list<StoredCacheCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => presentCluster(entry.value));
  const paginated = applyMarkerPagination(
    allClusters,
    (c) => c.CacheClusterId,
    input,
  );
  return { CacheClusters: paginated.items, Marker: paginated.marker };
};

const DeleteCacheCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "CacheClusterId");
  const cluster = requireCluster(ctx, id);
  const updated: StoredCacheCluster = {
    ...cluster,
    CacheClusterStatus: "deleting",
  };
  ctx.store.set(clusterKey(id), updated);
  ctx.store.delete(tagKey(cluster.ARN));
  return { CacheCluster: presentCluster(updated) };
};

const ModifyCacheCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "CacheClusterId");
  const cluster = requireCluster(ctx, id);
  const updated: StoredCacheCluster = {
    ...cluster,
    CacheNodeType:
      optionalString(input, "CacheNodeType") ?? cluster.CacheNodeType,
    EngineVersion:
      optionalString(input, "EngineVersion") ?? cluster.EngineVersion,
    NumCacheNodes: numberOr(input, "NumCacheNodes", cluster.NumCacheNodes),
  };
  ctx.store.set(clusterKey(id), updated);
  return { CacheCluster: presentCluster(updated) };
};

const RebootCacheCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "CacheClusterId");
  const cluster = requireCluster(ctx, id);
  return { CacheCluster: presentCluster(cluster) };
};

const CreateReplicationGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ReplicationGroupId");
  const description = requireString(input, "ReplicationGroupDescription");
  const existing = ctx.store.get<StoredReplicationGroup>(groupKey(id));
  if (existing !== undefined) {
    throw awsError(
      "ReplicationGroupAlreadyExistsFault",
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
    Status: "creating",
    MemberClusters: memberClusters,
    AutomaticFailover: automaticFailover ? "enabled" : "disabled",
    MultiAZ: multiAZ ? "enabled" : "disabled",
    CacheNodeType: optionalString(input, "CacheNodeType"),
    ClusterEnabled: false,
    NumNodeGroups: 1,
    Engine: optionalString(input, "Engine") ?? "redis",
    ReplicationGroupCreateTime: new Date().toISOString(),
    ConfigurationEndpoint: {
      Address: `${id}.bunsai.${ctx.region}.cache.amazonaws.com`,
      Port: port,
    },
    ARN: groupArnOf(ctx.region, ctx.account, id),
  };
  ctx.store.set(groupKey(id), group);
  const initialGroupTags = tagList(input);
  if (initialGroupTags.length > 0) {
    ctx.store.set(tagKey(group.ARN), initialGroupTags);
  }
  return { ReplicationGroup: presentGroup(group) };
};

const DescribeReplicationGroups: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "ReplicationGroupId");
  if (id !== undefined) {
    const group = requireReplicationGroup(ctx, id);
    if (group.Status === "deleting") {
      ctx.store.delete(groupKey(id));
      return { ReplicationGroups: [presentGroup(group)] };
    }
    if (group.Status === "creating") {
      const updated: StoredReplicationGroup = {
        ...group,
        Status: "available",
      };
      ctx.store.set(groupKey(id), updated);
      return { ReplicationGroups: [presentGroup(updated)] };
    }
    return { ReplicationGroups: [presentGroup(group)] };
  }
  const allGroups = ctx.store
    .list<StoredReplicationGroup>()
    .filter((entry) => entry.key.startsWith("group/"))
    .map((entry) => presentGroup(entry.value));
  const paginated = applyMarkerPagination(
    allGroups,
    (g) => g.ReplicationGroupId,
    input,
  );
  return { ReplicationGroups: paginated.items, Marker: paginated.marker };
};

const DeleteReplicationGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ReplicationGroupId");
  const group = requireReplicationGroup(ctx, id);
  const updated: StoredReplicationGroup = { ...group, Status: "deleting" };
  ctx.store.set(groupKey(id), updated);
  ctx.store.delete(tagKey(group.ARN));
  return { ReplicationGroup: presentGroup(updated) };
};

const ModifyReplicationGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ReplicationGroupId");
  const group = requireReplicationGroup(ctx, id);
  const updated: StoredReplicationGroup = {
    ...group,
    Description:
      optionalString(input, "ReplicationGroupDescription") ?? group.Description,
    CacheNodeType:
      optionalString(input, "CacheNodeType") ?? group.CacheNodeType,
    AutomaticFailover: booleanOr(
      input,
      "AutomaticFailoverEnabled",
      group.AutomaticFailover === "enabled",
    )
      ? "enabled"
      : "disabled",
  };
  ctx.store.set(groupKey(id), updated);
  return { ReplicationGroup: presentGroup(updated) };
};

const ModifyReplicationGroupShardConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const id = requireString(input, "ReplicationGroupId");
  const group = requireReplicationGroup(ctx, id);
  const nodeGroupCount = numberOr(input, "NodeGroupCount", group.NumNodeGroups);
  const replicasPerShard =
    group.MemberClusters.length > group.NumNodeGroups
      ? Math.floor(
          (group.MemberClusters.length - group.NumNodeGroups) /
            group.NumNodeGroups,
        )
      : 0;
  const newTotalClusters = nodeGroupCount * (1 + replicasPerShard);
  const newMemberClusters: string[] = [];
  for (let i = 0; i < newTotalClusters; i += 1) {
    newMemberClusters.push(`${id}-${String(i + 1).padStart(3, "0")}`);
  }
  const updated: StoredReplicationGroup = {
    ...group,
    NumNodeGroups: nodeGroupCount,
    ClusterEnabled: nodeGroupCount > 1,
    MemberClusters: newMemberClusters,
  };
  ctx.store.set(groupKey(id), updated);
  return { ReplicationGroup: presentGroup(updated) };
};

const IncreaseReplicaCount: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ReplicationGroupId");
  const group = requireReplicationGroup(ctx, id);
  const newReplicaCount = numberOr(
    input,
    "NewReplicaCount",
    group.MemberClusters.length - group.NumNodeGroups,
  );
  const newTotalClusters = group.NumNodeGroups * (1 + newReplicaCount);
  const newMemberClusters: string[] = [];
  for (let i = 0; i < newTotalClusters; i += 1) {
    newMemberClusters.push(`${id}-${String(i + 1).padStart(3, "0")}`);
  }
  const updated: StoredReplicationGroup = {
    ...group,
    MemberClusters: newMemberClusters,
  };
  ctx.store.set(groupKey(id), updated);
  return { ReplicationGroup: presentGroup(updated) };
};

const DecreaseReplicaCount: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ReplicationGroupId");
  const group = requireReplicationGroup(ctx, id);
  const newReplicaCount = numberOr(
    input,
    "NewReplicaCount",
    group.MemberClusters.length - group.NumNodeGroups,
  );
  const newTotalClusters = group.NumNodeGroups * (1 + newReplicaCount);
  const newMemberClusters = group.MemberClusters.slice(0, newTotalClusters);
  const updated: StoredReplicationGroup = {
    ...group,
    MemberClusters: newMemberClusters,
  };
  ctx.store.set(groupKey(id), updated);
  return { ReplicationGroup: presentGroup(updated) };
};

const TestFailover: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ReplicationGroupId");
  const group = requireReplicationGroup(ctx, id);
  return { ReplicationGroup: presentGroup(group) };
};

const StartMigration: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ReplicationGroupId");
  const group = requireReplicationGroup(ctx, id);
  return { ReplicationGroup: presentGroup(group) };
};

const CompleteMigration: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ReplicationGroupId");
  const group = requireReplicationGroup(ctx, id);
  return { ReplicationGroup: presentGroup(group) };
};

const TestMigration: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ReplicationGroupId");
  const group = requireReplicationGroup(ctx, id);
  return { ReplicationGroup: presentGroup(group) };
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

const ModifyCacheParameterGroup: OperationHandler = (input, ctx) => {
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
  return { CacheParameterGroupName: name };
};

const ResetCacheParameterGroup: OperationHandler = (input, ctx) => {
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
  return { CacheParameterGroupName: name };
};

const DescribeCacheParameters: OperationHandler = (input, ctx) => {
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
  return {
    Parameters: [],
    CacheNodeTypeSpecificParameters: [],
  };
};

const DescribeEngineDefaultParameters: OperationHandler = (input, _ctx) => {
  const family = requireString(input, "CacheParameterGroupFamily");
  return {
    EngineDefaults: {
      CacheParameterGroupFamily: family,
      Marker: undefined,
      Parameters: [],
      CacheNodeTypeSpecificParameters: [],
    },
  };
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

const ModifyCacheSubnetGroup: OperationHandler = (input, ctx) => {
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
  const newDescription =
    optionalString(input, "CacheSubnetGroupDescription") ??
    subnetGroup.CacheSubnetGroupDescription;
  const subnetIds = stringList(input, "SubnetIds");
  const subnets =
    subnetIds.length > 0
      ? subnetIds.map((subnetId, index) => ({
          SubnetIdentifier: subnetId,
          SubnetAvailabilityZone: {
            Name: `${ctx.region}${String.fromCharCode(97 + (index % 26))}`,
          },
        }))
      : subnetGroup.Subnets;
  const updated: StoredCacheSubnetGroup = {
    ...subnetGroup,
    CacheSubnetGroupDescription: newDescription,
    Subnets: subnets,
  };
  ctx.store.set(subnetGroupKey(name), updated);
  return { CacheSubnetGroup: presentSubnetGroup(updated) };
};

const CreateSnapshot: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SnapshotName");
  const existing = ctx.store.get<StoredSnapshot>(snapshotKey(name));
  if (existing !== undefined) {
    throw awsError(
      "SnapshotAlreadyExistsFault",
      `Snapshot ${name} already exists.`,
      400,
    );
  }
  const replicationGroupId = optionalString(input, "ReplicationGroupId");
  const cacheClusterId = optionalString(input, "CacheClusterId");
  let engine: string | undefined;
  let engineVersion: string | undefined;
  let cacheNodeType: string | undefined;
  if (replicationGroupId !== undefined) {
    const group = requireReplicationGroup(ctx, replicationGroupId);
    engine = group.Engine;
    cacheNodeType = group.CacheNodeType;
  } else if (cacheClusterId !== undefined) {
    const cluster = requireCluster(ctx, cacheClusterId);
    engine = cluster.Engine;
    engineVersion = cluster.EngineVersion;
    cacheNodeType = cluster.CacheNodeType;
  }
  const snapshot: StoredSnapshot = {
    SnapshotName: name,
    ReplicationGroupId: replicationGroupId,
    CacheClusterId: cacheClusterId,
    SnapshotStatus: "available",
    SnapshotSource: "manual",
    CacheNodeType: cacheNodeType,
    Engine: engine,
    EngineVersion: engineVersion,
    ARN: snapshotArnOf(ctx.region, ctx.account, name),
  };
  ctx.store.set(snapshotKey(name), snapshot);
  return { Snapshot: presentSnapshot(snapshot) };
};

const CopySnapshot: OperationHandler = (input, ctx) => {
  const sourceName = requireString(input, "SourceSnapshotName");
  const targetName = requireString(input, "TargetSnapshotName");
  const source = requireSnapshot(ctx, sourceName);
  const existing = ctx.store.get<StoredSnapshot>(snapshotKey(targetName));
  if (existing !== undefined) {
    throw awsError(
      "SnapshotAlreadyExistsFault",
      `Snapshot ${targetName} already exists.`,
      400,
    );
  }
  const snapshot: StoredSnapshot = {
    ...source,
    SnapshotName: targetName,
    SnapshotSource: "manual",
    ARN: snapshotArnOf(ctx.region, ctx.account, targetName),
  };
  ctx.store.set(snapshotKey(targetName), snapshot);
  return { Snapshot: presentSnapshot(snapshot) };
};

const DescribeSnapshots: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "SnapshotName");
  if (name !== undefined) {
    const snapshot = requireSnapshot(ctx, name);
    return { Snapshots: [presentSnapshot(snapshot)] };
  }
  const replicationGroupId = optionalString(input, "ReplicationGroupId");
  const cacheClusterId = optionalString(input, "CacheClusterId");
  const allSnapshots = ctx.store
    .list<StoredSnapshot>()
    .filter((entry) => entry.key.startsWith("snapshot/"))
    .filter((entry) => {
      if (
        replicationGroupId !== undefined &&
        entry.value.ReplicationGroupId !== replicationGroupId
      ) {
        return false;
      }
      if (
        cacheClusterId !== undefined &&
        entry.value.CacheClusterId !== cacheClusterId
      ) {
        return false;
      }
      return true;
    })
    .map((entry) => presentSnapshot(entry.value));
  const paginated = applyMarkerPagination(
    allSnapshots,
    (s) => s.SnapshotName,
    input,
  );
  return { Snapshots: paginated.items, Marker: paginated.marker };
};

const DeleteSnapshot: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SnapshotName");
  const snapshot = requireSnapshot(ctx, name);
  const presented = presentSnapshot(snapshot);
  ctx.store.delete(snapshotKey(name));
  return { Snapshot: { ...presented, SnapshotStatus: "deleting" } };
};

const CreateServerlessCache: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ServerlessCacheName");
  const existing = ctx.store.get<StoredServerlessCache>(
    serverlessCacheKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ServerlessCacheAlreadyExistsFault",
      `ServerlessCache ${name} already exists.`,
      400,
    );
  }
  const engine = optionalString(input, "Engine") ?? "redis";
  const cache: StoredServerlessCache = {
    ServerlessCacheName: name,
    Description: optionalString(input, "Description"),
    Status: "creating",
    Engine: engine,
    MajorEngineVersion: optionalString(input, "MajorEngineVersion"),
    FullEngineVersion: optionalString(input, "MajorEngineVersion") ?? "7.0.7",
    KmsKeyId: optionalString(input, "KmsKeyId"),
    SecurityGroupIds: stringList(input, "SecurityGroupIds"),
    UserGroupId: optionalString(input, "UserGroupId"),
    SubnetIds: stringList(input, "SubnetIds"),
    SnapshotRetentionLimit:
      input["SnapshotRetentionLimit"] !== undefined
        ? numberOr(input, "SnapshotRetentionLimit", 0)
        : undefined,
    DailySnapshotTime: optionalString(input, "DailySnapshotTime"),
    CreateTime: new Date().toISOString(),
    ARN: serverlessCacheArnOf(ctx.region, ctx.account, name),
  };
  ctx.store.set(serverlessCacheKey(name), cache);
  return { ServerlessCache: presentServerlessCache(cache) };
};

const DescribeServerlessCaches: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "ServerlessCacheName");
  if (name !== undefined) {
    const cache = requireServerlessCache(ctx, name);
    if (cache.Status === "deleting") {
      ctx.store.delete(serverlessCacheKey(name));
      return { ServerlessCaches: [presentServerlessCache(cache)] };
    }
    if (cache.Status === "creating") {
      const updated: StoredServerlessCache = { ...cache, Status: "available" };
      ctx.store.set(serverlessCacheKey(name), updated);
      return { ServerlessCaches: [presentServerlessCache(updated)] };
    }
    return { ServerlessCaches: [presentServerlessCache(cache)] };
  }
  const allCaches = ctx.store
    .list<StoredServerlessCache>()
    .filter((entry) => entry.key.startsWith("serverlesscache/"))
    .map((entry) => presentServerlessCache(entry.value));
  const paginated = applyMarkerPagination(
    allCaches,
    (c) => c.ServerlessCacheName,
    input,
    "MaxResults",
    "NextToken",
    50,
  );
  return { ServerlessCaches: paginated.items, NextToken: paginated.marker };
};

const DeleteServerlessCache: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ServerlessCacheName");
  const cache = requireServerlessCache(ctx, name);
  const updated: StoredServerlessCache = { ...cache, Status: "deleting" };
  ctx.store.set(serverlessCacheKey(name), updated);
  return { ServerlessCache: presentServerlessCache(updated) };
};

const ModifyServerlessCache: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ServerlessCacheName");
  const cache = requireServerlessCache(ctx, name);
  const updated: StoredServerlessCache = {
    ...cache,
    Description: optionalString(input, "Description") ?? cache.Description,
    UserGroupId: booleanOr(input, "RemoveUserGroup", false)
      ? undefined
      : (optionalString(input, "UserGroupId") ?? cache.UserGroupId),
    SecurityGroupIds:
      stringList(input, "SecurityGroupIds").length > 0
        ? stringList(input, "SecurityGroupIds")
        : cache.SecurityGroupIds,
    SnapshotRetentionLimit:
      input["SnapshotRetentionLimit"] !== undefined
        ? numberOr(
            input,
            "SnapshotRetentionLimit",
            cache.SnapshotRetentionLimit ?? 0,
          )
        : cache.SnapshotRetentionLimit,
    DailySnapshotTime:
      optionalString(input, "DailySnapshotTime") ?? cache.DailySnapshotTime,
  };
  ctx.store.set(serverlessCacheKey(name), updated);
  return { ServerlessCache: presentServerlessCache(updated) };
};

const CreateServerlessCacheSnapshot: OperationHandler = (input, ctx) => {
  const snapshotName = requireString(input, "ServerlessCacheSnapshotName");
  const cacheName = requireString(input, "ServerlessCacheName");
  const cache = requireServerlessCache(ctx, cacheName);
  const existing = ctx.store.get<StoredServerlessCacheSnapshot>(
    serverlessCacheSnapshotKey(snapshotName),
  );
  if (existing !== undefined) {
    throw awsError(
      "ServerlessCacheSnapshotAlreadyExistsFault",
      `ServerlessCacheSnapshot ${snapshotName} already exists.`,
      400,
    );
  }
  const snap: StoredServerlessCacheSnapshot = {
    ServerlessCacheSnapshotName: snapshotName,
    ARN: serverlessCacheSnapshotArnOf(ctx.region, ctx.account, snapshotName),
    KmsKeyId: optionalString(input, "KmsKeyId"),
    SnapshotType: "manual",
    Status: "available",
    CreateTime: new Date().toISOString(),
    ServerlessCacheConfiguration: {
      ServerlessCacheName: cacheName,
      Engine: cache.Engine,
      MajorEngineVersion: cache.MajorEngineVersion,
    },
  };
  ctx.store.set(serverlessCacheSnapshotKey(snapshotName), snap);
  return { ServerlessCacheSnapshot: presentServerlessCacheSnapshot(snap) };
};

const CopyServerlessCacheSnapshot: OperationHandler = (input, ctx) => {
  const sourceName = requireString(input, "SourceServerlessCacheSnapshotName");
  const targetName = requireString(input, "TargetServerlessCacheSnapshotName");
  const source = requireServerlessCacheSnapshot(ctx, sourceName);
  const existing = ctx.store.get<StoredServerlessCacheSnapshot>(
    serverlessCacheSnapshotKey(targetName),
  );
  if (existing !== undefined) {
    throw awsError(
      "ServerlessCacheSnapshotAlreadyExistsFault",
      `ServerlessCacheSnapshot ${targetName} already exists.`,
      400,
    );
  }
  const snap: StoredServerlessCacheSnapshot = {
    ...source,
    ServerlessCacheSnapshotName: targetName,
    ARN: serverlessCacheSnapshotArnOf(ctx.region, ctx.account, targetName),
    KmsKeyId: optionalString(input, "KmsKeyId") ?? source.KmsKeyId,
    SnapshotType: "manual",
  };
  ctx.store.set(serverlessCacheSnapshotKey(targetName), snap);
  return { ServerlessCacheSnapshot: presentServerlessCacheSnapshot(snap) };
};

const ExportServerlessCacheSnapshot: OperationHandler = (input, ctx) => {
  const snapshotName = requireString(input, "ServerlessCacheSnapshotName");
  const snap = requireServerlessCacheSnapshot(ctx, snapshotName);
  return { ServerlessCacheSnapshot: presentServerlessCacheSnapshot(snap) };
};

const DeleteServerlessCacheSnapshot: OperationHandler = (input, ctx) => {
  const snapshotName = requireString(input, "ServerlessCacheSnapshotName");
  const snap = requireServerlessCacheSnapshot(ctx, snapshotName);
  const presented = presentServerlessCacheSnapshot(snap);
  ctx.store.delete(serverlessCacheSnapshotKey(snapshotName));
  return { ServerlessCacheSnapshot: { ...presented, Status: "deleting" } };
};

const DescribeServerlessCacheSnapshots: OperationHandler = (input, ctx) => {
  const snapshotName = optionalString(input, "ServerlessCacheSnapshotName");
  if (snapshotName !== undefined) {
    const snap = requireServerlessCacheSnapshot(ctx, snapshotName);
    return { ServerlessCacheSnapshots: [presentServerlessCacheSnapshot(snap)] };
  }
  const cacheName = optionalString(input, "ServerlessCacheName");
  const allSnapshots = ctx.store
    .list<StoredServerlessCacheSnapshot>()
    .filter((entry) => entry.key.startsWith("serverlesscachesnapshot/"))
    .filter((entry) => {
      if (
        cacheName !== undefined &&
        entry.value.ServerlessCacheConfiguration.ServerlessCacheName !==
          cacheName
      ) {
        return false;
      }
      return true;
    })
    .map((entry) => presentServerlessCacheSnapshot(entry.value));
  const paginated = applyMarkerPagination(
    allSnapshots,
    (s) => s.ServerlessCacheSnapshotName,
    input,
    "MaxResults",
    "NextToken",
    50,
  );
  return {
    ServerlessCacheSnapshots: paginated.items,
    NextToken: paginated.marker,
  };
};

const CreateUser: OperationHandler = (input, ctx) => {
  const userId = requireString(input, "UserId");
  const userName = requireString(input, "UserName");
  const engine = requireString(input, "Engine");
  const existing = ctx.store.get<StoredUser>(userKey(userId));
  if (existing !== undefined) {
    throw awsError(
      "UserAlreadyExistsFault",
      `User ${userId} already exists.`,
      400,
    );
  }
  const user: StoredUser = {
    UserId: userId,
    UserName: userName,
    Status: "active",
    Engine: engine,
    AccessString: optionalString(input, "AccessString"),
    UserGroupIds: [],
    ARN: userArnOf(ctx.region, ctx.account, userId),
  };
  ctx.store.set(userKey(userId), user);
  return presentUser(user);
};

const DescribeUsers: OperationHandler = (input, ctx) => {
  const userId = optionalString(input, "UserId");
  if (userId !== undefined) {
    const user = requireUser(ctx, userId);
    return { Users: [presentUser(user)] };
  }
  const users = ctx.store
    .list<StoredUser>()
    .filter((entry) => entry.key.startsWith("user/"))
    .map((entry) => presentUser(entry.value));
  return { Users: users };
};

const DeleteUser: OperationHandler = (input, ctx) => {
  const userId = requireString(input, "UserId");
  const user = requireUser(ctx, userId);
  const presented = presentUser(user);
  ctx.store.delete(userKey(userId));
  return { ...presented, Status: "deleting" };
};

const ModifyUser: OperationHandler = (input, ctx) => {
  const userId = requireString(input, "UserId");
  const user = requireUser(ctx, userId);
  const updated: StoredUser = {
    ...user,
    AccessString: optionalString(input, "AccessString") ?? user.AccessString,
  };
  ctx.store.set(userKey(userId), updated);
  return presentUser(updated);
};

const CreateUserGroup: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "UserGroupId");
  const engine = requireString(input, "Engine");
  const existing = ctx.store.get<StoredUserGroup>(userGroupKey(groupId));
  if (existing !== undefined) {
    throw awsError(
      "UserGroupAlreadyExistsFault",
      `UserGroup ${groupId} already exists.`,
      400,
    );
  }
  const userIds = stringList(input, "UserIds");
  const group: StoredUserGroup = {
    UserGroupId: groupId,
    Status: "active",
    Engine: engine,
    UserIds: userIds,
    ReplicationGroups: [],
    ServerlessCaches: [],
    ARN: userGroupArnOf(ctx.region, ctx.account, groupId),
  };
  ctx.store.set(userGroupKey(groupId), group);
  return presentUserGroup(group);
};

const DescribeUserGroups: OperationHandler = (input, ctx) => {
  const groupId = optionalString(input, "UserGroupId");
  if (groupId !== undefined) {
    const group = requireUserGroup(ctx, groupId);
    return { UserGroups: [presentUserGroup(group)] };
  }
  const groups = ctx.store
    .list<StoredUserGroup>()
    .filter((entry) => entry.key.startsWith("usergroup/"))
    .map((entry) => presentUserGroup(entry.value));
  return { UserGroups: groups };
};

const DeleteUserGroup: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "UserGroupId");
  const group = requireUserGroup(ctx, groupId);
  const presented = presentUserGroup(group);
  ctx.store.delete(userGroupKey(groupId));
  return { ...presented, Status: "deleting" };
};

const ModifyUserGroup: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "UserGroupId");
  const group = requireUserGroup(ctx, groupId);
  const toAdd = stringList(input, "UserIdsToAdd");
  const toRemove = stringList(input, "UserIdsToRemove");
  const newUserIds = [
    ...group.UserIds.filter((id) => !toRemove.includes(id)),
    ...toAdd,
  ];
  const updated: StoredUserGroup = { ...group, UserIds: newUserIds };
  ctx.store.set(userGroupKey(groupId), updated);
  return presentUserGroup(updated);
};

const CreateCacheSecurityGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CacheSecurityGroupName");
  const description = requireString(input, "Description");
  const existing = ctx.store.get<StoredCacheSecurityGroup>(
    cacheSecurityGroupKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "CacheSecurityGroupAlreadyExists",
      `CacheSecurityGroup ${name} already exists.`,
      400,
    );
  }
  const group: StoredCacheSecurityGroup = {
    OwnerId: ctx.account,
    CacheSecurityGroupName: name,
    Description: description,
    EC2SecurityGroups: [],
    ARN: cacheSecurityGroupArnOf(ctx.region, ctx.account, name),
  };
  ctx.store.set(cacheSecurityGroupKey(name), group);
  return { CacheSecurityGroup: presentCacheSecurityGroup(group) };
};

const DescribeCacheSecurityGroups: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "CacheSecurityGroupName");
  if (name !== undefined) {
    const group = requireCacheSecurityGroup(ctx, name);
    return { CacheSecurityGroups: [presentCacheSecurityGroup(group)] };
  }
  const groups = ctx.store
    .list<StoredCacheSecurityGroup>()
    .filter((entry) => entry.key.startsWith("cachesecuritygroup/"))
    .map((entry) => presentCacheSecurityGroup(entry.value));
  return { CacheSecurityGroups: groups };
};

const DeleteCacheSecurityGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CacheSecurityGroupName");
  requireCacheSecurityGroup(ctx, name);
  ctx.store.delete(cacheSecurityGroupKey(name));
  return {};
};

const AuthorizeCacheSecurityGroupIngress: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CacheSecurityGroupName");
  const ec2GroupName = requireString(input, "EC2SecurityGroupName");
  const ec2GroupOwner = requireString(input, "EC2SecurityGroupOwnerId");
  const group = requireCacheSecurityGroup(ctx, name);
  const updated: StoredCacheSecurityGroup = {
    ...group,
    EC2SecurityGroups: [
      ...group.EC2SecurityGroups,
      {
        Status: "authorizing",
        EC2SecurityGroupName: ec2GroupName,
        EC2SecurityGroupOwnerId: ec2GroupOwner,
      },
    ],
  };
  ctx.store.set(cacheSecurityGroupKey(name), updated);
  return { CacheSecurityGroup: presentCacheSecurityGroup(updated) };
};

const RevokeCacheSecurityGroupIngress: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CacheSecurityGroupName");
  const ec2GroupName = requireString(input, "EC2SecurityGroupName");
  const ec2GroupOwner = requireString(input, "EC2SecurityGroupOwnerId");
  const group = requireCacheSecurityGroup(ctx, name);
  const updated: StoredCacheSecurityGroup = {
    ...group,
    EC2SecurityGroups: group.EC2SecurityGroups.filter(
      (g) =>
        !(
          g.EC2SecurityGroupName === ec2GroupName &&
          g.EC2SecurityGroupOwnerId === ec2GroupOwner
        ),
    ),
  };
  ctx.store.set(cacheSecurityGroupKey(name), updated);
  return { CacheSecurityGroup: presentCacheSecurityGroup(updated) };
};

const CreateGlobalReplicationGroup: OperationHandler = (input, ctx) => {
  const suffix = requireString(input, "GlobalReplicationGroupIdSuffix");
  const description =
    optionalString(input, "GlobalReplicationGroupDescription") ?? "";
  const primaryId = requireString(input, "PrimaryReplicationGroupId");
  const primaryGroup = requireReplicationGroup(ctx, primaryId);
  const globalId = `ldgnf-${suffix}`;
  const existing = ctx.store.get<StoredGlobalReplicationGroup>(
    globalRepGroupKey(globalId),
  );
  if (existing !== undefined) {
    throw awsError(
      "GlobalReplicationGroupAlreadyExistsFault",
      `GlobalReplicationGroup ${globalId} already exists.`,
      400,
    );
  }
  const group: StoredGlobalReplicationGroup = {
    GlobalReplicationGroupId: globalId,
    GlobalReplicationGroupDescription: description,
    Status: "available",
    CacheNodeType: primaryGroup.CacheNodeType,
    Engine: primaryGroup.Engine,
    EngineVersion: undefined,
    Members: [
      {
        ReplicationGroupId: primaryId,
        ReplicationGroupRegion: ctx.region,
        Role: "PRIMARY",
        AutomaticFailover: primaryGroup.AutomaticFailover,
        Status: "associated",
      },
    ],
    ClusterEnabled: primaryGroup.ClusterEnabled,
    GlobalNodeGroups: [],
    ARN: globalRepGroupArnOf(ctx.region, ctx.account, globalId),
  };
  ctx.store.set(globalRepGroupKey(globalId), group);
  return { GlobalReplicationGroup: presentGlobalReplicationGroup(group) };
};

const DescribeGlobalReplicationGroups: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "GlobalReplicationGroupId");
  if (id !== undefined) {
    const group = requireGlobalReplicationGroup(ctx, id);
    return { GlobalReplicationGroups: [presentGlobalReplicationGroup(group)] };
  }
  const groups = ctx.store
    .list<StoredGlobalReplicationGroup>()
    .filter((entry) => entry.key.startsWith("globalrepgroup/"))
    .map((entry) => presentGlobalReplicationGroup(entry.value));
  return { GlobalReplicationGroups: groups };
};

const DeleteGlobalReplicationGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GlobalReplicationGroupId");
  const group = requireGlobalReplicationGroup(ctx, id);
  const presented = presentGlobalReplicationGroup(group);
  ctx.store.delete(globalRepGroupKey(id));
  return { GlobalReplicationGroup: { ...presented, Status: "deleting" } };
};

const DisassociateGlobalReplicationGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GlobalReplicationGroupId");
  const replicationGroupId = requireString(input, "ReplicationGroupId");
  const group = requireGlobalReplicationGroup(ctx, id);
  const updated: StoredGlobalReplicationGroup = {
    ...group,
    Members: group.Members.filter(
      (m) => m.ReplicationGroupId !== replicationGroupId,
    ),
  };
  ctx.store.set(globalRepGroupKey(id), updated);
  return { GlobalReplicationGroup: presentGlobalReplicationGroup(updated) };
};

const IncreaseNodeGroupsInGlobalReplicationGroup: OperationHandler = (
  input,
  ctx,
) => {
  const id = requireString(input, "GlobalReplicationGroupId");
  const group = requireGlobalReplicationGroup(ctx, id);
  return { GlobalReplicationGroup: presentGlobalReplicationGroup(group) };
};

const DecreaseNodeGroupsInGlobalReplicationGroup: OperationHandler = (
  input,
  ctx,
) => {
  const id = requireString(input, "GlobalReplicationGroupId");
  const group = requireGlobalReplicationGroup(ctx, id);
  return { GlobalReplicationGroup: presentGlobalReplicationGroup(group) };
};

const FailoverGlobalReplicationGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GlobalReplicationGroupId");
  const group = requireGlobalReplicationGroup(ctx, id);
  return { GlobalReplicationGroup: presentGlobalReplicationGroup(group) };
};

const RebalanceSlotsInGlobalReplicationGroup: OperationHandler = (
  input,
  ctx,
) => {
  const id = requireString(input, "GlobalReplicationGroupId");
  const group = requireGlobalReplicationGroup(ctx, id);
  return { GlobalReplicationGroup: presentGlobalReplicationGroup(group) };
};

const ModifyGlobalReplicationGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GlobalReplicationGroupId");
  const group = requireGlobalReplicationGroup(ctx, id);
  const updated: StoredGlobalReplicationGroup = {
    ...group,
    GlobalReplicationGroupDescription:
      optionalString(input, "GlobalReplicationGroupDescription") ??
      group.GlobalReplicationGroupDescription,
    CacheNodeType:
      optionalString(input, "CacheNodeType") ?? group.CacheNodeType,
    EngineVersion:
      optionalString(input, "EngineVersion") ?? group.EngineVersion,
  };
  ctx.store.set(globalRepGroupKey(id), updated);
  return { GlobalReplicationGroup: presentGlobalReplicationGroup(updated) };
};

const AddTagsToResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceName");
  const newTags = tagList(input);
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagKey(arn)) ?? [];
  const keySet = new Map(newTags.map((t) => [t.Key, t.Value]));
  const merged = [...existing.filter((t) => !keySet.has(t.Key)), ...newTags];
  ctx.store.set(tagKey(arn), merged);
  return { TagList: merged };
};

const RemoveTagsFromResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceName");
  const keys = stringList(input, "TagKeys");
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagKey(arn)) ?? [];
  const updated = existing.filter((t) => !keys.includes(t.Key));
  ctx.store.set(tagKey(arn), updated);
  return { TagList: updated };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceName");
  const tags =
    ctx.store.get<{ Key: string; Value: string }[]>(tagKey(arn)) ?? [];
  return { TagList: tags };
};

const DescribeCacheEngineVersions: OperationHandler = (_input, _ctx) => {
  return {
    CacheEngineVersions: [
      {
        Engine: "redis",
        EngineVersion: "7.0.7",
        CacheParameterGroupFamily: "redis7",
        CacheEngineDescription: "Redis",
        CacheEngineVersionDescription: "redis version 7.0.7",
      },
      {
        Engine: "redis",
        EngineVersion: "6.2.6",
        CacheParameterGroupFamily: "redis6.x",
        CacheEngineDescription: "Redis",
        CacheEngineVersionDescription: "redis version 6.2.6",
      },
      {
        Engine: "memcached",
        EngineVersion: "1.6.17",
        CacheParameterGroupFamily: "memcached1.6",
        CacheEngineDescription: "Memcached",
        CacheEngineVersionDescription: "memcached version 1.6.17",
      },
    ],
  };
};

const DescribeEvents: OperationHandler = (_input, _ctx) => {
  return { Events: [] };
};

const DescribeServiceUpdates: OperationHandler = (_input, _ctx) => {
  return { ServiceUpdates: [] };
};

const DescribeUpdateActions: OperationHandler = (_input, _ctx) => {
  return { UpdateActions: [] };
};

const DescribeReservedCacheNodes: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "ReservedCacheNodeId");
  const entries = ctx.store
    .list<StoredReservedCacheNode>()
    .filter((entry) => entry.key.startsWith("reservedcachenode/"));
  if (id !== undefined) {
    const found = entries.find((e) => e.value.ReservedCacheNodeId === id);
    if (found === undefined) {
      throw awsError(
        "ReservedCacheNodeNotFound",
        `ReservedCacheNode ${id} not found.`,
        404,
      );
    }
    return { ReservedCacheNodes: [found.value] };
  }
  return { ReservedCacheNodes: entries.map((e) => e.value) };
};

const DescribeReservedCacheNodesOfferings: OperationHandler = (
  _input,
  _ctx,
) => {
  return {
    ReservedCacheNodesOfferings: [
      {
        ReservedCacheNodesOfferingId: "bns-r7g-large-1yr-noupfront",
        CacheNodeType: "cache.r7g.large",
        Duration: 31536000,
        FixedPrice: 0.0,
        UsagePrice: 0.123,
        ProductDescription: "redis",
        OfferingType: "No Upfront",
        RecurringCharges: [],
      },
    ],
  };
};

const PurchaseReservedCacheNodesOffering: OperationHandler = (input, ctx) => {
  const offeringId = requireString(input, "ReservedCacheNodesOfferingId");
  const nodeId =
    optionalString(input, "ReservedCacheNodeId") ??
    `ri-${offeringId}-${Date.now()}`;
  const existing = ctx.store.get<StoredReservedCacheNode>(
    reservedCacheNodeKey(nodeId),
  );
  if (existing !== undefined) {
    throw awsError(
      "ReservedCacheNodeAlreadyExists",
      `ReservedCacheNode ${nodeId} already exists.`,
      400,
    );
  }
  const node: StoredReservedCacheNode = {
    ReservedCacheNodeId: nodeId,
    ReservedCacheNodesOfferingId: offeringId,
    CacheNodeType: "cache.r7g.large",
    StartTime: new Date().toISOString(),
    Duration: 31536000,
    FixedPrice: 0.0,
    UsagePrice: 0.123,
    CacheNodeCount: numberOr(input, "CacheNodeCount", 1),
    ProductDescription: "redis",
    OfferingType: "No Upfront",
    State: "active",
    ReservationARN: reservedCacheNodeArnOf(ctx.region, ctx.account, nodeId),
  };
  ctx.store.set(reservedCacheNodeKey(nodeId), node);
  return { ReservedCacheNode: node };
};

const ListAllowedNodeTypeModifications: OperationHandler = (_input, _ctx) => {
  return {
    ScaleUpModifications: [
      "cache.r7g.large",
      "cache.r7g.xlarge",
      "cache.r7g.2xlarge",
    ],
    ScaleDownModifications: [],
  };
};

const BatchApplyUpdateAction: OperationHandler = (_input, _ctx) => {
  return {
    ProcessedUpdateActions: [],
    UnprocessedUpdateActions: [],
  };
};

const BatchStopUpdateAction: OperationHandler = (_input, _ctx) => {
  return {
    ProcessedUpdateActions: [],
    UnprocessedUpdateActions: [],
  };
};

const elasticache: ServiceDefinition = {
  name: "elasticache",
  protocol: "query",
  operations: {
    AddTagsToResource,
    AuthorizeCacheSecurityGroupIngress,
    BatchApplyUpdateAction,
    BatchStopUpdateAction,
    CompleteMigration,
    CopyServerlessCacheSnapshot,
    CopySnapshot,
    CreateCacheCluster,
    CreateCacheParameterGroup,
    CreateCacheSecurityGroup,
    CreateCacheSubnetGroup,
    CreateGlobalReplicationGroup,
    CreateReplicationGroup,
    CreateServerlessCache,
    CreateServerlessCacheSnapshot,
    CreateSnapshot,
    CreateUser,
    CreateUserGroup,
    DecreaseNodeGroupsInGlobalReplicationGroup,
    DecreaseReplicaCount,
    DeleteCacheCluster,
    DeleteCacheParameterGroup,
    DeleteCacheSecurityGroup,
    DeleteCacheSubnetGroup,
    DeleteGlobalReplicationGroup,
    DeleteReplicationGroup,
    DeleteServerlessCache,
    DeleteServerlessCacheSnapshot,
    DeleteSnapshot,
    DeleteUser,
    DeleteUserGroup,
    DescribeCacheClusters,
    DescribeCacheEngineVersions,
    DescribeCacheParameterGroups,
    DescribeCacheParameters,
    DescribeCacheSecurityGroups,
    DescribeCacheSubnetGroups,
    DescribeEngineDefaultParameters,
    DescribeEvents,
    DescribeGlobalReplicationGroups,
    DescribeReplicationGroups,
    DescribeReservedCacheNodes,
    DescribeReservedCacheNodesOfferings,
    DescribeServerlessCacheSnapshots,
    DescribeServerlessCaches,
    DescribeServiceUpdates,
    DescribeSnapshots,
    DescribeUpdateActions,
    DescribeUserGroups,
    DescribeUsers,
    DisassociateGlobalReplicationGroup,
    ExportServerlessCacheSnapshot,
    FailoverGlobalReplicationGroup,
    IncreaseNodeGroupsInGlobalReplicationGroup,
    IncreaseReplicaCount,
    ListAllowedNodeTypeModifications,
    ListTagsForResource,
    ModifyCacheCluster,
    ModifyCacheParameterGroup,
    ModifyCacheSubnetGroup,
    ModifyGlobalReplicationGroup,
    ModifyReplicationGroup,
    ModifyReplicationGroupShardConfiguration,
    ModifyServerlessCache,
    ModifyUser,
    ModifyUserGroup,
    PurchaseReservedCacheNodesOffering,
    RebalanceSlotsInGlobalReplicationGroup,
    RebootCacheCluster,
    RemoveTagsFromResource,
    ResetCacheParameterGroup,
    RevokeCacheSecurityGroupIngress,
    StartMigration,
    TestFailover,
    TestMigration,
  },
  model,
} as const;

export default elasticache;
