import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateConfigurationSetCommand,
  CreateEmailIdentityCommand,
  CreateEmailTemplateCommand,
  DeleteConfigurationSetCommand,
  DeleteEmailIdentityCommand,
  DeleteEmailTemplateCommand,
  DeleteSuppressedDestinationCommand,
  GetConfigurationSetCommand,
  GetEmailIdentityCommand,
  GetEmailTemplateCommand,
  GetSuppressedDestinationCommand,
  ListConfigurationSetsCommand,
  ListEmailIdentitiesCommand,
  ListEmailTemplatesCommand,
  ListSuppressedDestinationsCommand,
  PutSuppressedDestinationCommand,
  SendEmailCommand,
  SESv2Client,
  UpdateEmailTemplateCommand,
} from "@aws-sdk/client-sesv2";
import { SESClient, VerifyEmailIdentityCommand } from "@aws-sdk/client-ses";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sesv2 = () =>
  new SESv2Client({ endpoint, region, credentials, requestHandler });

const ses = () =>
  new SESClient({ endpoint, region, credentials, requestHandler });

test("identity lifecycle: create, get, list, delete", async () => {
  const client = sesv2();

  await client.send(
    new CreateEmailIdentityCommand({ EmailIdentity: "user@example.com" }),
  );
  await client.send(
    new CreateEmailIdentityCommand({ EmailIdentity: "example.com" }),
  );

  const get = await client.send(
    new GetEmailIdentityCommand({ EmailIdentity: "user@example.com" }),
  );
  expect(get.IdentityType).toBe("EMAIL_ADDRESS");
  expect(get.VerifiedForSendingStatus).toBe(true);

  const list = await client.send(new ListEmailIdentitiesCommand({}));
  expect(
    list.EmailIdentities?.some((i) => i.IdentityName === "user@example.com"),
  ).toBe(true);
  expect(
    list.EmailIdentities?.some((i) => i.IdentityName === "example.com"),
  ).toBe(true);

  await client.send(
    new DeleteEmailIdentityCommand({ EmailIdentity: "user@example.com" }),
  );
  await client.send(
    new DeleteEmailIdentityCommand({ EmailIdentity: "example.com" }),
  );

  const list2 = await client.send(new ListEmailIdentitiesCommand({}));
  expect(
    list2.EmailIdentities?.some((i) => i.IdentityName === "user@example.com"),
  ).toBe(false);
});

test("v1 identity visible in v2 list and get", async () => {
  const v1 = ses();
  const v2 = sesv2();

  await v1.send(
    new VerifyEmailIdentityCommand({ EmailAddress: "v1user@example.com" }),
  );

  const list = await v2.send(new ListEmailIdentitiesCommand({}));
  expect(
    list.EmailIdentities?.some((i) => i.IdentityName === "v1user@example.com"),
  ).toBe(true);

  const get = await v2.send(
    new GetEmailIdentityCommand({ EmailIdentity: "v1user@example.com" }),
  );
  expect(get.VerifiedForSendingStatus).toBe(true);
});

test("SendEmail basic success", async () => {
  const client = sesv2();

  await client.send(
    new CreateEmailIdentityCommand({ EmailIdentity: "sender@example.com" }),
  );

  const result = await client.send(
    new SendEmailCommand({
      FromEmailAddress: "sender@example.com",
      Destination: { ToAddresses: ["recipient@example.net"] },
      Content: {
        Simple: {
          Subject: { Data: "Test" },
          Body: { Text: { Data: "Hello" } },
        },
      },
    }),
  );
  expect(result.MessageId).toContain("sesv2-");

  await client.send(
    new DeleteEmailIdentityCommand({ EmailIdentity: "sender@example.com" }),
  );
});

test("SendEmail blocked by suppression list", async () => {
  const client = sesv2();

  await client.send(
    new CreateEmailIdentityCommand({ EmailIdentity: "sender@example.com" }),
  );
  await client.send(
    new PutSuppressedDestinationCommand({
      EmailAddress: "blocked@example.com",
      Reason: "BOUNCE",
    }),
  );

  let rejected = false;
  try {
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: "sender@example.com",
        Destination: { ToAddresses: ["blocked@example.com"] },
        Content: {
          Simple: {
            Subject: { Data: "Test" },
            Body: { Text: { Data: "Hello" } },
          },
        },
      }),
    );
  } catch {
    rejected = true;
  }
  expect(rejected).toBe(true);

  await client.send(
    new DeleteSuppressedDestinationCommand({
      EmailAddress: "blocked@example.com",
    }),
  );
  await client.send(
    new DeleteEmailIdentityCommand({ EmailIdentity: "sender@example.com" }),
  );
});

test("ConfigurationSet CRUD", async () => {
  const client = sesv2();

  await client.send(
    new CreateConfigurationSetCommand({
      ConfigurationSetName: "my-config-set",
    }),
  );

  const got = await client.send(
    new GetConfigurationSetCommand({ ConfigurationSetName: "my-config-set" }),
  );
  expect(got.ConfigurationSetName).toBe("my-config-set");

  const list = await client.send(new ListConfigurationSetsCommand({}));
  expect(list.ConfigurationSets?.includes("my-config-set")).toBe(true);

  await client.send(
    new DeleteConfigurationSetCommand({
      ConfigurationSetName: "my-config-set",
    }),
  );

  const list2 = await client.send(new ListConfigurationSetsCommand({}));
  expect(list2.ConfigurationSets?.includes("my-config-set")).toBe(false);
});

test("EmailTemplate CRUD", async () => {
  const client = sesv2();

  await client.send(
    new CreateEmailTemplateCommand({
      TemplateName: "my-template",
      TemplateContent: {
        Subject: "Hello {{name}}",
        Html: "<p>Hello {{name}}</p>",
        Text: "Hello {{name}}",
      },
    }),
  );

  const got = await client.send(
    new GetEmailTemplateCommand({ TemplateName: "my-template" }),
  );
  expect(got.TemplateName).toBe("my-template");
  expect(got.TemplateContent?.Subject).toBe("Hello {{name}}");

  await client.send(
    new UpdateEmailTemplateCommand({
      TemplateName: "my-template",
      TemplateContent: {
        Subject: "Updated {{name}}",
        Html: "<p>Updated</p>",
        Text: "Updated",
      },
    }),
  );

  const updated = await client.send(
    new GetEmailTemplateCommand({ TemplateName: "my-template" }),
  );
  expect(updated.TemplateContent?.Subject).toBe("Updated {{name}}");

  const list = await client.send(new ListEmailTemplatesCommand({}));
  expect(
    list.TemplatesMetadata?.some((t) => t.TemplateName === "my-template"),
  ).toBe(true);

  await client.send(
    new DeleteEmailTemplateCommand({ TemplateName: "my-template" }),
  );

  const list2 = await client.send(new ListEmailTemplatesCommand({}));
  expect(
    list2.TemplatesMetadata?.some((t) => t.TemplateName === "my-template"),
  ).toBe(false);
});

test("Suppression CRUD", async () => {
  const client = sesv2();

  await client.send(
    new PutSuppressedDestinationCommand({
      EmailAddress: "suppress@test.com",
      Reason: "COMPLAINT",
    }),
  );

  const got = await client.send(
    new GetSuppressedDestinationCommand({ EmailAddress: "suppress@test.com" }),
  );
  expect(got.SuppressedDestination?.EmailAddress).toBe("suppress@test.com");
  expect(got.SuppressedDestination?.Reason).toBe("COMPLAINT");

  const list = await client.send(new ListSuppressedDestinationsCommand({}));
  expect(
    list.SuppressedDestinationSummaries?.some(
      (s) => s.EmailAddress === "suppress@test.com",
    ),
  ).toBe(true);

  await client.send(
    new DeleteSuppressedDestinationCommand({
      EmailAddress: "suppress@test.com",
    }),
  );

  const list2 = await client.send(new ListSuppressedDestinationsCommand({}));
  expect(
    list2.SuppressedDestinationSummaries?.some(
      (s) => s.EmailAddress === "suppress@test.com",
    ),
  ).toBe(false);
});
