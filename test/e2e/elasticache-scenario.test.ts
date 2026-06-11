import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddTagsToResourceCommand,
  CreateCacheClusterCommand,
  CreateReplicationGroupCommand,
  DeleteCacheClusterCommand,
  DeleteReplicationGroupCommand,
  DescribeCacheClustersCommand,
  DescribeReplicationGroupsCommand,
  ElastiCacheClient,
  ListTagsForResourceCommand,
  ModifyReplicationGroupCommand,
  RemoveTagsFromResourceCommand,
} from "@aws-sdk/client-elasticache";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ElastiCache cache layer provisioning scenario", () => {
  const elasticache = () =>
    new ElastiCacheClient({ endpoint, region, credentials, requestHandler });

  test("cluster and replication group lifecycle with tagging", async () => {
    const client = elasticache();
    const clusterId = "sc-e2e-cluster";
    const rgId = "sc-e2e-rg";

    const created = await client.send(
      new CreateCacheClusterCommand({
        CacheClusterId: clusterId,
        Engine: "redis",
        CacheNodeType: "cache.t3.micro",
        NumCacheNodes: 1,
        Tags: [
          { Key: "Env", Value: "test" },
          { Key: "Service", Value: "cache" },
        ],
      }),
    );
    expect(created.CacheCluster?.CacheClusterStatus).toBe("creating");
    expect(created.CacheCluster?.ConfigurationEndpoint?.Address).toBeDefined();
    expect((created.CacheCluster?.CacheNodes?.length ?? 0) >= 1).toBe(true);
    const clusterArn = created.CacheCluster!.ARN!;

    const described = await client.send(
      new DescribeCacheClustersCommand({ CacheClusterId: clusterId }),
    );
    expect(described.CacheClusters?.[0]?.CacheClusterStatus).toBe("available");

    await expect(
      client.send(
        new CreateCacheClusterCommand({
          CacheClusterId: clusterId,
          Engine: "redis",
          NumCacheNodes: 1,
        }),
      ),
    ).rejects.toThrow();

    const createdRg = await client.send(
      new CreateReplicationGroupCommand({
        ReplicationGroupId: rgId,
        ReplicationGroupDescription: "scenario e2e replication group",
        CacheNodeType: "cache.t3.micro",
        Engine: "redis",
        NumCacheClusters: 2,
        Tags: [{ Key: "Env", Value: "test" }],
      }),
    );
    expect(createdRg.ReplicationGroup?.Status).toBe("creating");
    expect(createdRg.ReplicationGroup?.MemberClusters?.length).toBe(2);

    const describedRg = await client.send(
      new DescribeReplicationGroupsCommand({ ReplicationGroupId: rgId }),
    );
    expect(describedRg.ReplicationGroups?.[0]?.Status).toBe("available");

    await client.send(
      new ModifyReplicationGroupCommand({
        ReplicationGroupId: rgId,
        ReplicationGroupDescription: "modified description",
        CacheNodeType: "cache.m5.large",
        AutomaticFailoverEnabled: true,
      }),
    );
    const afterModify = await client.send(
      new DescribeReplicationGroupsCommand({ ReplicationGroupId: rgId }),
    );
    expect(afterModify.ReplicationGroups?.[0]?.Description).toBe(
      "modified description",
    );
    expect(afterModify.ReplicationGroups?.[0]?.CacheNodeType).toBe(
      "cache.m5.large",
    );
    expect(afterModify.ReplicationGroups?.[0]?.AutomaticFailover).toBe(
      "enabled",
    );

    await client.send(
      new AddTagsToResourceCommand({
        ResourceName: clusterArn,
        Tags: [
          { Key: "Env", Value: "prod" },
          { Key: "Team", Value: "ops" },
        ],
      }),
    );
    const listedTags = await client.send(
      new ListTagsForResourceCommand({ ResourceName: clusterArn }),
    );
    expect(listedTags.TagList?.length).toBe(3);
    expect(listedTags.TagList?.find((t) => t.Key === "Env")?.Value).toBe(
      "prod",
    );
    expect(listedTags.TagList?.find((t) => t.Key === "Service")?.Value).toBe(
      "cache",
    );
    expect(listedTags.TagList?.find((t) => t.Key === "Team")?.Value).toBe(
      "ops",
    );

    await client.send(
      new RemoveTagsFromResourceCommand({
        ResourceName: clusterArn,
        TagKeys: ["Team"],
      }),
    );
    const afterRemove = await client.send(
      new ListTagsForResourceCommand({ ResourceName: clusterArn }),
    );
    expect(afterRemove.TagList?.length).toBe(2);
    expect(afterRemove.TagList?.find((t) => t.Key === "Team")).toBeUndefined();

    const deletedRg = await client.send(
      new DeleteReplicationGroupCommand({ ReplicationGroupId: rgId }),
    );
    expect(deletedRg.ReplicationGroup?.Status).toBe("deleting");

    const describingDeletingRg = await client.send(
      new DescribeReplicationGroupsCommand({ ReplicationGroupId: rgId }),
    );
    expect(describingDeletingRg.ReplicationGroups?.[0]?.Status).toBe(
      "deleting",
    );

    await expect(
      client.send(
        new DescribeReplicationGroupsCommand({ ReplicationGroupId: rgId }),
      ),
    ).rejects.toThrow();

    const deletedCluster = await client.send(
      new DeleteCacheClusterCommand({ CacheClusterId: clusterId }),
    );
    expect(deletedCluster.CacheCluster?.CacheClusterStatus).toBe("deleting");

    const tagsAfterDelete = await client.send(
      new ListTagsForResourceCommand({ ResourceName: clusterArn }),
    );
    expect(tagsAfterDelete.TagList?.length ?? 0).toBe(0);

    const describingDeletingCluster = await client.send(
      new DescribeCacheClustersCommand({ CacheClusterId: clusterId }),
    );
    expect(
      describingDeletingCluster.CacheClusters?.[0]?.CacheClusterStatus,
    ).toBe("deleting");

    await expect(
      client.send(
        new DescribeCacheClustersCommand({ CacheClusterId: clusterId }),
      ),
    ).rejects.toThrow();
  });
});
