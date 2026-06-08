import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchGetSecretValueCommand,
  CancelRotateSecretCommand,
  CreateSecretCommand,
  DeleteResourcePolicyCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  GetRandomPasswordCommand,
  GetResourcePolicyCommand,
  ListSecretVersionIdsCommand,
  PutResourcePolicyCommand,
  PutSecretValueCommand,
  RemoveRegionsFromReplicationCommand,
  ReplicateSecretToRegionsCommand,
  RestoreSecretCommand,
  RotateSecretCommand,
  SecretsManagerClient,
  StopReplicationToReplicaCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateSecretVersionStageCommand,
  ValidateResourcePolicyCommand,
} from "@aws-sdk/client-secrets-manager";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sm = () =>
  new SecretsManagerClient({ endpoint, region, credentials, requestHandler });

test("Secrets Manager GetRandomPassword honors length and exclusions", async () => {
  const client = sm();

  const generated = await client.send(
    new GetRandomPasswordCommand({
      PasswordLength: 24,
      ExcludePunctuation: true,
      ExcludeUppercase: true,
    }),
  );
  expect(generated.RandomPassword).toBeDefined();
  expect(generated.RandomPassword?.length).toBe(24);
  expect(generated.RandomPassword).toMatch(/^[a-z0-9]+$/);

  const second = await client.send(new GetRandomPasswordCommand({}));
  expect(second.RandomPassword?.length).toBe(32);
  expect(second.RandomPassword).not.toBe(generated.RandomPassword);
});

test("Secrets Manager Tag and Untag a secret", async () => {
  const client = sm();
  const name = "bunsai-e2e-ops-tags";

  await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "tag-value" }),
  );

  await client.send(
    new TagResourceCommand({
      SecretId: name,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "platform" },
      ],
    }),
  );

  await client.send(
    new UntagResourceCommand({ SecretId: name, TagKeys: ["team"] }),
  );

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("Secrets Manager ListSecretVersionIds returns versions", async () => {
  const client = sm();
  const name = "bunsai-e2e-ops-versions";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "version-value" }),
  );

  const listed = await client.send(
    new ListSecretVersionIdsCommand({ SecretId: name }),
  );
  expect(listed.ARN).toBe(created.ARN);
  expect(listed.Name).toBe(name);
  expect(listed.Versions?.length).toBeGreaterThanOrEqual(1);
  expect(
    listed.Versions?.some((version) => version.VersionId === created.VersionId),
  ).toBe(true);

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("Secrets Manager RestoreSecret cancels deletion", async () => {
  const client = sm();
  const name = "bunsai-e2e-ops-restore";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "restore-value" }),
  );

  const nowSec = Math.floor(Date.now() / 1000);
  const deleted = await client.send(
    new DeleteSecretCommand({ SecretId: name }),
  );
  expect(deleted.DeletionDate).toBeDefined();
  expect(deleted.DeletionDate!.getTime() / 1000).toBeGreaterThan(
    nowSec + 29 * 86400,
  );

  const restored = await client.send(
    new RestoreSecretCommand({ SecretId: name }),
  );
  expect(restored.ARN).toBe(created.ARN);
  expect(restored.Name).toBe(name);

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("Secrets Manager DeleteSecret respects RecoveryWindowInDays", async () => {
  const client = sm();
  const name = "bunsai-e2e-ops-recovery-window";

  await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "window-value" }),
  );

  const nowSec = Math.floor(Date.now() / 1000);
  const deleted = await client.send(
    new DeleteSecretCommand({ SecretId: name, RecoveryWindowInDays: 7 }),
  );
  expect(deleted.DeletionDate).toBeDefined();
  const deletionSec = deleted.DeletionDate!.getTime() / 1000;
  expect(deletionSec).toBeGreaterThan(nowSec + 6 * 86400);
  expect(deletionSec).toBeLessThan(nowSec + 8 * 86400);

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("Secrets Manager RotateSecret and CancelRotateSecret", async () => {
  const client = sm();
  const name = "bunsai-e2e-ops-rotate";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "rotate-value" }),
  );

  const rotated = await client.send(
    new RotateSecretCommand({ SecretId: name }),
  );
  expect(rotated.ARN).toBe(created.ARN);
  expect(rotated.Name).toBe(name);
  expect(rotated.VersionId).toBeDefined();

  const cancelled = await client.send(
    new CancelRotateSecretCommand({ SecretId: name }),
  );
  expect(cancelled.ARN).toBe(created.ARN);
  expect(cancelled.Name).toBe(name);

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("Secrets Manager BatchGetSecretValue returns values", async () => {
  const client = sm();
  const nameA = "bunsai-e2e-ops-batch-a";
  const nameB = "bunsai-e2e-ops-batch-b";

  const createdA = await client.send(
    new CreateSecretCommand({ Name: nameA, SecretString: "batch-value-a" }),
  );
  const createdB = await client.send(
    new CreateSecretCommand({ Name: nameB, SecretString: "batch-value-b" }),
  );

  const result = await client.send(
    new BatchGetSecretValueCommand({ SecretIdList: [nameA, nameB] }),
  );
  expect(result.SecretValues).toBeDefined();
  expect(result.SecretValues?.length).toBe(2);
  const arns = result.SecretValues?.map((v) => v.ARN);
  expect(arns).toContain(createdA.ARN);
  expect(arns).toContain(createdB.ARN);
  expect(result.Errors?.length).toBe(0);

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

test("Secrets Manager UpdateSecretVersionStage moves stage", async () => {
  const client = sm();
  const name = "bunsai-e2e-ops-version-stage";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "stage-value-v1" }),
  );
  const v1 = created.VersionId!;

  const putResult = await client.send(
    new PutSecretValueCommand({
      SecretId: name,
      SecretString: "stage-value-v2",
    }),
  );
  const v2 = putResult.VersionId!;

  await client.send(
    new UpdateSecretVersionStageCommand({
      SecretId: name,
      VersionStage: "AWSCURRENT",
      MoveToVersionId: v1,
      RemoveFromVersionId: v2,
    }),
  );

  const listed = await client.send(
    new ListSecretVersionIdsCommand({ SecretId: name }),
  );
  const v1Entry = listed.Versions?.find((v) => v.VersionId === v1);
  expect(v1Entry?.VersionStages).toContain("AWSCURRENT");

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("Secrets Manager resource policy CRUD", async () => {
  const client = sm();
  const name = "bunsai-e2e-ops-policy";
  const policy = JSON.stringify({ Version: "2012-10-17", Statement: [] });

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "policy-value" }),
  );

  const put = await client.send(
    new PutResourcePolicyCommand({ SecretId: name, ResourcePolicy: policy }),
  );
  expect(put.ARN).toBe(created.ARN);
  expect(put.Name).toBe(name);

  const got = await client.send(
    new GetResourcePolicyCommand({ SecretId: name }),
  );
  expect(got.ARN).toBe(created.ARN);
  expect(got.ResourcePolicy).toBe(policy);

  const deleted = await client.send(
    new DeleteResourcePolicyCommand({ SecretId: name }),
  );
  expect(deleted.ARN).toBe(created.ARN);

  const gotAfterDelete = await client.send(
    new GetResourcePolicyCommand({ SecretId: name }),
  );
  expect(gotAfterDelete.ResourcePolicy).toBeUndefined();

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("Secrets Manager ValidateResourcePolicy returns passed", async () => {
  const client = sm();
  const policy = JSON.stringify({ Version: "2012-10-17", Statement: [] });

  const result = await client.send(
    new ValidateResourcePolicyCommand({ ResourcePolicy: policy }),
  );
  expect(result.PolicyValidationPassed).toBe(true);
  expect(result.ValidationErrors?.length).toBe(0);
});

test("Secrets Manager replication operations", async () => {
  const client = sm();
  const name = "bunsai-e2e-ops-replication";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "replication-value" }),
  );

  const replicated = await client.send(
    new ReplicateSecretToRegionsCommand({
      SecretId: name,
      AddReplicaRegions: [{ Region: "us-west-2" }, { Region: "eu-west-1" }],
    }),
  );
  expect(replicated.ARN).toBe(created.ARN);
  expect(replicated.ReplicationStatus?.length).toBe(2);
  const regions = replicated.ReplicationStatus?.map((r) => r.Region);
  expect(regions).toContain("us-west-2");
  expect(regions).toContain("eu-west-1");
  expect(
    replicated.ReplicationStatus?.every((r) => r.Status === "InSync"),
  ).toBe(true);

  const described = await client.send(
    new DescribeSecretCommand({ SecretId: name }),
  );
  expect(described.ReplicationStatus?.length).toBe(2);
  const describedRegions = described.ReplicationStatus?.map((r) => r.Region);
  expect(describedRegions).toContain("us-west-2");
  expect(describedRegions).toContain("eu-west-1");

  const removed = await client.send(
    new RemoveRegionsFromReplicationCommand({
      SecretId: name,
      RemoveReplicaRegions: ["eu-west-1"],
    }),
  );
  expect(removed.ARN).toBe(created.ARN);
  expect(removed.ReplicationStatus?.length).toBe(1);
  expect(removed.ReplicationStatus?.[0]?.Region).toBe("us-west-2");

  const stopped = await client.send(
    new StopReplicationToReplicaCommand({ SecretId: name }),
  );
  expect(stopped.ARN).toBe(created.ARN);

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});
