import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateSbomWithPackageVersionCommand,
  ConfirmTopicRuleDestinationCommand,
  CreateOTAUpdateCommand,
  CreatePackageCommand,
  CreatePackageVersionCommand,
  CreateStreamCommand,
  CreateTopicRuleDestinationCommand,
  DeleteOTAUpdateCommand,
  DeletePackageCommand,
  DeletePackageVersionCommand,
  DeleteStreamCommand,
  DeleteTopicRuleDestinationCommand,
  DeleteV2LoggingLevelCommand,
  DescribeEncryptionConfigurationCommand,
  DescribeEventConfigurationsCommand,
  DescribeStreamCommand,
  DisassociateSbomFromPackageVersionCommand,
  GetLoggingOptionsCommand,
  GetOTAUpdateCommand,
  GetPackageCommand,
  GetPackageConfigurationCommand,
  GetPackageVersionCommand,
  GetTopicRuleDestinationCommand,
  GetV2LoggingOptionsCommand,
  IoTClient,
  ListOTAUpdatesCommand,
  ListPackageVersionsCommand,
  ListPackagesCommand,
  ListStreamsCommand,
  ListTopicRuleDestinationsCommand,
  ListV2LoggingLevelsCommand,
  SetLoggingOptionsCommand,
  SetV2LoggingLevelCommand,
  SetV2LoggingOptionsCommand,
  UpdateEncryptionConfigurationCommand,
  UpdateEventConfigurationsCommand,
  UpdatePackageCommand,
  UpdatePackageConfigurationCommand,
  UpdatePackageVersionCommand,
  UpdateStreamCommand,
  UpdateTopicRuleDestinationCommand,
} from "@aws-sdk/client-iot";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iot = () =>
  new IoTClient({ endpoint, region, credentials, requestHandler });

const suffix = () => Date.now().toString(36);

test("IoT package lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const packageName = `bunsai_e2e_pkg_${sfx}`;

  const created = await client.send(
    new CreatePackageCommand({ packageName, description: "test pkg" }),
  );
  expect(created.packageName).toBe(packageName);
  expect(created.packageArn).toContain(packageName);

  const got = await client.send(new GetPackageCommand({ packageName }));
  expect(got.packageName).toBe(packageName);
  expect(got.description).toBe("test pkg");

  const list = await client.send(new ListPackagesCommand({}));
  expect(
    list.packageSummaries?.some((p) => p.packageName === packageName),
  ).toBe(true);

  await client.send(
    new UpdatePackageCommand({
      packageName,
      description: "updated",
    }),
  );
  const gotUpdated = await client.send(new GetPackageCommand({ packageName }));
  expect(gotUpdated.description).toBe("updated");

  const versionName = "1.0.0";
  const createdVer = await client.send(
    new CreatePackageVersionCommand({ packageName, versionName }),
  );
  expect(createdVer.versionName).toBe(versionName);
  expect(createdVer.status).toBe("DRAFT");

  const gotVer = await client.send(
    new GetPackageVersionCommand({ packageName, versionName }),
  );
  expect(gotVer.versionName).toBe(versionName);

  await client.send(
    new UpdatePackageVersionCommand({ packageName, versionName }),
  );

  const listVer = await client.send(
    new ListPackageVersionsCommand({ packageName }),
  );
  expect(
    listVer.packageVersionSummaries?.some((v) => v.versionName === versionName),
  ).toBe(true);

  await client.send(
    new AssociateSbomWithPackageVersionCommand({
      packageName,
      versionName,
      sbom: { s3Location: { bucket: "b", key: "k", version: "v1" } },
    }),
  );

  await client.send(
    new DisassociateSbomFromPackageVersionCommand({ packageName, versionName }),
  );

  const cfgBefore = await client.send(new GetPackageConfigurationCommand({}));
  expect(cfgBefore).toBeDefined();
  await client.send(
    new UpdatePackageConfigurationCommand({
      versionUpdateByJobsConfig: { enabled: true },
    }),
  );
  const cfgAfter = await client.send(new GetPackageConfigurationCommand({}));
  expect(
    (cfgAfter.versionUpdateByJobsConfig as Record<string, unknown>)?.enabled,
  ).toBe(true);

  await client.send(
    new DeletePackageVersionCommand({ packageName, versionName }),
  );
  await client.send(new DeletePackageCommand({ packageName }));
});

test("IoT OTA update lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const otaUpdateId = `bunsai_e2e_ota_${sfx}`;

  const created = await client.send(
    new CreateOTAUpdateCommand({
      otaUpdateId,
      targets: ["arn:aws:iot:us-east-1:000000000000:thing/test"],
      files: [{ fileName: "fw.bin" }],
      roleArn: "arn:aws:iam::000000000000:role/ota-role",
    }),
  );
  expect(created.otaUpdateId).toBe(otaUpdateId);
  expect(created.otaUpdateStatus).toBe("CREATE_COMPLETE");

  const got = await client.send(new GetOTAUpdateCommand({ otaUpdateId }));
  expect(got.otaUpdateInfo?.otaUpdateId).toBe(otaUpdateId);
  expect(got.otaUpdateInfo?.otaUpdateStatus).toBe("CREATE_COMPLETE");

  const list = await client.send(new ListOTAUpdatesCommand({}));
  expect(list.otaUpdates?.some((o) => o.otaUpdateId === otaUpdateId)).toBe(
    true,
  );

  await client.send(new DeleteOTAUpdateCommand({ otaUpdateId }));
  const listAfter = await client.send(new ListOTAUpdatesCommand({}));
  expect(listAfter.otaUpdates?.some((o) => o.otaUpdateId === otaUpdateId)).toBe(
    false,
  );
});

test("IoT stream lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const streamId = `bunsaie2e${sfx}`;

  const created = await client.send(
    new CreateStreamCommand({
      streamId,
      description: "test stream",
      files: [{ fileId: 0 }],
      roleArn: "arn:aws:iam::000000000000:role/stream-role",
    }),
  );
  expect(created.streamId).toBe(streamId);
  expect(created.streamVersion).toBe(1);

  const described = await client.send(new DescribeStreamCommand({ streamId }));
  expect(described.streamInfo?.streamId).toBe(streamId);
  expect(described.streamInfo?.description).toBe("test stream");

  const list = await client.send(new ListStreamsCommand({}));
  expect(list.streams?.some((s) => s.streamId === streamId)).toBe(true);

  const updated = await client.send(
    new UpdateStreamCommand({
      streamId,
      description: "updated",
      files: [{ fileId: 0 }],
      roleArn: "arn:aws:iam::000000000000:role/stream-role",
    }),
  );
  expect(updated.streamVersion).toBe(2);

  await client.send(new DeleteStreamCommand({ streamId }));
  const listAfter = await client.send(new ListStreamsCommand({}));
  expect(listAfter.streams?.some((s) => s.streamId === streamId)).toBe(false);
});

test("IoT topic rule destination lifecycle", async () => {
  const client = iot();

  const created = await client.send(
    new CreateTopicRuleDestinationCommand({
      destinationConfiguration: {
        httpUrlConfiguration: {
          confirmationUrl: "https://example.com/confirm",
        },
      },
    }),
  );
  expect(created.topicRuleDestination?.status).toBe("IN_PROGRESS");
  const arn = created.topicRuleDestination?.arn!;

  const got = await client.send(new GetTopicRuleDestinationCommand({ arn }));
  expect(got.topicRuleDestination?.arn).toBe(arn);

  const list = await client.send(new ListTopicRuleDestinationsCommand({}));
  expect(list.destinationSummaries?.some((d) => d.arn === arn)).toBe(true);

  await client.send(
    new ConfirmTopicRuleDestinationCommand({ confirmationToken: arn }),
  );
  const confirmed = await client.send(
    new GetTopicRuleDestinationCommand({ arn }),
  );
  expect(confirmed.topicRuleDestination?.status).toBe("ENABLED");

  await client.send(
    new UpdateTopicRuleDestinationCommand({ arn, status: "DISABLED" }),
  );
  const disabled = await client.send(
    new GetTopicRuleDestinationCommand({ arn }),
  );
  expect(disabled.topicRuleDestination?.status).toBe("DISABLED");

  await client.send(new DeleteTopicRuleDestinationCommand({ arn }));
});

test("IoT logging operations", async () => {
  const client = iot();

  await client.send(
    new SetV2LoggingOptionsCommand({
      roleArn: "arn:aws:iam::000000000000:role/logging",
      defaultLogLevel: "DEBUG",
      disableAllLogs: false,
    }),
  );
  const v2opts = await client.send(new GetV2LoggingOptionsCommand({}));
  expect(v2opts.defaultLogLevel).toBe("DEBUG");
  expect(v2opts.disableAllLogs).toBe(false);

  await client.send(
    new SetV2LoggingLevelCommand({
      logTarget: { targetType: "THING_GROUP", targetName: "testGroup" },
      logLevel: "INFO",
    }),
  );
  const levels = await client.send(new ListV2LoggingLevelsCommand({}));
  expect(
    levels.logTargetConfigurations?.some(
      (l) => l.logTarget?.targetName === "testGroup" && l.logLevel === "INFO",
    ),
  ).toBe(true);

  await client.send(
    new DeleteV2LoggingLevelCommand({
      targetType: "THING_GROUP",
      targetName: "testGroup",
    }),
  );
  const levelsAfter = await client.send(new ListV2LoggingLevelsCommand({}));
  expect(
    levelsAfter.logTargetConfigurations?.some(
      (l) => l.logTarget?.targetName === "testGroup",
    ),
  ).toBe(false);

  await client.send(
    new SetLoggingOptionsCommand({
      loggingOptionsPayload: {
        roleArn: "arn:aws:iam::000000000000:role/logging",
        logLevel: "WARN",
      },
    }),
  );
  const lopts = await client.send(new GetLoggingOptionsCommand({}));
  expect(lopts.logLevel).toBe("WARN");
});

test("IoT event and encryption configuration", async () => {
  const client = iot();

  const evtBefore = await client.send(
    new DescribeEventConfigurationsCommand({}),
  );
  expect(evtBefore).toBeDefined();

  await client.send(
    new UpdateEventConfigurationsCommand({
      eventConfigurations: { THING: { Enabled: true } },
    }),
  );
  const evtAfter = await client.send(
    new DescribeEventConfigurationsCommand({}),
  );
  expect(
    (evtAfter.eventConfigurations as Record<string, unknown>)?.THING,
  ).toBeDefined();

  const encBefore = await client.send(
    new DescribeEncryptionConfigurationCommand({}),
  );
  expect(encBefore.encryptionType).toBeDefined();

  await client.send(
    new UpdateEncryptionConfigurationCommand({
      encryptionType: "CUSTOMER_MANAGED_KMS_KEY",
      kmsKeyArn: "arn:aws:kms:us-east-1:000000000000:key/test-key",
    }),
  );
  const encAfter = await client.send(
    new DescribeEncryptionConfigurationCommand({}),
  );
  expect(encAfter.encryptionType).toBe("CUSTOMER_MANAGED_KMS_KEY");
  expect(encAfter.kmsKeyArn).toContain("test-key");
});
