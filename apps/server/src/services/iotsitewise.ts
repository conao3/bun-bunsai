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
const assetModelCompositePrefix = "asset-model-composite:" as const;
const assetModelIfacePrefix = "asset-model-iface:" as const;
const assetPrefix = "asset:" as const;
const assetAssocPrefix = "asset-assoc:" as const;
const gatewayPrefix = "gateway:" as const;
const gatewayCapsPrefix = "gateway-caps:" as const;
const portalPrefix = "portal:" as const;
const projectPrefix = "project:" as const;
const projectAssetsPrefix = "project-assets:" as const;
const dashboardPrefix = "dashboard:" as const;
const datasetPrefix = "dataset:" as const;
const accessPolicyPrefix = "access-policy:" as const;
const computationModelPrefix = "computation-model:" as const;
const bulkImportJobPrefix = "bulk-import-job:" as const;
const tagsPrefix = "tags:" as const;
const actionPrefix = "action:" as const;
const executionPrefix = "execution:" as const;
const timeseriesPrefix = "timeseries:" as const;
const propertyValuePrefix = "property-value:" as const;
const propertyValueHistoryPrefix = "property-value-history:" as const;
const encryptionConfigKey = "config:encryption" as const;
const storageConfigKey = "config:storage" as const;
const loggingOptionsKey = "config:logging" as const;

type StoredAssetModel = {
  id: string;
  arn: string;
  name: string;
  description: string;
  assetModelType: string;
  creationDate: number;
  lastUpdateDate: number;
  state: string;
  clientToken?: string;
};

type StoredAssetModelCompositeModel = {
  assetModelId: string;
  id: string;
  name: string;
  description: string;
  type: string;
  state: string;
};

type StoredAssetModelIfaceRelationship = {
  assetModelId: string;
  interfaceAssetModelId: string;
  relationshipType: string;
};

type StoredAsset = {
  id: string;
  arn: string;
  name: string;
  description: string;
  assetModelId: string;
  creationDate: number;
  lastUpdateDate: number;
  state: string;
  clientToken?: string;
};

type StoredGateway = {
  id: string;
  arn: string;
  name: string;
  platformType: string;
  creationDate: number;
  lastUpdateDate: number;
  state: string;
};

type StoredGatewayCapability = {
  namespace: string;
  configuration: string;
  syncStatus: string;
};

type StoredPortal = {
  id: string;
  arn: string;
  name: string;
  description: string;
  contactEmail: string;
  startUrl: string;
  status: string;
  creationDate: number;
  lastUpdateDate: number;
  clientToken?: string;
};

type StoredProject = {
  id: string;
  name: string;
  description: string;
  portalId: string;
  creationDate: number;
  lastUpdateDate: number;
  clientToken?: string;
};

type StoredDashboard = {
  id: string;
  name: string;
  description: string;
  definition: string;
  projectId: string;
  creationDate: number;
  lastUpdateDate: number;
  clientToken?: string;
};

type StoredDataset = {
  id: string;
  arn: string;
  name: string;
  description: string;
  state: string;
  creationDate: number;
  lastUpdateDate: number;
  clientToken?: string;
};

type StoredAccessPolicy = {
  id: string;
  identity: unknown;
  resource: unknown;
  permission: string;
  creationDate: number;
  lastUpdateDate: number;
};

type StoredComputationModel = {
  id: string;
  arn: string;
  name: string;
  description: string;
  state: string;
  creationDate: number;
  lastUpdateDate: number;
  clientToken?: string;
};

type StoredBulkImportJob = {
  id: string;
  name: string;
  state: string;
};

type StoredTimeSeries = {
  alias: string;
  assetId: string | undefined;
  propertyId: string | undefined;
  timeSeriesId: string;
  timeSeriesArn: string;
  dataType: string;
  timeSeriesCreationDate: number;
  timeSeriesLastUpdateDate: number;
};

type StoredPropertyValue = {
  assetId: string;
  propertyId: string;
  value: unknown;
  timestamp: number;
  quality: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

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
const assetModelCompositeKey = (modelId: string, compositeId: string): string =>
  `${assetModelCompositePrefix}${modelId}:${compositeId}`;
const assetModelIfaceKey = (modelId: string, ifaceId: string): string =>
  `${assetModelIfacePrefix}${modelId}:${ifaceId}`;
const assetKey = (id: string): string => `${assetPrefix}${id}`;
const assetAssocKey = (assetId: string): string =>
  `${assetAssocPrefix}${assetId}`;
const gatewayKey = (id: string): string => `${gatewayPrefix}${id}`;
const gatewayCapsKey = (gatewayId: string, ns: string): string =>
  `${gatewayCapsPrefix}${gatewayId}:${ns}`;
const portalKey = (id: string): string => `${portalPrefix}${id}`;
const projectKey = (id: string): string => `${projectPrefix}${id}`;
const projectAssetsKey = (projectId: string): string =>
  `${projectAssetsPrefix}${projectId}`;
const dashboardKey = (id: string): string => `${dashboardPrefix}${id}`;
const datasetKey = (id: string): string => `${datasetPrefix}${id}`;
const accessPolicyKey = (id: string): string => `${accessPolicyPrefix}${id}`;
const computationModelKey = (id: string): string =>
  `${computationModelPrefix}${id}`;
const bulkImportJobKey = (id: string): string => `${bulkImportJobPrefix}${id}`;
const tagsKey = (resourceArn: string): string => `${tagsPrefix}${resourceArn}`;
const actionKey = (id: string): string => `${actionPrefix}${id}`;
const executionKey = (id: string): string => `${executionPrefix}${id}`;
const timeseriesKey = (id: string): string => `${timeseriesPrefix}${id}`;
const propertyValueKey = (assetId: string, propertyId: string): string =>
  `${propertyValuePrefix}${assetId}:${propertyId}`;
const propertyValueHistoryKey = (assetId: string, propertyId: string): string =>
  `${propertyValueHistoryPrefix}${assetId}:${propertyId}`;

const makeArn = (
  ctx: ServiceContext,
  resourceType: string,
  id: string,
): string =>
  `arn:aws:iotsitewise:${ctx.region}:${ctx.account}:${resourceType}/${id}`;

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

const requireAsset = (ctx: ServiceContext, id: string): StoredAsset => {
  const stored = ctx.store.get<StoredAsset>(assetKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No asset exists for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requireGateway = (ctx: ServiceContext, id: string): StoredGateway => {
  const stored = ctx.store.get<StoredGateway>(gatewayKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No gateway exists for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requirePortal = (ctx: ServiceContext, id: string): StoredPortal => {
  const stored = ctx.store.get<StoredPortal>(portalKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No portal exists for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requireProject = (ctx: ServiceContext, id: string): StoredProject => {
  const stored = ctx.store.get<StoredProject>(projectKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No project exists for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requireDashboard = (ctx: ServiceContext, id: string): StoredDashboard => {
  const stored = ctx.store.get<StoredDashboard>(dashboardKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No dashboard exists for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requireDataset = (ctx: ServiceContext, id: string): StoredDataset => {
  const stored = ctx.store.get<StoredDataset>(datasetKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No dataset exists for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requireAccessPolicy = (
  ctx: ServiceContext,
  id: string,
): StoredAccessPolicy => {
  const stored = ctx.store.get<StoredAccessPolicy>(accessPolicyKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No access policy exists for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requireComputationModel = (
  ctx: ServiceContext,
  id: string,
): StoredComputationModel => {
  const stored = ctx.store.get<StoredComputationModel>(computationModelKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No computation model exists for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const requireBulkImportJob = (
  ctx: ServiceContext,
  id: string,
): StoredBulkImportJob => {
  const stored = ctx.store.get<StoredBulkImportJob>(bulkImportJobKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No bulk import job exists for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
  defaultMax = 50,
): { items: T[]; nextToken: string | undefined } => {
  const pageSize =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : defaultMax;
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

const assetModelSummaryView = (
  m: StoredAssetModel,
): Record<string, unknown> => ({
  id: m.id,
  arn: m.arn,
  name: m.name,
  assetModelType: m.assetModelType,
  description: m.description,
  creationDate: m.creationDate,
  lastUpdateDate: m.lastUpdateDate,
  status: { state: m.state },
});

// --- Asset Model CRUD (existing 4 + UpdateAssetModel) ---

const CreateAssetModel: OperationHandler = (input, ctx) => {
  const clientToken = stringOrUndefined(input["clientToken"]);
  if (clientToken !== undefined) {
    const found = ctx.store
      .list<StoredAssetModel>()
      .filter((e) => e.key.startsWith(assetModelPrefix))
      .map((e) => e.value)
      .find((m) => m.clientToken === clientToken);
    if (found !== undefined) {
      return {
        assetModelId: found.id,
        assetModelArn: found.arn,
        assetModelStatus: { state: "CREATING" },
      };
    }
  }
  const name = requireString(input, "assetModelName");
  const id = crypto.randomUUID();
  const arn = makeArn(ctx, "asset-model", id);
  const now = nowSeconds();
  const assetModel: StoredAssetModel = {
    id,
    arn,
    name,
    description: stringOrUndefined(input["assetModelDescription"]) ?? "",
    assetModelType: stringOrUndefined(input["assetModelType"]) ?? "ASSET_MODEL",
    creationDate: now,
    lastUpdateDate: now,
    state: "ACTIVE",
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(assetModelKey(id), assetModel);
  if (input["tags"] !== undefined) {
    ctx.store.set(tagsKey(arn), input["tags"] as Record<string, string>);
  }
  return {
    assetModelId: id,
    assetModelArn: arn,
    assetModelStatus: { state: "CREATING" },
  };
};

const DescribeAssetModel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "assetModelId");
  const m = requireAssetModel(ctx, id);
  return {
    assetModelId: m.id,
    assetModelArn: m.arn,
    assetModelName: m.name,
    assetModelType: m.assetModelType,
    assetModelDescription: m.description,
    assetModelProperties: [],
    assetModelHierarchies: [],
    assetModelCreationDate: m.creationDate,
    assetModelLastUpdateDate: m.lastUpdateDate,
    assetModelStatus: { state: m.state },
  };
};

const ListAssetModels: OperationHandler = (input, ctx) => {
  const summaries = ctx.store
    .list<StoredAssetModel>()
    .filter((entry) => entry.key.startsWith(assetModelPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const { items, nextToken } = paginateList(
    summaries,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    assetModelSummaries: items.map(assetModelSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteAssetModel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "assetModelId");
  const model = requireAssetModel(ctx, id);
  const childAsset = ctx.store
    .list<StoredAsset>()
    .filter((e) => e.key.startsWith(assetPrefix))
    .map((e) => e.value)
    .find((a) => a.assetModelId === id);
  if (childAsset !== undefined) {
    throw awsError(
      "ConflictingOperationException",
      `Cannot delete asset model ${id} because assets exist that were created from it.`,
      409,
    );
  }
  ctx.store.delete(assetModelKey(id));
  ctx.store.delete(tagsKey(model.arn));
  return { assetModelStatus: { state: "DELETING" } };
};

const UpdateAssetModel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "assetModelId");
  const existing = requireAssetModel(ctx, id);
  const updated: StoredAssetModel = {
    id: existing.id,
    arn: existing.arn,
    name: stringOrUndefined(input["assetModelName"]) ?? existing.name,
    description:
      stringOrUndefined(input["assetModelDescription"]) ?? existing.description,
    assetModelType: existing.assetModelType,
    creationDate: existing.creationDate,
    lastUpdateDate: nowSeconds(),
    state: "ACTIVE",
  };
  ctx.store.set(assetModelKey(id), updated);
  return { assetModelStatus: { state: "UPDATING" } };
};

// --- Asset Model Composite Models ---

const CreateAssetModelCompositeModel: OperationHandler = (input, ctx) => {
  const assetModelId = requireString(input, "assetModelId");
  requireAssetModel(ctx, assetModelId);
  const name = requireString(input, "assetModelCompositeModelName");
  const compositeId = crypto.randomUUID();
  const composite: StoredAssetModelCompositeModel = {
    assetModelId,
    id: compositeId,
    name,
    description:
      stringOrUndefined(input["assetModelCompositeModelDescription"]) ?? "",
    type:
      stringOrUndefined(input["assetModelCompositeModelType"]) ?? "COMPONENT",
    state: "CREATING",
  };
  ctx.store.set(assetModelCompositeKey(assetModelId, compositeId), composite);
  return {
    assetModelCompositeModelId: compositeId,
    assetModelCompositeModelPath: [{ id: assetModelId }, { id: compositeId }],
    assetModelStatus: { state: "CREATING" },
  };
};

const DescribeAssetModelCompositeModel: OperationHandler = (input, ctx) => {
  const assetModelId = requireString(input, "assetModelId");
  const compositeId = requireString(input, "assetModelCompositeModelId");
  requireAssetModel(ctx, assetModelId);
  const composite = ctx.store.get<StoredAssetModelCompositeModel>(
    assetModelCompositeKey(assetModelId, compositeId),
  );
  if (composite === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No composite model exists for ID ${compositeId}.`,
      404,
    );
  }
  return {
    assetModelId,
    assetModelCompositeModelId: compositeId,
    assetModelCompositeModelName: composite.name,
    assetModelCompositeModelDescription: composite.description,
    assetModelCompositeModelType: composite.type,
    assetModelCompositeModelProperties: [],
    assetModelCompositeModelPath: [{ id: assetModelId }, { id: compositeId }],
    assetModelCompositeModelStatus: { state: composite.state },
    assetModelCompositeModelSummaries: [],
    compositionDetails: { compositionRelationshipSummaries: [] },
  };
};

const UpdateAssetModelCompositeModel: OperationHandler = (input, ctx) => {
  const assetModelId = requireString(input, "assetModelId");
  const compositeId = requireString(input, "assetModelCompositeModelId");
  requireAssetModel(ctx, assetModelId);
  const existing = ctx.store.get<StoredAssetModelCompositeModel>(
    assetModelCompositeKey(assetModelId, compositeId),
  );
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No composite model exists for ID ${compositeId}.`,
      404,
    );
  }
  const updated: StoredAssetModelCompositeModel = {
    assetModelId,
    id: compositeId,
    name:
      stringOrUndefined(input["assetModelCompositeModelName"]) ?? existing.name,
    description:
      stringOrUndefined(input["assetModelCompositeModelDescription"]) ??
      existing.description,
    type: existing.type,
    state: "UPDATING",
  };
  ctx.store.set(assetModelCompositeKey(assetModelId, compositeId), updated);
  return {
    assetModelCompositeModelPath: [{ id: assetModelId }, { id: compositeId }],
    assetModelStatus: { state: "UPDATING" },
  };
};

const DeleteAssetModelCompositeModel: OperationHandler = (input, ctx) => {
  const assetModelId = requireString(input, "assetModelId");
  const compositeId = requireString(input, "assetModelCompositeModelId");
  requireAssetModel(ctx, assetModelId);
  ctx.store.delete(assetModelCompositeKey(assetModelId, compositeId));
  return { assetModelStatus: { state: "DELETING" } };
};

const ListAssetModelCompositeModels: OperationHandler = (input, ctx) => {
  const assetModelId = requireString(input, "assetModelId");
  requireAssetModel(ctx, assetModelId);
  const prefix = assetModelCompositeKey(assetModelId, "");
  const items = ctx.store
    .list<StoredAssetModelCompositeModel>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      type: c.type,
      status: { state: c.state },
      path: [{ id: assetModelId }, { id: c.id }],
    }));
  return { assetModelCompositeModelSummaries: items };
};

const ListAssetModelProperties: OperationHandler = (input, ctx) => {
  const assetModelId = requireString(input, "assetModelId");
  requireAssetModel(ctx, assetModelId);
  return { assetModelPropertySummaries: [] };
};

const ListCompositionRelationships: OperationHandler = (input, ctx) => {
  const assetModelId = requireString(input, "assetModelId");
  requireAssetModel(ctx, assetModelId);
  return { compositionRelationshipSummaries: [] };
};

// --- Asset Model Interface Relationships ---

const DescribeAssetModelInterfaceRelationship: OperationHandler = (
  input,
  ctx,
) => {
  const assetModelId = requireString(input, "assetModelId");
  const interfaceAssetModelId = requireString(input, "interfaceAssetModelId");
  const rel = ctx.store.get<StoredAssetModelIfaceRelationship>(
    assetModelIfaceKey(assetModelId, interfaceAssetModelId),
  );
  if (rel === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No interface relationship exists.`,
      404,
    );
  }
  return {
    assetModelId: rel.assetModelId,
    interfaceAssetModelId: rel.interfaceAssetModelId,
    relationshipType: rel.relationshipType,
  };
};

const PutAssetModelInterfaceRelationship: OperationHandler = (input, ctx) => {
  const assetModelId = requireString(input, "assetModelId");
  const interfaceAssetModelId = requireString(input, "interfaceAssetModelId");
  const rel: StoredAssetModelIfaceRelationship = {
    assetModelId,
    interfaceAssetModelId,
    relationshipType:
      stringOrUndefined(input["relationshipType"]) ?? "IMPLEMENTS",
  };
  ctx.store.set(assetModelIfaceKey(assetModelId, interfaceAssetModelId), rel);
  return {};
};

const DeleteAssetModelInterfaceRelationship: OperationHandler = (
  input,
  ctx,
) => {
  const assetModelId = requireString(input, "assetModelId");
  const interfaceAssetModelId = requireString(input, "interfaceAssetModelId");
  ctx.store.delete(assetModelIfaceKey(assetModelId, interfaceAssetModelId));
  return {};
};

const ListInterfaceRelationships: OperationHandler = (input, ctx) => {
  const interfaceAssetModelId = requireString(input, "interfaceAssetModelId");
  const items = ctx.store
    .list<StoredAssetModelIfaceRelationship>()
    .filter((e) => e.key.endsWith(`:${interfaceAssetModelId}`))
    .map((e) => ({
      assetModelId: e.value.assetModelId,
      interfaceAssetModelId: e.value.interfaceAssetModelId,
      relationshipType: e.value.relationshipType,
    }));
  return { assetModelInterfaceRelationshipSummaries: items };
};

// --- Assets ---

const assetSummaryView = (a: StoredAsset): Record<string, unknown> => ({
  id: a.id,
  arn: a.arn,
  name: a.name,
  assetModelId: a.assetModelId,
  creationDate: a.creationDate,
  lastUpdateDate: a.lastUpdateDate,
  status: { state: a.state },
  hierarchies: [],
});

const CreateAsset: OperationHandler = (input, ctx) => {
  const clientToken = stringOrUndefined(input["clientToken"]);
  if (clientToken !== undefined) {
    const found = ctx.store
      .list<StoredAsset>()
      .filter((e) => e.key.startsWith(assetPrefix))
      .map((e) => e.value)
      .find((a) => a.clientToken === clientToken);
    if (found !== undefined) {
      return {
        assetId: found.id,
        assetArn: found.arn,
        assetStatus: { state: "CREATING" },
      };
    }
  }
  const name = requireString(input, "assetName");
  const assetModelId = requireString(input, "assetModelId");
  requireAssetModel(ctx, assetModelId);
  const id = crypto.randomUUID();
  const arn = makeArn(ctx, "asset", id);
  const now = nowSeconds();
  const asset: StoredAsset = {
    id,
    arn,
    name,
    description: stringOrUndefined(input["assetDescription"]) ?? "",
    assetModelId,
    creationDate: now,
    lastUpdateDate: now,
    state: "ACTIVE",
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(assetKey(id), asset);
  if (input["tags"] !== undefined) {
    ctx.store.set(tagsKey(arn), input["tags"] as Record<string, string>);
  }
  return {
    assetId: id,
    assetArn: arn,
    assetStatus: { state: "CREATING" },
  };
};

const DescribeAsset: OperationHandler = (input, ctx) => {
  const id = requireString(input, "assetId");
  const a = requireAsset(ctx, id);
  return {
    assetId: a.id,
    assetArn: a.arn,
    assetName: a.name,
    assetModelId: a.assetModelId,
    assetDescription: a.description,
    assetProperties: [],
    assetHierarchies: [],
    assetCompositeModels: [],
    assetCreationDate: a.creationDate,
    assetLastUpdateDate: a.lastUpdateDate,
    assetStatus: { state: a.state },
  };
};

const UpdateAsset: OperationHandler = (input, ctx) => {
  const id = requireString(input, "assetId");
  const existing = requireAsset(ctx, id);
  const updated: StoredAsset = {
    id: existing.id,
    arn: existing.arn,
    name: stringOrUndefined(input["assetName"]) ?? existing.name,
    description:
      stringOrUndefined(input["assetDescription"]) ?? existing.description,
    assetModelId: existing.assetModelId,
    creationDate: existing.creationDate,
    lastUpdateDate: nowSeconds(),
    state: "ACTIVE",
  };
  ctx.store.set(assetKey(id), updated);
  return { assetStatus: { state: "UPDATING" } };
};

const DeleteAsset: OperationHandler = (input, ctx) => {
  const id = requireString(input, "assetId");
  const asset = requireAsset(ctx, id);
  ctx.store.delete(assetKey(id));
  ctx.store.delete(assetAssocKey(id));
  ctx.store.delete(tagsKey(asset.arn));
  return { assetStatus: { state: "DELETING" } };
};

const ListAssets: OperationHandler = (input, ctx) => {
  const assetModelIdFilter = stringOrUndefined(input["assetModelId"]);
  const filter = stringOrUndefined(input["filter"]) ?? "ALL";
  const childIds = new Set(
    ctx.store
      .list<string[]>()
      .filter((e) => e.key.startsWith(assetAssocPrefix))
      .flatMap((e) => e.value),
  );
  let assets = ctx.store
    .list<StoredAsset>()
    .filter((e) => e.key.startsWith(assetPrefix))
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (filter === "TOP_LEVEL") {
    assets = assets.filter((a) => !childIds.has(a.id));
  } else if (assetModelIdFilter !== undefined) {
    assets = assets.filter((a) => a.assetModelId === assetModelIdFilter);
  }
  const { items, nextToken } = paginateList(
    assets,
    input["nextToken"],
    input["maxResults"],
    250,
  );
  return {
    assetSummaries: items.map(assetSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const AssociateAssets: OperationHandler = (input, ctx) => {
  const assetId = requireString(input, "assetId");
  const childAssetId = requireString(input, "childAssetId");
  requireAsset(ctx, assetId);
  requireAsset(ctx, childAssetId);
  const existing = ctx.store.get<string[]>(assetAssocKey(assetId)) ?? [];
  if (!existing.includes(childAssetId)) {
    ctx.store.set(assetAssocKey(assetId), [...existing, childAssetId]);
  }
  return {};
};

const DisassociateAssets: OperationHandler = (input, ctx) => {
  const assetId = requireString(input, "assetId");
  const childAssetId = requireString(input, "childAssetId");
  requireAsset(ctx, assetId);
  const existing = ctx.store.get<string[]>(assetAssocKey(assetId)) ?? [];
  ctx.store.set(
    assetAssocKey(assetId),
    existing.filter((id) => id !== childAssetId),
  );
  return {};
};

const ListAssociatedAssets: OperationHandler = (input, ctx) => {
  const assetId = requireString(input, "assetId");
  requireAsset(ctx, assetId);
  const childIds = ctx.store.get<string[]>(assetAssocKey(assetId)) ?? [];
  const summaries = childIds
    .map((cid) => ctx.store.get<StoredAsset>(assetKey(cid)))
    .filter((a): a is StoredAsset => a !== undefined)
    .map(assetSummaryView);
  return { assetSummaries: summaries };
};

const ListAssetRelationships: OperationHandler = (input, ctx) => {
  const assetId = requireString(input, "assetId");
  requireAsset(ctx, assetId);
  return { assetRelationshipSummaries: [] };
};

const DescribeAssetCompositeModel: OperationHandler = (input, ctx) => {
  const assetId = requireString(input, "assetId");
  const assetCompositeModelId = requireString(input, "assetCompositeModelId");
  requireAsset(ctx, assetId);
  return {
    assetId,
    assetCompositeModelId,
    assetCompositeModelName: "default",
    assetCompositeModelType: "COMPONENT",
    assetCompositeModelDescription: "",
    assetCompositeModelProperties: [],
    assetCompositeModelPath: [{ id: assetId }, { id: assetCompositeModelId }],
    assetCompositeModelSummaries: [],
    tags: {},
  };
};

const ListAssetProperties: OperationHandler = (input, ctx) => {
  const assetId = requireString(input, "assetId");
  requireAsset(ctx, assetId);
  return { assetPropertySummaries: [] };
};

const DescribeAssetProperty: OperationHandler = (input, ctx) => {
  const assetId = requireString(input, "assetId");
  const propertyId = requireString(input, "propertyId");
  const a = requireAsset(ctx, assetId);
  return {
    assetId,
    assetName: a.name,
    assetModelId: a.assetModelId,
    assetProperty: {
      id: propertyId,
      name: "property",
      dataType: "DOUBLE",
      unit: "",
      type: {},
    },
  };
};

const UpdateAssetProperty: OperationHandler = (input, ctx) => {
  const assetId = requireString(input, "assetId");
  requireAsset(ctx, assetId);
  return {};
};

// --- Gateways ---

const gatewaySummaryView = (g: StoredGateway): Record<string, unknown> => ({
  gatewayId: g.id,
  gatewayName: g.name,
  gatewayArn: g.arn,
  gatewayPlatform: { [g.platformType]: {} },
  creationDate: g.creationDate,
  lastUpdateDate: g.lastUpdateDate,
  gatewayCapabilitySummaries: [],
});

const CreateGateway: OperationHandler = (input, ctx) => {
  const name = requireString(input, "gatewayName");
  const id = crypto.randomUUID();
  const arn = makeArn(ctx, "gateway", id);
  const now = nowSeconds();
  const platform = (input["gatewayPlatform"] as Record<string, unknown>) ?? {};
  const platformType = Object.keys(platform)[0] ?? "greengrass";
  const gateway: StoredGateway = {
    id,
    arn,
    name,
    platformType,
    creationDate: now,
    lastUpdateDate: now,
    state: "ACTIVE",
  };
  ctx.store.set(gatewayKey(id), gateway);
  return { gatewayId: id, gatewayArn: arn };
};

const DescribeGateway: OperationHandler = (input, ctx) => {
  const id = requireString(input, "gatewayId");
  const g = requireGateway(ctx, id);
  return {
    gatewayId: g.id,
    gatewayName: g.name,
    gatewayArn: g.arn,
    gatewayPlatform: { [g.platformType]: {} },
    gatewayCapabilitySummaries: [],
    creationDate: g.creationDate,
    lastUpdateDate: g.lastUpdateDate,
  };
};

const UpdateGateway: OperationHandler = (input, ctx) => {
  const id = requireString(input, "gatewayId");
  const existing = requireGateway(ctx, id);
  const updated: StoredGateway = {
    id: existing.id,
    arn: existing.arn,
    name: stringOrUndefined(input["gatewayName"]) ?? existing.name,
    platformType: existing.platformType,
    creationDate: existing.creationDate,
    lastUpdateDate: nowSeconds(),
    state: existing.state,
  };
  ctx.store.set(gatewayKey(id), updated);
  return {};
};

const DeleteGateway: OperationHandler = (input, ctx) => {
  const id = requireString(input, "gatewayId");
  const gateway = requireGateway(ctx, id);
  ctx.store.delete(gatewayKey(id));
  ctx.store.delete(tagsKey(gateway.arn));
  return {};
};

const ListGateways: OperationHandler = (input, ctx) => {
  const gateways = ctx.store
    .list<StoredGateway>()
    .filter((e) => e.key.startsWith(gatewayPrefix))
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const { items, nextToken } = paginateList(
    gateways,
    input["nextToken"],
    input["maxResults"],
    250,
  );
  return {
    gatewaySummaries: items.map(gatewaySummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DescribeGatewayCapabilityConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const gatewayId = requireString(input, "gatewayId");
  const capabilityNamespace = requireString(input, "capabilityNamespace");
  requireGateway(ctx, gatewayId);
  const stored = ctx.store.get<StoredGatewayCapability>(
    gatewayCapsKey(gatewayId, capabilityNamespace),
  ) ?? {
    namespace: capabilityNamespace,
    configuration: "{}",
    syncStatus: "IN_SYNC",
  };
  return {
    gatewayId,
    capabilityNamespace: stored.namespace,
    capabilityConfiguration: stored.configuration,
    capabilitySyncStatus: stored.syncStatus,
  };
};

const UpdateGatewayCapabilityConfiguration: OperationHandler = (input, ctx) => {
  const gatewayId = requireString(input, "gatewayId");
  const ns = requireString(input, "capabilityNamespace");
  requireGateway(ctx, gatewayId);
  const caps: StoredGatewayCapability = {
    namespace: ns,
    configuration: stringOrUndefined(input["capabilityConfiguration"]) ?? "{}",
    syncStatus: "IN_SYNC",
  };
  ctx.store.set(gatewayCapsKey(gatewayId, ns), caps);
  return {
    gatewayId,
    capabilityNamespace: ns,
    capabilitySyncStatus: "IN_SYNC",
  };
};

// --- Portals ---

const portalSummaryView = (p: StoredPortal): Record<string, unknown> => ({
  id: p.id,
  name: p.name,
  description: p.description,
  startUrl: p.startUrl,
  status: { state: p.status },
  creationDate: p.creationDate,
  lastUpdateDate: p.lastUpdateDate,
});

const CreatePortal: OperationHandler = (input, ctx) => {
  const clientToken = stringOrUndefined(input["clientToken"]);
  if (clientToken !== undefined) {
    const found = ctx.store
      .list<StoredPortal>()
      .filter((e) => e.key.startsWith(portalPrefix))
      .map((e) => e.value)
      .find((p) => p.clientToken === clientToken);
    if (found !== undefined) {
      return {
        portalId: found.id,
        portalArn: found.arn,
        portalStartUrl: found.startUrl,
        portalStatus: { state: "CREATING" },
        ssoApplicationId: `sso-${found.id}`,
      };
    }
  }
  const name = requireString(input, "portalName");
  const contactEmail = requireString(input, "portalContactEmail");
  const id = crypto.randomUUID();
  const arn = makeArn(ctx, "portal", id);
  const now = nowSeconds();
  const portal: StoredPortal = {
    id,
    arn,
    name,
    description: stringOrUndefined(input["portalDescription"]) ?? "",
    contactEmail,
    startUrl: `https://${id}.app.iotsitewise.aws`,
    status: "ACTIVE",
    creationDate: now,
    lastUpdateDate: now,
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(portalKey(id), portal);
  if (input["tags"] !== undefined) {
    ctx.store.set(tagsKey(arn), input["tags"] as Record<string, string>);
  }
  return {
    portalId: id,
    portalArn: arn,
    portalStartUrl: portal.startUrl,
    portalStatus: { state: "CREATING" },
    ssoApplicationId: `sso-${id}`,
  };
};

const DescribePortal: OperationHandler = (input, ctx) => {
  const id = requireString(input, "portalId");
  const p = requirePortal(ctx, id);
  return {
    portalId: p.id,
    portalArn: p.arn,
    portalName: p.name,
    portalDescription: p.description,
    portalClientId: `client-${p.id}`,
    portalContactEmail: p.contactEmail,
    portalStartUrl: p.startUrl,
    portalStatus: { state: p.status },
    portalCreationDate: p.creationDate,
    portalLastUpdateDate: p.lastUpdateDate,
    roleArn: `arn:aws:iam::${ctx.account}:role/iotsitewise-portal-role`,
  };
};

const UpdatePortal: OperationHandler = (input, ctx) => {
  const id = requireString(input, "portalId");
  const existing = requirePortal(ctx, id);
  const updated: StoredPortal = {
    id: existing.id,
    arn: existing.arn,
    name: stringOrUndefined(input["portalName"]) ?? existing.name,
    description:
      stringOrUndefined(input["portalDescription"]) ?? existing.description,
    contactEmail:
      stringOrUndefined(input["portalContactEmail"]) ?? existing.contactEmail,
    startUrl: existing.startUrl,
    status: "ACTIVE",
    creationDate: existing.creationDate,
    lastUpdateDate: nowSeconds(),
  };
  ctx.store.set(portalKey(id), updated);
  return { portalStatus: { state: "UPDATING" } };
};

const DeletePortal: OperationHandler = (input, ctx) => {
  const id = requireString(input, "portalId");
  const portal = requirePortal(ctx, id);
  const childProject = ctx.store
    .list<StoredProject>()
    .filter((e) => e.key.startsWith(projectPrefix))
    .map((e) => e.value)
    .find((p) => p.portalId === id);
  if (childProject !== undefined) {
    throw awsError(
      "ConflictingOperationException",
      `Cannot delete portal ${id} because projects exist within it.`,
      409,
    );
  }
  ctx.store.delete(portalKey(id));
  ctx.store.delete(tagsKey(portal.arn));
  return { portalStatus: { state: "DELETING" } };
};

const ListPortals: OperationHandler = (input, ctx) => {
  const portals = ctx.store
    .list<StoredPortal>()
    .filter((e) => e.key.startsWith(portalPrefix))
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const { items, nextToken } = paginateList(
    portals,
    input["nextToken"],
    input["maxResults"],
    250,
  );
  return {
    portalSummaries: items.map(portalSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

// --- Projects ---

const projectSummaryView = (p: StoredProject): Record<string, unknown> => ({
  id: p.id,
  name: p.name,
  description: p.description,
  creationDate: p.creationDate,
  lastUpdateDate: p.lastUpdateDate,
});

const CreateProject: OperationHandler = (input, ctx) => {
  const clientToken = stringOrUndefined(input["clientToken"]);
  if (clientToken !== undefined) {
    const found = ctx.store
      .list<StoredProject>()
      .filter((e) => e.key.startsWith(projectPrefix))
      .map((e) => e.value)
      .find((p) => p.clientToken === clientToken);
    if (found !== undefined) {
      return { projectId: found.id };
    }
  }
  const portalId = requireString(input, "portalId");
  const name = requireString(input, "projectName");
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const project: StoredProject = {
    id,
    name,
    description: stringOrUndefined(input["projectDescription"]) ?? "",
    portalId,
    creationDate: now,
    lastUpdateDate: now,
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(projectKey(id), project);
  if (input["tags"] !== undefined) {
    ctx.store.set(
      tagsKey(makeArn(ctx, "project", id)),
      input["tags"] as Record<string, string>,
    );
  }
  return { projectId: id };
};

const DescribeProject: OperationHandler = (input, ctx) => {
  const id = requireString(input, "projectId");
  const p = requireProject(ctx, id);
  return {
    projectId: p.id,
    projectArn: makeArn(ctx, "project", p.id),
    projectName: p.name,
    portalId: p.portalId,
    projectDescription: p.description,
    projectCreationDate: p.creationDate,
    projectLastUpdateDate: p.lastUpdateDate,
  };
};

const UpdateProject: OperationHandler = (input, ctx) => {
  const id = requireString(input, "projectId");
  const existing = requireProject(ctx, id);
  const updated: StoredProject = {
    id: existing.id,
    name: stringOrUndefined(input["projectName"]) ?? existing.name,
    description:
      stringOrUndefined(input["projectDescription"]) ?? existing.description,
    portalId: existing.portalId,
    creationDate: existing.creationDate,
    lastUpdateDate: nowSeconds(),
  };
  ctx.store.set(projectKey(id), updated);
  return {};
};

const DeleteProject: OperationHandler = (input, ctx) => {
  const id = requireString(input, "projectId");
  requireProject(ctx, id);
  ctx.store.delete(projectKey(id));
  ctx.store.delete(projectAssetsKey(id));
  ctx.store.delete(tagsKey(makeArn(ctx, "project", id)));
  return {};
};

const ListProjects: OperationHandler = (input, ctx) => {
  const portalId = requireString(input, "portalId");
  const projects = ctx.store
    .list<StoredProject>()
    .filter(
      (e) => e.key.startsWith(projectPrefix) && e.value.portalId === portalId,
    )
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const { items, nextToken } = paginateList(
    projects,
    input["nextToken"],
    input["maxResults"],
    250,
  );
  return {
    projectSummaries: items.map(projectSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const BatchAssociateProjectAssets: OperationHandler = (input, ctx) => {
  const projectId = requireString(input, "projectId");
  requireProject(ctx, projectId);
  const assetIds = arrayOrEmpty(input["assetIds"]) as string[];
  const existing = ctx.store.get<string[]>(projectAssetsKey(projectId)) ?? [];
  const merged = Array.from(new Set([...existing, ...assetIds]));
  ctx.store.set(projectAssetsKey(projectId), merged);
  return { errors: [] };
};

const BatchDisassociateProjectAssets: OperationHandler = (input, ctx) => {
  const projectId = requireString(input, "projectId");
  requireProject(ctx, projectId);
  const assetIds = new Set(arrayOrEmpty(input["assetIds"]) as string[]);
  const existing = ctx.store.get<string[]>(projectAssetsKey(projectId)) ?? [];
  ctx.store.set(
    projectAssetsKey(projectId),
    existing.filter((id) => !assetIds.has(id)),
  );
  return { errors: [] };
};

const ListProjectAssets: OperationHandler = (input, ctx) => {
  const projectId = requireString(input, "projectId");
  requireProject(ctx, projectId);
  const max = numberOrUndefined(input["maxResults"]) ?? 250;
  const assetIds = ctx.store.get<string[]>(projectAssetsKey(projectId)) ?? [];
  return { assetIds: assetIds.slice(0, max) };
};

// --- Dashboards ---

const dashboardSummaryView = (d: StoredDashboard): Record<string, unknown> => ({
  id: d.id,
  name: d.name,
  description: d.description,
  creationDate: d.creationDate,
  lastUpdateDate: d.lastUpdateDate,
});

const CreateDashboard: OperationHandler = (input, ctx) => {
  const clientToken = stringOrUndefined(input["clientToken"]);
  if (clientToken !== undefined) {
    const found = ctx.store
      .list<StoredDashboard>()
      .filter((e) => e.key.startsWith(dashboardPrefix))
      .map((e) => e.value)
      .find((d) => d.clientToken === clientToken);
    if (found !== undefined) {
      return {
        dashboardId: found.id,
        dashboardArn: makeArn(ctx, "dashboard", found.id),
      };
    }
  }
  const projectId = requireString(input, "projectId");
  const name = requireString(input, "dashboardName");
  const definition = requireString(input, "dashboardDefinition");
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const dashboard: StoredDashboard = {
    id,
    name,
    description: stringOrUndefined(input["dashboardDescription"]) ?? "",
    definition,
    projectId,
    creationDate: now,
    lastUpdateDate: now,
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(dashboardKey(id), dashboard);
  if (input["tags"] !== undefined) {
    ctx.store.set(
      tagsKey(makeArn(ctx, "dashboard", id)),
      input["tags"] as Record<string, string>,
    );
  }
  return {
    dashboardId: id,
    dashboardArn: makeArn(ctx, "dashboard", id),
  };
};

const DescribeDashboard: OperationHandler = (input, ctx) => {
  const id = requireString(input, "dashboardId");
  const d = requireDashboard(ctx, id);
  return {
    dashboardId: d.id,
    dashboardArn: makeArn(ctx, "dashboard", d.id),
    dashboardName: d.name,
    projectId: d.projectId,
    dashboardDescription: d.description,
    dashboardDefinition: d.definition,
    dashboardCreationDate: d.creationDate,
    dashboardLastUpdateDate: d.lastUpdateDate,
  };
};

const UpdateDashboard: OperationHandler = (input, ctx) => {
  const id = requireString(input, "dashboardId");
  const existing = requireDashboard(ctx, id);
  const updated: StoredDashboard = {
    id: existing.id,
    name: stringOrUndefined(input["dashboardName"]) ?? existing.name,
    description:
      stringOrUndefined(input["dashboardDescription"]) ?? existing.description,
    definition:
      stringOrUndefined(input["dashboardDefinition"]) ?? existing.definition,
    projectId: existing.projectId,
    creationDate: existing.creationDate,
    lastUpdateDate: nowSeconds(),
  };
  ctx.store.set(dashboardKey(id), updated);
  return {};
};

const DeleteDashboard: OperationHandler = (input, ctx) => {
  const id = requireString(input, "dashboardId");
  requireDashboard(ctx, id);
  ctx.store.delete(dashboardKey(id));
  ctx.store.delete(tagsKey(makeArn(ctx, "dashboard", id)));
  return {};
};

const ListDashboards: OperationHandler = (input, ctx) => {
  const projectId = requireString(input, "projectId");
  const dashboards = ctx.store
    .list<StoredDashboard>()
    .filter(
      (e) =>
        e.key.startsWith(dashboardPrefix) && e.value.projectId === projectId,
    )
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const { items, nextToken } = paginateList(
    dashboards,
    input["nextToken"],
    input["maxResults"],
    250,
  );
  return {
    dashboardSummaries: items.map(dashboardSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

// --- Datasets ---

const datasetSummaryView = (d: StoredDataset): Record<string, unknown> => ({
  id: d.id,
  arn: d.arn,
  name: d.name,
  description: d.description,
  status: { state: d.state },
  creationDate: d.creationDate,
  lastUpdateDate: d.lastUpdateDate,
});

const CreateDataset: OperationHandler = (input, ctx) => {
  const clientToken = stringOrUndefined(input["clientToken"]);
  if (clientToken !== undefined) {
    const found = ctx.store
      .list<StoredDataset>()
      .filter((e) => e.key.startsWith(datasetPrefix))
      .map((e) => e.value)
      .find((d) => d.clientToken === clientToken);
    if (found !== undefined) {
      return {
        datasetId: found.id,
        datasetArn: found.arn,
        datasetStatus: { state: "CREATING" },
      };
    }
  }
  const name = requireString(input, "datasetName");
  const id = crypto.randomUUID();
  const arn = makeArn(ctx, "dataset", id);
  const now = nowSeconds();
  const dataset: StoredDataset = {
    id,
    arn,
    name,
    description: stringOrUndefined(input["datasetDescription"]) ?? "",
    state: "ACTIVE",
    creationDate: now,
    lastUpdateDate: now,
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(datasetKey(id), dataset);
  if (input["tags"] !== undefined) {
    ctx.store.set(tagsKey(arn), input["tags"] as Record<string, string>);
  }
  return {
    datasetId: id,
    datasetArn: arn,
    datasetStatus: { state: "CREATING" },
  };
};

const DescribeDataset: OperationHandler = (input, ctx) => {
  const id = requireString(input, "datasetId");
  const d = requireDataset(ctx, id);
  return {
    datasetId: d.id,
    datasetArn: d.arn,
    datasetName: d.name,
    datasetDescription: d.description,
    datasetSource: { sourceType: "KENDRA", sourceDetail: {} },
    datasetStatus: { state: d.state },
    datasetCreationDate: d.creationDate,
    datasetLastUpdateDate: d.lastUpdateDate,
  };
};

const UpdateDataset: OperationHandler = (input, ctx) => {
  const id = requireString(input, "datasetId");
  const existing = requireDataset(ctx, id);
  const updated: StoredDataset = {
    id: existing.id,
    arn: existing.arn,
    name: stringOrUndefined(input["datasetName"]) ?? existing.name,
    description:
      stringOrUndefined(input["datasetDescription"]) ?? existing.description,
    state: "ACTIVE",
    creationDate: existing.creationDate,
    lastUpdateDate: nowSeconds(),
  };
  ctx.store.set(datasetKey(id), updated);
  return {
    datasetId: id,
    datasetArn: existing.arn,
    datasetStatus: { state: "UPDATING" },
  };
};

const DeleteDataset: OperationHandler = (input, ctx) => {
  const id = requireString(input, "datasetId");
  const dataset = requireDataset(ctx, id);
  ctx.store.delete(datasetKey(id));
  ctx.store.delete(tagsKey(dataset.arn));
  return { datasetStatus: { state: "DELETING" } };
};

const ListDatasets: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 250;
  const datasets = ctx.store
    .list<StoredDataset>()
    .filter((e) => e.key.startsWith(datasetPrefix))
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { datasetSummaries: datasets.slice(0, max).map(datasetSummaryView) };
};

// --- Access Policies ---

const accessPolicySummaryView = (
  p: StoredAccessPolicy,
): Record<string, unknown> => ({
  id: p.id,
  identity: p.identity,
  resource: p.resource,
  permission: p.permission,
  creationDate: p.creationDate,
  lastUpdateDate: p.lastUpdateDate,
});

const CreateAccessPolicy: OperationHandler = (input, ctx) => {
  const identity = input["accessPolicyIdentity"] ?? {};
  const resource = input["accessPolicyResource"] ?? {};
  const permission =
    stringOrUndefined(input["accessPolicyPermission"]) ?? "VIEWER";
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const policy: StoredAccessPolicy = {
    id,
    identity,
    resource,
    permission,
    creationDate: now,
    lastUpdateDate: now,
  };
  ctx.store.set(accessPolicyKey(id), policy);
  return {
    accessPolicyId: id,
    accessPolicyArn: makeArn(ctx, "access-policy", id),
  };
};

const DescribeAccessPolicy: OperationHandler = (input, ctx) => {
  const id = requireString(input, "accessPolicyId");
  const p = requireAccessPolicy(ctx, id);
  return {
    accessPolicyId: p.id,
    accessPolicyArn: makeArn(ctx, "access-policy", p.id),
    accessPolicyIdentity: p.identity,
    accessPolicyResource: p.resource,
    accessPolicyPermission: p.permission,
    accessPolicyCreationDate: p.creationDate,
    accessPolicyLastUpdateDate: p.lastUpdateDate,
  };
};

const UpdateAccessPolicy: OperationHandler = (input, ctx) => {
  const id = requireString(input, "accessPolicyId");
  const existing = requireAccessPolicy(ctx, id);
  const updated: StoredAccessPolicy = {
    id: existing.id,
    identity: input["accessPolicyIdentity"] ?? existing.identity,
    resource: input["accessPolicyResource"] ?? existing.resource,
    permission:
      stringOrUndefined(input["accessPolicyPermission"]) ?? existing.permission,
    creationDate: existing.creationDate,
    lastUpdateDate: nowSeconds(),
  };
  ctx.store.set(accessPolicyKey(id), updated);
  return {};
};

const DeleteAccessPolicy: OperationHandler = (input, ctx) => {
  const id = requireString(input, "accessPolicyId");
  requireAccessPolicy(ctx, id);
  ctx.store.delete(accessPolicyKey(id));
  return {};
};

const ListAccessPolicies: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 250;
  const policies = ctx.store
    .list<StoredAccessPolicy>()
    .filter((e) => e.key.startsWith(accessPolicyPrefix))
    .map((e) => e.value);
  return {
    accessPolicySummaries: policies.slice(0, max).map(accessPolicySummaryView),
  };
};

// --- Computation Models ---

const computationModelSummaryView = (
  m: StoredComputationModel,
): Record<string, unknown> => ({
  computationModelId: m.id,
  computationModelArn: m.arn,
  computationModelName: m.name,
  computationModelDescription: m.description,
  computationModelStatus: { state: m.state },
  computationModelCreationDate: m.creationDate,
  computationModelLastUpdateDate: m.lastUpdateDate,
});

const CreateComputationModel: OperationHandler = (input, ctx) => {
  const clientToken = stringOrUndefined(input["clientToken"]);
  if (clientToken !== undefined) {
    const found = ctx.store
      .list<StoredComputationModel>()
      .filter((e) => e.key.startsWith(computationModelPrefix))
      .map((e) => e.value)
      .find((m) => m.clientToken === clientToken);
    if (found !== undefined) {
      return {
        computationModelId: found.id,
        computationModelArn: found.arn,
        computationModelStatus: { state: "CREATING" },
      };
    }
  }
  const name = requireString(input, "computationModelName");
  const id = crypto.randomUUID();
  const arn = makeArn(ctx, "computation-model", id);
  const now = nowSeconds();
  const cm: StoredComputationModel = {
    id,
    arn,
    name,
    description: stringOrUndefined(input["computationModelDescription"]) ?? "",
    state: "CREATING",
    creationDate: now,
    lastUpdateDate: now,
    ...(clientToken !== undefined ? { clientToken } : {}),
  };
  ctx.store.set(computationModelKey(id), cm);
  if (input["tags"] !== undefined) {
    ctx.store.set(tagsKey(arn), input["tags"] as Record<string, string>);
  }
  return {
    computationModelId: id,
    computationModelArn: arn,
    computationModelStatus: { state: "CREATING" },
  };
};

const DescribeComputationModel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "computationModelId");
  const cm = requireComputationModel(ctx, id);
  return {
    computationModelId: cm.id,
    computationModelArn: cm.arn,
    computationModelName: cm.name,
    computationModelDescription: cm.description,
    computationModelConfiguration: {},
    computationModelStatus: { state: cm.state },
    computationModelCreationDate: cm.creationDate,
    computationModelLastUpdateDate: cm.lastUpdateDate,
  };
};

const UpdateComputationModel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "computationModelId");
  const existing = requireComputationModel(ctx, id);
  const updated: StoredComputationModel = {
    id: existing.id,
    arn: existing.arn,
    name: stringOrUndefined(input["computationModelName"]) ?? existing.name,
    description:
      stringOrUndefined(input["computationModelDescription"]) ??
      existing.description,
    state: "UPDATING",
    creationDate: existing.creationDate,
    lastUpdateDate: nowSeconds(),
  };
  ctx.store.set(computationModelKey(id), updated);
  return {
    computationModelId: id,
    computationModelArn: existing.arn,
    computationModelStatus: { state: "UPDATING" },
  };
};

const DeleteComputationModel: OperationHandler = (input, ctx) => {
  const id = requireString(input, "computationModelId");
  requireComputationModel(ctx, id);
  ctx.store.delete(computationModelKey(id));
  return { computationModelStatus: { state: "DELETING" } };
};

const ListComputationModels: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 250;
  const models = ctx.store
    .list<StoredComputationModel>()
    .filter((e) => e.key.startsWith(computationModelPrefix))
    .map((e) => e.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    computationModelSummaries: models
      .slice(0, max)
      .map(computationModelSummaryView),
  };
};

const DescribeComputationModelExecutionSummary: OperationHandler = (
  input,
  ctx,
) => {
  const id = requireString(input, "computationModelId");
  requireComputationModel(ctx, id);
  return { computationModelExecutionSummaries: [] };
};

const ListComputationModelResolveToResources: OperationHandler = (
  input,
  ctx,
) => {
  const id = requireString(input, "computationModelId");
  requireComputationModel(ctx, id);
  return { resolveToResources: [] };
};

const ListComputationModelDataBindingUsages: OperationHandler = (
  _input,
  _ctx,
) => ({ computationModelDataBindingUsageSummaries: [] });

// --- Bulk Import Jobs ---

const CreateBulkImportJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "jobName");
  const id = crypto.randomUUID();
  const job: StoredBulkImportJob = {
    id,
    name,
    state: "PENDING",
  };
  ctx.store.set(bulkImportJobKey(id), job);
  return { jobId: id, jobName: name, jobStatus: "PENDING" };
};

const DescribeBulkImportJob: OperationHandler = (input, ctx) => {
  const id = requireString(input, "jobId");
  const job = requireBulkImportJob(ctx, id);
  return {
    jobId: job.id,
    jobName: job.name,
    jobStatus: job.state,
    jobRoleArn: `arn:aws:iam::${ctx.account}:role/iotsitewise-bulk-import-role`,
    files: [],
    errorReportLocation: { bucket: "bucket", prefix: "prefix" },
    jobConfiguration: { fileFormat: { csv: {} } },
  };
};

const ListBulkImportJobs: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 250;
  const jobs = ctx.store
    .list<StoredBulkImportJob>()
    .filter((e) => e.key.startsWith(bulkImportJobPrefix))
    .map((e) => e.value);
  return {
    jobSummaries: jobs.slice(0, max).map((j) => ({
      id: j.id,
      name: j.name,
      status: j.state,
    })),
  };
};

// --- Configuration Singletons ---

const DescribeDefaultEncryptionConfiguration: OperationHandler = (
  _input,
  ctx,
) => {
  const stored = ctx.store.get<Record<string, unknown>>(
    encryptionConfigKey,
  ) ?? { encryptionType: "SITEWISE_DEFAULT_ENCRYPTION" };
  return {
    encryptionType: stored["encryptionType"] ?? "SITEWISE_DEFAULT_ENCRYPTION",
    configurationStatus: { state: "ACTIVE" },
  };
};

const PutDefaultEncryptionConfiguration: OperationHandler = (input, ctx) => {
  const config = {
    encryptionType:
      stringOrUndefined(input["encryptionType"]) ??
      "SITEWISE_DEFAULT_ENCRYPTION",
    kmsKeyId: stringOrUndefined(input["kmsKeyId"]),
  };
  ctx.store.set(encryptionConfigKey, config);
  return {
    encryptionType: config.encryptionType,
    configurationStatus: { state: "ACTIVE" },
  };
};

const DescribeStorageConfiguration: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<Record<string, unknown>>(storageConfigKey) ?? {
    storageType: "SITEWISE_DEFAULT_STORAGE",
  };
  return {
    storageType: stored["storageType"] ?? "SITEWISE_DEFAULT_STORAGE",
    configurationStatus: { state: "ACTIVE" },
  };
};

const PutStorageConfiguration: OperationHandler = (input, ctx) => {
  const storageType = requireString(input, "storageType");
  const config = { storageType };
  ctx.store.set(storageConfigKey, config);
  return {
    storageType,
    configurationStatus: { state: "ACTIVE" },
  };
};

const DescribeLoggingOptions: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<Record<string, unknown>>(loggingOptionsKey) ?? {
    loggingLevel: "OFF",
  };
  return { loggingOptions: { loggingLevel: stored["loggingLevel"] ?? "OFF" } };
};

const PutLoggingOptions: OperationHandler = (input, ctx) => {
  const opts = (input["loggingOptions"] as Record<string, unknown>) ?? {};
  ctx.store.set(loggingOptionsKey, {
    loggingLevel: opts["loggingLevel"] ?? "OFF",
  });
  return {};
};

// --- Tags ---

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  return { tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const newTags = (input["tags"] ?? {}) as Record<string, string>;
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  ctx.store.set(tagsKey(resourceArn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = arrayOrEmpty(input["tagKeys"]) as string[];
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  const updated: Record<string, string> = {};
  for (const [k, v] of Object.entries(existing)) {
    if (!tagKeys.includes(k)) updated[k] = v;
  }
  ctx.store.set(tagsKey(resourceArn), updated);
  return {};
};

// --- Property Values (synthetic) ---

const BatchPutAssetPropertyValue: OperationHandler = (input, ctx) => {
  const entries = arrayOrEmpty(input["entries"]) as Array<
    Record<string, unknown>
  >;
  const errorEntries: Array<Record<string, unknown>> = [];
  for (const entry of entries) {
    const entryId = stringOrUndefined(entry["entryId"]) ?? "";
    const assetId = stringOrUndefined(entry["assetId"]);
    const propertyId = stringOrUndefined(entry["propertyId"]);
    if (assetId !== undefined) {
      const assetExists = ctx.store.get<StoredAsset>(assetKey(assetId));
      if (assetExists === undefined) {
        errorEntries.push({
          entryId,
          errors: [
            {
              errorCode: "ResourceNotFoundException",
              errorMessage: `No asset exists for ID ${assetId}.`,
              timestamps: [],
            },
          ],
        });
        continue;
      }
    }
    if (assetId !== undefined && propertyId !== undefined) {
      const values = arrayOrEmpty(entry["propertyValues"]) as Array<
        Record<string, unknown>
      >;
      for (const v of values) {
        const ts =
          (v["timestamp"] as Record<string, unknown> | undefined) ?? {};
        const stored: StoredPropertyValue = {
          assetId,
          propertyId,
          value: v["value"],
          timestamp:
            (ts["timeInSeconds"] as number | undefined) ?? nowSeconds(),
          quality: stringOrUndefined(v["quality"]) ?? "GOOD",
        };
        ctx.store.set(propertyValueKey(assetId, propertyId), stored);
        const history =
          ctx.store.get<StoredPropertyValue[]>(
            propertyValueHistoryKey(assetId, propertyId),
          ) ?? [];
        ctx.store.set(propertyValueHistoryKey(assetId, propertyId), [
          ...history,
          stored,
        ]);
      }
    }
  }
  return { errorEntries };
};

const GetAssetPropertyValue: OperationHandler = (input, ctx) => {
  const assetId = stringOrUndefined(input["assetId"]);
  const propertyId = stringOrUndefined(input["propertyId"]);
  if (assetId !== undefined) {
    requireAsset(ctx, assetId);
  }
  if (assetId !== undefined && propertyId !== undefined) {
    const stored = ctx.store.get<StoredPropertyValue>(
      propertyValueKey(assetId, propertyId),
    );
    if (stored !== undefined) {
      return {
        propertyValue: {
          value: stored.value,
          timestamp: { timeInSeconds: stored.timestamp },
          quality: stored.quality,
        },
      };
    }
  }
  return {};
};

const GetAssetPropertyValueHistory: OperationHandler = (input, ctx) => {
  const assetId = stringOrUndefined(input["assetId"]);
  const propertyId = stringOrUndefined(input["propertyId"]);
  const startDate = numberOrUndefined(input["startDate"]);
  const endDate = numberOrUndefined(input["endDate"]);
  const timeOrdering = stringOrUndefined(input["timeOrdering"]) ?? "ASCENDING";
  if (assetId !== undefined && propertyId !== undefined) {
    let history =
      ctx.store.get<StoredPropertyValue[]>(
        propertyValueHistoryKey(assetId, propertyId),
      ) ?? [];
    if (startDate !== undefined)
      history = history.filter((v) => v.timestamp > startDate);
    if (endDate !== undefined)
      history = history.filter((v) => v.timestamp <= endDate);
    if (timeOrdering === "DESCENDING") history = [...history].reverse();
    const { items, nextToken } = paginateList(
      history,
      input["nextToken"],
      input["maxResults"],
      20000,
    );
    return {
      assetPropertyValueHistory: items.map((v) => ({
        value: v.value,
        timestamp: { timeInSeconds: v.timestamp },
        quality: v.quality,
      })),
      ...(nextToken !== undefined ? { nextToken } : {}),
    };
  }
  return { assetPropertyValueHistory: [] };
};

const GetAssetPropertyAggregates: OperationHandler = (_input, _ctx) => ({
  aggregatedValues: [],
});

const GetInterpolatedAssetPropertyValues: OperationHandler = (
  _input,
  _ctx,
) => ({ interpolatedAssetPropertyValues: [] });

const BatchGetAssetPropertyValue: OperationHandler = (_input, _ctx) => ({
  errorEntries: [],
  successEntries: [],
  skippedEntries: [],
});

const BatchGetAssetPropertyValueHistory: OperationHandler = (_input, _ctx) => ({
  errorEntries: [],
  successEntries: [],
  skippedEntries: [],
});

const BatchGetAssetPropertyAggregates: OperationHandler = (_input, _ctx) => ({
  errorEntries: [],
  successEntries: [],
  skippedEntries: [],
});

// --- Time Series ---

const AssociateTimeSeriesToAssetProperty: OperationHandler = (input, ctx) => {
  const alias = requireString(input, "alias");
  const assetId = stringOrUndefined(input["assetId"]);
  const propertyId = stringOrUndefined(input["propertyId"]);
  const id = crypto.randomUUID();
  const arn = makeArn(ctx, "timeseries", alias);
  const now = nowSeconds();
  const ts: StoredTimeSeries = {
    alias,
    assetId,
    propertyId,
    timeSeriesId: id,
    timeSeriesArn: arn,
    dataType: stringOrUndefined(input["dataType"]) ?? "DOUBLE",
    timeSeriesCreationDate: now,
    timeSeriesLastUpdateDate: now,
  };
  ctx.store.set(timeseriesKey(alias), ts);
  return {};
};

const DisassociateTimeSeriesFromAssetProperty: OperationHandler = (
  input,
  ctx,
) => {
  const alias = requireString(input, "alias");
  ctx.store.delete(timeseriesKey(alias));
  return {};
};

const DeleteTimeSeries: OperationHandler = (input, ctx) => {
  const alias = stringOrUndefined(input["alias"]);
  if (alias !== undefined) {
    ctx.store.delete(timeseriesKey(alias));
  }
  return {};
};

const DescribeTimeSeries: OperationHandler = (input, ctx) => {
  const alias = stringOrUndefined(input["alias"]);
  const assetId = stringOrUndefined(input["assetId"]);
  const propertyId = stringOrUndefined(input["propertyId"]);
  if (alias !== undefined) {
    const stored = ctx.store.get<StoredTimeSeries>(timeseriesKey(alias));
    if (stored === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `No time series exists for alias ${alias}.`,
        404,
      );
    }
    return {
      alias: stored.alias,
      assetId: stored.assetId,
      propertyId: stored.propertyId,
      timeSeriesId: stored.timeSeriesId,
      timeSeriesArn: stored.timeSeriesArn,
      dataType: stored.dataType,
      timeSeriesCreationDate: stored.timeSeriesCreationDate,
      timeSeriesLastUpdateDate: stored.timeSeriesLastUpdateDate,
    };
  }
  if (assetId !== undefined && propertyId !== undefined) {
    const match = ctx.store
      .list<StoredTimeSeries>()
      .find(
        (e) =>
          e.key.startsWith(timeseriesPrefix) &&
          e.value.assetId === assetId &&
          e.value.propertyId === propertyId,
      )?.value;
    if (match !== undefined) {
      return {
        alias: match.alias,
        assetId: match.assetId,
        propertyId: match.propertyId,
        timeSeriesId: match.timeSeriesId,
        timeSeriesArn: match.timeSeriesArn,
        dataType: match.dataType,
        timeSeriesCreationDate: match.timeSeriesCreationDate,
        timeSeriesLastUpdateDate: match.timeSeriesLastUpdateDate,
      };
    }
  }
  throw awsError("ResourceNotFoundException", `No time series found.`, 404);
};

const ListTimeSeries: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 250;
  const items = ctx.store
    .list<StoredTimeSeries>()
    .filter((e) => e.key.startsWith(timeseriesPrefix))
    .map((e) => e.value)
    .slice(0, max)
    .map((ts) => ({
      alias: ts.alias,
      assetId: ts.assetId,
      propertyId: ts.propertyId,
      timeSeriesId: ts.timeSeriesId,
      dataType: ts.dataType,
      timeSeriesCreationDate: ts.timeSeriesCreationDate,
      timeSeriesLastUpdateDate: ts.timeSeriesLastUpdateDate,
    }));
  return { TimeSeriesSummaries: items };
};

// --- Actions / Executions (synthetic) ---

const ExecuteAction: OperationHandler = (input, ctx) => {
  const actionDefinitionId = requireString(input, "actionDefinitionId");
  const actionId = crypto.randomUUID();
  const executionId = crypto.randomUUID();
  const now = nowSeconds();
  ctx.store.set(actionKey(actionId), {
    actionId,
    actionDefinitionId,
    executionId,
    targetResource: input["targetResource"] ?? {},
    actionPayload: input["actionPayload"] ?? {},
    executionDate: now,
  });
  ctx.store.set(executionKey(executionId), {
    executionId,
    actionId,
    status: "RUNNING",
    executionDate: now,
  });
  return { actionId, executionId };
};

const DescribeAction: OperationHandler = (input, ctx) => {
  const actionId = requireString(input, "actionId");
  const stored = ctx.store.get<Record<string, unknown>>(actionKey(actionId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No action exists for ID ${actionId}.`,
      404,
    );
  }
  return {
    actionId: stored["actionId"],
    actionDefinitionId: stored["actionDefinitionId"],
    targetResource: stored["targetResource"],
    actionPayload: stored["actionPayload"],
    executionDate: stored["executionDate"],
  };
};

const ListActions: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 250;
  const actions = ctx.store
    .list<Record<string, unknown>>()
    .filter((e) => e.key.startsWith(actionPrefix))
    .map((e) => ({
      actionId: e.value["actionId"],
      actionDefinitionId: e.value["actionDefinitionId"],
      targetResource: e.value["targetResource"],
      executionDate: e.value["executionDate"],
    }));
  return { actionSummaries: actions.slice(0, max) };
};

const DescribeExecution: OperationHandler = (input, ctx) => {
  const executionId = requireString(input, "executionId");
  const stored = ctx.store.get<Record<string, unknown>>(
    executionKey(executionId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No execution exists for ID ${executionId}.`,
      404,
    );
  }
  return {
    executionId: stored["executionId"],
    actionId: stored["actionId"],
    executionStatus: { state: stored["status"] },
    executionDate: stored["executionDate"],
  };
};

const ListExecutions: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 250;
  const executions = ctx.store
    .list<Record<string, unknown>>()
    .filter((e) => e.key.startsWith(executionPrefix))
    .map((e) => ({
      executionId: e.value["executionId"],
      actionId: e.value["actionId"],
      executionStatus: { state: e.value["status"] },
      executionDate: e.value["executionDate"],
    }));
  return { executionSummaries: executions.slice(0, max) };
};

const ExecuteQuery: OperationHandler = (_input, _ctx) => ({
  columns: [],
  rows: [],
});

const InvokeAssistant: OperationHandler = (_input, _ctx) => ({
  message: "",
  trace: "",
});

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const iotsitewise = {
  name: "iotsitewise",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts.length === 0) return undefined;

    const p0 = parts[0];

    if (p0 === "logging" && parts.length === 1) {
      if (req.method === "GET") return "DescribeLoggingOptions";
      if (req.method === "PUT") return "PutLoggingOptions";
      return undefined;
    }

    if (p0 === "tags" && parts.length === 1) {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }

    if (p0 === "configuration" && parts[1] === "account") {
      if (parts[2] === "encryption") {
        if (req.method === "GET")
          return "DescribeDefaultEncryptionConfiguration";
        if (req.method === "POST") return "PutDefaultEncryptionConfiguration";
      }
      if (parts[2] === "storage") {
        if (req.method === "GET") return "DescribeStorageConfiguration";
        if (req.method === "POST") return "PutStorageConfiguration";
      }
      return undefined;
    }

    if (p0 === "queries" && parts[1] === "execution") {
      if (req.method === "POST") return "ExecuteQuery";
      return undefined;
    }

    if (p0 === "assistant" && parts[1] === "invocation") {
      if (req.method === "POST") return "InvokeAssistant";
      return undefined;
    }

    if (p0 === "properties") {
      if (parts.length === 1) {
        if (req.method === "POST") return "BatchPutAssetPropertyValue";
        return undefined;
      }
      const p1 = parts[1];
      if (p1 === "latest" && parts.length === 2) {
        if (req.method === "GET") return "GetAssetPropertyValue";
        return undefined;
      }
      if (p1 === "history" && parts.length === 2) {
        if (req.method === "GET") return "GetAssetPropertyValueHistory";
        return undefined;
      }
      if (p1 === "aggregates" && parts.length === 2) {
        if (req.method === "GET") return "GetAssetPropertyAggregates";
        return undefined;
      }
      if (p1 === "interpolated" && parts.length === 2) {
        if (req.method === "GET") return "GetInterpolatedAssetPropertyValues";
        return undefined;
      }
      if (p1 === "batch" && parts.length === 3) {
        if (parts[2] === "latest" && req.method === "POST")
          return "BatchGetAssetPropertyValue";
        if (parts[2] === "history" && req.method === "POST")
          return "BatchGetAssetPropertyValueHistory";
        if (parts[2] === "aggregates" && req.method === "POST")
          return "BatchGetAssetPropertyAggregates";
      }
      return undefined;
    }

    if (p0 === "timeseries") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListTimeSeries";
        return undefined;
      }
      const p1 = parts[1];
      if (p1 === "describe") {
        if (req.method === "GET") return "DescribeTimeSeries";
        return undefined;
      }
      if (p1 === "associate") {
        if (req.method === "POST") return "AssociateTimeSeriesToAssetProperty";
        return undefined;
      }
      if (p1 === "disassociate") {
        if (req.method === "POST")
          return "DisassociateTimeSeriesFromAssetProperty";
        return undefined;
      }
      if (p1 === "delete") {
        if (req.method === "POST") return "DeleteTimeSeries";
        return undefined;
      }
      return undefined;
    }

    if (p0 === "actions") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListActions";
        if (req.method === "POST") return "ExecuteAction";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeAction";
        return undefined;
      }
      return undefined;
    }

    if (p0 === "executions") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListExecutions";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeExecution";
        return undefined;
      }
      return undefined;
    }

    if (
      p0 === "interface" &&
      parts[2] === "asset-models" &&
      parts.length === 3
    ) {
      if (req.method === "GET") return "ListInterfaceRelationships";
      return undefined;
    }

    if (p0 === "access-policies") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListAccessPolicies";
        if (req.method === "POST") return "CreateAccessPolicy";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeAccessPolicy";
        if (req.method === "PUT") return "UpdateAccessPolicy";
        if (req.method === "DELETE") return "DeleteAccessPolicy";
        return undefined;
      }
      return undefined;
    }

    if (p0 === "portals") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListPortals";
        if (req.method === "POST") return "CreatePortal";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribePortal";
        if (req.method === "PUT") return "UpdatePortal";
        if (req.method === "DELETE") return "DeletePortal";
        return undefined;
      }
      return undefined;
    }

    if (p0 === "projects") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListProjects";
        if (req.method === "POST") return "CreateProject";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeProject";
        if (req.method === "PUT") return "UpdateProject";
        if (req.method === "DELETE") return "DeleteProject";
        return undefined;
      }
      if (parts[2] === "assets") {
        if (parts.length === 3) {
          if (req.method === "GET") return "ListProjectAssets";
          return undefined;
        }
        if (parts.length === 4) {
          if (parts[3] === "associate" && req.method === "POST")
            return "BatchAssociateProjectAssets";
          if (parts[3] === "disassociate" && req.method === "POST")
            return "BatchDisassociateProjectAssets";
        }
      }
      return undefined;
    }

    if (p0 === "dashboards") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListDashboards";
        if (req.method === "POST") return "CreateDashboard";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeDashboard";
        if (req.method === "PUT") return "UpdateDashboard";
        if (req.method === "DELETE") return "DeleteDashboard";
        return undefined;
      }
      return undefined;
    }

    if (p0 === "datasets") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListDatasets";
        if (req.method === "POST") return "CreateDataset";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeDataset";
        if (req.method === "PUT") return "UpdateDataset";
        if (req.method === "DELETE") return "DeleteDataset";
        return undefined;
      }
      return undefined;
    }

    if (p0 === "jobs") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListBulkImportJobs";
        if (req.method === "POST") return "CreateBulkImportJob";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeBulkImportJob";
        return undefined;
      }
      return undefined;
    }

    if (p0 === "computation-models") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListComputationModels";
        if (req.method === "POST") return "CreateComputationModel";
        return undefined;
      }
      if (parts.length === 2) {
        if (parts[1] === "data-binding-usages" && req.method === "POST")
          return "ListComputationModelDataBindingUsages";
        if (req.method === "GET") return "DescribeComputationModel";
        if (req.method === "POST") return "UpdateComputationModel";
        if (req.method === "DELETE") return "DeleteComputationModel";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "execution-summary" && req.method === "GET")
          return "DescribeComputationModelExecutionSummary";
        if (parts[2] === "resolve-to-resources" && req.method === "GET")
          return "ListComputationModelResolveToResources";
        return undefined;
      }
      return undefined;
    }

    if (p0 === "20200301" && parts[1] === "gateways") {
      if (parts.length === 2) {
        if (req.method === "GET") return "ListGateways";
        if (req.method === "POST") return "CreateGateway";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "DescribeGateway";
        if (req.method === "PUT") return "UpdateGateway";
        if (req.method === "DELETE") return "DeleteGateway";
        return undefined;
      }
      if (parts.length === 4 && parts[3] === "capability") {
        if (req.method === "POST")
          return "UpdateGatewayCapabilityConfiguration";
        return undefined;
      }
      if (parts.length === 5 && parts[3] === "capability") {
        if (req.method === "GET")
          return "DescribeGatewayCapabilityConfiguration";
        return undefined;
      }
      return undefined;
    }

    if (p0 === "asset-models") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateAssetModel";
        if (req.method === "GET") return "ListAssetModels";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeAssetModel";
        if (req.method === "PUT") return "UpdateAssetModel";
        if (req.method === "DELETE") return "DeleteAssetModel";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "composite-models") {
          if (req.method === "GET") return "ListAssetModelCompositeModels";
          if (req.method === "POST") return "CreateAssetModelCompositeModel";
        }
        if (parts[2] === "properties") {
          if (req.method === "GET") return "ListAssetModelProperties";
        }
        if (parts[2] === "composition-relationships") {
          if (req.method === "GET") return "ListCompositionRelationships";
        }
        return undefined;
      }
      if (parts.length === 4) {
        if (parts[2] === "composite-models") {
          if (req.method === "GET") return "DescribeAssetModelCompositeModel";
          if (req.method === "PUT") return "UpdateAssetModelCompositeModel";
          if (req.method === "DELETE") return "DeleteAssetModelCompositeModel";
        }
        return undefined;
      }
      if (
        parts.length === 5 &&
        parts[2] === "interface" &&
        parts[4] === "asset-model-interface-relationship"
      ) {
        if (req.method === "GET")
          return "DescribeAssetModelInterfaceRelationship";
        if (req.method === "PUT") return "PutAssetModelInterfaceRelationship";
        if (req.method === "DELETE")
          return "DeleteAssetModelInterfaceRelationship";
        return undefined;
      }
      return undefined;
    }

    if (p0 === "assets") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListAssets";
        if (req.method === "POST") return "CreateAsset";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeAsset";
        if (req.method === "PUT") return "UpdateAsset";
        if (req.method === "DELETE") return "DeleteAsset";
        return undefined;
      }
      if (parts.length === 3) {
        const p2 = parts[2];
        if (p2 === "associate" && req.method === "POST")
          return "AssociateAssets";
        if (p2 === "disassociate" && req.method === "POST")
          return "DisassociateAssets";
        if (p2 === "hierarchies" && req.method === "GET")
          return "ListAssociatedAssets";
        if (p2 === "assetRelationships" && req.method === "GET")
          return "ListAssetRelationships";
        if (p2 === "properties" && req.method === "GET")
          return "ListAssetProperties";
        return undefined;
      }
      if (parts.length === 4) {
        if (parts[2] === "composite-models" && req.method === "GET")
          return "DescribeAssetCompositeModel";
        if (parts[2] === "properties") {
          if (req.method === "GET") return "DescribeAssetProperty";
          if (req.method === "PUT") return "UpdateAssetProperty";
        }
        return undefined;
      }
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateAssetModel,
    DescribeAssetModel,
    ListAssetModels,
    DeleteAssetModel,
    UpdateAssetModel,
    CreateAssetModelCompositeModel,
    DescribeAssetModelCompositeModel,
    UpdateAssetModelCompositeModel,
    DeleteAssetModelCompositeModel,
    ListAssetModelCompositeModels,
    ListAssetModelProperties,
    ListCompositionRelationships,
    DescribeAssetModelInterfaceRelationship,
    PutAssetModelInterfaceRelationship,
    DeleteAssetModelInterfaceRelationship,
    ListInterfaceRelationships,
    CreateAsset,
    DescribeAsset,
    UpdateAsset,
    DeleteAsset,
    ListAssets,
    AssociateAssets,
    DisassociateAssets,
    ListAssociatedAssets,
    ListAssetRelationships,
    DescribeAssetCompositeModel,
    ListAssetProperties,
    DescribeAssetProperty,
    UpdateAssetProperty,
    CreateGateway,
    DescribeGateway,
    UpdateGateway,
    DeleteGateway,
    ListGateways,
    DescribeGatewayCapabilityConfiguration,
    UpdateGatewayCapabilityConfiguration,
    CreatePortal,
    DescribePortal,
    UpdatePortal,
    DeletePortal,
    ListPortals,
    CreateProject,
    DescribeProject,
    UpdateProject,
    DeleteProject,
    ListProjects,
    BatchAssociateProjectAssets,
    BatchDisassociateProjectAssets,
    ListProjectAssets,
    CreateDashboard,
    DescribeDashboard,
    UpdateDashboard,
    DeleteDashboard,
    ListDashboards,
    CreateDataset,
    DescribeDataset,
    UpdateDataset,
    DeleteDataset,
    ListDatasets,
    CreateAccessPolicy,
    DescribeAccessPolicy,
    UpdateAccessPolicy,
    DeleteAccessPolicy,
    ListAccessPolicies,
    CreateComputationModel,
    DescribeComputationModel,
    UpdateComputationModel,
    DeleteComputationModel,
    ListComputationModels,
    DescribeComputationModelExecutionSummary,
    ListComputationModelResolveToResources,
    ListComputationModelDataBindingUsages,
    CreateBulkImportJob,
    DescribeBulkImportJob,
    ListBulkImportJobs,
    DescribeDefaultEncryptionConfiguration,
    PutDefaultEncryptionConfiguration,
    DescribeStorageConfiguration,
    PutStorageConfiguration,
    DescribeLoggingOptions,
    PutLoggingOptions,
    ListTagsForResource,
    TagResource,
    UntagResource,
    BatchPutAssetPropertyValue,
    GetAssetPropertyValue,
    GetAssetPropertyValueHistory,
    GetAssetPropertyAggregates,
    GetInterpolatedAssetPropertyValues,
    BatchGetAssetPropertyValue,
    BatchGetAssetPropertyValueHistory,
    BatchGetAssetPropertyAggregates,
    AssociateTimeSeriesToAssetProperty,
    DisassociateTimeSeriesFromAssetProperty,
    DeleteTimeSeries,
    DescribeTimeSeries,
    ListTimeSeries,
    ExecuteAction,
    DescribeAction,
    ListActions,
    DescribeExecution,
    ListExecutions,
    ExecuteQuery,
    InvokeAssistant,
  },
  model,
} as const satisfies ServiceDefinition;

export default iotsitewise;
