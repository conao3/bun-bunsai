import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateAlarmModelCommand,
  CreateDetectorModelCommand,
  CreateInputCommand,
  DeleteAlarmModelCommand,
  DeleteDetectorModelCommand,
  DeleteInputCommand,
  DescribeAlarmModelCommand,
  DescribeDetectorModelAnalysisCommand,
  DescribeDetectorModelCommand,
  DescribeInputCommand,
  DescribeLoggingOptionsCommand,
  GetDetectorModelAnalysisResultsCommand,
  IoTEventsClient,
  ListAlarmModelVersionsCommand,
  ListAlarmModelsCommand,
  ListDetectorModelVersionsCommand,
  ListDetectorModelsCommand,
  ListInputsCommand,
  ListTagsForResourceCommand,
  PutLoggingOptionsCommand,
  StartDetectorModelAnalysisCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateAlarmModelCommand,
  UpdateDetectorModelCommand,
  UpdateInputCommand,
} from "@aws-sdk/client-iot-events";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iotevents = () =>
  new IoTEventsClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("IoT Events input roundtrip", async () => {
  const client = iotevents();
  const inputName = `bunsai_e2e_${Date.now()}`;

  const created = await client.send(
    new CreateInputCommand({
      inputName,
      inputDescription: "created by bunsai",
      inputDefinition: {
        attributes: [{ jsonPath: "temperature" }, { jsonPath: "humidity" }],
      },
    }),
  );
  expect(created.inputConfiguration?.inputName).toBe(inputName);
  expect(created.inputConfiguration?.inputArn).toContain(`input/${inputName}`);
  expect(created.inputConfiguration?.status).toBe("ACTIVE");

  const described = await client.send(new DescribeInputCommand({ inputName }));
  expect(described.input?.inputConfiguration?.inputName).toBe(inputName);
  expect(described.input?.inputConfiguration?.status).toBe("ACTIVE");

  const listed = await client.send(new ListInputsCommand({}));
  expect(
    (listed.inputSummaries ?? []).map((summary) => summary.inputName),
  ).toContain(inputName);

  await client.send(new DeleteInputCommand({ inputName }));

  await expect(
    client.send(new DescribeInputCommand({ inputName })),
  ).rejects.toThrow();
});

test("IoT Events UpdateInput roundtrip", async () => {
  const client = iotevents();
  const inputName = `bunsai_e2e_update_${Date.now()}`;

  await client.send(
    new CreateInputCommand({
      inputName,
      inputDefinition: {
        attributes: [{ jsonPath: "temperature" }],
      },
    }),
  );

  const updated = await client.send(
    new UpdateInputCommand({
      inputName,
      inputDescription: "updated description",
      inputDefinition: {
        attributes: [{ jsonPath: "temperature" }, { jsonPath: "pressure" }],
      },
    }),
  );
  expect(updated.inputConfiguration?.inputName).toBe(inputName);
  expect(updated.inputConfiguration?.inputDescription).toBe(
    "updated description",
  );

  await client.send(new DeleteInputCommand({ inputName }));
});

test("IoT Events detector model roundtrip", async () => {
  const client = iotevents();
  const detectorModelName = `bunsai_e2e_dm_${Date.now()}`;

  const simpleDefinition = {
    states: [
      {
        stateName: "idle",
        onInput: { events: [], transitionEvents: [] },
        onEnter: { events: [] },
        onExit: { events: [] },
      },
    ],
    initialStateName: "idle",
  };

  const created = await client.send(
    new CreateDetectorModelCommand({
      detectorModelName,
      detectorModelDescription: "bunsai e2e detector model",
      detectorModelDefinition: simpleDefinition,
      roleArn: "arn:aws:iam::123456789012:role/test-role",
      evaluationMethod: "BATCH",
    }),
  );
  expect(created.detectorModelConfiguration?.detectorModelName).toBe(
    detectorModelName,
  );
  expect(created.detectorModelConfiguration?.detectorModelVersion).toBe("1");
  expect(created.detectorModelConfiguration?.status).toBe("ACTIVE");

  const described = await client.send(
    new DescribeDetectorModelCommand({ detectorModelName }),
  );
  expect(
    described.detectorModel?.detectorModelConfiguration?.detectorModelName,
  ).toBe(detectorModelName);
  expect(
    described.detectorModel?.detectorModelConfiguration
      ?.detectorModelDescription,
  ).toBe("bunsai e2e detector model");

  const listed = await client.send(new ListDetectorModelsCommand({}));
  expect(
    (listed.detectorModelSummaries ?? []).map((s) => s.detectorModelName),
  ).toContain(detectorModelName);

  const updated = await client.send(
    new UpdateDetectorModelCommand({
      detectorModelName,
      detectorModelDefinition: simpleDefinition,
      roleArn: "arn:aws:iam::123456789012:role/test-role",
    }),
  );
  expect(updated.detectorModelConfiguration?.detectorModelVersion).toBe("2");

  const versions = await client.send(
    new ListDetectorModelVersionsCommand({ detectorModelName }),
  );
  expect(versions.detectorModelVersionSummaries?.length).toBe(2);

  await client.send(new DeleteDetectorModelCommand({ detectorModelName }));

  await expect(
    client.send(new DescribeDetectorModelCommand({ detectorModelName })),
  ).rejects.toThrow();
});

test("IoT Events alarm model roundtrip", async () => {
  const client = iotevents();
  const alarmModelName = `bunsai_e2e_am_${Date.now()}`;

  const alarmRule = {
    simpleRule: {
      inputProperty: "temperature",
      comparisonOperator: "GREATER",
      threshold: "30",
    },
  };

  const created = await client.send(
    new CreateAlarmModelCommand({
      alarmModelName,
      alarmModelDescription: "bunsai e2e alarm model",
      roleArn: "arn:aws:iam::123456789012:role/test-role",
      alarmRule,
    }),
  );
  expect(created.alarmModelArn).toContain(`alarmModel/${alarmModelName}`);
  expect(created.alarmModelVersion).toBe("1");
  expect(created.status).toBe("ACTIVE");

  const described = await client.send(
    new DescribeAlarmModelCommand({ alarmModelName }),
  );
  expect(described.alarmModelName).toBe(alarmModelName);
  expect(described.alarmModelDescription).toBe("bunsai e2e alarm model");
  expect(described.alarmModelVersion).toBe("1");

  const listed = await client.send(new ListAlarmModelsCommand({}));
  expect(
    (listed.alarmModelSummaries ?? []).map((s) => s.alarmModelName),
  ).toContain(alarmModelName);

  const updated = await client.send(
    new UpdateAlarmModelCommand({
      alarmModelName,
      roleArn: "arn:aws:iam::123456789012:role/test-role",
      alarmRule,
    }),
  );
  expect(updated.alarmModelVersion).toBe("2");

  const versions = await client.send(
    new ListAlarmModelVersionsCommand({ alarmModelName }),
  );
  expect(versions.alarmModelVersionSummaries?.length).toBe(2);

  await client.send(new DeleteAlarmModelCommand({ alarmModelName }));

  await expect(
    client.send(new DescribeAlarmModelCommand({ alarmModelName })),
  ).rejects.toThrow();
});

test("IoT Events detector model analysis roundtrip", async () => {
  const client = iotevents();

  const simpleDefinition = {
    states: [
      {
        stateName: "idle",
        onInput: { events: [], transitionEvents: [] },
        onEnter: { events: [] },
        onExit: { events: [] },
      },
    ],
    initialStateName: "idle",
  };

  const started = await client.send(
    new StartDetectorModelAnalysisCommand({
      detectorModelDefinition: simpleDefinition,
    }),
  );
  expect(started.analysisId).toBeDefined();
  const analysisId = started.analysisId ?? "";

  const described = await client.send(
    new DescribeDetectorModelAnalysisCommand({ analysisId }),
  );
  expect(described.status).toBe("COMPLETE");

  const results = await client.send(
    new GetDetectorModelAnalysisResultsCommand({ analysisId }),
  );
  expect(results.analysisResults).toBeDefined();
});

test("IoT Events logging options roundtrip", async () => {
  const client = iotevents();

  await client.send(
    new PutLoggingOptionsCommand({
      loggingOptions: {
        roleArn: "arn:aws:iam::123456789012:role/test-role",
        level: "ERROR",
        enabled: true,
      },
    }),
  );

  const described = await client.send(new DescribeLoggingOptionsCommand({}));
  expect(described.loggingOptions?.roleArn).toBe(
    "arn:aws:iam::123456789012:role/test-role",
  );
  expect(described.loggingOptions?.level).toBe("ERROR");
  expect(described.loggingOptions?.enabled).toBe(true);
});

test("IoT Events tag operations roundtrip", async () => {
  const client = iotevents();
  const resourceArn =
    "arn:aws:iotevents:us-east-1:123456789012:detectorModel/test";

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: [
        { key: "env", value: "test" },
        { key: "owner", value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect((listed.tags ?? []).map((t) => t.key)).toContain("env");
  expect((listed.tags ?? []).map((t) => t.key)).toContain("owner");

  await client.send(
    new UntagResourceCommand({
      resourceArn,
      tagKeys: ["env"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect((afterUntag.tags ?? []).map((t) => t.key)).not.toContain("env");
  expect((afterUntag.tags ?? []).map((t) => t.key)).toContain("owner");
});
