import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateKeyCommand,
  DecryptCommand,
  DescribeKeyCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
  ListKeysCommand,
} from "@aws-sdk/client-kms";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

describe("kms e2e", () => {
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
