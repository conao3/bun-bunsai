import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AcceptGrantCommand,
  CheckInLicenseCommand,
  CheckoutBorrowLicenseCommand,
  CheckoutLicenseCommand,
  CreateGrantCommand,
  CreateGrantVersionCommand,
  CreateLicenseAssetGroupCommand,
  CreateLicenseAssetRulesetCommand,
  CreateLicenseCommand,
  CreateLicenseConfigurationCommand,
  CreateLicenseConversionTaskForResourceCommand,
  CreateLicenseManagerReportGeneratorCommand,
  CreateLicenseVersionCommand,
  CreateTokenCommand,
  DeleteGrantCommand,
  DeleteLicenseAssetGroupCommand,
  DeleteLicenseAssetRulesetCommand,
  DeleteLicenseCommand,
  DeleteLicenseConfigurationCommand,
  DeleteLicenseManagerReportGeneratorCommand,
  DeleteTokenCommand,
  ExtendLicenseConsumptionCommand,
  GetAccessTokenCommand,
  GetGrantCommand,
  GetLicenseAssetGroupCommand,
  GetLicenseAssetRulesetCommand,
  GetLicenseCommand,
  GetLicenseConfigurationCommand,
  GetLicenseConversionTaskCommand,
  GetLicenseManagerReportGeneratorCommand,
  GetLicenseUsageCommand,
  GetServiceSettingsCommand,
  LicenseManagerClient,
  ListAssetsForLicenseAssetGroupCommand,
  ListAssociationsForLicenseConfigurationCommand,
  ListDistributedGrantsCommand,
  ListFailuresForLicenseConfigurationOperationsCommand,
  ListLicenseAssetGroupsCommand,
  ListLicenseAssetRulesetsCommand,
  ListLicenseConfigurationsCommand,
  ListLicenseConfigurationsForOrganizationCommand,
  ListLicenseConversionTasksCommand,
  ListLicenseManagerReportGeneratorsCommand,
  ListLicenseSpecificationsForResourceCommand,
  ListLicenseVersionsCommand,
  ListLicensesCommand,
  ListReceivedGrantsCommand,
  ListReceivedGrantsForOrganizationCommand,
  ListReceivedLicensesCommand,
  ListReceivedLicensesForOrganizationCommand,
  ListResourceInventoryCommand,
  ListTagsForResourceCommand,
  ListTokensCommand,
  ListUsageForLicenseConfigurationCommand,
  RejectGrantCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateLicenseAssetGroupCommand,
  UpdateLicenseAssetRulesetCommand,
  UpdateLicenseConfigurationCommand,
  UpdateLicenseManagerReportGeneratorCommand,
  UpdateLicenseSpecificationsForResourceCommand,
  UpdateServiceSettingsCommand,
} from "@aws-sdk/client-license-manager";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const licensemanager = () =>
  new LicenseManagerClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("LicenseManager license configuration lifecycle", async () => {
  const client = licensemanager();
  const name = "bunsai-e2e-license-config";

  const created = await client.send(
    new CreateLicenseConfigurationCommand({
      Name: name,
      LicenseCountingType: "vCPU",
      Description: "bunsai e2e",
      LicenseCount: 10,
      LicenseCountHardLimit: true,
    }),
  );
  const arn = created.LicenseConfigurationArn;
  expect(typeof arn).toBe("string");
  expect(arn).toContain("license-configuration:");

  const got = await client.send(
    new GetLicenseConfigurationCommand({
      LicenseConfigurationArn: arn,
    }),
  );
  expect(got.Name).toBe(name);
  expect(got.LicenseCountingType).toBe("vCPU");
  expect(got.LicenseCount).toBe(10);
  expect(got.LicenseCountHardLimit).toBe(true);
  expect(got.LicenseConfigurationArn).toBe(arn);

  const listed = await client.send(new ListLicenseConfigurationsCommand({}));
  expect(
    (listed.LicenseConfigurations ?? []).some(
      (config) => config.LicenseConfigurationArn === arn,
    ),
  ).toBe(true);

  await client.send(
    new UpdateLicenseConfigurationCommand({
      LicenseConfigurationArn: arn!,
      Name: "bunsai-e2e-license-config-updated",
      LicenseCount: 20,
    }),
  );

  const updated = await client.send(
    new GetLicenseConfigurationCommand({
      LicenseConfigurationArn: arn,
    }),
  );
  expect(updated.Name).toBe("bunsai-e2e-license-config-updated");
  expect(updated.LicenseCount).toBe(20);

  await client.send(
    new ListAssociationsForLicenseConfigurationCommand({
      LicenseConfigurationArn: arn!,
    }),
  );

  await client.send(
    new ListFailuresForLicenseConfigurationOperationsCommand({
      LicenseConfigurationArn: arn!,
    }),
  );

  await client.send(
    new ListUsageForLicenseConfigurationCommand({
      LicenseConfigurationArn: arn!,
    }),
  );

  await client.send(new ListLicenseConfigurationsForOrganizationCommand({}));

  await client.send(
    new UpdateLicenseSpecificationsForResourceCommand({
      ResourceArn: "arn:aws:ec2:us-east-1:123456789012:instance/i-12345",
    }),
  );

  await client.send(
    new ListLicenseSpecificationsForResourceCommand({
      ResourceArn: "arn:aws:ec2:us-east-1:123456789012:instance/i-12345",
    }),
  );

  await client.send(
    new DeleteLicenseConfigurationCommand({
      LicenseConfigurationArn: arn,
    }),
  );

  const afterDelete = await client.send(
    new ListLicenseConfigurationsCommand({}),
  );
  expect(
    (afterDelete.LicenseConfigurations ?? []).some(
      (config) => config.LicenseConfigurationArn === arn,
    ),
  ).toBe(false);
});

test("LicenseManager license lifecycle", async () => {
  const client = licensemanager();

  const created = await client.send(
    new CreateLicenseCommand({
      LicenseName: "bunsai-e2e-license",
      ProductName: "BunsaiProduct",
      ProductSKU: "BUNSAI-SKU-001",
      Issuer: { Name: "BunsaiIssuer" },
      HomeRegion: region,
      Validity: {
        Begin: "2024-01-01T00:00:00Z",
        End: "2025-12-31T23:59:59Z",
      },
      Entitlements: [{ Name: "vCPU", Unit: "Count", MaxCount: 8 }],
      Beneficiary: "arn:aws:iam::123456789012:root",
      ConsumptionConfiguration: {
        RenewType: "Monthly",
        ProvisionalConfiguration: { MaxTimeToLiveInMinutes: 60 },
      },
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );
  const licArn = created.LicenseArn;
  expect(typeof licArn).toBe("string");
  expect(created.Status).toBe("AVAILABLE");
  expect(created.Version).toBe("1");

  const got = await client.send(new GetLicenseCommand({ LicenseArn: licArn }));
  expect(got.License?.LicenseName).toBe("bunsai-e2e-license");
  expect(got.License?.ProductSKU).toBe("BUNSAI-SKU-001");
  expect(got.License?.Version).toBe("1");

  const v2 = await client.send(
    new CreateLicenseVersionCommand({
      LicenseArn: licArn!,
      LicenseName: "bunsai-e2e-license-v2",
      ProductName: "BunsaiProduct",
      Issuer: { Name: "BunsaiIssuer" },
      HomeRegion: region,
      Validity: {
        Begin: "2024-01-01T00:00:00Z",
        End: "2026-12-31T23:59:59Z",
      },
      Entitlements: [{ Name: "vCPU", Unit: "Count", MaxCount: 16 }],
      ConsumptionConfiguration: {
        RenewType: "Monthly",
        ProvisionalConfiguration: { MaxTimeToLiveInMinutes: 60 },
      },
      Status: "AVAILABLE",
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );
  expect(v2.Version).toBe("2");

  const versions = await client.send(
    new ListLicenseVersionsCommand({ LicenseArn: licArn! }),
  );
  expect((versions.Licenses ?? []).length).toBeGreaterThanOrEqual(2);

  const licenses = await client.send(new ListLicensesCommand({}));
  expect((licenses.Licenses ?? []).some((l) => l.LicenseArn === licArn)).toBe(
    true,
  );

  await client.send(new GetLicenseUsageCommand({ LicenseArn: licArn! }));

  const receivedLicenses = await client.send(
    new ListReceivedLicensesCommand({}),
  );
  expect(Array.isArray(receivedLicenses.Licenses)).toBe(true);

  const receivedForOrg = await client.send(
    new ListReceivedLicensesForOrganizationCommand({}),
  );
  expect(Array.isArray(receivedForOrg.Licenses)).toBe(true);

  await client.send(
    new DeleteLicenseCommand({
      LicenseArn: licArn!,
      SourceVersion: "1",
    }),
  );
});

test("LicenseManager grant lifecycle", async () => {
  const client = licensemanager();

  const licCreated = await client.send(
    new CreateLicenseCommand({
      LicenseName: "grant-test-license",
      ProductName: "GrantProduct",
      ProductSKU: "GRANT-SKU-001",
      Issuer: { Name: "GrantIssuer" },
      HomeRegion: region,
      Validity: {
        Begin: "2024-01-01T00:00:00Z",
        End: "2025-12-31T23:59:59Z",
      },
      Entitlements: [{ Name: "vCPU", Unit: "Count", MaxCount: 4 }],
      Beneficiary: "arn:aws:iam::123456789012:root",
      ConsumptionConfiguration: { RenewType: "None" },
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );
  const licArn = licCreated.LicenseArn!;

  const grantCreated = await client.send(
    new CreateGrantCommand({
      ClientToken: `tok-${crypto.randomUUID()}`,
      GrantName: "bunsai-e2e-grant",
      LicenseArn: licArn,
      Principals: ["arn:aws:iam::123456789012:root"],
      HomeRegion: region,
      AllowedOperations: ["CheckoutLicense", "CheckInLicense"],
    }),
  );
  const grantArn = grantCreated.GrantArn!;
  expect(typeof grantArn).toBe("string");
  expect(grantCreated.Status).toBe("PENDING_WORKFLOW");

  const gotGrant = await client.send(
    new GetGrantCommand({ GrantArn: grantArn }),
  );
  expect(gotGrant.Grant?.GrantName).toBe("bunsai-e2e-grant");
  expect(gotGrant.Grant?.GrantStatus).toBe("PENDING_WORKFLOW");

  const accepted = await client.send(
    new AcceptGrantCommand({ GrantArn: grantArn }),
  );
  expect(accepted.Status).toBe("ACTIVE");

  const grantV2 = await client.send(
    new CreateGrantVersionCommand({
      ClientToken: `tok-${crypto.randomUUID()}`,
      GrantArn: grantArn,
      GrantName: "bunsai-e2e-grant-v2",
      Status: "ACTIVE",
    }),
  );
  expect(grantV2.Version).toBe("2");

  const distributed = await client.send(new ListDistributedGrantsCommand({}));
  expect((distributed.Grants ?? []).some((g) => g.GrantArn === grantArn)).toBe(
    true,
  );

  const receivedGrants = await client.send(new ListReceivedGrantsCommand({}));
  expect(Array.isArray(receivedGrants.Grants)).toBe(true);

  const receivedForOrg = await client.send(
    new ListReceivedGrantsForOrganizationCommand({ LicenseArn: licArn }),
  );
  expect(Array.isArray(receivedForOrg.Grants)).toBe(true);

  const rejected = await client.send(
    new RejectGrantCommand({ GrantArn: grantArn }),
  );
  expect(rejected.Status).toBe("REJECTED");

  const deleted = await client.send(
    new DeleteGrantCommand({
      GrantArn: grantArn,
      Version: grantV2.Version!,
    }),
  );
  expect(deleted.Status).toBe("DELETED");
});

test("LicenseManager token lifecycle", async () => {
  const client = licensemanager();

  const licCreated = await client.send(
    new CreateLicenseCommand({
      LicenseName: "token-test-license",
      ProductName: "TokenProduct",
      ProductSKU: "TOKEN-SKU-001",
      Issuer: { Name: "TokenIssuer" },
      HomeRegion: region,
      Validity: {
        Begin: "2024-01-01T00:00:00Z",
        End: "2025-12-31T23:59:59Z",
      },
      Entitlements: [{ Name: "vCPU", Unit: "Count", MaxCount: 4 }],
      Beneficiary: "arn:aws:iam::123456789012:root",
      ConsumptionConfiguration: { RenewType: "None" },
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );
  const licArn = licCreated.LicenseArn!;

  const tokenCreated = await client.send(
    new CreateTokenCommand({
      LicenseArn: licArn,
      ClientToken: `tok-${crypto.randomUUID()}`,
      ExpirationInDays: 30,
    }),
  );
  const tokenId = tokenCreated.TokenId!;
  expect(typeof tokenId).toBe("string");
  expect(tokenCreated.TokenType).toBe("REFRESH_TOKEN");
  expect(typeof tokenCreated.Token).toBe("string");

  const accessToken = await client.send(
    new GetAccessTokenCommand({
      Token: tokenCreated.Token!,
    }),
  );
  expect(typeof accessToken.AccessToken).toBe("string");

  const tokens = await client.send(
    new ListTokensCommand({ TokenIds: [tokenId] }),
  );
  expect((tokens.Tokens ?? []).some((t) => t.TokenId === tokenId)).toBe(true);

  await client.send(new DeleteTokenCommand({ TokenId: tokenId }));

  const afterDelete = await client.send(
    new ListTokensCommand({ TokenIds: [tokenId] }),
  );
  expect((afterDelete.Tokens ?? []).some((t) => t.TokenId === tokenId)).toBe(
    false,
  );
});

test("LicenseManager checkout and checkin", async () => {
  const client = licensemanager();

  const licCreated = await client.send(
    new CreateLicenseCommand({
      LicenseName: "checkout-test-license",
      ProductName: "CheckoutProduct",
      ProductSKU: "CHECKOUT-SKU-001",
      Issuer: { Name: "CheckoutIssuer" },
      HomeRegion: region,
      Validity: {
        Begin: "2024-01-01T00:00:00Z",
        End: "2025-12-31T23:59:59Z",
      },
      Entitlements: [{ Name: "vCPU", Unit: "Count", MaxCount: 4 }],
      Beneficiary: "arn:aws:iam::123456789012:root",
      ConsumptionConfiguration: {
        RenewType: "None",
        BorrowConfiguration: {
          AllowEarlyCheckIn: true,
          MaxTimeToLiveInMinutes: 60,
        },
      },
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );
  const licArn = licCreated.LicenseArn!;

  const checkout = await client.send(
    new CheckoutLicenseCommand({
      ProductSKU: "CHECKOUT-SKU-001",
      CheckoutType: "PROVISIONAL",
      KeyFingerprint: "sha256:mock-fingerprint",
      Entitlements: [{ Name: "vCPU", Unit: "Count", Value: "2" }],
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );
  const consumptionToken = checkout.LicenseConsumptionToken!;
  expect(typeof consumptionToken).toBe("string");

  const extended = await client.send(
    new ExtendLicenseConsumptionCommand({
      LicenseConsumptionToken: consumptionToken,
    }),
  );
  expect(extended.LicenseConsumptionToken).toBe(consumptionToken);
  expect(typeof extended.Expiration).toBe("string");

  await client.send(
    new CheckInLicenseCommand({
      LicenseConsumptionToken: consumptionToken,
    }),
  );

  const borrowCheckout = await client.send(
    new CheckoutBorrowLicenseCommand({
      LicenseArn: licArn,
      Entitlements: [{ Name: "vCPU", Unit: "Count", Value: "1" }],
      DigitalSignatureMethod: "JWT_PS384",
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );
  const borrowToken = borrowCheckout.LicenseConsumptionToken!;
  expect(typeof borrowToken).toBe("string");

  await client.send(
    new CheckInLicenseCommand({
      LicenseConsumptionToken: borrowToken,
    }),
  );
});

test("LicenseManager service settings", async () => {
  const client = licensemanager();

  const initial = await client.send(new GetServiceSettingsCommand({}));
  expect(initial.EnableCrossAccountsDiscovery).toBe(false);

  await client.send(
    new UpdateServiceSettingsCommand({
      S3BucketArn: "arn:aws:s3:::bunsai-license-reports",
      EnableCrossAccountsDiscovery: true,
    }),
  );

  const updated = await client.send(new GetServiceSettingsCommand({}));
  expect(updated.S3BucketArn).toBe("arn:aws:s3:::bunsai-license-reports");
  expect(updated.EnableCrossAccountsDiscovery).toBe(true);
});

test("LicenseManager tags", async () => {
  const client = licensemanager();

  const licCreated = await client.send(
    new CreateLicenseCommand({
      LicenseName: "tag-test-license",
      ProductName: "TagProduct",
      ProductSKU: "TAG-SKU-001",
      Issuer: { Name: "TagIssuer" },
      HomeRegion: region,
      Validity: {
        Begin: "2024-01-01T00:00:00Z",
        End: "2025-12-31T23:59:59Z",
      },
      Entitlements: [{ Name: "vCPU", Unit: "Count", MaxCount: 2 }],
      Beneficiary: "arn:aws:iam::123456789012:root",
      ConsumptionConfiguration: { RenewType: "None" },
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );
  const licArn = licCreated.LicenseArn!;

  await client.send(
    new TagResourceCommand({
      ResourceArn: licArn,
      Tags: [
        { Key: "Environment", Value: "test" },
        { Key: "Project", Value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: licArn }),
  );
  expect(
    (listed.Tags ?? []).some(
      (t) => t.Key === "Environment" && t.Value === "test",
    ),
  ).toBe(true);

  await client.send(
    new UntagResourceCommand({
      ResourceArn: licArn,
      TagKeys: ["Environment"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: licArn }),
  );
  expect((afterUntag.Tags ?? []).some((t) => t.Key === "Environment")).toBe(
    false,
  );
  expect((afterUntag.Tags ?? []).some((t) => t.Key === "Project")).toBe(true);
});

test("LicenseManager report generator lifecycle", async () => {
  const client = licensemanager();

  const created = await client.send(
    new CreateLicenseManagerReportGeneratorCommand({
      ReportGeneratorName: "bunsai-e2e-report-generator",
      Type: ["LicenseConfigurationSummaryReport"],
      ReportContext: {
        licenseConfigurationArns: [
          "arn:aws:license-manager:us-east-1:123456789012:license-configuration:lic-mock",
        ],
      },
      ReportFrequency: { value: 1, period: "DAY" },
      ClientToken: `tok-${crypto.randomUUID()}`,
      Description: "bunsai e2e report generator",
    }),
  );
  const rgArn = created.LicenseManagerReportGeneratorArn!;
  expect(typeof rgArn).toBe("string");

  const got = await client.send(
    new GetLicenseManagerReportGeneratorCommand({
      LicenseManagerReportGeneratorArn: rgArn,
    }),
  );
  expect(got.ReportGenerator?.ReportGeneratorName).toBe(
    "bunsai-e2e-report-generator",
  );

  await client.send(
    new UpdateLicenseManagerReportGeneratorCommand({
      LicenseManagerReportGeneratorArn: rgArn,
      ReportGeneratorName: "bunsai-e2e-report-generator-updated",
      Type: ["LicenseConfigurationSummaryReport"],
      ReportContext: {
        licenseConfigurationArns: [
          "arn:aws:license-manager:us-east-1:123456789012:license-configuration:lic-mock",
        ],
      },
      ReportFrequency: { value: 7, period: "DAY" },
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );

  const listed = await client.send(
    new ListLicenseManagerReportGeneratorsCommand({}),
  );
  expect(
    (listed.ReportGenerators ?? []).some(
      (rg) => rg.LicenseManagerReportGeneratorArn === rgArn,
    ),
  ).toBe(true);

  await client.send(
    new DeleteLicenseManagerReportGeneratorCommand({
      LicenseManagerReportGeneratorArn: rgArn,
    }),
  );

  const afterDelete = await client.send(
    new ListLicenseManagerReportGeneratorsCommand({}),
  );
  expect(
    (afterDelete.ReportGenerators ?? []).some(
      (rg) => rg.LicenseManagerReportGeneratorArn === rgArn,
    ),
  ).toBe(false);
});

test("LicenseManager asset ruleset lifecycle", async () => {
  const client = licensemanager();

  const created = await client.send(
    new CreateLicenseAssetRulesetCommand({
      Name: "bunsai-e2e-ruleset",
      Rules: [{ Name: "rule1", Value: "value1", Unit: "None" }],
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );
  const rulesetArn = created.LicenseAssetRulesetArn!;
  expect(typeof rulesetArn).toBe("string");

  const got = await client.send(
    new GetLicenseAssetRulesetCommand({
      LicenseAssetRulesetArn: rulesetArn,
    }),
  );
  expect(got.LicenseAssetRuleset?.Name).toBe("bunsai-e2e-ruleset");

  await client.send(
    new UpdateLicenseAssetRulesetCommand({
      LicenseAssetRulesetArn: rulesetArn,
      Rules: [{ Name: "rule1", Value: "updated", Unit: "None" }],
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );

  const listed = await client.send(new ListLicenseAssetRulesetsCommand({}));
  expect(
    (listed.LicenseAssetRulesets ?? []).some(
      (r) => r.LicenseAssetRulesetArn === rulesetArn,
    ),
  ).toBe(true);

  await client.send(
    new DeleteLicenseAssetRulesetCommand({
      LicenseAssetRulesetArn: rulesetArn,
    }),
  );

  const afterDelete = await client.send(
    new ListLicenseAssetRulesetsCommand({}),
  );
  expect(
    (afterDelete.LicenseAssetRulesets ?? []).some(
      (r) => r.LicenseAssetRulesetArn === rulesetArn,
    ),
  ).toBe(false);
});

test("LicenseManager asset group lifecycle", async () => {
  const client = licensemanager();

  const rulesetCreated = await client.send(
    new CreateLicenseAssetRulesetCommand({
      Name: "bunsai-e2e-group-ruleset",
      Rules: [{ Name: "rule1", Value: "value1", Unit: "None" }],
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );
  const rulesetArn = rulesetCreated.LicenseAssetRulesetArn!;

  const created = await client.send(
    new CreateLicenseAssetGroupCommand({
      Name: "bunsai-e2e-asset-group",
      LicenseAssetGroupConfigurations: [],
      AssociatedLicenseAssetRulesetARNs: [rulesetArn],
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );
  const groupArn = created.LicenseAssetGroupArn!;
  expect(typeof groupArn).toBe("string");
  expect(created.Status).toBe("ACTIVE");

  const got = await client.send(
    new GetLicenseAssetGroupCommand({
      LicenseAssetGroupArn: groupArn,
    }),
  );
  expect(got.LicenseAssetGroup?.Name).toBe("bunsai-e2e-asset-group");

  await client.send(
    new UpdateLicenseAssetGroupCommand({
      LicenseAssetGroupArn: groupArn,
      AssociatedLicenseAssetRulesetARNs: [rulesetArn],
      ClientToken: `tok-${crypto.randomUUID()}`,
    }),
  );

  const listed = await client.send(new ListLicenseAssetGroupsCommand({}));
  expect(
    (listed.LicenseAssetGroups ?? []).some(
      (g) => g.LicenseAssetGroupArn === groupArn,
    ),
  ).toBe(true);

  await client.send(
    new ListAssetsForLicenseAssetGroupCommand({
      LicenseAssetGroupArn: groupArn,
      AssetType: "EC2_INSTANCE",
    }),
  );

  const deleted = await client.send(
    new DeleteLicenseAssetGroupCommand({
      LicenseAssetGroupArn: groupArn,
    }),
  );
  expect(typeof deleted.Status).toBe("string");

  const afterDelete = await client.send(new ListLicenseAssetGroupsCommand({}));
  expect(
    (afterDelete.LicenseAssetGroups ?? []).some(
      (g) => g.LicenseAssetGroupArn === groupArn,
    ),
  ).toBe(false);
});

test("LicenseManager license conversion task", async () => {
  const client = licensemanager();

  const created = await client.send(
    new CreateLicenseConversionTaskForResourceCommand({
      ResourceArn: "arn:aws:ec2:us-east-1:123456789012:instance/i-12345abc",
      SourceLicenseContext: { usageOperation: "RunInstances:0010" },
      DestinationLicenseContext: { usageOperation: "RunInstances:0014" },
    }),
  );
  const taskId = created.LicenseConversionTaskId!;
  expect(typeof taskId).toBe("string");

  const got = await client.send(
    new GetLicenseConversionTaskCommand({
      LicenseConversionTaskId: taskId,
    }),
  );
  expect(got.LicenseConversionTaskId).toBe(taskId);
  expect(got.Status).toBe("IN_PROGRESS");

  const listed = await client.send(new ListLicenseConversionTasksCommand({}));
  expect(
    (listed.LicenseConversionTasks ?? []).some(
      (t) => t.LicenseConversionTaskId === taskId,
    ),
  ).toBe(true);
});

test("LicenseManager misc list operations", async () => {
  const client = licensemanager();

  const inventory = await client.send(new ListResourceInventoryCommand({}));
  expect(Array.isArray(inventory.ResourceInventoryList)).toBe(true);
});
