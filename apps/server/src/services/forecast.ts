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

const datasetKey = (arn: string): string => `dataset#${arn}`;

const datasetArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:forecast:${ctx.region}:${ctx.account}:dataset/${name}`;

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

const CreateDataset: OperationHandler = (input, ctx) => {
  const DatasetName = requireString(input, "DatasetName");
  const Domain = requireString(input, "Domain");
  const DatasetType = requireString(input, "DatasetType");
  const Schema = input["Schema"];
  if (Schema === undefined) {
    throw awsError("InvalidInputException", "Schema is a required field.", 400);
  }
  const DatasetArn = datasetArn(ctx, DatasetName);
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
  const Datasets = ctx.store
    .list<StoredDataset>()
    .map((entry) => entry.value)
    .map((dataset) => ({
      DatasetArn: dataset.DatasetArn,
      DatasetName: dataset.DatasetName,
      DatasetType: dataset.DatasetType,
      Domain: dataset.Domain,
      CreationTime: dataset.CreationTime,
      LastModificationTime: dataset.LastModificationTime,
    }));
  return { Datasets };
};

const DeleteDataset: OperationHandler = (input, ctx) => {
  const DatasetArn = requireString(input, "DatasetArn");
  requireDataset(ctx, DatasetArn);
  ctx.store.delete(datasetKey(DatasetArn));
  return {};
};

const forecast = {
  name: "forecast",
  protocol: "json",
  operations: {
    CreateDataset,
    DescribeDataset,
    ListDatasets,
    DeleteDataset,
  },
  model,
} as const satisfies ServiceDefinition;

export default forecast;
