import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { makeZip } from "./event-helpers.ts";
import {
  APIGatewayClient,
  CreateDeploymentCommand,
  CreateResourceCommand,
  CreateRestApiCommand,
  CreateStageCommand,
  PutIntegrationCommand,
  PutIntegrationResponseCommand,
  PutMethodCommand,
  PutMethodResponseCommand,
} from "@aws-sdk/client-api-gateway";
import { CreateFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";

const app = startApp();
const { endpoint, requestHandler, gwFetch } = app;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const apigw = () =>
  new APIGatewayClient({ endpoint, region, credentials, requestHandler });
const lam = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

test("execute-api MOCK integration returns configured response", async () => {
  const client = apigw();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-mock-exec-api" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;

  const resource = await client.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "hello",
    }),
  );
  const resourceId = resource.id as string;

  await client.send(
    new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      authorizationType: "NONE",
    }),
  );

  await client.send(
    new PutIntegrationCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      type: "MOCK",
      requestTemplates: { "application/json": '{"statusCode": 200}' },
    }),
  );

  await client.send(
    new PutMethodResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      statusCode: "200",
    }),
  );

  await client.send(
    new PutIntegrationResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      statusCode: "200",
      responseTemplates: {
        "application/json": '{"message":"hello from mock"}',
      },
    }),
  );

  const deployment = await client.send(
    new CreateDeploymentCommand({ restApiId }),
  );
  const deploymentId = deployment.id as string;

  await client.send(
    new CreateStageCommand({
      restApiId,
      stageName: "v1",
      deploymentId,
    }),
  );

  const res = await gwFetch(
    `http://${restApiId}.execute-api.us-east-1.localhost/v1/hello`,
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toEqual({ message: "hello from mock" });
});

test("execute-api unknown route returns 403", async () => {
  const client = apigw();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-404-exec-api" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;

  await client.send(
    new PutMethodCommand({
      restApiId,
      resourceId: rootResourceId,
      httpMethod: "GET",
      authorizationType: "NONE",
    }),
  );

  await client.send(
    new PutIntegrationCommand({
      restApiId,
      resourceId: rootResourceId,
      httpMethod: "GET",
      type: "MOCK",
      requestTemplates: { "application/json": '{"statusCode": 200}' },
    }),
  );

  await client.send(
    new PutIntegrationResponseCommand({
      restApiId,
      resourceId: rootResourceId,
      httpMethod: "GET",
      statusCode: "200",
      responseTemplates: { "application/json": '{"ok":true}' },
    }),
  );

  const deployment = await client.send(
    new CreateDeploymentCommand({ restApiId }),
  );

  await client.send(
    new CreateStageCommand({
      restApiId,
      stageName: "prod",
      deploymentId: deployment.id as string,
    }),
  );

  const res = await gwFetch(
    `http://${restApiId}.execute-api.us-east-1.localhost/prod/notexist`,
  );

  expect(res.status).toBe(403);
  const body = (await res.json()) as { message: string };
  expect(body.message).toBe("Missing Authentication Token");
});

test("execute-api AWS_PROXY Lambda integration invokes real Lambda and returns response", async () => {
  const lambdaClient = lam();
  const gwClient = apigw();

  const fnName = "e2e-apigw-proxy-fn";
  await lambdaClient.send(
    new CreateFunctionCommand({
      FunctionName: fnName,
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: {
        ZipFile: makeZip({
          "index.js":
            "exports.handler = async (event) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: event.path, method: event.httpMethod }) });",
        }),
      },
    }),
  );

  const api = await gwClient.send(
    new CreateRestApiCommand({ name: "e2e-proxy-exec-api" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;

  const resource = await gwClient.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "items",
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

  const functionArn = `arn:aws:lambda:${region}:000000000000:function:${fnName}`;
  await gwClient.send(
    new PutIntegrationCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      type: "AWS_PROXY",
      integrationHttpMethod: "POST",
      uri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${functionArn}/invocations`,
    }),
  );

  const deployment = await gwClient.send(
    new CreateDeploymentCommand({ restApiId }),
  );

  await gwClient.send(
    new CreateStageCommand({
      restApiId,
      stageName: "dev",
      deploymentId: deployment.id as string,
    }),
  );

  const res = await gwFetch(
    `http://${restApiId}.execute-api.us-east-1.localhost/dev/items`,
  );

  expect(res.status).toBe(200);
  const body = (await res.json()) as { path: string; method: string };
  expect(body.method).toBe("GET");
  expect(typeof body.path).toBe("string");
});
