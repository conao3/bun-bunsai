import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateIamInstanceProfileCommand,
  DescribeIamInstanceProfileAssociationsCommand,
  DisassociateIamInstanceProfileCommand,
  EC2Client,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("disassociate IAM instance profile lifecycle", async () => {
  const runRes = await client.send(
    new RunInstancesCommand({ ImageId: "ami-test", MinCount: 1, MaxCount: 1 }),
  );
  const instanceId = runRes.Instances?.[0]?.InstanceId;
  expect(instanceId).toBeDefined();
  expect(typeof instanceId).toBe("string");

  const assocRes = await client.send(
    new AssociateIamInstanceProfileCommand({
      InstanceId: instanceId!,
      IamInstanceProfile: {
        Arn: "arn:aws:iam::123456789012:instance-profile/TestProfile",
      },
    }),
  );
  const assoc = assocRes.IamInstanceProfileAssociation;
  expect(assoc).toBeDefined();
  expect(assoc?.AssociationId?.startsWith("iip-assoc")).toBe(true);
  expect(assoc?.State).toBe("associated");

  const descRes1 = await client.send(
    new DescribeIamInstanceProfileAssociationsCommand({}),
  );
  expect(
    descRes1.IamInstanceProfileAssociations?.some(
      (a) => a.AssociationId === assoc?.AssociationId,
    ),
  ).toBe(true);

  const disassocRes = await client.send(
    new DisassociateIamInstanceProfileCommand({
      AssociationId: assoc!.AssociationId!,
    }),
  );
  expect(disassocRes.IamInstanceProfileAssociation?.State).toBe(
    "disassociated",
  );

  const descRes2 = await client.send(
    new DescribeIamInstanceProfileAssociationsCommand({}),
  );
  expect(
    descRes2.IamInstanceProfileAssociations?.some(
      (a) => a.AssociationId === assoc?.AssociationId,
    ),
  ).toBe(false);
});

test("disassociate IAM instance profile - not found error", async () => {
  let caught: unknown;
  try {
    await client.send(
      new DisassociateIamInstanceProfileCommand({
        AssociationId: "iip-assoc-nonexistent",
      }),
    );
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeDefined();
  expect((caught as { Code?: string }).Code).toBe(
    "InvalidAssociationID.NotFound",
  );
});
