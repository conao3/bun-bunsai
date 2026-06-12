import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () =>
    import("../../models/servicediscovery.json", { with: { type: "json" } }),
  { targetPrefix: "Route53AutoNaming_v20170314" },
);

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

type StoredOperation = {
  Id: string;
  OwnerAccount: string;
  Type: string;
  Status: string;
  CreateDate: number;
  UpdateDate: number;
  Targets: Record<string, string>;
};

const namespaceKey = (id: string): string => `namespace/${id}`;

const serviceKey = (id: string): string => `service/${id}`;

const instanceKey = (serviceId: string, instanceId: string): string =>
  `instance/${serviceId}/${instanceId}`;

const operationKey = (id: string): string => `operation/${id}`;

const tagsKey = (arn: string): string => `tags/${arn}`;

const healthStatusKey = (serviceId: string, instanceId: string): string =>
  `healthstatus/${serviceId}/${instanceId}`;

const serviceAttributesKey = (serviceId: string): string =>
  `serviceattributes/${serviceId}`;

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

const storeOperation = (
  ctx: ServiceContext,
  type: string,
  targets: Record<string, string> = {},
): string => {
  const id = newOperationId();
  const op: StoredOperation = {
    Id: id,
    OwnerAccount: ctx.account,
    Type: type,
    Status: "SUCCESS",
    CreateDate: nowSeconds(),
    UpdateDate: nowSeconds(),
    Targets: targets,
  };
  ctx.store.set(operationKey(id), op);
  return id;
};

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

const requireInstance = (
  ctx: ServiceContext,
  serviceId: string,
  instanceId: string,
): StoredInstance => {
  const instance = ctx.store.get<StoredInstance>(
    instanceKey(serviceId, instanceId),
  );
  if (instance === undefined) {
    throw awsError(
      "InstanceNotFound",
      `No instance exists with the specified ID ${instanceId}.`,
      400,
    );
  }
  return instance;
};

const requireOperation = (ctx: ServiceContext, id: string): StoredOperation => {
  const op = ctx.store.get<StoredOperation>(operationKey(id));
  if (op === undefined) {
    throw awsError(
      "OperationNotFound",
      `No operation exists with the specified ID ${id}.`,
      400,
    );
  }
  return op;
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

const checkNamespaceDuplicate = (
  ctx: ServiceContext,
  name: string,
  creatorRequestId: string | undefined,
): StoredNamespace | undefined => {
  const existing = ctx.store
    .list<StoredNamespace>()
    .filter((entry) => entry.key.startsWith("namespace/"))
    .map((entry) => entry.value)
    .find((ns) => ns.Name === name);
  if (existing === undefined) return undefined;
  if (
    creatorRequestId !== undefined &&
    existing.CreatorRequestId === creatorRequestId
  ) {
    return existing;
  }
  throw awsError(
    "NamespaceAlreadyExists",
    `The namespace ${name} already exists.`,
    400,
  );
};

const encodeListToken = (offset: number): string => btoa(String(offset));

const decodeListToken = (token: string | undefined): number => {
  if (token === undefined || token === "") return 0;
  try {
    const n = parseInt(atob(token), 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
};

const resolveListMax = (value: unknown): number => {
  if (typeof value !== "number" || value <= 0) return 100;
  return Math.floor(Math.min(value, 100));
};

const paginateList = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
): { page: T[]; NextToken: string | undefined } => {
  const offset = decodeListToken(
    typeof nextToken === "string" ? nextToken : undefined,
  );
  const max = resolveListMax(maxResults);
  const page = items.slice(offset, offset + max);
  const next =
    offset + max < items.length ? encodeListToken(offset + max) : undefined;
  return { page, NextToken: next };
};

const CreatePrivateDnsNamespace: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const vpc = requireString(input, "Vpc");
  const creatorRequestId = optionalString(input, "CreatorRequestId");
  const idemMatch = checkNamespaceDuplicate(ctx, name, creatorRequestId);
  if (idemMatch !== undefined) {
    return {
      OperationId: storeOperation(ctx, "CREATE_NAMESPACE", {
        NAMESPACE: idemMatch.Id,
      }),
    };
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
  return {
    OperationId: storeOperation(ctx, "CREATE_NAMESPACE", { NAMESPACE: id }),
  };
};

const CreateHttpNamespace: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const creatorRequestId = optionalString(input, "CreatorRequestId");
  const idemMatch = checkNamespaceDuplicate(ctx, name, creatorRequestId);
  if (idemMatch !== undefined) {
    return {
      OperationId: storeOperation(ctx, "CREATE_NAMESPACE", {
        NAMESPACE: idemMatch.Id,
      }),
    };
  }
  const id = `ns-${randomHex(13)}`;
  const namespace: StoredNamespace = {
    Id: id,
    Arn: `arn:aws:servicediscovery:${ctx.region}:${ctx.account}:namespace/${id}`,
    ResourceOwner: ctx.account,
    Name: name,
    Type: "HTTP",
    Description: optionalString(input, "Description"),
    ServiceCount: 0,
    Properties: { HttpProperties: { HttpName: name } },
    CreateDate: nowSeconds(),
    CreatorRequestId:
      optionalString(input, "CreatorRequestId") ?? newOperationId(),
  };
  ctx.store.set(namespaceKey(id), namespace);
  return {
    OperationId: storeOperation(ctx, "CREATE_NAMESPACE", { NAMESPACE: id }),
  };
};

const CreatePublicDnsNamespace: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const creatorRequestId = optionalString(input, "CreatorRequestId");
  const idemMatch = checkNamespaceDuplicate(ctx, name, creatorRequestId);
  if (idemMatch !== undefined) {
    return {
      OperationId: storeOperation(ctx, "CREATE_NAMESPACE", {
        NAMESPACE: idemMatch.Id,
      }),
    };
  }
  const id = `ns-${randomHex(13)}`;
  const namespace: StoredNamespace = {
    Id: id,
    Arn: `arn:aws:servicediscovery:${ctx.region}:${ctx.account}:namespace/${id}`,
    ResourceOwner: ctx.account,
    Name: name,
    Type: "DNS_PUBLIC",
    Description: optionalString(input, "Description"),
    ServiceCount: 0,
    Properties: {
      DnsProperties: {
        HostedZoneId: `Z${randomHex(13).toUpperCase()}`,
        SOA: { TTL: 60 },
      },
      HttpProperties: { HttpName: name },
    },
    CreateDate: nowSeconds(),
    CreatorRequestId:
      optionalString(input, "CreatorRequestId") ?? newOperationId(),
  };
  ctx.store.set(namespaceKey(id), namespace);
  return {
    OperationId: storeOperation(ctx, "CREATE_NAMESPACE", { NAMESPACE: id }),
  };
};

const GetNamespace: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const namespace = requireNamespace(ctx, id);
  return { Namespace: namespaceView(namespace) };
};

const ListNamespaces: OperationHandler = (input, ctx) => {
  const namespaces = ctx.store
    .list<StoredNamespace>()
    .filter((entry) => entry.key.startsWith("namespace/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  const { page, NextToken } = paginateList(
    namespaces,
    input["MaxResults"],
    input["NextToken"],
  );
  const result: Record<string, unknown> = {
    Namespaces: page.map((ns) => ({
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
  if (NextToken !== undefined) result["NextToken"] = NextToken;
  return result;
};

const UpdateHttpNamespace: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const namespace = requireNamespace(ctx, id);
  const change = optionalObject(input, "Namespace");
  if (change !== undefined) {
    const desc = optionalString(change, "Description");
    if (desc !== undefined) namespace.Description = desc;
  }
  ctx.store.set(namespaceKey(id), namespace);
  return {
    OperationId: storeOperation(ctx, "UPDATE_NAMESPACE", { NAMESPACE: id }),
  };
};

const UpdatePublicDnsNamespace: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const namespace = requireNamespace(ctx, id);
  const change = optionalObject(input, "Namespace");
  if (change !== undefined) {
    const desc = optionalString(change, "Description");
    if (desc !== undefined) namespace.Description = desc;
  }
  ctx.store.set(namespaceKey(id), namespace);
  return {
    OperationId: storeOperation(ctx, "UPDATE_NAMESPACE", { NAMESPACE: id }),
  };
};

const UpdatePrivateDnsNamespace: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const namespace = requireNamespace(ctx, id);
  const change = optionalObject(input, "Namespace");
  if (change !== undefined) {
    const desc = optionalString(change, "Description");
    if (desc !== undefined) namespace.Description = desc;
  }
  ctx.store.set(namespaceKey(id), namespace);
  return {
    OperationId: storeOperation(ctx, "UPDATE_NAMESPACE", { NAMESPACE: id }),
  };
};

const DeleteNamespace: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const namespace = requireNamespace(ctx, id);
  if (namespace.ServiceCount > 0) {
    throw awsError(
      "ResourceInUse",
      `Namespace ${id} contains ${namespace.ServiceCount} service(s); detach them before deletion.`,
      400,
    );
  }
  ctx.store.delete(namespaceKey(id));
  return {
    OperationId: storeOperation(ctx, "DELETE_NAMESPACE", { NAMESPACE: id }),
  };
};

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

const GetService: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const service = requireService(ctx, id);
  return { Service: serviceView(service) };
};

const ListServices: OperationHandler = (input, ctx) => {
  const filters = Array.isArray(input["Filters"])
    ? (input["Filters"] as Array<{
        Name: string;
        Values: string[];
        Condition?: string;
      }>)
    : [];
  const nsFilter = filters.find((f) => f.Name === "NAMESPACE_ID");
  let services = ctx.store
    .list<StoredService>()
    .filter((entry) => entry.key.startsWith("service/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  if (nsFilter !== undefined && Array.isArray(nsFilter.Values)) {
    services = services.filter(
      (svc) =>
        svc.NamespaceId !== undefined &&
        nsFilter.Values.includes(svc.NamespaceId),
    );
  }
  const { page, NextToken } = paginateList(
    services,
    input["MaxResults"],
    input["NextToken"],
  );
  const result: Record<string, unknown> = {
    Services: page.map((svc) => ({
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
  if (NextToken !== undefined) result["NextToken"] = NextToken;
  return result;
};

const UpdateService: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const service = requireService(ctx, id);
  const change = optionalObject(input, "Service");
  if (change !== undefined) {
    const desc = optionalString(change, "Description");
    if (desc !== undefined) service.Description = desc;
    const dnsConfig = optionalObject(change, "DnsConfig");
    if (dnsConfig !== undefined) service.DnsConfig = dnsConfig;
    const healthCheckConfig = optionalObject(change, "HealthCheckConfig");
    if (healthCheckConfig !== undefined)
      service.HealthCheckConfig = healthCheckConfig;
  }
  ctx.store.set(serviceKey(id), service);
  return {
    OperationId: storeOperation(ctx, "UPDATE_SERVICE", { SERVICE: id }),
  };
};

const DeleteService: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const service = requireService(ctx, id);
  if (service.InstanceCount > 0) {
    throw awsError(
      "ResourceInUse",
      `Service ${id} contains ${service.InstanceCount} instance(s); deregister them before deletion.`,
      400,
    );
  }
  ctx.store.delete(serviceKey(id));
  if (service.NamespaceId !== undefined) {
    const namespace = ctx.store.get<StoredNamespace>(
      namespaceKey(service.NamespaceId),
    );
    if (namespace !== undefined) {
      namespace.ServiceCount = Math.max(0, namespace.ServiceCount - 1);
      ctx.store.set(namespaceKey(service.NamespaceId), namespace);
    }
  }
  return {};
};

const GetServiceAttributes: OperationHandler = (input, ctx) => {
  const serviceId = requireString(input, "ServiceId");
  const service = requireService(ctx, serviceId);
  const attrs =
    ctx.store.get<Record<string, string>>(serviceAttributesKey(serviceId)) ??
    {};
  return {
    ServiceAttributes: {
      ServiceArn: service.Arn,
      ResourceOwner: service.ResourceOwner,
      Attributes: attrs,
    },
  };
};

const UpdateServiceAttributes: OperationHandler = (input, ctx) => {
  const serviceId = requireString(input, "ServiceId");
  requireService(ctx, serviceId);
  const newAttrs =
    (input["Attributes"] as Record<string, string> | undefined) ?? {};
  const attrs =
    ctx.store.get<Record<string, string>>(serviceAttributesKey(serviceId)) ??
    {};
  Object.assign(attrs, newAttrs);
  ctx.store.set(serviceAttributesKey(serviceId), attrs);
  return {};
};

const DeleteServiceAttributes: OperationHandler = (input, ctx) => {
  const serviceId = requireString(input, "ServiceId");
  requireService(ctx, serviceId);
  const keysToDelete = (input["Attributes"] as string[] | undefined) ?? [];
  const attrs =
    ctx.store.get<Record<string, string>>(serviceAttributesKey(serviceId)) ??
    {};
  for (const k of keysToDelete) {
    delete attrs[k];
  }
  ctx.store.set(serviceAttributesKey(serviceId), attrs);
  return {};
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
  return {
    OperationId: storeOperation(ctx, "REGISTER_INSTANCE", {
      INSTANCE: instanceId,
      SERVICE: serviceId,
    }),
  };
};

const DeregisterInstance: OperationHandler = (input, ctx) => {
  const serviceId = requireString(input, "ServiceId");
  const instanceId = requireString(input, "InstanceId");
  requireService(ctx, serviceId);
  requireInstance(ctx, serviceId, instanceId);
  ctx.store.delete(instanceKey(serviceId, instanceId));
  ctx.store.delete(healthStatusKey(serviceId, instanceId));
  const service = requireService(ctx, serviceId);
  service.InstanceCount = Math.max(0, service.InstanceCount - 1);
  ctx.store.set(serviceKey(serviceId), service);
  return {
    OperationId: storeOperation(ctx, "DEREGISTER_INSTANCE", {
      INSTANCE: instanceId,
      SERVICE: serviceId,
    }),
  };
};

const GetInstance: OperationHandler = (input, ctx) => {
  const serviceId = requireString(input, "ServiceId");
  const instanceId = requireString(input, "InstanceId");
  const service = requireService(ctx, serviceId);
  const instance = requireInstance(ctx, serviceId, instanceId);
  return {
    ResourceOwner: service.ResourceOwner,
    Instance: {
      Id: instance.Id,
      CreatorRequestId: instance.CreatorRequestId,
      Attributes: instance.Attributes,
    },
  };
};

const ListInstances: OperationHandler = (input, ctx) => {
  const serviceId = requireString(input, "ServiceId");
  const service = requireService(ctx, serviceId);
  const prefix = `instance/${serviceId}/`;
  const instances = ctx.store
    .list<StoredInstance>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  return {
    ResourceOwner: service.ResourceOwner,
    Instances: instances.map((inst) => ({
      Id: inst.Id,
      Attributes: inst.Attributes,
    })),
  };
};

const GetInstancesHealthStatus: OperationHandler = (input, ctx) => {
  const serviceId = requireString(input, "ServiceId");
  requireService(ctx, serviceId);
  const requestedIds = input["Instances"] as string[] | undefined;
  const prefix = `instance/${serviceId}/`;
  const instances = ctx.store
    .list<StoredInstance>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value)
    .filter(
      (inst) => requestedIds === undefined || requestedIds.includes(inst.Id),
    );
  const status: Record<string, string> = {};
  for (const inst of instances) {
    status[inst.Id] =
      ctx.store.get<string>(healthStatusKey(serviceId, inst.Id)) ?? "HEALTHY";
  }
  return { Status: status };
};

const UpdateInstanceCustomHealthStatus: OperationHandler = (input, ctx) => {
  const serviceId = requireString(input, "ServiceId");
  const instanceId = requireString(input, "InstanceId");
  const status = requireString(input, "Status");
  requireService(ctx, serviceId);
  requireInstance(ctx, serviceId, instanceId);
  ctx.store.set(healthStatusKey(serviceId, instanceId), status);
  return {};
};

const DiscoverInstances: OperationHandler = (input, ctx) => {
  const namespaceName = requireString(input, "NamespaceName");
  const serviceName = requireString(input, "ServiceName");
  const healthStatusFilter = optionalString(input, "HealthStatus");
  const namespace = ctx.store
    .list<StoredNamespace>()
    .filter((entry) => entry.key.startsWith("namespace/"))
    .map((entry) => entry.value)
    .find((ns) => ns.Name === namespaceName);
  if (namespace === undefined) {
    throw awsError(
      "NamespaceNotFound",
      `No namespace exists with the name ${namespaceName}.`,
      400,
    );
  }
  const service = ctx.store
    .list<StoredService>()
    .filter((entry) => entry.key.startsWith("service/"))
    .map((entry) => entry.value)
    .find(
      (svc) => svc.Name === serviceName && svc.NamespaceId === namespace.Id,
    );
  if (service === undefined) {
    return { Instances: [], InstancesRevision: 0 };
  }
  const prefix = `instance/${service.Id}/`;
  const instances = ctx.store
    .list<StoredInstance>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  const httpInstances = instances
    .map((inst) => {
      const hs =
        ctx.store.get<string>(healthStatusKey(service.Id, inst.Id)) ??
        "HEALTHY";
      return {
        InstanceId: inst.Id,
        NamespaceName: namespaceName,
        ServiceName: serviceName,
        HealthStatus: hs,
        Attributes: inst.Attributes,
      };
    })
    .filter((inst) => {
      if (healthStatusFilter === undefined || healthStatusFilter === "ALL") {
        return true;
      }
      if (healthStatusFilter === "HEALTHY_OR_ELSE_ALL") {
        return true;
      }
      return inst.HealthStatus === healthStatusFilter;
    });
  return {
    Instances: httpInstances,
    InstancesRevision: service.InstanceCount,
  };
};

const DiscoverInstancesRevision: OperationHandler = (input, ctx) => {
  const namespaceName = requireString(input, "NamespaceName");
  const serviceName = requireString(input, "ServiceName");
  const namespace = ctx.store
    .list<StoredNamespace>()
    .filter((entry) => entry.key.startsWith("namespace/"))
    .map((entry) => entry.value)
    .find((ns) => ns.Name === namespaceName);
  if (namespace === undefined) {
    throw awsError(
      "NamespaceNotFound",
      `No namespace exists with the name ${namespaceName}.`,
      400,
    );
  }
  const service = ctx.store
    .list<StoredService>()
    .filter((entry) => entry.key.startsWith("service/"))
    .map((entry) => entry.value)
    .find(
      (svc) => svc.Name === serviceName && svc.NamespaceId === namespace.Id,
    );
  return {
    InstancesRevision: service !== undefined ? service.InstanceCount : 0,
  };
};

const GetOperation: OperationHandler = (input, ctx) => {
  const id = requireString(input, "OperationId");
  const op = requireOperation(ctx, id);
  return {
    Operation: {
      Id: op.Id,
      OwnerAccount: op.OwnerAccount,
      Type: op.Type,
      Status: op.Status,
      CreateDate: op.CreateDate,
      UpdateDate: op.UpdateDate,
      Targets: op.Targets,
    },
  };
};

const ListOperations: OperationHandler = (_input, ctx) => {
  const operations = ctx.store
    .list<StoredOperation>()
    .filter((entry) => entry.key.startsWith("operation/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreateDate - a.CreateDate);
  return {
    Operations: operations.map((op) => ({
      Id: op.Id,
      Status: op.Status,
    })),
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const newTags =
    (input["Tags"] as Array<{ Key: string; Value: string }> | undefined) ?? [];
  const key = tagsKey(arn);
  const tags = ctx.store.get<Record<string, string>>(key) ?? {};
  for (const tag of newTags) {
    tags[tag.Key] = tag.Value;
  }
  ctx.store.set(key, tags);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const tagKeys = (input["TagKeys"] as string[] | undefined) ?? [];
  const key = tagsKey(arn);
  const tags = ctx.store.get<Record<string, string>>(key) ?? {};
  for (const k of tagKeys) {
    delete tags[k];
  }
  ctx.store.set(key, tags);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  const key = tagsKey(arn);
  const tags = ctx.store.get<Record<string, string>>(key) ?? {};
  return {
    Tags: Object.entries(tags).map(([k, v]) => ({ Key: k, Value: v })),
  };
};

const servicediscovery = {
  name: "servicediscovery",
  protocol: "json",
  operations: {
    CreatePrivateDnsNamespace,
    CreateHttpNamespace,
    CreatePublicDnsNamespace,
    GetNamespace,
    ListNamespaces,
    UpdateHttpNamespace,
    UpdatePublicDnsNamespace,
    UpdatePrivateDnsNamespace,
    DeleteNamespace,
    CreateService,
    GetService,
    ListServices,
    UpdateService,
    DeleteService,
    GetServiceAttributes,
    UpdateServiceAttributes,
    DeleteServiceAttributes,
    RegisterInstance,
    DeregisterInstance,
    GetInstance,
    ListInstances,
    GetInstancesHealthStatus,
    UpdateInstanceCustomHealthStatus,
    DiscoverInstances,
    DiscoverInstancesRevision,
    GetOperation,
    ListOperations,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default servicediscovery;
