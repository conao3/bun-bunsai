import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { makeZip } from "./event-helpers.ts";
import {
  APIGatewayClient,
  CreateAuthorizerCommand,
  CreateDeploymentCommand,
  CreateModelCommand,
  CreateRequestValidatorCommand,
  CreateResourceCommand,
  CreateRestApiCommand,
  CreateStageCommand,
  CreateApiKeyCommand,
  GetApiKeyCommand,
  PutGatewayResponseCommand,
  PutIntegrationCommand,
  PutIntegrationResponseCommand,
  PutMethodCommand,
  PutMethodResponseCommand,
  UpdateStageCommand,
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

test("execute-api request body validation rejects missing required field", async () => {
  const client = apigw();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-req-body-validation" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;

  await client.send(
    new CreateModelCommand({
      restApiId,
      name: "ItemInput",
      contentType: "application/json",
      schema: JSON.stringify({
        type: "object",
        required: ["name"],
        properties: { name: { type: "string" } },
      }),
    }),
  );

  const validator = await client.send(
    new CreateRequestValidatorCommand({
      restApiId,
      name: "body-validator",
      validateRequestBody: true,
      validateRequestParameters: false,
    }),
  );
  const requestValidatorId = validator.id as string;

  const resource = await client.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "items",
    }),
  );
  const resourceId = resource.id as string;

  await client.send(
    new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "POST",
      authorizationType: "NONE",
      requestValidatorId,
      requestModels: { "application/json": "ItemInput" },
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
      responseTemplates: { "application/json": '{"created": true}' },
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
    }),
  );

  const base = `http://${restApiId}.execute-api.${region}.localhost/v1/items`;

  const badRes = await gwFetch(base, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ description: "missing name field" }),
  });
  expect(badRes.status).toBe(400);
  const badBody = (await badRes.json()) as { message: string };
  expect(badBody.message).toContain("Invalid request body");

  const okRes = await gwFetch(base, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "widget" }),
  });
  expect(okRes.status).toBe(200);
});

test("execute-api request parameter validation rejects missing required querystring", async () => {
  const client = apigw();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-req-param-validation" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;

  const validator = await client.send(
    new CreateRequestValidatorCommand({
      restApiId,
      name: "param-validator",
      validateRequestBody: false,
      validateRequestParameters: true,
    }),
  );
  const requestValidatorId = validator.id as string;

  const resource = await client.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "search",
    }),
  );
  const resourceId = resource.id as string;

  await client.send(
    new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      authorizationType: "NONE",
      requestValidatorId,
      requestParameters: { "method.request.querystring.q": true },
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
      responseTemplates: { "application/json": '{"results": []}' },
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
    }),
  );

  const base = `http://${restApiId}.execute-api.${region}.localhost/v1/search`;

  const badRes = await gwFetch(`${base}`);
  expect(badRes.status).toBe(400);
  const badBody = (await badRes.json()) as { message: string };
  expect(badBody.message).toContain("Missing required request parameters");

  const okRes = await gwFetch(`${base}?q=hello`);
  expect(okRes.status).toBe(200);
});

test("execute-api TOKEN authorizer returns 401 when token missing", async () => {
  const lambdaClient = lam();
  const gwClient = apigw();

  const fnName = "e2e-token-authorizer-fn";
  await lambdaClient.send(
    new CreateFunctionCommand({
      FunctionName: fnName,
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: {
        ZipFile: makeZip({
          "index.js": [
            "exports.handler = async (event) => {",
            "  if (event.authorizationToken === 'allow') {",
            "    return { policyDocument: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: 'execute-api:Invoke', Resource: '*' }] } };",
            "  }",
            "  return { policyDocument: { Version: '2012-10-17', Statement: [{ Effect: 'Deny', Action: 'execute-api:Invoke', Resource: '*' }] } };",
            "};",
          ].join("\n"),
        }),
      },
    }),
  );

  const api = await gwClient.send(
    new CreateRestApiCommand({ name: "e2e-token-auth-api" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;

  const functionArn = `arn:aws:lambda:${region}:000000000000:function:${fnName}`;
  const authorizer = await gwClient.send(
    new CreateAuthorizerCommand({
      restApiId,
      name: "token-auth",
      type: "TOKEN",
      authorizerUri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${functionArn}/invocations`,
      identitySource: "method.request.header.Authorization",
    }),
  );
  const authorizerId = authorizer.id as string;

  const resource = await gwClient.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "secure",
    }),
  );
  const secureResourceId = resource.id as string;

  await gwClient.send(
    new PutMethodCommand({
      restApiId,
      resourceId: secureResourceId,
      httpMethod: "GET",
      authorizationType: "CUSTOM",
      authorizerId,
    }),
  );

  await gwClient.send(
    new PutIntegrationCommand({
      restApiId,
      resourceId: secureResourceId,
      httpMethod: "GET",
      type: "MOCK",
      requestTemplates: { "application/json": '{"statusCode": 200}' },
    }),
  );

  await gwClient.send(
    new PutMethodResponseCommand({
      restApiId,
      resourceId: secureResourceId,
      httpMethod: "GET",
      statusCode: "200",
    }),
  );

  await gwClient.send(
    new PutIntegrationResponseCommand({
      restApiId,
      resourceId: secureResourceId,
      httpMethod: "GET",
      statusCode: "200",
      responseTemplates: { "application/json": '{"secret": "data"}' },
    }),
  );

  const deployment = await gwClient.send(
    new CreateDeploymentCommand({ restApiId }),
  );
  await gwClient.send(
    new CreateStageCommand({
      restApiId,
      stageName: "v1",
      deploymentId: deployment.id as string,
    }),
  );

  const base = `http://${restApiId}.execute-api.${region}.localhost/v1/secure`;

  const noTokenRes = await gwFetch(base);
  expect(noTokenRes.status).toBe(401);

  const denyRes = await gwFetch(base, {
    headers: { Authorization: "deny" },
  });
  expect(denyRes.status).toBe(403);

  const allowRes = await gwFetch(base, {
    headers: { Authorization: "allow" },
  });
  expect(allowRes.status).toBe(200);
});

test("execute-api COGNITO_USER_POOLS authorizer returns 401 without Authorization header", async () => {
  const gwClient = apigw();

  const api = await gwClient.send(
    new CreateRestApiCommand({ name: "e2e-cognito-auth-api" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;

  const authorizer = await gwClient.send(
    new CreateAuthorizerCommand({
      restApiId,
      name: "cognito-auth",
      type: "COGNITO_USER_POOLS",
      providerARNs: [
        `arn:aws:cognito-idp:${region}:000000000000:userpool/us-east-1_test`,
      ],
      identitySource: "method.request.header.Authorization",
    }),
  );
  const authorizerId = authorizer.id as string;

  const resource = await gwClient.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "profile",
    }),
  );
  const resourceId = resource.id as string;

  await gwClient.send(
    new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      authorizationType: "COGNITO_USER_POOLS",
      authorizerId,
    }),
  );

  await gwClient.send(
    new PutIntegrationCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      type: "MOCK",
      requestTemplates: { "application/json": '{"statusCode": 200}' },
    }),
  );

  await gwClient.send(
    new PutMethodResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      statusCode: "200",
    }),
  );

  await gwClient.send(
    new PutIntegrationResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      statusCode: "200",
      responseTemplates: { "application/json": '{"user": "data"}' },
    }),
  );

  const deployment = await gwClient.send(
    new CreateDeploymentCommand({ restApiId }),
  );
  await gwClient.send(
    new CreateStageCommand({
      restApiId,
      stageName: "v1",
      deploymentId: deployment.id as string,
    }),
  );

  const base = `http://${restApiId}.execute-api.${region}.localhost/v1/profile`;

  const noAuthRes = await gwFetch(base);
  expect(noAuthRes.status).toBe(401);

  const withTokenRes = await gwFetch(base, {
    headers: { Authorization: "Bearer mock-jwt-token" },
  });
  expect(withTokenRes.status).toBe(200);
});

test("GatewayResponse custom template applied on authorizer 401", async () => {
  const gwClient = apigw();

  const api = await gwClient.send(
    new CreateRestApiCommand({ name: "e2e-gateway-response-api" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;

  await gwClient.send(
    new PutGatewayResponseCommand({
      restApiId,
      responseType: "UNAUTHORIZED",
      statusCode: "401",
      responseTemplates: {
        "application/json":
          '{"error": "auth_required", "detail": $context.error.messageString}',
      },
    }),
  );

  const authorizer = await gwClient.send(
    new CreateAuthorizerCommand({
      restApiId,
      name: "gw-resp-auth",
      type: "COGNITO_USER_POOLS",
      providerARNs: [
        `arn:aws:cognito-idp:${region}:000000000000:userpool/us-east-1_test`,
      ],
      identitySource: "method.request.header.Authorization",
    }),
  );
  const authorizerId = authorizer.id as string;

  const resource = await gwClient.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "data",
    }),
  );
  const resourceId = resource.id as string;

  await gwClient.send(
    new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      authorizationType: "COGNITO_USER_POOLS",
      authorizerId,
    }),
  );

  await gwClient.send(
    new PutIntegrationCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      type: "MOCK",
      requestTemplates: { "application/json": '{"statusCode": 200}' },
    }),
  );

  await gwClient.send(
    new PutMethodResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      statusCode: "200",
    }),
  );

  await gwClient.send(
    new PutIntegrationResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      statusCode: "200",
      responseTemplates: { "application/json": '{"data": true}' },
    }),
  );

  const deployment = await gwClient.send(
    new CreateDeploymentCommand({ restApiId }),
  );
  await gwClient.send(
    new CreateStageCommand({
      restApiId,
      stageName: "v1",
      deploymentId: deployment.id as string,
    }),
  );

  const base = `http://${restApiId}.execute-api.${region}.localhost/v1/data`;

  const res = await gwFetch(base);
  expect(res.status).toBe(401);
  const body = (await res.json()) as { error: string };
  expect(body.error).toBe("auth_required");
});

test("GetApiKey includeValue=false omits value, includeValue=true returns it", async () => {
  const client = apigw();

  const created = await client.send(
    new CreateApiKeyCommand({ name: "test-include-value-key", enabled: true }),
  );
  const keyId = created.id as string;
  expect(created.value).toBeDefined();

  const withoutValue = await client.send(
    new GetApiKeyCommand({ apiKey: keyId }),
  );
  expect(withoutValue.value).toBeUndefined();

  const withValue = await client.send(
    new GetApiKeyCommand({ apiKey: keyId, includeValue: true }),
  );
  expect(withValue.value).toBeDefined();
  expect(withValue.value).toBe(created.value);
});

test("Stage canarySettings round-trip", async () => {
  const client = apigw();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-canary-stage-api" }),
  );
  const restApiId = api.id as string;

  const deployment = await client.send(
    new CreateDeploymentCommand({ restApiId }),
  );
  const deploymentId = deployment.id as string;

  const stage = await client.send(
    new CreateStageCommand({
      restApiId,
      stageName: "prod",
      deploymentId,
      canarySettings: {
        percentTraffic: 10,
        useStageCache: false,
      },
    }),
  );
  expect(stage.canarySettings?.percentTraffic).toBe(10);
  expect(stage.canarySettings?.useStageCache).toBe(false);

  const updated = await client.send(
    new UpdateStageCommand({
      restApiId,
      stageName: "prod",
      patchOperations: [
        { op: "replace", path: "/canarySettings/percentTraffic", value: "25" },
        { op: "replace", path: "/canarySettings/useStageCache", value: "true" },
      ],
    }),
  );
  expect(updated.canarySettings?.percentTraffic).toBe(25);
  expect(updated.canarySettings?.useStageCache).toBe(true);
});

test("execute-api host routing works for an all-digit api id", async () => {
  const res = await gwFetch(
    "http://1234567890.execute-api.us-east-1.localhost/v1/anything",
  );
  const body = (await res.json()) as { message?: string };
  expect(body.message ?? "").not.toContain("is not emulated by bunsai");
  expect(res.status).toBe(403);
});
