import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import globalacceleratorModel from "../../../../test/vendor/aws-models/globalaccelerator.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(globalacceleratorModel);

type StoredAccelerator = {
  AcceleratorArn: string;
  Name: string;
  IpAddressType: string;
  Enabled: boolean;
  IpSets: {
    IpFamily: string;
    IpAddresses: string[];
    IpAddressFamily: string;
  }[];
  DnsName: string;
  Status: string;
  CreatedTime: number;
  LastModifiedTime: number;
};

type StoredListener = {
  ListenerArn: string;
  AcceleratorArn: string;
  PortRanges: { FromPort: number; ToPort: number }[];
  Protocol: string;
  ClientAffinity: string;
};

type StoredEndpointGroup = {
  EndpointGroupArn: string;
  ListenerArn: string;
  EndpointGroupRegion: string;
  EndpointDescriptions: {
    EndpointId: string;
    Weight: number;
    HealthState: string;
    HealthReason: string;
    ClientIPPreservationEnabled: boolean;
  }[];
  TrafficDialPercentage: number;
  HealthCheckPort: number | undefined;
  HealthCheckProtocol: string;
  HealthCheckPath: string;
  HealthCheckIntervalSeconds: number;
  ThresholdCount: number;
  PortOverrides: { ListenerPort: number; EndpointPort: number }[];
};

type StoredAcceleratorAttributes = {
  FlowLogsEnabled: boolean;
  FlowLogsS3Bucket: string;
  FlowLogsS3Prefix: string;
};

type StoredCustomRoutingAccelerator = {
  AcceleratorArn: string;
  Name: string;
  IpAddressType: string;
  Enabled: boolean;
  IpSets: {
    IpFamily: string;
    IpAddresses: string[];
    IpAddressFamily: string;
  }[];
  DnsName: string;
  Status: string;
  CreatedTime: number;
  LastModifiedTime: number;
};

type StoredCustomRoutingListener = {
  ListenerArn: string;
  AcceleratorArn: string;
  PortRanges: { FromPort: number; ToPort: number }[];
};

type StoredCustomRoutingEndpointGroup = {
  EndpointGroupArn: string;
  ListenerArn: string;
  EndpointGroupRegion: string;
  DestinationDescriptions: {
    FromPort: number;
    ToPort: number;
    Protocols: string[];
  }[];
  EndpointDescriptions: { EndpointId: string }[];
};

type StoredAttachment = {
  AttachmentArn: string;
  Name: string;
  Principals: string[];
  Resources: { EndpointId: string; Region: string }[];
  CreatedTime: number;
  LastModifiedTime: number;
};

type StoredByoipCidr = {
  Cidr: string;
  State: string;
  Events: { Message: string; Timestamp: number }[];
};

const acceleratorKey = (arn: string): string => `accelerator/${arn}`;
const listenerKey = (arn: string): string => `listener/${arn}`;
const endpointGroupKey = (arn: string): string => `endpointgroup/${arn}`;
const acceleratorAttributesKey = (arn: string): string =>
  `acceleratorattributes/${arn}`;
const customAcceleratorKey = (arn: string): string =>
  `customaccelerator/${arn}`;
const customAcceleratorAttributesKey = (arn: string): string =>
  `customacceleratorattributes/${arn}`;
const customListenerKey = (arn: string): string => `customlistener/${arn}`;
const customEndpointGroupKey = (arn: string): string =>
  `customendpointgroup/${arn}`;
const attachmentKey = (arn: string): string => `attachment/${arn}`;
const byoipCidrKey = (cidr: string): string => `byoipcidr/${cidr}`;
const tagsKey = (arn: string): string => `tags/${arn}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidArgumentException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const requireAccelerator = (
  ctx: ServiceContext,
  arn: string,
): StoredAccelerator => {
  const accelerator = ctx.store.get<StoredAccelerator>(acceleratorKey(arn));
  if (accelerator === undefined) {
    throw awsError(
      "AcceleratorNotFoundException",
      `Accelerator not found: ${arn}`,
      400,
    );
  }
  return accelerator;
};

const requireListener = (ctx: ServiceContext, arn: string): StoredListener => {
  const listener = ctx.store.get<StoredListener>(listenerKey(arn));
  if (listener === undefined) {
    throw awsError(
      "ListenerNotFoundException",
      `Listener not found: ${arn}`,
      400,
    );
  }
  return listener;
};

const requireEndpointGroup = (
  ctx: ServiceContext,
  arn: string,
): StoredEndpointGroup => {
  const eg = ctx.store.get<StoredEndpointGroup>(endpointGroupKey(arn));
  if (eg === undefined) {
    throw awsError(
      "EndpointGroupNotFoundException",
      `EndpointGroup not found: ${arn}`,
      400,
    );
  }
  return eg;
};

const requireCustomAccelerator = (
  ctx: ServiceContext,
  arn: string,
): StoredCustomRoutingAccelerator => {
  const acc = ctx.store.get<StoredCustomRoutingAccelerator>(
    customAcceleratorKey(arn),
  );
  if (acc === undefined) {
    throw awsError(
      "AcceleratorNotFoundException",
      `Custom routing accelerator not found: ${arn}`,
      400,
    );
  }
  return acc;
};

const requireCustomListener = (
  ctx: ServiceContext,
  arn: string,
): StoredCustomRoutingListener => {
  const listener = ctx.store.get<StoredCustomRoutingListener>(
    customListenerKey(arn),
  );
  if (listener === undefined) {
    throw awsError(
      "ListenerNotFoundException",
      `Custom routing listener not found: ${arn}`,
      400,
    );
  }
  return listener;
};

const requireCustomEndpointGroup = (
  ctx: ServiceContext,
  arn: string,
): StoredCustomRoutingEndpointGroup => {
  const eg = ctx.store.get<StoredCustomRoutingEndpointGroup>(
    customEndpointGroupKey(arn),
  );
  if (eg === undefined) {
    throw awsError(
      "EndpointGroupNotFoundException",
      `Custom routing endpoint group not found: ${arn}`,
      400,
    );
  }
  return eg;
};

const requireAttachment = (
  ctx: ServiceContext,
  arn: string,
): StoredAttachment => {
  const att = ctx.store.get<StoredAttachment>(attachmentKey(arn));
  if (att === undefined) {
    throw awsError(
      "AttachmentNotFoundException",
      `Cross-account attachment not found: ${arn}`,
      400,
    );
  }
  return att;
};

const toPortRanges = (raw: unknown): { FromPort: number; ToPort: number }[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    FromPort: typeof r.FromPort === "number" ? r.FromPort : 0,
    ToPort: typeof r.ToPort === "number" ? r.ToPort : 0,
  }));
};

const CreateAccelerator: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  requireString(input, "IdempotencyToken");
  const acceleratorId = crypto.randomUUID();
  const arn = `arn:aws:globalaccelerator::${ctx.account}:accelerator/${acceleratorId}`;
  const now = Date.now() / 1000;
  const accelerator: StoredAccelerator = {
    AcceleratorArn: arn,
    Name: name,
    IpAddressType: stringOrUndefined(input["IpAddressType"]) ?? "IPV4",
    Enabled: typeof input["Enabled"] === "boolean" ? input["Enabled"] : true,
    IpSets: [
      {
        IpFamily: "IPv4",
        IpAddresses: ["198.51.100.1", "198.51.100.2"],
        IpAddressFamily: "IPv4",
      },
    ],
    DnsName: `${acceleratorId}.awsglobalaccelerator.com`,
    Status: "DEPLOYED",
    CreatedTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(acceleratorKey(arn), accelerator);
  ctx.store.set(acceleratorAttributesKey(arn), {
    FlowLogsEnabled: false,
    FlowLogsS3Bucket: "",
    FlowLogsS3Prefix: "",
  } as StoredAcceleratorAttributes);
  return { Accelerator: accelerator };
};

const DescribeAccelerator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AcceleratorArn");
  return { Accelerator: requireAccelerator(ctx, arn) };
};

const ListAccelerators: OperationHandler = (_input, ctx) => {
  const accelerators = ctx.store
    .list<StoredAccelerator>()
    .filter((entry) => entry.key.startsWith("accelerator/"))
    .map((entry) => entry.value);
  return { Accelerators: accelerators };
};

const UpdateAccelerator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AcceleratorArn");
  const accelerator = requireAccelerator(ctx, arn);
  const updated: StoredAccelerator = {
    ...accelerator,
    Name: stringOrUndefined(input["Name"]) ?? accelerator.Name,
    IpAddressType:
      stringOrUndefined(input["IpAddressType"]) ?? accelerator.IpAddressType,
    Enabled:
      typeof input["Enabled"] === "boolean"
        ? input["Enabled"]
        : accelerator.Enabled,
    Status: "DEPLOYED",
    LastModifiedTime: Date.now() / 1000,
  };
  ctx.store.set(acceleratorKey(arn), updated);
  return { Accelerator: updated };
};

const DeleteAccelerator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AcceleratorArn");
  requireAccelerator(ctx, arn);
  ctx.store.delete(acceleratorKey(arn));
  ctx.store.delete(acceleratorAttributesKey(arn));
  return {};
};

const DescribeAcceleratorAttributes: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AcceleratorArn");
  requireAccelerator(ctx, arn);
  const attrs = ctx.store.get<StoredAcceleratorAttributes>(
    acceleratorAttributesKey(arn),
  ) ?? { FlowLogsEnabled: false, FlowLogsS3Bucket: "", FlowLogsS3Prefix: "" };
  return { AcceleratorAttributes: attrs };
};

const UpdateAcceleratorAttributes: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AcceleratorArn");
  requireAccelerator(ctx, arn);
  const existing = ctx.store.get<StoredAcceleratorAttributes>(
    acceleratorAttributesKey(arn),
  ) ?? { FlowLogsEnabled: false, FlowLogsS3Bucket: "", FlowLogsS3Prefix: "" };
  const updated: StoredAcceleratorAttributes = {
    FlowLogsEnabled:
      typeof input["FlowLogsEnabled"] === "boolean"
        ? input["FlowLogsEnabled"]
        : existing.FlowLogsEnabled,
    FlowLogsS3Bucket:
      stringOrUndefined(input["FlowLogsS3Bucket"]) ?? existing.FlowLogsS3Bucket,
    FlowLogsS3Prefix:
      stringOrUndefined(input["FlowLogsS3Prefix"]) ?? existing.FlowLogsS3Prefix,
  };
  ctx.store.set(acceleratorAttributesKey(arn), updated);
  return { AcceleratorAttributes: updated };
};

const CreateListener: OperationHandler = (input, ctx) => {
  const acceleratorArn = requireString(input, "AcceleratorArn");
  requireAccelerator(ctx, acceleratorArn);
  requireString(input, "IdempotencyToken");
  const listenerId = crypto.randomUUID();
  const arn = `arn:aws:globalaccelerator::${ctx.account}:accelerator/${acceleratorArn.split("/").pop()}/listener/${listenerId}`;
  const listener: StoredListener = {
    ListenerArn: arn,
    AcceleratorArn: acceleratorArn,
    PortRanges: toPortRanges(input["PortRanges"]),
    Protocol: stringOrUndefined(input["Protocol"]) ?? "TCP",
    ClientAffinity: stringOrUndefined(input["ClientAffinity"]) ?? "NONE",
  };
  ctx.store.set(listenerKey(arn), listener);
  return { Listener: listener };
};

const DescribeListener: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ListenerArn");
  return { Listener: requireListener(ctx, arn) };
};

const ListListeners: OperationHandler = (input, ctx) => {
  const acceleratorArn = requireString(input, "AcceleratorArn");
  const listeners = ctx.store
    .list<StoredListener>()
    .filter(
      (entry) =>
        entry.key.startsWith("listener/") &&
        entry.value.AcceleratorArn === acceleratorArn,
    )
    .map((entry) => entry.value);
  return { Listeners: listeners };
};

const UpdateListener: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ListenerArn");
  const listener = requireListener(ctx, arn);
  const updated: StoredListener = {
    ...listener,
    PortRanges: Array.isArray(input["PortRanges"])
      ? toPortRanges(input["PortRanges"])
      : listener.PortRanges,
    Protocol: stringOrUndefined(input["Protocol"]) ?? listener.Protocol,
    ClientAffinity:
      stringOrUndefined(input["ClientAffinity"]) ?? listener.ClientAffinity,
  };
  ctx.store.set(listenerKey(arn), updated);
  return { Listener: updated };
};

const DeleteListener: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ListenerArn");
  requireListener(ctx, arn);
  ctx.store.delete(listenerKey(arn));
  return {};
};

const CreateEndpointGroup: OperationHandler = (input, ctx) => {
  const listenerArn = requireString(input, "ListenerArn");
  requireListener(ctx, listenerArn);
  requireString(input, "IdempotencyToken");
  const region = requireString(input, "EndpointGroupRegion");
  const egId = crypto.randomUUID();
  const listenerPart = listenerArn.split("/listener/")[1] ?? egId;
  const accPart = listenerArn.split("accelerator/")[1]?.split("/")[0] ?? egId;
  const arn = `arn:aws:globalaccelerator::${ctx.account}:accelerator/${accPart}/listener/${listenerPart}/endpoint-group/${egId}`;
  const eg: StoredEndpointGroup = {
    EndpointGroupArn: arn,
    ListenerArn: listenerArn,
    EndpointGroupRegion: region,
    EndpointDescriptions: [],
    TrafficDialPercentage:
      typeof input["TrafficDialPercentage"] === "number"
        ? input["TrafficDialPercentage"]
        : 100,
    HealthCheckPort:
      typeof input["HealthCheckPort"] === "number"
        ? input["HealthCheckPort"]
        : undefined,
    HealthCheckProtocol:
      stringOrUndefined(input["HealthCheckProtocol"]) ?? "TCP",
    HealthCheckPath: stringOrUndefined(input["HealthCheckPath"]) ?? "/",
    HealthCheckIntervalSeconds:
      typeof input["HealthCheckIntervalSeconds"] === "number"
        ? input["HealthCheckIntervalSeconds"]
        : 30,
    ThresholdCount:
      typeof input["ThresholdCount"] === "number" ? input["ThresholdCount"] : 3,
    PortOverrides: Array.isArray(input["PortOverrides"])
      ? (input["PortOverrides"] as {
          ListenerPort: number;
          EndpointPort: number;
        }[])
      : [],
  };
  ctx.store.set(endpointGroupKey(arn), eg);
  return { EndpointGroup: eg };
};

const DescribeEndpointGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointGroupArn");
  return { EndpointGroup: requireEndpointGroup(ctx, arn) };
};

const ListEndpointGroups: OperationHandler = (input, ctx) => {
  const listenerArn = requireString(input, "ListenerArn");
  const groups = ctx.store
    .list<StoredEndpointGroup>()
    .filter(
      (entry) =>
        entry.key.startsWith("endpointgroup/") &&
        entry.value.ListenerArn === listenerArn,
    )
    .map((entry) => entry.value);
  return { EndpointGroups: groups };
};

const UpdateEndpointGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointGroupArn");
  const eg = requireEndpointGroup(ctx, arn);
  const updated: StoredEndpointGroup = {
    ...eg,
    TrafficDialPercentage:
      typeof input["TrafficDialPercentage"] === "number"
        ? input["TrafficDialPercentage"]
        : eg.TrafficDialPercentage,
    HealthCheckPort:
      typeof input["HealthCheckPort"] === "number"
        ? input["HealthCheckPort"]
        : eg.HealthCheckPort,
    HealthCheckProtocol:
      stringOrUndefined(input["HealthCheckProtocol"]) ?? eg.HealthCheckProtocol,
    HealthCheckPath:
      stringOrUndefined(input["HealthCheckPath"]) ?? eg.HealthCheckPath,
    HealthCheckIntervalSeconds:
      typeof input["HealthCheckIntervalSeconds"] === "number"
        ? input["HealthCheckIntervalSeconds"]
        : eg.HealthCheckIntervalSeconds,
    ThresholdCount:
      typeof input["ThresholdCount"] === "number"
        ? input["ThresholdCount"]
        : eg.ThresholdCount,
    PortOverrides: Array.isArray(input["PortOverrides"])
      ? (input["PortOverrides"] as {
          ListenerPort: number;
          EndpointPort: number;
        }[])
      : eg.PortOverrides,
  };
  ctx.store.set(endpointGroupKey(arn), updated);
  return { EndpointGroup: updated };
};

const DeleteEndpointGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointGroupArn");
  requireEndpointGroup(ctx, arn);
  ctx.store.delete(endpointGroupKey(arn));
  return {};
};

const AddEndpoints: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointGroupArn");
  const eg = requireEndpointGroup(ctx, arn);
  const newEndpoints = Array.isArray(input["EndpointConfigurations"])
    ? (input["EndpointConfigurations"] as Record<string, unknown>[]).map(
        (ec) => ({
          EndpointId: String(ec["EndpointId"] ?? ""),
          Weight: typeof ec["Weight"] === "number" ? ec["Weight"] : 100,
          HealthState: "HEALTHY",
          HealthReason: "",
          ClientIPPreservationEnabled:
            typeof ec["ClientIPPreservationEnabled"] === "boolean"
              ? ec["ClientIPPreservationEnabled"]
              : false,
        }),
      )
    : [];
  const updated: StoredEndpointGroup = {
    ...eg,
    EndpointDescriptions: [...eg.EndpointDescriptions, ...newEndpoints],
  };
  ctx.store.set(endpointGroupKey(arn), updated);
  return {
    EndpointDescriptions: updated.EndpointDescriptions,
    EndpointGroupArn: arn,
  };
};

const RemoveEndpoints: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointGroupArn");
  const eg = requireEndpointGroup(ctx, arn);
  const toRemove = new Set(
    Array.isArray(input["EndpointIdentifiers"])
      ? (input["EndpointIdentifiers"] as Record<string, unknown>[]).map((e) =>
          String(e["EndpointId"] ?? ""),
        )
      : [],
  );
  const updated: StoredEndpointGroup = {
    ...eg,
    EndpointDescriptions: eg.EndpointDescriptions.filter(
      (e) => !toRemove.has(e.EndpointId),
    ),
  };
  ctx.store.set(endpointGroupKey(arn), updated);
  return {};
};

const CreateCustomRoutingAccelerator: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  requireString(input, "IdempotencyToken");
  const id = crypto.randomUUID();
  const arn = `arn:aws:globalaccelerator::${ctx.account}:accelerator/${id}`;
  const now = Date.now() / 1000;
  const acc: StoredCustomRoutingAccelerator = {
    AcceleratorArn: arn,
    Name: name,
    IpAddressType: stringOrUndefined(input["IpAddressType"]) ?? "IPV4",
    Enabled: typeof input["Enabled"] === "boolean" ? input["Enabled"] : true,
    IpSets: [
      {
        IpFamily: "IPv4",
        IpAddresses: ["198.51.100.3", "198.51.100.4"],
        IpAddressFamily: "IPv4",
      },
    ],
    DnsName: `${id}.awsglobalaccelerator.com`,
    Status: "DEPLOYED",
    CreatedTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(customAcceleratorKey(arn), acc);
  ctx.store.set(customAcceleratorAttributesKey(arn), {
    FlowLogsEnabled: false,
    FlowLogsS3Bucket: "",
    FlowLogsS3Prefix: "",
  } as StoredAcceleratorAttributes);
  return { Accelerator: acc };
};

const DescribeCustomRoutingAccelerator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AcceleratorArn");
  return { Accelerator: requireCustomAccelerator(ctx, arn) };
};

const ListCustomRoutingAccelerators: OperationHandler = (_input, ctx) => {
  const accelerators = ctx.store
    .list<StoredCustomRoutingAccelerator>()
    .filter((entry) => entry.key.startsWith("customaccelerator/"))
    .map((entry) => entry.value);
  return { Accelerators: accelerators };
};

const UpdateCustomRoutingAccelerator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AcceleratorArn");
  const acc = requireCustomAccelerator(ctx, arn);
  const updated: StoredCustomRoutingAccelerator = {
    ...acc,
    Name: stringOrUndefined(input["Name"]) ?? acc.Name,
    IpAddressType:
      stringOrUndefined(input["IpAddressType"]) ?? acc.IpAddressType,
    Enabled:
      typeof input["Enabled"] === "boolean" ? input["Enabled"] : acc.Enabled,
    Status: "DEPLOYED",
    LastModifiedTime: Date.now() / 1000,
  };
  ctx.store.set(customAcceleratorKey(arn), updated);
  return { Accelerator: updated };
};

const DeleteCustomRoutingAccelerator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AcceleratorArn");
  requireCustomAccelerator(ctx, arn);
  ctx.store.delete(customAcceleratorKey(arn));
  ctx.store.delete(customAcceleratorAttributesKey(arn));
  return {};
};

const DescribeCustomRoutingAcceleratorAttributes: OperationHandler = (
  input,
  ctx,
) => {
  const arn = requireString(input, "AcceleratorArn");
  requireCustomAccelerator(ctx, arn);
  const attrs = ctx.store.get<StoredAcceleratorAttributes>(
    customAcceleratorAttributesKey(arn),
  ) ?? { FlowLogsEnabled: false, FlowLogsS3Bucket: "", FlowLogsS3Prefix: "" };
  return { AcceleratorAttributes: attrs };
};

const UpdateCustomRoutingAcceleratorAttributes: OperationHandler = (
  input,
  ctx,
) => {
  const arn = requireString(input, "AcceleratorArn");
  requireCustomAccelerator(ctx, arn);
  const existing = ctx.store.get<StoredAcceleratorAttributes>(
    customAcceleratorAttributesKey(arn),
  ) ?? { FlowLogsEnabled: false, FlowLogsS3Bucket: "", FlowLogsS3Prefix: "" };
  const updated: StoredAcceleratorAttributes = {
    FlowLogsEnabled:
      typeof input["FlowLogsEnabled"] === "boolean"
        ? input["FlowLogsEnabled"]
        : existing.FlowLogsEnabled,
    FlowLogsS3Bucket:
      stringOrUndefined(input["FlowLogsS3Bucket"]) ?? existing.FlowLogsS3Bucket,
    FlowLogsS3Prefix:
      stringOrUndefined(input["FlowLogsS3Prefix"]) ?? existing.FlowLogsS3Prefix,
  };
  ctx.store.set(customAcceleratorAttributesKey(arn), updated);
  return { AcceleratorAttributes: updated };
};

const CreateCustomRoutingListener: OperationHandler = (input, ctx) => {
  const acceleratorArn = requireString(input, "AcceleratorArn");
  requireCustomAccelerator(ctx, acceleratorArn);
  requireString(input, "IdempotencyToken");
  const listenerId = crypto.randomUUID();
  const accPart = acceleratorArn.split("accelerator/")[1] ?? listenerId;
  const arn = `arn:aws:globalaccelerator::${ctx.account}:accelerator/${accPart}/listener/${listenerId}`;
  const listener: StoredCustomRoutingListener = {
    ListenerArn: arn,
    AcceleratorArn: acceleratorArn,
    PortRanges: toPortRanges(input["PortRanges"]),
  };
  ctx.store.set(customListenerKey(arn), listener);
  return { Listener: listener };
};

const DescribeCustomRoutingListener: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ListenerArn");
  return { Listener: requireCustomListener(ctx, arn) };
};

const ListCustomRoutingListeners: OperationHandler = (input, ctx) => {
  const acceleratorArn = requireString(input, "AcceleratorArn");
  const listeners = ctx.store
    .list<StoredCustomRoutingListener>()
    .filter(
      (entry) =>
        entry.key.startsWith("customlistener/") &&
        entry.value.AcceleratorArn === acceleratorArn,
    )
    .map((entry) => entry.value);
  return { Listeners: listeners };
};

const UpdateCustomRoutingListener: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ListenerArn");
  const listener = requireCustomListener(ctx, arn);
  const updated: StoredCustomRoutingListener = {
    ...listener,
    PortRanges: Array.isArray(input["PortRanges"])
      ? toPortRanges(input["PortRanges"])
      : listener.PortRanges,
  };
  ctx.store.set(customListenerKey(arn), updated);
  return { Listener: updated };
};

const DeleteCustomRoutingListener: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ListenerArn");
  requireCustomListener(ctx, arn);
  ctx.store.delete(customListenerKey(arn));
  return {};
};

const CreateCustomRoutingEndpointGroup: OperationHandler = (input, ctx) => {
  const listenerArn = requireString(input, "ListenerArn");
  requireCustomListener(ctx, listenerArn);
  requireString(input, "IdempotencyToken");
  const region = requireString(input, "EndpointGroupRegion");
  const egId = crypto.randomUUID();
  const listenerPart = listenerArn.split("/listener/")[1] ?? egId;
  const accPart = listenerArn.split("accelerator/")[1]?.split("/")[0] ?? egId;
  const arn = `arn:aws:globalaccelerator::${ctx.account}:accelerator/${accPart}/listener/${listenerPart}/endpoint-group/${egId}`;
  const destConfigs = Array.isArray(input["DestinationConfigurations"])
    ? (input["DestinationConfigurations"] as Record<string, unknown>[]).map(
        (dc) => ({
          FromPort: typeof dc["FromPort"] === "number" ? dc["FromPort"] : 0,
          ToPort: typeof dc["ToPort"] === "number" ? dc["ToPort"] : 0,
          Protocols: Array.isArray(dc["Protocols"])
            ? (dc["Protocols"] as string[])
            : ["TCP"],
        }),
      )
    : [];
  const eg: StoredCustomRoutingEndpointGroup = {
    EndpointGroupArn: arn,
    ListenerArn: listenerArn,
    EndpointGroupRegion: region,
    DestinationDescriptions: destConfigs,
    EndpointDescriptions: [],
  };
  ctx.store.set(customEndpointGroupKey(arn), eg);
  return { EndpointGroup: eg };
};

const DescribeCustomRoutingEndpointGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointGroupArn");
  return { EndpointGroup: requireCustomEndpointGroup(ctx, arn) };
};

const ListCustomRoutingEndpointGroups: OperationHandler = (input, ctx) => {
  const listenerArn = requireString(input, "ListenerArn");
  const groups = ctx.store
    .list<StoredCustomRoutingEndpointGroup>()
    .filter(
      (entry) =>
        entry.key.startsWith("customendpointgroup/") &&
        entry.value.ListenerArn === listenerArn,
    )
    .map((entry) => entry.value);
  return { EndpointGroups: groups };
};

const DeleteCustomRoutingEndpointGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointGroupArn");
  requireCustomEndpointGroup(ctx, arn);
  ctx.store.delete(customEndpointGroupKey(arn));
  return {};
};

const AddCustomRoutingEndpoints: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointGroupArn");
  const eg = requireCustomEndpointGroup(ctx, arn);
  const newEndpoints = Array.isArray(input["EndpointConfigurations"])
    ? (input["EndpointConfigurations"] as Record<string, unknown>[]).map(
        (ec) => ({ EndpointId: String(ec["EndpointId"] ?? "") }),
      )
    : [];
  const updated: StoredCustomRoutingEndpointGroup = {
    ...eg,
    EndpointDescriptions: [...eg.EndpointDescriptions, ...newEndpoints],
  };
  ctx.store.set(customEndpointGroupKey(arn), updated);
  return {
    EndpointDescriptions: updated.EndpointDescriptions,
    EndpointGroupArn: arn,
  };
};

const RemoveCustomRoutingEndpoints: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointGroupArn");
  const eg = requireCustomEndpointGroup(ctx, arn);
  const toRemove = new Set(
    Array.isArray(input["EndpointIds"])
      ? (input["EndpointIds"] as string[])
      : [],
  );
  const updated: StoredCustomRoutingEndpointGroup = {
    ...eg,
    EndpointDescriptions: eg.EndpointDescriptions.filter(
      (e) => !toRemove.has(e.EndpointId),
    ),
  };
  ctx.store.set(customEndpointGroupKey(arn), updated);
  return {};
};

const AllowCustomRoutingTraffic: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointGroupArn");
  requireCustomEndpointGroup(ctx, arn);
  requireString(input, "EndpointId");
  return {};
};

const DenyCustomRoutingTraffic: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointGroupArn");
  requireCustomEndpointGroup(ctx, arn);
  requireString(input, "EndpointId");
  return {};
};

const ListCustomRoutingPortMappings: OperationHandler = (input, ctx) => {
  const acceleratorArn = requireString(input, "AcceleratorArn");
  requireCustomAccelerator(ctx, acceleratorArn);
  return { PortMappings: [] };
};

const ListCustomRoutingPortMappingsByDestination: OperationHandler = (
  _input,
  _ctx,
) => {
  return { DestinationPortMappings: [] };
};

const CreateCrossAccountAttachment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  requireString(input, "IdempotencyToken");
  const id = crypto.randomUUID();
  const arn = `arn:aws:globalaccelerator::${ctx.account}:attachment/${id}`;
  const now = Date.now() / 1000;
  const att: StoredAttachment = {
    AttachmentArn: arn,
    Name: name,
    Principals: Array.isArray(input["Principals"])
      ? (input["Principals"] as string[])
      : [],
    Resources: Array.isArray(input["Resources"])
      ? (input["Resources"] as { EndpointId: string; Region: string }[])
      : [],
    CreatedTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(attachmentKey(arn), att);
  return { CrossAccountAttachment: att };
};

const DescribeCrossAccountAttachment: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AttachmentArn");
  return { CrossAccountAttachment: requireAttachment(ctx, arn) };
};

const ListCrossAccountAttachments: OperationHandler = (_input, ctx) => {
  const attachments = ctx.store
    .list<StoredAttachment>()
    .filter((entry) => entry.key.startsWith("attachment/"))
    .map((entry) => entry.value);
  return { CrossAccountAttachments: attachments };
};

const UpdateCrossAccountAttachment: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AttachmentArn");
  const att = requireAttachment(ctx, arn);
  const updated: StoredAttachment = {
    ...att,
    Name: stringOrUndefined(input["Name"]) ?? att.Name,
    Principals: Array.isArray(input["AddPrincipals"])
      ? [
          ...att.Principals.filter(
            (p) =>
              !Array.isArray(input["RemovePrincipals"]) ||
              !(input["RemovePrincipals"] as string[]).includes(p),
          ),
          ...(input["AddPrincipals"] as string[]),
        ]
      : att.Principals.filter(
          (p) =>
            !Array.isArray(input["RemovePrincipals"]) ||
            !(input["RemovePrincipals"] as string[]).includes(p),
        ),
    Resources: Array.isArray(input["AddResources"])
      ? [
          ...att.Resources,
          ...(input["AddResources"] as {
            EndpointId: string;
            Region: string;
          }[]),
        ]
      : att.Resources,
    LastModifiedTime: Date.now() / 1000,
  };
  ctx.store.set(attachmentKey(arn), updated);
  return { CrossAccountAttachment: updated };
};

const DeleteCrossAccountAttachment: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AttachmentArn");
  requireAttachment(ctx, arn);
  ctx.store.delete(attachmentKey(arn));
  return {};
};

const ListCrossAccountResourceAccounts: OperationHandler = (_input, _ctx) => {
  return { ResourceOwnerAwsAccountIds: [] };
};

const ListCrossAccountResources: OperationHandler = (_input, _ctx) => {
  return { CrossAccountResources: [] };
};

const ProvisionByoipCidr: OperationHandler = (input, ctx) => {
  const cidr = requireString(input, "Cidr");
  const now = Date.now() / 1000;
  const byoip: StoredByoipCidr = {
    Cidr: cidr,
    State: "PENDING_PROVISIONING",
    Events: [{ Message: "Provisioning initiated", Timestamp: now }],
  };
  ctx.store.set(byoipCidrKey(cidr), byoip);
  return { ByoipCidr: byoip };
};

const DeprovisionByoipCidr: OperationHandler = (input, ctx) => {
  const cidr = requireString(input, "Cidr");
  const byoip = ctx.store.get<StoredByoipCidr>(byoipCidrKey(cidr));
  if (byoip === undefined) {
    throw awsError(
      "ByoipCidrNotFoundException",
      `BYOIP CIDR not found: ${cidr}`,
      400,
    );
  }
  const updated: StoredByoipCidr = {
    ...byoip,
    State: "PENDING_DEPROVISIONING",
  };
  ctx.store.set(byoipCidrKey(cidr), updated);
  return { ByoipCidr: updated };
};

const AdvertiseByoipCidr: OperationHandler = (input, ctx) => {
  const cidr = requireString(input, "Cidr");
  const byoip = ctx.store.get<StoredByoipCidr>(byoipCidrKey(cidr));
  if (byoip === undefined) {
    throw awsError(
      "ByoipCidrNotFoundException",
      `BYOIP CIDR not found: ${cidr}`,
      400,
    );
  }
  const updated: StoredByoipCidr = { ...byoip, State: "ADVERTISING" };
  ctx.store.set(byoipCidrKey(cidr), updated);
  return { ByoipCidr: updated };
};

const WithdrawByoipCidr: OperationHandler = (input, ctx) => {
  const cidr = requireString(input, "Cidr");
  const byoip = ctx.store.get<StoredByoipCidr>(byoipCidrKey(cidr));
  if (byoip === undefined) {
    throw awsError(
      "ByoipCidrNotFoundException",
      `BYOIP CIDR not found: ${cidr}`,
      400,
    );
  }
  const updated: StoredByoipCidr = { ...byoip, State: "PROVISIONED" };
  ctx.store.set(byoipCidrKey(cidr), updated);
  return { ByoipCidr: updated };
};

const ListByoipCidrs: OperationHandler = (_input, ctx) => {
  const cidrs = ctx.store
    .list<StoredByoipCidr>()
    .filter((entry) => entry.key.startsWith("byoipcidr/"))
    .map((entry) => entry.value);
  return { ByoipCidrs: cidrs };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  const newTags = Array.isArray(input["Tags"])
    ? (input["Tags"] as { Key: string; Value: string }[]).reduce(
        (acc, t) => ({ ...acc, [t.Key]: t.Value }),
        {} as Record<string, string>,
      )
    : {};
  ctx.store.set(tagsKey(arn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  const keysToRemove = new Set(
    Array.isArray(input["TagKeys"]) ? (input["TagKeys"] as string[]) : [],
  );
  const updated = Object.fromEntries(
    Object.entries(existing).filter(([k]) => !keysToRemove.has(k)),
  );
  ctx.store.set(tagsKey(arn), updated);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tagsMap = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  const tags = Object.entries(tagsMap).map(([Key, Value]) => ({ Key, Value }));
  return { Tags: tags };
};

const globalaccelerator = {
  name: "globalaccelerator",
  protocol: "json",
  operations: {
    CreateAccelerator,
    DescribeAccelerator,
    ListAccelerators,
    UpdateAccelerator,
    DeleteAccelerator,
    DescribeAcceleratorAttributes,
    UpdateAcceleratorAttributes,
    CreateListener,
    DescribeListener,
    ListListeners,
    UpdateListener,
    DeleteListener,
    CreateEndpointGroup,
    DescribeEndpointGroup,
    ListEndpointGroups,
    UpdateEndpointGroup,
    DeleteEndpointGroup,
    AddEndpoints,
    RemoveEndpoints,
    CreateCustomRoutingAccelerator,
    DescribeCustomRoutingAccelerator,
    ListCustomRoutingAccelerators,
    UpdateCustomRoutingAccelerator,
    DeleteCustomRoutingAccelerator,
    DescribeCustomRoutingAcceleratorAttributes,
    UpdateCustomRoutingAcceleratorAttributes,
    CreateCustomRoutingListener,
    DescribeCustomRoutingListener,
    ListCustomRoutingListeners,
    UpdateCustomRoutingListener,
    DeleteCustomRoutingListener,
    CreateCustomRoutingEndpointGroup,
    DescribeCustomRoutingEndpointGroup,
    ListCustomRoutingEndpointGroups,
    DeleteCustomRoutingEndpointGroup,
    AddCustomRoutingEndpoints,
    RemoveCustomRoutingEndpoints,
    AllowCustomRoutingTraffic,
    DenyCustomRoutingTraffic,
    ListCustomRoutingPortMappings,
    ListCustomRoutingPortMappingsByDestination,
    CreateCrossAccountAttachment,
    DescribeCrossAccountAttachment,
    ListCrossAccountAttachments,
    UpdateCrossAccountAttachment,
    DeleteCrossAccountAttachment,
    ListCrossAccountResourceAccounts,
    ListCrossAccountResources,
    ProvisionByoipCidr,
    DeprovisionByoipCidr,
    AdvertiseByoipCidr,
    WithdrawByoipCidr,
    ListByoipCidrs,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default globalaccelerator;
