import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateDatabaseCommand,
  CreateTableCommand,
  DeleteDatabaseCommand,
  DeleteTableCommand,
  GetDatabaseCommand,
  GetDatabasesCommand,
  GetTableCommand,
  GetTablesCommand,
  GlueClient,
} from "@aws-sdk/client-glue";

const awsPort = 4566;
const uiPort = 5666;
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

describe("glue e2e", () => {
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

  test("database and table roundtrip", async () => {
    const client = glue();
    const dbName = "bunsai_e2e_db";
    const tableName = "bunsai_e2e_table";

    await client.send(
      new CreateDatabaseCommand({
        DatabaseInput: { Name: dbName, Description: "e2e database" },
      }),
    );

    const gotDb = await client.send(
      new GetDatabaseCommand({ Name: dbName }),
    );
    expect(gotDb.Database?.Name).toBe(dbName);
    expect(gotDb.Database?.Description).toBe("e2e database");
    expect(gotDb.Database?.CreateTime).toBeInstanceOf(Date);

    const dbs = await client.send(new GetDatabasesCommand({}));
    const dbNames = (dbs.DatabaseList ?? []).map((d) => d.Name);
    expect(dbNames).toContain(dbName);

    await client.send(
      new CreateTableCommand({
        DatabaseName: dbName,
        TableInput: {
          Name: tableName,
          TableType: "EXTERNAL_TABLE",
          StorageDescriptor: {
            Columns: [{ Name: "id", Type: "string" }],
            Location: "s3://bunsai/table",
          },
          PartitionKeys: [{ Name: "dt", Type: "string" }],
        },
      }),
    );

    const gotTable = await client.send(
      new GetTableCommand({ DatabaseName: dbName, Name: tableName }),
    );
    expect(gotTable.Table?.Name).toBe(tableName);
    expect(gotTable.Table?.DatabaseName).toBe(dbName);
    expect(gotTable.Table?.TableType).toBe("EXTERNAL_TABLE");
    expect(gotTable.Table?.StorageDescriptor?.Location).toBe(
      "s3://bunsai/table",
    );
    expect(gotTable.Table?.PartitionKeys?.[0]?.Name).toBe("dt");

    const tables = await client.send(
      new GetTablesCommand({ DatabaseName: dbName }),
    );
    const tableNames = (tables.TableList ?? []).map((t) => t.Name);
    expect(tableNames).toContain(tableName);

    await client.send(
      new DeleteTableCommand({ DatabaseName: dbName, Name: tableName }),
    );
    await expect(
      client.send(
        new GetTableCommand({ DatabaseName: dbName, Name: tableName }),
      ),
    ).rejects.toThrow();

    await client.send(new DeleteDatabaseCommand({ Name: dbName }));
    await expect(
      client.send(new GetDatabaseCommand({ Name: dbName })),
    ).rejects.toThrow();
  });

  test("get missing database throws EntityNotFound", async () => {
    const client = glue();
    await expect(
      client.send(new GetDatabaseCommand({ Name: "does-not-exist" })),
    ).rejects.toThrow();
  });
});
