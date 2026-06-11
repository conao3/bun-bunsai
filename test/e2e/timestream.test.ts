import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDatabaseCommand,
  CreateTableCommand,
  DeleteDatabaseCommand,
  DeleteTableCommand,
  DescribeDatabaseCommand,
  DescribeTableCommand,
  ListDatabasesCommand,
  ListTablesCommand,
  TagResourceCommand,
  TimestreamWriteClient,
  UntagResourceCommand,
  UpdateDatabaseCommand,
  UpdateTableCommand,
  WriteRecordsCommand,
  type _Record,
} from "@aws-sdk/client-timestream-write";
import {
  QueryCommand,
  TimestreamQueryClient,
} from "@aws-sdk/client-timestream-query";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const writeClient = () =>
  new TimestreamWriteClient({
    region,
    credentials,
    requestHandler,
  });

const queryClient = () =>
  new TimestreamQueryClient({
    region,
    credentials,
    requestHandler,
  });

test("Timestream endpoint discovery works", async () => {
  const wc = new TimestreamWriteClient({
    region,
    credentials,
    requestHandler,
  });
  const db = await wc.send(
    new CreateDatabaseCommand({ DatabaseName: "discovery-test-db" }),
  );
  expect(db.Database?.DatabaseName).toBe("discovery-test-db");
  await wc.send(
    new DeleteDatabaseCommand({ DatabaseName: "discovery-test-db" }),
  );
});

test("Timestream database CRUD", async () => {
  const wc = writeClient();
  const dbName = "e2e-test-db";

  const created = await wc.send(
    new CreateDatabaseCommand({ DatabaseName: dbName }),
  );
  expect(created.Database?.DatabaseName).toBe(dbName);
  expect(created.Database?.Arn).toContain(dbName);

  const described = await wc.send(
    new DescribeDatabaseCommand({ DatabaseName: dbName }),
  );
  expect(described.Database?.DatabaseName).toBe(dbName);

  const listed = await wc.send(new ListDatabasesCommand({}));
  expect(
    (listed.Databases ?? []).some((d) => d.DatabaseName === dbName),
  ).toBeTrue();

  await wc.send(
    new UpdateDatabaseCommand({
      DatabaseName: dbName,
      KmsKeyId: "fake-key-id",
    }),
  );

  const afterUpdate = await wc.send(
    new DescribeDatabaseCommand({ DatabaseName: dbName }),
  );
  expect(afterUpdate.Database?.KmsKeyId).toBe("fake-key-id");

  await wc.send(new DeleteDatabaseCommand({ DatabaseName: dbName }));

  const listedAfter = await wc.send(new ListDatabasesCommand({}));
  expect(
    (listedAfter.Databases ?? []).some((d) => d.DatabaseName === dbName),
  ).toBeFalse();
});

test("Timestream table CRUD", async () => {
  const wc = writeClient();
  const dbName = "e2e-table-db";
  const tableName = "e2e-table";

  await wc.send(new CreateDatabaseCommand({ DatabaseName: dbName }));

  const created = await wc.send(
    new CreateTableCommand({ DatabaseName: dbName, TableName: tableName }),
  );
  expect(created.Table?.TableName).toBe(tableName);
  expect(created.Table?.DatabaseName).toBe(dbName);
  expect(created.Table?.TableStatus).toBe("ACTIVE");

  const described = await wc.send(
    new DescribeTableCommand({ DatabaseName: dbName, TableName: tableName }),
  );
  expect(described.Table?.TableName).toBe(tableName);

  const listed = await wc.send(new ListTablesCommand({ DatabaseName: dbName }));
  expect(
    (listed.Tables ?? []).some((t) => t.TableName === tableName),
  ).toBeTrue();

  await wc.send(
    new UpdateTableCommand({
      DatabaseName: dbName,
      TableName: tableName,
      RetentionProperties: {
        MemoryStoreRetentionPeriodInHours: 24,
        MagneticStoreRetentionPeriodInDays: 365,
      },
    }),
  );

  const afterUpdate = await wc.send(
    new DescribeTableCommand({ DatabaseName: dbName, TableName: tableName }),
  );
  expect(
    afterUpdate.Table?.RetentionProperties?.MemoryStoreRetentionPeriodInHours,
  ).toBe(24);

  await wc.send(
    new DeleteTableCommand({ DatabaseName: dbName, TableName: tableName }),
  );

  const listedAfter = await wc.send(
    new ListTablesCommand({ DatabaseName: dbName }),
  );
  expect(
    (listedAfter.Tables ?? []).some((t) => t.TableName === tableName),
  ).toBeFalse();

  await wc.send(new DeleteDatabaseCommand({ DatabaseName: dbName }));
});

test("Timestream WriteRecords and Query", async () => {
  const wc = writeClient();
  const qc = queryClient();
  const dbName = "e2e-write-query-db";
  const tableName = "e2e-metrics";

  await wc.send(new CreateDatabaseCommand({ DatabaseName: dbName }));
  await wc.send(
    new CreateTableCommand({ DatabaseName: dbName, TableName: tableName }),
  );

  const now = Date.now();
  const records: _Record[] = [
    {
      Dimensions: [
        { Name: "host", Value: "server1" },
        { Name: "region", Value: "us-east-1" },
      ],
      MeasureName: "cpu_usage",
      MeasureValue: "72.5",
      MeasureValueType: "DOUBLE",
      Time: String(now - 2000),
      TimeUnit: "MILLISECONDS",
    },
    {
      Dimensions: [
        { Name: "host", Value: "server2" },
        { Name: "region", Value: "us-west-2" },
      ],
      MeasureName: "cpu_usage",
      MeasureValue: "45.1",
      MeasureValueType: "DOUBLE",
      Time: String(now - 1000),
      TimeUnit: "MILLISECONDS",
    },
    {
      Dimensions: [
        { Name: "host", Value: "server1" },
        { Name: "region", Value: "us-east-1" },
      ],
      MeasureName: "memory_usage",
      MeasureValue: "85.3",
      MeasureValueType: "DOUBLE",
      Time: String(now),
      TimeUnit: "MILLISECONDS",
    },
  ];

  const writeResult = await wc.send(
    new WriteRecordsCommand({
      DatabaseName: dbName,
      TableName: tableName,
      Records: records,
    }),
  );
  expect(writeResult.RecordsIngested?.Total).toBe(3);
  expect(writeResult.RecordsIngested?.MemoryStore).toBe(3);

  const allRows = await qc.send(
    new QueryCommand({
      QueryString: `SELECT * FROM "${dbName}"."${tableName}"`,
    }),
  );
  expect(allRows.Rows?.length).toBe(3);
  expect(allRows.ColumnInfo?.some((c) => c.Name === "host")).toBeTrue();
  expect(allRows.ColumnInfo?.some((c) => c.Name === "measure_name")).toBeTrue();
  expect(
    allRows.ColumnInfo?.some((c) => c.Name === "measure_value"),
  ).toBeTrue();

  const filteredRows = await qc.send(
    new QueryCommand({
      QueryString: `SELECT * FROM "${dbName}"."${tableName}" WHERE host = 'server1'`,
    }),
  );
  expect(filteredRows.Rows?.length).toBe(2);

  const limitedRows = await qc.send(
    new QueryCommand({
      QueryString: `SELECT * FROM "${dbName}"."${tableName}" LIMIT 2`,
    }),
  );
  expect(limitedRows.Rows?.length).toBe(2);

  await wc.send(new DeleteDatabaseCommand({ DatabaseName: dbName }));
});

test("Timestream tag operations", async () => {
  const wc = writeClient();
  const dbName = "e2e-tag-db";

  const created = await wc.send(
    new CreateDatabaseCommand({
      DatabaseName: dbName,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const arn = created.Database?.Arn ?? "";
  expect(arn).toBeTruthy();

  await wc.send(
    new TagResourceCommand({
      ResourceARN: arn,
      Tags: [{ Key: "project", Value: "bunsai" }],
    }),
  );

  await wc.send(
    new UntagResourceCommand({ ResourceARN: arn, TagKeys: ["env"] }),
  );

  await wc.send(new DeleteDatabaseCommand({ DatabaseName: dbName }));
});

test("Timestream WriteRecords with CommonAttributes", async () => {
  const wc = writeClient();
  const dbName = "e2e-common-attrs-db";
  const tableName = "e2e-common-table";

  await wc.send(new CreateDatabaseCommand({ DatabaseName: dbName }));
  await wc.send(
    new CreateTableCommand({ DatabaseName: dbName, TableName: tableName }),
  );

  const now = Date.now();
  await wc.send(
    new WriteRecordsCommand({
      DatabaseName: dbName,
      TableName: tableName,
      CommonAttributes: {
        Dimensions: [{ Name: "service", Value: "api" }],
        TimeUnit: "MILLISECONDS",
        MeasureValueType: "DOUBLE",
      },
      Records: [
        {
          MeasureName: "latency",
          MeasureValue: "120",
          Time: String(now),
        },
        {
          MeasureName: "error_rate",
          MeasureValue: "0.01",
          Time: String(now + 1),
        },
      ],
    }),
  );

  const result = await queryClient().send(
    new QueryCommand({
      QueryString: `SELECT * FROM "${dbName}"."${tableName}"`,
    }),
  );
  expect(result.Rows?.length).toBe(2);

  await wc.send(new DeleteDatabaseCommand({ DatabaseName: dbName }));
});
