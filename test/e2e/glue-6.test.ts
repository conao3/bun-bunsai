import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  BatchGetBlueprintsCommand,
  BatchGetDataQualityResultCommand,
  BatchGetWorkflowsCommand,
  BatchPutDataQualityStatisticAnnotationCommand,
  CancelDataQualityRuleRecommendationRunCommand,
  CancelDataQualityRulesetEvaluationRunCommand,
  CancelStatementCommand,
  CreateBlueprintCommand,
  CreateDataQualityRulesetCommand,
  CreateSessionCommand,
  CreateWorkflowCommand,
  DeleteBlueprintCommand,
  GlueClient,
} from "@aws-sdk/client-glue";

const awsPort = 4941;
const uiPort = 5941;
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

describe("glue blueprint, workflow, session, data-quality e2e", () => {
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

  test("blueprint create -> batch get -> delete lifecycle", async () => {
    const client = glue();
    const blueprintName = "e2e_blueprint_1";

    const created = await client.send(
      new CreateBlueprintCommand({
        Name: blueprintName,
        BlueprintLocation: "s3://my-bucket/blueprints/bp1.zip",
        Description: "e2e test blueprint",
      }),
    );
    expect(created.Name).toBe(blueprintName);

    const batch = await client.send(
      new BatchGetBlueprintsCommand({
        Names: [blueprintName, "nonexistent_blueprint"],
      }),
    );
    expect(batch.Blueprints).toHaveLength(1);
    expect(batch.Blueprints?.[0]?.Name).toBe(blueprintName);
    expect(batch.Blueprints?.[0]?.Status).toBe("ACTIVE");
    expect(batch.Blueprints?.[0]?.BlueprintLocation).toBe(
      "s3://my-bucket/blueprints/bp1.zip",
    );
    expect(batch.MissingBlueprints).toContain("nonexistent_blueprint");

    const deleted = await client.send(
      new DeleteBlueprintCommand({ Name: blueprintName }),
    );
    expect(deleted.Name).toBe(blueprintName);

    const afterDel = await client.send(
      new BatchGetBlueprintsCommand({ Names: [blueprintName] }),
    );
    expect(afterDel.MissingBlueprints).toContain(blueprintName);
  });

  test("workflow create -> batch get lifecycle", async () => {
    const client = glue();
    const workflowName = "e2e_workflow_1";

    const created = await client.send(
      new CreateWorkflowCommand({
        Name: workflowName,
        Description: "e2e test workflow",
        MaxConcurrentRuns: 3,
      }),
    );
    expect(created.Name).toBe(workflowName);

    const batch = await client.send(
      new BatchGetWorkflowsCommand({
        Names: [workflowName, "nonexistent_workflow"],
      }),
    );
    expect(batch.Workflows).toHaveLength(1);
    expect(batch.Workflows?.[0]?.Name).toBe(workflowName);
    expect(batch.Workflows?.[0]?.Description).toBe("e2e test workflow");
    expect(batch.Workflows?.[0]?.MaxConcurrentRuns).toBe(3);
    expect(batch.MissingWorkflows).toContain("nonexistent_workflow");
  });

  test("session create -> cancel statement lifecycle", async () => {
    const client = glue();
    const sessionId = "e2e_session_1";

    const created = await client.send(
      new CreateSessionCommand({
        Id: sessionId,
        Role: "arn:aws:iam::000000000000:role/GlueRole",
        Command: { Name: "glueetl", PythonVersion: "3" },
        GlueVersion: "3.0",
        NumberOfWorkers: 2,
        WorkerType: "G.1X",
      }),
    );
    expect(created.Session?.Id).toBe(sessionId);
    expect(created.Session?.Status).toBe("READY");
    expect(created.Session?.GlueVersion).toBe("3.0");

    await client.send(
      new CancelStatementCommand({ SessionId: sessionId, Id: 1 }),
    );
  });

  test("data quality ruleset create lifecycle", async () => {
    const client = glue();
    const rulesetName = "e2e_dq_ruleset_1";

    const created = await client.send(
      new CreateDataQualityRulesetCommand({
        Name: rulesetName,
        Ruleset: "Rules = [ RowCount > 0 ]",
        Description: "e2e test ruleset",
      }),
    );
    expect(created.Name).toBe(rulesetName);
  });

  test("data quality batch get result returns not found for unknown ids", async () => {
    const client = glue();
    const result = await client.send(
      new BatchGetDataQualityResultCommand({
        ResultIds: ["result-id-1", "result-id-2"],
      }),
    );
    expect(result.Results).toHaveLength(0);
    expect(result.ResultsNotFound).toContain("result-id-1");
    expect(result.ResultsNotFound).toContain("result-id-2");
  });

  test("batch put data quality statistic annotation returns no failures", async () => {
    const client = glue();
    const result = await client.send(
      new BatchPutDataQualityStatisticAnnotationCommand({
        InclusionAnnotations: [],
      }),
    );
    expect(result.FailedInclusionAnnotations).toHaveLength(0);
  });

  test("cancel data quality rule recommendation run", async () => {
    const client = glue();
    await client.send(
      new CancelDataQualityRuleRecommendationRunCommand({
        RunId: "run-id-recommendation-1",
      }),
    );
  });

  test("cancel data quality ruleset evaluation run", async () => {
    const client = glue();
    await client.send(
      new CancelDataQualityRulesetEvaluationRunCommand({
        RunId: "run-id-evaluation-1",
      }),
    );
  });
});
