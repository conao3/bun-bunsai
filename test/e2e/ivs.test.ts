import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchGetChannelCommand,
  BatchGetStreamKeyCommand,
  BatchStartViewerSessionRevocationCommand,
  CreateAdConfigurationCommand,
  CreateChannelCommand,
  CreatePlaybackRestrictionPolicyCommand,
  CreateRecordingConfigurationCommand,
  CreateStreamKeyCommand,
  DeleteAdConfigurationCommand,
  DeleteChannelCommand,
  DeletePlaybackKeyPairCommand,
  DeletePlaybackRestrictionPolicyCommand,
  DeleteRecordingConfigurationCommand,
  DeleteStreamKeyCommand,
  GetAdConfigurationCommand,
  GetChannelCommand,
  GetPlaybackKeyPairCommand,
  GetPlaybackRestrictionPolicyCommand,
  GetRecordingConfigurationCommand,
  GetStreamCommand,
  GetStreamKeyCommand,
  GetStreamSessionCommand,
  ImportPlaybackKeyPairCommand,
  InsertAdBreakCommand,
  IvsClient,
  ListAdConfigurationsCommand,
  ListChannelsCommand,
  ListPlaybackKeyPairsCommand,
  ListPlaybackRestrictionPoliciesCommand,
  ListRecordingConfigurationsCommand,
  ListStreamKeysCommand,
  ListStreamSessionsCommand,
  ListStreamsCommand,
  ListTagsForResourceCommand,
  PutMetadataCommand,
  StartViewerSessionRevocationCommand,
  StopStreamCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateChannelCommand,
  UpdatePlaybackRestrictionPolicyCommand,
} from "@aws-sdk/client-ivs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ivs = () =>
  new IvsClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("IVS channel roundtrip", async () => {
  const client = ivs();
  const channelName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateChannelCommand({ name: channelName }),
  );
  expect(created.channel?.arn).toBeDefined();
  expect(created.channel?.name).toBe(channelName);
  expect(created.channel?.ingestEndpoint).toBeDefined();
  expect(created.channel?.playbackUrl).toBeDefined();
  const arn = created.channel?.arn ?? "";

  const got = await client.send(new GetChannelCommand({ arn }));
  expect(got.channel?.arn).toBe(arn);
  expect(got.channel?.name).toBe(channelName);

  const listed = await client.send(new ListChannelsCommand({}));
  expect((listed.channels ?? []).map((c) => c.arn)).toContain(arn);

  await client.send(new DeleteChannelCommand({ arn }));
  await expect(client.send(new GetChannelCommand({ arn }))).rejects.toThrow();
});

test("IVS UpdateChannel", async () => {
  const client = ivs();
  const created = await client.send(
    new CreateChannelCommand({ name: `update-test-${Date.now()}` }),
  );
  const arn = created.channel?.arn ?? "";

  const updated = await client.send(
    new UpdateChannelCommand({ arn, name: "updated-name" }),
  );
  expect(updated.channel?.name).toBe("updated-name");

  await client.send(new DeleteChannelCommand({ arn }));
});

test("IVS BatchGetChannel", async () => {
  const client = ivs();
  const c1 = await client.send(
    new CreateChannelCommand({ name: `batch-ch1-${Date.now()}` }),
  );
  const c2 = await client.send(
    new CreateChannelCommand({ name: `batch-ch2-${Date.now()}` }),
  );
  const arn1 = c1.channel?.arn ?? "";
  const arn2 = c2.channel?.arn ?? "";

  const result = await client.send(
    new BatchGetChannelCommand({
      arns: [
        arn1,
        arn2,
        "arn:aws:ivs:us-east-1:123456789012:channel/nonexistent",
      ],
    }),
  );
  expect(result.channels?.length).toBe(2);
  expect(result.errors?.length).toBe(1);

  await client.send(new DeleteChannelCommand({ arn: arn1 }));
  await client.send(new DeleteChannelCommand({ arn: arn2 }));
});

test("IVS stream key CRUD", async () => {
  const client = ivs();
  const ch = await client.send(
    new CreateChannelCommand({ name: `sk-test-${Date.now()}` }),
  );
  const channelArn = ch.channel?.arn ?? "";

  const created = await client.send(new CreateStreamKeyCommand({ channelArn }));
  expect(created.streamKey?.arn).toBeDefined();
  expect(created.streamKey?.value).toBeDefined();
  expect(created.streamKey?.channelArn).toBe(channelArn);
  const skArn = created.streamKey?.arn ?? "";

  const got = await client.send(new GetStreamKeyCommand({ arn: skArn }));
  expect(got.streamKey?.arn).toBe(skArn);

  const listed = await client.send(new ListStreamKeysCommand({ channelArn }));
  expect((listed.streamKeys ?? []).map((sk) => sk.arn)).toContain(skArn);

  const batch = await client.send(
    new BatchGetStreamKeyCommand({ arns: [skArn] }),
  );
  expect(batch.streamKeys?.length).toBe(1);

  await client.send(new DeleteStreamKeyCommand({ arn: skArn }));
  await expect(
    client.send(new GetStreamKeyCommand({ arn: skArn })),
  ).rejects.toThrow();

  await client.send(new DeleteChannelCommand({ arn: channelArn }));
});

test("IVS recording configuration CRUD", async () => {
  const client = ivs();

  const created = await client.send(
    new CreateRecordingConfigurationCommand({
      name: `rec-cfg-${Date.now()}`,
      destinationConfiguration: { s3: { bucketName: "my-test-bucket" } },
    }),
  );
  expect(created.recordingConfiguration?.arn).toBeDefined();
  expect(created.recordingConfiguration?.state).toBe("ACTIVE");
  const arn = created.recordingConfiguration?.arn ?? "";

  const got = await client.send(new GetRecordingConfigurationCommand({ arn }));
  expect(got.recordingConfiguration?.arn).toBe(arn);

  const listed = await client.send(new ListRecordingConfigurationsCommand({}));
  expect((listed.recordingConfigurations ?? []).map((rc) => rc.arn)).toContain(
    arn,
  );

  await client.send(new DeleteRecordingConfigurationCommand({ arn }));
  await expect(
    client.send(new GetRecordingConfigurationCommand({ arn })),
  ).rejects.toThrow();
});

test("IVS playback key pair CRUD", async () => {
  const client = ivs();

  const created = await client.send(
    new ImportPlaybackKeyPairCommand({
      publicKeyMaterial:
        "ssh-rsa AAAA mock-public-key-material test@example.com",
      name: `kp-${Date.now()}`,
    }),
  );
  expect(created.keyPair?.arn).toBeDefined();
  const arn = created.keyPair?.arn ?? "";

  const got = await client.send(new GetPlaybackKeyPairCommand({ arn }));
  expect(got.keyPair?.arn).toBe(arn);

  const listed = await client.send(new ListPlaybackKeyPairsCommand({}));
  expect((listed.keyPairs ?? []).map((kp) => kp.arn)).toContain(arn);

  await client.send(new DeletePlaybackKeyPairCommand({ arn }));
  await expect(
    client.send(new GetPlaybackKeyPairCommand({ arn })),
  ).rejects.toThrow();
});

test("IVS playback restriction policy CRUD", async () => {
  const client = ivs();

  const created = await client.send(
    new CreatePlaybackRestrictionPolicyCommand({
      allowedCountries: ["US", "JP"],
      allowedOrigins: ["https://example.com"],
      name: `policy-${Date.now()}`,
    }),
  );
  expect(created.playbackRestrictionPolicy?.arn).toBeDefined();
  const arn = created.playbackRestrictionPolicy?.arn ?? "";

  const got = await client.send(
    new GetPlaybackRestrictionPolicyCommand({ arn }),
  );
  expect(got.playbackRestrictionPolicy?.allowedCountries).toContain("US");

  const updated = await client.send(
    new UpdatePlaybackRestrictionPolicyCommand({
      arn,
      allowedCountries: ["GB"],
    }),
  );
  expect(updated.playbackRestrictionPolicy?.allowedCountries).toContain("GB");

  const listed = await client.send(
    new ListPlaybackRestrictionPoliciesCommand({}),
  );
  expect(
    (listed.playbackRestrictionPolicies ?? []).map((p) => p.arn),
  ).toContain(arn);

  await client.send(new DeletePlaybackRestrictionPolicyCommand({ arn }));
  await expect(
    client.send(new GetPlaybackRestrictionPolicyCommand({ arn })),
  ).rejects.toThrow();
});

test("IVS ad configuration CRUD", async () => {
  const client = ivs();

  const created = await client.send(
    new CreateAdConfigurationCommand({
      name: `ad-cfg-${Date.now()}`,
      mediaTailorPlaybackConfigurations: [
        {
          playbackConfigurationArn:
            "arn:aws:mediatailor:us-east-1:123456789012:playbackConfiguration/test",
        },
      ],
    }),
  );
  expect(created.adConfiguration?.arn).toBeDefined();
  const arn = created.adConfiguration?.arn ?? "";

  const got = await client.send(new GetAdConfigurationCommand({ arn }));
  expect(got.adConfiguration?.arn).toBe(arn);

  const listed = await client.send(new ListAdConfigurationsCommand({}));
  expect((listed.adConfigurations ?? []).map((ac) => ac.arn)).toContain(arn);

  await client.send(new DeleteAdConfigurationCommand({ arn }));
  await expect(
    client.send(new GetAdConfigurationCommand({ arn })),
  ).rejects.toThrow();
});

test("IVS stream and stream session", async () => {
  const client = ivs();
  const ch = await client.send(
    new CreateChannelCommand({ name: `stream-test-${Date.now()}` }),
  );
  const channelArn = ch.channel?.arn ?? "";

  const stream = await client.send(new GetStreamCommand({ channelArn }));
  expect(stream.stream?.channelArn).toBe(channelArn);
  expect(stream.stream?.streamId).toBeDefined();
  expect(stream.stream?.state).toBe("LIVE");

  const streams = await client.send(new ListStreamsCommand({}));
  expect((streams.streams ?? []).map((s) => s.channelArn)).toContain(
    channelArn,
  );

  const session = await client.send(
    new GetStreamSessionCommand({ channelArn }),
  );
  expect(session.streamSession?.streamId).toBeDefined();

  const sessions = await client.send(
    new ListStreamSessionsCommand({ channelArn }),
  );
  expect(sessions.streamSessions).toBeDefined();

  await client.send(new StopStreamCommand({ channelArn }));

  await client.send(new DeleteChannelCommand({ arn: channelArn }));
});

test("IVS PutMetadata and InsertAdBreak", async () => {
  const client = ivs();
  const ch = await client.send(
    new CreateChannelCommand({ name: `meta-test-${Date.now()}` }),
  );
  const channelArn = ch.channel?.arn ?? "";

  await client.send(
    new PutMetadataCommand({ channelArn, metadata: '{"key":"value"}' }),
  );

  const adBreak = await client.send(
    new InsertAdBreakCommand({ channelArn, durationSeconds: 30 }),
  );
  expect(adBreak.adBreakId).toBeDefined();

  await client.send(new DeleteChannelCommand({ arn: channelArn }));
});

test("IVS StartViewerSessionRevocation and Batch", async () => {
  const client = ivs();
  const ch = await client.send(
    new CreateChannelCommand({ name: `revoke-test-${Date.now()}` }),
  );
  const channelArn = ch.channel?.arn ?? "";

  await client.send(
    new StartViewerSessionRevocationCommand({
      channelArn,
      viewerId: "viewer-123",
    }),
  );

  const batchResult = await client.send(
    new BatchStartViewerSessionRevocationCommand({
      viewerSessions: [{ channelArn, viewerId: "viewer-456" }],
    }),
  );
  expect(batchResult.errors).toBeDefined();

  await client.send(new DeleteChannelCommand({ arn: channelArn }));
});

test("IVS tags CRUD", async () => {
  const client = ivs();
  const ch = await client.send(
    new CreateChannelCommand({ name: `tag-test-${Date.now()}` }),
  );
  const resourceArn = ch.channel?.arn ?? "";

  await client.send(
    new TagResourceCommand({ resourceArn, tags: { env: "test", app: "ivs" } }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listed.tags?.env).toBe("test");
  expect(listed.tags?.app).toBe("ivs");

  await client.send(
    new UntagResourceCommand({ resourceArn, tagKeys: ["app"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(afterUntag.tags?.env).toBe("test");
  expect(afterUntag.tags?.app).toBeUndefined();

  await client.send(new DeleteChannelCommand({ arn: resourceArn }));
});
