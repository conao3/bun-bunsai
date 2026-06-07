import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTriggerCommand,
  CreateWorkflowCommand,
  GetTagsCommand,
  GetTriggerCommand,
  GlueClient,
  StartTriggerCommand,
  StartWorkflowRunCommand,
  StopTriggerCommand,
  StopWorkflowRunCommand,
  TagResourceCommand,
} from "@aws-sdk/client-glue";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new GlueClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

test("StartTrigger on missing trigger throws EntityNotFoundException", async () => {
  await expect(
    client.send(new StartTriggerCommand({ Name: "no-such-trigger-con1693" })),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});

test("StopTrigger on missing trigger throws EntityNotFoundException", async () => {
  await expect(
    client.send(new StopTriggerCommand({ Name: "no-such-trigger-con1693" })),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});

test("trigger lifecycle: create -> StartTrigger (ACTIVATED) -> StopTrigger (DEACTIVATED)", async () => {
  const triggerName = "e2e_trigger_con1693";

  await client.send(
    new CreateTriggerCommand({
      Name: triggerName,
      Type: "ON_DEMAND",
      Actions: [{ JobName: "some-job" }],
    }),
  );

  const before = await client.send(
    new GetTriggerCommand({ Name: triggerName }),
  );
  expect(before.Trigger?.State).toBe("CREATED");

  const startResult = await client.send(
    new StartTriggerCommand({ Name: triggerName }),
  );
  expect(startResult.Name).toBe(triggerName);

  const activated = await client.send(
    new GetTriggerCommand({ Name: triggerName }),
  );
  expect(activated.Trigger?.State).toBe("ACTIVATED");

  const stopResult = await client.send(
    new StopTriggerCommand({ Name: triggerName }),
  );
  expect(stopResult.Name).toBe(triggerName);

  const deactivated = await client.send(
    new GetTriggerCommand({ Name: triggerName }),
  );
  expect(deactivated.Trigger?.State).toBe("DEACTIVATED");
});

test("StartWorkflowRun on missing workflow throws EntityNotFoundException", async () => {
  await expect(
    client.send(
      new StartWorkflowRunCommand({ Name: "no-such-workflow-con1693" }),
    ),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});

test("StartWorkflowRun -> StopWorkflowRun lifecycle", async () => {
  const wfName = "e2e_workflow_con1693";

  await client.send(new CreateWorkflowCommand({ Name: wfName }));

  const runResult = await client.send(
    new StartWorkflowRunCommand({ Name: wfName }),
  );
  expect(typeof runResult.RunId).toBe("string");
  expect(runResult.RunId!.length).toBeGreaterThan(0);

  await client.send(
    new StopWorkflowRunCommand({ Name: wfName, RunId: runResult.RunId! }),
  );
});

test("TagResource -> GetTags round-trip", async () => {
  const arn = "arn:aws:glue:us-east-1:123456789012:trigger/e2e_trigger_con1693";

  const beforeTags = await client.send(
    new GetTagsCommand({ ResourceArn: arn }),
  );
  const initialTagCount = Object.keys(beforeTags.Tags ?? {}).length;

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      TagsToAdd: { env: "test", owner: "con1693" },
    }),
  );

  const afterTags = await client.send(new GetTagsCommand({ ResourceArn: arn }));
  expect(afterTags.Tags?.["env"]).toBe("test");
  expect(afterTags.Tags?.["owner"]).toBe("con1693");
  expect(Object.keys(afterTags.Tags ?? {}).length).toBe(initialTagCount + 2);

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      TagsToAdd: { env: "prod" },
    }),
  );

  const merged = await client.send(new GetTagsCommand({ ResourceArn: arn }));
  expect(merged.Tags?.["env"]).toBe("prod");
  expect(merged.Tags?.["owner"]).toBe("con1693");
});
