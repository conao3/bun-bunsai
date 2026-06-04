import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AssociateOriginationIdentityCommand,
  CarrierLookupCommand,
  CreateConfigurationSetCommand,
  CreateEventDestinationCommand,
  CreateOptOutListCommand,
  CreatePoolCommand,
  CreateProtectConfigurationCommand,
  CreateRegistrationCommand,
  CreateVerifiedDestinationNumberCommand,
  DeleteConfigurationSetCommand,
  DeleteOptOutListCommand,
  DeletePoolCommand,
  DeleteProtectConfigurationCommand,
  DeleteRegistrationCommand,
  DeleteVerifiedDestinationNumberCommand,
  DescribeConfigurationSetsCommand,
  DescribeOptOutListsCommand,
  DescribeOptedOutNumbersCommand,
  DescribePhoneNumbersCommand,
  DescribePoolsCommand,
  DescribeProtectConfigurationsCommand,
  DescribeRegistrationVersionsCommand,
  DescribeRegistrationsCommand,
  DescribeSpendLimitsCommand,
  ListPoolOriginationIdentitiesCommand,
  ListTagsForResourceCommand,
  PinpointSMSVoiceV2Client,
  PutOptedOutNumberCommand,
  ReleasePhoneNumberCommand,
  RequestPhoneNumberCommand,
  SendTextMessageCommand,
  SetTextMessageSpendLimitOverrideCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";

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

const smsVoice = () =>
  new PinpointSMSVoiceV2Client({ endpoint, region, credentials });

test("PinpointSMSVoiceV2 configuration set roundtrip", async () => {
  const client = smsVoice();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateConfigurationSetCommand({ ConfigurationSetName: name }),
  );
  expect(created.ConfigurationSetName).toBe(name);
  expect(created.ConfigurationSetArn).toContain(`configuration-set/${name}`);

  const described = await client.send(
    new DescribeConfigurationSetsCommand({ ConfigurationSetNames: [name] }),
  );
  const names = (described.ConfigurationSets ?? []).map(
    (set) => set.ConfigurationSetName,
  );
  expect(names).toContain(name);

  const deleted = await client.send(
    new DeleteConfigurationSetCommand({ ConfigurationSetName: name }),
  );
  expect(deleted.ConfigurationSetName).toBe(name);
  expect(deleted.ConfigurationSetArn).toBe(created.ConfigurationSetArn);

  const after = await client.send(
    new DescribeConfigurationSetsCommand({ ConfigurationSetNames: [name] }),
  );
  expect((after.ConfigurationSets ?? []).length).toBe(0);
});

test("PinpointSMSVoiceV2 phone number request/describe/release", async () => {
  const client = smsVoice();

  const requested = await client.send(
    new RequestPhoneNumberCommand({
      IsoCountryCode: "US",
      MessageType: "TRANSACTIONAL",
      NumberCapabilities: ["SMS"],
      NumberType: "SIMULATOR",
    }),
  );
  expect(requested.PhoneNumberId).toBeTruthy();
  expect(requested.PhoneNumberArn).toContain("phone-number/");
  expect(requested.Status).toBe("ACTIVE");
  expect(requested.IsoCountryCode).toBe("US");

  const described = await client.send(
    new DescribePhoneNumbersCommand({
      PhoneNumberIds: [requested.PhoneNumberId!],
    }),
  );
  expect((described.PhoneNumbers ?? []).length).toBe(1);
  expect(described.PhoneNumbers![0]!.PhoneNumberId).toBe(
    requested.PhoneNumberId,
  );

  const released = await client.send(
    new ReleasePhoneNumberCommand({ PhoneNumberId: requested.PhoneNumberId! }),
  );
  expect(released.PhoneNumberId).toBe(requested.PhoneNumberId);

  const afterRelease = await client.send(
    new DescribePhoneNumbersCommand({
      PhoneNumberIds: [requested.PhoneNumberId!],
    }),
  );
  expect((afterRelease.PhoneNumbers ?? []).length).toBe(0);
});

test("PinpointSMSVoiceV2 pool create/associate/describe/delete", async () => {
  const client = smsVoice();

  const phoneResult = await client.send(
    new RequestPhoneNumberCommand({
      IsoCountryCode: "US",
      MessageType: "TRANSACTIONAL",
      NumberCapabilities: ["SMS"],
      NumberType: "SIMULATOR",
    }),
  );

  const pool = await client.send(
    new CreatePoolCommand({
      OriginationIdentity: phoneResult.PhoneNumberId!,
      MessageType: "TRANSACTIONAL",
    }),
  );
  expect(pool.PoolId).toBeTruthy();
  expect(pool.Status).toBe("ACTIVE");

  await client.send(
    new AssociateOriginationIdentityCommand({
      PoolId: pool.PoolId!,
      OriginationIdentity: phoneResult.PhoneNumberId!,
      IsoCountryCode: "US",
    }),
  );

  const origins = await client.send(
    new ListPoolOriginationIdentitiesCommand({ PoolId: pool.PoolId! }),
  );
  expect((origins.OriginationIdentities ?? []).length).toBeGreaterThanOrEqual(
    1,
  );

  const pools = await client.send(
    new DescribePoolsCommand({ PoolIds: [pool.PoolId!] }),
  );
  expect((pools.Pools ?? []).length).toBe(1);

  await client.send(new DeletePoolCommand({ PoolId: pool.PoolId! }));
  await client.send(
    new ReleasePhoneNumberCommand({
      PhoneNumberId: phoneResult.PhoneNumberId!,
    }),
  );
});

test("PinpointSMSVoiceV2 opt-out list + opted-out numbers", async () => {
  const client = smsVoice();
  const listName = `e2e-optout-${Date.now()}`;

  const created = await client.send(
    new CreateOptOutListCommand({ OptOutListName: listName }),
  );
  expect(created.OptOutListName).toBe(listName);

  const described = await client.send(
    new DescribeOptOutListsCommand({ OptOutListNames: [listName] }),
  );
  expect(
    (described.OptOutLists ?? []).some((o) => o.OptOutListName === listName),
  ).toBe(true);

  await client.send(
    new PutOptedOutNumberCommand({
      OptOutListName: listName,
      OptedOutNumber: "+15555550100",
    }),
  );

  const optedOut = await client.send(
    new DescribeOptedOutNumbersCommand({ OptOutListName: listName }),
  );
  expect(
    (optedOut.OptedOutNumbers ?? []).some(
      (n) => n.OptedOutNumber === "+15555550100",
    ),
  ).toBe(true);

  await client.send(new DeleteOptOutListCommand({ OptOutListName: listName }));
});

test("PinpointSMSVoiceV2 registration create/version/describe/delete", async () => {
  const client = smsVoice();

  const reg = await client.send(
    new CreateRegistrationCommand({ RegistrationType: "US_TEN_DLC_BRAND" }),
  );
  expect(reg.RegistrationId).toBeTruthy();
  expect(reg.RegistrationStatus).toBe("CREATED");
  expect(reg.CurrentVersionNumber).toBe(1);

  const versions = await client.send(
    new DescribeRegistrationVersionsCommand({
      RegistrationId: reg.RegistrationId!,
    }),
  );
  expect((versions.RegistrationVersions ?? []).length).toBe(1);

  const regs = await client.send(
    new DescribeRegistrationsCommand({
      RegistrationIds: [reg.RegistrationId!],
    }),
  );
  expect((regs.Registrations ?? []).length).toBe(1);

  await client.send(
    new DeleteRegistrationCommand({ RegistrationId: reg.RegistrationId! }),
  );
});

test("PinpointSMSVoiceV2 protect configuration lifecycle", async () => {
  const client = smsVoice();

  const created = await client.send(new CreateProtectConfigurationCommand({}));
  expect(created.ProtectConfigurationId).toBeTruthy();
  expect(created.AccountDefault).toBe(false);

  const described = await client.send(
    new DescribeProtectConfigurationsCommand({
      ProtectConfigurationIds: [created.ProtectConfigurationId!],
    }),
  );
  expect((described.ProtectConfigurations ?? []).length).toBe(1);

  await client.send(
    new DeleteProtectConfigurationCommand({
      ProtectConfigurationId: created.ProtectConfigurationId!,
    }),
  );
});

test("PinpointSMSVoiceV2 event destination create/update/delete", async () => {
  const client = smsVoice();
  const csName = `e2e-cs-${Date.now()}`;

  await client.send(
    new CreateConfigurationSetCommand({ ConfigurationSetName: csName }),
  );

  const dest = await client.send(
    new CreateEventDestinationCommand({
      ConfigurationSetName: csName,
      EventDestinationName: "test-dest",
      MatchingEventTypes: ["TEXT_SUCCESSFUL"],
    }),
  );
  expect(dest.ConfigurationSetName).toBe(csName);
  expect(dest.EventDestination?.EventDestinationName).toBe("test-dest");

  await client.send(
    new DeleteConfigurationSetCommand({ ConfigurationSetName: csName }),
  );
});

test("PinpointSMSVoiceV2 send text message", async () => {
  const client = smsVoice();

  const result = await client.send(
    new SendTextMessageCommand({
      DestinationPhoneNumber: "+15555550100",
      MessageBody: "Hello from e2e test",
    }),
  );
  expect(result.MessageId).toBeTruthy();
});

test("PinpointSMSVoiceV2 tags lifecycle", async () => {
  const client = smsVoice();
  const csName = `e2e-tag-${Date.now()}`;

  const cs = await client.send(
    new CreateConfigurationSetCommand({ ConfigurationSetName: csName }),
  );
  const arn = cs.ConfigurationSetArn!;

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(
    (listed.Tags ?? []).some((t) => t.Key === "env" && t.Value === "test"),
  ).toBe(true);

  await client.send(
    new UntagResourceCommand({ ResourceArn: arn, TagKeys: ["env"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect((afterUntag.Tags ?? []).some((t) => t.Key === "env")).toBe(false);

  await client.send(
    new DeleteConfigurationSetCommand({ ConfigurationSetName: csName }),
  );
});

test("PinpointSMSVoiceV2 spend limit override", async () => {
  const client = smsVoice();

  await client.send(
    new SetTextMessageSpendLimitOverrideCommand({ MonthlyLimit: 500 }),
  );

  const limits = await client.send(new DescribeSpendLimitsCommand({}));
  const textLimit = (limits.SpendLimits ?? []).find(
    (l) => l.Name === "TEXT_MESSAGE_MONTHLY_SPEND_LIMIT",
  );
  expect(textLimit?.EnforcedLimit).toBe(500);
  expect(textLimit?.Overridden).toBe(true);
});

test("PinpointSMSVoiceV2 verified destination number lifecycle", async () => {
  const client = smsVoice();

  const created = await client.send(
    new CreateVerifiedDestinationNumberCommand({
      DestinationPhoneNumber: "+15555550200",
    }),
  );
  expect(created.VerifiedDestinationNumberId).toBeTruthy();
  expect(created.Status).toBe("PENDING");

  await client.send(
    new DeleteVerifiedDestinationNumberCommand({
      VerifiedDestinationNumberId: created.VerifiedDestinationNumberId!,
    }),
  );
});

test("PinpointSMSVoiceV2 carrier lookup", async () => {
  const client = smsVoice();

  const result = await client.send(
    new CarrierLookupCommand({ PhoneNumber: "+15555550300" }),
  );
  expect(result.E164PhoneNumber).toBe("+15555550300");
  expect(result.PhoneNumberType).toBeTruthy();
});
