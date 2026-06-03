import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CloudFormationClient,
  CreateChangeSetCommand,
  CreateStackCommand,
  DeleteChangeSetCommand,
  DescribeChangeSetCommand,
  DescribeStackResourcesCommand,
  ListChangeSetsCommand,
  ListStackResourcesCommand,
  ValidateTemplateCommand,
} from "@aws-sdk/client-cloudformation";

const awsPort = 4861;
const uiPort = 5861;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const cfn = () => new CloudFormationClient({ endpoint, region, credentials });

const template = JSON.stringify({
  AWSTemplateFormatVersion: "2010-09-09",
  Description: "bunsai change set template",
  Parameters: {
    BucketName: { Type: "String", Default: "default-bucket" },
  },
  Resources: {
    Topic: { Type: "AWS::SNS::Topic" },
    Queue: { Type: "AWS::SQS::Queue" },
  },
});

test("CloudFormation change set lifecycle", async () => {
  const client = cfn();
  const stackName = "bunsai-e2e-cs-stack";
  const changeSetName = "bunsai-e2e-cs";

  await client.send(
    new CreateStackCommand({ StackName: stackName, TemplateBody: template }),
  );

  const created = await client.send(
    new CreateChangeSetCommand({
      StackName: stackName,
      ChangeSetName: changeSetName,
      TemplateBody: template,
      Description: "add resources",
    }),
  );
  const changeSetId = created.Id;
  expect(changeSetId).toBeDefined();
  expect(changeSetId).toContain(`:changeSet/${changeSetName}/`);
  expect(created.StackId).toBeDefined();

  const described = await client.send(
    new DescribeChangeSetCommand({
      ChangeSetName: changeSetName,
      StackName: stackName,
    }),
  );
  expect(described.ChangeSetName).toBe(changeSetName);
  expect(described.StackName).toBe(stackName);
  expect(described.Status).toBe("CREATE_COMPLETE");
  expect(described.ExecutionStatus).toBe("AVAILABLE");
  const changeTypes = (described.Changes ?? []).map(
    (change) => change.ResourceChange?.LogicalResourceId,
  );
  expect(changeTypes).toContain("Topic");
  expect(changeTypes).toContain("Queue");

  const listed = await client.send(
    new ListChangeSetsCommand({ StackName: stackName }),
  );
  const names = (listed.Summaries ?? []).map((s) => s.ChangeSetName);
  expect(names).toContain(changeSetName);

  await client.send(
    new DeleteChangeSetCommand({
      ChangeSetName: changeSetName,
      StackName: stackName,
    }),
  );

  const listedAfter = await client.send(
    new ListChangeSetsCommand({ StackName: stackName }),
  );
  const namesAfter = (listedAfter.Summaries ?? []).map((s) => s.ChangeSetName);
  expect(namesAfter).not.toContain(changeSetName);

  await expect(
    client.send(
      new DescribeChangeSetCommand({
        ChangeSetName: changeSetName,
        StackName: stackName,
      }),
    ),
  ).rejects.toThrow();
});

test("CloudFormation ValidateTemplate", async () => {
  const client = cfn();

  const validated = await client.send(
    new ValidateTemplateCommand({ TemplateBody: template }),
  );
  expect(validated.Description).toBe("bunsai change set template");
  const paramKeys = (validated.Parameters ?? []).map((p) => p.ParameterKey);
  expect(paramKeys).toContain("BucketName");
  const bucketParam = (validated.Parameters ?? []).find(
    (p) => p.ParameterKey === "BucketName",
  );
  expect(bucketParam?.DefaultValue).toBe("default-bucket");
});

test("CloudFormation stack resources", async () => {
  const client = cfn();
  const stackName = "bunsai-e2e-resource-stack";

  await client.send(
    new CreateStackCommand({ StackName: stackName, TemplateBody: template }),
  );

  const listed = await client.send(
    new ListStackResourcesCommand({ StackName: stackName }),
  );
  const logicalIds = (listed.StackResourceSummaries ?? []).map(
    (r) => r.LogicalResourceId,
  );
  expect(logicalIds).toContain("Topic");
  expect(logicalIds).toContain("Queue");
  const topicSummary = (listed.StackResourceSummaries ?? []).find(
    (r) => r.LogicalResourceId === "Topic",
  );
  expect(topicSummary?.ResourceType).toBe("AWS::SNS::Topic");
  expect(topicSummary?.ResourceStatus).toBe("CREATE_COMPLETE");

  const described = await client.send(
    new DescribeStackResourcesCommand({ StackName: stackName }),
  );
  const describedIds = (described.StackResources ?? []).map(
    (r) => r.LogicalResourceId,
  );
  expect(describedIds).toContain("Topic");
  expect(describedIds).toContain("Queue");

  const filtered = await client.send(
    new DescribeStackResourcesCommand({
      StackName: stackName,
      LogicalResourceId: "Topic",
    }),
  );
  expect(filtered.StackResources?.length).toBe(1);
  expect(filtered.StackResources?.[0]?.LogicalResourceId).toBe("Topic");
  expect(filtered.StackResources?.[0]?.StackName).toBe(stackName);
});
