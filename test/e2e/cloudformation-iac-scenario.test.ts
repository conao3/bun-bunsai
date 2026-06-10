import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudFormationClient,
  CreateStackCommand,
  DeleteStackCommand,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  GetTopicAttributesCommand,
  PublishCommand,
  SNSClient,
} from "@aws-sdk/client-sns";
import {
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cfn = () =>
  new CloudFormationClient({ endpoint, region, credentials, requestHandler });
const sns = () =>
  new SNSClient({ endpoint, region, credentials, requestHandler });
const sqs = () =>
  new SQSClient({ endpoint, region, credentials, requestHandler });
const ddb = () =>
  new DynamoDBClient({ endpoint, region, credentials, requestHandler });

const template = JSON.stringify({
  AWSTemplateFormatVersion: "2010-09-09",
  Resources: {
    Topic: {
      Type: "AWS::SNS::Topic",
      Properties: { TopicName: "cfn-iac-topic" },
    },
    Queue: {
      Type: "AWS::SQS::Queue",
      Properties: { QueueName: "cfn-iac-queue" },
    },
    Subscription: {
      Type: "AWS::SNS::Subscription",
      Properties: {
        TopicArn: { Ref: "Topic" },
        Protocol: "sqs",
        Endpoint: { "Fn::GetAtt": ["Queue", "Arn"] },
      },
    },
    Table: {
      Type: "AWS::DynamoDB::Table",
      Properties: {
        TableName: "cfn-iac-table",
        AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
      },
    },
  },
  Outputs: {
    TopicArn: { Value: { Ref: "Topic" } },
    QueueUrl: { Value: { Ref: "Queue" } },
    TableName: { Value: { Ref: "Table" } },
  },
});

test("CloudFormation IaC round-trip: SNS+SQS+DynamoDB stack lifecycle", async () => {
  const stackName = "cfn-iac-scenario";

  const created = await cfn().send(
    new CreateStackCommand({ StackName: stackName, TemplateBody: template }),
  );
  expect(created.StackId).toBeDefined();
  expect(created.StackId).toContain(`:stack/${stackName}/`);

  const described = await cfn().send(
    new DescribeStacksCommand({ StackName: stackName }),
  );
  expect(described.Stacks?.length).toBe(1);
  const stack = described.Stacks?.[0];
  expect(stack?.StackStatus).toBe("CREATE_COMPLETE");

  const outputs = stack?.Outputs ?? [];
  const topicArnOutput = outputs.find((o) => o.OutputKey === "TopicArn");
  const queueUrlOutput = outputs.find((o) => o.OutputKey === "QueueUrl");
  const tableNameOutput = outputs.find((o) => o.OutputKey === "TableName");

  expect(topicArnOutput?.OutputValue).toBeDefined();
  expect(queueUrlOutput?.OutputValue).toBeDefined();
  expect(tableNameOutput?.OutputValue).toBeDefined();

  const topicArn = topicArnOutput!.OutputValue!;
  const queueUrl = queueUrlOutput!.OutputValue!;
  const tableName = tableNameOutput!.OutputValue!;

  expect(topicArn).toContain("cfn-iac-topic");
  expect(queueUrl).toContain("cfn-iac-queue");
  expect(tableName).toBe("cfn-iac-table");

  await sns().send(
    new PublishCommand({ TopicArn: topicArn, Message: "hello-from-cfn-iac" }),
  );

  const received = await sqs().send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 1,
    }),
  );
  expect(received.Messages?.length).toBeGreaterThanOrEqual(1);
  const body = JSON.parse(received.Messages?.[0]?.Body ?? "{}");
  expect(body.Message).toBe("hello-from-cfn-iac");

  await ddb().send(
    new PutItemCommand({
      TableName: tableName,
      Item: { PK: { S: "test-key" }, Value: { S: "test-value" } },
    }),
  );
  const item = await ddb().send(
    new GetItemCommand({
      TableName: tableName,
      Key: { PK: { S: "test-key" } },
    }),
  );
  expect(item.Item?.["PK"]?.S).toBe("test-key");
  expect(item.Item?.["Value"]?.S).toBe("test-value");

  await cfn().send(new DeleteStackCommand({ StackName: stackName }));

  await expect(
    sns().send(new GetTopicAttributesCommand({ TopicArn: topicArn })),
  ).rejects.toThrow();

  await expect(
    sqs().send(new GetQueueUrlCommand({ QueueName: "cfn-iac-queue" })),
  ).rejects.toThrow();

  await expect(
    ddb().send(
      new GetItemCommand({
        TableName: tableName,
        Key: { PK: { S: "test-key" } },
      }),
    ),
  ).rejects.toThrow();
});
