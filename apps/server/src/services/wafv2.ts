import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import wafv2Model from "../../../../test/vendor/aws-models/wafv2.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(wafv2Model);

type StoredWebACL = {
  Name: string;
  Id: string;
  ARN: string;
  Scope: string;
  DefaultAction: unknown;
  Description?: string;
  Rules: unknown[];
  VisibilityConfig: unknown;
  Capacity: number;
  LabelNamespace: string;
  ManagedByFirewallManager: boolean;
  LockToken: string;
};

type StoredIPSet = {
  Name: string;
  Id: string;
  ARN: string;
  Scope: string;
  Description?: string;
  IPAddressVersion: string;
  Addresses: string[];
  LockToken: string;
};

type StoredRuleGroup = {
  Name: string;
  Id: string;
  ARN: string;
  Scope: string;
  Capacity: number;
  Description?: string;
  Rules: unknown[];
  VisibilityConfig: unknown;
  CustomResponseBodies: Record<string, unknown>;
  LabelNamespace: string;
  LockToken: string;
};

type StoredRegexPatternSet = {
  Name: string;
  Id: string;
  ARN: string;
  Scope: string;
  Description?: string;
  RegularExpressionList: { RegexString: string }[];
  LockToken: string;
};

type StoredLoggingConfig = {
  Scope: string;
  Config: Record<string, unknown>;
};

type StoredAssociation = {
  WebACLArn: string;
  ResourceArn: string;
};

type StoredAPIKey = {
  Scope: string;
  TokenDomains: string[];
  APIKey: string;
  CreationTimestamp: number;
  Version: number;
};

type StoredManagedRuleSet = {
  Name: string;
  Id: string;
  ARN: string;
  Scope: string;
  Description?: string;
  PublishedVersions: Record<string, unknown>;
  RecommendedVersion?: string;
  LabelNamespace: string;
  LockToken: string;
};

type StoredTags = {
  ResourceARN: string;
  TagList: { Key: string; Value: string }[];
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("WAFInvalidParameterException", `${key} is required.`, 400);
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = input[key];
  return typeof value === "string" ? value : undefined;
};

const paginationLimit = (input: Record<string, unknown>): number => {
  const l = input["Limit"];
  if (typeof l !== "number") return 100;
  return Math.min(Math.max(Math.floor(l), 1), 100);
};

const paginateItems = <T>(
  items: T[],
  limit: number,
  marker: string | undefined,
  keyFn: (item: T) => string,
): { page: T[]; NextMarker: string | undefined } => {
  let start = 0;
  if (marker !== undefined) {
    const idx = items.findIndex((item) => keyFn(item) === marker);
    start = idx === -1 ? items.length : idx + 1;
  }
  const page = items.slice(start, start + limit);
  const hasMore = start + limit < items.length;
  return {
    page,
    NextMarker: hasMore ? keyFn(page[page.length - 1]!) : undefined,
  };
};

const normalizeScope = (input: Record<string, unknown>): string => {
  const scope = requireString(input, "Scope");
  if (scope !== "REGIONAL" && scope !== "CLOUDFRONT") {
    throw awsError(
      "WAFInvalidParameterException",
      `Invalid Scope ${scope}.`,
      400,
    );
  }
  return scope;
};

const scopeRegion = (region: string, scope: string): string =>
  scope === "CLOUDFRONT" ? "global" : region;

const scopeFromArn = (arn: string): string =>
  arn.includes(":global:") ? "CLOUDFRONT" : "REGIONAL";

const parseWebAclArn = (
  arn: string,
): { scope: string; name: string; id: string } | undefined => {
  const arnParts = arn.split(":");
  if (arnParts.length < 6) return undefined;
  const resourceParts = (arnParts[5] ?? "").split("/");
  if (resourceParts.length < 4 || resourceParts[1] !== "webacl")
    return undefined;
  const scope = resourceParts[0] === "global" ? "CLOUDFRONT" : "REGIONAL";
  return { scope, name: resourceParts[2] ?? "", id: resourceParts[3] ?? "" };
};

const hexId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const lockToken = (): string => {
  const id = hexId();
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20, 32)}`;
};

const webAclKey = (scope: string, name: string): string =>
  `webacl/${scope}/${name}`;

const ipSetKey = (scope: string, name: string): string =>
  `ipset/${scope}/${name}`;

const regexSetKey = (scope: string, name: string): string =>
  `regexset/${scope}/${name}`;

const loggingKey = (arn: string): string => `logging/${arn}`;

const assocByResourceKey = (resourceArn: string): string =>
  `assoc/res/${resourceArn}`;

const permissionPolicyKey = (arn: string): string => `permissionpolicy/${arn}`;

const apiKeyStoreKey = (scope: string, key: string): string =>
  `apikey/${scope}/${key}`;

const managedRuleSetKey = (scope: string, name: string): string =>
  `managedruleset/${scope}/${name}`;

const webAclArn = (
  region: string,
  account: string,
  scope: string,
  name: string,
  id: string,
): string =>
  `arn:aws:wafv2:${scopeRegion(region, scope)}:${account}:${scope === "CLOUDFRONT" ? "global" : "regional"}/webacl/${name}/${id}`;

const ipSetArn = (
  region: string,
  account: string,
  scope: string,
  name: string,
  id: string,
): string =>
  `arn:aws:wafv2:${scopeRegion(region, scope)}:${account}:${scope === "CLOUDFRONT" ? "global" : "regional"}/ipset/${name}/${id}`;

const regexSetArn = (
  region: string,
  account: string,
  scope: string,
  name: string,
  id: string,
): string =>
  `arn:aws:wafv2:${scopeRegion(region, scope)}:${account}:${scope === "CLOUDFRONT" ? "global" : "regional"}/regexpatternset/${name}/${id}`;

const managedRuleSetArn = (
  region: string,
  account: string,
  scope: string,
  name: string,
  id: string,
): string =>
  `arn:aws:wafv2:${scopeRegion(region, scope)}:${account}:${scope === "CLOUDFRONT" ? "global" : "regional"}/managedruleset/${name}/${id}`;

const webAclSummary = (acl: StoredWebACL): Record<string, unknown> => ({
  Name: acl.Name,
  Id: acl.Id,
  Description: acl.Description ?? "",
  LockToken: acl.LockToken,
  ARN: acl.ARN,
});

const webAclView = (acl: StoredWebACL): Record<string, unknown> => ({
  Name: acl.Name,
  Id: acl.Id,
  ARN: acl.ARN,
  DefaultAction: acl.DefaultAction,
  Description: acl.Description ?? "",
  Rules: acl.Rules,
  VisibilityConfig: acl.VisibilityConfig,
  Capacity: acl.Capacity,
  ManagedByFirewallManager: acl.ManagedByFirewallManager,
  LabelNamespace: acl.LabelNamespace,
});

const ipSetSummary = (set: StoredIPSet): Record<string, unknown> => ({
  Name: set.Name,
  Id: set.Id,
  Description: set.Description ?? "",
  LockToken: set.LockToken,
  ARN: set.ARN,
});

const regexSetSummary = (
  set: StoredRegexPatternSet,
): Record<string, unknown> => ({
  Name: set.Name,
  Id: set.Id,
  Description: set.Description ?? "",
  LockToken: set.LockToken,
  ARN: set.ARN,
});

const ruleGroupKey = (scope: string, name: string): string =>
  `rulegroup/${scope}/${name}`;

const tagsKey = (arn: string): string => `tags/${arn}`;

const ruleGroupArn = (
  region: string,
  account: string,
  scope: string,
  name: string,
  id: string,
): string =>
  `arn:aws:wafv2:${scopeRegion(region, scope)}:${account}:${scope === "CLOUDFRONT" ? "global" : "regional"}/rulegroup/${name}/${id}`;

const ruleGroupSummary = (group: StoredRuleGroup): Record<string, unknown> => ({
  Name: group.Name,
  Id: group.Id,
  Description: group.Description ?? "",
  LockToken: group.LockToken,
  ARN: group.ARN,
});

const ruleGroupView = (group: StoredRuleGroup): Record<string, unknown> => ({
  Name: group.Name,
  Id: group.Id,
  ARN: group.ARN,
  Capacity: group.Capacity,
  Description: group.Description ?? "",
  Rules: group.Rules,
  VisibilityConfig: group.VisibilityConfig,
  LabelNamespace: group.LabelNamespace,
  CustomResponseBodies: group.CustomResponseBodies,
});

const managedRuleSetSummary = (
  mrs: StoredManagedRuleSet,
): Record<string, unknown> => ({
  Name: mrs.Name,
  Id: mrs.Id,
  Description: mrs.Description ?? "",
  LockToken: mrs.LockToken,
  ARN: mrs.ARN,
  LabelNamespace: mrs.LabelNamespace,
});

const normalizeTags = (
  input: Record<string, unknown>,
): {
  Key: string;
  Value: string;
}[] => {
  const tags = input["Tags"];
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags.map((tag) => {
    const entry = tag as Record<string, unknown>;
    return {
      Key: typeof entry["Key"] === "string" ? entry["Key"] : "",
      Value: typeof entry["Value"] === "string" ? entry["Value"] : "",
    };
  });
};

const normalizeRegexList = (
  input: Record<string, unknown>,
): { RegexString: string }[] => {
  const list = input["RegularExpressionList"];
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    const entry = item as Record<string, unknown>;
    return {
      RegexString:
        typeof entry["RegexString"] === "string" ? entry["RegexString"] : "",
    };
  });
};

const CreateWebACL: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const scope = normalizeScope(input);
  const key = webAclKey(scope, name);
  if (ctx.store.get<StoredWebACL>(key) !== undefined) {
    throw awsError(
      "WAFDuplicateItemException",
      `WebACL ${name} already exists.`,
      400,
    );
  }
  const id = hexId();
  const acl: StoredWebACL = {
    Name: name,
    Id: id,
    ARN: webAclArn(ctx.region, ctx.account, scope, name, id),
    Scope: scope,
    DefaultAction: input["DefaultAction"] ?? {},
    Description: optionalString(input, "Description"),
    Rules: Array.isArray(input["Rules"]) ? (input["Rules"] as unknown[]) : [],
    VisibilityConfig: input["VisibilityConfig"] ?? {},
    Capacity: 0,
    LabelNamespace: `awswaf:${ctx.account}:webacl:${name}:`,
    ManagedByFirewallManager: false,
    LockToken: lockToken(),
  };
  ctx.store.set(key, acl);
  return { Summary: webAclSummary(acl) };
};

const findWebAcl = (
  ctx: ServiceContext,
  scope: string,
  name: string,
): StoredWebACL => {
  const acl = ctx.store.get<StoredWebACL>(webAclKey(scope, name));
  if (acl === undefined) {
    throw awsError(
      "WAFNonexistentItemException",
      `WebACL ${name} not found.`,
      400,
    );
  }
  return acl;
};

const GetWebACL: OperationHandler = (input, ctx) => {
  const arn = optionalString(input, "ARN");
  let scope: string;
  let name: string;
  let id: string;
  if (arn !== undefined) {
    const parsed = parseWebAclArn(arn);
    if (parsed === undefined) {
      throw awsError("WAFInvalidParameterException", "Invalid ARN.", 400);
    }
    ({ scope, name, id } = parsed);
  } else {
    scope = normalizeScope(input);
    name = requireString(input, "Name");
    id = requireString(input, "Id");
  }
  const acl = findWebAcl(ctx, scope, name);
  if (acl.Id !== id) {
    throw awsError(
      "WAFNonexistentItemException",
      `WebACL ${name} not found.`,
      400,
    );
  }
  return { WebACL: webAclView(acl), LockToken: acl.LockToken };
};

const ListWebACLs: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const acls = ctx.store
    .list<StoredWebACL>()
    .filter((entry) => entry.key.startsWith(`webacl/${scope}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  const { page, NextMarker } = paginateItems(
    acls,
    paginationLimit(input),
    optionalString(input, "NextMarker"),
    (item) => item.Name,
  );
  const result: Record<string, unknown> = { WebACLs: page.map(webAclSummary) };
  if (NextMarker !== undefined) result["NextMarker"] = NextMarker;
  return result;
};

const UpdateWebACL: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const id = requireString(input, "Id");
  const token = requireString(input, "LockToken");
  const acl = findWebAcl(ctx, scope, name);
  if (acl.Id !== id) {
    throw awsError(
      "WAFNonexistentItemException",
      `WebACL ${name} not found.`,
      400,
    );
  }
  if (acl.LockToken !== token) {
    throw awsError("WAFOptimisticLockException", "LockToken mismatch.", 400);
  }
  const updated: StoredWebACL = {
    ...acl,
    DefaultAction: input["DefaultAction"] ?? acl.DefaultAction,
    Description: optionalString(input, "Description") ?? acl.Description,
    Rules: Array.isArray(input["Rules"])
      ? (input["Rules"] as unknown[])
      : acl.Rules,
    VisibilityConfig: input["VisibilityConfig"] ?? acl.VisibilityConfig,
    LockToken: lockToken(),
  };
  ctx.store.set(webAclKey(scope, name), updated);
  return { NextLockToken: updated.LockToken };
};

const DeleteWebACL: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const id = requireString(input, "Id");
  const token = requireString(input, "LockToken");
  const acl = findWebAcl(ctx, scope, name);
  if (acl.Id !== id) {
    throw awsError(
      "WAFNonexistentItemException",
      `WebACL ${name} not found.`,
      400,
    );
  }
  if (acl.LockToken !== token) {
    throw awsError("WAFOptimisticLockException", "LockToken mismatch.", 400);
  }
  ctx.store.delete(webAclKey(scope, name));
  return {};
};

const CreateIPSet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const scope = normalizeScope(input);
  const key = ipSetKey(scope, name);
  if (ctx.store.get<StoredIPSet>(key) !== undefined) {
    throw awsError(
      "WAFDuplicateItemException",
      `IPSet ${name} already exists.`,
      400,
    );
  }
  const id = hexId();
  const set: StoredIPSet = {
    Name: name,
    Id: id,
    ARN: ipSetArn(ctx.region, ctx.account, scope, name, id),
    Scope: scope,
    Description: optionalString(input, "Description"),
    IPAddressVersion: requireString(input, "IPAddressVersion"),
    Addresses: Array.isArray(input["Addresses"])
      ? (input["Addresses"] as string[])
      : [],
    LockToken: lockToken(),
  };
  ctx.store.set(key, set);
  return { Summary: ipSetSummary(set) };
};

const findIPSet = (
  ctx: ServiceContext,
  scope: string,
  name: string,
): StoredIPSet => {
  const set = ctx.store.get<StoredIPSet>(ipSetKey(scope, name));
  if (set === undefined) {
    throw awsError(
      "WAFNonexistentItemException",
      `IPSet ${name} not found.`,
      400,
    );
  }
  return set;
};

const GetIPSet: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const set = findIPSet(ctx, scope, name);
  return {
    IPSet: {
      Name: set.Name,
      Id: set.Id,
      ARN: set.ARN,
      Description: set.Description ?? "",
      IPAddressVersion: set.IPAddressVersion,
      Addresses: set.Addresses,
    },
    LockToken: set.LockToken,
  };
};

const ListIPSets: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const sets = ctx.store
    .list<StoredIPSet>()
    .filter((entry) => entry.key.startsWith(`ipset/${scope}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  const { page, NextMarker } = paginateItems(
    sets,
    paginationLimit(input),
    optionalString(input, "NextMarker"),
    (item) => item.Name,
  );
  const result: Record<string, unknown> = { IPSets: page.map(ipSetSummary) };
  if (NextMarker !== undefined) result["NextMarker"] = NextMarker;
  return result;
};

const UpdateIPSet: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const token = requireString(input, "LockToken");
  const set = findIPSet(ctx, scope, name);
  if (set.LockToken !== token) {
    throw awsError("WAFOptimisticLockException", "LockToken mismatch.", 400);
  }
  const updated: StoredIPSet = {
    ...set,
    Description: optionalString(input, "Description") ?? set.Description,
    Addresses: Array.isArray(input["Addresses"])
      ? (input["Addresses"] as string[])
      : set.Addresses,
    LockToken: lockToken(),
  };
  ctx.store.set(ipSetKey(scope, name), updated);
  return { NextLockToken: updated.LockToken };
};

const DeleteIPSet: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const token = requireString(input, "LockToken");
  const set = findIPSet(ctx, scope, name);
  if (set.LockToken !== token) {
    throw awsError("WAFOptimisticLockException", "LockToken mismatch.", 400);
  }
  ctx.store.delete(ipSetKey(scope, name));
  return {};
};

const CreateRegexPatternSet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const scope = normalizeScope(input);
  const key = regexSetKey(scope, name);
  if (ctx.store.get<StoredRegexPatternSet>(key) !== undefined) {
    throw awsError(
      "WAFDuplicateItemException",
      `RegexPatternSet ${name} already exists.`,
      400,
    );
  }
  const id = hexId();
  const set: StoredRegexPatternSet = {
    Name: name,
    Id: id,
    ARN: regexSetArn(ctx.region, ctx.account, scope, name, id),
    Scope: scope,
    Description: optionalString(input, "Description"),
    RegularExpressionList: normalizeRegexList(input),
    LockToken: lockToken(),
  };
  ctx.store.set(key, set);
  return { Summary: regexSetSummary(set) };
};

const findRegexSet = (
  ctx: ServiceContext,
  scope: string,
  name: string,
): StoredRegexPatternSet => {
  const set = ctx.store.get<StoredRegexPatternSet>(regexSetKey(scope, name));
  if (set === undefined) {
    throw awsError(
      "WAFNonexistentItemException",
      `RegexPatternSet ${name} not found.`,
      400,
    );
  }
  return set;
};

const GetRegexPatternSet: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const set = findRegexSet(ctx, scope, name);
  return {
    RegexPatternSet: {
      Name: set.Name,
      Id: set.Id,
      ARN: set.ARN,
      Description: set.Description ?? "",
      RegularExpressionList: set.RegularExpressionList,
    },
    LockToken: set.LockToken,
  };
};

const ListRegexPatternSets: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const sets = ctx.store
    .list<StoredRegexPatternSet>()
    .filter((entry) => entry.key.startsWith(`regexset/${scope}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  const { page, NextMarker } = paginateItems(
    sets,
    paginationLimit(input),
    optionalString(input, "NextMarker"),
    (item) => item.Name,
  );
  const result: Record<string, unknown> = {
    RegexPatternSets: page.map(regexSetSummary),
  };
  if (NextMarker !== undefined) result["NextMarker"] = NextMarker;
  return result;
};

const UpdateRegexPatternSet: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const token = requireString(input, "LockToken");
  const set = findRegexSet(ctx, scope, name);
  if (set.LockToken !== token) {
    throw awsError("WAFOptimisticLockException", "LockToken mismatch.", 400);
  }
  const updated: StoredRegexPatternSet = {
    ...set,
    Description: optionalString(input, "Description") ?? set.Description,
    RegularExpressionList: normalizeRegexList(input),
    LockToken: lockToken(),
  };
  ctx.store.set(regexSetKey(scope, name), updated);
  return { NextLockToken: updated.LockToken };
};

const DeleteRegexPatternSet: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const token = requireString(input, "LockToken");
  const set = findRegexSet(ctx, scope, name);
  if (set.LockToken !== token) {
    throw awsError("WAFOptimisticLockException", "LockToken mismatch.", 400);
  }
  ctx.store.delete(regexSetKey(scope, name));
  return {};
};

const PutLoggingConfiguration: OperationHandler = (input, ctx) => {
  const cfg = input["LoggingConfiguration"] as Record<string, unknown>;
  if (typeof cfg !== "object" || cfg === null) {
    throw awsError(
      "WAFInvalidParameterException",
      "LoggingConfiguration is required.",
      400,
    );
  }
  const resourceArn = requireString(cfg, "ResourceArn");
  const scope = scopeFromArn(resourceArn);
  const stored: StoredLoggingConfig = { Scope: scope, Config: cfg };
  ctx.store.set(loggingKey(resourceArn), stored);
  return { LoggingConfiguration: cfg };
};

const GetLoggingConfiguration: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const stored = ctx.store.get<StoredLoggingConfig>(loggingKey(resourceArn));
  if (stored === undefined) {
    throw awsError(
      "WAFNonexistentItemException",
      `No logging configuration for ${resourceArn}.`,
      400,
    );
  }
  return { LoggingConfiguration: stored.Config };
};

const DeleteLoggingConfiguration: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  ctx.store.delete(loggingKey(resourceArn));
  return {};
};

const ListLoggingConfigurations: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const configs = ctx.store
    .list<StoredLoggingConfig>()
    .filter(
      (entry) =>
        entry.key.startsWith("logging/") && entry.value.Scope === scope,
    )
    .map((entry) => entry.value.Config);
  return { LoggingConfigurations: configs };
};

const AssociateWebACL: OperationHandler = (input, ctx) => {
  const webACLArnVal = requireString(input, "WebACLArn");
  const resourceArn = requireString(input, "ResourceArn");
  ctx.store.set<StoredAssociation>(assocByResourceKey(resourceArn), {
    WebACLArn: webACLArnVal,
    ResourceArn: resourceArn,
  });
  return {};
};

const DisassociateWebACL: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  ctx.store.delete(assocByResourceKey(resourceArn));
  return {};
};

const GetWebACLForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const assoc = ctx.store.get<StoredAssociation>(
    assocByResourceKey(resourceArn),
  );
  if (assoc === undefined) {
    return {};
  }
  const entry = ctx.store
    .list<StoredWebACL>()
    .find(
      (e) => e.key.startsWith("webacl/") && e.value.ARN === assoc.WebACLArn,
    );
  if (entry === undefined) {
    return {};
  }
  return { WebACL: webAclView(entry.value) };
};

const ListResourcesForWebACL: OperationHandler = (input, ctx) => {
  const webACLArnVal = requireString(input, "WebACLArn");
  const resourceArns = ctx.store
    .list<StoredAssociation>()
    .filter(
      (entry) =>
        entry.key.startsWith("assoc/res/") &&
        entry.value.WebACLArn === webACLArnVal,
    )
    .map((entry) => entry.value.ResourceArn);
  return { ResourceArns: resourceArns };
};

const PutPermissionPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const policy = requireString(input, "Policy");
  ctx.store.set(permissionPolicyKey(arn), policy);
  return {};
};

const GetPermissionPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const policy = ctx.store.get<string>(permissionPolicyKey(arn));
  if (policy === undefined) {
    throw awsError(
      "WAFNonexistentItemException",
      `No policy found for ${arn}.`,
      400,
    );
  }
  return { Policy: policy };
};

const DeletePermissionPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  ctx.store.delete(permissionPolicyKey(arn));
  return {};
};

const CreateAPIKey: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const tokenDomains = Array.isArray(input["TokenDomains"])
    ? (input["TokenDomains"] as string[])
    : [];
  const key = hexId();
  const stored: StoredAPIKey = {
    Scope: scope,
    TokenDomains: tokenDomains,
    APIKey: key,
    CreationTimestamp: Date.now() / 1000,
    Version: 1,
  };
  ctx.store.set<StoredAPIKey>(apiKeyStoreKey(scope, key), stored);
  return { APIKey: key };
};

const DeleteAPIKey: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const key = requireString(input, "APIKey");
  ctx.store.delete(apiKeyStoreKey(scope, key));
  return {};
};

const ListAPIKeys: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const keys = ctx.store
    .list<StoredAPIKey>()
    .filter((entry) => entry.key.startsWith(`apikey/${scope}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.CreationTimestamp - b.CreationTimestamp);
  const { page, NextMarker } = paginateItems(
    keys,
    paginationLimit(input),
    optionalString(input, "NextMarker"),
    (item) => item.APIKey,
  );
  const result: Record<string, unknown> = {
    APIKeySummaries: page.map((k) => ({
      TokenDomains: k.TokenDomains,
      APIKey: k.APIKey,
      CreationTimestamp: k.CreationTimestamp,
      Version: k.Version,
    })),
    ApplicationIntegrationURL: `https://waf.${ctx.region}.amazonaws.com/v1/`,
  };
  if (NextMarker !== undefined) result["NextMarker"] = NextMarker;
  return result;
};

const GetDecryptedAPIKey: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const key = requireString(input, "APIKey");
  const stored = ctx.store.get<StoredAPIKey>(apiKeyStoreKey(scope, key));
  if (stored === undefined) {
    throw awsError("WAFInvalidParameterException", `API key not found.`, 400);
  }
  return {
    TokenDomains: stored.TokenDomains,
    CreationTimestamp: stored.CreationTimestamp,
  };
};

const DescribeManagedRuleGroup: OperationHandler = (_input, _ctx) => ({
  Capacity: 0,
  Rules: [],
  LabelNamespace: "",
  AvailableLabels: [],
  ConsumedLabels: [],
});

const ListAvailableManagedRuleGroups: OperationHandler = (_input, _ctx) => ({
  ManagedRuleGroups: [],
});

const ListAvailableManagedRuleGroupVersions: OperationHandler = (
  _input,
  _ctx,
) => ({
  Versions: [],
  CurrentDefaultVersion: "1.0",
});

const DescribeAllManagedProducts: OperationHandler = (_input, _ctx) => ({
  ManagedProducts: [],
});

const DescribeManagedProductsByVendor: OperationHandler = (_input, _ctx) => ({
  ManagedProducts: [],
});

const findManagedRuleSet = (
  ctx: ServiceContext,
  scope: string,
  name: string,
): StoredManagedRuleSet => {
  const mrs = ctx.store.get<StoredManagedRuleSet>(
    managedRuleSetKey(scope, name),
  );
  if (mrs === undefined) {
    throw awsError(
      "WAFNonexistentItemException",
      `ManagedRuleSet ${name} not found.`,
      400,
    );
  }
  return mrs;
};

const GetManagedRuleSet: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const mrs = findManagedRuleSet(ctx, scope, name);
  return {
    ManagedRuleSet: {
      Name: mrs.Name,
      Id: mrs.Id,
      ARN: mrs.ARN,
      Description: mrs.Description ?? "",
      PublishedVersions: mrs.PublishedVersions,
      RecommendedVersion: mrs.RecommendedVersion,
      LabelNamespace: mrs.LabelNamespace,
    },
    LockToken: mrs.LockToken,
  };
};

const ListManagedRuleSets: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const sets = ctx.store
    .list<StoredManagedRuleSet>()
    .filter((entry) => entry.key.startsWith(`managedruleset/${scope}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  return { ManagedRuleSets: sets.map(managedRuleSetSummary) };
};

const PutManagedRuleSetVersions: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const id = requireString(input, "Id");
  const token = requireString(input, "LockToken");
  const key = managedRuleSetKey(scope, name);
  const existing = ctx.store.get<StoredManagedRuleSet>(key);
  if (existing !== undefined && existing.LockToken !== token) {
    throw awsError("WAFOptimisticLockException", "LockToken mismatch.", 400);
  }
  const versionsToPublish =
    typeof input["VersionsToPublish"] === "object" &&
    input["VersionsToPublish"] !== null
      ? (input["VersionsToPublish"] as Record<string, unknown>)
      : {};
  const mrsId = existing?.Id ?? id;
  const updated: StoredManagedRuleSet = {
    Name: name,
    Id: mrsId,
    ARN:
      existing?.ARN ??
      managedRuleSetArn(ctx.region, ctx.account, scope, name, mrsId),
    Scope: scope,
    Description: existing?.Description,
    PublishedVersions: {
      ...(existing?.PublishedVersions ?? {}),
      ...versionsToPublish,
    },
    RecommendedVersion:
      optionalString(input, "RecommendedVersion") ??
      existing?.RecommendedVersion,
    LabelNamespace:
      existing?.LabelNamespace ??
      `awswaf:${ctx.account}:managedruleset:${name}:`,
    LockToken: lockToken(),
  };
  ctx.store.set(key, updated);
  return { NextLockToken: updated.LockToken };
};

const UpdateManagedRuleSetVersionExpiryDate: OperationHandler = (
  input,
  ctx,
) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const token = requireString(input, "LockToken");
  const versionToExpire = requireString(input, "VersionToExpire");
  const expiryTimestamp = input["ExpiryTimestamp"];
  const mrs = findManagedRuleSet(ctx, scope, name);
  if (mrs.LockToken !== token) {
    throw awsError("WAFOptimisticLockException", "LockToken mismatch.", 400);
  }
  const newToken = lockToken();
  const existingVersion =
    typeof mrs.PublishedVersions[versionToExpire] === "object" &&
    mrs.PublishedVersions[versionToExpire] !== null
      ? (mrs.PublishedVersions[versionToExpire] as Record<string, unknown>)
      : {};
  const updated: StoredManagedRuleSet = {
    ...mrs,
    PublishedVersions: {
      ...mrs.PublishedVersions,
      [versionToExpire]: {
        ...existingVersion,
        ExpiryTimestamp: expiryTimestamp,
      },
    },
    LockToken: newToken,
  };
  ctx.store.set(managedRuleSetKey(scope, name), updated);
  return {
    ExpiringVersion: versionToExpire,
    ExpiryTimestamp: expiryTimestamp,
    NextLockToken: newToken,
  };
};

const GenerateMobileSdkReleaseUrl: OperationHandler = (input, _ctx) => {
  const platform = requireString(input, "Platform");
  const version = requireString(input, "ReleaseVersion");
  return {
    Url: `https://downloads.wafv2.amazonaws.com/sdk/${platform}/${version}/release.zip`,
  };
};

const GetMobileSdkRelease: OperationHandler = (input, _ctx) => {
  const platform = requireString(input, "Platform");
  const version = requireString(input, "ReleaseVersion");
  return {
    MobileSdkRelease: {
      ReleaseVersion: version,
      Timestamp: Date.now() / 1000,
      ReleaseNotes: `${platform} SDK release ${version}`,
      Tags: [],
    },
  };
};

const ListMobileSdkReleases: OperationHandler = (_input, _ctx) => ({
  ReleaseSummaries: [],
});

const CheckCapacity: OperationHandler = (_input, _ctx) => ({
  Capacity: 0,
});

const GetSampledRequests: OperationHandler = (input, _ctx) => ({
  SampledRequests: [],
  PopulationSize: 0,
  TimeWindow: input["TimeWindow"],
});

const GetRateBasedStatementManagedKeys: OperationHandler = (_input, _ctx) => ({
  ManagedKeysIPV4: { IPAddressVersion: "IPV4", Addresses: [] },
  ManagedKeysIPV6: { IPAddressVersion: "IPV6", Addresses: [] },
});

const GetTopPathStatisticsByTraffic: OperationHandler = (_input, _ctx) => ({
  PathStatistics: [],
  TotalRequestCount: 0,
});

const DeleteFirewallManagerRuleGroups: OperationHandler = (input, ctx) => {
  const webACLArnVal = requireString(input, "WebACLArn");
  const token = requireString(input, "WebACLLockToken");
  const entry = ctx.store
    .list<StoredWebACL>()
    .find((e) => e.key.startsWith("webacl/") && e.value.ARN === webACLArnVal);
  if (entry === undefined) {
    throw awsError(
      "WAFNonexistentItemException",
      `WebACL ${webACLArnVal} not found.`,
      400,
    );
  }
  const acl = entry.value;
  if (acl.LockToken !== token) {
    throw awsError("WAFOptimisticLockException", "LockToken mismatch.", 400);
  }
  const newToken = lockToken();
  ctx.store.set(entry.key, { ...acl, LockToken: newToken });
  return { NextWebACLLockToken: newToken };
};

const CreateRuleGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const scope = normalizeScope(input);
  const key = ruleGroupKey(scope, name);
  if (ctx.store.get<StoredRuleGroup>(key) !== undefined) {
    throw awsError(
      "WAFDuplicateItemException",
      `RuleGroup ${name} already exists.`,
      400,
    );
  }
  const capacity = input["Capacity"];
  const id = hexId();
  const group: StoredRuleGroup = {
    Name: name,
    Id: id,
    ARN: ruleGroupArn(ctx.region, ctx.account, scope, name, id),
    Scope: scope,
    Capacity: typeof capacity === "number" ? capacity : 0,
    Description: optionalString(input, "Description"),
    Rules: Array.isArray(input["Rules"]) ? (input["Rules"] as unknown[]) : [],
    VisibilityConfig: input["VisibilityConfig"] ?? {},
    CustomResponseBodies:
      typeof input["CustomResponseBodies"] === "object" &&
      input["CustomResponseBodies"] !== null
        ? (input["CustomResponseBodies"] as Record<string, unknown>)
        : {},
    LabelNamespace: `awswaf:${ctx.account}:rulegroup:${name}:`,
    LockToken: lockToken(),
  };
  ctx.store.set(key, group);
  if (Array.isArray(input["Tags"]) && input["Tags"].length > 0) {
    ctx.store.set<StoredTags>(tagsKey(group.ARN), {
      ResourceARN: group.ARN,
      TagList: normalizeTags(input),
    });
  }
  return { Summary: ruleGroupSummary(group) };
};

const findRuleGroup = (
  ctx: ServiceContext,
  scope: string,
  name: string,
): StoredRuleGroup => {
  const group = ctx.store.get<StoredRuleGroup>(ruleGroupKey(scope, name));
  if (group === undefined) {
    throw awsError(
      "WAFNonexistentItemException",
      `RuleGroup ${name} not found.`,
      400,
    );
  }
  return group;
};

const GetRuleGroup: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const group = findRuleGroup(ctx, scope, name);
  return { RuleGroup: ruleGroupView(group), LockToken: group.LockToken };
};

const ListRuleGroups: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const groups = ctx.store
    .list<StoredRuleGroup>()
    .filter((entry) => entry.key.startsWith(`rulegroup/${scope}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  const { page, NextMarker } = paginateItems(
    groups,
    paginationLimit(input),
    optionalString(input, "NextMarker"),
    (item) => item.Name,
  );
  const result: Record<string, unknown> = {
    RuleGroups: page.map(ruleGroupSummary),
  };
  if (NextMarker !== undefined) result["NextMarker"] = NextMarker;
  return result;
};

const UpdateRuleGroup: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const token = requireString(input, "LockToken");
  const group = findRuleGroup(ctx, scope, name);
  if (group.LockToken !== token) {
    throw awsError("WAFOptimisticLockException", "LockToken mismatch.", 400);
  }
  const updated: StoredRuleGroup = {
    ...group,
    Description: optionalString(input, "Description") ?? group.Description,
    Rules: Array.isArray(input["Rules"])
      ? (input["Rules"] as unknown[])
      : group.Rules,
    VisibilityConfig: input["VisibilityConfig"] ?? group.VisibilityConfig,
    CustomResponseBodies:
      typeof input["CustomResponseBodies"] === "object" &&
      input["CustomResponseBodies"] !== null
        ? (input["CustomResponseBodies"] as Record<string, unknown>)
        : group.CustomResponseBodies,
    LockToken: lockToken(),
  };
  ctx.store.set(ruleGroupKey(scope, name), updated);
  return { NextLockToken: updated.LockToken };
};

const DeleteRuleGroup: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const token = requireString(input, "LockToken");
  const group = findRuleGroup(ctx, scope, name);
  if (group.LockToken !== token) {
    throw awsError("WAFOptimisticLockException", "LockToken mismatch.", 400);
  }
  ctx.store.delete(ruleGroupKey(scope, name));
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const incoming = normalizeTags(input);
  const existing = ctx.store.get<StoredTags>(tagsKey(arn));
  const merged = new Map<string, string>();
  for (const tag of existing?.TagList ?? []) {
    merged.set(tag.Key, tag.Value);
  }
  for (const tag of incoming) {
    merged.set(tag.Key, tag.Value);
  }
  ctx.store.set<StoredTags>(tagsKey(arn), {
    ResourceARN: arn,
    TagList: Array.from(merged.entries()).map(([Key, Value]) => ({
      Key,
      Value,
    })),
  });
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const stored = ctx.store.get<StoredTags>(tagsKey(arn));
  return {
    TagInfoForResource: {
      ResourceARN: arn,
      TagList: stored?.TagList ?? [],
    },
  };
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const keys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as unknown[]).filter(
        (key): key is string => typeof key === "string",
      )
    : [];
  const stored = ctx.store.get<StoredTags>(tagsKey(arn));
  if (stored === undefined) {
    return {};
  }
  const remove = new Set(keys);
  ctx.store.set<StoredTags>(tagsKey(arn), {
    ResourceARN: arn,
    TagList: stored.TagList.filter((tag) => !remove.has(tag.Key)),
  });
  return {};
};

const wafv2 = {
  name: "wafv2",
  protocol: "json",
  operations: {
    CreateWebACL,
    GetWebACL,
    ListWebACLs,
    UpdateWebACL,
    DeleteWebACL,
    CreateIPSet,
    GetIPSet,
    ListIPSets,
    UpdateIPSet,
    DeleteIPSet,
    CreateRegexPatternSet,
    GetRegexPatternSet,
    ListRegexPatternSets,
    UpdateRegexPatternSet,
    DeleteRegexPatternSet,
    PutLoggingConfiguration,
    GetLoggingConfiguration,
    DeleteLoggingConfiguration,
    ListLoggingConfigurations,
    AssociateWebACL,
    DisassociateWebACL,
    GetWebACLForResource,
    ListResourcesForWebACL,
    PutPermissionPolicy,
    GetPermissionPolicy,
    DeletePermissionPolicy,
    CreateAPIKey,
    DeleteAPIKey,
    ListAPIKeys,
    GetDecryptedAPIKey,
    DescribeManagedRuleGroup,
    ListAvailableManagedRuleGroups,
    ListAvailableManagedRuleGroupVersions,
    DescribeAllManagedProducts,
    DescribeManagedProductsByVendor,
    GetManagedRuleSet,
    ListManagedRuleSets,
    PutManagedRuleSetVersions,
    UpdateManagedRuleSetVersionExpiryDate,
    GenerateMobileSdkReleaseUrl,
    GetMobileSdkRelease,
    ListMobileSdkReleases,
    CheckCapacity,
    GetSampledRequests,
    GetRateBasedStatementManagedKeys,
    GetTopPathStatisticsByTraffic,
    DeleteFirewallManagerRuleGroups,
    CreateRuleGroup,
    GetRuleGroup,
    ListRuleGroups,
    UpdateRuleGroup,
    DeleteRuleGroup,
    TagResource,
    ListTagsForResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default wafv2;
