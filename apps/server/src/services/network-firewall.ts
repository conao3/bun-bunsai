import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import networkFirewallModel from "../../../../test/vendor/aws-models/network-firewall.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(networkFirewallModel);

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
  Description: string | undefined;
  FirewallId: string;
  Tags: { Key: string | undefined; Value: string | undefined }[];
};

const firewallKey = (name: string): string => `firewall/${name}`;

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const booleanOrFalse = (value: unknown): boolean => value === true;

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

const tagListFrom = (
  value: unknown,
): { Key: string | undefined; Value: string | undefined }[] => {
  if (!Array.isArray(value)) return [];
  const out: { Key: string | undefined; Value: string | undefined }[] = [];
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

const firewallId = (): string => crypto.randomUUID();

const firewallArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:network-firewall:${ctx.region}:${ctx.account}:firewall/${name}`;

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
    Description: stringOrUndefined(input["Description"]),
    FirewallId: firewallId(),
    Tags: tagListFrom(input["Tags"]),
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

const ListFirewalls: OperationHandler = (_input, ctx) => {
  const firewalls = ctx.store
    .list<StoredFirewall>()
    .filter((entry) => entry.key.startsWith("firewall/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.FirewallName.localeCompare(b.FirewallName));
  return {
    Firewalls: firewalls.map((firewall) => ({
      FirewallName: firewall.FirewallName,
      FirewallArn: firewall.FirewallArn,
    })),
  };
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

const networkFirewall = {
  name: "network-firewall",
  protocol: "json",
  operations: {
    CreateFirewall,
    DescribeFirewall,
    ListFirewalls,
    DeleteFirewall,
  },
  model,
} as const satisfies ServiceDefinition;

export default networkFirewall;
