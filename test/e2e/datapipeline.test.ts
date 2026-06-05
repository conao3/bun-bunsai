import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ActivatePipelineCommand,
  AddTagsCommand,
  CreatePipelineCommand,
  DataPipelineClient,
  DeactivatePipelineCommand,
  DeletePipelineCommand,
  DescribeObjectsCommand,
  DescribePipelinesCommand,
  EvaluateExpressionCommand,
  GetPipelineDefinitionCommand,
  ListPipelinesCommand,
  PollForTaskCommand,
  PutPipelineDefinitionCommand,
  QueryObjectsCommand,
  RemoveTagsCommand,
  ReportTaskProgressCommand,
  ReportTaskRunnerHeartbeatCommand,
  SetStatusCommand,
  SetTaskStatusCommand,
  ValidatePipelineDefinitionCommand,
} from "@aws-sdk/client-data-pipeline";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const datapipeline = () =>
  new DataPipelineClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Data Pipeline lifecycle", async () => {
  const client = datapipeline();
  const name = "bunsai-e2e-pipeline";
  const uniqueId = "bunsai-e2e-unique";

  const created = await client.send(
    new CreatePipelineCommand({
      name,
      uniqueId,
      description: "bunsai e2e pipeline",
    }),
  );
  const pipelineId = created.pipelineId;
  expect(typeof pipelineId).toBe("string");

  const listed = await client.send(new ListPipelinesCommand({}));
  const ids = (listed.pipelineIdList ?? []).map((p) => p.id);
  expect(ids).toContain(pipelineId);

  const described = await client.send(
    new DescribePipelinesCommand({ pipelineIds: [pipelineId as string] }),
  );
  const descriptions = described.pipelineDescriptionList ?? [];
  expect(descriptions.length).toBe(1);
  expect(descriptions[0]?.pipelineId).toBe(pipelineId);
  expect(descriptions[0]?.name).toBe(name);

  await client.send(
    new DeletePipelineCommand({ pipelineId: pipelineId as string }),
  );

  const afterDelete = await client.send(new ListPipelinesCommand({}));
  const afterIds = (afterDelete.pipelineIdList ?? []).map((p) => p.id);
  expect(afterIds).not.toContain(pipelineId);
});

test("PutPipelineDefinition and GetPipelineDefinition", async () => {
  const client = datapipeline();
  const { pipelineId } = await client.send(
    new CreatePipelineCommand({
      name: "def-pipeline",
      uniqueId: "def-unique-1",
    }),
  );
  expect(typeof pipelineId).toBe("string");

  const putResult = await client.send(
    new PutPipelineDefinitionCommand({
      pipelineId: pipelineId as string,
      pipelineObjects: [
        {
          id: "Default",
          name: "Default",
          fields: [{ key: "workerGroup", stringValue: "myGroup" }],
        },
      ],
    }),
  );
  expect(putResult.errored).toBe(false);

  const getResult = await client.send(
    new GetPipelineDefinitionCommand({ pipelineId: pipelineId as string }),
  );
  expect((getResult.pipelineObjects ?? []).length).toBe(1);
  expect(getResult.pipelineObjects?.[0]?.id).toBe("Default");

  await client.send(
    new DeletePipelineCommand({ pipelineId: pipelineId as string }),
  );
});

test("ValidatePipelineDefinition", async () => {
  const client = datapipeline();
  const { pipelineId } = await client.send(
    new CreatePipelineCommand({
      name: "validate-pipeline",
      uniqueId: "validate-unique-1",
    }),
  );

  const result = await client.send(
    new ValidatePipelineDefinitionCommand({
      pipelineId: pipelineId as string,
      pipelineObjects: [
        {
          id: "Default",
          name: "Default",
          fields: [],
        },
      ],
    }),
  );
  expect(result.errored).toBe(false);

  await client.send(
    new DeletePipelineCommand({ pipelineId: pipelineId as string }),
  );
});

test("ActivatePipeline and DeactivatePipeline", async () => {
  const client = datapipeline();
  const { pipelineId } = await client.send(
    new CreatePipelineCommand({
      name: "activate-pipeline",
      uniqueId: "activate-unique-1",
    }),
  );

  await client.send(
    new ActivatePipelineCommand({ pipelineId: pipelineId as string }),
  );

  const afterActivate = await client.send(
    new DescribePipelinesCommand({ pipelineIds: [pipelineId as string] }),
  );
  const activateFields =
    afterActivate.pipelineDescriptionList?.[0]?.fields ?? [];
  const stateAfterActivate = activateFields.find(
    (f) => f.key === "@pipelineState",
  );
  expect(stateAfterActivate?.stringValue).toBe("SCHEDULED");

  await client.send(
    new DeactivatePipelineCommand({ pipelineId: pipelineId as string }),
  );

  const afterDeactivate = await client.send(
    new DescribePipelinesCommand({ pipelineIds: [pipelineId as string] }),
  );
  const deactivateFields =
    afterDeactivate.pipelineDescriptionList?.[0]?.fields ?? [];
  const stateAfterDeactivate = deactivateFields.find(
    (f) => f.key === "@pipelineState",
  );
  expect(stateAfterDeactivate?.stringValue).toBe("DEACTIVATING");

  await client.send(
    new DeletePipelineCommand({ pipelineId: pipelineId as string }),
  );
});

test("SetStatus", async () => {
  const client = datapipeline();
  const { pipelineId } = await client.send(
    new CreatePipelineCommand({
      name: "setstatus-pipeline",
      uniqueId: "setstatus-unique-1",
    }),
  );

  await client.send(
    new SetStatusCommand({
      pipelineId: pipelineId as string,
      objectIds: ["obj1"],
      status: "PAUSED",
    }),
  );

  await client.send(
    new DeletePipelineCommand({ pipelineId: pipelineId as string }),
  );
});

test("DescribeObjects and QueryObjects", async () => {
  const client = datapipeline();
  const { pipelineId } = await client.send(
    new CreatePipelineCommand({
      name: "objects-pipeline",
      uniqueId: "objects-unique-1",
    }),
  );

  await client.send(
    new PutPipelineDefinitionCommand({
      pipelineId: pipelineId as string,
      pipelineObjects: [
        {
          id: "obj1",
          name: "Object1",
          fields: [{ key: "type", stringValue: "Default" }],
        },
        {
          id: "obj2",
          name: "Object2",
          fields: [{ key: "type", stringValue: "Activity" }],
        },
      ],
    }),
  );

  const described = await client.send(
    new DescribeObjectsCommand({
      pipelineId: pipelineId as string,
      objectIds: ["obj1"],
    }),
  );
  expect((described.pipelineObjects ?? []).length).toBe(1);
  expect(described.pipelineObjects?.[0]?.id).toBe("obj1");

  const queried = await client.send(
    new QueryObjectsCommand({
      pipelineId: pipelineId as string,
      sphere: "INSTANCE",
    }),
  );
  expect((queried.ids ?? []).length).toBe(2);

  await client.send(
    new DeletePipelineCommand({ pipelineId: pipelineId as string }),
  );
});

test("EvaluateExpression", async () => {
  const client = datapipeline();
  const { pipelineId } = await client.send(
    new CreatePipelineCommand({
      name: "eval-pipeline",
      uniqueId: "eval-unique-1",
    }),
  );

  const result = await client.send(
    new EvaluateExpressionCommand({
      pipelineId: pipelineId as string,
      objectId: "myObject",
      expression: "#{myField}",
    }),
  );
  expect(typeof result.evaluatedExpression).toBe("string");

  await client.send(
    new DeletePipelineCommand({ pipelineId: pipelineId as string }),
  );
});

test("AddTags and RemoveTags", async () => {
  const client = datapipeline();
  const { pipelineId } = await client.send(
    new CreatePipelineCommand({
      name: "tags-pipeline",
      uniqueId: "tags-unique-1",
    }),
  );

  await client.send(
    new AddTagsCommand({
      pipelineId: pipelineId as string,
      tags: [
        { key: "env", value: "test" },
        { key: "team", value: "infra" },
      ],
    }),
  );

  await client.send(
    new RemoveTagsCommand({
      pipelineId: pipelineId as string,
      tagKeys: ["team"],
    }),
  );

  await client.send(
    new DeletePipelineCommand({ pipelineId: pipelineId as string }),
  );
});

test("PollForTask", async () => {
  const client = datapipeline();
  const result = await client.send(
    new PollForTaskCommand({ workerGroup: "myGroup" }),
  );
  expect(result.taskObject).toBeUndefined();
});

test("ReportTaskProgress", async () => {
  const client = datapipeline();
  const result = await client.send(
    new ReportTaskProgressCommand({ taskId: "fake-task-id" }),
  );
  expect(result.canceled).toBe(false);
});

test("ReportTaskRunnerHeartbeat", async () => {
  const client = datapipeline();
  const result = await client.send(
    new ReportTaskRunnerHeartbeatCommand({ taskrunnerId: "my-runner" }),
  );
  expect(result.terminate).toBe(false);
});

test("SetTaskStatus", async () => {
  const client = datapipeline();
  await client.send(
    new SetTaskStatusCommand({
      taskId: "fake-task-id",
      taskStatus: "FINISHED",
    }),
  );
});
