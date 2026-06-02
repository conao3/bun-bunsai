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
  },
  model,
} as const;

export default eventBridge;
