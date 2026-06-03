import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import dataexchangeModel from "../../../../test/vendor/aws-models/dataexchange.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(dataexchangeModel);

const dataSetPrefix = "data-set:" as const;

type StoredDataSet = {
  Id: string;
  Arn: string;
  AssetType: string;
  Description: string;
  Name: string;
  Origin: string;
  CreatedAt: number;
  UpdatedAt: number;
  Tags: Record<string, unknown>;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const tagsOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const newId = (): string => crypto.randomUUID().replaceAll("-", "");

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const dataSetKey = (id: string): string => `${dataSetPrefix}${id}`;

const dataSetArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:dataexchange:${ctx.region}:${ctx.account}:data-sets/${id}`;

const dataSetView = (dataSet: StoredDataSet): Record<string, unknown> => ({
  Id: dataSet.Id,
  Arn: dataSet.Arn,
  AssetType: dataSet.AssetType,
  Description: dataSet.Description,
  Name: dataSet.Name,
  Origin: dataSet.Origin,
  CreatedAt: dataSet.CreatedAt,
  UpdatedAt: dataSet.UpdatedAt,
  Tags: dataSet.Tags,
});

const requireDataSet = (ctx: ServiceContext, id: string): StoredDataSet => {
  const stored = ctx.store.get<StoredDataSet>(dataSetKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `DataSet ${id} could not be found.`,
      404,
    );
  }
  return stored;
};

const CreateDataSet: OperationHandler = (input, ctx) => {
  const assetType = requireString(input, "AssetType");
  const description = requireString(input, "Description");
  const name = requireString(input, "Name");
  const id = newId();
  const now = nowSeconds();
  const dataSet: StoredDataSet = {
    Id: id,
    Arn: dataSetArn(ctx, id),
    AssetType: assetType,
    Description: description,
    Name: name,
    Origin: "OWNED",
    CreatedAt: now,
    UpdatedAt: now,
    Tags: tagsOrEmpty(input["Tags"]),
  };
  ctx.store.set(dataSetKey(id), dataSet);
  return dataSetView(dataSet);
};

const GetDataSet: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DataSetId");
  return dataSetView(requireDataSet(ctx, id));
};

const ListDataSets: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const dataSets = ctx.store
    .list<StoredDataSet>()
    .filter((entry) => entry.key.startsWith(dataSetPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0));
  return { DataSets: dataSets.slice(0, max).map(dataSetView) };
};

const UpdateDataSet: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DataSetId");
  const existing = requireDataSet(ctx, id);
  const dataSet: StoredDataSet = {
    Id: existing.Id,
    Arn: existing.Arn,
    AssetType: existing.AssetType,
    Description:
      stringOrUndefined(input["Description"]) ?? existing.Description,
    Name: stringOrUndefined(input["Name"]) ?? existing.Name,
    Origin: existing.Origin,
    CreatedAt: existing.CreatedAt,
    UpdatedAt: nowSeconds(),
    Tags: existing.Tags,
  };
  ctx.store.set(dataSetKey(id), dataSet);
  return dataSetView(dataSet);
};

const DeleteDataSet: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DataSetId");
  requireDataSet(ctx, id);
  ctx.store.delete(dataSetKey(id));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const dataexchange = {
  name: "dataexchange",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "v1" || parts[1] !== "data-sets") return undefined;
    if (parts.length === 2) {
      if (req.method === "POST") return "CreateDataSet";
      if (req.method === "GET") return "ListDataSets";
      return undefined;
    }
    if (parts.length === 3) {
      if (req.method === "GET") return "GetDataSet";
      if (req.method === "PATCH") return "UpdateDataSet";
      if (req.method === "DELETE") return "DeleteDataSet";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateDataSet,
    GetDataSet,
    ListDataSets,
    UpdateDataSet,
    DeleteDataSet,
  },
  model,
} as const satisfies ServiceDefinition;

export default dataexchange;
