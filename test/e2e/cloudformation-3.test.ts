import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudFormationClient,
  CreateStackCommand,
  DeleteStackCommand,
  ListStackResourcesCommand,
} from "@aws-sdk/client-cloudformation";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cfn = () =>
  new CloudFormationClient({ endpoint, region, credentials, requestHandler });

const sqs = () =>
  new SQSClient({ endpoint, region, credentials, requestHandler });

const dynamo = () =>
  new DynamoDBClient({ endpoint, region, credentials, requestHandler });

const queueName = "cfn-mat-queue";
const tableName = "cfn-mat-table";

const template = JSON.stringify({
  AWSTemplateFormatVersion: "2010-09-09",
  Resources: {
    MyQueue: {
      Type: "AWS::SQS::Queue",
      Properties: { QueueName: queueName },
    },
    MyTable: {
      Type: "AWS::DynamoDB::Table",
      Properties: {
        TableName: tableName,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      },
    },
  },
});

test("CloudFormation materialize: SQS + DynamoDB provisioning and teardown", async () => {
  const cfnClient = cfn();
  const sqsClient = sqs();
  const dynamoClient = dynamo();
  const stackName = "cfn-mat-test-stack";

  const created = await cfnClient.send(
    new CreateStackCommand({ StackName: stackName, TemplateBody: template }),
  );
  expect(created.StackId).toBeDefined();

  const listed = await cfnClient.send(
    new ListStackResourcesCommand({ StackName: stackName }),
  );
  const physicalIds = Object.fromEntries(
    (listed.StackResourceSummaries ?? []).map((r) => [
      r.LogicalResourceId,
      r.PhysicalResourceId,
    ]),
  );
  expect(physicalIds["MyQueue"]).toContain(queueName);
  expect(physicalIds["MyTable"]).toBe(tableName);

  const queueUrlResult = await sqsClient.send(
    new GetQueueUrlCommand({ QueueName: queueName }),
  );
  expect(queueUrlResult.QueueUrl).toContain(queueName);

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrlResult.QueueUrl!,
      MessageBody: "hello-from-cfn",
    }),
  );

  const received = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrlResult.QueueUrl!,
      MaxNumberOfMessages: 1,
    }),
  );
  expect(received.Messages?.length).toBe(1);
  expect(received.Messages?.[0]?.Body).toBe("hello-from-cfn");

  await dynamoClient.send(
    new PutItemCommand({
      TableName: tableName,
      Item: { pk: { S: "row1" }, data: { S: "cfn-value" } },
    }),
  );

  const gotItem = await dynamoClient.send(
    new GetItemCommand({
      TableName: tableName,
      Key: { pk: { S: "row1" } },
    }),
  );
  expect(gotItem.Item?.["pk"]?.S).toBe("row1");
  expect(gotItem.Item?.["data"]?.S).toBe("cfn-value");

  await cfnClient.send(new DeleteStackCommand({ StackName: stackName }));

  await expect(
    sqsClient.send(new GetQueueUrlCommand({ QueueName: queueName })),
  ).rejects.toThrow();

  await expect(
    dynamoClient.send(
      new GetItemCommand({
        TableName: tableName,
        Key: { pk: { S: "row1" } },
      }),
    ),
  ).rejects.toThrow();
});
