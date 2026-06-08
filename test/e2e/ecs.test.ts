import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateClusterCommand,
  CreateServiceCommand,
  DeleteClusterCommand,
  DeleteServiceCommand,
  DescribeClustersCommand,
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
  DescribeTasksCommand,
  ECSClient,
  ListClustersCommand,
  ListTasksCommand,
  RegisterTaskDefinitionCommand,
  RunTaskCommand,
  StopTaskCommand,
  UpdateServiceCommand,
} from "@aws-sdk/client-ecs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ecs e2e", () => {
  const ecs = () =>
    new ECSClient({ endpoint, region, credentials, requestHandler });

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
    const taskArn = task?.taskArn ?? "";
    expect(task?.taskArn).toBeDefined();
    expect(task?.lastStatus).toBe("PENDING");
    expect(task?.taskDefinitionArn).toBe(taskDefArn);

    const described = await client.send(
      new DescribeTasksCommand({ cluster: clusterName, tasks: [taskArn] }),
    );
    const describedTask = (described.tasks ?? [])[0];
    expect(describedTask?.lastStatus).toBe("RUNNING");
    const describedContainer = (describedTask?.containers ?? [])[0];
    expect(describedContainer?.lastStatus).toBe("RUNNING");

    const listed = await client.send(
      new ListTasksCommand({ cluster: clusterName }),
    );
    expect(listed.taskArns ?? []).toContain(taskArn);

    const stopped = await client.send(
      new StopTaskCommand({
        cluster: clusterName,
        task: taskArn,
        reason: "test",
      }),
    );
    expect(stopped.task?.lastStatus).toBe("STOPPED");
    expect(stopped.task?.desiredStatus).toBe("STOPPED");
    expect(stopped.task?.stoppedReason).toBe("test");

    await client.send(new DeleteClusterCommand({ cluster: clusterName }));
  });

  test("service desiredCount reconciles running tasks", async () => {
    const client = ecs();
    const clusterName = "bunsai-e2e-svc-cluster";
    const family = "bunsai-e2e-svc-family";
    const serviceName = "bunsai-e2e-svc";

    await client.send(new CreateClusterCommand({ clusterName }));
    await client.send(
      new RegisterTaskDefinitionCommand({
        family,
        containerDefinitions: [
          { name: "app", image: "nginx:latest", memory: 128, essential: true },
        ],
      }),
    );

    const created = await client.send(
      new CreateServiceCommand({
        cluster: clusterName,
        serviceName,
        taskDefinition: family,
        desiredCount: 2,
      }),
    );
    expect(created.service?.serviceName).toBe(serviceName);
    expect(created.service?.desiredCount).toBe(2);
    expect(created.service?.runningCount).toBe(2);

    const described = await client.send(
      new DescribeServicesCommand({
        cluster: clusterName,
        services: [serviceName],
      }),
    );
    const svc = (described.services ?? [])[0];
    expect(svc?.runningCount).toBe(2);

    const listed = await client.send(
      new ListTasksCommand({ cluster: clusterName, serviceName }),
    );
    expect((listed.taskArns ?? []).length).toBe(2);

    const updated = await client.send(
      new UpdateServiceCommand({
        cluster: clusterName,
        service: serviceName,
        desiredCount: 1,
      }),
    );
    expect(updated.service?.desiredCount).toBe(1);
    expect(updated.service?.runningCount).toBe(1);

    const described2 = await client.send(
      new DescribeServicesCommand({
        cluster: clusterName,
        services: [serviceName],
      }),
    );
    expect((described2.services ?? [])[0]?.runningCount).toBe(1);

    const listed2 = await client.send(
      new ListTasksCommand({ cluster: clusterName, serviceName }),
    );
    expect((listed2.taskArns ?? []).length).toBe(1);

    await client.send(
      new DeleteServiceCommand({ cluster: clusterName, service: serviceName }),
    );

    const listed3 = await client.send(
      new ListTasksCommand({ cluster: clusterName, serviceName }),
    );
    expect((listed3.taskArns ?? []).length).toBe(0);

    await client.send(new DeleteClusterCommand({ cluster: clusterName }));
  });
});
