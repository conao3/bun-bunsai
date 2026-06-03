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

type StoredShard = {
  ShardId: string;
  ParentShardId: string | undefined;
  AdjacentParentShardId: string | undefined;
  StartingHashKey: string;
  EndingHashKey: string;
  Status: "OPEN" | "CLOSED";
  StartingSequenceNumber: string;
  EndingSequenceNumber: string | undefined;
};

type StoredConsumer = {
  ConsumerName: string;
  ConsumerARN: string;
  ConsumerStatus: string;
  ConsumerCreationTimestamp: number;
  StreamARN: string;
};

type StoredStream = {
  StreamName: string;
  StreamARN: string;
  StreamStatus: string;
  RetentionPeriodHours: number;
  StreamCreationTimestamp: number;
  nextSequence: number;
  nextShardIndex: number;
  shards: StoredShard[];
  records: StoredRecord[];
  tags: Record<string, string>;
  shardLevelMetrics: string[];
  encryptionType: string;
  keyId: string | undefined;
  streamMode: string;
  maxRecordSizeInKiB: number;
  warmThroughputMiBps: number | undefined;
};

const initialHashKeyRange = {
  start: "0",
  end: "340282366920938463463374607431768211455",
} as const;

const streamKey = (name: string): string => `stream/${name}`;

const consumerKey = (streamArn: string, consumerName: string): string =>
  `consumer/${streamArn}/${consumerName}`;

const policyKey = (resourceArn: string): string => `policy/${resourceArn}`;

const accountSettingsKey = "accountsettings" as const;

const streamArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:kinesis:${region}:${account}:stream/${name}`;

const nameFromStreamArn = (arn: string): string => {
  const segments = arn.split("/");
  return segments[segments.length - 1] ?? "";
};

const streamArnFromConsumerArn = (consumerArn: string): string =>
  consumerArn.split("/consumer/")[0] ?? "";

const consumerNameFromArn = (consumerArn: string): string => {
  const parts = consumerArn.split("/consumer/");
  const afterConsumer = parts[1] ?? "";
  return afterConsumer.split(":")[0] ?? "";
};

const consumerArnOf = (
  streamArn: string,
  consumerName: string,
  timestamp: number,
): string => `${streamArn}/consumer/${consumerName}:${timestamp}`;

const newShardId = (index: number): string =>
  `shardId-${String(index).padStart(12, "0")}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidArgumentException", `${key} is required.`, 400);
  }
  return value;
};

const requireNumber = (input: Record<string, unknown>, key: string): number => {
  const value = input[key];
  if (typeof value !== "number") {
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

const resolveConsumerIdentifier = (
  input: Record<string, unknown>,
): { streamArn: string; consumerName: string } => {
  const consumerArn = input["ConsumerARN"];
  if (typeof consumerArn === "string" && consumerArn !== "") {
    return {
      streamArn: streamArnFromConsumerArn(consumerArn),
      consumerName: consumerNameFromArn(consumerArn),
    };
  }
  const streamArn = input["StreamARN"];
  const consumerName = input["ConsumerName"];
  if (
    typeof streamArn === "string" &&
    streamArn !== "" &&
    typeof consumerName === "string" &&
    consumerName !== ""
  ) {
    return { streamArn, consumerName };
  }
  throw awsError(
    "InvalidArgumentException",
    "Either ConsumerARN or StreamARN+ConsumerName is required.",
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

const shardDescription = (shard: StoredShard): Record<string, unknown> => {
  const desc: Record<string, unknown> = {
    ShardId: shard.ShardId,
    HashKeyRange: {
      StartingHashKey: shard.StartingHashKey,
      EndingHashKey: shard.EndingHashKey,
    },
    SequenceNumberRange: {
      StartingSequenceNumber: shard.StartingSequenceNumber,
      ...(shard.EndingSequenceNumber !== undefined
        ? { EndingSequenceNumber: shard.EndingSequenceNumber }
        : {}),
    },
  };
  if (shard.ParentShardId !== undefined) {
    desc["ParentShardId"] = shard.ParentShardId;
  }
  if (shard.AdjacentParentShardId !== undefined) {
    desc["AdjacentParentShardId"] = shard.AdjacentParentShardId;
  }
  return desc;
};

const makeInitialShard = (sequence: number): StoredShard => ({
  ShardId: newShardId(0),
  ParentShardId: undefined,
  AdjacentParentShardId: undefined,
  StartingHashKey: initialHashKeyRange.start,
  EndingHashKey: initialHashKeyRange.end,
  Status: "OPEN",
  StartingSequenceNumber: sequenceString(sequence),
  EndingSequenceNumber: undefined,
});

const countConsumers = (ctx: ServiceContext, streamArn: string): number =>
  ctx.store
    .list<StoredConsumer>()
    .filter((entry) => entry.key.startsWith(`consumer/${streamArn}/`)).length;

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
    nextSequence: 0,
    nextShardIndex: 1,
    shards: [makeInitialShard(0)],
    records: [],
    tags: {},
    shardLevelMetrics: [],
    encryptionType: "NONE",
    keyId: undefined,
    streamMode: "PROVISIONED",
    maxRecordSizeInKiB: 1024,
    warmThroughputMiBps: undefined,
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
      Shards: stream.shards.map(shardDescription),
      HasMoreShards: false,
      RetentionPeriodHours: stream.RetentionPeriodHours,
      StreamCreationTimestamp: stream.StreamCreationTimestamp,
      EnhancedMonitoring: [{ ShardLevelMetrics: stream.shardLevelMetrics }],
      EncryptionType: stream.encryptionType,
      ...(stream.keyId !== undefined ? { KeyId: stream.keyId } : {}),
      StreamModeDetails: { StreamMode: stream.streamMode },
    },
  };
};

const DescribeStreamSummary: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const openShardCount = stream.shards.filter(
    (s) => s.Status === "OPEN",
  ).length;
  return {
    StreamDescriptionSummary: {
      StreamName: stream.StreamName,
      StreamARN: stream.StreamARN,
      StreamStatus: stream.StreamStatus,
      RetentionPeriodHours: stream.RetentionPeriodHours,
      StreamCreationTimestamp: stream.StreamCreationTimestamp,
      EnhancedMonitoring: [{ ShardLevelMetrics: stream.shardLevelMetrics }],
      EncryptionType: stream.encryptionType,
      OpenShardCount: openShardCount,
      ConsumerCount: countConsumers(ctx, stream.StreamARN),
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
    ShardId:
      stream.shards.find((s) => s.Status === "OPEN")?.ShardId ?? newShardId(0),
    SequenceNumber: record.SequenceNumber,
    EncryptionType: stream.encryptionType,
  };
};

const PutRecords: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const openShardId =
    stream.shards.find((s) => s.Status === "OPEN")?.ShardId ?? newShardId(0);
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
      ShardId: openShardId,
    };
  });
  ctx.store.set(streamKey(name), stream);
  return {
    FailedRecordCount: 0,
    Records: results,
    EncryptionType: stream.encryptionType,
  };
};

const iteratorOf = (name: string, shardId: string, position: number): string =>
  Buffer.from(`${name}|${shardId}|${position}`, "binary").toString("base64");

const parseIterator = (
  iterator: string,
): { name: string; shardId: string; position: number } => {
  const decoded = Buffer.from(iterator, "base64").toString("binary");
  const segments = decoded.split("|");
  const name = segments[0] ?? "";
  const shardId = segments[1] ?? "";
  const position = Number(segments[2] ?? "0");
  return { name, shardId, position: Number.isNaN(position) ? 0 : position };
};

const GetShardIterator: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const inputShardId = requireString(input, "ShardId");
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
  return {
    ShardIterator: iteratorOf(stream.StreamName, inputShardId, position),
  };
};

const GetRecords: OperationHandler = (input, ctx) => {
  const iterator = requireString(input, "ShardIterator");
  const { name, shardId: itShardId, position } = parseIterator(iterator);
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
      EncryptionType: stream.encryptionType,
    })),
    NextShardIterator: iteratorOf(stream.StreamName, itShardId, nextPosition),
    MillisBehindLatest: 0,
  };
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

const ListShards: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  return {
    Shards: stream.shards.map(shardDescription),
  };
};

const MergeShards: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const shardToMerge = requireString(input, "ShardToMerge");
  const adjacentShardToMerge = requireString(input, "AdjacentShardToMerge");
  const shard1 = stream.shards.find(
    (s) => s.ShardId === shardToMerge && s.Status === "OPEN",
  );
  const shard2 = stream.shards.find(
    (s) => s.ShardId === adjacentShardToMerge && s.Status === "OPEN",
  );
  if (shard1 === undefined || shard2 === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Shard not found in stream ${name}.`,
      400,
    );
  }
  shard1.Status = "CLOSED";
  shard1.EndingSequenceNumber = sequenceString(stream.nextSequence);
  shard2.Status = "CLOSED";
  shard2.EndingSequenceNumber = sequenceString(stream.nextSequence);
  const startHash =
    BigInt(shard1.StartingHashKey) <= BigInt(shard2.StartingHashKey)
      ? shard1.StartingHashKey
      : shard2.StartingHashKey;
  const endHash =
    BigInt(shard1.EndingHashKey) >= BigInt(shard2.EndingHashKey)
      ? shard1.EndingHashKey
      : shard2.EndingHashKey;
  stream.shards.push({
    ShardId: newShardId(stream.nextShardIndex),
    ParentShardId: shardToMerge,
    AdjacentParentShardId: adjacentShardToMerge,
    StartingHashKey: startHash,
    EndingHashKey: endHash,
    Status: "OPEN",
    StartingSequenceNumber: sequenceString(stream.nextSequence),
    EndingSequenceNumber: undefined,
  });
  stream.nextShardIndex += 1;
  ctx.store.set(streamKey(name), stream);
  return {};
};

const SplitShard: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const shardToSplit = requireString(input, "ShardToSplit");
  const newStartingHashKey = requireString(input, "NewStartingHashKey");
  const shard = stream.shards.find(
    (s) => s.ShardId === shardToSplit && s.Status === "OPEN",
  );
  if (shard === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Shard ${shardToSplit} not found in stream ${name}.`,
      400,
    );
  }
  shard.Status = "CLOSED";
  shard.EndingSequenceNumber = sequenceString(stream.nextSequence);
  const prevHashKey = String(BigInt(newStartingHashKey) - 1n);
  stream.shards.push({
    ShardId: newShardId(stream.nextShardIndex),
    ParentShardId: shardToSplit,
    AdjacentParentShardId: undefined,
    StartingHashKey: shard.StartingHashKey,
    EndingHashKey: prevHashKey,
    Status: "OPEN",
    StartingSequenceNumber: sequenceString(stream.nextSequence),
    EndingSequenceNumber: undefined,
  });
  stream.nextShardIndex += 1;
  stream.shards.push({
    ShardId: newShardId(stream.nextShardIndex),
    ParentShardId: shardToSplit,
    AdjacentParentShardId: undefined,
    StartingHashKey: newStartingHashKey,
    EndingHashKey: shard.EndingHashKey,
    Status: "OPEN",
    StartingSequenceNumber: sequenceString(stream.nextSequence),
    EndingSequenceNumber: undefined,
  });
  stream.nextShardIndex += 1;
  ctx.store.set(streamKey(name), stream);
  return {};
};

const UpdateShardCount: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const targetShardCount = requireNumber(input, "TargetShardCount");
  const currentShardCount = stream.shards.filter(
    (s) => s.Status === "OPEN",
  ).length;
  for (const shard of stream.shards) {
    if (shard.Status === "OPEN") {
      shard.Status = "CLOSED";
      shard.EndingSequenceNumber = sequenceString(stream.nextSequence);
    }
  }
  const hashRange = BigInt("340282366920938463463374607431768211455");
  const perShard = hashRange / BigInt(targetShardCount);
  for (let i = 0; i < targetShardCount; i++) {
    const startHash = String(BigInt(i) * perShard);
    const endHash =
      i === targetShardCount - 1
        ? String(hashRange)
        : String(BigInt(i + 1) * perShard - 1n);
    stream.shards.push({
      ShardId: newShardId(stream.nextShardIndex),
      ParentShardId: undefined,
      AdjacentParentShardId: undefined,
      StartingHashKey: startHash,
      EndingHashKey: endHash,
      Status: "OPEN",
      StartingSequenceNumber: sequenceString(stream.nextSequence),
      EndingSequenceNumber: undefined,
    });
    stream.nextShardIndex += 1;
  }
  ctx.store.set(streamKey(name), stream);
  return {
    StreamName: stream.StreamName,
    CurrentShardCount: currentShardCount,
    TargetShardCount: targetShardCount,
    StreamARN: stream.StreamARN,
  };
};

const RegisterStreamConsumer: OperationHandler = (input, ctx) => {
  const streamArn = requireString(input, "StreamARN");
  const consumerName = requireString(input, "ConsumerName");
  const streamName = nameFromStreamArn(streamArn);
  requireStream(ctx, streamName);
  const existing = ctx.store.get<StoredConsumer>(
    consumerKey(streamArn, consumerName),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUseException",
      `Consumer ${consumerName} already exists for stream ${streamArn}.`,
      400,
    );
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const consumer: StoredConsumer = {
    ConsumerName: consumerName,
    ConsumerARN: consumerArnOf(streamArn, consumerName, timestamp),
    ConsumerStatus: "ACTIVE",
    ConsumerCreationTimestamp: timestamp,
    StreamARN: streamArn,
  };
  ctx.store.set(consumerKey(streamArn, consumerName), consumer);
  return {
    Consumer: {
      ConsumerName: consumer.ConsumerName,
      ConsumerARN: consumer.ConsumerARN,
      ConsumerStatus: consumer.ConsumerStatus,
      ConsumerCreationTimestamp: consumer.ConsumerCreationTimestamp,
    },
  };
};

const DeregisterStreamConsumer: OperationHandler = (input, ctx) => {
  const { streamArn, consumerName } = resolveConsumerIdentifier(input);
  const key = consumerKey(streamArn, consumerName);
  const consumer = ctx.store.get<StoredConsumer>(key);
  if (consumer === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Consumer ${consumerName} not found.`,
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const DescribeStreamConsumer: OperationHandler = (input, ctx) => {
  const { streamArn, consumerName } = resolveConsumerIdentifier(input);
  const consumer = ctx.store.get<StoredConsumer>(
    consumerKey(streamArn, consumerName),
  );
  if (consumer === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Consumer ${consumerName} not found.`,
      400,
    );
  }
  return {
    ConsumerDescription: {
      ConsumerName: consumer.ConsumerName,
      ConsumerARN: consumer.ConsumerARN,
      ConsumerStatus: consumer.ConsumerStatus,
      ConsumerCreationTimestamp: consumer.ConsumerCreationTimestamp,
      StreamARN: consumer.StreamARN,
    },
  };
};

const ListStreamConsumers: OperationHandler = (input, ctx) => {
  const streamArn = requireString(input, "StreamARN");
  const streamName = nameFromStreamArn(streamArn);
  requireStream(ctx, streamName);
  const consumers = ctx.store
    .list<StoredConsumer>()
    .filter((entry) => entry.key.startsWith(`consumer/${streamArn}/`))
    .map((entry) => entry.value)
    .map((c) => ({
      ConsumerName: c.ConsumerName,
      ConsumerARN: c.ConsumerARN,
      ConsumerStatus: c.ConsumerStatus,
      ConsumerCreationTimestamp: c.ConsumerCreationTimestamp,
    }));
  return { Consumers: consumers };
};

const SubscribeToShard: OperationHandler = (_input, _ctx) => ({
  EventStream: {
    SubscribeToShardEvent: {
      Records: [],
      ContinuationSequenceNumber: "0",
      MillisBehindLatest: 0,
    },
  },
});

const StartStreamEncryption: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  stream.encryptionType = requireString(input, "EncryptionType");
  stream.keyId = requireString(input, "KeyId");
  ctx.store.set(streamKey(name), stream);
  return {};
};

const StopStreamEncryption: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  stream.encryptionType = "NONE";
  stream.keyId = undefined;
  ctx.store.set(streamKey(name), stream);
  return {};
};

const UpdateStreamMode: OperationHandler = (input, ctx) => {
  const streamArn = requireString(input, "StreamARN");
  const name = nameFromStreamArn(streamArn);
  const stream = requireStream(ctx, name);
  const modeDetails = input["StreamModeDetails"];
  if (typeof modeDetails === "object" && modeDetails !== null) {
    const mode = (modeDetails as Record<string, unknown>)["StreamMode"];
    if (typeof mode === "string") {
      stream.streamMode = mode;
    }
  }
  ctx.store.set(streamKey(name), stream);
  return {};
};

const UpdateMaxRecordSize: OperationHandler = (input, ctx) => {
  const streamArn = requireString(input, "StreamARN");
  const name = nameFromStreamArn(streamArn);
  const stream = requireStream(ctx, name);
  stream.maxRecordSizeInKiB = requireNumber(input, "MaxRecordSizeInKiB");
  ctx.store.set(streamKey(name), stream);
  return {};
};

const UpdateStreamWarmThroughput: OperationHandler = (input, ctx) => {
  const name = resolveStreamName(input);
  const stream = requireStream(ctx, name);
  const warmThroughputMiBps = requireNumber(input, "WarmThroughputMiBps");
  stream.warmThroughputMiBps = warmThroughputMiBps;
  ctx.store.set(streamKey(name), stream);
  return {
    StreamARN: stream.StreamARN,
    StreamName: stream.StreamName,
    WarmThroughput: {
      TargetMiBps: warmThroughputMiBps,
      CurrentMiBps: warmThroughputMiBps,
    },
  };
};

const DescribeLimits: OperationHandler = (_input, ctx) => {
  const streams = ctx.store
    .list<StoredStream>()
    .filter((entry) => entry.key.startsWith("stream/"))
    .map((entry) => entry.value);
  const openShardCount = streams.reduce(
    (sum, s) => sum + s.shards.filter((sh) => sh.Status === "OPEN").length,
    0,
  );
  const onDemandStreamCount = streams.filter(
    (s) => s.streamMode === "ON_DEMAND",
  ).length;
  return {
    ShardLimit: 10000,
    OpenShardCount: openShardCount,
    OnDemandStreamCount: onDemandStreamCount,
    OnDemandStreamCountLimit: 50,
  };
};

const DescribeAccountSettings: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<Record<string, unknown>>(accountSettingsKey);
  return {
    MinimumThroughputBillingCommitment: stored ?? { Status: "DISABLED" },
  };
};

const UpdateAccountSettings: OperationHandler = (input, ctx) => {
  const commitment = input["MinimumThroughputBillingCommitment"];
  const inputStatus =
    typeof commitment === "object" && commitment !== null
      ? ((commitment as Record<string, unknown>)["Status"] as
          | string
          | undefined)
      : undefined;
  const status = inputStatus ?? "DISABLED";
  const updated: Record<string, unknown> = { Status: status };
  ctx.store.set(accountSettingsKey, updated);
  return {
    MinimumThroughputBillingCommitment: updated,
  };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const policy = requireString(input, "Policy");
  ctx.store.set(policyKey(resourceArn), policy);
  return {};
};

const GetResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const policy = ctx.store.get<string>(policyKey(resourceArn));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource policy for ${resourceArn} not found.`,
      400,
    );
  }
  return { Policy: policy };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  ctx.store.delete(policyKey(resourceArn));
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const streamName = nameFromStreamArn(resourceArn);
  const stream = requireStream(ctx, streamName);
  const tags =
    typeof input["Tags"] === "object" && input["Tags"] !== null
      ? (input["Tags"] as Record<string, unknown>)
      : {};
  for (const [key, value] of Object.entries(tags)) {
    stream.tags[key] = typeof value === "string" ? value : String(value);
  }
  ctx.store.set(streamKey(streamName), stream);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const streamName = nameFromStreamArn(resourceArn);
  const stream = requireStream(ctx, streamName);
  const keys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as unknown[])
    : [];
  for (const key of keys) {
    if (typeof key === "string") {
      delete stream.tags[key];
    }
  }
  ctx.store.set(streamKey(streamName), stream);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const streamName = nameFromStreamArn(resourceArn);
  const stream = requireStream(ctx, streamName);
  const tags = Object.entries(stream.tags)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([Key, Value]) => ({ Key, Value }));
  return { Tags: tags };
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
    ListShards,
    MergeShards,
    SplitShard,
    UpdateShardCount,
    RegisterStreamConsumer,
    DeregisterStreamConsumer,
    DescribeStreamConsumer,
    ListStreamConsumers,
    SubscribeToShard,
    StartStreamEncryption,
    StopStreamEncryption,
    UpdateStreamMode,
    UpdateMaxRecordSize,
    UpdateStreamWarmThroughput,
    DescribeLimits,
    DescribeAccountSettings,
    UpdateAccountSettings,
    PutResourcePolicy,
    GetResourcePolicy,
    DeleteResourcePolicy,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default kinesis;
