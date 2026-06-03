import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  ConfigureLogsForChannelCommand,
  ConfigureLogsForPlaybackConfigurationCommand,
  CreateChannelCommand,
  CreateLiveSourceCommand,
  CreatePrefetchScheduleCommand,
  CreateProgramCommand,
  CreateSourceLocationCommand,
  CreateVodSourceCommand,
  DeleteChannelCommand,
  DeleteChannelPolicyCommand,
  DeleteLiveSourceCommand,
  DeletePlaybackConfigurationCommand,
  DeletePrefetchScheduleCommand,
  DeleteProgramCommand,
  DeleteSourceLocationCommand,
  DeleteVodSourceCommand,
  DescribeChannelCommand,
  DescribeLiveSourceCommand,
  DescribeProgramCommand,
  DescribeSourceLocationCommand,
  DescribeVodSourceCommand,
  GetChannelPolicyCommand,
  GetChannelScheduleCommand,
  GetPlaybackConfigurationCommand,
  GetPrefetchScheduleCommand,
  ListAlertsCommand,
  ListChannelsCommand,
  ListLiveSourcesCommand,
  ListPlaybackConfigurationsCommand,
  ListPrefetchSchedulesCommand,
  ListSourceLocationsCommand,
  ListTagsForResourceCommand,
  ListVodSourcesCommand,
  MediaTailorClient,
  PutChannelPolicyCommand,
  PutPlaybackConfigurationCommand,
  StartChannelCommand,
  StopChannelCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateChannelCommand,
  UpdateLiveSourceCommand,
  UpdateProgramCommand,
  UpdateSourceLocationCommand,
  UpdateVodSourceCommand,
} from "@aws-sdk/client-mediatailor";

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

const mediatailor = () =>
  new MediaTailorClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("MediaTailor playback configuration roundtrip", async () => {
  const client = mediatailor();
  const name = `bunsai-e2e-${Date.now()}`;

  const put = await client.send(
    new PutPlaybackConfigurationCommand({
      Name: name,
      AdDecisionServerUrl: "https://ads.example.com/vmap",
      VideoContentSourceUrl: "https://content.example.com/master.m3u8",
    }),
  );
  expect(put.Name).toBe(name);
  expect(put.PlaybackConfigurationArn).toBeDefined();
  expect(put.AdDecisionServerUrl).toBe("https://ads.example.com/vmap");

  const got = await client.send(
    new GetPlaybackConfigurationCommand({ Name: name }),
  );
  expect(got.Name).toBe(name);
  expect(got.PlaybackConfigurationArn).toBe(put.PlaybackConfigurationArn);
  expect(got.VideoContentSourceUrl).toBe(
    "https://content.example.com/master.m3u8",
  );

  const listed = await client.send(new ListPlaybackConfigurationsCommand({}));
  expect((listed.Items ?? []).map((c) => c.Name)).toContain(name);

  await client.send(new DeletePlaybackConfigurationCommand({ Name: name }));
  await expect(
    client.send(new GetPlaybackConfigurationCommand({ Name: name })),
  ).rejects.toThrow();
});

test("MediaTailor channel roundtrip", async () => {
  const client = mediatailor();
  const suffix = `${Date.now()}`;
  const channelName = `ch-${suffix}`;

  const created = await client.send(
    new CreateChannelCommand({
      ChannelName: channelName,
      Outputs: [{ ManifestName: "index", SourceGroup: "default" }],
      PlaybackMode: "LOOP",
    }),
  );
  expect(created.ChannelName).toBe(channelName);
  expect(created.Arn).toContain(channelName);
  expect(created.ChannelState).toBe("STOPPED");

  const described = await client.send(
    new DescribeChannelCommand({ ChannelName: channelName }),
  );
  expect(described.ChannelName).toBe(channelName);
  expect(described.LogConfiguration).toBeDefined();

  const listed = await client.send(new ListChannelsCommand({}));
  expect((listed.Items ?? []).map((c) => c.ChannelName)).toContain(channelName);

  await client.send(new StartChannelCommand({ ChannelName: channelName }));
  const started = await client.send(
    new DescribeChannelCommand({ ChannelName: channelName }),
  );
  expect(started.ChannelState).toBe("RUNNING");

  await client.send(new StopChannelCommand({ ChannelName: channelName }));
  const stopped = await client.send(
    new DescribeChannelCommand({ ChannelName: channelName }),
  );
  expect(stopped.ChannelState).toBe("STOPPED");

  const updated = await client.send(
    new UpdateChannelCommand({
      ChannelName: channelName,
      Outputs: [
        { ManifestName: "index", SourceGroup: "default" },
        { ManifestName: "index2", SourceGroup: "hd" },
      ],
    }),
  );
  expect((updated.Outputs ?? []).length).toBe(2);

  const schedule = await client.send(
    new GetChannelScheduleCommand({ ChannelName: channelName }),
  );
  expect(schedule.Items).toBeDefined();

  await client.send(new DeleteChannelCommand({ ChannelName: channelName }));
  await expect(
    client.send(new DescribeChannelCommand({ ChannelName: channelName })),
  ).rejects.toThrow();
});

test("MediaTailor channel policy roundtrip", async () => {
  const client = mediatailor();
  const channelName = `ch-policy-${Date.now()}`;

  await client.send(
    new CreateChannelCommand({
      ChannelName: channelName,
      Outputs: [{ ManifestName: "index", SourceGroup: "default" }],
      PlaybackMode: "LOOP",
    }),
  );

  const policy = JSON.stringify({ Version: "2012-10-17", Statement: [] });
  await client.send(
    new PutChannelPolicyCommand({ ChannelName: channelName, Policy: policy }),
  );

  const got = await client.send(
    new GetChannelPolicyCommand({ ChannelName: channelName }),
  );
  expect(got.Policy).toBe(policy);

  await client.send(
    new DeleteChannelPolicyCommand({ ChannelName: channelName }),
  );

  await client.send(new DeleteChannelCommand({ ChannelName: channelName }));
});

test("MediaTailor configure logs for channel", async () => {
  const client = mediatailor();
  const channelName = `ch-logs-${Date.now()}`;

  await client.send(
    new CreateChannelCommand({
      ChannelName: channelName,
      Outputs: [{ ManifestName: "index", SourceGroup: "default" }],
      PlaybackMode: "LOOP",
    }),
  );

  const result = await client.send(
    new ConfigureLogsForChannelCommand({
      ChannelName: channelName,
      LogTypes: [],
    }),
  );
  expect(result.ChannelName).toBe(channelName);

  await client.send(new DeleteChannelCommand({ ChannelName: channelName }));
});

test("MediaTailor configure logs for playback configuration", async () => {
  const client = mediatailor();
  const name = `pc-logs-${Date.now()}`;

  const result = await client.send(
    new ConfigureLogsForPlaybackConfigurationCommand({
      PlaybackConfigurationName: name,
      PercentEnabled: 50,
    }),
  );
  expect(result.PercentEnabled).toBe(50);
  expect(result.PlaybackConfigurationName).toBe(name);
});

test("MediaTailor source location roundtrip", async () => {
  const client = mediatailor();
  const suffix = `${Date.now()}`;
  const sourceLocationName = `sl-${suffix}`;

  const created = await client.send(
    new CreateSourceLocationCommand({
      SourceLocationName: sourceLocationName,
      HttpConfiguration: { BaseUrl: "https://content.example.com" },
    }),
  );
  expect(created.SourceLocationName).toBe(sourceLocationName);
  expect(created.Arn).toContain(sourceLocationName);

  const described = await client.send(
    new DescribeSourceLocationCommand({
      SourceLocationName: sourceLocationName,
    }),
  );
  expect(described.SourceLocationName).toBe(sourceLocationName);
  expect(described.HttpConfiguration?.BaseUrl).toBe(
    "https://content.example.com",
  );

  const listed = await client.send(new ListSourceLocationsCommand({}));
  expect((listed.Items ?? []).map((s) => s.SourceLocationName)).toContain(
    sourceLocationName,
  );

  const updated = await client.send(
    new UpdateSourceLocationCommand({
      SourceLocationName: sourceLocationName,
      HttpConfiguration: { BaseUrl: "https://content2.example.com" },
    }),
  );
  expect(updated.HttpConfiguration?.BaseUrl).toBe(
    "https://content2.example.com",
  );

  await client.send(
    new DeleteSourceLocationCommand({
      SourceLocationName: sourceLocationName,
    }),
  );
  await expect(
    client.send(
      new DescribeSourceLocationCommand({
        SourceLocationName: sourceLocationName,
      }),
    ),
  ).rejects.toThrow();
});

test("MediaTailor live source roundtrip", async () => {
  const client = mediatailor();
  const suffix = `${Date.now()}`;
  const sourceLocationName = `sl-ls-${suffix}`;
  const liveSourceName = `ls-${suffix}`;

  await client.send(
    new CreateSourceLocationCommand({
      SourceLocationName: sourceLocationName,
      HttpConfiguration: { BaseUrl: "https://live.example.com" },
    }),
  );

  const created = await client.send(
    new CreateLiveSourceCommand({
      SourceLocationName: sourceLocationName,
      LiveSourceName: liveSourceName,
      HttpPackageConfigurations: [
        { Path: "/live/index.m3u8", SourceGroup: "default", Type: "HLS" },
      ],
    }),
  );
  expect(created.LiveSourceName).toBe(liveSourceName);
  expect(created.SourceLocationName).toBe(sourceLocationName);

  const described = await client.send(
    new DescribeLiveSourceCommand({
      SourceLocationName: sourceLocationName,
      LiveSourceName: liveSourceName,
    }),
  );
  expect(described.LiveSourceName).toBe(liveSourceName);

  const listed = await client.send(
    new ListLiveSourcesCommand({ SourceLocationName: sourceLocationName }),
  );
  expect((listed.Items ?? []).map((s) => s.LiveSourceName)).toContain(
    liveSourceName,
  );

  const updated = await client.send(
    new UpdateLiveSourceCommand({
      SourceLocationName: sourceLocationName,
      LiveSourceName: liveSourceName,
      HttpPackageConfigurations: [
        { Path: "/live/index2.m3u8", SourceGroup: "hd", Type: "HLS" },
      ],
    }),
  );
  expect(updated.HttpPackageConfigurations?.[0]?.Path).toBe(
    "/live/index2.m3u8",
  );

  await client.send(
    new DeleteLiveSourceCommand({
      SourceLocationName: sourceLocationName,
      LiveSourceName: liveSourceName,
    }),
  );

  await client.send(
    new DeleteSourceLocationCommand({
      SourceLocationName: sourceLocationName,
    }),
  );
});

test("MediaTailor VOD source roundtrip", async () => {
  const client = mediatailor();
  const suffix = `${Date.now()}`;
  const sourceLocationName = `sl-vs-${suffix}`;
  const vodSourceName = `vs-${suffix}`;

  await client.send(
    new CreateSourceLocationCommand({
      SourceLocationName: sourceLocationName,
      HttpConfiguration: { BaseUrl: "https://vod.example.com" },
    }),
  );

  const created = await client.send(
    new CreateVodSourceCommand({
      SourceLocationName: sourceLocationName,
      VodSourceName: vodSourceName,
      HttpPackageConfigurations: [
        { Path: "/vod/index.m3u8", SourceGroup: "default", Type: "HLS" },
      ],
    }),
  );
  expect(created.VodSourceName).toBe(vodSourceName);
  expect(created.SourceLocationName).toBe(sourceLocationName);

  const described = await client.send(
    new DescribeVodSourceCommand({
      SourceLocationName: sourceLocationName,
      VodSourceName: vodSourceName,
    }),
  );
  expect(described.VodSourceName).toBe(vodSourceName);

  const listed = await client.send(
    new ListVodSourcesCommand({ SourceLocationName: sourceLocationName }),
  );
  expect((listed.Items ?? []).map((s) => s.VodSourceName)).toContain(
    vodSourceName,
  );

  const updated = await client.send(
    new UpdateVodSourceCommand({
      SourceLocationName: sourceLocationName,
      VodSourceName: vodSourceName,
      HttpPackageConfigurations: [
        { Path: "/vod/index2.m3u8", SourceGroup: "hd", Type: "HLS" },
      ],
    }),
  );
  expect(updated.HttpPackageConfigurations?.[0]?.Path).toBe("/vod/index2.m3u8");

  await client.send(
    new DeleteVodSourceCommand({
      SourceLocationName: sourceLocationName,
      VodSourceName: vodSourceName,
    }),
  );

  await client.send(
    new DeleteSourceLocationCommand({
      SourceLocationName: sourceLocationName,
    }),
  );
});

test("MediaTailor program roundtrip", async () => {
  const client = mediatailor();
  const suffix = `${Date.now()}`;
  const channelName = `ch-prog-${suffix}`;
  const sourceLocationName = `sl-prog-${suffix}`;
  const programName = `prog-${suffix}`;

  await client.send(
    new CreateChannelCommand({
      ChannelName: channelName,
      Outputs: [{ ManifestName: "index", SourceGroup: "default" }],
      PlaybackMode: "LINEAR",
    }),
  );
  await client.send(
    new CreateSourceLocationCommand({
      SourceLocationName: sourceLocationName,
      HttpConfiguration: { BaseUrl: "https://vod.example.com" },
    }),
  );

  const created = await client.send(
    new CreateProgramCommand({
      ChannelName: channelName,
      ProgramName: programName,
      SourceLocationName: sourceLocationName,
      ScheduleConfiguration: {
        Transition: {
          RelativePosition: "AFTER_PROGRAM",
          Type: "RELATIVE",
        },
      },
    }),
  );
  expect(created.ProgramName).toBe(programName);
  expect(created.ChannelName).toBe(channelName);

  const described = await client.send(
    new DescribeProgramCommand({
      ChannelName: channelName,
      ProgramName: programName,
    }),
  );
  expect(described.ProgramName).toBe(programName);

  const updated = await client.send(
    new UpdateProgramCommand({
      ChannelName: channelName,
      ProgramName: programName,
      ScheduleConfiguration: {
        Transition: {
          RelativePosition: "BEFORE_PROGRAM",
          Type: "RELATIVE",
        },
      },
    }),
  );
  expect(updated.ProgramName).toBe(programName);

  await client.send(
    new DeleteProgramCommand({
      ChannelName: channelName,
      ProgramName: programName,
    }),
  );
  await expect(
    client.send(
      new DescribeProgramCommand({
        ChannelName: channelName,
        ProgramName: programName,
      }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteChannelCommand({ ChannelName: channelName }));
  await client.send(
    new DeleteSourceLocationCommand({
      SourceLocationName: sourceLocationName,
    }),
  );
});

test("MediaTailor prefetch schedule roundtrip", async () => {
  const client = mediatailor();
  const suffix = `${Date.now()}`;
  const playbackConfigName = `pc-pf-${suffix}`;
  const scheduleName = `pf-${suffix}`;

  const created = await client.send(
    new CreatePrefetchScheduleCommand({
      PlaybackConfigurationName: playbackConfigName,
      Name: scheduleName,
    }),
  );
  expect(created.Name).toBe(scheduleName);
  expect(created.PlaybackConfigurationName).toBe(playbackConfigName);
  expect(created.Arn).toContain(scheduleName);

  const got = await client.send(
    new GetPrefetchScheduleCommand({
      PlaybackConfigurationName: playbackConfigName,
      Name: scheduleName,
    }),
  );
  expect(got.Name).toBe(scheduleName);

  const listed = await client.send(
    new ListPrefetchSchedulesCommand({
      PlaybackConfigurationName: playbackConfigName,
    }),
  );
  expect((listed.Items ?? []).map((s) => s.Name)).toContain(scheduleName);

  await client.send(
    new DeletePrefetchScheduleCommand({
      PlaybackConfigurationName: playbackConfigName,
      Name: scheduleName,
    }),
  );
  await expect(
    client.send(
      new GetPrefetchScheduleCommand({
        PlaybackConfigurationName: playbackConfigName,
        Name: scheduleName,
      }),
    ),
  ).rejects.toThrow();
});

test("MediaTailor list alerts", async () => {
  const client = mediatailor();
  const suffix = `${Date.now()}`;
  const channelName = `ch-alerts-${suffix}`;

  await client.send(
    new CreateChannelCommand({
      ChannelName: channelName,
      Outputs: [{ ManifestName: "index", SourceGroup: "default" }],
      PlaybackMode: "LOOP",
    }),
  );

  const arn = `arn:aws:mediatailor:${region}:000000000000:channel/${channelName}`;
  const result = await client.send(new ListAlertsCommand({ ResourceArn: arn }));
  expect(result.Items).toBeDefined();

  await client.send(new DeleteChannelCommand({ ChannelName: channelName }));
});

test("MediaTailor tags roundtrip", async () => {
  const client = mediatailor();
  const suffix = `${Date.now()}`;
  const channelName = `ch-tags-${suffix}`;

  await client.send(
    new CreateChannelCommand({
      ChannelName: channelName,
      Outputs: [{ ManifestName: "index", SourceGroup: "default" }],
      PlaybackMode: "LOOP",
    }),
  );

  const resourceArn = `arn:aws:mediatailor:${region}:000000000000:channel/${channelName}`;

  await client.send(
    new TagResourceCommand({
      ResourceArn: resourceArn,
      Tags: { env: "test", project: "bunsai" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(listed.Tags?.["env"]).toBe("test");
  expect(listed.Tags?.["project"]).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({
      ResourceArn: resourceArn,
      TagKeys: ["env"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(afterUntag.Tags?.["env"]).toBeUndefined();
  expect(afterUntag.Tags?.["project"]).toBe("bunsai");

  await client.send(new DeleteChannelCommand({ ChannelName: channelName }));
});
