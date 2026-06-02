import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  APIGatewayClient,
  CreateDeploymentCommand,
  CreateResourceCommand,
  CreateRestApiCommand,
  DeleteRestApiCommand,
  GetResourcesCommand,
  GetRestApiCommand,
  GetRestApisCommand,
} from "@aws-sdk/client-api-gateway";

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

const apigateway = () =>
  new APIGatewayClient({ endpoint, region, credentials });

test("API Gateway rest api, resource and deployment lifecycle", async () => {
  const client = apigateway();
  const apiName = "bunsai-e2e-api";

  const created = await client.send(
    new CreateRestApiCommand({
      name: apiName,
      description: "bunsai e2e",
    }),
  );
  expect(created.id).toBeDefined();
  expect(created.name).toBe(apiName);
  expect(created.rootResourceId).toBeDefined();
  const restApiId = created.id as string;
  const rootResourceId = created.rootResourceId as string;

  const got = await client.send(new GetRestApiCommand({ restApiId }));
  expect(got.id).toBe(restApiId);
  expect(got.name).toBe(apiName);

  const listed = await client.send(new GetRestApisCommand({}));
  const ids = (listed.items ?? []).map((api) => api.id);
  expect(ids).toContain(restApiId);

  const resource = await client.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "pets",
    }),
  );
  expect(resource.id).toBeDefined();
  expect(resource.parentId).toBe(rootResourceId);
  expect(resource.pathPart).toBe("pets");
  expect(resource.path).toBe("/pets");

  const resources = await client.send(new GetResourcesCommand({ restApiId }));
  const paths = (resources.items ?? []).map((item) => item.path);
  expect(paths).toContain("/");
  expect(paths).toContain("/pets");

  const deployment = await client.send(
    new CreateDeploymentCommand({
      restApiId,
      description: "first deploy",
    }),
  );
  expect(deployment.id).toBeDefined();
  expect(deployment.description).toBe("first deploy");

  const deleted = await client.send(new DeleteRestApiCommand({ restApiId }));
  expect(deleted.$metadata.httpStatusCode).toBe(202);

  await expect(
    client.send(new GetRestApiCommand({ restApiId })),
  ).rejects.toThrow();
});
