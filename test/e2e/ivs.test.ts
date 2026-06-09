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
  expect(created.recordingConfiguration?.state).toBe("CREATING");
  const arn = created.recordingConfiguration?.arn ?? "";

  const got = await client.send(new GetRecordingConfigurationCommand({ arn }));
  expect(got.recordingConfiguration?.arn).toBe(arn);
  expect(got.recordingConfiguration?.state).toBe("ACTIVE");

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

test("IVS CreateChannel persists default StreamKey", async () => {
  const client = ivs();
  const ch = await client.send(
    new CreateChannelCommand({ name: `sk-default-${Date.now()}` }),
  );
  const channelArn = ch.channel?.arn ?? "";
  const skArn = ch.streamKey?.arn ?? "";
  expect(skArn).toBeDefined();

  const got = await client.send(new GetStreamKeyCommand({ arn: skArn }));
  expect(got.streamKey?.arn).toBe(skArn);
  expect(got.streamKey?.channelArn).toBe(channelArn);

  const listed = await client.send(new ListStreamKeysCommand({ channelArn }));
  expect((listed.streamKeys ?? []).map((sk) => sk.arn)).toContain(skArn);

  await client.send(new DeleteChannelCommand({ arn: channelArn }));
});

test("IVS ListChannels pagination and filters", async () => {
  const client = ivs();
  const rc = await client.send(
    new CreateRecordingConfigurationCommand({
      name: `rc-filter-${Date.now()}`,
      destinationConfiguration: { s3: { bucketName: "test-bucket" } },
    }),
  );
  const rcArn = rc.recordingConfiguration?.arn ?? "";

  const ch1 = await client.send(
    new CreateChannelCommand({
      name: `pag-ch1-${Date.now()}`,
      recordingConfigurationArn: rcArn,
    }),
  );
  const ch2 = await client.send(
    new CreateChannelCommand({ name: `pag-ch2-${Date.now()}` }),
  );
  const arn1 = ch1.channel?.arn ?? "";
  const arn2 = ch2.channel?.arn ?? "";

  const page1 = await client.send(new ListChannelsCommand({ maxResults: 1 }));
  expect(page1.channels?.length).toBe(1);
  expect(page1.nextToken).toBeDefined();

  const page2 = await client.send(
    new ListChannelsCommand({ maxResults: 100, nextToken: page1.nextToken }),
  );
  const allArns = [
    ...(page1.channels ?? []).map((c) => c.arn),
    ...(page2.channels ?? []).map((c) => c.arn),
  ];
  expect(allArns).toContain(arn1);
  expect(allArns).toContain(arn2);

  const filtered = await client.send(
    new ListChannelsCommand({ filterByRecordingConfigurationArn: rcArn }),
  );
  expect((filtered.channels ?? []).map((c) => c.arn)).toContain(arn1);
  expect((filtered.channels ?? []).map((c) => c.arn)).not.toContain(arn2);

  await client.send(new DeleteChannelCommand({ arn: arn1 }));
  await client.send(new DeleteChannelCommand({ arn: arn2 }));
  await client.send(new DeleteRecordingConfigurationCommand({ arn: rcArn }));
});

test("IVS tag round-trip: create tags visible in ListTagsForResource and GetChannel", async () => {
  const client = ivs();
  const ch = await client.send(
    new CreateChannelCommand({
      name: `tag-rt-${Date.now()}`,
      tags: { env: "staging" },
    }),
  );
  const arn = ch.channel?.arn ?? "";

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(listed.tags?.env).toBe("staging");

  await client.send(
    new TagResourceCommand({ resourceArn: arn, tags: { app: "bunsai" } }),
  );

  const got = await client.send(new GetChannelCommand({ arn }));
  expect((got.channel?.tags as Record<string, string>)?.env).toBe("staging");
  expect((got.channel?.tags as Record<string, string>)?.app).toBe("bunsai");

  await client.send(new DeleteChannelCommand({ arn }));
});

test("IVS StopStream persists session with endTime", async () => {
  const client = ivs();
  const ch = await client.send(
    new CreateChannelCommand({ name: `stop-test-${Date.now()}` }),
  );
  const channelArn = ch.channel?.arn ?? "";

  const session = await client.send(
    new GetStreamSessionCommand({ channelArn }),
  );
  const streamId = session.streamSession?.streamId ?? "";
  expect(streamId).toBeDefined();

  await client.send(new StopStreamCommand({ channelArn }));

  const past = await client.send(
    new GetStreamSessionCommand({ channelArn, streamId }),
  );
  expect(past.streamSession?.streamId).toBe(streamId);
  expect(past.streamSession?.endTime).toBeDefined();

  const sessions = await client.send(
    new ListStreamSessionsCommand({ channelArn }),
  );
  const found = (sessions.streamSessions ?? []).find(
    (s) => s.streamId === streamId,
  );
  expect(found).toBeDefined();
  expect(found?.endTime).toBeDefined();

  await client.send(new DeleteChannelCommand({ arn: channelArn }));
});

test("IVS GetStreamSession includes ingestConfiguration", async () => {
  const client = ivs();
  const rc = await client.send(
    new CreateRecordingConfigurationCommand({
      name: `rc-session-${Date.now()}`,
      destinationConfiguration: { s3: { bucketName: "test-bucket" } },
    }),
  );
  const rcArn = rc.recordingConfiguration?.arn ?? "";
  await client.send(new GetRecordingConfigurationCommand({ arn: rcArn }));

  const ch = await client.send(
    new CreateChannelCommand({
      name: `session-ingest-${Date.now()}`,
      recordingConfigurationArn: rcArn,
    }),
  );
  const channelArn = ch.channel?.arn ?? "";

  const session = await client.send(
    new GetStreamSessionCommand({ channelArn }),
  );
  expect(session.streamSession?.ingestConfiguration?.video?.codec).toBe("AVC");
  expect(session.streamSession?.ingestConfiguration?.audio?.codec).toBe("AAC");
  expect(session.streamSession?.recordingConfiguration?.arn).toBe(rcArn);

  await client.send(new DeleteChannelCommand({ arn: channelArn }));
  await client.send(new DeleteRecordingConfigurationCommand({ arn: rcArn }));
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

test("IVS CreateChannel with unknown recordingConfigurationArn → ResourceNotFoundException", async () => {
  const client = ivs();
  const bogusArn =
    "arn:aws:ivs:us-east-1:123456789012:recording-configuration/doesnotexist";
  await expect(
    client.send(
      new CreateChannelCommand({
        name: `ref-val-test-${Date.now()}`,
        recordingConfigurationArn: bogusArn,
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
});

test("IVS UpdateChannel with unknown playbackRestrictionPolicyArn → ResourceNotFoundException", async () => {
  const client = ivs();
  const ch = await client.send(
    new CreateChannelCommand({ name: `upd-ref-test-${Date.now()}` }),
  );
  const arn = ch.channel?.arn ?? "";
  const bogusArn =
    "arn:aws:ivs:us-east-1:123456789012:playback-restriction-policy/doesnotexist";
  await expect(
    client.send(
      new UpdateChannelCommand({ arn, playbackRestrictionPolicyArn: bogusArn }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
  await client.send(new DeleteChannelCommand({ arn }));
});

test("IVS StopStream on non-broadcasting channel → ChannelNotBroadcasting", async () => {
  const client = ivs();
  const ch = await client.send(
    new CreateChannelCommand({ name: `stop-nolive-${Date.now()}` }),
  );
  const channelArn = ch.channel?.arn ?? "";
  await expect(
    client.send(new StopStreamCommand({ channelArn })),
  ).rejects.toMatchObject({ name: "ChannelNotBroadcasting" });
  await client.send(new DeleteChannelCommand({ arn: channelArn }));
});

test("IVS DeleteRecordingConfiguration while referenced → ConflictException", async () => {
  const client = ivs();
  const rc = await client.send(
    new CreateRecordingConfigurationCommand({
      name: `rc-conflict-${Date.now()}`,
      destinationConfiguration: { s3: { bucketName: "test-bucket" } },
    }),
  );
  const rcArn = rc.recordingConfiguration?.arn ?? "";
  const ch = await client.send(
    new CreateChannelCommand({
      name: `ch-rcref-${Date.now()}`,
      recordingConfigurationArn: rcArn,
    }),
  );
  const chArn = ch.channel?.arn ?? "";
  await expect(
    client.send(new DeleteRecordingConfigurationCommand({ arn: rcArn })),
  ).rejects.toMatchObject({ name: "ConflictException" });
  await client.send(
    new UpdateChannelCommand({ arn: chArn, recordingConfigurationArn: "" }),
  );
  await client.send(new DeleteRecordingConfigurationCommand({ arn: rcArn }));
  await client.send(new DeleteChannelCommand({ arn: chArn }));
});

test("IVS DeletePlaybackRestrictionPolicy while referenced → ConflictException", async () => {
  const client = ivs();
  const prp = await client.send(
    new CreatePlaybackRestrictionPolicyCommand({
      allowedCountries: ["US"],
      allowedOrigins: ["https://example.com"],
      name: `prp-conflict-${Date.now()}`,
    }),
  );
  const prpArn = prp.playbackRestrictionPolicy?.arn ?? "";
  const ch = await client.send(
    new CreateChannelCommand({
      name: `ch-prpref-${Date.now()}`,
      playbackRestrictionPolicyArn: prpArn,
    }),
  );
  const chArn = ch.channel?.arn ?? "";
  await expect(
    client.send(new DeletePlaybackRestrictionPolicyCommand({ arn: prpArn })),
  ).rejects.toMatchObject({ name: "ConflictException" });
  await client.send(
    new UpdateChannelCommand({ arn: chArn, playbackRestrictionPolicyArn: "" }),
  );
  await client.send(
    new DeletePlaybackRestrictionPolicyCommand({ arn: prpArn }),
  );
  await client.send(new DeleteChannelCommand({ arn: chArn }));
});

test("IVS DeleteAdConfiguration while referenced → ConflictException", async () => {
  const client = ivs();
  const ac = await client.send(
    new CreateAdConfigurationCommand({
      name: `ac-conflict-${Date.now()}`,
      mediaTailorPlaybackConfigurations: [],
    }),
  );
  const acArn = ac.adConfiguration?.arn ?? "";
  const ch = await client.send(
    new CreateChannelCommand({
      name: `ch-acref-${Date.now()}`,
      adConfigurationArn: acArn,
    }),
  );
  const chArn = ch.channel?.arn ?? "";
  await expect(
    client.send(new DeleteAdConfigurationCommand({ arn: acArn })),
  ).rejects.toMatchObject({ name: "ConflictException" });
  await client.send(
    new UpdateChannelCommand({ arn: chArn, adConfigurationArn: "" }),
  );
  await client.send(new DeleteAdConfigurationCommand({ arn: acArn }));
  await client.send(new DeleteChannelCommand({ arn: chArn }));
});

test("IVS DeleteChannel cascades stream keys", async () => {
  const client = ivs();
  const ch = await client.send(
    new CreateChannelCommand({ name: `cascade-test-${Date.now()}` }),
  );
  const chArn = ch.channel?.arn ?? "";
  await client.send(new CreateStreamKeyCommand({ channelArn: chArn }));
  const before = await client.send(
    new ListStreamKeysCommand({ channelArn: chArn }),
  );
  expect((before.streamKeys ?? []).length).toBeGreaterThanOrEqual(2);
  await client.send(new DeleteChannelCommand({ arn: chArn }));
  const ch2 = await client.send(
    new CreateChannelCommand({ name: `cascade-check-${Date.now()}` }),
  );
  const ch2Arn = ch2.channel?.arn ?? "";
  const allKeys = await client.send(
    new ListStreamKeysCommand({ channelArn: ch2Arn }),
  );
  const orphans = (allKeys.streamKeys ?? []).filter(
    (sk) => sk.channelArn === chArn,
  );
  expect(orphans.length).toBe(0);
  await client.send(new DeleteChannelCommand({ arn: ch2Arn }));
});

test("IVS ListStreamSessions paginates with maxResults + nextToken", async () => {
  const client = ivs();
  const ch = await client.send(
    new CreateChannelCommand({ name: `sess-page-${Date.now()}` }),
  );
  const channelArn = ch.channel?.arn ?? "";
  for (let i = 0; i < 3; i++) {
    await client.send(new GetStreamSessionCommand({ channelArn }));
    await client.send(new StopStreamCommand({ channelArn }));
  }
  const page1 = await client.send(
    new ListStreamSessionsCommand({ channelArn, maxResults: 2 }),
  );
  expect((page1.streamSessions ?? []).length).toBe(2);
  expect(page1.nextToken).toBeDefined();
  const page2 = await client.send(
    new ListStreamSessionsCommand({
      channelArn,
      maxResults: 2,
      nextToken: page1.nextToken,
    }),
  );
  expect((page2.streamSessions ?? []).length).toBeGreaterThanOrEqual(1);
  await client.send(new DeleteChannelCommand({ arn: channelArn }));
});

test("IVS ListPlaybackRestrictionPolicies paginates with maxResults + nextToken", async () => {
  const client = ivs();
  const arns: string[] = [];
  for (let i = 0; i < 3; i++) {
    const p = await client.send(
      new CreatePlaybackRestrictionPolicyCommand({
        allowedCountries: ["US"],
        allowedOrigins: ["https://example.com"],
        name: `prp-page-${Date.now()}-${i}`,
      }),
    );
    arns.push(p.playbackRestrictionPolicy?.arn ?? "");
  }
  const page1 = await client.send(
    new ListPlaybackRestrictionPoliciesCommand({ maxResults: 2 }),
  );
  expect((page1.playbackRestrictionPolicies ?? []).length).toBe(2);
  expect(page1.nextToken).toBeDefined();
  const page2 = await client.send(
    new ListPlaybackRestrictionPoliciesCommand({
      maxResults: 2,
      nextToken: page1.nextToken,
    }),
  );
  expect(
    (page2.playbackRestrictionPolicies ?? []).length,
  ).toBeGreaterThanOrEqual(1);
  for (const arn of arns) {
    await client.send(new DeletePlaybackRestrictionPolicyCommand({ arn }));
  }
});

test("IVS ListAdConfigurations paginates with maxResults + nextToken", async () => {
  const client = ivs();
  const arns: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a = await client.send(
      new CreateAdConfigurationCommand({
        name: `ac-page-${Date.now()}-${i}`,
        mediaTailorPlaybackConfigurations: [],
      }),
    );
    arns.push(a.adConfiguration?.arn ?? "");
  }
  const page1 = await client.send(
    new ListAdConfigurationsCommand({ maxResults: 2 }),
  );
  expect((page1.adConfigurations ?? []).length).toBe(2);
  expect(page1.nextToken).toBeDefined();
  const page2 = await client.send(
    new ListAdConfigurationsCommand({
      maxResults: 2,
      nextToken: page1.nextToken,
    }),
  );
  expect((page2.adConfigurations ?? []).length).toBeGreaterThanOrEqual(1);
  for (const arn of arns) {
    await client.send(new DeleteAdConfigurationCommand({ arn }));
  }
});

test("IVS TagResource / ListTagsForResource / UntagResource on bogus ARN → ResourceNotFoundException", async () => {
  const client = ivs();
  const bogusArn = "arn:aws:ivs:us-east-1:123456789012:channel/doesnotexist";
  await expect(
    client.send(
      new TagResourceCommand({ resourceArn: bogusArn, tags: { k: "v" } }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
  await expect(
    client.send(new ListTagsForResourceCommand({ resourceArn: bogusArn })),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
  await expect(
    client.send(
      new UntagResourceCommand({ resourceArn: bogusArn, tagKeys: ["k"] }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
});
