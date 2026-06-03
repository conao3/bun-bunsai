import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import servicecatalogModel from "../../../../test/vendor/aws-models/servicecatalog.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(servicecatalogModel);

type Tag = {
  Key: string;
  Value: string;
};

type StoredPortfolio = {
  Id: string;
  ARN: string;
  DisplayName: string;
  Description?: string;
  ProviderName: string;
  CreatedTime: number;
  Tags: Tag[];
};

const portfolioKey = (id: string): string => `portfolio/${id}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError(
      "InvalidParametersException",
      `A parameter was specified that is not valid: ${key}.`,
      400,
    );
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = input[key];
  return typeof value === "string" && value !== "" ? value : undefined;
};

const readTags = (input: Record<string, unknown>, key: string): Tag[] => {
  const value = input[key];
  if (!Array.isArray(value)) {
    return [];
  }
  const tags: Tag[] = [];
  for (const entry of value) {
    if (entry !== null && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      if (typeof record.Key === "string" && typeof record.Value === "string") {
        tags.push({ Key: record.Key, Value: record.Value });
      }
    }
  }
  return tags;
};

const readTagKeys = (input: Record<string, unknown>, key: string): string[] => {
  const value = input[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
};

const randomChars = (length: number): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const detailOf = (portfolio: StoredPortfolio): Record<string, unknown> => ({
  Id: portfolio.Id,
  ARN: portfolio.ARN,
  DisplayName: portfolio.DisplayName,
  Description: portfolio.Description,
  CreatedTime: portfolio.CreatedTime,
  ProviderName: portfolio.ProviderName,
});

const requirePortfolio = (ctx: ServiceContext, id: string): StoredPortfolio => {
  const portfolio = ctx.store.get<StoredPortfolio>(portfolioKey(id));
  if (portfolio === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified resource was not found.",
      400,
    );
  }
  return portfolio;
};

const CreatePortfolio: OperationHandler = (input, ctx) => {
  const displayName = requireString(input, "DisplayName");
  const providerName = requireString(input, "ProviderName");
  requireString(input, "IdempotencyToken");
  const id = `port-${randomChars(13)}`;
  const portfolio: StoredPortfolio = {
    Id: id,
    ARN: `arn:aws:catalog:${ctx.region}:${ctx.account}:portfolio/${id}`,
    DisplayName: displayName,
    Description: optionalString(input, "Description"),
    ProviderName: providerName,
    CreatedTime: nowSeconds(),
    Tags: readTags(input, "Tags"),
  };
  ctx.store.set(portfolioKey(id), portfolio);
  return { PortfolioDetail: detailOf(portfolio), Tags: portfolio.Tags };
};

const ListPortfolios: OperationHandler = (_input, ctx) => {
  const portfolios = ctx.store
    .list<StoredPortfolio>()
    .filter((entry) => entry.key.startsWith("portfolio/"))
    .map((entry) => detailOf(entry.value));
  return { PortfolioDetails: portfolios };
};

const DescribePortfolio: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const portfolio = requirePortfolio(ctx, id);
  return {
    PortfolioDetail: detailOf(portfolio),
    Tags: portfolio.Tags,
    TagOptions: [],
    Budgets: [],
  };
};

const DeletePortfolio: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  requirePortfolio(ctx, id);
  ctx.store.delete(portfolioKey(id));
  return {};
};

const UpdatePortfolio: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const portfolio = requirePortfolio(ctx, id);
  const displayName = optionalString(input, "DisplayName");
  if (displayName !== undefined) {
    portfolio.DisplayName = displayName;
  }
  const description = optionalString(input, "Description");
  if (description !== undefined) {
    portfolio.Description = description;
  }
  const providerName = optionalString(input, "ProviderName");
  if (providerName !== undefined) {
    portfolio.ProviderName = providerName;
  }
  const removeTags = readTagKeys(input, "RemoveTags");
  if (removeTags.length > 0) {
    portfolio.Tags = portfolio.Tags.filter(
      (tag) => !removeTags.includes(tag.Key),
    );
  }
  const addTags = readTags(input, "AddTags");
  for (const tag of addTags) {
    portfolio.Tags = portfolio.Tags.filter(
      (existing) => existing.Key !== tag.Key,
    );
    portfolio.Tags.push(tag);
  }
  ctx.store.set(portfolioKey(id), portfolio);
  return { PortfolioDetail: detailOf(portfolio), Tags: portfolio.Tags };
};

const servicecatalog = {
  name: "servicecatalog",
  protocol: "json",
  operations: {
    CreatePortfolio,
    ListPortfolios,
    DescribePortfolio,
    DeletePortfolio,
    UpdatePortfolio,
  },
  model,
} as const satisfies ServiceDefinition;

export default servicecatalog;
