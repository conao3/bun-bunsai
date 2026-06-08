import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import snsModel from "../../../../test/vendor/aws-models/sns.json" with { type: "json" };
import type {
  OperationHandler,
  ScopedStore,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";
import { deliverToArn, registerTarget } from "../core/events.ts";

const model = loadServiceModel(snsModel);

type StoredTopic = {
  TopicArn: string;
  Name: string;
  Attributes: Record<string, string>;
};

type StoredSubscription = {
  SubscriptionArn: string;
  TopicArn: string;
  Protocol: string;
  Endpoint: string;
  Owner: string;
};

type StoredTags = {
  ResourceArn: string;
  Tags: Record<string, string>;
};

type StoredSubscriptionAttributes = {
  SubscriptionArn: string;
  Attributes: Record<string, string>;
};

type StoredPlatformApplication = {
  PlatformApplicationArn: string;
  Attributes: Record<string, string>;
};

type StoredEndpoint = {
  EndpointArn: string;
  PlatformApplicationArn: string;
  Attributes: Record<string, string>;
};

type StoredSMSAttributes = {
  attributes: Record<string, string>;
};

type StoredSandboxPhoneNumber = {
  phoneNumber: string;
  status: string;
};

const topicKey = (name: string): string => `topic/${name}`;

const subscriptionKey = (arn: string): string => `subscription/${arn}`;

const tagsKey = (arn: string): string => `tags/${arn}`;

const subscriptionAttributesKey = (arn: string): string => `subattrs/${arn}`;

const platformApplicationKey = (arn: string): string => `platform/${arn}`;

const endpointKey = (arn: string): string => `endpoint/${arn}`;

const smsAttrsKey = (): string => "sms_attrs";

const optedOutKey = (phone: string): string => `opted_out/${phone}`;

const sandboxPhoneKey = (phone: string): string => `sandbox/${phone}`;

const pendingTokenKey = (token: string): string => `pendingtoken/${token}`;

const PROTOCOLS_NEEDING_CONFIRMATION = new Set([
  "http",
  "https",
  "email",
  "email-json",
]);

const subscriptionListPageSize = 100;

const encodePageToken = (offset: number): string =>
  Buffer.from(String(offset), "utf8").toString("base64");

const decodePageToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") {
    return 0;
  }
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const topicArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sns:${region}:${account}:${name}`;

const nameFromTopicArn = (arn: string): string => {
  const segments = arn.split(":");
  return segments[segments.length - 1] ?? "";
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidParameter", `${key} is required.`, 400);
  }
  return value;
};

const requireTopic = (ctx: ServiceContext, arn: string): StoredTopic => {
  const name = nameFromTopicArn(arn);
  const topic = ctx.store.get<StoredTopic>(topicKey(name));
  if (topic === undefined) {
    throw awsError("NotFound", "Topic does not exist.", 404);
  }
  return topic;
};

const jsonMessageForProtocol = (message: string, protocol: string): string => {
  try {
    const parsed = JSON.parse(message) as Record<string, unknown>;
    const specific = parsed[protocol];
    if (typeof specific === "string") return specific;
    const fallback = parsed["default"];
    return typeof fallback === "string" ? fallback : message;
  } catch {
    return message;
  }
};

const toBase64 = (value: unknown): string => {
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }
  return typeof value === "string" ? value : "";
};

const envelopeMessageAttributes = (
  messageAttributes: Record<string, unknown>,
): Record<string, { Type: string; Value: string }> => {
  const result: Record<string, { Type: string; Value: string }> = {};
  for (const [name, raw] of Object.entries(messageAttributes)) {
    if (typeof raw !== "object" || raw === null) continue;
    const value = raw as Record<string, unknown>;
    const dataType =
      typeof value["DataType"] === "string"
        ? (value["DataType"] as string)
        : "String";
    if (typeof value["StringValue"] === "string") {
      result[name] = { Type: dataType, Value: value["StringValue"] as string };
    } else if (value["BinaryValue"] !== undefined) {
      result[name] = { Type: dataType, Value: toBase64(value["BinaryValue"]) };
    }
  }
  return result;
};

type DeliveryMessage = {
  messageId: string;
  message: string;
  messageStructure: string | undefined;
  subject: string | undefined;
  messageAttributes: Record<string, unknown> | undefined;
};

const buildEnvelope = (topicArn: string, delivery: DeliveryMessage): string => {
  const envelope: Record<string, unknown> = {
    Type: "Notification",
    MessageId: delivery.messageId,
    TopicArn: topicArn,
    Message: delivery.message,
    Timestamp: new Date().toISOString(),
    SignatureVersion: "1",
    Signature: "bunsai-local-unsigned",
    SigningCertURL:
      "http://localhost:4566/SimpleNotificationService-bunsai.pem",
    UnsubscribeURL: `http://localhost:4566/?Action=Unsubscribe&SubscriptionArn=${topicArn}`,
  };
  if (delivery.subject !== undefined) envelope["Subject"] = delivery.subject;
  if (
    delivery.messageAttributes !== undefined &&
    Object.keys(delivery.messageAttributes).length > 0
  ) {
    envelope["MessageAttributes"] = envelopeMessageAttributes(
      delivery.messageAttributes,
    );
  }
  return JSON.stringify(envelope);
};

type ActualAttribute = { value: string; isNumber: boolean };

const attributeValueFor = (
  messageAttributes: Record<string, unknown> | undefined,
  key: string,
): ActualAttribute | undefined => {
  const attribute = messageAttributes?.[key];
  if (typeof attribute !== "object" || attribute === null) return undefined;
  const value = attribute as Record<string, unknown>;
  if (typeof value["StringValue"] === "string") {
    return {
      value: value["StringValue"] as string,
      isNumber: value["DataType"] === "Number",
    };
  }
  return undefined;
};

const ruleMatches = (
  rule: unknown,
  actual: ActualAttribute | undefined,
): boolean => {
  if (typeof rule === "string") {
    return actual !== undefined && actual.value === rule;
  }
  if (typeof rule === "number") {
    return (
      actual !== undefined && actual.isNumber && Number(actual.value) === rule
    );
  }
  if (typeof rule !== "object" || rule === null) return false;
  const op = rule as Record<string, unknown>;
  if ("exists" in op) {
    return (op["exists"] === true) === (actual !== undefined);
  }
  if ("anything-but" in op) {
    const raw = op["anything-but"];
    const excluded = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    return actual !== undefined && !excluded.includes(actual.value);
  }
  if ("prefix" in op && typeof op["prefix"] === "string") {
    return actual !== undefined && actual.value.startsWith(op["prefix"]);
  }
  if ("suffix" in op && typeof op["suffix"] === "string") {
    return actual !== undefined && actual.value.endsWith(op["suffix"]);
  }
  if (
    "equals-ignore-case" in op &&
    typeof op["equals-ignore-case"] === "string"
  ) {
    return (
      actual !== undefined &&
      actual.value.toLowerCase() ===
        (op["equals-ignore-case"] as string).toLowerCase()
    );
  }
  if ("numeric" in op) {
    if (actual === undefined || !actual.isNumber) return false;
    const numVal = Number(actual.value);
    const ops = op["numeric"] as unknown[];
    const chk = (o: string, n: number): boolean => {
      if (o === "=") return numVal === n;
      if (o === "!=") return numVal !== n;
      if (o === "<") return numVal < n;
      if (o === "<=") return numVal <= n;
      if (o === ">") return numVal > n;
      if (o === ">=") return numVal >= n;
      return false;
    };
    if (ops.length === 2) return chk(ops[0] as string, ops[1] as number);
    if (ops.length === 4)
      return (
        chk(ops[0] as string, ops[1] as number) &&
        chk(ops[2] as string, ops[3] as number)
      );
    return false;
  }
  if ("cidr" in op && typeof op["cidr"] === "string") {
    if (actual === undefined) return false;
    const [network, prefixLen] = op["cidr"].split("/");
    const mask = ~((1 << (32 - Number(prefixLen))) - 1) >>> 0;
    const toInt = (ip: string): number =>
      ip
        .split(".")
        .reduce((acc: number, p: string) => (acc << 8) | Number(p), 0) >>> 0;
    return (toInt(actual.value) & mask) === (toInt(network) & mask);
  }
  return false;
};

const bodyValueRuleMatches = (rule: unknown, value: unknown): boolean => {
  if (typeof rule === "string") return value === rule;
  if (typeof rule === "number") return value === rule;
  if (typeof rule !== "object" || rule === null) return false;
  const op = rule as Record<string, unknown>;
  if ("exists" in op) {
    return (value !== undefined && value !== null) === Boolean(op["exists"]);
  }
  if ("anything-but" in op) {
    const excl = op["anything-but"];
    return Array.isArray(excl) ? !excl.includes(value) : value !== excl;
  }
  if ("prefix" in op && typeof op["prefix"] === "string") {
    return typeof value === "string" && value.startsWith(op["prefix"]);
  }
  if ("suffix" in op && typeof op["suffix"] === "string") {
    return typeof value === "string" && value.endsWith(op["suffix"]);
  }
  if (
    "equals-ignore-case" in op &&
    typeof op["equals-ignore-case"] === "string"
  ) {
    return (
      typeof value === "string" &&
      value.toLowerCase() === (op["equals-ignore-case"] as string).toLowerCase()
    );
  }
  if ("numeric" in op) {
    if (typeof value !== "number") return false;
    const ops = op["numeric"] as unknown[];
    const chk = (o: string, n: number): boolean => {
      if (o === "=") return value === n;
      if (o === "!=") return value !== n;
      if (o === "<") return value < n;
      if (o === "<=") return value <= n;
      if (o === ">") return value > n;
      if (o === ">=") return value >= n;
      return false;
    };
    if (ops.length === 2) return chk(ops[0] as string, ops[1] as number);
    if (ops.length === 4)
      return (
        chk(ops[0] as string, ops[1] as number) &&
        chk(ops[2] as string, ops[3] as number)
      );
    return false;
  }
  if ("cidr" in op && typeof op["cidr"] === "string") {
    if (typeof value !== "string") return false;
    const [network, prefixLen] = op["cidr"].split("/");
    const mask = ~((1 << (32 - Number(prefixLen))) - 1) >>> 0;
    const toInt = (ip: string): number =>
      ip
        .split(".")
        .reduce((acc: number, p: string) => (acc << 8) | Number(p), 0) >>> 0;
    return (toInt(value) & mask) === (toInt(network) & mask);
  }
  return false;
};

const matchesFilterPolicy = (
  policyRaw: string | undefined,
  policyScope: string | undefined,
  delivery: DeliveryMessage,
): boolean => {
  if (typeof policyRaw !== "string" || policyRaw === "") return true;
  let policy: unknown;
  try {
    policy = JSON.parse(policyRaw);
  } catch {
    return true;
  }
  if (typeof policy !== "object" || policy === null) return true;
  if (policyScope === "MessageBody") {
    let body: unknown;
    try {
      body = JSON.parse(delivery.message);
    } catch {
      return false;
    }
    if (typeof body !== "object" || body === null) return false;
    const bodyObj = body as Record<string, unknown>;
    for (const [key, rules] of Object.entries(
      policy as Record<string, unknown>,
    )) {
      if (!Array.isArray(rules)) continue;
      const value = bodyObj[key];
      if (!rules.some((rule) => bodyValueRuleMatches(rule, value)))
        return false;
    }
    return true;
  }
  for (const [key, rules] of Object.entries(
    policy as Record<string, unknown>,
  )) {
    if (!Array.isArray(rules)) continue;
    const actual = attributeValueFor(delivery.messageAttributes, key);
    if (!rules.some((rule) => ruleMatches(rule, actual))) return false;
  }
  return true;
};

const snsLambdaEvent = (
  topicArn: string,
  subscriptionArn: string,
  delivery: DeliveryMessage,
): unknown => ({
  Records: [
    {
      EventSource: "aws:sns",
      EventVersion: "1.0",
      EventSubscriptionArn: subscriptionArn,
      Sns: {
        Type: "Notification",
        MessageId: delivery.messageId,
        TopicArn: topicArn,
        Subject: delivery.subject ?? null,
        Message: delivery.message,
        Timestamp: new Date().toISOString(),
        MessageAttributes:
          delivery.messageAttributes !== undefined
            ? envelopeMessageAttributes(delivery.messageAttributes)
            : {},
      },
    },
  ],
});

const fanout = async (
  ctx: ServiceContext,
  snsStore: ScopedStore,
  matchTopic: (topicArn: string) => boolean,
  delivery: DeliveryMessage,
): Promise<void> => {
  for (const entry of snsStore.list<StoredSubscription>()) {
    if (!entry.key.startsWith("subscription/")) continue;
    const subscription = entry.value;
    if (!matchTopic(subscription.TopicArn)) continue;
    const attributes =
      snsStore.get<StoredSubscriptionAttributes>(
        subscriptionAttributesKey(subscription.SubscriptionArn),
      )?.Attributes ?? {};
    if (attributes["PendingConfirmation"] === "true") continue;
    if (
      !matchesFilterPolicy(
        attributes["FilterPolicy"],
        attributes["FilterPolicyScope"],
        delivery,
      )
    )
      continue;
    const raw = attributes["RawMessageDelivery"] === "true";
    const isSqs = subscription.Protocol === "sqs";
    const selectedMessage =
      delivery.messageStructure === "json"
        ? jsonMessageForProtocol(delivery.message, subscription.Protocol)
        : delivery.message;
    const resolvedDelivery: DeliveryMessage =
      selectedMessage === delivery.message
        ? delivery
        : { ...delivery, message: selectedMessage };
    await deliverToArn(ctx, subscription.Endpoint, {
      body:
        isSqs && !raw
          ? buildEnvelope(subscription.TopicArn, resolvedDelivery)
          : selectedMessage,
      event: snsLambdaEvent(
        subscription.TopicArn,
        subscription.SubscriptionArn,
        resolvedDelivery,
      ),
      messageAttributes: raw ? delivery.messageAttributes : undefined,
    });
  }
};

registerTarget("sns", async (store, resource, delivery, ctx) => {
  await fanout(
    ctx,
    store,
    (topicArn) => nameFromTopicArn(topicArn) === resource,
    {
      messageId: crypto.randomUUID(),
      message: delivery.body,
      messageStructure: undefined,
      subject: delivery.subject,
      messageAttributes: undefined,
    },
  );
});

const CreateTopic: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const arn = topicArnOf(ctx.region, ctx.account, name);
  const attributes =
    typeof input["Attributes"] === "object" && input["Attributes"] !== null
      ? (input["Attributes"] as Record<string, string>)
      : {};
  const existing = ctx.store.get<StoredTopic>(topicKey(name));
  if (existing !== undefined) {
    return { TopicArn: existing.TopicArn };
  }
  const topic: StoredTopic = {
    TopicArn: arn,
    Name: name,
    Attributes: { ...attributes },
  };
  ctx.store.set(topicKey(name), topic);
  return { TopicArn: arn };
};

const DeleteTopic: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TopicArn");
  const name = nameFromTopicArn(arn);
  ctx.store.delete(topicKey(name));
  ctx.store.delete(tagsKey(arn));
  for (const entry of ctx.store.list<StoredSubscription>()) {
    if (entry.key.startsWith("subscription/") && entry.value.TopicArn === arn) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const ListTopics: OperationHandler = (_input, ctx) => {
  const topics = ctx.store
    .list<StoredTopic>()
    .filter((entry) => entry.key.startsWith("topic/"))
    .map((entry) => ({ TopicArn: entry.value.TopicArn }));
  return { Topics: topics };
};

const Publish: OperationHandler = async (input, ctx) => {
  const message = input["Message"];
  if (typeof message !== "string") {
    throw awsError("InvalidParameter", "Message is required.", 400);
  }
  const topicArn = input["TopicArn"];
  const targetArn = input["TargetArn"];
  const phoneNumber = input["PhoneNumber"];
  if (
    typeof topicArn !== "string" &&
    typeof targetArn !== "string" &&
    typeof phoneNumber !== "string"
  ) {
    throw awsError(
      "InvalidParameter",
      "One of TopicArn, TargetArn or PhoneNumber is required.",
      400,
    );
  }
  if (typeof topicArn === "string" && topicArn !== "") {
    requireTopic(ctx, topicArn);
  }
  if (typeof targetArn === "string" && targetArn !== "") {
    requireEndpoint(ctx, targetArn);
  }
  const messageStructure = input["MessageStructure"];
  if (typeof messageStructure === "string" && messageStructure === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      throw awsError(
        "InvalidParameter",
        "Message must be valid JSON when MessageStructure is json.",
        400,
      );
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>)["default"] !== "string"
    ) {
      throw awsError(
        "InvalidParameter",
        "JSON message must contain a top-level default key with a string value.",
        400,
      );
    }
  }
  const attributes = input["MessageAttributes"];
  if (typeof attributes === "object" && attributes !== null) {
    for (const value of Object.values(attributes as Record<string, unknown>)) {
      if (typeof value === "object" && value !== null) {
        const dataType = (value as Record<string, unknown>)["DataType"];
        if (typeof dataType !== "string" || dataType === "") {
          throw awsError(
            "InvalidParameter",
            "Message attribute DataType is required.",
            400,
          );
        }
      }
    }
  }
  const messageId = crypto.randomUUID();
  if (typeof topicArn === "string" && topicArn !== "") {
    await fanout(ctx, ctx.store, (candidate) => candidate === topicArn, {
      messageId,
      message,
      messageStructure:
        typeof messageStructure === "string" && messageStructure === "json"
          ? "json"
          : undefined,
      subject:
        typeof input["Subject"] === "string"
          ? (input["Subject"] as string)
          : undefined,
      messageAttributes:
        typeof attributes === "object" && attributes !== null
          ? (attributes as Record<string, unknown>)
          : undefined,
    });
  }
  return { MessageId: messageId };
};

const Subscribe: OperationHandler = (input, ctx) => {
  const topicArn = requireString(input, "TopicArn");
  const protocol = requireString(input, "Protocol");
  requireTopic(ctx, topicArn);
  const endpoint =
    typeof input["Endpoint"] === "string" ? (input["Endpoint"] as string) : "";
  const subscriptionArn = `${topicArn}:${crypto.randomUUID()}`;
  const needsConfirmation = PROTOCOLS_NEEDING_CONFIRMATION.has(protocol);
  const subscription: StoredSubscription = {
    SubscriptionArn: subscriptionArn,
    TopicArn: topicArn,
    Protocol: protocol,
    Endpoint: endpoint,
    Owner: ctx.account,
  };
  ctx.store.set(subscriptionKey(subscriptionArn), subscription);
  const attributes: StoredSubscriptionAttributes = {
    SubscriptionArn: subscriptionArn,
    Attributes: {
      SubscriptionArn: subscriptionArn,
      TopicArn: topicArn,
      Protocol: protocol,
      Endpoint: endpoint,
      Owner: ctx.account,
      ConfirmationWasAuthenticated: "false",
      PendingConfirmation: needsConfirmation ? "true" : "false",
      RawMessageDelivery: "false",
    },
  };
  ctx.store.set(subscriptionAttributesKey(subscriptionArn), attributes);
  if (needsConfirmation) {
    const token = crypto.randomUUID();
    ctx.store.set(pendingTokenKey(token), { subscriptionArn });
    return { SubscriptionArn: "pending confirmation" };
  }
  return { SubscriptionArn: subscriptionArn };
};

const Unsubscribe: OperationHandler = (input, ctx) => {
  const subscriptionArn = requireString(input, "SubscriptionArn");
  ctx.store.delete(subscriptionKey(subscriptionArn));
  ctx.store.delete(subscriptionAttributesKey(subscriptionArn));
  return {};
};

const ListSubscriptions: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredSubscription>()
    .filter((entry) => entry.key.startsWith("subscription/"))
    .map((entry) => ({
      SubscriptionArn: entry.value.SubscriptionArn,
      Owner: entry.value.Owner,
      Protocol: entry.value.Protocol,
      Endpoint: entry.value.Endpoint,
      TopicArn: entry.value.TopicArn,
    }));
  const offset = decodePageToken(input["NextToken"]);
  const page = all.slice(offset, offset + subscriptionListPageSize);
  const nextOffset = offset + subscriptionListPageSize;
  if (nextOffset < all.length) {
    return {
      Subscriptions: page,
      NextToken: encodePageToken(nextOffset),
    };
  }
  return { Subscriptions: page };
};

const ListSubscriptionsByTopic: OperationHandler = (input, ctx) => {
  const topicArn = requireString(input, "TopicArn");
  requireTopic(ctx, topicArn);
  const subscriptions = ctx.store
    .list<StoredSubscription>()
    .filter(
      (entry) =>
        entry.key.startsWith("subscription/") &&
        entry.value.TopicArn === topicArn,
    )
    .map((entry) => ({
      SubscriptionArn: entry.value.SubscriptionArn,
      Owner: entry.value.Owner,
      Protocol: entry.value.Protocol,
      Endpoint: entry.value.Endpoint,
      TopicArn: entry.value.TopicArn,
    }));
  return { Subscriptions: subscriptions };
};

const GetTopicAttributes: OperationHandler = (input, ctx) => {
  const topicArn = requireString(input, "TopicArn");
  const topic = requireTopic(ctx, topicArn);
  const subscriptions = ctx.store
    .list<StoredSubscription>()
    .filter(
      (entry) =>
        entry.key.startsWith("subscription/") &&
        entry.value.TopicArn === topicArn,
    );
  let confirmedCount = 0;
  let pendingCount = 0;
  for (const entry of subscriptions) {
    const attrs = ctx.store.get<StoredSubscriptionAttributes>(
      subscriptionAttributesKey(entry.value.SubscriptionArn),
    );
    if (attrs?.Attributes?.["PendingConfirmation"] === "true") {
      pendingCount += 1;
    } else {
      confirmedCount += 1;
    }
  }
  const attributes: Record<string, string> = {
    ...topic.Attributes,
    TopicArn: topicArn,
    Owner: ctx.account,
    SubscriptionsConfirmed: String(confirmedCount),
    SubscriptionsPending: String(pendingCount),
    SubscriptionsDeleted: "0",
  };
  return { Attributes: attributes };
};

const SetTopicAttributes: OperationHandler = (input, ctx) => {
  const topicArn = requireString(input, "TopicArn");
  const attributeName = requireString(input, "AttributeName");
  const topic = requireTopic(ctx, topicArn);
  const attributeValue =
    typeof input["AttributeValue"] === "string"
      ? (input["AttributeValue"] as string)
      : "";
  const updated: StoredTopic = {
    ...topic,
    Attributes: { ...topic.Attributes, [attributeName]: attributeValue },
  };
  ctx.store.set(topicKey(topic.Name), updated);
  return {};
};

const tagsToMap = (input: Record<string, unknown>): Record<string, string> => {
  const list = input["Tags"];
  const result: Record<string, string> = {};
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (typeof entry === "object" && entry !== null) {
        const tag = entry as Record<string, unknown>;
        const key = tag["Key"];
        const value = tag["Value"];
        if (typeof key === "string") {
          result[key] = typeof value === "string" ? value : "";
        }
      }
    }
  }
  return result;
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  requireTopic(ctx, resourceArn);
  const incoming = tagsToMap(input);
  const existing = ctx.store.get<StoredTags>(tagsKey(resourceArn));
  const merged: StoredTags = {
    ResourceArn: resourceArn,
    Tags: { ...(existing?.Tags ?? {}), ...incoming },
  };
  ctx.store.set(tagsKey(resourceArn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  requireTopic(ctx, resourceArn);
  const existing = ctx.store.get<StoredTags>(tagsKey(resourceArn));
  const tags: Record<string, string> = { ...(existing?.Tags ?? {}) };
  const keys = input["TagKeys"];
  if (Array.isArray(keys)) {
    for (const key of keys) {
      if (typeof key === "string") {
        delete tags[key];
      }
    }
  }
  ctx.store.set(tagsKey(resourceArn), { ResourceArn: resourceArn, Tags: tags });
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  requireTopic(ctx, resourceArn);
  const stored = ctx.store.get<StoredTags>(tagsKey(resourceArn));
  const tags = Object.entries(stored?.Tags ?? {}).map(([Key, Value]) => ({
    Key,
    Value,
  }));
  return { Tags: tags };
};

const requireSubscription = (
  ctx: ServiceContext,
  arn: string,
): StoredSubscription => {
  const subscription = ctx.store.get<StoredSubscription>(subscriptionKey(arn));
  if (subscription === undefined) {
    throw awsError("NotFound", "Subscription does not exist.", 404);
  }
  return subscription;
};

const GetSubscriptionAttributes: OperationHandler = (input, ctx) => {
  const subscriptionArn = requireString(input, "SubscriptionArn");
  const subscription = requireSubscription(ctx, subscriptionArn);
  const stored = ctx.store.get<StoredSubscriptionAttributes>(
    subscriptionAttributesKey(subscriptionArn),
  );
  const attributes: Record<string, string> = {
    ...(stored?.Attributes ?? {}),
    SubscriptionArn: subscriptionArn,
    TopicArn: subscription.TopicArn,
    Protocol: subscription.Protocol,
    Endpoint: subscription.Endpoint,
    Owner: subscription.Owner,
  };
  return { Attributes: attributes };
};

const SetSubscriptionAttributes: OperationHandler = (input, ctx) => {
  const subscriptionArn = requireString(input, "SubscriptionArn");
  const attributeName = requireString(input, "AttributeName");
  requireSubscription(ctx, subscriptionArn);
  const attributeValue =
    typeof input["AttributeValue"] === "string"
      ? (input["AttributeValue"] as string)
      : "";
  const stored = ctx.store.get<StoredSubscriptionAttributes>(
    subscriptionAttributesKey(subscriptionArn),
  );
  const updated: StoredSubscriptionAttributes = {
    SubscriptionArn: subscriptionArn,
    Attributes: {
      ...(stored?.Attributes ?? {}),
      [attributeName]: attributeValue,
    },
  };
  ctx.store.set(subscriptionAttributesKey(subscriptionArn), updated);
  return {};
};

const ConfirmSubscription: OperationHandler = (input, ctx) => {
  const topicArn = requireString(input, "TopicArn");
  const token = requireString(input, "Token");
  requireTopic(ctx, topicArn);
  const pending = ctx.store.get<{ subscriptionArn: string }>(
    pendingTokenKey(token),
  );
  if (pending !== undefined) {
    const { subscriptionArn } = pending;
    const stored = ctx.store.get<StoredSubscriptionAttributes>(
      subscriptionAttributesKey(subscriptionArn),
    );
    const updated: StoredSubscriptionAttributes = {
      SubscriptionArn: subscriptionArn,
      Attributes: {
        ...(stored?.Attributes ?? {}),
        PendingConfirmation: "false",
        ConfirmationWasAuthenticated: "true",
      },
    };
    ctx.store.set(subscriptionAttributesKey(subscriptionArn), updated);
    ctx.store.delete(pendingTokenKey(token));
    return { SubscriptionArn: subscriptionArn };
  }
  const subscriptionArn = `${topicArn}:${token}`;
  const endpoint = `confirmed/${token}`;
  const subscription: StoredSubscription = {
    SubscriptionArn: subscriptionArn,
    TopicArn: topicArn,
    Protocol: "https",
    Endpoint: endpoint,
    Owner: ctx.account,
  };
  ctx.store.set(subscriptionKey(subscriptionArn), subscription);
  const attributes: StoredSubscriptionAttributes = {
    SubscriptionArn: subscriptionArn,
    Attributes: {
      SubscriptionArn: subscriptionArn,
      TopicArn: topicArn,
      Protocol: "https",
      Endpoint: endpoint,
      Owner: ctx.account,
      ConfirmationWasAuthenticated: "true",
      PendingConfirmation: "false",
    },
  };
  ctx.store.set(subscriptionAttributesKey(subscriptionArn), attributes);
  return { SubscriptionArn: subscriptionArn };
};

const platformApplicationArnOf = (
  region: string,
  account: string,
  platform: string,
  name: string,
): string => `arn:aws:sns:${region}:${account}:app/${platform}/${name}`;

const CreatePlatformApplication: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const platform = requireString(input, "Platform");
  const attributes =
    typeof input["Attributes"] === "object" && input["Attributes"] !== null
      ? (input["Attributes"] as Record<string, string>)
      : {};
  const arn = platformApplicationArnOf(ctx.region, ctx.account, platform, name);
  const application: StoredPlatformApplication = {
    PlatformApplicationArn: arn,
    Attributes: { ...attributes },
  };
  ctx.store.set(platformApplicationKey(arn), application);
  return { PlatformApplicationArn: arn };
};

const ListPlatformApplications: OperationHandler = (_input, ctx) => {
  const applications = ctx.store
    .list<StoredPlatformApplication>()
    .filter((entry) => entry.key.startsWith("platform/"))
    .map((entry) => ({
      PlatformApplicationArn: entry.value.PlatformApplicationArn,
      Attributes: { ...entry.value.Attributes },
    }));
  return { PlatformApplications: applications };
};

const requirePlatformApplication = (
  ctx: ServiceContext,
  arn: string,
): StoredPlatformApplication => {
  const application = ctx.store.get<StoredPlatformApplication>(
    platformApplicationKey(arn),
  );
  if (application === undefined) {
    throw awsError("NotFound", "PlatformApplication does not exist.", 404);
  }
  return application;
};

const requireEndpoint = (ctx: ServiceContext, arn: string): StoredEndpoint => {
  const endpoint = ctx.store.get<StoredEndpoint>(endpointKey(arn));
  if (endpoint === undefined) {
    throw awsError("NotFound", "Endpoint does not exist.", 404);
  }
  return endpoint;
};

const CreatePlatformEndpoint: OperationHandler = (input, ctx) => {
  const platformApplicationArn = requireString(input, "PlatformApplicationArn");
  const token = requireString(input, "Token");
  requirePlatformApplication(ctx, platformApplicationArn);
  const attributes =
    typeof input["Attributes"] === "object" && input["Attributes"] !== null
      ? (input["Attributes"] as Record<string, string>)
      : {};
  const customUserData =
    typeof input["CustomUserData"] === "string"
      ? (input["CustomUserData"] as string)
      : "";
  const existing = ctx.store
    .list<StoredEndpoint>()
    .find(
      (entry) =>
        entry.key.startsWith("endpoint/") &&
        entry.value.PlatformApplicationArn === platformApplicationArn &&
        entry.value.Attributes["Token"] === token,
    );
  if (existing !== undefined) {
    return { EndpointArn: existing.value.EndpointArn };
  }
  const arn = `${platformApplicationArn.replace("app/", "endpoint/")}/${crypto.randomUUID()}`;
  const endpoint: StoredEndpoint = {
    EndpointArn: arn,
    PlatformApplicationArn: platformApplicationArn,
    Attributes: {
      Token: token,
      Enabled: "true",
      CustomUserData: customUserData,
      ...attributes,
    },
  };
  ctx.store.set(endpointKey(arn), endpoint);
  return { EndpointArn: arn };
};

const DeleteEndpoint: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointArn");
  ctx.store.delete(endpointKey(arn));
  return {};
};

const ListEndpointsByPlatformApplication: OperationHandler = (input, ctx) => {
  const platformApplicationArn = requireString(input, "PlatformApplicationArn");
  requirePlatformApplication(ctx, platformApplicationArn);
  const endpoints = ctx.store
    .list<StoredEndpoint>()
    .filter(
      (entry) =>
        entry.key.startsWith("endpoint/") &&
        entry.value.PlatformApplicationArn === platformApplicationArn,
    )
    .map((entry) => ({
      EndpointArn: entry.value.EndpointArn,
      Attributes: { ...entry.value.Attributes },
    }));
  return { Endpoints: endpoints };
};

const GetEndpointAttributes: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointArn");
  const endpoint = requireEndpoint(ctx, arn);
  return { Attributes: { ...endpoint.Attributes } };
};

const SetEndpointAttributes: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "EndpointArn");
  const endpoint = requireEndpoint(ctx, arn);
  const incoming =
    typeof input["Attributes"] === "object" && input["Attributes"] !== null
      ? (input["Attributes"] as Record<string, string>)
      : {};
  const updated: StoredEndpoint = {
    ...endpoint,
    Attributes: { ...endpoint.Attributes, ...incoming },
  };
  ctx.store.set(endpointKey(arn), updated);
  return {};
};

const PublishBatch: OperationHandler = (input, ctx) => {
  const topicArn = requireString(input, "TopicArn");
  requireTopic(ctx, topicArn);
  const entries = input["PublishBatchRequestEntries"];
  if (!Array.isArray(entries)) {
    throw awsError(
      "InvalidParameter",
      "PublishBatchRequestEntries is required.",
      400,
    );
  }
  const successful: Array<{ Id: string; MessageId: string }> = [];
  const failed: Array<{
    Id: string;
    Code: string;
    Message: string;
    SenderFault: boolean;
  }> = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const id = e["Id"];
    const message = e["Message"];
    if (typeof id !== "string" || id === "") continue;
    if (typeof message !== "string" || message === "") {
      failed.push({
        Id: id,
        Code: "InvalidParameter",
        Message: "Message is required.",
        SenderFault: true,
      });
      continue;
    }
    successful.push({ Id: id, MessageId: crypto.randomUUID() });
  }
  return { Successful: successful, Failed: failed };
};

const AddPermission: OperationHandler = (input, ctx) => {
  const topicArn = requireString(input, "TopicArn");
  const label = requireString(input, "Label");
  const topic = requireTopic(ctx, topicArn);
  const accounts = Array.isArray(input["AWSAccountId"])
    ? (input["AWSAccountId"] as string[])
    : [];
  const actions = Array.isArray(input["ActionName"])
    ? (input["ActionName"] as string[])
    : [];
  let policy: { Statement?: Array<Record<string, unknown>> };
  try {
    policy = JSON.parse(topic.Attributes["Policy"] ?? "{}") as typeof policy;
  } catch {
    policy = {};
  }
  const statements = Array.isArray(policy.Statement)
    ? [...policy.Statement]
    : [];
  statements.push({
    Sid: label,
    Effect: "Allow",
    Principal: { AWS: accounts },
    Action: actions.map((a) => `SNS:${a}`),
    Resource: topicArn,
  });
  const updated: StoredTopic = {
    ...topic,
    Attributes: {
      ...topic.Attributes,
      Policy: JSON.stringify({ Statement: statements }),
    },
  };
  ctx.store.set(topicKey(topic.Name), updated);
  return {};
};

const RemovePermission: OperationHandler = (input, ctx) => {
  const topicArn = requireString(input, "TopicArn");
  const label = requireString(input, "Label");
  const topic = requireTopic(ctx, topicArn);
  let policy: { Statement?: Array<Record<string, unknown>> };
  try {
    policy = JSON.parse(topic.Attributes["Policy"] ?? "{}") as typeof policy;
  } catch {
    policy = {};
  }
  const statements = (
    Array.isArray(policy.Statement) ? policy.Statement : []
  ).filter((s) => s["Sid"] !== label);
  const updated: StoredTopic = {
    ...topic,
    Attributes: {
      ...topic.Attributes,
      Policy: JSON.stringify({ Statement: statements }),
    },
  };
  ctx.store.set(topicKey(topic.Name), updated);
  return {};
};

const GetPlatformApplicationAttributes: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "PlatformApplicationArn");
  const application = requirePlatformApplication(ctx, arn);
  return { Attributes: { ...application.Attributes } };
};

const SetPlatformApplicationAttributes: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "PlatformApplicationArn");
  const application = requirePlatformApplication(ctx, arn);
  const incoming =
    typeof input["Attributes"] === "object" && input["Attributes"] !== null
      ? (input["Attributes"] as Record<string, string>)
      : {};
  const updated: StoredPlatformApplication = {
    ...application,
    Attributes: { ...application.Attributes, ...incoming },
  };
  ctx.store.set(platformApplicationKey(arn), updated);
  return {};
};

const DeletePlatformApplication: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "PlatformApplicationArn");
  requirePlatformApplication(ctx, arn);
  ctx.store.delete(platformApplicationKey(arn));
  for (const entry of ctx.store.list<StoredEndpoint>()) {
    if (
      entry.key.startsWith("endpoint/") &&
      entry.value.PlatformApplicationArn === arn
    ) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const GetDataProtectionPolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const topic = requireTopic(ctx, resourceArn);
  return {
    DataProtectionPolicy: topic.Attributes["DataProtectionPolicy"] ?? "",
  };
};

const PutDataProtectionPolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const policy = requireString(input, "DataProtectionPolicy");
  const topic = requireTopic(ctx, resourceArn);
  const updated: StoredTopic = {
    ...topic,
    Attributes: { ...topic.Attributes, DataProtectionPolicy: policy },
  };
  ctx.store.set(topicKey(topic.Name), updated);
  return {};
};

const GetSMSAttributes: OperationHandler = (input, ctx) => {
  const stored = ctx.store.get<StoredSMSAttributes>(smsAttrsKey());
  const all = stored?.attributes ?? {};
  const filter = input["attributes"];
  if (Array.isArray(filter) && filter.length > 0) {
    const filtered: Record<string, string> = {};
    for (const key of filter) {
      if (typeof key === "string" && all[key] !== undefined) {
        filtered[key] = all[key] as string;
      }
    }
    return { attributes: filtered };
  }
  return { attributes: all };
};

const SetSMSAttributes: OperationHandler = (input, ctx) => {
  const incoming =
    typeof input["attributes"] === "object" && input["attributes"] !== null
      ? (input["attributes"] as Record<string, string>)
      : {};
  const existing = ctx.store.get<StoredSMSAttributes>(smsAttrsKey());
  ctx.store.set(smsAttrsKey(), {
    attributes: { ...(existing?.attributes ?? {}), ...incoming },
  });
  return {};
};

const CheckIfPhoneNumberIsOptedOut: OperationHandler = (input, ctx) => {
  const phone = requireString(input, "phoneNumber");
  const isOptedOut = ctx.store.get(optedOutKey(phone)) !== undefined;
  return { isOptedOut };
};

const OptInPhoneNumber: OperationHandler = (input, ctx) => {
  const phone = requireString(input, "phoneNumber");
  ctx.store.delete(optedOutKey(phone));
  return {};
};

const ListPhoneNumbersOptedOut: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<string>()
    .filter((entry) => entry.key.startsWith("opted_out/"))
    .map((entry) => entry.key.slice("opted_out/".length));
  const offset = decodePageToken(input["nextToken"]);
  const page = all.slice(offset, offset + subscriptionListPageSize);
  const nextOffset = offset + subscriptionListPageSize;
  if (nextOffset < all.length) {
    return { phoneNumbers: page, nextToken: encodePageToken(nextOffset) };
  }
  return { phoneNumbers: page };
};

const ListOriginationNumbers: OperationHandler = (_input, _ctx) => {
  return { PhoneNumbers: [] };
};

const GetSMSSandboxAccountStatus: OperationHandler = (_input, _ctx) => {
  return { IsInSandbox: true };
};

const CreateSMSSandboxPhoneNumber: OperationHandler = (input, ctx) => {
  const phone = requireString(input, "PhoneNumber");
  const existing = ctx.store.get<StoredSandboxPhoneNumber>(
    sandboxPhoneKey(phone),
  );
  if (existing === undefined) {
    ctx.store.set(sandboxPhoneKey(phone), {
      phoneNumber: phone,
      status: "Pending",
    });
  }
  return {};
};

const VerifySMSSandboxPhoneNumber: OperationHandler = (input, ctx) => {
  const phone = requireString(input, "PhoneNumber");
  requireString(input, "OneTimePassword");
  const existing = ctx.store.get<StoredSandboxPhoneNumber>(
    sandboxPhoneKey(phone),
  );
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "PhoneNumber does not exist.",
      404,
    );
  }
  ctx.store.set(sandboxPhoneKey(phone), {
    phoneNumber: phone,
    status: "Verified",
  });
  return {};
};

const DeleteSMSSandboxPhoneNumber: OperationHandler = (input, ctx) => {
  const phone = requireString(input, "PhoneNumber");
  ctx.store.delete(sandboxPhoneKey(phone));
  return {};
};

const ListSMSSandboxPhoneNumbers: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredSandboxPhoneNumber>()
    .filter((entry) => entry.key.startsWith("sandbox/"))
    .map((entry) => ({
      PhoneNumber: entry.value.phoneNumber,
      Status: entry.value.status,
    }));
  const maxResults =
    typeof input["MaxResults"] === "number" ? input["MaxResults"] : 100;
  const offset = decodePageToken(input["NextToken"]);
  const page = all.slice(offset, offset + maxResults);
  const nextOffset = offset + maxResults;
  if (nextOffset < all.length) {
    return { PhoneNumbers: page, NextToken: encodePageToken(nextOffset) };
  }
  return { PhoneNumbers: page };
};

const sns = {
  name: "sns",
  protocol: "query",
  operations: {
    CreateTopic,
    DeleteTopic,
    ListTopics,
    Publish,
    PublishBatch,
    Subscribe,
    Unsubscribe,
    ListSubscriptions,
    ListSubscriptionsByTopic,
    GetTopicAttributes,
    SetTopicAttributes,
    TagResource,
    UntagResource,
    ListTagsForResource,
    GetSubscriptionAttributes,
    SetSubscriptionAttributes,
    ConfirmSubscription,
    AddPermission,
    RemovePermission,
    CreatePlatformApplication,
    ListPlatformApplications,
    GetPlatformApplicationAttributes,
    SetPlatformApplicationAttributes,
    DeletePlatformApplication,
    CreatePlatformEndpoint,
    DeleteEndpoint,
    ListEndpointsByPlatformApplication,
    GetEndpointAttributes,
    SetEndpointAttributes,
    GetDataProtectionPolicy,
    PutDataProtectionPolicy,
    GetSMSAttributes,
    SetSMSAttributes,
    CheckIfPhoneNumberIsOptedOut,
    OptInPhoneNumber,
    ListPhoneNumbersOptedOut,
    ListOriginationNumbers,
    GetSMSSandboxAccountStatus,
    CreateSMSSandboxPhoneNumber,
    VerifySMSSandboxPhoneNumber,
    DeleteSMSSandboxPhoneNumber,
    ListSMSSandboxPhoneNumbers,
  },
  model,
} as const satisfies ServiceDefinition;

export default sns;
