import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  APIGatewayClient,
  CreateDeploymentCommand,
  CreateDocumentationPartCommand,
  CreateDocumentationVersionCommand,
  CreateRequestValidatorCommand,
  CreateResourceCommand,
  CreateRestApiCommand,
  CreateStageCommand,
  DeleteDeploymentCommand,
  DeleteDocumentationPartCommand,
  DeleteDocumentationVersionCommand,
  DeleteMethodCommand,
  DeleteRequestValidatorCommand,
  DeleteResourceCommand,
  DeleteStageCommand,
  GetAccountCommand,
  GetDeploymentCommand,
  GetDeploymentsCommand,
  GetDocumentationPartCommand,
  GetDocumentationPartsCommand,
  GetDocumentationVersionCommand,
  GetDocumentationVersionsCommand,
  GetGatewayResponseCommand,
  GetGatewayResponsesCommand,
  GetIntegrationCommand,
  GetMethodCommand,
  GetMethodResponseCommand,
  GetRequestValidatorCommand,
  GetRequestValidatorsCommand,
  GetResourceCommand,
  GetSdkTypeCommand,
  GetSdkTypesCommand,
  PutGatewayResponseCommand,
  PutIntegrationCommand,
  PutIntegrationResponseCommand,
  PutMethodCommand,
  PutMethodResponseCommand,
  UpdateDeploymentCommand,
  UpdateDocumentationPartCommand,
  UpdateDocumentationVersionCommand,
  UpdateGatewayResponseCommand,
  UpdateMethodCommand,
  UpdateRequestValidatorCommand,
  UpdateRestApiCommand,
  UpdateStageCommand,
} from "@aws-sdk/client-api-gateway";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const apigateway = () =>
  new APIGatewayClient({ endpoint, region, credentials, requestHandler });

test("resource, method and integration lifecycle", async () => {
  const client = apigateway();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-resource-method-api" }),
  );
  const restApiId = api.id as string;
  const rootResourceId = api.rootResourceId as string;
  expect(restApiId).toBeDefined();
  expect(rootResourceId).toBeDefined();

  await client.send(
    new UpdateRestApiCommand({
      restApiId,
      patchOperations: [
        { op: "replace", path: "/description", value: "updated" },
      ],
    }),
  );

  const resource = await client.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "items",
    }),
  );
  const resourceId = resource.id as string;
  expect(resource.path).toBe("/items");

  const gotResource = await client.send(
    new GetResourceCommand({ restApiId, resourceId }),
  );
  expect(gotResource.path).toBe("/items");

  const method = await client.send(
    new PutMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      authorizationType: "NONE",
    }),
  );
  expect(method.httpMethod).toBe("GET");
  expect(method.authorizationType).toBe("NONE");

  const gotMethod = await client.send(
    new GetMethodCommand({ restApiId, resourceId, httpMethod: "GET" }),
  );
  expect(gotMethod.httpMethod).toBe("GET");

  await client.send(
    new UpdateMethodCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      patchOperations: [
        { op: "replace", path: "/operationName", value: "ListItems" },
      ],
    }),
  );

  const methodResp = await client.send(
    new PutMethodResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      statusCode: "200",
      responseModels: { "application/json": "Empty" },
    }),
  );
  expect(methodResp.statusCode).toBe("200");

  const gotMethodResp = await client.send(
    new GetMethodResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      statusCode: "200",
    }),
  );
  expect(gotMethodResp.statusCode).toBe("200");

  const integration = await client.send(
    new PutIntegrationCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      type: "MOCK",
    }),
  );
  expect(integration.type).toBe("MOCK");

  const gotIntegration = await client.send(
    new GetIntegrationCommand({ restApiId, resourceId, httpMethod: "GET" }),
  );
  expect(gotIntegration.type).toBe("MOCK");

  const integResp = await client.send(
    new PutIntegrationResponseCommand({
      restApiId,
      resourceId,
      httpMethod: "GET",
      statusCode: "200",
      responseTemplates: { "application/json": '{"message": "ok"}' },
    }),
  );
  expect(integResp.statusCode).toBe("200");

  await client.send(
    new DeleteMethodCommand({ restApiId, resourceId, httpMethod: "GET" }),
  );

  await expect(
    client.send(
      new GetMethodCommand({ restApiId, resourceId, httpMethod: "GET" }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteResourceCommand({ restApiId, resourceId }));

  await expect(
    client.send(new GetResourceCommand({ restApiId, resourceId })),
  ).rejects.toThrow();
});

test("deployment and stage lifecycle", async () => {
  const client = apigateway();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-deployment-stage-api" }),
  );
  const restApiId = api.id as string;

  const deployment = await client.send(
    new CreateDeploymentCommand({ restApiId, description: "v1" }),
  );
  const deploymentId = deployment.id as string;
  expect(deploymentId).toBeDefined();

  const gotDeployment = await client.send(
    new GetDeploymentCommand({ restApiId, deploymentId }),
  );
  expect(gotDeployment.id).toBe(deploymentId);
  expect(gotDeployment.description).toBe("v1");

  const deployments = await client.send(
    new GetDeploymentsCommand({ restApiId }),
  );
  const ids = (deployments.items ?? []).map((d) => d.id);
  expect(ids).toContain(deploymentId);

  await client.send(
    new UpdateDeploymentCommand({
      restApiId,
      deploymentId,
      patchOperations: [
        { op: "replace", path: "/description", value: "v1-updated" },
      ],
    }),
  );

  const stage = await client.send(
    new CreateStageCommand({
      restApiId,
      stageName: "dev",
      deploymentId,
      tracingEnabled: true,
    }),
  );
  expect(stage.stageName).toBe("dev");
  expect(stage.tracingEnabled).toBe(true);

  await client.send(
    new UpdateStageCommand({
      restApiId,
      stageName: "dev",
      patchOperations: [
        { op: "replace", path: "/description", value: "dev stage" },
      ],
    }),
  );

  await client.send(new DeleteStageCommand({ restApiId, stageName: "dev" }));

  await client.send(new DeleteDeploymentCommand({ restApiId, deploymentId }));

  const afterDelete = await client.send(
    new GetDeploymentsCommand({ restApiId }),
  );
  const afterIds = (afterDelete.items ?? []).map((d) => d.id);
  expect(afterIds).not.toContain(deploymentId);
});

test("documentation part and version lifecycle", async () => {
  const client = apigateway();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-documentation-api" }),
  );
  const restApiId = api.id as string;

  const part = await client.send(
    new CreateDocumentationPartCommand({
      restApiId,
      location: { type: "API" },
      properties: '{"description":"My API"}',
    }),
  );
  const partId = part.id as string;
  expect(partId).toBeDefined();
  expect(part.properties).toBe('{"description":"My API"}');

  const gotPart = await client.send(
    new GetDocumentationPartCommand({
      restApiId,
      documentationPartId: partId,
    }),
  );
  expect(gotPart.id).toBe(partId);

  const parts = await client.send(
    new GetDocumentationPartsCommand({ restApiId }),
  );
  const partIds = (parts.items ?? []).map((p) => p.id);
  expect(partIds).toContain(partId);

  await client.send(
    new UpdateDocumentationPartCommand({
      restApiId,
      documentationPartId: partId,
      patchOperations: [
        {
          op: "replace",
          path: "/properties",
          value: '{"description":"Updated"}',
        },
      ],
    }),
  );

  const docVersion = await client.send(
    new CreateDocumentationVersionCommand({
      restApiId,
      documentationVersion: "1.0",
      description: "initial version",
    }),
  );
  expect(docVersion.version).toBe("1.0");
  expect(docVersion.description).toBe("initial version");

  const gotVersion = await client.send(
    new GetDocumentationVersionCommand({
      restApiId,
      documentationVersion: "1.0",
    }),
  );
  expect(gotVersion.version).toBe("1.0");

  const versions = await client.send(
    new GetDocumentationVersionsCommand({ restApiId }),
  );
  const verNumbers = (versions.items ?? []).map((v) => v.version);
  expect(verNumbers).toContain("1.0");

  await client.send(
    new UpdateDocumentationVersionCommand({
      restApiId,
      documentationVersion: "1.0",
      patchOperations: [
        { op: "replace", path: "/description", value: "updated version" },
      ],
    }),
  );

  await client.send(
    new DeleteDocumentationVersionCommand({
      restApiId,
      documentationVersion: "1.0",
    }),
  );

  await expect(
    client.send(
      new GetDocumentationVersionCommand({
        restApiId,
        documentationVersion: "1.0",
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteDocumentationPartCommand({
      restApiId,
      documentationPartId: partId,
    }),
  );

  await expect(
    client.send(
      new GetDocumentationPartCommand({
        restApiId,
        documentationPartId: partId,
      }),
    ),
  ).rejects.toThrow();
});

test("request validator lifecycle", async () => {
  const client = apigateway();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-validator-api" }),
  );
  const restApiId = api.id as string;

  const validator = await client.send(
    new CreateRequestValidatorCommand({
      restApiId,
      name: "body-validator",
      validateRequestBody: true,
      validateRequestParameters: false,
    }),
  );
  const requestValidatorId = validator.id as string;
  expect(requestValidatorId).toBeDefined();
  expect(validator.name).toBe("body-validator");
  expect(validator.validateRequestBody).toBe(true);

  const gotValidator = await client.send(
    new GetRequestValidatorCommand({ restApiId, requestValidatorId }),
  );
  expect(gotValidator.id).toBe(requestValidatorId);

  const validators = await client.send(
    new GetRequestValidatorsCommand({ restApiId }),
  );
  const validatorIds = (validators.items ?? []).map((v) => v.id);
  expect(validatorIds).toContain(requestValidatorId);

  await client.send(
    new UpdateRequestValidatorCommand({
      restApiId,
      requestValidatorId,
      patchOperations: [
        { op: "replace", path: "/name", value: "updated-validator" },
      ],
    }),
  );

  await client.send(
    new DeleteRequestValidatorCommand({ restApiId, requestValidatorId }),
  );

  await expect(
    client.send(
      new GetRequestValidatorCommand({ restApiId, requestValidatorId }),
    ),
  ).rejects.toThrow();
});

test("gateway response lifecycle", async () => {
  const client = apigateway();

  const api = await client.send(
    new CreateRestApiCommand({ name: "e2e-gateway-response-api" }),
  );
  const restApiId = api.id as string;

  const gwResponse = await client.send(
    new PutGatewayResponseCommand({
      restApiId,
      responseType: "DEFAULT_4XX",
      statusCode: "404",
      responseTemplates: {
        "application/json": '{"message":"$context.error.message"}',
      },
    }),
  );
  expect(gwResponse.responseType).toBe("DEFAULT_4XX");
  expect(gwResponse.statusCode).toBe("404");

  const gotGwResponse = await client.send(
    new GetGatewayResponseCommand({
      restApiId,
      responseType: "DEFAULT_4XX",
    }),
  );
  expect(gotGwResponse.responseType).toBe("DEFAULT_4XX");

  const gwResponses = await client.send(
    new GetGatewayResponsesCommand({ restApiId }),
  );
  const types = (gwResponses.items ?? []).map((r) => r.responseType);
  expect(types).toContain("DEFAULT_4XX");

  await client.send(
    new UpdateGatewayResponseCommand({
      restApiId,
      responseType: "DEFAULT_4XX",
      patchOperations: [{ op: "replace", path: "/statusCode", value: "400" }],
    }),
  );
});

test("account operations", async () => {
  const client = apigateway();

  const account = await client.send(new GetAccountCommand({}));
  expect(account.apiKeyVersion).toBeDefined();
  expect(account.throttleSettings).toBeDefined();
});

test("sdk types", async () => {
  const client = apigateway();

  const types = await client.send(new GetSdkTypesCommand({}));
  expect((types.items ?? []).length).toBeGreaterThan(0);

  const jsType = await client.send(new GetSdkTypeCommand({ id: "javascript" }));
  expect(jsType.id).toBe("javascript");
  expect(jsType.friendlyName).toBeDefined();
});
