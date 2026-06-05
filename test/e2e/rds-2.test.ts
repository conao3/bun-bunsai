import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDBInstanceCommand,
  CreateDBParameterGroupCommand,
  CreateDBSubnetGroupCommand,
  DeleteDBInstanceCommand,
  DeleteDBParameterGroupCommand,
  DeleteDBSubnetGroupCommand,
  DescribeDBParameterGroupsCommand,
  DescribeDBSubnetGroupsCommand,
  RDSClient,
  RebootDBInstanceCommand,
} from "@aws-sdk/client-rds";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const rds = () =>
  new RDSClient({ endpoint, region, credentials, requestHandler });

test("RDS DB parameter group round-trip", async () => {
  const client = rds();
  const name = "bunsai-e2e-pg";

  const created = await client.send(
    new CreateDBParameterGroupCommand({
      DBParameterGroupName: name,
      DBParameterGroupFamily: "mysql8.0",
      Description: "bunsai e2e parameter group",
    }),
  );
  expect(created.DBParameterGroup?.DBParameterGroupName).toBe(name);
  expect(created.DBParameterGroup?.DBParameterGroupFamily).toBe("mysql8.0");
  expect(created.DBParameterGroup?.DBParameterGroupArn).toContain(name);

  const described = await client.send(
    new DescribeDBParameterGroupsCommand({ DBParameterGroupName: name }),
  );
  expect(described.DBParameterGroups?.length).toBe(1);
  expect(described.DBParameterGroups?.[0]?.DBParameterGroupName).toBe(name);

  const listed = await client.send(new DescribeDBParameterGroupsCommand({}));
  const names = (listed.DBParameterGroups ?? []).map(
    (g) => g.DBParameterGroupName,
  );
  expect(names).toContain(name);

  await client.send(
    new DeleteDBParameterGroupCommand({ DBParameterGroupName: name }),
  );

  await expect(
    client.send(
      new DescribeDBParameterGroupsCommand({ DBParameterGroupName: name }),
    ),
  ).rejects.toThrow();
});

test("RDS DB subnet group round-trip", async () => {
  const client = rds();
  const name = "bunsai-e2e-subgrp";

  const created = await client.send(
    new CreateDBSubnetGroupCommand({
      DBSubnetGroupName: name,
      DBSubnetGroupDescription: "bunsai e2e subnet group",
      SubnetIds: ["subnet-aaaa1111", "subnet-bbbb2222"],
    }),
  );
  expect(created.DBSubnetGroup?.DBSubnetGroupName).toBe(name);
  expect(created.DBSubnetGroup?.SubnetGroupStatus).toBe("Complete");
  expect(created.DBSubnetGroup?.Subnets?.length).toBe(2);
  const subnetIds = (created.DBSubnetGroup?.Subnets ?? []).map(
    (s) => s.SubnetIdentifier,
  );
  expect(subnetIds).toContain("subnet-aaaa1111");

  const described = await client.send(
    new DescribeDBSubnetGroupsCommand({ DBSubnetGroupName: name }),
  );
  expect(described.DBSubnetGroups?.length).toBe(1);
  expect(described.DBSubnetGroups?.[0]?.DBSubnetGroupName).toBe(name);
  expect(described.DBSubnetGroups?.[0]?.DBSubnetGroupArn).toContain(name);

  await client.send(
    new DeleteDBSubnetGroupCommand({ DBSubnetGroupName: name }),
  );

  await expect(
    client.send(new DescribeDBSubnetGroupsCommand({ DBSubnetGroupName: name })),
  ).rejects.toThrow();
});

test("RDS reboot DB instance", async () => {
  const client = rds();
  const id = "bunsai-e2e-reboot-db";

  await client.send(
    new CreateDBInstanceCommand({
      DBInstanceIdentifier: id,
      DBInstanceClass: "db.t3.micro",
      Engine: "mysql",
      AllocatedStorage: 20,
    }),
  );

  const rebooted = await client.send(
    new RebootDBInstanceCommand({ DBInstanceIdentifier: id }),
  );
  expect(rebooted.DBInstance?.DBInstanceIdentifier).toBe(id);
  expect(rebooted.DBInstance?.DBInstanceStatus).toBe("available");

  await client.send(
    new DeleteDBInstanceCommand({
      DBInstanceIdentifier: id,
      SkipFinalSnapshot: true,
    }),
  );
});
