import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  AppMeshClient,
  CreateMeshCommand,
  DeleteMeshCommand,
  DescribeMeshCommand,
  ListMeshesCommand,
} from "@aws-sdk/client-app-mesh";

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

const appmesh = () =>
  new AppMeshClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("AppMesh mesh roundtrip", async () => {
  const client = appmesh();
  const meshName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(new CreateMeshCommand({ meshName }));
  expect(created.mesh?.meshName).toBe(meshName);
  expect(created.mesh?.metadata?.arn).toBeDefined();
  expect(created.mesh?.status?.status).toBe("ACTIVE");

  const got = await client.send(new DescribeMeshCommand({ meshName }));
  expect(got.mesh?.meshName).toBe(meshName);
  expect(got.mesh?.metadata?.arn).toBe(created.mesh?.metadata?.arn);

  const listed = await client.send(new ListMeshesCommand({}));
  expect((listed.meshes ?? []).map((m) => m.meshName)).toContain(meshName);

  await client.send(new DeleteMeshCommand({ meshName }));
  await expect(
    client.send(new DescribeMeshCommand({ meshName })),
  ).rejects.toThrow();
});
