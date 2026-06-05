import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateHealthCheckCommand,
  DeleteHealthCheckCommand,
  GetHealthCheckCommand,
  GetHostedZoneCountCommand,
  ListHealthChecksCommand,
  Route53Client,
} from "@aws-sdk/client-route-53";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const route53 = () =>
  new Route53Client({ endpoint, region, credentials, requestHandler });

test("Route53 health check lifecycle and hosted zone count", async () => {
  const client = route53();

  const beforeCount = await client.send(new GetHostedZoneCountCommand({}));
  expect(typeof beforeCount.HostedZoneCount).toBe("number");

  const created = await client.send(
    new CreateHealthCheckCommand({
      CallerReference: `hc-ref-${Date.now()}`,
      HealthCheckConfig: {
        Type: "HTTP",
        IPAddress: "192.0.2.10",
        Port: 80,
        ResourcePath: "/health",
        FullyQualifiedDomainName: "bunsai-e2e.example.com",
        RequestInterval: 30,
        FailureThreshold: 3,
      },
    }),
  );
  const checkId = created.HealthCheck?.Id;
  expect(checkId).toBeDefined();
  expect(created.HealthCheck?.HealthCheckConfig?.Type).toBe("HTTP");
  expect(created.HealthCheck?.HealthCheckVersion).toBeGreaterThan(0);
  expect(created.Location).toContain("/healthcheck/");

  const got = await client.send(
    new GetHealthCheckCommand({ HealthCheckId: checkId }),
  );
  expect(got.HealthCheck?.Id).toBe(checkId);
  expect(got.HealthCheck?.HealthCheckConfig?.IPAddress).toBe("192.0.2.10");

  const listed = await client.send(new ListHealthChecksCommand({}));
  const ids = (listed.HealthChecks ?? []).map((c) => c.Id);
  expect(ids).toContain(checkId);

  await client.send(new DeleteHealthCheckCommand({ HealthCheckId: checkId }));

  const afterDelete = await client.send(new ListHealthChecksCommand({}));
  const idsAfter = (afterDelete.HealthChecks ?? []).map((c) => c.Id);
  expect(idsAfter).not.toContain(checkId);
});
