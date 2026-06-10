import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateHostedZoneCommand,
  CreateReusableDelegationSetCommand,
  DeleteHostedZoneCommand,
  DeleteReusableDelegationSetCommand,
  HostedZoneType,
  ListHostedZonesCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const route53 = () =>
  new Route53Client({ endpoint, region, credentials, requestHandler });

test("CreateHostedZone validates DelegationSetId", async () => {
  const client = route53();

  await expect(
    client.send(
      new CreateHostedZoneCommand({
        Name: "invalid-ds.example.com",
        CallerReference: `ref-invalid-ds-${Date.now()}`,
        DelegationSetId: "/delegationset/ZNONEXISTENT000",
      }),
    ),
  ).rejects.toThrow();
});

test("CreateHostedZone with valid DelegationSetId associates the delegation set", async () => {
  const client = route53();
  const dsRef = `ds-ref-${Date.now()}`;

  const ds = await client.send(
    new CreateReusableDelegationSetCommand({ CallerReference: dsRef }),
  );
  const dsId = ds.DelegationSet?.Id;
  expect(dsId).toBeDefined();

  const zone = await client.send(
    new CreateHostedZoneCommand({
      Name: "with-ds.example.com",
      CallerReference: `zone-ref-${Date.now()}`,
      DelegationSetId: dsId,
    }),
  );
  const zoneId = zone.HostedZone?.Id;
  expect(zoneId).toBeDefined();
  expect(zone.DelegationSet?.Id).toBe(dsId);

  const listed = await client.send(
    new ListHostedZonesCommand({ DelegationSetId: dsId }),
  );
  const ids = (listed.HostedZones ?? []).map((z) => z.Id);
  expect(ids).toContain(zoneId);

  await client.send(new DeleteHostedZoneCommand({ Id: zoneId }));
  await client.send(new DeleteReusableDelegationSetCommand({ Id: dsId }));
});

test("ListHostedZones HostedZoneType filter", async () => {
  const client = route53();
  const ref = `ref-private-${Date.now()}`;

  const zone = await client.send(
    new CreateHostedZoneCommand({
      Name: "private.example.com",
      CallerReference: ref,
      HostedZoneConfig: { PrivateZone: true },
    }),
  );
  const zoneId = zone.HostedZone?.Id;
  expect(zoneId).toBeDefined();

  const privateOnly = await client.send(
    new ListHostedZonesCommand({
      HostedZoneType: HostedZoneType.PRIVATE_HOSTED_ZONE,
    }),
  );
  const ids = (privateOnly.HostedZones ?? []).map((z) => z.Id);
  expect(ids).toContain(zoneId);

  await client.send(new DeleteHostedZoneCommand({ Id: zoneId }));
});

test("ListHostedZones MaxItems pagination", async () => {
  const client = route53();
  const refs: string[] = [];

  for (let i = 0; i < 3; i++) {
    const ref = `ref-paginate-${i}-${Date.now()}`;
    refs.push(ref);
    await client.send(
      new CreateHostedZoneCommand({
        Name: `paginate${i}.example.com`,
        CallerReference: ref,
      }),
    );
  }

  const page1 = await client.send(new ListHostedZonesCommand({ MaxItems: 2 }));
  expect((page1.HostedZones ?? []).length).toBeGreaterThanOrEqual(2);

  const zoneIds: string[] = [];
  for (const z of page1.HostedZones ?? []) {
    if (z.Id) zoneIds.push(z.Id);
  }
  for (const zoneId of zoneIds) {
    await client.send(new DeleteHostedZoneCommand({ Id: zoneId }));
  }
});

test("CreateReusableDelegationSet deduplicates CallerReference", async () => {
  const client = route53();
  const ref = `rds-dedup-${Date.now()}`;

  const first = await client.send(
    new CreateReusableDelegationSetCommand({ CallerReference: ref }),
  );
  const second = await client.send(
    new CreateReusableDelegationSetCommand({ CallerReference: ref }),
  );

  expect(first.DelegationSet?.Id).toBe(second.DelegationSet?.Id);

  await client.send(
    new DeleteReusableDelegationSetCommand({ Id: first.DelegationSet?.Id }),
  );
});
