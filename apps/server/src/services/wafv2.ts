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
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const acl = findWebAcl(ctx, scope, name);
  return { WebACL: webAclView(acl), LockToken: acl.LockToken };
};

const ListWebACLs: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const acls = ctx.store
    .list<StoredWebACL>()
    .filter((entry) => entry.key.startsWith(`webacl/${scope}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  return { WebACLs: acls.map(webAclSummary) };
};

const UpdateWebACL: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const name = requireString(input, "Name");
  const token = requireString(input, "LockToken");
  const acl = findWebAcl(ctx, scope, name);
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
  const token = requireString(input, "LockToken");
  const acl = findWebAcl(ctx, scope, name);
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

const ListIPSets: OperationHandler = (input, ctx) => {
  const scope = normalizeScope(input);
  const sets = ctx.store
    .list<StoredIPSet>()
    .filter((entry) => entry.key.startsWith(`ipset/${scope}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  return { IPSets: sets.map(ipSetSummary) };
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
  return { RuleGroups: groups.map(ruleGroupSummary) };
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
    ListIPSets,
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
