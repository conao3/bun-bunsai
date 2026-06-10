import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ChangeResourceRecordSetsCommand,
  CreateHealthCheckCommand,
  CreateHostedZoneCommand,
  DeleteHealthCheckCommand,
  DeleteHostedZoneCommand,
  ListResourceRecordSetsCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const route53 = () =>
  new Route53Client({ endpoint, region, credentials, requestHandler });

test("CreateHostedZone CallerReference idempotency", async () => {
  const client = route53();
  const ref = `idempotent-zone-${Date.now()}`;

  const first = await client.send(
    new CreateHostedZoneCommand({
      Name: "idempotent.example.com",
      CallerReference: ref,
    }),
  );
  const zoneId = first.HostedZone?.Id;
  expect(zoneId).toBeDefined();

  const second = await client.send(
    new CreateHostedZoneCommand({
      Name: "idempotent.example.com",
      CallerReference: ref,
    }),
  );
  expect(second.HostedZone?.Id).toBe(zoneId);

  await client.send(new DeleteHostedZoneCommand({ Id: zoneId }));
});

test("CreateHealthCheck CallerReference idempotency", async () => {
  const client = route53();
  const ref = `idempotent-hc-${Date.now()}`;

  const first = await client.send(
    new CreateHealthCheckCommand({
      CallerReference: ref,
      HealthCheckConfig: { Type: "HTTP", Port: 80, ResourcePath: "/" },
    }),
  );
  const checkId = first.HealthCheck?.Id;
  expect(checkId).toBeDefined();

  const second = await client.send(
    new CreateHealthCheckCommand({
      CallerReference: ref,
      HealthCheckConfig: { Type: "HTTP", Port: 80, ResourcePath: "/" },
    }),
  );
  expect(second.HealthCheck?.Id).toBe(checkId);

  await client.send(new DeleteHealthCheckCommand({ HealthCheckId: checkId }));
});

test("DeleteHostedZone rejects zone with non-default records", async () => {
  const client = route53();

  const created = await client.send(
    new CreateHostedZoneCommand({
      Name: "nonempty-delete.example.com",
      CallerReference: `ref-nonempty-${Date.now()}`,
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
              Name: "www.nonempty-delete.example.com.",
              Type: "A",
              TTL: 300,
              ResourceRecords: [{ Value: "1.2.3.4" }],
            },
          },
        ],
      },
    }),
  );

  let threw = false;
  try {
    await client.send(new DeleteHostedZoneCommand({ Id: zoneId }));
  } catch (err) {
    threw = true;
    expect((err as { name?: string }).name).toBe("HostedZoneNotEmpty");
  }
  expect(threw).toBe(true);

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "DELETE",
            ResourceRecordSet: {
              Name: "www.nonempty-delete.example.com.",
              Type: "A",
              TTL: 300,
              ResourceRecords: [{ Value: "1.2.3.4" }],
            },
          },
        ],
      },
    }),
  );
  await client.send(new DeleteHostedZoneCommand({ Id: zoneId }));
});

test("ListResourceRecordSets pagination with MaxItems and StartRecordName", async () => {
  const client = route53();

  const created = await client.send(
    new CreateHostedZoneCommand({
      Name: "pagination.example.com",
      CallerReference: `ref-pag-${Date.now()}`,
    }),
  );
  const zoneId = created.HostedZone?.Id;
  expect(zoneId).toBeDefined();

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: ["aaa", "bbb", "ccc", "ddd", "eee"].map((sub) => ({
          Action: "CREATE" as const,
          ResourceRecordSet: {
            Name: `${sub}.pagination.example.com.`,
            Type: "A",
            TTL: 60,
            ResourceRecords: [{ Value: "10.0.0.1" }],
          },
        })),
      },
    }),
  );

  const page1 = await client.send(
    new ListResourceRecordSetsCommand({ HostedZoneId: zoneId, MaxItems: 3 }),
  );
  expect(page1.IsTruncated).toBe(true);
  expect(page1.ResourceRecordSets?.length).toBe(3);
  expect(page1.NextRecordName).toBeDefined();
  expect(page1.NextRecordType).toBeDefined();

  const page2 = await client.send(
    new ListResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      MaxItems: 10,
      StartRecordName: page1.NextRecordName,
      StartRecordType: page1.NextRecordType,
    }),
  );
  expect(page2.IsTruncated).toBe(false);
  expect((page2.ResourceRecordSets?.length ?? 0)).toBeGreaterThan(0);

  const allNames = [
    ...(page1.ResourceRecordSets ?? []),
    ...(page2.ResourceRecordSets ?? []),
  ].map((r) => r.Name);
  for (const sub of ["aaa", "bbb", "ccc", "ddd", "eee"]) {
    expect(allNames).toContain(`${sub}.pagination.example.com.`);
  }

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: ["aaa", "bbb", "ccc", "ddd", "eee"].map((sub) => ({
          Action: "DELETE" as const,
          ResourceRecordSet: {
            Name: `${sub}.pagination.example.com.`,
            Type: "A",
            TTL: 60,
            ResourceRecords: [{ Value: "10.0.0.1" }],
          },
        })),
      },
    }),
  );
  await client.send(new DeleteHostedZoneCommand({ Id: zoneId }));
});
