import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/dynamodbstreams.json", { with: { type: "json" } }),
  { targetPrefix: "DynamoDBStreams_20120810" },
);

const streamPrefix = "stream:" as const;

type StoredStream = {
  StreamArn: string;
  TableName: string;
  StreamLabel: string;
  StreamStatus: string;
  StreamViewType: string;
  CreationRequestDateTime: number;
  KeySchema: Array<Record<string, unknown>>;
  Shards: Array<Record<string, unknown>>;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const streamKey = (arn: string): string => `${streamPrefix}${arn}`;

const ensureStream = (ctx: ServiceContext, arn: string): StoredStream => {
  const existing = ctx.store.get<StoredStream>(streamKey(arn));
  if (existing !== undefined) return existing;
  const match =
    /^arn:aws:dynamodb:[^:]+:[^:]+:table\/([^/]+)\/stream\/(.+)$/.exec(arn);
  if (match === null) {
    throw awsError(
      "ResourceNotFoundException",
      `Stream ${arn} not found.`,
      400,
    );
  }
  const table = match[1]!;
  const label = match[2]!;
  const stream: StoredStream = {
    StreamArn: arn,
    TableName: table,
    StreamLabel: label,
    StreamStatus: "ENABLED",
    StreamViewType: "NEW_AND_OLD_IMAGES",
    CreationRequestDateTime: Math.floor(Date.now() / 1000),
    KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
    Shards: [
      {
        ShardId: "shardId-00000000000000000000-00000000",
        SequenceNumberRange: {
          StartingSequenceNumber: "0",
        },
      },
    ],
  };
  ctx.store.set(streamKey(arn), stream);
  return stream;
};

const ListStreams: OperationHandler = (input, ctx) => {
  const tableFilter = stringOrUndefined(input["TableName"]);
  const streams = ctx.store
    .list<StoredStream>()
    .filter((entry) => entry.key.startsWith(streamPrefix))
    .map((entry) => entry.value)
    .filter((s) => tableFilter === undefined || s.TableName === tableFilter)
    .sort((a, b) =>
      a.StreamArn < b.StreamArn ? -1 : a.StreamArn > b.StreamArn ? 1 : 0,
    )
    .map((s) => ({
      StreamArn: s.StreamArn,
      TableName: s.TableName,
      StreamLabel: s.StreamLabel,
    }));
  return { Streams: streams };
};

const DescribeStream: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "StreamArn");
  const stream = ensureStream(ctx, arn);
  return {
    StreamDescription: {
      StreamArn: stream.StreamArn,
      StreamLabel: stream.StreamLabel,
      StreamStatus: stream.StreamStatus,
      StreamViewType: stream.StreamViewType,
      CreationRequestDateTime: stream.CreationRequestDateTime,
      TableName: stream.TableName,
      KeySchema: stream.KeySchema,
      Shards: stream.Shards,
    },
  };
};

const GetShardIterator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "StreamArn");
  const shardId = requireString(input, "ShardId");
  const type = requireString(input, "ShardIteratorType");
  ensureStream(ctx, arn);
  const token = btoa(`${arn}|${shardId}|${type}|0`);
  return { ShardIterator: token };
};

const GetRecords: OperationHandler = (input) => {
  const iterator = requireString(input, "ShardIterator");
  const next = btoa(`${iterator}:next`);
  return { Records: [], NextShardIterator: next };
};

const dynamodbstreams = {
  name: "dynamodb",
  protocol: "json",
  operations: {
    DescribeStream,
    GetRecords,
    GetShardIterator,
    ListStreams,
  },
  model,
} as const satisfies ServiceDefinition;

export default dynamodbstreams;
