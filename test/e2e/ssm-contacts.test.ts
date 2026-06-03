import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AcceptPageCommand,
  ActivateContactChannelCommand,
  CreateContactChannelCommand,
  CreateContactCommand,
  CreateRotationCommand,
  CreateRotationOverrideCommand,
  DeactivateContactChannelCommand,
  DeleteContactChannelCommand,
  DeleteContactCommand,
  DeleteRotationCommand,
  DeleteRotationOverrideCommand,
  DescribeEngagementCommand,
  DescribePageCommand,
  GetContactChannelCommand,
  GetContactCommand,
  GetContactPolicyCommand,
  GetRotationCommand,
  GetRotationOverrideCommand,
  ListContactChannelsCommand,
  ListContactsCommand,
  ListEngagementsCommand,
  ListPageReceiptsCommand,
  ListPageResolutionsCommand,
  ListPagesByContactCommand,
  ListPagesByEngagementCommand,
  ListPreviewRotationShiftsCommand,
  ListRotationOverridesCommand,
  ListRotationShiftsCommand,
  ListRotationsCommand,
  ListTagsForResourceCommand,
  PutContactPolicyCommand,
  SSMContactsClient,
  SendActivationCodeCommand,
  StartEngagementCommand,
  StopEngagementCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateContactChannelCommand,
  UpdateContactCommand,
  UpdateRotationCommand,
} from "@aws-sdk/client-ssm-contacts";
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

const ssmContacts = () =>
  new SSMContactsClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("SSMContacts contact roundtrip", async () => {
  const client = ssmContacts();
  const alias = `bunsai_e2e_${Date.now()}`;

  const created = await client.send(
    new CreateContactCommand({
      Alias: alias,
      Type: "PERSONAL",
      Plan: { Stages: [] },
    }),
  );
  expect(created.ContactArn).toContain(`contact/${alias}`);

  const got = await client.send(
    new GetContactCommand({ ContactId: created.ContactArn }),
  );
  expect(got.ContactArn).toBe(created.ContactArn);
  expect(got.Alias).toBe(alias);
  expect(got.Type).toBe("PERSONAL");
  expect(got.Plan?.Stages).toEqual([]);

  const listed = await client.send(new ListContactsCommand({}));
  expect((listed.Contacts ?? []).map((c) => c.Alias)).toContain(alias);

  await client.send(
    new DeleteContactCommand({ ContactId: created.ContactArn }),
  );
  await expect(
    client.send(new GetContactCommand({ ContactId: created.ContactArn })),
  ).rejects.toThrow();
});

test("SSMContacts UpdateContact", async () => {
  const client = ssmContacts();
  const alias = `bunsai_update_${Date.now()}`;

  const created = await client.send(
    new CreateContactCommand({
      Alias: alias,
      Type: "PERSONAL",
      Plan: { Stages: [] },
    }),
  );

  await client.send(
    new UpdateContactCommand({
      ContactId: created.ContactArn,
      DisplayName: "Updated Name",
    }),
  );

  const got = await client.send(
    new GetContactCommand({ ContactId: created.ContactArn }),
  );
  expect(got.DisplayName).toBe("Updated Name");

  await client.send(
    new DeleteContactCommand({ ContactId: created.ContactArn }),
  );
});

test("SSMContacts contact channel lifecycle", async () => {
  const client = ssmContacts();
  const alias = `bunsai_ch_${Date.now()}`;

  const contact = await client.send(
    new CreateContactCommand({
      Alias: alias,
      Type: "PERSONAL",
      Plan: { Stages: [] },
    }),
  );

  const channel = await client.send(
    new CreateContactChannelCommand({
      ContactId: contact.ContactArn!,
      Name: "test-email",
      Type: "EMAIL",
      DeliveryAddress: { SimpleAddress: "test@example.com" },
    }),
  );
  expect(channel.ContactChannelArn).toContain("contact-channel");

  const got = await client.send(
    new GetContactChannelCommand({
      ContactChannelId: channel.ContactChannelArn!,
    }),
  );
  expect(got.Name).toBe("test-email");
  expect(got.Type).toBe("EMAIL");
  expect(got.ActivationStatus).toBe("NOT_ACTIVATED");

  await client.send(
    new SendActivationCodeCommand({
      ContactChannelId: channel.ContactChannelArn!,
    }),
  );

  await client.send(
    new ActivateContactChannelCommand({
      ContactChannelId: channel.ContactChannelArn!,
      ActivationCode: "123456",
    }),
  );

  const activated = await client.send(
    new GetContactChannelCommand({
      ContactChannelId: channel.ContactChannelArn!,
    }),
  );
  expect(activated.ActivationStatus).toBe("ACTIVATED");

  await client.send(
    new DeactivateContactChannelCommand({
      ContactChannelId: channel.ContactChannelArn!,
    }),
  );

  const deactivated = await client.send(
    new GetContactChannelCommand({
      ContactChannelId: channel.ContactChannelArn!,
    }),
  );
  expect(deactivated.ActivationStatus).toBe("NOT_ACTIVATED");

  await client.send(
    new UpdateContactChannelCommand({
      ContactChannelId: channel.ContactChannelArn!,
      Name: "updated-email",
    }),
  );

  const updated = await client.send(
    new GetContactChannelCommand({
      ContactChannelId: channel.ContactChannelArn!,
    }),
  );
  expect(updated.Name).toBe("updated-email");

  const listed = await client.send(
    new ListContactChannelsCommand({ ContactId: contact.ContactArn! }),
  );
  expect(
    (listed.ContactChannels ?? []).map((c) => c.ContactChannelArn),
  ).toContain(channel.ContactChannelArn);

  await client.send(
    new DeleteContactChannelCommand({
      ContactChannelId: channel.ContactChannelArn!,
    }),
  );

  await expect(
    client.send(
      new GetContactChannelCommand({
        ContactChannelId: channel.ContactChannelArn!,
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteContactCommand({ ContactId: contact.ContactArn! }),
  );
});

test("SSMContacts rotation lifecycle", async () => {
  const client = ssmContacts();
  const alias = `bunsai_rot_${Date.now()}`;

  const contact = await client.send(
    new CreateContactCommand({
      Alias: alias,
      Type: "PERSONAL",
      Plan: { Stages: [] },
    }),
  );

  const rotation = await client.send(
    new CreateRotationCommand({
      Name: `rotation-${alias}`,
      ContactIds: [contact.ContactArn!],
      TimeZoneId: "UTC",
      Recurrence: {
        NumberOfOnCalls: 1,
        RecurrenceMultiplier: 1,
        DailySettings: [{ HourOfDay: 8, MinuteOfHour: 0 }],
      },
    }),
  );
  expect(rotation.RotationArn).toContain("rotation");

  const got = await client.send(
    new GetRotationCommand({ RotationId: rotation.RotationArn! }),
  );
  expect(got.Name).toBe(`rotation-${alias}`);
  expect(got.TimeZoneId).toBe("UTC");

  const listed = await client.send(new ListRotationsCommand({}));
  expect((listed.Rotations ?? []).map((r) => r.RotationArn)).toContain(
    rotation.RotationArn,
  );

  await client.send(
    new UpdateRotationCommand({
      RotationId: rotation.RotationArn!,
      Recurrence: {
        NumberOfOnCalls: 1,
        RecurrenceMultiplier: 2,
        DailySettings: [{ HourOfDay: 9, MinuteOfHour: 0 }],
      },
    }),
  );

  const updated = await client.send(
    new GetRotationCommand({ RotationId: rotation.RotationArn! }),
  );
  expect(updated.Recurrence?.RecurrenceMultiplier).toBe(2);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);

  const shifts = await client.send(
    new ListRotationShiftsCommand({
      RotationId: rotation.RotationArn!,
      EndTime: tomorrow,
    }),
  );
  expect(shifts.RotationShifts).toBeDefined();

  const previewShifts = await client.send(
    new ListPreviewRotationShiftsCommand({
      EndTime: tomorrow,
      Members: [contact.ContactArn!],
      TimeZoneId: "UTC",
      Recurrence: {
        NumberOfOnCalls: 1,
        RecurrenceMultiplier: 1,
        DailySettings: [{ HourOfDay: 8, MinuteOfHour: 0 }],
      },
    }),
  );
  expect(previewShifts.RotationShifts).toBeDefined();

  await client.send(
    new DeleteRotationCommand({ RotationId: rotation.RotationArn! }),
  );

  await expect(
    client.send(new GetRotationCommand({ RotationId: rotation.RotationArn! })),
  ).rejects.toThrow();

  await client.send(
    new DeleteContactCommand({ ContactId: contact.ContactArn! }),
  );
});

test("SSMContacts rotation override lifecycle", async () => {
  const client = ssmContacts();
  const alias = `bunsai_ov_${Date.now()}`;

  const contact = await client.send(
    new CreateContactCommand({
      Alias: alias,
      Type: "PERSONAL",
      Plan: { Stages: [] },
    }),
  );

  const rotation = await client.send(
    new CreateRotationCommand({
      Name: `rotation-ov-${alias}`,
      ContactIds: [contact.ContactArn!],
      TimeZoneId: "UTC",
      Recurrence: {
        NumberOfOnCalls: 1,
        RecurrenceMultiplier: 1,
        DailySettings: [{ HourOfDay: 8, MinuteOfHour: 0 }],
      },
    }),
  );

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const dayAfter = new Date(now.getTime() + 172800000);

  const override = await client.send(
    new CreateRotationOverrideCommand({
      RotationId: rotation.RotationArn!,
      NewContactIds: [contact.ContactArn!],
      StartTime: tomorrow,
      EndTime: dayAfter,
    }),
  );
  expect(override.RotationOverrideId).toBeDefined();

  const got = await client.send(
    new GetRotationOverrideCommand({
      RotationId: rotation.RotationArn!,
      RotationOverrideId: override.RotationOverrideId!,
    }),
  );
  expect(got.RotationOverrideId).toBe(override.RotationOverrideId);

  const listed = await client.send(
    new ListRotationOverridesCommand({
      RotationId: rotation.RotationArn!,
      StartTime: now,
      EndTime: dayAfter,
    }),
  );
  expect(
    (listed.RotationOverrides ?? []).map((o) => o.RotationOverrideId),
  ).toContain(override.RotationOverrideId);

  await client.send(
    new DeleteRotationOverrideCommand({
      RotationId: rotation.RotationArn!,
      RotationOverrideId: override.RotationOverrideId!,
    }),
  );

  await client.send(
    new DeleteRotationCommand({ RotationId: rotation.RotationArn! }),
  );
  await client.send(
    new DeleteContactCommand({ ContactId: contact.ContactArn! }),
  );
});

test("SSMContacts engagement lifecycle", async () => {
  const client = ssmContacts();
  const alias = `bunsai_eng_${Date.now()}`;

  const contact = await client.send(
    new CreateContactCommand({
      Alias: alias,
      Type: "PERSONAL",
      Plan: { Stages: [] },
    }),
  );

  const channel = await client.send(
    new CreateContactChannelCommand({
      ContactId: contact.ContactArn!,
      Name: "eng-email",
      Type: "EMAIL",
      DeliveryAddress: { SimpleAddress: "eng@example.com" },
    }),
  );

  const engagement = await client.send(
    new StartEngagementCommand({
      ContactId: contact.ContactArn!,
      Sender: "test-sender",
      Subject: "Test Subject",
      Content: "Test Content",
    }),
  );
  expect(engagement.EngagementArn).toContain("engagement");

  const described = await client.send(
    new DescribeEngagementCommand({ EngagementId: engagement.EngagementArn! }),
  );
  expect(described.Sender).toBe("test-sender");
  expect(described.Subject).toBe("Test Subject");
  expect(described.Content).toBe("Test Content");

  const listed = await client.send(new ListEngagementsCommand({}));
  expect((listed.Engagements ?? []).map((e) => e.EngagementArn)).toContain(
    engagement.EngagementArn,
  );

  const pagesByContact = await client.send(
    new ListPagesByContactCommand({ ContactId: contact.ContactArn! }),
  );
  expect((pagesByContact.Pages ?? []).length).toBeGreaterThan(0);

  const pagesByEngagement = await client.send(
    new ListPagesByEngagementCommand({
      EngagementId: engagement.EngagementArn!,
    }),
  );
  expect((pagesByEngagement.Pages ?? []).length).toBeGreaterThan(0);

  const pageArn = pagesByEngagement.Pages![0].PageArn!;

  const describedPage = await client.send(
    new DescribePageCommand({ PageId: pageArn }),
  );
  expect(describedPage.Sender).toBe("test-sender");
  expect(describedPage.Subject).toBe("Test Subject");

  const receipts = await client.send(
    new ListPageReceiptsCommand({ PageId: pageArn }),
  );
  expect((receipts.Receipts ?? []).length).toBeGreaterThan(0);

  await client.send(
    new AcceptPageCommand({
      PageId: pageArn,
      AcceptType: "READ",
      AcceptCode: "test-code",
      ContactChannelId: channel.ContactChannelArn,
    }),
  );

  const receiptsAfter = await client.send(
    new ListPageReceiptsCommand({ PageId: pageArn }),
  );
  expect(
    (receiptsAfter.Receipts ?? []).some((r) => r.ReceiptType === "READ"),
  ).toBe(true);

  const resolutions = await client.send(
    new ListPageResolutionsCommand({ PageId: pageArn }),
  );
  expect(resolutions.PageResolutions).toBeDefined();

  await client.send(
    new StopEngagementCommand({ EngagementId: engagement.EngagementArn! }),
  );

  const stopped = await client.send(
    new DescribeEngagementCommand({ EngagementId: engagement.EngagementArn! }),
  );
  expect(stopped.StopTime).toBeDefined();

  await client.send(
    new DeleteContactChannelCommand({
      ContactChannelId: channel.ContactChannelArn!,
    }),
  );
  await client.send(
    new DeleteContactCommand({ ContactId: contact.ContactArn! }),
  );
});

test("SSMContacts contact policy", async () => {
  const client = ssmContacts();
  const alias = `bunsai_pol_${Date.now()}`;

  const contact = await client.send(
    new CreateContactCommand({
      Alias: alias,
      Type: "PERSONAL",
      Plan: { Stages: [] },
    }),
  );

  const policy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Principal: "*", Action: "ssm-contacts:*" }],
  });

  await client.send(
    new PutContactPolicyCommand({
      ContactArn: contact.ContactArn!,
      Policy: policy,
    }),
  );

  const got = await client.send(
    new GetContactPolicyCommand({ ContactArn: contact.ContactArn! }),
  );
  expect(got.Policy).toBe(policy);

  await client.send(
    new DeleteContactCommand({ ContactId: contact.ContactArn! }),
  );
});

test("SSMContacts tags lifecycle", async () => {
  const client = ssmContacts();
  const alias = `bunsai_tag_${Date.now()}`;

  const contact = await client.send(
    new CreateContactCommand({
      Alias: alias,
      Type: "PERSONAL",
      Plan: { Stages: [] },
    }),
  );
  const resourceArn = contact.ContactArn!;

  await client.send(
    new TagResourceCommand({
      ResourceARN: resourceArn,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );

  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: resourceArn }),
  );
  expect((tags.Tags ?? []).find((t) => t.Key === "env")?.Value).toBe("test");

  await client.send(
    new UntagResourceCommand({ ResourceARN: resourceArn, TagKeys: ["env"] }),
  );

  const tagsAfter = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: resourceArn }),
  );
  expect((tagsAfter.Tags ?? []).find((t) => t.Key === "env")).toBeUndefined();

  await client.send(
    new DeleteContactCommand({ ContactId: contact.ContactArn! }),
  );
});
