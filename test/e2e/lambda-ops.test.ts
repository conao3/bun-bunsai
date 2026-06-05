import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  AddLayerVersionPermissionCommand,
  AddPermissionCommand,
  CreateAliasCommand,
  CreateCodeSigningConfigCommand,
  CreateEventSourceMappingCommand,
  CreateFunctionCommand,
  DeleteAliasCommand,
  DeleteCodeSigningConfigCommand,
  DeleteEventSourceMappingCommand,
  DeleteFunctionEventInvokeConfigCommand,
  DeleteLayerVersionCommand,
  DeleteProvisionedConcurrencyConfigCommand,
  GetAccountSettingsCommand,
  GetAliasCommand,
  GetCodeSigningConfigCommand,
  GetEventSourceMappingCommand,
  GetFunctionCodeSigningConfigCommand,
  GetFunctionConfigurationCommand,
  GetFunctionEventInvokeConfigCommand,
  GetFunctionRecursionConfigCommand,
  GetLayerVersionByArnCommand,
  GetLayerVersionPolicyCommand,
  GetPolicyCommand,
  GetProvisionedConcurrencyConfigCommand,
  GetRuntimeManagementConfigCommand,
  LambdaClient,
  ListAliasesCommand,
  ListCodeSigningConfigsCommand,
  ListEventSourceMappingsCommand,
  ListFunctionEventInvokeConfigsCommand,
  ListFunctionUrlConfigsCommand,
  ListFunctionsByCodeSigningConfigCommand,
  ListLayerVersionsCommand,
  ListProvisionedConcurrencyConfigsCommand,
  ListTagsCommand,
  ListVersionsByFunctionCommand,
  PublishLayerVersionCommand,
  PublishVersionCommand,
  PutFunctionCodeSigningConfigCommand,
  PutFunctionEventInvokeConfigCommand,
  PutFunctionRecursionConfigCommand,
  PutProvisionedConcurrencyConfigCommand,
  PutRuntimeManagementConfigCommand,
  RemoveLayerVersionPermissionCommand,
  RemovePermissionCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateAliasCommand,
  UpdateCodeSigningConfigCommand,
  UpdateEventSourceMappingCommand,
  UpdateFunctionConfigurationCommand,
  UpdateFunctionUrlConfigCommand,
} from "@aws-sdk/client-lambda";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const lambda = () => new LambdaClient({ endpoint, region, credentials });

const createFn = async (
  client: LambdaClient,
  name: string,
): Promise<string> => {
  const created = await client.send(
    new CreateFunctionCommand({
      FunctionName: name,
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: { ZipFile: new TextEncoder().encode("PK fake zip") },
    }),
  );
  return created.FunctionArn ?? "";
};

test("Lambda GetFunctionConfiguration and UpdateFunctionConfiguration", async () => {
  const client = lambda();
  const name = "bunsai-ops-config";
  await createFn(client, name);

  const cfg = await client.send(
    new GetFunctionConfigurationCommand({ FunctionName: name }),
  );
  expect(cfg.FunctionName).toBe(name);
  expect(cfg.Timeout).toBe(3);
  expect(cfg.MemorySize).toBe(128);

  const updated = await client.send(
    new UpdateFunctionConfigurationCommand({
      FunctionName: name,
      Timeout: 30,
      MemorySize: 256,
      Description: "updated config",
    }),
  );
  expect(updated.Timeout).toBe(30);
  expect(updated.MemorySize).toBe(256);
  expect(updated.Description).toBe("updated config");
  expect(updated.RevisionId).not.toBe(cfg.RevisionId);
});

test("Lambda PublishVersion increments version", async () => {
  const client = lambda();
  const name = "bunsai-ops-publish";
  await createFn(client, name);

  const v1 = await client.send(
    new PublishVersionCommand({ FunctionName: name, Description: "v1" }),
  );
  expect(v1.Version).toBe("1");
  expect(v1.FunctionArn).toContain(`:function:${name}:1`);

  const v2 = await client.send(
    new PublishVersionCommand({ FunctionName: name }),
  );
  expect(v2.Version).toBe("2");
});

test("Lambda alias lifecycle", async () => {
  const client = lambda();
  const name = "bunsai-ops-alias";
  await createFn(client, name);

  const created = await client.send(
    new CreateAliasCommand({
      FunctionName: name,
      Name: "prod",
      FunctionVersion: "1",
      Description: "production alias",
    }),
  );
  expect(created.Name).toBe("prod");
  expect(created.FunctionVersion).toBe("1");
  expect(created.AliasArn).toContain(`:function:${name}:prod`);

  const got = await client.send(
    new GetAliasCommand({ FunctionName: name, Name: "prod" }),
  );
  expect(got.Name).toBe("prod");
  expect(got.Description).toBe("production alias");

  await client.send(
    new CreateAliasCommand({
      FunctionName: name,
      Name: "staging",
      FunctionVersion: "$LATEST",
    }),
  );

  const listed = await client.send(
    new ListAliasesCommand({ FunctionName: name }),
  );
  const names = (listed.Aliases ?? []).map((a) => a.Name);
  expect(names).toContain("prod");
  expect(names).toContain("staging");

  await expect(
    client.send(new GetAliasCommand({ FunctionName: name, Name: "missing" })),
  ).rejects.toThrow();
});

test("Lambda permission policy lifecycle", async () => {
  const client = lambda();
  const name = "bunsai-ops-policy";
  await createFn(client, name);

  const added = await client.send(
    new AddPermissionCommand({
      FunctionName: name,
      StatementId: "s3-invoke",
      Action: "lambda:InvokeFunction",
      Principal: "s3.amazonaws.com",
    }),
  );
  expect(added.Statement).toBeDefined();
  const statement = JSON.parse(added.Statement ?? "{}");
  expect(statement.Sid).toBe("s3-invoke");

  const policy = await client.send(
    new GetPolicyCommand({ FunctionName: name }),
  );
  const parsed = JSON.parse(policy.Policy ?? "{}");
  const sids = (parsed.Statement ?? []).map((s: { Sid: string }) => s.Sid);
  expect(sids).toContain("s3-invoke");

  const removed = await client.send(
    new RemovePermissionCommand({
      FunctionName: name,
      StatementId: "s3-invoke",
    }),
  );
  expect(removed.$metadata.httpStatusCode).toBe(204);

  await expect(
    client.send(new GetPolicyCommand({ FunctionName: name })),
  ).rejects.toThrow();
});

test("Lambda TagResource and ListTags", async () => {
  const client = lambda();
  const name = "bunsai-ops-tags";
  const arn = await createFn(client, name);

  await client.send(
    new TagResourceCommand({
      Resource: arn,
      Tags: { env: "test", team: "bunsai" },
    }),
  );

  const listed = await client.send(new ListTagsCommand({ Resource: arn }));
  expect(listed.Tags?.env).toBe("test");
  expect(listed.Tags?.team).toBe("bunsai");
});

test("Lambda UntagResource", async () => {
  const client = lambda();
  const name = "bunsai-ops-untag";
  const arn = await createFn(client, name);

  await client.send(
    new TagResourceCommand({
      Resource: arn,
      Tags: { key1: "val1", key2: "val2" },
    }),
  );

  await client.send(
    new UntagResourceCommand({ Resource: arn, TagKeys: ["key1"] }),
  );

  const listed = await client.send(new ListTagsCommand({ Resource: arn }));
  expect(listed.Tags?.key1).toBeUndefined();
  expect(listed.Tags?.key2).toBe("val2");
});

test("Lambda DeleteAlias and UpdateAlias", async () => {
  const client = lambda();
  const name = "bunsai-ops-alias2";
  await createFn(client, name);

  await client.send(
    new CreateAliasCommand({
      FunctionName: name,
      Name: "myalias",
      FunctionVersion: "$LATEST",
    }),
  );

  const updated = await client.send(
    new UpdateAliasCommand({
      FunctionName: name,
      Name: "myalias",
      Description: "updated desc",
    }),
  );
  expect(updated.Description).toBe("updated desc");

  await client.send(
    new DeleteAliasCommand({ FunctionName: name, Name: "myalias" }),
  );

  await expect(
    client.send(new GetAliasCommand({ FunctionName: name, Name: "myalias" })),
  ).rejects.toThrow();
});

test("Lambda EventSourceMapping lifecycle", async () => {
  const client = lambda();
  const name = "bunsai-ops-esm";
  await createFn(client, name);

  const created = await client.send(
    new CreateEventSourceMappingCommand({
      FunctionName: name,
      EventSourceArn: "arn:aws:sqs:us-east-1:000000000000:my-queue",
      BatchSize: 5,
    }),
  );
  expect(created.UUID).toBeDefined();
  expect(created.BatchSize).toBe(5);

  const uuid = created.UUID!;
  const got = await client.send(
    new GetEventSourceMappingCommand({ UUID: uuid }),
  );
  expect(got.UUID).toBe(uuid);

  const updated = await client.send(
    new UpdateEventSourceMappingCommand({ UUID: uuid, BatchSize: 10 }),
  );
  expect(updated.BatchSize).toBe(10);

  const listed = await client.send(
    new ListEventSourceMappingsCommand({ FunctionName: name }),
  );
  const uuids = (listed.EventSourceMappings ?? []).map((m) => m.UUID);
  expect(uuids).toContain(uuid);

  await client.send(new DeleteEventSourceMappingCommand({ UUID: uuid }));

  await expect(
    client.send(new GetEventSourceMappingCommand({ UUID: uuid })),
  ).rejects.toThrow();
});

test("Lambda CodeSigningConfig lifecycle", async () => {
  const client = lambda();
  const name = "bunsai-ops-csc";
  await createFn(client, name);

  const created = await client.send(
    new CreateCodeSigningConfigCommand({
      AllowedPublishers: { SigningProfileVersionArns: [] },
      Description: "test csc",
    }),
  );
  expect(created.CodeSigningConfig?.CodeSigningConfigArn).toBeDefined();
  const arn = created.CodeSigningConfig!.CodeSigningConfigArn!;

  const got = await client.send(
    new GetCodeSigningConfigCommand({ CodeSigningConfigArn: arn }),
  );
  expect(got.CodeSigningConfig?.Description).toBe("test csc");

  const updated = await client.send(
    new UpdateCodeSigningConfigCommand({
      CodeSigningConfigArn: arn,
      Description: "updated desc",
    }),
  );
  expect(updated.CodeSigningConfig?.Description).toBe("updated desc");

  const listed = await client.send(new ListCodeSigningConfigsCommand({}));
  const arns = (listed.CodeSigningConfigs ?? []).map(
    (c) => c.CodeSigningConfigArn,
  );
  expect(arns).toContain(arn);

  await client.send(
    new PutFunctionCodeSigningConfigCommand({
      FunctionName: name,
      CodeSigningConfigArn: arn,
    }),
  );

  const fnCsc = await client.send(
    new GetFunctionCodeSigningConfigCommand({ FunctionName: name }),
  );
  expect(fnCsc.CodeSigningConfigArn).toBe(arn);

  const byConfig = await client.send(
    new ListFunctionsByCodeSigningConfigCommand({
      CodeSigningConfigArn: arn,
    }),
  );
  expect(byConfig.FunctionArns?.length).toBeGreaterThan(0);

  await client.send(
    new DeleteCodeSigningConfigCommand({ CodeSigningConfigArn: arn }),
  );
});

test("Lambda FunctionEventInvokeConfig lifecycle", async () => {
  const client = lambda();
  const name = "bunsai-ops-eic";
  await createFn(client, name);

  await client.send(
    new PutFunctionEventInvokeConfigCommand({
      FunctionName: name,
      MaximumRetryAttempts: 2,
      MaximumEventAgeInSeconds: 300,
    }),
  );

  const got = await client.send(
    new GetFunctionEventInvokeConfigCommand({ FunctionName: name }),
  );
  expect(got.MaximumRetryAttempts).toBe(2);
  expect(got.MaximumEventAgeInSeconds).toBe(300);

  const listed = await client.send(
    new ListFunctionEventInvokeConfigsCommand({ FunctionName: name }),
  );
  expect(listed.FunctionEventInvokeConfigs?.length).toBe(1);

  await client.send(
    new DeleteFunctionEventInvokeConfigCommand({ FunctionName: name }),
  );

  await expect(
    client.send(
      new GetFunctionEventInvokeConfigCommand({ FunctionName: name }),
    ),
  ).rejects.toThrow();
});

test("Lambda layer operations", async () => {
  const client = lambda();
  const layerName = "bunsai-ops-layer";

  const published = await client.send(
    new PublishLayerVersionCommand({
      LayerName: layerName,
      Content: { ZipFile: new TextEncoder().encode("PK fake zip") },
      CompatibleRuntimes: ["nodejs20.x"],
    }),
  );
  expect(published.Version).toBe(1);

  const layerArn = published.LayerVersionArn!;

  const byArn = await client.send(
    new GetLayerVersionByArnCommand({ Arn: layerArn }),
  );
  expect(byArn.LayerVersionArn).toBe(layerArn);

  const listed = await client.send(
    new ListLayerVersionsCommand({ LayerName: layerName }),
  );
  expect(listed.LayerVersions?.length).toBe(1);

  await client.send(
    new AddLayerVersionPermissionCommand({
      LayerName: layerName,
      VersionNumber: 1,
      StatementId: "allow-account",
      Action: "lambda:GetLayerVersion",
      Principal: "*",
    }),
  );

  const policy = await client.send(
    new GetLayerVersionPolicyCommand({
      LayerName: layerName,
      VersionNumber: 1,
    }),
  );
  expect(policy.Policy).toBeDefined();

  await client.send(
    new RemoveLayerVersionPermissionCommand({
      LayerName: layerName,
      VersionNumber: 1,
      StatementId: "allow-account",
    }),
  );

  await client.send(
    new DeleteLayerVersionCommand({ LayerName: layerName, VersionNumber: 1 }),
  );

  const listedAfter = await client.send(
    new ListLayerVersionsCommand({ LayerName: layerName }),
  );
  expect(listedAfter.LayerVersions?.length).toBe(0);
});

test("Lambda ProvisionedConcurrencyConfig lifecycle", async () => {
  const client = lambda();
  const name = "bunsai-ops-pc";
  await createFn(client, name);

  await client.send(
    new PutProvisionedConcurrencyConfigCommand({
      FunctionName: name,
      Qualifier: "$LATEST",
      ProvisionedConcurrentExecutions: 5,
    }),
  );

  const got = await client.send(
    new GetProvisionedConcurrencyConfigCommand({
      FunctionName: name,
      Qualifier: "$LATEST",
    }),
  );
  expect(got.RequestedProvisionedConcurrentExecutions).toBe(5);

  const listed = await client.send(
    new ListProvisionedConcurrencyConfigsCommand({ FunctionName: name }),
  );
  expect(listed.ProvisionedConcurrencyConfigs?.length).toBe(1);

  await client.send(
    new DeleteProvisionedConcurrencyConfigCommand({
      FunctionName: name,
      Qualifier: "$LATEST",
    }),
  );
});

test("Lambda FunctionRecursionConfig", async () => {
  const client = lambda();
  const name = "bunsai-ops-recursion";
  await createFn(client, name);

  const got = await client.send(
    new GetFunctionRecursionConfigCommand({ FunctionName: name }),
  );
  expect(got.RecursiveLoop).toBe("Terminate");

  await client.send(
    new PutFunctionRecursionConfigCommand({
      FunctionName: name,
      RecursiveLoop: "Allow",
    }),
  );

  const updated = await client.send(
    new GetFunctionRecursionConfigCommand({ FunctionName: name }),
  );
  expect(updated.RecursiveLoop).toBe("Allow");
});

test("Lambda RuntimeManagementConfig", async () => {
  const client = lambda();
  const name = "bunsai-ops-runtime";
  await createFn(client, name);

  const got = await client.send(
    new GetRuntimeManagementConfigCommand({ FunctionName: name }),
  );
  expect(got.UpdateRuntimeOn).toBe("Auto");

  await client.send(
    new PutRuntimeManagementConfigCommand({
      FunctionName: name,
      UpdateRuntimeOn: "Manual",
    }),
  );

  const updated = await client.send(
    new GetRuntimeManagementConfigCommand({ FunctionName: name }),
  );
  expect(updated.UpdateRuntimeOn).toBe("Manual");
});

test("Lambda GetAccountSettings", async () => {
  const client = lambda();
  const settings = await client.send(new GetAccountSettingsCommand({}));
  expect(settings.AccountLimit?.ConcurrentExecutions).toBeGreaterThan(0);
  expect(settings.AccountUsage).toBeDefined();
});

test("Lambda ListVersionsByFunction", async () => {
  const client = lambda();
  const name = "bunsai-ops-versions";
  await createFn(client, name);
  await client.send(new PublishVersionCommand({ FunctionName: name }));
  await client.send(new PublishVersionCommand({ FunctionName: name }));

  const listed = await client.send(
    new ListVersionsByFunctionCommand({ FunctionName: name }),
  );
  const versions = (listed.Versions ?? []).map((v) => v.Version);
  expect(versions).toContain("$LATEST");
  expect(versions).toContain("1");
  expect(versions).toContain("2");
});

test("Lambda FunctionUrlConfig update and list", async () => {
  const client = lambda();
  const name = "bunsai-ops-url2";
  await createFn(client, name);

  const created = await client.send(
    new (await import("@aws-sdk/client-lambda")).CreateFunctionUrlConfigCommand(
      {
        FunctionName: name,
        AuthType: "NONE",
      },
    ),
  );
  expect(created.FunctionUrl).toBeDefined();

  const updated = await client.send(
    new UpdateFunctionUrlConfigCommand({
      FunctionName: name,
      AuthType: "AWS_IAM",
    }),
  );
  expect(updated.AuthType).toBe("AWS_IAM");

  const listed = await client.send(
    new ListFunctionUrlConfigsCommand({ FunctionName: name }),
  );
  expect(listed.FunctionUrlConfigs?.length).toBe(1);
});
