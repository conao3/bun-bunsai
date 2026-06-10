import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudWatchClient,
  DescribeAlarmHistoryCommand,
  DescribeAlarmsCommand,
  GetMetricDataCommand,
  GetMetricStatisticsCommand,
  ListMetricsCommand,
  PutMetricAlarmCommand,
  PutMetricDataCommand,
  SetAlarmStateCommand,
} from "@aws-sdk/client-cloudwatch";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cw = () =>
  new CloudWatchClient({ endpoint, region, credentials, requestHandler });

test("CloudWatch metrics scenario: PutMetricData → ListMetrics → GetMetricStatistics/GetMetricData round-trip + alarm evaluation", async () => {
  const client = cw();
  const namespace = "bunsai/scenario-2075";
  const metricName = "ScenarioCount";
  const dimensions = [{ Name: "Service", Value: "scenario" }];
  const alarmName = "bunsai-scenario-alarm-2075";

  const base = Math.floor(Date.now() / 1000) * 1000;

  // Step 1: PutMetricData — 5 datapoints spread in the past 4 minutes (2 batches)
  await client.send(
    new PutMetricDataCommand({
      Namespace: namespace,
      MetricData: [
        {
          MetricName: metricName,
          Dimensions: dimensions,
          Value: 10,
          Unit: "Count",
          Timestamp: new Date(base - 4 * 60 * 1000),
        },
        {
          MetricName: metricName,
          Dimensions: dimensions,
          Value: 20,
          Unit: "Count",
          Timestamp: new Date(base - 3 * 60 * 1000),
        },
        {
          MetricName: metricName,
          Dimensions: dimensions,
          Value: 30,
          Unit: "Count",
          Timestamp: new Date(base - 2 * 60 * 1000),
        },
      ],
    }),
  );
  await client.send(
    new PutMetricDataCommand({
      Namespace: namespace,
      MetricData: [
        {
          MetricName: metricName,
          Dimensions: dimensions,
          Value: 40,
          Unit: "Count",
          Timestamp: new Date(base - 60 * 1000),
        },
        {
          MetricName: metricName,
          Dimensions: dimensions,
          Value: 50,
          Unit: "Count",
          Timestamp: new Date(base - 30 * 1000),
        },
      ],
    }),
  );

  // Step 2: ListMetrics — Namespace filter
  const listedByNs = await client.send(
    new ListMetricsCommand({ Namespace: namespace }),
  );
  expect((listedByNs.Metrics ?? []).map((m) => m.MetricName)).toContain(
    metricName,
  );

  // Step 2b: ListMetrics — Namespace + Dimensions filter
  const listedByDims = await client.send(
    new ListMetricsCommand({ Namespace: namespace, Dimensions: dimensions }),
  );
  expect((listedByDims.Metrics ?? []).map((m) => m.MetricName)).toContain(
    metricName,
  );

  // Step 3: GetMetricStatistics — Period=300 puts all 5 points in one bucket
  // (all timestamps within 270s of startTime=base/1000-300)
  const stats = await client.send(
    new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: new Date(base - 5 * 60 * 1000),
      EndTime: new Date(base + 60 * 1000),
      Period: 300,
      Statistics: ["Average", "Sum", "Maximum"],
    }),
  );
  expect(stats.Label).toBe(metricName);
  const datapoints = stats.Datapoints ?? [];
  expect(datapoints.length).toBe(1);
  const dp = datapoints[0]!;
  expect(dp.Sum).toBe(150);
  expect(dp.Average).toBe(30);
  expect(dp.Maximum).toBe(50);

  // Step 4: GetMetricData — MetricStat form
  const metricData = await client.send(
    new GetMetricDataCommand({
      StartTime: new Date(base - 5 * 60 * 1000),
      EndTime: new Date(base + 60 * 1000),
      MetricDataQueries: [
        {
          Id: "m1",
          MetricStat: {
            Metric: {
              Namespace: namespace,
              MetricName: metricName,
              Dimensions: dimensions,
            },
            Period: 300,
            Stat: "Sum",
          },
        },
      ],
    }),
  );
  const mdResults = metricData.MetricDataResults ?? [];
  expect(mdResults.length).toBe(1);
  expect(mdResults[0]?.Id).toBe("m1");
  expect(mdResults[0]?.StatusCode).toBe("Complete");
  expect(mdResults[0]?.Values?.[0]).toBe(150);
  expect((mdResults[0]?.Timestamps ?? []).length).toBeGreaterThan(0);

  // Step 5a: PutMetricAlarm — threshold=60, Statistic=Maximum, before exceeding data
  await client.send(
    new PutMetricAlarmCommand({
      AlarmName: alarmName,
      AlarmDescription: "scenario alarm for CON-2075",
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      Statistic: "Maximum",
      Period: 300,
      EvaluationPeriods: 1,
      Threshold: 60,
      ComparisonOperator: "GreaterThanThreshold",
    }),
  );

  // Step 5b: DescribeAlarms — existing Max=50 < threshold=60 → OK or INSUFFICIENT_DATA
  const afterPut = await client.send(
    new DescribeAlarmsCommand({ AlarmNames: [alarmName] }),
  );
  const putAlarms = afterPut.MetricAlarms ?? [];
  expect(putAlarms.length).toBe(1);
  expect(putAlarms[0]?.AlarmName).toBe(alarmName);
  expect(putAlarms[0]?.Threshold).toBe(60);
  expect(putAlarms[0]?.ComparisonOperator).toBe("GreaterThanThreshold");
  const stateAfterPut = putAlarms[0]?.StateValue;
  expect(stateAfterPut === "OK" || stateAfterPut === "INSUFFICIENT_DATA").toBe(
    true,
  );

  // Step 5c: PutMetricData — value=100 exceeds threshold=60
  await client.send(
    new PutMetricDataCommand({
      Namespace: namespace,
      MetricData: [
        {
          MetricName: metricName,
          Dimensions: dimensions,
          Value: 100,
          Unit: "Count",
          Timestamp: new Date(base - 15 * 1000),
        },
      ],
    }),
  );

  // Step 5d: DescribeAlarms — Max=100 > threshold=60 → ALARM (read-time evaluation)
  const afterExceed = await client.send(
    new DescribeAlarmsCommand({ AlarmNames: [alarmName] }),
  );
  const exceedAlarms = afterExceed.MetricAlarms ?? [];
  expect(exceedAlarms.length).toBe(1);
  expect(exceedAlarms[0]?.StateValue).toBe("ALARM");

  // Step 5e: SetAlarmState — manual transition (light assertion: no error + history)
  await client.send(
    new SetAlarmStateCommand({
      AlarmName: alarmName,
      StateValue: "OK",
      StateReason: "manual reset in scenario test",
    }),
  );

  // Step 5f: DescribeAlarmHistory — StateUpdate record must exist
  const history = await client.send(
    new DescribeAlarmHistoryCommand({ AlarmName: alarmName }),
  );
  const items = history.AlarmHistoryItems ?? [];
  expect(items.length).toBeGreaterThan(0);
  const stateUpdate = items.find((i) => i.HistoryItemType === "StateUpdate");
  expect(stateUpdate).toBeDefined();
  expect(stateUpdate?.AlarmName).toBe(alarmName);
  expect(stateUpdate?.HistorySummary).toContain("OK");
});
