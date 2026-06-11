import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateCertificateCommand,
  CancelJobCommand,
  CreateJobCommand,
  CreateJobTemplateCommand,
  CreatePresetCommand,
  CreateQueueCommand,
  DeleteJobTemplateCommand,
  DeletePresetCommand,
  DeleteQueueCommand,
  DescribeEndpointsCommand,
  DisassociateCertificateCommand,
  GetJobCommand,
  GetJobTemplateCommand,
  GetJobsQueryResultsCommand,
  GetPresetCommand,
  GetQueueCommand,
  ListJobTemplatesCommand,
  ListJobsCommand,
  ListPresetsCommand,
  ListQueuesCommand,
  ListTagsForResourceCommand,
  MediaConvertClient,
  SearchJobsCommand,
  StartJobsQueryCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateJobTemplateCommand,
  UpdatePresetCommand,
  UpdateQueueCommand,
} from "@aws-sdk/client-mediaconvert";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const mc = () =>
  new MediaConvertClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("MediaConvert DescribeEndpoints", async () => {
  const client = mc();
  const res = await client.send(new DescribeEndpointsCommand({}));
  expect(res.Endpoints).toBeDefined();
  expect(res.Endpoints!.length).toBeGreaterThan(0);
  expect(res.Endpoints![0].Url).toContain("amazonaws.com");
});

test("MediaConvert Queue CRUD + Default queue", async () => {
  const client = mc();

  const list0 = await client.send(new ListQueuesCommand({}));
  const defaultQueue = list0.Queues?.find(
    (q: { Name?: string }) => q.Name === "Default",
  );
  expect(defaultQueue).toBeDefined();
  expect((defaultQueue as { Type?: string })?.Type).toBe("SYSTEM");

  const name = `bunsai-e2e-queue-${Date.now()}`;
  const created = await client.send(
    new CreateQueueCommand({ Name: name, Description: "test queue" }),
  );
  expect(created.Queue?.Name).toBe(name);
  expect(created.Queue?.Type).toBe("CUSTOM");
  expect(created.Queue?.Status).toBe("ACTIVE");
  expect(created.Queue?.Arn).toContain("queues/" + name);

  const got = await client.send(new GetQueueCommand({ Name: name }));
  expect(got.Queue?.Name).toBe(name);
  expect(got.Queue?.Description).toBe("test queue");

  const updated = await client.send(
    new UpdateQueueCommand({ Name: name, Description: "updated" }),
  );
  expect(updated.Queue?.Description).toBe("updated");

  const list1 = await client.send(new ListQueuesCommand({}));
  expect(list1.Queues?.some((q: { Name?: string }) => q.Name === name)).toBe(
    true,
  );

  await client.send(new DeleteQueueCommand({ Name: name }));

  const list2 = await client.send(new ListQueuesCommand({}));
  expect(list2.Queues?.some((q: { Name?: string }) => q.Name === name)).toBe(
    false,
  );
});

test("MediaConvert Queue ConflictException on duplicate name", async () => {
  const client = mc();
  const name = `bunsai-e2e-queue-dup-${Date.now()}`;
  await client.send(new CreateQueueCommand({ Name: name }));
  await expect(
    client.send(new CreateQueueCommand({ Name: name })),
  ).rejects.toThrow();
  await client.send(new DeleteQueueCommand({ Name: name }));
});

test("MediaConvert Queue NotFoundException", async () => {
  const client = mc();
  await expect(
    client.send(new GetQueueCommand({ Name: "no-such-queue-xyz" })),
  ).rejects.toThrow();
});

test("MediaConvert Preset CRUD", async () => {
  const client = mc();
  const name = `bunsai-e2e-preset-${Date.now()}`;
  const settings = { VideoDescription: { Width: 1280, Height: 720 } };

  const created = await client.send(
    new CreatePresetCommand({ Name: name, Settings: settings }),
  );
  expect(created.Preset?.Name).toBe(name);
  expect(created.Preset?.Type).toBe("CUSTOM");
  expect(created.Preset?.Arn).toContain("presets/" + name);

  const got = await client.send(new GetPresetCommand({ Name: name }));
  expect(got.Preset?.Name).toBe(name);

  await client.send(
    new UpdatePresetCommand({ Name: name, Description: "updated preset" }),
  );
  const updated = await client.send(new GetPresetCommand({ Name: name }));
  expect(updated.Preset?.Description).toBe("updated preset");

  const list = await client.send(new ListPresetsCommand({}));
  expect(list.Presets?.some((p: { Name?: string }) => p.Name === name)).toBe(
    true,
  );

  await client.send(new DeletePresetCommand({ Name: name }));

  const list2 = await client.send(new ListPresetsCommand({}));
  expect(list2.Presets?.some((p: { Name?: string }) => p.Name === name)).toBe(
    false,
  );
});

test("MediaConvert Preset ConflictException on duplicate name", async () => {
  const client = mc();
  const name = `bunsai-e2e-preset-dup-${Date.now()}`;
  const settings = { VideoDescription: {} };
  await client.send(
    new CreatePresetCommand({ Name: name, Settings: settings }),
  );
  await expect(
    client.send(new CreatePresetCommand({ Name: name, Settings: settings })),
  ).rejects.toThrow();
  await client.send(new DeletePresetCommand({ Name: name }));
});

test("MediaConvert JobTemplate CRUD", async () => {
  const client = mc();
  const name = `bunsai-e2e-jt-${Date.now()}`;

  const created = await client.send(
    new CreateJobTemplateCommand({
      Name: name,
      Description: "test template",
      Settings: { OutputGroups: [], Inputs: [] },
    }),
  );
  expect(created.JobTemplate?.Name).toBe(name);
  expect(created.JobTemplate?.Type).toBe("CUSTOM");
  expect(created.JobTemplate?.Arn).toContain("jobTemplates/" + name);

  const got = await client.send(new GetJobTemplateCommand({ Name: name }));
  expect(got.JobTemplate?.Description).toBe("test template");

  await client.send(
    new UpdateJobTemplateCommand({ Name: name, Description: "updated" }),
  );
  const updated = await client.send(new GetJobTemplateCommand({ Name: name }));
  expect(updated.JobTemplate?.Description).toBe("updated");

  const list = await client.send(new ListJobTemplatesCommand({}));
  expect(
    list.JobTemplates?.some((jt: { Name?: string }) => jt.Name === name),
  ).toBe(true);

  await client.send(new DeleteJobTemplateCommand({ Name: name }));

  const list2 = await client.send(new ListJobTemplatesCommand({}));
  expect(
    list2.JobTemplates?.some((jt: { Name?: string }) => jt.Name === name),
  ).toBe(false);
});

test("MediaConvert Job lifecycle: CreateJob → GetJob (SUBMITTED) → CancelJob", async () => {
  const client = mc();

  const created = await client.send(
    new CreateJobCommand({
      Role: "arn:aws:iam::123456789012:role/MediaConvertRole",
      Settings: {
        Inputs: [],
        OutputGroups: [],
      },
    }),
  );
  expect(created.Job?.Id).toBeDefined();
  expect(created.Job?.Status).toBe("SUBMITTED");

  const id = created.Job!.Id!;
  const got = await client.send(new GetJobCommand({ Id: id }));
  expect(got.Job?.Id).toBe(id);
  expect(got.Job?.Status).toBe("SUBMITTED");

  await client.send(new CancelJobCommand({ Id: id }));
  const cancelled = await client.send(new GetJobCommand({ Id: id }));
  expect(cancelled.Job?.Status).toBe("CANCELED");
});

test("MediaConvert CancelJob fails on COMPLETE job", async () => {
  const client = mc();

  const created = await client.send(
    new CreateJobCommand({
      Role: "arn:aws:iam::123456789012:role/MediaConvertRole",
      Settings: {},
    }),
  );
  const id = created.Job!.Id!;

  await Bun.sleep(31_000);

  const complete = await client.send(new GetJobCommand({ Id: id }));
  expect(complete.Job?.Status).toBe("COMPLETE");

  await expect(client.send(new CancelJobCommand({ Id: id }))).rejects.toThrow();
}, 40_000);

test("MediaConvert ListJobs", async () => {
  const client = mc();
  const created = await client.send(
    new CreateJobCommand({
      Role: "arn:aws:iam::123456789012:role/MediaConvertRole",
      Settings: {},
    }),
  );
  const id = created.Job!.Id!;

  const list = await client.send(new ListJobsCommand({}));
  expect(list.Jobs?.some((j: { Id?: string }) => j.Id === id)).toBe(true);
});

test("MediaConvert Tags round-trip", async () => {
  const client = mc();
  const name = `bunsai-e2e-tag-queue-${Date.now()}`;

  const created = await client.send(
    new CreateQueueCommand({ Name: name, Tags: { env: "test" } }),
  );
  const arn = created.Queue!.Arn!;

  const tags0 = await client.send(new ListTagsForResourceCommand({ Arn: arn }));
  expect(tags0.ResourceTags?.Tags?.env).toBe("test");

  await client.send(
    new TagResourceCommand({ Arn: arn, Tags: { team: "bunsai" } }),
  );

  const tags1 = await client.send(new ListTagsForResourceCommand({ Arn: arn }));
  expect(tags1.ResourceTags?.Tags?.env).toBe("test");
  expect(tags1.ResourceTags?.Tags?.team).toBe("bunsai");

  await client.send(new UntagResourceCommand({ Arn: arn, TagKeys: ["env"] }));

  const tags2 = await client.send(new ListTagsForResourceCommand({ Arn: arn }));
  expect(tags2.ResourceTags?.Tags?.env).toBeUndefined();
  expect(tags2.ResourceTags?.Tags?.team).toBe("bunsai");

  await client.send(new DeleteQueueCommand({ Name: name }));
});

test("MC-01 SearchJobs: Status/InputFile filters", async () => {
  const client = mc();
  const fileInput = `s3://my-bucket/mc01-${Date.now()}/input.mp4`;

  const created = await client.send(
    new CreateJobCommand({
      Role: "arn:aws:iam::123456789012:role/MediaConvertRole",
      Settings: {
        Inputs: [{ FileInput: fileInput }],
        OutputGroups: [],
      },
    }),
  );
  const id = created.Job!.Id!;

  const byStatus = await client.send(
    new SearchJobsCommand({ Status: "SUBMITTED" }),
  );
  expect(byStatus.Jobs?.some((j: { Id?: string }) => j.Id === id)).toBe(true);

  const byInputFile = await client.send(
    new SearchJobsCommand({ InputFile: "mc01-" }),
  );
  expect(byInputFile.Jobs?.some((j: { Id?: string }) => j.Id === id)).toBe(
    true,
  );

  const noMatch = await client.send(
    new SearchJobsCommand({ Status: "COMPLETE" }),
  );
  expect(noMatch.Jobs?.some((j: { Id?: string }) => j.Id === id)).toBe(false);
});

test("MC-02 StartJobsQuery/GetJobsQueryResults: Id round-trip and NotFoundException", async () => {
  const client = mc();

  const created = await client.send(
    new CreateJobCommand({
      Role: "arn:aws:iam::123456789012:role/MediaConvertRole",
      Settings: { Inputs: [], OutputGroups: [] },
    }),
  );
  const jobId = created.Job!.Id!;

  const started = await client.send(new StartJobsQueryCommand({}));
  expect(started.Id).toBeDefined();
  expect(typeof started.Id).toBe("string");
  expect((started.Id as string).length).toBeGreaterThan(0);

  const results = await client.send(
    new GetJobsQueryResultsCommand({ Id: started.Id }),
  );
  expect(results.Status).toBe("COMPLETE");
  expect(results.Jobs?.some((j: { Id?: string }) => j.Id === jobId)).toBe(true);

  await expect(
    client.send(new GetJobsQueryResultsCommand({ Id: "nope" })),
  ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
});

test("MC-03 Certificate ops: Associate/Disassociate state", async () => {
  const client = mc();
  const arn = "arn:aws:acm:us-east-1:123456789012:certificate/mc03-test";

  await expect(
    client.send(new DisassociateCertificateCommand({ Arn: arn })),
  ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });

  await client.send(new AssociateCertificateCommand({ Arn: arn }));

  await client.send(new DisassociateCertificateCommand({ Arn: arn }));

  await expect(
    client.send(new DisassociateCertificateCommand({ Arn: arn })),
  ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
});

test("MC-04 ListJobs: Status filter", async () => {
  const client = mc();

  const created = await client.send(
    new CreateJobCommand({
      Role: "arn:aws:iam::123456789012:role/MediaConvertRole",
      Settings: { Inputs: [], OutputGroups: [] },
    }),
  );
  const id = created.Job!.Id!;

  const submitted = await client.send(
    new ListJobsCommand({ Status: "SUBMITTED" }),
  );
  expect(submitted.Jobs?.some((j: { Id?: string }) => j.Id === id)).toBe(true);

  const complete = await client.send(
    new ListJobsCommand({ Status: "COMPLETE" }),
  );
  expect(complete.Jobs?.some((j: { Id?: string }) => j.Id === id)).toBe(false);
});

test("MC-07 CreateJob: nonexistent Queue throws NotFoundException", async () => {
  const client = mc();

  await expect(
    client.send(
      new CreateJobCommand({
        Role: "arn:aws:iam::123456789012:role/MediaConvertRole",
        Queue: "nonexistent-queue-mc07",
        Settings: { Inputs: [], OutputGroups: [] },
      }),
    ),
  ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
});

test("MC-08 Tags: tag ops on nonexistent ARN throw NotFoundException", async () => {
  const client = mc();
  const fakeArn =
    "arn:aws:mediaconvert:us-east-1:123456789012:queues/nonexistent-mc08";

  await expect(
    client.send(new ListTagsForResourceCommand({ Arn: fakeArn })),
  ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
});
