import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import servicediscoveryModel from "../../../../test/vendor/aws-models/servicediscovery.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(servicediscoveryModel);

type StoredNamespace = {
  Id: string;
  Arn: string;
  ResourceOwner: string;
  Name: string;
  Type: string;
  Description?: string;
  ServiceCount: number;
  Properties: Record<string, unknown>;
  CreateDate: number;
  CreatorRequestId: string;
};

type StoredService = {
  Id: string;
  Arn: string;
  ResourceOwner: string;
  Name: string;
  NamespaceId?: string;
  Description?: string;
  InstanceCount: number;
  DnsConfig?: Record<string, unknown>;
  Type: string;
  HealthCheckConfig?: Record<string, unknown>;
  HealthCheckCustomConfig?: Record<string, unknown>;
  CreateDate: number;
  CreatorRequestId: string;
  CreatedByAccount: string;
};

type StoredInstance = {
  Id: string;
  ServiceId: string;
  Attributes: Record<string, unknown>;
  CreatorRequestId: string;
};

const namespaceKey = (id: string): string => `namespace/${id}`;

const serviceKey = (id: string): string => `service/${id}`;

const instanceKey = (serviceId: string, instanceId: string): string =>
  `instance/${serviceId}/${instanceId}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidInput", `${key} is required.`, 400);
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = input[key];
  return typeof value === "string" && value !== "" ? value : undefined;
};

const optionalObject = (
  input: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined => {
  const value = input[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
};

const randomHex = (length: number): string => {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

const newOperationId = (): string =>
  `${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}`;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const CreatePrivateDnsNamespace: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const vpc = requireString(input, "Vpc");
  const existing = ctx.store
    .list<StoredNamespace>()
    .filter((entry) => entry.key.startsWith("namespace/"))
    .map((entry) => entry.value)
    .find((ns) => ns.Name === name);
  if (existing !== undefined) {
    throw awsError(
      "NamespaceAlreadyExists",
      `The namespace ${name} already exists.`,
      400,
    );
  }
  const id = `ns-${randomHex(13)}`;
  const namespace: StoredNamespace = {
    Id: id,
    Arn: `arn:aws:servicediscovery:${ctx.region}:${ctx.account}:namespace/${id}`,
    ResourceOwner: ctx.account,
    Name: name,
    Type: "DNS_PRIVATE",
    Description: optionalString(input, "Description"),
    ServiceCount: 0,
    Properties: {
      DnsProperties: {
        HostedZoneId: `Z${randomHex(13).toUpperCase()}`,
        SOA: { TTL: 15 },
      },
      HttpProperties: { HttpName: name },
    },
    CreateDate: nowSeconds(),
    CreatorRequestId:
      optionalString(input, "CreatorRequestId") ?? newOperationId(),
  };
  void vpc;
  ctx.store.set(namespaceKey(id), namespace);
  return { OperationId: newOperationId() };
};

const namespaceView = (ns: StoredNamespace): Record<string, unknown> => ({
  Id: ns.Id,
  Arn: ns.Arn,
  ResourceOwner: ns.ResourceOwner,
  Name: ns.Name,
  Type: ns.Type,
  Description: ns.Description,
  ServiceCount: ns.ServiceCount,
  Properties: ns.Properties,
  CreateDate: ns.CreateDate,
  CreatorRequestId: ns.CreatorRequestId,
});

const requireNamespace = (ctx: ServiceContext, id: string): StoredNamespace => {
  const namespace = ctx.store.get<StoredNamespace>(namespaceKey(id));
  if (namespace === undefined) {
    throw awsError(
      "NamespaceNotFound",
      `No namespace exists with the specified ID ${id}.`,
      400,
    );
  }
  return namespace;
};

const GetNamespace: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const namespace = requireNamespace(ctx, id);
  return { Namespace: namespaceView(namespace) };
};

const ListNamespaces: OperationHandler = (_input, ctx) => {
  const namespaces = ctx.store
    .list<StoredNamespace>()
    .filter((entry) => entry.key.startsWith("namespace/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  return {
    Namespaces: namespaces.map((ns) => ({
      Id: ns.Id,
      Arn: ns.Arn,
      ResourceOwner: ns.ResourceOwner,
      Name: ns.Name,
      Type: ns.Type,
      Description: ns.Description,
      ServiceCount: ns.ServiceCount,
      Properties: ns.Properties,
      CreateDate: ns.CreateDate,
    })),
  };
};

const serviceView = (svc: StoredService): Record<string, unknown> => ({
  Id: svc.Id,
  Arn: svc.Arn,
  ResourceOwner: svc.ResourceOwner,
  Name: svc.Name,
  NamespaceId: svc.NamespaceId,
  Description: svc.Description,
  InstanceCount: svc.InstanceCount,
  DnsConfig: svc.DnsConfig,
  Type: svc.Type,
  HealthCheckConfig: svc.HealthCheckConfig,
  HealthCheckCustomConfig: svc.HealthCheckCustomConfig,
  CreateDate: svc.CreateDate,
  CreatorRequestId: svc.CreatorRequestId,
  CreatedByAccount: svc.CreatedByAccount,
});

const CreateService: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const namespaceId = optionalString(input, "NamespaceId");
  if (namespaceId !== undefined) {
    requireNamespace(ctx, namespaceId);
  }
  const id = `srv-${randomHex(13)}`;
  const dnsConfig = optionalObject(input, "DnsConfig");
  const serviceType =
    optionalString(input, "Type") ??
    (dnsConfig !== undefined ? "DNS_HTTP" : "HTTP");
  const service: StoredService = {
    Id: id,
    Arn: `arn:aws:servicediscovery:${ctx.region}:${ctx.account}:service/${id}`,
    ResourceOwner: ctx.account,
    Name: name,
    NamespaceId: namespaceId,
    Description: optionalString(input, "Description"),
    InstanceCount: 0,
    DnsConfig: dnsConfig,
    Type: serviceType,
    HealthCheckConfig: optionalObject(input, "HealthCheckConfig"),
    HealthCheckCustomConfig: optionalObject(input, "HealthCheckCustomConfig"),
    CreateDate: nowSeconds(),
    CreatorRequestId:
      optionalString(input, "CreatorRequestId") ?? newOperationId(),
    CreatedByAccount: ctx.account,
  };
  ctx.store.set(serviceKey(id), service);
  if (namespaceId !== undefined) {
    const namespace = requireNamespace(ctx, namespaceId);
    namespace.ServiceCount += 1;
    ctx.store.set(namespaceKey(namespaceId), namespace);
  }
  return { Service: serviceView(service) };
};

const requireService = (ctx: ServiceContext, id: string): StoredService => {
  const service = ctx.store.get<StoredService>(serviceKey(id));
  if (service === undefined) {
    throw awsError(
      "ServiceNotFound",
      `No service exists with the specified ID ${id}.`,
      400,
    );
  }
  return service;
};

const GetService: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const service = requireService(ctx, id);
  return { Service: serviceView(service) };
};

const ListServices: OperationHandler = (_input, ctx) => {
  const services = ctx.store
    .list<StoredService>()
    .filter((entry) => entry.key.startsWith("service/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  return {
    Services: services.map((svc) => ({
      Id: svc.Id,
      Arn: svc.Arn,
      ResourceOwner: svc.ResourceOwner,
      Name: svc.Name,
      Type: svc.Type,
      Description: svc.Description,
      InstanceCount: svc.InstanceCount,
      DnsConfig: svc.DnsConfig,
      HealthCheckConfig: svc.HealthCheckConfig,
      HealthCheckCustomConfig: svc.HealthCheckCustomConfig,
      CreateDate: svc.CreateDate,
      CreatedByAccount: svc.CreatedByAccount,
    })),
  };
};

const RegisterInstance: OperationHandler = (input, ctx) => {
  const serviceId = requireString(input, "ServiceId");
  const instanceId = requireString(input, "InstanceId");
  const attributes = optionalObject(input, "Attributes") ?? {};
  const service = requireService(ctx, serviceId);
  const existing = ctx.store.get<StoredInstance>(
    instanceKey(serviceId, instanceId),
  );
  const instance: StoredInstance = {
    Id: instanceId,
    ServiceId: serviceId,
    Attributes: attributes,
    CreatorRequestId:
      optionalString(input, "CreatorRequestId") ?? newOperationId(),
  };
  ctx.store.set(instanceKey(serviceId, instanceId), instance);
  if (existing === undefined) {
    service.InstanceCount += 1;
    ctx.store.set(serviceKey(serviceId), service);
  }
  return { OperationId: newOperationId() };
};

const servicediscovery = {
  name: "servicediscovery",
  protocol: "json",
  operations: {
    CreatePrivateDnsNamespace,
    GetNamespace,
    ListNamespaces,
    CreateService,
    GetService,
    ListServices,
    RegisterInstance,
  },
  model,
} as const satisfies ServiceDefinition;

export default servicediscovery;
