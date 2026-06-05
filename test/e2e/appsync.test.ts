import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AppSyncClient,
  AssociateApiCommand,
  CreateApiCacheCommand,
  CreateApiCommand,
  CreateApiKeyCommand,
  CreateChannelNamespaceCommand,
  CreateDataSourceCommand,
  CreateDomainNameCommand,
  CreateFunctionCommand,
  CreateGraphqlApiCommand,
  CreateResolverCommand,
  CreateTypeCommand,
  DeleteApiCacheCommand,
  DeleteApiCommand,
  DeleteApiKeyCommand,
  DeleteChannelNamespaceCommand,
  DeleteDataSourceCommand,
  DeleteDomainNameCommand,
  DeleteFunctionCommand,
  DeleteGraphqlApiCommand,
  DeleteResolverCommand,
  DeleteTypeCommand,
  DisassociateApiCommand,
  FlushApiCacheCommand,
  GetApiAssociationCommand,
  GetApiCacheCommand,
  GetApiCommand,
  GetChannelNamespaceCommand,
  GetDataSourceCommand,
  GetDomainNameCommand,
  GetFunctionCommand,
  GetGraphqlApiCommand,
  GetGraphqlApiEnvironmentVariablesCommand,
  GetIntrospectionSchemaCommand,
  GetResolverCommand,
  GetSchemaCreationStatusCommand,
  GetTypeCommand,
  ListApiKeysCommand,
  ListApisCommand,
  ListChannelNamespacesCommand,
  ListDataSourcesCommand,
  ListDomainNamesCommand,
  ListFunctionsCommand,
  ListGraphqlApisCommand,
  ListResolversCommand,
  ListTagsForResourceCommand,
  ListTypesCommand,
  PutGraphqlApiEnvironmentVariablesCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateApiCacheCommand,
  UpdateApiCommand,
  UpdateApiKeyCommand,
  UpdateChannelNamespaceCommand,
  UpdateDataSourceCommand,
  UpdateDomainNameCommand,
  UpdateFunctionCommand,
  UpdateGraphqlApiCommand,
  UpdateResolverCommand,
  UpdateTypeCommand,
} from "@aws-sdk/client-appsync";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const appsync = () =>
  new AppSyncClient({ endpoint, region, credentials, requestHandler });

test("AppSync graphql api and api key roundtrip", async () => {
  const client = appsync();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateGraphqlApiCommand({
      name,
      authenticationType: "API_KEY",
      xrayEnabled: true,
    }),
  );
  const apiId = created.graphqlApi?.apiId;
  expect(apiId).toBeDefined();
  expect(created.graphqlApi?.name).toBe(name);
  expect(created.graphqlApi?.authenticationType).toBe("API_KEY");
  expect(created.graphqlApi?.arn).toContain(`apis/${apiId}`);
  expect(created.graphqlApi?.uris?.GRAPHQL).toContain("appsync-api");

  const got = await client.send(new GetGraphqlApiCommand({ apiId: apiId }));
  expect(got.graphqlApi?.name).toBe(name);
  expect(got.graphqlApi?.xrayEnabled).toBe(true);

  const listed = await client.send(new ListGraphqlApisCommand({}));
  expect((listed.graphqlApis ?? []).map((a) => a.apiId)).toContain(apiId);

  const updated = await client.send(
    new UpdateGraphqlApiCommand({
      apiId: apiId,
      name: `${name}-updated`,
      authenticationType: "API_KEY",
    }),
  );
  expect(updated.graphqlApi?.name).toBe(`${name}-updated`);
  expect(updated.graphqlApi?.arn).toBe(created.graphqlApi?.arn);

  const key = await client.send(
    new CreateApiKeyCommand({ apiId: apiId, description: "demo" }),
  );
  expect(key.apiKey?.id).toBeDefined();
  expect(key.apiKey?.description).toBe("demo");

  const updatedKey = await client.send(
    new UpdateApiKeyCommand({
      apiId: apiId,
      id: key.apiKey?.id,
      description: "demo-updated",
    }),
  );
  expect(updatedKey.apiKey?.description).toBe("demo-updated");

  const keys = await client.send(new ListApiKeysCommand({ apiId: apiId }));
  expect((keys.apiKeys ?? []).map((k) => k.id)).toContain(key.apiKey?.id);

  await client.send(
    new DeleteApiKeyCommand({ apiId: apiId, id: key.apiKey?.id }),
  );

  await client.send(new DeleteGraphqlApiCommand({ apiId: apiId }));
  await expect(
    client.send(new GetGraphqlApiCommand({ apiId: apiId })),
  ).rejects.toThrow();
});

test("AppSync data source lifecycle", async () => {
  const client = appsync();
  const api = await client.send(
    new CreateGraphqlApiCommand({
      name: `ds-test-${Date.now()}`,
      authenticationType: "API_KEY",
    }),
  );
  const apiId = api.graphqlApi!.apiId!;

  const ds = await client.send(
    new CreateDataSourceCommand({
      apiId,
      name: "MyDS",
      type: "NONE",
    }),
  );
  expect(ds.dataSource?.name).toBe("MyDS");
  expect(ds.dataSource?.type).toBe("NONE");
  expect(ds.dataSource?.dataSourceArn).toContain("datasources/MyDS");

  const got = await client.send(
    new GetDataSourceCommand({ apiId, name: "MyDS" }),
  );
  expect(got.dataSource?.name).toBe("MyDS");

  const list = await client.send(new ListDataSourcesCommand({ apiId }));
  expect((list.dataSources ?? []).map((d) => d.name)).toContain("MyDS");

  const upd = await client.send(
    new UpdateDataSourceCommand({
      apiId,
      name: "MyDS",
      type: "NONE",
      description: "updated",
    }),
  );
  expect(upd.dataSource?.description).toBe("updated");

  await client.send(new DeleteDataSourceCommand({ apiId, name: "MyDS" }));
  await expect(
    client.send(new GetDataSourceCommand({ apiId, name: "MyDS" })),
  ).rejects.toThrow();

  await client.send(new DeleteGraphqlApiCommand({ apiId }));
});

test("AppSync resolver lifecycle", async () => {
  const client = appsync();
  const api = await client.send(
    new CreateGraphqlApiCommand({
      name: `rs-test-${Date.now()}`,
      authenticationType: "API_KEY",
    }),
  );
  const apiId = api.graphqlApi!.apiId!;

  const rs = await client.send(
    new CreateResolverCommand({
      apiId,
      typeName: "Query",
      fieldName: "getItem",
      kind: "UNIT",
    }),
  );
  expect(rs.resolver?.typeName).toBe("Query");
  expect(rs.resolver?.fieldName).toBe("getItem");
  expect(rs.resolver?.resolverArn).toContain("resolvers/getItem");

  const got = await client.send(
    new GetResolverCommand({ apiId, typeName: "Query", fieldName: "getItem" }),
  );
  expect(got.resolver?.fieldName).toBe("getItem");

  const list = await client.send(
    new ListResolversCommand({ apiId, typeName: "Query" }),
  );
  expect((list.resolvers ?? []).map((r) => r.fieldName)).toContain("getItem");

  const upd = await client.send(
    new UpdateResolverCommand({
      apiId,
      typeName: "Query",
      fieldName: "getItem",
      kind: "UNIT",
      requestMappingTemplate: "{}",
    }),
  );
  expect(upd.resolver?.requestMappingTemplate).toBe("{}");

  await client.send(
    new DeleteResolverCommand({
      apiId,
      typeName: "Query",
      fieldName: "getItem",
    }),
  );
  await client.send(new DeleteGraphqlApiCommand({ apiId }));
});

test("AppSync function lifecycle", async () => {
  const client = appsync();
  const api = await client.send(
    new CreateGraphqlApiCommand({
      name: `fn-test-${Date.now()}`,
      authenticationType: "API_KEY",
    }),
  );
  const apiId = api.graphqlApi!.apiId!;
  await client.send(
    new CreateDataSourceCommand({ apiId, name: "FnDS", type: "NONE" }),
  );

  const fn = await client.send(
    new CreateFunctionCommand({
      apiId,
      name: "MyFn",
      dataSourceName: "FnDS",
      functionVersion: "2018-05-29",
    }),
  );
  expect(fn.functionConfiguration?.name).toBe("MyFn");
  expect(fn.functionConfiguration?.functionArn).toContain("functions/");

  const fnId = fn.functionConfiguration!.functionId!;

  const got = await client.send(
    new GetFunctionCommand({ apiId, functionId: fnId }),
  );
  expect(got.functionConfiguration?.name).toBe("MyFn");

  const list = await client.send(new ListFunctionsCommand({ apiId }));
  expect((list.functions ?? []).map((f) => f.functionId)).toContain(fnId);

  const upd = await client.send(
    new UpdateFunctionCommand({
      apiId,
      functionId: fnId,
      name: "MyFnUpdated",
      dataSourceName: "FnDS",
    }),
  );
  expect(upd.functionConfiguration?.name).toBe("MyFnUpdated");

  await client.send(new DeleteFunctionCommand({ apiId, functionId: fnId }));
  await client.send(new DeleteGraphqlApiCommand({ apiId }));
});

test("AppSync type lifecycle", async () => {
  const client = appsync();
  const api = await client.send(
    new CreateGraphqlApiCommand({
      name: `tp-test-${Date.now()}`,
      authenticationType: "API_KEY",
    }),
  );
  const apiId = api.graphqlApi!.apiId!;

  const tp = await client.send(
    new CreateTypeCommand({
      apiId,
      definition: "type Query { placeholder: String }",
      format: "SDL",
    }),
  );
  expect(tp.type?.name).toBe("Query");
  expect(tp.type?.arn).toContain("types/Query");

  const got = await client.send(
    new GetTypeCommand({ apiId, typeName: "Query", format: "SDL" }),
  );
  expect(got.type?.name).toBe("Query");

  const list = await client.send(
    new ListTypesCommand({ apiId, format: "SDL" }),
  );
  expect((list.types ?? []).map((t) => t.name)).toContain("Query");

  const upd = await client.send(
    new UpdateTypeCommand({
      apiId,
      typeName: "Query",
      definition: "type Query { updated: String }",
      format: "SDL",
    }),
  );
  expect(upd.type?.definition).toContain("updated");

  await client.send(new DeleteTypeCommand({ apiId, typeName: "Query" }));
  await client.send(new DeleteGraphqlApiCommand({ apiId }));
});

test("AppSync api cache lifecycle", async () => {
  const client = appsync();
  const api = await client.send(
    new CreateGraphqlApiCommand({
      name: `ac-test-${Date.now()}`,
      authenticationType: "API_KEY",
    }),
  );
  const apiId = api.graphqlApi!.apiId!;

  const ac = await client.send(
    new CreateApiCacheCommand({
      apiId,
      ttl: 300,
      apiCachingBehavior: "FULL_REQUEST_CACHING",
      type: "T2_SMALL",
    }),
  );
  expect(ac.apiCache?.ttl).toBe(300);
  expect(ac.apiCache?.status).toBe("AVAILABLE");

  const got = await client.send(new GetApiCacheCommand({ apiId }));
  expect(got.apiCache?.type).toBe("T2_SMALL");

  const upd = await client.send(
    new UpdateApiCacheCommand({
      apiId,
      ttl: 600,
      apiCachingBehavior: "FULL_REQUEST_CACHING",
      type: "T2_SMALL",
    }),
  );
  expect(upd.apiCache?.ttl).toBe(600);

  await client.send(new FlushApiCacheCommand({ apiId }));
  await client.send(new DeleteApiCacheCommand({ apiId }));
  await client.send(new DeleteGraphqlApiCommand({ apiId }));
});

test("AppSync domain name lifecycle", async () => {
  const client = appsync();
  const domainName = `api.example-${Date.now()}.com`;

  const dn = await client.send(
    new CreateDomainNameCommand({
      domainName,
      certificateArn: "arn:aws:acm:us-east-1:123456789012:certificate/abc-123",
      description: "test domain",
    }),
  );
  expect(dn.domainNameConfig?.domainName).toBe(domainName);
  expect(dn.domainNameConfig?.appsyncDomainName).toContain("appsync-api");

  const got = await client.send(new GetDomainNameCommand({ domainName }));
  expect(got.domainNameConfig?.description).toBe("test domain");

  const list = await client.send(new ListDomainNamesCommand({}));
  expect((list.domainNameConfigs ?? []).map((d) => d.domainName)).toContain(
    domainName,
  );

  const upd = await client.send(
    new UpdateDomainNameCommand({ domainName, description: "updated" }),
  );
  expect(upd.domainNameConfig?.description).toBe("updated");

  const api = await client.send(
    new CreateGraphqlApiCommand({
      name: `dn-api-${Date.now()}`,
      authenticationType: "API_KEY",
    }),
  );
  const apiId = api.graphqlApi!.apiId!;

  const assoc = await client.send(
    new AssociateApiCommand({ domainName, apiId }),
  );
  expect(assoc.apiAssociation?.associationStatus).toBe("SUCCESS");

  const gotAssoc = await client.send(
    new GetApiAssociationCommand({ domainName }),
  );
  expect(gotAssoc.apiAssociation?.apiId).toBe(apiId);

  await client.send(new DisassociateApiCommand({ domainName }));
  await client.send(new DeleteDomainNameCommand({ domainName }));
  await client.send(new DeleteGraphqlApiCommand({ apiId }));
});

test("AppSync event api and channel namespace lifecycle", async () => {
  const client = appsync();
  const name = `event-api-${Date.now()}`;

  const eventConfig = {
    authProviders: [{ authType: "API_KEY" as const }],
    connectionAuthModes: [{ authType: "API_KEY" as const }],
    defaultPublishAuthModes: [{ authType: "API_KEY" as const }],
    defaultSubscribeAuthModes: [{ authType: "API_KEY" as const }],
  };

  const ea = await client.send(new CreateApiCommand({ name, eventConfig }));
  expect(ea.api?.name).toBe(name);
  expect(ea.api?.apiArn).toContain("apis/");

  const apiId = ea.api!.apiId!;

  const got = await client.send(new GetApiCommand({ apiId }));
  expect(got.api?.name).toBe(name);

  const list = await client.send(new ListApisCommand({}));
  expect((list.apis ?? []).map((a) => a.apiId)).toContain(apiId);

  const upd = await client.send(
    new UpdateApiCommand({ apiId, name: `${name}-updated`, eventConfig }),
  );
  expect(upd.api?.name).toBe(`${name}-updated`);

  const cn = await client.send(
    new CreateChannelNamespaceCommand({ apiId, name: "default" }),
  );
  expect(cn.channelNamespace?.name).toBe("default");
  expect(cn.channelNamespace?.channelNamespaceArn).toContain(
    "channelNamespaces/default",
  );

  const gotCn = await client.send(
    new GetChannelNamespaceCommand({ apiId, name: "default" }),
  );
  expect(gotCn.channelNamespace?.name).toBe("default");

  const listCn = await client.send(new ListChannelNamespacesCommand({ apiId }));
  expect((listCn.channelNamespaces ?? []).map((c) => c.name)).toContain(
    "default",
  );

  const updCn = await client.send(
    new UpdateChannelNamespaceCommand({ apiId, name: "default" }),
  );
  expect(updCn.channelNamespace?.name).toBe("default");

  await client.send(
    new DeleteChannelNamespaceCommand({ apiId, name: "default" }),
  );
  await client.send(new DeleteApiCommand({ apiId }));
  await expect(client.send(new GetApiCommand({ apiId }))).rejects.toThrow();
});

test("AppSync tags lifecycle", async () => {
  const client = appsync();
  const api = await client.send(
    new CreateGraphqlApiCommand({
      name: `tags-test-${Date.now()}`,
      authenticationType: "API_KEY",
    }),
  );
  const arn = api.graphqlApi!.arn!;

  await client.send(
    new TagResourceCommand({
      resourceArn: arn,
      tags: { env: "test", team: "backend" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(listed.tags?.env).toBe("test");
  expect(listed.tags?.team).toBe("backend");

  await client.send(
    new UntagResourceCommand({ resourceArn: arn, tagKeys: ["team"] }),
  );

  const after = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(after.tags?.env).toBe("test");
  expect(after.tags?.team).toBeUndefined();

  await client.send(
    new DeleteGraphqlApiCommand({ apiId: api.graphqlApi!.apiId! }),
  );
});

test("AppSync environment variables", async () => {
  const client = appsync();
  const api = await client.send(
    new CreateGraphqlApiCommand({
      name: `env-test-${Date.now()}`,
      authenticationType: "API_KEY",
    }),
  );
  const apiId = api.graphqlApi!.apiId!;

  await client.send(
    new PutGraphqlApiEnvironmentVariablesCommand({
      apiId,
      environmentVariables: { MY_VAR: "hello", DB_URL: "postgres://localhost" },
    }),
  );

  const got = await client.send(
    new GetGraphqlApiEnvironmentVariablesCommand({ apiId }),
  );
  expect(got.environmentVariables?.MY_VAR).toBe("hello");
  expect(got.environmentVariables?.DB_URL).toBe("postgres://localhost");

  await client.send(new DeleteGraphqlApiCommand({ apiId }));
});

test("AppSync schema operations", async () => {
  const client = appsync();
  const api = await client.send(
    new CreateGraphqlApiCommand({
      name: `schema-test-${Date.now()}`,
      authenticationType: "API_KEY",
    }),
  );
  const apiId = api.graphqlApi!.apiId!;

  const status = await client.send(
    new GetSchemaCreationStatusCommand({ apiId }),
  );
  expect(status.status).toBe("SUCCESS");

  const schema = await client.send(
    new GetIntrospectionSchemaCommand({ apiId, format: "SDL" }),
  );
  expect(schema.schema).toBeDefined();

  await client.send(new DeleteGraphqlApiCommand({ apiId }));
});
