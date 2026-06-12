import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/licensemanager.json", { with: { type: "json" } }),
  { targetPrefix: "AWSLicenseManager" },
);

type StoredLicenseConfiguration = {
  LicenseConfigurationId: string;
  LicenseConfigurationArn: string;
  Name: string;
  Description: string;
  LicenseCountingType: string;
  LicenseRules: string[];
  LicenseCount: number | undefined;
  LicenseCountHardLimit: boolean;
  DisassociateWhenNotFound: boolean;
  ConsumedLicenses: number;
  Status: string;
  OwnerAccountId: string;
  ConsumedLicenseSummaryList: unknown[];
  ManagedResourceSummaryList: unknown[];
  ProductInformationList: unknown[];
};

type LicenseVersionRecord = {
  LicenseArn: string;
  LicenseName: string;
  ProductName: string;
  ProductSKU: string;
  Issuer: Record<string, unknown>;
  HomeRegion: string;
  Status: string;
  Validity: Record<string, unknown>;
  Beneficiary: string;
  Entitlements: unknown[];
  ConsumptionConfiguration: Record<string, unknown>;
  LicenseMetadata: unknown[];
  CreateTime: string;
  Version: string;
};

type StoredLicense = {
  id: string;
  currentVersion: string;
  nextVersionNum: number;
  versions: LicenseVersionRecord[];
};

type StoredGrant = {
  GrantArn: string;
  GrantName: string;
  ParentArn: string;
  LicenseArn: string;
  GranteePrincipalArn: string;
  HomeRegion: string;
  GrantStatus: string;
  StatusReason: string | undefined;
  Version: string;
  GrantedOperations: string[];
  Options: Record<string, unknown> | undefined;
};

type StoredToken = {
  TokenId: string;
  TokenType: string;
  LicenseArn: string;
  ExpirationTime: string;
  TokenProperties: string[];
  RoleArns: string[];
  Status: string;
  RawToken: string;
};

type StoredReportGenerator = {
  ReportGeneratorName: string;
  ReportType: string[];
  ReportContext: Record<string, unknown>;
  ReportFrequency: Record<string, unknown>;
  LicenseManagerReportGeneratorArn: string;
  LastRunStatus: string;
  LastRunFailureReason: string;
  LastReportGenerationTime: string;
  ReportCreatorAccount: string;
  Description: string;
  S3Location: Record<string, unknown>;
  CreateTime: string;
};

type StoredLicenseAssetGroup = {
  Name: string;
  Description: string | undefined;
  LicenseAssetGroupConfigurations: unknown[];
  AssociatedLicenseAssetRulesetARNs: string[];
  Properties: unknown[];
  LicenseAssetGroupArn: string;
  Status: string;
  StatusMessage: string | undefined;
  LatestUsageAnalysisTime: string | undefined;
  LatestResourceDiscoveryTime: string | undefined;
};

type StoredLicenseAssetRuleset = {
  Name: string;
  Description: string | undefined;
  Rules: unknown[];
  LicenseAssetRulesetArn: string;
};

type StoredLicenseConversionTask = {
  LicenseConversionTaskId: string;
  ResourceArn: string;
  SourceLicenseContext: Record<string, unknown>;
  DestinationLicenseContext: Record<string, unknown>;
  Status: string;
  StatusMessage: string | undefined;
  StartTime: string;
  LicenseConversionTime: string | undefined;
  EndTime: string | undefined;
};

type StoredServiceSettings = {
  S3BucketArn: string | undefined;
  SnsTopicArn: string | undefined;
  OrganizationConfiguration: Record<string, unknown> | undefined;
  EnableCrossAccountsDiscovery: boolean | undefined;
  LicenseManagerResourceShareArn: string | undefined;
  CrossRegionDiscoveryHomeRegion: string | undefined;
  CrossRegionDiscoverySourceRegions: string[];
};

type StoredConsumptionToken = {
  LicenseConsumptionToken: string;
  LicenseArn: string;
  IssuedAt: string;
  Expiration: string;
  Entitlements: unknown[];
  CheckoutType: string;
};

const configKey = (id: string): string => `licenseconfiguration/${id}`;
const licenseKey = (id: string): string => `license/${id}`;
const grantKey = (id: string): string => `grant/${id}`;
const tokenKey = (id: string): string => `token/${id}`;
const reportGeneratorKey = (id: string): string => `reportgenerator/${id}`;
const assetGroupKey = (id: string): string => `assetgroup/${id}`;
const assetRulesetKey = (id: string): string => `assetruleset/${id}`;
const conversionTaskKey = (id: string): string => `conversiontask/${id}`;
const serviceSettingsKey = (): string => `servicesettings`;
const tagsKey = (arn: string): string => `tags/${arn}`;
const consumptionKey = (token: string): string => `consumption/${token}`;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError(
      "InvalidParameterValueException",
      `${field} is required.`,
      400,
    );
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
  defaultMax = 100,
): { items: T[]; nextToken: string | undefined } => {
  const pageSize =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : defaultMax;
  const startIndex =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(nextToken, 10)
      : 0;
  const page = items.slice(startIndex, startIndex + pageSize);
  const newNextToken =
    startIndex + pageSize < items.length
      ? String(startIndex + pageSize)
      : undefined;
  return { items: page, nextToken: newNextToken };
};

const applyFilters = (
  filters: unknown,
  getFieldValue: (name: string) => string | undefined,
): boolean => {
  if (!Array.isArray(filters) || filters.length === 0) return true;
  return filters.every((f) => {
    if (typeof f !== "object" || f === null) return true;
    const name = (f as Record<string, unknown>)["Name"];
    const values = (f as Record<string, unknown>)["Values"];
    if (typeof name !== "string") return true;
    if (!Array.isArray(values) || values.length === 0) return true;
    const fieldValue = getFieldValue(name);
    return values.some((v) => typeof v === "string" && v === fieldValue);
  });
};

const configArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:license-manager:${ctx.region}:${ctx.account}:license-configuration:${id}`;

const licenseArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:license-manager:${ctx.region}:${ctx.account}:license:${id}`;

const grantArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:license-manager::${ctx.account}:grant:${id}`;

const reportGeneratorArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:license-manager:${ctx.region}:${ctx.account}:report-generator:${id}`;

const assetGroupArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:license-manager:${ctx.region}:${ctx.account}:license-asset-group:${id}`;

const assetRulesetArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:license-manager:${ctx.region}:${ctx.account}:license-asset-ruleset:${id}`;

const arnId = (arn: string): string => {
  const idx = arn.lastIndexOf(":");
  return idx >= 0 ? arn.slice(idx + 1) : arn;
};

const idFromArn = (arn: string): string => {
  const marker = "license-configuration:";
  const index = arn.lastIndexOf(marker);
  return index >= 0 ? arn.slice(index + marker.length) : arn;
};

const nowIso = (): string => new Date().toISOString();

const genId = (): string => crypto.randomUUID().replace(/-/g, "");

const requireConfig = (
  ctx: ServiceContext,
  arn: string,
): StoredLicenseConfiguration => {
  const id = idFromArn(arn);
  const config = ctx.store.get<StoredLicenseConfiguration>(configKey(id));
  if (config === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      `License configuration not found: ${arn}`,
      400,
    );
  }
  return config;
};

const requireLicense = (ctx: ServiceContext, arn: string): StoredLicense => {
  const id = arnId(arn);
  const lic = ctx.store.get<StoredLicense>(licenseKey(id));
  if (lic === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      `License not found: ${arn}`,
      400,
    );
  }
  return lic;
};

const requireGrant = (ctx: ServiceContext, arn: string): StoredGrant => {
  const id = arnId(arn);
  const grant = ctx.store.get<StoredGrant>(grantKey(id));
  if (grant === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      `Grant not found: ${arn}`,
      400,
    );
  }
  return grant;
};

const requireToken = (ctx: ServiceContext, tokenId: string): StoredToken => {
  const token = ctx.store.get<StoredToken>(tokenKey(tokenId));
  if (token === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      `Token not found: ${tokenId}`,
      400,
    );
  }
  return token;
};

const requireReportGenerator = (
  ctx: ServiceContext,
  arn: string,
): StoredReportGenerator => {
  const id = arnId(arn);
  const rg = ctx.store.get<StoredReportGenerator>(reportGeneratorKey(id));
  if (rg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Report generator not found: ${arn}`,
      400,
    );
  }
  return rg;
};

const requireAssetGroup = (
  ctx: ServiceContext,
  arn: string,
): StoredLicenseAssetGroup => {
  const id = arnId(arn);
  const ag = ctx.store.get<StoredLicenseAssetGroup>(assetGroupKey(id));
  if (ag === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      `License asset group not found: ${arn}`,
      400,
    );
  }
  return ag;
};

const requireAssetRuleset = (
  ctx: ServiceContext,
  arn: string,
): StoredLicenseAssetRuleset => {
  const id = arnId(arn);
  const ar = ctx.store.get<StoredLicenseAssetRuleset>(assetRulesetKey(id));
  if (ar === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      `License asset ruleset not found: ${arn}`,
      400,
    );
  }
  return ar;
};

const grantToShape = (grant: StoredGrant) => ({
  GrantArn: grant.GrantArn,
  GrantName: grant.GrantName,
  ParentArn: grant.ParentArn,
  LicenseArn: grant.LicenseArn,
  GranteePrincipalArn: grant.GranteePrincipalArn,
  HomeRegion: grant.HomeRegion,
  GrantStatus: grant.GrantStatus,
  StatusReason: grant.StatusReason,
  Version: grant.Version,
  GrantedOperations: grant.GrantedOperations,
  Options: grant.Options,
});

const CreateLicenseConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const licenseCountingType = requireString(input, "LicenseCountingType");
  const id = `lic-${genId()}`;
  const config: StoredLicenseConfiguration = {
    LicenseConfigurationId: id,
    LicenseConfigurationArn: configArn(ctx, id),
    Name: name,
    Description: stringOrUndefined(input["Description"]) ?? "",
    LicenseCountingType: licenseCountingType,
    LicenseRules: stringList(input["LicenseRules"]),
    LicenseCount:
      typeof input["LicenseCount"] === "number"
        ? input["LicenseCount"]
        : undefined,
    LicenseCountHardLimit:
      typeof input["LicenseCountHardLimit"] === "boolean"
        ? input["LicenseCountHardLimit"]
        : false,
    DisassociateWhenNotFound:
      typeof input["DisassociateWhenNotFound"] === "boolean"
        ? input["DisassociateWhenNotFound"]
        : false,
    ConsumedLicenses: 0,
    Status: "AVAILABLE",
    OwnerAccountId: ctx.account,
    ConsumedLicenseSummaryList: [],
    ManagedResourceSummaryList: [],
    ProductInformationList: [],
  };
  ctx.store.set(configKey(id), config);
  return { LicenseConfigurationArn: config.LicenseConfigurationArn };
};

const GetLicenseConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseConfigurationArn");
  const config = requireConfig(ctx, arn);
  return {
    LicenseConfigurationId: config.LicenseConfigurationId,
    LicenseConfigurationArn: config.LicenseConfigurationArn,
    Name: config.Name,
    Description: config.Description,
    LicenseCountingType: config.LicenseCountingType,
    LicenseRules: config.LicenseRules,
    LicenseCount: config.LicenseCount,
    LicenseCountHardLimit: config.LicenseCountHardLimit,
    ConsumedLicenses: config.ConsumedLicenses,
    Status: config.Status,
    OwnerAccountId: config.OwnerAccountId,
    ConsumedLicenseSummaryList: config.ConsumedLicenseSummaryList,
    ManagedResourceSummaryList: config.ManagedResourceSummaryList,
    ProductInformationList: config.ProductInformationList,
    DisassociateWhenNotFound: config.DisassociateWhenNotFound,
  };
};

const ListLicenseConfigurations: OperationHandler = (input, ctx) => {
  const arns = stringList(input["LicenseConfigurationArns"]);
  const filters = input["Filters"];
  const all = ctx.store
    .list<StoredLicenseConfiguration>()
    .filter((entry) => entry.key.startsWith("licenseconfiguration/"))
    .map((entry) => entry.value)
    .filter(
      (config) =>
        arns.length === 0 || arns.includes(config.LicenseConfigurationArn),
    )
    .filter((config) =>
      applyFilters(filters, (name) => {
        if (name === "licenseCountingType") return config.LicenseCountingType;
        if (name === "enforceLicenseCount")
          return String(config.LicenseCountHardLimit);
        if (name === "usagelimitExceeded")
          return String(
            config.LicenseCount !== undefined &&
              config.ConsumedLicenses >= config.LicenseCount,
          );
        return undefined;
      }),
    );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return {
    LicenseConfigurations: items,
    ...(nextToken !== undefined && { NextToken: nextToken }),
  };
};

const DeleteLicenseConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseConfigurationArn");
  const config = requireConfig(ctx, arn);
  ctx.store.delete(configKey(config.LicenseConfigurationId));
  return {};
};

const UpdateLicenseConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseConfigurationArn");
  const config = requireConfig(ctx, arn);
  const updated: StoredLicenseConfiguration = {
    ...config,
    Status:
      stringOrUndefined(input["LicenseConfigurationStatus"] as unknown) ??
      config.Status,
    LicenseRules: Array.isArray(input["LicenseRules"])
      ? stringList(input["LicenseRules"])
      : config.LicenseRules,
    LicenseCount:
      typeof input["LicenseCount"] === "number"
        ? input["LicenseCount"]
        : config.LicenseCount,
    LicenseCountHardLimit:
      typeof input["LicenseCountHardLimit"] === "boolean"
        ? input["LicenseCountHardLimit"]
        : config.LicenseCountHardLimit,
    Name: stringOrUndefined(input["Name"]) ?? config.Name,
    Description: stringOrUndefined(input["Description"]) ?? config.Description,
    ProductInformationList: Array.isArray(input["ProductInformationList"])
      ? (input["ProductInformationList"] as unknown[])
      : config.ProductInformationList,
    DisassociateWhenNotFound:
      typeof input["DisassociateWhenNotFound"] === "boolean"
        ? input["DisassociateWhenNotFound"]
        : config.DisassociateWhenNotFound,
  };
  ctx.store.set(configKey(config.LicenseConfigurationId), updated);
  return {};
};

const ListAssociationsForLicenseConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  requireString(input, "LicenseConfigurationArn");
  return { LicenseConfigurationAssociations: [] };
};

const ListFailuresForLicenseConfigurationOperations: OperationHandler = (
  input,
  ctx,
) => {
  requireString(input, "LicenseConfigurationArn");
  return { LicenseOperationFailureList: [] };
};

const ListUsageForLicenseConfiguration: OperationHandler = (input, ctx) => {
  requireString(input, "LicenseConfigurationArn");
  return { LicenseConfigurationUsageList: [] };
};

const ListLicenseSpecificationsForResource: OperationHandler = (input, ctx) => {
  requireString(input, "ResourceArn");
  return { LicenseSpecifications: [] };
};

const UpdateLicenseSpecificationsForResource: OperationHandler = (
  input,
  ctx,
) => {
  requireString(input, "ResourceArn");
  return {};
};

const ListLicenseConfigurationsForOrganization: OperationHandler = (
  input,
  ctx,
) => {
  return { LicenseConfigurations: [] };
};

const CreateLicense: OperationHandler = (input, ctx) => {
  const licenseName = requireString(input, "LicenseName");
  const productName = requireString(input, "ProductName");
  const productSKU = requireString(input, "ProductSKU");
  const homeRegion = requireString(input, "HomeRegion");
  const beneficiary = requireString(input, "Beneficiary");
  const id = `license-${genId()}`;
  const arn = licenseArn(ctx, id);
  const ts = nowIso();
  const versionRecord: LicenseVersionRecord = {
    LicenseArn: arn,
    LicenseName: licenseName,
    ProductName: productName,
    ProductSKU: productSKU,
    Issuer: (input["Issuer"] as Record<string, unknown>) ?? {},
    HomeRegion: homeRegion,
    Status: "AVAILABLE",
    Validity: (input["Validity"] as Record<string, unknown>) ?? {},
    Beneficiary: beneficiary,
    Entitlements: Array.isArray(input["Entitlements"])
      ? (input["Entitlements"] as unknown[])
      : [],
    ConsumptionConfiguration:
      (input["ConsumptionConfiguration"] as Record<string, unknown>) ?? {},
    LicenseMetadata: Array.isArray(input["LicenseMetadata"])
      ? (input["LicenseMetadata"] as unknown[])
      : [],
    CreateTime: ts,
    Version: "1",
  };
  const stored: StoredLicense = {
    id,
    currentVersion: "1",
    nextVersionNum: 2,
    versions: [versionRecord],
  };
  ctx.store.set(licenseKey(id), stored);
  return { LicenseArn: arn, Status: "AVAILABLE", Version: "1" };
};

const GetLicense: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseArn");
  const stored = requireLicense(ctx, arn);
  const requestedVersion = stringOrUndefined(input["Version"]);
  const record =
    requestedVersion !== undefined
      ? stored.versions.find((v) => v.Version === requestedVersion)
      : stored.versions.find((v) => v.Version === stored.currentVersion);
  if (record === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      `License version not found: ${arn}`,
      400,
    );
  }
  return { License: record };
};

const CreateLicenseVersion: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseArn");
  const stored = requireLicense(ctx, arn);
  const licenseName = requireString(input, "LicenseName");
  const productName = requireString(input, "ProductName");
  const homeRegion = requireString(input, "HomeRegion");
  const status = requireString(input, "Status");
  const newVersion = String(stored.nextVersionNum);
  const ts = nowIso();
  const versionRecord: LicenseVersionRecord = {
    LicenseArn: arn,
    LicenseName: licenseName,
    ProductName: productName,
    ProductSKU: stored.versions[stored.versions.length - 1]?.ProductSKU ?? "",
    Issuer: (input["Issuer"] as Record<string, unknown>) ?? {},
    HomeRegion: homeRegion,
    Status: status,
    Validity: (input["Validity"] as Record<string, unknown>) ?? {},
    Beneficiary: stored.versions[stored.versions.length - 1]?.Beneficiary ?? "",
    Entitlements: Array.isArray(input["Entitlements"])
      ? (input["Entitlements"] as unknown[])
      : [],
    ConsumptionConfiguration:
      (input["ConsumptionConfiguration"] as Record<string, unknown>) ?? {},
    LicenseMetadata: Array.isArray(input["LicenseMetadata"])
      ? (input["LicenseMetadata"] as unknown[])
      : [],
    CreateTime: ts,
    Version: newVersion,
  };
  const updated: StoredLicense = {
    ...stored,
    currentVersion: newVersion,
    nextVersionNum: stored.nextVersionNum + 1,
    versions: [...stored.versions, versionRecord],
  };
  ctx.store.set(licenseKey(stored.id), updated);
  return { LicenseArn: arn, Version: newVersion, Status: status };
};

const ListLicenses: OperationHandler = (input, ctx) => {
  const arns = stringList(input["LicenseArns"]);
  const filters = input["Filters"];
  const all = ctx.store
    .list<StoredLicense>()
    .filter((entry) => entry.key.startsWith("license/"))
    .map((entry) => entry.value)
    .filter(
      (lic) =>
        arns.length === 0 || arns.includes(lic.versions[0]?.LicenseArn ?? ""),
    )
    .map((lic) => lic.versions.find((v) => v.Version === lic.currentVersion))
    .filter((v): v is LicenseVersionRecord => v !== undefined)
    .filter((v) =>
      applyFilters(filters, (name) => {
        if (name === "Beneficiary") return v.Beneficiary;
        if (name === "ProductSKU") return v.ProductSKU;
        if (name === "Fingerprint")
          return (v.Issuer as Record<string, unknown>)?.["Fingerprint"] as
            | string
            | undefined;
        if (name === "Status") return v.Status;
        return undefined;
      }),
    );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return {
    Licenses: items,
    ...(nextToken !== undefined && { NextToken: nextToken }),
  };
};

const ListLicenseVersions: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseArn");
  const stored = requireLicense(ctx, arn);
  const { items, nextToken } = paginateList(
    stored.versions,
    input["NextToken"],
    input["MaxResults"],
  );
  return {
    Licenses: items,
    ...(nextToken !== undefined && { NextToken: nextToken }),
  };
};

const DeleteLicense: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseArn");
  requireString(input, "SourceVersion");
  const stored = requireLicense(ctx, arn);
  ctx.store.delete(licenseKey(stored.id));
  return { Status: "DELETED", DeletionDate: nowIso() };
};

const GetLicenseUsage: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseArn");
  requireLicense(ctx, arn);
  const tokens = ctx.store
    .list<StoredConsumptionToken>()
    .filter((entry) => entry.key.startsWith("consumption/"))
    .map((entry) => entry.value)
    .filter((t) => t.LicenseArn === arn);
  const entitlementUsages = tokens.flatMap((t) =>
    (t.Entitlements as Array<Record<string, unknown>>).map((e) => ({
      Name: e["Name"],
      ConsumedValue: e["Value"] ?? "1",
      MaxCount: e["MaxCount"] ?? 1,
      Unit: e["Unit"] ?? "Count",
    })),
  );
  return { LicenseUsage: { EntitlementUsages: entitlementUsages } };
};

const ListReceivedLicenses: OperationHandler = (input, ctx) => {
  return { Licenses: [] };
};

const ListReceivedLicensesForOrganization: OperationHandler = (input, ctx) => {
  return { Licenses: [] };
};

const CreateGrant: OperationHandler = (input, ctx) => {
  const grantName = requireString(input, "GrantName");
  const licArnInput = requireString(input, "LicenseArn");
  const homeRegion = requireString(input, "HomeRegion");
  const id = `grant-${genId()}`;
  const arn = grantArn(ctx, id);
  const principals = Array.isArray(input["Principals"])
    ? stringList(input["Principals"])
    : [];
  const operations = stringList(input["AllowedOperations"]);
  const grant: StoredGrant = {
    GrantArn: arn,
    GrantName: grantName,
    ParentArn: arn,
    LicenseArn: licArnInput,
    GranteePrincipalArn: principals[0] ?? ctx.account,
    HomeRegion: homeRegion,
    GrantStatus: "PENDING_WORKFLOW",
    StatusReason: undefined,
    Version: "1",
    GrantedOperations: operations,
    Options: undefined,
  };
  ctx.store.set(grantKey(id), grant);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(tagsKey(arn), input["Tags"]);
  }
  return { GrantArn: arn, Status: "PENDING_WORKFLOW", Version: "1" };
};

const CreateGrantVersion: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GrantArn");
  const grant = requireGrant(ctx, arn);
  const currentVersion = parseInt(grant.Version, 10);
  const newVersion = String(currentVersion + 1);
  const updated: StoredGrant = {
    ...grant,
    GrantName: stringOrUndefined(input["GrantName"]) ?? grant.GrantName,
    GrantedOperations: Array.isArray(input["AllowedOperations"])
      ? stringList(input["AllowedOperations"])
      : grant.GrantedOperations,
    GrantStatus: stringOrUndefined(input["Status"]) ?? grant.GrantStatus,
    StatusReason:
      stringOrUndefined(input["StatusReason"]) ?? grant.StatusReason,
    Options:
      (input["Options"] as Record<string, unknown> | undefined) ??
      grant.Options,
    Version: newVersion,
  };
  ctx.store.set(grantKey(arnId(arn)), updated);
  return { GrantArn: arn, Status: updated.GrantStatus, Version: newVersion };
};

const AcceptGrant: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GrantArn");
  const grant = requireGrant(ctx, arn);
  const updated: StoredGrant = { ...grant, GrantStatus: "ACTIVE" };
  ctx.store.set(grantKey(arnId(arn)), updated);
  return { GrantArn: arn, Status: "ACTIVE", Version: grant.Version };
};

const RejectGrant: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GrantArn");
  const grant = requireGrant(ctx, arn);
  const updated: StoredGrant = { ...grant, GrantStatus: "REJECTED" };
  ctx.store.set(grantKey(arnId(arn)), updated);
  return { GrantArn: arn, Status: "REJECTED", Version: grant.Version };
};

const DeleteGrant: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GrantArn");
  const grant = requireGrant(ctx, arn);
  const updated: StoredGrant = { ...grant, GrantStatus: "DELETED" };
  ctx.store.set(grantKey(arnId(arn)), updated);
  return { GrantArn: arn, Status: "DELETED", Version: grant.Version };
};

const GetGrant: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GrantArn");
  const grant = requireGrant(ctx, arn);
  return { Grant: grantToShape(grant) };
};

const ListDistributedGrants: OperationHandler = (input, ctx) => {
  const arns = stringList(input["GrantArns"]);
  const filters = input["Filters"];
  const all = ctx.store
    .list<StoredGrant>()
    .filter((entry) => entry.key.startsWith("grant/"))
    .map((entry) => entry.value)
    .filter((g) => arns.length === 0 || arns.includes(g.GrantArn))
    .filter((g) =>
      applyFilters(filters, (name) => {
        if (name === "LicenseArn") return g.LicenseArn;
        if (name === "GrantStatus") return g.GrantStatus;
        if (name === "GranteePrincipalARN") return g.GranteePrincipalArn;
        if (name === "ProductSKU" || name === "LicenseIssuerName") {
          const lic = ctx.store.get<StoredLicense>(
            licenseKey(arnId(g.LicenseArn)),
          );
          const current = lic?.versions.find(
            (v) => v.Version === lic?.currentVersion,
          );
          if (name === "ProductSKU") return current?.ProductSKU;
          return (current?.Issuer as Record<string, unknown>)?.["Name"] as
            | string
            | undefined;
        }
        return undefined;
      }),
    );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return {
    Grants: items.map(grantToShape),
    ...(nextToken !== undefined && { NextToken: nextToken }),
  };
};

const ListReceivedGrants: OperationHandler = (input, ctx) => {
  return { Grants: [] };
};

const ListReceivedGrantsForOrganization: OperationHandler = (input, ctx) => {
  return { Grants: [] };
};

const CreateToken: OperationHandler = (input, ctx) => {
  const licArnInput = requireString(input, "LicenseArn");
  requireLicense(ctx, licArnInput);
  const tokenId = genId();
  const rawToken = `eyJhbGciOiJSUzI1NiJ9.${btoa(JSON.stringify({ tokenId, licenseArn: licArnInput }))}.mock-signature`;
  const expirationDays =
    typeof input["ExpirationInDays"] === "number"
      ? input["ExpirationInDays"]
      : 365;
  const expTime = new Date(
    Date.now() + expirationDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const token: StoredToken = {
    TokenId: tokenId,
    TokenType: "REFRESH_TOKEN",
    LicenseArn: licArnInput,
    ExpirationTime: expTime,
    TokenProperties: stringList(input["TokenProperties"]),
    RoleArns: stringList(input["RoleArns"]),
    Status: "AVAILABLE",
    RawToken: rawToken,
  };
  ctx.store.set(tokenKey(tokenId), token);
  return { TokenId: tokenId, TokenType: "REFRESH_TOKEN", Token: rawToken };
};

const GetAccessToken: OperationHandler = (input, ctx) => {
  requireString(input, "Token");
  const accessToken = `access-token-${genId()}`;
  return { AccessToken: accessToken };
};

const DeleteToken: OperationHandler = (input, ctx) => {
  const tokenId = requireString(input, "TokenId");
  requireToken(ctx, tokenId);
  ctx.store.delete(tokenKey(tokenId));
  return {};
};

const ListTokens: OperationHandler = (input, ctx) => {
  const tokenIds = stringList(input["TokenIds"]);
  const tokens = ctx.store
    .list<StoredToken>()
    .filter((entry) => entry.key.startsWith("token/"))
    .map((entry) => entry.value)
    .filter((t) => tokenIds.length === 0 || tokenIds.includes(t.TokenId));
  return {
    Tokens: tokens.map((t) => ({
      TokenId: t.TokenId,
      TokenType: t.TokenType,
      LicenseArn: t.LicenseArn,
      ExpirationTime: t.ExpirationTime,
      TokenProperties: t.TokenProperties,
      RoleArns: t.RoleArns,
      Status: t.Status,
    })),
  };
};

const CheckoutLicense: OperationHandler = (input, ctx) => {
  const productSKU = requireString(input, "ProductSKU");
  requireString(input, "CheckoutType");
  requireString(input, "KeyFingerprint");
  const entitlements = Array.isArray(input["Entitlements"])
    ? (input["Entitlements"] as unknown[])
    : [];
  const lic = ctx.store
    .list<StoredLicense>()
    .filter((entry) => entry.key.startsWith("license/"))
    .map((entry) => entry.value)
    .find((l) => {
      const current = l.versions.find((v) => v.Version === l.currentVersion);
      return current?.ProductSKU === productSKU;
    });
  const licArnValue =
    lic?.versions[0]?.LicenseArn ??
    `arn:aws:license-manager:${ctx.region}:${ctx.account}:license:mock`;
  const consumptionToken = genId();
  const issuedAt = nowIso();
  const expiration = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const consumption: StoredConsumptionToken = {
    LicenseConsumptionToken: consumptionToken,
    LicenseArn: licArnValue,
    IssuedAt: issuedAt,
    Expiration: expiration,
    Entitlements: entitlements,
    CheckoutType: stringOrUndefined(input["CheckoutType"]) ?? "PROVISIONAL",
  };
  ctx.store.set(consumptionKey(consumptionToken), consumption);
  return {
    CheckoutType: consumption.CheckoutType,
    LicenseConsumptionToken: consumptionToken,
    EntitlementsAllowed: entitlements,
    SignedToken: `signed-${consumptionToken}`,
    NodeId: stringOrUndefined(input["NodeId"]),
    IssuedAt: issuedAt,
    Expiration: expiration,
    LicenseArn: licArnValue,
  };
};

const CheckoutBorrowLicense: OperationHandler = (input, ctx) => {
  const licArnInput = requireString(input, "LicenseArn");
  requireLicense(ctx, licArnInput);
  const entitlements = Array.isArray(input["Entitlements"])
    ? (input["Entitlements"] as unknown[])
    : [];
  const consumptionToken = genId();
  const issuedAt = nowIso();
  const expiration = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const consumption: StoredConsumptionToken = {
    LicenseConsumptionToken: consumptionToken,
    LicenseArn: licArnInput,
    IssuedAt: issuedAt,
    Expiration: expiration,
    Entitlements: entitlements,
    CheckoutType: "BORROW",
  };
  ctx.store.set(consumptionKey(consumptionToken), consumption);
  return {
    LicenseArn: licArnInput,
    LicenseConsumptionToken: consumptionToken,
    EntitlementsAllowed: entitlements,
    NodeId: stringOrUndefined(input["NodeId"]),
    SignedToken: `signed-${consumptionToken}`,
    IssuedAt: issuedAt,
    Expiration: expiration,
    CheckoutMetadata: Array.isArray(input["CheckoutMetadata"])
      ? input["CheckoutMetadata"]
      : [],
  };
};

const CheckInLicense: OperationHandler = (input, ctx) => {
  const consumptionToken = requireString(input, "LicenseConsumptionToken");
  const stored = ctx.store.get<StoredConsumptionToken>(
    consumptionKey(consumptionToken),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Consumption token not found: ${consumptionToken}`,
      400,
    );
  }
  ctx.store.delete(consumptionKey(consumptionToken));
  return {};
};

const ExtendLicenseConsumption: OperationHandler = (input, ctx) => {
  const consumptionToken = requireString(input, "LicenseConsumptionToken");
  const stored = ctx.store.get<StoredConsumptionToken>(
    consumptionKey(consumptionToken),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Consumption token not found: ${consumptionToken}`,
      400,
    );
  }
  const newExpiration = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const updated: StoredConsumptionToken = {
    ...stored,
    Expiration: newExpiration,
  };
  ctx.store.set(consumptionKey(consumptionToken), updated);
  return {
    LicenseConsumptionToken: consumptionToken,
    Expiration: newExpiration,
  };
};

const CreateLicenseManagerReportGenerator: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ReportGeneratorName");
  const id = `report-generator-${genId()}`;
  const arn = reportGeneratorArn(ctx, id);
  const ts = nowIso();
  const rg: StoredReportGenerator = {
    ReportGeneratorName: name,
    ReportType: stringList(input["Type"]),
    ReportContext: (input["ReportContext"] as Record<string, unknown>) ?? {},
    ReportFrequency:
      (input["ReportFrequency"] as Record<string, unknown>) ?? {},
    LicenseManagerReportGeneratorArn: arn,
    LastRunStatus: "COMPLETED",
    LastRunFailureReason: "",
    LastReportGenerationTime: ts,
    ReportCreatorAccount: ctx.account,
    Description: stringOrUndefined(input["Description"]) ?? "",
    S3Location: {},
    CreateTime: ts,
  };
  ctx.store.set(reportGeneratorKey(id), rg);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(tagsKey(arn), input["Tags"]);
  }
  return { LicenseManagerReportGeneratorArn: arn };
};

const GetLicenseManagerReportGenerator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseManagerReportGeneratorArn");
  const rg = requireReportGenerator(ctx, arn);
  return {
    ReportGenerator: {
      ReportGeneratorName: rg.ReportGeneratorName,
      ReportType: rg.ReportType,
      ReportContext: rg.ReportContext,
      ReportFrequency: rg.ReportFrequency,
      LicenseManagerReportGeneratorArn: rg.LicenseManagerReportGeneratorArn,
      LastRunStatus: rg.LastRunStatus,
      LastRunFailureReason: rg.LastRunFailureReason,
      LastReportGenerationTime: rg.LastReportGenerationTime,
      ReportCreatorAccount: rg.ReportCreatorAccount,
      Description: rg.Description,
      S3Location: rg.S3Location,
      CreateTime: rg.CreateTime,
      Tags:
        ctx.store.get<unknown[]>(
          tagsKey(rg.LicenseManagerReportGeneratorArn),
        ) ?? [],
    },
  };
};

const DeleteLicenseManagerReportGenerator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseManagerReportGeneratorArn");
  requireReportGenerator(ctx, arn);
  ctx.store.delete(reportGeneratorKey(arnId(arn)));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const UpdateLicenseManagerReportGenerator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseManagerReportGeneratorArn");
  const rg = requireReportGenerator(ctx, arn);
  const updated: StoredReportGenerator = {
    ...rg,
    ReportGeneratorName:
      stringOrUndefined(input["ReportGeneratorName"]) ?? rg.ReportGeneratorName,
    ReportType: Array.isArray(input["Type"])
      ? stringList(input["Type"])
      : rg.ReportType,
    ReportContext:
      (input["ReportContext"] as Record<string, unknown>) ?? rg.ReportContext,
    ReportFrequency:
      (input["ReportFrequency"] as Record<string, unknown>) ??
      rg.ReportFrequency,
    Description: stringOrUndefined(input["Description"]) ?? rg.Description,
  };
  ctx.store.set(reportGeneratorKey(arnId(arn)), updated);
  return {};
};

const ListLicenseManagerReportGenerators: OperationHandler = (input, ctx) => {
  const filters = input["Filters"];
  const all = ctx.store
    .list<StoredReportGenerator>()
    .filter((entry) => entry.key.startsWith("reportgenerator/"))
    .map((entry) => entry.value)
    .filter((rg) =>
      applyFilters(filters, (name) => {
        if (name === "LicenseConfigurationArn") {
          const arns = (rg.ReportContext as Record<string, unknown>)?.[
            "licenseConfigurationArns"
          ];
          return Array.isArray(arns) ? arns[0] : undefined;
        }
        return undefined;
      }),
    )
    .map((rg) => ({
      ReportGeneratorName: rg.ReportGeneratorName,
      ReportType: rg.ReportType,
      ReportContext: rg.ReportContext,
      ReportFrequency: rg.ReportFrequency,
      LicenseManagerReportGeneratorArn: rg.LicenseManagerReportGeneratorArn,
      LastRunStatus: rg.LastRunStatus,
      LastRunFailureReason: rg.LastRunFailureReason,
      LastReportGenerationTime: rg.LastReportGenerationTime,
      ReportCreatorAccount: rg.ReportCreatorAccount,
      Description: rg.Description,
      S3Location: rg.S3Location,
      CreateTime: rg.CreateTime,
      Tags:
        ctx.store.get<unknown[]>(
          tagsKey(rg.LicenseManagerReportGeneratorArn),
        ) ?? [],
    }));
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return {
    ReportGenerators: items,
    ...(nextToken !== undefined && { NextToken: nextToken }),
  };
};

const CreateLicenseAssetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const id = `asset-group-${genId()}`;
  const arn = assetGroupArn(ctx, id);
  const associatedArns = stringList(input["AssociatedLicenseAssetRulesetARNs"]);
  const ag: StoredLicenseAssetGroup = {
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    LicenseAssetGroupConfigurations: Array.isArray(
      input["LicenseAssetGroupConfigurations"],
    )
      ? (input["LicenseAssetGroupConfigurations"] as unknown[])
      : [],
    AssociatedLicenseAssetRulesetARNs: associatedArns,
    Properties: Array.isArray(input["Properties"])
      ? (input["Properties"] as unknown[])
      : [],
    LicenseAssetGroupArn: arn,
    Status: "ACTIVE",
    StatusMessage: undefined,
    LatestUsageAnalysisTime: undefined,
    LatestResourceDiscoveryTime: undefined,
  };
  ctx.store.set(assetGroupKey(id), ag);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(tagsKey(arn), input["Tags"]);
  }
  return { LicenseAssetGroupArn: arn, Status: "ACTIVE" };
};

const GetLicenseAssetGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseAssetGroupArn");
  const ag = requireAssetGroup(ctx, arn);
  return { LicenseAssetGroup: ag };
};

const UpdateLicenseAssetGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseAssetGroupArn");
  const ag = requireAssetGroup(ctx, arn);
  const updated: StoredLicenseAssetGroup = {
    ...ag,
    Name: stringOrUndefined(input["Name"]) ?? ag.Name,
    Description: stringOrUndefined(input["Description"]) ?? ag.Description,
    LicenseAssetGroupConfigurations: Array.isArray(
      input["LicenseAssetGroupConfigurations"],
    )
      ? (input["LicenseAssetGroupConfigurations"] as unknown[])
      : ag.LicenseAssetGroupConfigurations,
    AssociatedLicenseAssetRulesetARNs: Array.isArray(
      input["AssociatedLicenseAssetRulesetARNs"],
    )
      ? stringList(input["AssociatedLicenseAssetRulesetARNs"])
      : ag.AssociatedLicenseAssetRulesetARNs,
    Properties: Array.isArray(input["Properties"])
      ? (input["Properties"] as unknown[])
      : ag.Properties,
    Status: stringOrUndefined(input["Status"]) ?? ag.Status,
  };
  ctx.store.set(assetGroupKey(arnId(arn)), updated);
  return { LicenseAssetGroupArn: arn, Status: updated.Status };
};

const DeleteLicenseAssetGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseAssetGroupArn");
  const ag = requireAssetGroup(ctx, arn);
  ctx.store.delete(assetGroupKey(arnId(arn)));
  ctx.store.delete(tagsKey(arn));
  return { Status: ag.Status };
};

const ListLicenseAssetGroups: OperationHandler = (input, ctx) => {
  const filters = input["Filters"];
  const all = ctx.store
    .list<StoredLicenseAssetGroup>()
    .filter((entry) => entry.key.startsWith("assetgroup/"))
    .map((entry) => entry.value)
    .filter((ag) =>
      applyFilters(filters, (name) => {
        if (name === "LicenseAssetRulesetArn")
          return ag.AssociatedLicenseAssetRulesetARNs[0];
        return undefined;
      }),
    );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return {
    LicenseAssetGroups: items,
    ...(nextToken !== undefined && { NextToken: nextToken }),
  };
};

const ListAssetsForLicenseAssetGroup: OperationHandler = (input, ctx) => {
  requireString(input, "LicenseAssetGroupArn");
  requireString(input, "AssetType");
  return { Assets: [] };
};

const CreateLicenseAssetRuleset: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const id = `asset-ruleset-${genId()}`;
  const arn = assetRulesetArn(ctx, id);
  const ar: StoredLicenseAssetRuleset = {
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    Rules: Array.isArray(input["Rules"]) ? (input["Rules"] as unknown[]) : [],
    LicenseAssetRulesetArn: arn,
  };
  ctx.store.set(assetRulesetKey(id), ar);
  if (Array.isArray(input["Tags"])) {
    ctx.store.set(tagsKey(arn), input["Tags"]);
  }
  return { LicenseAssetRulesetArn: arn };
};

const GetLicenseAssetRuleset: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseAssetRulesetArn");
  const ar = requireAssetRuleset(ctx, arn);
  return { LicenseAssetRuleset: ar };
};

const UpdateLicenseAssetRuleset: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseAssetRulesetArn");
  const ar = requireAssetRuleset(ctx, arn);
  const updated: StoredLicenseAssetRuleset = {
    ...ar,
    Name: stringOrUndefined(input["Name"]) ?? ar.Name,
    Description: stringOrUndefined(input["Description"]) ?? ar.Description,
    Rules: Array.isArray(input["Rules"])
      ? (input["Rules"] as unknown[])
      : ar.Rules,
  };
  ctx.store.set(assetRulesetKey(arnId(arn)), updated);
  return { LicenseAssetRulesetArn: arn };
};

const DeleteLicenseAssetRuleset: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseAssetRulesetArn");
  requireAssetRuleset(ctx, arn);
  ctx.store.delete(assetRulesetKey(arnId(arn)));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const ListLicenseAssetRulesets: OperationHandler = (input, ctx) => {
  const filters = input["Filters"];
  const all = ctx.store
    .list<StoredLicenseAssetRuleset>()
    .filter((entry) => entry.key.startsWith("assetruleset/"))
    .map((entry) => entry.value)
    .filter((ar) =>
      applyFilters(filters, (name) => {
        if (name === "Name") return ar.Name;
        return undefined;
      }),
    );
  const { items, nextToken } = paginateList(
    all,
    input["NextToken"],
    input["MaxResults"],
  );
  return {
    LicenseAssetRulesets: items,
    ...(nextToken !== undefined && { NextToken: nextToken }),
  };
};

const CreateLicenseConversionTaskForResource: OperationHandler = (
  input,
  ctx,
) => {
  const resourceArnInput = requireString(input, "ResourceArn");
  const taskId = `lct-${genId()}`;
  const ts = nowIso();
  const task: StoredLicenseConversionTask = {
    LicenseConversionTaskId: taskId,
    ResourceArn: resourceArnInput,
    SourceLicenseContext:
      (input["SourceLicenseContext"] as Record<string, unknown>) ?? {},
    DestinationLicenseContext:
      (input["DestinationLicenseContext"] as Record<string, unknown>) ?? {},
    Status: "IN_PROGRESS",
    StatusMessage: undefined,
    StartTime: ts,
    LicenseConversionTime: undefined,
    EndTime: undefined,
  };
  ctx.store.set(conversionTaskKey(taskId), task);
  return { LicenseConversionTaskId: taskId };
};

const GetLicenseConversionTask: OperationHandler = (input, ctx) => {
  const taskId = requireString(input, "LicenseConversionTaskId");
  const task = ctx.store.get<StoredLicenseConversionTask>(
    conversionTaskKey(taskId),
  );
  if (task === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      `License conversion task not found: ${taskId}`,
      400,
    );
  }
  return {
    LicenseConversionTaskId: task.LicenseConversionTaskId,
    ResourceArn: task.ResourceArn,
    SourceLicenseContext: task.SourceLicenseContext,
    DestinationLicenseContext: task.DestinationLicenseContext,
    StatusMessage: task.StatusMessage,
    Status: task.Status,
    StartTime: task.StartTime,
    LicenseConversionTime: task.LicenseConversionTime,
    EndTime: task.EndTime,
  };
};

const ListLicenseConversionTasks: OperationHandler = (input, ctx) => {
  const tasks = ctx.store
    .list<StoredLicenseConversionTask>()
    .filter((entry) => entry.key.startsWith("conversiontask/"))
    .map((entry) => entry.value);
  return { LicenseConversionTasks: tasks };
};

const GetServiceSettings: OperationHandler = (input, ctx) => {
  const settings = ctx.store.get<StoredServiceSettings>(serviceSettingsKey());
  if (settings === undefined) {
    return {
      S3BucketArn: undefined,
      SnsTopicArn: undefined,
      OrganizationConfiguration: undefined,
      EnableCrossAccountsDiscovery: false,
      LicenseManagerResourceShareArn: undefined,
      CrossRegionDiscoveryHomeRegion: undefined,
      CrossRegionDiscoverySourceRegions: [],
    };
  }
  return {
    S3BucketArn: settings.S3BucketArn,
    SnsTopicArn: settings.SnsTopicArn,
    OrganizationConfiguration: settings.OrganizationConfiguration,
    EnableCrossAccountsDiscovery: settings.EnableCrossAccountsDiscovery,
    LicenseManagerResourceShareArn: settings.LicenseManagerResourceShareArn,
    CrossRegionDiscoveryHomeRegion: settings.CrossRegionDiscoveryHomeRegion,
    CrossRegionDiscoverySourceRegions:
      settings.CrossRegionDiscoverySourceRegions,
  };
};

const UpdateServiceSettings: OperationHandler = (input, ctx) => {
  const existing = ctx.store.get<StoredServiceSettings>(serviceSettingsKey());
  const updated: StoredServiceSettings = {
    S3BucketArn:
      stringOrUndefined(input["S3BucketArn"]) ?? existing?.S3BucketArn,
    SnsTopicArn:
      stringOrUndefined(input["SnsTopicArn"]) ?? existing?.SnsTopicArn,
    OrganizationConfiguration:
      (input["OrganizationConfiguration"] as
        | Record<string, unknown>
        | undefined) ?? existing?.OrganizationConfiguration,
    EnableCrossAccountsDiscovery:
      typeof input["EnableCrossAccountsDiscovery"] === "boolean"
        ? input["EnableCrossAccountsDiscovery"]
        : existing?.EnableCrossAccountsDiscovery,
    LicenseManagerResourceShareArn: existing?.LicenseManagerResourceShareArn,
    CrossRegionDiscoveryHomeRegion: existing?.CrossRegionDiscoveryHomeRegion,
    CrossRegionDiscoverySourceRegions: Array.isArray(
      input["EnabledDiscoverySourceRegions"],
    )
      ? stringList(input["EnabledDiscoverySourceRegions"])
      : (existing?.CrossRegionDiscoverySourceRegions ?? []),
  };
  ctx.store.set(serviceSettingsKey(), updated);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArnInput = requireString(input, "ResourceArn");
  const tags = ctx.store.get<unknown[]>(tagsKey(resourceArnInput)) ?? [];
  return { Tags: tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArnInput = requireString(input, "ResourceArn");
  const newTags = Array.isArray(input["Tags"])
    ? (input["Tags"] as Array<Record<string, unknown>>)
    : [];
  const existing =
    ctx.store.get<Array<Record<string, unknown>>>(tagsKey(resourceArnInput)) ??
    [];
  const merged = [...existing];
  for (const tag of newTags) {
    const idx = merged.findIndex((t) => t["Key"] === tag["Key"]);
    if (idx >= 0) {
      merged[idx] = tag;
    } else {
      merged.push(tag);
    }
  }
  ctx.store.set(tagsKey(resourceArnInput), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArnInput = requireString(input, "ResourceArn");
  const keysToRemove = stringList(input["TagKeys"]);
  const existing =
    ctx.store.get<Array<Record<string, unknown>>>(tagsKey(resourceArnInput)) ??
    [];
  const filtered = existing.filter(
    (t) => !keysToRemove.includes(String(t["Key"])),
  );
  ctx.store.set(tagsKey(resourceArnInput), filtered);
  return {};
};

const ListResourceInventory: OperationHandler = (input, ctx) => {
  return { ResourceInventoryList: [] };
};

const licensemanager = {
  name: "license-manager",
  protocol: "json",
  operations: {
    AcceptGrant,
    CheckInLicense,
    CheckoutBorrowLicense,
    CheckoutLicense,
    CreateGrant,
    CreateGrantVersion,
    CreateLicense,
    CreateLicenseAssetGroup,
    CreateLicenseAssetRuleset,
    CreateLicenseConfiguration,
    CreateLicenseConversionTaskForResource,
    CreateLicenseManagerReportGenerator,
    CreateLicenseVersion,
    CreateToken,
    DeleteGrant,
    DeleteLicense,
    DeleteLicenseAssetGroup,
    DeleteLicenseAssetRuleset,
    DeleteLicenseConfiguration,
    DeleteLicenseManagerReportGenerator,
    DeleteToken,
    ExtendLicenseConsumption,
    GetAccessToken,
    GetGrant,
    GetLicense,
    GetLicenseAssetGroup,
    GetLicenseAssetRuleset,
    GetLicenseConfiguration,
    GetLicenseConversionTask,
    GetLicenseManagerReportGenerator,
    GetLicenseUsage,
    GetServiceSettings,
    ListAssetsForLicenseAssetGroup,
    ListAssociationsForLicenseConfiguration,
    ListDistributedGrants,
    ListFailuresForLicenseConfigurationOperations,
    ListLicenseAssetGroups,
    ListLicenseAssetRulesets,
    ListLicenseConfigurations,
    ListLicenseConfigurationsForOrganization,
    ListLicenseConversionTasks,
    ListLicenseManagerReportGenerators,
    ListLicenseSpecificationsForResource,
    ListLicenseVersions,
    ListLicenses,
    ListReceivedGrants,
    ListReceivedGrantsForOrganization,
    ListReceivedLicenses,
    ListReceivedLicensesForOrganization,
    ListResourceInventory,
    ListTagsForResource,
    ListTokens,
    ListUsageForLicenseConfiguration,
    RejectGrant,
    TagResource,
    UntagResource,
    UpdateLicenseAssetGroup,
    UpdateLicenseAssetRuleset,
    UpdateLicenseConfiguration,
    UpdateLicenseManagerReportGenerator,
    UpdateLicenseSpecificationsForResource,
    UpdateServiceSettings,
  },
  model,
} as const satisfies ServiceDefinition;

export default licensemanager;
