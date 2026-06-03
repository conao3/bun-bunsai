import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateClusterCommand,
  CreateSubnetGroupCommand,
  DAXClient,
  DeleteClusterCommand,
  DescribeClustersCommand,
  DescribeSubnetGroupsCommand,
} from "@aws-sdk/client-dax";
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

const dax = () =>
  new DAXClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("DAX cluster and subnet group lifecycle", async () => {
  const client = dax();
  const name = "bunsai-e2e-dax";

  const created = await client.send(
    new CreateClusterCommand({
      ClusterName: name,
      NodeType: "dax.r4.large",
      ReplicationFactor: 3,
      IamRoleArn: "arn:aws:iam::000000000000:role/dax",
    }),
  );
  expect(created.Cluster?.ClusterName).toBe(name);
  expect(created.Cluster?.Status).toBe("available");
  expect(created.Cluster?.TotalNodes).toBe(3);
  expect(created.Cluster?.ClusterArn).toContain(name);

  const described = await client.send(
    new DescribeClustersCommand({ ClusterNames: [name] }),
  );
  expect((described.Clusters ?? [])[0]?.ClusterName).toBe(name);

  const sng = await client.send(
    new CreateSubnetGroupCommand({
      SubnetGroupName: "bunsai-e2e-dax-sng",
      SubnetIds: ["subnet-aaaa1111", "subnet-bbbb2222"],
    }),
  );
  expect(sng.SubnetGroup?.SubnetGroupName).toBe("bunsai-e2e-dax-sng");
  expect(sng.SubnetGroup?.Subnets?.length).toBe(2);

  const sngs = await client.send(new DescribeSubnetGroupsCommand({}));
  expect(
    (sngs.SubnetGroups ?? []).some(
      (g) => g.SubnetGroupName === "bunsai-e2e-dax-sng",
    ),
  ).toBe(true);

  const deleted = await client.send(
    new DeleteClusterCommand({ ClusterName: name }),
  );
  expect(deleted.Cluster?.Status).toBe("deleting");
});
