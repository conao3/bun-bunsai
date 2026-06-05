import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  APIGatewayClient,
  CreateDeploymentCommand,
  CreateModelCommand,
  CreateRestApiCommand,
  CreateStageCommand,
  DeleteModelCommand,
  GetModelCommand,
  GetModelsCommand,
  GetStageCommand,
  GetStagesCommand,
} from "@aws-sdk/client-api-gateway";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const apigateway = () =>
  new APIGatewayClient({ endpoint, region, credentials, requestHandler });

test("API Gateway model and stage lifecycle", async () => {
  const client = apigateway();

  const api = await client.send(
    new CreateRestApiCommand({ name: "bunsai-e2e-api-2" }),
  );
  const restApiId = api.id as string;
  expect(restApiId).toBeDefined();

  const model = await client.send(
    new CreateModelCommand({
      restApiId,
      name: "PetModel",
      contentType: "application/json",
      description: "pet model",
      schema: '{"type":"object"}',
    }),
  );
  expect(model.id).toBeDefined();
  expect(model.name).toBe("PetModel");
  expect(model.contentType).toBe("application/json");

  const gotModel = await client.send(
    new GetModelCommand({ restApiId, modelName: "PetModel" }),
  );
  expect(gotModel.name).toBe("PetModel");
  expect(gotModel.schema).toBe('{"type":"object"}');

  const models = await client.send(new GetModelsCommand({ restApiId }));
  const modelNames = (models.items ?? []).map((m) => m.name);
  expect(modelNames).toContain("PetModel");

  const deployment = await client.send(
    new CreateDeploymentCommand({ restApiId }),
  );
  const deploymentId = deployment.id as string;
  expect(deploymentId).toBeDefined();

  const stage = await client.send(
    new CreateStageCommand({
      restApiId,
      stageName: "prod",
      deploymentId,
      description: "production stage",
      variables: { logLevel: "info" },
      tracingEnabled: true,
    }),
  );
  expect(stage.stageName).toBe("prod");
  expect(stage.description).toBe("production stage");
  expect(stage.variables?.logLevel).toBe("info");
  expect(stage.tracingEnabled).toBe(true);

  const gotStage = await client.send(
    new GetStageCommand({ restApiId, stageName: "prod" }),
  );
  expect(gotStage.stageName).toBe("prod");
  expect(gotStage.description).toBe("production stage");

  const stages = await client.send(new GetStagesCommand({ restApiId }));
  const stageNames = (stages.item ?? []).map((s) => s.stageName);
  expect(stageNames).toContain("prod");

  const deleted = await client.send(
    new DeleteModelCommand({ restApiId, modelName: "PetModel" }),
  );
  expect(deleted.$metadata.httpStatusCode).toBe(202);

  await expect(
    client.send(new GetModelCommand({ restApiId, modelName: "PetModel" })),
  ).rejects.toThrow();
});
