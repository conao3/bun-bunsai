import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateClusterCommand,
  CreateServiceCommand,
  DeleteClusterCommand,
  DeleteServiceCommand,
  DeregisterTaskDefinitionCommand,
  DescribeClustersCommand,
  DescribeServicesCommand,
  DescribeTasksCommand,
  ECSClient,
  ListTasksCommand,
  RegisterTaskDefinitionCommand,
  RunTaskCommand,
  StopTaskCommand,
  UpdateServiceCommand,
} from "@aws-sdk/client-ecs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ecs = () =>
  new ECSClient({ endpoint, region, credentials, requestHandler });

test("ECS container service deployment lifecycle", async () => {
  const client = ecs();
  const clusterName = "ecs-scenario-cluster";
  const family = "ecs-scenario-family";
  const serviceName = "ecs-scenario-service";

  const created = await client.send(new CreateClusterCommand({ clusterName }));
  expect(created.cluster?.clusterArn).toContain(clusterName);
  expect(created.cluster?.status).toBe("ACTIVE");

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
  expect(registered.taskDefinition?.taskDefinitionArn).toContain(`${family}:1`);
  const taskDefArn = registered.taskDefinition?.taskDefinitionArn ?? "";

  const createdSvc = await client.send(
    new CreateServiceCommand({
      cluster: clusterName,
      serviceName,
      taskDefinition: family,
      desiredCount: 2,
    }),
  );
  expect(createdSvc.service?.serviceArn).toContain(serviceName);
  expect(createdSvc.service?.desiredCount).toBe(2);

  const describedSvc = await client.send(
    new DescribeServicesCommand({
      cluster: clusterName,
      services: [serviceName],
    }),
  );
  expect((describedSvc.services ?? [])[0]?.runningCount).toBe(2);

  const updatedSvc = await client.send(
    new UpdateServiceCommand({
      cluster: clusterName,
      service: serviceName,
      desiredCount: 1,
    }),
  );
  expect(updatedSvc.service?.desiredCount).toBe(1);
  expect(updatedSvc.service?.runningCount).toBe(1);

  const describedSvc2 = await client.send(
    new DescribeServicesCommand({
      cluster: clusterName,
      services: [serviceName],
    }),
  );
  expect((describedSvc2.services ?? [])[0]?.runningCount).toBe(1);

  const ran = await client.send(
    new RunTaskCommand({
      cluster: clusterName,
      taskDefinition: family,
    }),
  );
  const standaloneTask = (ran.tasks ?? [])[0];
  const standaloneArn = standaloneTask?.taskArn ?? "";
  expect(standaloneArn).toBeTruthy();
  expect(standaloneTask?.lastStatus).toBe("PENDING");

  const describedTasks = await client.send(
    new DescribeTasksCommand({ cluster: clusterName, tasks: [standaloneArn] }),
  );
  expect((describedTasks.tasks ?? [])[0]?.lastStatus).toBe("RUNNING");

  const listedAll = await client.send(
    new ListTasksCommand({ cluster: clusterName }),
  );
  const allArns = listedAll.taskArns ?? [];
  expect(allArns).toContain(standaloneArn);
  expect(allArns.length).toBeGreaterThanOrEqual(2);

  const stopped = await client.send(
    new StopTaskCommand({
      cluster: clusterName,
      task: standaloneArn,
      reason: "scenario-stop",
    }),
  );
  expect(stopped.task?.lastStatus).toBe("STOPPED");
  expect(stopped.task?.desiredStatus).toBe("STOPPED");
  expect(stopped.task?.stoppedReason).toBe("scenario-stop");

  const deletedSvc = await client.send(
    new DeleteServiceCommand({ cluster: clusterName, service: serviceName }),
  );
  expect(deletedSvc.service?.status).toBe("DRAINING");

  const listedSvcTasks = await client.send(
    new ListTasksCommand({ cluster: clusterName, serviceName }),
  );
  expect((listedSvcTasks.taskArns ?? []).length).toBe(0);

  const deregistered = await client.send(
    new DeregisterTaskDefinitionCommand({ taskDefinition: taskDefArn }),
  );
  expect(deregistered.taskDefinition?.status).toBe("INACTIVE");

  const guardRun = await client.send(
    new RunTaskCommand({ cluster: clusterName, taskDefinition: `${family}:1` }),
  );
  const guardTaskArn = (guardRun.tasks ?? [])[0]?.taskArn ?? "";

  await expect(
    client.send(new DeleteClusterCommand({ cluster: clusterName })),
  ).rejects.toMatchObject({ name: "ClusterContainsTasksException" });

  await client.send(
    new StopTaskCommand({ cluster: clusterName, task: guardTaskArn }),
  );

  const deletedCluster = await client.send(
    new DeleteClusterCommand({ cluster: clusterName }),
  );
  expect(deletedCluster.cluster?.status).toBe("INACTIVE");

  const missing = await client.send(
    new DescribeClustersCommand({ clusters: [clusterName] }),
  );
  expect((missing.failures ?? [])[0]?.reason).toBe("MISSING");
});
