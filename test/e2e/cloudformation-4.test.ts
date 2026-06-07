import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudFormationClient,
  CreateStackCommand,
  DeleteStackCommand,
  DescribeStacksCommand,
  UpdateStackCommand,
} from "@aws-sdk/client-cloudformation";
import { GetQueueUrlCommand, SQSClient } from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cfn = () =>
  new CloudFormationClient({ endpoint, region, credentials, requestHandler });

const sqs = () =>
  new SQSClient({ endpoint, region, credentials, requestHandler });

const queueName = "cfn-outputs-queue";
const updatedQueueName = "cfn-outputs-queue-v2";

const template = JSON.stringify({
  AWSTemplateFormatVersion: "2010-09-09",
  Resources: {
    MyQueue: {
      Type: "AWS::SQS::Queue",
      Properties: { QueueName: queueName },
    },
  },
  Outputs: {
    QueueUrlOutput: {
      Value: { Ref: "MyQueue" },
      Description: "The URL of the queue",
    },
    QueueArnOutput: {
      Value: { "Fn::GetAtt": ["MyQueue", "Arn"] },
      Description: "The ARN of the queue",
    },
    CompositeOutput: {
      Value: { "Fn::Sub": "url=${MyQueue},arn=${MyQueue.Arn}" },
      Export: { Name: "cfn-outputs-composite" },
    },
  },
});

const updatedTemplate = JSON.stringify({
  AWSTemplateFormatVersion: "2010-09-09",
  Resources: {
    MyQueueV2: {
      Type: "AWS::SQS::Queue",
      Properties: { QueueName: updatedQueueName },
    },
  },
  Outputs: {
    QueueUrlOutput: {
      Value: { Ref: "MyQueueV2" },
    },
    QueueArnOutput: {
      Value: { "Fn::GetAtt": ["MyQueueV2", "Arn"] },
    },
    CompositeOutput: {
      Value: { "Fn::Sub": "url=${MyQueueV2},arn=${MyQueueV2.Arn}" },
    },
  },
});

test("CloudFormation stack Outputs resolve Ref/Fn::GetAtt/Fn::Sub", async () => {
  const stackName = "cfn-outputs-stack";
  const client = cfn();
  const sqsClient = sqs();

  await client.send(
    new CreateStackCommand({ StackName: stackName, TemplateBody: template }),
  );

  const described = await client.send(
    new DescribeStacksCommand({ StackName: stackName }),
  );
  const stack = described.Stacks?.[0];
  expect(stack).toBeDefined();

  const outputs = stack?.Outputs ?? [];
  expect(outputs.length).toBe(3);

  const urlOutput = outputs.find((o) => o.OutputKey === "QueueUrlOutput");
  const arnOutput = outputs.find((o) => o.OutputKey === "QueueArnOutput");
  const compositeOutput = outputs.find(
    (o) => o.OutputKey === "CompositeOutput",
  );

  expect(urlOutput).toBeDefined();
  expect(arnOutput).toBeDefined();
  expect(compositeOutput).toBeDefined();

  const sqsResult = await sqsClient.send(
    new GetQueueUrlCommand({ QueueName: queueName }),
  );
  const expectedUrl = sqsResult.QueueUrl ?? "";
  const segments = expectedUrl.split("/");
  const account = segments[segments.length - 2] ?? "";
  const expectedArn = `arn:aws:sqs:${region}:${account}:${queueName}`;

  expect(urlOutput?.OutputValue).toBe(expectedUrl);
  expect(urlOutput?.Description).toBe("The URL of the queue");

  expect(arnOutput?.OutputValue).toBe(expectedArn);
  expect(arnOutput?.Description).toBe("The ARN of the queue");

  expect(compositeOutput?.OutputValue).toBe(
    `url=${expectedUrl},arn=${expectedArn}`,
  );
  expect(compositeOutput?.ExportName).toBe("cfn-outputs-composite");

  await client.send(
    new UpdateStackCommand({
      StackName: stackName,
      TemplateBody: updatedTemplate,
    }),
  );

  const afterUpdate = await client.send(
    new DescribeStacksCommand({ StackName: stackName }),
  );
  const updatedOutputs = afterUpdate.Stacks?.[0]?.Outputs ?? [];
  expect(updatedOutputs.length).toBe(3);

  const sqsV2Result = await sqsClient.send(
    new GetQueueUrlCommand({ QueueName: updatedQueueName }),
  );
  const updatedUrl = sqsV2Result.QueueUrl ?? "";
  const updatedSegments = updatedUrl.split("/");
  const updatedAccount = updatedSegments[updatedSegments.length - 2] ?? "";
  const updatedArn = `arn:aws:sqs:${region}:${updatedAccount}:${updatedQueueName}`;

  const updatedUrlOutput = updatedOutputs.find(
    (o) => o.OutputKey === "QueueUrlOutput",
  );
  const updatedArnOutput = updatedOutputs.find(
    (o) => o.OutputKey === "QueueArnOutput",
  );
  const updatedComposite = updatedOutputs.find(
    (o) => o.OutputKey === "CompositeOutput",
  );

  expect(updatedUrlOutput?.OutputValue).toBe(updatedUrl);
  expect(updatedArnOutput?.OutputValue).toBe(updatedArn);
  expect(updatedComposite?.OutputValue).toBe(
    `url=${updatedUrl},arn=${updatedArn}`,
  );

  await client.send(new DeleteStackCommand({ StackName: stackName }));
});
