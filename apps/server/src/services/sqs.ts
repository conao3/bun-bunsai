import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import sqsModel from "../../models/sqs.json" with { type: "json" };
import type {
  OperationHandler,
  ScopedStore,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";
import { notifyEventSource, registerTarget } from "../core/events.ts";
import { serviceBaseUrl } from "./_endpoint.ts";

const model = loadServiceModel(sqsModel);

type StoredMessage = {
  MessageId: string;
  ReceiptHandle: string;
  Body: string;
  MD5OfBody: string;
  MessageAttributes: Record<string, unknown> | undefined;
  MD5OfMessageAttributes: string | undefined;
  invisibleUntil: number;
  receiveCount: number;
  SentTimestamp: number;
  firstReceivedAt: number | undefined;
  SenderId: string;
  MessageGroupId: string | undefined;
  MessageDeduplicationId: string | undefined;
  SequenceNumber: string | undefined;
};

type DedupEntry = {
  time: number;
  messageId: string;
  sequenceNumber: string;
  md5OfBody: string;
  md5OfMessageAttributes: string | undefined;
};

type StoredQueue = {
  QueueName: string;
  QueueUrl: string;
  Attributes: Record<string, string>;
  Tags: Record<string, string>;
  messages: StoredMessage[];
  createdAt: number;
  modifiedAt: number;
  sequence: number;
  dedup: Record<string, DedupEntry>;
};

const md5Hex = (value: string): string => {
  const hasher = new Bun.CryptoHasher("md5");
  hasher.update(value);
  return hasher.digest("hex");
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const updateLengthPrefixed = (
  hasher: Bun.CryptoHasher,
  bytes: Uint8Array,
): void => {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, bytes.length, false);
  hasher.update(length);
  hasher.update(bytes);
};

const md5OfMessageAttributes = (
  attributes: Record<string, unknown> | undefined,
): string | undefined => {
  if (attributes === undefined) return undefined;
  const names = Object.keys(attributes).sort();
  if (names.length === 0) return undefined;
  const encoder = new TextEncoder();
  const hasher = new Bun.CryptoHasher("md5");
  for (const name of names) {
    const attribute = attributes[name] as Record<string, unknown>;
    const dataType =
      typeof attribute["DataType"] === "string"
        ? (attribute["DataType"] as string)
        : "String";
    updateLengthPrefixed(hasher, encoder.encode(name));
    updateLengthPrefixed(hasher, encoder.encode(dataType));
    const stringValue = attribute["StringValue"];
    const binaryValue = attribute["BinaryValue"];
    if (typeof stringValue === "string") {
      hasher.update(new Uint8Array([1]));
      updateLengthPrefixed(hasher, encoder.encode(stringValue));
    } else if (binaryValue !== undefined) {
      hasher.update(new Uint8Array([2]));
      const bytes =
        binaryValue instanceof Uint8Array
          ? binaryValue
          : typeof binaryValue === "string"
            ? Uint8Array.from(binaryValue, (c) => c.charCodeAt(0))
            : new Uint8Array();
      updateLengthPrefixed(hasher, bytes);
    }
  }
  return hasher.digest("hex");
};

const toIntOr = (raw: unknown, fallback: number): number => {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : fallback;
  return Number.isFinite(value) ? value : fallback;
};

const queueVisibilityDefault = (queue: StoredQueue): number =>
  toIntOr(queue.Attributes["VisibilityTimeout"], 30);

const queueDelayDefault = (queue: StoredQueue): number =>
  toIntOr(queue.Attributes["DelaySeconds"], 0);

const messageAttributesOf = (
  source: Record<string, unknown>,
): Record<string, unknown> | undefined =>
  typeof source["MessageAttributes"] === "object" &&
  source["MessageAttributes"] !== null
    ? (source["MessageAttributes"] as Record<string, unknown>)
    : undefined;

type EnqueueOptions = {
  body: string;
  messageAttributes: Record<string, unknown> | undefined;
  delaySeconds: number;
  senderId: string;
  groupId: string | undefined;
  deduplicationId: string | undefined;
  sequenceNumber: string | undefined;
};

const enqueueMessage = (
  queue: StoredQueue,
  options: EnqueueOptions,
): StoredMessage => {
  const now = Date.now();
  const message: StoredMessage = {
    MessageId: crypto.randomUUID(),
    ReceiptHandle: crypto.randomUUID(),
    Body: options.body,
    MD5OfBody: md5Hex(options.body),
    MessageAttributes: options.messageAttributes,
    MD5OfMessageAttributes: md5OfMessageAttributes(options.messageAttributes),
    invisibleUntil:
      options.delaySeconds > 0 ? now + options.delaySeconds * 1000 : 0,
    receiveCount: 0,
    SentTimestamp: now,
    firstReceivedAt: undefined,
    SenderId: options.senderId,
    MessageGroupId: options.groupId,
    MessageDeduplicationId: options.deduplicationId,
    SequenceNumber: options.sequenceNumber,
  };
  queue.messages.push(message);
  return message;
};

const DEDUP_WINDOW_MS = 5 * 60 * 1000;

const isFifoQueue = (queue: StoredQueue): boolean =>
  queue.Attributes["FifoQueue"] === "true" || queue.QueueName.endsWith(".fifo");

const sha256Hex = (value: string): string => {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(value);
  return hasher.digest("hex");
};

const pruneDedup = (queue: StoredQueue, now: number): void => {
  for (const [id, entry] of Object.entries(queue.dedup)) {
    if (now - entry.time > DEDUP_WINDOW_MS) delete queue.dedup[id];
  }
};

type SendOutcome =
  | {
      ok: true;
      result: {
        MessageId: string;
        MD5OfMessageBody: string;
        MD5OfMessageAttributes?: string;
        SequenceNumber?: string;
      };
    }
  | { ok: false; code: string; message: string };

const sendOne = (
  queue: StoredQueue,
  source: Record<string, unknown>,
  senderId: string,
): SendOutcome => {
  const body =
    typeof source["MessageBody"] === "string"
      ? (source["MessageBody"] as string)
      : "";
  const messageAttributes = messageAttributesOf(source);
  const fifo = isFifoQueue(queue);
  let groupId: string | undefined;
  let deduplicationId: string | undefined;
  if (fifo) {
    const rawGroup = source["MessageGroupId"];
    if (typeof rawGroup !== "string" || rawGroup === "") {
      return {
        ok: false,
        code: "MissingParameter",
        message: "The request must contain the parameter MessageGroupId.",
      };
    }
    groupId = rawGroup;
    const explicitDedup = source["MessageDeduplicationId"];
    if (typeof explicitDedup === "string" && explicitDedup !== "") {
      deduplicationId = explicitDedup;
    } else if (queue.Attributes["ContentBasedDeduplication"] === "true") {
      deduplicationId = sha256Hex(body);
    } else {
      return {
        ok: false,
        code: "InvalidParameterValue",
        message:
          "The queue should either have ContentBasedDeduplication enabled or MessageDeduplicationId provided explicitly.",
      };
    }
    const now = Date.now();
    pruneDedup(queue, now);
    const existing = queue.dedup[deduplicationId];
    if (existing !== undefined) {
      return {
        ok: true,
        result: {
          MessageId: existing.messageId,
          MD5OfMessageBody: existing.md5OfBody,
          ...(existing.md5OfMessageAttributes !== undefined
            ? { MD5OfMessageAttributes: existing.md5OfMessageAttributes }
            : {}),
          SequenceNumber: existing.sequenceNumber,
        },
      };
    }
  }
  const delaySeconds = fifo
    ? 0
    : toIntOr(source["DelaySeconds"], queueDelayDefault(queue));
  const sequenceNumber = fifo ? String(queue.sequence++) : undefined;
  const message = enqueueMessage(queue, {
    body,
    messageAttributes,
    delaySeconds,
    senderId,
    groupId,
    deduplicationId,
    sequenceNumber,
  });
  if (fifo && deduplicationId !== undefined) {
    queue.dedup[deduplicationId] = {
      time: Date.now(),
      messageId: message.MessageId,
      sequenceNumber: sequenceNumber ?? "",
      md5OfBody: message.MD5OfBody,
      md5OfMessageAttributes: message.MD5OfMessageAttributes,
    };
  }
  return {
    ok: true,
    result: {
      MessageId: message.MessageId,
      MD5OfMessageBody: message.MD5OfBody,
      ...(message.MD5OfMessageAttributes !== undefined
        ? { MD5OfMessageAttributes: message.MD5OfMessageAttributes }
        : {}),
      ...(sequenceNumber !== undefined
        ? { SequenceNumber: sequenceNumber }
        : {}),
    },
  };
};

const systemAttributesRequest = (
  input: Record<string, unknown>,
): Set<string> => {
  const names = new Set<string>();
  for (const key of ["AttributeNames", "MessageSystemAttributeNames"]) {
    const raw = input[key];
    if (Array.isArray(raw)) {
      for (const value of raw as unknown[]) names.add(String(value));
    } else if (typeof raw === "string" && raw !== "") {
      names.add(raw);
    }
  }
  return names;
};

const messageAttributeNamesRequest = (
  input: Record<string, unknown>,
): Set<string> => {
  const names = new Set<string>();
  const raw = input["MessageAttributeNames"];
  if (Array.isArray(raw)) {
    for (const value of raw as unknown[]) names.add(String(value));
  } else if (typeof raw === "string" && raw !== "") {
    names.add(raw);
  }
  return names;
};

const filterMessageAttributes = (
  attrs: Record<string, unknown> | undefined,
  requested: Set<string>,
): Record<string, unknown> | undefined => {
  if (attrs === undefined || requested.size === 0) return undefined;
  if (requested.has("All")) return attrs;
  const filtered: Record<string, unknown> = {};
  for (const name of requested) {
    if (name in attrs) filtered[name] = attrs[name];
  }
  return Object.keys(filtered).length > 0 ? filtered : undefined;
};

const buildSystemAttributes = (
  message: StoredMessage,
  requested: Set<string>,
): Record<string, string> | undefined => {
  if (requested.size === 0) return undefined;
  const all = requested.has("All");
  const available: Record<string, string> = {
    ApproximateReceiveCount: String(message.receiveCount),
    SentTimestamp: String(message.SentTimestamp),
    SenderId: message.SenderId,
  };
  if (message.firstReceivedAt !== undefined) {
    available["ApproximateFirstReceiveTimestamp"] = String(
      message.firstReceivedAt,
    );
  }
  if (message.MessageGroupId !== undefined) {
    available["MessageGroupId"] = message.MessageGroupId;
  }
  if (message.SequenceNumber !== undefined) {
    available["SequenceNumber"] = message.SequenceNumber;
  }
  if (message.MessageDeduplicationId !== undefined) {
    available["MessageDeduplicationId"] = message.MessageDeduplicationId;
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(available)) {
    if (all || requested.has(key)) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

const queueUrlOf = (account: string, name: string): string =>
  `${serviceBaseUrl()}/${account}/${name}`;

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
  const nameIsFifo = name.endsWith(".fifo");
  const attrIsFifo = attributes["FifoQueue"] === "true";
  if (nameIsFifo !== attrIsFifo) {
    throw awsError(
      "InvalidParameterValue",
      "The name of a FIFO queue can only include alphanumeric characters, hyphens, or underscores, must end with the .fifo suffix, and must be used together with the FifoQueue attribute set to true.",
      400,
    );
  }
  const existing = ctx.store.get<StoredQueue>(name);
  if (existing !== undefined) {
    const allKeys = new Set([
      ...Object.keys(existing.Attributes),
      ...Object.keys(attributes),
    ]);
    for (const key of allKeys) {
      if (existing.Attributes[key] !== attributes[key]) {
        throw awsError(
          "QueueNameExists",
          "A queue with this name already exists. Amazon SQS returns this error only if the request includes attributes whose values differ from those of the existing queue.",
          400,
        );
      }
    }
    return { QueueUrl: existing.QueueUrl };
  }
  const tags =
    typeof input["tags"] === "object" && input["tags"] !== null
      ? (input["tags"] as Record<string, string>)
      : {};
  const now = Date.now();
  const queue: StoredQueue = {
    QueueName: name,
    QueueUrl: url,
    Attributes: { ...attributes },
    Tags: { ...tags },
    messages: [],
    createdAt: now,
    modifiedAt: now,
    sequence: 1,
    dedup: {},
  };
  ctx.store.set(name, queue);
  return { QueueUrl: url };
};

const ListQueues: OperationHandler = (input, ctx) => {
  const prefix = input["QueueNamePrefix"];
  const maxResults =
    typeof input["MaxResults"] === "number" ? input["MaxResults"] : undefined;
  const nextToken =
    typeof input["NextToken"] === "string" ? input["NextToken"] : undefined;

  const urls = ctx.store
    .list<StoredQueue>()
    .filter((entry) =>
      typeof prefix === "string" && prefix !== ""
        ? entry.key.startsWith(prefix)
        : true,
    )
    .map((entry) => entry.value.QueueUrl);

  let startIndex = 0;
  if (nextToken !== undefined) {
    const decoded = parseInt(
      Buffer.from(nextToken, "base64").toString("utf8"),
      10,
    );
    if (!isNaN(decoded)) startIndex = decoded;
  }

  const page =
    maxResults !== undefined
      ? urls.slice(startIndex, startIndex + maxResults)
      : urls.slice(startIndex);
  const newNextToken =
    maxResults !== undefined && startIndex + maxResults < urls.length
      ? Buffer.from(String(startIndex + maxResults)).toString("base64")
      : undefined;

  return {
    QueueUrls: page,
    ...(newNextToken !== undefined ? { NextToken: newNextToken } : {}),
  };
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

const sqsEventRecord = (
  message: StoredMessage,
  queueArn: string,
  region: string,
): Record<string, unknown> => ({
  messageId: message.MessageId,
  receiptHandle: message.ReceiptHandle,
  body: message.Body,
  attributes: {
    ApproximateReceiveCount: "1",
    SentTimestamp: String(message.SentTimestamp),
    SenderId: message.SenderId,
    ApproximateFirstReceiveTimestamp: String(message.SentTimestamp),
  },
  messageAttributes: message.MessageAttributes ?? {},
  md5OfBody: message.MD5OfBody,
  eventSource: "aws:sqs",
  eventSourceARN: queueArn,
  awsRegion: region,
});

const triggerEventSource = async (
  ctx: ServiceContext,
  store: ScopedStore,
  queueName: string,
  message: StoredMessage,
): Promise<void> => {
  const queue = store.get<StoredQueue>(queueName);
  if (queue === undefined) return;
  const queueArn = `arn:aws:sqs:${store.scope.region}:${store.scope.account}:${queueName}`;
  const consumed = await notifyEventSource(ctx, queueArn, [
    sqsEventRecord(message, queueArn, store.scope.region),
  ]);
  if (consumed) {
    queue.messages = queue.messages.filter(
      (m) => m.MessageId !== message.MessageId,
    );
    store.set(queueName, queue);
  }
};

const SendMessage: OperationHandler = async (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const outcome = sendOne(queue, input, ctx.account);
  if (!outcome.ok) {
    throw awsError(outcome.code, outcome.message, 400);
  }
  ctx.store.set(name, queue);
  const sent = queue.messages.find(
    (m) => m.MessageId === outcome.result.MessageId,
  );
  if (sent !== undefined) await triggerEventSource(ctx, ctx.store, name, sent);
  return outcome.result;
};

type RedriveConfig = {
  targetName: string;
  maxReceiveCount: number;
};

const redriveConfigOf = (queue: StoredQueue): RedriveConfig | undefined => {
  const raw = queue.Attributes["RedrivePolicy"];
  if (typeof raw !== "string" || raw === "") return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const target = parsed["deadLetterTargetArn"];
    if (typeof target !== "string" || target === "") return undefined;
    const maxReceiveCount = toIntOr(parsed["maxReceiveCount"], 0);
    if (maxReceiveCount <= 0) return undefined;
    return { targetName: nameFromArn(target), maxReceiveCount };
  } catch {
    return undefined;
  }
};

const moveToDeadLetter = (
  ctx: ServiceContext,
  targetName: string,
  message: StoredMessage,
): boolean => {
  const dlq = ctx.store.get<StoredQueue>(targetName);
  if (dlq === undefined) return false;
  dlq.messages.push({
    ...message,
    ReceiptHandle: crypto.randomUUID(),
    invisibleUntil: 0,
    receiveCount: 0,
    firstReceivedAt: undefined,
  });
  ctx.store.set(targetName, dlq);
  return true;
};

const selectVisibleMessages = (
  ctx: ServiceContext,
  queue: StoredQueue,
  limit: number,
  visibilitySeconds: number,
  now: number,
): StoredMessage[] => {
  const redrive = redriveConfigOf(queue);
  const fifo = isFifoQueue(queue);
  const lockedGroups = new Set<string>();
  if (fifo) {
    for (const message of queue.messages) {
      if (
        message.invisibleUntil > now &&
        message.MessageGroupId !== undefined
      ) {
        lockedGroups.add(message.MessageGroupId);
      }
    }
  }
  const selected: StoredMessage[] = [];
  const remaining: StoredMessage[] = [];
  for (const message of queue.messages) {
    if (message.invisibleUntil > now) {
      remaining.push(message);
      continue;
    }
    if (
      redrive !== undefined &&
      message.receiveCount >= redrive.maxReceiveCount &&
      moveToDeadLetter(ctx, redrive.targetName, message)
    ) {
      continue;
    }
    const group = message.MessageGroupId;
    if (
      selected.length >= limit ||
      (fifo && group !== undefined && lockedGroups.has(group))
    ) {
      remaining.push(message);
      continue;
    }
    message.invisibleUntil = now + visibilitySeconds * 1000;
    message.receiveCount += 1;
    if (message.firstReceivedAt === undefined) message.firstReceivedAt = now;
    message.ReceiptHandle = crypto.randomUUID();
    if (fifo && group !== undefined) lockedGroups.add(group);
    selected.push(message);
    remaining.push(message);
  }
  queue.messages = remaining;
  return selected;
};

const ReceiveMessage: OperationHandler = async (input, ctx) => {
  const name = queueNameFromInput(input);
  let queue = requireQueue(ctx, name);
  const rawMax = input["MaxNumberOfMessages"];
  const max =
    typeof rawMax === "number"
      ? rawMax
      : typeof rawMax === "string"
        ? Number.parseInt(rawMax, 10)
        : 1;
  const limit = Number.isFinite(max) && max > 0 ? Math.min(max, 10) : 1;
  const visibilitySeconds =
    input["VisibilityTimeout"] === undefined
      ? queueVisibilityDefault(queue)
      : toIntOr(input["VisibilityTimeout"], queueVisibilityDefault(queue));
  const systemRequest = systemAttributesRequest(input);
  const messageAttrRequest = messageAttributeNamesRequest(input);
  const waitRaw =
    input["WaitTimeSeconds"] === undefined
      ? toIntOr(queue.Attributes["ReceiveMessageWaitTimeSeconds"], 0)
      : toIntOr(input["WaitTimeSeconds"], 0);
  const waitSeconds = Math.max(0, Math.min(waitRaw, 20));
  const deadline = Date.now() + waitSeconds * 1000;
  let selected = selectVisibleMessages(
    ctx,
    queue,
    limit,
    visibilitySeconds,
    Date.now(),
  );
  while (selected.length === 0 && Date.now() < deadline) {
    await sleep(Math.min(100, Math.max(1, deadline - Date.now())));
    const refreshed = ctx.store.get<StoredQueue>(name);
    if (refreshed === undefined) break;
    queue = refreshed;
    selected = selectVisibleMessages(
      ctx,
      queue,
      limit,
      visibilitySeconds,
      Date.now(),
    );
  }
  ctx.store.set(name, queue);
  return {
    Messages: selected.map((message) => {
      const attributes = buildSystemAttributes(message, systemRequest);
      const filteredMsgAttrs = filterMessageAttributes(
        message.MessageAttributes,
        messageAttrRequest,
      );
      return {
        MessageId: message.MessageId,
        ReceiptHandle: message.ReceiptHandle,
        MD5OfBody: message.MD5OfBody,
        Body: message.Body,
        ...(filteredMsgAttrs !== undefined
          ? { MessageAttributes: filteredMsgAttrs }
          : {}),
        ...(filteredMsgAttrs !== undefined &&
        message.MD5OfMessageAttributes !== undefined
          ? { MD5OfMessageAttributes: message.MD5OfMessageAttributes }
          : {}),
        ...(attributes !== undefined ? { Attributes: attributes } : {}),
      };
    }),
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
  const delayed = queue.messages.filter(
    (message) => message.invisibleUntil > now && message.receiveCount === 0,
  ).length;
  const notVisible = queue.messages.length - visible - delayed;
  const isFifo = queue.QueueName.endsWith(".fifo");
  const defaults: Record<string, string> = {
    DelaySeconds: "0",
    MaximumMessageSize: "262144",
    MessageRetentionPeriod: "345600",
    ReceiveMessageWaitTimeSeconds: "0",
    VisibilityTimeout: "30",
    SqsManagedSseEnabled: isFifo ? "false" : "true",
  };
  const computed: Record<string, string> = {
    ...defaults,
    ...queue.Attributes,
    QueueArn: `arn:aws:sqs:${ctx.region}:${ctx.account}:${name}`,
    ApproximateNumberOfMessages: String(visible),
    ApproximateNumberOfMessagesNotVisible: String(notVisible),
    ApproximateNumberOfMessagesDelayed: String(delayed),
    CreatedTimestamp: String(Math.floor(queue.createdAt / 1000)),
    LastModifiedTimestamp: String(Math.floor(queue.modifiedAt / 1000)),
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
  queue.modifiedAt = Date.now();
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

const toVisibilitySeconds = (raw: unknown): number => {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : 30;
  return Number.isFinite(value) ? value : 30;
};

const ChangeMessageVisibility: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const receiptHandle = input["ReceiptHandle"];
  if (typeof receiptHandle !== "string" || receiptHandle === "") {
    throw awsError("MissingParameter", "ReceiptHandle is required.", 400);
  }
  const message = queue.messages.find(
    (entry) => entry.ReceiptHandle === receiptHandle,
  );
  if (message === undefined) {
    throw awsError(
      "ReceiptHandleIsInvalid",
      `The input receipt handle "${receiptHandle}" is not valid.`,
      400,
    );
  }
  message.invisibleUntil =
    Date.now() + toVisibilitySeconds(input["VisibilityTimeout"]) * 1000;
  ctx.store.set(name, queue);
  return {};
};

type BatchEntry = Record<string, unknown>;

const entryId = (entry: BatchEntry, index: number): string => {
  const id = entry["Id"];
  return typeof id === "string" && id !== "" ? id : String(index);
};

const batchEntriesFromInput = (
  input: Record<string, unknown>,
): BatchEntry[] => {
  const entries = input["Entries"];
  if (!Array.isArray(entries) || entries.length === 0) {
    throw awsError(
      "AWS.SimpleQueueService.EmptyBatchRequest",
      "There should be at least one SendMessageBatchRequestEntry in the request.",
      400,
    );
  }
  if (entries.length > 10) {
    throw awsError(
      "AWS.SimpleQueueService.TooManyEntriesInBatchRequest",
      "Maximum number of entries per request are 10.",
      400,
    );
  }
  const seen = new Set<string>();
  for (const [index, entry] of (entries as BatchEntry[]).entries()) {
    const id = entryId(entry, index);
    if (seen.has(id)) {
      throw awsError(
        "AWS.SimpleQueueService.BatchEntryIdsNotDistinct",
        "Two or more batch entries in the request have the same Id.",
        400,
      );
    }
    seen.add(id);
  }
  return entries as BatchEntry[];
};

const SendMessageBatch: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const entries = batchEntriesFromInput(input);
  const successful: Record<string, string>[] = [];
  const failed: Record<string, unknown>[] = [];
  for (const [index, entry] of entries.entries()) {
    const id = entryId(entry, index);
    const body = entry["MessageBody"];
    if (typeof body !== "string") {
      failed.push({
        Id: id,
        SenderFault: true,
        Code: "MissingParameter",
        Message: "MessageBody is required.",
      });
      continue;
    }
    const outcome = sendOne(queue, entry, ctx.account);
    if (!outcome.ok) {
      failed.push({
        Id: id,
        SenderFault: true,
        Code: outcome.code,
        Message: outcome.message,
      });
      continue;
    }
    successful.push({ Id: id, ...outcome.result });
  }
  ctx.store.set(name, queue);
  return { Successful: successful, Failed: failed };
};

const DeleteMessageBatch: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const entries = batchEntriesFromInput(input);
  const successful: Record<string, string>[] = [];
  const failed: Record<string, unknown>[] = [];
  for (const [index, entry] of entries.entries()) {
    const id = entryId(entry, index);
    const receiptHandle = entry["ReceiptHandle"];
    const messageIndex =
      typeof receiptHandle === "string"
        ? queue.messages.findIndex(
            (message) => message.ReceiptHandle === receiptHandle,
          )
        : -1;
    if (messageIndex < 0) {
      failed.push({
        Id: id,
        SenderFault: true,
        Code: "ReceiptHandleIsInvalid",
        Message: "The specified receipt handle is not valid.",
      });
      continue;
    }
    queue.messages.splice(messageIndex, 1);
    successful.push({ Id: id });
  }
  ctx.store.set(name, queue);
  return { Successful: successful, Failed: failed };
};

const ChangeMessageVisibilityBatch: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const entries = batchEntriesFromInput(input);
  const successful: Record<string, string>[] = [];
  const failed: Record<string, unknown>[] = [];
  const now = Date.now();
  for (const [index, entry] of entries.entries()) {
    const id = entryId(entry, index);
    const receiptHandle = entry["ReceiptHandle"];
    const message =
      typeof receiptHandle === "string"
        ? queue.messages.find(
            (candidate) => candidate.ReceiptHandle === receiptHandle,
          )
        : undefined;
    if (message === undefined) {
      failed.push({
        Id: id,
        SenderFault: true,
        Code: "ReceiptHandleIsInvalid",
        Message: "The specified receipt handle is not valid.",
      });
      continue;
    }
    message.invisibleUntil =
      now + toVisibilitySeconds(entry["VisibilityTimeout"]) * 1000;
    successful.push({ Id: id });
  }
  ctx.store.set(name, queue);
  return { Successful: successful, Failed: failed };
};

type StoredMoveTask = {
  TaskHandle: string;
  Status: string;
  SourceArn: string;
  DestinationArn: string | undefined;
  MaxNumberOfMessagesPerSecond: number | undefined;
  ApproximateNumberOfMessagesMoved: number;
  ApproximateNumberOfMessagesToMove: number | undefined;
  StartedTimestamp: number;
};

const MOVE_TASKS_KEY = "__moveTasks";

const nameFromArn = (arn: string): string => {
  const parts = arn.split(":");
  return parts[parts.length - 1] ?? "";
};

type PolicyStatement = {
  Sid: string;
  Effect: string;
  Principal: { AWS: string[] };
  Action: string[];
  Resource: string;
};

type PolicyDoc = {
  Version: string;
  Statement: PolicyStatement[];
};

const readPolicy = (queue: StoredQueue): PolicyDoc => {
  const raw = queue.Attributes["Policy"];
  if (typeof raw === "string" && raw !== "") {
    try {
      return JSON.parse(raw) as PolicyDoc;
    } catch {
      void 0;
    }
  }
  return { Version: "2012-10-17", Statement: [] };
};

const AddPermission: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const label = input["Label"];
  if (typeof label !== "string" || label === "") {
    throw awsError("MissingParameter", "Label is required.", 400);
  }
  const rawIds = input["AWSAccountIds"];
  const accountIds = Array.isArray(rawIds)
    ? (rawIds as unknown[]).map((v) => String(v))
    : [];
  const rawActions = input["Actions"];
  const actions = Array.isArray(rawActions)
    ? (rawActions as unknown[]).map((v) => {
        const s = String(v);
        return s === "*" || s.includes(":") ? s : `sqs:${s}`;
      })
    : [];
  const queueArn = `arn:aws:sqs:${ctx.region}:${ctx.account}:${name}`;
  const policy = readPolicy(queue);
  policy.Statement = policy.Statement.filter((stmt) => stmt.Sid !== label);
  policy.Statement.push({
    Sid: label,
    Effect: "Allow",
    Principal: { AWS: accountIds },
    Action: actions,
    Resource: queueArn,
  });
  queue.Attributes["Policy"] = JSON.stringify(policy);
  ctx.store.set(name, queue);
  return {};
};

const RemovePermission: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  const queue = requireQueue(ctx, name);
  const label = input["Label"];
  if (typeof label !== "string" || label === "") {
    throw awsError("MissingParameter", "Label is required.", 400);
  }
  const policy = readPolicy(queue);
  policy.Statement = policy.Statement.filter((stmt) => stmt.Sid !== label);
  queue.Attributes["Policy"] = JSON.stringify(policy);
  ctx.store.set(name, queue);
  return {};
};

const requireSourceQueue = (
  ctx: ServiceContext,
  sourceArn: string,
): StoredQueue => {
  const name = nameFromArn(sourceArn);
  const queue = ctx.store.get<StoredQueue>(name);
  if (queue === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified resource does not exist.",
      400,
    );
  }
  return queue;
};

const findRedriveDestination = (
  ctx: ServiceContext,
  deadLetterArn: string,
): string | undefined => {
  for (const entry of ctx.store.list<StoredQueue>()) {
    if (redriveTargetArn(entry.value) === deadLetterArn) {
      return entry.value.QueueName;
    }
  }
  return undefined;
};

const StartMessageMoveTask: OperationHandler = (input, ctx) => {
  const sourceArn = input["SourceArn"];
  if (typeof sourceArn !== "string" || sourceArn === "") {
    throw awsError("MissingParameter", "SourceArn is required.", 400);
  }
  const queue = requireSourceQueue(ctx, sourceArn);
  const destinationArn =
    typeof input["DestinationArn"] === "string" &&
    input["DestinationArn"] !== ""
      ? (input["DestinationArn"] as string)
      : undefined;
  const rawMax = input["MaxNumberOfMessagesPerSecond"];
  const parsedMax =
    typeof rawMax === "number"
      ? rawMax
      : typeof rawMax === "string"
        ? Number.parseInt(rawMax, 10)
        : undefined;
  const maxPerSecond =
    parsedMax !== undefined && Number.isFinite(parsedMax)
      ? parsedMax
      : undefined;
  const toMove = queue.messages.length;
  const destinationName =
    destinationArn !== undefined
      ? nameFromArn(destinationArn)
      : findRedriveDestination(ctx, sourceArn);
  let moved = 0;
  if (destinationName !== undefined && toMove > 0) {
    const destination = ctx.store.get<StoredQueue>(destinationName);
    if (destination !== undefined) {
      for (const message of queue.messages) {
        destination.messages.push({
          ...message,
          ReceiptHandle: crypto.randomUUID(),
          invisibleUntil: 0,
          receiveCount: 0,
          firstReceivedAt: undefined,
        });
        moved += 1;
      }
      queue.messages = [];
      ctx.store.set(destination.QueueName, destination);
      ctx.store.set(queue.QueueName, queue);
    }
  }
  const taskHandle = crypto.randomUUID();
  const task: StoredMoveTask = {
    TaskHandle: taskHandle,
    Status: moved > 0 ? "COMPLETED" : "RUNNING",
    SourceArn: sourceArn,
    DestinationArn: destinationArn,
    MaxNumberOfMessagesPerSecond: maxPerSecond,
    ApproximateNumberOfMessagesMoved: moved,
    ApproximateNumberOfMessagesToMove: toMove,
    StartedTimestamp: Date.now(),
  };
  const tasks = ctx.store.get<StoredMoveTask[]>(MOVE_TASKS_KEY) ?? [];
  tasks.unshift(task);
  ctx.store.set(MOVE_TASKS_KEY, tasks);
  return { TaskHandle: taskHandle };
};

const ListMessageMoveTasks: OperationHandler = (input, ctx) => {
  const sourceArn = input["SourceArn"];
  if (typeof sourceArn !== "string" || sourceArn === "") {
    throw awsError("MissingParameter", "SourceArn is required.", 400);
  }
  requireSourceQueue(ctx, sourceArn);
  const rawMax = input["MaxResults"];
  const parsedMax =
    typeof rawMax === "number"
      ? rawMax
      : typeof rawMax === "string"
        ? Number.parseInt(rawMax, 10)
        : 1;
  const limit =
    Number.isFinite(parsedMax) && parsedMax > 0 ? Math.min(parsedMax, 10) : 1;
  const allTasks = ctx.store.get<StoredMoveTask[]>(MOVE_TASKS_KEY) ?? [];
  const results = allTasks
    .filter((task) => task.SourceArn === sourceArn)
    .slice(0, limit)
    .map((task) => ({
      TaskHandle: task.Status === "RUNNING" ? task.TaskHandle : undefined,
      Status: task.Status,
      SourceArn: task.SourceArn,
      DestinationArn: task.DestinationArn,
      MaxNumberOfMessagesPerSecond: task.MaxNumberOfMessagesPerSecond,
      ApproximateNumberOfMessagesMoved: task.ApproximateNumberOfMessagesMoved,
      ApproximateNumberOfMessagesToMove: task.ApproximateNumberOfMessagesToMove,
      StartedTimestamp: task.StartedTimestamp,
    }));
  return { Results: results };
};

const CancelMessageMoveTask: OperationHandler = (input, ctx) => {
  const taskHandle = input["TaskHandle"];
  if (typeof taskHandle !== "string" || taskHandle === "") {
    throw awsError("MissingParameter", "TaskHandle is required.", 400);
  }
  const tasks = ctx.store.get<StoredMoveTask[]>(MOVE_TASKS_KEY) ?? [];
  const task = tasks.find((t) => t.TaskHandle === taskHandle);
  if (task === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified resource does not exist.",
      400,
    );
  }
  task.Status = "CANCELLED";
  ctx.store.set(MOVE_TASKS_KEY, tasks);
  return {
    ApproximateNumberOfMessagesMoved: task.ApproximateNumberOfMessagesMoved,
  };
};

const redriveTargetArn = (queue: StoredQueue): string | undefined => {
  const policy = queue.Attributes["RedrivePolicy"];
  if (typeof policy !== "string" || policy === "") return undefined;
  try {
    const parsed = JSON.parse(policy) as Record<string, unknown>;
    const target = parsed["deadLetterTargetArn"];
    return typeof target === "string" ? target : undefined;
  } catch {
    return undefined;
  }
};

const ListDeadLetterSourceQueues: OperationHandler = (input, ctx) => {
  const name = queueNameFromInput(input);
  requireQueue(ctx, name);
  const targetArn = `arn:aws:sqs:${ctx.region}:${ctx.account}:${name}`;
  const maxResults =
    typeof input["MaxResults"] === "number" ? input["MaxResults"] : undefined;
  const nextToken =
    typeof input["NextToken"] === "string" ? input["NextToken"] : undefined;

  const queueUrls = ctx.store
    .list<StoredQueue>()
    .filter((entry) => redriveTargetArn(entry.value) === targetArn)
    .map((entry) => entry.value.QueueUrl);

  let startIndex = 0;
  if (nextToken !== undefined) {
    const decoded = parseInt(
      Buffer.from(nextToken, "base64").toString("utf8"),
      10,
    );
    if (!isNaN(decoded)) startIndex = decoded;
  }

  const page =
    maxResults !== undefined
      ? queueUrls.slice(startIndex, startIndex + maxResults)
      : queueUrls.slice(startIndex);
  const newNextToken =
    maxResults !== undefined && startIndex + maxResults < queueUrls.length
      ? Buffer.from(String(startIndex + maxResults)).toString("base64")
      : undefined;

  return {
    queueUrls: page,
    ...(newNextToken !== undefined ? { NextToken: newNextToken } : {}),
  };
};

registerTarget("sqs", async (store, resource, delivery, ctx) => {
  const queue = store.get<StoredQueue>(resource);
  if (queue === undefined) return;
  const message = enqueueMessage(queue, {
    body: delivery.body,
    messageAttributes: delivery.messageAttributes,
    delaySeconds: 0,
    senderId: "AIDAIENSOURCEDELIVERY",
    groupId: undefined,
    deduplicationId: undefined,
    sequenceNumber: undefined,
  });
  store.set(resource, queue);
  await triggerEventSource(ctx, store, resource, message);
});

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
    ChangeMessageVisibility,
    SendMessageBatch,
    DeleteMessageBatch,
    ChangeMessageVisibilityBatch,
    ListDeadLetterSourceQueues,
    AddPermission,
    RemovePermission,
    StartMessageMoveTask,
    ListMessageMoveTasks,
    CancelMessageMoveTask,
  },
  model,
} as const;

export default sqs;
