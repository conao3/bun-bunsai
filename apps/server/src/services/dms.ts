import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import dmsModel from "../../models/dms.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(dmsModel);

type StoredReplicationInstance = {
  ReplicationInstanceIdentifier: string;
  ReplicationInstanceClass: string;
  ReplicationInstanceStatus: string;
  AllocatedStorage: number;
  InstanceCreateTime: string;
  AvailabilityZone: string;
  ReplicationInstanceArn: string;
  ReplicationInstancePublicIpAddress: string;
  ReplicationInstancePrivateIpAddress: string;
  PubliclyAccessible: boolean;
  MultiAZ: boolean;
  EngineVersion: string;
  AutoMinorVersionUpgrade: boolean;
  KmsKeyId: string | undefined;
  VpcSecurityGroups: { VpcSecurityGroupId: string; Status: string }[];
  PreferredMaintenanceWindow: string;
  ReplicationSubnetGroupIdentifier: string | undefined;
};

type StoredEndpoint = {
  EndpointIdentifier: string;
  EndpointType: string;
  EngineName: string;
  EndpointArn: string;
  Status: string;
  Username: string | undefined;
  ServerName: string | undefined;
  Port: number | undefined;
  DatabaseName: string | undefined;
  ExtraConnectionAttributes: string | undefined;
  KmsKeyId: string | undefined;
  CertificateArn: string | undefined;
  SslMode: string;
};

type StoredReplicationTask = {
  ReplicationTaskIdentifier: string;
  SourceEndpointArn: string;
  TargetEndpointArn: string;
  ReplicationInstanceArn: string;
  MigrationType: string;
  TableMappings: string;
  ReplicationTaskSettings: string | undefined;
  ReplicationTaskArn: string;
  Status: string;
  StopReason: string | undefined;
  ReplicationTaskCreationDate: string;
  ReplicationTaskStartDate: string | undefined;
  LastFailureMessage: string | undefined;
};

type StoredReplicationSubnetGroup = {
  ReplicationSubnetGroupIdentifier: string;
  ReplicationSubnetGroupDescription: string;
  VpcId: string;
  SubnetGroupStatus: string;
  ReplicationSubnetGroupArn: string;
};

type StoredCertificate = {
  CertificateIdentifier: string;
  CertificateArn: string;
  CertificateCreationDate: string;
  CertificatePem: string | undefined;
  KeyLength: number;
  SigningAlgorithm: string;
  ValidFromDate: string;
  ValidToDate: string;
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
  SubscriptionArn: string;
};

type StoredReplicationConfig = {
  ReplicationConfigIdentifier: string;
  ReplicationConfigArn: string;
  SourceEndpointArn: string;
  TargetEndpointArn: string;
  ReplicationType: string;
  TableMappings: string;
  ReplicationSettings: string | undefined;
  Status: string;
};

type StoredDataMigration = {
  DataMigrationName: string;
  DataMigrationArn: string;
  DataMigrationType: string | undefined;
  Status: string;
  MigrationProjectArn: string | undefined;
};

type StoredDataProvider = {
  DataProviderName: string;
  DataProviderArn: string;
  DataProviderCreationTime: string;
  Engine: string;
  Description: string | undefined;
};

type StoredInstanceProfile = {
  InstanceProfileArn: string;
  InstanceProfileName: string;
  KmsKeyArn: string | undefined;
  PubliclyAccessible: boolean;
  NetworkType: string | undefined;
  InstanceProfileCreationTime: string;
};

type StoredMigrationProject = {
  MigrationProjectName: string;
  MigrationProjectArn: string;
  MigrationProjectCreationTime: string;
  InstanceProfileArn: string | undefined;
  Description: string | undefined;
};

type StoredConnection = {
  ReplicationInstanceArn: string;
  EndpointArn: string;
  Status: string;
  EndpointIdentifier: string;
  ReplicationInstanceIdentifier: string;
};

const instanceKey = (id: string): string => `instance/${id}`;
const instanceArnKey = (arn: string): string => `instanceArn/${arn}`;
const endpointKey = (id: string): string => `endpoint/${id}`;
const endpointArnKey = (arn: string): string => `endpointArn/${arn}`;
const taskKey = (id: string): string => `task/${id}`;
const taskArnKey = (arn: string): string => `taskArn/${arn}`;
const tagKey = (arn: string): string => `tags/${arn}`;
const subnetGroupKey = (id: string): string => `subnetgroup/${id}`;
const subnetGroupArnKey = (arn: string): string => `subnetgroupArn/${arn}`;
const certificateKey = (id: string): string => `certificate/${id}`;
const certificateArnKey = (arn: string): string => `certificateArn/${arn}`;
const eventSubKey = (name: string): string => `eventsub/${name}`;
const eventSubArnKey = (arn: string): string => `eventsubArn/${arn}`;
const replicationConfigKey = (id: string): string => `replicationconfig/${id}`;
const replicationConfigArnKey = (arn: string): string =>
  `replicationconfigArn/${arn}`;
const dataMigrationKey = (id: string): string => `datamigration/${id}`;
const dataMigrationArnKey = (arn: string): string => `datamigrationArn/${arn}`;
const dataProviderKey = (id: string): string => `dataprovider/${id}`;
const dataProviderArnKey = (arn: string): string => `dataproviderArn/${arn}`;
const instanceProfileKey = (id: string): string => `instanceprofile/${id}`;
const instanceProfileArnKey = (arn: string): string =>
  `instanceprofileArn/${arn}`;
const migrationProjectKey = (id: string): string => `migrationproject/${id}`;
const migrationProjectArnKey = (arn: string): string =>
  `migrationprojectArn/${arn}`;
const connectionKey = (instanceArn: string, endpointArn: string): string =>
  `connection/${instanceArn}|${endpointArn}`;

const requireStr = (input: Record<string, unknown>, key: string): string => {
  const v = input[key];
  if (typeof v !== "string" || v === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return v;
};

const optStr = (
  input: Record<string, unknown>,
  key: string,
): string | undefined => {
  const v = input[key];
  return typeof v === "string" && v !== "" ? v : undefined;
};

const optNum = (
  input: Record<string, unknown>,
  key: string,
): number | undefined => {
  const v = input[key];
  return typeof v === "number" ? v : undefined;
};

const optBool = (
  input: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean => {
  const v = input[key];
  return typeof v === "boolean" ? v : fallback;
};

const instanceArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:dms:${region}:${account}:rep:${id}`;

const endpointArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:dms:${region}:${account}:endpoint:${id}`;

const taskArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:dms:${region}:${account}:task:${id}`;

const subnetGroupArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:dms:${region}:${account}:subgrp:${id}`;

const certificateArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:dms:${region}:${account}:cert:${id}`;

const eventSubArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:dms:${region}:${account}:es:${name}`;

const replicationConfigArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:dms:${region}:${account}:replication-config:${id}`;

const dataMigrationArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:dms:${region}:${account}:data-migration:${id}`;

const dataProviderArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:dms:${region}:${account}:data-provider:${id}`;

const instanceProfileArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:dms:${region}:${account}:instance-profile:${id}`;

const migrationProjectArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:dms:${region}:${account}:migration-project:${id}`;

const tagList = (
  input: Record<string, unknown>,
): { Key: string; Value: string }[] => {
  const tags = input["Tags"];
  if (!Array.isArray(tags)) return [];
  return tags
    .filter(
      (t): t is Record<string, unknown> => t !== null && typeof t === "object",
    )
    .map((t) => ({
      Key: String(t["Key"] ?? ""),
      Value: String(t["Value"] ?? ""),
    }));
};

const paginateMarker = <T>(
  items: T[],
  marker: string | undefined,
  maxRecords: number | undefined,
): { items: T[]; nextMarker: string | undefined } => {
  let start = 0;
  if (marker !== undefined) {
    const parsed = Number.parseInt(marker, 10);
    if (!Number.isFinite(parsed)) {
      throw awsError(
        "InvalidParameterCombinationException",
        "Invalid marker.",
        400,
      );
    }
    start = parsed;
  }
  const limit = maxRecords !== undefined && maxRecords > 0 ? maxRecords : 100;
  const sliced = items.slice(start, start + limit);
  const nextMarker =
    start + limit < items.length ? String(start + limit) : undefined;
  return { items: sliced, nextMarker };
};

const applyFilters = <T extends Record<string, unknown>>(
  items: T[],
  filters: unknown,
  fieldMap: Record<string, (item: T) => string | undefined>,
): T[] => {
  if (!Array.isArray(filters) || filters.length === 0) return items;
  return items.filter((item) =>
    filters.every((f) => {
      if (!f || typeof f !== "object") return true;
      const filter = f as Record<string, unknown>;
      const name = String(filter["Name"] ?? "");
      const values = Array.isArray(filter["Values"])
        ? filter["Values"].map(String)
        : [];
      const getter = fieldMap[name];
      if (!getter) return true;
      const val = getter(item);
      return val !== undefined && values.includes(val);
    }),
  );
};

const advanceInstanceStatus = (
  instance: StoredReplicationInstance,
): StoredReplicationInstance => {
  if (instance.ReplicationInstanceStatus === "creating") {
    return { ...instance, ReplicationInstanceStatus: "available" };
  }
  return instance;
};

const advanceTaskStatus = (
  task: StoredReplicationTask,
): StoredReplicationTask => {
  if (task.Status === "creating") {
    return { ...task, Status: "ready" };
  }
  if (task.Status === "starting") {
    return { ...task, Status: "running" };
  }
  return task;
};

const requireInstance = (
  ctx: ServiceContext,
  arn: string,
): StoredReplicationInstance => {
  const inst = ctx.store.get<StoredReplicationInstance>(instanceArnKey(arn));
  if (!inst) {
    throw awsError(
      "ResourceNotFoundFault",
      `Replication instance ${arn} not found.`,
      404,
    );
  }
  return advanceInstanceStatus(inst);
};

const requireEndpoint = (ctx: ServiceContext, arn: string): StoredEndpoint => {
  const ep = ctx.store.get<StoredEndpoint>(endpointArnKey(arn));
  if (!ep) {
    throw awsError("ResourceNotFoundFault", `Endpoint ${arn} not found.`, 404);
  }
  return ep;
};

const requireTask = (
  ctx: ServiceContext,
  arn: string,
): StoredReplicationTask => {
  const task = ctx.store.get<StoredReplicationTask>(taskArnKey(arn));
  if (!task) {
    throw awsError(
      "ResourceNotFoundFault",
      `Replication task ${arn} not found.`,
      404,
    );
  }
  return advanceTaskStatus(task);
};

const requireSubnetGroup = (
  ctx: ServiceContext,
  id: string,
): StoredReplicationSubnetGroup => {
  const sg = ctx.store.get<StoredReplicationSubnetGroup>(subnetGroupKey(id));
  if (!sg)
    throw awsError(
      "ResourceNotFoundFault",
      `Subnet group ${id} not found.`,
      404,
    );
  return sg;
};

const requireCertificateByArn = (
  ctx: ServiceContext,
  arn: string,
): StoredCertificate => {
  const cert = ctx.store.get<StoredCertificate>(certificateArnKey(arn));
  if (!cert)
    throw awsError(
      "ResourceNotFoundFault",
      `Certificate ${arn} not found.`,
      404,
    );
  return cert;
};

const requireEventSub = (
  ctx: ServiceContext,
  name: string,
): StoredEventSubscription => {
  const sub = ctx.store.get<StoredEventSubscription>(eventSubKey(name));
  if (!sub)
    throw awsError(
      "ResourceNotFoundFault",
      `Event subscription ${name} not found.`,
      404,
    );
  return sub;
};

const requireReplicationConfig = (
  ctx: ServiceContext,
  arn: string,
): StoredReplicationConfig => {
  const config = ctx.store.get<StoredReplicationConfig>(
    replicationConfigArnKey(arn),
  );
  if (!config)
    throw awsError(
      "ResourceNotFoundFault",
      `Replication config ${arn} not found.`,
      404,
    );
  return config;
};

const requireDataMigration = (
  ctx: ServiceContext,
  arn: string,
): StoredDataMigration => {
  const dm = ctx.store.get<StoredDataMigration>(dataMigrationArnKey(arn));
  if (!dm)
    throw awsError(
      "ResourceNotFoundFault",
      `Data migration ${arn} not found.`,
      404,
    );
  return dm;
};

const requireDataProvider = (
  ctx: ServiceContext,
  arn: string,
): StoredDataProvider => {
  const dp = ctx.store.get<StoredDataProvider>(dataProviderArnKey(arn));
  if (!dp)
    throw awsError(
      "ResourceNotFoundFault",
      `Data provider ${arn} not found.`,
      404,
    );
  return dp;
};

const requireInstanceProfile = (
  ctx: ServiceContext,
  arn: string,
): StoredInstanceProfile => {
  const ip = ctx.store.get<StoredInstanceProfile>(instanceProfileArnKey(arn));
  if (!ip)
    throw awsError(
      "ResourceNotFoundFault",
      `Instance profile ${arn} not found.`,
      404,
    );
  return ip;
};

const requireMigrationProject = (
  ctx: ServiceContext,
  identifier: string,
): StoredMigrationProject => {
  const byArn = ctx.store.get<StoredMigrationProject>(
    migrationProjectArnKey(identifier),
  );
  if (byArn) return byArn;
  const byId = ctx.store.get<StoredMigrationProject>(
    migrationProjectKey(identifier),
  );
  if (!byId)
    throw awsError(
      "ResourceNotFoundFault",
      `Migration project ${identifier} not found.`,
      404,
    );
  return byId;
};

const isKnownArn = (ctx: ServiceContext, arn: string): boolean =>
  !!(
    ctx.store.get(instanceArnKey(arn)) ||
    ctx.store.get(endpointArnKey(arn)) ||
    ctx.store.get(taskArnKey(arn)) ||
    ctx.store.get(subnetGroupArnKey(arn)) ||
    ctx.store.get(certificateArnKey(arn)) ||
    ctx.store.get(eventSubArnKey(arn)) ||
    ctx.store.get(replicationConfigArnKey(arn)) ||
    ctx.store.get(dataMigrationArnKey(arn)) ||
    ctx.store.get(dataProviderArnKey(arn)) ||
    ctx.store.get(instanceProfileArnKey(arn)) ||
    ctx.store.get(migrationProjectArnKey(arn))
  );

const instanceToResponse = (inst: StoredReplicationInstance) => ({
  ReplicationInstanceIdentifier: inst.ReplicationInstanceIdentifier,
  ReplicationInstanceClass: inst.ReplicationInstanceClass,
  ReplicationInstanceStatus: inst.ReplicationInstanceStatus,
  AllocatedStorage: inst.AllocatedStorage,
  InstanceCreateTime: inst.InstanceCreateTime,
  AvailabilityZone: inst.AvailabilityZone,
  ReplicationInstanceArn: inst.ReplicationInstanceArn,
  ReplicationInstancePublicIpAddresses: [
    inst.ReplicationInstancePublicIpAddress,
  ],
  ReplicationInstancePrivateIpAddresses: [
    inst.ReplicationInstancePrivateIpAddress,
  ],
  ReplicationInstancePublicIpAddress: inst.ReplicationInstancePublicIpAddress,
  ReplicationInstancePrivateIpAddress: inst.ReplicationInstancePrivateIpAddress,
  PubliclyAccessible: inst.PubliclyAccessible,
  MultiAZ: inst.MultiAZ,
  EngineVersion: inst.EngineVersion,
  AutoMinorVersionUpgrade: inst.AutoMinorVersionUpgrade,
  KmsKeyId: inst.KmsKeyId,
  VpcSecurityGroups: inst.VpcSecurityGroups,
  PreferredMaintenanceWindow: inst.PreferredMaintenanceWindow,
  ReplicationSubnetGroup: inst.ReplicationSubnetGroupIdentifier
    ? {
        ReplicationSubnetGroupIdentifier: inst.ReplicationSubnetGroupIdentifier,
      }
    : undefined,
  ReplicationInstanceIpv6Addresses: [],
  FreeUntil: undefined,
  SecondaryAvailabilityZone: undefined,
});

const endpointToResponse = (ep: StoredEndpoint) => ({
  EndpointIdentifier: ep.EndpointIdentifier,
  EndpointType: ep.EndpointType,
  EngineName: ep.EngineName,
  EndpointArn: ep.EndpointArn,
  Status: ep.Status,
  Username: ep.Username,
  ServerName: ep.ServerName,
  Port: ep.Port,
  DatabaseName: ep.DatabaseName,
  ExtraConnectionAttributes: ep.ExtraConnectionAttributes,
  KmsKeyId: ep.KmsKeyId,
  CertificateArn: ep.CertificateArn,
  SslMode: ep.SslMode,
});

const taskToResponse = (task: StoredReplicationTask) => ({
  ReplicationTaskIdentifier: task.ReplicationTaskIdentifier,
  SourceEndpointArn: task.SourceEndpointArn,
  TargetEndpointArn: task.TargetEndpointArn,
  ReplicationInstanceArn: task.ReplicationInstanceArn,
  MigrationType: task.MigrationType,
  TableMappings: task.TableMappings,
  ReplicationTaskSettings: task.ReplicationTaskSettings,
  ReplicationTaskArn: task.ReplicationTaskArn,
  Status: task.Status,
  StopReason: task.StopReason,
  ReplicationTaskCreationDate: task.ReplicationTaskCreationDate,
  ReplicationTaskStartDate: task.ReplicationTaskStartDate,
  LastFailureMessage: task.LastFailureMessage,
  ReplicationTaskStats: {
    FullLoadProgressPercent: 0,
    ElapsedTimeMillis: 0,
    TablesLoaded: 0,
    TablesLoading: 0,
    TablesQueued: 0,
    TablesErrored: 0,
    FreshStartDate: undefined,
    StartDate: undefined,
    StopDate: undefined,
    FullLoadStartDate: undefined,
    FullLoadFinishDate: undefined,
  },
});

const CreateReplicationInstance: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "ReplicationInstanceIdentifier");
  const cls = requireStr(input, "ReplicationInstanceClass");
  if (ctx.store.get(instanceKey(id))) {
    throw awsError(
      "ResourceAlreadyExistsFault",
      `Replication instance ${id} already exists.`,
      400,
    );
  }
  const arn = instanceArnOf(ctx.region, ctx.account, id);
  const now = new Date().toISOString();
  const inst: StoredReplicationInstance = {
    ReplicationInstanceIdentifier: id,
    ReplicationInstanceClass: cls,
    ReplicationInstanceStatus: "creating",
    AllocatedStorage: optNum(input, "AllocatedStorage") ?? 50,
    InstanceCreateTime: now,
    AvailabilityZone: optStr(input, "AvailabilityZone") ?? "us-east-1a",
    ReplicationInstanceArn: arn,
    ReplicationInstancePublicIpAddress: "0.0.0.0",
    ReplicationInstancePrivateIpAddress: "10.0.0.1",
    PubliclyAccessible: optBool(input, "PubliclyAccessible", false),
    MultiAZ: optBool(input, "MultiAZ", false),
    EngineVersion: optStr(input, "EngineVersion") ?? "3.5.2",
    AutoMinorVersionUpgrade: optBool(input, "AutoMinorVersionUpgrade", true),
    KmsKeyId: optStr(input, "KmsKeyId"),
    VpcSecurityGroups: [],
    PreferredMaintenanceWindow:
      optStr(input, "PreferredMaintenanceWindow") ?? "sun:06:00-sun:14:00",
    ReplicationSubnetGroupIdentifier: optStr(
      input,
      "ReplicationSubnetGroupIdentifier",
    ),
  };
  ctx.store.set(instanceKey(id), inst);
  ctx.store.set(instanceArnKey(arn), inst);
  const tags = tagList(input);
  if (tags.length > 0) ctx.store.set(tagKey(arn), tags);
  return {
    ReplicationInstance: instanceToResponse(advanceInstanceStatus(inst)),
  };
};

const DescribeReplicationInstances: OperationHandler = (input, ctx) => {
  const marker = optStr(input, "Marker");
  const maxRecords = optNum(input, "MaxRecords");
  const filters = input["Filters"];
  let instances = ctx.store
    .list<StoredReplicationInstance>()
    .filter((e) => e.key.startsWith("instance/"))
    .map((e) => advanceInstanceStatus(e.value));
  instances = applyFilters(instances, filters, {
    "replication-instance-arn": (i) => i.ReplicationInstanceArn,
    "replication-instance-id": (i) => i.ReplicationInstanceIdentifier,
    "replication-instance-status": (i) => i.ReplicationInstanceStatus,
  });
  const { items, nextMarker } = paginateMarker(instances, marker, maxRecords);
  return {
    Marker: nextMarker,
    ReplicationInstances: items.map(instanceToResponse),
  };
};

const ModifyReplicationInstance: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationInstanceArn");
  const inst = requireInstance(ctx, arn);
  const updated: StoredReplicationInstance = {
    ...inst,
    AllocatedStorage:
      optNum(input, "AllocatedStorage") ?? inst.AllocatedStorage,
    ReplicationInstanceClass:
      optStr(input, "ReplicationInstanceClass") ??
      inst.ReplicationInstanceClass,
    MultiAZ:
      input["MultiAZ"] !== undefined
        ? optBool(input, "MultiAZ", inst.MultiAZ)
        : inst.MultiAZ,
    EngineVersion: optStr(input, "EngineVersion") ?? inst.EngineVersion,
    AutoMinorVersionUpgrade:
      input["AutoMinorVersionUpgrade"] !== undefined
        ? optBool(
            input,
            "AutoMinorVersionUpgrade",
            inst.AutoMinorVersionUpgrade,
          )
        : inst.AutoMinorVersionUpgrade,
    PreferredMaintenanceWindow:
      optStr(input, "PreferredMaintenanceWindow") ??
      inst.PreferredMaintenanceWindow,
  };
  ctx.store.set(instanceKey(inst.ReplicationInstanceIdentifier), updated);
  ctx.store.set(instanceArnKey(arn), updated);
  return { ReplicationInstance: instanceToResponse(updated) };
};

const DeleteReplicationInstance: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationInstanceArn");
  const inst = requireInstance(ctx, arn);
  if (inst.ReplicationInstanceStatus === "deleting") {
    throw awsError(
      "InvalidResourceStateFault",
      `Replication instance ${arn} is already being deleted.`,
      400,
    );
  }
  const hasTask = ctx.store
    .list<StoredReplicationTask>()
    .some(
      (e) =>
        e.key.startsWith("task/") && e.value.ReplicationInstanceArn === arn,
    );
  if (hasTask) {
    throw awsError(
      "InvalidResourceStateFault",
      `Replication instance ${arn} has associated replication tasks.`,
      400,
    );
  }
  const deleted = { ...inst, ReplicationInstanceStatus: "deleting" };
  ctx.store.delete(instanceKey(inst.ReplicationInstanceIdentifier));
  ctx.store.delete(instanceArnKey(arn));
  ctx.store.delete(tagKey(arn));
  return { ReplicationInstance: instanceToResponse(deleted) };
};

const CreateEndpoint: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "EndpointIdentifier");
  const endpointType = requireStr(input, "EndpointType");
  const engineName = requireStr(input, "EngineName");
  if (ctx.store.get(endpointKey(id))) {
    throw awsError(
      "ResourceAlreadyExistsFault",
      `Endpoint ${id} already exists.`,
      400,
    );
  }
  const arn = endpointArnOf(ctx.region, ctx.account, id);
  const ep: StoredEndpoint = {
    EndpointIdentifier: id,
    EndpointType: endpointType,
    EngineName: engineName,
    EndpointArn: arn,
    Status: "active",
    Username: optStr(input, "Username"),
    ServerName: optStr(input, "ServerName"),
    Port: optNum(input, "Port"),
    DatabaseName: optStr(input, "DatabaseName"),
    ExtraConnectionAttributes: optStr(input, "ExtraConnectionAttributes"),
    KmsKeyId: optStr(input, "KmsKeyId"),
    CertificateArn: optStr(input, "CertificateArn"),
    SslMode: optStr(input, "SslMode") ?? "none",
  };
  ctx.store.set(endpointKey(id), ep);
  ctx.store.set(endpointArnKey(arn), ep);
  const tags = tagList(input);
  if (tags.length > 0) ctx.store.set(tagKey(arn), tags);
  return { Endpoint: endpointToResponse(ep) };
};

const DescribeEndpoints: OperationHandler = (input, ctx) => {
  const marker = optStr(input, "Marker");
  const maxRecords = optNum(input, "MaxRecords");
  const filters = input["Filters"];
  let endpoints = ctx.store
    .list<StoredEndpoint>()
    .filter((e) => e.key.startsWith("endpoint/"))
    .map((e) => e.value);
  endpoints = applyFilters(endpoints, filters, {
    "endpoint-arn": (e) => e.EndpointArn,
    "endpoint-id": (e) => e.EndpointIdentifier,
    "endpoint-type": (e) => e.EndpointType,
    "engine-name": (e) => e.EngineName,
  });
  const { items, nextMarker } = paginateMarker(endpoints, marker, maxRecords);
  return {
    Marker: nextMarker,
    Endpoints: items.map(endpointToResponse),
  };
};

const ModifyEndpoint: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "EndpointArn");
  const ep = requireEndpoint(ctx, arn);
  const updated: StoredEndpoint = {
    ...ep,
    EndpointIdentifier:
      optStr(input, "EndpointIdentifier") ?? ep.EndpointIdentifier,
    EndpointType: optStr(input, "EndpointType") ?? ep.EndpointType,
    EngineName: optStr(input, "EngineName") ?? ep.EngineName,
    Username:
      input["Username"] !== undefined ? optStr(input, "Username") : ep.Username,
    ServerName:
      input["ServerName"] !== undefined
        ? optStr(input, "ServerName")
        : ep.ServerName,
    Port: input["Port"] !== undefined ? optNum(input, "Port") : ep.Port,
    DatabaseName:
      input["DatabaseName"] !== undefined
        ? optStr(input, "DatabaseName")
        : ep.DatabaseName,
    ExtraConnectionAttributes:
      input["ExtraConnectionAttributes"] !== undefined
        ? optStr(input, "ExtraConnectionAttributes")
        : ep.ExtraConnectionAttributes,
    CertificateArn:
      input["CertificateArn"] !== undefined
        ? optStr(input, "CertificateArn")
        : ep.CertificateArn,
    SslMode: optStr(input, "SslMode") ?? ep.SslMode,
  };
  if (updated.EndpointIdentifier !== ep.EndpointIdentifier) {
    ctx.store.delete(endpointKey(ep.EndpointIdentifier));
  }
  ctx.store.set(endpointKey(updated.EndpointIdentifier), updated);
  ctx.store.set(endpointArnKey(arn), updated);
  return { Endpoint: endpointToResponse(updated) };
};

const DeleteEndpoint: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "EndpointArn");
  const ep = requireEndpoint(ctx, arn);
  const hasTask = ctx.store
    .list<StoredReplicationTask>()
    .some(
      (e) =>
        e.key.startsWith("task/") &&
        (e.value.SourceEndpointArn === arn ||
          e.value.TargetEndpointArn === arn),
    );
  if (hasTask) {
    throw awsError(
      "InvalidResourceStateFault",
      `Endpoint ${arn} has associated replication tasks.`,
      400,
    );
  }
  ctx.store.delete(endpointKey(ep.EndpointIdentifier));
  ctx.store.delete(endpointArnKey(arn));
  ctx.store.delete(tagKey(arn));
  return { Endpoint: endpointToResponse({ ...ep, Status: "deleting" }) };
};

const TestConnection: OperationHandler = (input, ctx) => {
  const replicationInstanceArn = requireStr(input, "ReplicationInstanceArn");
  const endpointArn = requireStr(input, "EndpointArn");
  const inst = requireInstance(ctx, replicationInstanceArn);
  const ep = requireEndpoint(ctx, endpointArn);
  const conn: StoredConnection = {
    ReplicationInstanceArn: replicationInstanceArn,
    EndpointArn: endpointArn,
    Status: "successful",
    EndpointIdentifier: ep.EndpointIdentifier,
    ReplicationInstanceIdentifier: inst.ReplicationInstanceIdentifier,
  };
  ctx.store.set(connectionKey(replicationInstanceArn, endpointArn), conn);
  return { Connection: { ...conn, LastFailureMessage: undefined } };
};

const DescribeConnections: OperationHandler = (input, ctx) => {
  const marker = optStr(input, "Marker");
  const maxRecords = optNum(input, "MaxRecords");
  const filters = input["Filters"];
  let connections = ctx.store
    .list<StoredConnection>()
    .filter((e) => e.key.startsWith("connection/"))
    .map((e) => e.value);
  if (Array.isArray(filters) && filters.length > 0) {
    connections = connections.filter((c) =>
      (filters as Record<string, unknown>[]).every((f) => {
        const name = String((f as Record<string, unknown>)["Name"] ?? "");
        const values = Array.isArray((f as Record<string, unknown>)["Values"])
          ? ((f as Record<string, unknown>)["Values"] as unknown[]).map(String)
          : [];
        if (name === "endpoint-arn") return values.includes(c.EndpointArn);
        if (name === "replication-instance-arn")
          return values.includes(c.ReplicationInstanceArn);
        return true;
      }),
    );
  }
  const { items, nextMarker } = paginateMarker(connections, marker, maxRecords);
  return {
    Marker: nextMarker,
    Connections: items.map((c) => ({ ...c, LastFailureMessage: undefined })),
  };
};

const CreateReplicationTask: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "ReplicationTaskIdentifier");
  const sourceArn = requireStr(input, "SourceEndpointArn");
  const targetArn = requireStr(input, "TargetEndpointArn");
  const instanceArn = requireStr(input, "ReplicationInstanceArn");
  const migrationType = requireStr(input, "MigrationType");
  const tableMappings = requireStr(input, "TableMappings");
  if (ctx.store.get(taskKey(id))) {
    throw awsError(
      "ResourceAlreadyExistsFault",
      `Replication task ${id} already exists.`,
      400,
    );
  }
  requireEndpoint(ctx, sourceArn);
  requireEndpoint(ctx, targetArn);
  requireInstance(ctx, instanceArn);
  const arn = taskArnOf(ctx.region, ctx.account, id);
  const now = new Date().toISOString();
  const task: StoredReplicationTask = {
    ReplicationTaskIdentifier: id,
    SourceEndpointArn: sourceArn,
    TargetEndpointArn: targetArn,
    ReplicationInstanceArn: instanceArn,
    MigrationType: migrationType,
    TableMappings: tableMappings,
    ReplicationTaskSettings: optStr(input, "ReplicationTaskSettings"),
    ReplicationTaskArn: arn,
    Status: "creating",
    StopReason: undefined,
    ReplicationTaskCreationDate: now,
    ReplicationTaskStartDate: undefined,
    LastFailureMessage: undefined,
  };
  ctx.store.set(taskKey(id), task);
  ctx.store.set(taskArnKey(arn), task);
  const tags = tagList(input);
  if (tags.length > 0) ctx.store.set(tagKey(arn), tags);
  return { ReplicationTask: taskToResponse(advanceTaskStatus(task)) };
};

const DescribeReplicationTasks: OperationHandler = (input, ctx) => {
  const marker = optStr(input, "Marker");
  const maxRecords = optNum(input, "MaxRecords");
  const filters = input["Filters"];
  let tasks = ctx.store
    .list<StoredReplicationTask>()
    .filter((e) => e.key.startsWith("task/"))
    .map((e) => advanceTaskStatus(e.value));
  if (Array.isArray(filters) && filters.length > 0) {
    tasks = tasks.filter((t) =>
      (filters as Record<string, unknown>[]).every((f) => {
        const name = String((f as Record<string, unknown>)["Name"] ?? "");
        const values = Array.isArray((f as Record<string, unknown>)["Values"])
          ? ((f as Record<string, unknown>)["Values"] as unknown[]).map(String)
          : [];
        if (name === "replication-task-arn")
          return values.includes(t.ReplicationTaskArn);
        if (name === "replication-task-id")
          return values.includes(t.ReplicationTaskIdentifier);
        if (name === "migration-type") return values.includes(t.MigrationType);
        if (name === "endpoint-arn")
          return (
            values.includes(t.SourceEndpointArn) ||
            values.includes(t.TargetEndpointArn)
          );
        if (name === "replication-instance-arn")
          return values.includes(t.ReplicationInstanceArn);
        return true;
      }),
    );
  }
  const { items, nextMarker } = paginateMarker(tasks, marker, maxRecords);
  return {
    Marker: nextMarker,
    ReplicationTasks: items.map(taskToResponse),
  };
};

const ModifyReplicationTask: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationTaskArn");
  const task = requireTask(ctx, arn);
  if (!["ready", "stopped", "failed"].includes(task.Status)) {
    throw awsError(
      "InvalidResourceStateFault",
      `Replication task ${arn} cannot be modified in ${task.Status} state.`,
      400,
    );
  }
  const updated: StoredReplicationTask = {
    ...task,
    ReplicationTaskIdentifier:
      optStr(input, "ReplicationTaskIdentifier") ??
      task.ReplicationTaskIdentifier,
    MigrationType: optStr(input, "MigrationType") ?? task.MigrationType,
    TableMappings: optStr(input, "TableMappings") ?? task.TableMappings,
    ReplicationTaskSettings:
      input["ReplicationTaskSettings"] !== undefined
        ? optStr(input, "ReplicationTaskSettings")
        : task.ReplicationTaskSettings,
  };
  if (updated.ReplicationTaskIdentifier !== task.ReplicationTaskIdentifier) {
    ctx.store.delete(taskKey(task.ReplicationTaskIdentifier));
  }
  ctx.store.set(taskKey(updated.ReplicationTaskIdentifier), updated);
  ctx.store.set(taskArnKey(arn), updated);
  return { ReplicationTask: taskToResponse(updated) };
};

const VALID_START_TYPES = [
  "start-replication",
  "resume-processing",
  "reload-target",
];

const StartReplicationTask: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationTaskArn");
  const startType = requireStr(input, "StartReplicationTaskType");
  if (!VALID_START_TYPES.includes(startType)) {
    throw awsError(
      "InvalidResourceStateFault",
      `Invalid StartReplicationTaskType: ${startType}.`,
      400,
    );
  }
  const task = requireTask(ctx, arn);
  if (!["ready", "stopped", "failed"].includes(task.Status)) {
    throw awsError(
      "InvalidResourceStateFault",
      `Replication task ${arn} is not in a startable state (current: ${task.Status}).`,
      400,
    );
  }
  const now = new Date().toISOString();
  const updated: StoredReplicationTask = {
    ...task,
    Status: "starting",
    StopReason: undefined,
    ReplicationTaskStartDate: now,
  };
  ctx.store.set(taskKey(task.ReplicationTaskIdentifier), updated);
  ctx.store.set(taskArnKey(arn), updated);
  return { ReplicationTask: taskToResponse(advanceTaskStatus(updated)) };
};

const StopReplicationTask: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationTaskArn");
  const task = requireTask(ctx, arn);
  if (!["running", "starting"].includes(task.Status)) {
    throw awsError(
      "InvalidResourceStateFault",
      `Replication task ${arn} is not running (current: ${task.Status}).`,
      400,
    );
  }
  const updated: StoredReplicationTask = {
    ...task,
    Status: "stopped",
    StopReason: "Stopped by user",
  };
  ctx.store.set(taskKey(task.ReplicationTaskIdentifier), updated);
  ctx.store.set(taskArnKey(arn), updated);
  return { ReplicationTask: taskToResponse(updated) };
};

const DeleteReplicationTask: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationTaskArn");
  const task = requireTask(ctx, arn);
  if (task.Status === "running") {
    throw awsError(
      "InvalidResourceStateFault",
      `Replication task ${arn} cannot be deleted while running.`,
      400,
    );
  }
  ctx.store.delete(taskKey(task.ReplicationTaskIdentifier));
  ctx.store.delete(taskArnKey(arn));
  ctx.store.delete(tagKey(arn));
  return { ReplicationTask: taskToResponse({ ...task, Status: "deleting" }) };
};

const AddTagsToResource: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ResourceArn");
  const newTags = tagList(input);
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagKey(arn)) ?? [];
  const merged = [...existing];
  for (const tag of newTags) {
    const idx = merged.findIndex((t) => t.Key === tag.Key);
    if (idx >= 0) merged[idx] = tag;
    else merged.push(tag);
  }
  ctx.store.set(tagKey(arn), merged);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = optStr(input, "ResourceArn");
  const arnList = Array.isArray(input["ResourceArnList"])
    ? (input["ResourceArnList"] as unknown[]).map(String)
    : [];
  const arns = arn ? [arn] : arnList;
  if (arns.length === 0) return { TagList: [] };
  const allTags: { Key: string; Value: string; ResourceArn: string }[] = [];
  for (const a of arns) {
    if (!isKnownArn(ctx, a)) {
      throw awsError("ResourceNotFoundFault", `Resource ${a} not found.`, 404);
    }
    const tags =
      ctx.store.get<{ Key: string; Value: string }[]>(tagKey(a)) ?? [];
    for (const t of tags) {
      allTags.push({ Key: t.Key, Value: t.Value, ResourceArn: a });
    }
  }
  return { TagList: allTags };
};

const RemoveTagsFromResource: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ResourceArn");
  const keys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as unknown[]).map(String)
    : [];
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagKey(arn)) ?? [];
  const filtered = existing.filter((t) => !keys.includes(t.Key));
  ctx.store.set(tagKey(arn), filtered);
  return {};
};

const DescribeAccountAttributes: OperationHandler = (_input, _ctx) => ({
  AccountQuotas: [
    { AccountQuotaName: "ReplicationInstances", Used: 0, Max: 20 },
    { AccountQuotaName: "AllocatedStorage", Used: 0, Max: 6000 },
    { AccountQuotaName: "Endpoints", Used: 0, Max: 100 },
  ],
  UniqueAccountIdentifier: "bunsai",
});

const DescribeOrderableReplicationInstances: OperationHandler = (
  _input,
  _ctx,
) => ({
  OrderableReplicationInstances: [
    {
      EngineVersion: "3.5.2",
      ReplicationInstanceClass: "dms.c4.large",
      StorageType: "gp2",
      MinAllocatedStorage: 5,
      MaxAllocatedStorage: 6144,
      DefaultAllocatedStorage: 50,
      IncludedAllocatedStorage: 100,
      AvailabilityZones: ["us-east-1a"],
      ReleaseStatus: "ga",
    },
  ],
});

const DescribeReplicationSubnetGroups: OperationHandler = (input, ctx) => {
  const marker = optStr(input, "Marker");
  const maxRecords = optNum(input, "MaxRecords");
  const groups = ctx.store
    .list<StoredReplicationSubnetGroup>()
    .filter((e) => e.key.startsWith("subnetgroup/"))
    .map((e) => e.value);
  const { items, nextMarker } = paginateMarker(groups, marker, maxRecords);
  return {
    Marker: nextMarker,
    ReplicationSubnetGroups: items.map((g) => ({ ...g, Subnets: [] })),
  };
};

const CreateReplicationSubnetGroup: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "ReplicationSubnetGroupIdentifier");
  const description = requireStr(input, "ReplicationSubnetGroupDescription");
  if (ctx.store.get(subnetGroupKey(id))) {
    throw awsError(
      "ResourceAlreadyExistsFault",
      `Subnet group ${id} already exists.`,
      400,
    );
  }
  const arn = subnetGroupArnOf(ctx.region, ctx.account, id);
  const sg: StoredReplicationSubnetGroup = {
    ReplicationSubnetGroupIdentifier: id,
    ReplicationSubnetGroupDescription: description,
    VpcId: "vpc-default",
    SubnetGroupStatus: "Complete",
    ReplicationSubnetGroupArn: arn,
  };
  ctx.store.set(subnetGroupKey(id), sg);
  ctx.store.set(subnetGroupArnKey(arn), sg);
  const tags = tagList(input);
  if (tags.length > 0) ctx.store.set(tagKey(arn), tags);
  return { ReplicationSubnetGroup: { ...sg, Subnets: [] } };
};

const DeleteReplicationSubnetGroup: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "ReplicationSubnetGroupIdentifier");
  const sg = requireSubnetGroup(ctx, id);
  ctx.store.delete(subnetGroupKey(id));
  ctx.store.delete(subnetGroupArnKey(sg.ReplicationSubnetGroupArn));
  ctx.store.delete(tagKey(sg.ReplicationSubnetGroupArn));
  return {};
};

const ModifyReplicationSubnetGroup: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "ReplicationSubnetGroupIdentifier");
  const sg = requireSubnetGroup(ctx, id);
  const updated: StoredReplicationSubnetGroup = {
    ...sg,
    ReplicationSubnetGroupDescription:
      optStr(input, "ReplicationSubnetGroupDescription") ??
      sg.ReplicationSubnetGroupDescription,
  };
  ctx.store.set(subnetGroupKey(id), updated);
  ctx.store.set(subnetGroupArnKey(sg.ReplicationSubnetGroupArn), updated);
  return { ReplicationSubnetGroup: { ...updated, Subnets: [] } };
};

const DescribeEndpointTypes: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  SupportedEndpointTypes: [
    { EngineName: "mysql", SupportsCDC: true, EndpointType: "source" },
    { EngineName: "postgres", SupportsCDC: true, EndpointType: "source" },
    { EngineName: "oracle", SupportsCDC: true, EndpointType: "source" },
    { EngineName: "mysql", SupportsCDC: false, EndpointType: "target" },
    { EngineName: "postgres", SupportsCDC: false, EndpointType: "target" },
    { EngineName: "s3", SupportsCDC: false, EndpointType: "target" },
  ],
});

const DescribeEndpointSettings: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  EndpointSettings: [],
});

const DescribeEngineVersions: OperationHandler = (_input, _ctx) => ({
  EngineVersions: [
    {
      Version: "3.5.2",
      Lifecycle: "generally-available",
      ReleaseStatus: "ga",
      LaunchDate: "2024-01-01T00:00:00Z",
      AutoUpgradeDate: undefined,
      DeprecationDate: undefined,
      ForceUpgradeDate: undefined,
      AvailableUpgrades: [],
    },
  ],
  Marker: undefined,
});

const DescribeReplicationInstanceTaskLogs: OperationHandler = (
  _input,
  _ctx,
) => ({
  ReplicationInstanceArn: undefined,
  ReplicationInstanceTaskLogs: [],
  Marker: undefined,
});

const DescribeRefreshSchemasStatus: OperationHandler = (_input, _ctx) => ({
  RefreshSchemasStatus: undefined,
});

const DescribeSchemas: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  Schemas: [],
});

const DescribeTableStatistics: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  ReplicationTaskArn: undefined,
  TableStatistics: [],
});

const ReloadTables: OperationHandler = (_input, _ctx) => ({
  ReplicationTaskArn: undefined,
});

const ReloadReplicationTables: OperationHandler = (_input, _ctx) => ({
  ReplicationConfigArn: undefined,
});

const RefreshSchemas: OperationHandler = (_input, _ctx) => ({
  RefreshSchemasStatus: {
    EndpointArn: undefined,
    ReplicationInstanceArn: undefined,
    Status: "successful",
    LastRefreshDate: new Date().toISOString(),
    LastFailureMessage: undefined,
  },
});

const DescribeCertificates: OperationHandler = (input, ctx) => {
  const marker = optStr(input, "Marker");
  const maxRecords = optNum(input, "MaxRecords");
  const certs = ctx.store
    .list<StoredCertificate>()
    .filter((e) => e.key.startsWith("certificate/"))
    .map((e) => e.value);
  const { items, nextMarker } = paginateMarker(certs, marker, maxRecords);
  return {
    Marker: nextMarker,
    Certificates: items.map((c) => ({ ...c, CertificateWallet: undefined })),
  };
};

const ImportCertificate: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "CertificateIdentifier");
  if (ctx.store.get(certificateKey(id))) {
    throw awsError(
      "ResourceAlreadyExistsFault",
      `Certificate ${id} already exists.`,
      400,
    );
  }
  const arn = certificateArnOf(ctx.region, ctx.account, id);
  const now = new Date().toISOString();
  const cert: StoredCertificate = {
    CertificateIdentifier: id,
    CertificateArn: arn,
    CertificateCreationDate: now,
    CertificatePem: optStr(input, "CertificatePem"),
    KeyLength: 2048,
    SigningAlgorithm: "SHA256withRSA",
    ValidFromDate: now,
    ValidToDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };
  ctx.store.set(certificateKey(id), cert);
  ctx.store.set(certificateArnKey(arn), cert);
  const tags = tagList(input);
  if (tags.length > 0) ctx.store.set(tagKey(arn), tags);
  return { Certificate: { ...cert, CertificateWallet: undefined } };
};

const DeleteCertificate: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "CertificateArn");
  const cert = requireCertificateByArn(ctx, arn);
  ctx.store.delete(certificateKey(cert.CertificateIdentifier));
  ctx.store.delete(certificateArnKey(arn));
  ctx.store.delete(tagKey(arn));
  return { Certificate: { ...cert, CertificateWallet: undefined } };
};

const DescribeEventCategories: OperationHandler = (_input, _ctx) => ({
  EventCategoryGroupList: [],
});

const DescribeEventSubscriptions: OperationHandler = (input, ctx) => {
  const marker = optStr(input, "Marker");
  const maxRecords = optNum(input, "MaxRecords");
  const subs = ctx.store
    .list<StoredEventSubscription>()
    .filter((e) => e.key.startsWith("eventsub/"))
    .map((e) => e.value);
  const { items, nextMarker } = paginateMarker(subs, marker, maxRecords);
  return { Marker: nextMarker, EventSubscriptionsList: items };
};

const DescribeEvents: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  Events: [],
});

const CreateEventSubscription: OperationHandler = (input, ctx) => {
  const name = requireStr(input, "SubscriptionName");
  if (ctx.store.get(eventSubKey(name))) {
    throw awsError(
      "ResourceAlreadyExistsFault",
      `Event subscription ${name} already exists.`,
      400,
    );
  }
  const arn = eventSubArnOf(ctx.region, ctx.account, name);
  const sub: StoredEventSubscription = {
    CustomerAwsId: ctx.account,
    CustSubscriptionId: name,
    SnsTopicArn: optStr(input, "SnsTopicArn") ?? "",
    Status: "active",
    SubscriptionCreationTime: new Date().toISOString(),
    SourceType: optStr(input, "SourceType"),
    SourceIdsList: [],
    EventCategoriesList: [],
    Enabled: optBool(input, "Enabled", true),
    SubscriptionArn: arn,
  };
  ctx.store.set(eventSubKey(name), sub);
  ctx.store.set(eventSubArnKey(arn), sub);
  const tags = tagList(input);
  if (tags.length > 0) ctx.store.set(tagKey(arn), tags);
  return { EventSubscription: sub };
};

const ModifyEventSubscription: OperationHandler = (input, ctx) => {
  const name = requireStr(input, "SubscriptionName");
  const sub = requireEventSub(ctx, name);
  const updated: StoredEventSubscription = {
    ...sub,
    SnsTopicArn: optStr(input, "SnsTopicArn") ?? sub.SnsTopicArn,
    SourceType:
      input["SourceType"] !== undefined
        ? optStr(input, "SourceType")
        : sub.SourceType,
    Enabled:
      input["Enabled"] !== undefined
        ? optBool(input, "Enabled", sub.Enabled)
        : sub.Enabled,
  };
  ctx.store.set(eventSubKey(name), updated);
  ctx.store.set(eventSubArnKey(sub.SubscriptionArn), updated);
  return { EventSubscription: updated };
};

const DeleteEventSubscription: OperationHandler = (input, ctx) => {
  const name = requireStr(input, "SubscriptionName");
  const sub = requireEventSub(ctx, name);
  ctx.store.delete(eventSubKey(name));
  ctx.store.delete(eventSubArnKey(sub.SubscriptionArn));
  ctx.store.delete(tagKey(sub.SubscriptionArn));
  return { EventSubscription: sub };
};

const RebootReplicationInstance: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationInstanceArn");
  const inst = requireInstance(ctx, arn);
  return { ReplicationInstance: instanceToResponse(inst) };
};

const ApplyPendingMaintenanceAction: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationInstanceArn");
  requireInstance(ctx, arn);
  return {
    ResourcePendingMaintenanceActions: {
      ResourceIdentifier: arn,
      PendingMaintenanceActionDetails: [],
    },
  };
};

const DescribePendingMaintenanceActions: OperationHandler = (_input, _ctx) => ({
  PendingMaintenanceActions: [],
  Marker: undefined,
});

const MoveReplicationTask: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationTaskArn");
  const task = requireTask(ctx, arn);
  return { ReplicationTask: taskToResponse(task) };
};

const CancelReplicationTaskAssessmentRun: OperationHandler = (
  _input,
  _ctx,
) => ({
  ReplicationTaskAssessmentRun: undefined,
});

const DeleteReplicationTaskAssessmentRun: OperationHandler = (
  _input,
  _ctx,
) => ({
  ReplicationTaskAssessmentRun: undefined,
});

const DescribeApplicableIndividualAssessments: OperationHandler = (
  _input,
  _ctx,
) => ({
  Marker: undefined,
  IndividualAssessmentNames: [],
});

const DescribeReplicationTaskAssessmentResults: OperationHandler = (
  _input,
  _ctx,
) => ({
  Marker: undefined,
  BucketName: undefined,
  ReplicationTaskAssessmentResults: [],
});

const DescribeReplicationTaskAssessmentRuns: OperationHandler = (
  _input,
  _ctx,
) => ({
  Marker: undefined,
  ReplicationTaskAssessmentRuns: [],
});

const DescribeReplicationTaskIndividualAssessments: OperationHandler = (
  _input,
  _ctx,
) => ({
  Marker: undefined,
  ReplicationTaskIndividualAssessments: [],
});

const StartReplicationTaskAssessment: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationTaskArn");
  const task = requireTask(ctx, arn);
  return { ReplicationTask: taskToResponse(task) };
};

const StartReplicationTaskAssessmentRun: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationTaskArn");
  requireTask(ctx, arn);
  return {
    ReplicationTaskAssessmentRun: {
      ReplicationTaskAssessmentRunArn: `arn:aws:dms:${ctx.region}:${ctx.account}:assessmentrun:${Date.now()}`,
      ReplicationTaskArn: arn,
      Status: "running",
      ReplicationTaskAssessmentRunCreationDate: new Date().toISOString(),
      AssessmentProgress: {
        IndividualAssessmentCount: 0,
        IndividualAssessmentCompletedCount: 0,
      },
      LastFailureMessage: undefined,
      ServiceAccessRoleArn: optStr(input, "ServiceAccessRoleArn") ?? "",
      ResultLocationBucket: optStr(input, "ResultLocationBucket") ?? "",
      ResultLocationFolder: optStr(input, "ResultLocationFolder"),
      ResultEncryptionMode: optStr(input, "ResultEncryptionMode") ?? "SSE_S3",
      ResultKmsKeyArn: optStr(input, "ResultKmsKeyArn"),
      AssessmentRunName: optStr(input, "AssessmentRunName") ?? "",
    },
  };
};

const DeleteConnection: OperationHandler = (input, ctx) => {
  const replicationInstanceArn = requireStr(input, "ReplicationInstanceArn");
  const endpointArn = requireStr(input, "EndpointArn");
  const key = connectionKey(replicationInstanceArn, endpointArn);
  const conn = ctx.store.get<StoredConnection>(key);
  if (!conn) {
    throw awsError(
      "ResourceNotFoundFault",
      `Connection between ${replicationInstanceArn} and ${endpointArn} not found.`,
      404,
    );
  }
  ctx.store.delete(key);
  return { Connection: { ...conn, LastFailureMessage: undefined } };
};

const BatchStartRecommendations: OperationHandler = (_input, _ctx) => ({
  ErrorEntries: [],
});

const DescribeRecommendations: OperationHandler = (_input, _ctx) => ({
  NextIdentifier: undefined,
  Recommendations: [],
});

const DescribeRecommendationLimitations: OperationHandler = (_input, _ctx) => ({
  NextIdentifier: undefined,
  Limitations: [],
});

const StartRecommendations: OperationHandler = (_input, _ctx) => ({});

const CreateReplicationConfig: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "ReplicationConfigIdentifier");
  const sourceArn = requireStr(input, "SourceEndpointArn");
  const targetArn = requireStr(input, "TargetEndpointArn");
  const replicationType = requireStr(input, "ReplicationType");
  const tableMappings = requireStr(input, "TableMappings");
  if (ctx.store.get(replicationConfigKey(id))) {
    throw awsError(
      "ResourceAlreadyExistsFault",
      `Replication config ${id} already exists.`,
      400,
    );
  }
  requireEndpoint(ctx, sourceArn);
  requireEndpoint(ctx, targetArn);
  const arn = replicationConfigArnOf(ctx.region, ctx.account, id);
  const config: StoredReplicationConfig = {
    ReplicationConfigIdentifier: id,
    ReplicationConfigArn: arn,
    SourceEndpointArn: sourceArn,
    TargetEndpointArn: targetArn,
    ReplicationType: replicationType,
    TableMappings: tableMappings,
    ReplicationSettings: optStr(input, "ReplicationSettings"),
    Status: "creating",
  };
  ctx.store.set(replicationConfigKey(id), config);
  ctx.store.set(replicationConfigArnKey(arn), config);
  const tags = tagList(input);
  if (tags.length > 0) ctx.store.set(tagKey(arn), tags);
  return { ReplicationConfig: config };
};

const DeleteReplicationConfig: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationConfigArn");
  const config = requireReplicationConfig(ctx, arn);
  ctx.store.delete(replicationConfigKey(config.ReplicationConfigIdentifier));
  ctx.store.delete(replicationConfigArnKey(arn));
  ctx.store.delete(tagKey(arn));
  return { ReplicationConfig: config };
};

const DescribeReplicationConfigs: OperationHandler = (input, ctx) => {
  const marker = optStr(input, "Marker");
  const maxRecords = optNum(input, "MaxRecords");
  const configs = ctx.store
    .list<StoredReplicationConfig>()
    .filter((e) => e.key.startsWith("replicationconfig/"))
    .map((e) => e.value);
  const { items, nextMarker } = paginateMarker(configs, marker, maxRecords);
  return { Marker: nextMarker, ReplicationConfigs: items };
};

const ModifyReplicationConfig: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationConfigArn");
  const config = requireReplicationConfig(ctx, arn);
  const updated: StoredReplicationConfig = {
    ...config,
    ReplicationType: optStr(input, "ReplicationType") ?? config.ReplicationType,
    TableMappings: optStr(input, "TableMappings") ?? config.TableMappings,
    ReplicationSettings:
      input["ReplicationSettings"] !== undefined
        ? optStr(input, "ReplicationSettings")
        : config.ReplicationSettings,
  };
  ctx.store.set(
    replicationConfigKey(config.ReplicationConfigIdentifier),
    updated,
  );
  ctx.store.set(replicationConfigArnKey(arn), updated);
  return { ReplicationConfig: updated };
};

const StartReplication: OperationHandler = (input, _ctx) => ({
  Replication: {
    ReplicationConfigArn: requireStr(input, "ReplicationConfigArn"),
    Status: "starting",
  },
});

const StopReplication: OperationHandler = (input, _ctx) => ({
  Replication: {
    ReplicationConfigArn: requireStr(input, "ReplicationConfigArn"),
    Status: "stopped",
  },
});

const DescribeReplications: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  Replications: [],
});

const DescribeReplicationTableStatistics: OperationHandler = (
  _input,
  _ctx,
) => ({
  Marker: undefined,
  ReplicationConfigArn: undefined,
  ReplicationTableStatistics: [],
});

const CreateDataMigration: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "DataMigrationName");
  if (ctx.store.get(dataMigrationKey(id))) {
    throw awsError(
      "ResourceAlreadyExistsFault",
      `Data migration ${id} already exists.`,
      400,
    );
  }
  const arn = dataMigrationArnOf(ctx.region, ctx.account, id);
  const dm: StoredDataMigration = {
    DataMigrationName: id,
    DataMigrationArn: arn,
    DataMigrationType: optStr(input, "DataMigrationType"),
    Status: "creating",
    MigrationProjectArn: optStr(input, "MigrationProjectIdentifier"),
  };
  ctx.store.set(dataMigrationKey(id), dm);
  ctx.store.set(dataMigrationArnKey(arn), dm);
  const tags = tagList(input);
  if (tags.length > 0) ctx.store.set(tagKey(arn), tags);
  return { DataMigration: dm };
};

const DeleteDataMigration: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "DataMigrationIdentifier");
  const dm = requireDataMigration(ctx, arn);
  ctx.store.delete(dataMigrationKey(dm.DataMigrationName));
  ctx.store.delete(dataMigrationArnKey(arn));
  ctx.store.delete(tagKey(arn));
  return { DataMigration: dm };
};

const DescribeDataMigrations: OperationHandler = (input, ctx) => {
  const marker = optStr(input, "Marker");
  const maxRecords = optNum(input, "MaxRecords");
  const dms = ctx.store
    .list<StoredDataMigration>()
    .filter((e) => e.key.startsWith("datamigration/"))
    .map((e) => e.value);
  const { items, nextMarker } = paginateMarker(dms, marker, maxRecords);
  return { Marker: nextMarker, DataMigrations: items };
};

const ModifyDataMigration: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "DataMigrationIdentifier");
  const dm = requireDataMigration(ctx, arn);
  const updated: StoredDataMigration = {
    ...dm,
    DataMigrationType:
      input["DataMigrationType"] !== undefined
        ? optStr(input, "DataMigrationType")
        : dm.DataMigrationType,
  };
  ctx.store.set(dataMigrationKey(dm.DataMigrationName), updated);
  ctx.store.set(dataMigrationArnKey(arn), updated);
  return { DataMigration: updated };
};

const StartDataMigration: OperationHandler = (input, _ctx) => ({
  DataMigration: {
    DataMigrationArn: requireStr(input, "DataMigrationIdentifier"),
    Status: "running",
  },
});

const StopDataMigration: OperationHandler = (input, _ctx) => ({
  DataMigration: {
    DataMigrationArn: requireStr(input, "DataMigrationIdentifier"),
    Status: "stopped",
  },
});

const CreateDataProvider: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "DataProviderName");
  if (ctx.store.get(dataProviderKey(id))) {
    throw awsError(
      "ResourceAlreadyExistsFault",
      `Data provider ${id} already exists.`,
      400,
    );
  }
  const arn = dataProviderArnOf(ctx.region, ctx.account, id);
  const dp: StoredDataProvider = {
    DataProviderName: id,
    DataProviderArn: arn,
    DataProviderCreationTime: new Date().toISOString(),
    Engine: optStr(input, "Engine") ?? "mysql",
    Description: optStr(input, "Description"),
  };
  ctx.store.set(dataProviderKey(id), dp);
  ctx.store.set(dataProviderArnKey(arn), dp);
  const tags = tagList(input);
  if (tags.length > 0) ctx.store.set(tagKey(arn), tags);
  return { DataProvider: { ...dp, Settings: undefined } };
};

const DeleteDataProvider: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "DataProviderIdentifier");
  const dp = requireDataProvider(ctx, arn);
  ctx.store.delete(dataProviderKey(dp.DataProviderName));
  ctx.store.delete(dataProviderArnKey(arn));
  ctx.store.delete(tagKey(arn));
  return { DataProvider: { ...dp, Settings: undefined } };
};

const DescribeDataProviders: OperationHandler = (input, ctx) => {
  const marker = optStr(input, "Marker");
  const maxRecords = optNum(input, "MaxRecords");
  const providers = ctx.store
    .list<StoredDataProvider>()
    .filter((e) => e.key.startsWith("dataprovider/"))
    .map((e) => e.value);
  const { items, nextMarker } = paginateMarker(providers, marker, maxRecords);
  return {
    Marker: nextMarker,
    DataProviders: items.map((dp) => ({ ...dp, Settings: undefined })),
  };
};

const ModifyDataProvider: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "DataProviderIdentifier");
  const dp = requireDataProvider(ctx, arn);
  const updated: StoredDataProvider = {
    ...dp,
    DataProviderName: optStr(input, "DataProviderName") ?? dp.DataProviderName,
    Engine: optStr(input, "Engine") ?? dp.Engine,
    Description:
      input["Description"] !== undefined
        ? optStr(input, "Description")
        : dp.Description,
  };
  if (updated.DataProviderName !== dp.DataProviderName) {
    ctx.store.delete(dataProviderKey(dp.DataProviderName));
  }
  ctx.store.set(dataProviderKey(updated.DataProviderName), updated);
  ctx.store.set(dataProviderArnKey(arn), updated);
  return { DataProvider: { ...updated, Settings: undefined } };
};

const CreateInstanceProfile: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "InstanceProfileName");
  if (ctx.store.get(instanceProfileKey(id))) {
    throw awsError(
      "ResourceAlreadyExistsFault",
      `Instance profile ${id} already exists.`,
      400,
    );
  }
  const arn = instanceProfileArnOf(ctx.region, ctx.account, id);
  const ip: StoredInstanceProfile = {
    InstanceProfileArn: arn,
    InstanceProfileName: id,
    KmsKeyArn: optStr(input, "KmsKeyId"),
    PubliclyAccessible: optBool(input, "PubliclyAccessible", false),
    NetworkType: optStr(input, "NetworkType"),
    InstanceProfileCreationTime: new Date().toISOString(),
  };
  ctx.store.set(instanceProfileKey(id), ip);
  ctx.store.set(instanceProfileArnKey(arn), ip);
  const tags = tagList(input);
  if (tags.length > 0) ctx.store.set(tagKey(arn), tags);
  return { InstanceProfile: ip };
};

const DeleteInstanceProfile: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "InstanceProfileIdentifier");
  const ip = requireInstanceProfile(ctx, arn);
  ctx.store.delete(instanceProfileKey(ip.InstanceProfileName));
  ctx.store.delete(instanceProfileArnKey(arn));
  ctx.store.delete(tagKey(arn));
  return { InstanceProfile: ip };
};

const DescribeInstanceProfiles: OperationHandler = (input, ctx) => {
  const marker = optStr(input, "Marker");
  const maxRecords = optNum(input, "MaxRecords");
  const profiles = ctx.store
    .list<StoredInstanceProfile>()
    .filter((e) => e.key.startsWith("instanceprofile/"))
    .map((e) => e.value);
  const { items, nextMarker } = paginateMarker(profiles, marker, maxRecords);
  return { Marker: nextMarker, InstanceProfiles: items };
};

const ModifyInstanceProfile: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "InstanceProfileIdentifier");
  const ip = requireInstanceProfile(ctx, arn);
  const updated: StoredInstanceProfile = {
    ...ip,
    InstanceProfileName:
      optStr(input, "InstanceProfileName") ?? ip.InstanceProfileName,
    NetworkType:
      input["NetworkType"] !== undefined
        ? optStr(input, "NetworkType")
        : ip.NetworkType,
  };
  if (updated.InstanceProfileName !== ip.InstanceProfileName) {
    ctx.store.delete(instanceProfileKey(ip.InstanceProfileName));
  }
  ctx.store.set(instanceProfileKey(updated.InstanceProfileName), updated);
  ctx.store.set(instanceProfileArnKey(arn), updated);
  return { InstanceProfile: updated };
};

const CreateMigrationProject: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "MigrationProjectName");
  if (ctx.store.get(migrationProjectKey(id))) {
    throw awsError(
      "ResourceAlreadyExistsFault",
      `Migration project ${id} already exists.`,
      400,
    );
  }
  const arn = migrationProjectArnOf(ctx.region, ctx.account, id);
  const mp: StoredMigrationProject = {
    MigrationProjectName: id,
    MigrationProjectArn: arn,
    MigrationProjectCreationTime: new Date().toISOString(),
    InstanceProfileArn: optStr(input, "InstanceProfileIdentifier"),
    Description: optStr(input, "Description"),
  };
  ctx.store.set(migrationProjectKey(id), mp);
  ctx.store.set(migrationProjectArnKey(arn), mp);
  const tags = tagList(input);
  if (tags.length > 0) ctx.store.set(tagKey(arn), tags);
  return {
    MigrationProject: {
      ...mp,
      SourceDataProviderDescriptors: [],
      TargetDataProviderDescriptors: [],
      SchemaConversionApplicationAttributes: undefined,
      TransformationRules: undefined,
    },
  };
};

const DeleteMigrationProject: OperationHandler = (input, ctx) => {
  const identifier = requireStr(input, "MigrationProjectIdentifier");
  const mp = requireMigrationProject(ctx, identifier);
  ctx.store.delete(migrationProjectKey(mp.MigrationProjectName));
  ctx.store.delete(migrationProjectArnKey(mp.MigrationProjectArn));
  ctx.store.delete(tagKey(mp.MigrationProjectArn));
  return {
    MigrationProject: {
      ...mp,
      SourceDataProviderDescriptors: [],
      TargetDataProviderDescriptors: [],
      SchemaConversionApplicationAttributes: undefined,
      TransformationRules: undefined,
    },
  };
};

const DescribeMigrationProjects: OperationHandler = (input, ctx) => {
  const marker = optStr(input, "Marker");
  const maxRecords = optNum(input, "MaxRecords");
  const projects = ctx.store
    .list<StoredMigrationProject>()
    .filter((e) => e.key.startsWith("migrationproject/"))
    .map((e) => e.value);
  const { items, nextMarker } = paginateMarker(projects, marker, maxRecords);
  return {
    Marker: nextMarker,
    MigrationProjects: items.map((mp) => ({
      ...mp,
      SourceDataProviderDescriptors: [],
      TargetDataProviderDescriptors: [],
      SchemaConversionApplicationAttributes: undefined,
      TransformationRules: undefined,
    })),
  };
};

const ModifyMigrationProject: OperationHandler = (input, ctx) => {
  const identifier = requireStr(input, "MigrationProjectIdentifier");
  const mp = requireMigrationProject(ctx, identifier);
  const updated: StoredMigrationProject = {
    ...mp,
    MigrationProjectName:
      optStr(input, "MigrationProjectName") ?? mp.MigrationProjectName,
    Description:
      input["Description"] !== undefined
        ? optStr(input, "Description")
        : mp.Description,
  };
  if (updated.MigrationProjectName !== mp.MigrationProjectName) {
    ctx.store.delete(migrationProjectKey(mp.MigrationProjectName));
  }
  ctx.store.set(migrationProjectKey(updated.MigrationProjectName), updated);
  ctx.store.set(migrationProjectArnKey(mp.MigrationProjectArn), updated);
  return {
    MigrationProject: {
      ...updated,
      SourceDataProviderDescriptors: [],
      TargetDataProviderDescriptors: [],
      SchemaConversionApplicationAttributes: undefined,
      TransformationRules: undefined,
    },
  };
};

const ExportMetadataModelAssessment: OperationHandler = (_input, _ctx) => ({
  PdfReport: undefined,
  CsvReport: undefined,
});

const DescribeMetadataModel: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  Metadata: [],
});

const DescribeConversionConfiguration: OperationHandler = (_input, _ctx) => ({
  MigrationProjectIdentifier: undefined,
  ConversionConfiguration: undefined,
});

const ModifyConversionConfiguration: OperationHandler = (input, _ctx) => ({
  MigrationProjectIdentifier: optStr(input, "MigrationProjectIdentifier"),
});

const DescribeExtensionPackAssociations: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  Requests: [],
});

const StartExtensionPackAssociation: OperationHandler = (_input, _ctx) => ({
  RequestIdentifier: undefined,
});

const DescribeMetadataModelAssessments: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  Requests: [],
});

const StartMetadataModelAssessment: OperationHandler = (_input, _ctx) => ({
  RequestIdentifier: undefined,
});

const DescribeMetadataModelConversions: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  Requests: [],
});

const StartMetadataModelConversion: OperationHandler = (_input, _ctx) => ({
  RequestIdentifier: undefined,
});

const CancelMetadataModelConversion: OperationHandler = (_input, _ctx) => ({
  RequestIdentifier: undefined,
});

const DescribeMetadataModelCreations: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  Requests: [],
});

const StartMetadataModelCreation: OperationHandler = (_input, _ctx) => ({
  RequestIdentifier: undefined,
});

const CancelMetadataModelCreation: OperationHandler = (_input, _ctx) => ({
  RequestIdentifier: undefined,
});

const DescribeMetadataModelExportsAsScript: OperationHandler = (
  _input,
  _ctx,
) => ({
  Marker: undefined,
  Requests: [],
});

const StartMetadataModelExportAsScript: OperationHandler = (_input, _ctx) => ({
  RequestIdentifier: undefined,
});

const DescribeMetadataModelExportsToTarget: OperationHandler = (
  _input,
  _ctx,
) => ({
  Marker: undefined,
  Requests: [],
});

const StartMetadataModelExportToTarget: OperationHandler = (_input, _ctx) => ({
  RequestIdentifier: undefined,
});

const DescribeMetadataModelImports: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  Requests: [],
});

const StartMetadataModelImport: OperationHandler = (_input, _ctx) => ({
  RequestIdentifier: undefined,
});

const GetTargetSelectionRules: OperationHandler = (_input, _ctx) => ({
  NextToken: undefined,
  TargetSelectionRules: [],
});

const DescribeFleetAdvisorCollectors: OperationHandler = (_input, _ctx) => ({
  Collectors: [],
  NextToken: undefined,
});

const DescribeFleetAdvisorDatabases: OperationHandler = (_input, _ctx) => ({
  Databases: [],
  NextToken: undefined,
});

const DescribeFleetAdvisorLsaAnalysis: OperationHandler = (_input, _ctx) => ({
  Analysis: [],
  NextToken: undefined,
});

const DescribeFleetAdvisorSchemaObjectSummary: OperationHandler = (
  _input,
  _ctx,
) => ({
  FleetAdvisorSchemaObjects: [],
  NextToken: undefined,
});

const DescribeFleetAdvisorSchemas: OperationHandler = (_input, _ctx) => ({
  FleetAdvisorSchemas: [],
  NextToken: undefined,
});

const CreateFleetAdvisorCollector: OperationHandler = (_input, _ctx) => ({
  CollectorReferencedId: undefined,
  CollectorName: undefined,
  Description: undefined,
  ServiceAccessRoleArn: undefined,
  S3BucketName: undefined,
});

const DeleteFleetAdvisorCollector: OperationHandler = (_input, _ctx) => ({});

const DeleteFleetAdvisorDatabases: OperationHandler = (_input, _ctx) => ({
  DatabaseIds: [],
});

const RunFleetAdvisorLsaAnalysis: OperationHandler = (_input, _ctx) => ({
  LsaAnalysisId: undefined,
  Status: undefined,
});

const UpdateSubscriptionsToEventBridge: OperationHandler = (_input, _ctx) => ({
  Result: "Successfully updated subscriptions to EventBridge.",
});

const dms: ServiceDefinition = {
  name: "dms",
  protocol: "json",
  operations: {
    AddTagsToResource,
    ApplyPendingMaintenanceAction,
    BatchStartRecommendations,
    CancelMetadataModelConversion,
    CancelMetadataModelCreation,
    CancelReplicationTaskAssessmentRun,
    CreateDataMigration,
    CreateDataProvider,
    CreateEndpoint,
    CreateEventSubscription,
    CreateFleetAdvisorCollector,
    CreateInstanceProfile,
    CreateMigrationProject,
    CreateReplicationConfig,
    CreateReplicationInstance,
    CreateReplicationSubnetGroup,
    CreateReplicationTask,
    DeleteCertificate,
    DeleteConnection,
    DeleteDataMigration,
    DeleteDataProvider,
    DeleteEndpoint,
    DeleteEventSubscription,
    DeleteFleetAdvisorCollector,
    DeleteFleetAdvisorDatabases,
    DeleteInstanceProfile,
    DeleteMigrationProject,
    DeleteReplicationConfig,
    DeleteReplicationInstance,
    DeleteReplicationSubnetGroup,
    DeleteReplicationTask,
    DeleteReplicationTaskAssessmentRun,
    DescribeAccountAttributes,
    DescribeApplicableIndividualAssessments,
    DescribeCertificates,
    DescribeConnections,
    DescribeConversionConfiguration,
    DescribeDataMigrations,
    DescribeDataProviders,
    DescribeEndpointSettings,
    DescribeEndpointTypes,
    DescribeEndpoints,
    DescribeEngineVersions,
    DescribeEventCategories,
    DescribeEventSubscriptions,
    DescribeEvents,
    DescribeExtensionPackAssociations,
    DescribeFleetAdvisorCollectors,
    DescribeFleetAdvisorDatabases,
    DescribeFleetAdvisorLsaAnalysis,
    DescribeFleetAdvisorSchemaObjectSummary,
    DescribeFleetAdvisorSchemas,
    DescribeInstanceProfiles,
    DescribeMetadataModel,
    DescribeMetadataModelAssessments,
    DescribeMetadataModelChildren: DescribeMetadataModel,
    DescribeMetadataModelConversions,
    DescribeMetadataModelCreations,
    DescribeMetadataModelExportsAsScript,
    DescribeMetadataModelExportsToTarget,
    DescribeMetadataModelImports,
    DescribeMigrationProjects,
    DescribeOrderableReplicationInstances,
    DescribePendingMaintenanceActions,
    DescribeRecommendationLimitations,
    DescribeRecommendations,
    DescribeRefreshSchemasStatus,
    DescribeReplicationConfigs,
    DescribeReplicationInstanceTaskLogs,
    DescribeReplicationInstances,
    DescribeReplicationSubnetGroups,
    DescribeReplicationTableStatistics,
    DescribeReplicationTaskAssessmentResults,
    DescribeReplicationTaskAssessmentRuns,
    DescribeReplicationTaskIndividualAssessments,
    DescribeReplicationTasks,
    DescribeReplications,
    DescribeSchemas,
    DescribeTableStatistics,
    ExportMetadataModelAssessment,
    GetTargetSelectionRules,
    ImportCertificate,
    ListTagsForResource,
    ModifyConversionConfiguration,
    ModifyDataMigration,
    ModifyDataProvider,
    ModifyEndpoint,
    ModifyEventSubscription,
    ModifyInstanceProfile,
    ModifyMigrationProject,
    ModifyReplicationConfig,
    ModifyReplicationInstance,
    ModifyReplicationSubnetGroup,
    ModifyReplicationTask,
    MoveReplicationTask,
    RebootReplicationInstance,
    RefreshSchemas,
    ReloadReplicationTables,
    ReloadTables,
    RemoveTagsFromResource,
    RunFleetAdvisorLsaAnalysis,
    StartDataMigration,
    StartExtensionPackAssociation,
    StartMetadataModelAssessment,
    StartMetadataModelConversion,
    StartMetadataModelCreation,
    StartMetadataModelExportAsScript,
    StartMetadataModelExportToTarget,
    StartMetadataModelImport,
    StartRecommendations,
    StartReplication,
    StartReplicationTask,
    StartReplicationTaskAssessment,
    StartReplicationTaskAssessmentRun,
    StopDataMigration,
    StopReplication,
    StopReplicationTask,
    TestConnection,
    UpdateSubscriptionsToEventBridge,
  },
  model,
} as const satisfies ServiceDefinition;

export default dms;
