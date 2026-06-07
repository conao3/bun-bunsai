import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateNotebookInstanceCommand,
  DescribeNotebookInstanceCommand,
  SageMakerClient,
  StartNotebookInstanceCommand,
  StopNotebookInstanceCommand,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("StopNotebookInstance → DescribeNotebookInstance Status=Stopping", async () => {
  const client = sagemaker();
  const name = `nb-chunk26-${Date.now()}`;

  const created = await client.send(
    new CreateNotebookInstanceCommand({
      NotebookInstanceName: name,
      InstanceType: "ml.t2.medium",
      RoleArn: "arn:aws:iam::123456789012:role/test-role",
    }),
  );
  expect(created.NotebookInstanceArn).toContain("notebook-instance");

  await client.send(
    new StartNotebookInstanceCommand({ NotebookInstanceName: name }),
  );
  const afterStart = await client.send(
    new DescribeNotebookInstanceCommand({ NotebookInstanceName: name }),
  );
  expect(afterStart.NotebookInstanceStatus).toBe("InService");

  await client.send(
    new StopNotebookInstanceCommand({ NotebookInstanceName: name }),
  );
  const afterStop = await client.send(
    new DescribeNotebookInstanceCommand({ NotebookInstanceName: name }),
  );
  expect(afterStop.NotebookInstanceName).toBe(name);
  expect(afterStop.NotebookInstanceStatus).toBe("Stopping");
  expect(afterStop.NotebookInstanceArn).toContain("notebook-instance");
});

test("StopNotebookInstance → ResourceNotFound for missing instance", async () => {
  const client = sagemaker();
  await expect(
    client.send(
      new StopNotebookInstanceCommand({
        NotebookInstanceName: "no-such-nb-chunk26",
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFound" });
});
