import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CancelCapacityTaskCommand,
  CancelOrderCommand,
  CreateOrderCommand,
  CreateOutpostCommand,
  CreateRenewalCommand,
  CreateSiteCommand,
  DeleteOutpostCommand,
  DeleteSiteCommand,
  GetCapacityTaskCommand,
  GetCatalogItemCommand,
  GetConnectionCommand,
  GetOrderCommand,
  GetOutpostBillingInformationCommand,
  GetOutpostCommand,
  GetOutpostInstanceTypesCommand,
  GetOutpostSupportedInstanceTypesCommand,
  GetRenewalPricingCommand,
  GetSiteAddressCommand,
  GetSiteCommand,
  ListAssetInstancesCommand,
  ListAssetsCommand,
  ListBlockingInstancesForCapacityTaskCommand,
  ListCapacityTasksCommand,
  ListCatalogItemsCommand,
  ListOrdersCommand,
  ListOutpostsCommand,
  ListSitesCommand,
  ListTagsForResourceCommand,
  OutpostsClient,
  StartCapacityTaskCommand,
  StartConnectionCommand,
  StartOutpostDecommissionCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateOutpostCommand,
  UpdateSiteAddressCommand,
  UpdateSiteCommand,
  UpdateSiteRackPhysicalPropertiesCommand,
} from "@aws-sdk/client-outposts";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const outposts = () => new OutpostsClient({ endpoint, region, credentials });

test("Outposts outpost roundtrip", async () => {
  const client = outposts();
  const name = `bunsai_e2e_${Date.now()}`;
  const siteId = "os-1234567890abcdef0";

  const created = await client.send(
    new CreateOutpostCommand({ Name: name, SiteId: siteId }),
  );
  const id = created.Outpost?.OutpostId;
  expect(typeof id).toBe("string");
  expect(created.Outpost?.Name).toBe(name);
  expect(created.Outpost?.SiteId).toBe(siteId);
  expect(created.Outpost?.OutpostArn).toContain(`outpost/${id}`);

  const got = await client.send(
    new GetOutpostCommand({ OutpostId: id as string }),
  );
  expect(got.Outpost?.OutpostId).toBe(id);
  expect(got.Outpost?.Name).toBe(name);
  expect(got.Outpost?.LifeCycleStatus).toBe("ACTIVE");

  const listed = await client.send(new ListOutpostsCommand({}));
  expect((listed.Outposts ?? []).map((o) => o.OutpostId)).toContain(id);

  await client.send(new DeleteOutpostCommand({ OutpostId: id as string }));
  await expect(
    client.send(new GetOutpostCommand({ OutpostId: id as string })),
  ).rejects.toThrow();
});

test("Outposts UpdateOutpost", async () => {
  const client = outposts();
  const created = await client.send(
    new CreateOutpostCommand({
      Name: `upd_${Date.now()}`,
      SiteId: "os-aaaa",
    }),
  );
  const id = created.Outpost?.OutpostId as string;

  const updated = await client.send(
    new UpdateOutpostCommand({ OutpostId: id, Name: "updated-name" }),
  );
  expect(updated.Outpost?.Name).toBe("updated-name");

  await client.send(new DeleteOutpostCommand({ OutpostId: id }));
});

test("Outposts site roundtrip", async () => {
  const client = outposts();
  const name = `site_${Date.now()}`;

  const created = await client.send(new CreateSiteCommand({ Name: name }));
  const id = created.Site?.SiteId;
  expect(typeof id).toBe("string");
  expect(created.Site?.Name).toBe(name);
  expect(created.Site?.SiteArn).toContain(`site/${id}`);

  const got = await client.send(new GetSiteCommand({ SiteId: id as string }));
  expect(got.Site?.SiteId).toBe(id);

  const listed = await client.send(new ListSitesCommand({}));
  expect((listed.Sites ?? []).map((s) => s.SiteId)).toContain(id);

  const upd = await client.send(
    new UpdateSiteCommand({ SiteId: id as string, Name: "renamed-site" }),
  );
  expect(upd.Site?.Name).toBe("renamed-site");

  await client.send(new DeleteSiteCommand({ SiteId: id as string }));
  await expect(
    client.send(new GetSiteCommand({ SiteId: id as string })),
  ).rejects.toThrow();
});

test("Outposts site address", async () => {
  const client = outposts();
  const created = await client.send(
    new CreateSiteCommand({ Name: `addr_${Date.now()}` }),
  );
  const id = created.Site?.SiteId as string;

  await client.send(
    new UpdateSiteAddressCommand({
      SiteId: id,
      AddressType: "OPERATING_ADDRESS",
      Address: {
        ContactName: "Test User",
        ContactPhoneNumber: "+1-555-0100",
        AddressLine1: "1 Main St",
        City: "Seattle",
        StateOrRegion: "WA",
        PostalCode: "98101",
        CountryCode: "US",
      },
    }),
  );

  const addr = await client.send(
    new GetSiteAddressCommand({
      SiteId: id,
      AddressType: "OPERATING_ADDRESS",
    }),
  );
  expect(addr.Address?.City).toBe("Seattle");
  expect(addr.AddressType).toBe("OPERATING_ADDRESS");

  await client.send(new DeleteSiteCommand({ SiteId: id }));
});

test("Outposts UpdateSiteRackPhysicalProperties", async () => {
  const client = outposts();
  const created = await client.send(
    new CreateSiteCommand({ Name: `rack_${Date.now()}` }),
  );
  const id = created.Site?.SiteId as string;

  const upd = await client.send(
    new UpdateSiteRackPhysicalPropertiesCommand({
      SiteId: id,
      PowerDrawKva: "POWER_5_KVA",
      UplinkGbps: "UPLINK_1G",
    }),
  );
  expect(upd.Site?.SiteId).toBe(id);

  await client.send(new DeleteSiteCommand({ SiteId: id }));
});

test("Outposts order roundtrip", async () => {
  const client = outposts();
  const outpost = await client.send(
    new CreateOutpostCommand({
      Name: `ord_${Date.now()}`,
      SiteId: "os-order-test",
    }),
  );
  const outpostId = outpost.Outpost?.OutpostId as string;

  const created = await client.send(
    new CreateOrderCommand({
      OutpostIdentifier: outpostId,
      PaymentOption: "NO_UPFRONT",
      LineItems: [{ CatalogItemId: "OR-PRD-GFQKQT6SFSP", Quantity: 1 }],
    }),
  );
  const orderId = created.Order?.OrderId;
  expect(typeof orderId).toBe("string");
  expect(created.Order?.Status).toBe("RECEIVED");

  const got = await client.send(
    new GetOrderCommand({ OrderId: orderId as string }),
  );
  expect(got.Order?.OrderId).toBe(orderId);

  const listed = await client.send(new ListOrdersCommand({}));
  expect((listed.Orders ?? []).map((o) => o.OrderId)).toContain(orderId);

  await client.send(new CancelOrderCommand({ OrderId: orderId as string }));
  const cancelled = await client.send(
    new GetOrderCommand({ OrderId: orderId as string }),
  );
  expect(cancelled.Order?.Status).toBe("CANCELLED");

  await client.send(new DeleteOutpostCommand({ OutpostId: outpostId }));
});

test("Outposts CreateRenewal", async () => {
  const client = outposts();
  const outpost = await client.send(
    new CreateOutpostCommand({
      Name: `ren_${Date.now()}`,
      SiteId: "os-renewal-test",
    }),
  );
  const outpostId = outpost.Outpost?.OutpostId as string;

  const renewal = await client.send(
    new CreateRenewalCommand({
      OutpostIdentifier: outpostId,
      PaymentOption: "NO_UPFRONT",
      PaymentTerm: "ONE_YEAR",
    }),
  );
  expect(renewal.PaymentOption).toBe("NO_UPFRONT");
  expect(renewal.OutpostId).toBe(outpostId);

  await client.send(new DeleteOutpostCommand({ OutpostId: outpostId }));
});

test("Outposts capacity task roundtrip", async () => {
  const client = outposts();
  const outpost = await client.send(
    new CreateOutpostCommand({
      Name: `cap_${Date.now()}`,
      SiteId: "os-cap-test",
    }),
  );
  const outpostId = outpost.Outpost?.OutpostId as string;

  const started = await client.send(
    new StartCapacityTaskCommand({
      OutpostIdentifier: outpostId,
      InstancePools: [{ InstanceType: "m5.xlarge", Count: 1 }],
    }),
  );
  const taskId = started.CapacityTaskId;
  expect(typeof taskId).toBe("string");
  expect(started.CapacityTaskStatus).toBe("REQUESTED");

  const got = await client.send(
    new GetCapacityTaskCommand({
      OutpostIdentifier: outpostId,
      CapacityTaskId: taskId as string,
    }),
  );
  expect(got.CapacityTaskId).toBe(taskId);

  const listed = await client.send(new ListCapacityTasksCommand({}));
  expect((listed.CapacityTasks ?? []).map((t) => t.CapacityTaskId)).toContain(
    taskId,
  );

  const blocking = await client.send(
    new ListBlockingInstancesForCapacityTaskCommand({
      OutpostIdentifier: outpostId,
      CapacityTaskId: taskId as string,
    }),
  );
  expect(blocking.BlockingInstances).toBeDefined();

  await client.send(
    new CancelCapacityTaskCommand({
      OutpostIdentifier: outpostId,
      CapacityTaskId: taskId as string,
    }),
  );
  const cancelled = await client.send(
    new GetCapacityTaskCommand({
      OutpostIdentifier: outpostId,
      CapacityTaskId: taskId as string,
    }),
  );
  expect(cancelled.CapacityTaskStatus).toBe("CANCELLATION_IN_PROGRESS");

  await client.send(new DeleteOutpostCommand({ OutpostId: outpostId }));
});

test("Outposts catalog operations", async () => {
  const client = outposts();

  const listed = await client.send(new ListCatalogItemsCommand({}));
  expect((listed.CatalogItems ?? []).length).toBeGreaterThan(0);
  const itemId = listed.CatalogItems?.[0]?.CatalogItemId as string;

  const got = await client.send(
    new GetCatalogItemCommand({ CatalogItemId: itemId }),
  );
  expect(got.CatalogItem?.CatalogItemId).toBe(itemId);
});

test("Outposts instance types", async () => {
  const client = outposts();
  const outpost = await client.send(
    new CreateOutpostCommand({
      Name: `itype_${Date.now()}`,
      SiteId: "os-itype-test",
    }),
  );
  const outpostId = outpost.Outpost?.OutpostId as string;

  const types = await client.send(
    new GetOutpostInstanceTypesCommand({ OutpostId: outpostId }),
  );
  expect((types.InstanceTypes ?? []).length).toBeGreaterThan(0);

  const supported = await client.send(
    new GetOutpostSupportedInstanceTypesCommand({
      OutpostIdentifier: outpostId,
    }),
  );
  expect((supported.InstanceTypes ?? []).length).toBeGreaterThan(0);

  await client.send(new DeleteOutpostCommand({ OutpostId: outpostId }));
});

test("Outposts billing and renewal pricing", async () => {
  const client = outposts();
  const outpost = await client.send(
    new CreateOutpostCommand({
      Name: `bill_${Date.now()}`,
      SiteId: "os-bill-test",
    }),
  );
  const outpostId = outpost.Outpost?.OutpostId as string;

  const billing = await client.send(
    new GetOutpostBillingInformationCommand({ OutpostIdentifier: outpostId }),
  );
  expect(billing.Subscriptions).toBeDefined();

  const pricing = await client.send(
    new GetRenewalPricingCommand({ OutpostIdentifier: outpostId }),
  );
  expect(pricing.PricingResult).toBe("PRICED");

  await client.send(new DeleteOutpostCommand({ OutpostId: outpostId }));
});

test("Outposts asset operations", async () => {
  const client = outposts();
  const outpost = await client.send(
    new CreateOutpostCommand({
      Name: `asset_${Date.now()}`,
      SiteId: "os-asset-test",
    }),
  );
  const outpostId = outpost.Outpost?.OutpostId as string;

  const assets = await client.send(
    new ListAssetsCommand({ OutpostIdentifier: outpostId }),
  );
  expect(assets.Assets).toBeDefined();

  const instances = await client.send(
    new ListAssetInstancesCommand({ OutpostIdentifier: outpostId }),
  );
  expect(instances.AssetInstances).toBeDefined();

  await client.send(new DeleteOutpostCommand({ OutpostId: outpostId }));
});

test("Outposts StartConnection and GetConnection", async () => {
  const client = outposts();

  const conn = await client.send(
    new StartConnectionCommand({
      AssetId: "asset-123",
      ClientPublicKey: "dGVzdC1wdWJsaWMta2V5LXBsYWNlaG9sZGVy",
      NetworkInterfaceDeviceIndex: 0,
      DeviceSerialNumber: "SN-12345",
    }),
  );
  expect(typeof conn.ConnectionId).toBe("string");
  expect(typeof conn.UnderlayIpAddress).toBe("string");

  const got = await client.send(
    new GetConnectionCommand({ ConnectionId: conn.ConnectionId as string }),
  );
  expect(got.ConnectionId).toBe(conn.ConnectionId);
  expect(got.ConnectionDetails).toBeDefined();
});

test("Outposts StartOutpostDecommission", async () => {
  const client = outposts();
  const outpost = await client.send(
    new CreateOutpostCommand({
      Name: `decom_${Date.now()}`,
      SiteId: "os-decom-test",
    }),
  );
  const outpostId = outpost.Outpost?.OutpostId as string;

  const result = await client.send(
    new StartOutpostDecommissionCommand({ OutpostIdentifier: outpostId }),
  );
  expect(result.Status).toBe("REQUESTED");

  await client.send(new DeleteOutpostCommand({ OutpostId: outpostId }));
});

test("Outposts tag operations", async () => {
  const client = outposts();
  const outpost = await client.send(
    new CreateOutpostCommand({
      Name: `tag_${Date.now()}`,
      SiteId: "os-tag-test",
    }),
  );
  const arn = outpost.Outpost?.OutpostArn as string;

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      Tags: { env: "test", team: "ops" },
    }),
  );

  const tagged = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(tagged.Tags?.["env"]).toBe("test");
  expect(tagged.Tags?.["team"]).toBe("ops");

  await client.send(
    new UntagResourceCommand({ ResourceArn: arn, TagKeys: ["team"] }),
  );

  const untagged = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(untagged.Tags?.["env"]).toBe("test");
  expect(untagged.Tags?.["team"]).toBeUndefined();

  await client.send(
    new DeleteOutpostCommand({
      OutpostId: outpost.Outpost?.OutpostId as string,
    }),
  );
});
