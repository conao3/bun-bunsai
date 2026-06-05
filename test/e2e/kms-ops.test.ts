import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CancelKeyDeletionCommand,
  ConnectCustomKeyStoreCommand,
  CreateAliasCommand,
  CreateCustomKeyStoreCommand,
  CreateGrantCommand,
  CreateKeyCommand,
  DecryptCommand,
  DeleteAliasCommand,
  DeleteCustomKeyStoreCommand,
  DeleteImportedKeyMaterialCommand,
  DeriveSharedSecretCommand,
  DescribeCustomKeyStoresCommand,
  DescribeKeyCommand,
  DisableKeyCommand,
  DisableKeyRotationCommand,
  DisconnectCustomKeyStoreCommand,
  EnableKeyCommand,
  EnableKeyRotationCommand,
  EncryptCommand,
  GenerateDataKeyPairCommand,
  GenerateDataKeyPairWithoutPlaintextCommand,
  GenerateDataKeyWithoutPlaintextCommand,
  GenerateMacCommand,
  GenerateRandomCommand,
  GetKeyLastUsageCommand,
  GetKeyPolicyCommand,
  GetKeyRotationStatusCommand,
  GetParametersForImportCommand,
  GetPublicKeyCommand,
  ImportKeyMaterialCommand,
  KMSClient,
  ListAliasesCommand,
  ListGrantsCommand,
  ListKeyPoliciesCommand,
  ListKeyRotationsCommand,
  ListResourceTagsCommand,
  ListRetirableGrantsCommand,
  PutKeyPolicyCommand,
  ReEncryptCommand,
  RetireGrantCommand,
  RevokeGrantCommand,
  RotateKeyOnDemandCommand,
  ScheduleKeyDeletionCommand,
  SignCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateAliasCommand,
  UpdateCustomKeyStoreCommand,
  UpdateKeyDescriptionCommand,
  VerifyCommand,
  VerifyMacCommand,
} from "@aws-sdk/client-kms";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const textEncoder = new TextEncoder();

describe("kms ops e2e", () => {
  const kms = () =>
    new KMSClient({ endpoint, region, credentials, requestHandler });

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

  test("grant lifecycle: create, list, revoke", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;
    expect(keyId).toBeDefined();

    const grant = await client.send(
      new CreateGrantCommand({
        KeyId: keyId,
        GranteePrincipal: "arn:aws:iam::123456789012:user/test",
        Operations: ["Encrypt", "Decrypt"],
        Name: "test-grant",
      }),
    );
    expect(grant.GrantId).toBeDefined();
    expect(grant.GrantToken).toBeDefined();

    const listed = await client.send(new ListGrantsCommand({ KeyId: keyId }));
    const grantIds = (listed.Grants ?? []).map((g) => g.GrantId);
    expect(grantIds).toContain(grant.GrantId);

    await client.send(
      new RevokeGrantCommand({ KeyId: keyId, GrantId: grant.GrantId }),
    );
    const afterRevoke = await client.send(
      new ListGrantsCommand({ KeyId: keyId }),
    );
    const remaining = (afterRevoke.Grants ?? []).map((g) => g.GrantId);
    expect(remaining).not.toContain(grant.GrantId);
  });

  test("retire grant", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;

    const grant = await client.send(
      new CreateGrantCommand({
        KeyId: keyId,
        GranteePrincipal: "arn:aws:iam::123456789012:user/test",
        RetiringPrincipal: "arn:aws:iam::123456789012:user/retire",
        Operations: ["Encrypt"],
      }),
    );

    const retirable = await client.send(
      new ListRetirableGrantsCommand({
        RetiringPrincipal: "arn:aws:iam::123456789012:user/retire",
      }),
    );
    expect((retirable.Grants ?? []).map((g) => g.GrantId)).toContain(
      grant.GrantId,
    );

    await client.send(new RetireGrantCommand({ GrantId: grant.GrantId }));
    const afterRetire = await client.send(
      new ListGrantsCommand({ KeyId: keyId }),
    );
    expect((afterRetire.Grants ?? []).map((g) => g.GrantId)).not.toContain(
      grant.GrantId,
    );
  });

  test("key policy: get, put, list", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;

    const policy = await client.send(new GetKeyPolicyCommand({ KeyId: keyId }));
    expect(policy.Policy).toBeDefined();
    expect(policy.PolicyName).toBe("default");

    const customPolicy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: "*" },
          Action: "kms:*",
          Resource: "*",
        },
      ],
    });
    await client.send(
      new PutKeyPolicyCommand({ KeyId: keyId, Policy: customPolicy }),
    );
    const after = await client.send(new GetKeyPolicyCommand({ KeyId: keyId }));
    expect(after.Policy).toBe(customPolicy);

    const policies = await client.send(
      new ListKeyPoliciesCommand({ KeyId: keyId }),
    );
    expect(policies.PolicyNames).toContain("default");
  });

  test("key rotation: enable, disable, status, list, on-demand", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;

    const initial = await client.send(
      new GetKeyRotationStatusCommand({ KeyId: keyId }),
    );
    expect(initial.KeyRotationEnabled).toBe(false);

    await client.send(
      new EnableKeyRotationCommand({ KeyId: keyId, RotationPeriodInDays: 90 }),
    );
    const enabled = await client.send(
      new GetKeyRotationStatusCommand({ KeyId: keyId }),
    );
    expect(enabled.KeyRotationEnabled).toBe(true);
    expect(enabled.RotationPeriodInDays).toBe(90);

    await client.send(new RotateKeyOnDemandCommand({ KeyId: keyId }));
    const rotations = await client.send(
      new ListKeyRotationsCommand({ KeyId: keyId }),
    );
    expect((rotations.Rotations ?? []).length).toBeGreaterThanOrEqual(1);

    await client.send(new DisableKeyRotationCommand({ KeyId: keyId }));
    const disabled = await client.send(
      new GetKeyRotationStatusCommand({ KeyId: keyId }),
    );
    expect(disabled.KeyRotationEnabled).toBe(false);
  });

  test("re-encrypt round trip", async () => {
    const client = kms();
    const src = await client.send(new CreateKeyCommand({}));
    const dst = await client.send(new CreateKeyCommand({}));
    const srcKeyId = src.KeyMetadata?.KeyId;
    const dstKeyId = dst.KeyMetadata?.KeyId;

    const encrypted = await client.send(
      new EncryptCommand({
        KeyId: srcKeyId,
        Plaintext: textEncoder.encode("re-encrypt-test"),
      }),
    );

    const reEncrypted = await client.send(
      new ReEncryptCommand({
        CiphertextBlob: encrypted.CiphertextBlob,
        DestinationKeyId: dstKeyId,
      }),
    );
    expect(reEncrypted.CiphertextBlob).toBeDefined();
    expect(reEncrypted.KeyId).toContain(dstKeyId ?? "");
    expect(reEncrypted.SourceKeyId).toContain(srcKeyId ?? "");

    const decrypted = await client.send(
      new DecryptCommand({ CiphertextBlob: reEncrypted.CiphertextBlob }),
    );
    const buf = Buffer.from(decrypted.Plaintext!);
    expect(buf.toString()).toBe("re-encrypt-test");
  });

  test("sign and verify", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({ KeyUsage: "SIGN_VERIFY", KeySpec: "RSA_2048" }),
    );
    const keyId = created.KeyMetadata?.KeyId;

    const signed = await client.send(
      new SignCommand({
        KeyId: keyId,
        Message: textEncoder.encode("hello"),
        SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
      }),
    );
    expect(signed.Signature).toBeDefined();
    expect(signed.SigningAlgorithm).toBe("RSASSA_PKCS1_V1_5_SHA_256");

    const verified = await client.send(
      new VerifyCommand({
        KeyId: keyId,
        Message: textEncoder.encode("hello"),
        Signature: signed.Signature,
        SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
      }),
    );
    expect(verified.SignatureValid).toBe(true);
  });

  test("generate mac and verify mac", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({
        KeyUsage: "GENERATE_VERIFY_MAC",
        KeySpec: "HMAC_256",
      }),
    );
    const keyId = created.KeyMetadata?.KeyId;

    const mac = await client.send(
      new GenerateMacCommand({
        KeyId: keyId,
        Message: textEncoder.encode("mac-message"),
        MacAlgorithm: "HMAC_SHA_256",
      }),
    );
    expect(mac.Mac).toBeDefined();
    expect(mac.MacAlgorithm).toBe("HMAC_SHA_256");

    const verified = await client.send(
      new VerifyMacCommand({
        KeyId: keyId,
        Message: textEncoder.encode("mac-message"),
        Mac: mac.Mac,
        MacAlgorithm: "HMAC_SHA_256",
      }),
    );
    expect(verified.MacValid).toBe(true);
  });

  test("generate random bytes", async () => {
    const client = kms();
    const result = await client.send(
      new GenerateRandomCommand({ NumberOfBytes: 64 }),
    );
    expect(result.Plaintext).toBeDefined();
    expect(result.Plaintext?.length).toBe(64);
  });

  test("generate data key pair", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;

    const pair = await client.send(
      new GenerateDataKeyPairCommand({
        KeyId: keyId,
        KeyPairSpec: "RSA_2048",
      }),
    );
    expect(pair.PrivateKeyCiphertextBlob).toBeDefined();
    expect(pair.PrivateKeyPlaintext).toBeDefined();
    expect(pair.PublicKey).toBeDefined();
    expect(pair.KeyPairSpec).toBe("RSA_2048");

    const withoutPlaintext = await client.send(
      new GenerateDataKeyPairWithoutPlaintextCommand({
        KeyId: keyId,
        KeyPairSpec: "RSA_2048",
      }),
    );
    expect(withoutPlaintext.PrivateKeyCiphertextBlob).toBeDefined();
    expect(withoutPlaintext.PublicKey).toBeDefined();
    expect(
      (withoutPlaintext as { PrivateKeyPlaintext?: unknown })
        .PrivateKeyPlaintext,
    ).toBeUndefined();
  });

  test("get public key", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({ KeyUsage: "SIGN_VERIFY", KeySpec: "RSA_2048" }),
    );
    const keyId = created.KeyMetadata?.KeyId;

    const pubKey = await client.send(new GetPublicKeyCommand({ KeyId: keyId }));
    expect(pubKey.PublicKey).toBeDefined();
    expect(pubKey.KeyId).toContain(keyId ?? "");
    expect(pubKey.KeyUsage).toBe("SIGN_VERIFY");
  });

  test("derive shared secret", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({
        KeyUsage: "KEY_AGREEMENT",
        KeySpec: "ECC_NIST_P256",
      }),
    );
    const keyId = created.KeyMetadata?.KeyId;

    const pubKey = await client.send(new GetPublicKeyCommand({ KeyId: keyId }));
    const sharedSecret = await client.send(
      new DeriveSharedSecretCommand({
        KeyId: keyId,
        KeyAgreementAlgorithm: "ECDH",
        PublicKey: pubKey.PublicKey,
      }),
    );
    expect(sharedSecret.SharedSecret).toBeDefined();
    expect(sharedSecret.KeyAgreementAlgorithm).toBe("ECDH");
  });

  test("get parameters for import and import key material", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({ Origin: "EXTERNAL" }),
    );
    const keyId = created.KeyMetadata?.KeyId;

    const params = await client.send(
      new GetParametersForImportCommand({
        KeyId: keyId,
        WrappingAlgorithm: "RSAES_OAEP_SHA_256",
        WrappingKeySpec: "RSA_2048",
      }),
    );
    expect(params.ImportToken).toBeDefined();
    expect(params.PublicKey).toBeDefined();
    expect(params.ParametersValidTo).toBeDefined();

    const imported = await client.send(
      new ImportKeyMaterialCommand({
        KeyId: keyId,
        ImportToken: params.ImportToken,
        EncryptedKeyMaterial: new Uint8Array(32),
      }),
    );
    expect(imported.KeyId).toBeDefined();

    await client.send(new DeleteImportedKeyMaterialCommand({ KeyId: keyId }));
  });

  test("custom key store lifecycle", async () => {
    const client = kms();
    const storeName = `test-store-${Date.now()}`;

    const created = await client.send(
      new CreateCustomKeyStoreCommand({
        CustomKeyStoreName: storeName,
        CloudHsmClusterId: "cluster-test",
        TrustAnchorCertificate: "CERT",
        KeyStorePassword: "pass",
      }),
    );
    const storeId = created.CustomKeyStoreId;
    expect(storeId).toBeDefined();

    const described = await client.send(
      new DescribeCustomKeyStoresCommand({ CustomKeyStoreId: storeId }),
    );
    expect(described.CustomKeyStores?.length).toBe(1);
    expect(described.CustomKeyStores?.[0]?.ConnectionState).toBe(
      "DISCONNECTED",
    );

    await client.send(
      new ConnectCustomKeyStoreCommand({ CustomKeyStoreId: storeId }),
    );
    const connected = await client.send(
      new DescribeCustomKeyStoresCommand({ CustomKeyStoreId: storeId }),
    );
    expect(connected.CustomKeyStores?.[0]?.ConnectionState).toBe("CONNECTED");

    const newName = `renamed-${Date.now()}`;
    await client.send(
      new UpdateCustomKeyStoreCommand({
        CustomKeyStoreId: storeId,
        NewCustomKeyStoreName: newName,
      }),
    );
    const renamed = await client.send(
      new DescribeCustomKeyStoresCommand({ CustomKeyStoreName: newName }),
    );
    expect(renamed.CustomKeyStores?.length).toBe(1);

    await client.send(
      new DisconnectCustomKeyStoreCommand({ CustomKeyStoreId: storeId }),
    );
    const disconnected = await client.send(
      new DescribeCustomKeyStoresCommand({ CustomKeyStoreId: storeId }),
    );
    expect(disconnected.CustomKeyStores?.[0]?.ConnectionState).toBe(
      "DISCONNECTED",
    );

    await client.send(
      new DeleteCustomKeyStoreCommand({ CustomKeyStoreId: storeId }),
    );
    const afterDelete = await client.send(
      new DescribeCustomKeyStoresCommand({ CustomKeyStoreId: storeId }),
    );
    expect(afterDelete.CustomKeyStores?.length).toBe(0);
  });

  test("update key description", async () => {
    const client = kms();
    const created = await client.send(
      new CreateKeyCommand({ Description: "original" }),
    );
    const keyId = created.KeyMetadata?.KeyId;

    await client.send(
      new UpdateKeyDescriptionCommand({
        KeyId: keyId,
        Description: "updated",
      }),
    );
    const described = await client.send(
      new DescribeKeyCommand({ KeyId: keyId }),
    );
    expect(described.KeyMetadata?.Description).toBe("updated");
  });

  test("get key last usage", async () => {
    const client = kms();
    const created = await client.send(new CreateKeyCommand({}));
    const keyId = created.KeyMetadata?.KeyId;

    const usage = await client.send(
      new GetKeyLastUsageCommand({ KeyId: keyId }),
    );
    expect(usage.KeyId).toBe(keyId);
    expect(usage.KeyLastUsage).toBeDefined();
  });
});
