import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AcceptDataGrantCommand,
  CancelJobCommand,
  CreateDataGrantCommand,
  CreateDataSetCommand,
  CreateEventActionCommand,
  CreateJobCommand,
  CreateRevisionCommand,
  DataExchangeClient,
  DeleteAssetCommand,
  DeleteDataGrantCommand,
  DeleteDataSetCommand,
  DeleteEventActionCommand,
  DeleteRevisionCommand,
  GetAssetCommand,
  GetDataGrantCommand,
  GetDataSetCommand,
  GetEventActionCommand,
  GetJobCommand,
  GetReceivedDataGrantCommand,
  GetRevisionCommand,
  ListDataGrantsCommand,
  ListDataSetRevisionsCommand,
  ListDataSetsCommand,
  ListEventActionsCommand,
  ListJobsCommand,
  ListReceivedDataGrantsCommand,
  ListRevisionAssetsCommand,
  ListTagsForResourceCommand,
  RevokeRevisionCommand,
  SendDataSetNotificationCommand,
  StartJobCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateAssetCommand,
  UpdateDataSetCommand,
  UpdateEventActionCommand,
  UpdateRevisionCommand,
} from "@aws-sdk/client-dataexchange";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const dataexchange = () =>
  new DataExchangeClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("DataExchange data set roundtrip", async () => {
  const client = dataexchange();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateDataSetCommand({
      AssetType: "S3_SNAPSHOT",
      Description: "bunsai e2e data set",
      Name: name,
    }),
  );
  expect(created.Id).toBeDefined();
  expect(created.Arn).toBeDefined();
  expect(created.Name).toBe(name);
  expect(created.AssetType).toBe("S3_SNAPSHOT");
  const dataSetId = created.Id ?? "";

  const got = await client.send(
    new GetDataSetCommand({ DataSetId: dataSetId }),
  );
  expect(got.Id).toBe(dataSetId);
  expect(got.Name).toBe(name);
  expect(got.Description).toBe("bunsai e2e data set");

  const listed = await client.send(new ListDataSetsCommand({}));
  expect((listed.DataSets ?? []).map((d) => d.Id)).toContain(dataSetId);

  const updated = await client.send(
    new UpdateDataSetCommand({
      DataSetId: dataSetId,
      Description: "updated description",
    }),
  );
  expect(updated.Description).toBe("updated description");
  expect(updated.Name).toBe(name);

  await client.send(new DeleteDataSetCommand({ DataSetId: dataSetId }));
  await expect(
    client.send(new GetDataSetCommand({ DataSetId: dataSetId })),
  ).rejects.toThrow();
});

test("DataExchange revision roundtrip", async () => {
  const client = dataexchange();

  const ds = await client.send(
    new CreateDataSetCommand({
      AssetType: "S3_SNAPSHOT",
      Description: "revision test",
      Name: `revision-test-${Date.now()}`,
    }),
  );
  const dataSetId = ds.Id ?? "";

  const rev = await client.send(
    new CreateRevisionCommand({
      DataSetId: dataSetId,
      Comment: "first revision",
    }),
  );
  expect(rev.Id).toBeDefined();
  expect(rev.DataSetId).toBe(dataSetId);
  expect(rev.Comment).toBe("first revision");
  expect(rev.Finalized).toBe(false);
  const revisionId = rev.Id ?? "";

  const got = await client.send(
    new GetRevisionCommand({ DataSetId: dataSetId, RevisionId: revisionId }),
  );
  expect(got.Id).toBe(revisionId);
  expect(got.Comment).toBe("first revision");

  const listed = await client.send(
    new ListDataSetRevisionsCommand({ DataSetId: dataSetId }),
  );
  expect((listed.Revisions ?? []).map((r) => r.Id)).toContain(revisionId);

  const updated = await client.send(
    new UpdateRevisionCommand({
      DataSetId: dataSetId,
      RevisionId: revisionId,
      Comment: "updated comment",
      Finalized: true,
    }),
  );
  expect(updated.Comment).toBe("updated comment");
  expect(updated.Finalized).toBe(true);

  await client.send(
    new DeleteRevisionCommand({ DataSetId: dataSetId, RevisionId: revisionId }),
  );
  await expect(
    client.send(
      new GetRevisionCommand({ DataSetId: dataSetId, RevisionId: revisionId }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteDataSetCommand({ DataSetId: dataSetId }));
});

test("DataExchange revision revoke", async () => {
  const client = dataexchange();

  const ds = await client.send(
    new CreateDataSetCommand({
      AssetType: "S3_SNAPSHOT",
      Description: "revoke test",
      Name: `revoke-test-${Date.now()}`,
    }),
  );
  const dataSetId = ds.Id ?? "";

  const rev = await client.send(
    new CreateRevisionCommand({ DataSetId: dataSetId }),
  );
  const revisionId = rev.Id ?? "";

  const revoked = await client.send(
    new RevokeRevisionCommand({
      DataSetId: dataSetId,
      RevisionId: revisionId,
      RevocationComment: "revoked for testing purposes",
    }),
  );
  expect(revoked.Revoked).toBe(true);
  expect(revoked.RevocationComment).toBe("revoked for testing purposes");
  expect(revoked.RevokedAt).toBeDefined();

  await client.send(new DeleteDataSetCommand({ DataSetId: dataSetId }));
});

test("DataExchange asset operations (empty list and not-found errors)", async () => {
  const client = dataexchange();

  const ds = await client.send(
    new CreateDataSetCommand({
      AssetType: "S3_SNAPSHOT",
      Description: "asset test",
      Name: `asset-test-${Date.now()}`,
    }),
  );
  const dataSetId = ds.Id ?? "";

  const rev = await client.send(
    new CreateRevisionCommand({ DataSetId: dataSetId }),
  );
  const revisionId = rev.Id ?? "";

  const listed = await client.send(
    new ListRevisionAssetsCommand({
      DataSetId: dataSetId,
      RevisionId: revisionId,
    }),
  );
  expect(listed.Assets ?? []).toEqual([]);

  await expect(
    client.send(
      new GetAssetCommand({
        DataSetId: dataSetId,
        RevisionId: revisionId,
        AssetId: "nonexistent",
      }),
    ),
  ).rejects.toThrow();

  await expect(
    client.send(
      new UpdateAssetCommand({
        DataSetId: dataSetId,
        RevisionId: revisionId,
        AssetId: "nonexistent",
        Name: "new-name",
      }),
    ),
  ).rejects.toThrow();

  await expect(
    client.send(
      new DeleteAssetCommand({
        DataSetId: dataSetId,
        RevisionId: revisionId,
        AssetId: "nonexistent",
      }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteDataSetCommand({ DataSetId: dataSetId }));
});

test("DataExchange job roundtrip", async () => {
  const client = dataexchange();

  const job = await client.send(
    new CreateJobCommand({
      Type: "IMPORT_ASSETS_FROM_S3",
      Details: {
        ImportAssetsFromS3: {
          AssetSources: [{ Bucket: "my-bucket", Key: "my-key" }],
          DataSetId: "fake-dataset-id",
          RevisionId: "fake-revision-id",
        },
      },
    }),
  );
  expect(job.Id).toBeDefined();
  expect(job.State).toBe("WAITING");
  expect(job.Type).toBe("IMPORT_ASSETS_FROM_S3");
  const jobId = job.Id ?? "";

  const got = await client.send(new GetJobCommand({ JobId: jobId }));
  expect(got.Id).toBe(jobId);
  expect(got.State).toBe("WAITING");

  const listed = await client.send(new ListJobsCommand({}));
  expect((listed.Jobs ?? []).map((j) => j.Id)).toContain(jobId);

  await client.send(new StartJobCommand({ JobId: jobId }));
  const started = await client.send(new GetJobCommand({ JobId: jobId }));
  expect(started.State).toBe("IN_PROGRESS");

  const job2 = await client.send(
    new CreateJobCommand({
      Type: "IMPORT_ASSETS_FROM_S3",
      Details: {
        ImportAssetsFromS3: {
          AssetSources: [{ Bucket: "my-bucket", Key: "my-key2" }],
          DataSetId: "fake-dataset-id",
          RevisionId: "fake-revision-id",
        },
      },
    }),
  );
  const job2Id = job2.Id ?? "";
  await client.send(new CancelJobCommand({ JobId: job2Id }));
  const cancelled = await client.send(new GetJobCommand({ JobId: job2Id }));
  expect(cancelled.State).toBe("CANCELLED");
});

test("DataExchange event action roundtrip", async () => {
  const client = dataexchange();

  const ea = await client.send(
    new CreateEventActionCommand({
      Action: {
        ExportRevisionToS3: {
          RevisionDestination: { Bucket: "my-bucket" },
        },
      },
      Event: {
        RevisionPublished: { DataSetId: "fake-dataset-id" },
      },
    }),
  );
  expect(ea.Id).toBeDefined();
  expect(ea.Arn).toBeDefined();
  const eventActionId = ea.Id ?? "";

  const got = await client.send(
    new GetEventActionCommand({ EventActionId: eventActionId }),
  );
  expect(got.Id).toBe(eventActionId);

  const listed = await client.send(new ListEventActionsCommand({}));
  expect((listed.EventActions ?? []).map((e) => e.Id)).toContain(eventActionId);

  const updated = await client.send(
    new UpdateEventActionCommand({
      EventActionId: eventActionId,
      Action: {
        ExportRevisionToS3: {
          RevisionDestination: { Bucket: "updated-bucket" },
        },
      },
    }),
  );
  expect(updated.Id).toBe(eventActionId);

  await client.send(
    new DeleteEventActionCommand({ EventActionId: eventActionId }),
  );
  await expect(
    client.send(new GetEventActionCommand({ EventActionId: eventActionId })),
  ).rejects.toThrow();
});

test("DataExchange data grant roundtrip", async () => {
  const client = dataexchange();

  const ds = await client.send(
    new CreateDataSetCommand({
      AssetType: "S3_SNAPSHOT",
      Description: "grant test dataset",
      Name: `grant-test-${Date.now()}`,
    }),
  );
  const dataSetId = ds.Id ?? "";

  const grant = await client.send(
    new CreateDataGrantCommand({
      Name: "test-grant",
      GrantDistributionScope: "AWS_ORGANIZATION",
      ReceiverPrincipal: "000000000000",
      SourceDataSetId: dataSetId,
      Description: "test grant description",
    }),
  );
  expect(grant.Id).toBeDefined();
  expect(grant.Arn).toBeDefined();
  expect(grant.Name).toBe("test-grant");
  expect(grant.AcceptanceState).toBe("PENDING_RECEIVER_ACCEPTANCE");
  const grantId = grant.Id ?? "";
  const grantArn = grant.Arn ?? "";

  const got = await client.send(
    new GetDataGrantCommand({ DataGrantId: grantId }),
  );
  expect(got.Id).toBe(grantId);
  expect(got.Name).toBe("test-grant");

  const listed = await client.send(new ListDataGrantsCommand({}));
  expect((listed.DataGrantSummaries ?? []).map((g) => g.Id)).toContain(grantId);

  const received = await client.send(
    new GetReceivedDataGrantCommand({ DataGrantArn: grantArn }),
  );
  expect(received.Arn).toBe(grantArn);
  expect(received.AcceptanceState).toBe("PENDING_RECEIVER_ACCEPTANCE");

  const receivedList = await client.send(new ListReceivedDataGrantsCommand({}));
  expect((receivedList.DataGrantSummaries ?? []).map((g) => g.Arn)).toContain(
    grantArn,
  );

  const accepted = await client.send(
    new AcceptDataGrantCommand({ DataGrantArn: grantArn }),
  );
  expect(accepted.AcceptanceState as string).toBe("GRANTED");
  expect(accepted.AcceptedAt).toBeDefined();

  await client.send(new DeleteDataGrantCommand({ DataGrantId: grantId }));
  await expect(
    client.send(new GetDataGrantCommand({ DataGrantId: grantId })),
  ).rejects.toThrow();

  await client.send(new DeleteDataSetCommand({ DataSetId: dataSetId }));
});

test("DataExchange tags roundtrip", async () => {
  const client = dataexchange();

  const ds = await client.send(
    new CreateDataSetCommand({
      AssetType: "S3_SNAPSHOT",
      Description: "tags test",
      Name: `tags-test-${Date.now()}`,
    }),
  );
  const resourceArn = ds.Arn ?? "";
  const dataSetId = ds.Id ?? "";

  await client.send(
    new TagResourceCommand({
      ResourceArn: resourceArn,
      Tags: { env: "test", project: "bunsai" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(listed.Tags?.env).toBe("test");
  expect(listed.Tags?.project).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({
      ResourceArn: resourceArn,
      TagKeys: ["env"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(afterUntag.Tags?.env).toBeUndefined();
  expect(afterUntag.Tags?.project).toBe("bunsai");

  await client.send(new DeleteDataSetCommand({ DataSetId: dataSetId }));
});

test("DataExchange SendDataSetNotification", async () => {
  const client = dataexchange();

  const ds = await client.send(
    new CreateDataSetCommand({
      AssetType: "S3_SNAPSHOT",
      Description: "notification test",
      Name: `notification-test-${Date.now()}`,
    }),
  );
  const dataSetId = ds.Id ?? "";

  await expect(
    client.send(
      new SendDataSetNotificationCommand({
        DataSetId: dataSetId,
        Type: "DATA_DELAY",
      }),
    ),
  ).resolves.toBeDefined();

  await client.send(new DeleteDataSetCommand({ DataSetId: dataSetId }));
});

test("DataExchange StartJob conflict on double-start", async () => {
  const client = dataexchange();

  const job = await client.send(
    new CreateJobCommand({
      Type: "IMPORT_ASSETS_FROM_S3",
      Details: {
        ImportAssetsFromS3: {
          AssetSources: [{ Bucket: "b", Key: "k" }],
          DataSetId: "ds",
          RevisionId: "rv",
        },
      },
    }),
  );
  const jobId = job.Id ?? "";
  expect(job.State).toBe("WAITING");

  await client.send(new StartJobCommand({ JobId: jobId }));
  const started = await client.send(new GetJobCommand({ JobId: jobId }));
  expect(started.State).toBe("IN_PROGRESS");

  await expect(
    client.send(new StartJobCommand({ JobId: jobId })),
  ).rejects.toThrow();
});

test("DataExchange ListDataSets Origin filter", async () => {
  const client = dataexchange();
  const suffix = Date.now();

  const ds1 = await client.send(
    new CreateDataSetCommand({
      AssetType: "S3_SNAPSHOT",
      Description: "owned ds1",
      Name: `origin-test-a-${suffix}`,
    }),
  );
  const ds2 = await client.send(
    new CreateDataSetCommand({
      AssetType: "S3_SNAPSHOT",
      Description: "owned ds2",
      Name: `origin-test-b-${suffix}`,
    }),
  );
  const ds1Id = ds1.Id ?? "";
  const ds2Id = ds2.Id ?? "";

  const owned = await client.send(new ListDataSetsCommand({ Origin: "OWNED" }));
  const ownedIds = (owned.DataSets ?? []).map((d) => d.Id);
  expect(ownedIds).toContain(ds1Id);
  expect(ownedIds).toContain(ds2Id);

  const entitled = await client.send(
    new ListDataSetsCommand({ Origin: "ENTITLED" }),
  );
  expect((entitled.DataSets ?? []).length).toBe(0);

  await client.send(new DeleteDataSetCommand({ DataSetId: ds1Id }));
  await client.send(new DeleteDataSetCommand({ DataSetId: ds2Id }));
});

test("DataExchange ListDataSets pagination", async () => {
  const client = dataexchange();
  const suffix = Date.now();

  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const ds = await client.send(
      new CreateDataSetCommand({
        AssetType: "S3_SNAPSHOT",
        Description: `page test ${i}`,
        Name: `page-test-${i}-${suffix}`,
      }),
    );
    ids.push(ds.Id ?? "");
  }

  const page1 = await client.send(new ListDataSetsCommand({ MaxResults: 2 }));
  expect((page1.DataSets ?? []).length).toBe(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new ListDataSetsCommand({ MaxResults: 2, NextToken: page1.NextToken }),
  );
  expect((page2.DataSets ?? []).length).toBeGreaterThanOrEqual(1);

  for (const id of ids) {
    await client.send(new DeleteDataSetCommand({ DataSetId: id }));
  }
});
