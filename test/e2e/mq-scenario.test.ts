import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBrokerCommand,
  CreateConfigurationCommand,
  CreateUserCommand,
  DeleteBrokerCommand,
  DescribeBrokerCommand,
  DescribeUserCommand,
  ListBrokersCommand,
  ListUsersCommand,
  MqClient,
  RebootBrokerCommand,
  UpdateBrokerCommand,
} from "@aws-sdk/client-mq";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("MQ broker provisioning scenario", () => {
  const mq = () =>
    new MqClient({ endpoint, region, credentials, requestHandler });

  test("CreateBroker → RUNNING → configure → user management → reboot → delete", async () => {
    const client = mq();
    const brokerName = `bunsai-scenario-${Date.now()}`;

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

    const first = await client.send(
      new DescribeBrokerCommand({ BrokerId: brokerId }),
    );
    expect(first.BrokerState).toBe("CREATION_IN_PROGRESS");

    const second = await client.send(
      new DescribeBrokerCommand({ BrokerId: brokerId }),
    );
    expect(second.BrokerState).toBe("RUNNING");

    const listed = await client.send(new ListBrokersCommand({}));
    expect((listed.BrokerSummaries ?? []).map((s) => s.BrokerId)).toContain(
      brokerId,
    );

    const configuration = await client.send(
      new CreateConfigurationCommand({
        Name: `${brokerName}-cfg`,
        EngineType: "ACTIVEMQ",
        EngineVersion: "5.18.0",
      }),
    );
    expect(configuration.Id).toMatch(/^c-/);
    expect(configuration.LatestRevision?.Revision).toBe(1);
    const configId = configuration.Id as string;

    const updated = await client.send(
      new UpdateBrokerCommand({
        BrokerId: brokerId,
        Configuration: { Id: configId, Revision: 1 },
      }),
    );
    expect(updated.Configuration?.Id).toBe(configId);
    expect(updated.Configuration?.Revision).toBe(1);

    const afterUpdate = await client.send(
      new DescribeBrokerCommand({ BrokerId: brokerId }),
    );
    expect(afterUpdate.Configurations?.Current?.Id).toBe(configId);

    await client.send(
      new CreateUserCommand({
        BrokerId: brokerId,
        Username: "operator",
        Password: "supersecret456",
        ConsoleAccess: false,
        Groups: ["ops"],
      }),
    );

    const users = await client.send(
      new ListUsersCommand({ BrokerId: brokerId }),
    );
    expect((users.Users ?? []).map((u) => u.Username)).toContain("operator");

    const describedUser = await client.send(
      new DescribeUserCommand({ BrokerId: brokerId, Username: "operator" }),
    );
    expect(describedUser.BrokerId).toBe(brokerId);
    expect(describedUser.Username).toBe("operator");

    await client.send(new RebootBrokerCommand({ BrokerId: brokerId }));

    const deleted = await client.send(
      new DeleteBrokerCommand({ BrokerId: brokerId }),
    );
    expect(deleted.BrokerId).toBe(brokerId);

    const afterDelete = await client.send(
      new DescribeBrokerCommand({ BrokerId: brokerId }),
    );
    expect(afterDelete.BrokerState).toBe("DELETION_IN_PROGRESS");

    await expect(
      client.send(new DescribeBrokerCommand({ BrokerId: brokerId })),
    ).rejects.toThrow();
  });
});
