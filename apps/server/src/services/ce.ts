import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ceModel from "../../../../test/vendor/aws-models/ce.json" with { type: "json" };
import type { OperationHandler, ServiceDefinition } from "../core/types.ts";

const model = loadServiceModel(ceModel);

type StoredCostCategory = Record<string, unknown> & {
  CostCategoryArn: string;
  Name: string;
  RuleVersion: string;
  EffectiveStart: string;
};

type StoredAnomalyMonitor = Record<string, unknown> & {
  MonitorArn: string;
  MonitorName: string;
  MonitorType: string;
  CreationDate: string;
  LastUpdatedDate: string;
  LastEvaluatedDate: string;
  DimensionalValueCount: number;
};

type StoredAnomalySubscription = Record<string, unknown> & {
  SubscriptionArn: string;
  SubscriptionName: string;
  MonitorArnList: string[];
  Subscribers: unknown[];
  Threshold: number;
  ThresholdExpression?: unknown;
  Frequency: string;
};

const region = "us-east-1";
const accountId = "000000000000";

const arn = (resource: string, id: string): string =>
  `arn:aws:ce::${accountId}:${resource}/${id}`;

const ccKey = (arnVal: string): string => `cc/${arnVal}`;
const monitorKey = (arnVal: string): string => `monitor/${arnVal}`;
const subscriptionKey = (arnVal: string): string => `subscription/${arnVal}`;
const tagKey = (arnVal: string): string => `tag/${arnVal}`;

const todayYMD = (): string => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

const deterministicSeed = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
};

const syntheticAmount = (seed: string): string => {
  const n = deterministicSeed(seed);
  const dollars = (n % 10000) / 100;
  return dollars.toFixed(2);
};

const dateToMs = (d: string): number => new Date(d).getTime();

const addDays = (date: string, days: number): string => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const addMonths = (date: string, months: number): string => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};

const addHours = (date: string, hours: number): string => {
  const d = new Date(date);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString().replace("T", "T").slice(0, 16) + ":00Z";
};

const splitPeriod = (
  start: string,
  end: string,
  granularity: string,
): Array<{ Start: string; End: string }> => {
  const buckets: Array<{ Start: string; End: string }> = [];
  let cur = start;
  const endMs = dateToMs(end);
  const gran = String(granularity).toUpperCase();

  while (dateToMs(cur) < endMs) {
    let next: string;
    if (gran === "MONTHLY") {
      next = addMonths(cur, 1);
    } else if (gran === "HOURLY") {
      next = addHours(cur, 1);
    } else {
      next = addDays(cur, 1);
    }
    const bucketEnd = dateToMs(next) > endMs ? end : next;
    buckets.push({ Start: cur, End: bucketEnd });
    cur = bucketEnd;
    if (cur >= end) break;
  }
  return buckets;
};

const metricValue = (
  metricName: string,
  timePeriod: { Start: string; End: string },
  groupKey?: string,
): { Amount: string; Unit: string } => {
  const seed = `${metricName}|${timePeriod.Start}|${timePeriod.End}|${groupKey ?? ""}`;
  const unit =
    metricName === "UsageQuantity" || metricName === "NormalizedUsageAmount"
      ? "N/A"
      : "USD";
  return { Amount: syntheticAmount(seed), Unit: unit };
};

const buildMetrics = (
  metricNames: string[],
  timePeriod: { Start: string; End: string },
  groupKey?: string,
): Record<string, { Amount: string; Unit: string }> => {
  const metrics: Record<string, { Amount: string; Unit: string }> = {};
  for (const m of metricNames) {
    metrics[m] = metricValue(m, timePeriod, groupKey);
  }
  return metrics;
};

const SERVICE_VALUES = [
  "Amazon EC2",
  "Amazon S3",
  "Amazon RDS",
  "AWS Lambda",
  "Amazon DynamoDB",
  "Amazon CloudFront",
  "AWS Glue",
  "Amazon SNS",
  "Amazon SQS",
  "Amazon Route 53",
];

const REGION_VALUES = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
  "ap-southeast-1",
  "ap-northeast-1",
];

const dimensionValues = (dimension: string): string[] => {
  const dim = String(dimension).toUpperCase();
  if (dim === "SERVICE") return SERVICE_VALUES;
  if (dim === "REGION") return REGION_VALUES;
  if (dim === "AZ")
    return ["us-east-1a", "us-east-1b", "us-east-1c", "us-west-2a"];
  if (dim === "INSTANCE_TYPE")
    return ["t3.micro", "t3.small", "m5.large", "c5.xlarge"];
  if (dim === "LINKED_ACCOUNT") return [accountId];
  if (dim === "PLATFORM") return ["Linux/UNIX", "Windows"];
  if (dim === "TENANCY") return ["Shared", "Dedicated"];
  if (dim === "PURCHASE_TYPE") return ["On Demand", "Reserved", "Spot"];
  if (dim === "RECORD_TYPE")
    return ["Usage", "Tax", "Credit", "Refund", "Support"];
  return ["(none)"];
};

const groupKeysFromGroupBy = (groupBy: unknown, seed: string): string[][] => {
  if (!Array.isArray(groupBy) || groupBy.length === 0) return [[]];
  const first = groupBy[0] as Record<string, unknown>;
  const type = String(first["Type"] ?? "DIMENSION").toUpperCase();
  const key = String(first["Key"] ?? "SERVICE");
  let vals: string[];
  if (type === "DIMENSION") {
    vals = dimensionValues(key).slice(0, 3);
  } else {
    vals = [`${key}/value1`, `${key}/value2`];
  }
  if (groupBy.length > 1) {
    const second = groupBy[1] as Record<string, unknown>;
    const type2 = String(second["Type"] ?? "DIMENSION").toUpperCase();
    const key2 = String(second["Key"] ?? "REGION");
    let vals2: string[];
    if (type2 === "DIMENSION") {
      vals2 = dimensionValues(key2).slice(0, 2);
    } else {
      vals2 = [`${key2}/v1`, `${key2}/v2`];
    }
    const combined: string[][] = [];
    for (const v1 of vals) {
      for (const v2 of vals2) {
        combined.push([v1, v2]);
      }
    }
    return combined.slice(0, 4);
  }
  return vals.map((v) => [v]);
};

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
  defaultMax = 100,
): { items: T[]; nextToken: string | undefined } => {
  const pageSize =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : defaultMax;
  const startIndex =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(nextToken, 10)
      : 0;
  const page = items.slice(startIndex, startIndex + pageSize);
  const newNextToken =
    startIndex + pageSize < items.length
      ? String(startIndex + pageSize)
      : undefined;
  return { items: page, nextToken: newNextToken };
};

const validateTimePeriod = (input: Record<string, unknown>): void => {
  const tp = input["TimePeriod"] as Record<string, unknown> | undefined;
  if (!tp || typeof tp["Start"] !== "string" || typeof tp["End"] !== "string") {
    throw awsError("ValidationException", "TimePeriod is required.", 400);
  }
  if (tp["Start"] >= tp["End"]) {
    throw awsError(
      "ValidationException",
      "Start date must be before end date.",
      400,
    );
  }
};

const getTimePeriod = (
  input: Record<string, unknown>,
): { Start: string; End: string } => {
  const tp = input["TimePeriod"] as Record<string, unknown>;
  return { Start: String(tp["Start"]), End: String(tp["End"]) };
};

const GetCostAndUsage: OperationHandler = (input) => {
  validateTimePeriod(input);
  const tp = getTimePeriod(input);
  const granularity = String(input["Granularity"] ?? "DAILY");
  const metrics = Array.isArray(input["Metrics"])
    ? (input["Metrics"] as string[])
    : ["BlendedCost"];
  const groupBy = input["GroupBy"];
  const buckets = splitPeriod(tp.Start, tp.End, granularity);
  const groupDefs = Array.isArray(groupBy) ? groupBy : [];

  const resultsByTime = buckets.map((bucket) => {
    const groupKeys = groupKeysFromGroupBy(
      groupDefs.length > 0 ? groupDefs : undefined,
      bucket.Start,
    );
    const total = buildMetrics(metrics, bucket);
    const groups =
      groupDefs.length > 0
        ? groupKeys.map((keys) => ({
            Keys: keys,
            Metrics: buildMetrics(metrics, bucket, keys.join("|")),
          }))
        : [];
    return {
      TimePeriod: bucket,
      Total: total,
      Groups: groups,
      Estimated: false,
    };
  });

  return {
    ResultsByTime: resultsByTime,
    GroupDefinitions: groupDefs,
  };
};

const GetCostAndUsageWithResources: OperationHandler = (input) => {
  validateTimePeriod(input);
  const tp = getTimePeriod(input);
  const granularity = String(input["Granularity"] ?? "DAILY");
  const metrics = Array.isArray(input["Metrics"])
    ? (input["Metrics"] as string[])
    : ["BlendedCost"];
  const groupBy = input["GroupBy"];
  const buckets = splitPeriod(tp.Start, tp.End, granularity);
  const groupDefs = Array.isArray(groupBy) ? groupBy : [];

  const resultsByTime = buckets.map((bucket) => {
    const groupKeys = groupKeysFromGroupBy(
      groupDefs.length > 0 ? groupDefs : undefined,
      bucket.Start,
    );
    const total = buildMetrics(metrics, bucket);
    const groups =
      groupDefs.length > 0
        ? groupKeys.map((keys) => ({
            Keys: keys,
            Metrics: buildMetrics(metrics, bucket, keys.join("|")),
          }))
        : [];
    return {
      TimePeriod: bucket,
      Total: total,
      Groups: groups,
      Estimated: false,
    };
  });

  return {
    ResultsByTime: resultsByTime,
    GroupDefinitions: groupDefs,
  };
};

const GetCostForecast: OperationHandler = (input) => {
  validateTimePeriod(input);
  const tp = getTimePeriod(input);
  const granularity = String(input["Granularity"] ?? "DAILY");
  const metric = String(input["Metric"] ?? "BLENDED_COST");
  const buckets = splitPeriod(tp.Start, tp.End, granularity);

  const forecastResultsByTime = buckets.map((bucket) => ({
    TimePeriod: bucket,
    MeanValue: syntheticAmount(`forecast|${metric}|${bucket.Start}`),
    PredictionIntervalLowerBound: undefined,
    PredictionIntervalUpperBound: undefined,
  }));

  const totalSeed = `forecast|total|${metric}|${tp.Start}|${tp.End}`;
  return {
    Total: { Amount: syntheticAmount(totalSeed), Unit: "USD" },
    ForecastResultsByTime: forecastResultsByTime,
  };
};

const GetUsageForecast: OperationHandler = (input) => {
  validateTimePeriod(input);
  const tp = getTimePeriod(input);
  const granularity = String(input["Granularity"] ?? "DAILY");
  const metric = String(input["Metric"] ?? "USAGE_QUANTITY");
  const buckets = splitPeriod(tp.Start, tp.End, granularity);

  const forecastResultsByTime = buckets.map((bucket) => ({
    TimePeriod: bucket,
    MeanValue: syntheticAmount(`usageforecast|${metric}|${bucket.Start}`),
    PredictionIntervalLowerBound: undefined,
    PredictionIntervalUpperBound: undefined,
  }));

  const totalSeed = `usageforecast|total|${metric}|${tp.Start}|${tp.End}`;
  return {
    Total: { Amount: syntheticAmount(totalSeed), Unit: "N/A" },
    ForecastResultsByTime: forecastResultsByTime,
  };
};

const GetDimensionValues: OperationHandler = (input) => {
  validateTimePeriod(input);
  const dimension = String(input["Dimension"] ?? "SERVICE");
  const nextToken = input["NextPageToken"];
  const maxResults = input["MaxResults"];
  const vals = dimensionValues(dimension);
  const { items, nextToken: newNext } = paginateList(
    vals,
    nextToken,
    maxResults,
    20,
  );

  return {
    DimensionValues: items.map((v) => ({
      Value: v,
      Attributes: {},
    })),
    ReturnSize: items.length,
    TotalSize: vals.length,
    NextPageToken: newNext,
  };
};

const GetTags: OperationHandler = (input) => {
  validateTimePeriod(input);
  const nextToken = input["NextPageToken"];
  const maxResults = input["MaxResults"];
  const tagKeys = ["Environment", "Project", "Team", "Owner", "CostCenter"];
  const { items, nextToken: newNext } = paginateList(
    tagKeys,
    nextToken,
    maxResults,
    20,
  );
  return {
    Tags: items,
    ReturnSize: items.length,
    TotalSize: tagKeys.length,
    NextPageToken: newNext,
  };
};

const GetCostCategories: OperationHandler = (input, ctx) => {
  validateTimePeriod(input);
  const nextToken = input["NextPageToken"];
  const maxResults = input["MaxResults"];
  const allKeys = ctx.store
    .list<StoredCostCategory>()
    .filter((e) => e.key.startsWith("cc/"))
    .map((e) => e.value.Name)
    .filter(Boolean);

  const { items, nextToken: newNext } = paginateList(
    allKeys,
    nextToken,
    maxResults,
    20,
  );
  return {
    CostCategoryNames: items,
    ReturnSize: items.length,
    TotalSize: allKeys.length,
    NextPageToken: newNext,
  };
};

const CreateCostCategoryDefinition: OperationHandler = (input, ctx) => {
  const name = String(input["Name"] ?? "");
  if (!name) throw awsError("ValidationException", "Name is required.", 400);
  const ruleVersion = String(
    input["RuleVersion"] ?? "CostCategoryExpression.v1",
  );
  const rules = input["Rules"] ?? [];
  const effectiveStart = String(
    input["EffectiveStart"] ?? `${todayYMD()}T00:00:00Z`,
  );
  const ccArn = arn("costcategory", name.replace(/\s+/g, "-").toLowerCase());

  const stored: StoredCostCategory = {
    CostCategoryArn: ccArn,
    Name: name,
    RuleVersion: ruleVersion,
    Rules: rules,
    EffectiveStart: effectiveStart,
    DefaultValue: input["DefaultValue"],
    SplitChargeRules: input["SplitChargeRules"],
    ProcessingStatus: [{ Component: "COST_EXPLORER", Status: "PROCESSING" }],
  };
  ctx.store.set(ccKey(ccArn), stored);
  return { CostCategoryArn: ccArn, EffectiveStart: effectiveStart };
};

const DeleteCostCategoryDefinition: OperationHandler = (input, ctx) => {
  const ccArn = String(input["CostCategoryArn"] ?? "");
  if (!ctx.store.get<StoredCostCategory>(ccKey(ccArn))) {
    throw awsError(
      "ResourceNotFoundException",
      `Cost category ${ccArn} does not exist.`,
      400,
    );
  }
  ctx.store.delete(ccKey(ccArn));
  return { CostCategoryArn: ccArn, EffectiveEnd: `${todayYMD()}T00:00:00Z` };
};

const DescribeCostCategoryDefinition: OperationHandler = (input, ctx) => {
  const ccArn = String(input["CostCategoryArn"] ?? "");
  const stored = ctx.store.get<StoredCostCategory>(ccKey(ccArn));
  if (!stored) {
    throw awsError(
      "ResourceNotFoundException",
      `Cost category ${ccArn} does not exist.`,
      400,
    );
  }
  return { CostCategory: stored };
};

const ListCostCategoryDefinitions: OperationHandler = (input, ctx) => {
  const nextToken = input["NextToken"];
  const maxResults = input["MaxResults"];
  const allCCs = ctx.store
    .list<StoredCostCategory>()
    .filter((e) => e.key.startsWith("cc/"))
    .map((e) => e.value);

  const { items, nextToken: newNext } = paginateList(
    allCCs,
    nextToken,
    maxResults,
    20,
  );
  return {
    CostCategoryReferences: items.map((cc) => ({
      CostCategoryArn: cc.CostCategoryArn,
      Name: cc.Name,
      EffectiveStart: cc.EffectiveStart,
      DefaultValue: cc.DefaultValue,
      ProcessingStatus: cc.ProcessingStatus,
    })),
    NextToken: newNext,
  };
};

const UpdateCostCategoryDefinition: OperationHandler = (input, ctx) => {
  const ccArn = String(input["CostCategoryArn"] ?? "");
  const stored = ctx.store.get<StoredCostCategory>(ccKey(ccArn));
  if (!stored) {
    throw awsError(
      "ResourceNotFoundException",
      `Cost category ${ccArn} does not exist.`,
      400,
    );
  }
  const ruleVersion = String(input["RuleVersion"] ?? stored.RuleVersion);
  const updated: StoredCostCategory = {
    ...stored,
    RuleVersion: ruleVersion,
    Rules: input["Rules"] ?? stored.Rules,
    DefaultValue: input["DefaultValue"] ?? stored.DefaultValue,
    SplitChargeRules: input["SplitChargeRules"] ?? stored.SplitChargeRules,
  };
  ctx.store.set(ccKey(ccArn), updated);
  return {
    CostCategoryArn: ccArn,
    EffectiveStart: updated.EffectiveStart,
  };
};

const ListCostCategoryResourceAssociations: OperationHandler = (input, ctx) => {
  const ccArn = String(input["CostCategoryArn"] ?? "");
  if (!ctx.store.get<StoredCostCategory>(ccKey(ccArn))) {
    throw awsError(
      "ResourceNotFoundException",
      `Cost category ${ccArn} does not exist.`,
      400,
    );
  }
  return { ResourceAssociations: [], NextToken: undefined };
};

const CreateAnomalyMonitor: OperationHandler = (input, ctx) => {
  const monitorInput = input["AnomalyMonitor"] as Record<string, unknown>;
  if (!monitorInput) {
    throw awsError("ValidationException", "AnomalyMonitor is required.", 400);
  }
  const name = String(monitorInput["MonitorName"] ?? "");
  if (!name)
    throw awsError("ValidationException", "MonitorName is required.", 400);
  const monitorType = String(monitorInput["MonitorType"] ?? "DIMENSIONAL");
  const monitorArn = arn(
    "anomalymonitor",
    name.replace(/\s+/g, "-").toLowerCase(),
  );
  const today = todayYMD();

  const stored: StoredAnomalyMonitor = {
    MonitorArn: monitorArn,
    MonitorName: name,
    MonitorType: monitorType,
    MonitorDimension: monitorInput["MonitorDimension"],
    MonitorSpecification: monitorInput["MonitorSpecification"],
    CreationDate: today,
    LastUpdatedDate: today,
    LastEvaluatedDate: today,
    DimensionalValueCount: 0,
  };
  ctx.store.set(monitorKey(monitorArn), stored);
  return { MonitorArn: monitorArn };
};

const DeleteAnomalyMonitor: OperationHandler = (input, ctx) => {
  const monitorArn = String(input["MonitorArn"] ?? "");
  if (!ctx.store.get<StoredAnomalyMonitor>(monitorKey(monitorArn))) {
    throw awsError(
      "UnknownMonitorException",
      `Monitor ${monitorArn} does not exist.`,
      400,
    );
  }
  ctx.store.delete(monitorKey(monitorArn));
  return {};
};

const GetAnomalyMonitors: OperationHandler = (input, ctx) => {
  const monitorArnList = input["MonitorArnList"];
  const nextToken = input["NextPageToken"];
  const maxResults = input["MaxResults"];

  let all = ctx.store
    .list<StoredAnomalyMonitor>()
    .filter((e) => e.key.startsWith("monitor/"))
    .map((e) => e.value);

  if (Array.isArray(monitorArnList) && monitorArnList.length > 0) {
    const arnSet = new Set(monitorArnList as string[]);
    all = all.filter((m) => arnSet.has(m.MonitorArn));
  }

  const { items, nextToken: newNext } = paginateList(
    all,
    nextToken,
    maxResults,
    100,
  );
  return { AnomalyMonitors: items, NextPageToken: newNext };
};

const UpdateAnomalyMonitor: OperationHandler = (input, ctx) => {
  const monitorArn = String(input["MonitorArn"] ?? "");
  const stored = ctx.store.get<StoredAnomalyMonitor>(monitorKey(monitorArn));
  if (!stored) {
    throw awsError(
      "UnknownMonitorException",
      `Monitor ${monitorArn} does not exist.`,
      400,
    );
  }
  const updated: StoredAnomalyMonitor = {
    ...stored,
    MonitorName: String(input["MonitorName"] ?? stored.MonitorName),
    LastUpdatedDate: todayYMD(),
  };
  ctx.store.set(monitorKey(monitorArn), updated);
  return { MonitorArn: monitorArn };
};

const CreateAnomalySubscription: OperationHandler = (input, ctx) => {
  const subInput = input["AnomalySubscription"] as Record<string, unknown>;
  if (!subInput) {
    throw awsError(
      "ValidationException",
      "AnomalySubscription is required.",
      400,
    );
  }
  const name = String(subInput["SubscriptionName"] ?? "");
  if (!name)
    throw awsError("ValidationException", "SubscriptionName is required.", 400);
  const subArn = arn(
    "anomalysubscription",
    name.replace(/\s+/g, "-").toLowerCase(),
  );

  const stored: StoredAnomalySubscription = {
    SubscriptionArn: subArn,
    SubscriptionName: name,
    MonitorArnList: Array.isArray(subInput["MonitorArnList"])
      ? (subInput["MonitorArnList"] as string[])
      : [],
    Subscribers: Array.isArray(subInput["Subscribers"])
      ? subInput["Subscribers"]
      : [],
    Threshold:
      typeof subInput["Threshold"] === "number" ? subInput["Threshold"] : 0,
    ThresholdExpression: subInput["ThresholdExpression"],
    Frequency: String(subInput["Frequency"] ?? "DAILY"),
  };
  ctx.store.set(subscriptionKey(subArn), stored);
  return { SubscriptionArn: subArn };
};

const DeleteAnomalySubscription: OperationHandler = (input, ctx) => {
  const subArn = String(input["SubscriptionArn"] ?? "");
  if (!ctx.store.get<StoredAnomalySubscription>(subscriptionKey(subArn))) {
    throw awsError(
      "UnknownSubscriptionException",
      `Subscription ${subArn} does not exist.`,
      400,
    );
  }
  ctx.store.delete(subscriptionKey(subArn));
  return {};
};

const GetAnomalySubscriptions: OperationHandler = (input, ctx) => {
  const subscriptionArnList = input["SubscriptionArnList"];
  const monitorArn = input["MonitorArn"];
  const nextToken = input["NextPageToken"];
  const maxResults = input["MaxResults"];

  let all = ctx.store
    .list<StoredAnomalySubscription>()
    .filter((e) => e.key.startsWith("subscription/"))
    .map((e) => e.value);

  if (Array.isArray(subscriptionArnList) && subscriptionArnList.length > 0) {
    const arnSet = new Set(subscriptionArnList as string[]);
    all = all.filter((s) => arnSet.has(s.SubscriptionArn));
  }

  if (typeof monitorArn === "string" && monitorArn !== "") {
    all = all.filter((s) => s.MonitorArnList.includes(monitorArn));
  }

  const { items, nextToken: newNext } = paginateList(
    all,
    nextToken,
    maxResults,
    100,
  );
  return { AnomalySubscriptions: items, NextPageToken: newNext };
};

const UpdateAnomalySubscription: OperationHandler = (input, ctx) => {
  const subArn = String(input["SubscriptionArn"] ?? "");
  const stored = ctx.store.get<StoredAnomalySubscription>(
    subscriptionKey(subArn),
  );
  if (!stored) {
    throw awsError(
      "UnknownSubscriptionException",
      `Subscription ${subArn} does not exist.`,
      400,
    );
  }
  const updated: StoredAnomalySubscription = {
    ...stored,
    SubscriptionName: String(
      input["SubscriptionName"] ?? stored.SubscriptionName,
    ),
    MonitorArnList: Array.isArray(input["MonitorArnList"])
      ? (input["MonitorArnList"] as string[])
      : stored.MonitorArnList,
    Subscribers: Array.isArray(input["Subscribers"])
      ? input["Subscribers"]
      : stored.Subscribers,
    Threshold:
      typeof input["Threshold"] === "number"
        ? input["Threshold"]
        : stored.Threshold,
    ThresholdExpression:
      input["ThresholdExpression"] ?? stored.ThresholdExpression,
    Frequency: String(input["Frequency"] ?? stored.Frequency),
  };
  ctx.store.set(subscriptionKey(subArn), updated);
  return { SubscriptionArn: subArn };
};

const ProvideAnomalyFeedback: OperationHandler = (input) => {
  const anomalyId = String(input["AnomalyId"] ?? "");
  if (!anomalyId)
    throw awsError("ValidationException", "AnomalyId is required.", 400);
  return { AnomalyId: anomalyId };
};

const GetAnomalies: OperationHandler = (input) => {
  const dateInterval = input["DateInterval"] as
    | Record<string, unknown>
    | undefined;
  if (
    !dateInterval ||
    typeof dateInterval["StartDate"] !== "string" ||
    typeof dateInterval["EndDate"] !== "string"
  ) {
    throw awsError("ValidationException", "DateInterval is required.", 400);
  }
  const nextToken = input["NextPageToken"];
  const maxResults = input["MaxResults"];
  const monitorArn = input["MonitorArn"];

  const anomalies: unknown[] = [];
  if (typeof monitorArn === "string" && monitorArn !== "") {
    const seed = `anomaly|${monitorArn}|${dateInterval["StartDate"]}`;
    const impact = (deterministicSeed(seed) % 10000) / 100;
    anomalies.push({
      AnomalyId: `anomaly-${deterministicSeed(seed).toString(16)}`,
      AnomalyStartDate: dateInterval["StartDate"],
      AnomalyEndDate: dateInterval["EndDate"],
      DimensionValue: "Amazon EC2",
      RootCauses: [
        {
          Service: "Amazon EC2",
          Region: region,
          LinkedAccount: accountId,
          UsageType: "BoxUsage:t3.micro",
        },
      ],
      AnomalyScore: {
        MaxScore: (deterministicSeed(seed + "max") % 100) / 100,
        CurrentScore: (deterministicSeed(seed + "cur") % 100) / 100,
      },
      Impact: {
        MaxImpact: impact,
        TotalActualSpend: impact * 1.5,
        TotalExpectedSpend: impact * 0.8,
        TotalImpact: impact * 0.7,
        TotalImpactPercentage: (deterministicSeed(seed + "pct") % 10000) / 100,
      },
      MonitorArn: monitorArn,
      Feedback: "PLANNED_ACTIVITY",
    });
  }

  const { items, nextToken: newNext } = paginateList(
    anomalies,
    nextToken,
    typeof maxResults === "number" ? maxResults : undefined,
    100,
  );
  return { Anomalies: items, NextPageToken: newNext };
};

const GetReservationCoverage: OperationHandler = (input) => {
  validateTimePeriod(input);
  const tp = getTimePeriod(input);
  const granularity = String(input["Granularity"] ?? "MONTHLY");
  const buckets = splitPeriod(tp.Start, tp.End, granularity);

  return {
    CoveragesByTime: buckets.map((bucket) => ({
      TimePeriod: bucket,
      Groups: [],
      Total: {
        CoverageHours: {
          OnDemandHours: syntheticAmount(`ri|ondemand|${bucket.Start}`),
          ReservedHours: syntheticAmount(`ri|reserved|${bucket.Start}`),
          TotalRunningHours: syntheticAmount(`ri|total|${bucket.Start}`),
          CoverageHoursPercentage: "75.00",
        },
        CoverageNormalizedUnits: {
          OnDemandNormalizedUnits: syntheticAmount(
            `ri|ndOndemand|${bucket.Start}`,
          ),
          ReservedNormalizedUnits: syntheticAmount(
            `ri|ndReserved|${bucket.Start}`,
          ),
          TotalRunningNormalizedUnits: syntheticAmount(
            `ri|ndTotal|${bucket.Start}`,
          ),
          CoverageNormalizedUnitsPercentage: "75.00",
        },
        CoverageCost: {
          OnDemandCost: syntheticAmount(`ri|cost|${bucket.Start}`),
        },
      },
    })),
    Total: {
      CoverageHours: {
        CoverageHoursPercentage: "75.00",
        OnDemandHours: "100",
        ReservedHours: "300",
        TotalRunningHours: "400",
      },
    },
  };
};

const GetReservationPurchaseRecommendation: OperationHandler = (input) => {
  const service = String(input["Service"] ?? "Amazon EC2");
  return {
    Metadata: {
      RecommendationId: `rec-${deterministicSeed(service).toString(16)}`,
      GenerationTimestamp: new Date().toISOString(),
    },
    Recommendations: [],
    NextPageToken: undefined,
  };
};

const GetReservationUtilization: OperationHandler = (input) => {
  validateTimePeriod(input);
  const tp = getTimePeriod(input);
  const granularity = String(input["Granularity"] ?? "MONTHLY");
  const buckets = splitPeriod(tp.Start, tp.End, granularity);

  return {
    UtilizationsByTime: buckets.map((bucket) => ({
      TimePeriod: bucket,
      Groups: [],
      Total: {
        UtilizationPercentage: "80.00",
        UtilizationPercentageInUnits: "80.00",
        PurchasedHours: syntheticAmount(`util|purchased|${bucket.Start}`),
        PurchasedUnits: syntheticAmount(`util|purchasedUnits|${bucket.Start}`),
        TotalActualHours: syntheticAmount(`util|actual|${bucket.Start}`),
        TotalActualUnits: syntheticAmount(`util|actualUnits|${bucket.Start}`),
        UnusedHours: syntheticAmount(`util|unused|${bucket.Start}`),
        UnusedUnits: syntheticAmount(`util|unusedUnits|${bucket.Start}`),
        OnDemandCostOfRIHoursUsed: syntheticAmount(
          `util|odcost|${bucket.Start}`,
        ),
        NetRISavings: syntheticAmount(`util|savings|${bucket.Start}`),
        TotalPotentialRISavings: syntheticAmount(
          `util|potential|${bucket.Start}`,
        ),
        AmortizedUpfrontFee: syntheticAmount(`util|upfront|${bucket.Start}`),
        AmortizedRecurringFee: syntheticAmount(
          `util|recurring|${bucket.Start}`,
        ),
        TotalAmortizedFee: syntheticAmount(`util|total|${bucket.Start}`),
        RICostForUnusedHours: syntheticAmount(`util|ricost|${bucket.Start}`),
        RealizedSavings: syntheticAmount(`util|realized|${bucket.Start}`),
        UnrealizedSavings: syntheticAmount(`util|unrealized|${bucket.Start}`),
      },
    })),
    Total: {
      UtilizationPercentage: "80.00",
    },
  };
};

const GetRightsizingRecommendation: OperationHandler = (input) => {
  const service = String(input["Service"] ?? "AmazonEC2");
  return {
    Metadata: {
      RecommendationId: `right-${deterministicSeed(service).toString(16)}`,
      GenerationTimestamp: new Date().toISOString(),
      LookbackPeriodInDays: "14",
      AdditionalMetadata: "{}",
    },
    Summary: {
      TotalRecommendationCount: "0",
      EstimatedTotalMonthlySavingsAmount: "0.00",
      SavingsCurrencyCode: "USD",
      SavingsPercentage: "0.00",
    },
    RightsizingRecommendations: [],
    NextPageToken: undefined,
  };
};

const GetSavingsPlansCoverage: OperationHandler = (input) => {
  validateTimePeriod(input);
  const tp = getTimePeriod(input);
  const granularity = String(input["Granularity"] ?? "MONTHLY");
  const buckets = splitPeriod(tp.Start, tp.End, granularity);

  return {
    SavingsPlansCoverages: buckets.map((bucket) => ({
      Attributes: {},
      Coverage: {
        SpendCoveredBySavingsPlans: syntheticAmount(
          `sp|covered|${bucket.Start}`,
        ),
        OnDemandCost: syntheticAmount(`sp|od|${bucket.Start}`),
        TotalCost: syntheticAmount(`sp|total|${bucket.Start}`),
        CoveragePercentage: "60.00",
      },
      TimePeriod: bucket,
    })),
    Total: {
      Coverage: {
        SpendCoveredBySavingsPlans: "100.00",
        OnDemandCost: "66.67",
        TotalCost: "166.67",
        CoveragePercentage: "60.00",
      },
    },
  };
};

const GetSavingsPlansPurchaseRecommendation: OperationHandler = (input) => {
  const savingsPlansType = String(input["SavingsPlansType"] ?? "COMPUTE_SP");
  return {
    Metadata: {
      RecommendationId: `sprec-${deterministicSeed(savingsPlansType).toString(16)}`,
      GenerationTimestamp: new Date().toISOString(),
      AdditionalMetadata: "{}",
    },
    SavingsPlansPurchaseRecommendation: {
      AccountScope: "PAYER",
      SavingsPlansType: savingsPlansType,
      TermInYears: "ONE_YEAR",
      PaymentOption: "NO_UPFRONT",
      LookbackPeriodInDays: "THIRTY_DAYS",
      SavingsPlansPurchaseRecommendationDetails: [],
      SavingsPlansPurchaseRecommendationSummary: {
        EstimatedROI: "15.00",
        CurrencyCode: "USD",
        EstimatedTotalCost: "0.00",
        CurrentOnDemandSpend: "0.00",
        EstimatedSavingsAmount: "0.00",
        TotalRecommendationCount: "0",
        DailyCommitmentToPurchase: "0.00",
        HourlyCommitmentToPurchase: "0.00",
        EstimatedSavingsPercentage: "0.00",
        EstimatedMonthlySavingsAmount: "0.00",
        EstimatedOnDemandCostWithCurrentCommitment: "0.00",
      },
    },
    NextPageToken: undefined,
  };
};

const GetSavingsPlansUtilization: OperationHandler = (input) => {
  validateTimePeriod(input);
  const tp = getTimePeriod(input);
  const granularity = input["Granularity"];
  const buckets = granularity
    ? splitPeriod(tp.Start, tp.End, String(granularity))
    : null;

  const totalUtilization = {
    TotalCommitment: syntheticAmount(`spu|total|${tp.Start}`),
    UsedCommitment: syntheticAmount(`spu|used|${tp.Start}`),
    UnusedCommitment: syntheticAmount(`spu|unused|${tp.Start}`),
    UtilizationPercentage: "80.00",
  };

  const result: Record<string, unknown> = {
    Total: {
      Utilization: totalUtilization,
      Savings: {
        NetSavings: syntheticAmount(`spu|savings|${tp.Start}`),
        OnDemandCostEquivalent: syntheticAmount(`spu|odev|${tp.Start}`),
      },
      AmortizedCommitment: {
        AmortizedRecurringCommitment: syntheticAmount(`spu|arec|${tp.Start}`),
        AmortizedUpfrontCommitment: syntheticAmount(`spu|aup|${tp.Start}`),
        TotalAmortizedCommitment: syntheticAmount(`spu|atotal|${tp.Start}`),
      },
    },
  };

  if (buckets) {
    result["SavingsPlansUtilizationsByTime"] = buckets.map((bucket) => ({
      TimePeriod: bucket,
      Utilization: {
        TotalCommitment: syntheticAmount(`spu|tc|${bucket.Start}`),
        UsedCommitment: syntheticAmount(`spu|uc|${bucket.Start}`),
        UnusedCommitment: syntheticAmount(`spu|un|${bucket.Start}`),
        UtilizationPercentage: "80.00",
      },
      Savings: {
        NetSavings: syntheticAmount(`spu|ns|${bucket.Start}`),
        OnDemandCostEquivalent: syntheticAmount(`spu|od|${bucket.Start}`),
      },
      AmortizedCommitment: {
        AmortizedRecurringCommitment: syntheticAmount(
          `spu|arc|${bucket.Start}`,
        ),
        AmortizedUpfrontCommitment: syntheticAmount(`spu|auc|${bucket.Start}`),
        TotalAmortizedCommitment: syntheticAmount(`spu|tac|${bucket.Start}`),
      },
    }));
  }

  return result;
};

const GetSavingsPlansUtilizationDetails: OperationHandler = (input) => {
  validateTimePeriod(input);
  const tp = getTimePeriod(input);
  const nextToken = input["NextPageToken"];
  const maxResults = input["MaxResults"];
  const { items, nextToken: newNext } = paginateList(
    [],
    nextToken,
    maxResults,
    100,
  );
  return {
    SavingsPlansUtilizationDetails: items,
    Total: {
      Utilization: {
        TotalCommitment: syntheticAmount(`spud|total|${tp.Start}`),
        UtilizationPercentage: "80.00",
        UsedCommitment: "0",
        UnusedCommitment: "0",
      },
      Savings: {
        NetSavings: "0.00",
        OnDemandCostEquivalent: "0.00",
      },
      AmortizedCommitment: {
        AmortizedRecurringCommitment: "0.00",
        AmortizedUpfrontCommitment: "0.00",
        TotalAmortizedCommitment: "0.00",
      },
    },
    TimePeriod: tp,
    NextPageToken: newNext,
  };
};

const GetSavingsPlanPurchaseRecommendationDetails: OperationHandler = (
  input,
) => {
  const recommendationDetailId = String(input["RecommendationDetailId"] ?? "");
  return {
    RecommendationDetailId: recommendationDetailId,
    RecommendationDetailData: {
      AccountId: accountId,
      AccountScope: "PAYER",
      HourlyCommitmentToPurchase: "0.00",
      EstimatedAverageCoverage: "0.00",
      EstimatedMonthlySavingsAmount: "0.00",
      EstimatedOnDemandCost: "0.00",
      EstimatedOnDemandCostWithCurrentCommitment: "0.00",
      EstimatedROI: "0.00",
      EstimatedSPCost: "0.00",
      EstimatedSavingsAmount: "0.00",
      EstimatedSavingsPercentage: "0.00",
      ExistingHourlyCommitment: "0.00",
      GenerationTimestamp: new Date().toISOString(),
      LatestUsageTimestamp: new Date().toISOString(),
      LookbackPeriodInDays: "30",
      MetricsOverLookbackPeriod: [],
      OfferingId: recommendationDetailId,
      PaymentOption: "NO_UPFRONT",
      Region: region,
      SavingsPlansType: "COMPUTE_SP",
      TermInYears: "ONE_YEAR",
      UpfrontCost: "0.00",
    },
  };
};

const GetApproximateUsageRecords: OperationHandler = (input) => {
  const granularity = String(input["Granularity"] ?? "MONTHLY");
  const services = Array.isArray(input["Services"])
    ? (input["Services"] as string[])
    : SERVICE_VALUES.slice(0, 3);

  const records: Record<string, number> = {};
  for (const svc of services) {
    records[svc] = deterministicSeed(`approx|${granularity}|${svc}`) % 1000;
  }
  return {
    Services: records,
    TotalRecords: Object.values(records).reduce((a, b) => a + b, 0),
    LookbackPeriod: {
      Start: addMonths(todayYMD(), -3),
      End: todayYMD(),
    },
  };
};

const GetCommitmentPurchaseAnalysis: OperationHandler = (input) => {
  const analysisId = String(input["AnalysisId"] ?? "");
  return {
    EstimatedCompletionTime: new Date().toISOString(),
    AnalysisCompletionTime: new Date().toISOString(),
    AnalysisStartedTime: new Date().toISOString(),
    AnalysisStatus: "SUCCEEDED",
    ErrorCode: undefined,
    AnalysisId: analysisId,
    CommitmentPurchaseAnalysisConfiguration:
      input["CommitmentPurchaseAnalysisConfiguration"],
    AnalysisDetails: {
      SavingsPlansAnalysisDetails: {
        StrategyList: [],
      },
    },
  };
};

const ListCommitmentPurchaseAnalyses: OperationHandler = (input) => {
  const nextToken = input["NextPageToken"];
  const pageSize = input["PageSize"];
  const { items, nextToken: newNext } = paginateList(
    [],
    nextToken,
    pageSize,
    20,
  );
  return { AnalysisSummaryList: items, NextPageToken: newNext };
};

const StartCommitmentPurchaseAnalysis: OperationHandler = (input) => {
  const config = input["CommitmentPurchaseAnalysisConfiguration"];
  const seed = `cpa|${JSON.stringify(config)}`;
  const analysisId = deterministicSeed(seed).toString(16).padStart(32, "0");
  return {
    AnalysisId: analysisId,
    AnalysisStartedTime: new Date().toISOString(),
    EstimatedCompletionTime: new Date().toISOString(),
  };
};

const GetCostAndUsageComparisons: OperationHandler = (input) => {
  validateTimePeriod(input);
  const tp = getTimePeriod(input);
  const nextToken = input["NextPageToken"];
  const maxResults = input["MaxResults"];
  const { items, nextToken: newNext } = paginateList(
    [],
    nextToken,
    maxResults,
    20,
  );
  return {
    CostAndUsageComparisons: items,
    BasePeriod: tp,
    ComparisonPeriod: tp,
    NextPageToken: newNext,
  };
};

const GetCostComparisonDrivers: OperationHandler = (input) => {
  validateTimePeriod(input);
  const nextToken = input["NextPageToken"];
  const maxResults = input["MaxResults"];
  const { items, nextToken: newNext } = paginateList(
    [],
    nextToken,
    maxResults,
    20,
  );
  return { CostComparisonDrivers: items, NextPageToken: newNext };
};

const ListCostAllocationTagBackfillHistory: OperationHandler = (input) => {
  const nextToken = input["NextToken"];
  const maxResults = input["MaxResults"];
  const { items, nextToken: newNext } = paginateList(
    [],
    nextToken,
    maxResults,
    100,
  );
  return { BackfillRequests: items, NextToken: newNext };
};

const ListCostAllocationTags: OperationHandler = (input) => {
  const nextToken = input["NextToken"];
  const maxResults = input["MaxResults"];
  const status = input["Status"];
  const tagKeys = input["TagKeys"];

  const tags = ["Environment", "Project", "Team", "Owner", "CostCenter"].map(
    (k) => ({
      TagKey: k,
      Type: "UserDefined",
      Status: "Active",
      LastUpdatedDate: todayYMD(),
      LastUsedDate: todayYMD(),
    }),
  );

  let filtered = tags;
  if (typeof status === "string") {
    filtered = filtered.filter((t) => t.Status === status);
  }
  if (Array.isArray(tagKeys) && tagKeys.length > 0) {
    const ks = new Set(tagKeys as string[]);
    filtered = filtered.filter((t) => ks.has(t.TagKey));
  }

  const { items, nextToken: newNext } = paginateList(
    filtered,
    nextToken,
    maxResults,
    100,
  );
  return { CostAllocationTags: items, NextToken: newNext };
};

const StartCostAllocationTagBackfill: OperationHandler = (input) => {
  const backfillFrom = String(input["BackfillFrom"] ?? "");
  return {
    BackfillRequest: {
      BackfillFrom: backfillFrom,
      RequestedAt: new Date().toISOString(),
      CompletedAt: undefined,
      BackfillStatus: "PROCESSING",
      LastUpdatedAt: new Date().toISOString(),
    },
  };
};

const UpdateCostAllocationTagsStatus: OperationHandler = (input) => {
  const costAllocationTagsStatus = input["CostAllocationTagsStatus"];
  return { Errors: [] };
};

const ListSavingsPlansPurchaseRecommendationGeneration: OperationHandler = (
  input,
) => {
  const nextToken = input["NextPageToken"];
  const { items, nextToken: newNext } = paginateList(
    [],
    nextToken,
    undefined,
    20,
  );
  return { GenerationSummaryList: items, NextPageToken: newNext };
};

const StartSavingsPlansPurchaseRecommendationGeneration: OperationHandler = (
  _input,
) => {
  const estimatedCompletionTime = new Date(Date.now() + 300000).toISOString();
  return {
    RecommendationId: `sprgen-${Date.now().toString(16)}`,
    GenerationStartedTime: new Date().toISOString(),
    EstimatedCompletionTime: estimatedCompletionTime,
  };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = String(input["ResourceArn"] ?? "");
  const tags = ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  return {
    ResourceTags: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = String(input["ResourceArn"] ?? "");
  const resourceTags = input["ResourceTags"];
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  if (Array.isArray(resourceTags)) {
    for (const tag of resourceTags as Array<{
      Key: string;
      Value: string;
    }>) {
      existing[tag.Key] = tag.Value;
    }
  }
  ctx.store.set(tagKey(resourceArn), existing);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = String(input["ResourceArn"] ?? "");
  const tagKeys = input["ResourceTagKeys"];
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  if (Array.isArray(tagKeys)) {
    for (const k of tagKeys as string[]) {
      delete existing[k];
    }
  }
  ctx.store.set(tagKey(resourceArn), existing);
  return {};
};

const ce = {
  name: "ce",
  protocol: "json",
  model,
  operations: {
    GetCostAndUsage,
    GetCostAndUsageWithResources,
    GetCostForecast,
    GetUsageForecast,
    GetDimensionValues,
    GetTags,
    GetCostCategories,
    CreateCostCategoryDefinition,
    DeleteCostCategoryDefinition,
    DescribeCostCategoryDefinition,
    ListCostCategoryDefinitions,
    UpdateCostCategoryDefinition,
    ListCostCategoryResourceAssociations,
    CreateAnomalyMonitor,
    DeleteAnomalyMonitor,
    GetAnomalyMonitors,
    UpdateAnomalyMonitor,
    CreateAnomalySubscription,
    DeleteAnomalySubscription,
    GetAnomalySubscriptions,
    UpdateAnomalySubscription,
    ProvideAnomalyFeedback,
    GetAnomalies,
    GetReservationCoverage,
    GetReservationPurchaseRecommendation,
    GetReservationUtilization,
    GetRightsizingRecommendation,
    GetSavingsPlansCoverage,
    GetSavingsPlansPurchaseRecommendation,
    GetSavingsPlansUtilization,
    GetSavingsPlansUtilizationDetails,
    GetSavingsPlanPurchaseRecommendationDetails,
    GetApproximateUsageRecords,
    GetCommitmentPurchaseAnalysis,
    ListCommitmentPurchaseAnalyses,
    StartCommitmentPurchaseAnalysis,
    GetCostAndUsageComparisons,
    GetCostComparisonDrivers,
    ListCostAllocationTagBackfillHistory,
    ListCostAllocationTags,
    StartCostAllocationTagBackfill,
    UpdateCostAllocationTagsStatus,
    ListSavingsPlansPurchaseRecommendationGeneration,
    StartSavingsPlansPurchaseRecommendationGeneration,
    ListTagsForResource,
    TagResource,
    UntagResource,
  },
} as const satisfies ServiceDefinition;

export default ce;
