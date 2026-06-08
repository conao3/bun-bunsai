import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateVpcCommand,
  DescribeVpcClassicLinkCommand,
  DisableImageBlockPublicAccessCommand,
  DisableImageDeprecationCommand,
  DisableImageDeregistrationProtectionCommand,
  DisableInstanceSqlHaStandbyDetectionsCommand,
  DisableIpamOrganizationAdminAccountCommand,
  DisableIpamPolicyCommand,
  DisableRouteServerPropagationCommand,
  DisableSerialConsoleAccessCommand,
  DisableSnapshotBlockPublicAccessCommand,
  DisableTransitGatewayRouteTablePropagationCommand,
  DisableVgwRoutePropagationCommand,
  DisableVpcClassicLinkCommand,
  EC2Client,
  EnableSerialConsoleAccessCommand,
  GetSerialConsoleAccessStatusCommand,
  RunInstancesCommand,
  CreateImageCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk37 disable ops e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("EnableSerialConsoleAccess then DisableSerialConsoleAccess then GetSerialConsoleAccessStatus returns false", async () => {
    const client = ec2();

    const enableRes = await client.send(
      new EnableSerialConsoleAccessCommand({}),
    );
    expect(enableRes.$metadata.httpStatusCode).toBe(200);
    expect(enableRes.SerialConsoleAccessEnabled).toBe(true);

    const disableRes = await client.send(
      new DisableSerialConsoleAccessCommand({}),
    );
    expect(disableRes.$metadata.httpStatusCode).toBe(200);
    expect(disableRes.SerialConsoleAccessEnabled).toBe(false);

    const statusRes = await client.send(
      new GetSerialConsoleAccessStatusCommand({}),
    );
    expect(statusRes.$metadata.httpStatusCode).toBe(200);
    expect(statusRes.SerialConsoleAccessEnabled).toBe(false);
  });

  test("DisableVpcClassicLink on a vpc then DescribeVpcClassicLink reflects disabled", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc!.VpcId!;
    expect(vpcId.startsWith("vpc-")).toBe(true);

    const disableRes = await client.send(
      new DisableVpcClassicLinkCommand({ VpcId: vpcId }),
    );
    expect(disableRes.$metadata.httpStatusCode).toBe(200);
    expect(disableRes.Return).toBe(true);

    const descRes = await client.send(
      new DescribeVpcClassicLinkCommand({ VpcIds: [vpcId] }),
    );
    expect(descRes.$metadata.httpStatusCode).toBe(200);
    const vpc = descRes.Vpcs!.find((v) => v.VpcId === vpcId);
    expect(vpc).toBeDefined();
    expect(vpc!.ClassicLinkEnabled).toBe(false);
  });

  test("DisableImageBlockPublicAccess returns unblocked state", async () => {
    const client = ec2();
    const res = await client.send(new DisableImageBlockPublicAccessCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.ImageBlockPublicAccessState).toBe("unblocked");
  });

  test("DisableSnapshotBlockPublicAccess returns unblocked state", async () => {
    const client = ec2();
    const res = await client.send(
      new DisableSnapshotBlockPublicAccessCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.State).toBe("unblocked");
  });

  test("DisableImageDeprecation removes deprecation from image", async () => {
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
        Name: "chunk37-dep-img",
      }),
    );
    const imageId = img.ImageId!;

    const res = await client.send(
      new DisableImageDeprecationCommand({ ImageId: imageId }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.Return).toBe(true);
  });

  test("DisableImageDeregistrationProtection returns successful for valid image", async () => {
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
        Name: "chunk37-dreg-img",
      }),
    );
    const imageId = img.ImageId!;

    const res = await client.send(
      new DisableImageDeregistrationProtectionCommand({ ImageId: imageId }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.Return).toBe("successful");
  });

  test("DisableInstanceSqlHaStandbyDetections returns instance list", async () => {
    const client = ec2();
    const res = await client.send(
      new DisableInstanceSqlHaStandbyDetectionsCommand({
        InstanceIds: ["i-00000000000000001"],
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.Instances)).toBe(true);
    expect(res.Instances![0].InstanceId).toBe("i-00000000000000001");
  });

  test("DisableIpamOrganizationAdminAccount returns Success true", async () => {
    const client = ec2();
    const res = await client.send(
      new DisableIpamOrganizationAdminAccountCommand({
        DelegatedAdminAccountId: "123456789012",
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.Success).toBe(true);
  });

  test("DisableIpamPolicy throws not-found for unknown policy ID", async () => {
    const client = ec2();
    await expect(
      client.send(
        new DisableIpamPolicyCommand({ IpamPolicyId: "ipam-policy-99999999" }),
      ),
    ).rejects.toThrow();
  });

  test("DisableRouteServerPropagation returns propagation info", async () => {
    const client = ec2();
    const res = await client.send(
      new DisableRouteServerPropagationCommand({
        RouteServerId: "rs-00000000",
        RouteTableId: "rtb-00000000",
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.RouteServerPropagation!.State).toBe("deleting");
    expect(res.RouteServerPropagation!.RouteServerId).toBe("rs-00000000");
  });

  test("DisableTransitGatewayRouteTablePropagation returns propagation info", async () => {
    const client = ec2();
    const res = await client.send(
      new DisableTransitGatewayRouteTablePropagationCommand({
        TransitGatewayRouteTableId: "tgw-rtb-00000000",
        TransitGatewayAttachmentId: "tgw-attach-00000000",
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.Propagation!.State).toBe("disabled");
    expect(res.Propagation!.TransitGatewayRouteTableId).toBe(
      "tgw-rtb-00000000",
    );
  });

  test("DisableVgwRoutePropagation completes without error", async () => {
    const client = ec2();
    const res = await client.send(
      new DisableVgwRoutePropagationCommand({
        GatewayId: "vgw-00000000",
        RouteTableId: "rtb-00000000",
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
  });
});
