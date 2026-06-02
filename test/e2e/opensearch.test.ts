import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateDomainCommand,
  DeleteDomainCommand,
  DescribeDomainCommand,
  DescribeDomainsCommand,
  ListDomainNamesCommand,
  OpenSearchClient,
  UpdateDomainConfigCommand,
} from "@aws-sdk/client-opensearch";

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

const opensearch = () =>
  new OpenSearchClient({ endpoint, region, credentials });

test("OpenSearch domain roundtrip", async () => {
  const client = opensearch();
  const domainName = `bunsai-e2e-${Date.now()}`.slice(0, 28).toLowerCase();

  const created = await client.send(
    new CreateDomainCommand({
      DomainName: domainName,
      EngineVersion: "OpenSearch_2.11",
      ClusterConfig: { InstanceType: "t3.small.search", InstanceCount: 1 },
      EBSOptions: { EBSEnabled: true, VolumeType: "gp3", VolumeSize: 10 },
    }),
  );
  expect(created.DomainStatus?.DomainName).toBe(domainName);
  expect(created.DomainStatus?.ARN).toContain(`:domain/${domainName}`);
  expect(created.DomainStatus?.Created).toBe(true);
  expect(created.DomainStatus?.Processing).toBe(false);
  expect(created.DomainStatus?.Endpoint).toBeTruthy();

  const described = await client.send(
    new DescribeDomainCommand({ DomainName: domainName }),
  );
  expect(described.DomainStatus?.DomainName).toBe(domainName);
  expect(described.DomainStatus?.EngineVersion).toBe("OpenSearch_2.11");

  const describedMany = await client.send(
    new DescribeDomainsCommand({ DomainNames: [domainName] }),
  );
  expect(
    (describedMany.DomainStatusList ?? []).map((d) => d.DomainName),
  ).toContain(domainName);

  const listed = await client.send(new ListDomainNamesCommand({}));
  expect((listed.DomainNames ?? []).map((d) => d.DomainName)).toContain(
    domainName,
  );

  const updated = await client.send(
    new UpdateDomainConfigCommand({
      DomainName: domainName,
      ClusterConfig: { InstanceType: "t3.medium.search", InstanceCount: 2 },
    }),
  );
  expect(
    (updated.DomainConfig?.ClusterConfig?.Options as { InstanceCount?: number })
      ?.InstanceCount,
  ).toBe(2);

  const deleted = await client.send(
    new DeleteDomainCommand({ DomainName: domainName }),
  );
  expect(deleted.DomainStatus?.Deleted).toBe(true);

  await expect(
    client.send(new DescribeDomainCommand({ DomainName: domainName })),
  ).rejects.toThrow();
});
