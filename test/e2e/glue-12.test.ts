import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateDatabaseCommand,
  CreateRegistryCommand,
  CreateSchemaCommand,
  CreateSecurityConfigurationCommand,
  CreateSessionCommand,
  CreateTableCommand,
  CreateTableOptimizerCommand,
  GetSchemaByDefinitionCommand,
  GetSchemaCommand,
  GetSchemaVersionCommand,
  GetSchemaVersionsDiffCommand,
  GetSecurityConfigurationCommand,
  GetSecurityConfigurationsCommand,
  GetSessionCommand,
  GetStatementCommand,
  GetTableOptimizerCommand,
  GetTableVersionCommand,
  GetTableVersionsCommand,
  GetTagsCommand,
  GlueClient,
} from "@aws-sdk/client-glue";

const awsPort = 4947;
const uiPort = 5947;
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

describe("glue chunk-11 ops e2e", () => {
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

  test("security-config create → get → list lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateSecurityConfigurationCommand({
        Name: "e2e_sec_cfg_chunk11",
        EncryptionConfiguration: {
          S3Encryption: [{ S3EncryptionMode: "DISABLED" }],
        },
      }),
    );

    const got = await client.send(
      new GetSecurityConfigurationCommand({ Name: "e2e_sec_cfg_chunk11" }),
    );
    expect(got.SecurityConfiguration?.Name).toBe("e2e_sec_cfg_chunk11");
    expect(typeof got.SecurityConfiguration?.CreatedTimeStamp).toBeDefined();

    await expect(
      client.send(
        new GetSecurityConfigurationCommand({ Name: "no_such_sec_cfg" }),
      ),
    ).rejects.toThrow();

    const list = await client.send(new GetSecurityConfigurationsCommand({}));
    expect(Array.isArray(list.SecurityConfigurations)).toBe(true);
    const found = list.SecurityConfigurations?.find(
      (s) => s.Name === "e2e_sec_cfg_chunk11",
    );
    expect(found).toBeDefined();
  });

  test("session create → get → statement lifecycle", async () => {
    const client = glue();

    const created = await client.send(
      new CreateSessionCommand({
        Id: "e2e-session-chunk11",
        Role: "arn:aws:iam::123456789012:role/GlueRole",
        Command: { Name: "glueetl", PythonVersion: "3" },
      }),
    );
    expect(created.Session?.Id).toBe("e2e-session-chunk11");

    const got = await client.send(
      new GetSessionCommand({ Id: "e2e-session-chunk11" }),
    );
    expect(got.Session?.Id).toBe("e2e-session-chunk11");

    await expect(
      client.send(new GetSessionCommand({ Id: "no-such-session" })),
    ).rejects.toThrow();

    const stmt = await client.send(
      new GetStatementCommand({ SessionId: "e2e-session-chunk11", Id: 1 }),
    );
    expect(stmt.Statement?.Id).toBe(1);
    expect(stmt.Statement?.State).toBe("AVAILABLE");
  });

  test("schema create → get → version lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateRegistryCommand({ RegistryName: "e2e_reg_chunk11" }),
    );

    const schema = await client.send(
      new CreateSchemaCommand({
        RegistryId: { RegistryName: "e2e_reg_chunk11" },
        SchemaName: "e2e_schema_chunk11",
        DataFormat: "AVRO",
        SchemaDefinition: "{}",
      }),
    );
    expect(schema.SchemaName).toBe("e2e_schema_chunk11");
    expect(schema.DataFormat).toBe("AVRO");

    const got = await client.send(
      new GetSchemaCommand({
        SchemaId: {
          RegistryName: "e2e_reg_chunk11",
          SchemaName: "e2e_schema_chunk11",
        },
      }),
    );
    expect(got.SchemaName).toBe("e2e_schema_chunk11");
    expect(got.DataFormat).toBe("AVRO");

    const byDef = await client.send(
      new GetSchemaByDefinitionCommand({
        SchemaId: {
          RegistryName: "e2e_reg_chunk11",
          SchemaName: "e2e_schema_chunk11",
        },
        SchemaDefinition: "{}",
      }),
    );
    expect(typeof byDef.SchemaArn).toBe("string");

    const version = await client.send(
      new GetSchemaVersionCommand({
        SchemaId: {
          RegistryName: "e2e_reg_chunk11",
          SchemaName: "e2e_schema_chunk11",
        },
      }),
    );
    expect(version.DataFormat).toBe("AVRO");
    expect(version.Status).toBe("AVAILABLE");

    const diff = await client.send(
      new GetSchemaVersionsDiffCommand({
        SchemaId: {
          RegistryName: "e2e_reg_chunk11",
          SchemaName: "e2e_schema_chunk11",
        },
        FirstSchemaVersionNumber: { VersionNumber: 1 },
        SecondSchemaVersionNumber: { VersionNumber: 1 },
        SchemaDiffType: "SYNTAX_DIFF",
      }),
    );
    expect(typeof diff.Diff).toBe("string");
  });

  test("GetTableVersion and GetTableVersions", async () => {
    const client = glue();

    await client.send(
      new CreateDatabaseCommand({
        DatabaseInput: { Name: "e2e_db_chunk11" },
      }),
    );
    await client.send(
      new CreateTableCommand({
        DatabaseName: "e2e_db_chunk11",
        TableInput: { Name: "e2e_tbl_chunk11", StorageDescriptor: {} },
      }),
    );

    const tv = await client.send(
      new GetTableVersionCommand({
        DatabaseName: "e2e_db_chunk11",
        TableName: "e2e_tbl_chunk11",
      }),
    );
    expect(tv.TableVersion?.Table?.Name).toBe("e2e_tbl_chunk11");

    const tvs = await client.send(
      new GetTableVersionsCommand({
        DatabaseName: "e2e_db_chunk11",
        TableName: "e2e_tbl_chunk11",
      }),
    );
    expect(Array.isArray(tvs.TableVersions)).toBe(true);
    expect(tvs.TableVersions?.length).toBeGreaterThan(0);
  });

  test("GetTableOptimizer returns stored optimizer", async () => {
    const client = glue();

    await client.send(
      new CreateTableOptimizerCommand({
        CatalogId: "123456789012",
        DatabaseName: "e2e_db_chunk11",
        TableName: "e2e_tbl_chunk11",
        Type: "compaction",
        TableOptimizerConfiguration: { Enabled: true },
      }),
    );

    const result = await client.send(
      new GetTableOptimizerCommand({
        CatalogId: "123456789012",
        DatabaseName: "e2e_db_chunk11",
        TableName: "e2e_tbl_chunk11",
        Type: "compaction",
      }),
    );
    expect(result.TableOptimizer?.type).toBe("compaction");
  });

  test("GetTags returns empty tags object", async () => {
    const client = glue();

    const result = await client.send(
      new GetTagsCommand({
        ResourceArn: "arn:aws:glue:us-east-1:123456789012:database/mydb",
      }),
    );
    expect(typeof result.Tags).toBe("object");
  });
});
