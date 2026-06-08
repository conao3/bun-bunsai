import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AuthorizeSecurityGroupEgressCommand,
  AuthorizeSecurityGroupIngressCommand,
  CreateSecurityGroupCommand,
  DescribeSecurityGroupRulesCommand,
  DescribeSecurityGroupsCommand,
  EC2Client,
  RevokeSecurityGroupEgressCommand,
  RevokeSecurityGroupIngressCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("SG ingress lifecycle: authorize → describe → revoke → gone", async () => {
  const sg = await client.send(
    new CreateSecurityGroupCommand({
      GroupName: "test-sg-ingress",
      Description: "ingress lifecycle test",
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
          FromPort: 80,
          ToPort: 80,
          IpRanges: [{ CidrIp: "10.0.0.0/8" }],
        },
      ],
    }),
  );
  expect(auth.Return).toBe(true);
  const ruleId = auth.SecurityGroupRules?.[0]?.SecurityGroupRuleId ?? "";
  expect(ruleId.startsWith("sgr-")).toBe(true);

  const descSg = await client.send(
    new DescribeSecurityGroupsCommand({ GroupIds: [groupId] }),
  );
  const ipPerms = descSg.SecurityGroups?.[0]?.IpPermissions ?? [];
  expect(ipPerms.length).toBe(1);
  expect(ipPerms[0]?.IpProtocol).toBe("tcp");
  expect(ipPerms[0]?.FromPort).toBe(80);
  expect(ipPerms[0]?.ToPort).toBe(80);
  expect(ipPerms[0]?.IpRanges?.[0]?.CidrIp).toBe("10.0.0.0/8");

  const descRules = await client.send(
    new DescribeSecurityGroupRulesCommand({
      Filters: [{ Name: "group-id", Values: [groupId] }],
    }),
  );
  const rules = descRules.SecurityGroupRules ?? [];
  expect(rules.length).toBe(1);
  expect(rules[0]?.SecurityGroupRuleId).toBe(ruleId);
  expect(rules[0]?.IsEgress).toBe(false);
  expect(rules[0]?.IpProtocol).toBe("tcp");

  await client.send(
    new RevokeSecurityGroupIngressCommand({
      GroupId: groupId,
      SecurityGroupRuleIds: [ruleId],
    }),
  );

  const afterRevoke = await client.send(
    new DescribeSecurityGroupsCommand({ GroupIds: [groupId] }),
  );
  expect(afterRevoke.SecurityGroups?.[0]?.IpPermissions?.length).toBe(0);

  const afterRules = await client.send(
    new DescribeSecurityGroupRulesCommand({
      Filters: [{ Name: "group-id", Values: [groupId] }],
    }),
  );
  expect(afterRules.SecurityGroupRules?.length).toBe(0);
});

test("SG egress lifecycle: authorize → describe → revoke → gone", async () => {
  const sg = await client.send(
    new CreateSecurityGroupCommand({
      GroupName: "test-sg-egress",
      Description: "egress lifecycle test",
    }),
  );
  const groupId = sg.GroupId ?? "";

  const auth = await client.send(
    new AuthorizeSecurityGroupEgressCommand({
      GroupId: groupId,
      IpPermissions: [
        {
          IpProtocol: "udp",
          FromPort: 53,
          ToPort: 53,
          IpRanges: [{ CidrIp: "0.0.0.0/0" }],
        },
      ],
    }),
  );
  expect(auth.Return).toBe(true);
  const ruleId = auth.SecurityGroupRules?.[0]?.SecurityGroupRuleId ?? "";
  expect(ruleId.startsWith("sgr-")).toBe(true);

  const descSg = await client.send(
    new DescribeSecurityGroupsCommand({ GroupIds: [groupId] }),
  );
  const egressPerms = descSg.SecurityGroups?.[0]?.IpPermissionsEgress ?? [];
  expect(egressPerms.length).toBe(1);
  expect(egressPerms[0]?.IpProtocol).toBe("udp");
  expect(egressPerms[0]?.FromPort).toBe(53);

  const descRules = await client.send(
    new DescribeSecurityGroupRulesCommand({
      SecurityGroupRuleIds: [ruleId],
    }),
  );
  expect(descRules.SecurityGroupRules?.[0]?.IsEgress).toBe(true);

  await client.send(
    new RevokeSecurityGroupEgressCommand({
      GroupId: groupId,
      SecurityGroupRuleIds: [ruleId],
    }),
  );

  const afterRevoke = await client.send(
    new DescribeSecurityGroupsCommand({ GroupIds: [groupId] }),
  );
  expect(afterRevoke.SecurityGroups?.[0]?.IpPermissionsEgress?.length).toBe(0);
});

test("AuthorizeSecurityGroupIngress with missing group throws InvalidGroup.NotFound", async () => {
  await expect(
    client.send(
      new AuthorizeSecurityGroupIngressCommand({
        GroupId: "sg-nonexistent",
        IpPermissions: [{ IpProtocol: "tcp", FromPort: 22, ToPort: 22 }],
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidGroup.NotFound" });
});
