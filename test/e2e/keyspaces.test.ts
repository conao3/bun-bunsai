import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateKeyspaceCommand,
  CreateTableCommand,
  CreateTypeCommand,
  DeleteKeyspaceCommand,
  DeleteTableCommand,
  DeleteTypeCommand,
  GetKeyspaceCommand,
  GetTableAutoScalingSettingsCommand,
  GetTableCommand,
  GetTypeCommand,
  KeyspacesClient,
  ListKeyspacesCommand,
  ListTablesCommand,
  ListTagsForResourceCommand,
  ListTypesCommand,
  RestoreTableCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateKeyspaceCommand,
  UpdateTableCommand,
} from "@aws-sdk/client-keyspaces";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const keyspaces = () =>
  new KeyspacesClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Keyspaces keyspace and table lifecycle", async () => {
  const client = keyspaces();
  const ks = "bunsai_e2e_ks";
  const tbl = "bunsai_e2e_tbl";

  const createdKs = await client.send(
    new CreateKeyspaceCommand({ keyspaceName: ks }),
  );
  expect(createdKs.resourceArn).toContain(ks);

  const fetchedKs = await client.send(
    new GetKeyspaceCommand({ keyspaceName: ks }),
  );
  expect(fetchedKs.keyspaceName).toBe(ks);

  const listedKs = await client.send(new ListKeyspacesCommand({}));
  expect((listedKs.keyspaces ?? []).some((k) => k.keyspaceName === ks)).toBe(
    true,
  );

  await client.send(
    new CreateTableCommand({
      keyspaceName: ks,
      tableName: tbl,
      schemaDefinition: {
        allColumns: [{ name: "id", type: "text" }],
        partitionKeys: [{ name: "id" }],
      },
    }),
  );
  const fetchedTbl = await client.send(
    new GetTableCommand({ keyspaceName: ks, tableName: tbl }),
  );
  expect(fetchedTbl.tableName).toBe(tbl);
  expect(fetchedTbl.status).toBe("ACTIVE");

  const listedTbl = await client.send(
    new ListTablesCommand({ keyspaceName: ks }),
  );
  expect((listedTbl.tables ?? []).some((t) => t.tableName === tbl)).toBe(true);

  await client.send(
    new DeleteTableCommand({ keyspaceName: ks, tableName: tbl }),
  );
  await client.send(new DeleteKeyspaceCommand({ keyspaceName: ks }));
});

test("Keyspaces UpdateKeyspace and UpdateTable", async () => {
  const client = keyspaces();
  const ks = "bunsai_e2e_update_ks";
  const tbl = "bunsai_e2e_update_tbl";

  await client.send(new CreateKeyspaceCommand({ keyspaceName: ks }));
  const updatedKs = await client.send(
    new UpdateKeyspaceCommand({
      keyspaceName: ks,
      replicationSpecification: { replicationStrategy: "SINGLE_REGION" },
    }),
  );
  expect(updatedKs.resourceArn).toContain(ks);

  await client.send(
    new CreateTableCommand({
      keyspaceName: ks,
      tableName: tbl,
      schemaDefinition: {
        allColumns: [{ name: "id", type: "text" }],
        partitionKeys: [{ name: "id" }],
      },
    }),
  );
  const updatedTbl = await client.send(
    new UpdateTableCommand({ keyspaceName: ks, tableName: tbl }),
  );
  expect(updatedTbl.resourceArn).toContain(tbl);

  await client.send(
    new DeleteTableCommand({ keyspaceName: ks, tableName: tbl }),
  );
  await client.send(new DeleteKeyspaceCommand({ keyspaceName: ks }));
});

test("Keyspaces RestoreTable and GetTableAutoScalingSettings", async () => {
  const client = keyspaces();
  const ks = "bunsai_e2e_restore_ks";
  const src = "bunsai_e2e_src_tbl";
  const tgt = "bunsai_e2e_tgt_tbl";

  await client.send(new CreateKeyspaceCommand({ keyspaceName: ks }));
  await client.send(
    new CreateTableCommand({
      keyspaceName: ks,
      tableName: src,
      schemaDefinition: {
        allColumns: [{ name: "id", type: "text" }],
        partitionKeys: [{ name: "id" }],
      },
    }),
  );

  const autoScale = await client.send(
    new GetTableAutoScalingSettingsCommand({
      keyspaceName: ks,
      tableName: src,
    }),
  );
  expect(autoScale.keyspaceName).toBe(ks);
  expect(autoScale.tableName).toBe(src);
  expect(autoScale.resourceArn).toContain(src);

  const restored = await client.send(
    new RestoreTableCommand({
      sourceKeyspaceName: ks,
      sourceTableName: src,
      targetKeyspaceName: ks,
      targetTableName: tgt,
    }),
  );
  expect(restored.restoredTableARN).toContain(tgt);

  const restoredTbl = await client.send(
    new GetTableCommand({ keyspaceName: ks, tableName: tgt }),
  );
  expect(restoredTbl.tableName).toBe(tgt);

  await client.send(
    new DeleteTableCommand({ keyspaceName: ks, tableName: tgt }),
  );
  await client.send(
    new DeleteTableCommand({ keyspaceName: ks, tableName: src }),
  );
  await client.send(new DeleteKeyspaceCommand({ keyspaceName: ks }));
});

test("Keyspaces type lifecycle", async () => {
  const client = keyspaces();
  const ks = "bunsai_e2e_type_ks";
  const typeName = "bunsai_addr_type";

  await client.send(new CreateKeyspaceCommand({ keyspaceName: ks }));

  const created = await client.send(
    new CreateTypeCommand({
      keyspaceName: ks,
      typeName,
      fieldDefinitions: [
        { name: "street", type: "text" },
        { name: "city", type: "text" },
      ],
    }),
  );
  expect(created.typeName).toBe(typeName);
  expect(created.keyspaceArn).toContain(ks);

  const fetched = await client.send(
    new GetTypeCommand({ keyspaceName: ks, typeName }),
  );
  expect(fetched.typeName).toBe(typeName);
  expect(fetched.keyspaceName).toBe(ks);
  expect(fetched.keyspaceArn).toContain(ks);

  const listed = await client.send(new ListTypesCommand({ keyspaceName: ks }));
  expect((listed.types ?? []).includes(typeName)).toBe(true);

  const deleted = await client.send(
    new DeleteTypeCommand({ keyspaceName: ks, typeName }),
  );
  expect(deleted.typeName).toBe(typeName);
  expect(deleted.keyspaceArn).toContain(ks);

  await client.send(new DeleteKeyspaceCommand({ keyspaceName: ks }));
});

test("Keyspaces tagging operations", async () => {
  const client = keyspaces();
  const ks = "bunsai_e2e_tags_ks";

  const created = await client.send(
    new CreateKeyspaceCommand({ keyspaceName: ks }),
  );
  const arn = created.resourceArn!;

  await client.send(
    new TagResourceCommand({
      resourceArn: arn,
      tags: [
        { key: "env", value: "test" },
        { key: "team", value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  const tagMap = Object.fromEntries(
    (listed.tags ?? []).map((t) => [t.key!, t.value!]),
  );
  expect(tagMap["env"]).toBe("test");
  expect(tagMap["team"]).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({
      resourceArn: arn,
      tags: [{ key: "team", value: "bunsai" }],
    }),
  );

  const listedAfter = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  const tagMapAfter = Object.fromEntries(
    (listedAfter.tags ?? []).map((t) => [t.key!, t.value!]),
  );
  expect(tagMapAfter["env"]).toBe("test");
  expect(tagMapAfter["team"]).toBeUndefined();

  await client.send(new DeleteKeyspaceCommand({ keyspaceName: ks }));
});
