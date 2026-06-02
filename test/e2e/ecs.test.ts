import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateClusterCommand,
  DeleteClusterCommand,
  DescribeClustersCommand,
  DescribeTaskDefinitionCommand,
  ECSClient,
  ListClustersCommand,
  ListTasksCommand,
  RegisterTaskDefinitionCommand,
  RunTaskCommand,
  StopTaskCommand,
} from "@aws-sdk/client-ecs";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

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

describe("ecs e2e", () => {
  let proc: ReturnType<typeof spawn> | undefined;

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

  const ecs = () => new ECSClient({ endpoint, region, credentials });

  test("create, describe, list and delete cluster", async () => {
    const client = ecs();
    const name = "bunsai-e2e-cluster";

    const created = await client.send(
      new CreateClusterCommand({ clusterName: name }),
    );
    expect(created.cluster?.clusterName).toBe(name);
    expect(created.cluster?.clusterArn).toContain(name);
    expect(created.cluster?.status).toBe("ACTIVE");

    const described = await client.send(
      new DescribeClustersCommand({ clusters: [name] }),
    );
    const names = (described.clusters ?? []).map((c) => c.clusterName);
    expect(names).toContain(name);

    const listed = await client.send(new ListClustersCommand({}));
    expect((listed.clusterArns ?? []).some((arn) => arn.includes(name))).toBe(
      true,
    );

    const deleted = await client.send(
      new DeleteClusterCommand({ cluster: name }),
    );
    expect(deleted.cluster?.status).toBe("INACTIVE");

    const missing = await client.send(
      new DescribeClustersCommand({ clusters: [name] }),
    );
    expect((missing.failures ?? [])[0]?.reason).toBe("MISSING");
  });

  test("register, describe task definition and run, list, stop task", async () => {
    const client = ecs();
    const clusterName = "bunsai-e2e-tasks";
    const family = "bunsai-e2e-family";

    await client.send(new CreateClusterCommand({ clusterName }));

    const registered = await client.send(
      new RegisterTaskDefinitionCommand({
        family,
        containerDefinitions: [
          {
            name: "app",
            image: "public.ecr.aws/nginx/nginx:latest",
            memory: 128,
            essential: true,
          },
        ],
      }),
    );
    expect(registered.taskDefinition?.family).toBe(family);
    expect(registered.taskDefinition?.revision).toBe(1);
    const taskDefArn = registered.taskDefinition?.taskDefinitionArn;
    expect(taskDefArn).toContain(`${family}:1`);

    const describedTaskDef = await client.send(
      new DescribeTaskDefinitionCommand({ taskDefinition: `${family}:1` }),
    );
    expect(describedTaskDef.taskDefinition?.taskDefinitionArn).toBe(taskDefArn);

    const run = await client.send(
      new RunTaskCommand({
        cluster: clusterName,
        taskDefinition: family,
        count: 1,
      }),
    );
    const task = (run.tasks ?? [])[0];
    expect(task?.taskArn).toBeDefined();
    expect(task?.lastStatus).toBe("PENDING");
    expect(task?.taskDefinitionArn).toBe(taskDefArn);

    const listed = await client.send(
      new ListTasksCommand({ cluster: clusterName }),
    );
    expect(listed.taskArns ?? []).toContain(task?.taskArn);

    const stopped = await client.send(
      new StopTaskCommand({
        cluster: clusterName,
        task: task?.taskArn ?? "",
        reason: "test",
      }),
    );
    expect(stopped.task?.lastStatus).toBe("STOPPED");
    expect(stopped.task?.desiredStatus).toBe("STOPPED");

    await client.send(new DeleteClusterCommand({ cluster: clusterName }));
  });
});
