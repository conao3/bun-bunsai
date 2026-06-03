import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import mqModel from "../../../../test/vendor/aws-models/mq.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(mqModel);

type StoredBroker = {
  brokerId: string;
  brokerArn: string;
  brokerName: string;
  brokerState: string;
  engineType: string;
  engineVersion: string;
  deploymentMode: string;
  hostInstanceType: string;
  authenticationStrategy: string;
  autoMinorVersionUpgrade: boolean;
  publiclyAccessible: boolean;
  storageType: string;
  securityGroups: string[];
  subnetIds: string[];
  tags: Record<string, string>;
  created: number;
};

type StoredConfiguration = {
  id: string;
  arn: string;
  name: string;
  engineType: string;
  engineVersion: string;
  authenticationStrategy: string;
  description: string;
  tags: Record<string, string>;
  created: number;
  latestRevision: number;
};

type StoredUser = {
  brokerId: string;
  username: string;
  consoleAccess: boolean;
  groups: string[];
  replicationUser: boolean;
};

type StoredConfigurationRevision = {
  configurationId: string;
  created: number;
  data: string;
  description: string;
  revision: number;
};

const brokerKey = (id: string): string => `broker/${id}`;

const configurationKey = (id: string): string => `configuration/${id}`;

const userKey = (brokerId: string, username: string): string =>
  `user/${brokerId}/${username}`;

const configRevisionKey = (configId: string, revision: number): string =>
  `config-revision/${configId}/${revision}`;

const tagKey = (resourceArn: string): string => `tag/${resourceArn}`;

const hex = (length: number): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const stringMap = (value: unknown): Record<string, string> => {
  if (typeof value !== "object" || value === null) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") result[key] = entry;
  }
  return result;
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("BadRequestException", `${key} is required.`, 400);
  }
  return value;
};

const requireBroker = (ctx: ServiceContext, brokerId: string): StoredBroker => {
  const broker = ctx.store.get<StoredBroker>(brokerKey(brokerId));
  if (broker === undefined) {
    throw awsError(
      "NotFoundException",
      `Can't find requested broker [${brokerId}].`,
      404,
    );
  }
  return broker;
};

const requireConfiguration = (
  ctx: ServiceContext,
  configId: string,
): StoredConfiguration => {
  const config = ctx.store.get<StoredConfiguration>(configurationKey(configId));
  if (config === undefined) {
    throw awsError(
      "NotFoundException",
      `Can't find requested configuration [${configId}].`,
      404,
    );
  }
  return config;
};

const isoTimestamp = (epochSeconds: number): string =>
  new Date(epochSeconds * 1000).toISOString();

const CreateBroker: OperationHandler = (input, ctx) => {
  const brokerName = requireString(input, "BrokerName");
  const brokerId = `b-${hex(8)}`;
  const brokerArn = `arn:aws:mq:${ctx.region}:${ctx.account}:broker:${brokerName}:${brokerId}`;
  const broker: StoredBroker = {
    brokerId,
    brokerArn,
    brokerName,
    brokerState: "RUNNING",
    engineType: stringOrUndefined(input["EngineType"]) ?? "ACTIVEMQ",
    engineVersion: stringOrUndefined(input["EngineVersion"]) ?? "5.18.0",
    deploymentMode:
      stringOrUndefined(input["DeploymentMode"]) ?? "SINGLE_INSTANCE",
    hostInstanceType:
      stringOrUndefined(input["HostInstanceType"]) ?? "mq.m5.large",
    authenticationStrategy:
      stringOrUndefined(input["AuthenticationStrategy"]) ?? "SIMPLE",
    autoMinorVersionUpgrade: input["AutoMinorVersionUpgrade"] === true,
    publiclyAccessible: input["PubliclyAccessible"] === true,
    storageType: stringOrUndefined(input["StorageType"]) ?? "EFS",
    securityGroups: stringList(input["SecurityGroups"]),
    subnetIds: stringList(input["SubnetIds"]),
    tags: stringMap(input["Tags"]),
    created: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(brokerKey(brokerId), broker);
  return { BrokerArn: brokerArn, BrokerId: brokerId };
};

const brokerView = (broker: StoredBroker): Record<string, unknown> => ({
  BrokerArn: broker.brokerArn,
  BrokerId: broker.brokerId,
  BrokerName: broker.brokerName,
  BrokerState: broker.brokerState,
  EngineType: broker.engineType,
  EngineVersion: broker.engineVersion,
  DeploymentMode: broker.deploymentMode,
  HostInstanceType: broker.hostInstanceType,
  AuthenticationStrategy: broker.authenticationStrategy,
  AutoMinorVersionUpgrade: broker.autoMinorVersionUpgrade,
  PubliclyAccessible: broker.publiclyAccessible,
  StorageType: broker.storageType,
  SecurityGroups: broker.securityGroups,
  SubnetIds: broker.subnetIds,
  Tags: broker.tags,
  Created: isoTimestamp(broker.created),
});

const DescribeBroker: OperationHandler = (input, ctx) => {
  const brokerId = requireString(input, "BrokerId");
  const broker = requireBroker(ctx, brokerId);
  return brokerView(broker);
};

const ListBrokers: OperationHandler = (_input, ctx) => {
  const brokers = ctx.store
    .list<StoredBroker>()
    .filter((entry) => entry.key.startsWith("broker/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.brokerId.localeCompare(b.brokerId));
  return {
    BrokerSummaries: brokers.map((broker) => ({
      BrokerArn: broker.brokerArn,
      BrokerId: broker.brokerId,
      BrokerName: broker.brokerName,
      BrokerState: broker.brokerState,
      EngineType: broker.engineType,
      DeploymentMode: broker.deploymentMode,
      HostInstanceType: broker.hostInstanceType,
      Created: isoTimestamp(broker.created),
    })),
  };
};

const DeleteBroker: OperationHandler = (input, ctx) => {
  const brokerId = requireString(input, "BrokerId");
  const broker = requireBroker(ctx, brokerId);
  broker.brokerState = "DELETION_IN_PROGRESS";
  ctx.store.delete(brokerKey(brokerId));
  return { BrokerId: brokerId };
};

const UpdateBroker: OperationHandler = (input, ctx) => {
  const brokerId = requireString(input, "BrokerId");
  const broker = requireBroker(ctx, brokerId);
  const engineVersion = stringOrUndefined(input["EngineVersion"]);
  if (engineVersion !== undefined) broker.engineVersion = engineVersion;
  const hostInstanceType = stringOrUndefined(input["HostInstanceType"]);
  if (hostInstanceType !== undefined)
    broker.hostInstanceType = hostInstanceType;
  const authenticationStrategy = stringOrUndefined(
    input["AuthenticationStrategy"],
  );
  if (authenticationStrategy !== undefined) {
    broker.authenticationStrategy = authenticationStrategy;
  }
  if (typeof input["AutoMinorVersionUpgrade"] === "boolean") {
    broker.autoMinorVersionUpgrade = input["AutoMinorVersionUpgrade"];
  }
  const securityGroups = input["SecurityGroups"];
  if (Array.isArray(securityGroups)) {
    broker.securityGroups = stringList(securityGroups);
  }
  ctx.store.set(brokerKey(brokerId), broker);
  return {
    BrokerId: broker.brokerId,
    AuthenticationStrategy: broker.authenticationStrategy,
    AutoMinorVersionUpgrade: broker.autoMinorVersionUpgrade,
    EngineVersion: broker.engineVersion,
    HostInstanceType: broker.hostInstanceType,
    SecurityGroups: broker.securityGroups,
  };
};

const RebootBroker: OperationHandler = (input, ctx) => {
  const brokerId = requireString(input, "BrokerId");
  requireBroker(ctx, brokerId);
  return {};
};

const Promote: OperationHandler = (input, ctx) => {
  const brokerId = requireString(input, "BrokerId");
  requireBroker(ctx, brokerId);
  return { BrokerId: brokerId };
};

const CreateUser: OperationHandler = (input, ctx) => {
  const brokerId = requireString(input, "BrokerId");
  const username = requireString(input, "Username");
  requireBroker(ctx, brokerId);
  const user: StoredUser = {
    brokerId,
    username,
    consoleAccess: input["ConsoleAccess"] === true,
    groups: stringList(input["Groups"]),
    replicationUser: input["ReplicationUser"] === true,
  };
  ctx.store.set(userKey(brokerId, username), user);
  return {};
};

const DescribeUser: OperationHandler = (input, ctx) => {
  const brokerId = requireString(input, "BrokerId");
  const username = requireString(input, "Username");
  requireBroker(ctx, brokerId);
  const user = ctx.store.get<StoredUser>(userKey(brokerId, username));
  if (user === undefined) {
    throw awsError(
      "NotFoundException",
      `Can't find requested user [${username}].`,
      404,
    );
  }
  return {
    BrokerId: brokerId,
    Username: user.username,
    ConsoleAccess: user.consoleAccess,
    Groups: user.groups,
    ReplicationUser: user.replicationUser,
  };
};

const UpdateUser: OperationHandler = (input, ctx) => {
  const brokerId = requireString(input, "BrokerId");
  const username = requireString(input, "Username");
  requireBroker(ctx, brokerId);
  const user = ctx.store.get<StoredUser>(userKey(brokerId, username));
  if (user === undefined) {
    throw awsError(
      "NotFoundException",
      `Can't find requested user [${username}].`,
      404,
    );
  }
  if (typeof input["ConsoleAccess"] === "boolean") {
    user.consoleAccess = input["ConsoleAccess"];
  }
  if (Array.isArray(input["Groups"])) {
    user.groups = stringList(input["Groups"]);
  }
  if (typeof input["ReplicationUser"] === "boolean") {
    user.replicationUser = input["ReplicationUser"];
  }
  ctx.store.set(userKey(brokerId, username), user);
  return {};
};

const DeleteUser: OperationHandler = (input, ctx) => {
  const brokerId = requireString(input, "BrokerId");
  const username = requireString(input, "Username");
  requireBroker(ctx, brokerId);
  const user = ctx.store.get<StoredUser>(userKey(brokerId, username));
  if (user === undefined) {
    throw awsError(
      "NotFoundException",
      `Can't find requested user [${username}].`,
      404,
    );
  }
  ctx.store.delete(userKey(brokerId, username));
  return {};
};

const ListUsers: OperationHandler = (input, ctx) => {
  const brokerId = requireString(input, "BrokerId");
  requireBroker(ctx, brokerId);
  const prefix = `user/${brokerId}/`;
  const users = ctx.store
    .list<StoredUser>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.username.localeCompare(b.username));
  return {
    BrokerId: brokerId,
    Users: users.map((u) => ({ Username: u.username })),
  };
};

const CreateConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const id = `c-${hex(8)}`;
  const created = Math.floor(Date.now() / 1000);
  const configuration: StoredConfiguration = {
    id,
    arn: `arn:aws:mq:${ctx.region}:${ctx.account}:configuration:${id}`,
    name,
    engineType: stringOrUndefined(input["EngineType"]) ?? "ACTIVEMQ",
    engineVersion: stringOrUndefined(input["EngineVersion"]) ?? "5.18.0",
    authenticationStrategy:
      stringOrUndefined(input["AuthenticationStrategy"]) ?? "SIMPLE",
    description: "",
    tags: stringMap(input["Tags"]),
    created,
    latestRevision: 1,
  };
  ctx.store.set(configurationKey(id), configuration);
  const initialRevision: StoredConfigurationRevision = {
    configurationId: id,
    created,
    data: "",
    description: "Initial configuration",
    revision: 1,
  };
  ctx.store.set(configRevisionKey(id, 1), initialRevision);
  return {
    Arn: configuration.arn,
    AuthenticationStrategy: configuration.authenticationStrategy,
    Created: isoTimestamp(configuration.created),
    Id: configuration.id,
    Name: configuration.name,
    LatestRevision: {
      Created: isoTimestamp(configuration.created),
      Revision: configuration.latestRevision,
    },
  };
};

const DescribeConfiguration: OperationHandler = (input, ctx) => {
  const configId = requireString(input, "ConfigurationId");
  const config = requireConfiguration(ctx, configId);
  return {
    Arn: config.arn,
    AuthenticationStrategy: config.authenticationStrategy,
    Created: isoTimestamp(config.created),
    Description: config.description,
    EngineType: config.engineType,
    EngineVersion: config.engineVersion,
    Id: config.id,
    LatestRevision: {
      Created: isoTimestamp(config.created),
      Revision: config.latestRevision,
    },
    Name: config.name,
    Tags: config.tags,
  };
};

const UpdateConfiguration: OperationHandler = (input, ctx) => {
  const configId = requireString(input, "ConfigurationId");
  const config = requireConfiguration(ctx, configId);
  const data = stringOrUndefined(input["Data"]) ?? "";
  const description = stringOrUndefined(input["Description"]) ?? "";
  config.latestRevision += 1;
  config.description = description;
  ctx.store.set(configurationKey(configId), config);
  const created = Math.floor(Date.now() / 1000);
  const revision: StoredConfigurationRevision = {
    configurationId: configId,
    created,
    data,
    description,
    revision: config.latestRevision,
  };
  ctx.store.set(configRevisionKey(configId, config.latestRevision), revision);
  return {
    Arn: config.arn,
    Created: isoTimestamp(created),
    Id: config.id,
    LatestRevision: {
      Created: isoTimestamp(created),
      Revision: config.latestRevision,
    },
    Name: config.name,
    Warnings: [],
  };
};

const DeleteConfiguration: OperationHandler = (input, ctx) => {
  const configId = requireString(input, "ConfigurationId");
  requireConfiguration(ctx, configId);
  ctx.store.delete(configurationKey(configId));
  return { ConfigurationId: configId };
};

const ListConfigurations: OperationHandler = (_input, ctx) => {
  const configs = ctx.store
    .list<StoredConfiguration>()
    .filter((entry) => entry.key.startsWith("configuration/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    Configurations: configs.map((c) => ({
      Arn: c.arn,
      AuthenticationStrategy: c.authenticationStrategy,
      Created: isoTimestamp(c.created),
      Description: c.description,
      EngineType: c.engineType,
      EngineVersion: c.engineVersion,
      Id: c.id,
      LatestRevision: {
        Created: isoTimestamp(c.created),
        Revision: c.latestRevision,
      },
      Name: c.name,
      Tags: c.tags,
    })),
  };
};

const DescribeConfigurationRevision: OperationHandler = (input, ctx) => {
  const configId = requireString(input, "ConfigurationId");
  requireConfiguration(ctx, configId);
  const revisionRaw = input["ConfigurationRevision"];
  const revisionNum =
    typeof revisionRaw === "number"
      ? revisionRaw
      : typeof revisionRaw === "string"
        ? parseInt(revisionRaw, 10)
        : NaN;
  if (isNaN(revisionNum)) {
    throw awsError(
      "BadRequestException",
      "ConfigurationRevision is required.",
      400,
    );
  }
  const rev = ctx.store.get<StoredConfigurationRevision>(
    configRevisionKey(configId, revisionNum),
  );
  if (rev === undefined) {
    throw awsError(
      "NotFoundException",
      `Can't find requested configuration revision [${revisionNum}].`,
      404,
    );
  }
  return {
    ConfigurationId: rev.configurationId,
    Created: isoTimestamp(rev.created),
    Data: rev.data,
    Description: rev.description,
  };
};

const ListConfigurationRevisions: OperationHandler = (input, ctx) => {
  const configId = requireString(input, "ConfigurationId");
  const config = requireConfiguration(ctx, configId);
  const prefix = `config-revision/${configId}/`;
  const revisions = ctx.store
    .list<StoredConfigurationRevision>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.revision - b.revision);
  return {
    ConfigurationId: configId,
    MaxResults: config.latestRevision,
    Revisions: revisions.map((r) => ({
      Created: isoTimestamp(r.created),
      Description: r.description,
      Revision: r.revision,
    })),
  };
};

const CreateTags: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const newTags = stringMap(input["Tags"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  const merged = { ...existing, ...newTags };
  ctx.store.set(tagKey(resourceArn), merged);
  return {};
};

const DeleteTags: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tagKeys = stringList(input["TagKeys"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  for (const k of tagKeys) {
    delete existing[k];
  }
  ctx.store.set(tagKey(resourceArn), existing);
  return {};
};

const ListTags: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  return { Tags: tags };
};

const BROKER_ENGINE_TYPES = [
  {
    EngineType: "ACTIVEMQ",
    EngineVersions: [{ Name: "5.17.6" }, { Name: "5.18.0" }],
  },
  {
    EngineType: "RABBITMQ",
    EngineVersions: [{ Name: "3.11.28" }, { Name: "3.12.13" }],
  },
] as const;

const BROKER_INSTANCE_OPTIONS = [
  {
    AvailabilityZones: [{ Name: "us-east-1a" }, { Name: "us-east-1b" }],
    EngineType: "ACTIVEMQ",
    HostInstanceType: "mq.m5.large",
    StorageType: "EBS",
    SupportedDeploymentModes: ["SINGLE_INSTANCE", "ACTIVE_STANDBY_MULTI_AZ"],
    SupportedEngineVersions: ["5.17.6", "5.18.0"],
  },
  {
    AvailabilityZones: [{ Name: "us-east-1a" }, { Name: "us-east-1b" }],
    EngineType: "ACTIVEMQ",
    HostInstanceType: "mq.m5.xlarge",
    StorageType: "EBS",
    SupportedDeploymentModes: ["SINGLE_INSTANCE", "ACTIVE_STANDBY_MULTI_AZ"],
    SupportedEngineVersions: ["5.17.6", "5.18.0"],
  },
  {
    AvailabilityZones: [{ Name: "us-east-1a" }, { Name: "us-east-1b" }],
    EngineType: "RABBITMQ",
    HostInstanceType: "mq.m5.large",
    StorageType: "EBS",
    SupportedDeploymentModes: ["SINGLE_INSTANCE", "CLUSTER_MULTI_AZ"],
    SupportedEngineVersions: ["3.11.28", "3.12.13"],
  },
] as const;

const DescribeBrokerEngineTypes: OperationHandler = (input) => {
  const engineTypeFilter = stringOrUndefined(input["EngineType"]);
  const filtered = engineTypeFilter
    ? BROKER_ENGINE_TYPES.filter((e) => e.EngineType === engineTypeFilter)
    : BROKER_ENGINE_TYPES;
  return {
    BrokerEngineTypes: filtered,
    MaxResults: filtered.length,
  };
};

const DescribeBrokerInstanceOptions: OperationHandler = (input) => {
  const engineTypeFilter = stringOrUndefined(input["EngineType"]);
  const hostInstanceTypeFilter = stringOrUndefined(input["HostInstanceType"]);
  const storageTypeFilter = stringOrUndefined(input["StorageType"]);
  let filtered: (typeof BROKER_INSTANCE_OPTIONS)[number][] = [
    ...BROKER_INSTANCE_OPTIONS,
  ];
  if (engineTypeFilter) {
    filtered = filtered.filter((o) => o.EngineType === engineTypeFilter);
  }
  if (hostInstanceTypeFilter) {
    filtered = filtered.filter(
      (o) => o.HostInstanceType === hostInstanceTypeFilter,
    );
  }
  if (storageTypeFilter) {
    filtered = filtered.filter((o) => o.StorageType === storageTypeFilter);
  }
  return {
    BrokerInstanceOptions: filtered,
    MaxResults: filtered.length,
  };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const mq = {
  name: "mq",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "v1") return undefined;
    if (parts[1] === "broker-engine-types" && parts.length === 2) {
      if (req.method === "GET") return "DescribeBrokerEngineTypes";
      return undefined;
    }
    if (parts[1] === "broker-instance-options" && parts.length === 2) {
      if (req.method === "GET") return "DescribeBrokerInstanceOptions";
      return undefined;
    }
    if (parts[1] === "brokers") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateBroker";
        if (req.method === "GET") return "ListBrokers";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "DescribeBroker";
        if (req.method === "DELETE") return "DeleteBroker";
        if (req.method === "PUT") return "UpdateBroker";
        return undefined;
      }
      if (parts.length === 4) {
        if (parts[3] === "users" && req.method === "GET") return "ListUsers";
        if (parts[3] === "reboot" && req.method === "POST")
          return "RebootBroker";
        if (parts[3] === "promote" && req.method === "POST") return "Promote";
        return undefined;
      }
      if (parts.length === 5 && parts[3] === "users") {
        if (req.method === "POST") return "CreateUser";
        if (req.method === "GET") return "DescribeUser";
        if (req.method === "PUT") return "UpdateUser";
        if (req.method === "DELETE") return "DeleteUser";
        return undefined;
      }
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
    if (parts[1] === "tags" && parts.length === 3) {
      if (req.method === "POST") return "CreateTags";
      if (req.method === "DELETE") return "DeleteTags";
      if (req.method === "GET") return "ListTags";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateBroker,
    DescribeBroker,
    ListBrokers,
    DeleteBroker,
    UpdateBroker,
    RebootBroker,
    Promote,
    CreateUser,
    DescribeUser,
    UpdateUser,
    DeleteUser,
    ListUsers,
    CreateConfiguration,
    DescribeConfiguration,
    UpdateConfiguration,
    DeleteConfiguration,
    ListConfigurations,
    DescribeConfigurationRevision,
    ListConfigurationRevisions,
    CreateTags,
    DeleteTags,
    ListTags,
    DescribeBrokerEngineTypes,
    DescribeBrokerInstanceOptions,
  },
  model,
} as const satisfies ServiceDefinition;

export default mq;
