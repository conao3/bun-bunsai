import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateContainerCommand,
  DeleteContainerCommand,
  DescribeContainerCommand,
  ListContainersCommand,
  MediaStoreClient,
} from "@aws-sdk/client-mediastore";
import { NodeHttpHandler } from "@smithy/node-http-handler";

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

const mediastore = () =>
  new MediaStoreClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("MediaStore container lifecycle", async () => {
  const client = mediastore();
  const name = "bunsai-e2e-container";

  const created = await client.send(
    new CreateContainerCommand({ ContainerName: name }),
  );
  expect(created.Container?.Name).toBe(name);
  expect(created.Container?.Status).toBe("ACTIVE");
  expect(created.Container?.ARN).toContain(name);
  expect(created.Container?.Endpoint).toContain(name);

  const described = await client.send(
    new DescribeContainerCommand({ ContainerName: name }),
  );
  expect(described.Container?.Name).toBe(name);
  expect(described.Container?.Status).toBe("ACTIVE");

  const listed = await client.send(new ListContainersCommand({}));
  expect((listed.Containers ?? []).some((c) => c.Name === name)).toBe(true);

  await client.send(new DeleteContainerCommand({ ContainerName: name }));

  const afterDelete = await client.send(new ListContainersCommand({}));
  expect((afterDelete.Containers ?? []).some((c) => c.Name === name)).toBe(
    false,
  );
});
