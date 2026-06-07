import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDatabaseCommand,
  CreateRegistryCommand,
  CreateSchemaCommand,
  CreateSessionCommand,
  CreateTableCommand,
  CreateWorkflowCommand,
  GlueClient,
  GetResourcePolicyCommand,
  PutResourcePolicyCommand,
  PutSchemaVersionMetadataCommand,
  PutWorkflowRunPropertiesCommand,
  QuerySchemaVersionMetadataCommand,
  RegisterSchemaVersionCommand,
  RemoveSchemaVersionMetadataCommand,
  RunStatementCommand,
  SearchTablesCommand,
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

test("PutResourcePolicy -> GetResourcePolicy round-trip", async () => {
  const policy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Action: "glue:*", Principal: "*" }],
  });

  const putResp = await client.send(
    new PutResourcePolicyCommand({ PolicyInJson: policy }),
  );
  expect(typeof putResp.PolicyHash).toBe("string");
  expect(putResp.PolicyHash!.length).toBeGreaterThan(0);

  const getResp = await client.send(new GetResourcePolicyCommand({}));
  expect(getResp.PolicyInJson).toBe(policy);
  expect(getResp.PolicyHash).toBe(putResp.PolicyHash);
  expect(typeof getResp.CreateTime).toBe("object");
  expect(typeof getResp.UpdateTime).toBe("object");
});

test("CreateTable -> SearchTables finds it", async () => {
  await client.send(
    new CreateDatabaseCommand({
      DatabaseInput: { Name: "search_db_16" },
    }),
  );
  await client.send(
    new CreateTableCommand({
      DatabaseName: "search_db_16",
      TableInput: { Name: "alpha_table_16" },
    }),
  );
  await client.send(
    new CreateTableCommand({
      DatabaseName: "search_db_16",
      TableInput: { Name: "beta_table_16" },
    }),
  );

  const all = await client.send(new SearchTablesCommand({}));
  const names = (all.TableList ?? []).map((t) => t.Name);
  expect(names).toContain("alpha_table_16");
  expect(names).toContain("beta_table_16");

  const filtered = await client.send(
    new SearchTablesCommand({ SearchText: "alpha" }),
  );
  const filteredNames = (filtered.TableList ?? []).map((t) => t.Name);
  expect(filteredNames).toContain("alpha_table_16");
  expect(filteredNames).not.toContain("beta_table_16");
});

test("PutSchemaVersionMetadata -> QuerySchemaVersionMetadata -> RemoveSchemaVersionMetadata round-trip", async () => {
  await client.send(new CreateRegistryCommand({ RegistryName: "reg_16" }));
  await client.send(
    new CreateSchemaCommand({
      RegistryId: { RegistryName: "reg_16" },
      SchemaName: "schema_16",
      DataFormat: "AVRO",
      Compatibility: "NONE",
    }),
  );

  const regResp = await client.send(
    new RegisterSchemaVersionCommand({
      SchemaId: { RegistryName: "reg_16", SchemaName: "schema_16" },
      SchemaDefinition: '{"type":"record","name":"r","fields":[]}',
    }),
  );
  const svid = regResp.SchemaVersionId!;
  expect(typeof svid).toBe("string");
  expect(regResp.VersionNumber).toBeGreaterThan(0);
  expect(regResp.Status).toBe("AVAILABLE");

  await client.send(
    new PutSchemaVersionMetadataCommand({
      SchemaVersionId: svid,
      MetadataKeyValue: { MetadataKey: "env", MetadataValue: "prod" },
    }),
  );

  const queryResp = await client.send(
    new QuerySchemaVersionMetadataCommand({ SchemaVersionId: svid }),
  );
  expect(queryResp.SchemaVersionId).toBe(svid);
  expect(queryResp.MetadataInfoMap?.["env"]).toBeDefined();

  await client.send(
    new RemoveSchemaVersionMetadataCommand({
      SchemaVersionId: svid,
      MetadataKeyValue: { MetadataKey: "env", MetadataValue: "prod" },
    }),
  );

  const afterRemove = await client.send(
    new QuerySchemaVersionMetadataCommand({ SchemaVersionId: svid }),
  );
  expect(afterRemove.MetadataInfoMap?.["env"]).toBeUndefined();
});

test("PutWorkflowRunProperties -> GetWorkflowRunProperties round-trip", async () => {
  await client.send(new CreateWorkflowCommand({ Name: "wf_16" }));

  await client.send(
    new PutWorkflowRunPropertiesCommand({
      Name: "wf_16",
      RunId: "run-abc",
      RunProperties: { MyProp: "MyValue" },
    }),
  );
});

test("RunStatement increments statement ID", async () => {
  await client.send(
    new CreateSessionCommand({
      Id: "sess_16",
      Role: "arn:aws:iam::123456789012:role/GlueRole",
      Command: { Name: "glueetl" },
    }),
  );

  const r1 = await client.send(
    new RunStatementCommand({ SessionId: "sess_16", Code: "print('hello')" }),
  );
  const r2 = await client.send(
    new RunStatementCommand({ SessionId: "sess_16", Code: "print('world')" }),
  );
  expect(r1.Id).toBe(1);
  expect(r2.Id).toBe(2);
});
