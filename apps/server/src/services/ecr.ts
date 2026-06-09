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
  imagePushedAt: number;
  imageSizeInBytes: number;
  scanStatus?: { status: string; description?: string };
};

type StoredRepository = {
  repositoryName: string;
  repositoryArn: string;
  repositoryUri: string;
  registryId: string;
  createdAt: number;
  imageTagMutability: string;
  imageTagMutabilityExclusionFilters: unknown[];
  images: StoredImage[];
  lifecyclePolicy?: string;
  repositoryPolicy?: string;
  imageScanningConfiguration: { scanOnPush: boolean };
  encryptionConfiguration?: { encryptionType: string; kmsKey?: string };
  tags: { Key: string; Value: string }[];
};

type StoredLayerUpload = {
  repositoryName: string;
  uploadId: string;
  lastByteReceived: number;
};

type StoredLayer = {
  layerDigest: string;
  layerSize: number;
};

type StoredPullThroughCacheRule = {
  ecrRepositoryPrefix: string;
  upstreamRegistryUrl: string;
  createdAt: number;
  registryId: string;
  credentialArn?: string;
  customRoleArn?: string;
  upstreamRepositoryPrefix?: string;
  upstreamRegistry?: string;
  updatedAt: number;
};

type StoredRepositoryCreationTemplate = {
  prefix: string;
  description?: string;
  encryptionConfiguration?: unknown;
  resourceTags?: unknown[];
  imageTagMutability?: string;
  imageTagMutabilityExclusionFilters?: unknown[];
  repositoryPolicy?: string;
  lifecyclePolicy?: string;
  appliedFor: string[];
  customRoleArn?: string;
  createdAt: number;
  updatedAt: number;
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
  imageTagMutabilityExclusionFilters:
    repository.imageTagMutabilityExclusionFilters,
  imageScanningConfiguration: repository.imageScanningConfiguration,
  ...(repository.encryptionConfiguration !== undefined
    ? { encryptionConfiguration: repository.encryptionConfiguration }
    : {}),
});

const asImageIdentifier = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

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

const syntheticDigest = (content: string): string => {
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) + h + content.charCodeAt(i)) & 0xffffffff;
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return `sha256:${hex.repeat(8)}`;
};

const findRepositoryByArn = (
  ctx: ServiceContext,
  arn: string,
): StoredRepository | undefined =>
  ctx.store
    .list<StoredRepository>()
    .find((e) => !e.key.startsWith("_") && e.value.repositoryArn === arn)
    ?.value;

const templateView = (
  t: StoredRepositoryCreationTemplate,
): Record<string, unknown> => ({
  prefix: t.prefix,
  appliedFor: t.appliedFor,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
  ...(t.description !== undefined ? { description: t.description } : {}),
  ...(t.encryptionConfiguration !== undefined
    ? { encryptionConfiguration: t.encryptionConfiguration }
    : {}),
  ...(t.resourceTags !== undefined ? { resourceTags: t.resourceTags } : {}),
  ...(t.imageTagMutability !== undefined
    ? { imageTagMutability: t.imageTagMutability }
    : {}),
  ...(t.imageTagMutabilityExclusionFilters !== undefined
    ? {
        imageTagMutabilityExclusionFilters:
          t.imageTagMutabilityExclusionFilters,
      }
    : {}),
  ...(t.repositoryPolicy !== undefined
    ? { repositoryPolicy: t.repositoryPolicy }
    : {}),
  ...(t.lifecyclePolicy !== undefined
    ? { lifecyclePolicy: t.lifecyclePolicy }
    : {}),
  ...(t.customRoleArn !== undefined ? { customRoleArn: t.customRoleArn } : {}),
});

const REPOSITORY_NAME_PATTERN =
  /^(?:[a-z0-9]+(?:[._-][a-z0-9]+)*\/)*[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

const validateRepositoryName = (name: string): void => {
  if (
    name.length < 2 ||
    name.length > 256 ||
    !REPOSITORY_NAME_PATTERN.test(name)
  ) {
    throw awsError(
      "InvalidParameterException",
      `Invalid parameter at 'repositoryName' failed to satisfy constraint: '${name}'`,
      400,
    );
  }
};

const CreateRepository: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  validateRepositoryName(name);
  if (ctx.store.get<StoredRepository>(name) !== undefined) {
    throw awsError(
      "RepositoryAlreadyExistsException",
      `The repository with name '${name}' already exists in the registry with id '${ctx.account}'`,
      400,
    );
  }
  const imageTagMutabilityInput = input["imageTagMutability"];
  const imageTagMutability =
    typeof imageTagMutabilityInput === "string"
      ? imageTagMutabilityInput
      : "MUTABLE";
  if (
    imageTagMutability !== "MUTABLE" &&
    imageTagMutability !== "IMMUTABLE" &&
    imageTagMutability !== "IMMUTABLE_WITH_EXCLUSION" &&
    imageTagMutability !== "MUTABLE_WITH_EXCLUSION"
  ) {
    throw awsError(
      "InvalidParameterException",
      `Invalid imageTagMutability '${imageTagMutability}'. Must be MUTABLE, IMMUTABLE, MUTABLE_WITH_EXCLUSION, or IMMUTABLE_WITH_EXCLUSION.`,
      400,
    );
  }
  const imageTagMutabilityExclusionFilters = Array.isArray(
    input["imageTagMutabilityExclusionFilters"],
  )
    ? (input["imageTagMutabilityExclusionFilters"] as unknown[])
    : [];
  const scanningCfg =
    typeof input["imageScanningConfiguration"] === "object" &&
    input["imageScanningConfiguration"] !== null
      ? (input["imageScanningConfiguration"] as Record<string, unknown>)
      : {};
  const imageScanningConfiguration = {
    scanOnPush: scanningCfg["scanOnPush"] === true,
  };
  const encInput =
    typeof input["encryptionConfiguration"] === "object" &&
    input["encryptionConfiguration"] !== null
      ? (input["encryptionConfiguration"] as Record<string, unknown>)
      : undefined;
  if (
    encInput !== undefined &&
    typeof encInput["encryptionType"] === "string"
  ) {
    const et = encInput["encryptionType"] as string;
    if (et !== "AES256" && et !== "KMS" && et !== "KMS_DSSE") {
      throw awsError(
        "InvalidParameterException",
        `Invalid encryptionType '${et}'. Must be AES256, KMS, or KMS_DSSE.`,
        400,
      );
    }
  }
  const encryptionConfiguration =
    encInput !== undefined
      ? {
          encryptionType:
            typeof encInput["encryptionType"] === "string"
              ? (encInput["encryptionType"] as string)
              : "AES256",
          ...(typeof encInput["kmsKey"] === "string"
            ? { kmsKey: encInput["kmsKey"] as string }
            : {}),
        }
      : undefined;
  const tags = Array.isArray(input["tags"])
    ? (input["tags"] as { Key: string; Value: string }[])
    : [];
  const repository: StoredRepository = {
    repositoryName: name,
    repositoryArn: repositoryArn(ctx.region, ctx.account, name),
    repositoryUri: repositoryUri(ctx.region, ctx.account, name),
    registryId: ctx.account,
    createdAt: Math.floor(Date.now() / 1000),
    imageTagMutability,
    imageTagMutabilityExclusionFilters,
    images: [],
    imageScanningConfiguration,
    ...(encryptionConfiguration !== undefined
      ? { encryptionConfiguration }
      : {}),
    tags,
  };
  ctx.store.set(name, repository);
  return { repository: repositoryView(repository) };
};

const DescribeRepositories: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["repositoryNames"])
    ? (input["repositoryNames"] as string[])
    : [];
  const all =
    names.length > 0
      ? names.map((name) => requireRepository(ctx, name))
      : ctx.store
          .list<StoredRepository>()
          .filter((e) => !e.key.startsWith("_"))
          .map((e) => e.value);
  const offset =
    typeof input["nextToken"] === "string" && input["nextToken"] !== ""
      ? parseInt(atob(input["nextToken"] as string), 10) || 0
      : 0;
  const max =
    typeof input["maxResults"] === "number" &&
    (input["maxResults"] as number) > 0
      ? (input["maxResults"] as number)
      : all.length;
  const page = all.slice(offset, offset + max);
  const result: Record<string, unknown> = {
    repositories: page.map(repositoryView),
  };
  if (offset + max < all.length) {
    result["nextToken"] = btoa(String(offset + max));
  }
  return result;
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
  for (const entry of ctx.store.list()) {
    if (
      entry.key.startsWith(`_upload:${name}:`) ||
      entry.key.startsWith(`_layer:${name}:`)
    ) {
      ctx.store.delete(entry.key);
    }
  }
  return { repository: repositoryView(repository) };
};

const ListImages: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  const filterRaw = input["filter"];
  const tagStatus =
    typeof filterRaw === "object" &&
    filterRaw !== null &&
    typeof (filterRaw as Record<string, unknown>)["tagStatus"] === "string"
      ? ((filterRaw as Record<string, unknown>)["tagStatus"] as string)
      : "ANY";
  let images = repository.images;
  if (tagStatus === "TAGGED") {
    images = images.filter((i) => i.imageTag !== undefined);
  } else if (tagStatus === "UNTAGGED") {
    images = images.filter((i) => i.imageTag === undefined);
  }
  const offset =
    typeof input["nextToken"] === "string" && input["nextToken"] !== ""
      ? parseInt(atob(input["nextToken"] as string), 10) || 0
      : 0;
  const max =
    typeof input["maxResults"] === "number" &&
    (input["maxResults"] as number) > 0
      ? (input["maxResults"] as number)
      : images.length;
  const page = images.slice(offset, offset + max);
  const result: Record<string, unknown> = {
    imageIds: page.map((image) => ({
      imageDigest: image.imageDigest,
      ...(image.imageTag === undefined ? {} : { imageTag: image.imageTag }),
    })),
  };
  if (offset + max < images.length) {
    result["nextToken"] = btoa(String(offset + max));
  }
  return result;
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

const PutImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  const imageManifest = requireString(input, "imageManifest");
  const imageTag =
    typeof input["imageTag"] === "string" && input["imageTag"] !== ""
      ? (input["imageTag"] as string)
      : undefined;
  const imageManifestMediaType =
    typeof input["imageManifestMediaType"] === "string" &&
    input["imageManifestMediaType"] !== ""
      ? (input["imageManifestMediaType"] as string)
      : undefined;
  const imageDigest =
    typeof input["imageDigest"] === "string" && input["imageDigest"] !== ""
      ? (input["imageDigest"] as string)
      : syntheticDigest(imageManifest);
  const existing = repository.images.find(
    (img) => img.imageDigest === imageDigest,
  );
  if (existing !== undefined && existing.imageTag === imageTag) {
    throw awsError(
      "ImageAlreadyExistsException",
      "Image already exists in the repository.",
      400,
    );
  }
  if (imageTag !== undefined) {
    const taggedIdx = repository.images.findIndex(
      (img) => img.imageTag === imageTag,
    );
    if (taggedIdx !== -1) {
      if (repository.imageTagMutability === "IMMUTABLE") {
        throw awsError(
          "ImageTagAlreadyExistsException",
          `The image tag '${imageTag}' already exists in the repository with name '${name}'.`,
          400,
        );
      }
      repository.images[taggedIdx] = {
        ...repository.images[taggedIdx],
        imageTag: undefined,
      };
    }
  }
  const image: StoredImage = {
    imageDigest,
    imageTag,
    imageManifest,
    imageManifestMediaType,
    imagePushedAt: Math.floor(Date.now() / 1000),
    imageSizeInBytes: imageManifest.length,
  };
  if (existing !== undefined) {
    const idx = repository.images.findIndex(
      (img) => img.imageDigest === imageDigest,
    );
    repository.images[idx] = image;
  } else {
    repository.images.push(image);
  }
  ctx.store.set(name, repository);
  return {
    image: {
      registryId: repository.registryId,
      repositoryName: repository.repositoryName,
      imageId: {
        imageDigest,
        ...(imageTag !== undefined ? { imageTag } : {}),
      },
      imageManifest,
      ...(imageManifestMediaType !== undefined
        ? { imageManifestMediaType }
        : {}),
    },
  };
};

const DescribeImages: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  const identifiers = Array.isArray(input["imageIds"])
    ? (input["imageIds"] as unknown[]).map(asImageIdentifier)
    : [];
  const filtered =
    identifiers.length > 0
      ? repository.images.filter((img) =>
          identifiers.some((id) => matchesIdentifier(img, id)),
        )
      : repository.images;
  const byDigest = new Map<string, StoredImage[]>();
  for (const img of filtered) {
    const arr = byDigest.get(img.imageDigest) ?? [];
    arr.push(img);
    byDigest.set(img.imageDigest, arr);
  }
  const imageDetails = [...byDigest.values()].map((imgs) => {
    const first = imgs[0];
    const tags = imgs
      .filter((i) => i.imageTag !== undefined)
      .map((i) => i.imageTag as string);
    return {
      registryId: repository.registryId,
      repositoryName: repository.repositoryName,
      imageDigest: first.imageDigest,
      imageTags: tags,
      imageSizeInBytes: first.imageSizeInBytes,
      imagePushedAt: first.imagePushedAt,
      ...(first.imageManifestMediaType !== undefined
        ? { imageManifestMediaType: first.imageManifestMediaType }
        : {}),
      ...(first.scanStatus !== undefined
        ? { imageScanStatus: first.scanStatus }
        : {}),
    };
  });
  const offset =
    typeof input["nextToken"] === "string" && input["nextToken"] !== ""
      ? parseInt(atob(input["nextToken"] as string), 10) || 0
      : 0;
  const max =
    typeof input["maxResults"] === "number" &&
    (input["maxResults"] as number) > 0
      ? (input["maxResults"] as number)
      : imageDetails.length;
  const page = imageDetails.slice(offset, offset + max);
  const result: Record<string, unknown> = { imageDetails: page };
  if (offset + max < imageDetails.length) {
    result["nextToken"] = btoa(String(offset + max));
  }
  return result;
};

const BatchDeleteImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  const identifiers = Array.isArray(input["imageIds"])
    ? (input["imageIds"] as unknown[]).map(asImageIdentifier)
    : [];
  const deletedIds: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  for (const identifier of identifiers) {
    const idx = repository.images.findIndex((img) =>
      matchesIdentifier(img, identifier),
    );
    if (idx === -1) {
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
    const deleted = repository.images[idx];
    repository.images.splice(idx, 1);
    deletedIds.push({
      imageDigest: deleted.imageDigest,
      ...(deleted.imageTag !== undefined ? { imageTag: deleted.imageTag } : {}),
    });
  }
  ctx.store.set(name, repository);
  return { imageIds: deletedIds, failures };
};

const ListImageReferrers: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  requireRepository(ctx, name);
  return { referrers: [] };
};

const DescribeImageReplicationStatus: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  requireRepository(ctx, name);
  const imageId =
    typeof input["imageId"] === "object" && input["imageId"] !== null
      ? (input["imageId"] as Record<string, unknown>)
      : {};
  return {
    repositoryName: name,
    imageId,
    replicationStatuses: [],
  };
};

const InitiateLayerUpload: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  requireRepository(ctx, name);
  const uploadId = crypto.randomUUID();
  const upload: StoredLayerUpload = {
    repositoryName: name,
    uploadId,
    lastByteReceived: 0,
  };
  ctx.store.set(`_upload:${name}:${uploadId}`, upload);
  return { uploadId, partSize: 20971520 };
};

const UploadLayerPart: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  requireRepository(ctx, name);
  const uploadId = requireString(input, "uploadId");
  const upload = ctx.store.get<StoredLayerUpload>(
    `_upload:${name}:${uploadId}`,
  );
  if (upload === undefined) {
    throw awsError(
      "UploadNotFoundException",
      `Upload does not exist for upload ID ${uploadId}`,
      400,
    );
  }
  const partLastByte =
    typeof input["partLastByte"] === "number"
      ? (input["partLastByte"] as number)
      : 0;
  upload.lastByteReceived = partLastByte;
  ctx.store.set(`_upload:${name}:${uploadId}`, upload);
  return {
    registryId: ctx.account,
    repositoryName: name,
    uploadId,
    lastByteReceived: upload.lastByteReceived,
  };
};

const CompleteLayerUpload: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  requireRepository(ctx, name);
  const uploadId = requireString(input, "uploadId");
  const upload = ctx.store.get<StoredLayerUpload>(
    `_upload:${name}:${uploadId}`,
  );
  if (upload === undefined) {
    throw awsError(
      "UploadNotFoundException",
      `Upload does not exist for upload ID ${uploadId}`,
      400,
    );
  }
  const digests = Array.isArray(input["layerDigests"])
    ? (input["layerDigests"] as string[])
    : [];
  const layerDigest =
    digests.length > 0 ? digests[0] : `sha256:${"0".repeat(64)}`;
  const layer: StoredLayer = {
    layerDigest,
    layerSize: upload.lastByteReceived + 1,
  };
  ctx.store.set(`_layer:${name}:${layerDigest}`, layer);
  ctx.store.delete(`_upload:${name}:${uploadId}`);
  return {
    registryId: ctx.account,
    repositoryName: name,
    uploadId,
    layerDigest,
  };
};

const BatchCheckLayerAvailability: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  requireRepository(ctx, name);
  const digests = Array.isArray(input["layerDigests"])
    ? (input["layerDigests"] as string[])
    : [];
  const layers: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  for (const digest of digests) {
    const layer = ctx.store.get<StoredLayer>(`_layer:${name}:${digest}`);
    if (layer !== undefined) {
      layers.push({
        layerDigest: digest,
        layerAvailability: "AVAILABLE",
        layerSize: layer.layerSize,
        mediaType: "application/vnd.oci.image.layer.v1.tar+gzip",
      });
    } else {
      failures.push({
        layerDigest: digest,
        failureCode: "MissingLayerDigest",
        failureReason: "Requested layer not found",
      });
    }
  }
  return { layers, failures };
};

const GetDownloadUrlForLayer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  requireRepository(ctx, name);
  const layerDigest = requireString(input, "layerDigest");
  const layer = ctx.store.get<StoredLayer>(`_layer:${name}:${layerDigest}`);
  if (layer === undefined) {
    throw awsError(
      "LayerInaccessibleException",
      `Layer ${layerDigest} is not accessible in the repository with name '${name}'.`,
      400,
    );
  }
  return {
    downloadUrl: `https://prod-${ctx.account}-${ctx.region}-starport-layer-bucket.s3.amazonaws.com/repos/${name}/${layerDigest}`,
    layerDigest,
  };
};

const StartImageScan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  const imageId =
    typeof input["imageId"] === "object" && input["imageId"] !== null
      ? (input["imageId"] as Record<string, unknown>)
      : {};
  const image = repository.images.find((img) =>
    matchesIdentifier(img, imageId),
  );
  if (image !== undefined) {
    image.scanStatus = { status: "COMPLETE" };
    ctx.store.set(name, repository);
  }
  return {
    registryId: ctx.account,
    repositoryName: name,
    imageId,
    imageScanStatus: { status: "IN_PROGRESS" },
  };
};

const DescribeImageScanFindings: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  requireRepository(ctx, name);
  const imageId =
    typeof input["imageId"] === "object" && input["imageId"] !== null
      ? (input["imageId"] as Record<string, unknown>)
      : {};
  return {
    registryId: ctx.account,
    repositoryName: name,
    imageId,
    imageScanStatus: { status: "COMPLETE" },
    imageScanFindings: {
      imageScanCompletedAt: Math.floor(Date.now() / 1000),
      vulnerabilitySourceUpdatedAt: Math.floor(Date.now() / 1000),
      findingSeverityCounts: {},
      findings: [],
      enhancedFindings: [],
    },
  };
};

const PutImageScanningConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  const cfgInput =
    typeof input["imageScanningConfiguration"] === "object" &&
    input["imageScanningConfiguration"] !== null
      ? (input["imageScanningConfiguration"] as Record<string, unknown>)
      : {};
  repository.imageScanningConfiguration = {
    scanOnPush: cfgInput["scanOnPush"] === true,
  };
  ctx.store.set(name, repository);
  return {
    registryId: ctx.account,
    repositoryName: name,
    imageScanningConfiguration: repository.imageScanningConfiguration,
  };
};

const GetRegistryScanningConfiguration: OperationHandler = (_input, ctx) => {
  const cfg = ctx.store.get<{ scanType: string; rules: unknown[] }>(
    "_registryScanningConfig",
  ) ?? { scanType: "BASIC", rules: [] };
  return { registryId: ctx.account, scanningConfiguration: cfg };
};

const PutRegistryScanningConfiguration: OperationHandler = (input, ctx) => {
  const scanType =
    typeof input["scanType"] === "string"
      ? (input["scanType"] as string)
      : "BASIC";
  const rules = Array.isArray(input["rules"])
    ? (input["rules"] as unknown[])
    : [];
  const cfg = { scanType, rules };
  ctx.store.set("_registryScanningConfig", cfg);
  return { registryScanningConfiguration: cfg };
};

const BatchGetRepositoryScanningConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const names = Array.isArray(input["repositoryNames"])
    ? (input["repositoryNames"] as string[])
    : [];
  const scanningConfigurations: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  for (const repoName of names) {
    const repo = ctx.store.get<StoredRepository>(repoName);
    if (repo === undefined) {
      failures.push({
        repositoryName: repoName,
        failureCode: "REPOSITORY_NOT_FOUND",
        failureReason: `The repository with name '${repoName}' does not exist`,
      });
      continue;
    }
    scanningConfigurations.push({
      repositoryArn: repo.repositoryArn,
      repositoryName: repoName,
      scanOnPush: repo.imageScanningConfiguration.scanOnPush,
      scanFrequency: "MANUAL",
      appliedScanFilters: [],
    });
  }
  return { scanningConfigurations, failures };
};

const DescribeImageSigningStatus: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  requireRepository(ctx, name);
  const imageId =
    typeof input["imageId"] === "object" && input["imageId"] !== null
      ? (input["imageId"] as Record<string, unknown>)
      : {};
  return {
    repositoryName: name,
    imageId,
    registryId: ctx.account,
    signingStatuses: [],
  };
};

const PutLifecyclePolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  const lifecyclePolicyText = requireString(input, "lifecyclePolicyText");
  repository.lifecyclePolicy = lifecyclePolicyText;
  ctx.store.set(name, repository);
  return {
    registryId: ctx.account,
    repositoryName: name,
    lifecyclePolicyText,
  };
};

const GetLifecyclePolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  if (repository.lifecyclePolicy === undefined) {
    throw awsError(
      "LifecyclePolicyNotFoundException",
      `Lifecycle policy does not exist for the repository with name '${name}'`,
      400,
    );
  }
  return {
    registryId: ctx.account,
    repositoryName: name,
    lifecyclePolicyText: repository.lifecyclePolicy,
    lastEvaluatedAt: Math.floor(Date.now() / 1000),
  };
};

const DeleteLifecyclePolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  if (repository.lifecyclePolicy === undefined) {
    throw awsError(
      "LifecyclePolicyNotFoundException",
      `Lifecycle policy does not exist for the repository with name '${name}'`,
      400,
    );
  }
  const text = repository.lifecyclePolicy;
  repository.lifecyclePolicy = undefined;
  ctx.store.set(name, repository);
  return {
    registryId: ctx.account,
    repositoryName: name,
    lifecyclePolicyText: text,
    lastEvaluatedAt: Math.floor(Date.now() / 1000),
  };
};

const StartLifecyclePolicyPreview: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  const text =
    typeof input["lifecyclePolicyText"] === "string"
      ? (input["lifecyclePolicyText"] as string)
      : (repository.lifecyclePolicy ?? "");
  return {
    registryId: ctx.account,
    repositoryName: name,
    lifecyclePolicyText: text,
    status: "COMPLETE",
  };
};

const GetLifecyclePolicyPreview: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  return {
    registryId: ctx.account,
    repositoryName: name,
    lifecyclePolicyText: repository.lifecyclePolicy ?? "",
    status: "COMPLETE",
    previewResults: [],
    summary: { expiringImageTotalCount: 0 },
  };
};

const SetRepositoryPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  const policyText = requireString(input, "policyText");
  repository.repositoryPolicy = policyText;
  ctx.store.set(name, repository);
  return { registryId: ctx.account, repositoryName: name, policyText };
};

const GetRepositoryPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  if (repository.repositoryPolicy === undefined) {
    throw awsError(
      "RepositoryPolicyNotFoundException",
      `Repository policy does not exist for the repository with name '${name}'`,
      400,
    );
  }
  return {
    registryId: ctx.account,
    repositoryName: name,
    policyText: repository.repositoryPolicy,
  };
};

const DeleteRepositoryPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  if (repository.repositoryPolicy === undefined) {
    throw awsError(
      "RepositoryPolicyNotFoundException",
      `Repository policy does not exist for the repository with name '${name}'`,
      400,
    );
  }
  const text = repository.repositoryPolicy;
  repository.repositoryPolicy = undefined;
  ctx.store.set(name, repository);
  return { registryId: ctx.account, repositoryName: name, policyText: text };
};

const PutRegistryPolicy: OperationHandler = (input, ctx) => {
  const policyText = requireString(input, "policyText");
  ctx.store.set("_registryPolicy", { policyText });
  return { registryId: ctx.account, policyText };
};

const GetRegistryPolicy: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<{ policyText: string }>("_registryPolicy");
  if (stored === undefined) {
    throw awsError(
      "RegistryPolicyNotFoundException",
      "Registry policy does not exist.",
      400,
    );
  }
  return { registryId: ctx.account, policyText: stored.policyText };
};

const DeleteRegistryPolicy: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<{ policyText: string }>("_registryPolicy");
  if (stored === undefined) {
    throw awsError(
      "RegistryPolicyNotFoundException",
      "Registry policy does not exist.",
      400,
    );
  }
  ctx.store.delete("_registryPolicy");
  return { registryId: ctx.account, policyText: stored.policyText };
};

const DescribeRegistry: OperationHandler = (_input, ctx) => {
  const replicationConfiguration = ctx.store.get<{ rules: unknown[] }>(
    "_replicationConfig",
  ) ?? { rules: [] };
  return { registryId: ctx.account, replicationConfiguration };
};

const PutReplicationConfiguration: OperationHandler = (input, ctx) => {
  const cfgInput =
    typeof input["replicationConfiguration"] === "object" &&
    input["replicationConfiguration"] !== null
      ? (input["replicationConfiguration"] as Record<string, unknown>)
      : {};
  const rules = Array.isArray(cfgInput["rules"])
    ? (cfgInput["rules"] as unknown[])
    : [];
  const replicationConfiguration = { rules };
  ctx.store.set("_replicationConfig", replicationConfiguration);
  return { replicationConfiguration };
};

const GetAccountSetting: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const setting = ctx.store.get<{ value: string }>(`_setting:${name}`);
  if (setting === undefined) {
    throw awsError(
      "InvalidParameterException",
      `Account setting '${name}' not found.`,
      400,
    );
  }
  return { name, value: setting.value };
};

const PutAccountSetting: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const value = requireString(input, "value");
  ctx.store.set(`_setting:${name}`, { value });
  return { name, value };
};

const PutImageTagMutability: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  const repository = requireRepository(ctx, name);
  const imageTagMutability = requireString(input, "imageTagMutability");
  const imageTagMutabilityExclusionFilters = Array.isArray(
    input["imageTagMutabilityExclusionFilters"],
  )
    ? (input["imageTagMutabilityExclusionFilters"] as unknown[])
    : repository.imageTagMutabilityExclusionFilters;
  repository.imageTagMutability = imageTagMutability;
  repository.imageTagMutabilityExclusionFilters =
    imageTagMutabilityExclusionFilters;
  ctx.store.set(name, repository);
  return {
    registryId: ctx.account,
    repositoryName: name,
    imageTagMutability,
    imageTagMutabilityExclusionFilters,
  };
};

const CreatePullThroughCacheRule: OperationHandler = (input, ctx) => {
  const ecrRepositoryPrefix = requireString(input, "ecrRepositoryPrefix");
  const upstreamRegistryUrl = requireString(input, "upstreamRegistryUrl");
  if (
    ctx.store.get<StoredPullThroughCacheRule>(
      `_ptcrule:${ecrRepositoryPrefix}`,
    ) !== undefined
  ) {
    throw awsError(
      "PullThroughCacheRuleAlreadyExistsException",
      `A pull through cache rule for repository prefix '${ecrRepositoryPrefix}' already exists.`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const rule: StoredPullThroughCacheRule = {
    ecrRepositoryPrefix,
    upstreamRegistryUrl,
    createdAt: now,
    registryId: ctx.account,
    credentialArn:
      typeof input["credentialArn"] === "string" &&
      input["credentialArn"] !== ""
        ? (input["credentialArn"] as string)
        : undefined,
    customRoleArn:
      typeof input["customRoleArn"] === "string" &&
      input["customRoleArn"] !== ""
        ? (input["customRoleArn"] as string)
        : undefined,
    upstreamRepositoryPrefix:
      typeof input["upstreamRepositoryPrefix"] === "string" &&
      input["upstreamRepositoryPrefix"] !== ""
        ? (input["upstreamRepositoryPrefix"] as string)
        : undefined,
    upstreamRegistry:
      typeof input["upstreamRegistry"] === "string" &&
      input["upstreamRegistry"] !== ""
        ? (input["upstreamRegistry"] as string)
        : undefined,
    updatedAt: now,
  };
  ctx.store.set(`_ptcrule:${ecrRepositoryPrefix}`, rule);
  return {
    ecrRepositoryPrefix: rule.ecrRepositoryPrefix,
    upstreamRegistryUrl: rule.upstreamRegistryUrl,
    createdAt: rule.createdAt,
    registryId: rule.registryId,
    ...(rule.credentialArn !== undefined
      ? { credentialArn: rule.credentialArn }
      : {}),
    ...(rule.customRoleArn !== undefined
      ? { customRoleArn: rule.customRoleArn }
      : {}),
    ...(rule.upstreamRepositoryPrefix !== undefined
      ? { upstreamRepositoryPrefix: rule.upstreamRepositoryPrefix }
      : {}),
    ...(rule.upstreamRegistry !== undefined
      ? { upstreamRegistry: rule.upstreamRegistry }
      : {}),
  };
};

const DescribePullThroughCacheRules: OperationHandler = (input, ctx) => {
  const prefixes = Array.isArray(input["ecrRepositoryPrefixes"])
    ? (input["ecrRepositoryPrefixes"] as string[])
    : [];
  const allRules = ctx.store
    .list<StoredPullThroughCacheRule>()
    .filter((e) => e.key.startsWith("_ptcrule:"))
    .map((e) => e.value);
  const filtered =
    prefixes.length > 0
      ? allRules.filter((r) => prefixes.includes(r.ecrRepositoryPrefix))
      : allRules;
  const pullThroughCacheRules = filtered.map((r) => ({
    ecrRepositoryPrefix: r.ecrRepositoryPrefix,
    upstreamRegistryUrl: r.upstreamRegistryUrl,
    createdAt: r.createdAt,
    registryId: r.registryId,
    updatedAt: r.updatedAt,
    ...(r.credentialArn !== undefined
      ? { credentialArn: r.credentialArn }
      : {}),
    ...(r.customRoleArn !== undefined
      ? { customRoleArn: r.customRoleArn }
      : {}),
    ...(r.upstreamRepositoryPrefix !== undefined
      ? { upstreamRepositoryPrefix: r.upstreamRepositoryPrefix }
      : {}),
    ...(r.upstreamRegistry !== undefined
      ? { upstreamRegistry: r.upstreamRegistry }
      : {}),
  }));
  return { pullThroughCacheRules };
};

const UpdatePullThroughCacheRule: OperationHandler = (input, ctx) => {
  const ecrRepositoryPrefix = requireString(input, "ecrRepositoryPrefix");
  const rule = ctx.store.get<StoredPullThroughCacheRule>(
    `_ptcrule:${ecrRepositoryPrefix}`,
  );
  if (rule === undefined) {
    throw awsError(
      "PullThroughCacheRuleNotFoundException",
      `Pull through cache rule for repository prefix '${ecrRepositoryPrefix}' not found.`,
      400,
    );
  }
  if (
    typeof input["credentialArn"] === "string" &&
    input["credentialArn"] !== ""
  ) {
    rule.credentialArn = input["credentialArn"] as string;
  }
  if (
    typeof input["customRoleArn"] === "string" &&
    input["customRoleArn"] !== ""
  ) {
    rule.customRoleArn = input["customRoleArn"] as string;
  }
  rule.updatedAt = Math.floor(Date.now() / 1000);
  ctx.store.set(`_ptcrule:${ecrRepositoryPrefix}`, rule);
  return {
    ecrRepositoryPrefix: rule.ecrRepositoryPrefix,
    registryId: rule.registryId,
    updatedAt: rule.updatedAt,
    ...(rule.credentialArn !== undefined
      ? { credentialArn: rule.credentialArn }
      : {}),
    ...(rule.customRoleArn !== undefined
      ? { customRoleArn: rule.customRoleArn }
      : {}),
    ...(rule.upstreamRepositoryPrefix !== undefined
      ? { upstreamRepositoryPrefix: rule.upstreamRepositoryPrefix }
      : {}),
  };
};

const DeletePullThroughCacheRule: OperationHandler = (input, ctx) => {
  const ecrRepositoryPrefix = requireString(input, "ecrRepositoryPrefix");
  const rule = ctx.store.get<StoredPullThroughCacheRule>(
    `_ptcrule:${ecrRepositoryPrefix}`,
  );
  if (rule === undefined) {
    throw awsError(
      "PullThroughCacheRuleNotFoundException",
      `Pull through cache rule for repository prefix '${ecrRepositoryPrefix}' not found.`,
      400,
    );
  }
  ctx.store.delete(`_ptcrule:${ecrRepositoryPrefix}`);
  return {
    ecrRepositoryPrefix: rule.ecrRepositoryPrefix,
    upstreamRegistryUrl: rule.upstreamRegistryUrl,
    createdAt: rule.createdAt,
    registryId: rule.registryId,
    ...(rule.credentialArn !== undefined
      ? { credentialArn: rule.credentialArn }
      : {}),
    ...(rule.customRoleArn !== undefined
      ? { customRoleArn: rule.customRoleArn }
      : {}),
    ...(rule.upstreamRepositoryPrefix !== undefined
      ? { upstreamRepositoryPrefix: rule.upstreamRepositoryPrefix }
      : {}),
  };
};

const ValidatePullThroughCacheRule: OperationHandler = (input, ctx) => {
  const ecrRepositoryPrefix = requireString(input, "ecrRepositoryPrefix");
  const rule = ctx.store.get<StoredPullThroughCacheRule>(
    `_ptcrule:${ecrRepositoryPrefix}`,
  );
  if (rule === undefined) {
    throw awsError(
      "PullThroughCacheRuleNotFoundException",
      `Pull through cache rule for repository prefix '${ecrRepositoryPrefix}' not found.`,
      400,
    );
  }
  return {
    ecrRepositoryPrefix: rule.ecrRepositoryPrefix,
    registryId: rule.registryId,
    upstreamRegistryUrl: rule.upstreamRegistryUrl,
    ...(rule.credentialArn !== undefined
      ? { credentialArn: rule.credentialArn }
      : {}),
    ...(rule.customRoleArn !== undefined
      ? { customRoleArn: rule.customRoleArn }
      : {}),
    ...(rule.upstreamRepositoryPrefix !== undefined
      ? { upstreamRepositoryPrefix: rule.upstreamRepositoryPrefix }
      : {}),
    isValid: true,
  };
};

const CreateRepositoryCreationTemplate: OperationHandler = (input, ctx) => {
  const prefix = requireString(input, "prefix");
  const appliedFor = Array.isArray(input["appliedFor"])
    ? (input["appliedFor"] as string[])
    : [];
  if (
    ctx.store.get<StoredRepositoryCreationTemplate>(`_template:${prefix}`) !==
    undefined
  ) {
    throw awsError(
      "TemplateAlreadyExistsException",
      `A repository creation template for prefix '${prefix}' already exists.`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const template: StoredRepositoryCreationTemplate = {
    prefix,
    description:
      typeof input["description"] === "string" && input["description"] !== ""
        ? (input["description"] as string)
        : undefined,
    encryptionConfiguration:
      typeof input["encryptionConfiguration"] === "object"
        ? input["encryptionConfiguration"]
        : undefined,
    resourceTags: Array.isArray(input["resourceTags"])
      ? (input["resourceTags"] as unknown[])
      : undefined,
    imageTagMutability:
      typeof input["imageTagMutability"] === "string"
        ? (input["imageTagMutability"] as string)
        : undefined,
    imageTagMutabilityExclusionFilters: Array.isArray(
      input["imageTagMutabilityExclusionFilters"],
    )
      ? (input["imageTagMutabilityExclusionFilters"] as unknown[])
      : undefined,
    repositoryPolicy:
      typeof input["repositoryPolicy"] === "string" &&
      input["repositoryPolicy"] !== ""
        ? (input["repositoryPolicy"] as string)
        : undefined,
    lifecyclePolicy:
      typeof input["lifecyclePolicy"] === "string" &&
      input["lifecyclePolicy"] !== ""
        ? (input["lifecyclePolicy"] as string)
        : undefined,
    appliedFor,
    customRoleArn:
      typeof input["customRoleArn"] === "string" &&
      input["customRoleArn"] !== ""
        ? (input["customRoleArn"] as string)
        : undefined,
    createdAt: now,
    updatedAt: now,
  };
  ctx.store.set(`_template:${prefix}`, template);
  return {
    registryId: ctx.account,
    repositoryCreationTemplate: templateView(template),
  };
};

const DescribeRepositoryCreationTemplates: OperationHandler = (input, ctx) => {
  const prefixes = Array.isArray(input["prefixes"])
    ? (input["prefixes"] as string[])
    : [];
  const allTemplates = ctx.store
    .list<StoredRepositoryCreationTemplate>()
    .filter((e) => e.key.startsWith("_template:"))
    .map((e) => e.value);
  const filtered =
    prefixes.length > 0
      ? allTemplates.filter((t) => prefixes.includes(t.prefix))
      : allTemplates;
  return {
    registryId: ctx.account,
    repositoryCreationTemplates: filtered.map(templateView),
  };
};

const UpdateRepositoryCreationTemplate: OperationHandler = (input, ctx) => {
  const prefix = requireString(input, "prefix");
  const template = ctx.store.get<StoredRepositoryCreationTemplate>(
    `_template:${prefix}`,
  );
  if (template === undefined) {
    throw awsError(
      "TemplateNotFoundException",
      `Repository creation template for prefix '${prefix}' not found.`,
      400,
    );
  }
  if (Array.isArray(input["appliedFor"]))
    template.appliedFor = input["appliedFor"] as string[];
  if (typeof input["description"] === "string")
    template.description = input["description"] as string;
  if (typeof input["imageTagMutability"] === "string")
    template.imageTagMutability = input["imageTagMutability"] as string;
  if (typeof input["repositoryPolicy"] === "string")
    template.repositoryPolicy = input["repositoryPolicy"] as string;
  if (typeof input["lifecyclePolicy"] === "string")
    template.lifecyclePolicy = input["lifecyclePolicy"] as string;
  if (typeof input["customRoleArn"] === "string")
    template.customRoleArn = input["customRoleArn"] as string;
  if (Array.isArray(input["resourceTags"]))
    template.resourceTags = input["resourceTags"] as unknown[];
  template.updatedAt = Math.floor(Date.now() / 1000);
  ctx.store.set(`_template:${prefix}`, template);
  return {
    registryId: ctx.account,
    repositoryCreationTemplate: templateView(template),
  };
};

const DeleteRepositoryCreationTemplate: OperationHandler = (input, ctx) => {
  const prefix = requireString(input, "prefix");
  const template = ctx.store.get<StoredRepositoryCreationTemplate>(
    `_template:${prefix}`,
  );
  if (template === undefined) {
    throw awsError(
      "TemplateNotFoundException",
      `Repository creation template for prefix '${prefix}' not found.`,
      400,
    );
  }
  ctx.store.delete(`_template:${prefix}`);
  return {
    registryId: ctx.account,
    repositoryCreationTemplate: templateView(template),
  };
};

const GetSigningConfiguration: OperationHandler = (_input, ctx) => {
  const cfg = ctx.store.get<{ rules: unknown[] }>("_signingConfig") ?? {
    rules: [],
  };
  return { registryId: ctx.account, signingConfiguration: cfg };
};

const PutSigningConfiguration: OperationHandler = (input, ctx) => {
  const cfgInput =
    typeof input["signingConfiguration"] === "object" &&
    input["signingConfiguration"] !== null
      ? (input["signingConfiguration"] as Record<string, unknown>)
      : {};
  const rules = Array.isArray(cfgInput["rules"])
    ? (cfgInput["rules"] as unknown[])
    : [];
  const cfg = { rules };
  ctx.store.set("_signingConfig", cfg);
  return { signingConfiguration: cfg };
};

const DeleteSigningConfiguration: OperationHandler = (_input, ctx) => {
  const cfg = ctx.store.get<{ rules: unknown[] }>("_signingConfig") ?? {
    rules: [],
  };
  ctx.store.delete("_signingConfig");
  return { registryId: ctx.account, signingConfiguration: cfg };
};

const UpdateImageStorageClass: OperationHandler = (input, ctx) => {
  const name = requireString(input, "repositoryName");
  requireRepository(ctx, name);
  const imageId =
    typeof input["imageId"] === "object" && input["imageId"] !== null
      ? (input["imageId"] as Record<string, unknown>)
      : {};
  requireString(input, "targetStorageClass");
  return {
    registryId: ctx.account,
    repositoryName: name,
    imageId,
    imageStatus: "ACTIVE",
  };
};

const RegisterPullTimeUpdateExclusion: OperationHandler = (input, ctx) => {
  const principalArn = requireString(input, "principalArn");
  const now = Math.floor(Date.now() / 1000);
  ctx.store.set(`_pullexcl:${principalArn}`, { principalArn, createdAt: now });
  return { principalArn, createdAt: now };
};

const DeregisterPullTimeUpdateExclusion: OperationHandler = (input, ctx) => {
  const principalArn = requireString(input, "principalArn");
  ctx.store.delete(`_pullexcl:${principalArn}`);
  return { principalArn };
};

const ListPullTimeUpdateExclusions: OperationHandler = (_input, ctx) => {
  const exclusions = ctx.store
    .list<{ principalArn: string; createdAt: number }>()
    .filter((e) => e.key.startsWith("_pullexcl:"))
    .map((e) => e.value.principalArn);
  return { pullTimeUpdateExclusions: exclusions };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const newTags = Array.isArray(input["tags"])
    ? (input["tags"] as { Key: string; Value: string }[])
    : [];
  const repository = findRepositoryByArn(ctx, resourceArn);
  if (repository === undefined) {
    throw awsError(
      "RepositoryNotFoundException",
      `The repository with ARN '${resourceArn}' does not exist.`,
      400,
    );
  }
  for (const tag of newTags) {
    const idx = repository.tags.findIndex((t) => t.Key === tag.Key);
    if (idx !== -1) {
      repository.tags[idx] = tag;
    } else {
      repository.tags.push(tag);
    }
  }
  ctx.store.set(repository.repositoryName, repository);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = Array.isArray(input["tagKeys"])
    ? (input["tagKeys"] as string[])
    : [];
  const repository = findRepositoryByArn(ctx, resourceArn);
  if (repository === undefined) {
    throw awsError(
      "RepositoryNotFoundException",
      `The repository with ARN '${resourceArn}' does not exist.`,
      400,
    );
  }
  repository.tags = repository.tags.filter((t) => !tagKeys.includes(t.Key));
  ctx.store.set(repository.repositoryName, repository);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const repository = findRepositoryByArn(ctx, resourceArn);
  if (repository === undefined) {
    throw awsError(
      "RepositoryNotFoundException",
      `The repository with ARN '${resourceArn}' does not exist.`,
      400,
    );
  }
  return { tags: repository.tags };
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
    PutImage,
    DescribeImages,
    BatchDeleteImage,
    ListImageReferrers,
    DescribeImageReplicationStatus,
    InitiateLayerUpload,
    UploadLayerPart,
    CompleteLayerUpload,
    BatchCheckLayerAvailability,
    GetDownloadUrlForLayer,
    StartImageScan,
    DescribeImageScanFindings,
    PutImageScanningConfiguration,
    GetRegistryScanningConfiguration,
    PutRegistryScanningConfiguration,
    BatchGetRepositoryScanningConfiguration,
    DescribeImageSigningStatus,
    PutLifecyclePolicy,
    GetLifecyclePolicy,
    DeleteLifecyclePolicy,
    StartLifecyclePolicyPreview,
    GetLifecyclePolicyPreview,
    SetRepositoryPolicy,
    GetRepositoryPolicy,
    DeleteRepositoryPolicy,
    PutRegistryPolicy,
    GetRegistryPolicy,
    DeleteRegistryPolicy,
    DescribeRegistry,
    PutReplicationConfiguration,
    GetAccountSetting,
    PutAccountSetting,
    PutImageTagMutability,
    CreatePullThroughCacheRule,
    DescribePullThroughCacheRules,
    UpdatePullThroughCacheRule,
    DeletePullThroughCacheRule,
    ValidatePullThroughCacheRule,
    CreateRepositoryCreationTemplate,
    DescribeRepositoryCreationTemplates,
    UpdateRepositoryCreationTemplate,
    DeleteRepositoryCreationTemplate,
    GetSigningConfiguration,
    PutSigningConfiguration,
    DeleteSigningConfiguration,
    UpdateImageStorageClass,
    RegisterPullTimeUpdateExclusion,
    DeregisterPullTimeUpdateExclusion,
    ListPullTimeUpdateExclusions,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const;

export default ecr;
