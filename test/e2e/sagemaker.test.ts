import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddTagsCommand,
  CreateEndpointCommand,
  CreateEndpointConfigCommand,
  CreateModelCommand,
  CreatePipelineCommand,
  DeleteEndpointCommand,
  DeleteEndpointConfigCommand,
  DeleteModelCommand,
  DescribeEndpointCommand,
  DescribeEndpointConfigCommand,
  DescribeModelCommand,
  ListEndpointConfigsCommand,
  ListEndpointsCommand,
  ListModelsCommand,
  ListTagsCommand,
  SageMakerClient,
  UpdateEndpointCommand,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("SageMaker model and endpoint lifecycle", async () => {
  const client = sagemaker();
  const modelName = "bunsai-e2e-model";
  const configName = "bunsai-e2e-config";
  const config2Name = "bunsai-e2e-config2";
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
  expect(describedModel.ExecutionRoleArn).toBe(
    "arn:aws:iam::000000000000:role/bunsai",
  );
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

  const describedConfig = await client.send(
    new DescribeEndpointConfigCommand({ EndpointConfigName: configName }),
  );
  expect(describedConfig.EndpointConfigName).toBe(configName);
  expect(describedConfig.ProductionVariants?.[0]?.ModelName).toBe(modelName);

  const listedConfigs = await client.send(new ListEndpointConfigsCommand({}));
  expect(
    (listedConfigs.EndpointConfigs ?? []).map((c) => c.EndpointConfigName),
  ).toContain(configName);

  const createdEndpoint = await client.send(
    new CreateEndpointCommand({
      EndpointName: endpointName,
      EndpointConfigName: configName,
    }),
  );
  expect(createdEndpoint.EndpointArn).toContain(`endpoint/${endpointName}`);

  const describedCreating = await client.send(
    new DescribeEndpointCommand({ EndpointName: endpointName }),
  );
  expect(describedCreating.EndpointStatus).toBe("Creating");

  await Bun.sleep(2500);

  const describedInService = await client.send(
    new DescribeEndpointCommand({ EndpointName: endpointName }),
  );
  expect(describedInService.EndpointName).toBe(endpointName);
  expect(describedInService.EndpointStatus).toBe("InService");
  expect(describedInService.EndpointConfigName).toBe(configName);

  const listedEndpoints = await client.send(new ListEndpointsCommand({}));
  expect(
    (listedEndpoints.Endpoints ?? []).map((e) => e.EndpointName),
  ).toContain(endpointName);

  await client.send(
    new CreateEndpointConfigCommand({
      EndpointConfigName: config2Name,
      ProductionVariants: [
        {
          VariantName: "AllTraffic",
          ModelName: modelName,
          InstanceType: "ml.m5.xlarge",
          InitialInstanceCount: 2,
        },
      ],
    }),
  );

  const updated = await client.send(
    new UpdateEndpointCommand({
      EndpointName: endpointName,
      EndpointConfigName: config2Name,
    }),
  );
  expect(updated.EndpointArn).toContain(`endpoint/${endpointName}`);

  const describedUpdated = await client.send(
    new DescribeEndpointCommand({ EndpointName: endpointName }),
  );
  expect(describedUpdated.EndpointConfigName).toBe(config2Name);

  await client.send(new DeleteEndpointCommand({ EndpointName: endpointName }));
  const afterEndpointDelete = await client.send(new ListEndpointsCommand({}));
  expect(
    (afterEndpointDelete.Endpoints ?? []).map((e) => e.EndpointName),
  ).not.toContain(endpointName);

  await client.send(
    new DeleteEndpointConfigCommand({ EndpointConfigName: configName }),
  );
  await client.send(
    new DeleteEndpointConfigCommand({ EndpointConfigName: config2Name }),
  );

  await client.send(new DeleteModelCommand({ ModelName: modelName }));
  const afterModelDelete = await client.send(new ListModelsCommand({}));
  expect((afterModelDelete.Models ?? []).map((m) => m.ModelName)).not.toContain(
    modelName,
  );
});

test("SageMaker ValidationException for missing resources", async () => {
  const client = sagemaker();

  await expect(
    client.send(new DescribeModelCommand({ ModelName: "nonexistent-model" })),
  ).rejects.toThrow();

  await expect(
    client.send(
      new DescribeEndpointConfigCommand({
        EndpointConfigName: "nonexistent-config",
      }),
    ),
  ).rejects.toThrow();

  await expect(
    client.send(
      new DescribeEndpointCommand({ EndpointName: "nonexistent-endpoint" }),
    ),
  ).rejects.toThrow();

  await expect(
    client.send(
      new CreateEndpointCommand({
        EndpointName: "test-ep",
        EndpointConfigName: "nonexistent-config",
      }),
    ),
  ).rejects.toThrow();
});

test("SageMaker idempotency — CreatePipeline with ClientRequestToken", async () => {
  const client = sagemaker();
  const token = "idempotency-test-token-pipeline";

  const first = await client.send(
    new CreatePipelineCommand({
      PipelineName: "idempotency-pipeline",
      RoleArn: "arn:aws:iam::000000000000:role/bunsai",
      ClientRequestToken: token,
    }),
  );
  expect(first.PipelineArn).toBeDefined();

  const second = await client.send(
    new CreatePipelineCommand({
      PipelineName: "idempotency-pipeline",
      RoleArn: "arn:aws:iam::000000000000:role/bunsai",
      ClientRequestToken: token,
    }),
  );
  expect(second.PipelineArn).toBe(first.PipelineArn);
});

test("SageMaker tag round-trip — CreateEndpoint with Tags → ListTagsForResource", async () => {
  const client = sagemaker();
  const configName = "tag-rt-config";
  const endpointName = "tag-rt-endpoint";

  await client.send(
    new CreateEndpointConfigCommand({
      EndpointConfigName: configName,
      ProductionVariants: [
        {
          VariantName: "AllTraffic",
          ModelName: "does-not-matter",
          InstanceType: "ml.m5.large",
          InitialInstanceCount: 1,
        },
      ],
    }),
  );

  const created = await client.send(
    new CreateEndpointCommand({
      EndpointName: endpointName,
      EndpointConfigName: configName,
      Tags: [{ Key: "Env", Value: "test" }],
    }),
  );
  const arn = created.EndpointArn!;

  const listed = await client.send(
    new ListTagsCommand({ ResourceArn: arn }),
  );
  expect(listed.Tags).toEqual([{ Key: "Env", Value: "test" }]);

  await client.send(new DeleteEndpointCommand({ EndpointName: endpointName }));
  await client.send(
    new DeleteEndpointConfigCommand({ EndpointConfigName: configName }),
  );
});

test("SageMaker delete cleanup — tags removed after DeleteModel", async () => {
  const client = sagemaker();
  const modelName = "tag-cleanup-model";

  const created = await client.send(
    new CreateModelCommand({
      ModelName: modelName,
      ExecutionRoleArn: "arn:aws:iam::000000000000:role/bunsai",
    }),
  );
  const arn = created.ModelArn!;

  await client.send(
    new AddTagsCommand({
      ResourceArn: arn,
      Tags: [{ Key: "Stage", Value: "cleanup" }],
    }),
  );

  await client.send(new DeleteModelCommand({ ModelName: modelName }));

  await expect(
    client.send(new ListTagsCommand({ ResourceArn: arn })),
  ).resolves.toMatchObject({ Tags: [] });
});

test(
  "SageMaker UpdateEndpoint — Updating status transitions to InService",
  async () => {
  const client = sagemaker();
  const configName = "update-status-config";
  const config2Name = "update-status-config2";
  const endpointName = "update-status-endpoint";

  await client.send(
    new CreateEndpointConfigCommand({
      EndpointConfigName: configName,
      ProductionVariants: [
        {
          VariantName: "AllTraffic",
          ModelName: "dummy",
          InstanceType: "ml.m5.large",
          InitialInstanceCount: 1,
        },
      ],
    }),
  );
  await client.send(
    new CreateEndpointConfigCommand({
      EndpointConfigName: config2Name,
      ProductionVariants: [
        {
          VariantName: "AllTraffic",
          ModelName: "dummy",
          InstanceType: "ml.m5.xlarge",
          InitialInstanceCount: 2,
        },
      ],
    }),
  );

  await client.send(
    new CreateEndpointCommand({
      EndpointName: endpointName,
      EndpointConfigName: configName,
    }),
  );
  await Bun.sleep(2500);

  await client.send(
    new UpdateEndpointCommand({
      EndpointName: endpointName,
      EndpointConfigName: config2Name,
    }),
  );

  const updatingStatus = await client.send(
    new DescribeEndpointCommand({ EndpointName: endpointName }),
  );
  expect(updatingStatus.EndpointStatus).toBe("Updating");

  await Bun.sleep(2500);

  const inServiceStatus = await client.send(
    new DescribeEndpointCommand({ EndpointName: endpointName }),
  );
  expect(inServiceStatus.EndpointStatus).toBe("InService");

  await client.send(new DeleteEndpointCommand({ EndpointName: endpointName }));
  await client.send(
    new DeleteEndpointConfigCommand({ EndpointConfigName: configName }),
  );
  await client.send(
    new DeleteEndpointConfigCommand({ EndpointConfigName: config2Name }),
  );
  },
  15000,
);

test("SageMaker DeleteEndpointConfig — ResourceInUse when endpoint is live", async () => {
  const client = sagemaker();
  const configName = "inuse-config";
  const endpointName = "inuse-endpoint";

  await client.send(
    new CreateEndpointConfigCommand({
      EndpointConfigName: configName,
      ProductionVariants: [
        {
          VariantName: "AllTraffic",
          ModelName: "dummy",
          InstanceType: "ml.m5.large",
          InitialInstanceCount: 1,
        },
      ],
    }),
  );

  await client.send(
    new CreateEndpointCommand({
      EndpointName: endpointName,
      EndpointConfigName: configName,
    }),
  );

  await expect(
    client.send(
      new DeleteEndpointConfigCommand({ EndpointConfigName: configName }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteEndpointCommand({ EndpointName: endpointName }));
  await client.send(
    new DeleteEndpointConfigCommand({ EndpointConfigName: configName }),
  );
});
