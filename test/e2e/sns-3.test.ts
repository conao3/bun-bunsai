import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AddPermissionCommand,
  CheckIfPhoneNumberIsOptedOutCommand,
  CreateSMSSandboxPhoneNumberCommand,
  CreateTopicCommand,
  DeletePlatformApplicationCommand,
  DeleteSMSSandboxPhoneNumberCommand,
  DeleteTopicCommand,
  GetDataProtectionPolicyCommand,
  GetPlatformApplicationAttributesCommand,
  GetSMSAttributesCommand,
  GetSMSSandboxAccountStatusCommand,
  GetTopicAttributesCommand,
  ListOriginationNumbersCommand,
  ListPhoneNumbersOptedOutCommand,
  ListSMSSandboxPhoneNumbersCommand,
  OptInPhoneNumberCommand,
  PublishBatchCommand,
  PutDataProtectionPolicyCommand,
  RemovePermissionCommand,
  SetPlatformApplicationAttributesCommand,
  SetSMSAttributesCommand,
  SNSClient,
  VerifySMSSandboxPhoneNumberCommand,
  CreatePlatformApplicationCommand,
} from "@aws-sdk/client-sns";

const awsPort = 4891;
const uiPort = 5891;
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

const sns = () => new SNSClient({ endpoint, region, credentials });

test("SNS PublishBatch succeeds for valid entries", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-batch" }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  const result = await client.send(
    new PublishBatchCommand({
      TopicArn: topicArn,
      PublishBatchRequestEntries: [
        { Id: "msg1", Message: "hello batch 1" },
        { Id: "msg2", Message: "hello batch 2" },
        { Id: "msg3", Message: "hello batch 3" },
      ],
    }),
  );
  expect((result.Successful ?? []).length).toBe(3);
  expect((result.Failed ?? []).length).toBe(0);
  const ids = (result.Successful ?? []).map((s) => s.Id);
  expect(ids).toContain("msg1");
  expect(ids).toContain("msg2");
  expect(ids).toContain("msg3");
  for (const s of result.Successful ?? []) {
    expect(s.MessageId).toBeDefined();
  }

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});

test("SNS AddPermission / RemovePermission lifecycle", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-perm" }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  await client.send(
    new AddPermissionCommand({
      TopicArn: topicArn,
      Label: "AllowPublish",
      AWSAccountId: ["123456789012"],
      ActionName: ["Publish"],
    }),
  );

  const withPerm = await client.send(
    new GetTopicAttributesCommand({ TopicArn: topicArn }),
  );
  const policy = JSON.parse(withPerm.Attributes?.Policy ?? "{}") as {
    Statement?: Array<{ Sid?: string }>;
  };
  const sids = (policy.Statement ?? []).map((s) => s.Sid);
  expect(sids).toContain("AllowPublish");

  await client.send(
    new RemovePermissionCommand({
      TopicArn: topicArn,
      Label: "AllowPublish",
    }),
  );

  const afterRemove = await client.send(
    new GetTopicAttributesCommand({ TopicArn: topicArn }),
  );
  const policyAfter = JSON.parse(afterRemove.Attributes?.Policy ?? "{}") as {
    Statement?: Array<{ Sid?: string }>;
  };
  const sidsAfter = (policyAfter.Statement ?? []).map((s) => s.Sid);
  expect(sidsAfter).not.toContain("AllowPublish");

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});

test("SNS GetPlatformApplicationAttributes / SetPlatformApplicationAttributes / DeletePlatformApplication", async () => {
  const client = sns();

  const created = await client.send(
    new CreatePlatformApplicationCommand({
      Name: "bunsai-e2e-app-attrs",
      Platform: "GCM",
      Attributes: { PlatformCredential: "initial-key" },
    }),
  );
  const arn = created.PlatformApplicationArn;
  expect(arn).toBeDefined();

  const initial = await client.send(
    new GetPlatformApplicationAttributesCommand({
      PlatformApplicationArn: arn,
    }),
  );
  expect(initial.Attributes?.PlatformCredential).toBe("initial-key");

  await client.send(
    new SetPlatformApplicationAttributesCommand({
      PlatformApplicationArn: arn,
      Attributes: { PlatformCredential: "updated-key" },
    }),
  );

  const updated = await client.send(
    new GetPlatformApplicationAttributesCommand({
      PlatformApplicationArn: arn,
    }),
  );
  expect(updated.Attributes?.PlatformCredential).toBe("updated-key");

  await client.send(
    new DeletePlatformApplicationCommand({ PlatformApplicationArn: arn }),
  );

  await expect(
    client.send(
      new GetPlatformApplicationAttributesCommand({
        PlatformApplicationArn: arn,
      }),
    ),
  ).rejects.toThrow();
});

test("SNS GetDataProtectionPolicy / PutDataProtectionPolicy", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-dpp" }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  const initial = await client.send(
    new GetDataProtectionPolicyCommand({ ResourceArn: topicArn }),
  );
  expect(initial.DataProtectionPolicy ?? "").toBe("");

  const policy = JSON.stringify({ Statement: [] });
  await client.send(
    new PutDataProtectionPolicyCommand({
      ResourceArn: topicArn,
      DataProtectionPolicy: policy,
    }),
  );

  const afterPut = await client.send(
    new GetDataProtectionPolicyCommand({ ResourceArn: topicArn }),
  );
  expect(afterPut.DataProtectionPolicy).toBe(policy);

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});

test("SNS GetSMSAttributes / SetSMSAttributes", async () => {
  const client = sns();

  await client.send(
    new SetSMSAttributesCommand({
      attributes: {
        DefaultSMSType: "Transactional",
        DefaultSenderID: "BunSai",
      },
    }),
  );

  const result = await client.send(new GetSMSAttributesCommand({}));
  expect(result.attributes?.DefaultSMSType).toBe("Transactional");
  expect(result.attributes?.DefaultSenderID).toBe("BunSai");
});

test("SNS CheckIfPhoneNumberIsOptedOut / OptInPhoneNumber / ListPhoneNumbersOptedOut", async () => {
  const client = sns();

  const phone = "+12125550001";

  const check = await client.send(
    new CheckIfPhoneNumberIsOptedOutCommand({ phoneNumber: phone }),
  );
  expect(check.isOptedOut).toBe(false);

  await client.send(new OptInPhoneNumberCommand({ phoneNumber: phone }));

  const afterOptIn = await client.send(
    new CheckIfPhoneNumberIsOptedOutCommand({ phoneNumber: phone }),
  );
  expect(afterOptIn.isOptedOut).toBe(false);

  const listed = await client.send(new ListPhoneNumbersOptedOutCommand({}));
  expect(Array.isArray(listed.phoneNumbers)).toBe(true);
});

test("SNS ListOriginationNumbers returns empty list", async () => {
  const client = sns();

  const result = await client.send(new ListOriginationNumbersCommand({}));
  expect(Array.isArray(result.PhoneNumbers)).toBe(true);
});

test("SNS GetSMSSandboxAccountStatus returns sandbox true", async () => {
  const client = sns();

  const result = await client.send(new GetSMSSandboxAccountStatusCommand({}));
  expect(result.IsInSandbox).toBe(true);
});

test("SNS CreateSMSSandboxPhoneNumber / VerifySMSSandboxPhoneNumber / ListSMSSandboxPhoneNumbers / DeleteSMSSandboxPhoneNumber", async () => {
  const client = sns();

  const phone = "+13125550002";

  await client.send(
    new CreateSMSSandboxPhoneNumberCommand({ PhoneNumber: phone }),
  );

  const listed = await client.send(new ListSMSSandboxPhoneNumbersCommand({}));
  const phones = (listed.PhoneNumbers ?? []).map((p) => p.PhoneNumber);
  expect(phones).toContain(phone);

  const pending = (listed.PhoneNumbers ?? []).find(
    (p) => p.PhoneNumber === phone,
  );
  expect(pending?.Status).toBe("Pending");

  await client.send(
    new VerifySMSSandboxPhoneNumberCommand({
      PhoneNumber: phone,
      OneTimePassword: "123456",
    }),
  );

  const afterVerify = await client.send(
    new ListSMSSandboxPhoneNumbersCommand({}),
  );
  const verified = (afterVerify.PhoneNumbers ?? []).find(
    (p) => p.PhoneNumber === phone,
  );
  expect(verified?.Status).toBe("Verified");

  await client.send(
    new DeleteSMSSandboxPhoneNumberCommand({ PhoneNumber: phone }),
  );

  const afterDelete = await client.send(
    new ListSMSSandboxPhoneNumbersCommand({}),
  );
  const remaining = (afterDelete.PhoneNumbers ?? []).map((p) => p.PhoneNumber);
  expect(remaining).not.toContain(phone);
});
