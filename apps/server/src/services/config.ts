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
type StoredAggregator = Record<string, unknown> & {
  ConfigurationAggregatorName: string;
};
type StoredConformancePack = Record<string, unknown> & {
  ConformancePackName: string;
};
type StoredDeliveryChannel = Record<string, unknown> & { name: string };
type StoredStoredQuery = Record<string, unknown> & { QueryName: string };
type StoredRetentionConfig = Record<string, unknown> & { Name: string };
type StoredAggAuth = Record<string, unknown> & {
  AuthorizedAccountId: string;
  AuthorizedAwsRegion: string;
};
type StoredPendingAgg = Record<string, unknown> & {
  RequesterAccountId: string;
  RequesterAwsRegion: string;
};
type StoredRemediationConfig = Record<string, unknown> & {
  ConfigRuleName: string;
};
type StoredOrgConfigRule = Record<string, unknown> & {
  OrganizationConfigRuleName: string;
};
type StoredOrgConformancePack = Record<string, unknown> & {
  OrganizationConformancePackName: string;
};
type StoredResourceConfig = Record<string, unknown> & {
  ResourceType: string;
  ResourceId: string;
};
type StoredSvcLinkedRecorder = Record<string, unknown> & {
  ServicePrincipal: string;
};
type StoredResourceEval = Record<string, unknown> & {
  ResourceEvaluationId: string;
};

const ruleKey = (name: string): string => `rule:${name}`;
const recorderKey = (name: string): string => `recorder:${name}`;
const aggregatorKey = (name: string): string => `aggregator:${name}`;
const conformancePackKey = (name: string): string => `conformance-pack:${name}`;
const deliveryChannelKey = (name: string): string => `delivery-channel:${name}`;
const storedQueryKey = (name: string): string => `stored-query:${name}`;
const retentionKey = (name: string): string => `retention:${name}`;
const aggAuthKey = (accountId: string, region: string): string =>
  `agg-auth:${accountId}:${region}`;
const pendingAggKey = (accountId: string, region: string): string =>
  `pending-agg:${accountId}:${region}`;
const remediationKey = (ruleName: string): string => `remediation:${ruleName}`;
const remediationExceptionKey = (
  ruleName: string,
  type: string,
  id: string,
): string => `remediation-exception:${ruleName}:${type}:${id}`;
const orgRuleKey = (name: string): string => `org-rule:${name}`;
const orgConformancePackKey = (name: string): string =>
  `org-conformance-pack:${name}`;
const resourceConfigKey = (type: string, id: string): string =>
  `resource:${type}:${id}`;
const svcRecorderKey = (principal: string): string =>
  `svc-recorder:${principal}`;
const resourceEvalKey = (id: string): string => `resource-eval:${id}`;
const tagsKey = (arn: string): string => `tags:${arn}`;

const asObject = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? (value as unknown[]).map((v) => String(v)) : [];

const ruleArn = (ctx: ServiceContext, name: string, id: string): string =>
  `arn:aws:config:${ctx.region}:${ctx.account}:config-rule/${name}-${id}`;

const recorderArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:config:${ctx.region}:${ctx.account}:configuration-recorder/${name}`;

const aggregatorArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:config:${ctx.region}:${ctx.account}:config-aggregator/${name}`;

const conformancePackArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:config:${ctx.region}:${ctx.account}:conformance-pack/${name}`;

const orgRuleArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:config:${ctx.region}:${ctx.account}:organization-config-rule/${name}`;

const orgConformancePackArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:config:${ctx.region}:${ctx.account}:organization-conformance-pack/${name}`;

const storedQueryArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:config:${ctx.region}:${ctx.account}:stored-query/${name}`;

const aggAuthArn = (
  ctx: ServiceContext,
  accountId: string,
  region: string,
): string =>
  `arn:aws:config:${ctx.region}:${ctx.account}:aggregation-authorization/${accountId}/${region}`;

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
  if (stringOrUndefined(recorder["roleARN"]) === undefined) {
    throw awsError(
      "InvalidRoleException",
      "You have provided a null or empty Amazon Resource Name (ARN) for the IAM role assumed by Config.",
      400,
    );
  }
  const stored: StoredRecorder = {
    ...recorder,
    name,
    arn: stringOrUndefined(recorder["arn"]) ?? recorderArn(ctx, name),
    recordingGroup: recorder["recordingGroup"] ?? {},
    recordingMode: recorder["recordingMode"] ?? {
      recordingFrequency: "CONTINUOUS",
    },
    isRecording: false,
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

const StartConfigurationRecorder: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConfigurationRecorderName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ConfigurationRecorderName is required.",
      400,
    );
  }
  const existing = ctx.store.get<StoredRecorder>(recorderKey(name));
  if (existing === undefined) {
    throw awsError(
      "NoSuchConfigurationRecorderException",
      `Cannot find configuration recorder with the specified name '${name}'.`,
      400,
    );
  }
  ctx.store.set(recorderKey(name), { ...existing, isRecording: true });
  return {};
};

const StopConfigurationRecorder: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConfigurationRecorderName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ConfigurationRecorderName is required.",
      400,
    );
  }
  const existing = ctx.store.get<StoredRecorder>(recorderKey(name));
  if (existing === undefined) {
    throw awsError(
      "NoSuchConfigurationRecorderException",
      `Cannot find configuration recorder with the specified name '${name}'.`,
      400,
    );
  }
  ctx.store.set(recorderKey(name), { ...existing, isRecording: false });
  return {};
};

const DescribeConfigurationRecorderStatus: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["ConfigurationRecorderNames"])
    ? (input["ConfigurationRecorderNames"] as unknown[]).map((v) => String(v))
    : undefined;
  const recorders = ctx.store
    .list<StoredRecorder>()
    .filter((entry) => entry.key.startsWith("recorder:"))
    .map((entry) => entry.value)
    .filter((r) => names === undefined || names.includes(r.name));
  const statuses = recorders.map((r) => ({
    name: r.name,
    arn: r.arn,
    recording: r.isRecording ?? false,
    lastStatus: "SUCCESS",
    lastStatusChangeTime: 0,
  }));
  return { ConfigurationRecordersStatus: statuses };
};

const ListConfigurationRecorders: OperationHandler = (_input, ctx) => {
  const recorders = ctx.store
    .list<StoredRecorder>()
    .filter((entry) => entry.key.startsWith("recorder:"))
    .map((entry) => entry.value);
  const summaries = recorders.map((r) => ({
    arn: r.arn,
    name: r.name,
    servicePrincipal: r.servicePrincipal,
    recordingScope: "INTERNAL",
  }));
  return { ConfigurationRecorderSummaries: summaries };
};

const AssociateResourceTypes: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ConfigurationRecorderArn"]);
  if (arn === undefined) {
    throw awsError(
      "ValidationException",
      "ConfigurationRecorderArn is required.",
      400,
    );
  }
  const resourceTypes = Array.isArray(input["ResourceTypes"])
    ? (input["ResourceTypes"] as unknown[]).map((v) => String(v))
    : [];
  const entry = ctx.store
    .list<StoredRecorder>()
    .find((e) => e.key.startsWith("recorder:") && e.value.arn === arn);
  if (entry === undefined) {
    throw awsError(
      "NoSuchConfigurationRecorderException",
      `Cannot find configuration recorder with the specified ARN '${arn}'.`,
      400,
    );
  }
  const recorder = entry.value;
  const existing = Array.isArray(recorder["recordingGroup"])
    ? (recorder["recordingGroup"] as string[])
    : [];
  const merged = Array.from(new Set([...existing, ...resourceTypes]));
  ctx.store.set(recorderKey(String(recorder.name)), {
    ...recorder,
    recordingGroup: merged,
  });
  return { ConfigurationRecorder: { ...recorder, recordingGroup: merged } };
};

const DisassociateResourceTypes: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ConfigurationRecorderArn"]);
  if (arn === undefined) {
    throw awsError(
      "ValidationException",
      "ConfigurationRecorderArn is required.",
      400,
    );
  }
  const resourceTypes = Array.isArray(input["ResourceTypes"])
    ? (input["ResourceTypes"] as unknown[]).map((v) => String(v))
    : [];
  const entry = ctx.store
    .list<StoredRecorder>()
    .find((e) => e.key.startsWith("recorder:") && e.value.arn === arn);
  if (entry === undefined) {
    throw awsError(
      "NoSuchConfigurationRecorderException",
      `Cannot find configuration recorder with the specified ARN '${arn}'.`,
      400,
    );
  }
  const recorder = entry.value;
  const existing = Array.isArray(recorder["recordingGroup"])
    ? (recorder["recordingGroup"] as string[])
    : [];
  const remaining = existing.filter((t) => !resourceTypes.includes(t));
  ctx.store.set(recorderKey(String(recorder.name)), {
    ...recorder,
    recordingGroup: remaining,
  });
  return { ConfigurationRecorder: { ...recorder, recordingGroup: remaining } };
};

const PutConfigurationAggregator: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConfigurationAggregatorName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ConfigurationAggregatorName is required.",
      400,
    );
  }
  const accountSources = Array.isArray(input["AccountAggregationSources"])
    ? (input["AccountAggregationSources"] as unknown[])
    : [];
  const orgSource = input["OrganizationAggregationSource"];
  if (accountSources.length === 0 && orgSource === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "At least one of AccountAggregationSources or OrganizationAggregationSource must be provided.",
      400,
    );
  }
  const existing = ctx.store.get<StoredAggregator>(aggregatorKey(name));
  const arn =
    stringOrUndefined(existing?.["ConfigurationAggregatorArn"]) ??
    aggregatorArn(ctx, name);
  const stored: StoredAggregator = {
    ...asObject(existing),
    ConfigurationAggregatorName: name,
    ConfigurationAggregatorArn: arn,
    AccountAggregationSources: input["AccountAggregationSources"] ?? [],
    OrganizationAggregationSource:
      input["OrganizationAggregationSource"] ?? null,
    AggregatorFilters: input["AggregatorFilters"] ?? null,
    CreationTime: existing?.["CreationTime"] ?? 0,
    LastUpdatedTime: 0,
  };
  ctx.store.set(aggregatorKey(name), stored);
  return { ConfigurationAggregator: stored };
};

const DescribeConfigurationAggregators: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["ConfigurationAggregatorNames"])
    ? (input["ConfigurationAggregatorNames"] as unknown[]).map((v) => String(v))
    : undefined;
  const aggregators = ctx.store
    .list<StoredAggregator>()
    .filter((e) => e.key.startsWith("aggregator:"))
    .map((e) => e.value)
    .filter(
      (a) =>
        names === undefined || names.includes(a.ConfigurationAggregatorName),
    );
  return { ConfigurationAggregators: aggregators };
};

const DeleteConfigurationAggregator: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConfigurationAggregatorName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ConfigurationAggregatorName is required.",
      400,
    );
  }
  if (ctx.store.get<StoredAggregator>(aggregatorKey(name)) === undefined) {
    throw awsError(
      "NoSuchConfigurationAggregatorException",
      `The configuration aggregator '${name}' provided in the request is invalid.`,
      400,
    );
  }
  ctx.store.delete(aggregatorKey(name));
  return {};
};

const DescribeConfigurationAggregatorSourcesStatus: OperationHandler = (
  input,
  ctx,
) => {
  const name = stringOrUndefined(input["ConfigurationAggregatorName"]);
  if (name === undefined || ctx.store.get(aggregatorKey(name)) === undefined) {
    throw awsError(
      "NoSuchConfigurationAggregatorException",
      `The configuration aggregator '${name}' provided in the request is invalid.`,
      400,
    );
  }
  return { AggregatedSourceStatusList: [] };
};

const PutConformancePack: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConformancePackName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ConformancePackName is required.",
      400,
    );
  }
  const templateS3Uri = stringOrUndefined(input["TemplateS3Uri"]);
  const templateBody = stringOrUndefined(input["TemplateBody"]);
  if (templateS3Uri === undefined && templateBody === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "You must provide either TemplateS3Uri or TemplateBody.",
      400,
    );
  }
  const existing = ctx.store.get<StoredConformancePack>(
    conformancePackKey(name),
  );
  const arn =
    stringOrUndefined(existing?.["ConformancePackArn"]) ??
    conformancePackArn(ctx, name);
  const conformancePackState = "CREATE_COMPLETE" as const;
  const stored: StoredConformancePack = {
    ConformancePackName: name,
    ConformancePackArn: arn,
    ConformancePackState: conformancePackState,
    DeliveryS3Bucket: input["DeliveryS3Bucket"] ?? null,
    DeliveryS3KeyPrefix: input["DeliveryS3KeyPrefix"] ?? null,
    ConformancePackInputParameters:
      input["ConformancePackInputParameters"] ?? [],
    LastUpdateRequestedTime: existing?.["LastUpdateRequestedTime"] ?? 0,
  };
  ctx.store.set(conformancePackKey(name), stored);
  return { ConformancePackArn: arn };
};

const DescribeConformancePacks: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["ConformancePackNames"])
    ? (input["ConformancePackNames"] as unknown[]).map((v) => String(v))
    : undefined;
  const packs = ctx.store
    .list<StoredConformancePack>()
    .filter((e) => e.key.startsWith("conformance-pack:"))
    .map((e) => e.value)
    .filter(
      (p) => names === undefined || names.includes(p.ConformancePackName),
    );
  return { ConformancePackDetails: packs };
};

const DeleteConformancePack: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConformancePackName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ConformancePackName is required.",
      400,
    );
  }
  if (
    ctx.store.get<StoredConformancePack>(conformancePackKey(name)) === undefined
  ) {
    throw awsError(
      "NoSuchConformancePackException",
      `The conformance pack '${name}' provided in the request is invalid.`,
      400,
    );
  }
  ctx.store.delete(conformancePackKey(name));
  return {};
};

const DescribeConformancePackStatus: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["ConformancePackNames"])
    ? (input["ConformancePackNames"] as unknown[]).map((v) => String(v))
    : undefined;
  const packs = ctx.store
    .list<StoredConformancePack>()
    .filter((e) => e.key.startsWith("conformance-pack:"))
    .map((e) => e.value)
    .filter(
      (p) => names === undefined || names.includes(p.ConformancePackName),
    );
  const statuses = packs.map((p) => ({
    ConformancePackName: p.ConformancePackName,
    ConformancePackArn: p.ConformancePackArn,
    ConformancePackState: p.ConformancePackState ?? "CREATE_COMPLETE",
    LastUpdateRequestedTime: p.LastUpdateRequestedTime ?? 0,
  }));
  return { ConformancePackStatusDetails: statuses };
};

const DescribeConformancePackCompliance: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConformancePackName"]);
  if (
    name === undefined ||
    ctx.store.get(conformancePackKey(name)) === undefined
  ) {
    throw awsError(
      "NoSuchConformancePackException",
      `The conformance pack '${name}' provided in the request is invalid.`,
      400,
    );
  }
  return { ConformancePackName: name, ConformancePackRuleComplianceList: [] };
};

const GetConformancePackComplianceDetails: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConformancePackName"]);
  if (
    name === undefined ||
    ctx.store.get(conformancePackKey(name)) === undefined
  ) {
    throw awsError(
      "NoSuchConformancePackException",
      `The conformance pack '${name}' provided in the request is invalid.`,
      400,
    );
  }
  return {
    ConformancePackName: name,
    ConformancePackRuleEvaluationResults: [],
  };
};

const GetConformancePackComplianceSummary: OperationHandler = (input, ctx) => {
  const names = asStringArray(input["ConformancePackNames"]);
  const summaries = names.map((n) => ({
    ConformancePackName: n,
    ConformancePackComplianceSummary: {
      ConformancePackName: n,
      ConformancePackComplianceStatus: "COMPLIANT",
    },
  }));
  return { ConformancePackComplianceSummaryList: summaries };
};

const ListConformancePackComplianceScores: OperationHandler = (_input, ctx) => {
  const packs = ctx.store
    .list<StoredConformancePack>()
    .filter((e) => e.key.startsWith("conformance-pack:"))
    .map((e) => e.value);
  const scores = packs.map((p) => ({
    ConformancePackName: p.ConformancePackName,
    Score: "100.00",
    LastUpdatedTime: 0,
  }));
  return { ConformancePackComplianceScores: scores };
};

const PutDeliveryChannel: OperationHandler = (input, ctx) => {
  const channel = asObject(input["DeliveryChannel"]);
  const name = stringOrUndefined(channel["name"]) ?? "default";
  const stored: StoredDeliveryChannel = { ...channel, name };
  ctx.store.set(deliveryChannelKey(name), stored);
  return {};
};

const DescribeDeliveryChannels: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["DeliveryChannelNames"])
    ? (input["DeliveryChannelNames"] as unknown[]).map((v) => String(v))
    : undefined;
  const channels = ctx.store
    .list<StoredDeliveryChannel>()
    .filter((e) => e.key.startsWith("delivery-channel:"))
    .map((e) => e.value)
    .filter((c) => names === undefined || names.includes(c.name));
  return { DeliveryChannels: channels };
};

const DeleteDeliveryChannel: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["DeliveryChannelName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "DeliveryChannelName is required.",
      400,
    );
  }
  if (
    ctx.store.get<StoredDeliveryChannel>(deliveryChannelKey(name)) === undefined
  ) {
    throw awsError(
      "NoSuchDeliveryChannelException",
      `Cannot find delivery channel with the specified name '${name}'.`,
      400,
    );
  }
  ctx.store.delete(deliveryChannelKey(name));
  return {};
};

const DescribeDeliveryChannelStatus: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["DeliveryChannelNames"])
    ? (input["DeliveryChannelNames"] as unknown[]).map((v) => String(v))
    : undefined;
  const channels = ctx.store
    .list<StoredDeliveryChannel>()
    .filter((e) => e.key.startsWith("delivery-channel:"))
    .map((e) => e.value)
    .filter((c) => names === undefined || names.includes(c.name));
  const statuses = channels.map((c) => ({
    name: c.name,
    configSnapshotDeliveryInfo: {
      lastStatus: "SUCCESS",
      lastStatusChangeTime: 0,
    },
    configHistoryDeliveryInfo: {
      lastStatus: "SUCCESS",
      lastStatusChangeTime: 0,
    },
    configStreamDeliveryInfo: {
      lastStatus: "SUCCESS",
      lastErrorCode: null,
      lastErrorMessage: null,
      lastStatusChangeTime: 0,
    },
  }));
  return { DeliveryChannelsStatus: statuses };
};

const DeliverConfigSnapshot: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["deliveryChannelName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "deliveryChannelName is required.",
      400,
    );
  }
  if (
    ctx.store.get<StoredDeliveryChannel>(deliveryChannelKey(name)) === undefined
  ) {
    throw awsError(
      "NoSuchDeliveryChannelException",
      `Cannot find delivery channel with the specified name '${name}'.`,
      400,
    );
  }
  return { configSnapshotId: randomSuffix() };
};

const PutStoredQuery: OperationHandler = (input, ctx) => {
  const query = asObject(input["StoredQuery"]);
  const name = stringOrUndefined(query["QueryName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "StoredQuery.QueryName is required.",
      400,
    );
  }
  const existing = ctx.store.get<StoredStoredQuery>(storedQueryKey(name));
  const id = stringOrUndefined(existing?.["QueryId"]) ?? randomSuffix();
  const arn =
    stringOrUndefined(existing?.["QueryArn"]) ?? storedQueryArn(ctx, name);
  const stored: StoredStoredQuery = {
    ...query,
    QueryName: name,
    QueryId: id,
    QueryArn: arn,
  };
  ctx.store.set(storedQueryKey(name), stored);
  return { QueryArn: arn };
};

const GetStoredQuery: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["QueryName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "QueryName is required.",
      400,
    );
  }
  const stored = ctx.store.get<StoredStoredQuery>(storedQueryKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `The stored query '${name}' does not exist.`,
      400,
    );
  }
  return { StoredQuery: stored };
};

const ListStoredQueries: OperationHandler = (_input, ctx) => {
  const queries = ctx.store
    .list<StoredStoredQuery>()
    .filter((e) => e.key.startsWith("stored-query:"))
    .map((e) => ({
      QueryId: e.value.QueryId,
      QueryArn: e.value.QueryArn,
      QueryName: e.value.QueryName,
      Description: e.value.Description,
    }));
  return { StoredQueryMetadata: queries };
};

const DeleteStoredQuery: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["QueryName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "QueryName is required.",
      400,
    );
  }
  if (ctx.store.get<StoredStoredQuery>(storedQueryKey(name)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `The stored query '${name}' does not exist.`,
      400,
    );
  }
  ctx.store.delete(storedQueryKey(name));
  return {};
};

const PutRetentionConfiguration: OperationHandler = (input, ctx) => {
  const days = input["RetentionPeriodInDays"];
  if (typeof days !== "number") {
    throw awsError(
      "InvalidParameterValueException",
      "RetentionPeriodInDays is required.",
      400,
    );
  }
  const name = "default";
  const stored: StoredRetentionConfig = {
    Name: name,
    RetentionPeriodInDays: days,
  };
  ctx.store.set(retentionKey(name), stored);
  return { RetentionConfiguration: stored };
};

const DescribeRetentionConfigurations: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["RetentionConfigurationNames"])
    ? (input["RetentionConfigurationNames"] as unknown[]).map((v) => String(v))
    : undefined;
  const configs = ctx.store
    .list<StoredRetentionConfig>()
    .filter((e) => e.key.startsWith("retention:"))
    .map((e) => e.value)
    .filter((c) => names === undefined || names.includes(c.Name));
  return { RetentionConfigurations: configs };
};

const DeleteRetentionConfiguration: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["RetentionConfigurationName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "RetentionConfigurationName is required.",
      400,
    );
  }
  if (ctx.store.get<StoredRetentionConfig>(retentionKey(name)) === undefined) {
    throw awsError(
      "NoSuchRetentionConfigurationException",
      `Cannot find retention configuration with the specified name '${name}'.`,
      400,
    );
  }
  ctx.store.delete(retentionKey(name));
  return {};
};

const PutAggregationAuthorization: OperationHandler = (input, ctx) => {
  const accountId = stringOrUndefined(input["AuthorizedAccountId"]);
  const region = stringOrUndefined(input["AuthorizedAwsRegion"]);
  if (accountId === undefined || region === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "AuthorizedAccountId and AuthorizedAwsRegion are required.",
      400,
    );
  }
  const arn = aggAuthArn(ctx, accountId, region);
  const stored: StoredAggAuth = {
    AuthorizedAccountId: accountId,
    AuthorizedAwsRegion: region,
    AggregationAuthorizationArn: arn,
    CreationTime: 0,
  };
  ctx.store.set(aggAuthKey(accountId, region), stored);
  return { AggregationAuthorization: stored };
};

const DescribeAggregationAuthorizations: OperationHandler = (_input, ctx) => {
  const auths = ctx.store
    .list<StoredAggAuth>()
    .filter((e) => e.key.startsWith("agg-auth:"))
    .map((e) => e.value);
  return { AggregationAuthorizations: auths };
};

const DeleteAggregationAuthorization: OperationHandler = (input, ctx) => {
  const accountId = stringOrUndefined(input["AuthorizedAccountId"]);
  const region = stringOrUndefined(input["AuthorizedAwsRegion"]);
  if (accountId === undefined || region === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "AuthorizedAccountId and AuthorizedAwsRegion are required.",
      400,
    );
  }
  if (
    ctx.store.get<StoredAggAuth>(aggAuthKey(accountId, region)) === undefined
  ) {
    throw awsError(
      "NoSuchAggregationAuthorizationException",
      `Aggregation authorization for account ${accountId} in region ${region} does not exist.`,
      400,
    );
  }
  ctx.store.delete(aggAuthKey(accountId, region));
  return {};
};

const DescribePendingAggregationRequests: OperationHandler = (_input, ctx) => {
  const reqs = ctx.store
    .list<StoredPendingAgg>()
    .filter((e) => e.key.startsWith("pending-agg:"))
    .map((e) => e.value);
  return { PendingAggregationRequests: reqs };
};

const DeletePendingAggregationRequest: OperationHandler = (input, ctx) => {
  const accountId = stringOrUndefined(input["RequesterAccountId"]);
  const region = stringOrUndefined(input["RequesterAwsRegion"]);
  if (accountId === undefined || region === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "RequesterAccountId and RequesterAwsRegion are required.",
      400,
    );
  }
  if (
    ctx.store.get<StoredPendingAgg>(pendingAggKey(accountId, region)) ===
    undefined
  ) {
    throw awsError(
      "InvalidParameterValueException",
      `Pending aggregation request from account ${accountId} in region ${region} does not exist.`,
      400,
    );
  }
  ctx.store.delete(pendingAggKey(accountId, region));
  return {};
};

const PutRemediationConfigurations: OperationHandler = (input, ctx) => {
  const configs = Array.isArray(input["RemediationConfigurations"])
    ? (input["RemediationConfigurations"] as unknown[])
    : [];
  for (const cfg of configs) {
    const c = asObject(cfg);
    const ruleName = stringOrUndefined(c["ConfigRuleName"]);
    if (ruleName !== undefined) {
      const stored: StoredRemediationConfig = {
        ...c,
        ConfigRuleName: ruleName,
      };
      ctx.store.set(remediationKey(ruleName), stored);
    }
  }
  return { FailedBatches: [] };
};

const DescribeRemediationConfigurations: OperationHandler = (input, ctx) => {
  const names = asStringArray(input["ConfigRuleNames"]);
  const configs = names
    .map((n) => ctx.store.get<StoredRemediationConfig>(remediationKey(n)))
    .filter((c) => c !== undefined);
  return { RemediationConfigurations: configs };
};

const DeleteRemediationConfiguration: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConfigRuleName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ConfigRuleName is required.",
      400,
    );
  }
  if (
    ctx.store.get<StoredRemediationConfig>(remediationKey(name)) === undefined
  ) {
    throw awsError(
      "NoSuchRemediationConfigurationException",
      `You specified an Config rule without a remediation configuration. Verify that the ConfigRuleName ${name} is correct.`,
      400,
    );
  }
  ctx.store.delete(remediationKey(name));
  return {};
};

const PutRemediationExceptions: OperationHandler = (input, ctx) => {
  const ruleName = stringOrUndefined(input["ConfigRuleName"]);
  if (ruleName === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ConfigRuleName is required.",
      400,
    );
  }
  const keys = Array.isArray(input["ResourceKeys"])
    ? (input["ResourceKeys"] as unknown[])
    : [];
  for (const k of keys) {
    const key = asObject(k);
    const type = stringOrUndefined(key["ResourceType"]) ?? "";
    const id = stringOrUndefined(key["ResourceId"]) ?? "";
    ctx.store.set(remediationExceptionKey(ruleName, type, id), {
      ConfigRuleName: ruleName,
      ResourceType: type,
      ResourceId: id,
      Message: input["Message"] ?? null,
      ExpirationTime: input["ExpirationTime"] ?? null,
    });
  }
  return { FailedBatches: [] };
};

const DescribeRemediationExceptions: OperationHandler = (input, ctx) => {
  const ruleName = stringOrUndefined(input["ConfigRuleName"]);
  if (ruleName === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ConfigRuleName is required.",
      400,
    );
  }
  const prefix = `remediation-exception:${ruleName}:`;
  const exceptions = ctx.store
    .list()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return { RemediationExceptions: exceptions };
};

const DeleteRemediationExceptions: OperationHandler = (input, ctx) => {
  const ruleName = stringOrUndefined(input["ConfigRuleName"]);
  if (ruleName === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ConfigRuleName is required.",
      400,
    );
  }
  const keys = Array.isArray(input["ResourceKeys"])
    ? (input["ResourceKeys"] as unknown[])
    : [];
  for (const k of keys) {
    const key = asObject(k);
    const type = stringOrUndefined(key["ResourceType"]) ?? "";
    const id = stringOrUndefined(key["ResourceId"]) ?? "";
    ctx.store.delete(remediationExceptionKey(ruleName, type, id));
  }
  return { FailedBatches: [] };
};

const DescribeRemediationExecutionStatus: OperationHandler = (input, _ctx) => {
  return { RemediationExecutionStatuses: [] };
};

const StartRemediationExecution: OperationHandler = (input, _ctx) => {
  return { FailureMessage: null, FailedItems: [] };
};

const PutOrganizationConfigRule: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["OrganizationConfigRuleName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "OrganizationConfigRuleName is required.",
      400,
    );
  }
  const arn = orgRuleArn(ctx, name);
  const existing = ctx.store.get<StoredOrgConfigRule>(orgRuleKey(name));
  const organizationRuleStatus =
    existing !== undefined ? "UPDATE_SUCCESSFUL" : "CREATE_SUCCESSFUL";
  const stored: StoredOrgConfigRule = {
    OrganizationConfigRuleName: name,
    OrganizationConfigRuleArn: arn,
    OrganizationRuleStatus: organizationRuleStatus,
    OrganizationManagedRuleMetadata:
      input["OrganizationManagedRuleMetadata"] ?? null,
    OrganizationCustomRuleMetadata:
      input["OrganizationCustomRuleMetadata"] ?? null,
    OrganizationCustomPolicyRuleMetadata:
      input["OrganizationCustomPolicyRuleMetadata"] ?? null,
    ExcludedAccounts: input["ExcludedAccounts"] ?? [],
    LastUpdateTime: 0,
  };
  ctx.store.set(orgRuleKey(name), stored);
  return { OrganizationConfigRuleArn: arn };
};

const DescribeOrganizationConfigRules: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["OrganizationConfigRuleNames"])
    ? (input["OrganizationConfigRuleNames"] as unknown[]).map((v) => String(v))
    : undefined;
  const rules = ctx.store
    .list<StoredOrgConfigRule>()
    .filter((e) => e.key.startsWith("org-rule:"))
    .map((e) => e.value)
    .filter(
      (r) =>
        names === undefined || names.includes(r.OrganizationConfigRuleName),
    );
  return { OrganizationConfigRules: rules };
};

const DeleteOrganizationConfigRule: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["OrganizationConfigRuleName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "OrganizationConfigRuleName is required.",
      400,
    );
  }
  if (ctx.store.get<StoredOrgConfigRule>(orgRuleKey(name)) === undefined) {
    throw awsError(
      "NoSuchOrganizationConfigRuleException",
      `The organization config rule '${name}' does not exist.`,
      400,
    );
  }
  ctx.store.delete(orgRuleKey(name));
  return {};
};

const DescribeOrganizationConfigRuleStatuses: OperationHandler = (
  input,
  ctx,
) => {
  const names = Array.isArray(input["OrganizationConfigRuleNames"])
    ? (input["OrganizationConfigRuleNames"] as unknown[]).map((v) => String(v))
    : undefined;
  const rules = ctx.store
    .list<StoredOrgConfigRule>()
    .filter((e) => e.key.startsWith("org-rule:"))
    .map((e) => e.value)
    .filter(
      (r) =>
        names === undefined || names.includes(r.OrganizationConfigRuleName),
    );
  const statuses = rules.map((r) => ({
    OrganizationConfigRuleName: r.OrganizationConfigRuleName,
    OrganizationRuleStatus: r.OrganizationRuleStatus ?? "CREATE_SUCCESSFUL",
    LastUpdateTime: r.LastUpdateTime ?? 0,
  }));
  return { OrganizationConfigRuleStatuses: statuses };
};

const GetOrganizationConfigRuleDetailedStatus: OperationHandler = (
  input,
  ctx,
) => {
  const name = stringOrUndefined(input["OrganizationConfigRuleName"]);
  if (name === undefined || ctx.store.get(orgRuleKey(name)) === undefined) {
    throw awsError(
      "NoSuchOrganizationConfigRuleException",
      `The organization config rule '${name}' does not exist.`,
      400,
    );
  }
  return { OrganizationConfigRuleDetailedStatus: [] };
};

const GetCustomRulePolicy: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConfigRuleName"]);
  const rule =
    name !== undefined ? ctx.store.get<StoredRule>(ruleKey(name)) : undefined;
  if (name !== undefined && rule === undefined) {
    throw awsError(
      "NoSuchConfigRuleException",
      `The ConfigRule '${name}' provided in the request is invalid.`,
      400,
    );
  }
  return { PolicyText: "" };
};

const GetOrganizationCustomRulePolicy: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["OrganizationConfigRuleName"]);
  if (name === undefined || ctx.store.get(orgRuleKey(name)) === undefined) {
    throw awsError(
      "NoSuchOrganizationConfigRuleException",
      `The organization config rule '${name}' does not exist.`,
      400,
    );
  }
  return { PolicyText: "" };
};

const PutOrganizationConformancePack: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["OrganizationConformancePackName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "OrganizationConformancePackName is required.",
      400,
    );
  }
  const arn = orgConformancePackArn(ctx, name);
  const existing = ctx.store.get<StoredOrgConformancePack>(
    orgConformancePackKey(name),
  );
  const orgPackStatus =
    existing !== undefined ? "UPDATE_SUCCESSFUL" : "CREATE_SUCCESSFUL";
  const stored: StoredOrgConformancePack = {
    OrganizationConformancePackName: name,
    OrganizationConformancePackArn: arn,
    Status: orgPackStatus,
    DeliveryS3Bucket: input["DeliveryS3Bucket"] ?? null,
    DeliveryS3KeyPrefix: input["DeliveryS3KeyPrefix"] ?? null,
    ConformancePackInputParameters:
      input["ConformancePackInputParameters"] ?? [],
    ExcludedAccounts: input["ExcludedAccounts"] ?? [],
    LastUpdateTime: 0,
  };
  ctx.store.set(orgConformancePackKey(name), stored);
  return { OrganizationConformancePackArn: arn };
};

const DescribeOrganizationConformancePacks: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["OrganizationConformancePackNames"])
    ? (input["OrganizationConformancePackNames"] as unknown[]).map((v) =>
        String(v),
      )
    : undefined;
  const packs = ctx.store
    .list<StoredOrgConformancePack>()
    .filter((e) => e.key.startsWith("org-conformance-pack:"))
    .map((e) => e.value)
    .filter(
      (p) =>
        names === undefined ||
        names.includes(p.OrganizationConformancePackName),
    );
  return { OrganizationConformancePacks: packs };
};

const DeleteOrganizationConformancePack: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["OrganizationConformancePackName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "OrganizationConformancePackName is required.",
      400,
    );
  }
  if (
    ctx.store.get<StoredOrgConformancePack>(orgConformancePackKey(name)) ===
    undefined
  ) {
    throw awsError(
      "NoSuchOrganizationConformancePackException",
      `The organization conformance pack '${name}' does not exist.`,
      400,
    );
  }
  ctx.store.delete(orgConformancePackKey(name));
  return {};
};

const DescribeOrganizationConformancePackStatuses: OperationHandler = (
  input,
  ctx,
) => {
  const names = Array.isArray(input["OrganizationConformancePackNames"])
    ? (input["OrganizationConformancePackNames"] as unknown[]).map((v) =>
        String(v),
      )
    : undefined;
  const packs = ctx.store
    .list<StoredOrgConformancePack>()
    .filter((e) => e.key.startsWith("org-conformance-pack:"))
    .map((e) => e.value)
    .filter(
      (p) =>
        names === undefined ||
        names.includes(p.OrganizationConformancePackName),
    );
  const statuses = packs.map((p) => ({
    OrganizationConformancePackName: p.OrganizationConformancePackName,
    Status: p.Status ?? "CREATE_SUCCESSFUL",
    LastUpdateTime: p.LastUpdateTime ?? 0,
  }));
  return { OrganizationConformancePackStatuses: statuses };
};

const GetOrganizationConformancePackDetailedStatus: OperationHandler = (
  input,
  ctx,
) => {
  const name = stringOrUndefined(input["OrganizationConformancePackName"]);
  if (
    name === undefined ||
    ctx.store.get(orgConformancePackKey(name)) === undefined
  ) {
    throw awsError(
      "NoSuchOrganizationConformancePackException",
      `The organization conformance pack '${name}' does not exist.`,
      400,
    );
  }
  return { OrganizationConformancePackDetailedStatuses: [] };
};

const PutResourceConfig: OperationHandler = (input, ctx) => {
  const type = stringOrUndefined(input["ResourceType"]);
  const id = stringOrUndefined(input["ResourceId"]);
  if (type === undefined || id === undefined) {
    throw awsError(
      "ValidationException",
      "ResourceType and ResourceId are required.",
      400,
    );
  }
  const stored: StoredResourceConfig = {
    ResourceType: type,
    ResourceId: id,
    ResourceName: input["ResourceName"] ?? null,
    SchemaVersionId: input["SchemaVersionId"] ?? null,
    Configuration: input["Configuration"] ?? null,
  };
  ctx.store.set(resourceConfigKey(type, id), stored);
  return {};
};

const DeleteResourceConfig: OperationHandler = (input, ctx) => {
  const type = stringOrUndefined(input["ResourceType"]);
  const id = stringOrUndefined(input["ResourceId"]);
  if (type === undefined || id === undefined) {
    throw awsError(
      "ValidationException",
      "ResourceType and ResourceId are required.",
      400,
    );
  }
  ctx.store.delete(resourceConfigKey(type, id));
  return {};
};

const BatchGetResourceConfig: OperationHandler = (input, ctx) => {
  const keys = Array.isArray(input["resourceKeys"])
    ? (input["resourceKeys"] as unknown[])
    : [];
  const items: unknown[] = [];
  const unprocessed: unknown[] = [];
  for (const k of keys) {
    const key = asObject(k);
    const type = stringOrUndefined(key["resourceType"]) ?? "";
    const id = stringOrUndefined(key["resourceId"]) ?? "";
    const stored = ctx.store.get<StoredResourceConfig>(
      resourceConfigKey(type, id),
    );
    if (stored !== undefined) {
      items.push({
        resourceType: stored.ResourceType,
        resourceId: stored.ResourceId,
        resourceName: stored.ResourceName,
        configuration: stored.Configuration,
        configurationItemStatus: "OK",
        configurationStateId: "0",
        configurationItemCaptureTime: 0,
        version: "1.0",
        accountId: ctx.account,
        awsRegion: ctx.region,
      });
    } else {
      unprocessed.push(k);
    }
  }
  return {
    baseConfigurationItems: items,
    unprocessedResourceKeys: unprocessed,
  };
};

const GetAggregateResourceConfig: OperationHandler = (_input, _ctx) => {
  return {
    ConfigurationItem: {
      resourceType: "AWS::EC2::Instance",
      resourceId: "i-synthetic",
      configurationItemStatus: "OK",
      configurationStateId: "0",
      configurationItemCaptureTime: 0,
      version: "1.0",
      accountId: "000000000000",
      awsRegion: "us-east-1",
    },
  };
};

const BatchGetAggregateResourceConfig: OperationHandler = (_input, _ctx) => {
  return {
    BaseConfigurationItems: [],
    UnprocessedResourceIdentifiers: [],
  };
};

const GetResourceConfigHistory: OperationHandler = (_input, _ctx) => {
  return { configurationItems: [], nextToken: null };
};

const ListDiscoveredResources: OperationHandler = (input, ctx) => {
  const type = stringOrUndefined(input["resourceType"]);
  const resources = ctx.store
    .list<StoredResourceConfig>()
    .filter((e) => e.key.startsWith("resource:"))
    .map((e) => e.value)
    .filter((r) => type === undefined || r.ResourceType === type);
  const identifiers = resources.map((r) => ({
    resourceType: r.ResourceType,
    resourceId: r.ResourceId,
    resourceName: r.ResourceName,
  }));
  return { resourceIdentifiers: identifiers };
};

const GetDiscoveredResourceCounts: OperationHandler = (input, ctx) => {
  const resources = ctx.store
    .list<StoredResourceConfig>()
    .filter((e) => e.key.startsWith("resource:"))
    .map((e) => e.value);
  const countMap: Record<string, number> = {};
  for (const r of resources) {
    const t = String(r.ResourceType);
    countMap[t] = (countMap[t] ?? 0) + 1;
  }
  const resourceCounts = Object.entries(countMap).map(
    ([resourceType, count]) => ({
      resourceType,
      count,
    }),
  );
  return {
    totalDiscoveredResources: resources.length,
    resourceCounts,
    nextToken: null,
  };
};

const ListAggregateDiscoveredResources: OperationHandler = (_input, _ctx) => {
  return { ResourceIdentifiers: [], NextToken: null };
};

const PutServiceLinkedConfigurationRecorder: OperationHandler = (
  input,
  ctx,
) => {
  const principal = stringOrUndefined(input["ServicePrincipal"]);
  if (principal === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ServicePrincipal is required.",
      400,
    );
  }
  const name = `aws-service-role/${principal}`;
  const arn = recorderArn(ctx, name);
  const stored: StoredSvcLinkedRecorder = {
    ServicePrincipal: principal,
    Arn: arn,
    Name: name,
  };
  ctx.store.set(svcRecorderKey(principal), stored);
  return { Arn: arn, Name: name };
};

const DeleteServiceLinkedConfigurationRecorder: OperationHandler = (
  input,
  ctx,
) => {
  const principal = stringOrUndefined(input["ServicePrincipal"]);
  if (principal === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ServicePrincipal is required.",
      400,
    );
  }
  const stored = ctx.store.get<StoredSvcLinkedRecorder>(
    svcRecorderKey(principal),
  );
  if (stored === undefined) {
    throw awsError(
      "NoSuchConfigurationRecorderException",
      `Cannot find service linked configuration recorder for principal '${principal}'.`,
      400,
    );
  }
  ctx.store.delete(svcRecorderKey(principal));
  return { Arn: stored.Arn, Name: stored.Name };
};

const DescribeComplianceByConfigRule: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["ConfigRuleNames"])
    ? (input["ConfigRuleNames"] as unknown[]).map((v) => String(v))
    : undefined;
  const rules = ctx.store
    .list<StoredRule>()
    .filter((e) => e.key.startsWith("rule:"))
    .map((e) => e.value)
    .filter((r) => names === undefined || names.includes(r.ConfigRuleName));
  const complianceByRules = rules.map((r) => ({
    ConfigRuleName: r.ConfigRuleName,
    Compliance: {
      ComplianceType: "COMPLIANT",
      ComplianceContributorCount: { CappedCount: 0, CapExceeded: false },
    },
  }));
  return { ComplianceByConfigRules: complianceByRules };
};

const DescribeComplianceByResource: OperationHandler = (input, ctx) => {
  const resourceType = stringOrUndefined(input["ResourceType"]);
  const resourceId = stringOrUndefined(input["ResourceId"]);
  const complianceTypes = Array.isArray(input["ComplianceTypes"])
    ? (input["ComplianceTypes"] as unknown[]).map((v) => String(v))
    : undefined;
  const resources = ctx.store
    .list<StoredResourceConfig>()
    .filter((e) => e.key.startsWith("resource:"))
    .map((e) => e.value)
    .filter(
      (r) => resourceType === undefined || r.ResourceType === resourceType,
    )
    .filter((r) => resourceId === undefined || r.ResourceId === resourceId);
  const complianceByResources = resources
    .map((r) => ({
      ResourceType: r.ResourceType,
      ResourceId: r.ResourceId,
      Compliance: { ComplianceType: "COMPLIANT" },
    }))
    .filter(
      (r) =>
        complianceTypes === undefined ||
        complianceTypes.includes(r.Compliance.ComplianceType),
    );
  return { ComplianceByResources: complianceByResources };
};

const GetComplianceDetailsByConfigRule: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConfigRuleName"]);
  if (name !== undefined && ctx.store.get(ruleKey(name)) === undefined) {
    throw awsError(
      "NoSuchConfigRuleException",
      `The ConfigRule '${name}' provided in the request is invalid.`,
      400,
    );
  }
  return { EvaluationResults: [] };
};

const GetComplianceDetailsByResource: OperationHandler = (input, _ctx) => {
  const resourceType = stringOrUndefined(input["ResourceType"]);
  const resourceId = stringOrUndefined(input["ResourceId"]);
  const resourceEvalId = stringOrUndefined(input["ResourceEvaluationId"]);
  if (
    resourceEvalId === undefined &&
    (resourceType === undefined || resourceId === undefined)
  ) {
    throw awsError(
      "InvalidParameterValueException",
      "Either ResourceEvaluationId or both ResourceType and ResourceId are required.",
      400,
    );
  }
  return { EvaluationResults: [] };
};

const GetComplianceSummaryByConfigRule: OperationHandler = (_input, _ctx) => {
  return {
    ComplianceSummary: {
      CompliantResourceCount: { CappedCount: 0, CapExceeded: false },
      NonCompliantResourceCount: { CappedCount: 0, CapExceeded: false },
      ComplianceSummaryTimestamp: 0,
    },
  };
};

const GetComplianceSummaryByResourceType: OperationHandler = (_input, ctx) => {
  const resources = ctx.store
    .list<StoredResourceConfig>()
    .filter((e) => e.key.startsWith("resource:"))
    .map((e) => e.value);
  const counts: Record<string, number> = {};
  for (const r of resources) {
    counts[r.ResourceType] = (counts[r.ResourceType] ?? 0) + 1;
  }
  const summaries = Object.entries(counts).map(([type, count]) => ({
    ResourceType: type,
    ComplianceSummary: {
      CompliantResourceCount: { CappedCount: count, CapExceeded: false },
      NonCompliantResourceCount: { CappedCount: 0, CapExceeded: false },
      ComplianceSummaryTimestamp: 0,
    },
  }));
  return { ComplianceSummariesByResourceType: summaries };
};

const DescribeConfigRuleEvaluationStatus: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["ConfigRuleNames"])
    ? (input["ConfigRuleNames"] as unknown[]).map((v) => String(v))
    : undefined;
  const rules = ctx.store
    .list<StoredRule>()
    .filter((e) => e.key.startsWith("rule:"))
    .map((e) => e.value)
    .filter((r) => names === undefined || names.includes(r.ConfigRuleName));
  const statuses = rules.map((r) => ({
    ConfigRuleName: r.ConfigRuleName,
    ConfigRuleArn: r.ConfigRuleArn,
    ConfigRuleId: r.ConfigRuleId,
    LastSuccessfulInvocationTime: 0,
    LastFailedInvocationTime: null,
    LastSuccessfulEvaluationTime: 0,
    LastFailedEvaluationTime: null,
    FirstActivatedTime: 0,
    LastDeactivatedTime: null,
    LastErrorCode: null,
    LastErrorMessage: null,
    FirstEvaluationStarted: true,
  }));
  return { ConfigRulesEvaluationStatus: statuses };
};

const PutEvaluations: OperationHandler = (_input, _ctx) => {
  return { FailedEvaluations: [] };
};

const PutExternalEvaluation: OperationHandler = (_input, _ctx) => {
  return {};
};

const DeleteEvaluationResults: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ConfigRuleName"]);
  if (name !== undefined && ctx.store.get(ruleKey(name)) === undefined) {
    throw awsError(
      "NoSuchConfigRuleException",
      `The ConfigRule '${name}' provided in the request is invalid.`,
      400,
    );
  }
  return {};
};

const StartConfigRulesEvaluation: OperationHandler = (_input, _ctx) => {
  return {};
};

const DescribeAggregateComplianceByConfigRules: OperationHandler = (
  _input,
  _ctx,
) => {
  return { AggregateComplianceByConfigRules: [] };
};

const DescribeAggregateComplianceByConformancePacks: OperationHandler = (
  _input,
  _ctx,
) => {
  return { AggregateComplianceByConformancePacks: [] };
};

const GetAggregateComplianceDetailsByConfigRule: OperationHandler = (
  _input,
  _ctx,
) => {
  return { AggregateEvaluationResults: [] };
};

const GetAggregateConfigRuleComplianceSummary: OperationHandler = (
  _input,
  _ctx,
) => {
  return { GroupByKey: null, AggregateComplianceCounts: [] };
};

const GetAggregateConformancePackComplianceSummary: OperationHandler = (
  _input,
  _ctx,
) => {
  return {
    AggregateConformancePackComplianceSummaries: [],
    GroupByKey: null,
  };
};

const GetAggregateDiscoveredResourceCounts: OperationHandler = (
  _input,
  _ctx,
) => {
  return {
    TotalDiscoveredResources: 0,
    GroupByKey: null,
    GroupedResourceCounts: [],
  };
};

const StartResourceEvaluation: OperationHandler = (input, ctx) => {
  const id = `evaluation-${randomSuffix()}`;
  const stored: StoredResourceEval = {
    ResourceEvaluationId: id,
    EvaluationMode: input["EvaluationMode"] ?? "DETECTIVE",
    EvaluationStatus: { Status: "SUCCEEDED" },
    EvaluationStartTimestamp: 0,
    Compliance: "COMPLIANT",
    ResourceDetails: input["ResourceDetails"] ?? null,
    EvaluationContext: input["EvaluationContext"] ?? null,
  };
  ctx.store.set(resourceEvalKey(id), stored);
  return { ResourceEvaluationId: id };
};

const GetResourceEvaluationSummary: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["ResourceEvaluationId"]);
  if (id === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "ResourceEvaluationId is required.",
      400,
    );
  }
  const stored = ctx.store.get<StoredResourceEval>(resourceEvalKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `The resource evaluation '${id}' does not exist.`,
      400,
    );
  }
  return stored;
};

const ListResourceEvaluations: OperationHandler = (_input, ctx) => {
  const evals = ctx.store
    .list<StoredResourceEval>()
    .filter((e) => e.key.startsWith("resource-eval:"))
    .map((e) => ({
      ResourceEvaluationId: e.value.ResourceEvaluationId,
      EvaluationMode: e.value.EvaluationMode,
      EvaluationStartTimestamp: e.value.EvaluationStartTimestamp,
    }));
  return { ResourceEvaluations: evals };
};

const SelectResourceConfig: OperationHandler = (input, _ctx) => {
  const expression = stringOrUndefined(input["Expression"]);
  if (expression === undefined) {
    throw awsError(
      "InvalidExpressionException",
      "Expression is required.",
      400,
    );
  }
  if (!/^SELECT\s/i.test(expression)) {
    throw awsError(
      "InvalidExpressionException",
      "Expression must be a valid SELECT query.",
      400,
    );
  }
  return { Results: [], QueryInfo: { SelectFields: [] }, NextToken: null };
};

const SelectAggregateResourceConfig: OperationHandler = (input, _ctx) => {
  const expression = stringOrUndefined(input["Expression"]);
  if (expression === undefined) {
    throw awsError(
      "InvalidExpressionException",
      "Expression is required.",
      400,
    );
  }
  if (!/^SELECT\s/i.test(expression)) {
    throw awsError(
      "InvalidExpressionException",
      "Expression must be a valid SELECT query.",
      400,
    );
  }
  return { Results: [], QueryInfo: { SelectFields: [] }, NextToken: null };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ResourceArn"]);
  if (arn === undefined) {
    throw awsError("ValidationException", "ResourceArn is required.", 400);
  }
  const tags = Array.isArray(input["Tags"]) ? (input["Tags"] as unknown[]) : [];
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  for (const tag of tags) {
    const t = asObject(tag);
    const k = stringOrUndefined(t["Key"]);
    const v = stringOrUndefined(t["Value"]);
    if (k !== undefined && v !== undefined) {
      existing[k] = v;
    }
  }
  ctx.store.set(tagsKey(arn), existing);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ResourceArn"]);
  if (arn === undefined) {
    throw awsError("ValidationException", "ResourceArn is required.", 400);
  }
  const tagKeys = asStringArray(input["TagKeys"]);
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  for (const k of tagKeys) {
    delete existing[k];
  }
  ctx.store.set(tagsKey(arn), existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ResourceArn"]);
  if (arn === undefined) {
    throw awsError("ValidationException", "ResourceArn is required.", 400);
  }
  const tagMap = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  const tags = Object.entries(tagMap).map(([Key, Value]) => ({ Key, Value }));
  return { Tags: tags };
};

const config: ServiceDefinition = {
  name: "config",
  protocol: "json",
  operations: {
    AssociateResourceTypes,
    BatchGetAggregateResourceConfig,
    BatchGetResourceConfig,
    DeleteAggregationAuthorization,
    DeleteConfigRule,
    DeleteConfigurationAggregator,
    DeleteConfigurationRecorder,
    DeleteConformancePack,
    DeleteDeliveryChannel,
    DeleteEvaluationResults,
    DeleteOrganizationConfigRule,
    DeleteOrganizationConformancePack,
    DeletePendingAggregationRequest,
    DeleteRemediationConfiguration,
    DeleteRemediationExceptions,
    DeleteResourceConfig,
    DeleteRetentionConfiguration,
    DeleteServiceLinkedConfigurationRecorder,
    DeleteStoredQuery,
    DeliverConfigSnapshot,
    DescribeAggregateComplianceByConfigRules,
    DescribeAggregateComplianceByConformancePacks,
    DescribeAggregationAuthorizations,
    DescribeComplianceByConfigRule,
    DescribeComplianceByResource,
    DescribeConfigRuleEvaluationStatus,
    DescribeConfigRules,
    DescribeConfigurationAggregatorSourcesStatus,
    DescribeConfigurationAggregators,
    DescribeConfigurationRecorderStatus,
    DescribeConfigurationRecorders,
    DescribeConformancePackCompliance,
    DescribeConformancePackStatus,
    DescribeConformancePacks,
    DescribeDeliveryChannelStatus,
    DescribeDeliveryChannels,
    DescribeOrganizationConfigRuleStatuses,
    DescribeOrganizationConfigRules,
    DescribeOrganizationConformancePackStatuses,
    DescribeOrganizationConformancePacks,
    DescribePendingAggregationRequests,
    DescribeRemediationConfigurations,
    DescribeRemediationExceptions,
    DescribeRemediationExecutionStatus,
    DescribeRetentionConfigurations,
    DisassociateResourceTypes,
    GetAggregateComplianceDetailsByConfigRule,
    GetAggregateConfigRuleComplianceSummary,
    GetAggregateConformancePackComplianceSummary,
    GetAggregateDiscoveredResourceCounts,
    GetAggregateResourceConfig,
    GetComplianceDetailsByConfigRule,
    GetComplianceDetailsByResource,
    GetComplianceSummaryByConfigRule,
    GetComplianceSummaryByResourceType,
    GetConformancePackComplianceDetails,
    GetConformancePackComplianceSummary,
    GetCustomRulePolicy,
    GetDiscoveredResourceCounts,
    GetOrganizationConfigRuleDetailedStatus,
    GetOrganizationConformancePackDetailedStatus,
    GetOrganizationCustomRulePolicy,
    GetResourceConfigHistory,
    GetResourceEvaluationSummary,
    GetStoredQuery,
    ListAggregateDiscoveredResources,
    ListConfigurationRecorders,
    ListConformancePackComplianceScores,
    ListDiscoveredResources,
    ListResourceEvaluations,
    ListStoredQueries,
    ListTagsForResource,
    PutAggregationAuthorization,
    PutConfigRule,
    PutConfigurationAggregator,
    PutConfigurationRecorder,
    PutConformancePack,
    PutDeliveryChannel,
    PutEvaluations,
    PutExternalEvaluation,
    PutOrganizationConfigRule,
    PutOrganizationConformancePack,
    PutRemediationConfigurations,
    PutRemediationExceptions,
    PutResourceConfig,
    PutRetentionConfiguration,
    PutServiceLinkedConfigurationRecorder,
    PutStoredQuery,
    SelectAggregateResourceConfig,
    SelectResourceConfig,
    StartConfigRulesEvaluation,
    StartConfigurationRecorder,
    StartRemediationExecution,
    StartResourceEvaluation,
    StopConfigurationRecorder,
    TagResource,
    UntagResource,
  },
  model,
} as const;

export default config;
