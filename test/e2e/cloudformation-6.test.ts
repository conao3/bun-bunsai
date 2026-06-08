import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudFormationClient,
  CreateChangeSetCommand,
  CreateStackCommand,
  DeleteStackCommand,
  DescribeStackEventsCommand,
  DescribeStackResourceCommand,
  DescribeStacksCommand,
  ExecuteChangeSetCommand,
  ListExportsCommand,
  ListStackResourcesCommand,
} from "@aws-sdk/client-cloudformation";
import { GetFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cfn = () =>
  new CloudFormationClient({ endpoint, region, credentials, requestHandler });
const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });
const ssm = () =>
  new SSMClient({ endpoint, region, credentials, requestHandler });

test("CreateStack provisions Lambda and SSM resources — read-after-create", async () => {
  const client = cfn();
  const stackName = "cfn6-lambda-ssm";
  const template = JSON.stringify({
    Resources: {
      Fn: {
        Type: "AWS::Lambda::Function",
        Properties: {
          FunctionName: "cfn6-fn",
          Runtime: "nodejs20.x",
          Handler: "index.handler",
          Role: "arn:aws:iam::123456789012:role/test",
        },
      },
      Param: {
        Type: "AWS::SSM::Parameter",
        Properties: {
          Name: "/cfn6/param",
          Type: "String",
          Value: "hello",
        },
      },
    },
  });

  await client.send(
    new CreateStackCommand({ StackName: stackName, TemplateBody: template }),
  );

  const resources = await client.send(
    new ListStackResourcesCommand({ StackName: stackName }),
  );
  const summaries = resources.StackResourceSummaries ?? [];
  const fnSummary = summaries.find((r) => r.LogicalResourceId === "Fn");
  const paramSummary = summaries.find((r) => r.LogicalResourceId === "Param");

  expect(fnSummary?.ResourceType).toBe("AWS::Lambda::Function");
  expect(fnSummary?.PhysicalResourceId).toContain("cfn6-fn");
  expect(paramSummary?.ResourceType).toBe("AWS::SSM::Parameter");
  expect(paramSummary?.PhysicalResourceId).toBe("/cfn6/param");

  const fn = await lambda().send(
    new GetFunctionCommand({ FunctionName: "cfn6-fn" }),
  );
  expect(fn.Configuration?.FunctionName).toBe("cfn6-fn");
  expect(fn.Configuration?.Runtime).toBe("nodejs20.x");

  const param = await ssm().send(
    new GetParameterCommand({ Name: "/cfn6/param" }),
  );
  expect(param.Parameter?.Value).toBe("hello");

  const described = await client.send(
    new DescribeStackResourceCommand({
      StackName: stackName,
      LogicalResourceId: "Fn",
    }),
  );
  expect(described.StackResourceDetail?.PhysicalResourceId).toContain(
    "cfn6-fn",
  );

  await client.send(new DeleteStackCommand({ StackName: stackName }));
  await expect(
    lambda().send(new GetFunctionCommand({ FunctionName: "cfn6-fn" })),
  ).rejects.toThrow();
  await expect(
    ssm().send(new GetParameterCommand({ Name: "/cfn6/param" })),
  ).rejects.toThrow();
});

test("DescribeStackEvents includes per-resource CREATE_IN_PROGRESS/CREATE_COMPLETE", async () => {
  const client = cfn();
  const stackName = "cfn6-events";
  const template = JSON.stringify({
    Resources: {
      Q: { Type: "AWS::SQS::Queue" },
      T: { Type: "AWS::SNS::Topic" },
    },
  });

  await client.send(
    new CreateStackCommand({ StackName: stackName, TemplateBody: template }),
  );

  const events = await client.send(
    new DescribeStackEventsCommand({ StackName: stackName }),
  );
  const all = events.StackEvents ?? [];
  expect(all.length).toBeGreaterThanOrEqual(5);

  const logicalIds = all.map((e) => e.LogicalResourceId);
  expect(logicalIds).toContain("Q");
  expect(logicalIds).toContain("T");

  const statuses = all.map((e) => e.ResourceStatus);
  expect(statuses).toContain("CREATE_IN_PROGRESS");
  expect(statuses).toContain("CREATE_COMPLETE");

  const qInProgress = all.find(
    (e) =>
      e.LogicalResourceId === "Q" && e.ResourceStatus === "CREATE_IN_PROGRESS",
  );
  const qComplete = all.find(
    (e) =>
      e.LogicalResourceId === "Q" && e.ResourceStatus === "CREATE_COMPLETE",
  );
  expect(qInProgress).toBeDefined();
  expect(qComplete).toBeDefined();
  expect(qComplete?.ResourceType).toBe("AWS::SQS::Queue");

  const stackEvent = all.find(
    (e) => e.ResourceType === "AWS::CloudFormation::Stack",
  );
  expect(stackEvent?.LogicalResourceId).toBe(stackName);
  expect(stackEvent?.ResourceStatus).toBe("CREATE_COMPLETE");
});

test("Fn::ImportValue resolves cross-stack exports + ListExports", async () => {
  const client = cfn();
  const exporterName = "cfn6-exporter";
  const importerName = "cfn6-importer";
  const exporterTemplate = JSON.stringify({
    Resources: {
      Q: {
        Type: "AWS::SQS::Queue",
        Properties: { QueueName: "cfn6-export-q" },
      },
    },
    Outputs: {
      QueueUrl: {
        Value: { Ref: "Q" },
        Export: { Name: "cfn6-queue-url" },
      },
    },
  });

  await client.send(
    new CreateStackCommand({
      StackName: exporterName,
      TemplateBody: exporterTemplate,
    }),
  );

  const exports_ = await client.send(new ListExportsCommand({}));
  const ex = (exports_.Exports ?? []).find((e) => e.Name === "cfn6-queue-url");
  expect(ex).toBeDefined();
  expect(ex?.Value).toContain("cfn6-export-q");
  expect(ex?.ExportingStackId).toContain(exporterName);

  const importerTemplate = JSON.stringify({
    Resources: {
      Dummy: { Type: "AWS::SNS::Topic" },
    },
    Outputs: {
      ImportedUrl: {
        Value: { "Fn::ImportValue": "cfn6-queue-url" },
      },
    },
  });

  await client.send(
    new CreateStackCommand({
      StackName: importerName,
      TemplateBody: importerTemplate,
    }),
  );

  const stack = await client.send(
    new DescribeStacksCommand({ StackName: importerName }),
  );
  const outputs = stack.Stacks?.[0]?.Outputs ?? [];
  const imported = outputs.find((o) => o.OutputKey === "ImportedUrl");
  expect(imported?.OutputValue).toContain("cfn6-export-q");
});

test("ExecuteChangeSet applies resource diffs to existing stack", async () => {
  const client = cfn();
  const stackName = "cfn6-cs-diff";
  const initialTemplate = JSON.stringify({
    Resources: {
      Q1: { Type: "AWS::SQS::Queue", Properties: { QueueName: "cfn6-q1" } },
    },
  });

  await client.send(
    new CreateStackCommand({
      StackName: stackName,
      TemplateBody: initialTemplate,
    }),
  );

  const updatedTemplate = JSON.stringify({
    Resources: {
      Q2: { Type: "AWS::SQS::Queue", Properties: { QueueName: "cfn6-q2" } },
      T1: { Type: "AWS::SNS::Topic", Properties: { TopicName: "cfn6-t1" } },
    },
  });

  await client.send(
    new CreateChangeSetCommand({
      StackName: stackName,
      ChangeSetName: "cfn6-cs",
      TemplateBody: updatedTemplate,
    }),
  );

  await client.send(
    new ExecuteChangeSetCommand({
      ChangeSetName: "cfn6-cs",
      StackName: stackName,
    }),
  );

  const resources = await client.send(
    new ListStackResourcesCommand({ StackName: stackName }),
  );
  const summaries = resources.StackResourceSummaries ?? [];
  const ids = summaries.map((r) => r.LogicalResourceId);
  expect(ids).not.toContain("Q1");
  expect(ids).toContain("Q2");
  expect(ids).toContain("T1");

  const q2Summary = summaries.find((r) => r.LogicalResourceId === "Q2");
  expect(q2Summary?.PhysicalResourceId).toBeDefined();

  const stack = await client.send(
    new DescribeStacksCommand({ StackName: stackName }),
  );
  expect(stack.Stacks?.[0]?.StackStatus).toBe("UPDATE_COMPLETE");
});
