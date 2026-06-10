import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateSecretCommand,
  DeleteSecretCommand,
  ListSecretVersionIdsCommand,
  PutSecretValueCommand,
  RotateSecretCommand,
  SecretsManagerClient,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sm = () =>
  new SecretsManagerClient({ endpoint, region, credentials, requestHandler });

test("CreateSecret is idempotent with same ClientRequestToken and values", async () => {
  const client = sm();
  const name = "bunsai-idempotency-create";
  const token = "idempotency-token-create-1";

  const first = await client.send(
    new CreateSecretCommand({
      Name: name,
      SecretString: "value",
      ClientRequestToken: token,
    }),
  );

  const second = await client.send(
    new CreateSecretCommand({
      Name: name,
      SecretString: "value",
      ClientRequestToken: token,
    }),
  );

  expect(second.ARN).toBe(first.ARN);
  expect(second.VersionId).toBe(first.VersionId);

  const listed = await client.send(
    new ListSecretVersionIdsCommand({ SecretId: name }),
  );
  expect(listed.Versions?.length).toBe(1);

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("CreateSecret rejects duplicate name with different ClientRequestToken", async () => {
  const client = sm();
  const name = "bunsai-idempotency-create-conflict";

  await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "value" }),
  );

  await expect(
    client.send(new CreateSecretCommand({ Name: name, SecretString: "value" })),
  ).rejects.toMatchObject({ name: "ResourceExistsException" });

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("PutSecretValue is idempotent with same ClientRequestToken and values", async () => {
  const client = sm();
  const name = "bunsai-idempotency-put";
  const token = "idempotency-token-put-1";

  await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "initial" }),
  );

  const first = await client.send(
    new PutSecretValueCommand({
      SecretId: name,
      SecretString: "updated",
      ClientRequestToken: token,
    }),
  );

  const second = await client.send(
    new PutSecretValueCommand({
      SecretId: name,
      SecretString: "updated",
      ClientRequestToken: token,
    }),
  );

  expect(second.VersionId).toBe(first.VersionId);
  expect(second.VersionStages).toEqual(first.VersionStages);

  const listed = await client.send(
    new ListSecretVersionIdsCommand({ SecretId: name }),
  );
  const tokenVersions = listed.Versions?.filter((v) => v.VersionId === token);
  expect(tokenVersions?.length).toBe(1);

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("PutSecretValue rejects duplicate ClientRequestToken with different values", async () => {
  const client = sm();
  const name = "bunsai-idempotency-put-conflict";
  const token = "idempotency-token-put-conflict-1";

  await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "initial" }),
  );

  await client.send(
    new PutSecretValueCommand({
      SecretId: name,
      SecretString: "value-a",
      ClientRequestToken: token,
    }),
  );

  await expect(
    client.send(
      new PutSecretValueCommand({
        SecretId: name,
        SecretString: "value-b",
        ClientRequestToken: token,
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceExistsException" });

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("UpdateSecret rejects ClientRequestToken matching an existing version", async () => {
  const client = sm();
  const name = "bunsai-idempotency-update";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "initial" }),
  );
  const existingVersionId = created.VersionId!;

  await expect(
    client.send(
      new UpdateSecretCommand({
        SecretId: name,
        SecretString: "new-value",
        ClientRequestToken: existingVersionId,
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceExistsException" });

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("RotateSecret sequential calls succeed (no stuck AWSPENDING)", async () => {
  const client = sm();
  const name = "bunsai-idempotency-rotate-sequential";

  await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "value" }),
  );

  const first = await client.send(new RotateSecretCommand({ SecretId: name }));
  expect(first.VersionId).toBeDefined();

  const second = await client.send(new RotateSecretCommand({ SecretId: name }));
  expect(second.VersionId).toBeDefined();
  expect(second.VersionId).not.toBe(first.VersionId);

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("RotateSecret rejects when a non-current version has AWSPENDING stage", async () => {
  const client = sm();
  const name = "bunsai-idempotency-rotate-stuck-pending";

  await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "value" }),
  );

  await client.send(
    new PutSecretValueCommand({
      SecretId: name,
      SecretString: "pending-value",
      VersionStages: ["AWSPENDING"],
    }),
  );

  await expect(
    client.send(new RotateSecretCommand({ SecretId: name })),
  ).rejects.toMatchObject({ name: "InvalidRequestException" });

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("DeleteSecret rejects RecoveryWindowInDays below 7", async () => {
  const client = sm();
  const name = "bunsai-idempotency-delete-window-low";

  await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "value" }),
  );

  await expect(
    client.send(
      new DeleteSecretCommand({ SecretId: name, RecoveryWindowInDays: 6 }),
    ),
  ).rejects.toMatchObject({ name: "InvalidParameterException" });

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("DeleteSecret rejects RecoveryWindowInDays above 30", async () => {
  const client = sm();
  const name = "bunsai-idempotency-delete-window-high";

  await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "value" }),
  );

  await expect(
    client.send(
      new DeleteSecretCommand({ SecretId: name, RecoveryWindowInDays: 31 }),
    ),
  ).rejects.toMatchObject({ name: "InvalidParameterException" });

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("DeleteSecret accepts RecoveryWindowInDays of exactly 7 and 30", async () => {
  const client = sm();
  const nameA = "bunsai-idempotency-delete-window-7";
  const nameB = "bunsai-idempotency-delete-window-30";

  await client.send(
    new CreateSecretCommand({ Name: nameA, SecretString: "value" }),
  );
  await client.send(
    new CreateSecretCommand({ Name: nameB, SecretString: "value" }),
  );

  const deletedA = await client.send(
    new DeleteSecretCommand({ SecretId: nameA, RecoveryWindowInDays: 7 }),
  );
  expect(deletedA.ARN).toBeDefined();

  const deletedB = await client.send(
    new DeleteSecretCommand({ SecretId: nameB, RecoveryWindowInDays: 30 }),
  );
  expect(deletedB.ARN).toBeDefined();

  await client.send(
    new DeleteSecretCommand({
      SecretId: nameA,
      ForceDeleteWithoutRecovery: true,
    }),
  );
  await client.send(
    new DeleteSecretCommand({
      SecretId: nameB,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});
