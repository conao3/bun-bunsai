import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CloudFormationClient,
  CreateStackCommand,
  DeleteStackCommand,
  DescribeStacksCommand,
  GetTemplateCommand,
  ListStacksCommand,
  UpdateStackCommand,
} from "@aws-sdk/client-cloudformation";

const awsPort = 4566;
const uiPort = 5666;
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

const cfn = () =>
  new CloudFormationClient({ endpoint, region, credentials });

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
