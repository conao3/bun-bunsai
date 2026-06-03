import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateFirewallCommand,
  DeleteFirewallCommand,
  DescribeFirewallCommand,
  ListFirewallsCommand,
  NetworkFirewallClient,
} from "@aws-sdk/client-network-firewall";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

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

describe("network-firewall e2e", () => {
  let proc: ReturnType<typeof spawn> | undefined;

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

  const firewall = () =>
    new NetworkFirewallClient({ endpoint, region, credentials });

  test("create, describe, list and delete a firewall", async () => {
    const client = firewall();
    const name = `bunsai-fw-${Date.now()}`;
    const policyArn =
      "arn:aws:network-firewall:us-east-1:000000000000:firewall-policy/bunsai";

    const created = await client.send(
      new CreateFirewallCommand({
        FirewallName: name,
        FirewallPolicyArn: policyArn,
        VpcId: "vpc-0123456789abcdef0",
        SubnetMappings: [{ SubnetId: "subnet-0123456789abcdef0" }],
      }),
    );
    expect(created.Firewall?.FirewallName).toBe(name);
    expect(created.Firewall?.FirewallArn).toContain(name);
    expect(created.Firewall?.FirewallPolicyArn).toBe(policyArn);
    expect(created.Firewall?.FirewallId).toBeDefined();
    expect(created.FirewallStatus?.Status).toBe("READY");

    const described = await client.send(
      new DescribeFirewallCommand({ FirewallName: name }),
    );
    expect(described.Firewall?.FirewallName).toBe(name);
    expect(described.Firewall?.VpcId).toBe("vpc-0123456789abcdef0");
    expect(described.FirewallStatus?.Status).toBe("READY");
    expect(described.UpdateToken).toBeDefined();

    const arn = created.Firewall?.FirewallArn;
    const describedByArn = await client.send(
      new DescribeFirewallCommand({ FirewallArn: arn }),
    );
    expect(describedByArn.Firewall?.FirewallName).toBe(name);

    const listed = await client.send(new ListFirewallsCommand({}));
    const names = (listed.Firewalls ?? []).map((entry) => entry.FirewallName);
    expect(names).toContain(name);

    const deleted = await client.send(
      new DeleteFirewallCommand({ FirewallName: name }),
    );
    expect(deleted.Firewall?.FirewallName).toBe(name);
    expect(deleted.FirewallStatus?.Status).toBe("DELETING");

    const afterDelete = await client.send(new ListFirewallsCommand({}));
    const afterNames = (afterDelete.Firewalls ?? []).map(
      (entry) => entry.FirewallName,
    );
    expect(afterNames).not.toContain(name);
  });
});
