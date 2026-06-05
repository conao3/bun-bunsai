import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  BatchDetectSentimentCommand,
  ClassifyDocumentCommand,
  ComprehendClient,
  ContainsPiiEntitiesCommand,
  CreateDatasetCommand,
  CreateDocumentClassifierCommand,
  CreateEndpointCommand,
  CreateEntityRecognizerCommand,
  CreateFlywheelCommand,
  DeleteEndpointCommand,
  DescribeDatasetCommand,
  DescribeDocumentClassificationJobCommand,
  DescribeDocumentClassifierCommand,
  DescribeEndpointCommand,
  DescribeEntityRecognizerCommand,
  DescribeFlywheelCommand,
  DescribeFlywheelIterationCommand,
  DescribeResourcePolicyCommand,
  DescribeSentimentDetectionJobCommand,
  DetectEntitiesCommand,
  DetectSentimentCommand,
  ListDatasetsCommand,
  ListDocumentClassifiersCommand,
  ListEndpointsCommand,
  ListFlywheelIterationHistoryCommand,
  ListFlywheelsCommand,
  ListTagsForResourceCommand,
  PutResourcePolicyCommand,
  StartDocumentClassificationJobCommand,
  StartFlywheelIterationCommand,
  StartSentimentDetectionJobCommand,
  StopSentimentDetectionJobCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-comprehend";

const { endpoint } = startServer();
const region = "us-east-1";
const account = "000000000000";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const comprehend = () =>
  new ComprehendClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Comprehend endpoint roundtrip", async () => {
  const client = comprehend();
  const endpointName = `bunsai-e2e-${Date.now()}`;
  const modelArn = `arn:aws:comprehend:${region}:${account}:document-classifier/bunsai-model`;

  const created = await client.send(
    new CreateEndpointCommand({
      EndpointName: endpointName,
      ModelArn: modelArn,
      DesiredInferenceUnits: 1,
    }),
  );
  expect(created.EndpointArn).toBeDefined();
  const endpointArn = created.EndpointArn ?? "";

  const described = await client.send(
    new DescribeEndpointCommand({ EndpointArn: endpointArn }),
  );
  expect(described.EndpointProperties?.EndpointArn).toBe(endpointArn);
  expect(described.EndpointProperties?.Status).toBe("IN_SERVICE");
  expect(described.EndpointProperties?.DesiredInferenceUnits).toBe(1);

  const listed = await client.send(new ListEndpointsCommand({}));
  expect(
    (listed.EndpointPropertiesList ?? []).map((e) => e.EndpointArn),
  ).toContain(endpointArn);

  await client.send(new DeleteEndpointCommand({ EndpointArn: endpointArn }));
  await expect(
    client.send(new DescribeEndpointCommand({ EndpointArn: endpointArn })),
  ).rejects.toThrow();
});

test("Comprehend real-time detect operations", async () => {
  const client = comprehend();

  const sentiment = await client.send(
    new DetectSentimentCommand({
      Text: "I love this product!",
      LanguageCode: "en",
    }),
  );
  expect(sentiment.Sentiment).toBeDefined();
  expect(sentiment.SentimentScore).toBeDefined();

  const entities = await client.send(
    new DetectEntitiesCommand({
      Text: "John works at AWS.",
      LanguageCode: "en",
    }),
  );
  expect(Array.isArray(entities.Entities)).toBe(true);

  const pii = await client.send(
    new ContainsPiiEntitiesCommand({
      Text: "My name is John.",
      LanguageCode: "en",
    }),
  );
  expect(Array.isArray(pii.Labels)).toBe(true);

  const classified = await client.send(
    new ClassifyDocumentCommand({
      Text: "This is a support request.",
      EndpointArn: `arn:aws:comprehend:${region}:${account}:document-classifier-endpoint/my-ep`,
    }),
  );
  expect(Array.isArray(classified.Classes)).toBe(true);

  const batch = await client.send(
    new BatchDetectSentimentCommand({
      TextList: ["I love it", "I hate it"],
      LanguageCode: "en",
    }),
  );
  expect(batch.ResultList).toHaveLength(2);
  expect(batch.ErrorList).toHaveLength(0);
});

test("Comprehend document classifier lifecycle", async () => {
  const client = comprehend();
  const name = `bunsai-dc-${Date.now()}`;

  const created = await client.send(
    new CreateDocumentClassifierCommand({
      DocumentClassifierName: name,
      LanguageCode: "en",
      DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
      InputDataConfig: { S3Uri: "s3://my-bucket/train/" },
    }),
  );
  expect(created.DocumentClassifierArn).toBeDefined();
  const classifierArn = created.DocumentClassifierArn ?? "";

  const described = await client.send(
    new DescribeDocumentClassifierCommand({
      DocumentClassifierArn: classifierArn,
    }),
  );
  expect(described.DocumentClassifierProperties?.DocumentClassifierArn).toBe(
    classifierArn,
  );
  expect(described.DocumentClassifierProperties?.Status).toBe("TRAINING");

  const listed = await client.send(new ListDocumentClassifiersCommand({}));
  expect(
    (listed.DocumentClassifierPropertiesList ?? []).map(
      (c) => c.DocumentClassifierArn,
    ),
  ).toContain(classifierArn);
});

test("Comprehend entity recognizer lifecycle", async () => {
  const client = comprehend();
  const name = `bunsai-er-${Date.now()}`;

  const created = await client.send(
    new CreateEntityRecognizerCommand({
      RecognizerName: name,
      LanguageCode: "en",
      DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
      InputDataConfig: {
        EntityTypes: [{ Type: "PERSON" }],
        Documents: { S3Uri: "s3://my-bucket/docs/" },
      },
    }),
  );
  expect(created.EntityRecognizerArn).toBeDefined();
  const recognizerArn = created.EntityRecognizerArn ?? "";

  const described = await client.send(
    new DescribeEntityRecognizerCommand({ EntityRecognizerArn: recognizerArn }),
  );
  expect(described.EntityRecognizerProperties?.EntityRecognizerArn).toBe(
    recognizerArn,
  );
  expect(described.EntityRecognizerProperties?.Status).toBe("TRAINING");
});

test("Comprehend flywheel lifecycle", async () => {
  const client = comprehend();
  const name = `bunsai-fw-${Date.now()}`;
  const modelArn = `arn:aws:comprehend:${region}:${account}:document-classifier/my-model`;

  const created = await client.send(
    new CreateFlywheelCommand({
      FlywheelName: name,
      ActiveModelArn: modelArn,
      DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
      DataLakeS3Uri: "s3://my-data-lake/",
    }),
  );
  expect(created.FlywheelArn).toBeDefined();
  const fwArn = created.FlywheelArn ?? "";

  const described = await client.send(
    new DescribeFlywheelCommand({ FlywheelArn: fwArn }),
  );
  expect(described.FlywheelProperties?.FlywheelArn).toBe(fwArn);
  expect(described.FlywheelProperties?.Status).toBe("ACTIVE");

  const listed = await client.send(new ListFlywheelsCommand({}));
  expect(
    (listed.FlywheelSummaryList ?? []).map((f) => f.FlywheelArn),
  ).toContain(fwArn);

  const iter = await client.send(
    new StartFlywheelIterationCommand({ FlywheelArn: fwArn }),
  );
  expect(iter.FlywheelIterationId).toBeDefined();
  const iterationId = iter.FlywheelIterationId ?? "";

  const iterDesc = await client.send(
    new DescribeFlywheelIterationCommand({
      FlywheelArn: fwArn,
      FlywheelIterationId: iterationId,
    }),
  );
  expect(iterDesc.FlywheelIterationProperties?.FlywheelIterationId).toBe(
    iterationId,
  );

  const iterHistory = await client.send(
    new ListFlywheelIterationHistoryCommand({ FlywheelArn: fwArn }),
  );
  expect(
    (iterHistory.FlywheelIterationPropertiesList ?? []).map(
      (i) => i.FlywheelIterationId,
    ),
  ).toContain(iterationId);

  const dsName = `bunsai-ds-${Date.now()}`;
  const dsCreated = await client.send(
    new CreateDatasetCommand({
      FlywheelArn: fwArn,
      DatasetName: dsName,
      DatasetType: "TRAIN",
      InputDataConfig: {
        AugmentedManifests: [],
        DataFormat: "COMPREHEND_CSV",
        DocumentClassifierInputDataConfig: { S3Uri: "s3://my-bucket/ds/" },
      },
    }),
  );
  expect(dsCreated.DatasetArn).toBeDefined();
  const dsArn = dsCreated.DatasetArn ?? "";

  const dsDesc = await client.send(
    new DescribeDatasetCommand({ DatasetArn: dsArn }),
  );
  expect(dsDesc.DatasetProperties?.DatasetArn).toBe(dsArn);

  const dsList = await client.send(
    new ListDatasetsCommand({ FlywheelArn: fwArn }),
  );
  expect(
    (dsList.DatasetPropertiesList ?? []).map((d) => d.DatasetArn),
  ).toContain(dsArn);
});

test("Comprehend async detection job lifecycle", async () => {
  const client = comprehend();

  const started = await client.send(
    new StartSentimentDetectionJobCommand({
      InputDataConfig: {
        S3Uri: "s3://my-bucket/input/",
        InputFormat: "ONE_DOC_PER_FILE",
      },
      OutputDataConfig: { S3Uri: "s3://my-bucket/output/" },
      DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
      LanguageCode: "en",
      JobName: "bunsai-sentiment-job",
    }),
  );
  expect(started.JobId).toBeDefined();
  const jobId = started.JobId ?? "";

  const described = await client.send(
    new DescribeSentimentDetectionJobCommand({ JobId: jobId }),
  );
  expect(described.SentimentDetectionJobProperties?.JobId).toBe(jobId);
  expect(described.SentimentDetectionJobProperties?.JobStatus).toBe(
    "SUBMITTED",
  );

  const stopped = await client.send(
    new StopSentimentDetectionJobCommand({ JobId: jobId }),
  );
  expect(stopped.JobStatus).toBe("STOP_REQUESTED");

  const classificationJob = await client.send(
    new StartDocumentClassificationJobCommand({
      InputDataConfig: {
        S3Uri: "s3://my-bucket/input/",
        InputFormat: "ONE_DOC_PER_FILE",
      },
      OutputDataConfig: { S3Uri: "s3://my-bucket/output/" },
      DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
    }),
  );
  expect(classificationJob.JobId).toBeDefined();
  const classJobId = classificationJob.JobId ?? "";

  const classJobDesc = await client.send(
    new DescribeDocumentClassificationJobCommand({ JobId: classJobId }),
  );
  expect(classJobDesc.DocumentClassificationJobProperties?.JobStatus).toBe(
    "SUBMITTED",
  );
});

test("Comprehend resource policy and tags", async () => {
  const client = comprehend();
  const resourceArn = `arn:aws:comprehend:${region}:${account}:document-classifier/my-classifier`;
  const policy = JSON.stringify({ Version: "2012-10-17", Statement: [] });

  const putResult = await client.send(
    new PutResourcePolicyCommand({
      ResourceArn: resourceArn,
      ResourcePolicy: policy,
    }),
  );
  expect(putResult.PolicyRevisionId).toBeDefined();

  const described = await client.send(
    new DescribeResourcePolicyCommand({ ResourceArn: resourceArn }),
  );
  expect(described.ResourcePolicy).toBe(policy);
  expect(described.PolicyRevisionId).toBeDefined();

  await client.send(
    new TagResourceCommand({
      ResourceArn: resourceArn,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );

  const tagged = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect((tagged.Tags ?? []).find((t) => t.Key === "env")?.Value).toBe("test");

  await client.send(
    new UntagResourceCommand({ ResourceArn: resourceArn, TagKeys: ["env"] }),
  );
  const untagged = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect((untagged.Tags ?? []).find((t) => t.Key === "env")).toBeUndefined();
});
