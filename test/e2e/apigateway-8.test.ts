import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
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

const app = startApp();
const { endpoint, requestHandler, gwFetch } = app;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const apigw = () =>
  new APIGatewayClient({ endpoint, region, credentials, requestHandler });

test("execute-api MOCK: stage variable substituted in response template", async () => {
  const client = apigw();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-stagevar-api" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;

  const resource = await client.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "greet",
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
        "application/json":
          '{"greeting":"hello ${stageVariables.who}","env":"${stageVariables.env}"}',
      },
    }),
  );

  const deployment = await client.send(
    new CreateDeploymentCommand({ restApiId }),
  );

  await client.send(
    new CreateStageCommand({
      restApiId,
      stageName: "v1",
      deploymentId: deployment.id as string,
      variables: { who: "world", env: "test" },
    }),
  );

  const res = await gwFetch(
    `http://${restApiId}.execute-api.${region}.localhost/v1/greet`,
  );

  expect(res.status).toBe(200);
  const body = (await res.json()) as { greeting: string; env: string };
  expect(body.greeting).toBe("hello world");
  expect(body.env).toBe("test");
});

test("execute-api MOCK: selectionPattern routes to matching integration response", async () => {
  const client = apigw();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-selection-api" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;

  const resource = await client.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "status",
    }),
  );
  const resourceId = resource.id as string;

  await client.send(
    new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "POST",
      authorizationType: "NONE",
    }),
  );

  await client.send(
    new PutIntegrationCommand({
      restApiId,
      resourceId,
      httpMethod: "POST",
      type: "MOCK",
      requestTemplates: { "application/json": '{"statusCode": 400}' },
    }),
  );

  await client.send(
    new PutMethodResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "POST",
      statusCode: "400",
    }),
  );

  await client.send(
    new PutIntegrationResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "POST",
      statusCode: "200",
      responseTemplates: { "application/json": '{"result":"ok"}' },
    }),
  );

  await client.send(
    new PutIntegrationResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "POST",
      statusCode: "400",
      selectionPattern: "4\\d{2}",
      responseTemplates: { "application/json": '{"result":"bad request"}' },
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
    `http://${restApiId}.execute-api.${region}.localhost/prod/status`,
    { method: "POST", body: "{}" },
  );

  expect(res.status).toBe(400);
  const body = (await res.json()) as { result: string };
  expect(body.result).toBe("bad request");
});

test("execute-api MOCK: $input.json substituted in response template", async () => {
  const client = apigw();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-inputjson-api" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;

  const resource = await client.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "echo",
    }),
  );
  const resourceId = resource.id as string;

  await client.send(
    new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "POST",
      authorizationType: "NONE",
    }),
  );

  await client.send(
    new PutIntegrationCommand({
      restApiId,
      resourceId,
      httpMethod: "POST",
      type: "MOCK",
      requestTemplates: { "application/json": '{"statusCode": 200}' },
    }),
  );

  await client.send(
    new PutMethodResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "POST",
      statusCode: "200",
    }),
  );

  await client.send(
    new PutIntegrationResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "POST",
      statusCode: "200",
      responseTemplates: {
        "application/json": "{\"received\":$input.json('$')}",
      },
    }),
  );

  const deployment = await client.send(
    new CreateDeploymentCommand({ restApiId }),
  );

  await client.send(
    new CreateStageCommand({
      restApiId,
      stageName: "dev",
      deploymentId: deployment.id as string,
    }),
  );

  const res = await gwFetch(
    `http://${restApiId}.execute-api.${region}.localhost/dev/echo`,
    {
      method: "POST",
      body: '{"name":"alice"}',
      headers: { "content-type": "application/json" },
    },
  );

  expect(res.status).toBe(200);
  const body = (await res.json()) as { received: { name: string } };
  expect(body.received).toEqual({ name: "alice" });
});

test("execute-api MOCK: wrong path returns 403", async () => {
  const client = apigw();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-403-stagevar-api" }),
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
      stageName: "v1",
      deploymentId: deployment.id as string,
      variables: { key: "value" },
    }),
  );

  const res = await gwFetch(
    `http://${restApiId}.execute-api.${region}.localhost/v1/nonexistent/path`,
  );

  expect(res.status).toBe(403);
  const body = (await res.json()) as { message: string };
  expect(body.message).toBe("Missing Authentication Token");
});
