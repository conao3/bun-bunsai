import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import iotModel from "../../../../test/vendor/aws-models/iot.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(iotModel);

const thingKey = (name: string) => `thing:${name}`;
const thingTypeKey = (name: string) => `thingType:${name}`;
const thingGroupKey = (name: string) => `thingGroup:${name}`;
const certKey = (id: string) => `cert:${id}`;
const policyKey = (name: string) => `policy:${name}`;
const topicRuleKey = (name: string) => `rule:${name}`;
const tagsKey = (arn: string) => `tags:${arn}`;
const thingGroupMembersKey = (groupName: string) =>
  `thingGroupMembers:${groupName}`;
const thingGroupsForThingKey = (thingName: string) =>
  `thingGroupsForThing:${thingName}`;
const policyAttachmentsKey = (policyName: string) =>
  `policyAttach:${policyName}`;
const principalPoliciesKey = (principal: string) =>
  `principalPolicies:${principal}`;
const thingPrincipalsKey = (thingName: string) =>
  `thingPrincipals:${thingName}`;
const principalThingsKey = (principal: string) =>
  `principalThings:${principal}`;
const policyVersionKey = (policyName: string, versionId: string) =>
  `policyVersion:${policyName}:${versionId}`;
const policyVersionsKey = (policyName: string) =>
  `policyVersions:${policyName}`;
const allThingsKey = "allThings";
const allThingTypesKey = "allThingTypes";
const allThingGroupsKey = "allThingGroups";
const allCertsKey = "allCerts";
const allPoliciesKey = "allPolicies";
const allRulesKey = "allRules";

type StoredThing = {
  thingName: string;
  thingArn: string;
  thingId: string;
  thingTypeName?: string;
  attributes: Record<string, string>;
  version: number;
  createdAt: number;
};

type StoredThingType = {
  thingTypeName: string;
  thingTypeArn: string;
  thingTypeId: string;
  thingTypeDescription?: string;
  deprecated: boolean;
  deprecationDate?: number;
  createdAt: number;
};

type StoredThingGroup = {
  thingGroupName: string;
  thingGroupArn: string;
  thingGroupId: string;
  thingGroupDescription?: string;
  parentGroupName?: string;
  version: number;
  createdAt: number;
};

type StoredCertificate = {
  certificateId: string;
  certificateArn: string;
  certificatePem: string;
  publicKey: string;
  privateKey: string;
  status: string;
  createdAt: number;
};

type StoredPolicy = {
  policyName: string;
  policyArn: string;
  policyDocument: string;
  defaultVersionId: string;
  createdAt: number;
  lastModifiedDate: number;
};

type StoredTopicRule = {
  ruleName: string;
  ruleArn: string;
  topicRulePayload: unknown;
  enabled: boolean;
  createdAt: number;
};

type StoredPolicyVersion = {
  policyVersionId: string;
  policyDocument: string;
  isDefaultVersion: boolean;
  createdAt: number;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const thingArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:thing/${name}`;
const thingTypeArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:thingtype/${name}`;
const thingGroupArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:thinggroup/${name}`;
const certArn = (ctx: ServiceContext, id: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:cert/${id}`;
const policyArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:policy/${name}`;
const ruleArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:rule/${name}`;

const pemOf = (id: string): string =>
  `-----BEGIN CERTIFICATE-----\n${Buffer.from(id, "utf8").toString("base64")}\n-----END CERTIFICATE-----`;
const privateKeyOf = (id: string): string =>
  `-----BEGIN RSA PRIVATE KEY-----\n${Buffer.from(`key:${id}`, "utf8").toString("base64")}\n-----END RSA PRIVATE KEY-----`;
const publicKeyOf = (id: string): string =>
  `-----BEGIN PUBLIC KEY-----\n${Buffer.from(`pub:${id}`, "utf8").toString("base64")}\n-----END PUBLIC KEY-----`;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

const requireStr = (data: Record<string, unknown>, field: string): string => {
  const v = str(data[field]);
  if (v === undefined)
    throw awsError("InvalidRequestException", `${field} is required.`, 400);
  return v;
};

const requireThing = (ctx: ServiceContext, name: string): StoredThing => {
  const stored = ctx.store.get<StoredThing>(thingKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Thing ${name} not found.`,
      404,
    );
  return stored;
};

const requireThingType = (
  ctx: ServiceContext,
  name: string,
): StoredThingType => {
  const stored = ctx.store.get<StoredThingType>(thingTypeKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `ThingType ${name} not found.`,
      404,
    );
  return stored;
};

const requireThingGroup = (
  ctx: ServiceContext,
  name: string,
): StoredThingGroup => {
  const stored = ctx.store.get<StoredThingGroup>(thingGroupKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `ThingGroup ${name} not found.`,
      404,
    );
  return stored;
};

const requireCert = (ctx: ServiceContext, id: string): StoredCertificate => {
  const stored = ctx.store.get<StoredCertificate>(certKey(id));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Certificate ${id} not found.`,
      404,
    );
  return stored;
};

const requirePolicy = (ctx: ServiceContext, name: string): StoredPolicy => {
  const stored = ctx.store.get<StoredPolicy>(policyKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Policy ${name} not found.`,
      404,
    );
  return stored;
};

const requireRule = (ctx: ServiceContext, name: string): StoredTopicRule => {
  const stored = ctx.store.get<StoredTopicRule>(topicRuleKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `TopicRule ${name} not found.`,
      404,
    );
  return stored;
};

const getList = <T>(ctx: ServiceContext, key: string): T[] =>
  ctx.store.get<T[]>(key) ?? [];

const addToList = <T>(ctx: ServiceContext, key: string, item: T): void => {
  const list = getList<T>(ctx, key);
  ctx.store.set(key, [...list, item]);
};

const removeFromList = <T>(
  ctx: ServiceContext,
  key: string,
  pred: (item: T) => boolean,
): void => {
  const list = getList<T>(ctx, key);
  ctx.store.set(
    key,
    list.filter((item) => !pred(item)),
  );
};

const certIdFromArn = (arn: string): string => {
  const parts = arn.split("/");
  return parts[parts.length - 1] ?? arn;
};

const paginateList = <T>(
  items: T[],
  marker?: string,
  pageSize = 250,
): { items: T[]; nextMarker?: string } => {
  const start = marker
    ? parseInt(Buffer.from(marker, "base64").toString(), 10)
    : 0;
  const page = items.slice(start, start + pageSize);
  const nextMarker =
    start + pageSize < items.length
      ? Buffer.from(String(start + pageSize)).toString("base64")
      : undefined;
  return { items: page, nextMarker };
};

// === Thing operations ===

const CreateThing: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  if (ctx.store.get(thingKey(thingName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Thing ${thingName} already exists.`,
      409,
    );
  }
  const thingId = crypto.randomUUID();
  const arn = thingArn(ctx, thingName);
  const thingTypeName = str(data["thingTypeName"]);
  if (thingTypeName) requireThingType(ctx, thingTypeName);
  const stored: StoredThing = {
    thingName,
    thingArn: arn,
    thingId,
    thingTypeName,
    attributes:
      ((data["attributePayload"] as Record<string, unknown>)
        ?.attributes as Record<string, string>) ?? {},
    version: 1,
    createdAt: nowSeconds(),
  };
  ctx.store.set(thingKey(thingName), stored);
  addToList(ctx, allThingsKey, thingName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { thingName, thingArn: arn, thingId };
};

const DescribeThing: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  const stored = requireThing(ctx, thingName);
  return {
    thingName: stored.thingName,
    thingArn: stored.thingArn,
    thingId: stored.thingId,
    thingTypeName: stored.thingTypeName,
    attributes: stored.attributes,
    version: stored.version,
  };
};

const UpdateThing: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  const stored = requireThing(ctx, thingName);
  const expectedVersion = data["expectedVersion"];
  if (
    expectedVersion !== undefined &&
    Number(expectedVersion) !== stored.version
  ) {
    throw awsError(
      "VersionConflictException",
      `Version conflict for thing ${thingName}.`,
      409,
    );
  }
  const removeThingType = data["removeThingType"] === true;
  const thingTypeName = removeThingType
    ? undefined
    : (str(data["thingTypeName"]) ?? stored.thingTypeName);
  const attributePayload = data["attributePayload"] as
    | Record<string, unknown>
    | undefined;
  let attributes = { ...stored.attributes };
  if (attributePayload) {
    const newAttrs =
      (attributePayload["attributes"] as Record<string, string> | undefined) ??
      {};
    if (attributePayload["merge"] === true) {
      attributes = { ...attributes, ...newAttrs };
    } else {
      attributes = newAttrs;
    }
  }
  ctx.store.set(thingKey(thingName), {
    ...stored,
    thingTypeName,
    attributes,
    version: stored.version + 1,
  });
  return {};
};

const DeleteThing: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  const stored = requireThing(ctx, thingName);
  const expectedVersion = data["expectedVersion"];
  if (
    expectedVersion !== undefined &&
    Number(expectedVersion) !== stored.version
  ) {
    throw awsError(
      "VersionConflictException",
      `Version conflict for thing ${thingName}.`,
      409,
    );
  }
  const principals = getList<string>(ctx, thingPrincipalsKey(thingName));
  if (principals.length > 0) {
    throw awsError(
      "InvalidRequestException",
      `Cannot delete. Thing ${thingName} is still attached to one or more principals.`,
      400,
    );
  }
  const groups = getList<string>(ctx, thingGroupsForThingKey(thingName));
  for (const groupName of groups) {
    removeFromList<string>(
      ctx,
      thingGroupMembersKey(groupName),
      (n) => n === thingName,
    );
  }
  ctx.store.set(thingGroupsForThingKey(thingName), undefined);
  ctx.store.set(thingPrincipalsKey(thingName), undefined);
  ctx.store.set(tagsKey(stored.thingArn), undefined);
  ctx.store.set(thingKey(thingName), undefined);
  removeFromList<string>(ctx, allThingsKey, (n) => n === thingName);
  return {};
};

const ListThings: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]) ?? str(data["marker"]);
  const maxResults =
    typeof data["maxResults"] === "number"
      ? Math.min(data["maxResults"], 250)
      : undefined;
  const filterTypeName = str(data["thingTypeName"]);
  const attributeName = str(data["attributeName"]);
  const attributeValue = str(data["attributeValue"]);
  const usePrefixAttributeValue = data["usePrefixAttributeValue"] === true;
  let allNames = getList<string>(ctx, allThingsKey);
  if (filterTypeName || attributeName) {
    allNames = allNames.filter((n) => {
      const t = ctx.store.get<StoredThing>(thingKey(n));
      if (!t) return false;
      if (filterTypeName && t.thingTypeName !== filterTypeName) return false;
      if (attributeName && attributeValue !== undefined) {
        const val = t.attributes[attributeName];
        if (usePrefixAttributeValue) {
          if (!val?.startsWith(attributeValue)) return false;
        } else {
          if (val !== attributeValue) return false;
        }
      }
      return true;
    });
  }
  const { items: names, nextMarker } = paginateList(
    allNames,
    marker,
    maxResults,
  );
  const things = names
    .map((n) => ctx.store.get<StoredThing>(thingKey(n)))
    .filter(Boolean)
    .map((t) => ({
      thingName: t!.thingName,
      thingArn: t!.thingArn,
      thingTypeName: t!.thingTypeName,
      attributes: t!.attributes,
      version: t!.version,
    }));
  return { things, nextToken: nextMarker };
};

const ListThingGroupsForThing: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  requireThing(ctx, thingName);
  const groups = getList<string>(ctx, thingGroupsForThingKey(thingName));
  return {
    thingGroups: groups.map((g) => ({
      groupName: g,
      groupArn: thingGroupArn(ctx, g),
    })),
  };
};

// === ThingType operations ===

const CreateThingType: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingTypeName = requireStr(data, "thingTypeName");
  if (ctx.store.get(thingTypeKey(thingTypeName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `ThingType ${thingTypeName} already exists.`,
      409,
    );
  }
  const thingTypeId = crypto.randomUUID();
  const arn = thingTypeArn(ctx, thingTypeName);
  const props = data["thingTypeProperties"] as
    | Record<string, unknown>
    | undefined;
  const stored: StoredThingType = {
    thingTypeName,
    thingTypeArn: arn,
    thingTypeId,
    thingTypeDescription: str(props?.["thingTypeDescription"]),
    deprecated: false,
    createdAt: nowSeconds(),
  };
  ctx.store.set(thingTypeKey(thingTypeName), stored);
  addToList(ctx, allThingTypesKey, thingTypeName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return {
    thingTypeName,
    thingTypeArn: arn,
    thingTypeId,
  };
};

const DescribeThingType: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingTypeName = requireStr(data, "thingTypeName");
  const stored = requireThingType(ctx, thingTypeName);
  return {
    thingTypeName: stored.thingTypeName,
    thingTypeId: stored.thingTypeId,
    thingTypeArn: stored.thingTypeArn,
    thingTypeProperties: {
      thingTypeDescription: stored.thingTypeDescription,
    },
    thingTypeMetadata: {
      deprecated: stored.deprecated,
      deprecationDate: stored.deprecationDate,
      creationDate: stored.createdAt,
    },
  };
};

const DeleteThingType: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingTypeName = requireStr(data, "thingTypeName");
  const stored = requireThingType(ctx, thingTypeName);
  ctx.store.set(tagsKey(stored.thingTypeArn), undefined);
  ctx.store.set(thingTypeKey(thingTypeName), undefined);
  removeFromList<string>(ctx, allThingTypesKey, (n) => n === thingTypeName);
  return {};
};

const ListThingTypes: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const allNames = getList<string>(ctx, allThingTypesKey);
  const { items: names, nextMarker } = paginateList(allNames, marker);
  const thingTypes = names
    .map((n) => ctx.store.get<StoredThingType>(thingTypeKey(n)))
    .filter(Boolean)
    .map((t) => ({
      thingTypeName: t!.thingTypeName,
      thingTypeArn: t!.thingTypeArn,
      thingTypeProperties: { thingTypeDescription: t!.thingTypeDescription },
      thingTypeMetadata: {
        deprecated: t!.deprecated,
        deprecationDate: t!.deprecationDate,
        creationDate: t!.createdAt,
      },
    }));
  return { thingTypes, nextToken: nextMarker };
};

const DeprecateThingType: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingTypeName = requireStr(data, "thingTypeName");
  const stored = requireThingType(ctx, thingTypeName);
  ctx.store.set(thingTypeKey(thingTypeName), {
    ...stored,
    deprecated: true,
    deprecationDate: nowSeconds(),
  });
  return {};
};

// === ThingGroup operations ===

const CreateThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  if (ctx.store.get(thingGroupKey(thingGroupName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `ThingGroup ${thingGroupName} already exists.`,
      409,
    );
  }
  const thingGroupId = crypto.randomUUID();
  const arn = thingGroupArn(ctx, thingGroupName);
  const props = data["thingGroupProperties"] as
    | Record<string, unknown>
    | undefined;
  const parentGroupName = str(data["parentGroupName"]);
  if (parentGroupName) requireThingGroup(ctx, parentGroupName);
  const stored: StoredThingGroup = {
    thingGroupName,
    thingGroupArn: arn,
    thingGroupId,
    thingGroupDescription: str(props?.["thingGroupDescription"]),
    parentGroupName,
    version: 1,
    createdAt: nowSeconds(),
  };
  ctx.store.set(thingGroupKey(thingGroupName), stored);
  addToList(ctx, allThingGroupsKey, thingGroupName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { thingGroupName, thingGroupArn: arn, thingGroupId };
};

const DescribeThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  const stored = requireThingGroup(ctx, thingGroupName);
  return {
    thingGroupName: stored.thingGroupName,
    thingGroupId: stored.thingGroupId,
    thingGroupArn: stored.thingGroupArn,
    version: stored.version,
    thingGroupProperties: {
      thingGroupDescription: stored.thingGroupDescription,
    },
    thingGroupMetadata: {
      parentGroupName: stored.parentGroupName,
      creationDate: stored.createdAt,
    },
  };
};

const UpdateThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  const stored = requireThingGroup(ctx, thingGroupName);
  const expectedVersion = data["expectedVersion"];
  if (
    expectedVersion !== undefined &&
    Number(expectedVersion) !== stored.version
  ) {
    throw awsError(
      "VersionConflictException",
      `Version conflict for thing group ${thingGroupName}.`,
      409,
    );
  }
  const props = data["thingGroupProperties"] as
    | Record<string, unknown>
    | undefined;
  const updated = {
    ...stored,
    thingGroupDescription:
      str(props?.["thingGroupDescription"]) ?? stored.thingGroupDescription,
    version: stored.version + 1,
  };
  ctx.store.set(thingGroupKey(thingGroupName), updated);
  return { version: updated.version };
};

const DeleteThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  const stored = requireThingGroup(ctx, thingGroupName);
  const expectedVersion = data["expectedVersion"];
  if (
    expectedVersion !== undefined &&
    Number(expectedVersion) !== stored.version
  ) {
    throw awsError(
      "VersionConflictException",
      `Version conflict for thing group ${thingGroupName}.`,
      409,
    );
  }
  const allGroupNames = getList<string>(ctx, allThingGroupsKey);
  for (const gName of allGroupNames) {
    const g = ctx.store.get<StoredThingGroup>(thingGroupKey(gName));
    if (g?.parentGroupName === thingGroupName) {
      throw awsError(
        "InvalidRequestException",
        `ThingGroup ${thingGroupName} has child groups.`,
        400,
      );
    }
  }
  const members = getList<string>(ctx, thingGroupMembersKey(thingGroupName));
  for (const memberName of members) {
    removeFromList<string>(
      ctx,
      thingGroupsForThingKey(memberName),
      (g) => g === thingGroupName,
    );
  }
  ctx.store.set(tagsKey(stored.thingGroupArn), undefined);
  ctx.store.set(thingGroupMembersKey(thingGroupName), undefined);
  ctx.store.set(thingGroupKey(thingGroupName), undefined);
  removeFromList<string>(ctx, allThingGroupsKey, (n) => n === thingGroupName);
  return {};
};

const ListThingGroups: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const maxResults =
    typeof data["maxResults"] === "number"
      ? Math.min(data["maxResults"], 250)
      : undefined;
  const parentGroup = str(data["parentGroup"]);
  const namePrefixFilter = str(data["namePrefixFilter"]);
  let allNames = getList<string>(ctx, allThingGroupsKey);
  if (parentGroup || namePrefixFilter) {
    allNames = allNames.filter((n) => {
      const g = ctx.store.get<StoredThingGroup>(thingGroupKey(n));
      if (!g) return false;
      if (parentGroup && g.parentGroupName !== parentGroup) return false;
      if (namePrefixFilter && !n.startsWith(namePrefixFilter)) return false;
      return true;
    });
  }
  const { items: names, nextMarker } = paginateList(
    allNames,
    marker,
    maxResults,
  );
  const thingGroups = names
    .map((n) => ctx.store.get<StoredThingGroup>(thingGroupKey(n)))
    .filter(Boolean)
    .map((g) => ({
      groupName: g!.thingGroupName,
      groupArn: g!.thingGroupArn,
    }));
  return { thingGroups, nextToken: nextMarker };
};

const AddThingToThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  const thingName = requireStr(data, "thingName");
  requireThingGroup(ctx, thingGroupName);
  requireThing(ctx, thingName);
  const members = getList<string>(ctx, thingGroupMembersKey(thingGroupName));
  if (!members.includes(thingName)) {
    addToList(ctx, thingGroupMembersKey(thingGroupName), thingName);
  }
  const groups = getList<string>(ctx, thingGroupsForThingKey(thingName));
  if (!groups.includes(thingGroupName)) {
    addToList(ctx, thingGroupsForThingKey(thingName), thingGroupName);
  }
  return {};
};

const RemoveThingFromThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  const thingName = requireStr(data, "thingName");
  removeFromList<string>(
    ctx,
    thingGroupMembersKey(thingGroupName),
    (n) => n === thingName,
  );
  removeFromList<string>(
    ctx,
    thingGroupsForThingKey(thingName),
    (n) => n === thingGroupName,
  );
  return {};
};

const ListThingsInThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  requireThingGroup(ctx, thingGroupName);
  const marker = str(data["nextToken"]);
  const allMembers = getList<string>(ctx, thingGroupMembersKey(thingGroupName));
  const { items: members, nextMarker } = paginateList(allMembers, marker);
  return { things: members, nextToken: nextMarker };
};

// === Certificate operations ===

const CreateKeysAndCertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const id = crypto.randomUUID().replace(/-/g, "");
  const arn = certArn(ctx, id);
  const status =
    data["setAsActive"] === true || data["setAsActive"] === "true"
      ? "ACTIVE"
      : "INACTIVE";
  const stored: StoredCertificate = {
    certificateId: id,
    certificateArn: arn,
    certificatePem: pemOf(id),
    publicKey: publicKeyOf(id),
    privateKey: privateKeyOf(id),
    status,
    createdAt: nowSeconds(),
  };
  ctx.store.set(certKey(id), stored);
  addToList(ctx, allCertsKey, id);
  return {
    certificateArn: arn,
    certificateId: id,
    certificatePem: stored.certificatePem,
    keyPair: {
      PublicKey: stored.publicKey,
      PrivateKey: stored.privateKey,
    },
  };
};

const DescribeCertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateId = requireStr(data, "certificateId");
  const stored = requireCert(ctx, certificateId);
  return {
    certificateDescription: {
      certificateArn: stored.certificateArn,
      certificateId: stored.certificateId,
      status: stored.status,
      certificatePem: stored.certificatePem,
      creationDate: stored.createdAt,
      lastModifiedDate: stored.createdAt,
    },
  };
};

const UpdateCertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateId = requireStr(data, "certificateId");
  const newStatus = requireStr(data, "newStatus");
  if (newStatus === "PENDING_TRANSFER" || newStatus === "PENDING_ACTIVATION") {
    throw awsError(
      "CertificateStateException",
      `Setting the status to ${newStatus} is not allowed.`,
      406,
    );
  }
  const stored = requireCert(ctx, certificateId);
  ctx.store.set(certKey(certificateId), { ...stored, status: newStatus });
  return {};
};

const DeleteCertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateId = requireStr(data, "certificateId");
  const forceDelete =
    data["forceDelete"] === true || data["forceDelete"] === "true";
  const stored = requireCert(ctx, certificateId);
  if (stored.status === "ACTIVE") {
    throw awsError(
      "CertificateStateException",
      `Certificate ${certificateId} is in ACTIVE state.`,
      406,
    );
  }
  const arn = certArn(ctx, certificateId);
  const attachedThings = getList<string>(ctx, principalThingsKey(arn));
  if (attachedThings.length > 0) {
    throw awsError(
      "DeleteConflictException",
      `Certificate ${certificateId} is attached to one or more things.`,
      409,
    );
  }
  const attachedPolicies = getList<string>(ctx, principalPoliciesKey(arn));
  if (attachedPolicies.length > 0 && !forceDelete) {
    throw awsError(
      "DeleteConflictException",
      `Certificate ${certificateId} has attached policies.`,
      409,
    );
  }
  for (const policyName of attachedPolicies) {
    removeFromList<string>(
      ctx,
      policyAttachmentsKey(policyName),
      (t) => t === arn,
    );
  }
  ctx.store.set(principalPoliciesKey(arn), undefined);
  ctx.store.set(principalThingsKey(arn), undefined);
  ctx.store.set(certKey(certificateId), undefined);
  removeFromList<string>(ctx, allCertsKey, (id) => id === certificateId);
  return {};
};

const ListCertificates: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["marker"]);
  const allIds = getList<string>(ctx, allCertsKey);
  const { items: ids, nextMarker } = paginateList(allIds, marker);
  const certificates = ids
    .map((id) => ctx.store.get<StoredCertificate>(certKey(id)))
    .filter(Boolean)
    .map((c) => ({
      certificateArn: c!.certificateArn,
      certificateId: c!.certificateId,
      status: c!.status,
      creationDate: c!.createdAt,
    }));
  return { certificates, nextMarker };
};

// === Policy operations ===

const CreatePolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  if (ctx.store.get(policyKey(policyName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Policy ${policyName} already exists.`,
      409,
    );
  }
  const arn = policyArn(ctx, policyName);
  const policyDocument = requireStr(data, "policyDocument");
  const stored: StoredPolicy = {
    policyName,
    policyArn: arn,
    policyDocument,
    defaultVersionId: "1",
    createdAt: nowSeconds(),
    lastModifiedDate: nowSeconds(),
  };
  ctx.store.set(policyKey(policyName), stored);
  addToList(ctx, allPoliciesKey, policyName);
  const v1: StoredPolicyVersion = {
    policyVersionId: "1",
    policyDocument,
    isDefaultVersion: true,
    createdAt: stored.createdAt,
  };
  ctx.store.set(policyVersionKey(policyName, "1"), v1);
  addToList(ctx, policyVersionsKey(policyName), "1");
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return {
    policyName,
    policyArn: arn,
    policyDocument,
    policyVersionId: "1",
  };
};

const GetPolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const stored = requirePolicy(ctx, policyName);
  return {
    policyName: stored.policyName,
    policyArn: stored.policyArn,
    policyDocument: stored.policyDocument,
    defaultVersionId: stored.defaultVersionId,
    creationDate: stored.createdAt,
    lastModifiedDate: stored.lastModifiedDate,
  };
};

const DeletePolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const stored = requirePolicy(ctx, policyName);
  const targets = getList<string>(ctx, policyAttachmentsKey(policyName));
  if (targets.length > 0) {
    throw awsError(
      "DeleteConflictException",
      `Policy ${policyName} is attached to one or more principals.`,
      409,
    );
  }
  const versions = getList<string>(ctx, policyVersionsKey(policyName));
  for (const vId of versions) {
    ctx.store.set(policyVersionKey(policyName, vId), undefined);
  }
  ctx.store.set(policyVersionsKey(policyName), undefined);
  ctx.store.set(tagsKey(stored.policyArn), undefined);
  ctx.store.set(policyKey(policyName), undefined);
  removeFromList<string>(ctx, allPoliciesKey, (n) => n === policyName);
  return {};
};

const ListPolicies: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["marker"]);
  const allNames = getList<string>(ctx, allPoliciesKey);
  const { items: names, nextMarker } = paginateList(allNames, marker);
  const policies = names
    .map((n) => ctx.store.get<StoredPolicy>(policyKey(n)))
    .filter(Boolean)
    .map((p) => ({
      policyName: p!.policyName,
      policyArn: p!.policyArn,
    }));
  return { policies, nextMarker };
};

const AttachPolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const target = requireStr(data, "target");
  requirePolicy(ctx, policyName);
  const targets = getList<string>(ctx, policyAttachmentsKey(policyName));
  if (!targets.includes(target)) {
    addToList(ctx, policyAttachmentsKey(policyName), target);
  }
  const policies = getList<string>(ctx, principalPoliciesKey(target));
  if (!policies.includes(policyName)) {
    addToList(ctx, principalPoliciesKey(target), policyName);
  }
  return {};
};

const DetachPolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const target = requireStr(data, "target");
  removeFromList<string>(
    ctx,
    policyAttachmentsKey(policyName),
    (t) => t === target,
  );
  removeFromList<string>(
    ctx,
    principalPoliciesKey(target),
    (p) => p === policyName,
  );
  return {};
};

const ListAttachedPolicies: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const target = requireStr(data, "target");
  const marker = str(data["marker"]);
  const allPolicyNames = getList<string>(ctx, principalPoliciesKey(target));
  const { items: names, nextMarker } = paginateList(allPolicyNames, marker);
  const policies = names
    .map((n) => ctx.store.get<StoredPolicy>(policyKey(n)))
    .filter(Boolean)
    .map((p) => ({
      policyName: p!.policyName,
      policyArn: p!.policyArn,
    }));
  return { policies, nextMarker };
};

const ListTargetsForPolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  requirePolicy(ctx, policyName);
  const marker = str(data["marker"]);
  const allTargets = getList<string>(ctx, policyAttachmentsKey(policyName));
  const { items: targets, nextMarker } = paginateList(allTargets, marker);
  return { targets, nextMarker };
};

const CreatePolicyVersion: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const policyDocument = requireStr(data, "policyDocument");
  const setAsDefault =
    data["setAsDefault"] === true || data["setAsDefault"] === "true";
  const stored = requirePolicy(ctx, policyName);
  const versions = getList<string>(ctx, policyVersionsKey(policyName));
  if (versions.length >= 5) {
    throw awsError(
      "VersionsLimitExceededException",
      `The policy ${policyName} has too many versions.`,
      409,
    );
  }
  const maxVer = versions.reduce((m, v) => Math.max(m, parseInt(v, 10)), 0);
  const nextId = String(maxVer + 1);
  const version: StoredPolicyVersion = {
    policyVersionId: nextId,
    policyDocument,
    isDefaultVersion: setAsDefault,
    createdAt: nowSeconds(),
  };
  ctx.store.set(policyVersionKey(policyName, nextId), version);
  addToList(ctx, policyVersionsKey(policyName), nextId);
  if (setAsDefault) {
    const oldId = stored.defaultVersionId;
    const old = ctx.store.get<StoredPolicyVersion>(
      policyVersionKey(policyName, oldId),
    );
    if (old) {
      ctx.store.set(policyVersionKey(policyName, oldId), {
        ...old,
        isDefaultVersion: false,
      });
    }
    ctx.store.set(policyKey(policyName), {
      ...stored,
      defaultVersionId: nextId,
      policyDocument,
    });
  }
  return {
    policyArn: stored.policyArn,
    policyDocument,
    policyVersionId: nextId,
    isDefaultVersion: setAsDefault,
  };
};

const GetPolicyVersion: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const policyVersionId = requireStr(data, "policyVersionId");
  const stored = requirePolicy(ctx, policyName);
  const version = ctx.store.get<StoredPolicyVersion>(
    policyVersionKey(policyName, policyVersionId),
  );
  if (!version) {
    throw awsError(
      "ResourceNotFoundException",
      `PolicyVersion ${policyVersionId} not found.`,
      404,
    );
  }
  return {
    policyArn: stored.policyArn,
    policyName,
    policyDocument: version.policyDocument,
    policyVersionId,
    isDefaultVersion: version.isDefaultVersion,
    creationDate: version.createdAt,
    lastModifiedDate: version.createdAt,
  };
};

const ListPolicyVersions: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  requirePolicy(ctx, policyName);
  const versions = getList<string>(ctx, policyVersionsKey(policyName));
  const policyVersions = versions.map((vId) => {
    const v = ctx.store.get<StoredPolicyVersion>(
      policyVersionKey(policyName, vId),
    )!;
    return {
      versionId: vId,
      isDefaultVersion: v.isDefaultVersion,
      createDate: v.createdAt,
    };
  });
  return { policyVersions };
};

const SetDefaultPolicyVersion: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const policyVersionId = requireStr(data, "policyVersionId");
  const stored = requirePolicy(ctx, policyName);
  const version = ctx.store.get<StoredPolicyVersion>(
    policyVersionKey(policyName, policyVersionId),
  );
  if (!version) {
    throw awsError(
      "ResourceNotFoundException",
      `PolicyVersion ${policyVersionId} not found.`,
      404,
    );
  }
  const oldId = stored.defaultVersionId;
  if (oldId !== policyVersionId) {
    const old = ctx.store.get<StoredPolicyVersion>(
      policyVersionKey(policyName, oldId),
    );
    if (old) {
      ctx.store.set(policyVersionKey(policyName, oldId), {
        ...old,
        isDefaultVersion: false,
      });
    }
    ctx.store.set(policyVersionKey(policyName, policyVersionId), {
      ...version,
      isDefaultVersion: true,
    });
    ctx.store.set(policyKey(policyName), {
      ...stored,
      defaultVersionId: policyVersionId,
      policyDocument: version.policyDocument,
    });
  }
  return {};
};

const DeletePolicyVersion: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const policyVersionId = requireStr(data, "policyVersionId");
  const stored = requirePolicy(ctx, policyName);
  if (stored.defaultVersionId === policyVersionId) {
    throw awsError(
      "DeleteConflictException",
      `Cannot delete the default version of a policy.`,
      409,
    );
  }
  const version = ctx.store.get<StoredPolicyVersion>(
    policyVersionKey(policyName, policyVersionId),
  );
  if (!version) {
    throw awsError(
      "ResourceNotFoundException",
      `PolicyVersion ${policyVersionId} not found.`,
      404,
    );
  }
  ctx.store.set(policyVersionKey(policyName, policyVersionId), undefined);
  removeFromList<string>(
    ctx,
    policyVersionsKey(policyName),
    (v) => v === policyVersionId,
  );
  return {};
};

const AttachPrincipalPolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const principal = requireStr(data, "principal");
  requirePolicy(ctx, policyName);
  const targets = getList<string>(ctx, policyAttachmentsKey(policyName));
  if (!targets.includes(principal)) {
    addToList(ctx, policyAttachmentsKey(policyName), principal);
  }
  const policies = getList<string>(ctx, principalPoliciesKey(principal));
  if (!policies.includes(policyName)) {
    addToList(ctx, principalPoliciesKey(principal), policyName);
  }
  return {};
};

const DetachPrincipalPolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const principal = requireStr(data, "principal");
  removeFromList<string>(
    ctx,
    policyAttachmentsKey(policyName),
    (t) => t === principal,
  );
  removeFromList<string>(
    ctx,
    principalPoliciesKey(principal),
    (p) => p === policyName,
  );
  return {};
};

const ListPrincipalPolicies: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const principal = requireStr(data, "principal");
  const marker = str(data["marker"]);
  const allPolicyNames = getList<string>(ctx, principalPoliciesKey(principal));
  const { items: names, nextMarker } = paginateList(allPolicyNames, marker);
  const policies = names
    .map((n) => ctx.store.get<StoredPolicy>(policyKey(n)))
    .filter(Boolean)
    .map((p) => ({
      policyName: p!.policyName,
      policyArn: p!.policyArn,
    }));
  return { policies, nextMarker };
};

const ListPolicyPrincipals: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  requirePolicy(ctx, policyName);
  const marker = str(data["marker"]);
  const allTargets = getList<string>(ctx, policyAttachmentsKey(policyName));
  const { items: principals, nextMarker } = paginateList(allTargets, marker);
  return { principals, nextMarker };
};

// === ThingPrincipal operations ===

const AttachThingPrincipal: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  const principal = requireStr(data, "principal");
  requireThing(ctx, thingName);
  const principals = getList<string>(ctx, thingPrincipalsKey(thingName));
  if (!principals.includes(principal)) {
    addToList(ctx, thingPrincipalsKey(thingName), principal);
  }
  const things = getList<string>(ctx, principalThingsKey(principal));
  if (!things.includes(thingName)) {
    addToList(ctx, principalThingsKey(principal), thingName);
  }
  return {};
};

const DetachThingPrincipal: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  const principal = requireStr(data, "principal");
  removeFromList<string>(
    ctx,
    thingPrincipalsKey(thingName),
    (p) => p === principal,
  );
  removeFromList<string>(
    ctx,
    principalThingsKey(principal),
    (t) => t === thingName,
  );
  return {};
};

const ListThingPrincipals: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  requireThing(ctx, thingName);
  const principals = getList<string>(ctx, thingPrincipalsKey(thingName));
  return { principals };
};

const ListPrincipalThings: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const principal = requireStr(data, "principal");
  const marker = str(data["nextToken"]);
  const allThingNames = getList<string>(ctx, principalThingsKey(principal));
  const { items: things, nextMarker } = paginateList(allThingNames, marker);
  return { things, nextToken: nextMarker };
};

// === TopicRule operations ===

const CreateTopicRule: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const ruleName = requireStr(data, "ruleName");
  if (ctx.store.get(topicRuleKey(ruleName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `TopicRule ${ruleName} already exists.`,
      409,
    );
  }
  const arn = ruleArn(ctx, ruleName);
  const topicRulePayload = data["topicRulePayload"];
  if (!topicRulePayload) {
    throw awsError(
      "InvalidRequestException",
      "topicRulePayload is required.",
      400,
    );
  }
  const stored: StoredTopicRule = {
    ruleName,
    ruleArn: arn,
    topicRulePayload,
    enabled: true,
    createdAt: nowSeconds(),
  };
  ctx.store.set(topicRuleKey(ruleName), stored);
  addToList(ctx, allRulesKey, ruleName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return {};
};

const GetTopicRule: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const ruleName = requireStr(data, "ruleName");
  const stored = requireRule(ctx, ruleName);
  return {
    ruleArn: stored.ruleArn,
    rule: {
      ruleName: stored.ruleName,
      createdAt: stored.createdAt,
      ruleDisabled: !stored.enabled,
      ...(stored.topicRulePayload as object),
    },
  };
};

const ReplaceTopicRule: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const ruleName = requireStr(data, "ruleName");
  const stored = requireRule(ctx, ruleName);
  const topicRulePayload = data["topicRulePayload"];
  if (!topicRulePayload) {
    throw awsError(
      "InvalidRequestException",
      "topicRulePayload is required.",
      400,
    );
  }
  ctx.store.set(topicRuleKey(ruleName), {
    ...stored,
    topicRulePayload,
  });
  return {};
};

const DeleteTopicRule: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const ruleName = requireStr(data, "ruleName");
  const stored = requireRule(ctx, ruleName);
  ctx.store.set(tagsKey(stored.ruleArn), undefined);
  ctx.store.set(topicRuleKey(ruleName), undefined);
  removeFromList<string>(ctx, allRulesKey, (n) => n === ruleName);
  return {};
};

const ListTopicRules: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const nextToken = str(data["nextToken"]);
  const allNames = getList<string>(ctx, allRulesKey);
  const { items: names, nextMarker } = paginateList(allNames, nextToken);
  const rules = names
    .map((n) => ctx.store.get<StoredTopicRule>(topicRuleKey(n)))
    .filter(Boolean)
    .map((r) => ({
      ruleName: r!.ruleName,
      ruleArn: r!.ruleArn,
      topicPattern: (r!.topicRulePayload as Record<string, unknown>)?.["sql"],
      createdAt: r!.createdAt,
      ruleDisabled: !r!.enabled,
    }));
  return { rules, nextToken: nextMarker };
};

const EnableTopicRule: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const ruleName = requireStr(data, "ruleName");
  const stored = requireRule(ctx, ruleName);
  ctx.store.set(topicRuleKey(ruleName), { ...stored, enabled: true });
  return {};
};

const DisableTopicRule: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const ruleName = requireStr(data, "ruleName");
  const stored = requireRule(ctx, ruleName);
  ctx.store.set(topicRuleKey(ruleName), { ...stored, enabled: false });
  return {};
};

// === Endpoint ===

const DescribeEndpoint: OperationHandler = (input, ctx) => {
  const id = `${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
  return {
    endpointAddress: `${id}.iot.${ctx.region}.amazonaws.com`,
  };
};

// === Tags ===

const TagResource: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const resourceArn = requireStr(data, "resourceArn");
  const newTags = (data["tags"] as { Key: string; Value?: string }[]) ?? [];
  const existing = getList<{ Key: string; Value?: string }>(
    ctx,
    tagsKey(resourceArn),
  );
  const merged = [...existing];
  for (const tag of newTags) {
    const idx = merged.findIndex((t) => t.Key === tag.Key);
    if (idx >= 0) {
      merged[idx] = tag;
    } else {
      merged.push(tag);
    }
  }
  ctx.store.set(tagsKey(resourceArn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const resourceArn = requireStr(data, "resourceArn");
  const tagKeys = (data["tagKeys"] as string[]) ?? [];
  const existing = getList<{ Key: string; Value?: string }>(
    ctx,
    tagsKey(resourceArn),
  );
  ctx.store.set(
    tagsKey(resourceArn),
    existing.filter((t) => !tagKeys.includes(t.Key)),
  );
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const resourceArn = requireStr(data, "resourceArn");
  const tags = getList<{ Key: string; Value?: string }>(
    ctx,
    tagsKey(resourceArn),
  );
  return { tags };
};

// === resolveOperation ===

const idFromArn2 = (arn: string): string => {
  const parts = arn.split(":");
  return parts[parts.length - 1] ?? arn;
};
void idFromArn2;
void certIdFromArn;

export default {
  name: "iot",
  protocol: "rest-json" as const,
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const path = req.path.replace(/^\//, "");
    const parts = path.split("/");

    if (parts[0] === "things") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListThings";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateThing";
        if (req.method === "GET") return "DescribeThing";
        if (req.method === "PATCH") return "UpdateThing";
        if (req.method === "DELETE") return "DeleteThing";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "principals") {
          if (req.method === "PUT") return "AttachThingPrincipal";
          if (req.method === "DELETE") return "DetachThingPrincipal";
          if (req.method === "GET") return "ListThingPrincipals";
          return undefined;
        }
        if (parts[2] === "thing-groups") {
          if (req.method === "GET") return "ListThingGroupsForThing";
          return undefined;
        }
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "thing-types") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListThingTypes";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateThingType";
        if (req.method === "GET") return "DescribeThingType";
        if (req.method === "DELETE") return "DeleteThingType";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "deprecate") {
        if (req.method === "POST") return "DeprecateThingType";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "thing-groups") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListThingGroups";
        return undefined;
      }
      if (parts[1] === "addThingToThingGroup") {
        if (req.method === "PUT") return "AddThingToThingGroup";
        return undefined;
      }
      if (parts[1] === "removeThingFromThingGroup") {
        if (req.method === "PUT") return "RemoveThingFromThingGroup";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateThingGroup";
        if (req.method === "GET") return "DescribeThingGroup";
        if (req.method === "PATCH") return "UpdateThingGroup";
        if (req.method === "DELETE") return "DeleteThingGroup";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "things") {
        if (req.method === "GET") return "ListThingsInThingGroup";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "keys-and-certificate") {
      if (req.method === "POST") return "CreateKeysAndCertificate";
      return undefined;
    }

    if (parts[0] === "certificates") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListCertificates";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeCertificate";
        if (req.method === "PUT") return "UpdateCertificate";
        if (req.method === "DELETE") return "DeleteCertificate";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "policies") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListPolicies";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "POST") return "CreatePolicy";
        if (req.method === "GET") return "GetPolicy";
        if (req.method === "DELETE") return "DeletePolicy";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "version") {
        if (req.method === "GET") return "ListPolicyVersions";
        if (req.method === "POST") return "CreatePolicyVersion";
        return undefined;
      }
      if (parts.length === 4 && parts[2] === "version") {
        if (req.method === "GET") return "GetPolicyVersion";
        if (req.method === "PATCH") return "SetDefaultPolicyVersion";
        if (req.method === "DELETE") return "DeletePolicyVersion";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "principal-policies") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListPrincipalPolicies";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "PUT") return "AttachPrincipalPolicy";
        if (req.method === "DELETE") return "DetachPrincipalPolicy";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "policy-principals") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListPolicyPrincipals";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "target-policies") {
      if (parts.length === 2) {
        if (req.method === "PUT") return "AttachPolicy";
        if (req.method === "POST") return "DetachPolicy";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "attached-policies") {
      if (parts.length === 2) {
        if (req.method === "POST") return "ListAttachedPolicies";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "policy-targets") {
      if (parts.length === 2) {
        if (req.method === "POST") return "ListTargetsForPolicy";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "principals" && parts[1] === "things") {
      if (req.method === "GET") return "ListPrincipalThings";
      return undefined;
    }

    if (parts[0] === "rules") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListTopicRules";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateTopicRule";
        if (req.method === "GET") return "GetTopicRule";
        if (req.method === "PATCH") return "ReplaceTopicRule";
        if (req.method === "DELETE") return "DeleteTopicRule";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "enable" && req.method === "POST")
          return "EnableTopicRule";
        if (parts[2] === "disable" && req.method === "POST")
          return "DisableTopicRule";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "endpoint") {
      if (req.method === "GET") return "DescribeEndpoint";
      return undefined;
    }

    if (parts[0] === "tags") {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      return undefined;
    }

    if (parts[0] === "untag") {
      if (req.method === "POST") return "UntagResource";
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateThing,
    DescribeThing,
    UpdateThing,
    DeleteThing,
    ListThings,
    ListThingGroupsForThing,
    CreateThingType,
    DescribeThingType,
    DeleteThingType,
    ListThingTypes,
    DeprecateThingType,
    CreateThingGroup,
    DescribeThingGroup,
    UpdateThingGroup,
    DeleteThingGroup,
    ListThingGroups,
    AddThingToThingGroup,
    RemoveThingFromThingGroup,
    ListThingsInThingGroup,
    CreateKeysAndCertificate,
    DescribeCertificate,
    UpdateCertificate,
    DeleteCertificate,
    ListCertificates,
    CreatePolicy,
    GetPolicy,
    DeletePolicy,
    ListPolicies,
    CreatePolicyVersion,
    GetPolicyVersion,
    ListPolicyVersions,
    SetDefaultPolicyVersion,
    DeletePolicyVersion,
    AttachPolicy,
    DetachPolicy,
    ListAttachedPolicies,
    ListTargetsForPolicy,
    AttachPrincipalPolicy,
    DetachPrincipalPolicy,
    ListPrincipalPolicies,
    ListPolicyPrincipals,
    AttachThingPrincipal,
    DetachThingPrincipal,
    ListThingPrincipals,
    ListPrincipalThings,
    CreateTopicRule,
    GetTopicRule,
    ReplaceTopicRule,
    DeleteTopicRule,
    ListTopicRules,
    EnableTopicRule,
    DisableTopicRule,
    DescribeEndpoint,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;
