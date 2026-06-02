import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CloudWatchClient,
  DeleteAlarmsCommand,
  DescribeAlarmsCommand,
  GetMetricStatisticsCommand,
  ListMetricsCommand,
  PutMetricAlarmCommand,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const cw = () => new CloudWatchClient({ endpoint, region, credentials });

test("CloudWatch metric data and statistics round-trip", async () => {
  const client = cw();
  const namespace = "bunsai/e2e";
  const metricName = "RequestCount";
  const dimensions = [{ Name: "Service", Value: "api" }];

  const base = Math.floor(Date.now() / 1000) * 1000;
  await client.send(
    new PutMetricDataCommand({
      Namespace: namespace,
      MetricData: [
        {
          MetricName: metricName,
          Dimensions: dimensions,
          Value: 10,
          Unit: "Count",
          Timestamp: new Date(base),
        },
        {
          MetricName: metricName,
          Dimensions: dimensions,
          Value: 30,
          Unit: "Count",
          Timestamp: new Date(base + 1000),
        },
      ],
    }),
  );

  const listed = await client.send(
    new ListMetricsCommand({ Namespace: namespace }),
  );
  const names = (listed.Metrics ?? []).map((m) => m.MetricName);
  expect(names).toContain(metricName);

  const stats = await client.send(
    new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: new Date(base - 60000),
      EndTime: new Date(base + 60000),
      Period: 300,
      Statistics: ["Sum", "Average", "Maximum", "Minimum", "SampleCount"],
    }),
  );
  expect(stats.Label).toBe(metricName);
  const points = stats.Datapoints ?? [];
  expect(points.length).toBe(1);
  const point = points[0];
  expect(point?.Sum).toBe(40);
  expect(point?.Average).toBe(20);
  expect(point?.Maximum).toBe(30);
  expect(point?.Minimum).toBe(10);
  expect(point?.SampleCount).toBe(2);
});

test("CloudWatch alarm lifecycle round-trip", async () => {
  const client = cw();
  const alarmName = "bunsai-e2e-alarm";

  await client.send(
    new PutMetricAlarmCommand({
      AlarmName: alarmName,
      AlarmDescription: "e2e alarm",
      Namespace: "bunsai/e2e",
      MetricName: "RequestCount",
      Statistic: "Sum",
      Period: 300,
      EvaluationPeriods: 1,
      Threshold: 100,
      ComparisonOperator: "GreaterThanThreshold",
    }),
  );

  const described = await client.send(
    new DescribeAlarmsCommand({ AlarmNames: [alarmName] }),
  );
  const alarms = described.MetricAlarms ?? [];
  expect(alarms.length).toBe(1);
  expect(alarms[0]?.AlarmName).toBe(alarmName);
  expect(alarms[0]?.Threshold).toBe(100);
  expect(alarms[0]?.ComparisonOperator).toBe("GreaterThanThreshold");
  expect(alarms[0]?.AlarmArn).toContain(":alarm:bunsai-e2e-alarm");

  await client.send(new DeleteAlarmsCommand({ AlarmNames: [alarmName] }));
  const after = await client.send(
    new DescribeAlarmsCommand({ AlarmNames: [alarmName] }),
  );
  const remaining = (after.MetricAlarms ?? []).map((a) => a.AlarmName);
  expect(remaining).not.toContain(alarmName);
});
