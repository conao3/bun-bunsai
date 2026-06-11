import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDedicatedIpPoolCommand,
  CreateEmailIdentityCommand,
  CreateMultiRegionEndpointCommand,
  CreateTenantCommand,
  CreateTenantResourceAssociationCommand,
  DeleteDedicatedIpPoolCommand,
  DeleteMultiRegionEndpointCommand,
  DeleteTenantCommand,
  GetAccountCommand,
  GetDedicatedIpPoolCommand,
  GetDeliverabilityDashboardOptionsCommand,
  GetDomainStatisticsReportCommand,
  GetMultiRegionEndpointCommand,
  GetTenantCommand,
  ListDedicatedIpPoolsCommand,
  ListMultiRegionEndpointsCommand,
  ListRecommendationsCommand,
  ListReputationEntitiesCommand,
  ListTenantResourcesCommand,
  ListTenantsCommand,
  PutAccountDedicatedIpWarmupAttributesCommand,
  PutAccountSendingAttributesCommand,
  PutConfigurationSetVdmOptionsCommand,
  PutDeliverabilityDashboardOptionCommand,
  PutDedicatedIpInPoolCommand,
  PutEmailIdentityDkimAttributesCommand,
  PutEmailIdentityFeedbackAttributesCommand,
  PutEmailIdentityMailFromAttributesCommand,
  PutTenantSuppressionAttributesCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import { CreateConfigurationSetCommand } from "@aws-sdk/client-sesv2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sesv2 = () =>
  new SESv2Client({ endpoint, requestHandler, region, credentials });

test("dedicated IP pool lifecycle", async () => {
  const c = sesv2();

  await c.send(
    new CreateDedicatedIpPoolCommand({
      PoolName: "mypool",
      ScalingMode: "STANDARD",
    }),
  );

  const got = await c.send(
    new GetDedicatedIpPoolCommand({ PoolName: "mypool" }),
  );
  expect(got.DedicatedIpPool?.PoolName).toBe("mypool");
  expect(got.DedicatedIpPool?.ScalingMode).toBe("STANDARD");

  const list = await c.send(new ListDedicatedIpPoolsCommand({}));
  expect(list.DedicatedIpPools?.includes("mypool")).toBe(true);

  await c.send(
    new PutDedicatedIpInPoolCommand({
      Ip: "1.2.3.4",
      DestinationPoolName: "mypool",
    }),
  );

  await c.send(new DeleteDedicatedIpPoolCommand({ PoolName: "mypool" }));
  const list2 = await c.send(new ListDedicatedIpPoolsCommand({}));
  expect(list2.DedicatedIpPools?.includes("mypool")).toBe(false);
});

test("account attributes", async () => {
  const c = sesv2();

  const acc = await c.send(new GetAccountCommand({}));
  expect(acc.SendingEnabled).toBe(true);
  expect(acc.EnforcementStatus).toBe("HEALTHY");

  await c.send(
    new PutAccountSendingAttributesCommand({ SendingEnabled: false }),
  );
  const acc2 = await c.send(new GetAccountCommand({}));
  expect(acc2.SendingEnabled).toBe(false);

  await c.send(
    new PutAccountDedicatedIpWarmupAttributesCommand({
      AutoWarmupEnabled: true,
    }),
  );
  const acc3 = await c.send(new GetAccountCommand({}));
  expect(acc3.DedicatedIpAutoWarmupEnabled).toBe(true);
});

test("email identity attributes", async () => {
  const c = sesv2();

  await c.send(
    new CreateEmailIdentityCommand({ EmailIdentity: "test@example.com" }),
  );
  await c.send(
    new PutEmailIdentityFeedbackAttributesCommand({
      EmailIdentity: "test@example.com",
      EmailForwardingEnabled: false,
    }),
  );
  await c.send(
    new PutEmailIdentityDkimAttributesCommand({
      EmailIdentity: "test@example.com",
      SigningEnabled: true,
    }),
  );
  await c.send(
    new PutEmailIdentityMailFromAttributesCommand({
      EmailIdentity: "test@example.com",
      MailFromDomain: "bounce.example.com",
    }),
  );
});

test("configuration set vdm options", async () => {
  const c = sesv2();
  await c.send(
    new CreateConfigurationSetCommand({ ConfigurationSetName: "myset" }),
  );
  await c.send(
    new PutConfigurationSetVdmOptionsCommand({
      ConfigurationSetName: "myset",
      VdmOptions: {
        DashboardOptions: { EngagementMetrics: "ENABLED" },
        GuardianOptions: { OptimizedSharedDelivery: "ENABLED" },
      },
    }),
  );
});

test("tenant lifecycle", async () => {
  const c = sesv2();

  const created = await c.send(
    new CreateTenantCommand({ TenantName: "mytenant" }),
  );
  expect(created.TenantName).toBe("mytenant");
  expect(created.TenantId).toBeTruthy();

  const got = await c.send(new GetTenantCommand({ TenantName: "mytenant" }));
  expect(got.Tenant?.TenantName).toBe("mytenant");

  const list = await c.send(new ListTenantsCommand({}));
  expect(list.Tenants?.some((t) => t.TenantName === "mytenant")).toBe(true);

  await c.send(
    new CreateTenantResourceAssociationCommand({
      TenantName: "mytenant",
      ResourceArn: "arn:aws:ses:us-east-1:123:identity/example.com",
    }),
  );
  const resources = await c.send(
    new ListTenantResourcesCommand({ TenantName: "mytenant" }),
  );
  expect(resources.TenantResources?.length).toBe(1);

  await c.send(
    new PutTenantSuppressionAttributesCommand({
      TenantName: "mytenant",
      SuppressedReasons: ["BOUNCE"],
    }),
  );

  await c.send(new DeleteTenantCommand({ TenantName: "mytenant" }));
  const list2 = await c.send(new ListTenantsCommand({}));
  expect(list2.Tenants?.some((t) => t.TenantName === "mytenant")).toBe(false);
});

test("multi-region endpoint lifecycle", async () => {
  const c = sesv2();

  const created = await c.send(
    new CreateMultiRegionEndpointCommand({
      EndpointName: "myendpoint",
      Details: {
        RoutesDetails: [{ Region: "us-east-2" }],
      },
    }),
  );
  expect(created.Status).toBe("READY");
  expect(created.EndpointId).toBeTruthy();

  const got = await c.send(
    new GetMultiRegionEndpointCommand({ EndpointName: "myendpoint" }),
  );
  expect(got.EndpointName).toBe("myendpoint");
  expect(got.Status).toBe("READY");

  const list = await c.send(new ListMultiRegionEndpointsCommand({}));
  expect(
    list.MultiRegionEndpoints?.some((e) => e.EndpointName === "myendpoint"),
  ).toBe(true);

  await c.send(
    new DeleteMultiRegionEndpointCommand({ EndpointName: "myendpoint" }),
  );
  const list2 = await c.send(new ListMultiRegionEndpointsCommand({}));
  expect(
    list2.MultiRegionEndpoints?.some((e) => e.EndpointName === "myendpoint"),
  ).toBe(false);
});

test("deliverability dashboard", async () => {
  const c = sesv2();

  const opts = await c.send(new GetDeliverabilityDashboardOptionsCommand({}));
  expect(opts.DashboardEnabled).toBe(false);

  await c.send(
    new PutDeliverabilityDashboardOptionCommand({ DashboardEnabled: true }),
  );
  const opts2 = await c.send(new GetDeliverabilityDashboardOptionsCommand({}));
  expect(opts2.DashboardEnabled).toBe(true);

  const stats = await c.send(
    new GetDomainStatisticsReportCommand({
      Domain: "example.com",
      StartDate: new Date("2024-01-01"),
      EndDate: new Date("2024-01-31"),
    }),
  );
  expect(stats.DailyVolumes).toBeDefined();

  const recs = await c.send(new ListRecommendationsCommand({}));
  expect(recs.Recommendations).toBeDefined();

  const entities = await c.send(new ListReputationEntitiesCommand({}));
  expect(entities.ReputationEntities).toBeDefined();
});
