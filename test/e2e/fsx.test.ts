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
  expect(created.FileSystem?.Lifecycle).toBe("AVAILABLE");
  expect(created.FileSystem?.DNSName).toContain(fileSystemId);
  expect(created.FileSystem?.ResourceARN).toContain(
    `:file-system/${fileSystemId}`,
  );

  const described = await fsx.send(
    new DescribeFileSystemsCommand({ FileSystemIds: [fileSystemId ?? ""] }),
  );
  const ids = (described.FileSystems ?? []).map((entry) => entry.FileSystemId);
  expect(ids).toContain(fileSystemId);

  const createdBackup = await fsx.send(
    new CreateBackupCommand({ FileSystemId: fileSystemId }),
  );
  const backupId = createdBackup.Backup?.BackupId;
  expect(backupId).toMatch(/^backup-[0-9a-f]{16}$/);
  expect(createdBackup.Backup?.Lifecycle).toBe("AVAILABLE");
  expect(createdBackup.Backup?.FileSystem?.FileSystemId).toBe(fileSystemId);

  const describedBackups = await fsx.send(
    new DescribeBackupsCommand({ BackupIds: [backupId ?? ""] }),
  );
  const backupIds = (describedBackups.Backups ?? []).map(
    (entry) => entry.BackupId,
  );
  expect(backupIds).toContain(backupId);

  const deleted = await fsx.send(
    new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
  );
  expect(deleted.FileSystemId).toBe(fileSystemId);

  await expect(
    fsx.send(
      new DescribeFileSystemsCommand({ FileSystemIds: [fileSystemId ?? ""] }),
    ),
  ).resolves.toBeDefined();
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
  expect(svmResult.StorageVirtualMachine?.Lifecycle).toBe("CREATED");

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
  expect(volumeResult.Volume?.Lifecycle).toBe("CREATED");

  const snapshotResult = await fsx.send(
    new CreateSnapshotCommand({
      VolumeId: volumeId,
      Name: "test-snapshot",
    }),
  );
  const snapshotId = snapshotResult.Snapshot?.SnapshotId;
  expect(snapshotId).toMatch(/^fsvolsnap-[0-9a-f]{16}$/);
  expect(snapshotResult.Snapshot?.Lifecycle).toBe("AVAILABLE");

  const volumes = await fsx.send(
    new DescribeVolumesCommand({ VolumeIds: [volumeId ?? ""] }),
  );
  expect(volumes.Volumes?.map((v) => v.VolumeId)).toContain(volumeId);

  const snapshots = await fsx.send(
    new DescribeSnapshotsCommand({ SnapshotIds: [snapshotId ?? ""] }),
  );
  expect(snapshots.Snapshots?.map((s) => s.SnapshotId)).toContain(snapshotId);

  const svms = await fsx.send(
    new DescribeStorageVirtualMachinesCommand({
      StorageVirtualMachineIds: [svmId ?? ""],
    }),
  );
  expect(
    svms.StorageVirtualMachines?.map((s) => s.StorageVirtualMachineId),
  ).toContain(svmId);

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
  expect(fcResult.FileCache?.Lifecycle).toBe("AVAILABLE");

  const describedFcs = await fsx.send(
    new DescribeFileCachesCommand({ FileCacheIds: [fileCacheId ?? ""] }),
  );
  expect(describedFcs.FileCaches?.map((fc) => fc.FileCacheId)).toContain(
    fileCacheId,
  );

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
  expect(copyResult.Backup?.Type).toBe("COPY");

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
