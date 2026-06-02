import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import sqsModel from "../../../../test/vendor/aws-models/sqs.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(sqsModel);

type StoredMessage = {
  MessageId: string;
  ReceiptHandle: string;
  Body: string;
  MD5OfBody: string;
  MessageAttributes: Record<string, unknown> | undefined;
  invisibleUntil: number;
  receiveCount: number;
};

type StoredQueue = {
  QueueName: string;
  QueueUrl: string;
  Attributes: Record<string, string>;
  Tags: Record<string, string>;
  messages: StoredMessage[];
};

const md5Hex = (value: string): string => {
  const hasher = new Bun.CryptoHasher("md5");
  hasher.update(value);
  return hasher.digest("hex");
};

const queueUrlOf = (account: string, name: string): string =>
  `http://localhost:4566/${account}/${name}`;

const nameFromQueueUrl = (queueUrl: string): string => {
  const trimmed = queueUrl.replace(/\/+$/, "");
  const segments = trimmed.split("/");
  return segments[segments.length - 1] ?? "";
};

const requireQueue = (ctx: ServiceContext, name: string): StoredQueue => {
  const queue = ctx.store.get<StoredQueue>(name);
  if (queue === undefined) {
    throw awsError(
      "AWS.SimpleQueueService.NonExistentQueue",
      "The specified queue does not exist.",
      400,
    );
  }
  return queue;
};

const queueNameFromInput = (input: Record<string, unknown>): string => {
  const queueUrl = input["QueueUrl"];
  if (typeof queueUrl === "string" && queueUrl !== "") {
    return nameFromQueueUrl(queueUrl);
  }
  throw awsError("MissingParameter", "QueueUrl is required.", 400);
};

const CreateQueue: OperationHandler = (input, ctx) => {
  const name = input["QueueName"];
  if (typeof name !== "string" || name === "") {
    throw awsError("MissingParameter", "QueueName is required.", 400);
  }
  const url = queueUrlOf(ctx.account, name);
  const attributes =
    typeof input["Attributes"] === "object" && input["Attributes"] !== null
      ? (input["Attributes"] as Record<string, string>)
      : {};
  const existing = ctx.store.get<StoredQueue>(name);
  if (existing !== undefined) {
    return { QueueUrl: existing.QueueUrl };
  }
  const tags =
    typeof input["tags"] === "object" && input["tags"] !== null
      ? (input["tags"] as Record<string, string>)
      : {};
  const queue: StoredQueue = {
    QueueName: name,
    QueueUrl: url,
    Attributes: { ...attributes },
    Tags: { ...tags },
    messages: [],
  };
  ctx.store.set(name, queue);
  return { QueueUrl: url };
};

const ListQueues: OperationHandler = (input, ctx) => {
  const prefix = input["QueueNamePrefix"];
  const urls = ctx.store
    .list<StoredQueue>()
    .filter((entry) =>
      typeof prefix === "string" && prefix !== ""
        ? entry.key.startsWith(prefix)
        : true,
    )
    .map((entry) => entry.value.QueueUrl);
  return { QueueUrls: urls };
};

const GetQueueUrl: OperationHandler = (input, ctx) => {
  const name = input["QueueName"];
  if (typeof name !== "string" || name === "") {
    throw awsError("MissingParameter", "QueueName is required.", 400);
  }
  const queue = requireQueue(ctx, name);
  return { QueueUrl: queue.QueueUrl };
};

const DeleteQueue: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  requireQueue(ctx, name);
  ctx.store.delete(name);
  return {};
};

const SendMessage: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const body =
    typeof input["MessageBody"] === "string"
      ? (input["MessageBody"] as string)
      : "";
  const messageAttributes =
    typeof input["MessageAttributes"] === "object" &&
    input["MessageAttributes"] !== null
      ? (input["MessageAttributes"] as Record<string, unknown>)
      : undefined;
  const messageId = crypto.randomUUID();
  const receiptHandle = crypto.randomUUID();
  const message: StoredMessage = {
    MessageId: messageId,
    ReceiptHandle: receiptHandle,
    Body: body,
    MD5OfBody: md5Hex(body),
    MessageAttributes: messageAttributes,
    invisibleUntil: 0,
    receiveCount: 0,
  };
  queue.messages.push(message);
  ctx.store.set(name, queue);
  return {
    MessageId: messageId,
    MD5OfMessageBody: message.MD5OfBody,
  };
};

const ReceiveMessage: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const rawMax = input["MaxNumberOfMessages"];
  const max =
    typeof rawMax === "number"
      ? rawMax
      : typeof rawMax === "string"
        ? Number.parseInt(rawMax, 10)
        : 1;
  const limit = Number.isFinite(max) && max > 0 ? Math.min(max, 10) : 1;
  const rawVisibility = input["VisibilityTimeout"];
  const visibility =
    typeof rawVisibility === "number"
      ? rawVisibility
      : typeof rawVisibility === "string"
        ? Number.parseInt(rawVisibility, 10)
        : 30;
  const visibilitySeconds = Number.isFinite(visibility) ? visibility : 30;
  const now = Date.now();
  const selected: StoredMessage[] = [];
  for (const message of queue.messages) {
    if (selected.length >= limit) break;
    if (message.invisibleUntil > now) continue;
    message.invisibleUntil = now + visibilitySeconds * 1000;
    message.receiveCount += 1;
    message.ReceiptHandle = crypto.randomUUID();
    selected.push(message);
  }
  ctx.store.set(name, queue);
  return {
    Messages: selected.map((message) => ({
      MessageId: message.MessageId,
      ReceiptHandle: message.ReceiptHandle,
      MD5OfBody: message.MD5OfBody,
      Body: message.Body,
      MessageAttributes: message.MessageAttributes,
    })),
  };
};

const DeleteMessage: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const receiptHandle = input["ReceiptHandle"];
  if (typeof receiptHandle !== "string" || receiptHandle === "") {
    throw awsError("MissingParameter", "ReceiptHandle is required.", 400);
  }
  const index = queue.messages.findIndex(
    (message) => message.ReceiptHandle === receiptHandle,
  );
  if (index >= 0) {
    queue.messages.splice(index, 1);
    ctx.store.set(name, queue);
  }
  return {};
};

const GetQueueAttributes: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const now = Date.now();
  const visible = queue.messages.filter(
    (message) => message.invisibleUntil <= now,
  ).length;
  const notVisible = queue.messages.length - visible;
  const computed: Record<string, string> = {
    ...queue.Attributes,
    QueueArn: `arn:aws:sqs:${ctx.region}:${ctx.account}:${name}`,
    ApproximateNumberOfMessages: String(visible),
    ApproximateNumberOfMessagesNotVisible: String(notVisible),
    ApproximateNumberOfMessagesDelayed: "0",
  };
  const requested = input["AttributeNames"];
  const names = Array.isArray(requested)
    ? (requested as unknown[]).map((value) => String(value))
    : typeof requested === "string"
      ? [requested]
      : ["All"];
  if (names.includes("All")) {
    return { Attributes: computed };
  }
  const filtered: Record<string, string> = {};
  for (const attributeName of names) {
    const value = computed[attributeName];
    if (value !== undefined) filtered[attributeName] = value;
  }
  return { Attributes: filtered };
};

const TagQueue: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const tags =
    typeof input["Tags"] === "object" && input["Tags"] !== null
      ? (input["Tags"] as Record<string, string>)
      : {};
  for (const [key, value] of Object.entries(tags)) {
    queue.Tags[key] = String(value);
  }
  ctx.store.set(name, queue);
  return {};
};

const UntagQueue: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const rawKeys = input["TagKeys"];
  const keys = Array.isArray(rawKeys)
    ? (rawKeys as unknown[]).map((value) => String(value))
    : typeof rawKeys === "string"
      ? [rawKeys]
      : [];
  for (const key of keys) {
    delete queue.Tags[key];
  }
  ctx.store.set(name, queue);
  return {};
};

const ListQueueTags: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  return { Tags: { ...queue.Tags } };
};

const SetQueueAttributes: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const attributes =
    typeof input["Attributes"] === "object" && input["Attributes"] !== null
      ? (input["Attributes"] as Record<string, string>)
      : {};
  for (const [key, value] of Object.entries(attributes)) {
    queue.Attributes[key] = String(value);
  }
  ctx.store.set(name, queue);
  return {};
};

const PurgeQueue: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  queue.messages = [];
  ctx.store.set(name, queue);
  return {};
};

const sqs: ServiceDefinition = {
  name: "sqs",
  protocol: "json",
  operations: {
    CreateQueue,
    ListQueues,
    GetQueueUrl,
    DeleteQueue,
    SendMessage,
    ReceiveMessage,
    DeleteMessage,
    GetQueueAttributes,
    TagQueue,
    UntagQueue,
    ListQueueTags,
    SetQueueAttributes,
    PurgeQueue,
  },
  model,
} as const;

export default sqs;
