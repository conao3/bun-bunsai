import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateIntegrationCommand,
  CreateIntegrationResourcePropertyCommand,
  CreateMLTransformCommand,
  CreateRegistryCommand,
  CreateSchemaCommand,
  CreateSessionCommand,
  CreateUsageProfileCommand,
  CreateWorkflowCommand,
  GlueClient,
  ListIntegrationResourcePropertiesCommand,
  ListMLTransformsCommand,
  ListRegistriesCommand,
  ListSchemaVersionsCommand,
  ListSchemasCommand,
  ListSessionsCommand,
  ListStatementsCommand,
  ListUsageProfilesCommand,
  ListWorkflowsCommand,
  ModifyIntegrationCommand,
} from "@aws-sdk/client-glue";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("glue chunk-15 list + modify ops e2e", () => {
  const glue = () =>
    new GlueClient({ endpoint, region, credentials, requestHandler });

  test("registry create → list lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateRegistryCommand({
        RegistryName: "e2e_reg_chunk15",
        Description: "chunk15 test registry",
      }),
    );

    const list = await client.send(new ListRegistriesCommand({}));
    expect(Array.isArray(list.Registries)).toBe(true);
    const found = list.Registries?.find(
      (r) => r.RegistryName === "e2e_reg_chunk15",
    );
    expect(found).toBeDefined();
    expect(found?.RegistryArn).toContain("e2e_reg_chunk15");
    expect(found?.Status).toBe("AVAILABLE");
  });

  test("schema create → list → listSchemaVersions lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateRegistryCommand({
        RegistryName: "e2e_reg2_chunk15",
      }),
    );

    await client.send(
      new CreateSchemaCommand({
        RegistryId: { RegistryName: "e2e_reg2_chunk15" },
        SchemaName: "e2e_schema_chunk15",
        DataFormat: "AVRO",
        Compatibility: "NONE",
        SchemaDefinition: JSON.stringify({ type: "record", name: "Test" }),
      }),
    );

    const schemaList = await client.send(
      new ListSchemasCommand({
        RegistryId: { RegistryName: "e2e_reg2_chunk15" },
      }),
    );
    expect(Array.isArray(schemaList.Schemas)).toBe(true);
    const foundSchema = schemaList.Schemas?.find(
      (s) => s.SchemaName === "e2e_schema_chunk15",
    );
    expect(foundSchema).toBeDefined();
    expect(foundSchema?.SchemaStatus).toBe("AVAILABLE");

    const versionList = await client.send(
      new ListSchemaVersionsCommand({
        SchemaId: {
          RegistryName: "e2e_reg2_chunk15",
          SchemaName: "e2e_schema_chunk15",
        },
      }),
    );
    expect(Array.isArray(versionList.Schemas)).toBe(true);
    expect((versionList.Schemas?.length ?? 0) >= 1).toBe(true);
    expect(versionList.Schemas?.[0]?.Status).toBe("AVAILABLE");
  });

  test("session create → list lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateSessionCommand({
        Id: "e2e_session_chunk15",
        Role: "arn:aws:iam::123456789012:role/GlueRole",
        Command: { Name: "glueetl" },
      }),
    );

    const list = await client.send(new ListSessionsCommand({}));
    expect(Array.isArray(list.Sessions)).toBe(true);
    expect(Array.isArray(list.Ids)).toBe(true);
    const found = list.Sessions?.find((s) => s.Id === "e2e_session_chunk15");
    expect(found).toBeDefined();
    expect(list.Ids?.includes("e2e_session_chunk15")).toBe(true);

    const stmts = await client.send(
      new ListStatementsCommand({ SessionId: "e2e_session_chunk15" }),
    );
    expect(Array.isArray(stmts.Statements)).toBe(true);
    expect(stmts.Statements?.length).toBe(0);
  });

  test("workflow create → list lifecycle", async () => {
    const client = glue();

    await client.send(new CreateWorkflowCommand({ Name: "e2e_wf_chunk15" }));

    const list = await client.send(new ListWorkflowsCommand({}));
    expect(Array.isArray(list.Workflows)).toBe(true);
    expect(list.Workflows?.includes("e2e_wf_chunk15")).toBe(true);
  });

  test("MLTransform create → list returns TransformIds", async () => {
    const client = glue();

    const created = await client.send(
      new CreateMLTransformCommand({
        Name: "e2e_mlt_chunk15",
        Role: "arn:aws:iam::123456789012:role/GlueRole",
        InputRecordTables: [],
        Parameters: {
          TransformType: "FIND_MATCHES",
          FindMatchesParameters: { PrimaryKeyColumnName: "id" },
        },
      }),
    );
    expect(typeof created.TransformId).toBe("string");

    const list = await client.send(new ListMLTransformsCommand({}));
    expect(Array.isArray(list.TransformIds)).toBe(true);
    expect(list.TransformIds?.includes(created.TransformId!)).toBe(true);
  });

  test("UsageProfile create → list lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateUsageProfileCommand({
        Name: "e2e_up_chunk15",
        Configuration: { JobConfiguration: {}, SessionConfiguration: {} },
      }),
    );

    const list = await client.send(new ListUsageProfilesCommand({}));
    expect(Array.isArray(list.Profiles)).toBe(true);
    const found = list.Profiles?.find((p) => p.Name === "e2e_up_chunk15");
    expect(found).toBeDefined();
  });

  test("IntegrationResourceProperty create → list lifecycle", async () => {
    const client = glue();

    const resourceArn =
      "arn:aws:glue:us-east-1:123456789012:database/e2e_irp_chunk15";
    await client.send(
      new CreateIntegrationResourcePropertyCommand({
        ResourceArn: resourceArn,
      }),
    );

    const list = await client.send(
      new ListIntegrationResourcePropertiesCommand({}),
    );
    expect(Array.isArray(list.IntegrationResourcePropertyList)).toBe(true);
    const found = list.IntegrationResourcePropertyList?.find(
      (p) => p.ResourceArn === resourceArn,
    );
    expect(found).toBeDefined();
  });

  test("Integration create → ModifyIntegration updates description", async () => {
    const client = glue();

    await client.send(
      new CreateIntegrationCommand({
        IntegrationName: "e2e_intg_chunk15",
        SourceArn: "arn:aws:glue:us-east-1:123456789012:database/src",
        TargetArn: "arn:aws:glue:us-east-1:123456789012:database/tgt",
      }),
    );

    const modified = await client.send(
      new ModifyIntegrationCommand({
        IntegrationIdentifier: "e2e_intg_chunk15",
        Description: "updated description",
      }),
    );
    expect(modified.IntegrationName).toBe("e2e_intg_chunk15");
    expect(modified.Status).toBe("ACTIVE");
    expect(modified.Description).toBe("updated description");
  });
});
