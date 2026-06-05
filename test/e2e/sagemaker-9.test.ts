import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateAlgorithmCommand,
  CreateClusterCommand,
  CreateActionCommand,
  CreateArtifactCommand,
  CreateAutoMLJobCommand,
  CreateCodeRepositoryCommand,
  CreateCompilationJobCommand,
  CreateContextCommand,
  CreateDataQualityJobDefinitionCommand,
  DescribeAlgorithmCommand,
  DescribeClusterCommand,
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

test("CreateAlgorithm → DescribeAlgorithm lifecycle", async () => {
  const client = sagemaker();
  const name = "bunsai-e2e-algorithm";

  const created = await client.send(
    new CreateAlgorithmCommand({
      AlgorithmName: name,
      AlgorithmDescription: "e2e test algorithm",
      TrainingSpecification: {
        TrainingImage: "123456789012.dkr.ecr.us-east-1.amazonaws.com/algo:1",
        SupportedTrainingInstanceTypes: ["ml.m5.xlarge"],
        TrainingChannels: [],
      },
    }),
  );

  expect(created.AlgorithmArn).toBeDefined();
  expect(created.AlgorithmArn).toContain("algorithm/bunsai-e2e-algorithm");

  const described = await client.send(
    new DescribeAlgorithmCommand({ AlgorithmName: name }),
  );

  expect(described.AlgorithmName).toBe(name);
  expect(described.AlgorithmArn).toBe(created.AlgorithmArn);
  expect(described.AlgorithmStatus).toBe("Pending");
  expect(described.AlgorithmDescription).toBe("e2e test algorithm");
});

test("CreateCluster → DescribeCluster lifecycle", async () => {
  const client = sagemaker();
  const name = "bunsai-e2e-cluster";

  const created = await client.send(
    new CreateClusterCommand({
      ClusterName: name,
      InstanceGroups: [
        {
          InstanceGroupName: "worker",
          InstanceType: "ml.g5.xlarge",
          InstanceCount: 1,
          LifeCycleConfig: {
            SourceS3Uri: "s3://bunsai-bucket/lcc",
            OnCreate: "on_create.sh",
          },
          ExecutionRole: "arn:aws:iam::123456789012:role/SageMakerClusterRole",
        },
      ],
    }),
  );

  expect(created.ClusterArn).toBeDefined();
  expect(created.ClusterArn).toContain("cluster/bunsai-e2e-cluster");

  const described = await client.send(
    new DescribeClusterCommand({ ClusterName: name }),
  );

  expect(described.ClusterName).toBe(name);
  expect(described.ClusterArn).toBe(created.ClusterArn);
  expect(described.ClusterStatus).toBe("Creating");
});

test("CreateAction returns ActionArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateActionCommand({
      ActionName: "bunsai-e2e-action",
      ActionType: "ModelDeployment",
      Source: { SourceUri: "s3://bunsai/action-source", SourceType: "S3" },
    }),
  );
  expect(result.ActionArn).toContain("action/bunsai-e2e-action");
});

test("CreateArtifact returns ArtifactArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateArtifactCommand({
      ArtifactName: "bunsai-e2e-artifact",
      ArtifactType: "DataSet",
      Source: {
        SourceUri: "s3://bunsai/artifact-source",
        SourceTypes: [],
      },
    }),
  );
  expect(result.ArtifactArn).toContain("artifact/");
});

test("CreateAutoMLJob returns AutoMLJobArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateAutoMLJobCommand({
      AutoMLJobName: "bunsai-e2e-automl",
      InputDataConfig: [
        {
          DataSource: {
            S3DataSource: {
              S3DataType: "S3Prefix",
              S3Uri: "s3://bunsai/automl-input",
            },
          },
          TargetAttributeName: "target",
        },
      ],
      OutputDataConfig: { S3OutputPath: "s3://bunsai/automl-output" },
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
    }),
  );
  expect(result.AutoMLJobArn).toContain("automl-job/bunsai-e2e-automl");
});

test("CreateCodeRepository returns CodeRepositoryArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateCodeRepositoryCommand({
      CodeRepositoryName: "bunsai-e2e-repo",
      GitConfig: {
        RepositoryUrl: "https://github.com/example/repo",
        Branch: "main",
      },
    }),
  );
  expect(result.CodeRepositoryArn).toContain("code-repository/bunsai-e2e-repo");
});

test("CreateCompilationJob returns CompilationJobArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateCompilationJobCommand({
      CompilationJobName: "bunsai-e2e-compilation",
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
      InputConfig: {
        S3Uri: "s3://bunsai/model.tar.gz",
        DataInputConfig: '{"input": [1,3,224,224]}',
        Framework: "PYTORCH",
      },
      OutputConfig: {
        S3OutputLocation: "s3://bunsai/compiled",
        TargetDevice: "lambda",
      },
      StoppingCondition: { MaxRuntimeInSeconds: 900 },
    }),
  );
  expect(result.CompilationJobArn).toContain(
    "compilation-job/bunsai-e2e-compilation",
  );
});

test("CreateContext returns ContextArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateContextCommand({
      ContextName: "bunsai-e2e-context",
      ContextType: "Endpoint",
      Source: {
        SourceUri: "arn:aws:sagemaker:us-east-1:123456789012:endpoint/ep",
        SourceType: "ARN",
      },
    }),
  );
  expect(result.ContextArn).toContain("context/bunsai-e2e-context");
});

test("CreateDataQualityJobDefinition returns JobDefinitionArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateDataQualityJobDefinitionCommand({
      JobDefinitionName: "bunsai-e2e-dqjd",
      DataQualityAppSpecification: {
        ImageUri:
          "123456789012.dkr.ecr.us-east-1.amazonaws.com/sagemaker-model-monitor-analyzer:latest",
      },
      DataQualityJobInput: {
        EndpointInput: {
          EndpointName: "bunsai-ep",
          LocalPath: "/opt/ml/processing/input",
        },
      },
      DataQualityJobOutputConfig: {
        MonitoringOutputs: [
          {
            S3Output: {
              S3Uri: "s3://bunsai/dq-output",
              LocalPath: "/opt/ml/processing/output",
              S3UploadMode: "EndOfJob",
            },
          },
        ],
      },
      JobResources: {
        ClusterConfig: {
          InstanceCount: 1,
          InstanceType: "ml.m5.xlarge",
          VolumeSizeInGB: 20,
        },
      },
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
    }),
  );
  expect(result.JobDefinitionArn).toContain(
    "data-quality-job-definition/bunsai-e2e-dqjd",
  );
});
