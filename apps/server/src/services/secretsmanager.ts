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

type ReplicationStatusEntry = {
  Region: string;
  KmsKeyId: string | undefined;
  Status: string;
  StatusMessage: string | undefined;
  LastAccessedDate: number | undefined;
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
  RotationEnabled: boolean;
  RotationLambdaARN: string | undefined;
  ResourcePolicy: string | undefined;
  ReplicationStatus: ReplicationStatusEntry[];
} & { Type?: string };

const arnOf = (ctx: ServiceContext, name: string, suffix: string): string =>
  `arn:aws:secretsmanager:${ctx.region}:${ctx.account}:secret:${name}-${suffix}`;

const promoteToCurrent = (
  secret: StoredSecret,
  oldVersionId: string,
  newVersionId: string,
): void => {
  for (const v of Object.values(secret.versions))
    v.VersionStages = v.VersionStages.filter((s) => s !== "AWSPREVIOUS");
  const oldVersion = secret.versions[oldVersionId];
  if (oldVersion !== undefined && oldVersionId !== newVersionId) {
    oldVersion.VersionStages = oldVersion.VersionStages.filter(
      (s) => s !== "AWSCURRENT",
    );
    oldVersion.VersionStages.push("AWSPREVIOUS");
  }
  secret.currentVersionId = newVersionId;
};

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
    RotationEnabled: false,
    RotationLambdaARN: undefined,
    ResourcePolicy: undefined,
    ReplicationStatus: [],
  };
  ctx.store.set(name, secret);
  return { ARN: secret.ARN, Name: name, VersionId: versionId };
};

const GetSecretValue: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const requestedStage = stringOrUndefined(input["VersionStage"]);
  const requestedVersion = stringOrUndefined(input["VersionId"]);
  let version: StoredVersion | undefined;
  if (requestedStage !== undefined) {
    version = Object.values(secret.versions).find((v) =>
      v.VersionStages.includes(requestedStage),
    );
  } else if (requestedVersion !== undefined) {
    version = secret.versions[requestedVersion];
  } else {
    version = Object.values(secret.versions).find((v) =>
      v.VersionStages.includes("AWSCURRENT"),
    );
  }
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
    const oldVersionId = secret.currentVersionId;
    secret.versions[versionId] = version;
    promoteToCurrent(secret, oldVersionId, versionId);
  } else {
    secret.versions[versionId] = version;
  }
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
    const oldVersionId = secret.currentVersionId;
    secret.versions[versionId] = {
      VersionId: versionId,
      SecretString: secretString,
      SecretBinary: secretBinary,
      VersionStages: ["AWSCURRENT"],
      CreatedDate: nowSeconds(),
    };
    promoteToCurrent(secret, oldVersionId, versionId);
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

const RotateSecret: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const lambdaArn = stringOrUndefined(input["RotationLambdaARN"]);
  if (lambdaArn !== undefined) secret.RotationLambdaARN = lambdaArn;
  secret.RotationEnabled = true;
  ctx.store.set(secret.Name, secret);
  return {
    ARN: secret.ARN,
    Name: secret.Name,
    VersionId: secret.currentVersionId,
  };
};

const CancelRotateSecret: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  secret.RotationEnabled = false;
  ctx.store.set(secret.Name, secret);
  return {
    ARN: secret.ARN,
    Name: secret.Name,
    VersionId: secret.currentVersionId,
  };
};

const BatchGetSecretValue: OperationHandler = (input, ctx) => {
  const secretIdList = Array.isArray(input["SecretIdList"])
    ? (input["SecretIdList"] as unknown[]).map((v) => String(v))
    : [];
  const filters = Array.isArray(input["Filters"])
    ? (input["Filters"] as Record<string, unknown>[])
    : [];

  let candidates: StoredSecret[];
  if (secretIdList.length > 0) {
    candidates = secretIdList
      .map((id) => findByIdentifier(ctx, id))
      .filter((s): s is StoredSecret => s !== undefined);
  } else if (filters.length > 0) {
    candidates = ctx.store
      .list<StoredSecret>()
      .filter((entry) => entry.value.DeletedDate === undefined)
      .map((entry) => entry.value);
    for (const filter of filters) {
      const key = String(filter["Key"] ?? "");
      const values = Array.isArray(filter["Values"])
        ? (filter["Values"] as unknown[]).map((v) => String(v))
        : [];
      if (key === "name" && values.length > 0)
        candidates = candidates.filter((s) =>
          values.some((v) => s.Name.includes(v)),
        );
    }
  } else {
    candidates = ctx.store
      .list<StoredSecret>()
      .filter((entry) => entry.value.DeletedDate === undefined)
      .map((entry) => entry.value);
  }

  const secretValues = candidates.map((s) => {
    const version = s.versions[s.currentVersionId];
    return {
      ARN: s.ARN,
      Name: s.Name,
      VersionId: version?.VersionId,
      SecretString: version?.SecretString,
      SecretBinary: version?.SecretBinary,
      VersionStages: version?.VersionStages,
      CreatedDate: version?.CreatedDate,
    };
  });
  return { SecretValues: secretValues, Errors: [] };
};

const UpdateSecretVersionStage: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const stage = String(input["VersionStage"] ?? "");
  const moveToId = stringOrUndefined(input["MoveToVersionId"]);
  const removeFromId = stringOrUndefined(input["RemoveFromVersionId"]);

  if (removeFromId !== undefined) {
    const fromVersion = secret.versions[removeFromId];
    if (fromVersion !== undefined)
      fromVersion.VersionStages = fromVersion.VersionStages.filter(
        (s) => s !== stage,
      );
  }

  if (moveToId !== undefined) {
    const toVersion = secret.versions[moveToId];
    if (toVersion !== undefined && !toVersion.VersionStages.includes(stage))
      toVersion.VersionStages.push(stage);
    if (stage === "AWSCURRENT") {
      secret.currentVersionId = moveToId;
      const previous = Object.values(secret.versions).find(
        (v) =>
          v.VersionId !== moveToId && v.VersionStages.includes("AWSPREVIOUS"),
      );
      if (previous !== undefined)
        previous.VersionStages = previous.VersionStages.filter(
          (s) => s !== "AWSPREVIOUS",
        );
      const old = secret.versions[removeFromId ?? ""];
      if (old !== undefined && !old.VersionStages.includes("AWSPREVIOUS"))
        old.VersionStages.push("AWSPREVIOUS");
    }
  }

  ctx.store.set(secret.Name, secret);
  return { ARN: secret.ARN, Name: secret.Name };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const policy = String(input["ResourcePolicy"] ?? "");
  secret.ResourcePolicy = policy;
  ctx.store.set(secret.Name, secret);
  return { ARN: secret.ARN, Name: secret.Name };
};

const GetResourcePolicy: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  return {
    ARN: secret.ARN,
    Name: secret.Name,
    ResourcePolicy: secret.ResourcePolicy,
  };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  secret.ResourcePolicy = undefined;
  ctx.store.set(secret.Name, secret);
  return { ARN: secret.ARN, Name: secret.Name };
};

const ValidateResourcePolicy: OperationHandler = () => {
  return { PolicyValidationPassed: true, ValidationErrors: [] };
};

const ReplicateSecretToRegions: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const addRegions = Array.isArray(input["AddReplicaRegions"])
    ? (input["AddReplicaRegions"] as Record<string, unknown>[])
    : [];
  for (const replica of addRegions) {
    const region = String(replica["Region"] ?? "");
    const kmsKeyId = stringOrUndefined(replica["KmsKeyId"]);
    const existing = secret.ReplicationStatus.find((r) => r.Region === region);
    if (existing === undefined) {
      secret.ReplicationStatus.push({
        Region: region,
        KmsKeyId: kmsKeyId,
        Status: "InProgress",
        StatusMessage: undefined,
        LastAccessedDate: undefined,
      });
    }
  }
  ctx.store.set(secret.Name, secret);
  return { ARN: secret.ARN, ReplicationStatus: secret.ReplicationStatus };
};

const RemoveRegionsFromReplication: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  const removeRegions = Array.isArray(input["RemoveReplicaRegions"])
    ? (input["RemoveReplicaRegions"] as unknown[]).map((v) => String(v))
    : [];
  secret.ReplicationStatus = secret.ReplicationStatus.filter(
    (r) => !removeRegions.includes(r.Region),
  );
  ctx.store.set(secret.Name, secret);
  return { ARN: secret.ARN, ReplicationStatus: secret.ReplicationStatus };
};

const StopReplicationToReplica: OperationHandler = (input, ctx) => {
  const secret = requireSecret(ctx, secretIdFromInput(input));
  secret.ReplicationStatus = [];
  ctx.store.set(secret.Name, secret);
  return { ARN: secret.ARN };
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
    RotateSecret,
    CancelRotateSecret,
    BatchGetSecretValue,
    UpdateSecretVersionStage,
    PutResourcePolicy,
    GetResourcePolicy,
    DeleteResourcePolicy,
    ValidateResourcePolicy,
    ReplicateSecretToRegions,
    RemoveRegionsFromReplication,
    StopReplicationToReplica,
    ListSecretVersionIds,
    RestoreSecret,
  },
  model,
} as const;

export default secretsManager;
