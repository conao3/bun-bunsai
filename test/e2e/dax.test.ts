import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateClusterCommand,
  CreateParameterGroupCommand,
  CreateSubnetGroupCommand,
  DAXClient,
  DecreaseReplicationFactorCommand,
  DeleteClusterCommand,
  DeleteParameterGroupCommand,
  DeleteSubnetGroupCommand,
  DescribeClustersCommand,
  DescribeDefaultParametersCommand,
  DescribeEventsCommand,
  DescribeParameterGroupsCommand,
  DescribeParametersCommand,
  DescribeSubnetGroupsCommand,
  IncreaseReplicationFactorCommand,
  ListTagsCommand,
  RebootNodeCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateClusterCommand,
  UpdateParameterGroupCommand,
  UpdateSubnetGroupCommand,
} from "@aws-sdk/client-dax";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const dax = () =>
  new DAXClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("DAX cluster and subnet group lifecycle", async () => {
  const client = dax();
  const name = "bunsai-e2e-dax";

  const created = await client.send(
    new CreateClusterCommand({
      ClusterName: name,
      NodeType: "dax.r4.large",
      ReplicationFactor: 3,
      IamRoleArn: "arn:aws:iam::000000000000:role/dax",
    }),
  );
  expect(created.Cluster?.ClusterName).toBe(name);
  expect(created.Cluster?.Status).toBe("available");
  expect(created.Cluster?.TotalNodes).toBe(3);
  expect(created.Cluster?.ClusterArn).toContain(name);

  const described = await client.send(
    new DescribeClustersCommand({ ClusterNames: [name] }),
  );
  expect((described.Clusters ?? [])[0]?.ClusterName).toBe(name);

  const sng = await client.send(
    new CreateSubnetGroupCommand({
      SubnetGroupName: "bunsai-e2e-dax-sng",
      SubnetIds: ["subnet-aaaa1111", "subnet-bbbb2222"],
    }),
  );
  expect(sng.SubnetGroup?.SubnetGroupName).toBe("bunsai-e2e-dax-sng");
  expect(sng.SubnetGroup?.Subnets?.length).toBe(2);

  const sngs = await client.send(new DescribeSubnetGroupsCommand({}));
  expect(
    (sngs.SubnetGroups ?? []).some(
      (g) => g.SubnetGroupName === "bunsai-e2e-dax-sng",
    ),
  ).toBe(true);

  const deleted = await client.send(
    new DeleteClusterCommand({ ClusterName: name }),
  );
  expect(deleted.Cluster?.Status).toBe("deleting");
});

test("DAX UpdateCluster", async () => {
  const client = dax();
  const name = "bunsai-e2e-update-cluster";

  await client.send(
    new CreateClusterCommand({
      ClusterName: name,
      NodeType: "dax.r4.large",
      ReplicationFactor: 1,
      IamRoleArn: "arn:aws:iam::000000000000:role/dax",
    }),
  );

  const updated = await client.send(
    new UpdateClusterCommand({
      ClusterName: name,
      Description: "updated description",
    }),
  );
  expect(updated.Cluster?.ClusterName).toBe(name);
  expect(updated.Cluster?.Description).toBe("updated description");

  await client.send(new DeleteClusterCommand({ ClusterName: name }));
});

test("DAX IncreaseReplicationFactor and DecreaseReplicationFactor", async () => {
  const client = dax();
  const name = "bunsai-e2e-replfactor";

  await client.send(
    new CreateClusterCommand({
      ClusterName: name,
      NodeType: "dax.r4.large",
      ReplicationFactor: 1,
      IamRoleArn: "arn:aws:iam::000000000000:role/dax",
    }),
  );

  const increased = await client.send(
    new IncreaseReplicationFactorCommand({
      ClusterName: name,
      NewReplicationFactor: 3,
    }),
  );
  expect(increased.Cluster?.TotalNodes).toBe(3);

  const decreased = await client.send(
    new DecreaseReplicationFactorCommand({
      ClusterName: name,
      NewReplicationFactor: 2,
    }),
  );
  expect(decreased.Cluster?.TotalNodes).toBe(2);

  await client.send(new DeleteClusterCommand({ ClusterName: name }));
});

test("DAX RebootNode", async () => {
  const client = dax();
  const name = "bunsai-e2e-reboot";

  await client.send(
    new CreateClusterCommand({
      ClusterName: name,
      NodeType: "dax.r4.large",
      ReplicationFactor: 1,
      IamRoleArn: "arn:aws:iam::000000000000:role/dax",
    }),
  );

  const rebooted = await client.send(
    new RebootNodeCommand({
      ClusterName: name,
      NodeId: "node-001",
    }),
  );
  expect(rebooted.Cluster?.ClusterName).toBe(name);

  await client.send(new DeleteClusterCommand({ ClusterName: name }));
});

test("DAX parameter group lifecycle", async () => {
  const client = dax();
  const pgName = "bunsai-e2e-pg";

  const created = await client.send(
    new CreateParameterGroupCommand({
      ParameterGroupName: pgName,
      Description: "test parameter group",
    }),
  );
  expect(created.ParameterGroup?.ParameterGroupName).toBe(pgName);

  const described = await client.send(
    new DescribeParameterGroupsCommand({ ParameterGroupNames: [pgName] }),
  );
  expect(
    (described.ParameterGroups ?? []).some(
      (pg) => pg.ParameterGroupName === pgName,
    ),
  ).toBe(true);

  const params = await client.send(
    new DescribeParametersCommand({ ParameterGroupName: pgName }),
  );
  expect((params.Parameters ?? []).length).toBeGreaterThan(0);

  const updated = await client.send(
    new UpdateParameterGroupCommand({
      ParameterGroupName: pgName,
      ParameterNameValues: [
        { ParameterName: "query-ttl-millis", ParameterValue: "600000" },
      ],
    }),
  );
  expect(updated.ParameterGroup?.ParameterGroupName).toBe(pgName);

  const deleted = await client.send(
    new DeleteParameterGroupCommand({ ParameterGroupName: pgName }),
  );
  expect(deleted.DeletionMessage).toContain(pgName);
});

test("DAX DescribeDefaultParameters", async () => {
  const client = dax();
  const result = await client.send(new DescribeDefaultParametersCommand({}));
  expect((result.Parameters ?? []).length).toBeGreaterThan(0);
  const names = (result.Parameters ?? []).map((p) => p.ParameterName);
  expect(names).toContain("query-ttl-millis");
  expect(names).toContain("record-ttl-millis");
});

test("DAX UpdateSubnetGroup and DeleteSubnetGroup", async () => {
  const client = dax();
  const sgName = "bunsai-e2e-sg-update";

  await client.send(
    new CreateSubnetGroupCommand({
      SubnetGroupName: sgName,
      SubnetIds: ["subnet-aaa00001"],
    }),
  );

  const updated = await client.send(
    new UpdateSubnetGroupCommand({
      SubnetGroupName: sgName,
      Description: "updated sg",
      SubnetIds: ["subnet-bbb00002", "subnet-ccc00003"],
    }),
  );
  expect(updated.SubnetGroup?.SubnetGroupName).toBe(sgName);
  expect(updated.SubnetGroup?.Subnets?.length).toBe(2);

  const deleted = await client.send(
    new DeleteSubnetGroupCommand({ SubnetGroupName: sgName }),
  );
  expect(deleted.DeletionMessage).toContain(sgName);
});

test("DAX DescribeEvents", async () => {
  const client = dax();
  const result = await client.send(new DescribeEventsCommand({}));
  expect(Array.isArray(result.Events)).toBe(true);
});

test("DAX tags lifecycle", async () => {
  const client = dax();
  const name = "bunsai-e2e-tags";

  const created = await client.send(
    new CreateClusterCommand({
      ClusterName: name,
      NodeType: "dax.r4.large",
      ReplicationFactor: 1,
      IamRoleArn: "arn:aws:iam::000000000000:role/dax",
    }),
  );
  const arn = created.Cluster?.ClusterArn ?? "";
  expect(arn).toBeTruthy();

  const tagged = await client.send(
    new TagResourceCommand({
      ResourceName: arn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "owner", Value: "bunsai" },
      ],
    }),
  );
  expect((tagged.Tags ?? []).some((t) => t.Key === "env")).toBe(true);

  const listed = await client.send(new ListTagsCommand({ ResourceName: arn }));
  expect((listed.Tags ?? []).some((t) => t.Key === "owner")).toBe(true);
  expect((listed.Tags ?? []).length).toBe(2);

  const untagged = await client.send(
    new UntagResourceCommand({
      ResourceName: arn,
      TagKeys: ["env"],
    }),
  );
  expect((untagged.Tags ?? []).some((t) => t.Key === "env")).toBe(false);
  expect((untagged.Tags ?? []).some((t) => t.Key === "owner")).toBe(true);

  await client.send(new DeleteClusterCommand({ ClusterName: name }));
});
