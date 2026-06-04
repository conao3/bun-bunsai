import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AddSourceIdentifierToSubscriptionCommand,
  CancelExportTaskCommand,
  CreateBlueGreenDeploymentCommand,
  CreateDBClusterCommand,
  CreateDBInstanceCommand,
  CreateDBProxyCommand,
  CreateDBProxyEndpointCommand,
  CreateEventSubscriptionCommand,
  CreateGlobalClusterCommand,
  CreateOptionGroupCommand,
  CreateTenantDatabaseCommand,
  DeleteBlueGreenDeploymentCommand,
  DeleteDBProxyCommand,
  DeleteDBProxyEndpointCommand,
  DeleteEventSubscriptionCommand,
  DeleteGlobalClusterCommand,
  DeleteOptionGroupCommand,
  DeleteTenantDatabaseCommand,
  DeregisterDBProxyTargetsCommand,
  DescribeBlueGreenDeploymentsCommand,
  DescribeCertificatesCommand,
  DescribeDBEngineVersionsCommand,
  DescribeDBMajorEngineVersionsCommand,
  DescribeDBProxiesCommand,
  DescribeDBProxyEndpointsCommand,
  DescribeDBProxyTargetGroupsCommand,
  DescribeDBProxyTargetsCommand,
  DescribeDBShardGroupsCommand,
  DescribeEventCategoriesCommand,
  DescribeEventSubscriptionsCommand,
  DescribeGlobalClustersCommand,
  DescribeOptionGroupOptionsCommand,
  DescribeOptionGroupsCommand,
  DescribeReservedDBInstancesCommand,
  DescribeReservedDBInstancesOfferingsCommand,
  DescribeServerlessV2PlatformVersionsCommand,
  DescribeSourceRegionsCommand,
  DescribeTenantDatabasesCommand,
  ModifyDBProxyCommand,
  ModifyEventSubscriptionCommand,
  ModifyGlobalClusterCommand,
  ModifyOptionGroupCommand,
  PurchaseReservedDBInstancesOfferingCommand,
  RDSClient,
  RegisterDBProxyTargetsCommand,
  RemoveSourceIdentifierFromSubscriptionCommand,
  StartExportTaskCommand,
} from "@aws-sdk/client-rds";

const awsPort = 4751;
const uiPort = 5751;
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

const rds = () => new RDSClient({ endpoint, region, credentials });

test("DB proxy lifecycle", async () => {
  const client = rds();
  const proxyName = "e2e-proxy";

  const created = await client.send(
    new CreateDBProxyCommand({
      DBProxyName: proxyName,
      EngineFamily: "MYSQL",
      RoleArn: "arn:aws:iam::123456789012:role/rds-proxy-role",
      VpcSubnetIds: ["subnet-0001", "subnet-0002"],
      Auth: [{ AuthScheme: "SECRETS", IAMAuth: "DISABLED" }],
    }),
  );
  expect(created.DBProxy?.DBProxyName).toBe(proxyName);
  expect(created.DBProxy?.EngineFamily).toBe("MYSQL");
  expect(created.DBProxy?.Status).toBe("available");

  const described = await client.send(new DescribeDBProxiesCommand({}));
  expect(described.DBProxies?.length).toBeGreaterThanOrEqual(1);
  expect(described.DBProxies?.[0]?.DBProxyName).toBe(proxyName);

  const epCreated = await client.send(
    new CreateDBProxyEndpointCommand({
      DBProxyEndpointName: "e2e-proxy-ep",
      DBProxyName: proxyName,
      VpcSubnetIds: ["subnet-0001"],
    }),
  );
  expect(epCreated.DBProxyEndpoint?.DBProxyEndpointName).toBe("e2e-proxy-ep");
  expect(epCreated.DBProxyEndpoint?.DBProxyName).toBe(proxyName);

  const eps = await client.send(
    new DescribeDBProxyEndpointsCommand({ DBProxyName: proxyName }),
  );
  expect(eps.DBProxyEndpoints?.length).toBe(1);

  const targetGroups = await client.send(
    new DescribeDBProxyTargetGroupsCommand({ DBProxyName: proxyName }),
  );
  expect(targetGroups.TargetGroups?.length).toBeGreaterThanOrEqual(1);

  const registered = await client.send(
    new RegisterDBProxyTargetsCommand({
      DBProxyName: proxyName,
      DBInstanceIdentifiers: ["test-instance"],
    }),
  );
  expect(registered.DBProxyTargets?.length).toBe(1);

  const targets = await client.send(
    new DescribeDBProxyTargetsCommand({
      DBProxyName: proxyName,
      TargetGroupName: "default",
    }),
  );
  expect(targets.Targets?.length).toBe(1);

  await client.send(
    new DeregisterDBProxyTargetsCommand({ DBProxyName: proxyName }),
  );

  const modified = await client.send(
    new ModifyDBProxyCommand({
      DBProxyName: proxyName,
      RequireTLS: true,
    }),
  );
  expect(modified.DBProxy?.RequireTLS).toBe(true);

  await client.send(
    new DeleteDBProxyEndpointCommand({ DBProxyEndpointName: "e2e-proxy-ep" }),
  );

  const deleted = await client.send(
    new DeleteDBProxyCommand({ DBProxyName: proxyName }),
  );
  expect(deleted.DBProxy?.Status).toBe("deleting");
});

test("global cluster lifecycle", async () => {
  const client = rds();
  const gcId = "e2e-global-cluster";

  const created = await client.send(
    new CreateGlobalClusterCommand({
      GlobalClusterIdentifier: gcId,
      Engine: "aurora-mysql",
      EngineVersion: "8.0.mysql_aurora.3.02.0",
    }),
  );
  expect(created.GlobalCluster?.GlobalClusterIdentifier).toBe(gcId);
  expect(created.GlobalCluster?.Engine).toBe("aurora-mysql");
  expect(created.GlobalCluster?.Status).toBe("available");

  const listed = await client.send(new DescribeGlobalClustersCommand({}));
  expect(listed.GlobalClusters?.length).toBeGreaterThanOrEqual(1);

  const modified = await client.send(
    new ModifyGlobalClusterCommand({
      GlobalClusterIdentifier: gcId,
      DeletionProtection: true,
    }),
  );
  expect(modified.GlobalCluster?.DeletionProtection).toBe(true);

  const deleted = await client.send(
    new DeleteGlobalClusterCommand({
      GlobalClusterIdentifier: gcId,
    }),
  );
  expect(deleted.GlobalCluster?.Status).toBe("deleting");
});

test("option group lifecycle", async () => {
  const client = rds();
  const ogName = "e2e-option-group";

  const created = await client.send(
    new CreateOptionGroupCommand({
      OptionGroupName: ogName,
      EngineName: "mysql",
      MajorEngineVersion: "8.0",
      OptionGroupDescription: "E2E test option group",
    }),
  );
  expect(created.OptionGroup?.OptionGroupName).toBe(ogName);
  expect(created.OptionGroup?.EngineName).toBe("mysql");

  const listed = await client.send(new DescribeOptionGroupsCommand({}));
  expect(listed.OptionGroupsList?.length).toBeGreaterThanOrEqual(1);

  await client.send(new ModifyOptionGroupCommand({ OptionGroupName: ogName }));

  const options = await client.send(
    new DescribeOptionGroupOptionsCommand({ EngineName: "mysql" }),
  );
  expect(options.OptionGroupOptions?.length).toBeGreaterThanOrEqual(1);

  await client.send(new DeleteOptionGroupCommand({ OptionGroupName: ogName }));

  const afterDelete = await client.send(new DescribeOptionGroupsCommand({}));
  const found = afterDelete.OptionGroupsList?.find(
    (og) => og.OptionGroupName === ogName,
  );
  expect(found).toBeUndefined();
});

test("event subscription lifecycle", async () => {
  const client = rds();
  const subName = "e2e-event-sub";

  const created = await client.send(
    new CreateEventSubscriptionCommand({
      SubscriptionName: subName,
      SnsTopicArn: "arn:aws:sns:us-east-1:123456789012:rds-events",
      SourceType: "db-instance",
      Enabled: true,
    }),
  );
  expect(created.EventSubscription?.CustSubscriptionId).toBe(subName);
  expect(created.EventSubscription?.Status).toBe("active");
  expect(created.EventSubscription?.Enabled).toBe(true);

  const listed = await client.send(new DescribeEventSubscriptionsCommand({}));
  expect(listed.EventSubscriptionsList?.length).toBeGreaterThanOrEqual(1);

  const withSource = await client.send(
    new AddSourceIdentifierToSubscriptionCommand({
      SubscriptionName: subName,
      SourceIdentifier: "my-db-instance",
    }),
  );
  expect(withSource.EventSubscription?.SourceIdsList).toContain(
    "my-db-instance",
  );

  const removed = await client.send(
    new RemoveSourceIdentifierFromSubscriptionCommand({
      SubscriptionName: subName,
      SourceIdentifier: "my-db-instance",
    }),
  );
  expect(removed.EventSubscription?.SourceIdsList).not.toContain(
    "my-db-instance",
  );

  const modified = await client.send(
    new ModifyEventSubscriptionCommand({
      SubscriptionName: subName,
      Enabled: false,
    }),
  );
  expect(modified.EventSubscription?.Enabled).toBe(false);

  const cats = await client.send(new DescribeEventCategoriesCommand({}));
  expect(cats.EventCategoriesMapList?.length).toBeGreaterThanOrEqual(1);

  await client.send(
    new DeleteEventSubscriptionCommand({ SubscriptionName: subName }),
  );
});

test("blue-green deployment lifecycle", async () => {
  const client = rds();
  const bgName = "e2e-blue-green";

  const created = await client.send(
    new CreateBlueGreenDeploymentCommand({
      BlueGreenDeploymentName: bgName,
      Source: "arn:aws:rds:us-east-1:123456789012:cluster:my-source-cluster",
    }),
  );
  expect(created.BlueGreenDeployment?.BlueGreenDeploymentName).toBe(bgName);
  expect(created.BlueGreenDeployment?.Status).toBe("PROVISIONING");

  const listed = await client.send(new DescribeBlueGreenDeploymentsCommand({}));
  expect(listed.BlueGreenDeployments?.length).toBeGreaterThanOrEqual(1);

  const bgId = created.BlueGreenDeployment?.BlueGreenDeploymentIdentifier ?? "";

  const deleted = await client.send(
    new DeleteBlueGreenDeploymentCommand({
      BlueGreenDeploymentIdentifier: bgId,
    }),
  );
  expect(deleted.BlueGreenDeployment?.Status).toBe("DELETING");
});

test("export task lifecycle", async () => {
  const client = rds();

  const started = await client.send(
    new StartExportTaskCommand({
      ExportTaskIdentifier: "e2e-export-task",
      SourceArn: "arn:aws:rds:us-east-1:123456789012:snapshot:my-snapshot",
      S3BucketName: "my-export-bucket",
      IamRoleArn: "arn:aws:iam::123456789012:role/export-role",
      KmsKeyId: "arn:aws:kms:us-east-1:123456789012:key/my-key",
    }),
  );
  expect(started.ExportTaskIdentifier).toBe("e2e-export-task");
  expect(started.Status).toBe("starting");

  const canceled = await client.send(
    new CancelExportTaskCommand({ ExportTaskIdentifier: "e2e-export-task" }),
  );
  expect(canceled.Status).toBe("canceled");
});

test("tenant database lifecycle", async () => {
  const client = rds();

  await client.send(
    new CreateDBInstanceCommand({
      DBInstanceIdentifier: "e2e-tenant-instance",
      DBInstanceClass: "db.t3.micro",
      Engine: "oracle-se2-cdb",
      MasterUsername: "admin",
      MasterUserPassword: "password123",
    }),
  );

  const created = await client.send(
    new CreateTenantDatabaseCommand({
      DBInstanceIdentifier: "e2e-tenant-instance",
      TenantDBName: "e2e-tenant-db",
      MasterUsername: "tenant_admin",
      MasterUserPassword: "password123",
    }),
  );
  expect(created.TenantDatabase?.TenantDBName).toBe("e2e-tenant-db");
  expect(created.TenantDatabase?.Status).toBe("available");

  const listed = await client.send(new DescribeTenantDatabasesCommand({}));
  expect(listed.TenantDatabases?.length).toBeGreaterThanOrEqual(1);

  await client.send(
    new DeleteTenantDatabaseCommand({
      DBInstanceIdentifier: "e2e-tenant-instance",
      TenantDBName: "e2e-tenant-db",
    }),
  );
});

test("reserved instance purchase and list", async () => {
  const client = rds();

  const offerings = await client.send(
    new DescribeReservedDBInstancesOfferingsCommand({}),
  );
  expect(offerings.ReservedDBInstancesOfferings?.length).toBeGreaterThanOrEqual(
    1,
  );

  const offeringId =
    offerings.ReservedDBInstancesOfferings?.[0]
      ?.ReservedDBInstancesOfferingId ?? "";
  const purchased = await client.send(
    new PurchaseReservedDBInstancesOfferingCommand({
      ReservedDBInstancesOfferingId: offeringId,
      ReservedDBInstanceId: "e2e-reserved-1",
    }),
  );
  expect(purchased.ReservedDBInstance?.ReservedDBInstanceId).toBe(
    "e2e-reserved-1",
  );
  expect(purchased.ReservedDBInstance?.State).toBe("active");

  const listed = await client.send(new DescribeReservedDBInstancesCommand({}));
  expect(listed.ReservedDBInstances?.length).toBeGreaterThanOrEqual(1);
});

test("misc describe operations", async () => {
  const client = rds();

  const certs = await client.send(new DescribeCertificatesCommand({}));
  expect(certs.Certificates?.length).toBeGreaterThanOrEqual(1);

  const engines = await client.send(new DescribeDBEngineVersionsCommand({}));
  expect(engines.DBEngineVersions?.length).toBeGreaterThanOrEqual(1);

  const majorVersions = await client.send(
    new DescribeDBMajorEngineVersionsCommand({}),
  );
  expect(majorVersions.DBMajorEngineVersions?.length).toBeGreaterThanOrEqual(1);

  const shardGroups = await client.send(new DescribeDBShardGroupsCommand({}));
  expect(shardGroups.DBShardGroups).toBeDefined();

  const sourceRegions = await client.send(new DescribeSourceRegionsCommand({}));
  expect(sourceRegions.SourceRegions?.length).toBeGreaterThanOrEqual(1);

  const slv2 = await client.send(
    new DescribeServerlessV2PlatformVersionsCommand({}),
  );
  expect(slv2.ServerlessV2PlatformVersions?.length).toBeGreaterThanOrEqual(1);
});
