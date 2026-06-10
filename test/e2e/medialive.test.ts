import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  UpdateMultiplexProgramCommand,
  CloudWatchAlarmTemplateComparisonOperator,
  CloudWatchAlarmTemplateStatistic,
  CloudWatchAlarmTemplateTargetResourceType,
  CreateChannelCommand,
  CreateChannelPlacementGroupCommand,
  CreateCloudWatchAlarmTemplateCommand,
  CreateClusterCommand,
  CreateCloudWatchAlarmTemplateGroupCommand,
  CreateEventBridgeRuleTemplateCommand,
  CreateEventBridgeRuleTemplateGroupCommand,
  CreateInputCommand,
  CreateInputSecurityGroupCommand,
  CreateMultiplexCommand,
  CreateMultiplexProgramCommand,
  CreateNodeCommand,
  CreateNodeRegistrationScriptCommand,
  CreateSdiSourceCommand,
  CreateSignalMapCommand,
  DeleteChannelCommand,
  DeleteChannelPlacementGroupCommand,
  DeleteCloudWatchAlarmTemplateCommand,
  DeleteCloudWatchAlarmTemplateGroupCommand,
  DeleteClusterCommand,
  DeleteEventBridgeRuleTemplateCommand,
  DeleteEventBridgeRuleTemplateGroupCommand,
  DeleteInputCommand,
  DeleteInputSecurityGroupCommand,
  DeleteMultiplexCommand,
  DeleteMultiplexProgramCommand,
  DeleteNodeCommand,
  DeleteReservationCommand,
  DeleteSdiSourceCommand,
  DeleteSignalMapCommand,
  DescribeChannelCommand,
  DescribeChannelPlacementGroupCommand,
  DescribeClusterCommand,
  DescribeInputCommand,
  DescribeInputSecurityGroupCommand,
  DescribeMultiplexCommand,
  DescribeMultiplexProgramCommand,
  DescribeNodeCommand,
  DescribeReservationCommand,
  DescribeSdiSourceCommand,
  EventBridgeRuleTemplateEventType,
  GetCloudWatchAlarmTemplateCommand,
  GetCloudWatchAlarmTemplateGroupCommand,
  GetEventBridgeRuleTemplateCommand,
  GetEventBridgeRuleTemplateGroupCommand,
  GetSignalMapCommand,
  ListAlertsCommand,
  ListChannelPlacementGroupsCommand,
  ListChannelsCommand,
  ListCloudWatchAlarmTemplateGroupsCommand,
  ListCloudWatchAlarmTemplatesCommand,
  ListClustersCommand,
  ListEventBridgeRuleTemplateGroupsCommand,
  ListEventBridgeRuleTemplatesCommand,
  ListInputSecurityGroupsCommand,
  ListInputsCommand,
  ListMultiplexAlertsCommand,
  ListMultiplexProgramsCommand,
  ListMultiplexesCommand,
  ListNodesCommand,
  ListOfferingsCommand,
  ListReservationsCommand,
  ListSdiSourcesCommand,
  ListSignalMapsCommand,
  ListVersionsCommand,
  MediaLiveClient,
  NodeRole,
  PurchaseOfferingCommand,
  SdiSourceMode,
  SdiSourceType,
  StartDeleteMonitorDeploymentCommand,
  StartMonitorDeploymentCommand,
  StartUpdateSignalMapCommand,
  UpdateChannelPlacementGroupCommand,
  UpdateCloudWatchAlarmTemplateCommand,
  UpdateCloudWatchAlarmTemplateGroupCommand,
  UpdateClusterCommand,
  UpdateEventBridgeRuleTemplateCommand,
  UpdateEventBridgeRuleTemplateGroupCommand,
  UpdateNetworkCommand,
  UpdateNodeCommand,
  UpdateNodeStateCommand,
  UpdateSdiSourceCommand,
  CreateNetworkCommand,
  DeleteNetworkCommand,
  DescribeNetworkCommand,
  ListNetworksCommand,
  ListTagsForResourceCommand,
  StartChannelCommand,
  StopChannelCommand,
  StartMultiplexCommand,
  StopMultiplexCommand,
  TimecodeConfigSource,
} from "@aws-sdk/client-medialive";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const medialive = () =>
  new MediaLiveClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("MediaLive channel roundtrip", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateChannelCommand({ Name: "bunsai-e2e-channel" }),
  );
  const id = created.Channel?.Id;
  expect(id).toBeDefined();
  expect(created.Channel?.Arn).toBeDefined();
  expect(created.Channel?.Name).toBe("bunsai-e2e-channel");
  expect(created.Channel?.State).toBe("IDLE");

  const described = await client.send(
    new DescribeChannelCommand({ ChannelId: id }),
  );
  expect(described.Id).toBe(id);
  expect(described.Name).toBe("bunsai-e2e-channel");

  const listed = await client.send(new ListChannelsCommand({}));
  expect((listed.Channels ?? []).map((c) => c.Id)).toContain(id);

  const deleted = await client.send(
    new DeleteChannelCommand({ ChannelId: id }),
  );
  expect(deleted.State).toBe("DELETING");

  await expect(
    client.send(new DescribeChannelCommand({ ChannelId: id })),
  ).rejects.toThrow();
});

test("MediaLive input lifecycle", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateInputCommand({ Name: "bunsai-e2e-input", Type: "UDP_PUSH" }),
  );
  const id = created.Input?.Id;
  expect(id).toBeDefined();
  expect(created.Input?.Arn).toBeDefined();
  expect(created.Input?.Name).toBe("bunsai-e2e-input");
  expect(created.Input?.State).toBe("DETACHED");
  expect(created.Input?.Type).toBe("UDP_PUSH");

  const described = await client.send(
    new DescribeInputCommand({ InputId: id }),
  );
  expect(described.Id).toBe(id);
  expect(described.Name).toBe("bunsai-e2e-input");

  const listed = await client.send(new ListInputsCommand({}));
  expect((listed.Inputs ?? []).map((i) => i.Id)).toContain(id);

  await client.send(new DeleteInputCommand({ InputId: id }));

  await expect(
    client.send(new DescribeInputCommand({ InputId: id })),
  ).rejects.toThrow();
});

test("MediaLive input security group lifecycle", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateInputSecurityGroupCommand({
      WhitelistRules: [{ Cidr: "10.0.0.0/8" }],
    }),
  );
  const id = created.SecurityGroup?.Id;
  expect(id).toBeDefined();
  expect(created.SecurityGroup?.Arn).toBeDefined();
  expect(created.SecurityGroup?.State).toBe("IDLE");

  const described = await client.send(
    new DescribeInputSecurityGroupCommand({ InputSecurityGroupId: id }),
  );
  expect(described.Id).toBe(id);
  expect(described.WhitelistRules).toHaveLength(1);

  const listed = await client.send(new ListInputSecurityGroupsCommand({}));
  expect((listed.InputSecurityGroups ?? []).map((g) => g.Id)).toContain(id);

  await client.send(
    new DeleteInputSecurityGroupCommand({ InputSecurityGroupId: id }),
  );

  await expect(
    client.send(
      new DescribeInputSecurityGroupCommand({ InputSecurityGroupId: id }),
    ),
  ).rejects.toThrow();
});

test("MediaLive multiplex and program lifecycle", async () => {
  const client = medialive();

  const mxCreated = await client.send(
    new CreateMultiplexCommand({
      Name: "bunsai-e2e-multiplex",
      AvailabilityZones: ["us-east-1a", "us-east-1b"],
      MultiplexSettings: {
        TransportStreamBitrate: 1000000,
        TransportStreamId: 1,
      },
      RequestId: "req-123",
    }),
  );
  const mxId = mxCreated.Multiplex?.Id;
  expect(mxId).toBeDefined();
  expect(mxCreated.Multiplex?.Arn).toBeDefined();
  expect(mxCreated.Multiplex?.Name).toBe("bunsai-e2e-multiplex");
  expect(mxCreated.Multiplex?.State).toBe("IDLE");

  const mxDescribed = await client.send(
    new DescribeMultiplexCommand({ MultiplexId: mxId }),
  );
  expect(mxDescribed.Id).toBe(mxId);

  const progCreated = await client.send(
    new CreateMultiplexProgramCommand({
      MultiplexId: mxId,
      ProgramName: "e2e-program",
      MultiplexProgramSettings: {
        ProgramNumber: 1,
        ServiceDescriptor: { ProviderName: "test", ServiceName: "e2e" },
        VideoSettings: { ConstantBitrate: 500000 },
      },
      RequestId: "req-prog-1",
    }),
  );
  expect(progCreated.MultiplexProgram?.ProgramName).toBe("e2e-program");

  const progDescribed = await client.send(
    new DescribeMultiplexProgramCommand({
      MultiplexId: mxId,
      ProgramName: "e2e-program",
    }),
  );
  expect(progDescribed.ProgramName).toBe("e2e-program");

  const progListed = await client.send(
    new ListMultiplexProgramsCommand({ MultiplexId: mxId }),
  );
  expect(
    (progListed.MultiplexPrograms ?? []).map((p) => p.ProgramName),
  ).toContain("e2e-program");

  await client.send(
    new DeleteMultiplexProgramCommand({
      MultiplexId: mxId,
      ProgramName: "e2e-program",
    }),
  );

  const mxListed = await client.send(new ListMultiplexesCommand({}));
  expect((mxListed.Multiplexes ?? []).map((m) => m.Id)).toContain(mxId);

  await client.send(new DeleteMultiplexCommand({ MultiplexId: mxId }));

  await expect(
    client.send(new DescribeMultiplexCommand({ MultiplexId: mxId })),
  ).rejects.toThrow();
});

test("MediaLive reservation and offering lifecycle", async () => {
  const client = medialive();

  const offerings = await client.send(new ListOfferingsCommand({}));
  expect((offerings.Offerings ?? []).length).toBeGreaterThan(0);
  const offeringId = offerings.Offerings![0].OfferingId!;
  expect(offeringId).toBeDefined();

  const purchased = await client.send(
    new PurchaseOfferingCommand({
      OfferingId: offeringId,
      Count: 1,
      Name: "bunsai-e2e-reservation",
    }),
  );
  const reservationId = purchased.Reservation?.ReservationId;
  expect(reservationId).toBeDefined();
  expect(purchased.Reservation?.State).toBe("ACTIVE");
  expect(purchased.Reservation?.OfferingId).toBe(offeringId);

  const described = await client.send(
    new DescribeReservationCommand({ ReservationId: reservationId }),
  );
  expect(described.ReservationId).toBe(reservationId);

  const listed = await client.send(new ListReservationsCommand({}));
  expect((listed.Reservations ?? []).map((r) => r.ReservationId)).toContain(
    reservationId,
  );

  const deleted = await client.send(
    new DeleteReservationCommand({ ReservationId: reservationId }),
  );
  expect(deleted.State).toBe("CANCELED");

  await expect(
    client.send(
      new DescribeReservationCommand({ ReservationId: reservationId }),
    ),
  ).rejects.toThrow();
});

test("MediaLive CloudWatch alarm template group and template lifecycle", async () => {
  const client = medialive();

  const grpCreated = await client.send(
    new CreateCloudWatchAlarmTemplateGroupCommand({
      Name: "e2e-cw-group",
      Description: "e2e test group",
    }),
  );
  const grpId = grpCreated.Id;
  expect(grpId).toBeDefined();
  expect(grpCreated.Arn).toBeDefined();
  expect(grpCreated.Name).toBe("e2e-cw-group");

  const grpGot = await client.send(
    new GetCloudWatchAlarmTemplateGroupCommand({ Identifier: grpId! }),
  );
  expect(grpGot.Id).toBe(grpId);

  const grpListed = await client.send(
    new ListCloudWatchAlarmTemplateGroupsCommand({}),
  );
  expect(
    (grpListed.CloudWatchAlarmTemplateGroups ?? []).map((g) => g.Id),
  ).toContain(grpId);

  const grpUpdated = await client.send(
    new UpdateCloudWatchAlarmTemplateGroupCommand({
      Identifier: grpId!,
      Description: "updated",
    }),
  );
  expect(grpUpdated.Id).toBe(grpId);

  const tmplCreated = await client.send(
    new CreateCloudWatchAlarmTemplateCommand({
      Name: "e2e-cw-template",
      GroupIdentifier: grpId!,
      ComparisonOperator:
        CloudWatchAlarmTemplateComparisonOperator.GreaterThanOrEqualToThreshold,
      EvaluationPeriods: 2,
      MetricName: "IngestVideoBitrate",
      Period: 60,
      Statistic: CloudWatchAlarmTemplateStatistic.Sum,
      TargetResourceType:
        CloudWatchAlarmTemplateTargetResourceType.MEDIALIVE_CHANNEL,
      Threshold: 1000,
      TreatMissingData: "breaching",
    }),
  );
  const tmplId = tmplCreated.Id;
  expect(tmplId).toBeDefined();
  expect(tmplCreated.Arn).toBeDefined();
  expect(tmplCreated.GroupId).toBe(grpId);

  const tmplGot = await client.send(
    new GetCloudWatchAlarmTemplateCommand({ Identifier: tmplId! }),
  );
  expect(tmplGot.Id).toBe(tmplId);

  const tmplListed = await client.send(
    new ListCloudWatchAlarmTemplatesCommand({}),
  );
  expect(
    (tmplListed.CloudWatchAlarmTemplates ?? []).map((t) => t.Id),
  ).toContain(tmplId);

  const tmplUpdated = await client.send(
    new UpdateCloudWatchAlarmTemplateCommand({
      Identifier: tmplId!,
      Name: "e2e-cw-template-updated",
    }),
  );
  expect(tmplUpdated.Name).toBe("e2e-cw-template-updated");

  await client.send(
    new DeleteCloudWatchAlarmTemplateCommand({ Identifier: tmplId! }),
  );

  await client.send(
    new DeleteCloudWatchAlarmTemplateGroupCommand({ Identifier: grpId! }),
  );

  await expect(
    client.send(
      new GetCloudWatchAlarmTemplateGroupCommand({ Identifier: grpId! }),
    ),
  ).rejects.toThrow();
});

test("MediaLive EventBridge rule template group and template lifecycle", async () => {
  const client = medialive();

  const grpCreated = await client.send(
    new CreateEventBridgeRuleTemplateGroupCommand({
      Name: "e2e-eb-group",
      Description: "e2e test eb group",
    }),
  );
  const grpId = grpCreated.Id;
  expect(grpId).toBeDefined();
  expect(grpCreated.Arn).toBeDefined();
  expect(grpCreated.Name).toBe("e2e-eb-group");

  const grpGot = await client.send(
    new GetEventBridgeRuleTemplateGroupCommand({ Identifier: grpId! }),
  );
  expect(grpGot.Id).toBe(grpId);

  const grpListed = await client.send(
    new ListEventBridgeRuleTemplateGroupsCommand({}),
  );
  expect(
    (grpListed.EventBridgeRuleTemplateGroups ?? []).map((g) => g.Id),
  ).toContain(grpId);

  const grpUpdated = await client.send(
    new UpdateEventBridgeRuleTemplateGroupCommand({
      Identifier: grpId!,
      Description: "updated eb group",
    }),
  );
  expect(grpUpdated.Id).toBe(grpId);

  const tmplCreated = await client.send(
    new CreateEventBridgeRuleTemplateCommand({
      Name: "e2e-eb-template",
      GroupIdentifier: grpId!,
      EventType:
        EventBridgeRuleTemplateEventType.MEDIALIVE_CHANNEL_STATE_CHANGE,
    }),
  );
  const tmplId = tmplCreated.Id;
  expect(tmplId).toBeDefined();
  expect(tmplCreated.Arn).toBeDefined();
  expect(tmplCreated.GroupId).toBe(grpId);
  expect(tmplCreated.EventType).toBe(
    EventBridgeRuleTemplateEventType.MEDIALIVE_CHANNEL_STATE_CHANGE,
  );

  const tmplGot = await client.send(
    new GetEventBridgeRuleTemplateCommand({ Identifier: tmplId! }),
  );
  expect(tmplGot.Id).toBe(tmplId);

  const tmplListed = await client.send(
    new ListEventBridgeRuleTemplatesCommand({}),
  );
  expect(
    (tmplListed.EventBridgeRuleTemplates ?? []).map((t) => t.Id),
  ).toContain(tmplId);

  const tmplUpdated = await client.send(
    new UpdateEventBridgeRuleTemplateCommand({
      Identifier: tmplId!,
      Name: "e2e-eb-template-updated",
    }),
  );
  expect(tmplUpdated.Name).toBe("e2e-eb-template-updated");

  await client.send(
    new DeleteEventBridgeRuleTemplateCommand({ Identifier: tmplId! }),
  );

  await client.send(
    new DeleteEventBridgeRuleTemplateGroupCommand({ Identifier: grpId! }),
  );

  await expect(
    client.send(
      new GetEventBridgeRuleTemplateGroupCommand({ Identifier: grpId! }),
    ),
  ).rejects.toThrow();
});

test("MediaLive signal map lifecycle", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateSignalMapCommand({
      Name: "e2e-signal-map",
      DiscoveryEntryPointArn:
        "arn:aws:medialive:us-east-1:123456789012:channel:test-entry",
    }),
  );
  const id = created.Id;
  expect(id).toBeDefined();
  expect(created.Arn).toBeDefined();
  expect(created.Name).toBe("e2e-signal-map");
  expect(created.Status).toBeDefined();

  const got = await client.send(new GetSignalMapCommand({ Identifier: id! }));
  expect(got.Id).toBe(id);

  const listed = await client.send(new ListSignalMapsCommand({}));
  expect((listed.SignalMaps ?? []).map((s) => s.Id)).toContain(id);

  const updated = await client.send(
    new StartUpdateSignalMapCommand({
      Identifier: id!,
      Name: "e2e-signal-map-updated",
    }),
  );
  expect(updated.Name).toBe("e2e-signal-map-updated");

  const deployed = await client.send(
    new StartMonitorDeploymentCommand({ Identifier: id! }),
  );
  expect(deployed.Id).toBe(id);

  const undeployed = await client.send(
    new StartDeleteMonitorDeploymentCommand({ Identifier: id! }),
  );
  expect(undeployed.Id).toBe(id);

  await client.send(new DeleteSignalMapCommand({ Identifier: id! }));

  await expect(
    client.send(new GetSignalMapCommand({ Identifier: id! })),
  ).rejects.toThrow();
});

test("MediaLive list versions", async () => {
  const client = medialive();
  const result = await client.send(new ListVersionsCommand({}));
  expect(result.Versions).toBeDefined();
});

test("MediaLive SdiSource lifecycle", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateSdiSourceCommand({
      Name: "e2e-sdi-source",
      Type: SdiSourceType.SINGLE,
      Mode: SdiSourceMode.QUADRANT,
    }),
  );
  const id = created.SdiSource?.Id;
  expect(id).toBeDefined();
  expect(created.SdiSource?.Arn).toBeDefined();
  expect(created.SdiSource?.Name).toBe("e2e-sdi-source");
  expect(created.SdiSource?.State).toBe("IDLE");
  expect(created.SdiSource?.Type).toBe(SdiSourceType.SINGLE);

  const described = await client.send(
    new DescribeSdiSourceCommand({ SdiSourceId: id }),
  );
  expect(described.SdiSource?.Id).toBe(id);
  expect(described.SdiSource?.Name).toBe("e2e-sdi-source");

  const listed = await client.send(new ListSdiSourcesCommand({}));
  expect((listed.SdiSources ?? []).map((s) => s.Id)).toContain(id);

  const updated = await client.send(
    new UpdateSdiSourceCommand({
      SdiSourceId: id,
      Name: "e2e-sdi-source-updated",
    }),
  );
  expect(updated.SdiSource?.Name).toBe("e2e-sdi-source-updated");

  const deleted = await client.send(
    new DeleteSdiSourceCommand({ SdiSourceId: id }),
  );
  expect(deleted.SdiSource?.State).toBe("DELETED");
});

test("MediaLive channel alerts", async () => {
  const client = medialive();

  const ch = await client.send(
    new CreateChannelCommand({ Name: "e2e-alerts-channel" }),
  );
  const channelId = ch.Channel?.Id!;

  const alerts = await client.send(
    new ListAlertsCommand({ ChannelId: channelId }),
  );
  expect(Array.isArray(alerts.Alerts)).toBe(true);

  const mxCreated = await client.send(
    new CreateMultiplexCommand({
      Name: "e2e-alerts-multiplex",
      AvailabilityZones: ["us-east-1a", "us-east-1b"],
      MultiplexSettings: {
        TransportStreamBitrate: 1000000,
        TransportStreamId: 2,
      },
      RequestId: "req-alerts-mx",
    }),
  );
  const mxId = mxCreated.Multiplex?.Id!;

  const mxAlerts = await client.send(
    new ListMultiplexAlertsCommand({ MultiplexId: mxId }),
  );
  expect(Array.isArray(mxAlerts.Alerts)).toBe(true);

  await client.send(new DeleteChannelCommand({ ChannelId: channelId }));
  await client.send(new DeleteMultiplexCommand({ MultiplexId: mxId }));
});

test("MediaLive ChannelPlacementGroup lifecycle", async () => {
  const client = medialive();

  const clusterId = "test-cluster-id";

  const created = await client.send(
    new CreateChannelPlacementGroupCommand({
      ClusterId: clusterId,
      Name: "e2e-placement-group",
      Nodes: [],
    }),
  );
  const id = created.Id;
  expect(id).toBeDefined();
  expect(created.Arn).toBeDefined();
  expect(created.Name).toBe("e2e-placement-group");
  expect(created.State).toBe("UNASSIGNED");
  expect(created.ClusterId).toBe(clusterId);

  const described = await client.send(
    new DescribeChannelPlacementGroupCommand({
      ClusterId: clusterId,
      ChannelPlacementGroupId: id,
    }),
  );
  expect(described.Id).toBe(id);
  expect(described.Name).toBe("e2e-placement-group");

  const listed = await client.send(
    new ListChannelPlacementGroupsCommand({ ClusterId: clusterId }),
  );
  expect((listed.ChannelPlacementGroups ?? []).map((g) => g.Id)).toContain(id);

  const updated = await client.send(
    new UpdateChannelPlacementGroupCommand({
      ClusterId: clusterId,
      ChannelPlacementGroupId: id,
      Name: "e2e-placement-group-updated",
    }),
  );
  expect(updated.Name).toBe("e2e-placement-group-updated");

  const deleted = await client.send(
    new DeleteChannelPlacementGroupCommand({
      ClusterId: clusterId,
      ChannelPlacementGroupId: id,
    }),
  );
  expect(deleted.State).toBe("DELETED");

  await expect(
    client.send(
      new DescribeChannelPlacementGroupCommand({
        ClusterId: clusterId,
        ChannelPlacementGroupId: id,
      }),
    ),
  ).rejects.toThrow();
});

test("cluster + node lifecycle", async () => {
  const client = medialive();
  const cluster = await client.send(
    new CreateClusterCommand({
      Name: "e2e-cluster",
      ClusterType: "ON_PREMISES",
    }),
  );
  const clusterId = cluster.Id!;
  expect(clusterId).toBeDefined();
  expect(cluster.Arn).toBeDefined();
  expect(cluster.Name).toBe("e2e-cluster");
  expect(cluster.State).toBe("ACTIVE");

  const described = await client.send(
    new DescribeClusterCommand({ ClusterId: clusterId }),
  );
  expect(described.Id).toBe(clusterId);

  const listed = await client.send(new ListClustersCommand({}));
  expect((listed.Clusters ?? []).map((c) => c.Id)).toContain(clusterId);

  const updated = await client.send(
    new UpdateClusterCommand({ ClusterId: clusterId, Name: "e2e-cluster-v2" }),
  );
  expect(updated.Name).toBe("e2e-cluster-v2");

  const script = await client.send(
    new CreateNodeRegistrationScriptCommand({ ClusterId: clusterId }),
  );
  expect(script.NodeRegistrationScript).toBeDefined();

  const node = await client.send(
    new CreateNodeCommand({
      ClusterId: clusterId,
      Name: "e2e-node",
      Role: NodeRole.BACKUP,
    }),
  );
  const nodeId = node.Id!;
  expect(nodeId).toBeDefined();
  expect(node.Arn).toBeDefined();
  expect(node.ClusterId).toBe(clusterId);
  expect(node.State).toBe("CREATED");

  const describedNode = await client.send(
    new DescribeNodeCommand({ ClusterId: clusterId, NodeId: nodeId }),
  );
  expect(describedNode.Id).toBe(nodeId);

  const listedNodes = await client.send(
    new ListNodesCommand({ ClusterId: clusterId }),
  );
  expect((listedNodes.Nodes ?? []).map((n) => n.Id)).toContain(nodeId);

  const updatedNode = await client.send(
    new UpdateNodeCommand({
      ClusterId: clusterId,
      NodeId: nodeId,
      Name: "e2e-node-v2",
      Role: NodeRole.ACTIVE,
    }),
  );
  expect(updatedNode.Name).toBe("e2e-node-v2");
  expect(updatedNode.Role).toBe(NodeRole.ACTIVE);

  const stateNode = await client.send(
    new UpdateNodeStateCommand({
      ClusterId: clusterId,
      NodeId: nodeId,
      State: "DRAINING",
    }),
  );
  expect(stateNode.State).toBe("DRAINING");

  const deletedNode = await client.send(
    new DeleteNodeCommand({ ClusterId: clusterId, NodeId: nodeId }),
  );
  expect(deletedNode.State as string).toBe("DELETED");

  const deletedCluster = await client.send(
    new DeleteClusterCommand({ ClusterId: clusterId }),
  );
  expect(deletedCluster.State).toBe("DELETED");

  await expect(
    client.send(new DescribeClusterCommand({ ClusterId: clusterId })),
  ).rejects.toThrow();
});

test("network lifecycle", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateNetworkCommand({
      Name: "e2e-network",
      IpPools: [{ Cidr: "10.0.0.0/24" }],
      Routes: [{ Cidr: "0.0.0.0/0", Gateway: "10.0.0.1" }],
    }),
  );
  const networkId = created.Id!;
  expect(networkId).toBeDefined();
  expect(created.Arn).toBeDefined();
  expect(created.Name).toBe("e2e-network");
  expect(created.State).toBe("ACTIVE");
  expect(created.IpPools).toHaveLength(1);
  expect(created.Routes).toHaveLength(1);

  const described = await client.send(
    new DescribeNetworkCommand({ NetworkId: networkId }),
  );
  expect(described.Id).toBe(networkId);
  expect(described.Name).toBe("e2e-network");

  const listed = await client.send(new ListNetworksCommand({}));
  expect((listed.Networks ?? []).map((n) => n.Id)).toContain(networkId);

  const updated = await client.send(
    new UpdateNetworkCommand({
      NetworkId: networkId,
      Name: "e2e-network-v2",
    }),
  );
  expect(updated.Name).toBe("e2e-network-v2");

  const deleted = await client.send(
    new DeleteNetworkCommand({ NetworkId: networkId }),
  );
  expect(deleted.State).toBe("DELETED");

  await expect(
    client.send(new DescribeNetworkCommand({ NetworkId: networkId })),
  ).rejects.toThrow();
});

test("ListChannels pagination", async () => {
  const client = medialive();

  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const created = await client.send(
      new CreateChannelCommand({ Name: `e2e-page-channel-${i}` }),
    );
    ids.push(created.Channel!.Id!);
  }

  const page1 = await client.send(new ListChannelsCommand({ MaxResults: 2 }));
  expect((page1.Channels ?? []).length).toBeGreaterThanOrEqual(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new ListChannelsCommand({ MaxResults: 2, NextToken: page1.NextToken }),
  );
  expect((page2.Channels ?? []).length).toBeGreaterThanOrEqual(1);

  const allIds = [
    ...(page1.Channels ?? []).map((c) => c.Id),
    ...(page2.Channels ?? []).map((c) => c.Id),
  ];
  for (const id of ids) {
    expect(allIds).toContain(id);
  }

  for (const id of ids) {
    await client.send(new DeleteChannelCommand({ ChannelId: id }));
  }
});

test("ListAlerts ChannelId filter and persistence", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateChannelCommand({ Name: "e2e-alerts-channel" }),
  );
  const channelId = created.Channel!.Id!;

  const alerts = await client.send(
    new ListAlertsCommand({ ChannelId: channelId }),
  );
  expect((alerts.Alerts ?? []).length).toBeGreaterThan(0);
  const alertTypes = (alerts.Alerts ?? []).map((a) => a.AlertType);
  expect(alertTypes).toContain("RESOURCE_CREATED");

  await client.send(new DeleteChannelCommand({ ChannelId: channelId }));
});

test("HIGH-1: RequestId idempotency on CreateChannel", async () => {
  const client = medialive();

  const r1 = await client.send(
    new CreateChannelCommand({ Name: "idem-ch", RequestId: "req-idem-ch-1" }),
  );
  const r2 = await client.send(
    new CreateChannelCommand({ Name: "idem-ch", RequestId: "req-idem-ch-1" }),
  );
  expect(r1.Channel?.Id).toBe(r2.Channel?.Id);

  const listed = await client.send(new ListChannelsCommand({}));
  const matching = (listed.Channels ?? []).filter(
    (c) => c.Id === r1.Channel?.Id,
  );
  expect(matching).toHaveLength(1);

  await client.send(new DeleteChannelCommand({ ChannelId: r1.Channel!.Id! }));
});

test("HIGH-2: Tags round-trip and ARN validation", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateChannelCommand({
      Name: "tags-ch",
      Tags: { env: "dev", team: "bunsai" },
    }),
  );
  const arn = created.Channel!.Arn!;
  const id = created.Channel!.Id!;

  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(tags.Tags?.["env"]).toBe("dev");
  expect(tags.Tags?.["team"]).toBe("bunsai");

  await client.send(new DeleteChannelCommand({ ChannelId: id }));

  await expect(
    client.send(new ListTagsForResourceCommand({ ResourceArn: arn })),
  ).rejects.toThrow();

  await expect(
    client.send(
      new ListTagsForResourceCommand({
        ResourceArn: "arn:aws:medialive:us-east-1:000000000000:channel:999",
      }),
    ),
  ).rejects.toThrow();
});

test("HIGH-3: Channel state machine guards", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateChannelCommand({ Name: "state-ch" }),
  );
  const id = created.Channel!.Id!;

  const starting = await client.send(
    new StartChannelCommand({ ChannelId: id }),
  );
  expect(starting.State).toBe("STARTING");

  await expect(
    client.send(new DeleteChannelCommand({ ChannelId: id })),
  ).rejects.toThrow();

  const running = await client.send(
    new DescribeChannelCommand({ ChannelId: id }),
  );
  expect(running.State).toBe("RUNNING");

  await client.send(new StopChannelCommand({ ChannelId: id }));

  const described = await client.send(
    new DescribeChannelCommand({ ChannelId: id }),
  );
  expect(described.State).toBe("IDLE");

  await client.send(new DeleteChannelCommand({ ChannelId: id }));
});

test("HIGH-4: Channel config persistence", async () => {
  const client = medialive();

  const encoderSettings = {
    AudioDescriptions: [],
    OutputGroups: [],
    TimecodeConfig: { Source: TimecodeConfigSource.EMBEDDED },
    VideoDescriptions: [],
  };

  const created = await client.send(
    new CreateChannelCommand({
      Name: "config-ch",
      EncoderSettings: encoderSettings,
      InputSpecification: {
        Codec: "AVC",
        MaximumBitrate: "MAX_10_MBPS",
        Resolution: "HD",
      },
      LogLevel: "INFO",
      RoleArn: "arn:aws:iam::000000000000:role/MediaLiveRole",
    }),
  );
  const id = created.Channel!.Id!;

  const described = await client.send(
    new DescribeChannelCommand({ ChannelId: id }),
  );
  expect(described.EncoderSettings).toBeDefined();
  expect(described.EncoderSettings?.TimecodeConfig).toBeDefined();
  expect(described.InputSpecification?.Codec).toBe("AVC");
  expect(described.LogLevel).toBe("INFO");
  expect(described.RoleArn).toBe(
    "arn:aws:iam::000000000000:role/MediaLiveRole",
  );

  await client.send(new DeleteChannelCommand({ ChannelId: id }));
});

test("HIGH-5: Input attachment tracking", async () => {
  const client = medialive();

  const inputCreated = await client.send(
    new CreateInputCommand({ Name: "attach-input", Type: "UDP_PUSH" }),
  );
  const inputId = inputCreated.Input!.Id!;

  const channelCreated = await client.send(
    new CreateChannelCommand({
      Name: "attach-ch",
      InputAttachments: [
        { InputId: inputId, InputAttachmentName: "main-input" },
      ],
    }),
  );
  const channelId = channelCreated.Channel!.Id!;

  const describedInput = await client.send(
    new DescribeInputCommand({ InputId: inputId }),
  );
  expect(describedInput.State).toBe("ATTACHED");
  expect(describedInput.AttachedChannels).toContain(channelId);

  await expect(
    client.send(new DeleteInputCommand({ InputId: inputId })),
  ).rejects.toThrow();

  await client.send(new DeleteChannelCommand({ ChannelId: channelId }));

  const describedAfter = await client.send(
    new DescribeInputCommand({ InputId: inputId }),
  );
  expect(describedAfter.State).toBe("DETACHED");
  expect(describedAfter.AttachedChannels ?? []).not.toContain(channelId);

  await client.send(new DeleteInputCommand({ InputId: inputId }));
});

test("MEDIUM-1: CreateMultiplexProgram persists settings, rejects duplicate, UpdateMultiplexProgram merges", async () => {
  const client = medialive();

  const mx = await client.send(
    new CreateMultiplexCommand({
      Name: "test-mx-m1",
      AvailabilityZones: ["us-east-1a", "us-east-1b"],
      MultiplexSettings: {
        TransportStreamBitrate: 1000000,
        TransportStreamId: 1,
      },
    }),
  );
  const mxId = mx.Multiplex?.Id!;

  const settings = {
    ProgramNumber: 1,
    TransportStreamSettings: { EcmPid: "8182" },
  };

  const created = await client.send(
    new CreateMultiplexProgramCommand({
      MultiplexId: mxId,
      ProgramName: "prog-a",
      MultiplexProgramSettings: settings as never,
    }),
  );
  expect(created.MultiplexProgram?.ProgramName).toBe("prog-a");
  expect(created.MultiplexProgram?.MultiplexProgramSettings).toBeDefined();

  await expect(
    client.send(
      new CreateMultiplexProgramCommand({
        MultiplexId: mxId,
        ProgramName: "prog-a",
        MultiplexProgramSettings: settings as never,
      }),
    ),
  ).rejects.toThrow();

  const described = await client.send(
    new DescribeMultiplexProgramCommand({
      MultiplexId: mxId,
      ProgramName: "prog-a",
    }),
  );
  expect(described.MultiplexProgramSettings).toBeDefined();

  const newSettings = {
    ProgramNumber: 2,
    TransportStreamSettings: { EcmPid: "8183" },
  };
  const updated = await client.send(
    new UpdateMultiplexProgramCommand({
      MultiplexId: mxId,
      ProgramName: "prog-a",
      MultiplexProgramSettings: newSettings as never,
    }),
  );
  expect(updated.MultiplexProgram?.MultiplexProgramSettings).toBeDefined();

  await client.send(
    new DeleteMultiplexProgramCommand({
      MultiplexId: mxId,
      ProgramName: "prog-a",
    }),
  );
  await client.send(new DeleteMultiplexCommand({ MultiplexId: mxId }));
});

test("MEDIUM-2: ListSignalMaps respects MaxResults and NextToken", async () => {
  const client = medialive();

  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const sm = await client.send(
      new CreateSignalMapCommand({
        Name: `sm-page-${i}`,
        DiscoveryEntryPointArn: `arn:aws:medialive:us-east-1:123456789012:channel:sm-page-${i}`,
      }),
    );
    ids.push(sm.Id!);
  }

  const page1 = await client.send(new ListSignalMapsCommand({ MaxResults: 2 }));
  expect((page1.SignalMaps ?? []).length).toBe(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new ListSignalMapsCommand({ NextToken: page1.NextToken }),
  );
  const page2Ids = (page2.SignalMaps ?? []).map((s) => s.Id);
  const ourRemaining = ids.filter(
    (id) => !page1.SignalMaps?.some((s) => s.Id === id),
  );
  expect(page2Ids).toEqual(expect.arrayContaining(ourRemaining));

  for (const id of ids) {
    await client.send(new DeleteSignalMapCommand({ Identifier: id }));
  }
});

test("MEDIUM-3: ListCloudWatchAlarmTemplates filters by GroupIdentifier", async () => {
  const client = medialive();

  const groupA = await client.send(
    new CreateCloudWatchAlarmTemplateGroupCommand({ Name: "group-filter-a" }),
  );
  const groupB = await client.send(
    new CreateCloudWatchAlarmTemplateGroupCommand({ Name: "group-filter-b" }),
  );

  const templateBase = {
    ComparisonOperator:
      CloudWatchAlarmTemplateComparisonOperator.GreaterThanOrEqualToThreshold,
    EvaluationPeriods: 1,
    MetricName: "NetworkIn",
    Period: 60,
    Statistic: CloudWatchAlarmTemplateStatistic.Average,
    TargetResourceType:
      CloudWatchAlarmTemplateTargetResourceType.MEDIALIVE_MULTIPLEX,
    Threshold: 1,
    TreatMissingData: "notBreaching",
  } as const;

  await client.send(
    new CreateCloudWatchAlarmTemplateCommand({
      ...templateBase,
      Name: "tmpl-a",
      GroupIdentifier: groupA.Id!,
    }),
  );
  await client.send(
    new CreateCloudWatchAlarmTemplateCommand({
      ...templateBase,
      Name: "tmpl-b",
      GroupIdentifier: groupB.Id!,
    }),
  );

  const filtered = await client.send(
    new ListCloudWatchAlarmTemplatesCommand({ GroupIdentifier: groupB.Id }),
  );
  const names = (filtered.CloudWatchAlarmTemplates ?? []).map((t) => t.Name);
  expect(names).toContain("tmpl-b");
  expect(names).not.toContain("tmpl-a");

  await client.send(
    new DeleteCloudWatchAlarmTemplateGroupCommand({ Identifier: groupA.Id! }),
  );
  await client.send(
    new DeleteCloudWatchAlarmTemplateGroupCommand({ Identifier: groupB.Id! }),
  );
});

test("LOW-1: CreateSignalMap returns CREATE_IN_PROGRESS, GetSignalMap transitions to CREATE_COMPLETE", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateSignalMapCommand({
      Name: "sm-lifecycle",
      DiscoveryEntryPointArn:
        "arn:aws:medialive:us-east-1:123456789012:channel:sm-lifecycle",
    }),
  );
  expect(created.Status).toBe("CREATE_IN_PROGRESS");

  const gotten = await client.send(
    new GetSignalMapCommand({ Identifier: created.Id! }),
  );
  expect(gotten.Status).toBe("CREATE_COMPLETE");

  const updated = await client.send(
    new StartUpdateSignalMapCommand({
      Identifier: created.Id!,
      Name: "sm-lifecycle-updated",
    }),
  );
  expect(updated.Status).toBe("UPDATE_IN_PROGRESS");

  const gottenAfterUpdate = await client.send(
    new GetSignalMapCommand({ Identifier: created.Id! }),
  );
  expect(gottenAfterUpdate.Status).toBe("UPDATE_COMPLETE");

  await client.send(new DeleteSignalMapCommand({ Identifier: created.Id! }));
});
