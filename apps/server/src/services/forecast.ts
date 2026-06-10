import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import forecastModel from "../../../../test/vendor/aws-models/forecast.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(forecastModel);

type StoredDataset = {
  DatasetArn: string;
  DatasetName: string;
  Domain: string;
  DatasetType: string;
  DataFrequency: string | undefined;
  Schema: unknown;
  Status: string;
  CreationTime: number;
  LastModificationTime: number;
};

type StoredDatasetGroup = {
  DatasetGroupArn: string;
  DatasetGroupName: string;
  Domain: string;
  DatasetArns: string[];
  Status: string;
  CreationTime: number;
  LastModificationTime: number;
};

type StoredDatasetImportJob = {
  DatasetImportJobArn: string;
  DatasetImportJobName: string;
  DatasetArn: string;
  DataSource: unknown;
  TimestampFormat: string | undefined;
  TimeZone: string | undefined;
  UseGeolocationForTimeZone: boolean | undefined;
  GeolocationModelVersion: string | undefined;
  Status: string;
  CreationTime: number;
  LastModificationTime: number;
};

type StoredPredictor = {
  PredictorArn: string;
  PredictorName: string;
  DatasetGroupArn: string | undefined;
  ForecastHorizon: number | undefined;
  AlgorithmArn: string | undefined;
  IsAutoPredictor: boolean;
  Status: string;
  CreationTime: number;
  LastModificationTime: number;
};

type StoredForecast = {
  ForecastArn: string;
  ForecastName: string;
  PredictorArn: string;
  ForecastTypes: string[] | undefined;
  Status: string;
  CreationTime: number;
  LastModificationTime: number;
};

type StoredForecastExportJob = {
  ForecastExportJobArn: string;
  ForecastExportJobName: string;
  ForecastArn: string;
  Destination: unknown;
  Status: string;
  CreationTime: number;
  LastModificationTime: number;
};

type StoredExplainability = {
  ExplainabilityArn: string;
  ExplainabilityName: string;
  ResourceArn: string;
  ExplainabilityConfig: unknown;
  Status: string;
  CreationTime: number;
  LastModificationTime: number;
};

type StoredExplainabilityExport = {
  ExplainabilityExportArn: string;
  ExplainabilityExportName: string;
  ExplainabilityArn: string;
  Destination: unknown;
  Status: string;
  CreationTime: number;
  LastModificationTime: number;
};

type StoredMonitor = {
  MonitorArn: string;
  MonitorName: string;
  ResourceArn: string;
  Status: string;
  CreationTime: number;
  LastModificationTime: number;
};

type StoredPredictorBacktestExportJob = {
  PredictorBacktestExportJobArn: string;
  PredictorBacktestExportJobName: string;
  PredictorArn: string;
  Destination: unknown;
  Status: string;
  CreationTime: number;
  LastModificationTime: number;
};

type StoredWhatIfAnalysis = {
  WhatIfAnalysisArn: string;
  WhatIfAnalysisName: string;
  ForecastArn: string;
  Status: string;
  CreationTime: number;
  LastModificationTime: number;
};

type StoredWhatIfForecast = {
  WhatIfForecastArn: string;
  WhatIfForecastName: string;
  WhatIfAnalysisArn: string;
  Status: string;
  CreationTime: number;
  LastModificationTime: number;
};

type StoredWhatIfForecastExport = {
  WhatIfForecastExportArn: string;
  WhatIfForecastExportName: string;
  WhatIfForecastArns: string[];
  Destination: unknown;
  Status: string;
  CreationTime: number;
  LastModificationTime: number;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value === "string" && value !== "") return value;
  throw awsError("InvalidInputException", `${field} is a required field.`, 400);
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
): { items: T[]; nextToken: string | undefined } => {
  const pageSize =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : 100;
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

type FilterEntry = { Key: string; Value: string; Condition: string };

const applyFilters = <T extends Record<string, unknown>>(
  items: T[],
  rawFilters: unknown,
): T[] => {
  if (!Array.isArray(rawFilters) || rawFilters.length === 0) return items;
  const filters = rawFilters as FilterEntry[];
  return items.filter((item) =>
    filters.every((f) => {
      const val = String(item[f.Key] ?? "");
      return f.Condition === "IS_NOT" ? val !== f.Value : val === f.Value;
    }),
  );
};

const datasetKey = (arn: string): string => `dataset#${arn}`;
const datasetGroupKey = (arn: string): string => `datasetGroup#${arn}`;
const datasetImportJobKey = (arn: string): string => `datasetImportJob#${arn}`;
const predictorKey = (arn: string): string => `predictor#${arn}`;
const forecastKey = (arn: string): string => `forecast#${arn}`;
const forecastExportJobKey = (arn: string): string =>
  `forecastExportJob#${arn}`;
const explainabilityKey = (arn: string): string => `explainability#${arn}`;
const explainabilityExportKey = (arn: string): string =>
  `explainabilityExport#${arn}`;
const monitorKey = (arn: string): string => `monitor#${arn}`;
const predictorBacktestExportJobKey = (arn: string): string =>
  `predictorBacktestExportJob#${arn}`;
const whatIfAnalysisKey = (arn: string): string => `whatIfAnalysis#${arn}`;
const whatIfForecastKey = (arn: string): string => `whatIfForecast#${arn}`;
const whatIfForecastExportKey = (arn: string): string =>
  `whatIfForecastExport#${arn}`;
const tagKey = (arn: string): string => `tags#${arn}`;

const datasetArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:dataset/${name}`;
const datasetGroupArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:dataset-group/${name}`;
const datasetImportJobArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:dataset-import-job/${name}`;
const predictorArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:predictor/${name}`;
const forecastResArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:forecast/${name}`;
const forecastExportJobArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:forecast-export-job/${name}`;
const explainabilityArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:explainability/${name}`;
const explainabilityExportArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:explainability-export/${name}`;
const monitorArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:monitor/${name}`;
const predictorBacktestExportJobArn = (
  ctx: ServiceContext,
  name: string,
): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:predictor-backtest-export-job/${name}`;
const whatIfAnalysisArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:what-if-analysis/${name}`;
const whatIfForecastResArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:what-if-forecast/${name}`;
const whatIfForecastExportArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:what-if-forecast-export/${name}`;

const requireDataset = (ctx: ServiceContext, arn: string): StoredDataset => {
  const dataset = ctx.store.get<StoredDataset>(datasetKey(arn));
  if (dataset === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${arn}`,
      400,
    );
  }
  return dataset;
};

const requireDatasetGroup = (
  ctx: ServiceContext,
  arn: string,
): StoredDatasetGroup => {
  const item = ctx.store.get<StoredDatasetGroup>(datasetGroupKey(arn));
  if (item === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${arn}`,
      400,
    );
  }
  return item;
};

const requireDatasetImportJob = (
  ctx: ServiceContext,
  arn: string,
): StoredDatasetImportJob => {
  const item = ctx.store.get<StoredDatasetImportJob>(datasetImportJobKey(arn));
  if (item === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${arn}`,
      400,
    );
  }
  return item;
};

const requirePredictor = (
  ctx: ServiceContext,
  arn: string,
): StoredPredictor => {
  const item = ctx.store.get<StoredPredictor>(predictorKey(arn));
  if (item === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${arn}`,
      400,
    );
  }
  return item;
};

const requireForecast = (ctx: ServiceContext, arn: string): StoredForecast => {
  const item = ctx.store.get<StoredForecast>(forecastKey(arn));
  if (item === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${arn}`,
      400,
    );
  }
  return item;
};

const requireForecastExportJob = (
  ctx: ServiceContext,
  arn: string,
): StoredForecastExportJob => {
  const item = ctx.store.get<StoredForecastExportJob>(
    forecastExportJobKey(arn),
  );
  if (item === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${arn}`,
      400,
    );
  }
  return item;
};

const requireExplainability = (
  ctx: ServiceContext,
  arn: string,
): StoredExplainability => {
  const item = ctx.store.get<StoredExplainability>(explainabilityKey(arn));
  if (item === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${arn}`,
      400,
    );
  }
  return item;
};

const requireExplainabilityExport = (
  ctx: ServiceContext,
  arn: string,
): StoredExplainabilityExport => {
  const item = ctx.store.get<StoredExplainabilityExport>(
    explainabilityExportKey(arn),
  );
  if (item === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${arn}`,
      400,
    );
  }
  return item;
};

const requireMonitor = (ctx: ServiceContext, arn: string): StoredMonitor => {
  const item = ctx.store.get<StoredMonitor>(monitorKey(arn));
  if (item === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${arn}`,
      400,
    );
  }
  return item;
};

const requirePredictorBacktestExportJob = (
  ctx: ServiceContext,
  arn: string,
): StoredPredictorBacktestExportJob => {
  const item = ctx.store.get<StoredPredictorBacktestExportJob>(
    predictorBacktestExportJobKey(arn),
  );
  if (item === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${arn}`,
      400,
    );
  }
  return item;
};

const requireWhatIfAnalysis = (
  ctx: ServiceContext,
  arn: string,
): StoredWhatIfAnalysis => {
  const item = ctx.store.get<StoredWhatIfAnalysis>(whatIfAnalysisKey(arn));
  if (item === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${arn}`,
      400,
    );
  }
  return item;
};

const requireWhatIfForecast = (
  ctx: ServiceContext,
  arn: string,
): StoredWhatIfForecast => {
  const item = ctx.store.get<StoredWhatIfForecast>(whatIfForecastKey(arn));
  if (item === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${arn}`,
      400,
    );
  }
  return item;
};

const requireWhatIfForecastExport = (
  ctx: ServiceContext,
  arn: string,
): StoredWhatIfForecastExport => {
  const item = ctx.store.get<StoredWhatIfForecastExport>(
    whatIfForecastExportKey(arn),
  );
  if (item === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${arn}`,
      400,
    );
  }
  return item;
};

const CreateDataset: OperationHandler = (input, ctx) => {
  const DatasetName = requireString(input, "DatasetName");
  const Domain = requireString(input, "Domain");
  const DatasetType = requireString(input, "DatasetType");
  const Schema = input["Schema"];
  if (Schema === undefined) {
    throw awsError("InvalidInputException", "Schema is a required field.", 400);
  }
  const DatasetArn = datasetArn(ctx, DatasetName);
  if (ctx.store.get(datasetKey(DatasetArn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Dataset already exists: ${DatasetArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const dataset: StoredDataset = {
    DatasetArn,
    DatasetName,
    Domain,
    DatasetType,
    DataFrequency: stringOrUndefined(input["DataFrequency"]),
    Schema,
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(datasetKey(DatasetArn), dataset);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(DatasetArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { DatasetArn };
};

const DescribeDataset: OperationHandler = (input, ctx) => {
  const DatasetArn = requireString(input, "DatasetArn");
  const dataset = requireDataset(ctx, DatasetArn);
  return {
    DatasetArn: dataset.DatasetArn,
    DatasetName: dataset.DatasetName,
    Domain: dataset.Domain,
    DatasetType: dataset.DatasetType,
    DataFrequency: dataset.DataFrequency,
    Schema: dataset.Schema,
    Status: dataset.Status,
    CreationTime: dataset.CreationTime,
    LastModificationTime: dataset.LastModificationTime,
  };
};

const ListDatasets: OperationHandler = (input, ctx) => {
  const all = applyFilters(
    ctx.store
      .list<StoredDataset>()
      .filter((entry) => entry.key.startsWith("dataset#"))
      .map((entry) => entry.value)
      .map((dataset) => ({
        DatasetArn: dataset.DatasetArn,
        DatasetName: dataset.DatasetName,
        DatasetType: dataset.DatasetType,
        Domain: dataset.Domain,
        CreationTime: dataset.CreationTime,
        LastModificationTime: dataset.LastModificationTime,
      })),
    input["Filters"],
  );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return { Datasets: items, NextToken: nextToken };
};

const DeleteDataset: OperationHandler = (input, ctx) => {
  const DatasetArn = requireString(input, "DatasetArn");
  requireDataset(ctx, DatasetArn);
  ctx.store.delete(datasetKey(DatasetArn));
  ctx.store.delete(tagKey(DatasetArn));
  return {};
};

const CreateDatasetGroup: OperationHandler = (input, ctx) => {
  const DatasetGroupName = requireString(input, "DatasetGroupName");
  const Domain = requireString(input, "Domain");
  const DatasetGroupArn = datasetGroupArn(ctx, DatasetGroupName);
  if (ctx.store.get(datasetGroupKey(DatasetGroupArn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `DatasetGroup already exists: ${DatasetGroupArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const DatasetArns = Array.isArray(input["DatasetArns"])
    ? (input["DatasetArns"] as string[])
    : [];
  for (const arn of DatasetArns) {
    requireDataset(ctx, arn);
  }
  const item: StoredDatasetGroup = {
    DatasetGroupArn,
    DatasetGroupName,
    Domain,
    DatasetArns,
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(datasetGroupKey(DatasetGroupArn), item);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(DatasetGroupArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { DatasetGroupArn };
};

const DescribeDatasetGroup: OperationHandler = (input, ctx) => {
  const DatasetGroupArn = requireString(input, "DatasetGroupArn");
  const item = requireDatasetGroup(ctx, DatasetGroupArn);
  return {
    DatasetGroupArn: item.DatasetGroupArn,
    DatasetGroupName: item.DatasetGroupName,
    Domain: item.Domain,
    DatasetArns: item.DatasetArns,
    Status: item.Status,
    CreationTime: item.CreationTime,
    LastModificationTime: item.LastModificationTime,
  };
};

const ListDatasetGroups: OperationHandler = (input, ctx) => {
  const all = applyFilters(
    ctx.store
      .list<StoredDatasetGroup>()
      .filter((entry) => entry.key.startsWith("datasetGroup#"))
      .map((entry) => entry.value)
      .map((item) => ({
        DatasetGroupArn: item.DatasetGroupArn,
        DatasetGroupName: item.DatasetGroupName,
        Domain: item.Domain,
        Status: item.Status,
        CreationTime: item.CreationTime,
        LastModificationTime: item.LastModificationTime,
      })),
    input["Filters"],
  );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return { DatasetGroups: items, NextToken: nextToken };
};

const DeleteDatasetGroup: OperationHandler = (input, ctx) => {
  const DatasetGroupArn = requireString(input, "DatasetGroupArn");
  requireDatasetGroup(ctx, DatasetGroupArn);
  ctx.store.delete(datasetGroupKey(DatasetGroupArn));
  ctx.store.delete(tagKey(DatasetGroupArn));
  return {};
};

const UpdateDatasetGroup: OperationHandler = (input, ctx) => {
  const DatasetGroupArn = requireString(input, "DatasetGroupArn");
  const DatasetArns = input["DatasetArns"];
  if (!Array.isArray(DatasetArns)) {
    throw awsError(
      "InvalidInputException",
      "DatasetArns is a required field.",
      400,
    );
  }
  for (const arn of DatasetArns as string[]) {
    requireDataset(ctx, arn);
  }
  const item = requireDatasetGroup(ctx, DatasetGroupArn);
  item.DatasetArns = DatasetArns as string[];
  item.LastModificationTime = nowSeconds();
  ctx.store.set(datasetGroupKey(DatasetGroupArn), item);
  return {};
};

const CreateDatasetImportJob: OperationHandler = (input, ctx) => {
  const DatasetImportJobName = requireString(input, "DatasetImportJobName");
  const DatasetArn = requireString(input, "DatasetArn");
  requireDataset(ctx, DatasetArn);
  const DataSource = input["DataSource"];
  if (DataSource === undefined) {
    throw awsError(
      "InvalidInputException",
      "DataSource is a required field.",
      400,
    );
  }
  const DatasetImportJobArn = datasetImportJobArn(ctx, DatasetImportJobName);
  if (ctx.store.get(datasetImportJobKey(DatasetImportJobArn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `DatasetImportJob already exists: ${DatasetImportJobArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const item: StoredDatasetImportJob = {
    DatasetImportJobArn,
    DatasetImportJobName,
    DatasetArn,
    DataSource,
    TimestampFormat: stringOrUndefined(input["TimestampFormat"]),
    TimeZone: stringOrUndefined(input["TimeZone"]),
    UseGeolocationForTimeZone:
      typeof input["UseGeolocationForTimeZone"] === "boolean"
        ? input["UseGeolocationForTimeZone"]
        : undefined,
    GeolocationModelVersion: stringOrUndefined(
      input["GeolocationModelVersion"],
    ),
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(datasetImportJobKey(DatasetImportJobArn), item);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(DatasetImportJobArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { DatasetImportJobArn };
};

const DescribeDatasetImportJob: OperationHandler = (input, ctx) => {
  const DatasetImportJobArn = requireString(input, "DatasetImportJobArn");
  const item = requireDatasetImportJob(ctx, DatasetImportJobArn);
  return {
    DatasetImportJobArn: item.DatasetImportJobArn,
    DatasetImportJobName: item.DatasetImportJobName,
    DatasetArn: item.DatasetArn,
    DataSource: item.DataSource,
    TimestampFormat: item.TimestampFormat,
    TimeZone: item.TimeZone,
    UseGeolocationForTimeZone: item.UseGeolocationForTimeZone,
    GeolocationModelVersion: item.GeolocationModelVersion,
    Status: item.Status,
    CreationTime: item.CreationTime,
    LastModificationTime: item.LastModificationTime,
  };
};

const ListDatasetImportJobs: OperationHandler = (input, ctx) => {
  const all = applyFilters(
    ctx.store
      .list<StoredDatasetImportJob>()
      .filter((entry) => entry.key.startsWith("datasetImportJob#"))
      .map((entry) => entry.value)
      .map((item) => ({
        DatasetImportJobArn: item.DatasetImportJobArn,
        DatasetImportJobName: item.DatasetImportJobName,
        DatasetArn: item.DatasetArn,
        DataSource: item.DataSource,
        Status: item.Status,
        CreationTime: item.CreationTime,
        LastModificationTime: item.LastModificationTime,
      })),
    input["Filters"],
  );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return { DatasetImportJobs: items, NextToken: nextToken };
};

const DeleteDatasetImportJob: OperationHandler = (input, ctx) => {
  const DatasetImportJobArn = requireString(input, "DatasetImportJobArn");
  requireDatasetImportJob(ctx, DatasetImportJobArn);
  ctx.store.delete(datasetImportJobKey(DatasetImportJobArn));
  ctx.store.delete(tagKey(DatasetImportJobArn));
  return {};
};

const CreateAutoPredictor: OperationHandler = (input, ctx) => {
  const PredictorName = requireString(input, "PredictorName");
  const dataConfig = input["DataConfig"] as
    | { DatasetGroupArn?: string }
    | undefined;
  const referencePredictorArn = stringOrUndefined(
    input["ReferencePredictorArn"],
  );
  if (dataConfig?.DatasetGroupArn !== undefined) {
    requireDatasetGroup(ctx, dataConfig.DatasetGroupArn);
  }
  if (referencePredictorArn !== undefined) {
    requirePredictor(ctx, referencePredictorArn);
  }
  const DatasetGroupArn = dataConfig?.DatasetGroupArn;
  const PredictorArn = predictorArn(ctx, PredictorName);
  if (ctx.store.get(predictorKey(PredictorArn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Predictor already exists: ${PredictorArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const item: StoredPredictor = {
    PredictorArn,
    PredictorName,
    DatasetGroupArn,
    ForecastHorizon:
      typeof input["ForecastHorizon"] === "number"
        ? input["ForecastHorizon"]
        : undefined,
    AlgorithmArn: stringOrUndefined(input["AlgorithmArn"]),
    IsAutoPredictor: true,
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(predictorKey(PredictorArn), item);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(PredictorArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { PredictorArn };
};

const DescribeAutoPredictor: OperationHandler = (input, ctx) => {
  const PredictorArn = requireString(input, "PredictorArn");
  const item = requirePredictor(ctx, PredictorArn);
  return {
    PredictorArn: item.PredictorArn,
    PredictorName: item.PredictorName,
    ForecastHorizon: item.ForecastHorizon,
    Status: item.Status,
    CreationTime: item.CreationTime,
    LastModificationTime: item.LastModificationTime,
  };
};

const CreatePredictor: OperationHandler = (input, ctx) => {
  const PredictorName = requireString(input, "PredictorName");
  const ForecastHorizon = input["ForecastHorizon"];
  if (typeof ForecastHorizon !== "number") {
    throw awsError(
      "InvalidInputException",
      "ForecastHorizon is a required field.",
      400,
    );
  }
  if (input["InputDataConfig"] === undefined) {
    throw awsError(
      "InvalidInputException",
      "InputDataConfig is a required field.",
      400,
    );
  }
  if (input["FeaturizationConfig"] === undefined) {
    throw awsError(
      "InvalidInputException",
      "FeaturizationConfig is a required field.",
      400,
    );
  }
  const inputDataConfig = input["InputDataConfig"] as
    | { DatasetGroupArn?: string }
    | undefined;
  const DatasetGroupArn = inputDataConfig?.DatasetGroupArn;
  if (DatasetGroupArn !== undefined) {
    requireDatasetGroup(ctx, DatasetGroupArn);
  }
  const PredictorArn = predictorArn(ctx, PredictorName);
  if (ctx.store.get(predictorKey(PredictorArn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Predictor already exists: ${PredictorArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const item: StoredPredictor = {
    PredictorArn,
    PredictorName,
    DatasetGroupArn,
    ForecastHorizon,
    AlgorithmArn: stringOrUndefined(input["AlgorithmArn"]),
    IsAutoPredictor: false,
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(predictorKey(PredictorArn), item);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(PredictorArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { PredictorArn };
};

const DescribePredictor: OperationHandler = (input, ctx) => {
  const PredictorArn = requireString(input, "PredictorArn");
  const item = requirePredictor(ctx, PredictorArn);
  return {
    PredictorArn: item.PredictorArn,
    PredictorName: item.PredictorName,
    ForecastHorizon: item.ForecastHorizon,
    AlgorithmArn: item.AlgorithmArn,
    Status: item.Status,
    CreationTime: item.CreationTime,
    LastModificationTime: item.LastModificationTime,
  };
};

const ListPredictors: OperationHandler = (input, ctx) => {
  const all = applyFilters(
    ctx.store
      .list<StoredPredictor>()
      .filter((entry) => entry.key.startsWith("predictor#"))
      .map((entry) => entry.value)
      .map((item) => ({
        PredictorArn: item.PredictorArn,
        PredictorName: item.PredictorName,
        ForecastHorizon: item.ForecastHorizon,
        Status: item.Status,
        CreationTime: item.CreationTime,
        LastModificationTime: item.LastModificationTime,
      })),
    input["Filters"],
  );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return { Predictors: items, NextToken: nextToken };
};

const DeletePredictor: OperationHandler = (input, ctx) => {
  const PredictorArn = requireString(input, "PredictorArn");
  requirePredictor(ctx, PredictorArn);
  ctx.store.delete(predictorKey(PredictorArn));
  ctx.store.delete(tagKey(PredictorArn));
  return {};
};

const GetAccuracyMetrics: OperationHandler = (input, ctx) => {
  const PredictorArn = requireString(input, "PredictorArn");
  const item = requirePredictor(ctx, PredictorArn);
  return {
    PredictorEvaluationResults: [],
    IsAutoPredictor: item.IsAutoPredictor,
  };
};

const CreateForecast: OperationHandler = (input, ctx) => {
  const ForecastName = requireString(input, "ForecastName");
  const PredictorArn = requireString(input, "PredictorArn");
  requirePredictor(ctx, PredictorArn);
  const ForecastArn = forecastResArn(ctx, ForecastName);
  if (ctx.store.get(forecastKey(ForecastArn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Forecast already exists: ${ForecastArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const ForecastTypes = Array.isArray(input["ForecastTypes"])
    ? (input["ForecastTypes"] as string[])
    : undefined;
  const item: StoredForecast = {
    ForecastArn,
    ForecastName,
    PredictorArn,
    ForecastTypes,
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(forecastKey(ForecastArn), item);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(ForecastArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { ForecastArn };
};

const DescribeForecast: OperationHandler = (input, ctx) => {
  const ForecastArn = requireString(input, "ForecastArn");
  const item = requireForecast(ctx, ForecastArn);
  return {
    ForecastArn: item.ForecastArn,
    ForecastName: item.ForecastName,
    PredictorArn: item.PredictorArn,
    ForecastTypes: item.ForecastTypes,
    Status: item.Status,
    CreationTime: item.CreationTime,
    LastModificationTime: item.LastModificationTime,
  };
};

const ListForecasts: OperationHandler = (input, ctx) => {
  const all = applyFilters(
    ctx.store
      .list<StoredForecast>()
      .filter((entry) => entry.key.startsWith("forecast#"))
      .map((entry) => entry.value)
      .map((item) => ({
        ForecastArn: item.ForecastArn,
        ForecastName: item.ForecastName,
        PredictorArn: item.PredictorArn,
        Status: item.Status,
        CreationTime: item.CreationTime,
        LastModificationTime: item.LastModificationTime,
      })),
    input["Filters"],
  );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return { Forecasts: items, NextToken: nextToken };
};

const DeleteForecast: OperationHandler = (input, ctx) => {
  const ForecastArn = requireString(input, "ForecastArn");
  requireForecast(ctx, ForecastArn);
  ctx.store.delete(forecastKey(ForecastArn));
  ctx.store.delete(tagKey(ForecastArn));
  return {};
};

const CreateForecastExportJob: OperationHandler = (input, ctx) => {
  const ForecastExportJobName = requireString(input, "ForecastExportJobName");
  const ForecastArn = requireString(input, "ForecastArn");
  requireForecast(ctx, ForecastArn);
  const Destination = input["Destination"];
  if (Destination === undefined) {
    throw awsError(
      "InvalidInputException",
      "Destination is a required field.",
      400,
    );
  }
  const ForecastExportJobArn = forecastExportJobArn(ctx, ForecastExportJobName);
  if (ctx.store.get(forecastExportJobKey(ForecastExportJobArn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `ForecastExportJob already exists: ${ForecastExportJobArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const item: StoredForecastExportJob = {
    ForecastExportJobArn,
    ForecastExportJobName,
    ForecastArn,
    Destination,
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(forecastExportJobKey(ForecastExportJobArn), item);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(ForecastExportJobArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { ForecastExportJobArn };
};

const DescribeForecastExportJob: OperationHandler = (input, ctx) => {
  const ForecastExportJobArn = requireString(input, "ForecastExportJobArn");
  const item = requireForecastExportJob(ctx, ForecastExportJobArn);
  return {
    ForecastExportJobArn: item.ForecastExportJobArn,
    ForecastExportJobName: item.ForecastExportJobName,
    ForecastArn: item.ForecastArn,
    Destination: item.Destination,
    Status: item.Status,
    CreationTime: item.CreationTime,
    LastModificationTime: item.LastModificationTime,
  };
};

const ListForecastExportJobs: OperationHandler = (input, ctx) => {
  const all = applyFilters(
    ctx.store
      .list<StoredForecastExportJob>()
      .filter((entry) => entry.key.startsWith("forecastExportJob#"))
      .map((entry) => entry.value)
      .map((item) => ({
        ForecastExportJobArn: item.ForecastExportJobArn,
        ForecastExportJobName: item.ForecastExportJobName,
        ForecastArn: item.ForecastArn,
        Destination: item.Destination,
        Status: item.Status,
        CreationTime: item.CreationTime,
        LastModificationTime: item.LastModificationTime,
      })),
    input["Filters"],
  );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return { ForecastExportJobs: items, NextToken: nextToken };
};

const DeleteForecastExportJob: OperationHandler = (input, ctx) => {
  const ForecastExportJobArn = requireString(input, "ForecastExportJobArn");
  requireForecastExportJob(ctx, ForecastExportJobArn);
  ctx.store.delete(forecastExportJobKey(ForecastExportJobArn));
  ctx.store.delete(tagKey(ForecastExportJobArn));
  return {};
};

const CreateExplainability: OperationHandler = (input, ctx) => {
  const ExplainabilityName = requireString(input, "ExplainabilityName");
  const ResourceArn = requireString(input, "ResourceArn");
  const predictorItem = ctx.store.get<StoredPredictor>(
    predictorKey(ResourceArn),
  );
  const forecastItem = ctx.store.get<StoredForecast>(forecastKey(ResourceArn));
  if (predictorItem === undefined && forecastItem === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${ResourceArn}`,
      400,
    );
  }
  const ExplainabilityConfig = input["ExplainabilityConfig"];
  if (ExplainabilityConfig === undefined) {
    throw awsError(
      "InvalidInputException",
      "ExplainabilityConfig is a required field.",
      400,
    );
  }
  const ExplainabilityArn = explainabilityArn(ctx, ExplainabilityName);
  if (ctx.store.get(explainabilityKey(ExplainabilityArn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Explainability already exists: ${ExplainabilityArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const item: StoredExplainability = {
    ExplainabilityArn,
    ExplainabilityName,
    ResourceArn,
    ExplainabilityConfig,
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(explainabilityKey(ExplainabilityArn), item);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(ExplainabilityArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { ExplainabilityArn };
};

const DescribeExplainability: OperationHandler = (input, ctx) => {
  const ExplainabilityArn = requireString(input, "ExplainabilityArn");
  const item = requireExplainability(ctx, ExplainabilityArn);
  return {
    ExplainabilityArn: item.ExplainabilityArn,
    ExplainabilityName: item.ExplainabilityName,
    ResourceArn: item.ResourceArn,
    ExplainabilityConfig: item.ExplainabilityConfig,
    Status: item.Status,
    CreationTime: item.CreationTime,
    LastModificationTime: item.LastModificationTime,
  };
};

const ListExplainabilities: OperationHandler = (input, ctx) => {
  const all = applyFilters(
    ctx.store
      .list<StoredExplainability>()
      .filter((entry) => entry.key.startsWith("explainability#"))
      .map((entry) => entry.value)
      .map((item) => ({
        ExplainabilityArn: item.ExplainabilityArn,
        ExplainabilityName: item.ExplainabilityName,
        ResourceArn: item.ResourceArn,
        Status: item.Status,
        CreationTime: item.CreationTime,
        LastModificationTime: item.LastModificationTime,
      })),
    input["Filters"],
  );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return { Explainabilities: items, NextToken: nextToken };
};

const DeleteExplainability: OperationHandler = (input, ctx) => {
  const ExplainabilityArn = requireString(input, "ExplainabilityArn");
  requireExplainability(ctx, ExplainabilityArn);
  ctx.store.delete(explainabilityKey(ExplainabilityArn));
  ctx.store.delete(tagKey(ExplainabilityArn));
  return {};
};

const CreateExplainabilityExport: OperationHandler = (input, ctx) => {
  const ExplainabilityExportName = requireString(
    input,
    "ExplainabilityExportName",
  );
  const ExplainabilityArn = requireString(input, "ExplainabilityArn");
  requireExplainability(ctx, ExplainabilityArn);
  const Destination = input["Destination"];
  if (Destination === undefined) {
    throw awsError(
      "InvalidInputException",
      "Destination is a required field.",
      400,
    );
  }
  const ExplainabilityExportArn = explainabilityExportArn(
    ctx,
    ExplainabilityExportName,
  );
  if (
    ctx.store.get(explainabilityExportKey(ExplainabilityExportArn)) !==
    undefined
  ) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `ExplainabilityExport already exists: ${ExplainabilityExportArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const item: StoredExplainabilityExport = {
    ExplainabilityExportArn,
    ExplainabilityExportName,
    ExplainabilityArn,
    Destination,
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(explainabilityExportKey(ExplainabilityExportArn), item);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(ExplainabilityExportArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { ExplainabilityExportArn };
};

const DescribeExplainabilityExport: OperationHandler = (input, ctx) => {
  const ExplainabilityExportArn = requireString(
    input,
    "ExplainabilityExportArn",
  );
  const item = requireExplainabilityExport(ctx, ExplainabilityExportArn);
  return {
    ExplainabilityExportArn: item.ExplainabilityExportArn,
    ExplainabilityExportName: item.ExplainabilityExportName,
    ExplainabilityArn: item.ExplainabilityArn,
    Destination: item.Destination,
    Status: item.Status,
    CreationTime: item.CreationTime,
    LastModificationTime: item.LastModificationTime,
  };
};

const ListExplainabilityExports: OperationHandler = (input, ctx) => {
  const all = applyFilters(
    ctx.store
      .list<StoredExplainabilityExport>()
      .filter((entry) => entry.key.startsWith("explainabilityExport#"))
      .map((entry) => entry.value)
      .map((item) => ({
        ExplainabilityExportArn: item.ExplainabilityExportArn,
        ExplainabilityExportName: item.ExplainabilityExportName,
        ExplainabilityArn: item.ExplainabilityArn,
        Destination: item.Destination,
        Status: item.Status,
        CreationTime: item.CreationTime,
        LastModificationTime: item.LastModificationTime,
      })),
    input["Filters"],
  );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return { ExplainabilityExports: items, NextToken: nextToken };
};

const DeleteExplainabilityExport: OperationHandler = (input, ctx) => {
  const ExplainabilityExportArn = requireString(
    input,
    "ExplainabilityExportArn",
  );
  requireExplainabilityExport(ctx, ExplainabilityExportArn);
  ctx.store.delete(explainabilityExportKey(ExplainabilityExportArn));
  ctx.store.delete(tagKey(ExplainabilityExportArn));
  return {};
};

const CreateMonitor: OperationHandler = (input, ctx) => {
  const MonitorName = requireString(input, "MonitorName");
  const ResourceArn = requireString(input, "ResourceArn");
  const monitorPredictorItem = ctx.store.get<StoredPredictor>(
    predictorKey(ResourceArn),
  );
  const monitorForecastItem = ctx.store.get<StoredForecast>(
    forecastKey(ResourceArn),
  );
  if (monitorPredictorItem === undefined && monitorForecastItem === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${ResourceArn}`,
      400,
    );
  }
  const MonitorArn = monitorArn(ctx, MonitorName);
  if (ctx.store.get(monitorKey(MonitorArn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Monitor already exists: ${MonitorArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const item: StoredMonitor = {
    MonitorArn,
    MonitorName,
    ResourceArn,
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(monitorKey(MonitorArn), item);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(MonitorArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { MonitorArn };
};

const DescribeMonitor: OperationHandler = (input, ctx) => {
  const MonitorArn = requireString(input, "MonitorArn");
  const item = requireMonitor(ctx, MonitorArn);
  return {
    MonitorArn: item.MonitorArn,
    MonitorName: item.MonitorName,
    ResourceArn: item.ResourceArn,
    Status: item.Status,
    CreationTime: item.CreationTime,
    LastModificationTime: item.LastModificationTime,
  };
};

const ListMonitors: OperationHandler = (input, ctx) => {
  const all = applyFilters(
    ctx.store
      .list<StoredMonitor>()
      .filter((entry) => entry.key.startsWith("monitor#"))
      .map((entry) => entry.value)
      .map((item) => ({
        MonitorArn: item.MonitorArn,
        MonitorName: item.MonitorName,
        ResourceArn: item.ResourceArn,
        Status: item.Status,
        CreationTime: item.CreationTime,
        LastModificationTime: item.LastModificationTime,
      })),
    input["Filters"],
  );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return { Monitors: items, NextToken: nextToken };
};

const ListMonitorEvaluations: OperationHandler = (input, ctx) => {
  const MonitorArn = requireString(input, "MonitorArn");
  requireMonitor(ctx, MonitorArn);
  return { PredictorMonitorEvaluations: [] };
};

const DeleteMonitor: OperationHandler = (input, ctx) => {
  const MonitorArn = requireString(input, "MonitorArn");
  requireMonitor(ctx, MonitorArn);
  ctx.store.delete(monitorKey(MonitorArn));
  ctx.store.delete(tagKey(MonitorArn));
  return {};
};

const CreatePredictorBacktestExportJob: OperationHandler = (input, ctx) => {
  const PredictorBacktestExportJobName = requireString(
    input,
    "PredictorBacktestExportJobName",
  );
  const PredictorArn = requireString(input, "PredictorArn");
  requirePredictor(ctx, PredictorArn);
  const Destination = input["Destination"];
  if (Destination === undefined) {
    throw awsError(
      "InvalidInputException",
      "Destination is a required field.",
      400,
    );
  }
  const PredictorBacktestExportJobArn = predictorBacktestExportJobArn(
    ctx,
    PredictorBacktestExportJobName,
  );
  if (
    ctx.store.get(
      predictorBacktestExportJobKey(PredictorBacktestExportJobArn),
    ) !== undefined
  ) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `PredictorBacktestExportJob already exists: ${PredictorBacktestExportJobArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const item: StoredPredictorBacktestExportJob = {
    PredictorBacktestExportJobArn,
    PredictorBacktestExportJobName,
    PredictorArn,
    Destination,
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(
    predictorBacktestExportJobKey(PredictorBacktestExportJobArn),
    item,
  );
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(PredictorBacktestExportJobArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { PredictorBacktestExportJobArn };
};

const DescribePredictorBacktestExportJob: OperationHandler = (input, ctx) => {
  const PredictorBacktestExportJobArn = requireString(
    input,
    "PredictorBacktestExportJobArn",
  );
  const item = requirePredictorBacktestExportJob(
    ctx,
    PredictorBacktestExportJobArn,
  );
  return {
    PredictorBacktestExportJobArn: item.PredictorBacktestExportJobArn,
    PredictorBacktestExportJobName: item.PredictorBacktestExportJobName,
    PredictorArn: item.PredictorArn,
    Destination: item.Destination,
    Status: item.Status,
    CreationTime: item.CreationTime,
    LastModificationTime: item.LastModificationTime,
  };
};

const ListPredictorBacktestExportJobs: OperationHandler = (input, ctx) => {
  const all = applyFilters(
    ctx.store
      .list<StoredPredictorBacktestExportJob>()
      .filter((entry) => entry.key.startsWith("predictorBacktestExportJob#"))
      .map((entry) => entry.value)
      .map((item) => ({
        PredictorBacktestExportJobArn: item.PredictorBacktestExportJobArn,
        PredictorBacktestExportJobName: item.PredictorBacktestExportJobName,
        PredictorArn: item.PredictorArn,
        Destination: item.Destination,
        Status: item.Status,
        CreationTime: item.CreationTime,
        LastModificationTime: item.LastModificationTime,
      })),
    input["Filters"],
  );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return { PredictorBacktestExportJobs: items, NextToken: nextToken };
};

const DeletePredictorBacktestExportJob: OperationHandler = (input, ctx) => {
  const PredictorBacktestExportJobArn = requireString(
    input,
    "PredictorBacktestExportJobArn",
  );
  requirePredictorBacktestExportJob(ctx, PredictorBacktestExportJobArn);
  ctx.store.delete(
    predictorBacktestExportJobKey(PredictorBacktestExportJobArn),
  );
  ctx.store.delete(tagKey(PredictorBacktestExportJobArn));
  return {};
};

const CreateWhatIfAnalysis: OperationHandler = (input, ctx) => {
  const WhatIfAnalysisName = requireString(input, "WhatIfAnalysisName");
  const ForecastArn = requireString(input, "ForecastArn");
  requireForecast(ctx, ForecastArn);
  const WhatIfAnalysisArn = whatIfAnalysisArn(ctx, WhatIfAnalysisName);
  if (ctx.store.get(whatIfAnalysisKey(WhatIfAnalysisArn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `WhatIfAnalysis already exists: ${WhatIfAnalysisArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const item: StoredWhatIfAnalysis = {
    WhatIfAnalysisArn,
    WhatIfAnalysisName,
    ForecastArn,
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(whatIfAnalysisKey(WhatIfAnalysisArn), item);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(WhatIfAnalysisArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { WhatIfAnalysisArn };
};

const DescribeWhatIfAnalysis: OperationHandler = (input, ctx) => {
  const WhatIfAnalysisArn = requireString(input, "WhatIfAnalysisArn");
  const item = requireWhatIfAnalysis(ctx, WhatIfAnalysisArn);
  return {
    WhatIfAnalysisArn: item.WhatIfAnalysisArn,
    WhatIfAnalysisName: item.WhatIfAnalysisName,
    ForecastArn: item.ForecastArn,
    Status: item.Status,
    CreationTime: item.CreationTime,
    LastModificationTime: item.LastModificationTime,
  };
};

const ListWhatIfAnalyses: OperationHandler = (input, ctx) => {
  const all = applyFilters(
    ctx.store
      .list<StoredWhatIfAnalysis>()
      .filter((entry) => entry.key.startsWith("whatIfAnalysis#"))
      .map((entry) => entry.value)
      .map((item) => ({
        WhatIfAnalysisArn: item.WhatIfAnalysisArn,
        WhatIfAnalysisName: item.WhatIfAnalysisName,
        ForecastArn: item.ForecastArn,
        Status: item.Status,
        CreationTime: item.CreationTime,
        LastModificationTime: item.LastModificationTime,
      })),
    input["Filters"],
  );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return { WhatIfAnalyses: items, NextToken: nextToken };
};

const DeleteWhatIfAnalysis: OperationHandler = (input, ctx) => {
  const WhatIfAnalysisArn = requireString(input, "WhatIfAnalysisArn");
  requireWhatIfAnalysis(ctx, WhatIfAnalysisArn);
  ctx.store.delete(whatIfAnalysisKey(WhatIfAnalysisArn));
  ctx.store.delete(tagKey(WhatIfAnalysisArn));
  return {};
};

const CreateWhatIfForecast: OperationHandler = (input, ctx) => {
  const WhatIfForecastName = requireString(input, "WhatIfForecastName");
  const WhatIfAnalysisArn = requireString(input, "WhatIfAnalysisArn");
  requireWhatIfAnalysis(ctx, WhatIfAnalysisArn);
  const WhatIfForecastArn = whatIfForecastResArn(ctx, WhatIfForecastName);
  if (ctx.store.get(whatIfForecastKey(WhatIfForecastArn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `WhatIfForecast already exists: ${WhatIfForecastArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const item: StoredWhatIfForecast = {
    WhatIfForecastArn,
    WhatIfForecastName,
    WhatIfAnalysisArn,
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(whatIfForecastKey(WhatIfForecastArn), item);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(WhatIfForecastArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { WhatIfForecastArn };
};

const DescribeWhatIfForecast: OperationHandler = (input, ctx) => {
  const WhatIfForecastArn = requireString(input, "WhatIfForecastArn");
  const item = requireWhatIfForecast(ctx, WhatIfForecastArn);
  return {
    WhatIfForecastArn: item.WhatIfForecastArn,
    WhatIfForecastName: item.WhatIfForecastName,
    WhatIfAnalysisArn: item.WhatIfAnalysisArn,
    Status: item.Status,
    CreationTime: item.CreationTime,
    LastModificationTime: item.LastModificationTime,
  };
};

const ListWhatIfForecasts: OperationHandler = (input, ctx) => {
  const all = applyFilters(
    ctx.store
      .list<StoredWhatIfForecast>()
      .filter((entry) => entry.key.startsWith("whatIfForecast#"))
      .map((entry) => entry.value)
      .map((item) => ({
        WhatIfForecastArn: item.WhatIfForecastArn,
        WhatIfForecastName: item.WhatIfForecastName,
        WhatIfAnalysisArn: item.WhatIfAnalysisArn,
        Status: item.Status,
        CreationTime: item.CreationTime,
        LastModificationTime: item.LastModificationTime,
      })),
    input["Filters"],
  );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return { WhatIfForecasts: items, NextToken: nextToken };
};

const DeleteWhatIfForecast: OperationHandler = (input, ctx) => {
  const WhatIfForecastArn = requireString(input, "WhatIfForecastArn");
  requireWhatIfForecast(ctx, WhatIfForecastArn);
  ctx.store.delete(whatIfForecastKey(WhatIfForecastArn));
  ctx.store.delete(tagKey(WhatIfForecastArn));
  return {};
};

const CreateWhatIfForecastExport: OperationHandler = (input, ctx) => {
  const WhatIfForecastExportName = requireString(
    input,
    "WhatIfForecastExportName",
  );
  const WhatIfForecastArns = input["WhatIfForecastArns"];
  if (!Array.isArray(WhatIfForecastArns)) {
    throw awsError(
      "InvalidInputException",
      "WhatIfForecastArns is a required field.",
      400,
    );
  }
  const Destination = input["Destination"];
  if (Destination === undefined) {
    throw awsError(
      "InvalidInputException",
      "Destination is a required field.",
      400,
    );
  }
  const WhatIfForecastExportArn = whatIfForecastExportArn(
    ctx,
    WhatIfForecastExportName,
  );
  if (
    ctx.store.get(whatIfForecastExportKey(WhatIfForecastExportArn)) !==
    undefined
  ) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `WhatIfForecastExport already exists: ${WhatIfForecastExportArn}`,
      400,
    );
  }
  const now = nowSeconds();
  const item: StoredWhatIfForecastExport = {
    WhatIfForecastExportArn,
    WhatIfForecastExportName,
    WhatIfForecastArns: WhatIfForecastArns as string[],
    Destination,
    Status: "ACTIVE",
    CreationTime: now,
    LastModificationTime: now,
  };
  ctx.store.set(whatIfForecastExportKey(WhatIfForecastExportArn), item);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(
      tagKey(WhatIfForecastExportArn),
      input["Tags"] as { Key: string; Value: string }[],
    );
  }
  return { WhatIfForecastExportArn };
};

const DescribeWhatIfForecastExport: OperationHandler = (input, ctx) => {
  const WhatIfForecastExportArn = requireString(
    input,
    "WhatIfForecastExportArn",
  );
  const item = requireWhatIfForecastExport(ctx, WhatIfForecastExportArn);
  return {
    WhatIfForecastExportArn: item.WhatIfForecastExportArn,
    WhatIfForecastExportName: item.WhatIfForecastExportName,
    WhatIfForecastArns: item.WhatIfForecastArns,
    Destination: item.Destination,
    Status: item.Status,
    CreationTime: item.CreationTime,
    LastModificationTime: item.LastModificationTime,
  };
};

const ListWhatIfForecastExports: OperationHandler = (input, ctx) => {
  const all = applyFilters(
    ctx.store
      .list<StoredWhatIfForecastExport>()
      .filter((entry) => entry.key.startsWith("whatIfForecastExport#"))
      .map((entry) => entry.value)
      .map((item) => ({
        WhatIfForecastExportArn: item.WhatIfForecastExportArn,
        WhatIfForecastExportName: item.WhatIfForecastExportName,
        WhatIfForecastArns: item.WhatIfForecastArns,
        Destination: item.Destination,
        Status: item.Status,
        CreationTime: item.CreationTime,
        LastModificationTime: item.LastModificationTime,
      })),
    input["Filters"],
  );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return { WhatIfForecastExports: items, NextToken: nextToken };
};

const DeleteWhatIfForecastExport: OperationHandler = (input, ctx) => {
  const WhatIfForecastExportArn = requireString(
    input,
    "WhatIfForecastExportArn",
  );
  requireWhatIfForecastExport(ctx, WhatIfForecastExportArn);
  ctx.store.delete(whatIfForecastExportKey(WhatIfForecastExportArn));
  ctx.store.delete(tagKey(WhatIfForecastExportArn));
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const ResourceArn = requireString(input, "ResourceArn");
  const Tags = input["Tags"];
  if (!Array.isArray(Tags)) {
    throw awsError("InvalidInputException", "Tags is a required field.", 400);
  }
  const key = tagKey(ResourceArn);
  const existing = ctx.store.get<{ Key: string; Value: string }[]>(key) ?? [];
  const merged = [...existing];
  for (const tag of Tags as { Key: string; Value: string }[]) {
    const idx = merged.findIndex((t) => t.Key === tag.Key);
    if (idx >= 0) {
      merged[idx] = tag;
    } else {
      merged.push(tag);
    }
  }
  ctx.store.set(key, merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const ResourceArn = requireString(input, "ResourceArn");
  const TagKeys = input["TagKeys"];
  if (!Array.isArray(TagKeys)) {
    throw awsError(
      "InvalidInputException",
      "TagKeys is a required field.",
      400,
    );
  }
  const key = tagKey(ResourceArn);
  const existing = ctx.store.get<{ Key: string; Value: string }[]>(key) ?? [];
  const filtered = existing.filter(
    (t) => !(TagKeys as string[]).includes(t.Key),
  );
  ctx.store.set(key, filtered);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const ResourceArn = requireString(input, "ResourceArn");
  const Tags =
    ctx.store.get<{ Key: string; Value: string }[]>(tagKey(ResourceArn)) ?? [];
  return { Tags };
};

const stopResourceKeyFns = [
  datasetImportJobKey,
  predictorKey,
  forecastKey,
  explainabilityKey,
  explainabilityExportKey,
  forecastExportJobKey,
  predictorBacktestExportJobKey,
];

const StopResource: OperationHandler = (input, ctx) => {
  const ResourceArn = requireString(input, "ResourceArn");
  const monitorItem = ctx.store.get<{
    Status: string;
    LastModificationTime: number;
  }>(monitorKey(ResourceArn));
  if (monitorItem !== undefined) {
    monitorItem.Status = "ACTIVE_STOPPED";
    monitorItem.LastModificationTime = nowSeconds();
    ctx.store.set(monitorKey(ResourceArn), monitorItem);
    return {};
  }
  for (const keyFn of stopResourceKeyFns) {
    const item = ctx.store.get<{
      Status: string;
      LastModificationTime: number;
    }>(keyFn(ResourceArn));
    if (item !== undefined) {
      item.Status = "CREATE_STOPPED";
      item.LastModificationTime = nowSeconds();
      ctx.store.set(keyFn(ResourceArn), item);
      return {};
    }
  }
  throw awsError(
    "ResourceNotFoundException",
    `No resource found ${ResourceArn}`,
    400,
  );
};

const ResumeResource: OperationHandler = (input, ctx) => {
  const ResourceArn = requireString(input, "ResourceArn");
  const item = ctx.store.get<{
    Status: string;
    LastModificationTime: number;
  }>(monitorKey(ResourceArn));
  if (item !== undefined) {
    item.Status = "ACTIVE";
    item.LastModificationTime = nowSeconds();
    ctx.store.set(monitorKey(ResourceArn), item);
    return {};
  }
  throw awsError(
    "ResourceNotFoundException",
    `No resource found ${ResourceArn}`,
    400,
  );
};

const allResourceKeyFns = [
  datasetKey,
  datasetGroupKey,
  datasetImportJobKey,
  predictorKey,
  forecastKey,
  forecastExportJobKey,
  explainabilityKey,
  explainabilityExportKey,
  monitorKey,
  predictorBacktestExportJobKey,
  whatIfAnalysisKey,
  whatIfForecastKey,
  whatIfForecastExportKey,
];

const collectCascadeArns = (
  ctx: ServiceContext,
  rootArn: string,
): Set<string> => {
  const toDelete = new Set<string>([rootArn]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const { key, value } of ctx.store.list<Record<string, unknown>>()) {
      const entryArn = key.slice(key.indexOf("#") + 1);
      if (toDelete.has(entryArn)) continue;
      const v = value;
      const parentRefs: unknown[] = [
        v["DatasetArn"],
        v["DatasetGroupArn"],
        v["PredictorArn"],
        v["ForecastArn"],
        v["WhatIfAnalysisArn"],
        v["ExplainabilityArn"],
        v["ResourceArn"],
        ...(Array.isArray(v["WhatIfForecastArns"])
          ? (v["WhatIfForecastArns"] as unknown[])
          : []),
      ];
      if (parentRefs.some((r) => typeof r === "string" && toDelete.has(r))) {
        toDelete.add(entryArn);
        changed = true;
      }
    }
  }
  return toDelete;
};

const DeleteResourceTree: OperationHandler = (input, ctx) => {
  const ResourceArn = requireString(input, "ResourceArn");
  let found = false;
  for (const keyFn of allResourceKeyFns) {
    if (ctx.store.get(keyFn(ResourceArn)) !== undefined) {
      found = true;
      break;
    }
  }
  if (!found) {
    throw awsError(
      "ResourceNotFoundException",
      `No resource found ${ResourceArn}`,
      400,
    );
  }
  const arnsToDelete = collectCascadeArns(ctx, ResourceArn);
  for (const arn of arnsToDelete) {
    for (const keyFn of allResourceKeyFns) {
      ctx.store.delete(keyFn(arn));
    }
    ctx.store.delete(tagKey(arn));
  }
  return {};
};

const forecast = {
  name: "forecast",
  protocol: "json",
  operations: {
    CreateAutoPredictor,
    CreateDataset,
    CreateDatasetGroup,
    CreateDatasetImportJob,
    CreateExplainability,
    CreateExplainabilityExport,
    CreateForecast,
    CreateForecastExportJob,
    CreateMonitor,
    CreatePredictor,
    CreatePredictorBacktestExportJob,
    CreateWhatIfAnalysis,
    CreateWhatIfForecast,
    CreateWhatIfForecastExport,
    DeleteDataset,
    DeleteDatasetGroup,
    DeleteDatasetImportJob,
    DeleteExplainability,
    DeleteExplainabilityExport,
    DeleteForecast,
    DeleteForecastExportJob,
    DeleteMonitor,
    DeletePredictor,
    DeletePredictorBacktestExportJob,
    DeleteResourceTree,
    DeleteWhatIfAnalysis,
    DeleteWhatIfForecast,
    DeleteWhatIfForecastExport,
    DescribeAutoPredictor,
    DescribeDataset,
    DescribeDatasetGroup,
    DescribeDatasetImportJob,
    DescribeExplainability,
    DescribeExplainabilityExport,
    DescribeForecast,
    DescribeForecastExportJob,
    DescribeMonitor,
    DescribePredictor,
    DescribePredictorBacktestExportJob,
    DescribeWhatIfAnalysis,
    DescribeWhatIfForecast,
    DescribeWhatIfForecastExport,
    GetAccuracyMetrics,
    ListDatasetGroups,
    ListDatasetImportJobs,
    ListDatasets,
    ListExplainabilities,
    ListExplainabilityExports,
    ListForecastExportJobs,
    ListForecasts,
    ListMonitorEvaluations,
    ListMonitors,
    ListPredictorBacktestExportJobs,
    ListPredictors,
    ListTagsForResource,
    ListWhatIfAnalyses,
    ListWhatIfForecastExports,
    ListWhatIfForecasts,
    ResumeResource,
    StopResource,
    TagResource,
    UntagResource,
    UpdateDatasetGroup,
  },
  model,
} as const satisfies ServiceDefinition;

export default forecast;
