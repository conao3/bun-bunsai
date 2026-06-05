import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  ContinueServiceDeploymentCommand,
  CreateCapacityProviderCommand,
  CreateClusterCommand,
  CreateDaemonCommand,
  CreateExpressGatewayServiceCommand,
  CreateServiceCommand,
  CreateTaskSetCommand,
  DeleteAccountSettingCommand,
  DeleteAttributesCommand,
  DeleteCapacityProviderCommand,
  DeleteClusterCommand,
  DeleteDaemonCommand,
  DeleteDaemonTaskDefinitionCommand,
  DeleteExpressGatewayServiceCommand,
  DeleteServiceCommand,
  DeleteTaskDefinitionsCommand,
  DeleteTaskSetCommand,
  DeregisterContainerInstanceCommand,
  DeregisterTaskDefinitionCommand,
  DescribeCapacityProvidersCommand,
  DescribeContainerInstancesCommand,
  DescribeDaemonCommand,
  DescribeDaemonTaskDefinitionCommand,
  DescribeExpressGatewayServiceCommand,
  DescribeServicesCommand,
  DescribeTaskSetsCommand,
  DescribeTasksCommand,
  DiscoverPollEndpointCommand,
  ECSClient,
  ExecuteCommandCommand,
  GetTaskProtectionCommand,
  ListAccountSettingsCommand,
  ListAttributesCommand,
  ListContainerInstancesCommand,
  ListDaemonsCommand,
  ListDaemonTaskDefinitionsCommand,
  ListServicesByNamespaceCommand,
  ListServicesCommand,
  ListTagsForResourceCommand,
  ListTaskDefinitionFamiliesCommand,
  ListTaskDefinitionsCommand,
  PutAccountSettingCommand,
  PutAttributesCommand,
  PutClusterCapacityProvidersCommand,
  RegisterContainerInstanceCommand,
  RegisterDaemonTaskDefinitionCommand,
  RegisterTaskDefinitionCommand,
  RunTaskCommand,
  StartTaskCommand,
  StopServiceDeploymentCommand,
  SubmitAttachmentStateChangesCommand,
  SubmitContainerStateChangeCommand,
  SubmitTaskStateChangeCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateCapacityProviderCommand,
  UpdateClusterCommand,
  UpdateClusterSettingsCommand,
  UpdateContainerInstancesStateCommand,
  UpdateDaemonCommand,
  UpdateExpressGatewayServiceCommand,
  UpdateServiceCommand,
  UpdateServicePrimaryTaskSetCommand,
  UpdateTaskProtectionCommand,
  UpdateTaskSetCommand,
} from "@aws-sdk/client-ecs";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ecs service and task definition e2e", () => {
  const ecs = () => new ECSClient({ endpoint, region, credentials });

  test("register, list and deregister task definitions", async () => {
    const client = ecs();
    const family = "bunsai-e2e-td";

    const first = await client.send(
      new RegisterTaskDefinitionCommand({
        family,
        containerDefinitions: [
          { name: "app", image: "nginx:latest", memory: 128 },
        ],
      }),
    );
    expect(first.taskDefinition?.family).toBe(family);
    expect(first.taskDefinition?.revision).toBe(1);

    const second = await client.send(
      new RegisterTaskDefinitionCommand({
        family,
        containerDefinitions: [
          { name: "app", image: "nginx:latest", memory: 128 },
        ],
      }),
    );
    expect(second.taskDefinition?.revision).toBe(2);

    const listed = await client.send(
      new ListTaskDefinitionsCommand({ familyPrefix: family, sort: "DESC" }),
    );
    const arns = listed.taskDefinitionArns ?? [];
    expect(arns.length).toBeGreaterThanOrEqual(2);
    expect(arns[0]).toContain(`${family}:2`);

    const deregistered = await client.send(
      new DeregisterTaskDefinitionCommand({
        taskDefinition: `${family}:1`,
      }),
    );
    expect(deregistered.taskDefinition?.status).toBe("INACTIVE");
    expect(deregistered.taskDefinition?.revision).toBe(1);
  });

  test("create, describe, update, list and delete service", async () => {
    const client = ecs();
    const family = "bunsai-e2e-svc-td";
    const serviceName = "bunsai-e2e-service";

    const td = await client.send(
      new RegisterTaskDefinitionCommand({
        family,
        containerDefinitions: [
          { name: "app", image: "nginx:latest", memory: 128 },
        ],
      }),
    );
    const taskDefinition = td.taskDefinition?.taskDefinitionArn;

    const created = await client.send(
      new CreateServiceCommand({
        serviceName,
        taskDefinition,
        desiredCount: 2,
      }),
    );
    expect(created.service?.serviceName).toBe(serviceName);
    expect(created.service?.status).toBe("ACTIVE");
    expect(created.service?.desiredCount).toBe(2);
    expect(created.service?.serviceArn).toContain(serviceName);

    const described = await client.send(
      new DescribeServicesCommand({ services: [serviceName] }),
    );
    const names = (described.services ?? []).map((s) => s.serviceName);
    expect(names).toContain(serviceName);
    expect(described.failures ?? []).toHaveLength(0);

    const updated = await client.send(
      new UpdateServiceCommand({ service: serviceName, desiredCount: 5 }),
    );
    expect(updated.service?.desiredCount).toBe(5);

    const listed = await client.send(new ListServicesCommand({}));
    const serviceArns = listed.serviceArns ?? [];
    expect(serviceArns.some((arn) => arn.includes(serviceName))).toBe(true);

    const deleted = await client.send(
      new DeleteServiceCommand({ service: serviceName }),
    );
    expect(deleted.service?.status).toBe("DRAINING");

    const missing = await client.send(
      new DescribeServicesCommand({ services: [serviceName] }),
    );
    expect(missing.services ?? []).toHaveLength(0);
    expect((missing.failures ?? []).map((f) => f.reason)).toContain("MISSING");
  });

  test("capacity provider lifecycle", async () => {
    const client = ecs();
    const name = "bunsai-e2e-cp";

    const created = await client.send(
      new CreateCapacityProviderCommand({ name }),
    );
    expect(created.capacityProvider?.name).toBe(name);
    expect(created.capacityProvider?.status).toBe("ACTIVE");
    expect(created.capacityProvider?.capacityProviderArn).toContain(name);

    const described = await client.send(
      new DescribeCapacityProvidersCommand({ capacityProviders: [name] }),
    );
    expect((described.capacityProviders ?? []).map((c) => c.name)).toContain(
      name,
    );

    const updated = await client.send(
      new UpdateCapacityProviderCommand({ name }),
    );
    expect(updated.capacityProvider?.name).toBe(name);

    const deleted = await client.send(
      new DeleteCapacityProviderCommand({ capacityProvider: name }),
    );
    expect(deleted.capacityProvider?.status).toBe("INACTIVE");
  });

  test("account settings lifecycle", async () => {
    const client = ecs();

    const put = await client.send(
      new PutAccountSettingCommand({
        name: "serviceLongArnFormat",
        value: "enabled",
      }),
    );
    expect(put.setting?.name).toBe("serviceLongArnFormat");
    expect(put.setting?.value).toBe("enabled");

    const listed = await client.send(
      new ListAccountSettingsCommand({ name: "serviceLongArnFormat" }),
    );
    expect(
      (listed.settings ?? []).some((s) => s.name === "serviceLongArnFormat"),
    ).toBe(true);

    const deleted = await client.send(
      new DeleteAccountSettingCommand({ name: "serviceLongArnFormat" }),
    );
    expect(deleted.setting?.name).toBe("serviceLongArnFormat");
  });

  test("tag operations", async () => {
    const client = ecs();
    const resourceArn =
      "arn:aws:ecs:us-east-1:000000000000:cluster/tagged-cluster";

    await client.send(
      new TagResourceCommand({
        resourceArn,
        tags: [
          { key: "env", value: "test" },
          { key: "team", value: "platform" },
        ],
      }),
    );

    const listed = await client.send(
      new ListTagsForResourceCommand({ resourceArn }),
    );
    expect((listed.tags ?? []).map((t) => t.key)).toContain("env");
    expect((listed.tags ?? []).map((t) => t.key)).toContain("team");

    await client.send(
      new UntagResourceCommand({ resourceArn, tagKeys: ["team"] }),
    );

    const after = await client.send(
      new ListTagsForResourceCommand({ resourceArn }),
    );
    expect((after.tags ?? []).map((t) => t.key)).toContain("env");
    expect((after.tags ?? []).map((t) => t.key)).not.toContain("team");
  });

  test("attribute operations", async () => {
    const client = ecs();
    const cluster = "default";
    const targetId = "bunsai-e2e-ci-attr";

    await client.send(
      new PutAttributesCommand({
        cluster,
        attributes: [
          {
            name: "com.example.color",
            value: "blue",
            targetType: "container-instance",
            targetId,
          },
        ],
      }),
    );

    const listed = await client.send(
      new ListAttributesCommand({
        cluster,
        targetType: "container-instance",
        attributeName: "com.example.color",
      }),
    );
    expect((listed.attributes ?? []).some((a) => a.targetId === targetId)).toBe(
      true,
    );

    await client.send(
      new DeleteAttributesCommand({
        cluster,
        attributes: [
          {
            name: "com.example.color",
            targetType: "container-instance",
            targetId,
          },
        ],
      }),
    );
  });

  test("container instance lifecycle", async () => {
    const client = ecs();
    const cluster = "bunsai-e2e-ci-cluster";

    const registered = await client.send(
      new RegisterContainerInstanceCommand({ cluster }),
    );
    const ciArn = registered.containerInstance?.containerInstanceArn;
    expect(ciArn).toBeDefined();
    expect(registered.containerInstance?.status).toBe("ACTIVE");
    expect(registered.containerInstance?.agentConnected).toBe(true);

    const described = await client.send(
      new DescribeContainerInstancesCommand({
        cluster,
        containerInstances: [ciArn!],
      }),
    );
    expect(
      (described.containerInstances ?? []).map((c) => c.containerInstanceArn),
    ).toContain(ciArn);

    const listed = await client.send(
      new ListContainerInstancesCommand({ cluster }),
    );
    expect((listed.containerInstanceArns ?? []).some((a) => a === ciArn)).toBe(
      true,
    );

    await client.send(
      new UpdateContainerInstancesStateCommand({
        cluster,
        containerInstances: [ciArn!],
        status: "DRAINING",
      }),
    );

    const deregistered = await client.send(
      new DeregisterContainerInstanceCommand({
        cluster,
        containerInstance: ciArn,
      }),
    );
    expect(deregistered.containerInstance?.status).toBe("INACTIVE");
  });

  test("task set lifecycle", async () => {
    const client = ecs();
    const family = "bunsai-e2e-ts-td";
    const clusterName = "bunsai-e2e-ts-cluster";
    const serviceName = "bunsai-e2e-ts-service";

    await client.send(
      new RegisterTaskDefinitionCommand({
        family,
        containerDefinitions: [
          { name: "app", image: "nginx:latest", memory: 128 },
        ],
      }),
    );

    const created = await client.send(
      new CreateTaskSetCommand({
        cluster: clusterName,
        service: serviceName,
        taskDefinition: family,
      }),
    );
    const tsArn = created.taskSet?.taskSetArn;
    const tsId = created.taskSet?.id;
    expect(tsArn).toBeDefined();
    expect(created.taskSet?.status).toBe("ACTIVE");

    const described = await client.send(
      new DescribeTaskSetsCommand({
        cluster: clusterName,
        service: serviceName,
        taskSets: [tsArn!],
      }),
    );
    expect((described.taskSets ?? []).map((t) => t.taskSetArn)).toContain(
      tsArn,
    );

    const updated = await client.send(
      new UpdateTaskSetCommand({
        cluster: clusterName,
        service: serviceName,
        taskSet: tsArn!,
        scale: { value: 50, unit: "PERCENT" },
      }),
    );
    expect(updated.taskSet?.scale?.value).toBe(50);

    await client.send(
      new UpdateServicePrimaryTaskSetCommand({
        cluster: clusterName,
        service: serviceName,
        primaryTaskSet: tsArn!,
      }),
    );

    const deleted = await client.send(
      new DeleteTaskSetCommand({
        cluster: clusterName,
        service: serviceName,
        taskSet: tsArn!,
      }),
    );
    expect(deleted.taskSet?.status).toBe("DRAINING");
  });

  test("describe tasks, start task and execute command", async () => {
    const client = ecs();
    const family = "bunsai-e2e-start-td";
    const clusterName = "bunsai-e2e-start-cluster";

    await client.send(
      new RegisterTaskDefinitionCommand({
        family,
        containerDefinitions: [
          { name: "app", image: "nginx:latest", memory: 128 },
        ],
      }),
    );

    const run = await client.send(
      new RunTaskCommand({
        cluster: clusterName,
        taskDefinition: family,
        count: 1,
      }),
    );
    const taskArn = (run.tasks ?? [])[0]?.taskArn;
    expect(taskArn).toBeDefined();

    const described = await client.send(
      new DescribeTasksCommand({ cluster: clusterName, tasks: [taskArn!] }),
    );
    expect((described.tasks ?? []).map((t) => t.taskArn)).toContain(taskArn);

    const exec = await client.send(
      new ExecuteCommandCommand({
        cluster: clusterName,
        task: taskArn!,
        command: "echo hello",
        interactive: true,
      }),
    );
    expect(exec.taskArn).toBe(taskArn);
    expect(exec.session?.sessionId).toBeDefined();

    const ci =
      "arn:aws:ecs:us-east-1:000000000000:container-instance/bunsai-e2e/fake-ci";
    const started = await client.send(
      new StartTaskCommand({
        cluster: clusterName,
        taskDefinition: family,
        containerInstances: [ci],
      }),
    );
    expect((started.tasks ?? []).length).toBe(1);
    expect((started.tasks ?? [])[0]?.lastStatus).toBe("PENDING");
  });

  test("task protection operations", async () => {
    const client = ecs();
    const taskArn =
      "arn:aws:ecs:us-east-1:000000000000:task/bunsai-e2e/fake-task-protect";

    const updated = await client.send(
      new UpdateTaskProtectionCommand({
        cluster: "default",
        tasks: [taskArn],
        protectionEnabled: true,
        expiresInMinutes: 60,
      }),
    );
    expect((updated.protectedTasks ?? [])[0]?.protectionEnabled).toBe(true);

    const got = await client.send(
      new GetTaskProtectionCommand({ cluster: "default", tasks: [taskArn] }),
    );
    expect((got.protectedTasks ?? [])[0]?.protectionEnabled).toBe(true);
  });

  test("delete task definitions and list families", async () => {
    const client = ecs();
    const family = "bunsai-e2e-del-td";

    await client.send(
      new RegisterTaskDefinitionCommand({
        family,
        containerDefinitions: [
          { name: "app", image: "nginx:latest", memory: 128 },
        ],
      }),
    );

    const families = await client.send(
      new ListTaskDefinitionFamiliesCommand({ familyPrefix: "bunsai-e2e-del" }),
    );
    expect((families.families ?? []).some((f) => f === family)).toBe(true);

    await client.send(
      new DeregisterTaskDefinitionCommand({ taskDefinition: `${family}:1` }),
    );

    const deleted = await client.send(
      new DeleteTaskDefinitionsCommand({ taskDefinitions: [`${family}:1`] }),
    );
    expect((deleted.taskDefinitions ?? []).length).toBe(1);
    expect((deleted.taskDefinitions ?? [])[0]?.status).toBe(
      "DELETE_IN_PROGRESS",
    );
  });

  test("cluster update operations", async () => {
    const client = ecs();
    const clusterName = "bunsai-e2e-update-cluster";

    await client.send(new CreateClusterCommand({ clusterName }));

    const updated = await client.send(
      new UpdateClusterCommand({ cluster: clusterName }),
    );
    expect(updated.cluster?.clusterName).toBe(clusterName);

    const settings = await client.send(
      new UpdateClusterSettingsCommand({
        cluster: clusterName,
        settings: [{ name: "containerInsights", value: "enabled" }],
      }),
    );
    expect(settings.cluster?.clusterName).toBe(clusterName);

    await client.send(new DeleteClusterCommand({ cluster: clusterName }));
  });

  test("discover poll endpoint", async () => {
    const client = ecs();
    const result = await client.send(
      new DiscoverPollEndpointCommand({ cluster: "default" }),
    );
    expect(result.endpoint).toBeDefined();
    expect(result.endpoint).toContain("ecs-a.");
  });

  test("submit state changes", async () => {
    const client = ecs();

    const att = await client.send(
      new SubmitAttachmentStateChangesCommand({
        cluster: "default",
        attachments: [{ attachmentArn: "arn:fake", status: "ATTACHED" }],
      }),
    );
    expect(att.acknowledgment).toBe("ACK");

    const container = await client.send(
      new SubmitContainerStateChangeCommand({ cluster: "default" }),
    );
    expect(container.acknowledgment).toBe("ACK");

    const task = await client.send(
      new SubmitTaskStateChangeCommand({ cluster: "default" }),
    );
    expect(task.acknowledgment).toBe("ACK");
  });

  test("list services by namespace", async () => {
    const client = ecs();
    const result = await client.send(
      new ListServicesByNamespaceCommand({ namespace: "my-namespace" }),
    );
    expect(Array.isArray(result.serviceArns)).toBe(true);
  });

  test("put cluster capacity providers", async () => {
    const client = ecs();
    const clusterName = "bunsai-e2e-cpcp-cluster";

    await client.send(new CreateClusterCommand({ clusterName }));

    const result = await client.send(
      new PutClusterCapacityProvidersCommand({
        cluster: clusterName,
        capacityProviders: [],
        defaultCapacityProviderStrategy: [],
      }),
    );
    expect(result.cluster?.clusterName).toBe(clusterName);

    await client.send(new DeleteClusterCommand({ cluster: clusterName }));
  });

  test("service deployment synthetic operations", async () => {
    const client = ecs();
    const fakeArn =
      "arn:aws:ecs:us-east-1:000000000000:service-deployment/default/svc/fake-id";

    const cont = await client.send(
      new ContinueServiceDeploymentCommand({
        serviceDeploymentArn: fakeArn,
        hookId: "hook-123",
      }),
    );
    expect(cont.serviceDeploymentArn).toBe(fakeArn);

    const stop = await client.send(
      new StopServiceDeploymentCommand({ serviceDeploymentArn: fakeArn }),
    );
    expect(stop.serviceDeploymentArn).toBe(fakeArn);
  });

  test("daemon operations", async () => {
    const client = ecs();
    const daemonName = "bunsai-e2e-daemon";
    const dtdFamily = "bunsai-e2e-dtd";
    const clusterArnVal = "arn:aws:ecs:us-east-1:000000000000:cluster/default";

    const regDtd = await client.send(
      new RegisterDaemonTaskDefinitionCommand({
        family: dtdFamily,
        containerDefinitions: [{ name: "app", image: "nginx:latest" }],
      }),
    );
    const dtdArn = regDtd.daemonTaskDefinitionArn;
    expect(dtdArn).toBeDefined();
    expect(dtdArn).toContain(dtdFamily);

    const listedDtd = await client.send(
      new ListDaemonTaskDefinitionsCommand({ familyPrefix: dtdFamily }),
    );
    expect(
      (listedDtd.daemonTaskDefinitions ?? []).some((d) => d.arn === dtdArn),
    ).toBe(true);

    const descDtd = await client.send(
      new DescribeDaemonTaskDefinitionCommand({
        daemonTaskDefinition: dtdArn!,
      }),
    );
    expect(descDtd.daemonTaskDefinition?.daemonTaskDefinitionArn).toBe(dtdArn);

    const created = await client.send(
      new CreateDaemonCommand({
        daemonName,
        clusterArn: clusterArnVal,
        daemonTaskDefinitionArn: dtdArn!,
        capacityProviderArns: [],
      }),
    );
    const dArn = created.daemonArn;
    expect(dArn).toBeDefined();
    expect(created.status).toBe("ACTIVE");

    const described = await client.send(
      new DescribeDaemonCommand({ daemonArn: dArn! }),
    );
    expect(described.daemon?.daemonArn).toBe(dArn);

    const listedDaemons = await client.send(
      new ListDaemonsCommand({ clusterArn: clusterArnVal }),
    );
    expect(
      (listedDaemons.daemonSummariesList ?? []).some(
        (d) => d.daemonArn === dArn,
      ),
    ).toBe(true);

    const updated = await client.send(
      new UpdateDaemonCommand({
        daemonArn: dArn!,
        daemonTaskDefinitionArn: dtdArn!,
        capacityProviderArns: [],
      }),
    );
    expect(updated.daemonArn).toBe(dArn);

    const deletedDaemon = await client.send(
      new DeleteDaemonCommand({ daemonArn: dArn! }),
    );
    expect(deletedDaemon.status).toBe("INACTIVE");

    await client.send(
      new DeleteDaemonTaskDefinitionCommand({ daemonTaskDefinition: dtdArn! }),
    );
  });

  test("express gateway service lifecycle", async () => {
    const client = ecs();
    const executionRoleArn =
      "arn:aws:iam::000000000000:role/ecsTaskExecutionRole";
    const infrastructureRoleArn = "arn:aws:iam::000000000000:role/ecsInfraRole";

    const created = await client.send(
      new CreateExpressGatewayServiceCommand({
        executionRoleArn,
        infrastructureRoleArn,
        primaryContainer: { name: "proxy" },
      }),
    );
    const sArn = created.service?.serviceArn;
    expect(sArn).toBeDefined();
    expect(created.service?.status?.statusCode).toBe("ACTIVE");

    const described = await client.send(
      new DescribeExpressGatewayServiceCommand({ serviceArn: sArn! }),
    );
    expect(described.service?.serviceArn).toBe(sArn);

    await client.send(
      new UpdateExpressGatewayServiceCommand({ serviceArn: sArn! }),
    );

    const deleted = await client.send(
      new DeleteExpressGatewayServiceCommand({ serviceArn: sArn! }),
    );
    expect(deleted.service?.status?.statusCode).toBe("INACTIVE");
  });
});
