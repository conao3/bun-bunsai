import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  BatchCreatePartitionCommand,
  BatchDeleteConnectionCommand,
  BatchDeletePartitionCommand,
  BatchDeleteTableCommand,
  BatchGetPartitionCommand,
  BatchUpdatePartitionCommand,
  CreateClassifierCommand,
  CreateConnectionCommand,
  CreateDatabaseCommand,
  CreatePartitionCommand,
  CreatePartitionIndexCommand,
  CreateTableCommand,
  DeleteClassifierCommand,
  DeleteConnectionCommand,
  DeletePartitionCommand,
  DeletePartitionIndexCommand,
  GetClassifierCommand,
  GetClassifiersCommand,
  GetConnectionCommand,
  GetConnectionsCommand,
  GetPartitionCommand,
  GetPartitionIndexesCommand,
  GetPartitionsCommand,
  GlueClient,
} from "@aws-sdk/client-glue";

const awsPort = 4637;
const uiPort = 5737;
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

describe("glue partition, connection, classifier e2e", () => {
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

  test("partition lifecycle", async () => {
    const client = glue();
    const dbName = "e2e_partition_db";
    const tableName = "e2e_partition_table";

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
      new CreatePartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionInput: {
          Values: ["2024-01-01"],
          StorageDescriptor: { Location: "s3://bucket/dt=2024-01-01" },
        },
      }),
    );

    const got = await client.send(
      new GetPartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionValues: ["2024-01-01"],
      }),
    );
    expect(got.Partition?.Values).toEqual(["2024-01-01"]);
    expect(got.Partition?.DatabaseName).toBe(dbName);
    expect(got.Partition?.TableName).toBe(tableName);
    expect(got.Partition?.StorageDescriptor?.Location).toBe(
      "s3://bucket/dt=2024-01-01",
    );

    const batchCreated = await client.send(
      new BatchCreatePartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionInputList: [
          { Values: ["2024-01-02"] },
          { Values: ["2024-01-03"] },
        ],
      }),
    );
    expect(batchCreated.Errors?.length ?? 0).toBe(0);

    const partitions = await client.send(
      new GetPartitionsCommand({ DatabaseName: dbName, TableName: tableName }),
    );
    const vals = (partitions.Partitions ?? []).map((p) => p.Values?.[0]);
    expect(vals).toContain("2024-01-01");
    expect(vals).toContain("2024-01-02");
    expect(vals).toContain("2024-01-03");

    const batchGot = await client.send(
      new BatchGetPartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionsToGet: [
          { Values: ["2024-01-02"] },
          { Values: ["9999-99-99"] },
        ],
      }),
    );
    expect(batchGot.Partitions?.length).toBe(1);
    expect(batchGot.UnprocessedKeys?.length).toBe(1);

    await client.send(
      new BatchUpdatePartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        Entries: [
          {
            PartitionValueList: { Values: ["2024-01-03"] },
            PartitionInput: {
              Values: ["2024-01-03"],
              StorageDescriptor: { Location: "s3://bucket/updated" },
            },
          },
        ],
      }),
    );
    const updated = await client.send(
      new GetPartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionValues: ["2024-01-03"],
      }),
    );
    expect(updated.Partition?.StorageDescriptor?.Location).toBe(
      "s3://bucket/updated",
    );

    const batchDeleted = await client.send(
      new BatchDeletePartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionsToDelete: [
          { Values: ["2024-01-02"] },
          { Values: ["2024-01-03"] },
        ],
      }),
    );
    expect(batchDeleted.Errors?.length ?? 0).toBe(0);

    await client.send(
      new DeletePartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionValues: ["2024-01-01"],
      }),
    );
    await expect(
      client.send(
        new GetPartitionCommand({
          DatabaseName: dbName,
          TableName: tableName,
          PartitionValues: ["2024-01-01"],
        }),
      ),
    ).rejects.toThrow();
  });

  test("partition index lifecycle", async () => {
    const client = glue();
    const dbName = "e2e_pidx_db";
    const tableName = "e2e_pidx_table";

    await client.send(
      new CreateDatabaseCommand({ DatabaseInput: { Name: dbName } }),
    );
    await client.send(
      new CreateTableCommand({
        DatabaseName: dbName,
        TableInput: {
          Name: tableName,
          PartitionKeys: [
            { Name: "year", Type: "string" },
            { Name: "month", Type: "string" },
          ],
        },
      }),
    );

    await client.send(
      new CreatePartitionIndexCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionIndex: { IndexName: "year_idx", Keys: ["year"] },
      }),
    );

    const indexes = await client.send(
      new GetPartitionIndexesCommand({
        DatabaseName: dbName,
        TableName: tableName,
      }),
    );
    const names = (indexes.PartitionIndexDescriptorList ?? []).map(
      (i) => i.IndexName,
    );
    expect(names).toContain("year_idx");

    await client.send(
      new DeletePartitionIndexCommand({
        DatabaseName: dbName,
        TableName: tableName,
        IndexName: "year_idx",
      }),
    );
    const after = await client.send(
      new GetPartitionIndexesCommand({
        DatabaseName: dbName,
        TableName: tableName,
      }),
    );
    expect(after.PartitionIndexDescriptorList?.length ?? 0).toBe(0);
  });

  test("connection lifecycle", async () => {
    const client = glue();
    const connName = "e2e_jdbc_conn";

    await client.send(
      new CreateConnectionCommand({
        ConnectionInput: {
          Name: connName,
          ConnectionType: "JDBC",
          ConnectionProperties: {
            JDBC_CONNECTION_URL: "jdbc:postgresql://localhost:5432/testdb",
            USERNAME: "admin",
            PASSWORD: "secret",
          },
          Description: "e2e connection",
        },
      }),
    );

    const got = await client.send(new GetConnectionCommand({ Name: connName }));
    expect(got.Connection?.Name).toBe(connName);
    expect(got.Connection?.ConnectionType).toBe("JDBC");
    expect(got.Connection?.Description).toBe("e2e connection");
    expect(got.Connection?.CreationTime).toBeInstanceOf(Date);

    const list = await client.send(new GetConnectionsCommand({}));
    const names = (list.ConnectionList ?? []).map((c) => c.Name);
    expect(names).toContain(connName);

    const secondConn = "e2e_jdbc_conn2";
    await client.send(
      new CreateConnectionCommand({
        ConnectionInput: {
          Name: secondConn,
          ConnectionType: "JDBC",
          ConnectionProperties: { JDBC_CONNECTION_URL: "jdbc:mysql://host/db" },
        },
      }),
    );

    const batchDel = await client.send(
      new BatchDeleteConnectionCommand({
        ConnectionNameList: [connName, secondConn],
      }),
    );
    expect(batchDel.Succeeded).toContain(connName);
    expect(batchDel.Succeeded).toContain(secondConn);

    await expect(
      client.send(new GetConnectionCommand({ Name: connName })),
    ).rejects.toThrow();
  });

  test("delete connection individually", async () => {
    const client = glue();
    const connName = "e2e_del_conn";

    await client.send(
      new CreateConnectionCommand({
        ConnectionInput: {
          Name: connName,
          ConnectionType: "NETWORK",
          ConnectionProperties: {},
        },
      }),
    );

    await client.send(
      new DeleteConnectionCommand({ ConnectionName: connName }),
    );
    await expect(
      client.send(new GetConnectionCommand({ Name: connName })),
    ).rejects.toThrow();
  });

  test("classifier lifecycle (grok)", async () => {
    const client = glue();
    const classifierName = "e2e_grok_clf";

    await client.send(
      new CreateClassifierCommand({
        GrokClassifier: {
          Name: classifierName,
          Classification: "custom-log",
          GrokPattern: "%{TIMESTAMP_ISO8601:timestamp} %{GREEDYDATA:message}",
        },
      }),
    );

    const got = await client.send(
      new GetClassifierCommand({ Name: classifierName }),
    );
    expect(got.Classifier?.GrokClassifier?.Name).toBe(classifierName);
    expect(got.Classifier?.GrokClassifier?.Classification).toBe("custom-log");
    expect(got.Classifier?.GrokClassifier?.CreationTime).toBeInstanceOf(Date);

    const list = await client.send(new GetClassifiersCommand({}));
    const names = (list.Classifiers ?? [])
      .map((c) => c.GrokClassifier?.Name)
      .filter(Boolean);
    expect(names).toContain(classifierName);

    await client.send(new DeleteClassifierCommand({ Name: classifierName }));
    await expect(
      client.send(new GetClassifierCommand({ Name: classifierName })),
    ).rejects.toThrow();
  });

  test("batch delete tables", async () => {
    const client = glue();
    const dbName = "e2e_bdt_db";
    await client.send(
      new CreateDatabaseCommand({ DatabaseInput: { Name: dbName } }),
    );
    for (const t of ["t1", "t2", "t3"]) {
      await client.send(
        new CreateTableCommand({
          DatabaseName: dbName,
          TableInput: { Name: t },
        }),
      );
    }
    const result = await client.send(
      new BatchDeleteTableCommand({
        DatabaseName: dbName,
        TablesToDelete: ["t1", "t2", "t9999"],
      }),
    );
    expect(result.Errors?.length).toBe(1);
    expect(result.Errors?.[0]?.TableName).toBe("t9999");
  });
});
