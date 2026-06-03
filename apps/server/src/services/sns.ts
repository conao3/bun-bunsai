import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import snsModel from "../../../../test/vendor/aws-models/sns.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

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

const topicKey = (name: string): string => `topic/${name}`;

const subscriptionKey = (arn: string): string => `subscription/${arn}`;

const tagsKey = (arn: string): string => `tags/${arn}`;

const subscriptionAttributesKey = (arn: string): string => `subattrs/${arn}`;

const platformApplicationKey = (arn: string): string => `platform/${arn}`;

const endpointKey = (arn: string): string => `endpoint/${arn}`;

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

const Publish: OperationHandler = (input, ctx) => {
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
  return { MessageId: crypto.randomUUID() };
};

const Subscribe: OperationHandler = (input, ctx) => {
  const topicArn = requireString(input, "TopicArn");
  const protocol = requireString(input, "Protocol");
  requireTopic(ctx, topicArn);
  const endpoint =
    typeof input["Endpoint"] === "string" ? (input["Endpoint"] as string) : "";
  const subscriptionArn = `${topicArn}:${crypto.randomUUID()}`;
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
      PendingConfirmation: "false",
      RawMessageDelivery: "false",
    },
  };
  ctx.store.set(subscriptionAttributesKey(subscriptionArn), attributes);
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
  const attributes: Record<string, string> = {
    ...topic.Attributes,
    TopicArn: topicArn,
    Owner: ctx.account,
    SubscriptionsConfirmed: String(subscriptions.length),
    SubscriptionsPending: "0",
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

const sns = {
  name: "sns",
  protocol: "query",
  operations: {
    CreateTopic,
    DeleteTopic,
    ListTopics,
    Publish,
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
    CreatePlatformApplication,
    ListPlatformApplications,
    CreatePlatformEndpoint,
    DeleteEndpoint,
    ListEndpointsByPlatformApplication,
    GetEndpointAttributes,
    SetEndpointAttributes,
  },
  model,
} as const satisfies ServiceDefinition;

export default sns;
