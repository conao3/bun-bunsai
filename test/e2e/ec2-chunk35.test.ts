import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateVpcCommand,
  CreateVpcEndpointCommand,
  CreateVpcEndpointConnectionNotificationCommand,
  CreateVpcEndpointServiceConfigurationCommand,
  DescribeVpcBlockPublicAccessExclusionsCommand,
  DescribeVpcBlockPublicAccessOptionsCommand,
  DescribeVpcClassicLinkCommand,
  DescribeVpcClassicLinkDnsSupportCommand,
  DescribeVpcEncryptionControlsCommand,
  DescribeVpcEndpointAssociationsCommand,
  DescribeVpcEndpointConnectionNotificationsCommand,
  DescribeVpcEndpointConnectionsCommand,
  DescribeVpcEndpointServiceConfigurationsCommand,
  DescribeVpcEndpointServicePermissionsCommand,
  DescribeVpcEndpointServicesCommand,
  DescribeVpcEndpointsCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk35 describe vpc-block-public-access, vpc-classic-link, vpc-endpoints family e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("DescribeVpcBlockPublicAccessExclusions returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeVpcBlockPublicAccessExclusionsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.VpcBlockPublicAccessExclusions)).toBe(true);
  });

  test("DescribeVpcBlockPublicAccessOptions returns options object", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeVpcBlockPublicAccessOptionsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.VpcBlockPublicAccessOptions).toBeDefined();
    expect(res.VpcBlockPublicAccessOptions!.InternetGatewayBlockMode).toBe(
      "off",
    );
  });

  test("DescribeVpcClassicLink returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeVpcClassicLinkCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.Vpcs)).toBe(true);
    expect(res.Vpcs).toHaveLength(0);
  });

  test("DescribeVpcClassicLinkDnsSupport returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeVpcClassicLinkDnsSupportCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.Vpcs)).toBe(true);
    expect(res.Vpcs).toHaveLength(0);
  });

  test("DescribeVpcEncryptionControls returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeVpcEncryptionControlsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.VpcEncryptionControls)).toBe(true);
  });

  test("DescribeVpcEndpointAssociations returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeVpcEndpointAssociationsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.VpcEndpointAssociations)).toBe(true);
    expect(res.VpcEndpointAssociations).toHaveLength(0);
  });

  test("DescribeVpcEndpointConnections returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeVpcEndpointConnectionsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.VpcEndpointConnections)).toBe(true);
    expect(res.VpcEndpointConnections).toHaveLength(0);
  });

  test("CreateVpcEndpoint then DescribeVpcEndpoints includes it, and DescribeVpcEndpointServices returns managed set", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.35.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc!.VpcId!;

    const emptyEndpoints = await client.send(
      new DescribeVpcEndpointsCommand({}),
    );
    expect(emptyEndpoints.$metadata.httpStatusCode).toBe(200);

    const created = await client.send(
      new CreateVpcEndpointCommand({
        VpcId: vpcId,
        ServiceName: `com.amazonaws.${region}.s3`,
        VpcEndpointType: "Gateway",
      }),
    );
    const endpointId = created.VpcEndpoint!.VpcEndpointId!;
    expect(endpointId.startsWith("vpce-")).toBe(true);

    const all = await client.send(new DescribeVpcEndpointsCommand({}));
    const found = all.VpcEndpoints!.find((e) => e.VpcEndpointId === endpointId);
    expect(found).toBeDefined();
    expect(found!.VpcId).toBe(vpcId);
    expect(found!.ServiceName).toBe(`com.amazonaws.${region}.s3`);

    const byId = await client.send(
      new DescribeVpcEndpointsCommand({ VpcEndpointIds: [endpointId] }),
    );
    expect(byId.VpcEndpoints).toHaveLength(1);
    expect(byId.VpcEndpoints![0].VpcEndpointId).toBe(endpointId);

    const services = await client.send(
      new DescribeVpcEndpointServicesCommand({}),
    );
    expect(services.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(services.ServiceNames)).toBe(true);
    const hasS3 = services.ServiceNames!.some((n) => n.includes(".s3"));
    expect(hasS3).toBe(true);

    const svcConfig = await client.send(
      new CreateVpcEndpointServiceConfigurationCommand({
        AcceptanceRequired: false,
      }),
    );
    const svcId = svcConfig.ServiceConfiguration!.ServiceId!;

    const configs = await client.send(
      new DescribeVpcEndpointServiceConfigurationsCommand({}),
    );
    expect(configs.$metadata.httpStatusCode).toBe(200);
    const foundConfig = configs.ServiceConfigurations!.find(
      (c) => c.ServiceId === svcId,
    );
    expect(foundConfig).toBeDefined();

    const notify = await client.send(
      new CreateVpcEndpointConnectionNotificationCommand({
        ServiceId: svcId,
        ConnectionNotificationArn:
          "arn:aws:sns:us-east-1:123456789012:chunk35-topic",
        ConnectionEvents: ["Accept", "Reject"],
      }),
    );
    const notifyId = notify.ConnectionNotification!.ConnectionNotificationId!;

    const notifications = await client.send(
      new DescribeVpcEndpointConnectionNotificationsCommand({}),
    );
    expect(notifications.$metadata.httpStatusCode).toBe(200);
    const foundNotify = notifications.ConnectionNotificationSet!.find(
      (n) => n.ConnectionNotificationId === notifyId,
    );
    expect(foundNotify).toBeDefined();
    expect(foundNotify!.ServiceId).toBe(svcId);

    const perms = await client.send(
      new DescribeVpcEndpointServicePermissionsCommand({
        ServiceId: svcId,
      }),
    );
    expect(perms.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(perms.AllowedPrincipals)).toBe(true);
  });
});
