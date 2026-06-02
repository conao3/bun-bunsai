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
  ConfigurationUpdated: number;
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

const alarmKey = (name: string): string => `alarm/${name}`;

const alarmArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:cloudwatch:${region}:${account}:alarm:${name}`;

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
  const alarms = ctx.store
    .list<StoredAlarm>()
    .filter((entry) => entry.key.startsWith("alarm/"))
    .filter(
      (entry) => names === undefined || names.includes(entry.value.AlarmName),
    )
    .filter(
      (entry) =>
        prefix === undefined || entry.value.AlarmName.startsWith(prefix),
    )
    .map((entry) => toMetricAlarm(entry.value));
  return { MetricAlarms: alarms, CompositeAlarms: [] };
};

const DeleteAlarms: OperationHandler = (input, ctx) => {
  const names = input["AlarmNames"];
  if (!Array.isArray(names)) {
    throw awsError("MissingParameter", "AlarmNames is required.", 400);
  }
  for (const name of names) {
    if (typeof name === "string") ctx.store.delete(alarmKey(name));
  }
  return {};
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
  },
  model,
} as const satisfies ServiceDefinition;

export default cloudwatch;
