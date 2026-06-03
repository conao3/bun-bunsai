import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import configModel from "../../../../test/vendor/aws-models/config.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(configModel);

type StoredRule = Record<string, unknown> & { ConfigRuleName: string };

type StoredRecorder = Record<string, unknown> & { name: string };

const ruleKey = (name: string): string => `rule:${name}`;

const recorderKey = (name: string): string => `recorder:${name}`;

const asObject = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const ruleArn = (ctx: ServiceContext, name: string, id: string): string =>
  `arn:aws:config:${ctx.region}:${ctx.account}:config-rule/${name}-${id}`;

const recorderArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:config:${ctx.region}:${ctx.account}:configuration-recorder/${name}`;

const randomSuffix = (): string =>
  crypto.randomUUID().replace(/-/g, "").slice(0, 8);

const PutConfigRule: OperationHandler = (input, ctx) => {
  const rule = asObject(input["ConfigRule"]);
  const name =
    stringOrUndefined(rule["ConfigRuleName"]) ??
    `config-rule-${randomSuffix()}`;
  if (rule["Source"] === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ConfigRule.Source is required.",
      400,
    );
  }
  const existing = ctx.store.get<StoredRule>(ruleKey(name));
  const id =
    stringOrUndefined(existing?.["ConfigRuleId"]) ??
    `config-rule-${randomSuffix()}`;
  const stored: StoredRule = {
    ...rule,
    ConfigRuleName: name,
    ConfigRuleId: id,
    ConfigRuleArn: ruleArn(ctx, name, id),
    ConfigRuleState: stringOrUndefined(rule["ConfigRuleState"]) ?? "ACTIVE",
  };
  ctx.store.set(ruleKey(name), stored);
  return {};
};

const DescribeConfigRules: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["ConfigRuleNames"])
    ? (input["ConfigRuleNames"] as unknown[]).map((value) => String(value))
    : undefined;
  const rules = ctx.store
    .list<StoredRule>()
    .filter((entry) => entry.key.startsWith("rule:"))
    .map((entry) => entry.value)
    .filter(
      (rule) => names === undefined || names.includes(rule.ConfigRuleName),
    );
  return { ConfigRules: rules };
};

const DeleteConfigRule: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConfigRuleName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ConfigRuleName is required.",
      400,
    );
  }
  if (ctx.store.get<StoredRule>(ruleKey(name)) === undefined) {
    throw awsError(
      "NoSuchConfigRuleException",
      `The ConfigRule '${name}' provided in the request is invalid.`,
      400,
    );
  }
  ctx.store.delete(ruleKey(name));
  return {};
};

const PutConfigurationRecorder: OperationHandler = (input, ctx) => {
  const recorder = asObject(input["ConfigurationRecorder"]);
  const name = stringOrUndefined(recorder["name"]) ?? "default";
  const stored: StoredRecorder = {
    ...recorder,
    name,
    arn: stringOrUndefined(recorder["arn"]) ?? recorderArn(ctx, name),
  };
  ctx.store.set(recorderKey(name), stored);
  return {};
};

const DescribeConfigurationRecorders: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["ConfigurationRecorderNames"])
    ? (input["ConfigurationRecorderNames"] as unknown[]).map((value) =>
        String(value),
      )
    : undefined;
  const recorders = ctx.store
    .list<StoredRecorder>()
    .filter((entry) => entry.key.startsWith("recorder:"))
    .map((entry) => entry.value)
    .filter((recorder) => names === undefined || names.includes(recorder.name));
  return { ConfigurationRecorders: recorders };
};

const DeleteConfigurationRecorder: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConfigurationRecorderName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ConfigurationRecorderName is required.",
      400,
    );
  }
  if (ctx.store.get<StoredRecorder>(recorderKey(name)) === undefined) {
    throw awsError(
      "NoSuchConfigurationRecorderException",
      `Cannot find configuration recorder with the specified name '${name}'.`,
      400,
    );
  }
  ctx.store.delete(recorderKey(name));
  return {};
};

const config: ServiceDefinition = {
  name: "config",
  protocol: "json",
  operations: {
    PutConfigRule,
    DescribeConfigRules,
    DeleteConfigRule,
    PutConfigurationRecorder,
    DescribeConfigurationRecorders,
    DeleteConfigurationRecorder,
  },
  model,
} as const;

export default config;
