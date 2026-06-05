import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDiscovererCommand,
  CreateRegistryCommand,
  CreateSchemaCommand,
  DeleteDiscovererCommand,
  DeleteRegistryCommand,
  DeleteResourcePolicyCommand,
  DeleteSchemaCommand,
  DeleteSchemaVersionCommand,
  DescribeCodeBindingCommand,
  DescribeDiscovererCommand,
  DescribeRegistryCommand,
  DescribeSchemaCommand,
  ExportSchemaCommand,
  GetCodeBindingSourceCommand,
  GetDiscoveredSchemaCommand,
  GetResourcePolicyCommand,
  ListDiscoverersCommand,
  ListRegistriesCommand,
  ListSchemaVersionsCommand,
  ListSchemasCommand,
  ListTagsForResourceCommand,
  PutCodeBindingCommand,
  PutResourcePolicyCommand,
  SchemasClient,
  SearchSchemasCommand,
  StartDiscovererCommand,
  StopDiscovererCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateDiscovererCommand,
  UpdateRegistryCommand,
  UpdateSchemaCommand,
} from "@aws-sdk/client-schemas";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const schemas = () =>
  new SchemasClient({ endpoint, region, credentials, requestHandler });

test("schemas registry round trip", async () => {
  const client = schemas();
  const name = `bunsai-reg-${Date.now()}`;

  const created = await client.send(
    new CreateRegistryCommand({
      RegistryName: name,
      Description: "bunsai e2e registry",
    }),
  );
  expect(created.RegistryName).toBe(name);
  expect(created.RegistryArn).toContain(`registry/${name}`);

  const described = await client.send(
    new DescribeRegistryCommand({ RegistryName: name }),
  );
  expect(described.RegistryName).toBe(name);
  expect(described.RegistryArn).toBe(created.RegistryArn);
  expect(described.Description).toBe("bunsai e2e registry");

  const listed = await client.send(new ListRegistriesCommand({}));
  expect((listed.Registries ?? []).map((r) => r.RegistryName)).toContain(name);

  await client.send(new DeleteRegistryCommand({ RegistryName: name }));
  await expect(
    client.send(new DescribeRegistryCommand({ RegistryName: name })),
  ).rejects.toThrow();
});

test("schemas UpdateRegistry", async () => {
  const client = schemas();
  const name = `bunsai-upd-reg-${Date.now()}`;

  await client.send(
    new CreateRegistryCommand({ RegistryName: name, Description: "original" }),
  );

  const updated = await client.send(
    new UpdateRegistryCommand({ RegistryName: name, Description: "updated" }),
  );
  expect(updated.RegistryName).toBe(name);
  expect(updated.Description).toBe("updated");

  await client.send(new DeleteRegistryCommand({ RegistryName: name }));
});

test("schemas schema round trip", async () => {
  const client = schemas();
  const regName = `bunsai-sch-reg-${Date.now()}`;
  const schName = `bunsai-sch-${Date.now()}`;
  const content = JSON.stringify({
    openapi: "3.0.0",
    info: { title: "Test", version: "1" },
    paths: {},
  });

  await client.send(new CreateRegistryCommand({ RegistryName: regName }));

  const created = await client.send(
    new CreateSchemaCommand({
      RegistryName: regName,
      SchemaName: schName,
      Content: content,
      Type: "OpenApi3",
      Description: "test schema",
    }),
  );
  expect(created.SchemaName).toBe(schName);
  expect(created.SchemaArn).toContain(`schema/${regName}/${schName}`);
  expect(created.SchemaVersion).toBe("1");

  const described = await client.send(
    new DescribeSchemaCommand({ RegistryName: regName, SchemaName: schName }),
  );
  expect(described.SchemaName).toBe(schName);
  expect(described.Content).toBe(content);
  expect(described.Description).toBe("test schema");

  const listed = await client.send(
    new ListSchemasCommand({ RegistryName: regName }),
  );
  expect((listed.Schemas ?? []).map((s) => s.SchemaName)).toContain(schName);

  const updated = await client.send(
    new UpdateSchemaCommand({
      RegistryName: regName,
      SchemaName: schName,
      Content: content,
      Type: "OpenApi3",
    }),
  );
  expect(updated.SchemaVersion).toBe("2");

  const versions = await client.send(
    new ListSchemaVersionsCommand({
      RegistryName: regName,
      SchemaName: schName,
    }),
  );
  expect(versions.SchemaVersions?.length).toBe(2);

  const exported = await client.send(
    new ExportSchemaCommand({
      RegistryName: regName,
      SchemaName: schName,
      Type: "OpenApi3",
    }),
  );
  expect(exported.SchemaName).toBe(schName);
  expect(exported.Content).toBe(content);

  await client.send(
    new DeleteSchemaVersionCommand({
      RegistryName: regName,
      SchemaName: schName,
      SchemaVersion: "1",
    }),
  );
  const versionsAfter = await client.send(
    new ListSchemaVersionsCommand({
      RegistryName: regName,
      SchemaName: schName,
    }),
  );
  expect(versionsAfter.SchemaVersions?.length).toBe(1);

  await client.send(
    new DeleteSchemaCommand({ RegistryName: regName, SchemaName: schName }),
  );
  await expect(
    client.send(
      new DescribeSchemaCommand({ RegistryName: regName, SchemaName: schName }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteRegistryCommand({ RegistryName: regName }));
});

test("schemas SearchSchemas", async () => {
  const client = schemas();
  const regName = `bunsai-srch-reg-${Date.now()}`;
  const schName = `bunsai-srch-sch-${Date.now()}`;
  const content = JSON.stringify({
    openapi: "3.0.0",
    info: { title: "SearchTarget", version: "1" },
    paths: {},
  });

  await client.send(new CreateRegistryCommand({ RegistryName: regName }));
  await client.send(
    new CreateSchemaCommand({
      RegistryName: regName,
      SchemaName: schName,
      Content: content,
      Type: "OpenApi3",
    }),
  );

  const result = await client.send(
    new SearchSchemasCommand({
      RegistryName: regName,
      Keywords: "SearchTarget",
    }),
  );
  expect((result.Schemas ?? []).map((s) => s.SchemaName)).toContain(schName);

  await client.send(
    new DeleteSchemaCommand({ RegistryName: regName, SchemaName: schName }),
  );
  await client.send(new DeleteRegistryCommand({ RegistryName: regName }));
});

test("schemas discoverer round trip", async () => {
  const client = schemas();
  const sourceArn = `arn:aws:events:us-east-1:123456789012:event-bus/bunsai-test-${Date.now()}`;

  const created = await client.send(
    new CreateDiscovererCommand({
      SourceArn: sourceArn,
      Description: "test discoverer",
    }),
  );
  expect(created.DiscovererId).toBeDefined();
  expect(created.SourceArn).toBe(sourceArn);
  expect(created.State).toBe("STARTED");
  const discovererId = created.DiscovererId!;

  const described = await client.send(
    new DescribeDiscovererCommand({ DiscovererId: discovererId }),
  );
  expect(described.DiscovererId).toBe(discovererId);
  expect(described.Description).toBe("test discoverer");

  const updated = await client.send(
    new UpdateDiscovererCommand({
      DiscovererId: discovererId,
      Description: "updated discoverer",
    }),
  );
  expect(updated.Description).toBe("updated discoverer");

  const listed = await client.send(new ListDiscoverersCommand({}));
  expect((listed.Discoverers ?? []).map((d) => d.DiscovererId)).toContain(
    discovererId,
  );

  const stopped = await client.send(
    new StopDiscovererCommand({ DiscovererId: discovererId }),
  );
  expect(stopped.State).toBe("STOPPED");

  const started = await client.send(
    new StartDiscovererCommand({ DiscovererId: discovererId }),
  );
  expect(started.State).toBe("STARTED");

  await client.send(
    new DeleteDiscovererCommand({ DiscovererId: discovererId }),
  );
  await expect(
    client.send(new DescribeDiscovererCommand({ DiscovererId: discovererId })),
  ).rejects.toThrow();
});

test("schemas GetDiscoveredSchema", async () => {
  const client = schemas();
  const event = JSON.stringify({
    version: "0",
    source: "aws.events",
    detail: { key: "value" },
  });

  const result = await client.send(
    new GetDiscoveredSchemaCommand({ Events: [event], Type: "OpenApi3" }),
  );
  expect(result.Content).toBeDefined();
  const parsed = JSON.parse(result.Content!);
  expect(parsed.openapi).toBeDefined();
});

test("schemas code binding round trip", async () => {
  const client = schemas();
  const regName = `bunsai-cb-reg-${Date.now()}`;
  const schName = `bunsai-cb-sch-${Date.now()}`;
  const content = JSON.stringify({
    openapi: "3.0.0",
    info: { title: "CB", version: "1" },
    paths: {},
  });

  await client.send(new CreateRegistryCommand({ RegistryName: regName }));
  await client.send(
    new CreateSchemaCommand({
      RegistryName: regName,
      SchemaName: schName,
      Content: content,
      Type: "OpenApi3",
    }),
  );

  const putResult = await client.send(
    new PutCodeBindingCommand({
      RegistryName: regName,
      SchemaName: schName,
      Language: "Java8",
    }),
  );
  expect(putResult.Status).toBe("CREATE_COMPLETE");

  const descResult = await client.send(
    new DescribeCodeBindingCommand({
      RegistryName: regName,
      SchemaName: schName,
      Language: "Java8",
    }),
  );
  expect(descResult.Status).toBe("CREATE_COMPLETE");
  expect(descResult.SchemaVersion).toBe("1");

  const srcResult = await client.send(
    new GetCodeBindingSourceCommand({
      RegistryName: regName,
      SchemaName: schName,
      Language: "Java8",
    }),
  );
  expect(srcResult.Body).toBeDefined();

  await client.send(
    new DeleteSchemaCommand({ RegistryName: regName, SchemaName: schName }),
  );
  await client.send(new DeleteRegistryCommand({ RegistryName: regName }));
});

test("schemas resource policy round trip", async () => {
  const client = schemas();
  const regName = `bunsai-pol-reg-${Date.now()}`;
  const policy = JSON.stringify({ Version: "2012-10-17", Statement: [] });

  await client.send(new CreateRegistryCommand({ RegistryName: regName }));

  const putResult = await client.send(
    new PutResourcePolicyCommand({ Policy: policy, RegistryName: regName }),
  );
  expect(String(putResult.Policy)).toBe(policy);
  expect(putResult.RevisionId).toBeDefined();

  const getResult = await client.send(
    new GetResourcePolicyCommand({ RegistryName: regName }),
  );
  expect(String(getResult.Policy)).toBe(policy);

  await client.send(new DeleteResourcePolicyCommand({ RegistryName: regName }));
  await expect(
    client.send(new GetResourcePolicyCommand({ RegistryName: regName })),
  ).rejects.toThrow();

  await client.send(new DeleteRegistryCommand({ RegistryName: regName }));
});

test("schemas tags round trip", async () => {
  const client = schemas();
  const regName = `bunsai-tag-reg-${Date.now()}`;

  const created = await client.send(
    new CreateRegistryCommand({
      RegistryName: regName,
      Tags: { env: "test" },
    }),
  );
  const arn = created.RegistryArn!;

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(listed.Tags?.env).toBe("test");

  await client.send(
    new TagResourceCommand({ ResourceArn: arn, Tags: { team: "bunsai" } }),
  );
  const listed2 = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(listed2.Tags?.env).toBe("test");
  expect(listed2.Tags?.team).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ ResourceArn: arn, TagKeys: ["env"] }),
  );
  const listed3 = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(listed3.Tags?.env).toBeUndefined();
  expect(listed3.Tags?.team).toBe("bunsai");

  await client.send(new DeleteRegistryCommand({ RegistryName: regName }));
});
