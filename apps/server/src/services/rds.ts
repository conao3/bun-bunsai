import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/rds.json", { with: { type: "json" } }),
);

type StoredEndpoint = {
  Address: string;
  Port: number;
  HostedZoneId: string;
};

type StoredDBParameter = {
  ParameterName: string;
  ParameterValue: string;
  ApplyType: string;
  DataType: string;
  IsModifiable: boolean;
  ApplyMethod: string;
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
  BackupRetentionPeriod: number;
  PreferredBackupWindow: string | undefined;
  PreferredMaintenanceWindow: string | undefined;
  VpcSecurityGroups: { VpcSecurityGroupId: string; Status: string }[];
  DBParameterGroupName: string | undefined;
  DBSubnetGroupName: string | undefined;
  ReadReplicaSourceDBInstanceIdentifier: string | undefined;
  ReadReplicaDBInstanceIdentifiers: string[];
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
  Parameters: StoredDBParameter[];
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

type StoredDBProxy = {
  DBProxyName: string;
  DBProxyArn: string;
  Status: string;
  Endpoint: string;
  VpcId: string;
  VpcSecurityGroupIds: string[];
  VpcSubnetIds: string[];
  Auth: { AuthScheme: string; IAMAuth: string }[];
  RoleArn: string;
  EngineFamily: string;
  IdleClientTimeout: number;
  DebugLogging: boolean;
  RequireTLS: boolean;
  CreatedDate: string;
  UpdatedDate: string;
};

type StoredDBProxyEndpoint = {
  DBProxyEndpointName: string;
  DBProxyEndpointArn: string;
  DBProxyName: string;
  Status: string;
  VpcId: string;
  VpcSecurityGroupIds: string[];
  VpcSubnetIds: string[];
  Endpoint: string;
  CreatedDate: string;
  TargetRole: string;
  IsDefault: boolean;
  EndpointNetworkType: string;
};

type StoredDBProxyTargetGroup = {
  DBProxyName: string;
  TargetGroupName: string;
  TargetGroupArn: string;
  IsDefault: boolean;
  Status: string;
  CreatedDate: string;
  UpdatedDate: string;
  Targets: {
    TargetArn: string;
    Endpoint: string;
    Port: number;
    Type: string;
    Role: string;
  }[];
};

type StoredEventSubscription = {
  CustomerAwsId: string;
  CustSubscriptionId: string;
  SnsTopicArn: string;
  Status: string;
  SubscriptionCreationTime: string;
  SourceType: string | undefined;
  SourceIdsList: string[];
  EventCategoriesList: string[];
  Enabled: boolean;
  EventSubscriptionArn: string;
};

type StoredGlobalCluster = {
  GlobalClusterIdentifier: string;
  GlobalClusterResourceId: string;
  GlobalClusterArn: string;
  Status: string;
  Engine: string | undefined;
  EngineVersion: string | undefined;
  DatabaseName: string | undefined;
  StorageEncrypted: boolean;
  DeletionProtection: boolean;
  GlobalClusterMembers: { DBClusterArn: string; IsWriter: boolean }[];
};

type StoredOption = {
  OptionName: string;
  Permanent: boolean;
  Persistent: boolean;
  Port?: number;
  OptionVersion?: string;
  OptionSettings?: { Name?: string; Value?: string }[];
  DBSecurityGroupMemberships?: {
    DBSecurityGroupName: string;
    Status: string;
  }[];
  VpcSecurityGroupMemberships?: {
    VpcSecurityGroupId: string;
    Status: string;
  }[];
};

type StoredOptionGroup = {
  OptionGroupName: string;
  OptionGroupDescription: string;
  EngineName: string;
  MajorEngineVersion: string;
  Options: StoredOption[];
  AllowsVpcAndNonVpcInstanceMemberships: boolean;
  VpcId: string | undefined;
  OptionGroupArn: string;
  SourceOptionGroup: string | undefined;
  SourceAccountId: string | undefined;
  CopyTimestamp: string | undefined;
};

type StoredBlueGreenDeployment = {
  BlueGreenDeploymentIdentifier: string;
  BlueGreenDeploymentName: string;
  Source: string | undefined;
  Target: string | undefined;
  Status: string;
  StatusDetails: string | undefined;
  CreateTime: string;
  DeleteTime: string | undefined;
};

type StoredIntegration = {
  SourceArn: string;
  TargetArn: string;
  IntegrationName: string;
  IntegrationArn: string;
  KMSKeyId: string | undefined;
  Status: string;
  DataFilter: string | undefined;
  Description: string | undefined;
  CreateTime: string;
};

type StoredTenantDatabase = {
  TenantDatabaseCreateTime: string;
  DBInstanceIdentifier: string;
  TenantDBName: string;
  Status: string;
  MasterUsername: string;
  DbiResourceId: string;
  TenantDatabaseResourceId: string;
  TenantDatabaseARN: string;
  CharacterSetName: string | undefined;
  NcharCharacterSetName: string | undefined;
};

type StoredExportTask = {
  ExportTaskIdentifier: string;
  SourceArn: string;
  ExportOnly: string[];
  S3Bucket: string;
  S3Prefix: string | undefined;
  IamRoleArn: string;
  KmsKeyId: string;
  Status: string;
  TaskStartTime: string;
  TaskEndTime: string | undefined;
  SnapshotTime: string | undefined;
  PercentProgress: number;
  TotalExtractedDataInGB: number;
};

type StoredReservedDBInstance = {
  ReservedDBInstanceId: string;
  ReservedDBInstancesOfferingId: string;
  DBInstanceClass: string;
  StartTime: string;
  Duration: number;
  FixedPrice: number;
  UsagePrice: number;
  CurrencyCode: string;
  DBInstanceCount: number;
  ProductDescription: string;
  OfferingType: string;
  MultiAZ: boolean;
  State: string;
  ReservedDBInstanceArn: string;
};

type StoredDBShardGroup = {
  DBShardGroupResourceId: string;
  DBShardGroupIdentifier: string;
  DBClusterIdentifier: string;
  MaxACU: number;
  MinACU: number | undefined;
  ComputeRedundancy: number | undefined;
  Status: string;
  PubliclyAccessible: boolean;
  Endpoint: string | undefined;
  DBShardGroupArn: string;
};

type StoredCustomDBEngineVersion = {
  Engine: string;
  EngineVersion: string;
  DBParameterGroupFamily: string;
  DBEngineVersionArn: string;
  Status: string;
  Description: string | undefined;
  DatabaseInstallationFilesS3BucketName: string | undefined;
  DatabaseInstallationFilesS3Prefix: string | undefined;
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
const dbProxyKey = (name: string): string => `dbproxy/${name}`;
const dbProxyEndpointKey = (name: string): string => `dbproxyendpoint/${name}`;
const dbProxyTargetGroupKey = (proxyName: string, groupName: string): string =>
  `dbproxytargetgroup/${proxyName}/${groupName}`;
const eventSubscriptionKey = (name: string): string =>
  `eventsubscription/${name}`;
const globalClusterKey = (id: string): string => `globalcluster/${id}`;
const optionGroupKey = (name: string): string => `optiongroup/${name}`;
const blueGreenDeploymentKey = (id: string): string =>
  `bluegreendeployment/${id}`;
const integrationKey = (arn: string): string => `integration/${arn}`;
const tenantDatabaseKey = (instanceId: string, dbName: string): string =>
  `tenantdatabase/${instanceId}/${dbName}`;
const exportTaskKey = (id: string): string => `exporttask/${id}`;
const reservedDBInstanceKey = (id: string): string =>
  `reserveddbinstance/${id}`;
const dbShardGroupKey = (id: string): string => `dbshardgroup/${id}`;
const customDBEngineVersionKey = (engine: string, version: string): string =>
  `customdbengineversion/${engine}/${version}`;

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

const engineDefaultPort = (engine: string): number => {
  if (engine === "docdb") return 27017;
  if (engine === "neptune") return 8182;
  return 3306;
};

const engineDefaultVersion = (engine: string): string | undefined => {
  if (engine === "docdb") return "5.0.0";
  if (engine === "neptune") return "1.3.0.0";
  return undefined;
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

const dbProxyArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:rds:${region}:${account}:db-proxy:${name}`;

const dbProxyEndpointArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:rds:${region}:${account}:db-proxy-endpoint:${name}`;

const dbProxyTargetGroupArnOf = (
  region: string,
  account: string,
  proxyName: string,
  groupName: string,
): string =>
  `arn:aws:rds:${region}:${account}:target-group:${proxyName}:${groupName}`;

const eventSubscriptionArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:rds:${region}:${account}:es:${name}`;

const globalClusterArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:rds::${account}:global-cluster:${id}`;

const optionGroupArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:rds:${region}:${account}:og:${name}`;

const blueGreenDeploymentArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:rds:${region}:${account}:deployment:${id}`;

const integrationArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:rds:${region}:${account}:integration:${id}`;

const tenantDatabaseArnOf = (
  region: string,
  account: string,
  instanceId: string,
  dbName: string,
): string =>
  `arn:aws:rds:${region}:${account}:tenant-database:${instanceId}/${dbName}`;

const dbShardGroupArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:rds:${region}:${account}:shard-group:${id}`;

const reservedDBInstanceArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:rds:${region}:${account}:ri:${id}`;

const customDBEngineVersionArnOf = (
  region: string,
  account: string,
  engine: string,
  version: string,
): string => `arn:aws:rds:${region}:${account}:cev:${engine}/${version}`;

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
  BackupRetentionPeriod: instance.BackupRetentionPeriod,
  PreferredBackupWindow: instance.PreferredBackupWindow,
  PreferredMaintenanceWindow: instance.PreferredMaintenanceWindow,
  VpcSecurityGroups: instance.VpcSecurityGroups,
  DBParameterGroups: instance.DBParameterGroupName
    ? [
        {
          DBParameterGroupName: instance.DBParameterGroupName,
          ParameterApplyStatus: "in-sync",
        },
      ]
    : [],
  DBSubnetGroup: instance.DBSubnetGroupName
    ? { DBSubnetGroupName: instance.DBSubnetGroupName }
    : undefined,
  ReadReplicaSourceDBInstanceIdentifier:
    instance.ReadReplicaSourceDBInstanceIdentifier,
  ReadReplicaDBInstanceIdentifiers: instance.ReadReplicaDBInstanceIdentifiers,
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

const requireDBProxy = (ctx: ServiceContext, name: string): StoredDBProxy => {
  const proxy = ctx.store.get<StoredDBProxy>(dbProxyKey(name));
  if (proxy === undefined) {
    throw awsError("DBProxyNotFoundFault", `DBProxy ${name} not found.`, 404);
  }
  return proxy;
};

const requireDBProxyEndpoint = (
  ctx: ServiceContext,
  name: string,
): StoredDBProxyEndpoint => {
  const ep = ctx.store.get<StoredDBProxyEndpoint>(dbProxyEndpointKey(name));
  if (ep === undefined) {
    throw awsError(
      "DBProxyEndpointNotFoundFault",
      `DBProxyEndpoint ${name} not found.`,
      404,
    );
  }
  return ep;
};

const requireEventSubscription = (
  ctx: ServiceContext,
  name: string,
): StoredEventSubscription => {
  const sub = ctx.store.get<StoredEventSubscription>(
    eventSubscriptionKey(name),
  );
  if (sub === undefined) {
    throw awsError(
      "SubscriptionNotFound",
      `Subscription ${name} not found.`,
      404,
    );
  }
  return sub;
};

const requireGlobalCluster = (
  ctx: ServiceContext,
  id: string,
): StoredGlobalCluster => {
  const gc = ctx.store.get<StoredGlobalCluster>(globalClusterKey(id));
  if (gc === undefined) {
    throw awsError(
      "GlobalClusterNotFoundFault",
      `GlobalCluster ${id} not found.`,
      404,
    );
  }
  return gc;
};

const requireOptionGroup = (
  ctx: ServiceContext,
  name: string,
): StoredOptionGroup => {
  const og = ctx.store.get<StoredOptionGroup>(optionGroupKey(name));
  if (og === undefined) {
    throw awsError(
      "OptionGroupNotFoundFault",
      `OptionGroup ${name} not found.`,
      404,
    );
  }
  return og;
};

const requireBlueGreenDeployment = (
  ctx: ServiceContext,
  id: string,
): StoredBlueGreenDeployment => {
  const bg = ctx.store.get<StoredBlueGreenDeployment>(
    blueGreenDeploymentKey(id),
  );
  if (bg === undefined) {
    throw awsError(
      "BlueGreenDeploymentNotFoundFault",
      `BlueGreenDeployment ${id} not found.`,
      404,
    );
  }
  return bg;
};

const requireIntegration = (
  ctx: ServiceContext,
  arn: string,
): StoredIntegration => {
  const intg = ctx.store.get<StoredIntegration>(integrationKey(arn));
  if (intg === undefined) {
    throw awsError(
      "IntegrationNotFoundFault",
      `Integration ${arn} not found.`,
      404,
    );
  }
  return intg;
};

const requireExportTask = (
  ctx: ServiceContext,
  id: string,
): StoredExportTask => {
  const task = ctx.store.get<StoredExportTask>(exportTaskKey(id));
  if (task === undefined) {
    throw awsError("ExportTaskNotFound", `ExportTask ${id} not found.`, 404);
  }
  return task;
};

const requireDBShardGroup = (
  ctx: ServiceContext,
  id: string,
): StoredDBShardGroup => {
  const sg = ctx.store.get<StoredDBShardGroup>(dbShardGroupKey(id));
  if (sg === undefined) {
    throw awsError(
      "DBShardGroupNotFound",
      `DBShardGroup ${id} not found.`,
      404,
    );
  }
  return sg;
};

const presentDBProxy = (proxy: StoredDBProxy) => ({
  DBProxyName: proxy.DBProxyName,
  DBProxyArn: proxy.DBProxyArn,
  Status: proxy.Status,
  Endpoint: proxy.Endpoint,
  VpcId: proxy.VpcId,
  VpcSecurityGroupIds: proxy.VpcSecurityGroupIds,
  VpcSubnetIds: proxy.VpcSubnetIds,
  Auth: proxy.Auth,
  RoleArn: proxy.RoleArn,
  EngineFamily: proxy.EngineFamily,
  IdleClientTimeout: proxy.IdleClientTimeout,
  DebugLogging: proxy.DebugLogging,
  RequireTLS: proxy.RequireTLS,
  CreatedDate: proxy.CreatedDate,
  UpdatedDate: proxy.UpdatedDate,
});

const presentDBProxyEndpoint = (ep: StoredDBProxyEndpoint) => ({
  DBProxyEndpointName: ep.DBProxyEndpointName,
  DBProxyEndpointArn: ep.DBProxyEndpointArn,
  DBProxyName: ep.DBProxyName,
  Status: ep.Status,
  VpcId: ep.VpcId,
  VpcSecurityGroupIds: ep.VpcSecurityGroupIds,
  VpcSubnetIds: ep.VpcSubnetIds,
  Endpoint: ep.Endpoint,
  CreatedDate: ep.CreatedDate,
  TargetRole: ep.TargetRole,
  IsDefault: ep.IsDefault,
  EndpointNetworkType: ep.EndpointNetworkType,
});

const presentEventSubscription = (sub: StoredEventSubscription) => ({
  CustomerAwsId: sub.CustomerAwsId,
  CustSubscriptionId: sub.CustSubscriptionId,
  SnsTopicArn: sub.SnsTopicArn,
  Status: sub.Status,
  SubscriptionCreationTime: sub.SubscriptionCreationTime,
  SourceType: sub.SourceType,
  SourceIdsList: sub.SourceIdsList,
  EventCategoriesList: sub.EventCategoriesList,
  Enabled: sub.Enabled,
  EventSubscriptionArn: sub.EventSubscriptionArn,
});

const presentGlobalCluster = (gc: StoredGlobalCluster) => ({
  GlobalClusterIdentifier: gc.GlobalClusterIdentifier,
  GlobalClusterResourceId: gc.GlobalClusterResourceId,
  GlobalClusterArn: gc.GlobalClusterArn,
  Status: gc.Status,
  Engine: gc.Engine,
  EngineVersion: gc.EngineVersion,
  DatabaseName: gc.DatabaseName,
  StorageEncrypted: gc.StorageEncrypted,
  DeletionProtection: gc.DeletionProtection,
  GlobalClusterMembers: gc.GlobalClusterMembers,
});

const presentOptionGroup = (og: StoredOptionGroup) => ({
  OptionGroupName: og.OptionGroupName,
  OptionGroupDescription: og.OptionGroupDescription,
  EngineName: og.EngineName,
  MajorEngineVersion: og.MajorEngineVersion,
  Options: og.Options,
  AllowsVpcAndNonVpcInstanceMemberships:
    og.AllowsVpcAndNonVpcInstanceMemberships,
  VpcId: og.VpcId,
  OptionGroupArn: og.OptionGroupArn,
});

const presentBlueGreenDeployment = (bg: StoredBlueGreenDeployment) => ({
  BlueGreenDeploymentIdentifier: bg.BlueGreenDeploymentIdentifier,
  BlueGreenDeploymentName: bg.BlueGreenDeploymentName,
  Source: bg.Source,
  Target: bg.Target,
  Status: bg.Status,
  StatusDetails: bg.StatusDetails,
  CreateTime: bg.CreateTime,
  DeleteTime: bg.DeleteTime,
  Tasks: [] as { Name: string; Status: string }[],
  SwitchoverDetails: [] as {
    SourceMember: string;
    TargetMember: string;
    Status: string;
  }[],
});

const presentIntegration = (intg: StoredIntegration) => ({
  SourceArn: intg.SourceArn,
  TargetArn: intg.TargetArn,
  IntegrationName: intg.IntegrationName,
  IntegrationArn: intg.IntegrationArn,
  KMSKeyId: intg.KMSKeyId,
  Status: intg.Status,
  DataFilter: intg.DataFilter,
  Description: intg.Description,
  CreateTime: intg.CreateTime,
  Tags: [] as { Key: string; Value: string }[],
  Errors: [] as { ErrorCode: string; ErrorMessage: string }[],
  AdditionalEncryptionContext: {} as Record<string, string>,
});

const presentTenantDatabase = (td: StoredTenantDatabase) => ({
  TenantDatabaseCreateTime: td.TenantDatabaseCreateTime,
  DBInstanceIdentifier: td.DBInstanceIdentifier,
  TenantDBName: td.TenantDBName,
  Status: td.Status,
  MasterUsername: td.MasterUsername,
  DbiResourceId: td.DbiResourceId,
  TenantDatabaseResourceId: td.TenantDatabaseResourceId,
  TenantDatabaseARN: td.TenantDatabaseARN,
  CharacterSetName: td.CharacterSetName,
  NcharCharacterSetName: td.NcharCharacterSetName,
});

const presentExportTask = (task: StoredExportTask) => ({
  ExportTaskIdentifier: task.ExportTaskIdentifier,
  SourceArn: task.SourceArn,
  ExportOnly: task.ExportOnly,
  S3Bucket: task.S3Bucket,
  S3Prefix: task.S3Prefix,
  IamRoleArn: task.IamRoleArn,
  KmsKeyId: task.KmsKeyId,
  Status: task.Status,
  TaskStartTime: task.TaskStartTime,
  TaskEndTime: task.TaskEndTime,
  SnapshotTime: task.SnapshotTime,
  PercentProgress: task.PercentProgress,
  TotalExtractedDataInGB: task.TotalExtractedDataInGB,
  FailureCause: undefined as string | undefined,
  WarningMessage: undefined as string | undefined,
});

const presentReservedDBInstance = (ri: StoredReservedDBInstance) => ({
  ReservedDBInstanceId: ri.ReservedDBInstanceId,
  ReservedDBInstancesOfferingId: ri.ReservedDBInstancesOfferingId,
  DBInstanceClass: ri.DBInstanceClass,
  StartTime: ri.StartTime,
  Duration: ri.Duration,
  FixedPrice: ri.FixedPrice,
  UsagePrice: ri.UsagePrice,
  CurrencyCode: ri.CurrencyCode,
  DBInstanceCount: ri.DBInstanceCount,
  ProductDescription: ri.ProductDescription,
  OfferingType: ri.OfferingType,
  MultiAZ: ri.MultiAZ,
  State: ri.State,
  ReservedDBInstanceArn: ri.ReservedDBInstanceArn,
  RecurringCharges: [] as {
    RecurringChargeAmount: number;
    RecurringChargeFrequency: string;
  }[],
});

const presentDBShardGroup = (sg: StoredDBShardGroup) => ({
  DBShardGroupResourceId: sg.DBShardGroupResourceId,
  DBShardGroupIdentifier: sg.DBShardGroupIdentifier,
  DBClusterIdentifier: sg.DBClusterIdentifier,
  MaxACU: sg.MaxACU,
  MinACU: sg.MinACU,
  ComputeRedundancy: sg.ComputeRedundancy,
  Status: sg.Status,
  PubliclyAccessible: sg.PubliclyAccessible,
  Endpoint: sg.Endpoint,
  DBShardGroupArn: sg.DBShardGroupArn,
});

const presentCustomDBEngineVersion = (cev: StoredCustomDBEngineVersion) => ({
  Engine: cev.Engine,
  EngineVersion: cev.EngineVersion,
  DBParameterGroupFamily: cev.DBParameterGroupFamily,
  DBEngineVersionArn: cev.DBEngineVersionArn,
  Status: cev.Status,
  Description: cev.Description,
  DatabaseInstallationFilesS3BucketName:
    cev.DatabaseInstallationFilesS3BucketName,
  DatabaseInstallationFilesS3Prefix: cev.DatabaseInstallationFilesS3Prefix,
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
      Port: numberOr(input, "Port", engineDefaultPort(engine)),
      HostedZoneId: "Z1BUNSAIRDS000",
    },
    AllocatedStorage: numberOr(input, "AllocatedStorage", 20),
    InstanceCreateTime: new Date().toISOString(),
    EngineVersion:
      optionalString(input, "EngineVersion") ?? engineDefaultVersion(engine),
    MultiAZ: booleanOr(input, "MultiAZ", false),
    PubliclyAccessible: booleanOr(input, "PubliclyAccessible", false),
    StorageType: optionalString(input, "StorageType") ?? "gp2",
    AvailabilityZone: availabilityZone,
    DBInstanceArn: instanceArnOf(ctx.region, ctx.account, id),
    DbiResourceId: `db-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`,
    BackupRetentionPeriod: numberOr(input, "BackupRetentionPeriod", 0),
    PreferredBackupWindow: optionalString(input, "PreferredBackupWindow"),
    PreferredMaintenanceWindow: optionalString(
      input,
      "PreferredMaintenanceWindow",
    ),
    VpcSecurityGroups: [],
    DBParameterGroupName: optionalString(input, "DBParameterGroupName"),
    DBSubnetGroupName: optionalString(input, "DBSubnetGroupName"),
    ReadReplicaSourceDBInstanceIdentifier: undefined,
    ReadReplicaDBInstanceIdentifiers: [],
  };
};

const tagListFromInput = (
  input: Record<string, unknown>,
): { Key: string; Value: string }[] => {
  const raw = input["Tags"];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is { Key: string; Value: string } =>
      typeof t === "object" && t !== null && "Key" in t && "Value" in t,
  );
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
  const initialTags = tagListFromInput(input);
  if (initialTags.length > 0) {
    setTags(ctx, instance.DBInstanceArn, initialTags);
  }
  return { DBInstance: presentInstance(instance) };
};

const DescribeDBInstances: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "DBInstanceIdentifier");
  if (id !== undefined) {
    const instance = requireInstance(ctx, id);
    return { DBInstances: [presentInstance(instance)] };
  }
  const rawFilters = Array.isArray(input["Filters"])
    ? (input["Filters"] as unknown[])
    : [];
  const filterVals = (name: string): string[] =>
    rawFilters
      .filter(
        (f): f is Record<string, unknown> =>
          typeof f === "object" && f !== null,
      )
      .filter(
        (f) =>
          (typeof f["Name"] === "string" && f["Name"] === name) ||
          (typeof f["name"] === "string" && f["name"] === name),
      )
      .flatMap((f) => {
        const vals = f["Values"] ?? f["values"];
        return Array.isArray(vals) ? (vals as string[]) : [];
      });
  const idFilter = filterVals("db-instance-id");
  const statusFilter = filterVals("db-instance-status");
  const engineFilter = filterVals("engine");
  let instances = ctx.store
    .list<StoredDBInstance>()
    .filter((entry) => entry.key.startsWith("instance/"))
    .map((entry) => entry.value);
  if (idFilter.length > 0) {
    instances = instances.filter((inst) =>
      idFilter.includes(inst.DBInstanceIdentifier),
    );
  }
  if (statusFilter.length > 0) {
    instances = instances.filter((inst) =>
      statusFilter.includes(inst.DBInstanceStatus),
    );
  }
  if (engineFilter.length > 0) {
    instances = instances.filter((inst) => engineFilter.includes(inst.Engine));
  }
  return { DBInstances: instances.map(presentInstance) };
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
  ctx.store.delete(tagsKey(instance.DBInstanceArn));
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
    Parameters: [],
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
    Parameters: [...src.Parameters],
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
    Port: numberOr(input, "Port", engineDefaultPort(engine)),
    EngineVersion:
      optionalString(input, "EngineVersion") ?? engineDefaultVersion(engine),
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
      src.ReadReplicaDBInstanceIdentifiers = [
        ...src.ReadReplicaDBInstanceIdentifiers,
        id,
      ];
      ctx.store.set(instanceKey(srcId), src);
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
    BackupRetentionPeriod: 0,
    PreferredBackupWindow: undefined,
    PreferredMaintenanceWindow: undefined,
    VpcSecurityGroups: [],
    DBParameterGroupName: undefined,
    DBSubnetGroupName: undefined,
    ReadReplicaSourceDBInstanceIdentifier: srcId,
    ReadReplicaDBInstanceIdentifiers: [],
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
  return { Parameters: group.Parameters };
};

const DescribeDBProxies: OperationHandler = (_input, ctx) => {
  const all = ctx.store
    .list<StoredDBProxy>()
    .filter((e) => e.key.startsWith("dbproxy/"))
    .map((e) => presentDBProxy(e.value));
  return { DBProxies: all };
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
  if (input["BackupRetentionPeriod"] !== undefined) {
    instance.BackupRetentionPeriod = numberOr(
      input,
      "BackupRetentionPeriod",
      instance.BackupRetentionPeriod,
    );
  }
  if (input["MultiAZ"] !== undefined) {
    instance.MultiAZ = booleanOr(input, "MultiAZ", instance.MultiAZ);
  }
  const newBackupWindow = optionalString(input, "PreferredBackupWindow");
  if (newBackupWindow !== undefined) {
    instance.PreferredBackupWindow = newBackupWindow;
  }
  const newMaintenanceWindow = optionalString(
    input,
    "PreferredMaintenanceWindow",
  );
  if (newMaintenanceWindow !== undefined) {
    instance.PreferredMaintenanceWindow = newMaintenanceWindow;
  }
  const vpcGroups = stringList(input, "VpcSecurityGroupIds");
  if (vpcGroups.length > 0) {
    instance.VpcSecurityGroups = vpcGroups.map((sgId) => ({
      VpcSecurityGroupId: sgId,
      Status: "active",
    }));
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
  const rawParams = input["Parameters"];
  if (Array.isArray(rawParams)) {
    for (const raw of rawParams) {
      if (typeof raw !== "object" || raw === null) continue;
      const p = raw as Record<string, unknown>;
      const pName = optionalString(p, "ParameterName");
      if (pName === undefined) continue;
      const pValue = optionalString(p, "ParameterValue");
      const applyMethod = optionalString(p, "ApplyMethod") ?? "pending-reboot";
      const idx = group.Parameters.findIndex(
        (ep) => ep.ParameterName === pName,
      );
      if (idx >= 0) {
        if (pValue !== undefined) group.Parameters[idx].ParameterValue = pValue;
        group.Parameters[idx].ApplyMethod = applyMethod;
      } else {
        group.Parameters.push({
          ParameterName: pName,
          ParameterValue: pValue ?? "",
          ApplyType: optionalString(p, "ApplyType") ?? "dynamic",
          DataType: optionalString(p, "DataType") ?? "string",
          IsModifiable: true,
          ApplyMethod: applyMethod,
        });
      }
    }
  }
  ctx.store.set(parameterGroupKey(name), group);
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
  const resetAll = booleanOr(input, "ResetAllParameters", false);
  if (resetAll) {
    group.Parameters = [];
  } else {
    const rawParams = input["Parameters"];
    if (Array.isArray(rawParams)) {
      const namesToReset = new Set(
        rawParams
          .filter(
            (p): p is Record<string, unknown> =>
              typeof p === "object" && p !== null,
          )
          .map((p) => optionalString(p, "ParameterName"))
          .filter((n): n is string => n !== undefined),
      );
      group.Parameters = group.Parameters.filter(
        (p) => !namesToReset.has(p.ParameterName),
      );
    }
  }
  ctx.store.set(parameterGroupKey(name), group);
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
    Port: numberOr(input, "Port", engineDefaultPort(engine)),
    EngineVersion:
      optionalString(input, "EngineVersion") ?? engineDefaultVersion(engine),
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
  if (snapshot === undefined) {
    throw awsError(
      "DBClusterSnapshotNotFoundFault",
      `DBClusterSnapshot ${snapshotId} not found.`,
      404,
    );
  }
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
  const snapshotId = requireString(input, "DBSnapshotIdentifier");
  const snapshot = ctx.store.get<StoredDBSnapshot>(snapshotKey(snapshotId));
  if (snapshot === undefined) {
    throw awsError(
      "DBSnapshotNotFound",
      `DBSnapshot ${snapshotId} not found.`,
      404,
    );
  }
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
    BackupRetentionPeriod: 0,
    PreferredBackupWindow: undefined,
    PreferredMaintenanceWindow: undefined,
    VpcSecurityGroups: [],
    DBParameterGroupName: optionalString(input, "DBParameterGroupName"),
    DBSubnetGroupName: optionalString(input, "DBSubnetGroupName"),
    ReadReplicaSourceDBInstanceIdentifier: undefined,
    ReadReplicaDBInstanceIdentifiers: [],
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
    BackupRetentionPeriod: 0,
    PreferredBackupWindow: undefined,
    PreferredMaintenanceWindow: undefined,
    VpcSecurityGroups: [],
    DBParameterGroupName: undefined,
    DBSubnetGroupName: undefined,
    ReadReplicaSourceDBInstanceIdentifier: undefined,
    ReadReplicaDBInstanceIdentifiers: [],
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

const AddSourceIdentifierToSubscription: OperationHandler = (input, ctx) => {
  const subName = requireString(input, "SubscriptionName");
  const sourceId = requireString(input, "SourceIdentifier");
  const sub = requireEventSubscription(ctx, subName);
  if (!sub.SourceIdsList.includes(sourceId)) {
    sub.SourceIdsList.push(sourceId);
  }
  ctx.store.set(eventSubscriptionKey(subName), sub);
  return { EventSubscription: presentEventSubscription(sub) };
};

const CancelExportTask: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ExportTaskIdentifier");
  const task = requireExportTask(ctx, id);
  task.Status = "canceled";
  ctx.store.set(exportTaskKey(id), task);
  return presentExportTask(task);
};

const CopyOptionGroup: OperationHandler = (input, ctx) => {
  const sourceId = requireString(input, "SourceOptionGroupIdentifier");
  const targetId = requireString(input, "TargetOptionGroupIdentifier");
  const desc = requireString(input, "TargetOptionGroupDescription");
  const source = requireOptionGroup(ctx, sourceId);
  const now = new Date().toISOString();
  const newOg: StoredOptionGroup = {
    OptionGroupName: targetId,
    OptionGroupDescription: desc,
    EngineName: source.EngineName,
    MajorEngineVersion: source.MajorEngineVersion,
    Options: [...source.Options],
    AllowsVpcAndNonVpcInstanceMemberships:
      source.AllowsVpcAndNonVpcInstanceMemberships,
    VpcId: source.VpcId,
    OptionGroupArn: optionGroupArnOf(ctx.region, ctx.account, targetId),
    SourceOptionGroup: sourceId,
    SourceAccountId: ctx.account,
    CopyTimestamp: now,
  };
  ctx.store.set(optionGroupKey(targetId), newOg);
  return { OptionGroup: presentOptionGroup(newOg) };
};

const CreateBlueGreenDeployment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "BlueGreenDeploymentName");
  const source = optionalString(input, "Source");
  const now = new Date().toISOString();
  const id = `bgd-${name}`;
  const bg: StoredBlueGreenDeployment = {
    BlueGreenDeploymentIdentifier: id,
    BlueGreenDeploymentName: name,
    Source: source,
    Target: undefined,
    Status: "PROVISIONING",
    StatusDetails: undefined,
    CreateTime: now,
    DeleteTime: undefined,
  };
  ctx.store.set(blueGreenDeploymentKey(id), bg);
  return { BlueGreenDeployment: presentBlueGreenDeployment(bg) };
};

const CreateCustomDBEngineVersion: OperationHandler = (input, ctx) => {
  const engine = requireString(input, "Engine");
  const version = requireString(input, "EngineVersion");
  const family =
    optionalString(input, "DBParameterGroupFamily") ??
    `${engine}${version.split(".")[0]}`;
  const desc = optionalString(input, "Description");
  const bucket = optionalString(input, "DatabaseInstallationFilesS3BucketName");
  const prefix = optionalString(input, "DatabaseInstallationFilesS3Prefix");
  const cev: StoredCustomDBEngineVersion = {
    Engine: engine,
    EngineVersion: version,
    DBParameterGroupFamily: family,
    DBEngineVersionArn: customDBEngineVersionArnOf(
      ctx.region,
      ctx.account,
      engine,
      version,
    ),
    Status: "available",
    Description: desc,
    DatabaseInstallationFilesS3BucketName: bucket,
    DatabaseInstallationFilesS3Prefix: prefix,
  };
  ctx.store.set(customDBEngineVersionKey(engine, version), cev);
  return presentCustomDBEngineVersion(cev);
};

const CreateDBProxy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBProxyName");
  const engineFamily = requireString(input, "EngineFamily");
  const roleArn = requireString(input, "RoleArn");
  const vpcSubnetIds = stringList(input, "VpcSubnetIds");
  const vpcSecurityGroupIds = stringList(input, "VpcSecurityGroupIds");
  const now = new Date().toISOString();
  const proxy: StoredDBProxy = {
    DBProxyName: name,
    DBProxyArn: dbProxyArnOf(ctx.region, ctx.account, name),
    Status: "available",
    Endpoint: `${name}.proxy-${ctx.account}.${ctx.region}.rds.amazonaws.com`,
    VpcId: "vpc-00000000",
    VpcSecurityGroupIds: vpcSecurityGroupIds,
    VpcSubnetIds: vpcSubnetIds,
    Auth: [],
    RoleArn: roleArn,
    EngineFamily: engineFamily,
    IdleClientTimeout: numberOr(input, "IdleClientTimeout", 1800),
    DebugLogging: booleanOr(input, "DebugLogging", false),
    RequireTLS: booleanOr(input, "RequireTLS", false),
    CreatedDate: now,
    UpdatedDate: now,
  };
  ctx.store.set(dbProxyKey(name), proxy);
  const defaultGroup: StoredDBProxyTargetGroup = {
    DBProxyName: name,
    TargetGroupName: "default",
    TargetGroupArn: dbProxyTargetGroupArnOf(
      ctx.region,
      ctx.account,
      name,
      "default",
    ),
    IsDefault: true,
    Status: "available",
    CreatedDate: now,
    UpdatedDate: now,
    Targets: [],
  };
  ctx.store.set(dbProxyTargetGroupKey(name, "default"), defaultGroup);
  return { DBProxy: presentDBProxy(proxy) };
};

const CreateDBProxyEndpoint: OperationHandler = (input, ctx) => {
  const endpointName = requireString(input, "DBProxyEndpointName");
  const proxyName = requireString(input, "DBProxyName");
  requireDBProxy(ctx, proxyName);
  const vpcSubnetIds = stringList(input, "VpcSubnetIds");
  const vpcSecurityGroupIds = stringList(input, "VpcSecurityGroupIds");
  const targetRole = optionalString(input, "TargetRole") ?? "READ_WRITE";
  const now = new Date().toISOString();
  const ep: StoredDBProxyEndpoint = {
    DBProxyEndpointName: endpointName,
    DBProxyEndpointArn: dbProxyEndpointArnOf(
      ctx.region,
      ctx.account,
      endpointName,
    ),
    DBProxyName: proxyName,
    Status: "available",
    VpcId: "vpc-00000000",
    VpcSecurityGroupIds: vpcSecurityGroupIds,
    VpcSubnetIds: vpcSubnetIds,
    Endpoint: `${endpointName}.endpoint.proxy-${ctx.account}.${ctx.region}.rds.amazonaws.com`,
    CreatedDate: now,
    TargetRole: targetRole,
    IsDefault: false,
    EndpointNetworkType: "INSIDE_VPC",
  };
  ctx.store.set(dbProxyEndpointKey(endpointName), ep);
  return { DBProxyEndpoint: presentDBProxyEndpoint(ep) };
};

const CreateDBShardGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBShardGroupIdentifier");
  const clusterId = requireString(input, "DBClusterIdentifier");
  const maxACU = numberOr(input, "MaxACU", 128);
  const minACU =
    input["MinACU"] !== undefined ? numberOr(input, "MinACU", 0) : undefined;
  const computeRedundancy =
    input["ComputeRedundancy"] !== undefined
      ? numberOr(input, "ComputeRedundancy", 0)
      : undefined;
  const resourceId = `shardgroup-${id}`;
  const sg: StoredDBShardGroup = {
    DBShardGroupResourceId: resourceId,
    DBShardGroupIdentifier: id,
    DBClusterIdentifier: clusterId,
    MaxACU: maxACU,
    MinACU: minACU,
    ComputeRedundancy: computeRedundancy,
    Status: "available",
    PubliclyAccessible: booleanOr(input, "PubliclyAccessible", false),
    Endpoint: `${id}.cluster-${ctx.account}.${ctx.region}.rds.amazonaws.com`,
    DBShardGroupArn: dbShardGroupArnOf(ctx.region, ctx.account, id),
  };
  ctx.store.set(dbShardGroupKey(id), sg);
  return presentDBShardGroup(sg);
};

const CreateEventSubscription: OperationHandler = (input, ctx) => {
  const subName = requireString(input, "SubscriptionName");
  const snsArn = requireString(input, "SnsTopicArn");
  const sourceType = optionalString(input, "SourceType");
  const sourceIds = stringList(input, "SourceIds");
  const eventCategories = stringList(input, "EventCategories");
  const enabled = booleanOr(input, "Enabled", true);
  const now = new Date().toISOString();
  const sub: StoredEventSubscription = {
    CustomerAwsId: ctx.account,
    CustSubscriptionId: subName,
    SnsTopicArn: snsArn,
    Status: "active",
    SubscriptionCreationTime: now,
    SourceType: sourceType,
    SourceIdsList: sourceIds,
    EventCategoriesList: eventCategories,
    Enabled: enabled,
    EventSubscriptionArn: eventSubscriptionArnOf(
      ctx.region,
      ctx.account,
      subName,
    ),
  };
  ctx.store.set(eventSubscriptionKey(subName), sub);
  return { EventSubscription: presentEventSubscription(sub) };
};

const CreateGlobalCluster: OperationHandler = (input, ctx) => {
  const gcId = requireString(input, "GlobalClusterIdentifier");
  const resourceId = `cluster-${gcId}`;
  const gc: StoredGlobalCluster = {
    GlobalClusterIdentifier: gcId,
    GlobalClusterResourceId: resourceId,
    GlobalClusterArn: globalClusterArnOf(ctx.region, ctx.account, gcId),
    Status: "available",
    Engine: optionalString(input, "Engine"),
    EngineVersion: optionalString(input, "EngineVersion"),
    DatabaseName: optionalString(input, "DatabaseName"),
    StorageEncrypted: booleanOr(input, "StorageEncrypted", false),
    DeletionProtection: booleanOr(input, "DeletionProtection", false),
    GlobalClusterMembers: [],
  };
  ctx.store.set(globalClusterKey(gcId), gc);
  return { GlobalCluster: presentGlobalCluster(gc) };
};

const CreateIntegration: OperationHandler = (input, ctx) => {
  const sourceArn = requireString(input, "SourceArn");
  const targetArn = requireString(input, "TargetArn");
  const name = requireString(input, "IntegrationName");
  const now = new Date().toISOString();
  const id = `integration-${name}`;
  const arn = integrationArnOf(ctx.region, ctx.account, id);
  const intg: StoredIntegration = {
    SourceArn: sourceArn,
    TargetArn: targetArn,
    IntegrationName: name,
    IntegrationArn: arn,
    KMSKeyId: optionalString(input, "KMSKeyId"),
    Status: "active",
    DataFilter: optionalString(input, "DataFilter"),
    Description: optionalString(input, "Description"),
    CreateTime: now,
  };
  ctx.store.set(integrationKey(arn), intg);
  return presentIntegration(intg);
};

const CreateOptionGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "OptionGroupName");
  const engine = requireString(input, "EngineName");
  const majorVersion = requireString(input, "MajorEngineVersion");
  const desc = requireString(input, "OptionGroupDescription");
  const og: StoredOptionGroup = {
    OptionGroupName: name,
    OptionGroupDescription: desc,
    EngineName: engine,
    MajorEngineVersion: majorVersion,
    Options: [],
    AllowsVpcAndNonVpcInstanceMemberships: true,
    VpcId: undefined,
    OptionGroupArn: optionGroupArnOf(ctx.region, ctx.account, name),
    SourceOptionGroup: undefined,
    SourceAccountId: undefined,
    CopyTimestamp: undefined,
  };
  ctx.store.set(optionGroupKey(name), og);
  return { OptionGroup: presentOptionGroup(og) };
};

const CreateTenantDatabase: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "DBInstanceIdentifier");
  const dbName = requireString(input, "TenantDBName");
  const masterUser = requireString(input, "MasterUsername");
  requireInstance(ctx, instanceId);
  const now = new Date().toISOString();
  const resourceId = `tenantdb-${instanceId}-${dbName}`;
  const td: StoredTenantDatabase = {
    TenantDatabaseCreateTime: now,
    DBInstanceIdentifier: instanceId,
    TenantDBName: dbName,
    Status: "available",
    MasterUsername: masterUser,
    DbiResourceId: `db-${instanceId}`,
    TenantDatabaseResourceId: resourceId,
    TenantDatabaseARN: tenantDatabaseArnOf(
      ctx.region,
      ctx.account,
      instanceId,
      dbName,
    ),
    CharacterSetName: optionalString(input, "CharacterSetName"),
    NcharCharacterSetName: optionalString(input, "NcharCharacterSetName"),
  };
  ctx.store.set(tenantDatabaseKey(instanceId, dbName), td);
  return { TenantDatabase: presentTenantDatabase(td) };
};

const DeleteBlueGreenDeployment: OperationHandler = (input, ctx) => {
  const id = requireString(input, "BlueGreenDeploymentIdentifier");
  const bg = requireBlueGreenDeployment(ctx, id);
  ctx.store.delete(blueGreenDeploymentKey(id));
  bg.Status = "DELETING";
  return { BlueGreenDeployment: presentBlueGreenDeployment(bg) };
};

const DeleteCustomDBEngineVersion: OperationHandler = (input, ctx) => {
  const engine = requireString(input, "Engine");
  const version = requireString(input, "EngineVersion");
  const cev = ctx.store.get<StoredCustomDBEngineVersion>(
    customDBEngineVersionKey(engine, version),
  );
  if (cev === undefined) {
    throw awsError(
      "CustomDBEngineVersionNotFoundFault",
      `Custom engine version ${engine}/${version} not found.`,
      404,
    );
  }
  ctx.store.delete(customDBEngineVersionKey(engine, version));
  return presentCustomDBEngineVersion({ ...cev, Status: "deleting" });
};

const DeleteDBProxy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBProxyName");
  const proxy = requireDBProxy(ctx, name);
  ctx.store.delete(dbProxyKey(name));
  return { DBProxy: presentDBProxy({ ...proxy, Status: "deleting" }) };
};

const DeleteDBProxyEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBProxyEndpointName");
  const ep = requireDBProxyEndpoint(ctx, name);
  ctx.store.delete(dbProxyEndpointKey(name));
  return {
    DBProxyEndpoint: presentDBProxyEndpoint({ ...ep, Status: "deleting" }),
  };
};

const DeleteDBShardGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBShardGroupIdentifier");
  const sg = requireDBShardGroup(ctx, id);
  ctx.store.delete(dbShardGroupKey(id));
  return presentDBShardGroup({ ...sg, Status: "deleting" });
};

const DeleteEventSubscription: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SubscriptionName");
  const sub = requireEventSubscription(ctx, name);
  ctx.store.delete(eventSubscriptionKey(name));
  return {
    EventSubscription: presentEventSubscription({ ...sub, Status: "deleting" }),
  };
};

const DeleteGlobalCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GlobalClusterIdentifier");
  const gc = requireGlobalCluster(ctx, id);
  ctx.store.delete(globalClusterKey(id));
  return { GlobalCluster: presentGlobalCluster({ ...gc, Status: "deleting" }) };
};

const DeleteIntegration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "IntegrationIdentifier");
  const intg = requireIntegration(ctx, arn);
  ctx.store.delete(integrationKey(arn));
  return presentIntegration({ ...intg, Status: "deleting" });
};

const DeleteOptionGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "OptionGroupName");
  requireOptionGroup(ctx, name);
  ctx.store.delete(optionGroupKey(name));
  return {};
};

const DeleteTenantDatabase: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "DBInstanceIdentifier");
  const dbName = requireString(input, "TenantDBName");
  const td = ctx.store.get<StoredTenantDatabase>(
    tenantDatabaseKey(instanceId, dbName),
  );
  if (td === undefined) {
    throw awsError(
      "TenantDatabaseNotFound",
      `TenantDatabase ${dbName} not found on instance ${instanceId}.`,
      404,
    );
  }
  ctx.store.delete(tenantDatabaseKey(instanceId, dbName));
  return {
    TenantDatabase: presentTenantDatabase({ ...td, Status: "deleting" }),
  };
};

const DeregisterDBProxyTargets: OperationHandler = (input, ctx) => {
  const proxyName = requireString(input, "DBProxyName");
  requireDBProxy(ctx, proxyName);
  const groupName = optionalString(input, "TargetGroupName") ?? "default";
  const key = dbProxyTargetGroupKey(proxyName, groupName);
  const group = ctx.store.get<StoredDBProxyTargetGroup>(key);
  if (group !== undefined) {
    group.Targets = [];
    ctx.store.set(key, group);
  }
  return {};
};

const DescribeBlueGreenDeployments: OperationHandler = (_input, ctx) => {
  const all = ctx.store
    .list<StoredBlueGreenDeployment>()
    .filter((e) => e.key.startsWith("bluegreendeployment/"))
    .map((e) => presentBlueGreenDeployment(e.value));
  return { BlueGreenDeployments: all };
};

const DescribeCertificates: OperationHandler = (_input, _ctx) => {
  return {
    Certificates: [
      {
        CertificateIdentifier: "rds-ca-2019",
        CertificateType: "CA",
        Thumbprint: "0000000000000000000000000000000000000000",
        ValidFrom: "2019-09-19T00:00:00Z",
        ValidTill: "2024-08-22T00:00:00Z",
        CertificateArn: "arn:aws:rds::123456789012:cert:rds-ca-2019",
        CustomerOverride: false,
        CustomerOverrideValidTill: undefined,
      },
    ],
    DefaultCertificateForNewLaunches: "rds-ca-rsa2048-g1",
  };
};

const DescribeDBEngineVersions: OperationHandler = (_input, _ctx) => {
  return {
    DBEngineVersions: [
      {
        Engine: "mysql",
        MajorEngineVersion: "8.0",
        EngineVersion: "8.0.28",
        DBParameterGroupFamily: "mysql8.0",
        DBEngineDescription: "MySQL Community Edition",
        DBEngineVersionDescription: "MySQL 8.0.28",
      },
      {
        Engine: "postgres",
        MajorEngineVersion: "14",
        EngineVersion: "14.2",
        DBParameterGroupFamily: "postgres14",
        DBEngineDescription: "PostgreSQL",
        DBEngineVersionDescription: "PostgreSQL 14.2-R1",
      },
    ],
  };
};

const DescribeDBMajorEngineVersions: OperationHandler = (_input, _ctx) => {
  return {
    DBMajorEngineVersions: [
      {
        Engine: "mysql",
        MajorEngineVersion: "8.0",
        SupportedEngineLifecycles: [],
      },
      {
        Engine: "postgres",
        MajorEngineVersion: "14",
        SupportedEngineLifecycles: [],
      },
    ],
  };
};

const DescribeDBProxyEndpoints: OperationHandler = (input, ctx) => {
  const proxyName = optionalString(input, "DBProxyName");
  const all = ctx.store
    .list<StoredDBProxyEndpoint>()
    .filter(
      (e) =>
        e.key.startsWith("dbproxyendpoint/") &&
        (proxyName === undefined || e.value.DBProxyName === proxyName),
    )
    .map((e) => presentDBProxyEndpoint(e.value));
  return { DBProxyEndpoints: all };
};

const DescribeDBProxyTargetGroups: OperationHandler = (input, ctx) => {
  const proxyName = requireString(input, "DBProxyName");
  const prefix = `dbproxytargetgroup/${proxyName}/`;
  const all = ctx.store
    .list<StoredDBProxyTargetGroup>()
    .filter((e) => e.key.startsWith(prefix))
    .map((g) => ({
      DBProxyName: g.value.DBProxyName,
      TargetGroupName: g.value.TargetGroupName,
      TargetGroupArn: g.value.TargetGroupArn,
      IsDefault: g.value.IsDefault,
      Status: g.value.Status,
      CreatedDate: g.value.CreatedDate,
      UpdatedDate: g.value.UpdatedDate,
    }));
  return { TargetGroups: all };
};

const DescribeDBProxyTargets: OperationHandler = (input, ctx) => {
  const proxyName = requireString(input, "DBProxyName");
  const groupName = optionalString(input, "TargetGroupName") ?? "default";
  const group = ctx.store.get<StoredDBProxyTargetGroup>(
    dbProxyTargetGroupKey(proxyName, groupName),
  );
  const targets = group?.Targets ?? [];
  return {
    Targets: targets.map((t) => ({
      TargetArn: t.TargetArn,
      Endpoint: t.Endpoint,
      Port: t.Port,
      Type: t.Type,
      Role: t.Role,
      TrackedClusterId: undefined as string | undefined,
      RdsResourceId: undefined as string | undefined,
      TargetHealth: {
        State: "AVAILABLE",
        Reason: undefined,
        Description: undefined,
      },
    })),
  };
};

const DescribeDBRecommendations: OperationHandler = (_input, _ctx) => {
  return { DBRecommendations: [] };
};

const DescribeDBShardGroups: OperationHandler = (_input, ctx) => {
  const all = ctx.store
    .list<StoredDBShardGroup>()
    .filter((e) => e.key.startsWith("dbshardgroup/"))
    .map((e) => presentDBShardGroup(e.value));
  return { DBShardGroups: all };
};

const DescribeDBSnapshotTenantDatabases: OperationHandler = (_input, _ctx) => {
  return { DBSnapshotTenantDatabases: [] };
};

const DescribeEngineDefaultClusterParameters: OperationHandler = (
  input,
  _ctx,
) => {
  const family = optionalString(input, "DBParameterGroupFamily") ?? "aurora8.0";
  return {
    EngineDefaults: {
      DBParameterGroupFamily: family,
      Marker: undefined,
      Parameters: [],
    },
  };
};

const DescribeEngineDefaultParameters: OperationHandler = (input, _ctx) => {
  const family = requireString(input, "DBParameterGroupFamily");
  return {
    EngineDefaults: {
      DBParameterGroupFamily: family,
      Marker: undefined,
      Parameters: [],
    },
  };
};

const DescribeEventCategories: OperationHandler = (_input, _ctx) => {
  return {
    EventCategoriesMapList: [
      {
        SourceType: "db-instance",
        EventCategories: [
          "availability",
          "backup",
          "configuration change",
          "creation",
          "deletion",
          "failover",
          "failure",
          "low storage",
          "maintenance",
          "notification",
          "read replica",
          "recovery",
          "restoration",
          "security",
          "security patching",
        ],
      },
      {
        SourceType: "db-cluster",
        EventCategories: [
          "availability",
          "backup",
          "configuration change",
          "creation",
          "deletion",
          "failover",
          "failure",
          "global-failover",
          "maintenance",
          "notification",
          "read replica",
          "restoration",
        ],
      },
    ],
  };
};

const DescribeEventSubscriptions: OperationHandler = (_input, ctx) => {
  const all = ctx.store
    .list<StoredEventSubscription>()
    .filter((e) => e.key.startsWith("eventsubscription/"))
    .map((e) => presentEventSubscription(e.value));
  return { EventSubscriptionsList: all };
};

const DescribeEvents: OperationHandler = (_input, _ctx) => {
  return { Events: [] };
};

const DescribeExportTasks: OperationHandler = (_input, ctx) => {
  const all = ctx.store
    .list<StoredExportTask>()
    .filter((e) => e.key.startsWith("exporttask/"))
    .map((e) => presentExportTask(e.value));
  return { ExportTasks: all };
};

const DescribeGlobalClusters: OperationHandler = (_input, ctx) => {
  const all = ctx.store
    .list<StoredGlobalCluster>()
    .filter((e) => e.key.startsWith("globalcluster/"))
    .map((e) => presentGlobalCluster(e.value));
  return { GlobalClusters: all };
};

const DescribeIntegrations: OperationHandler = (_input, ctx) => {
  const all = ctx.store
    .list<StoredIntegration>()
    .filter((e) => e.key.startsWith("integration/"))
    .map((e) => presentIntegration(e.value));
  return { Integrations: all };
};

const DescribeOptionGroupOptions: OperationHandler = (input, _ctx) => {
  const engine = requireString(input, "EngineName");
  return {
    OptionGroupOptions: [
      {
        Name: "MEMCACHED",
        Description: "Memcached option for " + engine,
        EngineName: engine,
        MajorEngineVersion: "5.7",
        MinimumRequiredMinorEngineVersion: "0",
        PortRequired: true,
        DefaultPort: 11211,
        OptionsDependedOn: [],
        OptionsConflictsWith: [],
        Persistent: false,
        Permanent: false,
        RequiresAutoMinorEngineVersionUpgrade: false,
        VpcOnly: false,
        SupportsOptionVersionDowngrade: false,
        OptionGroupOptionSettings: [],
        OptionGroupOptionVersions: [],
        CopyableCrossAccount: false,
      },
    ],
  };
};

const DescribeOptionGroups: OperationHandler = (_input, ctx) => {
  const all = ctx.store
    .list<StoredOptionGroup>()
    .filter((e) => e.key.startsWith("optiongroup/"))
    .map((e) => presentOptionGroup(e.value));
  return { OptionGroupsList: all };
};

const DescribeReservedDBInstances: OperationHandler = (_input, ctx) => {
  const all = ctx.store
    .list<StoredReservedDBInstance>()
    .filter((e) => e.key.startsWith("reserveddbinstance/"))
    .map((e) => presentReservedDBInstance(e.value));
  return { ReservedDBInstances: all };
};

const DescribeReservedDBInstancesOfferings: OperationHandler = (
  _input,
  _ctx,
) => {
  return {
    ReservedDBInstancesOfferings: [
      {
        ReservedDBInstancesOfferingId: "offering-mysql-db.t3.micro-1yr",
        DBInstanceClass: "db.t3.micro",
        Duration: 31536000,
        FixedPrice: 100.0,
        UsagePrice: 0.0,
        CurrencyCode: "USD",
        ProductDescription: "mysql",
        OfferingType: "No Upfront",
        MultiAZ: false,
        RecurringCharges: [
          { RecurringChargeAmount: 0.017, RecurringChargeFrequency: "Hourly" },
        ],
      },
    ],
  };
};

const DescribeServerlessV2PlatformVersions: OperationHandler = (
  _input,
  _ctx,
) => {
  return {
    ServerlessV2PlatformVersions: [
      { VersionDescription: "default", PlatformVersion: "1.0" },
    ],
  };
};

const DescribeSourceRegions: OperationHandler = (_input, _ctx) => {
  return {
    SourceRegions: [
      {
        RegionName: "us-east-1",
        Endpoint: "https://rds.us-east-1.amazonaws.com",
        Status: "available",
        SupportsDBInstanceAutomatedBackupsReplication: true,
      },
      {
        RegionName: "us-west-2",
        Endpoint: "https://rds.us-west-2.amazonaws.com",
        Status: "available",
        SupportsDBInstanceAutomatedBackupsReplication: true,
      },
      {
        RegionName: "eu-west-1",
        Endpoint: "https://rds.eu-west-1.amazonaws.com",
        Status: "available",
        SupportsDBInstanceAutomatedBackupsReplication: true,
      },
    ],
  };
};

const DescribeTenantDatabases: OperationHandler = (_input, ctx) => {
  const all = ctx.store
    .list<StoredTenantDatabase>()
    .filter((e) => e.key.startsWith("tenantdatabase/"))
    .map((e) => presentTenantDatabase(e.value));
  return { TenantDatabases: all };
};

const DisableHttpEndpoint: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const parts = resourceArn.split(":");
  const resourceType = parts[5];
  const resourceId = parts[6];
  if (resourceType === "cluster") {
    const cluster = ctx.store.get<StoredDBCluster>(clusterKey(resourceId));
    if (cluster === undefined) {
      throw awsError(
        "InvalidResourceStateFault",
        `Resource ${resourceArn} not found.`,
        404,
      );
    }
  }
  return { ResourceArn: resourceArn, HttpEndpointEnabled: false };
};

const EnableHttpEndpoint: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const parts = resourceArn.split(":");
  const resourceType = parts[5];
  const resourceId = parts[6];
  if (resourceType === "cluster") {
    const cluster = ctx.store.get<StoredDBCluster>(clusterKey(resourceId));
    if (cluster === undefined) {
      throw awsError(
        "InvalidResourceStateFault",
        `Resource ${resourceArn} not found.`,
        404,
      );
    }
  }
  return { ResourceArn: resourceArn, HttpEndpointEnabled: true };
};

const FailoverGlobalCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GlobalClusterIdentifier");
  const gc = requireGlobalCluster(ctx, id);
  gc.Status = "failing-over";
  ctx.store.set(globalClusterKey(id), gc);
  return { GlobalCluster: presentGlobalCluster(gc) };
};

const ModifyActivityStream: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const parts = resourceArn.split(":");
  const resourceId = parts[6];
  const cluster = ctx.store.get<StoredDBCluster>(clusterKey(resourceId));
  if (cluster === undefined) {
    throw awsError(
      "InvalidResourceStateFault",
      `Resource ${resourceArn} not found.`,
      404,
    );
  }
  return {
    KmsKeyId: optionalString(input, "KmsKeyId"),
    KinesisStreamName: `aws-rds-das-${resourceId}`,
    Status: "started",
    EngineNativeAuditFieldsIncluded: booleanOr(
      input,
      "EngineNativeAuditFieldsIncluded",
      false,
    ),
  };
};

const ModifyCertificates: OperationHandler = (input, _ctx) => {
  return {
    Certificate: {
      CertificateIdentifier:
        optionalString(input, "CertificateIdentifier") ?? "rds-ca-rsa2048-g1",
      CertificateType: "CA",
      Thumbprint: "0000000000000000000000000000000000000000",
      ValidFrom: "2023-09-19T00:00:00Z",
      ValidTill: "2028-08-22T00:00:00Z",
      CertificateArn: "arn:aws:rds::123456789012:cert:rds-ca-rsa2048-g1",
      CustomerOverride: true,
      CustomerOverrideValidTill: undefined,
    },
  };
};

const ModifyCustomDBEngineVersion: OperationHandler = (input, ctx) => {
  const engine = requireString(input, "Engine");
  const version = requireString(input, "EngineVersion");
  const cev = ctx.store.get<StoredCustomDBEngineVersion>(
    customDBEngineVersionKey(engine, version),
  );
  if (cev === undefined) {
    throw awsError(
      "CustomDBEngineVersionNotFoundFault",
      `Custom engine version ${engine}/${version} not found.`,
      404,
    );
  }
  if (input["Description"] !== undefined) {
    cev.Description = optionalString(input, "Description");
  }
  if (input["Status"] !== undefined) {
    cev.Status = requireString(input, "Status");
  }
  ctx.store.set(customDBEngineVersionKey(engine, version), cev);
  return presentCustomDBEngineVersion(cev);
};

const ModifyDBProxy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBProxyName");
  const proxy = requireDBProxy(ctx, name);
  const now = new Date().toISOString();
  if (input["RequireTLS"] !== undefined) {
    proxy.RequireTLS = booleanOr(input, "RequireTLS", proxy.RequireTLS);
  }
  if (input["IdleClientTimeout"] !== undefined) {
    proxy.IdleClientTimeout = numberOr(
      input,
      "IdleClientTimeout",
      proxy.IdleClientTimeout,
    );
  }
  if (input["DebugLogging"] !== undefined) {
    proxy.DebugLogging = booleanOr(input, "DebugLogging", proxy.DebugLogging);
  }
  proxy.UpdatedDate = now;
  ctx.store.set(dbProxyKey(name), proxy);
  return { DBProxy: presentDBProxy(proxy) };
};

const ModifyDBProxyEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DBProxyEndpointName");
  const ep = requireDBProxyEndpoint(ctx, name);
  if (input["VpcSecurityGroupIds"] !== undefined) {
    ep.VpcSecurityGroupIds = stringList(input, "VpcSecurityGroupIds");
  }
  ctx.store.set(dbProxyEndpointKey(name), ep);
  return { DBProxyEndpoint: presentDBProxyEndpoint(ep) };
};

const ModifyDBProxyTargetGroup: OperationHandler = (input, ctx) => {
  const proxyName = requireString(input, "DBProxyName");
  const groupName = requireString(input, "TargetGroupName");
  const now = new Date().toISOString();
  const key = dbProxyTargetGroupKey(proxyName, groupName);
  const group = ctx.store.get<StoredDBProxyTargetGroup>(key);
  if (group === undefined) {
    throw awsError(
      "DBProxyTargetGroupNotFoundFault",
      `TargetGroup ${groupName} not found for proxy ${proxyName}.`,
      404,
    );
  }
  group.UpdatedDate = now;
  ctx.store.set(key, group);
  return {
    DBProxyTargetGroup: {
      DBProxyName: group.DBProxyName,
      TargetGroupName: group.TargetGroupName,
      TargetGroupArn: group.TargetGroupArn,
      IsDefault: group.IsDefault,
      Status: group.Status,
      CreatedDate: group.CreatedDate,
      UpdatedDate: group.UpdatedDate,
      ConnectionPoolConfig: {
        MaxConnectionsPercent: 100,
        MaxIdleConnectionsPercent: 50,
        ConnectionBorrowTimeout: 120,
        SessionPinningFilters: [],
        InitQuery: undefined,
      },
    },
  };
};

const ModifyDBRecommendation: OperationHandler = (_input, _ctx) => {
  return {
    DBRecommendation: {
      RecommendationId: "",
      TypeId: "",
      Severity: "informational",
      ResourceArn: "",
      Status: "dismissed",
      CreatedTime: new Date().toISOString(),
      UpdatedTime: new Date().toISOString(),
      Detection: undefined,
      Recommendation: undefined,
      Description: undefined,
      Reason: undefined,
      RecommendedActions: [],
      Category: undefined,
      Source: undefined,
      TypeDetection: undefined,
      TypeRecommendation: undefined,
      Impact: undefined,
      AdditionalInfo: undefined,
      Links: [],
      IssueDetails: undefined,
    },
  };
};

const ModifyDBShardGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBShardGroupIdentifier");
  const sg = requireDBShardGroup(ctx, id);
  if (input["MaxACU"] !== undefined) {
    sg.MaxACU = numberOr(input, "MaxACU", sg.MaxACU);
  }
  if (input["MinACU"] !== undefined) {
    sg.MinACU = numberOr(input, "MinACU", 0);
  }
  ctx.store.set(dbShardGroupKey(id), sg);
  return presentDBShardGroup(sg);
};

const ModifyEventSubscription: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SubscriptionName");
  const sub = requireEventSubscription(ctx, name);
  if (input["SnsTopicArn"] !== undefined) {
    sub.SnsTopicArn = requireString(input, "SnsTopicArn");
  }
  if (input["SourceType"] !== undefined) {
    sub.SourceType = optionalString(input, "SourceType");
  }
  if (input["Enabled"] !== undefined) {
    sub.Enabled = booleanOr(input, "Enabled", sub.Enabled);
  }
  ctx.store.set(eventSubscriptionKey(name), sub);
  return { EventSubscription: presentEventSubscription(sub) };
};

const ModifyGlobalCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GlobalClusterIdentifier");
  const gc = requireGlobalCluster(ctx, id);
  if (input["DeletionProtection"] !== undefined) {
    gc.DeletionProtection = booleanOr(
      input,
      "DeletionProtection",
      gc.DeletionProtection,
    );
  }
  if (input["EngineVersion"] !== undefined) {
    gc.EngineVersion = optionalString(input, "EngineVersion");
  }
  ctx.store.set(globalClusterKey(id), gc);
  return { GlobalCluster: presentGlobalCluster(gc) };
};

const ModifyIntegration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "IntegrationIdentifier");
  const intg = requireIntegration(ctx, arn);
  if (input["Description"] !== undefined) {
    intg.Description = optionalString(input, "Description");
  }
  if (input["DataFilter"] !== undefined) {
    intg.DataFilter = optionalString(input, "DataFilter");
  }
  if (input["IntegrationName"] !== undefined) {
    intg.IntegrationName = requireString(input, "IntegrationName");
  }
  ctx.store.set(integrationKey(arn), intg);
  return presentIntegration(intg);
};

const ModifyOptionGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "OptionGroupName");
  const og = requireOptionGroup(ctx, name);
  const toInclude = (input["OptionsToInclude"] ?? []) as {
    OptionName: string;
    Port?: number;
    OptionVersion?: string;
    OptionSettings?: { Name?: string; Value?: string }[];
    DBSecurityGroupMemberships?: string[];
    VpcSecurityGroupMemberships?: string[];
  }[];
  const toRemove = (input["OptionsToRemove"] ?? []) as string[];
  if (
    input["OptionsToInclude"] === undefined &&
    input["OptionsToRemove"] === undefined
  ) {
    throw awsError(
      "InvalidParameterCombination",
      "At least one option must be added, modified, or removed.",
      400,
    );
  }
  for (const conf of toInclude) {
    const existing = og.Options.find((o) => o.OptionName === conf.OptionName);
    const next: StoredOption = {
      OptionName: conf.OptionName,
      Permanent: existing?.Permanent ?? false,
      Persistent: existing?.Persistent ?? false,
      ...(conf.Port !== undefined ? { Port: conf.Port } : {}),
      ...(conf.OptionVersion !== undefined
        ? { OptionVersion: conf.OptionVersion }
        : {}),
      ...(conf.OptionSettings !== undefined
        ? { OptionSettings: conf.OptionSettings }
        : {}),
      ...(conf.DBSecurityGroupMemberships !== undefined
        ? {
            DBSecurityGroupMemberships: conf.DBSecurityGroupMemberships.map(
              (n) => ({ DBSecurityGroupName: n, Status: "authorized" }),
            ),
          }
        : {}),
      ...(conf.VpcSecurityGroupMemberships !== undefined
        ? {
            VpcSecurityGroupMemberships: conf.VpcSecurityGroupMemberships.map(
              (id) => ({ VpcSecurityGroupId: id, Status: "active" }),
            ),
          }
        : {}),
    };
    if (existing !== undefined) {
      Object.assign(existing, next);
    } else {
      og.Options.push(next);
    }
  }
  for (const optionName of toRemove) {
    const target = og.Options.find((o) => o.OptionName === optionName);
    if (target?.Permanent === true) {
      throw awsError(
        "InvalidOptionGroupStateFault",
        `Cannot remove permanent option ${optionName} from option group ${name}.`,
        400,
      );
    }
  }
  og.Options = og.Options.filter((o) => !toRemove.includes(o.OptionName));
  ctx.store.set(optionGroupKey(name), og);
  return { OptionGroup: presentOptionGroup(og) };
};

const ModifyTenantDatabase: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "DBInstanceIdentifier");
  const dbName = requireString(input, "TenantDBName");
  const td = ctx.store.get<StoredTenantDatabase>(
    tenantDatabaseKey(instanceId, dbName),
  );
  if (td === undefined) {
    throw awsError(
      "TenantDatabaseNotFound",
      `TenantDatabase ${dbName} not found on instance ${instanceId}.`,
      404,
    );
  }
  if (input["NewTenantDBName"] !== undefined) {
    const newName = requireString(input, "NewTenantDBName");
    ctx.store.delete(tenantDatabaseKey(instanceId, dbName));
    td.TenantDBName = newName;
    td.TenantDatabaseARN = tenantDatabaseArnOf(
      ctx.region,
      ctx.account,
      instanceId,
      newName,
    );
    ctx.store.set(tenantDatabaseKey(instanceId, newName), td);
  } else {
    ctx.store.set(tenantDatabaseKey(instanceId, dbName), td);
  }
  return { TenantDatabase: presentTenantDatabase(td) };
};

const PurchaseReservedDBInstancesOffering: OperationHandler = (input, ctx) => {
  const offeringId = requireString(input, "ReservedDBInstancesOfferingId");
  const reservedId =
    optionalString(input, "ReservedDBInstanceId") ?? `ri-${offeringId}`;
  const count = numberOr(input, "DBInstanceCount", 1);
  const now = new Date().toISOString();
  const ri: StoredReservedDBInstance = {
    ReservedDBInstanceId: reservedId,
    ReservedDBInstancesOfferingId: offeringId,
    DBInstanceClass: "db.t3.micro",
    StartTime: now,
    Duration: 31536000,
    FixedPrice: 100.0,
    UsagePrice: 0.0,
    CurrencyCode: "USD",
    DBInstanceCount: count,
    ProductDescription: "mysql",
    OfferingType: "No Upfront",
    MultiAZ: false,
    State: "active",
    ReservedDBInstanceArn: reservedDBInstanceArnOf(
      ctx.region,
      ctx.account,
      reservedId,
    ),
  };
  ctx.store.set(reservedDBInstanceKey(reservedId), ri);
  return { ReservedDBInstance: presentReservedDBInstance(ri) };
};

const RebootDBShardGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DBShardGroupIdentifier");
  const sg = requireDBShardGroup(ctx, id);
  return presentDBShardGroup(sg);
};

const RegisterDBProxyTargets: OperationHandler = (input, ctx) => {
  const proxyName = requireString(input, "DBProxyName");
  requireDBProxy(ctx, proxyName);
  const groupName = optionalString(input, "TargetGroupName") ?? "default";
  const key = dbProxyTargetGroupKey(proxyName, groupName);
  const group = ctx.store.get<StoredDBProxyTargetGroup>(key);
  if (group === undefined) {
    throw awsError(
      "DBProxyTargetGroupNotFoundFault",
      `TargetGroup ${groupName} not found for proxy ${proxyName}.`,
      404,
    );
  }
  const dbInstanceIds = stringList(input, "DBInstanceIdentifiers");
  const dbClusterIds = stringList(input, "DBClusterIdentifiers");
  const newTargets: StoredDBProxyTargetGroup["Targets"] = [];
  for (const instanceId of dbInstanceIds) {
    newTargets.push({
      TargetArn: `arn:aws:rds:${ctx.region}:${ctx.account}:db:${instanceId}`,
      Endpoint: `${instanceId}.${ctx.account}.${ctx.region}.rds.amazonaws.com`,
      Port: 3306,
      Type: "RDS_INSTANCE",
      Role: "READ_WRITE",
    });
  }
  for (const clusterId of dbClusterIds) {
    newTargets.push({
      TargetArn: `arn:aws:rds:${ctx.region}:${ctx.account}:cluster:${clusterId}`,
      Endpoint: `${clusterId}.cluster-${ctx.account}.${ctx.region}.rds.amazonaws.com`,
      Port: 3306,
      Type: "TRACKED_CLUSTER",
      Role: "READ_WRITE",
    });
  }
  group.Targets.push(...newTargets);
  ctx.store.set(key, group);
  return {
    DBProxyTargets: newTargets.map((t) => ({
      TargetArn: t.TargetArn,
      Endpoint: t.Endpoint,
      Port: t.Port,
      Type: t.Type,
      Role: t.Role,
      TrackedClusterId: undefined as string | undefined,
      RdsResourceId: undefined as string | undefined,
      TargetHealth: {
        State: "REGISTERING",
        Reason: undefined,
        Description: undefined,
      },
    })),
  };
};

const RemoveFromGlobalCluster: OperationHandler = (input, ctx) => {
  const gcId = requireString(input, "GlobalClusterIdentifier");
  const gc = requireGlobalCluster(ctx, gcId);
  const dbClusterArn = optionalString(input, "DbClusterIdentifier");
  if (dbClusterArn !== undefined) {
    gc.GlobalClusterMembers = gc.GlobalClusterMembers.filter(
      (m) => m.DBClusterArn !== dbClusterArn,
    );
    ctx.store.set(globalClusterKey(gcId), gc);
  }
  return { GlobalCluster: presentGlobalCluster(gc) };
};

const RemoveSourceIdentifierFromSubscription: OperationHandler = (
  input,
  ctx,
) => {
  const subName = requireString(input, "SubscriptionName");
  const sourceId = requireString(input, "SourceIdentifier");
  const sub = requireEventSubscription(ctx, subName);
  sub.SourceIdsList = sub.SourceIdsList.filter((id) => id !== sourceId);
  ctx.store.set(eventSubscriptionKey(subName), sub);
  return { EventSubscription: presentEventSubscription(sub) };
};

const StartActivityStream: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const kmsKeyId = requireString(input, "KmsKeyId");
  const parts = resourceArn.split(":");
  const resourceId = parts[6];
  const cluster = ctx.store.get<StoredDBCluster>(clusterKey(resourceId));
  if (cluster === undefined) {
    throw awsError(
      "InvalidResourceStateFault",
      `Resource ${resourceArn} not found.`,
      404,
    );
  }
  return {
    KmsKeyId: kmsKeyId,
    KinesisStreamName: `aws-rds-das-${resourceId}`,
    Status: "starting",
    Mode: requireString(input, "Mode"),
    ApplyImmediately: booleanOr(input, "ApplyImmediately", false),
    EngineNativeAuditFieldsIncluded: booleanOr(
      input,
      "EngineNativeAuditFieldsIncluded",
      false,
    ),
  };
};

const StartExportTask: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ExportTaskIdentifier");
  const sourceArn = requireString(input, "SourceArn");
  const s3Bucket = requireString(input, "S3BucketName");
  const iamRoleArn = requireString(input, "IamRoleArn");
  const kmsKeyId = requireString(input, "KmsKeyId");
  const now = new Date().toISOString();
  const task: StoredExportTask = {
    ExportTaskIdentifier: id,
    SourceArn: sourceArn,
    ExportOnly: stringList(input, "ExportOnly"),
    S3Bucket: s3Bucket,
    S3Prefix: optionalString(input, "S3Prefix"),
    IamRoleArn: iamRoleArn,
    KmsKeyId: kmsKeyId,
    Status: "starting",
    TaskStartTime: now,
    TaskEndTime: undefined,
    SnapshotTime: undefined,
    PercentProgress: 0,
    TotalExtractedDataInGB: 0,
  };
  ctx.store.set(exportTaskKey(id), task);
  return presentExportTask(task);
};

const StopActivityStream: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const parts = resourceArn.split(":");
  const resourceId = parts[6];
  const cluster = ctx.store.get<StoredDBCluster>(clusterKey(resourceId));
  if (cluster === undefined) {
    throw awsError(
      "InvalidResourceStateFault",
      `Resource ${resourceArn} not found.`,
      404,
    );
  }
  return {
    KmsKeyId: undefined as string | undefined,
    KinesisStreamName: `aws-rds-das-${resourceId}`,
    Status: "stopping",
  };
};

const SwitchoverBlueGreenDeployment: OperationHandler = (input, ctx) => {
  const id = requireString(input, "BlueGreenDeploymentIdentifier");
  const bg = requireBlueGreenDeployment(ctx, id);
  bg.Status = "SWITCHOVER_IN_PROGRESS";
  ctx.store.set(blueGreenDeploymentKey(id), bg);
  return { BlueGreenDeployment: presentBlueGreenDeployment(bg) };
};

const SwitchoverGlobalCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GlobalClusterIdentifier");
  const gc = requireGlobalCluster(ctx, id);
  gc.Status = "switching-over";
  ctx.store.set(globalClusterKey(id), gc);
  return { GlobalCluster: presentGlobalCluster(gc) };
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
    AddSourceIdentifierToSubscription,
    CancelExportTask,
    CopyOptionGroup,
    CreateBlueGreenDeployment,
    CreateCustomDBEngineVersion,
    CreateDBProxy,
    CreateDBProxyEndpoint,
    CreateDBShardGroup,
    CreateEventSubscription,
    CreateGlobalCluster,
    CreateIntegration,
    CreateOptionGroup,
    CreateTenantDatabase,
    DeleteBlueGreenDeployment,
    DeleteCustomDBEngineVersion,
    DeleteDBProxy,
    DeleteDBProxyEndpoint,
    DeleteDBShardGroup,
    DeleteEventSubscription,
    DeleteGlobalCluster,
    DeleteIntegration,
    DeleteOptionGroup,
    DeleteTenantDatabase,
    DeregisterDBProxyTargets,
    DescribeBlueGreenDeployments,
    DescribeCertificates,
    DescribeDBEngineVersions,
    DescribeDBMajorEngineVersions,
    DescribeDBProxyEndpoints,
    DescribeDBProxyTargetGroups,
    DescribeDBProxyTargets,
    DescribeDBRecommendations,
    DescribeDBShardGroups,
    DescribeDBSnapshotTenantDatabases,
    DescribeEngineDefaultClusterParameters,
    DescribeEngineDefaultParameters,
    DescribeEventCategories,
    DescribeEventSubscriptions,
    DescribeEvents,
    DescribeExportTasks,
    DescribeGlobalClusters,
    DescribeIntegrations,
    DescribeOptionGroupOptions,
    DescribeOptionGroups,
    DescribeReservedDBInstances,
    DescribeReservedDBInstancesOfferings,
    DescribeServerlessV2PlatformVersions,
    DescribeSourceRegions,
    DescribeTenantDatabases,
    DisableHttpEndpoint,
    EnableHttpEndpoint,
    FailoverGlobalCluster,
    ModifyActivityStream,
    ModifyCertificates,
    ModifyCustomDBEngineVersion,
    ModifyDBProxy,
    ModifyDBProxyEndpoint,
    ModifyDBProxyTargetGroup,
    ModifyDBRecommendation,
    ModifyDBShardGroup,
    ModifyEventSubscription,
    ModifyGlobalCluster,
    ModifyIntegration,
    ModifyOptionGroup,
    ModifyTenantDatabase,
    PurchaseReservedDBInstancesOffering,
    RebootDBShardGroup,
    RegisterDBProxyTargets,
    RemoveFromGlobalCluster,
    RemoveSourceIdentifierFromSubscription,
    StartActivityStream,
    StartExportTask,
    StopActivityStream,
    SwitchoverBlueGreenDeployment,
    SwitchoverGlobalCluster,
  },
  model,
} as const;

export default rds;
