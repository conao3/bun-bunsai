import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import licensemanagerModel from "../../../../test/vendor/aws-models/licensemanager.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(licensemanagerModel);

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

const configKey = (id: string): string => `licenseconfiguration/${id}`;

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

const configArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:license-manager:${ctx.region}:${ctx.account}:license-configuration:${id}`;

const idFromArn = (arn: string): string => {
  const marker = "license-configuration:";
  const index = arn.lastIndexOf(marker);
  return index >= 0 ? arn.slice(index + marker.length) : arn;
};

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

const CreateLicenseConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const licenseCountingType = requireString(input, "LicenseCountingType");
  const id = `lic-${crypto.randomUUID().replace(/-/g, "")}`;
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
  const configs = ctx.store
    .list<StoredLicenseConfiguration>()
    .filter((entry) => entry.key.startsWith("licenseconfiguration/"))
    .map((entry) => entry.value)
    .filter(
      (config) =>
        arns.length === 0 || arns.includes(config.LicenseConfigurationArn),
    );
  return { LicenseConfigurations: configs };
};

const DeleteLicenseConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "LicenseConfigurationArn");
  const config = requireConfig(ctx, arn);
  ctx.store.delete(configKey(config.LicenseConfigurationId));
  return {};
};

const licensemanager = {
  name: "license-manager",
  protocol: "json",
  operations: {
    CreateLicenseConfiguration,
    GetLicenseConfiguration,
    ListLicenseConfigurations,
    DeleteLicenseConfiguration,
  },
  model,
} as const satisfies ServiceDefinition;

export default licensemanager;
