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
  MD5OfMessageAttributes: string | undefined;
  invisibleUntil: number;
  receiveCount: number;
  SentTimestamp: number;
  firstReceivedAt: number | undefined;
  SenderId: string;
};

type StoredQueue = {
  QueueName: string;
  QueueUrl: string;
  Attributes: Record<string, string>;
  Tags: Record<string, string>;
  messages: StoredMessage[];
  createdAt: number;
  modifiedAt: number;
};

const md5Hex = (value: string): string => {
  const hasher = new Bun.CryptoHasher("md5");
  hasher.update(value);
  return hasher.digest("hex");
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const encodeLengthPrefixed = (parts: Uint8Array[], bytes: Uint8Array): void => {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, bytes.length, false);
  parts.push(length, bytes);
};

const md5OfMessageAttributes = (
  attributes: Record<string, unknown> | undefined,
): string | undefined => {
  if (attributes === undefined) return undefined;
  const names = Object.keys(attributes).sort();
  if (names.length === 0) return undefined;
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  for (const name of names) {
    const attribute = attributes[name] as Record<string, unknown>;
    const dataType =
      typeof attribute["DataType"] === "string"
        ? (attribute["DataType"] as string)
        : "String";
    encodeLengthPrefixed(parts, encoder.encode(name));
    encodeLengthPrefixed(parts, encoder.encode(dataType));
    const stringValue = attribute["StringValue"];
    const binaryValue = attribute["BinaryValue"];
    if (typeof stringValue === "string") {
      parts.push(new Uint8Array([1]));
      encodeLengthPrefixed(parts, encoder.encode(stringValue));
    } else if (binaryValue !== undefined) {
      parts.push(new Uint8Array([2]));
      const bytes =
        binaryValue instanceof Uint8Array
          ? binaryValue
          : typeof binaryValue === "string"
            ? Uint8Array.from(atob(binaryValue), (c) => c.charCodeAt(0))
            : new Uint8Array();
      encodeLengthPrefixed(parts, bytes);
    }
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    buffer.set(part, offset);
    offset += part.length;
  }
  const hasher = new Bun.CryptoHasher("md5");
  hasher.update(buffer);
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
    invisibleUntil: options.delaySeconds > 0 ? now + options.delaySeconds * 1000 : 0,
    receiveCount: 0,
    SentTimestamp: now,
    firstReceivedAt: undefined,
    SenderId: options.senderId,
  };
  queue.messages.push(message);
  return message;
};

const systemAttributesRequest = (input: Record<string, unknown>): Set<string> => {
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
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(available)) {
    if (all || requested.has(key)) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
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
  const now = Date.now();
  const queue: StoredQueue = {
    QueueName: name,
    QueueUrl: url,
    Attributes: { ...attributes },
    Tags: { ...tags },
    messages: [],
    createdAt: now,
    modifiedAt: now,
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
  const delaySeconds = toIntOr(
    input["DelaySeconds"],
    queueDelayDefault(queue),
  );
  const message = enqueueMessage(queue, {
    body,
    messageAttributes: messageAttributesOf(input),
    delaySeconds,
    senderId: ctx.account,
  });
  ctx.store.set(name, queue);
  return {
    MessageId: message.MessageId,
    MD5OfMessageBody: message.MD5OfBody,
    ...(message.MD5OfMessageAttributes !== undefined
      ? { MD5OfMessageAttributes: message.MD5OfMessageAttributes }
      : {}),
  };
};

const selectVisibleMessages = (
  queue: StoredQueue,
  limit: number,
  visibilitySeconds: number,
  now: number,
): StoredMessage[] => {
  const selected: StoredMessage[] = [];
  for (const message of queue.messages) {
    if (selected.length >= limit) break;
    if (message.invisibleUntil > now) continue;
    message.invisibleUntil = now + visibilitySeconds * 1000;
    message.receiveCount += 1;
    if (message.firstReceivedAt === undefined) message.firstReceivedAt = now;
    message.ReceiptHandle = crypto.randomUUID();
    selected.push(message);
  }
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
  const waitRaw =
    input["WaitTimeSeconds"] === undefined
      ? toIntOr(queue.Attributes["ReceiveMessageWaitTimeSeconds"], 0)
      : toIntOr(input["WaitTimeSeconds"], 0);
  const waitSeconds = Math.max(0, Math.min(waitRaw, 20));
  const deadline = Date.now() + waitSeconds * 1000;
  let selected = selectVisibleMessages(
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
    selected = selectVisibleMessages(queue, limit, visibilitySeconds, Date.now());
  }
  ctx.store.set(name, queue);
  return {
    Messages: selected.map((message) => {
      const attributes = buildSystemAttributes(message, systemRequest);
      return {
        MessageId: message.MessageId,
        ReceiptHandle: message.ReceiptHandle,
        MD5OfBody: message.MD5OfBody,
        Body: message.Body,
        MessageAttributes: message.MessageAttributes,
        ...(message.MD5OfMessageAttributes !== undefined
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
  const computed: Record<string, string> = {
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
  return entries as BatchEntry[];
};

const entryId = (entry: BatchEntry, index: number): string => {
  const id = entry["Id"];
  return typeof id === "string" && id !== "" ? id : String(index);
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
    const delaySeconds = toIntOr(entry["DelaySeconds"], queueDelayDefault(queue));
    const message = enqueueMessage(queue, {
      body,
      messageAttributes: messageAttributesOf(entry),
      delaySeconds,
      senderId: ctx.account,
    });
    successful.push({
      Id: id,
      MessageId: message.MessageId,
      MD5OfMessageBody: message.MD5OfBody,
      ...(message.MD5OfMessageAttributes !== undefined
        ? { MD5OfMessageAttributes: message.MD5OfMessageAttributes }
        : {}),
    });
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
  const taskHandle = crypto.randomUUID();
  const task: StoredMoveTask = {
    TaskHandle: taskHandle,
    Status: "RUNNING",
    SourceArn: sourceArn,
    DestinationArn: destinationArn,
    MaxNumberOfMessagesPerSecond: maxPerSecond,
    ApproximateNumberOfMessagesMoved: 0,
    ApproximateNumberOfMessagesToMove: queue.messages.length,
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
  const queueUrls = ctx.store
    .list<StoredQueue>()
    .filter((entry) => redriveTargetArn(entry.value) === targetArn)
    .map((entry) => entry.value.QueueUrl);
  return { queueUrls };
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
