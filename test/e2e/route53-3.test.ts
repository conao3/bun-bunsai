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

test("Route53 alias record and weighted pair round-trip", async () => {
  const client = route53();

  const created = await client.send(
    new CreateHostedZoneCommand({
      Name: "alias-weighted-e2e.example.com",
      CallerReference: `ref-alias-${Date.now()}`,
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
              Name: "alias.alias-weighted-e2e.example.com.",
              Type: "A",
              AliasTarget: {
                HostedZoneId: "Z2FDTNDATAQYW2",
                DNSName: "d111111abcdef8.cloudfront.net.",
                EvaluateTargetHealth: false,
              },
            },
          },
          {
            Action: "CREATE",
            ResourceRecordSet: {
              Name: "weighted.alias-weighted-e2e.example.com.",
              Type: "A",
              SetIdentifier: "primary",
              Weight: 100,
              TTL: 60,
              ResourceRecords: [{ Value: "10.0.0.1" }],
            },
          },
          {
            Action: "CREATE",
            ResourceRecordSet: {
              Name: "weighted.alias-weighted-e2e.example.com.",
              Type: "A",
              SetIdentifier: "secondary",
              Weight: 50,
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

  const aliasRecord = sets.find(
    (r) => r.Name === "alias.alias-weighted-e2e.example.com." && r.Type === "A",
  );
  expect(aliasRecord).toBeDefined();
  expect(aliasRecord?.AliasTarget?.HostedZoneId).toBe("Z2FDTNDATAQYW2");
  expect(aliasRecord?.AliasTarget?.DNSName).toBe(
    "d111111abcdef8.cloudfront.net.",
  );
  expect(aliasRecord?.AliasTarget?.EvaluateTargetHealth).toBe(false);

  const weightedSets = sets.filter(
    (r) =>
      r.Name === "weighted.alias-weighted-e2e.example.com." && r.Type === "A",
  );
  expect(weightedSets.length).toBe(2);

  const primary = weightedSets.find((r) => r.SetIdentifier === "primary");
  expect(primary).toBeDefined();
  expect(primary?.Weight).toBe(100);
  expect(primary?.ResourceRecords?.[0]?.Value).toBe("10.0.0.1");

  const secondary = weightedSets.find((r) => r.SetIdentifier === "secondary");
  expect(secondary).toBeDefined();
  expect(secondary?.Weight).toBe(50);
  expect(secondary?.ResourceRecords?.[0]?.Value).toBe("10.0.0.2");

  await client.send(new DeleteHostedZoneCommand({ Id: zoneId }));
});
