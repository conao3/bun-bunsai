import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateCodeRepositoryCommand,
  CreateDeviceFleetCommand,
  DeleteCodeRepositoryCommand,
  DeleteDeviceFleetCommand,
  DeregisterDevicesCommand,
  DescribeClusterSchedulerConfigCommand,
  DescribeCodeRepositoryCommand,
  DescribeDeviceCommand,
  DescribeDeviceFleetCommand,
  DescribeDomainCommand,
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

test("CreateCodeRepository → DescribeCodeRepository → DeleteCodeRepository lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateCodeRepositoryCommand({
      CodeRepositoryName: "bunsai-e2e-repo-15",
      GitConfig: {
        RepositoryUrl: "https://github.com/example/bunsai-e2e-repo",
        Branch: "main",
      },
    }),
  );

  expect(created.CodeRepositoryArn).toBeDefined();
  expect(created.CodeRepositoryArn).toContain(
    "code-repository/bunsai-e2e-repo-15",
  );

  const described = await client.send(
    new DescribeCodeRepositoryCommand({
      CodeRepositoryName: "bunsai-e2e-repo-15",
    }),
  );

  expect(described.CodeRepositoryName).toBe("bunsai-e2e-repo-15");
  expect(described.CodeRepositoryArn).toContain(
    "code-repository/bunsai-e2e-repo-15",
  );
  expect(described.CreationTime).toBeDefined();
  expect(described.LastModifiedTime).toBeDefined();

  await client.send(
    new DeleteCodeRepositoryCommand({
      CodeRepositoryName: "bunsai-e2e-repo-15",
    }),
  );

  await expect(
    client.send(
      new DescribeCodeRepositoryCommand({
        CodeRepositoryName: "bunsai-e2e-repo-15",
      }),
    ),
  ).rejects.toThrow();
});

test("CreateDeviceFleet → DescribeDeviceFleet → DescribeDevice → DeregisterDevices → DeleteDeviceFleet lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateDeviceFleetCommand({
      DeviceFleetName: "bunsai-e2e-fleet-15",
      OutputConfig: {
        S3OutputLocation: "s3://bunsai-sagemaker/fleet-output",
      },
      Description: "e2e test device fleet",
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
    }),
  );

  expect(created.$metadata.httpStatusCode).toBe(200);

  const described = await client.send(
    new DescribeDeviceFleetCommand({
      DeviceFleetName: "bunsai-e2e-fleet-15",
    }),
  );

  expect(described.DeviceFleetName).toBe("bunsai-e2e-fleet-15");
  expect(described.DeviceFleetArn).toContain(
    "device-fleet/bunsai-e2e-fleet-15",
  );
  expect(described.Description).toBe("e2e test device fleet");
  expect(described.CreationTime).toBeDefined();

  const device = await client.send(
    new DescribeDeviceCommand({
      DeviceFleetName: "bunsai-e2e-fleet-15",
      DeviceName: "bunsai-e2e-device-01",
    }),
  );

  expect(device.DeviceName).toBe("bunsai-e2e-device-01");
  expect(device.DeviceFleetName).toBe("bunsai-e2e-fleet-15");

  await client.send(
    new DeregisterDevicesCommand({
      DeviceFleetName: "bunsai-e2e-fleet-15",
      DeviceNames: ["bunsai-e2e-device-01"],
    }),
  );

  await client.send(
    new DeleteDeviceFleetCommand({
      DeviceFleetName: "bunsai-e2e-fleet-15",
    }),
  );

  await expect(
    client.send(
      new DescribeDeviceFleetCommand({
        DeviceFleetName: "bunsai-e2e-fleet-15",
      }),
    ),
  ).rejects.toThrow();
});

test("DescribeDomain not-found throws ResourceNotFound", async () => {
  const client = sagemaker();

  await expect(
    client.send(
      new DescribeDomainCommand({
        DomainId: "d-nonexistent00000",
      }),
    ),
  ).rejects.toThrow();
});

test("DescribeClusterSchedulerConfig not-found throws ResourceNotFound", async () => {
  const client = sagemaker();

  await expect(
    client.send(
      new DescribeClusterSchedulerConfigCommand({
        ClusterSchedulerConfigId: "nonexistent-scheduler",
      }),
    ),
  ).rejects.toThrow();
});
