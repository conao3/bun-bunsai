import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDBInstanceCommand,
  CreateDBSnapshotCommand,
  DeleteDBInstanceCommand,
  DeleteDBSnapshotCommand,
  DescribeDBInstancesCommand,
  DescribeDBSnapshotsCommand,
  RDSClient,
  RestoreDBInstanceFromDBSnapshotCommand,
} from "@aws-sdk/client-rds";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const rds = () =>
  new RDSClient({ endpoint, region, credentials, requestHandler });

test("RDS snapshot create/restore lifecycle", async () => {
  const client = rds();
  const instanceId = "rds6-src-instance";
  const snapshotId = "rds6-snapshot";
  const restoredId = "rds6-restored-instance";

  await client.send(
    new CreateDBInstanceCommand({
      DBInstanceIdentifier: instanceId,
      DBInstanceClass: "db.t3.micro",
      Engine: "mysql",
      AllocatedStorage: 40,
      MasterUsername: "admin",
      MasterUserPassword: "password123",
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
  expect(created.DBSnapshot?.Engine).toBe("mysql");
  expect(created.DBSnapshot?.AllocatedStorage).toBe(40);

  const described = await client.send(
    new DescribeDBSnapshotsCommand({ DBSnapshotIdentifier: snapshotId }),
  );
  expect(described.DBSnapshots?.length).toBe(1);
  expect(described.DBSnapshots?.[0]?.Status).toBe("available");

  const restored = await client.send(
    new RestoreDBInstanceFromDBSnapshotCommand({
      DBInstanceIdentifier: restoredId,
      DBSnapshotIdentifier: snapshotId,
    }),
  );
  expect(restored.DBInstance?.DBInstanceIdentifier).toBe(restoredId);
  expect(restored.DBInstance?.Engine).toBe("mysql");
  expect(restored.DBInstance?.AllocatedStorage).toBe(40);
  expect(restored.DBInstance?.DBInstanceStatus).toBe("available");

  const instances = await client.send(
    new DescribeDBInstancesCommand({ DBInstanceIdentifier: restoredId }),
  );
  expect(instances.DBInstances?.length).toBe(1);
  expect(instances.DBInstances?.[0]?.DBInstanceIdentifier).toBe(restoredId);

  await client.send(
    new DeleteDBSnapshotCommand({ DBSnapshotIdentifier: snapshotId }),
  );
  await client.send(
    new DeleteDBInstanceCommand({
      DBInstanceIdentifier: instanceId,
      SkipFinalSnapshot: true,
    }),
  );
  await client.send(
    new DeleteDBInstanceCommand({
      DBInstanceIdentifier: restoredId,
      SkipFinalSnapshot: true,
    }),
  );
});

test("RestoreDBInstanceFromDBSnapshot missing snapshot returns error", async () => {
  const client = rds();
  await expect(
    client.send(
      new RestoreDBInstanceFromDBSnapshotCommand({
        DBInstanceIdentifier: "rds6-no-restore",
        DBSnapshotIdentifier: "rds6-no-such-snapshot",
      }),
    ),
  ).rejects.toThrow();
});
