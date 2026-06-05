import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  AssociateVpcCidrBlockCommand,
  AuthorizeSecurityGroupEgressCommand,
  CreateSecurityGroupCommand,
  CreateVpcCommand,
  DescribeVpcsCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk7 associate-vpc-cidr-block and authorize-security-group-egress e2e", () => {
  const ec2 = () => new EC2Client({ endpoint, region, credentials });

  test("associate-vpc-cidr-block: associates IPv4 CIDR block with VPC", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";
    expect(vpcId.startsWith("vpc-")).toBe(true);

    const assocRes = await client.send(
      new AssociateVpcCidrBlockCommand({
        VpcId: vpcId,
        CidrBlock: "10.1.0.0/16",
      }),
    );
    expect(assocRes.VpcId).toBe(vpcId);
    const cidrAssoc = assocRes.CidrBlockAssociation;
    expect(cidrAssoc).toBeDefined();
    expect(cidrAssoc?.CidrBlock).toBe("10.1.0.0/16");
    expect(cidrAssoc?.AssociationId?.startsWith("vpc-cidr-assoc-")).toBe(true);
    expect(cidrAssoc?.CidrBlockState?.State).toBe("associated");

    const descRes = await client.send(
      new DescribeVpcsCommand({ VpcIds: [vpcId] }),
    );
    const vpc = descRes.Vpcs?.[0];
    expect(vpc?.VpcId).toBe(vpcId);
  });

  test("associate-vpc-cidr-block: returns error for non-existent VPC", async () => {
    const client = ec2();

    await expect(
      client.send(
        new AssociateVpcCidrBlockCommand({
          VpcId: "vpc-notexist12345678",
          CidrBlock: "10.2.0.0/16",
        }),
      ),
    ).rejects.toThrow();
  });

  test("authorize-security-group-egress: adds egress rules to security group", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.2.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";
    expect(vpcId.startsWith("vpc-")).toBe(true);

    const sgRes = await client.send(
      new CreateSecurityGroupCommand({
        GroupName: "test-sg-egress",
        Description: "test egress group",
        VpcId: vpcId,
      }),
    );
    const groupId = sgRes.GroupId ?? "";
    expect(groupId.startsWith("sg-")).toBe(true);

    const authRes = await client.send(
      new AuthorizeSecurityGroupEgressCommand({
        GroupId: groupId,
        IpPermissions: [
          {
            IpProtocol: "tcp",
            FromPort: 443,
            ToPort: 443,
            IpRanges: [{ CidrIp: "0.0.0.0/0" }],
          },
        ],
      }),
    );
    expect(authRes.Return).toBe(true);
    expect(authRes.SecurityGroupRules).toBeDefined();
    expect(authRes.SecurityGroupRules?.length).toBeGreaterThan(0);
    const rule = authRes.SecurityGroupRules?.[0];
    expect(rule?.IsEgress).toBe(true);
    expect(rule?.IpProtocol).toBe("tcp");
    expect(rule?.FromPort).toBe(443);
    expect(rule?.ToPort).toBe(443);
    expect(rule?.CidrIpv4).toBe("0.0.0.0/0");
    expect(rule?.SecurityGroupRuleId?.startsWith("sgr-")).toBe(true);
  });

  test("authorize-security-group-egress: multiple rules in one call", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.3.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";

    const sgRes = await client.send(
      new CreateSecurityGroupCommand({
        GroupName: "test-sg-egress-multi",
        Description: "test multi egress group",
        VpcId: vpcId,
      }),
    );
    const groupId = sgRes.GroupId ?? "";

    const authRes = await client.send(
      new AuthorizeSecurityGroupEgressCommand({
        GroupId: groupId,
        IpPermissions: [
          {
            IpProtocol: "tcp",
            FromPort: 80,
            ToPort: 80,
            IpRanges: [{ CidrIp: "10.0.0.0/8" }],
          },
          {
            IpProtocol: "udp",
            FromPort: 53,
            ToPort: 53,
            IpRanges: [{ CidrIp: "8.8.8.8/32" }],
          },
        ],
      }),
    );
    expect(authRes.Return).toBe(true);
    expect(authRes.SecurityGroupRules?.length).toBe(2);
    const tcpRule = authRes.SecurityGroupRules?.find(
      (r) => r.IpProtocol === "tcp",
    );
    const udpRule = authRes.SecurityGroupRules?.find(
      (r) => r.IpProtocol === "udp",
    );
    expect(tcpRule?.FromPort).toBe(80);
    expect(udpRule?.FromPort).toBe(53);
  });
});
