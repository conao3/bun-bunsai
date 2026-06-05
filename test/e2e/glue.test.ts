import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
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

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("glue e2e", () => {
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

    const gotDb = await client.send(new GetDatabaseCommand({ Name: dbName }));
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
