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
const revisionPrefix = "revision:" as const;
const assetPrefix = "asset:" as const;
const jobPrefix = "job:" as const;
const eventActionPrefix = "event-action:" as const;
const dataGrantPrefix = "data-grant:" as const;
const tagsPrefix = "tags:" as const;

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

type StoredRevision = {
  Id: string;
  Arn: string;
  DataSetId: string;
  Comment: string;
  CreatedAt: number;
  UpdatedAt: number;
  Finalized: boolean;
  Tags: Record<string, unknown>;
  RevocationComment: string | undefined;
  Revoked: boolean;
  RevokedAt: number | undefined;
};

type StoredAsset = {
  Id: string;
  Arn: string;
  DataSetId: string;
  RevisionId: string;
  Name: string;
  AssetType: string;
  AssetDetails: Record<string, unknown>;
  CreatedAt: number;
  UpdatedAt: number;
  Tags: Record<string, unknown>;
};

type StoredJob = {
  Id: string;
  Arn: string;
  Type: string;
  State: string;
  Details: Record<string, unknown>;
  AssetConfiguration: Record<string, unknown> | undefined;
  Errors: unknown[];
  CreatedAt: number;
  UpdatedAt: number;
};

type StoredEventAction = {
  Id: string;
  Arn: string;
  Action: Record<string, unknown>;
  Event: Record<string, unknown>;
  Tags: Record<string, unknown>;
  CreatedAt: number;
  UpdatedAt: number;
};

type StoredDataGrant = {
  Id: string;
  Arn: string;
  Name: string;
  SenderPrincipal: string;
  ReceiverPrincipal: string;
  Description: string | undefined;
  AcceptanceState: string;
  AcceptedAt: number | undefined;
  EndsAt: number | undefined;
  GrantDistributionScope: string;
  DataSetId: string;
  SourceDataSetId: string;
  Tags: Record<string, unknown>;
  CreatedAt: number;
  UpdatedAt: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const booleanOrUndefined = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const tagsOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const objectOrEmpty = (value: unknown): Record<string, unknown> =>
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

const revisionKey = (dataSetId: string, revisionId: string): string =>
  `${revisionPrefix}${dataSetId}:${revisionId}`;

const assetKey = (
  dataSetId: string,
  revisionId: string,
  assetId: string,
): string => `${assetPrefix}${dataSetId}:${revisionId}:${assetId}`;

const jobKey = (id: string): string => `${jobPrefix}${id}`;

const eventActionKey = (id: string): string => `${eventActionPrefix}${id}`;

const dataGrantKey = (id: string): string => `${dataGrantPrefix}${id}`;

const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;

const dataSetArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:dataexchange:${ctx.region}:${ctx.account}:data-sets/${id}`;

const revisionArn = (
  ctx: ServiceContext,
  dataSetId: string,
  revisionId: string,
): string =>
  `arn:aws:dataexchange:${ctx.region}:${ctx.account}:data-sets/${dataSetId}/revisions/${revisionId}`;

const assetArn = (
  ctx: ServiceContext,
  dataSetId: string,
  revisionId: string,
  assetId: string,
): string =>
  `arn:aws:dataexchange:${ctx.region}:${ctx.account}:data-sets/${dataSetId}/revisions/${revisionId}/assets/${assetId}`;

const jobArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:dataexchange:${ctx.region}:${ctx.account}:jobs/${id}`;

const eventActionArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:dataexchange:${ctx.region}:${ctx.account}:event-actions/${id}`;

const dataGrantArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:dataexchange:${ctx.region}:${ctx.account}:data-grants/${id}`;

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

const requireRevision = (
  ctx: ServiceContext,
  dataSetId: string,
  revisionId: string,
): StoredRevision => {
  const stored = ctx.store.get<StoredRevision>(
    revisionKey(dataSetId, revisionId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Revision ${revisionId} could not be found.`,
      404,
    );
  }
  return stored;
};

const requireAsset = (
  ctx: ServiceContext,
  dataSetId: string,
  revisionId: string,
  assetId: string,
): StoredAsset => {
  const stored = ctx.store.get<StoredAsset>(
    assetKey(dataSetId, revisionId, assetId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Asset ${assetId} could not be found.`,
      404,
    );
  }
  return stored;
};

const requireJob = (ctx: ServiceContext, id: string): StoredJob => {
  const stored = ctx.store.get<StoredJob>(jobKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Job ${id} could not be found.`,
      404,
    );
  }
  return stored;
};

const requireEventAction = (
  ctx: ServiceContext,
  id: string,
): StoredEventAction => {
  const stored = ctx.store.get<StoredEventAction>(eventActionKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `EventAction ${id} could not be found.`,
      404,
    );
  }
  return stored;
};

const requireDataGrant = (ctx: ServiceContext, id: string): StoredDataGrant => {
  const stored = ctx.store.get<StoredDataGrant>(dataGrantKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `DataGrant ${id} could not be found.`,
      404,
    );
  }
  return stored;
};

const findDataGrantByArn = (
  ctx: ServiceContext,
  arn: string,
): StoredDataGrant | undefined =>
  ctx.store
    .list<StoredDataGrant>()
    .filter((e) => e.key.startsWith(dataGrantPrefix))
    .map((e) => e.value)
    .find((g) => g.Arn === arn);

const dataSetView = (ds: StoredDataSet): Record<string, unknown> => ({
  Id: ds.Id,
  Arn: ds.Arn,
  AssetType: ds.AssetType,
  Description: ds.Description,
  Name: ds.Name,
  Origin: ds.Origin,
  CreatedAt: ds.CreatedAt,
  UpdatedAt: ds.UpdatedAt,
  Tags: ds.Tags,
});

const revisionView = (r: StoredRevision): Record<string, unknown> => ({
  Id: r.Id,
  Arn: r.Arn,
  DataSetId: r.DataSetId,
  Comment: r.Comment,
  CreatedAt: r.CreatedAt,
  UpdatedAt: r.UpdatedAt,
  Finalized: r.Finalized,
  Tags: r.Tags,
  RevocationComment: r.RevocationComment,
  Revoked: r.Revoked,
  RevokedAt: r.RevokedAt,
});

const assetView = (a: StoredAsset): Record<string, unknown> => ({
  Id: a.Id,
  Arn: a.Arn,
  DataSetId: a.DataSetId,
  RevisionId: a.RevisionId,
  Name: a.Name,
  AssetType: a.AssetType,
  AssetDetails: a.AssetDetails,
  CreatedAt: a.CreatedAt,
  UpdatedAt: a.UpdatedAt,
  Tags: a.Tags,
});

const jobView = (j: StoredJob): Record<string, unknown> => ({
  Id: j.Id,
  Arn: j.Arn,
  Type: j.Type,
  State: j.State,
  Details: j.Details,
  AssetConfiguration: j.AssetConfiguration,
  Errors: j.Errors,
  CreatedAt: j.CreatedAt,
  UpdatedAt: j.UpdatedAt,
});

const eventActionView = (e: StoredEventAction): Record<string, unknown> => ({
  Id: e.Id,
  Arn: e.Arn,
  Action: e.Action,
  Event: e.Event,
  Tags: e.Tags,
  CreatedAt: e.CreatedAt,
  UpdatedAt: e.UpdatedAt,
});

const dataGrantView = (g: StoredDataGrant): Record<string, unknown> => ({
  Id: g.Id,
  Arn: g.Arn,
  Name: g.Name,
  SenderPrincipal: g.SenderPrincipal,
  ReceiverPrincipal: g.ReceiverPrincipal,
  Description: g.Description,
  AcceptanceState: g.AcceptanceState,
  AcceptedAt: g.AcceptedAt,
  EndsAt: g.EndsAt,
  GrantDistributionScope: g.GrantDistributionScope,
  DataSetId: g.DataSetId,
  SourceDataSetId: g.SourceDataSetId,
  Tags: g.Tags,
  CreatedAt: g.CreatedAt,
  UpdatedAt: g.UpdatedAt,
});

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

const CreateRevision: OperationHandler = (input, ctx) => {
  const dataSetId = requireString(input, "DataSetId");
  requireDataSet(ctx, dataSetId);
  const id = newId();
  const now = nowSeconds();
  const revision: StoredRevision = {
    Id: id,
    Arn: revisionArn(ctx, dataSetId, id),
    DataSetId: dataSetId,
    Comment: stringOrUndefined(input["Comment"]) ?? "",
    CreatedAt: now,
    UpdatedAt: now,
    Finalized: false,
    Tags: tagsOrEmpty(input["Tags"]),
    RevocationComment: undefined,
    Revoked: false,
    RevokedAt: undefined,
  };
  ctx.store.set(revisionKey(dataSetId, id), revision);
  return revisionView(revision);
};

const GetRevision: OperationHandler = (input, ctx) => {
  const dataSetId = requireString(input, "DataSetId");
  const revisionId = requireString(input, "RevisionId");
  return revisionView(requireRevision(ctx, dataSetId, revisionId));
};

const ListDataSetRevisions: OperationHandler = (input, ctx) => {
  const dataSetId = requireString(input, "DataSetId");
  requireDataSet(ctx, dataSetId);
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const prefix = `${revisionPrefix}${dataSetId}:`;
  const revisions = ctx.store
    .list<StoredRevision>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => a.CreatedAt - b.CreatedAt);
  return { Revisions: revisions.slice(0, max).map(revisionView) };
};

const UpdateRevision: OperationHandler = (input, ctx) => {
  const dataSetId = requireString(input, "DataSetId");
  const revisionId = requireString(input, "RevisionId");
  const existing = requireRevision(ctx, dataSetId, revisionId);
  const revision: StoredRevision = {
    ...existing,
    Comment: stringOrUndefined(input["Comment"]) ?? existing.Comment,
    Finalized: booleanOrUndefined(input["Finalized"]) ?? existing.Finalized,
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(revisionKey(dataSetId, revisionId), revision);
  return revisionView(revision);
};

const DeleteRevision: OperationHandler = (input, ctx) => {
  const dataSetId = requireString(input, "DataSetId");
  const revisionId = requireString(input, "RevisionId");
  requireRevision(ctx, dataSetId, revisionId);
  ctx.store.delete(revisionKey(dataSetId, revisionId));
  return {};
};

const RevokeRevision: OperationHandler = (input, ctx) => {
  const dataSetId = requireString(input, "DataSetId");
  const revisionId = requireString(input, "RevisionId");
  const revocationComment = requireString(input, "RevocationComment");
  const existing = requireRevision(ctx, dataSetId, revisionId);
  const now = nowSeconds();
  const revision: StoredRevision = {
    ...existing,
    RevocationComment: revocationComment,
    Revoked: true,
    RevokedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(revisionKey(dataSetId, revisionId), revision);
  return revisionView(revision);
};

const GetAsset: OperationHandler = (input, ctx) => {
  const dataSetId = requireString(input, "DataSetId");
  const revisionId = requireString(input, "RevisionId");
  const assetId = requireString(input, "AssetId");
  return assetView(requireAsset(ctx, dataSetId, revisionId, assetId));
};

const UpdateAsset: OperationHandler = (input, ctx) => {
  const dataSetId = requireString(input, "DataSetId");
  const revisionId = requireString(input, "RevisionId");
  const assetId = requireString(input, "AssetId");
  const name = requireString(input, "Name");
  const existing = requireAsset(ctx, dataSetId, revisionId, assetId);
  const asset: StoredAsset = {
    ...existing,
    Name: name,
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(assetKey(dataSetId, revisionId, assetId), asset);
  return assetView(asset);
};

const DeleteAsset: OperationHandler = (input, ctx) => {
  const dataSetId = requireString(input, "DataSetId");
  const revisionId = requireString(input, "RevisionId");
  const assetId = requireString(input, "AssetId");
  requireAsset(ctx, dataSetId, revisionId, assetId);
  ctx.store.delete(assetKey(dataSetId, revisionId, assetId));
  return {};
};

const ListRevisionAssets: OperationHandler = (input, ctx) => {
  const dataSetId = requireString(input, "DataSetId");
  const revisionId = requireString(input, "RevisionId");
  requireRevision(ctx, dataSetId, revisionId);
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const prefix = `${assetPrefix}${dataSetId}:${revisionId}:`;
  const assets = ctx.store
    .list<StoredAsset>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => a.CreatedAt - b.CreatedAt);
  return { Assets: assets.slice(0, max).map(assetView) };
};

const CreateJob: OperationHandler = (input, ctx) => {
  const type = requireString(input, "Type");
  const id = newId();
  const now = nowSeconds();
  const job: StoredJob = {
    Id: id,
    Arn: jobArn(ctx, id),
    Type: type,
    State: "WAITING",
    Details: objectOrEmpty(input["Details"]),
    AssetConfiguration:
      input["AssetConfiguration"] !== undefined
        ? objectOrEmpty(input["AssetConfiguration"])
        : undefined,
    Errors: [],
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(jobKey(id), job);
  return jobView(job);
};

const GetJob: OperationHandler = (input, ctx) => {
  const id = requireString(input, "JobId");
  return jobView(requireJob(ctx, id));
};

const ListJobs: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const jobs = ctx.store
    .list<StoredJob>()
    .filter((e) => e.key.startsWith(jobPrefix))
    .map((e) => e.value)
    .sort((a, b) => a.CreatedAt - b.CreatedAt);
  return { Jobs: jobs.slice(0, max).map(jobView) };
};

const StartJob: OperationHandler = (input, ctx) => {
  const id = requireString(input, "JobId");
  const existing = requireJob(ctx, id);
  const job: StoredJob = {
    ...existing,
    State: "IN_PROGRESS",
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(jobKey(id), job);
  return {};
};

const CancelJob: OperationHandler = (input, ctx) => {
  const id = requireString(input, "JobId");
  const existing = requireJob(ctx, id);
  const job: StoredJob = {
    ...existing,
    State: "CANCELLED",
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(jobKey(id), job);
  return {};
};

const CreateEventAction: OperationHandler = (input, ctx) => {
  const id = newId();
  const now = nowSeconds();
  const eventAction: StoredEventAction = {
    Id: id,
    Arn: eventActionArn(ctx, id),
    Action: objectOrEmpty(input["Action"]),
    Event: objectOrEmpty(input["Event"]),
    Tags: tagsOrEmpty(input["Tags"]),
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(eventActionKey(id), eventAction);
  return eventActionView(eventAction);
};

const GetEventAction: OperationHandler = (input, ctx) => {
  const id = requireString(input, "EventActionId");
  return eventActionView(requireEventAction(ctx, id));
};

const ListEventActions: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const eventActions = ctx.store
    .list<StoredEventAction>()
    .filter((e) => e.key.startsWith(eventActionPrefix))
    .map((e) => e.value)
    .sort((a, b) => a.CreatedAt - b.CreatedAt);
  return { EventActions: eventActions.slice(0, max).map(eventActionView) };
};

const UpdateEventAction: OperationHandler = (input, ctx) => {
  const id = requireString(input, "EventActionId");
  const existing = requireEventAction(ctx, id);
  const eventAction: StoredEventAction = {
    ...existing,
    Action:
      input["Action"] !== undefined
        ? objectOrEmpty(input["Action"])
        : existing.Action,
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(eventActionKey(id), eventAction);
  return eventActionView(eventAction);
};

const DeleteEventAction: OperationHandler = (input, ctx) => {
  const id = requireString(input, "EventActionId");
  requireEventAction(ctx, id);
  ctx.store.delete(eventActionKey(id));
  return {};
};

const CreateDataGrant: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const grantDistributionScope = requireString(input, "GrantDistributionScope");
  const receiverPrincipal = requireString(input, "ReceiverPrincipal");
  const sourceDataSetId = requireString(input, "SourceDataSetId");
  requireDataSet(ctx, sourceDataSetId);
  const id = newId();
  const now = nowSeconds();
  const grant: StoredDataGrant = {
    Id: id,
    Arn: dataGrantArn(ctx, id),
    Name: name,
    SenderPrincipal: `arn:aws:iam::${ctx.account}:root`,
    ReceiverPrincipal: receiverPrincipal,
    Description: stringOrUndefined(input["Description"]),
    AcceptanceState: "PENDING_RECEIVER_ACCEPTANCE",
    AcceptedAt: undefined,
    EndsAt: numberOrUndefined(input["EndsAt"]),
    GrantDistributionScope: grantDistributionScope,
    DataSetId: sourceDataSetId,
    SourceDataSetId: sourceDataSetId,
    Tags: tagsOrEmpty(input["Tags"]),
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(dataGrantKey(id), grant);
  return dataGrantView(grant);
};

const GetDataGrant: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DataGrantId");
  return dataGrantView(requireDataGrant(ctx, id));
};

const DeleteDataGrant: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DataGrantId");
  requireDataGrant(ctx, id);
  ctx.store.delete(dataGrantKey(id));
  return {};
};

const ListDataGrants: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const grants = ctx.store
    .list<StoredDataGrant>()
    .filter((e) => e.key.startsWith(dataGrantPrefix))
    .map((e) => e.value)
    .sort((a, b) => a.CreatedAt - b.CreatedAt);
  return { DataGrantSummaries: grants.slice(0, max).map(dataGrantView) };
};

const AcceptDataGrant: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DataGrantArn");
  const grant = findDataGrantByArn(ctx, arn);
  if (grant === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `DataGrant with ARN ${arn} could not be found.`,
      404,
    );
  }
  const now = nowSeconds();
  const updated: StoredDataGrant = {
    ...grant,
    AcceptanceState: "GRANTED",
    AcceptedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(dataGrantKey(grant.Id), updated);
  return dataGrantView(updated);
};

const GetReceivedDataGrant: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DataGrantArn");
  const grant = findDataGrantByArn(ctx, arn);
  if (grant === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `DataGrant with ARN ${arn} could not be found.`,
      404,
    );
  }
  return dataGrantView(grant);
};

const ListReceivedDataGrants: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["MaxResults"]) ?? 50;
  const acceptanceStateFilter = stringOrUndefined(input["AcceptanceState"]);
  const grants = ctx.store
    .list<StoredDataGrant>()
    .filter((e) => e.key.startsWith(dataGrantPrefix))
    .map((e) => e.value)
    .filter(
      (g) =>
        acceptanceStateFilter === undefined ||
        g.AcceptanceState === acceptanceStateFilter,
    )
    .sort((a, b) => a.CreatedAt - b.CreatedAt);
  return { DataGrantSummaries: grants.slice(0, max).map(dataGrantView) };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tags = ctx.store.get<Record<string, unknown>>(tagsKey(arn)) ?? {};
  return { Tags: tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const newTags = tagsOrEmpty(input["Tags"]);
  const existing = ctx.store.get<Record<string, unknown>>(tagsKey(arn)) ?? {};
  ctx.store.set(tagsKey(arn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[])
    : [];
  const existing = ctx.store.get<Record<string, unknown>>(tagsKey(arn)) ?? {};
  const updated = { ...existing };
  for (const key of tagKeys) {
    delete updated[key];
  }
  ctx.store.set(tagsKey(arn), updated);
  return {};
};

const SendApiAsset: OperationHandler = (_input, _ctx) => ({
  Body: "",
  ResponseHeaders: {},
});

const SendDataSetNotification: OperationHandler = (input, ctx) => {
  const dataSetId = requireString(input, "DataSetId");
  requireDataSet(ctx, dataSetId);
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const dataexchange = {
  name: "dataexchange",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);

    if (parts[0] === "tags" && parts.length === 2) {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }

    if (parts[0] !== "v1") return undefined;

    if (parts.length === 1) {
      if (req.method === "POST") return "SendApiAsset";
      return undefined;
    }

    if (parts[1] === "data-sets") {
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
      if (parts.length === 4) {
        if (parts[3] === "revisions") {
          if (req.method === "POST") return "CreateRevision";
          if (req.method === "GET") return "ListDataSetRevisions";
          return undefined;
        }
        if (parts[3] === "notification") {
          if (req.method === "POST") return "SendDataSetNotification";
          return undefined;
        }
        return undefined;
      }
      if (parts.length === 5 && parts[3] === "revisions") {
        if (req.method === "GET") return "GetRevision";
        if (req.method === "PATCH") return "UpdateRevision";
        if (req.method === "DELETE") return "DeleteRevision";
        return undefined;
      }
      if (parts.length === 6 && parts[3] === "revisions") {
        if (parts[5] === "revoke") {
          if (req.method === "POST") return "RevokeRevision";
          return undefined;
        }
        if (parts[5] === "assets") {
          if (req.method === "GET") return "ListRevisionAssets";
          return undefined;
        }
        return undefined;
      }
      if (
        parts.length === 7 &&
        parts[3] === "revisions" &&
        parts[5] === "assets"
      ) {
        if (req.method === "GET") return "GetAsset";
        if (req.method === "PATCH") return "UpdateAsset";
        if (req.method === "DELETE") return "DeleteAsset";
        return undefined;
      }
      return undefined;
    }

    if (parts[1] === "jobs") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateJob";
        if (req.method === "GET") return "ListJobs";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "GetJob";
        if (req.method === "DELETE") return "CancelJob";
        if (req.method === "PATCH") return "StartJob";
        return undefined;
      }
      return undefined;
    }

    if (parts[1] === "event-actions") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateEventAction";
        if (req.method === "GET") return "ListEventActions";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "GetEventAction";
        if (req.method === "PATCH") return "UpdateEventAction";
        if (req.method === "DELETE") return "DeleteEventAction";
        return undefined;
      }
      return undefined;
    }

    if (parts[1] === "data-grants") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateDataGrant";
        if (req.method === "GET") return "ListDataGrants";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "GetDataGrant";
        if (req.method === "DELETE") return "DeleteDataGrant";
        return undefined;
      }
      if (parts.length === 4 && parts[3] === "accept") {
        if (req.method === "POST") return "AcceptDataGrant";
        return undefined;
      }
      return undefined;
    }

    if (parts[1] === "received-data-grants") {
      if (parts.length === 2) {
        if (req.method === "GET") return "ListReceivedDataGrants";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "GetReceivedDataGrant";
        return undefined;
      }
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
    CreateRevision,
    GetRevision,
    ListDataSetRevisions,
    UpdateRevision,
    DeleteRevision,
    RevokeRevision,
    GetAsset,
    UpdateAsset,
    DeleteAsset,
    ListRevisionAssets,
    CreateJob,
    GetJob,
    ListJobs,
    StartJob,
    CancelJob,
    CreateEventAction,
    GetEventAction,
    ListEventActions,
    UpdateEventAction,
    DeleteEventAction,
    CreateDataGrant,
    GetDataGrant,
    DeleteDataGrant,
    ListDataGrants,
    AcceptDataGrant,
    GetReceivedDataGrant,
    ListReceivedDataGrants,
    ListTagsForResource,
    TagResource,
    UntagResource,
    SendApiAsset,
    SendDataSetNotification,
  },
  model,
} as const satisfies ServiceDefinition;

export default dataexchange;
