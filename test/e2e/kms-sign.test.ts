import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateKeyCommand,
  GenerateMacCommand,
  KMSClient,
  SignCommand,
  VerifyCommand,
  VerifyMacCommand,
} from "@aws-sdk/client-kms";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const textEncoder = new TextEncoder();

describe("kms sign/verify and mac e2e", () => {
  const kms = () =>
    new KMSClient({ endpoint, region, credentials, requestHandler });

  test("RSA sign and verify round-trip succeeds", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({ KeyUsage: "SIGN_VERIFY", KeySpec: "RSA_2048" }),
    );
    const keyId = created.KeyMetadata?.KeyId;
    expect(keyId).toBeDefined();

    const message = textEncoder.encode("hello bunsai");
    const signed = await client.send(
      new SignCommand({
        KeyId: keyId,
        Message: message,
        SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
      }),
    );
    expect(signed.Signature).toBeDefined();
    expect(signed.Signature!.length).toBeGreaterThan(0);
    expect(signed.SigningAlgorithm).toBe("RSASSA_PKCS1_V1_5_SHA_256");

    const verified = await client.send(
      new VerifyCommand({
        KeyId: keyId,
        Message: message,
        Signature: signed.Signature,
        SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
      }),
    );
    expect(verified.SignatureValid).toBe(true);
  });

  test("tampered message fails RSA verify", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({ KeyUsage: "SIGN_VERIFY", KeySpec: "RSA_2048" }),
    );
    const keyId = created.KeyMetadata?.KeyId;

    const message = textEncoder.encode("original message");
    const signed = await client.send(
      new SignCommand({
        KeyId: keyId,
        Message: message,
        SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
      }),
    );

    const tampered = textEncoder.encode("tampered message");
    const verified = await client.send(
      new VerifyCommand({
        KeyId: keyId,
        Message: tampered,
        Signature: signed.Signature,
        SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
      }),
    );
    expect(verified.SignatureValid).toBe(false);
  });

  test("tampered signature fails RSA verify", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({ KeyUsage: "SIGN_VERIFY", KeySpec: "RSA_2048" }),
    );
    const keyId = created.KeyMetadata?.KeyId;

    const message = textEncoder.encode("original message");
    const signed = await client.send(
      new SignCommand({
        KeyId: keyId,
        Message: message,
        SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
      }),
    );

    const tamperedSig = signed.Signature!.slice();
    tamperedSig[0] ^= 0xff;
    const verified = await client.send(
      new VerifyCommand({
        KeyId: keyId,
        Message: message,
        Signature: tamperedSig,
        SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
      }),
    );
    expect(verified.SignatureValid).toBe(false);
  });

  test("ECDSA sign and verify round-trip succeeds", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({
        KeyUsage: "SIGN_VERIFY",
        KeySpec: "ECC_NIST_P256",
      }),
    );
    const keyId = created.KeyMetadata?.KeyId;
    expect(keyId).toBeDefined();

    const message = textEncoder.encode("ecdsa test");
    const signed = await client.send(
      new SignCommand({
        KeyId: keyId,
        Message: message,
        SigningAlgorithm: "ECDSA_SHA_256",
      }),
    );
    expect(signed.Signature).toBeDefined();
    expect(signed.SigningAlgorithm).toBe("ECDSA_SHA_256");

    const verified = await client.send(
      new VerifyCommand({
        KeyId: keyId,
        Message: message,
        Signature: signed.Signature,
        SigningAlgorithm: "ECDSA_SHA_256",
      }),
    );
    expect(verified.SignatureValid).toBe(true);
  });

  test("tampered message fails ECDSA verify", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({
        KeyUsage: "SIGN_VERIFY",
        KeySpec: "ECC_NIST_P256",
      }),
    );
    const keyId = created.KeyMetadata?.KeyId;

    const message = textEncoder.encode("ecdsa original");
    const signed = await client.send(
      new SignCommand({
        KeyId: keyId,
        Message: message,
        SigningAlgorithm: "ECDSA_SHA_256",
      }),
    );

    const tampered = textEncoder.encode("ecdsa tampered");
    const verified = await client.send(
      new VerifyCommand({
        KeyId: keyId,
        Message: tampered,
        Signature: signed.Signature,
        SigningAlgorithm: "ECDSA_SHA_256",
      }),
    );
    expect(verified.SignatureValid).toBe(false);
  });

  test("HMAC generate and verify round-trip succeeds", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({
        KeyUsage: "GENERATE_VERIFY_MAC",
        KeySpec: "HMAC_256",
      }),
    );
    const keyId = created.KeyMetadata?.KeyId;
    expect(keyId).toBeDefined();

    const message = textEncoder.encode("mac-message");
    const mac = await client.send(
      new GenerateMacCommand({
        KeyId: keyId,
        Message: message,
        MacAlgorithm: "HMAC_SHA_256",
      }),
    );
    expect(mac.Mac).toBeDefined();
    expect(mac.Mac!.length).toBeGreaterThan(0);
    expect(mac.MacAlgorithm).toBe("HMAC_SHA_256");

    const verified = await client.send(
      new VerifyMacCommand({
        KeyId: keyId,
        Message: message,
        Mac: mac.Mac,
        MacAlgorithm: "HMAC_SHA_256",
      }),
    );
    expect(verified.MacValid).toBe(true);
  });

  test("tampered message fails HMAC verify", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({
        KeyUsage: "GENERATE_VERIFY_MAC",
        KeySpec: "HMAC_256",
      }),
    );
    const keyId = created.KeyMetadata?.KeyId;

    const message = textEncoder.encode("original mac message");
    const mac = await client.send(
      new GenerateMacCommand({
        KeyId: keyId,
        Message: message,
        MacAlgorithm: "HMAC_SHA_256",
      }),
    );

    const tampered = textEncoder.encode("tampered mac message");
    const verified = await client.send(
      new VerifyMacCommand({
        KeyId: keyId,
        Message: tampered,
        Mac: mac.Mac,
        MacAlgorithm: "HMAC_SHA_256",
      }),
    );
    expect(verified.MacValid).toBe(false);
  });

  test("tampered MAC fails HMAC verify", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({
        KeyUsage: "GENERATE_VERIFY_MAC",
        KeySpec: "HMAC_256",
      }),
    );
    const keyId = created.KeyMetadata?.KeyId;

    const message = textEncoder.encode("mac integrity check");
    const mac = await client.send(
      new GenerateMacCommand({
        KeyId: keyId,
        Message: message,
        MacAlgorithm: "HMAC_SHA_256",
      }),
    );

    const tamperedMac = mac.Mac!.slice();
    tamperedMac[0] ^= 0xff;
    const verified = await client.send(
      new VerifyMacCommand({
        KeyId: keyId,
        Message: message,
        Mac: tamperedMac,
        MacAlgorithm: "HMAC_SHA_256",
      }),
    );
    expect(verified.MacValid).toBe(false);
  });
});
