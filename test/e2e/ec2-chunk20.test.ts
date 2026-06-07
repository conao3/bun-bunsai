import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateVpcCommand,
  CreateVpcEndpointCommand,
  DeleteVpcEndpointsCommand,
  DeleteVpcPeeringConnectionCommand,
  CreateVpcPeeringConnectionCommand,
} from "@aws-sdk/client-ec2";
import { EC2Client } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("DeleteVpcEndpoints: create then delete succeeds, delete non-existent returns unsuccessful entry", async () => {
  const vpcRes = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.30.0.0/16" }),
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

  const delRes = await client.send(
    new DeleteVpcEndpointsCommand({ VpcEndpointIds: [epId] }),
  );
  expect(delRes.Unsuccessful).toBeDefined();
  expect(delRes.Unsuccessful?.length).toBe(0);

  const delAgainRes = await client.send(
    new DeleteVpcEndpointsCommand({ VpcEndpointIds: [epId] }),
  );
  expect(delAgainRes.Unsuccessful).toBeDefined();
  expect(delAgainRes.Unsuccessful?.length).toBe(1);
  expect(delAgainRes.Unsuccessful?.[0]?.ResourceId).toBe(epId);
  expect(delAgainRes.Unsuccessful?.[0]?.Error?.Code).toBe(
    "InvalidVpcEndpointId.NotFound",
  );
});

test("DeleteVpcPeeringConnection: delete non-existent throws NotFound error", async () => {
  let thrown = false;
  try {
    await client.send(
      new DeleteVpcPeeringConnectionCommand({
        VpcPeeringConnectionId: "pcx-nonexistent",
      }),
    );
  } catch (e) {
    thrown = true;
    const err = e as { name?: string };
    expect(err.name).toBe("InvalidVpcPeeringConnectionID.NotFound");
  }
  expect(thrown).toBe(true);
});

test("DeleteVpcPeeringConnection: create then delete succeeds", async () => {
  const vpc1 = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.31.0.0/16" }),
  );
  const vpc2 = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.32.0.0/16" }),
  );
  const vpc1Id = vpc1.Vpc?.VpcId ?? "";
  const vpc2Id = vpc2.Vpc?.VpcId ?? "";

  const peeringRes = await client.send(
    new CreateVpcPeeringConnectionCommand({
      VpcId: vpc1Id,
      PeerVpcId: vpc2Id,
    }),
  );
  const peeringId =
    peeringRes.VpcPeeringConnection?.VpcPeeringConnectionId ?? "";
  expect(peeringId.startsWith("pcx-")).toBe(true);

  const delRes = await client.send(
    new DeleteVpcPeeringConnectionCommand({
      VpcPeeringConnectionId: peeringId,
    }),
  );
  expect(delRes.Return).toBe(true);
});
