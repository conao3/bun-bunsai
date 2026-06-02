import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateIPSetCommand,
  CreateWebACLCommand,
  DeleteWebACLCommand,
  GetWebACLCommand,
  ListIPSetsCommand,
  ListWebACLsCommand,
  UpdateWebACLCommand,
  WAFV2Client,
} from "@aws-sdk/client-wafv2";
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

const wafv2 = () =>
  new WAFV2Client({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

const visibilityConfig = {
  SampledRequestsEnabled: true,
  CloudWatchMetricsEnabled: true,
  MetricName: "bunsai-e2e-metric",
} as const;

test("WAFv2 WebACL and IPSet lifecycle", async () => {
  const client = wafv2();
  const name = "bunsai-e2e-webacl";

  const created = await client.send(
    new CreateWebACLCommand({
      Name: name,
      Scope: "REGIONAL",
      DefaultAction: { Allow: {} },
      VisibilityConfig: visibilityConfig,
    }),
  );
  expect(created.Summary?.Id).toBeDefined();
  expect(created.Summary?.ARN).toBeDefined();
  const aclId = created.Summary?.Id ?? "";

  const listed = await client.send(
    new ListWebACLsCommand({ Scope: "REGIONAL" }),
  );
  expect((listed.WebACLs ?? []).map((acl) => acl.Name)).toContain(name);

  const got = await client.send(
    new GetWebACLCommand({ Scope: "REGIONAL", Name: name, Id: aclId }),
  );
  expect(got.WebACL?.Name).toBe(name);
  expect(got.LockToken).toBeDefined();
  const lockToken = got.LockToken ?? "";

  const updated = await client.send(
    new UpdateWebACLCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: aclId,
      DefaultAction: { Block: {} },
      VisibilityConfig: visibilityConfig,
      LockToken: lockToken,
      Description: "updated",
    }),
  );
  expect(updated.NextLockToken).toBeDefined();
  expect(updated.NextLockToken).not.toBe(lockToken);
  const nextToken = updated.NextLockToken ?? "";

  const ipSet = await client.send(
    new CreateIPSetCommand({
      Name: "bunsai-e2e-ipset",
      Scope: "REGIONAL",
      IPAddressVersion: "IPV4",
      Addresses: ["192.0.2.0/24"],
    }),
  );
  expect(ipSet.Summary?.Id).toBeDefined();

  const ipSets = await client.send(
    new ListIPSetsCommand({ Scope: "REGIONAL" }),
  );
  expect((ipSets.IPSets ?? []).map((set) => set.Name)).toContain(
    "bunsai-e2e-ipset",
  );

  await client.send(
    new DeleteWebACLCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: aclId,
      LockToken: nextToken,
    }),
  );
  const afterDelete = await client.send(
    new ListWebACLsCommand({ Scope: "REGIONAL" }),
  );
  expect((afterDelete.WebACLs ?? []).map((acl) => acl.Name)).not.toContain(
    name,
  );
});
