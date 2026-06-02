import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CloudTrailClient,
  CreateTrailCommand,
  DeleteTrailCommand,
  DescribeTrailsCommand,
  GetTrailCommand,
  GetTrailStatusCommand,
  ListTrailsCommand,
  StartLoggingCommand,
  StopLoggingCommand,
} from "@aws-sdk/client-cloudtrail";
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

const cloudtrail = () =>
  new CloudTrailClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("CloudTrail trail lifecycle and logging status", async () => {
  const client = cloudtrail();
  const trailName = "bunsai-e2e-trail";

  const created = await client.send(
    new CreateTrailCommand({
      Name: trailName,
      S3BucketName: "bunsai-e2e-bucket",
      IsMultiRegionTrail: true,
    }),
  );
  expect(created.Name).toBe(trailName);
  expect(created.S3BucketName).toBe("bunsai-e2e-bucket");
  expect(created.TrailARN).toContain(trailName);
  expect(created.IsMultiRegionTrail).toBe(true);

  const got = await client.send(new GetTrailCommand({ Name: trailName }));
  expect(got.Trail?.Name).toBe(trailName);
  expect(got.Trail?.HomeRegion).toBe(region);

  const listed = await client.send(new ListTrailsCommand({}));
  expect((listed.Trails ?? []).map((trail) => trail.Name)).toContain(trailName);

  const described = await client.send(
    new DescribeTrailsCommand({ trailNameList: [trailName] }),
  );
  expect((described.trailList ?? []).map((trail) => trail.Name)).toContain(
    trailName,
  );

  const beforeLogging = await client.send(
    new GetTrailStatusCommand({ Name: trailName }),
  );
  expect(beforeLogging.IsLogging).toBe(false);

  await client.send(new StartLoggingCommand({ Name: trailName }));
  const logging = await client.send(
    new GetTrailStatusCommand({ Name: trailName }),
  );
  expect(logging.IsLogging).toBe(true);

  await client.send(new StopLoggingCommand({ Name: trailName }));
  const stopped = await client.send(
    new GetTrailStatusCommand({ Name: trailName }),
  );
  expect(stopped.IsLogging).toBe(false);

  await client.send(new DeleteTrailCommand({ Name: trailName }));
  const afterDelete = await client.send(new ListTrailsCommand({}));
  expect((afterDelete.Trails ?? []).map((trail) => trail.Name)).not.toContain(
    trailName,
  );
});
