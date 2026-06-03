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

const instanceKey = (id: string): string => `instance/${id}`;

const snapshotKey = (id: string): string => `snapshot/${id}`;

const parameterGroupKey = (id: string): string => `parametergroup/${id}`;

const subnetGroupKey = (id: string): string => `subnetgroup/${id}`;

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

const requireInstance = (ctx: ServiceContext, id: string): StoredDBInstance => {
  const instance = ctx.store.get<StoredDBInstance>(instanceKey(id));
  if (instance === undefined) {
    throw awsError("DBInstanceNotFound", `DBInstance ${id} not found.`, 404);
  }
  return instance;
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
  const dbInstanceClass = requireString(input, "DBInstanceClass");
  const engine = requireString(input, "Engine");
  const availabilityZone =
    optionalString(input, "AvailabilityZone") ?? `${ctx.region}a`;
  const instance: StoredDBInstance = {
    DBInstanceIdentifier: id,
    DBInstanceClass: dbInstanceClass,
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

const stringList = (input: Record<string, unknown>, key: string): string[] => {
  const value = input[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
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

const rds: ServiceDefinition = {
  name: "rds",
  protocol: "query",
  operations: {
    CreateDBInstance,
    DescribeDBInstances,
    DeleteDBInstance,
    CreateDBSnapshot,
    DescribeDBSnapshots,
    StartDBInstance,
    StopDBInstance,
    CreateDBParameterGroup,
    DescribeDBParameterGroups,
    DeleteDBParameterGroup,
    CreateDBSubnetGroup,
    DescribeDBSubnetGroups,
    DeleteDBSubnetGroup,
    RebootDBInstance,
  },
  model,
} as const;

export default rds;
