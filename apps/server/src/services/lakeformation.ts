import { callerArn } from "../core/arn.ts";
import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import lakeformationModel from "../../../../test/vendor/aws-models/lakeformation.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(lakeformationModel);

const resourcePrefix = "resource:" as const;
const lftagPrefix = "lftag:" as const;
const lftagExprPrefix = "lftagexpr:" as const;
const dcfPrefix = "dcf:" as const;
const permPrefix = "perm:" as const;
const txPrefix = "tx:" as const;
const dlsPrefix = "dls:" as const;
const iccPrefix = "icc:" as const;
const optinPrefix = "optin:" as const;
const queryPrefix = "query:" as const;
const resTagPrefix = "restag:" as const;
const tobjPrefix = "tobj:" as const;

type StoredResource = {
  resourceArn: string;
  roleArn?: string;
  withFederation?: boolean;
  hybridAccessEnabled?: boolean;
  withPrivilegedAccess?: boolean;
  expectedResourceOwnerAccount?: string;
  lastModified: number;
};

type StoredLFTag = {
  catalogId: string;
  tagKey: string;
  tagValues: string[];
};

type StoredLFTagExpression = {
  name: string;
  description?: string;
  catalogId: string;
  expression: unknown[];
};

type StoredDataCellsFilter = {
  tableCatalogId: string;
  databaseName: string;
  tableName: string;
  name: string;
  rowFilter?: unknown;
  columnNames?: string[];
  columnWildcard?: unknown;
  versionId?: string;
};

type StoredPermission = {
  catalogId?: string;
  principal: unknown;
  resource: unknown;
  condition?: unknown;
  permissions: string[];
  permissionsWithGrantOption: string[];
  lastUpdated: number;
};

type StoredTransaction = {
  transactionId: string;
  transactionStatus: string;
  transactionType: string;
  transactionStartTime: number;
  transactionEndTime?: number;
};

type StoredDataLakeSettings = {
  catalogId: string;
  settings: unknown;
};

type StoredIdentityCenterConfig = {
  catalogId: string;
  instanceArn?: string;
  applicationArn: string;
  externalFiltering?: unknown;
  shareRecipients?: unknown[];
  serviceIntegrations?: unknown[];
  resourceShare?: string;
};

type StoredOptIn = {
  principal: unknown;
  resource: unknown;
  condition?: unknown;
  lastModified: number;
};

type LFTagAssignment = {
  tagKey: string;
  tagValues: string[];
  catalogId: string;
};

type StoredResourceLFTagAssignment = {
  resource: unknown;
  catalogId: string;
  lfTags: LFTagAssignment[];
};

type StoredTableObject = {
  uri: string;
  eTag: string;
  size?: number;
  partitionValues: string[];
};

type StoredGoverningTable = {
  objects: StoredTableObject[];
};

type StoredQuery = {
  queryId: string;
  state: string;
  queryString: string;
  workUnits: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const boolOrUndefined = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidInputException", `${field} is required.`, 400);
  }
  return value;
};

const resourceKey = (arn: string): string => `${resourcePrefix}${arn}`;

const lftagKey = (catalogId: string, tagKey: string): string =>
  `${lftagPrefix}${catalogId}:${tagKey}`;

const lftagExprKey = (catalogId: string, name: string): string =>
  `${lftagExprPrefix}${catalogId}:${name}`;

const dcfKey = (
  tableCatalogId: string,
  databaseName: string,
  tableName: string,
  name: string,
): string =>
  `${dcfPrefix}${tableCatalogId}:${databaseName}:${tableName}:${name}`;

const dlsKey = (catalogId: string): string => `${dlsPrefix}${catalogId}`;

const iccKey = (catalogId: string): string => `${iccPrefix}${catalogId}`;

const resourceInfo = (resource: StoredResource): Record<string, unknown> => ({
  ResourceArn: resource.resourceArn,
  RoleArn: resource.roleArn,
  LastModified: resource.lastModified,
  WithFederation: resource.withFederation,
  HybridAccessEnabled: resource.hybridAccessEnabled,
  WithPrivilegedAccess: resource.withPrivilegedAccess,
  ExpectedResourceOwnerAccount: resource.expectedResourceOwnerAccount,
});

const lftagInfo = (tag: StoredLFTag): Record<string, unknown> => ({
  CatalogId: tag.catalogId,
  TagKey: tag.tagKey,
  TagValues: tag.tagValues,
});

const lftagExprInfo = (
  expr: StoredLFTagExpression,
): Record<string, unknown> => ({
  Name: expr.name,
  Description: expr.description,
  CatalogId: expr.catalogId,
  Expression: expr.expression,
});

const dcfInfo = (f: StoredDataCellsFilter): Record<string, unknown> => ({
  TableCatalogId: f.tableCatalogId,
  DatabaseName: f.databaseName,
  TableName: f.tableName,
  Name: f.name,
  RowFilter: f.rowFilter,
  ColumnNames: f.columnNames,
  ColumnWildcard: f.columnWildcard,
  VersionId: f.versionId,
});

const txInfo = (tx: StoredTransaction): Record<string, unknown> => ({
  TransactionId: tx.transactionId,
  TransactionStatus: tx.transactionStatus,
  TransactionStartTime: tx.transactionStartTime,
  TransactionEndTime: tx.transactionEndTime,
});

const permInfo = (p: StoredPermission): Record<string, unknown> => ({
  Principal: p.principal,
  Resource: p.resource,
  Condition: p.condition,
  Permissions: p.permissions,
  PermissionsWithGrantOption: p.permissionsWithGrantOption,
  LastUpdated: p.lastUpdated,
});

const syntheticCredentials = () => ({
  AccessKeyId: "MOCK-ACCESS-KEY-ID",
  SecretAccessKey: "MOCK-SECRET-ACCESS-KEY",
  SessionToken: "MOCK-SESSION-TOKEN",
  Expiration: Math.floor(Date.now() / 1000) + 3600,
});

const generateId = (): string =>
  Math.random().toString(36).slice(2, 18).padEnd(16, "0");

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

const resTagKey = (resource: unknown, catalogId: string): string => {
  const r = asRecord(resource);
  if (r.Database !== undefined) {
    const db = asRecord(r.Database);
    const cid = stringOrUndefined(db.CatalogId) ?? catalogId;
    return `${resTagPrefix}db:${cid}:${String(db.Name ?? "")}`;
  }
  if (r.Table !== undefined) {
    const t = asRecord(r.Table);
    const cid = stringOrUndefined(t.CatalogId) ?? catalogId;
    return `${resTagPrefix}table:${cid}:${String(t.DatabaseName ?? "")}:${String(t.Name ?? "")}`;
  }
  if (r.TableWithColumns !== undefined) {
    const t = asRecord(r.TableWithColumns);
    const cid = stringOrUndefined(t.CatalogId) ?? catalogId;
    return `${resTagPrefix}twc:${cid}:${String(t.DatabaseName ?? "")}:${String(t.Name ?? "")}`;
  }
  if (r.DataLocation !== undefined) {
    const dl = asRecord(r.DataLocation);
    const cid = stringOrUndefined(dl.CatalogId) ?? catalogId;
    return `${resTagPrefix}dataloc:${cid}:${String(dl.ResourceArn ?? "")}`;
  }
  return `${resTagPrefix}catalog:${catalogId}`;
};

const matchesExpression = (
  lfTags: LFTagAssignment[],
  expression: unknown[],
): boolean => {
  for (const cond of expression) {
    const c = asRecord(cond);
    const tagKey = String(c.TagKey ?? "");
    const tagValues = asArray(c.TagValues).map(String);
    const tag = lfTags.find((t) => t.tagKey === tagKey);
    if (tag === undefined) return false;
    if (
      tagValues.length > 0 &&
      !tagValues.some((v) => tag.tagValues.includes(v))
    )
      return false;
  }
  return true;
};

const tobjKey = (
  catalogId: string,
  databaseName: string,
  tableName: string,
): string => `${tobjPrefix}${catalogId}:${databaseName}:${tableName}`;

const RegisterResource: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const resourceArn = requireString(input, "ResourceArn");
  if (ctx.store.get<StoredResource>(resourceKey(resourceArn)) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Resource ${resourceArn} is already registered.`,
      400,
    );
  }
  const resource: StoredResource = {
    resourceArn,
    roleArn: stringOrUndefined(input.RoleArn),
    withFederation: boolOrUndefined(input.WithFederation),
    hybridAccessEnabled: boolOrUndefined(input.HybridAccessEnabled),
    withPrivilegedAccess: boolOrUndefined(input.WithPrivilegedAccess),
    expectedResourceOwnerAccount: stringOrUndefined(
      input.ExpectedResourceOwnerAccount,
    ),
    lastModified: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(resourceKey(resourceArn), resource);
  return {};
};

const DescribeResource: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const resourceArn = requireString(input, "ResourceArn");
  const resource = ctx.store.get<StoredResource>(resourceKey(resourceArn));
  if (resource === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Resource ${resourceArn} not found.`,
      404,
    );
  }
  return { ResourceInfo: resourceInfo(resource) };
};

const ListResources: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const entries = ctx.store.list<StoredResource>();
  const all = entries
    .filter((e) => e.key.startsWith(resourcePrefix))
    .map((entry) => resourceInfo(entry.value));
  const { items, nextToken } = paginateList(
    all,
    input.NextToken,
    input.MaxResults,
  );
  return { ResourceInfoList: items, NextToken: nextToken };
};

const DeregisterResource: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const resourceArn = requireString(input, "ResourceArn");
  if (ctx.store.get<StoredResource>(resourceKey(resourceArn)) === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Resource ${resourceArn} not found.`,
      404,
    );
  }
  ctx.store.delete(resourceKey(resourceArn));
  return {};
};

const UpdateResource: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const resourceArn = requireString(input, "ResourceArn");
  const resource = ctx.store.get<StoredResource>(resourceKey(resourceArn));
  if (resource === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Resource ${resourceArn} not found.`,
      404,
    );
  }
  const updated: StoredResource = {
    ...resource,
    roleArn: stringOrUndefined(input.RoleArn) ?? resource.roleArn,
    withFederation:
      boolOrUndefined(input.WithFederation) ?? resource.withFederation,
    hybridAccessEnabled:
      boolOrUndefined(input.HybridAccessEnabled) ??
      resource.hybridAccessEnabled,
    withPrivilegedAccess:
      boolOrUndefined(input.WithPrivilegedAccess) ??
      resource.withPrivilegedAccess,
    expectedResourceOwnerAccount:
      stringOrUndefined(input.ExpectedResourceOwnerAccount) ??
      resource.expectedResourceOwnerAccount,
    lastModified: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(resourceKey(resourceArn), updated);
  return {};
};

const CreateLFTag: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const tagKey = requireString(input, "TagKey");
  if (ctx.store.get(lftagKey(catalogId, tagKey)) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `LF tag ${tagKey} already exists.`,
      400,
    );
  }
  const tag: StoredLFTag = {
    catalogId,
    tagKey,
    tagValues: asArray(input.TagValues).map(String),
  };
  ctx.store.set(lftagKey(catalogId, tagKey), tag);
  return {};
};

const GetLFTag: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const tagKey = requireString(input, "TagKey");
  const tag = ctx.store.get<StoredLFTag>(lftagKey(catalogId, tagKey));
  if (tag === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `LF tag ${tagKey} not found.`,
      404,
    );
  }
  return lftagInfo(tag);
};

const DeleteLFTag: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const tagKey = requireString(input, "TagKey");
  if (ctx.store.get(lftagKey(catalogId, tagKey)) === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `LF tag ${tagKey} not found.`,
      404,
    );
  }
  ctx.store.delete(lftagKey(catalogId, tagKey));
  return {};
};

const UpdateLFTag: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const tagKey = requireString(input, "TagKey");
  const tag = ctx.store.get<StoredLFTag>(lftagKey(catalogId, tagKey));
  if (tag === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `LF tag ${tagKey} not found.`,
      400,
    );
  }
  const toDelete = new Set(asArray(input.TagValuesToDelete).map(String));
  const toAdd = asArray(input.TagValuesToAdd).map(String);
  const updated: StoredLFTag = {
    ...tag,
    tagValues: [
      ...tag.tagValues.filter((v) => !toDelete.has(v)),
      ...toAdd.filter((v) => !tag.tagValues.includes(v)),
    ],
  };
  ctx.store.set(lftagKey(catalogId, tagKey), updated);
  return {};
};

const ListLFTags: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const entries = ctx.store.list<StoredLFTag>();
  const all = entries
    .filter((e) => e.key.startsWith(lftagPrefix))
    .map((e) => lftagInfo(e.value));
  const { items, nextToken } = paginateList(
    all,
    input.NextToken,
    input.MaxResults,
  );
  return { LFTags: items, NextToken: nextToken };
};

const CreateLFTagExpression: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const name = requireString(input, "Name");
  if (ctx.store.get(lftagExprKey(catalogId, name)) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `LF tag expression ${name} already exists.`,
      400,
    );
  }
  const expr: StoredLFTagExpression = {
    name,
    description: stringOrUndefined(input.Description),
    catalogId,
    expression: asArray(input.Expression),
  };
  ctx.store.set(lftagExprKey(catalogId, name), expr);
  return {};
};

const GetLFTagExpression: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const name = requireString(input, "Name");
  const expr = ctx.store.get<StoredLFTagExpression>(
    lftagExprKey(catalogId, name),
  );
  if (expr === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `LF tag expression ${name} not found.`,
      404,
    );
  }
  return lftagExprInfo(expr);
};

const DeleteLFTagExpression: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const name = requireString(input, "Name");
  if (ctx.store.get(lftagExprKey(catalogId, name)) === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `LF tag expression ${name} not found.`,
      400,
    );
  }
  ctx.store.delete(lftagExprKey(catalogId, name));
  return {};
};

const UpdateLFTagExpression: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const name = requireString(input, "Name");
  const expr = ctx.store.get<StoredLFTagExpression>(
    lftagExprKey(catalogId, name),
  );
  if (expr === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `LF tag expression ${name} not found.`,
      400,
    );
  }
  const updated: StoredLFTagExpression = {
    ...expr,
    description: stringOrUndefined(input.Description) ?? expr.description,
    expression:
      asArray(input.Expression).length > 0
        ? asArray(input.Expression)
        : expr.expression,
  };
  ctx.store.set(lftagExprKey(catalogId, name), updated);
  return {};
};

const ListLFTagExpressions: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const entries = ctx.store.list<StoredLFTagExpression>();
  const all = entries
    .filter((e) => e.key.startsWith(lftagExprPrefix))
    .map((e) => lftagExprInfo(e.value));
  const { items, nextToken } = paginateList(
    all,
    input.NextToken,
    input.MaxResults,
  );
  return { LFTagExpressions: items, NextToken: nextToken };
};

const AddLFTagsToResource: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const resource = input.Resource;
  const key = resTagKey(resource, catalogId);
  const existing = ctx.store.get<StoredResourceLFTagAssignment>(key) ?? {
    resource,
    catalogId,
    lfTags: [],
  };
  const newTags: LFTagAssignment[] = asArray(input.LFTags).map((tag) => {
    const t = asRecord(tag);
    return {
      tagKey: requireString(t, "TagKey"),
      tagValues: asArray(t.TagValues).map(String),
      catalogId: stringOrUndefined(t.CatalogId) ?? catalogId,
    };
  });
  const merged: LFTagAssignment[] = [
    ...existing.lfTags.filter(
      (t) => !newTags.some((n) => n.tagKey === t.tagKey),
    ),
    ...newTags,
  ];
  ctx.store.set(key, { resource, catalogId, lfTags: merged });
  return { Failures: [] };
};

const RemoveLFTagsFromResource: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const resource = input.Resource;
  const key = resTagKey(resource, catalogId);
  const existing = ctx.store.get<StoredResourceLFTagAssignment>(key);
  if (existing === undefined) {
    return { Failures: [] };
  }
  const toRemove = new Set(
    asArray(input.LFTags).map((tag) => requireString(asRecord(tag), "TagKey")),
  );
  const updated: StoredResourceLFTagAssignment = {
    ...existing,
    lfTags: existing.lfTags.filter((t) => !toRemove.has(t.tagKey)),
  };
  ctx.store.set(key, updated);
  return { Failures: [] };
};

const GetResourceLFTags: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const resource = asRecord(input.Resource);
  const key = resTagKey(input.Resource, catalogId);
  const assignment = ctx.store.get<StoredResourceLFTagAssignment>(key);
  const lfTags = assignment?.lfTags ?? [];
  const tagPairs = lfTags.map((t) => ({
    CatalogId: t.catalogId,
    TagKey: t.tagKey,
    TagValues: t.tagValues,
  }));
  if (resource.Database !== undefined) {
    return {
      LFTagOnDatabase: tagPairs,
      LFTagsOnTable: [],
      LFTagsOnColumns: [],
    };
  }
  if (resource.Table !== undefined || resource.TableWithColumns !== undefined) {
    return {
      LFTagOnDatabase: [],
      LFTagsOnTable: tagPairs,
      LFTagsOnColumns: [],
    };
  }
  return { LFTagOnDatabase: tagPairs, LFTagsOnTable: [], LFTagsOnColumns: [] };
};

const CreateDataCellsFilter: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const tableData = asRecord(input.TableData);
  const tableCatalogId =
    stringOrUndefined(tableData.TableCatalogId) ?? ctx.account;
  const databaseName = requireString(tableData, "DatabaseName");
  const tableName = requireString(tableData, "TableName");
  const name = requireString(tableData, "Name");
  const key = dcfKey(tableCatalogId, databaseName, tableName, name);
  if (ctx.store.get(key) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Data cells filter ${name} already exists.`,
      400,
    );
  }
  const filter: StoredDataCellsFilter = {
    tableCatalogId,
    databaseName,
    tableName,
    name,
    rowFilter: tableData.RowFilter,
    columnNames: asArray(tableData.ColumnNames).map(String),
    columnWildcard: tableData.ColumnWildcard,
    versionId: stringOrUndefined(tableData.VersionId),
  };
  ctx.store.set(key, filter);
  return {};
};

const GetDataCellsFilter: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const tableCatalogId = stringOrUndefined(input.TableCatalogId) ?? ctx.account;
  const databaseName = requireString(input, "DatabaseName");
  const tableName = requireString(input, "TableName");
  const name = requireString(input, "Name");
  const key = dcfKey(tableCatalogId, databaseName, tableName, name);
  const filter = ctx.store.get<StoredDataCellsFilter>(key);
  if (filter === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Data cells filter ${name} not found.`,
      404,
    );
  }
  return { DataCellsFilter: dcfInfo(filter) };
};

const DeleteDataCellsFilter: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const tableCatalogId = stringOrUndefined(input.TableCatalogId) ?? ctx.account;
  const databaseName = requireString(input, "DatabaseName");
  const tableName = requireString(input, "TableName");
  const name = requireString(input, "Name");
  const key = dcfKey(tableCatalogId, databaseName, tableName, name);
  if (ctx.store.get(key) === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Data cells filter ${name} not found.`,
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const UpdateDataCellsFilter: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const tableData = asRecord(input.TableData);
  const tableCatalogId =
    stringOrUndefined(tableData.TableCatalogId) ?? ctx.account;
  const databaseName = requireString(tableData, "DatabaseName");
  const tableName = requireString(tableData, "TableName");
  const name = requireString(tableData, "Name");
  const key = dcfKey(tableCatalogId, databaseName, tableName, name);
  const existing = ctx.store.get<StoredDataCellsFilter>(key);
  if (existing === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Data cells filter ${name} not found.`,
      400,
    );
  }
  const updated: StoredDataCellsFilter = {
    ...existing,
    rowFilter: tableData.RowFilter ?? existing.rowFilter,
    columnNames:
      asArray(tableData.ColumnNames).length > 0
        ? asArray(tableData.ColumnNames).map(String)
        : existing.columnNames,
    columnWildcard: tableData.ColumnWildcard ?? existing.columnWildcard,
    versionId: stringOrUndefined(tableData.VersionId) ?? existing.versionId,
  };
  ctx.store.set(key, updated);
  return {};
};

const ListDataCellsFilter: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const entries = ctx.store.list<StoredDataCellsFilter>();
  const all = entries
    .filter((e) => e.key.startsWith(dcfPrefix))
    .map((e) => dcfInfo(e.value));
  const { items, nextToken } = paginateList(
    all,
    input.NextToken,
    input.MaxResults,
  );
  return { DataCellsFilters: items, NextToken: nextToken };
};

const GrantPermissions: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const permId = `${permPrefix}${generateId()}`;
  const perm: StoredPermission = {
    catalogId: stringOrUndefined(input.CatalogId),
    principal: input.Principal,
    resource: input.Resource,
    condition: input.Condition,
    permissions: asArray(input.Permissions).map(String),
    permissionsWithGrantOption: asArray(input.PermissionsWithGrantOption).map(
      String,
    ),
    lastUpdated: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(permId, perm);
  return {};
};

const RevokePermissions: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const entries = ctx.store.list<StoredPermission>();
  const toRevoke = asArray(input.Permissions).map(String);
  for (const entry of entries) {
    if (!entry.key.startsWith(permPrefix)) continue;
    const perm = entry.value;
    const principalMatch =
      JSON.stringify(perm.principal) === JSON.stringify(input.Principal);
    const resourceMatch =
      JSON.stringify(perm.resource) === JSON.stringify(input.Resource);
    if (principalMatch && resourceMatch) {
      const updated: StoredPermission = {
        ...perm,
        permissions: perm.permissions.filter((p) => !toRevoke.includes(p)),
        permissionsWithGrantOption: perm.permissionsWithGrantOption.filter(
          (p) => !toRevoke.includes(p),
        ),
      };
      if (
        updated.permissions.length === 0 &&
        updated.permissionsWithGrantOption.length === 0
      ) {
        ctx.store.delete(entry.key);
      } else {
        ctx.store.set(entry.key, updated);
      }
    }
  }
  return {};
};

const BatchGrantPermissions: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const entries = asArray(input.Entries);
  for (const entry of entries) {
    const e = asRecord(entry);
    const permId = `${permPrefix}${generateId()}`;
    const perm: StoredPermission = {
      catalogId: stringOrUndefined(input.CatalogId),
      principal: e.Principal,
      resource: e.Resource,
      condition: e.Condition,
      permissions: asArray(e.Permissions).map(String),
      permissionsWithGrantOption: asArray(e.PermissionsWithGrantOption).map(
        String,
      ),
      lastUpdated: Math.floor(Date.now() / 1000),
    };
    ctx.store.set(permId, perm);
  }
  return { Failures: [] };
};

const BatchRevokePermissions: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const entries = asArray(input.Entries);
  for (const entry of entries) {
    const e = asRecord(entry);
    const toRevoke = asArray(e.Permissions).map(String);
    const stored = ctx.store.list<StoredPermission>();
    for (const storedEntry of stored) {
      if (!storedEntry.key.startsWith(permPrefix)) continue;
      const perm = storedEntry.value;
      const principalMatch =
        JSON.stringify(perm.principal) === JSON.stringify(e.Principal);
      const resourceMatch =
        JSON.stringify(perm.resource) === JSON.stringify(e.Resource);
      if (principalMatch && resourceMatch) {
        const updated: StoredPermission = {
          ...perm,
          permissions: perm.permissions.filter((p) => !toRevoke.includes(p)),
          permissionsWithGrantOption: perm.permissionsWithGrantOption.filter(
            (p) => !toRevoke.includes(p),
          ),
        };
        if (
          updated.permissions.length === 0 &&
          updated.permissionsWithGrantOption.length === 0
        ) {
          ctx.store.delete(storedEntry.key);
        } else {
          ctx.store.set(storedEntry.key, updated);
        }
      }
    }
  }
  return { Failures: [] };
};

const ListPermissions: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const entries = ctx.store.list<StoredPermission>();
  const all = entries
    .filter((e) => e.key.startsWith(permPrefix))
    .map((e) => permInfo(e.value));
  const { items, nextToken } = paginateList(
    all,
    input.NextToken,
    input.MaxResults,
  );
  return { PrincipalResourcePermissions: items, NextToken: nextToken };
};

const GetEffectivePermissionsForPath: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const resourceArn = requireString(input, "ResourceArn");
  const entries = ctx.store.list<StoredPermission>();
  const perms = entries
    .filter((e) => e.key.startsWith(permPrefix))
    .filter((e) => {
      const res = asRecord(e.value.resource);
      const dataLoc = asRecord(res.DataLocation);
      return dataLoc.ResourceArn === resourceArn;
    })
    .map((e) => permInfo(e.value));
  const { items, nextToken } = paginateList(
    perms,
    input.NextToken,
    input.MaxResults,
  );
  return { Permissions: items, NextToken: nextToken };
};

const StartTransaction: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const transactionId = generateId();
  const tx: StoredTransaction = {
    transactionId,
    transactionStatus: "ACTIVE",
    transactionType:
      stringOrUndefined(input.TransactionType) ?? "READ_AND_WRITE",
    transactionStartTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(`${txPrefix}${transactionId}`, tx);
  return { TransactionId: transactionId };
};

const CancelTransaction: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const transactionId = requireString(input, "TransactionId");
  const tx = ctx.store.get<StoredTransaction>(`${txPrefix}${transactionId}`);
  if (tx === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Transaction ${transactionId} not found.`,
      400,
    );
  }
  if (tx.transactionStatus === "COMMITTED") {
    throw awsError(
      "TransactionCommittedException",
      `Transaction ${transactionId} is already committed.`,
      400,
    );
  }
  if (tx.transactionStatus === "COMMIT_IN_PROGRESS") {
    throw awsError(
      "TransactionCommitInProgressException",
      `Transaction ${transactionId} commit is in progress.`,
      400,
    );
  }
  const updated: StoredTransaction = {
    ...tx,
    transactionStatus: "ABORTED",
    transactionEndTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(`${txPrefix}${transactionId}`, updated);
  return {};
};

const CommitTransaction: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const transactionId = requireString(input, "TransactionId");
  const tx = ctx.store.get<StoredTransaction>(`${txPrefix}${transactionId}`);
  if (tx === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Transaction ${transactionId} not found.`,
      400,
    );
  }
  if (tx.transactionStatus === "COMMITTED") {
    throw awsError(
      "TransactionCommittedException",
      `Transaction ${transactionId} is already committed.`,
      400,
    );
  }
  if (tx.transactionStatus === "COMMIT_IN_PROGRESS") {
    throw awsError(
      "TransactionCommitInProgressException",
      `Transaction ${transactionId} commit is in progress.`,
      400,
    );
  }
  if (tx.transactionStatus === "ABORTED") {
    throw awsError(
      "TransactionCanceledException",
      `Transaction ${transactionId} has been cancelled.`,
      400,
    );
  }
  const updated: StoredTransaction = {
    ...tx,
    transactionStatus: "COMMITTED",
    transactionEndTime: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(`${txPrefix}${transactionId}`, updated);
  return { TransactionStatus: "COMMITTED" };
};

const DescribeTransaction: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const transactionId = requireString(input, "TransactionId");
  const tx = ctx.store.get<StoredTransaction>(`${txPrefix}${transactionId}`);
  if (tx === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Transaction ${transactionId} not found.`,
      400,
    );
  }
  return { TransactionDescription: txInfo(tx) };
};

const ExtendTransaction: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const transactionId = requireString(input, "TransactionId");
  const tx = ctx.store.get<StoredTransaction>(`${txPrefix}${transactionId}`);
  if (tx === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Transaction ${transactionId} not found.`,
      400,
    );
  }
  return {};
};

const ListTransactions: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const statusFilter = stringOrUndefined(input.StatusFilter) ?? "ALL";
  const entries = ctx.store.list<StoredTransaction>();
  const txs = entries
    .filter((e) => e.key.startsWith(txPrefix))
    .filter((e) => {
      if (statusFilter === "ALL") return true;
      if (statusFilter === "COMPLETED")
        return (
          e.value.transactionStatus === "COMMITTED" ||
          e.value.transactionStatus === "ABORTED"
        );
      return e.value.transactionStatus === statusFilter;
    })
    .map((e) => txInfo(e.value));
  const { items, nextToken } = paginateList(
    txs,
    input.NextToken,
    input.MaxResults,
  );
  return { Transactions: items, NextToken: nextToken };
};

const GetDataLakePrincipal: OperationHandler = (_rawInput, ctx) => {
  return { Identity: callerArn(ctx.account) };
};

const GetDataLakeSettings: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const stored = ctx.store.get<StoredDataLakeSettings>(dlsKey(catalogId));
  return {
    DataLakeSettings: stored?.settings ?? {
      DataLakeAdmins: [],
      ReadOnlyAdmins: [],
      CreateDatabaseDefaultPermissions: [],
      CreateTableDefaultPermissions: [],
      Parameters: {},
      TrustedResourceOwners: [],
      AllowExternalDataFiltering: false,
      AllowFullTableExternalDataAccess: false,
      ExternalDataFilteringAllowList: [],
      AuthorizedSessionTagValueList: [],
    },
  };
};

const PutDataLakeSettings: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const dls: StoredDataLakeSettings = {
    catalogId,
    settings: input.DataLakeSettings,
  };
  ctx.store.set(dlsKey(catalogId), dls);
  return {};
};

const CreateLakeFormationIdentityCenterConfiguration: OperationHandler = (
  rawInput,
  ctx,
) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  if (ctx.store.get(iccKey(catalogId)) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Identity Center configuration for catalog ${catalogId} already exists.`,
      400,
    );
  }
  const applicationArn = `arn:aws:sso::${ctx.account}:application/ssoins-${generateId()}`;
  const config: StoredIdentityCenterConfig = {
    catalogId,
    instanceArn: stringOrUndefined(input.InstanceArn),
    applicationArn,
    externalFiltering: input.ExternalFiltering,
    shareRecipients: asArray(input.ShareRecipients),
    serviceIntegrations: asArray(input.ServiceIntegrations),
    resourceShare: `arn:aws:ram:${ctx.region}:${ctx.account}:resource-share/${generateId()}`,
  };
  ctx.store.set(iccKey(catalogId), config);
  return { ApplicationArn: applicationArn };
};

const DeleteLakeFormationIdentityCenterConfiguration: OperationHandler = (
  rawInput,
  ctx,
) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  if (ctx.store.get(iccKey(catalogId)) === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Identity Center configuration for catalog ${catalogId} not found.`,
      400,
    );
  }
  ctx.store.delete(iccKey(catalogId));
  return {};
};

const DescribeLakeFormationIdentityCenterConfiguration: OperationHandler = (
  rawInput,
  ctx,
) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const config = ctx.store.get<StoredIdentityCenterConfig>(iccKey(catalogId));
  if (config === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Identity Center configuration for catalog ${catalogId} not found.`,
      400,
    );
  }
  return {
    CatalogId: config.catalogId,
    InstanceArn: config.instanceArn,
    ApplicationArn: config.applicationArn,
    ExternalFiltering: config.externalFiltering,
    ShareRecipients: config.shareRecipients,
    ServiceIntegrations: config.serviceIntegrations,
    ResourceShare: config.resourceShare,
  };
};

const UpdateLakeFormationIdentityCenterConfiguration: OperationHandler = (
  rawInput,
  ctx,
) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const config = ctx.store.get<StoredIdentityCenterConfig>(iccKey(catalogId));
  if (config === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Identity Center configuration for catalog ${catalogId} not found.`,
      400,
    );
  }
  const updated: StoredIdentityCenterConfig = {
    ...config,
    externalFiltering: input.ExternalFiltering ?? config.externalFiltering,
    shareRecipients:
      asArray(input.ShareRecipients).length > 0
        ? asArray(input.ShareRecipients)
        : config.shareRecipients,
    serviceIntegrations:
      asArray(input.ServiceIntegrations).length > 0
        ? asArray(input.ServiceIntegrations)
        : config.serviceIntegrations,
  };
  ctx.store.set(iccKey(catalogId), updated);
  return {};
};

const CreateLakeFormationOptIn: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const optinId = `${optinPrefix}${generateId()}`;
  const optin: StoredOptIn = {
    principal: input.Principal,
    resource: input.Resource,
    condition: input.Condition,
    lastModified: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(optinId, optin);
  return {};
};

const DeleteLakeFormationOptIn: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const entries = ctx.store.list<StoredOptIn>();
  for (const entry of entries) {
    if (!entry.key.startsWith(optinPrefix)) continue;
    const optin = entry.value;
    if (
      JSON.stringify(optin.principal) === JSON.stringify(input.Principal) &&
      JSON.stringify(optin.resource) === JSON.stringify(input.Resource)
    ) {
      ctx.store.delete(entry.key);
      return {};
    }
  }
  return {};
};

const ListLakeFormationOptIns: OperationHandler = (_rawInput, ctx) => {
  const entries = ctx.store.list<StoredOptIn>();
  return {
    LakeFormationOptInsInfoList: entries
      .filter((e) => e.key.startsWith(optinPrefix))
      .map((e) => ({
        Resource: e.value.resource,
        Principal: e.value.principal,
        Condition: e.value.condition,
        LastModified: e.value.lastModified,
      })),
  };
};

const GetTableObjects: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const databaseName = requireString(input, "DatabaseName");
  const tableName = requireString(input, "TableName");
  const key = tobjKey(catalogId, databaseName, tableName);
  const stored = ctx.store.get<StoredGoverningTable>(key);
  if (stored === undefined) {
    return { Objects: [] };
  }
  const objects = stored.objects.map((o) => ({
    PartitionValues: o.partitionValues,
    Objects: [{ Uri: o.uri, ETag: o.eTag, Size: o.size }],
  }));
  const { items, nextToken } = paginateList(
    objects,
    input.NextToken,
    input.MaxResults,
  );
  return { Objects: items, NextToken: nextToken };
};

const UpdateTableObjects: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const transactionId = stringOrUndefined(input.TransactionId);
  if (transactionId !== undefined) {
    const tx = ctx.store.get<StoredTransaction>(`${txPrefix}${transactionId}`);
    if (tx === undefined) {
      throw awsError(
        "EntityNotFoundException",
        `Transaction ${transactionId} not found.`,
        404,
      );
    }
  }
  const catalogId = stringOrUndefined(input.CatalogId) ?? ctx.account;
  const databaseName = requireString(input, "DatabaseName");
  const tableName = requireString(input, "TableName");
  const key = tobjKey(catalogId, databaseName, tableName);
  const existing = ctx.store.get<StoredGoverningTable>(key) ?? { objects: [] };
  let objects = [...existing.objects];
  for (const op of asArray(input.WriteOperations)) {
    const operation = asRecord(op);
    if (operation.AddObject !== undefined) {
      const add = asRecord(operation.AddObject);
      objects.push({
        uri: requireString(add, "Uri"),
        eTag: requireString(add, "ETag"),
        size: typeof add.Size === "number" ? add.Size : undefined,
        partitionValues: asArray(add.PartitionValues).map(String),
      });
    } else if (operation.DeleteObject !== undefined) {
      const del = asRecord(operation.DeleteObject);
      const uri = requireString(del, "Uri");
      const eTag = requireString(del, "ETag");
      objects = objects.filter((o) => !(o.uri === uri && o.eTag === eTag));
    }
  }
  ctx.store.set(key, { objects });
  return {};
};

const DeleteObjectsOnCancel: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const transactionId = requireString(input, "TransactionId");
  const tx = ctx.store.get<StoredTransaction>(`${txPrefix}${transactionId}`);
  if (tx === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Transaction ${transactionId} not found.`,
      400,
    );
  }
  return {};
};

const GetTemporaryDataLocationCredentials: OperationHandler = (
  _rawInput,
  _ctx,
) => {
  return {
    Credentials: syntheticCredentials(),
    AccessibleDataLocations: [],
    CredentialsScope: "SELECT",
  };
};

const GetTemporaryGluePartitionCredentials: OperationHandler = (
  _rawInput,
  _ctx,
) => {
  return syntheticCredentials();
};

const GetTemporaryGlueTableCredentials: OperationHandler = (
  _rawInput,
  _ctx,
) => {
  return {
    ...syntheticCredentials(),
    VendedS3Path: [],
  };
};

const AssumeDecoratedRoleWithSAML: OperationHandler = (_rawInput, _ctx) => {
  return syntheticCredentials();
};

const ListTableStorageOptimizers: OperationHandler = (_rawInput, _ctx) => {
  return { StorageOptimizerList: [] };
};

const UpdateTableStorageOptimizer: OperationHandler = (_rawInput, _ctx) => {
  return { Result: "SUCCESS" };
};

const StartQueryPlanning: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const queryId = generateId();
  const query: StoredQuery = {
    queryId,
    state: "FINISHED",
    queryString: stringOrUndefined(input.QueryString) ?? "",
    workUnits: 1,
  };
  ctx.store.set(`${queryPrefix}${queryId}`, query);
  return { QueryId: queryId };
};

const GetQueryState: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const queryId = requireString(input, "QueryId");
  const query = ctx.store.get<StoredQuery>(`${queryPrefix}${queryId}`);
  if (query === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Query ${queryId} not found.`,
      400,
    );
  }
  return { State: query.state };
};

const GetQueryStatistics: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const queryId = requireString(input, "QueryId");
  const query = ctx.store.get<StoredQuery>(`${queryPrefix}${queryId}`);
  if (query === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Query ${queryId} not found.`,
      400,
    );
  }
  return {
    ExecutionStatistics: {
      AverageExecutionTimeMillis: 100,
      DataScannedBytes: 1024,
      WorkUnitsExecutedCount: query.workUnits,
    },
    PlanningStatistics: {
      EstimatedDataToScanBytes: 1024,
      PlanningTimeMillis: 50,
      QueueTimeMillis: 10,
      WorkUnitsGeneratedCount: query.workUnits,
    },
    QuerySubmissionTime: Math.floor(Date.now() / 1000),
  };
};

const GetWorkUnits: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const queryId = requireString(input, "QueryId");
  const query = ctx.store.get<StoredQuery>(`${queryPrefix}${queryId}`);
  if (query === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Query ${queryId} not found.`,
      400,
    );
  }
  return {
    QueryId: queryId,
    WorkUnitRanges: [
      { WorkUnitIdMax: 0, WorkUnitIdMin: 0, WorkUnitToken: "token" },
    ],
  };
};

const GetWorkUnitResults: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const queryId = requireString(input, "QueryId");
  const query = ctx.store.get<StoredQuery>(`${queryPrefix}${queryId}`);
  if (query === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Query ${queryId} not found.`,
      400,
    );
  }
  return { ResultStream: null };
};

const SearchDatabasesByLFTags: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const expression = asArray(input.Expression);
  const entries = ctx.store.list<StoredResourceLFTagAssignment>();
  const results = entries
    .filter((e) => e.key.startsWith(`${resTagPrefix}db:`))
    .filter((e) => matchesExpression(e.value.lfTags, expression))
    .map((e) => ({
      Database: asRecord(e.value.resource).Database,
      LFTags: e.value.lfTags.map((t) => ({
        CatalogId: t.catalogId,
        TagKey: t.tagKey,
        TagValues: t.tagValues,
      })),
    }));
  return { DatabaseList: results };
};

const SearchTablesByLFTags: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const expression = asArray(input.Expression);
  const entries = ctx.store.list<StoredResourceLFTagAssignment>();
  const results = entries
    .filter(
      (e) =>
        e.key.startsWith(`${resTagPrefix}table:`) ||
        e.key.startsWith(`${resTagPrefix}twc:`),
    )
    .filter((e) => matchesExpression(e.value.lfTags, expression))
    .map((e) => {
      const r = asRecord(e.value.resource);
      return {
        Table: r.Table ?? r.TableWithColumns,
        LFTagsOnTable: e.value.lfTags.map((t) => ({
          CatalogId: t.catalogId,
          TagKey: t.tagKey,
          TagValues: t.tagValues,
        })),
        LFTagOnDatabase: [],
        LFTagsOnColumns: [],
      };
    });
  return { TableList: results };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const lakeformation = {
  name: "lakeformation",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    if (req.method !== "POST") return undefined;
    const parts = pathSegments(req.path);
    if (parts.length !== 1) return undefined;
    return parts[0];
  },
  operations: {
    RegisterResource,
    DescribeResource,
    ListResources,
    DeregisterResource,
    UpdateResource,
    CreateLFTag,
    GetLFTag,
    DeleteLFTag,
    UpdateLFTag,
    ListLFTags,
    CreateLFTagExpression,
    GetLFTagExpression,
    DeleteLFTagExpression,
    UpdateLFTagExpression,
    ListLFTagExpressions,
    AddLFTagsToResource,
    RemoveLFTagsFromResource,
    GetResourceLFTags,
    CreateDataCellsFilter,
    GetDataCellsFilter,
    DeleteDataCellsFilter,
    UpdateDataCellsFilter,
    ListDataCellsFilter,
    GrantPermissions,
    RevokePermissions,
    BatchGrantPermissions,
    BatchRevokePermissions,
    ListPermissions,
    GetEffectivePermissionsForPath,
    StartTransaction,
    CancelTransaction,
    CommitTransaction,
    DescribeTransaction,
    ExtendTransaction,
    ListTransactions,
    GetDataLakePrincipal,
    GetDataLakeSettings,
    PutDataLakeSettings,
    CreateLakeFormationIdentityCenterConfiguration,
    DeleteLakeFormationIdentityCenterConfiguration,
    DescribeLakeFormationIdentityCenterConfiguration,
    UpdateLakeFormationIdentityCenterConfiguration,
    CreateLakeFormationOptIn,
    DeleteLakeFormationOptIn,
    ListLakeFormationOptIns,
    GetTableObjects,
    UpdateTableObjects,
    DeleteObjectsOnCancel,
    GetTemporaryDataLocationCredentials,
    GetTemporaryGluePartitionCredentials,
    GetTemporaryGlueTableCredentials,
    AssumeDecoratedRoleWithSAML,
    ListTableStorageOptimizers,
    UpdateTableStorageOptimizer,
    StartQueryPlanning,
    GetQueryState,
    GetQueryStatistics,
    GetWorkUnits,
    GetWorkUnitResults,
    SearchDatabasesByLFTags,
    SearchTablesByLFTags,
  },
  model,
} as const satisfies ServiceDefinition;

export default lakeformation;
