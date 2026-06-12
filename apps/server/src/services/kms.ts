import nodeCrypto from "node:crypto";
import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import kmsModel from "../../models/kms.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(kmsModel);

const envelopeSeparator = " " as const;

type StoredTag = {
  TagKey: string;
  TagValue: string;
};

type StoredKey = {
  KeyId: string;
  Arn: string;
  AWSAccountId: string;
  CreationDate: number;
  Enabled: boolean;
  Description: string;
  KeyUsage: string;
  KeyState: string;
  Origin: string;
  KeyManager: string;
  KeySpec: string;
  DeletionDate?: number;
  Tags: StoredTag[];
  KeyRotationEnabled?: boolean;
  RotationPeriodInDays?: number;
  Policy?: string;
  Rotations?: StoredRotation[];
};

type StoredAlias = {
  AliasName: string;
  AliasArn: string;
  TargetKeyId: string;
  CreationDate: number;
  LastUpdatedDate: number;
};

type GrantConstraints = {
  EncryptionContextEquals?: Record<string, string>;
  EncryptionContextSubset?: Record<string, string>;
};

type StoredGrant = {
  GrantId: string;
  GrantToken: string;
  KeyId: string;
  Name?: string;
  GranteePrincipal?: string;
  RetiringPrincipal?: string;
  IssuingAccount: string;
  Operations: string[];
  CreationDate: number;
  Constraints?: GrantConstraints;
  Retired?: boolean;
};

type StoredCustomKeyStore = {
  CustomKeyStoreId: string;
  CustomKeyStoreName: string;
  CloudHsmClusterId?: string;
  TrustAnchorCertificate?: string;
  ConnectionState: string;
  CreationDate: number;
  CustomKeyStoreType?: string;
};

type StoredRotation = {
  RotationDate: number;
  RotationType: string;
  KeyMaterialId: string;
};

type StoredCryptoKey =
  | { type: "asymmetric"; privateKeyPem: string; publicKeyPem: string }
  | { type: "hmac"; keyHex: string };

const aliasStorePrefix = "alias:" as const;
const grantStorePrefix = "grant:" as const;
const cksStorePrefix = "cks:" as const;
const cryptoKeyStorePrefix = "cryptokey:" as const;
const defaultPolicy =
  '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"*"},"Action":"kms:*","Resource":"*"}]}' as const;

const arnOf = (region: string, account: string, keyId: string): string =>
  `arn:aws:kms:${region}:${account}:key/${keyId}`;

const aliasArnOf = (
  region: string,
  account: string,
  aliasName: string,
): string => `arn:aws:kms:${region}:${account}:${aliasName}`;

const listStoredKeys = (
  ctx: ServiceContext,
): { key: string; value: StoredKey }[] =>
  ctx.store
    .list<StoredKey>()
    .filter(
      (entry) =>
        !entry.key.startsWith(aliasStorePrefix) &&
        !entry.key.startsWith(grantStorePrefix) &&
        !entry.key.startsWith(cksStorePrefix) &&
        !entry.key.startsWith(cryptoKeyStorePrefix),
    );

const listStoredAliases = (
  ctx: ServiceContext,
): { key: string; value: StoredAlias }[] =>
  ctx.store
    .list<StoredAlias>()
    .filter((entry) => entry.key.startsWith(aliasStorePrefix));

const listStoredGrants = (
  ctx: ServiceContext,
): { key: string; value: StoredGrant }[] =>
  ctx.store
    .list<StoredGrant>()
    .filter((entry) => entry.key.startsWith(grantStorePrefix));

const listStoredCustomKeyStores = (
  ctx: ServiceContext,
): { key: string; value: StoredCustomKeyStore }[] =>
  ctx.store
    .list<StoredCustomKeyStore>()
    .filter((entry) => entry.key.startsWith(cksStorePrefix));

const resolveAliasTarget = (
  ctx: ServiceContext,
  aliasName: string,
): string | undefined => {
  const stored = ctx.store.get<StoredAlias>(`${aliasStorePrefix}${aliasName}`);
  return stored?.TargetKeyId;
};

const requireKey = (ctx: ServiceContext, keyId: string): StoredKey => {
  if (keyId.startsWith("alias/")) {
    const target = resolveAliasTarget(ctx, keyId);
    if (target === undefined) {
      throw awsError(
        "NotFoundException",
        `Alias '${keyId}' does not exist`,
        400,
      );
    }
    return requireKey(ctx, target);
  }
  const direct = ctx.store.get<StoredKey>(keyId);
  if (direct !== undefined) return direct;
  const byArn = listStoredKeys(ctx).find((entry) => entry.value.Arn === keyId);
  if (byArn !== undefined) return byArn.value;
  throw awsError("NotFoundException", `Key '${keyId}' does not exist`, 400);
};

const requireEnabledKey = (ctx: ServiceContext, keyId: string): StoredKey => {
  const key = requireKey(ctx, keyId);
  if (key.KeyState === "Disabled") {
    throw awsError("DisabledException", `${key.Arn} is disabled.`, 400);
  }
  if (key.KeyState === "PendingDeletion") {
    throw awsError(
      "KMSInvalidStateException",
      `${key.Arn} is pending deletion.`,
      400,
    );
  }
  return key;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const keyMetadataOf = (key: StoredKey): Record<string, unknown> => ({
  AWSAccountId: key.AWSAccountId,
  KeyId: key.KeyId,
  Arn: key.Arn,
  CreationDate: key.CreationDate,
  Enabled: key.Enabled,
  Description: key.Description,
  KeyUsage: key.KeyUsage,
  KeyState: key.KeyState,
  Origin: key.Origin,
  KeyManager: key.KeyManager,
  KeySpec: key.KeySpec,
});

const syntheticBytes = (n: number): string => {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
};

const latin1ToBytes = (s: string): Uint8Array =>
  Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

const bytesToLatin1 = (buf: Uint8Array): string => {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return s;
};

const pemToDer = (pem: string): string => {
  const b64 = pem
    .split("\n")
    .filter((l) => !l.startsWith("-----"))
    .join("");
  return bytesToLatin1(new Uint8Array(Buffer.from(b64, "base64")));
};

const keySpecToSigningAlgorithms = (
  keySpec: string,
  keyUsage: string,
): string[] => {
  if (keyUsage !== "SIGN_VERIFY") return [];
  if (keySpec.startsWith("RSA_")) {
    return [
      "RSASSA_PKCS1_V1_5_SHA_256",
      "RSASSA_PKCS1_V1_5_SHA_384",
      "RSASSA_PKCS1_V1_5_SHA_512",
      "RSASSA_PSS_SHA_256",
      "RSASSA_PSS_SHA_384",
      "RSASSA_PSS_SHA_512",
    ];
  }
  if (keySpec === "ECC_NIST_P256" || keySpec === "ECC_SECG_P256K1") {
    return ["ECDSA_SHA_256"];
  }
  if (keySpec === "ECC_NIST_P384") return ["ECDSA_SHA_384"];
  if (keySpec === "ECC_NIST_P521") return ["ECDSA_SHA_512"];
  return [];
};

const keySpecToEncryptionAlgorithms = (
  keySpec: string,
  keyUsage: string,
): string[] => {
  if (keyUsage !== "ENCRYPT_DECRYPT") return [];
  if (keySpec.startsWith("RSA_")) {
    return ["RSAES_OAEP_SHA_1", "RSAES_OAEP_SHA_256"];
  }
  return [];
};

const keySpecToKeyAgreementAlgorithms = (keyUsage: string): string[] => {
  if (keyUsage === "KEY_AGREEMENT") return ["ECDH"];
  return [];
};

const keySpecToCurve = (keySpec: string): string => {
  const map = {
    ECC_NIST_P256: "prime256v1",
    ECC_NIST_P384: "secp384r1",
    ECC_NIST_P521: "secp521r1",
    ECC_SECG_P256K1: "secp256k1",
  } as const;
  return (map as Record<string, string>)[keySpec] ?? "prime256v1";
};

const generateCryptoKey = (keySpec: string): StoredCryptoKey => {
  if (keySpec.startsWith("HMAC_")) {
    const bits = parseInt(keySpec.slice(5), 10);
    const key = new Uint8Array(bits / 8);
    crypto.getRandomValues(key);
    return { type: "hmac", keyHex: Buffer.from(key).toString("hex") };
  }
  if (keySpec.startsWith("RSA_")) {
    const modulusLength = parseInt(keySpec.slice(4), 10);
    const { privateKey, publicKey } = nodeCrypto.generateKeyPairSync("rsa", {
      modulusLength,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    return {
      type: "asymmetric",
      privateKeyPem: privateKey as string,
      publicKeyPem: publicKey as string,
    };
  }
  if (keySpec.startsWith("ECC_")) {
    const namedCurve = keySpecToCurve(keySpec);
    const { privateKey, publicKey } = nodeCrypto.generateKeyPairSync("ec", {
      namedCurve,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    return {
      type: "asymmetric",
      privateKeyPem: privateKey as string,
      publicKeyPem: publicKey as string,
    };
  }
  throw awsError("ValidationException", `Unsupported KeySpec: ${keySpec}`, 400);
};

const getOrCreateCryptoKey = (
  ctx: ServiceContext,
  key: StoredKey,
): StoredCryptoKey => {
  const stored = ctx.store.get<StoredCryptoKey>(
    `${cryptoKeyStorePrefix}${key.KeyId}`,
  );
  if (stored !== undefined) return stored;
  const cryptoKey = generateCryptoKey(key.KeySpec);
  ctx.store.set(`${cryptoKeyStorePrefix}${key.KeyId}`, cryptoKey);
  return cryptoKey;
};

const sigAlgParts = (alg: string): { hash: string; pss: boolean } => {
  const hashMap = {
    SHA_256: "sha256",
    SHA_384: "sha384",
    SHA_512: "sha512",
  } as const;
  for (const [suffix, hash] of Object.entries(hashMap)) {
    if (alg.endsWith(suffix)) {
      return { hash, pss: alg.includes("_PSS_") };
    }
  }
  return { hash: "sha256", pss: false };
};

const macAlgToHash = (macAlgorithm: string): string => {
  const map = {
    HMAC_SHA_256: "sha256",
    HMAC_SHA_384: "sha384",
    HMAC_SHA_512: "sha512",
    HMAC_SHA_224: "sha224",
  } as const;
  return (map as Record<string, string>)[macAlgorithm] ?? "sha256";
};

const CreateKey: OperationHandler = (input, ctx) => {
  const keyId = crypto.randomUUID();
  const description =
    typeof input["Description"] === "string"
      ? (input["Description"] as string)
      : "";
  const keyUsage =
    typeof input["KeyUsage"] === "string"
      ? (input["KeyUsage"] as string)
      : "ENCRYPT_DECRYPT";
  const keySpec =
    typeof input["KeySpec"] === "string"
      ? (input["KeySpec"] as string)
      : "SYMMETRIC_DEFAULT";
  const rawTags = input["Tags"];
  const tags: StoredTag[] = Array.isArray(rawTags)
    ? rawTags
        .filter(
          (t) =>
            t !== null &&
            typeof t === "object" &&
            typeof t["TagKey"] === "string" &&
            typeof t["TagValue"] === "string",
        )
        .map((t) => ({
          TagKey: t["TagKey"] as string,
          TagValue: t["TagValue"] as string,
        }))
    : [];
  const key: StoredKey = {
    KeyId: keyId,
    Arn: arnOf(ctx.region, ctx.account, keyId),
    AWSAccountId: ctx.account,
    CreationDate: Math.floor(Date.now() / 1000),
    Enabled: true,
    Description: description,
    KeyUsage: keyUsage,
    KeyState: "Enabled",
    Origin: "AWS_KMS",
    KeyManager: "CUSTOMER",
    KeySpec: keySpec,
    Tags: tags,
    Policy: defaultPolicy,
    Rotations: [],
  };
  ctx.store.set(keyId, key);
  return { KeyMetadata: keyMetadataOf(key) };
};

const DescribeKey: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  return { KeyMetadata: keyMetadataOf(key) };
};

const applyPagination = <T>(
  items: T[],
  input: Record<string, unknown>,
): { page: T[]; Truncated: boolean; NextMarker?: string } => {
  const limit =
    typeof input["Limit"] === "number" ? (input["Limit"] as number) : undefined;
  const markerRaw =
    typeof input["Marker"] === "string"
      ? (input["Marker"] as string)
      : undefined;
  const offset = markerRaw
    ? parseInt(Buffer.from(markerRaw, "base64").toString("utf8"), 10)
    : 0;
  const start = isNaN(offset) ? 0 : offset;
  const sliced =
    limit !== undefined
      ? items.slice(start, start + limit)
      : items.slice(start);
  const hasMore = start + sliced.length < items.length;
  const nextOffset = start + sliced.length;
  return {
    page: sliced,
    Truncated: hasMore,
    NextMarker: hasMore
      ? Buffer.from(String(nextOffset)).toString("base64")
      : undefined,
  };
};

const ListKeys: OperationHandler = (input, ctx) => {
  const entries = listStoredKeys(ctx);
  const { page, Truncated, NextMarker } = applyPagination(entries, input);
  return {
    Keys: page.map((entry) => ({
      KeyId: entry.value.KeyId,
      KeyArn: entry.value.Arn,
    })),
    Truncated,
    NextMarker,
  };
};

const contextSeparator = "\x00" as const;

const canonicalContext = (ec: Record<string, string>): string =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(ec).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
  );

const Encrypt: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireEnabledKey(ctx, keyId);
  const plaintext = input["Plaintext"];
  if (typeof plaintext !== "string") {
    throw awsError("ValidationException", "Plaintext is required.", 400);
  }
  const rawEc = input["EncryptionContext"];
  const ec =
    rawEc !== null &&
    typeof rawEc === "object" &&
    !Array.isArray(rawEc) &&
    Object.values(rawEc as object).every((v) => typeof v === "string")
      ? (rawEc as Record<string, string>)
      : undefined;
  const ciphertext =
    ec !== undefined
      ? `${key.KeyId}${contextSeparator}${canonicalContext(ec)}${contextSeparator}${plaintext}`
      : `${key.KeyId}${envelopeSeparator}${plaintext}`;
  return {
    CiphertextBlob: ciphertext,
    KeyId: key.Arn,
    EncryptionAlgorithm: "SYMMETRIC_DEFAULT",
  };
};

const UUID_LEN = 36 as const;

const decryptEnvelope = (
  ctx: ServiceContext,
  ciphertext: string,
): {
  key: StoredKey;
  plaintext: string;
  storedContext: Record<string, string> | undefined;
} => {
  const sep = ciphertext[UUID_LEN];
  if (sep === contextSeparator) {
    const keyId = ciphertext.slice(0, UUID_LEN);
    const rest = ciphertext.slice(UUID_LEN + 1);
    const nullIndex2 = rest.indexOf(contextSeparator);
    if (nullIndex2 < 0) {
      throw awsError(
        "InvalidCiphertextException",
        "The ciphertext is malformed.",
        400,
      );
    }
    const contextJson = rest.slice(0, nullIndex2);
    const plaintext = rest.slice(nullIndex2 + 1);
    const key = requireEnabledKey(ctx, keyId);
    const storedContext = JSON.parse(contextJson) as Record<string, string>;
    return { key, plaintext, storedContext };
  }
  if (sep === envelopeSeparator) {
    const keyId = ciphertext.slice(0, UUID_LEN);
    const plaintext = ciphertext.slice(UUID_LEN + 1);
    const key = requireEnabledKey(ctx, keyId);
    return { key, plaintext, storedContext: undefined };
  }
  throw awsError(
    "InvalidCiphertextException",
    "The ciphertext refers to a customer master key that does not exist.",
    400,
  );
};

const Decrypt: OperationHandler = (input, ctx) => {
  const ciphertext = input["CiphertextBlob"];
  if (typeof ciphertext !== "string") {
    throw awsError("ValidationException", "CiphertextBlob is required.", 400);
  }
  const { key, plaintext, storedContext } = decryptEnvelope(ctx, ciphertext);
  if (storedContext !== undefined) {
    const rawEc = input["EncryptionContext"];
    const providedEc =
      rawEc !== null &&
      typeof rawEc === "object" &&
      !Array.isArray(rawEc) &&
      Object.values(rawEc as object).every((v) => typeof v === "string")
        ? (rawEc as Record<string, string>)
        : undefined;
    if (
      providedEc === undefined ||
      canonicalContext(providedEc) !== canonicalContext(storedContext)
    ) {
      throw awsError(
        "InvalidCiphertextException",
        "The ciphertext refers to a customer master key that does not exist, does not exist in this region, does not have a key policy that permits this action, or the ciphertext is corrupted, missing, or otherwise invalid.",
        400,
      );
    }
  }
  return {
    KeyId: key.Arn,
    Plaintext: plaintext,
    EncryptionAlgorithm: "SYMMETRIC_DEFAULT",
  };
};

const GenerateDataKey: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireEnabledKey(ctx, keyId);
  const keySpec =
    typeof input["KeySpec"] === "string"
      ? (input["KeySpec"] as string)
      : undefined;
  const rawNumberOfBytes = input["NumberOfBytes"];
  const numberOfBytes =
    typeof rawNumberOfBytes === "number"
      ? rawNumberOfBytes
      : keySpec === "AES_128"
        ? 16
        : 32;
  const bytes = new Uint8Array(numberOfBytes);
  crypto.getRandomValues(bytes);
  let plaintext = "";
  for (const byte of bytes) plaintext += String.fromCharCode(byte);
  const ciphertext = `${key.KeyId}${envelopeSeparator}${plaintext}`;
  return {
    CiphertextBlob: ciphertext,
    Plaintext: plaintext,
    KeyId: key.Arn,
  };
};

const requireAliasName = (input: Record<string, unknown>): string => {
  const aliasName = requireString(input, "AliasName");
  if (!aliasName.startsWith("alias/")) {
    throw awsError(
      "ValidationException",
      "AliasName must start with 'alias/'.",
      400,
    );
  }
  return aliasName;
};

const CreateAlias: OperationHandler = (input, ctx) => {
  const aliasName = requireAliasName(input);
  const targetKeyId = requireString(input, "TargetKeyId");
  const key = requireKey(ctx, targetKeyId);
  const storeKey = `${aliasStorePrefix}${aliasName}`;
  if (ctx.store.get<StoredAlias>(storeKey) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `An alias with the name ${aliasName} already exists`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const alias: StoredAlias = {
    AliasName: aliasName,
    AliasArn: aliasArnOf(ctx.region, ctx.account, aliasName),
    TargetKeyId: key.KeyId,
    CreationDate: now,
    LastUpdatedDate: now,
  };
  ctx.store.set(storeKey, alias);
  return {};
};

const UpdateAlias: OperationHandler = (input, ctx) => {
  const aliasName = requireAliasName(input);
  const targetKeyId = requireString(input, "TargetKeyId");
  const key = requireKey(ctx, targetKeyId);
  const storeKey = `${aliasStorePrefix}${aliasName}`;
  const existing = ctx.store.get<StoredAlias>(storeKey);
  if (existing === undefined) {
    throw awsError(
      "NotFoundException",
      `Alias '${aliasName}' does not exist`,
      400,
    );
  }
  const alias: StoredAlias = {
    ...existing,
    TargetKeyId: key.KeyId,
    LastUpdatedDate: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(storeKey, alias);
  return {};
};

const DeleteAlias: OperationHandler = (input, ctx) => {
  const aliasName = requireAliasName(input);
  const storeKey = `${aliasStorePrefix}${aliasName}`;
  if (ctx.store.get<StoredAlias>(storeKey) === undefined) {
    throw awsError(
      "NotFoundException",
      `Alias '${aliasName}' does not exist`,
      400,
    );
  }
  ctx.store.delete(storeKey);
  return {};
};

const ListAliases: OperationHandler = (input, ctx) => {
  const keyIdFilter =
    typeof input["KeyId"] === "string"
      ? requireKey(ctx, input["KeyId"] as string).KeyId
      : undefined;
  const aliases = listStoredAliases(ctx)
    .map((entry) => entry.value)
    .filter(
      (alias) => keyIdFilter === undefined || alias.TargetKeyId === keyIdFilter,
    );
  const { page, Truncated, NextMarker } = applyPagination(aliases, input);
  return {
    Aliases: page.map((alias) => ({
      AliasName: alias.AliasName,
      AliasArn: alias.AliasArn,
      TargetKeyId: alias.TargetKeyId,
      CreationDate: alias.CreationDate,
      LastUpdatedDate: alias.LastUpdatedDate,
    })),
    Truncated,
    NextMarker,
  };
};

const persistKeyState = (
  ctx: ServiceContext,
  key: StoredKey,
  next: Partial<StoredKey>,
): StoredKey => {
  const updated: StoredKey = { ...key, ...next };
  ctx.store.set(key.KeyId, updated);
  return updated;
};

const EnableKey: OperationHandler = (input, ctx) => {
  const key = requireKey(ctx, requireString(input, "KeyId"));
  persistKeyState(ctx, key, { Enabled: true, KeyState: "Enabled" });
  return {};
};

const DisableKey: OperationHandler = (input, ctx) => {
  const key = requireKey(ctx, requireString(input, "KeyId"));
  persistKeyState(ctx, key, { Enabled: false, KeyState: "Disabled" });
  return {};
};

const ScheduleKeyDeletion: OperationHandler = (input, ctx) => {
  const key = requireKey(ctx, requireString(input, "KeyId"));
  const rawWindow = input["PendingWindowInDays"];
  const pendingWindowInDays = typeof rawWindow === "number" ? rawWindow : 30;
  const deletionDate =
    Math.floor(Date.now() / 1000) + pendingWindowInDays * 24 * 60 * 60;
  const updated = persistKeyState(ctx, key, {
    Enabled: false,
    KeyState: "PendingDeletion",
    DeletionDate: deletionDate,
  });
  return {
    KeyId: updated.Arn,
    DeletionDate: deletionDate,
    KeyState: updated.KeyState,
    PendingWindowInDays: pendingWindowInDays,
  };
};

const CancelKeyDeletion: OperationHandler = (input, ctx) => {
  const key = requireKey(ctx, requireString(input, "KeyId"));
  const updated = persistKeyState(ctx, key, {
    KeyState: "Disabled",
    DeletionDate: undefined,
  });
  return { KeyId: updated.Arn };
};

const GenerateDataKeyWithoutPlaintext: OperationHandler = (input, ctx) => {
  const key = requireEnabledKey(ctx, requireString(input, "KeyId"));
  const keySpec =
    typeof input["KeySpec"] === "string"
      ? (input["KeySpec"] as string)
      : undefined;
  const rawNumberOfBytes = input["NumberOfBytes"];
  const numberOfBytes =
    typeof rawNumberOfBytes === "number"
      ? rawNumberOfBytes
      : keySpec === "AES_128"
        ? 16
        : 32;
  const bytes = new Uint8Array(numberOfBytes);
  crypto.getRandomValues(bytes);
  let plaintext = "";
  for (const byte of bytes) plaintext += String.fromCharCode(byte);
  const ciphertext = `${key.KeyId}${envelopeSeparator}${plaintext}`;
  return {
    CiphertextBlob: ciphertext,
    KeyId: key.Arn,
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const key = requireKey(ctx, requireString(input, "KeyId"));
  const rawTags = input["Tags"];
  if (!Array.isArray(rawTags)) {
    throw awsError("ValidationException", "Tags is required.", 400);
  }
  const incoming: StoredTag[] = rawTags.map((entry) => {
    const record = entry as Record<string, unknown>;
    return {
      TagKey: requireString(record, "TagKey"),
      TagValue:
        typeof record["TagValue"] === "string"
          ? (record["TagValue"] as string)
          : "",
    };
  });
  const incomingKeys = new Set(incoming.map((tag) => tag.TagKey));
  const merged = key.Tags.filter((tag) => !incomingKeys.has(tag.TagKey)).concat(
    incoming,
  );
  persistKeyState(ctx, key, { Tags: merged });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const key = requireKey(ctx, requireString(input, "KeyId"));
  const rawKeys = input["TagKeys"];
  if (!Array.isArray(rawKeys)) {
    throw awsError("ValidationException", "TagKeys is required.", 400);
  }
  const removal = new Set(rawKeys.filter((entry) => typeof entry === "string"));
  const remaining = key.Tags.filter((tag) => !removal.has(tag.TagKey));
  persistKeyState(ctx, key, { Tags: remaining });
  return {};
};

const ListResourceTags: OperationHandler = (input, ctx) => {
  const key = requireKey(ctx, requireString(input, "KeyId"));
  const { page, Truncated, NextMarker } = applyPagination(key.Tags, input);
  return {
    Tags: page.map((tag) => ({
      TagKey: tag.TagKey,
      TagValue: tag.TagValue,
    })),
    Truncated,
    NextMarker,
  };
};

// Grants

const CreateGrant: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const rawOps = input["Operations"];
  if (!Array.isArray(rawOps)) {
    throw awsError("ValidationException", "Operations is required.", 400);
  }
  const grantId = crypto.randomUUID();
  const grantToken = crypto.randomUUID();
  const rawConstraints = input["Constraints"];
  const constraints: GrantConstraints | undefined =
    rawConstraints !== null &&
    typeof rawConstraints === "object" &&
    !Array.isArray(rawConstraints)
      ? (rawConstraints as GrantConstraints)
      : undefined;
  const grant: StoredGrant = {
    GrantId: grantId,
    GrantToken: grantToken,
    KeyId: key.KeyId,
    Name:
      typeof input["Name"] === "string" ? (input["Name"] as string) : undefined,
    GranteePrincipal:
      typeof input["GranteePrincipal"] === "string"
        ? (input["GranteePrincipal"] as string)
        : undefined,
    RetiringPrincipal:
      typeof input["RetiringPrincipal"] === "string"
        ? (input["RetiringPrincipal"] as string)
        : undefined,
    IssuingAccount: ctx.account,
    Operations: rawOps.filter((op) => typeof op === "string") as string[],
    CreationDate: Math.floor(Date.now() / 1000),
    Constraints: constraints,
  };
  ctx.store.set(`${grantStorePrefix}${grantId}`, grant);
  return { GrantToken: grantToken, GrantId: grantId };
};

const grantEntryOf = (grant: StoredGrant): Record<string, unknown> => ({
  KeyId: grant.KeyId,
  GrantId: grant.GrantId,
  Name: grant.Name,
  CreationDate: grant.CreationDate,
  GranteePrincipal: grant.GranteePrincipal,
  RetiringPrincipal: grant.RetiringPrincipal,
  IssuingAccount: grant.IssuingAccount,
  Operations: grant.Operations,
  Constraints: grant.Constraints,
});

const ListGrants: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const grantIdFilter =
    typeof input["GrantId"] === "string"
      ? (input["GrantId"] as string)
      : undefined;
  const granteePrincipalFilter =
    typeof input["GranteePrincipal"] === "string"
      ? (input["GranteePrincipal"] as string)
      : undefined;
  const grants = listStoredGrants(ctx)
    .map((e) => e.value)
    .filter((g) => g.KeyId === key.KeyId && !g.Retired)
    .filter((g) => grantIdFilter === undefined || g.GrantId === grantIdFilter)
    .filter(
      (g) =>
        granteePrincipalFilter === undefined ||
        g.GranteePrincipal === granteePrincipalFilter,
    );
  const { page, Truncated, NextMarker } = applyPagination(grants, input);
  return { Grants: page.map(grantEntryOf), Truncated, NextMarker };
};

const RevokeGrant: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  requireKey(ctx, keyId);
  const grantId = requireString(input, "GrantId");
  const storeKey = `${grantStorePrefix}${grantId}`;
  const grant = ctx.store.get<StoredGrant>(storeKey);
  if (grant === undefined) {
    throw awsError(
      "NotFoundException",
      `Grant '${grantId}' does not exist`,
      400,
    );
  }
  ctx.store.delete(storeKey);
  return {};
};

const RetireGrant: OperationHandler = (input, ctx) => {
  const grantId =
    typeof input["GrantId"] === "string"
      ? (input["GrantId"] as string)
      : undefined;
  const grantToken =
    typeof input["GrantToken"] === "string"
      ? (input["GrantToken"] as string)
      : undefined;
  if (grantId !== undefined) {
    const storeKey = `${grantStorePrefix}${grantId}`;
    const grant = ctx.store.get<StoredGrant>(storeKey);
    if (grant === undefined) {
      throw awsError(
        "NotFoundException",
        `Grant '${grantId}' does not exist`,
        400,
      );
    }
    ctx.store.set(storeKey, { ...grant, Retired: true });
    return {};
  }
  if (grantToken !== undefined) {
    const all = listStoredGrants(ctx);
    const found = all.find((e) => e.value.GrantToken === grantToken);
    if (found === undefined) {
      throw awsError("NotFoundException", `Grant token not found`, 400);
    }
    ctx.store.set(found.key, { ...found.value, Retired: true });
    return {};
  }
  throw awsError(
    "ValidationException",
    "GrantId or GrantToken is required.",
    400,
  );
};

const ListRetirableGrants: OperationHandler = (input, ctx) => {
  const retiringPrincipal =
    typeof input["RetiringPrincipal"] === "string"
      ? (input["RetiringPrincipal"] as string)
      : undefined;
  const grants = listStoredGrants(ctx)
    .map((e) => e.value)
    .filter((g) => !g.Retired)
    .filter(
      (g) =>
        retiringPrincipal === undefined ||
        g.RetiringPrincipal === retiringPrincipal,
    );
  const { page, Truncated, NextMarker } = applyPagination(grants, input);
  return { Grants: page.map(grantEntryOf), Truncated, NextMarker };
};

// Key policy

const GetKeyPolicy: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  return { Policy: key.Policy ?? defaultPolicy, PolicyName: "default" };
};

const PutKeyPolicy: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const policy = requireString(input, "Policy");
  persistKeyState(ctx, key, { Policy: policy });
  return {};
};

const ListKeyPolicies: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  requireKey(ctx, keyId);
  const policyNames = ["default"];
  const { page, Truncated, NextMarker } = applyPagination(policyNames, input);
  return { PolicyNames: page, Truncated, NextMarker };
};

// Rotation

const EnableKeyRotation: OperationHandler = (input, ctx) => {
  const key = requireKey(ctx, requireString(input, "KeyId"));
  const rotationPeriod =
    typeof input["RotationPeriodInDays"] === "number"
      ? (input["RotationPeriodInDays"] as number)
      : 365;
  persistKeyState(ctx, key, {
    KeyRotationEnabled: true,
    RotationPeriodInDays: rotationPeriod,
  });
  return {};
};

const DisableKeyRotation: OperationHandler = (input, ctx) => {
  const key = requireKey(ctx, requireString(input, "KeyId"));
  persistKeyState(ctx, key, { KeyRotationEnabled: false });
  return {};
};

const GetKeyRotationStatus: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  return {
    KeyRotationEnabled: key.KeyRotationEnabled ?? false,
    KeyId: key.KeyId,
    RotationPeriodInDays: key.RotationPeriodInDays ?? 365,
  };
};

const ListKeyRotations: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const rotations = (key.Rotations ?? []).map((r) => ({
    KeyId: key.KeyId,
    RotationDate: r.RotationDate,
    RotationType: r.RotationType,
    KeyMaterialId: r.KeyMaterialId,
  }));
  const { page, Truncated, NextMarker } = applyPagination(rotations, input);
  return { Rotations: page, Truncated, NextMarker };
};

const RotateKeyOnDemand: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const rotation: StoredRotation = {
    RotationDate: Math.floor(Date.now() / 1000),
    RotationType: "ON_DEMAND",
    KeyMaterialId: crypto.randomUUID(),
  };
  persistKeyState(ctx, key, {
    Rotations: [...(key.Rotations ?? []), rotation],
  });
  return { KeyId: key.KeyId };
};

// Crypto operations

const ReEncrypt: OperationHandler = (input, ctx) => {
  const ciphertext = input["CiphertextBlob"];
  if (typeof ciphertext !== "string") {
    throw awsError("ValidationException", "CiphertextBlob is required.", 400);
  }
  const { key: sourceKey, plaintext } = decryptEnvelope(ctx, ciphertext);
  const destKeyId = requireString(input, "DestinationKeyId");
  const destKey = requireEnabledKey(ctx, destKeyId);
  const newCiphertext = `${destKey.KeyId}${envelopeSeparator}${plaintext}`;
  return {
    CiphertextBlob: newCiphertext,
    SourceKeyId: sourceKey.Arn,
    KeyId: destKey.Arn,
    SourceEncryptionAlgorithm: "SYMMETRIC_DEFAULT",
    DestinationEncryptionAlgorithm: "SYMMETRIC_DEFAULT",
  };
};

const Sign: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const signingAlgorithm = requireString(input, "SigningAlgorithm");
  const rawMessage = requireString(input, "Message");
  const message = latin1ToBytes(rawMessage);
  const messageType =
    typeof input["MessageType"] === "string" ? input["MessageType"] : "RAW";

  const cryptoKey = getOrCreateCryptoKey(ctx, key);
  if (cryptoKey.type !== "asymmetric") {
    throw awsError(
      "InvalidKeyUsageException",
      "Key is not usable for signing",
      400,
    );
  }

  const { hash, pss } = sigAlgParts(signingAlgorithm);
  const algorithm = messageType === "DIGEST" ? null : hash;
  const buf = Buffer.from(message);

  let sigBuffer: Buffer;
  if (pss) {
    sigBuffer = nodeCrypto.sign(algorithm, buf, {
      key: cryptoKey.privateKeyPem,
      padding: nodeCrypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: nodeCrypto.constants.RSA_PSS_SALTLEN_DIGEST,
    }) as Buffer;
  } else {
    sigBuffer = nodeCrypto.sign(
      algorithm,
      buf,
      cryptoKey.privateKeyPem,
    ) as Buffer;
  }

  return {
    KeyId: key.Arn,
    Signature: bytesToLatin1(new Uint8Array(sigBuffer)),
    SigningAlgorithm: signingAlgorithm,
  };
};

const Verify: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const signingAlgorithm = requireString(input, "SigningAlgorithm");
  const rawMessage = requireString(input, "Message");
  const message = latin1ToBytes(rawMessage);
  const rawSignature = requireString(input, "Signature");
  const signature = latin1ToBytes(rawSignature);
  const messageType =
    typeof input["MessageType"] === "string" ? input["MessageType"] : "RAW";

  const cryptoKey = getOrCreateCryptoKey(ctx, key);
  if (cryptoKey.type !== "asymmetric") {
    throw awsError(
      "InvalidKeyUsageException",
      "Key is not usable for signing",
      400,
    );
  }

  const { hash, pss } = sigAlgParts(signingAlgorithm);
  const algorithm = messageType === "DIGEST" ? null : hash;
  const msgBuf = Buffer.from(message);
  const sigBuf = Buffer.from(signature);

  let valid: boolean;
  if (pss) {
    valid = nodeCrypto.verify(
      algorithm,
      msgBuf,
      {
        key: cryptoKey.publicKeyPem,
        padding: nodeCrypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: nodeCrypto.constants.RSA_PSS_SALTLEN_DIGEST,
      },
      sigBuf,
    );
  } else {
    valid = nodeCrypto.verify(
      algorithm,
      msgBuf,
      cryptoKey.publicKeyPem,
      sigBuf,
    );
  }

  return {
    KeyId: key.Arn,
    SignatureValid: valid,
    SigningAlgorithm: signingAlgorithm,
  };
};

const GenerateMac: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const macAlgorithm = requireString(input, "MacAlgorithm");
  const rawMessage = requireString(input, "Message");
  const message = latin1ToBytes(rawMessage);

  const cryptoKey = getOrCreateCryptoKey(ctx, key);
  if (cryptoKey.type !== "hmac") {
    throw awsError(
      "InvalidKeyUsageException",
      "Key is not usable for MAC generation",
      400,
    );
  }

  const hash = macAlgToHash(macAlgorithm);
  const keyBuf = Buffer.from(cryptoKey.keyHex, "hex");
  const mac = nodeCrypto.createHmac(hash, keyBuf).update(message).digest();

  return {
    Mac: bytesToLatin1(new Uint8Array(mac)),
    MacAlgorithm: macAlgorithm,
    KeyId: key.Arn,
  };
};

const VerifyMac: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const macAlgorithm = requireString(input, "MacAlgorithm");
  const rawMessage = requireString(input, "Message");
  const message = latin1ToBytes(rawMessage);
  const rawMac = requireString(input, "Mac");
  const mac = latin1ToBytes(rawMac);

  const cryptoKey = getOrCreateCryptoKey(ctx, key);
  if (cryptoKey.type !== "hmac") {
    throw awsError(
      "InvalidKeyUsageException",
      "Key is not usable for MAC verification",
      400,
    );
  }

  const hash = macAlgToHash(macAlgorithm);
  const keyBuf = Buffer.from(cryptoKey.keyHex, "hex");
  const expected = nodeCrypto.createHmac(hash, keyBuf).update(message).digest();
  const macBuf = Buffer.from(mac);

  const macValid =
    expected.length === macBuf.length &&
    nodeCrypto.timingSafeEqual(expected, macBuf);

  return {
    KeyId: key.Arn,
    MacValid: macValid,
    MacAlgorithm: macAlgorithm,
  };
};

const GenerateRandom: OperationHandler = (input, _ctx) => {
  const rawBytes = input["NumberOfBytes"];
  const numberOfBytes = typeof rawBytes === "number" ? rawBytes : 32;
  const plaintext = syntheticBytes(numberOfBytes);
  return { Plaintext: plaintext };
};

const GenerateDataKeyPair: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const keyPairSpec = requireString(input, "KeyPairSpec");
  const cryptoKey = generateCryptoKey(keyPairSpec);
  if (cryptoKey.type !== "asymmetric") {
    throw awsError(
      "ValidationException",
      `KeyPairSpec ${keyPairSpec} is not asymmetric`,
      400,
    );
  }
  const privateKeyDer = pemToDer(cryptoKey.privateKeyPem);
  const publicKeyDer = pemToDer(cryptoKey.publicKeyPem);
  const privateKeyCiphertext = `${key.KeyId}${envelopeSeparator}${privateKeyDer}`;
  return {
    PrivateKeyCiphertextBlob: privateKeyCiphertext,
    PrivateKeyPlaintext: privateKeyDer,
    PublicKey: publicKeyDer,
    KeyId: key.Arn,
    KeyPairSpec: keyPairSpec,
  };
};

const GenerateDataKeyPairWithoutPlaintext: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const keyPairSpec = requireString(input, "KeyPairSpec");
  const cryptoKey = generateCryptoKey(keyPairSpec);
  if (cryptoKey.type !== "asymmetric") {
    throw awsError(
      "ValidationException",
      `KeyPairSpec ${keyPairSpec} is not asymmetric`,
      400,
    );
  }
  const privateKeyDer = pemToDer(cryptoKey.privateKeyPem);
  const publicKeyDer = pemToDer(cryptoKey.publicKeyPem);
  const privateKeyCiphertext = `${key.KeyId}${envelopeSeparator}${privateKeyDer}`;
  return {
    PrivateKeyCiphertextBlob: privateKeyCiphertext,
    PublicKey: publicKeyDer,
    KeyId: key.Arn,
    KeyPairSpec: keyPairSpec,
  };
};

const GetPublicKey: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const cryptoKey = getOrCreateCryptoKey(ctx, key);
  if (cryptoKey.type !== "asymmetric") {
    throw awsError(
      "InvalidKeyUsageException",
      "Key is not an asymmetric key",
      400,
    );
  }
  return {
    KeyId: key.Arn,
    PublicKey: pemToDer(cryptoKey.publicKeyPem),
    KeySpec: key.KeySpec,
    KeyUsage: key.KeyUsage,
    EncryptionAlgorithms: keySpecToEncryptionAlgorithms(
      key.KeySpec,
      key.KeyUsage,
    ),
    SigningAlgorithms: keySpecToSigningAlgorithms(key.KeySpec, key.KeyUsage),
    KeyAgreementAlgorithms: keySpecToKeyAgreementAlgorithms(key.KeyUsage),
  };
};

const DeriveSharedSecret: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const keyAgreementAlgorithm = requireString(input, "KeyAgreementAlgorithm");
  return {
    KeyId: key.Arn,
    SharedSecret: syntheticBytes(32),
    KeyAgreementAlgorithm: keyAgreementAlgorithm,
    KeyOrigin: key.Origin,
  };
};

// Import

const GetParametersForImport: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const now = Math.floor(Date.now() / 1000);
  return {
    KeyId: key.KeyId,
    ImportToken: syntheticBytes(256),
    PublicKey: syntheticBytes(162),
    ParametersValidTo: now + 86400,
  };
};

const ImportKeyMaterial: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  return { KeyId: key.KeyId };
};

const DeleteImportedKeyMaterial: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  requireKey(ctx, keyId);
  return {};
};

// Custom key stores

const CreateCustomKeyStore: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CustomKeyStoreName");
  const existing = listStoredCustomKeyStores(ctx).find(
    (e) => e.value.CustomKeyStoreName === name,
  );
  if (existing !== undefined) {
    throw awsError(
      "CustomKeyStoreNameInUseException",
      `Custom key store name '${name}' is already in use`,
      400,
    );
  }
  const cksId = `cks-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const cks: StoredCustomKeyStore = {
    CustomKeyStoreId: cksId,
    CustomKeyStoreName: name,
    CloudHsmClusterId:
      typeof input["CloudHsmClusterId"] === "string"
        ? (input["CloudHsmClusterId"] as string)
        : undefined,
    TrustAnchorCertificate:
      typeof input["TrustAnchorCertificate"] === "string"
        ? (input["TrustAnchorCertificate"] as string)
        : undefined,
    ConnectionState: "DISCONNECTED",
    CreationDate: Math.floor(Date.now() / 1000),
    CustomKeyStoreType:
      typeof input["CustomKeyStoreType"] === "string"
        ? (input["CustomKeyStoreType"] as string)
        : "AWS_CLOUDHSM",
  };
  ctx.store.set(`${cksStorePrefix}${cksId}`, cks);
  return { CustomKeyStoreId: cksId };
};

const cksEntryOf = (cks: StoredCustomKeyStore): Record<string, unknown> => ({
  CustomKeyStoreId: cks.CustomKeyStoreId,
  CustomKeyStoreName: cks.CustomKeyStoreName,
  CloudHsmClusterId: cks.CloudHsmClusterId,
  TrustAnchorCertificate: cks.TrustAnchorCertificate,
  ConnectionState: cks.ConnectionState,
  CreationDate: cks.CreationDate,
  CustomKeyStoreType: cks.CustomKeyStoreType,
});

const DescribeCustomKeyStores: OperationHandler = (input, ctx) => {
  const idFilter =
    typeof input["CustomKeyStoreId"] === "string"
      ? (input["CustomKeyStoreId"] as string)
      : undefined;
  const nameFilter =
    typeof input["CustomKeyStoreName"] === "string"
      ? (input["CustomKeyStoreName"] as string)
      : undefined;
  let all = listStoredCustomKeyStores(ctx).map((e) => e.value);
  if (idFilter !== undefined)
    all = all.filter((c) => c.CustomKeyStoreId === idFilter);
  if (nameFilter !== undefined)
    all = all.filter((c) => c.CustomKeyStoreName === nameFilter);
  return { CustomKeyStores: all.map(cksEntryOf), Truncated: false };
};

const requireCks = (
  ctx: ServiceContext,
  cksId: string,
): StoredCustomKeyStore => {
  const cks = ctx.store.get<StoredCustomKeyStore>(`${cksStorePrefix}${cksId}`);
  if (cks === undefined) {
    throw awsError(
      "CustomKeyStoreNotFoundException",
      `Custom key store '${cksId}' does not exist`,
      400,
    );
  }
  return cks;
};

const ConnectCustomKeyStore: OperationHandler = (input, ctx) => {
  const cksId = requireString(input, "CustomKeyStoreId");
  const cks = requireCks(ctx, cksId);
  ctx.store.set(`${cksStorePrefix}${cksId}`, {
    ...cks,
    ConnectionState: "CONNECTED",
  });
  return {};
};

const DisconnectCustomKeyStore: OperationHandler = (input, ctx) => {
  const cksId = requireString(input, "CustomKeyStoreId");
  const cks = requireCks(ctx, cksId);
  ctx.store.set(`${cksStorePrefix}${cksId}`, {
    ...cks,
    ConnectionState: "DISCONNECTED",
  });
  return {};
};

const UpdateCustomKeyStore: OperationHandler = (input, ctx) => {
  const cksId = requireString(input, "CustomKeyStoreId");
  const cks = requireCks(ctx, cksId);
  const updated: StoredCustomKeyStore = {
    ...cks,
    CustomKeyStoreName:
      typeof input["NewCustomKeyStoreName"] === "string"
        ? (input["NewCustomKeyStoreName"] as string)
        : cks.CustomKeyStoreName,
  };
  ctx.store.set(`${cksStorePrefix}${cksId}`, updated);
  return {};
};

const DeleteCustomKeyStore: OperationHandler = (input, ctx) => {
  const cksId = requireString(input, "CustomKeyStoreId");
  requireCks(ctx, cksId);
  ctx.store.delete(`${cksStorePrefix}${cksId}`);
  return {};
};

// Misc

const UpdateKeyDescription: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const description = requireString(input, "Description");
  persistKeyState(ctx, key, { Description: description });
  return {};
};

const ReplicateKey: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  const replicaRegion = requireString(input, "ReplicaRegion");
  const replicaArn = `arn:aws:kms:${replicaRegion}:${ctx.account}:key/${key.KeyId}`;
  const replicaMetadata = { ...keyMetadataOf(key), Arn: replicaArn };
  return {
    ReplicaKeyMetadata: replicaMetadata,
    ReplicaPolicy: key.Policy ?? defaultPolicy,
    ReplicaTags: key.Tags,
  };
};

const UpdatePrimaryRegion: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  requireKey(ctx, keyId);
  requireString(input, "PrimaryRegion");
  return {};
};

const GetKeyLastUsage: OperationHandler = (input, ctx) => {
  const keyId = requireString(input, "KeyId");
  const key = requireKey(ctx, keyId);
  return {
    KeyId: key.KeyId,
    KeyLastUsage: {
      Operation: "Decrypt",
      Timestamp: key.CreationDate,
    },
    KeyCreationDate: key.CreationDate,
  };
};

const kms: ServiceDefinition = {
  name: "kms",
  protocol: "json",
  operations: {
    CreateKey,
    DescribeKey,
    ListKeys,
    Encrypt,
    Decrypt,
    GenerateDataKey,
    CreateAlias,
    UpdateAlias,
    DeleteAlias,
    ListAliases,
    EnableKey,
    DisableKey,
    ScheduleKeyDeletion,
    CancelKeyDeletion,
    GenerateDataKeyWithoutPlaintext,
    TagResource,
    UntagResource,
    ListResourceTags,
    CreateGrant,
    ListGrants,
    RevokeGrant,
    RetireGrant,
    ListRetirableGrants,
    GetKeyPolicy,
    PutKeyPolicy,
    ListKeyPolicies,
    EnableKeyRotation,
    DisableKeyRotation,
    GetKeyRotationStatus,
    ListKeyRotations,
    RotateKeyOnDemand,
    ReEncrypt,
    Sign,
    Verify,
    GenerateMac,
    VerifyMac,
    GenerateRandom,
    GenerateDataKeyPair,
    GenerateDataKeyPairWithoutPlaintext,
    GetPublicKey,
    DeriveSharedSecret,
    GetParametersForImport,
    ImportKeyMaterial,
    DeleteImportedKeyMaterial,
    CreateCustomKeyStore,
    DescribeCustomKeyStores,
    ConnectCustomKeyStore,
    DisconnectCustomKeyStore,
    UpdateCustomKeyStore,
    DeleteCustomKeyStore,
    UpdateKeyDescription,
    ReplicateKey,
    UpdatePrimaryRegion,
    GetKeyLastUsage,
  },
  model,
} as const;

export default kms;
