import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BudgetsClient,
  CreateBudgetActionCommand,
  CreateBudgetCommand,
  CreateNotificationCommand,
  CreateSubscriberCommand,
  DeleteBudgetActionCommand,
  DeleteBudgetCommand,
  DeleteNotificationCommand,
  DeleteSubscriberCommand,
  DescribeBudgetActionCommand,
  DescribeBudgetActionHistoriesCommand,
  DescribeBudgetActionsForAccountCommand,
  DescribeBudgetActionsForBudgetCommand,
  DescribeBudgetCommand,
  DescribeBudgetNotificationsForAccountCommand,
  DescribeBudgetPerformanceHistoryCommand,
  DescribeBudgetsCommand,
  DescribeNotificationsForBudgetCommand,
  DescribeSubscribersForNotificationCommand,
  ExecuteBudgetActionCommand,
  ListTagsForResourceCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateBudgetActionCommand,
  UpdateBudgetCommand,
  UpdateNotificationCommand,
  UpdateSubscriberCommand,
} from "@aws-sdk/client-budgets";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const accountId = "000000000000";

const budgets = () =>
  new BudgetsClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Budgets budget roundtrip", async () => {
  const client = budgets();
  const budgetName = `bunsai-e2e-${Date.now()}`;

  await client.send(
    new CreateBudgetCommand({
      AccountId: accountId,
      Budget: {
        BudgetName: budgetName,
        TimeUnit: "MONTHLY",
        BudgetType: "COST",
        BudgetLimit: { Amount: "100.0", Unit: "USD" },
      },
    }),
  );

  const got = await client.send(
    new DescribeBudgetCommand({
      AccountId: accountId,
      BudgetName: budgetName,
    }),
  );
  expect(got.Budget?.BudgetName).toBe(budgetName);
  expect(got.Budget?.TimeUnit).toBe("MONTHLY");
  expect(got.Budget?.BudgetType).toBe("COST");

  const listed = await client.send(
    new DescribeBudgetsCommand({ AccountId: accountId }),
  );
  expect((listed.Budgets ?? []).map((b) => b.BudgetName)).toContain(budgetName);

  await client.send(
    new DeleteBudgetCommand({ AccountId: accountId, BudgetName: budgetName }),
  );

  await expect(
    client.send(
      new DescribeBudgetCommand({
        AccountId: accountId,
        BudgetName: budgetName,
      }),
    ),
  ).rejects.toThrow();
});

test("Budgets UpdateBudget", async () => {
  const client = budgets();
  const budgetName = `bunsai-update-${Date.now()}`;

  await client.send(
    new CreateBudgetCommand({
      AccountId: accountId,
      Budget: {
        BudgetName: budgetName,
        TimeUnit: "MONTHLY",
        BudgetType: "COST",
        BudgetLimit: { Amount: "100.0", Unit: "USD" },
      },
    }),
  );

  await client.send(
    new UpdateBudgetCommand({
      AccountId: accountId,
      NewBudget: {
        BudgetName: budgetName,
        TimeUnit: "QUARTERLY",
        BudgetType: "COST",
        BudgetLimit: { Amount: "200.0", Unit: "USD" },
      },
    }),
  );

  const updated = await client.send(
    new DescribeBudgetCommand({ AccountId: accountId, BudgetName: budgetName }),
  );
  expect(updated.Budget?.TimeUnit).toBe("QUARTERLY");

  await client.send(
    new DeleteBudgetCommand({ AccountId: accountId, BudgetName: budgetName }),
  );
});

test("Budgets notification CRUD", async () => {
  const client = budgets();
  const budgetName = `bunsai-notif-${Date.now()}`;

  await client.send(
    new CreateBudgetCommand({
      AccountId: accountId,
      Budget: {
        BudgetName: budgetName,
        TimeUnit: "MONTHLY",
        BudgetType: "COST",
        BudgetLimit: { Amount: "100.0", Unit: "USD" },
      },
    }),
  );

  const notification = {
    NotificationType: "ACTUAL" as const,
    ComparisonOperator: "GREATER_THAN" as const,
    Threshold: 80,
    ThresholdType: "PERCENTAGE" as const,
  };

  await client.send(
    new CreateNotificationCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      Notification: notification,
      Subscribers: [
        { SubscriptionType: "EMAIL" as const, Address: "test@example.com" },
      ],
    }),
  );

  const listed = await client.send(
    new DescribeNotificationsForBudgetCommand({
      AccountId: accountId,
      BudgetName: budgetName,
    }),
  );
  expect(listed.Notifications).toHaveLength(1);
  expect(listed.Notifications?.[0]?.NotificationType).toBe("ACTUAL");
  expect(listed.Notifications?.[0]?.Threshold).toBe(80);

  await client.send(
    new UpdateNotificationCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      OldNotification: notification,
      NewNotification: {
        NotificationType: "ACTUAL" as const,
        ComparisonOperator: "GREATER_THAN" as const,
        Threshold: 90,
        ThresholdType: "PERCENTAGE" as const,
      },
    }),
  );

  const afterUpdate = await client.send(
    new DescribeNotificationsForBudgetCommand({
      AccountId: accountId,
      BudgetName: budgetName,
    }),
  );
  expect(afterUpdate.Notifications?.[0]?.Threshold).toBe(90);

  const accountNotifs = await client.send(
    new DescribeBudgetNotificationsForAccountCommand({ AccountId: accountId }),
  );
  const found = (accountNotifs.BudgetNotificationsForAccount ?? []).find(
    (b) => b.BudgetName === budgetName,
  );
  expect(found).toBeDefined();

  await client.send(
    new DeleteNotificationCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      Notification: {
        NotificationType: "ACTUAL" as const,
        ComparisonOperator: "GREATER_THAN" as const,
        Threshold: 90,
        ThresholdType: "PERCENTAGE" as const,
      },
    }),
  );

  const afterDelete = await client.send(
    new DescribeNotificationsForBudgetCommand({
      AccountId: accountId,
      BudgetName: budgetName,
    }),
  );
  expect(afterDelete.Notifications ?? []).toHaveLength(0);

  await client.send(
    new DeleteBudgetCommand({ AccountId: accountId, BudgetName: budgetName }),
  );
});

test("Budgets subscriber CRUD", async () => {
  const client = budgets();
  const budgetName = `bunsai-sub-${Date.now()}`;

  await client.send(
    new CreateBudgetCommand({
      AccountId: accountId,
      Budget: {
        BudgetName: budgetName,
        TimeUnit: "MONTHLY",
        BudgetType: "COST",
        BudgetLimit: { Amount: "100.0", Unit: "USD" },
      },
    }),
  );

  const notification = {
    NotificationType: "ACTUAL" as const,
    ComparisonOperator: "GREATER_THAN" as const,
    Threshold: 80,
    ThresholdType: "PERCENTAGE" as const,
  };

  await client.send(
    new CreateNotificationCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      Notification: notification,
      Subscribers: [],
    }),
  );

  await client.send(
    new CreateSubscriberCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      Notification: notification,
      Subscriber: {
        SubscriptionType: "EMAIL" as const,
        Address: "a@example.com",
      },
    }),
  );

  const listed = await client.send(
    new DescribeSubscribersForNotificationCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      Notification: notification,
    }),
  );
  expect(listed.Subscribers).toHaveLength(1);
  expect(listed.Subscribers?.[0]?.Address).toBe("a@example.com");

  await client.send(
    new UpdateSubscriberCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      Notification: notification,
      OldSubscriber: {
        SubscriptionType: "EMAIL" as const,
        Address: "a@example.com",
      },
      NewSubscriber: {
        SubscriptionType: "EMAIL" as const,
        Address: "b@example.com",
      },
    }),
  );

  const afterUpdate = await client.send(
    new DescribeSubscribersForNotificationCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      Notification: notification,
    }),
  );
  expect(afterUpdate.Subscribers?.[0]?.Address).toBe("b@example.com");

  await client.send(
    new DeleteSubscriberCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      Notification: notification,
      Subscriber: {
        SubscriptionType: "EMAIL" as const,
        Address: "b@example.com",
      },
    }),
  );

  const afterDelete = await client.send(
    new DescribeSubscribersForNotificationCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      Notification: notification,
    }),
  );
  expect(afterDelete.Subscribers ?? []).toHaveLength(0);

  await client.send(
    new DeleteBudgetCommand({ AccountId: accountId, BudgetName: budgetName }),
  );
});

test("Budgets action CRUD and execute", async () => {
  const client = budgets();
  const budgetName = `bunsai-action-${Date.now()}`;

  await client.send(
    new CreateBudgetCommand({
      AccountId: accountId,
      Budget: {
        BudgetName: budgetName,
        TimeUnit: "MONTHLY",
        BudgetType: "COST",
        BudgetLimit: { Amount: "100.0", Unit: "USD" },
      },
    }),
  );

  const createResp = await client.send(
    new CreateBudgetActionCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      NotificationType: "ACTUAL",
      ActionType: "APPLY_IAM_POLICY",
      ActionThreshold: {
        ActionThresholdValue: 80,
        ActionThresholdType: "PERCENTAGE",
      },
      Definition: {
        IamActionDefinition: {
          PolicyArn: "arn:aws:iam::aws:policy/AdministratorAccess",
        },
      },
      ExecutionRoleArn: `arn:aws:iam::${accountId}:role/TestRole`,
      ApprovalModel: "AUTOMATIC",
      Subscribers: [{ SubscriptionType: "EMAIL", Address: "test@example.com" }],
    }),
  );
  const actionId = createResp.ActionId!;
  expect(actionId).toBeDefined();
  expect(createResp.AccountId).toBe(accountId);
  expect(createResp.BudgetName).toBe(budgetName);

  const descResp = await client.send(
    new DescribeBudgetActionCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      ActionId: actionId,
    }),
  );
  expect(descResp.Action?.ActionId).toBe(actionId);
  expect(descResp.Action?.Status).toBe("STANDBY");
  expect(descResp.Action?.ApprovalModel).toBe("AUTOMATIC");

  const updateResp = await client.send(
    new UpdateBudgetActionCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      ActionId: actionId,
      ApprovalModel: "MANUAL",
    }),
  );
  expect(updateResp.OldAction?.ApprovalModel).toBe("AUTOMATIC");
  expect(updateResp.NewAction?.ApprovalModel).toBe("MANUAL");

  const forBudget = await client.send(
    new DescribeBudgetActionsForBudgetCommand({
      AccountId: accountId,
      BudgetName: budgetName,
    }),
  );
  expect(forBudget.Actions).toHaveLength(1);
  expect(forBudget.Actions?.[0]?.ActionId).toBe(actionId);

  const forAccount = await client.send(
    new DescribeBudgetActionsForAccountCommand({ AccountId: accountId }),
  );
  expect((forAccount.Actions ?? []).some((a) => a.ActionId === actionId)).toBe(
    true,
  );

  const execResp = await client.send(
    new ExecuteBudgetActionCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      ActionId: actionId,
      ExecutionType: "APPROVE_BUDGET_ACTION",
    }),
  );
  expect(execResp.ActionId).toBe(actionId);
  expect(execResp.ExecutionType).toBe("APPROVE_BUDGET_ACTION");

  const histResp = await client.send(
    new DescribeBudgetActionHistoriesCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      ActionId: actionId,
    }),
  );
  expect((histResp.ActionHistories ?? []).length).toBeGreaterThan(0);
  expect(histResp.ActionHistories?.[0]?.EventType).toBe("EXECUTE_ACTION");

  const deleteResp = await client.send(
    new DeleteBudgetActionCommand({
      AccountId: accountId,
      BudgetName: budgetName,
      ActionId: actionId,
    }),
  );
  expect(deleteResp.Action?.ActionId).toBe(actionId);

  await client.send(
    new DeleteBudgetCommand({ AccountId: accountId, BudgetName: budgetName }),
  );
});

test("Budgets DescribeBudgetPerformanceHistory", async () => {
  const client = budgets();
  const budgetName = `bunsai-perf-${Date.now()}`;

  await client.send(
    new CreateBudgetCommand({
      AccountId: accountId,
      Budget: {
        BudgetName: budgetName,
        TimeUnit: "MONTHLY",
        BudgetType: "COST",
        BudgetLimit: { Amount: "100.0", Unit: "USD" },
      },
    }),
  );

  const resp = await client.send(
    new DescribeBudgetPerformanceHistoryCommand({
      AccountId: accountId,
      BudgetName: budgetName,
    }),
  );
  expect(resp.BudgetPerformanceHistory?.BudgetName).toBe(budgetName);
  expect(resp.BudgetPerformanceHistory?.BudgetType).toBe("COST");

  await client.send(
    new DeleteBudgetCommand({ AccountId: accountId, BudgetName: budgetName }),
  );
});

test("Budgets tag operations", async () => {
  const client = budgets();
  const budgetName = `bunsai-tag-${Date.now()}`;

  await client.send(
    new CreateBudgetCommand({
      AccountId: accountId,
      Budget: {
        BudgetName: budgetName,
        TimeUnit: "MONTHLY",
        BudgetType: "COST",
        BudgetLimit: { Amount: "100.0", Unit: "USD" },
      },
    }),
  );

  const resourceArn = `arn:aws:budgets::${accountId}:budget/${budgetName}`;

  await client.send(
    new TagResourceCommand({
      ResourceARN: resourceArn,
      ResourceTags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: resourceArn }),
  );
  const tags = listed.ResourceTags ?? [];
  expect(tags.find((t) => t.Key === "env")?.Value).toBe("test");
  expect(tags.find((t) => t.Key === "team")?.Value).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({
      ResourceARN: resourceArn,
      ResourceTagKeys: ["team"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: resourceArn }),
  );
  const afterTags = afterUntag.ResourceTags ?? [];
  expect(afterTags.find((t) => t.Key === "env")?.Value).toBe("test");
  expect(afterTags.find((t) => t.Key === "team")).toBeUndefined();

  await client.send(
    new DeleteBudgetCommand({ AccountId: accountId, BudgetName: budgetName }),
  );
});
