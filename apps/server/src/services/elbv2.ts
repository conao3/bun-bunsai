import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import elbv2Model from "../../models/elbv2.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(elbv2Model);

type StoredLoadBalancer = {
  LoadBalancerArn: string;
  LoadBalancerName: string;
  DNSName: string;
  CanonicalHostedZoneId: string;
  CreatedTime: string;
  Scheme: string;
  VpcId: string | undefined;
  State: { Code: string };
  Type: string;
  AvailabilityZones: Record<string, unknown>[];
  SecurityGroups: string[];
  IpAddressType: string;
};

type StoredTargetGroup = {
  TargetGroupArn: string;
  TargetGroupName: string;
  Protocol: string | undefined;
  Port: number | undefined;
  VpcId: string | undefined;
  TargetType: string;
  HealthCheckEnabled: boolean;
  HealthCheckProtocol: string | undefined;
  HealthCheckPath: string | undefined;
  HealthCheckPort: string | undefined;
  HealthCheckIntervalSeconds: number | undefined;
  HealthCheckTimeoutSeconds: number | undefined;
  HealthyThresholdCount: number | undefined;
  UnhealthyThresholdCount: number | undefined;
  LoadBalancerArns: string[];
  IpAddressType: string;
};

type StoredListener = {
  ListenerArn: string;
  LoadBalancerArn: string;
  Port: number | undefined;
  Protocol: string | undefined;
  DefaultActions: Record<string, unknown>[];
  Certificates: Record<string, unknown>[];
  SslPolicy: string | undefined;
};

type StoredRule = {
  RuleArn: string;
  ListenerArn: string;
  Priority: string;
  Conditions: Record<string, unknown>[];
  Actions: Record<string, unknown>[];
  IsDefault: boolean;
};

type StoredTarget = {
  Id: string;
  Port: number | undefined;
  AvailabilityZone: string | undefined;
};

type StoredTrustStore = {
  TrustStoreArn: string;
  Name: string;
  Status: string;
  NumberOfCaCertificates: number;
  TotalRevokedEntries: number;
};

type StoredRevocation = {
  RevocationId: number;
  TrustStoreArn: string;
  RevocationType: string;
  NumberOfRevokedEntries: number;
};

const loadBalancerKey = (id: string): string => `lb/${id}`;

const targetGroupKey = (id: string): string => `tg/${id}`;

const listenerKey = (id: string): string => `listener/${id}`;

const ruleKey = (id: string): string => `rule/${id}`;

const targetsKey = (tgArn: string): string => `targets/${tgArn}`;

const tagsKey = (resourceArn: string): string => `tags/${resourceArn}`;

const lbAttrsKey = (lbArn: string): string => `lbattrs/${lbArn}`;

const tgAttrsKey = (tgArn: string): string => `tgattrs/${tgArn}`;

const listenerAttrsKey = (listenerArn: string): string =>
  `listenerattrs/${listenerArn}`;

const trustStoreKey = (arn: string): string => `truststore/${arn}`;

const revocationKey = (tsArn: string, revId: number): string =>
  `revocation/${tsArn}/${revId}`;

const capacityKey = (lbArn: string): string => `capacity/${lbArn}`;

const randomHex = (length: number): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationError", `${field} is required.`, 400);
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  field: string,
): string | undefined => {
  const value = input[field];
  return typeof value === "string" ? value : undefined;
};

const optionalNumber = (
  input: Record<string, unknown>,
  field: string,
): number | undefined => {
  const value = input[field];
  return typeof value === "number" ? value : undefined;
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(
        (item): item is string => typeof item === "string",
      )
    : [];

const objectList = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? (value as unknown[])
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null,
        )
        .map((item) => ({ ...item }))
    : [];

const extractTgArnsFromActions = (
  actions: Record<string, unknown>[],
): string[] => {
  const arns: string[] = [];
  for (const action of actions) {
    if (typeof action["TargetGroupArn"] === "string") {
      arns.push(action["TargetGroupArn"]);
    }
    const fc = action["ForwardConfig"];
    if (fc !== null && typeof fc === "object") {
      const tgEntries = (fc as Record<string, unknown>)["TargetGroups"];
      if (Array.isArray(tgEntries)) {
        for (const t of tgEntries as Record<string, unknown>[]) {
          if (typeof t["TargetGroupArn"] === "string") {
            arns.push(t["TargetGroupArn"]);
          }
        }
      }
    }
  }
  return [...new Set(arns)];
};

const validateTgArnsInActions = (
  ctx: ServiceContext,
  actions: Record<string, unknown>[],
): void => {
  for (const arn of extractTgArnsFromActions(actions)) {
    if (ctx.store.get<StoredTargetGroup>(targetGroupKey(arn)) === undefined) {
      throw awsError(
        "TargetGroupNotFound",
        `Target group '${arn}' not found`,
        400,
      );
    }
  }
};

const syncTgLbAssociation = (ctx: ServiceContext, lbArn: string): void => {
  const currentTgArns = new Set<string>();
  const listeners = ctx.store
    .list<StoredListener>()
    .filter((e) => e.key.startsWith("listener/"))
    .map((e) => e.value)
    .filter((l) => l.LoadBalancerArn === lbArn);
  for (const l of listeners) {
    for (const arn of extractTgArnsFromActions(l.DefaultActions)) {
      currentTgArns.add(arn);
    }
  }
  const rules = ctx.store
    .list<StoredRule>()
    .filter((e) => e.key.startsWith("rule/"))
    .map((e) => e.value)
    .filter((r) => {
      const l = ctx.store.get<StoredListener>(listenerKey(r.ListenerArn));
      return l?.LoadBalancerArn === lbArn;
    });
  for (const r of rules) {
    for (const arn of extractTgArnsFromActions(r.Actions)) {
      currentTgArns.add(arn);
    }
  }
  const allTgs = ctx.store
    .list<StoredTargetGroup>()
    .filter((e) => e.key.startsWith("tg/"))
    .map((e) => e.value);
  for (const tg of allTgs) {
    const isReferenced = currentTgArns.has(tg.TargetGroupArn);
    const hasLb = tg.LoadBalancerArns.includes(lbArn);
    if (isReferenced && !hasLb) {
      tg.LoadBalancerArns = [...tg.LoadBalancerArns, lbArn];
      ctx.store.set(targetGroupKey(tg.TargetGroupArn), tg);
    } else if (!isReferenced && hasLb) {
      tg.LoadBalancerArns = tg.LoadBalancerArns.filter((a) => a !== lbArn);
      ctx.store.set(targetGroupKey(tg.TargetGroupArn), tg);
    }
  }
};

const applyPagination = <T>(
  items: T[],
  marker: string | undefined,
  pageSize: unknown,
  arnFn: (item: T) => string,
): { result: T[]; nextMarker?: string } => {
  const size =
    typeof pageSize === "number" && pageSize > 0 ? pageSize : items.length;
  let startIdx = 0;
  if (marker !== undefined) {
    const idx = items.findIndex((item) => arnFn(item) === marker);
    if (idx >= 0) startIdx = idx;
  }
  const result = items.slice(startIdx, startIdx + size);
  const nextMarker =
    startIdx + size < items.length ? arnFn(items[startIdx + size]) : undefined;
  return { result, ...(nextMarker !== undefined ? { nextMarker } : {}) };
};

const loadBalancerView = (lb: StoredLoadBalancer): Record<string, unknown> => ({
  LoadBalancerArn: lb.LoadBalancerArn,
  DNSName: lb.DNSName,
  CanonicalHostedZoneId: lb.CanonicalHostedZoneId,
  CreatedTime: lb.CreatedTime,
  LoadBalancerName: lb.LoadBalancerName,
  Scheme: lb.Scheme,
  ...(lb.VpcId === undefined ? {} : { VpcId: lb.VpcId }),
  State: lb.State,
  Type: lb.Type,
  AvailabilityZones: lb.AvailabilityZones,
  SecurityGroups: lb.SecurityGroups,
  IpAddressType: lb.IpAddressType,
});

const targetGroupView = (tg: StoredTargetGroup): Record<string, unknown> => ({
  TargetGroupArn: tg.TargetGroupArn,
  TargetGroupName: tg.TargetGroupName,
  ...(tg.Protocol === undefined ? {} : { Protocol: tg.Protocol }),
  ...(tg.Port === undefined ? {} : { Port: tg.Port }),
  ...(tg.VpcId === undefined ? {} : { VpcId: tg.VpcId }),
  TargetType: tg.TargetType,
  HealthCheckEnabled: tg.HealthCheckEnabled,
  ...(tg.HealthCheckProtocol === undefined
    ? {}
    : { HealthCheckProtocol: tg.HealthCheckProtocol }),
  ...(tg.HealthCheckPath === undefined
    ? {}
    : { HealthCheckPath: tg.HealthCheckPath }),
  ...(tg.HealthCheckPort === undefined
    ? {}
    : { HealthCheckPort: tg.HealthCheckPort }),
  ...(tg.HealthCheckIntervalSeconds === undefined
    ? {}
    : { HealthCheckIntervalSeconds: tg.HealthCheckIntervalSeconds }),
  ...(tg.HealthCheckTimeoutSeconds === undefined
    ? {}
    : { HealthCheckTimeoutSeconds: tg.HealthCheckTimeoutSeconds }),
  ...(tg.HealthyThresholdCount === undefined
    ? {}
    : { HealthyThresholdCount: tg.HealthyThresholdCount }),
  ...(tg.UnhealthyThresholdCount === undefined
    ? {}
    : { UnhealthyThresholdCount: tg.UnhealthyThresholdCount }),
  LoadBalancerArns: tg.LoadBalancerArns,
  IpAddressType: tg.IpAddressType,
});

const listenerView = (listener: StoredListener): Record<string, unknown> => ({
  ListenerArn: listener.ListenerArn,
  LoadBalancerArn: listener.LoadBalancerArn,
  ...(listener.Port === undefined ? {} : { Port: listener.Port }),
  ...(listener.Protocol === undefined ? {} : { Protocol: listener.Protocol }),
  DefaultActions: listener.DefaultActions,
  Certificates: listener.Certificates,
  ...(listener.SslPolicy === undefined
    ? {}
    : { SslPolicy: listener.SslPolicy }),
});

const ruleView = (rule: StoredRule): Record<string, unknown> => ({
  RuleArn: rule.RuleArn,
  Priority: rule.Priority,
  Conditions: rule.Conditions,
  Actions: rule.Actions,
  IsDefault: rule.IsDefault,
});

const trustStoreView = (ts: StoredTrustStore): Record<string, unknown> => ({
  TrustStoreArn: ts.TrustStoreArn,
  Name: ts.Name,
  Status: ts.Status,
  NumberOfCaCertificates: ts.NumberOfCaCertificates,
  TotalRevokedEntries: ts.TotalRevokedEntries,
});

const requireListener = (
  ctx: { store: { get: <T>(k: string) => T | undefined } },
  arn: string,
): StoredListener => {
  const listener = ctx.store.get<StoredListener>(listenerKey(arn));
  if (listener === undefined) {
    throw awsError("ListenerNotFound", `Listener '${arn}' not found`, 400);
  }
  return listener;
};

const requireRule = (
  ctx: { store: { get: <T>(k: string) => T | undefined } },
  arn: string,
): StoredRule => {
  const rule = ctx.store.get<StoredRule>(ruleKey(arn));
  if (rule === undefined) {
    throw awsError("RuleNotFound", `Rule '${arn}' not found`, 400);
  }
  return rule;
};

const requireTrustStore = (
  ctx: { store: { get: <T>(k: string) => T | undefined } },
  arn: string,
): StoredTrustStore => {
  const ts = ctx.store.get<StoredTrustStore>(trustStoreKey(arn));
  if (ts === undefined) {
    throw awsError("TrustStoreNotFound", `Trust store '${arn}' not found`, 400);
  }
  return ts;
};

const requireLoadBalancer = (
  ctx: { store: { get: <T>(k: string) => T | undefined } },
  arn: string,
): StoredLoadBalancer => {
  const lb = ctx.store.get<StoredLoadBalancer>(loadBalancerKey(arn));
  if (lb === undefined) {
    throw awsError(
      "LoadBalancerNotFound",
      `Load balancer '${arn}' not found`,
      400,
    );
  }
  return lb;
};

const requireTargetGroup = (
  ctx: { store: { get: <T>(k: string) => T | undefined } },
  arn: string,
): StoredTargetGroup => {
  const tg = ctx.store.get<StoredTargetGroup>(targetGroupKey(arn));
  if (tg === undefined) {
    throw awsError(
      "TargetGroupNotFound",
      `Target group '${arn}' not found`,
      400,
    );
  }
  return tg;
};

const CreateLoadBalancer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const allLbs = ctx.store
    .list<StoredLoadBalancer>()
    .filter((e) => e.key.startsWith("lb/"))
    .map((e) => e.value);
  const existing = allLbs.find((l) => l.LoadBalancerName === name);
  if (existing !== undefined) {
    const inputScheme = optionalString(input, "Scheme") ?? "internet-facing";
    const inputType = optionalString(input, "Type") ?? "application";
    if (existing.Scheme === inputScheme && existing.Type === inputType) {
      return { LoadBalancers: [loadBalancerView(existing)] };
    }
    throw awsError(
      "DuplicateLoadBalancerName",
      `A load balancer with the name '${name}' already exists`,
      400,
    );
  }
  const type = optionalString(input, "Type") ?? "application";
  const typePrefix =
    type === "network" ? "net" : type === "gateway" ? "gwy" : "app";
  const arnId = randomHex(8);
  const dnsId = randomHex(8);
  const subnets = stringList(input["Subnets"]);
  const subnetMappings = objectList(input["SubnetMappings"]);
  const azs =
    subnetMappings.length > 0
      ? subnetMappings
      : subnets.map((subnetId) => ({ SubnetId: subnetId }));
  const lb: StoredLoadBalancer = {
    LoadBalancerArn: `arn:aws:elasticloadbalancing:${ctx.region}:${ctx.account}:loadbalancer/${typePrefix}/${name}/${arnId}`,
    LoadBalancerName: name,
    DNSName: `${name}-${dnsId}.${ctx.region}.elb.amazonaws.com`,
    CanonicalHostedZoneId: "Z2BUNSAI0000ID",
    CreatedTime: new Date().toISOString(),
    Scheme: optionalString(input, "Scheme") ?? "internet-facing",
    VpcId: optionalString(input, "VpcId"),
    State: { Code: "provisioning" },
    Type: type,
    AvailabilityZones: azs,
    SecurityGroups: stringList(input["SecurityGroups"]),
    IpAddressType: optionalString(input, "IpAddressType") ?? "ipv4",
  };
  ctx.store.set(loadBalancerKey(lb.LoadBalancerArn), lb);
  const tags = objectList(input["Tags"]);
  if (tags.length > 0) ctx.store.set(tagsKey(lb.LoadBalancerArn), tags);
  return { LoadBalancers: [loadBalancerView(lb)] };
};

const DescribeLoadBalancers: OperationHandler = (input, ctx) => {
  const arns = stringList(input["LoadBalancerArns"]);
  const names = stringList(input["Names"]);
  const all = ctx.store
    .list<StoredLoadBalancer>()
    .filter((entry) => entry.key.startsWith("lb/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.LoadBalancerArn.localeCompare(b.LoadBalancerArn));
  let selected = all;
  if (arns.length > 0) {
    selected = arns.map((arn) => {
      const found = all.find((lb) => lb.LoadBalancerArn === arn);
      if (found === undefined) {
        throw awsError(
          "LoadBalancerNotFound",
          `Load balancer '${arn}' not found`,
          400,
        );
      }
      return found;
    });
  } else if (names.length > 0) {
    selected = names.map((name) => {
      const found = all.find((lb) => lb.LoadBalancerName === name);
      if (found === undefined) {
        throw awsError(
          "LoadBalancerNotFound",
          `Load balancer '${name}' not found`,
          400,
        );
      }
      return found;
    });
  }
  for (const lb of selected) {
    if (lb.State.Code === "provisioning") {
      lb.State = { Code: "active" };
      ctx.store.set(loadBalancerKey(lb.LoadBalancerArn), lb);
    }
  }
  const { result, nextMarker } = applyPagination(
    selected,
    optionalString(input, "Marker"),
    input["PageSize"],
    (lb) => lb.LoadBalancerArn,
  );
  return {
    LoadBalancers: result.map(loadBalancerView),
    ...(nextMarker !== undefined ? { NextMarker: nextMarker } : {}),
  };
};

const DeleteLoadBalancer: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LoadBalancerArn");
  if (ctx.store.get<StoredLoadBalancer>(loadBalancerKey(arn)) === undefined) {
    throw awsError(
      "LoadBalancerNotFound",
      `Load balancer '${arn}' not found`,
      400,
    );
  }
  const attrs = ctx.store.get<Record<string, unknown>[]>(lbAttrsKey(arn)) ?? [];
  const protection = attrs.find(
    (a) => a["Key"] === "deletion_protection.enabled",
  );
  if (protection?.["Value"] === "true") {
    throw awsError(
      "OperationNotPermitted",
      "Deletion protection is enabled for this load balancer",
      400,
    );
  }
  const listeners = ctx.store
    .list<StoredListener>()
    .filter((e) => e.key.startsWith("listener/"))
    .map((e) => e.value)
    .filter((l) => l.LoadBalancerArn === arn);
  for (const listener of listeners) {
    const rules = ctx.store
      .list<StoredRule>()
      .filter((e) => e.key.startsWith("rule/"))
      .map((e) => e.value)
      .filter((r) => r.ListenerArn === listener.ListenerArn);
    for (const rule of rules) {
      ctx.store.delete(ruleKey(rule.RuleArn));
      ctx.store.delete(tagsKey(rule.RuleArn));
    }
    ctx.store.delete(listenerAttrsKey(listener.ListenerArn));
    ctx.store.delete(tagsKey(listener.ListenerArn));
    ctx.store.delete(listenerKey(listener.ListenerArn));
  }
  syncTgLbAssociation(ctx, arn);
  ctx.store.delete(lbAttrsKey(arn));
  ctx.store.delete(capacityKey(arn));
  ctx.store.delete(tagsKey(arn));
  ctx.store.delete(loadBalancerKey(arn));
  return {};
};

const DescribeLoadBalancerAttributes: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LoadBalancerArn");
  requireLoadBalancer(ctx, arn);
  const attrs = ctx.store.get<Record<string, unknown>[]>(lbAttrsKey(arn)) ?? [];
  return { Attributes: attrs };
};

const ModifyLoadBalancerAttributes: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LoadBalancerArn");
  requireLoadBalancer(ctx, arn);
  const newAttrs = objectList(input["Attributes"]);
  const existing =
    ctx.store.get<Record<string, unknown>[]>(lbAttrsKey(arn)) ?? [];
  const merged = [...existing];
  for (const attr of newAttrs) {
    const idx = merged.findIndex((a) => a["Key"] === attr["Key"]);
    if (idx >= 0) {
      merged[idx] = attr;
    } else {
      merged.push(attr);
    }
  }
  ctx.store.set(lbAttrsKey(arn), merged);
  return { Attributes: merged };
};

const SetIpAddressType: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LoadBalancerArn");
  const ipAddressType = requireString(input, "IpAddressType");
  const lb = requireLoadBalancer(ctx, arn);
  lb.IpAddressType = ipAddressType;
  ctx.store.set(loadBalancerKey(arn), lb);
  return { IpAddressType: ipAddressType };
};

const SetSecurityGroups: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LoadBalancerArn");
  const securityGroups = stringList(input["SecurityGroups"]);
  const lb = requireLoadBalancer(ctx, arn);
  lb.SecurityGroups = securityGroups;
  ctx.store.set(loadBalancerKey(arn), lb);
  return { SecurityGroupIds: securityGroups };
};

const SetSubnets: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LoadBalancerArn");
  const lb = requireLoadBalancer(ctx, arn);
  const subnetMappings = objectList(input["SubnetMappings"]);
  const subnets = stringList(input["Subnets"]);
  if (subnetMappings.length > 0) {
    lb.AvailabilityZones = subnetMappings;
  } else if (subnets.length > 0) {
    lb.AvailabilityZones = subnets.map((subnetId) => ({ SubnetId: subnetId }));
  }
  const ipType = optionalString(input, "IpAddressType");
  if (ipType !== undefined) {
    lb.IpAddressType = ipType;
  }
  ctx.store.set(loadBalancerKey(arn), lb);
  return {
    AvailabilityZones: lb.AvailabilityZones,
    IpAddressType: lb.IpAddressType,
  };
};

const ModifyIpPools: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LoadBalancerArn");
  requireLoadBalancer(ctx, arn);
  const ipamPools =
    typeof input["IpamPools"] === "object" && input["IpamPools"] !== null
      ? input["IpamPools"]
      : undefined;
  return { ...(ipamPools !== undefined ? { IpamPools: ipamPools } : {}) };
};

const CreateTargetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const allTgs = ctx.store
    .list<StoredTargetGroup>()
    .filter((e) => e.key.startsWith("tg/"))
    .map((e) => e.value);
  const existing = allTgs.find((t) => t.TargetGroupName === name);
  if (existing !== undefined) {
    const inputProtocol = optionalString(input, "Protocol");
    const inputPort = optionalNumber(input, "Port");
    const inputVpcId = optionalString(input, "VpcId");
    const inputTargetType = optionalString(input, "TargetType") ?? "instance";
    if (
      existing.Protocol === inputProtocol &&
      existing.Port === inputPort &&
      existing.VpcId === inputVpcId &&
      existing.TargetType === inputTargetType
    ) {
      return { TargetGroups: [targetGroupView(existing)] };
    }
    throw awsError(
      "DuplicateTargetGroupName",
      `A target group with the name '${name}' already exists`,
      400,
    );
  }
  const arnId = randomHex(8);
  const tg: StoredTargetGroup = {
    TargetGroupArn: `arn:aws:elasticloadbalancing:${ctx.region}:${ctx.account}:targetgroup/${name}/${arnId}`,
    TargetGroupName: name,
    Protocol: optionalString(input, "Protocol"),
    Port: optionalNumber(input, "Port"),
    VpcId: optionalString(input, "VpcId"),
    TargetType: optionalString(input, "TargetType") ?? "instance",
    HealthCheckEnabled:
      typeof input["HealthCheckEnabled"] === "boolean"
        ? (input["HealthCheckEnabled"] as boolean)
        : true,
    HealthCheckProtocol: optionalString(input, "HealthCheckProtocol"),
    HealthCheckPath: optionalString(input, "HealthCheckPath"),
    HealthCheckPort: optionalString(input, "HealthCheckPort"),
    HealthCheckIntervalSeconds: optionalNumber(
      input,
      "HealthCheckIntervalSeconds",
    ),
    HealthCheckTimeoutSeconds: optionalNumber(
      input,
      "HealthCheckTimeoutSeconds",
    ),
    HealthyThresholdCount: optionalNumber(input, "HealthyThresholdCount"),
    UnhealthyThresholdCount: optionalNumber(input, "UnhealthyThresholdCount"),
    LoadBalancerArns: [],
    IpAddressType: optionalString(input, "IpAddressType") ?? "ipv4",
  };
  ctx.store.set(targetGroupKey(tg.TargetGroupArn), tg);
  const tags = objectList(input["Tags"]);
  if (tags.length > 0) ctx.store.set(tagsKey(tg.TargetGroupArn), tags);
  return { TargetGroups: [targetGroupView(tg)] };
};

const DescribeTargetGroups: OperationHandler = (input, ctx) => {
  const arns = stringList(input["TargetGroupArns"]);
  const names = stringList(input["Names"]);
  const loadBalancerArn = optionalString(input, "LoadBalancerArn");
  const all = ctx.store
    .list<StoredTargetGroup>()
    .filter((entry) => entry.key.startsWith("tg/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.TargetGroupArn.localeCompare(b.TargetGroupArn));
  let selected = all;
  if (arns.length > 0) {
    selected = arns.map((arn) => {
      const found = all.find((tg) => tg.TargetGroupArn === arn);
      if (found === undefined) {
        throw awsError(
          "TargetGroupNotFound",
          `Target group '${arn}' not found`,
          400,
        );
      }
      return found;
    });
  } else if (names.length > 0) {
    selected = names.map((name) => {
      const found = all.find((tg) => tg.TargetGroupName === name);
      if (found === undefined) {
        throw awsError(
          "TargetGroupNotFound",
          `Target group '${name}' not found`,
          400,
        );
      }
      return found;
    });
  } else if (loadBalancerArn !== undefined) {
    selected = all.filter((tg) =>
      tg.LoadBalancerArns.includes(loadBalancerArn),
    );
  }
  const { result, nextMarker } = applyPagination(
    selected,
    optionalString(input, "Marker"),
    input["PageSize"],
    (tg) => tg.TargetGroupArn,
  );
  return {
    TargetGroups: result.map(targetGroupView),
    ...(nextMarker !== undefined ? { NextMarker: nextMarker } : {}),
  };
};

const DeleteTargetGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TargetGroupArn");
  if (ctx.store.get<StoredTargetGroup>(targetGroupKey(arn)) === undefined) {
    throw awsError(
      "TargetGroupNotFound",
      `Target group '${arn}' not found`,
      400,
    );
  }
  const refListeners = ctx.store
    .list<StoredListener>()
    .filter((e) => e.key.startsWith("listener/"))
    .map((e) => e.value)
    .filter((l) => extractTgArnsFromActions(l.DefaultActions).includes(arn));
  if (refListeners.length > 0) {
    throw awsError(
      "ResourceInUse",
      `Target group '${arn}' is referenced by a listener`,
      400,
    );
  }
  const refRules = ctx.store
    .list<StoredRule>()
    .filter((e) => e.key.startsWith("rule/"))
    .map((e) => e.value)
    .filter((r) => extractTgArnsFromActions(r.Actions).includes(arn));
  if (refRules.length > 0) {
    throw awsError(
      "ResourceInUse",
      `Target group '${arn}' is referenced by a rule`,
      400,
    );
  }
  ctx.store.delete(tagsKey(arn));
  ctx.store.delete(targetGroupKey(arn));
  return {};
};

const ModifyTargetGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TargetGroupArn");
  const tg = requireTargetGroup(ctx, arn);
  if (typeof input["HealthCheckEnabled"] === "boolean") {
    tg.HealthCheckEnabled = input["HealthCheckEnabled"] as boolean;
  }
  const hcProtocol = optionalString(input, "HealthCheckProtocol");
  if (hcProtocol !== undefined) tg.HealthCheckProtocol = hcProtocol;
  const hcPath = optionalString(input, "HealthCheckPath");
  if (hcPath !== undefined) tg.HealthCheckPath = hcPath;
  const hcPort = optionalString(input, "HealthCheckPort");
  if (hcPort !== undefined) tg.HealthCheckPort = hcPort;
  const hcInterval = optionalNumber(input, "HealthCheckIntervalSeconds");
  if (hcInterval !== undefined) tg.HealthCheckIntervalSeconds = hcInterval;
  const hcTimeout = optionalNumber(input, "HealthCheckTimeoutSeconds");
  if (hcTimeout !== undefined) tg.HealthCheckTimeoutSeconds = hcTimeout;
  const healthyCount = optionalNumber(input, "HealthyThresholdCount");
  if (healthyCount !== undefined) tg.HealthyThresholdCount = healthyCount;
  const unhealthyCount = optionalNumber(input, "UnhealthyThresholdCount");
  if (unhealthyCount !== undefined) tg.UnhealthyThresholdCount = unhealthyCount;
  ctx.store.set(targetGroupKey(arn), tg);
  return { TargetGroups: [targetGroupView(tg)] };
};

const DescribeTargetGroupAttributes: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TargetGroupArn");
  requireTargetGroup(ctx, arn);
  const attrs = ctx.store.get<Record<string, unknown>[]>(tgAttrsKey(arn)) ?? [];
  return { Attributes: attrs };
};

const ModifyTargetGroupAttributes: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TargetGroupArn");
  requireTargetGroup(ctx, arn);
  const newAttrs = objectList(input["Attributes"]);
  const existing =
    ctx.store.get<Record<string, unknown>[]>(tgAttrsKey(arn)) ?? [];
  const merged = [...existing];
  for (const attr of newAttrs) {
    const idx = merged.findIndex((a) => a["Key"] === attr["Key"]);
    if (idx >= 0) {
      merged[idx] = attr;
    } else {
      merged.push(attr);
    }
  }
  ctx.store.set(tgAttrsKey(arn), merged);
  return { Attributes: merged };
};

const RegisterTargets: OperationHandler = (input, ctx) => {
  const tgArn = requireString(input, "TargetGroupArn");
  requireTargetGroup(ctx, tgArn);
  const targets = objectList(input["Targets"]);
  const existing = ctx.store.get<StoredTarget[]>(targetsKey(tgArn)) ?? [];
  const merged = [...existing];
  for (const t of targets) {
    const id = t["Id"] as string;
    const port =
      typeof t["Port"] === "number" ? (t["Port"] as number) : undefined;
    const az =
      typeof t["AvailabilityZone"] === "string"
        ? (t["AvailabilityZone"] as string)
        : undefined;
    if (!merged.some((m) => m.Id === id && m.Port === port)) {
      merged.push({ Id: id, Port: port, AvailabilityZone: az });
    }
  }
  ctx.store.set(targetsKey(tgArn), merged);
  return {};
};

const DeregisterTargets: OperationHandler = (input, ctx) => {
  const tgArn = requireString(input, "TargetGroupArn");
  requireTargetGroup(ctx, tgArn);
  const targets = objectList(input["Targets"]);
  const existing = ctx.store.get<StoredTarget[]>(targetsKey(tgArn)) ?? [];
  const remaining = existing.filter(
    (m) =>
      !targets.some(
        (t) =>
          t["Id"] === m.Id && (t["Port"] === undefined || t["Port"] === m.Port),
      ),
  );
  ctx.store.set(targetsKey(tgArn), remaining);
  return {};
};

const DescribeTargetHealth: OperationHandler = (input, ctx) => {
  const tgArn = requireString(input, "TargetGroupArn");
  requireTargetGroup(ctx, tgArn);
  const filterTargets = objectList(input["Targets"]);
  const registered = ctx.store.get<StoredTarget[]>(targetsKey(tgArn)) ?? [];
  const targets =
    filterTargets.length > 0
      ? registered.filter((r) =>
          filterTargets.some(
            (f) =>
              f["Id"] === r.Id &&
              (f["Port"] === undefined || f["Port"] === r.Port),
          ),
        )
      : registered;
  const descriptions = targets.map((t) => ({
    Target: {
      Id: t.Id,
      ...(t.Port !== undefined ? { Port: t.Port } : {}),
      ...(t.AvailabilityZone !== undefined
        ? { AvailabilityZone: t.AvailabilityZone }
        : {}),
    },
    HealthCheckPort: t.Port !== undefined ? String(t.Port) : "80",
    TargetHealth: { State: "healthy" },
  }));
  return { TargetHealthDescriptions: descriptions };
};

const CreateListener: OperationHandler = (input, ctx) => {
  const loadBalancerArn = requireString(input, "LoadBalancerArn");
  const lb = ctx.store.get<StoredLoadBalancer>(
    loadBalancerKey(loadBalancerArn),
  );
  if (lb === undefined) {
    throw awsError(
      "LoadBalancerNotFound",
      `Load balancer '${loadBalancerArn}' not found`,
      400,
    );
  }
  const port = optionalNumber(input, "Port");
  const existingListeners = ctx.store
    .list<StoredListener>()
    .filter((e) => e.key.startsWith("listener/"))
    .map((e) => e.value)
    .filter((l) => l.LoadBalancerArn === loadBalancerArn);
  if (port !== undefined && existingListeners.some((l) => l.Port === port)) {
    throw awsError(
      "DuplicateListener",
      `A listener already exists on port ${port} for this load balancer`,
      400,
    );
  }
  const defaultActions = objectList(input["DefaultActions"]);
  validateTgArnsInActions(ctx, defaultActions);
  const arnId = randomHex(8);
  const listener: StoredListener = {
    ListenerArn: `arn:aws:elasticloadbalancing:${ctx.region}:${ctx.account}:listener/app/${lb.LoadBalancerName}/${arnId}/${randomHex(8)}`,
    LoadBalancerArn: loadBalancerArn,
    Port: port,
    Protocol: optionalString(input, "Protocol"),
    DefaultActions: defaultActions,
    Certificates: objectList(input["Certificates"]),
    SslPolicy: optionalString(input, "SslPolicy"),
  };
  ctx.store.set(listenerKey(listener.ListenerArn), listener);
  const tags = objectList(input["Tags"]);
  if (tags.length > 0) ctx.store.set(tagsKey(listener.ListenerArn), tags);
  const defaultRule: StoredRule = {
    RuleArn: `arn:aws:elasticloadbalancing:${ctx.region}:${ctx.account}:listener-rule/app/${lb.LoadBalancerName}/${arnId}/${randomHex(8)}`,
    ListenerArn: listener.ListenerArn,
    Priority: "default",
    Conditions: [],
    Actions: [...defaultActions],
    IsDefault: true,
  };
  ctx.store.set(ruleKey(defaultRule.RuleArn), defaultRule);
  syncTgLbAssociation(ctx, loadBalancerArn);
  return { Listeners: [listenerView(listener)] };
};

const DescribeListeners: OperationHandler = (input, ctx) => {
  const arns = stringList(input["ListenerArns"]);
  const loadBalancerArn = optionalString(input, "LoadBalancerArn");
  const all = ctx.store
    .list<StoredListener>()
    .filter((entry) => entry.key.startsWith("listener/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.ListenerArn.localeCompare(b.ListenerArn));
  let selected = all;
  if (arns.length > 0) {
    selected = arns.map((arn) => {
      const found = all.find((listener) => listener.ListenerArn === arn);
      if (found === undefined) {
        throw awsError("ListenerNotFound", `Listener '${arn}' not found`, 400);
      }
      return found;
    });
  } else if (loadBalancerArn !== undefined) {
    selected = all.filter(
      (listener) => listener.LoadBalancerArn === loadBalancerArn,
    );
  }
  const { result, nextMarker } = applyPagination(
    selected,
    optionalString(input, "Marker"),
    input["PageSize"],
    (l) => l.ListenerArn,
  );
  return {
    Listeners: result.map(listenerView),
    ...(nextMarker !== undefined ? { NextMarker: nextMarker } : {}),
  };
};

const DeleteListener: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ListenerArn");
  const listener = requireListener(ctx, arn);
  const lbArn = listener.LoadBalancerArn;
  const rules = ctx.store
    .list<StoredRule>()
    .filter((e) => e.key.startsWith("rule/"))
    .map((e) => e.value)
    .filter((r) => r.ListenerArn === arn);
  for (const rule of rules) {
    ctx.store.delete(ruleKey(rule.RuleArn));
    ctx.store.delete(tagsKey(rule.RuleArn));
  }
  ctx.store.delete(listenerAttrsKey(arn));
  ctx.store.delete(tagsKey(arn));
  ctx.store.delete(listenerKey(arn));
  syncTgLbAssociation(ctx, lbArn);
  return {};
};

const ModifyListener: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ListenerArn");
  const listener = requireListener(ctx, arn);
  const port = optionalNumber(input, "Port");
  if (port !== undefined) listener.Port = port;
  const protocol = optionalString(input, "Protocol");
  if (protocol !== undefined) listener.Protocol = protocol;
  const sslPolicy = optionalString(input, "SslPolicy");
  if (sslPolicy !== undefined) listener.SslPolicy = sslPolicy;
  if (Array.isArray(input["DefaultActions"])) {
    const newActions = objectList(input["DefaultActions"]);
    validateTgArnsInActions(ctx, newActions);
    listener.DefaultActions = newActions;
    const defaultRule = ctx.store
      .list<StoredRule>()
      .filter((e) => e.key.startsWith("rule/"))
      .map((e) => e.value)
      .find((r) => r.ListenerArn === arn && r.IsDefault);
    if (defaultRule !== undefined) {
      defaultRule.Actions = [...newActions];
      ctx.store.set(ruleKey(defaultRule.RuleArn), defaultRule);
    }
  }
  if (Array.isArray(input["Certificates"])) {
    listener.Certificates = objectList(input["Certificates"]);
  }
  ctx.store.set(listenerKey(arn), listener);
  syncTgLbAssociation(ctx, listener.LoadBalancerArn);
  return { Listeners: [listenerView(listener)] };
};

const DescribeListenerAttributes: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ListenerArn");
  requireListener(ctx, arn);
  const attrs =
    ctx.store.get<Record<string, unknown>[]>(listenerAttrsKey(arn)) ?? [];
  return { Attributes: attrs };
};

const ModifyListenerAttributes: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ListenerArn");
  requireListener(ctx, arn);
  const newAttrs = objectList(input["Attributes"]);
  const existing =
    ctx.store.get<Record<string, unknown>[]>(listenerAttrsKey(arn)) ?? [];
  const merged = [...existing];
  for (const attr of newAttrs) {
    const idx = merged.findIndex((a) => a["Key"] === attr["Key"]);
    if (idx >= 0) {
      merged[idx] = attr;
    } else {
      merged.push(attr);
    }
  }
  ctx.store.set(listenerAttrsKey(arn), merged);
  return { Attributes: merged };
};

const AddListenerCertificates: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ListenerArn");
  const listener = requireListener(ctx, arn);
  const certs = objectList(input["Certificates"]);
  for (const cert of certs) {
    const certArn = cert["CertificateArn"] as string | undefined;
    if (
      certArn !== undefined &&
      !listener.Certificates.some((c) => c["CertificateArn"] === certArn)
    ) {
      listener.Certificates.push(cert);
    }
  }
  ctx.store.set(listenerKey(arn), listener);
  return { Certificates: listener.Certificates };
};

const RemoveListenerCertificates: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ListenerArn");
  const listener = requireListener(ctx, arn);
  const certs = objectList(input["Certificates"]);
  const arnsToRemove = new Set(
    certs
      .map((c) => c["CertificateArn"])
      .filter((a): a is string => typeof a === "string"),
  );
  listener.Certificates = listener.Certificates.filter(
    (c) => !arnsToRemove.has(c["CertificateArn"] as string),
  );
  ctx.store.set(listenerKey(arn), listener);
  return {};
};

const DescribeListenerCertificates: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ListenerArn");
  const listener = requireListener(ctx, arn);
  return { Certificates: listener.Certificates };
};

const CreateRule: OperationHandler = (input, ctx) => {
  const listenerArn = requireString(input, "ListenerArn");
  const listener = requireListener(ctx, listenerArn);
  const priority = input["Priority"];
  const priorityStr =
    typeof priority === "number"
      ? String(priority)
      : typeof priority === "string"
        ? priority
        : "1";
  const existingRules = ctx.store
    .list<StoredRule>()
    .filter((entry) => entry.key.startsWith("rule/"))
    .map((entry) => entry.value)
    .filter((r) => r.ListenerArn === listenerArn && !r.IsDefault);
  if (
    priorityStr !== "default" &&
    existingRules.some((r) => r.Priority === priorityStr)
  ) {
    throw awsError(
      "PriorityInUse",
      `The priority '${priorityStr}' is already in use for this listener`,
      400,
    );
  }
  const actions = objectList(input["Actions"]);
  validateTgArnsInActions(ctx, actions);
  const arnId = randomHex(8);
  const rule: StoredRule = {
    RuleArn: `arn:aws:elasticloadbalancing:${ctx.region}:${ctx.account}:listener-rule/app/${arnId}/${randomHex(8)}/${randomHex(8)}`,
    ListenerArn: listenerArn,
    Priority: priorityStr,
    Conditions: objectList(input["Conditions"]),
    Actions: actions,
    IsDefault: false,
  };
  ctx.store.set(ruleKey(rule.RuleArn), rule);
  const tags = objectList(input["Tags"]);
  if (tags.length > 0) ctx.store.set(tagsKey(rule.RuleArn), tags);
  syncTgLbAssociation(ctx, listener.LoadBalancerArn);
  return { Rules: [ruleView(rule)] };
};

const rulePriorityOrder = (priority: string): number => {
  if (priority === "default") return Number.MAX_SAFE_INTEGER;
  const n = Number(priority);
  return isNaN(n) ? Number.MAX_SAFE_INTEGER - 1 : n;
};

const DescribeRules: OperationHandler = (input, ctx) => {
  const ruleArns = stringList(input["RuleArns"]);
  const listenerArn = optionalString(input, "ListenerArn");
  const all = ctx.store
    .list<StoredRule>()
    .filter((entry) => entry.key.startsWith("rule/"))
    .map((entry) => entry.value);
  let selected = all;
  if (ruleArns.length > 0) {
    selected = ruleArns.map((arn) => {
      const found = all.find((r) => r.RuleArn === arn);
      if (found === undefined) {
        throw awsError("RuleNotFound", `Rule '${arn}' not found`, 400);
      }
      return found;
    });
  } else if (listenerArn !== undefined) {
    selected = all.filter((r) => r.ListenerArn === listenerArn);
  }
  const sorted = [...selected].sort(
    (a, b) => rulePriorityOrder(a.Priority) - rulePriorityOrder(b.Priority),
  );
  const { result, nextMarker } = applyPagination(
    sorted,
    optionalString(input, "Marker"),
    input["PageSize"],
    (r) => r.RuleArn,
  );
  return {
    Rules: result.map(ruleView),
    ...(nextMarker !== undefined ? { NextMarker: nextMarker } : {}),
  };
};

const ModifyRule: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "RuleArn");
  const rule = requireRule(ctx, arn);
  const listener = ctx.store.get<StoredListener>(listenerKey(rule.ListenerArn));
  if (Array.isArray(input["Conditions"])) {
    rule.Conditions = objectList(input["Conditions"]);
  }
  if (Array.isArray(input["Actions"])) {
    const newActions = objectList(input["Actions"]);
    validateTgArnsInActions(ctx, newActions);
    rule.Actions = newActions;
  }
  ctx.store.set(ruleKey(arn), rule);
  if (listener !== undefined) {
    syncTgLbAssociation(ctx, listener.LoadBalancerArn);
  }
  return { Rules: [ruleView(rule)] };
};

const DeleteRule: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "RuleArn");
  const rule = requireRule(ctx, arn);
  if (rule.IsDefault) {
    throw awsError(
      "OperationNotPermitted",
      "Cannot delete the default rule of a listener",
      400,
    );
  }
  const listener = ctx.store.get<StoredListener>(listenerKey(rule.ListenerArn));
  ctx.store.delete(tagsKey(arn));
  ctx.store.delete(ruleKey(arn));
  if (listener !== undefined) {
    syncTgLbAssociation(ctx, listener.LoadBalancerArn);
  }
  return {};
};

const SetRulePriorities: OperationHandler = (input, ctx) => {
  const rulePriorities = objectList(input["RulePriorities"]);
  const priorityMap = new Map<string, string>();
  for (const rp of rulePriorities) {
    const arn = rp["RuleArn"] as string | undefined;
    if (arn === undefined) continue;
    const p = rp["Priority"];
    const priorityStr =
      typeof p === "number" ? String(p) : typeof p === "string" ? p : undefined;
    if (priorityStr === undefined) continue;
    if (priorityStr !== "default" && priorityMap.has(priorityStr)) {
      throw awsError(
        "PriorityInUse",
        `The priority '${priorityStr}' is already in use`,
        400,
      );
    }
    priorityMap.set(priorityStr, arn);
  }
  const updatedArns = new Set(
    rulePriorities
      .map((rp) => rp["RuleArn"] as string | undefined)
      .filter((a): a is string => a !== undefined),
  );
  const listenerArns = new Set<string>();
  for (const arn of updatedArns) {
    const rule = ctx.store.get<StoredRule>(ruleKey(arn));
    if (rule !== undefined) listenerArns.add(rule.ListenerArn);
  }
  for (const listenerArn of listenerArns) {
    const existingRules = ctx.store
      .list<StoredRule>()
      .filter((entry) => entry.key.startsWith("rule/"))
      .map((entry) => entry.value)
      .filter(
        (r) =>
          r.ListenerArn === listenerArn &&
          !r.IsDefault &&
          !updatedArns.has(r.RuleArn),
      );
    for (const [priority] of priorityMap) {
      if (
        priority !== "default" &&
        existingRules.some((r) => r.Priority === priority)
      ) {
        throw awsError(
          "PriorityInUse",
          `The priority '${priority}' is already in use for this listener`,
          400,
        );
      }
    }
  }
  const updated: StoredRule[] = [];
  for (const rp of rulePriorities) {
    const arn = rp["RuleArn"] as string | undefined;
    if (arn === undefined) continue;
    const rule = requireRule(ctx, arn);
    const p = rp["Priority"];
    rule.Priority =
      typeof p === "number"
        ? String(p)
        : typeof p === "string"
          ? p
          : rule.Priority;
    ctx.store.set(ruleKey(arn), rule);
    updated.push(rule);
  }
  return { Rules: updated.map(ruleView) };
};

const CreateTrustStore: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const arnId = randomHex(8);
  const ts: StoredTrustStore = {
    TrustStoreArn: `arn:aws:elasticloadbalancing:${ctx.region}:${ctx.account}:truststore/${name}/${arnId}`,
    Name: name,
    Status: "ACTIVE",
    NumberOfCaCertificates: 0,
    TotalRevokedEntries: 0,
  };
  ctx.store.set(trustStoreKey(ts.TrustStoreArn), ts);
  const tags = objectList(input["Tags"]);
  if (tags.length > 0) ctx.store.set(tagsKey(ts.TrustStoreArn), tags);
  return { TrustStores: [trustStoreView(ts)] };
};

const DescribeTrustStores: OperationHandler = (input, ctx) => {
  const arns = stringList(input["TrustStoreArns"]);
  const names = stringList(input["Names"]);
  const all = ctx.store
    .list<StoredTrustStore>()
    .filter((entry) => entry.key.startsWith("truststore/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.TrustStoreArn.localeCompare(b.TrustStoreArn));
  let selected = all;
  if (arns.length > 0) {
    selected = arns.map((arn) => {
      const found = all.find((ts) => ts.TrustStoreArn === arn);
      if (found === undefined) {
        throw awsError(
          "TrustStoreNotFound",
          `Trust store '${arn}' not found`,
          400,
        );
      }
      return found;
    });
  } else if (names.length > 0) {
    selected = names.map((name) => {
      const found = all.find((ts) => ts.Name === name);
      if (found === undefined) {
        throw awsError(
          "TrustStoreNotFound",
          `Trust store '${name}' not found`,
          400,
        );
      }
      return found;
    });
  }
  const { result, nextMarker } = applyPagination(
    selected,
    optionalString(input, "Marker"),
    input["PageSize"],
    (ts) => ts.TrustStoreArn,
  );
  return {
    TrustStores: result.map(trustStoreView),
    ...(nextMarker !== undefined ? { NextMarker: nextMarker } : {}),
  };
};

const ModifyTrustStore: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TrustStoreArn");
  const ts = requireTrustStore(ctx, arn);
  ctx.store.set(trustStoreKey(arn), ts);
  return { TrustStores: [trustStoreView(ts)] };
};

const DeleteTrustStore: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TrustStoreArn");
  requireTrustStore(ctx, arn);
  ctx.store.delete(tagsKey(arn));
  ctx.store.delete(trustStoreKey(arn));
  return {};
};

const DescribeTrustStoreAssociations: OperationHandler = (input, ctx) => {
  const tsArn = requireString(input, "TrustStoreArn");
  requireTrustStore(ctx, tsArn);
  const listeners = ctx.store
    .list<StoredListener>()
    .filter((entry) => entry.key.startsWith("listener/"))
    .map((entry) => entry.value);
  const associations = listeners
    .filter((l) => l.Certificates.some((c) => c["TrustStoreArn"] === tsArn))
    .map((l) => ({ ResourceArn: l.ListenerArn }));
  return { TrustStoreAssociations: associations };
};

const DescribeTrustStoreRevocations: OperationHandler = (input, ctx) => {
  const tsArn = requireString(input, "TrustStoreArn");
  requireTrustStore(ctx, tsArn);
  const revocIds = stringList(input["RevocationIds"]).map(Number);
  const all = ctx.store
    .list<StoredRevocation>()
    .filter((entry) => entry.key.startsWith(`revocation/${tsArn}/`))
    .map((entry) => entry.value);
  const selected =
    revocIds.length > 0
      ? all.filter((r) => revocIds.includes(r.RevocationId))
      : all;
  return {
    TrustStoreRevocations: selected.map((r) => ({
      TrustStoreArn: r.TrustStoreArn,
      RevocationId: r.RevocationId,
      RevocationType: r.RevocationType,
      NumberOfRevokedEntries: r.NumberOfRevokedEntries,
    })),
  };
};

const AddTrustStoreRevocations: OperationHandler = (input, ctx) => {
  const tsArn = requireString(input, "TrustStoreArn");
  const ts = requireTrustStore(ctx, tsArn);
  const contents = objectList(input["RevocationContents"]);
  const added: Record<string, unknown>[] = [];
  for (const content of contents) {
    const revId = Date.now() + Math.floor(Math.random() * 1000);
    const rev: StoredRevocation = {
      RevocationId: revId,
      TrustStoreArn: tsArn,
      RevocationType:
        typeof content["RevocationType"] === "string"
          ? (content["RevocationType"] as string)
          : "CRL",
      NumberOfRevokedEntries: 0,
    };
    ctx.store.set(revocationKey(tsArn, revId), rev);
    ts.TotalRevokedEntries += 1;
    added.push({
      TrustStoreArn: rev.TrustStoreArn,
      RevocationId: rev.RevocationId,
      RevocationType: rev.RevocationType,
      NumberOfRevokedEntries: rev.NumberOfRevokedEntries,
    });
  }
  ctx.store.set(trustStoreKey(tsArn), ts);
  return { TrustStoreRevocations: added };
};

const RemoveTrustStoreRevocations: OperationHandler = (input, ctx) => {
  const tsArn = requireString(input, "TrustStoreArn");
  const ts = requireTrustStore(ctx, tsArn);
  const revIds = stringList(input["RevocationIds"]).map(Number);
  for (const revId of revIds) {
    if (ctx.store.delete(revocationKey(tsArn, revId))) {
      ts.TotalRevokedEntries = Math.max(0, ts.TotalRevokedEntries - 1);
    }
  }
  ctx.store.set(trustStoreKey(tsArn), ts);
  return {};
};

const GetTrustStoreCaCertificatesBundle: OperationHandler = (input, ctx) => {
  const tsArn = requireString(input, "TrustStoreArn");
  requireTrustStore(ctx, tsArn);
  return {
    Location: `https://s3.amazonaws.com/elasticloadbalancing-certs/${ctx.account}/truststore-ca-bundle.pem`,
  };
};

const GetTrustStoreRevocationContent: OperationHandler = (input, ctx) => {
  const tsArn = requireString(input, "TrustStoreArn");
  requireTrustStore(ctx, tsArn);
  const revId = input["RevocationId"];
  const revIdNum =
    typeof revId === "number"
      ? revId
      : typeof revId === "string"
        ? Number(revId)
        : 0;
  const rev = ctx.store.get<StoredRevocation>(revocationKey(tsArn, revIdNum));
  if (rev === undefined) {
    throw awsError(
      "RevocationIdNotFound",
      `Revocation '${String(revId)}' not found`,
      400,
    );
  }
  return {
    Location: `https://s3.amazonaws.com/elasticloadbalancing-certs/${ctx.account}/revocation-${String(revIdNum)}.crl`,
  };
};

const DeleteSharedTrustStoreAssociation: OperationHandler = (input, ctx) => {
  const tsArn = requireString(input, "TrustStoreArn");
  requireTrustStore(ctx, tsArn);
  return {};
};

const AddTags: OperationHandler = (input, ctx) => {
  const resourceArns = stringList(input["ResourceArns"]);
  const tags = objectList(input["Tags"]);
  for (const arn of resourceArns) {
    const existing =
      ctx.store.get<Record<string, unknown>[]>(tagsKey(arn)) ?? [];
    const merged = [...existing];
    for (const tag of tags) {
      const idx = merged.findIndex((t) => t["Key"] === tag["Key"]);
      if (idx >= 0) {
        merged[idx] = tag;
      } else {
        merged.push(tag);
      }
    }
    ctx.store.set(tagsKey(arn), merged);
  }
  return {};
};

const RemoveTags: OperationHandler = (input, ctx) => {
  const resourceArns = stringList(input["ResourceArns"]);
  const tagKeys = new Set(stringList(input["TagKeys"]));
  for (const arn of resourceArns) {
    const existing =
      ctx.store.get<Record<string, unknown>[]>(tagsKey(arn)) ?? [];
    const remaining = existing.filter((t) => !tagKeys.has(t["Key"] as string));
    ctx.store.set(tagsKey(arn), remaining);
  }
  return {};
};

const DescribeTags: OperationHandler = (input, ctx) => {
  const resourceArns = stringList(input["ResourceArns"]);
  const descriptions = resourceArns.map((arn) => ({
    ResourceArn: arn,
    Tags: ctx.store.get<Record<string, unknown>[]>(tagsKey(arn)) ?? [],
  }));
  return { TagDescriptions: descriptions };
};

const DescribeSSLPolicies: OperationHandler = () => {
  const policies = [
    {
      Name: "ELBSecurityPolicy-2016-08",
      SslProtocols: ["TLSv1.2", "TLSv1.1", "TLSv1"],
      Ciphers: [
        { Name: "ECDHE-ECDSA-AES128-GCM-SHA256", Priority: 1 },
        { Name: "ECDHE-RSA-AES128-GCM-SHA256", Priority: 2 },
        { Name: "ECDHE-ECDSA-AES128-SHA256", Priority: 3 },
      ],
      SupportedLoadBalancerTypes: ["application"],
    },
    {
      Name: "ELBSecurityPolicy-TLS13-1-2-2021-06",
      SslProtocols: ["TLSv1.3", "TLSv1.2"],
      Ciphers: [
        { Name: "TLS_AES_128_GCM_SHA256", Priority: 1 },
        { Name: "TLS_AES_256_GCM_SHA384", Priority: 2 },
      ],
      SupportedLoadBalancerTypes: ["application", "network"],
    },
  ];
  return { SslPolicies: policies };
};

const DescribeAccountLimits: OperationHandler = () => {
  const limits = [
    { Name: "application-load-balancers", Max: "20" },
    { Name: "target-groups", Max: "3000" },
    { Name: "targets-per-application-load-balancer", Max: "1000" },
    { Name: "listeners-per-application-load-balancer", Max: "50" },
    { Name: "rules-per-application-load-balancer", Max: "100" },
    { Name: "network-load-balancers", Max: "20" },
    { Name: "targets-per-network-load-balancer", Max: "3000" },
  ];
  return { Limits: limits };
};

const DescribeCapacityReservation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LoadBalancerArn");
  requireLoadBalancer(ctx, arn);
  const cap = ctx.store.get<Record<string, unknown>>(capacityKey(arn));
  return {
    LastModifiedTime: new Date().toISOString(),
    DecreaseRequestsRemaining: 10,
    MinimumLoadBalancerCapacity: cap?.["MinimumLoadBalancerCapacity"] ?? null,
    CapacityReservationState: [],
  };
};

const ModifyCapacityReservation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LoadBalancerArn");
  requireLoadBalancer(ctx, arn);
  const minCap = input["MinimumLoadBalancerCapacity"];
  const reset = input["ResetCapacityReservation"];
  const stored = reset === true ? {} : { MinimumLoadBalancerCapacity: minCap };
  ctx.store.set(capacityKey(arn), stored);
  return {
    LastModifiedTime: new Date().toISOString(),
    DecreaseRequestsRemaining: 10,
    MinimumLoadBalancerCapacity: reset === true ? null : minCap,
    CapacityReservationState: [],
  };
};

const GetResourcePolicy: OperationHandler = () => {
  return { Policy: null };
};

const elbv2: ServiceDefinition = {
  name: "elasticloadbalancing",
  protocol: "query",
  operations: {
    CreateLoadBalancer,
    DescribeLoadBalancers,
    DeleteLoadBalancer,
    DescribeLoadBalancerAttributes,
    ModifyLoadBalancerAttributes,
    SetIpAddressType,
    SetSecurityGroups,
    SetSubnets,
    ModifyIpPools,
    CreateTargetGroup,
    DescribeTargetGroups,
    DeleteTargetGroup,
    ModifyTargetGroup,
    DescribeTargetGroupAttributes,
    ModifyTargetGroupAttributes,
    RegisterTargets,
    DeregisterTargets,
    DescribeTargetHealth,
    CreateListener,
    DescribeListeners,
    DeleteListener,
    ModifyListener,
    DescribeListenerAttributes,
    ModifyListenerAttributes,
    AddListenerCertificates,
    RemoveListenerCertificates,
    DescribeListenerCertificates,
    CreateRule,
    DescribeRules,
    ModifyRule,
    DeleteRule,
    SetRulePriorities,
    CreateTrustStore,
    DescribeTrustStores,
    ModifyTrustStore,
    DeleteTrustStore,
    DescribeTrustStoreAssociations,
    DescribeTrustStoreRevocations,
    AddTrustStoreRevocations,
    RemoveTrustStoreRevocations,
    GetTrustStoreCaCertificatesBundle,
    GetTrustStoreRevocationContent,
    DeleteSharedTrustStoreAssociation,
    AddTags,
    RemoveTags,
    DescribeTags,
    DescribeSSLPolicies,
    DescribeAccountLimits,
    DescribeCapacityReservation,
    ModifyCapacityReservation,
    GetResourcePolicy,
  },
  model,
} as const;

export default elbv2;
