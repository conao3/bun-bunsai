import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ChangeResourceRecordSetsCommand,
  CreateHealthCheckCommand,
  CreateHostedZoneCommand,
  CreateTrafficPolicyCommand,
  DeleteHealthCheckCommand,
  DeleteHostedZoneCommand,
  DeleteTrafficPolicyCommand,
  GetHealthCheckCommand,
  GetHealthCheckStatusCommand,
  GetTrafficPolicyCommand,
  ListHealthChecksCommand,
  ListResourceRecordSetsCommand,
  ListTrafficPoliciesCommand,
  Route53Client,
  UpdateHealthCheckCommand,
} from "@aws-sdk/client-route-53";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const route53 = () =>
  new Route53Client({ endpoint, region, credentials, requestHandler });

test("Route53 health check update and status", async () => {
  const client = route53();

  const created = await client.send(
    new CreateHealthCheckCommand({
      CallerReference: `hc-update-${Date.now()}`,
      HealthCheckConfig: {
        Type: "HTTP",
        IPAddress: "10.0.0.1",
        Port: 80,
        ResourcePath: "/ping",
        FailureThreshold: 3,
      },
    }),
  );
  const checkId = created.HealthCheck?.Id;
  expect(checkId).toBeDefined();
  expect(created.HealthCheck?.HealthCheckConfig?.ResourcePath).toBe("/ping");
  expect(created.HealthCheck?.HealthCheckVersion).toBe(1);

  const updated = await client.send(
    new UpdateHealthCheckCommand({
      HealthCheckId: checkId,
      ResourcePath: "/healthz",
      FailureThreshold: 5,
    }),
  );
  expect(updated.HealthCheck?.HealthCheckConfig?.ResourcePath).toBe("/healthz");
  expect(updated.HealthCheck?.HealthCheckConfig?.FailureThreshold).toBe(5);
  expect(updated.HealthCheck?.HealthCheckVersion).toBe(2);

  const got = await client.send(
    new GetHealthCheckCommand({ HealthCheckId: checkId }),
  );
  expect(got.HealthCheck?.HealthCheckConfig?.ResourcePath).toBe("/healthz");
  expect(got.HealthCheck?.HealthCheckVersion).toBe(2);

  const status = await client.send(
    new GetHealthCheckStatusCommand({ HealthCheckId: checkId }),
  );
  const obs = status.HealthCheckObservations ?? [];
  expect(obs.length).toBeGreaterThan(0);
  expect(obs[0]?.StatusReport?.Status).toContain("Success");

  await client.send(new DeleteHealthCheckCommand({ HealthCheckId: checkId }));

  const afterDelete = await client.send(new ListHealthChecksCommand({}));
  expect((afterDelete.HealthChecks ?? []).map((c) => c.Id)).not.toContain(
    checkId,
  );
});

test("Route53 traffic policy round-trip", async () => {
  const client = route53();
  const doc = JSON.stringify({ AWSPolicyFormatVersion: "2015-10-01" });

  const created = await client.send(
    new CreateTrafficPolicyCommand({
      Name: "e2e-policy",
      Document: doc,
      Comment: "e2e test policy",
    }),
  );
  const policyId = created.TrafficPolicy?.Id;
  const version = created.TrafficPolicy?.Version;
  expect(policyId).toBeDefined();
  expect(version).toBe(1);
  expect(created.TrafficPolicy?.Document).toBe(doc);

  const got = await client.send(
    new GetTrafficPolicyCommand({ Id: policyId!, Version: version! }),
  );
  expect(got.TrafficPolicy?.Id).toBe(policyId);
  expect(got.TrafficPolicy?.Document).toBe(doc);

  const listed = await client.send(new ListTrafficPoliciesCommand({}));
  const ids = (listed.TrafficPolicySummaries ?? []).map((p) => p.Id);
  expect(ids).toContain(policyId);

  await client.send(
    new DeleteTrafficPolicyCommand({ Id: policyId!, Version: version! }),
  );

  const afterDelete = await client.send(new ListTrafficPoliciesCommand({}));
  expect(
    (afterDelete.TrafficPolicySummaries ?? []).map((p) => p.Id),
  ).not.toContain(policyId);
});

test("Route53 HealthCheckId association with resource record set", async () => {
  const client = route53();

  const hc = await client.send(
    new CreateHealthCheckCommand({
      CallerReference: `hc-rrs-${Date.now()}`,
      HealthCheckConfig: { Type: "HTTP", IPAddress: "10.1.2.3", Port: 80 },
    }),
  );
  const checkId = hc.HealthCheck?.Id;
  expect(checkId).toBeDefined();

  const zone = await client.send(
    new CreateHostedZoneCommand({
      Name: "hc-assoc-e2e.example.com",
      CallerReference: `zone-hc-${Date.now()}`,
    }),
  );
  const zoneId = zone.HostedZone?.Id;
  expect(zoneId).toBeDefined();

  await client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "CREATE",
            ResourceRecordSet: {
              Name: "www.hc-assoc-e2e.example.com.",
              Type: "A",
              TTL: 60,
              ResourceRecords: [{ Value: "10.1.2.3" }],
              HealthCheckId: checkId,
            },
          },
        ],
      },
    }),
  );

  const records = await client.send(
    new ListResourceRecordSetsCommand({ HostedZoneId: zoneId }),
  );
  const www = (records.ResourceRecordSets ?? []).find(
    (r) => r.Name === "www.hc-assoc-e2e.example.com." && r.Type === "A",
  );
  expect(www).toBeDefined();
  expect(www?.HealthCheckId).toBe(checkId);

  await client.send(new DeleteHostedZoneCommand({ Id: zoneId }));
  await client.send(new DeleteHealthCheckCommand({ HealthCheckId: checkId }));
});

test("Route53 NoSuchHealthCheck and NoSuchTrafficPolicy errors", async () => {
  const client = route53();
  const fakeId = "00000000-0000-0000-0000-000000000000";

  let hcThrew = false;
  try {
    await client.send(new GetHealthCheckCommand({ HealthCheckId: fakeId }));
  } catch (err) {
    hcThrew = true;
    expect((err as { name?: string }).name).toBe("NoSuchHealthCheck");
  }
  expect(hcThrew).toBe(true);

  let tpThrew = false;
  try {
    await client.send(new GetTrafficPolicyCommand({ Id: fakeId, Version: 1 }));
  } catch (err) {
    tpThrew = true;
    expect((err as { name?: string }).name).toBe("NoSuchTrafficPolicy");
  }
  expect(tpThrew).toBe(true);
});
