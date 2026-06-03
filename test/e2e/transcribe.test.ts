import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  DeleteTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  ListTranscriptionJobsCommand,
  StartTranscriptionJobCommand,
  TranscribeClient,
} from "@aws-sdk/client-transcribe";
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

const transcribe = () =>
  new TranscribeClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Transcribe transcription job lifecycle", async () => {
  const client = transcribe();
  const name = "bunsai-e2e-job";

  const started = await client.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: name,
      Media: { MediaFileUri: "s3://bunsai-e2e/sample.flac" },
    }),
  );
  expect(started.TranscriptionJob?.TranscriptionJobName).toBe(name);
  expect(started.TranscriptionJob?.TranscriptionJobStatus).toBe("COMPLETED");

  const got = await client.send(
    new GetTranscriptionJobCommand({ TranscriptionJobName: name }),
  );
  expect(got.TranscriptionJob?.TranscriptionJobName).toBe(name);
  expect(got.TranscriptionJob?.Transcript?.TranscriptFileUri).toContain(name);

  const listed = await client.send(new ListTranscriptionJobsCommand({}));
  expect(
    (listed.TranscriptionJobSummaries ?? []).some(
      (summary) => summary.TranscriptionJobName === name,
    ),
  ).toBe(true);

  await client.send(
    new DeleteTranscriptionJobCommand({ TranscriptionJobName: name }),
  );
});
