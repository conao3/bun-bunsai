import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateBotCommand,
  DeleteBotCommand,
  DescribeBotCommand,
  LexModelsV2Client,
  ListBotsCommand,
} from "@aws-sdk/client-lex-models-v2";
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

const lex = () =>
  new LexModelsV2Client({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Lex v2 bot lifecycle", async () => {
  const client = lex();
  const botName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateBotCommand({
      botName,
      roleArn: "arn:aws:iam::000000000000:role/bunsai-lex",
      dataPrivacy: { childDirected: false },
      idleSessionTTLInSeconds: 300,
    }),
  );
  const botId = created.botId;
  expect(botId).toBeDefined();
  expect(created.botName).toBe(botName);
  expect(created.roleArn).toBe("arn:aws:iam::000000000000:role/bunsai-lex");
  expect(created.idleSessionTTLInSeconds).toBe(300);
  expect(created.botStatus).toBe("Available");

  const described = await client.send(new DescribeBotCommand({ botId }));
  expect(described.botId).toBe(botId);
  expect(described.botName).toBe(botName);
  expect(described.botStatus).toBe("Available");
  expect(described.dataPrivacy?.childDirected).toBe(false);

  const listed = await client.send(new ListBotsCommand({}));
  expect((listed.botSummaries ?? []).map((b) => b.botId)).toContain(botId);

  const deleted = await client.send(new DeleteBotCommand({ botId }));
  expect(deleted.botId).toBe(botId);
  expect(deleted.botStatus).toBe("Deleting");

  await expect(
    client.send(new DescribeBotCommand({ botId })),
  ).rejects.toThrow();
});
