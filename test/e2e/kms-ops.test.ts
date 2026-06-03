import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CancelKeyDeletionCommand,
  CreateAliasCommand,
  CreateKeyCommand,
  DecryptCommand,
  DeleteAliasCommand,
  DescribeKeyCommand,
  DisableKeyCommand,
  EnableKeyCommand,
  EncryptCommand,
  GenerateDataKeyWithoutPlaintextCommand,
  KMSClient,
  ListAliasesCommand,
  ListResourceTagsCommand,
  ScheduleKeyDeletionCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateAliasCommand,
} from "@aws-sdk/client-kms";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

const textEncoder = new TextEncoder();

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

describe("kms ops e2e", () => {
  let proc: ReturnType<typeof spawn> | undefined;

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

  const kms = () => new KMSClient({ endpoint, region, credentials });

  test("alias lifecycle and encryption through alias", async () => {
    const client = kms();
    const first = await client.send(new CreateKeyCommand({}));
    const firstKeyId = first.KeyMetadata?.KeyId;
    expect(firstKeyId).toBeDefined();
    const second = await client.send(new CreateKeyCommand({}));
    const secondKeyId = second.KeyMetadata?.KeyId;
    expect(secondKeyId).toBeDefined();

    const aliasName = `alias/bunsai-${Date.now()}`;
    await client.send(
      new CreateAliasCommand({
        AliasName: aliasName,
        TargetKeyId: firstKeyId,
      }),
    );

    const listed = await client.send(
      new ListAliasesCommand({ KeyId: firstKeyId }),
    );
    const names = (listed.Aliases ?? []).map((a) => a.AliasName);
    expect(names).toContain(aliasName);
    const entry = (listed.Aliases ?? []).find((a) => a.AliasName === aliasName);
    expect(entry?.TargetKeyId).toBe(firstKeyId ?? "");

    const encrypted = await client.send(
      new EncryptCommand({
        KeyId: aliasName,
        Plaintext: textEncoder.encode("via-alias"),
      }),
    );
    expect(encrypted.CiphertextBlob).toBeDefined();
    expect(encrypted.KeyId).toContain(firstKeyId ?? "");

    await client.send(
      new UpdateAliasCommand({
        AliasName: aliasName,
        TargetKeyId: secondKeyId,
      }),
    );
    const afterUpdate = await client.send(
      new ListAliasesCommand({ KeyId: secondKeyId }),
    );
    const updated = (afterUpdate.Aliases ?? []).find(
      (a) => a.AliasName === aliasName,
    );
    expect(updated?.TargetKeyId).toBe(secondKeyId ?? "");

    await client.send(new DeleteAliasCommand({ AliasName: aliasName }));
    const afterDelete = await client.send(
      new ListAliasesCommand({ KeyId: secondKeyId }),
    );
    const remaining = (afterDelete.Aliases ?? []).map((a) => a.AliasName);
    expect(remaining).not.toContain(aliasName);
  });

  test("enable, disable, schedule and cancel deletion", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;
    expect(keyId).toBeDefined();

    await client.send(new DisableKeyCommand({ KeyId: keyId }));
    const disabled = await client.send(
      new DescribeKeyCommand({ KeyId: keyId }),
    );
    expect(disabled.KeyMetadata?.Enabled).toBe(false);
    expect(disabled.KeyMetadata?.KeyState).toBe("Disabled");

    await client.send(new EnableKeyCommand({ KeyId: keyId }));
    const enabled = await client.send(new DescribeKeyCommand({ KeyId: keyId }));
    expect(enabled.KeyMetadata?.Enabled).toBe(true);
    expect(enabled.KeyMetadata?.KeyState).toBe("Enabled");

    const scheduled = await client.send(
      new ScheduleKeyDeletionCommand({
        KeyId: keyId,
        PendingWindowInDays: 7,
      }),
    );
    expect(scheduled.KeyState).toBe("PendingDeletion");
    expect(scheduled.PendingWindowInDays).toBe(7);
    expect(scheduled.DeletionDate).toBeDefined();
    expect(scheduled.KeyId).toContain(keyId ?? "");

    const cancelled = await client.send(
      new CancelKeyDeletionCommand({ KeyId: keyId }),
    );
    expect(cancelled.KeyId).toContain(keyId ?? "");
    const afterCancel = await client.send(
      new DescribeKeyCommand({ KeyId: keyId }),
    );
    expect(afterCancel.KeyMetadata?.KeyState).toBe("Disabled");
  });

  test("generate data key without plaintext", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;

    const generated = await client.send(
      new GenerateDataKeyWithoutPlaintextCommand({
        KeyId: keyId,
        NumberOfBytes: 32,
      }),
    );
    expect(generated.CiphertextBlob).toBeDefined();
    expect(generated.KeyId).toContain(keyId ?? "");

    const decrypted = await client.send(
      new DecryptCommand({ CiphertextBlob: generated.CiphertextBlob }),
    );
    expect(decrypted.Plaintext?.length).toBe(32);
  });

  test("tag, list and untag resource", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;

    await client.send(
      new TagResourceCommand({
        KeyId: keyId,
        Tags: [
          { TagKey: "env", TagValue: "test" },
          { TagKey: "team", TagValue: "platform" },
        ],
      }),
    );

    const listed = await client.send(
      new ListResourceTagsCommand({ KeyId: keyId }),
    );
    const tags = new Map(
      (listed.Tags ?? []).map((t) => [t.TagKey, t.TagValue]),
    );
    expect(tags.get("env")).toBe("test");
    expect(tags.get("team")).toBe("platform");

    await client.send(
      new UntagResourceCommand({ KeyId: keyId, TagKeys: ["env"] }),
    );
    const afterUntag = await client.send(
      new ListResourceTagsCommand({ KeyId: keyId }),
    );
    const remaining = (afterUntag.Tags ?? []).map((t) => t.TagKey);
    expect(remaining).not.toContain("env");
    expect(remaining).toContain("team");
  });
});
