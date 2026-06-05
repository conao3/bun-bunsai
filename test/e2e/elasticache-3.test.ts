import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddTagsToResourceCommand,
  AuthorizeCacheSecurityGroupIngressCommand,
  BatchApplyUpdateActionCommand,
  BatchStopUpdateActionCommand,
  CompleteMigrationCommand,
  CopyServerlessCacheSnapshotCommand,
  CopySnapshotCommand,
  CreateCacheSecurityGroupCommand,
  CreateGlobalReplicationGroupCommand,
  CreateReplicationGroupCommand,
  CreateServerlessCacheCommand,
  CreateServerlessCacheSnapshotCommand,
  CreateSnapshotCommand,
  CreateUserCommand,
  CreateUserGroupCommand,
  DecreaseNodeGroupsInGlobalReplicationGroupCommand,
  DecreaseReplicaCountCommand,
  DeleteCacheSecurityGroupCommand,
  DeleteGlobalReplicationGroupCommand,
  DeleteReplicationGroupCommand,
  DeleteServerlessCacheCommand,
  DeleteServerlessCacheSnapshotCommand,
  DeleteSnapshotCommand,
  DeleteUserCommand,
  DeleteUserGroupCommand,
  DescribeCacheEngineVersionsCommand,
  DescribeCacheParametersCommand,
  DescribeCacheSecurityGroupsCommand,
  DescribeEngineDefaultParametersCommand,
  DescribeEventsCommand,
  DescribeGlobalReplicationGroupsCommand,
  DescribeReservedCacheNodesCommand,
  DescribeReservedCacheNodesOfferingsCommand,
  DescribeServerlessCacheSnapshotsCommand,
  DescribeServerlessCachesCommand,
  DescribeServiceUpdatesCommand,
  DescribeSnapshotsCommand,
  DescribeUpdateActionsCommand,
  DescribeUserGroupsCommand,
  DescribeUsersCommand,
  DisassociateGlobalReplicationGroupCommand,
  ElastiCacheClient,
  ExportServerlessCacheSnapshotCommand,
  FailoverGlobalReplicationGroupCommand,
  IncreaseNodeGroupsInGlobalReplicationGroupCommand,
  IncreaseReplicaCountCommand,
  ListAllowedNodeTypeModificationsCommand,
  ListTagsForResourceCommand,
  ModifyCacheClusterCommand,
  ModifyCacheParameterGroupCommand,
  ModifyCacheSubnetGroupCommand,
  ModifyGlobalReplicationGroupCommand,
  ModifyReplicationGroupCommand,
  ModifyReplicationGroupShardConfigurationCommand,
  ModifyServerlessCacheCommand,
  ModifyUserCommand,
  ModifyUserGroupCommand,
  PurchaseReservedCacheNodesOfferingCommand,
  RebalanceSlotsInGlobalReplicationGroupCommand,
  RebootCacheClusterCommand,
  RemoveTagsFromResourceCommand,
  ResetCacheParameterGroupCommand,
  RevokeCacheSecurityGroupIngressCommand,
  StartMigrationCommand,
  TestFailoverCommand,
  TestMigrationCommand,
  CreateCacheClusterCommand,
  CreateCacheParameterGroupCommand,
  CreateCacheSubnetGroupCommand,
} from "@aws-sdk/client-elasticache";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const elasticache = () =>
  new ElastiCacheClient({ endpoint, region, credentials, requestHandler });

test("ElastiCache snapshot round-trip", async () => {
  const client = elasticache();
  const rgId = "bunsai-e2e-rg-snap";
  const snapName = "bunsai-e2e-snap";

  await client.send(
    new CreateReplicationGroupCommand({
      ReplicationGroupId: rgId,
      ReplicationGroupDescription: "e2e snap test",
      Engine: "redis",
    }),
  );

  const created = await client.send(
    new CreateSnapshotCommand({
      ReplicationGroupId: rgId,
      SnapshotName: snapName,
    }),
  );
  expect(created.Snapshot?.SnapshotName).toBe(snapName);
  expect(created.Snapshot?.SnapshotStatus).toBe("available");
  expect(created.Snapshot?.ReplicationGroupId).toBe(rgId);

  const described = await client.send(
    new DescribeSnapshotsCommand({ SnapshotName: snapName }),
  );
  expect(described.Snapshots?.length).toBe(1);
  expect(described.Snapshots?.[0]?.SnapshotName).toBe(snapName);

  const snapCopyName = "bunsai-e2e-snap-copy";
  const copied = await client.send(
    new CopySnapshotCommand({
      SourceSnapshotName: snapName,
      TargetSnapshotName: snapCopyName,
    }),
  );
  expect(copied.Snapshot?.SnapshotName).toBe(snapCopyName);

  const deleted = await client.send(
    new DeleteSnapshotCommand({ SnapshotName: snapName }),
  );
  expect(deleted.Snapshot?.SnapshotStatus).toBe("deleting");

  await expect(
    client.send(new DescribeSnapshotsCommand({ SnapshotName: snapName })),
  ).rejects.toThrow();
});

test("ElastiCache serverless cache round-trip", async () => {
  const client = elasticache();
  const name = "bunsai-e2e-slc";

  const created = await client.send(
    new CreateServerlessCacheCommand({
      ServerlessCacheName: name,
      Engine: "redis",
      Description: "e2e serverless cache",
    }),
  );
  expect(created.ServerlessCache?.ServerlessCacheName).toBe(name);
  expect(created.ServerlessCache?.Status).toBe("available");
  expect(created.ServerlessCache?.Engine).toBe("redis");

  const described = await client.send(
    new DescribeServerlessCachesCommand({ ServerlessCacheName: name }),
  );
  expect(described.ServerlessCaches?.length).toBe(1);
  expect(described.ServerlessCaches?.[0]?.ServerlessCacheName).toBe(name);

  const snapName = "bunsai-e2e-slc-snap";
  const snap = await client.send(
    new CreateServerlessCacheSnapshotCommand({
      ServerlessCacheSnapshotName: snapName,
      ServerlessCacheName: name,
    }),
  );
  expect(snap.ServerlessCacheSnapshot?.ServerlessCacheSnapshotName).toBe(
    snapName,
  );
  expect(snap.ServerlessCacheSnapshot?.Status).toBe("available");

  const snapDesc = await client.send(
    new DescribeServerlessCacheSnapshotsCommand({
      ServerlessCacheSnapshotName: snapName,
    }),
  );
  expect(snapDesc.ServerlessCacheSnapshots?.length).toBe(1);

  const copiedSnapName = "bunsai-e2e-slc-snap-copy";
  const copied = await client.send(
    new CopyServerlessCacheSnapshotCommand({
      SourceServerlessCacheSnapshotName: snapName,
      TargetServerlessCacheSnapshotName: copiedSnapName,
    }),
  );
  expect(copied.ServerlessCacheSnapshot?.ServerlessCacheSnapshotName).toBe(
    copiedSnapName,
  );

  const exported = await client.send(
    new ExportServerlessCacheSnapshotCommand({
      ServerlessCacheSnapshotName: snapName,
      S3BucketName: "bunsai-test-bucket",
    }),
  );
  expect(exported.ServerlessCacheSnapshot?.ServerlessCacheSnapshotName).toBe(
    snapName,
  );

  const deletedSnap = await client.send(
    new DeleteServerlessCacheSnapshotCommand({
      ServerlessCacheSnapshotName: snapName,
    }),
  );
  expect(deletedSnap.ServerlessCacheSnapshot?.Status).toBe("deleting");

  const modified = await client.send(
    new ModifyServerlessCacheCommand({
      ServerlessCacheName: name,
      Description: "modified description",
    }),
  );
  expect(modified.ServerlessCache?.Description).toBe("modified description");

  const deletedCache = await client.send(
    new DeleteServerlessCacheCommand({ ServerlessCacheName: name }),
  );
  expect(deletedCache.ServerlessCache?.Status).toBe("deleting");

  await expect(
    client.send(
      new DescribeServerlessCachesCommand({ ServerlessCacheName: name }),
    ),
  ).rejects.toThrow();
});

test("ElastiCache user and user group round-trip", async () => {
  const client = elasticache();
  const userId = "bunsai-e2e-user";
  const groupId = "bunsai-e2e-ug";

  const createdUser = await client.send(
    new CreateUserCommand({
      UserId: userId,
      UserName: "bunsai-test-user",
      Engine: "redis",
      AccessString: "on ~* +@all",
      NoPasswordRequired: true,
    }),
  );
  expect(createdUser.UserId).toBe(userId);
  expect(createdUser.Status).toBe("active");
  expect(createdUser.Engine).toBe("redis");

  const describedUsers = await client.send(
    new DescribeUsersCommand({ UserId: userId }),
  );
  expect(describedUsers.Users?.length).toBe(1);
  expect(describedUsers.Users?.[0]?.UserId).toBe(userId);

  const modifiedUser = await client.send(
    new ModifyUserCommand({
      UserId: userId,
      AccessString: "on ~* +@read",
    }),
  );
  expect(modifiedUser.UserId).toBe(userId);
  expect(modifiedUser.AccessString).toBe("on ~* +@read");

  const createdGroup = await client.send(
    new CreateUserGroupCommand({
      UserGroupId: groupId,
      Engine: "redis",
      UserIds: [userId],
    }),
  );
  expect(createdGroup.UserGroupId).toBe(groupId);
  expect(createdGroup.Status).toBe("active");
  expect(createdGroup.UserIds).toContain(userId);

  const describedGroups = await client.send(
    new DescribeUserGroupsCommand({ UserGroupId: groupId }),
  );
  expect(describedGroups.UserGroups?.length).toBe(1);
  expect(describedGroups.UserGroups?.[0]?.UserGroupId).toBe(groupId);

  const modifiedGroup = await client.send(
    new ModifyUserGroupCommand({
      UserGroupId: groupId,
      UserIdsToRemove: [userId],
    }),
  );
  expect(modifiedGroup.UserIds).not.toContain(userId);

  const deletedGroup = await client.send(
    new DeleteUserGroupCommand({ UserGroupId: groupId }),
  );
  expect(deletedGroup.Status).toBe("deleting");

  const deletedUser = await client.send(
    new DeleteUserCommand({ UserId: userId }),
  );
  expect(deletedUser.Status).toBe("deleting");
});

test("ElastiCache cache security group round-trip", async () => {
  const client = elasticache();
  const name = "bunsai-e2e-csg";

  const created = await client.send(
    new CreateCacheSecurityGroupCommand({
      CacheSecurityGroupName: name,
      Description: "e2e security group",
    }),
  );
  expect(created.CacheSecurityGroup?.CacheSecurityGroupName).toBe(name);
  expect(created.CacheSecurityGroup?.Description).toBe("e2e security group");
  expect(created.CacheSecurityGroup?.EC2SecurityGroups).toHaveLength(0);

  const described = await client.send(
    new DescribeCacheSecurityGroupsCommand({ CacheSecurityGroupName: name }),
  );
  expect(described.CacheSecurityGroups?.length).toBe(1);
  expect(described.CacheSecurityGroups?.[0]?.CacheSecurityGroupName).toBe(name);

  const authorized = await client.send(
    new AuthorizeCacheSecurityGroupIngressCommand({
      CacheSecurityGroupName: name,
      EC2SecurityGroupName: "sg-test",
      EC2SecurityGroupOwnerId: "123456789012",
    }),
  );
  expect(authorized.CacheSecurityGroup?.EC2SecurityGroups?.length).toBe(1);
  expect(
    authorized.CacheSecurityGroup?.EC2SecurityGroups?.[0]?.EC2SecurityGroupName,
  ).toBe("sg-test");

  const revoked = await client.send(
    new RevokeCacheSecurityGroupIngressCommand({
      CacheSecurityGroupName: name,
      EC2SecurityGroupName: "sg-test",
      EC2SecurityGroupOwnerId: "123456789012",
    }),
  );
  expect(revoked.CacheSecurityGroup?.EC2SecurityGroups).toHaveLength(0);

  await client.send(
    new DeleteCacheSecurityGroupCommand({ CacheSecurityGroupName: name }),
  );

  await expect(
    client.send(
      new DescribeCacheSecurityGroupsCommand({ CacheSecurityGroupName: name }),
    ),
  ).rejects.toThrow();
});

test("ElastiCache global replication group round-trip", async () => {
  const client = elasticache();
  const rgId = "bunsai-e2e-rg-global";
  const suffix = "bunsai-global";

  await client.send(
    new CreateReplicationGroupCommand({
      ReplicationGroupId: rgId,
      ReplicationGroupDescription: "e2e global rg",
      Engine: "redis",
      CacheNodeType: "cache.r7g.large",
    }),
  );

  const created = await client.send(
    new CreateGlobalReplicationGroupCommand({
      GlobalReplicationGroupIdSuffix: suffix,
      GlobalReplicationGroupDescription: "e2e global replication group",
      PrimaryReplicationGroupId: rgId,
    }),
  );
  expect(created.GlobalReplicationGroup?.GlobalReplicationGroupId).toContain(
    suffix,
  );
  expect(created.GlobalReplicationGroup?.Status).toBe("available");
  expect(created.GlobalReplicationGroup?.Members?.length).toBe(1);

  const globalId = created.GlobalReplicationGroup!.GlobalReplicationGroupId!;

  const described = await client.send(
    new DescribeGlobalReplicationGroupsCommand({
      GlobalReplicationGroupId: globalId,
    }),
  );
  expect(described.GlobalReplicationGroups?.length).toBe(1);
  expect(described.GlobalReplicationGroups?.[0]?.GlobalReplicationGroupId).toBe(
    globalId,
  );

  const modified = await client.send(
    new ModifyGlobalReplicationGroupCommand({
      GlobalReplicationGroupId: globalId,
      ApplyImmediately: true,
      GlobalReplicationGroupDescription: "modified global rg",
    }),
  );
  expect(
    modified.GlobalReplicationGroup?.GlobalReplicationGroupDescription,
  ).toBe("modified global rg");

  const disassociated = await client.send(
    new DisassociateGlobalReplicationGroupCommand({
      GlobalReplicationGroupId: globalId,
      ReplicationGroupId: rgId,
      ReplicationGroupRegion: region,
    }),
  );
  expect(disassociated.GlobalReplicationGroup?.Members).toHaveLength(0);

  const deleted = await client.send(
    new DeleteGlobalReplicationGroupCommand({
      GlobalReplicationGroupId: globalId,
      RetainPrimaryReplicationGroup: false,
    }),
  );
  expect(deleted.GlobalReplicationGroup?.Status).toBe("deleting");
});

test("ElastiCache tag operations", async () => {
  const client = elasticache();
  const name = "bunsai-e2e-cluster-tag";

  const cluster = await client.send(
    new CreateCacheClusterCommand({
      CacheClusterId: name,
      Engine: "redis",
      NumCacheNodes: 1,
      CacheNodeType: "cache.t3.micro",
    }),
  );
  const arn = cluster.CacheCluster!.ARN!;

  const added = await client.send(
    new AddTagsToResourceCommand({
      ResourceName: arn,
      Tags: [
        { Key: "Env", Value: "test" },
        { Key: "Team", Value: "bunsai" },
      ],
    }),
  );
  expect(added.TagList?.length).toBe(2);
  expect(added.TagList?.find((t) => t.Key === "Env")?.Value).toBe("test");

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceName: arn }),
  );
  expect(listed.TagList?.length).toBe(2);

  const removed = await client.send(
    new RemoveTagsFromResourceCommand({
      ResourceName: arn,
      TagKeys: ["Env"],
    }),
  );
  expect(removed.TagList?.length).toBe(1);
  expect(removed.TagList?.find((t) => t.Key === "Team")?.Value).toBe("bunsai");
});

test("ElastiCache describe engine versions and static catalog ops", async () => {
  const client = elasticache();

  const versions = await client.send(
    new DescribeCacheEngineVersionsCommand({}),
  );
  expect(versions.CacheEngineVersions?.length).toBeGreaterThan(0);
  expect(versions.CacheEngineVersions?.some((v) => v.Engine === "redis")).toBe(
    true,
  );

  const events = await client.send(new DescribeEventsCommand({}));
  expect(events.Events).toBeDefined();

  const serviceUpdates = await client.send(
    new DescribeServiceUpdatesCommand({}),
  );
  expect(serviceUpdates.ServiceUpdates).toBeDefined();

  const updateActions = await client.send(new DescribeUpdateActionsCommand({}));
  expect(updateActions.UpdateActions).toBeDefined();

  const nodeTypeModifications = await client.send(
    new ListAllowedNodeTypeModificationsCommand({
      ReplicationGroupId: undefined,
    }),
  );
  expect(nodeTypeModifications.ScaleUpModifications?.length).toBeGreaterThan(0);

  const offerings = await client.send(
    new DescribeReservedCacheNodesOfferingsCommand({}),
  );
  expect(offerings.ReservedCacheNodesOfferings?.length).toBeGreaterThan(0);

  const reservedNodes = await client.send(
    new DescribeReservedCacheNodesCommand({}),
  );
  expect(reservedNodes.ReservedCacheNodes).toBeDefined();

  const batchApply = await client.send(
    new BatchApplyUpdateActionCommand({ ServiceUpdateName: "test-update" }),
  );
  expect(batchApply.ProcessedUpdateActions).toBeDefined();
  expect(batchApply.UnprocessedUpdateActions).toBeDefined();

  const batchStop = await client.send(
    new BatchStopUpdateActionCommand({ ServiceUpdateName: "test-update" }),
  );
  expect(batchStop.ProcessedUpdateActions).toBeDefined();
});

test("ElastiCache parameter group operations", async () => {
  const client = elasticache();
  const name = "bunsai-e2e-pg-ops";

  await client.send(
    new CreateCacheParameterGroupCommand({
      CacheParameterGroupName: name,
      CacheParameterGroupFamily: "redis7",
      Description: "e2e ops test",
    }),
  );

  const params = await client.send(
    new DescribeCacheParametersCommand({ CacheParameterGroupName: name }),
  );
  expect(params.Parameters).toBeDefined();

  const engineDefaults = await client.send(
    new DescribeEngineDefaultParametersCommand({
      CacheParameterGroupFamily: "redis7",
    }),
  );
  expect(engineDefaults.EngineDefaults?.CacheParameterGroupFamily).toBe(
    "redis7",
  );

  const modified = await client.send(
    new ModifyCacheParameterGroupCommand({
      CacheParameterGroupName: name,
      ParameterNameValues: [
        { ParameterName: "maxmemory-policy", ParameterValue: "allkeys-lru" },
      ],
    }),
  );
  expect(modified.CacheParameterGroupName).toBe(name);

  const reset = await client.send(
    new ResetCacheParameterGroupCommand({
      CacheParameterGroupName: name,
      ResetAllParameters: true,
    }),
  );
  expect(reset.CacheParameterGroupName).toBe(name);
});

test("ElastiCache modify and reboot operations", async () => {
  const client = elasticache();
  const clusterId = "bunsai-e2e-modify-cc";
  const rgId = "bunsai-e2e-modify-rg";
  const subnetGroupName = "bunsai-e2e-sg-modify";

  await client.send(
    new CreateCacheClusterCommand({
      CacheClusterId: clusterId,
      Engine: "redis",
      NumCacheNodes: 1,
      CacheNodeType: "cache.t3.micro",
    }),
  );

  const modifiedCluster = await client.send(
    new ModifyCacheClusterCommand({
      CacheClusterId: clusterId,
      CacheNodeType: "cache.t3.small",
    }),
  );
  expect(modifiedCluster.CacheCluster?.CacheNodeType).toBe("cache.t3.small");

  const rebooted = await client.send(
    new RebootCacheClusterCommand({
      CacheClusterId: clusterId,
      CacheNodeIdsToReboot: ["0001"],
    }),
  );
  expect(rebooted.CacheCluster?.CacheClusterId).toBe(clusterId);

  await client.send(
    new CreateReplicationGroupCommand({
      ReplicationGroupId: rgId,
      ReplicationGroupDescription: "modify test",
      Engine: "redis",
    }),
  );

  const modifiedRg = await client.send(
    new ModifyReplicationGroupCommand({
      ReplicationGroupId: rgId,
      ReplicationGroupDescription: "modified description",
    }),
  );
  expect(modifiedRg.ReplicationGroup?.Description).toBe("modified description");

  const shardConfig = await client.send(
    new ModifyReplicationGroupShardConfigurationCommand({
      ReplicationGroupId: rgId,
      NodeGroupCount: 2,
      ApplyImmediately: true,
    }),
  );
  expect(shardConfig.ReplicationGroup?.ReplicationGroupId).toBe(rgId);

  const increaseReplica = await client.send(
    new IncreaseReplicaCountCommand({
      ReplicationGroupId: rgId,
      ApplyImmediately: true,
    }),
  );
  expect(increaseReplica.ReplicationGroup?.ReplicationGroupId).toBe(rgId);

  const decreaseReplica = await client.send(
    new DecreaseReplicaCountCommand({
      ReplicationGroupId: rgId,
      ApplyImmediately: true,
    }),
  );
  expect(decreaseReplica.ReplicationGroup?.ReplicationGroupId).toBe(rgId);

  const testFailover = await client.send(
    new TestFailoverCommand({
      ReplicationGroupId: rgId,
      NodeGroupId: "0001",
    }),
  );
  expect(testFailover.ReplicationGroup?.ReplicationGroupId).toBe(rgId);

  const startMigration = await client.send(
    new StartMigrationCommand({
      ReplicationGroupId: rgId,
      CustomerNodeEndpointList: [{ Address: "localhost", Port: 6379 }],
    }),
  );
  expect(startMigration.ReplicationGroup?.ReplicationGroupId).toBe(rgId);

  const completeMigration = await client.send(
    new CompleteMigrationCommand({
      ReplicationGroupId: rgId,
      Force: false,
    }),
  );
  expect(completeMigration.ReplicationGroup?.ReplicationGroupId).toBe(rgId);

  const testMigration = await client.send(
    new TestMigrationCommand({
      ReplicationGroupId: rgId,
      CustomerNodeEndpointList: [{ Address: "localhost", Port: 6379 }],
    }),
  );
  expect(testMigration.ReplicationGroup?.ReplicationGroupId).toBe(rgId);

  await client.send(
    new CreateCacheSubnetGroupCommand({
      CacheSubnetGroupName: subnetGroupName,
      CacheSubnetGroupDescription: "modify test",
      SubnetIds: ["subnet-aaaa1111"],
    }),
  );

  const modifiedSubnetGroup = await client.send(
    new ModifyCacheSubnetGroupCommand({
      CacheSubnetGroupName: subnetGroupName,
      CacheSubnetGroupDescription: "modified description",
    }),
  );
  expect(
    modifiedSubnetGroup.CacheSubnetGroup?.CacheSubnetGroupDescription,
  ).toBe("modified description");
});

test("ElastiCache reserved cache nodes purchasing", async () => {
  const client = elasticache();

  const offerings = await client.send(
    new DescribeReservedCacheNodesOfferingsCommand({}),
  );
  const offeringId =
    offerings.ReservedCacheNodesOfferings?.[0]?.ReservedCacheNodesOfferingId!;
  expect(offeringId).toBeDefined();

  const purchased = await client.send(
    new PurchaseReservedCacheNodesOfferingCommand({
      ReservedCacheNodesOfferingId: offeringId,
      ReservedCacheNodeId: "bunsai-reserved-1",
      CacheNodeCount: 1,
    }),
  );
  expect(purchased.ReservedCacheNode?.ReservedCacheNodeId).toBe(
    "bunsai-reserved-1",
  );
  expect(purchased.ReservedCacheNode?.State).toBe("active");

  const described = await client.send(
    new DescribeReservedCacheNodesCommand({
      ReservedCacheNodeId: "bunsai-reserved-1",
    }),
  );
  expect(described.ReservedCacheNodes?.length).toBe(1);
});

test("ElastiCache global replication group scaling ops", async () => {
  const client = elasticache();
  const rgId = "bunsai-e2e-rg-scale";
  const suffix = "bunsai-scale";

  await client.send(
    new CreateReplicationGroupCommand({
      ReplicationGroupId: rgId,
      ReplicationGroupDescription: "scale test",
      Engine: "redis",
      CacheNodeType: "cache.r7g.large",
    }),
  );

  const created = await client.send(
    new CreateGlobalReplicationGroupCommand({
      GlobalReplicationGroupIdSuffix: suffix,
      PrimaryReplicationGroupId: rgId,
    }),
  );
  const globalId = created.GlobalReplicationGroup!.GlobalReplicationGroupId!;

  const increased = await client.send(
    new IncreaseNodeGroupsInGlobalReplicationGroupCommand({
      GlobalReplicationGroupId: globalId,
      NodeGroupCount: 2,
      ApplyImmediately: true,
    }),
  );
  expect(increased.GlobalReplicationGroup?.GlobalReplicationGroupId).toBe(
    globalId,
  );

  const decreased = await client.send(
    new DecreaseNodeGroupsInGlobalReplicationGroupCommand({
      GlobalReplicationGroupId: globalId,
      NodeGroupCount: 1,
      ApplyImmediately: true,
    }),
  );
  expect(decreased.GlobalReplicationGroup?.GlobalReplicationGroupId).toBe(
    globalId,
  );

  const failover = await client.send(
    new FailoverGlobalReplicationGroupCommand({
      GlobalReplicationGroupId: globalId,
      PrimaryRegion: region,
      PrimaryReplicationGroupId: rgId,
    }),
  );
  expect(failover.GlobalReplicationGroup?.GlobalReplicationGroupId).toBe(
    globalId,
  );

  const rebalanced = await client.send(
    new RebalanceSlotsInGlobalReplicationGroupCommand({
      GlobalReplicationGroupId: globalId,
      ApplyImmediately: true,
    }),
  );
  expect(rebalanced.GlobalReplicationGroup?.GlobalReplicationGroupId).toBe(
    globalId,
  );

  await client.send(
    new DeleteGlobalReplicationGroupCommand({
      GlobalReplicationGroupId: globalId,
      RetainPrimaryReplicationGroup: true,
    }),
  );
});
