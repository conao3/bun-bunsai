import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import apprunnerModel from "../../../../test/vendor/aws-models/apprunner.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(apprunnerModel);

const servicePrefix = "service:" as const;

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
  Tags: unknown[];
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
    Tags: arrayOrEmpty(input["Tags"]),
  };
  ctx.store.set(serviceKey(serviceId), service);
  return {
    Service: serviceView(service),
    OperationId: operationId(),
  };
};

const DescribeService: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ServiceArn");
  const service = requireService(ctx, arn);
  return { Service: serviceView(service) };
};

const ListServices: OperationHandler = (_input, ctx) => {
  const services = ctx.store
    .list<StoredService>()
    .filter((entry) => entry.key.startsWith(servicePrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.ServiceName < b.ServiceName
        ? -1
        : a.ServiceName > b.ServiceName
          ? 1
          : 0,
    );
  return { ServiceSummaryList: services.map(serviceSummary) };
};

const DeleteService: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ServiceArn");
  const service = requireService(ctx, arn);
  const deleted: StoredService = {
    ...service,
    Status: "DELETED",
    UpdatedAt: nowSeconds(),
  };
  ctx.store.delete(serviceKey(service.ServiceId));
  return {
    Service: serviceView(deleted),
    OperationId: operationId(),
  };
};

const PauseService: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ServiceArn");
  const service = requireService(ctx, arn);
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
  },
  model,
} as const satisfies ServiceDefinition;

export default apprunner;
