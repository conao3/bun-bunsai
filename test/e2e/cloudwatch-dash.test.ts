import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CloudWatchClient,
  DeleteDashboardsCommand,
  DescribeAlarmsForMetricCommand,
  GetDashboardCommand,
  GetMetricDataCommand,
  ListDashboardsCommand,
  PutDashboardCommand,
  PutMetricAlarmCommand,
  PutMetricDataCommand,
  SetAlarmStateCommand,
} from "@aws-sdk/client-cloudwatch";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cw = () => new CloudWatchClient({ endpoint, region, credentials });

test("CloudWatch dashboard lifecycle round-trip", async () => {
  const client = cw();
  const dashboardName = "bunsai-e2e-dashboard";
  const body = JSON.stringify({
    widgets: [
      {
        type: "metric",
        properties: { metrics: [["bunsai/e2e", "RequestCount"]] },
      },
    ],
  });

  await client.send(
    new PutDashboardCommand({
      DashboardName: dashboardName,
      DashboardBody: body,
    }),
  );

  const got = await client.send(
    new GetDashboardCommand({ DashboardName: dashboardName }),
  );
  expect(got.DashboardName).toBe(dashboardName);
  expect(got.DashboardBody).toBe(body);
  expect(got.DashboardArn).toContain(`:dashboard/${dashboardName}`);

  const listed = await client.send(
    new ListDashboardsCommand({ DashboardNamePrefix: "bunsai-e2e" }),
  );
  const names = (listed.DashboardEntries ?? []).map((e) => e.DashboardName);
  expect(names).toContain(dashboardName);

  await client.send(
    new DeleteDashboardsCommand({ DashboardNames: [dashboardName] }),
  );
  const after = await client.send(
    new ListDashboardsCommand({ DashboardNamePrefix: "bunsai-e2e" }),
  );
  const remaining = (after.DashboardEntries ?? []).map((e) => e.DashboardName);
  expect(remaining).not.toContain(dashboardName);
});

test("CloudWatch SetAlarmState and DescribeAlarmsForMetric", async () => {
  const client = cw();
  const alarmName = "bunsai-e2e-state-alarm";
  const namespace = "bunsai/e2e";
  const metricName = "StateMetric";

  await client.send(
    new PutMetricAlarmCommand({
      AlarmName: alarmName,
      Namespace: namespace,
      MetricName: metricName,
      Statistic: "Sum",
      Period: 300,
      EvaluationPeriods: 1,
      Threshold: 50,
      ComparisonOperator: "GreaterThanThreshold",
    }),
  );

  await client.send(
    new SetAlarmStateCommand({
      AlarmName: alarmName,
      StateValue: "ALARM",
      StateReason: "e2e forced state",
    }),
  );

  const forMetric = await client.send(
    new DescribeAlarmsForMetricCommand({
      MetricName: metricName,
      Namespace: namespace,
    }),
  );
  const matched = forMetric.MetricAlarms ?? [];
  const target = matched.find((a) => a.AlarmName === alarmName);
  expect(target).toBeDefined();
  expect(target?.StateValue).toBe("ALARM");
});

test("CloudWatch GetMetricData round-trip", async () => {
  const client = cw();
  const namespace = "bunsai/e2e-gmd";
  const metricName = "GmdCount";
  const dimensions = [{ Name: "Service", Value: "gmd" }];
  const base = Math.floor(Date.now() / 1000) * 1000;

  await client.send(
    new PutMetricDataCommand({
      Namespace: namespace,
      MetricData: [
        {
          MetricName: metricName,
          Dimensions: dimensions,
          Value: 5,
          Unit: "Count",
          Timestamp: new Date(base),
        },
        {
          MetricName: metricName,
          Dimensions: dimensions,
          Value: 15,
          Unit: "Count",
          Timestamp: new Date(base + 1000),
        },
      ],
    }),
  );

  const data = await client.send(
    new GetMetricDataCommand({
      StartTime: new Date(base - 60000),
      EndTime: new Date(base + 60000),
      MetricDataQueries: [
        {
          Id: "q1",
          MetricStat: {
            Metric: {
              Namespace: namespace,
              MetricName: metricName,
              Dimensions: dimensions,
            },
            Period: 300,
            Stat: "Sum",
          },
          ReturnData: true,
        },
      ],
    }),
  );

  const results = data.MetricDataResults ?? [];
  expect(results.length).toBe(1);
  const result = results[0];
  expect(result?.Id).toBe("q1");
  expect(result?.Values ?? []).toContain(20);
});
