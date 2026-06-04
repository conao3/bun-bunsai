import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import rdsModel from "../../../../test/vendor/aws-models/rds.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(rdsModel);

type StoredEndpoint = {
  Address: string;
  Port: number;
  HostedZoneId: string;
};

type StoredDBInstance = {
  DBInstanceIdentifier: string;
  DBInstanceClass: string;
  Engine: string;
  DBInstanceStatus: string;
  MasterUsername: string | undefined;
  DBName: string | undefined;
  Endpoint: StoredEndpoint;
  AllocatedStorage: number;
  InstanceCreateTime: string;
  EngineVersion: string | undefined;
  MultiAZ: boolean;
  PubliclyAccessible: boolean;
  StorageType: string;
  AvailabilityZone: string;
  DBInstanceArn: string;
  DbiResourceId: string;
};

type StoredDBSnapshot = {
  DBSnapshotIdentifier: string;
  DBInstanceIdentifier: string;
  Engine: string;
  AllocatedStorage: number;
  Status: string;
  Port: number;
  AvailabilityZone: string;
  InstanceCreateTime: string;
  SnapshotCreateTime: string;
  MasterUsername: string | undefined;
  EngineVersion: string | undefined;
  SnapshotType: string;
  StorageType: string;
  DBSnapshotArn: string;
  DbiResourceId: string;
  PercentProgress: number;
};

type StoredDBParameterGroup = {
  DBParameterGroupName: string;
  DBParameterGroupFamily: string;
  Description: string;
  DBParameterGroupArn: string;
};

type StoredDBSubnetGroup = {
  DBSubnetGroupName: string;
  DBSubnetGroupDescription: string;
  VpcId: string;
  SubnetGroupStatus: string;
  Subnets: { SubnetIdentifier: string; SubnetStatus: string }[];
  DBSubnetGroupArn: string;
};

type StoredDBCluster = {
  DBClusterIdentifier: string;
  Engine: string;
  Status: string;
  MasterUsername: string | undefined;
  DatabaseName: string | undefined;
  Endpoint: string;
  ReaderEndpoint: string;
  Port: number;
  EngineVersion: string | undefined;
  MultiAZ: boolean;
  DBClusterArn: string;
  DbClusterResourceId: string;
  StorageEncrypted: boolean;
  ClusterCreateTime: string;
  AvailabilityZones: string[];
  StorageType: string;
  AllocatedStorage: number;
  BackupRetentionPeriod: number;
};

type StoredDBClusterParameterGroup = {
  DBClusterParameterGroupName: string;
  DBParameterGroupFamily: string;
  Description: string;
  DBClusterParameterGroupArn: string;
};

type StoredDBClusterSnapshot = {
  DBClusterSnapshotIdentifier: string;
  DBClusterIdentifier: string;
  Engine: string;
  AllocatedStorage: number;
  Status: string;
  Port: number;
  VpcId: string;
  SnapshotCreateTime: string;
  MasterUsername: string | undefined;
  EngineVersion: string | undefined;
  SnapshotType: string;
  StorageEncrypted: boolean;
  DBClusterSnapshotArn: string;
  ClusterCreateTime: string;
  PercentProgress: number;
};

type StoredDBClusterEndpoint = {
  DBClusterEndpointIdentifier: string;
  DBClusterIdentifier: string;
  DBClusterEndpointResourceIdentifier: string;
  Endpoint: string;
  Status: string;
  EndpointType: string;
  CustomEndpointType: string | undefined;
  StaticMembers: string[];
  ExcludedMembers: string[];
  DBClusterEndpointArn: string;
};

type StoredDBSecurityGroup = {
  OwnerId: string;
  DBSecurityGroupName: string;
  DBSecurityGroupDescription: string;
  VpcId: string | undefined;
  EC2SecurityGroups: {
    Status: string;
    EC2SecurityGroupName: string;
    EC2SecurityGroupOwnerId: string;
  }[];
  IPRanges: { Status: string; CIDRIP: string }[];
  DBSecurityGroupArn: string;
};

const instanceKey = (id: string): string => `instance/${id}`;
const snapshotKey = (id: string): string => `snapshot/${id}`;
const parameterGroupKey = (id: string): string => `parametergroup/${id}`;
const subnetGroupKey = (id: string): string => `subnetgroup/${id}`;
const clusterKey = (id: string): string => `cluster/${id}`;
const clusterParamGroupKey = (id: string): string =>
  `clusterparametergroup/${id}`;
const clusterSnapshotKey = (id: string): string => `clustersnapshot/${id}`;
const clusterEndpointKey = (id: string): string => `clusterendpoint/${id}`;
const securityGroupKey = (id: string): string => `securitygroup/${id}`;
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
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
};

const requireInstance = (ctx: ServiceContext, id: string): StoredDBInstance => {
  const instance = ctx.store.get<StoredDBInstance>(instanceKey(id));
  if (instance === undefined) {
    throw awsError("DBInstanceNotFound", `DBInstance ${id} not found.`, 404);
  }
  return instance;
};

const requireCluster = (ctx: ServiceContext, id: string): StoredDBCluster => {
  const cluster = ctx.store.get<StoredDBCluster>(clusterKey(id));
  if (cluster === undefined) {
    throw awsError("DBClusterNotFoundFault", `DBCluster ${id} not found.`, 404);
  }
  return cluster;
};

const requireClusterSnapshot = (
  ctx: ServiceContext,
  id: string,
): StoredDBClusterSnapshot => {
  const snapshot = ctx.store.get<StoredDBClusterSnapshot>(
    clusterSnapshotKey(id),
  );
  if (snapshot === undefined) {
    throw awsError(
      "DBClusterSnapshotNotFoundFault",
      `DBClusterSnapshot ${id} not found.`,
      404,
    );
  }
  return snapshot;
};

const requireClusterParamGroup = (
  ctx: ServiceContext,
  name: string,
): StoredDBClusterParameterGroup => {
  const group = ctx.store.get<StoredDBClusterParameterGroup>(
    clusterParamGroupKey(name),
  );
  if (group === undefined) {
    throw awsError(
      "DBParameterGroupNotFound",
      `DBClusterParameterGroup ${name} not found.`,
      404,
    );
  }
  return group;
};

const requireSecurityGroup = (
  ctx: ServiceContext,
  name: string,
): StoredDBSecurityGroup => {
  const sg = ctx.store.get<StoredDBSecurityGroup>(securityGroupKey(name));
  if (sg === undefined) {
    throw awsError(
      "DBSecurityGroupNotFound",
      `DBSecurityGroup ${name} not found.`,
      404,
    );
  }
  return sg;
};

const instanceArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:rds:${region}:${account}:db:${id}`;

const snapshotArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:rds:${region}:${account}:snapshot:${id}`;

const parameterGroupArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:rds:${region}:${account}:pg:${id}`;

const subnetGroupArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:rds:${region}:${account}:subgrp:${id}`;

const clusterArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:rds:${region}:${account}:cluster:${id}`;

const clusterParamGroupArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:rds:${region}:${account}:cluster-pg:${id}`;

const clusterSnapshotArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:rds:${region}:${account}:cluster-snapshot:${id}`;

const clusterEndpointArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:rds:${region}:${account}:cluster-endpoint:${id}`;

const securityGroupArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:rds:${region}:${account}:secgrp:${id}`;

const presentInstance = (instance: StoredDBInstance) => ({
  DBInstanceIdentifier: instance.DBInstanceIdentifier,
  DBInstanceClass: instance.DBInstanceClass,
  Engine: instance.Engine,
  DBInstanceStatus: instance.DBInstanceStatus,
  MasterUsername: instance.MasterUsername,
  DBName: instance.DBName,
  Endpoint: {
    Address: instance.Endpoint.Address,
    Port: instance.Endpoint.Port,
    HostedZoneId: instance.Endpoint.HostedZoneId,
  },
  AllocatedStorage: instance.AllocatedStorage,
  InstanceCreateTime: instance.InstanceCreateTime,
  EngineVersion: instance.EngineVersion,
  MultiAZ: instance.MultiAZ,
  PubliclyAccessible: instance.PubliclyAccessible,
  StorageType: instance.StorageType,
  AvailabilityZone: instance.AvailabilityZone,
  DBInstanceArn: instance.DBInstanceArn,
  DbiResourceId: instance.DbiResourceId,
});

const presentSnapshot = (snapshot: StoredDBSnapshot) => ({
  DBSnapshotIdentifier: snapshot.DBSnapshotIdentifier,
  DBInstanceIdentifier: snapshot.DBInstanceIdentifier,
  Engine: snapshot.Engine,
  AllocatedStorage: snapshot.AllocatedStorage,
  Status: snapshot.Status,
  Port: snapshot.Port,
  AvailabilityZone: snapshot.AvailabilityZone,
  InstanceCreateTime: snapshot.InstanceCreateTime,
  SnapshotCreateTime: snapshot.SnapshotCreateTime,
  MasterUsername: snapshot.MasterUsername,
  EngineVersion: snapshot.EngineVersion,
  SnapshotType: snapshot.SnapshotType,
  StorageType: snapshot.StorageType,
  DBSnapshotArn: snapshot.DBSnapshotArn,
  DbiResourceId: snapshot.DbiResourceId,
  PercentProgress: snapshot.PercentProgress,
});

const presentParameterGroup = (group: StoredDBParameterGroup) => ({
  DBParameterGroupName: group.DBParameterGroupName,
  DBParameterGroupFamily: group.DBParameterGroupFamily,
  Description: group.Description,
  DBParameterGroupArn: group.DBParameterGroupArn,
});

const presentSubnetGroup = (group: StoredDBSubnetGroup) => ({
  DBSubnetGroupName: group.DBSubnetGroupName,
  DBSubnetGroupDescription: group.DBSubnetGroupDescription,
  VpcId: group.VpcId,
  SubnetGroupStatus: group.SubnetGroupStatus,
  Subnets: group.Subnets.map((subnet) => ({
    SubnetIdentifier: subnet.SubnetIdentifier,
    SubnetStatus: subnet.SubnetStatus,
  })),
  DBSubnetGroupArn: group.DBSubnetGroupArn,
});

const presentCluster = (cluster: StoredDBCluster) => ({
  DBClusterIdentifier: cluster.DBClusterIdentifier,
  Engine: cluster.Engine,
  Status: cluster.Status,
  MasterUsername: cluster.MasterUsername,
  DatabaseName: cluster.DatabaseName,
  Endpoint: cluster.Endpoint,
  ReaderEndpoint: cluster.ReaderEndpoint,
  Port: cluster.Port,
  EngineVersion: cluster.EngineVersion,
  MultiAZ: cluster.MultiAZ,
  DBClusterArn: cluster.DBClusterArn,
  DbClusterResourceId: cluster.DbClusterResourceId,
  StorageEncrypted: cluster.StorageEncrypted,
  ClusterCreateTime: cluster.ClusterCreateTime,
  AvailabilityZones: cluster.AvailabilityZones,
  StorageType: cluster.StorageType,
  AllocatedStorage: cluster.AllocatedStorage,
  BackupRetentionPeriod: cluster.BackupRetentionPeriod,
});

const presentClusterParamGroup = (group: StoredDBClusterParameterGroup) => ({
  DBClusterParameterGroupName: group.DBClusterParameterGroupName,
  DBParameterGroupFamily: group.DBParameterGroupFamily,
  Description: group.Description,
  DBClusterParameterGroupArn: group.DBClusterParameterGroupArn,
});

const presentClusterSnapshot = (snapshot: StoredDBClusterSnapshot) => ({
  DBClusterSnapshotIdentifier: snapshot.DBClusterSnapshotIdentifier,
  DBClusterIdentifier: snapshot.DBClusterIdentifier,
  Engine: snapshot.Engine,
  AllocatedStorage: snapshot.AllocatedStorage,
  Status: snapshot.Status,
  Port: snapshot.Port,
  VpcId: snapshot.VpcId,
  SnapshotCreateTime: snapshot.SnapshotCreateTime,
  MasterUsername: snapshot.MasterUsername,
  EngineVersion: snapshot.EngineVersion,
  SnapshotType: snapshot.SnapshotType,
  StorageEncrypted: snapshot.StorageEncrypted,
  DBClusterSnapshotArn: snapshot.DBClusterSnapshotArn,
  ClusterCreateTime: snapshot.ClusterCreateTime,
  PercentProgress: snapshot.PercentProgress,
});

const presentClusterEndpoint = (ep: StoredDBClusterEndpoint) => ({
  DBClusterEndpointIdentifier: ep.DBClusterEndpointIdentifier,
  DBClusterIdentifier: ep.DBClusterIdentifier,
  DBClusterEndpointResourceIdentifier: ep.DBClusterEndpointResourceIdentifier,
  Endpoint: ep.Endpoint,
  Status: ep.Status,
  EndpointType: ep.EndpointType,
  CustomEndpointType: ep.CustomEndpointType,
  StaticMembers: ep.StaticMembers,
  ExcludedMembers: ep.ExcludedMembers,
  DBClusterEndpointArn: ep.DBClusterEndpointArn,
});

const presentSecurityGroup = (sg: StoredDBSecurityGroup) => ({
  OwnerId: sg.OwnerId,
  DBSecurityGroupName: sg.DBSecurityGroupName,
  DBSecurityGroupDescription: sg.DBSecurityGroupDescription,
  VpcId: sg.VpcId,
  EC2SecurityGroups: sg.EC2SecurityGroups,
  IPRanges: sg.IPRanges,
  DBSecurityGroupArn: sg.DBSecurityGroupArn,
});

const getTags = (
  ctx: ServiceContext,
  arn: string,
): { Key: string; Value: string }[] => {
  const tags = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  return Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));
};

const setTags = (
  ctx: ServiceContext,
  arn: string,
  tagList: { Key: string; Value: string }[],
): void => {
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  for (const tag of tagList) {
    existing[tag.Key] = tag.Value;
  }
  ctx.store.set(tagsKey(arn), existing);
};

const removeTags = (
  ctx: ServiceContext,
  arn: string,
  tagKeys: string[],
): void => {
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  for (const key of tagKeys) {
    delete existing[key];
  }
  ctx.store.set(tagsKey(arn), existing);
};

const newInstanceFromParams = (
  ctx: ServiceContext,
  id: string,
  input: Record<string, unknown>,
  engine: string,
): StoredDBInstance => {
  const availabilityZone =
    optionalString(input, "AvailabilityZone") ?? `${ctx.region}a`;
  return {
    DBInstanceIdentifier: id,
    DBInstanceClass: requireString(input, "DBInstanceClass"),
    Engine: engine,
    DBInstanceStatus: "available",
    MasterUsername: optionalString(input, "MasterUsername"),
    DBName: optionalString(input, "DBName"),
    Endpoint: {
      Address: `${id}.bunsai.${ctx.region}.rds.amazonaws.com`,
      Port: numberOr(input, "Port", 3306),
      HostedZoneId: "Z1BUNSAIRDS000",
    },
    AllocatedStorage: numberOr(input, "AllocatedStorage", 20),
    InstanceCreateTime: new Date().toISOString(),
    EngineVersion: optionalString(input, "EngineVersion"),
    MultiAZ: booleanOr(input, "MultiAZ", false),
    PubliclyAccessible: booleanOr(input, "PubliclyAccessible", false),
    StorageType: optionalString(input, "StorageType") ?? "gp2",
    AvailabilityZone: availabilityZone,
    DBInstanceArn: instanceArnOf(ctx.region, ctx.account, id),
    DbiResourceId: `db-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`,
  };
};

const CreateDBInstance: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  const existing = ctx.store.get<StoredDBInstance>(instanceKey(id));
  if (existing !== undefined) {
    throw awsError(
      "DBInstanceAlreadyExists",
      `DBInstance ${id} already exists.`,
      400,
    );
  }
  const engine = requireString(input, "Engine");
  const instance = newInstanceFromParams(ctx, id, input, engine);
  ctx.store.set(instanceKey(id), instance);
  return { DBInstance: presentInstance(instance) };
};

const DescribeDBInstances: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "DBInstanceIdentifier");
  if (id !== undefined) {
    const instance = requireInstance(ctx, id);
    return { DBInstances: [presentInstance(instance)] };
  }
  const instances = ctx.store
    .list<StoredDBInstance>()
    .filter((entry) => entry.key.startsWith("instance/"))
    .map((entry) => presentInstance(entry.value));
  return { DBInstances: instances };
};

const DeleteDBInstance: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  const instance = requireInstance(ctx, id);
  const skipFinalSnapshot = booleanOr(input, "SkipFinalSnapshot", false);
  const finalSnapshotId = optionalString(input, "FinalDBSnapshotIdentifier");
  if (!skipFinalSnapshot && finalSnapshotId !== undefined) {
    const snapshot: StoredDBSnapshot = {
      DBSnapshotIdentifier: finalSnapshotId,
      DBInstanceIdentifier: id,
      Engine: instance.Engine,
      AllocatedStorage: instance.AllocatedStorage,
      Status: "available",
      Port: instance.Endpoint.Port,
      AvailabilityZone: instance.AvailabilityZone,
      InstanceCreateTime: instance.InstanceCreateTime,
      SnapshotCreateTime: new Date().toISOString(),
      MasterUsername: instance.MasterUsername,
      EngineVersion: instance.EngineVersion,
      SnapshotType: "manual",
      StorageType: instance.StorageType,
      DBSnapshotArn: snapshotArnOf(ctx.region, ctx.account, finalSnapshotId),
      DbiResourceId: instance.DbiResourceId,
      PercentProgress: 100,
    };
    ctx.store.set(snapshotKey(finalSnapshotId), snapshot);
  }
  const presented = presentInstance(instance);
  ctx.store.delete(instanceKey(id));
  return { DBInstance: { ...presented, DBInstanceStatus: "deleting" } };
};

const StartDBInstance: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  const instance = requireInstance(ctx, id);
  instance.DBInstanceStatus = "available";
  ctx.store.set(instanceKey(id), instance);
  return { DBInstance: presentInstance(instance) };
};

const StopDBInstance: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  const instance = requireInstance(ctx, id);
  instance.DBInstanceStatus = "stopped";
  ctx.store.set(instanceKey(id), instance);
  return { DBInstance: presentInstance(instance) };
};

const CreateDBSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "DBSnapshotIdentifier");
  const instanceId = requireString(input, "DBInstanceIdentifier");
  const instance = requireInstance(ctx, instanceId);
  const existing = ctx.store.get<StoredDBSnapshot>(snapshotKey(snapshotId));
  if (existing !== undefined) {
    throw awsError(
      "DBSnapshotAlreadyExists",
      `DBSnapshot ${snapshotId} already exists.`,
      400,
    );
  }
  const snapshot: StoredDBSnapshot = {
    DBSnapshotIdentifier: snapshotId,
    DBInstanceIdentifier: instanceId,
    Engine: instance.Engine,
    AllocatedStorage: instance.AllocatedStorage,
    Status: "available",
    Port: instance.Endpoint.Port,
    AvailabilityZone: instance.AvailabilityZone,
    InstanceCreateTime: instance.InstanceCreateTime,
    SnapshotCreateTime: new Date().toISOString(),
    MasterUsername: instance.MasterUsername,
    EngineVersion: instance.EngineVersion,
    SnapshotType: "manual",
    StorageType: instance.StorageType,
    DBSnapshotArn: snapshotArnOf(ctx.region, ctx.account, snapshotId),
    DbiResourceId: instance.DbiResourceId,
    PercentProgress: 100,
  };
  ctx.store.set(snapshotKey(snapshotId), snapshot);
  return { DBSnapshot: presentSnapshot(snapshot) };
};

const DescribeDBSnapshots: OperationHandler = (input, ctx) => {
  const snapshotId = optionalString(input, "DBSnapshotIdentifier");
  const instanceId = optionalString(input, "DBInstanceIdentifier");
  if (snapshotId !== undefined) {
    const snapshot = ctx.store.get<StoredDBSnapshot>(snapshotKey(snapshotId));
    if (snapshot === undefined) {
      throw awsError(
        "DBSnapshotNotFound",
        `DBSnapshot ${snapshotId} not found.`,
        404,
      );
    }
    return { DBSnapshots: [presentSnapshot(snapshot)] };
  }
  const snapshots = ctx.store
    .list<StoredDBSnapshot>()
    .filter((entry) => entry.key.startsWith("snapshot/"))
    .filter((entry) =>
      instanceId !== undefined
        ? entry.value.DBInstanceIdentifier === instanceId
        : true,
    )
    .map((entry) => presentSnapshot(entry.value));
  return { DBSnapshots: snapshots };
};

const CreateDBParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBParameterGroupName");
  const existing = ctx.store.get<StoredDBParameterGroup>(
    parameterGroupKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "DBParameterGroupAlreadyExists",
      `DBParameterGroup ${name} already exists.`,
      400,
    );
  }
  const group: StoredDBParameterGroup = {
    DBParameterGroupName: name,
    DBParameterGroupFamily: requireString(input, "DBParameterGroupFamily"),
    Description: requireString(input, "Description"),
    DBParameterGroupArn: parameterGroupArnOf(ctx.region, ctx.account, name),
  };
  ctx.store.set(parameterGroupKey(name), group);
  return { DBParameterGroup: presentParameterGroup(group) };
};

const DescribeDBParameterGroups: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "DBParameterGroupName");
  if (name !== undefined) {
    const group = ctx.store.get<StoredDBParameterGroup>(
      parameterGroupKey(name),
    );
    if (group === undefined) {
      throw awsError(
        "DBParameterGroupNotFound",
        `DBParameterGroup ${name} not found.`,
        404,
      );
    }
    return { DBParameterGroups: [presentParameterGroup(group)] };
  }
  const groups = ctx.store
    .list<StoredDBParameterGroup>()
    .filter((entry) => entry.key.startsWith("parametergroup/"))
    .map((entry) => presentParameterGroup(entry.value));
  return { DBParameterGroups: groups };
};

const DeleteDBParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBParameterGroupName");
  const group = ctx.store.get<StoredDBParameterGroup>(parameterGroupKey(name));
  if (group === undefined) {
    throw awsError(
      "DBParameterGroupNotFound",
      `DBParameterGroup ${name} not found.`,
      404,
    );
  }
  ctx.store.delete(parameterGroupKey(name));
  return {};
};

const CreateDBSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBSubnetGroupName");
  const existing = ctx.store.get<StoredDBSubnetGroup>(subnetGroupKey(name));
  if (existing !== undefined) {
    throw awsError(
      "DBSubnetGroupAlreadyExists",
      `DBSubnetGroup ${name} already exists.`,
      400,
    );
  }
  const subnetIds = stringList(input, "SubnetIds");
  const group: StoredDBSubnetGroup = {
    DBSubnetGroupName: name,
    DBSubnetGroupDescription: requireString(input, "DBSubnetGroupDescription"),
    VpcId: optionalString(input, "VpcId") ?? "vpc-bunsai00000000000",
    SubnetGroupStatus: "Complete",
    Subnets: subnetIds.map((subnetId) => ({
      SubnetIdentifier: subnetId,
      SubnetStatus: "Active",
    })),
    DBSubnetGroupArn: subnetGroupArnOf(ctx.region, ctx.account, name),
  };
  ctx.store.set(subnetGroupKey(name), group);
  return { DBSubnetGroup: presentSubnetGroup(group) };
};

const DescribeDBSubnetGroups: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "DBSubnetGroupName");
  if (name !== undefined) {
    const group = ctx.store.get<StoredDBSubnetGroup>(subnetGroupKey(name));
    if (group === undefined) {
      throw awsError(
        "DBSubnetGroupNotFoundFault",
        `DBSubnetGroup ${name} not found.`,
        404,
      );
    }
    return { DBSubnetGroups: [presentSubnetGroup(group)] };
  }
  const groups = ctx.store
    .list<StoredDBSubnetGroup>()
    .filter((entry) => entry.key.startsWith("subnetgroup/"))
    .map((entry) => presentSubnetGroup(entry.value));
  return { DBSubnetGroups: groups };
};

const DeleteDBSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBSubnetGroupName");
  const group = ctx.store.get<StoredDBSubnetGroup>(subnetGroupKey(name));
  if (group === undefined) {
    throw awsError(
      "DBSubnetGroupNotFoundFault",
      `DBSubnetGroup ${name} not found.`,
      404,
    );
  }
  ctx.store.delete(subnetGroupKey(name));
  return {};
};

const RebootDBInstance: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  const instance = requireInstance(ctx, id);
  instance.DBInstanceStatus = "available";
  ctx.store.set(instanceKey(id), instance);
  return { DBInstance: presentInstance(instance) };
};

const AddRoleToDBCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  requireCluster(ctx, id);
  requireString(input, "RoleArn");
  return {};
};

const AddRoleToDBInstance: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  requireInstance(ctx, id);
  requireString(input, "RoleArn");
  requireString(input, "FeatureName");
  return {};
};

const AddTagsToResource: OperationHandler = (input, ctx) => {
  const resourceName = requireString(input, "ResourceName");
  const rawTags = input["Tags"];
  const tagList: { Key: string; Value: string }[] = Array.isArray(rawTags)
    ? rawTags.filter(
        (t): t is { Key: string; Value: string } =>
          typeof t === "object" && t !== null && "Key" in t && "Value" in t,
      )
    : [];
  setTags(ctx, resourceName, tagList);
  return {};
};

const ApplyPendingMaintenanceAction: OperationHandler = (input, ctx) => {
  const resourceIdentifier = requireString(input, "ResourceIdentifier");
  requireString(input, "ApplyAction");
  requireString(input, "OptInType");
  return {
    ResourcePendingMaintenanceActions: {
      ResourceIdentifier: resourceIdentifier,
      PendingMaintenanceActionDetails: [],
    },
  };
};

const AuthorizeDBSecurityGroupIngress: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBSecurityGroupName");
  const sg = requireSecurityGroup(ctx, name);
  const cidr = optionalString(input, "CIDRIP");
  if (cidr !== undefined) {
    sg.IPRanges.push({ Status: "authorizing", CIDRIP: cidr });
    ctx.store.set(securityGroupKey(name), sg);
  }
  return { DBSecurityGroup: presentSecurityGroup(sg) };
};

const BacktrackDBCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  requireCluster(ctx, id);
  const backtrackTo = requireString(input, "BacktrackTo");
  return {
    DBClusterIdentifier: id,
    BacktrackIdentifier: crypto.randomUUID(),
    BacktrackTo: backtrackTo,
    BacktrackedFrom: new Date().toISOString(),
    BacktrackRequestCreationTime: new Date().toISOString(),
    Status: "applying",
  };
};

const CopyDBClusterParameterGroup: OperationHandler = (input, ctx) => {
  const srcId = requireString(input, "SourceDBClusterParameterGroupIdentifier");
  const tgtId = requireString(input, "TargetDBClusterParameterGroupIdentifier");
  const tgtDesc = requireString(
    input,
    "TargetDBClusterParameterGroupDescription",
  );
  const src = requireClusterParamGroup(ctx, srcId);
  const existing = ctx.store.get<StoredDBClusterParameterGroup>(
    clusterParamGroupKey(tgtId),
  );
  if (existing !== undefined) {
    throw awsError(
      "DBParameterGroupAlreadyExists",
      `DBClusterParameterGroup ${tgtId} already exists.`,
      400,
    );
  }
  const group: StoredDBClusterParameterGroup = {
    DBClusterParameterGroupName: tgtId,
    DBParameterGroupFamily: src.DBParameterGroupFamily,
    Description: tgtDesc,
    DBClusterParameterGroupArn: clusterParamGroupArnOf(
      ctx.region,
      ctx.account,
      tgtId,
    ),
  };
  ctx.store.set(clusterParamGroupKey(tgtId), group);
  return { DBClusterParameterGroup: presentClusterParamGroup(group) };
};

const CopyDBClusterSnapshot: OperationHandler = (input, ctx) => {
  const srcId = requireString(input, "SourceDBClusterSnapshotIdentifier");
  const tgtId = requireString(input, "TargetDBClusterSnapshotIdentifier");
  const src = requireClusterSnapshot(ctx, srcId);
  const existing = ctx.store.get<StoredDBClusterSnapshot>(
    clusterSnapshotKey(tgtId),
  );
  if (existing !== undefined) {
    throw awsError(
      "DBClusterSnapshotAlreadyExistsFault",
      `DBClusterSnapshot ${tgtId} already exists.`,
      400,
    );
  }
  const copy: StoredDBClusterSnapshot = {
    ...src,
    DBClusterSnapshotIdentifier: tgtId,
    DBClusterSnapshotArn: clusterSnapshotArnOf(ctx.region, ctx.account, tgtId),
    SnapshotCreateTime: new Date().toISOString(),
  };
  ctx.store.set(clusterSnapshotKey(tgtId), copy);
  return { DBClusterSnapshot: presentClusterSnapshot(copy) };
};

const CopyDBParameterGroup: OperationHandler = (input, ctx) => {
  const srcId = requireString(input, "SourceDBParameterGroupIdentifier");
  const tgtId = requireString(input, "TargetDBParameterGroupIdentifier");
  const tgtDesc = requireString(input, "TargetDBParameterGroupDescription");
  const src = ctx.store.get<StoredDBParameterGroup>(parameterGroupKey(srcId));
  if (src === undefined) {
    throw awsError(
      "DBParameterGroupNotFound",
      `DBParameterGroup ${srcId} not found.`,
      404,
    );
  }
  const existing = ctx.store.get<StoredDBParameterGroup>(
    parameterGroupKey(tgtId),
  );
  if (existing !== undefined) {
    throw awsError(
      "DBParameterGroupAlreadyExists",
      `DBParameterGroup ${tgtId} already exists.`,
      400,
    );
  }
  const group: StoredDBParameterGroup = {
    DBParameterGroupName: tgtId,
    DBParameterGroupFamily: src.DBParameterGroupFamily,
    Description: tgtDesc,
    DBParameterGroupArn: parameterGroupArnOf(ctx.region, ctx.account, tgtId),
  };
  ctx.store.set(parameterGroupKey(tgtId), group);
  return { DBParameterGroup: presentParameterGroup(group) };
};

const CopyDBSnapshot: OperationHandler = (input, ctx) => {
  const srcId = requireString(input, "SourceDBSnapshotIdentifier");
  const tgtId = requireString(input, "TargetDBSnapshotIdentifier");
  const src = ctx.store.get<StoredDBSnapshot>(snapshotKey(srcId));
  if (src === undefined) {
    throw awsError("DBSnapshotNotFound", `DBSnapshot ${srcId} not found.`, 404);
  }
  const existing = ctx.store.get<StoredDBSnapshot>(snapshotKey(tgtId));
  if (existing !== undefined) {
    throw awsError(
      "DBSnapshotAlreadyExists",
      `DBSnapshot ${tgtId} already exists.`,
      400,
    );
  }
  const copy: StoredDBSnapshot = {
    ...src,
    DBSnapshotIdentifier: tgtId,
    DBSnapshotArn: snapshotArnOf(ctx.region, ctx.account, tgtId),
    SnapshotCreateTime: new Date().toISOString(),
  };
  ctx.store.set(snapshotKey(tgtId), copy);
  return { DBSnapshot: presentSnapshot(copy) };
};

const CreateDBCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  const existing = ctx.store.get<StoredDBCluster>(clusterKey(id));
  if (existing !== undefined) {
    throw awsError(
      "DBClusterAlreadyExistsFault",
      `DBCluster ${id} already exists.`,
      400,
    );
  }
  const engine = requireString(input, "Engine");
  const cluster: StoredDBCluster = {
    DBClusterIdentifier: id,
    Engine: engine,
    Status: "available",
    MasterUsername: optionalString(input, "MasterUsername"),
    DatabaseName: optionalString(input, "DatabaseName"),
    Endpoint: `${id}.cluster.${ctx.region}.rds.amazonaws.com`,
    ReaderEndpoint: `${id}.cluster-ro.${ctx.region}.rds.amazonaws.com`,
    Port: numberOr(input, "Port", 3306),
    EngineVersion: optionalString(input, "EngineVersion"),
    MultiAZ: false,
    DBClusterArn: clusterArnOf(ctx.region, ctx.account, id),
    DbClusterResourceId: `cluster-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`,
    StorageEncrypted: booleanOr(input, "StorageEncrypted", false),
    ClusterCreateTime: new Date().toISOString(),
    AvailabilityZones:
      stringList(input, "AvailabilityZones").length > 0
        ? stringList(input, "AvailabilityZones")
        : [`${ctx.region}a`, `${ctx.region}b`, `${ctx.region}c`],
    StorageType: optionalString(input, "StorageType") ?? "aurora",
    AllocatedStorage: numberOr(input, "AllocatedStorage", 1),
    BackupRetentionPeriod: numberOr(input, "BackupRetentionPeriod", 1),
  };
  ctx.store.set(clusterKey(id), cluster);
  return { DBCluster: presentCluster(cluster) };
};

const DescribeDBClusters: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "DBClusterIdentifier");
  if (id !== undefined) {
    const cluster = requireCluster(ctx, id);
    return { DBClusters: [presentCluster(cluster)] };
  }
  const clusters = ctx.store
    .list<StoredDBCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => presentCluster(entry.value));
  return { DBClusters: clusters };
};

const DeleteDBCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  const skipFinalSnapshot = booleanOr(input, "SkipFinalSnapshot", false);
  const finalSnapshotId = optionalString(input, "FinalDBSnapshotIdentifier");
  if (!skipFinalSnapshot && finalSnapshotId !== undefined) {
    const snapshot: StoredDBClusterSnapshot = {
      DBClusterSnapshotIdentifier: finalSnapshotId,
      DBClusterIdentifier: id,
      Engine: cluster.Engine,
      AllocatedStorage: cluster.AllocatedStorage,
      Status: "available",
      Port: cluster.Port,
      VpcId: "vpc-bunsai00000000000",
      SnapshotCreateTime: new Date().toISOString(),
      MasterUsername: cluster.MasterUsername,
      EngineVersion: cluster.EngineVersion,
      SnapshotType: "manual",
      StorageEncrypted: cluster.StorageEncrypted,
      DBClusterSnapshotArn: clusterSnapshotArnOf(
        ctx.region,
        ctx.account,
        finalSnapshotId,
      ),
      ClusterCreateTime: cluster.ClusterCreateTime,
      PercentProgress: 100,
    };
    ctx.store.set(clusterSnapshotKey(finalSnapshotId), snapshot);
  }
  const presented = presentCluster(cluster);
  ctx.store.delete(clusterKey(id));
  return { DBCluster: { ...presented, Status: "deleting" } };
};

const CreateDBClusterEndpoint: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "DBClusterIdentifier");
  const endpointId = requireString(input, "DBClusterEndpointIdentifier");
  requireCluster(ctx, clusterId);
  const existing = ctx.store.get<StoredDBClusterEndpoint>(
    clusterEndpointKey(endpointId),
  );
  if (existing !== undefined) {
    throw awsError(
      "DBClusterEndpointAlreadyExistsFault",
      `DBClusterEndpoint ${endpointId} already exists.`,
      400,
    );
  }
  const endpointType = requireString(input, "EndpointType");
  const ep: StoredDBClusterEndpoint = {
    DBClusterEndpointIdentifier: endpointId,
    DBClusterIdentifier: clusterId,
    DBClusterEndpointResourceIdentifier: `cluster-endpoint-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`,
    Endpoint: `${endpointId}.cluster-custom.${ctx.region}.rds.amazonaws.com`,
    Status: "available",
    EndpointType: "CUSTOM",
    CustomEndpointType: endpointType,
    StaticMembers: stringList(input, "StaticMembers"),
    ExcludedMembers: stringList(input, "ExcludedMembers"),
    DBClusterEndpointArn: clusterEndpointArnOf(
      ctx.region,
      ctx.account,
      endpointId,
    ),
  };
  ctx.store.set(clusterEndpointKey(endpointId), ep);
  return presentClusterEndpoint(ep);
};

const DescribeDBClusterEndpoints: OperationHandler = (input, ctx) => {
  const endpointId = optionalString(input, "DBClusterEndpointIdentifier");
  const clusterId = optionalString(input, "DBClusterIdentifier");
  const endpoints = ctx.store
    .list<StoredDBClusterEndpoint>()
    .filter((entry) => entry.key.startsWith("clusterendpoint/"))
    .filter((entry) =>
      endpointId !== undefined
        ? entry.value.DBClusterEndpointIdentifier === endpointId
        : true,
    )
    .filter((entry) =>
      clusterId !== undefined
        ? entry.value.DBClusterIdentifier === clusterId
        : true,
    )
    .map((entry) => presentClusterEndpoint(entry.value));
  return { DBClusterEndpoints: endpoints };
};

const ModifyDBClusterEndpoint: OperationHandler = (input, ctx) => {
  const endpointId = requireString(input, "DBClusterEndpointIdentifier");
  const ep = ctx.store.get<StoredDBClusterEndpoint>(
    clusterEndpointKey(endpointId),
  );
  if (ep === undefined) {
    throw awsError(
      "DBClusterEndpointNotFoundFault",
      `DBClusterEndpoint ${endpointId} not found.`,
      404,
    );
  }
  const staticMembers = stringList(input, "StaticMembers");
  const excludedMembers = stringList(input, "ExcludedMembers");
  if (staticMembers.length > 0) ep.StaticMembers = staticMembers;
  if (excludedMembers.length > 0) ep.ExcludedMembers = excludedMembers;
  ctx.store.set(clusterEndpointKey(endpointId), ep);
  return presentClusterEndpoint(ep);
};

const DeleteDBClusterEndpoint: OperationHandler = (input, ctx) => {
  const endpointId = requireString(input, "DBClusterEndpointIdentifier");
  const ep = ctx.store.get<StoredDBClusterEndpoint>(
    clusterEndpointKey(endpointId),
  );
  if (ep === undefined) {
    throw awsError(
      "DBClusterEndpointNotFoundFault",
      `DBClusterEndpoint ${endpointId} not found.`,
      404,
    );
  }
  ctx.store.delete(clusterEndpointKey(endpointId));
  return presentClusterEndpoint({ ...ep, Status: "deleting" });
};

const CreateDBClusterParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBClusterParameterGroupName");
  const existing = ctx.store.get<StoredDBClusterParameterGroup>(
    clusterParamGroupKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "DBParameterGroupAlreadyExists",
      `DBClusterParameterGroup ${name} already exists.`,
      400,
    );
  }
  const group: StoredDBClusterParameterGroup = {
    DBClusterParameterGroupName: name,
    DBParameterGroupFamily: requireString(input, "DBParameterGroupFamily"),
    Description: requireString(input, "Description"),
    DBClusterParameterGroupArn: clusterParamGroupArnOf(
      ctx.region,
      ctx.account,
      name,
    ),
  };
  ctx.store.set(clusterParamGroupKey(name), group);
  return { DBClusterParameterGroup: presentClusterParamGroup(group) };
};

const DescribeDBClusterParameterGroups: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "DBClusterParameterGroupName");
  if (name !== undefined) {
    const group = requireClusterParamGroup(ctx, name);
    return { DBClusterParameterGroups: [presentClusterParamGroup(group)] };
  }
  const groups = ctx.store
    .list<StoredDBClusterParameterGroup>()
    .filter((entry) => entry.key.startsWith("clusterparametergroup/"))
    .map((entry) => presentClusterParamGroup(entry.value));
  return { DBClusterParameterGroups: groups };
};

const DeleteDBClusterParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBClusterParameterGroupName");
  requireClusterParamGroup(ctx, name);
  ctx.store.delete(clusterParamGroupKey(name));
  return {};
};

const ModifyDBClusterParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBClusterParameterGroupName");
  requireClusterParamGroup(ctx, name);
  return { DBClusterParameterGroupName: name };
};

const ResetDBClusterParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBClusterParameterGroupName");
  requireClusterParamGroup(ctx, name);
  return { DBClusterParameterGroupName: name };
};

const DescribeDBClusterParameters: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBClusterParameterGroupName");
  requireClusterParamGroup(ctx, name);
  return { Parameters: [] };
};

const CreateDBClusterSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "DBClusterSnapshotIdentifier");
  const clusterId = requireString(input, "DBClusterIdentifier");
  const cluster = requireCluster(ctx, clusterId);
  const existing = ctx.store.get<StoredDBClusterSnapshot>(
    clusterSnapshotKey(snapshotId),
  );
  if (existing !== undefined) {
    throw awsError(
      "DBClusterSnapshotAlreadyExistsFault",
      `DBClusterSnapshot ${snapshotId} already exists.`,
      400,
    );
  }
  const snapshot: StoredDBClusterSnapshot = {
    DBClusterSnapshotIdentifier: snapshotId,
    DBClusterIdentifier: clusterId,
    Engine: cluster.Engine,
    AllocatedStorage: cluster.AllocatedStorage,
    Status: "available",
    Port: cluster.Port,
    VpcId: "vpc-bunsai00000000000",
    SnapshotCreateTime: new Date().toISOString(),
    MasterUsername: cluster.MasterUsername,
    EngineVersion: cluster.EngineVersion,
    SnapshotType: "manual",
    StorageEncrypted: cluster.StorageEncrypted,
    DBClusterSnapshotArn: clusterSnapshotArnOf(
      ctx.region,
      ctx.account,
      snapshotId,
    ),
    ClusterCreateTime: cluster.ClusterCreateTime,
    PercentProgress: 100,
  };
  ctx.store.set(clusterSnapshotKey(snapshotId), snapshot);
  return { DBClusterSnapshot: presentClusterSnapshot(snapshot) };
};

const DescribeDBClusterSnapshots: OperationHandler = (input, ctx) => {
  const snapshotId = optionalString(input, "DBClusterSnapshotIdentifier");
  const clusterId = optionalString(input, "DBClusterIdentifier");
  if (snapshotId !== undefined) {
    const snapshot = requireClusterSnapshot(ctx, snapshotId);
    return { DBClusterSnapshots: [presentClusterSnapshot(snapshot)] };
  }
  const snapshots = ctx.store
    .list<StoredDBClusterSnapshot>()
    .filter((entry) => entry.key.startsWith("clustersnapshot/"))
    .filter((entry) =>
      clusterId !== undefined
        ? entry.value.DBClusterIdentifier === clusterId
        : true,
    )
    .map((entry) => presentClusterSnapshot(entry.value));
  return { DBClusterSnapshots: snapshots };
};

const DeleteDBClusterSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "DBClusterSnapshotIdentifier");
  const snapshot = requireClusterSnapshot(ctx, snapshotId);
  ctx.store.delete(clusterSnapshotKey(snapshotId));
  return {
    DBClusterSnapshot: presentClusterSnapshot({
      ...snapshot,
      Status: "deleted",
    }),
  };
};

const DescribeDBClusterSnapshotAttributes: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "DBClusterSnapshotIdentifier");
  requireClusterSnapshot(ctx, snapshotId);
  return {
    DBClusterSnapshotAttributesResult: {
      DBClusterSnapshotIdentifier: snapshotId,
      DBClusterSnapshotAttributes: [],
    },
  };
};

const ModifyDBClusterSnapshotAttribute: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "DBClusterSnapshotIdentifier");
  requireClusterSnapshot(ctx, snapshotId);
  requireString(input, "AttributeName");
  return {
    DBClusterSnapshotAttributesResult: {
      DBClusterSnapshotIdentifier: snapshotId,
      DBClusterSnapshotAttributes: [],
    },
  };
};

const CreateDBSecurityGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBSecurityGroupName");
  const existing = ctx.store.get<StoredDBSecurityGroup>(securityGroupKey(name));
  if (existing !== undefined) {
    throw awsError(
      "DBSecurityGroupAlreadyExists",
      `DBSecurityGroup ${name} already exists.`,
      400,
    );
  }
  const sg: StoredDBSecurityGroup = {
    OwnerId: ctx.account,
    DBSecurityGroupName: name,
    DBSecurityGroupDescription: requireString(
      input,
      "DBSecurityGroupDescription",
    ),
    VpcId: optionalString(input, "VpcId"),
    EC2SecurityGroups: [],
    IPRanges: [],
    DBSecurityGroupArn: securityGroupArnOf(ctx.region, ctx.account, name),
  };
  ctx.store.set(securityGroupKey(name), sg);
  return { DBSecurityGroup: presentSecurityGroup(sg) };
};

const DescribeDBSecurityGroups: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "DBSecurityGroupName");
  if (name !== undefined) {
    const sg = requireSecurityGroup(ctx, name);
    return { DBSecurityGroups: [presentSecurityGroup(sg)] };
  }
  const groups = ctx.store
    .list<StoredDBSecurityGroup>()
    .filter((entry) => entry.key.startsWith("securitygroup/"))
    .map((entry) => presentSecurityGroup(entry.value));
  return { DBSecurityGroups: groups };
};

const DeleteDBSecurityGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBSecurityGroupName");
  requireSecurityGroup(ctx, name);
  ctx.store.delete(securityGroupKey(name));
  return {};
};

const RevokeDBSecurityGroupIngress: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBSecurityGroupName");
  const sg = requireSecurityGroup(ctx, name);
  const cidr = optionalString(input, "CIDRIP");
  if (cidr !== undefined) {
    sg.IPRanges = sg.IPRanges.filter((r) => r.CIDRIP !== cidr);
    ctx.store.set(securityGroupKey(name), sg);
  }
  return { DBSecurityGroup: presentSecurityGroup(sg) };
};

const CreateDBInstanceReadReplica: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  const existing = ctx.store.get<StoredDBInstance>(instanceKey(id));
  if (existing !== undefined) {
    throw awsError(
      "DBInstanceAlreadyExists",
      `DBInstance ${id} already exists.`,
      400,
    );
  }
  const srcId = optionalString(input, "SourceDBInstanceIdentifier");
  let engine = "mysql";
  if (srcId !== undefined) {
    const src = ctx.store.get<StoredDBInstance>(instanceKey(srcId));
    if (src !== undefined) {
      engine = src.Engine;
    }
  }
  const availabilityZone =
    optionalString(input, "AvailabilityZone") ?? `${ctx.region}a`;
  const instance: StoredDBInstance = {
    DBInstanceIdentifier: id,
    DBInstanceClass: optionalString(input, "DBInstanceClass") ?? "db.t3.micro",
    Engine: engine,
    DBInstanceStatus: "available",
    MasterUsername: undefined,
    DBName: undefined,
    Endpoint: {
      Address: `${id}.bunsai.${ctx.region}.rds.amazonaws.com`,
      Port: numberOr(input, "Port", 3306),
      HostedZoneId: "Z1BUNSAIRDS000",
    },
    AllocatedStorage: numberOr(input, "AllocatedStorage", 20),
    InstanceCreateTime: new Date().toISOString(),
    EngineVersion: optionalString(input, "EngineVersion"),
    MultiAZ: booleanOr(input, "MultiAZ", false),
    PubliclyAccessible: booleanOr(input, "PubliclyAccessible", false),
    StorageType: optionalString(input, "StorageType") ?? "gp2",
    AvailabilityZone: availabilityZone,
    DBInstanceArn: instanceArnOf(ctx.region, ctx.account, id),
    DbiResourceId: `db-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`,
  };
  ctx.store.set(instanceKey(id), instance);
  return { DBInstance: presentInstance(instance) };
};

const DeleteDBClusterAutomatedBackup: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "DbClusterResourceId");
  return {
    DBClusterAutomatedBackup: {
      DbClusterResourceId: resourceId,
      Status: "deleted",
    },
  };
};

const DeleteDBInstanceAutomatedBackup: OperationHandler = (input, ctx) => {
  const resourceId = optionalString(input, "DbiResourceId") ?? "";
  return {
    DBInstanceAutomatedBackup: {
      DbiResourceId: resourceId,
      Status: "deleted",
    },
  };
};

const DeleteDBSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "DBSnapshotIdentifier");
  const snapshot = ctx.store.get<StoredDBSnapshot>(snapshotKey(snapshotId));
  if (snapshot === undefined) {
    throw awsError(
      "DBSnapshotNotFound",
      `DBSnapshot ${snapshotId} not found.`,
      404,
    );
  }
  ctx.store.delete(snapshotKey(snapshotId));
  return {
    DBSnapshot: presentSnapshot({ ...snapshot, Status: "deleted" }),
  };
};

const DescribeAccountAttributes: OperationHandler = (_input, _ctx) => {
  return {
    AccountQuotas: [
      { AccountQuotaName: "DBInstances", Used: 0, Max: 40 },
      { AccountQuotaName: "DBClusters", Used: 0, Max: 40 },
    ],
  };
};

const DescribeDBClusterAutomatedBackups: OperationHandler = (_input, _ctx) => {
  return { DBClusterAutomatedBackups: [] };
};

const DescribeDBClusterBacktracks: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  requireCluster(ctx, id);
  return { DBClusterBacktracks: [] };
};

const DescribeDBInstanceAutomatedBackups: OperationHandler = (_input, _ctx) => {
  return { DBInstanceAutomatedBackups: [] };
};

const DescribeDBLogFiles: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  requireInstance(ctx, id);
  return { DescribeDBLogFiles: [] };
};

const DescribeDBParameters: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBParameterGroupName");
  const group = ctx.store.get<StoredDBParameterGroup>(parameterGroupKey(name));
  if (group === undefined) {
    throw awsError(
      "DBParameterGroupNotFound",
      `DBParameterGroup ${name} not found.`,
      404,
    );
  }
  return { Parameters: [] };
};

const DescribeDBProxies: OperationHandler = (_input, _ctx) => {
  return { DBProxies: [] };
};

const DescribeDBSnapshotAttributes: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "DBSnapshotIdentifier");
  const snapshot = ctx.store.get<StoredDBSnapshot>(snapshotKey(snapshotId));
  if (snapshot === undefined) {
    throw awsError(
      "DBSnapshotNotFound",
      `DBSnapshot ${snapshotId} not found.`,
      404,
    );
  }
  return {
    DBSnapshotAttributesResult: {
      DBSnapshotIdentifier: snapshotId,
      DBSnapshotAttributes: [],
    },
  };
};

const DescribeOrderableDBInstanceOptions: OperationHandler = (input, _ctx) => {
  requireString(input, "Engine");
  return { OrderableDBInstanceOptions: [] };
};

const DescribePendingMaintenanceActions: OperationHandler = (_input, _ctx) => {
  return { PendingMaintenanceActions: [] };
};

const DescribeValidDBInstanceModifications: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  requireInstance(ctx, id);
  return {
    ValidDBInstanceModificationsMessage: {
      Storage: [],
      ValidProcessorFeatures: [],
    },
  };
};

const DownloadDBLogFilePortion: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  requireInstance(ctx, id);
  requireString(input, "LogFileName");
  return { LogFileData: "", Marker: "0", AdditionalDataPending: false };
};

const FailoverDBCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  return { DBCluster: presentCluster(cluster) };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceName = requireString(input, "ResourceName");
  return { TagList: getTags(ctx, resourceName) };
};

const ModifyCurrentDBClusterCapacity: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  requireCluster(ctx, id);
  const capacity = numberOr(input, "Capacity", 1);
  return {
    DBClusterIdentifier: id,
    PendingCapacity: capacity,
    CurrentCapacity: capacity,
    SecondsBeforeTimeout: 300,
    TimeoutAction: "ForceApplyCapacityChange",
  };
};

const ModifyDBCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  const newEngine = optionalString(input, "EngineVersion");
  if (newEngine !== undefined) {
    cluster.EngineVersion = newEngine;
  }
  const backupRetention = numberOr(input, "BackupRetentionPeriod", 0);
  if (backupRetention > 0) {
    cluster.BackupRetentionPeriod = backupRetention;
  }
  ctx.store.set(clusterKey(id), cluster);
  return { DBCluster: presentCluster(cluster) };
};

const ModifyDBInstance: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  const instance = requireInstance(ctx, id);
  const newClass = optionalString(input, "DBInstanceClass");
  if (newClass !== undefined) {
    instance.DBInstanceClass = newClass;
  }
  const newStorage = numberOr(input, "AllocatedStorage", 0);
  if (newStorage > 0) {
    instance.AllocatedStorage = newStorage;
  }
  ctx.store.set(instanceKey(id), instance);
  return { DBInstance: presentInstance(instance) };
};

const ModifyDBParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBParameterGroupName");
  const group = ctx.store.get<StoredDBParameterGroup>(parameterGroupKey(name));
  if (group === undefined) {
    throw awsError(
      "DBParameterGroupNotFound",
      `DBParameterGroup ${name} not found.`,
      404,
    );
  }
  return { DBParameterGroupName: name };
};

const ModifyDBSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "DBSnapshotIdentifier");
  const snapshot = ctx.store.get<StoredDBSnapshot>(snapshotKey(snapshotId));
  if (snapshot === undefined) {
    throw awsError(
      "DBSnapshotNotFound",
      `DBSnapshot ${snapshotId} not found.`,
      404,
    );
  }
  const newEngineVersion = optionalString(input, "EngineVersion");
  if (newEngineVersion !== undefined) {
    snapshot.EngineVersion = newEngineVersion;
    ctx.store.set(snapshotKey(snapshotId), snapshot);
  }
  return { DBSnapshot: presentSnapshot(snapshot) };
};

const ModifyDBSnapshotAttribute: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "DBSnapshotIdentifier");
  const snapshot = ctx.store.get<StoredDBSnapshot>(snapshotKey(snapshotId));
  if (snapshot === undefined) {
    throw awsError(
      "DBSnapshotNotFound",
      `DBSnapshot ${snapshotId} not found.`,
      404,
    );
  }
  requireString(input, "AttributeName");
  return {
    DBSnapshotAttributesResult: {
      DBSnapshotIdentifier: snapshotId,
      DBSnapshotAttributes: [],
    },
  };
};

const ModifyDBSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBSubnetGroupName");
  const group = ctx.store.get<StoredDBSubnetGroup>(subnetGroupKey(name));
  if (group === undefined) {
    throw awsError(
      "DBSubnetGroupNotFoundFault",
      `DBSubnetGroup ${name} not found.`,
      404,
    );
  }
  const subnetIds = stringList(input, "SubnetIds");
  if (subnetIds.length > 0) {
    group.Subnets = subnetIds.map((subnetId) => ({
      SubnetIdentifier: subnetId,
      SubnetStatus: "Active",
    }));
  }
  const newDesc = optionalString(input, "DBSubnetGroupDescription");
  if (newDesc !== undefined) {
    group.DBSubnetGroupDescription = newDesc;
  }
  ctx.store.set(subnetGroupKey(name), group);
  return { DBSubnetGroup: presentSubnetGroup(group) };
};

const PromoteReadReplica: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  const instance = requireInstance(ctx, id);
  return { DBInstance: presentInstance(instance) };
};

const PromoteReadReplicaDBCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  return { DBCluster: presentCluster(cluster) };
};

const RebootDBCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  return { DBCluster: presentCluster(cluster) };
};

const RemoveRoleFromDBCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  requireCluster(ctx, id);
  requireString(input, "RoleArn");
  return {};
};

const RemoveRoleFromDBInstance: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  requireInstance(ctx, id);
  requireString(input, "RoleArn");
  requireString(input, "FeatureName");
  return {};
};

const RemoveTagsFromResource: OperationHandler = (input, ctx) => {
  const resourceName = requireString(input, "ResourceName");
  const tagKeys = stringList(input, "TagKeys");
  removeTags(ctx, resourceName, tagKeys);
  return {};
};

const ResetDBParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBParameterGroupName");
  const group = ctx.store.get<StoredDBParameterGroup>(parameterGroupKey(name));
  if (group === undefined) {
    throw awsError(
      "DBParameterGroupNotFound",
      `DBParameterGroup ${name} not found.`,
      404,
    );
  }
  return { DBParameterGroupName: name };
};

const RestoreDBClusterFromS3: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  const existing = ctx.store.get<StoredDBCluster>(clusterKey(id));
  if (existing !== undefined) {
    throw awsError(
      "DBClusterAlreadyExistsFault",
      `DBCluster ${id} already exists.`,
      400,
    );
  }
  const engine = requireString(input, "Engine");
  const cluster: StoredDBCluster = {
    DBClusterIdentifier: id,
    Engine: engine,
    Status: "available",
    MasterUsername: optionalString(input, "MasterUsername"),
    DatabaseName: optionalString(input, "DatabaseName"),
    Endpoint: `${id}.cluster.${ctx.region}.rds.amazonaws.com`,
    ReaderEndpoint: `${id}.cluster-ro.${ctx.region}.rds.amazonaws.com`,
    Port: numberOr(input, "Port", 3306),
    EngineVersion: optionalString(input, "EngineVersion"),
    MultiAZ: false,
    DBClusterArn: clusterArnOf(ctx.region, ctx.account, id),
    DbClusterResourceId: `cluster-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`,
    StorageEncrypted: booleanOr(input, "StorageEncrypted", false),
    ClusterCreateTime: new Date().toISOString(),
    AvailabilityZones: [`${ctx.region}a`, `${ctx.region}b`, `${ctx.region}c`],
    StorageType: "aurora",
    AllocatedStorage: 1,
    BackupRetentionPeriod: numberOr(input, "BackupRetentionPeriod", 1),
  };
  ctx.store.set(clusterKey(id), cluster);
  return { DBCluster: presentCluster(cluster) };
};

const RestoreDBClusterFromSnapshot: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  const snapshotId = requireString(input, "SnapshotIdentifier");
  const engine = requireString(input, "Engine");
  const existing = ctx.store.get<StoredDBCluster>(clusterKey(id));
  if (existing !== undefined) {
    throw awsError(
      "DBClusterAlreadyExistsFault",
      `DBCluster ${id} already exists.`,
      400,
    );
  }
  const snapshot = ctx.store.get<StoredDBClusterSnapshot>(
    clusterSnapshotKey(snapshotId),
  );
  const cluster: StoredDBCluster = {
    DBClusterIdentifier: id,
    Engine: engine,
    Status: "available",
    MasterUsername: snapshot?.MasterUsername,
    DatabaseName: undefined,
    Endpoint: `${id}.cluster.${ctx.region}.rds.amazonaws.com`,
    ReaderEndpoint: `${id}.cluster-ro.${ctx.region}.rds.amazonaws.com`,
    Port: snapshot?.Port ?? 3306,
    EngineVersion:
      snapshot?.EngineVersion ?? optionalString(input, "EngineVersion"),
    MultiAZ: false,
    DBClusterArn: clusterArnOf(ctx.region, ctx.account, id),
    DbClusterResourceId: `cluster-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`,
    StorageEncrypted: snapshot?.StorageEncrypted ?? false,
    ClusterCreateTime: new Date().toISOString(),
    AvailabilityZones: [`${ctx.region}a`, `${ctx.region}b`, `${ctx.region}c`],
    StorageType: "aurora",
    AllocatedStorage: snapshot?.AllocatedStorage ?? 1,
    BackupRetentionPeriod: 1,
  };
  ctx.store.set(clusterKey(id), cluster);
  return { DBCluster: presentCluster(cluster) };
};

const RestoreDBClusterToPointInTime: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  const existing = ctx.store.get<StoredDBCluster>(clusterKey(id));
  if (existing !== undefined) {
    throw awsError(
      "DBClusterAlreadyExistsFault",
      `DBCluster ${id} already exists.`,
      400,
    );
  }
  const srcId = optionalString(input, "SourceDBClusterIdentifier") ?? id;
  const src = ctx.store.get<StoredDBCluster>(clusterKey(srcId));
  const cluster: StoredDBCluster = {
    DBClusterIdentifier: id,
    Engine: src?.Engine ?? "aurora",
    Status: "available",
    MasterUsername: src?.MasterUsername,
    DatabaseName: src?.DatabaseName,
    Endpoint: `${id}.cluster.${ctx.region}.rds.amazonaws.com`,
    ReaderEndpoint: `${id}.cluster-ro.${ctx.region}.rds.amazonaws.com`,
    Port: src?.Port ?? 3306,
    EngineVersion: src?.EngineVersion,
    MultiAZ: false,
    DBClusterArn: clusterArnOf(ctx.region, ctx.account, id),
    DbClusterResourceId: `cluster-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`,
    StorageEncrypted: src?.StorageEncrypted ?? false,
    ClusterCreateTime: new Date().toISOString(),
    AvailabilityZones: [`${ctx.region}a`, `${ctx.region}b`, `${ctx.region}c`],
    StorageType: "aurora",
    AllocatedStorage: src?.AllocatedStorage ?? 1,
    BackupRetentionPeriod: 1,
  };
  ctx.store.set(clusterKey(id), cluster);
  return { DBCluster: presentCluster(cluster) };
};

const RestoreDBInstanceFromDBSnapshot: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  const existing = ctx.store.get<StoredDBInstance>(instanceKey(id));
  if (existing !== undefined) {
    throw awsError(
      "DBInstanceAlreadyExists",
      `DBInstance ${id} already exists.`,
      400,
    );
  }
  const snapshotId = optionalString(input, "DBSnapshotIdentifier") ?? "";
  const snapshot = ctx.store.get<StoredDBSnapshot>(snapshotKey(snapshotId));
  const availabilityZone =
    optionalString(input, "AvailabilityZone") ??
    snapshot?.AvailabilityZone ??
    `${ctx.region}a`;
  const instance: StoredDBInstance = {
    DBInstanceIdentifier: id,
    DBInstanceClass: optionalString(input, "DBInstanceClass") ?? "db.t3.micro",
    Engine: snapshot?.Engine ?? requireString(input, "Engine"),
    DBInstanceStatus: "available",
    MasterUsername: snapshot?.MasterUsername,
    DBName: optionalString(input, "DBName"),
    Endpoint: {
      Address: `${id}.bunsai.${ctx.region}.rds.amazonaws.com`,
      Port: snapshot?.Port ?? numberOr(input, "Port", 3306),
      HostedZoneId: "Z1BUNSAIRDS000",
    },
    AllocatedStorage:
      snapshot?.AllocatedStorage ?? numberOr(input, "AllocatedStorage", 20),
    InstanceCreateTime: new Date().toISOString(),
    EngineVersion:
      snapshot?.EngineVersion ?? optionalString(input, "EngineVersion"),
    MultiAZ: booleanOr(input, "MultiAZ", false),
    PubliclyAccessible: booleanOr(input, "PubliclyAccessible", false),
    StorageType:
      snapshot?.StorageType ?? optionalString(input, "StorageType") ?? "gp2",
    AvailabilityZone: availabilityZone,
    DBInstanceArn: instanceArnOf(ctx.region, ctx.account, id),
    DbiResourceId: `db-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`,
  };
  ctx.store.set(instanceKey(id), instance);
  return { DBInstance: presentInstance(instance) };
};

const RestoreDBInstanceFromS3: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  const existing = ctx.store.get<StoredDBInstance>(instanceKey(id));
  if (existing !== undefined) {
    throw awsError(
      "DBInstanceAlreadyExists",
      `DBInstance ${id} already exists.`,
      400,
    );
  }
  const engine = requireString(input, "Engine");
  const instance = newInstanceFromParams(ctx, id, input, engine);
  ctx.store.set(instanceKey(id), instance);
  return { DBInstance: presentInstance(instance) };
};

const RestoreDBInstanceToPointInTime: OperationHandler = (input, ctx) => {
  const id = requireString(input, "TargetDBInstanceIdentifier");
  const existing = ctx.store.get<StoredDBInstance>(instanceKey(id));
  if (existing !== undefined) {
    throw awsError(
      "DBInstanceAlreadyExists",
      `DBInstance ${id} already exists.`,
      400,
    );
  }
  const srcId = optionalString(input, "SourceDBInstanceIdentifier");
  const src =
    srcId !== undefined
      ? ctx.store.get<StoredDBInstance>(instanceKey(srcId))
      : undefined;
  const availabilityZone =
    optionalString(input, "AvailabilityZone") ??
    src?.AvailabilityZone ??
    `${ctx.region}a`;
  const instance: StoredDBInstance = {
    DBInstanceIdentifier: id,
    DBInstanceClass:
      optionalString(input, "DBInstanceClass") ??
      src?.DBInstanceClass ??
      "db.t3.micro",
    Engine: src?.Engine ?? "mysql",
    DBInstanceStatus: "available",
    MasterUsername: src?.MasterUsername,
    DBName: src?.DBName,
    Endpoint: {
      Address: `${id}.bunsai.${ctx.region}.rds.amazonaws.com`,
      Port: src?.Endpoint.Port ?? numberOr(input, "Port", 3306),
      HostedZoneId: "Z1BUNSAIRDS000",
    },
    AllocatedStorage:
      src?.AllocatedStorage ?? numberOr(input, "AllocatedStorage", 20),
    InstanceCreateTime: new Date().toISOString(),
    EngineVersion: src?.EngineVersion,
    MultiAZ: booleanOr(input, "MultiAZ", false),
    PubliclyAccessible: booleanOr(input, "PubliclyAccessible", false),
    StorageType: src?.StorageType ?? "gp2",
    AvailabilityZone: availabilityZone,
    DBInstanceArn: instanceArnOf(ctx.region, ctx.account, id),
    DbiResourceId: `db-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`,
  };
  ctx.store.set(instanceKey(id), instance);
  return { DBInstance: presentInstance(instance) };
};

const StartDBCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  cluster.Status = "available";
  ctx.store.set(clusterKey(id), cluster);
  return { DBCluster: presentCluster(cluster) };
};

const StopDBCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  cluster.Status = "stopped";
  ctx.store.set(clusterKey(id), cluster);
  return { DBCluster: presentCluster(cluster) };
};

const StartDBInstanceAutomatedBackupsReplication: OperationHandler = (
  input,
  _ctx,
) => {
  const sourceArn = requireString(input, "SourceDBInstanceArn");
  return {
    DBInstanceAutomatedBackup: {
      DBInstanceArn: sourceArn,
      Status: "replicating",
    },
  };
};

const StopDBInstanceAutomatedBackupsReplication: OperationHandler = (
  input,
  _ctx,
) => {
  const sourceArn = requireString(input, "SourceDBInstanceArn");
  return {
    DBInstanceAutomatedBackup: {
      DBInstanceArn: sourceArn,
      Status: "stopped",
    },
  };
};

const SwitchoverReadReplica: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBInstanceIdentifier");
  const instance = requireInstance(ctx, id);
  return { DBInstance: presentInstance(instance) };
};

const rds: ServiceDefinition = {
  name: "rds",
  protocol: "query",
  operations: {
    AddRoleToDBCluster,
    AddRoleToDBInstance,
    AddTagsToResource,
    ApplyPendingMaintenanceAction,
    AuthorizeDBSecurityGroupIngress,
    BacktrackDBCluster,
    CopyDBClusterParameterGroup,
    CopyDBClusterSnapshot,
    CopyDBParameterGroup,
    CopyDBSnapshot,
    CreateDBCluster,
    CreateDBClusterEndpoint,
    CreateDBClusterParameterGroup,
    CreateDBClusterSnapshot,
    CreateDBInstance,
    CreateDBInstanceReadReplica,
    CreateDBParameterGroup,
    CreateDBSecurityGroup,
    CreateDBSnapshot,
    CreateDBSubnetGroup,
    DeleteDBCluster,
    DeleteDBClusterAutomatedBackup,
    DeleteDBClusterEndpoint,
    DeleteDBClusterParameterGroup,
    DeleteDBClusterSnapshot,
    DeleteDBInstance,
    DeleteDBInstanceAutomatedBackup,
    DeleteDBParameterGroup,
    DeleteDBSecurityGroup,
    DeleteDBSnapshot,
    DeleteDBSubnetGroup,
    DescribeAccountAttributes,
    DescribeDBClusterAutomatedBackups,
    DescribeDBClusterBacktracks,
    DescribeDBClusterEndpoints,
    DescribeDBClusterParameterGroups,
    DescribeDBClusterParameters,
    DescribeDBClusterSnapshotAttributes,
    DescribeDBClusterSnapshots,
    DescribeDBClusters,
    DescribeDBInstanceAutomatedBackups,
    DescribeDBInstances,
    DescribeDBLogFiles,
    DescribeDBParameterGroups,
    DescribeDBParameters,
    DescribeDBProxies,
    DescribeDBSecurityGroups,
    DescribeDBSnapshotAttributes,
    DescribeDBSnapshots,
    DescribeDBSubnetGroups,
    DescribeOrderableDBInstanceOptions,
    DescribePendingMaintenanceActions,
    DescribeValidDBInstanceModifications,
    DownloadDBLogFilePortion,
    FailoverDBCluster,
    ListTagsForResource,
    ModifyCurrentDBClusterCapacity,
    ModifyDBCluster,
    ModifyDBClusterEndpoint,
    ModifyDBClusterParameterGroup,
    ModifyDBClusterSnapshotAttribute,
    ModifyDBInstance,
    ModifyDBParameterGroup,
    ModifyDBSnapshot,
    ModifyDBSnapshotAttribute,
    ModifyDBSubnetGroup,
    PromoteReadReplica,
    PromoteReadReplicaDBCluster,
    RebootDBCluster,
    RebootDBInstance,
    RemoveRoleFromDBCluster,
    RemoveRoleFromDBInstance,
    RemoveTagsFromResource,
    ResetDBClusterParameterGroup,
    ResetDBParameterGroup,
    RestoreDBClusterFromS3,
    RestoreDBClusterFromSnapshot,
    RestoreDBClusterToPointInTime,
    RestoreDBInstanceFromDBSnapshot,
    RestoreDBInstanceFromS3,
    RestoreDBInstanceToPointInTime,
    RevokeDBSecurityGroupIngress,
    StartDBCluster,
    StartDBInstance,
    StartDBInstanceAutomatedBackupsReplication,
    StopDBCluster,
    StopDBInstance,
    StopDBInstanceAutomatedBackupsReplication,
    SwitchoverReadReplica,
  },
  model,
} as const;

export default rds;
