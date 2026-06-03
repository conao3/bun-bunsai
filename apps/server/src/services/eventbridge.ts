import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import eventBridgeModel from "../../../../test/vendor/aws-models/eventbridge.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(eventBridgeModel);

type StoredRule = {
  Name: string;
  Arn: string;
  ScheduleExpression: string | undefined;
  EventPattern: string | undefined;
  State: string;
  Description: string | undefined;
  RoleArn: string | undefined;
  ManagedBy: string | undefined;
  EventBusName: string;
  targets: Record<string, Record<string, unknown>>;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const busNameOf = (input: Record<string, unknown>): string =>
  stringOrUndefined(input["EventBusName"]) ?? "default";

const ruleKey = (busName: string, name: string): string => `${busName}/${name}`;

const ruleArnOf = (
  ctx: ServiceContext,
  busName: string,
  name: string,
): string =>
  `arn:aws:events:${ctx.region}:${ctx.account}:rule/${busName}/${name}`;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value === "string" && value !== "") return value;
  throw awsError("ValidationException", `${field} is a required field.`, 400);
};

const requireRule = (
  ctx: ServiceContext,
  busName: string,
  name: string,
): StoredRule => {
  const rule = ctx.store.get<StoredRule>(ruleKey(busName, name));
  if (rule === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Rule ${name} does not exist on EventBus ${busName}.`,
      404,
    );
  }
  return rule;
};

const PutRule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const busName = busNameOf(input);
  const key = ruleKey(busName, name);
  const existing = ctx.store.get<StoredRule>(key);
  const arn = existing?.Arn ?? ruleArnOf(ctx, busName, name);
  const rule: StoredRule = {
    Name: name,
    Arn: arn,
    ScheduleExpression: stringOrUndefined(input["ScheduleExpression"]),
    EventPattern: stringOrUndefined(input["EventPattern"]),
    State: stringOrUndefined(input["State"]) ?? "ENABLED",
    Description: stringOrUndefined(input["Description"]),
    RoleArn: stringOrUndefined(input["RoleArn"]),
    ManagedBy: existing?.ManagedBy,
    EventBusName: busName,
    targets: existing?.targets ?? {},
  };
  ctx.store.set(key, rule);
  return { RuleArn: arn };
};

const DeleteRule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const busName = busNameOf(input);
  ctx.store.delete(ruleKey(busName, name));
  return {};
};

const DescribeRule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const busName = busNameOf(input);
  const rule = requireRule(ctx, busName, name);
  return {
    Name: rule.Name,
    Arn: rule.Arn,
    EventPattern: rule.EventPattern,
    ScheduleExpression: rule.ScheduleExpression,
    State: rule.State,
    Description: rule.Description,
    RoleArn: rule.RoleArn,
    ManagedBy: rule.ManagedBy,
    EventBusName: rule.EventBusName,
  };
};

const ListRules: OperationHandler = (input, ctx) => {
  const busName = busNameOf(input);
  const prefix = stringOrUndefined(input["NamePrefix"]);
  const rules = ctx.store
    .list<StoredRule>()
    .map((entry) => entry.value)
    .filter((rule) => rule.EventBusName === busName)
    .filter((rule) => prefix === undefined || rule.Name.startsWith(prefix))
    .map((rule) => ({
      Name: rule.Name,
      Arn: rule.Arn,
      EventPattern: rule.EventPattern,
      State: rule.State,
      Description: rule.Description,
      ScheduleExpression: rule.ScheduleExpression,
      RoleArn: rule.RoleArn,
      ManagedBy: rule.ManagedBy,
      EventBusName: rule.EventBusName,
    }));
  return { Rules: rules };
};

const PutTargets: OperationHandler = (input, ctx) => {
  const ruleName = requireString(input, "Rule");
  const busName = busNameOf(input);
  const rule = requireRule(ctx, busName, ruleName);
  const targets = Array.isArray(input["Targets"])
    ? (input["Targets"] as Record<string, unknown>[])
    : [];
  for (const target of targets) {
    const id = stringOrUndefined(target["Id"]);
    if (id === undefined) continue;
    rule.targets[id] = target;
  }
  ctx.store.set(ruleKey(busName, ruleName), rule);
  return { FailedEntryCount: 0, FailedEntries: [] };
};

const RemoveTargets: OperationHandler = (input, ctx) => {
  const ruleName = requireString(input, "Rule");
  const busName = busNameOf(input);
  const rule = requireRule(ctx, busName, ruleName);
  const ids = Array.isArray(input["Ids"])
    ? (input["Ids"] as unknown[]).map((value) => String(value))
    : [];
  for (const id of ids) delete rule.targets[id];
  ctx.store.set(ruleKey(busName, ruleName), rule);
  return { FailedEntryCount: 0, FailedEntries: [] };
};

const ListTargetsByRule: OperationHandler = (input, ctx) => {
  const ruleName = requireString(input, "Rule");
  const busName = busNameOf(input);
  const rule = requireRule(ctx, busName, ruleName);
  return { Targets: Object.values(rule.targets) };
};

const PutEvents: OperationHandler = (input) => {
  const entries = Array.isArray(input["Entries"])
    ? (input["Entries"] as unknown[])
    : [];
  const results = entries.map(() => ({ EventId: crypto.randomUUID() }));
  return { FailedEntryCount: 0, Entries: results };
};

type StoredEventBus = {
  Name: string;
  Arn: string;
  Description: string | undefined;
  KmsKeyIdentifier: string | undefined;
  Policy: string | undefined;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredArchive = {
  ArchiveName: string;
  ArchiveArn: string;
  EventSourceArn: string;
  Description: string | undefined;
  EventPattern: string | undefined;
  State: string;
  StateReason: string | undefined;
  KmsKeyIdentifier: string | undefined;
  RetentionDays: number;
  SizeBytes: number;
  EventCount: number;
  CreationTime: number;
};

const busPrefix = "eventbus#";
const archivePrefix = "archive#";

const busStoreKey = (name: string): string => `${busPrefix}${name}`;
const archiveStoreKey = (name: string): string => `${archivePrefix}${name}`;

const busArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:events:${ctx.region}:${ctx.account}:event-bus/${name}`;

const archiveArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:events:${ctx.region}:${ctx.account}:archive/${name}`;

const busNameFromArn = (value: string): string => {
  const slash = value.lastIndexOf("/");
  return slash >= 0 ? value.slice(slash + 1) : value;
};

const CreateEventBus: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const key = busStoreKey(name);
  if (ctx.store.get<StoredEventBus>(key) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Event bus ${name} already exists.`,
      409,
    );
  }
  const arn = busArnOf(ctx, name);
  const now = Date.now();
  const bus: StoredEventBus = {
    Name: name,
    Arn: arn,
    Description: stringOrUndefined(input["Description"]),
    KmsKeyIdentifier: stringOrUndefined(input["KmsKeyIdentifier"]),
    Policy: undefined,
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(key, bus);
  return {
    EventBusArn: arn,
    Description: bus.Description,
    KmsKeyIdentifier: bus.KmsKeyIdentifier,
  };
};

const DescribeEventBus: OperationHandler = (input, ctx) => {
  const requested = stringOrUndefined(input["Name"]);
  const name = requested === undefined ? "default" : busNameFromArn(requested);
  const bus = ctx.store.get<StoredEventBus>(busStoreKey(name));
  if (bus === undefined) {
    if (name === "default") {
      return {
        Name: "default",
        Arn: busArnOf(ctx, "default"),
      };
    }
    throw awsError(
      "ResourceNotFoundException",
      `Event bus ${name} does not exist.`,
      404,
    );
  }
  return {
    Name: bus.Name,
    Arn: bus.Arn,
    Description: bus.Description,
    KmsKeyIdentifier: bus.KmsKeyIdentifier,
    Policy: bus.Policy,
    CreationTime: bus.CreationTime,
    LastModifiedTime: bus.LastModifiedTime,
  };
};

const ListEventBuses: OperationHandler = (input, ctx) => {
  const prefix = stringOrUndefined(input["NamePrefix"]);
  const buses = ctx.store
    .list<StoredEventBus>()
    .filter((entry) => entry.key.startsWith(busPrefix))
    .map((entry) => entry.value)
    .filter((bus) => prefix === undefined || bus.Name.startsWith(prefix))
    .map((bus) => ({
      Name: bus.Name,
      Arn: bus.Arn,
      Description: bus.Description,
      Policy: bus.Policy,
      CreationTime: bus.CreationTime,
      LastModifiedTime: bus.LastModifiedTime,
    }));
  return { EventBuses: buses };
};

const DeleteEventBus: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  ctx.store.delete(busStoreKey(name));
  return {};
};

const CreateArchive: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ArchiveName");
  const eventSourceArn = requireString(input, "EventSourceArn");
  const key = archiveStoreKey(name);
  if (ctx.store.get<StoredArchive>(key) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Archive ${name} already exists.`,
      409,
    );
  }
  const arn = archiveArnOf(ctx, name);
  const now = Date.now();
  const retention = input["RetentionDays"];
  const archive: StoredArchive = {
    ArchiveName: name,
    ArchiveArn: arn,
    EventSourceArn: eventSourceArn,
    Description: stringOrUndefined(input["Description"]),
    EventPattern: stringOrUndefined(input["EventPattern"]),
    State: "ENABLED",
    StateReason: undefined,
    KmsKeyIdentifier: stringOrUndefined(input["KmsKeyIdentifier"]),
    RetentionDays: typeof retention === "number" ? retention : 0,
    SizeBytes: 0,
    EventCount: 0,
    CreationTime: now,
  };
  ctx.store.set(key, archive);
  return {
    ArchiveArn: arn,
    State: archive.State,
    StateReason: archive.StateReason,
    CreationTime: archive.CreationTime,
  };
};

const requireArchive = (ctx: ServiceContext, name: string): StoredArchive => {
  const archive = ctx.store.get<StoredArchive>(archiveStoreKey(name));
  if (archive === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Archive ${name} does not exist.`,
      404,
    );
  }
  return archive;
};

const DescribeArchive: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ArchiveName");
  const archive = requireArchive(ctx, name);
  return {
    ArchiveArn: archive.ArchiveArn,
    ArchiveName: archive.ArchiveName,
    EventSourceArn: archive.EventSourceArn,
    Description: archive.Description,
    EventPattern: archive.EventPattern,
    State: archive.State,
    StateReason: archive.StateReason,
    KmsKeyIdentifier: archive.KmsKeyIdentifier,
    RetentionDays: archive.RetentionDays,
    SizeBytes: archive.SizeBytes,
    EventCount: archive.EventCount,
    CreationTime: archive.CreationTime,
  };
};

const ListArchives: OperationHandler = (input, ctx) => {
  const prefix = stringOrUndefined(input["NamePrefix"]);
  const eventSourceArn = stringOrUndefined(input["EventSourceArn"]);
  const state = stringOrUndefined(input["State"]);
  const archives = ctx.store
    .list<StoredArchive>()
    .filter((entry) => entry.key.startsWith(archivePrefix))
    .map((entry) => entry.value)
    .filter(
      (archive) =>
        prefix === undefined || archive.ArchiveName.startsWith(prefix),
    )
    .filter(
      (archive) =>
        eventSourceArn === undefined ||
        archive.EventSourceArn === eventSourceArn,
    )
    .filter((archive) => state === undefined || archive.State === state)
    .map((archive) => ({
      ArchiveName: archive.ArchiveName,
      EventSourceArn: archive.EventSourceArn,
      State: archive.State,
      StateReason: archive.StateReason,
      RetentionDays: archive.RetentionDays,
      SizeBytes: archive.SizeBytes,
      EventCount: archive.EventCount,
      CreationTime: archive.CreationTime,
    }));
  return { Archives: archives };
};

const DeleteArchive: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ArchiveName");
  ctx.store.delete(archiveStoreKey(name));
  return {};
};

// ========== Rules: Enable/Disable/ListRuleNamesByTarget/TestEventPattern ==========

const EnableRule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const busName = busNameOf(input);
  const rule = requireRule(ctx, busName, name);
  ctx.store.set(ruleKey(busName, name), { ...rule, State: "ENABLED" });
  return {};
};

const DisableRule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const busName = busNameOf(input);
  const rule = requireRule(ctx, busName, name);
  ctx.store.set(ruleKey(busName, name), { ...rule, State: "DISABLED" });
  return {};
};

const ListRuleNamesByTarget: OperationHandler = (input, ctx) => {
  const targetArn = requireString(input, "TargetArn");
  const busName = busNameOf(input);
  const ruleNames = ctx.store
    .list<StoredRule>()
    .map((entry) => entry.value)
    .filter((rule) => rule.EventBusName === busName)
    .filter((rule) =>
      Object.values(rule.targets).some(
        (t) => (t as Record<string, unknown>)["Arn"] === targetArn,
      ),
    )
    .map((rule) => rule.Name);
  return { RuleNames: ruleNames };
};

const TestEventPattern: OperationHandler = (input) => {
  const patternStr = requireString(input, "EventPattern");
  const eventStr = requireString(input, "Event");
  let pattern: Record<string, unknown>;
  let event: Record<string, unknown>;
  try {
    pattern = JSON.parse(patternStr) as Record<string, unknown>;
    event = JSON.parse(eventStr) as Record<string, unknown>;
  } catch {
    throw awsError("InvalidEventPatternException", "Invalid JSON.", 400);
  }
  const result = Object.entries(pattern).every(([key, val]) => {
    const eventVal = event[key];
    if (Array.isArray(val)) {
      return (val as unknown[]).some((v) => {
        if (typeof v === "object" && v !== null) return true;
        return v === eventVal;
      });
    }
    return true;
  });
  return { Result: result };
};

// ========== Connections ==========

type StoredConnection = {
  Name: string;
  ConnectionArn: string;
  Description: string | undefined;
  ConnectionState: string;
  StateReason: string | undefined;
  AuthorizationType: string;
  SecretArn: string | undefined;
  KmsKeyIdentifier: string | undefined;
  AuthParameters: unknown;
  InvocationConnectivityParameters: unknown;
  CreationTime: number;
  LastModifiedTime: number;
  LastAuthorizedTime: number | undefined;
};

const connectionPrefix = "connection#";
const connectionStoreKey = (name: string): string =>
  `${connectionPrefix}${name}`;

const connectionArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:events:${ctx.region}:${ctx.account}:connection/${name}`;

const requireConnection = (
  ctx: ServiceContext,
  name: string,
): StoredConnection => {
  const conn = ctx.store.get<StoredConnection>(connectionStoreKey(name));
  if (conn === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Connection ${name} does not exist.`,
      400,
    );
  }
  return conn;
};

const CreateConnection: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const key = connectionStoreKey(name);
  if (ctx.store.get<StoredConnection>(key) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Connection ${name} already exists.`,
      409,
    );
  }
  const arn = connectionArnOf(ctx, name);
  const now = Date.now();
  const conn: StoredConnection = {
    Name: name,
    ConnectionArn: arn,
    Description: stringOrUndefined(input["Description"]),
    ConnectionState: "AUTHORIZED",
    StateReason: undefined,
    AuthorizationType: stringOrUndefined(input["AuthorizationType"]) ?? "BASIC",
    SecretArn: undefined,
    KmsKeyIdentifier: stringOrUndefined(input["KmsKeyIdentifier"]),
    AuthParameters: input["AuthParameters"],
    InvocationConnectivityParameters: input["InvocationConnectivityParameters"],
    CreationTime: now,
    LastModifiedTime: now,
    LastAuthorizedTime: now,
  };
  ctx.store.set(key, conn);
  return {
    ConnectionArn: arn,
    ConnectionState: conn.ConnectionState,
    CreationTime: conn.CreationTime,
    LastModifiedTime: conn.LastModifiedTime,
  };
};

const DescribeConnection: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const conn = requireConnection(ctx, name);
  return {
    ConnectionArn: conn.ConnectionArn,
    Name: conn.Name,
    Description: conn.Description,
    InvocationConnectivityParameters: conn.InvocationConnectivityParameters,
    ConnectionState: conn.ConnectionState,
    StateReason: conn.StateReason,
    AuthorizationType: conn.AuthorizationType,
    SecretArn: conn.SecretArn,
    KmsKeyIdentifier: conn.KmsKeyIdentifier,
    AuthParameters: conn.AuthParameters,
    CreationTime: conn.CreationTime,
    LastModifiedTime: conn.LastModifiedTime,
    LastAuthorizedTime: conn.LastAuthorizedTime,
  };
};

const UpdateConnection: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const conn = requireConnection(ctx, name);
  const now = Date.now();
  const updated: StoredConnection = {
    Name: conn.Name,
    ConnectionArn: conn.ConnectionArn,
    Description:
      input["Description"] !== undefined
        ? stringOrUndefined(input["Description"])
        : conn.Description,
    ConnectionState: conn.ConnectionState,
    StateReason: conn.StateReason,
    AuthorizationType:
      stringOrUndefined(input["AuthorizationType"]) ?? conn.AuthorizationType,
    SecretArn: conn.SecretArn,
    KmsKeyIdentifier:
      input["KmsKeyIdentifier"] !== undefined
        ? stringOrUndefined(input["KmsKeyIdentifier"])
        : conn.KmsKeyIdentifier,
    AuthParameters:
      input["AuthParameters"] !== undefined
        ? input["AuthParameters"]
        : conn.AuthParameters,
    InvocationConnectivityParameters:
      input["InvocationConnectivityParameters"] !== undefined
        ? input["InvocationConnectivityParameters"]
        : conn.InvocationConnectivityParameters,
    CreationTime: conn.CreationTime,
    LastModifiedTime: now,
    LastAuthorizedTime: now,
  };
  ctx.store.set(connectionStoreKey(name), updated);
  return {
    ConnectionArn: updated.ConnectionArn,
    ConnectionState: updated.ConnectionState,
    CreationTime: updated.CreationTime,
    LastModifiedTime: updated.LastModifiedTime,
    LastAuthorizedTime: updated.LastAuthorizedTime,
  };
};

const DeleteConnection: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const conn = requireConnection(ctx, name);
  ctx.store.delete(connectionStoreKey(name));
  return {
    ConnectionArn: conn.ConnectionArn,
    ConnectionState: conn.ConnectionState,
    CreationTime: conn.CreationTime,
    LastModifiedTime: conn.LastModifiedTime,
    LastAuthorizedTime: conn.LastAuthorizedTime,
  };
};

const DeauthorizeConnection: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const conn = requireConnection(ctx, name);
  const now = Date.now();
  const updated: StoredConnection = {
    Name: conn.Name,
    ConnectionArn: conn.ConnectionArn,
    Description: conn.Description,
    ConnectionState: "DEAUTHORIZED",
    StateReason: conn.StateReason,
    AuthorizationType: conn.AuthorizationType,
    SecretArn: conn.SecretArn,
    KmsKeyIdentifier: conn.KmsKeyIdentifier,
    AuthParameters: conn.AuthParameters,
    InvocationConnectivityParameters: conn.InvocationConnectivityParameters,
    CreationTime: conn.CreationTime,
    LastModifiedTime: now,
    LastAuthorizedTime: conn.LastAuthorizedTime,
  };
  ctx.store.set(connectionStoreKey(name), updated);
  return {
    ConnectionArn: updated.ConnectionArn,
    ConnectionState: updated.ConnectionState,
    CreationTime: updated.CreationTime,
    LastModifiedTime: updated.LastModifiedTime,
    LastAuthorizedTime: updated.LastAuthorizedTime,
  };
};

const ListConnections: OperationHandler = (input, ctx) => {
  const prefix = stringOrUndefined(input["NamePrefix"]);
  const state = stringOrUndefined(input["ConnectionState"]);
  const connections = ctx.store
    .list<StoredConnection>()
    .filter((entry) => entry.key.startsWith(connectionPrefix))
    .map((entry) => entry.value)
    .filter((conn) => prefix === undefined || conn.Name.startsWith(prefix))
    .filter((conn) => state === undefined || conn.ConnectionState === state)
    .map((conn) => ({
      ConnectionArn: conn.ConnectionArn,
      Name: conn.Name,
      ConnectionState: conn.ConnectionState,
      StateReason: conn.StateReason,
      AuthorizationType: conn.AuthorizationType,
      CreationTime: conn.CreationTime,
      LastModifiedTime: conn.LastModifiedTime,
      LastAuthorizedTime: conn.LastAuthorizedTime,
    }));
  return { Connections: connections };
};

// ========== API Destinations ==========

type StoredApiDestination = {
  Name: string;
  ApiDestinationArn: string;
  Description: string | undefined;
  ApiDestinationState: string;
  ConnectionArn: string;
  InvocationEndpoint: string;
  HttpMethod: string;
  InvocationRateLimitPerSecond: number | undefined;
  CreationTime: number;
  LastModifiedTime: number;
};

const apiDestPrefix = "apidest#";
const apiDestStoreKey = (name: string): string => `${apiDestPrefix}${name}`;

const apiDestArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:events:${ctx.region}:${ctx.account}:api-destination/${name}`;

const requireApiDestination = (
  ctx: ServiceContext,
  name: string,
): StoredApiDestination => {
  const dest = ctx.store.get<StoredApiDestination>(apiDestStoreKey(name));
  if (dest === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ApiDestination ${name} does not exist.`,
      400,
    );
  }
  return dest;
};

const CreateApiDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const key = apiDestStoreKey(name);
  if (ctx.store.get<StoredApiDestination>(key) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `ApiDestination ${name} already exists.`,
      409,
    );
  }
  const arn = apiDestArnOf(ctx, name);
  const now = Date.now();
  const rateLimit = input["InvocationRateLimitPerSecond"];
  const dest: StoredApiDestination = {
    Name: name,
    ApiDestinationArn: arn,
    Description: stringOrUndefined(input["Description"]),
    ApiDestinationState: "ACTIVE",
    ConnectionArn: requireString(input, "ConnectionArn"),
    InvocationEndpoint: requireString(input, "InvocationEndpoint"),
    HttpMethod: requireString(input, "HttpMethod"),
    InvocationRateLimitPerSecond:
      typeof rateLimit === "number" ? rateLimit : undefined,
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(key, dest);
  return {
    ApiDestinationArn: arn,
    ApiDestinationState: dest.ApiDestinationState,
    CreationTime: dest.CreationTime,
    LastModifiedTime: dest.LastModifiedTime,
  };
};

const DescribeApiDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const dest = requireApiDestination(ctx, name);
  return {
    ApiDestinationArn: dest.ApiDestinationArn,
    Name: dest.Name,
    Description: dest.Description,
    ApiDestinationState: dest.ApiDestinationState,
    ConnectionArn: dest.ConnectionArn,
    InvocationEndpoint: dest.InvocationEndpoint,
    HttpMethod: dest.HttpMethod,
    InvocationRateLimitPerSecond: dest.InvocationRateLimitPerSecond,
    CreationTime: dest.CreationTime,
    LastModifiedTime: dest.LastModifiedTime,
  };
};

const UpdateApiDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const dest = requireApiDestination(ctx, name);
  const now = Date.now();
  const rateLimit = input["InvocationRateLimitPerSecond"];
  const updated: StoredApiDestination = {
    Name: dest.Name,
    ApiDestinationArn: dest.ApiDestinationArn,
    Description:
      input["Description"] !== undefined
        ? stringOrUndefined(input["Description"])
        : dest.Description,
    ApiDestinationState: dest.ApiDestinationState,
    ConnectionArn:
      stringOrUndefined(input["ConnectionArn"]) ?? dest.ConnectionArn,
    InvocationEndpoint:
      stringOrUndefined(input["InvocationEndpoint"]) ?? dest.InvocationEndpoint,
    HttpMethod: stringOrUndefined(input["HttpMethod"]) ?? dest.HttpMethod,
    InvocationRateLimitPerSecond:
      typeof rateLimit === "number"
        ? rateLimit
        : dest.InvocationRateLimitPerSecond,
    CreationTime: dest.CreationTime,
    LastModifiedTime: now,
  };
  ctx.store.set(apiDestStoreKey(name), updated);
  return {
    ApiDestinationArn: updated.ApiDestinationArn,
    ApiDestinationState: updated.ApiDestinationState,
    CreationTime: updated.CreationTime,
    LastModifiedTime: updated.LastModifiedTime,
  };
};

const DeleteApiDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  requireApiDestination(ctx, name);
  ctx.store.delete(apiDestStoreKey(name));
  return {};
};

const ListApiDestinations: OperationHandler = (input, ctx) => {
  const prefix = stringOrUndefined(input["NamePrefix"]);
  const connArn = stringOrUndefined(input["ConnectionArn"]);
  const dests = ctx.store
    .list<StoredApiDestination>()
    .filter((entry) => entry.key.startsWith(apiDestPrefix))
    .map((entry) => entry.value)
    .filter((dest) => prefix === undefined || dest.Name.startsWith(prefix))
    .filter((dest) => connArn === undefined || dest.ConnectionArn === connArn)
    .map((dest) => ({
      ApiDestinationArn: dest.ApiDestinationArn,
      Name: dest.Name,
      ApiDestinationState: dest.ApiDestinationState,
      ConnectionArn: dest.ConnectionArn,
      InvocationEndpoint: dest.InvocationEndpoint,
      HttpMethod: dest.HttpMethod,
      InvocationRateLimitPerSecond: dest.InvocationRateLimitPerSecond,
      CreationTime: dest.CreationTime,
      LastModifiedTime: dest.LastModifiedTime,
    }));
  return { ApiDestinations: dests };
};

// ========== Endpoints ==========

type StoredEndpoint = {
  Name: string;
  EndpointArn: string;
  Description: string | undefined;
  RoutingConfig: unknown;
  ReplicationConfig: unknown;
  EventBuses: unknown;
  RoleArn: string | undefined;
  EndpointId: string;
  EndpointUrl: string;
  State: string;
  StateReason: string | undefined;
  CreationTime: number;
  LastModifiedTime: number;
};

const endpointPrefix = "endpoint#";
const endpointStoreKey = (name: string): string => `${endpointPrefix}${name}`;

const endpointArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:events:${ctx.region}:${ctx.account}:endpoint/${name}`;

const requireEndpoint = (ctx: ServiceContext, name: string): StoredEndpoint => {
  const ep = ctx.store.get<StoredEndpoint>(endpointStoreKey(name));
  if (ep === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Endpoint ${name} does not exist.`,
      400,
    );
  }
  return ep;
};

const CreateEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const key = endpointStoreKey(name);
  if (ctx.store.get<StoredEndpoint>(key) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Endpoint ${name} already exists.`,
      409,
    );
  }
  const arn = endpointArnOf(ctx, name);
  const endpointId = `${name}.${crypto.randomUUID().slice(0, 8)}`;
  const endpointUrl = `https://${endpointId}.endpoint.events.amazonaws.com`;
  const now = Date.now();
  const ep: StoredEndpoint = {
    Name: name,
    EndpointArn: arn,
    Description: stringOrUndefined(input["Description"]),
    RoutingConfig: input["RoutingConfig"],
    ReplicationConfig: input["ReplicationConfig"],
    EventBuses: input["EventBuses"],
    RoleArn: stringOrUndefined(input["RoleArn"]),
    EndpointId: endpointId,
    EndpointUrl: endpointUrl,
    State: "ACTIVE",
    StateReason: undefined,
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(key, ep);
  return {
    Name: ep.Name,
    Arn: arn,
    RoutingConfig: ep.RoutingConfig,
    ReplicationConfig: ep.ReplicationConfig,
    EventBuses: ep.EventBuses,
    RoleArn: ep.RoleArn,
    State: ep.State,
  };
};

const DescribeEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const ep = requireEndpoint(ctx, name);
  return {
    Name: ep.Name,
    Description: ep.Description,
    Arn: ep.EndpointArn,
    RoutingConfig: ep.RoutingConfig,
    ReplicationConfig: ep.ReplicationConfig,
    EventBuses: ep.EventBuses,
    RoleArn: ep.RoleArn,
    EndpointId: ep.EndpointId,
    EndpointUrl: ep.EndpointUrl,
    State: ep.State,
    StateReason: ep.StateReason,
    CreationTime: ep.CreationTime,
    LastModifiedTime: ep.LastModifiedTime,
  };
};

const UpdateEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const ep = requireEndpoint(ctx, name);
  const now = Date.now();
  const updated: StoredEndpoint = {
    Name: ep.Name,
    EndpointArn: ep.EndpointArn,
    Description:
      input["Description"] !== undefined
        ? stringOrUndefined(input["Description"])
        : ep.Description,
    RoutingConfig:
      input["RoutingConfig"] !== undefined
        ? input["RoutingConfig"]
        : ep.RoutingConfig,
    ReplicationConfig:
      input["ReplicationConfig"] !== undefined
        ? input["ReplicationConfig"]
        : ep.ReplicationConfig,
    EventBuses:
      input["EventBuses"] !== undefined ? input["EventBuses"] : ep.EventBuses,
    RoleArn:
      input["RoleArn"] !== undefined
        ? stringOrUndefined(input["RoleArn"])
        : ep.RoleArn,
    EndpointId: ep.EndpointId,
    EndpointUrl: ep.EndpointUrl,
    State: ep.State,
    StateReason: ep.StateReason,
    CreationTime: ep.CreationTime,
    LastModifiedTime: now,
  };
  ctx.store.set(endpointStoreKey(name), updated);
  return {
    Name: updated.Name,
    Arn: updated.EndpointArn,
    RoutingConfig: updated.RoutingConfig,
    ReplicationConfig: updated.ReplicationConfig,
    EventBuses: updated.EventBuses,
    RoleArn: updated.RoleArn,
    EndpointId: updated.EndpointId,
    EndpointUrl: updated.EndpointUrl,
    State: updated.State,
  };
};

const DeleteEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  requireEndpoint(ctx, name);
  ctx.store.delete(endpointStoreKey(name));
  return {};
};

const ListEndpoints: OperationHandler = (input, ctx) => {
  const prefix = stringOrUndefined(input["NamePrefix"]);
  const endpoints = ctx.store
    .list<StoredEndpoint>()
    .filter((entry) => entry.key.startsWith(endpointPrefix))
    .map((entry) => entry.value)
    .filter((ep) => prefix === undefined || ep.Name.startsWith(prefix))
    .map((ep) => ({
      Name: ep.Name,
      Description: ep.Description,
      Arn: ep.EndpointArn,
      RoutingConfig: ep.RoutingConfig,
      ReplicationConfig: ep.ReplicationConfig,
      EventBuses: ep.EventBuses,
      RoleArn: ep.RoleArn,
      EndpointId: ep.EndpointId,
      EndpointUrl: ep.EndpointUrl,
      State: ep.State,
      StateReason: ep.StateReason,
      CreationTime: ep.CreationTime,
      LastModifiedTime: ep.LastModifiedTime,
    }));
  return { Endpoints: endpoints };
};

// ========== Event buses: UpdateEventBus / PutPermission / RemovePermission ==========

const UpdateEventBus: OperationHandler = (input, ctx) => {
  const requested = stringOrUndefined(input["Name"]);
  const name = requested === undefined ? "default" : busNameFromArn(requested);
  const busKey = busStoreKey(name);
  let bus = ctx.store.get<StoredEventBus>(busKey);
  if (bus === undefined) {
    if (name !== "default") {
      throw awsError(
        "ResourceNotFoundException",
        `Event bus ${name} does not exist.`,
        404,
      );
    }
    const now = Date.now();
    bus = {
      Name: "default",
      Arn: busArnOf(ctx, "default"),
      Description: undefined,
      KmsKeyIdentifier: undefined,
      Policy: undefined,
      CreationTime: now,
      LastModifiedTime: now,
    };
  }
  const now = Date.now();
  const updated: StoredEventBus = {
    Name: bus.Name,
    Arn: bus.Arn,
    Description:
      input["Description"] !== undefined
        ? stringOrUndefined(input["Description"])
        : bus.Description,
    KmsKeyIdentifier:
      input["KmsKeyIdentifier"] !== undefined
        ? stringOrUndefined(input["KmsKeyIdentifier"])
        : bus.KmsKeyIdentifier,
    Policy: bus.Policy,
    CreationTime: bus.CreationTime,
    LastModifiedTime: now,
  };
  ctx.store.set(busKey, updated);
  return {
    Arn: updated.Arn,
    Name: updated.Name,
    KmsKeyIdentifier: updated.KmsKeyIdentifier,
    Description: updated.Description,
  };
};

const PutPermission: OperationHandler = (input, ctx) => {
  const busName = busNameOf(input);
  const busKey = busStoreKey(busName);
  let bus = ctx.store.get<StoredEventBus>(busKey);
  if (bus === undefined) {
    if (busName !== "default") {
      throw awsError(
        "ResourceNotFoundException",
        `Event bus ${busName} does not exist.`,
        404,
      );
    }
    const now = Date.now();
    bus = {
      Name: "default",
      Arn: busArnOf(ctx, "default"),
      Description: undefined,
      KmsKeyIdentifier: undefined,
      Policy: undefined,
      CreationTime: now,
      LastModifiedTime: now,
    };
  }
  const policyStr = stringOrUndefined(input["Policy"]);
  if (policyStr !== undefined) {
    ctx.store.set(busKey, { ...bus, Policy: policyStr });
    return {};
  }
  const statementId = requireString(input, "StatementId");
  let policy: { Statement: Record<string, unknown>[] } = { Statement: [] };
  if (bus.Policy !== undefined) {
    try {
      policy = JSON.parse(bus.Policy) as {
        Statement: Record<string, unknown>[];
      };
    } catch {
      policy = { Statement: [] };
    }
  }
  policy.Statement = (policy.Statement ?? []).filter(
    (s) => s["Sid"] !== statementId,
  );
  const stmt: Record<string, unknown> = {
    Sid: statementId,
    Effect: "Allow",
    Action: stringOrUndefined(input["Action"]) ?? "events:PutEvents",
    Principal:
      input["Principal"] !== undefined ? { AWS: input["Principal"] } : "*",
    Resource: bus.Arn,
  };
  if (input["Condition"] !== undefined) stmt["Condition"] = input["Condition"];
  policy.Statement.push(stmt);
  ctx.store.set(busKey, { ...bus, Policy: JSON.stringify(policy) });
  return {};
};

const RemovePermission: OperationHandler = (input, ctx) => {
  const busName = busNameOf(input);
  const busKey = busStoreKey(busName);
  const bus = ctx.store.get<StoredEventBus>(busKey);
  if (bus === undefined) return {};
  if (input["RemoveAllPermissions"] === true) {
    ctx.store.set(busKey, { ...bus, Policy: undefined });
    return {};
  }
  const statementId = requireString(input, "StatementId");
  if (bus.Policy === undefined) return {};
  let policy: { Statement: Record<string, unknown>[] } = { Statement: [] };
  try {
    policy = JSON.parse(bus.Policy) as {
      Statement: Record<string, unknown>[];
    };
  } catch {
    return {};
  }
  policy.Statement = (policy.Statement ?? []).filter(
    (s) => s["Sid"] !== statementId,
  );
  const newPolicy =
    policy.Statement.length > 0 ? JSON.stringify(policy) : undefined;
  ctx.store.set(busKey, { ...bus, Policy: newPolicy });
  return {};
};

// ========== Partner Events ==========

const PutPartnerEvents: OperationHandler = (input) => {
  const entries = Array.isArray(input["Entries"])
    ? (input["Entries"] as unknown[])
    : [];
  const results = entries.map(() => ({ EventId: crypto.randomUUID() }));
  return { FailedEntryCount: 0, Entries: results };
};

type StoredPartnerEventSource = {
  Name: string;
  Arn: string;
  Accounts: string[];
};

type StoredEventSource = {
  Name: string;
  Arn: string;
  CreatedBy: string;
  CreationTime: number;
  ExpirationTime: number;
  State: string;
};

const partnerSrcPrefix = "partnersrc#";
const eventSrcPrefix = "eventsrc#";

const partnerSrcStoreKey = (name: string): string =>
  `${partnerSrcPrefix}${name}`;
const eventSrcStoreKey = (name: string): string => `${eventSrcPrefix}${name}`;

const partnerSrcArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:events:${ctx.region}::event-source/aws.partner/${name}`;

const CreatePartnerEventSource: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const account = requireString(input, "Account");
  const arn = partnerSrcArnOf(ctx, name);
  const key = partnerSrcStoreKey(name);
  const existing = ctx.store.get<StoredPartnerEventSource>(key);
  const accounts = existing?.Accounts ?? [];
  if (!accounts.includes(account)) accounts.push(account);
  ctx.store.set(key, { Name: name, Arn: arn, Accounts: accounts });
  const now = Date.now();
  const srcKey = eventSrcStoreKey(name);
  if (ctx.store.get<StoredEventSource>(srcKey) === undefined) {
    ctx.store.set<StoredEventSource>(srcKey, {
      Name: name,
      Arn: arn,
      CreatedBy: account,
      CreationTime: now,
      ExpirationTime: now + 86400 * 7 * 1000,
      State: "PENDING",
    });
  }
  return { EventSourceArn: arn };
};

const DeletePartnerEventSource: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const account = requireString(input, "Account");
  const key = partnerSrcStoreKey(name);
  const src = ctx.store.get<StoredPartnerEventSource>(key);
  if (src !== undefined) {
    const accounts = src.Accounts.filter((a) => a !== account);
    if (accounts.length === 0) {
      ctx.store.delete(key);
    } else {
      ctx.store.set(key, { ...src, Accounts: accounts });
    }
  }
  return {};
};

const DescribePartnerEventSource: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const src = ctx.store.get<StoredPartnerEventSource>(partnerSrcStoreKey(name));
  if (src === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Partner event source ${name} does not exist.`,
      400,
    );
  }
  return { Arn: src.Arn, Name: src.Name };
};

const ListPartnerEventSources: OperationHandler = (input, ctx) => {
  const prefix = stringOrUndefined(input["NamePrefix"]);
  const sources = ctx.store
    .list<StoredPartnerEventSource>()
    .filter((entry) => entry.key.startsWith(partnerSrcPrefix))
    .map((entry) => entry.value)
    .filter((src) => prefix === undefined || src.Name.startsWith(prefix))
    .map((src) => ({ Arn: src.Arn, Name: src.Name }));
  return { PartnerEventSources: sources };
};

const ListPartnerEventSourceAccounts: OperationHandler = (input, ctx) => {
  const eventSourceName = requireString(input, "EventSourceName");
  const src = ctx.store.get<StoredPartnerEventSource>(
    partnerSrcStoreKey(eventSourceName),
  );
  const accounts = (src?.Accounts ?? []).map((account) => ({
    Account: account,
    CreationTime: Date.now(),
    ExpirationTime: Date.now() + 86400 * 7 * 1000,
    State: "ACTIVE",
  }));
  return { PartnerEventSourceAccounts: accounts };
};

const ActivateEventSource: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const key = eventSrcStoreKey(name);
  const src = ctx.store.get<StoredEventSource>(key);
  if (src === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Event source ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(key, { ...src, State: "ACTIVE" });
  return {};
};

const DeactivateEventSource: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const key = eventSrcStoreKey(name);
  const src = ctx.store.get<StoredEventSource>(key);
  if (src === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Event source ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(key, { ...src, State: "PENDING" });
  return {};
};

const DescribeEventSource: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const src = ctx.store.get<StoredEventSource>(eventSrcStoreKey(name));
  if (src === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Event source ${name} does not exist.`,
      400,
    );
  }
  return {
    Arn: src.Arn,
    CreatedBy: src.CreatedBy,
    CreationTime: src.CreationTime,
    ExpirationTime: src.ExpirationTime,
    Name: src.Name,
    State: src.State,
  };
};

const ListEventSources: OperationHandler = (input, ctx) => {
  const prefix = stringOrUndefined(input["NamePrefix"]);
  const sources = ctx.store
    .list<StoredEventSource>()
    .filter((entry) => entry.key.startsWith(eventSrcPrefix))
    .map((entry) => entry.value)
    .filter((src) => prefix === undefined || src.Name.startsWith(prefix))
    .map((src) => ({
      Arn: src.Arn,
      CreatedBy: src.CreatedBy,
      CreationTime: src.CreationTime,
      ExpirationTime: src.ExpirationTime,
      Name: src.Name,
      State: src.State,
    }));
  return { EventSources: sources };
};

// ========== Archives: UpdateArchive ==========

const UpdateArchive: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ArchiveName");
  const archive = requireArchive(ctx, name);
  const retention = input["RetentionDays"];
  const updated: StoredArchive = {
    ArchiveName: archive.ArchiveName,
    ArchiveArn: archive.ArchiveArn,
    EventSourceArn: archive.EventSourceArn,
    Description:
      input["Description"] !== undefined
        ? stringOrUndefined(input["Description"])
        : archive.Description,
    EventPattern:
      input["EventPattern"] !== undefined
        ? stringOrUndefined(input["EventPattern"])
        : archive.EventPattern,
    State: archive.State,
    StateReason: archive.StateReason,
    KmsKeyIdentifier:
      input["KmsKeyIdentifier"] !== undefined
        ? stringOrUndefined(input["KmsKeyIdentifier"])
        : archive.KmsKeyIdentifier,
    RetentionDays:
      typeof retention === "number" ? retention : archive.RetentionDays,
    SizeBytes: archive.SizeBytes,
    EventCount: archive.EventCount,
    CreationTime: archive.CreationTime,
  };
  ctx.store.set(archiveStoreKey(name), updated);
  return {
    ArchiveArn: updated.ArchiveArn,
    State: updated.State,
    StateReason: updated.StateReason,
    CreationTime: updated.CreationTime,
  };
};

// ========== Replays ==========

type StoredReplay = {
  ReplayName: string;
  ReplayArn: string;
  Description: string | undefined;
  State: string;
  StateReason: string | undefined;
  EventSourceArn: string;
  Destination: unknown;
  EventStartTime: number;
  EventEndTime: number;
  EventLastReplayedTime: number | undefined;
  ReplayStartTime: number;
  ReplayEndTime: number | undefined;
};

const replayPrefix = "replay#";
const replayStoreKey = (name: string): string => `${replayPrefix}${name}`;

const replayArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:events:${ctx.region}:${ctx.account}:replay/${name}`;

const requireReplay = (ctx: ServiceContext, name: string): StoredReplay => {
  const replay = ctx.store.get<StoredReplay>(replayStoreKey(name));
  if (replay === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Replay ${name} does not exist.`,
      400,
    );
  }
  return replay;
};

const StartReplay: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ReplayName");
  const key = replayStoreKey(name);
  if (ctx.store.get<StoredReplay>(key) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Replay ${name} already exists.`,
      409,
    );
  }
  const arn = replayArnOf(ctx, name);
  const now = Date.now();
  const eventStartTime = input["EventStartTime"];
  const eventEndTime = input["EventEndTime"];
  const replay: StoredReplay = {
    ReplayName: name,
    ReplayArn: arn,
    Description: stringOrUndefined(input["Description"]),
    State: "STARTING",
    StateReason: undefined,
    EventSourceArn: requireString(input, "EventSourceArn"),
    Destination: input["Destination"],
    EventStartTime: typeof eventStartTime === "number" ? eventStartTime : now,
    EventEndTime: typeof eventEndTime === "number" ? eventEndTime : now,
    EventLastReplayedTime: undefined,
    ReplayStartTime: now,
    ReplayEndTime: undefined,
  };
  ctx.store.set(key, replay);
  return {
    ReplayArn: arn,
    State: replay.State,
    StateReason: replay.StateReason,
    ReplayStartTime: replay.ReplayStartTime,
  };
};

const DescribeReplay: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ReplayName");
  const replay = requireReplay(ctx, name);
  return {
    ReplayName: replay.ReplayName,
    ReplayArn: replay.ReplayArn,
    Description: replay.Description,
    State: replay.State,
    StateReason: replay.StateReason,
    EventSourceArn: replay.EventSourceArn,
    Destination: replay.Destination,
    EventStartTime: replay.EventStartTime,
    EventEndTime: replay.EventEndTime,
    EventLastReplayedTime: replay.EventLastReplayedTime,
    ReplayStartTime: replay.ReplayStartTime,
    ReplayEndTime: replay.ReplayEndTime,
  };
};

const CancelReplay: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ReplayName");
  const replay = requireReplay(ctx, name);
  const updated: StoredReplay = {
    ReplayName: replay.ReplayName,
    ReplayArn: replay.ReplayArn,
    Description: replay.Description,
    State: "CANCELLED",
    StateReason: "User request to cancel the replay.",
    EventSourceArn: replay.EventSourceArn,
    Destination: replay.Destination,
    EventStartTime: replay.EventStartTime,
    EventEndTime: replay.EventEndTime,
    EventLastReplayedTime: replay.EventLastReplayedTime,
    ReplayStartTime: replay.ReplayStartTime,
    ReplayEndTime: Date.now(),
  };
  ctx.store.set(replayStoreKey(name), updated);
  return {
    ReplayArn: updated.ReplayArn,
    State: updated.State,
    StateReason: updated.StateReason,
  };
};

const ListReplays: OperationHandler = (input, ctx) => {
  const prefix = stringOrUndefined(input["NamePrefix"]);
  const state = stringOrUndefined(input["State"]);
  const eventSourceArn = stringOrUndefined(input["EventSourceArn"]);
  const replays = ctx.store
    .list<StoredReplay>()
    .filter((entry) => entry.key.startsWith(replayPrefix))
    .map((entry) => entry.value)
    .filter(
      (replay) => prefix === undefined || replay.ReplayName.startsWith(prefix),
    )
    .filter((replay) => state === undefined || replay.State === state)
    .filter(
      (replay) =>
        eventSourceArn === undefined ||
        replay.EventSourceArn === eventSourceArn,
    )
    .map((replay) => ({
      ReplayName: replay.ReplayName,
      EventSourceArn: replay.EventSourceArn,
      State: replay.State,
      StateReason: replay.StateReason,
      EventStartTime: replay.EventStartTime,
      EventEndTime: replay.EventEndTime,
      EventLastReplayedTime: replay.EventLastReplayedTime,
      ReplayStartTime: replay.ReplayStartTime,
      ReplayEndTime: replay.ReplayEndTime,
    }));
  return { Replays: replays };
};

// ========== Tags ==========

const tagsPrefix = "tags#";
const tagsStoreKey = (arn: string): string => `${tagsPrefix}${arn}`;

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const tags = Array.isArray(input["Tags"])
    ? (input["Tags"] as Record<string, unknown>[])
    : [];
  const key = tagsStoreKey(arn);
  const existing = ctx.store.get<Record<string, string>>(key) ?? {};
  for (const tag of tags) {
    const k = stringOrUndefined(tag["Key"]);
    const v = stringOrUndefined(tag["Value"]);
    if (k !== undefined && v !== undefined) existing[k] = v;
  }
  ctx.store.set(key, existing);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as unknown[]).map((k) => String(k))
    : [];
  const key = tagsStoreKey(arn);
  const existing = ctx.store.get<Record<string, string>>(key) ?? {};
  for (const k of tagKeys) delete existing[k];
  ctx.store.set(key, existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const stored = ctx.store.get<Record<string, string>>(tagsStoreKey(arn)) ?? {};
  const tags = Object.entries(stored).map(([Key, Value]) => ({ Key, Value }));
  return { Tags: tags };
};

const eventBridge: ServiceDefinition = {
  name: "events",
  protocol: "json",
  operations: {
    PutRule,
    DeleteRule,
    DescribeRule,
    ListRules,
    PutTargets,
    RemoveTargets,
    ListTargetsByRule,
    PutEvents,
    CreateEventBus,
    DescribeEventBus,
    ListEventBuses,
    DeleteEventBus,
    CreateArchive,
    DescribeArchive,
    ListArchives,
    DeleteArchive,
    EnableRule,
    DisableRule,
    ListRuleNamesByTarget,
    TestEventPattern,
    CreateConnection,
    DescribeConnection,
    UpdateConnection,
    DeleteConnection,
    DeauthorizeConnection,
    ListConnections,
    CreateApiDestination,
    DescribeApiDestination,
    UpdateApiDestination,
    DeleteApiDestination,
    ListApiDestinations,
    CreateEndpoint,
    DescribeEndpoint,
    UpdateEndpoint,
    DeleteEndpoint,
    ListEndpoints,
    UpdateEventBus,
    PutPermission,
    RemovePermission,
    PutPartnerEvents,
    CreatePartnerEventSource,
    DeletePartnerEventSource,
    DescribePartnerEventSource,
    ListPartnerEventSources,
    ListPartnerEventSourceAccounts,
    ActivateEventSource,
    DeactivateEventSource,
    DescribeEventSource,
    ListEventSources,
    UpdateArchive,
    StartReplay,
    DescribeReplay,
    CancelReplay,
    ListReplays,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const;

export default eventBridge;
