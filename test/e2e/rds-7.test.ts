import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDBInstanceCommand,
  CreateDBInstanceReadReplicaCommand,
  CreateDBParameterGroupCommand,
  CreateDBSubnetGroupCommand,
  DeleteDBInstanceCommand,
  DescribeDBInstancesCommand,
  RDSClient,
} from "@aws-sdk/client-rds";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const rds = () =>
  new RDSClient({ endpoint, region, credentials, requestHandler });

test("CreateDBInstance endpoint and status reflected in DescribeDBInstances", async () => {
  const client = rds();
  const id = "rds7-lifecycle-db";

  await client.send(
    new CreateDBInstanceCommand({
      DBInstanceIdentifier: id,
      DBInstanceClass: "db.t3.micro",
      Engine: "mysql",
      AllocatedStorage: 20,
    }),
  );

  const described = await client.send(
    new DescribeDBInstancesCommand({ DBInstanceIdentifier: id }),
  );
  const inst = described.DBInstances?.[0];
  expect(inst?.DBInstanceStatus).toBe("available");
  expect(inst?.Endpoint?.Address).toContain(id);
  expect(inst?.Endpoint?.Port).toBeGreaterThan(0);

  await client.send(
    new DeleteDBInstanceCommand({
      DBInstanceIdentifier: id,
      SkipFinalSnapshot: true,
    }),
  );
});

test("CreateDBInstance with DBParameterGroupName and DBSubnetGroupName associates them", async () => {
  const client = rds();
  const id = "rds7-assoc-db";
  const pgName = "rds7-param-group";
  const sgName = "rds7-subnet-group";

  await client.send(
    new CreateDBParameterGroupCommand({
      DBParameterGroupName: pgName,
      DBParameterGroupFamily: "mysql8.0",
      Description: "rds7 param group",
    }),
  );

  await client.send(
    new CreateDBSubnetGroupCommand({
      DBSubnetGroupName: sgName,
      DBSubnetGroupDescription: "rds7 subnet group",
      SubnetIds: ["subnet-aaaa0001"],
    }),
  );

  const created = await client.send(
    new CreateDBInstanceCommand({
      DBInstanceIdentifier: id,
      DBInstanceClass: "db.t3.micro",
      Engine: "mysql",
      AllocatedStorage: 20,
      DBParameterGroupName: pgName,
      DBSubnetGroupName: sgName,
    }),
  );
  expect(created.DBInstance?.DBParameterGroups?.[0]?.DBParameterGroupName).toBe(
    pgName,
  );
  expect(created.DBInstance?.DBSubnetGroup?.DBSubnetGroupName).toBe(sgName);

  const described = await client.send(
    new DescribeDBInstancesCommand({ DBInstanceIdentifier: id }),
  );
  const inst = described.DBInstances?.[0];
  expect(inst?.DBParameterGroups?.[0]?.DBParameterGroupName).toBe(pgName);
  expect(inst?.DBSubnetGroup?.DBSubnetGroupName).toBe(sgName);

  await client.send(
    new DeleteDBInstanceCommand({
      DBInstanceIdentifier: id,
      SkipFinalSnapshot: true,
    }),
  );
});

test("DescribeDBInstances with db-instance-id filter narrows result set", async () => {
  const client = rds();
  const id1 = "rds7-filter-db-1";
  const id2 = "rds7-filter-db-2";

  await client.send(
    new CreateDBInstanceCommand({
      DBInstanceIdentifier: id1,
      DBInstanceClass: "db.t3.micro",
      Engine: "mysql",
      AllocatedStorage: 20,
    }),
  );
  await client.send(
    new CreateDBInstanceCommand({
      DBInstanceIdentifier: id2,
      DBInstanceClass: "db.t3.micro",
      Engine: "postgres",
      AllocatedStorage: 20,
    }),
  );

  const filtered = await client.send(
    new DescribeDBInstancesCommand({
      Filters: [{ Name: "db-instance-id", Values: [id1] }],
    }),
  );
  expect(filtered.DBInstances?.length).toBe(1);
  expect(filtered.DBInstances?.[0]?.DBInstanceIdentifier).toBe(id1);

  const byEngine = await client.send(
    new DescribeDBInstancesCommand({
      Filters: [{ Name: "engine", Values: ["postgres"] }],
    }),
  );
  const ids = (byEngine.DBInstances ?? []).map((i) => i.DBInstanceIdentifier);
  expect(ids).toContain(id2);
  expect(ids).not.toContain(id1);

  const byStatus = await client.send(
    new DescribeDBInstancesCommand({
      Filters: [{ Name: "db-instance-status", Values: ["available"] }],
    }),
  );
  expect(
    (byStatus.DBInstances ?? []).every(
      (i) => i.DBInstanceStatus === "available",
    ),
  ).toBe(true);

  await client.send(
    new DeleteDBInstanceCommand({
      DBInstanceIdentifier: id1,
      SkipFinalSnapshot: true,
    }),
  );
  await client.send(
    new DeleteDBInstanceCommand({
      DBInstanceIdentifier: id2,
      SkipFinalSnapshot: true,
    }),
  );
});

test("CreateDBInstanceReadReplica sets replica attributes and updates source", async () => {
  const client = rds();
  const srcId = "rds7-src-db";
  const replicaId = "rds7-replica-db";

  await client.send(
    new CreateDBInstanceCommand({
      DBInstanceIdentifier: srcId,
      DBInstanceClass: "db.t3.micro",
      Engine: "mysql",
      AllocatedStorage: 20,
    }),
  );

  const replica = await client.send(
    new CreateDBInstanceReadReplicaCommand({
      DBInstanceIdentifier: replicaId,
      SourceDBInstanceIdentifier: srcId,
    }),
  );
  expect(replica.DBInstance?.DBInstanceIdentifier).toBe(replicaId);
  expect(replica.DBInstance?.ReadReplicaSourceDBInstanceIdentifier).toBe(srcId);
  expect(replica.DBInstance?.ReadReplicaDBInstanceIdentifiers?.length).toBe(0);

  const srcDescribed = await client.send(
    new DescribeDBInstancesCommand({ DBInstanceIdentifier: srcId }),
  );
  expect(
    srcDescribed.DBInstances?.[0]?.ReadReplicaDBInstanceIdentifiers,
  ).toContain(replicaId);
  expect(
    srcDescribed.DBInstances?.[0]?.ReadReplicaSourceDBInstanceIdentifier,
  ).toBeUndefined();

  await client.send(
    new DeleteDBInstanceCommand({
      DBInstanceIdentifier: replicaId,
      SkipFinalSnapshot: true,
    }),
  );
  await client.send(
    new DeleteDBInstanceCommand({
      DBInstanceIdentifier: srcId,
      SkipFinalSnapshot: true,
    }),
  );
});
