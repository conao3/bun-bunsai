import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchGetMetricDataCommand,
  CancelExportJobCommand,
  CreateContactCommand,
  CreateContactListCommand,
  CreateCustomVerificationEmailTemplateCommand,
  CreateDeliverabilityTestReportCommand,
  CreateEmailIdentityCommand,
  CreateEmailIdentityPolicyCommand,
  CreateEmailTemplateCommand,
  CreateExportJobCommand,
  CreateImportJobCommand,
  DeleteContactCommand,
  DeleteContactListCommand,
  DeleteCustomVerificationEmailTemplateCommand,
  DeleteEmailIdentityPolicyCommand,
  GetContactCommand,
  GetContactListCommand,
  GetCustomVerificationEmailTemplateCommand,
  GetDeliverabilityTestReportCommand,
  GetEmailIdentityPoliciesCommand,
  GetExportJobCommand,
  GetImportJobCommand,
  GetMessageInsightsCommand,
  ListContactListsCommand,
  ListContactsCommand,
  ListCustomVerificationEmailTemplatesCommand,
  ListDeliverabilityTestReportsCommand,
  ListExportJobsCommand,
  ListImportJobsCommand,
  SendBulkEmailCommand,
  SendCustomVerificationEmailCommand,
  SendEmailCommand,
  SESv2Client,
  TestRenderEmailTemplateCommand,
  UpdateContactCommand,
  UpdateContactListCommand,
  UpdateCustomVerificationEmailTemplateCommand,
  UpdateEmailIdentityPolicyCommand,
} from "@aws-sdk/client-sesv2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sesv2 = () =>
  new SESv2Client({ endpoint, requestHandler, region, credentials });

test("contact list lifecycle", async () => {
  const c = sesv2();
  await c.send(
    new CreateContactListCommand({
      ContactListName: "mylist",
      Topics: [{ TopicName: "news", DisplayName: "News", DefaultSubscriptionStatus: "OPT_IN" }],
    }),
  );
  const got = await c.send(new GetContactListCommand({ ContactListName: "mylist" }));
  expect(got.ContactListName).toBe("mylist");
  expect(got.Topics?.length).toBe(1);

  await c.send(new UpdateContactListCommand({ ContactListName: "mylist", Description: "updated" }));

  const list = await c.send(new ListContactListsCommand({}));
  expect(list.ContactLists?.some((l) => l.ContactListName === "mylist")).toBe(true);

  await c.send(
    new CreateContactCommand({ ContactListName: "mylist", EmailAddress: "user@example.com" }),
  );
  const gotContact = await c.send(
    new GetContactCommand({ ContactListName: "mylist", EmailAddress: "user@example.com" }),
  );
  expect(gotContact.EmailAddress).toBe("user@example.com");

  await c.send(
    new UpdateContactCommand({
      ContactListName: "mylist",
      EmailAddress: "user@example.com",
      UnsubscribeAll: true,
    }),
  );
  const contacts = await c.send(new ListContactsCommand({ ContactListName: "mylist" }));
  expect(contacts.Contacts?.length).toBe(1);

  await c.send(
    new DeleteContactCommand({ ContactListName: "mylist", EmailAddress: "user@example.com" }),
  );
  await c.send(new DeleteContactListCommand({ ContactListName: "mylist" }));
  const list2 = await c.send(new ListContactListsCommand({}));
  expect(list2.ContactLists?.some((l) => l.ContactListName === "mylist")).toBe(false);
});

test("custom verification email template lifecycle", async () => {
  const c = sesv2();
  await c.send(
    new CreateCustomVerificationEmailTemplateCommand({
      TemplateName: "cvt1",
      FromEmailAddress: "from@example.com",
      TemplateSubject: "Verify",
      TemplateContent: "<p>Click here</p>",
      SuccessRedirectionURL: "https://example.com/success",
      FailureRedirectionURL: "https://example.com/fail",
    }),
  );
  const got = await c.send(
    new GetCustomVerificationEmailTemplateCommand({ TemplateName: "cvt1" }),
  );
  expect(got.TemplateName).toBe("cvt1");

  await c.send(
    new UpdateCustomVerificationEmailTemplateCommand({
      TemplateName: "cvt1",
      TemplateSubject: "Verify Updated",
      FromEmailAddress: "from@example.com",
      TemplateContent: "<p>Click</p>",
      SuccessRedirectionURL: "https://example.com/success",
      FailureRedirectionURL: "https://example.com/fail",
    }),
  );
  const list = await c.send(new ListCustomVerificationEmailTemplatesCommand({}));
  expect(list.CustomVerificationEmailTemplates?.some((t) => t.TemplateName === "cvt1")).toBe(true);

  const sendRes = await c.send(
    new SendCustomVerificationEmailCommand({
      EmailAddress: "dest@example.com",
      TemplateName: "cvt1",
    }),
  );
  expect(sendRes.MessageId).toBeDefined();

  await c.send(new DeleteCustomVerificationEmailTemplateCommand({ TemplateName: "cvt1" }));
  const list2 = await c.send(new ListCustomVerificationEmailTemplatesCommand({}));
  expect(list2.CustomVerificationEmailTemplates?.some((t) => t.TemplateName === "cvt1")).toBe(false);
});

test("email identity policy lifecycle", async () => {
  const c = sesv2();
  await c.send(new CreateEmailIdentityCommand({ EmailIdentity: "policy-test@example.com" }));
  await c.send(
    new CreateEmailIdentityPolicyCommand({
      EmailIdentity: "policy-test@example.com",
      PolicyName: "pol1",
      Policy: JSON.stringify({ Version: "2012-10-17", Statement: [] }),
    }),
  );
  const got = await c.send(
    new GetEmailIdentityPoliciesCommand({ EmailIdentity: "policy-test@example.com" }),
  );
  expect(got.Policies?.pol1).toBeDefined();

  await c.send(
    new UpdateEmailIdentityPolicyCommand({
      EmailIdentity: "policy-test@example.com",
      PolicyName: "pol1",
      Policy: JSON.stringify({ Version: "2012-10-17", Statement: [{ Effect: "Allow" }] }),
    }),
  );
  await c.send(
    new DeleteEmailIdentityPolicyCommand({
      EmailIdentity: "policy-test@example.com",
      PolicyName: "pol1",
    }),
  );
  const got2 = await c.send(
    new GetEmailIdentityPoliciesCommand({ EmailIdentity: "policy-test@example.com" }),
  );
  expect(Object.keys(got2.Policies ?? {}).length).toBe(0);
});

test("export job lifecycle", async () => {
  const c = sesv2();
  const created = await c.send(
    new CreateExportJobCommand({
      ExportDataSource: {
        SuppressionListDestination: { SuppressionListImportAction: "PUT" },
      } as never,
      ExportDestination: { DataFormat: "CSV" },
    }),
  );
  expect(created.JobId).toBeDefined();

  const got = await c.send(new GetExportJobCommand({ JobId: created.JobId! }));
  expect(got.JobId).toBe(created.JobId);

  const list = await c.send(new ListExportJobsCommand({}));
  expect(list.ExportJobs?.some((j) => j.JobId === created.JobId)).toBe(true);

  await c.send(new CancelExportJobCommand({ JobId: created.JobId! }));
  const cancelled = await c.send(new GetExportJobCommand({ JobId: created.JobId! }));
  expect(cancelled.JobStatus).toBe("CANCELLED");
});

test("import job lifecycle", async () => {
  const c = sesv2();
  const created = await c.send(
    new CreateImportJobCommand({
      ImportDataSource: { S3Url: "s3://bucket/key", DataFormat: "CSV" },
      ImportDestination: { ContactListDestination: { ContactListName: "n/a", ContactListImportAction: "PUT" } },
    }),
  );
  expect(created.JobId).toBeDefined();

  const got = await c.send(new GetImportJobCommand({ JobId: created.JobId! }));
  expect(got.JobId).toBe(created.JobId);

  const list = await c.send(new ListImportJobsCommand({}));
  expect(list.ImportJobs?.some((j) => j.JobId === created.JobId)).toBe(true);
});

test("deliverability test report lifecycle", async () => {
  const c = sesv2();
  const created = await c.send(
    new CreateDeliverabilityTestReportCommand({
      FromEmailAddress: "from@example.com",
      Content: { Simple: { Subject: { Data: "test" }, Body: { Text: { Data: "body" } } } },
    }),
  );
  expect(created.ReportId).toBeDefined();

  const got = await c.send(
    new GetDeliverabilityTestReportCommand({ ReportId: created.ReportId! }),
  );
  expect(got.DeliverabilityTestReport?.ReportId).toBe(created.ReportId);

  const list = await c.send(new ListDeliverabilityTestReportsCommand({}));
  expect(
    list.DeliverabilityTestReports?.some((r) => r.ReportId === created.ReportId),
  ).toBe(true);
});

test("SendBulkEmail and TestRenderEmailTemplate", async () => {
  const c = sesv2();
  await c.send(new CreateEmailIdentityCommand({ EmailIdentity: "bulk-from@example.com" }));
  await c.send(
    new CreateEmailTemplateCommand({
      TemplateName: "bulk-tmpl",
      TemplateContent: { Subject: "Hello {{name}}", Html: "<p>Hi</p>", Text: "Hi" },
    }),
  );

  const bulk = await c.send(
    new SendBulkEmailCommand({
      FromEmailAddress: "bulk-from@example.com",
      DefaultContent: { Template: { TemplateName: "bulk-tmpl" } },
      BulkEmailEntries: [
        { Destination: { ToAddresses: ["a@example.com"] } },
        { Destination: { ToAddresses: ["b@example.com"] } },
      ],
    }),
  );
  expect(bulk.BulkEmailEntryResults?.length).toBe(2);

  const render = await c.send(
    new TestRenderEmailTemplateCommand({
      TemplateName: "bulk-tmpl",
      TemplateData: JSON.stringify({ name: "World" }),
    }),
  );
  expect(render.RenderedTemplate).toBeDefined();
});

test("BatchGetMetricData and GetMessageInsights", async () => {
  const c = sesv2();
  const batch = await c.send(
    new BatchGetMetricDataCommand({ Queries: [] }),
  );
  expect(batch.Results).toBeDefined();

  await c.send(new CreateEmailIdentityCommand({ EmailIdentity: "insights@example.com" }));
  const sent = await c.send(
    new SendEmailCommand({
      FromEmailAddress: "insights@example.com",
      Destination: { ToAddresses: ["to@example.com"] },
      Content: { Simple: { Subject: { Data: "hi" }, Body: { Text: { Data: "body" } } } },
    }),
  );
  const insights = await c.send(
    new GetMessageInsightsCommand({ MessageId: sent.MessageId! }),
  );
  expect(insights.MessageId).toBe(sent.MessageId);
});
