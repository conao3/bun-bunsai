import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AddTagsToResourceCommand,
  AuthorizeDBSecurityGroupIngressCommand,
  CopyDBClusterParameterGroupCommand,
  CopyDBClusterSnapshotCommand,
  CreateDBClusterCommand,
  CreateDBClusterEndpointCommand,
  CreateDBClusterParameterGroupCommand,
  CreateDBClusterSnapshotCommand,
  CreateDBSecurityGroupCommand,
  DeleteDBClusterCommand,
  DeleteDBClusterEndpointCommand,
  DeleteDBClusterParameterGroupCommand,
  DeleteDBClusterSnapshotCommand,
  DeleteDBSecurityGroupCommand,
  DescribeDBClusterEndpointsCommand,
  DescribeDBClusterParameterGroupsCommand,
  DescribeDBClusterSnapshotAttributesCommand,
  DescribeDBClusterSnapshotsCommand,
  DescribeDBClustersCommand,
  DescribeDBSecurityGroupsCommand,
  FailoverDBClusterCommand,
  ListTagsForResourceCommand,
  ModifyDBClusterCommand,
  ModifyDBClusterEndpointCommand,
  ModifyDBClusterParameterGroupCommand,
  ModifyDBClusterSnapshotAttributeCommand,
  RDSClient,
  RebootDBClusterCommand,
  RemoveTagsFromResourceCommand,
  RestoreDBClusterFromSnapshotCommand,
  RevokeDBSecurityGroupIngressCommand,
  StartDBClusterCommand,
  StopDBClusterCommand,
} from "@aws-sdk/client-rds";

const awsPort = 4748;
const uiPort = 5748;
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

test("RDS DB cluster lifecycle round-trip", async () => {
  const client = rds();
  const clusterId = "bunsai-e2e-cluster";

  const created = await client.send(
    new CreateDBClusterCommand({
      DBClusterIdentifier: clusterId,
      Engine: "aurora-mysql",
      MasterUsername: "admin",
      MasterUserPassword: "password123",
    }),
  );
  expect(created.DBCluster?.DBClusterIdentifier).toBe(clusterId);
  expect(created.DBCluster?.Engine).toBe("aurora-mysql");
  expect(created.DBCluster?.Status).toBe("available");
  expect(created.DBCluster?.Endpoint).toContain(clusterId);

  const described = await client.send(
    new DescribeDBClustersCommand({ DBClusterIdentifier: clusterId }),
  );
  expect(described.DBClusters?.length).toBe(1);
  expect(described.DBClusters?.[0]?.MasterUsername).toBe("admin");

  const stopped = await client.send(
    new StopDBClusterCommand({ DBClusterIdentifier: clusterId }),
  );
  expect(stopped.DBCluster?.Status).toBe("stopped");

  const started = await client.send(
    new StartDBClusterCommand({ DBClusterIdentifier: clusterId }),
  );
  expect(started.DBCluster?.Status).toBe("available");

  const modified = await client.send(
    new ModifyDBClusterCommand({
      DBClusterIdentifier: clusterId,
      BackupRetentionPeriod: 7,
    }),
  );
  expect(modified.DBCluster?.BackupRetentionPeriod).toBe(7);

  const rebooted = await client.send(
    new RebootDBClusterCommand({ DBClusterIdentifier: clusterId }),
  );
  expect(rebooted.DBCluster?.DBClusterIdentifier).toBe(clusterId);

  const failed = await client.send(
    new FailoverDBClusterCommand({ DBClusterIdentifier: clusterId }),
  );
  expect(failed.DBCluster?.DBClusterIdentifier).toBe(clusterId);

  const deleted = await client.send(
    new DeleteDBClusterCommand({
      DBClusterIdentifier: clusterId,
      SkipFinalSnapshot: true,
    }),
  );
  expect(deleted.DBCluster?.Status).toBe("deleting");

  await expect(
    client.send(
      new DescribeDBClustersCommand({ DBClusterIdentifier: clusterId }),
    ),
  ).rejects.toThrow();
});

test("RDS DB cluster parameter group round-trip", async () => {
  const client = rds();
  const name = "bunsai-e2e-cluster-pg";

  const created = await client.send(
    new CreateDBClusterParameterGroupCommand({
      DBClusterParameterGroupName: name,
      DBParameterGroupFamily: "aurora-mysql8.0",
      Description: "bunsai e2e cluster parameter group",
    }),
  );
  expect(created.DBClusterParameterGroup?.DBClusterParameterGroupName).toBe(
    name,
  );
  expect(created.DBClusterParameterGroup?.DBParameterGroupFamily).toBe(
    "aurora-mysql8.0",
  );
  expect(created.DBClusterParameterGroup?.DBClusterParameterGroupArn).toContain(
    name,
  );

  const described = await client.send(
    new DescribeDBClusterParameterGroupsCommand({
      DBClusterParameterGroupName: name,
    }),
  );
  expect(described.DBClusterParameterGroups?.length).toBe(1);
  expect(
    described.DBClusterParameterGroups?.[0]?.DBClusterParameterGroupName,
  ).toBe(name);

  const modified = await client.send(
    new ModifyDBClusterParameterGroupCommand({
      DBClusterParameterGroupName: name,
      Parameters: [],
    }),
  );
  expect(modified.DBClusterParameterGroupName).toBe(name);

  const copyName = "bunsai-e2e-cluster-pg-copy";
  const copied = await client.send(
    new CopyDBClusterParameterGroupCommand({
      SourceDBClusterParameterGroupIdentifier: name,
      TargetDBClusterParameterGroupIdentifier: copyName,
      TargetDBClusterParameterGroupDescription: "copy of bunsai e2e",
    }),
  );
  expect(copied.DBClusterParameterGroup?.DBClusterParameterGroupName).toBe(
    copyName,
  );

  await client.send(
    new DeleteDBClusterParameterGroupCommand({
      DBClusterParameterGroupName: name,
    }),
  );
  await client.send(
    new DeleteDBClusterParameterGroupCommand({
      DBClusterParameterGroupName: copyName,
    }),
  );

  await expect(
    client.send(
      new DescribeDBClusterParameterGroupsCommand({
        DBClusterParameterGroupName: name,
      }),
    ),
  ).rejects.toThrow();
});

test("RDS DB cluster snapshot round-trip", async () => {
  const client = rds();
  const clusterId = "bunsai-e2e-cluster-for-snap";
  const snapshotId = "bunsai-e2e-cluster-snap";

  await client.send(
    new CreateDBClusterCommand({
      DBClusterIdentifier: clusterId,
      Engine: "aurora-postgresql",
    }),
  );

  const created = await client.send(
    new CreateDBClusterSnapshotCommand({
      DBClusterSnapshotIdentifier: snapshotId,
      DBClusterIdentifier: clusterId,
    }),
  );
  expect(created.DBClusterSnapshot?.DBClusterSnapshotIdentifier).toBe(
    snapshotId,
  );
  expect(created.DBClusterSnapshot?.DBClusterIdentifier).toBe(clusterId);
  expect(created.DBClusterSnapshot?.Status).toBe("available");
  expect(created.DBClusterSnapshot?.Engine).toBe("aurora-postgresql");

  const described = await client.send(
    new DescribeDBClusterSnapshotsCommand({
      DBClusterSnapshotIdentifier: snapshotId,
    }),
  );
  expect(described.DBClusterSnapshots?.length).toBe(1);

  const byCluster = await client.send(
    new DescribeDBClusterSnapshotsCommand({
      DBClusterIdentifier: clusterId,
    }),
  );
  const ids = (byCluster.DBClusterSnapshots ?? []).map(
    (s) => s.DBClusterSnapshotIdentifier,
  );
  expect(ids).toContain(snapshotId);

  const attrs = await client.send(
    new DescribeDBClusterSnapshotAttributesCommand({
      DBClusterSnapshotIdentifier: snapshotId,
    }),
  );
  expect(
    attrs.DBClusterSnapshotAttributesResult?.DBClusterSnapshotIdentifier,
  ).toBe(snapshotId);

  await client.send(
    new ModifyDBClusterSnapshotAttributeCommand({
      DBClusterSnapshotIdentifier: snapshotId,
      AttributeName: "restore",
    }),
  );

  const copyId = "bunsai-e2e-cluster-snap-copy";
  const copied = await client.send(
    new CopyDBClusterSnapshotCommand({
      SourceDBClusterSnapshotIdentifier: snapshotId,
      TargetDBClusterSnapshotIdentifier: copyId,
    }),
  );
  expect(copied.DBClusterSnapshot?.DBClusterSnapshotIdentifier).toBe(copyId);

  const restored = await client.send(
    new RestoreDBClusterFromSnapshotCommand({
      DBClusterIdentifier: "bunsai-e2e-restored-cluster",
      SnapshotIdentifier: snapshotId,
      Engine: "aurora-postgresql",
    }),
  );
  expect(restored.DBCluster?.DBClusterIdentifier).toBe(
    "bunsai-e2e-restored-cluster",
  );
  expect(restored.DBCluster?.Engine).toBe("aurora-postgresql");

  await client.send(
    new DeleteDBClusterSnapshotCommand({
      DBClusterSnapshotIdentifier: snapshotId,
    }),
  );
  await client.send(
    new DeleteDBClusterSnapshotCommand({
      DBClusterSnapshotIdentifier: copyId,
    }),
  );

  await client.send(
    new DeleteDBClusterCommand({
      DBClusterIdentifier: clusterId,
      SkipFinalSnapshot: true,
    }),
  );
  await client.send(
    new DeleteDBClusterCommand({
      DBClusterIdentifier: "bunsai-e2e-restored-cluster",
      SkipFinalSnapshot: true,
    }),
  );
});

test("RDS DB security group round-trip", async () => {
  const client = rds();
  const name = "bunsai-e2e-secgrp";

  const created = await client.send(
    new CreateDBSecurityGroupCommand({
      DBSecurityGroupName: name,
      DBSecurityGroupDescription: "bunsai e2e security group",
    }),
  );
  expect(created.DBSecurityGroup?.DBSecurityGroupName).toBe(name);
  expect(created.DBSecurityGroup?.DBSecurityGroupDescription).toBe(
    "bunsai e2e security group",
  );
  expect(created.DBSecurityGroup?.DBSecurityGroupArn).toContain(name);

  const described = await client.send(
    new DescribeDBSecurityGroupsCommand({ DBSecurityGroupName: name }),
  );
  expect(described.DBSecurityGroups?.length).toBe(1);
  expect(described.DBSecurityGroups?.[0]?.DBSecurityGroupName).toBe(name);

  const authorized = await client.send(
    new AuthorizeDBSecurityGroupIngressCommand({
      DBSecurityGroupName: name,
      CIDRIP: "10.0.0.0/8",
    }),
  );
  expect(authorized.DBSecurityGroup?.IPRanges?.length).toBeGreaterThan(0);

  const revoked = await client.send(
    new RevokeDBSecurityGroupIngressCommand({
      DBSecurityGroupName: name,
      CIDRIP: "10.0.0.0/8",
    }),
  );
  expect(revoked.DBSecurityGroup?.IPRanges?.length).toBe(0);

  await client.send(
    new DeleteDBSecurityGroupCommand({ DBSecurityGroupName: name }),
  );

  await expect(
    client.send(
      new DescribeDBSecurityGroupsCommand({ DBSecurityGroupName: name }),
    ),
  ).rejects.toThrow();
});

test("RDS DB cluster endpoint round-trip", async () => {
  const client = rds();
  const clusterId = "bunsai-e2e-cluster-ep";
  const endpointId = "bunsai-e2e-custom-ep";

  await client.send(
    new CreateDBClusterCommand({
      DBClusterIdentifier: clusterId,
      Engine: "aurora-mysql",
    }),
  );

  const created = await client.send(
    new CreateDBClusterEndpointCommand({
      DBClusterIdentifier: clusterId,
      DBClusterEndpointIdentifier: endpointId,
      EndpointType: "READER",
    }),
  );
  expect(created.DBClusterEndpointIdentifier).toBe(endpointId);
  expect(created.DBClusterIdentifier).toBe(clusterId);
  expect(created.Status).toBe("available");

  const listed = await client.send(
    new DescribeDBClusterEndpointsCommand({
      DBClusterIdentifier: clusterId,
    }),
  );
  const epIds = (listed.DBClusterEndpoints ?? []).map(
    (e) => e.DBClusterEndpointIdentifier,
  );
  expect(epIds).toContain(endpointId);

  const modified = await client.send(
    new ModifyDBClusterEndpointCommand({
      DBClusterEndpointIdentifier: endpointId,
      StaticMembers: ["instance-1"],
    }),
  );
  expect(modified.DBClusterEndpointIdentifier).toBe(endpointId);
  expect(modified.StaticMembers).toContain("instance-1");

  const deleted = await client.send(
    new DeleteDBClusterEndpointCommand({
      DBClusterEndpointIdentifier: endpointId,
    }),
  );
  expect(deleted.Status).toBe("deleting");

  await client.send(
    new DeleteDBClusterCommand({
      DBClusterIdentifier: clusterId,
      SkipFinalSnapshot: true,
    }),
  );
});

test("RDS tags round-trip", async () => {
  const client = rds();
  const clusterId = "bunsai-e2e-tags-cluster";

  const created = await client.send(
    new CreateDBClusterCommand({
      DBClusterIdentifier: clusterId,
      Engine: "aurora-mysql",
    }),
  );
  const arn = created.DBCluster?.DBClusterArn ?? "";

  await client.send(
    new AddTagsToResourceCommand({
      ResourceName: arn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "project", Value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceName: arn }),
  );
  const tagMap = Object.fromEntries(
    (listed.TagList ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap["env"]).toBe("test");
  expect(tagMap["project"]).toBe("bunsai");

  await client.send(
    new RemoveTagsFromResourceCommand({
      ResourceName: arn,
      TagKeys: ["env"],
    }),
  );

  const after = await client.send(
    new ListTagsForResourceCommand({ ResourceName: arn }),
  );
  const afterKeys = (after.TagList ?? []).map((t) => t.Key);
  expect(afterKeys).not.toContain("env");
  expect(afterKeys).toContain("project");

  await client.send(
    new DeleteDBClusterCommand({
      DBClusterIdentifier: clusterId,
      SkipFinalSnapshot: true,
    }),
  );
});
