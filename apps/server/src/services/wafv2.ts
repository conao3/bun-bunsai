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
  },
  model,
} as const satisfies ServiceDefinition;

export default wafv2;
