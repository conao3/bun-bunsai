import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateCustomEntityTypeCommand,
  CreateDataQualityRulesetCommand,
  CreateDevEndpointCommand,
  GlueClient,
  ListColumnStatisticsTaskRunsCommand,
  ListConnectionTypesCommand,
  ListCrawlsCommand,
  ListCustomEntityTypesCommand,
  ListDataQualityResultsCommand,
  ListDataQualityRuleRecommendationRunsCommand,
  ListDataQualityRulesetEvaluationRunsCommand,
  ListDataQualityRulesetsCommand,
  ListDataQualityStatisticAnnotationsCommand,
  ListDataQualityStatisticsCommand,
  ListDevEndpointsCommand,
  ListEntitiesCommand,
} from "@aws-sdk/client-glue";

const awsPort = 4949;
const uiPort = 5949;
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

describe("glue chunk-13 list ops e2e", () => {
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

  test("custom-entity-type create → list lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateCustomEntityTypeCommand({
        Name: "e2e_cet_chunk13",
        RegexString: "\\d{3}-\\d{2}-\\d{4}",
        ContextWords: ["SSN", "social"],
      }),
    );

    const list = await client.send(new ListCustomEntityTypesCommand({}));
    expect(Array.isArray(list.CustomEntityTypes)).toBe(true);
    const found = list.CustomEntityTypes?.find(
      (t) => t.Name === "e2e_cet_chunk13",
    );
    expect(found).toBeDefined();
    expect(found?.RegexString).toBe("\\d{3}-\\d{2}-\\d{4}");
    expect(Array.isArray(found?.ContextWords)).toBe(true);
  });

  test("dev-endpoint list returns names", async () => {
    const client = glue();

    await client.send(
      new CreateDevEndpointCommand({
        EndpointName: "e2e_dep_chunk13",
        RoleArn: "arn:aws:iam::123456789012:role/GlueRole",
      }),
    );

    const list = await client.send(new ListDevEndpointsCommand({}));
    expect(Array.isArray(list.DevEndpointNames)).toBe(true);
    expect(list.DevEndpointNames?.includes("e2e_dep_chunk13")).toBe(true);
  });

  test("data-quality ruleset create → list lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateDataQualityRulesetCommand({
        Name: "e2e_dqrs_chunk13",
        Ruleset: "Rules = [ RowCount > 0 ]",
      }),
    );

    const list = await client.send(new ListDataQualityRulesetsCommand({}));
    expect(Array.isArray(list.Rulesets)).toBe(true);
    const found = list.Rulesets?.find((r) => r.Name === "e2e_dqrs_chunk13");
    expect(found).toBeDefined();
  });

  test("empty-list operations return empty arrays", async () => {
    const client = glue();

    const taskRuns = await client.send(
      new ListColumnStatisticsTaskRunsCommand({}),
    );
    expect(Array.isArray(taskRuns.ColumnStatisticsTaskRunIds)).toBe(true);

    const connTypes = await client.send(new ListConnectionTypesCommand({}));
    expect(Array.isArray(connTypes.ConnectionTypes)).toBe(true);

    const crawls = await client.send(
      new ListCrawlsCommand({ CrawlerName: "any" }),
    );
    expect(Array.isArray(crawls.Crawls)).toBe(true);

    const dqResults = await client.send(new ListDataQualityResultsCommand({}));
    expect(Array.isArray(dqResults.Results)).toBe(true);

    const dqRecommRuns = await client.send(
      new ListDataQualityRuleRecommendationRunsCommand({}),
    );
    expect(Array.isArray(dqRecommRuns.Runs)).toBe(true);

    const dqEvalRuns = await client.send(
      new ListDataQualityRulesetEvaluationRunsCommand({}),
    );
    expect(Array.isArray(dqEvalRuns.Runs)).toBe(true);

    const annotations = await client.send(
      new ListDataQualityStatisticAnnotationsCommand({}),
    );
    expect(Array.isArray(annotations.Annotations)).toBe(true);

    const statistics = await client.send(
      new ListDataQualityStatisticsCommand({}),
    );
    expect(Array.isArray(statistics.Statistics)).toBe(true);

    const entities = await client.send(
      new ListEntitiesCommand({ ConnectionName: "any" }),
    );
    expect(Array.isArray(entities.Entities)).toBe(true);
  });
});
