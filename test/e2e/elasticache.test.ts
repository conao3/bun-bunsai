import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateCacheClusterCommand,
  CreateReplicationGroupCommand,
  CreateServerlessCacheCommand,
  DecreaseReplicaCountCommand,
  DeleteCacheClusterCommand,
  DeleteReplicationGroupCommand,
  DeleteServerlessCacheCommand,
  DescribeCacheClustersCommand,
  DescribeReplicationGroupsCommand,
  DescribeServerlessCachesCommand,
  ElastiCacheClient,
  IncreaseReplicaCountCommand,
} from "@aws-sdk/client-elasticache";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const elasticache = () =>
  new ElastiCacheClient({ endpoint, region, credentials, requestHandler });

test("ElastiCache cache cluster lifecycle round-trip", async () => {
  const client = elasticache();
  const id = "bunsai-e2e-cc";

  const created = await client.send(
    new CreateCacheClusterCommand({
      CacheClusterId: id,
      CacheNodeType: "cache.t3.micro",
      Engine: "redis",
      NumCacheNodes: 1,
    }),
  );
  expect(created.CacheCluster?.CacheClusterId).toBe(id);
  expect(created.CacheCluster?.CacheClusterStatus).toBe("creating");
  expect(created.CacheCluster?.Engine).toBe("redis");
  expect(created.CacheCluster?.NumCacheNodes).toBe(1);
  expect(created.CacheCluster?.ConfigurationEndpoint?.Address).toContain(id);

  const described = await client.send(
    new DescribeCacheClustersCommand({ CacheClusterId: id }),
  );
  expect(described.CacheClusters?.length).toBe(1);
  expect(described.CacheClusters?.[0]?.CacheClusterId).toBe(id);
  expect(described.CacheClusters?.[0]?.CacheClusterStatus).toBe("available");
  expect(described.CacheClusters?.[0]?.CacheNodeType).toBe("cache.t3.micro");

  const deleted = await client.send(
    new DeleteCacheClusterCommand({ CacheClusterId: id }),
  );
  expect(deleted.CacheCluster?.CacheClusterStatus).toBe("deleting");

  const describedDeleting = await client.send(
    new DescribeCacheClustersCommand({ CacheClusterId: id }),
  );
  expect(describedDeleting.CacheClusters?.[0]?.CacheClusterStatus).toBe(
    "deleting",
  );

  await expect(
    client.send(new DescribeCacheClustersCommand({ CacheClusterId: id })),
  ).rejects.toThrow();
});

test("ElastiCache replication group lifecycle with replica mutation", async () => {
  const client = elasticache();
  const id = "bunsai-e2e-rg";

  const created = await client.send(
    new CreateReplicationGroupCommand({
      ReplicationGroupId: id,
      ReplicationGroupDescription: "bunsai e2e replication group",
      CacheNodeType: "cache.t3.micro",
      Engine: "redis",
      NumCacheClusters: 2,
      AutomaticFailoverEnabled: true,
    }),
  );
  expect(created.ReplicationGroup?.ReplicationGroupId).toBe(id);
  expect(created.ReplicationGroup?.Status).toBe("creating");
  expect(created.ReplicationGroup?.AutomaticFailover).toBe("enabled");
  expect(created.ReplicationGroup?.MemberClusters?.length).toBe(2);

  const described = await client.send(
    new DescribeReplicationGroupsCommand({ ReplicationGroupId: id }),
  );
  expect(described.ReplicationGroups?.[0]?.Status).toBe("available");
  expect(described.ReplicationGroups?.[0]?.CacheNodeType).toBe(
    "cache.t3.micro",
  );

  const increased = await client.send(
    new IncreaseReplicaCountCommand({
      ReplicationGroupId: id,
      NewReplicaCount: 3,
      ApplyImmediately: true,
    }),
  );
  expect(increased.ReplicationGroup?.MemberClusters?.length).toBe(4);

  const afterIncrease = await client.send(
    new DescribeReplicationGroupsCommand({ ReplicationGroupId: id }),
  );
  expect(afterIncrease.ReplicationGroups?.[0]?.MemberClusters?.length).toBe(4);

  const decreased = await client.send(
    new DecreaseReplicaCountCommand({
      ReplicationGroupId: id,
      NewReplicaCount: 1,
      ApplyImmediately: true,
    }),
  );
  expect(decreased.ReplicationGroup?.MemberClusters?.length).toBe(2);

  const deleted = await client.send(
    new DeleteReplicationGroupCommand({ ReplicationGroupId: id }),
  );
  expect(deleted.ReplicationGroup?.Status).toBe("deleting");

  const describedDeleting = await client.send(
    new DescribeReplicationGroupsCommand({ ReplicationGroupId: id }),
  );
  expect(describedDeleting.ReplicationGroups?.[0]?.Status).toBe("deleting");

  await expect(
    client.send(
      new DescribeReplicationGroupsCommand({ ReplicationGroupId: id }),
    ),
  ).rejects.toThrow();
});

test("ElastiCache cache cluster Marker pagination", async () => {
  const client = elasticache();
  const ids = ["bunsai-e2e-pag-a", "bunsai-e2e-pag-b", "bunsai-e2e-pag-c"];

  for (const cid of ids) {
    await client.send(
      new CreateCacheClusterCommand({
        CacheClusterId: cid,
        CacheNodeType: "cache.t3.micro",
        Engine: "redis",
        NumCacheNodes: 1,
      }),
    );
  }

  const page1 = await client.send(
    new DescribeCacheClustersCommand({ MaxRecords: 2 }),
  );
  expect((page1.CacheClusters?.length ?? 0) <= 2).toBe(true);
  expect(page1.Marker).toBeDefined();

  const page2 = await client.send(
    new DescribeCacheClustersCommand({ Marker: page1.Marker }),
  );
  expect((page2.CacheClusters?.length ?? 0) >= 1).toBe(true);
});

test("ElastiCache serverless cache creating to available", async () => {
  const client = elasticache();
  const name = "bunsai-e2e-slc";

  const created = await client.send(
    new CreateServerlessCacheCommand({
      ServerlessCacheName: name,
      Engine: "redis",
    }),
  );
  expect(created.ServerlessCache?.Status).toBe("creating");

  const described = await client.send(
    new DescribeServerlessCachesCommand({ ServerlessCacheName: name }),
  );
  expect(described.ServerlessCaches?.[0]?.Status).toBe("available");

  const deleted = await client.send(
    new DeleteServerlessCacheCommand({ ServerlessCacheName: name }),
  );
  expect(deleted.ServerlessCache?.Status).toBe("deleting");

  const describedDeleting = await client.send(
    new DescribeServerlessCachesCommand({ ServerlessCacheName: name }),
  );
  expect(describedDeleting.ServerlessCaches?.[0]?.Status).toBe("deleting");

  await expect(
    client.send(
      new DescribeServerlessCachesCommand({ ServerlessCacheName: name }),
    ),
  ).rejects.toThrow();
});
