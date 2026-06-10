import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateActivityCommand,
  CreateStateMachineAliasCommand,
  CreateStateMachineCommand,
  ListTagsForResourceCommand,
  PublishStateMachineVersionCommand,
  SFNClient,
} from "@aws-sdk/client-sfn";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sfn = () =>
  new SFNClient({ endpoint, region, credentials, requestHandler });

const definition = JSON.stringify({
  StartAt: "Pass",
  States: { Pass: { Type: "Pass", End: true } },
});
const roleArn = "arn:aws:iam::000000000000:role/bunsai-e2e-role";

test("CreateStateMachine idempotency: same params returns existing resource", async () => {
  const client = sfn();
  const machineName = "bunsai-idempotent-machine";

  const first = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  expect(first.stateMachineArn).toContain(machineName);
  const arn = first.stateMachineArn ?? "";

  const second = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  expect(second.stateMachineArn).toBe(arn);
  expect(second.creationDate).toEqual(first.creationDate);
});

test("CreateStateMachine idempotency: different definition throws StateMachineAlreadyExists", async () => {
  const client = sfn();
  const machineName = "bunsai-idempotent-conflict-machine";
  const otherDefinition = JSON.stringify({
    StartAt: "Pass",
    States: { Pass: { Type: "Pass", End: true, Comment: "changed" } },
  });

  await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );

  await expect(
    client.send(
      new CreateStateMachineCommand({
        name: machineName,
        definition: otherDefinition,
        roleArn,
      }),
    ),
  ).rejects.toThrow();
});

test("CreateStateMachine tag persistence: tags are returned by ListTagsForResource", async () => {
  const client = sfn();
  const machineName = "bunsai-tagged-machine";

  const created = await client.send(
    new CreateStateMachineCommand({
      name: machineName,
      definition,
      roleArn,
      tags: [
        { key: "env", value: "test" },
        { key: "team", value: "bunsai" },
      ],
    }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn: machineArn }),
  );
  const tags = listed.tags ?? [];
  const tagMap = Object.fromEntries(tags.map((t) => [t.key, t.value]));
  expect(tagMap["env"]).toBe("test");
  expect(tagMap["team"]).toBe("bunsai");
});

test("CreateActivity idempotency: same name returns existing resource", async () => {
  const client = sfn();
  const activityName = "bunsai-idempotent-activity";

  const first = await client.send(
    new CreateActivityCommand({ name: activityName }),
  );
  expect(first.activityArn).toContain(`activity:${activityName}`);
  const arn = first.activityArn ?? "";

  const second = await client.send(
    new CreateActivityCommand({ name: activityName }),
  );
  expect(second.activityArn).toBe(arn);
  expect(second.creationDate).toEqual(first.creationDate);
});

test("CreateStateMachineAlias idempotency: same params returns existing resource", async () => {
  const client = sfn();
  const machineName = "bunsai-idempotent-alias-machine";

  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const published = await client.send(
    new PublishStateMachineVersionCommand({ stateMachineArn: machineArn }),
  );
  const versionArn = published.stateMachineVersionArn ?? "";

  const aliasName = "bunsai-idempotent-alias";
  const routingConfiguration = [
    { stateMachineVersionArn: versionArn, weight: 100 },
  ];

  const first = await client.send(
    new CreateStateMachineAliasCommand({
      name: aliasName,
      routingConfiguration,
    }),
  );
  expect(first.stateMachineAliasArn).toContain(aliasName);
  const aliasArn = first.stateMachineAliasArn ?? "";

  const second = await client.send(
    new CreateStateMachineAliasCommand({
      name: aliasName,
      routingConfiguration,
    }),
  );
  expect(second.stateMachineAliasArn).toBe(aliasArn);
  expect(second.creationDate).toEqual(first.creationDate);
});

test("CreateStateMachineAlias idempotency: different routingConfiguration throws", async () => {
  const client = sfn();
  const machineName = "bunsai-idempotent-alias-conflict-machine";

  const created = await client.send(
    new CreateStateMachineCommand({ name: machineName, definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const published = await client.send(
    new PublishStateMachineVersionCommand({ stateMachineArn: machineArn }),
  );
  const versionArn = published.stateMachineVersionArn ?? "";

  const aliasName = "bunsai-idempotent-alias-conflict";
  const routingConfiguration = [
    { stateMachineVersionArn: versionArn, weight: 100 },
  ];

  await client.send(
    new CreateStateMachineAliasCommand({
      name: aliasName,
      routingConfiguration,
    }),
  );

  await expect(
    client.send(
      new CreateStateMachineAliasCommand({
        name: aliasName,
        routingConfiguration: [
          { stateMachineVersionArn: versionArn, weight: 50 },
        ],
      }),
    ),
  ).rejects.toThrow();
});
