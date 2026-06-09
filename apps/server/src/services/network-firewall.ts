import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import networkFirewallModel from "../../../../test/vendor/aws-models/network-firewall.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(networkFirewallModel);

type TagEntry = { Key: string | undefined; Value: string | undefined };

type StoredSubnetMapping = {
  SubnetId: string;
  IPAddressType: string | undefined;
};

type StoredFirewall = {
  FirewallName: string;
  FirewallArn: string;
  FirewallPolicyArn: string;
  VpcId: string | undefined;
  SubnetMappings: StoredSubnetMapping[];
  DeleteProtection: boolean;
  SubnetChangeProtection: boolean;
  FirewallPolicyChangeProtection: boolean;
  AvailabilityZoneChangeProtection: boolean;
  Description: string | undefined;
  FirewallId: string;
  Tags: TagEntry[];
  LoggingConfiguration: unknown;
  EncryptionConfiguration: unknown;
  EnabledAnalysisTypes: string[];
  AvailabilityZoneMappings: { AvailabilityZone: string | undefined }[];
};

type StoredFirewallPolicy = {
  FirewallPolicyName: string;
  FirewallPolicyArn: string;
  FirewallPolicyId: string;
  Description: string | undefined;
  Tags: TagEntry[];
  FirewallPolicy: unknown;
  UpdateToken: string;
};

type StoredRuleGroup = {
  RuleGroupName: string;
  RuleGroupArn: string;
  RuleGroupId: string;
  Description: string | undefined;
  Type: string | undefined;
  Capacity: number | undefined;
  Tags: TagEntry[];
  RuleGroup: unknown;
  UpdateToken: string;
};

type StoredTLSConfig = {
  TLSInspectionConfigurationName: string;
  TLSInspectionConfigurationArn: string;
  TLSInspectionConfigurationId: string;
  Description: string | undefined;
  Tags: TagEntry[];
  TLSInspectionConfiguration: unknown;
  UpdateToken: string;
};

type StoredProxy = {
  ProxyName: string;
  ProxyArn: string;
  NatGatewayId: string | undefined;
  Tags: TagEntry[];
  UpdateToken: string;
};

type StoredProxyConfiguration = {
  ProxyConfigurationName: string;
  ProxyConfigurationArn: string;
  Description: string | undefined;
  Tags: TagEntry[];
  UpdateToken: string;
  RuleGroups: {
    ProxyRuleGroupName: string;
    ProxyRuleGroupArn: string | undefined;
    Priority: number | undefined;
  }[];
};

type StoredProxyRule = {
  ProxyRuleName: string;
  Description: string | undefined;
  Action: string | undefined;
  Conditions: unknown[];
  UpdateToken: string;
};

type StoredProxyRuleGroup = {
  ProxyRuleGroupName: string;
  ProxyRuleGroupArn: string;
  Description: string | undefined;
  Tags: TagEntry[];
  UpdateToken: string;
  Rules: Record<string, StoredProxyRule>;
};

type StoredVpcEndpointAssociation = {
  VpcEndpointAssociationId: string;
  VpcEndpointAssociationArn: string;
  FirewallArn: string;
  VpcId: string | undefined;
  SubnetMapping: unknown;
  Description: string | undefined;
  Tags: TagEntry[];
};

type StoredResourcePolicy = {
  Policy: string;
};

const firewallKey = (name: string): string => `firewall/${name}`;
const firewallPolicyKey = (name: string): string => `firewall-policy/${name}`;
const ruleGroupKey = (name: string): string => `rule-group/${name}`;
const tlsConfigKey = (name: string): string => `tls-config/${name}`;
const proxyKey = (name: string): string => `proxy/${name}`;
const proxyConfigKey = (name: string): string => `proxy-config/${name}`;
const proxyRuleGroupKey = (name: string): string => `proxy-rule-group/${name}`;
const vpcEndpointAssocKey = (id: string): string => `vpc-endpoint-assoc/${id}`;
const resourcePolicyKey = (arn: string): string => `resource-policy/${arn}`;
const tagsKey = (arn: string): string => `tags/${arn}`;

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const booleanOrFalse = (value: unknown): boolean => value === true;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const subnetMappingsFrom = (value: unknown): StoredSubnetMapping[] => {
  if (!Array.isArray(value)) return [];
  const out: StoredSubnetMapping[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    if (record === undefined) continue;
    const subnetId = stringOrUndefined(record["SubnetId"]);
    if (subnetId === undefined) continue;
    out.push({
      SubnetId: subnetId,
      IPAddressType: stringOrUndefined(record["IPAddressType"]),
    });
  }
  return out;
};

const tagListFrom = (value: unknown): TagEntry[] => {
  if (!Array.isArray(value)) return [];
  const out: TagEntry[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    if (record === undefined) continue;
    out.push({
      Key: stringOrUndefined(record["Key"]),
      Value: stringOrUndefined(record["Value"]),
    });
  }
  return out;
};

const stringArrayFrom = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
};

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

const azMappingsFrom = (
  value: unknown,
): { AvailabilityZone: string | undefined }[] => {
  if (!Array.isArray(value)) return [];
  const out: { AvailabilityZone: string | undefined }[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    if (record === undefined) continue;
    out.push({
      AvailabilityZone: stringOrUndefined(record["AvailabilityZone"]),
    });
  }
  return out;
};

const firewallId = (): string => crypto.randomUUID();

const firewallArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:network-firewall:${ctx.region}:${ctx.account}:firewall/${name}`;

const firewallPolicyArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:network-firewall:${ctx.region}:${ctx.account}:firewall-policy/${name}`;

const ruleGroupArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:network-firewall:${ctx.region}:${ctx.account}:stateful-rulegroup/${name}`;

const tlsConfigArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:network-firewall:${ctx.region}:${ctx.account}:tls-configuration/${name}`;

const proxyArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:network-firewall:${ctx.region}:${ctx.account}:proxy/${name}`;

const proxyConfigArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:network-firewall:${ctx.region}:${ctx.account}:proxy-configuration/${name}`;

const proxyRuleGroupArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:network-firewall:${ctx.region}:${ctx.account}:proxy-rule-group/${name}`;

const vpcEndpointAssocArnOf = (ctx: ServiceContext, id: string): string =>
  `arn:aws:network-firewall:${ctx.region}:${ctx.account}:vpc-endpoint-association/${id}`;

const firewallView = (firewall: StoredFirewall): Record<string, unknown> => ({
  FirewallName: firewall.FirewallName,
  FirewallArn: firewall.FirewallArn,
  FirewallPolicyArn: firewall.FirewallPolicyArn,
  VpcId: firewall.VpcId,
  SubnetMappings: firewall.SubnetMappings.map((mapping) => ({
    SubnetId: mapping.SubnetId,
    IPAddressType: mapping.IPAddressType,
  })),
  DeleteProtection: firewall.DeleteProtection,
  SubnetChangeProtection: firewall.SubnetChangeProtection,
  FirewallPolicyChangeProtection: firewall.FirewallPolicyChangeProtection,
  Description: firewall.Description,
  FirewallId: firewall.FirewallId,
  Tags: firewall.Tags,
  NumberOfAssociations: firewall.SubnetMappings.length,
});

const firewallStatusView = (): Record<string, unknown> => ({
  Status: "READY",
  ConfigurationSyncStateSummary: "IN_SYNC",
});

const firewallPolicyResponseView = (
  fp: StoredFirewallPolicy,
): Record<string, unknown> => ({
  FirewallPolicyName: fp.FirewallPolicyName,
  FirewallPolicyArn: fp.FirewallPolicyArn,
  FirewallPolicyId: fp.FirewallPolicyId,
  Description: fp.Description,
  FirewallPolicyStatus: "ACTIVE",
  Tags: fp.Tags,
  NumberOfAssociations: 0,
});

const ruleGroupResponseView = (
  rg: StoredRuleGroup,
): Record<string, unknown> => ({
  RuleGroupArn: rg.RuleGroupArn,
  RuleGroupName: rg.RuleGroupName,
  RuleGroupId: rg.RuleGroupId,
  Description: rg.Description,
  Type: rg.Type,
  Capacity: rg.Capacity,
  RuleGroupStatus: "ACTIVE",
  Tags: rg.Tags,
  NumberOfAssociations: 0,
});

const tlsConfigResponseView = (
  tc: StoredTLSConfig,
): Record<string, unknown> => ({
  TLSInspectionConfigurationArn: tc.TLSInspectionConfigurationArn,
  TLSInspectionConfigurationName: tc.TLSInspectionConfigurationName,
  TLSInspectionConfigurationId: tc.TLSInspectionConfigurationId,
  TLSInspectionConfigurationStatus: "ACTIVE",
  Description: tc.Description,
  Tags: tc.Tags,
  NumberOfAssociations: 0,
});

const proxyView = (p: StoredProxy): Record<string, unknown> => ({
  ProxyName: p.ProxyName,
  ProxyArn: p.ProxyArn,
  NatGatewayId: p.NatGatewayId,
  ProxyState: "READY",
  ProxyModifyState: "IN_SYNC",
  Tags: p.Tags,
});

const proxyConfigView = (
  pc: StoredProxyConfiguration,
): Record<string, unknown> => ({
  ProxyConfigurationName: pc.ProxyConfigurationName,
  ProxyConfigurationArn: pc.ProxyConfigurationArn,
  Description: pc.Description,
  Tags: pc.Tags,
  RuleGroups: pc.RuleGroups,
});

const proxyRuleGroupView = (
  prg: StoredProxyRuleGroup,
): Record<string, unknown> => ({
  ProxyRuleGroupName: prg.ProxyRuleGroupName,
  ProxyRuleGroupArn: prg.ProxyRuleGroupArn,
  Description: prg.Description,
  Tags: prg.Tags,
});

const vpcEndpointAssocView = (
  assoc: StoredVpcEndpointAssociation,
): Record<string, unknown> => ({
  VpcEndpointAssociationId: assoc.VpcEndpointAssociationId,
  VpcEndpointAssociationArn: assoc.VpcEndpointAssociationArn,
  FirewallArn: assoc.FirewallArn,
  VpcId: assoc.VpcId,
  SubnetMapping: assoc.SubnetMapping,
  Description: assoc.Description,
  Tags: assoc.Tags,
});

const vpcEndpointAssocStatusView = (): Record<string, unknown> => ({
  Status: "READY",
});

const updateToken = (): string => crypto.randomUUID();

const findFirewall = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredFirewall | undefined => {
  if (name !== undefined) {
    return ctx.store.get<StoredFirewall>(firewallKey(name));
  }
  if (arn !== undefined) {
    return ctx.store
      .list<StoredFirewall>()
      .map((entry) => entry.value)
      .find((firewall) => firewall.FirewallArn === arn);
  }
  return undefined;
};

const requireFirewall = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredFirewall => {
  const firewall = findFirewall(ctx, name, arn);
  if (firewall === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The firewall does not exist.",
      400,
    );
  }
  return firewall;
};

const findFirewallPolicy = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredFirewallPolicy | undefined => {
  if (name !== undefined) {
    return ctx.store.get<StoredFirewallPolicy>(firewallPolicyKey(name));
  }
  if (arn !== undefined) {
    return ctx.store
      .list<StoredFirewallPolicy>()
      .map((entry) => entry.value)
      .find((fp) => fp.FirewallPolicyArn === arn);
  }
  return undefined;
};

const requireFirewallPolicy = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredFirewallPolicy => {
  const fp = findFirewallPolicy(ctx, name, arn);
  if (fp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The firewall policy does not exist.",
      400,
    );
  }
  return fp;
};

const findRuleGroup = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredRuleGroup | undefined => {
  if (name !== undefined) {
    return ctx.store.get<StoredRuleGroup>(ruleGroupKey(name));
  }
  if (arn !== undefined) {
    return ctx.store
      .list<StoredRuleGroup>()
      .map((entry) => entry.value)
      .find((rg) => rg.RuleGroupArn === arn);
  }
  return undefined;
};

const requireRuleGroup = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredRuleGroup => {
  const rg = findRuleGroup(ctx, name, arn);
  if (rg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The rule group does not exist.",
      400,
    );
  }
  return rg;
};

const findTLSConfig = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredTLSConfig | undefined => {
  if (name !== undefined) {
    return ctx.store.get<StoredTLSConfig>(tlsConfigKey(name));
  }
  if (arn !== undefined) {
    return ctx.store
      .list<StoredTLSConfig>()
      .map((entry) => entry.value)
      .find((tc) => tc.TLSInspectionConfigurationArn === arn);
  }
  return undefined;
};

const requireTLSConfig = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredTLSConfig => {
  const tc = findTLSConfig(ctx, name, arn);
  if (tc === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The TLS inspection configuration does not exist.",
      400,
    );
  }
  return tc;
};

const findProxy = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredProxy | undefined => {
  if (name !== undefined) {
    return ctx.store.get<StoredProxy>(proxyKey(name));
  }
  if (arn !== undefined) {
    return ctx.store
      .list<StoredProxy>()
      .map((entry) => entry.value)
      .find((p) => p.ProxyArn === arn);
  }
  return undefined;
};

const requireProxy = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredProxy => {
  const p = findProxy(ctx, name, arn);
  if (p === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The proxy does not exist.",
      400,
    );
  }
  return p;
};

const findProxyConfiguration = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredProxyConfiguration | undefined => {
  if (name !== undefined) {
    return ctx.store.get<StoredProxyConfiguration>(proxyConfigKey(name));
  }
  if (arn !== undefined) {
    return ctx.store
      .list<StoredProxyConfiguration>()
      .map((entry) => entry.value)
      .find((pc) => pc.ProxyConfigurationArn === arn);
  }
  return undefined;
};

const requireProxyConfiguration = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredProxyConfiguration => {
  const pc = findProxyConfiguration(ctx, name, arn);
  if (pc === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The proxy configuration does not exist.",
      400,
    );
  }
  return pc;
};

const findProxyRuleGroup = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredProxyRuleGroup | undefined => {
  if (name !== undefined) {
    return ctx.store.get<StoredProxyRuleGroup>(proxyRuleGroupKey(name));
  }
  if (arn !== undefined) {
    return ctx.store
      .list<StoredProxyRuleGroup>()
      .map((entry) => entry.value)
      .find((prg) => prg.ProxyRuleGroupArn === arn);
  }
  return undefined;
};

const requireProxyRuleGroup = (
  ctx: ServiceContext,
  name: string | undefined,
  arn: string | undefined,
): StoredProxyRuleGroup => {
  const prg = findProxyRuleGroup(ctx, name, arn);
  if (prg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The proxy rule group does not exist.",
      400,
    );
  }
  return prg;
};

const findVpcEndpointAssocByArn = (
  ctx: ServiceContext,
  arn: string,
): StoredVpcEndpointAssociation | undefined =>
  ctx.store
    .list<StoredVpcEndpointAssociation>()
    .map((entry) => entry.value)
    .find((assoc) => assoc.VpcEndpointAssociationArn === arn);

const requireVpcEndpointAssocByArn = (
  ctx: ServiceContext,
  arn: string,
): StoredVpcEndpointAssociation => {
  const assoc = findVpcEndpointAssocByArn(ctx, arn);
  if (assoc === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The VPC endpoint association does not exist.",
      400,
    );
  }
  return assoc;
};

const CreateFirewall: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["FirewallName"]);
  if (name === undefined) {
    throw awsError("InvalidRequestException", "FirewallName is required.", 400);
  }
  const policyArn = stringOrUndefined(input["FirewallPolicyArn"]);
  if (policyArn === undefined) {
    throw awsError(
      "InvalidRequestException",
      "FirewallPolicyArn is required.",
      400,
    );
  }
  if (ctx.store.get<StoredFirewall>(firewallKey(name)) !== undefined) {
    throw awsError(
      "InvalidOperationException",
      `Firewall already exists: ${name}.`,
      400,
    );
  }
  const firewall: StoredFirewall = {
    FirewallName: name,
    FirewallArn: firewallArnOf(ctx, name),
    FirewallPolicyArn: policyArn,
    VpcId: stringOrUndefined(input["VpcId"]),
    SubnetMappings: subnetMappingsFrom(input["SubnetMappings"]),
    DeleteProtection: booleanOrFalse(input["DeleteProtection"]),
    SubnetChangeProtection: booleanOrFalse(input["SubnetChangeProtection"]),
    FirewallPolicyChangeProtection: booleanOrFalse(
      input["FirewallPolicyChangeProtection"],
    ),
    AvailabilityZoneChangeProtection: false,
    Description: stringOrUndefined(input["Description"]),
    FirewallId: firewallId(),
    Tags: tagListFrom(input["Tags"]),
    LoggingConfiguration: null,
    EncryptionConfiguration: input["EncryptionConfiguration"] ?? null,
    EnabledAnalysisTypes: [],
    AvailabilityZoneMappings: [],
  };
  ctx.store.set(firewallKey(name), firewall);
  return {
    Firewall: firewallView(firewall),
    FirewallStatus: firewallStatusView(),
  };
};

const DescribeFirewall: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  return {
    UpdateToken: updateToken(),
    Firewall: firewallView(firewall),
    FirewallStatus: firewallStatusView(),
  };
};

const ListFirewalls: OperationHandler = (input, ctx) => {
  const vpcIds = stringArrayFrom(input["VpcIds"]);
  const all = ctx.store
    .list<StoredFirewall>()
    .filter((entry) => entry.key.startsWith("firewall/"))
    .map((entry) => entry.value)
    .filter(
      (fw) =>
        vpcIds.length === 0 ||
        (fw.VpcId !== undefined && vpcIds.includes(fw.VpcId)),
    )
    .sort((a, b) => a.FirewallName.localeCompare(b.FirewallName));
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  const result: Record<string, unknown> = {
    Firewalls: items.map((firewall) => ({
      FirewallName: firewall.FirewallName,
      FirewallArn: firewall.FirewallArn,
    })),
  };
  if (nextToken !== undefined) result["NextToken"] = nextToken;
  return result;
};

const DeleteFirewall: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  ctx.store.delete(firewallKey(firewall.FirewallName));
  return {
    Firewall: firewallView(firewall),
    FirewallStatus: {
      Status: "DELETING",
      ConfigurationSyncStateSummary: "IN_SYNC",
    },
  };
};

const DescribeFirewallMetadata: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["FirewallArn"]);
  if (arn === undefined) {
    throw awsError("InvalidRequestException", "FirewallArn is required.", 400);
  }
  const firewall = requireFirewall(ctx, undefined, arn);
  return {
    FirewallArn: firewall.FirewallArn,
    FirewallPolicyArn: firewall.FirewallPolicyArn,
    Description: firewall.Description,
    Status: "READY",
    SupportedAvailabilityZones: {},
    TransitGatewayAttachmentId: undefined,
  };
};

const AssociateFirewallPolicy: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  const policyArn = stringOrUndefined(input["FirewallPolicyArn"]);
  if (policyArn !== undefined) {
    firewall.FirewallPolicyArn = policyArn;
    ctx.store.set(firewallKey(firewall.FirewallName), firewall);
  }
  return {
    FirewallArn: firewall.FirewallArn,
    FirewallName: firewall.FirewallName,
    FirewallPolicyArn: firewall.FirewallPolicyArn,
    UpdateToken: updateToken(),
  };
};

const AssociateSubnets: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  const newMappings = subnetMappingsFrom(input["SubnetMappings"]);
  const existingIds = new Set(firewall.SubnetMappings.map((m) => m.SubnetId));
  for (const m of newMappings) {
    if (!existingIds.has(m.SubnetId)) {
      firewall.SubnetMappings.push(m);
    }
  }
  ctx.store.set(firewallKey(firewall.FirewallName), firewall);
  return {
    FirewallArn: firewall.FirewallArn,
    FirewallName: firewall.FirewallName,
    SubnetMappings: firewall.SubnetMappings,
    UpdateToken: updateToken(),
  };
};

const DisassociateSubnets: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  const toRemove = new Set(stringArrayFrom(input["SubnetIds"]));
  firewall.SubnetMappings = firewall.SubnetMappings.filter(
    (m) => !toRemove.has(m.SubnetId),
  );
  ctx.store.set(firewallKey(firewall.FirewallName), firewall);
  return {
    FirewallArn: firewall.FirewallArn,
    FirewallName: firewall.FirewallName,
    SubnetMappings: firewall.SubnetMappings,
    UpdateToken: updateToken(),
  };
};

const AssociateAvailabilityZones: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  const newMappings = azMappingsFrom(input["AvailabilityZoneMappings"]);
  const existingAzs = new Set(
    firewall.AvailabilityZoneMappings.map((m) => m.AvailabilityZone),
  );
  for (const m of newMappings) {
    if (!existingAzs.has(m.AvailabilityZone)) {
      firewall.AvailabilityZoneMappings.push(m);
    }
  }
  ctx.store.set(firewallKey(firewall.FirewallName), firewall);
  return {
    FirewallArn: firewall.FirewallArn,
    FirewallName: firewall.FirewallName,
    AvailabilityZoneMappings: firewall.AvailabilityZoneMappings,
    UpdateToken: updateToken(),
  };
};

const DisassociateAvailabilityZones: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  const toRemove = new Set(
    azMappingsFrom(input["AvailabilityZoneMappings"]).map(
      (m) => m.AvailabilityZone,
    ),
  );
  firewall.AvailabilityZoneMappings = firewall.AvailabilityZoneMappings.filter(
    (m) => !toRemove.has(m.AvailabilityZone),
  );
  ctx.store.set(firewallKey(firewall.FirewallName), firewall);
  return {
    FirewallArn: firewall.FirewallArn,
    FirewallName: firewall.FirewallName,
    AvailabilityZoneMappings: firewall.AvailabilityZoneMappings,
    UpdateToken: updateToken(),
  };
};

const UpdateFirewallDeleteProtection: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  firewall.DeleteProtection = booleanOrFalse(input["DeleteProtection"]);
  ctx.store.set(firewallKey(firewall.FirewallName), firewall);
  return {
    FirewallArn: firewall.FirewallArn,
    FirewallName: firewall.FirewallName,
    DeleteProtection: firewall.DeleteProtection,
    UpdateToken: updateToken(),
  };
};

const UpdateFirewallDescription: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  firewall.Description = stringOrUndefined(input["Description"]);
  ctx.store.set(firewallKey(firewall.FirewallName), firewall);
  return {
    FirewallArn: firewall.FirewallArn,
    FirewallName: firewall.FirewallName,
    Description: firewall.Description,
    UpdateToken: updateToken(),
  };
};

const UpdateFirewallPolicyChangeProtection: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  firewall.FirewallPolicyChangeProtection = booleanOrFalse(
    input["FirewallPolicyChangeProtection"],
  );
  ctx.store.set(firewallKey(firewall.FirewallName), firewall);
  return {
    UpdateToken: updateToken(),
    FirewallArn: firewall.FirewallArn,
    FirewallName: firewall.FirewallName,
    FirewallPolicyChangeProtection: firewall.FirewallPolicyChangeProtection,
  };
};

const UpdateSubnetChangeProtection: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  firewall.SubnetChangeProtection = booleanOrFalse(
    input["SubnetChangeProtection"],
  );
  ctx.store.set(firewallKey(firewall.FirewallName), firewall);
  return {
    UpdateToken: updateToken(),
    FirewallArn: firewall.FirewallArn,
    FirewallName: firewall.FirewallName,
    SubnetChangeProtection: firewall.SubnetChangeProtection,
  };
};

const UpdateAvailabilityZoneChangeProtection: OperationHandler = (
  input,
  ctx,
) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  firewall.AvailabilityZoneChangeProtection = booleanOrFalse(
    input["AvailabilityZoneChangeProtection"],
  );
  ctx.store.set(firewallKey(firewall.FirewallName), firewall);
  return {
    UpdateToken: updateToken(),
    FirewallArn: firewall.FirewallArn,
    FirewallName: firewall.FirewallName,
    AvailabilityZoneChangeProtection: firewall.AvailabilityZoneChangeProtection,
  };
};

const UpdateFirewallEncryptionConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  firewall.EncryptionConfiguration = input["EncryptionConfiguration"] ?? null;
  ctx.store.set(firewallKey(firewall.FirewallName), firewall);
  return {
    FirewallArn: firewall.FirewallArn,
    FirewallName: firewall.FirewallName,
    UpdateToken: updateToken(),
    EncryptionConfiguration: firewall.EncryptionConfiguration,
  };
};

const UpdateFirewallAnalysisSettings: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  firewall.EnabledAnalysisTypes = stringArrayFrom(
    input["EnabledAnalysisTypes"],
  );
  ctx.store.set(firewallKey(firewall.FirewallName), firewall);
  return {
    EnabledAnalysisTypes: firewall.EnabledAnalysisTypes,
    FirewallArn: firewall.FirewallArn,
    FirewallName: firewall.FirewallName,
    UpdateToken: updateToken(),
  };
};

const DescribeLoggingConfiguration: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  return {
    FirewallArn: firewall.FirewallArn,
    LoggingConfiguration: firewall.LoggingConfiguration,
    EnableMonitoringDashboard: false,
  };
};

const UpdateLoggingConfiguration: OperationHandler = (input, ctx) => {
  const firewall = requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  firewall.LoggingConfiguration = input["LoggingConfiguration"] ?? null;
  ctx.store.set(firewallKey(firewall.FirewallName), firewall);
  return {
    FirewallArn: firewall.FirewallArn,
    FirewallName: firewall.FirewallName,
    LoggingConfiguration: firewall.LoggingConfiguration,
    EnableMonitoringDashboard: booleanOrFalse(
      input["EnableMonitoringDashboard"],
    ),
  };
};

const CreateFirewallPolicy: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["FirewallPolicyName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidRequestException",
      "FirewallPolicyName is required.",
      400,
    );
  }
  if (
    ctx.store.get<StoredFirewallPolicy>(firewallPolicyKey(name)) !== undefined
  ) {
    throw awsError(
      "InvalidOperationException",
      `Firewall policy already exists: ${name}.`,
      400,
    );
  }
  const fp: StoredFirewallPolicy = {
    FirewallPolicyName: name,
    FirewallPolicyArn: firewallPolicyArnOf(ctx, name),
    FirewallPolicyId: firewallId(),
    Description: stringOrUndefined(input["Description"]),
    Tags: tagListFrom(input["Tags"]),
    FirewallPolicy: input["FirewallPolicy"] ?? null,
    UpdateToken: updateToken(),
  };
  ctx.store.set(firewallPolicyKey(name), fp);
  return {
    UpdateToken: fp.UpdateToken,
    FirewallPolicyResponse: firewallPolicyResponseView(fp),
  };
};

const DescribeFirewallPolicy: OperationHandler = (input, ctx) => {
  const fp = requireFirewallPolicy(
    ctx,
    stringOrUndefined(input["FirewallPolicyName"]),
    stringOrUndefined(input["FirewallPolicyArn"]),
  );
  return {
    UpdateToken: fp.UpdateToken,
    FirewallPolicyResponse: firewallPolicyResponseView(fp),
    FirewallPolicy: fp.FirewallPolicy,
  };
};

const ListFirewallPolicies: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredFirewallPolicy>()
    .filter((entry) => entry.key.startsWith("firewall-policy/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.FirewallPolicyName.localeCompare(b.FirewallPolicyName));
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  const result: Record<string, unknown> = {
    FirewallPolicies: items.map((fp) => ({
      Name: fp.FirewallPolicyName,
      Arn: fp.FirewallPolicyArn,
    })),
  };
  if (nextToken !== undefined) result["NextToken"] = nextToken;
  return result;
};

const UpdateFirewallPolicy: OperationHandler = (input, ctx) => {
  const fp = requireFirewallPolicy(
    ctx,
    stringOrUndefined(input["FirewallPolicyName"]),
    stringOrUndefined(input["FirewallPolicyArn"]),
  );
  const inputToken = stringOrUndefined(input["UpdateToken"]);
  if (inputToken !== fp.UpdateToken) {
    throw awsError(
      "InvalidTokenException",
      "The token you provided is stale or isn't valid for the operation.",
      400,
    );
  }
  if (input["FirewallPolicy"] !== undefined) {
    fp.FirewallPolicy = input["FirewallPolicy"];
  }
  if (input["Description"] !== undefined) {
    fp.Description = stringOrUndefined(input["Description"]);
  }
  fp.UpdateToken = updateToken();
  ctx.store.set(firewallPolicyKey(fp.FirewallPolicyName), fp);
  return {
    UpdateToken: fp.UpdateToken,
    FirewallPolicyResponse: firewallPolicyResponseView(fp),
  };
};

const DeleteFirewallPolicy: OperationHandler = (input, ctx) => {
  const fp = requireFirewallPolicy(
    ctx,
    stringOrUndefined(input["FirewallPolicyName"]),
    stringOrUndefined(input["FirewallPolicyArn"]),
  );
  ctx.store.delete(firewallPolicyKey(fp.FirewallPolicyName));
  return {
    FirewallPolicyResponse: {
      ...firewallPolicyResponseView(fp),
      FirewallPolicyStatus: "DELETING",
    },
  };
};

const CreateRuleGroup: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["RuleGroupName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidRequestException",
      "RuleGroupName is required.",
      400,
    );
  }
  if (ctx.store.get<StoredRuleGroup>(ruleGroupKey(name)) !== undefined) {
    throw awsError(
      "InvalidOperationException",
      `Rule group already exists: ${name}.`,
      400,
    );
  }
  const rg: StoredRuleGroup = {
    RuleGroupName: name,
    RuleGroupArn: ruleGroupArnOf(ctx, name),
    RuleGroupId: firewallId(),
    Description: stringOrUndefined(input["Description"]),
    Type: stringOrUndefined(input["Type"]),
    Capacity: numberOrUndefined(input["Capacity"]),
    Tags: tagListFrom(input["Tags"]),
    RuleGroup: input["RuleGroup"] ?? null,
    UpdateToken: updateToken(),
  };
  ctx.store.set(ruleGroupKey(name), rg);
  return {
    UpdateToken: rg.UpdateToken,
    RuleGroupResponse: ruleGroupResponseView(rg),
  };
};

const DescribeRuleGroup: OperationHandler = (input, ctx) => {
  const rg = requireRuleGroup(
    ctx,
    stringOrUndefined(input["RuleGroupName"]),
    stringOrUndefined(input["RuleGroupArn"]),
  );
  return {
    UpdateToken: rg.UpdateToken,
    RuleGroup: rg.RuleGroup,
    RuleGroupResponse: ruleGroupResponseView(rg),
  };
};

const DescribeRuleGroupMetadata: OperationHandler = (input, ctx) => {
  const rg = requireRuleGroup(
    ctx,
    stringOrUndefined(input["RuleGroupName"]),
    stringOrUndefined(input["RuleGroupArn"]),
  );
  return {
    RuleGroupArn: rg.RuleGroupArn,
    RuleGroupName: rg.RuleGroupName,
    Description: rg.Description,
    Type: rg.Type,
    Capacity: rg.Capacity,
    StatefulRuleOptions: null,
    LastModifiedTime: null,
  };
};

const DescribeRuleGroupSummary: OperationHandler = (input, ctx) => {
  const rg = requireRuleGroup(
    ctx,
    stringOrUndefined(input["RuleGroupName"]),
    stringOrUndefined(input["RuleGroupArn"]),
  );
  return {
    RuleGroupName: rg.RuleGroupName,
    Description: rg.Description,
    Summary: null,
  };
};

const ListRuleGroups: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredRuleGroup>()
    .filter((entry) => entry.key.startsWith("rule-group/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.RuleGroupName.localeCompare(b.RuleGroupName));
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  const result: Record<string, unknown> = {
    RuleGroups: items.map((rg) => ({
      Name: rg.RuleGroupName,
      Arn: rg.RuleGroupArn,
    })),
  };
  if (nextToken !== undefined) result["NextToken"] = nextToken;
  return result;
};

const UpdateRuleGroup: OperationHandler = (input, ctx) => {
  const rg = requireRuleGroup(
    ctx,
    stringOrUndefined(input["RuleGroupName"]),
    stringOrUndefined(input["RuleGroupArn"]),
  );
  const inputToken = stringOrUndefined(input["UpdateToken"]);
  if (inputToken !== rg.UpdateToken) {
    throw awsError(
      "InvalidTokenException",
      "The token you provided is stale or isn't valid for the operation.",
      400,
    );
  }
  if (input["RuleGroup"] !== undefined) {
    rg.RuleGroup = input["RuleGroup"];
  }
  if (input["Description"] !== undefined) {
    rg.Description = stringOrUndefined(input["Description"]);
  }
  rg.UpdateToken = updateToken();
  ctx.store.set(ruleGroupKey(rg.RuleGroupName), rg);
  return {
    UpdateToken: rg.UpdateToken,
    RuleGroupResponse: ruleGroupResponseView(rg),
  };
};

const DeleteRuleGroup: OperationHandler = (input, ctx) => {
  const rg = requireRuleGroup(
    ctx,
    stringOrUndefined(input["RuleGroupName"]),
    stringOrUndefined(input["RuleGroupArn"]),
  );
  ctx.store.delete(ruleGroupKey(rg.RuleGroupName));
  return {
    RuleGroupResponse: {
      ...ruleGroupResponseView(rg),
      RuleGroupStatus: "DELETING",
    },
  };
};

const CreateTLSInspectionConfiguration: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["TLSInspectionConfigurationName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidRequestException",
      "TLSInspectionConfigurationName is required.",
      400,
    );
  }
  if (ctx.store.get<StoredTLSConfig>(tlsConfigKey(name)) !== undefined) {
    throw awsError(
      "InvalidOperationException",
      `TLS inspection configuration already exists: ${name}.`,
      400,
    );
  }
  const tc: StoredTLSConfig = {
    TLSInspectionConfigurationName: name,
    TLSInspectionConfigurationArn: tlsConfigArnOf(ctx, name),
    TLSInspectionConfigurationId: firewallId(),
    Description: stringOrUndefined(input["Description"]),
    Tags: tagListFrom(input["Tags"]),
    TLSInspectionConfiguration: input["TLSInspectionConfiguration"] ?? null,
    UpdateToken: updateToken(),
  };
  ctx.store.set(tlsConfigKey(name), tc);
  return {
    UpdateToken: tc.UpdateToken,
    TLSInspectionConfigurationResponse: tlsConfigResponseView(tc),
  };
};

const DescribeTLSInspectionConfiguration: OperationHandler = (input, ctx) => {
  const tc = requireTLSConfig(
    ctx,
    stringOrUndefined(input["TLSInspectionConfigurationName"]),
    stringOrUndefined(input["TLSInspectionConfigurationArn"]),
  );
  return {
    UpdateToken: tc.UpdateToken,
    TLSInspectionConfiguration: tc.TLSInspectionConfiguration,
    TLSInspectionConfigurationResponse: tlsConfigResponseView(tc),
  };
};

const ListTLSInspectionConfigurations: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredTLSConfig>()
    .filter((entry) => entry.key.startsWith("tls-config/"))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.TLSInspectionConfigurationName.localeCompare(
        b.TLSInspectionConfigurationName,
      ),
    );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  const result: Record<string, unknown> = {
    TLSInspectionConfigurations: items.map((tc) => ({
      Name: tc.TLSInspectionConfigurationName,
      Arn: tc.TLSInspectionConfigurationArn,
    })),
  };
  if (nextToken !== undefined) result["NextToken"] = nextToken;
  return result;
};

const UpdateTLSInspectionConfiguration: OperationHandler = (input, ctx) => {
  const tc = requireTLSConfig(
    ctx,
    stringOrUndefined(input["TLSInspectionConfigurationName"]),
    stringOrUndefined(input["TLSInspectionConfigurationArn"]),
  );
  const inputToken = stringOrUndefined(input["UpdateToken"]);
  if (inputToken !== tc.UpdateToken) {
    throw awsError(
      "InvalidTokenException",
      "The token you provided is stale or isn't valid for the operation.",
      400,
    );
  }
  if (input["TLSInspectionConfiguration"] !== undefined) {
    tc.TLSInspectionConfiguration = input["TLSInspectionConfiguration"];
  }
  if (input["Description"] !== undefined) {
    tc.Description = stringOrUndefined(input["Description"]);
  }
  tc.UpdateToken = updateToken();
  ctx.store.set(tlsConfigKey(tc.TLSInspectionConfigurationName), tc);
  return {
    UpdateToken: tc.UpdateToken,
    TLSInspectionConfigurationResponse: tlsConfigResponseView(tc),
  };
};

const DeleteTLSInspectionConfiguration: OperationHandler = (input, ctx) => {
  const tc = requireTLSConfig(
    ctx,
    stringOrUndefined(input["TLSInspectionConfigurationName"]),
    stringOrUndefined(input["TLSInspectionConfigurationArn"]),
  );
  ctx.store.delete(tlsConfigKey(tc.TLSInspectionConfigurationName));
  return {
    TLSInspectionConfigurationResponse: {
      ...tlsConfigResponseView(tc),
      TLSInspectionConfigurationStatus: "DELETING",
    },
  };
};

const CreateProxy: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ProxyName"]);
  if (name === undefined) {
    throw awsError("InvalidRequestException", "ProxyName is required.", 400);
  }
  if (ctx.store.get<StoredProxy>(proxyKey(name)) !== undefined) {
    throw awsError(
      "InvalidOperationException",
      `Proxy already exists: ${name}.`,
      400,
    );
  }
  const p: StoredProxy = {
    ProxyName: name,
    ProxyArn: proxyArnOf(ctx, name),
    NatGatewayId: stringOrUndefined(input["NatGatewayId"]),
    Tags: tagListFrom(input["Tags"]),
    UpdateToken: updateToken(),
  };
  ctx.store.set(proxyKey(name), p);
  return {
    Proxy: proxyView(p),
    UpdateToken: p.UpdateToken,
  };
};

const DescribeProxy: OperationHandler = (input, ctx) => {
  const p = requireProxy(
    ctx,
    stringOrUndefined(input["ProxyName"]),
    stringOrUndefined(input["ProxyArn"]),
  );
  return {
    Proxy: {
      ProxyName: p.ProxyName,
      ProxyArn: p.ProxyArn,
      NatGatewayId: p.NatGatewayId,
      ProxyState: "READY",
      ProxyModifyState: "IN_SYNC",
      Tags: p.Tags,
    },
    UpdateToken: p.UpdateToken,
  };
};

const ListProxies: OperationHandler = (_input, ctx) => {
  const proxies = ctx.store
    .list<StoredProxy>()
    .filter((entry) => entry.key.startsWith("proxy/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.ProxyName.localeCompare(b.ProxyName));
  return {
    Proxies: proxies.map((p) => ({
      ProxyName: p.ProxyName,
      ProxyArn: p.ProxyArn,
    })),
  };
};

const UpdateProxy: OperationHandler = (input, ctx) => {
  const p = requireProxy(
    ctx,
    stringOrUndefined(input["ProxyName"]),
    stringOrUndefined(input["ProxyArn"]),
  );
  p.UpdateToken = updateToken();
  ctx.store.set(proxyKey(p.ProxyName), p);
  return {
    Proxy: proxyView(p),
    UpdateToken: p.UpdateToken,
  };
};

const DeleteProxy: OperationHandler = (input, ctx) => {
  const p = requireProxy(
    ctx,
    stringOrUndefined(input["ProxyName"]),
    stringOrUndefined(input["ProxyArn"]),
  );
  ctx.store.delete(proxyKey(p.ProxyName));
  return {
    NatGatewayId: p.NatGatewayId,
    ProxyName: p.ProxyName,
    ProxyArn: p.ProxyArn,
  };
};

const CreateProxyConfiguration: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ProxyConfigurationName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidRequestException",
      "ProxyConfigurationName is required.",
      400,
    );
  }
  if (
    ctx.store.get<StoredProxyConfiguration>(proxyConfigKey(name)) !== undefined
  ) {
    throw awsError(
      "InvalidOperationException",
      `Proxy configuration already exists: ${name}.`,
      400,
    );
  }
  const pc: StoredProxyConfiguration = {
    ProxyConfigurationName: name,
    ProxyConfigurationArn: proxyConfigArnOf(ctx, name),
    Description: stringOrUndefined(input["Description"]),
    Tags: tagListFrom(input["Tags"]),
    UpdateToken: updateToken(),
    RuleGroups: [],
  };
  ctx.store.set(proxyConfigKey(name), pc);
  return {
    ProxyConfiguration: proxyConfigView(pc),
    UpdateToken: pc.UpdateToken,
  };
};

const DescribeProxyConfiguration: OperationHandler = (input, ctx) => {
  const pc = requireProxyConfiguration(
    ctx,
    stringOrUndefined(input["ProxyConfigurationName"]),
    stringOrUndefined(input["ProxyConfigurationArn"]),
  );
  return {
    ProxyConfiguration: proxyConfigView(pc),
    UpdateToken: pc.UpdateToken,
  };
};

const ListProxyConfigurations: OperationHandler = (_input, ctx) => {
  const configs = ctx.store
    .list<StoredProxyConfiguration>()
    .filter((entry) => entry.key.startsWith("proxy-config/"))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.ProxyConfigurationName.localeCompare(b.ProxyConfigurationName),
    );
  return {
    ProxyConfigurations: configs.map((pc) => ({
      ProxyConfigurationName: pc.ProxyConfigurationName,
      ProxyConfigurationArn: pc.ProxyConfigurationArn,
    })),
  };
};

const UpdateProxyConfiguration: OperationHandler = (input, ctx) => {
  const pc = requireProxyConfiguration(
    ctx,
    stringOrUndefined(input["ProxyConfigurationName"]),
    stringOrUndefined(input["ProxyConfigurationArn"]),
  );
  pc.UpdateToken = updateToken();
  ctx.store.set(proxyConfigKey(pc.ProxyConfigurationName), pc);
  return {
    ProxyConfiguration: proxyConfigView(pc),
    UpdateToken: pc.UpdateToken,
  };
};

const DeleteProxyConfiguration: OperationHandler = (input, ctx) => {
  const pc = requireProxyConfiguration(
    ctx,
    stringOrUndefined(input["ProxyConfigurationName"]),
    stringOrUndefined(input["ProxyConfigurationArn"]),
  );
  ctx.store.delete(proxyConfigKey(pc.ProxyConfigurationName));
  return {
    ProxyConfigurationName: pc.ProxyConfigurationName,
    ProxyConfigurationArn: pc.ProxyConfigurationArn,
  };
};

const AttachRuleGroupsToProxyConfiguration: OperationHandler = (input, ctx) => {
  const pc = requireProxyConfiguration(
    ctx,
    stringOrUndefined(input["ProxyConfigurationName"]),
    stringOrUndefined(input["ProxyConfigurationArn"]),
  );
  const inputToken = stringOrUndefined(input["UpdateToken"]);
  if (inputToken !== pc.UpdateToken) {
    throw awsError(
      "InvalidTokenException",
      "The token you provided is stale or isn't valid for the operation.",
      400,
    );
  }
  const newGroups = Array.isArray(input["RuleGroups"])
    ? input["RuleGroups"]
    : [];
  for (const g of newGroups) {
    const rec = asRecord(g);
    if (rec === undefined) continue;
    const groupName = stringOrUndefined(rec["ProxyRuleGroupName"]);
    if (groupName === undefined) continue;
    const existing = pc.RuleGroups.find(
      (r) => r.ProxyRuleGroupName === groupName,
    );
    if (existing === undefined) {
      pc.RuleGroups.push({
        ProxyRuleGroupName: groupName,
        ProxyRuleGroupArn: undefined,
        Priority: undefined,
      });
    }
  }
  pc.UpdateToken = updateToken();
  ctx.store.set(proxyConfigKey(pc.ProxyConfigurationName), pc);
  return {
    ProxyConfiguration: proxyConfigView(pc),
    UpdateToken: pc.UpdateToken,
  };
};

const DetachRuleGroupsFromProxyConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const pc = requireProxyConfiguration(
    ctx,
    stringOrUndefined(input["ProxyConfigurationName"]),
    stringOrUndefined(input["ProxyConfigurationArn"]),
  );
  const inputToken = stringOrUndefined(input["UpdateToken"]);
  if (inputToken !== pc.UpdateToken) {
    throw awsError(
      "InvalidTokenException",
      "The token you provided is stale or isn't valid for the operation.",
      400,
    );
  }
  const removeNames = new Set(stringArrayFrom(input["RuleGroupNames"]));
  const removeArns = new Set(stringArrayFrom(input["RuleGroupArns"]));
  pc.RuleGroups = pc.RuleGroups.filter(
    (r) =>
      !removeNames.has(r.ProxyRuleGroupName) &&
      (r.ProxyRuleGroupArn === undefined ||
        !removeArns.has(r.ProxyRuleGroupArn)),
  );
  pc.UpdateToken = updateToken();
  ctx.store.set(proxyConfigKey(pc.ProxyConfigurationName), pc);
  return {
    ProxyConfiguration: proxyConfigView(pc),
    UpdateToken: pc.UpdateToken,
  };
};

const CreateProxyRuleGroup: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ProxyRuleGroupName"]);
  if (name === undefined) {
    throw awsError(
      "InvalidRequestException",
      "ProxyRuleGroupName is required.",
      400,
    );
  }
  if (
    ctx.store.get<StoredProxyRuleGroup>(proxyRuleGroupKey(name)) !== undefined
  ) {
    throw awsError(
      "InvalidOperationException",
      `Proxy rule group already exists: ${name}.`,
      400,
    );
  }
  const prg: StoredProxyRuleGroup = {
    ProxyRuleGroupName: name,
    ProxyRuleGroupArn: proxyRuleGroupArnOf(ctx, name),
    Description: stringOrUndefined(input["Description"]),
    Tags: tagListFrom(input["Tags"]),
    UpdateToken: updateToken(),
    Rules: {},
  };
  ctx.store.set(proxyRuleGroupKey(name), prg);
  return {
    ProxyRuleGroup: proxyRuleGroupView(prg),
    UpdateToken: prg.UpdateToken,
  };
};

const DescribeProxyRuleGroup: OperationHandler = (input, ctx) => {
  const prg = requireProxyRuleGroup(
    ctx,
    stringOrUndefined(input["ProxyRuleGroupName"]),
    stringOrUndefined(input["ProxyRuleGroupArn"]),
  );
  return {
    ProxyRuleGroup: proxyRuleGroupView(prg),
    UpdateToken: prg.UpdateToken,
  };
};

const ListProxyRuleGroups: OperationHandler = (_input, ctx) => {
  const groups = ctx.store
    .list<StoredProxyRuleGroup>()
    .filter((entry) => entry.key.startsWith("proxy-rule-group/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.ProxyRuleGroupName.localeCompare(b.ProxyRuleGroupName));
  return {
    ProxyRuleGroups: groups.map((prg) => ({
      ProxyRuleGroupName: prg.ProxyRuleGroupName,
      ProxyRuleGroupArn: prg.ProxyRuleGroupArn,
    })),
  };
};

const DeleteProxyRuleGroup: OperationHandler = (input, ctx) => {
  const prg = requireProxyRuleGroup(
    ctx,
    stringOrUndefined(input["ProxyRuleGroupName"]),
    stringOrUndefined(input["ProxyRuleGroupArn"]),
  );
  ctx.store.delete(proxyRuleGroupKey(prg.ProxyRuleGroupName));
  return {
    ProxyRuleGroupName: prg.ProxyRuleGroupName,
    ProxyRuleGroupArn: prg.ProxyRuleGroupArn,
  };
};

const CreateProxyRules: OperationHandler = (input, ctx) => {
  const prg = requireProxyRuleGroup(
    ctx,
    stringOrUndefined(input["ProxyRuleGroupName"]),
    stringOrUndefined(input["ProxyRuleGroupArn"]),
  );
  const rulesInput = asRecord(input["Rules"]);
  const phases = ["PreDNS", "PreREQUEST", "PostRESPONSE"] as const;
  for (const phase of phases) {
    const phaseRules = rulesInput?.[phase];
    if (!Array.isArray(phaseRules)) continue;
    for (const ruleEntry of phaseRules) {
      const rec = asRecord(ruleEntry);
      if (rec === undefined) continue;
      const ruleName = stringOrUndefined(rec["ProxyRuleName"]);
      if (ruleName === undefined) continue;
      prg.Rules[ruleName] = {
        ProxyRuleName: ruleName,
        Description: stringOrUndefined(rec["Description"]),
        Action: stringOrUndefined(rec["Action"]),
        Conditions: Array.isArray(rec["Conditions"]) ? rec["Conditions"] : [],
        UpdateToken: updateToken(),
      };
    }
  }
  prg.UpdateToken = updateToken();
  ctx.store.set(proxyRuleGroupKey(prg.ProxyRuleGroupName), prg);
  return {
    ProxyRuleGroup: proxyRuleGroupView(prg),
    UpdateToken: prg.UpdateToken,
  };
};

const DeleteProxyRules: OperationHandler = (input, ctx) => {
  const prg = requireProxyRuleGroup(
    ctx,
    stringOrUndefined(input["ProxyRuleGroupName"]),
    stringOrUndefined(input["ProxyRuleGroupArn"]),
  );
  for (const ruleName of stringArrayFrom(input["Rules"])) {
    delete prg.Rules[ruleName];
  }
  prg.UpdateToken = updateToken();
  ctx.store.set(proxyRuleGroupKey(prg.ProxyRuleGroupName), prg);
  return {
    ProxyRuleGroup: proxyRuleGroupView(prg),
  };
};

const DescribeProxyRule: OperationHandler = (input, ctx) => {
  const prg = requireProxyRuleGroup(
    ctx,
    stringOrUndefined(input["ProxyRuleGroupName"]),
    stringOrUndefined(input["ProxyRuleGroupArn"]),
  );
  const ruleName = stringOrUndefined(input["ProxyRuleName"]);
  if (ruleName === undefined || prg.Rules[ruleName] === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The proxy rule does not exist.",
      400,
    );
  }
  const rule = prg.Rules[ruleName];
  return {
    ProxyRule: {
      ProxyRuleName: rule.ProxyRuleName,
      Description: rule.Description,
      Action: rule.Action,
      Conditions: rule.Conditions,
    },
    UpdateToken: rule.UpdateToken,
  };
};

const UpdateProxyRule: OperationHandler = (input, ctx) => {
  const prg = requireProxyRuleGroup(
    ctx,
    stringOrUndefined(input["ProxyRuleGroupName"]),
    stringOrUndefined(input["ProxyRuleGroupArn"]),
  );
  const ruleName = stringOrUndefined(input["ProxyRuleName"]);
  if (ruleName === undefined || prg.Rules[ruleName] === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The proxy rule does not exist.",
      400,
    );
  }
  const rule = prg.Rules[ruleName];
  const inputToken = stringOrUndefined(input["UpdateToken"]);
  if (inputToken !== rule.UpdateToken) {
    throw awsError(
      "InvalidTokenException",
      "The token you provided is stale or isn't valid for the operation.",
      400,
    );
  }
  if (input["Action"] !== undefined) {
    rule.Action = stringOrUndefined(input["Action"]);
  }
  if (input["Description"] !== undefined) {
    rule.Description = stringOrUndefined(input["Description"]);
  }
  const addConditions = Array.isArray(input["AddConditions"])
    ? input["AddConditions"]
    : [];
  const removeConditions: unknown[] = Array.isArray(input["RemoveConditions"])
    ? input["RemoveConditions"]
    : [];
  const removedSet = new Set(removeConditions.map((c) => JSON.stringify(c)));
  const remaining = rule.Conditions.filter(
    (c) => !removedSet.has(JSON.stringify(c)),
  );
  rule.Conditions = [...remaining, ...addConditions];
  rule.UpdateToken = updateToken();
  ctx.store.set(proxyRuleGroupKey(prg.ProxyRuleGroupName), prg);
  return {
    ProxyRule: {
      ProxyRuleName: rule.ProxyRuleName,
      Description: rule.Description,
      Action: rule.Action,
      Conditions: rule.Conditions,
    },
    RemovedConditions: removeConditions,
    UpdateToken: rule.UpdateToken,
  };
};

const UpdateProxyRuleGroupPriorities: OperationHandler = (input, ctx) => {
  requireProxyConfiguration(
    ctx,
    stringOrUndefined(input["ProxyConfigurationName"]),
    stringOrUndefined(input["ProxyConfigurationArn"]),
  );
  return {
    ProxyRuleGroups: [],
    UpdateToken: updateToken(),
  };
};

const UpdateProxyRulePriorities: OperationHandler = (input, ctx) => {
  requireProxyRuleGroup(
    ctx,
    stringOrUndefined(input["ProxyRuleGroupName"]),
    stringOrUndefined(input["ProxyRuleGroupArn"]),
  );
  return {
    ProxyRuleGroupName: stringOrUndefined(input["ProxyRuleGroupName"]),
    ProxyRuleGroupArn: stringOrUndefined(input["ProxyRuleGroupArn"]),
    RuleGroupRequestPhase: input["RuleGroupRequestPhase"],
    Rules: [],
    UpdateToken: updateToken(),
  };
};

const CreateVpcEndpointAssociation: OperationHandler = (input, ctx) => {
  const firewallArn = stringOrUndefined(input["FirewallArn"]);
  if (firewallArn === undefined) {
    throw awsError("InvalidRequestException", "FirewallArn is required.", 400);
  }
  const id = firewallId();
  const assoc: StoredVpcEndpointAssociation = {
    VpcEndpointAssociationId: id,
    VpcEndpointAssociationArn: vpcEndpointAssocArnOf(ctx, id),
    FirewallArn: firewallArn,
    VpcId: stringOrUndefined(input["VpcId"]),
    SubnetMapping: input["SubnetMapping"] ?? null,
    Description: stringOrUndefined(input["Description"]),
    Tags: tagListFrom(input["Tags"]),
  };
  ctx.store.set(vpcEndpointAssocKey(id), assoc);
  return {
    VpcEndpointAssociation: vpcEndpointAssocView(assoc),
    VpcEndpointAssociationStatus: vpcEndpointAssocStatusView(),
  };
};

const DescribeVpcEndpointAssociation: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["VpcEndpointAssociationArn"]);
  if (arn === undefined) {
    throw awsError(
      "InvalidRequestException",
      "VpcEndpointAssociationArn is required.",
      400,
    );
  }
  const assoc = requireVpcEndpointAssocByArn(ctx, arn);
  return {
    VpcEndpointAssociation: vpcEndpointAssocView(assoc),
    VpcEndpointAssociationStatus: vpcEndpointAssocStatusView(),
  };
};

const ListVpcEndpointAssociations: OperationHandler = (input, ctx) => {
  const firewallArn = stringOrUndefined(input["FirewallArn"]);
  const all = ctx.store
    .list<StoredVpcEndpointAssociation>()
    .filter((entry) => entry.key.startsWith("vpc-endpoint-assoc/"))
    .map((entry) => entry.value)
    .filter(
      (assoc) => firewallArn === undefined || assoc.FirewallArn === firewallArn,
    );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  const result: Record<string, unknown> = {
    VpcEndpointAssociations: items.map((assoc) => ({
      VpcEndpointAssociationId: assoc.VpcEndpointAssociationId,
      VpcEndpointAssociationArn: assoc.VpcEndpointAssociationArn,
    })),
  };
  if (nextToken !== undefined) result["NextToken"] = nextToken;
  return result;
};

const DeleteVpcEndpointAssociation: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["VpcEndpointAssociationArn"]);
  if (arn === undefined) {
    throw awsError(
      "InvalidRequestException",
      "VpcEndpointAssociationArn is required.",
      400,
    );
  }
  const assoc = requireVpcEndpointAssocByArn(ctx, arn);
  ctx.store.delete(vpcEndpointAssocKey(assoc.VpcEndpointAssociationId));
  return {
    VpcEndpointAssociation: vpcEndpointAssocView(assoc),
    VpcEndpointAssociationStatus: { Status: "DELETING" },
  };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ResourceArn"]);
  if (arn === undefined) {
    throw awsError("InvalidRequestException", "ResourceArn is required.", 400);
  }
  const policy = stringOrUndefined(input["Policy"]);
  if (policy === undefined) {
    throw awsError("InvalidRequestException", "Policy is required.", 400);
  }
  ctx.store.set(resourcePolicyKey(arn), {
    Policy: policy,
  } as StoredResourcePolicy);
  return {};
};

const DescribeResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ResourceArn"]);
  if (arn === undefined) {
    throw awsError("InvalidRequestException", "ResourceArn is required.", 400);
  }
  const stored = ctx.store.get<StoredResourcePolicy>(resourcePolicyKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The resource policy does not exist.",
      400,
    );
  }
  return { Policy: stored.Policy };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ResourceArn"]);
  if (arn === undefined) {
    throw awsError("InvalidRequestException", "ResourceArn is required.", 400);
  }
  ctx.store.delete(resourcePolicyKey(arn));
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ResourceArn"]);
  if (arn === undefined) {
    throw awsError("InvalidRequestException", "ResourceArn is required.", 400);
  }
  const newTags = tagListFrom(input["Tags"]);
  const key = tagsKey(arn);
  const existing = ctx.store.get<{ Tags: TagEntry[] }>(key);
  const existingTags = existing?.Tags ?? [];
  const newKeys = new Set(newTags.map((t) => t.Key));
  const merged = [
    ...existingTags.filter((t) => !newKeys.has(t.Key)),
    ...newTags,
  ];
  ctx.store.set(key, { Tags: merged });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ResourceArn"]);
  if (arn === undefined) {
    throw awsError("InvalidRequestException", "ResourceArn is required.", 400);
  }
  const tagKeys = new Set(stringArrayFrom(input["TagKeys"]));
  const key = tagsKey(arn);
  const existing = ctx.store.get<{ Tags: TagEntry[] }>(key);
  if (existing !== undefined) {
    ctx.store.set(key, {
      Tags: existing.Tags.filter((t) => !tagKeys.has(t.Key ?? "")),
    });
  }
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ResourceArn"]);
  if (arn === undefined) {
    throw awsError("InvalidRequestException", "ResourceArn is required.", 400);
  }
  const stored = ctx.store.get<{ Tags: TagEntry[] }>(tagsKey(arn));
  return { Tags: stored?.Tags ?? [] };
};

const AcceptNetworkFirewallTransitGatewayAttachment: OperationHandler = (
  input,
) => {
  const attachmentId = stringOrUndefined(input["TransitGatewayAttachmentId"]);
  if (attachmentId === undefined) {
    throw awsError(
      "InvalidRequestException",
      "TransitGatewayAttachmentId is required.",
      400,
    );
  }
  return {
    TransitGatewayAttachmentId: attachmentId,
    TransitGatewayAttachmentStatus: "AVAILABLE",
  };
};

const RejectNetworkFirewallTransitGatewayAttachment: OperationHandler = (
  input,
) => {
  const attachmentId = stringOrUndefined(input["TransitGatewayAttachmentId"]);
  if (attachmentId === undefined) {
    throw awsError(
      "InvalidRequestException",
      "TransitGatewayAttachmentId is required.",
      400,
    );
  }
  return {
    TransitGatewayAttachmentId: attachmentId,
    TransitGatewayAttachmentStatus: "REJECTED",
  };
};

const DeleteNetworkFirewallTransitGatewayAttachment: OperationHandler = (
  input,
) => {
  const attachmentId = stringOrUndefined(input["TransitGatewayAttachmentId"]);
  if (attachmentId === undefined) {
    throw awsError(
      "InvalidRequestException",
      "TransitGatewayAttachmentId is required.",
      400,
    );
  }
  return {
    TransitGatewayAttachmentId: attachmentId,
    TransitGatewayAttachmentStatus: "DELETING",
  };
};

const StartAnalysisReport: OperationHandler = (input, ctx) => {
  requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  return {
    AnalysisReportId: firewallId(),
  };
};

const ListAnalysisReports: OperationHandler = (input, ctx) => {
  requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  const result: Record<string, unknown> = {
    AnalysisReports: [],
  };
  return result;
};

const GetAnalysisReportResults: OperationHandler = (input, ctx) => {
  requireFirewall(
    ctx,
    stringOrUndefined(input["FirewallName"]),
    stringOrUndefined(input["FirewallArn"]),
  );
  return {
    Status: "COMPLETED",
    StartTime: null,
    EndTime: null,
    ReportTime: null,
    AnalysisType: input["AnalysisType"],
    AnalysisReportResults: [],
  };
};

const StartFlowCapture: OperationHandler = (input, ctx) => {
  const firewallArn = stringOrUndefined(input["FirewallArn"]);
  if (firewallArn === undefined) {
    throw awsError("InvalidRequestException", "FirewallArn is required.", 400);
  }
  requireFirewall(ctx, undefined, firewallArn);
  return {
    FirewallArn: firewallArn,
    FlowOperationId: firewallId(),
    FlowOperationStatus: "STARTED",
  };
};

const StartFlowFlush: OperationHandler = (input, ctx) => {
  const firewallArn = stringOrUndefined(input["FirewallArn"]);
  if (firewallArn === undefined) {
    throw awsError("InvalidRequestException", "FirewallArn is required.", 400);
  }
  requireFirewall(ctx, undefined, firewallArn);
  return {
    FirewallArn: firewallArn,
    FlowOperationId: firewallId(),
    FlowOperationStatus: "STARTED",
  };
};

const DescribeFlowOperation: OperationHandler = (input, ctx) => {
  const firewallArn = stringOrUndefined(input["FirewallArn"]);
  if (firewallArn === undefined) {
    throw awsError("InvalidRequestException", "FirewallArn is required.", 400);
  }
  requireFirewall(ctx, undefined, firewallArn);
  return {
    FirewallArn: firewallArn,
    AvailabilityZone: stringOrUndefined(input["AvailabilityZone"]),
    VpcEndpointAssociationArn: stringOrUndefined(
      input["VpcEndpointAssociationArn"],
    ),
    VpcEndpointId: stringOrUndefined(input["VpcEndpointId"]),
    FlowOperationId: stringOrUndefined(input["FlowOperationId"]),
    FlowOperationType: "FLOW_CAPTURE",
    FlowOperationStatus: "COMPLETED",
    StatusMessage: undefined,
    FlowRequestTimestamp: null,
    FlowOperation: null,
  };
};

const ListFlowOperations: OperationHandler = (input, ctx) => {
  const firewallArn = stringOrUndefined(input["FirewallArn"]);
  if (firewallArn === undefined) {
    throw awsError("InvalidRequestException", "FirewallArn is required.", 400);
  }
  requireFirewall(ctx, undefined, firewallArn);
  const result: Record<string, unknown> = {
    FlowOperations: [],
  };
  return result;
};

const ListFlowOperationResults: OperationHandler = (input, ctx) => {
  const firewallArn = stringOrUndefined(input["FirewallArn"]);
  if (firewallArn === undefined) {
    throw awsError("InvalidRequestException", "FirewallArn is required.", 400);
  }
  requireFirewall(ctx, undefined, firewallArn);
  return {
    FirewallArn: firewallArn,
    AvailabilityZone: stringOrUndefined(input["AvailabilityZone"]),
    VpcEndpointAssociationArn: stringOrUndefined(
      input["VpcEndpointAssociationArn"],
    ),
    VpcEndpointId: stringOrUndefined(input["VpcEndpointId"]),
    FlowOperationId: stringOrUndefined(input["FlowOperationId"]),
    FlowOperationStatus: "COMPLETED",
    StatusMessage: undefined,
    FlowRequestTimestamp: null,
    Flows: [],
  };
};

const networkFirewall = {
  name: "network-firewall",
  protocol: "json",
  operations: {
    AcceptNetworkFirewallTransitGatewayAttachment,
    AssociateAvailabilityZones,
    AssociateFirewallPolicy,
    AssociateSubnets,
    AttachRuleGroupsToProxyConfiguration,
    CreateFirewall,
    CreateFirewallPolicy,
    CreateProxy,
    CreateProxyConfiguration,
    CreateProxyRuleGroup,
    CreateProxyRules,
    CreateRuleGroup,
    CreateTLSInspectionConfiguration,
    CreateVpcEndpointAssociation,
    DeleteFirewall,
    DeleteFirewallPolicy,
    DeleteNetworkFirewallTransitGatewayAttachment,
    DeleteProxy,
    DeleteProxyConfiguration,
    DeleteProxyRuleGroup,
    DeleteProxyRules,
    DeleteResourcePolicy,
    DeleteRuleGroup,
    DeleteTLSInspectionConfiguration,
    DeleteVpcEndpointAssociation,
    DescribeFirewall,
    DescribeFirewallMetadata,
    DescribeFirewallPolicy,
    DescribeFlowOperation,
    DescribeLoggingConfiguration,
    DescribeProxy,
    DescribeProxyConfiguration,
    DescribeProxyRule,
    DescribeProxyRuleGroup,
    DescribeResourcePolicy,
    DescribeRuleGroup,
    DescribeRuleGroupMetadata,
    DescribeRuleGroupSummary,
    DescribeTLSInspectionConfiguration,
    DescribeVpcEndpointAssociation,
    DetachRuleGroupsFromProxyConfiguration,
    DisassociateAvailabilityZones,
    DisassociateSubnets,
    GetAnalysisReportResults,
    ListAnalysisReports,
    ListFirewallPolicies,
    ListFirewalls,
    ListFlowOperationResults,
    ListFlowOperations,
    ListProxies,
    ListProxyConfigurations,
    ListProxyRuleGroups,
    ListRuleGroups,
    ListTLSInspectionConfigurations,
    ListTagsForResource,
    ListVpcEndpointAssociations,
    PutResourcePolicy,
    RejectNetworkFirewallTransitGatewayAttachment,
    StartAnalysisReport,
    StartFlowCapture,
    StartFlowFlush,
    TagResource,
    UntagResource,
    UpdateAvailabilityZoneChangeProtection,
    UpdateFirewallAnalysisSettings,
    UpdateFirewallDeleteProtection,
    UpdateFirewallDescription,
    UpdateFirewallEncryptionConfiguration,
    UpdateFirewallPolicy,
    UpdateFirewallPolicyChangeProtection,
    UpdateLoggingConfiguration,
    UpdateProxy,
    UpdateProxyConfiguration,
    UpdateProxyRule,
    UpdateProxyRuleGroupPriorities,
    UpdateProxyRulePriorities,
    UpdateRuleGroup,
    UpdateSubnetChangeProtection,
    UpdateTLSInspectionConfiguration,
  },
  model,
} as const satisfies ServiceDefinition;

export default networkFirewall;
