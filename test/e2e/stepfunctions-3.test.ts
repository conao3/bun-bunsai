import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateActivityCommand,
  CreateStateMachineAliasCommand,
  CreateStateMachineCommand,
  DeleteStateMachineAliasCommand,
  DeleteStateMachineVersionCommand,
  DescribeMapRunCommand,
  DescribeStateMachineAliasCommand,
  DescribeStateMachineForExecutionCommand,
  GetActivityTaskCommand,
  GetExecutionHistoryCommand,
  ListMapRunsCommand,
  ListStateMachineAliasesCommand,
  ListStateMachineVersionsCommand,
  PublishStateMachineVersionCommand,
  RedriveExecutionCommand,
  SFNClient,
  SendTaskFailureCommand,
  SendTaskHeartbeatCommand,
  SendTaskSuccessCommand,
  StartExecutionCommand,
  StartSyncExecutionCommand,
  TestStateCommand,
  UpdateMapRunCommand,
  UpdateStateMachineAliasCommand,
  UpdateStateMachineCommand,
  ValidateStateMachineDefinitionCommand,
} from "@aws-sdk/client-sfn";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sfn = () =>
  new SFNClient({ endpoint, region, credentials, requestHandler });

const sfnSync = () =>
  new SFNClient({
    endpoint,
    region,
    credentials,
    requestHandler,
    disableHostPrefix: true,
  });

const definition = JSON.stringify({
  StartAt: "Pass",
  States: { Pass: { Type: "Pass", End: true } },
});
const roleArn = "arn:aws:iam::000000000000:role/bunsai-e2e-role";

test("UpdateStateMachine", async () => {
  const client = sfn();
  const machineName = "bunsai-update-machine";
  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const newDefinition = JSON.stringify({
    StartAt: "Pass",
    States: { Pass: { Type: "Pass", End: true, Comment: "updated" } },
  });
  const updated = await client.send(
    new UpdateStateMachineCommand({
      stateMachineArn: machineArn,
      definition: newDefinition,
    }),
  );
  expect(updated.updateDate).toBeInstanceOf(Date);
});

test("UpdateStateMachine with publish", async () => {
  const client = sfn();
  const machineName = "bunsai-publish-machine";
  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const updated = await client.send(
    new UpdateStateMachineCommand({
      stateMachineArn: machineArn,
      publish: true,
    }),
  );
  expect(updated.updateDate).toBeInstanceOf(Date);
  expect(updated.stateMachineVersionArn).toContain(machineArn);
});

test("ValidateStateMachineDefinition", async () => {
  const client = sfn();
  const result = await client.send(
    new ValidateStateMachineDefinitionCommand({ definition }),
  );
  expect(result.result).toBe("OK");
  expect(result.diagnostics).toBeArray();
});

test("TestState", async () => {
  const client = sfnSync();
  const result = await client.send(
    new TestStateCommand({ definition, roleArn }),
  );
  expect(result.status).toBe("SUCCEEDED");
});

test("PublishStateMachineVersion and ListStateMachineVersions and DeleteStateMachineVersion", async () => {
  const client = sfn();
  const machineName = "bunsai-version-machine";
  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const published = await client.send(
    new PublishStateMachineVersionCommand({ stateMachineArn: machineArn }),
  );
  expect(published.creationDate).toBeInstanceOf(Date);
  expect(published.stateMachineVersionArn).toContain(machineArn);
  const versionArn = published.stateMachineVersionArn ?? "";

  const listed = await client.send(
    new ListStateMachineVersionsCommand({ stateMachineArn: machineArn }),
  );
  const versionArns = (listed.stateMachineVersions ?? []).map(
    (v) => v.stateMachineVersionArn,
  );
  expect(versionArns).toContain(versionArn);

  await client.send(
    new DeleteStateMachineVersionCommand({
      stateMachineVersionArn: versionArn,
    }),
  );

  const afterDelete = await client.send(
    new ListStateMachineVersionsCommand({ stateMachineArn: machineArn }),
  );
  const afterDeleteArns = (afterDelete.stateMachineVersions ?? []).map(
    (v) => v.stateMachineVersionArn,
  );
  expect(afterDeleteArns).not.toContain(versionArn);
});

test("CreateStateMachineAlias and DescribeStateMachineAlias and UpdateStateMachineAlias and DeleteStateMachineAlias and ListStateMachineAliases", async () => {
  const client = sfn();
  const machineName = "bunsai-alias-machine";
  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const published = await client.send(
    new PublishStateMachineVersionCommand({ stateMachineArn: machineArn }),
  );
  const versionArn = published.stateMachineVersionArn ?? "";

  const aliasName = "bunsai-alias";
  const aliasCreated = await client.send(
    new CreateStateMachineAliasCommand({
      name: aliasName,
      routingConfiguration: [
        { stateMachineVersionArn: versionArn, weight: 100 },
      ],
    }),
  );
  expect(aliasCreated.stateMachineAliasArn).toContain(aliasName);
  expect(aliasCreated.creationDate).toBeInstanceOf(Date);
  const aliasArn = aliasCreated.stateMachineAliasArn ?? "";

  const described = await client.send(
    new DescribeStateMachineAliasCommand({ stateMachineAliasArn: aliasArn }),
  );
  expect(described.name).toBe(aliasName);
  expect(described.stateMachineAliasArn).toBe(aliasArn);
  expect(described.routingConfiguration).toHaveLength(1);

  const updated = await client.send(
    new UpdateStateMachineAliasCommand({
      stateMachineAliasArn: aliasArn,
      description: "updated",
    }),
  );
  expect(updated.updateDate).toBeInstanceOf(Date);

  const listed = await client.send(
    new ListStateMachineAliasesCommand({ stateMachineArn: machineArn }),
  );
  const aliasArns = (listed.stateMachineAliases ?? []).map(
    (a) => a.stateMachineAliasArn,
  );
  expect(aliasArns).toContain(aliasArn);

  await client.send(
    new DeleteStateMachineAliasCommand({ stateMachineAliasArn: aliasArn }),
  );

  await expect(
    client.send(
      new DescribeStateMachineAliasCommand({ stateMachineAliasArn: aliasArn }),
    ),
  ).rejects.toThrow();
});

test("DescribeStateMachineForExecution", async () => {
  const client = sfn();
  const machineName = "bunsai-descexec-machine";
  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const started = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: "bunsai-descexec-exec",
    }),
  );
  const executionArn = started.executionArn ?? "";

  const described = await client.send(
    new DescribeStateMachineForExecutionCommand({ executionArn }),
  );
  expect(described.stateMachineArn).toBe(machineArn);
  expect(described.name).toBe(machineName);
  expect(described.definition).toBe(definition);
  expect(described.roleArn).toBe(roleArn);
  expect(described.updateDate).toBeInstanceOf(Date);
});

test("StartSyncExecution", async () => {
  const client = sfnSync();
  const machineName = "bunsai-sync-machine";
  const created = await client.send(
    new CreateStateMachineCommand({
      name: machineName,
      definition,
      roleArn,
      type: "EXPRESS",
    }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const result = await client.send(
    new StartSyncExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({ key: "value" }),
    }),
  );
  expect(result.executionArn).toContain("execution:");
  expect(result.startDate).toBeInstanceOf(Date);
  expect(result.stopDate).toBeInstanceOf(Date);
  expect(result.status).toBe("SUCCEEDED");
  expect(result.input).toBe(JSON.stringify({ key: "value" }));
});

test("RedriveExecution", async () => {
  const client = sfn();
  const machineName = "bunsai-redrive-machine";
  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const started = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: "bunsai-redrive-exec",
    }),
  );
  const executionArn = started.executionArn ?? "";

  const redriven = await client.send(
    new RedriveExecutionCommand({ executionArn }),
  );
  expect(redriven.redriveDate).toBeInstanceOf(Date);
});

test("GetExecutionHistory", async () => {
  const client = sfn();
  const machineName = "bunsai-history-machine";
  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const started = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: "bunsai-history-exec",
      input: JSON.stringify({ n: 42 }),
    }),
  );
  const executionArn = started.executionArn ?? "";

  const history = await client.send(
    new GetExecutionHistoryCommand({ executionArn }),
  );
  expect(history.events).toBeArray();
  expect((history.events ?? []).length).toBeGreaterThan(0);
  const types = (history.events ?? []).map((e) => e.type);
  expect(types).toContain("ExecutionStarted");
});

test("ListMapRuns returns empty list for valid execution", async () => {
  const client = sfn();
  const machineName = "bunsai-maprun-machine";
  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const started = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: "bunsai-maprun-exec",
    }),
  );
  const executionArn = started.executionArn ?? "";

  const listed = await client.send(new ListMapRunsCommand({ executionArn }));
  expect(listed.mapRuns).toBeArray();
  expect(listed.mapRuns).toHaveLength(0);
});

test("GetActivityTask returns empty task for activity with no queued tasks", async () => {
  const client = sfn();
  const activityName = "bunsai-gat-activity";
  const created = await client.send(
    new CreateActivityCommand({ name: activityName }),
  );
  const activityArn = created.activityArn ?? "";
  const task = await client.send(new GetActivityTaskCommand({ activityArn }));
  expect(task.taskToken).toBeUndefined();
  expect(task.input).toBeUndefined();
});

test("SendTaskSuccess, SendTaskFailure, SendTaskHeartbeat are stubs", async () => {
  const client = sfn();
  const taskToken = "test-task-token";
  await expect(
    client.send(new SendTaskSuccessCommand({ taskToken, output: "{}" })),
  ).resolves.toBeDefined();
  await expect(
    client.send(new SendTaskFailureCommand({ taskToken })),
  ).resolves.toBeDefined();
  await expect(
    client.send(new SendTaskHeartbeatCommand({ taskToken })),
  ).resolves.toBeDefined();
});

test("DescribeMapRun throws ResourceNotFound for nonexistent map run", async () => {
  const client = sfn();
  await expect(
    client.send(
      new DescribeMapRunCommand({
        mapRunArn:
          "arn:aws:states:us-east-1:000000000000:mapRun:nonexistent:run/run-id",
      }),
    ),
  ).rejects.toThrow();
});

test("UpdateMapRun throws ResourceNotFound for nonexistent map run", async () => {
  const client = sfn();
  await expect(
    client.send(
      new UpdateMapRunCommand({
        mapRunArn:
          "arn:aws:states:us-east-1:000000000000:mapRun:nonexistent:run/run-id",
        maxConcurrency: 10,
      }),
    ),
  ).rejects.toThrow();
});
