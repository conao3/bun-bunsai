import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDomainCommand,
  CreateEndpointCommand,
  CreateEndpointConfigCommand,
  CreateExperimentCommand,
  CreateHubCommand,
  CreateImageCommand,
  CreateImageVersionCommand,
  CreateModelCommand,
  DescribeDomainCommand,
  DescribeEndpointCommand,
  DescribeExperimentCommand,
  DescribeHubCommand,
  DescribeImageCommand,
  SageMakerClient,
  UpdateDomainCommand,
  UpdateEndpointCommand,
  UpdateEndpointWeightsAndCapacitiesCommand,
  UpdateExperimentCommand,
  UpdateHubCommand,
  UpdateImageCommand,
  UpdateImageVersionCommand,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("UpdateDomain → DescribeDomain reflects update", async () => {
  const client = sagemaker();
  const domainName = `dom-chunk28-${Date.now()}`;

  const created = await client.send(
    new CreateDomainCommand({
      DomainName: domainName,
      AuthMode: "IAM",
      DefaultUserSettings: {
        ExecutionRole: "arn:aws:iam::123456789012:role/original",
      },
    }),
  );
  const domainId = created.DomainId!;
  expect(domainId).toContain("d-");

  const updated = await client.send(
    new UpdateDomainCommand({
      DomainId: domainId,
      DefaultUserSettings: {
        ExecutionRole: "arn:aws:iam::123456789012:role/updated",
      },
    }),
  );
  expect(updated.DomainArn).toContain("domain");

  const described = await client.send(
    new DescribeDomainCommand({ DomainId: domainId }),
  );
  expect(described.DomainId).toBe(domainId);
  const settings = described.DefaultUserSettings as
    | { ExecutionRole?: string }
    | undefined;
  expect(settings?.ExecutionRole).toBe(
    "arn:aws:iam::123456789012:role/updated",
  );
});

test("UpdateDomain → ResourceNotFound for missing domain", async () => {
  const client = sagemaker();
  await expect(
    client.send(new UpdateDomainCommand({ DomainId: "d-notexist99" })),
  ).rejects.toMatchObject({ name: "ResourceNotFound" });
});

test("UpdateExperiment → DescribeExperiment reflects update", async () => {
  const client = sagemaker();
  const name = `exp-chunk28-${Date.now()}`;

  const created = await client.send(
    new CreateExperimentCommand({
      ExperimentName: name,
      DisplayName: "Original Name",
      Description: "original description",
    }),
  );
  expect(created.ExperimentArn).toContain("experiment");

  const updated = await client.send(
    new UpdateExperimentCommand({
      ExperimentName: name,
      DisplayName: "Updated Name",
      Description: "updated description",
    }),
  );
  expect(updated.ExperimentArn).toContain("experiment");

  const described = await client.send(
    new DescribeExperimentCommand({ ExperimentName: name }),
  );
  expect(described.ExperimentName).toBe(name);
  expect(described.DisplayName).toBe("Updated Name");
  expect(described.Description).toBe("updated description");
});

test("UpdateExperiment → ResourceNotFound for missing experiment", async () => {
  const client = sagemaker();
  await expect(
    client.send(
      new UpdateExperimentCommand({ ExperimentName: "no-such-exp-chunk28" }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFound" });
});

test("UpdateEndpoint → DescribeEndpoint reflects config change", async () => {
  const client = sagemaker();
  const suffix = Date.now();
  const modelName = `model-chunk28-${suffix}`;
  const config1Name = `cfg1-chunk28-${suffix}`;
  const config2Name = `cfg2-chunk28-${suffix}`;
  const epName = `ep-chunk28-${suffix}`;

  await client.send(
    new CreateModelCommand({
      ModelName: modelName,
      PrimaryContainer: {
        Image: "123456789012.dkr.ecr.us-east-1.amazonaws.com/test:latest",
      },
      ExecutionRoleArn: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  await client.send(
    new CreateEndpointConfigCommand({
      EndpointConfigName: config1Name,
      ProductionVariants: [
        {
          VariantName: "AllTraffic",
          ModelName: modelName,
          InitialInstanceCount: 1,
          InstanceType: "ml.m5.xlarge",
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
          ModelName: modelName,
          InitialInstanceCount: 2,
          InstanceType: "ml.m5.xlarge",
        },
      ],
    }),
  );

  await client.send(
    new CreateEndpointCommand({
      EndpointName: epName,
      EndpointConfigName: config1Name,
    }),
  );

  const updated = await client.send(
    new UpdateEndpointCommand({
      EndpointName: epName,
      EndpointConfigName: config2Name,
    }),
  );
  expect(updated.EndpointArn).toContain("endpoint");

  const described = await client.send(
    new DescribeEndpointCommand({ EndpointName: epName }),
  );
  expect(described.EndpointConfigName).toBe(config2Name);
});

test("UpdateEndpointWeightsAndCapacities → DescribeEndpoint reflects weight change", async () => {
  const client = sagemaker();
  const suffix = `wc-${Date.now()}`;
  const modelName = `model-${suffix}`;
  const cfgName = `cfg-${suffix}`;
  const epName = `ep-${suffix}`;

  await client.send(
    new CreateModelCommand({
      ModelName: modelName,
      PrimaryContainer: {
        Image: "123456789012.dkr.ecr.us-east-1.amazonaws.com/test:latest",
      },
      ExecutionRoleArn: "arn:aws:iam::123456789012:role/test-role",
    }),
  );
  await client.send(
    new CreateEndpointConfigCommand({
      EndpointConfigName: cfgName,
      ProductionVariants: [
        {
          VariantName: "VarA",
          ModelName: modelName,
          InitialInstanceCount: 1,
          InstanceType: "ml.m5.xlarge",
          InitialVariantWeight: 1.0,
        },
      ],
    }),
  );
  await client.send(
    new CreateEndpointCommand({
      EndpointName: epName,
      EndpointConfigName: cfgName,
    }),
  );

  const updated = await client.send(
    new UpdateEndpointWeightsAndCapacitiesCommand({
      EndpointName: epName,
      DesiredWeightsAndCapacities: [
        { VariantName: "VarA", DesiredWeight: 0.5, DesiredInstanceCount: 2 },
      ],
    }),
  );
  expect(updated.EndpointArn).toContain("endpoint");
});

test("UpdateHub → DescribeHub reflects update", async () => {
  const client = sagemaker();
  const name = `hub-chunk28-${Date.now()}`;

  await client.send(
    new CreateHubCommand({
      HubName: name,
      HubDescription: "original description",
      HubDisplayName: "Original Hub",
    }),
  );

  const updated = await client.send(
    new UpdateHubCommand({
      HubName: name,
      HubDescription: "updated description",
      HubDisplayName: "Updated Hub",
    }),
  );
  expect(updated.HubArn).toContain("hub");

  const described = await client.send(
    new DescribeHubCommand({ HubName: name }),
  );
  expect(described.HubDescription).toBe("updated description");
  expect(described.HubDisplayName).toBe("Updated Hub");
});

test("UpdateImage → DescribeImage reflects update", async () => {
  const client = sagemaker();
  const name = `img-chunk28-${Date.now()}`;

  await client.send(
    new CreateImageCommand({
      ImageName: name,
      RoleArn: "arn:aws:iam::123456789012:role/original-role",
      Description: "original description",
      DisplayName: "Original Image",
    }),
  );

  const updated = await client.send(
    new UpdateImageCommand({
      ImageName: name,
      Description: "updated description",
      DisplayName: "Updated Image",
      RoleArn: "arn:aws:iam::123456789012:role/updated-role",
    }),
  );
  expect(updated.ImageArn).toContain("image");

  const described = await client.send(
    new DescribeImageCommand({ ImageName: name }),
  );
  expect(described.Description).toBe("updated description");
  expect(described.DisplayName).toBe("Updated Image");
});

test("UpdateImageVersion → returns ImageVersionArn", async () => {
  const client = sagemaker();
  const name = `imgver-chunk28-${Date.now()}`;

  await client.send(
    new CreateImageCommand({
      ImageName: name,
      RoleArn: "arn:aws:iam::123456789012:role/test-role",
    }),
  );
  const ver = await client.send(
    new CreateImageVersionCommand({
      ImageName: name,
      BaseImage: "123456789012.dkr.ecr.us-east-1.amazonaws.com/base:latest",
    }),
  );
  expect(ver.ImageVersionArn).toContain("image");

  const updated = await client.send(
    new UpdateImageVersionCommand({ ImageName: name, Version: 1 }),
  );
  expect(updated.ImageVersionArn).toContain("image");
});
