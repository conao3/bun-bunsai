import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudFormationClient,
  CreateStackCommand,
  DeleteStackCommand,
  DescribeStacksCommand,
  GetTemplateCommand,
  ListStacksCommand,
  UpdateStackCommand,
} from "@aws-sdk/client-cloudformation";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cfn = () =>
  new CloudFormationClient({ endpoint, region, credentials, requestHandler });

const template = JSON.stringify({
  AWSTemplateFormatVersion: "2010-09-09",
  Resources: {
    Topic: { Type: "AWS::SNS::Topic" },
  },
});

const updatedTemplate = JSON.stringify({
  AWSTemplateFormatVersion: "2010-09-09",
  Resources: {
    Queue: { Type: "AWS::SQS::Queue" },
  },
});

test("CloudFormation stack lifecycle", async () => {
  const client = cfn();
  const stackName = "bunsai-e2e-stack";

  const created = await client.send(
    new CreateStackCommand({ StackName: stackName, TemplateBody: template }),
  );
  const stackId = created.StackId;
  expect(stackId).toBeDefined();
  expect(stackId).toContain(`:stack/${stackName}/`);

  const described = await client.send(
    new DescribeStacksCommand({ StackName: stackName }),
  );
  expect(described.Stacks?.length).toBe(1);
  expect(described.Stacks?.[0]?.StackName).toBe(stackName);
  expect(described.Stacks?.[0]?.StackId).toBe(stackId);
  expect(described.Stacks?.[0]?.StackStatus).toBe("CREATE_COMPLETE");

  const got = await client.send(
    new GetTemplateCommand({ StackName: stackName }),
  );
  expect(got.TemplateBody).toBe(template);

  const updated = await client.send(
    new UpdateStackCommand({
      StackName: stackName,
      TemplateBody: updatedTemplate,
    }),
  );
  expect(updated.StackId).toBe(stackId);

  const describedAfterUpdate = await client.send(
    new DescribeStacksCommand({ StackName: stackName }),
  );
  expect(describedAfterUpdate.Stacks?.[0]?.StackStatus).toBe("UPDATE_COMPLETE");

  const gotAfterUpdate = await client.send(
    new GetTemplateCommand({ StackName: stackName }),
  );
  expect(gotAfterUpdate.TemplateBody).toBe(updatedTemplate);

  const listed = await client.send(new ListStacksCommand({}));
  const names = (listed.StackSummaries ?? []).map((s) => s.StackName);
  expect(names).toContain(stackName);

  await client.send(new DeleteStackCommand({ StackName: stackName }));

  const listedAfter = await client.send(new ListStacksCommand({}));
  const namesAfter = (listedAfter.StackSummaries ?? []).map((s) => s.StackName);
  expect(namesAfter).not.toContain(stackName);
});
