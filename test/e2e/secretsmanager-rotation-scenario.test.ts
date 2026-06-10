import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  InvalidRequestException,
  ListSecretVersionIdsCommand,
  PutSecretValueCommand,
  ResourceNotFoundException,
  RestoreSecretCommand,
  SecretsManagerClient,
  UpdateSecretVersionStageCommand,
} from "@aws-sdk/client-secrets-manager";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sm = () =>
  new SecretsManagerClient({ endpoint, region, credentials, requestHandler });

test("rotation staging version stages lifecycle round-trip", async () => {
  const client = sm();
  const name = "rotation-scenario-lifecycle";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "value-v1" }),
  );
  const v1Id = created.VersionId!;
  expect(v1Id).toBeDefined();

  const currentV1 = await client.send(
    new GetSecretValueCommand({ SecretId: name }),
  );
  expect(currentV1.SecretString).toBe("value-v1");
  expect(currentV1.VersionStages).toContain("AWSCURRENT");
  expect(currentV1.VersionId).toBe(v1Id);

  const pendingPut = await client.send(
    new PutSecretValueCommand({
      SecretId: name,
      SecretString: "value-v2",
      VersionStages: ["AWSPENDING"],
    }),
  );
  const v2Id = pendingPut.VersionId!;
  expect(v2Id).not.toBe(v1Id);

  const stillV1 = await client.send(
    new GetSecretValueCommand({ SecretId: name }),
  );
  expect(stillV1.SecretString).toBe("value-v1");
  expect(stillV1.VersionId).toBe(v1Id);

  const pendingVal = await client.send(
    new GetSecretValueCommand({ SecretId: name, VersionStage: "AWSPENDING" }),
  );
  expect(pendingVal.SecretString).toBe("value-v2");
  expect(pendingVal.VersionId).toBe(v2Id);

  await client.send(
    new UpdateSecretVersionStageCommand({
      SecretId: name,
      VersionStage: "AWSCURRENT",
      MoveToVersionId: v2Id,
      RemoveFromVersionId: v1Id,
    }),
  );

  const currentV2 = await client.send(
    new GetSecretValueCommand({ SecretId: name }),
  );
  expect(currentV2.SecretString).toBe("value-v2");
  expect(currentV2.VersionId).toBe(v2Id);
  expect(currentV2.VersionStages).toContain("AWSCURRENT");

  const previousV1 = await client.send(
    new GetSecretValueCommand({ SecretId: name, VersionStage: "AWSPREVIOUS" }),
  );
  expect(previousV1.SecretString).toBe("value-v1");
  expect(previousV1.VersionId).toBe(v1Id);
  expect(previousV1.VersionStages).toContain("AWSPREVIOUS");

  const listed = await client.send(
    new ListSecretVersionIdsCommand({ SecretId: name }),
  );
  const v1Entry = listed.Versions?.find((v) => v.VersionId === v1Id);
  const v2Entry = listed.Versions?.find((v) => v.VersionId === v2Id);
  expect(v1Entry?.VersionStages).toContain("AWSPREVIOUS");
  expect(v2Entry?.VersionStages).toContain("AWSCURRENT");

  const deleted = await client.send(
    new DeleteSecretCommand({ SecretId: name, RecoveryWindowInDays: 7 }),
  );
  expect(deleted.DeletionDate).toBeDefined();

  const described = await client.send(
    new DescribeSecretCommand({ SecretId: name }),
  );
  expect(described.DeletedDate).toBeDefined();

  await expect(
    client.send(new GetSecretValueCommand({ SecretId: name })),
  ).rejects.toThrow(InvalidRequestException);

  const restored = await client.send(
    new RestoreSecretCommand({ SecretId: name }),
  );
  expect(restored.ARN).toBeDefined();
  expect(restored.Name).toBe(name);

  const afterRestore = await client.send(
    new GetSecretValueCommand({ SecretId: name }),
  );
  expect(afterRestore.SecretString).toBe("value-v2");

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );

  await expect(
    client.send(new GetSecretValueCommand({ SecretId: name })),
  ).rejects.toThrow(ResourceNotFoundException);
});
