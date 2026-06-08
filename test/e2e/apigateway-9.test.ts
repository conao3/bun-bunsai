import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  APIGatewayClient,
  CreateApiKeyCommand,
  CreateUsagePlanCommand,
  CreateUsagePlanKeyCommand,
  DeleteApiKeyCommand,
  DeleteUsagePlanCommand,
  DeleteUsagePlanKeyCommand,
  GetApiKeyCommand,
  GetApiKeysCommand,
  GetUsagePlanCommand,
  GetUsagePlanKeysCommand,
  UpdateApiKeyCommand,
  UpdateUsagePlanCommand,
} from "@aws-sdk/client-api-gateway";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const apigateway = () =>
  new APIGatewayClient({ endpoint, region, credentials, requestHandler });

test("API Gateway API key + usage plan + association lifecycle", async () => {
  const client = apigateway();

  const created = await client.send(
    new CreateApiKeyCommand({ name: "lifecycle-key", enabled: true }),
  );
  expect(created.id).toBeDefined();
  expect(created.name).toBe("lifecycle-key");
  expect(created.enabled).toBe(true);
  expect(created.value).toBeDefined();
  const keyId = created.id as string;

  const got = await client.send(new GetApiKeyCommand({ apiKey: keyId }));
  expect(got.id).toBe(keyId);
  expect(got.name).toBe("lifecycle-key");

  const listed = await client.send(new GetApiKeysCommand({}));
  expect((listed.items ?? []).map((k) => k.id)).toContain(keyId);

  const updatedKey = await client.send(
    new UpdateApiKeyCommand({
      apiKey: keyId,
      patchOperations: [
        { op: "replace", path: "/name", value: "renamed-key" },
        { op: "replace", path: "/enabled", value: "false" },
      ],
    }),
  );
  expect(updatedKey.name).toBe("renamed-key");
  expect(updatedKey.enabled).toBe(false);

  const plan = await client.send(
    new CreateUsagePlanCommand({
      name: "lifecycle-plan",
      throttle: { burstLimit: 50, rateLimit: 25 },
      quota: { limit: 500, offset: 0, period: "DAY" },
    }),
  );
  expect(plan.id).toBeDefined();
  const planId = plan.id as string;

  const planKey = await client.send(
    new CreateUsagePlanKeyCommand({
      usagePlanId: planId,
      keyId,
      keyType: "API_KEY",
    }),
  );
  expect(planKey.id).toBe(keyId);
  expect(planKey.type).toBe("API_KEY");

  const planKeys = await client.send(
    new GetUsagePlanKeysCommand({ usagePlanId: planId }),
  );
  expect((planKeys.items ?? []).map((k) => k.id)).toContain(keyId);

  await client.send(
    new UpdateUsagePlanCommand({
      usagePlanId: planId,
      patchOperations: [
        { op: "replace", path: "/throttle/burstLimit", value: "200" },
        { op: "replace", path: "/throttle/rateLimit", value: "100" },
      ],
    }),
  );
  const gotPlan = await client.send(
    new GetUsagePlanCommand({ usagePlanId: planId }),
  );
  expect(gotPlan.throttle?.burstLimit).toBe(200);
  expect(gotPlan.throttle?.rateLimit).toBe(100);

  await client.send(
    new DeleteUsagePlanKeyCommand({ usagePlanId: planId, keyId }),
  );
  const afterKeyDelete = await client.send(
    new GetUsagePlanKeysCommand({ usagePlanId: planId }),
  );
  expect((afterKeyDelete.items ?? []).map((k) => k.id)).not.toContain(keyId);

  await client.send(new DeleteApiKeyCommand({ apiKey: keyId }));
  await expect(
    client.send(new GetApiKeyCommand({ apiKey: keyId })),
  ).rejects.toThrow();

  await client.send(new DeleteUsagePlanCommand({ usagePlanId: planId }));
  await expect(
    client.send(new GetUsagePlanCommand({ usagePlanId: planId })),
  ).rejects.toThrow();
});
