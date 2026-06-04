import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AuthorizeClusterSecurityGroupIngressCommand,
  AuthorizeSnapshotAccessCommand,
  BatchDeleteClusterSnapshotsCommand,
  BatchModifyClusterSnapshotsCommand,
  CancelResizeCommand,
  CopyClusterSnapshotCommand,
  CreateAuthenticationProfileCommand,
  CreateClusterCommand,
  CreateClusterParameterGroupCommand,
  CreateClusterSecurityGroupCommand,
  CreateClusterSnapshotCommand,
  CreateClusterSubnetGroupCommand,
  CreateCustomDomainAssociationCommand,
  CreateEventSubscriptionCommand,
  CreateScheduledActionCommand,
  CreateSnapshotCopyGrantCommand,
  CreateSnapshotScheduleCommand,
  CreateTagsCommand,
  CreateUsageLimitCommand,
  DeleteAuthenticationProfileCommand,
  DeleteClusterCommand,
  DeleteClusterParameterGroupCommand,
  DeleteClusterSecurityGroupCommand,
  DeleteClusterSnapshotCommand,
  DeleteClusterSubnetGroupCommand,
  DeleteCustomDomainAssociationCommand,
  DeleteEventSubscriptionCommand,
  DeleteScheduledActionCommand,
  DeleteSnapshotCopyGrantCommand,
  DeleteSnapshotScheduleCommand,
  DeleteTagsCommand,
  DeleteUsageLimitCommand,
  DescribeAccountAttributesCommand,
  DescribeAuthenticationProfilesCommand,
  DescribeClusterDbRevisionsCommand,
  DescribeClusterParameterGroupsCommand,
  DescribeClusterParametersCommand,
  DescribeClusterSecurityGroupsCommand,
  DescribeClusterSnapshotsCommand,
  DescribeClusterSubnetGroupsCommand,
  DescribeClusterTracksCommand,
  DescribeClusterVersionsCommand,
  DescribeClustersCommand,
  DescribeCustomDomainAssociationsCommand,
  DescribeDefaultClusterParametersCommand,
  DescribeEventCategoriesCommand,
  DescribeEventSubscriptionsCommand,
  DescribeEventsCommand,
  DescribeLoggingStatusCommand,
  DescribeNodeConfigurationOptionsCommand,
  DescribeOrderableClusterOptionsCommand,
  DescribeResizeCommand,
  DescribeScheduledActionsCommand,
  DescribeSnapshotCopyGrantsCommand,
  DescribeSnapshotSchedulesCommand,
  DescribeStorageCommand,
  DescribeTableRestoreStatusCommand,
  DescribeTagsCommand,
  DescribeUsageLimitsCommand,
  DisableLoggingCommand,
  DisableSnapshotCopyCommand,
  EnableLoggingCommand,
  EnableSnapshotCopyCommand,
  GetClusterCredentialsCommand,
  GetClusterCredentialsWithIAMCommand,
  ModifyAquaConfigurationCommand,
  ModifyAuthenticationProfileCommand,
  ModifyClusterCommand,
  ModifyClusterDbRevisionCommand,
  ModifyClusterIamRolesCommand,
  ModifyClusterMaintenanceCommand,
  ModifyClusterParameterGroupCommand,
  ModifyClusterSnapshotCommand,
  ModifyClusterSnapshotScheduleCommand,
  ModifyClusterSubnetGroupCommand,
  ModifyCustomDomainAssociationCommand,
  ModifyEventSubscriptionCommand,
  ModifyScheduledActionCommand,
  ModifySnapshotCopyRetentionPeriodCommand,
  ModifySnapshotScheduleCommand,
  ModifyUsageLimitCommand,
  PauseClusterCommand,
  RebootClusterCommand,
  RedshiftClient,
  ResetClusterParameterGroupCommand,
  ResizeClusterCommand,
  RestoreFromClusterSnapshotCommand,
  ResumeClusterCommand,
  RevokeClusterSecurityGroupIngressCommand,
  RevokeSnapshotAccessCommand,
  RotateEncryptionKeyCommand,
} from "@aws-sdk/client-redshift";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const redshift = () =>
  new RedshiftClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Redshift cluster lifecycle", async () => {
  const client = redshift();
  const clusterId = "bunsai-e2e-cluster";

  const created = await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "ra3.xlplus",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
      DBName: "bunsaidb",
    }),
  );
  expect(created.Cluster?.ClusterIdentifier).toBe(clusterId);
  expect(created.Cluster?.ClusterStatus).toBe("available");
  expect(created.Cluster?.NodeType).toBe("ra3.xlplus");
  expect(created.Cluster?.DBName).toBe("bunsaidb");
  expect(created.Cluster?.Endpoint?.Port).toBe(5439);

  const described = await client.send(
    new DescribeClustersCommand({ ClusterIdentifier: clusterId }),
  );
  const cluster = (described.Clusters ?? [])[0];
  expect(cluster?.ClusterIdentifier).toBe(clusterId);
  expect(cluster?.MasterUsername).toBe("admin");

  const modified = await client.send(
    new ModifyClusterCommand({
      ClusterIdentifier: clusterId,
      AutomatedSnapshotRetentionPeriod: 7,
      PreferredMaintenanceWindow: "sun:05:00-sun:05:30",
    }),
  );
  expect(modified.Cluster?.AutomatedSnapshotRetentionPeriod).toBe(7);
  expect(modified.Cluster?.PreferredMaintenanceWindow).toBe(
    "sun:05:00-sun:05:30",
  );

  const paused = await client.send(
    new PauseClusterCommand({ ClusterIdentifier: clusterId }),
  );
  expect(paused.Cluster?.ClusterStatus).toBe("paused");

  const resumed = await client.send(
    new ResumeClusterCommand({ ClusterIdentifier: clusterId }),
  );
  expect(resumed.Cluster?.ClusterStatus).toBe("available");

  await client.send(new RebootClusterCommand({ ClusterIdentifier: clusterId }));

  const rotated = await client.send(
    new RotateEncryptionKeyCommand({ ClusterIdentifier: clusterId }),
  );
  expect(rotated.Cluster?.Encrypted).toBe(true);

  const resized = await client.send(
    new ResizeClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "dc2.large",
      NumberOfNodes: 2,
      ClusterType: "multi-node",
    }),
  );
  expect(resized.Cluster?.NodeType).toBe("dc2.large");

  const iamModified = await client.send(
    new ModifyClusterIamRolesCommand({
      ClusterIdentifier: clusterId,
      AddIamRoles: ["arn:aws:iam::123456789012:role/RedshiftRole"],
    }),
  );
  expect(iamModified.Cluster?.IamRoles?.length).toBeGreaterThan(0);

  await client.send(
    new ModifyClusterMaintenanceCommand({ ClusterIdentifier: clusterId }),
  );
  await client.send(
    new ModifyClusterDbRevisionCommand({
      ClusterIdentifier: clusterId,
      RevisionTarget: "18041",
    }),
  );
  await client.send(
    new ModifyAquaConfigurationCommand({
      ClusterIdentifier: clusterId,
      AquaConfigurationStatus: "disabled",
    }),
  );

  const creds = await client.send(
    new GetClusterCredentialsCommand({
      ClusterIdentifier: clusterId,
      DbUser: "admin",
    }),
  );
  expect(creds.DbUser).toBe("admin");
  expect(creds.DbPassword).toBeDefined();

  const iamCreds = await client.send(
    new GetClusterCredentialsWithIAMCommand({
      ClusterIdentifier: clusterId,
    }),
  );
  expect(iamCreds.DbUser).toBeDefined();

  await client.send(new CancelResizeCommand({ ClusterIdentifier: clusterId }));
  await client.send(
    new DescribeResizeCommand({ ClusterIdentifier: clusterId }),
  );

  const deleted = await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
  expect(deleted.Cluster?.ClusterStatus).toBe("deleting");

  const afterDelete = await client.send(new DescribeClustersCommand({}));
  const remaining = (afterDelete.Clusters ?? []).map(
    (entry) => entry.ClusterIdentifier,
  );
  expect(remaining).not.toContain(clusterId);
});

test("Redshift cluster snapshot lifecycle", async () => {
  const client = redshift();
  const clusterId = "bunsai-snap-cluster";
  const snapshotId = "bunsai-snap-1";
  const copyId = "bunsai-snap-copy-1";

  await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "dc2.large",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
    }),
  );

  const created = await client.send(
    new CreateClusterSnapshotCommand({
      SnapshotIdentifier: snapshotId,
      ClusterIdentifier: clusterId,
    }),
  );
  expect(created.Snapshot?.SnapshotIdentifier).toBe(snapshotId);
  expect(created.Snapshot?.ClusterIdentifier).toBe(clusterId);
  expect(created.Snapshot?.Status).toBe("available");

  const described = await client.send(
    new DescribeClusterSnapshotsCommand({
      ClusterIdentifier: clusterId,
    }),
  );
  const snapshots = described.Snapshots ?? [];
  expect(snapshots.length).toBe(1);
  expect(snapshots[0]?.SnapshotIdentifier).toBe(snapshotId);

  const copied = await client.send(
    new CopyClusterSnapshotCommand({
      SourceSnapshotIdentifier: snapshotId,
      TargetSnapshotIdentifier: copyId,
    }),
  );
  expect(copied.Snapshot?.SnapshotIdentifier).toBe(copyId);

  const authorized = await client.send(
    new AuthorizeSnapshotAccessCommand({
      SnapshotIdentifier: snapshotId,
      AccountWithRestoreAccess: "111122223333",
    }),
  );
  expect(authorized.Snapshot?.AccountsWithRestoreAccess?.length).toBe(1);

  const revoked = await client.send(
    new RevokeSnapshotAccessCommand({
      SnapshotIdentifier: snapshotId,
      AccountWithRestoreAccess: "111122223333",
    }),
  );
  expect(revoked.Snapshot?.AccountsWithRestoreAccess?.length).toBe(0);

  const modified = await client.send(
    new ModifyClusterSnapshotCommand({
      SnapshotIdentifier: snapshotId,
      ManualSnapshotRetentionPeriod: 30,
    }),
  );
  expect(modified.Snapshot?.ManualSnapshotRetentionPeriod).toBe(30);

  const batchModified = await client.send(
    new BatchModifyClusterSnapshotsCommand({
      SnapshotIdentifierList: [snapshotId, copyId],
      ManualSnapshotRetentionPeriod: 14,
    }),
  );
  expect(batchModified.Resources?.length).toBe(2);

  const restored = await client.send(
    new RestoreFromClusterSnapshotCommand({
      ClusterIdentifier: "bunsai-restored-cluster",
      SnapshotIdentifier: snapshotId,
    }),
  );
  expect(restored.Cluster?.ClusterIdentifier).toBe("bunsai-restored-cluster");
  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: "bunsai-restored-cluster",
      SkipFinalClusterSnapshot: true,
    }),
  );

  const batchDeleted = await client.send(
    new BatchDeleteClusterSnapshotsCommand({
      Identifiers: [
        { SnapshotIdentifier: snapshotId },
        { SnapshotIdentifier: copyId },
      ],
    }),
  );
  expect(batchDeleted.Resources?.length).toBe(2);

  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
});

test("Redshift cluster parameter group lifecycle", async () => {
  const client = redshift();
  const groupName = "bunsai-e2e-paramgroup";

  const created = await client.send(
    new CreateClusterParameterGroupCommand({
      ParameterGroupName: groupName,
      ParameterGroupFamily: "redshift-1.0",
      Description: "bunsai e2e parameter group",
    }),
  );
  expect(created.ClusterParameterGroup?.ParameterGroupName).toBe(groupName);
  expect(created.ClusterParameterGroup?.ParameterGroupFamily).toBe(
    "redshift-1.0",
  );

  const described = await client.send(
    new DescribeClusterParameterGroupsCommand({
      ParameterGroupName: groupName,
    }),
  );
  expect((described.ParameterGroups ?? []).length).toBe(1);
  expect(described.ParameterGroups?.[0]?.ParameterGroupName).toBe(groupName);

  const params = await client.send(
    new DescribeClusterParametersCommand({ ParameterGroupName: groupName }),
  );
  expect((params.Parameters ?? []).length).toBeGreaterThan(0);

  const modified = await client.send(
    new ModifyClusterParameterGroupCommand({
      ParameterGroupName: groupName,
      Parameters: [
        {
          ParameterName: "enable_user_activity_logging",
          ParameterValue: "true",
          ApplyType: "static",
        },
      ],
    }),
  );
  expect(modified.ParameterGroupStatus).toBeDefined();

  const defaults = await client.send(
    new DescribeDefaultClusterParametersCommand({
      ParameterGroupFamily: "redshift-1.0",
    }),
  );
  expect(defaults.DefaultClusterParameters?.ParameterGroupFamily).toBe(
    "redshift-1.0",
  );
  expect(
    (defaults.DefaultClusterParameters?.Parameters ?? []).length,
  ).toBeGreaterThan(0);

  const reset = await client.send(
    new ResetClusterParameterGroupCommand({
      ParameterGroupName: groupName,
      ResetAllParameters: true,
    }),
  );
  expect(reset.ParameterGroupName).toBe(groupName);

  await client.send(
    new DeleteClusterParameterGroupCommand({ ParameterGroupName: groupName }),
  );

  const afterDelete = await client.send(
    new DescribeClusterParameterGroupsCommand({}),
  );
  const remaining = (afterDelete.ParameterGroups ?? []).map(
    (g) => g.ParameterGroupName,
  );
  expect(remaining).not.toContain(groupName);
});

test("Redshift cluster security group lifecycle", async () => {
  const client = redshift();
  const groupName = "bunsai-e2e-secgroup";

  const created = await client.send(
    new CreateClusterSecurityGroupCommand({
      ClusterSecurityGroupName: groupName,
      Description: "bunsai e2e security group",
    }),
  );
  expect(created.ClusterSecurityGroup?.ClusterSecurityGroupName).toBe(
    groupName,
  );
  expect(created.ClusterSecurityGroup?.IPRanges?.length).toBe(0);

  const described = await client.send(
    new DescribeClusterSecurityGroupsCommand({
      ClusterSecurityGroupName: groupName,
    }),
  );
  expect((described.ClusterSecurityGroups ?? []).length).toBe(1);

  const authorized = await client.send(
    new AuthorizeClusterSecurityGroupIngressCommand({
      ClusterSecurityGroupName: groupName,
      CIDRIP: "10.0.0.0/8",
    }),
  );
  expect(authorized.ClusterSecurityGroup?.IPRanges?.length).toBe(1);
  expect(authorized.ClusterSecurityGroup?.IPRanges?.[0]?.CIDRIP).toBe(
    "10.0.0.0/8",
  );

  const revoked = await client.send(
    new RevokeClusterSecurityGroupIngressCommand({
      ClusterSecurityGroupName: groupName,
      CIDRIP: "10.0.0.0/8",
    }),
  );
  expect(revoked.ClusterSecurityGroup?.IPRanges?.length).toBe(0);

  await client.send(
    new DeleteClusterSecurityGroupCommand({
      ClusterSecurityGroupName: groupName,
    }),
  );

  const afterDelete = await client.send(
    new DescribeClusterSecurityGroupsCommand({}),
  );
  const remaining = (afterDelete.ClusterSecurityGroups ?? []).map(
    (g) => g.ClusterSecurityGroupName,
  );
  expect(remaining).not.toContain(groupName);
});

test("Redshift cluster subnet group lifecycle", async () => {
  const client = redshift();
  const groupName = "bunsai-e2e-subnetgroup";

  const created = await client.send(
    new CreateClusterSubnetGroupCommand({
      ClusterSubnetGroupName: groupName,
      Description: "bunsai e2e subnet group",
      SubnetIds: ["subnet-aaaa1111", "subnet-bbbb2222"],
    }),
  );
  expect(created.ClusterSubnetGroup?.ClusterSubnetGroupName).toBe(groupName);
  expect(created.ClusterSubnetGroup?.Description).toBe(
    "bunsai e2e subnet group",
  );
  expect((created.ClusterSubnetGroup?.Subnets ?? []).length).toBe(2);

  const described = await client.send(
    new DescribeClusterSubnetGroupsCommand({
      ClusterSubnetGroupName: groupName,
    }),
  );
  expect((described.ClusterSubnetGroups ?? []).length).toBe(1);

  const modified = await client.send(
    new ModifyClusterSubnetGroupCommand({
      ClusterSubnetGroupName: groupName,
      Description: "updated description",
      SubnetIds: ["subnet-cccc3333"],
    }),
  );
  expect(modified.ClusterSubnetGroup?.Description).toBe("updated description");
  expect(modified.ClusterSubnetGroup?.Subnets?.length).toBe(1);

  await client.send(
    new DeleteClusterSubnetGroupCommand({ ClusterSubnetGroupName: groupName }),
  );
});

test("Redshift logging lifecycle", async () => {
  const client = redshift();
  const clusterId = "bunsai-logging-cluster";

  await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "dc2.large",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
    }),
  );

  const initial = await client.send(
    new DescribeLoggingStatusCommand({ ClusterIdentifier: clusterId }),
  );
  expect(initial.LoggingEnabled).toBe(false);

  const enabled = await client.send(
    new EnableLoggingCommand({
      ClusterIdentifier: clusterId,
      BucketName: "bunsai-logs-bucket",
      S3KeyPrefix: "redshift/",
    }),
  );
  expect(enabled.LoggingEnabled).toBe(true);
  expect(enabled.BucketName).toBe("bunsai-logs-bucket");

  const status = await client.send(
    new DescribeLoggingStatusCommand({ ClusterIdentifier: clusterId }),
  );
  expect(status.LoggingEnabled).toBe(true);

  const disabled = await client.send(
    new DisableLoggingCommand({ ClusterIdentifier: clusterId }),
  );
  expect(disabled.LoggingEnabled).toBe(false);

  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
});

test("Redshift tags lifecycle", async () => {
  const client = redshift();
  const resourceArn =
    "arn:aws:redshift:us-east-1:123456789012:cluster:bunsai-tagged";

  await client.send(
    new CreateTagsCommand({
      ResourceName: resourceArn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "project", Value: "bunsai" },
      ],
    }),
  );

  const described = await client.send(
    new DescribeTagsCommand({ ResourceName: resourceArn }),
  );
  expect((described.TaggedResources ?? []).length).toBe(2);

  await client.send(
    new DeleteTagsCommand({
      ResourceName: resourceArn,
      TagKeys: ["env"],
    }),
  );

  const afterDelete = await client.send(
    new DescribeTagsCommand({ ResourceName: resourceArn }),
  );
  expect((afterDelete.TaggedResources ?? []).length).toBe(1);
  expect(afterDelete.TaggedResources?.[0]?.Tag?.Key).toBe("project");
});

test("Redshift describe-only operations", async () => {
  const client = redshift();

  const attrs = await client.send(new DescribeAccountAttributesCommand({}));
  expect((attrs.AccountAttributes ?? []).length).toBeGreaterThan(0);

  const tracks = await client.send(new DescribeClusterTracksCommand({}));
  expect((tracks.MaintenanceTracks ?? []).length).toBeGreaterThan(0);

  const versions = await client.send(new DescribeClusterVersionsCommand({}));
  expect((versions.ClusterVersions ?? []).length).toBeGreaterThan(0);

  const eventCats = await client.send(new DescribeEventCategoriesCommand({}));
  expect((eventCats.EventCategoriesMapList ?? []).length).toBeGreaterThan(0);

  const events = await client.send(new DescribeEventsCommand({}));
  expect(events.Events).toBeDefined();

  const nodeOpts = await client.send(
    new DescribeNodeConfigurationOptionsCommand({
      ActionType: "restore-cluster",
    }),
  );
  expect((nodeOpts.NodeConfigurationOptionList ?? []).length).toBeGreaterThan(
    0,
  );

  const orderableOpts = await client.send(
    new DescribeOrderableClusterOptionsCommand({}),
  );
  expect((orderableOpts.OrderableClusterOptions ?? []).length).toBeGreaterThan(
    0,
  );

  const storage = await client.send(new DescribeStorageCommand({}));
  expect(storage.TotalBackupSizeInMegaBytes).toBeDefined();

  const tableRestoreStatus = await client.send(
    new DescribeTableRestoreStatusCommand({}),
  );
  expect(tableRestoreStatus.TableRestoreStatusDetails).toBeDefined();
});

test("Redshift cluster DB revisions", async () => {
  const client = redshift();
  const clusterId = "bunsai-revision-cluster";

  await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "dc2.large",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
    }),
  );

  const revisions = await client.send(
    new DescribeClusterDbRevisionsCommand({ ClusterIdentifier: clusterId }),
  );
  expect((revisions.ClusterDbRevisions ?? []).length).toBeGreaterThan(0);

  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
});

test("Redshift event-subscription lifecycle", async () => {
  const client = redshift();
  const subName = "bunsai-e2e-eventsub";

  const created = await client.send(
    new CreateEventSubscriptionCommand({
      SubscriptionName: subName,
      SnsTopicArn: "arn:aws:sns:us-east-1:123456789012:bunsai-topic",
      SourceType: "cluster",
      Severity: "INFO",
      Enabled: true,
    }),
  );
  expect(created.EventSubscription?.CustSubscriptionId).toBe(subName);
  expect(created.EventSubscription?.Status).toBe("active");
  expect(created.EventSubscription?.Enabled).toBe(true);

  const listed = await client.send(
    new DescribeEventSubscriptionsCommand({ SubscriptionName: subName }),
  );
  expect((listed.EventSubscriptionsList ?? []).length).toBe(1);
  expect(listed.EventSubscriptionsList?.[0]?.SnsTopicArn).toContain(
    "bunsai-topic",
  );

  const modified = await client.send(
    new ModifyEventSubscriptionCommand({
      SubscriptionName: subName,
      Severity: "ERROR",
      Enabled: false,
    }),
  );
  expect(modified.EventSubscription?.Severity).toBe("ERROR");
  expect(modified.EventSubscription?.Enabled).toBe(false);

  await client.send(
    new DeleteEventSubscriptionCommand({ SubscriptionName: subName }),
  );
  const afterDelete = await client.send(
    new DescribeEventSubscriptionsCommand({}),
  );
  const remaining = (afterDelete.EventSubscriptionsList ?? []).filter(
    (s) => s.CustSubscriptionId === subName,
  );
  expect(remaining.length).toBe(0);
});

test("Redshift scheduled-action lifecycle", async () => {
  const client = redshift();
  const actionName = "bunsai-e2e-action";
  const clusterId = "bunsai-sa-cluster";

  await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "dc2.large",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
    }),
  );

  const created = await client.send(
    new CreateScheduledActionCommand({
      ScheduledActionName: actionName,
      TargetAction: {
        PauseCluster: { ClusterIdentifier: clusterId },
      },
      Schedule: "cron(0 12 * * ? *)",
      IamRole: "arn:aws:iam::123456789012:role/RedshiftScheduler",
      ScheduledActionDescription: "pause daily",
    }),
  );
  expect(created.ScheduledActionName).toBe(actionName);
  expect(created.State).toBe("ACTIVE");

  const listed = await client.send(
    new DescribeScheduledActionsCommand({ ScheduledActionName: actionName }),
  );
  expect((listed.ScheduledActions ?? []).length).toBe(1);

  const modified = await client.send(
    new ModifyScheduledActionCommand({
      ScheduledActionName: actionName,
      ScheduledActionDescription: "pause daily updated",
      Enable: false,
    }),
  );
  expect(modified.State).toBe("DISABLED");

  await client.send(
    new DeleteScheduledActionCommand({ ScheduledActionName: actionName }),
  );

  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
});

test("Redshift snapshot-copy-grant lifecycle", async () => {
  const client = redshift();
  const grantName = "bunsai-e2e-grant";
  const clusterId = "bunsai-sncopy-cluster";

  await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "dc2.large",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
    }),
  );

  const grant = await client.send(
    new CreateSnapshotCopyGrantCommand({
      SnapshotCopyGrantName: grantName,
    }),
  );
  expect(grant.SnapshotCopyGrant?.SnapshotCopyGrantName).toBe(grantName);

  const listed = await client.send(
    new DescribeSnapshotCopyGrantsCommand({
      SnapshotCopyGrantName: grantName,
    }),
  );
  expect((listed.SnapshotCopyGrants ?? []).length).toBe(1);

  const enabled = await client.send(
    new EnableSnapshotCopyCommand({
      ClusterIdentifier: clusterId,
      DestinationRegion: "us-west-2",
      RetentionPeriod: 14,
      SnapshotCopyGrantName: grantName,
    }),
  );
  expect(enabled.Cluster?.ClusterIdentifier).toBe(clusterId);

  const retention = await client.send(
    new ModifySnapshotCopyRetentionPeriodCommand({
      ClusterIdentifier: clusterId,
      RetentionPeriod: 30,
    }),
  );
  expect(retention.Cluster?.ClusterIdentifier).toBe(clusterId);

  const disabled = await client.send(
    new DisableSnapshotCopyCommand({ ClusterIdentifier: clusterId }),
  );
  expect(disabled.Cluster?.ClusterIdentifier).toBe(clusterId);

  await client.send(
    new DeleteSnapshotCopyGrantCommand({ SnapshotCopyGrantName: grantName }),
  );

  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
});

test("Redshift usage-limit lifecycle", async () => {
  const client = redshift();
  const clusterId = "bunsai-ul-cluster";

  await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "dc2.large",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
    }),
  );

  const created = await client.send(
    new CreateUsageLimitCommand({
      ClusterIdentifier: clusterId,
      FeatureType: "spectrum",
      LimitType: "data-scanned",
      Amount: 1024,
      Period: "monthly",
      BreachAction: "log",
    }),
  );
  expect(created.ClusterIdentifier).toBe(clusterId);
  expect(created.Amount).toBe(1024);
  expect(created.FeatureType).toBe("spectrum");
  const limitId = created.UsageLimitId!;

  const listed = await client.send(
    new DescribeUsageLimitsCommand({ ClusterIdentifier: clusterId }),
  );
  expect((listed.UsageLimits ?? []).length).toBeGreaterThan(0);

  const modified = await client.send(
    new ModifyUsageLimitCommand({
      UsageLimitId: limitId,
      Amount: 2048,
      BreachAction: "emit-metric",
    }),
  );
  expect(modified.Amount).toBe(2048);
  expect(modified.BreachAction).toBe("emit-metric");

  await client.send(new DeleteUsageLimitCommand({ UsageLimitId: limitId }));

  const afterDelete = await client.send(
    new DescribeUsageLimitsCommand({ ClusterIdentifier: clusterId }),
  );
  expect((afterDelete.UsageLimits ?? []).length).toBe(0);

  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
});

test("Redshift authentication-profile and snapshot-schedule lifecycle", async () => {
  const client = redshift();

  const profName = "bunsai-e2e-authprofile";
  const profContent = JSON.stringify({ type: "saml", idp_url: "https://idp.example.com" });

  const profCreated = await client.send(
    new CreateAuthenticationProfileCommand({
      AuthenticationProfileName: profName,
      AuthenticationProfileContent: profContent,
    }),
  );
  expect(profCreated.AuthenticationProfileName).toBe(profName);

  const profListed = await client.send(
    new DescribeAuthenticationProfilesCommand({
      AuthenticationProfileName: profName,
    }),
  );
  expect((profListed.AuthenticationProfiles ?? []).length).toBe(1);

  const newContent = JSON.stringify({ type: "saml", idp_url: "https://idp2.example.com" });
  const profModified = await client.send(
    new ModifyAuthenticationProfileCommand({
      AuthenticationProfileName: profName,
      AuthenticationProfileContent: newContent,
    }),
  );
  expect(profModified.AuthenticationProfileContent).toBe(newContent);

  await client.send(
    new DeleteAuthenticationProfileCommand({
      AuthenticationProfileName: profName,
    }),
  );

  const schedId = "bunsai-e2e-schedule";
  const schedCreated = await client.send(
    new CreateSnapshotScheduleCommand({
      ScheduleIdentifier: schedId,
      ScheduleDefinitions: ["rate(12 hours)"],
      ScheduleDescription: "every 12h",
    }),
  );
  expect(schedCreated.ScheduleIdentifier).toBe(schedId);

  const schedListed = await client.send(
    new DescribeSnapshotSchedulesCommand({ ScheduleIdentifier: schedId }),
  );
  expect((schedListed.SnapshotSchedules ?? []).length).toBe(1);

  const schedModified = await client.send(
    new ModifySnapshotScheduleCommand({
      ScheduleIdentifier: schedId,
      ScheduleDefinitions: ["rate(24 hours)"],
    }),
  );
  expect(schedModified.ScheduleDefinitions?.[0]).toBe("rate(24 hours)");

  const clusterId = "bunsai-sched-assoc-cluster";
  await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "dc2.large",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
    }),
  );

  await client.send(
    new ModifyClusterSnapshotScheduleCommand({
      ClusterIdentifier: clusterId,
      ScheduleIdentifier: schedId,
    }),
  );

  const afterAssoc = await client.send(
    new DescribeSnapshotSchedulesCommand({ ScheduleIdentifier: schedId }),
  );
  expect(afterAssoc.SnapshotSchedules?.[0]?.AssociatedClusterCount).toBe(1);

  await client.send(
    new ModifyClusterSnapshotScheduleCommand({
      ClusterIdentifier: clusterId,
      ScheduleIdentifier: schedId,
      DisassociateSchedule: true,
    }),
  );

  await client.send(
    new DeleteSnapshotScheduleCommand({ ScheduleIdentifier: schedId }),
  );

  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
});

test("Redshift custom-domain-association lifecycle", async () => {
  const client = redshift();
  const clusterId = "bunsai-cda-cluster";
  const domainName = "redshift.bunsai.example.com";
  const certArn =
    "arn:aws:acm:us-east-1:123456789012:certificate/bunsai-cert-00000000";

  await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "dc2.large",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
    }),
  );

  const created = await client.send(
    new CreateCustomDomainAssociationCommand({
      ClusterIdentifier: clusterId,
      CustomDomainName: domainName,
      CustomDomainCertificateArn: certArn,
    }),
  );
  expect(created.ClusterIdentifier).toBe(clusterId);
  expect(created.CustomDomainName).toBe(domainName);

  const listed = await client.send(
    new DescribeCustomDomainAssociationsCommand({
      ClusterIdentifier: clusterId,
    }),
  );
  expect((listed.Associations ?? []).length).toBe(1);

  const newCertArn =
    "arn:aws:acm:us-east-1:123456789012:certificate/bunsai-cert-11111111";
  const modified = await client.send(
    new ModifyCustomDomainAssociationCommand({
      ClusterIdentifier: clusterId,
      CustomDomainName: domainName,
      CustomDomainCertificateArn: newCertArn,
    }),
  );
  expect(modified.CustomDomainCertificateArn).toBe(newCertArn);

  await client.send(
    new DeleteCustomDomainAssociationCommand({
      ClusterIdentifier: clusterId,
      CustomDomainName: domainName,
    }),
  );

  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
});
