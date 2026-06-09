import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ramModel from "../../../../test/vendor/aws-models/ram.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(ramModel);

const sharePrefix = "share:" as const;
const assocPrefix = "assoc:" as const;
const invPrefix = "inv:" as const;
const permPrefix = "perm:" as const;
const permVerPrefix = "permver:" as const;
const sharePermPrefix = "shareperm:" as const;
const workPrefix = "work:" as const;

type StoredShare = {
  resourceShareArn: string;
  name: string;
  owningAccountId: string;
  allowExternalPrincipals: boolean;
  status: string;
  featureSet: string;
  creationTime: number;
  lastUpdatedTime: number;
  tags: { key: string; value: string }[];
};

type StoredAssociation = {
  resourceShareArn: string;
  resourceShareName: string;
  associatedEntity: string;
  associationType: string;
  status: string;
  statusMessage: string;
  creationTime: number;
  lastUpdatedTime: number;
  external: boolean;
};

type StoredInvitation = {
  resourceShareInvitationArn: string;
  resourceShareName: string;
  resourceShareArn: string;
  senderAccountId: string;
  receiverAccountId: string;
  invitationTimestamp: number;
  status: string;
};

type StoredPermission = {
  arn: string;
  name: string;
  resourceType: string;
  defaultVersionNumber: number;
  latestVersionNumber: number;
  permissionType: string;
  featureSet: string;
  status: string;
  isResourceTypeDefault: boolean;
  creationTime: number;
  lastUpdatedTime: number;
  tags: { key: string; value: string }[];
};

type StoredPermissionVersion = {
  permissionArn: string;
  version: string;
  policyTemplate: string;
  creationTime: number;
  lastUpdatedTime: number;
  defaultVersion: boolean;
};

type StoredSharePermission = {
  resourceShareArn: string;
  permissionArn: string;
  defaultVersion: boolean;
  status: string;
  resourceType: string;
  permissionVersion: string;
};

type StoredReplaceWork = {
  id: string;
  fromPermissionArn: string;
  fromPermissionVersion: string;
  toPermissionArn: string;
  toPermissionVersion: string;
  status: string;
  statusMessage: string;
  creationTime: number;
  lastUpdatedTime: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidParameterException", `${field} is required.`, 400);
  }
  return value;
};

const versionString = (value: unknown): string | undefined => {
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number") return String(value);
  return undefined;
};

const requireVersion = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = versionString(input[field]);
  if (value === undefined) {
    throw awsError("InvalidParameterException", `${field} is required.`, 400);
  }
  return value;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const shareKey = (arn: string): string => `${sharePrefix}${arn}`;

const assocKey = (shareArn: string, type: string, entity: string): string =>
  `${assocPrefix}${shareArn}|${type}|${entity}`;

const invKey = (arn: string): string => `${invPrefix}${arn}`;

const permKey = (arn: string): string => `${permPrefix}${arn}`;

const permVerKey = (arn: string, version: string): string =>
  `${permVerPrefix}${arn}|${version}`;

const sharePermKey = (shareArn: string, permArn: string): string =>
  `${sharePermPrefix}${shareArn}|${permArn}`;

const workKey = (id: string): string => `${workPrefix}${id}`;

const shareArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:ram:${ctx.region}:${ctx.account}:resource-share/${id}`;

const permArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:ram::${ctx.account}:permission/${name}`;

const invArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:ram:${ctx.region}:${ctx.account}:resource-share-invitation/${id}`;

const randomId = (): string =>
  `${Date.now().toString(16)}-${Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0")}`;

const shareView = (share: StoredShare): Record<string, unknown> => ({
  resourceShareArn: share.resourceShareArn,
  name: share.name,
  owningAccountId: share.owningAccountId,
  allowExternalPrincipals: share.allowExternalPrincipals,
  status: share.status,
  featureSet: share.featureSet,
  creationTime: share.creationTime,
  lastUpdatedTime: share.lastUpdatedTime,
  tags: share.tags,
});

const assocView = (a: StoredAssociation): Record<string, unknown> => ({
  resourceShareArn: a.resourceShareArn,
  resourceShareName: a.resourceShareName,
  associatedEntity: a.associatedEntity,
  associationType: a.associationType,
  status: a.status,
  statusMessage: a.statusMessage,
  creationTime: a.creationTime,
  lastUpdatedTime: a.lastUpdatedTime,
  external: a.external,
});

const invView = (inv: StoredInvitation): Record<string, unknown> => ({
  resourceShareInvitationArn: inv.resourceShareInvitationArn,
  resourceShareName: inv.resourceShareName,
  resourceShareArn: inv.resourceShareArn,
  senderAccountId: inv.senderAccountId,
  receiverAccountId: inv.receiverAccountId,
  invitationTimestamp: inv.invitationTimestamp,
  status: inv.status,
});

const permSummaryView = (
  p: StoredPermission,
  version: string,
  defaultVersion: boolean,
): Record<string, unknown> => ({
  arn: p.arn,
  version,
  defaultVersion,
  name: p.name,
  resourceType: p.resourceType,
  status: p.status,
  creationTime: p.creationTime,
  lastUpdatedTime: p.lastUpdatedTime,
  isResourceTypeDefault: p.isResourceTypeDefault,
  permissionType: p.permissionType,
  featureSet: p.featureSet,
  tags: p.tags,
});

const permDetailView = (
  p: StoredPermission,
  pv: StoredPermissionVersion,
): Record<string, unknown> => ({
  arn: p.arn,
  version: pv.version,
  defaultVersion: pv.defaultVersion,
  name: p.name,
  resourceType: p.resourceType,
  permission: pv.policyTemplate,
  creationTime: pv.creationTime,
  lastUpdatedTime: pv.lastUpdatedTime,
  isResourceTypeDefault: p.isResourceTypeDefault,
  permissionType: p.permissionType,
  featureSet: p.featureSet,
  status: pv.defaultVersion ? p.status : "UNATTACHABLE",
  tags: p.tags,
});

const workView = (w: StoredReplaceWork): Record<string, unknown> => ({
  id: w.id,
  fromPermissionArn: w.fromPermissionArn,
  fromPermissionVersion: w.fromPermissionVersion,
  toPermissionArn: w.toPermissionArn,
  toPermissionVersion: w.toPermissionVersion,
  status: w.status,
  statusMessage: w.statusMessage,
  creationTime: w.creationTime,
  lastUpdatedTime: w.lastUpdatedTime,
});

const getShare = (ctx: ServiceContext, arn: string): StoredShare => {
  const share = ctx.store.get<StoredShare>(shareKey(arn));
  if (share === undefined) {
    throw awsError(
      "UnknownResourceException",
      `Resource share ${arn} not found.`,
      400,
    );
  }
  return share;
};

const getPermission = (ctx: ServiceContext, arn: string): StoredPermission => {
  const perm = ctx.store.get<StoredPermission>(permKey(arn));
  if (perm === undefined) {
    throw awsError(
      "UnknownResourceException",
      `Permission ${arn} not found.`,
      400,
    );
  }
  return perm;
};

const getPermissionVersion = (
  ctx: ServiceContext,
  arn: string,
  version: string,
): StoredPermissionVersion => {
  const pv = ctx.store.get<StoredPermissionVersion>(permVerKey(arn, version));
  if (pv === undefined) {
    throw awsError(
      "UnknownResourceException",
      `Permission version ${arn}:${version} not found.`,
      400,
    );
  }
  return pv;
};

const getInvitation = (ctx: ServiceContext, arn: string): StoredInvitation => {
  const inv = ctx.store.get<StoredInvitation>(invKey(arn));
  if (inv === undefined) {
    throw awsError(
      "ResourceShareInvitationArnNotFoundException",
      `Invitation ${arn} not found.`,
      400,
    );
  }
  return inv;
};

const allShares = (ctx: ServiceContext): StoredShare[] =>
  ctx.store
    .list<StoredShare>()
    .filter((e) => e.key.startsWith(sharePrefix))
    .map((e) => e.value);

const allAssociations = (ctx: ServiceContext): StoredAssociation[] =>
  ctx.store
    .list<StoredAssociation>()
    .filter((e) => e.key.startsWith(assocPrefix))
    .map((e) => e.value);

const allInvitations = (ctx: ServiceContext): StoredInvitation[] =>
  ctx.store
    .list<StoredInvitation>()
    .filter((e) => e.key.startsWith(invPrefix))
    .map((e) => e.value);

const allPermissions = (ctx: ServiceContext): StoredPermission[] =>
  ctx.store
    .list<StoredPermission>()
    .filter((e) => e.key.startsWith(permPrefix))
    .map((e) => e.value);

const allPermissionVersions = (
  ctx: ServiceContext,
): StoredPermissionVersion[] =>
  ctx.store
    .list<StoredPermissionVersion>()
    .filter((e) => e.key.startsWith(permVerPrefix))
    .map((e) => e.value);

const allSharePermissions = (ctx: ServiceContext): StoredSharePermission[] =>
  ctx.store
    .list<StoredSharePermission>()
    .filter((e) => e.key.startsWith(sharePermPrefix))
    .map((e) => e.value);

const allWorks = (ctx: ServiceContext): StoredReplaceWork[] =>
  ctx.store
    .list<StoredReplaceWork>()
    .filter((e) => e.key.startsWith(workPrefix))
    .map((e) => e.value);

const strArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

const decodeToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") return 0;
  const n = parseInt(token, 10);
  return isNaN(n) ? 0 : n;
};

const encodeToken = (offset: number): string => String(offset);

const paginate = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
): { page: T[]; nextToken: string | undefined } => {
  const offset = decodeToken(nextToken);
  const limit =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : 500;
  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  return {
    page,
    nextToken: nextOffset < items.length ? encodeToken(nextOffset) : undefined,
  };
};

const requireResourceOwner = (input: Record<string, unknown>): string => {
  const val = stringOrUndefined(input["resourceOwner"]);
  if (val === undefined) {
    throw awsError(
      "InvalidParameterException",
      "resourceOwner is required.",
      400,
    );
  }
  if (val !== "SELF" && val !== "OTHER-ACCOUNTS") {
    throw awsError(
      "InvalidParameterException",
      "resourceOwner must be SELF or OTHER-ACCOUNTS.",
      400,
    );
  }
  return val;
};

const CreateResourceShare: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const allowExternalPrincipals =
    typeof input["allowExternalPrincipals"] === "boolean"
      ? (input["allowExternalPrincipals"] as boolean)
      : true;
  const tags = Array.isArray(input["tags"])
    ? (input["tags"] as unknown[]).filter(
        (t): t is { key: string; value: string } =>
          typeof t === "object" &&
          t !== null &&
          typeof (t as Record<string, unknown>)["key"] === "string" &&
          typeof (t as Record<string, unknown>)["value"] === "string",
      )
    : [];
  const arn = shareArn(ctx, randomId());
  const now = nowSeconds();
  const share: StoredShare = {
    resourceShareArn: arn,
    name,
    owningAccountId: ctx.account,
    allowExternalPrincipals,
    status: "ACTIVE",
    featureSet: "STANDARD",
    creationTime: now,
    lastUpdatedTime: now,
    tags,
  };
  ctx.store.set(shareKey(arn), share);
  const resourceArns = strArray(input["resourceArns"]);
  const principals = strArray(input["principals"]);
  for (const rArn of resourceArns) {
    const a: StoredAssociation = {
      resourceShareArn: arn,
      resourceShareName: name,
      associatedEntity: rArn,
      associationType: "RESOURCE",
      status: "ASSOCIATED",
      statusMessage: "",
      creationTime: now,
      lastUpdatedTime: now,
      external: false,
    };
    ctx.store.set(assocKey(arn, "RESOURCE", rArn), a);
  }
  for (const principal of principals) {
    const a: StoredAssociation = {
      resourceShareArn: arn,
      resourceShareName: name,
      associatedEntity: principal,
      associationType: "PRINCIPAL",
      status: "ASSOCIATED",
      statusMessage: "",
      creationTime: now,
      lastUpdatedTime: now,
      external: allowExternalPrincipals,
    };
    ctx.store.set(assocKey(arn, "PRINCIPAL", principal), a);
  }
  return { resourceShare: shareView(share) };
};

const GetResourceShares: OperationHandler = (input, ctx) => {
  const resourceOwner = requireResourceOwner(input);
  const arns = Array.isArray(input["resourceShareArns"])
    ? (input["resourceShareArns"] as unknown[]).filter(
        (item): item is string => typeof item === "string",
      )
    : undefined;
  const name = stringOrUndefined(input["name"]);
  const status = stringOrUndefined(input["resourceShareStatus"]);
  const filterPermArn = stringOrUndefined(input["permissionArn"]);
  const filterPermVersion = versionString(input["permissionVersion"]);
  const rawTagFilters = Array.isArray(input["tagFilters"])
    ? (input["tagFilters"] as unknown[])
        .filter(
          (f): f is Record<string, unknown> =>
            typeof f === "object" && f !== null,
        )
        .map((f) => ({
          tagKey: typeof f["tagKey"] === "string" ? f["tagKey"] : "",
          tagValues: Array.isArray(f["tagValues"])
            ? (f["tagValues"] as unknown[]).filter(
                (v): v is string => typeof v === "string",
              )
            : [],
        }))
        .filter((f) => f.tagKey !== "")
    : [];
  const permShareArns =
    filterPermArn !== undefined
      ? new Set(
          allSharePermissions(ctx)
            .filter(
              (sp) =>
                sp.permissionArn === filterPermArn &&
                (filterPermVersion === undefined ||
                  sp.permissionVersion === filterPermVersion),
            )
            .map((sp) => sp.resourceShareArn),
        )
      : undefined;
  const shares = allShares(ctx)
    .filter((share) =>
      resourceOwner === "SELF"
        ? share.owningAccountId === ctx.account
        : share.owningAccountId !== ctx.account,
    )
    .filter(
      (share) => arns === undefined || arns.includes(share.resourceShareArn),
    )
    .filter((share) => name === undefined || share.name === name)
    .filter((share) => status === undefined || share.status === status)
    .filter(
      (share) =>
        permShareArns === undefined ||
        permShareArns.has(share.resourceShareArn),
    )
    .filter((share) =>
      rawTagFilters.every((tf) =>
        share.tags.some(
          (t) =>
            t.key === tf.tagKey &&
            (tf.tagValues.length === 0 || tf.tagValues.includes(t.value)),
        ),
      ),
    )
    .sort((a, b) =>
      a.resourceShareArn < b.resourceShareArn
        ? -1
        : a.resourceShareArn > b.resourceShareArn
          ? 1
          : 0,
    );
  const { page, nextToken } = paginate(
    shares,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    resourceShares: page.map(shareView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const UpdateResourceShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceShareArn");
  const share = getShare(ctx, arn);
  const name = stringOrUndefined(input["name"]);
  const allowExternalPrincipals =
    typeof input["allowExternalPrincipals"] === "boolean"
      ? (input["allowExternalPrincipals"] as boolean)
      : undefined;
  const updated: StoredShare = {
    ...share,
    name: name ?? share.name,
    allowExternalPrincipals:
      allowExternalPrincipals ?? share.allowExternalPrincipals,
    lastUpdatedTime: nowSeconds(),
  };
  ctx.store.set(shareKey(arn), updated);
  return { resourceShare: shareView(updated) };
};

const DeleteResourceShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceShareArn");
  getShare(ctx, arn);
  ctx.store.delete(shareKey(arn));
  return { returnValue: true };
};

const AssociateResourceShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceShareArn");
  const share = getShare(ctx, arn);
  const resourceArns = strArray(input["resourceArns"]);
  const principals = strArray(input["principals"]);
  const now = nowSeconds();
  const associations: StoredAssociation[] = [];
  for (const rArn of resourceArns) {
    const existing = ctx.store.get<StoredAssociation>(
      assocKey(arn, "RESOURCE", rArn),
    );
    const a: StoredAssociation = existing ?? {
      resourceShareArn: arn,
      resourceShareName: share.name,
      associatedEntity: rArn,
      associationType: "RESOURCE",
      status: "ASSOCIATED",
      statusMessage: "",
      creationTime: now,
      lastUpdatedTime: now,
      external: false,
    };
    const updated: StoredAssociation = {
      ...a,
      status: "ASSOCIATED",
      lastUpdatedTime: now,
    };
    ctx.store.set(assocKey(arn, "RESOURCE", rArn), updated);
    associations.push(updated);
  }
  for (const principal of principals) {
    const existing = ctx.store.get<StoredAssociation>(
      assocKey(arn, "PRINCIPAL", principal),
    );
    const a: StoredAssociation = existing ?? {
      resourceShareArn: arn,
      resourceShareName: share.name,
      associatedEntity: principal,
      associationType: "PRINCIPAL",
      status: "ASSOCIATED",
      statusMessage: "",
      creationTime: now,
      lastUpdatedTime: now,
      external: share.allowExternalPrincipals,
    };
    const updated: StoredAssociation = {
      ...a,
      status: "ASSOCIATED",
      lastUpdatedTime: now,
    };
    ctx.store.set(assocKey(arn, "PRINCIPAL", principal), updated);
    associations.push(updated);
  }
  return {
    resourceShareAssociations: associations.map((a) => ({
      ...assocView(a),
      status: "ASSOCIATING",
    })),
  };
};

const DisassociateResourceShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceShareArn");
  getShare(ctx, arn);
  const resourceArns = strArray(input["resourceArns"]);
  const principals = strArray(input["principals"]);
  const now = nowSeconds();
  const associations: StoredAssociation[] = [];
  for (const rArn of resourceArns) {
    const existing = ctx.store.get<StoredAssociation>(
      assocKey(arn, "RESOURCE", rArn),
    );
    if (existing !== undefined) {
      const updated: StoredAssociation = {
        ...existing,
        status: "DISASSOCIATED",
        lastUpdatedTime: now,
      };
      ctx.store.set(assocKey(arn, "RESOURCE", rArn), updated);
      associations.push(updated);
    }
  }
  for (const principal of principals) {
    const existing = ctx.store.get<StoredAssociation>(
      assocKey(arn, "PRINCIPAL", principal),
    );
    if (existing !== undefined) {
      const updated: StoredAssociation = {
        ...existing,
        status: "DISASSOCIATED",
        lastUpdatedTime: now,
      };
      ctx.store.set(assocKey(arn, "PRINCIPAL", principal), updated);
      associations.push(updated);
    }
  }
  return {
    resourceShareAssociations: associations.map((a) => ({
      ...assocView(a),
      status: "DISASSOCIATING",
    })),
  };
};

const GetResourceShareAssociations: OperationHandler = (input, ctx) => {
  const associationType = requireString(input, "associationType");
  const shareArns = strArray(input["resourceShareArns"]);
  const resourceArn = stringOrUndefined(input["resourceArn"]);
  const principal = stringOrUndefined(input["principal"]);
  const status = stringOrUndefined(input["associationStatus"]);
  const assocs = allAssociations(ctx)
    .filter((a) => a.associationType === associationType)
    .filter(
      (a) => shareArns.length === 0 || shareArns.includes(a.resourceShareArn),
    )
    .filter(
      (a) => resourceArn === undefined || a.associatedEntity === resourceArn,
    )
    .filter((a) => principal === undefined || a.associatedEntity === principal)
    .filter((a) => status === undefined || a.status === status);
  const { page, nextToken } = paginate(
    assocs,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    resourceShareAssociations: page.map(assocView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const ListResources: OperationHandler = (input, ctx) => {
  const resourceOwner = requireResourceOwner(input);
  const ownedShareArns = new Set(
    allShares(ctx)
      .filter((s) => s.owningAccountId === ctx.account)
      .map((s) => s.resourceShareArn),
  );
  const shareArns = strArray(input["resourceShareArns"]);
  const resourceArns = strArray(input["resourceArns"]);
  const resourceType = stringOrUndefined(input["resourceType"]);
  const assocs = allAssociations(ctx)
    .filter((a) => a.associationType === "RESOURCE")
    .filter((a) =>
      resourceOwner === "SELF"
        ? ownedShareArns.has(a.resourceShareArn)
        : !ownedShareArns.has(a.resourceShareArn),
    )
    .filter(
      (a) => shareArns.length === 0 || shareArns.includes(a.resourceShareArn),
    )
    .filter(
      (a) =>
        resourceArns.length === 0 || resourceArns.includes(a.associatedEntity),
    )
    .filter((a) => {
      if (resourceType === undefined) return true;
      const parts = a.associatedEntity.split(":");
      const service = parts[2] ?? "";
      const typeSegment = (parts[5] ?? "").split("/")[0] ?? "";
      return (
        `${service}:${typeSegment}`.toLowerCase() === resourceType.toLowerCase()
      );
    });
  const resources = assocs.map((a) => ({
    arn: a.associatedEntity,
    type: "",
    resourceShareArn: a.resourceShareArn,
    status: a.status === "ASSOCIATED" ? "AVAILABLE" : "UNAVAILABLE",
    statusMessage: a.statusMessage,
    creationTime: a.creationTime,
    lastUpdatedTime: a.lastUpdatedTime,
    resourceRegionScope: "REGIONAL",
  }));
  const { page, nextToken } = paginate(
    resources,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    resources: page,
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const ListPrincipals: OperationHandler = (input, ctx) => {
  const resourceOwner = requireResourceOwner(input);
  const ownedShareArns = new Set(
    allShares(ctx)
      .filter((s) => s.owningAccountId === ctx.account)
      .map((s) => s.resourceShareArn),
  );
  const shareArns = strArray(input["resourceShareArns"]);
  const principals = strArray(input["principals"]);
  const resourceArn = stringOrUndefined(input["resourceArn"]);
  const assocs = allAssociations(ctx)
    .filter((a) => a.associationType === "PRINCIPAL")
    .filter((a) =>
      resourceOwner === "SELF"
        ? ownedShareArns.has(a.resourceShareArn)
        : !ownedShareArns.has(a.resourceShareArn),
    )
    .filter(
      (a) => shareArns.length === 0 || shareArns.includes(a.resourceShareArn),
    )
    .filter(
      (a) => principals.length === 0 || principals.includes(a.associatedEntity),
    );
  const resourceFilter =
    resourceArn !== undefined
      ? new Set(
          allAssociations(ctx)
            .filter(
              (a) =>
                a.associationType === "RESOURCE" &&
                a.associatedEntity === resourceArn,
            )
            .map((a) => a.resourceShareArn),
        )
      : undefined;
  const filtered =
    resourceFilter !== undefined
      ? assocs.filter((a) => resourceFilter.has(a.resourceShareArn))
      : assocs;
  const result = filtered.map((a) => ({
    id: a.associatedEntity,
    resourceShareArn: a.resourceShareArn,
    creationTime: a.creationTime,
    lastUpdatedTime: a.lastUpdatedTime,
    external: a.external,
  }));
  const { page, nextToken } = paginate(
    result,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    principals: page,
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const ListResourceTypes: OperationHandler = (_input, _ctx) => ({
  resourceTypes: [],
});

const ListSourceAssociations: OperationHandler = (_input, _ctx) => ({
  sourceAssociations: [],
});

const PromoteResourceShareCreatedFromPolicy: OperationHandler = (
  input,
  ctx,
) => {
  const arn = requireString(input, "resourceShareArn");
  const share = getShare(ctx, arn);
  const updated: StoredShare = {
    ...share,
    featureSet: "STANDARD",
    lastUpdatedTime: nowSeconds(),
  };
  ctx.store.set(shareKey(arn), updated);
  return { returnValue: true };
};

const GetResourceShareInvitations: OperationHandler = (input, ctx) => {
  const invArns = strArray(input["resourceShareInvitationArns"]);
  const shareArns = strArray(input["resourceShareArns"]);
  const invs = allInvitations(ctx)
    .filter(
      (i) =>
        invArns.length === 0 || invArns.includes(i.resourceShareInvitationArn),
    )
    .filter(
      (i) => shareArns.length === 0 || shareArns.includes(i.resourceShareArn),
    );
  return { resourceShareInvitations: invs.map(invView) };
};

const AcceptResourceShareInvitation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceShareInvitationArn");
  const inv = getInvitation(ctx, arn);
  if (inv.status === "ACCEPTED") {
    throw awsError(
      "ResourceShareInvitationAlreadyAcceptedException",
      `Invitation ${arn} already accepted.`,
      400,
    );
  }
  if (inv.status === "REJECTED") {
    throw awsError(
      "ResourceShareInvitationAlreadyRejectedException",
      `Invitation ${arn} already rejected.`,
      400,
    );
  }
  const updated: StoredInvitation = { ...inv, status: "ACCEPTED" };
  ctx.store.set(invKey(arn), updated);
  return { resourceShareInvitation: invView(updated) };
};

const RejectResourceShareInvitation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceShareInvitationArn");
  const inv = getInvitation(ctx, arn);
  if (inv.status === "ACCEPTED") {
    throw awsError(
      "ResourceShareInvitationAlreadyAcceptedException",
      `Invitation ${arn} already accepted.`,
      400,
    );
  }
  if (inv.status === "REJECTED") {
    throw awsError(
      "ResourceShareInvitationAlreadyRejectedException",
      `Invitation ${arn} already rejected.`,
      400,
    );
  }
  const updated: StoredInvitation = { ...inv, status: "REJECTED" };
  ctx.store.set(invKey(arn), updated);
  return { resourceShareInvitation: invView(updated) };
};

const ListPendingInvitationResources: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceShareInvitationArn");
  const inv = getInvitation(ctx, arn);
  if (inv.status !== "PENDING") {
    throw awsError(
      "ResourceShareInvitationAlreadyAcceptedException",
      `Invitation ${arn} is not pending.`,
      400,
    );
  }
  const shareAssocs = allAssociations(ctx).filter(
    (a) =>
      a.resourceShareArn === inv.resourceShareArn &&
      a.associationType === "RESOURCE",
  );
  const resources = shareAssocs.map((a) => ({
    arn: a.associatedEntity,
    type: "",
    resourceShareArn: a.resourceShareArn,
    status: "AVAILABLE",
    statusMessage: "",
    creationTime: a.creationTime,
    lastUpdatedTime: a.lastUpdatedTime,
    resourceRegionScope: "REGIONAL",
  }));
  return { resources };
};

const CreatePermission: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const resourceType = requireString(input, "resourceType");
  const policyTemplate = stringOrUndefined(input["policyTemplate"]) ?? "{}";
  const tags = Array.isArray(input["tags"])
    ? (input["tags"] as unknown[]).filter(
        (t): t is { key: string; value: string } =>
          typeof t === "object" &&
          t !== null &&
          typeof (t as Record<string, unknown>)["key"] === "string" &&
          typeof (t as Record<string, unknown>)["value"] === "string",
      )
    : [];
  const arn = permArn(ctx, name);
  const now = nowSeconds();
  const perm: StoredPermission = {
    arn,
    name,
    resourceType,
    defaultVersionNumber: 1,
    latestVersionNumber: 1,
    permissionType: "CUSTOMER_MANAGED",
    featureSet: "STANDARD",
    status: "ATTACHABLE",
    isResourceTypeDefault: false,
    creationTime: now,
    lastUpdatedTime: now,
    tags,
  };
  ctx.store.set(permKey(arn), perm);
  const pv: StoredPermissionVersion = {
    permissionArn: arn,
    version: "1",
    policyTemplate,
    creationTime: now,
    lastUpdatedTime: now,
    defaultVersion: true,
  };
  ctx.store.set(permVerKey(arn, "1"), pv);
  return {
    permission: permSummaryView(perm, "1", true),
  };
};

const CreatePermissionVersion: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "permissionArn");
  const perm = getPermission(ctx, arn);
  const policyTemplate = stringOrUndefined(input["policyTemplate"]) ?? "{}";
  const newVersion = String(perm.latestVersionNumber + 1);
  const now = nowSeconds();
  const pv: StoredPermissionVersion = {
    permissionArn: arn,
    version: newVersion,
    policyTemplate,
    creationTime: now,
    lastUpdatedTime: now,
    defaultVersion: false,
  };
  ctx.store.set(permVerKey(arn, newVersion), pv);
  const updated: StoredPermission = {
    ...perm,
    latestVersionNumber: perm.latestVersionNumber + 1,
    lastUpdatedTime: now,
  };
  ctx.store.set(permKey(arn), updated);
  return {
    permission: permSummaryView(updated, newVersion, false),
  };
};

const DeletePermission: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "permissionArn");
  const perm = getPermission(ctx, arn);
  const versions = allPermissionVersions(ctx).filter(
    (pv) => pv.permissionArn === arn,
  );
  for (const pv of versions) {
    ctx.store.delete(permVerKey(arn, pv.version));
  }
  ctx.store.delete(permKey(arn));
  const attachedShares = allSharePermissions(ctx).filter(
    (sp) => sp.permissionArn === arn,
  );
  for (const sp of attachedShares) {
    ctx.store.delete(sharePermKey(sp.resourceShareArn, arn));
  }
  void perm;
  return { returnValue: true, permissionStatus: "DELETED" };
};

const DeletePermissionVersion: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "permissionArn");
  const versionStr = requireVersion(input, "permissionVersion");
  getPermission(ctx, arn);
  getPermissionVersion(ctx, arn, versionStr);
  ctx.store.delete(permVerKey(arn, versionStr));
  return { returnValue: true, permissionStatus: "DELETED" };
};

const GetPermission: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "permissionArn");
  const perm = getPermission(ctx, arn);
  const versionStr =
    versionString(input["permissionVersion"]) ??
    String(perm.defaultVersionNumber);
  const pv = getPermissionVersion(ctx, arn, versionStr);
  return { permission: permDetailView(perm, pv) };
};

const ListPermissions: OperationHandler = (input, ctx) => {
  const resourceType = stringOrUndefined(input["resourceType"]);
  const permissionType = stringOrUndefined(input["permissionType"]);
  const perms = allPermissions(ctx)
    .filter(
      (p) => resourceType === undefined || p.resourceType === resourceType,
    )
    .filter(
      (p) =>
        permissionType === undefined || p.permissionType === permissionType,
    );
  const views = perms.map((p) =>
    permSummaryView(p, String(p.defaultVersionNumber), true),
  );
  return { permissions: views };
};

const ListPermissionVersions: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "permissionArn");
  getPermission(ctx, arn);
  const versions = allPermissionVersions(ctx)
    .filter((pv) => pv.permissionArn === arn)
    .sort((a, b) => Number(a.version) - Number(b.version));
  const perm = getPermission(ctx, arn);
  const views = versions.map((pv) =>
    permSummaryView(perm, pv.version, pv.defaultVersion),
  );
  return { permissions: views };
};

const ListPermissionAssociations: OperationHandler = (input, ctx) => {
  const filterArn = stringOrUndefined(input["permissionArn"]);
  const filterVersion = versionString(input["permissionVersion"]);
  const filterResourceType = stringOrUndefined(input["resourceType"]);
  const filterFeatureSet = stringOrUndefined(input["featureSet"]);
  const filterDefaultVersion =
    typeof input["defaultVersion"] === "boolean"
      ? (input["defaultVersion"] as boolean)
      : undefined;
  const sps = allSharePermissions(ctx)
    .filter((sp) => filterArn === undefined || sp.permissionArn === filterArn)
    .filter(
      (sp) =>
        filterVersion === undefined || sp.permissionVersion === filterVersion,
    )
    .filter(
      (sp) =>
        filterResourceType === undefined ||
        sp.resourceType === filterResourceType,
    );
  const permArns = [...new Set(sps.map((sp) => sp.permissionArn))];
  const perms = permArns
    .map((a) => ctx.store.get<StoredPermission>(permKey(a)))
    .filter((p): p is StoredPermission => p !== undefined)
    .filter(
      (p) =>
        filterFeatureSet === undefined || p.featureSet === filterFeatureSet,
    )
    .filter(
      (p) =>
        filterDefaultVersion === undefined ||
        p.defaultVersionNumber > 0 === filterDefaultVersion,
    );
  const views = perms.map((p) =>
    permSummaryView(p, String(p.defaultVersionNumber), true),
  );
  return { permissions: views };
};

const ListResourceSharePermissions: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceShareArn");
  getShare(ctx, arn);
  const sps = allSharePermissions(ctx).filter(
    (sp) => sp.resourceShareArn === arn,
  );
  const views = sps.map((sp) => {
    const perm = ctx.store.get<StoredPermission>(permKey(sp.permissionArn));
    if (perm === undefined) return undefined;
    return permSummaryView(perm, sp.permissionVersion, sp.defaultVersion);
  });
  return { permissions: views.filter((v) => v !== undefined) };
};

const AssociateResourceSharePermission: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceShareArn");
  const pArn = requireString(input, "permissionArn");
  const share = getShare(ctx, arn);
  const perm = getPermission(ctx, pArn);
  const version =
    versionString(input["permissionVersion"]) ??
    String(perm.defaultVersionNumber);
  const sp: StoredSharePermission = {
    resourceShareArn: arn,
    permissionArn: pArn,
    defaultVersion: true,
    status: "ASSOCIATED",
    resourceType: perm.resourceType,
    permissionVersion: version,
  };
  void share;
  ctx.store.set(sharePermKey(arn, pArn), sp);
  return { returnValue: true };
};

const DisassociateResourceSharePermission: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceShareArn");
  const pArn = requireString(input, "permissionArn");
  getShare(ctx, arn);
  ctx.store.delete(sharePermKey(arn, pArn));
  return { returnValue: true };
};

const SetDefaultPermissionVersion: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "permissionArn");
  const versionStr = requireVersion(input, "permissionVersion");
  const perm = getPermission(ctx, arn);
  getPermissionVersion(ctx, arn, versionStr);
  const versions = allPermissionVersions(ctx).filter(
    (pv) => pv.permissionArn === arn,
  );
  for (const pv of versions) {
    const updated: StoredPermissionVersion = {
      ...pv,
      defaultVersion: pv.version === versionStr,
    };
    ctx.store.set(permVerKey(arn, pv.version), updated);
  }
  const updatedPerm: StoredPermission = {
    ...perm,
    defaultVersionNumber: Number(versionStr),
    lastUpdatedTime: nowSeconds(),
  };
  ctx.store.set(permKey(arn), updatedPerm);
  return { returnValue: true };
};

const PromotePermissionCreatedFromPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "permissionArn");
  const name = stringOrUndefined(input["name"]);
  const perm = getPermission(ctx, arn);
  const updated: StoredPermission = {
    ...perm,
    name: name ?? perm.name,
    featureSet: "STANDARD",
    permissionType: "CUSTOMER_MANAGED",
    lastUpdatedTime: nowSeconds(),
  };
  ctx.store.set(permKey(arn), updated);
  return {
    permission: permSummaryView(
      updated,
      String(updated.defaultVersionNumber),
      true,
    ),
  };
};

const ReplacePermissionAssociations: OperationHandler = (input, ctx) => {
  const fromArn = requireString(input, "fromPermissionArn");
  const toArn = requireString(input, "toPermissionArn");
  const fromVersion = versionString(input["fromPermissionVersion"]) ?? "1";
  const fromPerm = getPermission(ctx, fromArn);
  const toPerm = getPermission(ctx, toArn);
  const now = nowSeconds();
  const workId = randomId();
  const work: StoredReplaceWork = {
    id: workId,
    fromPermissionArn: fromArn,
    fromPermissionVersion: fromVersion,
    toPermissionArn: toArn,
    toPermissionVersion: String(toPerm.defaultVersionNumber),
    status: "COMPLETED",
    statusMessage: "",
    creationTime: now,
    lastUpdatedTime: now,
  };
  ctx.store.set(workKey(workId), work);
  const affectedShares = allSharePermissions(ctx).filter(
    (sp) =>
      sp.permissionArn === fromArn && sp.permissionVersion === fromVersion,
  );
  for (const sp of affectedShares) {
    ctx.store.delete(sharePermKey(sp.resourceShareArn, fromArn));
    const newSp: StoredSharePermission = {
      resourceShareArn: sp.resourceShareArn,
      permissionArn: toArn,
      defaultVersion: true,
      status: "ASSOCIATED",
      resourceType: toPerm.resourceType,
      permissionVersion: String(toPerm.defaultVersionNumber),
    };
    ctx.store.set(sharePermKey(sp.resourceShareArn, toArn), newSp);
  }
  void fromPerm;
  return {
    replacePermissionAssociationsWork: {
      ...workView(work),
      status: "IN_PROGRESS",
    },
  };
};

const ListReplacePermissionAssociationsWork: OperationHandler = (
  input,
  ctx,
) => {
  const workIds = strArray(input["workIds"]);
  const status = stringOrUndefined(input["status"]);
  const works = allWorks(ctx)
    .filter((w) => workIds.length === 0 || workIds.includes(w.id))
    .filter((w) => status === undefined || w.status === status);
  return { replacePermissionAssociationsWorks: works.map(workView) };
};

const GetResourcePolicies: OperationHandler = (_input, _ctx) => ({
  policies: [],
});

const EnableSharingWithAwsOrganization: OperationHandler = (_input, _ctx) => ({
  returnValue: true,
});

const TagResource: OperationHandler = (input, ctx) => {
  const arn =
    stringOrUndefined(input["resourceShareArn"]) ??
    stringOrUndefined(input["resourceArn"]);
  if (arn === undefined) {
    throw awsError(
      "InvalidParameterException",
      "resourceShareArn is required.",
      400,
    );
  }
  const share = ctx.store.get<StoredShare>(shareKey(arn));
  if (share === undefined) {
    throw awsError(
      "UnknownResourceException",
      `Resource ${arn} not found.`,
      400,
    );
  }
  const newTags = Array.isArray(input["tags"])
    ? (input["tags"] as unknown[]).filter(
        (t): t is { key: string; value: string } =>
          typeof t === "object" &&
          t !== null &&
          typeof (t as Record<string, unknown>)["key"] === "string" &&
          typeof (t as Record<string, unknown>)["value"] === "string",
      )
    : [];
  const existingKeys = new Set(newTags.map((t) => t.key));
  const merged = [
    ...share.tags.filter((t) => !existingKeys.has(t.key)),
    ...newTags,
  ];
  const updated: StoredShare = {
    ...share,
    tags: merged,
    lastUpdatedTime: nowSeconds(),
  };
  ctx.store.set(shareKey(arn), updated);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn =
    stringOrUndefined(input["resourceShareArn"]) ??
    stringOrUndefined(input["resourceArn"]);
  if (arn === undefined) {
    throw awsError(
      "InvalidParameterException",
      "resourceShareArn is required.",
      400,
    );
  }
  const share = ctx.store.get<StoredShare>(shareKey(arn));
  if (share === undefined) {
    throw awsError(
      "UnknownResourceException",
      `Resource ${arn} not found.`,
      400,
    );
  }
  const tagKeys = strArray(input["tagKeys"]);
  const keySet = new Set(tagKeys);
  const updated: StoredShare = {
    ...share,
    tags: share.tags.filter((t) => !keySet.has(t.key)),
    lastUpdatedTime: nowSeconds(),
  };
  ctx.store.set(shareKey(arn), updated);
  return {};
};

const ram = {
  name: "ram",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const path = req.path.replace(/\/+$/, "").toLowerCase();
    if (req.method === "POST" && path === "/createresourceshare")
      return "CreateResourceShare";
    if (req.method === "POST" && path === "/getresourceshares")
      return "GetResourceShares";
    if (req.method === "POST" && path === "/updateresourceshare")
      return "UpdateResourceShare";
    if (req.method === "DELETE" && path === "/deleteresourceshare")
      return "DeleteResourceShare";
    if (req.method === "POST" && path === "/associateresourceshare")
      return "AssociateResourceShare";
    if (req.method === "POST" && path === "/disassociateresourceshare")
      return "DisassociateResourceShare";
    if (req.method === "POST" && path === "/getresourceshareassociations")
      return "GetResourceShareAssociations";
    if (req.method === "POST" && path === "/listresources")
      return "ListResources";
    if (req.method === "POST" && path === "/listprincipals")
      return "ListPrincipals";
    if (req.method === "POST" && path === "/listresourcetypes")
      return "ListResourceTypes";
    if (req.method === "POST" && path === "/listsourceassociations")
      return "ListSourceAssociations";
    if (
      req.method === "POST" &&
      path === "/promoteresourcesharecreatedfrompolicy"
    )
      return "PromoteResourceShareCreatedFromPolicy";
    if (req.method === "POST" && path === "/getresourceshareinvitations")
      return "GetResourceShareInvitations";
    if (req.method === "POST" && path === "/acceptresourceshareinvitation")
      return "AcceptResourceShareInvitation";
    if (req.method === "POST" && path === "/rejectresourceshareinvitation")
      return "RejectResourceShareInvitation";
    if (req.method === "POST" && path === "/listpendinginvitationresources")
      return "ListPendingInvitationResources";
    if (req.method === "POST" && path === "/createpermission")
      return "CreatePermission";
    if (req.method === "POST" && path === "/createpermissionversion")
      return "CreatePermissionVersion";
    if (req.method === "DELETE" && path === "/deletepermission")
      return "DeletePermission";
    if (req.method === "DELETE" && path === "/deletepermissionversion")
      return "DeletePermissionVersion";
    if (req.method === "POST" && path === "/getpermission")
      return "GetPermission";
    if (req.method === "POST" && path === "/listpermissions")
      return "ListPermissions";
    if (req.method === "POST" && path === "/listpermissionversions")
      return "ListPermissionVersions";
    if (req.method === "POST" && path === "/listpermissionassociations")
      return "ListPermissionAssociations";
    if (req.method === "POST" && path === "/listresourcesharepermissions")
      return "ListResourceSharePermissions";
    if (req.method === "POST" && path === "/associateresourcesharepermission")
      return "AssociateResourceSharePermission";
    if (
      req.method === "POST" &&
      path === "/disassociateresourcesharepermission"
    )
      return "DisassociateResourceSharePermission";
    if (req.method === "POST" && path === "/setdefaultpermissionversion")
      return "SetDefaultPermissionVersion";
    if (req.method === "POST" && path === "/promotepermissioncreatedfrompolicy")
      return "PromotePermissionCreatedFromPolicy";
    if (req.method === "POST" && path === "/replacepermissionassociations")
      return "ReplacePermissionAssociations";
    if (
      req.method === "POST" &&
      path === "/listreplacepermissionassociationswork"
    )
      return "ListReplacePermissionAssociationsWork";
    if (req.method === "POST" && path === "/getresourcepolicies")
      return "GetResourcePolicies";
    if (req.method === "POST" && path === "/enablesharingwithawsorganization")
      return "EnableSharingWithAwsOrganization";
    if (req.method === "POST" && path === "/tagresource") return "TagResource";
    if (req.method === "POST" && path === "/untagresource")
      return "UntagResource";
    return undefined;
  },
  operations: {
    CreateResourceShare,
    GetResourceShares,
    UpdateResourceShare,
    DeleteResourceShare,
    AssociateResourceShare,
    DisassociateResourceShare,
    GetResourceShareAssociations,
    ListResources,
    ListPrincipals,
    ListResourceTypes,
    ListSourceAssociations,
    PromoteResourceShareCreatedFromPolicy,
    GetResourceShareInvitations,
    AcceptResourceShareInvitation,
    RejectResourceShareInvitation,
    ListPendingInvitationResources,
    CreatePermission,
    CreatePermissionVersion,
    DeletePermission,
    DeletePermissionVersion,
    GetPermission,
    ListPermissions,
    ListPermissionVersions,
    ListPermissionAssociations,
    ListResourceSharePermissions,
    AssociateResourceSharePermission,
    DisassociateResourceSharePermission,
    SetDefaultPermissionVersion,
    PromotePermissionCreatedFromPolicy,
    ReplacePermissionAssociations,
    ListReplacePermissionAssociationsWork,
    GetResourcePolicies,
    EnableSharingWithAwsOrganization,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default ram;
