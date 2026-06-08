import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateImageCommand,
  CreateVpcCommand,
  DescribeVpcClassicLinkCommand,
  DisableAllowedImagesSettingsCommand,
  EC2Client,
  EnableAllowedImagesSettingsCommand,
  EnableVpcClassicLinkCommand,
  ExportImageCommand,
  GetAllowedImagesSettingsCommand,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("EnableVpcClassicLink → DescribeVpcClassicLink shows enabled", async () => {
  const createRes = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.100.0.0/16" }),
  );
  const vpcId = createRes.Vpc?.VpcId;
  expect(vpcId).toBeDefined();

  const descBefore = await client.send(
    new DescribeVpcClassicLinkCommand({ VpcIds: [vpcId!] }),
  );
  expect(descBefore.Vpcs?.[0]?.ClassicLinkEnabled).toBe(false);

  const enableRes = await client.send(
    new EnableVpcClassicLinkCommand({ VpcId: vpcId! }),
  );
  expect(enableRes.Return).toBe(true);

  const descAfter = await client.send(
    new DescribeVpcClassicLinkCommand({ VpcIds: [vpcId!] }),
  );
  expect(descAfter.Vpcs?.[0]?.ClassicLinkEnabled).toBe(true);
});

test("EnableAllowedImagesSettings → GetAllowedImagesSettings reflects state", async () => {
  const getDefault = await client.send(new GetAllowedImagesSettingsCommand({}));
  expect(getDefault.State).toBe("disabled");

  await client.send(
    new EnableAllowedImagesSettingsCommand({
      AllowedImagesSettingsState: "audit-mode",
    }),
  );

  const getEnabled = await client.send(new GetAllowedImagesSettingsCommand({}));
  expect(getEnabled.State).toBe("audit-mode");

  await client.send(new DisableAllowedImagesSettingsCommand({}));

  const getDisabled = await client.send(
    new GetAllowedImagesSettingsCommand({}),
  );
  expect(getDisabled.State).toBe("disabled");
});

test("ExportImage returns export task", async () => {
  const runRes = await client.send(
    new RunInstancesCommand({
      ImageId: "ami-00000000",
      MinCount: 1,
      MaxCount: 1,
    }),
  );
  const instanceId = runRes.Instances?.[0]?.InstanceId;
  expect(instanceId).toBeDefined();

  const createRes = await client.send(
    new CreateImageCommand({
      InstanceId: instanceId!,
      Name: "test-export-image",
    }),
  );
  const imageId = createRes.ImageId;
  expect(imageId).toBeDefined();

  const exportRes = await client.send(
    new ExportImageCommand({
      ImageId: imageId!,
      DiskImageFormat: "VMDK",
      S3ExportLocation: { S3Bucket: "my-export-bucket" },
    }),
  );
  expect(exportRes.ExportImageTaskId).toBeDefined();
  expect(typeof exportRes.ExportImageTaskId).toBe("string");
  expect(exportRes.ImageId).toBe(imageId);
  expect(exportRes.DiskImageFormat).toBe("VMDK");
  expect(exportRes.Status).toBe("active");
  expect(exportRes.S3ExportLocation?.S3Bucket).toBe("my-export-bucket");
});
