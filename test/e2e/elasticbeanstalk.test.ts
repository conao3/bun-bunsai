import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateApplicationCommand,
  CreateEnvironmentCommand,
  DeleteApplicationCommand,
  DescribeApplicationsCommand,
  DescribeEnvironmentsCommand,
  ElasticBeanstalkClient,
  TerminateEnvironmentCommand,
} from "@aws-sdk/client-elastic-beanstalk";

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

const eb = () => new ElasticBeanstalkClient({ endpoint, region, credentials });

test("Elastic Beanstalk application and environment lifecycle round-trip", async () => {
  const client = eb();
  const applicationName = "bunsai-e2e-app";
  const environmentName = "bunsai-e2e-env";

  const created = await client.send(
    new CreateApplicationCommand({
      ApplicationName: applicationName,
      Description: "bunsai e2e application",
    }),
  );
  expect(created.Application?.ApplicationName).toBe(applicationName);
  expect(created.Application?.Description).toBe("bunsai e2e application");
  expect(created.Application?.ApplicationArn).toContain(applicationName);

  const describedApps = await client.send(
    new DescribeApplicationsCommand({
      ApplicationNames: [applicationName],
    }),
  );
  expect(describedApps.Applications?.length).toBe(1);
  expect(describedApps.Applications?.[0]?.ApplicationName).toBe(
    applicationName,
  );

  const createdEnv = await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: applicationName,
      EnvironmentName: environmentName,
      SolutionStackName: "64bit Amazon Linux 2 v3.0.0 running Python 3.8",
    }),
  );
  expect(createdEnv.EnvironmentName).toBe(environmentName);
  expect(createdEnv.ApplicationName).toBe(applicationName);
  expect(createdEnv.Status).toBe("Ready");
  expect(createdEnv.EnvironmentId).toBeDefined();

  const describedEnvs = await client.send(
    new DescribeEnvironmentsCommand({
      ApplicationName: applicationName,
      EnvironmentNames: [environmentName],
    }),
  );
  expect(describedEnvs.Environments?.length).toBe(1);
  expect(describedEnvs.Environments?.[0]?.Status).toBe("Ready");

  const terminated = await client.send(
    new TerminateEnvironmentCommand({
      EnvironmentName: environmentName,
    }),
  );
  expect(terminated.Status).toBe("Terminated");

  await client.send(
    new DeleteApplicationCommand({
      ApplicationName: applicationName,
      TerminateEnvByForce: true,
    }),
  );

  const afterDelete = await client.send(
    new DescribeApplicationsCommand({
      ApplicationNames: [applicationName],
    }),
  );
  expect(afterDelete.Applications?.length).toBe(0);
});
