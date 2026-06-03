import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateGraphCommand,
  DeleteGraphCommand,
  DetectiveClient,
  ListGraphsCommand,
} from "@aws-sdk/client-detective";
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

const detective = () =>
  new DetectiveClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Detective graph roundtrip", async () => {
  const client = detective();

  const created = await client.send(new CreateGraphCommand({}));
  expect(created.GraphArn).toContain(":graph:");

  const listed = await client.send(new ListGraphsCommand({}));
  expect((listed.GraphList ?? []).map((g) => g.Arn)).toContain(
    created.GraphArn,
  );

  await client.send(new DeleteGraphCommand({ GraphArn: created.GraphArn }));

  const afterDelete = await client.send(new ListGraphsCommand({}));
  expect((afterDelete.GraphList ?? []).map((g) => g.Arn)).not.toContain(
    created.GraphArn,
  );

  await expect(
    client.send(new DeleteGraphCommand({ GraphArn: created.GraphArn })),
  ).rejects.toThrow();
});
