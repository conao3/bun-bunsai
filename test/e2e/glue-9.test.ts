import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateBlueprintCommand,
  CreateWorkflowCommand,
  DeleteWorkflowCommand,
  GetBlueprintCommand,
  GetBlueprintRunsCommand,
  GetCatalogImportStatusCommand,
  GetColumnStatisticsTaskRunsCommand,
  GlueClient,
} from "@aws-sdk/client-glue";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("glue chunk-8 ops e2e", () => {
  const glue = () => new GlueClient({ endpoint, region, credentials });

  test("blueprint create -> get -> blueprint runs lifecycle", async () => {
    const client = glue();

    const created = await client.send(
      new CreateBlueprintCommand({
        Name: "e2e_blueprint_chunk8",
        BlueprintLocation: "s3://bucket/blueprint.zip",
        Description: "test blueprint",
      }),
    );
    expect(created.Name).toBe("e2e_blueprint_chunk8");

    const got = await client.send(
      new GetBlueprintCommand({ Name: "e2e_blueprint_chunk8" }),
    );
    expect(got.Blueprint?.Name).toBe("e2e_blueprint_chunk8");
    expect(got.Blueprint?.Status).toBe("ACTIVE");
    expect(got.Blueprint?.CreatedOn).toBeDefined();
    expect(got.Blueprint?.LastModifiedOn).toBeDefined();

    await expect(
      client.send(new GetBlueprintCommand({ Name: "no_such_blueprint" })),
    ).rejects.toThrow();

    const runs = await client.send(
      new GetBlueprintRunsCommand({ BlueprintName: "e2e_blueprint_chunk8" }),
    );
    expect(runs.$metadata.httpStatusCode).toBe(200);
  });

  test("workflow create -> delete lifecycle", async () => {
    const client = glue();

    const created = await client.send(
      new CreateWorkflowCommand({
        Name: "e2e_workflow_chunk8",
        Description: "test workflow",
      }),
    );
    expect(created.Name).toBe("e2e_workflow_chunk8");

    const deleted = await client.send(
      new DeleteWorkflowCommand({ Name: "e2e_workflow_chunk8" }),
    );
    expect(deleted.Name).toBe("e2e_workflow_chunk8");

    await expect(
      client.send(new DeleteWorkflowCommand({ Name: "e2e_workflow_chunk8" })),
    ).rejects.toThrow();
  });

  test("GetCatalogImportStatus returns completed status", async () => {
    const client = glue();
    const result = await client.send(new GetCatalogImportStatusCommand({}));
    expect(result.ImportStatus).toBeDefined();
    expect(result.ImportStatus?.ImportCompleted).toBe(true);
  });

  test("GetColumnStatisticsTaskRuns returns empty list", async () => {
    const client = glue();
    const result = await client.send(
      new GetColumnStatisticsTaskRunsCommand({
        DatabaseName: "e2e_db_chunk8",
        TableName: "e2e_table_chunk8",
      }),
    );
    expect(result.ColumnStatisticsTaskRuns).toBeDefined();
    expect(Array.isArray(result.ColumnStatisticsTaskRuns)).toBe(true);
  });
});
