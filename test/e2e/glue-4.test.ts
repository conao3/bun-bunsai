import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchGetCrawlersCommand,
  BatchGetJobsCommand,
  BatchGetTriggersCommand,
  CreateCrawlerCommand,
  CreateJobCommand,
  CreateTriggerCommand,
  DeleteTriggerCommand,
  GetCrawlerMetricsCommand,
  GetJobBookmarkCommand,
  GetTriggerCommand,
  GetTriggersCommand,
  GlueClient,
  ListCrawlersCommand,
  ListJobsCommand,
  ListTriggersCommand,
  ResetJobBookmarkCommand,
} from "@aws-sdk/client-glue";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("glue triggers, batch ops, list ops e2e", () => {
  const glue = () =>
    new GlueClient({ endpoint, region, credentials, requestHandler });

  test("trigger create -> get -> list -> batch -> delete lifecycle", async () => {
    const client = glue();
    const triggerName = "e2e_trigger_scheduled";

    await client.send(
      new CreateTriggerCommand({
        Name: triggerName,
        Type: "SCHEDULED",
        Schedule: "cron(0 12 * * ? *)",
        Actions: [{ JobName: "some-job" }],
        Description: "e2e scheduled trigger",
      }),
    );

    const got = await client.send(new GetTriggerCommand({ Name: triggerName }));
    expect(got.Trigger?.Name).toBe(triggerName);
    expect(got.Trigger?.Type).toBe("SCHEDULED");
    expect(got.Trigger?.Schedule).toBe("cron(0 12 * * ? *)");
    expect(got.Trigger?.Description).toBe("e2e scheduled trigger");
    expect(got.Trigger?.State).toBe("CREATED");

    const second = "e2e_trigger_conditional";
    await client.send(
      new CreateTriggerCommand({
        Name: second,
        Type: "CONDITIONAL",
        Actions: [{ JobName: "other-job" }],
        Predicate: {
          Conditions: [{ JobName: "dep-job", State: "SUCCEEDED" }],
        },
      }),
    );

    const list = await client.send(new GetTriggersCommand({}));
    const names = (list.Triggers ?? []).map((t) => t.Name);
    expect(names).toContain(triggerName);
    expect(names).toContain(second);

    const listed = await client.send(new ListTriggersCommand({}));
    expect(listed.TriggerNames).toContain(triggerName);
    expect(listed.TriggerNames).toContain(second);

    const batched = await client.send(
      new BatchGetTriggersCommand({
        TriggerNames: [triggerName, "nonexistent-trigger"],
      }),
    );
    expect(batched.Triggers?.length).toBe(1);
    expect(batched.Triggers?.[0]?.Name).toBe(triggerName);
    expect(batched.TriggersNotFound).toContain("nonexistent-trigger");

    await client.send(new DeleteTriggerCommand({ Name: triggerName }));
    await expect(
      client.send(new GetTriggerCommand({ Name: triggerName })),
    ).rejects.toThrow();

    await client.send(new DeleteTriggerCommand({ Name: second }));
  });

  test("batch get crawlers and list crawlers", async () => {
    const client = glue();

    await client.send(
      new CreateCrawlerCommand({
        Name: "e2e_batch_crawler1",
        Role: "arn:aws:iam::000000000000:role/glue",
        DatabaseName: "batch_db",
        Targets: { S3Targets: [{ Path: "s3://bucket/path1" }] },
      }),
    );
    await client.send(
      new CreateCrawlerCommand({
        Name: "e2e_batch_crawler2",
        Role: "arn:aws:iam::000000000000:role/glue",
        DatabaseName: "batch_db",
        Targets: { S3Targets: [{ Path: "s3://bucket/path2" }] },
      }),
    );

    const batch = await client.send(
      new BatchGetCrawlersCommand({
        CrawlerNames: ["e2e_batch_crawler1", "missing_crawler"],
      }),
    );
    expect(batch.Crawlers?.length).toBe(1);
    expect(batch.Crawlers?.[0]?.Name).toBe("e2e_batch_crawler1");
    expect(batch.CrawlersNotFound).toContain("missing_crawler");

    const listResult = await client.send(new ListCrawlersCommand({}));
    expect(listResult.CrawlerNames).toContain("e2e_batch_crawler1");
    expect(listResult.CrawlerNames).toContain("e2e_batch_crawler2");

    const metrics = await client.send(
      new GetCrawlerMetricsCommand({
        CrawlerNameList: ["e2e_batch_crawler1"],
      }),
    );
    expect(metrics.CrawlerMetricsList?.length).toBe(1);
    expect(metrics.CrawlerMetricsList?.[0]?.CrawlerName).toBe(
      "e2e_batch_crawler1",
    );
  });

  test("batch get jobs, list jobs, and job bookmark", async () => {
    const client = glue();

    await client.send(
      new CreateJobCommand({
        Name: "e2e_batch_job1",
        Role: "arn:aws:iam::000000000000:role/glue",
        Command: { Name: "glueetl", ScriptLocation: "s3://bucket/script1.py" },
      }),
    );
    await client.send(
      new CreateJobCommand({
        Name: "e2e_batch_job2",
        Role: "arn:aws:iam::000000000000:role/glue",
        Command: { Name: "glueetl", ScriptLocation: "s3://bucket/script2.py" },
      }),
    );

    const batch = await client.send(
      new BatchGetJobsCommand({
        JobNames: ["e2e_batch_job1", "missing_job"],
      }),
    );
    expect(batch.Jobs?.length).toBe(1);
    expect(batch.Jobs?.[0]?.Name).toBe("e2e_batch_job1");
    expect(batch.JobsNotFound).toContain("missing_job");

    const listResult = await client.send(new ListJobsCommand({}));
    expect(listResult.JobNames).toContain("e2e_batch_job1");
    expect(listResult.JobNames).toContain("e2e_batch_job2");

    const bookmark = await client.send(
      new GetJobBookmarkCommand({ JobName: "e2e_batch_job1" }),
    );
    expect(bookmark.JobBookmarkEntry?.JobName).toBe("e2e_batch_job1");
    expect(bookmark.JobBookmarkEntry?.Run).toBe(0);

    const reset = await client.send(
      new ResetJobBookmarkCommand({ JobName: "e2e_batch_job1" }),
    );
    expect(reset.JobBookmarkEntry?.JobName).toBe("e2e_batch_job1");
    expect(reset.JobBookmarkEntry?.Run).toBe(0);
  });
});
