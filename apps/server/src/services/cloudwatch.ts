import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import cloudwatchModel from "../../../../test/vendor/aws-models/cloudwatch.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(cloudwatchModel);

type Dimension = {
  Name: string;
  Value: string;
};

type StoredPoint = {
  Timestamp: number;
  Value: number;
  Unit: string;
};

type StoredSeries = {
  Namespace: string;
  MetricName: string;
  Dimensions: Dimension[];
  Unit: string;
  Points: StoredPoint[];
};

type StoredAlarm = {
  AlarmName: string;
  AlarmArn: string;
  AlarmDescription: string;
  ActionsEnabled: boolean;
  MetricName: string;
  Namespace: string;
  Statistic: string;
  Period: number;
  EvaluationPeriods: number;
  Threshold: number;
  ComparisonOperator: string;
  Dimensions: Dimension[];
  StateValue: string;
  StateReason: string;
  ConfigurationUpdated: number;
};

type StoredAlarmHistoryItem = {
  AlarmName: string;
  AlarmType: string;
  HistoryItemType: string;
  HistorySummary: string;
  Timestamp: number;
};

type StoredCompositeAlarm = {
  AlarmName: string;
  AlarmArn: string;
  AlarmDescription: string;
  ActionsEnabled: boolean;
  AlarmRule: string;
  AlarmActions: string[];
  OKActions: string[];
  InsufficientDataActions: string[];
  StateValue: string;
  ConfigurationUpdated: number;
};

type StoredAnomalyDetector = {
  Arn: string;
  detectorKey: string;
  Namespace: string;
  MetricName: string;
  Stat: string;
  Dimensions: Dimension[];
  Configuration: unknown;
  StateValue: string;
  MetricCharacteristics: unknown;
  SingleMetricAnomalyDetector: unknown;
  MetricMathAnomalyDetector: unknown;
};

type StoredInsightRule = {
  Name: string;
  State: string;
  Schema: string;
  Definition: string;
  ManagedRule: boolean;
  ApplyOnTransformedLogs: boolean;
};

type StoredMetricStream = {
  Name: string;
  Arn: string;
  FirehoseArn: string;
  RoleArn: string;
  OutputFormat: string;
  IncludeFilters: unknown[];
  ExcludeFilters: unknown[];
  StatisticsConfigurations: unknown[];
  IncludeLinkedAccountsMetrics: boolean;
  State: string;
  CreationDate: number;
  LastUpdateDate: number;
};

type StoredMuteRule = {
  Name: string;
  AlarmMuteRuleArn: string;
  Description: string;
  Rule: unknown;
  MuteTargets: unknown;
  StartDate: string;
  ExpireDate: string;
  Status: string;
  LastUpdatedTimestamp: number;
  MuteType: string;
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("MissingParameter", `${key} is required.`, 400);
  }
  return value;
};

const requireNumber = (input: Record<string, unknown>, key: string): number => {
  const value = input[key];
  if (typeof value !== "number") {
    throw awsError("MissingParameter", `${key} is required.`, 400);
  }
  return value;
};

const toDimensions = (raw: unknown): Dimension[] => {
  if (!Array.isArray(raw)) return [];
  const out: Dimension[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const name = record["Name"];
    const value = record["Value"];
    if (typeof name === "string" && typeof value === "string") {
      out.push({ Name: name, Value: value });
    }
  }
  return out.sort((a, b) => a.Name.localeCompare(b.Name));
};

const dimensionToken = (dimensions: Dimension[]): string =>
  dimensions.map((d) => `${d.Name}=${d.Value}`).join("&");

const seriesKey = (
  namespace: string,
  metricName: string,
  dimensions: Dimension[],
): string => `metric/${namespace}/${metricName}/${dimensionToken(dimensions)}`;

type StoredDashboard = {
  DashboardName: string;
  DashboardArn: string;
  DashboardBody: string;
  LastModified: number;
  Size: number;
};

const alarmKey = (name: string): string => `alarm/${name}`;

const compositeAlarmKey = (name: string): string => `composite-alarm/${name}`;

const alarmHistoryKeyOf = (name: string, ts: number): string =>
  `alarm-history/${name}/${ts}`;

const dashboardKey = (name: string): string => `dashboard/${name}`;

const anomalyDetectorKey = (key: string): string => `anomaly-detector/${key}`;

const insightRuleKey = (name: string): string => `insight-rule/${name}`;

const metricStreamKey = (name: string): string => `metric-stream/${name}`;

const muteRuleKey = (name: string): string => `mute-rule/${name}`;

const managedRuleKey = (resourceArn: string, templateName: string): string =>
  `managed-rule/${resourceArn}/${templateName}`;

const tagsKey = (arn: string): string => `tags/${arn}`;

const alarmArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:cloudwatch:${region}:${account}:alarm:${name}`;

const dashboardArnOf = (account: string, name: string): string =>
  `arn:aws:cloudwatch::${account}:dashboard/${name}`;

const metricStreamArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:cloudwatch:${region}:${account}:metric-stream/${name}`;

const muteRuleArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:cloudwatch:${region}:${account}:alarm-mute-rule:${name}`;

const anomalyDetectorArnOf = (
  region: string,
  account: string,
  key: string,
): string =>
  `arn:aws:cloudwatch:${region}:${account}:anomaly-detector:${encodeURIComponent(key)}`;

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
  defaultPageSize = 100,
): { items: T[]; nextToken: string | undefined } => {
  const pageSize =
    typeof maxResults === "number" && maxResults > 0
      ? maxResults
      : defaultPageSize;
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

const storeTags = (
  ctx: ServiceContext,
  arn: string,
  rawTags: unknown,
): void => {
  if (!Array.isArray(rawTags)) return;
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  for (const tag of rawTags) {
    if (typeof tag !== "object" || tag === null) continue;
    const t = tag as Record<string, unknown>;
    const k = typeof t["Key"] === "string" ? (t["Key"] as string) : "";
    const v = typeof t["Value"] === "string" ? (t["Value"] as string) : "";
    if (k !== "") existing[k] = v;
  }
  ctx.store.set(tagsKey(arn), existing);
};

const anomalyDetectorKeyFromInput = (
  input: Record<string, unknown>,
): string => {
  const singleMetric = input["SingleMetricAnomalyDetector"];
  if (typeof singleMetric === "object" && singleMetric !== null) {
    const s = singleMetric as Record<string, unknown>;
    const ns = typeof s["Namespace"] === "string" ? s["Namespace"] : "";
    const mn = typeof s["MetricName"] === "string" ? s["MetricName"] : "";
    const stat = typeof s["Stat"] === "string" ? s["Stat"] : "";
    const dims = toDimensions(s["Dimensions"]);
    return `single/${ns}/${mn}/${stat}/${dimensionToken(dims)}`;
  }
  const mathDetector = input["MetricMathAnomalyDetector"];
  if (typeof mathDetector === "object" && mathDetector !== null) {
    const md = mathDetector as Record<string, unknown>;
    const queries = md["MetricDataQueries"];
    return `math/${JSON.stringify(queries)}`;
  }
  const ns = typeof input["Namespace"] === "string" ? input["Namespace"] : "";
  const mn = typeof input["MetricName"] === "string" ? input["MetricName"] : "";
  const stat = typeof input["Stat"] === "string" ? input["Stat"] : "";
  const dims = toDimensions(input["Dimensions"]);
  return `single/${ns}/${mn}/${stat}/${dimensionToken(dims)}`;
};

const PutMetricData: OperationHandler = (input, ctx) => {
  const namespace = requireString(input, "Namespace");
  const metricData = input["MetricData"];
  if (!Array.isArray(metricData)) {
    throw awsError("MissingParameter", "MetricData is required.", 400);
  }
  for (const entry of metricData) {
    if (typeof entry !== "object" || entry === null) continue;
    const datum = entry as Record<string, unknown>;
    const metricName = datum["MetricName"];
    if (typeof metricName !== "string" || metricName === "") {
      throw awsError("MissingParameter", "MetricName is required.", 400);
    }
    const dimensions = toDimensions(datum["Dimensions"]);
    const unit = typeof datum["Unit"] === "string" ? datum["Unit"] : "None";
    const timestamp =
      typeof datum["Timestamp"] === "number"
        ? datum["Timestamp"]
        : Math.floor(Date.now() / 1000);
    const value =
      typeof datum["Value"] === "number" ? datum["Value"] : undefined;
    if (value === undefined) continue;
    const key = seriesKey(namespace, metricName, dimensions);
    const existing = ctx.store.get<StoredSeries>(key);
    const series: StoredSeries = existing ?? {
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      Unit: unit,
      Points: [],
    };
    series.Unit = unit;
    series.Points.push({ Timestamp: timestamp, Value: value, Unit: unit });
    ctx.store.set(key, series);
  }
  return {};
};

const computeStatistic = (statistic: string, values: number[]): number => {
  if (statistic === "SampleCount") return values.length;
  if (statistic === "Sum") return values.reduce((acc, v) => acc + v, 0);
  if (statistic === "Minimum") return Math.min(...values);
  if (statistic === "Maximum") return Math.max(...values);
  return values.reduce((acc, v) => acc + v, 0) / values.length;
};

const compareThreshold = (
  op: string,
  value: number,
  threshold: number,
): boolean => {
  if (op === "GreaterThanThreshold") return value > threshold;
  if (op === "GreaterThanOrEqualToThreshold") return value >= threshold;
  if (op === "LessThanThreshold") return value < threshold;
  if (op === "LessThanOrEqualToThreshold") return value <= threshold;
  return false;
};

const evaluateMetricAlarmState = (
  alarm: StoredAlarm,
  ctx: ServiceContext,
): string => {
  if (
    !alarm.MetricName ||
    !alarm.Namespace ||
    !alarm.Statistic ||
    alarm.Period <= 0 ||
    alarm.EvaluationPeriods <= 0
  ) {
    return alarm.StateValue;
  }
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - alarm.EvaluationPeriods * alarm.Period;
  const series = ctx.store.get<StoredSeries>(
    seriesKey(alarm.Namespace, alarm.MetricName, alarm.Dimensions),
  );
  const points = (series?.Points ?? []).filter(
    (p) => p.Timestamp >= windowStart && p.Timestamp <= now,
  );
  if (points.length === 0) return alarm.StateValue;
  const values = points.map((p) => p.Value);
  const stat = computeStatistic(alarm.Statistic, values);
  return compareThreshold(alarm.ComparisonOperator, stat, alarm.Threshold)
    ? "ALARM"
    : "OK";
};

const GetMetricStatistics: OperationHandler = (input, ctx) => {
  const namespace = requireString(input, "Namespace");
  const metricName = requireString(input, "MetricName");
  requireNumber(input, "StartTime");
  requireNumber(input, "EndTime");
  const startTime = input["StartTime"] as number;
  const endTime = input["EndTime"] as number;
  const period = requireNumber(input, "Period");
  const dimensions = toDimensions(input["Dimensions"]);
  const statistics = Array.isArray(input["Statistics"])
    ? (input["Statistics"] as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : ["Average"];
  const series = ctx.store.get<StoredSeries>(
    seriesKey(namespace, metricName, dimensions),
  );
  const points = (series?.Points ?? []).filter(
    (point) => point.Timestamp >= startTime && point.Timestamp < endTime,
  );
  const buckets = new Map<number, number[]>();
  for (const point of points) {
    const bucketStart =
      startTime + Math.floor((point.Timestamp - startTime) / period) * period;
    const existing = buckets.get(bucketStart) ?? [];
    existing.push(point.Value);
    buckets.set(bucketStart, existing);
  }
  const unit = series?.Unit ?? "None";
  const datapoints = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucketStart, values]) => {
      const datapoint: Record<string, unknown> = {
        Timestamp: bucketStart,
        Unit: unit,
      };
      for (const statistic of statistics) {
        datapoint[statistic] = computeStatistic(statistic, values);
      }
      return datapoint;
    });
  return { Label: metricName, Datapoints: datapoints };
};

const ListMetrics: OperationHandler = (input, ctx) => {
  const namespaceFilter =
    typeof input["Namespace"] === "string"
      ? (input["Namespace"] as string)
      : undefined;
  const metricNameFilter =
    typeof input["MetricName"] === "string"
      ? (input["MetricName"] as string)
      : undefined;
  const dimensionsFilter = toDimensions(input["Dimensions"]);
  const allMetrics = ctx.store
    .list<StoredSeries>()
    .filter((entry) => entry.key.startsWith("metric/"))
    .filter(
      (entry) =>
        namespaceFilter === undefined ||
        entry.value.Namespace === namespaceFilter,
    )
    .filter(
      (entry) =>
        metricNameFilter === undefined ||
        entry.value.MetricName === metricNameFilter,
    )
    .filter(
      (entry) =>
        dimensionsFilter.length === 0 ||
        dimensionsFilter.every((df) =>
          entry.value.Dimensions.some(
            (d) => d.Name === df.Name && d.Value === df.Value,
          ),
        ),
    )
    .map((entry) => ({
      Namespace: entry.value.Namespace,
      MetricName: entry.value.MetricName,
      Dimensions: entry.value.Dimensions,
    }));
  const { items, nextToken } = paginateList(
    allMetrics,
    input["NextToken"],
    input["MaxResults"],
  );
  return { Metrics: items, NextToken: nextToken };
};

const PutMetricAlarm: OperationHandler = (input, ctx) => {
  const alarmName = requireString(input, "AlarmName");
  const dimensions = toDimensions(input["Dimensions"]);
  const alarm: StoredAlarm = {
    AlarmName: alarmName,
    AlarmArn: alarmArnOf(ctx.region, ctx.account, alarmName),
    AlarmDescription:
      typeof input["AlarmDescription"] === "string"
        ? (input["AlarmDescription"] as string)
        : "",
    ActionsEnabled:
      typeof input["ActionsEnabled"] === "boolean"
        ? (input["ActionsEnabled"] as boolean)
        : true,
    MetricName:
      typeof input["MetricName"] === "string"
        ? (input["MetricName"] as string)
        : "",
    Namespace:
      typeof input["Namespace"] === "string"
        ? (input["Namespace"] as string)
        : "",
    Statistic:
      typeof input["Statistic"] === "string"
        ? (input["Statistic"] as string)
        : "",
    Period:
      typeof input["Period"] === "number" ? (input["Period"] as number) : 0,
    EvaluationPeriods:
      typeof input["EvaluationPeriods"] === "number"
        ? (input["EvaluationPeriods"] as number)
        : 0,
    Threshold:
      typeof input["Threshold"] === "number"
        ? (input["Threshold"] as number)
        : 0,
    ComparisonOperator:
      typeof input["ComparisonOperator"] === "string"
        ? (input["ComparisonOperator"] as string)
        : "",
    Dimensions: dimensions,
    StateValue: "INSUFFICIENT_DATA",
    StateReason: "Unchecked: Initial alarm creation",
    ConfigurationUpdated: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(alarmKey(alarmName), alarm);
  storeTags(ctx, alarm.AlarmArn, input["Tags"]);
  return {};
};

const toMetricAlarm = (alarm: StoredAlarm): Record<string, unknown> => ({
  AlarmName: alarm.AlarmName,
  AlarmArn: alarm.AlarmArn,
  AlarmDescription: alarm.AlarmDescription,
  AlarmConfigurationUpdatedTimestamp: alarm.ConfigurationUpdated,
  ActionsEnabled: alarm.ActionsEnabled,
  StateValue: alarm.StateValue,
  StateReason: alarm.StateReason,
  StateUpdatedTimestamp: alarm.ConfigurationUpdated,
  MetricName: alarm.MetricName,
  Namespace: alarm.Namespace,
  Statistic: alarm.Statistic,
  Dimensions: alarm.Dimensions,
  Period: alarm.Period,
  EvaluationPeriods: alarm.EvaluationPeriods,
  Threshold: alarm.Threshold,
  ComparisonOperator: alarm.ComparisonOperator,
});

const toCompositeAlarm = (
  alarm: StoredCompositeAlarm,
): Record<string, unknown> => ({
  AlarmName: alarm.AlarmName,
  AlarmArn: alarm.AlarmArn,
  AlarmDescription: alarm.AlarmDescription,
  AlarmConfigurationUpdatedTimestamp: alarm.ConfigurationUpdated,
  ActionsEnabled: alarm.ActionsEnabled,
  AlarmRule: alarm.AlarmRule,
  AlarmActions: alarm.AlarmActions,
  OKActions: alarm.OKActions,
  InsufficientDataActions: alarm.InsufficientDataActions,
  StateValue: alarm.StateValue,
  StateReason: "",
  StateUpdatedTimestamp: alarm.ConfigurationUpdated,
});

const extractAlarmNamesFromRule = (rule: string): Set<string> => {
  const matches = rule.matchAll(/(ALARM|OK|INSUFFICIENT_DATA)\(([^)]+)\)/g);
  return new Set([...matches].map((m) => m[2]));
};

const DescribeAlarms: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["AlarmNames"])
    ? (input["AlarmNames"] as unknown[]).filter(
        (n): n is string => typeof n === "string",
      )
    : undefined;
  const prefix =
    typeof input["AlarmNamePrefix"] === "string"
      ? (input["AlarmNamePrefix"] as string)
      : undefined;
  const alarmTypes = Array.isArray(input["AlarmTypes"])
    ? (input["AlarmTypes"] as unknown[]).filter(
        (t): t is string => typeof t === "string",
      )
    : ["MetricAlarm", "CompositeAlarm"];
  const stateValue =
    typeof input["StateValue"] === "string"
      ? (input["StateValue"] as string)
      : undefined;
  const childrenOf =
    typeof input["ChildrenOfAlarmName"] === "string"
      ? (input["ChildrenOfAlarmName"] as string)
      : undefined;
  const parentsOf =
    typeof input["ParentsOfAlarmName"] === "string"
      ? (input["ParentsOfAlarmName"] as string)
      : undefined;

  let childNames: Set<string> | undefined;
  if (childrenOf !== undefined) {
    const parentAlarm = ctx.store.get<StoredCompositeAlarm>(
      compositeAlarmKey(childrenOf),
    );
    childNames =
      parentAlarm !== undefined
        ? extractAlarmNamesFromRule(parentAlarm.AlarmRule)
        : new Set<string>();
  }

  const metricAlarms = alarmTypes.includes("MetricAlarm")
    ? ctx.store
        .list<StoredAlarm>()
        .filter((entry) => entry.key.startsWith("alarm/"))
        .filter(
          (entry) =>
            names === undefined || names.includes(entry.value.AlarmName),
        )
        .filter(
          (entry) =>
            prefix === undefined || entry.value.AlarmName.startsWith(prefix),
        )
        .filter(
          (entry) =>
            stateValue === undefined || entry.value.StateValue === stateValue,
        )
        .filter(
          (entry) =>
            childNames === undefined || childNames.has(entry.value.AlarmName),
        )
        .map((entry) => {
          const alarm = entry.value;
          const evaluated = evaluateMetricAlarmState(alarm, ctx);
          if (evaluated !== alarm.StateValue) {
            alarm.StateValue = evaluated;
            ctx.store.set(entry.key, alarm);
          }
          return toMetricAlarm(alarm);
        })
    : [];

  const compositeAlarms = alarmTypes.includes("CompositeAlarm")
    ? ctx.store
        .list<StoredCompositeAlarm>()
        .filter((entry) => entry.key.startsWith("composite-alarm/"))
        .filter(
          (entry) =>
            names === undefined || names.includes(entry.value.AlarmName),
        )
        .filter(
          (entry) =>
            prefix === undefined || entry.value.AlarmName.startsWith(prefix),
        )
        .filter(
          (entry) =>
            stateValue === undefined || entry.value.StateValue === stateValue,
        )
        .filter(
          (entry) =>
            childNames === undefined || childNames.has(entry.value.AlarmName),
        )
        .filter(
          (entry) =>
            parentsOf === undefined ||
            extractAlarmNamesFromRule(entry.value.AlarmRule).has(parentsOf),
        )
        .map((entry) => toCompositeAlarm(entry.value))
    : [];

  type AlarmEntry =
    | { kind: "metric"; item: Record<string, unknown> }
    | { kind: "composite"; item: Record<string, unknown> };
  const combined: AlarmEntry[] = [
    ...metricAlarms.map((item) => ({ kind: "metric" as const, item })),
    ...compositeAlarms.map((item) => ({ kind: "composite" as const, item })),
  ];
  const { items: paged, nextToken } = paginateList(
    combined,
    input["NextToken"],
    input["MaxRecords"],
  );
  return {
    MetricAlarms: paged.filter((x) => x.kind === "metric").map((x) => x.item),
    CompositeAlarms: paged
      .filter((x) => x.kind === "composite")
      .map((x) => x.item),
    NextToken: nextToken,
  };
};

const DeleteAlarms: OperationHandler = (input, ctx) => {
  const names = input["AlarmNames"];
  if (!Array.isArray(names)) {
    throw awsError("MissingParameter", "AlarmNames is required.", 400);
  }
  for (const name of names) {
    if (typeof name === "string") {
      const arn = alarmArnOf(ctx.region, ctx.account, name);
      ctx.store.delete(alarmKey(name));
      ctx.store.delete(compositeAlarmKey(name));
      ctx.store.delete(tagsKey(arn));
    }
  }
  return {};
};

const PutDashboard: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DashboardName");
  const body = requireString(input, "DashboardBody");
  const dashboard: StoredDashboard = {
    DashboardName: name,
    DashboardArn: dashboardArnOf(ctx.account, name),
    DashboardBody: body,
    LastModified: Math.floor(Date.now() / 1000),
    Size: body.length,
  };
  ctx.store.set(dashboardKey(name), dashboard);
  return { DashboardValidationMessages: [] };
};

const GetDashboard: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DashboardName");
  const dashboard = ctx.store.get<StoredDashboard>(dashboardKey(name));
  if (dashboard === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Dashboard ${name} does not exist.`,
      404,
    );
  }
  return {
    DashboardArn: dashboard.DashboardArn,
    DashboardName: dashboard.DashboardName,
    DashboardBody: dashboard.DashboardBody,
  };
};

const ListDashboards: OperationHandler = (input, ctx) => {
  const prefix =
    typeof input["DashboardNamePrefix"] === "string"
      ? (input["DashboardNamePrefix"] as string)
      : undefined;
  const allEntries = ctx.store
    .list<StoredDashboard>()
    .filter((entry) => entry.key.startsWith("dashboard/"))
    .filter(
      (entry) =>
        prefix === undefined || entry.value.DashboardName.startsWith(prefix),
    )
    .map((entry) => ({
      DashboardName: entry.value.DashboardName,
      DashboardArn: entry.value.DashboardArn,
      LastModified: entry.value.LastModified,
      Size: entry.value.Size,
    }));
  const { items, nextToken } = paginateList(
    allEntries,
    input["NextToken"],
    undefined,
  );
  return { DashboardEntries: items, NextToken: nextToken };
};

const DeleteDashboards: OperationHandler = (input, ctx) => {
  const names = input["DashboardNames"];
  if (!Array.isArray(names)) {
    throw awsError("MissingParameter", "DashboardNames is required.", 400);
  }
  for (const name of names) {
    if (typeof name === "string") {
      ctx.store.delete(dashboardKey(name));
      ctx.store.delete(tagsKey(dashboardArnOf(ctx.account, name)));
    }
  }
  return {};
};

type RuleToken =
  | { t: "state"; st: string; name: string }
  | { t: "kw"; word: string }
  | { t: "paren"; ch: string };

const tokenizeAlarmRule = (rule: string): RuleToken[] => {
  const tokens: RuleToken[] = [];
  let i = 0;
  while (i < rule.length) {
    if (/\s/.test(rule[i]!)) {
      i++;
      continue;
    }
    const sm = rule
      .slice(i)
      .match(/^(ALARM|OK|INSUFFICIENT_DATA)\("([^"]*)"\)/);
    if (sm) {
      tokens.push({ t: "state" as const, st: sm[1]!, name: sm[2]! });
      i += sm[0]!.length;
      continue;
    }
    const km = rule.slice(i).match(/^(AND|OR|NOT|TRUE|FALSE)(?!\w)/);
    if (km) {
      tokens.push({ t: "kw" as const, word: km[1]! });
      i += km[1]!.length;
      continue;
    }
    tokens.push({ t: "paren" as const, ch: rule[i]! });
    i++;
  }
  return tokens;
};

const evalAlarmRule = (rule: string, ctx: ServiceContext): string => {
  const tokens = tokenizeAlarmRule(rule);
  const pos = { i: 0 };

  const peek = (): RuleToken | null =>
    pos.i < tokens.length ? tokens[pos.i]! : null;
  const consume = (): RuleToken => tokens[pos.i++]!;

  const getState = (name: string): string => {
    const ma = ctx.store.get<StoredAlarm>(alarmKey(name));
    if (ma !== undefined) return ma.StateValue;
    const ca = ctx.store.get<StoredCompositeAlarm>(compositeAlarmKey(name));
    return ca !== undefined ? ca.StateValue : "INSUFFICIENT_DATA";
  };

  const evalAtom = (): string => {
    const tok = peek();
    if (tok === null) return "INSUFFICIENT_DATA";
    if (tok.t === "paren" && tok.ch === "(") {
      consume();
      const result = evalOr();
      consume();
      return result;
    }
    if (tok.t === "kw") {
      if (tok.word === "TRUE") {
        consume();
        return "ALARM";
      }
      if (tok.word === "FALSE") {
        consume();
        return "OK";
      }
    }
    if (tok.t === "state") {
      consume();
      const cur = getState(tok.name);
      if (cur === "INSUFFICIENT_DATA") return "INSUFFICIENT_DATA";
      return cur === tok.st ? "ALARM" : "OK";
    }
    consume();
    return "INSUFFICIENT_DATA";
  };

  const evalNot = (): string => {
    const tok = peek();
    if (tok !== null && tok.t === "kw" && tok.word === "NOT") {
      consume();
      const val = evalNot();
      if (val === "ALARM") return "OK";
      if (val === "OK") return "ALARM";
      return "INSUFFICIENT_DATA";
    }
    return evalAtom();
  };

  const evalAnd = (): string => {
    let left = evalNot();
    while (true) {
      const tok = peek();
      if (tok === null || tok.t !== "kw" || tok.word !== "AND") break;
      consume();
      const right = evalNot();
      if (left === "OK" || right === "OK") {
        left = "OK";
      } else if (left === "ALARM" && right === "ALARM") {
        left = "ALARM";
      } else {
        left = "INSUFFICIENT_DATA";
      }
    }
    return left;
  };

  const evalOr = (): string => {
    let left = evalAnd();
    while (true) {
      const tok = peek();
      if (tok === null || tok.t !== "kw" || tok.word !== "OR") break;
      consume();
      const right = evalAnd();
      if (left === "ALARM" || right === "ALARM") {
        left = "ALARM";
      } else if (left === "OK" && right === "OK") {
        left = "OK";
      } else {
        left = "INSUFFICIENT_DATA";
      }
    }
    return left;
  };

  return evalOr();
};

const updateCompositeAlarms = (ctx: ServiceContext): void => {
  const entries = ctx.store
    .list<StoredCompositeAlarm>()
    .filter((e) => e.key.startsWith("composite-alarm/"));
  for (const entry of entries) {
    const ca = entry.value;
    const newState = evalAlarmRule(ca.AlarmRule, ctx);
    if (ca.StateValue !== newState) {
      ca.StateValue = newState;
      ctx.store.set(entry.key, ca);
    }
  }
};

const SetAlarmState: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AlarmName");
  requireString(input, "StateValue");
  requireString(input, "StateReason");
  const stateValue = input["StateValue"] as string;
  const stateReason = input["StateReason"] as string;
  const alarm = ctx.store.get<StoredAlarm>(alarmKey(name));
  if (alarm === undefined) {
    throw awsError("ResourceNotFound", `Alarm ${name} does not exist.`, 404);
  }
  const prevState = alarm.StateValue;
  const ts = Math.floor(Date.now() / 1000);
  alarm.StateValue = stateValue;
  alarm.StateReason = stateReason;
  alarm.ConfigurationUpdated = ts;
  ctx.store.set(alarmKey(name), alarm);
  const historyItem: StoredAlarmHistoryItem = {
    AlarmName: name,
    AlarmType: "MetricAlarm",
    HistoryItemType: "StateUpdate",
    HistorySummary: `Alarm updated from ${prevState} to ${stateValue}`,
    Timestamp: ts,
  };
  ctx.store.set(alarmHistoryKeyOf(name, ts), historyItem);
  updateCompositeAlarms(ctx);
  return {};
};

const DescribeAlarmsForMetric: OperationHandler = (input, ctx) => {
  const metricName = requireString(input, "MetricName");
  const namespace = requireString(input, "Namespace");
  const dimensions = toDimensions(input["Dimensions"]);
  const dimensionFilter = dimensionToken(dimensions);
  const alarms = ctx.store
    .list<StoredAlarm>()
    .filter((entry) => entry.key.startsWith("alarm/"))
    .filter(
      (entry) =>
        entry.value.MetricName === metricName &&
        entry.value.Namespace === namespace,
    )
    .filter(
      (entry) =>
        dimensions.length === 0 ||
        dimensionToken(entry.value.Dimensions) === dimensionFilter,
    )
    .map((entry) => toMetricAlarm(entry.value));
  return { MetricAlarms: alarms };
};

const statFromQuery = (metricStat: Record<string, unknown>): string =>
  typeof metricStat["Stat"] === "string"
    ? (metricStat["Stat"] as string)
    : "Average";

type TimeSeries = { Timestamps: number[]; Values: number[] };

const combineSeries = (
  a: TimeSeries,
  b: TimeSeries,
  op: (av: number, bv: number) => number,
): TimeSeries => {
  const aMap = new Map(a.Timestamps.map((ts, i) => [ts, a.Values[i]!]));
  const bMap = new Map(b.Timestamps.map((ts, i) => [ts, b.Values[i]!]));
  const tsSet = new Set([...a.Timestamps, ...b.Timestamps]);
  const sortedTs = [...tsSet].sort((x, y) => x - y);
  const Timestamps: number[] = [];
  const Values: number[] = [];
  for (const ts of sortedTs) {
    const av = aMap.get(ts);
    const bv = bMap.get(ts);
    if (av !== undefined && bv !== undefined) {
      Timestamps.push(ts);
      Values.push(op(av, bv));
    }
  }
  return { Timestamps, Values };
};

const evalMetricMath = (
  expr: string,
  resolved: Map<string, TimeSeries>,
): TimeSeries => {
  type MathToken =
    | { k: "id"; v: string }
    | { k: "num"; v: number }
    | { k: "op"; v: string }
    | { k: "paren"; v: string };

  const tokens: MathToken[] = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i]!)) {
      i++;
      continue;
    }
    const idm = expr.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (idm) {
      tokens.push({ k: "id" as const, v: idm[0]! });
      i += idm[0]!.length;
      continue;
    }
    const nm = expr.slice(i).match(/^[\d.]+/);
    if (nm) {
      tokens.push({ k: "num" as const, v: Number(nm[0]) });
      i += nm[0]!.length;
      continue;
    }
    if ("+-*/".includes(expr[i]!)) {
      tokens.push({ k: "op" as const, v: expr[i]! });
    } else {
      tokens.push({ k: "paren" as const, v: expr[i]! });
    }
    i++;
  }

  const pos = { i: 0 };
  const peek = (): MathToken | null =>
    pos.i < tokens.length ? tokens[pos.i]! : null;
  const consume = (): MathToken => tokens[pos.i++]!;

  const toScalar = (n: number, refTs: number[]): TimeSeries => ({
    Timestamps: refTs,
    Values: refTs.map(() => n),
  });

  const parseFactor = (): TimeSeries => {
    const tok = peek();
    if (tok === null) return { Timestamps: [], Values: [] };
    if (tok.k === "paren" && tok.v === "(") {
      consume();
      const result = parseExpr();
      consume();
      return result;
    }
    if (tok.k === "op" && tok.v === "-") {
      consume();
      const f = parseFactor();
      return { Timestamps: f.Timestamps, Values: f.Values.map((v) => -v) };
    }
    consume();
    if (tok.k === "num") {
      return toScalar(tok.v, []);
    }
    if (tok.k === "id") {
      return resolved.get(tok.v) ?? { Timestamps: [], Values: [] };
    }
    return { Timestamps: [], Values: [] };
  };

  const parseTerm = (): TimeSeries => {
    let left = parseFactor();
    while (true) {
      const tok = peek();
      if (tok === null || tok.k !== "op" || (tok.v !== "*" && tok.v !== "/"))
        break;
      const op = consume().v;
      const right = parseFactor();
      left = combineSeries(
        left,
        right,
        op === "*" ? (a, b) => a * b : (a, b) => a / b,
      );
    }
    return left;
  };

  const parseExpr = (): TimeSeries => {
    let left = parseTerm();
    while (true) {
      const tok = peek();
      if (tok === null || tok.k !== "op" || (tok.v !== "+" && tok.v !== "-"))
        break;
      const op = consume().v;
      const right = parseTerm();
      left = combineSeries(
        left,
        right,
        op === "+" ? (a, b) => a + b : (a, b) => a - b,
      );
    }
    return left;
  };

  return parseExpr();
};

const resolveMetricStatQuery = (
  query: Record<string, unknown>,
  startTime: number,
  endTime: number,
  ctx: ServiceContext,
): TimeSeries => {
  const metricStat = query["MetricStat"] as Record<string, unknown>;
  const metric =
    typeof metricStat["Metric"] === "object" && metricStat["Metric"] !== null
      ? (metricStat["Metric"] as Record<string, unknown>)
      : {};
  const namespace =
    typeof metric["Namespace"] === "string"
      ? (metric["Namespace"] as string)
      : "";
  const metricName =
    typeof metric["MetricName"] === "string"
      ? (metric["MetricName"] as string)
      : "";
  const dimensions = toDimensions(metric["Dimensions"]);
  const period =
    typeof metricStat["Period"] === "number"
      ? (metricStat["Period"] as number)
      : 60;
  const stat = statFromQuery(metricStat);
  const series = ctx.store.get<StoredSeries>(
    seriesKey(namespace, metricName, dimensions),
  );
  const points = (series?.Points ?? []).filter(
    (point) => point.Timestamp >= startTime && point.Timestamp < endTime,
  );
  const buckets = new Map<number, number[]>();
  for (const point of points) {
    const bucketStart =
      startTime + Math.floor((point.Timestamp - startTime) / period) * period;
    const existing = buckets.get(bucketStart) ?? [];
    existing.push(point.Value);
    buckets.set(bucketStart, existing);
  }
  const Timestamps: number[] = [];
  const Values: number[] = [];
  for (const [bucketStart, bucketValues] of [...buckets.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    Timestamps.push(bucketStart);
    Values.push(computeStatistic(stat, bucketValues));
  }
  return { Timestamps, Values };
};

const GetMetricData: OperationHandler = (input, ctx) => {
  const queries = input["MetricDataQueries"];
  if (!Array.isArray(queries)) {
    throw awsError("MissingParameter", "MetricDataQueries is required.", 400);
  }
  requireNumber(input, "StartTime");
  requireNumber(input, "EndTime");
  const startTime = input["StartTime"] as number;
  const endTime = input["EndTime"] as number;

  type QueryEntry = {
    id: string;
    label: string;
    query: Record<string, unknown>;
  };
  const metricStatQueries: QueryEntry[] = [];
  const expressionQueries: QueryEntry[] = [];

  for (const entry of queries) {
    if (typeof entry !== "object" || entry === null) continue;
    const query = entry as Record<string, unknown>;
    const id = typeof query["Id"] === "string" ? (query["Id"] as string) : "";
    if (id === "") {
      throw awsError("MissingParameter", "Id is required.", 400);
    }
    const label =
      typeof query["Label"] === "string" ? (query["Label"] as string) : id;
    if (
      typeof query["MetricStat"] === "object" &&
      query["MetricStat"] !== null
    ) {
      metricStatQueries.push({ id, label, query });
    } else if (typeof query["Expression"] === "string") {
      expressionQueries.push({ id, label, query });
    }
  }

  const resolved = new Map<string, TimeSeries>();
  for (const { id, query } of metricStatQueries) {
    resolved.set(id, resolveMetricStatQuery(query, startTime, endTime, ctx));
  }

  for (const { id, query } of expressionQueries) {
    const expr = query["Expression"] as string;
    resolved.set(id, evalMetricMath(expr, resolved));
  }

  const allIds = [
    ...metricStatQueries.map((q) => q.id),
    ...expressionQueries.map((q) => q.id),
  ];
  const labelMap = new Map<string, string>();
  for (const { id, label } of [...metricStatQueries, ...expressionQueries]) {
    labelMap.set(id, label);
  }

  const results: Record<string, unknown>[] = allIds.map((id) => {
    const ts = resolved.get(id) ?? { Timestamps: [], Values: [] };
    return {
      Id: id,
      Label: labelMap.get(id) ?? id,
      Timestamps: ts.Timestamps,
      Values: ts.Values,
      StatusCode: "Complete",
    };
  });

  return { MetricDataResults: results, Messages: [] };
};

const PutCompositeAlarm: OperationHandler = (input, ctx) => {
  const alarmName = requireString(input, "AlarmName");
  const alarmRule = requireString(input, "AlarmRule");
  const alarm: StoredCompositeAlarm = {
    AlarmName: alarmName,
    AlarmArn: alarmArnOf(ctx.region, ctx.account, alarmName),
    AlarmDescription:
      typeof input["AlarmDescription"] === "string"
        ? (input["AlarmDescription"] as string)
        : "",
    ActionsEnabled:
      typeof input["ActionsEnabled"] === "boolean"
        ? (input["ActionsEnabled"] as boolean)
        : true,
    AlarmRule: alarmRule,
    AlarmActions: Array.isArray(input["AlarmActions"])
      ? (input["AlarmActions"] as unknown[]).filter(
          (a): a is string => typeof a === "string",
        )
      : [],
    OKActions: Array.isArray(input["OKActions"])
      ? (input["OKActions"] as unknown[]).filter(
          (a): a is string => typeof a === "string",
        )
      : [],
    InsufficientDataActions: Array.isArray(input["InsufficientDataActions"])
      ? (input["InsufficientDataActions"] as unknown[]).filter(
          (a): a is string => typeof a === "string",
        )
      : [],
    StateValue: "INSUFFICIENT_DATA",
    ConfigurationUpdated: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(compositeAlarmKey(alarmName), alarm);
  storeTags(ctx, alarm.AlarmArn, input["Tags"]);
  return {};
};

const EnableAlarmActions: OperationHandler = (input, ctx) => {
  const names = input["AlarmNames"];
  if (!Array.isArray(names)) {
    throw awsError("MissingParameter", "AlarmNames is required.", 400);
  }
  for (const name of names) {
    if (typeof name !== "string") continue;
    const alarm = ctx.store.get<StoredAlarm>(alarmKey(name));
    if (alarm !== undefined) {
      alarm.ActionsEnabled = true;
      ctx.store.set(alarmKey(name), alarm);
    }
    const ca = ctx.store.get<StoredCompositeAlarm>(compositeAlarmKey(name));
    if (ca !== undefined) {
      ca.ActionsEnabled = true;
      ctx.store.set(compositeAlarmKey(name), ca);
    }
  }
  return {};
};

const DisableAlarmActions: OperationHandler = (input, ctx) => {
  const names = input["AlarmNames"];
  if (!Array.isArray(names)) {
    throw awsError("MissingParameter", "AlarmNames is required.", 400);
  }
  for (const name of names) {
    if (typeof name !== "string") continue;
    const alarm = ctx.store.get<StoredAlarm>(alarmKey(name));
    if (alarm !== undefined) {
      alarm.ActionsEnabled = false;
      ctx.store.set(alarmKey(name), alarm);
    }
    const ca = ctx.store.get<StoredCompositeAlarm>(compositeAlarmKey(name));
    if (ca !== undefined) {
      ca.ActionsEnabled = false;
      ctx.store.set(compositeAlarmKey(name), ca);
    }
  }
  return {};
};

const DescribeAlarmHistory: OperationHandler = (input, ctx) => {
  const alarmName =
    typeof input["AlarmName"] === "string"
      ? (input["AlarmName"] as string)
      : undefined;
  const items = ctx.store
    .list<StoredAlarmHistoryItem>()
    .filter((entry) => entry.key.startsWith("alarm-history/"))
    .filter(
      (entry) => alarmName === undefined || entry.value.AlarmName === alarmName,
    )
    .map((entry) => ({
      AlarmName: entry.value.AlarmName,
      AlarmType: entry.value.AlarmType,
      HistoryItemType: entry.value.HistoryItemType,
      HistorySummary: entry.value.HistorySummary,
      Timestamp: entry.value.Timestamp,
    }));
  return { AlarmHistoryItems: items };
};

const DescribeAlarmContributors: OperationHandler = (input, ctx) => {
  const alarmName = requireString(input, "AlarmName");
  const alarm = ctx.store.get<StoredAlarm>(alarmKey(alarmName));
  const ca = ctx.store.get<StoredCompositeAlarm>(compositeAlarmKey(alarmName));
  if (alarm === undefined && ca === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Alarm ${alarmName} does not exist.`,
      404,
    );
  }
  return { AlarmContributors: [] };
};

const PutAlarmMuteRule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const rule: StoredMuteRule = {
    Name: name,
    AlarmMuteRuleArn: muteRuleArnOf(ctx.region, ctx.account, name),
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : "",
    Rule: input["Rule"] ?? {},
    MuteTargets: input["MuteTargets"] ?? null,
    StartDate:
      typeof input["StartDate"] === "string"
        ? (input["StartDate"] as string)
        : "",
    ExpireDate:
      typeof input["ExpireDate"] === "string"
        ? (input["ExpireDate"] as string)
        : "",
    Status: "ACTIVE",
    LastUpdatedTimestamp: Math.floor(Date.now() / 1000),
    MuteType: "ONE_TIME",
  };
  ctx.store.set(muteRuleKey(name), rule);
  return {};
};

const GetAlarmMuteRule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AlarmMuteRuleName");
  const rule = ctx.store.get<StoredMuteRule>(muteRuleKey(name));
  if (rule === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Alarm mute rule ${name} does not exist.`,
      404,
    );
  }
  return {
    Name: rule.Name,
    AlarmMuteRuleArn: rule.AlarmMuteRuleArn,
    Description: rule.Description,
    Rule: rule.Rule,
    MuteTargets: rule.MuteTargets,
    StartDate: rule.StartDate,
    ExpireDate: rule.ExpireDate,
    Status: rule.Status,
    LastUpdatedTimestamp: rule.LastUpdatedTimestamp,
    MuteType: rule.MuteType,
  };
};

const DeleteAlarmMuteRule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AlarmMuteRuleName");
  ctx.store.delete(muteRuleKey(name));
  return {};
};

const ListAlarmMuteRules: OperationHandler = (input, ctx) => {
  const allEntries = ctx.store
    .list<StoredMuteRule>()
    .filter((entry) => entry.key.startsWith("mute-rule/"))
    .map((entry) => ({
      AlarmMuteRuleArn: entry.value.AlarmMuteRuleArn,
      ExpireDate: entry.value.ExpireDate,
      Status: entry.value.Status,
      MuteType: entry.value.MuteType,
      LastUpdatedTimestamp: entry.value.LastUpdatedTimestamp,
    }));
  const { items, nextToken } = paginateList(
    allEntries,
    input["NextToken"],
    input["MaxResults"],
  );
  return { AlarmMuteRuleSummaries: items, NextToken: nextToken };
};

const PutAnomalyDetector: OperationHandler = (input, ctx) => {
  const key = anomalyDetectorKeyFromInput(input);
  const detector: StoredAnomalyDetector = {
    Arn: anomalyDetectorArnOf(ctx.region, ctx.account, key),
    detectorKey: key,
    Namespace:
      typeof input["Namespace"] === "string"
        ? (input["Namespace"] as string)
        : "",
    MetricName:
      typeof input["MetricName"] === "string"
        ? (input["MetricName"] as string)
        : "",
    Stat: typeof input["Stat"] === "string" ? (input["Stat"] as string) : "",
    Dimensions: toDimensions(input["Dimensions"]),
    Configuration: input["Configuration"] ?? null,
    StateValue: "TRAINED",
    MetricCharacteristics: input["MetricCharacteristics"] ?? null,
    SingleMetricAnomalyDetector: input["SingleMetricAnomalyDetector"] ?? null,
    MetricMathAnomalyDetector: input["MetricMathAnomalyDetector"] ?? null,
  };
  ctx.store.set(anomalyDetectorKey(key), detector);
  return {};
};

const DescribeAnomalyDetectors: OperationHandler = (input, ctx) => {
  const nsFilter =
    typeof input["Namespace"] === "string"
      ? (input["Namespace"] as string)
      : undefined;
  const mnFilter =
    typeof input["MetricName"] === "string"
      ? (input["MetricName"] as string)
      : undefined;
  const detectors = ctx.store
    .list<StoredAnomalyDetector>()
    .filter((entry) => entry.key.startsWith("anomaly-detector/"))
    .filter((entry) => {
      if (nsFilter === undefined) return true;
      if (entry.value.Namespace === nsFilter) return true;
      const single = entry.value.SingleMetricAnomalyDetector;
      if (typeof single === "object" && single !== null) {
        return (single as Record<string, unknown>)["Namespace"] === nsFilter;
      }
      return false;
    })
    .filter((entry) => {
      if (mnFilter === undefined) return true;
      if (entry.value.MetricName === mnFilter) return true;
      const single = entry.value.SingleMetricAnomalyDetector;
      if (typeof single === "object" && single !== null) {
        return (single as Record<string, unknown>)["MetricName"] === mnFilter;
      }
      return false;
    })
    .map((entry) => ({
      Namespace: entry.value.Namespace || undefined,
      MetricName: entry.value.MetricName || undefined,
      Stat: entry.value.Stat || undefined,
      Dimensions:
        entry.value.Dimensions.length > 0 ? entry.value.Dimensions : undefined,
      Configuration: entry.value.Configuration,
      StateValue: entry.value.StateValue,
      MetricCharacteristics: entry.value.MetricCharacteristics,
      SingleMetricAnomalyDetector: entry.value.SingleMetricAnomalyDetector,
      MetricMathAnomalyDetector: entry.value.MetricMathAnomalyDetector,
    }));
  return { AnomalyDetectors: detectors };
};

const DeleteAnomalyDetector: OperationHandler = (input, ctx) => {
  const key = anomalyDetectorKeyFromInput(input);
  const existing = ctx.store.get<StoredAnomalyDetector>(
    anomalyDetectorKey(key),
  );
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Anomaly detector does not exist.",
      404,
    );
  }
  ctx.store.delete(anomalyDetectorKey(key));
  ctx.store.delete(tagsKey(existing.Arn));
  return {};
};

const PutInsightRule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RuleName");
  const definition = requireString(input, "RuleDefinition");
  const rule: StoredInsightRule = {
    Name: name,
    State:
      typeof input["RuleState"] === "string"
        ? (input["RuleState"] as string)
        : "ENABLED",
    Schema: "CloudWatchLogRule",
    Definition: definition,
    ManagedRule: false,
    ApplyOnTransformedLogs:
      typeof input["ApplyOnTransformedLogs"] === "boolean"
        ? (input["ApplyOnTransformedLogs"] as boolean)
        : false,
  };
  ctx.store.set(insightRuleKey(name), rule);
  return {};
};

const DeleteInsightRules: OperationHandler = (input, ctx) => {
  const names = input["RuleNames"];
  if (!Array.isArray(names)) {
    throw awsError("MissingParameter", "RuleNames is required.", 400);
  }
  for (const name of names) {
    if (typeof name === "string") ctx.store.delete(insightRuleKey(name));
  }
  return { Failures: [] };
};

const DescribeInsightRules: OperationHandler = (_input, ctx) => {
  const rules = ctx.store
    .list<StoredInsightRule>()
    .filter((entry) => entry.key.startsWith("insight-rule/"))
    .map((entry) => ({
      Name: entry.value.Name,
      State: entry.value.State,
      Schema: entry.value.Schema,
      Definition: entry.value.Definition,
      ManagedRule: entry.value.ManagedRule,
      ApplyOnTransformedLogs: entry.value.ApplyOnTransformedLogs,
    }));
  return { InsightRules: rules };
};

const EnableInsightRules: OperationHandler = (input, ctx) => {
  const names = input["RuleNames"];
  if (!Array.isArray(names)) {
    throw awsError("MissingParameter", "RuleNames is required.", 400);
  }
  for (const name of names) {
    if (typeof name !== "string") continue;
    const rule = ctx.store.get<StoredInsightRule>(insightRuleKey(name));
    if (rule !== undefined) {
      rule.State = "ENABLED";
      ctx.store.set(insightRuleKey(name), rule);
    }
  }
  return { Failures: [] };
};

const DisableInsightRules: OperationHandler = (input, ctx) => {
  const names = input["RuleNames"];
  if (!Array.isArray(names)) {
    throw awsError("MissingParameter", "RuleNames is required.", 400);
  }
  for (const name of names) {
    if (typeof name !== "string") continue;
    const rule = ctx.store.get<StoredInsightRule>(insightRuleKey(name));
    if (rule !== undefined) {
      rule.State = "DISABLED";
      ctx.store.set(insightRuleKey(name), rule);
    }
  }
  return { Failures: [] };
};

const GetInsightRuleReport: OperationHandler = (input, ctx) => {
  const ruleName = requireString(input, "RuleName");
  const rule = ctx.store.get<StoredInsightRule>(insightRuleKey(ruleName));
  if (rule === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Insight rule ${ruleName} does not exist.`,
      404,
    );
  }
  return {
    KeyLabels: [],
    AggregationStatistic: "Sum",
    AggregateValue: 0,
    ApproximateUniqueCount: 0,
    Contributors: [],
    MetricDatapoints: [],
  };
};

const PutManagedInsightRules: OperationHandler = (input, ctx) => {
  const managedRules = input["ManagedRules"];
  if (!Array.isArray(managedRules)) {
    throw awsError("MissingParameter", "ManagedRules is required.", 400);
  }
  for (const rule of managedRules) {
    if (typeof rule !== "object" || rule === null) continue;
    const r = rule as Record<string, unknown>;
    const templateName =
      typeof r["TemplateName"] === "string"
        ? (r["TemplateName"] as string)
        : "";
    const resourceArn =
      typeof r["ResourceARN"] === "string" ? (r["ResourceARN"] as string) : "";
    if (templateName === "" || resourceArn === "") continue;
    ctx.store.set(managedRuleKey(resourceArn, templateName), {
      TemplateName: templateName,
      ResourceARN: resourceArn,
      RuleState: {
        RuleName: `${templateName}`,
        State: "ENABLED",
      },
    });
  }
  return { Failures: [] };
};

const ListManagedInsightRules: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const prefix = `managed-rule/${resourceArn}/`;
  const rules = ctx.store
    .list<{ TemplateName: string; ResourceARN: string; RuleState: unknown }>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => ({
      TemplateName: entry.value.TemplateName,
      ResourceARN: entry.value.ResourceARN,
      RuleState: entry.value.RuleState,
    }));
  return { ManagedRules: rules };
};

const PutMetricStream: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const firehoseArn = requireString(input, "FirehoseArn");
  const roleArn = requireString(input, "RoleArn");
  const outputFormat = requireString(input, "OutputFormat");
  const existing = ctx.store.get<StoredMetricStream>(metricStreamKey(name));
  const now = Math.floor(Date.now() / 1000);
  const stream: StoredMetricStream = {
    Name: name,
    Arn: metricStreamArnOf(ctx.region, ctx.account, name),
    FirehoseArn: firehoseArn,
    RoleArn: roleArn,
    OutputFormat: outputFormat,
    IncludeFilters: Array.isArray(input["IncludeFilters"])
      ? (input["IncludeFilters"] as unknown[])
      : [],
    ExcludeFilters: Array.isArray(input["ExcludeFilters"])
      ? (input["ExcludeFilters"] as unknown[])
      : [],
    StatisticsConfigurations: Array.isArray(input["StatisticsConfigurations"])
      ? (input["StatisticsConfigurations"] as unknown[])
      : [],
    IncludeLinkedAccountsMetrics:
      typeof input["IncludeLinkedAccountsMetrics"] === "boolean"
        ? (input["IncludeLinkedAccountsMetrics"] as boolean)
        : false,
    State: "running",
    CreationDate: existing?.CreationDate ?? now,
    LastUpdateDate: now,
  };
  ctx.store.set(metricStreamKey(name), stream);
  return { Arn: stream.Arn };
};

const GetMetricStream: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const stream = ctx.store.get<StoredMetricStream>(metricStreamKey(name));
  if (stream === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Metric stream ${name} does not exist.`,
      404,
    );
  }
  return {
    Arn: stream.Arn,
    Name: stream.Name,
    IncludeFilters: stream.IncludeFilters,
    ExcludeFilters: stream.ExcludeFilters,
    FirehoseArn: stream.FirehoseArn,
    RoleArn: stream.RoleArn,
    State: stream.State,
    CreationDate: stream.CreationDate,
    LastUpdateDate: stream.LastUpdateDate,
    OutputFormat: stream.OutputFormat,
    StatisticsConfigurations: stream.StatisticsConfigurations,
    IncludeLinkedAccountsMetrics: stream.IncludeLinkedAccountsMetrics,
  };
};

const DeleteMetricStream: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const arn = metricStreamArnOf(ctx.region, ctx.account, name);
  ctx.store.delete(metricStreamKey(name));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const ListMetricStreams: OperationHandler = (input, ctx) => {
  const allEntries = ctx.store
    .list<StoredMetricStream>()
    .filter((entry) => entry.key.startsWith("metric-stream/"))
    .map((entry) => ({
      Arn: entry.value.Arn,
      CreationDate: entry.value.CreationDate,
      LastUpdateDate: entry.value.LastUpdateDate,
      Name: entry.value.Name,
      FirehoseArn: entry.value.FirehoseArn,
      State: entry.value.State,
      OutputFormat: entry.value.OutputFormat,
    }));
  const { items, nextToken } = paginateList(
    allEntries,
    input["NextToken"],
    input["MaxResults"],
  );
  return { Entries: items, NextToken: nextToken };
};

const StartMetricStreams: OperationHandler = (input, ctx) => {
  const names = input["Names"];
  if (!Array.isArray(names)) {
    throw awsError("MissingParameter", "Names is required.", 400);
  }
  for (const name of names) {
    if (typeof name !== "string") continue;
    const stream = ctx.store.get<StoredMetricStream>(metricStreamKey(name));
    if (stream !== undefined) {
      stream.State = "running";
      stream.LastUpdateDate = Math.floor(Date.now() / 1000);
      ctx.store.set(metricStreamKey(name), stream);
    }
  }
  return {};
};

const StopMetricStreams: OperationHandler = (input, ctx) => {
  const names = input["Names"];
  if (!Array.isArray(names)) {
    throw awsError("MissingParameter", "Names is required.", 400);
  }
  for (const name of names) {
    if (typeof name !== "string") continue;
    const stream = ctx.store.get<StoredMetricStream>(metricStreamKey(name));
    if (stream !== undefined) {
      stream.State = "stopped";
      stream.LastUpdateDate = Math.floor(Date.now() / 1000);
      ctx.store.set(metricStreamKey(name), stream);
    }
  }
  return {};
};

const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const GetMetricWidgetImage: OperationHandler = (_input, _ctx) => {
  return { MetricWidgetImage: TINY_PNG };
};

const GetOTelEnrichment: OperationHandler = (_input, _ctx) => {
  return { Status: "Stopped" };
};

const StartOTelEnrichment: OperationHandler = (_input, _ctx) => {
  return {};
};

const StopOTelEnrichment: OperationHandler = (_input, _ctx) => {
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const tags = input["Tags"];
  if (!Array.isArray(tags)) {
    throw awsError("MissingParameter", "Tags is required.", 400);
  }
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  for (const tag of tags) {
    if (typeof tag !== "object" || tag === null) continue;
    const t = tag as Record<string, unknown>;
    const k = typeof t["Key"] === "string" ? (t["Key"] as string) : "";
    const v = typeof t["Value"] === "string" ? (t["Value"] as string) : "";
    if (k !== "") existing[k] = v;
  }
  ctx.store.set(tagsKey(resourceArn), existing);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const tagKeys = input["TagKeys"];
  if (!Array.isArray(tagKeys)) {
    throw awsError("MissingParameter", "TagKeys is required.", 400);
  }
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  for (const k of tagKeys) {
    if (typeof k === "string") delete existing[k];
  }
  ctx.store.set(tagsKey(resourceArn), existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  const tagList = Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));
  return { Tags: tagList };
};

const cloudwatch = {
  name: "monitoring",
  protocol: "json",
  operations: {
    PutMetricData,
    GetMetricStatistics,
    ListMetrics,
    PutMetricAlarm,
    DescribeAlarms,
    DeleteAlarms,
    PutDashboard,
    GetDashboard,
    ListDashboards,
    DeleteDashboards,
    SetAlarmState,
    DescribeAlarmsForMetric,
    GetMetricData,
    PutCompositeAlarm,
    EnableAlarmActions,
    DisableAlarmActions,
    DescribeAlarmHistory,
    DescribeAlarmContributors,
    PutAlarmMuteRule,
    GetAlarmMuteRule,
    DeleteAlarmMuteRule,
    ListAlarmMuteRules,
    PutAnomalyDetector,
    DescribeAnomalyDetectors,
    DeleteAnomalyDetector,
    PutInsightRule,
    DeleteInsightRules,
    DescribeInsightRules,
    EnableInsightRules,
    DisableInsightRules,
    GetInsightRuleReport,
    PutManagedInsightRules,
    ListManagedInsightRules,
    PutMetricStream,
    GetMetricStream,
    DeleteMetricStream,
    ListMetricStreams,
    StartMetricStreams,
    StopMetricStreams,
    GetMetricWidgetImage,
    GetOTelEnrichment,
    StartOTelEnrichment,
    StopOTelEnrichment,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default cloudwatch;
