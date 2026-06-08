import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateCodeRepositoryCommand,
  CreateContextCommand,
  CreateProcessingJobCommand,
  CreateTransformJobCommand,
  DescribeCodeRepositoryCommand,
  DescribeContextCommand,
  DescribeProcessingJobCommand,
  DescribeTransformJobCommand,
  SageMakerClient,
  StopProcessingJobCommand,
  StopTransformJobCommand,
  UpdateCodeRepositoryCommand,
  UpdateContextCommand,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("StopProcessingJob → DescribeProcessingJob Status=Stopping", async () => {
  const client = sagemaker();
  const name = `proc-chunk27-${Date.now()}`;

  const created = await client.send(
    new CreateProcessingJobCommand({
      ProcessingJobName: name,
      AppSpecification: {
        ImageUri: "123456789012.dkr.ecr.us-east-1.amazonaws.com/test:latest",
      },
      ProcessingResources: {
        ClusterConfig: {
          InstanceCount: 1,
          InstanceType: "ml.m5.xlarge",
          VolumeSizeInGB: 10,
        },
      },
      RoleArn: "arn:aws:iam::123456789012:role/test-role",
    }),
  );
  expect(created.ProcessingJobArn).toContain("processing-job");

  const before = await client.send(
    new DescribeProcessingJobCommand({ ProcessingJobName: name }),
  );
  expect(before.ProcessingJobStatus).toBe("InProgress");

  await client.send(new StopProcessingJobCommand({ ProcessingJobName: name }));

  const after = await client.send(
    new DescribeProcessingJobCommand({ ProcessingJobName: name }),
  );
  expect(after.ProcessingJobName).toBe(name);
  expect(after.ProcessingJobStatus).toBe("Stopping");
});

test("StopProcessingJob → ResourceNotFound for missing job", async () => {
  const client = sagemaker();
  await expect(
    client.send(
      new StopProcessingJobCommand({
        ProcessingJobName: "no-such-proc-chunk27",
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFound" });
});

test("StopTransformJob → DescribeTransformJob Status=Stopping", async () => {
  const client = sagemaker();
  const name = `transform-chunk27-${Date.now()}`;

  const created = await client.send(
    new CreateTransformJobCommand({
      TransformJobName: name,
      ModelName: "test-model",
      TransformInput: {
        DataSource: {
          S3DataSource: {
            S3DataType: "S3Prefix",
            S3Uri: "s3://test-bucket/input",
          },
        },
      },
      TransformOutput: {
        S3OutputPath: "s3://test-bucket/output",
      },
      TransformResources: {
        InstanceCount: 1,
        InstanceType: "ml.m5.xlarge",
      },
    }),
  );
  expect(created.TransformJobArn).toContain("transform-job");

  const before = await client.send(
    new DescribeTransformJobCommand({ TransformJobName: name }),
  );
  expect(before.TransformJobStatus).toBe("InProgress");

  await client.send(new StopTransformJobCommand({ TransformJobName: name }));

  const after = await client.send(
    new DescribeTransformJobCommand({ TransformJobName: name }),
  );
  expect(after.TransformJobName).toBe(name);
  expect(after.TransformJobStatus).toBe("Stopping");
});

test("UpdateCodeRepository → DescribeCodeRepository reflects update", async () => {
  const client = sagemaker();
  const name = `coderepo-chunk27-${Date.now()}`;

  const created = await client.send(
    new CreateCodeRepositoryCommand({
      CodeRepositoryName: name,
      GitConfig: {
        RepositoryUrl: "https://github.com/test/original.git",
        Branch: "main",
      },
    }),
  );
  expect(created.CodeRepositoryArn).toContain("code-repository");

  const updated = await client.send(
    new UpdateCodeRepositoryCommand({
      CodeRepositoryName: name,
      GitConfig: {
        SecretArn:
          "arn:aws:secretsmanager:us-east-1:123456789012:secret/test-secret",
      },
    }),
  );
  expect(updated.CodeRepositoryArn).toContain("code-repository");

  const described = await client.send(
    new DescribeCodeRepositoryCommand({ CodeRepositoryName: name }),
  );
  expect(described.CodeRepositoryName).toBe(name);
  expect(described.GitConfig?.SecretArn).toBe(
    "arn:aws:secretsmanager:us-east-1:123456789012:secret/test-secret",
  );
});

test("UpdateContext → DescribeContext reflects update", async () => {
  const client = sagemaker();
  const name = `ctx-chunk27-${Date.now()}`;

  const created = await client.send(
    new CreateContextCommand({
      ContextName: name,
      ContextType: "TestContextType",
      Source: {
        SourceUri: "arn:aws:sagemaker:us-east-1:123456789012:experiment/test",
        SourceType: "ARN",
      },
      Description: "original description",
    }),
  );
  expect(created.ContextArn).toContain("context");

  const updated = await client.send(
    new UpdateContextCommand({
      ContextName: name,
      Description: "updated description",
      Properties: { key1: "value1" },
    }),
  );
  expect(updated.ContextArn).toContain("context");

  const described = await client.send(
    new DescribeContextCommand({ ContextName: name }),
  );
  expect(described.ContextName).toBe(name);
  expect(described.Description).toBe("updated description");
  expect(described.Properties?.key1).toBe("value1");
});
