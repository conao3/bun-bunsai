import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AppSyncClient,
  CreateApiKeyCommand,
  CreateDataSourceCommand,
  CreateGraphqlApiCommand,
  CreateResolverCommand,
  DeleteDataSourceCommand,
  DeleteGraphqlApiCommand,
  DeleteResolverCommand,
  GetGraphqlApiCommand,
  GetResolverCommand,
  GetSchemaCreationStatusCommand,
  ListApiKeysCommand,
  ListResolversCommand,
  StartSchemaCreationCommand,
  UpdateGraphqlApiCommand,
} from "@aws-sdk/client-appsync";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("AppSync scenario e2e", () => {
  const appsync = () =>
    new AppSyncClient({ endpoint, region, credentials, requestHandler });

  test("GraphQL API build-out: create, wire, update, teardown", async () => {
    const client = appsync();
    const name = `bunsai-e2e-scenario-${Date.now()}`;

    const created = await client.send(
      new CreateGraphqlApiCommand({ name, authenticationType: "API_KEY" }),
    );
    const apiId = created.graphqlApi?.apiId ?? "";
    const arn = created.graphqlApi?.arn ?? "";
    expect(apiId).toBeTruthy();
    expect(arn).toContain(`apis/${apiId}`);

    const sdl =
      "type Query { getItem(id: ID!): Item }\n" +
      "type Mutation { createItem(name: String!): Item }\n" +
      "type Item { id: ID name: String }";
    const schemaStart = await client.send(
      new StartSchemaCreationCommand({
        apiId,
        definition: Buffer.from(sdl),
      }),
    );
    expect(schemaStart.status).toBe("PROCESSING");

    const schemaStatus = await client.send(
      new GetSchemaCreationStatusCommand({ apiId }),
    );
    expect(schemaStatus.status).toBe("ACTIVE");
    expect(schemaStatus.details).toBe("Schema successfully created.");

    const ds = await client.send(
      new CreateDataSourceCommand({ apiId, name: "ScenarioDS", type: "NONE" }),
    );
    expect(ds.dataSource?.name).toBe("ScenarioDS");
    expect(ds.dataSource?.dataSourceArn).toContain("datasources/ScenarioDS");

    const resolver = await client.send(
      new CreateResolverCommand({
        apiId,
        typeName: "Query",
        fieldName: "getItem",
        dataSourceName: "ScenarioDS",
        kind: "UNIT",
      }),
    );
    expect(resolver.resolver?.fieldName).toBe("getItem");
    expect(resolver.resolver?.dataSourceName).toBe("ScenarioDS");

    const listed = await client.send(
      new ListResolversCommand({ apiId, typeName: "Query" }),
    );
    expect((listed.resolvers ?? []).map((r) => r.fieldName)).toContain(
      "getItem",
    );

    const apiKey = await client.send(new CreateApiKeyCommand({ apiId }));
    expect(apiKey.apiKey?.id).toMatch(/^da2-/);
    expect(apiKey.apiKey?.expires).toBeDefined();

    const updatedName = `${name}-updated`;
    await client.send(
      new UpdateGraphqlApiCommand({
        apiId,
        name: updatedName,
        authenticationType: "API_KEY",
      }),
    );
    const got = await client.send(new GetGraphqlApiCommand({ apiId }));
    expect(got.graphqlApi?.name).toBe(updatedName);

    await client.send(
      new DeleteResolverCommand({
        apiId,
        typeName: "Query",
        fieldName: "getItem",
      }),
    );
    await expect(
      client.send(
        new GetResolverCommand({
          apiId,
          typeName: "Query",
          fieldName: "getItem",
        }),
      ),
    ).rejects.toThrow();

    await client.send(
      new DeleteDataSourceCommand({ apiId, name: "ScenarioDS" }),
    );

    const keysBeforeDelete = await client.send(
      new ListApiKeysCommand({ apiId }),
    );
    expect(
      (keysBeforeDelete.apiKeys ?? []).some((k) => k.id?.startsWith("da2-")),
    ).toBe(true);

    await client.send(new DeleteGraphqlApiCommand({ apiId }));
    await expect(
      client.send(new GetGraphqlApiCommand({ apiId })),
    ).rejects.toThrow();
  });
});
