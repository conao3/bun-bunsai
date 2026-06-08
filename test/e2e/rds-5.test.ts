import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDBInstanceCommand,
  CreateDBParameterGroupCommand,
  DescribeDBInstancesCommand,
  DescribeDBParametersCommand,
  ModifyDBInstanceCommand,
  ModifyDBParameterGroupCommand,
  RDSClient,
  ResetDBParameterGroupCommand,
} from "@aws-sdk/client-rds";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const rds = () =>
  new RDSClient({ endpoint, region, credentials, requestHandler });

test("ModifyDBInstance persists params and DescribeDBInstances reflects them", async () => {
  const client = rds();
  const id = "rds5-modify-instance";

  await client.send(
    new CreateDBInstanceCommand({
      DBInstanceIdentifier: id,
      DBInstanceClass: "db.t3.micro",
      Engine: "mysql",
      AllocatedStorage: 20,
      MasterUsername: "admin",
      MasterUserPassword: "password123",
    }),
  );

  const modified = await client.send(
    new ModifyDBInstanceCommand({
      DBInstanceIdentifier: id,
      DBInstanceClass: "db.t3.medium",
      AllocatedStorage: 50,
      BackupRetentionPeriod: 7,
      MultiAZ: true,
      PreferredBackupWindow: "03:00-04:00",
      PreferredMaintenanceWindow: "mon:05:00-mon:06:00",
      VpcSecurityGroupIds: ["sg-0001", "sg-0002"],
    }),
  );
  expect(modified.DBInstance?.DBInstanceClass).toBe("db.t3.medium");
  expect(modified.DBInstance?.AllocatedStorage).toBe(50);
  expect(modified.DBInstance?.BackupRetentionPeriod).toBe(7);
  expect(modified.DBInstance?.MultiAZ).toBe(true);
  expect(modified.DBInstance?.PreferredBackupWindow).toBe("03:00-04:00");
  expect(modified.DBInstance?.PreferredMaintenanceWindow).toBe(
    "mon:05:00-mon:06:00",
  );
  expect(modified.DBInstance?.VpcSecurityGroups?.length).toBe(2);

  const described = await client.send(
    new DescribeDBInstancesCommand({ DBInstanceIdentifier: id }),
  );
  const inst = described.DBInstances?.[0];
  expect(inst?.DBInstanceClass).toBe("db.t3.medium");
  expect(inst?.AllocatedStorage).toBe(50);
  expect(inst?.BackupRetentionPeriod).toBe(7);
  expect(inst?.MultiAZ).toBe(true);
  expect(inst?.PreferredBackupWindow).toBe("03:00-04:00");
  expect(inst?.VpcSecurityGroups?.[0]?.VpcSecurityGroupId).toBe("sg-0001");
});

test("ModifyDBInstance missing instance returns not-found error", async () => {
  const client = rds();
  await expect(
    client.send(
      new ModifyDBInstanceCommand({
        DBInstanceIdentifier: "rds5-no-such-instance",
        DBInstanceClass: "db.t3.medium",
      }),
    ),
  ).rejects.toThrow();
});

test("ModifyDBParameterGroup persists values and DescribeDBParameters returns them", async () => {
  const client = rds();
  const pgName = "rds5-param-group";

  await client.send(
    new CreateDBParameterGroupCommand({
      DBParameterGroupName: pgName,
      DBParameterGroupFamily: "mysql8.0",
      Description: "E2E test parameter group",
    }),
  );

  const emptyParams = await client.send(
    new DescribeDBParametersCommand({ DBParameterGroupName: pgName }),
  );
  expect(emptyParams.Parameters?.length).toBe(0);

  await client.send(
    new ModifyDBParameterGroupCommand({
      DBParameterGroupName: pgName,
      Parameters: [
        {
          ParameterName: "max_connections",
          ParameterValue: "200",
          ApplyMethod: "pending-reboot",
        },
        {
          ParameterName: "innodb_buffer_pool_size",
          ParameterValue: "134217728",
          ApplyMethod: "pending-reboot",
        },
      ],
    }),
  );

  const params = await client.send(
    new DescribeDBParametersCommand({ DBParameterGroupName: pgName }),
  );
  expect(params.Parameters?.length).toBe(2);
  const maxConn = params.Parameters?.find(
    (p) => p.ParameterName === "max_connections",
  );
  expect(maxConn?.ParameterValue).toBe("200");

  await client.send(
    new ResetDBParameterGroupCommand({
      DBParameterGroupName: pgName,
      ResetAllParameters: true,
    }),
  );

  const afterReset = await client.send(
    new DescribeDBParametersCommand({ DBParameterGroupName: pgName }),
  );
  expect(afterReset.Parameters?.length).toBe(0);
});

test("ModifyDBParameterGroup missing group returns not-found error", async () => {
  const client = rds();
  await expect(
    client.send(
      new ModifyDBParameterGroupCommand({
        DBParameterGroupName: "rds5-no-such-group",
        Parameters: [
          { ParameterName: "max_connections", ParameterValue: "100" },
        ],
      }),
    ),
  ).rejects.toThrow();
});
