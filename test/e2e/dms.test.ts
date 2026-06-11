import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddTagsToResourceCommand,
  CreateEndpointCommand,
  CreateReplicationInstanceCommand,
  CreateReplicationTaskCommand,
  DatabaseMigrationServiceClient,
  DeleteEndpointCommand,
  DeleteReplicationInstanceCommand,
  DeleteReplicationTaskCommand,
  DescribeConnectionsCommand,
  DescribeEndpointsCommand,
  DescribeReplicationInstancesCommand,
  DescribeReplicationTasksCommand,
  ListTagsForResourceCommand,
  ModifyEndpointCommand,
  ModifyReplicationInstanceCommand,
  RemoveTagsFromResourceCommand,
  StartReplicationTaskCommand,
  StopReplicationTaskCommand,
  TestConnectionCommand,
} from "@aws-sdk/client-database-migration-service";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const dms = () =>
  new DatabaseMigrationServiceClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("DMS replication instance lifecycle", async () => {
  const client = dms();
  const instanceId = "test-instance-e2e";

  const created = await client.send(
    new CreateReplicationInstanceCommand({
      ReplicationInstanceIdentifier: instanceId,
      ReplicationInstanceClass: "dms.c4.large",
      AllocatedStorage: 50,
    }),
  );
  expect(created.ReplicationInstance?.ReplicationInstanceIdentifier).toBe(
    instanceId,
  );
  expect(created.ReplicationInstance?.ReplicationInstanceStatus).toBe(
    "available",
  );
  expect(created.ReplicationInstance?.ReplicationInstanceArn).toContain("dms");

  const described = await client.send(
    new DescribeReplicationInstancesCommand({
      Filters: [{ Name: "replication-instance-id", Values: [instanceId] }],
    }),
  );
  expect(described.ReplicationInstances).toHaveLength(1);
  expect(described.ReplicationInstances![0].ReplicationInstanceIdentifier).toBe(
    instanceId,
  );

  const modified = await client.send(
    new ModifyReplicationInstanceCommand({
      ReplicationInstanceArn:
        created.ReplicationInstance!.ReplicationInstanceArn!,
      AllocatedStorage: 100,
    }),
  );
  expect(modified.ReplicationInstance?.AllocatedStorage).toBe(100);

  const deleted = await client.send(
    new DeleteReplicationInstanceCommand({
      ReplicationInstanceArn:
        created.ReplicationInstance!.ReplicationInstanceArn!,
    }),
  );
  expect(deleted.ReplicationInstance?.ReplicationInstanceStatus).toBe(
    "deleting",
  );

  const afterDelete = await client.send(
    new DescribeReplicationInstancesCommand({}),
  );
  const found = afterDelete.ReplicationInstances?.find(
    (i) => i.ReplicationInstanceIdentifier === instanceId,
  );
  expect(found).toBeUndefined();
});

test("DMS endpoint lifecycle", async () => {
  const client = dms();
  const sourceId = "e2e-source-ep";
  const targetId = "e2e-target-ep";

  const srcCreated = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: sourceId,
      EndpointType: "source",
      EngineName: "mysql",
      ServerName: "db.example.com",
      Port: 3306,
      Username: "admin",
    }),
  );
  expect(srcCreated.Endpoint?.EndpointIdentifier).toBe(sourceId);
  expect(srcCreated.Endpoint?.EndpointType).toBe("source");
  expect(srcCreated.Endpoint?.Status).toBe("active");

  const tgtCreated = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: targetId,
      EndpointType: "target",
      EngineName: "postgres",
      ServerName: "target.example.com",
      Port: 5432,
    }),
  );
  expect(tgtCreated.Endpoint?.EndpointIdentifier).toBe(targetId);

  const described = await client.send(new DescribeEndpointsCommand({}));
  expect(described.Endpoints?.length).toBeGreaterThanOrEqual(2);

  const modified = await client.send(
    new ModifyEndpointCommand({
      EndpointArn: srcCreated.Endpoint!.EndpointArn!,
      Port: 3307,
    }),
  );
  expect(modified.Endpoint?.Port).toBe(3307);

  const deletedSrc = await client.send(
    new DeleteEndpointCommand({
      EndpointArn: srcCreated.Endpoint!.EndpointArn!,
    }),
  );
  expect(deletedSrc.Endpoint?.Status).toBe("deleting");

  await client.send(
    new DeleteEndpointCommand({
      EndpointArn: tgtCreated.Endpoint!.EndpointArn!,
    }),
  );
});

test("DMS TestConnection and DescribeConnections", async () => {
  const client = dms();
  const instanceId = "conn-test-instance";
  const endpointId = "conn-test-endpoint";

  const inst = await client.send(
    new CreateReplicationInstanceCommand({
      ReplicationInstanceIdentifier: instanceId,
      ReplicationInstanceClass: "dms.c4.large",
    }),
  );

  const ep = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: endpointId,
      EndpointType: "source",
      EngineName: "mysql",
    }),
  );

  const testResult = await client.send(
    new TestConnectionCommand({
      ReplicationInstanceArn: inst.ReplicationInstance!.ReplicationInstanceArn!,
      EndpointArn: ep.Endpoint!.EndpointArn!,
    }),
  );
  expect(testResult.Connection?.Status).toBe("successful");
  expect(testResult.Connection?.EndpointIdentifier).toBe(endpointId);

  const connections = await client.send(new DescribeConnectionsCommand({}));
  expect(connections.Connections?.length).toBeGreaterThanOrEqual(1);

  await client.send(
    new DeleteReplicationInstanceCommand({
      ReplicationInstanceArn: inst.ReplicationInstance!.ReplicationInstanceArn!,
    }),
  );
  await client.send(
    new DeleteEndpointCommand({ EndpointArn: ep.Endpoint!.EndpointArn! }),
  );
});

test("DMS replication task lifecycle and state machine", async () => {
  const client = dms();
  const instanceId = "task-test-instance";
  const sourceId = "task-src-ep";
  const targetId = "task-tgt-ep";
  const taskId = "e2e-replication-task";

  const inst = await client.send(
    new CreateReplicationInstanceCommand({
      ReplicationInstanceIdentifier: instanceId,
      ReplicationInstanceClass: "dms.c4.large",
    }),
  );

  const src = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: sourceId,
      EndpointType: "source",
      EngineName: "mysql",
    }),
  );

  const tgt = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: targetId,
      EndpointType: "target",
      EngineName: "postgres",
    }),
  );

  const taskCreated = await client.send(
    new CreateReplicationTaskCommand({
      ReplicationTaskIdentifier: taskId,
      SourceEndpointArn: src.Endpoint!.EndpointArn!,
      TargetEndpointArn: tgt.Endpoint!.EndpointArn!,
      ReplicationInstanceArn: inst.ReplicationInstance!.ReplicationInstanceArn!,
      MigrationType: "full-load",
      TableMappings: JSON.stringify({ rules: [] }),
    }),
  );
  expect(taskCreated.ReplicationTask?.ReplicationTaskIdentifier).toBe(taskId);
  expect(taskCreated.ReplicationTask?.Status).toBe("ready");

  const described = await client.send(
    new DescribeReplicationTasksCommand({
      Filters: [{ Name: "replication-task-id", Values: [taskId] }],
    }),
  );
  expect(described.ReplicationTasks).toHaveLength(1);

  const started = await client.send(
    new StartReplicationTaskCommand({
      ReplicationTaskArn: taskCreated.ReplicationTask!.ReplicationTaskArn!,
      StartReplicationTaskType: "start-replication",
    }),
  );
  expect(started.ReplicationTask?.Status).toBe("running");

  const stopped = await client.send(
    new StopReplicationTaskCommand({
      ReplicationTaskArn: taskCreated.ReplicationTask!.ReplicationTaskArn!,
    }),
  );
  expect(stopped.ReplicationTask?.Status).toBe("stopped");

  const deleted = await client.send(
    new DeleteReplicationTaskCommand({
      ReplicationTaskArn: taskCreated.ReplicationTask!.ReplicationTaskArn!,
    }),
  );
  expect(deleted.ReplicationTask?.Status).toBe("deleting");

  await client.send(
    new DeleteReplicationInstanceCommand({
      ReplicationInstanceArn: inst.ReplicationInstance!.ReplicationInstanceArn!,
    }),
  );
  await client.send(
    new DeleteEndpointCommand({ EndpointArn: src.Endpoint!.EndpointArn! }),
  );
  await client.send(
    new DeleteEndpointCommand({ EndpointArn: tgt.Endpoint!.EndpointArn! }),
  );
});

test("DMS running task deletion guard", async () => {
  const client = dms();
  const instanceId = "guard-instance";
  const sourceId = "guard-src";
  const targetId = "guard-tgt";
  const taskId = "guard-task";

  const inst = await client.send(
    new CreateReplicationInstanceCommand({
      ReplicationInstanceIdentifier: instanceId,
      ReplicationInstanceClass: "dms.c4.large",
    }),
  );

  const src = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: sourceId,
      EndpointType: "source",
      EngineName: "mysql",
    }),
  );

  const tgt = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: targetId,
      EndpointType: "target",
      EngineName: "postgres",
    }),
  );

  const task = await client.send(
    new CreateReplicationTaskCommand({
      ReplicationTaskIdentifier: taskId,
      SourceEndpointArn: src.Endpoint!.EndpointArn!,
      TargetEndpointArn: tgt.Endpoint!.EndpointArn!,
      ReplicationInstanceArn: inst.ReplicationInstance!.ReplicationInstanceArn!,
      MigrationType: "full-load",
      TableMappings: JSON.stringify({ rules: [] }),
    }),
  );

  await client.send(
    new StartReplicationTaskCommand({
      ReplicationTaskArn: task.ReplicationTask!.ReplicationTaskArn!,
      StartReplicationTaskType: "start-replication",
    }),
  );

  await expect(
    client.send(
      new DeleteReplicationTaskCommand({
        ReplicationTaskArn: task.ReplicationTask!.ReplicationTaskArn!,
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new StopReplicationTaskCommand({
      ReplicationTaskArn: task.ReplicationTask!.ReplicationTaskArn!,
    }),
  );
  await client.send(
    new DeleteReplicationTaskCommand({
      ReplicationTaskArn: task.ReplicationTask!.ReplicationTaskArn!,
    }),
  );

  await client.send(
    new DeleteReplicationInstanceCommand({
      ReplicationInstanceArn: inst.ReplicationInstance!.ReplicationInstanceArn!,
    }),
  );
  await client.send(
    new DeleteEndpointCommand({ EndpointArn: src.Endpoint!.EndpointArn! }),
  );
  await client.send(
    new DeleteEndpointCommand({ EndpointArn: tgt.Endpoint!.EndpointArn! }),
  );
});

test("DMS tag operations", async () => {
  const client = dms();
  const instanceId = "tag-test-instance";

  const inst = await client.send(
    new CreateReplicationInstanceCommand({
      ReplicationInstanceIdentifier: instanceId,
      ReplicationInstanceClass: "dms.c4.large",
      Tags: [{ Key: "Env", Value: "test" }],
    }),
  );
  const arn = inst.ReplicationInstance!.ReplicationInstanceArn!;

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(listed.TagList?.find((t) => t.Key === "Env")?.Value).toBe("test");

  await client.send(
    new AddTagsToResourceCommand({
      ResourceArn: arn,
      Tags: [{ Key: "Team", Value: "platform" }],
    }),
  );

  const listed2 = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(listed2.TagList?.length).toBeGreaterThanOrEqual(2);

  await client.send(
    new RemoveTagsFromResourceCommand({ ResourceArn: arn, TagKeys: ["Env"] }),
  );

  const listed3 = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(listed3.TagList?.find((t) => t.Key === "Env")).toBeUndefined();
  expect(listed3.TagList?.find((t) => t.Key === "Team")?.Value).toBe(
    "platform",
  );

  await client.send(
    new DeleteReplicationInstanceCommand({ ReplicationInstanceArn: arn }),
  );
});
