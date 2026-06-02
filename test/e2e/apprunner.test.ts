import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AppRunnerClient,
  CreateServiceCommand,
  DeleteServiceCommand,
  DescribeServiceCommand,
  ListServicesCommand,
  PauseServiceCommand,
  ResumeServiceCommand,
} from "@aws-sdk/client-apprunner";
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

const apprunner = () =>
  new AppRunnerClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("AppRunner service lifecycle", async () => {
  const client = apprunner();
  const serviceName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateServiceCommand({
      ServiceName: serviceName,
      SourceConfiguration: {
        ImageRepository: {
          ImageIdentifier:
            "public.ecr.aws/aws-containers/hello-app-runner:latest",
          ImageRepositoryType: "ECR_PUBLIC",
        },
      },
    }),
  );
  const arn = created.Service?.ServiceArn;
  expect(arn).toBeDefined();
  expect(created.Service?.ServiceName).toBe(serviceName);
  expect(created.Service?.ServiceId).toBeDefined();
  expect(created.Service?.ServiceUrl).toContain("awsapprunner.com");
  expect(created.Service?.Status).toBe("RUNNING");
  expect(created.OperationId).toBeDefined();

  const described = await client.send(
    new DescribeServiceCommand({ ServiceArn: arn }),
  );
  expect(described.Service?.ServiceArn).toBe(arn);
  expect(described.Service?.Status).toBe("RUNNING");

  const listed = await client.send(new ListServicesCommand({}));
  expect((listed.ServiceSummaryList ?? []).map((s) => s.ServiceArn)).toContain(
    arn,
  );

  const paused = await client.send(
    new PauseServiceCommand({ ServiceArn: arn }),
  );
  expect(paused.Service?.Status).toBe("PAUSED");

  const resumed = await client.send(
    new ResumeServiceCommand({ ServiceArn: arn }),
  );
  expect(resumed.Service?.Status).toBe("RUNNING");

  const deleted = await client.send(
    new DeleteServiceCommand({ ServiceArn: arn }),
  );
  expect(deleted.Service?.ServiceArn).toBe(arn);
  await expect(
    client.send(new DescribeServiceCommand({ ServiceArn: arn })),
  ).rejects.toThrow();
});
