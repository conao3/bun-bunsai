import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateImageCommand,
  CreateVpnConnectionCommand,
  DescribeAccountAttributesCommand,
  DeregisterImageCommand,
  DeleteVpnConnectionCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk21 delete-vpn/deprovision/deregister e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("CreateImage then DeregisterImage: AMI removed from store", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateImageCommand({
        InstanceId: "i-test123",
        Name: "test-ami-chunk21",
      }),
    );
    const imageId = createRes.ImageId ?? "";
    expect(imageId.startsWith("ami-")).toBe(true);

    const deregRes = await client.send(
      new DeregisterImageCommand({ ImageId: imageId }),
    );
    expect(deregRes.Return).toBe(true);
    expect(deregRes.$metadata.httpStatusCode).toBe(200);
  });

  test("DeregisterImage on non-existent AMI: throws InvalidAMIID.NotFound", async () => {
    const client = ec2();

    await expect(
      client.send(new DeregisterImageCommand({ ImageId: "ami-nonexistent" })),
    ).rejects.toThrow();
  });

  test("DeleteVpnConnection on non-existent id: throws InvalidVpnConnectionID.NotFound", async () => {
    const client = ec2();

    await expect(
      client.send(
        new DeleteVpnConnectionCommand({
          VpnConnectionId: "vpn-nonexistent",
        }),
      ),
    ).rejects.toThrow();
  });

  test("CreateVpnConnection then DeleteVpnConnection: lifecycle succeeds", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateVpnConnectionCommand({
        CustomerGatewayId: "cgw-test",
        Type: "ipsec.1",
      }),
    );
    const vpnId = createRes.VpnConnection?.VpnConnectionId ?? "";
    expect(vpnId.startsWith("vpn-")).toBe(true);

    const deleteRes = await client.send(
      new DeleteVpnConnectionCommand({ VpnConnectionId: vpnId }),
    );
    expect(deleteRes.$metadata.httpStatusCode).toBe(200);

    await expect(
      client.send(new DeleteVpnConnectionCommand({ VpnConnectionId: vpnId })),
    ).rejects.toThrow();
  });

  test("DescribeAccountAttributes: returns standard attribute set", async () => {
    const client = ec2();

    const res = await client.send(new DescribeAccountAttributesCommand({}));
    const attrs = res.AccountAttributes ?? [];
    expect(attrs.length).toBeGreaterThan(0);

    const names = attrs.map((a) => a.AttributeName);
    expect(names).toContain("supported-platforms");
    expect(names).toContain("default-vpc");
    expect(names).toContain("max-instances");

    const supportedPlatforms = attrs.find(
      (a) => a.AttributeName === "supported-platforms",
    );
    expect(supportedPlatforms?.AttributeValues?.[0]?.AttributeValue).toBe(
      "VPC",
    );
  });

  test("DescribeAccountAttributes with filter: returns only requested", async () => {
    const client = ec2();

    const res = await client.send(
      new DescribeAccountAttributesCommand({
        AttributeNames: ["supported-platforms"],
      }),
    );
    const attrs = res.AccountAttributes ?? [];
    expect(attrs).toHaveLength(1);
    expect(attrs[0]?.AttributeName).toBe("supported-platforms");
  });
});
