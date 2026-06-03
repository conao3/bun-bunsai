import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import storagegatewayModel from "../../../../test/vendor/aws-models/storagegateway.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(storagegatewayModel);

type StoredGateway = {
  GatewayId: string;
  GatewayARN: string;
  GatewayName: string;
  GatewayTimezone: string;
  GatewayRegion: string;
  GatewayType: string;
  GatewayState: string;
  GatewayOperationalState: string;
  HostEnvironment: string;
  Tags: unknown[];
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? (value as unknown[]) : [];

const hex12 = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value === "string" && value !== "") return value;
  throw awsError("InvalidGatewayRequestException", `${key} is required.`, 400);
};

const gatewayKey = (arn: string): string => {
  const index = arn.lastIndexOf("/");
  return index === -1 ? arn : arn.slice(index + 1);
};

const requireGateway = (ctx: ServiceContext, arn: string): StoredGateway => {
  const gateway = ctx.store.get<StoredGateway>(gatewayKey(arn));
  if (gateway === undefined) {
    throw awsError(
      "InvalidGatewayRequestException",
      `Unknown gateway ${arn}.`,
      400,
    );
  }
  return gateway;
};

const ActivateGateway: OperationHandler = (input, ctx) => {
  const activationKey = requireString(input, "ActivationKey");
  void activationKey;
  const gatewayName = requireString(input, "GatewayName");
  const gatewayTimezone = requireString(input, "GatewayTimezone");
  const gatewayRegion = requireString(input, "GatewayRegion");
  const gatewayId = `sgw-${hex12().toUpperCase()}`;
  const arn = `arn:aws:storagegateway:${ctx.region}:${ctx.account}:gateway/${gatewayId}`;
  const gateway: StoredGateway = {
    GatewayId: gatewayId,
    GatewayARN: arn,
    GatewayName: gatewayName,
    GatewayTimezone: gatewayTimezone,
    GatewayRegion: gatewayRegion,
    GatewayType: stringOrUndefined(input["GatewayType"]) ?? "STORED",
    GatewayState: "RUNNING",
    GatewayOperationalState: "ACTIVE",
    HostEnvironment: "OTHER",
    Tags: arrayOrEmpty(input["Tags"]),
  };
  ctx.store.set(gatewayId, gateway);
  return { GatewayARN: arn };
};

const ListGateways: OperationHandler = (_input, ctx) => {
  const gateways = ctx.store.list<StoredGateway>().map((entry) => ({
    GatewayId: entry.value.GatewayId,
    GatewayARN: entry.value.GatewayARN,
    GatewayType: entry.value.GatewayType,
    GatewayOperationalState: entry.value.GatewayOperationalState,
    GatewayName: entry.value.GatewayName,
    HostEnvironment: entry.value.HostEnvironment,
  }));
  return { Gateways: gateways };
};

const DescribeGatewayInformation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  return {
    GatewayARN: gateway.GatewayARN,
    GatewayId: gateway.GatewayId,
    GatewayName: gateway.GatewayName,
    GatewayTimezone: gateway.GatewayTimezone,
    GatewayState: gateway.GatewayState,
    GatewayNetworkInterfaces: [],
    GatewayType: gateway.GatewayType,
    HostEnvironment: gateway.HostEnvironment,
    Tags: gateway.Tags,
  };
};

const DeleteGateway: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GatewayARN");
  const gateway = requireGateway(ctx, arn);
  ctx.store.delete(gateway.GatewayId);
  return { GatewayARN: gateway.GatewayARN };
};

const storagegateway: ServiceDefinition = {
  name: "storagegateway",
  protocol: "json",
  operations: {
    ActivateGateway,
    ListGateways,
    DescribeGatewayInformation,
    DeleteGateway,
  },
  model,
} as const;

export default storagegateway;
