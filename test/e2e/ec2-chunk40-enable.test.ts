import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateImageCommand,
  EC2Client,
  EnableFastLaunchCommand,
  EnableFastSnapshotRestoresCommand,
  EnableImageBlockPublicAccessCommand,
  EnableImageCommand,
  EnableImageDeprecationCommand,
  EnableImageDeregistrationProtectionCommand,
  EnableIpamOrganizationAdminAccountCommand,
  EnableReachabilityAnalyzerOrganizationSharingCommand,
  EnableRouteServerPropagationCommand,
  EnableSnapshotBlockPublicAccessCommand,
  GetImageBlockPublicAccessStateCommand,
  GetSnapshotBlockPublicAccessStateCommand,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk40 enable ops e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("EnableImageBlockPublicAccess → GetImageBlockPublicAccessState reflects block-new-sharing", async () => {
    const client = ec2();

    const enableRes = await client.send(
      new EnableImageBlockPublicAccessCommand({
        ImageBlockPublicAccessState: "block-new-sharing",
      }),
    );
    expect(enableRes.$metadata.httpStatusCode).toBe(200);
    expect(enableRes.ImageBlockPublicAccessState).toBe("block-new-sharing");

    const getRes = await client.send(
      new GetImageBlockPublicAccessStateCommand({}),
    );
    expect(getRes.$metadata.httpStatusCode).toBe(200);
    expect(getRes.ImageBlockPublicAccessState).toBe("block-new-sharing");
  });

  test("EnableSnapshotBlockPublicAccess → GetSnapshotBlockPublicAccessState reflects block-all-sharing", async () => {
    const client = ec2();

    const enableRes = await client.send(
      new EnableSnapshotBlockPublicAccessCommand({
        State: "block-all-sharing",
      }),
    );
    expect(enableRes.$metadata.httpStatusCode).toBe(200);
    expect(enableRes.State).toBe("block-all-sharing");

    const getRes = await client.send(
      new GetSnapshotBlockPublicAccessStateCommand({}),
    );
    expect(getRes.$metadata.httpStatusCode).toBe(200);
    expect(getRes.State).toBe("block-all-sharing");
  });

  test("EnableImage restores disabled image to available state", async () => {
    const client = ec2();

    const inst = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-placeholder",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = inst.Instances![0].InstanceId!;

    const img = await client.send(
      new CreateImageCommand({
        InstanceId: instanceId,
        Name: "chunk40-enable-img",
      }),
    );
    const imageId = img.ImageId!;
    expect(imageId.startsWith("ami-")).toBe(true);

    const enableRes = await client.send(
      new EnableImageCommand({ ImageId: imageId }),
    );
    expect(enableRes.$metadata.httpStatusCode).toBe(200);
    expect(enableRes.Return).toBe(true);
  });

  test("EnableImageDeprecation sets DeprecationTime on image", async () => {
    const client = ec2();

    const inst = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-placeholder",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = inst.Instances![0].InstanceId!;

    const img = await client.send(
      new CreateImageCommand({
        InstanceId: instanceId,
        Name: "chunk40-dep-img",
      }),
    );
    const imageId = img.ImageId!;

    const deprecateAt = "2030-01-01T00:00:00.000Z";
    const depRes = await client.send(
      new EnableImageDeprecationCommand({
        ImageId: imageId,
        DeprecateAt: new Date(deprecateAt),
      }),
    );
    expect(depRes.$metadata.httpStatusCode).toBe(200);
    expect(depRes.Return).toBe(true);
  });

  test("EnableImageDeregistrationProtection returns successful", async () => {
    const client = ec2();

    const inst = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-placeholder",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = inst.Instances![0].InstanceId!;

    const img = await client.send(
      new CreateImageCommand({
        InstanceId: instanceId,
        Name: "chunk40-dreg-img",
      }),
    );
    const imageId = img.ImageId!;

    const res = await client.send(
      new EnableImageDeregistrationProtectionCommand({ ImageId: imageId }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.Return).toBe("successful");
  });

  test("EnableFastLaunch returns enabling state for valid image", async () => {
    const client = ec2();

    const inst = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-placeholder",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = inst.Instances![0].InstanceId!;

    const img = await client.send(
      new CreateImageCommand({
        InstanceId: instanceId,
        Name: "chunk40-fastlaunch-img",
      }),
    );
    const imageId = img.ImageId!;

    const res = await client.send(
      new EnableFastLaunchCommand({ ImageId: imageId }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.ImageId).toBe(imageId);
    expect(res.State).toBe("enabling");
  });

  test("EnableFastSnapshotRestores returns enabling state", async () => {
    const client = ec2();

    const res = await client.send(
      new EnableFastSnapshotRestoresCommand({
        SourceSnapshotIds: ["snap-00000000000000001"],
        AvailabilityZones: ["us-east-1a"],
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.Successful)).toBe(true);
    expect(res.Successful![0].SnapshotId).toBe("snap-00000000000000001");
    expect(res.Successful![0].State).toBe("enabling");
  });

  test("EnableIpamOrganizationAdminAccount returns Success true", async () => {
    const client = ec2();

    const res = await client.send(
      new EnableIpamOrganizationAdminAccountCommand({
        DelegatedAdminAccountId: "123456789012",
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.Success).toBe(true);
  });

  test("EnableReachabilityAnalyzerOrganizationSharing returns ReturnValue true", async () => {
    const client = ec2();

    const res = await client.send(
      new EnableReachabilityAnalyzerOrganizationSharingCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.ReturnValue).toBe(true);
  });

  test("EnableRouteServerPropagation returns propagation with enabling state", async () => {
    const client = ec2();

    const res = await client.send(
      new EnableRouteServerPropagationCommand({
        RouteServerId: "rs-00000000000000001",
        RouteTableId: "rtb-00000000000000001",
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.RouteServerPropagation!.RouteServerId).toBe(
      "rs-00000000000000001",
    );
    expect(res.RouteServerPropagation!.RouteTableId).toBe(
      "rtb-00000000000000001",
    );
    expect(res.RouteServerPropagation!.State).toBe("pending");
  });
});
