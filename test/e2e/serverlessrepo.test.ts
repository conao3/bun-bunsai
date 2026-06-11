import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateApplicationCommand,
  CreateApplicationVersionCommand,
  CreateCloudFormationChangeSetCommand,
  CreateCloudFormationTemplateCommand,
  DeleteApplicationCommand,
  GetApplicationCommand,
  GetApplicationPolicyCommand,
  GetCloudFormationTemplateCommand,
  ListApplicationVersionsCommand,
  ListApplicationsCommand,
  PutApplicationPolicyCommand,
  ServerlessApplicationRepositoryClient,
  UpdateApplicationCommand,
} from "@aws-sdk/client-serverlessapplicationrepository";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sar = () =>
  new ServerlessApplicationRepositoryClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("serverlessrepo application CRUD", async () => {
  const client = sar();
  const name = `bunsai-sar-app-${Date.now()}`;

  const created = await client.send(
    new CreateApplicationCommand({
      Name: name,
      Author: "test-author",
      Description: "bunsai e2e test app",
      SemanticVersion: "1.0.0",
      TemplateBody: '{"AWSTemplateFormatVersion":"2010-09-09","Resources":{}}',
    }),
  );
  expect(created.ApplicationId).toContain(`applications/${name}`);
  expect(created.Author).toBe("test-author");
  expect(created.Description).toBe("bunsai e2e test app");
  expect(created.Name).toBe(name);
  const appId = created.ApplicationId!;

  const got = await client.send(
    new GetApplicationCommand({ ApplicationId: appId }),
  );
  expect(got.ApplicationId).toBe(appId);
  expect(got.Name).toBe(name);
  expect(got.Description).toBe("bunsai e2e test app");
  expect(got.Version?.SemanticVersion).toBe("1.0.0");

  const listed = await client.send(new ListApplicationsCommand({}));
  expect((listed.Applications ?? []).map((a) => a.ApplicationId)).toContain(
    appId,
  );

  const updated = await client.send(
    new UpdateApplicationCommand({
      ApplicationId: appId,
      Description: "updated description",
    }),
  );
  expect(updated.Description).toBe("updated description");

  await client.send(new DeleteApplicationCommand({ ApplicationId: appId }));

  await expect(
    client.send(new GetApplicationCommand({ ApplicationId: appId })),
  ).rejects.toThrow();
});

test("serverlessrepo version CRUD", async () => {
  const client = sar();
  const name = `bunsai-sar-ver-${Date.now()}`;

  const created = await client.send(
    new CreateApplicationCommand({
      Name: name,
      Author: "test-author",
      Description: "version test app",
    }),
  );
  const appId = created.ApplicationId!;

  await client.send(
    new CreateApplicationVersionCommand({
      ApplicationId: appId,
      SemanticVersion: "1.0.0",
      TemplateBody: '{"AWSTemplateFormatVersion":"2010-09-09","Resources":{}}',
    }),
  );

  await expect(
    client.send(
      new CreateApplicationVersionCommand({
        ApplicationId: appId,
        SemanticVersion: "1.0.0",
        TemplateBody:
          '{"AWSTemplateFormatVersion":"2010-09-09","Resources":{}}',
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new CreateApplicationVersionCommand({
      ApplicationId: appId,
      SemanticVersion: "2.0.0",
      TemplateBody: '{"AWSTemplateFormatVersion":"2010-09-09","Resources":{}}',
    }),
  );

  const versions = await client.send(
    new ListApplicationVersionsCommand({ ApplicationId: appId }),
  );
  expect(versions.Versions?.length).toBe(2);
  const semvers = (versions.Versions ?? []).map((v) => v.SemanticVersion);
  expect(semvers).toContain("1.0.0");
  expect(semvers).toContain("2.0.0");

  await client.send(new DeleteApplicationCommand({ ApplicationId: appId }));
});

test("serverlessrepo CloudFormation template lifecycle", async () => {
  const client = sar();
  const name = `bunsai-sar-tmpl-${Date.now()}`;

  const app = await client.send(
    new CreateApplicationCommand({
      Name: name,
      Author: "test-author",
      Description: "template lifecycle test",
      SemanticVersion: "1.0.0",
      TemplateBody: '{"AWSTemplateFormatVersion":"2010-09-09","Resources":{}}',
    }),
  );
  const appId = app.ApplicationId!;

  const tmplCreated = await client.send(
    new CreateCloudFormationTemplateCommand({ ApplicationId: appId }),
  );
  expect(tmplCreated.ApplicationId).toBe(appId);
  expect(tmplCreated.TemplateId).toBeDefined();
  expect(tmplCreated.TemplateUrl).toBeDefined();
  expect(["PREPARING", "ACTIVE"]).toContain(tmplCreated.Status!);
  const templateId = tmplCreated.TemplateId!;

  const tmplGot = await client.send(
    new GetCloudFormationTemplateCommand({
      ApplicationId: appId,
      TemplateId: templateId,
    }),
  );
  expect(tmplGot.TemplateId).toBe(templateId);
  expect(tmplGot.TemplateUrl).toBe(tmplCreated.TemplateUrl);
  expect(["PREPARING", "ACTIVE"]).toContain(tmplGot.Status!);

  await client.send(new DeleteApplicationCommand({ ApplicationId: appId }));
});

test("serverlessrepo CloudFormation changeset stub", async () => {
  const client = sar();
  const name = `bunsai-sar-cs-${Date.now()}`;

  const app = await client.send(
    new CreateApplicationCommand({
      Name: name,
      Author: "test-author",
      Description: "changeset test",
      SemanticVersion: "1.0.0",
      TemplateBody: '{"AWSTemplateFormatVersion":"2010-09-09","Resources":{}}',
    }),
  );
  const appId = app.ApplicationId!;

  const cs = await client.send(
    new CreateCloudFormationChangeSetCommand({
      ApplicationId: appId,
      StackName: `bunsai-stack-${Date.now()}`,
    }),
  );
  expect(cs.ApplicationId).toBe(appId);
  expect(cs.ChangeSetId).toContain("changeSet");
  expect(cs.StackId).toContain("stack");

  await client.send(new DeleteApplicationCommand({ ApplicationId: appId }));
});

test("serverlessrepo application policy round-trip", async () => {
  const client = sar();
  const name = `bunsai-sar-pol-${Date.now()}`;

  const app = await client.send(
    new CreateApplicationCommand({
      Name: name,
      Author: "test-author",
      Description: "policy test",
    }),
  );
  const appId = app.ApplicationId!;

  const putResult = await client.send(
    new PutApplicationPolicyCommand({
      ApplicationId: appId,
      Statements: [
        {
          Principals: ["123456789012"],
          Actions: ["GetApplication"],
        },
      ],
    }),
  );
  expect(putResult.Statements?.length).toBe(1);
  expect(putResult.Statements?.[0].Principals).toContain("123456789012");

  const getResult = await client.send(
    new GetApplicationPolicyCommand({ ApplicationId: appId }),
  );
  expect(getResult.Statements?.length).toBe(1);
  expect(getResult.Statements?.[0].Actions).toContain("GetApplication");

  await client.send(new DeleteApplicationCommand({ ApplicationId: appId }));
});
