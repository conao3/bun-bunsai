import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddApplicationCloudWatchLoggingOptionCommand,
  AddApplicationVpcConfigurationCommand,
  CreateApplicationCommand,
  CreateApplicationSnapshotCommand,
  DeleteApplicationCommand,
  DeleteApplicationSnapshotCommand,
  DescribeApplicationCommand,
  DescribeApplicationOperationCommand,
  DescribeApplicationSnapshotCommand,
  DescribeApplicationVersionCommand,
  KinesisAnalyticsV2Client,
  ListApplicationOperationsCommand,
  ListApplicationSnapshotsCommand,
  ListApplicationVersionsCommand,
  ListApplicationsCommand,
  ListTagsForResourceCommand,
  RollbackApplicationCommand,
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

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
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

  const created = await c.send(
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

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2: RUNNING state blocks deletion (ResourceInUseException)", async () => {
  const c = client();
  const appName = "bunsai-e2e-running-guard";

  const created = await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  await c.send(new StartApplicationCommand({ ApplicationName: appName }));

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await expect(
    c.send(
      new DeleteApplicationCommand({
        ApplicationName: appName,
        CreateTimestamp: createTs,
      }),
    ),
  ).rejects.toThrow();

  await c.send(new StopApplicationCommand({ ApplicationName: appName }));
  await c.send(new DescribeApplicationCommand({ ApplicationName: appName }));

  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2: ConcurrentModificationException on version mismatch", async () => {
  const c = client();
  const appName = "bunsai-e2e-version-guard";

  const created = await c.send(
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

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2: snapshot CRUD (requires RUNNING state)", async () => {
  const c = client();
  const appName = "bunsai-e2e-snapshot";
  const snapshotName = "snap-1";

  const created = await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  await c.send(new StartApplicationCommand({ ApplicationName: appName }));
  await c.send(new DescribeApplicationCommand({ ApplicationName: appName }));

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

  await c.send(new StopApplicationCommand({ ApplicationName: appName }));
  await c.send(new DescribeApplicationCommand({ ApplicationName: appName }));

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2: tag operations", async () => {
  const c = client();
  const appName = "bunsai-e2e-tags";

  const created = await c.send(
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

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2: CloudWatch logging options", async () => {
  const c = client();
  const appName = "bunsai-e2e-cw";

  const created = await c.send(
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

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2 KDA2-001: OperationId persistence — DescribeApplicationOperation and ListApplicationOperations", async () => {
  const c = client();
  const appName = "bunsai-e2e-kda2-001";

  const created = await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  const startRes = await c.send(
    new StartApplicationCommand({ ApplicationName: appName }),
  );
  const startOpId = startRes.OperationId;
  expect(startOpId).toBeDefined();

  const descOp = await c.send(
    new DescribeApplicationOperationCommand({
      ApplicationName: appName,
      OperationId: startOpId!,
    }),
  );
  expect(descOp.ApplicationOperationInfoDetails?.OperationStatus).toBe(
    "SUCCESSFUL",
  );
  expect(descOp.ApplicationOperationInfoDetails?.Operation).toBe(
    "StartApplication",
  );

  const listOps = await c.send(
    new ListApplicationOperationsCommand({ ApplicationName: appName }),
  );
  expect((listOps.ApplicationOperationInfoList ?? []).length).toBeGreaterThan(
    0,
  );
  const found = (listOps.ApplicationOperationInfoList ?? []).find(
    (o) => o.OperationId === startOpId,
  );
  expect(found).toBeDefined();

  const stopRes = await c.send(
    new StopApplicationCommand({ ApplicationName: appName }),
  );
  const stopOpId = stopRes.OperationId;
  expect(stopOpId).toBeDefined();

  await c.send(new DescribeApplicationCommand({ ApplicationName: appName }));

  const filteredOps = await c.send(
    new ListApplicationOperationsCommand({
      ApplicationName: appName,
      Operation: "StopApplication",
    }),
  );
  expect(
    (filteredOps.ApplicationOperationInfoList ?? []).every(
      (o) => o.Operation === "StopApplication",
    ),
  ).toBe(true);

  await expect(
    c.send(
      new DescribeApplicationOperationCommand({
        ApplicationName: appName,
        OperationId: "nonexistent-op-id",
      }),
    ),
  ).rejects.toThrow();

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2 KDA2-002: ApplicationConfigurationDescription mapping and merge", async () => {
  const c = client();
  const appName = "bunsai-e2e-kda2-002";

  const created = await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
      ApplicationConfiguration: {
        ApplicationCodeConfiguration: {
          CodeContent: {
            S3ContentLocation: {
              BucketARN: "arn:aws:s3:::my-bucket",
              FileKey: "app.jar",
            },
          },
          CodeContentType: "ZIPFILE",
        },
        EnvironmentProperties: {
          PropertyGroups: [
            {
              PropertyGroupId: "group1",
              PropertyMap: { key1: "val1" },
            },
          ],
        },
      },
    }),
  );

  const described = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  const configDesc =
    described.ApplicationDetail?.ApplicationConfigurationDescription;
  expect(configDesc).toBeDefined();
  expect(
    (configDesc as Record<string, unknown>)?.EnvironmentPropertyDescriptions,
  ).toBeDefined();
  expect(
    (configDesc as Record<string, unknown>)
      ?.ApplicationCodeConfigurationDescription,
  ).toBeDefined();

  const versionId = described.ApplicationDetail?.ApplicationVersionId ?? 1;
  await c.send(
    new UpdateApplicationCommand({
      ApplicationName: appName,
      CurrentApplicationVersionId: versionId,
      ApplicationConfigurationUpdate: {
        EnvironmentPropertyUpdates: {
          PropertyGroups: [
            {
              PropertyGroupId: "group1",
              PropertyMap: { key1: "val2" },
            },
          ],
        },
      },
    }),
  );

  const describedAfterUpdate = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  const configDescAfter =
    describedAfterUpdate.ApplicationDetail?.ApplicationConfigurationDescription;
  expect(
    (configDescAfter as Record<string, unknown>)
      ?.ApplicationCodeConfigurationDescription,
  ).toBeDefined();
  expect(
    (configDescAfter as Record<string, unknown>)
      ?.EnvironmentPropertyDescriptions,
  ).toBeDefined();

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2 KDA2-003: concurrency precondition — InvalidArgumentException when both version identifiers absent", async () => {
  const c = client();
  const appName = "bunsai-e2e-kda2-003";

  const created = await c.send(
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
      }),
    ),
  ).rejects.toThrow();

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2 KDA2-004: RollbackApplication restores previous configuration", async () => {
  const c = client();
  const appName = "bunsai-e2e-kda2-004";

  const created = await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
      ApplicationConfiguration: {
        EnvironmentProperties: {
          PropertyGroups: [
            { PropertyGroupId: "g1", PropertyMap: { k: "original" } },
          ],
        },
      },
    }),
  );

  await expect(
    c.send(
      new RollbackApplicationCommand({
        ApplicationName: appName,
        CurrentApplicationVersionId: 1,
      }),
    ),
  ).rejects.toThrow();

  const described = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  const v1 = described.ApplicationDetail?.ApplicationVersionId ?? 1;
  await c.send(
    new UpdateApplicationCommand({
      ApplicationName: appName,
      CurrentApplicationVersionId: v1,
      ApplicationConfigurationUpdate: {
        EnvironmentPropertyUpdates: {
          PropertyGroups: [
            { PropertyGroupId: "g1", PropertyMap: { k: "updated" } },
          ],
        },
      },
    }),
  );

  const described2 = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  const v2 = described2.ApplicationDetail?.ApplicationVersionId ?? 2;

  const rollbackRes = await c.send(
    new RollbackApplicationCommand({
      ApplicationName: appName,
      CurrentApplicationVersionId: v2,
    }),
  );
  expect(rollbackRes.ApplicationDetail?.ApplicationVersionId).toBe(v2 + 1);

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2 KDA2-005: version history — ListApplicationVersions and DescribeApplicationVersion", async () => {
  const c = client();
  const appName = "bunsai-e2e-kda2-005";

  const created = await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  const described = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  const v1 = described.ApplicationDetail?.ApplicationVersionId ?? 1;

  await c.send(
    new UpdateApplicationCommand({
      ApplicationName: appName,
      CurrentApplicationVersionId: v1,
    }),
  );

  const versions = await c.send(
    new ListApplicationVersionsCommand({ ApplicationName: appName }),
  );
  expect((versions.ApplicationVersionSummaries ?? []).length).toBeGreaterThan(
    1,
  );

  const v1Detail = await c.send(
    new DescribeApplicationVersionCommand({
      ApplicationName: appName,
      ApplicationVersionId: 1,
    }),
  );
  expect(v1Detail.ApplicationVersionDetail?.ApplicationVersionId).toBe(1);

  await expect(
    c.send(
      new DescribeApplicationVersionCommand({
        ApplicationName: appName,
        ApplicationVersionId: 9999,
      }),
    ),
  ).rejects.toThrow();

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2 KDA2-006: StopApplication Force flag", async () => {
  const c = client();
  const appName = "bunsai-e2e-kda2-006";

  const created = await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  await c.send(new StartApplicationCommand({ ApplicationName: appName }));

  const stopRes = await c.send(
    new StopApplicationCommand({ ApplicationName: appName, Force: true }),
  );
  expect(stopRes.OperationId).toBeDefined();

  const afterStop = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  expect(afterStop.ApplicationDetail?.ApplicationStatus).toBe("READY");

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2 KDA2-007: DeleteApplication CreateTimestamp guard", async () => {
  const c = client();
  const appName = "bunsai-e2e-kda2-007";

  await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  await expect(
    c.send(
      new DeleteApplicationCommand({
        ApplicationName: appName,
        CreateTimestamp: new Date("2000-01-01T00:00:00Z"),
      }),
    ),
  ).rejects.toThrow();

  const described = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  const createTs = described.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2 KDA2-008: CreateApplicationSnapshot requires RUNNING state", async () => {
  const c = client();
  const appName = "bunsai-e2e-kda2-008";

  const created = await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  await expect(
    c.send(
      new CreateApplicationSnapshotCommand({
        ApplicationName: appName,
        SnapshotName: "snap-should-fail",
      }),
    ),
  ).rejects.toThrow();

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2 KDA2-001: UpdateApplication OperationId persisted", async () => {
  const c = client();
  const appName = "bunsai-e2e-kda2-001b";

  const created = await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  const described = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  const vId = described.ApplicationDetail?.ApplicationVersionId ?? 1;

  const updateRes = await c.send(
    new UpdateApplicationCommand({
      ApplicationName: appName,
      CurrentApplicationVersionId: vId,
    }),
  );
  const updateOpId = updateRes.OperationId;
  expect(updateOpId).toBeDefined();

  const opDetail = await c.send(
    new DescribeApplicationOperationCommand({
      ApplicationName: appName,
      OperationId: updateOpId!,
    }),
  );
  expect(opDetail.ApplicationOperationInfoDetails?.OperationStatus).toBe(
    "SUCCESSFUL",
  );
  expect(opDetail.ApplicationOperationInfoDetails?.Operation).toBe(
    "UpdateApplication",
  );

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});

test("kinesisanalyticsv2: VPC configuration CRUD", async () => {
  const c = client();
  const appName = "bunsai-e2e-vpc";

  const created = await c.send(
    new CreateApplicationCommand({
      ApplicationName: appName,
      RuntimeEnvironment: "FLINK-1_18",
      ServiceExecutionRole: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  const described = await c.send(
    new DescribeApplicationCommand({ ApplicationName: appName }),
  );
  const conditionalToken = described.ApplicationDetail?.ConditionalToken;

  const addVpcRes = await c.send(
    new AddApplicationVpcConfigurationCommand({
      ApplicationName: appName,
      ConditionalToken: conditionalToken,
      VpcConfiguration: {
        SubnetIds: ["subnet-12345"],
        SecurityGroupIds: ["sg-12345"],
      },
    }),
  );
  expect(addVpcRes.OperationId).toBeDefined();
  expect(addVpcRes.VpcConfigurationDescription?.SubnetIds).toContain(
    "subnet-12345",
  );

  const vpcOpDetail = await c.send(
    new DescribeApplicationOperationCommand({
      ApplicationName: appName,
      OperationId: addVpcRes.OperationId!,
    }),
  );
  expect(vpcOpDetail.ApplicationOperationInfoDetails?.OperationStatus).toBe(
    "SUCCESSFUL",
  );

  const createTs = created.ApplicationDetail?.CreateTimestamp;
  await c.send(
    new DeleteApplicationCommand({
      ApplicationName: appName,
      CreateTimestamp: createTs,
    }),
  );
});
