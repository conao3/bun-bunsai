import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateVpcCommand,
  CreateVpcEndpointCommand,
  DescribeVpcAttributeCommand,
  DescribeVpcEndpointsCommand,
  ModifyVpcAttributeCommand,
  ModifyVpcEndpointCommand,
} from "@aws-sdk/client-ec2";
import { EC2Client } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("ModifyVpcAttribute: updates enableDnsHostnames and reflects in DescribeVpcAttribute", async () => {
  const vpcRes = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.30.0.0/16" }),
  );
  const vpcId = vpcRes.Vpc?.VpcId ?? "";
  expect(vpcId.startsWith("vpc-")).toBe(true);

  const beforeRes = await client.send(
    new DescribeVpcAttributeCommand({
      VpcId: vpcId,
      Attribute: "enableDnsHostnames",
    }),
  );
  expect(beforeRes.EnableDnsHostnames?.Value).toBe(true);

  await client.send(
    new ModifyVpcAttributeCommand({
      VpcId: vpcId,
      EnableDnsHostnames: { Value: false },
    }),
  );

  const afterRes = await client.send(
    new DescribeVpcAttributeCommand({
      VpcId: vpcId,
      Attribute: "enableDnsHostnames",
    }),
  );
  expect(afterRes.EnableDnsHostnames?.Value).toBe(false);

  await client.send(
    new ModifyVpcAttributeCommand({
      VpcId: vpcId,
      EnableNetworkAddressUsageMetrics: { Value: true },
    }),
  );

  const naumRes = await client.send(
    new DescribeVpcAttributeCommand({
      VpcId: vpcId,
      Attribute: "enableNetworkAddressUsageMetrics",
    }),
  );
  expect(naumRes.EnableNetworkAddressUsageMetrics?.Value).toBe(true);
});

test("ModifyVpcEndpoint: updates PrivateDnsEnabled and reflects in DescribeVpcEndpoints", async () => {
  const vpcRes = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.31.0.0/16" }),
  );
  const vpcId = vpcRes.Vpc?.VpcId ?? "";
  expect(vpcId.startsWith("vpc-")).toBe(true);

  const epRes = await client.send(
    new CreateVpcEndpointCommand({
      VpcId: vpcId,
      ServiceName: "com.amazonaws.us-east-1.s3",
      VpcEndpointType: "Gateway",
    }),
  );
  const epId = epRes.VpcEndpoint?.VpcEndpointId ?? "";
  expect(epId.startsWith("vpce-")).toBe(true);

  const beforeRes = await client.send(
    new DescribeVpcEndpointsCommand({ VpcEndpointIds: [epId] }),
  );
  const beforeEp = beforeRes.VpcEndpoints?.[0];
  expect(beforeEp?.VpcEndpointId).toBe(epId);

  const modifyRes = await client.send(
    new ModifyVpcEndpointCommand({
      VpcEndpointId: epId,
      PrivateDnsEnabled: false,
    }),
  );
  expect(modifyRes.Return).toBe(true);

  const afterRes = await client.send(
    new DescribeVpcEndpointsCommand({ VpcEndpointIds: [epId] }),
  );
  const afterEp = afterRes.VpcEndpoints?.[0];
  expect(afterEp?.VpcEndpointId).toBe(epId);
  expect(afterEp?.PrivateDnsEnabled).toBe(false);
});
