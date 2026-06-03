import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateKnowledgeBaseCommand,
  DeleteKnowledgeBaseCommand,
  GetKnowledgeBaseCommand,
  ListKnowledgeBasesCommand,
  WisdomClient,
} from "@aws-sdk/client-wisdom";
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

const wisdom = () =>
  new WisdomClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Wisdom knowledge base create, get, list and delete lifecycle", async () => {
  const client = wisdom();
  const name = "bunsai-e2e-knowledge-base";

  const created = await client.send(
    new CreateKnowledgeBaseCommand({
      name,
      knowledgeBaseType: "CUSTOM",
    }),
  );
  const knowledgeBaseId = created.knowledgeBase?.knowledgeBaseId;
  expect(knowledgeBaseId).toBeDefined();
  expect(created.knowledgeBase?.name).toBe(name);
  expect(created.knowledgeBase?.knowledgeBaseType).toBe("CUSTOM");
  expect(created.knowledgeBase?.knowledgeBaseArn).toContain("knowledge-base/");
  expect(created.knowledgeBase?.status).toBe("ACTIVE");

  const fetched = await client.send(
    new GetKnowledgeBaseCommand({ knowledgeBaseId }),
  );
  expect(fetched.knowledgeBase?.knowledgeBaseId).toBe(knowledgeBaseId);
  expect(fetched.knowledgeBase?.name).toBe(name);

  const listed = await client.send(new ListKnowledgeBasesCommand({}));
  const ids = (listed.knowledgeBaseSummaries ?? []).map(
    (summary) => summary.knowledgeBaseId,
  );
  expect(ids).toContain(knowledgeBaseId);

  await client.send(new DeleteKnowledgeBaseCommand({ knowledgeBaseId }));
  const afterDelete = await client.send(new ListKnowledgeBasesCommand({}));
  const afterIds = (afterDelete.knowledgeBaseSummaries ?? []).map(
    (summary) => summary.knowledgeBaseId,
  );
  expect(afterIds).not.toContain(knowledgeBaseId);
});
