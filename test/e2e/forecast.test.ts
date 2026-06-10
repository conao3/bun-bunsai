import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateAutoPredictorCommand,
  CreateDatasetCommand,
  CreateDatasetGroupCommand,
  CreateDatasetImportJobCommand,
  CreateExplainabilityCommand,
  CreateExplainabilityExportCommand,
  CreateForecastCommand,
  CreateForecastExportJobCommand,
  CreateMonitorCommand,
  CreatePredictorBacktestExportJobCommand,
  CreatePredictorCommand,
  CreateWhatIfAnalysisCommand,
  CreateWhatIfForecastCommand,
  CreateWhatIfForecastExportCommand,
  DeleteDatasetCommand,
  DeleteDatasetGroupCommand,
  DeleteDatasetImportJobCommand,
  DeleteExplainabilityCommand,
  DeleteExplainabilityExportCommand,
  DeleteForecastCommand,
  DeleteForecastExportJobCommand,
  DeleteMonitorCommand,
  DeletePredictorBacktestExportJobCommand,
  DeletePredictorCommand,
  DeleteResourceTreeCommand,
  DeleteWhatIfAnalysisCommand,
  DeleteWhatIfForecastCommand,
  DeleteWhatIfForecastExportCommand,
  DescribeAutoPredictorCommand,
  DescribeDatasetCommand,
  DescribeDatasetGroupCommand,
  DescribeDatasetImportJobCommand,
  DescribeExplainabilityCommand,
  DescribeExplainabilityExportCommand,
  DescribeForecastCommand,
  DescribeForecastExportJobCommand,
  DescribeMonitorCommand,
  DescribePredictorBacktestExportJobCommand,
  DescribePredictorCommand,
  DescribeWhatIfAnalysisCommand,
  DescribeWhatIfForecastCommand,
  DescribeWhatIfForecastExportCommand,
  ForecastClient,
  GetAccuracyMetricsCommand,
  ListDatasetGroupsCommand,
  ListDatasetImportJobsCommand,
  ListDatasetsCommand,
  ListExplainabilitiesCommand,
  ListExplainabilityExportsCommand,
  ListForecastExportJobsCommand,
  ListForecastsCommand,
  ListMonitorEvaluationsCommand,
  ListMonitorsCommand,
  ListPredictorBacktestExportJobsCommand,
  ListPredictorsCommand,
  ListTagsForResourceCommand,
  ListWhatIfAnalysesCommand,
  ListWhatIfForecastExportsCommand,
  ListWhatIfForecastsCommand,
  ResumeResourceCommand,
  StopResourceCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateDatasetGroupCommand,
} from "@aws-sdk/client-forecast";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const forecast = () =>
  new ForecastClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Forecast dataset lifecycle", async () => {
  const client = forecast();
  const DatasetName = "bunsai_e2e_dataset";

  const created = await client.send(
    new CreateDatasetCommand({
      DatasetName,
      Domain: "CUSTOM",
      DatasetType: "TARGET_TIME_SERIES",
      Schema: {
        Attributes: [
          { AttributeName: "timestamp", AttributeType: "timestamp" },
          { AttributeName: "target_value", AttributeType: "float" },
        ],
      },
    }),
  );
  const DatasetArn = created.DatasetArn;
  expect(typeof DatasetArn).toBe("string");

  const listed = await client.send(new ListDatasetsCommand({}));
  const arns = (listed.Datasets ?? []).map((d) => d.DatasetArn);
  expect(arns).toContain(DatasetArn);

  const described = await client.send(
    new DescribeDatasetCommand({ DatasetArn: DatasetArn as string }),
  );
  expect(described.DatasetArn).toBe(DatasetArn);
  expect(described.DatasetName).toBe(DatasetName);
  expect(described.Status).toBe("ACTIVE");

  await client.send(
    new DeleteDatasetCommand({ DatasetArn: DatasetArn as string }),
  );

  const afterDelete = await client.send(new ListDatasetsCommand({}));
  const afterArns = (afterDelete.Datasets ?? []).map((d) => d.DatasetArn);
  expect(afterArns).not.toContain(DatasetArn);
});

test("Forecast dataset group lifecycle", async () => {
  const client = forecast();

  const created = await client.send(
    new CreateDatasetGroupCommand({
      DatasetGroupName: "bunsai_e2e_dsg",
      Domain: "CUSTOM",
    }),
  );
  const DatasetGroupArn = created.DatasetGroupArn as string;
  expect(typeof DatasetGroupArn).toBe("string");

  const described = await client.send(
    new DescribeDatasetGroupCommand({ DatasetGroupArn }),
  );
  expect(described.DatasetGroupArn).toBe(DatasetGroupArn);
  expect(described.Status).toBe("ACTIVE");

  const listed = await client.send(new ListDatasetGroupsCommand({}));
  expect((listed.DatasetGroups ?? []).map((g) => g.DatasetGroupArn)).toContain(
    DatasetGroupArn,
  );

  await client.send(
    new UpdateDatasetGroupCommand({ DatasetGroupArn, DatasetArns: [] }),
  );

  const afterUpdate = await client.send(
    new DescribeDatasetGroupCommand({ DatasetGroupArn }),
  );
  expect(afterUpdate.DatasetArns).toEqual([]);

  await client.send(new DeleteDatasetGroupCommand({ DatasetGroupArn }));

  const afterDelete = await client.send(new ListDatasetGroupsCommand({}));
  expect(
    (afterDelete.DatasetGroups ?? []).map((g) => g.DatasetGroupArn),
  ).not.toContain(DatasetGroupArn);
});

test("Forecast dataset import job lifecycle", async () => {
  const client = forecast();

  const ds = await client.send(
    new CreateDatasetCommand({
      DatasetName: "bunsai_e2e_ds_for_import",
      Domain: "CUSTOM",
      DatasetType: "TARGET_TIME_SERIES",
      Schema: {
        Attributes: [
          { AttributeName: "timestamp", AttributeType: "timestamp" },
          { AttributeName: "target_value", AttributeType: "float" },
        ],
      },
    }),
  );
  const DatasetArn = ds.DatasetArn as string;

  const created = await client.send(
    new CreateDatasetImportJobCommand({
      DatasetImportJobName: "bunsai_e2e_import_job",
      DatasetArn,
      DataSource: {
        S3Config: {
          Path: "s3://bucket/key",
          RoleArn: "arn:aws:iam::123456789012:role/role",
        },
      },
    }),
  );
  const DatasetImportJobArn = created.DatasetImportJobArn as string;
  expect(typeof DatasetImportJobArn).toBe("string");

  const described = await client.send(
    new DescribeDatasetImportJobCommand({ DatasetImportJobArn }),
  );
  expect(described.DatasetImportJobArn).toBe(DatasetImportJobArn);
  expect(described.Status).toBe("ACTIVE");

  const listed = await client.send(new ListDatasetImportJobsCommand({}));
  expect(
    (listed.DatasetImportJobs ?? []).map((j) => j.DatasetImportJobArn),
  ).toContain(DatasetImportJobArn);

  await client.send(new DeleteDatasetImportJobCommand({ DatasetImportJobArn }));

  const afterDelete = await client.send(new ListDatasetImportJobsCommand({}));
  expect(
    (afterDelete.DatasetImportJobs ?? []).map((j) => j.DatasetImportJobArn),
  ).not.toContain(DatasetImportJobArn);

  await client.send(new DeleteDatasetCommand({ DatasetArn }));
});

test("Forecast auto predictor lifecycle", async () => {
  const client = forecast();

  const created = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_auto_predictor",
    }),
  );
  const PredictorArn = created.PredictorArn as string;
  expect(typeof PredictorArn).toBe("string");

  const described = await client.send(
    new DescribeAutoPredictorCommand({ PredictorArn }),
  );
  expect(described.PredictorArn).toBe(PredictorArn);
  expect(described.Status).toBe("ACTIVE");

  const metrics = await client.send(
    new GetAccuracyMetricsCommand({ PredictorArn }),
  );
  expect(metrics.IsAutoPredictor).toBe(true);
  expect(Array.isArray(metrics.PredictorEvaluationResults)).toBe(true);

  const listed = await client.send(new ListPredictorsCommand({}));
  expect((listed.Predictors ?? []).map((p) => p.PredictorArn)).toContain(
    PredictorArn,
  );

  await client.send(new DeletePredictorCommand({ PredictorArn }));

  const afterDelete = await client.send(new ListPredictorsCommand({}));
  expect(
    (afterDelete.Predictors ?? []).map((p) => p.PredictorArn),
  ).not.toContain(PredictorArn);
});

test("Forecast predictor lifecycle", async () => {
  const client = forecast();

  const dsg = await client.send(
    new CreateDatasetGroupCommand({
      DatasetGroupName: "bunsai_e2e_dsg_for_pred",
      Domain: "CUSTOM",
    }),
  );
  const DatasetGroupArn = dsg.DatasetGroupArn as string;

  const created = await client.send(
    new CreatePredictorCommand({
      PredictorName: "bunsai_e2e_predictor",
      ForecastHorizon: 10,
      InputDataConfig: { DatasetGroupArn },
      FeaturizationConfig: { ForecastFrequency: "D" },
    }),
  );
  const PredictorArn = created.PredictorArn as string;
  expect(typeof PredictorArn).toBe("string");

  const described = await client.send(
    new DescribePredictorCommand({ PredictorArn }),
  );
  expect(described.PredictorArn).toBe(PredictorArn);
  expect(described.ForecastHorizon).toBe(10);

  await client.send(new DeletePredictorCommand({ PredictorArn }));
  await client.send(new DeleteDatasetGroupCommand({ DatasetGroupArn }));
});

test("Forecast forecast lifecycle", async () => {
  const client = forecast();

  const pred = await client.send(
    new CreateAutoPredictorCommand({ PredictorName: "bunsai_e2e_pred_for_fc" }),
  );
  const PredictorArn = pred.PredictorArn as string;

  const created = await client.send(
    new CreateForecastCommand({
      ForecastName: "bunsai_e2e_forecast",
      PredictorArn,
    }),
  );
  const ForecastArn = created.ForecastArn as string;
  expect(typeof ForecastArn).toBe("string");

  const described = await client.send(
    new DescribeForecastCommand({ ForecastArn }),
  );
  expect(described.ForecastArn).toBe(ForecastArn);
  expect(described.PredictorArn).toBe(PredictorArn);

  const listed = await client.send(new ListForecastsCommand({}));
  expect((listed.Forecasts ?? []).map((f) => f.ForecastArn)).toContain(
    ForecastArn,
  );

  await client.send(new DeleteForecastCommand({ ForecastArn }));
  await client.send(new DeletePredictorCommand({ PredictorArn }));
});

test("Forecast forecast export job lifecycle", async () => {
  const client = forecast();

  const pred = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_pred_for_fej",
    }),
  );
  const fc = await client.send(
    new CreateForecastCommand({
      ForecastName: "bunsai_e2e_fc_for_fej",
      PredictorArn: pred.PredictorArn as string,
    }),
  );
  const ForecastArn = fc.ForecastArn as string;

  const created = await client.send(
    new CreateForecastExportJobCommand({
      ForecastExportJobName: "bunsai_e2e_fej",
      ForecastArn,
      Destination: {
        S3Config: {
          Path: "s3://bucket/key",
          RoleArn: "arn:aws:iam::123456789012:role/role",
        },
      },
    }),
  );
  const ForecastExportJobArn = created.ForecastExportJobArn as string;
  expect(typeof ForecastExportJobArn).toBe("string");

  const described = await client.send(
    new DescribeForecastExportJobCommand({ ForecastExportJobArn }),
  );
  expect(described.ForecastExportJobArn).toBe(ForecastExportJobArn);

  const listed = await client.send(new ListForecastExportJobsCommand({}));
  expect(
    (listed.ForecastExportJobs ?? []).map((j) => j.ForecastExportJobArn),
  ).toContain(ForecastExportJobArn);

  await client.send(
    new DeleteForecastExportJobCommand({ ForecastExportJobArn }),
  );
  await client.send(new DeleteForecastCommand({ ForecastArn }));
  await client.send(
    new DeletePredictorCommand({ PredictorArn: pred.PredictorArn as string }),
  );
});

test("Forecast explainability lifecycle", async () => {
  const client = forecast();

  const pred = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_pred_for_exp",
    }),
  );
  const ResourceArn = pred.PredictorArn as string;

  const created = await client.send(
    new CreateExplainabilityCommand({
      ExplainabilityName: "bunsai_e2e_explain",
      ResourceArn,
      ExplainabilityConfig: {
        TimeSeriesGranularity: "ALL",
        TimePointGranularity: "ALL",
      },
    }),
  );
  const ExplainabilityArn = created.ExplainabilityArn as string;
  expect(typeof ExplainabilityArn).toBe("string");

  const described = await client.send(
    new DescribeExplainabilityCommand({ ExplainabilityArn }),
  );
  expect(described.ExplainabilityArn).toBe(ExplainabilityArn);

  const listed = await client.send(new ListExplainabilitiesCommand({}));
  expect(
    (listed.Explainabilities ?? []).map((e) => e.ExplainabilityArn),
  ).toContain(ExplainabilityArn);

  await client.send(new DeleteExplainabilityCommand({ ExplainabilityArn }));
  await client.send(new DeletePredictorCommand({ PredictorArn: ResourceArn }));
});

test("Forecast explainability export lifecycle", async () => {
  const client = forecast();

  const pred = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_pred_for_expex",
    }),
  );
  const exp = await client.send(
    new CreateExplainabilityCommand({
      ExplainabilityName: "bunsai_e2e_exp_for_expex",
      ResourceArn: pred.PredictorArn as string,
      ExplainabilityConfig: {
        TimeSeriesGranularity: "ALL",
        TimePointGranularity: "ALL",
      },
    }),
  );
  const ExplainabilityArn = exp.ExplainabilityArn as string;

  const created = await client.send(
    new CreateExplainabilityExportCommand({
      ExplainabilityExportName: "bunsai_e2e_expex",
      ExplainabilityArn,
      Destination: {
        S3Config: {
          Path: "s3://bucket/key",
          RoleArn: "arn:aws:iam::123456789012:role/role",
        },
      },
    }),
  );
  const ExplainabilityExportArn = created.ExplainabilityExportArn as string;
  expect(typeof ExplainabilityExportArn).toBe("string");

  const described = await client.send(
    new DescribeExplainabilityExportCommand({ ExplainabilityExportArn }),
  );
  expect(described.ExplainabilityExportArn).toBe(ExplainabilityExportArn);

  const listed = await client.send(new ListExplainabilityExportsCommand({}));
  expect(
    (listed.ExplainabilityExports ?? []).map((e) => e.ExplainabilityExportArn),
  ).toContain(ExplainabilityExportArn);

  await client.send(
    new DeleteExplainabilityExportCommand({ ExplainabilityExportArn }),
  );
  await client.send(new DeleteExplainabilityCommand({ ExplainabilityArn }));
  await client.send(
    new DeletePredictorCommand({ PredictorArn: pred.PredictorArn as string }),
  );
});

test("Forecast monitor lifecycle", async () => {
  const client = forecast();

  const pred = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_pred_for_mon",
    }),
  );
  const ResourceArn = pred.PredictorArn as string;

  const created = await client.send(
    new CreateMonitorCommand({
      MonitorName: "bunsai_e2e_monitor",
      ResourceArn,
    }),
  );
  const MonitorArn = created.MonitorArn as string;
  expect(typeof MonitorArn).toBe("string");

  const described = await client.send(
    new DescribeMonitorCommand({ MonitorArn }),
  );
  expect(described.MonitorArn).toBe(MonitorArn);

  const listed = await client.send(new ListMonitorsCommand({}));
  expect((listed.Monitors ?? []).map((m) => m.MonitorArn)).toContain(
    MonitorArn,
  );

  const evals = await client.send(
    new ListMonitorEvaluationsCommand({ MonitorArn }),
  );
  expect(Array.isArray(evals.PredictorMonitorEvaluations)).toBe(true);

  await client.send(new DeleteMonitorCommand({ MonitorArn }));
  await client.send(new DeletePredictorCommand({ PredictorArn: ResourceArn }));
});

test("Forecast predictor backtest export job lifecycle", async () => {
  const client = forecast();

  const pred = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_pred_for_pbej",
    }),
  );
  const PredictorArn = pred.PredictorArn as string;

  const created = await client.send(
    new CreatePredictorBacktestExportJobCommand({
      PredictorBacktestExportJobName: "bunsai_e2e_pbej",
      PredictorArn,
      Destination: {
        S3Config: {
          Path: "s3://bucket/key",
          RoleArn: "arn:aws:iam::123456789012:role/role",
        },
      },
    }),
  );
  const PredictorBacktestExportJobArn =
    created.PredictorBacktestExportJobArn as string;
  expect(typeof PredictorBacktestExportJobArn).toBe("string");

  const described = await client.send(
    new DescribePredictorBacktestExportJobCommand({
      PredictorBacktestExportJobArn,
    }),
  );
  expect(described.PredictorBacktestExportJobArn).toBe(
    PredictorBacktestExportJobArn,
  );

  const listed = await client.send(
    new ListPredictorBacktestExportJobsCommand({}),
  );
  expect(
    (listed.PredictorBacktestExportJobs ?? []).map(
      (j) => j.PredictorBacktestExportJobArn,
    ),
  ).toContain(PredictorBacktestExportJobArn);

  await client.send(
    new DeletePredictorBacktestExportJobCommand({
      PredictorBacktestExportJobArn,
    }),
  );
  await client.send(new DeletePredictorCommand({ PredictorArn }));
});

test("Forecast what-if analysis lifecycle", async () => {
  const client = forecast();

  const pred = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_pred_for_wia",
    }),
  );
  const fc = await client.send(
    new CreateForecastCommand({
      ForecastName: "bunsai_e2e_fc_for_wia",
      PredictorArn: pred.PredictorArn as string,
    }),
  );
  const ForecastArn = fc.ForecastArn as string;

  const created = await client.send(
    new CreateWhatIfAnalysisCommand({
      WhatIfAnalysisName: "bunsai_e2e_wia",
      ForecastArn,
    }),
  );
  const WhatIfAnalysisArn = created.WhatIfAnalysisArn as string;
  expect(typeof WhatIfAnalysisArn).toBe("string");

  const described = await client.send(
    new DescribeWhatIfAnalysisCommand({ WhatIfAnalysisArn }),
  );
  expect(described.WhatIfAnalysisArn).toBe(WhatIfAnalysisArn);
  expect(described.ForecastArn).toBe(ForecastArn);

  const listed = await client.send(new ListWhatIfAnalysesCommand({}));
  expect(
    (listed.WhatIfAnalyses ?? []).map((a) => a.WhatIfAnalysisArn),
  ).toContain(WhatIfAnalysisArn);

  await client.send(new DeleteWhatIfAnalysisCommand({ WhatIfAnalysisArn }));
  await client.send(new DeleteForecastCommand({ ForecastArn }));
  await client.send(
    new DeletePredictorCommand({ PredictorArn: pred.PredictorArn as string }),
  );
});

test("Forecast what-if forecast lifecycle", async () => {
  const client = forecast();

  const pred = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_pred_for_wif",
    }),
  );
  const fc = await client.send(
    new CreateForecastCommand({
      ForecastName: "bunsai_e2e_fc_for_wif",
      PredictorArn: pred.PredictorArn as string,
    }),
  );
  const wia = await client.send(
    new CreateWhatIfAnalysisCommand({
      WhatIfAnalysisName: "bunsai_e2e_wia_for_wif",
      ForecastArn: fc.ForecastArn as string,
    }),
  );
  const WhatIfAnalysisArn = wia.WhatIfAnalysisArn as string;

  const created = await client.send(
    new CreateWhatIfForecastCommand({
      WhatIfForecastName: "bunsai_e2e_wif",
      WhatIfAnalysisArn,
    }),
  );
  const WhatIfForecastArn = created.WhatIfForecastArn as string;
  expect(typeof WhatIfForecastArn).toBe("string");

  const described = await client.send(
    new DescribeWhatIfForecastCommand({ WhatIfForecastArn }),
  );
  expect(described.WhatIfForecastArn).toBe(WhatIfForecastArn);

  const listed = await client.send(new ListWhatIfForecastsCommand({}));
  expect(
    (listed.WhatIfForecasts ?? []).map((f) => f.WhatIfForecastArn),
  ).toContain(WhatIfForecastArn);

  await client.send(new DeleteWhatIfForecastCommand({ WhatIfForecastArn }));
  await client.send(new DeleteWhatIfAnalysisCommand({ WhatIfAnalysisArn }));
  await client.send(
    new DeleteForecastCommand({ ForecastArn: fc.ForecastArn as string }),
  );
  await client.send(
    new DeletePredictorCommand({ PredictorArn: pred.PredictorArn as string }),
  );
});

test("Forecast what-if forecast export lifecycle", async () => {
  const client = forecast();

  const pred = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_pred_for_wifex",
    }),
  );
  const fc = await client.send(
    new CreateForecastCommand({
      ForecastName: "bunsai_e2e_fc_for_wifex",
      PredictorArn: pred.PredictorArn as string,
    }),
  );
  const wia = await client.send(
    new CreateWhatIfAnalysisCommand({
      WhatIfAnalysisName: "bunsai_e2e_wia_for_wifex",
      ForecastArn: fc.ForecastArn as string,
    }),
  );
  const wif = await client.send(
    new CreateWhatIfForecastCommand({
      WhatIfForecastName: "bunsai_e2e_wif_for_wifex",
      WhatIfAnalysisArn: wia.WhatIfAnalysisArn as string,
    }),
  );
  const WhatIfForecastArns = [wif.WhatIfForecastArn as string];

  const created = await client.send(
    new CreateWhatIfForecastExportCommand({
      WhatIfForecastExportName: "bunsai_e2e_wifex",
      WhatIfForecastArns,
      Destination: {
        S3Config: {
          Path: "s3://bucket/key",
          RoleArn: "arn:aws:iam::123456789012:role/role",
        },
      },
    }),
  );
  const WhatIfForecastExportArn = created.WhatIfForecastExportArn as string;
  expect(typeof WhatIfForecastExportArn).toBe("string");

  const described = await client.send(
    new DescribeWhatIfForecastExportCommand({ WhatIfForecastExportArn }),
  );
  expect(described.WhatIfForecastExportArn).toBe(WhatIfForecastExportArn);

  const listed = await client.send(new ListWhatIfForecastExportsCommand({}));
  expect(
    (listed.WhatIfForecastExports ?? []).map((e) => e.WhatIfForecastExportArn),
  ).toContain(WhatIfForecastExportArn);

  await client.send(
    new DeleteWhatIfForecastExportCommand({ WhatIfForecastExportArn }),
  );
  await client.send(
    new DeleteWhatIfForecastCommand({
      WhatIfForecastArn: wif.WhatIfForecastArn as string,
    }),
  );
  await client.send(
    new DeleteWhatIfAnalysisCommand({
      WhatIfAnalysisArn: wia.WhatIfAnalysisArn as string,
    }),
  );
  await client.send(
    new DeleteForecastCommand({ ForecastArn: fc.ForecastArn as string }),
  );
  await client.send(
    new DeletePredictorCommand({ PredictorArn: pred.PredictorArn as string }),
  );
});

test("Forecast tags lifecycle", async () => {
  const client = forecast();

  const pred = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_pred_for_tags",
    }),
  );
  const ResourceArn = pred.PredictorArn as string;

  await client.send(
    new TagResourceCommand({
      ResourceArn,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn }),
  );
  expect(listed.Tags).toEqual([{ Key: "env", Value: "test" }]);

  await client.send(
    new UntagResourceCommand({ ResourceArn, TagKeys: ["env"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn }),
  );
  expect(afterUntag.Tags).toEqual([]);

  await client.send(new DeletePredictorCommand({ PredictorArn: ResourceArn }));
});

test("Forecast stop and resume resource", async () => {
  const client = forecast();

  const pred = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_pred_for_stop",
    }),
  );
  const PredictorArn = pred.PredictorArn as string;

  await client.send(new StopResourceCommand({ ResourceArn: PredictorArn }));

  const stopped = await client.send(
    new DescribeAutoPredictorCommand({ PredictorArn }),
  );
  expect(stopped.Status).toBe("CREATE_STOPPED");

  try {
    await client.send(new ResumeResourceCommand({ ResourceArn: PredictorArn }));
    expect(true).toBe(false);
  } catch (e) {
    expect((e as Error).name).toBe("ResourceNotFoundException");
  }

  await client.send(new DeletePredictorCommand({ PredictorArn }));

  const pred2 = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_pred_for_mon_stop",
    }),
  );
  const monitor = await client.send(
    new CreateMonitorCommand({
      MonitorName: "bunsai_e2e_mon_for_stop",
      ResourceArn: pred2.PredictorArn as string,
    }),
  );
  const MonitorArn = monitor.MonitorArn as string;

  await client.send(new StopResourceCommand({ ResourceArn: MonitorArn }));
  const stoppedMonitor = await client.send(
    new DescribeMonitorCommand({ MonitorArn }),
  );
  expect(stoppedMonitor.Status).toBe("ACTIVE_STOPPED");

  await client.send(new ResumeResourceCommand({ ResourceArn: MonitorArn }));
  const resumedMonitor = await client.send(
    new DescribeMonitorCommand({ MonitorArn }),
  );
  expect(resumedMonitor.Status).toBe("ACTIVE");

  await client.send(new DeleteMonitorCommand({ MonitorArn }));
  await client.send(
    new DeletePredictorCommand({ PredictorArn: pred2.PredictorArn as string }),
  );
});

test("Forecast delete resource tree", async () => {
  const client = forecast();

  const pred = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_pred_for_tree",
    }),
  );
  const PredictorArn = pred.PredictorArn as string;

  await client.send(
    new DeleteResourceTreeCommand({ ResourceArn: PredictorArn }),
  );

  const listed = await client.send(new ListPredictorsCommand({}));
  expect((listed.Predictors ?? []).map((p) => p.PredictorArn)).not.toContain(
    PredictorArn,
  );
});

test("Forecast status lifecycle: CREATING→ACTIVE", async () => {
  const client = forecast();

  const created = await client.send(
    new CreateDatasetCommand({
      DatasetName: "bunsai_e2e_lifecycle_ds",
      Domain: "CUSTOM",
      DatasetType: "TARGET_TIME_SERIES",
      Schema: {
        Attributes: [
          { AttributeName: "timestamp", AttributeType: "timestamp" },
          { AttributeName: "target_value", AttributeType: "float" },
        ],
      },
    }),
  );
  const DatasetArn = created.DatasetArn as string;

  const described = await client.send(
    new DescribeDatasetCommand({ DatasetArn }),
  );
  expect(described.Status).toBe("ACTIVE");

  await client.send(new DeleteDatasetCommand({ DatasetArn }));
});

test("Forecast reference validation: missing predictor", async () => {
  const client = forecast();

  try {
    await client.send(
      new CreateForecastCommand({
        ForecastName: "bunsai_e2e_ref_missing_fc",
        PredictorArn:
          "arn:aws:forecast:us-east-1:000000000000:predictor/nonexistent",
      }),
    );
    expect(true).toBe(false);
  } catch (e) {
    expect((e as Error).name).toBe("ResourceNotFoundException");
  }
});

test("Forecast ListDatasets pagination", async () => {
  const client = forecast();

  const names = ["bunsai_pg_ds1", "bunsai_pg_ds2", "bunsai_pg_ds3"];
  const arns: string[] = [];
  for (const name of names) {
    const r = await client.send(
      new CreateDatasetCommand({
        DatasetName: name,
        Domain: "CUSTOM",
        DatasetType: "TARGET_TIME_SERIES",
        Schema: {
          Attributes: [
            { AttributeName: "timestamp", AttributeType: "timestamp" },
          ],
        },
      }),
    );
    arns.push(r.DatasetArn as string);
  }

  const page1 = await client.send(new ListDatasetsCommand({ MaxResults: 2 }));
  expect((page1.Datasets ?? []).length).toBeLessThanOrEqual(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new ListDatasetsCommand({ MaxResults: 2, NextToken: page1.NextToken }),
  );
  expect((page2.Datasets ?? []).length).toBeGreaterThan(0);

  for (const arn of arns) {
    await client.send(new DeleteDatasetCommand({ DatasetArn: arn }));
  }
});

test("Forecast Create* Tags persisted and deleted with resource", async () => {
  const client = forecast();

  const created = await client.send(
    new CreateDatasetCommand({
      DatasetName: "bunsai_e2e_tagged_ds",
      Domain: "CUSTOM",
      DatasetType: "TARGET_TIME_SERIES",
      Schema: {
        Attributes: [
          { AttributeName: "timestamp", AttributeType: "timestamp" },
        ],
      },
      Tags: [{ Key: "env", Value: "dev" }],
    }),
  );
  const DatasetArn = created.DatasetArn as string;

  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: DatasetArn }),
  );
  expect(tags.Tags).toEqual([{ Key: "env", Value: "dev" }]);

  await client.send(new DeleteDatasetCommand({ DatasetArn }));

  const afterDelete = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: DatasetArn }),
  );
  expect(afterDelete.Tags).toEqual([]);
});

test("Forecast Create* duplicate rejects with ResourceAlreadyExistsException", async () => {
  const client = forecast();

  await client.send(
    new CreateDatasetCommand({
      DatasetName: "bunsai_e2e_dup_ds",
      Domain: "CUSTOM",
      DatasetType: "TARGET_TIME_SERIES",
      Schema: {
        Attributes: [
          { AttributeName: "timestamp", AttributeType: "timestamp" },
        ],
      },
    }),
  );

  try {
    await client.send(
      new CreateDatasetCommand({
        DatasetName: "bunsai_e2e_dup_ds",
        Domain: "CUSTOM",
        DatasetType: "TARGET_TIME_SERIES",
        Schema: {
          Attributes: [
            { AttributeName: "timestamp", AttributeType: "timestamp" },
          ],
        },
      }),
    );
    expect(true).toBe(false);
  } catch (e) {
    expect((e as Error).name).toBe("ResourceAlreadyExistsException");
  }

  const ds = await client.send(new ListDatasetsCommand({}));
  const dupsArn = (ds.Datasets ?? [])
    .filter((d) => d.DatasetName === "bunsai_e2e_dup_ds")
    .map((d) => d.DatasetArn as string);
  expect(dupsArn.length).toBe(1);
  await client.send(new DeleteDatasetCommand({ DatasetArn: dupsArn[0] }));
});

test("Forecast DeleteResourceTree cascades to children", async () => {
  const client = forecast();

  const pred = await client.send(
    new CreateAutoPredictorCommand({
      PredictorName: "bunsai_e2e_pred_for_cascade",
    }),
  );
  const PredictorArn = pred.PredictorArn as string;

  const fc = await client.send(
    new CreateForecastCommand({
      ForecastName: "bunsai_e2e_fc_for_cascade",
      PredictorArn,
    }),
  );
  const ForecastArn = fc.ForecastArn as string;

  await client.send(
    new DeleteResourceTreeCommand({ ResourceArn: PredictorArn }),
  );

  try {
    await client.send(new DescribeForecastCommand({ ForecastArn }));
    expect(true).toBe(false);
  } catch (e) {
    expect((e as Error).name).toBe("ResourceNotFoundException");
  }

  try {
    await client.send(new DescribeAutoPredictorCommand({ PredictorArn }));
    expect(true).toBe(false);
  } catch (e) {
    expect((e as Error).name).toBe("ResourceNotFoundException");
  }
});

test("Forecast CreatePredictor rejects nonexistent DatasetGroupArn", async () => {
  const client = forecast();

  try {
    await client.send(
      new CreatePredictorCommand({
        PredictorName: "bunsai_e2e_pred_bad_dsg",
        ForecastHorizon: 10,
        InputDataConfig: {
          DatasetGroupArn:
            "arn:aws:forecast:us-east-1:000000000000:dataset-group/nonexistent",
        },
        FeaturizationConfig: { ForecastFrequency: "D" },
      }),
    );
    expect(true).toBe(false);
  } catch (e) {
    expect((e as Error).name).toBe("ResourceNotFoundException");
  }
});

test("Forecast paginateList default page size is 100", async () => {
  const client = forecast();

  const names = Array.from({ length: 11 }, (_, i) => `bunsai_pg100_ds${i}`);
  const arns: string[] = [];
  for (const name of names) {
    const r = await client.send(
      new CreateDatasetCommand({
        DatasetName: name,
        Domain: "CUSTOM",
        DatasetType: "TARGET_TIME_SERIES",
        Schema: {
          Attributes: [
            { AttributeName: "timestamp", AttributeType: "timestamp" },
          ],
        },
      }),
    );
    arns.push(r.DatasetArn as string);
  }

  const page = await client.send(new ListDatasetsCommand({}));
  const returnedArns = (page.Datasets ?? []).map((d) => d.DatasetArn as string);
  for (const arn of arns) {
    expect(returnedArns).toContain(arn);
  }
  expect(page.NextToken).toBeUndefined();

  for (const arn of arns) {
    await client.send(new DeleteDatasetCommand({ DatasetArn: arn }));
  }
});
