import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateAddonCommand,
  CreateClusterCommand,
  CreateNodegroupCommand,
  DeleteAddonCommand,
  DeleteClusterCommand,
  DeleteNodegroupCommand,
  DescribeClusterCommand,
  DescribeNodegroupCommand,
  EKSClient,
  ListAddonsCommand,
  ListTagsForResourceCommand,
  TagResourceCommand,
  UpdateClusterConfigCommand,
} from "@aws-sdk/client-eks";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("EKS scenario e2e", () => {
  const eks = () =>
    new EKSClient({ endpoint, region, credentials, requestHandler });

  test("cluster provisioning: create, configure, tag, guard teardown, clean delete", async () => {
    const client = eks();
    const clusterName = `bunsai-e2e-scenario-cluster`;
    const roleArn = "arn:aws:iam::000000000000:role/eks-role";
    const nodeRole = "arn:aws:iam::000000000000:role/eks-node-role";
    const nodegroupName = `bunsai-e2e-scenario-ng`;

    const created = await client.send(
      new CreateClusterCommand({
        name: clusterName,
        roleArn,
        resourcesVpcConfig: { subnetIds: ["subnet-aaaa", "subnet-bbbb"] },
      }),
    );
    expect(created.cluster?.name).toBe(clusterName);
    expect(created.cluster?.status).toBe("CREATING");

    const described = await client.send(
      new DescribeClusterCommand({ name: clusterName }),
    );
    expect(described.cluster?.status).toBe("ACTIVE");

    const clusterArn = described.cluster?.arn ?? "";

    const ng = await client.send(
      new CreateNodegroupCommand({
        clusterName,
        nodegroupName,
        nodeRole,
        subnets: ["subnet-aaaa", "subnet-bbbb"],
        scalingConfig: { minSize: 1, maxSize: 3, desiredSize: 2 },
      }),
    );
    expect(ng.nodegroup?.status).toBe("CREATING");

    const describedNg = await client.send(
      new DescribeNodegroupCommand({ clusterName, nodegroupName }),
    );
    expect(describedNg.nodegroup?.status).toBe("ACTIVE");
    expect(describedNg.nodegroup?.clusterName).toBe(clusterName);
    expect(describedNg.nodegroup?.nodeRole).toBe(nodeRole);

    const addonName = "vpc-cni";
    await client.send(new CreateAddonCommand({ clusterName, addonName }));
    const listedAddons = await client.send(
      new ListAddonsCommand({ clusterName }),
    );
    expect(listedAddons.addons ?? []).toContain(addonName);

    const configUpdate = await client.send(
      new UpdateClusterConfigCommand({
        name: clusterName,
        logging: { clusterLogging: [] },
      }),
    );
    expect(configUpdate.update?.id).toBeDefined();
    expect(configUpdate.update?.status).toBeDefined();

    await client.send(
      new TagResourceCommand({
        resourceArn: clusterArn,
        tags: { env: "test", team: "platform" },
      }),
    );
    const tagResult = await client.send(
      new ListTagsForResourceCommand({ resourceArn: clusterArn }),
    );
    expect(tagResult.tags?.env).toBe("test");
    expect(tagResult.tags?.team).toBe("platform");

    await expect(
      client.send(new DeleteClusterCommand({ name: clusterName })),
    ).rejects.toMatchObject({ name: "ResourceInUseException" });

    await client.send(new DeleteAddonCommand({ clusterName, addonName }));
    await client.send(
      new DeleteNodegroupCommand({ clusterName, nodegroupName }),
    );

    const deleted = await client.send(
      new DeleteClusterCommand({ name: clusterName }),
    );
    expect(deleted.cluster?.status).toBe("DELETING");

    await expect(
      client.send(new DescribeClusterCommand({ name: clusterName })),
    ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
  });
});
