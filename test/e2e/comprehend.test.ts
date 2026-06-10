import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
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
  DeleteDocumentClassifierCommand,
  DeleteEndpointCommand,
  DeleteEntityRecognizerCommand,
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
  ListSentimentDetectionJobsCommand,
  ListTagsForResourceCommand,
  PutResourcePolicyCommand,
  StartDocumentClassificationJobCommand,
  StartEntitiesDetectionJobCommand,
  StartFlywheelIterationCommand,
  StartSentimentDetectionJobCommand,
  StopSentimentDetectionJobCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-comprehend";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const account = "000000000000";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const comprehend = () =>
  new ComprehendClient({
    endpoint,
    region,
    credentials,
    requestHandler,
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

  const described1 = await client.send(
    new DescribeEndpointCommand({ EndpointArn: endpointArn }),
  );
  expect(described1.EndpointProperties?.EndpointArn).toBe(endpointArn);
  expect(described1.EndpointProperties?.Status).toBe("CREATING");

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

  const described1 = await client.send(
    new DescribeFlywheelCommand({ FlywheelArn: fwArn }),
  );
  expect(described1.FlywheelProperties?.FlywheelArn).toBe(fwArn);
  expect(described1.FlywheelProperties?.Status).toBe("CREATING");

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

test("Comprehend job status lifecycle SUBMITTED→IN_PROGRESS→COMPLETED", async () => {
  const client = comprehend();

  const started = await client.send(
    new StartSentimentDetectionJobCommand({
      InputDataConfig: {
        S3Uri: "s3://my-bucket/lifecycle-input/",
        InputFormat: "ONE_DOC_PER_FILE",
      },
      OutputDataConfig: { S3Uri: "s3://my-bucket/lifecycle-output/" },
      DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
      LanguageCode: "en",
      JobName: "bunsai-lifecycle-job",
    }),
  );
  expect(started.JobId).toBeDefined();
  const jobId = started.JobId ?? "";

  const desc1 = await client.send(
    new DescribeSentimentDetectionJobCommand({ JobId: jobId }),
  );
  expect(desc1.SentimentDetectionJobProperties?.JobStatus).toBe("SUBMITTED");

  const desc2 = await client.send(
    new DescribeSentimentDetectionJobCommand({ JobId: jobId }),
  );
  expect(desc2.SentimentDetectionJobProperties?.JobStatus).toBe("IN_PROGRESS");

  const desc3 = await client.send(
    new DescribeSentimentDetectionJobCommand({ JobId: jobId }),
  );
  expect(desc3.SentimentDetectionJobProperties?.JobStatus).toBe("COMPLETED");
  expect(desc3.SentimentDetectionJobProperties?.EndTime).toBeDefined();
});

test("Comprehend endpoint CREATING→IN_SERVICE lifecycle", async () => {
  const client = comprehend();
  const endpointName = `bunsai-lifecycle-ep-${Date.now()}`;
  const modelArn = `arn:aws:comprehend:${region}:${account}:document-classifier/lifecycle-model`;

  const created = await client.send(
    new CreateEndpointCommand({
      EndpointName: endpointName,
      ModelArn: modelArn,
      DesiredInferenceUnits: 2,
    }),
  );
  const endpointArn = created.EndpointArn ?? "";

  const creating = await client.send(
    new DescribeEndpointCommand({ EndpointArn: endpointArn }),
  );
  expect(creating.EndpointProperties?.Status).toBe("CREATING");

  const inService = await client.send(
    new DescribeEndpointCommand({ EndpointArn: endpointArn }),
  );
  expect(inService.EndpointProperties?.Status).toBe("IN_SERVICE");
});

test("Comprehend List pagination with MaxResults and NextToken", async () => {
  const client = comprehend();

  for (let i = 0; i < 3; i++) {
    await client.send(
      new CreateDocumentClassifierCommand({
        DocumentClassifierName: `bunsai-paginate-dc-${Date.now()}-${i}`,
        LanguageCode: "en",
        DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
        InputDataConfig: { S3Uri: "s3://my-bucket/train/" },
      }),
    );
  }

  const page1 = await client.send(
    new ListDocumentClassifiersCommand({ MaxResults: 2 }),
  );
  expect(
    (page1.DocumentClassifierPropertiesList ?? []).length,
  ).toBeGreaterThanOrEqual(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new ListDocumentClassifiersCommand({
      MaxResults: 100,
      NextToken: page1.NextToken,
    }),
  );
  expect(
    (page2.DocumentClassifierPropertiesList ?? []).length,
  ).toBeGreaterThanOrEqual(1);

  const arns1 = (page1.DocumentClassifierPropertiesList ?? []).map(
    (c) => c.DocumentClassifierArn,
  );
  const arns2 = (page2.DocumentClassifierPropertiesList ?? []).map(
    (c) => c.DocumentClassifierArn,
  );
  expect(arns1.filter((a) => arns2.includes(a))).toHaveLength(0);

  const jobStarted = await client.send(
    new StartSentimentDetectionJobCommand({
      InputDataConfig: {
        S3Uri: "s3://my-bucket/pg-input/",
        InputFormat: "ONE_DOC_PER_FILE",
      },
      OutputDataConfig: { S3Uri: "s3://my-bucket/pg-output/" },
      DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
      LanguageCode: "en",
      JobName: "bunsai-pg-job-1",
    }),
  );
  await client.send(
    new StartSentimentDetectionJobCommand({
      InputDataConfig: {
        S3Uri: "s3://my-bucket/pg-input2/",
        InputFormat: "ONE_DOC_PER_FILE",
      },
      OutputDataConfig: { S3Uri: "s3://my-bucket/pg-output2/" },
      DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
      LanguageCode: "en",
      JobName: "bunsai-pg-job-2",
    }),
  );

  const jobPage1 = await client.send(
    new ListSentimentDetectionJobsCommand({ MaxResults: 1 }),
  );
  expect((jobPage1.SentimentDetectionJobPropertiesList ?? []).length).toBe(1);
  expect(jobPage1.NextToken).toBeDefined();

  const jobPage2 = await client.send(
    new ListSentimentDetectionJobsCommand({
      MaxResults: 10,
      NextToken: jobPage1.NextToken,
    }),
  );
  expect(
    (jobPage2.SentimentDetectionJobPropertiesList ?? []).length,
  ).toBeGreaterThanOrEqual(1);
  const jobIds1 = (jobPage1.SentimentDetectionJobPropertiesList ?? []).map(
    (j) => j.JobId,
  );
  const jobIds2 = (jobPage2.SentimentDetectionJobPropertiesList ?? []).map(
    (j) => j.JobId,
  );
  expect(jobIds1.filter((id) => jobIds2.includes(id))).toHaveLength(0);
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

test("Comprehend idempotency: CreateEndpoint same ClientRequestToken returns same ARN", async () => {
  const client = comprehend();
  const name = `bunsai-idem-ep-${Date.now()}`;
  const token = `token-ep-${Date.now()}`;

  const first = await client.send(
    new CreateEndpointCommand({
      EndpointName: name,
      DesiredInferenceUnits: 1,
      ClientRequestToken: token,
    }),
  );
  expect(first.EndpointArn).toBeDefined();

  const second = await client.send(
    new CreateEndpointCommand({
      EndpointName: name,
      DesiredInferenceUnits: 2,
      ClientRequestToken: token,
    }),
  );
  expect(second.EndpointArn).toBe(first.EndpointArn);
});

test("Comprehend idempotency: CreateFlywheel same ClientRequestToken returns same ARN", async () => {
  const client = comprehend();
  const name = `bunsai-idem-fw-${Date.now()}`;
  const token = `token-fw-${Date.now()}`;

  const first = await client.send(
    new CreateFlywheelCommand({
      FlywheelName: name,
      DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
      DataLakeS3Uri: "s3://my-data-lake/",
      ClientRequestToken: token,
    }),
  );
  expect(first.FlywheelArn).toBeDefined();

  const second = await client.send(
    new CreateFlywheelCommand({
      FlywheelName: name,
      DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
      DataLakeS3Uri: "s3://my-data-lake/",
      ClientRequestToken: token,
    }),
  );
  expect(second.FlywheelArn).toBe(first.FlywheelArn);
});

test("Comprehend idempotency: CreateDataset same ClientRequestToken returns same ARN", async () => {
  const client = comprehend();
  const fwName = `bunsai-idem-ds-fw-${Date.now()}`;
  const datasetName = `bunsai-idem-ds-${Date.now()}`;
  const token = `token-ds-${Date.now()}`;

  const fw = await client.send(
    new CreateFlywheelCommand({
      FlywheelName: fwName,
      DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
      DataLakeS3Uri: "s3://my-data-lake/",
    }),
  );
  const fwArn = fw.FlywheelArn ?? "";

  const dsInput = {
    FlywheelArn: fwArn,
    DatasetName: datasetName,
    DatasetType: "TRAIN" as const,
    InputDataConfig: {
      DataFormat: "COMPREHEND_CSV" as const,
      DocumentClassifierInputDataConfig: { S3Uri: "s3://my-bucket/ds/" },
    },
    ClientRequestToken: token,
  };

  const first = await client.send(new CreateDatasetCommand(dsInput));
  expect(first.DatasetArn).toBeDefined();

  const second = await client.send(new CreateDatasetCommand(dsInput));
  expect(second.DatasetArn).toBe(first.DatasetArn);
});

test("Comprehend delete state guard: DeleteDocumentClassifier rejects TRAINING status", async () => {
  const client = comprehend();
  const name = `bunsai-del-dc-${Date.now()}`;

  const created = await client.send(
    new CreateDocumentClassifierCommand({
      DocumentClassifierName: name,
      LanguageCode: "en",
      DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
      InputDataConfig: { S3Uri: "s3://my-bucket/train/" },
    }),
  );
  const classifierArn = created.DocumentClassifierArn ?? "";

  await expect(
    client.send(
      new DeleteDocumentClassifierCommand({
        DocumentClassifierArn: classifierArn,
      }),
    ),
  ).rejects.toThrow();
});

test("Comprehend delete state guard: DeleteEntityRecognizer rejects TRAINING status", async () => {
  const client = comprehend();
  const name = `bunsai-del-er-${Date.now()}`;

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
  const recognizerArn = created.EntityRecognizerArn ?? "";

  await expect(
    client.send(
      new DeleteEntityRecognizerCommand({
        EntityRecognizerArn: recognizerArn,
      }),
    ),
  ).rejects.toThrow();
});

test("Comprehend ARN validation: StartEntitiesDetectionJob with missing EntityRecognizerArn throws", async () => {
  const client = comprehend();
  const missingArn = `arn:aws:comprehend:${region}:${account}:entity-recognizer/does-not-exist`;

  await expect(
    client.send(
      new StartEntitiesDetectionJobCommand({
        InputDataConfig: {
          S3Uri: "s3://my-bucket/input/",
          InputFormat: "ONE_DOC_PER_FILE",
        },
        OutputDataConfig: { S3Uri: "s3://my-bucket/output/" },
        DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
        LanguageCode: "en",
        EntityRecognizerArn: missingArn,
      }),
    ),
  ).rejects.toThrow();
});

test("Comprehend ARN validation: StartDocumentClassificationJob with missing DocumentClassifierArn throws", async () => {
  const client = comprehend();
  const missingArn = `arn:aws:comprehend:${region}:${account}:document-classifier/does-not-exist`;

  await expect(
    client.send(
      new StartDocumentClassificationJobCommand({
        InputDataConfig: {
          S3Uri: "s3://my-bucket/input/",
          InputFormat: "ONE_DOC_PER_FILE",
        },
        OutputDataConfig: { S3Uri: "s3://my-bucket/output/" },
        DataAccessRoleArn: `arn:aws:iam::${account}:role/ComprehendRole`,
        DocumentClassifierArn: missingArn,
      }),
    ),
  ).rejects.toThrow();
});
