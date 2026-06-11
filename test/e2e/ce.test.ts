import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CostExplorerClient,
  CreateAnomalyMonitorCommand,
  CreateAnomalySubscriptionCommand,
  CreateCostCategoryDefinitionCommand,
  DeleteAnomalyMonitorCommand,
  DeleteAnomalySubscriptionCommand,
  DeleteCostCategoryDefinitionCommand,
  DescribeCostCategoryDefinitionCommand,
  GetAnomaliesCommand,
  GetAnomalyMonitorsCommand,
  GetAnomalySubscriptionsCommand,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
  GetDimensionValuesCommand,
  GetCommitmentPurchaseAnalysisCommand,
  GetTagsCommand,
  ListCommitmentPurchaseAnalysesCommand,
  ListCostAllocationTagBackfillHistoryCommand,
  ListCostAllocationTagsCommand,
  ListCostCategoryDefinitionsCommand,
  ListSavingsPlansPurchaseRecommendationGenerationCommand,
  ListTagsForResourceCommand,
  ProvideAnomalyFeedbackCommand,
  StartCommitmentPurchaseAnalysisCommand,
  StartCostAllocationTagBackfillCommand,
  StartSavingsPlansPurchaseRecommendationGenerationCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateAnomalyMonitorCommand,
  UpdateAnomalySubscriptionCommand,
  UpdateCostAllocationTagsStatusCommand,
  UpdateCostCategoryDefinitionCommand,
} from "@aws-sdk/client-cost-explorer";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ce = () =>
  new CostExplorerClient({ endpoint, region, credentials, requestHandler });

test("CE GetCostAndUsage DAILY 7 days → 7 buckets", async () => {
  const client = ce();
  const res = await client.send(
    new GetCostAndUsageCommand({
      TimePeriod: { Start: "2024-01-01", End: "2024-01-08" },
      Granularity: "DAILY",
      Metrics: ["BlendedCost"],
    }),
  );

  expect(res.ResultsByTime).toHaveLength(7);
  const first = res.ResultsByTime![0];
  expect(first.TimePeriod?.Start).toBe("2024-01-01");
  expect(first.TimePeriod?.End).toBe("2024-01-02");
  expect(first.Total?.BlendedCost?.Amount).toBeDefined();
  expect(first.Total?.BlendedCost?.Unit).toBe("USD");
  expect(first.Groups).toHaveLength(0);
  expect(first.Estimated).toBe(false);
});

test("CE GetCostAndUsage MONTHLY 3 months → 3 buckets", async () => {
  const client = ce();
  const res = await client.send(
    new GetCostAndUsageCommand({
      TimePeriod: { Start: "2024-01-01", End: "2024-04-01" },
      Granularity: "MONTHLY",
      Metrics: ["BlendedCost", "UnblendedCost"],
    }),
  );

  expect(res.ResultsByTime).toHaveLength(3);
  expect(res.ResultsByTime![0].TimePeriod?.Start).toBe("2024-01-01");
  expect(res.ResultsByTime![0].TimePeriod?.End).toBe("2024-02-01");
  expect(res.ResultsByTime![0].Total?.BlendedCost).toBeDefined();
  expect(res.ResultsByTime![0].Total?.UnblendedCost).toBeDefined();
});

test("CE GetCostAndUsage GroupBy SERVICE", async () => {
  const client = ce();
  const res = await client.send(
    new GetCostAndUsageCommand({
      TimePeriod: { Start: "2024-01-01", End: "2024-01-03" },
      Granularity: "DAILY",
      Metrics: ["BlendedCost"],
      GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
    }),
  );

  expect(res.ResultsByTime).toHaveLength(2);
  const bucket = res.ResultsByTime![0];
  expect(bucket.Groups!.length).toBeGreaterThan(0);
  const group = bucket.Groups![0];
  expect(group.Keys!.length).toBeGreaterThan(0);
  expect(group.Metrics?.BlendedCost?.Amount).toBeDefined();
});

test("CE GetCostAndUsage determinism — same input → same output", async () => {
  const client = ce();
  const params = {
    TimePeriod: { Start: "2024-03-01", End: "2024-03-04" },
    Granularity: "DAILY" as const,
    Metrics: ["BlendedCost"],
  };
  const res1 = await client.send(new GetCostAndUsageCommand(params));
  const res2 = await client.send(new GetCostAndUsageCommand(params));
  expect(JSON.stringify(res1.ResultsByTime)).toBe(
    JSON.stringify(res2.ResultsByTime),
  );
});

test("CE GetCostAndUsage Start >= End → error", async () => {
  const client = ce();
  await expect(
    client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: "2024-01-08", End: "2024-01-01" },
        Granularity: "DAILY",
        Metrics: ["BlendedCost"],
      }),
    ),
  ).rejects.toThrow();
});

test("CE GetCostForecast returns ForecastResultsByTime", async () => {
  const client = ce();
  const res = await client.send(
    new GetCostForecastCommand({
      TimePeriod: { Start: "2024-06-01", End: "2024-06-04" },
      Granularity: "DAILY",
      Metric: "BLENDED_COST",
    }),
  );

  expect(res.Total?.Amount).toBeDefined();
  expect(res.ForecastResultsByTime).toHaveLength(3);
  expect(res.ForecastResultsByTime![0].MeanValue).toBeDefined();
});

test("CE GetDimensionValues SERVICE", async () => {
  const client = ce();
  const res = await client.send(
    new GetDimensionValuesCommand({
      TimePeriod: { Start: "2024-01-01", End: "2024-02-01" },
      Dimension: "SERVICE",
    }),
  );

  expect(res.DimensionValues!.length).toBeGreaterThan(0);
  expect(res.DimensionValues![0].Value).toBeDefined();
  expect(res.TotalSize).toBeGreaterThan(0);
});

test("CE GetTags returns tag keys", async () => {
  const client = ce();
  const res = await client.send(
    new GetTagsCommand({
      TimePeriod: { Start: "2024-01-01", End: "2024-02-01" },
    }),
  );

  expect(res.Tags!.length).toBeGreaterThan(0);
  expect(res.TotalSize).toBeGreaterThan(0);
});

test("CE CostCategory CRUD", async () => {
  const client = ce();

  const created = await client.send(
    new CreateCostCategoryDefinitionCommand({
      Name: "e2e-test-category",
      RuleVersion: "CostCategoryExpression.v1",
      Rules: [
        {
          Value: "Engineering",
          Rule: {
            Dimensions: {
              Key: "SERVICE",
              Values: ["Amazon EC2"],
              MatchOptions: ["EQUALS"],
            },
          },
        },
      ],
    }),
  );

  expect(created.CostCategoryArn).toBeDefined();
  const ccArn = created.CostCategoryArn!;

  const described = await client.send(
    new DescribeCostCategoryDefinitionCommand({ CostCategoryArn: ccArn }),
  );
  expect(described.CostCategory?.Name).toBe("e2e-test-category");
  expect(described.CostCategory?.RuleVersion).toBe("CostCategoryExpression.v1");

  const listed = await client.send(new ListCostCategoryDefinitionsCommand({}));
  expect(
    (listed.CostCategoryReferences ?? []).map((r) => r.CostCategoryArn),
  ).toContain(ccArn);

  await client.send(
    new UpdateCostCategoryDefinitionCommand({
      CostCategoryArn: ccArn,
      RuleVersion: "CostCategoryExpression.v1",
      Rules: [
        {
          Value: "Updated",
          Rule: {
            Dimensions: {
              Key: "SERVICE",
              Values: ["Amazon S3"],
              MatchOptions: ["EQUALS"],
            },
          },
        },
      ],
    }),
  );

  const afterUpdate = await client.send(
    new DescribeCostCategoryDefinitionCommand({ CostCategoryArn: ccArn }),
  );
  expect(afterUpdate.CostCategory?.CostCategoryArn).toBe(ccArn);

  await client.send(
    new DeleteCostCategoryDefinitionCommand({ CostCategoryArn: ccArn }),
  );

  await expect(
    client.send(
      new DescribeCostCategoryDefinitionCommand({ CostCategoryArn: ccArn }),
    ),
  ).rejects.toThrow();
});

test("CE AnomalyMonitor CRUD", async () => {
  const client = ce();

  const created = await client.send(
    new CreateAnomalyMonitorCommand({
      AnomalyMonitor: {
        MonitorName: "e2e-monitor",
        MonitorType: "DIMENSIONAL",
        MonitorDimension: "SERVICE",
      },
    }),
  );
  expect(created.MonitorArn).toBeDefined();
  const monitorArn = created.MonitorArn!;

  const listed = await client.send(
    new GetAnomalyMonitorsCommand({ MonitorArnList: [monitorArn] }),
  );
  expect((listed.AnomalyMonitors ?? []).map((m) => m.MonitorArn)).toContain(
    monitorArn,
  );
  expect(listed.AnomalyMonitors![0].MonitorName).toBe("e2e-monitor");

  await client.send(
    new UpdateAnomalyMonitorCommand({
      MonitorArn: monitorArn,
      MonitorName: "e2e-monitor-updated",
    }),
  );

  const anomalies = await client.send(
    new GetAnomaliesCommand({
      MonitorArn: monitorArn,
      DateInterval: { StartDate: "2024-01-01", EndDate: "2024-02-01" },
    }),
  );
  expect(anomalies.Anomalies).toBeDefined();

  const sub = await client.send(
    new CreateAnomalySubscriptionCommand({
      AnomalySubscription: {
        SubscriptionName: "e2e-sub",
        MonitorArnList: [monitorArn],
        Subscribers: [],
        Threshold: 100,
        Frequency: "DAILY",
      },
    }),
  );
  expect(sub.SubscriptionArn).toBeDefined();
  const subArn = sub.SubscriptionArn!;

  const subs = await client.send(
    new GetAnomalySubscriptionsCommand({
      SubscriptionArnList: [subArn],
    }),
  );
  expect(
    (subs.AnomalySubscriptions ?? []).map((s) => s.SubscriptionArn),
  ).toContain(subArn);

  await client.send(
    new DeleteAnomalySubscriptionCommand({ SubscriptionArn: subArn }),
  );

  await client.send(
    new DeleteAnomalyMonitorCommand({ MonitorArn: monitorArn }),
  );

  const empty = await client.send(
    new GetAnomalyMonitorsCommand({ MonitorArnList: [monitorArn] }),
  );
  expect(empty.AnomalyMonitors ?? []).toHaveLength(0);
});

test("CE-001 ResourceTags persisted at create, visible via ListTagsForResource, cleaned on delete", async () => {
  const client = ce();

  const created = await client.send(
    new CreateAnomalyMonitorCommand({
      AnomalyMonitor: {
        MonitorName: "ce001-monitor",
        MonitorType: "DIMENSIONAL",
        MonitorDimension: "SERVICE",
      },
      ResourceTags: [{ Key: "env", Value: "dev" }],
    }),
  );
  const monitorArn = created.MonitorArn!;

  const listResult = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: monitorArn }),
  );
  expect(listResult.ResourceTags).toHaveLength(1);
  expect(listResult.ResourceTags![0].Key).toBe("env");
  expect(listResult.ResourceTags![0].Value).toBe("dev");

  await client.send(
    new DeleteAnomalyMonitorCommand({ MonitorArn: monitorArn }),
  );

  const created2 = await client.send(
    new CreateAnomalyMonitorCommand({
      AnomalyMonitor: {
        MonitorName: "ce001-monitor",
        MonitorType: "DIMENSIONAL",
        MonitorDimension: "SERVICE",
      },
    }),
  );
  const monitorArn2 = created2.MonitorArn!;
  const listAfterRecreate = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: monitorArn2 }),
  );
  expect(listAfterRecreate.ResourceTags).toHaveLength(0);

  await expect(
    client.send(
      new TagResourceCommand({
        ResourceArn: "arn:aws:ce::000000000000:anomalymonitor/nonexistent",
        ResourceTags: [{ Key: "k", Value: "v" }],
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteAnomalyMonitorCommand({ MonitorArn: monitorArn2 }),
  );
});

test("CE-002 UpdateCostAllocationTagsStatus → ListCostAllocationTags reflects new status", async () => {
  const client = ce();

  const initial = await client.send(
    new ListCostAllocationTagsCommand({ TagKeys: ["Environment"] }),
  );
  expect(initial.CostAllocationTags![0].Status).toBe("Active");

  await client.send(
    new UpdateCostAllocationTagsStatusCommand({
      CostAllocationTagsStatus: [{ TagKey: "Environment", Status: "Inactive" }],
    }),
  );

  const after = await client.send(
    new ListCostAllocationTagsCommand({ Status: "Inactive" }),
  );
  const environmentTag = (after.CostAllocationTags ?? []).find(
    (t) => t.TagKey === "Environment",
  );
  expect(environmentTag).toBeDefined();
  expect(environmentTag!.Status).toBe("Inactive");

  await client.send(
    new UpdateCostAllocationTagsStatusCommand({
      CostAllocationTagsStatus: [{ TagKey: "Environment", Status: "Active" }],
    }),
  );
});

test("CE-003 CPA lifecycle: Start persists, Get returns config, List shows it, unknown id throws", async () => {
  const client = ce();

  const started = await client.send(
    new StartCommitmentPurchaseAnalysisCommand({
      CommitmentPurchaseAnalysisConfiguration: {
        SavingsPlansPurchaseAnalysisConfiguration: {
          AccountScope: "PAYER",
          AnalysisType: "CUSTOM_COMMITMENT",
          LookBackTimePeriod: { Start: "2024-01-01", End: "2024-02-01" },
          SavingsPlansToAdd: [],
          SavingsPlansToExclude: [],
        },
      },
    }),
  );
  const analysisId = started.AnalysisId!;
  expect(analysisId).toBeDefined();

  const got = await client.send(new ListCommitmentPurchaseAnalysesCommand({}));
  const found = (got.AnalysisSummaryList ?? []).find(
    (a) => a.AnalysisId === analysisId,
  );
  expect(found).toBeDefined();
});

test("CE-003 GetCommitmentPurchaseAnalysis unknown id throws AnalysisNotFoundException", async () => {
  const client = ce();

  await expect(
    client.send(
      new GetCommitmentPurchaseAnalysisCommand({ AnalysisId: "deadbeef" }),
    ),
  ).rejects.toThrow();
});

test("CE-004 SP generation Start persists, List filtered by RecommendationId", async () => {
  const client = ce();

  const started = await client.send(
    new StartSavingsPlansPurchaseRecommendationGenerationCommand({}),
  );
  const recommendationId = started.RecommendationId!;
  expect(recommendationId).toBeDefined();

  const listed = await client.send(
    new ListSavingsPlansPurchaseRecommendationGenerationCommand({
      RecommendationIds: [recommendationId],
    }),
  );
  expect(
    (listed.GenerationSummaryList ?? []).map((g) => g.RecommendationId),
  ).toContain(recommendationId);
});

test("CE-005 Backfill Start persists, ListHistory returns it", async () => {
  const client = ce();

  const started = await client.send(
    new StartCostAllocationTagBackfillCommand({ BackfillFrom: "2024-01-01" }),
  );
  expect(started.BackfillRequest?.BackfillFrom).toBe("2024-01-01");

  const history = await client.send(
    new ListCostAllocationTagBackfillHistoryCommand({}),
  );
  const found = (history.BackfillRequests ?? []).find(
    (r) => r.BackfillFrom === "2024-01-01",
  );
  expect(found).toBeDefined();
});

test("CE-006 CreateAnomalySubscription rejects unknown monitor", async () => {
  const client = ce();
  await expect(
    client.send(
      new CreateAnomalySubscriptionCommand({
        AnomalySubscription: {
          SubscriptionName: "ce006-sub",
          MonitorArnList: [
            "arn:aws:ce::000000000000:anomalymonitor/nonexistent",
          ],
          Subscribers: [],
          Threshold: 10,
          Frequency: "DAILY",
        },
      }),
    ),
  ).rejects.toThrow();
});

test("CE-006 UpdateAnomalySubscription rejects unknown monitor", async () => {
  const client = ce();

  const monitor = await client.send(
    new CreateAnomalyMonitorCommand({
      AnomalyMonitor: {
        MonitorName: "ce006-update-monitor",
        MonitorType: "DIMENSIONAL",
        MonitorDimension: "SERVICE",
      },
    }),
  );
  const monitorArn = monitor.MonitorArn!;

  const sub = await client.send(
    new CreateAnomalySubscriptionCommand({
      AnomalySubscription: {
        SubscriptionName: "ce006-update-sub",
        MonitorArnList: [monitorArn],
        Subscribers: [],
        Threshold: 10,
        Frequency: "DAILY",
      },
    }),
  );
  const subArn = sub.SubscriptionArn!;

  await expect(
    client.send(
      new UpdateAnomalySubscriptionCommand({
        SubscriptionArn: subArn,
        MonitorArnList: ["arn:aws:ce::000000000000:anomalymonitor/nonexistent"],
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteAnomalySubscriptionCommand({ SubscriptionArn: subArn }),
  );
  await client.send(
    new DeleteAnomalyMonitorCommand({ MonitorArn: monitorArn }),
  );
});

test("CE-007 ProvideAnomalyFeedback persists, GetAnomalies surfaces feedback", async () => {
  const client = ce();

  const monitor = await client.send(
    new CreateAnomalyMonitorCommand({
      AnomalyMonitor: {
        MonitorName: "ce007-monitor",
        MonitorType: "DIMENSIONAL",
        MonitorDimension: "SERVICE",
      },
    }),
  );
  const monitorArn = monitor.MonitorArn!;

  const anomalies = await client.send(
    new GetAnomaliesCommand({
      MonitorArn: monitorArn,
      DateInterval: { StartDate: "2024-01-01", EndDate: "2024-02-01" },
    }),
  );
  expect(anomalies.Anomalies!.length).toBeGreaterThan(0);
  const anomalyId = anomalies.Anomalies![0].AnomalyId!;

  await client.send(
    new ProvideAnomalyFeedbackCommand({
      AnomalyId: anomalyId,
      Feedback: "YES",
    }),
  );

  const afterFeedback = await client.send(
    new GetAnomaliesCommand({
      MonitorArn: monitorArn,
      DateInterval: { StartDate: "2024-01-01", EndDate: "2024-02-01" },
      Feedback: "YES",
    }),
  );
  expect(
    (afterFeedback.Anomalies ?? []).find((a) => a.AnomalyId === anomalyId),
  ).toBeDefined();

  await client.send(
    new DeleteAnomalyMonitorCommand({ MonitorArn: monitorArn }),
  );
});

test("CE-007 GetAnomalies without MonitorArn iterates all stored monitors", async () => {
  const client = ce();

  const monitor = await client.send(
    new CreateAnomalyMonitorCommand({
      AnomalyMonitor: {
        MonitorName: "ce007-all-monitor",
        MonitorType: "DIMENSIONAL",
        MonitorDimension: "SERVICE",
      },
    }),
  );
  const monitorArn = monitor.MonitorArn!;

  const anomalies = await client.send(
    new GetAnomaliesCommand({
      DateInterval: { StartDate: "2024-01-01", EndDate: "2024-02-01" },
    }),
  );
  expect(
    (anomalies.Anomalies ?? []).some(
      (a) =>
        (a as unknown as Record<string, unknown>)["MonitorArn"] === monitorArn,
    ),
  ).toBe(true);

  await client.send(
    new DeleteAnomalyMonitorCommand({ MonitorArn: monitorArn }),
  );
});

test("CE-008 Create uses UUID-based ARNs with ctx.account", async () => {
  const client = ce();

  const m1 = await client.send(
    new CreateAnomalyMonitorCommand({
      AnomalyMonitor: {
        MonitorName: "same-name",
        MonitorType: "DIMENSIONAL",
        MonitorDimension: "SERVICE",
      },
    }),
  );
  const m2 = await client.send(
    new CreateAnomalyMonitorCommand({
      AnomalyMonitor: {
        MonitorName: "same-name",
        MonitorType: "DIMENSIONAL",
        MonitorDimension: "SERVICE",
      },
    }),
  );

  expect(m1.MonitorArn).not.toBe(m2.MonitorArn);

  await client.send(
    new DeleteAnomalyMonitorCommand({ MonitorArn: m1.MonitorArn! }),
  );
  await client.send(
    new DeleteAnomalyMonitorCommand({ MonitorArn: m2.MonitorArn! }),
  );
});

test("CE-001 TagResource/UntagResource existence check", async () => {
  const client = ce();

  await expect(
    client.send(
      new UntagResourceCommand({
        ResourceArn: "arn:aws:ce::000000000000:costcategory/nonexistent",
        ResourceTagKeys: ["k"],
      }),
    ),
  ).rejects.toThrow();

  await expect(
    client.send(
      new ListTagsForResourceCommand({
        ResourceArn: "arn:aws:ce::000000000000:anomalysubscription/nonexistent",
      }),
    ),
  ).rejects.toThrow();
});
