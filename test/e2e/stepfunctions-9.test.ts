import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateStateMachineCommand,
  ListTagsForResourceCommand,
  SFNClient,
  StartExecutionCommand,
  StartSyncExecutionCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-sfn";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const account = "000000000000";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sfn = () =>
  new SFNClient({ endpoint, region, credentials, requestHandler });

const roleArn = `arn:aws:iam::${account}:role/bunsai-e2e`;

const definition = JSON.stringify({
  StartAt: "Done",
  States: { Done: { Type: "Pass", End: true } },
});

test("StartExecution name idempotency: same name + same input returns existing execution", async () => {
  const client = sfn();
  const machineName = "bunsai-idem-same-input-machine";
  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";
  const execName = "bunsai-idem-same-exec";
  const execInput = JSON.stringify({ key: "value" });

  const first = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: execName,
      input: execInput,
    }),
  );
  const executionArn = first.executionArn ?? "";
  expect(executionArn).toContain("execution:");

  const second = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: execName,
      input: execInput,
    }),
  );
  expect(second.executionArn).toBe(executionArn);
  expect(second.startDate).toEqual(first.startDate);
});

test("StartExecution name idempotency: same name + different input throws ExecutionAlreadyExists", async () => {
  const client = sfn();
  const machineName = "bunsai-idem-diff-input-machine";
  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";
  const execName = "bunsai-idem-diff-exec";

  await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: execName,
      input: JSON.stringify({ a: 1 }),
    }),
  );

  await expect(
    client.send(
      new StartExecutionCommand({
        stateMachineArn: machineArn,
        name: execName,
        input: JSON.stringify({ a: 2 }),
      }),
    ),
  ).rejects.toThrow();
});

test("StartSyncExecution on STANDARD machine throws StateMachineTypeNotSupported", async () => {
  const client = sfn();
  const machineName = "bunsai-sync-standard-machine";
  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  await expect(
    client.send(
      new StartSyncExecutionCommand({
        stateMachineArn: machineArn,
        input: "{}",
      }),
    ),
  ).rejects.toThrow();
});

test("TagResource/UntagResource/ListTagsForResource round-trip on state machine", async () => {
  const client = sfn();
  const machineName = "bunsai-tags-sm-machine";
  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const empty = await client.send(
    new ListTagsForResourceCommand({ resourceArn: machineArn }),
  );
  expect(empty.tags ?? []).toHaveLength(0);

  await client.send(
    new TagResourceCommand({
      resourceArn: machineArn,
      tags: [
        { key: "team", value: "bunsai" },
        { key: "env", value: "prod" },
      ],
    }),
  );

  const afterTag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: machineArn }),
  );
  const afterTagMap = Object.fromEntries(
    (afterTag.tags ?? []).map((t) => [t.key, t.value]),
  );
  expect(afterTagMap["team"]).toBe("bunsai");
  expect(afterTagMap["env"]).toBe("prod");

  await client.send(
    new UntagResourceCommand({
      resourceArn: machineArn,
      tagKeys: ["env"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: machineArn }),
  );
  const afterUntagMap = Object.fromEntries(
    (afterUntag.tags ?? []).map((t) => [t.key, t.value]),
  );
  expect(afterUntagMap["env"]).toBeUndefined();
  expect(afterUntagMap["team"]).toBe("bunsai");
});
