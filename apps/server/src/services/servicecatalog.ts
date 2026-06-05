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

type StoredProduct = {
  Id: string;
  ARN: string;
  Name: string;
  Owner: string;
  Description?: string;
  ProductType: string;
  Distributor?: string;
  SupportDescription?: string;
  SupportEmail?: string;
  SupportUrl?: string;
  CreatedTime: number;
  Tags: Tag[];
};

type StoredProvisioningArtifact = {
  Id: string;
  Name: string;
  Description?: string;
  Type: string;
  CreatedTime: number;
  Active: boolean;
  Guidance: string;
  ProductId: string;
};

type StoredConstraint = {
  Id: string;
  PortfolioId: string;
  ProductId: string;
  Type: string;
  Parameters: string;
  Description?: string;
};

type StoredProvisionedProduct = {
  Id: string;
  ARN: string;
  Name: string;
  ProductId: string;
  ProvisioningArtifactId: string;
  Status: string;
  StatusMessage?: string;
  CreatedTime: number;
  LastRecordId: string;
  Tags: Tag[];
  Type: string;
};

type StoredProvisionedProductPlan = {
  PlanId: string;
  PlanName: string;
  PlanType: string;
  ProductId: string;
  ProvisioningArtifactId: string;
  ProvisionedProductName: string;
  Status: string;
  CreatedTime: number;
};

type StoredServiceAction = {
  Id: string;
  Name: string;
  Description?: string;
  DefinitionType: string;
  Definition: Record<string, string>;
};

type StoredTagOption = {
  Id: string;
  Key: string;
  Value: string;
  Active: boolean;
};

type StoredRecord = {
  RecordId: string;
  ProvisionedProductId: string;
  ProvisionedProductName: string;
  RecordType: string;
  Status: string;
  CreatedTime: number;
  UpdatedTime: number;
  RecordErrors: unknown[];
  RecordTags: Tag[];
};

type StoredPrincipal = {
  PrincipalARN: string;
  PrincipalType: string;
};

type StoredPortfolioShare = {
  AccountId: string;
  Type: string;
  Status: string;
  ShareTagOptions: boolean;
  SharePrincipals: boolean;
};

const portfolioKey = (id: string): string => `portfolio/${id}`;
const productKey = (id: string): string => `product/${id}`;
const paKey = (id: string): string => `pa/${id}`;
const constraintKey = (id: string): string => `constraint/${id}`;
const ppKey = (id: string): string => `pp/${id}`;
const pplanKey = (id: string): string => `pplan/${id}`;
const saKey = (id: string): string => `sa/${id}`;
const toKey = (id: string): string => `to/${id}`;
const recordKey = (id: string): string => `record/${id}`;

const shareKey = (
  portfolioId: string,
  type: string,
  accountId: string,
): string => `share/${portfolioId}/${type}/${accountId}`;

const assocPPKey = (portfolioId: string, productId: string): string =>
  `assoc/pp/${portfolioId}/${productId}`;

const assocPrincipalKey = (portfolioId: string, principalArn: string): string =>
  `assoc/prin/${portfolioId}/${principalArn}`;

const assocSAKey = (saId: string, productId: string, paId: string): string =>
  `assoc/sa/${saId}/${productId}/${paId}`;

const assocTagOptionKey = (resourceId: string, tagOptionId: string): string =>
  `assoc/to/${resourceId}/${tagOptionId}`;

const assocBudgetKey = (resourceId: string, budgetName: string): string =>
  `assoc/budget/${resourceId}/${budgetName}`;

const orgsAccessKey = (): string => `orgsAccess`;

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

const optionalBoolean = (
  input: Record<string, unknown>,
  key: string,
): boolean | undefined => {
  const value = input[key];
  return typeof value === "boolean" ? value : undefined;
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

const readStringRecord = (
  input: Record<string, unknown>,
  key: string,
): Record<string, string> => {
  const value = input[key];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === "string") {
      result[k] = v;
    }
  }
  return result;
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

const productSummary = (product: StoredProduct): Record<string, unknown> => ({
  Id: product.Id,
  Name: product.Name,
  Owner: product.Owner,
  Type: product.ProductType,
  ProductARN: product.ARN,
  CreatedTime: product.CreatedTime,
  Description: product.Description,
  Distributor: product.Distributor,
  SupportDescription: product.SupportDescription,
  SupportEmail: product.SupportEmail,
  SupportUrl: product.SupportUrl,
  HasDefaultPath: false,
  ShortDescription: product.Description,
});

const requireProduct = (ctx: ServiceContext, id: string): StoredProduct => {
  const product = ctx.store.get<StoredProduct>(productKey(id));
  if (product === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified resource was not found.",
      400,
    );
  }
  return product;
};

const paSummary = (
  pa: StoredProvisioningArtifact,
): Record<string, unknown> => ({
  Id: pa.Id,
  Name: pa.Name,
  Description: pa.Description,
  CreatedTime: pa.CreatedTime,
  Type: pa.Type,
  Guidance: pa.Guidance,
  Active: pa.Active,
});

const requirePA = (
  ctx: ServiceContext,
  id: string,
): StoredProvisioningArtifact => {
  const pa = ctx.store.get<StoredProvisioningArtifact>(paKey(id));
  if (pa === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified resource was not found.",
      400,
    );
  }
  return pa;
};

const saSummary = (sa: StoredServiceAction): Record<string, unknown> => ({
  Id: sa.Id,
  Name: sa.Name,
  Description: sa.Description,
  DefinitionType: sa.DefinitionType,
  Definition: sa.Definition,
});

const requireSA = (ctx: ServiceContext, id: string): StoredServiceAction => {
  const sa = ctx.store.get<StoredServiceAction>(saKey(id));
  if (sa === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified resource was not found.",
      400,
    );
  }
  return sa;
};

const toSummary = (to: StoredTagOption): Record<string, unknown> => ({
  Id: to.Id,
  Key: to.Key,
  Value: to.Value,
  Active: to.Active,
});

const requireTO = (ctx: ServiceContext, id: string): StoredTagOption => {
  const to = ctx.store.get<StoredTagOption>(toKey(id));
  if (to === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified resource was not found.",
      400,
    );
  }
  return to;
};

const requireConstraint = (
  ctx: ServiceContext,
  id: string,
): StoredConstraint => {
  const constraint = ctx.store.get<StoredConstraint>(constraintKey(id));
  if (constraint === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified resource was not found.",
      400,
    );
  }
  return constraint;
};

const ppSummary = (pp: StoredProvisionedProduct): Record<string, unknown> => ({
  Id: pp.Id,
  ARN: pp.ARN,
  Name: pp.Name,
  Type: pp.Type,
  Status: pp.Status,
  StatusMessage: pp.StatusMessage,
  CreatedTime: pp.CreatedTime,
  ProductId: pp.ProductId,
  ProvisioningArtifactId: pp.ProvisioningArtifactId,
  LastRecordId: pp.LastRecordId,
});

const requirePP = (
  ctx: ServiceContext,
  id: string,
): StoredProvisionedProduct => {
  const pp = ctx.store.get<StoredProvisionedProduct>(ppKey(id));
  if (pp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified resource was not found.",
      400,
    );
  }
  return pp;
};

const recordSummary = (record: StoredRecord): Record<string, unknown> => ({
  RecordId: record.RecordId,
  ProvisionedProductId: record.ProvisionedProductId,
  ProvisionedProductName: record.ProvisionedProductName,
  RecordType: record.RecordType,
  Status: record.Status,
  CreatedTime: record.CreatedTime,
  UpdatedTime: record.UpdatedTime,
  RecordErrors: record.RecordErrors,
  RecordTags: record.RecordTags,
});

const createRecord = (
  ctx: ServiceContext,
  ppId: string,
  ppName: string,
  recordType: string,
): StoredRecord => {
  const recordId = `rec-${randomChars(13)}`;
  const now = nowSeconds();
  const record: StoredRecord = {
    RecordId: recordId,
    ProvisionedProductId: ppId,
    ProvisionedProductName: ppName,
    RecordType: recordType,
    Status: "SUCCEEDED",
    CreatedTime: now,
    UpdatedTime: now,
    RecordErrors: [],
    RecordTags: [],
  };
  ctx.store.set(recordKey(recordId), record);
  return record;
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

const CreatePortfolioShare: OperationHandler = (input, ctx) => {
  const portfolioId = requireString(input, "PortfolioId");
  requirePortfolio(ctx, portfolioId);
  const accountId = optionalString(input, "AccountId") ?? "000000000000";
  const shareType = "ACCOUNT";
  const share: StoredPortfolioShare = {
    AccountId: accountId,
    Type: shareType,
    Status: "COMPLETED",
    ShareTagOptions: (input["ShareTagOptions"] as boolean | undefined) ?? false,
    SharePrincipals: (input["SharePrincipals"] as boolean | undefined) ?? false,
  };
  ctx.store.set(shareKey(portfolioId, shareType, accountId), share);
  return {};
};

const DeletePortfolioShare: OperationHandler = (input, ctx) => {
  const portfolioId = requireString(input, "PortfolioId");
  requirePortfolio(ctx, portfolioId);
  const accountId = optionalString(input, "AccountId") ?? "";
  ctx.store.delete(shareKey(portfolioId, "ACCOUNT", accountId));
  return {};
};

const UpdatePortfolioShare: OperationHandler = (input, ctx) => {
  const portfolioId = requireString(input, "PortfolioId");
  requirePortfolio(ctx, portfolioId);
  return {
    PortfolioShareDetail: {
      ShareTagOptions: false,
      SharePrincipals: false,
      Type: "ACCOUNT",
      Status: "COMPLETED",
      StatusMessage: "",
    },
  };
};

const DescribePortfolioShareStatus: OperationHandler = (input, _ctx) => {
  const portfolioShareToken =
    optionalString(input, "PortfolioShareToken") ?? "token";
  return {
    PortfolioShareToken: portfolioShareToken,
    PortfolioId: "",
    OrganizationNodeValue: "",
    Status: "COMPLETED",
    ShareDetails: {
      ShareInProgressCount: 0,
      SuccessfulShares: [],
      ShareErrors: [],
    },
  };
};

const DescribePortfolioShares: OperationHandler = (input, ctx) => {
  const portfolioId = requireString(input, "PortfolioId");
  requirePortfolio(ctx, portfolioId);
  const prefix = `share/${portfolioId}/`;
  const shares = ctx.store
    .list<StoredPortfolioShare>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => ({
      PrincipalId: entry.value.AccountId,
      Type: entry.value.Type,
      Status: entry.value.Status,
      ShareTagOptions: entry.value.ShareTagOptions,
      SharePrincipals: entry.value.SharePrincipals,
    }));
  return { PortfolioShareDetails: shares };
};

const AcceptPortfolioShare: OperationHandler = (_input, _ctx) => ({});

const RejectPortfolioShare: OperationHandler = (_input, _ctx) => ({});

const ListAcceptedPortfolioShares: OperationHandler = (_input, ctx) => {
  const portfolios = ctx.store
    .list<StoredPortfolio>()
    .filter((entry) => entry.key.startsWith("portfolio/"))
    .map((entry) => detailOf(entry.value));
  return { PortfolioDetails: portfolios };
};

const ListPortfolioAccess: OperationHandler = (input, ctx) => {
  const portfolioId = requireString(input, "PortfolioId");
  requirePortfolio(ctx, portfolioId);
  const prefix = `share/${portfolioId}/ACCOUNT/`;
  const accounts = ctx.store
    .list<StoredPortfolioShare>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value.AccountId);
  return { AccountIds: accounts };
};

const ListOrganizationPortfolioAccess: OperationHandler = (input, ctx) => {
  const portfolioId = requireString(input, "PortfolioId");
  requirePortfolio(ctx, portfolioId);
  return { OrganizationNodes: [] };
};

const AssociatePrincipalWithPortfolio: OperationHandler = (input, ctx) => {
  const portfolioId = requireString(input, "PortfolioId");
  const principalArn = requireString(input, "PrincipalARN");
  const principalType = requireString(input, "PrincipalType");
  requirePortfolio(ctx, portfolioId);
  const principal: StoredPrincipal = {
    PrincipalARN: principalArn,
    PrincipalType: principalType,
  };
  ctx.store.set(assocPrincipalKey(portfolioId, principalArn), principal);
  return {};
};

const DisassociatePrincipalFromPortfolio: OperationHandler = (input, ctx) => {
  const portfolioId = requireString(input, "PortfolioId");
  const principalArn = requireString(input, "PrincipalARN");
  requirePortfolio(ctx, portfolioId);
  ctx.store.delete(assocPrincipalKey(portfolioId, principalArn));
  return {};
};

const ListPrincipalsForPortfolio: OperationHandler = (input, ctx) => {
  const portfolioId = requireString(input, "PortfolioId");
  requirePortfolio(ctx, portfolioId);
  const prefix = `assoc/prin/${portfolioId}/`;
  const principals = ctx.store
    .list<StoredPrincipal>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => ({
      PrincipalARN: entry.value.PrincipalARN,
      PrincipalType: entry.value.PrincipalType,
    }));
  return { Principals: principals };
};

const CreateProduct: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const owner = requireString(input, "Owner");
  const productType = requireString(input, "ProductType");
  requireString(input, "IdempotencyToken");
  const id = `prod-${randomChars(13)}`;
  const product: StoredProduct = {
    Id: id,
    ARN: `arn:aws:catalog:${ctx.region}:${ctx.account}:product/${id}`,
    Name: name,
    Owner: owner,
    Description: optionalString(input, "Description"),
    ProductType: productType,
    Distributor: optionalString(input, "Distributor"),
    SupportDescription: optionalString(input, "SupportDescription"),
    SupportEmail: optionalString(input, "SupportEmail"),
    SupportUrl: optionalString(input, "SupportUrl"),
    CreatedTime: nowSeconds(),
    Tags: readTags(input, "Tags"),
  };
  ctx.store.set(productKey(id), product);
  let pa: StoredProvisioningArtifact | undefined;
  const paProperties = input["ProvisioningArtifactParameters"];
  if (
    paProperties !== null &&
    typeof paProperties === "object" &&
    !Array.isArray(paProperties)
  ) {
    const props = paProperties as Record<string, unknown>;
    const paId = `pa-${randomChars(13)}`;
    pa = {
      Id: paId,
      Name: typeof props["Name"] === "string" ? props["Name"] : "v1",
      Description:
        typeof props["Description"] === "string"
          ? props["Description"]
          : undefined,
      Type:
        typeof props["Type"] === "string"
          ? props["Type"]
          : "CLOUD_FORMATION_TEMPLATE",
      CreatedTime: nowSeconds(),
      Active: true,
      Guidance: "DEFAULT",
      ProductId: id,
    };
    ctx.store.set(paKey(paId), pa);
  }
  return {
    ProductViewDetail: {
      ProductViewSummary: productSummary(product),
      Status: "CREATED",
      ProductARN: product.ARN,
      CreatedTime: product.CreatedTime,
    },
    ProvisioningArtifactDetail: pa
      ? {
          Id: pa.Id,
          Name: pa.Name,
          Description: pa.Description,
          Type: pa.Type,
          CreatedTime: pa.CreatedTime,
          Active: pa.Active,
          Guidance: pa.Guidance,
        }
      : undefined,
    Tags: product.Tags,
  };
};

const DescribeProduct: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const product = requireProduct(ctx, id);
  const pas = ctx.store
    .list<StoredProvisioningArtifact>()
    .filter(
      (entry) => entry.key.startsWith("pa/") && entry.value.ProductId === id,
    )
    .map((entry) => paSummary(entry.value));
  return {
    ProductViewSummary: productSummary(product),
    ProvisioningArtifacts: pas,
    Budgets: [],
    LaunchPaths: [],
  };
};

const DescribeProductAsAdmin: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const product = requireProduct(ctx, id);
  const pas = ctx.store
    .list<StoredProvisioningArtifact>()
    .filter(
      (entry) => entry.key.startsWith("pa/") && entry.value.ProductId === id,
    )
    .map((entry) => ({
      ProvisioningArtifactDetail: {
        Id: entry.value.Id,
        Name: entry.value.Name,
        Description: entry.value.Description,
        Type: entry.value.Type,
        CreatedTime: entry.value.CreatedTime,
        Active: entry.value.Active,
        Guidance: entry.value.Guidance,
      },
      Active: entry.value.Active,
    }));
  return {
    ProductViewDetail: {
      ProductViewSummary: productSummary(product),
      Status: "CREATED",
      ProductARN: product.ARN,
      CreatedTime: product.CreatedTime,
    },
    ProvisioningArtifactSummaries: pas,
    Tags: product.Tags,
    TagOptions: [],
    Budgets: [],
  };
};

const DescribeProductView: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const product = requireProduct(ctx, id);
  const pas = ctx.store
    .list<StoredProvisioningArtifact>()
    .filter(
      (entry) => entry.key.startsWith("pa/") && entry.value.ProductId === id,
    )
    .map((entry) => paSummary(entry.value));
  return {
    ProductViewSummary: productSummary(product),
    ProvisioningArtifacts: pas,
  };
};

const UpdateProduct: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const product = requireProduct(ctx, id);
  const name = optionalString(input, "Name");
  if (name !== undefined) product.Name = name;
  const owner = optionalString(input, "Owner");
  if (owner !== undefined) product.Owner = owner;
  const description = optionalString(input, "Description");
  if (description !== undefined) product.Description = description;
  const distributor = optionalString(input, "Distributor");
  if (distributor !== undefined) product.Distributor = distributor;
  const supportDescription = optionalString(input, "SupportDescription");
  if (supportDescription !== undefined)
    product.SupportDescription = supportDescription;
  const supportEmail = optionalString(input, "SupportEmail");
  if (supportEmail !== undefined) product.SupportEmail = supportEmail;
  const supportUrl = optionalString(input, "SupportUrl");
  if (supportUrl !== undefined) product.SupportUrl = supportUrl;
  const removeTags = readTagKeys(input, "RemoveTags");
  if (removeTags.length > 0) {
    product.Tags = product.Tags.filter((tag) => !removeTags.includes(tag.Key));
  }
  const addTags = readTags(input, "AddTags");
  for (const tag of addTags) {
    product.Tags = product.Tags.filter((existing) => existing.Key !== tag.Key);
    product.Tags.push(tag);
  }
  ctx.store.set(productKey(id), product);
  return {
    ProductViewDetail: {
      ProductViewSummary: productSummary(product),
      Status: "CREATED",
      ProductARN: product.ARN,
      CreatedTime: product.CreatedTime,
    },
    Tags: product.Tags,
  };
};

const DeleteProduct: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  requireProduct(ctx, id);
  ctx.store.delete(productKey(id));
  return {};
};

const SearchProducts: OperationHandler = (_input, ctx) => {
  const products = ctx.store
    .list<StoredProduct>()
    .filter((entry) => entry.key.startsWith("product/"))
    .map((entry) => productSummary(entry.value));
  return { ProductViewSummaries: products, ProductViewAggregations: {} };
};

const SearchProductsAsAdmin: OperationHandler = (_input, ctx) => {
  const products = ctx.store
    .list<StoredProduct>()
    .filter((entry) => entry.key.startsWith("product/"))
    .map((entry) => ({
      ProductViewDetail: {
        ProductViewSummary: productSummary(entry.value),
        Status: "CREATED",
        ProductARN: entry.value.ARN,
        CreatedTime: entry.value.CreatedTime,
      },
    }));
  return { ProductViewDetails: products };
};

const CopyProduct: OperationHandler = (_input, _ctx) => ({
  CopyProductToken: `copy-${randomChars(13)}`,
});

const DescribeCopyProductStatus: OperationHandler = (_input, _ctx) => ({
  CopyProductStatus: "SUCCEEDED",
  TargetProductId: "",
  StatusDetail: "",
});

const AssociateProductWithPortfolio: OperationHandler = (input, ctx) => {
  const portfolioId = requireString(input, "PortfolioId");
  const productId = requireString(input, "ProductId");
  requirePortfolio(ctx, portfolioId);
  requireProduct(ctx, productId);
  ctx.store.set(assocPPKey(portfolioId, productId), true);
  return {};
};

const DisassociateProductFromPortfolio: OperationHandler = (input, ctx) => {
  const portfolioId = requireString(input, "PortfolioId");
  const productId = requireString(input, "ProductId");
  requirePortfolio(ctx, portfolioId);
  ctx.store.delete(assocPPKey(portfolioId, productId));
  return {};
};

const ListPortfoliosForProduct: OperationHandler = (input, ctx) => {
  const productId = requireString(input, "ProductId");
  requireProduct(ctx, productId);
  const portfolios = ctx.store
    .list<boolean>()
    .filter(
      (entry) =>
        entry.key.startsWith("assoc/pp/") &&
        entry.key.endsWith(`/${productId}`),
    )
    .map((entry) => {
      const parts = entry.key.split("/");
      const portfolioId = parts[2] ?? "";
      const portfolio = ctx.store.get<StoredPortfolio>(
        portfolioKey(portfolioId),
      );
      return portfolio ? detailOf(portfolio) : null;
    })
    .filter((p): p is Record<string, unknown> => p !== null);
  return { PortfolioDetails: portfolios };
};

const CreateProvisioningArtifact: OperationHandler = (input, ctx) => {
  const productId = requireString(input, "ProductId");
  requireString(input, "IdempotencyToken");
  requireProduct(ctx, productId);
  const parameters = input["Parameters"];
  const props =
    parameters !== null &&
    typeof parameters === "object" &&
    !Array.isArray(parameters)
      ? (parameters as Record<string, unknown>)
      : {};
  const paId = `pa-${randomChars(13)}`;
  const pa: StoredProvisioningArtifact = {
    Id: paId,
    Name: typeof props["Name"] === "string" ? props["Name"] : "artifact",
    Description:
      typeof props["Description"] === "string"
        ? props["Description"]
        : undefined,
    Type:
      typeof props["Type"] === "string"
        ? props["Type"]
        : "CLOUD_FORMATION_TEMPLATE",
    CreatedTime: nowSeconds(),
    Active: true,
    Guidance: "DEFAULT",
    ProductId: productId,
  };
  ctx.store.set(paKey(paId), pa);
  return {
    ProvisioningArtifactDetail: {
      Id: pa.Id,
      Name: pa.Name,
      Description: pa.Description,
      Type: pa.Type,
      CreatedTime: pa.CreatedTime,
      Active: pa.Active,
      Guidance: pa.Guidance,
    },
    Info: {},
    Status: "CREATED",
  };
};

const DescribeProvisioningArtifact: OperationHandler = (input, ctx) => {
  const paId = requireString(input, "ProvisioningArtifactId");
  const pa = requirePA(ctx, paId);
  return {
    ProvisioningArtifactDetail: {
      Id: pa.Id,
      Name: pa.Name,
      Description: pa.Description,
      Type: pa.Type,
      CreatedTime: pa.CreatedTime,
      Active: pa.Active,
      Guidance: pa.Guidance,
    },
    Info: {},
    Status: "CREATED",
  };
};

const UpdateProvisioningArtifact: OperationHandler = (input, ctx) => {
  const paId = requireString(input, "ProvisioningArtifactId");
  const pa = requirePA(ctx, paId);
  const name = optionalString(input, "Name");
  if (name !== undefined) pa.Name = name;
  const description = optionalString(input, "Description");
  if (description !== undefined) pa.Description = description;
  const active = optionalBoolean(input, "Active");
  if (active !== undefined) pa.Active = active;
  const guidance = optionalString(input, "Guidance");
  if (guidance !== undefined) pa.Guidance = guidance;
  ctx.store.set(paKey(paId), pa);
  return {
    ProvisioningArtifactDetail: {
      Id: pa.Id,
      Name: pa.Name,
      Description: pa.Description,
      Type: pa.Type,
      CreatedTime: pa.CreatedTime,
      Active: pa.Active,
      Guidance: pa.Guidance,
    },
    Info: {},
    Status: "CREATED",
  };
};

const DeleteProvisioningArtifact: OperationHandler = (input, ctx) => {
  const paId = requireString(input, "ProvisioningArtifactId");
  requirePA(ctx, paId);
  ctx.store.delete(paKey(paId));
  return {};
};

const ListProvisioningArtifacts: OperationHandler = (input, ctx) => {
  const productId = requireString(input, "ProductId");
  requireProduct(ctx, productId);
  const pas = ctx.store
    .list<StoredProvisioningArtifact>()
    .filter(
      (entry) =>
        entry.key.startsWith("pa/") && entry.value.ProductId === productId,
    )
    .map((entry) => ({
      Id: entry.value.Id,
      Name: entry.value.Name,
      Description: entry.value.Description,
      CreatedTime: entry.value.CreatedTime,
      Type: entry.value.Type,
      Guidance: entry.value.Guidance,
      Active: entry.value.Active,
    }));
  return { ProvisioningArtifactDetails: pas };
};

const DescribeProvisioningParameters: OperationHandler = (_input, _ctx) => ({
  ProvisioningArtifactParameters: [],
  ConstraintSummaries: [],
  UsageInstructions: [],
  TagOptions: [],
  ProvisioningArtifactPreferences: {},
});

const ListProvisioningArtifactsForServiceAction: OperationHandler = (
  input,
  ctx,
) => {
  const saId = requireString(input, "ServiceActionId");
  requireSA(ctx, saId);
  const prefix = `assoc/sa/${saId}/`;
  const results = ctx.store
    .list<boolean>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => {
      const parts = entry.key.split("/");
      const productId = parts[3] ?? "";
      const paId = parts[4] ?? "";
      const pa = ctx.store.get<StoredProvisioningArtifact>(paKey(paId));
      const product = ctx.store.get<StoredProduct>(productKey(productId));
      if (!pa || !product) return null;
      return {
        ProvisioningArtifactDetail: paSummary(pa),
        ProductViewSummary: productSummary(product),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  return { ProvisioningArtifactViews: results };
};

const CreateConstraint: OperationHandler = (input, ctx) => {
  const portfolioId = requireString(input, "PortfolioId");
  const productId = requireString(input, "ProductId");
  const constraintType = requireString(input, "Type");
  const parameters = requireString(input, "Parameters");
  requireString(input, "IdempotencyToken");
  requirePortfolio(ctx, portfolioId);
  requireProduct(ctx, productId);
  const id = `cons-${randomChars(13)}`;
  const constraint: StoredConstraint = {
    Id: id,
    PortfolioId: portfolioId,
    ProductId: productId,
    Type: constraintType,
    Parameters: parameters,
    Description: optionalString(input, "Description"),
  };
  ctx.store.set(constraintKey(id), constraint);
  return {
    ConstraintDetail: {
      ConstraintId: id,
      PortfolioId: portfolioId,
      ProductId: productId,
      Type: constraintType,
      Description: constraint.Description,
    },
    ConstraintParameters: parameters,
    Status: "CREATED",
  };
};

const DescribeConstraint: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const constraint = requireConstraint(ctx, id);
  return {
    ConstraintDetail: {
      ConstraintId: id,
      PortfolioId: constraint.PortfolioId,
      ProductId: constraint.ProductId,
      Type: constraint.Type,
      Description: constraint.Description,
    },
    ConstraintParameters: constraint.Parameters,
    Status: "CREATED",
  };
};

const UpdateConstraint: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const constraint = requireConstraint(ctx, id);
  const description = optionalString(input, "Description");
  if (description !== undefined) constraint.Description = description;
  const parameters = optionalString(input, "Parameters");
  if (parameters !== undefined) constraint.Parameters = parameters;
  ctx.store.set(constraintKey(id), constraint);
  return {
    ConstraintDetail: {
      ConstraintId: id,
      PortfolioId: constraint.PortfolioId,
      ProductId: constraint.ProductId,
      Type: constraint.Type,
      Description: constraint.Description,
    },
    ConstraintParameters: constraint.Parameters,
    Status: "CREATED",
  };
};

const DeleteConstraint: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  requireConstraint(ctx, id);
  ctx.store.delete(constraintKey(id));
  return {};
};

const ListConstraintsForPortfolio: OperationHandler = (input, ctx) => {
  const portfolioId = requireString(input, "PortfolioId");
  requirePortfolio(ctx, portfolioId);
  const constraints = ctx.store
    .list<StoredConstraint>()
    .filter(
      (entry) =>
        entry.key.startsWith("constraint/") &&
        entry.value.PortfolioId === portfolioId,
    )
    .map((entry) => ({
      ConstraintId: entry.value.Id,
      PortfolioId: entry.value.PortfolioId,
      ProductId: entry.value.ProductId,
      Type: entry.value.Type,
      Description: entry.value.Description,
    }));
  return { ConstraintDetails: constraints };
};

const ProvisionProduct: OperationHandler = (input, ctx) => {
  const productId = requireString(input, "ProductId");
  const paId = requireString(input, "ProvisioningArtifactId");
  const ppName = requireString(input, "ProvisionedProductName");
  requireString(input, "ProvisionToken");
  requireProduct(ctx, productId);
  requirePA(ctx, paId);
  const ppId = `pp-${randomChars(13)}`;
  const now = nowSeconds();
  const record = createRecord(ctx, ppId, ppName, "PROVISION_PRODUCT");
  const pp: StoredProvisionedProduct = {
    Id: ppId,
    ARN: `arn:aws:servicecatalog:${ctx.region}:${ctx.account}:stack/${ppName}/${ppId}`,
    Name: ppName,
    ProductId: productId,
    ProvisioningArtifactId: paId,
    Status: "AVAILABLE",
    CreatedTime: now,
    LastRecordId: record.RecordId,
    Tags: readTags(input, "Tags"),
    Type: "CFN_STACK",
  };
  ctx.store.set(ppKey(ppId), pp);
  return { RecordDetail: recordSummary(record) };
};

const DescribeProvisionedProduct: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const pp = requirePP(ctx, id);
  return {
    ProvisionedProductDetail: {
      Id: pp.Id,
      ARN: pp.ARN,
      Name: pp.Name,
      Type: pp.Type,
      Status: pp.Status,
      StatusMessage: pp.StatusMessage,
      CreatedTime: pp.CreatedTime,
      ProductId: pp.ProductId,
      ProvisioningArtifactId: pp.ProvisioningArtifactId,
      LastRecordId: pp.LastRecordId,
    },
    CloudWatchDashboards: [],
  };
};

const UpdateProvisionedProduct: OperationHandler = (input, ctx) => {
  const ppId = requireString(input, "ProvisionedProductId");
  requireString(input, "UpdateToken");
  const pp = requirePP(ctx, ppId);
  const paId = optionalString(input, "ProvisioningArtifactId");
  if (paId !== undefined) {
    pp.ProvisioningArtifactId = paId;
  }
  const record = createRecord(ctx, ppId, pp.Name, "UPDATE_PROVISIONED_PRODUCT");
  pp.LastRecordId = record.RecordId;
  ctx.store.set(ppKey(ppId), pp);
  return { RecordDetail: recordSummary(record) };
};

const TerminateProvisionedProduct: OperationHandler = (input, ctx) => {
  const ppId = requireString(input, "ProvisionedProductId");
  requireString(input, "TerminateToken");
  const pp = requirePP(ctx, ppId);
  const record = createRecord(
    ctx,
    ppId,
    pp.Name,
    "TERMINATE_PROVISIONED_PRODUCT",
  );
  ctx.store.delete(ppKey(ppId));
  return { RecordDetail: recordSummary(record) };
};

const ScanProvisionedProducts: OperationHandler = (_input, ctx) => {
  const pps = ctx.store
    .list<StoredProvisionedProduct>()
    .filter((entry) => entry.key.startsWith("pp/"))
    .map((entry) => ppSummary(entry.value));
  return { ProvisionedProducts: pps };
};

const SearchProvisionedProducts: OperationHandler = (_input, ctx) => {
  const pps = ctx.store
    .list<StoredProvisionedProduct>()
    .filter((entry) => entry.key.startsWith("pp/"))
    .map((entry) => ppSummary(entry.value));
  return { ProvisionedProducts: pps, TotalResultsCount: pps.length };
};

const GetProvisionedProductOutputs: OperationHandler = (input, ctx) => {
  const ppId = requireString(input, "ProvisionedProductId");
  requirePP(ctx, ppId);
  return { Outputs: [] };
};

const ImportAsProvisionedProduct: OperationHandler = (input, ctx) => {
  const productId = requireString(input, "ProductId");
  const paId = requireString(input, "ProvisioningArtifactId");
  const ppName = requireString(input, "ProvisionedProductName");
  requireString(input, "IdempotencyToken");
  requireProduct(ctx, productId);
  requirePA(ctx, paId);
  const ppId = `pp-${randomChars(13)}`;
  const now = nowSeconds();
  const record = createRecord(ctx, ppId, ppName, "IMPORT_PROVISIONED_PRODUCT");
  const pp: StoredProvisionedProduct = {
    Id: ppId,
    ARN: `arn:aws:servicecatalog:${ctx.region}:${ctx.account}:stack/${ppName}/${ppId}`,
    Name: ppName,
    ProductId: productId,
    ProvisioningArtifactId: paId,
    Status: "AVAILABLE",
    CreatedTime: now,
    LastRecordId: record.RecordId,
    Tags: [],
    Type: "CFN_STACK",
  };
  ctx.store.set(ppKey(ppId), pp);
  return { RecordDetail: recordSummary(record) };
};

const UpdateProvisionedProductProperties: OperationHandler = (input, ctx) => {
  const ppId = requireString(input, "ProvisionedProductId");
  requireString(input, "IdempotencyToken");
  const pp = requirePP(ctx, ppId);
  const record = createRecord(ctx, ppId, pp.Name, "UPDATE_PROVISIONED_PRODUCT");
  pp.LastRecordId = record.RecordId;
  ctx.store.set(ppKey(ppId), pp);
  return {
    ProvisionedProductId: ppId,
    RecordId: record.RecordId,
    ProvisionedProductProperties: {},
    Status: "SUCCEEDED",
  };
};

const ListStackInstancesForProvisionedProduct: OperationHandler = (
  input,
  ctx,
) => {
  const ppId = requireString(input, "ProvisionedProductId");
  requirePP(ctx, ppId);
  return { StackInstances: [] };
};

const CreateProvisionedProductPlan: OperationHandler = (input, ctx) => {
  const planName = requireString(input, "PlanName");
  const planType = requireString(input, "PlanType");
  const productId = requireString(input, "ProductId");
  const paId = requireString(input, "ProvisioningArtifactId");
  const ppName = requireString(input, "ProvisionedProductName");
  requireString(input, "IdempotencyToken");
  requireProduct(ctx, productId);
  requirePA(ctx, paId);
  const planId = `plan-${randomChars(13)}`;
  const plan: StoredProvisionedProductPlan = {
    PlanId: planId,
    PlanName: planName,
    PlanType: planType,
    ProductId: productId,
    ProvisioningArtifactId: paId,
    ProvisionedProductName: ppName,
    Status: "CREATE_SUCCESS",
    CreatedTime: nowSeconds(),
  };
  ctx.store.set(pplanKey(planId), plan);
  return {
    PlanName: planName,
    PlanId: planId,
    ProvisionProductId: "",
    ProvisionedProductName: ppName,
    ProvisioningArtifactId: paId,
  };
};

const DescribeProvisionedProductPlan: OperationHandler = (input, ctx) => {
  const planId = requireString(input, "PlanId");
  const plan = ctx.store.get<StoredProvisionedProductPlan>(pplanKey(planId));
  if (!plan) {
    throw awsError("ResourceNotFoundException", "Plan not found.", 400);
  }
  return {
    ProvisionedProductPlanDetails: {
      PlanId: plan.PlanId,
      PlanName: plan.PlanName,
      PlanType: plan.PlanType,
      ProductId: plan.ProductId,
      ProvisioningArtifactId: plan.ProvisioningArtifactId,
      ProvisionedProductName: plan.ProvisionedProductName,
      Status: plan.Status,
      CreatedTime: plan.CreatedTime,
    },
    ResourceChanges: [],
  };
};

const ExecuteProvisionedProductPlan: OperationHandler = (input, ctx) => {
  const planId = requireString(input, "PlanId");
  requireString(input, "IdempotencyToken");
  const plan = ctx.store.get<StoredProvisionedProductPlan>(pplanKey(planId));
  if (!plan) {
    throw awsError("ResourceNotFoundException", "Plan not found.", 400);
  }
  const record = createRecord(
    ctx,
    "",
    plan.ProvisionedProductName,
    "PROVISION_PRODUCT",
  );
  return { RecordDetail: recordSummary(record) };
};

const DeleteProvisionedProductPlan: OperationHandler = (input, ctx) => {
  const planId = requireString(input, "PlanId");
  const plan = ctx.store.get<StoredProvisionedProductPlan>(pplanKey(planId));
  if (!plan) {
    throw awsError("ResourceNotFoundException", "Plan not found.", 400);
  }
  ctx.store.delete(pplanKey(planId));
  return {};
};

const ListProvisionedProductPlans: OperationHandler = (_input, ctx) => {
  const plans = ctx.store
    .list<StoredProvisionedProductPlan>()
    .filter((entry) => entry.key.startsWith("pplan/"))
    .map((entry) => ({
      PlanId: entry.value.PlanId,
      PlanName: entry.value.PlanName,
      PlanType: entry.value.PlanType,
      ProvisionProductId: "",
      ProvisionedProductName: entry.value.ProvisionedProductName,
      ProvisioningArtifactId: entry.value.ProvisioningArtifactId,
    }));
  return { ProvisionedProductPlans: plans };
};

const DescribeRecord: OperationHandler = (input, ctx) => {
  const recordId = requireString(input, "Id");
  const record = ctx.store.get<StoredRecord>(recordKey(recordId));
  if (!record) {
    throw awsError("ResourceNotFoundException", "Record not found.", 400);
  }
  return { RecordDetail: recordSummary(record), RecordOutputs: [] };
};

const ListRecordHistory: OperationHandler = (_input, ctx) => {
  const records = ctx.store
    .list<StoredRecord>()
    .filter((entry) => entry.key.startsWith("record/"))
    .map((entry) => recordSummary(entry.value));
  return { RecordDetails: records };
};

const CreateServiceAction: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const definitionType = requireString(input, "DefinitionType");
  requireString(input, "IdempotencyToken");
  const definition = readStringRecord(input, "Definition");
  const id = `act-${randomChars(13)}`;
  const sa: StoredServiceAction = {
    Id: id,
    Name: name,
    Description: optionalString(input, "Description"),
    DefinitionType: definitionType,
    Definition: definition,
  };
  ctx.store.set(saKey(id), sa);
  return {
    ServiceActionDetail: {
      ServiceActionSummary: saSummary(sa),
      Definition: definition,
    },
  };
};

const DescribeServiceAction: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const sa = requireSA(ctx, id);
  return {
    ServiceActionDetail: {
      ServiceActionSummary: saSummary(sa),
      Definition: sa.Definition,
    },
  };
};

const UpdateServiceAction: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const sa = requireSA(ctx, id);
  const name = optionalString(input, "Name");
  if (name !== undefined) sa.Name = name;
  const description = optionalString(input, "Description");
  if (description !== undefined) sa.Description = description;
  const definition = readStringRecord(input, "Definition");
  if (Object.keys(definition).length > 0) sa.Definition = definition;
  ctx.store.set(saKey(id), sa);
  return {
    ServiceActionDetail: {
      ServiceActionSummary: saSummary(sa),
      Definition: sa.Definition,
    },
  };
};

const DeleteServiceAction: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  requireSA(ctx, id);
  ctx.store.delete(saKey(id));
  return {};
};

const ListServiceActions: OperationHandler = (_input, ctx) => {
  const actions = ctx.store
    .list<StoredServiceAction>()
    .filter((entry) => entry.key.startsWith("sa/"))
    .map((entry) => saSummary(entry.value));
  return { ServiceActionSummaries: actions };
};

const ListServiceActionsForProvisioningArtifact: OperationHandler = (
  input,
  ctx,
) => {
  const paId = requireString(input, "ProvisioningArtifactId");
  requirePA(ctx, paId);
  const actions = ctx.store
    .list<boolean>()
    .filter(
      (entry) =>
        entry.key.startsWith("assoc/sa/") && entry.key.endsWith(`/${paId}`),
    )
    .map((entry) => {
      const parts = entry.key.split("/");
      const saId = parts[2] ?? "";
      const sa = ctx.store.get<StoredServiceAction>(saKey(saId));
      return sa ? saSummary(sa) : null;
    })
    .filter((s): s is Record<string, unknown> => s !== null);
  return { ServiceActionSummaries: actions };
};

const DescribeServiceActionExecutionParameters: OperationHandler = (
  input,
  ctx,
) => {
  const saId = requireString(input, "ServiceActionId");
  requireSA(ctx, saId);
  return { ServiceActionParameters: [] };
};

const ExecuteProvisionedProductServiceAction: OperationHandler = (
  input,
  ctx,
) => {
  const ppId = requireString(input, "ProvisionedProductId");
  requireString(input, "ExecuteToken");
  const pp = requirePP(ctx, ppId);
  const record = createRecord(
    ctx,
    ppId,
    pp.Name,
    "EXECUTE_PROVISIONED_PRODUCT_SERVICE_ACTION",
  );
  return { RecordDetail: recordSummary(record) };
};

const AssociateServiceActionWithProvisioningArtifact: OperationHandler = (
  input,
  ctx,
) => {
  const productId = requireString(input, "ProductId");
  const paId = requireString(input, "ProvisioningArtifactId");
  const saId = requireString(input, "ServiceActionId");
  requireProduct(ctx, productId);
  requirePA(ctx, paId);
  requireSA(ctx, saId);
  ctx.store.set(assocSAKey(saId, productId, paId), true);
  return {};
};

const DisassociateServiceActionFromProvisioningArtifact: OperationHandler = (
  input,
  ctx,
) => {
  const productId = requireString(input, "ProductId");
  const paId = requireString(input, "ProvisioningArtifactId");
  const saId = requireString(input, "ServiceActionId");
  ctx.store.delete(assocSAKey(saId, productId, paId));
  return {};
};

const BatchAssociateServiceActionWithProvisioningArtifact: OperationHandler = (
  input,
  ctx,
) => {
  const entries = input["ServiceActionAssociations"];
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (entry !== null && typeof entry === "object") {
        const e = entry as Record<string, unknown>;
        const saId =
          typeof e["ServiceActionId"] === "string" ? e["ServiceActionId"] : "";
        const productId =
          typeof e["ProductId"] === "string" ? e["ProductId"] : "";
        const paId =
          typeof e["ProvisioningArtifactId"] === "string"
            ? e["ProvisioningArtifactId"]
            : "";
        if (saId && productId && paId) {
          ctx.store.set(assocSAKey(saId, productId, paId), true);
        }
      }
    }
  }
  return { FailedServiceActionAssociations: [] };
};

const BatchDisassociateServiceActionFromProvisioningArtifact: OperationHandler =
  (input, ctx) => {
    const entries = input["ServiceActionAssociations"];
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (entry !== null && typeof entry === "object") {
          const e = entry as Record<string, unknown>;
          const saId =
            typeof e["ServiceActionId"] === "string"
              ? e["ServiceActionId"]
              : "";
          const productId =
            typeof e["ProductId"] === "string" ? e["ProductId"] : "";
          const paId =
            typeof e["ProvisioningArtifactId"] === "string"
              ? e["ProvisioningArtifactId"]
              : "";
          if (saId && productId && paId) {
            ctx.store.delete(assocSAKey(saId, productId, paId));
          }
        }
      }
    }
    return { FailedServiceActionAssociations: [] };
  };

const CreateTagOption: OperationHandler = (input, ctx) => {
  const key = requireString(input, "Key");
  const value = requireString(input, "Value");
  const id = `to-${randomChars(13)}`;
  const tagOption: StoredTagOption = {
    Id: id,
    Key: key,
    Value: value,
    Active: true,
  };
  ctx.store.set(toKey(id), tagOption);
  return { TagOptionDetail: toSummary(tagOption) };
};

const DescribeTagOption: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const tagOption = requireTO(ctx, id);
  return { TagOptionDetail: toSummary(tagOption) };
};

const UpdateTagOption: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const tagOption = requireTO(ctx, id);
  const value = optionalString(input, "Value");
  if (value !== undefined) tagOption.Value = value;
  const active = optionalBoolean(input, "Active");
  if (active !== undefined) tagOption.Active = active;
  ctx.store.set(toKey(id), tagOption);
  return { TagOptionDetail: toSummary(tagOption) };
};

const DeleteTagOption: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  requireTO(ctx, id);
  ctx.store.delete(toKey(id));
  return {};
};

const ListTagOptions: OperationHandler = (_input, ctx) => {
  const tagOptions = ctx.store
    .list<StoredTagOption>()
    .filter((entry) => entry.key.startsWith("to/"))
    .map((entry) => toSummary(entry.value));
  return { TagOptionDetails: tagOptions };
};

const AssociateTagOptionWithResource: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const tagOptionId = requireString(input, "TagOptionId");
  requireTO(ctx, tagOptionId);
  ctx.store.set(assocTagOptionKey(resourceId, tagOptionId), true);
  return {};
};

const DisassociateTagOptionFromResource: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const tagOptionId = requireString(input, "TagOptionId");
  ctx.store.delete(assocTagOptionKey(resourceId, tagOptionId));
  return {};
};

const ListResourcesForTagOption: OperationHandler = (input, ctx) => {
  const tagOptionId = requireString(input, "TagOptionId");
  requireTO(ctx, tagOptionId);
  return { ResourceDetails: [] };
};

const AssociateBudgetWithResource: OperationHandler = (input, ctx) => {
  const budgetName = requireString(input, "BudgetName");
  const resourceId = requireString(input, "ResourceId");
  ctx.store.set(assocBudgetKey(resourceId, budgetName), true);
  return {};
};

const DisassociateBudgetFromResource: OperationHandler = (input, ctx) => {
  const budgetName = requireString(input, "BudgetName");
  const resourceId = requireString(input, "ResourceId");
  ctx.store.delete(assocBudgetKey(resourceId, budgetName));
  return {};
};

const ListBudgetsForResource: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const prefix = `assoc/budget/${resourceId}/`;
  const budgets = ctx.store
    .list<boolean>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => {
      const parts = entry.key.split("/");
      const budgetName = parts[3] ?? "";
      return { BudgetName: budgetName };
    });
  return { Budgets: budgets };
};

const ListLaunchPaths: OperationHandler = (input, ctx) => {
  const productId = requireString(input, "ProductId");
  requireProduct(ctx, productId);
  const launchPathSummaries = ctx.store
    .list<boolean>()
    .filter(
      (entry) =>
        entry.key.startsWith("assoc/pp/") &&
        entry.key.endsWith(`/${productId}`),
    )
    .map((entry) => {
      const parts = entry.key.split("/");
      const portfolioId = parts[2] ?? "";
      return {
        Id: portfolioId,
        Name: portfolioId,
        ConstraintSummaries: [],
        Tags: [],
      };
    });
  return { LaunchPathSummaries: launchPathSummaries };
};

const EnableAWSOrganizationsAccess: OperationHandler = (_input, ctx) => {
  ctx.store.set(orgsAccessKey(), true);
  return {};
};

const DisableAWSOrganizationsAccess: OperationHandler = (_input, ctx) => {
  ctx.store.set(orgsAccessKey(), false);
  return {};
};

const GetAWSOrganizationsAccessStatus: OperationHandler = (_input, ctx) => {
  const enabled = ctx.store.get<boolean>(orgsAccessKey()) ?? false;
  return { AccessStatus: enabled ? "ENABLED" : "DISABLED" };
};

const NotifyProvisionProductEngineWorkflowResult: OperationHandler = (
  _input,
  _ctx,
) => ({});

const NotifyTerminateProvisionedProductEngineWorkflowResult: OperationHandler =
  (_input, _ctx) => ({});

const NotifyUpdateProvisionedProductEngineWorkflowResult: OperationHandler = (
  _input,
  _ctx,
) => ({});

const servicecatalog = {
  name: "servicecatalog",
  protocol: "json",
  operations: {
    CreatePortfolio,
    ListPortfolios,
    DescribePortfolio,
    DeletePortfolio,
    UpdatePortfolio,
    CreatePortfolioShare,
    DeletePortfolioShare,
    UpdatePortfolioShare,
    DescribePortfolioShareStatus,
    DescribePortfolioShares,
    AcceptPortfolioShare,
    RejectPortfolioShare,
    ListAcceptedPortfolioShares,
    ListPortfolioAccess,
    ListOrganizationPortfolioAccess,
    AssociatePrincipalWithPortfolio,
    DisassociatePrincipalFromPortfolio,
    ListPrincipalsForPortfolio,
    CreateProduct,
    DescribeProduct,
    DescribeProductAsAdmin,
    DescribeProductView,
    UpdateProduct,
    DeleteProduct,
    SearchProducts,
    SearchProductsAsAdmin,
    CopyProduct,
    DescribeCopyProductStatus,
    AssociateProductWithPortfolio,
    DisassociateProductFromPortfolio,
    ListPortfoliosForProduct,
    CreateProvisioningArtifact,
    DescribeProvisioningArtifact,
    UpdateProvisioningArtifact,
    DeleteProvisioningArtifact,
    ListProvisioningArtifacts,
    DescribeProvisioningParameters,
    ListProvisioningArtifactsForServiceAction,
    CreateConstraint,
    DescribeConstraint,
    UpdateConstraint,
    DeleteConstraint,
    ListConstraintsForPortfolio,
    ProvisionProduct,
    DescribeProvisionedProduct,
    UpdateProvisionedProduct,
    TerminateProvisionedProduct,
    ScanProvisionedProducts,
    SearchProvisionedProducts,
    GetProvisionedProductOutputs,
    ImportAsProvisionedProduct,
    UpdateProvisionedProductProperties,
    ListStackInstancesForProvisionedProduct,
    CreateProvisionedProductPlan,
    DescribeProvisionedProductPlan,
    ExecuteProvisionedProductPlan,
    DeleteProvisionedProductPlan,
    ListProvisionedProductPlans,
    DescribeRecord,
    ListRecordHistory,
    CreateServiceAction,
    DescribeServiceAction,
    UpdateServiceAction,
    DeleteServiceAction,
    ListServiceActions,
    ListServiceActionsForProvisioningArtifact,
    DescribeServiceActionExecutionParameters,
    ExecuteProvisionedProductServiceAction,
    AssociateServiceActionWithProvisioningArtifact,
    DisassociateServiceActionFromProvisioningArtifact,
    BatchAssociateServiceActionWithProvisioningArtifact,
    BatchDisassociateServiceActionFromProvisioningArtifact,
    CreateTagOption,
    DescribeTagOption,
    UpdateTagOption,
    DeleteTagOption,
    ListTagOptions,
    AssociateTagOptionWithResource,
    DisassociateTagOptionFromResource,
    ListResourcesForTagOption,
    AssociateBudgetWithResource,
    DisassociateBudgetFromResource,
    ListBudgetsForResource,
    ListLaunchPaths,
    EnableAWSOrganizationsAccess,
    DisableAWSOrganizationsAccess,
    GetAWSOrganizationsAccessStatus,
    NotifyProvisionProductEngineWorkflowResult,
    NotifyTerminateProvisionedProductEngineWorkflowResult,
    NotifyUpdateProvisionedProductEngineWorkflowResult,
  },
  model,
} as const satisfies ServiceDefinition;

export default servicecatalog;
