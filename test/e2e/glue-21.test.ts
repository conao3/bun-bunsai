import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDatabaseCommand,
  CreateTableCommand,
  CreateTriggerCommand,
  CreateWorkflowCommand,
  GetTableCommand,
  GetTriggerCommand,
  GetWorkflowCommand,
  GlueClient,
  UpdateTableCommand,
  UpdateTriggerCommand,
  UpdateWorkflowCommand,
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

test("UpdateTable → GetTable reflects update", async () => {
  await client.send(
    new CreateDatabaseCommand({
      DatabaseInput: { Name: "e2e_db_chunk21" },
    }),
  );

  await client.send(
    new CreateTableCommand({
      DatabaseName: "e2e_db_chunk21",
      TableInput: { Name: "e2e_table_chunk21", Description: "original" },
    }),
  );

  await client.send(
    new UpdateTableCommand({
      DatabaseName: "e2e_db_chunk21",
      TableInput: { Name: "e2e_table_chunk21", Description: "updated" },
    }),
  );

  const after = await client.send(
    new GetTableCommand({
      DatabaseName: "e2e_db_chunk21",
      Name: "e2e_table_chunk21",
    }),
  );
  expect(after.Table?.Name).toBe("e2e_table_chunk21");
  expect(after.Table?.Description).toBe("updated");
});

test("UpdateTable on missing table throws EntityNotFoundException", async () => {
  await expect(
    client.send(
      new UpdateTableCommand({
        DatabaseName: "e2e_db_chunk21",
        TableInput: { Name: "no-such-table-chunk21" },
      }),
    ),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});

test("UpdateTrigger → GetTrigger reflects update", async () => {
  await client.send(
    new CreateTriggerCommand({
      Name: "e2e_trigger_chunk21",
      Type: "SCHEDULED",
      Schedule: "cron(0 * * * ? *)",
      Actions: [{ JobName: "some-job" }],
    }),
  );

  const updated = await client.send(
    new UpdateTriggerCommand({
      Name: "e2e_trigger_chunk21",
      TriggerUpdate: {
        Schedule: "cron(30 * * * ? *)",
        Description: "updated trigger",
      },
    }),
  );
  expect(updated.Trigger?.Name).toBe("e2e_trigger_chunk21");

  const after = await client.send(
    new GetTriggerCommand({ Name: "e2e_trigger_chunk21" }),
  );
  expect(after.Trigger?.Name).toBe("e2e_trigger_chunk21");
  expect(after.Trigger?.Schedule).toBe("cron(30 * * * ? *)");
  expect(after.Trigger?.Description).toBe("updated trigger");
});

test("UpdateTrigger on missing trigger throws EntityNotFoundException", async () => {
  await expect(
    client.send(
      new UpdateTriggerCommand({
        Name: "no-such-trigger-chunk21",
        TriggerUpdate: {},
      }),
    ),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});

test("UpdateWorkflow → GetWorkflow reflects update", async () => {
  await client.send(
    new CreateWorkflowCommand({
      Name: "e2e_workflow_chunk21",
      Description: "original description",
    }),
  );

  const updated = await client.send(
    new UpdateWorkflowCommand({
      Name: "e2e_workflow_chunk21",
      Description: "updated description",
      MaxConcurrentRuns: 5,
    }),
  );
  expect(updated.Name).toBe("e2e_workflow_chunk21");

  const after = await client.send(
    new GetWorkflowCommand({ Name: "e2e_workflow_chunk21" }),
  );
  expect(after.Workflow?.Name).toBe("e2e_workflow_chunk21");
  expect(after.Workflow?.Description).toBe("updated description");
  expect(after.Workflow?.MaxConcurrentRuns).toBe(5);
});

test("UpdateWorkflow on missing workflow throws EntityNotFoundException", async () => {
  await expect(
    client.send(
      new UpdateWorkflowCommand({ Name: "no-such-workflow-chunk21" }),
    ),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});
