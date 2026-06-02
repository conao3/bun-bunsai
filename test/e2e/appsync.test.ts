import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AppSyncClient,
  CreateApiKeyCommand,
  CreateGraphqlApiCommand,
  DeleteGraphqlApiCommand,
  GetGraphqlApiCommand,
  ListApiKeysCommand,
  ListGraphqlApisCommand,
  UpdateGraphqlApiCommand,
} from "@aws-sdk/client-appsync";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const appsync = () => new AppSyncClient({ endpoint, region, credentials });

test("AppSync graphql api and api key roundtrip", async () => {
  const client = appsync();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateGraphqlApiCommand({
      name,
      authenticationType: "API_KEY",
      xrayEnabled: true,
    }),
  );
  const apiId = created.graphqlApi?.apiId;
  expect(apiId).toBeDefined();
  expect(created.graphqlApi?.name).toBe(name);
  expect(created.graphqlApi?.authenticationType).toBe("API_KEY");
  expect(created.graphqlApi?.arn).toContain(`apis/${apiId}`);
  expect(created.graphqlApi?.uris?.GRAPHQL).toContain("appsync-api");

  const got = await client.send(new GetGraphqlApiCommand({ apiId: apiId }));
  expect(got.graphqlApi?.name).toBe(name);
  expect(got.graphqlApi?.xrayEnabled).toBe(true);

  const listed = await client.send(new ListGraphqlApisCommand({}));
  expect((listed.graphqlApis ?? []).map((a) => a.apiId)).toContain(apiId);

  const updated = await client.send(
    new UpdateGraphqlApiCommand({
      apiId: apiId,
      name: `${name}-updated`,
      authenticationType: "API_KEY",
    }),
  );
  expect(updated.graphqlApi?.name).toBe(`${name}-updated`);
  expect(updated.graphqlApi?.arn).toBe(created.graphqlApi?.arn);

  const key = await client.send(
    new CreateApiKeyCommand({ apiId: apiId, description: "demo" }),
  );
  expect(key.apiKey?.id).toBeDefined();
  expect(key.apiKey?.description).toBe("demo");

  const keys = await client.send(new ListApiKeysCommand({ apiId: apiId }));
  expect((keys.apiKeys ?? []).map((k) => k.id)).toContain(key.apiKey?.id);

  await client.send(new DeleteGraphqlApiCommand({ apiId: apiId }));
  await expect(
    client.send(new GetGraphqlApiCommand({ apiId: apiId })),
  ).rejects.toThrow();
});
