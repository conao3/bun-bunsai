import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AuthorizeSecurityGroupEgressCommand,
  CreateSecurityGroupCommand,
  CreateSnapshotCommand,
  CreateTransitGatewayCommand,
  CreateTransitGatewayRouteCommand,
  CreateTransitGatewayRouteTableCommand,
  CreateVolumeCommand,
  CreateVpcCommand,
  DeleteSnapshotCommand,
  DeregisterImageCommand,
  DescribeImagesCommand,
  DescribeSecurityGroupRulesCommand,
  DescribeSnapshotsCommand,
  EC2Client,
  ListImagesInRecycleBinCommand,
  ListSnapshotsInRecycleBinCommand,
  RegisterImageCommand,
  RestoreImageFromRecycleBinCommand,
  RestoreSnapshotFromRecycleBinCommand,
  RevokeSecurityGroupEgressCommand,
  SearchTransitGatewayRoutesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("RevokeSecurityGroupEgress removes egress rule from DescribeSecurityGroupRules", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.57.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId ?? "";

  const sg = await client.send(
    new CreateSecurityGroupCommand({
      GroupName: "test-revoke-egress",
      Description: "test",
      VpcId: vpcId,
    }),
  );
  const groupId = sg.GroupId ?? "";
  expect(groupId.startsWith("sg-")).toBe(true);

  const auth = await client.send(
    new AuthorizeSecurityGroupEgressCommand({
      GroupId: groupId,
      IpPermissions: [
        {
          IpProtocol: "tcp",
          FromPort: 80,
          ToPort: 80,
          IpRanges: [{ CidrIp: "0.0.0.0/0" }],
        },
      ],
    }),
  );
  const ruleId = auth.SecurityGroupRules?.[0]?.SecurityGroupRuleId ?? "";
  expect(ruleId.startsWith("sgr-")).toBe(true);

  const beforeRevoke = await client.send(
    new DescribeSecurityGroupRulesCommand({
      Filters: [{ Name: "group-id", Values: [groupId] }],
    }),
  );
  const egressBefore = (beforeRevoke.SecurityGroupRules ?? []).filter(
    (r) => r.IsEgress,
  );
  expect(egressBefore.some((r) => r.SecurityGroupRuleId === ruleId)).toBe(true);

  await client.send(
    new RevokeSecurityGroupEgressCommand({
      GroupId: groupId,
      SecurityGroupRuleIds: [ruleId],
    }),
  );

  const afterRevoke = await client.send(
    new DescribeSecurityGroupRulesCommand({
      Filters: [{ Name: "group-id", Values: [groupId] }],
    }),
  );
  const egressAfter = (afterRevoke.SecurityGroupRules ?? []).filter(
    (r) => r.IsEgress && r.SecurityGroupRuleId === ruleId,
  );
  expect(egressAfter).toHaveLength(0);
});

test("RestoreSnapshotFromRecycleBin moves snapshot back to active", async () => {
  const vol = await client.send(
    new CreateVolumeCommand({ AvailabilityZone: "us-east-1a", Size: 1 }),
  );
  const volId = vol.VolumeId ?? "";

  const snap = await client.send(
    new CreateSnapshotCommand({ VolumeId: volId }),
  );
  const snapId = snap.SnapshotId ?? "";
  expect(snapId.startsWith("snap-")).toBe(true);

  await client.send(new DeleteSnapshotCommand({ SnapshotId: snapId }));

  const inBin = await client.send(
    new ListSnapshotsInRecycleBinCommand({ SnapshotIds: [snapId] }),
  );
  expect(inBin.Snapshots?.some((s) => s.SnapshotId === snapId)).toBe(true);

  const restored = await client.send(
    new RestoreSnapshotFromRecycleBinCommand({ SnapshotId: snapId }),
  );
  expect(restored.SnapshotId).toBe(snapId);

  const afterRestore = await client.send(
    new DescribeSnapshotsCommand({ SnapshotIds: [snapId] }),
  );
  expect(afterRestore.Snapshots?.some((s) => s.SnapshotId === snapId)).toBe(
    true,
  );
});

test("RestoreImageFromRecycleBin moves image back to active", async () => {
  const reg = await client.send(
    new RegisterImageCommand({ Name: "chunk57-test-ami" }),
  );
  const imageId = reg.ImageId ?? "";
  expect(imageId.startsWith("ami-")).toBe(true);

  await client.send(new DeregisterImageCommand({ ImageId: imageId }));

  const inBin = await client.send(
    new ListImagesInRecycleBinCommand({ ImageIds: [imageId] }),
  );
  expect(inBin.Images?.some((i) => i.ImageId === imageId)).toBe(true);

  await client.send(
    new RestoreImageFromRecycleBinCommand({ ImageId: imageId }),
  );

  const afterRestore = await client.send(
    new DescribeImagesCommand({ ImageIds: [imageId] }),
  );
  expect(afterRestore.Images?.some((i) => i.ImageId === imageId)).toBe(true);
});

test("SearchTransitGatewayRoutes returns created routes", async () => {
  const tgw = await client.send(new CreateTransitGatewayCommand({}));
  const tgwId = tgw.TransitGateway?.TransitGatewayId ?? "";

  const rtb = await client.send(
    new CreateTransitGatewayRouteTableCommand({ TransitGatewayId: tgwId }),
  );
  const rtbId = rtb.TransitGatewayRouteTable?.TransitGatewayRouteTableId ?? "";
  expect(rtbId.startsWith("tgw-rtb-")).toBe(true);

  await client.send(
    new CreateTransitGatewayRouteCommand({
      TransitGatewayRouteTableId: rtbId,
      DestinationCidrBlock: "10.0.0.0/8",
      Blackhole: true,
    }),
  );

  const search = await client.send(
    new SearchTransitGatewayRoutesCommand({
      TransitGatewayRouteTableId: rtbId,
      Filters: [{ Name: "state", Values: ["active"] }],
    }),
  );
  expect(
    search.Routes?.some((r) => r.DestinationCidrBlock === "10.0.0.0/8"),
  ).toBe(true);
});
