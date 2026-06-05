import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateEndpointConfigCommand,
  CreateModelCardCommand,
  CreateModelPackageCommand,
  CreateModelPackageGroupCommand,
  DeleteEndpointConfigCommand,
  DeleteModelCardCommand,
  DeleteModelPackageCommand,
  DeleteModelPackageGroupCommand,
  DescribeEndpointConfigCommand,
  DescribeModelCardCommand,
  DescribeModelPackageCommand,
  DescribeModelPackageGroupCommand,
  ListEndpointConfigsCommand,
  SageMakerClient,
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

test("SageMaker model package group and package lifecycle", async () => {
  const client = sagemaker();
  const groupName = "bunsai-e2e-pkg-group";
  const pkgName = "bunsai-e2e-pkg";

  const createdGroup = await client.send(
    new CreateModelPackageGroupCommand({
      ModelPackageGroupName: groupName,
      ModelPackageGroupDescription: "e2e test group",
    }),
  );
  expect(createdGroup.ModelPackageGroupArn).toContain(
    `model-package-group/${groupName}`,
  );

  const describedGroup = await client.send(
    new DescribeModelPackageGroupCommand({ ModelPackageGroupName: groupName }),
  );
  expect(describedGroup.ModelPackageGroupName).toBe(groupName);
  expect(describedGroup.ModelPackageGroupArn).toBe(
    createdGroup.ModelPackageGroupArn,
  );
  expect(describedGroup.ModelPackageGroupStatus).toBe("Completed");

  const createdPkg = await client.send(
    new CreateModelPackageCommand({
      ModelPackageName: pkgName,
      ModelPackageGroupName: groupName,
      ModelApprovalStatus: "Approved",
    }),
  );
  expect(createdPkg.ModelPackageArn).toContain(`model-package/${pkgName}`);

  const describedPkg = await client.send(
    new DescribeModelPackageCommand({ ModelPackageName: pkgName }),
  );
  expect(describedPkg.ModelPackageName).toBe(pkgName);
  expect(describedPkg.ModelPackageGroupName).toBe(groupName);
  expect(describedPkg.ModelPackageStatus).toBe("Completed");
  expect(describedPkg.ModelApprovalStatus).toBe("Approved");

  await client.send(
    new DeleteModelPackageCommand({ ModelPackageName: pkgName }),
  );
  await client.send(
    new DeleteModelPackageGroupCommand({ ModelPackageGroupName: groupName }),
  );
});

test("SageMaker model card lifecycle", async () => {
  const client = sagemaker();
  const cardName = "bunsai-e2e-model-card";
  const content = JSON.stringify({ model_overview: { model_id: "test" } });

  const created = await client.send(
    new CreateModelCardCommand({
      ModelCardName: cardName,
      Content: content,
      ModelCardStatus: "Draft",
    }),
  );
  expect(created.ModelCardArn).toContain(`model-card/${cardName}`);

  const described = await client.send(
    new DescribeModelCardCommand({ ModelCardName: cardName }),
  );
  expect(described.ModelCardName).toBe(cardName);
  expect(described.ModelCardArn).toBe(created.ModelCardArn);
  expect(described.ModelCardStatus).toBe("Draft");
  expect(described.Content).toBe(content);
  expect(described.ModelCardVersion).toBe(1);

  await client.send(new DeleteModelCardCommand({ ModelCardName: cardName }));
});

test("SageMaker endpoint config describe, list, and delete", async () => {
  const client = sagemaker();
  const configName = "bunsai-e2e-config-chunk1";

  const created = await client.send(
    new CreateEndpointConfigCommand({
      EndpointConfigName: configName,
      ProductionVariants: [
        {
          VariantName: "AllTraffic",
          ModelName: "dummy-model",
          InstanceType: "ml.m5.large",
          InitialInstanceCount: 1,
        },
      ],
    }),
  );
  expect(created.EndpointConfigArn).toContain(`endpoint-config/${configName}`);

  const described = await client.send(
    new DescribeEndpointConfigCommand({ EndpointConfigName: configName }),
  );
  expect(described.EndpointConfigName).toBe(configName);
  expect(described.EndpointConfigArn).toBe(created.EndpointConfigArn);
  expect(described.ProductionVariants).toHaveLength(1);

  const listed = await client.send(new ListEndpointConfigsCommand({}));
  expect(
    (listed.EndpointConfigs ?? []).map((c) => c.EndpointConfigName),
  ).toContain(configName);

  await client.send(
    new DeleteEndpointConfigCommand({ EndpointConfigName: configName }),
  );
  const afterDelete = await client.send(new ListEndpointConfigsCommand({}));
  expect(
    (afterDelete.EndpointConfigs ?? []).map((c) => c.EndpointConfigName),
  ).not.toContain(configName);
});
