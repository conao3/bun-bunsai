import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateEnvironmentCommand,
  DeleteEnvironmentCommand,
  GetEnvironmentCommand,
  ListEnvironmentsCommand,
  MWAAClient,
} from "@aws-sdk/client-mwaa";
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

const mwaa = () =>
  new MWAAClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("MWAA environment roundtrip", async () => {
  const client = mwaa();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateEnvironmentCommand({
      Name: name,
      DagS3Path: "dags",
      ExecutionRoleArn: `arn:aws:iam::000000000000:role/${name}-exec`,
      SourceBucketArn: `arn:aws:s3:::${name}-bucket`,
      NetworkConfiguration: {
        SubnetIds: ["subnet-11111111", "subnet-22222222"],
        SecurityGroupIds: ["sg-11111111"],
      },
    }),
  );
  expect(created.Arn).toContain(`environment/${name}`);

  const got = await client.send(new GetEnvironmentCommand({ Name: name }));
  expect(got.Environment?.Name).toBe(name);
  expect(got.Environment?.Status).toBe("AVAILABLE");
  expect(got.Environment?.Arn).toBe(created.Arn);
  expect(got.Environment?.DagS3Path).toBe("dags");
  expect(got.Environment?.SourceBucketArn).toBe(`arn:aws:s3:::${name}-bucket`);
  expect(got.Environment?.NetworkConfiguration?.SubnetIds).toEqual([
    "subnet-11111111",
    "subnet-22222222",
  ]);

  const listed = await client.send(new ListEnvironmentsCommand({}));
  expect(listed.Environments ?? []).toContain(name);

  await client.send(new DeleteEnvironmentCommand({ Name: name }));

  await expect(
    client.send(new GetEnvironmentCommand({ Name: name })),
  ).rejects.toThrow();
});
