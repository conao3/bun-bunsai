import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateCrawlerCommand,
  CreateDatabaseCommand,
  GetCrawlerCommand,
  GetCrawlerMetricsCommand,
  GetTableCommand,
  GetTablesCommand,
  GlueClient,
  StartCrawlerCommand,
  StopCrawlerCommand,
} from "@aws-sdk/client-glue";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new GlueClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

test("StartCrawler creates catalog table from S3 target", async () => {
  await client.send(
    new CreateDatabaseCommand({
      DatabaseInput: { Name: "e2e_crawl_db22" },
    }),
  );

  await client.send(
    new CreateCrawlerCommand({
      Name: "e2e_crawler22",
      Role: "arn:aws:iam::000000000000:role/glue",
      DatabaseName: "e2e_crawl_db22",
      Targets: { S3Targets: [{ Path: "s3://mybucket/mydata" }] },
    }),
  );

  await client.send(new StartCrawlerCommand({ Name: "e2e_crawler22" }));

  const tables = await client.send(
    new GetTablesCommand({ DatabaseName: "e2e_crawl_db22" }),
  );
  expect(tables.TableList).toBeDefined();
  expect((tables.TableList ?? []).length).toBeGreaterThanOrEqual(1);

  const tableNames = (tables.TableList ?? []).map((t) => t.Name);
  expect(tableNames).toContain("mydata");

  const tbl = await client.send(
    new GetTableCommand({ DatabaseName: "e2e_crawl_db22", Name: "mydata" }),
  );
  expect(tbl.Table?.Name).toBe("mydata");
  expect(tbl.Table?.TableType).toBe("EXTERNAL_TABLE");
  expect(tbl.Table?.StorageDescriptor?.Location).toBe("s3://mybucket/mydata");
});

test("GetCrawler shows READY state with LastCrawl after StartCrawler", async () => {
  const got = await client.send(
    new GetCrawlerCommand({ Name: "e2e_crawler22" }),
  );
  expect(got.Crawler?.State).toBe("READY");
  expect(got.Crawler?.LastCrawl).toBeDefined();
  expect(got.Crawler?.LastCrawl?.Status).toBe("SUCCEEDED");
  expect(got.Crawler?.LastCrawl?.StartTime).toBeInstanceOf(Date);
});

test("GetCrawlerMetrics reflects TablesCreated count", async () => {
  const metrics = await client.send(
    new GetCrawlerMetricsCommand({ CrawlerNameList: ["e2e_crawler22"] }),
  );
  expect(metrics.CrawlerMetricsList?.length).toBe(1);
  expect(metrics.CrawlerMetricsList?.[0]?.CrawlerName).toBe("e2e_crawler22");
  expect(metrics.CrawlerMetricsList?.[0]?.TablesCreated).toBeGreaterThan(0);
});

test("StartCrawler with TablePrefix prepends to table name", async () => {
  await client.send(
    new CreateDatabaseCommand({
      DatabaseInput: { Name: "e2e_crawl_db22b" },
    }),
  );

  await client.send(
    new CreateCrawlerCommand({
      Name: "e2e_crawler22b",
      Role: "arn:aws:iam::000000000000:role/glue",
      DatabaseName: "e2e_crawl_db22b",
      Targets: { S3Targets: [{ Path: "s3://bucket/events" }] },
      TablePrefix: "prefix_",
    }),
  );

  await client.send(new StartCrawlerCommand({ Name: "e2e_crawler22b" }));

  const tables = await client.send(
    new GetTablesCommand({ DatabaseName: "e2e_crawl_db22b" }),
  );
  const tableNames = (tables.TableList ?? []).map((t) => t.Name);
  expect(tableNames).toContain("prefix_events");
});

test("StopCrawler on non-running crawler throws CrawlerNotRunningException", async () => {
  await expect(
    client.send(new StopCrawlerCommand({ Name: "e2e_crawler22" })),
  ).rejects.toMatchObject({ name: "CrawlerNotRunningException" });
});

test("StartCrawler again re-runs and updates existing table (tablesCreated=0)", async () => {
  await client.send(new StartCrawlerCommand({ Name: "e2e_crawler22" }));

  const tables = await client.send(
    new GetTablesCommand({ DatabaseName: "e2e_crawl_db22" }),
  );
  expect((tables.TableList ?? []).length).toBeGreaterThanOrEqual(1);

  const metrics = await client.send(
    new GetCrawlerMetricsCommand({ CrawlerNameList: ["e2e_crawler22"] }),
  );
  expect(metrics.CrawlerMetricsList?.[0]?.TablesCreated).toBe(0);
});
