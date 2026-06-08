import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateRouteCommand,
  CreateRouteTableCommand,
  CreateVpcCommand,
  DescribeRouteTablesCommand,
  EC2Client,
  ModifyInstanceAttributeCommand,
  ResetInstanceAttributeCommand,
  ReplaceRouteCommand,
  RunInstancesCommand,
  ResetSnapshotAttributeCommand,
  CreateSnapshotCommand,
  CreateVolumeCommand,
  DescribeSnapshotAttributeCommand,
  ModifySnapshotAttributeCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("ReplaceRoute updates route target reflected in DescribeRouteTables", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId ?? "";
  expect(vpcId.startsWith("vpc-")).toBe(true);

  const rtb = await client.send(new CreateRouteTableCommand({ VpcId: vpcId }));
  const rtbId = rtb.RouteTable?.RouteTableId ?? "";
  expect(rtbId.startsWith("rtb-")).toBe(true);

  await client.send(
    new CreateRouteCommand({
      RouteTableId: rtbId,
      DestinationCidrBlock: "0.0.0.0/0",
      GatewayId: "igw-original",
    }),
  );

  const before = await client.send(
    new DescribeRouteTablesCommand({ RouteTableIds: [rtbId] }),
  );
  const routeBefore = before.RouteTables?.[0]?.Routes?.find(
    (r) => r.DestinationCidrBlock === "0.0.0.0/0",
  );
  expect(routeBefore?.GatewayId).toBe("igw-original");

  await client.send(
    new ReplaceRouteCommand({
      RouteTableId: rtbId,
      DestinationCidrBlock: "0.0.0.0/0",
      GatewayId: "igw-replaced",
    }),
  );

  const after = await client.send(
    new DescribeRouteTablesCommand({ RouteTableIds: [rtbId] }),
  );
  const routeAfter = after.RouteTables?.[0]?.Routes?.find(
    (r) => r.DestinationCidrBlock === "0.0.0.0/0",
  );
  expect(routeAfter?.GatewayId).toBe("igw-replaced");
});

test("ReplaceRoute throws InvalidRouteTableID.NotFound for missing table", async () => {
  await expect(
    client.send(
      new ReplaceRouteCommand({
        RouteTableId: "rtb-nonexistent",
        DestinationCidrBlock: "0.0.0.0/0",
        GatewayId: "igw-x",
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidRouteTableID.NotFound" });
});

test("ModifyInstanceAttribute then ResetInstanceAttribute returns to default", async () => {
  const reservation = await client.send(
    new RunInstancesCommand({ ImageId: "ami-test", MinCount: 1, MaxCount: 1 }),
  );
  const instanceId = reservation.Instances?.[0]?.InstanceId ?? "";
  expect(instanceId.startsWith("i-")).toBe(true);

  await client.send(
    new ModifyInstanceAttributeCommand({
      InstanceId: instanceId,
      InstanceType: { Value: "t3.large" },
    }),
  );

  await client.send(
    new ResetInstanceAttributeCommand({
      InstanceId: instanceId,
      Attribute: "sourceDestCheck",
    }),
  );

  await expect(
    client.send(
      new ResetInstanceAttributeCommand({
        InstanceId: "i-nonexistent",
        Attribute: "sourceDestCheck",
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidInstanceID.NotFound" });
});

test("ResetSnapshotAttribute clears createVolumePermission", async () => {
  const vol = await client.send(
    new CreateVolumeCommand({
      AvailabilityZone: "us-east-1a",
      Size: 8,
    }),
  );
  const volumeId = vol.VolumeId ?? "";

  const snap = await client.send(
    new CreateSnapshotCommand({ VolumeId: volumeId }),
  );
  const snapshotId = snap.SnapshotId ?? "";
  expect(snapshotId.startsWith("snap-")).toBe(true);

  await client.send(
    new ModifySnapshotAttributeCommand({
      SnapshotId: snapshotId,
      OperationType: "add",
      UserIds: ["123456789012"],
    }),
  );

  const attrBefore = await client.send(
    new DescribeSnapshotAttributeCommand({
      SnapshotId: snapshotId,
      Attribute: "createVolumePermission",
    }),
  );
  expect(attrBefore.CreateVolumePermissions?.length).toBe(1);

  await client.send(
    new ResetSnapshotAttributeCommand({
      SnapshotId: snapshotId,
      Attribute: "createVolumePermission",
    }),
  );

  const attrAfter = await client.send(
    new DescribeSnapshotAttributeCommand({
      SnapshotId: snapshotId,
      Attribute: "createVolumePermission",
    }),
  );
  expect(attrAfter.CreateVolumePermissions?.length).toBe(0);
});
