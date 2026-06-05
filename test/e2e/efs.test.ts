import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateAccessPointCommand,
  CreateFileSystemCommand,
  CreateMountTargetCommand,
  CreateReplicationConfigurationCommand,
  CreateTagsCommand,
  DeleteAccessPointCommand,
  DeleteFileSystemCommand,
  DeleteFileSystemPolicyCommand,
  DeleteMountTargetCommand,
  DeleteReplicationConfigurationCommand,
  DeleteTagsCommand,
  DescribeAccessPointsCommand,
  DescribeAccountPreferencesCommand,
  DescribeBackupPolicyCommand,
  DescribeFileSystemPolicyCommand,
  DescribeFileSystemsCommand,
  DescribeLifecycleConfigurationCommand,
  DescribeMountTargetSecurityGroupsCommand,
  DescribeMountTargetsCommand,
  DescribeReplicationConfigurationsCommand,
  DescribeTagsCommand,
  EFSClient,
  ListTagsForResourceCommand,
  ModifyMountTargetSecurityGroupsCommand,
  PutAccountPreferencesCommand,
  PutBackupPolicyCommand,
  PutFileSystemPolicyCommand,
  PutLifecycleConfigurationCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateFileSystemCommand,
  UpdateFileSystemProtectionCommand,
} from "@aws-sdk/client-efs";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const efs = () => new EFSClient({ endpoint, region, credentials });

test("EFS file system, mount target and lifecycle roundtrip", async () => {
  const client = efs();
  const creationToken = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateFileSystemCommand({
      CreationToken: creationToken,
      Tags: [{ Key: "Name", Value: "bunsai-e2e" }],
    }),
  );
  expect(created.FileSystemId).toMatch(/^fs-/);
  expect(created.CreationToken).toBe(creationToken);
  expect(created.LifeCycleState).toBe("available");
  expect(created.Name).toBe("bunsai-e2e");
  const fileSystemId = created.FileSystemId as string;

  const described = await client.send(
    new DescribeFileSystemsCommand({ FileSystemId: fileSystemId }),
  );
  const fileSystems = described.FileSystems ?? [];
  expect(fileSystems.map((fs) => fs.FileSystemId)).toContain(fileSystemId);

  const mountTarget = await client.send(
    new CreateMountTargetCommand({
      FileSystemId: fileSystemId,
      SubnetId: "subnet-0123456789abcdef0",
    }),
  );
  expect(mountTarget.MountTargetId).toMatch(/^fsmt-/);
  expect(mountTarget.FileSystemId).toBe(fileSystemId);
  expect(mountTarget.LifeCycleState).toBe("available");
  const mountTargetId = mountTarget.MountTargetId as string;

  const mountTargets = await client.send(
    new DescribeMountTargetsCommand({ FileSystemId: fileSystemId }),
  );
  expect(
    (mountTargets.MountTargets ?? []).map((mt) => mt.MountTargetId),
  ).toContain(mountTargetId);

  const lifecycle = await client.send(
    new PutLifecycleConfigurationCommand({
      FileSystemId: fileSystemId,
      LifecyclePolicies: [{ TransitionToIA: "AFTER_30_DAYS" }],
    }),
  );
  expect((lifecycle.LifecyclePolicies ?? [])[0]?.TransitionToIA).toBe(
    "AFTER_30_DAYS",
  );

  await expect(
    client.send(new DeleteFileSystemCommand({ FileSystemId: fileSystemId })),
  ).rejects.toThrow();

  const deletable = await client.send(
    new CreateFileSystemCommand({ CreationToken: `${creationToken}-aux` }),
  );
  const deletableId = deletable.FileSystemId as string;
  await client.send(new DeleteFileSystemCommand({ FileSystemId: deletableId }));

  const afterDelete = await client.send(
    new DescribeFileSystemsCommand({ FileSystemId: deletableId }),
  );
  expect(afterDelete.FileSystems ?? []).toHaveLength(0);
  void mountTargetId;
});

test("EFS UpdateFileSystem", async () => {
  const client = efs();
  const token = `upd-fs-${Date.now()}`;
  const created = await client.send(
    new CreateFileSystemCommand({ CreationToken: token }),
  );
  const fileSystemId = created.FileSystemId as string;

  const updated = await client.send(
    new UpdateFileSystemCommand({
      FileSystemId: fileSystemId,
      ThroughputMode: "bursting",
    }),
  );
  expect(updated.FileSystemId).toBe(fileSystemId);
  expect(updated.ThroughputMode).toBe("bursting");

  await client.send(
    new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
  );
});

test("EFS UpdateFileSystemProtection", async () => {
  const client = efs();
  const token = `upd-prot-${Date.now()}`;
  const created = await client.send(
    new CreateFileSystemCommand({ CreationToken: token }),
  );
  const fileSystemId = created.FileSystemId as string;

  const updated = await client.send(
    new UpdateFileSystemProtectionCommand({
      FileSystemId: fileSystemId,
      ReplicationOverwriteProtection: "DISABLED",
    }),
  );
  expect(updated.ReplicationOverwriteProtection).toBe("DISABLED");

  await client.send(
    new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
  );
});

test("EFS PutFileSystemPolicy / DescribeFileSystemPolicy / DeleteFileSystemPolicy", async () => {
  const client = efs();
  const token = `policy-${Date.now()}`;
  const created = await client.send(
    new CreateFileSystemCommand({ CreationToken: token }),
  );
  const fileSystemId = created.FileSystemId as string;

  const policy = JSON.stringify({ Statement: [{ Effect: "Allow" }] });
  const put = await client.send(
    new PutFileSystemPolicyCommand({
      FileSystemId: fileSystemId,
      Policy: policy,
    }),
  );
  expect(put.FileSystemId).toBe(fileSystemId);
  expect(put.Policy).toBe(policy);

  const described = await client.send(
    new DescribeFileSystemPolicyCommand({ FileSystemId: fileSystemId }),
  );
  expect(described.Policy).toBe(policy);

  await client.send(
    new DeleteFileSystemPolicyCommand({ FileSystemId: fileSystemId }),
  );

  await expect(
    client.send(
      new DescribeFileSystemPolicyCommand({ FileSystemId: fileSystemId }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
  );
});

test("EFS PutBackupPolicy / DescribeBackupPolicy", async () => {
  const client = efs();
  const token = `backup-${Date.now()}`;
  const created = await client.send(
    new CreateFileSystemCommand({ CreationToken: token }),
  );
  const fileSystemId = created.FileSystemId as string;

  const defaultBp = await client.send(
    new DescribeBackupPolicyCommand({ FileSystemId: fileSystemId }),
  );
  expect(defaultBp.BackupPolicy?.Status).toBe("DISABLED");

  const put = await client.send(
    new PutBackupPolicyCommand({
      FileSystemId: fileSystemId,
      BackupPolicy: { Status: "ENABLED" },
    }),
  );
  expect(put.BackupPolicy?.Status).toBe("ENABLED");

  const described = await client.send(
    new DescribeBackupPolicyCommand({ FileSystemId: fileSystemId }),
  );
  expect(described.BackupPolicy?.Status).toBe("ENABLED");

  await client.send(
    new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
  );
});

test("EFS DescribeLifecycleConfiguration", async () => {
  const client = efs();
  const token = `lc-desc-${Date.now()}`;
  const created = await client.send(
    new CreateFileSystemCommand({ CreationToken: token }),
  );
  const fileSystemId = created.FileSystemId as string;

  const empty = await client.send(
    new DescribeLifecycleConfigurationCommand({ FileSystemId: fileSystemId }),
  );
  expect(empty.LifecyclePolicies).toEqual([]);

  await client.send(
    new PutLifecycleConfigurationCommand({
      FileSystemId: fileSystemId,
      LifecyclePolicies: [{ TransitionToIA: "AFTER_7_DAYS" }],
    }),
  );

  const described = await client.send(
    new DescribeLifecycleConfigurationCommand({ FileSystemId: fileSystemId }),
  );
  expect((described.LifecyclePolicies ?? [])[0]?.TransitionToIA).toBe(
    "AFTER_7_DAYS",
  );

  await client.send(
    new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
  );
});

test("EFS DeleteMountTarget", async () => {
  const client = efs();
  const token = `del-mt-${Date.now()}`;
  const created = await client.send(
    new CreateFileSystemCommand({ CreationToken: token }),
  );
  const fileSystemId = created.FileSystemId as string;

  const mt = await client.send(
    new CreateMountTargetCommand({
      FileSystemId: fileSystemId,
      SubnetId: "subnet-abc",
    }),
  );
  const mountTargetId = mt.MountTargetId as string;

  const before = await client.send(
    new DescribeMountTargetsCommand({ FileSystemId: fileSystemId }),
  );
  expect((before.MountTargets ?? []).map((m) => m.MountTargetId)).toContain(
    mountTargetId,
  );

  await client.send(
    new DeleteMountTargetCommand({ MountTargetId: mountTargetId }),
  );

  const after = await client.send(
    new DescribeMountTargetsCommand({ FileSystemId: fileSystemId }),
  );
  expect((after.MountTargets ?? []).map((m) => m.MountTargetId)).not.toContain(
    mountTargetId,
  );

  await client.send(
    new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
  );
});

test("EFS DescribeMountTargetSecurityGroups / ModifyMountTargetSecurityGroups", async () => {
  const client = efs();
  const token = `sg-${Date.now()}`;
  const created = await client.send(
    new CreateFileSystemCommand({ CreationToken: token }),
  );
  const fileSystemId = created.FileSystemId as string;

  const mt = await client.send(
    new CreateMountTargetCommand({
      FileSystemId: fileSystemId,
      SubnetId: "subnet-sg-test",
    }),
  );
  const mountTargetId = mt.MountTargetId as string;

  const initial = await client.send(
    new DescribeMountTargetSecurityGroupsCommand({
      MountTargetId: mountTargetId,
    }),
  );
  expect(initial.SecurityGroups).toEqual([]);

  await client.send(
    new ModifyMountTargetSecurityGroupsCommand({
      MountTargetId: mountTargetId,
      SecurityGroups: ["sg-11111111", "sg-22222222"],
    }),
  );

  const updated = await client.send(
    new DescribeMountTargetSecurityGroupsCommand({
      MountTargetId: mountTargetId,
    }),
  );
  expect(updated.SecurityGroups).toContain("sg-11111111");
  expect(updated.SecurityGroups).toContain("sg-22222222");

  await client.send(
    new DeleteMountTargetCommand({ MountTargetId: mountTargetId }),
  );
  await client.send(
    new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
  );
});

test("EFS CreateAccessPoint / DeleteAccessPoint / DescribeAccessPoints", async () => {
  const client = efs();
  const token = `ap-${Date.now()}`;
  const created = await client.send(
    new CreateFileSystemCommand({ CreationToken: token }),
  );
  const fileSystemId = created.FileSystemId as string;

  const ap = await client.send(
    new CreateAccessPointCommand({
      FileSystemId: fileSystemId,
      Tags: [{ Key: "Name", Value: "my-ap" }],
    }),
  );
  expect(ap.AccessPointId).toMatch(/^fsap-/);
  expect(ap.FileSystemId).toBe(fileSystemId);
  expect(ap.LifeCycleState).toBe("available");
  const accessPointId = ap.AccessPointId as string;

  const described = await client.send(
    new DescribeAccessPointsCommand({ FileSystemId: fileSystemId }),
  );
  expect((described.AccessPoints ?? []).map((a) => a.AccessPointId)).toContain(
    accessPointId,
  );

  const byId = await client.send(
    new DescribeAccessPointsCommand({ AccessPointId: accessPointId }),
  );
  expect((byId.AccessPoints ?? [])[0]?.AccessPointId).toBe(accessPointId);

  await client.send(
    new DeleteAccessPointCommand({ AccessPointId: accessPointId }),
  );

  const afterDelete = await client.send(
    new DescribeAccessPointsCommand({ AccessPointId: accessPointId }),
  );
  expect(afterDelete.AccessPoints ?? []).toHaveLength(0);

  await client.send(
    new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
  );
});

test("EFS CreateReplicationConfiguration / DescribeReplicationConfigurations / DeleteReplicationConfiguration", async () => {
  const client = efs();
  const token = `repl-${Date.now()}`;
  const created = await client.send(
    new CreateFileSystemCommand({ CreationToken: token }),
  );
  const sourceFileSystemId = created.FileSystemId as string;

  const repl = await client.send(
    new CreateReplicationConfigurationCommand({
      SourceFileSystemId: sourceFileSystemId,
      Destinations: [{ Region: "us-west-2" }],
    }),
  );
  expect(repl.SourceFileSystemId).toBe(sourceFileSystemId);
  expect(repl.SourceFileSystemRegion).toBe(region);
  expect((repl.Destinations ?? [])[0]?.Region).toBe("us-west-2");
  expect((repl.Destinations ?? [])[0]?.Status).toBe("ENABLED");

  const described = await client.send(
    new DescribeReplicationConfigurationsCommand({
      FileSystemId: sourceFileSystemId,
    }),
  );
  expect(
    (described.Replications ?? []).map((r) => r.SourceFileSystemId),
  ).toContain(sourceFileSystemId);

  await client.send(
    new DeleteReplicationConfigurationCommand({
      SourceFileSystemId: sourceFileSystemId,
    }),
  );

  const afterDelete = await client.send(
    new DescribeReplicationConfigurationsCommand({
      FileSystemId: sourceFileSystemId,
    }),
  );
  expect(afterDelete.Replications ?? []).toHaveLength(0);

  await client.send(
    new DeleteFileSystemCommand({ FileSystemId: sourceFileSystemId }),
  );
});

test("EFS PutAccountPreferences / DescribeAccountPreferences", async () => {
  const client = efs();

  const put = await client.send(
    new PutAccountPreferencesCommand({ ResourceIdType: "LONG_ID" }),
  );
  expect(put.ResourceIdPreference?.ResourceIdType).toBe("LONG_ID");

  const described = await client.send(
    new DescribeAccountPreferencesCommand({}),
  );
  expect(described.ResourceIdPreference?.ResourceIdType).toBe("LONG_ID");
});

test("EFS CreateTags / DeleteTags / DescribeTags", async () => {
  const client = efs();
  const token = `tags-legacy-${Date.now()}`;
  const created = await client.send(
    new CreateFileSystemCommand({ CreationToken: token }),
  );
  const fileSystemId = created.FileSystemId as string;

  await client.send(
    new CreateTagsCommand({
      FileSystemId: fileSystemId,
      Tags: [
        { Key: "Env", Value: "test" },
        { Key: "Project", Value: "bunsai" },
      ],
    }),
  );

  const described = await client.send(
    new DescribeTagsCommand({ FileSystemId: fileSystemId }),
  );
  const keys = (described.Tags ?? []).map((t) => t.Key);
  expect(keys).toContain("Env");
  expect(keys).toContain("Project");

  await client.send(
    new DeleteTagsCommand({ FileSystemId: fileSystemId, TagKeys: ["Env"] }),
  );

  const afterDelete = await client.send(
    new DescribeTagsCommand({ FileSystemId: fileSystemId }),
  );
  expect((afterDelete.Tags ?? []).map((t) => t.Key)).not.toContain("Env");
  expect((afterDelete.Tags ?? []).map((t) => t.Key)).toContain("Project");

  await client.send(
    new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
  );
});

test("EFS TagResource / UntagResource / ListTagsForResource", async () => {
  const client = efs();
  const token = `tags-arn-${Date.now()}`;
  const created = await client.send(
    new CreateFileSystemCommand({ CreationToken: token }),
  );
  const fileSystemId = created.FileSystemId as string;
  const fileSystemArn = created.FileSystemArn as string;

  await client.send(
    new TagResourceCommand({
      ResourceId: fileSystemArn,
      Tags: [{ Key: "Owner", Value: "alice" }],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceId: fileSystemArn }),
  );
  expect((listed.Tags ?? []).map((t) => t.Key)).toContain("Owner");

  await client.send(
    new UntagResourceCommand({
      ResourceId: fileSystemArn,
      TagKeys: ["Owner"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceId: fileSystemArn }),
  );
  expect((afterUntag.Tags ?? []).map((t) => t.Key)).not.toContain("Owner");

  await client.send(
    new DeleteFileSystemCommand({ FileSystemId: fileSystemId }),
  );
});
