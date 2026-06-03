import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CreateDataSetCommand,
  DataExchangeClient,
  DeleteDataSetCommand,
  GetDataSetCommand,
  ListDataSetsCommand,
  UpdateDataSetCommand,
} from "@aws-sdk/client-dataexchange";

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

const dataexchange = () =>
  new DataExchangeClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("DataExchange data set roundtrip", async () => {
  const client = dataexchange();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateDataSetCommand({
      AssetType: "S3_SNAPSHOT",
      Description: "bunsai e2e data set",
      Name: name,
    }),
  );
  expect(created.Id).toBeDefined();
  expect(created.Arn).toBeDefined();
  expect(created.Name).toBe(name);
  expect(created.AssetType).toBe("S3_SNAPSHOT");
  const dataSetId = created.Id ?? "";

  const got = await client.send(
    new GetDataSetCommand({ DataSetId: dataSetId }),
  );
  expect(got.Id).toBe(dataSetId);
  expect(got.Name).toBe(name);
  expect(got.Description).toBe("bunsai e2e data set");

  const listed = await client.send(new ListDataSetsCommand({}));
  expect((listed.DataSets ?? []).map((d) => d.Id)).toContain(dataSetId);

  const updated = await client.send(
    new UpdateDataSetCommand({
      DataSetId: dataSetId,
      Description: "updated description",
    }),
  );
  expect(updated.Description).toBe("updated description");
  expect(updated.Name).toBe(name);

  await client.send(new DeleteDataSetCommand({ DataSetId: dataSetId }));
  await expect(
    client.send(new GetDataSetCommand({ DataSetId: dataSetId })),
  ).rejects.toThrow();
});
