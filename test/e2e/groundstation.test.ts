import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CancelContactCommand,
  CreateConfigCommand,
  CreateDataflowEndpointGroupCommand,
  CreateDataflowEndpointGroupV2Command,
  CreateEphemerisCommand,
  CreateMissionProfileCommand,
  DeleteConfigCommand,
  DeleteDataflowEndpointGroupCommand,
  DeleteEphemerisCommand,
  DeleteMissionProfileCommand,
  DescribeContactCommand,
  DescribeContactVersionCommand,
  DescribeEphemerisCommand,
  GetAgentConfigurationCommand,
  GetAgentTaskResponseUrlCommand,
  GetConfigCommand,
  GetDataflowEndpointGroupCommand,
  GetMinuteUsageCommand,
  GetMissionProfileCommand,
  GetSatelliteCommand,
  GroundStationClient,
  ListAntennasCommand,
  ListConfigsCommand,
  ListContactVersionsCommand,
  ListContactsCommand,
  ListDataflowEndpointGroupsCommand,
  ListEphemeridesCommand,
  ListGroundStationReservationsCommand,
  ListGroundStationsCommand,
  ListMissionProfilesCommand,
  ListSatellitesCommand,
  ListTagsForResourceCommand,
  RegisterAgentCommand,
  ReserveContactCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateAgentStatusCommand,
  UpdateConfigCommand,
  UpdateContactCommand,
  UpdateEphemerisCommand,
  UpdateMissionProfileCommand,
} from "@aws-sdk/client-groundstation";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const groundstation = () =>
  new GroundStationClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("GroundStation mission profile roundtrip", async () => {
  const client = groundstation();
  const profileName = `bunsai-e2e-${Date.now()}`;
  const trackingConfigArn = `arn:aws:groundstation:${region}:000000000000:config/tracking/${Date.now()}`;
  const dataflowConfigArn = `arn:aws:groundstation:${region}:000000000000:config/antenna-downlink/${Date.now()}`;

  const created = await client.send(
    new CreateMissionProfileCommand({
      name: profileName,
      minimumViableContactDurationSeconds: 180,
      dataflowEdges: [[dataflowConfigArn, dataflowConfigArn]],
      trackingConfigArn,
    }),
  );
  expect(created.missionProfileId).toBeDefined();
  const missionProfileId = created.missionProfileId ?? "";

  const got = await client.send(
    new GetMissionProfileCommand({ missionProfileId }),
  );
  expect(got.missionProfileId).toBe(missionProfileId);
  expect(got.name).toBe(profileName);
  expect(got.minimumViableContactDurationSeconds).toBe(180);
  expect(got.trackingConfigArn).toBe(trackingConfigArn);
  expect(got.missionProfileArn).toBeDefined();

  const listed = await client.send(new ListMissionProfilesCommand({}));
  expect(
    (listed.missionProfileList ?? []).map((p) => p.missionProfileId),
  ).toContain(missionProfileId);

  const deleted = await client.send(
    new DeleteMissionProfileCommand({ missionProfileId }),
  );
  expect(deleted.missionProfileId).toBe(missionProfileId);

  await expect(
    client.send(new GetMissionProfileCommand({ missionProfileId })),
  ).rejects.toThrow();
});

test("GroundStation UpdateMissionProfile", async () => {
  const client = groundstation();
  const trackingConfigArn = `arn:aws:groundstation:${region}:000000000000:config/tracking/${Date.now()}`;

  const created = await client.send(
    new CreateMissionProfileCommand({
      name: "update-test-profile",
      minimumViableContactDurationSeconds: 180,
      dataflowEdges: [],
      trackingConfigArn,
    }),
  );
  const missionProfileId = created.missionProfileId ?? "";

  const updated = await client.send(
    new UpdateMissionProfileCommand({
      missionProfileId,
      name: "updated-profile-name",
      minimumViableContactDurationSeconds: 300,
    }),
  );
  expect(updated.missionProfileId).toBe(missionProfileId);

  const got = await client.send(
    new GetMissionProfileCommand({ missionProfileId }),
  );
  expect(got.name).toBe("updated-profile-name");
  expect(got.minimumViableContactDurationSeconds).toBe(300);

  await client.send(new DeleteMissionProfileCommand({ missionProfileId }));
});

test("GroundStation config roundtrip", async () => {
  const client = groundstation();
  const configName = `bunsai-config-${Date.now()}`;

  const created = await client.send(
    new CreateConfigCommand({
      name: configName,
      configData: {
        trackingConfig: { autotrack: "REQUIRED" },
      },
    }),
  );
  expect(created.configId).toBeDefined();
  const configId = created.configId ?? "";
  const configType = created.configType ?? "tracking";
  expect(created.configArn).toBeDefined();

  const got = await client.send(new GetConfigCommand({ configId, configType }));
  expect(got.configId).toBe(configId);
  expect(got.name).toBe(configName);
  expect(got.configType).toBe(configType);
  expect(got.configArn).toBeDefined();

  const listed = await client.send(new ListConfigsCommand({}));
  expect((listed.configList ?? []).map((c) => c.configId)).toContain(configId);

  const updatedConfig = await client.send(
    new UpdateConfigCommand({
      configId,
      configType,
      name: "updated-config-name",
      configData: { trackingConfig: { autotrack: "PREFERRED" } },
    }),
  );
  expect(updatedConfig.configId).toBe(configId);

  const afterUpdate = await client.send(
    new GetConfigCommand({ configId, configType }),
  );
  expect(afterUpdate.name).toBe("updated-config-name");

  const deleted = await client.send(
    new DeleteConfigCommand({ configId, configType }),
  );
  expect(deleted.configId).toBe(configId);

  await expect(
    client.send(new GetConfigCommand({ configId, configType })),
  ).rejects.toThrow();
});

test("GroundStation dataflow endpoint group roundtrip", async () => {
  const client = groundstation();

  const created = await client.send(
    new CreateDataflowEndpointGroupCommand({
      endpointDetails: [],
      contactPrePassDurationSeconds: 60,
      contactPostPassDurationSeconds: 60,
    }),
  );
  expect(created.dataflowEndpointGroupId).toBeDefined();
  const dataflowEndpointGroupId = created.dataflowEndpointGroupId ?? "";

  const got = await client.send(
    new GetDataflowEndpointGroupCommand({ dataflowEndpointGroupId }),
  );
  expect(got.dataflowEndpointGroupId).toBe(dataflowEndpointGroupId);
  expect(got.contactPrePassDurationSeconds).toBe(60);
  expect(got.dataflowEndpointGroupArn).toBeDefined();

  const listed = await client.send(new ListDataflowEndpointGroupsCommand({}));
  expect(
    (listed.dataflowEndpointGroupList ?? []).map(
      (g) => g.dataflowEndpointGroupId,
    ),
  ).toContain(dataflowEndpointGroupId);

  const deleted = await client.send(
    new DeleteDataflowEndpointGroupCommand({ dataflowEndpointGroupId }),
  );
  expect(deleted.dataflowEndpointGroupId).toBe(dataflowEndpointGroupId);

  await expect(
    client.send(
      new GetDataflowEndpointGroupCommand({ dataflowEndpointGroupId }),
    ),
  ).rejects.toThrow();
});

test("GroundStation CreateDataflowEndpointGroupV2", async () => {
  const client = groundstation();

  const created = await client.send(
    new CreateDataflowEndpointGroupV2Command({
      endpoints: [],
    }),
  );
  expect(created.dataflowEndpointGroupId).toBeDefined();

  const got = await client.send(
    new GetDataflowEndpointGroupCommand({
      dataflowEndpointGroupId: created.dataflowEndpointGroupId ?? "",
    }),
  );
  expect(got.dataflowEndpointGroupId).toBe(created.dataflowEndpointGroupId);
});

test("GroundStation ephemeris roundtrip", async () => {
  const client = groundstation();
  const satelliteId = "sat-bunsai-0001";

  const created = await client.send(
    new CreateEphemerisCommand({
      satelliteId,
      name: `bunsai-ephemeris-${Date.now()}`,
      enabled: true,
      priority: 1,
      ephemeris: {
        oem: {
          s3Object: {
            bucket: "bunsai-test",
            key: "test.oem",
            version: "1",
          },
        },
      },
    }),
  );
  expect(created.ephemerisId).toBeDefined();
  const ephemerisId = created.ephemerisId ?? "";

  const got = await client.send(new DescribeEphemerisCommand({ ephemerisId }));
  expect(got.ephemerisId).toBe(ephemerisId);
  expect(got.satelliteId).toBe(satelliteId);
  expect(got.enabled).toBe(true);

  const updated = await client.send(
    new UpdateEphemerisCommand({
      ephemerisId,
      enabled: false,
      priority: 2,
    }),
  );
  expect(updated.ephemerisId).toBe(ephemerisId);

  const afterUpdate = await client.send(
    new DescribeEphemerisCommand({ ephemerisId }),
  );
  expect(afterUpdate.enabled).toBe(false);
  expect(afterUpdate.priority).toBe(2);

  const listed = await client.send(
    new ListEphemeridesCommand({
      satelliteId,
      startTime: new Date(Date.now() - 86400000),
      endTime: new Date(Date.now() + 86400000),
    }),
  );
  expect((listed.ephemerides ?? []).map((e) => e.ephemerisId)).toContain(
    ephemerisId,
  );

  const deleted = await client.send(
    new DeleteEphemerisCommand({ ephemerisId }),
  );
  expect(deleted.ephemerisId).toBe(ephemerisId);

  await expect(
    client.send(new DescribeEphemerisCommand({ ephemerisId })),
  ).rejects.toThrow();
});

test("GroundStation contact roundtrip", async () => {
  const client = groundstation();
  const now = Math.floor(Date.now() / 1000);
  const missionProfileArn = `arn:aws:groundstation:${region}:000000000000:mission-profile/${crypto.randomUUID()}`;
  const satArn = `arn:aws:groundstation:${region}:000000000000:satellite/sat-001`;

  const reserved = await client.send(
    new ReserveContactCommand({
      missionProfileArn,
      satelliteArn: satArn,
      startTime: new Date((now + 600) * 1000),
      endTime: new Date((now + 900) * 1000),
      groundStation: "gs-bunsai-0001",
    }),
  );
  expect(reserved.contactId).toBeDefined();
  const contactId = reserved.contactId ?? "";
  expect(reserved.versionId).toBeDefined();

  const described = await client.send(
    new DescribeContactCommand({ contactId }),
  );
  expect(described.contactId).toBe(contactId);
  expect(described.contactStatus).toBe("SCHEDULED");
  expect(described.missionProfileArn).toBe(missionProfileArn);
  expect(described.satelliteArn).toBe(satArn);

  const listed = await client.send(
    new ListContactsCommand({
      statusList: ["SCHEDULED"],
      startTime: new Date((now + 500) * 1000),
      endTime: new Date((now + 1000) * 1000),
    }),
  );
  expect((listed.contactList ?? []).map((c) => c.contactId)).toContain(
    contactId,
  );

  const versions = await client.send(
    new ListContactVersionsCommand({ contactId }),
  );
  expect(versions.contactVersionsList?.length).toBeGreaterThan(0);
  const versionId = versions.contactVersionsList?.[0]?.versionId ?? "";

  const describedVersion = await client.send(
    new DescribeContactVersionCommand({ contactId, versionId }),
  );
  expect(describedVersion.contactId).toBe(contactId);

  const updateResult = await client.send(
    new UpdateContactCommand({ contactId }),
  );
  expect(updateResult.contactId).toBe(contactId);
  expect(updateResult.versionId).toBeDefined();

  const cancelled = await client.send(new CancelContactCommand({ contactId }));
  expect(cancelled.contactId).toBe(contactId);

  const afterCancel = await client.send(
    new DescribeContactCommand({ contactId }),
  );
  expect(afterCancel.contactStatus).toBe("CANCELLED");
});

test("GroundStation satellite operations", async () => {
  const client = groundstation();

  const listed = await client.send(new ListSatellitesCommand({}));
  expect(listed.satellites?.length).toBeGreaterThan(0);
  const satelliteId = listed.satellites?.[0]?.satelliteId ?? "";

  const got = await client.send(new GetSatelliteCommand({ satelliteId }));
  expect(got.satelliteId).toBe(satelliteId);
  expect(got.noradSatelliteID).toBeDefined();
});

test("GroundStation ground station operations", async () => {
  const client = groundstation();

  const listed = await client.send(new ListGroundStationsCommand({}));
  expect(listed.groundStationList?.length).toBeGreaterThan(0);
  const groundStationId = listed.groundStationList?.[0]?.groundStationId ?? "";

  const antennas = await client.send(
    new ListAntennasCommand({ groundStationId }),
  );
  expect(antennas.antennaList).toBeDefined();

  const now = new Date();
  const reservations = await client.send(
    new ListGroundStationReservationsCommand({
      groundStationId,
      startTime: new Date(now.getTime() - 86400000),
      endTime: new Date(now.getTime() + 86400000),
    }),
  );
  expect(reservations.reservationList).toBeDefined();
});

test("GroundStation GetMinuteUsage", async () => {
  const client = groundstation();

  const result = await client.send(
    new GetMinuteUsageCommand({ month: 6, year: 2025 }),
  );
  expect(result.totalScheduledMinutes).toBeDefined();
  expect(result.estimatedMinutesRemaining).toBeDefined();
});

test("GroundStation tag operations", async () => {
  const client = groundstation();
  const trackingConfigArn = `arn:aws:groundstation:${region}:000000000000:config/tracking/${Date.now()}`;

  const created = await client.send(
    new CreateMissionProfileCommand({
      name: "tag-test-profile",
      minimumViableContactDurationSeconds: 180,
      dataflowEdges: [],
      trackingConfigArn,
    }),
  );
  const resourceArn = `arn:aws:groundstation:${region}:000000000000:mission-profile/${created.missionProfileId}`;

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: { env: "test", project: "bunsai" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listed.tags).toMatchObject({ env: "test", project: "bunsai" });

  await client.send(
    new UntagResourceCommand({ resourceArn, tagKeys: ["env"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(afterUntag.tags?.["env"]).toBeUndefined();
  expect(afterUntag.tags?.["project"]).toBe("bunsai");
});

test("GroundStation agent operations", async () => {
  const client = groundstation();

  const registered = await client.send(
    new RegisterAgentCommand({
      discoveryData: {
        groundStations: ["gs-bunsai-0001"],
        mountPoints: [],
        capabilityArns: [],
      },
      agentDetails: {
        agentVersion: "1.0.0",
        instanceType: "t3.medium",
        componentVersions: [],
        agentCpuCores: [],
        reservedCpuCores: [],
      },
    }),
  );
  expect(registered.agentId).toBeDefined();
  const agentId = registered.agentId ?? "";

  const config = await client.send(
    new GetAgentConfigurationCommand({ agentId }),
  );
  expect(config.agentId).toBe(agentId);
  expect(config.taskingDocument).toBeDefined();

  const taskId = crypto.randomUUID();
  const statusResult = await client.send(
    new UpdateAgentStatusCommand({
      agentId,
      taskId,
      aggregateStatus: { status: "SUCCESS" },
      componentStatuses: [],
    }),
  );
  expect(statusResult.agentId).toBe(agentId);

  const urlResult = await client.send(
    new GetAgentTaskResponseUrlCommand({ agentId, taskId }),
  );
  expect(urlResult.agentId).toBe(agentId);
  expect(urlResult.taskId).toBe(taskId);
  expect(urlResult.presignedLogUrl).toBeDefined();
});
