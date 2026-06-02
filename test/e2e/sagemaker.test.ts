import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateEndpointCommand,
  CreateEndpointConfigCommand,
  CreateModelCommand,
  DeleteModelCommand,
  DescribeEndpointCommand,
  DescribeModelCommand,
  ListEndpointsCommand,
  ListModelsCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4566;
const uiPort = 5666;
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

const sagemaker = () =>
  new SageMakerClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("SageMaker model and endpoint lifecycle", async () => {
  const client = sagemaker();
  const modelName = "bunsai-e2e-model";
  const configName = "bunsai-e2e-config";
  const endpointName = "bunsai-e2e-endpoint";

  const createdModel = await client.send(
    new CreateModelCommand({
      ModelName: modelName,
      ExecutionRoleArn: "arn:aws:iam::000000000000:role/bunsai",
      PrimaryContainer: {
        Image: "000000000000.dkr.ecr.us-east-1.amazonaws.com/bunsai:latest",
      },
    }),
  );
  expect(createdModel.ModelArn).toContain(`model/${modelName}`);

  const describedModel = await client.send(
    new DescribeModelCommand({ ModelName: modelName }),
  );
  expect(describedModel.ModelName).toBe(modelName);
  expect(describedModel.ModelArn).toBe(createdModel.ModelArn);
  expect(describedModel.PrimaryContainer?.Image).toBeDefined();

  const listedModels = await client.send(new ListModelsCommand({}));
  expect((listedModels.Models ?? []).map((m) => m.ModelName)).toContain(
    modelName,
  );

  const createdConfig = await client.send(
    new CreateEndpointConfigCommand({
      EndpointConfigName: configName,
      ProductionVariants: [
        {
          VariantName: "AllTraffic",
          ModelName: modelName,
          InstanceType: "ml.m5.large",
          InitialInstanceCount: 1,
        },
      ],
    }),
  );
  expect(createdConfig.EndpointConfigArn).toContain(
    `endpoint-config/${configName}`,
  );

  const createdEndpoint = await client.send(
    new CreateEndpointCommand({
      EndpointName: endpointName,
      EndpointConfigName: configName,
    }),
  );
  expect(createdEndpoint.EndpointArn).toContain(`endpoint/${endpointName}`);

  const describedEndpoint = await client.send(
    new DescribeEndpointCommand({ EndpointName: endpointName }),
  );
  expect(describedEndpoint.EndpointName).toBe(endpointName);
  expect(describedEndpoint.EndpointStatus).toBe("InService");
  expect(describedEndpoint.EndpointConfigName).toBe(configName);

  const listedEndpoints = await client.send(new ListEndpointsCommand({}));
  expect(
    (listedEndpoints.Endpoints ?? []).map((e) => e.EndpointName),
  ).toContain(endpointName);

  await client.send(new DeleteModelCommand({ ModelName: modelName }));
  const afterDelete = await client.send(new ListModelsCommand({}));
  expect((afterDelete.Models ?? []).map((m) => m.ModelName)).not.toContain(
    modelName,
  );
});
