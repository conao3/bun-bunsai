import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateClusterCommand,
  CreateSubnetGroupCommand,
  DeleteClusterCommand,
  DescribeClustersCommand,
  MemoryDBClient,
  UpdateClusterCommand,
} from "@aws-sdk/client-memorydb";
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

const memorydb = () =>
  new MemoryDBClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("MemoryDB cluster and subnet group lifecycle", async () => {
  const client = memorydb();
  const name = "bunsai-e2e-cluster";

  const created = await client.send(
    new CreateClusterCommand({
      ClusterName: name,
      NodeType: "db.r6g.large",
      ACLName: "open-access",
    }),
  );
  expect(created.Cluster?.Name).toBe(name);
  expect(created.Cluster?.Status).toBe("available");
  expect(created.Cluster?.ARN).toContain(name);

  const described = await client.send(new DescribeClustersCommand({}));
  expect((described.Clusters ?? []).some((c) => c.Name === name)).toBe(true);

  const updated = await client.send(
    new UpdateClusterCommand({ ClusterName: name, Description: "updated" }),
  );
  expect(updated.Cluster?.Description).toBe("updated");

  const subnetGroup = await client.send(
    new CreateSubnetGroupCommand({
      SubnetGroupName: "bunsai-e2e-sng",
      SubnetIds: ["subnet-aaaa1111", "subnet-bbbb2222"],
    }),
  );
  expect(subnetGroup.SubnetGroup?.Name).toBe("bunsai-e2e-sng");
  expect(subnetGroup.SubnetGroup?.Subnets?.length).toBe(2);

  const deleted = await client.send(
    new DeleteClusterCommand({ ClusterName: name }),
  );
  expect(deleted.Cluster?.Status).toBe("deleting");
});
