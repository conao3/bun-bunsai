import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import dmsModel from "../../../../test/vendor/aws-models/dms.json" with { type: "json" };
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

const instanceKey = (id: string): string => `instance/${id}`;
const instanceArnKey = (arn: string): string => `instanceArn/${arn}`;
const endpointKey = (id: string): string => `endpoint/${id}`;
const endpointArnKey = (arn: string): string => `endpointArn/${arn}`;
const taskKey = (id: string): string => `task/${id}`;
const taskArnKey = (arn: string): string => `taskArn/${arn}`;
const tagKey = (arn: string): string => `tags/${arn}`;

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
    AllocatedStorage:
      typeof input["AllocatedStorage"] === "number"
        ? input["AllocatedStorage"]
        : 50,
    InstanceCreateTime: now,
    AvailabilityZone: optStr(input, "AvailabilityZone") ?? `${ctx.region}a`,
    ReplicationInstanceArn: arn,
    ReplicationInstancePublicIpAddress: "0.0.0.0",
    ReplicationInstancePrivateIpAddress: "10.0.0.1",
    PubliclyAccessible: optBool(input, "PubliclyAccessible", true),
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
    "replication-instance-class": (i) => i.ReplicationInstanceClass,
    "engine-version": (i) => i.EngineVersion,
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
  if (inst.ReplicationInstanceStatus !== "available") {
    throw awsError(
      "InvalidResourceStateFault",
      `Replication instance ${arn} is not in available state.`,
      400,
    );
  }
  const updated: StoredReplicationInstance = {
    ...inst,
    ReplicationInstanceClass:
      optStr(input, "ReplicationInstanceClass") ??
      inst.ReplicationInstanceClass,
    AllocatedStorage:
      optNum(input, "AllocatedStorage") ?? inst.AllocatedStorage,
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
  const deleted = { ...inst, ReplicationInstanceStatus: "deleting" };
  ctx.store.delete(instanceKey(inst.ReplicationInstanceIdentifier));
  ctx.store.delete(instanceArnKey(arn));
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
  ctx.store.set(endpointKey(updated.EndpointIdentifier), updated);
  ctx.store.set(endpointArnKey(arn), updated);
  return { Endpoint: endpointToResponse(updated) };
};

const DeleteEndpoint: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "EndpointArn");
  const ep = requireEndpoint(ctx, arn);
  ctx.store.delete(endpointKey(ep.EndpointIdentifier));
  ctx.store.delete(endpointArnKey(arn));
  return { Endpoint: endpointToResponse({ ...ep, Status: "deleting" }) };
};

const TestConnection: OperationHandler = (input, ctx) => {
  const replicationInstanceArn = requireStr(input, "ReplicationInstanceArn");
  const endpointArn = requireStr(input, "EndpointArn");
  requireInstance(ctx, replicationInstanceArn);
  const ep = requireEndpoint(ctx, endpointArn);
  return {
    Connection: {
      ReplicationInstanceArn: replicationInstanceArn,
      EndpointArn: endpointArn,
      Status: "successful",
      EndpointIdentifier: ep.EndpointIdentifier,
      ReplicationInstanceIdentifier:
        replicationInstanceArn.split(":").pop() ?? "",
      LastFailureMessage: undefined,
    },
  };
};

const DescribeConnections: OperationHandler = (input, ctx) => {
  const marker = optStr(input, "Marker");
  const maxRecords = optNum(input, "MaxRecords");
  const filters = input["Filters"];
  const endpoints = ctx.store
    .list<StoredEndpoint>()
    .filter((e) => e.key.startsWith("endpoint/"))
    .map((e) => e.value);
  const instances = ctx.store
    .list<StoredReplicationInstance>()
    .filter((e) => e.key.startsWith("instance/"))
    .map((e) => e.value);
  let connections: {
    ReplicationInstanceArn: string;
    EndpointArn: string;
    Status: string;
    EndpointIdentifier: string;
    ReplicationInstanceIdentifier: string;
  }[] = [];
  for (const inst of instances) {
    for (const ep of endpoints) {
      connections.push({
        ReplicationInstanceArn: inst.ReplicationInstanceArn,
        EndpointArn: ep.EndpointArn,
        Status: "successful",
        EndpointIdentifier: ep.EndpointIdentifier,
        ReplicationInstanceIdentifier: inst.ReplicationInstanceIdentifier,
      });
    }
  }
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
  return { Marker: nextMarker, Connections: items };
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
  ctx.store.set(taskKey(updated.ReplicationTaskIdentifier), updated);
  ctx.store.set(taskArnKey(arn), updated);
  return { ReplicationTask: taskToResponse(updated) };
};

const StartReplicationTask: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationTaskArn");
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

const DescribeReplicationSubnetGroups: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  ReplicationSubnetGroups: [],
});

const CreateReplicationSubnetGroup: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "ReplicationSubnetGroupIdentifier");
  const description = requireStr(input, "ReplicationSubnetGroupDescription");
  const arn = `arn:aws:dms:${ctx.region}:${ctx.account}:subgrp:${id}`;
  return {
    ReplicationSubnetGroup: {
      ReplicationSubnetGroupIdentifier: id,
      ReplicationSubnetGroupDescription: description,
      VpcId: "vpc-default",
      SubnetGroupStatus: "Complete",
      Subnets: [],
      ReplicationSubnetGroupArn: arn,
    },
  };
};

const DeleteReplicationSubnetGroup: OperationHandler = (_input, _ctx) => ({});

const ModifyReplicationSubnetGroup: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "ReplicationSubnetGroupIdentifier");
  const arn = `arn:aws:dms:${ctx.region}:${ctx.account}:subgrp:${id}`;
  return {
    ReplicationSubnetGroup: {
      ReplicationSubnetGroupIdentifier: id,
      ReplicationSubnetGroupDescription:
        optStr(input, "ReplicationSubnetGroupDescription") ?? "",
      VpcId: "vpc-default",
      SubnetGroupStatus: "Complete",
      Subnets: [],
      ReplicationSubnetGroupArn: arn,
    },
  };
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

const DescribeCertificates: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  Certificates: [],
});

const ImportCertificate: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "CertificateIdentifier");
  const arn = `arn:aws:dms:${ctx.region}:${ctx.account}:cert:${id}`;
  return {
    Certificate: {
      CertificateIdentifier: id,
      CertificateArn: arn,
      CertificateCreationDate: new Date().toISOString(),
      CertificatePem: optStr(input, "CertificatePem"),
      CertificateWallet: undefined,
      KeyLength: 2048,
      SigningAlgorithm: "SHA256withRSA",
      ValidFromDate: new Date().toISOString(),
      ValidToDate: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
  };
};

const DeleteCertificate: OperationHandler = (_input, _ctx) => ({
  Certificate: undefined,
});

const DescribeEventCategories: OperationHandler = (_input, _ctx) => ({
  EventCategoryGroupList: [],
});

const DescribeEventSubscriptions: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  EventSubscriptionsList: [],
});

const DescribeEvents: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  Events: [],
});

const CreateEventSubscription: OperationHandler = (input, ctx) => {
  const name = requireStr(input, "SubscriptionName");
  return {
    EventSubscription: {
      CustomerAwsId: ctx.account,
      CustSubscriptionId: name,
      SnsTopicArn: optStr(input, "SnsTopicArn") ?? "",
      Status: "active",
      SubscriptionCreationTime: new Date().toISOString(),
      SourceType: optStr(input, "SourceType"),
      SourceIdsList: [],
      EventCategoriesList: [],
      Enabled: optBool(input, "Enabled", true),
    },
  };
};

const ModifyEventSubscription: OperationHandler = (input, _ctx) => ({
  EventSubscription: {
    CustSubscriptionId: requireStr(input, "SubscriptionName"),
    Status: "active",
  },
});

const DeleteEventSubscription: OperationHandler = (_input, _ctx) => ({
  EventSubscription: undefined,
});

const AddTagsToResourceStub: OperationHandler = (_input, _ctx) => ({});

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

const DeleteConnection: OperationHandler = (_input, _ctx) => ({
  Connection: undefined,
});

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
  const arn = requireStr(input, "ReplicationConfigArn").length
    ? requireStr(input, "ReplicationConfigArn")
    : `arn:aws:dms:${ctx.region}:${ctx.account}:replication-config:${requireStr(input, "ReplicationConfigIdentifier")}`;
  return {
    ReplicationConfig: {
      ReplicationConfigIdentifier: requireStr(
        input,
        "ReplicationConfigIdentifier",
      ),
      ReplicationConfigArn: arn,
      SourceEndpointArn: optStr(input, "SourceEndpointArn"),
      TargetEndpointArn: optStr(input, "TargetEndpointArn"),
      ReplicationType: optStr(input, "ReplicationType"),
      TableMappings: optStr(input, "TableMappings"),
      ReplicationSettings: optStr(input, "ReplicationSettings"),
      Status: "creating",
    },
  };
};

const DeleteReplicationConfig: OperationHandler = (_input, _ctx) => ({
  ReplicationConfig: undefined,
});

const DescribeReplicationConfigs: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  ReplicationConfigs: [],
});

const ModifyReplicationConfig: OperationHandler = (input, ctx) => {
  const arn = requireStr(input, "ReplicationConfigArn");
  return {
    ReplicationConfig: {
      ReplicationConfigArn: arn,
      Status: "available",
    },
  };
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
  const arn = `arn:aws:dms:${ctx.region}:${ctx.account}:data-migration:${id}`;
  return {
    DataMigration: {
      DataMigrationName: id,
      DataMigrationArn: arn,
      DataMigrationType: optStr(input, "DataMigrationType"),
      Status: "creating",
      MigrationProjectArn: optStr(input, "MigrationProjectArn"),
    },
  };
};

const DeleteDataMigration: OperationHandler = (_input, _ctx) => ({
  DataMigration: undefined,
});

const DescribeDataMigrations: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  DataMigrations: [],
});

const ModifyDataMigration: OperationHandler = (input, _ctx) => ({
  DataMigration: {
    DataMigrationArn: requireStr(input, "DataMigrationArn"),
    Status: "modifying",
  },
});

const StartDataMigration: OperationHandler = (input, _ctx) => ({
  DataMigration: {
    DataMigrationArn: requireStr(input, "DataMigrationArn"),
    Status: "running",
  },
});

const StopDataMigration: OperationHandler = (input, _ctx) => ({
  DataMigration: {
    DataMigrationArn: requireStr(input, "DataMigrationArn"),
    Status: "stopped",
  },
});

const CreateDataProvider: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "DataProviderName");
  const arn = `arn:aws:dms:${ctx.region}:${ctx.account}:data-provider:${id}`;
  return {
    DataProvider: {
      DataProviderName: id,
      DataProviderArn: arn,
      DataProviderCreationTime: new Date().toISOString(),
      Engine: optStr(input, "Engine") ?? "mysql",
      Settings: undefined,
      Description: optStr(input, "Description"),
    },
  };
};

const DeleteDataProvider: OperationHandler = (_input, _ctx) => ({
  DataProvider: undefined,
});

const DescribeDataProviders: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  DataProviders: [],
});

const ModifyDataProvider: OperationHandler = (input, _ctx) => ({
  DataProvider: {
    DataProviderArn: requireStr(input, "DataProviderArn"),
    DataProviderName: optStr(input, "DataProviderName"),
    Engine: optStr(input, "Engine"),
  },
});

const CreateInstanceProfile: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "InstanceProfileName");
  const arn = `arn:aws:dms:${ctx.region}:${ctx.account}:instance-profile:${id}`;
  return {
    InstanceProfile: {
      InstanceProfileArn: arn,
      InstanceProfileName: id,
      KmsKeyArn: optStr(input, "KmsKeyId"),
      PubliclyAccessible: optBool(input, "PubliclyAccessible", false),
      NetworkType: optStr(input, "NetworkType"),
      InstanceProfileCreationTime: new Date().toISOString(),
    },
  };
};

const DeleteInstanceProfile: OperationHandler = (_input, _ctx) => ({
  InstanceProfile: undefined,
});

const DescribeInstanceProfiles: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  InstanceProfiles: [],
});

const ModifyInstanceProfile: OperationHandler = (input, _ctx) => ({
  InstanceProfile: {
    InstanceProfileArn: requireStr(input, "InstanceProfileArn"),
    InstanceProfileName: optStr(input, "InstanceProfileName"),
  },
});

const CreateMigrationProject: OperationHandler = (input, ctx) => {
  const id = requireStr(input, "MigrationProjectName");
  const arn = `arn:aws:dms:${ctx.region}:${ctx.account}:migration-project:${id}`;
  return {
    MigrationProject: {
      MigrationProjectName: id,
      MigrationProjectArn: arn,
      MigrationProjectCreationTime: new Date().toISOString(),
      InstanceProfileArn: optStr(input, "InstanceProfileIdentifier"),
      SourceDataProviderDescriptors: [],
      TargetDataProviderDescriptors: [],
      SchemaConversionApplicationAttributes: undefined,
      TransformationRules: undefined,
      Description: optStr(input, "Description"),
    },
  };
};

const DeleteMigrationProject: OperationHandler = (_input, _ctx) => ({
  MigrationProject: undefined,
});

const DescribeMigrationProjects: OperationHandler = (_input, _ctx) => ({
  Marker: undefined,
  MigrationProjects: [],
});

const ModifyMigrationProject: OperationHandler = (input, _ctx) => ({
  MigrationProject: {
    MigrationProjectArn: requireStr(input, "MigrationProjectIdentifier"),
    MigrationProjectName: optStr(input, "MigrationProjectName"),
  },
});

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
