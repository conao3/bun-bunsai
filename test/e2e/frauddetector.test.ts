import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  BatchCreateVariableCommand,
  BatchGetVariableCommand,
  CancelBatchImportJobCommand,
  CancelBatchPredictionJobCommand,
  CreateBatchImportJobCommand,
  CreateBatchPredictionJobCommand,
  CreateDetectorVersionCommand,
  CreateListCommand,
  CreateModelCommand,
  CreateModelVersionCommand,
  CreateRuleCommand,
  CreateVariableCommand,
  DeleteBatchImportJobCommand,
  DeleteBatchPredictionJobCommand,
  DeleteDetectorCommand,
  DeleteDetectorVersionCommand,
  DeleteEntityTypeCommand,
  DeleteEventTypeCommand,
  DeleteLabelCommand,
  DeleteListCommand,
  DeleteModelCommand,
  DeleteModelVersionCommand,
  DeleteOutcomeCommand,
  DeleteRuleCommand,
  DeleteVariableCommand,
  DescribeDetectorCommand,
  FraudDetectorClient,
  GetBatchImportJobsCommand,
  GetBatchPredictionJobsCommand,
  GetDetectorVersionCommand,
  GetDetectorsCommand,
  GetEntityTypesCommand,
  GetEventTypesCommand,
  GetKMSEncryptionKeyCommand,
  GetLabelsCommand,
  GetListElementsCommand,
  GetListsMetadataCommand,
  GetModelVersionCommand,
  GetModelsCommand,
  GetOutcomesCommand,
  GetRulesCommand,
  GetVariablesCommand,
  ListTagsForResourceCommand,
  PutDetectorCommand,
  PutEntityTypeCommand,
  PutEventTypeCommand,
  PutKMSEncryptionKeyCommand,
  PutLabelCommand,
  PutOutcomeCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateDetectorVersionMetadataCommand,
  UpdateDetectorVersionStatusCommand,
  UpdateListCommand,
  UpdateModelVersionStatusCommand,
  UpdateRuleMetadataCommand,
  UpdateVariableCommand,
} from "@aws-sdk/client-frauddetector";
import { NodeHttpHandler } from "@smithy/node-http-handler";

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

const frauddetector = () =>
  new FraudDetectorClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("FraudDetector detector lifecycle", async () => {
  const client = frauddetector();
  const detectorId = "bunsai-e2e-detector";
  const eventTypeName = "bunsai-e2e-event";

  await client.send(
    new PutDetectorCommand({
      detectorId,
      eventTypeName,
      description: "bunsai e2e detector",
    }),
  );

  const listed = await client.send(new GetDetectorsCommand({ detectorId }));
  expect(
    (listed.detectors ?? []).some((d) => d.detectorId === detectorId),
  ).toBe(true);
  expect(
    (listed.detectors ?? []).find((d) => d.detectorId === detectorId)
      ?.eventTypeName,
  ).toBe(eventTypeName);

  await client.send(new DeleteDetectorCommand({ detectorId }));

  const afterDelete = await client.send(new GetDetectorsCommand({}));
  expect(
    (afterDelete.detectors ?? []).some((d) => d.detectorId === detectorId),
  ).toBe(false);
});

test("FraudDetector variable lifecycle", async () => {
  const client = frauddetector();
  const name = "e2e-var";

  await client.send(
    new CreateVariableCommand({
      name,
      dataType: "STRING",
      dataSource: "EVENT",
      defaultValue: "unknown",
      description: "e2e variable",
    }),
  );

  const listed = await client.send(new GetVariablesCommand({ name }));
  expect((listed.variables ?? []).some((v) => v.name === name)).toBe(true);
  expect((listed.variables ?? []).find((v) => v.name === name)?.dataType).toBe(
    "STRING",
  );

  await client.send(
    new UpdateVariableCommand({ name, defaultValue: "updated" }),
  );
  const updated = await client.send(new GetVariablesCommand({ name }));
  expect(
    (updated.variables ?? []).find((v) => v.name === name)?.defaultValue,
  ).toBe("updated");

  await client.send(new DeleteVariableCommand({ name }));
  const afterDelete = await client.send(new GetVariablesCommand({}));
  expect((afterDelete.variables ?? []).some((v) => v.name === name)).toBe(
    false,
  );
});

test("FraudDetector batch variable operations", async () => {
  const client = frauddetector();

  const batchResult = await client.send(
    new BatchCreateVariableCommand({
      variableEntries: [
        {
          name: "bv1",
          dataType: "STRING",
          dataSource: "EVENT",
          defaultValue: "x",
        },
        {
          name: "bv2",
          dataType: "INTEGER",
          dataSource: "MODEL_SCORE",
          defaultValue: "0",
        },
      ],
    }),
  );
  expect((batchResult.errors ?? []).length).toBe(0);

  const getResult = await client.send(
    new BatchGetVariableCommand({ names: ["bv1", "bv2", "missing"] }),
  );
  expect((getResult.variables ?? []).length).toBe(2);
  expect((getResult.errors ?? []).length).toBe(1);

  await client.send(new DeleteVariableCommand({ name: "bv1" }));
  await client.send(new DeleteVariableCommand({ name: "bv2" }));
});

test("FraudDetector Put/Get/Delete entity-type, event-type, label, outcome", async () => {
  const client = frauddetector();

  await client.send(
    new PutEntityTypeCommand({ name: "e2e-entity", description: "ent" }),
  );
  const entities = await client.send(
    new GetEntityTypesCommand({ name: "e2e-entity" }),
  );
  expect(
    (entities.entityTypes ?? []).some((e) => e.name === "e2e-entity"),
  ).toBe(true);

  await client.send(
    new PutEventTypeCommand({
      name: "e2e-evtype",
      eventVariables: ["ip"],
      entityTypes: ["e2e-entity"],
    }),
  );
  const evTypes = await client.send(
    new GetEventTypesCommand({ name: "e2e-evtype" }),
  );
  expect((evTypes.eventTypes ?? []).some((e) => e.name === "e2e-evtype")).toBe(
    true,
  );

  await client.send(
    new PutLabelCommand({ name: "e2e-label", description: "lbl" }),
  );
  const labels = await client.send(new GetLabelsCommand({ name: "e2e-label" }));
  expect((labels.labels ?? []).some((l) => l.name === "e2e-label")).toBe(true);

  await client.send(
    new PutOutcomeCommand({ name: "e2e-outcome", description: "out" }),
  );
  const outcomes = await client.send(
    new GetOutcomesCommand({ name: "e2e-outcome" }),
  );
  expect((outcomes.outcomes ?? []).some((o) => o.name === "e2e-outcome")).toBe(
    true,
  );

  await client.send(new DeleteLabelCommand({ name: "e2e-label" }));
  await client.send(new DeleteOutcomeCommand({ name: "e2e-outcome" }));
  await client.send(new DeleteEventTypeCommand({ name: "e2e-evtype" }));
  await client.send(new DeleteEntityTypeCommand({ name: "e2e-entity" }));
});

test("FraudDetector detector-version lifecycle", async () => {
  const client = frauddetector();
  const detectorId = "e2e-dv-detector";

  await client.send(
    new PutDetectorCommand({ detectorId, eventTypeName: "e2e-ev" }),
  );

  const created = await client.send(
    new CreateDetectorVersionCommand({ detectorId, rules: [] }),
  );
  const versionId = created.detectorVersionId ?? "1";
  expect(created.status).toBe("DRAFT");

  const got = await client.send(
    new GetDetectorVersionCommand({ detectorId, detectorVersionId: versionId }),
  );
  expect(got.detectorId).toBe(detectorId);
  expect(got.status).toBe("DRAFT");

  await client.send(
    new UpdateDetectorVersionMetadataCommand({
      detectorId,
      detectorVersionId: versionId,
      description: "updated",
    }),
  );

  await client.send(
    new UpdateDetectorVersionStatusCommand({
      detectorId,
      detectorVersionId: versionId,
      status: "ACTIVE",
    }),
  );

  const desc = await client.send(new DescribeDetectorCommand({ detectorId }));
  const summary = (desc.detectorVersionSummaries ?? []).find(
    (s) => s.detectorVersionId === versionId,
  );
  expect(summary?.status).toBe("ACTIVE");

  await client.send(
    new DeleteDetectorVersionCommand({
      detectorId,
      detectorVersionId: versionId,
    }),
  );
  await client.send(new DeleteDetectorCommand({ detectorId }));
});

test("FraudDetector model and model-version lifecycle", async () => {
  const client = frauddetector();
  const modelId = "e2e-model";
  const modelType = "ONLINE_FRAUD_INSIGHTS";

  await client.send(
    new CreateModelCommand({ modelId, modelType, eventTypeName: "e2e-ev" }),
  );

  const models = await client.send(
    new GetModelsCommand({ modelId, modelType }),
  );
  expect((models.models ?? []).some((m) => m.modelId === modelId)).toBe(true);

  const mvResult = await client.send(
    new CreateModelVersionCommand({
      modelId,
      modelType,
      trainingDataSource: "EXTERNAL_EVENTS",
      trainingDataSchema: {
        modelVariables: ["ip"],
        labelSchema: { labelMapper: {} },
      },
    }),
  );
  const mvNumber = mvResult.modelVersionNumber ?? "1.00";

  const gotMv = await client.send(
    new GetModelVersionCommand({
      modelId,
      modelType,
      modelVersionNumber: mvNumber,
    }),
  );
  expect(gotMv.modelId).toBe(modelId);
  expect(gotMv.status).toBe("TRAINING_IN_PROGRESS");

  await client.send(
    new UpdateModelVersionStatusCommand({
      modelId,
      modelType,
      modelVersionNumber: mvNumber,
      status: "ACTIVE",
    }),
  );

  await client.send(
    new DeleteModelVersionCommand({
      modelId,
      modelType,
      modelVersionNumber: mvNumber,
    }),
  );
  await client.send(new DeleteModelCommand({ modelId, modelType }));
});

test("FraudDetector rule lifecycle", async () => {
  const client = frauddetector();
  const detectorId = "e2e-rule-detector";

  await client.send(
    new PutDetectorCommand({ detectorId, eventTypeName: "e2e-ev" }),
  );

  const ruleResult = await client.send(
    new CreateRuleCommand({
      ruleId: "e2e-rule",
      detectorId,
      expression: "$ip == 'bad'",
      language: "DETECTORPL",
      outcomes: ["block"],
    }),
  );
  const ruleVersion = ruleResult.rule?.ruleVersion ?? "1";

  const rules = await client.send(new GetRulesCommand({ detectorId }));
  expect((rules.ruleDetails ?? []).some((r) => r.ruleId === "e2e-rule")).toBe(
    true,
  );

  await client.send(
    new UpdateRuleMetadataCommand({
      rule: { detectorId, ruleId: "e2e-rule", ruleVersion },
      description: "updated rule",
    }),
  );

  await client.send(
    new DeleteRuleCommand({
      rule: { detectorId, ruleId: "e2e-rule", ruleVersion },
    }),
  );
  await client.send(new DeleteDetectorCommand({ detectorId }));
});

test("FraudDetector list lifecycle", async () => {
  const client = frauddetector();
  const name = "e2e-list";

  await client.send(
    new CreateListCommand({
      name,
      elements: ["a", "b", "c"],
      variableType: "STRING",
    }),
  );

  const meta = await client.send(new GetListsMetadataCommand({ name }));
  expect((meta.lists ?? []).some((l) => l.name === name)).toBe(true);

  const elements = await client.send(new GetListElementsCommand({ name }));
  expect((elements.elements ?? []).length).toBe(3);

  await client.send(
    new UpdateListCommand({ name, elements: ["d"], updateMode: "APPEND" }),
  );
  const afterAppend = await client.send(new GetListElementsCommand({ name }));
  expect((afterAppend.elements ?? []).length).toBe(4);

  await client.send(new DeleteListCommand({ name }));
  const afterDelete = await client.send(new GetListsMetadataCommand({}));
  expect((afterDelete.lists ?? []).some((l) => l.name === name)).toBe(false);
});

test("FraudDetector tags lifecycle", async () => {
  const client = frauddetector();
  const detectorId = "e2e-tags-detector";

  await client.send(
    new PutDetectorCommand({ detectorId, eventTypeName: "e2e-ev" }),
  );

  const detectors = await client.send(new GetDetectorsCommand({ detectorId }));
  const arn = (detectors.detectors ?? [])[0]?.arn ?? "";
  expect(arn).toContain("frauddetector");

  await client.send(
    new TagResourceCommand({
      resourceARN: arn,
      tags: [{ key: "env", value: "test" }],
    }),
  );
  const tags1 = await client.send(
    new ListTagsForResourceCommand({ resourceARN: arn }),
  );
  expect(
    (tags1.tags ?? []).some((t) => t.key === "env" && t.value === "test"),
  ).toBe(true);

  await client.send(
    new UntagResourceCommand({ resourceARN: arn, tagKeys: ["env"] }),
  );
  const tags2 = await client.send(
    new ListTagsForResourceCommand({ resourceARN: arn }),
  );
  expect((tags2.tags ?? []).some((t) => t.key === "env")).toBe(false);

  await client.send(new DeleteDetectorCommand({ detectorId }));
});

test("FraudDetector KMS encryption key", async () => {
  const client = frauddetector();
  const kmsArn = "arn:aws:kms:us-east-1:123456789012:key/test-key-id";

  await client.send(
    new PutKMSEncryptionKeyCommand({ kmsEncryptionKeyArn: kmsArn }),
  );
  const result = await client.send(new GetKMSEncryptionKeyCommand({}));
  expect(result.kmsKey?.kmsEncryptionKeyArn).toBe(kmsArn);
});

test("FraudDetector batch import/prediction job lifecycle", async () => {
  const client = frauddetector();

  await client.send(
    new CreateBatchImportJobCommand({
      jobId: "e2e-import-job",
      inputPath: "s3://bucket/input.csv",
      outputPath: "s3://bucket/output/",
      eventTypeName: "e2e-ev",
      iamRoleArn: "arn:aws:iam::123456789012:role/FraudDetectorRole",
    }),
  );

  const importJobs = await client.send(
    new GetBatchImportJobsCommand({ jobId: "e2e-import-job" }),
  );
  expect(
    (importJobs.batchImports ?? []).some((j) => j.jobId === "e2e-import-job"),
  ).toBe(true);

  await client.send(
    new CancelBatchImportJobCommand({ jobId: "e2e-import-job" }),
  );
  await client.send(
    new DeleteBatchImportJobCommand({ jobId: "e2e-import-job" }),
  );

  await client.send(
    new CreateBatchPredictionJobCommand({
      jobId: "e2e-pred-job",
      inputPath: "s3://bucket/input.csv",
      outputPath: "s3://bucket/output/",
      eventTypeName: "e2e-ev",
      detectorName: "my-detector",
      iamRoleArn: "arn:aws:iam::123456789012:role/FraudDetectorRole",
    }),
  );

  const predJobs = await client.send(
    new GetBatchPredictionJobsCommand({ jobId: "e2e-pred-job" }),
  );
  expect(
    (predJobs.batchPredictions ?? []).some((j) => j.jobId === "e2e-pred-job"),
  ).toBe(true);

  await client.send(
    new CancelBatchPredictionJobCommand({ jobId: "e2e-pred-job" }),
  );
  await client.send(
    new DeleteBatchPredictionJobCommand({ jobId: "e2e-pred-job" }),
  );
});
