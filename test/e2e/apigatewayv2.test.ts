import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ApiGatewayV2Client,
  CreateApiCommand,
  CreateAuthorizerCommand,
  CreateDeploymentCommand,
  CreateIntegrationCommand,
  CreateRouteCommand,
  CreateStageCommand,
  DeleteApiCommand,
  DeleteAuthorizerCommand,
  DeleteDeploymentCommand,
  DeleteIntegrationCommand,
  DeleteRouteCommand,
  DeleteStageCommand,
  GetApiCommand,
  GetApisCommand,
  GetAuthorizerCommand,
  GetAuthorizersCommand,
  GetDeploymentCommand,
  GetDeploymentsCommand,
  GetIntegrationCommand,
  GetIntegrationsCommand,
  GetRouteCommand,
  GetRoutesCommand,
  GetStageCommand,
  GetStagesCommand,
  GetTagsCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateApiCommand,
  UpdateIntegrationCommand,
  UpdateRouteCommand,
  UpdateStageCommand,
} from "@aws-sdk/client-apigatewayv2";
import {
  APIGatewayClient,
  CreateRestApiCommand,
  DeleteRestApiCommand,
  GetRestApisCommand,
} from "@aws-sdk/client-api-gateway";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const v2 = () =>
  new ApiGatewayV2Client({ endpoint, region, credentials, requestHandler });

const v1 = () =>
  new APIGatewayClient({ endpoint, region, credentials, requestHandler });

test("API Gateway v2: Api → Route → Integration → Stage → Deployment lifecycle", async () => {
  const client = v2();

  const created = await client.send(
    new CreateApiCommand({
      Name: "bunsai-e2e-v2-api",
      ProtocolType: "HTTP",
      Description: "bunsai e2e v2",
    }),
  );
  expect(created.ApiId).toBeDefined();
  expect(created.Name).toBe("bunsai-e2e-v2-api");
  expect(created.ProtocolType).toBe("HTTP");
  const apiId = created.ApiId as string;

  const got = await client.send(new GetApiCommand({ ApiId: apiId }));
  expect(got.ApiId).toBe(apiId);
  expect(got.Name).toBe("bunsai-e2e-v2-api");

  const listed = await client.send(new GetApisCommand({}));
  const ids = (listed.Items ?? []).map((a) => a.ApiId);
  expect(ids).toContain(apiId);

  const updated = await client.send(
    new UpdateApiCommand({ ApiId: apiId, Description: "updated" }),
  );
  expect(updated.Description).toBe("updated");

  const route = await client.send(
    new CreateRouteCommand({ ApiId: apiId, RouteKey: "GET /items" }),
  );
  expect(route.RouteId).toBeDefined();
  expect(route.RouteKey).toBe("GET /items");
  const routeId = route.RouteId as string;

  const gotRoute = await client.send(
    new GetRouteCommand({ ApiId: apiId, RouteId: routeId }),
  );
  expect(gotRoute.RouteId).toBe(routeId);

  const routeList = await client.send(new GetRoutesCommand({ ApiId: apiId }));
  const routeIds = (routeList.Items ?? []).map((r) => r.RouteId);
  expect(routeIds).toContain(routeId);

  const updatedRoute = await client.send(
    new UpdateRouteCommand({
      ApiId: apiId,
      RouteId: routeId,
      RouteKey: "GET /items",
      AuthorizationType: "NONE",
    }),
  );
  expect(updatedRoute.AuthorizationType).toBe("NONE");

  const integration = await client.send(
    new CreateIntegrationCommand({
      ApiId: apiId,
      IntegrationType: "AWS_PROXY",
      IntegrationUri:
        "arn:aws:lambda:us-east-1:123456789012:function:my-function",
      PayloadFormatVersion: "2.0",
    }),
  );
  expect(integration.IntegrationId).toBeDefined();
  expect(integration.IntegrationType).toBe("AWS_PROXY");
  const integrationId = integration.IntegrationId as string;

  const gotIntegration = await client.send(
    new GetIntegrationCommand({ ApiId: apiId, IntegrationId: integrationId }),
  );
  expect(gotIntegration.IntegrationId).toBe(integrationId);
  expect(gotIntegration.PayloadFormatVersion).toBe("2.0");

  const integrationList = await client.send(
    new GetIntegrationsCommand({ ApiId: apiId }),
  );
  const integrationIds = (integrationList.Items ?? []).map(
    (i) => i.IntegrationId,
  );
  expect(integrationIds).toContain(integrationId);

  const updatedIntegration = await client.send(
    new UpdateIntegrationCommand({
      ApiId: apiId,
      IntegrationId: integrationId,
      Description: "lambda proxy",
    }),
  );
  expect(updatedIntegration.Description).toBe("lambda proxy");

  const stage = await client.send(
    new CreateStageCommand({
      ApiId: apiId,
      StageName: "prod",
      AutoDeploy: true,
    }),
  );
  expect(stage.StageName).toBe("prod");
  expect(stage.AutoDeploy).toBe(true);

  const gotStage = await client.send(
    new GetStageCommand({ ApiId: apiId, StageName: "prod" }),
  );
  expect(gotStage.StageName).toBe("prod");

  const stageList = await client.send(new GetStagesCommand({ ApiId: apiId }));
  const stageNames = (stageList.Items ?? []).map((s) => s.StageName);
  expect(stageNames).toContain("prod");

  const updatedStage = await client.send(
    new UpdateStageCommand({
      ApiId: apiId,
      StageName: "prod",
      Description: "production",
    }),
  );
  expect(updatedStage.Description).toBe("production");

  const deployment = await client.send(
    new CreateDeploymentCommand({
      ApiId: apiId,
      StageName: "prod",
      Description: "initial deploy",
    }),
  );
  expect(deployment.DeploymentId).toBeDefined();
  expect(deployment.DeploymentStatus).toBe("DEPLOYED");
  const deploymentId = deployment.DeploymentId as string;

  const gotDeployment = await client.send(
    new GetDeploymentCommand({ ApiId: apiId, DeploymentId: deploymentId }),
  );
  expect(gotDeployment.DeploymentId).toBe(deploymentId);

  const deploymentList = await client.send(
    new GetDeploymentsCommand({ ApiId: apiId }),
  );
  const deploymentIds = (deploymentList.Items ?? []).map((d) => d.DeploymentId);
  expect(deploymentIds).toContain(deploymentId);

  await client.send(new DeleteRouteCommand({ ApiId: apiId, RouteId: routeId }));
  const routeList2 = await client.send(new GetRoutesCommand({ ApiId: apiId }));
  expect((routeList2.Items ?? []).map((r) => r.RouteId)).not.toContain(routeId);

  await client.send(
    new DeleteIntegrationCommand({
      ApiId: apiId,
      IntegrationId: integrationId,
    }),
  );
  const integrationList2 = await client.send(
    new GetIntegrationsCommand({ ApiId: apiId }),
  );
  expect(
    (integrationList2.Items ?? []).map((i) => i.IntegrationId),
  ).not.toContain(integrationId);

  await client.send(
    new DeleteDeploymentCommand({ ApiId: apiId, DeploymentId: deploymentId }),
  );
  await client.send(
    new DeleteStageCommand({ ApiId: apiId, StageName: "prod" }),
  );
  await client.send(new DeleteApiCommand({ ApiId: apiId }));

  const listed2 = await client.send(new GetApisCommand({}));
  const ids2 = (listed2.Items ?? []).map((a) => a.ApiId);
  expect(ids2).not.toContain(apiId);
});

test("API Gateway v2: Authorizer CRUD", async () => {
  const client = v2();

  const api = await client.send(
    new CreateApiCommand({ Name: "auth-test-api", ProtocolType: "HTTP" }),
  );
  const apiId = api.ApiId as string;

  const authorizer = await client.send(
    new CreateAuthorizerCommand({
      ApiId: apiId,
      AuthorizerType: "JWT",
      Name: "my-jwt-authorizer",
      IdentitySource: ["$request.header.Authorization"],
      JwtConfiguration: {
        Audience: ["my-audience"],
        Issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abc",
      },
    }),
  );
  expect(authorizer.AuthorizerId).toBeDefined();
  expect(authorizer.AuthorizerType).toBe("JWT");
  expect(authorizer.Name).toBe("my-jwt-authorizer");
  const authorizerId = authorizer.AuthorizerId as string;

  const got = await client.send(
    new GetAuthorizerCommand({ ApiId: apiId, AuthorizerId: authorizerId }),
  );
  expect(got.AuthorizerId).toBe(authorizerId);
  expect(got.JwtConfiguration?.Audience).toEqual(["my-audience"]);

  const list = await client.send(new GetAuthorizersCommand({ ApiId: apiId }));
  const authorizerIds = (list.Items ?? []).map((a) => a.AuthorizerId);
  expect(authorizerIds).toContain(authorizerId);

  await client.send(
    new DeleteAuthorizerCommand({ ApiId: apiId, AuthorizerId: authorizerId }),
  );
  const list2 = await client.send(new GetAuthorizersCommand({ ApiId: apiId }));
  expect((list2.Items ?? []).map((a) => a.AuthorizerId)).not.toContain(
    authorizerId,
  );

  await client.send(new DeleteApiCommand({ ApiId: apiId }));
});

test("API Gateway v2: tags round-trip", async () => {
  const client = v2();

  const api = await client.send(
    new CreateApiCommand({
      Name: "tags-test-api",
      ProtocolType: "HTTP",
      Tags: { env: "test", project: "bunsai" },
    }),
  );
  const apiId = api.ApiId as string;
  const arn = `arn:aws:apigateway:${region}::/apis/${apiId}`;

  const tagsResult = await client.send(
    new GetTagsCommand({ ResourceArn: arn }),
  );
  expect(tagsResult.Tags?.["env"]).toBe("test");
  expect(tagsResult.Tags?.["project"]).toBe("bunsai");

  await client.send(
    new TagResourceCommand({ ResourceArn: arn, Tags: { version: "1" } }),
  );
  const tagsResult2 = await client.send(
    new GetTagsCommand({ ResourceArn: arn }),
  );
  expect(tagsResult2.Tags?.["version"]).toBe("1");

  await client.send(
    new UntagResourceCommand({ ResourceArn: arn, TagKeys: ["env"] }),
  );
  const tagsResult3 = await client.send(
    new GetTagsCommand({ ResourceArn: arn }),
  );
  expect(tagsResult3.Tags?.["env"]).toBeUndefined();
  expect(tagsResult3.Tags?.["project"]).toBe("bunsai");

  await client.send(new DeleteApiCommand({ ApiId: apiId }));
});

test("API Gateway v1 and v2 coexist on the same endpoint", async () => {
  const v2client = v2();
  const v1client = v1();

  const v2api = await v2client.send(
    new CreateApiCommand({ Name: "coexist-v2", ProtocolType: "HTTP" }),
  );
  const v2ApiId = v2api.ApiId as string;

  const v1api = await v1client.send(
    new CreateRestApiCommand({ name: "coexist-v1" }),
  );
  const v1ApiId = v1api.id as string;

  const v2List = await v2client.send(new GetApisCommand({}));
  const v2Ids = (v2List.Items ?? []).map((a) => a.ApiId);
  expect(v2Ids).toContain(v2ApiId);

  expect(v1api.id).toBeDefined();
  const v1List = await v1client.send(new GetRestApisCommand({}));
  const v1Ids = (v1List.items ?? []).map((a) => a.id);
  expect(v1Ids).toContain(v1ApiId);

  expect(v2Ids).not.toContain(v1ApiId);
  expect(v1Ids).not.toContain(v2ApiId);

  await v2client.send(new DeleteApiCommand({ ApiId: v2ApiId }));
  await v1client.send(new DeleteRestApiCommand({ restApiId: v1ApiId }));
});
