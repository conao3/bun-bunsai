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
  const metrics = ctx.store
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
    .map((entry) => ({
      Namespace: entry.value.Namespace,
      MetricName: entry.value.MetricName,
      Dimensions: entry.value.Dimensions,
    }));
  return { Metrics: metrics };
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
    StateReason: "",
    ConfigurationUpdated: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(alarmKey(alarmName), alarm);
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
        .map((entry) => toMetricAlarm(entry.value))
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
        .map((entry) => toCompositeAlarm(entry.value))
    : [];

  return { MetricAlarms: metricAlarms, CompositeAlarms: compositeAlarms };
};

const DeleteAlarms: OperationHandler = (input, ctx) => {
  const names = input["AlarmNames"];
  if (!Array.isArray(names)) {
    throw awsError("MissingParameter", "AlarmNames is required.", 400);
  }
  for (const name of names) {
    if (typeof name === "string") {
      ctx.store.delete(alarmKey(name));
      ctx.store.delete(compositeAlarmKey(name));
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
  const entries = ctx.store
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
  return { DashboardEntries: entries };
};

const DeleteDashboards: OperationHandler = (input, ctx) => {
  const names = input["DashboardNames"];
  if (!Array.isArray(names)) {
    throw awsError("MissingParameter", "DashboardNames is required.", 400);
  }
  for (const name of names) {
    if (typeof name === "string") ctx.store.delete(dashboardKey(name));
  }
  return {};
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

const GetMetricData: OperationHandler = (input, ctx) => {
  const queries = input["MetricDataQueries"];
  if (!Array.isArray(queries)) {
    throw awsError("MissingParameter", "MetricDataQueries is required.", 400);
  }
  requireNumber(input, "StartTime");
  requireNumber(input, "EndTime");
  const startTime = input["StartTime"] as number;
  const endTime = input["EndTime"] as number;
  const results: Record<string, unknown>[] = [];
  for (const entry of queries) {
    if (typeof entry !== "object" || entry === null) continue;
    const query = entry as Record<string, unknown>;
    const id = typeof query["Id"] === "string" ? (query["Id"] as string) : "";
    if (id === "") {
      throw awsError("MissingParameter", "Id is required.", 400);
    }
    const label =
      typeof query["Label"] === "string" ? (query["Label"] as string) : id;
    const metricStat =
      typeof query["MetricStat"] === "object" && query["MetricStat"] !== null
        ? (query["MetricStat"] as Record<string, unknown>)
        : undefined;
    const timestamps: number[] = [];
    const values: number[] = [];
    if (metricStat !== undefined) {
      const metric =
        typeof metricStat["Metric"] === "object" &&
        metricStat["Metric"] !== null
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
          startTime +
          Math.floor((point.Timestamp - startTime) / period) * period;
        const existing = buckets.get(bucketStart) ?? [];
        existing.push(point.Value);
        buckets.set(bucketStart, existing);
      }
      for (const [bucketStart, bucketValues] of [...buckets.entries()].sort(
        (a, b) => a[0] - b[0],
      )) {
        timestamps.push(bucketStart);
        values.push(computeStatistic(stat, bucketValues));
      }
    }
    results.push({
      Id: id,
      Label: label,
      Timestamps: timestamps,
      Values: values,
      StatusCode: "Complete",
    });
  }
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

const ListAlarmMuteRules: OperationHandler = (_input, ctx) => {
  const entries = ctx.store
    .list<StoredMuteRule>()
    .filter((entry) => entry.key.startsWith("mute-rule/"))
    .map((entry) => ({
      AlarmMuteRuleArn: entry.value.AlarmMuteRuleArn,
      ExpireDate: entry.value.ExpireDate,
      Status: entry.value.Status,
      MuteType: entry.value.MuteType,
      LastUpdatedTimestamp: entry.value.LastUpdatedTimestamp,
    }));
  return { AlarmMuteRuleSummaries: entries };
};

const PutAnomalyDetector: OperationHandler = (input, ctx) => {
  const key = anomalyDetectorKeyFromInput(input);
  const detector: StoredAnomalyDetector = {
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
  ctx.store.delete(metricStreamKey(name));
  return {};
};

const ListMetricStreams: OperationHandler = (_input, ctx) => {
  const entries = ctx.store
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
  return { Entries: entries };
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
