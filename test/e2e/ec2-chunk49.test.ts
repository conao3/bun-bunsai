import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateImageCommand,
  CreateInstanceEventWindowCommand,
  DescribeImageAttributeCommand,
  DescribeInstanceAttributeCommand,
  DescribeInstanceCreditSpecificationsCommand,
  DescribeInstanceEventWindowsCommand,
  EC2Client,
  ModifyImageAttributeCommand,
  ModifyInstanceAttributeCommand,
  ModifyInstanceCreditSpecificationCommand,
  ModifyInstanceEventWindowCommand,
  ModifyInstanceMetadataOptionsCommand,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("ModifyInstanceAttribute updates InstanceType reflected in DescribeInstanceAttribute", async () => {
  const run = await client.send(
    new RunInstancesCommand({
      ImageId: "ami-modify-test",
      InstanceType: "t2.micro",
      MinCount: 1,
      MaxCount: 1,
    }),
  );
  const instanceId = run.Instances?.[0]?.InstanceId ?? "";
  expect(instanceId.startsWith("i-")).toBe(true);

  await client.send(
    new ModifyInstanceAttributeCommand({
      InstanceId: instanceId,
      InstanceType: { Value: "t3.medium" },
    }),
  );

  const described = await client.send(
    new DescribeInstanceAttributeCommand({
      InstanceId: instanceId,
      Attribute: "instanceType",
    }),
  );
  expect(described.InstanceType?.Value).toBe("t3.medium");
});

test("ModifyInstanceMetadataOptions updates reflected in result", async () => {
  const run = await client.send(
    new RunInstancesCommand({
      ImageId: "ami-meta-test",
      InstanceType: "t2.micro",
      MinCount: 1,
      MaxCount: 1,
    }),
  );
  const instanceId = run.Instances?.[0]?.InstanceId ?? "";

  const result = await client.send(
    new ModifyInstanceMetadataOptionsCommand({
      InstanceId: instanceId,
      HttpTokens: "required",
      HttpEndpoint: "enabled",
    }),
  );
  expect(result.InstanceId).toBe(instanceId);
  expect(result.InstanceMetadataOptions?.HttpTokens).toBe("required");
  expect(result.InstanceMetadataOptions?.HttpEndpoint).toBe("enabled");
});

test("ModifyInstanceCreditSpecification updates reflected in DescribeInstanceCreditSpecifications", async () => {
  const run = await client.send(
    new RunInstancesCommand({
      ImageId: "ami-credit-test",
      InstanceType: "t2.micro",
      MinCount: 1,
      MaxCount: 1,
    }),
  );
  const instanceId = run.Instances?.[0]?.InstanceId ?? "";

  const modResult = await client.send(
    new ModifyInstanceCreditSpecificationCommand({
      InstanceCreditSpecifications: [
        { InstanceId: instanceId, CpuCredits: "unlimited" },
      ],
    }),
  );
  expect(modResult.SuccessfulInstanceCreditSpecifications).toHaveLength(1);
  expect(
    modResult.SuccessfulInstanceCreditSpecifications?.[0]?.InstanceId,
  ).toBe(instanceId);

  const described = await client.send(
    new DescribeInstanceCreditSpecificationsCommand({
      InstanceIds: [instanceId],
    }),
  );
  expect(described.InstanceCreditSpecifications?.[0]?.CpuCredits).toBe(
    "unlimited",
  );
});

test("ModifyInstanceAttribute throws InvalidInstanceID.NotFound for missing instance", async () => {
  await expect(
    client.send(
      new ModifyInstanceAttributeCommand({
        InstanceId: "i-nonexistent123",
        InstanceType: { Value: "t3.micro" },
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidInstanceID.NotFound" });
});

test("ModifyImageAttribute updates Description reflected in DescribeImageAttribute", async () => {
  const run = await client.send(
    new RunInstancesCommand({
      ImageId: "ami-base",
      InstanceType: "t2.micro",
      MinCount: 1,
      MaxCount: 1,
    }),
  );
  const instanceId = run.Instances?.[0]?.InstanceId ?? "";

  const created = await client.send(
    new CreateImageCommand({
      InstanceId: instanceId,
      Name: "test-image",
      Description: "original description",
    }),
  );
  const imageId = created.ImageId ?? "";
  expect(imageId.startsWith("ami-")).toBe(true);

  await client.send(
    new ModifyImageAttributeCommand({
      ImageId: imageId,
      Description: { Value: "updated description" },
    }),
  );

  const attr = await client.send(
    new DescribeImageAttributeCommand({
      ImageId: imageId,
      Attribute: "description",
    }),
  );
  expect(attr.Description?.Value).toBe("updated description");
});

test("ModifyInstanceEventWindow updates reflected in DescribeInstanceEventWindows", async () => {
  const created = await client.send(
    new CreateInstanceEventWindowCommand({
      Name: "original-window",
      TimeRanges: [
        {
          StartWeekDay: "monday",
          StartHour: 2,
          EndWeekDay: "monday",
          EndHour: 8,
        },
      ],
    }),
  );
  const windowId = created.InstanceEventWindow?.InstanceEventWindowId ?? "";
  expect(windowId.startsWith("iew-")).toBe(true);

  await client.send(
    new ModifyInstanceEventWindowCommand({
      InstanceEventWindowId: windowId,
      Name: "updated-window",
    }),
  );

  const described = await client.send(
    new DescribeInstanceEventWindowsCommand({
      InstanceEventWindowIds: [windowId],
    }),
  );
  expect(described.InstanceEventWindows?.[0]?.Name).toBe("updated-window");
});
