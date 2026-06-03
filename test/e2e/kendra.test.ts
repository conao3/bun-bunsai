import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateIndexCommand,
  DeleteIndexCommand,
  DescribeIndexCommand,
  KendraClient,
  ListIndicesCommand,
} from "@aws-sdk/client-kendra";
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

const kendra = () =>
  new KendraClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Kendra index lifecycle", async () => {
  const client = kendra();

  const created = await client.send(
    new CreateIndexCommand({
      Name: "bunsai-e2e-index",
      RoleArn: "arn:aws:iam::000000000000:role/bunsai-kendra",
    }),
  );
  const id = created.Id;
  expect(typeof id).toBe("string");

  const described = await client.send(new DescribeIndexCommand({ Id: id }));
  expect(described.Name).toBe("bunsai-e2e-index");
  expect(described.Status).toBe("ACTIVE");
  expect(described.Id).toBe(id);

  const listed = await client.send(new ListIndicesCommand({}));
  expect(
    (listed.IndexConfigurationSummaryItems ?? []).some((i) => i.Id === id),
  ).toBe(true);

  await client.send(new DeleteIndexCommand({ Id: id }));

  const afterDelete = await client.send(new ListIndicesCommand({}));
  expect(
    (afterDelete.IndexConfigurationSummaryItems ?? []).some((i) => i.Id === id),
  ).toBe(false);
});
