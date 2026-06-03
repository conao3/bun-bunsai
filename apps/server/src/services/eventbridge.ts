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
  },
  model,
} as const;

export default eventBridge;
