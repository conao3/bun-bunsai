import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreatePipelineCommand,
  DataPipelineClient,
  DeletePipelineCommand,
  DescribePipelinesCommand,
  ListPipelinesCommand,
} from "@aws-sdk/client-data-pipeline";
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

const datapipeline = () =>
  new DataPipelineClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Data Pipeline lifecycle", async () => {
  const client = datapipeline();
  const name = "bunsai-e2e-pipeline";
  const uniqueId = "bunsai-e2e-unique";

  const created = await client.send(
    new CreatePipelineCommand({
      name,
      uniqueId,
      description: "bunsai e2e pipeline",
    }),
  );
  const pipelineId = created.pipelineId;
  expect(typeof pipelineId).toBe("string");

  const listed = await client.send(new ListPipelinesCommand({}));
  const ids = (listed.pipelineIdList ?? []).map((p) => p.id);
  expect(ids).toContain(pipelineId);

  const described = await client.send(
    new DescribePipelinesCommand({ pipelineIds: [pipelineId as string] }),
  );
  const descriptions = described.pipelineDescriptionList ?? [];
  expect(descriptions.length).toBe(1);
  expect(descriptions[0]?.pipelineId).toBe(pipelineId);
  expect(descriptions[0]?.name).toBe(name);

  await client.send(
    new DeletePipelineCommand({ pipelineId: pipelineId as string }),
  );

  const afterDelete = await client.send(new ListPipelinesCommand({}));
  const afterIds = (afterDelete.pipelineIdList ?? []).map((p) => p.id);
  expect(afterIds).not.toContain(pipelineId);
});
