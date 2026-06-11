import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateClusterCommand,
  CreateClusterV2Command,
  CreateConfigurationCommand,
  CreateReplicatorCommand,
  CreateTopicCommand,
  CreateVpcConnectionCommand,
  DeleteClusterCommand,
  DeleteConfigurationCommand,
  DeleteTopicCommand,
  DescribeClusterCommand,
  DescribeClusterOperationCommand,
  DescribeClusterOperationV2Command,
  DescribeClusterV2Command,
  DescribeConfigurationCommand,
  DescribeConfigurationRevisionCommand,
  DescribeReplicatorCommand,
  DescribeTopicCommand,
  DescribeVpcConnectionCommand,
  GetBootstrapBrokersCommand,
  KafkaClient,
  ListClientVpcConnectionsCommand,
  ListClusterOperationsCommand,
  ListClusterOperationsV2Command,
  ListClustersCommand,
  ListClustersV2Command,
  ListConfigurationRevisionsCommand,
  ListConfigurationsCommand,
  ListTagsForResourceCommand,
  ListTopicsCommand,
  RejectClientVpcConnectionCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateBrokerCountCommand,
  UpdateClusterConfigurationCommand,
  UpdateConfigurationCommand,
  UpdateReplicationInfoCommand,
} from "@aws-sdk/client-kafka";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const kafka = () =>
  new KafkaClient({ endpoint, region, credentials, requestHandler });

test("MSK cluster lifecycle + GetBootstrapBrokers + tag round-trip", async () => {
  const client = kafka();
  const clusterName = `bunsai-kafka-${Date.now()}`;

  const created = await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      KafkaVersion: "2.8.1",
      NumberOfBrokerNodes: 3,
      BrokerNodeGroupInfo: {
        InstanceType: "kafka.m5.large",
        ClientSubnets: ["subnet-aaaa", "subnet-bbbb", "subnet-cccc"],
      },
    }),
  );
  expect(created.ClusterArn).toContain(`cluster/${clusterName}`);
  expect(created.ClusterName).toBe(clusterName);
  expect(created.State).toBe("CREATING");

  const described = await client.send(
    new DescribeClusterCommand({ ClusterArn: created.ClusterArn! }),
  );
  expect(described.ClusterInfo?.ClusterName).toBe(clusterName);
  expect(described.ClusterInfo?.State).toBe("ACTIVE");
  expect(described.ClusterInfo?.NumberOfBrokerNodes).toBe(3);

  const listed = await client.send(new ListClustersCommand({}));
  expect(
    listed.ClusterInfoList?.some((c) => c.ClusterName === clusterName),
  ).toBe(true);

  const bootstrap = await client.send(
    new GetBootstrapBrokersCommand({ ClusterArn: created.ClusterArn! }),
  );
  expect(bootstrap.BootstrapBrokerString).toContain(
    `b-1.${clusterName.toLowerCase()}`,
  );
  expect(bootstrap.BootstrapBrokerString).toContain(":9092");
  expect(bootstrap.BootstrapBrokerStringTls).toContain(":9094");

  await client.send(
    new TagResourceCommand({
      ResourceArn: created.ClusterArn!,
      Tags: { Env: "test", Team: "kafka" },
    }),
  );
  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: created.ClusterArn! }),
  );
  expect(tags.Tags?.["Env"]).toBe("test");
  expect(tags.Tags?.["Team"]).toBe("kafka");

  await client.send(
    new UntagResourceCommand({
      ResourceArn: created.ClusterArn!,
      TagKeys: ["Team"],
    }),
  );
  const tagsAfter = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: created.ClusterArn! }),
  );
  expect(tagsAfter.Tags?.["Env"]).toBe("test");
  expect(tagsAfter.Tags?.["Team"]).toBeUndefined();

  const deleted = await client.send(
    new DeleteClusterCommand({ ClusterArn: created.ClusterArn! }),
  );
  expect(deleted.State).toBe("DELETING");
});

test("MSK UpdateBrokerCount generates cluster operation", async () => {
  const client = kafka();
  const clusterName = `bunsai-brokercount-${Date.now()}`;

  const created = await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      KafkaVersion: "2.8.1",
      NumberOfBrokerNodes: 3,
      BrokerNodeGroupInfo: {
        InstanceType: "kafka.m5.large",
        ClientSubnets: ["subnet-aaaa", "subnet-bbbb", "subnet-cccc"],
      },
    }),
  );

  const described = await client.send(
    new DescribeClusterCommand({ ClusterArn: created.ClusterArn! }),
  );
  const currentVersion = described.ClusterInfo?.CurrentVersion!;

  const updated = await client.send(
    new UpdateBrokerCountCommand({
      ClusterArn: created.ClusterArn!,
      CurrentVersion: currentVersion,
      TargetNumberOfBrokerNodes: 6,
    }),
  );
  expect(updated.ClusterArn).toBe(created.ClusterArn);
  expect(updated.ClusterOperationArn).toBeDefined();

  const ops = await client.send(
    new ListClusterOperationsCommand({ ClusterArn: created.ClusterArn! }),
  );
  expect(ops.ClusterOperationInfoList?.length).toBeGreaterThan(0);

  const operationArn = ops.ClusterOperationInfoList![0].OperationArn!;
  const op = await client.send(
    new DescribeClusterOperationCommand({
      ClusterOperationArn: operationArn,
    }),
  );
  expect(op.ClusterOperationInfo?.OperationType).toBe("UPDATE_BROKER_COUNT");
  expect(op.ClusterOperationInfo?.OperationState).toBe("UPDATE_COMPLETE");

  const reDescribed = await client.send(
    new DescribeClusterCommand({ ClusterArn: created.ClusterArn! }),
  );
  expect(reDescribed.ClusterInfo?.NumberOfBrokerNodes).toBe(6);
});

test("MSK Configuration CRUD + revision", async () => {
  const client = kafka();
  const configName = `bunsai-cfg-${Date.now()}`;
  const serverProperties = Buffer.from(
    "auto.create.topics.enable=true\ndefault.replication.factor=3",
  );

  const created = await client.send(
    new CreateConfigurationCommand({
      Name: configName,
      ServerProperties: serverProperties,
      KafkaVersions: ["2.8.1"],
      Description: "initial config",
    }),
  );
  expect(created.Arn).toContain(`configuration/${configName}`);
  expect(created.LatestRevision?.Revision).toBe(1);
  expect(created.Name).toBe(configName);

  const described = await client.send(
    new DescribeConfigurationCommand({ Arn: created.Arn! }),
  );
  expect(described.Name).toBe(configName);
  expect(described.LatestRevision?.Revision).toBe(1);

  const listed = await client.send(new ListConfigurationsCommand({}));
  expect(listed.Configurations?.some((c) => c.Name === configName)).toBe(true);

  const updated = await client.send(
    new UpdateConfigurationCommand({
      Arn: created.Arn!,
      ServerProperties: Buffer.from("auto.create.topics.enable=false"),
      Description: "v2 config",
    }),
  );
  expect(updated.LatestRevision?.Revision).toBe(2);

  const revisions = await client.send(
    new ListConfigurationRevisionsCommand({ Arn: created.Arn! }),
  );
  expect(revisions.Revisions?.length).toBe(2);

  const rev1 = await client.send(
    new DescribeConfigurationRevisionCommand({
      Arn: created.Arn!,
      Revision: 1,
    }),
  );
  expect(rev1.Revision).toBe(1);

  const deleted = await client.send(
    new DeleteConfigurationCommand({ Arn: created.Arn! }),
  );
  expect(deleted.State).toBe("DELETING");
});

test("MSK CreateClusterV2 PROVISIONED + DescribeClusterV2", async () => {
  const client = kafka();
  const clusterName = `bunsai-v2-${Date.now()}`;

  const created = await client.send(
    new CreateClusterV2Command({
      ClusterName: clusterName,
      Provisioned: {
        KafkaVersion: "3.4.0",
        NumberOfBrokerNodes: 3,
        BrokerNodeGroupInfo: {
          InstanceType: "kafka.m5.large",
          ClientSubnets: ["subnet-aaaa", "subnet-bbbb", "subnet-cccc"],
        },
      },
    }),
  );
  expect(created.ClusterArn).toContain(`cluster/${clusterName}`);
  expect(created.ClusterType).toBe("PROVISIONED");
  expect(created.State).toBe("CREATING");

  const described = await client.send(
    new DescribeClusterV2Command({ ClusterArn: created.ClusterArn! }),
  );
  expect(described.ClusterInfo?.ClusterName).toBe(clusterName);
  expect(described.ClusterInfo?.ClusterType).toBe("PROVISIONED");
  expect(described.ClusterInfo?.State).toBe("ACTIVE");

  const listedV2 = await client.send(new ListClustersV2Command({}));
  expect(
    listedV2.ClusterInfoList?.some((c) => c.ClusterName === clusterName),
  ).toBe(true);
});

test("MSK UpdateClusterConfiguration links to cluster operation", async () => {
  const client = kafka();
  const clusterName = `bunsai-cfgupd-${Date.now()}`;
  const configName = `bunsai-cfgupd-cfg-${Date.now()}`;

  const cfg = await client.send(
    new CreateConfigurationCommand({
      Name: configName,
      ServerProperties: Buffer.from("auto.create.topics.enable=true"),
    }),
  );

  const cluster = await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      KafkaVersion: "2.8.1",
      NumberOfBrokerNodes: 3,
      BrokerNodeGroupInfo: {
        InstanceType: "kafka.m5.large",
        ClientSubnets: ["subnet-aaaa", "subnet-bbbb", "subnet-cccc"],
      },
    }),
  );

  const desc = await client.send(
    new DescribeClusterCommand({ ClusterArn: cluster.ClusterArn! }),
  );

  const result = await client.send(
    new UpdateClusterConfigurationCommand({
      ClusterArn: cluster.ClusterArn!,
      CurrentVersion: desc.ClusterInfo!.CurrentVersion!,
      ConfigurationInfo: {
        Arn: cfg.Arn!,
        Revision: 1,
      },
    }),
  );
  expect(result.ClusterArn).toBe(cluster.ClusterArn);
  expect(result.ClusterOperationArn).toBeDefined();
});

test("KAFKA-01: topic lifecycle (create/list/describe/update/delete)", async () => {
  const client = kafka();
  const clusterName = `bunsai-topic-${Date.now()}`;

  const cluster = await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      KafkaVersion: "2.8.1",
      NumberOfBrokerNodes: 3,
      BrokerNodeGroupInfo: {
        InstanceType: "kafka.m5.large",
        ClientSubnets: ["subnet-aaaa", "subnet-bbbb", "subnet-cccc"],
      },
    }),
  );
  const clusterArn = cluster.ClusterArn!;

  const created = await client.send(
    new CreateTopicCommand({
      ClusterArn: clusterArn,
      TopicName: "t1",
      PartitionCount: 3,
      ReplicationFactor: 2,
    }),
  );
  expect(created.TopicName).toBe("t1");
  expect(created.TopicArn).toContain("t1");
  expect(created.Status).toBe("ACTIVE");

  const listed = await client.send(
    new ListTopicsCommand({ ClusterArn: clusterArn }),
  );
  expect(listed.Topics?.length).toBe(1);
  expect(listed.Topics![0].TopicName).toBe("t1");
  expect(listed.Topics![0].PartitionCount).toBe(3);

  const described = await client.send(
    new DescribeTopicCommand({ ClusterArn: clusterArn, TopicName: "t1" }),
  );
  expect(described.TopicName).toBe("t1");
  expect(described.ReplicationFactor).toBe(2);
  expect(described.PartitionCount).toBe(3);

  await expect(
    client.send(
      new CreateTopicCommand({
        ClusterArn: clusterArn,
        TopicName: "t1",
        PartitionCount: 1,
        ReplicationFactor: 1,
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteTopicCommand({
      ClusterArn: clusterArn,
      TopicName: "t1",
    }),
  );

  await expect(
    client.send(
      new DescribeTopicCommand({ ClusterArn: clusterArn, TopicName: "t1" }),
    ),
  ).rejects.toThrow();
});

test("KAFKA-02: RejectClientVpcConnection sets REJECTED state", async () => {
  const client = kafka();
  const clusterName = `bunsai-vpc-${Date.now()}`;

  const cluster = await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      KafkaVersion: "2.8.1",
      NumberOfBrokerNodes: 3,
      BrokerNodeGroupInfo: {
        InstanceType: "kafka.m5.large",
        ClientSubnets: ["subnet-aaaa", "subnet-bbbb", "subnet-cccc"],
      },
    }),
  );
  const clusterArn = cluster.ClusterArn!;
  await client.send(new DescribeClusterCommand({ ClusterArn: clusterArn }));

  const vpc = await client.send(
    new CreateVpcConnectionCommand({
      TargetClusterArn: clusterArn,
      Authentication: "SASL_IAM",
      VpcId: "vpc-00000001",
      ClientSubnets: ["subnet-aaaa"],
      SecurityGroups: ["sg-00000001"],
    }),
  );
  expect(vpc.State).toBe("AVAILABLE");

  await client.send(
    new RejectClientVpcConnectionCommand({
      ClusterArn: clusterArn,
      VpcConnectionArn: vpc.VpcConnectionArn!,
    }),
  );

  const listed = await client.send(
    new ListClientVpcConnectionsCommand({ ClusterArn: clusterArn }),
  );
  const found = listed.ClientVpcConnections?.find(
    (c) => c.VpcConnectionArn === vpc.VpcConnectionArn,
  );
  expect(found?.State).toBe("REJECTED");

  const described = await client.send(
    new DescribeVpcConnectionCommand({ Arn: vpc.VpcConnectionArn! }),
  );
  expect(described.State).toBe("REJECTED");
});

test("KAFKA-03: UpdateReplicationInfo persists to DescribeReplicator", async () => {
  const client = kafka();
  const clusterName1 = `bunsai-src-${Date.now()}`;
  const clusterName2 = `bunsai-tgt-${Date.now()}`;

  const src = await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName1,
      KafkaVersion: "2.8.1",
      NumberOfBrokerNodes: 3,
      BrokerNodeGroupInfo: {
        InstanceType: "kafka.m5.large",
        ClientSubnets: ["subnet-aaaa", "subnet-bbbb", "subnet-cccc"],
      },
    }),
  );
  const tgt = await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName2,
      KafkaVersion: "2.8.1",
      NumberOfBrokerNodes: 3,
      BrokerNodeGroupInfo: {
        InstanceType: "kafka.m5.large",
        ClientSubnets: ["subnet-aaaa", "subnet-bbbb", "subnet-cccc"],
      },
    }),
  );

  const replicator = await client.send(
    new CreateReplicatorCommand({
      ReplicatorName: `rep-${Date.now()}`,
      KafkaClusters: [
        {
          AmazonMskCluster: { MskClusterArn: src.ClusterArn! },
          VpcConfig: { SubnetIds: ["subnet-aaaa"], SecurityGroupIds: ["sg-1"] },
        },
        {
          AmazonMskCluster: { MskClusterArn: tgt.ClusterArn! },
          VpcConfig: { SubnetIds: ["subnet-bbbb"], SecurityGroupIds: ["sg-2"] },
        },
      ],
      ReplicationInfoList: [
        {
          SourceKafkaClusterArn: src.ClusterArn!,
          TargetKafkaClusterArn: tgt.ClusterArn!,
          TopicReplication: { TopicsToReplicate: ["a"] },
          ConsumerGroupReplication: { ConsumerGroupsToReplicate: ["cg1"] },
          TargetCompressionType: "NONE",
        },
      ],
      ServiceExecutionRoleArn: "arn:aws:iam::123456789012:role/test",
    }),
  );

  await client.send(
    new UpdateReplicationInfoCommand({
      ReplicatorArn: replicator.ReplicatorArn!,
      SourceKafkaClusterArn: src.ClusterArn!,
      TargetKafkaClusterArn: tgt.ClusterArn!,
      TopicReplication: {
        TopicsToReplicate: ["a", "b"],
        TopicsToExclude: [],
        CopyTopicConfigurations: true,
        DetectAndCopyNewTopics: false,
        CopyAccessControlListsForTopics: false,
      },
      ConsumerGroupReplication: {
        ConsumerGroupsToReplicate: ["cg1"],
        ConsumerGroupsToExclude: [],
        SynchroniseConsumerGroupOffsets: false,
        DetectAndCopyNewConsumerGroups: false,
      },
      CurrentVersion: "1",
    }),
  );

  const desc = await client.send(
    new DescribeReplicatorCommand({ ReplicatorArn: replicator.ReplicatorArn! }),
  );
  const info = desc.ReplicationInfoList?.[0];
  expect(info?.TopicReplication?.TopicsToReplicate).toContain("b");
});

test("KAFKA-04: CurrentVersion mismatch rejects Update*", async () => {
  const client = kafka();
  const clusterName = `bunsai-cv-${Date.now()}`;

  const cluster = await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      KafkaVersion: "2.8.1",
      NumberOfBrokerNodes: 3,
      BrokerNodeGroupInfo: {
        InstanceType: "kafka.m5.large",
        ClientSubnets: ["subnet-aaaa", "subnet-bbbb", "subnet-cccc"],
      },
    }),
  );
  await client.send(
    new DescribeClusterCommand({ ClusterArn: cluster.ClusterArn! }),
  );

  await expect(
    client.send(
      new UpdateBrokerCountCommand({
        ClusterArn: cluster.ClusterArn!,
        CurrentVersion: "wrong-version",
        TargetNumberOfBrokerNodes: 6,
      }),
    ),
  ).rejects.toThrow();
});

test("KAFKA-05: DeleteConfiguration blocked when in use", async () => {
  const client = kafka();
  const configName = `bunsai-cfgdel-${Date.now()}`;
  const clusterName = `bunsai-cfgdel-cl-${Date.now()}`;

  const cfg = await client.send(
    new CreateConfigurationCommand({
      Name: configName,
      ServerProperties: Buffer.from("auto.create.topics.enable=true"),
    }),
  );

  const cluster = await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      KafkaVersion: "2.8.1",
      NumberOfBrokerNodes: 3,
      BrokerNodeGroupInfo: {
        InstanceType: "kafka.m5.large",
        ClientSubnets: ["subnet-aaaa", "subnet-bbbb", "subnet-cccc"],
      },
      ConfigurationInfo: { Arn: cfg.Arn!, Revision: 1 },
    }),
  );
  await client.send(
    new DescribeClusterCommand({ ClusterArn: cluster.ClusterArn! }),
  );

  await expect(
    client.send(new DeleteConfigurationCommand({ Arn: cfg.Arn! })),
  ).rejects.toThrow();
});

test("KAFKA-06: CreateVpcConnection requires valid cluster + consistent state", async () => {
  const client = kafka();
  const clusterName = `bunsai-vpcstate-${Date.now()}`;

  const cluster = await client.send(
    new CreateClusterCommand({
      ClusterName: clusterName,
      KafkaVersion: "2.8.1",
      NumberOfBrokerNodes: 3,
      BrokerNodeGroupInfo: {
        InstanceType: "kafka.m5.large",
        ClientSubnets: ["subnet-aaaa", "subnet-bbbb", "subnet-cccc"],
      },
    }),
  );
  await client.send(
    new DescribeClusterCommand({ ClusterArn: cluster.ClusterArn! }),
  );

  await expect(
    client.send(
      new CreateVpcConnectionCommand({
        TargetClusterArn:
          "arn:aws:kafka:us-east-1:123456789012:cluster/nonexistent/fake",
        Authentication: "SASL_IAM",
        VpcId: "vpc-00000001",
        ClientSubnets: ["subnet-aaaa"],
        SecurityGroups: ["sg-00000001"],
      }),
    ),
  ).rejects.toThrow();

  const vpc = await client.send(
    new CreateVpcConnectionCommand({
      TargetClusterArn: cluster.ClusterArn!,
      Authentication: "SASL_IAM",
      VpcId: "vpc-00000001",
      ClientSubnets: ["subnet-aaaa"],
      SecurityGroups: ["sg-00000001"],
    }),
  );
  expect(vpc.State).toBe("AVAILABLE");

  const described = await client.send(
    new DescribeVpcConnectionCommand({ Arn: vpc.VpcConnectionArn! }),
  );
  expect(described.State).toBe("AVAILABLE");
});

test("KAFKA-08: V2 cluster operation response has startTime and clusterType", async () => {
  const client = kafka();
  const clusterName = `bunsai-v2op-${Date.now()}`;

  const cluster = await client.send(
    new CreateClusterV2Command({
      ClusterName: clusterName,
      Provisioned: {
        KafkaVersion: "2.8.1",
        NumberOfBrokerNodes: 3,
        BrokerNodeGroupInfo: {
          InstanceType: "kafka.m5.large",
          ClientSubnets: ["subnet-aaaa", "subnet-bbbb", "subnet-cccc"],
        },
      },
    }),
  );
  const desc = await client.send(
    new DescribeClusterV2Command({ ClusterArn: cluster.ClusterArn! }),
  );
  const currentVersion = desc.ClusterInfo?.CurrentVersion!;

  const updated = await client.send(
    new UpdateBrokerCountCommand({
      ClusterArn: cluster.ClusterArn!,
      CurrentVersion: currentVersion,
      TargetNumberOfBrokerNodes: 6,
    }),
  );

  const ops = await client.send(
    new ListClusterOperationsV2Command({ ClusterArn: cluster.ClusterArn! }),
  );
  expect(ops.ClusterOperationInfoList?.length).toBeGreaterThan(0);
  const op = ops.ClusterOperationInfoList![0] as Record<string, unknown>;
  expect(op["StartTime"]).toBeDefined();
  expect(op["ClusterType"]).toBe("PROVISIONED");

  const opV2 = await client.send(
    new DescribeClusterOperationV2Command({
      ClusterOperationArn: updated.ClusterOperationArn!,
    }),
  );
  const info = opV2.ClusterOperationInfo as Record<string, unknown> | undefined;
  expect(info?.["StartTime"]).toBeDefined();
  expect(info?.["ClusterType"]).toBe("PROVISIONED");
});
