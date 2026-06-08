import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateVpcCidrBlockCommand,
  CreateVpcCommand,
  DescribeVpcsCommand,
  DisassociateVpcCidrBlockCommand,
  EC2Client,
  GetEbsEncryptionByDefaultCommand,
  EnableEbsEncryptionByDefaultCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("vpc cidr associate → disassociate lifecycle", async () => {
  const createRes = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }),
  );
  const vpcId = createRes.Vpc?.VpcId;
  expect(vpcId).toBeDefined();
  expect(typeof vpcId).toBe("string");

  const assocRes = await client.send(
    new AssociateVpcCidrBlockCommand({
      VpcId: vpcId!,
      CidrBlock: "10.1.0.0/16",
    }),
  );
  const assocId = assocRes.CidrBlockAssociation?.AssociationId;
  expect(assocId).toBeDefined();
  expect(assocId?.startsWith("vpc-cidr-assoc")).toBe(true);

  const descRes1 = await client.send(
    new DescribeVpcsCommand({ VpcIds: [vpcId!] }),
  );
  const vpc1 = descRes1.Vpcs?.[0];
  expect(
    vpc1?.CidrBlockAssociationSet?.some((a) => a.AssociationId === assocId),
  ).toBe(true);

  const disassocRes = await client.send(
    new DisassociateVpcCidrBlockCommand({ AssociationId: assocId! }),
  );
  expect(disassocRes.VpcId).toBe(vpcId);
  expect(disassocRes.CidrBlockAssociation?.CidrBlockState?.State).toBe(
    "disassociated",
  );

  const descRes2 = await client.send(
    new DescribeVpcsCommand({ VpcIds: [vpcId!] }),
  );
  const vpc2 = descRes2.Vpcs?.[0];
  expect(
    vpc2?.CidrBlockAssociationSet?.some((a) => a.AssociationId === assocId),
  ).toBe(false);
});

test("disassociate vpc cidr - not found error", async () => {
  let caught: unknown;
  try {
    await client.send(
      new DisassociateVpcCidrBlockCommand({
        AssociationId: "vpc-cidr-assoc-nonexistent",
      }),
    );
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeDefined();
  expect((caught as { Code?: string }).Code).toBe("InvalidVpcID.NotFound");
});

test("EnableEbsEncryptionByDefault → GetEbsEncryptionByDefault returns true", async () => {
  const getRes1 = await client.send(new GetEbsEncryptionByDefaultCommand({}));
  expect(getRes1.EbsEncryptionByDefault).toBe(false);

  const enableRes = await client.send(
    new EnableEbsEncryptionByDefaultCommand({}),
  );
  expect(enableRes.EbsEncryptionByDefault).toBe(true);

  const getRes2 = await client.send(new GetEbsEncryptionByDefaultCommand({}));
  expect(getRes2.EbsEncryptionByDefault).toBe(true);
});
