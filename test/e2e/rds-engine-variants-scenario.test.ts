import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  DocDBClient,
  CreateDBClusterCommand as DocDBCreateDBClusterCommand,
  DescribeDBClustersCommand as DocDBDescribeDBClustersCommand,
  CreateDBInstanceCommand as DocDBCreateDBInstanceCommand,
  DescribeDBInstancesCommand as DocDBDescribeDBInstancesCommand,
  DeleteDBInstanceCommand as DocDBDeleteDBInstanceCommand,
  DeleteDBClusterCommand as DocDBDeleteDBClusterCommand,
} from "@aws-sdk/client-docdb";
import {
  NeptuneClient,
  CreateDBClusterCommand as NeptuneCreateDBClusterCommand,
  DescribeDBClustersCommand as NeptuneDescribeDBClustersCommand,
  CreateDBInstanceCommand as NeptuneCreateDBInstanceCommand,
  DescribeDBInstancesCommand as NeptuneDescribeDBInstancesCommand,
  DeleteDBInstanceCommand as NeptuneDeleteDBInstanceCommand,
  DeleteDBClusterCommand as NeptuneDeleteDBClusterCommand,
} from "@aws-sdk/client-neptune";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

test("DocumentDB cluster lifecycle via client-docdb", async () => {
  const client = new DocDBClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });
  const clusterId = "docdb-e2e-cluster";
  const instanceId = "docdb-e2e-instance";

  const created = await client.send(
    new DocDBCreateDBClusterCommand({
      DBClusterIdentifier: clusterId,
      Engine: "docdb",
      MasterUsername: "admin",
      MasterUserPassword: "password123",
    }),
  );
  expect(created.DBCluster?.DBClusterIdentifier).toBe(clusterId);
  expect(created.DBCluster?.Engine).toBe("docdb");
  expect(created.DBCluster?.Status).toBe("available");
  expect(created.DBCluster?.Port).toBe(27017);
  expect(created.DBCluster?.EngineVersion).toBeDefined();
  expect(created.DBCluster?.Endpoint).toContain(clusterId);

  const described = await client.send(
    new DocDBDescribeDBClustersCommand({ DBClusterIdentifier: clusterId }),
  );
  expect(described.DBClusters?.length).toBe(1);
  expect(described.DBClusters?.[0]?.DBClusterIdentifier).toBe(clusterId);
  expect(described.DBClusters?.[0]?.Engine).toBe("docdb");
  expect(described.DBClusters?.[0]?.Port).toBe(27017);

  const instanceCreated = await client.send(
    new DocDBCreateDBInstanceCommand({
      DBInstanceIdentifier: instanceId,
      DBClusterIdentifier: clusterId,
      DBInstanceClass: "db.r5.large",
      Engine: "docdb",
    }),
  );
  expect(instanceCreated.DBInstance?.DBInstanceIdentifier).toBe(instanceId);
  expect(instanceCreated.DBInstance?.Engine).toBe("docdb");
  expect(instanceCreated.DBInstance?.Endpoint?.Port).toBe(27017);

  const instanceDescribed = await client.send(
    new DocDBDescribeDBInstancesCommand({ DBInstanceIdentifier: instanceId }),
  );
  expect(instanceDescribed.DBInstances?.length).toBe(1);
  expect(instanceDescribed.DBInstances?.[0]?.DBInstanceIdentifier).toBe(
    instanceId,
  );

  await client.send(
    new DocDBDeleteDBInstanceCommand({
      DBInstanceIdentifier: instanceId,
    }),
  );

  const deleted = await client.send(
    new DocDBDeleteDBClusterCommand({
      DBClusterIdentifier: clusterId,
      SkipFinalSnapshot: true,
    }),
  );
  expect(deleted.DBCluster?.DBClusterIdentifier).toBe(clusterId);
});

test("Neptune cluster lifecycle via client-neptune", async () => {
  const client = new NeptuneClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });
  const clusterId = "neptune-e2e-cluster";
  const instanceId = "neptune-e2e-instance";

  const created = await client.send(
    new NeptuneCreateDBClusterCommand({
      DBClusterIdentifier: clusterId,
      Engine: "neptune",
    }),
  );
  expect(created.DBCluster?.DBClusterIdentifier).toBe(clusterId);
  expect(created.DBCluster?.Engine).toBe("neptune");
  expect(created.DBCluster?.Status).toBe("available");
  expect(created.DBCluster?.Port).toBe(8182);
  expect(created.DBCluster?.EngineVersion).toBeDefined();
  expect(created.DBCluster?.Endpoint).toContain(clusterId);

  const described = await client.send(
    new NeptuneDescribeDBClustersCommand({ DBClusterIdentifier: clusterId }),
  );
  expect(described.DBClusters?.length).toBe(1);
  expect(described.DBClusters?.[0]?.DBClusterIdentifier).toBe(clusterId);
  expect(described.DBClusters?.[0]?.Engine).toBe("neptune");
  expect(described.DBClusters?.[0]?.Port).toBe(8182);

  const instanceCreated = await client.send(
    new NeptuneCreateDBInstanceCommand({
      DBInstanceIdentifier: instanceId,
      DBClusterIdentifier: clusterId,
      DBInstanceClass: "db.r5.large",
      Engine: "neptune",
    }),
  );
  expect(instanceCreated.DBInstance?.DBInstanceIdentifier).toBe(instanceId);
  expect(instanceCreated.DBInstance?.Engine).toBe("neptune");
  expect(instanceCreated.DBInstance?.Endpoint?.Port).toBe(8182);

  const instanceDescribed = await client.send(
    new NeptuneDescribeDBInstancesCommand({ DBInstanceIdentifier: instanceId }),
  );
  expect(instanceDescribed.DBInstances?.length).toBe(1);
  expect(instanceDescribed.DBInstances?.[0]?.DBInstanceIdentifier).toBe(
    instanceId,
  );

  await client.send(
    new NeptuneDeleteDBInstanceCommand({
      DBInstanceIdentifier: instanceId,
    }),
  );

  const deleted = await client.send(
    new NeptuneDeleteDBClusterCommand({
      DBClusterIdentifier: clusterId,
      SkipFinalSnapshot: true,
    }),
  );
  expect(deleted.DBCluster?.DBClusterIdentifier).toBe(clusterId);
});
