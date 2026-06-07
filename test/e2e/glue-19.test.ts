import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateCrawlerCommand,
  CreateDataQualityRulesetCommand,
  GetCrawlerCommand,
  GetDataQualityRulesetCommand,
  GetTagsCommand,
  GlueClient,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateCrawlerCommand,
  UpdateDataQualityRulesetCommand,
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

test("UpdateCrawler → GetCrawler reflects updated fields", async () => {
  await client.send(
    new CreateCrawlerCommand({
      Name: "e2e_crawler_chunk19",
      Role: "arn:aws:iam::123456789012:role/GlueRole",
      DatabaseName: "db1",
      Targets: { S3Targets: [{ Path: "s3://bucket/path" }] },
    }),
  );

  await client.send(
    new UpdateCrawlerCommand({
      Name: "e2e_crawler_chunk19",
      Role: "arn:aws:iam::123456789012:role/GlueRoleUpdated",
      Description: "updated description",
    }),
  );

  const after = await client.send(
    new GetCrawlerCommand({ Name: "e2e_crawler_chunk19" }),
  );
  expect(after.Crawler?.Name).toBe("e2e_crawler_chunk19");
  expect(after.Crawler?.Role).toBe(
    "arn:aws:iam::123456789012:role/GlueRoleUpdated",
  );
  expect(after.Crawler?.Description).toBe("updated description");
  expect(after.Crawler?.DatabaseName).toBe("db1");
});

test("UpdateCrawler on missing crawler throws EntityNotFoundException", async () => {
  await expect(
    client.send(new UpdateCrawlerCommand({ Name: "no-such-crawler-chunk19" })),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});

test("TagResource → UntagResource → GetTags omits removed tag", async () => {
  const arn = "arn:aws:glue:us-east-1:123456789012:crawler/e2e_crawler_chunk19";

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      TagsToAdd: { env: "test", team: "platform", owner: "chunk19" },
    }),
  );

  const before = await client.send(new GetTagsCommand({ ResourceArn: arn }));
  expect(before.Tags?.["env"]).toBe("test");
  expect(before.Tags?.["team"]).toBe("platform");
  expect(before.Tags?.["owner"]).toBe("chunk19");

  await client.send(
    new UntagResourceCommand({
      ResourceArn: arn,
      TagsToRemove: ["env", "team"],
    }),
  );

  const after = await client.send(new GetTagsCommand({ ResourceArn: arn }));
  expect(after.Tags?.["env"]).toBeUndefined();
  expect(after.Tags?.["team"]).toBeUndefined();
  expect(after.Tags?.["owner"]).toBe("chunk19");
});

test("UpdateDataQualityRuleset → GetDataQualityRuleset reflects update", async () => {
  await client.send(
    new CreateDataQualityRulesetCommand({
      Name: "e2e_dq_chunk19",
      Ruleset: 'Rules = [IsComplete "col1"]',
      Description: "original",
    }),
  );

  const updated = await client.send(
    new UpdateDataQualityRulesetCommand({
      Name: "e2e_dq_chunk19",
      Ruleset: 'Rules = [IsComplete "col1", IsComplete "col2"]',
      Description: "updated desc",
    }),
  );
  expect(updated.Name).toBe("e2e_dq_chunk19");
  expect(updated.Description).toBe("updated desc");

  const got = await client.send(
    new GetDataQualityRulesetCommand({ Name: "e2e_dq_chunk19" }),
  );
  expect(got.Name).toBe("e2e_dq_chunk19");
  expect(got.Ruleset).toBe('Rules = [IsComplete "col1", IsComplete "col2"]');
  expect(got.Description).toBe("updated desc");
});

test("UpdateDataQualityRuleset on missing ruleset throws EntityNotFoundException", async () => {
  await expect(
    client.send(
      new UpdateDataQualityRulesetCommand({ Name: "no-such-dq-chunk19" }),
    ),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});
