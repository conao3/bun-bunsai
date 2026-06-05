import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateCrawlerCommand,
  CreateJobCommand,
  DeleteCrawlerCommand,
  DeleteJobCommand,
  GetCrawlerCommand,
  GetCrawlersCommand,
  GetJobCommand,
  GetJobsCommand,
  GlueClient,
} from "@aws-sdk/client-glue";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("glue crawler and job e2e", () => {
  const glue = () =>
    new GlueClient({ endpoint, region, credentials, requestHandler });

  test("crawler roundtrip", async () => {
    const client = glue();
    const crawlerName = "bunsai_e2e_crawler";

    await client.send(
      new CreateCrawlerCommand({
        Name: crawlerName,
        Role: "arn:aws:iam::000000000000:role/glue",
        DatabaseName: "bunsai_e2e_db",
        Description: "e2e crawler",
        Targets: { S3Targets: [{ Path: "s3://bunsai/crawl" }] },
        TablePrefix: "bunsai_",
        Schedule: "cron(0 12 * * ? *)",
      }),
    );

    const got = await client.send(new GetCrawlerCommand({ Name: crawlerName }));
    expect(got.Crawler?.Name).toBe(crawlerName);
    expect(got.Crawler?.Role).toBe("arn:aws:iam::000000000000:role/glue");
    expect(got.Crawler?.DatabaseName).toBe("bunsai_e2e_db");
    expect(got.Crawler?.Description).toBe("e2e crawler");
    expect(got.Crawler?.TablePrefix).toBe("bunsai_");
    expect(got.Crawler?.Targets?.S3Targets?.[0]?.Path).toBe(
      "s3://bunsai/crawl",
    );
    expect(got.Crawler?.Schedule?.ScheduleExpression).toBe(
      "cron(0 12 * * ? *)",
    );
    expect(got.Crawler?.State).toBe("READY");
    expect(got.Crawler?.CreationTime).toBeInstanceOf(Date);

    const list = await client.send(new GetCrawlersCommand({}));
    const names = (list.Crawlers ?? []).map((c) => c.Name);
    expect(names).toContain(crawlerName);

    await client.send(new DeleteCrawlerCommand({ Name: crawlerName }));
    await expect(
      client.send(new GetCrawlerCommand({ Name: crawlerName })),
    ).rejects.toThrow();
  });

  test("job roundtrip", async () => {
    const client = glue();
    const jobName = "bunsai_e2e_job";

    const created = await client.send(
      new CreateJobCommand({
        Name: jobName,
        Role: "arn:aws:iam::000000000000:role/glue",
        Description: "e2e job",
        Command: {
          Name: "glueetl",
          ScriptLocation: "s3://bunsai/script.py",
          PythonVersion: "3",
        },
        DefaultArguments: { "--job-language": "python" },
        GlueVersion: "4.0",
        WorkerType: "G.1X",
        NumberOfWorkers: 2,
        MaxRetries: 1,
        Timeout: 2880,
      }),
    );
    expect(created.Name).toBe(jobName);

    const got = await client.send(new GetJobCommand({ JobName: jobName }));
    expect(got.Job?.Name).toBe(jobName);
    expect(got.Job?.Role).toBe("arn:aws:iam::000000000000:role/glue");
    expect(got.Job?.Description).toBe("e2e job");
    expect(got.Job?.Command?.Name).toBe("glueetl");
    expect(got.Job?.Command?.ScriptLocation).toBe("s3://bunsai/script.py");
    expect(got.Job?.DefaultArguments?.["--job-language"]).toBe("python");
    expect(got.Job?.GlueVersion).toBe("4.0");
    expect(got.Job?.WorkerType).toBe("G.1X");
    expect(got.Job?.NumberOfWorkers).toBe(2);
    expect(got.Job?.MaxRetries).toBe(1);
    expect(got.Job?.Timeout).toBe(2880);
    expect(got.Job?.CreatedOn).toBeInstanceOf(Date);

    const list = await client.send(new GetJobsCommand({}));
    const names = (list.Jobs ?? []).map((j) => j.Name);
    expect(names).toContain(jobName);

    const deleted = await client.send(
      new DeleteJobCommand({ JobName: jobName }),
    );
    expect(deleted.JobName).toBe(jobName);
    await expect(
      client.send(new GetJobCommand({ JobName: jobName })),
    ).rejects.toThrow();
  });

  test("get missing crawler throws", async () => {
    const client = glue();
    await expect(
      client.send(new GetCrawlerCommand({ Name: "no-such-crawler" })),
    ).rejects.toThrow();
  });

  test("get missing job throws", async () => {
    const client = glue();
    await expect(
      client.send(new GetJobCommand({ JobName: "no-such-job" })),
    ).rejects.toThrow();
  });
});
