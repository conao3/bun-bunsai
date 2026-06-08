import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AllocateHostsCommand,
  AssociateIamInstanceProfileCommand,
  CreateNetworkAclCommand,
  CreateNetworkAclEntryCommand,
  CreateVpcPeeringConnectionCommand,
  DescribeHostsCommand,
  DescribeIamInstanceProfileAssociationsCommand,
  DescribeNetworkAclsCommand,
  DescribeVpcPeeringConnectionsCommand,
  EC2Client,
  RejectVpcPeeringConnectionCommand,
  ReleaseHostsCommand,
  ReplaceIamInstanceProfileAssociationCommand,
  ReplaceNetworkAclEntryCommand,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("RejectVpcPeeringConnection: status reflects as rejected in DescribeVpcPeeringConnections", async () => {
  const createRes = await client.send(
    new CreateVpcPeeringConnectionCommand({
      VpcId: "vpc-requester",
      PeerVpcId: "vpc-accepter",
    }),
  );
  const peeringId =
    createRes.VpcPeeringConnection?.VpcPeeringConnectionId ?? "";
  expect(peeringId.startsWith("pcx-")).toBe(true);

  const rejectRes = await client.send(
    new RejectVpcPeeringConnectionCommand({
      VpcPeeringConnectionId: peeringId,
    }),
  );
  expect(rejectRes.Return).toBe(true);

  const descRes = await client.send(
    new DescribeVpcPeeringConnectionsCommand({
      VpcPeeringConnectionIds: [peeringId],
    }),
  );
  const conn = descRes.VpcPeeringConnections?.[0];
  expect(conn?.VpcPeeringConnectionId).toBe(peeringId);
  expect(conn?.Status?.Code).toBe("rejected");
});

test("ReplaceNetworkAclEntry: updated entry reflected in DescribeNetworkAcls", async () => {
  const createAclRes = await client.send(
    new CreateNetworkAclCommand({ VpcId: "vpc-test-acl" }),
  );
  const networkAclId = createAclRes.NetworkAcl?.NetworkAclId ?? "";
  expect(networkAclId.startsWith("acl-")).toBe(true);

  await client.send(
    new CreateNetworkAclEntryCommand({
      NetworkAclId: networkAclId,
      RuleNumber: 100,
      Protocol: "-1",
      RuleAction: "allow",
      Egress: false,
      CidrBlock: "10.0.0.0/8",
    }),
  );

  await client.send(
    new ReplaceNetworkAclEntryCommand({
      NetworkAclId: networkAclId,
      RuleNumber: 100,
      Protocol: "-1",
      RuleAction: "deny",
      Egress: false,
      CidrBlock: "192.168.0.0/16",
    }),
  );

  const descRes = await client.send(
    new DescribeNetworkAclsCommand({ NetworkAclIds: [networkAclId] }),
  );
  const acl = descRes.NetworkAcls?.[0];
  const entry = acl?.Entries?.find(
    (e) => e.RuleNumber === 100 && e.Egress === false,
  );
  expect(entry?.RuleAction).toBe("deny");
  expect(entry?.CidrBlock).toBe("192.168.0.0/16");
});

test("ReleaseHosts: host absent from DescribeHosts after release", async () => {
  const allocRes = await client.send(
    new AllocateHostsCommand({
      AvailabilityZone: `${region}a`,
      Quantity: 1,
      InstanceType: "m5.large",
    }),
  );
  const hostId = allocRes.HostIds?.[0] ?? "";
  expect(hostId.startsWith("h-")).toBe(true);

  const releaseRes = await client.send(
    new ReleaseHostsCommand({ HostIds: [hostId] }),
  );
  expect(releaseRes.Successful).toContain(hostId);

  const descRes = await client.send(
    new DescribeHostsCommand({ HostIds: [hostId] }),
  );
  expect(descRes.Hosts?.length ?? 0).toBe(0);
});

test("ReplaceIamInstanceProfileAssociation: updated association reflected in Describe", async () => {
  const runRes = await client.send(
    new RunInstancesCommand({ ImageId: "ami-test", MinCount: 1, MaxCount: 1 }),
  );
  const instanceId = runRes.Instances?.[0]?.InstanceId ?? "";

  const assocRes = await client.send(
    new AssociateIamInstanceProfileCommand({
      InstanceId: instanceId,
      IamInstanceProfile: {
        Arn: "arn:aws:iam::123456789012:instance-profile/original",
      },
    }),
  );
  const associationId =
    assocRes.IamInstanceProfileAssociation?.AssociationId ?? "";
  expect(associationId.startsWith("iip-assoc-")).toBe(true);

  const replaceRes = await client.send(
    new ReplaceIamInstanceProfileAssociationCommand({
      AssociationId: associationId,
      IamInstanceProfile: {
        Arn: "arn:aws:iam::123456789012:instance-profile/replaced",
      },
    }),
  );
  expect(
    replaceRes.IamInstanceProfileAssociation?.IamInstanceProfile?.Arn,
  ).toBe("arn:aws:iam::123456789012:instance-profile/replaced");

  const descRes = await client.send(
    new DescribeIamInstanceProfileAssociationsCommand({
      AssociationIds: [associationId],
    }),
  );
  const found = descRes.IamInstanceProfileAssociations?.find(
    (a) => a.AssociationId === associationId,
  );
  expect(found?.IamInstanceProfile?.Arn).toBe(
    "arn:aws:iam::123456789012:instance-profile/replaced",
  );
});
