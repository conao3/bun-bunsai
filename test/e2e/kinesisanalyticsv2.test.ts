import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddApplicationCloudWatchLoggingOptionCommand,
  CreateApplicationCommand,
  CreateApplicationSnapshotCommand,
  DeleteApplicationCommand,
  DeleteApplicationSnapshotCommand,
  DescribeApplicationCommand,
  DescribeApplicationSnapshotCommand,
  KinesisAnalyticsV2Client,
  ListApplicationSnapshotsCommand,
  ListApplicationsCommand,
  ListTagsForResourceCommand,
  StartApplicationCommand,
  StopApplicationCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateApplicationCommand,
} from "@aws-sdk/client-kinesis-analytics-v2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const account = "000000000000";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = () =>
  new KinesisAnalyticsV2Client({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

const appArn = (name: string) =>
  `arn:aws:kinesisanalytics:${region}:${account}:application/${name}`;

test("kinesisanalyticsv2: application lifecycle (create, describe, list, update, delete)", async () => {
  const c = client();
  const appName = "bunsai-e2e-app";

  const created = await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
      ApplicationDescription: "test app",
      ApplicationMode: "STREAMING",
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  expect(created.ApplicationDetail?.ApplicationName).toBe(appName);
  expect(created.ApplicationDetail?.ApplicationStatus).toBe("READY");
  expect(created.ApplicationDetail?.ApplicationVersionId).toBe(1);
  expect(created.ApplicationDetail?.RuntimeEnvironment).toBe("FLINK-1_18");

  const described = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  expect(described.ApplicationDetail?.ApplicationName).toBe(appName);
  expect(described.ApplicationDetail?.ApplicationStatus).toBe("READY");

  const listed = await c.send(new ListApplicationsCommand({}));
  const found = (listed.ApplicationSummaries ?? []).find(
    (s) => s.ApplicationName === appName,
  );
  expect(found).toBeDefined();
  expect(found?.ApplicationStatus).toBe("READY");

  const versionId = described.ApplicationDetail?.ApplicationVersionId ?? 1;
  const updated = await c.send(
    new UpdateApplicationCommand({
      ApplicationName: appName,
      CurrentApplicationVersionId: versionId,
    }),
  );
  expect(updated.ApplicationDetail?.ApplicationVersionId).toBe(versionId + 1);

  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: new Date(),
    }),
  );

  const listedAfter = await c.send(new ListApplicationsCommand({}));
  const notFound = (listedAfter.ApplicationSummaries ?? []).find(
    (s) => s.ApplicationName === appName,
  );
  expect(notFound).toBeUndefined();
});

test("kinesisanalyticsv2: start/stop state machine (READY → STARTING → RUNNING → STOPPING → READY)", async () => {
  const c = client();
  const appName = "bunsai-e2e-statemachine";

  await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  const beforeStart = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  expect(beforeStart.ApplicationDetail?.ApplicationStatus).toBe("READY");

  await c.send(new StartApplicationCommand({ ApplicationName: appName }));

  const starting = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  expect(starting.ApplicationDetail?.ApplicationStatus).toBe("RUNNING");

  await c.send(new StopApplicationCommand({ ApplicationName: appName }));

  const stopping = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  expect(stopping.ApplicationDetail?.ApplicationStatus).toBe("READY");

  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: new Date(),
    }),
  );
});

test("kinesisanalyticsv2: RUNNING state blocks deletion (ResourceInUseException)", async () => {
  const c = client();
  const appName = "bunsai-e2e-running-guard";

  await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  await c.send(new StartApplicationCommand({ ApplicationName: appName }));

  await expect(
    c.send(
      new DeleteApplicationCommand({
        ApplicationName: appName,
        CreateTimestamp: new Date(),
      }),
    ),
  ).rejects.toThrow();

  await c.send(new StopApplicationCommand({ ApplicationName: appName }));
  await c.send(new DescribeApplicationCommand({ ApplicationName: appName }));

  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: new Date(),
    }),
  );
});

test("kinesisanalyticsv2: ConcurrentModificationException on version mismatch", async () => {
  const c = client();
  const appName = "bunsai-e2e-version-guard";

  await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  await expect(
    c.send(
      new UpdateApplicationCommand({
        ApplicationName: appName,
        CurrentApplicationVersionId: 999,
      }),
    ),
  ).rejects.toThrow();

  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: new Date(),
    }),
  );
});

test("kinesisanalyticsv2: snapshot CRUD", async () => {
  const c = client();
  const appName = "bunsai-e2e-snapshot";
  const snapshotName = "snap-1";

  await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  await c.send(
    new CreateApplicationSnapshotCommand({
      ApplicationName: appName,
      SnapshotName: snapshotName,
    }),
  );

  const described = await c.send(
    new DescribeApplicationSnapshotCommand({
      ApplicationName: appName,
      SnapshotName: snapshotName,
    }),
  );
  expect(described.SnapshotDetails?.SnapshotName).toBe(snapshotName);
  expect(described.SnapshotDetails?.SnapshotStatus).toBe("READY");

  const listed = await c.send(
    new ListApplicationSnapshotsCommand({ ApplicationName: appName }),
  );
  expect(
    (listed.SnapshotSummaries ?? []).some(
      (s) => s.SnapshotName === snapshotName,
    ),
  ).toBe(true);

  await c.send(
    new DeleteApplicationSnapshotCommand({
      ApplicationName: appName,
      SnapshotName: snapshotName,
      SnapshotCreationTimestamp: new Date(),
    }),
  );

  const listedAfter = await c.send(
    new ListApplicationSnapshotsCommand({ ApplicationName: appName }),
  );
  expect(
    (listedAfter.SnapshotSummaries ?? []).some(
      (s) => s.SnapshotName === snapshotName,
    ),
  ).toBe(false);

  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: new Date(),
    }),
  );
});

test("kinesisanalyticsv2: tag operations", async () => {
  const c = client();
  const appName = "bunsai-e2e-tags";

  await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
      Tags: [{ Key: "k1", Value: "v1" }],
    }),
  );

  const arn = appArn(appName);

  const tags1 = await c.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect(
    (tags1.Tags ?? []).some((t) => t.Key === "k1" && t.Value === "v1"),
  ).toBe(true);

  await c.send(
    new TagResourceCommand({
      ResourceARN: arn,
      Tags: [{ Key: "k2", Value: "v2" }],
    }),
  );

  const tags2 = await c.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect((tags2.Tags ?? []).some((t) => t.Key === "k2")).toBe(true);

  await c.send(new UntagResourceCommand({ ResourceARN: arn, TagKeys: ["k1"] }));

  const tags3 = await c.send(
    new ListTagsForResourceCommand({ ResourceARN: arn }),
  );
  expect((tags3.Tags ?? []).some((t) => t.Key === "k1")).toBe(false);
  expect((tags3.Tags ?? []).some((t) => t.Key === "k2")).toBe(true);

  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: new Date(),
    }),
  );
});

test("kinesisanalyticsv2: CloudWatch logging options", async () => {
  const c = client();
  const appName = "bunsai-e2e-cw";

  await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  const described = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  const versionId = described.ApplicationDetail?.ApplicationVersionId ?? 1;
  const conditionalToken = described.ApplicationDetail?.ConditionalToken;

  const addResult = await c.send(
    new AddApplicationCloudWatchLoggingOptionCommand({
      ApplicationName: appName,
      ConditionalToken: conditionalToken,
      CloudWatchLoggingOption: {
        LogStreamARN:
          "arn:aws:logs:us-east-1:123456789012:log-group:test:log-stream:test",
      },
    }),
  );
  expect(addResult.ApplicationVersionId).toBe(versionId + 1);
  expect((addResult.CloudWatchLoggingOptionDescriptions ?? []).length).toBe(1);

  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: new Date(),
    }),
  );
});
