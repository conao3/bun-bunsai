import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateCacheParameterGroupCommand,
  CreateCacheSubnetGroupCommand,
  DeleteCacheParameterGroupCommand,
  DeleteCacheSubnetGroupCommand,
  DescribeCacheParameterGroupsCommand,
  DescribeCacheSubnetGroupsCommand,
  ElastiCacheClient,
} from "@aws-sdk/client-elasticache";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const elasticache = () =>
  new ElastiCacheClient({ endpoint, region, credentials });

test("ElastiCache cache parameter group round-trip", async () => {
  const client = elasticache();
  const name = "bunsai-e2e-pg";

  const created = await client.send(
    new CreateCacheParameterGroupCommand({
      CacheParameterGroupName: name,
      CacheParameterGroupFamily: "redis7",
      Description: "bunsai e2e parameter group",
    }),
  );
  expect(created.CacheParameterGroup?.CacheParameterGroupName).toBe(name);
  expect(created.CacheParameterGroup?.CacheParameterGroupFamily).toBe("redis7");
  expect(created.CacheParameterGroup?.Description).toBe(
    "bunsai e2e parameter group",
  );
  expect(created.CacheParameterGroup?.ARN).toContain(name);

  const described = await client.send(
    new DescribeCacheParameterGroupsCommand({
      CacheParameterGroupName: name,
    }),
  );
  expect(described.CacheParameterGroups?.length).toBe(1);
  expect(described.CacheParameterGroups?.[0]?.CacheParameterGroupName).toBe(
    name,
  );
  expect(described.CacheParameterGroups?.[0]?.CacheParameterGroupFamily).toBe(
    "redis7",
  );

  await client.send(
    new DeleteCacheParameterGroupCommand({ CacheParameterGroupName: name }),
  );

  await expect(
    client.send(
      new DescribeCacheParameterGroupsCommand({
        CacheParameterGroupName: name,
      }),
    ),
  ).rejects.toThrow();
});

test("ElastiCache cache subnet group round-trip", async () => {
  const client = elasticache();
  const name = "bunsai-e2e-sg";

  const created = await client.send(
    new CreateCacheSubnetGroupCommand({
      CacheSubnetGroupName: name,
      CacheSubnetGroupDescription: "bunsai e2e subnet group",
      SubnetIds: ["subnet-aaaa1111", "subnet-bbbb2222"],
    }),
  );
  expect(created.CacheSubnetGroup?.CacheSubnetGroupName).toBe(name);
  expect(created.CacheSubnetGroup?.CacheSubnetGroupDescription).toBe(
    "bunsai e2e subnet group",
  );
  expect(created.CacheSubnetGroup?.Subnets?.length).toBe(2);
  expect(created.CacheSubnetGroup?.Subnets?.[0]?.SubnetIdentifier).toBe(
    "subnet-aaaa1111",
  );
  expect(created.CacheSubnetGroup?.ARN).toContain(name);

  const described = await client.send(
    new DescribeCacheSubnetGroupsCommand({ CacheSubnetGroupName: name }),
  );
  expect(described.CacheSubnetGroups?.length).toBe(1);
  expect(described.CacheSubnetGroups?.[0]?.CacheSubnetGroupName).toBe(name);
  expect(described.CacheSubnetGroups?.[0]?.Subnets?.length).toBe(2);

  await client.send(
    new DeleteCacheSubnetGroupCommand({ CacheSubnetGroupName: name }),
  );

  await expect(
    client.send(
      new DescribeCacheSubnetGroupsCommand({ CacheSubnetGroupName: name }),
    ),
  ).rejects.toThrow();
});
