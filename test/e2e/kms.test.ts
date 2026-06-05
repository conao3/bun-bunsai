import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateKeyCommand,
  DecryptCommand,
  DescribeKeyCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
  ListKeysCommand,
} from "@aws-sdk/client-kms";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

describe("kms e2e", () => {
  const kms = () =>
    new KMSClient({ endpoint, region, credentials, requestHandler });

  test("create, describe and list keys", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({ Description: "bunsai-e2e-key" }),
    );
    const keyId = created.KeyMetadata?.KeyId;
    expect(keyId).toBeDefined();
    expect(created.KeyMetadata?.Arn).toContain(keyId ?? "");
    expect(created.KeyMetadata?.Enabled).toBe(true);

    const described = await client.send(
      new DescribeKeyCommand({ KeyId: keyId }),
    );
    expect(described.KeyMetadata?.KeyId).toBe(keyId ?? "");
    expect(described.KeyMetadata?.Description).toBe("bunsai-e2e-key");

    const listed = await client.send(new ListKeysCommand({}));
    const ids = (listed.Keys ?? []).map((k) => k.KeyId);
    expect(ids).toContain(keyId);
  });

  test("encrypt and decrypt round-trip", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;
    const plaintext = "bunsai-e2e-secret";

    const encrypted = await client.send(
      new EncryptCommand({
        KeyId: keyId,
        Plaintext: textEncoder.encode(plaintext),
      }),
    );
    expect(encrypted.CiphertextBlob).toBeDefined();
    expect(encrypted.KeyId).toContain(keyId ?? "");

    const decrypted = await client.send(
      new DecryptCommand({ CiphertextBlob: encrypted.CiphertextBlob }),
    );
    const recovered = textDecoder.decode(decrypted.Plaintext);
    expect(recovered).toBe(plaintext);
    expect(decrypted.KeyId).toContain(keyId ?? "");
  });

  test("generate data key returns plaintext and ciphertext", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;

    const generated = await client.send(
      new GenerateDataKeyCommand({ KeyId: keyId, NumberOfBytes: 32 }),
    );
    expect(generated.Plaintext).toBeDefined();
    expect(generated.Plaintext?.length).toBe(32);
    expect(generated.CiphertextBlob).toBeDefined();

    const decrypted = await client.send(
      new DecryptCommand({ CiphertextBlob: generated.CiphertextBlob }),
    );
    expect(decrypted.Plaintext).toEqual(generated.Plaintext);
  });
});
