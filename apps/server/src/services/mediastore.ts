import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import mediastoreModel from "../../../../test/vendor/aws-models/mediastore.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(mediastoreModel);

type StoredContainer = {
  Name: string;
  ARN: string;
  Endpoint: string;
  Status: string;
  CreationTime: number;
  AccessLoggingEnabled: boolean;
};

const containerKey = (name: string): string => `container/${name}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const containerArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:mediastore:${ctx.region}:${ctx.account}:container/${name}`;

const containerEndpoint = (name: string): string =>
  `https://${name}.data.mediastore.amazonaws.com`;

const requireContainer = (
  ctx: ServiceContext,
  name: string,
): StoredContainer => {
  const container = ctx.store.get<StoredContainer>(containerKey(name));
  if (container === undefined) {
    throw awsError(
      "ContainerNotFoundException",
      `Container not found: ${name}`,
      400,
    );
  }
  return container;
};

const CreateContainer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  if (ctx.store.get<StoredContainer>(containerKey(name)) !== undefined) {
    throw awsError(
      "ContainerInUseException",
      `Container already exists: ${name}`,
      400,
    );
  }
  const container: StoredContainer = {
    Name: name,
    ARN: containerArn(ctx, name),
    Endpoint: containerEndpoint(name),
    Status: "ACTIVE",
    CreationTime: Math.floor(Date.now() / 1000),
    AccessLoggingEnabled: false,
  };
  ctx.store.set(containerKey(name), container);
  return { Container: container };
};

const DescribeContainer: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ContainerName"]);
  if (name === undefined) {
    throw awsError("ValidationException", "ContainerName is required.", 400);
  }
  const container = requireContainer(ctx, name);
  return { Container: container };
};

const ListContainers: OperationHandler = (_input, ctx) => {
  const containers = ctx.store
    .list<StoredContainer>()
    .filter((entry) => entry.key.startsWith("container/"))
    .map((entry) => entry.value);
  return { Containers: containers };
};

const DeleteContainer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  requireContainer(ctx, name);
  ctx.store.delete(containerKey(name));
  return {};
};

const mediastore = {
  name: "mediastore",
  protocol: "json",
  operations: {
    CreateContainer,
    DescribeContainer,
    ListContainers,
    DeleteContainer,
  },
  model,
} as const satisfies ServiceDefinition;

export default mediastore;
