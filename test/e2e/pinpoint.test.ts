import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateAppCommand,
  CreateCampaignCommand,
  CreateJourneyCommand,
  CreateSegmentCommand,
  CreateSmsTemplateCommand,
  DeleteAppCommand,
  DeleteCampaignCommand,
  DeleteEmailChannelCommand,
  DeleteEndpointCommand,
  DeleteEventStreamCommand,
  DeleteJourneyCommand,
  DeleteSegmentCommand,
  DeleteSmsTemplateCommand,
  GetAppCommand,
  GetAppsCommand,
  GetCampaignCommand,
  GetCampaignsCommand,
  GetEmailChannelCommand,
  GetEndpointCommand,
  GetEventStreamCommand,
  GetExportJobCommand,
  GetExportJobsCommand,
  GetJourneyCommand,
  GetSegmentCommand,
  GetSegmentsCommand,
  GetSmsTemplateCommand,
  ListJourneysCommand,
  ListTagsForResourceCommand,
  PinpointClient,
  PutEventStreamCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateEmailChannelCommand,
  UpdateEndpointCommand,
  UpdateJourneyStateCommand,
  UpdateSegmentCommand,
  UpdateSmsTemplateCommand,
  CreateExportJobCommand,
} from "@aws-sdk/client-pinpoint";
import { NodeHttpHandler } from "@smithy/node-http-handler";

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

const pinpoint = () =>
  new PinpointClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Pinpoint app roundtrip", async () => {
  const client = pinpoint();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateAppCommand({
      CreateApplicationRequest: { Name: name, tags: { env: "test" } },
    }),
  );
  expect(created.ApplicationResponse?.Name).toBe(name);
  expect(created.ApplicationResponse?.Id).toBeDefined();
  expect(created.ApplicationResponse?.Arn).toContain("apps/");

  const appId = created.ApplicationResponse?.Id ?? "";

  const got = await client.send(new GetAppCommand({ ApplicationId: appId }));
  expect(got.ApplicationResponse?.Id).toBe(appId);
  expect(got.ApplicationResponse?.Name).toBe(name);

  const listed = await client.send(new GetAppsCommand({}));
  expect(
    (listed.ApplicationsResponse?.Item ?? []).some((app) => app.Id === appId),
  ).toBe(true);

  const deleted = await client.send(
    new DeleteAppCommand({ ApplicationId: appId }),
  );
  expect(deleted.ApplicationResponse?.Id).toBe(appId);

  await expect(
    client.send(new GetAppCommand({ ApplicationId: appId })),
  ).rejects.toThrow();
});

test("Pinpoint campaign lifecycle", async () => {
  const client = pinpoint();
  const app = await client.send(
    new CreateAppCommand({
      CreateApplicationRequest: { Name: `camp-test-${Date.now()}` },
    }),
  );
  const appId = app.ApplicationResponse?.Id ?? "";

  const created = await client.send(
    new CreateCampaignCommand({
      ApplicationId: appId,
      WriteCampaignRequest: { Name: "my-campaign" },
    }),
  );
  expect(created.CampaignResponse?.Name).toBe("my-campaign");
  const campId = created.CampaignResponse?.Id ?? "";

  const got = await client.send(
    new GetCampaignCommand({ ApplicationId: appId, CampaignId: campId }),
  );
  expect(got.CampaignResponse?.Id).toBe(campId);

  const listed = await client.send(
    new GetCampaignsCommand({ ApplicationId: appId }),
  );
  expect(
    (listed.CampaignsResponse?.Item ?? []).some((c) => c.Id === campId),
  ).toBe(true);

  await client.send(
    new DeleteCampaignCommand({ ApplicationId: appId, CampaignId: campId }),
  );
  await client.send(new DeleteAppCommand({ ApplicationId: appId }));
});

test("Pinpoint segment lifecycle", async () => {
  const client = pinpoint();
  const app = await client.send(
    new CreateAppCommand({
      CreateApplicationRequest: { Name: `seg-test-${Date.now()}` },
    }),
  );
  const appId = app.ApplicationResponse?.Id ?? "";

  const created = await client.send(
    new CreateSegmentCommand({
      ApplicationId: appId,
      WriteSegmentRequest: { Name: "my-segment" },
    }),
  );
  expect(created.SegmentResponse?.Name).toBe("my-segment");
  const segId = created.SegmentResponse?.Id ?? "";

  const updated = await client.send(
    new UpdateSegmentCommand({
      ApplicationId: appId,
      SegmentId: segId,
      WriteSegmentRequest: { Name: "updated-segment" },
    }),
  );
  expect(updated.SegmentResponse?.Name).toBe("updated-segment");

  const listed = await client.send(
    new GetSegmentsCommand({ ApplicationId: appId }),
  );
  expect(
    (listed.SegmentsResponse?.Item ?? []).some((s) => s.Id === segId),
  ).toBe(true);

  await client.send(
    new GetSegmentCommand({ ApplicationId: appId, SegmentId: segId }),
  );
  await client.send(
    new DeleteSegmentCommand({ ApplicationId: appId, SegmentId: segId }),
  );
  await client.send(new DeleteAppCommand({ ApplicationId: appId }));
});

test("Pinpoint journey + state lifecycle", async () => {
  const client = pinpoint();
  const app = await client.send(
    new CreateAppCommand({
      CreateApplicationRequest: { Name: `jrn-test-${Date.now()}` },
    }),
  );
  const appId = app.ApplicationResponse?.Id ?? "";

  const created = await client.send(
    new CreateJourneyCommand({
      ApplicationId: appId,
      WriteJourneyRequest: { Name: "my-journey" },
    }),
  );
  expect(created.JourneyResponse?.Name).toBe("my-journey");
  const jrnId = created.JourneyResponse?.Id ?? "";

  const got = await client.send(
    new GetJourneyCommand({ ApplicationId: appId, JourneyId: jrnId }),
  );
  expect(got.JourneyResponse?.State).toBe("DRAFT");

  await client.send(
    new UpdateJourneyStateCommand({
      ApplicationId: appId,
      JourneyId: jrnId,
      JourneyStateRequest: { State: "CANCELLED" },
    }),
  );

  const listed = await client.send(
    new ListJourneysCommand({ ApplicationId: appId }),
  );
  expect(
    (listed.JourneysResponse?.Item ?? []).some((j) => j.Id === jrnId),
  ).toBe(true);

  await client.send(
    new DeleteJourneyCommand({ ApplicationId: appId, JourneyId: jrnId }),
  );
  await client.send(new DeleteAppCommand({ ApplicationId: appId }));
});

test("Pinpoint email channel update/get/delete", async () => {
  const client = pinpoint();
  const app = await client.send(
    new CreateAppCommand({
      CreateApplicationRequest: { Name: `ch-test-${Date.now()}` },
    }),
  );
  const appId = app.ApplicationResponse?.Id ?? "";

  await client.send(
    new UpdateEmailChannelCommand({
      ApplicationId: appId,
      EmailChannelRequest: {
        Enabled: true,
        FromAddress: "test@example.com",
        Identity: "arn:aws:ses:us-east-1:123:identity/test@example.com",
      },
    }),
  );

  const got = await client.send(
    new GetEmailChannelCommand({ ApplicationId: appId }),
  );
  expect(got.EmailChannelResponse?.Platform).toBe("EMAIL");

  await client.send(new DeleteEmailChannelCommand({ ApplicationId: appId }));
  await expect(
    client.send(new GetEmailChannelCommand({ ApplicationId: appId })),
  ).rejects.toThrow();

  await client.send(new DeleteAppCommand({ ApplicationId: appId }));
});

test("Pinpoint SMS template lifecycle", async () => {
  const client = pinpoint();
  const name = `sms-tpl-${Date.now()}`;

  await client.send(
    new CreateSmsTemplateCommand({
      TemplateName: name,
      SMSTemplateRequest: { Body: "Hello {{name}}" },
    }),
  );

  const got = await client.send(
    new GetSmsTemplateCommand({ TemplateName: name }),
  );
  expect(got.SMSTemplateResponse?.TemplateName).toBe(name);

  await client.send(
    new UpdateSmsTemplateCommand({
      TemplateName: name,
      SMSTemplateRequest: { Body: "Hello {{name}} updated" },
    }),
  );

  await client.send(new DeleteSmsTemplateCommand({ TemplateName: name }));
  await expect(
    client.send(new GetSmsTemplateCommand({ TemplateName: name })),
  ).rejects.toThrow();
});

test("Pinpoint endpoint lifecycle", async () => {
  const client = pinpoint();
  const app = await client.send(
    new CreateAppCommand({
      CreateApplicationRequest: { Name: `ep-test-${Date.now()}` },
    }),
  );
  const appId = app.ApplicationResponse?.Id ?? "";
  const epId = "endpoint-1";

  await client.send(
    new UpdateEndpointCommand({
      ApplicationId: appId,
      EndpointId: epId,
      EndpointRequest: {
        Address: "test@example.com",
        ChannelType: "EMAIL",
        EndpointStatus: "ACTIVE",
      },
    }),
  );

  const got = await client.send(
    new GetEndpointCommand({ ApplicationId: appId, EndpointId: epId }),
  );
  expect(got.EndpointResponse?.Id).toBe(epId);
  expect(got.EndpointResponse?.Address).toBe("test@example.com");

  await client.send(
    new DeleteEndpointCommand({ ApplicationId: appId, EndpointId: epId }),
  );
  await client.send(new DeleteAppCommand({ ApplicationId: appId }));
});

test("Pinpoint export job lifecycle", async () => {
  const client = pinpoint();
  const app = await client.send(
    new CreateAppCommand({
      CreateApplicationRequest: { Name: `job-test-${Date.now()}` },
    }),
  );
  const appId = app.ApplicationResponse?.Id ?? "";

  const created = await client.send(
    new CreateExportJobCommand({
      ApplicationId: appId,
      ExportJobRequest: {
        RoleArn: "arn:aws:iam::123456789012:role/test",
        S3UrlPrefix: "s3://my-bucket/exports/",
      },
    }),
  );
  expect(created.ExportJobResponse?.Type).toBe("EXPORT");
  const jobId = created.ExportJobResponse?.Id ?? "";

  const got = await client.send(
    new GetExportJobCommand({ ApplicationId: appId, JobId: jobId }),
  );
  expect(got.ExportJobResponse?.Id).toBe(jobId);

  const listed = await client.send(
    new GetExportJobsCommand({ ApplicationId: appId }),
  );
  expect(
    (listed.ExportJobsResponse?.Item ?? []).some((j) => j.Id === jobId),
  ).toBe(true);

  await client.send(new DeleteAppCommand({ ApplicationId: appId }));
});

test("Pinpoint event stream lifecycle", async () => {
  const client = pinpoint();
  const app = await client.send(
    new CreateAppCommand({
      CreateApplicationRequest: { Name: `evtstr-test-${Date.now()}` },
    }),
  );
  const appId = app.ApplicationResponse?.Id ?? "";

  await client.send(
    new PutEventStreamCommand({
      ApplicationId: appId,
      WriteEventStream: {
        DestinationStreamArn:
          "arn:aws:kinesis:us-east-1:123456789012:stream/my-stream",
        RoleArn: "arn:aws:iam::123456789012:role/test",
      },
    }),
  );

  const got = await client.send(
    new GetEventStreamCommand({ ApplicationId: appId }),
  );
  expect(got.EventStream?.ApplicationId).toBe(appId);

  await client.send(new DeleteEventStreamCommand({ ApplicationId: appId }));
  await expect(
    client.send(new GetEventStreamCommand({ ApplicationId: appId })),
  ).rejects.toThrow();

  await client.send(new DeleteAppCommand({ ApplicationId: appId }));
});

test("Pinpoint tags lifecycle", async () => {
  const client = pinpoint();
  const app = await client.send(
    new CreateAppCommand({
      CreateApplicationRequest: { Name: `tags-test-${Date.now()}` },
    }),
  );
  const arn = app.ApplicationResponse?.Arn ?? "";

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      TagsModel: { tags: { env: "test", team: "pinpoint" } },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(listed.TagsModel?.tags?.env).toBe("test");
  expect(listed.TagsModel?.tags?.team).toBe("pinpoint");

  await client.send(
    new UntagResourceCommand({ ResourceArn: arn, TagKeys: ["team"] }),
  );

  const after = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(after.TagsModel?.tags?.team).toBeUndefined();
  expect(after.TagsModel?.tags?.env).toBe("test");

  await client.send(
    new DeleteAppCommand({ ApplicationId: app.ApplicationResponse?.Id ?? "" }),
  );
});
