import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateAliasCommand,
  CreateKeyCommand,
  DecryptCommand,
  DescribeKeyCommand,
  EnableKeyRotationCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  GetKeyRotationStatusCommand,
  KMSClient,
  ListAliasesCommand,
  ScheduleKeyDeletionCommand,
  SignCommand,
  VerifyCommand,
} from "@aws-sdk/client-kms";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

describe("KMS encryption app scenario e2e", () => {
  const kms = () =>
    new KMSClient({ endpoint, region, credentials, requestHandler });

  test("encryption app lifecycle", async () => {
    const client = kms();

    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;
    const keyArn = created.KeyMetadata?.Arn;
    expect(keyId).toBeDefined();
    expect(keyArn).toContain(keyId ?? "");
    expect(created.KeyMetadata?.KeyState).toBe("Enabled");

    const aliasName = "alias/bunsai-scenario-app";
    await client.send(
      new CreateAliasCommand({ AliasName: aliasName, TargetKeyId: keyId }),
    );
    const listed = await client.send(new ListAliasesCommand({ KeyId: keyId }));
    const alias = (listed.Aliases ?? []).find((a) => a.AliasName === aliasName);
    expect(alias).toBeDefined();
    expect(alias?.TargetKeyId).toBe(keyId);

    const plaintext = "bunsai-secret-data";
    const encrypted = await client.send(
      new EncryptCommand({
        KeyId: aliasName,
        Plaintext: textEncoder.encode(plaintext),
      }),
    );
    expect(encrypted.CiphertextBlob).toBeDefined();
    const decrypted = await client.send(
      new DecryptCommand({ CiphertextBlob: encrypted.CiphertextBlob }),
    );
    expect(textDecoder.decode(decrypted.Plaintext)).toBe(plaintext);
    expect(decrypted.KeyId).toBe(keyArn);

    const appCtx = { app: "bunsai", env: "prod" };
    const encryptedCtx = await client.send(
      new EncryptCommand({
        KeyId: aliasName,
        Plaintext: textEncoder.encode("ctx-bound"),
        EncryptionContext: appCtx,
      }),
    );
    await expect(
      client.send(
        new DecryptCommand({
          CiphertextBlob: encryptedCtx.CiphertextBlob,
          EncryptionContext: { app: "bunsai", env: "staging" },
        }),
      ),
    ).rejects.toMatchObject({ name: "InvalidCiphertextException" });

    const dataKey = await client.send(
      new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: "AES_256" }),
    );
    expect(dataKey.Plaintext).toBeDefined();
    expect(dataKey.CiphertextBlob).toBeDefined();
    const unwrapped = await client.send(
      new DecryptCommand({ CiphertextBlob: dataKey.CiphertextBlob }),
    );
    expect(unwrapped.Plaintext).toEqual(dataKey.Plaintext);

    await client.send(new EnableKeyRotationCommand({ KeyId: keyId }));
    const rotationStatus = await client.send(
      new GetKeyRotationStatusCommand({ KeyId: keyId }),
    );
    expect(rotationStatus.KeyRotationEnabled).toBe(true);

    const deletion = await client.send(
      new ScheduleKeyDeletionCommand({ KeyId: keyId, PendingWindowInDays: 7 }),
    );
    expect(deletion.DeletionDate).toBeDefined();
    const described = await client.send(
      new DescribeKeyCommand({ KeyId: keyId }),
    );
    expect(described.KeyMetadata?.KeyState).toBe("PendingDeletion");
    await expect(
      client.send(
        new EncryptCommand({
          KeyId: keyId,
          Plaintext: textEncoder.encode("should-fail"),
        }),
      ),
    ).rejects.toMatchObject({ name: "KMSInvalidStateException" });
  });

  test("signing key lifecycle", async () => {
    const client = kms();

    const signingKey = await client.send(
      new CreateKeyCommand({ KeyUsage: "SIGN_VERIFY", KeySpec: "RSA_2048" }),
    );
    const signingKeyId = signingKey.KeyMetadata?.KeyId;
    expect(signingKeyId).toBeDefined();

    const message = textEncoder.encode("bunsai-signed-payload");
    const signed = await client.send(
      new SignCommand({
        KeyId: signingKeyId,
        Message: message,
        SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
      }),
    );
    expect(signed.Signature).toBeDefined();

    const verified = await client.send(
      new VerifyCommand({
        KeyId: signingKeyId,
        Message: message,
        Signature: signed.Signature,
        SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
      }),
    );
    expect(verified.SignatureValid).toBe(true);

    const tampered = textEncoder.encode("tampered-payload");
    const tamperedVerify = await client.send(
      new VerifyCommand({
        KeyId: signingKeyId,
        Message: tampered,
        Signature: signed.Signature,
        SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
      }),
    );
    expect(tamperedVerify.SignatureValid).toBe(false);
  });
});
