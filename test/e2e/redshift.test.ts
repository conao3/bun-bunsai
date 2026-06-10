import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AcceptReservedNodeExchangeCommand,
  AssociateDataShareConsumerCommand,
  AuthorizeClusterSecurityGroupIngressCommand,
  AuthorizeDataShareCommand,
  AuthorizeEndpointAccessCommand,
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
  CreateEndpointAccessCommand,
  CreateEventSubscriptionCommand,
  CreateHsmClientCertificateCommand,
  CreateHsmConfigurationCommand,
  CreateScheduledActionCommand,
  CreateSnapshotCopyGrantCommand,
  CreateSnapshotScheduleCommand,
  CreateTagsCommand,
  CreateUsageLimitCommand,
  DeauthorizeDataShareCommand,
  DeleteAuthenticationProfileCommand,
  DeleteClusterCommand,
  DeleteClusterParameterGroupCommand,
  DeleteClusterSecurityGroupCommand,
  DeleteClusterSnapshotCommand,
  DeleteClusterSubnetGroupCommand,
  DeleteCustomDomainAssociationCommand,
  DeleteEndpointAccessCommand,
  DeleteEventSubscriptionCommand,
  DeleteHsmClientCertificateCommand,
  DeleteHsmConfigurationCommand,
  DeleteScheduledActionCommand,
  DeleteSnapshotCopyGrantCommand,
  DeleteSnapshotScheduleCommand,
  DeleteTagsCommand,
  DeleteUsageLimitCommand,
  DeregisterNamespaceCommand,
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
  DescribeDataSharesCommand,
  DescribeDataSharesForConsumerCommand,
  DescribeDataSharesForProducerCommand,
  DescribeDefaultClusterParametersCommand,
  DescribeEndpointAccessCommand,
  DescribeEndpointAuthorizationCommand,
  DescribeEventCategoriesCommand,
  DescribeEventSubscriptionsCommand,
  DescribeEventsCommand,
  DescribeHsmClientCertificatesCommand,
  DescribeHsmConfigurationsCommand,
  DescribeLoggingStatusCommand,
  DescribeNodeConfigurationOptionsCommand,
  DescribeOrderableClusterOptionsCommand,
  DescribeResizeCommand,
  DescribeReservedNodeExchangeStatusCommand,
  DescribeReservedNodeOfferingsCommand,
  DescribeReservedNodesCommand,
  DescribeScheduledActionsCommand,
  DescribeSnapshotCopyGrantsCommand,
  DescribeSnapshotSchedulesCommand,
  DescribeStorageCommand,
  DescribeTableRestoreStatusCommand,
  DescribeTagsCommand,
  DescribeUsageLimitsCommand,
  DisableLoggingCommand,
  DisableSnapshotCopyCommand,
  DisassociateDataShareConsumerCommand,
  EnableLoggingCommand,
  EnableSnapshotCopyCommand,
  GetClusterCredentialsCommand,
  GetClusterCredentialsWithIAMCommand,
  GetReservedNodeExchangeConfigurationOptionsCommand,
  GetReservedNodeExchangeOfferingsCommand,
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
  ModifyEndpointAccessCommand,
  ModifyEventSubscriptionCommand,
  ModifyScheduledActionCommand,
  ModifySnapshotCopyRetentionPeriodCommand,
  ModifySnapshotScheduleCommand,
  ModifyUsageLimitCommand,
  PauseClusterCommand,
  PurchaseReservedNodeOfferingCommand,
  RebootClusterCommand,
  RedshiftClient,
  RegisterNamespaceCommand,
  RejectDataShareCommand,
  ResetClusterParameterGroupCommand,
  ResizeClusterCommand,
  RestoreFromClusterSnapshotCommand,
  RestoreTableFromClusterSnapshotCommand,
  ResumeClusterCommand,
  RevokeClusterSecurityGroupIngressCommand,
  RevokeEndpointAccessCommand,
  RevokeSnapshotAccessCommand,
  RotateEncryptionKeyCommand,
  CreateIntegrationCommand,
  DeleteIntegrationCommand,
  DescribeIntegrationsCommand,
  DescribeInboundIntegrationsCommand,
  ModifyIntegrationCommand,
  CreateRedshiftIdcApplicationCommand,
  DeleteRedshiftIdcApplicationCommand,
  DescribeRedshiftIdcApplicationsCommand,
  ModifyRedshiftIdcApplicationCommand,
  GetIdentityCenterAuthTokenCommand,
  AddPartnerCommand,
  DeletePartnerCommand,
  DescribePartnersCommand,
  UpdatePartnerStatusCommand,
  PutResourcePolicyCommand,
  GetResourcePolicyCommand,
  DeleteResourcePolicyCommand,
  ListRecommendationsCommand,
  FailoverPrimaryComputeCommand,
  ModifyLakehouseConfigurationCommand,
} from "@aws-sdk/client-redshift";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const redshift = () =>
  new RedshiftClient({
    endpoint,
    region,
    credentials,
    requestHandler,
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
  expect(created.Cluster?.ClusterStatus).toBe("creating");
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

  const resizeInProgress = await client.send(
    new DescribeResizeCommand({ ClusterIdentifier: clusterId }),
  );
  expect(resizeInProgress.Status).toBe("IN_PROGRESS");
  expect(resizeInProgress.TargetNodeType).toBe("dc2.large");
  expect(resizeInProgress.TargetNumberOfNodes).toBe(2);

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

  const cancelled = await client.send(
    new CancelResizeCommand({ ClusterIdentifier: clusterId }),
  );
  expect(cancelled.Status).toBe("CANCELLED");

  const resizeCancelled = await client.send(
    new DescribeResizeCommand({ ClusterIdentifier: clusterId }),
  );
  expect(resizeCancelled.Status).toBe("CANCELLED");

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
  expect(created.Snapshot?.Status).toBe("creating");

  const described = await client.send(
    new DescribeClusterSnapshotsCommand({
      ClusterIdentifier: clusterId,
    }),
  );
  const snapshots = described.Snapshots ?? [];
  expect(snapshots.length).toBe(1);
  expect(snapshots[0]?.SnapshotIdentifier).toBe(snapshotId);
  expect(snapshots[0]?.Status).toBe("available");

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

test("Redshift RestoreTableFromClusterSnapshot missing snapshot error", async () => {
  const client = redshift();
  const clusterId = "bunsai-restore-table-cluster";

  await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "dc2.large",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
    }),
  );

  await expect(
    client.send(
      new RestoreTableFromClusterSnapshotCommand({
        ClusterIdentifier: clusterId,
        SnapshotIdentifier: "nonexistent-snapshot",
        SourceDatabaseName: "dev",
        SourceTableName: "mytable",
        NewTableName: "restored_mytable",
      }),
    ),
  ).rejects.toMatchObject({ name: "ClusterSnapshotNotFoundFault" });

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
  const profContent = JSON.stringify({
    type: "saml",
    idp_url: "https://idp.example.com",
  });

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

  const newContent = JSON.stringify({
    type: "saml",
    idp_url: "https://idp2.example.com",
  });
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
      CustomDomainName: domainName,
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

test("Redshift datashare lifecycle", async () => {
  const client = redshift();
  const clusterId = "bunsai-e2e-ds-cluster";
  const dataShareArn =
    "arn:aws:redshift:us-east-1:123456789012:datashare:bunsai-ds/bunsai-share";
  const consumerAccount = "987654321098";

  await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "ra3.xlplus",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
      DBName: "bunsaidb",
    }),
  );

  const authorized = await client.send(
    new AuthorizeDataShareCommand({
      DataShareArn: dataShareArn,
      ConsumerIdentifier: consumerAccount,
      AllowWrites: false,
    }),
  );
  expect(authorized.DataShareArn).toBe(dataShareArn);
  expect((authorized.DataShareAssociations ?? [])[0]?.Status).toBe(
    "AUTHORIZED",
  );

  const described = await client.send(
    new DescribeDataSharesCommand({ DataShareArn: dataShareArn }),
  );
  expect((described.DataShares ?? []).length).toBe(1);
  expect(described.DataShares?.[0]?.DataShareArn).toBe(dataShareArn);

  const forProducer = await client.send(
    new DescribeDataSharesForProducerCommand({
      ProducerArn: dataShareArn,
    }),
  );
  expect((forProducer.DataShares ?? []).length).toBe(1);

  const associated = await client.send(
    new AssociateDataShareConsumerCommand({
      DataShareArn: dataShareArn,
      ConsumerArn: consumerAccount,
    }),
  );
  expect(
    (associated.DataShareAssociations ?? []).find(
      (a) => a.ConsumerIdentifier === consumerAccount,
    )?.Status,
  ).toBe("ACTIVE");

  const forConsumer = await client.send(
    new DescribeDataSharesForConsumerCommand({
      ConsumerArn: consumerAccount,
    }),
  );
  expect((forConsumer.DataShares ?? []).length).toBeGreaterThanOrEqual(1);

  const dissociated = await client.send(
    new DisassociateDataShareConsumerCommand({
      DataShareArn: dataShareArn,
      ConsumerArn: consumerAccount,
    }),
  );
  expect(
    (dissociated.DataShareAssociations ?? []).find(
      (a) => a.ConsumerIdentifier === consumerAccount,
    )?.Status,
  ).toBe("DEAUTHORIZED");

  const deauthorized = await client.send(
    new DeauthorizeDataShareCommand({
      DataShareArn: dataShareArn,
      ConsumerIdentifier: consumerAccount,
    }),
  );
  expect(
    (deauthorized.DataShareAssociations ?? []).find(
      (a) => a.ConsumerIdentifier === consumerAccount,
    )?.Status,
  ).toBe("DEAUTHORIZED");

  const rejected = await client.send(
    new RejectDataShareCommand({ DataShareArn: dataShareArn }),
  );
  expect(
    (rejected.DataShareAssociations ?? []).every(
      (a) => a.Status === "REJECTED",
    ),
  ).toBe(true);

  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
});

test("Redshift endpoint-access lifecycle", async () => {
  const client = redshift();
  const clusterId = "bunsai-e2e-ep-cluster";
  const granteeAccount = "987654321098";
  const endpointName = "bunsai-e2e-endpoint";

  await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "ra3.xlplus",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
      DBName: "bunsaidb",
    }),
  );

  const authResult = await client.send(
    new AuthorizeEndpointAccessCommand({
      ClusterIdentifier: clusterId,
      Account: granteeAccount,
      VpcIds: ["vpc-11111111"],
    }),
  );
  expect(authResult.ClusterIdentifier).toBe(clusterId);
  expect(authResult.Grantee).toBe(granteeAccount);
  expect(authResult.Status).toBe("Authorized");
  expect(authResult.AllowedAllVPCs).toBe(false);
  expect((authResult.AllowedVPCs ?? []).length).toBe(1);

  const authList = await client.send(
    new DescribeEndpointAuthorizationCommand({
      ClusterIdentifier: clusterId,
    }),
  );
  expect((authList.EndpointAuthorizationList ?? []).length).toBe(1);

  const created = await client.send(
    new CreateEndpointAccessCommand({
      ClusterIdentifier: clusterId,
      EndpointName: endpointName,
      SubnetGroupName: "default",
      VpcSecurityGroupIds: ["sg-aabbccdd"],
    }),
  );
  expect(created.EndpointName).toBe(endpointName);
  expect(created.ClusterIdentifier).toBe(clusterId);
  expect(created.EndpointStatus).toBe("active");
  expect(created.Port).toBe(5439);

  const listed = await client.send(
    new DescribeEndpointAccessCommand({
      ClusterIdentifier: clusterId,
    }),
  );
  expect((listed.EndpointAccessList ?? []).length).toBe(1);

  const modified = await client.send(
    new ModifyEndpointAccessCommand({
      EndpointName: endpointName,
      VpcSecurityGroupIds: ["sg-11223344", "sg-55667788"],
    }),
  );
  expect((modified.VpcSecurityGroups ?? []).length).toBe(2);

  const deleted = await client.send(
    new DeleteEndpointAccessCommand({ EndpointName: endpointName }),
  );
  expect(deleted.EndpointName).toBe(endpointName);

  const revoked = await client.send(
    new RevokeEndpointAccessCommand({
      ClusterIdentifier: clusterId,
      Account: granteeAccount,
    }),
  );
  expect(revoked.Status).toBe("Revoking");

  const registerResult = await client.send(
    new RegisterNamespaceCommand({
      NamespaceIdentifier: {
        ProvisionedIdentifier: { ClusterIdentifier: clusterId },
      },
      ConsumerIdentifiers: [granteeAccount],
    }),
  );
  expect(registerResult.Status).toBe("Registering");

  const deregisterResult = await client.send(
    new DeregisterNamespaceCommand({
      NamespaceIdentifier: {
        ProvisionedIdentifier: { ClusterIdentifier: clusterId },
      },
      ConsumerIdentifiers: [granteeAccount],
    }),
  );
  expect(deregisterResult.Status).toBe("Deregistering");

  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
});

test("Redshift HSM client certificate lifecycle", async () => {
  const client = redshift();
  const certId = "bunsai-e2e-hsm-cert";

  const created = await client.send(
    new CreateHsmClientCertificateCommand({
      HsmClientCertificateIdentifier: certId,
    }),
  );
  expect(created.HsmClientCertificate?.HsmClientCertificateIdentifier).toBe(
    certId,
  );
  expect(created.HsmClientCertificate?.HsmClientCertificatePublicKey).toContain(
    "PUBLIC KEY",
  );

  const listed = await client.send(
    new DescribeHsmClientCertificatesCommand({
      HsmClientCertificateIdentifier: certId,
    }),
  );
  expect((listed.HsmClientCertificates ?? []).length).toBe(1);
  expect(
    listed.HsmClientCertificates?.[0]?.HsmClientCertificateIdentifier,
  ).toBe(certId);

  await client.send(
    new DeleteHsmClientCertificateCommand({
      HsmClientCertificateIdentifier: certId,
    }),
  );

  const afterDelete = await client.send(
    new DescribeHsmClientCertificatesCommand({}),
  );
  const stillFound = (afterDelete.HsmClientCertificates ?? []).find(
    (c) => c.HsmClientCertificateIdentifier === certId,
  );
  expect(stillFound).toBeUndefined();
});

test("Redshift HSM configuration lifecycle", async () => {
  const client = redshift();
  const configId = "bunsai-e2e-hsm-config";

  const created = await client.send(
    new CreateHsmConfigurationCommand({
      HsmConfigurationIdentifier: configId,
      Description: "Test HSM configuration",
      HsmIpAddress: "10.0.0.1",
      HsmPartitionName: "bunsai-partition",
      HsmPartitionPassword: "TestPassword123",
      HsmServerPublicCertificate: "server.pem",
    }),
  );
  expect(created.HsmConfiguration?.HsmConfigurationIdentifier).toBe(configId);
  expect(created.HsmConfiguration?.HsmIpAddress).toBe("10.0.0.1");

  const listed = await client.send(
    new DescribeHsmConfigurationsCommand({
      HsmConfigurationIdentifier: configId,
    }),
  );
  expect((listed.HsmConfigurations ?? []).length).toBe(1);
  expect(listed.HsmConfigurations?.[0]?.Description).toBe(
    "Test HSM configuration",
  );

  await client.send(
    new DeleteHsmConfigurationCommand({
      HsmConfigurationIdentifier: configId,
    }),
  );
});

test("Redshift reserved node lifecycle", async () => {
  const client = redshift();

  const offerings = await client.send(
    new DescribeReservedNodeOfferingsCommand({}),
  );
  expect((offerings.ReservedNodeOfferings ?? []).length).toBeGreaterThan(0);
  const offering = offerings.ReservedNodeOfferings?.[0];
  expect(offering?.ReservedNodeOfferingId).toBeDefined();
  expect(offering?.NodeType).toBeDefined();
  expect(offering?.Duration).toBeGreaterThan(0);

  const purchased = await client.send(
    new PurchaseReservedNodeOfferingCommand({
      ReservedNodeOfferingId: offering?.ReservedNodeOfferingId ?? "",
      NodeCount: 1,
    }),
  );
  expect(purchased.ReservedNode?.ReservedNodeId).toBeDefined();
  expect(purchased.ReservedNode?.State).toBe("active");
  expect(purchased.ReservedNode?.NodeType).toBe(offering?.NodeType);

  const reservedNodeId = purchased.ReservedNode?.ReservedNodeId ?? "";

  const described = await client.send(
    new DescribeReservedNodesCommand({ ReservedNodeId: reservedNodeId }),
  );
  expect((described.ReservedNodes ?? []).length).toBe(1);
  expect(described.ReservedNodes?.[0]?.State).toBe("active");

  const targetOffering = offerings.ReservedNodeOfferings?.find(
    (o) => o.ReservedNodeOfferingId !== offering?.ReservedNodeOfferingId,
  );
  if (targetOffering?.ReservedNodeOfferingId !== undefined) {
    const exchangeOfferings = await client.send(
      new GetReservedNodeExchangeOfferingsCommand({
        ReservedNodeId: reservedNodeId,
      }),
    );
    expect(Array.isArray(exchangeOfferings.ReservedNodeOfferings)).toBe(true);

    const exchanged = await client.send(
      new AcceptReservedNodeExchangeCommand({
        ReservedNodeId: reservedNodeId,
        TargetReservedNodeOfferingId: targetOffering.ReservedNodeOfferingId,
      }),
    );
    expect(exchanged.ExchangedReservedNode?.State).toBe("active");
    expect(exchanged.ExchangedReservedNode?.ReservedNodeOfferingId).toBe(
      targetOffering.ReservedNodeOfferingId,
    );

    const exchangeStatus = await client.send(
      new DescribeReservedNodeExchangeStatusCommand({
        ReservedNodeId: reservedNodeId,
      }),
    );
    expect(
      (exchangeStatus.ReservedNodeExchangeStatusDetails ?? []).length,
    ).toBe(1);
    expect(
      String(exchangeStatus.ReservedNodeExchangeStatusDetails?.[0]?.Status),
    ).toBe("succeeded");
  }
});

test("Redshift integration and IDC application lifecycle", async () => {
  const client = redshift();

  const sourceArn = "arn:aws:rds:us-east-1:123456789012:db:bunsai-source-db";
  const targetArn =
    "arn:aws:redshift:us-east-1:123456789012:namespace:bunsai-ns";

  const created = await client.send(
    new CreateIntegrationCommand({
      SourceArn: sourceArn,
      TargetArn: targetArn,
      IntegrationName: "bunsai-e2e-integration",
      Description: "e2e test integration",
    }),
  );
  expect(created.IntegrationArn).toBeDefined();
  expect(created.IntegrationName).toBe("bunsai-e2e-integration");
  expect(created.SourceArn).toBe(sourceArn);
  expect(created.TargetArn).toBe(targetArn);
  expect(created.Status).toBe("active");
  const integrationArn = created.IntegrationArn!;

  const described = await client.send(
    new DescribeIntegrationsCommand({ IntegrationArn: integrationArn }),
  );
  expect((described.Integrations ?? []).length).toBe(1);
  expect(described.Integrations?.[0]?.Description).toBe("e2e test integration");

  const inbound = await client.send(
    new DescribeInboundIntegrationsCommand({ IntegrationArn: integrationArn }),
  );
  expect((inbound.InboundIntegrations ?? []).length).toBe(1);
  expect(inbound.InboundIntegrations?.[0]?.Status).toBe("active");

  const modified = await client.send(
    new ModifyIntegrationCommand({
      IntegrationArn: integrationArn,
      Description: "updated description",
      IntegrationName: "bunsai-e2e-integration-v2",
    }),
  );
  expect(modified.Description).toBe("updated description");
  expect(modified.IntegrationName).toBe("bunsai-e2e-integration-v2");

  const deleted = await client.send(
    new DeleteIntegrationCommand({ IntegrationArn: integrationArn }),
  );
  expect(deleted.IntegrationArn).toBe(integrationArn);

  const idcApp = await client.send(
    new CreateRedshiftIdcApplicationCommand({
      IdcInstanceArn: "arn:aws:sso:::instance/ssoins-1234567890abcdef0",
      RedshiftIdcApplicationName: "bunsai-e2e-idc-app",
      IamRoleArn: "arn:aws:iam::123456789012:role/RedshiftIdcRole",
      IdentityNamespace: "bunsai-ns",
      IdcDisplayName: "Bunsai E2E IDC App",
    }),
  );
  expect(
    idcApp.RedshiftIdcApplication?.RedshiftIdcApplicationArn,
  ).toBeDefined();
  expect(idcApp.RedshiftIdcApplication?.RedshiftIdcApplicationName).toBe(
    "bunsai-e2e-idc-app",
  );
  expect(idcApp.RedshiftIdcApplication?.IdcOnboardStatus).toBe("ENABLED");
  const idcArn = idcApp.RedshiftIdcApplication?.RedshiftIdcApplicationArn!;

  const describedIdcApps = await client.send(
    new DescribeRedshiftIdcApplicationsCommand({
      RedshiftIdcApplicationArn: idcArn,
    }),
  );
  expect((describedIdcApps.RedshiftIdcApplications ?? []).length).toBe(1);
  expect(describedIdcApps.RedshiftIdcApplications?.[0]?.IdentityNamespace).toBe(
    "bunsai-ns",
  );

  const modifiedIdcApp = await client.send(
    new ModifyRedshiftIdcApplicationCommand({
      RedshiftIdcApplicationArn: idcArn,
      IdcDisplayName: "Updated IDC App",
      IdentityNamespace: "bunsai-ns-v2",
    }),
  );
  expect(modifiedIdcApp.RedshiftIdcApplication?.IdcDisplayName).toBe(
    "Updated IDC App",
  );
  expect(modifiedIdcApp.RedshiftIdcApplication?.IdentityNamespace).toBe(
    "bunsai-ns-v2",
  );

  const token = await client.send(
    new GetIdentityCenterAuthTokenCommand({
      ClusterIds: ["bunsai-e2e-cluster"],
    }),
  );
  expect(token.Token).toBeDefined();
  expect(token.ExpirationTime).toBeDefined();

  await client.send(
    new DeleteRedshiftIdcApplicationCommand({
      RedshiftIdcApplicationArn: idcArn,
    }),
  );

  const afterDelete = await client.send(
    new DescribeRedshiftIdcApplicationsCommand({}),
  );
  const remaining = (afterDelete.RedshiftIdcApplications ?? []).filter(
    (a) => a.RedshiftIdcApplicationArn === idcArn,
  );
  expect(remaining.length).toBe(0);
});

test("Redshift partner + resource-policy lifecycle", async () => {
  const client = redshift();
  const clusterId = "bunsai-partner-cluster";

  await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "ra3.xlplus",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
      DBName: "partnertest",
    }),
  );

  const added = await client.send(
    new AddPartnerCommand({
      AccountId: "123456789012",
      ClusterIdentifier: clusterId,
      DatabaseName: "partnerdb",
      PartnerName: "mypartner",
    }),
  );
  expect(added.DatabaseName).toBe("partnerdb");
  expect(added.PartnerName).toBe("mypartner");

  const described = await client.send(
    new DescribePartnersCommand({
      AccountId: "123456789012",
      ClusterIdentifier: clusterId,
      DatabaseName: "partnerdb",
    }),
  );
  expect(described.PartnerIntegrationInfoList?.length).toBeGreaterThanOrEqual(
    1,
  );
  const found = (described.PartnerIntegrationInfoList ?? []).find(
    (p) => p.PartnerName === "mypartner",
  );
  expect(found?.Status).toBe("Active");

  const updated = await client.send(
    new UpdatePartnerStatusCommand({
      AccountId: "123456789012",
      ClusterIdentifier: clusterId,
      DatabaseName: "partnerdb",
      PartnerName: "mypartner",
      Status: "ConnectionFailure",
      StatusMessage: "test failure",
    }),
  );
  expect(updated.PartnerName).toBe("mypartner");

  await client.send(
    new DeletePartnerCommand({
      AccountId: "123456789012",
      ClusterIdentifier: clusterId,
      DatabaseName: "partnerdb",
      PartnerName: "mypartner",
    }),
  );

  const afterDelete = await client.send(
    new DescribePartnersCommand({
      AccountId: "123456789012",
      ClusterIdentifier: clusterId,
      DatabaseName: "partnerdb",
    }),
  );
  const remaining = (afterDelete.PartnerIntegrationInfoList ?? []).filter(
    (p) => p.PartnerName === "mypartner",
  );
  expect(remaining.length).toBe(0);

  const clusterArn = `arn:aws:redshift:us-east-1:123456789012:cluster:${clusterId}`;
  const policy = JSON.stringify({ Version: "2012-10-17", Statement: [] });

  const put = await client.send(
    new PutResourcePolicyCommand({
      ResourceArn: clusterArn,
      Policy: policy,
    }),
  );
  expect(put.ResourcePolicy?.ResourceArn).toBe(clusterArn);
  expect(put.ResourcePolicy?.Policy).toBe(policy);

  const got = await client.send(
    new GetResourcePolicyCommand({ ResourceArn: clusterArn }),
  );
  expect(got.ResourcePolicy?.Policy).toBe(policy);

  await client.send(
    new DeleteResourcePolicyCommand({ ResourceArn: clusterArn }),
  );

  const recs = await client.send(
    new ListRecommendationsCommand({ ClusterIdentifier: clusterId }),
  );
  expect(Array.isArray(recs.Recommendations)).toBe(true);

  const failover = await client.send(
    new FailoverPrimaryComputeCommand({ ClusterIdentifier: clusterId }),
  );
  expect(failover.Cluster?.ClusterIdentifier).toBe(clusterId);

  const lakehouse = await client.send(
    new ModifyLakehouseConfigurationCommand({
      ClusterIdentifier: clusterId,
      LakehouseRegistration: "Register",
      CatalogName: "my-catalog",
    }),
  );
  expect(lakehouse.ClusterIdentifier).toBe(clusterId);
  expect(lakehouse.LakehouseRegistrationStatus).toBe("Registered");

  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
});

test("Redshift tag round-trip and delete cleanup", async () => {
  const client = redshift();
  const clusterId = "bunsai-tag-cluster";

  const created = await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "dc2.large",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "bunsai" },
      ],
    }),
  );
  expect(created.Cluster?.ClusterIdentifier).toBe(clusterId);

  const clusterArn = `arn:aws:redshift:${region}:000000000000:cluster:${clusterId}`;
  const described = await client.send(
    new DescribeTagsCommand({ ResourceName: clusterArn }),
  );
  const tagKeys = (described.TaggedResources ?? []).map((r) => r.Tag?.Key);
  expect(tagKeys).toContain("env");
  expect(tagKeys).toContain("team");

  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );

  const afterDelete = await client.send(
    new DescribeTagsCommand({ ResourceName: clusterArn }),
  );
  expect((afterDelete.TaggedResources ?? []).length).toBe(0);
});

test("Redshift snapshot pagination", async () => {
  const client = redshift();
  const clusterId = "bunsai-page-cluster";

  await client.send(
    new CreateClusterCommand({
      ClusterIdentifier: clusterId,
      NodeType: "dc2.large",
      MasterUsername: "admin",
      MasterUserPassword: "BunsaiTestPw1",
      ClusterType: "single-node",
    }),
  );

  for (let i = 0; i < 5; i++) {
    await client.send(
      new CreateClusterSnapshotCommand({
        SnapshotIdentifier: `bunsai-page-snap-${i}`,
        ClusterIdentifier: clusterId,
      }),
    );
  }

  const page1 = await client.send(
    new DescribeClusterSnapshotsCommand({
      ClusterIdentifier: clusterId,
      MaxRecords: 2,
    }),
  );
  expect((page1.Snapshots ?? []).length).toBe(2);
  expect(page1.Marker).toBeDefined();

  const page2 = await client.send(
    new DescribeClusterSnapshotsCommand({
      ClusterIdentifier: clusterId,
      MaxRecords: 2,
      Marker: page1.Marker,
    }),
  );
  expect((page2.Snapshots ?? []).length).toBe(2);

  const page3 = await client.send(
    new DescribeClusterSnapshotsCommand({
      ClusterIdentifier: clusterId,
      MaxRecords: 2,
      Marker: page2.Marker,
    }),
  );
  expect((page3.Snapshots ?? []).length).toBe(1);
  expect(page3.Marker).toBeUndefined();

  await client.send(
    new DeleteClusterCommand({
      ClusterIdentifier: clusterId,
      SkipFinalClusterSnapshot: true,
    }),
  );
});

test("Redshift parameter group and security group pagination", async () => {
  const client = redshift();

  for (let i = 0; i < 4; i++) {
    await client.send(
      new CreateClusterParameterGroupCommand({
        ParameterGroupName: `bunsai-pg-${i}`,
        ParameterGroupFamily: "redshift-1.0",
        Description: `group ${i}`,
      }),
    );
  }

  const pgPage1 = await client.send(
    new DescribeClusterParameterGroupsCommand({ MaxRecords: 20 }),
  );
  expect((pgPage1.ParameterGroups ?? []).length).toBeGreaterThanOrEqual(4);

  for (let i = 0; i < 4; i++) {
    await client.send(
      new DeleteClusterParameterGroupCommand({
        ParameterGroupName: `bunsai-pg-${i}`,
      }),
    );
  }

  for (let i = 0; i < 4; i++) {
    await client.send(
      new CreateClusterSecurityGroupCommand({
        ClusterSecurityGroupName: `bunsai-sg-${i}`,
        Description: `sg ${i}`,
      }),
    );
  }

  const sgPage1 = await client.send(
    new DescribeClusterSecurityGroupsCommand({ MaxRecords: 20 }),
  );
  expect((sgPage1.ClusterSecurityGroups ?? []).length).toBeGreaterThanOrEqual(
    4,
  );

  for (let i = 0; i < 4; i++) {
    await client.send(
      new DeleteClusterSecurityGroupCommand({
        ClusterSecurityGroupName: `bunsai-sg-${i}`,
      }),
    );
  }
});
