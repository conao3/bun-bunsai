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
  created: number;
  latestRevision: number;
};

const brokerKey = (id: string): string => `broker/${id}`;

const configurationKey = (id: string): string => `configuration/${id}`;

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
    created,
    latestRevision: 1,
  };
  ctx.store.set(configurationKey(id), configuration);
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

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const mq = {
  name: "mq",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "v1") return undefined;
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
      return undefined;
    }
    if (parts[1] === "configurations" && parts.length === 2) {
      if (req.method === "POST") return "CreateConfiguration";
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
    CreateConfiguration,
  },
  model,
} as const satisfies ServiceDefinition;

export default mq;
