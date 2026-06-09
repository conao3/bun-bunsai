import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateFileSystemAliasesCommand,
  CancelDataRepositoryTaskCommand,
  CopyBackupCommand,
  CopySnapshotAndUpdateVolumeCommand,
  CreateAndAttachS3AccessPointCommand,
  CreateBackupCommand,
  CreateDataRepositoryAssociationCommand,
  CreateDataRepositoryTaskCommand,
  CreateFileCacheCommand,
  CreateFileSystemCommand,
  CreateFileSystemFromBackupCommand,
  CreateSnapshotCommand,
  CreateStorageVirtualMachineCommand,
  CreateVolumeCommand,
  CreateVolumeFromBackupCommand,
  DeleteBackupCommand,
  DeleteDataRepositoryAssociationCommand,
  DeleteFileCacheCommand,
  DeleteFileSystemCommand,
  DeleteSnapshotCommand,
  DeleteStorageVirtualMachineCommand,
  DeleteVolumeCommand,
  DescribeBackupsCommand,
  DescribeDataRepositoryAssociationsCommand,
  DescribeDataRepositoryTasksCommand,
  DescribeFileCachesCommand,
  DescribeFileSystemAliasesCommand,
  DescribeFileSystemsCommand,
  DescribeS3AccessPointAttachmentsCommand,
  DescribeSharedVpcConfigurationCommand,
  DescribeSnapshotsCommand,
  DescribeStorageVirtualMachinesCommand,
  DescribeVolumesCommand,
  DetachAndDeleteS3AccessPointCommand,
  DisassociateFileSystemAliasesCommand,
  FSxClient,
  ListTagsForResourceCommand,
  ReleaseFileSystemNfsV3LocksCommand,
  RestoreVolumeFromSnapshotCommand,
  StartMisconfiguredStateRecoveryCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateDataRepositoryAssociationCommand,
  UpdateFileCacheCommand,
  UpdateFileSystemCommand,
  UpdateSharedVpcConfigurationCommand,
  UpdateSnapshotCommand,
  UpdateStorageVirtualMachineCommand,
  UpdateVolumeCommand,
} from "@aws-sdk/client-fsx";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = () =>
  new FSxClient({ endpoint, region, credentials, requestHandler });

test("fsx file system and backup round-trip", async () => {
  const fsx = client();

  const created = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "LUSTRE",
      StorageCapacity: 1200,
      SubnetIds: ["subnet-0123456789abcdef0"],
    }),
  );
  const fileSystemId = created.FileSystem?.FileSystemId;
  expect(fileSystemId).toMatch(/^fs-[0-9a-f]{16}$/);
  expect(created.FileSystem?.Lifecycle).toBe("CREATING");
  expect(created.FileSystem?.DNSName).toContain(fileSystemId);
  expect(created.FileSystem?.ResourceARN).toContain(
    `:file-system/${fileSystemId}`,
  );

  const described = await fsx.send(
    new DescribeFileSystemsCommand({ FileSystemIds: [fileSystemId ?? ""] }),
  );
  const ids = (described.FileSystems ?? []).map((entry) => entry.FileSystemId);
  expect(ids).toContain(fileSystemId);
  expect(described.FileSystems?.[0]?.Lifecycle).toBe("AVAILABLE");

  const createdBackup = await fsx.send(
    new CreateBackupCommand({ FileSystemId: fileSystemId }),
  );
  const backupId = createdBackup.Backup?.BackupId;
  expect(backupId).toMatch(/^backup-[0-9a-f]{16}$/);
  expect(createdBackup.Backup?.Lifecycle).toBe("PENDING");
  expect(createdBackup.Backup?.FileSystem?.FileSystemId).toBe(fileSystemId);

  const describedBackups = await fsx.send(
    new DescribeBackupsCommand({ BackupIds: [backupId ?? ""] }),
  );
  const backupIds = (describedBackups.Backups ?? []).map(
    (entry) => entry.BackupId,
  );
  expect(backupIds).toContain(backupId);
  expect(describedBackups.Backups?.[0]?.Lifecycle).toBe("AVAILABLE");

  const deleted = await fsx.send(
    new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
  );
  expect(deleted.FileSystemId).toBe(fileSystemId);

  const afterDelete = await fsx.send(
    new DescribeFileSystemsCommand({ FileSystemIds: [fileSystemId ?? ""] }),
  );
  expect(afterDelete.FileSystems?.[0]?.Lifecycle).toBe("DELETING");
});

test("fsx volume, snapshot, and storage virtual machine round-trip", async () => {
  const fsx = client();

  const fsResult = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "ONTAP",
      StorageCapacity: 1024,
      SubnetIds: ["subnet-0123456789abcdef0"],
    }),
  );
  const fileSystemId = fsResult.FileSystem?.FileSystemId;
  expect(fileSystemId).toMatch(/^fs-[0-9a-f]{16}$/);

  const svmResult = await fsx.send(
    new CreateStorageVirtualMachineCommand({
      FileSystemId: fileSystemId,
      Name: "test-svm",
    }),
  );
  const svmId = svmResult.StorageVirtualMachine?.StorageVirtualMachineId;
  expect(svmId).toMatch(/^svm-[0-9a-f]{16}$/);
  expect(svmResult.StorageVirtualMachine?.Lifecycle).toBe("CREATING");

  const volumeResult = await fsx.send(
    new CreateVolumeCommand({
      VolumeType: "ONTAP",
      Name: "test-volume",
      OntapConfiguration: {
        StorageVirtualMachineId: svmId,
        SizeInMegabytes: 1024,
        StorageEfficiencyEnabled: true,
        JunctionPath: "/testvol",
      },
    }),
  );
  const volumeId = volumeResult.Volume?.VolumeId;
  expect(volumeId).toMatch(/^fsvol-[0-9a-f]{16}$/);
  expect(volumeResult.Volume?.Lifecycle).toBe("CREATING");

  const snapshotResult = await fsx.send(
    new CreateSnapshotCommand({
      VolumeId: volumeId,
      Name: "test-snapshot",
    }),
  );
  const snapshotId = snapshotResult.Snapshot?.SnapshotId;
  expect(snapshotId).toMatch(/^fsvolsnap-[0-9a-f]{16}$/);
  expect(snapshotResult.Snapshot?.Lifecycle).toBe("CREATING");

  const volumes = await fsx.send(
    new DescribeVolumesCommand({ VolumeIds: [volumeId ?? ""] }),
  );
  expect(volumes.Volumes?.map((v) => v.VolumeId)).toContain(volumeId);
  expect(volumes.Volumes?.[0]?.Lifecycle).toBe("AVAILABLE");

  const snapshots = await fsx.send(
    new DescribeSnapshotsCommand({ SnapshotIds: [snapshotId ?? ""] }),
  );
  expect(snapshots.Snapshots?.map((s) => s.SnapshotId)).toContain(snapshotId);
  expect(snapshots.Snapshots?.[0]?.Lifecycle).toBe("AVAILABLE");

  const svms = await fsx.send(
    new DescribeStorageVirtualMachinesCommand({
      StorageVirtualMachineIds: [svmId ?? ""],
    }),
  );
  expect(
    svms.StorageVirtualMachines?.map((s) => s.StorageVirtualMachineId),
  ).toContain(svmId);
  expect(svms.StorageVirtualMachines?.[0]?.Lifecycle).toBe("CREATED");

  const updatedVolume = await fsx.send(
    new UpdateVolumeCommand({ VolumeId: volumeId, Name: "updated-volume" }),
  );
  expect(updatedVolume.Volume?.Name).toBe("updated-volume");

  const updatedSnapshot = await fsx.send(
    new UpdateSnapshotCommand({
      SnapshotId: snapshotId,
      Name: "updated-snapshot",
    }),
  );
  expect(updatedSnapshot.Snapshot?.Name).toBe("updated-snapshot");

  const updatedSvm = await fsx.send(
    new UpdateStorageVirtualMachineCommand({
      StorageVirtualMachineId: svmId,
    }),
  );
  expect(updatedSvm.StorageVirtualMachine?.StorageVirtualMachineId).toBe(svmId);

  const copyResult = await fsx.send(
    new CopySnapshotAndUpdateVolumeCommand({
      VolumeId: volumeId,
      SourceSnapshotARN: snapshotResult.Snapshot?.ResourceARN,
    }),
  );
  expect(copyResult.VolumeId).toBe(volumeId);

  const restoreResult = await fsx.send(
    new RestoreVolumeFromSnapshotCommand({
      VolumeId: volumeId,
      SnapshotId: snapshotId,
    }),
  );
  expect(restoreResult.VolumeId).toBe(volumeId);
  expect(restoreResult.Lifecycle).toBe("CREATED");

  const deletedSnapshot = await fsx.send(
    new DeleteSnapshotCommand({ SnapshotId: snapshotId }),
  );
  expect(deletedSnapshot.Lifecycle).toBe("DELETING");

  const deletedVolume = await fsx.send(
    new DeleteVolumeCommand({ VolumeId: volumeId }),
  );
  expect(deletedVolume.Lifecycle).toBe("DELETING");

  const deletedSvm = await fsx.send(
    new DeleteStorageVirtualMachineCommand({
      StorageVirtualMachineId: svmId,
    }),
  );
  expect(deletedSvm.Lifecycle).toBe("DELETING");

  await fsx.send(new DeleteFileSystemCommand({ FileSystemId: fileSystemId }));
});

test("fsx data repository association and task round-trip", async () => {
  const fsx = client();

  const fsResult = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "LUSTRE",
      StorageCapacity: 1200,
      SubnetIds: ["subnet-0123456789abcdef0"],
    }),
  );
  const fileSystemId = fsResult.FileSystem?.FileSystemId;
  expect(fileSystemId).toMatch(/^fs-[0-9a-f]{16}$/);

  const draResult = await fsx.send(
    new CreateDataRepositoryAssociationCommand({
      FileSystemId: fileSystemId,
      DataRepositoryPath: "s3://my-bucket",
      FileSystemPath: "/data",
    }),
  );
  const associationId = draResult.Association?.AssociationId;
  expect(associationId).toMatch(/^dra-[0-9a-f]{16}$/);
  expect(draResult.Association?.Lifecycle).toBe("AVAILABLE");

  const drtResult = await fsx.send(
    new CreateDataRepositoryTaskCommand({
      Type: "EXPORT_TO_REPOSITORY",
      FileSystemId: fileSystemId,
      Paths: ["/data"],
      Report: { Enabled: false },
    }),
  );
  const taskId = drtResult.DataRepositoryTask?.TaskId;
  expect(taskId).toMatch(/^task-[0-9a-f]{16}$/);
  expect(drtResult.DataRepositoryTask?.Lifecycle).toBe("PENDING");

  const describedDras = await fsx.send(
    new DescribeDataRepositoryAssociationsCommand({
      AssociationIds: [associationId ?? ""],
    }),
  );
  expect(describedDras.Associations?.map((a) => a.AssociationId)).toContain(
    associationId,
  );

  const describedDrts = await fsx.send(
    new DescribeDataRepositoryTasksCommand({
      TaskIds: [taskId ?? ""],
    }),
  );
  expect(describedDrts.DataRepositoryTasks?.map((t) => t.TaskId)).toContain(
    taskId,
  );

  const updatedDra = await fsx.send(
    new UpdateDataRepositoryAssociationCommand({
      AssociationId: associationId,
      ImportedFileChunkSize: 2048,
    }),
  );
  expect(updatedDra.Association?.ImportedFileChunkSize).toBe(2048);

  const cancelResult = await fsx.send(
    new CancelDataRepositoryTaskCommand({ TaskId: taskId }),
  );
  expect(cancelResult.Lifecycle).toBe("CANCELING");
  expect(cancelResult.TaskId).toBe(taskId);

  const deletedDra = await fsx.send(
    new DeleteDataRepositoryAssociationCommand({
      AssociationId: associationId,
    }),
  );
  expect(deletedDra.Lifecycle).toBe("DELETING");

  await fsx.send(new DeleteFileSystemCommand({ FileSystemId: fileSystemId }));
});

test("fsx file cache round-trip", async () => {
  const fsx = client();

  const fcResult = await fsx.send(
    new CreateFileCacheCommand({
      FileCacheType: "LUSTRE",
      FileCacheTypeVersion: "2.12",
      StorageCapacity: 1200,
      SubnetIds: ["subnet-0123456789abcdef0"],
    }),
  );
  const fileCacheId = fcResult.FileCache?.FileCacheId;
  expect(fileCacheId).toMatch(/^fc-[0-9a-f]{16}$/);
  expect(fcResult.FileCache?.Lifecycle).toBe("CREATING");

  const describedFcs = await fsx.send(
    new DescribeFileCachesCommand({ FileCacheIds: [fileCacheId ?? ""] }),
  );
  expect(describedFcs.FileCaches?.map((fc) => fc.FileCacheId)).toContain(
    fileCacheId,
  );
  expect(describedFcs.FileCaches?.[0]?.Lifecycle).toBe("AVAILABLE");

  const updatedFc = await fsx.send(
    new UpdateFileCacheCommand({ FileCacheId: fileCacheId }),
  );
  expect(updatedFc.FileCache?.FileCacheId).toBe(fileCacheId);

  const deletedFc = await fsx.send(
    new DeleteFileCacheCommand({ FileCacheId: fileCacheId }),
  );
  expect(deletedFc.Lifecycle).toBe("DELETING");
  expect(deletedFc.FileCacheId).toBe(fileCacheId);
});

test("fsx aliases, tags, shared vpc, and misc operations", async () => {
  const fsx = client();

  const fsResult = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "WINDOWS",
      StorageCapacity: 300,
      SubnetIds: ["subnet-0123456789abcdef0"],
    }),
  );
  const fileSystemId = fsResult.FileSystem?.FileSystemId;
  const resourceArn = fsResult.FileSystem?.ResourceARN;
  expect(fileSystemId).toMatch(/^fs-[0-9a-f]{16}$/);

  await fsx.send(
    new TagResourceCommand({
      ResourceARN: resourceArn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "project", Value: "fsx-e2e" },
      ],
    }),
  );

  const tags = await fsx.send(
    new ListTagsForResourceCommand({ ResourceARN: resourceArn }),
  );
  const tagKeys = (tags.Tags ?? []).map((t) => t.Key);
  expect(tagKeys).toContain("env");
  expect(tagKeys).toContain("project");

  const describedWithTags = await fsx.send(
    new DescribeFileSystemsCommand({ FileSystemIds: [fileSystemId ?? ""] }),
  );
  const fsTagKeys = (describedWithTags.FileSystems?.[0]?.Tags ?? []).map(
    (t) => t.Key,
  );
  expect(fsTagKeys).toContain("env");
  expect(fsTagKeys).toContain("project");

  await fsx.send(
    new UntagResourceCommand({
      ResourceARN: resourceArn,
      TagKeys: ["project"],
    }),
  );

  const tagsAfterUntag = await fsx.send(
    new ListTagsForResourceCommand({ ResourceARN: resourceArn }),
  );
  const keysAfterUntag = (tagsAfterUntag.Tags ?? []).map((t) => t.Key);
  expect(keysAfterUntag).toContain("env");
  expect(keysAfterUntag).not.toContain("project");

  const associateResult = await fsx.send(
    new AssociateFileSystemAliasesCommand({
      FileSystemId: fileSystemId,
      Aliases: ["alias1.example.com", "alias2.example.com"],
    }),
  );
  const aliasNames = (associateResult.Aliases ?? []).map((a) => a.Name);
  expect(aliasNames).toContain("alias1.example.com");

  const describedAliases = await fsx.send(
    new DescribeFileSystemAliasesCommand({ FileSystemId: fileSystemId }),
  );
  const describedNames = (describedAliases.Aliases ?? []).map((a) => a.Name);
  expect(describedNames).toContain("alias1.example.com");

  const disassociateResult = await fsx.send(
    new DisassociateFileSystemAliasesCommand({
      FileSystemId: fileSystemId,
      Aliases: ["alias1.example.com"],
    }),
  );
  const removedNames = (disassociateResult.Aliases ?? []).map((a) => a.Name);
  expect(removedNames).toContain("alias1.example.com");

  const sharedVpc = await fsx.send(
    new DescribeSharedVpcConfigurationCommand({}),
  );
  expect(
    sharedVpc.EnableFsxRouteTableUpdatesFromParticipantAccounts,
  ).toBeDefined();

  const updatedSharedVpc = await fsx.send(
    new UpdateSharedVpcConfigurationCommand({
      EnableFsxRouteTableUpdatesFromParticipantAccounts: "true",
    }),
  );
  expect(
    updatedSharedVpc.EnableFsxRouteTableUpdatesFromParticipantAccounts,
  ).toBe("true");

  const nfsLocks = await fsx.send(
    new ReleaseFileSystemNfsV3LocksCommand({ FileSystemId: fileSystemId }),
  );
  expect(nfsLocks.FileSystem?.FileSystemId).toBe(fileSystemId);

  const recoveryResult = await fsx.send(
    new StartMisconfiguredStateRecoveryCommand({ FileSystemId: fileSystemId }),
  );
  expect(recoveryResult.FileSystem?.FileSystemId).toBe(fileSystemId);

  const updatedFs = await fsx.send(
    new UpdateFileSystemCommand({
      FileSystemId: fileSystemId,
      StorageCapacity: 600,
    }),
  );
  expect(updatedFs.FileSystem?.StorageCapacity).toBe(600);

  await fsx.send(new DeleteFileSystemCommand({ FileSystemId: fileSystemId }));
});

test("fsx backup copy and restore round-trip", async () => {
  const fsx = client();

  const fsResult = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "LUSTRE",
      StorageCapacity: 1200,
      SubnetIds: ["subnet-0123456789abcdef0"],
    }),
  );
  const fileSystemId = fsResult.FileSystem?.FileSystemId;
  expect(fileSystemId).toMatch(/^fs-[0-9a-f]{16}$/);

  const backupResult = await fsx.send(
    new CreateBackupCommand({ FileSystemId: fileSystemId }),
  );
  const backupId = backupResult.Backup?.BackupId;
  expect(backupId).toMatch(/^backup-[0-9a-f]{16}$/);

  const copyResult = await fsx.send(
    new CopyBackupCommand({ SourceBackupId: backupId }),
  );
  const copiedBackupId = copyResult.Backup?.BackupId;
  expect(copiedBackupId).toMatch(/^backup-[0-9a-f]{16}$/);
  expect(copiedBackupId).not.toBe(backupId);
  expect(String(copyResult.Backup?.Type)).toBe("COPY");

  const restoredFs = await fsx.send(
    new CreateFileSystemFromBackupCommand({
      BackupId: backupId,
      SubnetIds: ["subnet-0123456789abcdef0"],
    }),
  );
  const restoredFsId = restoredFs.FileSystem?.FileSystemId;
  expect(restoredFsId).toMatch(/^fs-[0-9a-f]{16}$/);
  expect(restoredFsId).not.toBe(fileSystemId);

  const volumeFromBackupResult = await fsx.send(
    new CreateVolumeFromBackupCommand({
      BackupId: backupId,
      Name: "volume-from-backup",
    }),
  );
  const volumeId = volumeFromBackupResult.Volume?.VolumeId;
  expect(volumeId).toMatch(/^fsvol-[0-9a-f]{16}$/);

  await fsx.send(new DeleteVolumeCommand({ VolumeId: volumeId }));

  const deletedBackup = await fsx.send(
    new DeleteBackupCommand({ BackupId: backupId }),
  );
  expect(deletedBackup.Lifecycle).toBe("DELETED");

  await fsx.send(new DeleteBackupCommand({ BackupId: copiedBackupId }));

  await fsx.send(new DeleteFileSystemCommand({ FileSystemId: restoredFsId }));
  await fsx.send(new DeleteFileSystemCommand({ FileSystemId: fileSystemId }));
});

test("fsx s3 access point round-trip", async () => {
  const fsx = client();

  const createResult = await fsx.send(
    new CreateAndAttachS3AccessPointCommand({
      Name: "test-s3-access-point",
      Type: "ONTAP",
    }),
  );
  expect(createResult.S3AccessPointAttachment?.Name).toBe(
    "test-s3-access-point",
  );
  expect(createResult.S3AccessPointAttachment?.Lifecycle).toBe("AVAILABLE");

  const describeResult = await fsx.send(
    new DescribeS3AccessPointAttachmentsCommand({
      Names: ["test-s3-access-point"],
    }),
  );
  const names = (describeResult.S3AccessPointAttachments ?? []).map(
    (a) => a.Name,
  );
  expect(names).toContain("test-s3-access-point");

  const deleteResult = await fsx.send(
    new DetachAndDeleteS3AccessPointCommand({ Name: "test-s3-access-point" }),
  );
  expect(deleteResult.Lifecycle).toBe("DELETING");
  expect(deleteResult.Name).toBe("test-s3-access-point");
});

test("fsx describe pagination and soft-delete queryable", async () => {
  const fsx = client();

  const fs1 = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "LUSTRE",
      StorageCapacity: 1200,
      SubnetIds: ["subnet-0123456789abcdef0"],
    }),
  );
  const fs2 = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "LUSTRE",
      StorageCapacity: 1200,
      SubnetIds: ["subnet-0123456789abcdef0"],
    }),
  );
  const fs3 = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "LUSTRE",
      StorageCapacity: 1200,
      SubnetIds: ["subnet-0123456789abcdef0"],
    }),
  );
  const id1 = fs1.FileSystem?.FileSystemId ?? "";
  const id2 = fs2.FileSystem?.FileSystemId ?? "";
  const id3 = fs3.FileSystem?.FileSystemId ?? "";

  const page1 = await fsx.send(
    new DescribeFileSystemsCommand({
      FileSystemIds: [id1, id2, id3],
      MaxResults: 2,
    }),
  );
  expect(page1.FileSystems?.length).toBe(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await fsx.send(
    new DescribeFileSystemsCommand({
      FileSystemIds: [id1, id2, id3],
      MaxResults: 2,
      NextToken: page1.NextToken,
    }),
  );
  expect(page2.FileSystems?.length).toBe(1);
  expect(page2.NextToken).toBeUndefined();

  await fsx.send(new DeleteFileSystemCommand({ FileSystemId: id1 }));
  const afterDel = await fsx.send(
    new DescribeFileSystemsCommand({ FileSystemIds: [id1] }),
  );
  expect(afterDel.FileSystems?.[0]?.Lifecycle).toBe("DELETING");

  await fsx.send(new DeleteFileSystemCommand({ FileSystemId: id2 }));
  await fsx.send(new DeleteFileSystemCommand({ FileSystemId: id3 }));
});

test("fsx HIGH-1: ClientRequestToken idempotency for CreateFileSystem and CreateBackup", async () => {
  const fsx = client();

  const token1 = "unique-token-fs-001";
  const fs1 = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "LUSTRE",
      StorageCapacity: 1200,
      SubnetIds: ["subnet-0123456789abcdef0"],
      ClientRequestToken: token1,
    }),
  );
  const fsId = fs1.FileSystem?.FileSystemId;
  expect(fsId).toMatch(/^fs-/);

  const fs2 = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "LUSTRE",
      StorageCapacity: 1200,
      SubnetIds: ["subnet-0123456789abcdef0"],
      ClientRequestToken: token1,
    }),
  );
  expect(fs2.FileSystem?.FileSystemId).toBe(fsId);

  const token2 = "unique-token-backup-001";
  const bk1 = await fsx.send(
    new CreateBackupCommand({
      FileSystemId: fsId,
      ClientRequestToken: token2,
    }),
  );
  const backupId = bk1.Backup?.BackupId;
  expect(backupId).toMatch(/^backup-/);

  const bk2 = await fsx.send(
    new CreateBackupCommand({
      FileSystemId: fsId,
      ClientRequestToken: token2,
    }),
  );
  expect(bk2.Backup?.BackupId).toBe(backupId);

  await fsx.send(new DeleteBackupCommand({ BackupId: backupId }));
  await fsx.send(new DeleteFileSystemCommand({ FileSystemId: fsId }));
});

test("fsx HIGH-2: tag cleanup on delete — no tag leak after re-create", async () => {
  const fsx = client();

  const created = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "LUSTRE",
      StorageCapacity: 1200,
      SubnetIds: ["subnet-0123456789abcdef0"],
      Tags: [{ Key: "leak-test", Value: "yes" }],
    }),
  );
  const fsId = created.FileSystem?.FileSystemId;
  const arn = created.FileSystem?.ResourceARN;

  await fsx.send(
    new TagResourceCommand({
      ResourceARN: arn,
      Tags: [{ Key: "extra", Value: "tag" }],
    }),
  );
  const beforeDelete = await fsx.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect(beforeDelete.Tags?.map((t) => t.Key)).toContain("extra");

  await fsx.send(new DeleteFileSystemCommand({ FileSystemId: fsId }));

  const afterDelete = await fsx.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect(afterDelete.Tags ?? []).toHaveLength(0);
});

test("fsx HIGH-3: in-use guards prevent deletion of parent with active children", async () => {
  const fsx = client();

  const fsResult = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "ONTAP",
      StorageCapacity: 1024,
      SubnetIds: ["subnet-0123456789abcdef0"],
    }),
  );
  const fsId = fsResult.FileSystem?.FileSystemId;

  const svmResult = await fsx.send(
    new CreateStorageVirtualMachineCommand({
      FileSystemId: fsId,
      Name: "svm-guard-test",
    }),
  );
  const svmId = svmResult.StorageVirtualMachine?.StorageVirtualMachineId;

  const volResult = await fsx.send(
    new CreateVolumeCommand({
      VolumeType: "ONTAP",
      Name: "vol-guard-test",
      OntapConfiguration: {
        StorageVirtualMachineId: svmId,
        SizeInMegabytes: 512,
        StorageEfficiencyEnabled: true,
        JunctionPath: "/guard",
      },
    }),
  );
  const volId = volResult.Volume?.VolumeId;

  const snapResult = await fsx.send(
    new CreateSnapshotCommand({
      VolumeId: volId,
      Name: "snap-guard-test",
    }),
  );
  const snapId = snapResult.Snapshot?.SnapshotId;

  await expect(
    fsx.send(new DeleteVolumeCommand({ VolumeId: volId })),
  ).rejects.toThrow();

  await expect(
    fsx.send(
      new DeleteStorageVirtualMachineCommand({
        StorageVirtualMachineId: svmId,
      }),
    ),
  ).rejects.toThrow();

  await expect(
    fsx.send(new DeleteFileSystemCommand({ FileSystemId: fsId })),
  ).rejects.toThrow();

  await fsx.send(new DeleteSnapshotCommand({ SnapshotId: snapId }));
  await fsx.send(new DeleteVolumeCommand({ VolumeId: volId }));
  await fsx.send(
    new DeleteStorageVirtualMachineCommand({ StorageVirtualMachineId: svmId }),
  );
  await fsx.send(new DeleteFileSystemCommand({ FileSystemId: fsId }));
});

test("fsx HIGH-4: DeleteDataRepositoryAssociation is soft-delete — Lifecycle=DELETING visible", async () => {
  const fsx = client();

  const fsResult = await fsx.send(
    new CreateFileSystemCommand({
      FileSystemType: "LUSTRE",
      StorageCapacity: 1200,
      SubnetIds: ["subnet-0123456789abcdef0"],
    }),
  );
  const fsId = fsResult.FileSystem?.FileSystemId;

  const draResult = await fsx.send(
    new CreateDataRepositoryAssociationCommand({
      FileSystemId: fsId,
      DataRepositoryPath: "s3://my-bucket-high4",
      FileSystemPath: "/data-high4",
    }),
  );
  const associationId = draResult.Association?.AssociationId;
  expect(associationId).toMatch(/^dra-/);

  const deleteResult = await fsx.send(
    new DeleteDataRepositoryAssociationCommand({
      AssociationId: associationId,
    }),
  );
  expect(deleteResult.Lifecycle).toBe("DELETING");

  const described = await fsx.send(
    new DescribeDataRepositoryAssociationsCommand({
      AssociationIds: [associationId ?? ""],
    }),
  );
  expect(described.Associations?.length).toBe(1);
  expect(described.Associations?.[0]?.Lifecycle).toBe("DELETING");

  await fsx.send(new DeleteFileSystemCommand({ FileSystemId: fsId }));
});
