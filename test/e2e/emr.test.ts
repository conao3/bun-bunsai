import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AddJobFlowStepsCommand,
  DescribeClusterCommand,
  EMRClient,
  ListClustersCommand,
  RunJobFlowCommand,
  TerminateJobFlowsCommand,
} from "@aws-sdk/client-emr";
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

const emr = () =>
  new EMRClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("EMR job flow lifecycle", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "bunsai-e2e-emr",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const id = run.JobFlowId;
  expect(id).toBeTruthy();
  expect(run.ClusterArn).toContain(id ?? "");

  const described = await client.send(
    new DescribeClusterCommand({ ClusterId: id }),
  );
  expect(described.Cluster?.Name).toBe("bunsai-e2e-emr");
  expect(described.Cluster?.Status?.State).toBe("WAITING");

  const steps = await client.send(
    new AddJobFlowStepsCommand({
      JobFlowId: id,
      Steps: [{ Name: "step1", HadoopJarStep: { Jar: "command-runner.jar" } }],
    }),
  );
  expect((steps.StepIds ?? []).length).toBe(1);

  const listed = await client.send(new ListClustersCommand({}));
  expect((listed.Clusters ?? []).some((c) => c.Id === id)).toBe(true);

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [id ?? ""] }));
});
