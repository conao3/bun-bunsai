import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import route53resolverModel from "../../../../test/vendor/aws-models/route53resolver.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(route53resolverModel);

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

const endpointKey = (id: string): string => `endpoint/${id}`;
const ruleKey = (id: string): string => `rule/${id}`;
const assocKey = (id: string): string => `assoc/${id}`;
const tagsKey = (arn: string): string => `tags/${arn}`;
const creatorEndpointKey = (rid: string): string => `creator/endpoint/${rid}`;
const creatorRuleKey = (rid: string): string => `creator/rule/${rid}`;

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
      404,
    );
  }
  return ep;
};

const requireRule = (ctx: ServiceContext, id: string): StoredRule => {
  const rule = ctx.store.get<StoredRule>(ruleKey(id));
  if (!rule) {
    throw awsError(
      "ResourceNotFoundException",
      `Resolver rule with ID '${id}' does not exist.`,
      404,
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
      404,
    );
  }
  return assoc;
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
    if (ep)
      return { ResolverEndpoint: endpointView(getEndpointOperational(ep)) };
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

  return { ResolverEndpoint: endpointView(getEndpointOperational(ep)) };
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
  const deleting: StoredEndpoint = {
    ...ep,
    Status: "DELETING",
    StatusMessage: "Deleting.",
  };
  ctx.store.set(endpointKey(id), deleting);
  ctx.store.delete(endpointKey(id));
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
    if (rule) return { ResolverRule: ruleView(getRuleComplete(rule)) };
  }

  const id = nextId();
  const arn = `arn:aws:route53resolver:${ctx.region}:${ctx.account}:resolver-rule/${id}`;

  const rule: StoredRule = {
    Id: id,
    CreatorRequestId: creatorRequestId,
    Arn: arn,
    DomainName: input["DomainName"] as string | undefined,
    Name: input["Name"] as string | undefined,
    RuleType: input["RuleType"] as string,
    Status: "CREATING",
    StatusMessage: "Creating the Resolver Rule.",
    OwnerId: ctx.account,
    ShareStatus: "NOT_SHARED",
    CreationTime: now(),
    ModificationTime: now(),
    ResolverEndpointId: input["ResolverEndpointId"] as string | undefined,
    TargetIps: input["TargetIps"] as StoredRule["TargetIps"],
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

  return { ResolverRule: ruleView(getRuleComplete(rule)) };
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
  const updated: StoredRule = {
    ...rule,
    Name: config["Name"] !== undefined ? (config["Name"] as string) : rule.Name,
    ResolverEndpointId:
      config["ResolverEndpointId"] !== undefined
        ? (config["ResolverEndpointId"] as string | undefined)
        : rule.ResolverEndpointId,
    TargetIps:
      config["TargetIps"] !== undefined
        ? (config["TargetIps"] as StoredRule["TargetIps"])
        : rule.TargetIps,
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
  return { ResolverRule: ruleView(deleting) };
};

const ListResolverRules: OperationHandler = (input, ctx) => {
  const maxResults = (input["MaxResults"] as number | undefined) ?? 100;
  const nextToken = input["NextToken"] as string | undefined;
  const filters =
    (input["Filters"] as
      | Array<{ Name: string; Values: string[] }>
      | undefined) ?? [];

  const all = ctx.store
    .list<StoredRule>()
    .filter((e) => e.key.startsWith("rule/"))
    .map((e) => getRuleComplete(e.value));

  const filtered = applyFilters(
    all.map((r) => ruleView(r) as Record<string, unknown>),
    filters,
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
    Status: "COMPLETE",
    StatusMessage:
      "This association between a Resolver rule and a VPC is complete.",
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
      404,
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
  return { ResolverRuleAssociation: assocView(assoc) };
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
    .map((e) => e.value);

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

const TagResource: OperationHandler = (input, ctx) => {
  const arn = input["ResourceArn"] as string;
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
  const tagKeys = (input["TagKeys"] as string[] | undefined) ?? [];
  const key = tagsKey(arn);
  const tags = ctx.store.get<Record<string, string>>(key) ?? {};
  for (const k of tagKeys) delete tags[k];
  ctx.store.set(key, tags);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = input["ResourceArn"] as string;
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
  },
  model,
} as const satisfies ServiceDefinition;

export default route53resolver;
