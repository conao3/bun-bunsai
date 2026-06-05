import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateNotebookInstanceLifecycleConfigCommand,
  CreatePipelineCommand,
  DeleteNotebookInstanceLifecycleConfigCommand,
  DeletePipelineCommand,
  DescribeNotebookInstanceLifecycleConfigCommand,
  DescribePipelineCommand,
  ListNotebookInstanceLifecycleConfigsCommand,
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

test("SageMaker notebook instance lifecycle config lifecycle", async () => {
  const client = sagemaker();
  const configName = "bunsai-e2e-lifecycle-config";

  const created = await client.send(
    new CreateNotebookInstanceLifecycleConfigCommand({
      NotebookInstanceLifecycleConfigName: configName,
      OnStart: [
        { Content: Buffer.from("#!/bin/bash\necho start").toString("base64") },
      ],
    }),
  );
  expect(created.NotebookInstanceLifecycleConfigArn).toContain(
    `notebook-instance-lifecycle-config/${configName}`,
  );

  const described = await client.send(
    new DescribeNotebookInstanceLifecycleConfigCommand({
      NotebookInstanceLifecycleConfigName: configName,
    }),
  );
  expect(described.NotebookInstanceLifecycleConfigName).toBe(configName);
  expect(described.NotebookInstanceLifecycleConfigArn).toBe(
    created.NotebookInstanceLifecycleConfigArn,
  );
  expect(described.CreationTime).toBeDefined();
  expect(described.LastModifiedTime).toBeDefined();

  const listed = await client.send(
    new ListNotebookInstanceLifecycleConfigsCommand({}),
  );
  expect(
    (listed.NotebookInstanceLifecycleConfigs ?? []).map(
      (c) => c.NotebookInstanceLifecycleConfigName,
    ),
  ).toContain(configName);

  await client.send(
    new DeleteNotebookInstanceLifecycleConfigCommand({
      NotebookInstanceLifecycleConfigName: configName,
    }),
  );

  const afterDelete = await client.send(
    new ListNotebookInstanceLifecycleConfigsCommand({}),
  );
  expect(
    (afterDelete.NotebookInstanceLifecycleConfigs ?? []).map(
      (c) => c.NotebookInstanceLifecycleConfigName,
    ),
  ).not.toContain(configName);
});

test("SageMaker pipeline lifecycle", async () => {
  const client = sagemaker();
  const pipelineName = "bunsai-e2e-pipeline";
  const definition = JSON.stringify({ Version: "2020-12-01", Steps: [] });

  const created = await client.send(
    new CreatePipelineCommand({
      PipelineName: pipelineName,
      PipelineDefinition: definition,
      PipelineDescription: "e2e test pipeline",
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
    }),
  );
  expect(created.PipelineArn).toContain(`pipeline/${pipelineName}`);

  const described = await client.send(
    new DescribePipelineCommand({ PipelineName: pipelineName }),
  );
  expect(described.PipelineName).toBe(pipelineName);
  expect(described.PipelineArn).toBe(created.PipelineArn);
  expect(described.PipelineStatus).toBe("Active");
  expect(described.PipelineDescription).toBe("e2e test pipeline");
  expect(described.PipelineDefinition).toBe(definition);
  expect(described.CreationTime).toBeDefined();

  const deleted = await client.send(
    new DeletePipelineCommand({ PipelineName: pipelineName }),
  );
  expect(deleted.PipelineArn).toBe(created.PipelineArn);
});
