import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDhcpOptionsCommand,
  CreateEgressOnlyInternetGatewayCommand,
  CreateVpcCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk9 create-dhcp-options and create-egress-only-internet-gateway e2e", () => {
  const ec2 = () =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("create-dhcp-options: creates a DHCP options set and returns an ID", async () => {
    const client = ec2();

    const res = await client.send(
      new CreateDhcpOptionsCommand({
        DhcpConfigurations: [
          { Key: "domain-name", Values: ["example.com"] },
          { Key: "domain-name-servers", Values: ["8.8.8.8", "8.8.4.4"] },
        ],
      }),
    );

    const dhcpOptions = res.DhcpOptions;
    expect(dhcpOptions).toBeDefined();
    expect(dhcpOptions?.DhcpOptionsId?.startsWith("dopt-")).toBe(true);
    expect(dhcpOptions?.OwnerId).toBeDefined();

    const configs = dhcpOptions?.DhcpConfigurations ?? [];
    expect(configs.length).toBe(2);

    const domainNameConfig = configs.find((c) => c.Key === "domain-name");
    expect(domainNameConfig).toBeDefined();
    expect(domainNameConfig?.Values?.[0]?.Value).toBe("example.com");

    const dnsConfig = configs.find((c) => c.Key === "domain-name-servers");
    expect(dnsConfig).toBeDefined();
    expect(dnsConfig?.Values?.length).toBe(2);
  });

  test("create-dhcp-options: creates with single configuration", async () => {
    const client = ec2();

    const res = await client.send(
      new CreateDhcpOptionsCommand({
        DhcpConfigurations: [
          { Key: "domain-name-servers", Values: ["AmazonProvidedDNS"] },
        ],
      }),
    );

    const dhcpOptions = res.DhcpOptions;
    expect(dhcpOptions).toBeDefined();
    expect(dhcpOptions?.DhcpOptionsId?.startsWith("dopt-")).toBe(true);
    const configs = dhcpOptions?.DhcpConfigurations ?? [];
    expect(configs.length).toBe(1);
    expect(configs[0]?.Key).toBe("domain-name-servers");
  });

  test("create-egress-only-internet-gateway: creates gateway attached to VPC", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";
    expect(vpcId.startsWith("vpc-")).toBe(true);

    const res = await client.send(
      new CreateEgressOnlyInternetGatewayCommand({
        VpcId: vpcId,
        ClientToken: "test-token-123",
      }),
    );

    expect(res.ClientToken).toBe("test-token-123");

    const gateway = res.EgressOnlyInternetGateway;
    expect(gateway).toBeDefined();
    expect(gateway?.EgressOnlyInternetGatewayId?.startsWith("eigw-")).toBe(
      true,
    );

    const attachments = gateway?.Attachments ?? [];
    expect(attachments.length).toBe(1);
    expect(attachments[0]?.VpcId).toBe(vpcId);
    expect(attachments[0]?.State).toBe("attached");
  });

  test("create-egress-only-internet-gateway: two gateways get distinct IDs", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.1.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";

    const res1 = await client.send(
      new CreateEgressOnlyInternetGatewayCommand({ VpcId: vpcId }),
    );
    const res2 = await client.send(
      new CreateEgressOnlyInternetGatewayCommand({ VpcId: vpcId }),
    );

    const id1 = res1.EgressOnlyInternetGateway?.EgressOnlyInternetGatewayId;
    const id2 = res2.EgressOnlyInternetGateway?.EgressOnlyInternetGatewayId;
    expect(id1).not.toBe(id2);
    expect(id1?.startsWith("eigw-")).toBe(true);
    expect(id2?.startsWith("eigw-")).toBe(true);
  });
});
