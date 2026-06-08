import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateImageCommand,
  CreateInstanceConnectEndpointCommand,
  CreateInstanceEventWindowCommand,
  DescribeImageUsageReportEntriesCommand,
  DescribeImageUsageReportsCommand,
  DescribeImagesCommand,
  DescribeImportImageTasksCommand,
  DescribeImportSnapshotTasksCommand,
  DescribeInstanceAttributeCommand,
  DescribeInstanceConnectEndpointsCommand,
  DescribeInstanceCreditSpecificationsCommand,
  DescribeInstanceEventNotificationAttributesCommand,
  DescribeInstanceEventWindowsCommand,
  DescribeInstanceImageMetadataCommand,
  DescribeInstanceSqlHaHistoryStatesCommand,
  EC2Client,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk26 describe images/import-tasks/instance-attribute/connect/credit/event-windows e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("DescribeImages: empty list when none created", async () => {
    const client = ec2();
    const res = await client.send(new DescribeImagesCommand({}));
    expect(res.Images).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateImage then DescribeImages: round-trip with id filter", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateImageCommand({
        InstanceId: "i-00000001",
        Name: "test-ami",
        Description: "test description",
      }),
    );
    const amiId = created.ImageId!;
    expect(amiId.startsWith("ami-")).toBe(true);

    const listed = await client.send(
      new DescribeImagesCommand({ ImageIds: [amiId] }),
    );
    expect(listed.Images).toHaveLength(1);
    expect(listed.Images![0].ImageId).toBe(amiId);
    expect(listed.Images![0].Name).toBe("test-ami");
    expect(listed.$metadata.httpStatusCode).toBe(200);
  });

  test("RunInstances then DescribeInstanceAttribute: instanceType attribute", async () => {
    const client = ec2();
    const run = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-00000001",
        InstanceType: "t3.micro",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = run.Instances![0].InstanceId!;

    const attr = await client.send(
      new DescribeInstanceAttributeCommand({
        InstanceId: instanceId,
        Attribute: "instanceType",
      }),
    );
    expect(attr.InstanceId).toBe(instanceId);
    expect(attr.InstanceType?.Value).toBe("t3.micro");
    expect(attr.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateInstanceConnectEndpoint then DescribeInstanceConnectEndpoints: round-trip", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateInstanceConnectEndpointCommand({
        SubnetId: "subnet-aabbccdd",
      }),
    );
    const endpointId =
      created.InstanceConnectEndpoint!.InstanceConnectEndpointId!;
    expect(endpointId.startsWith("eice-")).toBe(true);

    const listed = await client.send(
      new DescribeInstanceConnectEndpointsCommand({
        InstanceConnectEndpointIds: [endpointId],
      }),
    );
    expect(listed.InstanceConnectEndpoints).toHaveLength(1);
    expect(listed.InstanceConnectEndpoints![0].InstanceConnectEndpointId).toBe(
      endpointId,
    );
    expect(listed.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateInstanceEventWindow then DescribeInstanceEventWindows: round-trip", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateInstanceEventWindowCommand({
        Name: "test-window",
        TimeRanges: [
          {
            StartWeekDay: "monday",
            StartHour: 2,
            EndWeekDay: "monday",
            EndHour: 4,
          },
        ],
      }),
    );
    const windowId = created.InstanceEventWindow!.InstanceEventWindowId!;
    expect(windowId.startsWith("iew-")).toBe(true);

    const listed = await client.send(
      new DescribeInstanceEventWindowsCommand({
        InstanceEventWindowIds: [windowId],
      }),
    );
    expect(listed.InstanceEventWindows).toHaveLength(1);
    expect(listed.InstanceEventWindows![0].InstanceEventWindowId).toBe(
      windowId,
    );
    expect(listed.InstanceEventWindows![0].Name).toBe("test-window");
    expect(listed.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeImageUsageReportEntries: empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeImageUsageReportEntriesCommand({}),
    );
    expect(res.ImageUsageReportEntries).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeImageUsageReports: empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeImageUsageReportsCommand({}));
    expect(res.ImageUsageReports).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeImportImageTasks: empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeImportImageTasksCommand({}));
    expect(res.ImportImageTasks).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeImportSnapshotTasks: empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeImportSnapshotTasksCommand({}));
    expect(res.ImportSnapshotTasks).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeInstanceCreditSpecifications: empty list when no instances", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeInstanceCreditSpecificationsCommand({
        InstanceIds: ["i-nonexistent"],
      }),
    );
    expect(res.InstanceCreditSpecifications).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeInstanceEventNotificationAttributes: returns no attribute", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeInstanceEventNotificationAttributesCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeInstanceSqlHaHistoryStates: empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeInstanceSqlHaHistoryStatesCommand({}),
    );
    expect(res.Instances).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeInstanceImageMetadata: returns metadata for running instances", async () => {
    const client = ec2();
    const run = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-metadata-test",
        InstanceType: "t2.micro",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = run.Instances![0].InstanceId!;

    const meta = await client.send(
      new DescribeInstanceImageMetadataCommand({
        InstanceIds: [instanceId],
      }),
    );
    expect(meta.InstanceImageMetadata).toHaveLength(1);
    expect(meta.InstanceImageMetadata![0].InstanceId).toBe(instanceId);
    expect(meta.$metadata.httpStatusCode).toBe(200);
  });
});
