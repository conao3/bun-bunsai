import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/kafka.json", { with: { type: "json" } }),
);

type ClusterType = "PROVISIONED" | "SERVERLESS";
type ClusterState =
  | "CREATING"
  | "ACTIVE"
  | "UPDATING"
  | "DELETING"
  | "FAILED"
  | "HEALING"
  | "MAINTENANCE"
  | "REBOOTING_BROKER";

type StoredCluster = {
  clusterName: string;
  clusterArn: string;
  clusterType: ClusterType;
  state: ClusterState;
  creationTime: number;
  currentVersion: string;
  numberOfBrokerNodes: number;
  brokerNodeGroupInfo: Record<string, unknown>;
  currentBrokerSoftwareInfo: Record<string, unknown>;
  kafkaVersion: string;
  configurationInfo: Record<string, unknown> | undefined;
  encryptionInfo: Record<string, unknown> | undefined;
  enhancedMonitoring: string;
  openMonitoring: Record<string, unknown> | undefined;
  loggingInfo: Record<string, unknown> | undefined;
  storageMode: string | undefined;
  rebalancing: Record<string, unknown> | undefined;
  clientAuthentication: Record<string, unknown> | undefined;
  zookeeperConnectString: string;
  zookeeperConnectStringTls: string;
  tags: Record<string, string>;
  provisioned: Record<string, unknown> | undefined;
  serverless: Record<string, unknown> | undefined;
  policy: string | undefined;
  scramSecrets: string[];
  shortId: string;
};

type StoredConfigurationRevision = {
  revision: number;
  description: string;
  creationTime: number;
  serverProperties: string;
};

type StoredConfiguration = {
  arn: string;
  name: string;
  description: string;
  kafkaVersions: string[];
  creationTime: number;
  state: "ACTIVE" | "DELETING" | "DELETE_FAILED";
  revisions: StoredConfigurationRevision[];
  tags: Record<string, string>;
};

type StoredOperation = {
  clusterArn: string;
  clusterOperationArn: string;
  clusterType: ClusterType;
  operationType: string;
  operationState: "UPDATE_COMPLETE" | "UPDATE_IN_PROGRESS" | "UPDATE_FAILED";
  creationTime: number;
  endTime: number;
};

type StoredReplicator = {
  replicatorArn: string;
  replicatorName: string;
  description: string;
  kafkaClusters: Record<string, unknown>[];
  replicationInfoList: Record<string, unknown>[];
  serviceExecutionRoleArn: string;
  replicatorState: "CREATING" | "RUNNING" | "UPDATING" | "DELETING" | "FAILED";
  creationTime: number;
  tags: Record<string, string>;
};

type StoredVpcConnection = {
  vpcConnectionArn: string;
  targetClusterArn: string;
  vpcId: string;
  clientSubnets: string[];
  securityGroups: string[];
  authentication: string;
  creationTime: number;
  state:
    | "CREATING"
    | "AVAILABLE"
    | "INACTIVE"
    | "DEACTIVATING"
    | "DELETING"
    | "FAILED"
    | "REJECTED"
    | "REVOKED";
  tags: Record<string, string>;
};

type StoredTopic = {
  topicArn: string;
  topicName: string;
  clusterArn: string;
  partitionCount: number;
  replicationFactor: number;
  status: "CREATING" | "ACTIVE";
  configs: string;
};

const clusterKey = (arn: string): string => `cluster/${arn}`;
const configKey = (arn: string): string => `config/${arn}`;
const operationKey = (arn: string): string => `operation/${arn}`;
const replicatorKey = (arn: string): string => `replicator/${arn}`;
const vpcConnectionKey = (arn: string): string => `vpcconn/${arn}`;
const topicKey = (clusterArn: string, name: string): string =>
  `topic/${clusterArn}/${name}`;

const nowMs = (): number => Date.now();

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const stringListFrom = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((e): e is string => typeof e === "string")
    : [];

const stringMapFrom = (value: unknown): Record<string, string> => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
};

const clusterArnOf = (
  ctx: ServiceContext,
  name: string,
  shortId: string,
): string =>
  `arn:aws:kafka:${ctx.region}:${ctx.account}:cluster/${name}/${shortId}`;

const configArnOf = (
  ctx: ServiceContext,
  name: string,
  shortId: string,
): string =>
  `arn:aws:kafka:${ctx.region}:${ctx.account}:configuration/${name}/${shortId}`;

const operationArnOf = (ctx: ServiceContext, shortId: string): string =>
  `arn:aws:kafka:${ctx.region}:${ctx.account}:operation/${shortId}`;

const replicatorArnOf = (
  ctx: ServiceContext,
  name: string,
  shortId: string,
): string =>
  `arn:aws:kafka:${ctx.region}:${ctx.account}:replicator/${name}/${shortId}`;

const vpcConnectionArnOf = (ctx: ServiceContext, shortId: string): string =>
  `arn:aws:kafka:${ctx.region}:${ctx.account}:vpc-connection/${shortId}`;

const topicArnOf = (
  ctx: ServiceContext,
  clusterArn: string,
  name: string,
): string =>
  `arn:aws:kafka:${ctx.region}:${ctx.account}:topic/${clusterArn}/${name}`;

const bootstrapBrokers = (cluster: StoredCluster, region: string): string => {
  const brokers: string[] = [];
  for (let i = 1; i <= Math.min(cluster.numberOfBrokerNodes, 3); i++) {
    brokers.push(
      `b-${i}.${cluster.clusterName.toLowerCase()}.${cluster.shortId.slice(0, 8)}.c1.kafka.${region}.amazonaws.com:9092`,
    );
  }
  return brokers.join(",");
};

const paginateList = <T>(
  items: T[],
  maxResults: number | undefined,
  nextToken: string | undefined,
  getKey: (item: T) => string,
): { page: T[]; nextToken: string | undefined } => {
  let start = 0;
  if (nextToken !== undefined) {
    const cursor = atob(nextToken);
    const idx = items.findIndex((item) => getKey(item) > cursor);
    start = idx === -1 ? items.length : idx;
  }
  const max = maxResults ?? items.length;
  const page = items.slice(start, start + max);
  const next =
    start + max < items.length
      ? btoa(getKey(page[page.length - 1]))
      : undefined;
  return { page, nextToken: next };
};

const requireCluster = (ctx: ServiceContext, arn: string): StoredCluster => {
  const stored = ctx.store.get<StoredCluster>(clusterKey(arn));
  if (stored === undefined || stored.state === "DELETING") {
    throw awsError(
      "NotFoundException",
      `Cluster with ARN ${arn} does not exist.`,
      404,
    );
  }
  if (stored.state === "CREATING") {
    const updated = { ...stored, state: "ACTIVE" as ClusterState };
    ctx.store.set(clusterKey(arn), updated);
    return updated;
  }
  return stored;
};

const requireConfig = (
  ctx: ServiceContext,
  arn: string,
): StoredConfiguration => {
  const stored = ctx.store.get<StoredConfiguration>(configKey(arn));
  if (stored === undefined || stored.state === "DELETING") {
    throw awsError(
      "NotFoundException",
      `Configuration with ARN ${arn} does not exist.`,
      404,
    );
  }
  return stored;
};

const clusterInfoV1 = (c: StoredCluster): Record<string, unknown> => ({
  clusterArn: c.clusterArn,
  clusterName: c.clusterName,
  state: c.state,
  stateInfo: {},
  creationTime: new Date(c.creationTime).toISOString(),
  currentVersion: c.currentVersion,
  numberOfBrokerNodes: c.numberOfBrokerNodes,
  brokerNodeGroupInfo: c.brokerNodeGroupInfo,
  currentBrokerSoftwareInfo: c.currentBrokerSoftwareInfo,
  kafkaVersion: c.kafkaVersion,
  configurationInfo: c.configurationInfo,
  encryptionInfo: c.encryptionInfo,
  enhancedMonitoring: c.enhancedMonitoring,
  openMonitoring: c.openMonitoring,
  loggingInfo: c.loggingInfo,
  storageMode: c.storageMode ?? "LOCAL",
  zookeeperConnectString: c.zookeeperConnectString,
  zookeeperConnectStringTls: c.zookeeperConnectStringTls,
  tags: c.tags,
});

const clusterInfoV2 = (c: StoredCluster): Record<string, unknown> => ({
  clusterArn: c.clusterArn,
  clusterName: c.clusterName,
  clusterType: c.clusterType,
  state: c.state,
  stateInfo: {},
  creationTime: new Date(c.creationTime).toISOString(),
  currentVersion: c.currentVersion,
  tags: c.tags,
  provisioned:
    c.clusterType === "PROVISIONED"
      ? {
          brokerNodeGroupInfo: c.brokerNodeGroupInfo,
          currentBrokerSoftwareInfo: c.currentBrokerSoftwareInfo,
          numberOfBrokerNodes: c.numberOfBrokerNodes,
          kafkaVersion: c.kafkaVersion,
          configurationInfo: c.configurationInfo,
          encryptionInfo: c.encryptionInfo,
          enhancedMonitoring: c.enhancedMonitoring,
          openMonitoring: c.openMonitoring,
          loggingInfo: c.loggingInfo,
          storageMode: c.storageMode ?? "LOCAL",
          zookeeperConnectString: c.zookeeperConnectString,
          zookeeperConnectStringTls: c.zookeeperConnectStringTls,
        }
      : undefined,
  serverless: c.clusterType === "SERVERLESS" ? c.serverless : undefined,
});

const configRevisionInfo = (
  cfg: StoredConfiguration,
  rev: StoredConfigurationRevision,
): Record<string, unknown> => ({
  Arn: cfg.arn,
  Name: cfg.name,
  Description: cfg.description,
  KafkaVersions: cfg.kafkaVersions,
  CreationTime: new Date(cfg.creationTime).toISOString(),
  State: cfg.state,
  LatestRevision: {
    revision: rev.revision,
    description: rev.description,
    creationTime: new Date(rev.creationTime).toISOString(),
  },
});

const CreateCluster: OperationHandler = (input, ctx) => {
  const clusterName = stringOrUndefined(input["ClusterName"]);
  if (clusterName === undefined) {
    throw awsError("BadRequestException", "clusterName is required.", 400);
  }
  const existing = ctx.store
    .list<StoredCluster>()
    .find(
      (e) =>
        e.key.startsWith("cluster/") && e.value.clusterName === clusterName,
    );
  if (existing !== undefined) {
    throw awsError(
      "ConflictException",
      `Cluster ${clusterName} already exists.`,
      409,
    );
  }
  const shortId = crypto.randomUUID();
  const arn = clusterArnOf(ctx, clusterName, shortId);
  const brokerNodeGroupInfo = asRecord(input["BrokerNodeGroupInfo"]) ?? {};
  const cluster: StoredCluster = {
    clusterName,
    clusterArn: arn,
    clusterType: "PROVISIONED",
    state: "CREATING",
    creationTime: nowMs(),
    currentVersion: "1",
    numberOfBrokerNodes: numberOrUndefined(input["NumberOfBrokerNodes"]) ?? 3,
    brokerNodeGroupInfo,
    currentBrokerSoftwareInfo: {
      kafkaVersion: stringOrUndefined(input["KafkaVersion"]) ?? "2.8.1",
    },
    kafkaVersion: stringOrUndefined(input["KafkaVersion"]) ?? "2.8.1",
    configurationInfo: asRecord(input["ConfigurationInfo"]),
    encryptionInfo: asRecord(input["EncryptionInfo"]),
    enhancedMonitoring:
      stringOrUndefined(input["EnhancedMonitoring"]) ?? "DEFAULT",
    openMonitoring: asRecord(input["OpenMonitoring"]),
    loggingInfo: asRecord(input["LoggingInfo"]),
    storageMode: stringOrUndefined(input["StorageMode"]),
    rebalancing: asRecord(input["Rebalancing"]),
    clientAuthentication: asRecord(input["ClientAuthentication"]),
    zookeeperConnectString: `z-1.${clusterName}.${shortId.slice(0, 8)}.c1.kafka.amazonaws.com:2181`,
    zookeeperConnectStringTls: `z-1.${clusterName}.${shortId.slice(0, 8)}.c1.kafka.amazonaws.com:2182`,
    tags: stringMapFrom(input["Tags"]),
    provisioned: undefined,
    serverless: undefined,
    policy: undefined,
    scramSecrets: [],
    shortId,
  };
  ctx.store.set(clusterKey(arn), cluster);
  return { ClusterArn: arn, ClusterName: clusterName, State: "CREATING" };
};

const CreateClusterV2: OperationHandler = (input, ctx) => {
  const clusterName = stringOrUndefined(input["ClusterName"]);
  if (clusterName === undefined) {
    throw awsError("BadRequestException", "clusterName is required.", 400);
  }
  const existing = ctx.store
    .list<StoredCluster>()
    .find(
      (e) =>
        e.key.startsWith("cluster/") && e.value.clusterName === clusterName,
    );
  if (existing !== undefined) {
    throw awsError(
      "ConflictException",
      `Cluster ${clusterName} already exists.`,
      409,
    );
  }
  const shortId = crypto.randomUUID();
  const provisioned = asRecord(input["Provisioned"]);
  const serverlessInput = asRecord(input["Serverless"]);
  const clusterType: ClusterType =
    provisioned !== undefined ? "PROVISIONED" : "SERVERLESS";
  const arn = clusterArnOf(ctx, clusterName, shortId);
  const brokerNodeGroupInfo =
    asRecord(provisioned?.["BrokerNodeGroupInfo"]) ?? {};
  const kafkaVersion =
    stringOrUndefined(provisioned?.["KafkaVersion"] as unknown) ?? "2.8.1";
  const cluster: StoredCluster = {
    clusterName,
    clusterArn: arn,
    clusterType,
    state: "CREATING",
    creationTime: nowMs(),
    currentVersion: "1",
    numberOfBrokerNodes:
      numberOrUndefined(provisioned?.["NumberOfBrokerNodes"] as unknown) ?? 3,
    brokerNodeGroupInfo,
    currentBrokerSoftwareInfo: { kafkaVersion },
    kafkaVersion,
    configurationInfo: asRecord(provisioned?.["ConfigurationInfo"] as unknown),
    encryptionInfo: asRecord(provisioned?.["EncryptionInfo"] as unknown),
    enhancedMonitoring:
      stringOrUndefined(provisioned?.["EnhancedMonitoring"] as unknown) ??
      "DEFAULT",
    openMonitoring: asRecord(provisioned?.["OpenMonitoring"] as unknown),
    loggingInfo: asRecord(provisioned?.["LoggingInfo"] as unknown),
    storageMode: stringOrUndefined(provisioned?.["StorageMode"] as unknown),
    rebalancing: asRecord(provisioned?.["Rebalancing"] as unknown),
    clientAuthentication: asRecord(
      provisioned?.["ClientAuthentication"] as unknown,
    ),
    zookeeperConnectString:
      clusterType === "PROVISIONED"
        ? `z-1.${clusterName}.${shortId.slice(0, 8)}.c1.kafka.amazonaws.com:2181`
        : "",
    zookeeperConnectStringTls:
      clusterType === "PROVISIONED"
        ? `z-1.${clusterName}.${shortId.slice(0, 8)}.c1.kafka.amazonaws.com:2182`
        : "",
    tags: stringMapFrom(input["Tags"]),
    provisioned: clusterType === "PROVISIONED" ? provisioned : undefined,
    serverless: clusterType === "SERVERLESS" ? serverlessInput : undefined,
    policy: undefined,
    scramSecrets: [],
    shortId,
  };
  ctx.store.set(clusterKey(arn), cluster);
  return {
    ClusterArn: arn,
    ClusterName: clusterName,
    State: "CREATING",
    ClusterType: clusterType,
  };
};

const DescribeCluster: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  return { ClusterInfo: clusterInfoV1(cluster) };
};

const DescribeClusterV2: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  return { ClusterInfo: clusterInfoV2(cluster) };
};

const ListClusters: OperationHandler = (input, ctx) => {
  const clusterNameFilter = stringOrUndefined(input["ClusterNameFilter"]);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  let clusters = ctx.store
    .list<StoredCluster>()
    .filter((e) => e.key.startsWith("cluster/"))
    .map((e) => e.value)
    .filter((c) => c.state !== "DELETING")
    .sort((a, b) => a.clusterName.localeCompare(b.clusterName));
  if (clusterNameFilter !== undefined) {
    clusters = clusters.filter((c) =>
      c.clusterName.startsWith(clusterNameFilter),
    );
  }
  const { page, nextToken: next } = paginateList(
    clusters,
    maxResults,
    nextToken,
    (c) => c.clusterName,
  );
  const transitioned = page.map((c) => {
    if (c.state === "CREATING") {
      const updated = { ...c, state: "ACTIVE" as ClusterState };
      ctx.store.set(clusterKey(c.clusterArn), updated);
      return updated;
    }
    return c;
  });
  return {
    ClusterInfoList: transitioned.map(clusterInfoV1),
    NextToken: next,
  };
};

const ListClustersV2: OperationHandler = (input, ctx) => {
  const clusterNameFilter = stringOrUndefined(input["ClusterNameFilter"]);
  const clusterTypeFilter = stringOrUndefined(input["ClusterTypeFilter"]);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  let clusters = ctx.store
    .list<StoredCluster>()
    .filter((e) => e.key.startsWith("cluster/"))
    .map((e) => e.value)
    .filter((c) => c.state !== "DELETING")
    .sort((a, b) => a.clusterName.localeCompare(b.clusterName));
  if (clusterNameFilter !== undefined) {
    clusters = clusters.filter((c) =>
      c.clusterName.startsWith(clusterNameFilter),
    );
  }
  if (clusterTypeFilter !== undefined) {
    clusters = clusters.filter((c) => c.clusterType === clusterTypeFilter);
  }
  const { page, nextToken: next } = paginateList(
    clusters,
    maxResults,
    nextToken,
    (c) => c.clusterName,
  );
  const transitioned = page.map((c) => {
    if (c.state === "CREATING") {
      const updated = { ...c, state: "ACTIVE" as ClusterState };
      ctx.store.set(clusterKey(c.clusterArn), updated);
      return updated;
    }
    return c;
  });
  return {
    ClusterInfoList: transitioned.map(clusterInfoV2),
    NextToken: next,
  };
};

const DeleteCluster: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  const updated = { ...cluster, state: "DELETING" as ClusterState };
  ctx.store.set(clusterKey(clusterArn), updated);
  return { ClusterArn: clusterArn, State: "DELETING" };
};

const GetBootstrapBrokers: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  const brokerString = bootstrapBrokers(cluster, ctx.region);
  return {
    BootstrapBrokerString: brokerString,
    BootstrapBrokerStringTls: brokerString.replace(/:9092/g, ":9094"),
    BootstrapBrokerStringSaslScram: brokerString.replace(/:9092/g, ":9096"),
    BootstrapBrokerStringSaslIam: brokerString.replace(/:9092/g, ":9098"),
  };
};

const CreateConfiguration: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["Name"]);
  if (name === undefined) {
    throw awsError("BadRequestException", "name is required.", 400);
  }
  const existing = ctx.store
    .list<StoredConfiguration>()
    .find((e) => e.key.startsWith("config/") && e.value.name === name);
  if (existing !== undefined) {
    throw awsError(
      "ConflictException",
      `Configuration ${name} already exists.`,
      409,
    );
  }
  const shortId = crypto.randomUUID();
  const arn = configArnOf(ctx, name, shortId);
  const serverProperties =
    typeof input["ServerProperties"] === "string"
      ? input["ServerProperties"]
      : "";
  const rev: StoredConfigurationRevision = {
    revision: 1,
    description: stringOrUndefined(input["Description"]) ?? "",
    creationTime: nowMs(),
    serverProperties,
  };
  const cfg: StoredConfiguration = {
    arn,
    name,
    description: stringOrUndefined(input["Description"]) ?? "",
    kafkaVersions: stringListFrom(input["KafkaVersions"]),
    creationTime: nowMs(),
    state: "ACTIVE",
    revisions: [rev],
    tags: {},
  };
  ctx.store.set(configKey(arn), cfg);
  return {
    Arn: arn,
    CreationTime: new Date(cfg.creationTime).toISOString(),
    LatestRevision: {
      revision: 1,
      description: rev.description,
      creationTime: new Date(rev.creationTime).toISOString(),
    },
    Name: name,
    State: "ACTIVE",
  };
};

const DescribeConfiguration: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["Arn"]);
  if (arn === undefined) {
    throw awsError("BadRequestException", "arn is required.", 400);
  }
  const cfg = requireConfig(ctx, arn);
  const latest = cfg.revisions[cfg.revisions.length - 1];
  return configRevisionInfo(cfg, latest);
};

const UpdateConfiguration: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["Arn"]);
  if (arn === undefined) {
    throw awsError("BadRequestException", "arn is required.", 400);
  }
  const cfg = requireConfig(ctx, arn);
  const latest = cfg.revisions[cfg.revisions.length - 1];
  const serverProperties =
    typeof input["ServerProperties"] === "string"
      ? input["ServerProperties"]
      : latest.serverProperties;
  const rev: StoredConfigurationRevision = {
    revision: latest.revision + 1,
    description: stringOrUndefined(input["Description"]) ?? "",
    creationTime: nowMs(),
    serverProperties,
  };
  const updated = { ...cfg, revisions: [...cfg.revisions, rev] };
  ctx.store.set(configKey(arn), updated);
  return {
    Arn: arn,
    LatestRevision: {
      revision: rev.revision,
      description: rev.description,
      creationTime: new Date(rev.creationTime).toISOString(),
    },
  };
};

const DeleteConfiguration: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["Arn"]);
  if (arn === undefined) {
    throw awsError("BadRequestException", "arn is required.", 400);
  }
  const cfg = requireConfig(ctx, arn);
  const inUse = ctx.store.list<StoredCluster>().some((e) => {
    if (!e.key.startsWith("cluster/")) return false;
    if (e.value.state === "DELETING") return false;
    const ci = e.value.configurationInfo as Record<string, unknown> | undefined;
    if (ci === undefined) return false;
    return ci["arn"] === arn || ci["Arn"] === arn;
  });
  if (inUse) {
    throw awsError(
      "BadRequestException",
      `Configuration ${arn} is in use by one or more clusters.`,
      400,
    );
  }
  const updated = { ...cfg, state: "DELETING" as const };
  ctx.store.set(configKey(arn), updated);
  return { Arn: arn, State: "DELETING" };
};

const ListConfigurations: OperationHandler = (input, ctx) => {
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const configs = ctx.store
    .list<StoredConfiguration>()
    .filter((e) => e.key.startsWith("config/"))
    .map((e) => e.value)
    .filter((c) => c.state !== "DELETING")
    .sort((a, b) => a.name.localeCompare(b.name));
  const { page, nextToken: next } = paginateList(
    configs,
    maxResults,
    nextToken,
    (c) => c.name,
  );
  return {
    Configurations: page.map((c) => {
      const latest = c.revisions[c.revisions.length - 1];
      return configRevisionInfo(c, latest);
    }),
    NextToken: next,
  };
};

const DescribeConfigurationRevision: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["Arn"]);
  const revNum =
    numberOrUndefined(input["Revision"]) ??
    (typeof input["Revision"] === "string"
      ? parseInt(input["Revision"], 10)
      : undefined);
  if (arn === undefined) {
    throw awsError("BadRequestException", "arn is required.", 400);
  }
  if (revNum === undefined) {
    throw awsError("BadRequestException", "revision is required.", 400);
  }
  const cfg = requireConfig(ctx, arn);
  const rev = cfg.revisions.find((r) => r.revision === revNum);
  if (rev === undefined) {
    throw awsError(
      "NotFoundException",
      `Revision ${revNum} not found for configuration ${arn}.`,
      404,
    );
  }
  return {
    Arn: arn,
    CreationTime: new Date(rev.creationTime).toISOString(),
    Description: rev.description,
    Revision: rev.revision,
    ServerProperties: rev.serverProperties,
  };
};

const ListConfigurationRevisions: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["Arn"]);
  if (arn === undefined) {
    throw awsError("BadRequestException", "arn is required.", 400);
  }
  const cfg = requireConfig(ctx, arn);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const revisions = [...cfg.revisions].sort((a, b) => a.revision - b.revision);
  const { page, nextToken: next } = paginateList(
    revisions,
    maxResults,
    nextToken,
    (r) => String(r.revision).padStart(20, "0"),
  );
  return {
    Revisions: page.map((r) => ({
      revision: r.revision,
      description: r.description,
      creationTime: new Date(r.creationTime).toISOString(),
    })),
    NextToken: next,
  };
};

const makeOperationArn = (ctx: ServiceContext): string => {
  const id = crypto.randomUUID();
  return operationArnOf(ctx, id);
};

const recordOperation = (
  ctx: ServiceContext,
  clusterArn: string,
  operationType: string,
  clusterType: ClusterType,
): string => {
  const arn = makeOperationArn(ctx);
  const op: StoredOperation = {
    clusterArn,
    clusterOperationArn: arn,
    clusterType,
    operationType,
    operationState: "UPDATE_COMPLETE",
    creationTime: nowMs(),
    endTime: nowMs(),
  };
  ctx.store.set(operationKey(arn), op);
  return arn;
};

const requireCurrentVersion = (
  input: Record<string, unknown>,
  cluster: StoredCluster,
): void => {
  const cv = stringOrUndefined(input["CurrentVersion"]);
  if (cv === undefined) {
    throw awsError("BadRequestException", "currentVersion is required.", 400);
  }
  if (cv !== cluster.currentVersion) {
    throw awsError(
      "BadRequestException",
      `Version mismatch: expected ${cluster.currentVersion}.`,
      400,
    );
  }
};

const UpdateBrokerCount: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  requireCurrentVersion(input, cluster);
  const targetCount =
    numberOrUndefined(input["TargetNumberOfBrokerNodes"]) ??
    cluster.numberOfBrokerNodes;
  const nextVersion = String(parseInt(cluster.currentVersion, 10) + 1);
  const updated = {
    ...cluster,
    numberOfBrokerNodes: targetCount,
    currentVersion: nextVersion,
  };
  ctx.store.set(clusterKey(clusterArn), updated);
  const operationArn = recordOperation(
    ctx,
    clusterArn,
    "UPDATE_BROKER_COUNT",
    cluster.clusterType,
  );
  return { ClusterArn: clusterArn, ClusterOperationArn: operationArn };
};

const UpdateBrokerStorage: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  requireCurrentVersion(input, cluster);
  const nextVersion = String(parseInt(cluster.currentVersion, 10) + 1);
  const updated = { ...cluster, currentVersion: nextVersion };
  ctx.store.set(clusterKey(clusterArn), updated);
  const operationArn = recordOperation(
    ctx,
    clusterArn,
    "UPDATE_BROKER_STORAGE",
    cluster.clusterType,
  );
  return { ClusterArn: clusterArn, ClusterOperationArn: operationArn };
};

const UpdateBrokerType: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  requireCurrentVersion(input, cluster);
  const nextVersion = String(parseInt(cluster.currentVersion, 10) + 1);
  const updated = { ...cluster, currentVersion: nextVersion };
  ctx.store.set(clusterKey(clusterArn), updated);
  const operationArn = recordOperation(
    ctx,
    clusterArn,
    "UPDATE_BROKER_TYPE",
    cluster.clusterType,
  );
  return { ClusterArn: clusterArn, ClusterOperationArn: operationArn };
};

const UpdateClusterConfiguration: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  requireCurrentVersion(input, cluster);
  const configInfo = asRecord(input["ConfigurationInfo"]);
  const nextVersion = String(parseInt(cluster.currentVersion, 10) + 1);
  const updated = {
    ...cluster,
    configurationInfo: configInfo ?? cluster.configurationInfo,
    currentVersion: nextVersion,
  };
  ctx.store.set(clusterKey(clusterArn), updated);
  const operationArn = recordOperation(
    ctx,
    clusterArn,
    "UPDATE_CLUSTER_CONFIGURATION",
    cluster.clusterType,
  );
  return { ClusterArn: clusterArn, ClusterOperationArn: operationArn };
};

const UpdateClusterKafkaVersion: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  requireCurrentVersion(input, cluster);
  const targetVersion =
    stringOrUndefined(input["TargetKafkaVersion"]) ?? cluster.kafkaVersion;
  const nextVersion = String(parseInt(cluster.currentVersion, 10) + 1);
  const updated = {
    ...cluster,
    kafkaVersion: targetVersion,
    currentBrokerSoftwareInfo: { kafkaVersion: targetVersion },
    currentVersion: nextVersion,
  };
  ctx.store.set(clusterKey(clusterArn), updated);
  const operationArn = recordOperation(
    ctx,
    clusterArn,
    "UPDATE_CLUSTER_KAFKA_VERSION",
    cluster.clusterType,
  );
  return { ClusterArn: clusterArn, ClusterOperationArn: operationArn };
};

const UpdateConnectivity: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  requireCurrentVersion(input, cluster);
  const nextVersion = String(parseInt(cluster.currentVersion, 10) + 1);
  ctx.store.set(clusterKey(clusterArn), {
    ...cluster,
    currentVersion: nextVersion,
  });
  const operationArn = recordOperation(
    ctx,
    clusterArn,
    "UPDATE_CONNECTIVITY",
    cluster.clusterType,
  );
  return { ClusterArn: clusterArn, ClusterOperationArn: operationArn };
};

const UpdateMonitoring: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  requireCurrentVersion(input, cluster);
  const nextVersion = String(parseInt(cluster.currentVersion, 10) + 1);
  const updated = {
    ...cluster,
    enhancedMonitoring:
      stringOrUndefined(input["EnhancedMonitoring"]) ??
      cluster.enhancedMonitoring,
    openMonitoring: asRecord(input["OpenMonitoring"]) ?? cluster.openMonitoring,
    loggingInfo: asRecord(input["LoggingInfo"]) ?? cluster.loggingInfo,
    currentVersion: nextVersion,
  };
  ctx.store.set(clusterKey(clusterArn), updated);
  const operationArn = recordOperation(
    ctx,
    clusterArn,
    "UPDATE_MONITORING",
    cluster.clusterType,
  );
  return { ClusterArn: clusterArn, ClusterOperationArn: operationArn };
};

const UpdateRebalancing: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  requireCurrentVersion(input, cluster);
  const nextVersion = String(parseInt(cluster.currentVersion, 10) + 1);
  ctx.store.set(clusterKey(clusterArn), {
    ...cluster,
    rebalancing: asRecord(input["Rebalancing"]) ?? cluster.rebalancing,
    currentVersion: nextVersion,
  });
  const operationArn = recordOperation(
    ctx,
    clusterArn,
    "UPDATE_REBALANCING",
    cluster.clusterType,
  );
  return { ClusterArn: clusterArn, ClusterOperationArn: operationArn };
};

const UpdateSecurity: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  requireCurrentVersion(input, cluster);
  const nextVersion = String(parseInt(cluster.currentVersion, 10) + 1);
  ctx.store.set(clusterKey(clusterArn), {
    ...cluster,
    clientAuthentication:
      asRecord(input["ClientAuthentication"]) ?? cluster.clientAuthentication,
    encryptionInfo: asRecord(input["EncryptionInfo"]) ?? cluster.encryptionInfo,
    currentVersion: nextVersion,
  });
  const operationArn = recordOperation(
    ctx,
    clusterArn,
    "UPDATE_SECURITY",
    cluster.clusterType,
  );
  return { ClusterArn: clusterArn, ClusterOperationArn: operationArn };
};

const UpdateStorage: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  requireCurrentVersion(input, cluster);
  const nextVersion = String(parseInt(cluster.currentVersion, 10) + 1);
  ctx.store.set(clusterKey(clusterArn), {
    ...cluster,
    storageMode: stringOrUndefined(input["StorageMode"]) ?? cluster.storageMode,
    currentVersion: nextVersion,
  });
  const operationArn = recordOperation(
    ctx,
    clusterArn,
    "UPDATE_STORAGE",
    cluster.clusterType,
  );
  return { ClusterArn: clusterArn, ClusterOperationArn: operationArn };
};

const RebootBroker: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  const operationArn = recordOperation(
    ctx,
    clusterArn,
    "REBOOT_BROKER",
    cluster.clusterType,
  );
  return { ClusterArn: clusterArn, ClusterOperationArn: operationArn };
};

const ListNodes: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const nodes = Array.from({ length: cluster.numberOfBrokerNodes }, (_, i) => ({
    addedToClusterTime: new Date(cluster.creationTime).toISOString(),
    brokerNodeInfo: {
      attachedEniId: `eni-${i.toString().padStart(8, "0")}`,
      brokerId: i + 1,
      clientSubnet: "subnet-00000000",
      clientVpcIpAddress: `10.0.${i}.${i + 1}`,
      endpoints: [
        `b-${i + 1}.${cluster.clusterName.toLowerCase()}.${cluster.shortId.slice(0, 8)}.c1.kafka.${ctx.region}.amazonaws.com`,
      ],
    },
    instanceType: "kafka.m5.large",
    nodeARN: `arn:aws:kafka:${ctx.region}:${ctx.account}:broker/${cluster.clusterName}/${cluster.shortId}/${i + 1}`,
    nodeType: "BROKER",
  }));
  const { page, nextToken: next } = paginateList(
    nodes,
    maxResults,
    nextToken,
    (n) => String(n.brokerNodeInfo.brokerId).padStart(20, "0"),
  );
  return { NodeInfoList: page, NextToken: next };
};

const opInfoView = (o: StoredOperation): Record<string, unknown> => ({
  clusterArn: o.clusterArn,
  operationArn: o.clusterOperationArn,
  operationType: o.operationType,
  operationState: o.operationState,
  creationTime: new Date(o.creationTime).toISOString(),
  endTime: new Date(o.endTime).toISOString(),
});

const opInfoV2View = (o: StoredOperation): Record<string, unknown> => ({
  clusterArn: o.clusterArn,
  clusterType: o.clusterType,
  operationArn: o.clusterOperationArn,
  operationType: o.operationType,
  operationState: o.operationState,
  startTime: new Date(o.creationTime).toISOString(),
  endTime: new Date(o.endTime).toISOString(),
});

const DescribeClusterOperation: OperationHandler = (input, ctx) => {
  const clusterOperationArn = stringOrUndefined(input["ClusterOperationArn"]);
  if (clusterOperationArn === undefined) {
    throw awsError(
      "BadRequestException",
      "clusterOperationArn is required.",
      400,
    );
  }
  const op = ctx.store.get<StoredOperation>(operationKey(clusterOperationArn));
  if (op === undefined) {
    throw awsError(
      "NotFoundException",
      `Operation ${clusterOperationArn} not found.`,
      404,
    );
  }
  return { ClusterOperationInfo: opInfoView(op) };
};

const DescribeClusterOperationV2: OperationHandler = (input, ctx) => {
  const clusterOperationArn = stringOrUndefined(input["ClusterOperationArn"]);
  if (clusterOperationArn === undefined) {
    throw awsError(
      "BadRequestException",
      "clusterOperationArn is required.",
      400,
    );
  }
  const op = ctx.store.get<StoredOperation>(operationKey(clusterOperationArn));
  if (op === undefined) {
    throw awsError(
      "NotFoundException",
      `Operation ${clusterOperationArn} not found.`,
      404,
    );
  }
  return { ClusterOperationInfo: opInfoV2View(op) };
};

const ListClusterOperations: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  requireCluster(ctx, clusterArn);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const ops = ctx.store
    .list<StoredOperation>()
    .filter(
      (e) =>
        e.key.startsWith("operation/") && e.value.clusterArn === clusterArn,
    )
    .map((e) => e.value)
    .sort((a, b) => a.creationTime - b.creationTime);
  const { page, nextToken: next } = paginateList(
    ops,
    maxResults,
    nextToken,
    (o) => o.clusterOperationArn,
  );
  return {
    ClusterOperationInfoList: page.map(opInfoView),
    NextToken: next,
  };
};

const ListClusterOperationsV2: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  requireCluster(ctx, clusterArn);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const ops = ctx.store
    .list<StoredOperation>()
    .filter(
      (e) =>
        e.key.startsWith("operation/") && e.value.clusterArn === clusterArn,
    )
    .map((e) => e.value)
    .sort((a, b) => a.creationTime - b.creationTime);
  const { page, nextToken: next } = paginateList(
    ops,
    maxResults,
    nextToken,
    (o) => o.clusterOperationArn,
  );
  return {
    ClusterOperationInfoList: page.map(opInfoV2View),
    NextToken: next,
  };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = stringOrUndefined(input["ResourceArn"]);
  if (resourceArn === undefined) {
    throw awsError("BadRequestException", "resourceArn is required.", 400);
  }
  const tags = findResourceTags(ctx, resourceArn);
  if (tags === undefined) {
    throw awsError(
      "NotFoundException",
      `Resource ${resourceArn} not found.`,
      404,
    );
  }
  return { Tags: tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = stringOrUndefined(input["ResourceArn"]);
  if (resourceArn === undefined) {
    throw awsError("BadRequestException", "resourceArn is required.", 400);
  }
  const newTags = stringMapFrom(input["Tags"]);
  const updated = updateResourceTags(ctx, resourceArn, (existing) => ({
    ...existing,
    ...newTags,
  }));
  if (!updated) {
    throw awsError(
      "NotFoundException",
      `Resource ${resourceArn} not found.`,
      404,
    );
  }
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = stringOrUndefined(input["ResourceArn"]);
  if (resourceArn === undefined) {
    throw awsError("BadRequestException", "resourceArn is required.", 400);
  }
  const tagKeys = stringListFrom(input["TagKeys"]);
  const updated = updateResourceTags(ctx, resourceArn, (existing) => {
    const result = { ...existing };
    for (const k of tagKeys) delete result[k];
    return result;
  });
  if (!updated) {
    throw awsError(
      "NotFoundException",
      `Resource ${resourceArn} not found.`,
      404,
    );
  }
  return {};
};

const findResourceTags = (
  ctx: ServiceContext,
  arn: string,
): Record<string, string> | undefined => {
  const cluster = ctx.store.get<StoredCluster>(clusterKey(arn));
  if (cluster !== undefined) return cluster.tags;
  const cfg = ctx.store.get<StoredConfiguration>(configKey(arn));
  if (cfg !== undefined) return cfg.tags;
  const replicator = ctx.store.get<StoredReplicator>(replicatorKey(arn));
  if (replicator !== undefined) return replicator.tags;
  const vpcConn = ctx.store.get<StoredVpcConnection>(vpcConnectionKey(arn));
  if (vpcConn !== undefined) return vpcConn.tags;
  return undefined;
};

const updateResourceTags = (
  ctx: ServiceContext,
  arn: string,
  updater: (tags: Record<string, string>) => Record<string, string>,
): boolean => {
  const cluster = ctx.store.get<StoredCluster>(clusterKey(arn));
  if (cluster !== undefined) {
    ctx.store.set(clusterKey(arn), {
      ...cluster,
      tags: updater(cluster.tags),
    });
    return true;
  }
  const cfg = ctx.store.get<StoredConfiguration>(configKey(arn));
  if (cfg !== undefined) {
    ctx.store.set(configKey(arn), {
      ...cfg,
      tags: updater(cfg.tags),
    });
    return true;
  }
  const replicator = ctx.store.get<StoredReplicator>(replicatorKey(arn));
  if (replicator !== undefined) {
    ctx.store.set(replicatorKey(arn), {
      ...replicator,
      tags: updater(replicator.tags),
    });
    return true;
  }
  const vpcConn = ctx.store.get<StoredVpcConnection>(vpcConnectionKey(arn));
  if (vpcConn !== undefined) {
    ctx.store.set(vpcConnectionKey(arn), {
      ...vpcConn,
      tags: updater(vpcConn.tags),
    });
    return true;
  }
  return false;
};

const GetClusterPolicy: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  return { CurrentVersion: cluster.currentVersion, Policy: cluster.policy };
};

const PutClusterPolicy: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  const policy = stringOrUndefined(input["Policy"]) ?? "";
  const nextVersion = String(parseInt(cluster.currentVersion, 10) + 1);
  ctx.store.set(clusterKey(clusterArn), {
    ...cluster,
    policy,
    currentVersion: nextVersion,
  });
  return { CurrentVersion: nextVersion };
};

const DeleteClusterPolicy: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  ctx.store.set(clusterKey(clusterArn), { ...cluster, policy: undefined });
  return {};
};

const BatchAssociateScramSecret: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  const secretArnList = stringListFrom(input["SecretArnList"]);
  const updated = {
    ...cluster,
    scramSecrets: [...new Set([...cluster.scramSecrets, ...secretArnList])],
  };
  ctx.store.set(clusterKey(clusterArn), updated);
  return {
    ClusterArn: clusterArn,
    UnprocessedScramSecrets: [],
  };
};

const BatchDisassociateScramSecret: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  const secretArnList = new Set(stringListFrom(input["SecretArnList"]));
  const updated = {
    ...cluster,
    scramSecrets: cluster.scramSecrets.filter((s) => !secretArnList.has(s)),
  };
  ctx.store.set(clusterKey(clusterArn), updated);
  return {
    ClusterArn: clusterArn,
    UnprocessedScramSecrets: [],
  };
};

const ListScramSecrets: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  const cluster = requireCluster(ctx, clusterArn);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const secrets = [...cluster.scramSecrets].sort();
  const { page, nextToken: next } = paginateList(
    secrets,
    maxResults,
    nextToken,
    (s) => s,
  );
  return { SecretArnList: page, NextToken: next };
};

const GetCompatibleKafkaVersions: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  const versions = ["2.6.3", "2.7.2", "2.8.1", "3.3.1", "3.4.0", "3.5.1"];
  if (clusterArn !== undefined) {
    const cluster = requireCluster(ctx, clusterArn);
    const current = cluster.kafkaVersion;
    const currentIdx = versions.indexOf(current);
    return {
      CompatibleKafkaVersions: [
        {
          sourceVersion: current,
          targetVersions: versions.slice(currentIdx >= 0 ? currentIdx + 1 : 0),
        },
      ],
    };
  }
  return {
    CompatibleKafkaVersions: versions.slice(0, -1).map((v, i) => ({
      sourceVersion: v,
      targetVersions: versions.slice(i + 1),
    })),
  };
};

const ListKafkaVersions: OperationHandler = (input, ctx) => {
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const versions = [
    { version: "2.6.3", status: "ACTIVE" },
    { version: "2.7.2", status: "ACTIVE" },
    { version: "2.8.1", status: "ACTIVE" },
    { version: "3.3.1", status: "ACTIVE" },
    { version: "3.4.0", status: "ACTIVE" },
    { version: "3.5.1", status: "ACTIVE" },
  ];
  const { page, nextToken: next } = paginateList(
    versions,
    maxResults,
    nextToken,
    (v) => v.version,
  );
  return { KafkaVersions: page, NextToken: next };
};

const CreateVpcConnection: OperationHandler = (input, ctx) => {
  const targetClusterArn = stringOrUndefined(input["TargetClusterArn"]);
  if (targetClusterArn === undefined) {
    throw awsError("BadRequestException", "targetClusterArn is required.", 400);
  }
  requireCluster(ctx, targetClusterArn);
  const authentication = stringOrUndefined(input["Authentication"]);
  if (authentication === undefined) {
    throw awsError("BadRequestException", "authentication is required.", 400);
  }
  const vpcId = stringOrUndefined(input["VpcId"]);
  if (vpcId === undefined) {
    throw awsError("BadRequestException", "vpcId is required.", 400);
  }
  const clientSubnets = stringListFrom(input["ClientSubnets"]);
  if (clientSubnets.length === 0) {
    throw awsError("BadRequestException", "clientSubnets is required.", 400);
  }
  const securityGroups = stringListFrom(input["SecurityGroups"]);
  if (securityGroups.length === 0) {
    throw awsError("BadRequestException", "securityGroups is required.", 400);
  }
  const shortId = crypto.randomUUID();
  const arn = vpcConnectionArnOf(ctx, shortId);
  const conn: StoredVpcConnection = {
    vpcConnectionArn: arn,
    targetClusterArn,
    vpcId,
    clientSubnets,
    securityGroups,
    authentication,
    creationTime: nowMs(),
    state: "AVAILABLE",
    tags: stringMapFrom(input["Tags"]),
  };
  ctx.store.set(vpcConnectionKey(arn), conn);
  return {
    VpcConnectionArn: arn,
    State: "AVAILABLE",
    Authentication: conn.authentication,
    VpcId: conn.vpcId,
    ClientSubnets: conn.clientSubnets,
    SecurityGroups: conn.securityGroups,
    CreationTime: new Date(conn.creationTime).toISOString(),
    Tags: conn.tags,
  };
};

const DescribeVpcConnection: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["Arn"]);
  if (arn === undefined) {
    throw awsError("BadRequestException", "arn is required.", 400);
  }
  const conn = ctx.store.get<StoredVpcConnection>(vpcConnectionKey(arn));
  if (conn === undefined) {
    throw awsError(
      "NotFoundException",
      `VPC connection ${arn} not found.`,
      404,
    );
  }
  return {
    VpcConnectionArn: conn.vpcConnectionArn,
    TargetClusterArn: conn.targetClusterArn,
    State: conn.state,
    Authentication: conn.authentication,
    VpcId: conn.vpcId,
    Subnets: conn.clientSubnets,
    SecurityGroups: conn.securityGroups,
    CreationTime: new Date(conn.creationTime).toISOString(),
    Tags: conn.tags,
  };
};

const DeleteVpcConnection: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["Arn"]);
  if (arn === undefined) {
    throw awsError("BadRequestException", "arn is required.", 400);
  }
  const conn = ctx.store.get<StoredVpcConnection>(vpcConnectionKey(arn));
  if (conn === undefined) {
    throw awsError(
      "NotFoundException",
      `VPC connection ${arn} not found.`,
      404,
    );
  }
  ctx.store.set(vpcConnectionKey(arn), { ...conn, state: "DELETING" });
  return { VpcConnectionArn: arn, State: "DELETING" };
};

const ListVpcConnections: OperationHandler = (input, ctx) => {
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const conns = ctx.store
    .list<StoredVpcConnection>()
    .filter((e) => e.key.startsWith("vpcconn/"))
    .map((e) => e.value)
    .filter((c) => c.state !== "DELETING")
    .sort((a, b) => a.vpcConnectionArn.localeCompare(b.vpcConnectionArn));
  const { page, nextToken: next } = paginateList(
    conns,
    maxResults,
    nextToken,
    (c) => c.vpcConnectionArn,
  );
  return {
    VpcConnections: page.map((c) => ({
      vpcConnectionArn: c.vpcConnectionArn,
      targetClusterArn: c.targetClusterArn,
      state: c.state,
      authentication: c.authentication,
      vpcId: c.vpcId,
      creationTime: new Date(c.creationTime).toISOString(),
    })),
    NextToken: next,
  };
};

const ListClientVpcConnections: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  requireCluster(ctx, clusterArn);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const conns = ctx.store
    .list<StoredVpcConnection>()
    .filter(
      (e) =>
        e.key.startsWith("vpcconn/") && e.value.targetClusterArn === clusterArn,
    )
    .map((e) => e.value)
    .filter((c) => c.state !== "DELETING")
    .sort((a, b) => a.vpcConnectionArn.localeCompare(b.vpcConnectionArn));
  const { page, nextToken: next } = paginateList(
    conns,
    maxResults,
    nextToken,
    (c) => c.vpcConnectionArn,
  );
  return {
    ClientVpcConnections: page.map((c) => ({
      vpcConnectionArn: c.vpcConnectionArn,
      authentication: c.authentication,
      creationTime: new Date(c.creationTime).toISOString(),
      state: c.state,
      owner: ctx.account,
    })),
    NextToken: next,
  };
};

const RejectClientVpcConnection: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  requireCluster(ctx, clusterArn);
  const vpcConnectionArn = stringOrUndefined(input["VpcConnectionArn"]);
  if (vpcConnectionArn === undefined) {
    throw awsError("BadRequestException", "vpcConnectionArn is required.", 400);
  }
  const conn = ctx.store.get<StoredVpcConnection>(
    vpcConnectionKey(vpcConnectionArn),
  );
  if (conn === undefined) {
    throw awsError(
      "BadRequestException",
      `VPC connection ${vpcConnectionArn} not found.`,
      400,
    );
  }
  ctx.store.set(vpcConnectionKey(vpcConnectionArn), {
    ...conn,
    state: "REJECTED",
  });
  return {
    VpcConnectionArn: vpcConnectionArn,
    State: "REJECTED",
  };
};

const CreateReplicator: OperationHandler = (input, ctx) => {
  const replicatorName = stringOrUndefined(input["ReplicatorName"]);
  if (replicatorName === undefined) {
    throw awsError("BadRequestException", "replicatorName is required.", 400);
  }
  const shortId = crypto.randomUUID();
  const arn = replicatorArnOf(ctx, replicatorName, shortId);
  const replicator: StoredReplicator = {
    replicatorArn: arn,
    replicatorName,
    description: stringOrUndefined(input["Description"]) ?? "",
    kafkaClusters: Array.isArray(input["KafkaClusters"])
      ? (input["KafkaClusters"] as Record<string, unknown>[])
      : [],
    replicationInfoList: Array.isArray(input["ReplicationInfoList"])
      ? (input["ReplicationInfoList"] as Record<string, unknown>[])
      : [],
    serviceExecutionRoleArn:
      stringOrUndefined(input["ServiceExecutionRoleArn"]) ?? "",
    replicatorState: "CREATING",
    creationTime: nowMs(),
    tags: stringMapFrom(input["Tags"]),
  };
  ctx.store.set(replicatorKey(arn), replicator);
  return {
    ReplicatorArn: arn,
    ReplicatorName: replicatorName,
    ReplicatorState: "CREATING",
  };
};

const DescribeReplicator: OperationHandler = (input, ctx) => {
  const replicatorArn = stringOrUndefined(input["ReplicatorArn"]);
  if (replicatorArn === undefined) {
    throw awsError("BadRequestException", "replicatorArn is required.", 400);
  }
  const replicator = ctx.store.get<StoredReplicator>(
    replicatorKey(replicatorArn),
  );
  if (replicator === undefined) {
    throw awsError(
      "NotFoundException",
      `Replicator ${replicatorArn} not found.`,
      404,
    );
  }
  const state =
    replicator.replicatorState === "CREATING"
      ? "RUNNING"
      : replicator.replicatorState;
  if (replicator.replicatorState === "CREATING") {
    ctx.store.set(replicatorKey(replicatorArn), {
      ...replicator,
      replicatorState: "RUNNING",
    });
  }
  return {
    CreationTime: new Date(replicator.creationTime).toISOString(),
    CurrentVersion: "1",
    IsReplicatorReference: false,
    KafkaClusters: replicator.kafkaClusters,
    ReplicationInfoList: replicator.replicationInfoList,
    ReplicatorArn: replicator.replicatorArn,
    ReplicatorDescription: replicator.description,
    ReplicatorName: replicator.replicatorName,
    ReplicatorResourceArn: replicator.replicatorArn,
    ReplicatorState: state,
    ServiceExecutionRoleArn: replicator.serviceExecutionRoleArn,
    Tags: replicator.tags,
  };
};

const DeleteReplicator: OperationHandler = (input, ctx) => {
  const replicatorArn = stringOrUndefined(input["ReplicatorArn"]);
  if (replicatorArn === undefined) {
    throw awsError("BadRequestException", "replicatorArn is required.", 400);
  }
  const replicator = ctx.store.get<StoredReplicator>(
    replicatorKey(replicatorArn),
  );
  if (replicator === undefined) {
    throw awsError(
      "NotFoundException",
      `Replicator ${replicatorArn} not found.`,
      404,
    );
  }
  ctx.store.set(replicatorKey(replicatorArn), {
    ...replicator,
    replicatorState: "DELETING",
  });
  return { ReplicatorArn: replicatorArn, ReplicatorState: "DELETING" };
};

const ListReplicators: OperationHandler = (input, ctx) => {
  const replicatorNameFilter = stringOrUndefined(input["ReplicatorNameFilter"]);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  let replicators = ctx.store
    .list<StoredReplicator>()
    .filter((e) => e.key.startsWith("replicator/"))
    .map((e) => e.value)
    .filter((r) => r.replicatorState !== "DELETING")
    .sort((a, b) => a.replicatorName.localeCompare(b.replicatorName));
  if (replicatorNameFilter !== undefined) {
    replicators = replicators.filter((r) =>
      r.replicatorName.startsWith(replicatorNameFilter),
    );
  }
  const { page, nextToken: next } = paginateList(
    replicators,
    maxResults,
    nextToken,
    (r) => r.replicatorName,
  );
  return {
    Replicators: page.map((r) => ({
      creationTime: new Date(r.creationTime).toISOString(),
      isReplicatorReference: false,
      kafkaClustersSummary: r.kafkaClusters.map((kc) => ({
        amazonMskCluster: asRecord(kc["amazonMskCluster"]),
        vpcConfig: asRecord(kc["vpcConfig"]),
      })),
      replicationInfoSummaryList: r.replicationInfoList.map((ri) => ({
        sourceKafkaClusterAlias: ri["sourceKafkaClusterAlias"],
        targetKafkaClusterAlias: ri["targetKafkaClusterAlias"],
      })),
      replicatorArn: r.replicatorArn,
      replicatorName: r.replicatorName,
      replicatorResourceArn: r.replicatorArn,
      replicatorState: r.replicatorState,
    })),
    NextToken: next,
  };
};

const UpdateReplicationInfo: OperationHandler = (input, ctx) => {
  const replicatorArn = stringOrUndefined(input["ReplicatorArn"]);
  if (replicatorArn === undefined) {
    throw awsError("BadRequestException", "replicatorArn is required.", 400);
  }
  const replicator = ctx.store.get<StoredReplicator>(
    replicatorKey(replicatorArn),
  );
  if (replicator === undefined) {
    throw awsError(
      "NotFoundException",
      `Replicator ${replicatorArn} not found.`,
      404,
    );
  }
  const srcArn = stringOrUndefined(input["SourceKafkaClusterArn"]) ?? "";
  const tgtArn = stringOrUndefined(input["TargetKafkaClusterArn"]) ?? "";
  const topicReplication = asRecord(input["TopicReplication"]);
  const consumerGroupReplication = asRecord(input["ConsumerGroupReplication"]);

  const updatedList = replicator.replicationInfoList.map(
    (ri: Record<string, unknown>) => {
      const riSrc =
        (ri["sourceKafkaClusterArn"] as string | undefined) ??
        (ri["SourceKafkaClusterArn"] as string | undefined) ??
        "";
      const riTgt =
        (ri["targetKafkaClusterArn"] as string | undefined) ??
        (ri["TargetKafkaClusterArn"] as string | undefined) ??
        "";
      if (riSrc !== srcArn || riTgt !== tgtArn) return ri;
      return {
        ...ri,
        ...(topicReplication !== undefined
          ? {
              TopicReplication: {
                ...(asRecord(ri["TopicReplication"]) ?? {}),
                ...topicReplication,
              },
            }
          : {}),
        ...(consumerGroupReplication !== undefined
          ? {
              ConsumerGroupReplication: {
                ...(asRecord(ri["ConsumerGroupReplication"]) ?? {}),
                ...consumerGroupReplication,
              },
            }
          : {}),
      };
    },
  );

  ctx.store.set(replicatorKey(replicatorArn), {
    ...replicator,
    replicationInfoList: updatedList,
    replicatorState: "UPDATING",
  });

  return {
    ReplicatorArn: replicatorArn,
    ReplicatorState: "UPDATING",
  };
};

const requireTopic = (
  ctx: ServiceContext,
  clusterArn: string,
  name: string,
  errorCode: string,
): StoredTopic => {
  const topic = ctx.store.get<StoredTopic>(topicKey(clusterArn, name));
  if (topic === undefined) {
    throw awsError(
      errorCode,
      `Topic ${name} not found on cluster ${clusterArn}.`,
      404,
    );
  }
  return topic;
};

const CreateTopic: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  requireCluster(ctx, clusterArn);
  const topicName = stringOrUndefined(input["TopicName"]);
  if (topicName === undefined) {
    throw awsError("BadRequestException", "topicName is required.", 400);
  }
  const partitionCount = numberOrUndefined(input["PartitionCount"]);
  if (partitionCount === undefined) {
    throw awsError("BadRequestException", "partitionCount is required.", 400);
  }
  const replicationFactor = numberOrUndefined(input["ReplicationFactor"]);
  if (replicationFactor === undefined) {
    throw awsError(
      "BadRequestException",
      "replicationFactor is required.",
      400,
    );
  }
  if (
    ctx.store.get<StoredTopic>(topicKey(clusterArn, topicName)) !== undefined
  ) {
    throw awsError(
      "TopicExistsException",
      `Topic ${topicName} already exists.`,
      409,
    );
  }
  const arn = topicArnOf(ctx, clusterArn, topicName);
  const topic: StoredTopic = {
    topicArn: arn,
    topicName,
    clusterArn,
    partitionCount,
    replicationFactor,
    status: "ACTIVE",
    configs: typeof input["Configs"] === "string" ? input["Configs"] : "",
  };
  ctx.store.set(topicKey(clusterArn, topicName), topic);
  return {
    TopicArn: arn,
    TopicName: topicName,
    Status: "ACTIVE",
  };
};

const DescribeTopic: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  const topicName = stringOrUndefined(input["TopicName"]);
  if (clusterArn === undefined || topicName === undefined) {
    throw awsError(
      "BadRequestException",
      "clusterArn and topicName are required.",
      400,
    );
  }
  requireCluster(ctx, clusterArn);
  const topic = requireTopic(ctx, clusterArn, topicName, "NotFoundException");
  return {
    Configs: topic.configs,
    PartitionCount: topic.partitionCount,
    ReplicationFactor: topic.replicationFactor,
    Status: topic.status,
    TopicArn: topic.topicArn,
    TopicName: topic.topicName,
  };
};

const ListTopics: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  if (clusterArn === undefined) {
    throw awsError("BadRequestException", "clusterArn is required.", 400);
  }
  requireCluster(ctx, clusterArn);
  const topicNameFilter = stringOrUndefined(input["TopicNameFilter"]);
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  let topics = ctx.store
    .list<StoredTopic>()
    .filter((e) => e.key.startsWith(`topic/${clusterArn}/`))
    .map((e) => e.value)
    .sort((a, b) => a.topicName.localeCompare(b.topicName));
  if (topicNameFilter !== undefined) {
    topics = topics.filter((t) => t.topicName.startsWith(topicNameFilter));
  }
  const { page, nextToken: next } = paginateList(
    topics,
    maxResults,
    nextToken,
    (t) => t.topicName,
  );
  return {
    Topics: page.map((t) => ({
      OutOfSyncReplicaCount: 0,
      PartitionCount: t.partitionCount,
      ReplicationFactor: t.replicationFactor,
      TopicArn: t.topicArn,
      TopicName: t.topicName,
    })),
    NextToken: next,
  };
};

const UpdateTopic: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  const topicName = stringOrUndefined(input["TopicName"]);
  if (clusterArn === undefined || topicName === undefined) {
    throw awsError(
      "BadRequestException",
      "clusterArn and topicName are required.",
      400,
    );
  }
  requireCluster(ctx, clusterArn);
  const topic = requireTopic(
    ctx,
    clusterArn,
    topicName,
    "UnknownTopicOrPartitionException",
  );
  const updatedConfigs =
    typeof input["Configs"] === "string" ? input["Configs"] : topic.configs;
  ctx.store.set(topicKey(clusterArn, topicName), {
    ...topic,
    configs: updatedConfigs,
  });
  return {
    Status: topic.status,
    TopicArn: topic.topicArn,
    TopicName: topic.topicName,
  };
};

const DeleteTopic: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  const topicName = stringOrUndefined(input["TopicName"]);
  if (clusterArn === undefined || topicName === undefined) {
    throw awsError(
      "BadRequestException",
      "clusterArn and topicName are required.",
      400,
    );
  }
  requireCluster(ctx, clusterArn);
  const topic = requireTopic(
    ctx,
    clusterArn,
    topicName,
    "UnknownTopicOrPartitionException",
  );
  ctx.store.delete(topicKey(clusterArn, topicName));
  return {
    Status: "DELETING",
    TopicArn: topic.topicArn,
    TopicName: topic.topicName,
  };
};

const DescribeTopicPartitions: OperationHandler = (input, ctx) => {
  const clusterArn = stringOrUndefined(input["ClusterArn"]);
  const topicName = stringOrUndefined(input["TopicName"]);
  if (clusterArn === undefined || topicName === undefined) {
    throw awsError(
      "BadRequestException",
      "clusterArn and topicName are required.",
      400,
    );
  }
  requireCluster(ctx, clusterArn);
  const topic = requireTopic(ctx, clusterArn, topicName, "NotFoundException");
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const partitions = Array.from({ length: topic.partitionCount }, (_, i) => ({
    Partition: i,
    Leader: { Host: "", Port: 9092, Rack: undefined },
    Replicas: Array.from({ length: topic.replicationFactor }, (__, r) => ({
      Host: "",
      Port: 9092,
      Rack: undefined,
    })),
    Isr: Array.from({ length: topic.replicationFactor }, (__, r) => ({
      Host: "",
      Port: 9092,
      Rack: undefined,
    })),
  }));
  const { page, nextToken: next } = paginateList(
    partitions,
    maxResults,
    nextToken,
    (p) => String(p.Partition).padStart(20, "0"),
  );
  return { Partitions: page, NextToken: next };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const kafka = {
  name: "kafka",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);

    if (parts[0] === "api" && parts[1] === "v2") {
      if (parts[2] === "clusters") {
        if (parts.length === 3) {
          if (req.method === "POST") return "CreateClusterV2";
          if (req.method === "GET") return "ListClustersV2";
          return undefined;
        }
        if (parts.length === 4) {
          if (req.method === "GET") return "DescribeClusterV2";
          return undefined;
        }
        if (parts.length === 5 && parts[4] === "operations") {
          if (req.method === "GET") return "ListClusterOperationsV2";
          return undefined;
        }
        return undefined;
      }
      if (parts[2] === "operations" && parts.length === 4) {
        if (req.method === "GET") return "DescribeClusterOperationV2";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "replication" && parts[1] === "v1") {
      if (parts[2] === "replicators") {
        if (parts.length === 3) {
          if (req.method === "POST") return "CreateReplicator";
          if (req.method === "GET") return "ListReplicators";
          return undefined;
        }
        if (parts.length === 4) {
          if (req.method === "GET") return "DescribeReplicator";
          if (req.method === "DELETE") return "DeleteReplicator";
          return undefined;
        }
        if (parts.length === 5 && parts[4] === "replication-info") {
          if (req.method === "PUT") return "UpdateReplicationInfo";
          return undefined;
        }
        return undefined;
      }
      return undefined;
    }

    if (parts[0] !== "v1") return undefined;

    if (parts[1] === "clusters") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateCluster";
        if (req.method === "GET") return "ListClusters";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "DescribeCluster";
        if (req.method === "DELETE") return "DeleteCluster";
        return undefined;
      }
      if (parts.length === 4) {
        const sub = parts[3];
        if (sub === "bootstrap-brokers" && req.method === "GET")
          return "GetBootstrapBrokers";
        if (sub === "configuration" && req.method === "PUT")
          return "UpdateClusterConfiguration";
        if (sub === "connectivity" && req.method === "PUT")
          return "UpdateConnectivity";
        if (sub === "monitoring" && req.method === "PUT")
          return "UpdateMonitoring";
        if (sub === "operations" && req.method === "GET")
          return "ListClusterOperations";
        if (sub === "rebalancing" && req.method === "PUT")
          return "UpdateRebalancing";
        if (sub === "reboot-broker" && req.method === "PUT")
          return "RebootBroker";
        if (sub === "security" && req.method === "PATCH")
          return "UpdateSecurity";
        if (sub === "storage" && req.method === "PUT") return "UpdateStorage";
        if (sub === "version" && req.method === "PUT")
          return "UpdateClusterKafkaVersion";
        if (sub === "nodes" && req.method === "GET") return "ListNodes";
        if (sub === "topics" && req.method === "GET") return "ListTopics";
        if (sub === "topics" && req.method === "POST") return "CreateTopic";
        if (sub === "client-vpc-connections" && req.method === "GET")
          return "ListClientVpcConnections";
        if (sub === "client-vpc-connection" && req.method === "PUT")
          return "RejectClientVpcConnection";
        if (sub === "scram-secrets" && req.method === "GET")
          return "ListScramSecrets";
        if (sub === "scram-secrets" && req.method === "POST")
          return "BatchAssociateScramSecret";
        if (sub === "scram-secrets" && req.method === "PATCH")
          return "BatchDisassociateScramSecret";
        if (sub === "policy" && req.method === "GET") return "GetClusterPolicy";
        if (sub === "policy" && req.method === "PUT") return "PutClusterPolicy";
        if (sub === "policy" && req.method === "DELETE")
          return "DeleteClusterPolicy";
        return undefined;
      }
      if (parts.length === 5) {
        if (parts[3] === "nodes") {
          if (parts[4] === "count" && req.method === "PUT")
            return "UpdateBrokerCount";
          if (parts[4] === "storage" && req.method === "PUT")
            return "UpdateBrokerStorage";
          if (parts[4] === "type" && req.method === "PUT")
            return "UpdateBrokerType";
          return undefined;
        }
        if (parts[3] === "topics") {
          if (req.method === "GET") return "DescribeTopic";
          if (req.method === "PUT") return "UpdateTopic";
          if (req.method === "DELETE") return "DeleteTopic";
          return undefined;
        }
        return undefined;
      }
      if (
        parts.length === 6 &&
        parts[3] === "topics" &&
        parts[5] === "partitions"
      ) {
        if (req.method === "GET") return "DescribeTopicPartitions";
        return undefined;
      }
      return undefined;
    }

    if (parts[1] === "compatible-kafka-versions" && parts.length === 2) {
      if (req.method === "GET") return "GetCompatibleKafkaVersions";
      return undefined;
    }

    if (parts[1] === "configurations") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateConfiguration";
        if (req.method === "GET") return "ListConfigurations";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "DescribeConfiguration";
        if (req.method === "PUT") return "UpdateConfiguration";
        if (req.method === "DELETE") return "DeleteConfiguration";
        return undefined;
      }
      if (parts.length === 4 && parts[3] === "revisions") {
        if (req.method === "GET") return "ListConfigurationRevisions";
        return undefined;
      }
      if (parts.length === 5 && parts[3] === "revisions") {
        if (req.method === "GET") return "DescribeConfigurationRevision";
        return undefined;
      }
      return undefined;
    }

    if (parts[1] === "kafka-versions" && parts.length === 2) {
      if (req.method === "GET") return "ListKafkaVersions";
      return undefined;
    }

    if (parts[1] === "operations" && parts.length === 3) {
      if (req.method === "GET") return "DescribeClusterOperation";
      return undefined;
    }

    if (parts[1] === "tags") {
      if (parts.length === 3) {
        if (req.method === "GET") return "ListTagsForResource";
        if (req.method === "POST") return "TagResource";
        if (req.method === "DELETE") return "UntagResource";
        return undefined;
      }
      return undefined;
    }

    if (parts[1] === "vpc-connection") {
      if (parts.length === 2 && req.method === "POST")
        return "CreateVpcConnection";
      if (parts.length === 3) {
        if (req.method === "GET") return "DescribeVpcConnection";
        if (req.method === "DELETE") return "DeleteVpcConnection";
        return undefined;
      }
      return undefined;
    }

    if (parts[1] === "vpc-connections" && parts.length === 2) {
      if (req.method === "GET") return "ListVpcConnections";
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateCluster,
    CreateClusterV2,
    DescribeCluster,
    DescribeClusterV2,
    ListClusters,
    ListClustersV2,
    DeleteCluster,
    GetBootstrapBrokers,
    CreateConfiguration,
    DescribeConfiguration,
    UpdateConfiguration,
    DeleteConfiguration,
    ListConfigurations,
    DescribeConfigurationRevision,
    ListConfigurationRevisions,
    UpdateBrokerCount,
    UpdateBrokerStorage,
    UpdateBrokerType,
    UpdateClusterConfiguration,
    UpdateClusterKafkaVersion,
    UpdateConnectivity,
    UpdateMonitoring,
    UpdateRebalancing,
    UpdateSecurity,
    UpdateStorage,
    RebootBroker,
    ListNodes,
    DescribeClusterOperation,
    DescribeClusterOperationV2,
    ListClusterOperations,
    ListClusterOperationsV2,
    ListTagsForResource,
    TagResource,
    UntagResource,
    GetClusterPolicy,
    PutClusterPolicy,
    DeleteClusterPolicy,
    BatchAssociateScramSecret,
    BatchDisassociateScramSecret,
    ListScramSecrets,
    GetCompatibleKafkaVersions,
    ListKafkaVersions,
    CreateVpcConnection,
    DescribeVpcConnection,
    DeleteVpcConnection,
    ListVpcConnections,
    ListClientVpcConnections,
    RejectClientVpcConnection,
    CreateReplicator,
    DescribeReplicator,
    DeleteReplicator,
    ListReplicators,
    UpdateReplicationInfo,
    CreateTopic,
    DescribeTopic,
    ListTopics,
    UpdateTopic,
    DeleteTopic,
    DescribeTopicPartitions,
  },
  model,
} as const satisfies ServiceDefinition;

export default kafka;
