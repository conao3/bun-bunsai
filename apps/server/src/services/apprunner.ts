import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import apprunnerModel from "../../models/apprunner.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(apprunnerModel);

const servicePrefix = "service:" as const;
const autoScalingPrefix = "autoscaling:" as const;
const connectionPrefix = "connection:" as const;
const observabilityPrefix = "observability:" as const;
const vpcConnectorPrefix = "vpcconnector:" as const;
const vpcIngressPrefix = "vpcingressconnection:" as const;
const customDomainsPrefix = "customdomains:" as const;
const tagsPrefix = "tags:" as const;
const operationsPrefix = "operations:" as const;

type StoredService = {
  ServiceName: string;
  ServiceId: string;
  ServiceArn: string;
  ServiceUrl: string;
  CreatedAt: number;
  UpdatedAt: number;
  Status: string;
  SourceConfiguration: Record<string, unknown>;
  InstanceConfiguration: Record<string, unknown>;
  EncryptionConfiguration: Record<string, unknown> | undefined;
  HealthCheckConfiguration: Record<string, unknown> | undefined;
  AutoScalingConfigurationSummary: Record<string, unknown>;
  NetworkConfiguration: Record<string, unknown>;
  ObservabilityConfiguration: Record<string, unknown> | undefined;
  AutoScalingConfigurationArn: string;
};

type StoredAutoScalingConfig = {
  AutoScalingConfigurationArn: string;
  AutoScalingConfigurationName: string;
  AutoScalingConfigurationRevision: number;
  Latest: boolean;
  Status: string;
  MaxConcurrency: number;
  MinSize: number;
  MaxSize: number;
  CreatedAt: number;
  DeletedAt: number | undefined;
  HasAssociatedService: boolean;
  IsDefault: boolean;
};

type StoredConnection = {
  ConnectionName: string;
  ConnectionArn: string;
  ProviderType: string;
  Status: string;
  CreatedAt: number;
};

type StoredObservabilityConfig = {
  ObservabilityConfigurationArn: string;
  ObservabilityConfigurationName: string;
  ObservabilityConfigurationRevision: number;
  Latest: boolean;
  Status: string;
  TraceConfiguration: Record<string, unknown> | undefined;
  CreatedAt: number;
  DeletedAt: number | undefined;
};

type StoredVpcConnector = {
  VpcConnectorName: string;
  VpcConnectorArn: string;
  VpcConnectorRevision: number;
  Subnets: string[];
  SecurityGroups: string[];
  Status: string;
  CreatedAt: number;
  DeletedAt: number | undefined;
};

type StoredVpcIngressConnection = {
  VpcIngressConnectionArn: string;
  VpcIngressConnectionName: string;
  ServiceArn: string;
  Status: string;
  AccountId: string;
  DomainName: string;
  IngressVpcConfiguration: Record<string, unknown>;
  CreatedAt: number;
  DeletedAt: number | undefined;
};

type StoredCustomDomain = {
  DomainName: string;
  EnableWWWSubdomain: boolean;
  Status: string;
};

type StoredOperation = {
  Id: string;
  Type: string;
  Status: string;
  TargetArn: string;
  StartedAt: number;
  EndedAt: number | undefined;
  UpdatedAt: number;
};

const encodeCursor = (offset: number): string => btoa(String(offset));

const decodeCursor = (token: string): number => {
  const n = parseInt(atob(token), 10);
  return isNaN(n) ? 0 : n;
};

const paginate = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
): { items: T[]; NextToken: string | undefined } => {
  const offset = typeof nextToken === "string" ? decodeCursor(nextToken) : 0;
  const max =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : 20;
  const page = items.slice(offset, offset + max);
  const token =
    offset + max < items.length ? encodeCursor(offset + max) : undefined;
  return { items: page, NextToken: token };
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? (value as unknown[]) : [];

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidRequestException", `${field} is required.`, 400);
  }
  return value;
};

const serviceKey = (id: string): string => `${servicePrefix}${id}`;

const nowSeconds = (): number => Date.now() / 1000;

const requireService = (ctx: ServiceContext, arn: string): StoredService => {
  const id = arn.split("/").pop() ?? "";
  const service = ctx.store.get<StoredService>(serviceKey(id));
  if (service === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Service ${arn} not found.`,
      400,
    );
  }
  return service;
};

const serviceView = (service: StoredService): Record<string, unknown> => ({
  ServiceName: service.ServiceName,
  ServiceId: service.ServiceId,
  ServiceArn: service.ServiceArn,
  ServiceUrl: service.ServiceUrl,
  CreatedAt: service.CreatedAt,
  UpdatedAt: service.UpdatedAt,
  Status: service.Status,
  SourceConfiguration: service.SourceConfiguration,
  InstanceConfiguration: service.InstanceConfiguration,
  EncryptionConfiguration: service.EncryptionConfiguration,
  HealthCheckConfiguration: service.HealthCheckConfiguration,
  AutoScalingConfigurationSummary: service.AutoScalingConfigurationSummary,
  NetworkConfiguration: service.NetworkConfiguration,
  ObservabilityConfiguration: service.ObservabilityConfiguration,
});

const serviceSummary = (service: StoredService): Record<string, unknown> => ({
  ServiceName: service.ServiceName,
  ServiceId: service.ServiceId,
  ServiceArn: service.ServiceArn,
  ServiceUrl: service.ServiceUrl,
  CreatedAt: service.CreatedAt,
  UpdatedAt: service.UpdatedAt,
  Status: service.Status,
});

const operationId = (): string => crypto.randomUUID();

const autoScalingView = (
  cfg: StoredAutoScalingConfig,
): Record<string, unknown> => ({
  AutoScalingConfigurationArn: cfg.AutoScalingConfigurationArn,
  AutoScalingConfigurationName: cfg.AutoScalingConfigurationName,
  AutoScalingConfigurationRevision: cfg.AutoScalingConfigurationRevision,
  Latest: cfg.Latest,
  Status: cfg.Status,
  MaxConcurrency: cfg.MaxConcurrency,
  MinSize: cfg.MinSize,
  MaxSize: cfg.MaxSize,
  CreatedAt: cfg.CreatedAt,
  DeletedAt: cfg.DeletedAt,
  HasAssociatedService: cfg.HasAssociatedService,
  IsDefault: cfg.IsDefault,
});

const autoScalingSummary = (
  cfg: StoredAutoScalingConfig,
): Record<string, unknown> => ({
  AutoScalingConfigurationArn: cfg.AutoScalingConfigurationArn,
  AutoScalingConfigurationName: cfg.AutoScalingConfigurationName,
  AutoScalingConfigurationRevision: cfg.AutoScalingConfigurationRevision,
  Status: cfg.Status,
  CreatedAt: cfg.CreatedAt,
  HasAssociatedService: cfg.HasAssociatedService,
  IsDefault: cfg.IsDefault,
});

const connectionView = (conn: StoredConnection): Record<string, unknown> => ({
  ConnectionName: conn.ConnectionName,
  ConnectionArn: conn.ConnectionArn,
  ProviderType: conn.ProviderType,
  Status: conn.Status,
  CreatedAt: conn.CreatedAt,
});

const observabilityView = (
  cfg: StoredObservabilityConfig,
): Record<string, unknown> => ({
  ObservabilityConfigurationArn: cfg.ObservabilityConfigurationArn,
  ObservabilityConfigurationName: cfg.ObservabilityConfigurationName,
  ObservabilityConfigurationRevision: cfg.ObservabilityConfigurationRevision,
  Latest: cfg.Latest,
  Status: cfg.Status,
  TraceConfiguration: cfg.TraceConfiguration,
  CreatedAt: cfg.CreatedAt,
  DeletedAt: cfg.DeletedAt,
});

const observabilitySummary = (
  cfg: StoredObservabilityConfig,
): Record<string, unknown> => ({
  ObservabilityConfigurationArn: cfg.ObservabilityConfigurationArn,
  ObservabilityConfigurationName: cfg.ObservabilityConfigurationName,
  ObservabilityConfigurationRevision: cfg.ObservabilityConfigurationRevision,
});

const vpcConnectorView = (vc: StoredVpcConnector): Record<string, unknown> => ({
  VpcConnectorName: vc.VpcConnectorName,
  VpcConnectorArn: vc.VpcConnectorArn,
  VpcConnectorRevision: vc.VpcConnectorRevision,
  Subnets: vc.Subnets,
  SecurityGroups: vc.SecurityGroups,
  Status: vc.Status,
  CreatedAt: vc.CreatedAt,
  DeletedAt: vc.DeletedAt,
});

const vpcIngressView = (
  vic: StoredVpcIngressConnection,
): Record<string, unknown> => ({
  VpcIngressConnectionArn: vic.VpcIngressConnectionArn,
  VpcIngressConnectionName: vic.VpcIngressConnectionName,
  ServiceArn: vic.ServiceArn,
  Status: vic.Status,
  AccountId: vic.AccountId,
  DomainName: vic.DomainName,
  IngressVpcConfiguration: vic.IngressVpcConfiguration,
  CreatedAt: vic.CreatedAt,
  DeletedAt: vic.DeletedAt,
});

const vpcIngressSummary = (
  vic: StoredVpcIngressConnection,
): Record<string, unknown> => ({
  VpcIngressConnectionArn: vic.VpcIngressConnectionArn,
  ServiceArn: vic.ServiceArn,
});

const getAutoScalingByArn = (
  ctx: ServiceContext,
  arn: string,
): StoredAutoScalingConfig => {
  const cfg = ctx.store.get<StoredAutoScalingConfig>(
    `${autoScalingPrefix}${arn}`,
  );
  if (cfg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `AutoScalingConfiguration ${arn} not found.`,
      400,
    );
  }
  return cfg;
};

const getConnectionByArn = (
  ctx: ServiceContext,
  arn: string,
): StoredConnection => {
  const conn = ctx.store.get<StoredConnection>(`${connectionPrefix}${arn}`);
  if (conn === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Connection ${arn} not found.`,
      400,
    );
  }
  return conn;
};

const getObservabilityByArn = (
  ctx: ServiceContext,
  arn: string,
): StoredObservabilityConfig => {
  const cfg = ctx.store.get<StoredObservabilityConfig>(
    `${observabilityPrefix}${arn}`,
  );
  if (cfg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ObservabilityConfiguration ${arn} not found.`,
      400,
    );
  }
  return cfg;
};

const getVpcConnectorByArn = (
  ctx: ServiceContext,
  arn: string,
): StoredVpcConnector => {
  const vc = ctx.store.get<StoredVpcConnector>(`${vpcConnectorPrefix}${arn}`);
  if (vc === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `VpcConnector ${arn} not found.`,
      400,
    );
  }
  return vc;
};

const getVpcIngressByArn = (
  ctx: ServiceContext,
  arn: string,
): StoredVpcIngressConnection => {
  const vic = ctx.store.get<StoredVpcIngressConnection>(
    `${vpcIngressPrefix}${arn}`,
  );
  if (vic === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `VpcIngressConnection ${arn} not found.`,
      400,
    );
  }
  return vic;
};

const getServiceOperations = (
  ctx: ServiceContext,
  serviceArn: string,
): StoredOperation[] =>
  ctx.store.get<StoredOperation[]>(`${operationsPrefix}${serviceArn}`) ?? [];

const appendServiceOperation = (
  ctx: ServiceContext,
  serviceArn: string,
  op: StoredOperation,
): void => {
  const ops = getServiceOperations(ctx, serviceArn);
  ctx.store.set(`${operationsPrefix}${serviceArn}`, [...ops, op]);
};

const getCustomDomains = (
  ctx: ServiceContext,
  serviceArn: string,
): StoredCustomDomain[] =>
  ctx.store.get<StoredCustomDomain[]>(`${customDomainsPrefix}${serviceArn}`) ??
  [];

const setCustomDomains = (
  ctx: ServiceContext,
  serviceArn: string,
  domains: StoredCustomDomain[],
): void => {
  ctx.store.set(`${customDomainsPrefix}${serviceArn}`, domains);
};

const getTags = (
  ctx: ServiceContext,
  resourceArn: string,
): Record<string, string> =>
  ctx.store.get<Record<string, string>>(`${tagsPrefix}${resourceArn}`) ?? {};

const setTags = (
  ctx: ServiceContext,
  resourceArn: string,
  tags: Record<string, string>,
): void => {
  ctx.store.set(`${tagsPrefix}${resourceArn}`, tags);
};

const tagsToList = (
  tags: Record<string, string>,
): { Key: string; Value: string }[] =>
  Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));

const listToTags = (tagList: unknown[]): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const item of tagList) {
    const t = item as Record<string, unknown>;
    const k = stringOrUndefined(t["Key"]);
    const v = stringOrUndefined(t["Value"]);
    if (k !== undefined && v !== undefined) {
      result[k] = v;
    }
  }
  return result;
};

const updateAutoScalingAssociation = (
  ctx: ServiceContext,
  arn: string,
): void => {
  const cfg = ctx.store.get<StoredAutoScalingConfig>(
    `${autoScalingPrefix}${arn}`,
  );
  if (cfg === undefined) return;
  const inUse = ctx.store
    .list<StoredService>()
    .filter((e) => e.key.startsWith(servicePrefix))
    .some((e) => e.value.AutoScalingConfigurationArn === arn);
  ctx.store.set(`${autoScalingPrefix}${arn}`, {
    ...cfg,
    HasAssociatedService: inUse,
  });
};

const isConnectionUsedByService = (
  ctx: ServiceContext,
  connectionArn: string,
): boolean =>
  ctx.store
    .list<StoredService>()
    .filter((e) => e.key.startsWith(servicePrefix))
    .some((e) => {
      const src = e.value.SourceConfiguration;
      const codeRepo = src["CodeRepository"] as
        | Record<string, unknown>
        | undefined;
      const authCfg = (
        codeRepo?.["CodeConfiguration"] as Record<string, unknown> | undefined
      )?.["AuthenticationConfiguration"] as Record<string, unknown> | undefined;
      return authCfg?.["ConnectionArn"] === connectionArn;
    });

const isVpcConnectorUsedByService = (
  ctx: ServiceContext,
  vpcConnectorArn: string,
): boolean =>
  ctx.store
    .list<StoredService>()
    .filter((e) => e.key.startsWith(servicePrefix))
    .some((e) => {
      const network = e.value.NetworkConfiguration;
      const egress = network["EgressConfiguration"] as
        | Record<string, unknown>
        | undefined;
      return egress?.["VpcConnectorArn"] === vpcConnectorArn;
    });

const hasVpcIngressConnections = (
  ctx: ServiceContext,
  serviceArn: string,
): boolean =>
  ctx.store
    .list<StoredVpcIngressConnection>()
    .filter((e) => e.key.startsWith(vpcIngressPrefix))
    .some((e) => e.value.ServiceArn === serviceArn);

const CreateService: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ServiceName");
  const source = recordOrUndefined(input["SourceConfiguration"]);
  if (source === undefined) {
    throw awsError(
      "InvalidRequestException",
      "SourceConfiguration is required.",
      400,
    );
  }
  const inputAutoScalingArn = stringOrUndefined(
    input["AutoScalingConfigurationArn"],
  );
  if (inputAutoScalingArn !== undefined) {
    try {
      getAutoScalingByArn(ctx, inputAutoScalingArn);
    } catch {
      throw awsError(
        "InvalidRequestException",
        `AutoScalingConfigurationArn ${inputAutoScalingArn} is invalid.`,
        400,
      );
    }
  }
  const observabilityInput = recordOrUndefined(
    input["ObservabilityConfiguration"],
  );
  if (observabilityInput !== undefined) {
    const obsArn = stringOrUndefined(
      observabilityInput["ObservabilityConfigurationArn"],
    );
    if (obsArn !== undefined) {
      try {
        getObservabilityByArn(ctx, obsArn);
      } catch {
        throw awsError(
          "InvalidRequestException",
          `ObservabilityConfigurationArn ${obsArn} is invalid.`,
          400,
        );
      }
    }
  }
  const serviceId = crypto.randomUUID().replace(/-/g, "");
  const region = ctx.region;
  const arn = `arn:aws:apprunner:${region}:${ctx.account}:service/${name}/${serviceId}`;
  const autoScalingArn = `arn:aws:apprunner:${region}:${ctx.account}:autoscalingconfiguration/DefaultConfiguration/1/00000000000000000000000000000001`;
  const now = nowSeconds();
  const instance = recordOrUndefined(input["InstanceConfiguration"]) ?? {};
  const network = recordOrUndefined(input["NetworkConfiguration"]) ?? {};
  const service: StoredService = {
    ServiceName: name,
    ServiceId: serviceId,
    ServiceArn: arn,
    ServiceUrl: `${serviceId}.${region}.awsapprunner.com`,
    CreatedAt: now,
    UpdatedAt: now,
    Status: "RUNNING",
    SourceConfiguration: source,
    InstanceConfiguration: {
      Cpu: stringOrUndefined(instance["Cpu"]) ?? "1024",
      Memory: stringOrUndefined(instance["Memory"]) ?? "2048",
      InstanceRoleArn: stringOrUndefined(instance["InstanceRoleArn"]),
    },
    EncryptionConfiguration: recordOrUndefined(
      input["EncryptionConfiguration"],
    ),
    HealthCheckConfiguration: recordOrUndefined(
      input["HealthCheckConfiguration"],
    ),
    AutoScalingConfigurationSummary: {
      AutoScalingConfigurationArn:
        stringOrUndefined(input["AutoScalingConfigurationArn"]) ??
        autoScalingArn,
      AutoScalingConfigurationName: "DefaultConfiguration",
      AutoScalingConfigurationRevision: 1,
    },
    NetworkConfiguration: {
      EgressConfiguration: {
        EgressType:
          stringOrUndefined(
            recordOrUndefined(network["EgressConfiguration"])?.["EgressType"],
          ) ?? "DEFAULT",
      },
      IngressConfiguration: {
        IsPubliclyAccessible: true,
      },
      IpAddressType: stringOrUndefined(network["IpAddressType"]) ?? "IPV4",
    },
    ObservabilityConfiguration: recordOrUndefined(
      input["ObservabilityConfiguration"],
    ),
    AutoScalingConfigurationArn:
      stringOrUndefined(input["AutoScalingConfigurationArn"]) ?? autoScalingArn,
  };
  ctx.store.set(serviceKey(serviceId), service);
  const tagList = arrayOrEmpty(input["Tags"]);
  if (tagList.length > 0) {
    setTags(ctx, arn, listToTags(tagList));
  }
  updateAutoScalingAssociation(ctx, service.AutoScalingConfigurationArn);
  const opId = operationId();
  appendServiceOperation(ctx, arn, {
    Id: opId,
    Type: "CREATE_SERVICE",
    Status: "IN_PROGRESS",
    TargetArn: arn,
    StartedAt: now,
    EndedAt: undefined,
    UpdatedAt: now,
  });
  return {
    Service: { ...serviceView(service), Status: "OPERATION_IN_PROGRESS" },
    OperationId: opId,
  };
};

const DescribeService: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ServiceArn");
  const service = requireService(ctx, arn);
  return { Service: serviceView(service) };
};

const ListServices: OperationHandler = (input, ctx) => {
  const filterStatus = stringOrUndefined(input["Status"]);
  const all = ctx.store
    .list<StoredService>()
    .filter((entry) => entry.key.startsWith(servicePrefix))
    .map((entry) => entry.value)
    .filter((svc) =>
      filterStatus !== undefined
        ? svc.Status === filterStatus
        : svc.Status !== "DELETED",
    )
    .sort((a, b) =>
      a.ServiceName < b.ServiceName
        ? -1
        : a.ServiceName > b.ServiceName
          ? 1
          : 0,
    );
  const { items, NextToken } = paginate(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return {
    ServiceSummaryList: items.map(serviceSummary),
    NextToken,
  };
};

const DeleteService: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ServiceArn");
  const service = requireService(ctx, arn);
  if (service.Status === "OPERATION_IN_PROGRESS") {
    throw awsError(
      "InvalidStateException",
      `Service ${arn} is in OPERATION_IN_PROGRESS state and cannot be deleted.`,
      400,
    );
  }
  if (hasVpcIngressConnections(ctx, arn)) {
    throw awsError(
      "InvalidRequestException",
      `Service ${arn} has dependent VPC ingress connections and cannot be deleted.`,
      400,
    );
  }
  const deleted: StoredService = {
    ...service,
    Status: "DELETED",
    UpdatedAt: nowSeconds(),
  };
  const autoScalingArn = service.AutoScalingConfigurationArn;
  ctx.store.delete(serviceKey(service.ServiceId));
  ctx.store.delete(`${tagsPrefix}${arn}`);
  ctx.store.delete(`${operationsPrefix}${arn}`);
  ctx.store.delete(`${customDomainsPrefix}${arn}`);
  updateAutoScalingAssociation(ctx, autoScalingArn);
  return {
    Service: serviceView(deleted),
    OperationId: operationId(),
  };
};

const PauseService: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ServiceArn");
  const service = requireService(ctx, arn);
  if (service.Status !== "RUNNING") {
    throw awsError(
      "InvalidStateException",
      `Service ${arn} must be in RUNNING state to pause, but is ${service.Status}.`,
      400,
    );
  }
  const paused: StoredService = {
    ...service,
    Status: "PAUSED",
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(serviceKey(service.ServiceId), paused);
  return {
    Service: serviceView(paused),
    OperationId: operationId(),
  };
};

const ResumeService: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ServiceArn");
  const service = requireService(ctx, arn);
  if (service.Status !== "PAUSED") {
    throw awsError(
      "InvalidStateException",
      `Service ${arn} must be in PAUSED state to resume, but is ${service.Status}.`,
      400,
    );
  }
  const resumed: StoredService = {
    ...service,
    Status: "RUNNING",
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(serviceKey(service.ServiceId), resumed);
  return {
    Service: serviceView(resumed),
    OperationId: operationId(),
  };
};

const UpdateService: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ServiceArn");
  const service = requireService(ctx, arn);
  if (service.Status !== "RUNNING" && service.Status !== "PAUSED") {
    throw awsError(
      "InvalidStateException",
      `Service ${arn} must be in RUNNING or PAUSED state to update, but is ${service.Status}.`,
      400,
    );
  }
  const now = nowSeconds();
  const instance = recordOrUndefined(input["InstanceConfiguration"]);
  const network = recordOrUndefined(input["NetworkConfiguration"]);
  const newAutoScalingArn = stringOrUndefined(
    input["AutoScalingConfigurationArn"],
  );
  if (newAutoScalingArn !== undefined) {
    try {
      getAutoScalingByArn(ctx, newAutoScalingArn);
    } catch {
      throw awsError(
        "InvalidRequestException",
        `AutoScalingConfigurationArn ${newAutoScalingArn} is invalid.`,
        400,
      );
    }
  }
  const newObservabilityInput = recordOrUndefined(
    input["ObservabilityConfiguration"],
  );
  if (newObservabilityInput !== undefined) {
    const newObsArn = stringOrUndefined(
      newObservabilityInput["ObservabilityConfigurationArn"],
    );
    if (newObsArn !== undefined) {
      try {
        getObservabilityByArn(ctx, newObsArn);
      } catch {
        throw awsError(
          "InvalidRequestException",
          `ObservabilityConfigurationArn ${newObsArn} is invalid.`,
          400,
        );
      }
    }
  }
  const updated: StoredService = {
    ...service,
    UpdatedAt: now,
    SourceConfiguration:
      recordOrUndefined(input["SourceConfiguration"]) ??
      service.SourceConfiguration,
    InstanceConfiguration: instance
      ? {
          Cpu:
            stringOrUndefined(instance["Cpu"]) ??
            (service.InstanceConfiguration["Cpu"] as string),
          Memory:
            stringOrUndefined(instance["Memory"]) ??
            (service.InstanceConfiguration["Memory"] as string),
          InstanceRoleArn:
            stringOrUndefined(instance["InstanceRoleArn"]) ??
            (service.InstanceConfiguration["InstanceRoleArn"] as
              | string
              | undefined),
        }
      : service.InstanceConfiguration,
    HealthCheckConfiguration:
      recordOrUndefined(input["HealthCheckConfiguration"]) ??
      service.HealthCheckConfiguration,
    AutoScalingConfigurationSummary: newAutoScalingArn
      ? {
          AutoScalingConfigurationArn: newAutoScalingArn,
          AutoScalingConfigurationName: "DefaultConfiguration",
          AutoScalingConfigurationRevision: 1,
        }
      : service.AutoScalingConfigurationSummary,
    AutoScalingConfigurationArn:
      newAutoScalingArn ?? service.AutoScalingConfigurationArn,
    NetworkConfiguration: network
      ? {
          EgressConfiguration: {
            EgressType:
              stringOrUndefined(
                recordOrUndefined(network["EgressConfiguration"])?.[
                  "EgressType"
                ],
              ) ?? "DEFAULT",
          },
          IngressConfiguration: {
            IsPubliclyAccessible: true,
          },
          IpAddressType: stringOrUndefined(network["IpAddressType"]) ?? "IPV4",
        }
      : service.NetworkConfiguration,
    ObservabilityConfiguration:
      recordOrUndefined(input["ObservabilityConfiguration"]) ??
      service.ObservabilityConfiguration,
  };
  ctx.store.set(serviceKey(service.ServiceId), updated);
  if (
    newAutoScalingArn &&
    newAutoScalingArn !== service.AutoScalingConfigurationArn
  ) {
    updateAutoScalingAssociation(ctx, service.AutoScalingConfigurationArn);
    updateAutoScalingAssociation(ctx, newAutoScalingArn);
  }
  const opId = operationId();
  appendServiceOperation(ctx, arn, {
    Id: opId,
    Type: "UPDATE_SERVICE",
    Status: "IN_PROGRESS",
    TargetArn: arn,
    StartedAt: now,
    EndedAt: undefined,
    UpdatedAt: now,
  });
  return {
    Service: serviceView(updated),
    OperationId: opId,
  };
};

const StartDeployment: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ServiceArn");
  const service = requireService(ctx, arn);
  if (service.Status !== "RUNNING") {
    throw awsError(
      "InvalidStateException",
      `Service ${arn} must be in RUNNING state to start deployment, but is ${service.Status}.`,
      400,
    );
  }
  const now = nowSeconds();
  const opId = operationId();
  appendServiceOperation(ctx, arn, {
    Id: opId,
    Type: "START_DEPLOYMENT",
    Status: "IN_PROGRESS",
    TargetArn: arn,
    StartedAt: now,
    EndedAt: undefined,
    UpdatedAt: now,
  });
  return { OperationId: opId };
};

const ListOperations: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ServiceArn");
  requireService(ctx, arn);
  const ops = getServiceOperations(ctx, arn);
  const summaries = ops.map((op) => ({
    Id: op.Id,
    Type: op.Type,
    Status: op.Status,
    TargetArn: op.TargetArn,
    StartedAt: op.StartedAt,
    EndedAt: op.EndedAt,
    UpdatedAt: op.UpdatedAt,
  }));
  const { items, NextToken } = paginate(
    summaries,
    input["MaxResults"],
    input["NextToken"],
  );
  return { OperationSummaryList: items, NextToken };
};

const CreateAutoScalingConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AutoScalingConfigurationName");
  const region = ctx.region;
  const existing = ctx.store
    .list<StoredAutoScalingConfig>()
    .filter((entry) => entry.key.startsWith(autoScalingPrefix))
    .map((entry) => entry.value)
    .filter((cfg) => cfg.AutoScalingConfigurationName === name);
  for (const cfg of existing) {
    if (cfg.Latest) {
      ctx.store.set(`${autoScalingPrefix}${cfg.AutoScalingConfigurationArn}`, {
        ...cfg,
        Latest: false,
      });
    }
  }
  const rev =
    existing.length > 0
      ? Math.max(
          ...existing.map((cfg) => cfg.AutoScalingConfigurationRevision),
        ) + 1
      : 1;
  const id = crypto.randomUUID().replace(/-/g, "");
  const arn = `arn:aws:apprunner:${region}:${ctx.account}:autoscalingconfiguration/${name}/${rev}/${id}`;
  const now = nowSeconds();
  const cfg: StoredAutoScalingConfig = {
    AutoScalingConfigurationArn: arn,
    AutoScalingConfigurationName: name,
    AutoScalingConfigurationRevision: rev,
    Latest: true,
    Status: "ACTIVE",
    MaxConcurrency:
      typeof input["MaxConcurrency"] === "number"
        ? input["MaxConcurrency"]
        : 100,
    MinSize: typeof input["MinSize"] === "number" ? input["MinSize"] : 1,
    MaxSize: typeof input["MaxSize"] === "number" ? input["MaxSize"] : 25,
    CreatedAt: now,
    DeletedAt: undefined,
    HasAssociatedService: false,
    IsDefault: false,
  };
  ctx.store.set(`${autoScalingPrefix}${arn}`, cfg);
  const tagList = arrayOrEmpty(input["Tags"]);
  if (tagList.length > 0) {
    setTags(ctx, arn, listToTags(tagList));
  }
  return { AutoScalingConfiguration: autoScalingView(cfg) };
};

const DeleteAutoScalingConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AutoScalingConfigurationArn");
  const cfg = getAutoScalingByArn(ctx, arn);
  if (cfg.HasAssociatedService) {
    throw awsError(
      "InvalidRequestException",
      `AutoScalingConfiguration ${arn} is associated with a service and cannot be deleted.`,
      400,
    );
  }
  const deleted: StoredAutoScalingConfig = {
    ...cfg,
    Status: "INACTIVE",
    DeletedAt: nowSeconds(),
  };
  ctx.store.delete(`${autoScalingPrefix}${arn}`);
  ctx.store.delete(`${tagsPrefix}${arn}`);
  return { AutoScalingConfiguration: autoScalingView(deleted) };
};

const DescribeAutoScalingConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AutoScalingConfigurationArn");
  const cfg = getAutoScalingByArn(ctx, arn);
  return { AutoScalingConfiguration: autoScalingView(cfg) };
};

const ListAutoScalingConfigurations: OperationHandler = (input, ctx) => {
  const filterName = stringOrUndefined(input["AutoScalingConfigurationName"]);
  const latestOnly = input["LatestOnly"] !== false;
  const all = ctx.store
    .list<StoredAutoScalingConfig>()
    .filter((entry) => entry.key.startsWith(autoScalingPrefix))
    .map((entry) => entry.value)
    .filter(
      (cfg) =>
        filterName === undefined ||
        cfg.AutoScalingConfigurationName === filterName,
    )
    .filter((cfg) => !latestOnly || cfg.Latest);
  const { items, NextToken } = paginate(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return {
    AutoScalingConfigurationSummaryList: items.map(autoScalingSummary),
    NextToken,
  };
};

const UpdateDefaultAutoScalingConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const arn = requireString(input, "AutoScalingConfigurationArn");
  const cfg = getAutoScalingByArn(ctx, arn);
  const all = ctx.store
    .list<StoredAutoScalingConfig>()
    .filter((entry) => entry.key.startsWith(autoScalingPrefix))
    .map((entry) => entry);
  for (const entry of all) {
    if (entry.value.IsDefault) {
      ctx.store.set(entry.key, { ...entry.value, IsDefault: false });
    }
  }
  const updated: StoredAutoScalingConfig = { ...cfg, IsDefault: true };
  ctx.store.set(`${autoScalingPrefix}${arn}`, updated);
  return { AutoScalingConfiguration: autoScalingView(updated) };
};

const ListServicesForAutoScalingConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const arn = requireString(input, "AutoScalingConfigurationArn");
  getAutoScalingByArn(ctx, arn);
  const all = ctx.store
    .list<StoredService>()
    .filter((entry) => entry.key.startsWith(servicePrefix))
    .map((entry) => entry.value)
    .filter((svc) => svc.AutoScalingConfigurationArn === arn)
    .map((svc) => svc.ServiceArn);
  const { items, NextToken } = paginate(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { ServiceArnList: items, NextToken };
};

const CreateConnection: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ConnectionName");
  const providerType = requireString(input, "ProviderType");
  const region = ctx.region;
  const id = crypto.randomUUID().replace(/-/g, "");
  const arn = `arn:aws:apprunner:${region}:${ctx.account}:connection/${name}/${id}`;
  const now = nowSeconds();
  const conn: StoredConnection = {
    ConnectionName: name,
    ConnectionArn: arn,
    ProviderType: providerType,
    Status: "AVAILABLE",
    CreatedAt: now,
  };
  ctx.store.set(`${connectionPrefix}${arn}`, conn);
  const tagList = arrayOrEmpty(input["Tags"]);
  if (tagList.length > 0) {
    setTags(ctx, arn, listToTags(tagList));
  }
  return { Connection: connectionView(conn) };
};

const DeleteConnection: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ConnectionArn");
  const conn = getConnectionByArn(ctx, arn);
  if (isConnectionUsedByService(ctx, arn)) {
    throw awsError(
      "InvalidRequestException",
      `Connection ${arn} is used by a service and cannot be deleted.`,
      400,
    );
  }
  const deleted: StoredConnection = { ...conn, Status: "DELETED" };
  ctx.store.delete(`${connectionPrefix}${arn}`);
  ctx.store.delete(`${tagsPrefix}${arn}`);
  return { Connection: connectionView(deleted) };
};

const ListConnections: OperationHandler = (input, ctx) => {
  const filterName = stringOrUndefined(input["ConnectionName"]);
  const all = ctx.store
    .list<StoredConnection>()
    .filter((entry) => entry.key.startsWith(connectionPrefix))
    .map((entry) => entry.value)
    .filter(
      (conn) => filterName === undefined || conn.ConnectionName === filterName,
    );
  const { items, NextToken } = paginate(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { ConnectionSummaryList: items.map(connectionView), NextToken };
};

const CreateObservabilityConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ObservabilityConfigurationName");
  const region = ctx.region;
  const existing = ctx.store
    .list<StoredObservabilityConfig>()
    .filter((entry) => entry.key.startsWith(observabilityPrefix))
    .map((entry) => entry.value)
    .filter((cfg) => cfg.ObservabilityConfigurationName === name);
  for (const cfg of existing) {
    if (cfg.Latest) {
      ctx.store.set(
        `${observabilityPrefix}${cfg.ObservabilityConfigurationArn}`,
        { ...cfg, Latest: false },
      );
    }
  }
  const rev =
    existing.length > 0
      ? Math.max(
          ...existing.map((cfg) => cfg.ObservabilityConfigurationRevision),
        ) + 1
      : 1;
  const id = crypto.randomUUID().replace(/-/g, "");
  const arn = `arn:aws:apprunner:${region}:${ctx.account}:observabilityconfiguration/${name}/${rev}/${id}`;
  const now = nowSeconds();
  const cfg: StoredObservabilityConfig = {
    ObservabilityConfigurationArn: arn,
    ObservabilityConfigurationName: name,
    ObservabilityConfigurationRevision: rev,
    Latest: true,
    Status: "ACTIVE",
    TraceConfiguration: recordOrUndefined(input["TraceConfiguration"]),
    CreatedAt: now,
    DeletedAt: undefined,
  };
  ctx.store.set(`${observabilityPrefix}${arn}`, cfg);
  const tagList = arrayOrEmpty(input["Tags"]);
  if (tagList.length > 0) {
    setTags(ctx, arn, listToTags(tagList));
  }
  return { ObservabilityConfiguration: observabilityView(cfg) };
};

const DeleteObservabilityConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ObservabilityConfigurationArn");
  const cfg = getObservabilityByArn(ctx, arn);
  const deleted: StoredObservabilityConfig = {
    ...cfg,
    Status: "INACTIVE",
    DeletedAt: nowSeconds(),
  };
  ctx.store.delete(`${observabilityPrefix}${arn}`);
  ctx.store.delete(`${tagsPrefix}${arn}`);
  return { ObservabilityConfiguration: observabilityView(deleted) };
};

const DescribeObservabilityConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ObservabilityConfigurationArn");
  const cfg = getObservabilityByArn(ctx, arn);
  return { ObservabilityConfiguration: observabilityView(cfg) };
};

const ListObservabilityConfigurations: OperationHandler = (input, ctx) => {
  const filterName = stringOrUndefined(input["ObservabilityConfigurationName"]);
  const latestOnly = input["LatestOnly"] !== false;
  const all = ctx.store
    .list<StoredObservabilityConfig>()
    .filter((entry) => entry.key.startsWith(observabilityPrefix))
    .map((entry) => entry.value)
    .filter(
      (cfg) =>
        filterName === undefined ||
        cfg.ObservabilityConfigurationName === filterName,
    )
    .filter((cfg) => !latestOnly || cfg.Latest);
  const { items, NextToken } = paginate(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return {
    ObservabilityConfigurationSummaryList: items.map(observabilitySummary),
    NextToken,
  };
};

const CreateVpcConnector: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VpcConnectorName");
  const subnets = arrayOrEmpty(input["Subnets"]).filter(
    (s): s is string => typeof s === "string",
  );
  const secGroups = arrayOrEmpty(input["SecurityGroups"]).filter(
    (s): s is string => typeof s === "string",
  );
  const region = ctx.region;
  const existing = ctx.store
    .list<StoredVpcConnector>()
    .filter((entry) => entry.key.startsWith(vpcConnectorPrefix))
    .map((entry) => entry.value)
    .filter((vc) => vc.VpcConnectorName === name);
  const rev =
    existing.length > 0
      ? Math.max(...existing.map((vc) => vc.VpcConnectorRevision)) + 1
      : 1;
  const id = crypto.randomUUID().replace(/-/g, "");
  const arn = `arn:aws:apprunner:${region}:${ctx.account}:vpcconnector/${name}/${rev}/${id}`;
  const now = nowSeconds();
  const vc: StoredVpcConnector = {
    VpcConnectorName: name,
    VpcConnectorArn: arn,
    VpcConnectorRevision: rev,
    Subnets: subnets,
    SecurityGroups: secGroups,
    Status: "ACTIVE",
    CreatedAt: now,
    DeletedAt: undefined,
  };
  ctx.store.set(`${vpcConnectorPrefix}${arn}`, vc);
  const tagList = arrayOrEmpty(input["Tags"]);
  if (tagList.length > 0) {
    setTags(ctx, arn, listToTags(tagList));
  }
  return { VpcConnector: vpcConnectorView(vc) };
};

const DeleteVpcConnector: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "VpcConnectorArn");
  const vc = getVpcConnectorByArn(ctx, arn);
  if (isVpcConnectorUsedByService(ctx, arn)) {
    throw awsError(
      "InvalidRequestException",
      `VpcConnector ${arn} is used by a service and cannot be deleted.`,
      400,
    );
  }
  const deleted: StoredVpcConnector = {
    ...vc,
    Status: "INACTIVE",
    DeletedAt: nowSeconds(),
  };
  ctx.store.delete(`${vpcConnectorPrefix}${arn}`);
  ctx.store.delete(`${tagsPrefix}${arn}`);
  return { VpcConnector: vpcConnectorView(deleted) };
};

const DescribeVpcConnector: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "VpcConnectorArn");
  const vc = getVpcConnectorByArn(ctx, arn);
  return { VpcConnector: vpcConnectorView(vc) };
};

const ListVpcConnectors: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredVpcConnector>()
    .filter((entry) => entry.key.startsWith(vpcConnectorPrefix))
    .map((entry) => entry.value);
  const { items, NextToken } = paginate(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { VpcConnectors: items.map(vpcConnectorView), NextToken };
};

const CreateVpcIngressConnection: OperationHandler = (input, ctx) => {
  const serviceArn = requireString(input, "ServiceArn");
  requireService(ctx, serviceArn);
  const name = requireString(input, "VpcIngressConnectionName");
  const ingressVpc = recordOrUndefined(input["IngressVpcConfiguration"]) ?? {};
  const region = ctx.region;
  const id = crypto.randomUUID().replace(/-/g, "");
  const arn = `arn:aws:apprunner:${region}:${ctx.account}:vpcingressconnection/${name}/${id}`;
  const now = nowSeconds();
  const vic: StoredVpcIngressConnection = {
    VpcIngressConnectionArn: arn,
    VpcIngressConnectionName: name,
    ServiceArn: serviceArn,
    Status: "AVAILABLE",
    AccountId: ctx.account,
    DomainName: `${id}.${region}.awsapprunner.com`,
    IngressVpcConfiguration: ingressVpc,
    CreatedAt: now,
    DeletedAt: undefined,
  };
  ctx.store.set(`${vpcIngressPrefix}${arn}`, vic);
  const tagList = arrayOrEmpty(input["Tags"]);
  if (tagList.length > 0) {
    setTags(ctx, arn, listToTags(tagList));
  }
  return {
    VpcIngressConnection: {
      ...vpcIngressView(vic),
      Status: "PENDING_CREATION",
    },
  };
};

const DeleteVpcIngressConnection: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "VpcIngressConnectionArn");
  const vic = getVpcIngressByArn(ctx, arn);
  ctx.store.delete(`${vpcIngressPrefix}${arn}`);
  ctx.store.delete(`${tagsPrefix}${arn}`);
  return {
    VpcIngressConnection: {
      ...vpcIngressView(vic),
      Status: "PENDING_DELETION",
      DeletedAt: nowSeconds(),
    },
  };
};

const DescribeVpcIngressConnection: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "VpcIngressConnectionArn");
  const vic = getVpcIngressByArn(ctx, arn);
  return { VpcIngressConnection: vpcIngressView(vic) };
};

const ListVpcIngressConnections: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredVpcIngressConnection>()
    .filter((entry) => entry.key.startsWith(vpcIngressPrefix))
    .map((entry) => entry.value);
  const { items, NextToken } = paginate(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return {
    VpcIngressConnectionSummaryList: items.map(vpcIngressSummary),
    NextToken,
  };
};

const UpdateVpcIngressConnection: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "VpcIngressConnectionArn");
  const vic = getVpcIngressByArn(ctx, arn);
  const ingressVpc =
    recordOrUndefined(input["IngressVpcConfiguration"]) ??
    vic.IngressVpcConfiguration;
  const updated: StoredVpcIngressConnection = {
    ...vic,
    IngressVpcConfiguration: ingressVpc,
  };
  ctx.store.set(`${vpcIngressPrefix}${arn}`, updated);
  return { VpcIngressConnection: vpcIngressView(updated) };
};

const AssociateCustomDomain: OperationHandler = (input, ctx) => {
  const serviceArn = requireString(input, "ServiceArn");
  const service = requireService(ctx, serviceArn);
  const domainName = requireString(input, "DomainName");
  const enableWWW =
    typeof input["EnableWWWSubdomain"] === "boolean"
      ? input["EnableWWWSubdomain"]
      : true;
  const domains = getCustomDomains(ctx, serviceArn);
  const exists = domains.find((d) => d.DomainName === domainName);
  if (exists !== undefined) {
    throw awsError(
      "InvalidRequestException",
      `Custom domain ${domainName} is already associated.`,
      400,
    );
  }
  const newDomain: StoredCustomDomain = {
    DomainName: domainName,
    EnableWWWSubdomain: enableWWW as boolean,
    Status: "ACTIVE",
  };
  setCustomDomains(ctx, serviceArn, [...domains, newDomain]);
  return {
    DNSTarget: service.ServiceUrl,
    ServiceArn: serviceArn,
    CustomDomain: {
      DomainName: newDomain.DomainName,
      EnableWWWSubdomain: newDomain.EnableWWWSubdomain,
      CertificateValidationRecords: [],
      Status: "CREATING",
    },
    VpcDNSTargets: [],
  };
};

const DescribeCustomDomains: OperationHandler = (input, ctx) => {
  const serviceArn = requireString(input, "ServiceArn");
  const service = requireService(ctx, serviceArn);
  const domains = getCustomDomains(ctx, serviceArn);
  return {
    DNSTarget: service.ServiceUrl,
    ServiceArn: serviceArn,
    CustomDomains: domains.map((d) => ({
      DomainName: d.DomainName,
      EnableWWWSubdomain: d.EnableWWWSubdomain,
      CertificateValidationRecords: [],
      Status: d.Status,
    })),
    VpcDNSTargets: [],
  };
};

const DisassociateCustomDomain: OperationHandler = (input, ctx) => {
  const serviceArn = requireString(input, "ServiceArn");
  const service = requireService(ctx, serviceArn);
  const domainName = requireString(input, "DomainName");
  const domains = getCustomDomains(ctx, serviceArn);
  const idx = domains.findIndex((d) => d.DomainName === domainName);
  if (idx === -1) {
    throw awsError(
      "ResourceNotFoundException",
      `Custom domain ${domainName} not found.`,
      400,
    );
  }
  const removed = domains[idx];
  setCustomDomains(
    ctx,
    serviceArn,
    domains.filter((_, i) => i !== idx),
  );
  return {
    DNSTarget: service.ServiceUrl,
    ServiceArn: serviceArn,
    CustomDomain: {
      DomainName: removed.DomainName,
      EnableWWWSubdomain: removed.EnableWWWSubdomain,
      CertificateValidationRecords: [],
      Status: "DELETING",
    },
    VpcDNSTargets: [],
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tagList = arrayOrEmpty(input["Tags"]);
  const existing = getTags(ctx, resourceArn);
  setTags(ctx, resourceArn, { ...existing, ...listToTags(tagList) });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const keys = arrayOrEmpty(input["TagKeys"]).filter(
    (k): k is string => typeof k === "string",
  );
  const existing = getTags(ctx, resourceArn);
  const updated = { ...existing };
  for (const key of keys) {
    delete updated[key];
  }
  setTags(ctx, resourceArn, updated);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tags = getTags(ctx, resourceArn);
  return { Tags: tagsToList(tags) };
};

const apprunner = {
  name: "apprunner",
  protocol: "json",
  operations: {
    CreateService,
    DescribeService,
    ListServices,
    DeleteService,
    PauseService,
    ResumeService,
    UpdateService,
    StartDeployment,
    ListOperations,
    CreateAutoScalingConfiguration,
    DeleteAutoScalingConfiguration,
    DescribeAutoScalingConfiguration,
    ListAutoScalingConfigurations,
    UpdateDefaultAutoScalingConfiguration,
    ListServicesForAutoScalingConfiguration,
    CreateConnection,
    DeleteConnection,
    ListConnections,
    CreateObservabilityConfiguration,
    DeleteObservabilityConfiguration,
    DescribeObservabilityConfiguration,
    ListObservabilityConfigurations,
    CreateVpcConnector,
    DeleteVpcConnector,
    DescribeVpcConnector,
    ListVpcConnectors,
    CreateVpcIngressConnection,
    DeleteVpcIngressConnection,
    DescribeVpcIngressConnection,
    ListVpcIngressConnections,
    UpdateVpcIngressConnection,
    AssociateCustomDomain,
    DescribeCustomDomains,
    DisassociateCustomDomain,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default apprunner;
