import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import iotsitewiseModel from "../../../../test/vendor/aws-models/iotsitewise.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(iotsitewiseModel);

const assetModelPrefix = "asset-model:" as const;

type StoredAssetModel = {
  id: string;
  arn: string;
  name: string;
  description: string;
  assetModelType: string;
  creationDate: number;
  lastUpdateDate: number;
  state: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

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

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const assetModelKey = (id: string): string => `${assetModelPrefix}${id}`;

const requireAssetModel = (
  ctx: ServiceContext,
  id: string,
): StoredAssetModel => {
  const stored = ctx.store.get<StoredAssetModel>(assetModelKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No asset model exists for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const summaryView = (model: StoredAssetModel): Record<string, unknown> => ({
  id: model.id,
  arn: model.arn,
  name: model.name,
  assetModelType: model.assetModelType,
  description: model.description,
  creationDate: model.creationDate,
  lastUpdateDate: model.lastUpdateDate,
  status: { state: model.state },
});

const CreateAssetModel: OperationHandler = (input, ctx) => {
  const name = requireString(input, "assetModelName");
  const id = crypto.randomUUID();
  const arn = `arn:aws:iotsitewise:${ctx.region}:${ctx.account}:asset-model/${id}`;
  const now = nowSeconds();
  const assetModel: StoredAssetModel = {
    id,
    arn,
    name,
    description: stringOrUndefined(input["assetModelDescription"]) ?? "",
    assetModelType: stringOrUndefined(input["assetModelType"]) ?? "ASSET_MODEL",
    creationDate: now,
    lastUpdateDate: now,
    state: "CREATING",
  };
  ctx.store.set(assetModelKey(id), assetModel);
  return {
    assetModelId: id,
    assetModelArn: arn,
    assetModelStatus: { state: "CREATING" },
  };
};

const DescribeAssetModel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "assetModelId");
  const assetModel = requireAssetModel(ctx, id);
  return {
    assetModelId: assetModel.id,
    assetModelArn: assetModel.arn,
    assetModelName: assetModel.name,
    assetModelType: assetModel.assetModelType,
    assetModelDescription: assetModel.description,
    assetModelProperties: [],
    assetModelHierarchies: [],
    assetModelCreationDate: assetModel.creationDate,
    assetModelLastUpdateDate: assetModel.lastUpdateDate,
    assetModelStatus: { state: assetModel.state },
  };
};

const ListAssetModels: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 50;
  const summaries = ctx.store
    .list<StoredAssetModel>()
    .filter((entry) => entry.key.startsWith(assetModelPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { assetModelSummaries: summaries.slice(0, max).map(summaryView) };
};

const DeleteAssetModel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "assetModelId");
  requireAssetModel(ctx, id);
  ctx.store.delete(assetModelKey(id));
  return { assetModelStatus: { state: "DELETING" } };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const iotsitewise = {
  name: "iotsitewise",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "asset-models") return undefined;
    if (parts.length === 1) {
      if (req.method === "POST") return "CreateAssetModel";
      if (req.method === "GET") return "ListAssetModels";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "GET") return "DescribeAssetModel";
      if (req.method === "DELETE") return "DeleteAssetModel";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateAssetModel,
    DescribeAssetModel,
    ListAssetModels,
    DeleteAssetModel,
  },
  model,
} as const satisfies ServiceDefinition;

export default iotsitewise;
