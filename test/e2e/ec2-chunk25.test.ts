import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AllocateHostsCommand,
  AssociateIamInstanceProfileCommand,
  CreateFlowLogsCommand,
  CreateFpgaImageCommand,
  DescribeFpgaImageAttributeCommand,
  DescribeFpgaImagesCommand,
  DescribeHostReservationOfferingsCommand,
  DescribeHostReservationsCommand,
  DescribeHostsCommand,
  DescribeIamInstanceProfileAssociationsCommand,
  DescribeIdFormatCommand,
  DescribeIdentityIdFormatCommand,
  DescribeImageReferencesCommand,
  DescribeFleetsCommand,
  DescribeFlowLogsCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk25 describe fleets/flow-logs/fpga/hosts/iam-profile/id-format/image e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("DescribeFleets: empty list when none created", async () => {
    const client = ec2();
    const res = await client.send(new DescribeFleetsCommand({}));
    expect(res.Fleets).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateFlowLogs then DescribeFlowLogs: round-trip", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateFlowLogsCommand({
        ResourceIds: ["vpc-aabbccdd"],
        ResourceType: "VPC",
        TrafficType: "ALL",
        LogGroupName: "/test/flowlogs",
      }),
    );
    expect(created.FlowLogIds).toHaveLength(1);
    expect(created.Unsuccessful).toEqual([]);
    const flowLogId = created.FlowLogIds![0];
    expect(flowLogId.startsWith("fl-")).toBe(true);

    const listed = await client.send(
      new DescribeFlowLogsCommand({ FlowLogIds: [flowLogId] }),
    );
    expect(listed.FlowLogs).toHaveLength(1);
    expect(listed.FlowLogs![0].FlowLogId).toBe(flowLogId);
    expect(listed.FlowLogs![0].TrafficType).toBe("ALL");
    expect(listed.$metadata.httpStatusCode).toBe(200);
  });

  test("AllocateHosts then DescribeHosts: round-trip", async () => {
    const client = ec2();
    const allocated = await client.send(
      new AllocateHostsCommand({
        AvailabilityZone: "us-east-1a",
        InstanceType: "m5.large",
        Quantity: 1,
      }),
    );
    expect(allocated.HostIds).toHaveLength(1);
    const hostId = allocated.HostIds![0];
    expect(hostId.startsWith("h-")).toBe(true);

    const listed = await client.send(
      new DescribeHostsCommand({ HostIds: [hostId] }),
    );
    expect(listed.Hosts).toHaveLength(1);
    expect(listed.Hosts![0].HostId).toBe(hostId);
    expect(listed.Hosts![0].HostProperties?.InstanceType).toBe("m5.large");
    expect(listed.$metadata.httpStatusCode).toBe(200);
  });

  test("AssociateIamInstanceProfile then DescribeIamInstanceProfileAssociations: round-trip", async () => {
    const client = ec2();
    const associated = await client.send(
      new AssociateIamInstanceProfileCommand({
        InstanceId: "i-00000001",
        IamInstanceProfile: {
          Arn: "arn:aws:iam::123456789012:instance-profile/MyProfile",
        },
      }),
    );
    const assocId = associated.IamInstanceProfileAssociation?.AssociationId;
    expect(typeof assocId).toBe("string");

    const listed = await client.send(
      new DescribeIamInstanceProfileAssociationsCommand({
        AssociationIds: [assocId!],
      }),
    );
    expect(listed.IamInstanceProfileAssociations).toHaveLength(1);
    expect(listed.IamInstanceProfileAssociations![0].AssociationId).toBe(
      assocId,
    );
    expect(listed.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateFpgaImage then DescribeFpgaImages and DescribeFpgaImageAttribute: round-trip", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateFpgaImageCommand({
        InputStorageLocation: { Bucket: "my-bucket", Key: "my-key" },
        Name: "test-afi",
        Description: "test fpga image",
      }),
    );
    const afiId = created.FpgaImageId;
    expect(typeof afiId).toBe("string");
    expect(afiId?.startsWith("afi-")).toBe(true);

    const listed = await client.send(
      new DescribeFpgaImagesCommand({ FpgaImageIds: [afiId!] }),
    );
    expect(listed.FpgaImages).toHaveLength(1);
    expect(listed.FpgaImages![0].FpgaImageId).toBe(afiId);
    expect(listed.$metadata.httpStatusCode).toBe(200);

    const attr = await client.send(
      new DescribeFpgaImageAttributeCommand({
        FpgaImageId: afiId!,
        Attribute: "description",
      }),
    );
    expect(attr.FpgaImageAttribute?.FpgaImageId).toBe(afiId);
    expect(attr.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeHostReservationOfferings: returns synthetic offerings", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeHostReservationOfferingsCommand({}),
    );
    expect((res.OfferingSet?.length ?? 0) > 0).toBe(true);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeHostReservations: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeHostReservationsCommand({}));
    expect(res.HostReservationSet).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeIdFormat: returns empty statuses", async () => {
    const client = ec2();
    const res = await client.send(new DescribeIdFormatCommand({}));
    expect(res.Statuses).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeIdentityIdFormat: returns empty statuses", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeIdentityIdFormatCommand({
        PrincipalArn: "arn:aws:iam::123456789012:role/MyRole",
      }),
    );
    expect(res.Statuses).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeImageReferences: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeImageReferencesCommand({
        ImageIds: ["ami-00000001"],
        IncludeAllResourceTypes: true,
      }),
    );
    expect(res.ImageReferences).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });
});
