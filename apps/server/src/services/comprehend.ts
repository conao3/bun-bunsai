import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import comprehendModel from "../../../../test/vendor/aws-models/comprehend.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(comprehendModel);

const endpointStatus = "IN_SERVICE" as const;

type StoredEndpoint = {
  EndpointArn: string;
  EndpointName: string;
  ModelArn: string | undefined;
  Status: string;
  DesiredInferenceUnits: number;
  CurrentInferenceUnits: number;
  DataAccessRoleArn: string | undefined;
  CreationTime: number;
  LastModifiedTime: number;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidRequestException", `${field} is required.`, 400);
  }
  return value;
};

const requireNumber = (
  input: Record<string, unknown>,
  field: string,
): number => {
  const value = input[field];
  if (typeof value !== "number") {
    throw awsError("InvalidRequestException", `${field} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const endpointArn = (region: string, account: string, name: string): string =>
  `arn:aws:comprehend:${region}:${account}:document-classifier-endpoint/${name}`;

const requireEndpoint = (ctx: ServiceContext, arn: string): StoredEndpoint => {
  const direct = ctx.store.get<StoredEndpoint>(arn);
  if (direct !== undefined) return direct;
  throw awsError(
    "ResourceNotFoundException",
    `Endpoint '${arn}' was not found.`,
    400,
  );
};

const endpointProperties = (
  endpoint: StoredEndpoint,
): Record<string, unknown> => ({
  EndpointArn: endpoint.EndpointArn,
  Status: endpoint.Status,
  ModelArn: endpoint.ModelArn,
  DesiredInferenceUnits: endpoint.DesiredInferenceUnits,
  CurrentInferenceUnits: endpoint.CurrentInferenceUnits,
  DataAccessRoleArn: endpoint.DataAccessRoleArn,
  CreationTime: endpoint.CreationTime,
  LastModifiedTime: endpoint.LastModifiedTime,
});

const CreateEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointName");
  const desired = requireNumber(input, "DesiredInferenceUnits");
  const modelArn = stringOrUndefined(input.ModelArn);
  const arn = endpointArn(ctx.region, ctx.account, name);
  const now = Date.now() / 1000;
  const endpoint: StoredEndpoint = {
    EndpointArn: arn,
    EndpointName: name,
    ModelArn: modelArn,
    Status: endpointStatus,
    DesiredInferenceUnits: desired,
    CurrentInferenceUnits: desired,
    DataAccessRoleArn: stringOrUndefined(input.DataAccessRoleArn),
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(arn, endpoint);
  return { EndpointArn: arn, ModelArn: modelArn };
};

const DescribeEndpoint: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointArn");
  const endpoint = requireEndpoint(ctx, arn);
  return { EndpointProperties: endpointProperties(endpoint) };
};

const ListEndpoints: OperationHandler = (_input, ctx) => {
  const endpoints = ctx.store
    .list<StoredEndpoint>()
    .map((entry) => endpointProperties(entry.value));
  return { EndpointPropertiesList: endpoints };
};

const DeleteEndpoint: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointArn");
  requireEndpoint(ctx, arn);
  ctx.store.delete(arn);
  return {};
};

const comprehend: ServiceDefinition = {
  name: "comprehend",
  protocol: "json",
  operations: {
    CreateEndpoint,
    DescribeEndpoint,
    ListEndpoints,
    DeleteEndpoint,
  },
  model,
} as const;

export default comprehend;
