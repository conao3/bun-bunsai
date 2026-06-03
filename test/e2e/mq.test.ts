import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateBrokerCommand,
  CreateConfigurationCommand,
  CreateTagsCommand,
  CreateUserCommand,
  DeleteBrokerCommand,
  DeleteConfigurationCommand,
  DeleteTagsCommand,
  DeleteUserCommand,
  DescribeBrokerCommand,
  DescribeBrokerEngineTypesCommand,
  DescribeBrokerInstanceOptionsCommand,
  DescribeConfigurationCommand,
  DescribeConfigurationRevisionCommand,
  DescribeUserCommand,
  ListBrokersCommand,
  ListConfigurationRevisionsCommand,
  ListConfigurationsCommand,
  ListTagsCommand,
  ListUsersCommand,
  MqClient,
  PromoteCommand,
  RebootBrokerCommand,
  UpdateBrokerCommand,
  UpdateConfigurationCommand,
  UpdateUserCommand,
} from "@aws-sdk/client-mq";

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

const mq = () => new MqClient({ endpoint, region, credentials });

test("MQ broker and configuration roundtrip", async () => {
  const client = mq();
  const brokerName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateBrokerCommand({
      BrokerName: brokerName,
      EngineType: "ACTIVEMQ",
      EngineVersion: "5.18.0",
      DeploymentMode: "SINGLE_INSTANCE",
      HostInstanceType: "mq.m5.large",
      PubliclyAccessible: false,
      AutoMinorVersionUpgrade: true,
      Users: [{ Username: "admin", Password: "supersecret123" }],
    }),
  );
  expect(created.BrokerId).toMatch(/^b-/);
  expect(created.BrokerArn).toContain("arn:aws:mq:");
  const brokerId = created.BrokerId as string;

  const described = await client.send(
    new DescribeBrokerCommand({ BrokerId: brokerId }),
  );
  expect(described.BrokerId).toBe(brokerId);
  expect(described.BrokerName).toBe(brokerName);
  expect(described.BrokerState).toBe("RUNNING");
  expect(described.EngineType).toBe("ACTIVEMQ");

  const listed = await client.send(new ListBrokersCommand({}));
  expect(
    (listed.BrokerSummaries ?? []).map((summary) => summary.BrokerId),
  ).toContain(brokerId);

  const updated = await client.send(
    new UpdateBrokerCommand({
      BrokerId: brokerId,
      AutoMinorVersionUpgrade: false,
      EngineVersion: "5.18.1",
    }),
  );
  expect(updated.BrokerId).toBe(brokerId);
  expect(updated.EngineVersion).toBe("5.18.1");
  expect(updated.AutoMinorVersionUpgrade).toBe(false);

  const configuration = await client.send(
    new CreateConfigurationCommand({
      Name: `${brokerName}-config`,
      EngineType: "ACTIVEMQ",
      EngineVersion: "5.18.0",
    }),
  );
  expect(configuration.Id).toMatch(/^c-/);
  expect(configuration.Name).toBe(`${brokerName}-config`);
  expect(configuration.LatestRevision?.Revision).toBe(1);

  const deleted = await client.send(
    new DeleteBrokerCommand({ BrokerId: brokerId }),
  );
  expect(deleted.BrokerId).toBe(brokerId);

  await expect(
    client.send(new DescribeBrokerCommand({ BrokerId: brokerId })),
  ).rejects.toThrow();
});

test("MQ user operations", async () => {
  const client = mq();
  const brokerName = `bunsai-user-${Date.now()}`;

  const created = await client.send(
    new CreateBrokerCommand({
      BrokerName: brokerName,
      EngineType: "ACTIVEMQ",
      EngineVersion: "5.18.0",
      DeploymentMode: "SINGLE_INSTANCE",
      HostInstanceType: "mq.m5.large",
      PubliclyAccessible: false,
      AutoMinorVersionUpgrade: false,
      Users: [],
    }),
  );
  const brokerId = created.BrokerId as string;

  await client.send(
    new CreateUserCommand({
      BrokerId: brokerId,
      Username: "testuser",
      Password: "supersecret123",
      ConsoleAccess: true,
      Groups: ["admin", "ops"],
    }),
  );

  const described = await client.send(
    new DescribeUserCommand({ BrokerId: brokerId, Username: "testuser" }),
  );
  expect(described.BrokerId).toBe(brokerId);
  expect(described.Username).toBe("testuser");
  expect(described.ConsoleAccess).toBe(true);
  expect(described.Groups).toEqual(["admin", "ops"]);

  await client.send(
    new UpdateUserCommand({
      BrokerId: brokerId,
      Username: "testuser",
      ConsoleAccess: false,
      Groups: ["ops"],
    }),
  );

  const updated = await client.send(
    new DescribeUserCommand({ BrokerId: brokerId, Username: "testuser" }),
  );
  expect(updated.ConsoleAccess).toBe(false);
  expect(updated.Groups).toEqual(["ops"]);

  const listed = await client.send(
    new ListUsersCommand({ BrokerId: brokerId }),
  );
  expect(listed.BrokerId).toBe(brokerId);
  expect((listed.Users ?? []).map((u) => u.Username)).toContain("testuser");

  await client.send(
    new DeleteUserCommand({ BrokerId: brokerId, Username: "testuser" }),
  );

  await expect(
    client.send(
      new DescribeUserCommand({ BrokerId: brokerId, Username: "testuser" }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteBrokerCommand({ BrokerId: brokerId }));
});

test("MQ configuration operations", async () => {
  const client = mq();
  const configName = `bunsai-cfg-${Date.now()}`;

  const created = await client.send(
    new CreateConfigurationCommand({
      Name: configName,
      EngineType: "ACTIVEMQ",
      EngineVersion: "5.18.0",
    }),
  );
  const configId = created.Id as string;
  expect(configId).toMatch(/^c-/);
  expect(created.LatestRevision?.Revision).toBe(1);

  const described = await client.send(
    new DescribeConfigurationCommand({ ConfigurationId: configId }),
  );
  expect(described.Id).toBe(configId);
  expect(described.Name).toBe(configName);
  expect(described.LatestRevision?.Revision).toBe(1);

  const configXml = Buffer.from(
    '<?xml version="1.0"?><broker></broker>',
  ).toString("base64");

  const updated = await client.send(
    new UpdateConfigurationCommand({
      ConfigurationId: configId,
      Data: configXml,
      Description: "updated config",
    }),
  );
  expect(updated.Id).toBe(configId);
  expect(updated.LatestRevision?.Revision).toBe(2);

  const listedConfigs = await client.send(new ListConfigurationsCommand({}));
  expect((listedConfigs.Configurations ?? []).map((c) => c.Id)).toContain(
    configId,
  );

  const revision = await client.send(
    new DescribeConfigurationRevisionCommand({
      ConfigurationId: configId,
      ConfigurationRevision: "2",
    }),
  );
  expect(revision.ConfigurationId).toBe(configId);
  expect(revision.Data).toBe(configXml);
  expect(revision.Description).toBe("updated config");

  const revisions = await client.send(
    new ListConfigurationRevisionsCommand({ ConfigurationId: configId }),
  );
  expect(revisions.ConfigurationId).toBe(configId);
  expect((revisions.Revisions ?? []).length).toBeGreaterThanOrEqual(2);

  const deleted = await client.send(
    new DeleteConfigurationCommand({ ConfigurationId: configId }),
  );
  expect(deleted.ConfigurationId).toBe(configId);

  await expect(
    client.send(
      new DescribeConfigurationCommand({ ConfigurationId: configId }),
    ),
  ).rejects.toThrow();
});

test("MQ tags operations", async () => {
  const client = mq();
  const brokerName = `bunsai-tags-${Date.now()}`;

  const created = await client.send(
    new CreateBrokerCommand({
      BrokerName: brokerName,
      EngineType: "ACTIVEMQ",
      EngineVersion: "5.18.0",
      DeploymentMode: "SINGLE_INSTANCE",
      HostInstanceType: "mq.m5.large",
      PubliclyAccessible: false,
      AutoMinorVersionUpgrade: false,
      Users: [],
    }),
  );
  const brokerId = created.BrokerId as string;
  const brokerArn = created.BrokerArn as string;

  await client.send(
    new CreateTagsCommand({
      ResourceArn: brokerArn,
      Tags: { env: "test", team: "platform" },
    }),
  );

  const listed = await client.send(
    new ListTagsCommand({ ResourceArn: brokerArn }),
  );
  expect(listed.Tags).toMatchObject({ env: "test", team: "platform" });

  await client.send(
    new DeleteTagsCommand({ ResourceArn: brokerArn, TagKeys: ["team"] }),
  );

  const afterDelete = await client.send(
    new ListTagsCommand({ ResourceArn: brokerArn }),
  );
  expect(afterDelete.Tags?.["env"]).toBe("test");
  expect(afterDelete.Tags?.["team"]).toBeUndefined();

  await client.send(new DeleteBrokerCommand({ BrokerId: brokerId }));
});

test("MQ reboot and promote", async () => {
  const client = mq();
  const brokerName = `bunsai-reboot-${Date.now()}`;

  const created = await client.send(
    new CreateBrokerCommand({
      BrokerName: brokerName,
      EngineType: "ACTIVEMQ",
      EngineVersion: "5.18.0",
      DeploymentMode: "SINGLE_INSTANCE",
      HostInstanceType: "mq.m5.large",
      PubliclyAccessible: false,
      AutoMinorVersionUpgrade: false,
      Users: [],
    }),
  );
  const brokerId = created.BrokerId as string;

  await client.send(new RebootBrokerCommand({ BrokerId: brokerId }));

  const promoted = await client.send(
    new PromoteCommand({ BrokerId: brokerId, Mode: "SWITCHOVER" }),
  );
  expect(promoted.BrokerId).toBe(brokerId);

  await client.send(new DeleteBrokerCommand({ BrokerId: brokerId }));
});

test("MQ broker engine types and instance options", async () => {
  const client = mq();

  const engineTypes = await client.send(
    new DescribeBrokerEngineTypesCommand({}),
  );
  expect((engineTypes.BrokerEngineTypes ?? []).length).toBeGreaterThan(0);
  expect(
    (engineTypes.BrokerEngineTypes ?? []).map((e) => e.EngineType),
  ).toContain("ACTIVEMQ");

  const filtered = await client.send(
    new DescribeBrokerEngineTypesCommand({ EngineType: "RABBITMQ" }),
  );
  expect(
    (filtered.BrokerEngineTypes ?? []).every(
      (e) => e.EngineType === "RABBITMQ",
    ),
  ).toBe(true);

  const instanceOptions = await client.send(
    new DescribeBrokerInstanceOptionsCommand({}),
  );
  expect((instanceOptions.BrokerInstanceOptions ?? []).length).toBeGreaterThan(
    0,
  );

  const filteredOptions = await client.send(
    new DescribeBrokerInstanceOptionsCommand({ EngineType: "ACTIVEMQ" }),
  );
  expect(
    (filteredOptions.BrokerInstanceOptions ?? []).every(
      (o) => o.EngineType === "ACTIVEMQ",
    ),
  ).toBe(true);
});
