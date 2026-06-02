import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateClusterCommand,
  CreateClusterSubnetGroupCommand,
  DeleteClusterCommand,
  DescribeClustersCommand,
  ModifyClusterCommand,
  RedshiftClient,
} from "@aws-sdk/client-redshift";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4566;
const uiPort = 5666;
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

const redshift = () =>
  new RedshiftClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Redshift cluster lifecycle", async () => {
  const client = redshift();
  const clusterId = "bunsai-e2e-cluster";

  const created = await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "ra3.xlplus",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
      DBName: "bunsaidb",
    }),
  );
  expect(created.Cluster?.ClusterIdentifier).toBe(clusterId);
  expect(created.Cluster?.ClusterStatus).toBe("available");
  expect(created.Cluster?.NodeType).toBe("ra3.xlplus");
  expect(created.Cluster?.DBName).toBe("bunsaidb");
  expect(created.Cluster?.Endpoint?.Port).toBe(5439);

  const described = await client.send(
    new DescribeClustersCommand({ ClusterIdentifier: clusterId }),
  );
  const cluster = (described.Clusters ?? [])[0];
  expect(cluster?.ClusterIdentifier).toBe(clusterId);
  expect(cluster?.MasterUsername).toBe("admin");

  const modified = await client.send(
    new ModifyClusterCommand({
      ClusterIdentifier: clusterId,
      AutomatedSnapshotRetentionPeriod: 7,
      PreferredMaintenanceWindow: "sun:05:00-sun:05:30",
    }),
  );
  expect(modified.Cluster?.AutomatedSnapshotRetentionPeriod).toBe(7);
  expect(modified.Cluster?.PreferredMaintenanceWindow).toBe(
    "sun:05:00-sun:05:30",
  );

  const deleted = await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
  expect(deleted.Cluster?.ClusterStatus).toBe("deleting");

  const afterDelete = await client.send(new DescribeClustersCommand({}));
  const remaining = (afterDelete.Clusters ?? []).map(
    (entry) => entry.ClusterIdentifier,
  );
  expect(remaining).not.toContain(clusterId);
});

test("Redshift cluster subnet group", async () => {
  const client = redshift();
  const groupName = "bunsai-e2e-subnetgroup";

  const created = await client.send(
    new CreateClusterSubnetGroupCommand({
      ClusterSubnetGroupName: groupName,
      Description: "bunsai e2e subnet group",
      SubnetIds: ["subnet-aaaa1111", "subnet-bbbb2222"],
    }),
  );
  expect(created.ClusterSubnetGroup?.ClusterSubnetGroupName).toBe(groupName);
  expect(created.ClusterSubnetGroup?.Description).toBe(
    "bunsai e2e subnet group",
  );
  expect((created.ClusterSubnetGroup?.Subnets ?? []).length).toBe(2);
});
