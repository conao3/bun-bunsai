import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AlreadyExistsException,
  BatchCreatePartitionCommand,
  CreateCrawlerCommand,
  CreateDatabaseCommand,
  CreateTableCommand,
  DeleteCrawlerCommand,
  DeleteDatabaseCommand,
  DeleteTableCommand,
  EntityNotFoundException,
  GetCrawlerCommand,
  GetDatabaseCommand,
  GetPartitionsCommand,
  GetTableCommand,
  GetTablesCommand,
  GlueClient,
  StartCrawlerCommand,
  UpdateTableCommand,
} from "@aws-sdk/client-glue";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("Glue data catalog scenario e2e", () => {
  const glue = () =>
    new GlueClient({ endpoint, region, credentials, requestHandler });

  test("data catalog build lifecycle", async () => {
    const client = glue();
    const dbName = "bunsai_e2e_glue_scenario_db";
    const tableName = "bunsai_e2e_glue_scenario_events";
    const crawlerName = "bunsai-e2e-glue-scenario-crawler";

    await client.send(
      new CreateDatabaseCommand({
        DatabaseInput: { Name: dbName, Description: "scenario db" },
      }),
    );
    const gotDb = await client.send(new GetDatabaseCommand({ Name: dbName }));
    expect(gotDb.Database?.Name).toBe(dbName);
    expect(gotDb.Database?.Description).toBe("scenario db");
    expect(gotDb.Database?.CreateTime).toBeInstanceOf(Date);

    await client.send(
      new CreateTableCommand({
        DatabaseName: dbName,
        TableInput: {
          Name: tableName,
          TableType: "EXTERNAL_TABLE",
          StorageDescriptor: {
            Columns: [
              { Name: "id", Type: "bigint" },
              { Name: "event_type", Type: "string" },
              { Name: "payload", Type: "string" },
            ],
            Location: "s3://bunsai-scenario/events",
          },
          PartitionKeys: [
            { Name: "year", Type: "string" },
            { Name: "month", Type: "string" },
          ],
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
      "s3://bunsai-scenario/events",
    );
    expect(gotTable.Table?.StorageDescriptor?.Columns).toHaveLength(3);
    expect(gotTable.Table?.PartitionKeys).toHaveLength(2);
    expect(gotTable.Table?.PartitionKeys?.[0]?.Name).toBe("year");

    const tableList = await client.send(
      new GetTablesCommand({ DatabaseName: dbName }),
    );
    expect((tableList.TableList ?? []).map((t) => t.Name)).toContain(tableName);

    let dupErr: unknown;
    try {
      await client.send(
        new CreateTableCommand({
          DatabaseName: dbName,
          TableInput: { Name: tableName },
        }),
      );
    } catch (e) {
      dupErr = e;
    }
    expect(dupErr).toBeInstanceOf(AlreadyExistsException);

    const batchResult = await client.send(
      new BatchCreatePartitionCommand({
        DatabaseName: dbName,
        TableName: tableName,
        PartitionInputList: [
          {
            Values: ["2024", "01"],
            StorageDescriptor: {
              Location: "s3://bunsai-scenario/events/year=2024/month=01",
            },
          },
          {
            Values: ["2024", "02"],
            StorageDescriptor: {
              Location: "s3://bunsai-scenario/events/year=2024/month=02",
            },
          },
          {
            Values: ["2023", "12"],
            StorageDescriptor: {
              Location: "s3://bunsai-scenario/events/year=2023/month=12",
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

    const yearFiltered = await client.send(
      new GetPartitionsCommand({
        DatabaseName: dbName,
        TableName: tableName,
        Expression: "year='2024'",
      }),
    );
    expect(yearFiltered.Partitions).toHaveLength(2);
    expect(
      (yearFiltered.Partitions ?? []).every((p) => p.Values?.[0] === "2024"),
    ).toBe(true);

    const andFiltered = await client.send(
      new GetPartitionsCommand({
        DatabaseName: dbName,
        TableName: tableName,
        Expression: "year='2024' AND month='02'",
      }),
    );
    expect(andFiltered.Partitions).toHaveLength(1);
    expect(andFiltered.Partitions?.[0]?.Values).toEqual(["2024", "02"]);

    await client.send(
      new UpdateTableCommand({
        DatabaseName: dbName,
        TableInput: {
          Name: tableName,
          TableType: "VIRTUAL_VIEW",
          StorageDescriptor: {
            Columns: [
              { Name: "id", Type: "bigint" },
              { Name: "event_type", Type: "string" },
              { Name: "payload", Type: "string" },
              { Name: "metadata", Type: "map<string,string>" },
            ],
            Location: "s3://bunsai-scenario/events",
          },
          PartitionKeys: [
            { Name: "year", Type: "string" },
            { Name: "month", Type: "string" },
          ],
        },
      }),
    );
    const updatedTable = await client.send(
      new GetTableCommand({ DatabaseName: dbName, Name: tableName }),
    );
    expect(updatedTable.Table?.TableType).toBe("VIRTUAL_VIEW");
    expect(updatedTable.Table?.StorageDescriptor?.Columns).toHaveLength(4);

    await client.send(
      new CreateCrawlerCommand({
        Name: crawlerName,
        Role: "arn:aws:iam::123456789012:role/GlueRole",
        DatabaseName: dbName,
        Targets: {
          S3Targets: [{ Path: "s3://bunsai-scenario/crawled" }],
        },
      }),
    );
    const readyCrawler = await client.send(
      new GetCrawlerCommand({ Name: crawlerName }),
    );
    expect(readyCrawler.Crawler?.State).toBe("READY");

    await client.send(new StartCrawlerCommand({ Name: crawlerName }));
    const doneCrawler = await client.send(
      new GetCrawlerCommand({ Name: crawlerName }),
    );
    expect(doneCrawler.Crawler?.State).toBe("READY");
    expect(doneCrawler.Crawler?.LastCrawl?.Status).toBe("SUCCEEDED");

    const afterCrawl = await client.send(
      new GetTablesCommand({ DatabaseName: dbName }),
    );
    expect((afterCrawl.TableList ?? []).map((t) => t.Name)).toContain(
      "crawled",
    );

    await client.send(
      new DeleteTableCommand({ DatabaseName: dbName, Name: tableName }),
    );
    let tableDelErr: unknown;
    try {
      await client.send(
        new GetTableCommand({ DatabaseName: dbName, Name: tableName }),
      );
    } catch (e) {
      tableDelErr = e;
    }
    expect(tableDelErr).toBeInstanceOf(EntityNotFoundException);

    await client.send(new DeleteCrawlerCommand({ Name: crawlerName }));
    await client.send(new DeleteDatabaseCommand({ Name: dbName }));
    let dbDelErr: unknown;
    try {
      await client.send(new GetDatabaseCommand({ Name: dbName }));
    } catch (e) {
      dbDelErr = e;
    }
    expect(dbDelErr).toBeInstanceOf(EntityNotFoundException);
  }, 20_000);
});
