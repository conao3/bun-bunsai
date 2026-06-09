import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloneReceiptRuleSetCommand,
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  CreateConfigurationSetTrackingOptionsCommand,
  CreateCustomVerificationEmailTemplateCommand,
  CreateReceiptFilterCommand,
  CreateReceiptRuleCommand,
  CreateReceiptRuleSetCommand,
  CreateTemplateCommand,
  DeleteConfigurationSetCommand,
  DeleteConfigurationSetEventDestinationCommand,
  DeleteConfigurationSetTrackingOptionsCommand,
  DeleteCustomVerificationEmailTemplateCommand,
  DeleteIdentityCommand,
  DeleteIdentityPolicyCommand,
  DeleteReceiptFilterCommand,
  DeleteReceiptRuleCommand,
  DeleteReceiptRuleSetCommand,
  DeleteTemplateCommand,
  DescribeActiveReceiptRuleSetCommand,
  DescribeConfigurationSetCommand,
  DescribeReceiptRuleCommand,
  DescribeReceiptRuleSetCommand,
  GetAccountSendingEnabledCommand,
  GetCustomVerificationEmailTemplateCommand,
  GetIdentityDkimAttributesCommand,
  GetIdentityMailFromDomainAttributesCommand,
  GetIdentityNotificationAttributesCommand,
  GetIdentityPoliciesCommand,
  GetIdentityVerificationAttributesCommand,
  GetSendQuotaCommand,
  GetSendStatisticsCommand,
  GetTemplateCommand,
  ListConfigurationSetsCommand,
  ListCustomVerificationEmailTemplatesCommand,
  ListIdentitiesCommand,
  ListIdentityPoliciesCommand,
  ListReceiptFiltersCommand,
  ListReceiptRuleSetsCommand,
  ListTemplatesCommand,
  ListVerifiedEmailAddressesCommand,
  PutConfigurationSetDeliveryOptionsCommand,
  PutIdentityPolicyCommand,
  ReorderReceiptRuleSetCommand,
  SendBounceCommand,
  SendBulkTemplatedEmailCommand,
  SendEmailCommand,
  SendRawEmailCommand,
  SendTemplatedEmailCommand,
  SESClient,
  SetActiveReceiptRuleSetCommand,
  SetIdentityDkimEnabledCommand,
  SetIdentityFeedbackForwardingEnabledCommand,
  SetIdentityHeadersInNotificationsEnabledCommand,
  SetIdentityMailFromDomainCommand,
  SetIdentityNotificationTopicCommand,
  TestRenderTemplateCommand,
  UpdateAccountSendingEnabledCommand,
  UpdateConfigurationSetEventDestinationCommand,
  UpdateConfigurationSetReputationMetricsEnabledCommand,
  UpdateConfigurationSetSendingEnabledCommand,
  UpdateConfigurationSetTrackingOptionsCommand,
  UpdateCustomVerificationEmailTemplateCommand,
  UpdateReceiptRuleCommand,
  UpdateTemplateCommand,
  VerifyDomainDkimCommand,
  VerifyDomainIdentityCommand,
  VerifyEmailAddressCommand,
  VerifyEmailIdentityCommand,
} from "@aws-sdk/client-ses";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ses = () =>
  new SESClient({ endpoint, region, credentials, requestHandler });

test("SES identity verification and send lifecycle", async () => {
  const client = ses();
  const address = "sender@bunsai-e2e.example.com";

  await client.send(new VerifyEmailIdentityCommand({ EmailAddress: address }));

  const listed = await client.send(new ListIdentitiesCommand({}));
  expect(listed.Identities ?? []).toContain(address);

  const attrs = await client.send(
    new GetIdentityVerificationAttributesCommand({ Identities: [address] }),
  );
  expect(attrs.VerificationAttributes?.[address]?.VerificationStatus).toBe(
    "Success",
  );

  const sent = await client.send(
    new SendEmailCommand({
      Source: address,
      Destination: { ToAddresses: ["recipient@example.com"] },
      Message: {
        Subject: { Data: "hello bunsai ses" },
        Body: { Text: { Data: "body text" } },
      },
    }),
  );
  expect(sent.MessageId).toBeDefined();
  expect((sent.MessageId ?? "").length).toBeGreaterThan(0);

  const rawData = new TextEncoder().encode(
    `From: ${address}\r\nTo: recipient@example.com\r\nSubject: raw\r\n\r\nraw body\r\n`,
  );
  const rawSent = await client.send(
    new SendRawEmailCommand({
      Source: address,
      Destinations: ["recipient@example.com"],
      RawMessage: { Data: rawData },
    }),
  );
  expect(rawSent.MessageId).toBeDefined();
  expect((rawSent.MessageId ?? "").length).toBeGreaterThan(0);

  const quota = await client.send(new GetSendQuotaCommand({}));
  expect(quota.Max24HourSend).toBe(200);
  expect(quota.MaxSendRate).toBe(1);
  expect(quota.SentLast24Hours).toBeGreaterThan(0);

  const stats = await client.send(new GetSendStatisticsCommand({}));
  const dp = (stats.SendDataPoints ?? [])[0];
  expect(dp).toBeDefined();
  expect(dp?.DeliveryAttempts ?? 0).toBeGreaterThan(0);

  await client.send(new DeleteIdentityCommand({ Identity: address }));
  const afterDelete = await client.send(new ListIdentitiesCommand({}));
  expect(afterDelete.Identities ?? []).not.toContain(address);
});

test("SES rejects sending from unverified identity", async () => {
  const client = ses();
  await expect(
    client.send(
      new SendEmailCommand({
        Source: "unverified@bunsai-e2e.example.com",
        Destination: { ToAddresses: ["recipient@example.com"] },
        Message: {
          Subject: { Data: "x" },
          Body: { Text: { Data: "y" } },
        },
      }),
    ),
  ).rejects.toThrow();
});

test("SES configuration set + event destination + tracking lifecycle", async () => {
  const client = ses();
  const csName = "e2e-configset";

  await client.send(
    new CreateConfigurationSetCommand({ ConfigurationSet: { Name: csName } }),
  );

  const listed = await client.send(new ListConfigurationSetsCommand({}));
  expect(
    (listed.ConfigurationSets ?? []).some((cs) => cs.Name === csName),
  ).toBe(true);

  await client.send(
    new CreateConfigurationSetEventDestinationCommand({
      ConfigurationSetName: csName,
      EventDestination: {
        Name: "e2e-dest",
        Enabled: true,
        MatchingEventTypes: ["send", "bounce"],
        SNSDestination: {
          TopicARN: "arn:aws:sns:us-east-1:123456789012:topic",
        },
      },
    }),
  );

  await client.send(
    new UpdateConfigurationSetEventDestinationCommand({
      ConfigurationSetName: csName,
      EventDestination: {
        Name: "e2e-dest",
        Enabled: false,
        MatchingEventTypes: ["send"],
        SNSDestination: {
          TopicARN: "arn:aws:sns:us-east-1:123456789012:topic",
        },
      },
    }),
  );

  const described = await client.send(
    new DescribeConfigurationSetCommand({ ConfigurationSetName: csName }),
  );
  expect(described.ConfigurationSet?.Name).toBe(csName);
  expect(described.EventDestinations?.length).toBe(1);
  expect(described.EventDestinations?.[0]?.Name).toBe("e2e-dest");
  expect(described.EventDestinations?.[0]?.Enabled).toBe(false);

  await client.send(
    new CreateConfigurationSetTrackingOptionsCommand({
      ConfigurationSetName: csName,
      TrackingOptions: { CustomRedirectDomain: "track.example.com" },
    }),
  );

  await client.send(
    new UpdateConfigurationSetTrackingOptionsCommand({
      ConfigurationSetName: csName,
      TrackingOptions: { CustomRedirectDomain: "track2.example.com" },
    }),
  );

  await client.send(
    new PutConfigurationSetDeliveryOptionsCommand({
      ConfigurationSetName: csName,
      DeliveryOptions: { TlsPolicy: "Optional" },
    }),
  );

  await client.send(
    new UpdateConfigurationSetReputationMetricsEnabledCommand({
      ConfigurationSetName: csName,
      Enabled: true,
    }),
  );

  await client.send(
    new UpdateConfigurationSetSendingEnabledCommand({
      ConfigurationSetName: csName,
      Enabled: false,
    }),
  );

  await client.send(
    new DeleteConfigurationSetEventDestinationCommand({
      ConfigurationSetName: csName,
      EventDestinationName: "e2e-dest",
    }),
  );

  await client.send(
    new DeleteConfigurationSetTrackingOptionsCommand({
      ConfigurationSetName: csName,
    }),
  );

  await client.send(
    new DeleteConfigurationSetCommand({ ConfigurationSetName: csName }),
  );

  const afterDelete = await client.send(new ListConfigurationSetsCommand({}));
  expect(
    (afterDelete.ConfigurationSets ?? []).some((cs) => cs.Name === csName),
  ).toBe(false);
});

test("SES receipt rule set + rule + filter lifecycle", async () => {
  const client = ses();
  const ruleSetName = "e2e-ruleset";

  await client.send(
    new CreateReceiptRuleSetCommand({ RuleSetName: ruleSetName }),
  );

  const listed = await client.send(new ListReceiptRuleSetsCommand({}));
  expect((listed.RuleSets ?? []).some((rs) => rs.Name === ruleSetName)).toBe(
    true,
  );

  await client.send(
    new CreateReceiptRuleCommand({
      RuleSetName: ruleSetName,
      Rule: {
        Name: "e2e-rule",
        Enabled: true,
        Recipients: ["test@example.com"],
        Actions: [],
        ScanEnabled: false,
      },
    }),
  );

  const described = await client.send(
    new DescribeReceiptRuleSetCommand({ RuleSetName: ruleSetName }),
  );
  expect(described.Metadata?.Name).toBe(ruleSetName);
  expect(described.Rules?.length).toBe(1);

  const rule = await client.send(
    new DescribeReceiptRuleCommand({
      RuleSetName: ruleSetName,
      RuleName: "e2e-rule",
    }),
  );
  expect(rule.Rule?.Name).toBe("e2e-rule");
  expect(rule.Rule?.Enabled).toBe(true);

  await client.send(
    new UpdateReceiptRuleCommand({
      RuleSetName: ruleSetName,
      Rule: {
        Name: "e2e-rule",
        Enabled: false,
        Recipients: ["updated@example.com"],
        Actions: [],
        ScanEnabled: true,
      },
    }),
  );

  await client.send(
    new SetActiveReceiptRuleSetCommand({ RuleSetName: ruleSetName }),
  );

  const active = await client.send(new DescribeActiveReceiptRuleSetCommand({}));
  expect(active.Metadata?.Name).toBe(ruleSetName);

  const cloneSetName = "e2e-ruleset-clone";
  await client.send(
    new CloneReceiptRuleSetCommand({
      OriginalRuleSetName: ruleSetName,
      RuleSetName: cloneSetName,
    }),
  );
  const cloneDesc = await client.send(
    new DescribeReceiptRuleSetCommand({ RuleSetName: cloneSetName }),
  );
  expect(cloneDesc.Rules?.length).toBe(1);

  await client.send(
    new ReorderReceiptRuleSetCommand({
      RuleSetName: ruleSetName,
      RuleNames: ["e2e-rule"],
    }),
  );

  await client.send(
    new DeleteReceiptRuleCommand({
      RuleSetName: ruleSetName,
      RuleName: "e2e-rule",
    }),
  );

  await client.send(
    new CreateReceiptFilterCommand({
      Filter: {
        Name: "e2e-filter",
        IpFilter: { Policy: "Block", Cidr: "10.0.0.0/8" },
      },
    }),
  );

  const filters = await client.send(new ListReceiptFiltersCommand({}));
  expect((filters.Filters ?? []).some((f) => f.Name === "e2e-filter")).toBe(
    true,
  );

  await client.send(
    new DeleteReceiptFilterCommand({ FilterName: "e2e-filter" }),
  );

  await client.send(new SetActiveReceiptRuleSetCommand({}));

  await client.send(
    new DeleteReceiptRuleSetCommand({ RuleSetName: ruleSetName }),
  );
  await client.send(
    new DeleteReceiptRuleSetCommand({ RuleSetName: cloneSetName }),
  );
});

test("SES template lifecycle + render", async () => {
  const client = ses();

  await client.send(
    new CreateTemplateCommand({
      Template: {
        TemplateName: "e2e-template",
        SubjectPart: "Hello {{name}}",
        TextPart: "Dear {{name}}, welcome.",
        HtmlPart: "<p>Dear {{name}}</p>",
      },
    }),
  );

  const got = await client.send(
    new GetTemplateCommand({ TemplateName: "e2e-template" }),
  );
  expect(got.Template?.TemplateName).toBe("e2e-template");
  expect(got.Template?.SubjectPart).toBe("Hello {{name}}");

  const listed = await client.send(new ListTemplatesCommand({}));
  expect(
    (listed.TemplatesMetadata ?? []).some((t) => t.Name === "e2e-template"),
  ).toBe(true);

  await client.send(
    new UpdateTemplateCommand({
      Template: {
        TemplateName: "e2e-template",
        SubjectPart: "Hi {{name}}",
        TextPart: "Hello {{name}}.",
        HtmlPart: "<p>Hi {{name}}</p>",
      },
    }),
  );

  const rendered = await client.send(
    new TestRenderTemplateCommand({
      TemplateName: "e2e-template",
      TemplateData: JSON.stringify({ name: "World" }),
    }),
  );
  expect(rendered.RenderedTemplate).toContain("World");

  const sender = "sender@bunsai-e2e.example.com";
  await client.send(new VerifyEmailIdentityCommand({ EmailAddress: sender }));
  const sent = await client.send(
    new SendTemplatedEmailCommand({
      Source: sender,
      Destination: { ToAddresses: ["dest@example.com"] },
      Template: "e2e-template",
      TemplateData: JSON.stringify({ name: "Test" }),
    }),
  );
  expect(sent.MessageId).toBeDefined();

  const bulkSent = await client.send(
    new SendBulkTemplatedEmailCommand({
      Source: sender,
      Template: "e2e-template",
      DefaultTemplateData: JSON.stringify({ name: "Default" }),
      Destinations: [
        {
          Destination: { ToAddresses: ["a@example.com"] },
          ReplacementTemplateData: JSON.stringify({ name: "Alice" }),
        },
      ],
    }),
  );
  expect(bulkSent.Status?.length).toBe(1);
  expect(bulkSent.Status?.[0]?.Status).toBe("Success");

  await client.send(
    new DeleteTemplateCommand({ TemplateName: "e2e-template" }),
  );
  await client.send(new DeleteIdentityCommand({ Identity: sender }));
});

test("SES custom verification email template lifecycle", async () => {
  const client = ses();

  await client.send(
    new CreateCustomVerificationEmailTemplateCommand({
      TemplateName: "e2e-cvtemplate",
      FromEmailAddress: "verify@example.com",
      TemplateSubject: "Verify your email",
      TemplateContent: "<p>Please verify</p>",
      SuccessRedirectionURL: "https://example.com/success",
      FailureRedirectionURL: "https://example.com/failure",
    }),
  );

  const got = await client.send(
    new GetCustomVerificationEmailTemplateCommand({
      TemplateName: "e2e-cvtemplate",
    }),
  );
  expect(got.TemplateName).toBe("e2e-cvtemplate");
  expect(got.SuccessRedirectionURL).toBe("https://example.com/success");

  const listed = await client.send(
    new ListCustomVerificationEmailTemplatesCommand({}),
  );
  expect(
    (listed.CustomVerificationEmailTemplates ?? []).some(
      (t) => t.TemplateName === "e2e-cvtemplate",
    ),
  ).toBe(true);

  await client.send(
    new UpdateCustomVerificationEmailTemplateCommand({
      TemplateName: "e2e-cvtemplate",
      FromEmailAddress: "verify2@example.com",
      TemplateSubject: "Verify your email (updated)",
      TemplateContent: "<p>Please verify now</p>",
      SuccessRedirectionURL: "https://example.com/ok",
      FailureRedirectionURL: "https://example.com/fail",
    }),
  );

  const updated = await client.send(
    new GetCustomVerificationEmailTemplateCommand({
      TemplateName: "e2e-cvtemplate",
    }),
  );
  expect(updated.SuccessRedirectionURL).toBe("https://example.com/ok");

  await client.send(
    new DeleteCustomVerificationEmailTemplateCommand({
      TemplateName: "e2e-cvtemplate",
    }),
  );

  await expect(
    client.send(
      new GetCustomVerificationEmailTemplateCommand({
        TemplateName: "e2e-cvtemplate",
      }),
    ),
  ).rejects.toThrow();
});

test("SES identity policy lifecycle", async () => {
  const client = ses();
  const domain = "policy-test.bunsai-e2e.example.com";

  await client.send(new VerifyDomainIdentityCommand({ Domain: domain }));

  await client.send(
    new PutIdentityPolicyCommand({
      Identity: domain,
      PolicyName: "e2e-policy",
      Policy: JSON.stringify({ Version: "2012-10-17", Statement: [] }),
    }),
  );

  const policyNames = await client.send(
    new ListIdentityPoliciesCommand({ Identity: domain }),
  );
  expect((policyNames.PolicyNames ?? []).includes("e2e-policy")).toBe(true);

  const policies = await client.send(
    new GetIdentityPoliciesCommand({
      Identity: domain,
      PolicyNames: ["e2e-policy"],
    }),
  );
  expect(policies.Policies?.["e2e-policy"]).toBeDefined();

  await client.send(
    new DeleteIdentityPolicyCommand({
      Identity: domain,
      PolicyName: "e2e-policy",
    }),
  );

  const afterDelete = await client.send(
    new ListIdentityPoliciesCommand({ Identity: domain }),
  );
  expect((afterDelete.PolicyNames ?? []).includes("e2e-policy")).toBe(false);

  await client.send(new DeleteIdentityCommand({ Identity: domain }));
});

test("SES domain identity attributes", async () => {
  const client = ses();
  const domain = "attrs-test.bunsai-e2e.example.com";

  const verifyResult = await client.send(
    new VerifyDomainIdentityCommand({ Domain: domain }),
  );
  expect(verifyResult.VerificationToken).toBeDefined();

  const dkimResult = await client.send(
    new VerifyDomainDkimCommand({ Domain: domain }),
  );
  expect((dkimResult.DkimTokens ?? []).length).toBe(3);

  const dkimAttrs = await client.send(
    new GetIdentityDkimAttributesCommand({ Identities: [domain] }),
  );
  expect(dkimAttrs.DkimAttributes?.[domain]?.DkimTokens?.length).toBe(3);

  await client.send(
    new SetIdentityDkimEnabledCommand({ Identity: domain, DkimEnabled: false }),
  );

  const dkimAttrs2 = await client.send(
    new GetIdentityDkimAttributesCommand({ Identities: [domain] }),
  );
  expect(dkimAttrs2.DkimAttributes?.[domain]?.DkimEnabled).toBe(false);

  await client.send(
    new SetIdentityMailFromDomainCommand({
      Identity: domain,
      MailFromDomain: "bounce.example.com",
    }),
  );

  const mailFromAttrs = await client.send(
    new GetIdentityMailFromDomainAttributesCommand({ Identities: [domain] }),
  );
  expect(mailFromAttrs.MailFromDomainAttributes?.[domain]?.MailFromDomain).toBe(
    "bounce.example.com",
  );

  await client.send(
    new SetIdentityNotificationTopicCommand({
      Identity: domain,
      NotificationType: "Bounce",
      SnsTopic: "arn:aws:sns:us-east-1:123456789012:bounce-topic",
    }),
  );

  await client.send(
    new SetIdentityFeedbackForwardingEnabledCommand({
      Identity: domain,
      ForwardingEnabled: false,
    }),
  );

  await client.send(
    new SetIdentityHeadersInNotificationsEnabledCommand({
      Identity: domain,
      NotificationType: "Bounce",
      Enabled: true,
    }),
  );

  const notifAttrs = await client.send(
    new GetIdentityNotificationAttributesCommand({ Identities: [domain] }),
  );
  expect(notifAttrs.NotificationAttributes?.[domain]?.ForwardingEnabled).toBe(
    false,
  );
  expect(
    notifAttrs.NotificationAttributes?.[domain]
      ?.HeadersInBounceNotificationsEnabled,
  ).toBe(true);

  await client.send(new DeleteIdentityCommand({ Identity: domain }));
});

test("SES account sending + send stats + misc", async () => {
  const client = ses();

  await client.send(new UpdateAccountSendingEnabledCommand({ Enabled: false }));
  const disabled = await client.send(new GetAccountSendingEnabledCommand({}));
  expect(disabled.Enabled).toBe(false);

  await client.send(new UpdateAccountSendingEnabledCommand({ Enabled: true }));
  const enabled = await client.send(new GetAccountSendingEnabledCommand({}));
  expect(enabled.Enabled).toBe(true);

  const stats = await client.send(new GetSendStatisticsCommand({}));
  expect((stats.SendDataPoints ?? []).length).toBeGreaterThan(0);

  const emailAddr = "bounce-src@bunsai-e2e.example.com";
  await client.send(new VerifyEmailAddressCommand({ EmailAddress: emailAddr }));

  const verifiedList = await client.send(
    new ListVerifiedEmailAddressesCommand({}),
  );
  expect((verifiedList.VerifiedEmailAddresses ?? []).includes(emailAddr)).toBe(
    true,
  );

  const bounceResult = await client.send(
    new SendBounceCommand({
      OriginalMessageId: "msg-12345",
      BounceSender: emailAddr,
      BouncedRecipientInfoList: [
        {
          Recipient: "bad@invalid-domain.example",
          BounceType: "DoesNotExist",
        },
      ],
    }),
  );
  expect(bounceResult.MessageId).toContain("msg-12345");
});

test("SES send-pause enforcement", async () => {
  const client = ses();
  const addr = "pause-test@bunsai-e2e.example.com";
  await client.send(new VerifyEmailIdentityCommand({ EmailAddress: addr }));
  await client.send(
    new CreateTemplateCommand({
      Template: {
        TemplateName: "pause-tmpl",
        SubjectPart: "Hi",
        TextPart: "Hello",
        HtmlPart: "<p>Hello</p>",
      },
    }),
  );

  await client.send(new UpdateAccountSendingEnabledCommand({ Enabled: false }));

  for (const fn of [
    () =>
      client.send(
        new SendEmailCommand({
          Source: addr,
          Destination: { ToAddresses: ["r@example.com"] },
          Message: { Subject: { Data: "s" }, Body: { Text: { Data: "b" } } },
        }),
      ),
    () =>
      client.send(
        new SendRawEmailCommand({
          RawMessage: {
            Data: new TextEncoder().encode(
              "From: " + addr + "\r\nTo: r@example.com\r\nSubject: s\r\n\r\nb",
            ),
          },
        }),
      ),
    () =>
      client.send(
        new SendTemplatedEmailCommand({
          Source: addr,
          Destination: { ToAddresses: ["r@example.com"] },
          Template: "pause-tmpl",
          TemplateData: "{}",
        }),
      ),
    () =>
      client.send(
        new SendBulkTemplatedEmailCommand({
          Source: addr,
          Template: "pause-tmpl",
          DefaultTemplateData: "{}",
          Destinations: [
            {
              Destination: { ToAddresses: ["r@example.com"] },
              ReplacementTemplateData: "{}",
            },
          ],
        }),
      ),
  ]) {
    await expect(fn()).rejects.toThrow();
  }

  await client.send(new UpdateAccountSendingEnabledCommand({ Enabled: true }));
});

test("SES templated send increments stats", async () => {
  const client = ses();
  const addr = "stats-test@bunsai-e2e.example.com";
  await client.send(new VerifyEmailIdentityCommand({ EmailAddress: addr }));
  await client.send(
    new CreateTemplateCommand({
      Template: {
        TemplateName: "stats-tmpl",
        SubjectPart: "Hi",
        TextPart: "Hello",
        HtmlPart: "<p>Hello</p>",
      },
    }),
  );

  const before = await client.send(new GetSendQuotaCommand({}));
  const beforeSent = before.SentLast24Hours ?? 0;

  await client.send(
    new SendTemplatedEmailCommand({
      Source: addr,
      Destination: { ToAddresses: ["r@example.com"] },
      Template: "stats-tmpl",
      TemplateData: "{}",
    }),
  );

  await client.send(
    new SendBulkTemplatedEmailCommand({
      Source: addr,
      Template: "stats-tmpl",
      DefaultTemplateData: "{}",
      Destinations: [
        {
          Destination: { ToAddresses: ["a@example.com"] },
          ReplacementTemplateData: "{}",
        },
        {
          Destination: { ToAddresses: ["b@example.com"] },
          ReplacementTemplateData: "{}",
        },
      ],
    }),
  );

  const after = await client.send(new GetSendQuotaCommand({}));
  expect((after.SentLast24Hours ?? 0) - beforeSent).toBe(3);

  const statsResult = await client.send(new GetSendStatisticsCommand({}));
  const points = statsResult.SendDataPoints ?? [];
  expect(points.length).toBeGreaterThan(0);
  const ts = points[0]?.Timestamp;
  expect(ts).toBeDefined();
  expect(new Date(ts!).getFullYear()).toBeGreaterThan(1970);
});

test("SES identity pagination", async () => {
  const client = ses();
  const addrs = [
    "pg1@bunsai-e2e.example.com",
    "pg2@bunsai-e2e.example.com",
    "pg3@bunsai-e2e.example.com",
  ];
  for (const a of addrs) {
    await client.send(new VerifyEmailIdentityCommand({ EmailAddress: a }));
  }

  const pageSize = 2;
  let nextToken: string | undefined;
  const allFromPaged: string[] = [];
  let pageCount = 0;

  do {
    const res = await client.send(
      new ListIdentitiesCommand({ MaxItems: pageSize, NextToken: nextToken }),
    );
    const items = res.Identities ?? [];
    expect(items.length).toBeLessThanOrEqual(pageSize);
    allFromPaged.push(...items);
    nextToken = res.NextToken;
    pageCount++;
  } while (nextToken !== undefined);

  expect(pageCount).toBeGreaterThan(1);
  for (const a of addrs) {
    expect(allFromPaged).toContain(a);
  }
});

test("SES active ruleset delete guard (HIGH-1)", async () => {
  const client = ses();
  const ruleSetName = "guard-test-ruleset";

  await client.send(
    new CreateReceiptRuleSetCommand({ RuleSetName: ruleSetName }),
  );
  await client.send(
    new SetActiveReceiptRuleSetCommand({ RuleSetName: ruleSetName }),
  );

  const active = await client.send(new DescribeActiveReceiptRuleSetCommand({}));
  expect(active.Metadata?.Name).toBe(ruleSetName);

  await expect(
    client.send(new DeleteReceiptRuleSetCommand({ RuleSetName: ruleSetName })),
  ).rejects.toMatchObject({ name: "CannotDeleteException" });

  await client.send(new SetActiveReceiptRuleSetCommand({}));
  await client.send(
    new DeleteReceiptRuleSetCommand({ RuleSetName: ruleSetName }),
  );
});

test("SES identity cascade cleanup (HIGH-2)", async () => {
  const client = ses();
  const domain = "cascade-test.bunsai-e2e.example.com";

  await client.send(new VerifyDomainIdentityCommand({ Domain: domain }));
  await client.send(new VerifyDomainDkimCommand({ Domain: domain }));
  await client.send(
    new SetIdentityNotificationTopicCommand({
      Identity: domain,
      NotificationType: "Bounce",
      SnsTopic: "arn:aws:sns:us-east-1:123456789012:bounce-topic",
    }),
  );
  await client.send(
    new SetIdentityMailFromDomainCommand({
      Identity: domain,
      MailFromDomain: `mail.${domain}`,
    }),
  );
  await client.send(
    new PutIdentityPolicyCommand({
      Identity: domain,
      PolicyName: "test-policy",
      Policy: '{"Version":"2012-10-17","Statement":[]}',
    }),
  );

  await client.send(new DeleteIdentityCommand({ Identity: domain }));

  await client.send(new VerifyDomainIdentityCommand({ Domain: domain }));

  const dkim = await client.send(
    new GetIdentityDkimAttributesCommand({ Identities: [domain] }),
  );
  expect(dkim.DkimAttributes?.[domain]?.DkimEnabled).toBe(true);
  expect(dkim.DkimAttributes?.[domain]?.DkimTokens ?? []).toHaveLength(0);

  const notif = await client.send(
    new GetIdentityNotificationAttributesCommand({ Identities: [domain] }),
  );
  expect(notif.NotificationAttributes?.[domain]?.BounceTopic).toBe("");

  const mailfrom = await client.send(
    new GetIdentityMailFromDomainAttributesCommand({ Identities: [domain] }),
  );
  expect(
    mailfrom.MailFromDomainAttributes?.[domain]?.MailFromDomain,
  ).toBeFalsy();

  const policies = await client.send(
    new ListIdentityPoliciesCommand({ Identity: domain }),
  );
  expect(policies.PolicyNames ?? []).toHaveLength(0);

  await client.send(new DeleteIdentityCommand({ Identity: domain }));
});

test("SES ListReceiptRuleSets pagination (MEDIUM-1)", async () => {
  const client = ses();
  const names = Array.from({ length: 3 }, (_, i) => `pagination-rs-${i}`);
  for (const name of names) {
    await client.send(new CreateReceiptRuleSetCommand({ RuleSetName: name }));
  }

  const res1 = await client.send(new ListReceiptRuleSetsCommand({}));
  expect(res1.RuleSets).toBeDefined();
  const all = res1.RuleSets ?? [];
  for (const name of names) {
    expect(all.some((rs) => rs.Name === name)).toBe(true);
  }

  if (res1.NextToken !== undefined) {
    const res2 = await client.send(
      new ListReceiptRuleSetsCommand({ NextToken: res1.NextToken }),
    );
    expect(res2.RuleSets).toBeDefined();
  }

  for (const name of names) {
    await client.send(
      new DeleteReceiptRuleSetCommand({ RuleSetName: name }),
    );
  }
});
