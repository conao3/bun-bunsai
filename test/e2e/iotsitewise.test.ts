import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CreateAssetModelCommand,
  DeleteAssetModelCommand,
  DescribeAssetModelCommand,
  IoTSiteWiseClient,
  ListAssetModelsCommand,
} from "@aws-sdk/client-iotsitewise";

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

const iotsitewise = () =>
  new IoTSiteWiseClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("IoTSiteWise asset model roundtrip", async () => {
  const client = iotsitewise();
  const modelName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateAssetModelCommand({
      assetModelName: modelName,
      assetModelDescription: "bunsai e2e asset model",
    }),
  );
  expect(created.assetModelId).toBeDefined();
  expect(created.assetModelArn).toBeDefined();
  expect(created.assetModelStatus?.state).toBe("CREATING");
  const assetModelId = created.assetModelId ?? "";

  const described = await client.send(
    new DescribeAssetModelCommand({ assetModelId }),
  );
  expect(described.assetModelId).toBe(assetModelId);
  expect(described.assetModelName).toBe(modelName);
  expect(described.assetModelDescription).toBe("bunsai e2e asset model");
  expect(described.assetModelStatus?.state).toBe("CREATING");

  const listed = await client.send(new ListAssetModelsCommand({}));
  expect(
    (listed.assetModelSummaries ?? []).map((summary) => summary.id),
  ).toContain(assetModelId);

  const deleted = await client.send(
    new DeleteAssetModelCommand({ assetModelId }),
  );
  expect(deleted.assetModelStatus?.state).toBe("DELETING");

  await expect(
    client.send(new DescribeAssetModelCommand({ assetModelId })),
  ).rejects.toThrow();
});
