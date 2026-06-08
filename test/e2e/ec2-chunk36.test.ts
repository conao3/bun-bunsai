import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AllocateAddressCommand,
  CreateImageCommand,
  CreateVpcPeeringConnectionCommand,
  CreateVpnConnectionCommand,
  CreateVpnGatewayCommand,
  DescribeVpcPeeringConnectionsCommand,
  DescribeVpnConnectionsCommand,
  DescribeVpnGatewaysCommand,
  DisableAddressTransferCommand,
  DisableAllowedImagesSettingsCommand,
  DisableAwsNetworkPerformanceMetricSubscriptionCommand,
  DisableCapacityManagerCommand,
  DisableEbsEncryptionByDefaultCommand,
  DisableFastLaunchCommand,
  DisableFastSnapshotRestoresCommand,
  DisableImageCommand,
  EC2Client,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk36 describe vpc-peering/vpn + disable ops e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("DescribeVpcPeeringConnections returns empty list initially", async () => {
    const client = ec2();
    const res = await client.send(new DescribeVpcPeeringConnectionsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.VpcPeeringConnections)).toBe(true);
  });

  test("CreateVpnConnection then DescribeVpnConnections includes it", async () => {
    const client = ec2();

    const empty = await client.send(new DescribeVpnConnectionsCommand({}));
    expect(empty.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(empty.VpnConnections)).toBe(true);

    const created = await client.send(
      new CreateVpnConnectionCommand({
        CustomerGatewayId: "cgw-00000000",
        Type: "ipsec.1",
      }),
    );
    const connId = created.VpnConnection!.VpnConnectionId!;
    expect(connId.startsWith("vpn-")).toBe(true);

    const all = await client.send(new DescribeVpnConnectionsCommand({}));
    const found = all.VpnConnections!.find((c) => c.VpnConnectionId === connId);
    expect(found).toBeDefined();
    expect(found!.Type).toBe("ipsec.1");

    const byId = await client.send(
      new DescribeVpnConnectionsCommand({ VpnConnectionIds: [connId] }),
    );
    expect(byId.VpnConnections).toHaveLength(1);
    expect(byId.VpnConnections![0].VpnConnectionId).toBe(connId);
  });

  test("CreateVpnGateway then DescribeVpnGateways includes it", async () => {
    const client = ec2();

    const created = await client.send(
      new CreateVpnGatewayCommand({ Type: "ipsec.1" }),
    );
    const gwId = created.VpnGateway!.VpnGatewayId!;
    expect(gwId.startsWith("vgw-")).toBe(true);

    const all = await client.send(new DescribeVpnGatewaysCommand({}));
    const found = all.VpnGateways!.find((g) => g.VpnGatewayId === gwId);
    expect(found).toBeDefined();
  });

  test("DisableEbsEncryptionByDefault returns EbsEncryptionByDefault: false", async () => {
    const client = ec2();
    const res = await client.send(new DisableEbsEncryptionByDefaultCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.EbsEncryptionByDefault).toBe(false);
  });

  test("DisableAllowedImagesSettings returns disabled state", async () => {
    const client = ec2();
    const res = await client.send(new DisableAllowedImagesSettingsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.AllowedImagesSettingsState).toBe("disabled");
  });

  test("DisableAwsNetworkPerformanceMetricSubscription returns Output true", async () => {
    const client = ec2();
    const res = await client.send(
      new DisableAwsNetworkPerformanceMetricSubscriptionCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.Output).toBe(true);
  });

  test("DisableCapacityManager returns disabled status", async () => {
    const client = ec2();
    const res = await client.send(new DisableCapacityManagerCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.CapacityManagerStatus).toBe("disabled");
    expect(res.OrganizationsAccess).toBe(false);
  });

  test("DisableImage sets image state to disabled", async () => {
    const client = ec2();

    const inst = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-placeholder",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = inst.Instances![0].InstanceId!;

    const img = await client.send(
      new CreateImageCommand({
        InstanceId: instanceId,
        Name: "chunk36-test-img",
      }),
    );
    const imageId = img.ImageId!;
    expect(imageId.startsWith("ami-")).toBe(true);

    const disableRes = await client.send(
      new DisableImageCommand({ ImageId: imageId }),
    );
    expect(disableRes.$metadata.httpStatusCode).toBe(200);
    expect(disableRes.Return).toBe(true);
  });

  test("DisableFastLaunch returns disabling state for valid image", async () => {
    const client = ec2();

    const inst = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-placeholder",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = inst.Instances![0].InstanceId!;

    const img = await client.send(
      new CreateImageCommand({
        InstanceId: instanceId,
        Name: "chunk36-fastlaunch-img",
      }),
    );
    const imageId = img.ImageId!;

    const res = await client.send(
      new DisableFastLaunchCommand({ ImageId: imageId }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.ImageId).toBe(imageId);
    expect(res.State).toBe("disabling");
  });

  test("DisableFastSnapshotRestores returns successful set", async () => {
    const client = ec2();
    const res = await client.send(
      new DisableFastSnapshotRestoresCommand({
        SourceSnapshotIds: ["snap-000000000000"],
        AvailabilityZones: ["us-east-1a"],
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.Successful)).toBe(true);
    expect(res.Successful![0].SnapshotId).toBe("snap-000000000000");
    expect(res.Successful![0].State).toBe("disabling");
  });

  test("DisableAddressTransfer returns transfer info for valid allocation", async () => {
    const client = ec2();

    const allocated = await client.send(new AllocateAddressCommand({}));
    const allocationId = allocated.AllocationId!;

    const res = await client.send(
      new DisableAddressTransferCommand({ AllocationId: allocationId }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.AddressTransfer!.AllocationId).toBe(allocationId);
    expect(res.AddressTransfer!.AddressTransferStatus).toBe("disabled");
  });

  test("CreateVpcPeeringConnection then DescribeVpcPeeringConnections includes it", async () => {
    const client = ec2();

    const created = await client.send(
      new CreateVpcPeeringConnectionCommand({
        VpcId: "vpc-00000000",
        PeerVpcId: "vpc-11111111",
      }),
    );
    const peeringId = created.VpcPeeringConnection!.VpcPeeringConnectionId!;
    expect(peeringId.startsWith("pcx-")).toBe(true);

    const all = await client.send(new DescribeVpcPeeringConnectionsCommand({}));
    const found = all.VpcPeeringConnections!.find(
      (c) => c.VpcPeeringConnectionId === peeringId,
    );
    expect(found).toBeDefined();
    expect(found!.Status!.Code).toBe("pending-acceptance");
  });
});
