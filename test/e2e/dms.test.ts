import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddTagsToResourceCommand,
  CreateDataMigrationCommand,
  CreateDataProviderCommand,
  CreateEndpointCommand,
  CreateEventSubscriptionCommand,
  CreateInstanceProfileCommand,
  CreateMigrationProjectCommand,
  CreateReplicationConfigCommand,
  CreateReplicationInstanceCommand,
  CreateReplicationSubnetGroupCommand,
  CreateReplicationTaskCommand,
  DatabaseMigrationServiceClient,
  DeleteCertificateCommand,
  DeleteConnectionCommand,
  DeleteDataMigrationCommand,
  DeleteDataProviderCommand,
  DeleteEndpointCommand,
  DeleteEventSubscriptionCommand,
  DeleteInstanceProfileCommand,
  DeleteMigrationProjectCommand,
  DeleteReplicationConfigCommand,
  DeleteReplicationInstanceCommand,
  DeleteReplicationSubnetGroupCommand,
  DeleteReplicationTaskCommand,
  DescribeConnectionsCommand,
  DescribeCertificatesCommand,
  DescribeDataMigrationsCommand,
  DescribeDataProvidersCommand,
  DescribeEndpointsCommand,
  DescribeEventSubscriptionsCommand,
  DescribeInstanceProfilesCommand,
  DescribeMigrationProjectsCommand,
  DescribeReplicationConfigsCommand,
  DescribeReplicationInstancesCommand,
  DescribeReplicationSubnetGroupsCommand,
  DescribeReplicationTasksCommand,
  ImportCertificateCommand,
  ListTagsForResourceCommand,
  ModifyEndpointCommand,
  ModifyReplicationInstanceCommand,
  ModifyReplicationTaskCommand,
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

test("DMS sub-resource persistence: SubnetGroup", async () => {
  const client = dms();
  const id = "audit-sg1";

  const created = await client.send(
    new CreateReplicationSubnetGroupCommand({
      ReplicationSubnetGroupIdentifier: id,
      ReplicationSubnetGroupDescription: "test sg",
      SubnetIds: ["subnet-00000001", "subnet-00000002"],
    }),
  );
  expect(created.ReplicationSubnetGroup?.ReplicationSubnetGroupIdentifier).toBe(
    id,
  );

  const listed = await client.send(
    new DescribeReplicationSubnetGroupsCommand({}),
  );
  expect(
    listed.ReplicationSubnetGroups?.some(
      (g) => g.ReplicationSubnetGroupIdentifier === id,
    ),
  ).toBe(true);

  await expect(
    client.send(
      new CreateReplicationSubnetGroupCommand({
        ReplicationSubnetGroupIdentifier: id,
        ReplicationSubnetGroupDescription: "dup",
        SubnetIds: ["subnet-00000001"],
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteReplicationSubnetGroupCommand({
      ReplicationSubnetGroupIdentifier: id,
    }),
  );

  const afterDelete = await client.send(
    new DescribeReplicationSubnetGroupsCommand({}),
  );
  expect(
    afterDelete.ReplicationSubnetGroups?.some(
      (g) => g.ReplicationSubnetGroupIdentifier === id,
    ),
  ).toBe(false);

  await expect(
    client.send(
      new DeleteReplicationSubnetGroupCommand({
        ReplicationSubnetGroupIdentifier: id,
      }),
    ),
  ).rejects.toThrow();
});

test("DMS sub-resource persistence: Certificate", async () => {
  const client = dms();
  const id = "audit-cert1";

  const imported = await client.send(
    new ImportCertificateCommand({
      CertificateIdentifier: id,
      CertificatePem: "PEM",
    }),
  );
  expect(imported.Certificate?.CertificateIdentifier).toBe(id);
  const arn = imported.Certificate!.CertificateArn!;

  const listed = await client.send(new DescribeCertificatesCommand({}));
  expect(listed.Certificates?.some((c) => c.CertificateIdentifier === id)).toBe(
    true,
  );

  await client.send(new DeleteCertificateCommand({ CertificateArn: arn }));

  const afterDelete = await client.send(new DescribeCertificatesCommand({}));
  expect(
    afterDelete.Certificates?.some((c) => c.CertificateIdentifier === id),
  ).toBe(false);
});

test("DMS sub-resource persistence: EventSubscription", async () => {
  const client = dms();
  const name = "audit-eventsub1";

  const created = await client.send(
    new CreateEventSubscriptionCommand({
      SubscriptionName: name,
      SnsTopicArn: "arn:aws:sns:us-east-1:123:t",
    }),
  );
  expect(created.EventSubscription?.CustSubscriptionId).toBe(name);

  const listed = await client.send(new DescribeEventSubscriptionsCommand({}));
  expect(
    listed.EventSubscriptionsList?.some((s) => s.CustSubscriptionId === name),
  ).toBe(true);

  await client.send(
    new DeleteEventSubscriptionCommand({ SubscriptionName: name }),
  );

  const afterDelete = await client.send(
    new DescribeEventSubscriptionsCommand({}),
  );
  expect(
    afterDelete.EventSubscriptionsList?.some(
      (s) => s.CustSubscriptionId === name,
    ),
  ).toBe(false);
});

test("DMS sub-resource persistence: ReplicationConfig (DMS-01)", async () => {
  const client = dms();
  const rcId = "audit-rc1";
  const srcId = "audit-rc-src";
  const tgtId = "audit-rc-tgt";

  const src = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: srcId,
      EndpointType: "source",
      EngineName: "mysql",
    }),
  );
  const tgt = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: tgtId,
      EndpointType: "target",
      EngineName: "postgres",
    }),
  );

  const created = await client.send(
    new CreateReplicationConfigCommand({
      ReplicationConfigIdentifier: rcId,
      SourceEndpointArn: src.Endpoint!.EndpointArn!,
      TargetEndpointArn: tgt.Endpoint!.EndpointArn!,
      ReplicationType: "full-load",
      TableMappings: "{}",
      ComputeConfig: { MaxCapacityUnits: 1 },
    }),
  );
  expect(created.ReplicationConfig?.ReplicationConfigArn).toContain(
    "replication-config",
  );
  expect(created.ReplicationConfig?.ReplicationConfigIdentifier).toBe(rcId);

  const listed = await client.send(new DescribeReplicationConfigsCommand({}));
  expect(
    listed.ReplicationConfigs?.some(
      (c) => c.ReplicationConfigIdentifier === rcId,
    ),
  ).toBe(true);

  await client.send(
    new DeleteReplicationConfigCommand({
      ReplicationConfigArn: created.ReplicationConfig!.ReplicationConfigArn!,
    }),
  );

  const afterDelete = await client.send(
    new DescribeReplicationConfigsCommand({}),
  );
  expect(
    afterDelete.ReplicationConfigs?.some(
      (c) => c.ReplicationConfigIdentifier === rcId,
    ),
  ).toBe(false);

  await client.send(
    new DeleteEndpointCommand({ EndpointArn: src.Endpoint!.EndpointArn! }),
  );
  await client.send(
    new DeleteEndpointCommand({ EndpointArn: tgt.Endpoint!.EndpointArn! }),
  );
});

test("DMS sub-resource persistence: DataProvider, InstanceProfile, MigrationProject", async () => {
  const client = dms();

  const dp = await client.send(
    new CreateDataProviderCommand({
      DataProviderName: "audit-dp1",
      Engine: "mysql",
      Settings: { MySqlSettings: { ServerName: "localhost", Port: 3306 } },
    }),
  );
  expect(dp.DataProvider?.DataProviderName).toBe("audit-dp1");
  const dpArn = dp.DataProvider!.DataProviderArn!;

  const dpList = await client.send(new DescribeDataProvidersCommand({}));
  expect(
    dpList.DataProviders?.some((p) => p.DataProviderName === "audit-dp1"),
  ).toBe(true);

  const ip = await client.send(
    new CreateInstanceProfileCommand({ InstanceProfileName: "audit-ip1" }),
  );
  expect(ip.InstanceProfile?.InstanceProfileName).toBe("audit-ip1");
  const ipArn = ip.InstanceProfile!.InstanceProfileArn!;

  const ipList = await client.send(new DescribeInstanceProfilesCommand({}));
  expect(
    ipList.InstanceProfiles?.some((p) => p.InstanceProfileName === "audit-ip1"),
  ).toBe(true);

  const mp = await client.send(
    new CreateMigrationProjectCommand({
      MigrationProjectName: "audit-mp1",
      SourceDataProviderDescriptors: [{ DataProviderIdentifier: dpArn }],
      TargetDataProviderDescriptors: [{ DataProviderIdentifier: dpArn }],
      InstanceProfileIdentifier: ipArn,
    }),
  );
  expect(mp.MigrationProject?.MigrationProjectName).toBe("audit-mp1");
  const mpArn = mp.MigrationProject!.MigrationProjectArn!;

  const mpList = await client.send(new DescribeMigrationProjectsCommand({}));
  expect(
    mpList.MigrationProjects?.some(
      (p) => p.MigrationProjectName === "audit-mp1",
    ),
  ).toBe(true);

  await client.send(
    new DeleteMigrationProjectCommand({ MigrationProjectIdentifier: mpArn }),
  );
  await client.send(
    new DeleteInstanceProfileCommand({ InstanceProfileIdentifier: ipArn }),
  );
  await client.send(
    new DeleteDataProviderCommand({ DataProviderIdentifier: dpArn }),
  );
});

test("DMS sub-resource persistence: DataMigration", async () => {
  const client = dms();
  const id = "audit-dm1";

  const dpRes = await client.send(
    new CreateDataProviderCommand({
      DataProviderName: "audit-dm1-dp",
      Engine: "mysql",
      Settings: { MySqlSettings: { ServerName: "localhost", Port: 3306 } },
    }),
  );
  const dpArn2 = dpRes.DataProvider!.DataProviderArn!;

  const ipRes = await client.send(
    new CreateInstanceProfileCommand({ InstanceProfileName: "audit-dm1-ip" }),
  );
  const ipArn2 = ipRes.InstanceProfile!.InstanceProfileArn!;

  const mpRes = await client.send(
    new CreateMigrationProjectCommand({
      MigrationProjectName: "audit-dm1-mp",
      SourceDataProviderDescriptors: [{ DataProviderIdentifier: dpArn2 }],
      TargetDataProviderDescriptors: [{ DataProviderIdentifier: dpArn2 }],
      InstanceProfileIdentifier: ipArn2,
    }),
  );
  const mpArn = mpRes.MigrationProject!.MigrationProjectArn!;

  const created = await client.send(
    new CreateDataMigrationCommand({
      DataMigrationName: id,
      DataMigrationType: "full-load",
      MigrationProjectIdentifier: mpArn,
      ServiceAccessRoleArn: "arn:aws:iam::123456789012:role/dms-role",
    }),
  );
  expect(created.DataMigration?.DataMigrationName).toBe(id);
  const arn = created.DataMigration!.DataMigrationArn!;

  const listed = await client.send(new DescribeDataMigrationsCommand({}));
  expect(listed.DataMigrations?.some((d) => d.DataMigrationName === id)).toBe(
    true,
  );

  await client.send(
    new DeleteDataMigrationCommand({ DataMigrationIdentifier: arn }),
  );
  await client.send(
    new DeleteMigrationProjectCommand({ MigrationProjectIdentifier: mpArn }),
  );
  await client.send(
    new DeleteInstanceProfileCommand({ InstanceProfileIdentifier: ipArn2 }),
  );
  await client.send(
    new DeleteDataProviderCommand({ DataProviderIdentifier: dpArn2 }),
  );

  const afterDelete = await client.send(new DescribeDataMigrationsCommand({}));
  expect(
    afterDelete.DataMigrations?.some((d) => d.DataMigrationName === id),
  ).toBe(false);
});

test("DMS-03: delete guards — instance and endpoint with active task", async () => {
  const client = dms();
  const instId = "guard03-inst";
  const srcId = "guard03-src";
  const tgtId = "guard03-tgt";
  const taskId = "guard03-task";

  const inst = await client.send(
    new CreateReplicationInstanceCommand({
      ReplicationInstanceIdentifier: instId,
      ReplicationInstanceClass: "dms.c4.large",
    }),
  );
  const src = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: srcId,
      EndpointType: "source",
      EngineName: "mysql",
    }),
  );
  const tgt = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: tgtId,
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
      TableMappings: "{}",
    }),
  );

  await expect(
    client.send(
      new DeleteReplicationInstanceCommand({
        ReplicationInstanceArn:
          inst.ReplicationInstance!.ReplicationInstanceArn!,
      }),
    ),
  ).rejects.toThrow();

  await expect(
    client.send(
      new DeleteEndpointCommand({ EndpointArn: src.Endpoint!.EndpointArn! }),
    ),
  ).rejects.toThrow();

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

test("DMS-04: tags not resurrected after delete+recreate", async () => {
  const client = dms();
  const epId = "tagclean-ep1";

  const ep = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: epId,
      EndpointType: "source",
      EngineName: "mysql",
      Tags: [{ Key: "a", Value: "1" }],
    }),
  );
  const arn = ep.Endpoint!.EndpointArn!;

  const before = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(before.TagList?.find((t) => t.Key === "a")?.Value).toBe("1");

  await client.send(new DeleteEndpointCommand({ EndpointArn: arn }));

  const ep2 = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: epId,
      EndpointType: "source",
      EngineName: "mysql",
    }),
  );
  const arn2 = ep2.Endpoint!.EndpointArn!;
  expect(arn2).toBe(arn);

  const after = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn2 }),
  );
  expect(after.TagList?.find((t) => t.Key === "a")).toBeUndefined();

  await client.send(new DeleteEndpointCommand({ EndpointArn: arn2 }));
});

test("DMS-05: TestConnection persists; DescribeConnections lists; DeleteConnection removes", async () => {
  const client = dms();
  const instId = "conn05-inst";
  const epId = "conn05-ep";

  const inst = await client.send(
    new CreateReplicationInstanceCommand({
      ReplicationInstanceIdentifier: instId,
      ReplicationInstanceClass: "dms.c4.large",
    }),
  );
  const ep = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: epId,
      EndpointType: "source",
      EngineName: "mysql",
    }),
  );

  await client.send(
    new TestConnectionCommand({
      ReplicationInstanceArn: inst.ReplicationInstance!.ReplicationInstanceArn!,
      EndpointArn: ep.Endpoint!.EndpointArn!,
    }),
  );

  const listed = await client.send(new DescribeConnectionsCommand({}));
  expect(
    listed.Connections?.some(
      (c) =>
        c.ReplicationInstanceArn ===
          inst.ReplicationInstance!.ReplicationInstanceArn &&
        c.EndpointArn === ep.Endpoint!.EndpointArn,
    ),
  ).toBe(true);

  await client.send(
    new DeleteConnectionCommand({
      ReplicationInstanceArn: inst.ReplicationInstance!.ReplicationInstanceArn!,
      EndpointArn: ep.Endpoint!.EndpointArn!,
    }),
  );

  const afterDelete = await client.send(new DescribeConnectionsCommand({}));
  expect(
    afterDelete.Connections?.some(
      (c) => c.EndpointArn === ep.Endpoint!.EndpointArn,
    ),
  ).toBe(false);

  await client.send(
    new DeleteReplicationInstanceCommand({
      ReplicationInstanceArn: inst.ReplicationInstance!.ReplicationInstanceArn!,
    }),
  );
  await client.send(
    new DeleteEndpointCommand({ EndpointArn: ep.Endpoint!.EndpointArn! }),
  );
});

test("DMS-06: ModifyEndpoint rename removes stale id-key", async () => {
  const client = dms();
  const oldId = "rename06-old";
  const newId = "rename06-new";

  const ep = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: oldId,
      EndpointType: "source",
      EngineName: "mysql",
    }),
  );

  await client.send(
    new ModifyEndpointCommand({
      EndpointArn: ep.Endpoint!.EndpointArn!,
      EndpointIdentifier: newId,
    }),
  );

  const listed = await client.send(new DescribeEndpointsCommand({}));
  const ids = listed.Endpoints?.map((e) => e.EndpointIdentifier) ?? [];
  expect(ids.filter((id) => id === newId).length).toBe(1);
  expect(ids.includes(oldId)).toBe(false);

  await client.send(
    new DeleteEndpointCommand({ EndpointArn: ep.Endpoint!.EndpointArn! }),
  );
});

test("DMS-06: ModifyReplicationTask rename removes stale id-key", async () => {
  const client = dms();
  const instId = "rename06t-inst";
  const srcId = "rename06t-src";
  const tgtId = "rename06t-tgt";
  const oldTaskId = "rename06t-old";
  const newTaskId = "rename06t-new";

  const inst = await client.send(
    new CreateReplicationInstanceCommand({
      ReplicationInstanceIdentifier: instId,
      ReplicationInstanceClass: "dms.c4.large",
    }),
  );
  const src = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: srcId,
      EndpointType: "source",
      EngineName: "mysql",
    }),
  );
  const tgt = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: tgtId,
      EndpointType: "target",
      EngineName: "postgres",
    }),
  );
  const task = await client.send(
    new CreateReplicationTaskCommand({
      ReplicationTaskIdentifier: oldTaskId,
      SourceEndpointArn: src.Endpoint!.EndpointArn!,
      TargetEndpointArn: tgt.Endpoint!.EndpointArn!,
      ReplicationInstanceArn: inst.ReplicationInstance!.ReplicationInstanceArn!,
      MigrationType: "full-load",
      TableMappings: "{}",
    }),
  );

  await client.send(
    new ModifyReplicationTaskCommand({
      ReplicationTaskArn: task.ReplicationTask!.ReplicationTaskArn!,
      ReplicationTaskIdentifier: newTaskId,
    }),
  );

  const listed = await client.send(new DescribeReplicationTasksCommand({}));
  const ids =
    listed.ReplicationTasks?.map((t) => t.ReplicationTaskIdentifier) ?? [];
  expect(ids.filter((id) => id === newTaskId).length).toBe(1);
  expect(ids.includes(oldTaskId)).toBe(false);

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

test("DMS-07: StartReplicationTask requires valid StartReplicationTaskType", async () => {
  const client = dms();
  const instId = "start07-inst";
  const srcId = "start07-src";
  const tgtId = "start07-tgt";
  const taskId = "start07-task";

  const inst = await client.send(
    new CreateReplicationInstanceCommand({
      ReplicationInstanceIdentifier: instId,
      ReplicationInstanceClass: "dms.c4.large",
    }),
  );
  const src = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: srcId,
      EndpointType: "source",
      EngineName: "mysql",
    }),
  );
  const tgt = await client.send(
    new CreateEndpointCommand({
      EndpointIdentifier: tgtId,
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
      TableMappings: "{}",
    }),
  );

  const started = await client.send(
    new StartReplicationTaskCommand({
      ReplicationTaskArn: task.ReplicationTask!.ReplicationTaskArn!,
      StartReplicationTaskType: "start-replication",
    }),
  );
  expect(started.ReplicationTask?.Status).toBe("running");

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

test("DMS-08: ListTagsForResource throws for nonexistent ARN", async () => {
  const client = dms();
  await expect(
    client.send(
      new ListTagsForResourceCommand({
        ResourceArn: "arn:aws:dms:us-east-1:123456789012:rep:nonexistent",
      }),
    ),
  ).rejects.toThrow();
});
