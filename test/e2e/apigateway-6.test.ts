import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  APIGatewayClient,
  CreateApiKeyCommand,
  CreateUsagePlanCommand,
  CreateUsagePlanKeyCommand,
  DeleteUsagePlanCommand,
  DeleteUsagePlanKeyCommand,
  GetUsagePlanCommand,
  GetUsagePlanKeyCommand,
  GetUsagePlanKeysCommand,
  GetUsagePlansCommand,
  UpdateUsagePlanCommand,
  UpdateVpcLinkCommand,
  CreateVpcLinkCommand,
  DeleteVpcLinkCommand,
} from "@aws-sdk/client-api-gateway";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const apigateway = () =>
  new APIGatewayClient({ endpoint, region, credentials });

test("API Gateway usage-plan + key lifecycle", async () => {
  const client = apigateway();

  const created = await client.send(
    new CreateUsagePlanCommand({
      name: "my-plan",
      description: "e2e test plan",
      throttle: { burstLimit: 100, rateLimit: 50 },
      quota: { limit: 1000, offset: 0, period: "MONTH" },
    }),
  );
  expect(created.id).toBeDefined();
  expect(created.name).toBe("my-plan");
  expect(created.description).toBe("e2e test plan");
  expect(created.throttle?.burstLimit).toBe(100);
  expect(created.quota?.period).toBe("MONTH");
  const planId = created.id as string;

  const got = await client.send(
    new GetUsagePlanCommand({ usagePlanId: planId }),
  );
  expect(got.id).toBe(planId);
  expect(got.name).toBe("my-plan");

  const listed = await client.send(new GetUsagePlansCommand({}));
  expect((listed.items ?? []).map((p) => p.id)).toContain(planId);

  const updated = await client.send(
    new UpdateUsagePlanCommand({
      usagePlanId: planId,
      patchOperations: [
        { op: "replace", path: "/name", value: "updated-plan" },
      ],
    }),
  );
  expect(updated.name).toBe("updated-plan");

  const apiKey = await client.send(
    new CreateApiKeyCommand({ name: "e2e-key", enabled: true }),
  );
  const keyId = apiKey.id as string;

  const planKey = await client.send(
    new CreateUsagePlanKeyCommand({
      usagePlanId: planId,
      keyId,
      keyType: "API_KEY",
    }),
  );
  expect(planKey.id).toBe(keyId);
  expect(planKey.type).toBe("API_KEY");

  const gotKey = await client.send(
    new GetUsagePlanKeyCommand({ usagePlanId: planId, keyId }),
  );
  expect(gotKey.id).toBe(keyId);

  const keys = await client.send(
    new GetUsagePlanKeysCommand({ usagePlanId: planId }),
  );
  expect((keys.items ?? []).map((k) => k.id)).toContain(keyId);

  await client.send(
    new DeleteUsagePlanKeyCommand({ usagePlanId: planId, keyId }),
  );
  const afterKeyDelete = await client.send(
    new GetUsagePlanKeysCommand({ usagePlanId: planId }),
  );
  expect((afterKeyDelete.items ?? []).map((k) => k.id)).not.toContain(keyId);

  await client.send(new DeleteUsagePlanCommand({ usagePlanId: planId }));
  const afterDelete = await client.send(new GetUsagePlansCommand({}));
  expect((afterDelete.items ?? []).map((p) => p.id)).not.toContain(planId);
});

test("API Gateway vpc-link update", async () => {
  const client = apigateway();

  const created = await client.send(
    new CreateVpcLinkCommand({
      name: "link-for-update",
      targetArns: [
        "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/net/nlb/abc",
      ],
    }),
  );
  const vpcLinkId = created.id as string;

  const updated = await client.send(
    new UpdateVpcLinkCommand({
      vpcLinkId,
      patchOperations: [
        { op: "replace", path: "/name", value: "link-updated" },
      ],
    }),
  );
  expect(updated.name).toBe("link-updated");
  expect(updated.id).toBe(vpcLinkId);

  await client.send(new DeleteVpcLinkCommand({ vpcLinkId }));
});
