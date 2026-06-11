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
  configuration?: { id: string; revision: number };
  creatorRequestId?: string;
  describeCount: number;
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
  pending?: {
    ConsoleAccess?: boolean;
    Groups?: string[];
    PendingChange: string;
  };
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

const validatePassword = (password: unknown): void => {
  if (typeof password !== "string" || password === "") {
    throw awsError("BadRequestException", "Password is required.", 400);
  }
  if (password.length < 12) {
    throw awsError(
      "BadRequestException",
      "Invalid Password: must be at least 12 characters.",
      400,
    );
  }
  if (new Set(password.split("")).size < 4) {
    throw awsError(
      "BadRequestException",
      "Invalid Password: must contain at least 4 unique characters.",
      400,
    );
  }
  if (/[,=:]/.test(password)) {
    throw awsError(
      "BadRequestException",
      "Invalid Password: must not contain comma, colon, or equals sign.",
      400,
    );
  }
};

const resolveMaxResults = (value: unknown): number => {
  if (value === undefined || value === null) return 100;
  const n =
    typeof value === "number" ? Math.floor(value) : parseInt(String(value), 10);
  if (isNaN(n) || n < 5 || n > 100) {
    throw awsError(
      "BadRequestException",
      "MaxResults must be between 5 and 100.",
      400,
    );
  }
  return n;
};

const encodeToken = (offset: number): string => btoa(String(offset));

const decodeToken = (token: string | undefined): number => {
  if (!token) return 0;
  try {
    const n = parseInt(atob(token), 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
};

const CreateBroker: OperationHandler = (input, ctx) => {
  const brokerName = requireString(input, "BrokerName");
  const creatorRequestId = stringOrUndefined(input["CreatorRequestId"]);

  const duplicate = ctx.store
    .list<StoredBroker>()
    .find(
      (entry) =>
        entry.key.startsWith("broker/") &&
        entry.value.brokerName === brokerName,
    );
  if (duplicate !== undefined) {
    if (
      creatorRequestId !== undefined &&
      duplicate.value.creatorRequestId === creatorRequestId
    ) {
      return {
        BrokerArn: duplicate.value.brokerArn,
        BrokerId: duplicate.value.brokerId,
      };
    }
    throw awsError(
      "ConflictException",
      `Broker with name ${brokerName} already exists.`,
      409,
    );
  }

  const engineType = requireString(input, "EngineType");
  const deploymentMode = requireString(input, "DeploymentMode");
  const hostInstanceType = requireString(input, "HostInstanceType");
  if (typeof input["PubliclyAccessible"] !== "boolean") {
    throw awsError(
      "BadRequestException",
      "PubliclyAccessible is required.",
      400,
    );
  }

  const brokerId = `b-${hex(8)}`;
  const brokerArn = `arn:aws:mq:${ctx.region}:${ctx.account}:broker:${brokerName}:${brokerId}`;
  const tags = stringMap(input["Tags"]);
  const broker: StoredBroker = {
    brokerId,
    brokerArn,
    brokerName,
    brokerState: "CREATION_IN_PROGRESS",
    engineType,
    engineVersion: stringOrUndefined(input["EngineVersion"]) ?? "5.18.0",
    deploymentMode,
    hostInstanceType,
    authenticationStrategy:
      stringOrUndefined(input["AuthenticationStrategy"]) ?? "SIMPLE",
    autoMinorVersionUpgrade: input["AutoMinorVersionUpgrade"] === true,
    publiclyAccessible: input["PubliclyAccessible"] as boolean,
    storageType: stringOrUndefined(input["StorageType"]) ?? "EFS",
    securityGroups: stringList(input["SecurityGroups"]),
    subnetIds: stringList(input["SubnetIds"]),
    tags,
    created: Math.floor(Date.now() / 1000),
    ...(creatorRequestId !== undefined ? { creatorRequestId } : {}),
    describeCount: 0,
  };
  ctx.store.set(brokerKey(brokerId), broker);
  if (Object.keys(tags).length > 0) {
    ctx.store.set(tagKey(brokerArn), { ...tags });
  }

  const usersInput = Array.isArray(input["Users"]) ? input["Users"] : [];
  for (const u of usersInput) {
    if (typeof u !== "object" || u === null) continue;
    const userInput = u as Record<string, unknown>;
    const username =
      typeof userInput["Username"] === "string" ? userInput["Username"] : "";
    if (!username) continue;
    validatePassword(userInput["Password"]);
    const user: StoredUser = {
      brokerId,
      username,
      consoleAccess: userInput["ConsoleAccess"] === true,
      groups: stringList(userInput["Groups"]),
      replicationUser: userInput["ReplicationUser"] === true,
    };
    ctx.store.set(userKey(brokerId, username), user);
  }

  return { BrokerArn: brokerArn, BrokerId: brokerId };
};

const brokerView = (
  broker: StoredBroker,
  ctx: ServiceContext,
): Record<string, unknown> => {
  const prefix = `user/${broker.brokerId}/`;
  const users = ctx.store
    .list<StoredUser>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  const result: Record<string, unknown> = {
    BrokerArn: broker.brokerArn,
    BrokerId: broker.brokerId,
    BrokerName: broker.brokerName,
    BrokerState: broker.brokerState,
    BrokerInstances: [
      {
        ConsoleURL: `https://${broker.brokerId}.mq.${ctx.region}.amazonaws.com:8162`,
        Endpoints: [
          `ssl://${broker.brokerId}.mq.${ctx.region}.amazonaws.com:61617`,
        ],
        IpAddress: "10.0.0.1",
      },
    ],
    Users: users.map((u) => ({ Username: u.username })),
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
    Tags:
      ctx.store.get<Record<string, string>>(tagKey(broker.brokerArn)) ??
      broker.tags,
    Created: isoTimestamp(broker.created),
  };
  if (broker.configuration !== undefined) {
    result["Configurations"] = {
      Current: {
        Id: broker.configuration.id,
        Revision: broker.configuration.revision,
      },
      History: [],
    };
  }
  return result;
};

const DescribeBroker: OperationHandler = (input, ctx) => {
  const brokerId = requireString(input, "BrokerId");
  const broker = requireBroker(ctx, brokerId);
  let current = broker;
  if (
    current.brokerState === "CREATION_IN_PROGRESS" &&
    current.describeCount >= 1
  ) {
    current = { ...current, brokerState: "RUNNING" };
    ctx.store.set(brokerKey(brokerId), current);
  } else if (current.brokerState === "CREATION_IN_PROGRESS") {
    current = { ...current, describeCount: current.describeCount + 1 };
    ctx.store.set(brokerKey(brokerId), current);
  } else if (
    current.brokerState === "DELETION_IN_PROGRESS" &&
    current.describeCount >= 1
  ) {
    ctx.store.delete(brokerKey(brokerId));
    ctx.store.delete(tagKey(current.brokerArn));
    throw awsError("NotFoundException", `Broker not found: ${brokerId}`, 404);
  } else if (current.brokerState === "DELETION_IN_PROGRESS") {
    current = { ...current, describeCount: current.describeCount + 1 };
    ctx.store.set(brokerKey(brokerId), current);
  }
  return brokerView(current, ctx);
};

const ListBrokers: OperationHandler = (input, ctx) => {
  const maxResults = resolveMaxResults(input["MaxResults"]);
  const start = decodeToken(stringOrUndefined(input["NextToken"]));
  const brokers = ctx.store
    .list<StoredBroker>()
    .filter((entry) => entry.key.startsWith("broker/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.brokerId.localeCompare(b.brokerId));
  const page = brokers.slice(start, start + maxResults);
  const nextTokenValue =
    start + maxResults < brokers.length
      ? encodeToken(start + maxResults)
      : undefined;
  const result: Record<string, unknown> = {
    BrokerSummaries: page.map((broker) => ({
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
  if (nextTokenValue !== undefined) result["NextToken"] = nextTokenValue;
  return result;
};

const DeleteBroker: OperationHandler = (input, ctx) => {
  const brokerId = requireString(input, "BrokerId");
  const broker = requireBroker(ctx, brokerId);
  broker.brokerState = "DELETION_IN_PROGRESS";
  broker.describeCount = 0;
  ctx.store.set(brokerKey(brokerId), broker);
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
  const configInput = input["Configuration"];
  if (typeof configInput === "object" && configInput !== null) {
    const cfg = configInput as Record<string, unknown>;
    const configId = typeof cfg["Id"] === "string" ? cfg["Id"] : undefined;
    if (configId !== undefined) {
      requireConfiguration(ctx, configId);
      const configRevision =
        typeof cfg["Revision"] === "number" ? cfg["Revision"] : 1;
      broker.configuration = { id: configId, revision: configRevision };
    }
  }
  ctx.store.set(brokerKey(brokerId), broker);
  const response: Record<string, unknown> = {
    BrokerId: broker.brokerId,
    AuthenticationStrategy: broker.authenticationStrategy,
    AutoMinorVersionUpgrade: broker.autoMinorVersionUpgrade,
    EngineVersion: broker.engineVersion,
    HostInstanceType: broker.hostInstanceType,
    SecurityGroups: broker.securityGroups,
  };
  if (broker.configuration !== undefined) {
    response["Configuration"] = {
      Id: broker.configuration.id,
      Revision: broker.configuration.revision,
    };
  }
  return response;
};

const RebootBroker: OperationHandler = (input, ctx) => {
  const brokerId = requireString(input, "BrokerId");
  const broker = requireBroker(ctx, brokerId);
  if (broker.brokerState !== "RUNNING") {
    throw awsError(
      "BadRequestException",
      `Broker ${brokerId} is not RUNNING (current state: ${broker.brokerState}).`,
      400,
    );
  }
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
  validatePassword(input["Password"]);
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
  const result: Record<string, unknown> = {
    BrokerId: brokerId,
    Username: user.username,
    ConsoleAccess: user.consoleAccess,
    Groups: user.groups,
    ReplicationUser: user.replicationUser,
  };
  if (user.pending !== undefined) {
    result["Pending"] = user.pending;
  }
  return result;
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
  if (input["Password"] !== undefined) {
    validatePassword(input["Password"]);
  }
  const pending: StoredUser["pending"] = { PendingChange: "UPDATE" };
  if (typeof input["ConsoleAccess"] === "boolean") {
    user.consoleAccess = input["ConsoleAccess"];
    pending.ConsoleAccess = input["ConsoleAccess"];
  }
  if (Array.isArray(input["Groups"])) {
    user.groups = stringList(input["Groups"]);
    pending.Groups = user.groups;
  }
  if (typeof input["ReplicationUser"] === "boolean") {
    user.replicationUser = input["ReplicationUser"];
  }
  user.pending = pending;
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
  const maxResults = resolveMaxResults(input["MaxResults"]);
  const start = decodeToken(stringOrUndefined(input["NextToken"]));
  const prefix = `user/${brokerId}/`;
  const users = ctx.store
    .list<StoredUser>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.username.localeCompare(b.username));
  const page = users.slice(start, start + maxResults);
  const nextTokenValue =
    start + maxResults < users.length
      ? encodeToken(start + maxResults)
      : undefined;
  const result: Record<string, unknown> = {
    BrokerId: brokerId,
    Users: page.map((u) => ({ Username: u.username })),
  };
  if (nextTokenValue !== undefined) result["NextToken"] = nextTokenValue;
  return result;
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

const ListConfigurations: OperationHandler = (input, ctx) => {
  const maxResults = resolveMaxResults(input["MaxResults"]);
  const start = decodeToken(stringOrUndefined(input["NextToken"]));
  const configs = ctx.store
    .list<StoredConfiguration>()
    .filter((entry) => entry.key.startsWith("configuration/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.id.localeCompare(b.id));
  const page = configs.slice(start, start + maxResults);
  const nextTokenValue =
    start + maxResults < configs.length
      ? encodeToken(start + maxResults)
      : undefined;
  const result: Record<string, unknown> = {
    Configurations: page.map((c) => ({
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
  if (nextTokenValue !== undefined) result["NextToken"] = nextTokenValue;
  return result;
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
  requireConfiguration(ctx, configId);
  const maxResults = resolveMaxResults(input["MaxResults"]);
  const start = decodeToken(stringOrUndefined(input["NextToken"]));
  const prefix = `config-revision/${configId}/`;
  const revisions = ctx.store
    .list<StoredConfigurationRevision>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.revision - b.revision);
  const page = revisions.slice(start, start + maxResults);
  const nextTokenValue =
    start + maxResults < revisions.length
      ? encodeToken(start + maxResults)
      : undefined;
  const result: Record<string, unknown> = {
    ConfigurationId: configId,
    Revisions: page.map((r) => ({
      Created: isoTimestamp(r.created),
      Description: r.description,
      Revision: r.revision,
    })),
  };
  if (nextTokenValue !== undefined) result["NextToken"] = nextTokenValue;
  return result;
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
