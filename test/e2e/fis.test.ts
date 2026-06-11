import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateExperimentTemplateCommand,
  DeleteExperimentTemplateCommand,
  FisClient,
  GetExperimentCommand,
  GetExperimentTemplateCommand,
  ListExperimentTemplatesCommand,
  ListExperimentsCommand,
  ListTagsForResourceCommand,
  StartExperimentCommand,
  StopExperimentCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateExperimentTemplateCommand,
} from "@aws-sdk/client-fis";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const fis = () =>
  new FisClient({ endpoint, region, credentials, requestHandler });

const baseTemplate = {
  description: "e2e test template",
  roleArn: "arn:aws:iam::000000000000:role/fis-role",
  stopConditions: [{ source: "none" }],
  actions: {
    stop: {
      actionId: "aws:ec2:stop-instances",
      description: "stop",
      targets: {},
    },
  },
  tags: { env: "test" },
};

test("FIS ExperimentTemplate CRUD", async () => {
  const client = fis();

  const created = await client.send(
    new CreateExperimentTemplateCommand(baseTemplate),
  );
  const tmpl = created.experimentTemplate!;
  expect(tmpl.id).toBeDefined();
  expect(tmpl.description).toBe("e2e test template");
  expect(tmpl.roleArn).toBe(baseTemplate.roleArn);
  expect(tmpl.tags?.["env"]).toBe("test");

  const got = await client.send(
    new GetExperimentTemplateCommand({ id: tmpl.id! }),
  );
  expect(got.experimentTemplate?.id).toBe(tmpl.id);
  expect(got.experimentTemplate?.description).toBe("e2e test template");

  const listed = await client.send(new ListExperimentTemplatesCommand({}));
  const ids = (listed.experimentTemplates ?? []).map((t) => t.id);
  expect(ids).toContain(tmpl.id);

  const updated = await client.send(
    new UpdateExperimentTemplateCommand({
      id: tmpl.id!,
      description: "updated description",
    }),
  );
  expect(updated.experimentTemplate?.description).toBe("updated description");

  const afterUpdate = await client.send(
    new GetExperimentTemplateCommand({ id: tmpl.id! }),
  );
  expect(afterUpdate.experimentTemplate?.description).toBe(
    "updated description",
  );

  const deleted = await client.send(
    new DeleteExperimentTemplateCommand({ id: tmpl.id! }),
  );
  expect(deleted.experimentTemplate?.id).toBe(tmpl.id);

  await expect(
    client.send(new GetExperimentTemplateCommand({ id: tmpl.id! })),
  ).rejects.toThrow();
});

test("FIS Experiment lifecycle", async () => {
  const client = fis();

  const tmplRes = await client.send(
    new CreateExperimentTemplateCommand(baseTemplate),
  );
  const templateId = tmplRes.experimentTemplate!.id!;

  const started = await client.send(
    new StartExperimentCommand({
      experimentTemplateId: templateId,
      tags: { run: "e2e" },
    }),
  );
  const exp = started.experiment!;
  expect(exp.id).toBeDefined();
  expect(exp.experimentTemplateId).toBe(templateId);
  expect(["initiating", "running"]).toContain(exp.state?.status as string);

  const got = await client.send(new GetExperimentCommand({ id: exp.id! }));
  expect(got.experiment?.id).toBe(exp.id);
  expect(["initiating", "running", "completed"]).toContain(
    got.experiment?.state?.status as string,
  );

  const listed = await client.send(
    new ListExperimentsCommand({ experimentTemplateId: templateId }),
  );
  const expIds = (listed.experiments ?? []).map((e) => e.id);
  expect(expIds).toContain(exp.id);

  await client.send(new DeleteExperimentTemplateCommand({ id: templateId }));
});

test("FIS StopExperiment guard", async () => {
  const client = fis();

  const tmplRes = await client.send(
    new CreateExperimentTemplateCommand(baseTemplate),
  );
  const templateId = tmplRes.experimentTemplate!.id!;

  const started = await client.send(
    new StartExperimentCommand({ experimentTemplateId: templateId }),
  );
  const expId = started.experiment!.id!;

  const stopped = await client.send(new StopExperimentCommand({ id: expId }));
  expect(["stopping", "stopped"]).toContain(
    stopped.experiment?.state?.status as string,
  );

  const afterStop = await client.send(new GetExperimentCommand({ id: expId }));
  expect(["stopping", "stopped"]).toContain(
    afterStop.experiment?.state?.status as string,
  );

  await expect(
    client.send(new StopExperimentCommand({ id: expId })),
  ).rejects.toThrow();

  await client.send(new DeleteExperimentTemplateCommand({ id: templateId }));
});

test("FIS tag round-trip", async () => {
  const client = fis();

  const tmplRes = await client.send(
    new CreateExperimentTemplateCommand({ ...baseTemplate, tags: {} }),
  );
  const arn = tmplRes.experimentTemplate!.arn!;

  await client.send(
    new TagResourceCommand({ resourceArn: arn, tags: { foo: "bar", x: "1" } }),
  );
  const tagged = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(tagged.tags?.["foo"]).toBe("bar");
  expect(tagged.tags?.["x"]).toBe("1");

  await client.send(
    new UntagResourceCommand({ resourceArn: arn, tagKeys: ["x"] }),
  );
  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(afterUntag.tags?.["foo"]).toBe("bar");
  expect(afterUntag.tags?.["x"]).toBeUndefined();

  await client.send(
    new DeleteExperimentTemplateCommand({
      id: tmplRes.experimentTemplate!.id!,
    }),
  );
});
