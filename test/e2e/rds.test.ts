import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDBInstanceCommand,
  CreateDBSnapshotCommand,
  DeleteDBInstanceCommand,
  DescribeDBInstancesCommand,
  DescribeDBSnapshotsCommand,
  RDSClient,
  StartDBInstanceCommand,
  StopDBInstanceCommand,
} from "@aws-sdk/client-rds";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const rds = () =>
  new RDSClient({ endpoint, region, credentials, requestHandler });

test("RDS DB instance lifecycle round-trip", async () => {
  const client = rds();
  const id = "bunsai-e2e-db";

  const created = await client.send(
    new CreateDBInstanceCommand({
      DBInstanceIdentifier: id,
      DBInstanceClass: "db.t3.micro",
      Engine: "mysql",
      AllocatedStorage: 20,
      MasterUsername: "admin",
      MasterUserPassword: "password123",
    }),
  );
  expect(created.DBInstance?.DBInstanceIdentifier).toBe(id);
  expect(created.DBInstance?.DBInstanceStatus).toBe("available");
  expect(created.DBInstance?.Engine).toBe("mysql");
  expect(created.DBInstance?.Endpoint?.Address).toContain(id);

  const described = await client.send(
    new DescribeDBInstancesCommand({ DBInstanceIdentifier: id }),
  );
  expect(described.DBInstances?.length).toBe(1);
  expect(described.DBInstances?.[0]?.DBInstanceIdentifier).toBe(id);
  expect(described.DBInstances?.[0]?.AllocatedStorage).toBe(20);

  const stopped = await client.send(
    new StopDBInstanceCommand({ DBInstanceIdentifier: id }),
  );
  expect(stopped.DBInstance?.DBInstanceStatus).toBe("stopped");

  const started = await client.send(
    new StartDBInstanceCommand({ DBInstanceIdentifier: id }),
  );
  expect(started.DBInstance?.DBInstanceStatus).toBe("available");

  const deleted = await client.send(
    new DeleteDBInstanceCommand({
      DBInstanceIdentifier: id,
      SkipFinalSnapshot: true,
    }),
  );
  expect(deleted.DBInstance?.DBInstanceStatus).toBe("deleting");

  await expect(
    client.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: id })),
  ).rejects.toThrow();
});

test("RDS DB snapshot round-trip", async () => {
  const client = rds();
  const instanceId = "bunsai-e2e-snap-db";
  const snapshotId = "bunsai-e2e-snap";

  await client.send(
    new CreateDBInstanceCommand({
      DBInstanceIdentifier: instanceId,
      DBInstanceClass: "db.t3.micro",
      Engine: "postgres",
      AllocatedStorage: 30,
    }),
  );

  const created = await client.send(
    new CreateDBSnapshotCommand({
      DBSnapshotIdentifier: snapshotId,
      DBInstanceIdentifier: instanceId,
    }),
  );
  expect(created.DBSnapshot?.DBSnapshotIdentifier).toBe(snapshotId);
  expect(created.DBSnapshot?.DBInstanceIdentifier).toBe(instanceId);
  expect(created.DBSnapshot?.Status).toBe("available");
  expect(created.DBSnapshot?.AllocatedStorage).toBe(30);

  const described = await client.send(
    new DescribeDBSnapshotsCommand({ DBSnapshotIdentifier: snapshotId }),
  );
  expect(described.DBSnapshots?.length).toBe(1);
  expect(described.DBSnapshots?.[0]?.Engine).toBe("postgres");

  const byInstance = await client.send(
    new DescribeDBSnapshotsCommand({ DBInstanceIdentifier: instanceId }),
  );
  const ids = (byInstance.DBSnapshots ?? []).map((s) => s.DBSnapshotIdentifier);
  expect(ids).toContain(snapshotId);

  await client.send(
    new DeleteDBInstanceCommand({
      DBInstanceIdentifier: instanceId,
      SkipFinalSnapshot: true,
    }),
  );
});
