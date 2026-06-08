import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  DescribeByoipCidrsCommand,
  DescribeInstancesCommand,
  EC2Client,
  ModifyVpnConnectionCommand,
  MonitorInstancesCommand,
  ProvisionByoipCidrCommand,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("MonitorInstances: enables monitoring visible via DescribeInstances", async () => {
  const runRes = await client.send(
    new RunInstancesCommand({ ImageId: "ami-test", MinCount: 1, MaxCount: 1 }),
  );
  const instanceId = runRes.Instances?.[0]?.InstanceId ?? "";
  expect(instanceId.startsWith("i-")).toBe(true);

  const beforeRes = await client.send(
    new DescribeInstancesCommand({ InstanceIds: [instanceId] }),
  );
  const beforeInstance = beforeRes.Reservations?.[0]?.Instances?.[0];
  expect(beforeInstance?.Monitoring?.State).toBe("disabled");

  const monRes = await client.send(
    new MonitorInstancesCommand({ InstanceIds: [instanceId] }),
  );
  expect(monRes.InstanceMonitorings).toHaveLength(1);
  expect(monRes.InstanceMonitorings?.[0]?.InstanceId).toBe(instanceId);
  expect(monRes.InstanceMonitorings?.[0]?.Monitoring?.State).toBe("enabled");

  const afterRes = await client.send(
    new DescribeInstancesCommand({ InstanceIds: [instanceId] }),
  );
  const afterInstance = afterRes.Reservations?.[0]?.Instances?.[0];
  expect(afterInstance?.Monitoring?.State).toBe("enabled");
});

test("ProvisionByoipCidr: creates CIDR visible via DescribeByoipCidrs", async () => {
  const cidr = "203.0.113.0/24";

  const beforeRes = await client.send(
    new DescribeByoipCidrsCommand({ MaxResults: 10 }),
  );
  const beforeCount = beforeRes.ByoipCidrs?.length ?? 0;

  const provRes = await client.send(
    new ProvisionByoipCidrCommand({ Cidr: cidr }),
  );
  expect(provRes.ByoipCidr?.Cidr).toBe(cidr);
  expect(provRes.ByoipCidr?.State).toBe("pending-provision");

  const afterRes = await client.send(
    new DescribeByoipCidrsCommand({ MaxResults: 10 }),
  );
  expect(afterRes.ByoipCidrs?.length ?? 0).toBe(beforeCount + 1);
  const found = afterRes.ByoipCidrs?.find((c) => c.Cidr === cidr);
  expect(found).toBeDefined();
  expect(found?.State).toBe("pending-provision");
});

test("ModifyVpnConnection: not-found error for missing VPN connection", async () => {
  await expect(
    client.send(
      new ModifyVpnConnectionCommand({
        VpnConnectionId: "vpn-00000000nonexistent",
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidVpnConnectionID.NotFound" });
});
