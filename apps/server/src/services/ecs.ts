import { callerArn } from "../core/arn.ts";
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
  loadBalancers: Record<string, unknown>[];
  deploymentConfiguration?: Record<string, unknown>;
  networkConfiguration?: Record<string, unknown>;
  deployments: Record<string, unknown>[];
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
  serviceName?: string;
};

type StoredCapacityProvider = {
  name: string;
  capacityProviderArn: string;
  status: string;
};

type StoredTaskSet = {
  id: string;
  taskSetArn: string;
  clusterArn: string;
  serviceArn: string;
  taskDefinitionArn: string;
  status: string;
  scale: { value: number; unit: string };
  stabilityStatus: string;
  stabilityStatusAt: number;
  createdAt: number;
  updatedAt: number;
  externalId?: string;
  launchType?: string;
};

type StoredContainerInstance = {
  containerInstanceArn: string;
  ec2InstanceId: string;
  status: string;
  agentConnected: boolean;
  registeredAt: number;
  clusterArn: string;
  clusterName: string;
};

type StoredDaemon = {
  daemonArn: string;
  daemonName: string;
  clusterArn: string;
  daemonTaskDefinitionArn: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  deploymentArn: string;
};

type StoredDaemonTaskDefinition = {
  daemonTaskDefinitionArn: string;
  family: string;
  revision: number;
  containerDefinitions: unknown[];
  status: string;
  registeredAt: number;
  cpu?: string;
  memory?: string;
  taskRoleArn?: string;
  executionRoleArn?: string;
};

type StoredAccountSetting = {
  name: string;
  value: string;
  principalArn: string;
};

type StoredAttribute = {
  name: string;
  value?: string;
  targetType: string;
  targetId: string;
};

type StoredTaskProtection = {
  taskArn: string;
  protectionEnabled: boolean;
  expirationDate?: number;
};

type StoredExpressGatewayService = {
  serviceArn: string;
  serviceName: string;
  clusterArn: string;
  clusterName: string;
  status: string;
  createdAt: number;
};

const clusterKey = (name: string): string => `cluster#${name}`;

const taskDefKey = (family: string, revision: number): string =>
  `taskdef#${family}:${revision}`;

const taskKey = (id: string): string => `task#${id}`;

const serviceKey = (cluster: string, name: string): string =>
  `service#${cluster}/${name}`;

const cpKey = (name: string): string => `cp#${name}`;

const taskSetKey = (cluster: string, service: string, id: string): string =>
  `taskset#${cluster}/${service}/${id}`;

const ciKey = (cluster: string, id: string): string => `ci#${cluster}/${id}`;

const daemonKey = (id: string): string => `daemon#${id}`;

const daemonTaskDefKey = (family: string, revision: number): string =>
  `dtaskdef#${family}:${revision}`;

const accountSettingKey = (name: string, principal: string): string =>
  `accsetting#${name}/${principal}`;

const attributeKey = (
  cluster: string,
  targetType: string,
  targetId: string,
  name: string,
): string => `attr#${cluster}/${targetType}/${targetId}/${name}`;

const tagKey = (arn: string): string => `tag#${arn}`;

const taskProtectKey = (arn: string): string => `taskprotect#${arn}`;

const egServiceKey = (id: string): string => `egservice#${id}`;

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

const cpArn = (region: string, account: string, name: string): string =>
  `arn:aws:ecs:${region}:${account}:capacity-provider/${name}`;

const taskSetArn = (
  region: string,
  account: string,
  cluster: string,
  service: string,
  id: string,
): string =>
  `arn:aws:ecs:${region}:${account}:task-set/${cluster}/${service}/${id}`;

const ciArn = (
  region: string,
  account: string,
  cluster: string,
  id: string,
): string =>
  `arn:aws:ecs:${region}:${account}:container-instance/${cluster}/${id}`;

const daemonArnFn = (
  region: string,
  account: string,
  cluster: string,
  id: string,
): string => `arn:aws:ecs:${region}:${account}:daemon/${cluster}/${id}`;

const daemonTaskDefArnFn = (
  region: string,
  account: string,
  family: string,
  revision: number,
): string =>
  `arn:aws:ecs:${region}:${account}:daemon-task-definition/${family}:${revision}`;

const egServiceArnFn = (
  region: string,
  account: string,
  cluster: string,
  name: string,
): string =>
  `arn:aws:ecs:${region}:${account}:express-gateway-service/${cluster}/${name}`;

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

const paginateArns = (
  arns: string[],
  maxResults: unknown,
  nextToken: unknown,
): { arns: string[]; nextToken?: string } => {
  const limit =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : undefined;
  const offset =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(atob(nextToken), 10)
      : 0;
  const sliced =
    limit !== undefined
      ? arns.slice(offset, offset + limit)
      : arns.slice(offset);
  const nextOffset = offset + sliced.length;
  return {
    arns: sliced,
    ...(limit !== undefined && nextOffset < arns.length
      ? { nextToken: btoa(String(nextOffset)) }
      : {}),
  };
};

const clusterNameFromInput = (input: Record<string, unknown>): string => {
  const value = input["cluster"];
  return typeof value === "string" && value !== "" ? value : "default";
};

const lastSegment = (identifier: string): string =>
  identifier.includes("/")
    ? identifier.slice(identifier.lastIndexOf("/") + 1)
    : identifier;

const clusterNameFromIdentifier = (identifier: string): string =>
  lastSegment(identifier);

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

const serviceView = (
  service: StoredService,
  runningCount = 0,
): Record<string, unknown> => ({
  serviceArn: service.serviceArn,
  serviceName: service.serviceName,
  clusterArn: service.clusterArn,
  status: service.status,
  desiredCount: service.desiredCount,
  runningCount,
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
  loadBalancers: service.loadBalancers,
  serviceRegistries: [],
  capacityProviderStrategy: [],
  deployments: service.deployments,
  events: [],
  ...(service.deploymentConfiguration === undefined
    ? {}
    : { deploymentConfiguration: service.deploymentConfiguration }),
  ...(service.networkConfiguration === undefined
    ? {}
    : { networkConfiguration: service.networkConfiguration }),
  placementConstraints: [],
  placementStrategy: [],
  tags: [],
  enableECSManagedTags: false,
  enableExecuteCommand: false,
});

const capacityProviderView = (
  cp: StoredCapacityProvider,
): Record<string, unknown> => ({
  capacityProviderArn: cp.capacityProviderArn,
  name: cp.name,
  status: cp.status,
  tags: [],
});

const taskSetView = (ts: StoredTaskSet): Record<string, unknown> => ({
  id: ts.id,
  taskSetArn: ts.taskSetArn,
  clusterArn: ts.clusterArn,
  serviceArn: ts.serviceArn,
  taskDefinition: ts.taskDefinitionArn,
  status: ts.status,
  scale: ts.scale,
  stabilityStatus: ts.stabilityStatus,
  stabilityStatusAt: ts.stabilityStatusAt,
  createdAt: ts.createdAt,
  updatedAt: ts.updatedAt,
  computedDesiredCount: 0,
  pendingCount: 0,
  runningCount: 0,
  ...(ts.externalId === undefined ? {} : { externalId: ts.externalId }),
  ...(ts.launchType === undefined ? {} : { launchType: ts.launchType }),
  loadBalancers: [],
  serviceRegistries: [],
  tags: [],
});

const containerInstanceView = (
  ci: StoredContainerInstance,
): Record<string, unknown> => ({
  containerInstanceArn: ci.containerInstanceArn,
  ec2InstanceId: ci.ec2InstanceId,
  status: ci.status,
  agentConnected: ci.agentConnected,
  registeredAt: ci.registeredAt,
  runningTasksCount: 0,
  pendingTasksCount: 0,
  version: 1,
  versionInfo: {},
  remainingResources: [],
  registeredResources: [],
  attributes: [],
  attachments: [],
  tags: [],
});

const daemonView = (d: StoredDaemon): Record<string, unknown> => ({
  daemonArn: d.daemonArn,
  clusterArn: d.clusterArn,
  status: d.status,
  currentRevisions: [],
  deploymentArn: d.deploymentArn,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

const daemonTaskDefView = (
  dtd: StoredDaemonTaskDefinition,
): Record<string, unknown> => ({
  daemonTaskDefinitionArn: dtd.daemonTaskDefinitionArn,
  family: dtd.family,
  revision: dtd.revision,
  containerDefinitions: dtd.containerDefinitions,
  status: dtd.status,
  registeredAt: dtd.registeredAt,
  volumes: [],
  ...(dtd.cpu === undefined ? {} : { cpu: dtd.cpu }),
  ...(dtd.memory === undefined ? {} : { memory: dtd.memory }),
  ...(dtd.taskRoleArn === undefined ? {} : { taskRoleArn: dtd.taskRoleArn }),
  ...(dtd.executionRoleArn === undefined
    ? {}
    : { executionRoleArn: dtd.executionRoleArn }),
});

const accountSettingView = (
  s: StoredAccountSetting,
): Record<string, unknown> => ({
  name: s.name,
  value: s.value,
  principalArn: s.principalArn,
  type: "user",
});

const egServiceView = (
  s: StoredExpressGatewayService,
): Record<string, unknown> => ({
  serviceArn: s.serviceArn,
  serviceName: s.serviceName,
  cluster: s.clusterName,
  status: { statusCode: s.status },
  createdAt: s.createdAt,
  updatedAt: s.createdAt,
  activeConfigurations: [],
  tags: [],
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
        value.family === family &&
        value.taskDefinitionArn !== undefined &&
        value.status === "ACTIVE",
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
  const arn = clusterArn(ctx.region, ctx.account, name);
  const cluster: StoredCluster = {
    clusterName: name,
    clusterArn: arn,
    status: "ACTIVE",
  };
  ctx.store.set(clusterKey(name), cluster);
  const inputTags = Array.isArray(input["tags"])
    ? (input["tags"] as Record<string, string>[])
    : [];
  if (inputTags.length > 0) {
    ctx.store.set(tagKey(arn), inputTags);
  }
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
    const name = clusterNameFromIdentifier(identifier);
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
  const allArns = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith("cluster#"))
    .map((entry) => entry.value.clusterArn)
    .sort();
  const { arns, nextToken } = paginateArns(
    allArns,
    input["maxResults"],
    input["nextToken"],
  );
  return {
    clusterArns: arns,
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteCluster: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "cluster");
  const name = clusterNameFromIdentifier(identifier);
  const cluster = ctx.store.get<StoredCluster>(clusterKey(name));
  if (cluster === undefined) {
    throw awsError(
      "ClusterNotFoundException",
      `The referenced cluster was inactive: ${identifier}`,
      400,
    );
  }
  ctx.store.delete(clusterKey(name));
  ctx.store.delete(tagKey(cluster.clusterArn));
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
  const inputTags = Array.isArray(input["tags"])
    ? (input["tags"] as Record<string, string>[])
    : [];
  if (inputTags.length > 0) {
    ctx.store.set(tagKey(taskDef.taskDefinitionArn), inputTags);
  }
  return { taskDefinition: taskDefinitionView(taskDef), tags: inputTags };
};

const DescribeTaskDefinition: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "taskDefinition");
  const taskDef = resolveTaskDefinition(ctx, identifier);
  const include = Array.isArray(input["include"])
    ? (input["include"] as string[])
    : [];
  const tags = include.includes("TAGS")
    ? (ctx.store.get<Record<string, string>[]>(
        tagKey(taskDef.taskDefinitionArn),
      ) ?? [])
    : [];
  return { taskDefinition: taskDefinitionView(taskDef), tags };
};

const RunTask: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const cluster = ctx.store.get<StoredCluster>(clusterKey(clusterName));
  if (cluster === undefined) {
    throw awsError(
      "ClusterNotFoundException",
      `Cluster not found: ${clusterName}`,
      400,
    );
  }
  const identifier = requireString(input, "taskDefinition");
  const taskDef = resolveTaskDefinition(ctx, identifier);
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
  const filterService = optionalString(input, "serviceName");
  const taskArns = ctx.store
    .list<StoredTask>()
    .filter((entry) => entry.key.startsWith("task#"))
    .map((entry) => entry.value)
    .filter((task) => {
      if (filterCluster !== undefined) {
        const name = clusterNameFromIdentifier(filterCluster);
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
      if (filterService !== undefined && task.serviceName !== filterService) {
        return false;
      }
      return true;
    })
    .map((task) => task.taskArn)
    .sort();
  const { arns, nextToken } = paginateArns(
    taskArns,
    input["maxResults"],
    input["nextToken"],
  );
  return {
    taskArns: arns,
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const StopTask: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "task");
  const id = lastSegment(identifier);
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
  lastSegment(identifier);

const countServiceTasks = (
  ctx: ServiceContext,
  clusterName: string,
  serviceName: string,
): number =>
  ctx.store
    .list<StoredTask>()
    .filter(
      (e) =>
        e.key.startsWith("task#") &&
        e.value.clusterName === clusterName &&
        e.value.serviceName === serviceName,
    ).length;

const reconcileServiceTasks = (
  ctx: ServiceContext,
  service: StoredService,
): void => {
  if (service.taskDefinitionArn === "") return;
  const taskDef = ctx.store
    .list<StoredTaskDefinition>()
    .find(
      (e) => e.value.taskDefinitionArn === service.taskDefinitionArn,
    )?.value;
  if (taskDef === undefined) return;
  const existing = ctx.store
    .list<StoredTask>()
    .filter(
      (e) =>
        e.key.startsWith("task#") &&
        e.value.clusterName === service.clusterName &&
        e.value.serviceName === service.serviceName,
    );
  const current = existing.length;
  const desired = service.desiredCount;
  if (current < desired) {
    const containers = (
      taskDef.containerDefinitions as Record<string, unknown>[]
    ).map((definition) => ({
      name:
        typeof definition["name"] === "string"
          ? definition["name"]
          : "container",
      lastStatus: "RUNNING",
      ...(typeof definition["image"] === "string"
        ? { image: definition["image"] }
        : {}),
    }));
    for (let i = current; i < desired; i += 1) {
      const id = randomId();
      const task: StoredTask = {
        taskId: id,
        taskArn: taskArn(ctx.region, ctx.account, id),
        clusterArn: service.clusterArn,
        clusterName: service.clusterName,
        taskDefinitionArn: service.taskDefinitionArn,
        lastStatus: "RUNNING",
        desiredStatus: "RUNNING",
        group: `service:${service.serviceName}`,
        createdAt: Math.floor(Date.now() / 1000),
        containers,
        serviceName: service.serviceName,
      };
      ctx.store.set(taskKey(id), task);
    }
  } else if (current > desired) {
    for (const e of existing.slice(desired)) {
      ctx.store.delete(e.key);
    }
  }
};

const makeDeployment = (
  taskDefinitionArn: string,
  desiredCount: number,
  status: string,
): Record<string, unknown> => {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `ecs-svc/${randomId().slice(0, 16)}`,
    status,
    taskDefinition: taskDefinitionArn,
    desiredCount,
    pendingCount: 0,
    runningCount: desiredCount,
    createdAt: now,
    updatedAt: now,
    launchType: "EC2",
    rolloutState: "COMPLETED",
    rolloutStateReason: `ECS deployment ${status.toLowerCase()} completed.`,
    networkConfiguration: {},
    platformVersion: "1.0.0",
  };
};

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
  const rawLbs = input["loadBalancers"];
  const loadBalancers = Array.isArray(rawLbs)
    ? (rawLbs as Record<string, unknown>[])
    : [];
  const rawDepConfig = input["deploymentConfiguration"];
  const deploymentConfiguration =
    rawDepConfig !== null && typeof rawDepConfig === "object"
      ? (rawDepConfig as Record<string, unknown>)
      : undefined;
  const rawNetConfig = input["networkConfiguration"];
  const networkConfiguration =
    rawNetConfig !== null && typeof rawNetConfig === "object"
      ? (rawNetConfig as Record<string, unknown>)
      : undefined;
  const primaryDeployment =
    taskDefinitionArn !== ""
      ? makeDeployment(taskDefinitionArn, desiredCount, "PRIMARY")
      : undefined;
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
    loadBalancers,
    deploymentConfiguration,
    networkConfiguration,
    deployments: primaryDeployment !== undefined ? [primaryDeployment] : [],
  };
  ctx.store.set(serviceKey(clusterName, serviceName), service);
  const inputTags = Array.isArray(input["tags"])
    ? (input["tags"] as Record<string, string>[])
    : [];
  if (inputTags.length > 0) {
    ctx.store.set(tagKey(service.serviceArn), inputTags);
  }
  reconcileServiceTasks(ctx, service);
  const runningCount = countServiceTasks(ctx, clusterName, serviceName);
  return { service: serviceView(service, runningCount) };
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
    const runningCount = countServiceTasks(ctx, clusterName, name);
    services.push(serviceView(service, runningCount));
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
  const newDesiredCount =
    typeof input["desiredCount"] === "number"
      ? (input["desiredCount"] as number)
      : service.desiredCount;
  const newTaskDefinitionArn =
    taskDefIdentifier === undefined
      ? service.taskDefinitionArn
      : resolveTaskDefinition(ctx, taskDefIdentifier).taskDefinitionArn;
  const rawLbs = input["loadBalancers"];
  const newLoadBalancers = Array.isArray(rawLbs)
    ? (rawLbs as Record<string, unknown>[])
    : service.loadBalancers;
  const rawDepConfig = input["deploymentConfiguration"];
  const newDeploymentConfiguration =
    rawDepConfig !== null && typeof rawDepConfig === "object"
      ? (rawDepConfig as Record<string, unknown>)
      : service.deploymentConfiguration;
  const rawNetConfig = input["networkConfiguration"];
  const newNetworkConfiguration =
    rawNetConfig !== null && typeof rawNetConfig === "object"
      ? (rawNetConfig as Record<string, unknown>)
      : service.networkConfiguration;
  const taskDefinitionChanged =
    newTaskDefinitionArn !== service.taskDefinitionArn &&
    newTaskDefinitionArn !== "";
  const newDeployments = taskDefinitionChanged
    ? [
        makeDeployment(newTaskDefinitionArn, newDesiredCount, "PRIMARY"),
        ...service.deployments.map((d) =>
          d["status"] === "PRIMARY" ? { ...d, status: "ACTIVE" } : d,
        ),
      ]
    : service.deployments;
  const updated: StoredService = {
    ...service,
    desiredCount: newDesiredCount,
    taskDefinitionArn: newTaskDefinitionArn,
    platformVersion:
      optionalString(input, "platformVersion") ?? service.platformVersion,
    loadBalancers: newLoadBalancers,
    deploymentConfiguration: newDeploymentConfiguration,
    networkConfiguration: newNetworkConfiguration,
    deployments: newDeployments,
  };
  ctx.store.set(serviceKey(clusterName, name), updated);
  reconcileServiceTasks(ctx, updated);
  const runningCount = countServiceTasks(ctx, clusterName, name);
  return { service: serviceView(updated, runningCount) };
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
  ctx.store
    .list<StoredTask>()
    .filter(
      (e) =>
        e.key.startsWith("task#") &&
        e.value.clusterName === clusterName &&
        e.value.serviceName === name,
    )
    .forEach((e) => ctx.store.delete(e.key));
  ctx.store.delete(serviceKey(clusterName, name));
  ctx.store.delete(tagKey(service.serviceArn));
  return {
    service: { ...serviceView(service, 0), status: "DRAINING" },
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
  const { arns, nextToken } = paginateArns(
    serviceArns,
    input["maxResults"],
    input["nextToken"],
  );
  return {
    serviceArns: arns,
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
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
  ctx.store.delete(tagKey(taskDef.taskDefinitionArn));
  return { taskDefinition: taskDefinitionView(inactive) };
};

const DescribeTasks: OperationHandler = (input, ctx) => {
  const identifiers = Array.isArray(input["tasks"])
    ? (input["tasks"] as string[])
    : [];
  const tasks: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  for (const identifier of identifiers) {
    const id = lastSegment(identifier);
    let task = ctx.store.get<StoredTask>(taskKey(id));
    if (task === undefined) {
      failures.push({ arn: identifier, reason: "MISSING" });
    } else {
      if (task.lastStatus === "PENDING" && task.desiredStatus === "RUNNING") {
        const running: StoredTask = {
          ...task,
          lastStatus: "RUNNING",
          containers: task.containers.map((c) => ({
            ...c,
            lastStatus: "RUNNING",
          })),
        };
        ctx.store.set(taskKey(id), running);
        task = running;
      }
      tasks.push(taskView(task));
    }
  }
  return { tasks, failures };
};

const StartTask: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "taskDefinition");
  const taskDef = resolveTaskDefinition(ctx, identifier);
  const clusterName = clusterNameFromInput(input);
  const containerInstances = Array.isArray(input["containerInstances"])
    ? (input["containerInstances"] as string[])
    : [];
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
  const failures: Record<string, unknown>[] = [];
  for (const _ci of containerInstances) {
    const id = randomId();
    const task: StoredTask = {
      taskId: id,
      taskArn: taskArn(ctx.region, ctx.account, id),
      clusterArn: clusterArn(ctx.region, ctx.account, clusterName),
      clusterName,
      taskDefinitionArn: taskDef.taskDefinitionArn,
      lastStatus: "PENDING",
      desiredStatus: "RUNNING",
      group: optionalString(input, "group") ?? `family:${taskDef.family}`,
      startedBy: optionalString(input, "startedBy"),
      createdAt: Math.floor(Date.now() / 1000),
      containers,
    };
    ctx.store.set(taskKey(id), task);
    tasks.push(taskView(task));
  }
  return { tasks, failures };
};

const CreateCapacityProvider: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const existing = ctx.store.get<StoredCapacityProvider>(cpKey(name));
  if (existing !== undefined) {
    throw awsError(
      "InvalidParameterException",
      `Capacity provider already exists: ${name}`,
      400,
    );
  }
  const cp: StoredCapacityProvider = {
    name,
    capacityProviderArn: cpArn(ctx.region, ctx.account, name),
    status: "ACTIVE",
  };
  ctx.store.set(cpKey(name), cp);
  return { capacityProvider: capacityProviderView(cp) };
};

const DeleteCapacityProvider: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "capacityProvider");
  const name = lastSegment(identifier);
  const cp = ctx.store.get<StoredCapacityProvider>(cpKey(name));
  if (cp === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Capacity provider not found: ${identifier}`,
      400,
    );
  }
  ctx.store.delete(cpKey(name));
  return {
    capacityProvider: { ...capacityProviderView(cp), status: "INACTIVE" },
  };
};

const DescribeCapacityProviders: OperationHandler = (input, ctx) => {
  const identifiers = Array.isArray(input["capacityProviders"])
    ? (input["capacityProviders"] as string[])
    : [];
  const capacityProviders: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  if (identifiers.length === 0) {
    capacityProviders.push(
      ...ctx.store
        .list<StoredCapacityProvider>()
        .filter((entry) => entry.key.startsWith("cp#"))
        .map((entry) => capacityProviderView(entry.value)),
    );
  } else {
    for (const identifier of identifiers) {
      const name = lastSegment(identifier);
      const cp = ctx.store.get<StoredCapacityProvider>(cpKey(name));
      if (cp === undefined) {
        failures.push({ arn: identifier, reason: "MISSING" });
      } else {
        capacityProviders.push(capacityProviderView(cp));
      }
    }
  }
  return { capacityProviders, failures };
};

const UpdateCapacityProvider: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const cp = ctx.store.get<StoredCapacityProvider>(cpKey(name));
  if (cp === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Capacity provider not found: ${name}`,
      400,
    );
  }
  ctx.store.set(cpKey(name), cp);
  return { capacityProvider: capacityProviderView(cp) };
};

const PutClusterCapacityProviders: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "cluster");
  const name = clusterNameFromIdentifier(identifier);
  const cluster = ctx.store.get<StoredCluster>(clusterKey(name));
  if (cluster === undefined) {
    throw awsError(
      "ClusterNotFoundException",
      `Cluster not found: ${identifier}`,
      400,
    );
  }
  return { cluster: clusterView(cluster) };
};

const CreateTaskSet: OperationHandler = (input, ctx) => {
  const clusterIdentifier = requireString(input, "cluster");
  const serviceIdentifier = requireString(input, "service");
  const taskDefIdentifier = requireString(input, "taskDefinition");
  const clusterName = clusterNameFromIdentifier(clusterIdentifier);
  const serviceName = serviceNameFromIdentifier(serviceIdentifier);
  const taskDef = resolveTaskDefinition(ctx, taskDefIdentifier);
  const id = randomId();
  const ts: StoredTaskSet = {
    id,
    taskSetArn: taskSetArn(
      ctx.region,
      ctx.account,
      clusterName,
      serviceName,
      id,
    ),
    clusterArn: clusterArn(ctx.region, ctx.account, clusterName),
    serviceArn: serviceArn(ctx.region, ctx.account, clusterName, serviceName),
    taskDefinitionArn: taskDef.taskDefinitionArn,
    status: "ACTIVE",
    scale: { value: 100, unit: "PERCENT" },
    stabilityStatus: "STEADY_STATE",
    stabilityStatusAt: Math.floor(Date.now() / 1000),
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
    externalId: optionalString(input, "externalId"),
    launchType: optionalString(input, "launchType"),
  };
  ctx.store.set(taskSetKey(clusterName, serviceName, id), ts);
  return { taskSet: taskSetView(ts) };
};

const DeleteTaskSet: OperationHandler = (input, ctx) => {
  const clusterIdentifier = requireString(input, "cluster");
  const serviceIdentifier = requireString(input, "service");
  const taskSetIdentifier = requireString(input, "taskSet");
  const clusterName = clusterNameFromIdentifier(clusterIdentifier);
  const serviceName = serviceNameFromIdentifier(serviceIdentifier);
  const tsId = lastSegment(taskSetIdentifier);
  const ts = ctx.store.get<StoredTaskSet>(
    taskSetKey(clusterName, serviceName, tsId),
  );
  if (ts === undefined) {
    throw awsError(
      "InvalidParameterException",
      `TaskSet not found: ${taskSetIdentifier}`,
      400,
    );
  }
  ctx.store.delete(taskSetKey(clusterName, serviceName, tsId));
  return { taskSet: { ...taskSetView(ts), status: "DRAINING" } };
};

const DescribeTaskSets: OperationHandler = (input, ctx) => {
  const clusterIdentifier = requireString(input, "cluster");
  const serviceIdentifier = requireString(input, "service");
  const clusterName = clusterNameFromIdentifier(clusterIdentifier);
  const serviceName = serviceNameFromIdentifier(serviceIdentifier);
  const identifiers = Array.isArray(input["taskSets"])
    ? (input["taskSets"] as string[])
    : [];
  const taskSets: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  if (identifiers.length === 0) {
    taskSets.push(
      ...ctx.store
        .list<StoredTaskSet>()
        .filter((entry) =>
          entry.key.startsWith(`taskset#${clusterName}/${serviceName}/`),
        )
        .map((entry) => taskSetView(entry.value)),
    );
  } else {
    for (const identifier of identifiers) {
      const tsId = lastSegment(identifier);
      const ts = ctx.store.get<StoredTaskSet>(
        taskSetKey(clusterName, serviceName, tsId),
      );
      if (ts === undefined) {
        failures.push({ arn: identifier, reason: "MISSING" });
      } else {
        taskSets.push(taskSetView(ts));
      }
    }
  }
  return { taskSets, failures };
};

const UpdateTaskSet: OperationHandler = (input, ctx) => {
  const clusterIdentifier = requireString(input, "cluster");
  const serviceIdentifier = requireString(input, "service");
  const taskSetIdentifier = requireString(input, "taskSet");
  const clusterName = clusterNameFromIdentifier(clusterIdentifier);
  const serviceName = serviceNameFromIdentifier(serviceIdentifier);
  const tsId = lastSegment(taskSetIdentifier);
  const ts = ctx.store.get<StoredTaskSet>(
    taskSetKey(clusterName, serviceName, tsId),
  );
  if (ts === undefined) {
    throw awsError(
      "InvalidParameterException",
      `TaskSet not found: ${taskSetIdentifier}`,
      400,
    );
  }
  const scaleInput =
    typeof input["scale"] === "object" && input["scale"] !== null
      ? (input["scale"] as { value?: unknown; unit?: unknown })
      : {};
  const updated: StoredTaskSet = {
    ...ts,
    scale: {
      value:
        typeof scaleInput.value === "number"
          ? scaleInput.value
          : ts.scale.value,
      unit:
        typeof scaleInput.unit === "string" ? scaleInput.unit : ts.scale.unit,
    },
    updatedAt: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(taskSetKey(clusterName, serviceName, tsId), updated);
  return { taskSet: taskSetView(updated) };
};

const UpdateServicePrimaryTaskSet: OperationHandler = (input, ctx) => {
  const clusterIdentifier = requireString(input, "cluster");
  const serviceIdentifier = requireString(input, "service");
  const taskSetIdentifier = requireString(input, "primaryTaskSet");
  const clusterName = clusterNameFromIdentifier(clusterIdentifier);
  const serviceName = serviceNameFromIdentifier(serviceIdentifier);
  const tsId = lastSegment(taskSetIdentifier);
  const ts = ctx.store.get<StoredTaskSet>(
    taskSetKey(clusterName, serviceName, tsId),
  );
  if (ts === undefined) {
    throw awsError(
      "InvalidParameterException",
      `TaskSet not found: ${taskSetIdentifier}`,
      400,
    );
  }
  return { taskSet: taskSetView(ts) };
};

const RegisterContainerInstance: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const id = randomId();
  const ci: StoredContainerInstance = {
    containerInstanceArn: ciArn(ctx.region, ctx.account, clusterName, id),
    ec2InstanceId: `i-${randomId().slice(0, 17)}`,
    status: "ACTIVE",
    agentConnected: true,
    registeredAt: Math.floor(Date.now() / 1000),
    clusterArn: clusterArn(ctx.region, ctx.account, clusterName),
    clusterName,
  };
  ctx.store.set(ciKey(clusterName, id), ci);
  return { containerInstance: containerInstanceView(ci) };
};

const DeregisterContainerInstance: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const identifier = requireString(input, "containerInstance");
  const id = lastSegment(identifier);
  const ci = ctx.store.get<StoredContainerInstance>(ciKey(clusterName, id));
  if (ci === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Container instance not found: ${identifier}`,
      400,
    );
  }
  ctx.store.delete(ciKey(clusterName, id));
  return {
    containerInstance: { ...containerInstanceView(ci), status: "INACTIVE" },
  };
};

const DescribeContainerInstances: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const identifiers = Array.isArray(input["containerInstances"])
    ? (input["containerInstances"] as string[])
    : [];
  const containerInstances: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  for (const identifier of identifiers) {
    const id = lastSegment(identifier);
    const ci = ctx.store.get<StoredContainerInstance>(ciKey(clusterName, id));
    if (ci === undefined) {
      failures.push({
        arn: ciArn(ctx.region, ctx.account, clusterName, id),
        reason: "MISSING",
      });
    } else {
      containerInstances.push(containerInstanceView(ci));
    }
  }
  return { containerInstances, failures };
};

const ListContainerInstances: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const filterStatus = optionalString(input, "status");
  const prefix = `ci#${clusterName}/`;
  const containerInstanceArns = ctx.store
    .list<StoredContainerInstance>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value)
    .filter((ci) => filterStatus === undefined || ci.status === filterStatus)
    .map((ci) => ci.containerInstanceArn)
    .sort();
  return { containerInstanceArns };
};

const UpdateContainerAgent: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const identifier = requireString(input, "containerInstance");
  const id = lastSegment(identifier);
  const ci = ctx.store.get<StoredContainerInstance>(ciKey(clusterName, id));
  if (ci === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Container instance not found: ${identifier}`,
      400,
    );
  }
  return { containerInstance: containerInstanceView(ci) };
};

const UpdateContainerInstancesState: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const identifiers = Array.isArray(input["containerInstances"])
    ? (input["containerInstances"] as string[])
    : [];
  const newStatus = requireString(input, "status");
  const containerInstances: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  for (const identifier of identifiers) {
    const id = lastSegment(identifier);
    const ci = ctx.store.get<StoredContainerInstance>(ciKey(clusterName, id));
    if (ci === undefined) {
      failures.push({
        arn: ciArn(ctx.region, ctx.account, clusterName, id),
        reason: "MISSING",
      });
    } else {
      const updated: StoredContainerInstance = { ...ci, status: newStatus };
      ctx.store.set(ciKey(clusterName, id), updated);
      containerInstances.push(containerInstanceView(updated));
    }
  }
  return { containerInstances, failures };
};

const PutAccountSetting: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const value = requireString(input, "value");
  const principalArn =
    optionalString(input, "principalArn") ?? callerArn(ctx.account);
  const setting: StoredAccountSetting = { name, value, principalArn };
  ctx.store.set(accountSettingKey(name, principalArn), setting);
  return { setting: accountSettingView(setting) };
};

const PutAccountSettingDefault: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const value = requireString(input, "value");
  const principalArn = callerArn(ctx.account);
  const setting: StoredAccountSetting = { name, value, principalArn };
  ctx.store.set(accountSettingKey(name, "default"), setting);
  return { setting: accountSettingView(setting) };
};

const DeleteAccountSetting: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const principalArn =
    optionalString(input, "principalArn") ?? callerArn(ctx.account);
  const key = accountSettingKey(name, principalArn);
  const setting = ctx.store.get<StoredAccountSetting>(key);
  if (setting === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Setting not found: ${name}`,
      400,
    );
  }
  ctx.store.delete(key);
  return { setting: accountSettingView(setting) };
};

const ListAccountSettings: OperationHandler = (input, ctx) => {
  const filterName = optionalString(input, "name");
  const filterPrincipal = optionalString(input, "principalArn");
  const settings = ctx.store
    .list<StoredAccountSetting>()
    .filter((entry) => entry.key.startsWith("accsetting#"))
    .map((entry) => entry.value)
    .filter((s) => {
      if (filterName !== undefined && s.name !== filterName) return false;
      if (filterPrincipal !== undefined && s.principalArn !== filterPrincipal)
        return false;
      return true;
    })
    .map((s) => accountSettingView(s));
  return { settings };
};

const PutAttributes: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const attributes = Array.isArray(input["attributes"])
    ? (input["attributes"] as Record<string, unknown>[])
    : [];
  const stored: Record<string, unknown>[] = [];
  for (const attr of attributes) {
    const name = typeof attr["name"] === "string" ? attr["name"] : "";
    const value = typeof attr["value"] === "string" ? attr["value"] : undefined;
    const targetType =
      typeof attr["targetType"] === "string"
        ? attr["targetType"]
        : "container-instance";
    const targetId =
      typeof attr["targetId"] === "string" ? attr["targetId"] : "";
    const storedAttr: StoredAttribute = { name, value, targetType, targetId };
    ctx.store.set(
      attributeKey(clusterName, targetType, targetId, name),
      storedAttr,
    );
    stored.push({
      name,
      ...(value !== undefined ? { value } : {}),
      targetType,
      targetId,
    });
  }
  return { attributes: stored };
};

const DeleteAttributes: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const attributes = Array.isArray(input["attributes"])
    ? (input["attributes"] as Record<string, unknown>[])
    : [];
  const deleted: Record<string, unknown>[] = [];
  for (const attr of attributes) {
    const name = typeof attr["name"] === "string" ? attr["name"] : "";
    const targetType =
      typeof attr["targetType"] === "string"
        ? attr["targetType"]
        : "container-instance";
    const targetId =
      typeof attr["targetId"] === "string" ? attr["targetId"] : "";
    const key = attributeKey(clusterName, targetType, targetId, name);
    const existing = ctx.store.get<StoredAttribute>(key);
    if (existing !== undefined) {
      ctx.store.delete(key);
      deleted.push({ name, targetType, targetId });
    }
  }
  return { attributes: deleted };
};

const ListAttributes: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const targetType = requireString(input, "targetType");
  const filterName = optionalString(input, "attributeName");
  const filterValue = optionalString(input, "attributeValue");
  const prefix = `attr#${clusterName}/${targetType}/`;
  const attributes = ctx.store
    .list<StoredAttribute>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value)
    .filter((a) => {
      if (filterName !== undefined && a.name !== filterName) return false;
      if (filterValue !== undefined && a.value !== filterValue) return false;
      return true;
    })
    .map((a) => ({
      name: a.name,
      ...(a.value !== undefined ? { value: a.value } : {}),
      targetType: a.targetType,
      targetId: a.targetId,
    }));
  return { attributes };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const newTags = Array.isArray(input["tags"])
    ? (input["tags"] as Record<string, string>[])
    : [];
  const existing =
    ctx.store.get<Record<string, string>[]>(tagKey(resourceArn)) ?? [];
  const merged = [...existing];
  for (const tag of newTags) {
    const idx = merged.findIndex((t) => t["key"] === tag["key"]);
    if (idx >= 0) {
      merged[idx] = tag;
    } else {
      merged.push(tag);
    }
  }
  ctx.store.set(tagKey(resourceArn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = Array.isArray(input["tagKeys"])
    ? (input["tagKeys"] as string[])
    : [];
  const existing =
    ctx.store.get<Record<string, string>[]>(tagKey(resourceArn)) ?? [];
  const filtered = existing.filter(
    (t) => !tagKeys.includes(t["key"] as string),
  );
  ctx.store.set(tagKey(resourceArn), filtered);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags =
    ctx.store.get<Record<string, string>[]>(tagKey(resourceArn)) ?? [];
  return { tags };
};

const DeleteTaskDefinitions: OperationHandler = (input, ctx) => {
  const identifiers = Array.isArray(input["taskDefinitions"])
    ? (input["taskDefinitions"] as string[])
    : [];
  const taskDefinitions: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  for (const identifier of identifiers) {
    let taskDef: StoredTaskDefinition | undefined;
    try {
      taskDef = resolveTaskDefinition(ctx, identifier);
    } catch {
      failures.push({ arn: identifier, reason: "MISSING", type: "CLIENT" });
      continue;
    }
    if (taskDef.status === "ACTIVE") {
      failures.push({
        arn: taskDef.taskDefinitionArn,
        reason: "Task definition is in ACTIVE state",
        type: "CLIENT",
      });
    } else {
      ctx.store.delete(taskDefKey(taskDef.family, taskDef.revision));
      taskDefinitions.push(
        taskDefinitionView({ ...taskDef, status: "DELETE_IN_PROGRESS" }),
      );
    }
  }
  return { taskDefinitions, failures };
};

const ListTaskDefinitionFamilies: OperationHandler = (input, ctx) => {
  const familyPrefix = optionalString(input, "familyPrefix");
  const filterStatus = optionalString(input, "status");
  const seen = new Set<string>();
  const families = ctx.store
    .list<StoredTaskDefinition>()
    .filter((entry) => entry.key.startsWith("taskdef#"))
    .map((entry) => entry.value)
    .filter((value) => {
      if (familyPrefix !== undefined && !value.family.startsWith(familyPrefix))
        return false;
      if (filterStatus !== undefined && value.status !== filterStatus)
        return false;
      return true;
    })
    .map((value) => value.family)
    .filter((family) => {
      if (seen.has(family)) return false;
      seen.add(family);
      return true;
    })
    .sort();
  return { families };
};

const GetTaskProtection: OperationHandler = (input, ctx) => {
  const taskIds = Array.isArray(input["tasks"])
    ? (input["tasks"] as string[])
    : [];
  const protectedTasks = taskIds.map((t) => {
    const prot = ctx.store.get<StoredTaskProtection>(taskProtectKey(t));
    return {
      taskArn: t,
      protectionEnabled: prot?.protectionEnabled ?? false,
      ...(prot?.expirationDate !== undefined
        ? { expirationDate: prot.expirationDate }
        : {}),
    };
  });
  return { protectedTasks, failures: [] };
};

const UpdateTaskProtection: OperationHandler = (input, ctx) => {
  const taskIds = Array.isArray(input["tasks"])
    ? (input["tasks"] as string[])
    : [];
  const protectionEnabled = input["protectionEnabled"] === true;
  const expiresInMinutes =
    typeof input["expiresInMinutes"] === "number"
      ? (input["expiresInMinutes"] as number)
      : undefined;
  const protectedTasks = taskIds.map((t) => {
    const expirationDate =
      expiresInMinutes !== undefined
        ? Math.floor(Date.now() / 1000) + expiresInMinutes * 60
        : undefined;
    const prot: StoredTaskProtection = {
      taskArn: t,
      protectionEnabled,
      expirationDate,
    };
    ctx.store.set(taskProtectKey(t), prot);
    return {
      taskArn: t,
      protectionEnabled,
      ...(expirationDate !== undefined ? { expirationDate } : {}),
    };
  });
  return { protectedTasks, failures: [] };
};

const UpdateCluster: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "cluster");
  const name = clusterNameFromIdentifier(identifier);
  const cluster = ctx.store.get<StoredCluster>(clusterKey(name));
  if (cluster === undefined) {
    throw awsError(
      "ClusterNotFoundException",
      `Cluster not found: ${identifier}`,
      400,
    );
  }
  return { cluster: clusterView(cluster) };
};

const UpdateClusterSettings: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "cluster");
  const name = clusterNameFromIdentifier(identifier);
  const cluster = ctx.store.get<StoredCluster>(clusterKey(name));
  if (cluster === undefined) {
    throw awsError(
      "ClusterNotFoundException",
      `Cluster not found: ${identifier}`,
      400,
    );
  }
  return { cluster: clusterView(cluster) };
};

const ContinueServiceDeployment: OperationHandler = (input, ctx) => {
  const serviceDeploymentArn = requireString(input, "serviceDeploymentArn");
  return { serviceDeploymentArn };
};

const StopServiceDeployment: OperationHandler = (input, ctx) => {
  const serviceDeploymentArn = requireString(input, "serviceDeploymentArn");
  return { serviceDeploymentArn };
};

const DescribeServiceDeployments: OperationHandler = (input, ctx) => {
  const identifiers = Array.isArray(input["serviceDeploymentArns"])
    ? (input["serviceDeploymentArns"] as string[])
    : [];
  const failures = identifiers.map((arn) => ({ arn, reason: "MISSING" }));
  return { serviceDeployments: [], failures };
};

const ListServiceDeployments: OperationHandler = (input, ctx) => {
  return { serviceDeployments: [] };
};

const DescribeServiceRevisions: OperationHandler = (input, ctx) => {
  const identifiers = Array.isArray(input["serviceRevisionArns"])
    ? (input["serviceRevisionArns"] as string[])
    : [];
  const failures = identifiers.map((arn) => ({ arn, reason: "MISSING" }));
  return { serviceRevisions: [], failures };
};

const ListServicesByNamespace: OperationHandler = (input, ctx) => {
  const serviceArns = ctx.store
    .list<StoredService>()
    .filter((entry) => entry.key.startsWith("service#"))
    .map((entry) => entry.value.serviceArn)
    .sort();
  return { serviceArns };
};

const DiscoverPollEndpoint: OperationHandler = (input, ctx) => ({
  endpoint: `https://ecs-a.${ctx.region}.amazonaws.com/`,
  telemetryEndpoint: `https://telemetry.${ctx.region}.amazonaws.com/`,
  serviceConnectEndpoint: `https://ecs-sc.${ctx.region}.amazonaws.com/`,
});

const ExecuteCommand: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const interactive = input["interactive"] === true;
  const taskIdentifier = requireString(input, "task");
  const taskId = lastSegment(taskIdentifier);
  const task = ctx.store.get<StoredTask>(taskKey(taskId));
  if (task === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Task not found: ${taskIdentifier}`,
      400,
    );
  }
  const containerName = optionalString(input, "container") ?? "default";
  const sessionId = randomId();
  return {
    clusterArn: clusterArn(ctx.region, ctx.account, clusterName),
    containerArn: `arn:aws:ecs:${ctx.region}:${ctx.account}:container/${sessionId}`,
    containerName,
    interactive,
    session: {
      sessionId,
      streamUrl: `wss://ssmmessages.${ctx.region}.amazonaws.com/v1/data-channel/${sessionId}`,
      tokenValue: randomId(),
    },
    taskArn: task.taskArn,
  };
};

const SubmitAttachmentStateChanges: OperationHandler = (_input, _ctx) => ({
  acknowledgment: "ACK",
});

const SubmitContainerStateChange: OperationHandler = (_input, _ctx) => ({
  acknowledgment: "ACK",
});

const SubmitTaskStateChange: OperationHandler = (_input, _ctx) => ({
  acknowledgment: "ACK",
});

const CreateDaemon: OperationHandler = (input, ctx) => {
  const daemonName = requireString(input, "daemonName");
  const daemonTaskDefinitionArn = requireString(
    input,
    "daemonTaskDefinitionArn",
  );
  const clusterArnInput =
    optionalString(input, "clusterArn") ??
    clusterArn(ctx.region, ctx.account, "default");
  const clusterName = lastSegment(clusterArnInput);
  const id = randomId();
  const dArn = daemonArnFn(ctx.region, ctx.account, clusterName, id);
  const deployArn = `arn:aws:ecs:${ctx.region}:${ctx.account}:daemon-deployment/${clusterName}/${id}`;
  const now = Math.floor(Date.now() / 1000);
  const daemon: StoredDaemon = {
    daemonArn: dArn,
    daemonName,
    clusterArn: clusterArnInput,
    daemonTaskDefinitionArn,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    deploymentArn: deployArn,
  };
  ctx.store.set(daemonKey(id), daemon);
  return {
    daemonArn: dArn,
    status: "ACTIVE",
    createdAt: now,
    deploymentArn: deployArn,
  };
};

const DeleteDaemon: OperationHandler = (input, ctx) => {
  const dArnInput = requireString(input, "daemonArn");
  const id = lastSegment(dArnInput);
  const daemon = ctx.store.get<StoredDaemon>(daemonKey(id));
  if (daemon === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Daemon not found: ${dArnInput}`,
      400,
    );
  }
  ctx.store.delete(daemonKey(id));
  const now = Math.floor(Date.now() / 1000);
  return {
    daemonArn: daemon.daemonArn,
    status: "INACTIVE",
    createdAt: daemon.createdAt,
    updatedAt: now,
    deploymentArn: daemon.deploymentArn,
  };
};

const DescribeDaemon: OperationHandler = (input, ctx) => {
  const dArnInput = requireString(input, "daemonArn");
  const id = lastSegment(dArnInput);
  const daemon = ctx.store.get<StoredDaemon>(daemonKey(id));
  if (daemon === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Daemon not found: ${dArnInput}`,
      400,
    );
  }
  return { daemon: daemonView(daemon) };
};

const UpdateDaemon: OperationHandler = (input, ctx) => {
  const dArnInput = requireString(input, "daemonArn");
  const id = lastSegment(dArnInput);
  const daemon = ctx.store.get<StoredDaemon>(daemonKey(id));
  if (daemon === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Daemon not found: ${dArnInput}`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const updated: StoredDaemon = {
    ...daemon,
    daemonTaskDefinitionArn:
      optionalString(input, "daemonTaskDefinitionArn") ??
      daemon.daemonTaskDefinitionArn,
    updatedAt: now,
  };
  ctx.store.set(daemonKey(id), updated);
  return {
    daemonArn: updated.daemonArn,
    status: updated.status,
    createdAt: updated.createdAt,
    updatedAt: now,
    deploymentArn: updated.deploymentArn,
  };
};

const ListDaemons: OperationHandler = (input, ctx) => {
  const filterClusterArn = optionalString(input, "clusterArn");
  const daemonSummariesList = ctx.store
    .list<StoredDaemon>()
    .filter((entry) => entry.key.startsWith("daemon#"))
    .map((entry) => entry.value)
    .filter(
      (d) =>
        filterClusterArn === undefined || d.clusterArn === filterClusterArn,
    )
    .map((d) => ({
      daemonArn: d.daemonArn,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  return { daemonSummariesList };
};

const DescribeDaemonDeployments: OperationHandler = (input, ctx) => {
  const identifiers = Array.isArray(input["daemonDeploymentArns"])
    ? (input["daemonDeploymentArns"] as string[])
    : [];
  const failures = identifiers.map((arn) => ({ arn, reason: "MISSING" }));
  return { daemonDeployments: [], failures };
};

const ListDaemonDeployments: OperationHandler = (input, ctx) => {
  return { daemonDeployments: [] };
};

const RegisterDaemonTaskDefinition: OperationHandler = (input, ctx) => {
  const family = requireString(input, "family");
  const containerDefinitions = Array.isArray(input["containerDefinitions"])
    ? (input["containerDefinitions"] as unknown[])
    : [];
  const existing = ctx.store
    .list<StoredDaemonTaskDefinition>()
    .map((entry) => entry.value)
    .filter((value) => value.family === family);
  const revision =
    existing.reduce((max, value) => Math.max(max, value.revision), 0) + 1;
  const dtd: StoredDaemonTaskDefinition = {
    daemonTaskDefinitionArn: daemonTaskDefArnFn(
      ctx.region,
      ctx.account,
      family,
      revision,
    ),
    family,
    revision,
    containerDefinitions,
    status: "ACTIVE",
    registeredAt: Math.floor(Date.now() / 1000),
    cpu: optionalString(input, "cpu"),
    memory: optionalString(input, "memory"),
    taskRoleArn: optionalString(input, "taskRoleArn"),
    executionRoleArn: optionalString(input, "executionRoleArn"),
  };
  ctx.store.set(daemonTaskDefKey(family, revision), dtd);
  return { daemonTaskDefinitionArn: dtd.daemonTaskDefinitionArn };
};

const DeleteDaemonTaskDefinition: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "daemonTaskDefinition");
  const seg = lastSegment(identifier);
  const existing = ctx.store
    .list<StoredDaemonTaskDefinition>()
    .filter((entry) => entry.key.startsWith("dtaskdef#"))
    .map((entry) => entry.value)
    .find(
      (dtd) =>
        dtd.daemonTaskDefinitionArn === identifier ||
        lastSegment(dtd.daemonTaskDefinitionArn) === seg,
    );
  if (existing === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Daemon task definition not found: ${identifier}`,
      400,
    );
  }
  ctx.store.delete(daemonTaskDefKey(existing.family, existing.revision));
  return { daemonTaskDefinitionArn: existing.daemonTaskDefinitionArn };
};

const DescribeDaemonTaskDefinition: OperationHandler = (input, ctx) => {
  const identifier = requireString(input, "daemonTaskDefinition");
  const seg = lastSegment(identifier);
  const existing = ctx.store
    .list<StoredDaemonTaskDefinition>()
    .filter((entry) => entry.key.startsWith("dtaskdef#"))
    .map((entry) => entry.value)
    .find(
      (dtd) =>
        dtd.daemonTaskDefinitionArn === identifier ||
        lastSegment(dtd.daemonTaskDefinitionArn) === seg,
    );
  if (existing === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Daemon task definition not found: ${identifier}`,
      400,
    );
  }
  return { daemonTaskDefinition: daemonTaskDefView(existing) };
};

const DescribeDaemonRevisions: OperationHandler = (input, ctx) => {
  const identifiers = Array.isArray(input["daemonRevisionArns"])
    ? (input["daemonRevisionArns"] as string[])
    : [];
  const failures = identifiers.map((arn) => ({ arn, reason: "MISSING" }));
  return { daemonRevisions: [], failures };
};

const ListDaemonTaskDefinitions: OperationHandler = (input, ctx) => {
  const familyPrefix = optionalString(input, "familyPrefix");
  const daemonTaskDefinitions = ctx.store
    .list<StoredDaemonTaskDefinition>()
    .filter((entry) => entry.key.startsWith("dtaskdef#"))
    .map((entry) => entry.value)
    .filter(
      (dtd) =>
        familyPrefix === undefined || dtd.family.startsWith(familyPrefix),
    )
    .map((dtd) => ({
      arn: dtd.daemonTaskDefinitionArn,
      registeredAt: dtd.registeredAt,
      status: dtd.status,
    }));
  return { daemonTaskDefinitions };
};

const CreateExpressGatewayService: OperationHandler = (input, ctx) => {
  const clusterName = clusterNameFromInput(input);
  const serviceName =
    optionalString(input, "serviceName") ?? `egw-${randomId().slice(0, 8)}`;
  const sArn = egServiceArnFn(
    ctx.region,
    ctx.account,
    clusterName,
    serviceName,
  );
  const now = Math.floor(Date.now() / 1000);
  const s: StoredExpressGatewayService = {
    serviceArn: sArn,
    serviceName,
    clusterArn: clusterArn(ctx.region, ctx.account, clusterName),
    clusterName,
    status: "ACTIVE",
    createdAt: now,
  };
  ctx.store.set(egServiceKey(sArn), s);
  return { service: egServiceView(s) };
};

const DeleteExpressGatewayService: OperationHandler = (input, ctx) => {
  const sArnInput = requireString(input, "serviceArn");
  const s = ctx.store.get<StoredExpressGatewayService>(egServiceKey(sArnInput));
  if (s === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Express gateway service not found: ${sArnInput}`,
      400,
    );
  }
  ctx.store.delete(egServiceKey(sArnInput));
  return {
    service: { ...egServiceView(s), status: { statusCode: "INACTIVE" } },
  };
};

const DescribeExpressGatewayService: OperationHandler = (input, ctx) => {
  const sArnInput = requireString(input, "serviceArn");
  const s = ctx.store.get<StoredExpressGatewayService>(egServiceKey(sArnInput));
  if (s === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Express gateway service not found: ${sArnInput}`,
      400,
    );
  }
  return { service: egServiceView(s) };
};

const UpdateExpressGatewayService: OperationHandler = (input, ctx) => {
  const sArnInput = requireString(input, "serviceArn");
  const s = ctx.store.get<StoredExpressGatewayService>(egServiceKey(sArnInput));
  if (s === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Express gateway service not found: ${sArnInput}`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  return {
    service: {
      serviceArn: s.serviceArn,
      cluster: s.clusterName,
      serviceName: s.serviceName,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: now,
    },
  };
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
    DescribeTasks,
    StartTask,
    CreateCapacityProvider,
    DeleteCapacityProvider,
    DescribeCapacityProviders,
    UpdateCapacityProvider,
    PutClusterCapacityProviders,
    CreateTaskSet,
    DeleteTaskSet,
    DescribeTaskSets,
    UpdateTaskSet,
    UpdateServicePrimaryTaskSet,
    RegisterContainerInstance,
    DeregisterContainerInstance,
    DescribeContainerInstances,
    ListContainerInstances,
    UpdateContainerAgent,
    UpdateContainerInstancesState,
    PutAccountSetting,
    PutAccountSettingDefault,
    DeleteAccountSetting,
    ListAccountSettings,
    PutAttributes,
    DeleteAttributes,
    ListAttributes,
    TagResource,
    UntagResource,
    ListTagsForResource,
    DeleteTaskDefinitions,
    ListTaskDefinitionFamilies,
    GetTaskProtection,
    UpdateTaskProtection,
    UpdateCluster,
    UpdateClusterSettings,
    ContinueServiceDeployment,
    StopServiceDeployment,
    DescribeServiceDeployments,
    ListServiceDeployments,
    DescribeServiceRevisions,
    ListServicesByNamespace,
    DiscoverPollEndpoint,
    ExecuteCommand,
    SubmitAttachmentStateChanges,
    SubmitContainerStateChange,
    SubmitTaskStateChange,
    CreateDaemon,
    DeleteDaemon,
    DescribeDaemon,
    UpdateDaemon,
    ListDaemons,
    DescribeDaemonDeployments,
    ListDaemonDeployments,
    RegisterDaemonTaskDefinition,
    DeleteDaemonTaskDefinition,
    DescribeDaemonTaskDefinition,
    DescribeDaemonRevisions,
    ListDaemonTaskDefinitions,
    CreateExpressGatewayService,
    DeleteExpressGatewayService,
    DescribeExpressGatewayService,
    UpdateExpressGatewayService,
  },
  model,
} as const;

export default ecs;
