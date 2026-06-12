import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/route53resolver.json", { with: { type: "json" } }),
  { targetPrefix: "Route53Resolver" },
);

type IpAddressEntry = {
  IpId: string;
  SubnetId: string;
  Ip?: string;
  Ipv6?: string;
  Status: string;
  StatusMessage: string;
  CreationTime: string;
  ModificationTime: string;
};

type StoredEndpoint = {
  Id: string;
  CreatorRequestId: string;
  Arn: string;
  Name?: string;
  SecurityGroupIds: string[];
  Direction: string;
  IpAddressCount: number;
  HostVPCId: string;
  Status: string;
  StatusMessage: string;
  CreationTime: string;
  ModificationTime: string;
  ResolverEndpointType?: string;
  Protocols?: string[];
  ipAddresses: IpAddressEntry[];
};

type StoredRule = {
  Id: string;
  CreatorRequestId: string;
  Arn: string;
  DomainName?: string;
  Name?: string;
  RuleType: string;
  Status: string;
  StatusMessage: string;
  OwnerId: string;
  ShareStatus: string;
  CreationTime: string;
  ModificationTime: string;
  ResolverEndpointId?: string;
  TargetIps?: Array<{
    Ip?: string;
    Port?: number;
    Ipv6?: string;
    Protocol?: string;
  }>;
};

type StoredRuleAssociation = {
  Id: string;
  ResolverRuleId: string;
  Name?: string;
  VPCId: string;
  Status: string;
  StatusMessage: string;
};

type StoredFirewallRuleGroup = {
  Id: string;
  CreatorRequestId: string;
  Arn: string;
  Name: string;
  Status: string;
  StatusMessage: string;
  RuleCount: number;
  OwnerId: string;
  ShareStatus: string;
  CreationTime: string;
  ModificationTime: string;
};

type StoredFirewallDomainList = {
  Id: string;
  CreatorRequestId: string;
  Arn: string;
  Name: string;
  Status: string;
  StatusMessage: string;
  DomainCount: number;
  CreationTime: string;
  ModificationTime: string;
  domains: string[];
};

type StoredFirewallRule = {
  FirewallRuleGroupId: string;
  FirewallDomainListId?: string;
  Name: string;
  Priority: number;
  Action: string;
  BlockResponse?: string;
  BlockOverrideDomain?: string;
  BlockOverrideDnsType?: string;
  BlockOverrideTtl?: number;
  CreationTime: string;
  ModificationTime: string;
  CreatorRequestId?: string;
  DnsThreatProtection?: string;
  ConfidenceThreshold?: string;
};

type StoredFirewallRuleGroupAssociation = {
  Id: string;
  Arn: string;
  VpcId: string;
  FirewallRuleGroupId: string;
  Name: string;
  Priority: number;
  MutationProtection: string;
  Status: string;
  StatusMessage: string;
  CreationTime: string;
  ModificationTime: string;
  CreatorRequestId: string;
  ManagedOwnerName?: string;
};

type StoredFirewallConfig = {
  ResourceId: string;
  OwnerId: string;
  FirewallFailOpen: string;
};

type StoredQueryLogConfig = {
  Id: string;
  OwnerId: string;
  Status: string;
  AssociationCount: number;
  Arn: string;
  Name: string;
  DestinationArn: string;
  CreatorRequestId: string;
  CreationTime: string;
};

type StoredQueryLogConfigAssociation = {
  Id: string;
  ResolverQueryLogConfigId: string;
  ResourceId: string;
  Status: string;
  Error?: string;
  ErrorMessage?: string;
  CreationTime: string;
};

type StoredResolverConfig = {
  ResourceId: string;
  OwnerId: string;
  AutodefinedReverse: string;
};

type StoredDnssecConfig = {
  Id: string;
  OwnerId: string;
  ResourceId: string;
  ValidationStatus: string;
};

type StoredOutpostResolver = {
  Id: string;
  CreatorRequestId: string;
  Arn: string;
  Name: string;
  Status: string;
  StatusMessage: string;
  PreferredInstanceType: string;
  OutpostArn: string;
  InstanceCount: number;
  CreationTime: string;
  ModificationTime: string;
};

const endpointKey = (id: string): string => `endpoint/${id}`;
const ruleKey = (id: string): string => `rule/${id}`;
const assocKey = (id: string): string => `assoc/${id}`;
const tagsKey = (arn: string): string => `tags/${arn}`;
const creatorEndpointKey = (rid: string): string => `creator/endpoint/${rid}`;
const creatorRuleKey = (rid: string): string => `creator/rule/${rid}`;

const fwrgKey = (id: string): string => `fwrg/${id}`;
const fwdlKey = (id: string): string => `fwdl/${id}`;
const fwRuleKey = (ruleGroupId: string, domainListId: string): string =>
  `fwrule/${ruleGroupId}/${domainListId}`;
const fwAssocKey = (id: string): string => `fwassoc/${id}`;
const fwConfigKey = (resourceId: string): string => `fwconfig/${resourceId}`;
const qlConfigKey = (id: string): string => `qlconfig/${id}`;
const qlAssocKey = (id: string): string => `qlassoc/${id}`;
const resolverConfigKey = (resourceId: string): string =>
  `resolverconfig/${resourceId}`;
const dnssecConfigKey = (resourceId: string): string =>
  `dnssecconfig/${resourceId}`;
const outpostKey = (id: string): string => `outpost/${id}`;
const policyFwrgKey = (arn: string): string => `policy/fwrg/${arn}`;
const policyQlKey = (arn: string): string => `policy/ql/${arn}`;
const policyRuleKey = (arn: string): string => `policy/rule/${arn}`;

const creatorFwrgKey = (rid: string): string => `creator/fwrg/${rid}`;
const creatorFwdlKey = (rid: string): string => `creator/fwdl/${rid}`;
const creatorFwAssocKey = (rid: string): string => `creator/fwassoc/${rid}`;
const creatorQlConfigKey = (rid: string): string => `creator/qlconfig/${rid}`;
const creatorOutpostKey = (rid: string): string => `creator/outpost/${rid}`;

let seq = 0;
const nextId = (): string => {
  seq += 1;
  const hex = seq.toString(16).padStart(8, "0");
  return `rslvr-${hex}`;
};

const nextIpId = (): string => {
  seq += 1;
  const hex = seq.toString(16).padStart(8, "0");
  return `ip-${hex}`;
};

const now = (): string => new Date().toISOString();

const requireEndpoint = (ctx: ServiceContext, id: string): StoredEndpoint => {
  const ep = ctx.store.get<StoredEndpoint>(endpointKey(id));
  if (!ep) {
    throw awsError(
      "ResourceNotFoundException",
      `Resolver endpoint with ID '${id}' does not exist.`,
      400,
    );
  }
  return ep;
};

const requireFwrg = (
  ctx: ServiceContext,
  id: string,
): StoredFirewallRuleGroup => {
  const g = ctx.store.get<StoredFirewallRuleGroup>(fwrgKey(id));
  if (!g) {
    throw awsError(
      "ResourceNotFoundException",
      `Firewall rule group with ID '${id}' does not exist.`,
      400,
    );
  }
  return g;
};

const requireFwdl = (
  ctx: ServiceContext,
  id: string,
): StoredFirewallDomainList => {
  const d = ctx.store.get<StoredFirewallDomainList>(fwdlKey(id));
  if (!d) {
    throw awsError(
      "ResourceNotFoundException",
      `Firewall domain list with ID '${id}' does not exist.`,
      400,
    );
  }
  return d;
};

const requireFwAssoc = (
  ctx: ServiceContext,
  id: string,
): StoredFirewallRuleGroupAssociation => {
  const a = ctx.store.get<StoredFirewallRuleGroupAssociation>(fwAssocKey(id));
  if (!a) {
    throw awsError(
      "ResourceNotFoundException",
      `Firewall rule group association with ID '${id}' does not exist.`,
      400,
    );
  }
  return a;
};

const requireQlConfig = (
  ctx: ServiceContext,
  id: string,
): StoredQueryLogConfig => {
  const c = ctx.store.get<StoredQueryLogConfig>(qlConfigKey(id));
  if (!c) {
    throw awsError(
      "ResourceNotFoundException",
      `Resolver query log configuration with ID '${id}' does not exist.`,
      400,
    );
  }
  return c;
};

const requireQlAssoc = (
  ctx: ServiceContext,
  id: string,
): StoredQueryLogConfigAssociation => {
  const a = ctx.store.get<StoredQueryLogConfigAssociation>(qlAssocKey(id));
  if (!a) {
    throw awsError(
      "ResourceNotFoundException",
      `Resolver query log configuration association with ID '${id}' does not exist.`,
      400,
    );
  }
  return a;
};

const requireOutpost = (
  ctx: ServiceContext,
  id: string,
): StoredOutpostResolver => {
  const o = ctx.store.get<StoredOutpostResolver>(outpostKey(id));
  if (!o) {
    throw awsError(
      "ResourceNotFoundException",
      `Outpost resolver with ID '${id}' does not exist.`,
      400,
    );
  }
  return o;
};

const requireRule = (ctx: ServiceContext, id: string): StoredRule => {
  const rule = ctx.store.get<StoredRule>(ruleKey(id));
  if (!rule) {
    throw awsError(
      "ResourceNotFoundException",
      `Resolver rule with ID '${id}' does not exist.`,
      400,
    );
  }
  return rule;
};

const requireAssoc = (
  ctx: ServiceContext,
  id: string,
): StoredRuleAssociation => {
  const assoc = ctx.store.get<StoredRuleAssociation>(assocKey(id));
  if (!assoc) {
    throw awsError(
      "ResourceNotFoundException",
      `Resolver rule association with ID '${id}' does not exist.`,
      400,
    );
  }
  return assoc;
};

const requireArnExists = (ctx: ServiceContext, arn: string): void => {
  const parts = arn.split(":");
  if (parts.length < 6) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource '${arn}' does not exist.`,
      400,
    );
  }
  const slashIdx = parts[5].indexOf("/");
  if (slashIdx < 0) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource '${arn}' does not exist.`,
      400,
    );
  }
  const resourceType = parts[5].slice(0, slashIdx);
  const id = parts[5].slice(slashIdx + 1);
  if (resourceType === "resolver-endpoint") requireEndpoint(ctx, id);
  else if (resourceType === "resolver-rule") requireRule(ctx, id);
  else if (resourceType === "firewall-rule-group") requireFwrg(ctx, id);
  else if (resourceType === "firewall-domain-list") requireFwdl(ctx, id);
  else if (resourceType === "resolver-query-log-config")
    requireQlConfig(ctx, id);
  else {
    throw awsError(
      "ResourceNotFoundException",
      `Resource '${arn}' does not exist.`,
      400,
    );
  }
};

const endpointView = (ep: StoredEndpoint): Record<string, unknown> => ({
  Id: ep.Id,
  CreatorRequestId: ep.CreatorRequestId,
  Arn: ep.Arn,
  Name: ep.Name,
  SecurityGroupIds: ep.SecurityGroupIds,
  Direction: ep.Direction,
  IpAddressCount: ep.ipAddresses.length,
  HostVPCId: ep.HostVPCId,
  Status: ep.Status,
  StatusMessage: ep.StatusMessage,
  CreationTime: ep.CreationTime,
  ModificationTime: ep.ModificationTime,
  ResolverEndpointType: ep.ResolverEndpointType,
  Protocols: ep.Protocols,
});

const ruleView = (rule: StoredRule): Record<string, unknown> => ({
  Id: rule.Id,
  CreatorRequestId: rule.CreatorRequestId,
  Arn: rule.Arn,
  DomainName: rule.DomainName,
  Name: rule.Name,
  RuleType: rule.RuleType,
  Status: rule.Status,
  StatusMessage: rule.StatusMessage,
  OwnerId: rule.OwnerId,
  ShareStatus: rule.ShareStatus,
  CreationTime: rule.CreationTime,
  ModificationTime: rule.ModificationTime,
  ResolverEndpointId: rule.ResolverEndpointId,
  TargetIps: rule.TargetIps,
});

const assocView = (assoc: StoredRuleAssociation): Record<string, unknown> => ({
  Id: assoc.Id,
  ResolverRuleId: assoc.ResolverRuleId,
  Name: assoc.Name,
  VPCId: assoc.VPCId,
  Status: assoc.Status,
  StatusMessage: assoc.StatusMessage,
});

const getEndpointOperational = (ep: StoredEndpoint): StoredEndpoint => {
  if (ep.Status === "CREATING") {
    return {
      ...ep,
      Status: "OPERATIONAL",
      StatusMessage: "This Resolver Endpoint is operational.",
    };
  }
  return ep;
};

const getRuleComplete = (rule: StoredRule): StoredRule => {
  if (rule.Status === "CREATING") {
    return {
      ...rule,
      Status: "COMPLETE",
      StatusMessage: "This Resolver Rule is complete.",
    };
  }
  return rule;
};

const getAssocComplete = (
  assoc: StoredRuleAssociation,
): StoredRuleAssociation => {
  if (assoc.Status === "CREATING") {
    return {
      ...assoc,
      Status: "COMPLETE",
      StatusMessage:
        "This association between a Resolver rule and a VPC is complete.",
    };
  }
  return assoc;
};

const VALID_RULE_FILTER_NAMES = new Set([
  "CreatorRequestId",
  "DomainName",
  "Name",
  "ResolverEndpointId",
  "RuleType",
  "Status",
  "Type",
]);

const normalizeDomain = (d: string): string => {
  const lower = d.toLowerCase();
  return lower.endsWith(".") ? lower : lower + ".";
};

const validateRuleTypeSemantics = (
  ruleType: string,
  resolverEndpointId: string | undefined,
  targetIps: StoredRule["TargetIps"],
  ctx: ServiceContext,
): void => {
  if (ruleType === "FORWARD") {
    if (!targetIps || targetIps.length === 0) {
      throw awsError(
        "InvalidRequestException",
        "TargetIps is required for FORWARD rules.",
        400,
      );
    }
    if (resolverEndpointId) {
      const ep = requireEndpoint(ctx, resolverEndpointId);
      if (ep.Direction !== "OUTBOUND") {
        throw awsError(
          "InvalidRequestException",
          `ResolverEndpointId '${resolverEndpointId}' must reference an OUTBOUND endpoint.`,
          400,
        );
      }
    }
  } else if (ruleType === "SYSTEM" || ruleType === "DELEGATE") {
    if (targetIps && targetIps.length > 0) {
      throw awsError(
        "InvalidRequestException",
        `TargetIps is not allowed for ${ruleType} rules.`,
        400,
      );
    }
    if (resolverEndpointId) {
      throw awsError(
        "InvalidRequestException",
        `ResolverEndpointId is not allowed for ${ruleType} rules.`,
        400,
      );
    }
  }
};

const fwrgView = (g: StoredFirewallRuleGroup): Record<string, unknown> => ({
  Id: g.Id,
  CreatorRequestId: g.CreatorRequestId,
  Arn: g.Arn,
  Name: g.Name,
  Status: g.Status,
  StatusMessage: g.StatusMessage,
  RuleCount: g.RuleCount,
  OwnerId: g.OwnerId,
  ShareStatus: g.ShareStatus,
  CreationTime: g.CreationTime,
  ModificationTime: g.ModificationTime,
});

const fwdlView = (d: StoredFirewallDomainList): Record<string, unknown> => ({
  Id: d.Id,
  CreatorRequestId: d.CreatorRequestId,
  Arn: d.Arn,
  Name: d.Name,
  Status: d.Status,
  StatusMessage: d.StatusMessage,
  DomainCount: d.DomainCount,
  CreationTime: d.CreationTime,
  ModificationTime: d.ModificationTime,
});

const fwRuleView = (r: StoredFirewallRule): Record<string, unknown> => ({
  FirewallRuleGroupId: r.FirewallRuleGroupId,
  FirewallDomainListId: r.FirewallDomainListId,
  Name: r.Name,
  Priority: r.Priority,
  Action: r.Action,
  BlockResponse: r.BlockResponse,
  BlockOverrideDomain: r.BlockOverrideDomain,
  BlockOverrideDnsType: r.BlockOverrideDnsType,
  BlockOverrideTtl: r.BlockOverrideTtl,
  CreationTime: r.CreationTime,
  ModificationTime: r.ModificationTime,
  DnsThreatProtection: r.DnsThreatProtection,
  ConfidenceThreshold: r.ConfidenceThreshold,
});

const fwAssocView = (
  a: StoredFirewallRuleGroupAssociation,
): Record<string, unknown> => ({
  Id: a.Id,
  Arn: a.Arn,
  VpcId: a.VpcId,
  FirewallRuleGroupId: a.FirewallRuleGroupId,
  Name: a.Name,
  Priority: a.Priority,
  MutationProtection: a.MutationProtection,
  Status: a.Status,
  StatusMessage: a.StatusMessage,
  CreationTime: a.CreationTime,
  ModificationTime: a.ModificationTime,
  ManagedOwnerName: a.ManagedOwnerName,
});

const fwConfigView = (c: StoredFirewallConfig): Record<string, unknown> => ({
  ResourceId: c.ResourceId,
  OwnerId: c.OwnerId,
  FirewallFailOpen: c.FirewallFailOpen,
});

const qlConfigView = (c: StoredQueryLogConfig): Record<string, unknown> => ({
  Id: c.Id,
  OwnerId: c.OwnerId,
  Status: c.Status,
  AssociationCount: c.AssociationCount,
  Arn: c.Arn,
  Name: c.Name,
  DestinationArn: c.DestinationArn,
  CreatorRequestId: c.CreatorRequestId,
  CreationTime: c.CreationTime,
});

const qlAssocView = (
  a: StoredQueryLogConfigAssociation,
): Record<string, unknown> => ({
  Id: a.Id,
  ResolverQueryLogConfigId: a.ResolverQueryLogConfigId,
  ResourceId: a.ResourceId,
  Status: a.Status,
  Error: a.Error,
  ErrorMessage: a.ErrorMessage,
  CreationTime: a.CreationTime,
});

const resolverConfigView = (
  c: StoredResolverConfig,
): Record<string, unknown> => ({
  ResourceId: c.ResourceId,
  OwnerId: c.OwnerId,
  AutodefinedReverse: c.AutodefinedReverse,
});

const dnssecConfigView = (c: StoredDnssecConfig): Record<string, unknown> => ({
  Id: c.Id,
  OwnerId: c.OwnerId,
  ResourceId: c.ResourceId,
  ValidationStatus: c.ValidationStatus,
});

const outpostView = (o: StoredOutpostResolver): Record<string, unknown> => ({
  Id: o.Id,
  CreatorRequestId: o.CreatorRequestId,
  Arn: o.Arn,
  Name: o.Name,
  Status: o.Status,
  StatusMessage: o.StatusMessage,
  PreferredInstanceType: o.PreferredInstanceType,
  OutpostArn: o.OutpostArn,
  InstanceCount: o.InstanceCount,
  CreationTime: o.CreationTime,
  ModificationTime: o.ModificationTime,
});

const getOrCreateFirewallConfig = (
  ctx: ServiceContext,
  resourceId: string,
): StoredFirewallConfig => {
  const existing = ctx.store.get<StoredFirewallConfig>(fwConfigKey(resourceId));
  if (existing) return existing;
  const cfg: StoredFirewallConfig = {
    ResourceId: resourceId,
    OwnerId: ctx.account,
    FirewallFailOpen: "DISABLED",
  };
  ctx.store.set(fwConfigKey(resourceId), cfg);
  return cfg;
};

const getOrCreateResolverConfig = (
  ctx: ServiceContext,
  resourceId: string,
): StoredResolverConfig => {
  const existing = ctx.store.get<StoredResolverConfig>(
    resolverConfigKey(resourceId),
  );
  if (existing) return existing;
  const cfg: StoredResolverConfig = {
    ResourceId: resourceId,
    OwnerId: ctx.account,
    AutodefinedReverse: "ENABLED",
  };
  ctx.store.set(resolverConfigKey(resourceId), cfg);
  return cfg;
};

const getOrCreateDnssecConfig = (
  ctx: ServiceContext,
  resourceId: string,
): StoredDnssecConfig => {
  const existing = ctx.store.get<StoredDnssecConfig>(
    dnssecConfigKey(resourceId),
  );
  if (existing) {
    if (existing.ValidationStatus === "ENABLING") {
      const updated = { ...existing, ValidationStatus: "ENABLED" };
      ctx.store.set(dnssecConfigKey(resourceId), updated);
      return updated;
    }
    return existing;
  }
  const id = nextId();
  const cfg: StoredDnssecConfig = {
    Id: id,
    OwnerId: ctx.account,
    ResourceId: resourceId,
    ValidationStatus: "ENABLED",
  };
  ctx.store.set(dnssecConfigKey(resourceId), cfg);
  return cfg;
};

const recomputeFwrgRuleCount = (
  ctx: ServiceContext,
  ruleGroupId: string,
): void => {
  const count = ctx.store
    .list<StoredFirewallRule>()
    .filter(
      (e) =>
        e.key.startsWith("fwrule/") &&
        e.value.FirewallRuleGroupId === ruleGroupId,
    ).length;
  const g = ctx.store.get<StoredFirewallRuleGroup>(fwrgKey(ruleGroupId));
  if (g) ctx.store.set(fwrgKey(ruleGroupId), { ...g, RuleCount: count });
};

const applyFilters = (
  items: Record<string, unknown>[],
  filters: Array<{ Name: string; Values: string[] }>,
): Record<string, unknown>[] => {
  if (!filters || filters.length === 0) return items;
  return items.filter((item) =>
    filters.every((f) => {
      const val = item[f.Name];
      if (val === undefined || val === null) return false;
      return f.Values.includes(String(val));
    }),
  );
};

const CreateResolverEndpoint: OperationHandler = (input, ctx) => {
  const creatorRequestId = input["CreatorRequestId"] as string;
  const existingId = ctx.store.get<string>(
    creatorEndpointKey(creatorRequestId),
  );
  if (existingId) {
    const ep = ctx.store.get<StoredEndpoint>(endpointKey(existingId));
    if (ep) {
      throw awsError(
        "ResourceExistsException",
        `Resolver endpoint with CreatorRequestId '${creatorRequestId}' already exists.`,
        400,
      );
    }
  }

  const id = nextId();
  const arn = `arn:aws:route53resolver:${ctx.region}:${ctx.account}:resolver-endpoint/${id}`;
  const ipReqs =
    (input["IpAddresses"] as Array<{
      SubnetId: string;
      Ip?: string;
      Ipv6?: string;
    }>) ?? [];
  const vpcId = "vpc-" + id.slice(-8);

  const ipEntries: IpAddressEntry[] = ipReqs.map((req) => ({
    IpId: nextIpId(),
    SubnetId: req.SubnetId,
    Ip: req.Ip,
    Ipv6: req.Ipv6,
    Status: "ATTACHED",
    StatusMessage: "This IP address is operational.",
    CreationTime: now(),
    ModificationTime: now(),
  }));

  const ep: StoredEndpoint = {
    Id: id,
    CreatorRequestId: creatorRequestId,
    Arn: arn,
    Name: input["Name"] as string | undefined,
    SecurityGroupIds: (input["SecurityGroupIds"] as string[]) ?? [],
    Direction: input["Direction"] as string,
    IpAddressCount: ipEntries.length,
    HostVPCId: vpcId,
    Status: "CREATING",
    StatusMessage: "Creating the Resolver Endpoint.",
    CreationTime: now(),
    ModificationTime: now(),
    ResolverEndpointType: input["ResolverEndpointType"] as string | undefined,
    Protocols: input["Protocols"] as string[] | undefined,
    ipAddresses: ipEntries,
  };

  ctx.store.set(endpointKey(id), ep);
  ctx.store.set(creatorEndpointKey(creatorRequestId), id);

  const tags =
    (input["Tags"] as Array<{ Key: string; Value: string }> | undefined) ?? [];
  if (tags.length > 0) {
    const tagMap: Record<string, string> = {};
    for (const t of tags) tagMap[t.Key] = t.Value;
    ctx.store.set(tagsKey(arn), tagMap);
  }

  return { ResolverEndpoint: endpointView(ep) };
};

const GetResolverEndpoint: OperationHandler = (input, ctx) => {
  const id = input["ResolverEndpointId"] as string;
  const ep = requireEndpoint(ctx, id);
  return { ResolverEndpoint: endpointView(getEndpointOperational(ep)) };
};

const UpdateResolverEndpoint: OperationHandler = (input, ctx) => {
  const id = input["ResolverEndpointId"] as string;
  const ep = requireEndpoint(ctx, id);
  const updated: StoredEndpoint = {
    ...ep,
    Name: input["Name"] !== undefined ? (input["Name"] as string) : ep.Name,
    ResolverEndpointType:
      input["ResolverEndpointType"] !== undefined
        ? (input["ResolverEndpointType"] as string)
        : ep.ResolverEndpointType,
    Protocols:
      input["Protocols"] !== undefined
        ? (input["Protocols"] as string[])
        : ep.Protocols,
    ModificationTime: now(),
  };
  ctx.store.set(endpointKey(id), updated);
  return { ResolverEndpoint: endpointView(getEndpointOperational(updated)) };
};

const DeleteResolverEndpoint: OperationHandler = (input, ctx) => {
  const id = input["ResolverEndpointId"] as string;
  const ep = requireEndpoint(ctx, id);

  const rulesUsingEndpoint = ctx.store
    .list<StoredRule>()
    .filter(
      (e) => e.key.startsWith("rule/") && e.value.ResolverEndpointId === id,
    );
  if (rulesUsingEndpoint.length > 0) {
    throw awsError(
      "InvalidRequestException",
      `Resolver endpoint '${id}' cannot be deleted because it is referenced by one or more Resolver rules.`,
      400,
    );
  }

  const deleting: StoredEndpoint = {
    ...ep,
    Status: "DELETING",
    StatusMessage: "Deleting.",
  };
  ctx.store.set(endpointKey(id), deleting);
  ctx.store.delete(endpointKey(id));
  ctx.store.delete(tagsKey(ep.Arn));
  return { ResolverEndpoint: endpointView(deleting) };
};

const ListResolverEndpoints: OperationHandler = (input, ctx) => {
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const filters =
    (input["Filters"] as
      | Array<{ Name: string; Values: string[] }>
      | undefined) ?? [];

  let all = ctx.store
    .list<StoredEndpoint>()
    .filter((e) => e.key.startsWith("endpoint/"))
    .map((e) => getEndpointOperational(e.value));

  const filtered = applyFilters(
    all.map((ep) => endpointView(ep) as Record<string, unknown>),
    filters,
  );

  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = filtered.slice(start, start + maxResults);
  const newToken =
    start + maxResults < filtered.length
      ? String(start + maxResults)
      : undefined;

  return {
    ResolverEndpoints: page,
    NextToken: newToken,
    MaxResults: maxResults,
  };
};

const AssociateResolverEndpointIpAddress: OperationHandler = (input, ctx) => {
  const id = input["ResolverEndpointId"] as string;
  const ep = requireEndpoint(ctx, id);
  const ipReq = input["IpAddress"] as {
    SubnetId?: string;
    Ip?: string;
    Ipv6?: string;
    IpId?: string;
  };

  const duplicate = ep.ipAddresses.find(
    (ip) =>
      (ipReq.Ip && ip.Ip === ipReq.Ip) ||
      (ipReq.Ipv6 && ip.Ipv6 === ipReq.Ipv6),
  );
  if (duplicate) {
    throw awsError(
      "ResourceExistsException",
      `IP address '${ipReq.Ip ?? ipReq.Ipv6}' is already associated with endpoint '${id}'.`,
      400,
    );
  }

  const newIp: IpAddressEntry = {
    IpId: ipReq.IpId ?? nextIpId(),
    SubnetId: ipReq.SubnetId ?? "",
    Ip: ipReq.Ip,
    Ipv6: ipReq.Ipv6,
    Status: "ATTACHED",
    StatusMessage: "This IP address is operational.",
    CreationTime: now(),
    ModificationTime: now(),
  };
  const updated: StoredEndpoint = {
    ...ep,
    ipAddresses: [...ep.ipAddresses, newIp],
    IpAddressCount: ep.ipAddresses.length + 1,
    ModificationTime: now(),
  };
  ctx.store.set(endpointKey(id), updated);
  return { ResolverEndpoint: endpointView(getEndpointOperational(updated)) };
};

const DisassociateResolverEndpointIpAddress: OperationHandler = (
  input,
  ctx,
) => {
  const id = input["ResolverEndpointId"] as string;
  const ep = requireEndpoint(ctx, id);
  const ipReq = input["IpAddress"] as {
    IpId?: string;
    Ip?: string;
    SubnetId?: string;
  };
  const remaining = ep.ipAddresses.filter((ip) => {
    if (ipReq.IpId && ip.IpId === ipReq.IpId) return false;
    if (!ipReq.IpId && ipReq.Ip && ip.Ip === ipReq.Ip) return false;
    return true;
  });

  if (remaining.length === ep.ipAddresses.length) {
    throw awsError(
      "ResourceNotFoundException",
      `IP address not found on endpoint '${id}'.`,
      400,
    );
  }
  if (remaining.length < 2) {
    throw awsError(
      "InvalidRequestException",
      `Resolver endpoint '${id}' must have at least 2 IP addresses.`,
      400,
    );
  }

  const updated: StoredEndpoint = {
    ...ep,
    ipAddresses: remaining,
    IpAddressCount: remaining.length,
    ModificationTime: now(),
  };
  ctx.store.set(endpointKey(id), updated);
  return { ResolverEndpoint: endpointView(getEndpointOperational(updated)) };
};

const ListResolverEndpointIpAddresses: OperationHandler = (input, ctx) => {
  const id = input["ResolverEndpointId"] as string;
  const ep = requireEndpoint(ctx, id);
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = ep.ipAddresses.slice(start, start + maxResults);
  const newToken =
    start + maxResults < ep.ipAddresses.length
      ? String(start + maxResults)
      : undefined;
  return {
    IpAddresses: page.map((ip) => ({
      IpId: ip.IpId,
      SubnetId: ip.SubnetId,
      Ip: ip.Ip,
      Ipv6: ip.Ipv6,
      Status: ip.Status,
      StatusMessage: ip.StatusMessage,
      CreationTime: ip.CreationTime,
      ModificationTime: ip.ModificationTime,
    })),
    NextToken: newToken,
    MaxResults: maxResults,
  };
};

const CreateResolverRule: OperationHandler = (input, ctx) => {
  const creatorRequestId = input["CreatorRequestId"] as string;
  const existingId = ctx.store.get<string>(creatorRuleKey(creatorRequestId));
  if (existingId) {
    const rule = ctx.store.get<StoredRule>(ruleKey(existingId));
    if (rule) {
      throw awsError(
        "ResourceExistsException",
        `Resolver rule with CreatorRequestId '${creatorRequestId}' already exists.`,
        400,
      );
    }
  }

  const ruleType = input["RuleType"] as string;
  const resolverEndpointId = input["ResolverEndpointId"] as string | undefined;
  const targetIps = input["TargetIps"] as StoredRule["TargetIps"];
  validateRuleTypeSemantics(ruleType, resolverEndpointId, targetIps, ctx);

  const id = nextId();
  const arn = `arn:aws:route53resolver:${ctx.region}:${ctx.account}:resolver-rule/${id}`;

  const rule: StoredRule = {
    Id: id,
    CreatorRequestId: creatorRequestId,
    Arn: arn,
    DomainName: input["DomainName"] as string | undefined,
    Name: input["Name"] as string | undefined,
    RuleType: ruleType,
    Status: "CREATING",
    StatusMessage: "Creating the Resolver Rule.",
    OwnerId: ctx.account,
    ShareStatus: "NOT_SHARED",
    CreationTime: now(),
    ModificationTime: now(),
    ResolverEndpointId: resolverEndpointId,
    TargetIps: targetIps,
  };

  ctx.store.set(ruleKey(id), rule);
  ctx.store.set(creatorRuleKey(creatorRequestId), id);

  const tags =
    (input["Tags"] as Array<{ Key: string; Value: string }> | undefined) ?? [];
  if (tags.length > 0) {
    const tagMap: Record<string, string> = {};
    for (const t of tags) tagMap[t.Key] = t.Value;
    ctx.store.set(tagsKey(arn), tagMap);
  }

  return { ResolverRule: ruleView(rule) };
};

const GetResolverRule: OperationHandler = (input, ctx) => {
  const id = input["ResolverRuleId"] as string;
  const rule = requireRule(ctx, id);
  return { ResolverRule: ruleView(getRuleComplete(rule)) };
};

const UpdateResolverRule: OperationHandler = (input, ctx) => {
  const id = input["ResolverRuleId"] as string;
  const rule = requireRule(ctx, id);
  const config = (input["Config"] as Record<string, unknown> | undefined) ?? {};

  const newResolverEndpointId =
    config["ResolverEndpointId"] !== undefined
      ? (config["ResolverEndpointId"] as string | undefined)
      : rule.ResolverEndpointId;
  const newTargetIps =
    config["TargetIps"] !== undefined
      ? (config["TargetIps"] as StoredRule["TargetIps"])
      : rule.TargetIps;

  if (
    config["ResolverEndpointId"] !== undefined ||
    config["TargetIps"] !== undefined
  ) {
    validateRuleTypeSemantics(
      rule.RuleType,
      newResolverEndpointId,
      newTargetIps,
      ctx,
    );
  }

  const updated: StoredRule = {
    ...rule,
    Name: config["Name"] !== undefined ? (config["Name"] as string) : rule.Name,
    ResolverEndpointId: newResolverEndpointId,
    TargetIps: newTargetIps,
    ModificationTime: now(),
  };
  ctx.store.set(ruleKey(id), updated);
  return { ResolverRule: ruleView(getRuleComplete(updated)) };
};

const DeleteResolverRule: OperationHandler = (input, ctx) => {
  const id = input["ResolverRuleId"] as string;
  const rule = requireRule(ctx, id);

  const assocs = ctx.store
    .list<StoredRuleAssociation>()
    .filter((e) => e.key.startsWith("assoc/") && e.value.ResolverRuleId === id);

  if (assocs.length > 0) {
    throw awsError(
      "ResourceInUseException",
      `Resolver rule '${id}' cannot be deleted because it is associated with a VPC.`,
      400,
    );
  }

  const deleting: StoredRule = {
    ...rule,
    Status: "DELETING",
    StatusMessage: "Deleting.",
  };
  ctx.store.set(ruleKey(id), deleting);
  ctx.store.delete(ruleKey(id));
  ctx.store.delete(tagsKey(rule.Arn));
  return { ResolverRule: ruleView(deleting) };
};

const ListResolverRules: OperationHandler = (input, ctx) => {
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const filters =
    (input["Filters"] as
      | Array<{ Name: string; Values: string[] }>
      | undefined) ?? [];

  for (const f of filters) {
    if (!VALID_RULE_FILTER_NAMES.has(f.Name)) {
      throw awsError(
        "InvalidParameterException",
        `Unknown filter name: '${f.Name}'.`,
        400,
      );
    }
  }

  const all = ctx.store
    .list<StoredRule>()
    .filter((e) => e.key.startsWith("rule/"))
    .map((e) => getRuleComplete(e.value));

  const views = all.map((r) => ruleView(r) as Record<string, unknown>);

  const filtered = views.filter((item) =>
    filters.every((f) => {
      const normName = f.Name === "Type" ? "RuleType" : f.Name;
      const val = item[normName];
      if (val === undefined || val === null) return false;
      if (normName === "DomainName") {
        const normVal = normalizeDomain(String(val));
        return f.Values.some((fv) => normalizeDomain(fv) === normVal);
      }
      const normValues = f.Values.map((v) => v.toUpperCase());
      return normValues.includes(String(val).toUpperCase());
    }),
  );

  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = filtered.slice(start, start + maxResults);
  const newToken =
    start + maxResults < filtered.length
      ? String(start + maxResults)
      : undefined;

  return {
    ResolverRules: page,
    NextToken: newToken,
    MaxResults: maxResults,
  };
};

const AssociateResolverRule: OperationHandler = (input, ctx) => {
  const ruleId = input["ResolverRuleId"] as string;
  const vpcId = input["VPCId"] as string;

  requireRule(ctx, ruleId);

  const existing = ctx.store
    .list<StoredRuleAssociation>()
    .find(
      (e) =>
        e.key.startsWith("assoc/") &&
        e.value.ResolverRuleId === ruleId &&
        e.value.VPCId === vpcId,
    );

  if (existing) {
    throw awsError(
      "ResourceExistsException",
      `Resolver rule '${ruleId}' is already associated with VPC '${vpcId}'.`,
      400,
    );
  }

  const id = nextId();
  const assoc: StoredRuleAssociation = {
    Id: id,
    ResolverRuleId: ruleId,
    Name: input["Name"] as string | undefined,
    VPCId: vpcId,
    Status: "CREATING",
    StatusMessage:
      "Creating the association between a Resolver rule and a VPC.",
  };
  ctx.store.set(assocKey(id), assoc);
  return { ResolverRuleAssociation: assocView(assoc) };
};

const DisassociateResolverRule: OperationHandler = (input, ctx) => {
  const ruleId = input["ResolverRuleId"] as string;
  const vpcId = input["VPCId"] as string;

  const existing = ctx.store
    .list<StoredRuleAssociation>()
    .find(
      (e) =>
        e.key.startsWith("assoc/") &&
        e.value.ResolverRuleId === ruleId &&
        e.value.VPCId === vpcId,
    );

  if (!existing) {
    throw awsError(
      "ResourceNotFoundException",
      `The Resolver rule '${ruleId}' is not associated with VPC '${vpcId}'.`,
      400,
    );
  }

  const assoc = existing.value;
  const deleting: StoredRuleAssociation = {
    ...assoc,
    Status: "DELETING",
    StatusMessage: "Deleting.",
  };
  ctx.store.set(assocKey(assoc.Id), deleting);
  ctx.store.delete(assocKey(assoc.Id));
  return { ResolverRuleAssociation: assocView(deleting) };
};

const GetResolverRuleAssociation: OperationHandler = (input, ctx) => {
  const id = input["ResolverRuleAssociationId"] as string;
  const assoc = requireAssoc(ctx, id);
  return { ResolverRuleAssociation: assocView(getAssocComplete(assoc)) };
};

const ListResolverRuleAssociations: OperationHandler = (input, ctx) => {
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const filters =
    (input["Filters"] as
      | Array<{ Name: string; Values: string[] }>
      | undefined) ?? [];

  const all = ctx.store
    .list<StoredRuleAssociation>()
    .filter((e) => e.key.startsWith("assoc/"))
    .map((e) => getAssocComplete(e.value));

  const filtered = applyFilters(
    all.map((a) => assocView(a) as Record<string, unknown>),
    filters,
  );

  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = filtered.slice(start, start + maxResults);
  const newToken =
    start + maxResults < filtered.length
      ? String(start + maxResults)
      : undefined;

  return {
    ResolverRuleAssociations: page,
    NextToken: newToken,
    MaxResults: maxResults,
  };
};

const CreateFirewallRuleGroup: OperationHandler = (input, ctx) => {
  const creatorRequestId = input["CreatorRequestId"] as string;
  const existingId = ctx.store.get<string>(creatorFwrgKey(creatorRequestId));
  if (existingId) {
    const g = ctx.store.get<StoredFirewallRuleGroup>(fwrgKey(existingId));
    if (g) return { FirewallRuleGroup: fwrgView(g) };
  }
  const id = nextId();
  const arn = `arn:aws:route53resolver:${ctx.region}:${ctx.account}:firewall-rule-group/${id}`;
  const g: StoredFirewallRuleGroup = {
    Id: id,
    CreatorRequestId: creatorRequestId,
    Arn: arn,
    Name: input["Name"] as string,
    Status: "COMPLETE",
    StatusMessage: "Done",
    RuleCount: 0,
    OwnerId: ctx.account,
    ShareStatus: "NOT_SHARED",
    CreationTime: now(),
    ModificationTime: now(),
  };
  ctx.store.set(fwrgKey(id), g);
  ctx.store.set(creatorFwrgKey(creatorRequestId), id);
  const tags =
    (input["Tags"] as Array<{ Key: string; Value: string }> | undefined) ?? [];
  if (tags.length > 0) {
    const tagMap: Record<string, string> = {};
    for (const t of tags) tagMap[t.Key] = t.Value;
    ctx.store.set(tagsKey(arn), tagMap);
  }
  return { FirewallRuleGroup: fwrgView(g) };
};

const GetFirewallRuleGroup: OperationHandler = (input, ctx) => {
  const id = input["FirewallRuleGroupId"] as string;
  const g = requireFwrg(ctx, id);
  return { FirewallRuleGroup: fwrgView(g) };
};

const ListFirewallRuleGroups: OperationHandler = (input, ctx) => {
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const all = ctx.store
    .list<StoredFirewallRuleGroup>()
    .filter((e) => e.key.startsWith("fwrg/"))
    .map((e) => e.value);
  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = all.slice(start, start + maxResults);
  const newToken =
    start + maxResults < all.length ? String(start + maxResults) : undefined;
  return {
    FirewallRuleGroups: page.map((g) => fwrgView(g)),
    NextToken: newToken,
  };
};

const DeleteFirewallRuleGroup: OperationHandler = (input, ctx) => {
  const id = input["FirewallRuleGroupId"] as string;
  const g = requireFwrg(ctx, id);
  const assocs = ctx.store
    .list<StoredFirewallRuleGroupAssociation>()
    .filter(
      (e) => e.key.startsWith("fwassoc/") && e.value.FirewallRuleGroupId === id,
    );
  if (assocs.length > 0) {
    throw awsError(
      "ResourceInUseException",
      `Firewall rule group '${id}' is associated with one or more VPCs.`,
      400,
    );
  }
  ctx.store.delete(fwrgKey(id));
  return { FirewallRuleGroup: fwrgView({ ...g, Status: "DELETING" }) };
};

const CreateFirewallDomainList: OperationHandler = (input, ctx) => {
  const creatorRequestId = input["CreatorRequestId"] as string;
  const existingId = ctx.store.get<string>(creatorFwdlKey(creatorRequestId));
  if (existingId) {
    const d = ctx.store.get<StoredFirewallDomainList>(fwdlKey(existingId));
    if (d) return { FirewallDomainList: fwdlView(d) };
  }
  const id = nextId();
  const arn = `arn:aws:route53resolver:${ctx.region}:${ctx.account}:firewall-domain-list/${id}`;
  const d: StoredFirewallDomainList = {
    Id: id,
    CreatorRequestId: creatorRequestId,
    Arn: arn,
    Name: input["Name"] as string,
    Status: "COMPLETE",
    StatusMessage: "Done",
    DomainCount: 0,
    CreationTime: now(),
    ModificationTime: now(),
    domains: [],
  };
  ctx.store.set(fwdlKey(id), d);
  ctx.store.set(creatorFwdlKey(creatorRequestId), id);
  const tags =
    (input["Tags"] as Array<{ Key: string; Value: string }> | undefined) ?? [];
  if (tags.length > 0) {
    const tagMap: Record<string, string> = {};
    for (const t of tags) tagMap[t.Key] = t.Value;
    ctx.store.set(tagsKey(arn), tagMap);
  }
  return { FirewallDomainList: fwdlView(d) };
};

const GetFirewallDomainList: OperationHandler = (input, ctx) => {
  const id = input["FirewallDomainListId"] as string;
  const d = requireFwdl(ctx, id);
  return { FirewallDomainList: fwdlView(d) };
};

const ListFirewallDomainLists: OperationHandler = (input, ctx) => {
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const all = ctx.store
    .list<StoredFirewallDomainList>()
    .filter((e) => e.key.startsWith("fwdl/"))
    .map((e) => e.value);
  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = all.slice(start, start + maxResults);
  const newToken =
    start + maxResults < all.length ? String(start + maxResults) : undefined;
  return {
    FirewallDomainLists: page.map((d) => fwdlView(d)),
    NextToken: newToken,
  };
};

const UpdateFirewallDomains: OperationHandler = (input, ctx) => {
  const id = input["FirewallDomainListId"] as string;
  const d = requireFwdl(ctx, id);
  const operation = input["Operation"] as string;
  const domains = (input["Domains"] as string[] | undefined) ?? [];
  let updated: string[];
  if (operation === "ADD") {
    updated = [...new Set([...d.domains, ...domains])];
  } else if (operation === "REMOVE") {
    const removeSet = new Set(domains);
    updated = d.domains.filter((x) => !removeSet.has(x));
  } else {
    updated = domains;
  }
  const newD: StoredFirewallDomainList = {
    ...d,
    domains: updated,
    DomainCount: updated.length,
    ModificationTime: now(),
    Status: "COMPLETE",
    StatusMessage: "Done",
  };
  ctx.store.set(fwdlKey(id), newD);
  return {
    Id: newD.Id,
    Name: newD.Name,
    Status: newD.Status,
    StatusMessage: newD.StatusMessage,
  };
};

const ImportFirewallDomains: OperationHandler = (input, ctx) => {
  const id = input["FirewallDomainListId"] as string;
  const d = requireFwdl(ctx, id);
  const newD: StoredFirewallDomainList = {
    ...d,
    ModificationTime: now(),
    Status: "IMPORTING",
    StatusMessage: "Importing domains.",
  };
  ctx.store.set(fwdlKey(id), {
    ...newD,
    Status: "COMPLETE",
    StatusMessage: "Done",
  });
  return {
    Id: newD.Id,
    Name: newD.Name,
    Status: "IMPORTING",
    StatusMessage: "Importing domains.",
  };
};

const DeleteFirewallDomainList: OperationHandler = (input, ctx) => {
  const id = input["FirewallDomainListId"] as string;
  const d = requireFwdl(ctx, id);
  const inUse = ctx.store
    .list<StoredFirewallRule>()
    .some(
      (e) => e.key.startsWith("fwrule/") && e.value.FirewallDomainListId === id,
    );
  if (inUse) {
    throw awsError(
      "ResourceInUseException",
      `Firewall domain list '${id}' is in use by one or more firewall rules.`,
      400,
    );
  }
  ctx.store.delete(fwdlKey(id));
  return { FirewallDomainList: fwdlView({ ...d, Status: "DELETING" }) };
};

const ListFirewallDomains: OperationHandler = (input, ctx) => {
  const id = input["FirewallDomainListId"] as string;
  const d = requireFwdl(ctx, id);
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = d.domains.slice(start, start + maxResults);
  const newToken =
    start + maxResults < d.domains.length
      ? String(start + maxResults)
      : undefined;
  return { Domains: page, NextToken: newToken };
};

const ListFirewallRuleTypes: OperationHandler = (_input, _ctx) => {
  return { FirewallRuleTypes: [] };
};

const CreateFirewallRule: OperationHandler = (input, ctx) => {
  const ruleGroupId = input["FirewallRuleGroupId"] as string;
  requireFwrg(ctx, ruleGroupId);
  const domainListId = input["FirewallDomainListId"] as string | undefined;
  const ruleKey2 = fwRuleKey(ruleGroupId, domainListId ?? `threat-${nextId()}`);
  const existing = ctx.store.get<StoredFirewallRule>(ruleKey2);
  if (existing) {
    return { FirewallRule: fwRuleView(existing) };
  }
  const rule: StoredFirewallRule = {
    FirewallRuleGroupId: ruleGroupId,
    FirewallDomainListId: domainListId,
    Name: input["Name"] as string,
    Priority: input["Priority"] as number,
    Action: input["Action"] as string,
    BlockResponse: input["BlockResponse"] as string | undefined,
    BlockOverrideDomain: input["BlockOverrideDomain"] as string | undefined,
    BlockOverrideDnsType: input["BlockOverrideDnsType"] as string | undefined,
    BlockOverrideTtl: input["BlockOverrideTtl"] as number | undefined,
    CreationTime: now(),
    ModificationTime: now(),
    CreatorRequestId: input["CreatorRequestId"] as string | undefined,
    DnsThreatProtection: input["DnsThreatProtection"] as string | undefined,
    ConfidenceThreshold: input["ConfidenceThreshold"] as string | undefined,
  };
  ctx.store.set(ruleKey2, rule);
  recomputeFwrgRuleCount(ctx, ruleGroupId);
  return { FirewallRule: fwRuleView(rule) };
};

const UpdateFirewallRule: OperationHandler = (input, ctx) => {
  const ruleGroupId = input["FirewallRuleGroupId"] as string;
  const domainListId = input["FirewallDomainListId"] as string | undefined;
  const key = fwRuleKey(ruleGroupId, domainListId ?? "");
  const rule = ctx.store.get<StoredFirewallRule>(key);
  if (!rule) {
    throw awsError(
      "ResourceNotFoundException",
      `Firewall rule not found.`,
      400,
    );
  }
  const updated: StoredFirewallRule = {
    ...rule,
    Name: input["Name"] !== undefined ? (input["Name"] as string) : rule.Name,
    Priority:
      input["Priority"] !== undefined
        ? (input["Priority"] as number)
        : rule.Priority,
    Action:
      input["Action"] !== undefined ? (input["Action"] as string) : rule.Action,
    BlockResponse:
      input["BlockResponse"] !== undefined
        ? (input["BlockResponse"] as string)
        : rule.BlockResponse,
    BlockOverrideDomain:
      input["BlockOverrideDomain"] !== undefined
        ? (input["BlockOverrideDomain"] as string)
        : rule.BlockOverrideDomain,
    BlockOverrideDnsType:
      input["BlockOverrideDnsType"] !== undefined
        ? (input["BlockOverrideDnsType"] as string)
        : rule.BlockOverrideDnsType,
    BlockOverrideTtl:
      input["BlockOverrideTtl"] !== undefined
        ? (input["BlockOverrideTtl"] as number)
        : rule.BlockOverrideTtl,
    ModificationTime: now(),
  };
  ctx.store.set(key, updated);
  return { FirewallRule: fwRuleView(updated) };
};

const DeleteFirewallRule: OperationHandler = (input, ctx) => {
  const ruleGroupId = input["FirewallRuleGroupId"] as string;
  const domainListId = input["FirewallDomainListId"] as string | undefined;
  const key = fwRuleKey(ruleGroupId, domainListId ?? "");
  const rule = ctx.store.get<StoredFirewallRule>(key);
  if (!rule) {
    throw awsError(
      "ResourceNotFoundException",
      `Firewall rule not found.`,
      400,
    );
  }
  ctx.store.delete(key);
  recomputeFwrgRuleCount(ctx, ruleGroupId);
  return { FirewallRule: fwRuleView(rule) };
};

const ListFirewallRules: OperationHandler = (input, ctx) => {
  const ruleGroupId = input["FirewallRuleGroupId"] as string;
  requireFwrg(ctx, ruleGroupId);
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const all = ctx.store
    .list<StoredFirewallRule>()
    .filter(
      (e) =>
        e.key.startsWith("fwrule/") &&
        e.value.FirewallRuleGroupId === ruleGroupId,
    )
    .map((e) => e.value)
    .sort((a, b) => a.Priority - b.Priority);
  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = all.slice(start, start + maxResults);
  const newToken =
    start + maxResults < all.length ? String(start + maxResults) : undefined;
  return {
    FirewallRules: page.map((r) => fwRuleView(r)),
    NextToken: newToken,
  };
};

const BatchCreateFirewallRule: OperationHandler = (input, ctx) => {
  const items =
    (input["CreateFirewallRuleEntries"] as
      | Array<Record<string, unknown>>
      | undefined) ?? [];
  const created: Record<string, unknown>[] = [];
  const ruleGroupIds = new Set<string>();
  for (const item of items) {
    const ruleGroupId = item["FirewallRuleGroupId"] as string;
    requireFwrg(ctx, ruleGroupId);
    const domainListId = item["FirewallDomainListId"] as string | undefined;
    const key = fwRuleKey(ruleGroupId, domainListId ?? `threat-${nextId()}`);
    const rule: StoredFirewallRule = {
      FirewallRuleGroupId: ruleGroupId,
      FirewallDomainListId: domainListId,
      Name: item["Name"] as string,
      Priority: item["Priority"] as number,
      Action: item["Action"] as string,
      BlockResponse: item["BlockResponse"] as string | undefined,
      BlockOverrideDomain: item["BlockOverrideDomain"] as string | undefined,
      BlockOverrideDnsType: item["BlockOverrideDnsType"] as string | undefined,
      BlockOverrideTtl: item["BlockOverrideTtl"] as number | undefined,
      CreationTime: now(),
      ModificationTime: now(),
      CreatorRequestId: item["CreatorRequestId"] as string | undefined,
    };
    ctx.store.set(key, rule);
    created.push(fwRuleView(rule));
    ruleGroupIds.add(ruleGroupId);
  }
  for (const rgId of ruleGroupIds) recomputeFwrgRuleCount(ctx, rgId);
  return { CreatedFirewallRules: created };
};

const BatchDeleteFirewallRule: OperationHandler = (input, ctx) => {
  const items =
    (input["DeleteFirewallRuleEntries"] as
      | Array<Record<string, unknown>>
      | undefined) ?? [];
  const deleted: Record<string, unknown>[] = [];
  const ruleGroupIds = new Set<string>();
  for (const item of items) {
    const ruleGroupId = item["FirewallRuleGroupId"] as string;
    const domainListId = item["FirewallDomainListId"] as string | undefined;
    const key = fwRuleKey(ruleGroupId, domainListId ?? "");
    const rule = ctx.store.get<StoredFirewallRule>(key);
    if (rule) {
      ctx.store.delete(key);
      deleted.push(fwRuleView(rule));
      ruleGroupIds.add(ruleGroupId);
    }
  }
  for (const rgId of ruleGroupIds) recomputeFwrgRuleCount(ctx, rgId);
  return { DeletedFirewallRules: deleted };
};

const BatchUpdateFirewallRule: OperationHandler = (input, ctx) => {
  const items =
    (input["UpdateFirewallRuleEntries"] as
      | Array<Record<string, unknown>>
      | undefined) ?? [];
  const updated: Record<string, unknown>[] = [];
  for (const item of items) {
    const ruleGroupId = item["FirewallRuleGroupId"] as string;
    const domainListId = item["FirewallDomainListId"] as string | undefined;
    const key = fwRuleKey(ruleGroupId, domainListId ?? "");
    const rule = ctx.store.get<StoredFirewallRule>(key);
    if (!rule) continue;
    const u: StoredFirewallRule = {
      ...rule,
      Name: item["Name"] !== undefined ? (item["Name"] as string) : rule.Name,
      Priority:
        item["Priority"] !== undefined
          ? (item["Priority"] as number)
          : rule.Priority,
      Action:
        item["Action"] !== undefined ? (item["Action"] as string) : rule.Action,
      ModificationTime: now(),
    };
    ctx.store.set(key, u);
    updated.push(fwRuleView(u));
  }
  return { UpdatedFirewallRules: updated };
};

const AssociateFirewallRuleGroup: OperationHandler = (input, ctx) => {
  const creatorRequestId = input["CreatorRequestId"] as string;
  const existingId = ctx.store.get<string>(creatorFwAssocKey(creatorRequestId));
  if (existingId) {
    const a = ctx.store.get<StoredFirewallRuleGroupAssociation>(
      fwAssocKey(existingId),
    );
    if (a) return { FirewallRuleGroupAssociation: fwAssocView(a) };
  }
  const ruleGroupId = input["FirewallRuleGroupId"] as string;
  requireFwrg(ctx, ruleGroupId);
  const vpcId = input["VpcId"] as string;
  const id = nextId();
  const arn = `arn:aws:route53resolver:${ctx.region}:${ctx.account}:firewall-rule-group-association/${id}`;
  const a: StoredFirewallRuleGroupAssociation = {
    Id: id,
    Arn: arn,
    VpcId: vpcId,
    FirewallRuleGroupId: ruleGroupId,
    Name: input["Name"] as string,
    Priority: input["Priority"] as number,
    MutationProtection:
      (input["MutationProtection"] as string | undefined) ?? "DISABLED",
    Status: "COMPLETE",
    StatusMessage: "Association complete.",
    CreationTime: now(),
    ModificationTime: now(),
    CreatorRequestId: creatorRequestId,
  };
  ctx.store.set(fwAssocKey(id), a);
  ctx.store.set(creatorFwAssocKey(creatorRequestId), id);
  const tags =
    (input["Tags"] as Array<{ Key: string; Value: string }> | undefined) ?? [];
  if (tags.length > 0) {
    const tagMap: Record<string, string> = {};
    for (const t of tags) tagMap[t.Key] = t.Value;
    ctx.store.set(tagsKey(arn), tagMap);
  }
  return { FirewallRuleGroupAssociation: fwAssocView(a) };
};

const GetFirewallRuleGroupAssociation: OperationHandler = (input, ctx) => {
  const id = input["FirewallRuleGroupAssociationId"] as string;
  const a = requireFwAssoc(ctx, id);
  return { FirewallRuleGroupAssociation: fwAssocView(a) };
};

const ListFirewallRuleGroupAssociations: OperationHandler = (input, ctx) => {
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const vpcId = input["VpcId"] as string | undefined;
  const ruleGroupId = input["FirewallRuleGroupId"] as string | undefined;
  let all = ctx.store
    .list<StoredFirewallRuleGroupAssociation>()
    .filter((e) => e.key.startsWith("fwassoc/"))
    .map((e) => e.value);
  if (vpcId) all = all.filter((a) => a.VpcId === vpcId);
  if (ruleGroupId)
    all = all.filter((a) => a.FirewallRuleGroupId === ruleGroupId);
  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = all.slice(start, start + maxResults);
  const newToken =
    start + maxResults < all.length ? String(start + maxResults) : undefined;
  return {
    FirewallRuleGroupAssociations: page.map((a) => fwAssocView(a)),
    NextToken: newToken,
  };
};

const UpdateFirewallRuleGroupAssociation: OperationHandler = (input, ctx) => {
  const id = input["FirewallRuleGroupAssociationId"] as string;
  const a = requireFwAssoc(ctx, id);
  const updated: StoredFirewallRuleGroupAssociation = {
    ...a,
    Name: input["Name"] !== undefined ? (input["Name"] as string) : a.Name,
    Priority:
      input["Priority"] !== undefined
        ? (input["Priority"] as number)
        : a.Priority,
    MutationProtection:
      input["MutationProtection"] !== undefined
        ? (input["MutationProtection"] as string)
        : a.MutationProtection,
    ModificationTime: now(),
  };
  ctx.store.set(fwAssocKey(id), updated);
  return { FirewallRuleGroupAssociation: fwAssocView(updated) };
};

const DisassociateFirewallRuleGroup: OperationHandler = (input, ctx) => {
  const id = input["FirewallRuleGroupAssociationId"] as string;
  const a = requireFwAssoc(ctx, id);
  if (a.MutationProtection === "ENABLED") {
    throw awsError(
      "ConflictException",
      `Mutation protection is enabled for association '${id}'.`,
      400,
    );
  }
  ctx.store.delete(fwAssocKey(id));
  return {
    FirewallRuleGroupAssociation: fwAssocView({
      ...a,
      Status: "DISASSOCIATING",
    }),
  };
};

const PutFirewallRuleGroupPolicy: OperationHandler = (input, ctx) => {
  const arn = input["Arn"] as string;
  const policy = input["FirewallRuleGroupPolicy"] as string;
  ctx.store.set(policyFwrgKey(arn), policy);
  return { ReturnValue: true };
};

const GetFirewallRuleGroupPolicy: OperationHandler = (input, ctx) => {
  const arn = input["Arn"] as string;
  const policy = ctx.store.get<string>(policyFwrgKey(arn));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No policy found for '${arn}'.`,
      400,
    );
  }
  return { FirewallRuleGroupPolicy: policy };
};

const GetFirewallConfig: OperationHandler = (input, ctx) => {
  const resourceId = input["ResourceId"] as string;
  const cfg = getOrCreateFirewallConfig(ctx, resourceId);
  return { FirewallConfig: fwConfigView(cfg) };
};

const ListFirewallConfigs: OperationHandler = (input, ctx) => {
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const all = ctx.store
    .list<StoredFirewallConfig>()
    .filter((e) => e.key.startsWith("fwconfig/"))
    .map((e) => e.value);
  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = all.slice(start, start + maxResults);
  const newToken =
    start + maxResults < all.length ? String(start + maxResults) : undefined;
  return {
    FirewallConfigs: page.map((c) => fwConfigView(c)),
    NextToken: newToken,
  };
};

const UpdateFirewallConfig: OperationHandler = (input, ctx) => {
  const resourceId = input["ResourceId"] as string;
  const cfg = getOrCreateFirewallConfig(ctx, resourceId);
  const updated: StoredFirewallConfig = {
    ...cfg,
    FirewallFailOpen: input["FirewallFailOpen"] as string,
  };
  ctx.store.set(fwConfigKey(resourceId), updated);
  return { FirewallConfig: fwConfigView(updated) };
};

const CreateResolverQueryLogConfig: OperationHandler = (input, ctx) => {
  const creatorRequestId = input["CreatorRequestId"] as string;
  const existingId = ctx.store.get<string>(
    creatorQlConfigKey(creatorRequestId),
  );
  if (existingId) {
    const c = ctx.store.get<StoredQueryLogConfig>(qlConfigKey(existingId));
    if (c) return { ResolverQueryLogConfig: qlConfigView(c) };
  }
  const id = nextId();
  const arn = `arn:aws:route53resolver:${ctx.region}:${ctx.account}:resolver-query-log-config/${id}`;
  const c: StoredQueryLogConfig = {
    Id: id,
    OwnerId: ctx.account,
    Status: "CREATED",
    AssociationCount: 0,
    Arn: arn,
    Name: input["Name"] as string,
    DestinationArn: input["DestinationArn"] as string,
    CreatorRequestId: creatorRequestId,
    CreationTime: now(),
  };
  ctx.store.set(qlConfigKey(id), c);
  ctx.store.set(creatorQlConfigKey(creatorRequestId), id);
  const tags =
    (input["Tags"] as Array<{ Key: string; Value: string }> | undefined) ?? [];
  if (tags.length > 0) {
    const tagMap: Record<string, string> = {};
    for (const t of tags) tagMap[t.Key] = t.Value;
    ctx.store.set(tagsKey(arn), tagMap);
  }
  return { ResolverQueryLogConfig: qlConfigView(c) };
};

const GetResolverQueryLogConfig: OperationHandler = (input, ctx) => {
  const id = input["ResolverQueryLogConfigId"] as string;
  const c = requireQlConfig(ctx, id);
  return { ResolverQueryLogConfig: qlConfigView(c) };
};

const ListResolverQueryLogConfigs: OperationHandler = (input, ctx) => {
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const filters =
    (input["Filters"] as
      | Array<{ Name: string; Values: string[] }>
      | undefined) ?? [];
  let all = ctx.store
    .list<StoredQueryLogConfig>()
    .filter((e) => e.key.startsWith("qlconfig/"))
    .map((e) => e.value);
  const filtered = applyFilters(
    all.map((c) => qlConfigView(c) as Record<string, unknown>),
    filters,
  );
  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = filtered.slice(start, start + maxResults);
  const newToken =
    start + maxResults < filtered.length
      ? String(start + maxResults)
      : undefined;
  return {
    ResolverQueryLogConfigs: page,
    NextToken: newToken,
    TotalCount: filtered.length,
    TotalFilteredCount: filtered.length,
  };
};

const DeleteResolverQueryLogConfig: OperationHandler = (input, ctx) => {
  const id = input["ResolverQueryLogConfigId"] as string;
  const c = requireQlConfig(ctx, id);
  const assocs = ctx.store
    .list<StoredQueryLogConfigAssociation>()
    .filter(
      (e) =>
        e.key.startsWith("qlassoc/") && e.value.ResolverQueryLogConfigId === id,
    );
  if (assocs.length > 0) {
    throw awsError(
      "ResourceInUseException",
      `Query log config '${id}' has active associations.`,
      400,
    );
  }
  ctx.store.delete(qlConfigKey(id));
  return {
    ResolverQueryLogConfig: qlConfigView({ ...c, Status: "DELETING" }),
  };
};

const AssociateResolverQueryLogConfig: OperationHandler = (input, ctx) => {
  const configId = input["ResolverQueryLogConfigId"] as string;
  const c = requireQlConfig(ctx, configId);
  const resourceId = input["ResourceId"] as string;
  const existing = ctx.store
    .list<StoredQueryLogConfigAssociation>()
    .find(
      (e) =>
        e.key.startsWith("qlassoc/") &&
        e.value.ResolverQueryLogConfigId === configId &&
        e.value.ResourceId === resourceId,
    );
  if (existing) {
    throw awsError(
      "ResourceExistsException",
      `VPC '${resourceId}' is already associated with query log config '${configId}'.`,
      400,
    );
  }
  const id = nextId();
  const assoc: StoredQueryLogConfigAssociation = {
    Id: id,
    ResolverQueryLogConfigId: configId,
    ResourceId: resourceId,
    Status: "ACTIVE",
    CreationTime: now(),
  };
  ctx.store.set(qlAssocKey(id), assoc);
  const updated: StoredQueryLogConfig = {
    ...c,
    AssociationCount: c.AssociationCount + 1,
  };
  ctx.store.set(qlConfigKey(configId), updated);
  return { ResolverQueryLogConfigAssociation: qlAssocView(assoc) };
};

const GetResolverQueryLogConfigAssociation: OperationHandler = (input, ctx) => {
  const id = input["ResolverQueryLogConfigAssociationId"] as string;
  const a = requireQlAssoc(ctx, id);
  return { ResolverQueryLogConfigAssociation: qlAssocView(a) };
};

const ListResolverQueryLogConfigAssociations: OperationHandler = (
  input,
  ctx,
) => {
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const filters =
    (input["Filters"] as
      | Array<{ Name: string; Values: string[] }>
      | undefined) ?? [];
  let all = ctx.store
    .list<StoredQueryLogConfigAssociation>()
    .filter((e) => e.key.startsWith("qlassoc/"))
    .map((e) => e.value);
  const filtered = applyFilters(
    all.map((a) => qlAssocView(a) as Record<string, unknown>),
    filters,
  );
  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = filtered.slice(start, start + maxResults);
  const newToken =
    start + maxResults < filtered.length
      ? String(start + maxResults)
      : undefined;
  return {
    ResolverQueryLogConfigAssociations: page,
    NextToken: newToken,
    TotalCount: filtered.length,
    TotalFilteredCount: filtered.length,
  };
};

const DisassociateResolverQueryLogConfig: OperationHandler = (input, ctx) => {
  const configId = input["ResolverQueryLogConfigId"] as string;
  const resourceId = input["ResourceId"] as string;
  const existing = ctx.store
    .list<StoredQueryLogConfigAssociation>()
    .find(
      (e) =>
        e.key.startsWith("qlassoc/") &&
        e.value.ResolverQueryLogConfigId === configId &&
        e.value.ResourceId === resourceId,
    );
  if (!existing) {
    throw awsError(
      "ResourceNotFoundException",
      `VPC '${resourceId}' is not associated with query log config '${configId}'.`,
      400,
    );
  }
  const assoc = existing.value;
  ctx.store.delete(qlAssocKey(assoc.Id));
  const c = ctx.store.get<StoredQueryLogConfig>(qlConfigKey(configId));
  if (c) {
    ctx.store.set(qlConfigKey(configId), {
      ...c,
      AssociationCount: Math.max(0, c.AssociationCount - 1),
    });
  }
  return {
    ResolverQueryLogConfigAssociation: qlAssocView({
      ...assoc,
      Status: "DELETING",
    }),
  };
};

const PutResolverQueryLogConfigPolicy: OperationHandler = (input, ctx) => {
  const arn = input["Arn"] as string;
  const policy = input["ResolverQueryLogConfigPolicy"] as string;
  ctx.store.set(policyQlKey(arn), policy);
  return { ReturnValue: true };
};

const GetResolverQueryLogConfigPolicy: OperationHandler = (input, ctx) => {
  const arn = input["Arn"] as string;
  const policy = ctx.store.get<string>(policyQlKey(arn));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No policy found for '${arn}'.`,
      400,
    );
  }
  return { ResolverQueryLogConfigPolicy: policy };
};

const GetResolverConfig: OperationHandler = (input, ctx) => {
  const resourceId = input["ResourceId"] as string;
  const cfg = getOrCreateResolverConfig(ctx, resourceId);
  return { ResolverConfig: resolverConfigView(cfg) };
};

const UpdateResolverConfig: OperationHandler = (input, ctx) => {
  const resourceId = input["ResourceId"] as string;
  const cfg = getOrCreateResolverConfig(ctx, resourceId);
  const flag = input["AutodefinedReverseFlag"] as string;
  const autodefined =
    flag === "ENABLE"
      ? "ENABLED"
      : flag === "DISABLE"
        ? "DISABLED"
        : flag === "USE_LOCAL_RESOURCE_SETTING"
          ? "USE_LOCAL_RESOURCE_SETTING"
          : flag;
  const updated: StoredResolverConfig = {
    ...cfg,
    AutodefinedReverse: autodefined,
  };
  ctx.store.set(resolverConfigKey(resourceId), updated);
  return { ResolverConfig: resolverConfigView(updated) };
};

const ListResolverConfigs: OperationHandler = (input, ctx) => {
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const all = ctx.store
    .list<StoredResolverConfig>()
    .filter((e) => e.key.startsWith("resolverconfig/"))
    .map((e) => e.value);
  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = all.slice(start, start + maxResults);
  const newToken =
    start + maxResults < all.length ? String(start + maxResults) : undefined;
  return {
    ResolverConfigs: page.map((c) => resolverConfigView(c)),
    NextToken: newToken,
  };
};

const GetResolverDnssecConfig: OperationHandler = (input, ctx) => {
  const resourceId = input["ResourceId"] as string;
  const cfg = getOrCreateDnssecConfig(ctx, resourceId);
  return { ResolverDNSSECConfig: dnssecConfigView(cfg) };
};

const UpdateResolverDnssecConfig: OperationHandler = (input, ctx) => {
  const resourceId = input["ResourceId"] as string;
  const cfg = getOrCreateDnssecConfig(ctx, resourceId);
  const validation = input["Validation"] as string;
  const status =
    validation === "ENABLE"
      ? "ENABLING"
      : validation === "DISABLE"
        ? "DISABLING"
        : validation;
  const updated: StoredDnssecConfig = { ...cfg, ValidationStatus: status };
  ctx.store.set(dnssecConfigKey(resourceId), updated);
  return { ResolverDNSSECConfig: dnssecConfigView(updated) };
};

const ListResolverDnssecConfigs: OperationHandler = (input, ctx) => {
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const all = ctx.store
    .list<StoredDnssecConfig>()
    .filter((e) => e.key.startsWith("dnssecconfig/"))
    .map((e) => e.value)
    .map((c) => {
      if (c.ValidationStatus === "ENABLING") {
        const updated = { ...c, ValidationStatus: "ENABLED" };
        ctx.store.set(dnssecConfigKey(c.ResourceId), updated);
        return updated;
      }
      return c;
    });
  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = all.slice(start, start + maxResults);
  const newToken =
    start + maxResults < all.length ? String(start + maxResults) : undefined;
  return {
    ResolverDnssecConfigs: page.map((c) => dnssecConfigView(c)),
    NextToken: newToken,
  };
};

const CreateOutpostResolver: OperationHandler = (input, ctx) => {
  const creatorRequestId = input["CreatorRequestId"] as string;
  const existingId = ctx.store.get<string>(creatorOutpostKey(creatorRequestId));
  if (existingId) {
    const o = ctx.store.get<StoredOutpostResolver>(outpostKey(existingId));
    if (o) return { OutpostResolver: outpostView(o) };
  }
  const id = nextId();
  const arn = `arn:aws:route53resolver:${ctx.region}:${ctx.account}:outpost-resolver/${id}`;
  const o: StoredOutpostResolver = {
    Id: id,
    CreatorRequestId: creatorRequestId,
    Arn: arn,
    Name: input["Name"] as string,
    Status: "OPERATIONAL",
    StatusMessage: "Outpost resolver operational.",
    PreferredInstanceType: input["PreferredInstanceType"] as string,
    OutpostArn: input["OutpostArn"] as string,
    InstanceCount: (input["InstanceCount"] as number | undefined) ?? 4,
    CreationTime: now(),
    ModificationTime: now(),
  };
  ctx.store.set(outpostKey(id), o);
  ctx.store.set(creatorOutpostKey(creatorRequestId), id);
  const tags =
    (input["Tags"] as Array<{ Key: string; Value: string }> | undefined) ?? [];
  if (tags.length > 0) {
    const tagMap: Record<string, string> = {};
    for (const t of tags) tagMap[t.Key] = t.Value;
    ctx.store.set(tagsKey(arn), tagMap);
  }
  return { OutpostResolver: outpostView(o) };
};

const GetOutpostResolver: OperationHandler = (input, ctx) => {
  const id = input["Id"] as string;
  const o = requireOutpost(ctx, id);
  return { OutpostResolver: outpostView(o) };
};

const ListOutpostResolvers: OperationHandler = (input, ctx) => {
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const outpostArn = input["OutpostArn"] as string | undefined;
  let all = ctx.store
    .list<StoredOutpostResolver>()
    .filter((e) => e.key.startsWith("outpost/"))
    .map((e) => e.value);
  if (outpostArn) all = all.filter((o) => o.OutpostArn === outpostArn);
  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const page = all.slice(start, start + maxResults);
  const newToken =
    start + maxResults < all.length ? String(start + maxResults) : undefined;
  return {
    OutpostResolvers: page.map((o) => outpostView(o)),
    NextToken: newToken,
  };
};

const UpdateOutpostResolver: OperationHandler = (input, ctx) => {
  const id = input["Id"] as string;
  const o = requireOutpost(ctx, id);
  const updated: StoredOutpostResolver = {
    ...o,
    Name: input["Name"] !== undefined ? (input["Name"] as string) : o.Name,
    PreferredInstanceType:
      input["PreferredInstanceType"] !== undefined
        ? (input["PreferredInstanceType"] as string)
        : o.PreferredInstanceType,
    InstanceCount:
      input["InstanceCount"] !== undefined
        ? (input["InstanceCount"] as number)
        : o.InstanceCount,
    ModificationTime: now(),
  };
  ctx.store.set(outpostKey(id), updated);
  return { OutpostResolver: outpostView(updated) };
};

const DeleteOutpostResolver: OperationHandler = (input, ctx) => {
  const id = input["Id"] as string;
  const o = requireOutpost(ctx, id);
  ctx.store.delete(outpostKey(id));
  return { OutpostResolver: outpostView({ ...o, Status: "DELETING" }) };
};

const PutResolverRulePolicy: OperationHandler = (input, ctx) => {
  const arn = input["Arn"] as string;
  const policy = input["ResolverRulePolicy"] as string;
  ctx.store.set(policyRuleKey(arn), policy);
  return { ReturnValue: true };
};

const GetResolverRulePolicy: OperationHandler = (input, ctx) => {
  const arn = input["Arn"] as string;
  const policy = ctx.store.get<string>(policyRuleKey(arn));
  return { ResolverRulePolicy: policy ?? "" };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = input["ResourceArn"] as string;
  requireArnExists(ctx, arn);
  const newTags =
    (input["Tags"] as Array<{ Key: string; Value: string }> | undefined) ?? [];
  const key = tagsKey(arn);
  const tags = ctx.store.get<Record<string, string>>(key) ?? {};
  for (const t of newTags) tags[t.Key] = t.Value;
  ctx.store.set(key, tags);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = input["ResourceArn"] as string;
  requireArnExists(ctx, arn);
  const tagKeys = (input["TagKeys"] as string[] | undefined) ?? [];
  const key = tagsKey(arn);
  const tags = ctx.store.get<Record<string, string>>(key) ?? {};
  for (const k of tagKeys) delete tags[k];
  ctx.store.set(key, tags);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = input["ResourceArn"] as string;
  requireArnExists(ctx, arn);
  const key = tagsKey(arn);
  const tags = ctx.store.get<Record<string, string>>(key) ?? {};
  return {
    Tags: Object.entries(tags).map(([k, v]) => ({ Key: k, Value: v })),
  };
};

const route53resolver = {
  name: "route53resolver",
  protocol: "json",
  operations: {
    CreateResolverEndpoint,
    GetResolverEndpoint,
    UpdateResolverEndpoint,
    DeleteResolverEndpoint,
    ListResolverEndpoints,
    AssociateResolverEndpointIpAddress,
    DisassociateResolverEndpointIpAddress,
    ListResolverEndpointIpAddresses,
    CreateResolverRule,
    GetResolverRule,
    UpdateResolverRule,
    DeleteResolverRule,
    ListResolverRules,
    AssociateResolverRule,
    DisassociateResolverRule,
    GetResolverRuleAssociation,
    ListResolverRuleAssociations,
    TagResource,
    UntagResource,
    ListTagsForResource,
    CreateFirewallRuleGroup,
    GetFirewallRuleGroup,
    ListFirewallRuleGroups,
    DeleteFirewallRuleGroup,
    CreateFirewallDomainList,
    GetFirewallDomainList,
    ListFirewallDomainLists,
    UpdateFirewallDomains,
    ImportFirewallDomains,
    DeleteFirewallDomainList,
    ListFirewallDomains,
    ListFirewallRuleTypes,
    CreateFirewallRule,
    UpdateFirewallRule,
    DeleteFirewallRule,
    ListFirewallRules,
    BatchCreateFirewallRule,
    BatchDeleteFirewallRule,
    BatchUpdateFirewallRule,
    AssociateFirewallRuleGroup,
    GetFirewallRuleGroupAssociation,
    ListFirewallRuleGroupAssociations,
    UpdateFirewallRuleGroupAssociation,
    DisassociateFirewallRuleGroup,
    PutFirewallRuleGroupPolicy,
    GetFirewallRuleGroupPolicy,
    GetFirewallConfig,
    ListFirewallConfigs,
    UpdateFirewallConfig,
    CreateResolverQueryLogConfig,
    GetResolverQueryLogConfig,
    ListResolverQueryLogConfigs,
    DeleteResolverQueryLogConfig,
    AssociateResolverQueryLogConfig,
    GetResolverQueryLogConfigAssociation,
    ListResolverQueryLogConfigAssociations,
    DisassociateResolverQueryLogConfig,
    PutResolverQueryLogConfigPolicy,
    GetResolverQueryLogConfigPolicy,
    GetResolverConfig,
    UpdateResolverConfig,
    ListResolverConfigs,
    GetResolverDnssecConfig,
    UpdateResolverDnssecConfig,
    ListResolverDnssecConfigs,
    CreateOutpostResolver,
    GetOutpostResolver,
    ListOutpostResolvers,
    UpdateOutpostResolver,
    DeleteOutpostResolver,
    PutResolverRulePolicy,
    GetResolverRulePolicy,
  },
  model,
} as const satisfies ServiceDefinition;

export default route53resolver;
