import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateCacheClusterCommand,
  CreateReplicationGroupCommand,
  DeleteCacheClusterCommand,
  DescribeCacheClustersCommand,
  DescribeReplicationGroupsCommand,
  ElastiCacheClient,
} from "@aws-sdk/client-elasticache";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const elasticache = () =>
  new ElastiCacheClient({ endpoint, region, credentials });

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
  expect(created.CacheCluster?.CacheClusterStatus).toBe("available");
  expect(created.CacheCluster?.Engine).toBe("redis");
  expect(created.CacheCluster?.NumCacheNodes).toBe(1);
  expect(created.CacheCluster?.ConfigurationEndpoint?.Address).toContain(id);

  const described = await client.send(
    new DescribeCacheClustersCommand({ CacheClusterId: id }),
  );
  expect(described.CacheClusters?.length).toBe(1);
  expect(described.CacheClusters?.[0]?.CacheClusterId).toBe(id);
  expect(described.CacheClusters?.[0]?.CacheNodeType).toBe("cache.t3.micro");

  const deleted = await client.send(
    new DeleteCacheClusterCommand({ CacheClusterId: id }),
  );
  expect(deleted.CacheCluster?.CacheClusterStatus).toBe("deleting");

  await expect(
    client.send(new DescribeCacheClustersCommand({ CacheClusterId: id })),
  ).rejects.toThrow();
});

test("ElastiCache replication group round-trip", async () => {
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
  expect(created.ReplicationGroup?.Status).toBe("available");
  expect(created.ReplicationGroup?.Description).toBe(
    "bunsai e2e replication group",
  );
  expect(created.ReplicationGroup?.AutomaticFailover).toBe("enabled");
  expect(created.ReplicationGroup?.MemberClusters?.length).toBe(2);

  const described = await client.send(
    new DescribeReplicationGroupsCommand({ ReplicationGroupId: id }),
  );
  expect(described.ReplicationGroups?.length).toBe(1);
  expect(described.ReplicationGroups?.[0]?.ReplicationGroupId).toBe(id);
  expect(described.ReplicationGroups?.[0]?.CacheNodeType).toBe(
    "cache.t3.micro",
  );
});
