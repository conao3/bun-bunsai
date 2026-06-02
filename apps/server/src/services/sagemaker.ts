import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import sagemakerModel from "../../../../test/vendor/aws-models/sagemaker.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(sagemakerModel);

type StoredModel = {
  ModelName: string;
  ModelArn: string;
  PrimaryContainer?: unknown;
  Containers?: unknown;
  InferenceExecutionConfig?: unknown;
  ExecutionRoleArn?: string;
  VpcConfig?: unknown;
  EnableNetworkIsolation?: boolean;
  CreationTime: number;
};

type StoredEndpointConfig = {
  EndpointConfigName: string;
  EndpointConfigArn: string;
  ProductionVariants?: unknown;
  CreationTime: number;
};

type StoredEndpoint = {
  EndpointName: string;
  EndpointArn: string;
  EndpointConfigName: string;
  EndpointStatus: string;
  ProductionVariants?: unknown;
  CreationTime: number;
  LastModifiedTime: number;
};

const modelKey = (name: string): string => `model/${name}`;

const configKey = (name: string): string => `endpoint-config/${name}`;

const endpointKey = (name: string): string => `endpoint/${name}`;

const modelArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:model/${name}`;

const configArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:endpoint-config/${name}`;

const endpointArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:endpoint/${name}`;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return value;
};

const CreateModel: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelName");
  const existing = ctx.store.get<StoredModel>(modelKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create Model ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = modelArnOf(ctx.region, ctx.account, name);
  const stored: StoredModel = {
    ModelName: name,
    ModelArn: arn,
    PrimaryContainer: input["PrimaryContainer"],
    Containers: input["Containers"],
    InferenceExecutionConfig: input["InferenceExecutionConfig"],
    ExecutionRoleArn:
      typeof input["ExecutionRoleArn"] === "string"
        ? (input["ExecutionRoleArn"] as string)
        : undefined,
    VpcConfig: input["VpcConfig"],
    EnableNetworkIsolation:
      typeof input["EnableNetworkIsolation"] === "boolean"
        ? (input["EnableNetworkIsolation"] as boolean)
        : undefined,
    CreationTime: nowSeconds(),
  };
  ctx.store.set(modelKey(name), stored);
  return { ModelArn: arn };
};

const requireModel = (ctx: ServiceContext, name: string): StoredModel => {
  const stored = ctx.store.get<StoredModel>(modelKey(name));
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find model "${name}".`,
      400,
    );
  }
  return stored;
};

const DescribeModel: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelName");
  const stored = requireModel(ctx, name);
  return {
    ModelName: stored.ModelName,
    PrimaryContainer: stored.PrimaryContainer,
    Containers: stored.Containers,
    InferenceExecutionConfig: stored.InferenceExecutionConfig,
    ExecutionRoleArn: stored.ExecutionRoleArn,
    VpcConfig: stored.VpcConfig,
    EnableNetworkIsolation: stored.EnableNetworkIsolation,
    CreationTime: stored.CreationTime,
    ModelArn: stored.ModelArn,
  };
};

const ListModels: OperationHandler = (_input, ctx) => {
  const models = ctx.store
    .list<StoredModel>()
    .filter((entry) => entry.key.startsWith("model/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.ModelName.localeCompare(b.ModelName));
  return {
    Models: models.map((stored) => ({
      ModelName: stored.ModelName,
      ModelArn: stored.ModelArn,
      CreationTime: stored.CreationTime,
    })),
  };
};

const DeleteModel: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelName");
  requireModel(ctx, name);
  ctx.store.delete(modelKey(name));
  return {};
};

const CreateEndpointConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointConfigName");
  const existing = ctx.store.get<StoredEndpointConfig>(configKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create EndpointConfig ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = configArnOf(ctx.region, ctx.account, name);
  const stored: StoredEndpointConfig = {
    EndpointConfigName: name,
    EndpointConfigArn: arn,
    ProductionVariants: input["ProductionVariants"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(configKey(name), stored);
  return { EndpointConfigArn: arn };
};

const CreateEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointName");
  const configName = requireString(input, "EndpointConfigName");
  const config = ctx.store.get<StoredEndpointConfig>(configKey(configName));
  if (config === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find endpoint configuration "${configName}".`,
      400,
    );
  }
  const existing = ctx.store.get<StoredEndpoint>(endpointKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create Endpoint ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = endpointArnOf(ctx.region, ctx.account, name);
  const at = nowSeconds();
  const stored: StoredEndpoint = {
    EndpointName: name,
    EndpointArn: arn,
    EndpointConfigName: configName,
    EndpointStatus: "InService",
    ProductionVariants: config.ProductionVariants,
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(endpointKey(name), stored);
  return { EndpointArn: arn };
};

const DescribeEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointName");
  const stored = ctx.store.get<StoredEndpoint>(endpointKey(name));
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find endpoint "${name}".`,
      400,
    );
  }
  return {
    EndpointName: stored.EndpointName,
    EndpointArn: stored.EndpointArn,
    EndpointConfigName: stored.EndpointConfigName,
    ProductionVariants: stored.ProductionVariants,
    EndpointStatus: stored.EndpointStatus,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const ListEndpoints: OperationHandler = (_input, ctx) => {
  const endpoints = ctx.store
    .list<StoredEndpoint>()
    .filter((entry) => entry.key.startsWith("endpoint/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.EndpointName.localeCompare(b.EndpointName));
  return {
    Endpoints: endpoints.map((stored) => ({
      EndpointName: stored.EndpointName,
      EndpointArn: stored.EndpointArn,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
      EndpointStatus: stored.EndpointStatus,
    })),
  };
};

const sagemaker = {
  name: "sagemaker",
  protocol: "json",
  operations: {
    CreateModel,
    DescribeModel,
    ListModels,
    DeleteModel,
    CreateEndpointConfig,
    CreateEndpoint,
    DescribeEndpoint,
    ListEndpoints,
  },
  model,
} as const satisfies ServiceDefinition;

export default sagemaker;
