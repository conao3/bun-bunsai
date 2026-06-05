import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
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

const awsPort = 4943;
const uiPort = 5943;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

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

describe("glue delete operations e2e", () => {
  let proc: ReturnType<typeof spawn> | undefined;

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
