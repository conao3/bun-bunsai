import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
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

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

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
