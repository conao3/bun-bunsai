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

const budgetKey = (name: string): string => `budget/${name}`;

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
  return {};
};

const budgets = {
  name: "budgets",
  protocol: "json",
  operations: {
    CreateBudget,
    DescribeBudget,
    DescribeBudgets,
    DeleteBudget,
  },
  model,
} as const satisfies ServiceDefinition;

export default budgets;
