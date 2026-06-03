import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AccessAnalyzerClient,
  CreateAnalyzerCommand,
  DeleteAnalyzerCommand,
  GetAnalyzerCommand,
  ListAnalyzersCommand,
} from "@aws-sdk/client-accessanalyzer";

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

const accessanalyzer = () =>
  new AccessAnalyzerClient({ endpoint, region, credentials });

test("AccessAnalyzer analyzer roundtrip", async () => {
  const client = accessanalyzer();
  const name = `bunsai_e2e_${Date.now()}`;

  const created = await client.send(
    new CreateAnalyzerCommand({ analyzerName: name, type: "ACCOUNT" }),
  );
  expect(created.arn).toContain(`analyzer/${name}`);

  const got = await client.send(new GetAnalyzerCommand({ analyzerName: name }));
  expect(got.analyzer?.name).toBe(name);
  expect(got.analyzer?.type).toBe("ACCOUNT");
  expect(got.analyzer?.status).toBe("ACTIVE");
  expect(got.analyzer?.arn).toBe(created.arn);

  const listed = await client.send(new ListAnalyzersCommand({}));
  expect((listed.analyzers ?? []).map((a) => a.name)).toContain(name);

  await client.send(new DeleteAnalyzerCommand({ analyzerName: name }));
  await expect(
    client.send(new GetAnalyzerCommand({ analyzerName: name })),
  ).rejects.toThrow();
});
