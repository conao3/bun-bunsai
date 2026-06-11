import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateTargetsWithJobCommand,
  CancelJobCommand,
  CancelJobExecutionCommand,
  CreateCommandCommand,
  CreateJobCommand,
  CreateJobTemplateCommand,
  DeleteCommandCommand,
  DeleteJobCommand,
  DeleteJobExecutionCommand,
  DeleteJobTemplateCommand,
  DescribeJobCommand,
  DescribeJobExecutionCommand,
  DescribeJobTemplateCommand,
  DescribeManagedJobTemplateCommand,
  GetCommandCommand,
  GetJobDocumentCommand,
  IoTClient,
  ListCommandsCommand,
  ListJobExecutionsForJobCommand,
  ListJobExecutionsForThingCommand,
  ListJobTemplatesCommand,
  ListJobsCommand,
  ListManagedJobTemplatesCommand,
  UpdateCommandCommand,
  UpdateJobCommand,
} from "@aws-sdk/client-iot";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const account = "000000000000";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iot = () =>
  new IoTClient({ endpoint, region, credentials, requestHandler });

const suffix = () => Date.now().toString(36);

test("IoT job lifecycle", async () => {
  const client = iot();
  const sfx = suffix();
  const jobId = `bunsai_e2e_job_${sfx}`;
  const thingName = `bunsai_e2e_thing_${sfx}`;
  const thingArn = `arn:aws:iot:${region}:${account}:thing/${thingName}`;

  const created = await client.send(
    new CreateJobCommand({
      jobId,
      targets: [thingArn],
      document: '{"operation":"update"}',
      description: "e2e test job",
    }),
  );
  expect(created.jobId).toBe(jobId);
  expect(created.jobArn).toContain(`job/${jobId}`);

  const described = await client.send(new DescribeJobCommand({ jobId }));
  expect(described.job?.jobId).toBe(jobId);
  expect(described.job?.status as string).toBe("IN_PROGRESS");
  expect(described.job?.targets).toContain(thingArn);

  const listed = await client.send(new ListJobsCommand({}));
  expect(listed.jobs?.some((j) => j.jobId === jobId)).toBe(true);

  const doc = await client.send(new GetJobDocumentCommand({ jobId }));
  expect(doc.document).toBe('{"operation":"update"}');

  await client.send(
    new UpdateJobCommand({ jobId, description: "updated description" }),
  );
  const afterUpdate = await client.send(new DescribeJobCommand({ jobId }));
  expect(afterUpdate.job?.description).toBe("updated description");

  const thingName2 = `bunsai_e2e_thing2_${sfx}`;
  const thingArn2 = `arn:aws:iot:${region}:${account}:thing/${thingName2}`;
  await client.send(
    new AssociateTargetsWithJobCommand({ jobId, targets: [thingArn2] }),
  );
  const afterAssoc = await client.send(new DescribeJobCommand({ jobId }));
  expect(afterAssoc.job?.targets).toContain(thingArn2);

  const execsForJob = await client.send(
    new ListJobExecutionsForJobCommand({ jobId }),
  );
  expect(execsForJob.executionSummaries?.length).toBeGreaterThanOrEqual(2);

  const exec = await client.send(
    new DescribeJobExecutionCommand({ jobId, thingName }),
  );
  expect(exec.execution?.jobId).toBe(jobId);
  expect(exec.execution?.status as string).toBe("QUEUED");

  const execsForThing = await client.send(
    new ListJobExecutionsForThingCommand({ thingName }),
  );
  expect(execsForThing.executionSummaries?.some((e) => e.jobId === jobId)).toBe(
    true,
  );

  await client.send(new CancelJobExecutionCommand({ jobId, thingName }));
  const afterCancel = await client.send(
    new DescribeJobExecutionCommand({ jobId, thingName }),
  );
  expect(afterCancel.execution?.status as string).toBe(
    "CANCELLATION_IN_PROGRESS",
  );

  await client.send(
    new DeleteJobExecutionCommand({ jobId, thingName, executionNumber: 1 }),
  );

  await client.send(new CancelJobCommand({ jobId }));
  const afterJobCancel = await client.send(new DescribeJobCommand({ jobId }));
  expect(afterJobCancel.job?.status as string).toBe("CANCELLATION_IN_PROGRESS");

  await client.send(new DeleteJobCommand({ jobId, force: true }));
  await expect(
    client.send(new DescribeJobCommand({ jobId })),
  ).rejects.toThrow();
});

test("IoT job template lifecycle", async () => {
  const client = iot();
  const jobTemplateId = `bunsai_e2e_tmpl_${suffix()}`;

  const created = await client.send(
    new CreateJobTemplateCommand({
      jobTemplateId,
      description: "e2e template",
      document: '{"operation":"reboot"}',
    }),
  );
  expect(created.jobTemplateId).toBe(jobTemplateId);
  expect(created.jobTemplateArn).toContain(`jobtemplate/${jobTemplateId}`);

  const described = await client.send(
    new DescribeJobTemplateCommand({ jobTemplateId }),
  );
  expect(described.jobTemplateId).toBe(jobTemplateId);
  expect(described.description).toBe("e2e template");

  const listed = await client.send(new ListJobTemplatesCommand({}));
  expect(
    listed.jobTemplates?.some((t) => t.jobTemplateId === jobTemplateId),
  ).toBe(true);

  await client.send(new DeleteJobTemplateCommand({ jobTemplateId }));
  await expect(
    client.send(new DescribeJobTemplateCommand({ jobTemplateId })),
  ).rejects.toThrow();
});

test("IoT managed job templates", async () => {
  const client = iot();

  const listed = await client.send(new ListManagedJobTemplatesCommand({}));
  expect(listed.managedJobTemplates?.length).toBeGreaterThanOrEqual(1);

  const templateName = listed.managedJobTemplates?.[0]?.templateName;
  expect(templateName).toBeDefined();

  const described = await client.send(
    new DescribeManagedJobTemplateCommand({ templateName }),
  );
  expect(described.templateName).toBe(templateName);
  expect(described.description).toBeDefined();
});

test("IoT command lifecycle", async () => {
  const client = iot();
  const commandId = `bunsai_e2e_cmd_${suffix()}`;

  const created = await client.send(
    new CreateCommandCommand({
      commandId,
      namespace: "AWS-IoT",
      displayName: "E2E Test Command",
      description: "e2e test",
    }),
  );
  expect(created.commandId).toBe(commandId);
  expect(created.commandArn).toContain(`command/${commandId}`);

  const got = await client.send(new GetCommandCommand({ commandId }));
  expect(got.commandId).toBe(commandId);
  expect(got.displayName).toBe("E2E Test Command");
  expect(got.deprecated).toBe(false);

  const listed = await client.send(new ListCommandsCommand({}));
  expect(listed.commands?.some((c) => c.commandId === commandId)).toBe(true);

  await client.send(
    new UpdateCommandCommand({
      commandId,
      displayName: "Updated Command",
      deprecated: true,
    }),
  );
  const afterUpdate = await client.send(new GetCommandCommand({ commandId }));
  expect(afterUpdate.displayName).toBe("Updated Command");
  expect(afterUpdate.deprecated).toBe(true);

  await client.send(new DeleteCommandCommand({ commandId }));
  await expect(
    client.send(new GetCommandCommand({ commandId })),
  ).rejects.toThrow();
});
