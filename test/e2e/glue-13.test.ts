import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDatabaseCommand,
  CreatePartitionCommand,
  CreateTableCommand,
  CreateUsageProfileCommand,
  CreateUserDefinedFunctionCommand,
  CreateWorkflowCommand,
  GetUnfilteredPartitionMetadataCommand,
  GetUnfilteredPartitionsMetadataCommand,
  GetUnfilteredTableMetadataCommand,
  GetUsageProfileCommand,
  GetUserDefinedFunctionCommand,
  GetUserDefinedFunctionsCommand,
  GetWorkflowCommand,
  GetWorkflowRunCommand,
  GetWorkflowRunPropertiesCommand,
  GetWorkflowRunsCommand,
  GlueClient,
  ImportCatalogToGlueCommand,
  ListBlueprintsCommand,
  CreateBlueprintCommand,
} from "@aws-sdk/client-glue";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("glue chunk-12 ops e2e", () => {
  const glue = () =>
    new GlueClient({ endpoint, region, credentials, requestHandler });

  test("workflow create → get → run lifecycle", async () => {
    const client = glue();

    const created = await client.send(
      new CreateWorkflowCommand({ Name: "e2e_workflow_chunk12" }),
    );
    expect(created.Name).toBe("e2e_workflow_chunk12");

    const got = await client.send(
      new GetWorkflowCommand({ Name: "e2e_workflow_chunk12" }),
    );
    expect(got.Workflow?.Name).toBe("e2e_workflow_chunk12");

    await expect(
      client.send(new GetWorkflowCommand({ Name: "no_such_workflow" })),
    ).rejects.toThrow();

    const runs = await client.send(
      new GetWorkflowRunsCommand({ Name: "e2e_workflow_chunk12" }),
    );
    expect(Array.isArray(runs.Runs)).toBe(true);

    const run = await client.send(
      new GetWorkflowRunCommand({
        Name: "e2e_workflow_chunk12",
        RunId: "run-001",
      }),
    );
    expect(run.Run?.WorkflowRunId).toBe("run-001");
    expect(run.Run?.Status).toBe("COMPLETED");

    const props = await client.send(
      new GetWorkflowRunPropertiesCommand({
        Name: "e2e_workflow_chunk12",
        RunId: "run-001",
      }),
    );
    expect(typeof props.RunProperties).toBe("object");
  });

  test("udf create → get → list lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateDatabaseCommand({
        DatabaseInput: { Name: "e2e_db_chunk12" },
      }),
    );

    await client.send(
      new CreateUserDefinedFunctionCommand({
        DatabaseName: "e2e_db_chunk12",
        FunctionInput: {
          FunctionName: "e2e_udf_chunk12",
          ClassName: "com.example.MyUDF",
          OwnerName: "test-owner",
          OwnerType: "USER",
        },
      }),
    );

    const got = await client.send(
      new GetUserDefinedFunctionCommand({
        DatabaseName: "e2e_db_chunk12",
        FunctionName: "e2e_udf_chunk12",
      }),
    );
    expect(got.UserDefinedFunction?.FunctionName).toBe("e2e_udf_chunk12");
    expect(got.UserDefinedFunction?.ClassName).toBe("com.example.MyUDF");

    await expect(
      client.send(
        new GetUserDefinedFunctionCommand({
          DatabaseName: "e2e_db_chunk12",
          FunctionName: "no_such_udf",
        }),
      ),
    ).rejects.toThrow();

    const list = await client.send(
      new GetUserDefinedFunctionsCommand({
        DatabaseName: "e2e_db_chunk12",
        Pattern: ".*",
      }),
    );
    expect(Array.isArray(list.UserDefinedFunctions)).toBe(true);
    const found = list.UserDefinedFunctions?.find(
      (f) => f.FunctionName === "e2e_udf_chunk12",
    );
    expect(found).toBeDefined();
  });

  test("GetUsageProfile create → get", async () => {
    const client = glue();

    await client.send(
      new CreateUsageProfileCommand({
        Name: "e2e_usage_chunk12",
        Configuration: {
          JobConfiguration: {},
          SessionConfiguration: {},
        },
      }),
    );

    const got = await client.send(
      new GetUsageProfileCommand({ Name: "e2e_usage_chunk12" }),
    );
    expect(got.Name).toBe("e2e_usage_chunk12");

    await expect(
      client.send(new GetUsageProfileCommand({ Name: "no_such_profile" })),
    ).rejects.toThrow();
  });

  test("GetUnfilteredTableMetadata and partition unfiltered ops", async () => {
    const client = glue();

    await client.send(
      new CreateTableCommand({
        DatabaseName: "e2e_db_chunk12",
        TableInput: {
          Name: "e2e_tbl_chunk12",
          StorageDescriptor: { Columns: [{ Name: "id", Type: "int" }] },
        },
      }),
    );

    const tbl = await client.send(
      new GetUnfilteredTableMetadataCommand({
        CatalogId: "123456789012",
        DatabaseName: "e2e_db_chunk12",
        Name: "e2e_tbl_chunk12",
        SupportedPermissionTypes: ["COLUMN_PERMISSION"],
      }),
    );
    expect(tbl.Table?.Name).toBe("e2e_tbl_chunk12");
    expect(Array.isArray(tbl.AuthorizedColumns)).toBe(true);
    expect(tbl.IsRegisteredWithLakeFormation).toBe(false);

    await client.send(
      new CreatePartitionCommand({
        DatabaseName: "e2e_db_chunk12",
        TableName: "e2e_tbl_chunk12",
        PartitionInput: {
          Values: ["2024-01-01"],
          StorageDescriptor: {},
        },
      }),
    );

    const part = await client.send(
      new GetUnfilteredPartitionMetadataCommand({
        CatalogId: "123456789012",
        DatabaseName: "e2e_db_chunk12",
        TableName: "e2e_tbl_chunk12",
        PartitionValues: ["2024-01-01"],
        SupportedPermissionTypes: ["COLUMN_PERMISSION"],
      }),
    );
    expect(Array.isArray(part.Partition?.Values)).toBe(true);
    expect(Array.isArray(part.AuthorizedColumns)).toBe(true);

    const parts = await client.send(
      new GetUnfilteredPartitionsMetadataCommand({
        CatalogId: "123456789012",
        DatabaseName: "e2e_db_chunk12",
        TableName: "e2e_tbl_chunk12",
        SupportedPermissionTypes: ["COLUMN_PERMISSION"],
      }),
    );
    expect(Array.isArray(parts.UnfilteredPartitions)).toBe(true);
    expect(parts.UnfilteredPartitions?.length).toBeGreaterThan(0);
  });

  test("ImportCatalogToGlue no-op", async () => {
    const client = glue();
    const result = await client.send(new ImportCatalogToGlueCommand({}));
    expect(result).toBeDefined();
  });

  test("ListBlueprints returns blueprint names", async () => {
    const client = glue();

    await client.send(
      new CreateBlueprintCommand({
        Name: "e2e_bp_chunk12",
        BlueprintLocation: "s3://bucket/blueprint.zip",
      }),
    );

    const list = await client.send(new ListBlueprintsCommand({}));
    expect(Array.isArray(list.Blueprints)).toBe(true);
    expect(list.Blueprints?.includes("e2e_bp_chunk12")).toBe(true);
  });
});
