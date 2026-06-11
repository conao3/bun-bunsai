import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ChangeResourceRecordSetsCommand,
  CreateHostedZoneCommand,
  DeleteHostedZoneCommand,
  ListResourceRecordSetsCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const route53 = () =>
  new Route53Client({ endpoint, region, credentials, requestHandler });

test("Route53 failover pair round-trip", async () => {
  const client = route53();

  const created = await client.send(
    new CreateHostedZoneCommand({
      Name: "failover-e2e.example.com",
      CallerReference: `ref-failover-${Date.now()}`,
    }),
  );
  const zoneId = created.HostedZone?.Id;
  expect(zoneId).toBeDefined();

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "CREATE",
            ResourceRecordSet: {
              Name: "failover.failover-e2e.example.com.",
              Type: "A",
              SetIdentifier: "primary",
              Failover: "PRIMARY",
              TTL: 60,
              ResourceRecords: [{ Value: "10.0.0.1" }],
            },
          },
          {
            Action: "CREATE",
            ResourceRecordSet: {
              Name: "failover.failover-e2e.example.com.",
              Type: "A",
              SetIdentifier: "secondary",
              Failover: "SECONDARY",
              TTL: 60,
              ResourceRecords: [{ Value: "10.0.0.2" }],
            },
          },
        ],
      },
    }),
  );

  const records = await client.send(
    new ListResourceRecordSetsCommand({ HostedZoneId: zoneId }),
  );
  const sets = records.ResourceRecordSets ?? [];

  const failoverSets = sets.filter(
    (r) => r.Name === "failover.failover-e2e.example.com." && r.Type === "A",
  );
  expect(failoverSets.length).toBe(2);

  const primary = failoverSets.find((r) => r.SetIdentifier === "primary");
  expect(primary).toBeDefined();
  expect(primary?.Failover).toBe("PRIMARY");
  expect(primary?.ResourceRecords?.[0]?.Value).toBe("10.0.0.1");

  const secondary = failoverSets.find((r) => r.SetIdentifier === "secondary");
  expect(secondary).toBeDefined();
  expect(secondary?.Failover).toBe("SECONDARY");
  expect(secondary?.ResourceRecords?.[0]?.Value).toBe("10.0.0.2");

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: "failover.failover-e2e.example.com.",
              Type: "A",
              SetIdentifier: "primary",
              Failover: "PRIMARY",
              TTL: 60,
              ResourceRecords: [{ Value: "10.0.1.1" }],
            },
          },
        ],
      },
    }),
  );

  const afterUpsert = await client.send(
    new ListResourceRecordSetsCommand({ HostedZoneId: zoneId }),
  );
  const upsertedPrimary = (afterUpsert.ResourceRecordSets ?? []).find(
    (r) =>
      r.Name === "failover.failover-e2e.example.com." &&
      r.SetIdentifier === "primary",
  );
  expect(upsertedPrimary?.ResourceRecords?.[0]?.Value).toBe("10.0.1.1");

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "DELETE",
            ResourceRecordSet: {
              Name: "failover.failover-e2e.example.com.",
              Type: "A",
              SetIdentifier: "primary",
              Failover: "PRIMARY",
              TTL: 60,
              ResourceRecords: [{ Value: "10.0.1.1" }],
            },
          },
          {
            Action: "DELETE",
            ResourceRecordSet: {
              Name: "failover.failover-e2e.example.com.",
              Type: "A",
              SetIdentifier: "secondary",
              Failover: "SECONDARY",
              TTL: 60,
              ResourceRecords: [{ Value: "10.0.0.2" }],
            },
          },
        ],
      },
    }),
  );

  const afterDelete = await client.send(
    new ListResourceRecordSetsCommand({ HostedZoneId: zoneId }),
  );
  const remaining = (afterDelete.ResourceRecordSets ?? []).filter(
    (r) => r.Name === "failover.failover-e2e.example.com." && r.Type === "A",
  );
  expect(remaining.length).toBe(0);

  await client.send(new DeleteHostedZoneCommand({ Id: zoneId }));
});
