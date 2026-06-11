import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  APIGatewayClient,
  CreateApiKeyCommand,
  CreateUsagePlanCommand,
  CreateUsagePlanKeyCommand,
  DeleteApiKeyCommand,
  GetApiKeysCommand,
  GetUsagePlanKeysCommand,
  ImportApiKeysCommand,
} from "@aws-sdk/client-api-gateway";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const apigateway = () =>
  new APIGatewayClient({ endpoint, region, credentials, requestHandler });

test("ImportApiKeys: csv 2 rows registered in GetApiKeys", async () => {
  const client = apigateway();

  const csv =
    "Name,Key,Description,Enabled\nimport-key-1,aaaabbbbccccdddd1111222233334444,first key,true\nimport-key-2,ddddccccbbbbaaaa4444333322221111,second key,false\n";
  const result = await client.send(
    new ImportApiKeysCommand({
      body: new TextEncoder().encode(csv),
      format: "csv",
    }),
  );
  expect(result.ids).toHaveLength(2);
  expect(result.warnings).toHaveLength(0);

  const listed = await client.send(
    new GetApiKeysCommand({ includeValues: true }),
  );
  const ids = (listed.items ?? []).map((k) => k.id);
  expect(ids).toContain(result.ids![0]);
  expect(ids).toContain(result.ids![1]);

  const key1 = (listed.items ?? []).find((k) => k.id === result.ids![0]);
  expect(key1?.name).toBe("import-key-1");
  expect(key1?.value).toBe("aaaabbbbccccdddd1111222233334444");
  expect(key1?.enabled).toBe(true);

  const key2 = (listed.items ?? []).find((k) => k.id === result.ids![1]);
  expect(key2?.name).toBe("import-key-2");
  expect(key2?.enabled).toBe(false);
});

test("CreateUsagePlanKey: invalid keyId returns 404", async () => {
  const client = apigateway();

  const plan = await client.send(
    new CreateUsagePlanCommand({ name: "test-plan-404" }),
  );
  const planId = plan.id as string;

  await expect(
    client.send(
      new CreateUsagePlanKeyCommand({
        usagePlanId: planId,
        keyId: "nonexistent-key-id",
        keyType: "API_KEY",
      }),
    ),
  ).rejects.toThrow();
});

test("DeleteApiKey: removes usageplankey associations", async () => {
  const client = apigateway();

  const key = await client.send(
    new CreateApiKeyCommand({ name: "delete-cascade-key", enabled: true }),
  );
  const keyId = key.id as string;

  const plan = await client.send(
    new CreateUsagePlanCommand({ name: "delete-cascade-plan" }),
  );
  const planId = plan.id as string;

  await client.send(
    new CreateUsagePlanKeyCommand({
      usagePlanId: planId,
      keyId,
      keyType: "API_KEY",
    }),
  );

  const before = await client.send(
    new GetUsagePlanKeysCommand({ usagePlanId: planId }),
  );
  expect((before.items ?? []).map((k) => k.id)).toContain(keyId);

  await client.send(new DeleteApiKeyCommand({ apiKey: keyId }));

  const after = await client.send(
    new GetUsagePlanKeysCommand({ usagePlanId: planId }),
  );
  expect((after.items ?? []).map((k) => k.id)).not.toContain(keyId);
});
