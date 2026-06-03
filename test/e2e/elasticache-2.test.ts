import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateCacheParameterGroupCommand,
  CreateCacheSubnetGroupCommand,
  DeleteCacheParameterGroupCommand,
  DeleteCacheSubnetGroupCommand,
  DescribeCacheParameterGroupsCommand,
  DescribeCacheSubnetGroupsCommand,
  ElastiCacheClient,
} from "@aws-sdk/client-elasticache";

const awsPort = 4632;
const uiPort = 5732;
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
