import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudWatchClient,
  DeleteAlarmMuteRuleCommand,
  DeleteAlarmsCommand,
  DeleteAnomalyDetectorCommand,
  DeleteInsightRulesCommand,
  DeleteMetricStreamCommand,
  DescribeAlarmHistoryCommand,
  DescribeAlarmsCommand,
  DescribeAnomalyDetectorsCommand,
  DescribeInsightRulesCommand,
  DisableAlarmActionsCommand,
  DisableInsightRulesCommand,
  EnableAlarmActionsCommand,
  EnableInsightRulesCommand,
  GetAlarmMuteRuleCommand,
  GetInsightRuleReportCommand,
  GetMetricStatisticsCommand,
  GetMetricStreamCommand,
  GetMetricWidgetImageCommand,
  GetOTelEnrichmentCommand,
  ListAlarmMuteRulesCommand,
  ListManagedInsightRulesCommand,
  ListMetricStreamsCommand,
  ListMetricsCommand,
  ListTagsForResourceCommand,
  PutAlarmMuteRuleCommand,
  PutAnomalyDetectorCommand,
  PutCompositeAlarmCommand,
  PutInsightRuleCommand,
  PutManagedInsightRulesCommand,
  PutMetricAlarmCommand,
  PutMetricDataCommand,
  PutMetricStreamCommand,
  StartMetricStreamsCommand,
  StartOTelEnrichmentCommand,
  StopMetricStreamsCommand,
  StopOTelEnrichmentCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-cloudwatch";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cw = () =>
  new CloudWatchClient({ endpoint, region, credentials, requestHandler });

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

test("CloudWatch PutCompositeAlarm and EnableAlarmActions/DisableAlarmActions", async () => {
  const client = cw();
  const metricAlarmName = "bunsai-e2e-metric-alarm-actions";
  const compositeAlarmName = "bunsai-e2e-composite-alarm";

  await client.send(
    new PutMetricAlarmCommand({
      AlarmName: metricAlarmName,
      Namespace: "bunsai/e2e",
      MetricName: "ActionsMetric",
      Statistic: "Sum",
      Period: 300,
      EvaluationPeriods: 1,
      Threshold: 100,
      ComparisonOperator: "GreaterThanThreshold",
    }),
  );

  await client.send(
    new PutCompositeAlarmCommand({
      AlarmName: compositeAlarmName,
      AlarmRule: `ALARM("${metricAlarmName}")`,
      AlarmDescription: "e2e composite alarm",
    }),
  );

  const described = await client.send(
    new DescribeAlarmsCommand({
      AlarmNames: [compositeAlarmName],
      AlarmTypes: ["CompositeAlarm"],
    }),
  );
  const compositeAlarms = described.CompositeAlarms ?? [];
  expect(compositeAlarms.length).toBe(1);
  expect(compositeAlarms[0]?.AlarmName).toBe(compositeAlarmName);
  expect(compositeAlarms[0]?.AlarmRule).toContain(metricAlarmName);
  expect(compositeAlarms[0]?.ActionsEnabled).toBe(true);

  await client.send(
    new DisableAlarmActionsCommand({ AlarmNames: [metricAlarmName] }),
  );
  const afterDisable = await client.send(
    new DescribeAlarmsCommand({ AlarmNames: [metricAlarmName] }),
  );
  expect(afterDisable.MetricAlarms?.[0]?.ActionsEnabled).toBe(false);

  await client.send(
    new EnableAlarmActionsCommand({ AlarmNames: [metricAlarmName] }),
  );
  const afterEnable = await client.send(
    new DescribeAlarmsCommand({ AlarmNames: [metricAlarmName] }),
  );
  expect(afterEnable.MetricAlarms?.[0]?.ActionsEnabled).toBe(true);

  await client.send(
    new DeleteAlarmsCommand({
      AlarmNames: [metricAlarmName, compositeAlarmName],
    }),
  );
});

test("CloudWatch DescribeAlarmHistory returns empty list", async () => {
  const client = cw();
  const result = await client.send(new DescribeAlarmHistoryCommand({}));
  expect(result.AlarmHistoryItems).toBeDefined();
  expect(Array.isArray(result.AlarmHistoryItems)).toBe(true);
});

test("CloudWatch anomaly detector lifecycle", async () => {
  const client = cw();

  await client.send(
    new PutAnomalyDetectorCommand({
      SingleMetricAnomalyDetector: {
        Namespace: "bunsai/e2e",
        MetricName: "AnomalyMetric",
        Stat: "Average",
      },
    }),
  );

  const described = await client.send(
    new DescribeAnomalyDetectorsCommand({
      Namespace: "bunsai/e2e",
    }),
  );
  const detectors = described.AnomalyDetectors ?? [];
  const found = detectors.find(
    (d) =>
      d.SingleMetricAnomalyDetector?.MetricName === "AnomalyMetric" &&
      d.SingleMetricAnomalyDetector?.Namespace === "bunsai/e2e",
  );
  expect(found).toBeDefined();

  await client.send(
    new DeleteAnomalyDetectorCommand({
      SingleMetricAnomalyDetector: {
        Namespace: "bunsai/e2e",
        MetricName: "AnomalyMetric",
        Stat: "Average",
      },
    }),
  );

  const afterDelete = await client.send(
    new DescribeAnomalyDetectorsCommand({
      Namespace: "bunsai/e2e",
    }),
  );
  const remaining = (afterDelete.AnomalyDetectors ?? []).find(
    (d) => d.SingleMetricAnomalyDetector?.MetricName === "AnomalyMetric",
  );
  expect(remaining).toBeUndefined();
});

test("CloudWatch insight rules lifecycle", async () => {
  const client = cw();
  const ruleName = "bunsai-e2e-insight-rule";
  const ruleDefinition = JSON.stringify({
    Schema: "CloudWatchLogRule",
    LogGroupNames: ["/aws/lambda/my-function"],
    LogFormat: "JSON",
    Fields: ["$.requestId"],
    Contribution: { Keys: ["$.requestId"] },
    AggregateOn: "Count",
  });

  await client.send(
    new PutInsightRuleCommand({
      RuleName: ruleName,
      RuleDefinition: ruleDefinition,
    }),
  );

  const described = await client.send(new DescribeInsightRulesCommand({}));
  const rules = described.InsightRules ?? [];
  const found = rules.find((r) => r.Name === ruleName);
  expect(found).toBeDefined();
  expect(found?.State).toBe("ENABLED");

  await client.send(new DisableInsightRulesCommand({ RuleNames: [ruleName] }));
  const afterDisable = await client.send(new DescribeInsightRulesCommand({}));
  const disabled = (afterDisable.InsightRules ?? []).find(
    (r) => r.Name === ruleName,
  );
  expect(disabled?.State).toBe("DISABLED");

  await client.send(new EnableInsightRulesCommand({ RuleNames: [ruleName] }));
  const afterEnable = await client.send(new DescribeInsightRulesCommand({}));
  const enabled = (afterEnable.InsightRules ?? []).find(
    (r) => r.Name === ruleName,
  );
  expect(enabled?.State).toBe("ENABLED");

  const report = await client.send(
    new GetInsightRuleReportCommand({
      RuleName: ruleName,
      StartTime: new Date(Date.now() - 3600000),
      EndTime: new Date(),
      Period: 300,
    }),
  );
  expect(report.Contributors).toBeDefined();
  expect(Array.isArray(report.Contributors)).toBe(true);

  await client.send(new DeleteInsightRulesCommand({ RuleNames: [ruleName] }));
  const afterDelete = await client.send(new DescribeInsightRulesCommand({}));
  const deleted = (afterDelete.InsightRules ?? []).find(
    (r) => r.Name === ruleName,
  );
  expect(deleted).toBeUndefined();
});

test("CloudWatch metric stream lifecycle", async () => {
  const client = cw();
  const streamName = "bunsai-e2e-metric-stream";

  const putResult = await client.send(
    new PutMetricStreamCommand({
      Name: streamName,
      FirehoseArn:
        "arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream",
      RoleArn: "arn:aws:iam::123456789012:role/my-role",
      OutputFormat: "json",
    }),
  );
  expect(putResult.Arn).toContain(streamName);

  const got = await client.send(
    new GetMetricStreamCommand({ Name: streamName }),
  );
  expect(got.Name).toBe(streamName);
  expect(got.OutputFormat).toBe("json");
  expect(got.State).toBe("running");

  await client.send(new StopMetricStreamsCommand({ Names: [streamName] }));
  const stopped = await client.send(
    new GetMetricStreamCommand({ Name: streamName }),
  );
  expect(stopped.State).toBe("stopped");

  await client.send(new StartMetricStreamsCommand({ Names: [streamName] }));
  const started = await client.send(
    new GetMetricStreamCommand({ Name: streamName }),
  );
  expect(started.State).toBe("running");

  const listed = await client.send(new ListMetricStreamsCommand({}));
  const streams = listed.Entries ?? [];
  const found = streams.find((s) => s.Name === streamName);
  expect(found).toBeDefined();

  await client.send(new DeleteMetricStreamCommand({ Name: streamName }));
  const afterDelete = await client.send(new ListMetricStreamsCommand({}));
  const remaining = (afterDelete.Entries ?? []).find(
    (s) => s.Name === streamName,
  );
  expect(remaining).toBeUndefined();
});

test("CloudWatch GetMetricWidgetImage returns image data", async () => {
  const client = cw();
  const result = await client.send(
    new GetMetricWidgetImageCommand({
      MetricWidget: JSON.stringify({
        metrics: [["AWS/EC2", "CPUUtilization"]],
        period: 300,
        start: "-PT1H",
        end: "PT0H",
        view: "timeSeries",
      }),
    }),
  );
  expect(result.MetricWidgetImage).toBeDefined();
});

test("CloudWatch OTel enrichment operations", async () => {
  const client = cw();

  const status = await client.send(new GetOTelEnrichmentCommand({}));
  expect(status.Status).toBe("Stopped");

  await expect(
    client.send(new StartOTelEnrichmentCommand({})),
  ).resolves.toBeDefined();

  await expect(
    client.send(new StopOTelEnrichmentCommand({})),
  ).resolves.toBeDefined();
});

test("CloudWatch tag operations", async () => {
  const client = cw();
  const alarmName = "bunsai-e2e-tagging-alarm";

  await client.send(
    new PutMetricAlarmCommand({
      AlarmName: alarmName,
      Namespace: "bunsai/e2e",
      MetricName: "TagMetric",
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
  const alarmArn = described.MetricAlarms?.[0]?.AlarmArn ?? "";
  expect(alarmArn).toContain(alarmName);

  await client.send(
    new TagResourceCommand({
      ResourceARN: alarmArn,
      Tags: [
        { Key: "env", Value: "e2e" },
        { Key: "team", Value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: alarmArn }),
  );
  const tagMap = Object.fromEntries(
    (listed.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap["env"]).toBe("e2e");
  expect(tagMap["team"]).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ ResourceARN: alarmArn, TagKeys: ["team"] }),
  );
  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: alarmArn }),
  );
  const remaining = Object.fromEntries(
    (afterUntag.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(remaining["env"]).toBe("e2e");
  expect(remaining["team"]).toBeUndefined();

  await client.send(new DeleteAlarmsCommand({ AlarmNames: [alarmName] }));
});

test("CloudWatch alarm mute rule lifecycle", async () => {
  const client = cw();
  const ruleName = "bunsai-e2e-mute-rule";

  await client.send(
    new PutAlarmMuteRuleCommand({
      Name: ruleName,
      Rule: { Schedule: "cron(0 0 * * ? *)" },
      Description: "e2e mute rule",
    }),
  );

  const got = await client.send(
    new GetAlarmMuteRuleCommand({ AlarmMuteRuleName: ruleName }),
  );
  expect(got.Name).toBe(ruleName);
  expect(got.Description).toBe("e2e mute rule");
  expect(got.AlarmMuteRuleArn).toContain(ruleName);

  const listed = await client.send(new ListAlarmMuteRulesCommand({}));
  const rules = listed.AlarmMuteRuleSummaries ?? [];
  const found = rules.find((r) => r.AlarmMuteRuleArn?.includes(ruleName));
  expect(found).toBeDefined();

  await client.send(
    new DeleteAlarmMuteRuleCommand({ AlarmMuteRuleName: ruleName }),
  );
  await expect(
    client.send(new GetAlarmMuteRuleCommand({ AlarmMuteRuleName: ruleName })),
  ).rejects.toThrow();
});

test("CloudWatch managed insight rules lifecycle", async () => {
  const client = cw();
  const resourceArn =
    "arn:aws:lambda:us-east-1:123456789012:function:my-function";

  await client.send(
    new PutManagedInsightRulesCommand({
      ManagedRules: [
        { TemplateName: "LambdaInsightRule", ResourceARN: resourceArn },
      ],
    }),
  );

  const listed = await client.send(
    new ListManagedInsightRulesCommand({ ResourceARN: resourceArn }),
  );
  const rules = listed.ManagedRules ?? [];
  const found = rules.find((r) => r.TemplateName === "LambdaInsightRule");
  expect(found).toBeDefined();
  expect(found?.ResourceARN).toBe(resourceArn);
});
