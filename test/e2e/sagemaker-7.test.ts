import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateAppCommand,
  CreateAppImageConfigCommand,
  CreateDomainCommand,
  DescribeActionCommand,
  DescribeAlgorithmCommand,
  DescribeAppCommand,
  DescribeAppImageConfigCommand,
  DescribeArtifactCommand,
  DescribeAutoMLJobCommand,
  DescribeClusterCommand,
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

test("SageMaker app create → describe lifecycle", async () => {
  const client = sagemaker();
  const domainName = "bunsai-e2e-dom7";
  const appName = "default";
  const appType = "JupyterServer";

  const createdDomain = await client.send(
    new CreateDomainCommand({
      DomainName: domainName,
      AuthMode: "IAM",
      DefaultUserSettings: {},
      SubnetIds: ["subnet-12345678"],
      VpcId: "vpc-12345678",
    }),
  );
  const domainId = createdDomain.DomainId!;
  expect(domainId).toBeDefined();

  const createdApp = await client.send(
    new CreateAppCommand({
      DomainId: domainId,
      AppType: appType,
      AppName: appName,
      UserProfileName: "default-user",
    }),
  );
  expect(createdApp.AppArn).toContain(`app/${domainId}`);

  const describedApp = await client.send(
    new DescribeAppCommand({
      DomainId: domainId,
      AppType: appType,
      AppName: appName,
    }),
  );
  expect(describedApp.AppName).toBe(appName);
  expect(describedApp.AppType).toBe(appType);
  expect(describedApp.DomainId).toBe(domainId);
  expect(describedApp.Status).toBe("InService");
  expect(describedApp.CreationTime).toBeDefined();
  expect(describedApp.AppArn).toBe(createdApp.AppArn);

  const imageConfigName = "bunsai-e2e-cfg7";
  const createdCfg = await client.send(
    new CreateAppImageConfigCommand({
      AppImageConfigName: imageConfigName,
    }),
  );
  expect(createdCfg.AppImageConfigArn).toContain(
    `app-image-config/${imageConfigName}`,
  );

  const describedCfg = await client.send(
    new DescribeAppImageConfigCommand({
      AppImageConfigName: imageConfigName,
    }),
  );
  expect(describedCfg.AppImageConfigName).toBe(imageConfigName);
  expect(describedCfg.AppImageConfigArn).toBe(createdCfg.AppImageConfigArn);
  expect(describedCfg.CreationTime).toBeDefined();
});

test("SageMaker describe synthetic operations", async () => {
  const client = sagemaker();

  const action = await client.send(
    new DescribeActionCommand({ ActionName: "bunsai-e2e-action" }),
  );
  expect(action.ActionName).toBe("bunsai-e2e-action");
  expect(action.ActionArn).toContain("action/bunsai-e2e-action");
  expect(action.Status).toBe("Completed");

  const algo = await client.send(
    new DescribeAlgorithmCommand({ AlgorithmName: "bunsai-e2e-algo" }),
  );
  expect(algo.AlgorithmName).toBe("bunsai-e2e-algo");
  expect(algo.AlgorithmArn).toContain("algorithm/bunsai-e2e-algo");
  expect(algo.AlgorithmStatus).toBe("Completed");

  const artifact = await client.send(
    new DescribeArtifactCommand({
      ArtifactArn: `arn:aws:sagemaker:${region}:123456789012:artifact/bunsai-e2e-art`,
    }),
  );
  expect(artifact.ArtifactArn).toContain("artifact/bunsai-e2e-art");
  expect(artifact.ArtifactType).toBe("DataSet");

  const automl = await client.send(
    new DescribeAutoMLJobCommand({ AutoMLJobName: "bunsai-e2e-automl" }),
  );
  expect(automl.AutoMLJobName).toBe("bunsai-e2e-automl");
  expect(automl.AutoMLJobArn).toContain("automl-job/bunsai-e2e-automl");
  expect(automl.AutoMLJobStatus).toBe("Completed");

  const cluster = await client.send(
    new DescribeClusterCommand({ ClusterName: "bunsai-e2e-cluster" }),
  );
  expect(cluster.ClusterArn).toContain("cluster/bunsai-e2e-cluster");
  expect(cluster.ClusterStatus).toBe("InService");
});
