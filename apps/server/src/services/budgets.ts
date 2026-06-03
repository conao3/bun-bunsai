import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import budgetsModel from "../../../../test/vendor/aws-models/budgets.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(budgetsModel);

type StoredBudget = Record<string, unknown> & {
  BudgetName: string;
  TimeUnit: string;
  BudgetType: string;
};

type StoredNotification = {
  NotificationType: string;
  ComparisonOperator: string;
  Threshold: number;
  ThresholdType?: string;
  NotificationState?: string;
};

type StoredSubscriber = {
  SubscriptionType: string;
  Address: string;
};

type StoredAction = {
  ActionId: string;
  BudgetName: string;
  NotificationType: string;
  ActionType: string;
  ActionThreshold: Record<string, unknown>;
  Definition: Record<string, unknown>;
  ExecutionRoleArn: string;
  ApprovalModel: string;
  Status: string;
  Subscribers: StoredSubscriber[];
};

type StoredActionHistory = {
  Timestamp: number;
  Status: string;
  EventType: string;
  ActionHistoryDetails: {
    Message: string;
    Action: StoredAction;
  };
};

const budgetKey = (name: string): string => `budget/${name}`;

const notifIdOf = (notification: Record<string, unknown>): string => {
  const nt = String(notification["NotificationType"] ?? "");
  const co = String(notification["ComparisonOperator"] ?? "");
  const th = String(notification["Threshold"] ?? "");
  return `${nt}|${co}|${th}`;
};

const notificationKey = (
  budgetName: string,
  notification: Record<string, unknown>,
): string => `notification/${budgetName}/${notifIdOf(notification)}`;

const subscriberIdOf = (subscriber: Record<string, unknown>): string => {
  const st = String(subscriber["SubscriptionType"] ?? "");
  const addr = String(subscriber["Address"] ?? "");
  return `${st}|${addr}`;
};

const subscriberKey = (
  budgetName: string,
  notifId: string,
  subscriber: Record<string, unknown>,
): string =>
  `subscriber/${budgetName}/${notifId}/${subscriberIdOf(subscriber)}`;

const actionKey = (budgetName: string, actionId: string): string =>
  `action/${budgetName}/${actionId}`;

const actionHistoryKey = (
  budgetName: string,
  actionId: string,
  seq: number,
): string =>
  `actionhistory/${budgetName}/${actionId}/${String(seq).padStart(20, "0")}`;

const tagKey = (arn: string): string => `tag/${arn}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return value;
};

const requireBudgetInput = (
  input: Record<string, unknown>,
): Record<string, unknown> => {
  const value = input["Budget"];
  if (typeof value !== "object" || value === null) {
    throw awsError("ValidationException", "Budget is required.", 400);
  }
  return value as Record<string, unknown>;
};

const requireBudget = (ctx: ServiceContext, name: string): StoredBudget => {
  const stored = ctx.store.get<StoredBudget>(budgetKey(name));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Unable to get budget: ${name} - the budget doesn't exist.`,
      400,
    );
  }
  return stored;
};

const requireNotifInput = (
  input: Record<string, unknown>,
  field: string,
): Record<string, unknown> => {
  const value = input[field];
  if (typeof value !== "object" || value === null) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value as Record<string, unknown>;
};

const requireNotification = (
  ctx: ServiceContext,
  budgetName: string,
  notification: Record<string, unknown>,
): StoredNotification => {
  const key = notificationKey(budgetName, notification);
  const stored = ctx.store.get<StoredNotification>(key);
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Unable to get notification for budget: ${budgetName} - the notification doesn't exist.`,
      400,
    );
  }
  return stored;
};

const requireAction = (
  ctx: ServiceContext,
  budgetName: string,
  actionId: string,
): StoredAction => {
  const stored = ctx.store.get<StoredAction>(actionKey(budgetName, actionId));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Unable to get budget action: ${actionId} - the action doesn't exist.`,
      400,
    );
  }
  return stored;
};

const subscribersFromInput = (raw: unknown): StoredSubscriber[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is Record<string, unknown> => typeof s === "object" && s !== null,
    )
    .map((s) => ({
      SubscriptionType: String(s["SubscriptionType"] ?? ""),
      Address: String(s["Address"] ?? ""),
    }));
};

const CreateBudget: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budget = requireBudgetInput(input);
  const name = requireString(budget, "BudgetName");
  const timeUnit = requireString(budget, "TimeUnit");
  const budgetType = requireString(budget, "BudgetType");
  if (ctx.store.get<StoredBudget>(budgetKey(name)) !== undefined) {
    throw awsError(
      "DuplicateRecordException",
      `Error creating budget: ${name} - the budget already exists.`,
      400,
    );
  }
  const stored: StoredBudget = {
    ...budget,
    BudgetName: name,
    TimeUnit: timeUnit,
    BudgetType: budgetType,
    LastUpdatedTime: Date.now() / 1000,
  };
  ctx.store.set(budgetKey(name), stored);
  return {};
};

const UpdateBudget: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const raw = input["NewBudget"];
  if (typeof raw !== "object" || raw === null) {
    throw awsError("ValidationException", "NewBudget is required.", 400);
  }
  const newBudget = raw as Record<string, unknown>;
  const name = requireString(newBudget, "BudgetName");
  requireBudget(ctx, name);
  const stored: StoredBudget = {
    ...newBudget,
    BudgetName: name,
    TimeUnit: requireString(newBudget, "TimeUnit"),
    BudgetType: requireString(newBudget, "BudgetType"),
    LastUpdatedTime: Date.now() / 1000,
  };
  ctx.store.set(budgetKey(name), stored);
  return {};
};

const DescribeBudget: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const name = requireString(input, "BudgetName");
  return { Budget: requireBudget(ctx, name) };
};

const DescribeBudgets: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budgets = ctx.store
    .list<StoredBudget>()
    .filter((entry) => entry.key.startsWith("budget/"))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.BudgetName < b.BudgetName ? -1 : a.BudgetName > b.BudgetName ? 1 : 0,
    );
  return { Budgets: budgets };
};

const DeleteBudget: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const name = requireString(input, "BudgetName");
  requireBudget(ctx, name);
  ctx.store.delete(budgetKey(name));
  for (const entry of ctx.store.list()) {
    if (
      entry.key.startsWith(`notification/${name}/`) ||
      entry.key.startsWith(`subscriber/${name}/`) ||
      entry.key.startsWith(`action/${name}/`) ||
      entry.key.startsWith(`actionhistory/${name}/`)
    ) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const CreateNotification: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const notif = requireNotifInput(input, "Notification");
  const key = notificationKey(budgetName, notif);
  if (ctx.store.get(key) !== undefined) {
    throw awsError(
      "DuplicateRecordException",
      `Error creating notification for budget: ${budgetName} - the notification already exists.`,
      400,
    );
  }
  const stored: StoredNotification = {
    NotificationType: requireString(notif, "NotificationType"),
    ComparisonOperator: requireString(notif, "ComparisonOperator"),
    Threshold: Number(notif["Threshold"]),
    ...(typeof notif["ThresholdType"] === "string" && {
      ThresholdType: notif["ThresholdType"],
    }),
    ...(typeof notif["NotificationState"] === "string" && {
      NotificationState: notif["NotificationState"],
    }),
  };
  ctx.store.set(key, stored);
  const notifId = notifIdOf(notif);
  for (const sub of subscribersFromInput(input["Subscribers"])) {
    ctx.store.set(
      subscriberKey(budgetName, notifId, sub as Record<string, unknown>),
      sub,
    );
  }
  return {};
};

const UpdateNotification: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const oldNotif = requireNotifInput(input, "OldNotification");
  const newNotif = requireNotifInput(input, "NewNotification");
  requireNotification(ctx, budgetName, oldNotif);
  const oldNotifId = notifIdOf(oldNotif);
  const newNotifId = notifIdOf(newNotif);
  const newStored: StoredNotification = {
    NotificationType: requireString(newNotif, "NotificationType"),
    ComparisonOperator: requireString(newNotif, "ComparisonOperator"),
    Threshold: Number(newNotif["Threshold"]),
    ...(typeof newNotif["ThresholdType"] === "string" && {
      ThresholdType: newNotif["ThresholdType"],
    }),
    ...(typeof newNotif["NotificationState"] === "string" && {
      NotificationState: newNotif["NotificationState"],
    }),
  };
  if (oldNotifId !== newNotifId) {
    ctx.store.delete(notificationKey(budgetName, oldNotif));
    const oldPrefix = `subscriber/${budgetName}/${oldNotifId}/`;
    const newPrefix = `subscriber/${budgetName}/${newNotifId}/`;
    for (const entry of ctx.store.list()) {
      if (entry.key.startsWith(oldPrefix)) {
        const subValue = entry.value;
        ctx.store.delete(entry.key);
        ctx.store.set(entry.key.replace(oldPrefix, newPrefix), subValue);
      }
    }
  }
  ctx.store.set(notificationKey(budgetName, newNotif), newStored);
  return {};
};

const DeleteNotification: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const notif = requireNotifInput(input, "Notification");
  requireNotification(ctx, budgetName, notif);
  ctx.store.delete(notificationKey(budgetName, notif));
  const notifId = notifIdOf(notif);
  for (const entry of ctx.store.list()) {
    if (entry.key.startsWith(`subscriber/${budgetName}/${notifId}/`)) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const DescribeNotificationsForBudget: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const notifications = ctx.store
    .list<StoredNotification>()
    .filter((entry) => entry.key.startsWith(`notification/${budgetName}/`))
    .map((entry) => entry.value);
  return { Notifications: notifications };
};

const DescribeBudgetNotificationsForAccount: OperationHandler = (
  input,
  ctx,
) => {
  requireString(input, "AccountId");
  const result = ctx.store
    .list<StoredBudget>()
    .filter((entry) => entry.key.startsWith("budget/"))
    .map((entry) => {
      const bname = entry.value.BudgetName;
      const notifications = ctx.store
        .list<StoredNotification>()
        .filter((n) => n.key.startsWith(`notification/${bname}/`))
        .map((n) => n.value);
      return { BudgetName: bname, Notifications: notifications };
    });
  return { BudgetNotificationsForAccount: result };
};

const CreateSubscriber: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const notif = requireNotifInput(input, "Notification");
  const storedNotif = requireNotification(ctx, budgetName, notif);
  const subRaw = input["Subscriber"];
  if (typeof subRaw !== "object" || subRaw === null) {
    throw awsError("ValidationException", "Subscriber is required.", 400);
  }
  const sub = subRaw as Record<string, unknown>;
  const notifId = `${storedNotif.NotificationType}|${storedNotif.ComparisonOperator}|${storedNotif.Threshold}`;
  const key = subscriberKey(budgetName, notifId, sub);
  if (ctx.store.get(key) !== undefined) {
    throw awsError(
      "DuplicateRecordException",
      "Error creating subscriber - the subscriber already exists.",
      400,
    );
  }
  ctx.store.set(key, {
    SubscriptionType: String(sub["SubscriptionType"] ?? ""),
    Address: String(sub["Address"] ?? ""),
  });
  return {};
};

const UpdateSubscriber: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const notif = requireNotifInput(input, "Notification");
  const storedNotif = requireNotification(ctx, budgetName, notif);
  const notifId = `${storedNotif.NotificationType}|${storedNotif.ComparisonOperator}|${storedNotif.Threshold}`;
  const oldSubRaw = input["OldSubscriber"];
  const newSubRaw = input["NewSubscriber"];
  if (typeof oldSubRaw !== "object" || oldSubRaw === null) {
    throw awsError("ValidationException", "OldSubscriber is required.", 400);
  }
  if (typeof newSubRaw !== "object" || newSubRaw === null) {
    throw awsError("ValidationException", "NewSubscriber is required.", 400);
  }
  const oldSub = oldSubRaw as Record<string, unknown>;
  const newSub = newSubRaw as Record<string, unknown>;
  const oldKey = subscriberKey(budgetName, notifId, oldSub);
  if (ctx.store.get(oldKey) === undefined) {
    throw awsError(
      "NotFoundException",
      "Unable to get subscriber - the subscriber doesn't exist.",
      400,
    );
  }
  ctx.store.delete(oldKey);
  ctx.store.set(subscriberKey(budgetName, notifId, newSub), {
    SubscriptionType: String(newSub["SubscriptionType"] ?? ""),
    Address: String(newSub["Address"] ?? ""),
  });
  return {};
};

const DeleteSubscriber: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const notif = requireNotifInput(input, "Notification");
  const storedNotif = requireNotification(ctx, budgetName, notif);
  const notifId = `${storedNotif.NotificationType}|${storedNotif.ComparisonOperator}|${storedNotif.Threshold}`;
  const subRaw = input["Subscriber"];
  if (typeof subRaw !== "object" || subRaw === null) {
    throw awsError("ValidationException", "Subscriber is required.", 400);
  }
  const sub = subRaw as Record<string, unknown>;
  const key = subscriberKey(budgetName, notifId, sub);
  if (ctx.store.get(key) === undefined) {
    throw awsError(
      "NotFoundException",
      "Unable to get subscriber - the subscriber doesn't exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const DescribeSubscribersForNotification: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const notif = requireNotifInput(input, "Notification");
  const storedNotif = requireNotification(ctx, budgetName, notif);
  const notifId = `${storedNotif.NotificationType}|${storedNotif.ComparisonOperator}|${storedNotif.Threshold}`;
  const subscribers = ctx.store
    .list<StoredSubscriber>()
    .filter((entry) =>
      entry.key.startsWith(`subscriber/${budgetName}/${notifId}/`),
    )
    .map((entry) => entry.value);
  return { Subscribers: subscribers };
};

const CreateBudgetAction: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const actionThresholdRaw = input["ActionThreshold"];
  if (typeof actionThresholdRaw !== "object" || actionThresholdRaw === null) {
    throw awsError("ValidationException", "ActionThreshold is required.", 400);
  }
  const definitionRaw = input["Definition"];
  if (typeof definitionRaw !== "object" || definitionRaw === null) {
    throw awsError("ValidationException", "Definition is required.", 400);
  }
  const actionId = crypto.randomUUID();
  const stored: StoredAction = {
    ActionId: actionId,
    BudgetName: budgetName,
    NotificationType: requireString(input, "NotificationType"),
    ActionType: requireString(input, "ActionType"),
    ActionThreshold: actionThresholdRaw as Record<string, unknown>,
    Definition: definitionRaw as Record<string, unknown>,
    ExecutionRoleArn: requireString(input, "ExecutionRoleArn"),
    ApprovalModel: requireString(input, "ApprovalModel"),
    Status: "STANDBY",
    Subscribers: subscribersFromInput(input["Subscribers"]),
  };
  ctx.store.set(actionKey(budgetName, actionId), stored);
  return {
    AccountId: ctx.account,
    BudgetName: budgetName,
    ActionId: actionId,
  };
};

const UpdateBudgetAction: OperationHandler = (input, ctx) => {
  const accountId = requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const actionId = requireString(input, "ActionId");
  const oldAction = requireAction(ctx, budgetName, actionId);
  const updated: StoredAction = {
    ...oldAction,
    ...(typeof input["NotificationType"] === "string" && {
      NotificationType: input["NotificationType"],
    }),
    ...(typeof input["ActionThreshold"] === "object" &&
      input["ActionThreshold"] !== null && {
        ActionThreshold: input["ActionThreshold"] as Record<string, unknown>,
      }),
    ...(typeof input["Definition"] === "object" &&
      input["Definition"] !== null && {
        Definition: input["Definition"] as Record<string, unknown>,
      }),
    ...(typeof input["ExecutionRoleArn"] === "string" && {
      ExecutionRoleArn: input["ExecutionRoleArn"],
    }),
    ...(typeof input["ApprovalModel"] === "string" && {
      ApprovalModel: input["ApprovalModel"],
    }),
    ...(Array.isArray(input["Subscribers"]) && {
      Subscribers: subscribersFromInput(input["Subscribers"]),
    }),
  };
  ctx.store.set(actionKey(budgetName, actionId), updated);
  return {
    AccountId: accountId,
    BudgetName: budgetName,
    OldAction: oldAction,
    NewAction: updated,
  };
};

const DeleteBudgetAction: OperationHandler = (input, ctx) => {
  const accountId = requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const actionId = requireString(input, "ActionId");
  const action = requireAction(ctx, budgetName, actionId);
  ctx.store.delete(actionKey(budgetName, actionId));
  for (const entry of ctx.store.list()) {
    if (entry.key.startsWith(`actionhistory/${budgetName}/${actionId}/`)) {
      ctx.store.delete(entry.key);
    }
  }
  return { AccountId: accountId, BudgetName: budgetName, Action: action };
};

const DescribeBudgetAction: OperationHandler = (input, ctx) => {
  const accountId = requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const actionId = requireString(input, "ActionId");
  const action = requireAction(ctx, budgetName, actionId);
  return { AccountId: accountId, BudgetName: budgetName, Action: action };
};

const DescribeBudgetActionsForAccount: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const actions = ctx.store
    .list<StoredAction>()
    .filter((entry) => entry.key.startsWith("action/"))
    .map((entry) => entry.value);
  return { Actions: actions };
};

const DescribeBudgetActionsForBudget: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const actions = ctx.store
    .list<StoredAction>()
    .filter((entry) => entry.key.startsWith(`action/${budgetName}/`))
    .map((entry) => entry.value);
  return { Actions: actions };
};

const DescribeBudgetActionHistories: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const actionId = requireString(input, "ActionId");
  requireAction(ctx, budgetName, actionId);
  const histories = ctx.store
    .list<StoredActionHistory>()
    .filter((entry) =>
      entry.key.startsWith(`actionhistory/${budgetName}/${actionId}/`),
    )
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((entry) => entry.value);
  return { ActionHistories: histories };
};

const ExecuteBudgetAction: OperationHandler = (input, ctx) => {
  const accountId = requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  requireBudget(ctx, budgetName);
  const actionId = requireString(input, "ActionId");
  const executionType = requireString(input, "ExecutionType");
  const action = requireAction(ctx, budgetName, actionId);
  const newStatus =
    executionType === "REVERSE_BUDGET_ACTION"
      ? "REVERSE_IN_PROGRESS"
      : executionType === "RESET_BUDGET_ACTION"
        ? "RESET_IN_PROGRESS"
        : "EXECUTION_IN_PROGRESS";
  const updated: StoredAction = { ...action, Status: newStatus };
  ctx.store.set(actionKey(budgetName, actionId), updated);
  const seq = ctx.store
    .list()
    .filter((entry) =>
      entry.key.startsWith(`actionhistory/${budgetName}/${actionId}/`),
    ).length;
  const histEntry: StoredActionHistory = {
    Timestamp: Date.now() / 1000,
    Status: newStatus,
    EventType: "EXECUTE_ACTION",
    ActionHistoryDetails: {
      Message: `ExecutionType: ${executionType}`,
      Action: updated,
    },
  };
  ctx.store.set(actionHistoryKey(budgetName, actionId, seq), histEntry);
  return {
    AccountId: accountId,
    BudgetName: budgetName,
    ActionId: actionId,
    ExecutionType: executionType,
  };
};

const DescribeBudgetPerformanceHistory: OperationHandler = (input, ctx) => {
  requireString(input, "AccountId");
  const budgetName = requireString(input, "BudgetName");
  const budget = requireBudget(ctx, budgetName);
  return {
    BudgetPerformanceHistory: {
      BudgetName: budgetName,
      BudgetType: budget.BudgetType,
      TimeUnit: budget.TimeUnit,
      BudgetedAndActualAmountsList: [],
    },
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const incoming: Record<string, string> = {};
  if (Array.isArray(input["ResourceTags"])) {
    for (const tag of input["ResourceTags"] as Record<string, unknown>[]) {
      if (typeof tag["Key"] === "string") {
        incoming[tag["Key"]] =
          typeof tag["Value"] === "string" ? tag["Value"] : "";
      }
    }
  }
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  ctx.store.set(tagKey(resourceArn), { ...existing, ...incoming });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const stored =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  const updated = { ...stored };
  if (Array.isArray(input["ResourceTagKeys"])) {
    for (const key of input["ResourceTagKeys"] as unknown[]) {
      if (typeof key === "string") {
        delete updated[key];
      }
    }
  }
  ctx.store.set(tagKey(resourceArn), updated);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const stored =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  const resourceTags = Object.entries(stored).map(([Key, Value]) => ({
    Key,
    Value,
  }));
  return { ResourceTags: resourceTags };
};

const budgets = {
  name: "budgets",
  protocol: "json",
  operations: {
    CreateBudget,
    UpdateBudget,
    DescribeBudget,
    DescribeBudgets,
    DeleteBudget,
    CreateNotification,
    UpdateNotification,
    DeleteNotification,
    DescribeNotificationsForBudget,
    DescribeBudgetNotificationsForAccount,
    CreateSubscriber,
    UpdateSubscriber,
    DeleteSubscriber,
    DescribeSubscribersForNotification,
    CreateBudgetAction,
    UpdateBudgetAction,
    DeleteBudgetAction,
    DescribeBudgetAction,
    DescribeBudgetActionsForAccount,
    DescribeBudgetActionsForBudget,
    DescribeBudgetActionHistories,
    ExecuteBudgetAction,
    DescribeBudgetPerformanceHistory,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default budgets;
