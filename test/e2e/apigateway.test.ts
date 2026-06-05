import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  APIGatewayClient,
  CreateDeploymentCommand,
  CreateResourceCommand,
  CreateRestApiCommand,
  DeleteRestApiCommand,
  GetResourcesCommand,
  GetRestApiCommand,
  GetRestApisCommand,
} from "@aws-sdk/client-api-gateway";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const apigateway = () =>
  new APIGatewayClient({ endpoint, region, credentials });

test("API Gateway rest api, resource and deployment lifecycle", async () => {
  const client = apigateway();
  const apiName = "bunsai-e2e-api";

  const created = await client.send(
    new CreateRestApiCommand({
      name: apiName,
      description: "bunsai e2e",
    }),
  );
  expect(created.id).toBeDefined();
  expect(created.name).toBe(apiName);
  expect(created.rootResourceId).toBeDefined();
  const restApiId = created.id as string;
  const rootResourceId = created.rootResourceId as string;

  const got = await client.send(new GetRestApiCommand({ restApiId }));
  expect(got.id).toBe(restApiId);
  expect(got.name).toBe(apiName);

  const listed = await client.send(new GetRestApisCommand({}));
  const ids = (listed.items ?? []).map((api) => api.id);
  expect(ids).toContain(restApiId);

  const resource = await client.send(
    new CreateResourceCommand({
      restApiId,
      parentId: rootResourceId,
      pathPart: "pets",
    }),
  );
  expect(resource.id).toBeDefined();
  expect(resource.parentId).toBe(rootResourceId);
  expect(resource.pathPart).toBe("pets");
  expect(resource.path).toBe("/pets");

  const resources = await client.send(new GetResourcesCommand({ restApiId }));
  const paths = (resources.items ?? []).map((item) => item.path);
  expect(paths).toContain("/");
  expect(paths).toContain("/pets");

  const deployment = await client.send(
    new CreateDeploymentCommand({
      restApiId,
      description: "first deploy",
    }),
  );
  expect(deployment.id).toBeDefined();
  expect(deployment.description).toBe("first deploy");

  const deleted = await client.send(new DeleteRestApiCommand({ restApiId }));
  expect(deleted.$metadata.httpStatusCode).toBe(202);

  await expect(
    client.send(new GetRestApiCommand({ restApiId })),
  ).rejects.toThrow();
});
