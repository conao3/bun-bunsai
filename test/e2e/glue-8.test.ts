import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateCustomEntityTypeCommand,
  CreateSecurityConfigurationCommand,
  CreateSessionCommand,
  CreateUsageProfileCommand,
  DeleteCustomEntityTypeCommand,
  DeleteSecurityConfigurationCommand,
  DeleteSessionCommand,
  DeleteUsageProfileCommand,
  GlueClient,
} from "@aws-sdk/client-glue";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("glue delete operations e2e", () => {
  const glue = () => new GlueClient({ endpoint, region, credentials });

  test("custom entity type create -> delete lifecycle", async () => {
    const client = glue();

    const created = await client.send(
      new CreateCustomEntityTypeCommand({
        Name: "e2e_del_entity",
        RegexString: "\\d{4}-\\d{4}",
      }),
    );
    expect(created.Name).toBe("e2e_del_entity");

    const deleted = await client.send(
      new DeleteCustomEntityTypeCommand({ Name: "e2e_del_entity" }),
    );
    expect(deleted.Name).toBe("e2e_del_entity");

    await expect(
      client.send(
        new DeleteCustomEntityTypeCommand({ Name: "e2e_del_entity" }),
      ),
    ).rejects.toThrow();
  });

  test("security configuration create -> delete lifecycle", async () => {
    const client = glue();

    const created = await client.send(
      new CreateSecurityConfigurationCommand({
        Name: "e2e_del_sec_cfg",
        EncryptionConfiguration: {
          S3Encryption: [],
          CloudWatchEncryption: { CloudWatchEncryptionMode: "DISABLED" },
          JobBookmarksEncryption: { JobBookmarksEncryptionMode: "DISABLED" },
        },
      }),
    );
    expect(created.Name).toBe("e2e_del_sec_cfg");
    expect(created.CreatedTimestamp).toBeDefined();

    await expect(
      client.send(
        new DeleteSecurityConfigurationCommand({ Name: "e2e_del_sec_cfg" }),
      ),
    ).resolves.toBeDefined();

    await expect(
      client.send(
        new DeleteSecurityConfigurationCommand({ Name: "e2e_del_sec_cfg" }),
      ),
    ).rejects.toThrow();
  });

  test("session create -> delete lifecycle", async () => {
    const client = glue();

    const created = await client.send(
      new CreateSessionCommand({
        Id: "e2e-del-session",
        Role: "arn:aws:iam::123456789012:role/GlueRole",
        Command: { Name: "glueetl", PythonVersion: "3" },
      }),
    );
    expect(created.Session?.Id).toBe("e2e-del-session");

    const deleted = await client.send(
      new DeleteSessionCommand({ Id: "e2e-del-session" }),
    );
    expect(deleted.Id).toBe("e2e-del-session");

    await expect(
      client.send(new DeleteSessionCommand({ Id: "e2e-del-session" })),
    ).rejects.toThrow();
  });

  test("usage profile create -> delete lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateUsageProfileCommand({
        Name: "e2e_del_profile",
        Configuration: { JobConfiguration: {}, SessionConfiguration: {} },
      }),
    );

    await expect(
      client.send(new DeleteUsageProfileCommand({ Name: "e2e_del_profile" })),
    ).resolves.toBeDefined();

    await expect(
      client.send(new DeleteUsageProfileCommand({ Name: "e2e_del_profile" })),
    ).rejects.toThrow();
  });
});
