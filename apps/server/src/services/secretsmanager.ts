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

const TagResource: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const newTags = Array.isArray(input["Tags"])
    ? (input["Tags"] as unknown[])
    : [];
  const existingKeys = new Set(
    (secret.Tags as { Key?: string }[]).map((t) => t.Key),
  );
  for (const tag of newTags as { Key?: string }[]) {
    if (!existingKeys.has(tag.Key)) secret.Tags.push(tag);
    else {
      const idx = (secret.Tags as { Key?: string }[]).findIndex(
        (t) => t.Key === tag.Key,
      );
      if (idx !== -1) secret.Tags[idx] = tag;
    }
  }
  ctx.store.set(secret.Name, secret);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const keys = Array.isArray(input["TagKeys"])
    ? new Set((input["TagKeys"] as unknown[]).map(String))
    : new Set<string>();
  secret.Tags = (secret.Tags as { Key?: string }[]).filter(
    (t) => !keys.has(String(t.Key)),
  );
  ctx.store.set(secret.Name, secret);
  return {};
};

const RestoreSecret: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  if (secret.DeletedDate === undefined) {
    throw awsError(
      "InvalidRequestException",
      "Secrets Manager can't restore a secret that is not scheduled for deletion.",
      400,
    );
  }
  secret.DeletedDate = undefined;
  ctx.store.set(secret.Name, secret);
  return { ARN: secret.ARN, Name: secret.Name };
};

const DEFAULT_PASSWORD_LENGTH = 32;
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const PUNCT = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
const SPACE = " ";

const GetRandomPassword: OperationHandler = (input, _ctx) => {
  const length =
    typeof input["PasswordLength"] === "number"
      ? input["PasswordLength"]
      : DEFAULT_PASSWORD_LENGTH;
  const excludeChars = stringOrUndefined(input["ExcludeCharacters"]) ?? "";
  let charset = "";
  if (input["ExcludeUppercase"] !== true) charset += UPPER;
  if (input["ExcludeLowercase"] !== true) charset += LOWER;
  if (input["ExcludeNumbers"] !== true) charset += DIGITS;
  if (input["ExcludePunctuation"] !== true) charset += PUNCT;
  if (input["IncludeSpace"] === true) charset += SPACE;
  charset = charset
    .split("")
    .filter((c) => !excludeChars.includes(c))
    .join("");
  if (charset.length === 0) {
    throw awsError(
      "InvalidParameterException",
      "You have excluded all characters from the password.",
      400,
    );
  }
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  const password = Array.from(bytes)
    .map((b) => charset[b % charset.length])
    .join("");
  return { RandomPassword: password };
};

const ListSecretVersionIds: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const includeDeprecated = input["IncludeDeprecated"] === true;
  const versions = Object.values(secret.versions)
    .filter((v) => includeDeprecated || v.VersionStages.length > 0)
    .map((v) => ({
      VersionId: v.VersionId,
      VersionStages: v.VersionStages,
      CreatedDate: v.CreatedDate,
    }));
  return { Versions: versions, ARN: secret.ARN, Name: secret.Name };
};

const UpdateSecretVersionStage: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const stage = String(input["VersionStage"]);
  const removeFrom = stringOrUndefined(input["RemoveFromVersionId"]);
  const moveTo = stringOrUndefined(input["MoveToVersionId"]);

  if (removeFrom !== undefined) {
    const fromVersion = secret.versions[removeFrom];
    if (fromVersion !== undefined) {
      fromVersion.VersionStages = fromVersion.VersionStages.filter(
        (s) => s !== stage,
      );
    }
  }

  if (moveTo !== undefined) {
    const toVersion = secret.versions[moveTo];
    if (toVersion === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        "Secrets Manager can't find the specified secret version.",
        400,
      );
    }
    if (!toVersion.VersionStages.includes(stage)) {
      toVersion.VersionStages = [...toVersion.VersionStages, stage];
    }
    if (stage === "AWSCURRENT") {
      const prev = secret.versions[secret.currentVersionId];
      if (prev !== undefined && prev.VersionId !== moveTo) {
        prev.VersionStages = prev.VersionStages.filter(
          (s) => s !== "AWSCURRENT",
        );
        if (!prev.VersionStages.includes("AWSPREVIOUS")) {
          prev.VersionStages = [...prev.VersionStages, "AWSPREVIOUS"];
        }
      }
      secret.currentVersionId = moveTo;
    }
  }

  ctx.store.set(secret.Name, secret);
  return { ARN: secret.ARN, Name: secret.Name };
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
    TagResource,
    UntagResource,
    RestoreSecret,
    GetRandomPassword,
    ListSecretVersionIds,
    UpdateSecretVersionStage,
  },
  model,
} as const;

export default secretsManager;
