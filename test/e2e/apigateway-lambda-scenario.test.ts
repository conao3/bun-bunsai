import { expect, test } from "bun:test";
import {
  APIGatewayClient,
  CreateDeploymentCommand,
  CreateResourceCommand,
  CreateRestApiCommand,
  CreateStageCommand,
  GetResourcesCommand,
  PutIntegrationCommand,
  PutMethodCommand,
  TestInvokeMethodCommand,
} from "@aws-sdk/client-api-gateway";
import { CreateFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { makeZip } from "./event-helpers.ts";
import { startApp } from "./harness.ts";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const apigw = () =>
  new APIGatewayClient({ endpoint, region, credentials, requestHandler });
const lam = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

test("API Gateway → Lambda proxy integration round-trip via TestInvokeMethod", async () => {
  const lambdaClient = lam();
  const gwClient = apigw();

  const fnName = "e2e-scenario-proxy-fn";
  await lambdaClient.send(
    new CreateFunctionCommand({
      FunctionName: fnName,
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: {
        ZipFile: makeZip({
          "index.js":
            "exports.handler = async (event) => ({ statusCode: 201, headers: { 'x-echo-method': event.httpMethod }, body: JSON.stringify({ received: JSON.parse(event.body || 'null'), path: event.path }) });",
        }),
      },
    }),
  );

  const api = await gwClient.send(
    new CreateRestApiCommand({ name: "e2e-scenario-proxy-api" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;

  const resources = await gwClient.send(new GetResourcesCommand({ restApiId }));
  expect(resources.items?.find((r) => r.path === "/")).toBeDefined();

  const resource = await gwClient.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "items",
    }),
  );
  const resourceId = resource.id as string;
  expect(resource.path).toBe("/items");

  await gwClient.send(
    new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "POST",
      authorizationType: "NONE",
    }),
  );

  const functionArn = `arn:aws:lambda:${region}:000000000000:function:${fnName}`;
  await gwClient.send(
    new PutIntegrationCommand({
      restApiId,
      resourceId,
      httpMethod: "POST",
      type: "AWS_PROXY",
      integrationHttpMethod: "POST",
      uri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${functionArn}/invocations`,
    }),
  );

  const deployment = await gwClient.send(
    new CreateDeploymentCommand({ restApiId }),
  );
  expect(deployment.id).toBeDefined();

  await gwClient.send(
    new CreateStageCommand({
      restApiId,
      stageName: "dev",
      deploymentId: deployment.id as string,
    }),
  );

  const body = JSON.stringify({ name: "widget" });
  const result = await gwClient.send(
    new TestInvokeMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "POST",
      body,
    }),
  );

  expect(result.status).toBe(201);
  expect(result.headers?.["x-echo-method"]).toBe("POST");
  const parsed = JSON.parse(result.body as string) as {
    received: { name: string };
    path: string;
  };
  expect(parsed.received).toEqual({ name: "widget" });
  expect(parsed.path).toBe("/items");
});

test("TestInvokeMethod on method without integration returns NotFoundException", async () => {
  const gwClient = apigw();

  const api = await gwClient.send(
    new CreateRestApiCommand({ name: "e2e-scenario-no-integration" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;

  const resource = await gwClient.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "bare",
    }),
  );
  const resourceId = resource.id as string;

  await gwClient.send(
    new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      authorizationType: "NONE",
    }),
  );

  await expect(
    gwClient.send(
      new TestInvokeMethodCommand({
        restApiId,
        resourceId,
        httpMethod: "GET",
      }),
    ),
  ).rejects.toThrow();
});
