import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchUpdateClusterCommand,
  CopySnapshotCommand,
  CreateACLCommand,
  CreateClusterCommand,
  CreateMultiRegionClusterCommand,
  CreateParameterGroupCommand,
  CreateSnapshotCommand,
  CreateSubnetGroupCommand,
  CreateUserCommand,
  DeleteACLCommand,
  DeleteClusterCommand,
  DeleteMultiRegionClusterCommand,
  DeleteParameterGroupCommand,
  DeleteSnapshotCommand,
  DeleteSubnetGroupCommand,
  DeleteUserCommand,
  DescribeACLsCommand,
  DescribeClustersCommand,
  DescribeEngineVersionsCommand,
  DescribeEventsCommand,
  DescribeMultiRegionClustersCommand,
  DescribeParameterGroupsCommand,
  DescribeParametersCommand,
  DescribeReservedNodesOfferingsCommand,
  DescribeServiceUpdatesCommand,
  DescribeSnapshotsCommand,
  DescribeSubnetGroupsCommand,
  DescribeUsersCommand,
  FailoverShardCommand,
  ListAllowedNodeTypeUpdatesCommand,
  ListTagsCommand,
  MemoryDBClient,
  PurchaseReservedNodesOfferingCommand,
  ResetParameterGroupCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateACLCommand,
  UpdateClusterCommand,
  UpdateParameterGroupCommand,
  UpdateSubnetGroupCommand,
  UpdateUserCommand,
} from "@aws-sdk/client-memorydb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const memorydb = () =>
  new MemoryDBClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("MemoryDB seed: create open-access ACL", async () => {
  const client = memorydb();
  await client.send(
    new CreateACLCommand({ ACLName: "open-access", UserNames: [] }),
  );
});

test("MemoryDB cluster and subnet group lifecycle", async () => {
  const client = memorydb();
  const name = "bunsai-e2e-cluster";

  const created = await client.send(
    new CreateClusterCommand({
      ClusterName: name,
      NodeType: "db.r6g.large",
      ACLName: "open-access",
    }),
  );
  expect(created.Cluster?.Name).toBe(name);
  expect(created.Cluster?.Status).toBe("creating");
  expect(created.Cluster?.ARN).toContain(name);

  const described = await client.send(new DescribeClustersCommand({}));
  expect((described.Clusters ?? []).some((c) => c.Name === name)).toBe(true);

  const updated = await client.send(
    new UpdateClusterCommand({ ClusterName: name, Description: "updated" }),
  );
  expect(updated.Cluster?.Description).toBe("updated");

  const subnetGroup = await client.send(
    new CreateSubnetGroupCommand({
      SubnetGroupName: "bunsai-e2e-sng",
      SubnetIds: ["subnet-aaaa1111", "subnet-bbbb2222"],
    }),
  );
  expect(subnetGroup.SubnetGroup?.Name).toBe("bunsai-e2e-sng");
  expect(subnetGroup.SubnetGroup?.Subnets?.length).toBe(2);

  const deleted = await client.send(
    new DeleteClusterCommand({ ClusterName: name }),
  );
  expect(deleted.Cluster?.Status).toBe("deleting");
});

test("MemoryDB parameter group lifecycle", async () => {
  const client = memorydb();
  const pgName = "bunsai-e2e-pg";

  const created = await client.send(
    new CreateParameterGroupCommand({
      ParameterGroupName: pgName,
      Family: "memorydb_redis7",
      Description: "test pg",
    }),
  );
  expect(created.ParameterGroup?.Name).toBe(pgName);
  expect(created.ParameterGroup?.Family).toBe("memorydb_redis7");
  expect(created.ParameterGroup?.ARN).toContain(pgName);

  const described = await client.send(
    new DescribeParameterGroupsCommand({ ParameterGroupName: pgName }),
  );
  expect(described.ParameterGroups?.[0]?.Name).toBe(pgName);

  const params = await client.send(
    new DescribeParametersCommand({ ParameterGroupName: pgName }),
  );
  expect(Array.isArray(params.Parameters)).toBe(true);

  await client.send(
    new UpdateParameterGroupCommand({
      ParameterGroupName: pgName,
      ParameterNameValues: [
        { ParameterName: "maxmemory-policy", ParameterValue: "allkeys-lru" },
      ],
    }),
  );

  const reset = await client.send(
    new ResetParameterGroupCommand({
      ParameterGroupName: pgName,
      AllParameters: true,
    }),
  );
  expect(reset.ParameterGroup?.Name).toBe(pgName);

  const deleted = await client.send(
    new DeleteParameterGroupCommand({ ParameterGroupName: pgName }),
  );
  expect(deleted.ParameterGroup?.Name).toBe(pgName);
});

test("MemoryDB snapshot lifecycle", async () => {
  const client = memorydb();
  const clusterName = "bunsai-e2e-snap-cluster";
  const snapName = "bunsai-e2e-snap";
  const snapCopy = "bunsai-e2e-snap-copy";

  await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      NodeType: "db.r6g.large",
      ACLName: "open-access",
    }),
  );

  const created = await client.send(
    new CreateSnapshotCommand({
      ClusterName: clusterName,
      SnapshotName: snapName,
    }),
  );
  expect(created.Snapshot?.Name).toBe(snapName);
  expect(created.Snapshot?.Status).toBe("creating");
  expect(created.Snapshot?.ARN).toContain(snapName);

  const described = await client.send(
    new DescribeSnapshotsCommand({ SnapshotName: snapName }),
  );
  expect(described.Snapshots?.[0]?.Name).toBe(snapName);

  const copied = await client.send(
    new CopySnapshotCommand({
      SourceSnapshotName: snapName,
      TargetSnapshotName: snapCopy,
    }),
  );
  expect(copied.Snapshot?.Name).toBe(snapCopy);

  const deletedCopy = await client.send(
    new DeleteSnapshotCommand({ SnapshotName: snapCopy }),
  );
  expect(deletedCopy.Snapshot?.Status).toBe("deleting");

  const deleted = await client.send(
    new DeleteSnapshotCommand({ SnapshotName: snapName }),
  );
  expect(deleted.Snapshot?.Status).toBe("deleting");

  await client.send(new DeleteClusterCommand({ ClusterName: clusterName }));
});

test("MemoryDB user lifecycle", async () => {
  const client = memorydb();
  const userName = "bunsai-e2e-user";

  const created = await client.send(
    new CreateUserCommand({
      UserName: userName,
      AccessString: "on ~* +@all",
      AuthenticationMode: { Type: "password", Passwords: ["MyPassword123"] },
    }),
  );
  expect(created.User?.Name).toBe(userName);
  expect(created.User?.Status).toBe("active");
  expect(created.User?.ARN).toContain(userName);

  const described = await client.send(
    new DescribeUsersCommand({ UserName: userName }),
  );
  expect(described.Users?.[0]?.Name).toBe(userName);

  const updated = await client.send(
    new UpdateUserCommand({
      UserName: userName,
      AccessString: "on ~* +@read",
    }),
  );
  expect(updated.User?.AccessString).toBe("on ~* +@read");

  const deleted = await client.send(
    new DeleteUserCommand({ UserName: userName }),
  );
  expect(deleted.User?.Status).toBe("deleting");
});

test("MemoryDB ACL lifecycle", async () => {
  const client = memorydb();
  const aclName = "bunsai-e2e-acl";

  const created = await client.send(
    new CreateACLCommand({
      ACLName: aclName,
      UserNames: [],
    }),
  );
  expect(created.ACL?.Name).toBe(aclName);
  expect(created.ACL?.Status).toBe("active");
  expect(created.ACL?.ARN).toContain(aclName);

  const described = await client.send(
    new DescribeACLsCommand({ ACLName: aclName }),
  );
  expect(described.ACLs?.[0]?.Name).toBe(aclName);

  const updated = await client.send(
    new UpdateACLCommand({
      ACLName: aclName,
      UserNamesToAdd: ["some-user"],
      UserNamesToRemove: [],
    }),
  );
  expect(updated.ACL?.UserNames).toContain("some-user");

  const deleted = await client.send(new DeleteACLCommand({ ACLName: aclName }));
  expect(deleted.ACL?.Status).toBe("deleting");
});

test("MemoryDB multi-region cluster lifecycle", async () => {
  const client = memorydb();
  const suffix = "e2e-mrc";

  const created = await client.send(
    new CreateMultiRegionClusterCommand({
      MultiRegionClusterNameSuffix: suffix,
      NodeType: "db.r6g.large",
      Description: "test mrc",
    }),
  );
  const mrcName = created.MultiRegionCluster?.MultiRegionClusterName;
  expect(mrcName).toBeDefined();
  expect(created.MultiRegionCluster?.Status).toBe("creating");
  expect(created.MultiRegionCluster?.ARN).toBeDefined();

  const described = await client.send(
    new DescribeMultiRegionClustersCommand({
      MultiRegionClusterName: mrcName,
    }),
  );
  expect(described.MultiRegionClusters?.[0]?.MultiRegionClusterName).toBe(
    mrcName,
  );

  const deleted = await client.send(
    new DeleteMultiRegionClusterCommand({
      MultiRegionClusterName: mrcName!,
    }),
  );
  expect(deleted.MultiRegionCluster?.Status).toBe("deleting");
});

test("MemoryDB subnet group operations", async () => {
  const client = memorydb();
  const sngName = "bunsai-e2e-sng2";

  await client.send(
    new CreateSubnetGroupCommand({
      SubnetGroupName: sngName,
      SubnetIds: ["subnet-1111aaaa"],
    }),
  );

  const described = await client.send(
    new DescribeSubnetGroupsCommand({ SubnetGroupName: sngName }),
  );
  expect(described.SubnetGroups?.[0]?.Name).toBe(sngName);

  const updated = await client.send(
    new UpdateSubnetGroupCommand({
      SubnetGroupName: sngName,
      SubnetIds: ["subnet-1111aaaa", "subnet-2222bbbb"],
      Description: "updated",
    }),
  );
  expect(updated.SubnetGroup?.Subnets?.length).toBe(2);
  expect(updated.SubnetGroup?.Description).toBe("updated");

  const deleted = await client.send(
    new DeleteSubnetGroupCommand({ SubnetGroupName: sngName }),
  );
  expect(deleted.SubnetGroup?.Name).toBe(sngName);
});

test("MemoryDB tags operations", async () => {
  const client = memorydb();
  const clusterName = "bunsai-e2e-tag-cluster";

  const created = await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      NodeType: "db.r6g.large",
      ACLName: "open-access",
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const arn = created.Cluster?.ARN!;

  const listed = await client.send(new ListTagsCommand({ ResourceArn: arn }));
  expect((listed.TagList ?? []).some((t) => t.Key === "env")).toBe(true);

  const tagged = await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      Tags: [{ Key: "team", Value: "platform" }],
    }),
  );
  expect((tagged.TagList ?? []).some((t) => t.Key === "team")).toBe(true);

  const untagged = await client.send(
    new UntagResourceCommand({ ResourceArn: arn, TagKeys: ["env"] }),
  );
  expect((untagged.TagList ?? []).some((t) => t.Key === "env")).toBe(false);

  await client.send(new DeleteClusterCommand({ ClusterName: clusterName }));
});

test("MemoryDB catalog operations", async () => {
  const client = memorydb();

  const engineVersions = await client.send(
    new DescribeEngineVersionsCommand({}),
  );
  expect((engineVersions.EngineVersions ?? []).length).toBeGreaterThan(0);
  expect(engineVersions.EngineVersions?.[0]?.EngineVersion).toBeDefined();

  const events = await client.send(new DescribeEventsCommand({}));
  expect(Array.isArray(events.Events)).toBe(true);

  const serviceUpdates = await client.send(
    new DescribeServiceUpdatesCommand({}),
  );
  expect(Array.isArray(serviceUpdates.ServiceUpdates)).toBe(true);

  const offerings = await client.send(
    new DescribeReservedNodesOfferingsCommand({}),
  );
  expect((offerings.ReservedNodesOfferings ?? []).length).toBeGreaterThan(0);
});

test("MemoryDB batch update and failover", async () => {
  const client = memorydb();
  const clusterName = "bunsai-e2e-batch-cluster";

  await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      NodeType: "db.r6g.large",
      ACLName: "open-access",
    }),
  );

  const batched = await client.send(
    new BatchUpdateClusterCommand({
      ClusterNames: [clusterName, "nonexistent-cluster"],
    }),
  );
  expect(
    (batched.ProcessedClusters ?? []).some((c) => c.Name === clusterName),
  ).toBe(true);
  expect(
    (batched.UnprocessedClusters ?? []).some(
      (c) => c.ClusterName === "nonexistent-cluster",
    ),
  ).toBe(true);

  const failover = await client.send(
    new FailoverShardCommand({
      ClusterName: clusterName,
      ShardName: "0001",
    }),
  );
  expect(failover.Cluster?.Name).toBe(clusterName);

  await client.send(new DeleteClusterCommand({ ClusterName: clusterName }));
});

test("MemoryDB allowed node type updates and reserved nodes", async () => {
  const client = memorydb();
  const clusterName = "bunsai-e2e-nodetype-cluster";

  await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      NodeType: "db.r6g.large",
      ACLName: "open-access",
    }),
  );

  const allowed = await client.send(
    new ListAllowedNodeTypeUpdatesCommand({ ClusterName: clusterName }),
  );
  expect(Array.isArray(allowed.ScaleUpNodeTypes)).toBe(true);
  expect(Array.isArray(allowed.ScaleDownNodeTypes)).toBe(true);

  const offerings = await client.send(
    new DescribeReservedNodesOfferingsCommand({}),
  );
  const offeringId =
    offerings.ReservedNodesOfferings?.[0]?.ReservedNodesOfferingId!;

  const purchased = await client.send(
    new PurchaseReservedNodesOfferingCommand({
      ReservedNodesOfferingId: offeringId,
      NodeCount: 1,
    }),
  );
  expect(purchased.ReservedNode?.ReservedNodesOfferingId).toBe(offeringId);
  expect(purchased.ReservedNode?.State).toBe("active");

  await client.send(new DeleteClusterCommand({ ClusterName: clusterName }));
});

test("MemoryDB pagination", async () => {
  const client = memorydb();
  const prefix = "bunsai-pg-";

  for (let i = 0; i < 3; i++) {
    await client.send(
      new CreateClusterCommand({
        ClusterName: `${prefix}${i}`,
        NodeType: "db.r6g.large",
        ACLName: "open-access",
      }),
    );
  }

  const page1 = await client.send(
    new DescribeClustersCommand({ MaxResults: 2 }),
  );
  expect((page1.Clusters ?? []).length).toBeLessThanOrEqual(2);

  if (page1.NextToken) {
    const page2 = await client.send(
      new DescribeClustersCommand({
        MaxResults: 2,
        NextToken: page1.NextToken,
      }),
    );
    expect(Array.isArray(page2.Clusters)).toBe(true);
  }

  for (let i = 0; i < 3; i++) {
    await client.send(
      new DeleteClusterCommand({ ClusterName: `${prefix}${i}` }),
    );
  }
});

test("MemoryDB ShowShardDetails", async () => {
  const client = memorydb();
  const clusterName = "bunsai-shards-cluster";

  await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      NodeType: "db.r6g.large",
      ACLName: "open-access",
      NumShards: 2,
    }),
  );

  const withShards = await client.send(
    new DescribeClustersCommand({
      ClusterName: clusterName,
      ShowShardDetails: true,
    }),
  );
  const cluster = withShards.Clusters?.[0];
  expect(Array.isArray(cluster?.Shards)).toBe(true);
  expect((cluster?.Shards ?? []).length).toBe(2);
  expect(cluster?.Shards?.[0]?.Name).toBeDefined();
  expect(cluster?.Shards?.[0]?.Status).toBe("available");
  expect(cluster?.Shards?.[0]?.Slots).toContain("0");

  await client.send(new DeleteClusterCommand({ ClusterName: clusterName }));
});

test("MemoryDB parameter persistence", async () => {
  const client = memorydb();
  const pgName = "bunsai-param-persist-pg";

  await client.send(
    new CreateParameterGroupCommand({
      ParameterGroupName: pgName,
      Family: "memorydb_redis7",
    }),
  );

  const defaultParams = await client.send(
    new DescribeParametersCommand({ ParameterGroupName: pgName }),
  );
  const defaultPolicy = defaultParams.Parameters?.find(
    (p) => p.Name === "maxmemory-policy",
  );
  expect(defaultPolicy?.Value).toBe("noeviction");

  await client.send(
    new UpdateParameterGroupCommand({
      ParameterGroupName: pgName,
      ParameterNameValues: [
        { ParameterName: "maxmemory-policy", ParameterValue: "allkeys-lru" },
      ],
    }),
  );

  const updated = await client.send(
    new DescribeParametersCommand({ ParameterGroupName: pgName }),
  );
  const updatedPolicy = updated.Parameters?.find(
    (p) => p.Name === "maxmemory-policy",
  );
  expect(updatedPolicy?.Value).toBe("allkeys-lru");

  await client.send(
    new ResetParameterGroupCommand({
      ParameterGroupName: pgName,
      AllParameters: true,
    }),
  );

  const reset = await client.send(
    new DescribeParametersCommand({ ParameterGroupName: pgName }),
  );
  const resetPolicy = reset.Parameters?.find(
    (p) => p.Name === "maxmemory-policy",
  );
  expect(resetPolicy?.Value).toBe("noeviction");

  await client.send(
    new DeleteParameterGroupCommand({ ParameterGroupName: pgName }),
  );
});

test("MemoryDB DescribeUsers ACL filter", async () => {
  const client = memorydb();
  const aclName = "bunsai-filter-acl";
  const userName1 = "bunsai-filter-user1";
  const userName2 = "bunsai-filter-user2";

  await client.send(
    new CreateUserCommand({
      UserName: userName1,
      AccessString: "on ~* +@all",
      AuthenticationMode: { Type: "password", Passwords: ["Pass1234!"] },
    }),
  );
  await client.send(
    new CreateUserCommand({
      UserName: userName2,
      AccessString: "on ~* +@read",
      AuthenticationMode: { Type: "password", Passwords: ["Pass1234!"] },
    }),
  );

  await client.send(
    new CreateACLCommand({
      ACLName: aclName,
      UserNames: [userName1],
    }),
  );

  const filtered = await client.send(
    new DescribeUsersCommand({
      Filters: [{ Name: "ACLName", Values: [aclName] }],
    }),
  );
  const names = (filtered.Users ?? []).map((u) => u.Name);
  expect(names).toContain(userName1);
  expect(names).not.toContain(userName2);

  await client.send(new DeleteACLCommand({ ACLName: aclName }));
  await client.send(new DeleteUserCommand({ UserName: userName1 }));
  await client.send(new DeleteUserCommand({ UserName: userName2 }));
});

test("MemoryDB creating→available lifecycle", async () => {
  const client = memorydb();
  const clusterName = "bunsai-lifecycle-cluster";

  const created = await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      NodeType: "db.r6g.large",
      ACLName: "open-access",
    }),
  );
  expect(created.Cluster?.Status).toBe("creating");

  const described = await client.send(
    new DescribeClustersCommand({ ClusterName: clusterName }),
  );
  expect(described.Clusters?.[0]?.Status).toBe("available");

  await client.send(new DeleteClusterCommand({ ClusterName: clusterName }));
});

test("MemoryDB fidelity: tag cleanup and ref validation", async () => {
  const client = memorydb();

  const tagClusterName = "fid-tag-cluster";
  const clusterArn = (
    await client.send(
      new CreateClusterCommand({
        ClusterName: tagClusterName,
        NodeType: "db.r6g.large",
        ACLName: "open-access",
        Tags: [{ Key: "env", Value: "prod" }],
      }),
    )
  ).Cluster?.ARN!;

  const listed = await client.send(
    new ListTagsCommand({ ResourceArn: clusterArn }),
  );
  expect((listed.TagList ?? []).some((t) => t.Key === "env")).toBe(true);

  await client.send(new DeleteClusterCommand({ ClusterName: tagClusterName }));

  await client.send(
    new CreateClusterCommand({
      ClusterName: tagClusterName,
      NodeType: "db.r6g.large",
      ACLName: "open-access",
    }),
  );
  const listedAfter = await client.send(
    new ListTagsCommand({ ResourceArn: clusterArn }),
  );
  expect((listedAfter.TagList ?? []).length).toBe(0);
  await client.send(new DeleteClusterCommand({ ClusterName: tagClusterName }));

  await expect(
    client.send(
      new CreateClusterCommand({
        ClusterName: "fid-bogus-acl",
        NodeType: "db.r6g.large",
        ACLName: "nonexistent-acl",
      }),
    ),
  ).rejects.toMatchObject({ name: "ACLNotFoundFault" });

  const fidAclName = "fid-in-use-acl";
  const fidClusterName = "fid-in-use-cluster";
  await client.send(
    new CreateACLCommand({ ACLName: fidAclName, UserNames: [] }),
  );
  await client.send(
    new CreateClusterCommand({
      ClusterName: fidClusterName,
      NodeType: "db.r6g.large",
      ACLName: fidAclName,
    }),
  );

  await expect(
    client.send(new DeleteACLCommand({ ACLName: fidAclName })),
  ).rejects.toMatchObject({ name: "InvalidACLStateFault" });

  await client.send(new DeleteClusterCommand({ ClusterName: fidClusterName }));
  await client.send(new DeleteACLCommand({ ACLName: fidAclName }));

  await expect(
    client.send(new DescribeClustersCommand({ NextToken: "not-a-number" })),
  ).rejects.toMatchObject({ name: "InvalidNextTokenException" });

  const fidSnapSource = "fid-snap-source";
  const fidSnapCopy = "fid-snap-copy";
  const fidSnapCluster = "fid-snap-cluster";
  await client.send(
    new CreateClusterCommand({
      ClusterName: fidSnapCluster,
      NodeType: "db.r6g.large",
      ACLName: "open-access",
    }),
  );
  const snapArn = (
    await client.send(
      new CreateSnapshotCommand({
        ClusterName: fidSnapCluster,
        SnapshotName: fidSnapSource,
        Tags: [{ Key: "origin", Value: "source" }],
      }),
    )
  ).Snapshot?.ARN!;
  await client.send(
    new TagResourceCommand({
      ResourceArn: snapArn,
      Tags: [{ Key: "team", Value: "platform" }],
    }),
  );

  const copied = await client.send(
    new CopySnapshotCommand({
      SourceSnapshotName: fidSnapSource,
      TargetSnapshotName: fidSnapCopy,
    }),
  );
  const copyArn = copied.Snapshot?.ARN!;
  const copyTags = await client.send(
    new ListTagsCommand({ ResourceArn: copyArn }),
  );
  const copyTagMap = Object.fromEntries(
    (copyTags.TagList ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(copyTagMap["team"]).toBe("platform");

  await client.send(new DeleteSnapshotCommand({ SnapshotName: fidSnapCopy }));
  await client.send(new DeleteSnapshotCommand({ SnapshotName: fidSnapSource }));
  await client.send(new DeleteClusterCommand({ ClusterName: fidSnapCluster }));
});
