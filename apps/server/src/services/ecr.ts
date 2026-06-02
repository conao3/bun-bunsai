import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ecrModel from "../../../../test/vendor/aws-models/ecr.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(ecrModel);

type StoredImage = {
  imageDigest: string;
  imageTag?: string;
  imageManifest: string;
  imageManifestMediaType?: string;
};

type StoredRepository = {
  repositoryName: string;
  repositoryArn: string;
  repositoryUri: string;
  registryId: string;
  createdAt: number;
  imageTagMutability: string;
  images: StoredImage[];
};

const repositoryArn = (region: string, account: string, name: string): string =>
  `arn:aws:ecr:${region}:${account}:repository/${name}`;

const repositoryUri = (region: string, account: string, name: string): string =>
  `${account}.dkr.ecr.${region}.amazonaws.com/${name}`;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidParameterException", `${field} is required.`, 400);
  }
  return value;
};

const requireRepository = (
  ctx: ServiceContext,
  name: string,
): StoredRepository => {
  const repository = ctx.store.get<StoredRepository>(name);
  if (repository === undefined) {
    throw awsError(
      "RepositoryNotFoundException",
      `The repository with name '${name}' does not exist in the registry with id '${ctx.account}'`,
      400,
    );
  }
  return repository;
};

const repositoryView = (
  repository: StoredRepository,
): Record<string, unknown> => ({
  repositoryArn: repository.repositoryArn,
  registryId: repository.registryId,
  repositoryName: repository.repositoryName,
  repositoryUri: repository.repositoryUri,
  createdAt: repository.createdAt,
  imageTagMutability: repository.imageTagMutability,
});

const asImageIdentifier = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const CreateRepository: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  if (ctx.store.get<StoredRepository>(name) !== undefined) {
    throw awsError(
      "RepositoryAlreadyExistsException",
      `The repository with name '${name}' already exists in the registry with id '${ctx.account}'`,
      400,
    );
  }
  const imageTagMutability =
    typeof input["imageTagMutability"] === "string"
      ? (input["imageTagMutability"] as string)
      : "MUTABLE";
  const repository: StoredRepository = {
    repositoryName: name,
    repositoryArn: repositoryArn(ctx.region, ctx.account, name),
    repositoryUri: repositoryUri(ctx.region, ctx.account, name),
    registryId: ctx.account,
    createdAt: Math.floor(Date.now() / 1000),
    imageTagMutability,
    images: [],
  };
  ctx.store.set(name, repository);
  return { repository: repositoryView(repository) };
};

const DescribeRepositories: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["repositoryNames"])
    ? (input["repositoryNames"] as string[])
    : [];
  const repositories =
    names.length > 0
      ? names.map((name) => requireRepository(ctx, name))
      : ctx.store.list<StoredRepository>().map((entry) => entry.value);
  return { repositories: repositories.map(repositoryView) };
};

const DeleteRepository: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  if (repository.images.length > 0 && input["force"] !== true) {
    throw awsError(
      "RepositoryNotEmptyException",
      `The repository with name '${name}' in registry with id '${ctx.account}' cannot be deleted because it still contains images`,
      400,
    );
  }
  ctx.store.delete(name);
  return { repository: repositoryView(repository) };
};

const ListImages: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  return {
    imageIds: repository.images.map((image) => ({
      imageDigest: image.imageDigest,
      ...(image.imageTag === undefined ? {} : { imageTag: image.imageTag }),
    })),
  };
};

const GetAuthorizationToken: OperationHandler = (input, ctx) => {
  const token = btoa(`AWS:${ctx.account}-bunsai`);
  return {
    authorizationData: [
      {
        authorizationToken: token,
        expiresAt: Math.floor(Date.now() / 1000) + 43200,
        proxyEndpoint: `https://${ctx.account}.dkr.ecr.${ctx.region}.amazonaws.com`,
      },
    ],
  };
};

const matchesIdentifier = (
  image: StoredImage,
  identifier: Record<string, unknown>,
): boolean => {
  const digest = identifier["imageDigest"];
  const tag = identifier["imageTag"];
  if (typeof digest === "string" && image.imageDigest !== digest) {
    return false;
  }
  if (typeof tag === "string" && image.imageTag !== tag) {
    return false;
  }
  return typeof digest === "string" || typeof tag === "string";
};

const BatchGetImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  const identifiers = Array.isArray(input["imageIds"])
    ? (input["imageIds"] as unknown[]).map(asImageIdentifier)
    : [];
  const images: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  for (const identifier of identifiers) {
    const found = repository.images.find((image) =>
      matchesIdentifier(image, identifier),
    );
    if (found === undefined) {
      failures.push({
        imageId: {
          ...(typeof identifier["imageDigest"] === "string"
            ? { imageDigest: identifier["imageDigest"] }
            : {}),
          ...(typeof identifier["imageTag"] === "string"
            ? { imageTag: identifier["imageTag"] }
            : {}),
        },
        failureCode: "ImageNotFound",
        failureReason: "Requested image not found",
      });
      continue;
    }
    images.push({
      registryId: repository.registryId,
      repositoryName: repository.repositoryName,
      imageId: {
        imageDigest: found.imageDigest,
        ...(found.imageTag === undefined ? {} : { imageTag: found.imageTag }),
      },
      imageManifest: found.imageManifest,
      ...(found.imageManifestMediaType === undefined
        ? {}
        : { imageManifestMediaType: found.imageManifestMediaType }),
    });
  }
  return { images, failures };
};

const ecr: ServiceDefinition = {
  name: "ecr",
  protocol: "json",
  operations: {
    CreateRepository,
    DescribeRepositories,
    DeleteRepository,
    ListImages,
    GetAuthorizationToken,
    BatchGetImage,
  },
  model,
} as const;

export default ecr;
