import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateClusterCommand,
  CreateNodegroupCommand,
  DeleteClusterCommand,
  DescribeClusterCommand,
  DescribeNodegroupCommand,
  EKSClient,
  ListClustersCommand,
  ListNodegroupsCommand,
} from "@aws-sdk/client-eks";

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

const eks = () => new EKSClient({ endpoint, region, credentials });

test("EKS cluster and nodegroup roundtrip", async () => {
  const client = eks();
  const clusterName = `bunsai-e2e-${Date.now()}`;
  const roleArn = "arn:aws:iam::000000000000:role/eks-role";

  const created = await client.send(
    new CreateClusterCommand({
      name: clusterName,
      roleArn,
      resourcesVpcConfig: {
        subnetIds: ["subnet-aaaa", "subnet-bbbb"],
      },
    }),
  );
  expect(created.cluster?.name).toBe(clusterName);
  expect(created.cluster?.arn).toContain(`cluster/${clusterName}`);
  expect(created.cluster?.status).toBe("ACTIVE");
  expect(created.cluster?.endpoint).toBeDefined();

  const described = await client.send(
    new DescribeClusterCommand({ name: clusterName }),
  );
  expect(described.cluster?.name).toBe(clusterName);
  expect(described.cluster?.roleArn).toBe(roleArn);

  const listed = await client.send(new ListClustersCommand({}));
  expect(listed.clusters ?? []).toContain(clusterName);

  const nodegroupName = `bunsai-ng-${Date.now()}`;
  const nodeRole = "arn:aws:iam::000000000000:role/eks-node-role";
  const ng = await client.send(
    new CreateNodegroupCommand({
      clusterName,
      nodegroupName,
      nodeRole,
      subnets: ["subnet-aaaa", "subnet-bbbb"],
      scalingConfig: { minSize: 1, maxSize: 3, desiredSize: 2 },
    }),
  );
  expect(ng.nodegroup?.nodegroupName).toBe(nodegroupName);
  expect(ng.nodegroup?.clusterName).toBe(clusterName);
  expect(ng.nodegroup?.status).toBe("ACTIVE");
  expect(ng.nodegroup?.nodegroupArn).toContain(
    `nodegroup/${clusterName}/${nodegroupName}`,
  );

  const describedNg = await client.send(
    new DescribeNodegroupCommand({ clusterName, nodegroupName }),
  );
  expect(describedNg.nodegroup?.nodegroupName).toBe(nodegroupName);
  expect(describedNg.nodegroup?.nodeRole).toBe(nodeRole);

  const listedNg = await client.send(
    new ListNodegroupsCommand({ clusterName }),
  );
  expect(listedNg.nodegroups ?? []).toContain(nodegroupName);

  const deleted = await client.send(
    new DeleteClusterCommand({ name: clusterName }),
  );
  expect(deleted.cluster?.status).toBe("DELETING");

  await expect(
    client.send(new DescribeClusterCommand({ name: clusterName })),
  ).rejects.toThrow();
});
