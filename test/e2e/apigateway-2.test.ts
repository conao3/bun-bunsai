import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
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

const awsPort = 4793;
const uiPort = 5793;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const apigateway = () =>
  new APIGatewayClient({ endpoint, region, credentials });

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
