import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  BatchGetCustomEntityTypesCommand,
  BatchGetTableOptimizerCommand,
  CreateColumnStatisticsTaskSettingsCommand,
  CreateCustomEntityTypeCommand,
  CreateIntegrationCommand,
  CreateIntegrationResourcePropertyCommand,
  CreateScriptCommand,
  CreateSecurityConfigurationCommand,
  CreateTableOptimizerCommand,
  CreateUsageProfileCommand,
  CreateUserDefinedFunctionCommand,
  GlueClient,
} from "@aws-sdk/client-glue";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("glue custom-entity, table-optimizer, integration, udf e2e", () => {
  const glue = () => new GlueClient({ endpoint, region, credentials });

  test("custom entity type create -> batch get lifecycle", async () => {
    const client = glue();

    const created = await client.send(
      new CreateCustomEntityTypeCommand({
        Name: "e2e_ssn_pattern",
        RegexString: "\\d{3}-\\d{2}-\\d{4}",
        ContextWords: ["ssn", "social security"],
      }),
    );
    expect(created.Name).toBe("e2e_ssn_pattern");

    const batched = await client.send(
      new BatchGetCustomEntityTypesCommand({
        Names: ["e2e_ssn_pattern", "nonexistent_entity"],
      }),
    );
    expect(batched.CustomEntityTypes).toHaveLength(1);
    expect(batched.CustomEntityTypes![0].Name).toBe("e2e_ssn_pattern");
    expect(batched.CustomEntityTypes![0].RegexString).toBe(
      "\\d{3}-\\d{2}-\\d{4}",
    );
    expect(batched.CustomEntityTypesNotFound).toContain("nonexistent_entity");
  });

  test("table optimizer create -> batch get lifecycle", async () => {
    const client = glue();

    await client.send(
      new CreateTableOptimizerCommand({
        CatalogId: "123456789012",
        DatabaseName: "e2e_db",
        TableName: "e2e_table",
        Type: "compaction",
        TableOptimizerConfiguration: {
          roleArn: "arn:aws:iam::123456789012:role/GlueRole",
          enabled: true,
        },
      }),
    );

    const batched = await client.send(
      new BatchGetTableOptimizerCommand({
        Entries: [
          {
            catalogId: "123456789012",
            databaseName: "e2e_db",
            tableName: "e2e_table",
            type: "compaction",
          },
          {
            catalogId: "123456789012",
            databaseName: "e2e_db",
            tableName: "e2e_table",
            type: "nonexistent",
          },
        ],
      }),
    );
    expect(batched.TableOptimizers).toHaveLength(1);
    expect(batched.TableOptimizers![0].databaseName).toBe("e2e_db");
    expect(batched.TableOptimizers![0].tableName).toBe("e2e_table");
    expect(batched.Failures).toHaveLength(1);
  });

  test("column statistics task settings create", async () => {
    const client = glue();

    await expect(
      client.send(
        new CreateColumnStatisticsTaskSettingsCommand({
          DatabaseName: "e2e_db",
          TableName: "e2e_table",
          Role: "arn:aws:iam::123456789012:role/GlueRole",
        }),
      ),
    ).resolves.toBeDefined();
  });

  test("integration create", async () => {
    const client = glue();

    const created = await client.send(
      new CreateIntegrationCommand({
        IntegrationName: "e2e_integration",
        SourceArn: "arn:aws:rds:us-east-1:123456789012:db:source-db",
        TargetArn: "arn:aws:glue:us-east-1:123456789012:catalog",
        Description: "e2e test integration",
      }),
    );
    expect(created.IntegrationName).toBe("e2e_integration");
    expect(created.IntegrationArn).toContain("e2e_integration");
    expect(created.Status).toBe("CREATING");
  });

  test("integration resource property create", async () => {
    const client = glue();

    const created = await client.send(
      new CreateIntegrationResourcePropertyCommand({
        ResourceArn: "arn:aws:rds:us-east-1:123456789012:db:source-db",
        SourceProcessingProperties: {
          RoleArn: "arn:aws:iam::123456789012:role/GlueRole",
        },
      }),
    );
    expect(created.ResourceArn).toBe(
      "arn:aws:rds:us-east-1:123456789012:db:source-db",
    );
    expect(created.ResourcePropertyArn).toBeDefined();
  });

  test("create script returns python code", async () => {
    const client = glue();

    const result = await client.send(
      new CreateScriptCommand({
        DagNodes: [],
        DagEdges: [],
        Language: "PYTHON",
      }),
    );
    expect(result.PythonScript).toBeDefined();
  });

  test("security configuration create", async () => {
    const client = glue();

    const created = await client.send(
      new CreateSecurityConfigurationCommand({
        Name: "e2e_sec_config",
        EncryptionConfiguration: {
          S3Encryption: [],
          CloudWatchEncryption: {
            CloudWatchEncryptionMode: "DISABLED",
          },
          JobBookmarksEncryption: {
            JobBookmarksEncryptionMode: "DISABLED",
          },
        },
      }),
    );
    expect(created.Name).toBe("e2e_sec_config");
    expect(created.CreatedTimestamp).toBeDefined();
  });

  test("usage profile create", async () => {
    const client = glue();

    const created = await client.send(
      new CreateUsageProfileCommand({
        Name: "e2e_usage_profile",
        Configuration: {
          JobConfiguration: {},
          SessionConfiguration: {},
        },
      }),
    );
    expect(created.Name).toBe("e2e_usage_profile");
  });

  test("user defined function create", async () => {
    const client = glue();

    await expect(
      client.send(
        new CreateUserDefinedFunctionCommand({
          DatabaseName: "e2e_db",
          FunctionInput: {
            FunctionName: "e2e_udf",
            ClassName: "com.example.MyUDF",
            OwnerName: "owner",
            OwnerType: "USER",
            ResourceUris: [],
          },
        }),
      ),
    ).resolves.toBeDefined();
  });
});
