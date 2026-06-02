import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import elbv2Model from "../../../../test/vendor/aws-models/elbv2.json" with { type: "json" };
import type { OperationHandler, ServiceDefinition } from "../core/types.ts";

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
  LoadBalancerArns: string[];
  IpAddressType: string;
};

type StoredListener = {
  ListenerArn: string;
  LoadBalancerArn: string;
  Port: number | undefined;
  Protocol: string | undefined;
  DefaultActions: Record<string, unknown>[];
};

const loadBalancerKey = (id: string): string => `lb/${id}`;

const targetGroupKey = (id: string): string => `tg/${id}`;

const listenerKey = (id: string): string => `listener/${id}`;

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
  LoadBalancerArns: tg.LoadBalancerArns,
  IpAddressType: tg.IpAddressType,
});

const listenerView = (listener: StoredListener): Record<string, unknown> => ({
  ListenerArn: listener.ListenerArn,
  LoadBalancerArn: listener.LoadBalancerArn,
  ...(listener.Port === undefined ? {} : { Port: listener.Port }),
  ...(listener.Protocol === undefined ? {} : { Protocol: listener.Protocol }),
  DefaultActions: listener.DefaultActions,
});

const CreateLoadBalancer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const arnId = randomHex(8);
  const dnsId = randomHex(8);
  const lb: StoredLoadBalancer = {
    LoadBalancerArn: `arn:aws:elasticloadbalancing:${ctx.region}:${ctx.account}:loadbalancer/app/${name}/${arnId}`,
    LoadBalancerName: name,
    DNSName: `${name}-${dnsId}.${ctx.region}.elb.amazonaws.com`,
    CanonicalHostedZoneId: "Z2BUNSAI0000ID",
    CreatedTime: new Date().toISOString(),
    Scheme: optionalString(input, "Scheme") ?? "internet-facing",
    VpcId: optionalString(input, "VpcId"),
    State: { Code: "active" },
    Type: optionalString(input, "Type") ?? "application",
    AvailabilityZones: objectList(input["SubnetMappings"]),
    SecurityGroups: stringList(input["SecurityGroups"]),
    IpAddressType: optionalString(input, "IpAddressType") ?? "ipv4",
  };
  ctx.store.set(loadBalancerKey(lb.LoadBalancerArn), lb);
  return { LoadBalancers: [loadBalancerView(lb)] };
};

const DescribeLoadBalancers: OperationHandler = (input, ctx) => {
  const arns = stringList(input["LoadBalancerArns"]);
  const names = stringList(input["Names"]);
  const all = ctx.store
    .list<StoredLoadBalancer>()
    .filter((entry) => entry.key.startsWith("lb/"))
    .map((entry) => entry.value);
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
  return { LoadBalancers: selected.map(loadBalancerView) };
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
  ctx.store.delete(loadBalancerKey(arn));
  return {};
};

const CreateTargetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
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
    LoadBalancerArns: [],
    IpAddressType: optionalString(input, "IpAddressType") ?? "ipv4",
  };
  ctx.store.set(targetGroupKey(tg.TargetGroupArn), tg);
  return { TargetGroups: [targetGroupView(tg)] };
};

const DescribeTargetGroups: OperationHandler = (input, ctx) => {
  const arns = stringList(input["TargetGroupArns"]);
  const names = stringList(input["Names"]);
  const loadBalancerArn = optionalString(input, "LoadBalancerArn");
  const all = ctx.store
    .list<StoredTargetGroup>()
    .filter((entry) => entry.key.startsWith("tg/"))
    .map((entry) => entry.value);
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
  return { TargetGroups: selected.map(targetGroupView) };
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
  ctx.store.delete(targetGroupKey(arn));
  return {};
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
  const arnId = randomHex(8);
  const listener: StoredListener = {
    ListenerArn: `arn:aws:elasticloadbalancing:${ctx.region}:${ctx.account}:listener/app/${lb.LoadBalancerName}/${arnId}/${randomHex(8)}`,
    LoadBalancerArn: loadBalancerArn,
    Port: optionalNumber(input, "Port"),
    Protocol: optionalString(input, "Protocol"),
    DefaultActions: objectList(input["DefaultActions"]),
  };
  ctx.store.set(listenerKey(listener.ListenerArn), listener);
  return { Listeners: [listenerView(listener)] };
};

const DescribeListeners: OperationHandler = (input, ctx) => {
  const arns = stringList(input["ListenerArns"]);
  const loadBalancerArn = optionalString(input, "LoadBalancerArn");
  const all = ctx.store
    .list<StoredListener>()
    .filter((entry) => entry.key.startsWith("listener/"))
    .map((entry) => entry.value);
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
  return { Listeners: selected.map(listenerView) };
};

const elbv2: ServiceDefinition = {
  name: "elasticloadbalancing",
  protocol: "query",
  operations: {
    CreateLoadBalancer,
    DescribeLoadBalancers,
    DeleteLoadBalancer,
    CreateTargetGroup,
    DescribeTargetGroups,
    DeleteTargetGroup,
    CreateListener,
    DescribeListeners,
  },
  model,
} as const;

export default elbv2;
