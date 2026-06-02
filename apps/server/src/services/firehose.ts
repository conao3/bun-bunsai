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
  const stream: StoredDeliveryStream = {
    DeliveryStreamName: name,
    DeliveryStreamARN: arn,
    DeliveryStreamStatus: "ACTIVE",
    DeliveryStreamType: type,
    VersionId: "1",
    CreateTimestamp: now,
    LastUpdateTimestamp: now,
    Destinations: [],
    HasMoreDestinations: false,
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
  requireStream(ctx, name);
  const record = asRecord(input["Record"]);
  if (record["Data"] === undefined) {
    throw awsError("InvalidArgumentException", "Record.Data is required.", 400);
  }
  return { RecordId: crypto.randomUUID(), Encrypted: false };
};

const PutRecordBatch: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeliveryStreamName");
  requireStream(ctx, name);
  const records = Array.isArray(input["Records"])
    ? (input["Records"] as unknown[])
    : [];
  const responses = records.map(() => ({
    RecordId: crypto.randomUUID(),
  }));
  return {
    FailedPutCount: 0,
    Encrypted: false,
    RequestResponses: responses,
  };
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
  },
  model,
} as const;

export default firehose;
