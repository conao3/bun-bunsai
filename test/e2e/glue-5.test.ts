import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  BatchGetDevEndpointsCommand,
  CancelMLTaskRunCommand,
  CheckSchemaVersionValidityCommand,
  CreateDevEndpointCommand,
  CreateMLTransformCommand,
  CreateRegistryCommand,
  CreateSchemaCommand,
  DeleteDevEndpointCommand,
  DeleteMLTransformCommand,
  DeleteRegistryCommand,
  DeleteSchemaCommand,
  DeleteSchemaVersionsCommand,
  GlueClient,
} from "@aws-sdk/client-glue";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("glue ml-transform, dev-endpoint, schema-registry e2e", () => {
  const glue = () => new GlueClient({ endpoint, region, credentials });

  test("registry + schema create -> delete lifecycle", async () => {
    const client = glue();
    const registryName = "e2e_registry_1";
    const schemaName = "e2e_schema_1";

    const createReg = await client.send(
      new CreateRegistryCommand({
        RegistryName: registryName,
        Description: "e2e test registry",
      }),
    );
    expect(createReg.RegistryName).toBe(registryName);
    expect(createReg.RegistryArn).toContain("registry/" + registryName);
    expect(createReg.Description).toBe("e2e test registry");

    const createSchema = await client.send(
      new CreateSchemaCommand({
        RegistryId: { RegistryName: registryName },
        SchemaName: schemaName,
        DataFormat: "AVRO",
        Compatibility: "BACKWARD",
        SchemaDefinition:
          '{"type":"record","name":"Test","fields":[{"name":"id","type":"int"}]}',
        Description: "e2e test schema",
      }),
    );
    expect(createSchema.SchemaName).toBe(schemaName);
    expect(createSchema.RegistryName).toBe(registryName);
    expect(createSchema.DataFormat).toBe("AVRO");
    expect(createSchema.Compatibility).toBe("BACKWARD");
    expect(createSchema.SchemaStatus).toBe("AVAILABLE");
    expect(createSchema.SchemaVersionId).toBeDefined();
    expect(createSchema.LatestSchemaVersion).toBe(1);

    const delSchema = await client.send(
      new DeleteSchemaCommand({
        SchemaId: { RegistryName: registryName, SchemaName: schemaName },
      }),
    );
    expect(delSchema.SchemaName).toBe(schemaName);
    expect(delSchema.Status).toBe("DELETING");

    const delReg = await client.send(
      new DeleteRegistryCommand({
        RegistryId: { RegistryName: registryName },
      }),
    );
    expect(delReg.RegistryName).toBe(registryName);
    expect(delReg.Status).toBe("DELETING");
  });

  test("delete schema versions", async () => {
    const client = glue();
    const registryName = "e2e_registry_2";
    const schemaName = "e2e_schema_2";

    await client.send(
      new CreateRegistryCommand({ RegistryName: registryName }),
    );
    await client.send(
      new CreateSchemaCommand({
        RegistryId: { RegistryName: registryName },
        SchemaName: schemaName,
        DataFormat: "JSON",
        Compatibility: "NONE",
      }),
    );

    const delVersions = await client.send(
      new DeleteSchemaVersionsCommand({
        SchemaId: { RegistryName: registryName, SchemaName: schemaName },
        Versions: "1",
      }),
    );
    expect(delVersions.SchemaVersionErrors).toEqual([]);

    await client.send(
      new DeleteSchemaCommand({
        SchemaId: { RegistryName: registryName, SchemaName: schemaName },
      }),
    );
    await client.send(
      new DeleteRegistryCommand({
        RegistryId: { RegistryName: registryName },
      }),
    );
  });

  test("check schema version validity", async () => {
    const client = glue();
    const result = await client.send(
      new CheckSchemaVersionValidityCommand({
        DataFormat: "AVRO",
        SchemaDefinition:
          '{"type":"record","name":"Test","fields":[{"name":"id","type":"int"}]}',
      }),
    );
    expect(result.Valid).toBe(true);
  });

  test("dev endpoint create -> batch get -> delete", async () => {
    const client = glue();
    const endpointName = "e2e_endpoint_1";

    const created = await client.send(
      new CreateDevEndpointCommand({
        EndpointName: endpointName,
        RoleArn: "arn:aws:iam::000000000000:role/GlueRole",
        GlueVersion: "3.0",
        NumberOfWorkers: 2,
        WorkerType: "G.1X",
      }),
    );
    expect(created.EndpointName).toBe(endpointName);
    expect(created.Status).toBe("PROVISIONING");
    expect(created.GlueVersion).toBe("3.0");

    const batch = await client.send(
      new BatchGetDevEndpointsCommand({
        DevEndpointNames: [endpointName, "nonexistent_endpoint"],
      }),
    );
    expect(batch.DevEndpoints).toHaveLength(1);
    expect(batch.DevEndpoints?.[0]?.EndpointName).toBe(endpointName);
    expect(batch.DevEndpoints?.[0]?.Status).toBe("READY");
    expect(batch.DevEndpointsNotFound).toContain("nonexistent_endpoint");

    await client.send(
      new DeleteDevEndpointCommand({ EndpointName: endpointName }),
    );

    const afterDel = await client.send(
      new BatchGetDevEndpointsCommand({
        DevEndpointNames: [endpointName],
      }),
    );
    expect(afterDel.DevEndpointsNotFound).toContain(endpointName);
  });

  test("ml transform create -> cancel task run -> delete", async () => {
    const client = glue();

    const created = await client.send(
      new CreateMLTransformCommand({
        Name: "e2e_transform_1",
        Description: "e2e ml transform",
        InputRecordTables: [
          {
            DatabaseName: "test_db",
            TableName: "test_table",
          },
        ],
        Parameters: {
          TransformType: "FIND_MATCHES",
          FindMatchesParameters: {
            PrimaryKeyColumnName: "id",
          },
        },
        Role: "arn:aws:iam::000000000000:role/GlueMLRole",
        GlueVersion: "3.0",
        MaxCapacity: 10,
      }),
    );
    expect(created.TransformId).toBeDefined();

    const transformId = created.TransformId!;

    const cancelled = await client.send(
      new CancelMLTaskRunCommand({
        TransformId: transformId,
        TaskRunId: "task-run-001",
      }),
    );
    expect(cancelled.TransformId).toBe(transformId);
    expect(cancelled.TaskRunId).toBe("task-run-001");
    expect(cancelled.Status).toBe("STOPPED");

    const deleted = await client.send(
      new DeleteMLTransformCommand({ TransformId: transformId }),
    );
    expect(deleted.TransformId).toBe(transformId);
  });
});
