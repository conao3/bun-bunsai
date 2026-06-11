import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateAccessPointCommand,
  CreateFileSystemCommand,
  CreateMountTargetCommand,
  DeleteAccessPointCommand,
  DeleteFileSystemCommand,
  DeleteMountTargetCommand,
  DescribeAccessPointsCommand,
  DescribeFileSystemsCommand,
  DescribeLifecycleConfigurationCommand,
  DescribeMountTargetsCommand,
  EFSClient,
  PutLifecycleConfigurationCommand,
} from "@aws-sdk/client-efs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("EFS scenario e2e", () => {
  const efs = () =>
    new EFSClient({ endpoint, region, credentials, requestHandler });

  test("shared file system lifecycle with guarded teardown", async () => {
    const client = efs();
    const creationToken = `efs-scenario-${Date.now()}`;

    const created = await client.send(
      new CreateFileSystemCommand({ CreationToken: creationToken }),
    );
    expect(created.LifeCycleState).toBe("creating");
    expect(created.FileSystemId).toMatch(/^fs-/);
    expect(created.FileSystemArn).toMatch(/^arn:aws:elasticfilesystem:/);
    expect(created.NumberOfMountTargets).toBe(0);
    const fileSystemId = created.FileSystemId as string;

    const described = await client.send(
      new DescribeFileSystemsCommand({ FileSystemId: fileSystemId }),
    );
    expect((described.FileSystems ?? [])[0]?.LifeCycleState).toBe("available");

    const mt = await client.send(
      new CreateMountTargetCommand({
        FileSystemId: fileSystemId,
        SubnetId: "subnet-scenario-001",
      }),
    );
    expect(mt.MountTargetId).toMatch(/^fsmt-/);
    expect(mt.LifeCycleState).toBe("available");
    const mountTargetId = mt.MountTargetId as string;

    const mountTargets = await client.send(
      new DescribeMountTargetsCommand({ FileSystemId: fileSystemId }),
    );
    expect(
      (mountTargets.MountTargets ?? []).map((m) => m.MountTargetId),
    ).toContain(mountTargetId);

    const withMt = await client.send(
      new DescribeFileSystemsCommand({ FileSystemId: fileSystemId }),
    );
    expect((withMt.FileSystems ?? [])[0]?.NumberOfMountTargets).toBe(1);

    const ap = await client.send(
      new CreateAccessPointCommand({
        ClientToken: `ap-${creationToken}`,
        FileSystemId: fileSystemId,
      }),
    );
    expect(ap.AccessPointId).toMatch(/^fsap-/);
    expect(ap.FileSystemId).toBe(fileSystemId);
    const accessPointId = ap.AccessPointId as string;

    const accessPoints = await client.send(
      new DescribeAccessPointsCommand({ FileSystemId: fileSystemId }),
    );
    expect(
      (accessPoints.AccessPoints ?? []).map((a) => a.AccessPointId),
    ).toContain(accessPointId);

    const lifecycle = await client.send(
      new PutLifecycleConfigurationCommand({
        FileSystemId: fileSystemId,
        LifecyclePolicies: [{ TransitionToIA: "AFTER_14_DAYS" }],
      }),
    );
    expect((lifecycle.LifecyclePolicies ?? [])[0]?.TransitionToIA).toBe(
      "AFTER_14_DAYS",
    );

    const lcDescribed = await client.send(
      new DescribeLifecycleConfigurationCommand({ FileSystemId: fileSystemId }),
    );
    expect((lcDescribed.LifecyclePolicies ?? [])[0]?.TransitionToIA).toBe(
      "AFTER_14_DAYS",
    );

    await expect(
      client.send(new DeleteFileSystemCommand({ FileSystemId: fileSystemId })),
    ).rejects.toMatchObject({ name: "FileSystemInUse" });

    await client.send(
      new DeleteMountTargetCommand({ MountTargetId: mountTargetId }),
    );

    const afterMtDelete = await client.send(
      new DescribeFileSystemsCommand({ FileSystemId: fileSystemId }),
    );
    expect((afterMtDelete.FileSystems ?? [])[0]?.NumberOfMountTargets).toBe(0);

    await client.send(
      new DeleteAccessPointCommand({ AccessPointId: accessPointId }),
    );

    await client.send(
      new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
    );

    const afterFsDelete = await client.send(
      new DescribeFileSystemsCommand({ FileSystemId: fileSystemId }),
    );
    expect(afterFsDelete.FileSystems ?? []).toHaveLength(0);
  });
});
