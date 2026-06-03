import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import secretsManagerModel from "../../../../test/vendor/aws-models/secretsmanager.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(secretsManagerModel);

type StoredVersion = {
  VersionId: string;
  SecretString: string | undefined;
  SecretBinary: string | undefined;
  VersionStages: string[];
  CreatedDate: number;
};

type StoredSecret = {
  ARN: string;
  Name: string;
  Description: string | undefined;
  KmsKeyId: string | undefined;
  Tags: unknown[];
  CreatedDate: number;
  LastChangedDate: number;
  DeletedDate: number | undefined;
  currentVersionId: string;
  versions: Record<string, StoredVersion>;
} & { Type?: string };

const arnOf = (ctx: ServiceContext, name: string, suffix: string): string =>
  `arn:aws:secretsmanager:${ctx.region}:${ctx.account}:secret:${name}-${suffix}`;

const randomSuffix = (): string =>
  crypto.randomUUID().replace(/-/g, "").slice(0, 6);

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const findByIdentifier = (
  ctx: ServiceContext,
  secretId: string,
): StoredSecret | undefined => {
  const direct = ctx.store.get<StoredSecret>(secretId);
  if (direct !== undefined) return direct;
  for (const entry of ctx.store.list<StoredSecret>())
    if (entry.value.ARN === secretId) return entry.value;
  return undefined;
};

const requireSecret = (ctx: ServiceContext, secretId: string): StoredSecret => {
  const secret = findByIdentifier(ctx, secretId);
  if (secret === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Secrets Manager can't find the specified secret.",
      400,
    );
  }
  return secret;
};

const secretIdFromInput = (input: Record<string, unknown>): string => {
  const secretId = input["SecretId"];
  if (typeof secretId === "string" && secretId !== "") return secretId;
  throw awsError("InvalidParameterException", "SecretId is required.", 400);
};

const CreateSecret: OperationHandler = (input, ctx) => {
  const name = input["Name"];
  if (typeof name !== "string" || name === "") {
    throw awsError("InvalidParameterException", "Name is required.", 400);
  }
  const existing = ctx.store.get<StoredSecret>(name);
  if (existing !== undefined) {
    throw awsError(
      "ResourceExistsException",
      "The operation failed because the secret already exists.",
      400,
    );
  }
  const versionId =
    stringOrUndefined(input["ClientRequestToken"]) ?? crypto.randomUUID();
  const now = nowSeconds();
  const version: StoredVersion = {
    VersionId: versionId,
    SecretString: stringOrUndefined(input["SecretString"]),
    SecretBinary: stringOrUndefined(input["SecretBinary"]),
    VersionStages: ["AWSCURRENT"],
    CreatedDate: now,
  };
  const secret: StoredSecret = {
    ARN: arnOf(ctx, name, randomSuffix()),
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    KmsKeyId: stringOrUndefined(input["KmsKeyId"]),
    Tags: Array.isArray(input["Tags"]) ? (input["Tags"] as unknown[]) : [],
    CreatedDate: now,
    LastChangedDate: now,
    DeletedDate: undefined,
    currentVersionId: versionId,
    versions: { [versionId]: version },
  };
  ctx.store.set(name, secret);
  return { ARN: secret.ARN, Name: name, VersionId: versionId };
};

const GetSecretValue: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const requestedVersion = stringOrUndefined(input["VersionId"]);
  const versionId = requestedVersion ?? secret.currentVersionId;
  const version = secret.versions[versionId];
  if (version === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Secrets Manager can't find the specified secret version.",
      400,
    );
  }
  return {
    ARN: secret.ARN,
    Name: secret.Name,
    VersionId: version.VersionId,
    SecretString: version.SecretString,
    SecretBinary: version.SecretBinary,
    VersionStages: version.VersionStages,
    CreatedDate: version.CreatedDate,
  };
};

const PutSecretValue: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const versionId =
    stringOrUndefined(input["ClientRequestToken"]) ?? crypto.randomUUID();
  const stages = Array.isArray(input["VersionStages"])
    ? (input["VersionStages"] as unknown[]).map((value) => String(value))
    : ["AWSCURRENT"];
  const version: StoredVersion = {
    VersionId: versionId,
    SecretString: stringOrUndefined(input["SecretString"]),
    SecretBinary: stringOrUndefined(input["SecretBinary"]),
    VersionStages: stages,
    CreatedDate: nowSeconds(),
  };
  if (stages.includes("AWSCURRENT")) {
    const previous = secret.versions[secret.currentVersionId];
    if (previous !== undefined)
      previous.VersionStages = previous.VersionStages.filter(
        (stage) => stage !== "AWSCURRENT",
      );
    secret.currentVersionId = versionId;
  }
  secret.versions[versionId] = version;
  secret.LastChangedDate = nowSeconds();
  ctx.store.set(secret.Name, secret);
  return {
    ARN: secret.ARN,
    Name: secret.Name,
    VersionId: versionId,
    VersionStages: stages,
  };
};

const ListSecrets: OperationHandler = (input, ctx) => {
  const includeDeleted = input["IncludePlannedDeletion"] === true;
  const secretList = ctx.store
    .list<StoredSecret>()
    .filter((entry) => includeDeleted || entry.value.DeletedDate === undefined)
    .map((entry) => ({
      ARN: entry.value.ARN,
      Name: entry.value.Name,
      Description: entry.value.Description,
      KmsKeyId: entry.value.KmsKeyId,
      Tags: entry.value.Tags,
      CreatedDate: entry.value.CreatedDate,
      LastChangedDate: entry.value.LastChangedDate,
      DeletedDate: entry.value.DeletedDate,
    }));
  return { SecretList: secretList };
};

const DescribeSecret: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const versionIdsToStages: Record<string, string[]> = {};
  for (const version of Object.values(secret.versions))
    versionIdsToStages[version.VersionId] = version.VersionStages;
  return {
    ARN: secret.ARN,
    Name: secret.Name,
    Description: secret.Description,
    KmsKeyId: secret.KmsKeyId,
    RotationEnabled: false,
    Tags: secret.Tags,
    VersionIdsToStages: versionIdsToStages,
    CreatedDate: secret.CreatedDate,
    LastChangedDate: secret.LastChangedDate,
    DeletedDate: secret.DeletedDate,
  };
};

const DeleteSecret: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const force = input["ForceDeleteWithoutRecovery"] === true;
  const deletionDate = nowSeconds();
  if (force) {
    ctx.store.delete(secret.Name);
  } else {
    secret.DeletedDate = deletionDate;
    ctx.store.set(secret.Name, secret);
  }
  return { ARN: secret.ARN, Name: secret.Name, DeletionDate: deletionDate };
};

const UpdateSecret: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const description = stringOrUndefined(input["Description"]);
  if (description !== undefined) secret.Description = description;
  const kmsKeyId = stringOrUndefined(input["KmsKeyId"]);
  if (kmsKeyId !== undefined) secret.KmsKeyId = kmsKeyId;
  const secretString = stringOrUndefined(input["SecretString"]);
  const secretBinary = stringOrUndefined(input["SecretBinary"]);
  let versionId: string | undefined;
  if (secretString !== undefined || secretBinary !== undefined) {
    versionId =
      stringOrUndefined(input["ClientRequestToken"]) ?? crypto.randomUUID();
    const previous = secret.versions[secret.currentVersionId];
    if (previous !== undefined)
      previous.VersionStages = previous.VersionStages.filter(
        (stage) => stage !== "AWSCURRENT",
      );
    secret.versions[versionId] = {
      VersionId: versionId,
      SecretString: secretString,
      SecretBinary: secretBinary,
      VersionStages: ["AWSCURRENT"],
      CreatedDate: nowSeconds(),
    };
    secret.currentVersionId = versionId;
  }
  secret.LastChangedDate = nowSeconds();
  ctx.store.set(secret.Name, secret);
  return { ARN: secret.ARN, Name: secret.Name, VersionId: versionId };
};

const GetRandomPassword: OperationHandler = (input) => {
  const length =
    typeof input["PasswordLength"] === "number"
      ? Math.max(1, Math.floor(input["PasswordLength"] as number))
      : 32;
  const excludeNumbers = input["ExcludeNumbers"] === true;
  const excludePunctuation = input["ExcludePunctuation"] === true;
  const excludeUppercase = input["ExcludeUppercase"] === true;
  const excludeLowercase = input["ExcludeLowercase"] === true;
  const includeSpace = input["IncludeSpace"] === true;
  const excludeCharacters =
    typeof input["ExcludeCharacters"] === "string"
      ? (input["ExcludeCharacters"] as string)
      : "";
  let pool = "";
  if (!excludeLowercase) pool += "abcdefghijklmnopqrstuvwxyz";
  if (!excludeUppercase) pool += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (!excludeNumbers) pool += "0123456789";
  if (!excludePunctuation) pool += "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
  if (includeSpace) pool += " ";
  const allowed = [...pool].filter(
    (character) => !excludeCharacters.includes(character),
  );
  if (allowed.length === 0) {
    throw awsError(
      "InvalidParameterException",
      "No characters available for password generation.",
      400,
    );
  }
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  let password = "";
  for (let index = 0; index < length; index += 1)
    password += allowed[bytes[index] % allowed.length];
  return { RandomPassword: password };
};

const TagResource: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const incoming = Array.isArray(input["Tags"])
    ? (input["Tags"] as Record<string, unknown>[])
    : [];
  const existing = secret.Tags as Record<string, unknown>[];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const tag of existing)
    if (typeof tag["Key"] === "string") byKey.set(tag["Key"], tag);
  for (const tag of incoming)
    if (typeof tag["Key"] === "string") byKey.set(tag["Key"], tag);
  secret.Tags = [...byKey.values()];
  ctx.store.set(secret.Name, secret);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const keys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as unknown[]).map((value) => String(value))
    : [];
  const existing = secret.Tags as Record<string, unknown>[];
  secret.Tags = existing.filter(
    (tag) => typeof tag["Key"] !== "string" || !keys.includes(tag["Key"]),
  );
  ctx.store.set(secret.Name, secret);
  return {};
};

const ListSecretVersionIds: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const versions = Object.values(secret.versions).map((version) => ({
    VersionId: version.VersionId,
    VersionStages: version.VersionStages,
    CreatedDate: version.CreatedDate,
  }));
  return { Versions: versions, ARN: secret.ARN, Name: secret.Name };
};

const RestoreSecret: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  secret.DeletedDate = undefined;
  secret.LastChangedDate = nowSeconds();
  ctx.store.set(secret.Name, secret);
  return { ARN: secret.ARN, Name: secret.Name };
};

const secretsManager: ServiceDefinition = {
  name: "secretsmanager",
  protocol: "json",
  operations: {
    CreateSecret,
    GetSecretValue,
    PutSecretValue,
    ListSecrets,
    DescribeSecret,
    DeleteSecret,
    UpdateSecret,
    GetRandomPassword,
    TagResource,
    UntagResource,
    ListSecretVersionIds,
    RestoreSecret,
  },
  model,
} as const;

export default secretsManager;
