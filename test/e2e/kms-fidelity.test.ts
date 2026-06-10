import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CancelKeyDeletionCommand,
  CreateGrantCommand,
  CreateKeyCommand,
  DecryptCommand,
  DisableKeyCommand,
  EnableKeyCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  GenerateDataKeyWithoutPlaintextCommand,
  KMSClient,
  ListGrantsCommand,
  ListKeysCommand,
  ListResourceTagsCommand,
  ReEncryptCommand,
  ScheduleKeyDeletionCommand,
} from "@aws-sdk/client-kms";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

describe("kms fidelity e2e", () => {
  const kms = () =>
    new KMSClient({ endpoint, region, credentials, requestHandler });

  test("disabled key rejects Encrypt with DisabledException", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;
    await client.send(new DisableKeyCommand({ KeyId: keyId }));

    await expect(
      client.send(
        new EncryptCommand({
          KeyId: keyId,
          Plaintext: textEncoder.encode("secret"),
        }),
      ),
    ).rejects.toMatchObject({ name: "DisabledException" });
  });

  test("pending-deletion key rejects Encrypt with KMSInvalidStateException", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;
    await client.send(
      new ScheduleKeyDeletionCommand({ KeyId: keyId, PendingWindowInDays: 7 }),
    );

    await expect(
      client.send(
        new EncryptCommand({
          KeyId: keyId,
          Plaintext: textEncoder.encode("secret"),
        }),
      ),
    ).rejects.toMatchObject({ name: "KMSInvalidStateException" });

    await client.send(new CancelKeyDeletionCommand({ KeyId: keyId }));
    await client.send(new EnableKeyCommand({ KeyId: keyId }));
  });

  test("disabled key rejects Decrypt with DisabledException", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;

    const encrypted = await client.send(
      new EncryptCommand({
        KeyId: keyId,
        Plaintext: textEncoder.encode("secret"),
      }),
    );

    await client.send(new DisableKeyCommand({ KeyId: keyId }));

    await expect(
      client.send(
        new DecryptCommand({ CiphertextBlob: encrypted.CiphertextBlob }),
      ),
    ).rejects.toMatchObject({ name: "DisabledException" });
  });

  test("GenerateDataKey ciphertext is recoverable via Decrypt", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;

    const generated = await client.send(
      new GenerateDataKeyCommand({ KeyId: keyId, NumberOfBytes: 32 }),
    );
    expect(generated.Plaintext?.length).toBe(32);
    expect(generated.CiphertextBlob).toBeDefined();

    const decrypted = await client.send(
      new DecryptCommand({ CiphertextBlob: generated.CiphertextBlob }),
    );
    expect(decrypted.Plaintext).toEqual(generated.Plaintext);
    expect(decrypted.KeyId).toContain(keyId ?? "");
  });

  test("disabled key rejects GenerateDataKey", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;
    await client.send(new DisableKeyCommand({ KeyId: keyId }));

    await expect(
      client.send(
        new GenerateDataKeyCommand({ KeyId: keyId, NumberOfBytes: 32 }),
      ),
    ).rejects.toMatchObject({ name: "DisabledException" });
  });

  test("GenerateDataKeyWithoutPlaintext ciphertext is recoverable via Decrypt", async () => {
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

  test("ReEncrypt round-trip: plaintext recoverable from destination key", async () => {
    const client = kms();
    const src = await client.send(new CreateKeyCommand({}));
    const dst = await client.send(new CreateKeyCommand({}));
    const srcKeyId = src.KeyMetadata?.KeyId;
    const dstKeyId = dst.KeyMetadata?.KeyId;
    const plaintext = "reencrypt-fidelity-test";

    const encrypted = await client.send(
      new EncryptCommand({
        KeyId: srcKeyId,
        Plaintext: textEncoder.encode(plaintext),
      }),
    );

    const reEncrypted = await client.send(
      new ReEncryptCommand({
        CiphertextBlob: encrypted.CiphertextBlob,
        DestinationKeyId: dstKeyId,
      }),
    );
    expect(reEncrypted.KeyId).toContain(dstKeyId ?? "");
    expect(reEncrypted.SourceKeyId).toContain(srcKeyId ?? "");

    const decrypted = await client.send(
      new DecryptCommand({ CiphertextBlob: reEncrypted.CiphertextBlob }),
    );
    expect(textDecoder.decode(decrypted.Plaintext)).toBe(plaintext);
  });

  test("disabled destination key rejects ReEncrypt", async () => {
    const client = kms();
    const src = await client.send(new CreateKeyCommand({}));
    const dst = await client.send(new CreateKeyCommand({}));
    const srcKeyId = src.KeyMetadata?.KeyId;
    const dstKeyId = dst.KeyMetadata?.KeyId;

    const encrypted = await client.send(
      new EncryptCommand({
        KeyId: srcKeyId,
        Plaintext: textEncoder.encode("secret"),
      }),
    );

    await client.send(new DisableKeyCommand({ KeyId: dstKeyId }));

    await expect(
      client.send(
        new ReEncryptCommand({
          CiphertextBlob: encrypted.CiphertextBlob,
          DestinationKeyId: dstKeyId,
        }),
      ),
    ).rejects.toMatchObject({ name: "DisabledException" });
  });

  test("HIGH-1: CreateKey with Tags round-trips via ListResourceTags", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({
        Tags: [
          { TagKey: "Env", TagValue: "test" },
          { TagKey: "Owner", TagValue: "alice" },
        ],
      }),
    );
    const keyId = created.KeyMetadata?.KeyId;
    const listed = await client.send(
      new ListResourceTagsCommand({ KeyId: keyId }),
    );
    expect(listed.Tags).toHaveLength(2);
    const tagMap = Object.fromEntries(
      (listed.Tags ?? []).map((t) => [t.TagKey, t.TagValue]),
    );
    expect(tagMap["Env"]).toBe("test");
    expect(tagMap["Owner"]).toBe("alice");
    expect(listed.Truncated).toBe(false);
  });

  test("HIGH-2: ListKeys pagination with Limit and NextMarker", async () => {
    const client = kms();
    await client.send(new CreateKeyCommand({}));
    await client.send(new CreateKeyCommand({}));
    await client.send(new CreateKeyCommand({}));

    const page1 = await client.send(new ListKeysCommand({ Limit: 2 }));
    expect(page1.Keys).toHaveLength(2);
    expect(page1.Truncated).toBe(true);
    expect(page1.NextMarker).toBeDefined();

    const page2 = await client.send(
      new ListKeysCommand({ Limit: 2, Marker: page1.NextMarker }),
    );
    expect(page2.Keys!.length).toBeGreaterThanOrEqual(1);

    const allIds = [
      ...(page1.Keys ?? []).map((k) => k.KeyId),
      ...(page2.Keys ?? []).map((k) => k.KeyId),
    ];
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
  });

  test("HIGH-3: ListGrants filters by GranteePrincipal", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId!;

    await client.send(
      new CreateGrantCommand({
        KeyId: keyId,
        GranteePrincipal: "arn:aws:iam::123456789012:role/RoleA",
        Operations: ["Encrypt"],
      }),
    );
    await client.send(
      new CreateGrantCommand({
        KeyId: keyId,
        GranteePrincipal: "arn:aws:iam::123456789012:role/RoleB",
        Operations: ["Decrypt"],
      }),
    );

    const all = await client.send(new ListGrantsCommand({ KeyId: keyId }));
    expect(all.Grants).toHaveLength(2);

    const filtered = await client.send(
      new ListGrantsCommand({
        KeyId: keyId,
        GranteePrincipal: "arn:aws:iam::123456789012:role/RoleA",
      }),
    );
    expect(filtered.Grants).toHaveLength(1);
    expect(filtered.Grants?.[0].GranteePrincipal).toBe(
      "arn:aws:iam::123456789012:role/RoleA",
    );
  });
});
