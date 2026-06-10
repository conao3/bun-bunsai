import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateCrawlerCommand,
  CreateDataQualityRulesetCommand,
  CreateJobCommand,
  DeleteCrawlerCommand,
  DeleteJobCommand,
  GetCrawlersCommand,
  GetDatabasesCommand,
  GetJobsCommand,
  GetTagsCommand,
  GlueClient,
  TagResourceCommand,
} from "@aws-sdk/client-glue";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const account = "000000000000";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new GlueClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

test("GetDatabases pagination via MaxResults + NextToken round-trip", async () => {
  const prefix = "pgdb_con2013_";
  const total = 7;
  const CreateDatabaseCommand = (await import("@aws-sdk/client-glue"))
    .CreateDatabaseCommand;
  for (let i = 0; i < total; i++) {
    await client.send(
      new CreateDatabaseCommand({
        DatabaseInput: { Name: `${prefix}${i}` },
      }),
    );
  }

  const page1 = await client.send(new GetDatabasesCommand({ MaxResults: 5 }));
  expect(Array.isArray(page1.DatabaseList)).toBe(true);
  expect(page1.DatabaseList!.length).toBeLessThanOrEqual(5);
  expect(typeof page1.NextToken).toBe("string");

  const page2 = await client.send(
    new GetDatabasesCommand({
      MaxResults: 5,
      NextToken: page1.NextToken,
    }),
  );
  expect(Array.isArray(page2.DatabaseList)).toBe(true);

  const allNames = [
    ...(page1.DatabaseList ?? []).map((d) => d.Name!),
    ...(page2.DatabaseList ?? []).map((d) => d.Name!),
  ].filter((n) => n.startsWith(prefix));
  const uniqueNames = new Set(allNames);
  expect(uniqueNames.size).toBe(total);
});

test("GetCrawlers pagination via MaxResults + NextToken", async () => {
  const prefix = "pgcrawler_con2013_";
  const total = 4;
  for (let i = 0; i < total; i++) {
    await client.send(
      new CreateCrawlerCommand({
        Name: `${prefix}${i}`,
        Role: "arn:aws:iam::123456789012:role/GlueRole",
        Targets: { S3Targets: [{ Path: `s3://bucket/${i}` }] },
      }),
    );
  }

  const page1 = await client.send(new GetCrawlersCommand({ MaxResults: 2 }));
  expect(page1.Crawlers!.length).toBeLessThanOrEqual(2);
  expect(typeof page1.NextToken).toBe("string");

  const page2 = await client.send(
    new GetCrawlersCommand({ MaxResults: 100, NextToken: page1.NextToken }),
  );
  expect(Array.isArray(page2.Crawlers)).toBe(true);

  const allCrawlerNames = [
    ...(page1.Crawlers ?? []).map((c) => c.Name!),
    ...(page2.Crawlers ?? []).map((c) => c.Name!),
  ].filter((n) => n.startsWith(prefix));
  expect(new Set(allCrawlerNames).size).toBe(total);
});

test("GetJobs pagination via MaxResults + NextToken", async () => {
  const prefix = "pgjob_con2013_";
  const total = 4;
  for (let i = 0; i < total; i++) {
    await client.send(
      new CreateJobCommand({
        Name: `${prefix}${i}`,
        Role: "arn:aws:iam::123456789012:role/GlueRole",
        Command: { Name: "glueetl", ScriptLocation: "s3://bucket/script.py" },
      }),
    );
  }

  const page1 = await client.send(new GetJobsCommand({ MaxResults: 2 }));
  expect(page1.Jobs!.length).toBeLessThanOrEqual(2);
  expect(typeof page1.NextToken).toBe("string");

  const page2 = await client.send(
    new GetJobsCommand({ MaxResults: 100, NextToken: page1.NextToken }),
  );
  expect(Array.isArray(page2.Jobs)).toBe(true);

  const allJobNames = [
    ...(page1.Jobs ?? []).map((j) => j.Name!),
    ...(page2.Jobs ?? []).map((j) => j.Name!),
  ].filter((n) => n.startsWith(prefix));
  expect(new Set(allJobNames).size).toBe(total);
});

test("DeleteCrawler removes associated tags", async () => {
  const name = "tagclean_crawler_con2013";
  const arn = `arn:aws:glue:${region}:${account}:crawler/${name}`;
  await client.send(
    new CreateCrawlerCommand({
      Name: name,
      Role: "arn:aws:iam::123456789012:role/GlueRole",
      Targets: { S3Targets: [{ Path: "s3://bucket/data" }] },
    }),
  );
  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      TagsToAdd: { env: "test", owner: "con2013" },
    }),
  );
  const before = await client.send(new GetTagsCommand({ ResourceArn: arn }));
  expect(before.Tags?.["env"]).toBe("test");

  await client.send(new DeleteCrawlerCommand({ Name: name }));

  const after = await client.send(new GetTagsCommand({ ResourceArn: arn }));
  expect(Object.keys(after.Tags ?? {}).length).toBe(0);
});

test("DeleteJob removes associated tags", async () => {
  const name = "tagclean_job_con2013";
  const arn = `arn:aws:glue:${region}:${account}:job/${name}`;
  await client.send(
    new CreateJobCommand({
      Name: name,
      Role: "arn:aws:iam::123456789012:role/GlueRole",
      Command: { Name: "glueetl", ScriptLocation: "s3://bucket/script.py" },
    }),
  );
  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      TagsToAdd: { env: "prod", team: "data" },
    }),
  );
  const before = await client.send(new GetTagsCommand({ ResourceArn: arn }));
  expect(before.Tags?.["env"]).toBe("prod");

  await client.send(new DeleteJobCommand({ JobName: name }));

  const after = await client.send(new GetTagsCommand({ ResourceArn: arn }));
  expect(Object.keys(after.Tags ?? {}).length).toBe(0);
});

test("CreateDataQualityRuleset idempotency via ClientToken", async () => {
  const token = "idempotency-token-con2013-unique";
  const res1 = await client.send(
    new CreateDataQualityRulesetCommand({
      Name: "dq_ruleset_idem_con2013",
      Ruleset: "Rules = []",
      ClientToken: token,
    }),
  );
  expect(res1.Name).toBe("dq_ruleset_idem_con2013");

  const res2 = await client.send(
    new CreateDataQualityRulesetCommand({
      Name: "dq_ruleset_idem_con2013_other",
      Ruleset: "Rules = []",
      ClientToken: token,
    }),
  );
  expect(res2.Name).toBe("dq_ruleset_idem_con2013");
});
