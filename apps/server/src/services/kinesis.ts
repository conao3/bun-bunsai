import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import kinesisModel from "../../../../test/vendor/aws-models/kinesis.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(kinesisModel);

type StoredRecord = {
  SequenceNumber: string;
  Data: string;
  PartitionKey: string;
  ApproximateArrivalTimestamp: number;
};

type StoredStream = {
  StreamName: string;
  StreamARN: string;
  StreamStatus: string;
  RetentionPeriodHours: number;
  StreamCreationTimestamp: number;
  ShardId: string;
  nextSequence: number;
  records: StoredRecord[];
  tags: Record<string, string>;
  shardLevelMetrics: string[];
};

const shardId = "shardId-000000000000" as const;

const startingHashKey = "0" as const;

const endingHashKey = "340282366920938463463374607431768211455" as const;

const streamKey = (name: string): string => `stream/${name}`;

const streamArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:kinesis:${region}:${account}:stream/${name}`;

const nameFromStreamArn = (arn: string): string => {
  const segments = arn.split("/");
  return segments[segments.length - 1] ?? "";
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidArgumentException", `${key} is required.`, 400);
  }
  return value;
};

const resolveStreamName = (input: Record<string, unknown>): string => {
  const streamName = input["StreamName"];
  if (typeof streamName === "string" && streamName !== "") {
    return streamName;
  }
  const streamArn = input["StreamARN"];
  if (typeof streamArn === "string" && streamArn !== "") {
    return nameFromStreamArn(streamArn);
  }
  throw awsError(
    "InvalidArgumentException",
    "Either StreamName or StreamARN is required.",
    400,
  );
};

const requireStream = (ctx: ServiceContext, name: string): StoredStream => {
  const stream = ctx.store.get<StoredStream>(streamKey(name));
  if (stream === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Stream ${name} under account ${ctx.account} not found.`,
      400,
    );
  }
  return stream;
};

const sequenceString = (value: number): string => String(value);

const blobToBinary = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("binary");
  }
  return String(value);
};

const shardDescription = (stream: StoredStream): Record<string, unknown> => {
  const sequenceNumbers = stream.records.map((record) => record.SequenceNumber);
  return {
    ShardId: stream.ShardId,
    HashKeyRange: {
      StartingHashKey: startingHashKey,
      EndingHashKey: endingHashKey,
    },
    SequenceNumberRange: {
      StartingSequenceNumber: sequenceNumbers[0] ?? sequenceString(0),
    },
  };
};

const CreateStream: OperationHandler = (input, ctx) => {
  const name = requireString(input, "StreamName");
  const existing = ctx.store.get<StoredStream>(streamKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUseException",
      `Stream ${name} under account ${ctx.account} already exists.`,
      400,
    );
  }
  const stream: StoredStream = {
    StreamName: name,
    StreamARN: streamArnOf(ctx.region, ctx.account, name),
    StreamStatus: "ACTIVE",
    RetentionPeriodHours: 24,
    StreamCreationTimestamp: Math.floor(Date.now() / 1000),
    ShardId: shardId,
    nextSequence: 0,
    records: [],
    tags: {},
    shardLevelMetrics: [],
  };
  ctx.store.set(streamKey(name), stream);
  return {};
};

const DeleteStream: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  requireStream(ctx, name);
  ctx.store.delete(streamKey(name));
  return {};
};

const ListStreams: OperationHandler = (_input, ctx) => {
  const streams = ctx.store
    .list<StoredStream>()
    .filter((entry) => entry.key.startsWith("stream/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.StreamName.localeCompare(b.StreamName));
  return {
    StreamNames: streams.map((stream) => stream.StreamName),
    HasMoreStreams: false,
    StreamSummaries: streams.map((stream) => ({
      StreamName: stream.StreamName,
      StreamARN: stream.StreamARN,
      StreamStatus: stream.StreamStatus,
      StreamCreationTimestamp: stream.StreamCreationTimestamp,
    })),
  };
};

const DescribeStream: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  return {
    StreamDescription: {
      StreamName: stream.StreamName,
      StreamARN: stream.StreamARN,
      StreamStatus: stream.StreamStatus,
      Shards: [shardDescription(stream)],
      HasMoreShards: false,
      RetentionPeriodHours: stream.RetentionPeriodHours,
      StreamCreationTimestamp: stream.StreamCreationTimestamp,
      EnhancedMonitoring: [{ ShardLevelMetrics: stream.shardLevelMetrics }],
      EncryptionType: "NONE",
    },
  };
};

const DescribeStreamSummary: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  return {
    StreamDescriptionSummary: {
      StreamName: stream.StreamName,
      StreamARN: stream.StreamARN,
      StreamStatus: stream.StreamStatus,
      RetentionPeriodHours: stream.RetentionPeriodHours,
      StreamCreationTimestamp: stream.StreamCreationTimestamp,
      EnhancedMonitoring: [{ ShardLevelMetrics: stream.shardLevelMetrics }],
      EncryptionType: "NONE",
      OpenShardCount: 1,
      ConsumerCount: 0,
    },
  };
};

const appendRecord = (
  stream: StoredStream,
  data: unknown,
  partitionKey: string,
): StoredRecord => {
  const record: StoredRecord = {
    SequenceNumber: sequenceString(stream.nextSequence),
    Data: blobToBinary(data),
    PartitionKey: partitionKey,
    ApproximateArrivalTimestamp: Math.floor(Date.now() / 1000),
  };
  stream.nextSequence += 1;
  stream.records.push(record);
  return record;
};

const PutRecord: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const partitionKey = requireString(input, "PartitionKey");
  const record = appendRecord(stream, input["Data"], partitionKey);
  ctx.store.set(streamKey(name), stream);
  return {
    ShardId: stream.ShardId,
    SequenceNumber: record.SequenceNumber,
    EncryptionType: "NONE",
  };
};

const PutRecords: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const entries = Array.isArray(input["Records"])
    ? (input["Records"] as Record<string, unknown>[])
    : [];
  const results = entries.map((entry) => {
    const partitionKey =
      typeof entry["PartitionKey"] === "string"
        ? (entry["PartitionKey"] as string)
        : "";
    const record = appendRecord(stream, entry["Data"], partitionKey);
    return {
      SequenceNumber: record.SequenceNumber,
      ShardId: stream.ShardId,
    };
  });
  ctx.store.set(streamKey(name), stream);
  return {
    FailedRecordCount: 0,
    Records: results,
    EncryptionType: "NONE",
  };
};

const iteratorOf = (name: string, position: number): string =>
  Buffer.from(`${name}|${shardId}|${position}`, "binary").toString("base64");

const parseIterator = (
  iterator: string,
): { name: string; position: number } => {
  const decoded = Buffer.from(iterator, "base64").toString("binary");
  const segments = decoded.split("|");
  const name = segments[0] ?? "";
  const position = Number(segments[2] ?? "0");
  return { name, position: Number.isNaN(position) ? 0 : position };
};

const GetShardIterator: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  requireString(input, "ShardId");
  const iteratorType = requireString(input, "ShardIteratorType");
  let position = 0;
  if (iteratorType === "LATEST") {
    position = stream.nextSequence;
  } else if (
    iteratorType === "AT_SEQUENCE_NUMBER" ||
    iteratorType === "AFTER_SEQUENCE_NUMBER"
  ) {
    const startingSequence = input["StartingSequenceNumber"];
    const parsed =
      typeof startingSequence === "string" ? Number(startingSequence) : 0;
    const base = Number.isNaN(parsed) ? 0 : parsed;
    position = iteratorType === "AFTER_SEQUENCE_NUMBER" ? base + 1 : base;
  }
  return { ShardIterator: iteratorOf(stream.StreamName, position) };
};

const GetRecords: OperationHandler = (input, ctx) => {
  const iterator = requireString(input, "ShardIterator");
  const { name, position } = parseIterator(iterator);
  const stream = requireStream(ctx, name);
  const limit =
    typeof input["Limit"] === "number" ? (input["Limit"] as number) : 10000;
  const available = stream.records.slice(position);
  const selected = available.slice(0, limit);
  const nextPosition = position + selected.length;
  return {
    Records: selected.map((record) => ({
      SequenceNumber: record.SequenceNumber,
      ApproximateArrivalTimestamp: record.ApproximateArrivalTimestamp,
      Data: record.Data,
      PartitionKey: record.PartitionKey,
      EncryptionType: "NONE",
    })),
    NextShardIterator: iteratorOf(stream.StreamName, nextPosition),
    MillisBehindLatest: 0,
  };
};

const requireNumber = (input: Record<string, unknown>, key: string): number => {
  const value = input[key];
  if (typeof value !== "number") {
    throw awsError("InvalidArgumentException", `${key} is required.`, 400);
  }
  return value;
};

const IncreaseStreamRetentionPeriod: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const hours = requireNumber(input, "RetentionPeriodHours");
  if (hours <= stream.RetentionPeriodHours) {
    throw awsError(
      "InvalidArgumentException",
      `Requested retention period (${hours} hours) for stream ${name} must be longer than existing retention period (${stream.RetentionPeriodHours} hours).`,
      400,
    );
  }
  stream.RetentionPeriodHours = hours;
  ctx.store.set(streamKey(name), stream);
  return {};
};

const DecreaseStreamRetentionPeriod: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const hours = requireNumber(input, "RetentionPeriodHours");
  if (hours >= stream.RetentionPeriodHours) {
    throw awsError(
      "InvalidArgumentException",
      `Requested retention period (${hours} hours) for stream ${name} must be shorter than existing retention period (${stream.RetentionPeriodHours} hours).`,
      400,
    );
  }
  stream.RetentionPeriodHours = hours;
  ctx.store.set(streamKey(name), stream);
  return {};
};

const AddTagsToStream: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const tags =
    typeof input["Tags"] === "object" && input["Tags"] !== null
      ? (input["Tags"] as Record<string, unknown>)
      : {};
  for (const [key, value] of Object.entries(tags)) {
    stream.tags[key] = typeof value === "string" ? value : String(value);
  }
  ctx.store.set(streamKey(name), stream);
  return {};
};

const ListTagsForStream: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const tags = Object.entries(stream.tags)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([Key, Value]) => ({ Key, Value }));
  return {
    Tags: tags,
    HasMoreTags: false,
  };
};

const RemoveTagsFromStream: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const keys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as unknown[])
    : [];
  for (const key of keys) {
    if (typeof key === "string") {
      delete stream.tags[key];
    }
  }
  ctx.store.set(streamKey(name), stream);
  return {};
};

const metricsFrom = (input: Record<string, unknown>): string[] => {
  const list = Array.isArray(input["ShardLevelMetrics"])
    ? (input["ShardLevelMetrics"] as unknown[])
    : [];
  return list.filter((item): item is string => typeof item === "string");
};

const EnableEnhancedMonitoring: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const current = [...stream.shardLevelMetrics];
  const requested = metricsFrom(input);
  const enabled = requested.includes("ALL") ? ["ALL"] : requested;
  const merged = enabled.includes("ALL")
    ? ["ALL"]
    : Array.from(new Set([...current, ...enabled]));
  stream.shardLevelMetrics = merged;
  ctx.store.set(streamKey(name), stream);
  return {
    StreamName: stream.StreamName,
    StreamARN: stream.StreamARN,
    CurrentShardLevelMetrics: current,
    DesiredShardLevelMetrics: merged,
  };
};

const DisableEnhancedMonitoring: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const current = [...stream.shardLevelMetrics];
  const requested = metricsFrom(input);
  const remaining = requested.includes("ALL")
    ? []
    : current.filter((metric) => !requested.includes(metric));
  stream.shardLevelMetrics = remaining;
  ctx.store.set(streamKey(name), stream);
  return {
    StreamName: stream.StreamName,
    StreamARN: stream.StreamARN,
    CurrentShardLevelMetrics: current,
    DesiredShardLevelMetrics: remaining,
  };
};

const kinesis = {
  name: "kinesis",
  protocol: "json",
  operations: {
    CreateStream,
    DescribeStream,
    DescribeStreamSummary,
    ListStreams,
    DeleteStream,
    PutRecord,
    PutRecords,
    GetShardIterator,
    GetRecords,
    IncreaseStreamRetentionPeriod,
    DecreaseStreamRetentionPeriod,
    AddTagsToStream,
    ListTagsForStream,
    RemoveTagsFromStream,
    EnableEnhancedMonitoring,
    DisableEnhancedMonitoring,
  },
  model,
} as const satisfies ServiceDefinition;

export default kinesis;
