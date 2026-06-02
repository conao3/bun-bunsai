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

const topicKey = (name: string): string => `topic/${name}`;

const subscriptionKey = (arn: string): string => `subscription/${arn}`;

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
  return { SubscriptionArn: subscriptionArn };
};

const Unsubscribe: OperationHandler = (input, ctx) => {
  const subscriptionArn = requireString(input, "SubscriptionArn");
  ctx.store.delete(subscriptionKey(subscriptionArn));
  return {};
};

const ListSubscriptions: OperationHandler = (_input, ctx) => {
  const subscriptions = ctx.store
    .list<StoredSubscription>()
    .filter((entry) => entry.key.startsWith("subscription/"))
    .map((entry) => ({
      SubscriptionArn: entry.value.SubscriptionArn,
      Owner: entry.value.Owner,
      Protocol: entry.value.Protocol,
      Endpoint: entry.value.Endpoint,
      TopicArn: entry.value.TopicArn,
    }));
  return { Subscriptions: subscriptions };
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
  },
  model,
} as const satisfies ServiceDefinition;

export default sns;
