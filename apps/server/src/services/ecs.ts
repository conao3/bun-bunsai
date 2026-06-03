import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ecsModel from "../../../../test/vendor/aws-models/ecs.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(ecsModel);

type StoredCluster = {
  clusterName: string;
  clusterArn: string;
  status: string;
};

type StoredTaskDefinition = {
  family: string;
  revision: number;
  taskDefinitionArn: string;
  containerDefinitions: unknown[];
  status: string;
  cpu?: string;
  memory?: string;
  networkMode?: string;
  taskRoleArn?: string;
  executionRoleArn?: string;
  registeredAt: number;
};

type StoredService = {
  serviceName: string;
  serviceArn: string;
  clusterArn: string;
  clusterName: string;
  taskDefinitionArn: string;
  desiredCount: number;
  status: string;
  launchType?: string;
  schedulingStrategy: string;
  roleArn?: string;
  platformVersion?: string;
  createdAt: number;
};

type StoredTask = {
  taskId: string;
  taskArn: string;
  clusterArn: string;
  clusterName: string;
  taskDefinitionArn: string;
  lastStatus: string;
  desiredStatus: string;
  launchType?: string;
  group?: string;
  startedBy?: string;
  createdAt: number;
  stoppedReason?: string;
  containers: Record<string, unknown>[];
};

const clusterKey = (name: string): string => `cluster#${name}`;

const taskDefKey = (family: string, revision: number): string =>
  `taskdef#${family}:${revision}`;

const taskKey = (id: string): string => `task#${id}`;

const serviceKey = (cluster: string, name: string): string =>
  `service#${cluster}/${name}`;

const clusterArn = (region: string, account: string, name: string): string =>
  `arn:aws:ecs:${region}:${account}:cluster/${name}`;

const taskDefArn = (
  region: string,
  account: string,
  family: string,
  revision: number,
): string =>
  `arn:aws:ecs:${region}:${account}:task-definition/${family}:${revision}`;

const taskArn = (region: string, account: string, id: string): string =>
  `arn:aws:ecs:${region}:${account}:task/${id}`;

const serviceArn = (
  region: string,
  account: string,
  cluster: string,
  name: string,
): string => `arn:aws:ecs:${region}:${account}:service/${cluster}/${name}`;

const randomId = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidParameterException", `${field} is required.`, 400);
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  field: string,
): string | undefined => {
  const value = input[field];
  return typeof value === "string" ? value : undefined;
};

const clusterNameFromInput = (input: Record<string, unknown>): string => {
  const value = input["cluster"];
  return typeof value === "string" && value !== "" ? value : "default";
};

const clusterView = (cluster: StoredCluster): Record<string, unknown> => ({
  clusterArn: cluster.clusterArn,
  clusterName: cluster.clusterName,
  status: cluster.status,
  registeredContainerInstancesCount: 0,
  runningTasksCount: 0,
  pendingTasksCount: 0,
  activeServicesCount: 0,
  statistics: [],
  tags: [],
  settings: [],
  capacityProviders: [],
  defaultCapacityProviderStrategy: [],
});

const taskDefinitionView = (
  taskDef: StoredTaskDefinition,
): Record<string, unknown> => ({
  taskDefinitionArn: taskDef.taskDefinitionArn,
  containerDefinitions: taskDef.containerDefinitions,
  family: taskDef.family,
  revision: taskDef.revision,
  status: taskDef.status,
  registeredAt: taskDef.registeredAt,
  ...(taskDef.cpu === undefined ? {} : { cpu: taskDef.cpu }),
  ...(taskDef.memory === undefined ? {} : { memory: taskDef.memory }),
  ...(taskDef.networkMode === undefined
    ? {}
    : { networkMode: taskDef.networkMode }),
  ...(taskDef.taskRoleArn === undefined
    ? {}
    : { taskRoleArn: taskDef.taskRoleArn }),
  ...(taskDef.executionRoleArn === undefined
    ? {}
    : { executionRoleArn: taskDef.executionRoleArn }),
  requiresAttributes: [],
  compatibilities: [],
  requiresCompatibilities: [],
  placementConstraints: [],
  volumes: [],
});

const taskView = (task: StoredTask): Record<string, unknown> => ({
  taskArn: task.taskArn,
  clusterArn: task.clusterArn,
  taskDefinitionArn: task.taskDefinitionArn,
  lastStatus: task.lastStatus,
  desiredStatus: task.desiredStatus,
  createdAt: task.createdAt,
  containers: task.containers,
  version: 1,
  ...(task.launchType === undefined ? {} : { launchType: task.launchType }),
  ...(task.group === undefined ? {} : { group: task.group }),
  ...(task.startedBy === undefined ? {} : { startedBy: task.startedBy }),
  ...(task.stoppedReason === undefined
    ? {}
    : { stoppedReason: task.stoppedReason }),
  tags: [],
  attachments: [],
  attributes: [],
});

const serviceView = (service: StoredService): Record<string, unknown> => ({
  serviceArn: service.serviceArn,
  serviceName: service.serviceName,
  clusterArn: service.clusterArn,
  status: service.status,
  desiredCount: service.desiredCount,
  runningCount: 0,
  pendingCount: 0,
  taskDefinition: service.taskDefinitionArn,
  schedulingStrategy: service.schedulingStrategy,
  createdAt: service.createdAt,
  ...(service.launchType === undefined
    ? {}
    : { launchType: service.launchType }),
  ...(service.roleArn === undefined ? {} : { roleArn: service.roleArn }),
  ...(service.platformVersion === undefined
    ? {}
    : { platformVersion: service.platformVersion }),
  loadBalancers: [],
  serviceRegistries: [],
  capacityProviderStrategy: [],
  deployments: [],
  events: [],
  placementConstraints: [],
  placementStrategy: [],
  tags: [],
  enableECSManagedTags: false,
  enableExecuteCommand: false,
});

const resolveTaskDefinition = (
  ctx: ServiceContext,
  identifier: string,
): StoredTaskDefinition => {
  if (identifier.includes(":")) {
    const lastColon = identifier.lastIndexOf(":");
    const familyPart = identifier.slice(0, lastColon);
    const family = familyPart.includes("/")
      ? familyPart.slice(familyPart.lastIndexOf("/") + 1)
      : familyPart;
    const revision = Number(identifier.slice(lastColon + 1));
    const direct = ctx.store.get<StoredTaskDefinition>(
      taskDefKey(family, revision),
    );
    if (direct !== undefined) {
      return direct;
    }
  }
  const family = identifier.includes("/")
    ? identifier.slice(identifier.lastIndexOf("/") + 1)
    : identifier;
  const revisions = ctx.store
    .list<StoredTaskDefinition>()
    .map((entry) => entry.value)
    .filter(
      (value) =>
        value.family === family && value.taskDefinitionArn !== undefined,
    )
    .sort((left, right) => right.revision - left.revision);
  if (revisions.length === 0) {
    throw awsError(
      "ClientException",
      `Unable to describe task definition: ${identifier}`,
      400,
    );
  }
  return revisions[0] as StoredTaskDefinition;
};

const CreateCluster: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "clusterName") ?? "default";
  const cluster: StoredCluster = {
    clusterName: name,
    clusterArn: clusterArn(ctx.region, ctx.account, name),
    status: "ACTIVE",
  };
  ctx.store.set(clusterKey(name), cluster);
  return { cluster: clusterView(cluster) };
};

const DescribeClusters: OperationHandler = (input, ctx) => {
  const identifiers = Array.isArray(input["clusters"])
    ? (input["clusters"] as string[])
    : [];
  const clusters: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  const targets =
    identifiers.length > 0
      ? identifiers
      : ctx.store
          .list<StoredCluster>()
          .filter((entry) => entry.key.startsWith("cluster#"))
          .map((entry) => entry.value.clusterName);
  for (const identifier of targets) {
    const name = identifier.includes("/")
      ? identifier.slice(identifier.lastIndexOf("/") + 1)
      : identifier;
    const cluster = ctx.store.get<StoredCluster>(clusterKey(name));
    if (cluster === undefined) {
      failures.push({
        arn: clusterArn(ctx.region, ctx.account, name),
        reason: "MISSING",
      });
      continue;
    }
    clusters.push(clusterView(cluster));
  }
  return { clusters, failures };
};

const ListClusters: OperationHandler = (input, ctx) => {
  const clusterArns = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith("cluster#"))
    .map((entry) => entry.value.clusterArn)
    .sort();
  return { clusterArns };
};

const DeleteCluster: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "cluster");
  const name = identifier.includes("/")
    ? identifier.slice(identifier.lastIndexOf("/") + 1)
    : identifier;
  const cluster = ctx.store.get<StoredCluster>(clusterKey(name));
  if (cluster === undefined) {
    throw awsError(
      "ClusterNotFoundException",
      `The referenced cluster was inactive: ${identifier}`,
      400,
    );
  }
  ctx.store.delete(clusterKey(name));
  return { cluster: { ...clusterView(cluster), status: "INACTIVE" } };
};

const RegisterTaskDefinition: OperationHandler = (input, ctx) => {
  const family = requireString(input, "family");
  const containerDefinitions = Array.isArray(input["containerDefinitions"])
    ? (input["containerDefinitions"] as unknown[])
    : [];
  const existing = ctx.store
    .list<StoredTaskDefinition>()
    .map((entry) => entry.value)
    .filter((value) => value.family === family);
  const revision =
    existing.reduce((max, value) => Math.max(max, value.revision), 0) + 1;
  const taskDef: StoredTaskDefinition = {
    family,
    revision,
    taskDefinitionArn: taskDefArn(ctx.region, ctx.account, family, revision),
    containerDefinitions,
    status: "ACTIVE",
    cpu: optionalString(input, "cpu"),
    memory: optionalString(input, "memory"),
    networkMode: optionalString(input, "networkMode"),
    taskRoleArn: optionalString(input, "taskRoleArn"),
    executionRoleArn: optionalString(input, "executionRoleArn"),
    registeredAt: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(taskDefKey(family, revision), taskDef);
  return { taskDefinition: taskDefinitionView(taskDef), tags: [] };
};

const DescribeTaskDefinition: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "taskDefinition");
  const taskDef = resolveTaskDefinition(ctx, identifier);
  return { taskDefinition: taskDefinitionView(taskDef), tags: [] };
};

const RunTask: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "taskDefinition");
  const taskDef = resolveTaskDefinition(ctx, identifier);
  const clusterName = clusterNameFromInput(input);
  const count =
    typeof input["count"] === "number" && input["count"] > 0
      ? (input["count"] as number)
      : 1;
  const containers = (
    taskDef.containerDefinitions as Record<string, unknown>[]
  ).map((definition) => {
    const definitionName = definition["name"];
    return {
      name: typeof definitionName === "string" ? definitionName : "container",
      lastStatus: "PENDING",
      ...(typeof definition["image"] === "string"
        ? { image: definition["image"] }
        : {}),
    };
  });
  const tasks: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = randomId();
    const task: StoredTask = {
      taskId: id,
      taskArn: taskArn(ctx.region, ctx.account, id),
      clusterArn: clusterArn(ctx.region, ctx.account, clusterName),
      clusterName,
      taskDefinitionArn: taskDef.taskDefinitionArn,
      lastStatus: "PENDING",
      desiredStatus: "RUNNING",
      launchType: optionalString(input, "launchType"),
      group: optionalString(input, "group") ?? `family:${taskDef.family}`,
      startedBy: optionalString(input, "startedBy"),
      createdAt: Math.floor(Date.now() / 1000),
      containers,
    };
    ctx.store.set(taskKey(id), task);
    tasks.push(taskView(task));
  }
  return { tasks, failures: [] };
};

const ListTasks: OperationHandler = (input, ctx) => {
  const filterCluster = optionalString(input, "cluster");
  const filterStatus = optionalString(input, "desiredStatus");
  const filterStartedBy = optionalString(input, "startedBy");
  const taskArns = ctx.store
    .list<StoredTask>()
    .filter((entry) => entry.key.startsWith("task#"))
    .map((entry) => entry.value)
    .filter((task) => {
      if (filterCluster !== undefined) {
        const name = filterCluster.includes("/")
          ? filterCluster.slice(filterCluster.lastIndexOf("/") + 1)
          : filterCluster;
        if (task.clusterName !== name) {
          return false;
        }
      }
      if (filterStatus !== undefined && task.desiredStatus !== filterStatus) {
        return false;
      }
      if (filterStartedBy !== undefined && task.startedBy !== filterStartedBy) {
        return false;
      }
      return true;
    })
    .map((task) => task.taskArn)
    .sort();
  return { taskArns };
};

const StopTask: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "task");
  const id = identifier.includes("/")
    ? identifier.slice(identifier.lastIndexOf("/") + 1)
    : identifier;
  const task = ctx.store.get<StoredTask>(taskKey(id));
  if (task === undefined) {
    throw awsError(
      "InvalidParameterException",
      `The referenced task was not found: ${identifier}`,
      400,
    );
  }
  const stopped: StoredTask = {
    ...task,
    lastStatus: "STOPPED",
    desiredStatus: "STOPPED",
    stoppedReason: optionalString(input, "reason") ?? "Task stopped by user",
  };
  ctx.store.set(taskKey(id), stopped);
  return { task: taskView(stopped) };
};

const serviceNameFromIdentifier = (identifier: string): string =>
  identifier.includes("/")
    ? identifier.slice(identifier.lastIndexOf("/") + 1)
    : identifier;

const CreateService: OperationHandler = (input, ctx) => {
  const serviceName = requireString(input, "serviceName");
  const clusterName = clusterNameFromInput(input);
  const taskDefIdentifier = optionalString(input, "taskDefinition");
  const taskDefinitionArn =
    taskDefIdentifier === undefined
      ? ""
      : resolveTaskDefinition(ctx, taskDefIdentifier).taskDefinitionArn;
  const desiredCount =
    typeof input["desiredCount"] === "number"
      ? (input["desiredCount"] as number)
      : 0;
  const service: StoredService = {
    serviceName,
    serviceArn: serviceArn(ctx.region, ctx.account, clusterName, serviceName),
    clusterArn: clusterArn(ctx.region, ctx.account, clusterName),
    clusterName,
    taskDefinitionArn,
    desiredCount,
    status: "ACTIVE",
    launchType: optionalString(input, "launchType"),
    schedulingStrategy:
      optionalString(input, "schedulingStrategy") ?? "REPLICA",
    roleArn: optionalString(input, "role"),
    platformVersion: optionalString(input, "platformVersion"),
    createdAt: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(serviceKey(clusterName, serviceName), service);
  return { service: serviceView(service) };
};

const DescribeServices: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const identifiers = Array.isArray(input["services"])
    ? (input["services"] as string[])
    : [];
  const services: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  for (const identifier of identifiers) {
    const name = serviceNameFromIdentifier(identifier);
    const service = ctx.store.get<StoredService>(serviceKey(clusterName, name));
    if (service === undefined) {
      failures.push({
        arn: serviceArn(ctx.region, ctx.account, clusterName, name),
        reason: "MISSING",
      });
      continue;
    }
    services.push(serviceView(service));
  }
  return { services, failures };
};

const UpdateService: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const identifier = requireString(input, "service");
  const name = serviceNameFromIdentifier(identifier);
  const service = ctx.store.get<StoredService>(serviceKey(clusterName, name));
  if (service === undefined) {
    throw awsError(
      "ServiceNotFoundException",
      `Service not found: ${identifier}`,
      400,
    );
  }
  const taskDefIdentifier = optionalString(input, "taskDefinition");
  const updated: StoredService = {
    ...service,
    desiredCount:
      typeof input["desiredCount"] === "number"
        ? (input["desiredCount"] as number)
        : service.desiredCount,
    taskDefinitionArn:
      taskDefIdentifier === undefined
        ? service.taskDefinitionArn
        : resolveTaskDefinition(ctx, taskDefIdentifier).taskDefinitionArn,
    platformVersion:
      optionalString(input, "platformVersion") ?? service.platformVersion,
  };
  ctx.store.set(serviceKey(clusterName, name), updated);
  return { service: serviceView(updated) };
};

const DeleteService: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const identifier = requireString(input, "service");
  const name = serviceNameFromIdentifier(identifier);
  const service = ctx.store.get<StoredService>(serviceKey(clusterName, name));
  if (service === undefined) {
    throw awsError(
      "ServiceNotFoundException",
      `Service not found: ${identifier}`,
      400,
    );
  }
  ctx.store.delete(serviceKey(clusterName, name));
  return {
    service: { ...serviceView(service), status: "DRAINING" },
  };
};

const ListServices: OperationHandler = (input, ctx) => {
  const filterCluster = optionalString(input, "cluster");
  const filterName =
    filterCluster === undefined
      ? undefined
      : serviceNameFromIdentifier(filterCluster);
  const serviceArns = ctx.store
    .list<StoredService>()
    .filter((entry) => entry.key.startsWith("service#"))
    .map((entry) => entry.value)
    .filter(
      (service) =>
        filterName === undefined || service.clusterName === filterName,
    )
    .map((service) => service.serviceArn)
    .sort();
  return { serviceArns };
};

const ListTaskDefinitions: OperationHandler = (input, ctx) => {
  const familyPrefix = optionalString(input, "familyPrefix");
  const filterStatus = optionalString(input, "status");
  const sort = optionalString(input, "sort");
  const taskDefinitionArns = ctx.store
    .list<StoredTaskDefinition>()
    .filter((entry) => entry.key.startsWith("taskdef#"))
    .map((entry) => entry.value)
    .filter((value) => {
      if (
        familyPrefix !== undefined &&
        !value.family.startsWith(familyPrefix)
      ) {
        return false;
      }
      if (filterStatus !== undefined && value.status !== filterStatus) {
        return false;
      }
      return true;
    })
    .sort((left, right) =>
      sort === "DESC"
        ? right.revision - left.revision
        : left.revision - right.revision,
    )
    .map((value) => value.taskDefinitionArn);
  return { taskDefinitionArns };
};

const DeregisterTaskDefinition: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "taskDefinition");
  const taskDef = resolveTaskDefinition(ctx, identifier);
  const inactive: StoredTaskDefinition = { ...taskDef, status: "INACTIVE" };
  ctx.store.set(taskDefKey(taskDef.family, taskDef.revision), inactive);
  return { taskDefinition: taskDefinitionView(inactive) };
};

const ecs: ServiceDefinition = {
  name: "ecs",
  protocol: "json",
  operations: {
    CreateCluster,
    DescribeClusters,
    ListClusters,
    DeleteCluster,
    RegisterTaskDefinition,
    DescribeTaskDefinition,
    RunTask,
    ListTasks,
    StopTask,
    CreateService,
    DescribeServices,
    UpdateService,
    DeleteService,
    ListServices,
    ListTaskDefinitions,
    DeregisterTaskDefinition,
  },
  model,
} as const;

export default ecs;
