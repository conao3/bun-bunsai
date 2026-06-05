import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  ListSecretsCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sm = () =>
  new SecretsManagerClient({ endpoint, region, credentials, requestHandler });

test("Secrets Manager secret lifecycle", async () => {
  const client = sm();
  const name = "bunsai-e2e-secret";
  const initial = "initial-secret-value";
  const updated = "updated-secret-value";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: initial }),
  );
  expect(created.ARN).toBeDefined();
  expect(created.Name).toBe(name);
  expect(created.VersionId).toBeDefined();

  const got = await client.send(new GetSecretValueCommand({ SecretId: name }));
  expect(got.SecretString).toBe(initial);
  expect(got.ARN).toBe(created.ARN);
  expect(got.VersionStages).toContain("AWSCURRENT");

  const put = await client.send(
    new PutSecretValueCommand({ SecretId: name, SecretString: updated }),
  );
  expect(put.VersionId).toBeDefined();
  expect(put.VersionId).not.toBe(created.VersionId);

  const afterPut = await client.send(
    new GetSecretValueCommand({ SecretId: name }),
  );
  expect(afterPut.SecretString).toBe(updated);

  const described = await client.send(
    new DescribeSecretCommand({ SecretId: name }),
  );
  expect(described.Name).toBe(name);
  expect(described.ARN).toBe(created.ARN);

  const listed = await client.send(new ListSecretsCommand({}));
  const names = (listed.SecretList ?? []).map((entry) => entry.Name);
  expect(names).toContain(name);

  const updatedResult = await client.send(
    new UpdateSecretCommand({
      SecretId: name,
      Description: "bunsai e2e description",
    }),
  );
  expect(updatedResult.ARN).toBe(created.ARN);

  const reDescribed = await client.send(
    new DescribeSecretCommand({ SecretId: name }),
  );
  expect(reDescribed.Description).toBe("bunsai e2e description");

  const deleted = await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
  expect(deleted.ARN).toBe(created.ARN);

  await expect(
    client.send(new GetSecretValueCommand({ SecretId: name })),
  ).rejects.toThrow();
});
