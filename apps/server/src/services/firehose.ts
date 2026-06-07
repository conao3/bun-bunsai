import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import firehoseModel from "../../../../test/vendor/aws-models/firehose.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(firehoseModel);

const streamPrefix = "stream:" as const;

type StoredTag = {
  Key: string;
  Value?: string;
};

type StoredEncryptionConfiguration = {
  KeyARN?: string;
  KeyType?: string;
  Status: string;
};

type StoredDeliveryStream = {
  DeliveryStreamName: string;
  DeliveryStreamARN: string;
  DeliveryStreamStatus: string;
  DeliveryStreamType: string;
  VersionId: string;
  CreateTimestamp: number;
  LastUpdateTimestamp: number;
  Destinations: Record<string, unknown>[];
  HasMoreDestinations: boolean;
  Tags: StoredTag[];
  EncryptionConfiguration?: StoredEncryptionConfiguration;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidArgumentException", `${field} is required.`, 400);
  }
  return value;
};

const requireStream = (
  ctx: ServiceContext,
  name: string,
): StoredDeliveryStream => {
  const stream = ctx.store.get<StoredDeliveryStream>(`${streamPrefix}${name}`);
  if (stream === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Firehose ${name} not found.`,
      400,
    );
  }
  return stream;
};

const bucketNameFromArn = (arn: string): string =>
  arn.split(":").slice(-1)[0] ?? "";

const md5HexBytes = (value: Uint8Array): string =>
  new Bun.CryptoHasher("md5").update(value).digest("hex");

const deliverRecordToS3 = (
  ctx: ServiceContext,
  stream: StoredDeliveryStream,
  data: string,
): string => {
  const recordId = crypto.randomUUID();
  const dest = stream.Destinations.find((d) => {
    const r = asRecord(d);
    return (
      r["S3DestinationDescription"] !== undefined ||
      r["ExtendedS3DestinationDescription"] !== undefined ||
      typeof r["BucketARN"] === "string"
    );
  });
  if (dest === undefined) return recordId;
  const destRecord = asRecord(dest);
  const s3Desc =
    destRecord["S3DestinationDescription"] !== undefined
      ? asRecord(destRecord["S3DestinationDescription"])
      : destRecord["ExtendedS3DestinationDescription"] !== undefined
        ? asRecord(destRecord["ExtendedS3DestinationDescription"])
        : destRecord;
  const bucketArn =
    typeof s3Desc["BucketARN"] === "string" ? s3Desc["BucketARN"] : "";
  const prefix = typeof s3Desc["Prefix"] === "string" ? s3Desc["Prefix"] : "";
  const bucketName = bucketNameFromArn(bucketArn);
  if (bucketName === "") return recordId;
  const s3Store = ctx.storeFor("s3");
  const bucket = s3Store.get<Record<string, unknown>>(bucketName);
  if (bucket === undefined) return recordId;
  const dataBytes = Buffer.from(data, "binary");
  const objectKey = `${prefix}${recordId}`;
  const etag = `"${md5HexBytes(dataBytes)}"`;
  const obj = {
    key: objectKey,
    body: dataBytes,
    contentType: "application/octet-stream" as const,
    etag,
    size: dataBytes.byteLength,
    lastModified: Math.floor(Date.now() / 1000),
    tagSet: [] as unknown[],
    userMetadata: {} as Record<string, string>,
    storageClass: "STANDARD" as const,
  };
  const existingObjects = bucket["objects"] as Record<string, unknown[]>;
  const existing = existingObjects[objectKey] ?? [];
  s3Store.set<Record<string, unknown>>(bucketName, {
    ...bucket,
    objects: { ...existingObjects, [objectKey]: [obj, ...existing] },
  });
  return recordId;
};

const CreateDeliveryStream: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeliveryStreamName");
  if (
    ctx.store.get<StoredDeliveryStream>(`${streamPrefix}${name}`) !== undefined
  ) {
    throw awsError(
      "ResourceInUseException",
      `Firehose ${name} already exists.`,
      400,
    );
  }
  const arn = `arn:aws:firehose:${ctx.region}:${ctx.account}:deliverystream/${name}`;
  const now = Math.floor(Date.now() / 1000);
  const type =
    typeof input["DeliveryStreamType"] === "string"
      ? (input["DeliveryStreamType"] as string)
      : "DirectPut";
  const destinations: Record<string, unknown>[] = [];
  if (input["S3DestinationConfiguration"] !== undefined) {
    destinations.push({
      DestinationId: "destinationId-000000000001",
      S3DestinationDescription: asRecord(input["S3DestinationConfiguration"]),
    });
  } else if (input["ExtendedS3DestinationConfiguration"] !== undefined) {
    destinations.push({
      DestinationId: "destinationId-000000000001",
      ExtendedS3DestinationDescription: asRecord(
        input["ExtendedS3DestinationConfiguration"],
      ),
    });
  }
  const stream: StoredDeliveryStream = {
    DeliveryStreamName: name,
    DeliveryStreamARN: arn,
    DeliveryStreamStatus: "ACTIVE",
    DeliveryStreamType: type,
    VersionId: "1",
    CreateTimestamp: now,
    LastUpdateTimestamp: now,
    Destinations: destinations,
    HasMoreDestinations: false,
    Tags: [],
  };
  ctx.store.set(`${streamPrefix}${name}`, stream);
  return { DeliveryStreamARN: arn };
};

const DescribeDeliveryStream: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeliveryStreamName");
  const stream = requireStream(ctx, name);
  return {
    DeliveryStreamDescription: {
      DeliveryStreamName: stream.DeliveryStreamName,
      DeliveryStreamARN: stream.DeliveryStreamARN,
      DeliveryStreamStatus: stream.DeliveryStreamStatus,
      DeliveryStreamType: stream.DeliveryStreamType,
      VersionId: stream.VersionId,
      CreateTimestamp: stream.CreateTimestamp,
      LastUpdateTimestamp: stream.LastUpdateTimestamp,
      Destinations: stream.Destinations,
      HasMoreDestinations: stream.HasMoreDestinations,
      DeliveryStreamEncryptionConfiguration: stream.EncryptionConfiguration,
    },
  };
};

const ListDeliveryStreams: OperationHandler = (input, ctx) => {
  const type =
    typeof input["DeliveryStreamType"] === "string"
      ? (input["DeliveryStreamType"] as string)
      : undefined;
  const exclusiveStart =
    typeof input["ExclusiveStartDeliveryStreamName"] === "string"
      ? (input["ExclusiveStartDeliveryStreamName"] as string)
      : undefined;
  const limit =
    typeof input["Limit"] === "number" ? (input["Limit"] as number) : 10;
  const names = ctx.store
    .list<StoredDeliveryStream>()
    .filter((entry) => entry.key.startsWith(streamPrefix))
    .filter(
      (entry) => type === undefined || entry.value.DeliveryStreamType === type,
    )
    .map((entry) => entry.value.DeliveryStreamName)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .filter((name) => exclusiveStart === undefined || name > exclusiveStart);
  const page = names.slice(0, limit);
  return {
    DeliveryStreamNames: page,
    HasMoreDeliveryStreams: page.length < names.length,
  };
};

const DeleteDeliveryStream: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeliveryStreamName");
  requireStream(ctx, name);
  ctx.store.delete(`${streamPrefix}${name}`);
  return {};
};

const PutRecord: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeliveryStreamName");
  const stream = requireStream(ctx, name);
  const record = asRecord(input["Record"]);
  if (record["Data"] === undefined) {
    throw awsError("InvalidArgumentException", "Record.Data is required.", 400);
  }
  const data = typeof record["Data"] === "string" ? record["Data"] : "";
  const recordId = deliverRecordToS3(ctx, stream, data);
  return { RecordId: recordId, Encrypted: false };
};

const PutRecordBatch: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeliveryStreamName");
  const stream = requireStream(ctx, name);
  const records = Array.isArray(input["Records"])
    ? (input["Records"] as unknown[])
    : [];
  const responses = records.map((r) => {
    const record = asRecord(r);
    const data = typeof record["Data"] === "string" ? record["Data"] : "";
    const recordId = deliverRecordToS3(ctx, stream, data);
    return { RecordId: recordId };
  });
  return {
    FailedPutCount: 0,
    Encrypted: false,
    RequestResponses: responses,
  };
};

const TagDeliveryStream: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeliveryStreamName");
  const stream = requireStream(ctx, name);
  const tags = Array.isArray(input["Tags"]) ? (input["Tags"] as unknown[]) : [];
  const merged = new Map<string, StoredTag>();
  for (const tag of stream.Tags) {
    merged.set(tag.Key, tag);
  }
  for (const raw of tags) {
    const tag = asRecord(raw);
    const key = typeof tag["Key"] === "string" ? tag["Key"] : undefined;
    if (key === undefined || key === "") {
      throw awsError("InvalidArgumentException", "Tag Key is required.", 400);
    }
    const value = typeof tag["Value"] === "string" ? tag["Value"] : undefined;
    merged.set(key, { Key: key, Value: value });
  }
  ctx.store.set(`${streamPrefix}${name}`, {
    ...stream,
    Tags: [...merged.values()],
    LastUpdateTimestamp: Math.floor(Date.now() / 1000),
  });
  return {};
};

const ListTagsForDeliveryStream: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeliveryStreamName");
  const stream = requireStream(ctx, name);
  const exclusiveStart =
    typeof input["ExclusiveStartTagKey"] === "string"
      ? (input["ExclusiveStartTagKey"] as string)
      : undefined;
  const limit =
    typeof input["Limit"] === "number" ? (input["Limit"] as number) : 50;
  const sorted = [...stream.Tags]
    .sort((a, b) => (a.Key < b.Key ? -1 : a.Key > b.Key ? 1 : 0))
    .filter((tag) => exclusiveStart === undefined || tag.Key > exclusiveStart);
  const page = sorted.slice(0, limit);
  return {
    Tags: page,
    HasMoreTags: page.length < sorted.length,
  };
};

const UntagDeliveryStream: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeliveryStreamName");
  const stream = requireStream(ctx, name);
  const keys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as unknown[]).filter(
        (key): key is string => typeof key === "string",
      )
    : [];
  const removed = new Set(keys);
  ctx.store.set(`${streamPrefix}${name}`, {
    ...stream,
    Tags: stream.Tags.filter((tag) => !removed.has(tag.Key)),
    LastUpdateTimestamp: Math.floor(Date.now() / 1000),
  });
  return {};
};

const StartDeliveryStreamEncryption: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeliveryStreamName");
  const stream = requireStream(ctx, name);
  const config = asRecord(input["DeliveryStreamEncryptionConfigurationInput"]);
  const keyType =
    typeof config["KeyType"] === "string"
      ? (config["KeyType"] as string)
      : "AWS_OWNED_CMK";
  const keyArn =
    typeof config["KeyARN"] === "string"
      ? (config["KeyARN"] as string)
      : undefined;
  ctx.store.set(`${streamPrefix}${name}`, {
    ...stream,
    EncryptionConfiguration: {
      KeyARN: keyArn,
      KeyType: keyType,
      Status: "ENABLED",
    },
    LastUpdateTimestamp: Math.floor(Date.now() / 1000),
  });
  return {};
};

const StopDeliveryStreamEncryption: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeliveryStreamName");
  const stream = requireStream(ctx, name);
  const previous = stream.EncryptionConfiguration;
  ctx.store.set(`${streamPrefix}${name}`, {
    ...stream,
    EncryptionConfiguration: {
      KeyARN: previous?.KeyARN,
      KeyType: previous?.KeyType,
      Status: "DISABLED",
    },
    LastUpdateTimestamp: Math.floor(Date.now() / 1000),
  });
  return {};
};

const UpdateDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeliveryStreamName");
  const stream = requireStream(ctx, name);
  const currentVersionId = requireString(
    input,
    "CurrentDeliveryStreamVersionId",
  );
  if (currentVersionId !== stream.VersionId) {
    throw awsError(
      "ConcurrentModificationException",
      `Firehose ${name} version mismatch.`,
      400,
    );
  }
  const destinationId = requireString(input, "DestinationId");
  const updateKey = Object.keys(input).find((k) =>
    k.endsWith("DestinationUpdate"),
  );
  const updateData = updateKey !== undefined ? asRecord(input[updateKey]) : {};
  const existingIdx = stream.Destinations.findIndex(
    (d) => asRecord(d)["DestinationId"] === destinationId,
  );
  const destinations = [...stream.Destinations];
  if (existingIdx >= 0) {
    destinations[existingIdx] = {
      ...asRecord(destinations[existingIdx]),
      ...updateData,
      DestinationId: destinationId,
    };
  } else {
    destinations.push({ DestinationId: destinationId, ...updateData });
  }
  ctx.store.set(`${streamPrefix}${name}`, {
    ...stream,
    Destinations: destinations,
    VersionId: String(Number(stream.VersionId) + 1),
    LastUpdateTimestamp: Math.floor(Date.now() / 1000),
  });
  return {};
};

const firehose: ServiceDefinition = {
  name: "firehose",
  protocol: "json",
  operations: {
    CreateDeliveryStream,
    DescribeDeliveryStream,
    ListDeliveryStreams,
    DeleteDeliveryStream,
    PutRecord,
    PutRecordBatch,
    TagDeliveryStream,
    ListTagsForDeliveryStream,
    UntagDeliveryStream,
    StartDeliveryStreamEncryption,
    StopDeliveryStreamEncryption,
    UpdateDestination,
  },
  model,
} as const;

export default firehose;
