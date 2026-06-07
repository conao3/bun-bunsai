import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateKeyCommand,
  GenerateDataKeyPairCommand,
  GetPublicKeyCommand,
  KMSClient,
  SignCommand,
} from "@aws-sdk/client-kms";
import nodeCrypto from "node:crypto";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const textEncoder = new TextEncoder();

describe("kms public key fidelity e2e", () => {
  const kms = () =>
    new KMSClient({ endpoint, region, credentials, requestHandler });

  test("GetPublicKey returns identical bytes on consecutive calls", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({ KeyUsage: "SIGN_VERIFY", KeySpec: "RSA_2048" }),
    );
    const keyId = created.KeyMetadata?.KeyId;
    expect(keyId).toBeDefined();

    const first = await client.send(new GetPublicKeyCommand({ KeyId: keyId }));
    const second = await client.send(new GetPublicKeyCommand({ KeyId: keyId }));

    expect(first.PublicKey).toBeDefined();
    expect(second.PublicKey).toBeDefined();
    expect(first.PublicKey!.length).toBeGreaterThan(0);
    expect(
      Buffer.from(first.PublicKey!).equals(Buffer.from(second.PublicKey!)),
    ).toBe(true);

    expect(first.KeySpec).toBe("RSA_2048");
    expect(first.KeyUsage).toBe("SIGN_VERIFY");
    expect(first.SigningAlgorithms).toContain("RSASSA_PKCS1_V1_5_SHA_256");
    expect(first.EncryptionAlgorithms).toHaveLength(0);
  });

  test("Sign output verifies locally against GetPublicKey result", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({ KeyUsage: "SIGN_VERIFY", KeySpec: "RSA_2048" }),
    );
    const keyId = created.KeyMetadata?.KeyId;

    const pubKeyResp = await client.send(
      new GetPublicKeyCommand({ KeyId: keyId }),
    );
    const publicKeyDer = Buffer.from(pubKeyResp.PublicKey!);

    const message = textEncoder.encode("fidelity-test-message");
    const signed = await client.send(
      new SignCommand({
        KeyId: keyId,
        Message: message,
        SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
      }),
    );
    expect(signed.Signature).toBeDefined();

    const pubKey = nodeCrypto.createPublicKey({
      key: publicKeyDer,
      format: "der",
      type: "spki",
    });
    const valid = nodeCrypto.verify(
      "sha256",
      Buffer.from(message),
      pubKey,
      Buffer.from(signed.Signature!),
    );
    expect(valid).toBe(true);
  });

  test("ECC GetPublicKey returns identical bytes on consecutive calls", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({
        KeyUsage: "SIGN_VERIFY",
        KeySpec: "ECC_NIST_P256",
      }),
    );
    const keyId = created.KeyMetadata?.KeyId;

    const first = await client.send(new GetPublicKeyCommand({ KeyId: keyId }));
    const second = await client.send(new GetPublicKeyCommand({ KeyId: keyId }));

    expect(
      Buffer.from(first.PublicKey!).equals(Buffer.from(second.PublicKey!)),
    ).toBe(true);
    expect(first.SigningAlgorithms).toContain("ECDSA_SHA_256");
  });

  test("GenerateDataKeyPair returns a mathematically matching keypair", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;

    const pair = await client.send(
      new GenerateDataKeyPairCommand({
        KeyId: keyId,
        KeyPairSpec: "RSA_2048",
      }),
    );

    expect(pair.PublicKey).toBeDefined();
    expect(pair.PrivateKeyPlaintext).toBeDefined();
    expect(pair.PrivateKeyCiphertextBlob).toBeDefined();
    expect(pair.KeyPairSpec).toBe("RSA_2048");

    const publicKey = nodeCrypto.createPublicKey({
      key: Buffer.from(pair.PublicKey!),
      format: "der",
      type: "spki",
    });
    const privateKey = nodeCrypto.createPrivateKey({
      key: Buffer.from(pair.PrivateKeyPlaintext!),
      format: "der",
      type: "pkcs8",
    });

    const testData = Buffer.from("keypair-match-test");
    const signature = nodeCrypto.sign("sha256", testData, privateKey);
    const verified = nodeCrypto.verify(
      "sha256",
      testData,
      publicKey,
      signature,
    );
    expect(verified).toBe(true);
  });
});
