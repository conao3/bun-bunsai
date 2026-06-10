import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConfigureLogsCommand,
  CreateChannelCommand,
  CreateHarvestJobCommand,
  CreateOriginEndpointCommand,
  DeleteChannelCommand,
  DeleteOriginEndpointCommand,
  DescribeChannelCommand,
  DescribeHarvestJobCommand,
  DescribeOriginEndpointCommand,
  ListChannelsCommand,
  ListHarvestJobsCommand,
  ListOriginEndpointsCommand,
  ListTagsForResourceCommand,
  MediaPackageClient,
  RotateChannelCredentialsCommand,
  RotateIngestEndpointCredentialsCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateChannelCommand,
  UpdateOriginEndpointCommand,
} from "@aws-sdk/client-mediapackage";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const mediapackage = () =>
  new MediaPackageClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("MediaPackage channel roundtrip", async () => {
  const client = mediapackage();
  const id = "bunsai-e2e-channel";

  const created = await client.send(
    new CreateChannelCommand({ Id: id, Description: "bunsai e2e channel" }),
  );
  expect(created.Id).toBe(id);
  expect(created.Arn).toBeDefined();

  const described = await client.send(new DescribeChannelCommand({ Id: id }));
  expect(described.Id).toBe(id);
  expect(described.Description).toBe("bunsai e2e channel");

  const listed = await client.send(new ListChannelsCommand({}));
  expect((listed.Channels ?? []).map((c) => c.Id)).toContain(id);

  await client.send(new DeleteChannelCommand({ Id: id }));
  await expect(
    client.send(new DescribeChannelCommand({ Id: id })),
  ).rejects.toThrow();
});

test("MediaPackage UpdateChannel", async () => {
  const client = mediapackage();
  const id = "bunsai-e2e-update-channel";

  await client.send(
    new CreateChannelCommand({ Id: id, Description: "original" }),
  );

  const updated = await client.send(
    new UpdateChannelCommand({ Id: id, Description: "updated" }),
  );
  expect(updated.Id).toBe(id);
  expect(updated.Description).toBe("updated");

  await client.send(new DeleteChannelCommand({ Id: id }));
});

test("MediaPackage ConfigureLogs", async () => {
  const client = mediapackage();
  const id = "bunsai-e2e-logs-channel";

  await client.send(new CreateChannelCommand({ Id: id }));

  const configured = await client.send(
    new ConfigureLogsCommand({
      Id: id,
      EgressAccessLogs: { LogGroupName: "/aws/MediaPackage/EgressAccessLogs" },
      IngressAccessLogs: {
        LogGroupName: "/aws/MediaPackage/IngressAccessLogs",
      },
    }),
  );
  expect(configured.Id).toBe(id);
  expect(configured.EgressAccessLogs?.LogGroupName).toBe(
    "/aws/MediaPackage/EgressAccessLogs",
  );

  await client.send(new DeleteChannelCommand({ Id: id }));
});

test("MediaPackage ConfigureLogs replace semantics", async () => {
  const client = mediapackage();
  const id = "bunsai-e2e-logs-replace-channel";

  await client.send(new CreateChannelCommand({ Id: id }));
  await client.send(
    new ConfigureLogsCommand({
      Id: id,
      EgressAccessLogs: { LogGroupName: "/aws/MediaPackage/EgressAccessLogs" },
    }),
  );

  const cleared = await client.send(new ConfigureLogsCommand({ Id: id }));
  expect(cleared.EgressAccessLogs).toBeUndefined();
  expect(cleared.IngressAccessLogs).toBeUndefined();

  await client.send(new DeleteChannelCommand({ Id: id }));
});

test("MediaPackage RotateChannelCredentials", async () => {
  const client = mediapackage();
  const id = "bunsai-e2e-rotate-channel";

  const created = await client.send(new CreateChannelCommand({ Id: id }));
  const originalPassword =
    created.HlsIngest?.IngestEndpoints?.[0]?.Password ?? "";

  const rotated = await client.send(
    new RotateChannelCredentialsCommand({ Id: id }),
  );
  expect(rotated.Id).toBe(id);
  const newPassword = rotated.HlsIngest?.IngestEndpoints?.[0]?.Password ?? "";
  expect(newPassword).not.toBe(originalPassword);

  await client.send(new DeleteChannelCommand({ Id: id }));
});

test("MediaPackage RotateIngestEndpointCredentials", async () => {
  const client = mediapackage();
  const id = "bunsai-e2e-rotate-ingest-channel";

  const created = await client.send(new CreateChannelCommand({ Id: id }));
  const ingestEndpointId = created.HlsIngest?.IngestEndpoints?.[0]?.Id ?? "";
  const originalPassword =
    created.HlsIngest?.IngestEndpoints?.[0]?.Password ?? "";

  const rotated = await client.send(
    new RotateIngestEndpointCredentialsCommand({
      Id: id,
      IngestEndpointId: ingestEndpointId,
    }),
  );
  expect(rotated.Id).toBe(id);
  const newPassword = rotated.HlsIngest?.IngestEndpoints?.[0]?.Password ?? "";
  expect(newPassword).not.toBe(originalPassword);

  await client.send(new DeleteChannelCommand({ Id: id }));
});

test("MediaPackage origin endpoint roundtrip", async () => {
  const client = mediapackage();
  const channelId = "bunsai-e2e-oe-channel";
  const endpointId = "bunsai-e2e-origin-endpoint";

  await client.send(new CreateChannelCommand({ Id: channelId }));

  const created = await client.send(
    new CreateOriginEndpointCommand({
      ChannelId: channelId,
      Id: endpointId,
      Description: "bunsai e2e endpoint",
    }),
  );
  expect(created.Id).toBe(endpointId);
  expect(created.Arn).toBeDefined();
  expect(created.ChannelId).toBe(channelId);

  const described = await client.send(
    new DescribeOriginEndpointCommand({ Id: endpointId }),
  );
  expect(described.Id).toBe(endpointId);
  expect(described.Description).toBe("bunsai e2e endpoint");

  const listed = await client.send(
    new ListOriginEndpointsCommand({ ChannelId: channelId }),
  );
  expect((listed.OriginEndpoints ?? []).map((e) => e.Id)).toContain(endpointId);

  const updated = await client.send(
    new UpdateOriginEndpointCommand({
      Id: endpointId,
      Description: "updated endpoint",
    }),
  );
  expect(updated.Description).toBe("updated endpoint");

  await client.send(new DeleteOriginEndpointCommand({ Id: endpointId }));
  await expect(
    client.send(new DescribeOriginEndpointCommand({ Id: endpointId })),
  ).rejects.toThrow();

  await client.send(new DeleteChannelCommand({ Id: channelId }));
});

test("MediaPackage DeleteChannel blocks when OriginEndpoints attached", async () => {
  const client = mediapackage();
  const channelId = "bunsai-e2e-del-guard-channel";
  const endpointId = "bunsai-e2e-del-guard-endpoint";

  await client.send(new CreateChannelCommand({ Id: channelId }));
  await client.send(
    new CreateOriginEndpointCommand({
      ChannelId: channelId,
      Id: endpointId,
    }),
  );

  await expect(
    client.send(new DeleteChannelCommand({ Id: channelId })),
  ).rejects.toMatchObject({ name: "UnprocessableEntityException" });

  await client.send(new DeleteOriginEndpointCommand({ Id: endpointId }));
  await client.send(new DeleteChannelCommand({ Id: channelId }));
});

test("MediaPackage re-create channel starts with fresh tags", async () => {
  const client = mediapackage();
  const id = "bunsai-e2e-tag-recreate-channel";

  const first = await client.send(
    new CreateChannelCommand({ Id: id, Tags: { a: "1" } }),
  );
  const arn = first.Arn ?? "";
  await client.send(new DeleteChannelCommand({ Id: id }));

  await client.send(new CreateChannelCommand({ Id: id, Tags: { b: "2" } }));
  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(tags.Tags?.["b"]).toBe("2");
  expect(tags.Tags?.["a"]).toBeUndefined();

  await client.send(new DeleteChannelCommand({ Id: id }));
});

test("MediaPackage harvest job roundtrip", async () => {
  const client = mediapackage();
  const channelId = "bunsai-e2e-hj-channel";
  const endpointId = "bunsai-e2e-hj-endpoint";
  const jobId = "bunsai-e2e-harvest-job";

  await client.send(new CreateChannelCommand({ Id: channelId }));
  await client.send(
    new CreateOriginEndpointCommand({
      ChannelId: channelId,
      Id: endpointId,
      StartoverWindowSeconds: 300,
    }),
  );

  const created = await client.send(
    new CreateHarvestJobCommand({
      Id: jobId,
      OriginEndpointId: endpointId,
      StartTime: "2024-01-01T00:00:00Z",
      EndTime: "2024-01-02T00:00:00Z",
      S3Destination: {
        BucketName: "bunsai-test-bucket",
        ManifestKey: "index.m3u8",
        RoleArn: "arn:aws:iam::123456789012:role/MediaPackageRole",
      },
    }),
  );
  expect(created.Id).toBe(jobId);
  expect(created.Arn).toBeDefined();
  expect(created.ChannelId).toBe(channelId);
  expect(created.Status).toBe("IN_PROGRESS");

  const described = await client.send(
    new DescribeHarvestJobCommand({ Id: jobId }),
  );
  expect(described.Id).toBe(jobId);
  expect(described.OriginEndpointId).toBe(endpointId);
  expect(described.Status).toBe("SUCCEEDED");

  const listed = await client.send(
    new ListHarvestJobsCommand({ IncludeChannelId: channelId }),
  );
  expect((listed.HarvestJobs ?? []).map((j) => j.Id)).toContain(jobId);

  await client.send(new DeleteOriginEndpointCommand({ Id: endpointId }));
  await client.send(new DeleteChannelCommand({ Id: channelId }));
});

test("MediaPackage TagResource reflected in DescribeChannel", async () => {
  const client = mediapackage();
  const id = "bunsai-e2e-tagsync-channel";

  const created = await client.send(new CreateChannelCommand({ Id: id }));
  const arn = created.Arn ?? "";

  await client.send(
    new TagResourceCommand({ ResourceArn: arn, Tags: { env: "dev" } }),
  );

  const described = await client.send(new DescribeChannelCommand({ Id: id }));
  expect(described.Tags?.["env"]).toBe("dev");

  await client.send(
    new UntagResourceCommand({ ResourceArn: arn, TagKeys: ["env"] }),
  );

  const afterUntag = await client.send(new DescribeChannelCommand({ Id: id }));
  expect(afterUntag.Tags?.["env"]).toBeUndefined();

  await client.send(new DeleteChannelCommand({ Id: id }));
});

test("MediaPackage CreateHarvestJob missing startover window", async () => {
  const client = mediapackage();
  const channelId = "bunsai-e2e-hj-nosow-channel";
  const endpointId = "bunsai-e2e-hj-nosow-endpoint";

  await client.send(new CreateChannelCommand({ Id: channelId }));
  await client.send(
    new CreateOriginEndpointCommand({ ChannelId: channelId, Id: endpointId }),
  );

  await expect(
    client.send(
      new CreateHarvestJobCommand({
        Id: "bunsai-e2e-hj-nosow-job",
        OriginEndpointId: endpointId,
        StartTime: "2024-01-01T00:00:00Z",
        EndTime: "2024-01-02T00:00:00Z",
        S3Destination: {
          BucketName: "b",
          ManifestKey: "k",
          RoleArn: "arn:aws:iam::123:role/R",
        },
      }),
    ),
  ).rejects.toMatchObject({ name: "UnprocessableEntityException" });

  await client.send(new DeleteOriginEndpointCommand({ Id: endpointId }));
  await client.send(new DeleteChannelCommand({ Id: channelId }));
});

test("MediaPackage CreateHarvestJob EndTime before StartTime", async () => {
  const client = mediapackage();
  const channelId = "bunsai-e2e-hj-time-channel";
  const endpointId = "bunsai-e2e-hj-time-endpoint";

  await client.send(new CreateChannelCommand({ Id: channelId }));
  await client.send(
    new CreateOriginEndpointCommand({
      ChannelId: channelId,
      Id: endpointId,
      StartoverWindowSeconds: 300,
    }),
  );

  await expect(
    client.send(
      new CreateHarvestJobCommand({
        Id: "bunsai-e2e-hj-time-job",
        OriginEndpointId: endpointId,
        StartTime: "2024-01-02T00:00:00Z",
        EndTime: "2024-01-01T00:00:00Z",
        S3Destination: {
          BucketName: "b",
          ManifestKey: "k",
          RoleArn: "arn:aws:iam::123:role/R",
        },
      }),
    ),
  ).rejects.toMatchObject({ name: "UnprocessableEntityException" });

  await client.send(new DeleteOriginEndpointCommand({ Id: endpointId }));
  await client.send(new DeleteChannelCommand({ Id: channelId }));
});

test("MediaPackage CreateHarvestJob missing S3Destination", async () => {
  const client = mediapackage();
  const channelId = "bunsai-e2e-hj-val-channel";
  const endpointId = "bunsai-e2e-hj-val-endpoint";

  await client.send(new CreateChannelCommand({ Id: channelId }));
  await client.send(
    new CreateOriginEndpointCommand({
      ChannelId: channelId,
      Id: endpointId,
      StartoverWindowSeconds: 300,
    }),
  );

  await expect(
    client.send(
      new CreateHarvestJobCommand({
        Id: "bunsai-e2e-hj-missing-s3",
        OriginEndpointId: endpointId,
        StartTime: "2024-01-01T00:00:00Z",
        EndTime: "2024-01-02T00:00:00Z",
        S3Destination: { BucketName: "", ManifestKey: "", RoleArn: "" },
      }),
    ),
  ).rejects.toMatchObject({ name: "UnprocessableEntityException" });

  await client.send(new DeleteOriginEndpointCommand({ Id: endpointId }));
  await client.send(new DeleteChannelCommand({ Id: channelId }));
});

test("MediaPackage tagging operations", async () => {
  const client = mediapackage();
  const channelId = "bunsai-e2e-tag-channel";

  const created = await client.send(
    new CreateChannelCommand({ Id: channelId }),
  );
  const arn = created.Arn ?? "";

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      Tags: { env: "test", project: "bunsai" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(listed.Tags?.["env"]).toBe("test");
  expect(listed.Tags?.["project"]).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({
      ResourceArn: arn,
      TagKeys: ["env"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(afterUntag.Tags?.["env"]).toBeUndefined();
  expect(afterUntag.Tags?.["project"]).toBe("bunsai");

  await client.send(new DeleteChannelCommand({ Id: channelId }));
});

test("MediaPackage ListChannels pagination", async () => {
  const client = mediapackage();
  const ids = [
    "bunsai-e2e-pg-ch-a",
    "bunsai-e2e-pg-ch-b",
    "bunsai-e2e-pg-ch-c",
  ];

  for (const id of ids) {
    await client.send(new CreateChannelCommand({ Id: id }));
  }

  const page1 = await client.send(new ListChannelsCommand({ MaxResults: 2 }));
  expect((page1.Channels ?? []).length).toBe(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new ListChannelsCommand({ MaxResults: 2, NextToken: page1.NextToken }),
  );
  expect((page2.Channels ?? []).length).toBeGreaterThanOrEqual(1);

  const allIds = [
    ...(page1.Channels ?? []).map((c) => c.Id),
    ...(page2.Channels ?? []).map((c) => c.Id),
  ];
  for (const id of ids) {
    expect(allIds).toContain(id);
  }

  for (const id of ids) {
    await client.send(new DeleteChannelCommand({ Id: id }));
  }
});

test("MediaPackage create-time tags queryable via ListTagsForResource", async () => {
  const client = mediapackage();
  const channelId = "bunsai-e2e-create-tag-channel";

  const created = await client.send(
    new CreateChannelCommand({
      Id: channelId,
      Tags: { team: "bunsai", tier: "5" },
    }),
  );
  const arn = created.Arn ?? "";

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(listed.Tags?.["team"]).toBe("bunsai");
  expect(listed.Tags?.["tier"]).toBe("5");

  await client.send(new DeleteChannelCommand({ Id: channelId }));
});
