import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AuthorizeSecurityGroupIngressCommand,
  CreateSecurityGroupCommand,
  CreateVpcCommand,
  DescribeSecurityGroupRulesCommand,
  EC2Client,
  UpdateSecurityGroupRuleDescriptionsIngressCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("UpdateSecurityGroupRuleDescriptionsIngress reflects in DescribeSecurityGroupRules", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.56.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId ?? "";
  expect(vpcId.startsWith("vpc-")).toBe(true);

  const sg = await client.send(
    new CreateSecurityGroupCommand({
      GroupName: "chunk56-sg",
      Description: "chunk56 test",
      VpcId: vpcId,
    }),
  );
  const groupId = sg.GroupId ?? "";
  expect(groupId.startsWith("sg-")).toBe(true);

  const auth = await client.send(
    new AuthorizeSecurityGroupIngressCommand({
      GroupId: groupId,
      IpPermissions: [
        {
          IpProtocol: "tcp",
          FromPort: 8080,
          ToPort: 8080,
          IpRanges: [{ CidrIp: "0.0.0.0/0" }],
        },
      ],
    }),
  );
  const ruleId = auth.SecurityGroupRules?.[0]?.SecurityGroupRuleId ?? "";
  expect(ruleId.startsWith("sgr-")).toBe(true);

  const updateRes = await client.send(
    new UpdateSecurityGroupRuleDescriptionsIngressCommand({
      GroupId: groupId,
      SecurityGroupRuleDescriptions: [
        { SecurityGroupRuleId: ruleId, Description: "updated-desc" },
      ],
    }),
  );
  expect(updateRes.Return).toBe(true);

  const described = await client.send(
    new DescribeSecurityGroupRulesCommand({
      SecurityGroupRuleIds: [ruleId],
    }),
  );
  expect(described.SecurityGroupRules).toHaveLength(1);
  expect(described.SecurityGroupRules?.[0]?.SecurityGroupRuleId).toBe(ruleId);
  expect(described.SecurityGroupRules?.[0]?.Description).toBe("updated-desc");
});
