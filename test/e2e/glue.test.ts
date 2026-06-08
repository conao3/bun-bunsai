import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchCreatePartitionCommand,
  CreateDatabaseCommand,
  CreateTableCommand,
  DeleteDatabaseCommand,
  DeletePartitionCommand,
  DeleteTableCommand,
  GetDatabaseCommand,
  GetDatabasesCommand,
  GetPartitionCommand,
  GetPartitionsCommand,
  GetTableCommand,
  GetTablesCommand,
  GlueClient,
  UpdateDatabaseCommand,
  UpdateTableCommand,
} from "@aws-sdk/client-glue";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("glue e2e", () => {
  const glue = () =>
    new GlueClient({ endpoint, region, credentials, requestHandler });

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

  test("duplicate database create throws AlreadyExistsException", async () => {
    const client = glue();
    const dbName = "bunsai_dup_db";
    await client.send(
      new CreateDatabaseCommand({ DatabaseInput: { Name: dbName } }),
    );
    await expect(
      client.send(
        new CreateDatabaseCommand({ DatabaseInput: { Name: dbName } }),
      ),
    ).rejects.toThrow();
    await client.send(new DeleteDatabaseCommand({ Name: dbName }));
  });

  test("update database", async () => {
    const client = glue();
    const dbName = "bunsai_upd_db";
    await client.send(
      new CreateDatabaseCommand({
        DatabaseInput: { Name: dbName, Description: "original" },
      }),
    );
    await client.send(
      new UpdateDatabaseCommand({
        Name: dbName,
        DatabaseInput: { Name: dbName, Description: "updated" },
      }),
    );
    const got = await client.send(new GetDatabaseCommand({ Name: dbName }));
    expect(got.Database?.Description).toBe("updated");
    await client.send(new DeleteDatabaseCommand({ Name: dbName }));
  });

  test("create table in missing database throws EntityNotFoundException", async () => {
    const client = glue();
    await expect(
      client.send(
        new CreateTableCommand({
          DatabaseName: "no-such-db",
          TableInput: { Name: "tbl" },
        }),
      ),
    ).rejects.toThrow();
  });

  test("duplicate table create throws AlreadyExistsException", async () => {
    const client = glue();
    const dbName = "bunsai_dup_tbl_db";
    const tableName = "dup_table";
    await client.send(
      new CreateDatabaseCommand({ DatabaseInput: { Name: dbName } }),
    );
    await client.send(
      new CreateTableCommand({
        DatabaseName: dbName,
        TableInput: { Name: tableName },
      }),
    );
    await expect(
      client.send(
        new CreateTableCommand({
          DatabaseName: dbName,
          TableInput: { Name: tableName },
        }),
      ),
    ).rejects.toThrow();
    await client.send(
      new DeleteTableCommand({ DatabaseName: dbName, Name: tableName }),
    );
    await client.send(new DeleteDatabaseCommand({ Name: dbName }));
  });

  test("update table", async () => {
    const client = glue();
    const dbName = "bunsai_upd_tbl_db";
    const tableName = "upd_table";
    await client.send(
      new CreateDatabaseCommand({ DatabaseInput: { Name: dbName } }),
    );
    await client.send(
      new CreateTableCommand({
        DatabaseName: dbName,
        TableInput: { Name: tableName, TableType: "EXTERNAL_TABLE" },
      }),
    );
    await client.send(
      new UpdateTableCommand({
        DatabaseName: dbName,
        TableInput: { Name: tableName, TableType: "VIRTUAL_VIEW" },
      }),
    );
    const got = await client.send(
      new GetTableCommand({ DatabaseName: dbName, Name: tableName }),
    );
    expect(got.Table?.TableType).toBe("VIRTUAL_VIEW");
    await client.send(
      new DeleteTableCommand({ DatabaseName: dbName, Name: tableName }),
    );
    await client.send(new DeleteDatabaseCommand({ Name: dbName }));
  });

  test("partition lifecycle with Expression filter", async () => {
    const client = glue();
    const dbName = "bunsai_part_db";
    const tableName = "part_table";

    await client.send(
      new CreateDatabaseCommand({ DatabaseInput: { Name: dbName } }),
    );
    await client.send(
      new CreateTableCommand({
        DatabaseName: dbName,
        TableInput: {
          Name: tableName,
          StorageDescriptor: {
            Columns: [{ Name: "id", Type: "bigint" }],
            Location: "s3://bunsai/part_table",
          },
          PartitionKeys: [
            { Name: "region", Type: "string" },
            { Name: "dt", Type: "string" },
          ],
        },
      }),
    );

    const batchResult = await client.send(
      new BatchCreatePartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionInputList: [
          {
            Values: ["us-east-1", "2024-01"],
            StorageDescriptor: {
              Location: "s3://bunsai/part_table/us-east-1/2024-01",
            },
          },
          {
            Values: ["us-east-1", "2024-02"],
            StorageDescriptor: {
              Location: "s3://bunsai/part_table/us-east-1/2024-02",
            },
          },
          {
            Values: ["eu-west-1", "2024-01"],
            StorageDescriptor: {
              Location: "s3://bunsai/part_table/eu-west-1/2024-01",
            },
          },
        ],
      }),
    );
    expect(batchResult.Errors).toHaveLength(0);

    const allPartitions = await client.send(
      new GetPartitionsCommand({ DatabaseName: dbName, TableName: tableName }),
    );
    expect(allPartitions.Partitions).toHaveLength(3);

    const gotPartition = await client.send(
      new GetPartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionValues: ["us-east-1", "2024-01"],
      }),
    );
    expect(gotPartition.Partition?.Values).toEqual(["us-east-1", "2024-01"]);

    const filteredByRegion = await client.send(
      new GetPartitionsCommand({
        DatabaseName: dbName,
        TableName: tableName,
        Expression: "region = 'us-east-1'",
      }),
    );
    expect(filteredByRegion.Partitions).toHaveLength(2);
    const regionVals = (filteredByRegion.Partitions ?? []).map(
      (p) => p.Values?.[0],
    );
    expect(regionVals.every((r) => r === "us-east-1")).toBe(true);

    const filteredBoth = await client.send(
      new GetPartitionsCommand({
        DatabaseName: dbName,
        TableName: tableName,
        Expression: "region = 'us-east-1' AND dt = '2024-02'",
      }),
    );
    expect(filteredBoth.Partitions).toHaveLength(1);
    expect(filteredBoth.Partitions?.[0]?.Values).toEqual([
      "us-east-1",
      "2024-02",
    ]);

    await client.send(
      new DeletePartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionValues: ["us-east-1", "2024-01"],
      }),
    );

    const afterDelete = await client.send(
      new GetPartitionsCommand({ DatabaseName: dbName, TableName: tableName }),
    );
    expect(afterDelete.Partitions).toHaveLength(2);
    const remaining = (afterDelete.Partitions ?? []).map((p) =>
      p.Values?.join("/"),
    );
    expect(remaining).not.toContain("us-east-1/2024-01");

    await client.send(
      new DeleteTableCommand({ DatabaseName: dbName, Name: tableName }),
    );
    await client.send(new DeleteDatabaseCommand({ Name: dbName }));
  });

  test("duplicate partition create throws AlreadyExistsException", async () => {
    const client = glue();
    const dbName = "bunsai_dup_part_db";
    const tableName = "dup_part_table";
    await client.send(
      new CreateDatabaseCommand({ DatabaseInput: { Name: dbName } }),
    );
    await client.send(
      new CreateTableCommand({
        DatabaseName: dbName,
        TableInput: {
          Name: tableName,
          PartitionKeys: [{ Name: "dt", Type: "string" }],
        },
      }),
    );
    await client.send(
      new BatchCreatePartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionInputList: [{ Values: ["2024-01"] }],
      }),
    );
    const dupResult = await client.send(
      new BatchCreatePartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionInputList: [{ Values: ["2024-01"] }],
      }),
    );
    expect(dupResult.Errors).toHaveLength(1);
    expect(dupResult.Errors?.[0]?.ErrorDetail?.ErrorCode).toBe(
      "AlreadyExistsException",
    );
    await client.send(
      new DeleteTableCommand({ DatabaseName: dbName, Name: tableName }),
    );
    await client.send(new DeleteDatabaseCommand({ Name: dbName }));
  });
});
