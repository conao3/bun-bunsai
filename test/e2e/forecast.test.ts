import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateDatasetCommand,
  DeleteDatasetCommand,
  DescribeDatasetCommand,
  ForecastClient,
  ListDatasetsCommand,
} from "@aws-sdk/client-forecast";
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

const forecast = () =>
  new ForecastClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Forecast dataset lifecycle", async () => {
  const client = forecast();
  const DatasetName = "bunsai_e2e_dataset";

  const created = await client.send(
    new CreateDatasetCommand({
      DatasetName,
      Domain: "CUSTOM",
      DatasetType: "TARGET_TIME_SERIES",
      Schema: {
        Attributes: [
          { AttributeName: "timestamp", AttributeType: "timestamp" },
          { AttributeName: "target_value", AttributeType: "float" },
        ],
      },
    }),
  );
  const DatasetArn = created.DatasetArn;
  expect(typeof DatasetArn).toBe("string");

  const listed = await client.send(new ListDatasetsCommand({}));
  const arns = (listed.Datasets ?? []).map((d) => d.DatasetArn);
  expect(arns).toContain(DatasetArn);

  const described = await client.send(
    new DescribeDatasetCommand({ DatasetArn: DatasetArn as string }),
  );
  expect(described.DatasetArn).toBe(DatasetArn);
  expect(described.DatasetName).toBe(DatasetName);
  expect(described.Status).toBe("ACTIVE");

  await client.send(
    new DeleteDatasetCommand({ DatasetArn: DatasetArn as string }),
  );

  const afterDelete = await client.send(new ListDatasetsCommand({}));
  const afterArns = (afterDelete.Datasets ?? []).map((d) => d.DatasetArn);
  expect(afterArns).not.toContain(DatasetArn);
});
