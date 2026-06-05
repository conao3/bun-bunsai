import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateFunctionCommand,
  CreateFunctionUrlConfigCommand,
  DeleteFunctionConcurrencyCommand,
  DeleteFunctionUrlConfigCommand,
  GetFunctionConcurrencyCommand,
  GetFunctionUrlConfigCommand,
  GetLayerVersionCommand,
  LambdaClient,
  ListLayersCommand,
  PublishLayerVersionCommand,
  PutFunctionConcurrencyCommand,
} from "@aws-sdk/client-lambda";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

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

test("Lambda function concurrency lifecycle", async () => {
  const client = lambda();
  const name = "bunsai-url-concurrency";
  await createFn(client, name);

  const put = await client.send(
    new PutFunctionConcurrencyCommand({
      FunctionName: name,
      ReservedConcurrentExecutions: 10,
    }),
  );
  expect(put.ReservedConcurrentExecutions).toBe(10);

  const got = await client.send(
    new GetFunctionConcurrencyCommand({ FunctionName: name }),
  );
  expect(got.ReservedConcurrentExecutions).toBe(10);

  const deleted = await client.send(
    new DeleteFunctionConcurrencyCommand({ FunctionName: name }),
  );
  expect(deleted.$metadata.httpStatusCode).toBe(204);

  const after = await client.send(
    new GetFunctionConcurrencyCommand({ FunctionName: name }),
  );
  expect(after.ReservedConcurrentExecutions).toBeUndefined();
});

test("Lambda function url config lifecycle", async () => {
  const client = lambda();
  const name = "bunsai-url-config";
  const arn = await createFn(client, name);

  const created = await client.send(
    new CreateFunctionUrlConfigCommand({
      FunctionName: name,
      AuthType: "NONE",
      Cors: {
        AllowOrigins: ["https://example.com"],
        AllowMethods: ["GET", "POST"],
        MaxAge: 300,
      },
    }),
  );
  expect(created.AuthType).toBe("NONE");
  expect(created.FunctionArn).toBe(arn);
  expect(created.FunctionUrl).toContain("lambda-url");
  expect(created.Cors?.AllowOrigins).toContain("https://example.com");

  const got = await client.send(
    new GetFunctionUrlConfigCommand({ FunctionName: name }),
  );
  expect(got.FunctionUrl).toBe(created.FunctionUrl);
  expect(got.AuthType).toBe("NONE");
  expect(got.LastModifiedTime).toBeDefined();

  const deleted = await client.send(
    new DeleteFunctionUrlConfigCommand({ FunctionName: name }),
  );
  expect(deleted.$metadata.httpStatusCode).toBe(204);

  await expect(
    client.send(new GetFunctionUrlConfigCommand({ FunctionName: name })),
  ).rejects.toThrow();
});

test("Lambda layer version lifecycle", async () => {
  const client = lambda();
  const layerName = "bunsai-url-layer";

  const v1 = await client.send(
    new PublishLayerVersionCommand({
      LayerName: layerName,
      Description: "first layer",
      Content: { ZipFile: new TextEncoder().encode("PK fake layer") },
      CompatibleRuntimes: ["nodejs20.x"],
      CompatibleArchitectures: ["x86_64"],
      LicenseInfo: "MIT",
    }),
  );
  expect(v1.Version).toBe(1);
  expect(v1.LayerVersionArn).toContain(`:layer:${layerName}:1`);
  expect(v1.CompatibleRuntimes).toContain("nodejs20.x");

  const v2 = await client.send(
    new PublishLayerVersionCommand({
      LayerName: layerName,
      Content: { ZipFile: new TextEncoder().encode("PK fake layer 2") },
    }),
  );
  expect(v2.Version).toBe(2);

  const got = await client.send(
    new GetLayerVersionCommand({ LayerName: layerName, VersionNumber: 1 }),
  );
  expect(got.Version).toBe(1);
  expect(got.Description).toBe("first layer");
  expect(got.LicenseInfo).toBe("MIT");

  const listed = await client.send(new ListLayersCommand({}));
  const names = (listed.Layers ?? []).map((l) => l.LayerName);
  expect(names).toContain(layerName);
  const match = (listed.Layers ?? []).find((l) => l.LayerName === layerName);
  expect(match?.LatestMatchingVersion?.Version).toBe(2);

  await expect(
    client.send(
      new GetLayerVersionCommand({ LayerName: layerName, VersionNumber: 99 }),
    ),
  ).rejects.toThrow();
});
