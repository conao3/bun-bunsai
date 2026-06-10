import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ChangeResourceRecordSetsCommand,
  CreateHostedZoneCommand,
  DeleteHostedZoneCommand,
  GetChangeCommand,
  ListResourceRecordSetsCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const route53 = () =>
  new Route53Client({ endpoint, region, credentials, requestHandler });

test("ChangeResourceRecordSets batch semantics and ALIAS round-trip", async () => {
  const client = route53();

  const created = await client.send(
    new CreateHostedZoneCommand({
      Name: "batch-e2e.example.com",
      CallerReference: `ref-batch-${Date.now()}`,
    }),
  );
  const zoneId = created.HostedZone?.Id;
  expect(zoneId).toBeDefined();

  const createResult = await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "CREATE",
            ResourceRecordSet: {
              Name: "www.batch-e2e.example.com.",
              Type: "A",
              TTL: 300,
              ResourceRecords: [{ Value: "1.2.3.4" }],
            },
          },
        ],
      },
    }),
  );
  expect(createResult.ChangeInfo?.Status).toBe("INSYNC");
  const changeId = createResult.ChangeInfo?.Id;
  expect(changeId).toBeDefined();

  const list1 = await client.send(
    new ListResourceRecordSetsCommand({ HostedZoneId: zoneId }),
  );
  const sets1 = list1.ResourceRecordSets ?? [];
  const aRecord = sets1.find(
    (r) => r.Name === "www.batch-e2e.example.com." && r.Type === "A",
  );
  expect(aRecord).toBeDefined();
  expect(aRecord?.TTL).toBe(300);
  expect(aRecord?.ResourceRecords?.[0]?.Value).toBe("1.2.3.4");

  let threw = false;
  try {
    await client.send(
      new ChangeResourceRecordSetsCommand({
        HostedZoneId: zoneId,
        ChangeBatch: {
          Changes: [
            {
              Action: "CREATE",
              ResourceRecordSet: {
                Name: "www.batch-e2e.example.com.",
                Type: "A",
                TTL: 300,
                ResourceRecords: [{ Value: "1.2.3.4" }],
              },
            },
          ],
        },
      }),
    );
  } catch (err) {
    threw = true;
    expect((err as { name?: string }).name).toBe("InvalidChangeBatch");
  }
  expect(threw).toBe(true);

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: "www.batch-e2e.example.com.",
              Type: "A",
              TTL: 60,
              ResourceRecords: [{ Value: "5.6.7.8" }],
            },
          },
        ],
      },
    }),
  );

  const list2 = await client.send(
    new ListResourceRecordSetsCommand({ HostedZoneId: zoneId }),
  );
  const sets2 = list2.ResourceRecordSets ?? [];
  const updated = sets2.find(
    (r) => r.Name === "www.batch-e2e.example.com." && r.Type === "A",
  );
  expect(updated).toBeDefined();
  expect(updated?.TTL).toBe(60);
  expect(updated?.ResourceRecords?.[0]?.Value).toBe("5.6.7.8");

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "DELETE",
            ResourceRecordSet: {
              Name: "www.batch-e2e.example.com.",
              Type: "A",
              TTL: 60,
              ResourceRecords: [{ Value: "5.6.7.8" }],
            },
          },
        ],
      },
    }),
  );

  const list3 = await client.send(
    new ListResourceRecordSetsCommand({ HostedZoneId: zoneId }),
  );
  const sets3 = list3.ResourceRecordSets ?? [];
  const deleted = sets3.find(
    (r) => r.Name === "www.batch-e2e.example.com." && r.Type === "A",
  );
  expect(deleted).toBeUndefined();

  let throwDelete = false;
  try {
    await client.send(
      new ChangeResourceRecordSetsCommand({
        HostedZoneId: zoneId,
        ChangeBatch: {
          Changes: [
            {
              Action: "DELETE",
              ResourceRecordSet: {
                Name: "www.batch-e2e.example.com.",
                Type: "A",
                TTL: 60,
                ResourceRecords: [{ Value: "5.6.7.8" }],
              },
            },
          ],
        },
      }),
    );
  } catch (err) {
    throwDelete = true;
    expect((err as { name?: string }).name).toBe("InvalidChangeBatch");
  }
  expect(throwDelete).toBe(true);

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "CREATE",
            ResourceRecordSet: {
              Name: "alias.batch-e2e.example.com.",
              Type: "A",
              AliasTarget: {
                HostedZoneId: "Z2FDTNDATAQYW2",
                DNSName: "d111111abcdef8.cloudfront.net.",
                EvaluateTargetHealth: false,
              },
            },
          },
        ],
      },
    }),
  );

  const list4 = await client.send(
    new ListResourceRecordSetsCommand({ HostedZoneId: zoneId }),
  );
  const sets4 = list4.ResourceRecordSets ?? [];
  const aliasRecord = sets4.find(
    (r) => r.Name === "alias.batch-e2e.example.com." && r.Type === "A",
  );
  expect(aliasRecord).toBeDefined();
  expect(aliasRecord?.AliasTarget?.HostedZoneId).toBe("Z2FDTNDATAQYW2");
  expect(aliasRecord?.AliasTarget?.DNSName).toBe(
    "d111111abcdef8.cloudfront.net.",
  );
  expect(aliasRecord?.AliasTarget?.EvaluateTargetHealth).toBe(false);
  expect(aliasRecord?.TTL).toBeUndefined();

  const getChange = await client.send(new GetChangeCommand({ Id: changeId }));
  expect(getChange.ChangeInfo?.Status).toBe("INSYNC");
  expect(getChange.ChangeInfo?.Id).toBeDefined();

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "DELETE",
            ResourceRecordSet: {
              Name: "alias.batch-e2e.example.com.",
              Type: "A",
              AliasTarget: {
                HostedZoneId: "Z2FDTNDATAQYW2",
                DNSName: "d111111abcdef8.cloudfront.net.",
                EvaluateTargetHealth: false,
              },
            },
          },
        ],
      },
    }),
  );
  await client.send(new DeleteHostedZoneCommand({ Id: zoneId }));
});
